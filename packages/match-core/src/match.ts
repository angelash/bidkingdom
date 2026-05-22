import { gameConfig as defaultConfig } from '@bitkingdom/config';
import { BidMap } from '@bitkingdom/bidking-compat';
import type {
  AuctionMode,
  BidKingGameDataSnapshot,
  Clue,
  CoreAuctionMode,
  FinalMatchInsight,
  FinalMatchSummary,
  FinalPlayerAuctionStats,
  PublicContainerInfo,
  PublicMatchState,
  PublicPlayer,
  RoundHistoryEntry,
  RevealedItem,
  Rarity,
  RoomSnapshot,
  SkillFeedEntry
} from '@bitkingdom/shared';
import type { GameConfig } from '@bitkingdom/config';
import {
  applyBidKingRoundRule,
  buildBidKingAutoSkillClues,
  buildBidKingOpeningCandidates,
  buildBidKingRoundStartSkillFeed,
  createBidKingCoreWarehouseInstance
} from './bidking/compatRuntime';
import { buildBidKingGameDataSnapshot } from './bidking/gameDataRuntime';
import { bidKingInitialCashForBidMap } from './bidking/initialCashRuntime';
import { buildPrivateClues, buildPublicClues } from './clues';
import { createRandom, hashSeed } from './random';
import { calculateNetWorth, calculateSetBonus, sumItemValue } from './scoring';
import type {
  ContainerInstance,
  CreateMatchPlayer,
  MatchRuntimeState,
  RuntimePlayer,
  RuntimeRound,
  WarehouseSlot
} from './types';

const CORE_WAREHOUSE_ROLL_DURATION_MS = 4400;
const CORE_ROUND_INTEL_DURATION_MS = 3200;

export function createMatch(params: {
  id: string;
  players: CreateMatchPlayer[];
  seed?: number;
  totalRounds?: number;
  coreMode?: boolean;
  coreAuctionMode?: CoreAuctionMode;
  coreBidMapId?: number;
  config?: GameConfig;
  now?: number;
}): MatchRuntimeState {
  const config = params.config ?? defaultConfig;
  const matchInitialCash = params.coreMode
    ? bidKingInitialCashForBidMap(params.coreBidMapId, config.rules.initialCash)
    : config.rules.initialCash;
  const runtimeConfig = matchInitialCash === config.rules.initialCash
    ? config
    : { ...config, rules: { ...config.rules, initialCash: matchInitialCash } };
  const seed = params.seed ?? hashSeed(params.id);
  const now = params.now ?? Date.now();
  const rng = createRandom(seed);
  const players = params.players.slice(0, 4).map<RuntimePlayer>((player, seat) => ({
    ...(() => {
      const role = runtimeConfig.roles.find((candidate) => candidate.id === player.roleId);
      return { skillUsesRemaining: role?.usesPerMatch ?? 1 };
    })(),
    id: player.id,
    seat,
    name: player.name,
    kind: player.kind,
    roleId: player.roleId,
    heroCid: player.heroCid,
    heroSkinCid: player.heroSkinCid,
    selectedItemList: player.selectedItemList?.map((entry) => ({ ...entry })),
    cash: runtimeConfig.rules.initialCash,
    status: 'playing',
    passed: false,
    hasSubmittedBid: false,
    holdings: [],
    skillCooldown: 0,
    skillUsedThisRound: false,
    battleItemCooldowns: {},
    insuranceActive: false,
    privateClues: []
  }));

  if (players.length !== 4) {
    throw new Error(`A match requires exactly 4 players, got ${players.length}`);
  }

  return {
    id: params.id,
    status: 'playing',
    seed,
    coreMode: params.coreMode ?? false,
    coreAuctionMode: params.coreMode ? params.coreAuctionMode ?? rng.pick<CoreAuctionMode>(['open', 'sealed']) : undefined,
    coreBidMapId: params.coreBidMapId,
    roundIndex: -1,
    totalRounds: params.totalRounds ?? runtimeConfig.rules.totalRounds,
    players,
    rng,
    config: runtimeConfig,
    transactions: [],
    events: [],
    roundHistory: [],
    createdAt: now,
    updatedAt: now
  };
}

export function startNextRound(state: MatchRuntimeState, now = Date.now()): MatchRuntimeState {
  if (state.roundIndex + 1 >= state.totalRounds) {
    state.status = 'ended';
    if (state.currentRound) {
      state.currentRound.phase = 'ended';
    }
    state.finalSummary = buildFinalSummary(state);
    pushEvent(state, 'match_ended', undefined, {
      rankings: state.finalSummary.rankings,
      seed: state.seed
    }, now);
    state.updatedAt = now;
    return state;
  }

  state.roundIndex += 1;
  for (const player of state.players) {
    player.passed = false;
    player.hasSubmittedBid = false;
    player.skillUsedThisRound = false;
    player.insuranceActive = false;
    player.privateClues = [];
    player.skillCooldown = Math.max(0, player.skillCooldown - 1);
    player.battleItemCooldowns = decrementRoundCooldowns(player.battleItemCooldowns);
  }

  const container = createContainerInstance(state, now);
  const auctionMode = state.coreMode
    ? state.coreAuctionMode ?? 'sealed'
    : container.auctionModeOverride ?? pickAuctionMode(state, container.templateId);
  const isCoreFirstRound = state.coreMode && state.roundIndex === 0;
  const openingCandidates = isCoreFirstRound ? buildOpeningCandidates(state, container.publicInfo, now) : undefined;
  const auctioneerClue = state.coreMode ? ensureCoreAuctioneerClue(state) : undefined;
  const auctioneerChoices = state.coreMode ? state.coreAuctioneerChoices : undefined;
  const startingPhase: RuntimeRound['phase'] = state.coreMode
    ? isCoreFirstRound
      ? 'warehouse_roll'
      : 'intel'
    : 'container';
  const startingDurationMs = state.coreMode
    ? isCoreFirstRound
      ? CORE_WAREHOUSE_ROLL_DURATION_MS
      : CORE_ROUND_INTEL_DURATION_MS
    : 8000;
  const round: RuntimeRound = {
    id: `${state.id}_round_${state.roundIndex + 1}`,
    index: state.roundIndex,
    phase: startingPhase,
    auctionMode,
    container,
    openingCandidates,
    auctioneerClue,
    auctioneerChoices,
    bids: [],
    currentBid: 0,
    isFinalAuction: state.coreMode ? state.roundIndex >= 4 || state.roundIndex === state.totalRounds - 1 : true,
    warehouseSlots: buildWarehouseSlotViews(
      container.warehouseSlots,
      state.coreMode ? Math.min(state.roundIndex, 4) : state.roundIndex,
      state.coreMode ? 5 : state.totalRounds
    ),
    revealedItems: [],
    skillFeed: [],
    phaseEndsAt: now + startingDurationMs,
    depositPaidByPlayerId: {}
  };

  for (const player of state.players) {
    const privateClues = container.privateCluesByPlayerId[player.id] ?? [];
    player.privateClues = privateClues;
  }
  if (state.coreMode && container.templateId.startsWith('bidmap_')) {
    round.skillFeed = buildBidKingRoundStartSkillFeed(state, round, now);
  }

  state.currentRound = round;
  state.updatedAt = now;
  pushEvent(state, 'round_started', undefined, {
    roundId: round.id,
    auctionMode,
    publicContainer: container.publicInfo
  });
  for (const entry of round.skillFeed) {
    pushEvent(state, 'skill_triggered', entry.playerId, { entry }, now);
  }
  return state;
}

function decrementRoundCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(cooldowns)
      .map(([itemId, remaining]) => [itemId, Math.max(0, remaining - 1)] as const)
      .filter(([, remaining]) => remaining > 0)
  );
}

export function setRoundPhase(
  state: MatchRuntimeState,
  phase: RuntimeRound['phase'],
  durationMs: number,
  now = Date.now()
): MatchRuntimeState {
  const round = requireRound(state);
  round.phase = phase;
  round.phaseEndsAt = now + durationMs;
  state.updatedAt = now;
  pushEvent(state, 'phase_changed', undefined, { roundId: round.id, phase });
  return state;
}

export function getPublicMatchState(state: MatchRuntimeState): PublicMatchState {
  return buildPublicMatchState(state);
}

function buildPublicMatchState(state: MatchRuntimeState, playerId?: string): PublicMatchState {
  return {
    id: state.id,
    status: state.status,
    seed: state.status === 'ended' ? state.seed : 0,
    roundIndex: state.roundIndex,
    totalRounds: state.totalRounds,
    players: state.players.map((player) => publicPlayer(player, state.config, state, playerId)),
    currentRound: state.currentRound ? publicRound(state.currentRound, playerId) : undefined,
    roundHistory: state.roundHistory,
    finalSummary: state.status === 'ended' ? state.finalSummary : undefined,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

export function buildSnapshot(state: MatchRuntimeState, playerId?: string) {
  const player = playerId ? state.players.find((candidate) => candidate.id === playerId) : undefined;
  return {
    public: buildPublicMatchState(state, playerId),
    private: player
      ? {
          playerId: player.id,
          privateClues: player.privateClues,
          skillCooldown: player.skillCooldown,
          skillUsesRemaining: player.skillUsesRemaining,
          skillUsedThisRound: player.skillUsedThisRound,
          insuranceActive: player.insuranceActive,
          battleItemCooldowns: Object.keys(player.battleItemCooldowns).length > 0
            ? { ...player.battleItemCooldowns }
            : undefined
        }
      : undefined
  };
}

export function toRoomSnapshot(params: {
  id: string;
  code: string;
  hostId: string;
  botCount: number;
  totalRounds: number;
  initialCash?: number;
  coreAuctionMode?: CoreAuctionMode;
  selectedBidMapId?: number;
  status: RoomSnapshot['status'];
  players: RuntimePlayer[];
  config?: GameConfig;
}): RoomSnapshot {
  const config = params.config ?? defaultConfig;
  return {
    id: params.id,
    code: params.code,
    hostId: params.hostId,
    botCount: params.botCount,
    totalRounds: params.totalRounds,
    initialCash: params.initialCash ?? config.rules.initialCash,
    coreAuctionMode: params.coreAuctionMode ?? 'sealed',
    selectedBidMapId: params.selectedBidMapId,
    status: params.status,
    players: params.players.map((player) => publicPlayer(player, config))
  };
}

export function requireRound(state: MatchRuntimeState): RuntimeRound {
  if (!state.currentRound) {
    throw new Error('No active round');
  }
  return state.currentRound;
}

export function requirePlayer(state: MatchRuntimeState, playerId: string): RuntimePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Unknown player ${playerId}`);
  }
  return player;
}

export function pushEvent(
  state: MatchRuntimeState,
  type: string,
  actorId: string | undefined,
  payload: unknown,
  now = Date.now()
): void {
  state.events.push({
    id: `${state.id}_event_${state.events.length + 1}`,
    matchId: state.id,
    roundId: state.currentRound?.id,
    type,
    actorId,
    payload,
    createdAt: now
  });
}

export function recordRoundHistory(state: MatchRuntimeState): void {
  const round = requireRound(state);
  if (round.historyRecorded || !round.settlement) {
    return;
  }

  const entry: RoundHistoryEntry = {
    roundId: round.id,
    index: round.index,
    containerName: round.container.publicInfo.name,
    auctionMode: round.auctionMode,
    publicClues: withAuctioneerClue(round).map((clue) => ({ ...clue })),
    privateCluesByPlayerId: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        player.privateClues.map((clue) => ({ ...clue }))
      ])
    ),
    bids: round.bids.map((bid) => ({ ...bid })),
    skillFeed: round.skillFeed.map((entry) => ({ ...entry, targetItemIds: entry.targetItemIds ? [...entry.targetItemIds] : undefined })),
    isFinalAuction: round.isFinalAuction,
    bidFeedback: round.bidFeedback ? { ...round.bidFeedback } : undefined,
    winnerId: round.settlement.winnerId,
    payment: round.settlement.payment,
    trueValue: round.settlement.trueValue,
    profit: round.settlement.profit,
    title: round.settlement.title,
    revealedItems: round.settlement.isFinal === false ? [] : round.container.hiddenItems.map((item) => ({ ...item })),
    settlement: {
      ...round.settlement,
      participants: round.settlement.participants.map((participant) => ({ ...participant })),
      clueReview: round.settlement.clueReview.map((review) => ({ ...review }))
    },
    netWorthAfter: Object.fromEntries(
      state.players.map((player) => [player.id, calculateNetWorth(player, state.config)])
    ),
    bidKingGameData: state.coreMode ? buildBidKingGameDataSnapshot(state, round) : undefined
  };

  state.roundHistory.push(entry);
  round.historyRecorded = true;
}

function createContainerInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  if (!state.coreMode) {
    return createLegacyContainerInstance(state, now);
  }
  if (!state.coreWarehouse) {
    state.coreWarehouse = createCoreWarehouseInstance(state, now);
  }
  return createProgressiveContainerInstance(state);
}

function createCoreWarehouseInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  return createBidKingCoreWarehouseInstance(state, now);
}

function buildOpeningCandidates(
  state: MatchRuntimeState,
  selected: PublicContainerInfo,
  now: number
): PublicContainerInfo[] {
  if (state.coreMode && selected.templateId.startsWith('bidmap_')) {
    return buildBidKingOpeningCandidates(state, selected, now);
  }
  const selectedTemplate = state.config.containers.find((template) => template.id === selected.templateId);
  const otherTemplates = shuffleByRng(
    state.config.containers.filter((template) => template.id !== selected.templateId),
    state
  ).slice(0, 7);
  const templates = shuffleByRng(
    [selectedTemplate, ...otherTemplates].filter((template): template is GameConfig['containers'][number] => Boolean(template)),
    state
  );
  return templates.map((template, index) => (
    template.id === selected.templateId
      ? selected
      : buildContainerPreviewInfo(state, template, now, index)
  ));
}

function buildContainerPreviewInfo(
  state: MatchRuntimeState,
  template: GameConfig['containers'][number],
  now: number,
  index: number
): PublicContainerInfo {
  const sampleItems = template.itemPool
    .slice(0, 28)
    .map((itemId) => state.config.items.find((item) => item.id === itemId))
    .filter((item): item is GameConfig['items'][number] => Boolean(item));
  const averageDisplayValue = sampleItems.length > 0
    ? sampleItems.reduce((sum, item) => sum + item.displayValue, 0) / sampleItems.length
    : 18000;
  const averageCount = (template.itemCountRange[0] + template.itemCountRange[1]) / 2;
  const previewValue = Math.round(averageDisplayValue * averageCount);
  const [minBias, maxBias] = template.publicEstimateBias;
  return {
    id: `${template.id}_preview_${now}_${index}`,
    templateId: template.id,
    name: template.name,
    source: template.source,
    tags: [...template.tags],
    risk: template.risk,
    estimateMin: Math.max(1000, Math.round(previewValue * minBias)),
    estimateMax: Math.max(2000, Math.round(previewValue * maxBias)),
    artKey: template.artKey
  };
}

function shuffleByRng<T>(items: readonly T[], state: MatchRuntimeState): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = state.rng.int(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function ensureCoreAuctioneerClue(state: MatchRuntimeState): Clue {
  if (state.coreAuctioneerClue) {
    return state.coreAuctioneerClue;
  }
  const choices = ensureCoreAuctioneerChoices(state);
  const selected = state.rng.pick(choices);
  const clue = {
    ...selected,
    text: selected.text.replace(/^候选情报：/, '掌眼人情报：')
  };
  state.coreAuctioneerClue = clue;
  return clue;
}

function ensureCoreAuctioneerChoices(state: MatchRuntimeState): Clue[] {
  if (state.coreAuctioneerChoices) {
    return state.coreAuctioneerChoices;
  }
  const core = state.coreWarehouse;
  if (!core) {
    throw new Error('Core warehouse must exist before drawing auctioneer clue');
  }
  const sortedByValue = [...core.warehouseSlots].sort((left, right) => right.item.value - left.item.value);
  const shuffledSlots = shuffleByRng(core.warehouseSlots, state);
  const occupiedGrids = core.warehouseSlots.reduce((sum, slot) => sum + slot.w * slot.h, 0);
  const valuableCount = core.hiddenItems.filter((item) => ['fine', 'rare', 'legendary'].includes(item.rarity)).length;
  const categoryCounts = countBy(core.hiddenItems.map((item) => item.category));
  const dominantCategory = [...categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const baseId = `${core.id}_auctioneer_card`;
  const revealItemIds = (slots: WarehouseSlot[]) => [...new Set(slots.map((slot) => slot.item.id))];
  const selectedSample = shuffledSlots.slice(0, Math.min(4, shuffledSlots.length));
  const largeSample = [...core.warehouseSlots].sort((left, right) => (right.w * right.h) - (left.w * left.h)).slice(0, 3);
  const topSample = sortedByValue.slice(0, Math.min(3, sortedByValue.length));

  const choices: Clue[] = [
    {
      id: `${baseId}_sample`,
      kind: 'category',
      text: `候选情报：随机抽验 ${selectedSample.length} 件藏品，点亮对应格子的轮廓、品质和品类。`,
      accuracy: 1,
      targetItemIds: revealItemIds(selectedSample),
      source: 'public',
      isTruthful: true,
      riskHint: 'unknown'
    },
    {
      id: `${baseId}_quality`,
      kind: 'category',
      text: `候选情报：本仓高品质候选共有 ${valuableCount} 件，标记部分高价值候选格。`,
      accuracy: 1,
      targetItemIds: revealItemIds(topSample),
      source: 'public',
      isTruthful: true,
      riskHint: 'unknown'
    },
    {
      id: `${baseId}_category`,
      kind: 'category',
      text: dominantCategory
        ? `候选情报：${dominantCategory[0]}类藏品数量最多，共 ${dominantCategory[1]} 件，标记样本格。`
        : '候选情报：本仓品类分布分散，标记若干样本格。',
      accuracy: 1,
      targetItemIds: dominantCategory
        ? revealItemIds(core.warehouseSlots.filter((slot) => slot.item.category === dominantCategory[0]).slice(0, 4))
        : revealItemIds(selectedSample),
      source: 'public',
      isTruthful: true,
      riskHint: 'unknown'
    },
    {
      id: `${baseId}_space`,
      kind: 'category',
      text: `候选情报：所有藏品合计占用 ${occupiedGrids} 格，大件样本会在右侧标出。`,
      accuracy: 1,
      targetItemIds: revealItemIds(largeSample),
      source: 'public',
      isTruthful: true,
      riskHint: 'unknown'
    }
  ];
  state.coreAuctioneerChoices = choices;
  return choices;
}

function createLegacyContainerInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  const scripted = state.config.scriptedRounds[state.roundIndex];
  if (scripted) {
    return createScriptedContainerInstance(state, now, scripted);
  }
  return createRandomContainerInstance(state, now);
}

function createRandomContainerInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  const template = state.rng.pick(state.config.containers);
  const [minCount, maxCount] = template.itemCountRange;
  const itemCount = state.rng.int(minCount, maxCount);
  const selectedItems: RevealedItem[] = [];
  const pool = template.itemPool.map((itemId) => {
    const item = state.config.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new Error(`Missing item ${itemId}`);
    }
    return item;
  });

  for (let index = 0; index < itemCount; index += 1) {
    const item = state.rng.pick(pool);
    selectedItems.push({ ...item });
  }

  const trueValue = sumItemValue(selectedItems);
  const [minBias, maxBias] = template.publicEstimateBias;
  const estimateMin = Math.max(1000, Math.round(trueValue * minBias * (0.88 + state.rng.next() * 0.12)));
  const estimateMax = Math.max(estimateMin + 1000, Math.round(trueValue * maxBias * (0.92 + state.rng.next() * 0.16)));
  const publicInfo = {
    id: `${template.id}_${now}`,
    templateId: template.id,
    name: template.name,
    source: template.source,
    tags: template.tags,
    risk: template.risk,
    estimateMin,
    estimateMax,
    artKey: template.artKey
  };

  const publicClues = buildPublicClues({
    source: template.source,
    tags: template.tags,
    risk: template.risk,
    trueValue,
    estimateMin,
    estimateMax,
    hiddenItems: selectedItems
  });
  const privateCluesByPlayerId = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      buildPrivateClues({ player, hiddenItems: selectedItems, trueValue, rng: state.rng })
    ])
  );

  return {
    id: publicInfo.id,
    templateId: template.id,
    publicInfo,
    hiddenItems: selectedItems,
    warehouseSlots: buildWarehouseSlots(selectedItems),
    publicClues,
    privateCluesByPlayerId
  };
}

function createProgressiveContainerInstance(state: MatchRuntimeState): ContainerInstance {
  const core = applyBidKingRoundRule(state.coreWarehouse!, state.roundIndex, state);
  return {
    ...core,
    publicClues: buildProgressivePublicClues(core, state.roundIndex, state.totalRounds),
    privateCluesByPlayerId: buildProgressivePrivateClues(core, state),
    auctionModeOverride: state.coreAuctionMode,
    depositValue: undefined,
    auctionDurationMs: core.auctionDurationMs,
    minimumBid: core.minimumBid
  };
}

function createScriptedContainerInstance(
  state: MatchRuntimeState,
  now: number,
  scripted: GameConfig['scriptedRounds'][number]
): ContainerInstance {
  const hiddenItems = scripted.itemIds.map((itemId) => {
    const item = state.config.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new Error(`Missing scripted item ${itemId}`);
    }
    return { ...item };
  });
  const publicInfo = {
    id: `${scripted.id}_${now}`,
    templateId: scripted.id,
    name: scripted.name,
    source: scripted.source,
    tags: scripted.tags,
    risk: scripted.risk,
    estimateMin: scripted.estimateMin,
    estimateMax: scripted.estimateMax,
    artKey: scripted.artKey
  };
  const publicClues: Clue[] = [
    {
      id: `${scripted.id}_public_value`,
      kind: 'value',
      text: `公共估值约为 ${scripted.estimateMin.toLocaleString()} ～ ${scripted.estimateMax.toLocaleString()}。`,
      accuracy: 0.78,
      valueHint: { min: scripted.estimateMin, max: scripted.estimateMax },
      source: 'public',
      isTruthful: true
    },
    ...scripted.publicClues.map((text, index): Clue => ({
      id: `${scripted.id}_public_${index + 1}`,
      kind: inferClueKind(text),
      text,
      accuracy: 0.82,
      source: 'public',
      isTruthful: true,
      riskHint: inferRiskHint(text)
    }))
  ];
  const privateCluesByPlayerId = Object.fromEntries(
    state.players.map((player) => {
      const texts = scripted.privateCluesBySeat[player.seat] ?? scripted.privateCluesBySeat[0]!;
      return [
        player.id,
        texts.map((text, index): Clue => ({
          id: `${scripted.id}_private_${player.seat}_${index + 1}`,
          kind: inferClueKind(text),
          text,
          accuracy: 0.78,
          source: 'private',
          isTruthful: true,
          riskHint: inferRiskHint(text)
        }))
      ];
    })
  );

  return {
    id: publicInfo.id,
    templateId: scripted.id,
    publicInfo,
    hiddenItems,
    warehouseSlots: buildWarehouseSlots(hiddenItems),
    publicClues,
    privateCluesByPlayerId,
    auctionModeOverride: scripted.auctionMode,
    depositValue: scripted.depositValue,
    auctionDurationMs: scripted.auctionDurationMs
  };
}

function buildProgressivePublicClues(
  core: ContainerInstance,
  roundIndex: number,
  totalRounds: number
): Clue[] {
  const normalizedRoundIndex = Math.min(roundIndex, 4);
  const visibleSlots = buildWarehouseSlotViews(core.warehouseSlots, normalizedRoundIndex, Math.min(totalRounds, 5));
  const knownRarityCount = visibleSlots.filter((slot) => slot.visibleRarity).length;
  const knownCategoryCount = visibleSlots.filter((slot) => slot.visibleCategory).length;
  const knownValueCount = visibleSlots.filter((slot) => slot.visibleValueRange).length;
  const roundClue: Clue = {
    id: `${core.id}_round_${roundIndex + 1}_progress`,
    kind: knownValueCount > 0 ? 'value' : knownCategoryCount > 0 ? 'category' : 'risk',
    text: `第${roundIndex + 1}轮揭示：已能辨认 ${visibleSlots.filter((slot) => slot.visibleShape).length} 个轮廓、${knownRarityCount} 个稀有度、${knownCategoryCount} 个品类${knownValueCount > 0 ? `、${knownValueCount} 个价值区间` : ''}。`,
    accuracy: 1,
    source: 'public',
    isTruthful: true,
    riskHint: 'unknown'
  };
  return [
    ...core.publicClues.slice(0, Math.min(core.publicClues.length, 1 + Math.floor(normalizedRoundIndex / 2))),
    roundClue
  ];
}

function buildProgressivePrivateClues(
  core: ContainerInstance,
  state: MatchRuntimeState
): Record<string, Clue[]> {
  const roundIndex = state.roundIndex;
  return Object.fromEntries(
    state.players.map((player) => {
      const clues = core.privateCluesByPlayerId[player.id] ?? [];
      return [
        player.id,
        [
          ...clues.slice(0, Math.min(clues.length, 1 + Math.floor(roundIndex / 2))),
          ...(core.templateId.startsWith('bidmap_')
            ? buildBidKingAutoSkillClues(core, state, player, roundIndex)
            : buildAutoRoleClues(core, state, player, roundIndex))
        ]
      ];
    })
  );
}

function buildAutoRoleClues(
  core: ContainerInstance,
  state: MatchRuntimeState,
  player: RuntimePlayer,
  roundIndex: number
): Clue[] {
  const role = state.config.roles.find((candidate) => candidate.id === player.roleId);
  if (!role) {
    return [];
  }
  const trueValue = sumItemValue(core.hiddenItems);
  const clueId = `${core.id}_auto_${player.id}_${roundIndex + 1}_${role.skillId}`;
  const precision = Math.min(0.28, 0.14 + roundIndex * 0.035);
  const low = Math.max(1000, Math.round(trueValue * (0.82 - (0.14 - precision / 2))));
  const high = Math.max(low + 1000, Math.round(trueValue * (1.18 + (0.14 - precision / 2))));
  const highestItems = [...core.warehouseSlots].sort((left, right) => right.item.value - left.item.value);
  const repairSlots = core.warehouseSlots.filter((slot) => slot.item.repairCost > 0 || slot.item.isFake);
  const lowValueItems = core.hiddenItems.filter((item) => item.rarity === 'junk' || item.isFake || item.value < item.displayValue * 0.35);

  if (role.skillId === 'appraise_value') {
    return [{
      id: clueId,
      kind: 'value',
      text: `${role.name}自动鉴定：本仓真实总值大概率在 ${low.toLocaleString()} ～ ${high.toLocaleString()}。`,
      accuracy: 0.82 + Math.min(0.12, roundIndex * 0.03),
      valueHint: { min: low, max: high },
      source: 'skill',
      isTruthful: true
    }];
  }

  if (role.skillId === 'single_treasure') {
    const target = highestItems[Math.min(roundIndex, highestItems.length - 1)];
    if (!target) {
      return [];
    }
    return [{
      id: clueId,
      kind: 'category',
      text: `${role.name}盯出一个高价值候选格：${target.item.category}，品质接近${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.9,
      targetItemId: target.item.id,
      targetItemIds: [target.item.id],
      source: 'skill',
      isTruthful: true
    }];
  }

  if (role.skillId === 'repair_audit') {
    const target = repairSlots[Math.min(roundIndex, repairSlots.length - 1)];
    return [{
      id: clueId,
      kind: 'risk',
      text: target
        ? `${role.name}发现一个风险格：可能存在${target.item.isFake ? '真伪问题' : `约 ${target.item.repairCost.toLocaleString()} 修复成本`}。`
        : `${role.name}复核后认为：当前已知样本中没有明显高修复费风险。`,
      accuracy: 0.88,
      targetItemId: target?.item.id,
      targetItemIds: target ? [target.item.id] : undefined,
      source: 'skill',
      isTruthful: true,
      riskHint: target?.item.isFake ? 'fake' : target ? 'repair' : 'safe'
    }];
  }

  if (role.skillId === 'loss_insurance') {
    const lowTotal = lowValueItems.reduce((sum, item) => sum + item.value, 0);
    return [{
      id: clueId,
      kind: 'risk',
      text: `${role.name}避坑账：低价值或异常藏品约 ${lowValueItems.length} 件，真实合计约 ${lowTotal.toLocaleString()}。`,
      accuracy: 0.84,
      valueHint: {
        min: Math.max(0, Math.round(lowTotal * 0.8)),
        max: Math.round(lowTotal * 1.2)
      },
      source: 'skill',
      isTruthful: true,
      riskHint: lowValueItems.length > 0 ? 'unknown' : 'safe'
    }];
  }

  if (role.skillId === 'read_intent') {
    const lastLeaderId = state.roundHistory[state.roundHistory.length - 1]?.bidFeedback?.leaderPlayerId;
    const lastLeader = state.players.find((candidate) => candidate.id === lastLeaderId);
    const anchor = (core.publicInfo.estimateMin + core.publicInfo.estimateMax) / 2;
    return [{
      id: clueId,
      kind: 'opponent',
      text: lastLeader
        ? `${role.name}读局：上一轮领先者${lastLeader.name}可能会围绕 ${Math.round(anchor * 0.75).toLocaleString()} ～ ${Math.round(anchor * 1.15).toLocaleString()} 调整。`
        : `${role.name}读局：首轮对手尚无报价轨迹，先按公共估值中位数校准心理价。`,
      accuracy: 0.72,
      valueHint: { min: Math.round(anchor * 0.75), max: Math.round(anchor * 1.15) },
      source: 'skill',
      isTruthful: true
    }];
  }

  if (role.skillId === 'spread_rumor') {
    const target = shuffleByRng(core.warehouseSlots, state)[0];
    return [{
      id: clueId,
      kind: 'false',
      text: target
        ? `${role.name}辨认出一条场边传闻指向的格子，实际更可能只是${target.item.category}样本。`
        : `${role.name}暂时没有发现可利用的传闻样本。`,
      accuracy: 0.62,
      targetItemId: target?.item.id,
      targetItemIds: target ? [target.item.id] : undefined,
      source: 'skill',
      isTruthful: true,
      riskHint: 'unknown'
    }];
  }

  return [];
}

function rarityNameForText(rarity: Rarity): string {
  const names: Record<Rarity, string> = {
    junk: '残品',
    common: '普通',
    fine: '精品',
    rare: '稀有',
    legendary: '传世',
    fake: '仿品'
  };
  return names[rarity];
}

function buildWarehouseSlots(items: RevealedItem[]): WarehouseSlot[] {
  const columns = 8;
  let x = 0;
  let y = 0;
  let rowHeight = 1;
  return items.map((item, index) => {
    const { w, h } = slotSizeForItem(item);
    if (x + w > columns) {
      x = 0;
      y += rowHeight;
      rowHeight = 1;
    }
    const slot = {
      slotId: `slot_${index + 1}`,
      item,
      x,
      y,
      w,
      h
    };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return slot;
  });
}

function slotSizeForItem(item: RevealedItem): { w: number; h: number } {
  return {
    w: Math.max(1, Math.min(3, item.footprint.w)),
    h: Math.max(1, Math.min(3, item.footprint.h))
  };
}

function buildWarehouseSlotViews(
  slots: WarehouseSlot[],
  roundIndex: number,
  totalRounds: number
) {
  const progress = Math.min(1, (roundIndex + 1) / Math.max(1, totalRounds));
  const shapeLimit = Math.ceil(slots.length * Math.min(1, 0.25 + progress * 0.85));
  const rarityLimit = Math.ceil(slots.length * Math.min(1, 0.08 + progress * 0.55));
  const categoryLimit = Math.ceil(slots.length * Math.max(0, progress - 0.2) * 0.65);
  const valueLimit = Math.ceil(slots.length * Math.max(0, progress - 0.55) * 0.35);
  return slots.map((slot, index) => {
    const visibleShape = index < shapeLimit;
    const visibleRarity = index < rarityLimit ? slot.item.rarity : undefined;
    const visibleCategory = index < categoryLimit ? slot.item.category : undefined;
    const visibleValueRange = index < valueLimit
      ? {
          min: Math.max(1000, Math.round(slot.item.displayValue * 0.78)),
          max: Math.round(slot.item.displayValue * 1.18)
        }
      : undefined;
    return {
      slotId: slot.slotId,
      itemId: visibleShape ? slot.item.id : undefined,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      visibleShape,
      visibleRarity,
      visibleCategory,
      visibleValueRange,
      itemName: visibleValueRange ? slot.item.name : undefined,
      iconKey: visibleValueRange ? slot.item.iconKey : undefined
    };
  });
}

function pickAuctionMode(state: MatchRuntimeState, templateId: string): AuctionMode {
  const template = state.config.containers.find((candidate) => candidate.id === templateId);
  if (!template) {
    return 'open';
  }
  return state.rng.weighted([
    { item: 'open', weight: template.auctionModeWeights.open },
    { item: 'sealed', weight: template.auctionModeWeights.sealed },
    { item: 'second_price', weight: template.auctionModeWeights.second_price },
    { item: 'deposit_open', weight: template.auctionModeWeights.deposit_open },
    { item: 'flash', weight: template.auctionModeWeights.flash }
  ]);
}

function publicPlayer(
  player: RuntimePlayer,
  config: GameConfig,
  state?: MatchRuntimeState,
  viewerId?: string
): PublicPlayer {
  return {
    id: player.id,
    seat: player.seat,
    name: player.name,
    kind: player.kind,
    roleId: player.roleId,
    heroCid: player.heroCid,
    heroSkinCid: player.heroSkinCid,
    cash: player.cash,
    netWorth: calculateNetWorth(player, config),
    status: player.status,
    hasSubmittedBid: player.hasSubmittedBid,
    passed: player.passed,
    bidRanks: state ? buildPlayerBidRanks(state, player.id, viewerId) : undefined,
    emote: player.emote,
    emoteSoundId: player.emoteSoundId,
    emoteAnimationKey: player.emoteAnimationKey,
    emoteEffectKey: player.emoteEffectKey,
    emoteEffectViewIds: player.emoteEffectViewIds,
    emoteVisualClass: player.emoteVisualClass
  };
}

function buildPlayerBidRanks(
  state: MatchRuntimeState,
  playerId: string,
  viewerId?: string
): NonNullable<PublicPlayer['bidRanks']> {
  const ranks = Array.from({ length: Math.max(5, state.totalRounds) }, (_, index) => ({
    round: index + 1,
    rank: undefined as number | undefined,
    submitted: false,
    amount: undefined as number | undefined,
    visibleAmount: false,
    usedSkillName: undefined as string | undefined,
    usedSkillIconKey: undefined as string | undefined,
    usedSkillSource: undefined as NonNullable<PublicPlayer['bidRanks']>[number]['usedSkillSource']
  }));

  for (const history of state.roundHistory) {
    const rank = history.bidFeedback?.publicRanking.find((entry) => entry.playerId === playerId)?.rank;
    const bid = history.bids.find((entry) => entry.playerId === playerId);
    const revealAmount = shouldRevealHistoryBidAmounts(state, history) || playerId === viewerId;
    const skill = skillCellForPlayerRound(history.skillFeed ?? [], playerId);
    ranks[history.index] = {
      round: history.index + 1,
      rank,
      submitted: Boolean(bid && bid.amount > 0),
      amount: bid && revealAmount ? bid.amount : undefined,
      visibleAmount: Boolean(bid && revealAmount),
      usedSkillName: skill?.skillName,
      usedSkillIconKey: skill?.iconKey,
      usedSkillSource: skill?.source
    };
  }

  const currentRound = state.currentRound;
  if (currentRound) {
    const rank = currentRound.bidFeedback?.publicRanking.find((entry) => entry.playerId === playerId)?.rank;
    const bid = currentRound.bids.find((entry) => entry.playerId === playerId);
    const revealAmount = shouldRevealRoundBidAmounts(currentRound) || playerId === viewerId;
    const skill = skillCellForPlayerRound(currentRound.skillFeed, playerId);
    ranks[currentRound.index] = {
      round: currentRound.index + 1,
      rank,
      submitted: Boolean(bid && bid.amount > 0),
      amount: bid && revealAmount ? bid.amount : undefined,
      visibleAmount: Boolean(bid && revealAmount),
      usedSkillName: skill?.skillName,
      usedSkillIconKey: skill?.iconKey,
      usedSkillSource: skill?.source
    };
  }

  return ranks;
}

function skillCellForPlayerRound(
  skillFeed: readonly SkillFeedEntry[],
  playerId: string
): SkillFeedEntry | undefined {
  return [...skillFeed]
    .reverse()
    .find((entry) => entry.playerId === playerId && entry.source !== 'map');
}

function shouldRevealHistoryBidAmounts(state: MatchRuntimeState, history: RoundHistoryEntry): boolean {
  return history.auctionMode === 'open'
    || history.auctionMode === 'deposit_open'
    || state.status === 'ended'
    || Boolean(history.settlement.isFinal);
}

function shouldRevealRoundBidAmounts(round: RuntimeRound): boolean {
  return round.auctionMode === 'open'
    || round.auctionMode === 'deposit_open'
    || Boolean(round.settlement?.isFinal && ['reveal', 'settlement', 'ended'].includes(round.phase));
}

function inferClueKind(text: string): Clue['kind'] {
  if (text.includes('传闻') || text.includes('假情报')) {
    return 'false';
  }
  if (text.includes('风险') || text.includes('赝品') || text.includes('异常') || text.includes('修复') || text.includes('裂')) {
    return 'risk';
  }
  if (text.includes('玩家')) {
    return 'opponent';
  }
  if (text.includes('套装')) {
    return 'set';
  }
  if (text.includes('价值') || text.includes('估值')) {
    return 'value';
  }
  return 'category';
}

function inferRiskHint(text: string): Clue['riskHint'] {
  if (text.includes('赝品') || text.includes('异常') || text.includes('真假')) {
    return 'fake';
  }
  if (text.includes('修复') || text.includes('裂') || text.includes('破损')) {
    return 'repair';
  }
  if (text.includes('稳定') || text.includes('风险较低')) {
    return 'safe';
  }
  return 'unknown';
}

function publicRound(round: RuntimeRound, playerId?: string): PublicMatchState['currentRound'] {
  const exposeBidAmounts = shouldRevealRoundBidAmounts(round);
  return {
    id: round.id,
    index: round.index,
    phase: round.phase,
    auctionMode: round.auctionMode,
    isFinalAuction: round.isFinalAuction,
    container: round.container.publicInfo,
    openingCandidates: round.openingCandidates?.map((candidate) => ({ ...candidate })),
    auctioneerClue: round.auctioneerClue ? { ...round.auctioneerClue } : undefined,
    auctioneerChoices: round.auctioneerChoices?.map((choice) => ({ ...choice })),
    publicClues: publicCluesForRound(round),
    warehouseSlots: publicWarehouseSlots(round, playerId),
    bids: exposeBidAmounts ? round.bids.map((bid) => ({ ...bid })) : round.bids.map((bid) => ({
      ...bid,
      amount: bid.visible || bid.playerId === playerId ? bid.amount : 0
    })),
    currentBid: round.currentBid,
    currentLeaderId: round.currentLeaderId,
    bidFeedback: personalizeBidFeedback(round.bidFeedback, round, playerId),
    skillFeed: publicSkillFeedForRound(round.skillFeed, playerId),
    revealedItems: round.revealedItems,
    settlement: ['reveal', 'settlement', 'ended'].includes(round.phase) ? round.settlement : undefined,
    phaseEndsAt: round.phaseEndsAt,
    minimumBid: round.container.minimumBid
  };
}

function personalizeBidFeedback(
  feedback: RuntimeRound['bidFeedback'],
  round: RuntimeRound,
  playerId?: string
): RuntimeRound['bidFeedback'] {
  if (!feedback) {
    return feedback;
  }
  const exposeBidAmounts = shouldRevealRoundBidAmounts(round);
  return {
    ...feedback,
    publicRanking: feedback.publicRanking.map((entry) => {
      const visibleAmount = exposeBidAmounts || entry.playerId === playerId;
      return {
        ...entry,
        amount: visibleAmount ? entry.amount : undefined,
        visibleAmount
      };
    })
  };
}

function publicSkillFeedForRound(
  skillFeed: readonly SkillFeedEntry[],
  playerId?: string
): SkillFeedEntry[] {
  return skillFeed
    .filter((entry) => entry.visibility === 'public' || entry.playerId === playerId)
    .map((entry) => ({
      ...entry,
      targetItemIds: entry.targetItemIds ? [...entry.targetItemIds] : undefined
    }));
}

function publicCluesForRound(round: RuntimeRound): Clue[] {
  if (round.auctioneerClue && !['warehouse_roll', 'warehouse_selected'].includes(round.phase)) {
    return withAuctioneerClue(round).map((clue) => ({ ...clue }));
  }
  return round.container.publicClues.map((clue) => ({ ...clue }));
}

function withAuctioneerClue(round: RuntimeRound): Clue[] {
  if (!round.auctioneerClue) {
    return round.container.publicClues;
  }
  const existingIds = new Set(round.container.publicClues.map((clue) => clue.id));
  return existingIds.has(round.auctioneerClue.id)
    ? round.container.publicClues
    : [round.auctioneerClue, ...round.container.publicClues];
}

function publicWarehouseSlots(round: RuntimeRound, playerId?: string) {
  const isFinalReveal = Boolean(round.settlement?.isFinal && ['reveal', 'settlement', 'ended'].includes(round.phase));
  if (!isFinalReveal) {
    return applyKnowledgeToSlotViews(round, playerId);
  }
  const revealedIds = new Set(round.revealedItems.map((item) => item.id));
  const forceOpened = round.phase !== 'reveal';
  return round.container.warehouseSlots.map((slot) => {
    const opened = forceOpened || revealedIds.has(slot.item.id);
    return {
      slotId: slot.slotId,
      itemId: slot.item.id,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      visibleShape: true,
      visibleRarity: opened ? slot.item.rarity : undefined,
      visibleCategory: opened ? slot.item.category : undefined,
      visibleValueRange: opened
        ? {
            min: slot.item.value,
            max: slot.item.value
          }
        : undefined,
      itemName: opened ? slot.item.name : undefined,
      iconKey: opened ? slot.item.iconKey : undefined
    };
  });
}

function applyKnowledgeToSlotViews(round: RuntimeRound, playerId?: string) {
  const auctioneerActive = Boolean(round.auctioneerClue && !['warehouse_roll', 'warehouse_selected'].includes(round.phase));
  const publicTargets = auctioneerActive ? clueTargetIds(round.auctioneerClue) : new Set<string>();
  const privateTargets = playerId
    ? clueTargetIds(...(round.container.privateCluesByPlayerId[playerId] ?? []))
    : new Set<string>();

  return round.warehouseSlots.map((slotView) => {
    const realSlot = round.container.warehouseSlots.find((slot) => slot.slotId === slotView.slotId);
    if (!realSlot) {
      return { ...slotView };
    }
    const publicMarked = publicTargets.has(realSlot.item.id);
    const privateMarked = privateTargets.has(realSlot.item.id);
    if (!publicMarked && !privateMarked) {
      return { ...slotView };
    }
    return {
      ...slotView,
      itemId: realSlot.item.id,
      visibleShape: true,
      visibleRarity: realSlot.item.rarity,
      visibleCategory: realSlot.item.category,
      markedBySkill: true,
      markReason: publicMarked ? '掌眼人情报' : '名士掌眼'
    };
  });
}

function clueTargetIds(...clues: Array<Clue | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const clue of clues) {
    if (!clue) {
      continue;
    }
    if (clue.targetItemId) {
      ids.add(clue.targetItemId);
    }
    for (const id of clue.targetItemIds ?? []) {
      ids.add(id);
    }
  }
  return ids;
}

function buildFinalSummary(state: MatchRuntimeState): FinalMatchSummary {
  const rankings = [...state.players]
    .map((player) => {
      const holdingsValue = sumItemValue(player.holdings);
      const setBonus = calculateSetBonus(player.holdings, state.config);
      return {
        playerId: player.id,
        name: player.name,
        rank: 0,
        cash: player.cash,
        holdingsValue,
        setBonus,
        netWorth: calculateNetWorth(player, state.config)
      };
    })
    .sort((left, right) => right.netWorth - left.netWorth)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  const startValues = Object.fromEntries(
    state.players.map((player) => [player.id, state.config.rules.initialCash])
  );
  const netWorthCurve = [
    { label: '开局', values: startValues },
    ...state.roundHistory.map((round) => ({
      label: `第${round.index + 1}轮`,
      values: round.netWorthAfter
    }))
  ];

  const profitRounds = state.roundHistory.filter((round) => round.winnerId);
  const bestRound = [...profitRounds].sort((left, right) => right.profit - left.profit)[0];
  const worstRound = [...profitRounds].sort((left, right) => left.profit - right.profit)[0];

  const bestMove = bestRound ? buildInsight(state, bestRound, 'best') : {
    title: '谨慎观望',
    detail: '本局没有明显捡漏，主要胜负来自保守控制风险。'
  };
  const biggestMistake = worstRound && worstRound.profit < 0 ? buildInsight(state, worstRound, 'worst') : {
    title: '没有严重失误',
    detail: '本局亏损控制较好，没有出现明显高价接盘。'
  };

  const uniqueItems = new Map<string, RevealedItem>();
  const awardedItemsByPlayerId: Record<string, RevealedItem[]> = Object.fromEntries(
    state.players.map((player) => [player.id, []])
  );
  for (const round of state.roundHistory) {
    for (const item of round.revealedItems) {
      uniqueItems.set(item.id, item);
    }
    if (round.winnerId) {
      awardedItemsByPlayerId[round.winnerId]?.push(...round.revealedItems.map((item) => ({ ...item })));
    }
  }
  const auctionStats = buildAuctionStats(state);

  return {
    matchId: state.id,
    seed: state.seed,
    rankings,
    netWorthCurve,
    bestMove,
    biggestMistake,
    revealedItems: [...uniqueItems.values()],
    awardedItemsByPlayerId,
    auctionStats,
    bidKingReplay: state.coreMode
      ? state.roundHistory
          .map((round) => round.bidKingGameData)
          .filter((entry): entry is BidKingGameDataSnapshot => Boolean(entry))
      : undefined,
    rewards: rankings.map((player) => ({
      playerId: player.playerId,
      xp: 110 + (4 - player.rank) * 25,
      coins: 0,
      rankPoints: [35, 15, -5, -15][player.rank - 1] ?? 0
    })),
    eventCount: state.events.length + 1,
    transactionCount: state.transactions.length
  };
}

function buildAuctionStats(state: MatchRuntimeState): FinalPlayerAuctionStats[] {
  const bidMapId = state.coreBidMapId;
  const parentMapId = bidMapId !== undefined ? BidMap.find((row) => row.id === bidMapId)?.parent_map_id : undefined;
  return state.players.map((player) => {
    const wonRounds = state.roundHistory.filter((round) => round.winnerId === player.id);
    const bidAmounts = state.roundHistory.flatMap((round) => (
      round.bids.filter((bid) => bid.playerId === player.id).map((bid) => bid.amount)
    ));
    const settlementRows = state.roundHistory
      .map((round) => round.settlement?.participants.find((participant) => participant.playerId === player.id))
      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));
    const totalProfit = wonRounds.reduce((sum, round) => sum + Math.max(0, round.profit), 0);
    const netProfit = settlementRows.reduce((sum, participant) => sum + participant.profit, 0);
    const failedAuctionCount = state.roundHistory.filter((round) => (
      Boolean(round.winnerId) &&
      round.winnerId !== player.id &&
      round.bids.some((bid) => bid.playerId === player.id)
    )).length;
    const highestBidAmount = bidAmounts.reduce((max, amount) => Math.max(max, amount), 0);
    const highestSingleAuctionProfit = wonRounds.reduce((max, round) => Math.max(max, round.profit), 0);
    const wonItems = wonRounds.flatMap((round) => round.revealedItems);
    const highestItemValue = wonItems.reduce((max, item) => Math.max(max, item.displayValue || item.value), 0);
    const winningItemTotals = wonRounds.map((round) => Math.max(0, round.trueValue));
    const highestWinningItemTotalValue = winningItemTotals.reduce((max, value) => Math.max(max, value), 0);
    const lowestWinningItemTotalValue = winningItemTotals.length > 0
      ? winningItemTotals.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY)
      : undefined;
    const completedMapIds = parentMapId !== undefined && state.roundHistory.length > 0 ? [parentMapId] : [];
    const completedBidMapIds = bidMapId !== undefined && state.roundHistory.length > 0 ? [bidMapId] : [];
    const successfulAuctionCountByMap = parentMapId !== undefined && wonRounds.length > 0
      ? { [String(parentMapId)]: wonRounds.length }
      : undefined;
    const lowestWinningItemTotalValueByMap = parentMapId !== undefined && lowestWinningItemTotalValue !== undefined
      ? { [String(parentMapId)]: lowestWinningItemTotalValue }
      : undefined;
    const lowestWinningItemTotalValueByBidMap = bidMapId !== undefined && lowestWinningItemTotalValue !== undefined
      ? { [String(bidMapId)]: lowestWinningItemTotalValue }
      : undefined;

    return {
      playerId: player.id,
      totalProfit,
      netProfit,
      successfulAuctionCount: wonRounds.length,
      failedAuctionCount,
      highestBidAmount,
      highestSingleAuctionProfit,
      currentTotalAssets: calculateNetWorth(player, state.config),
      highestItemValue,
      highestWinningItemTotalValue,
      lowestWinningItemTotalValue,
      completedMapIds,
      completedBidMapIds,
      successfulAuctionCountByMap,
      lowestWinningItemTotalValueByMap,
      lowestWinningItemTotalValueByBidMap
    };
  });
}

function buildInsight(
  state: MatchRuntimeState,
  round: RoundHistoryEntry,
  kind: 'best' | 'worst'
): FinalMatchInsight {
  const winner = state.players.find((player) => player.id === round.winnerId);
  if (kind === 'best') {
    return {
      playerId: winner?.id,
      playerName: winner?.name,
      roundIndex: round.index,
      title: round.profit > 0 ? '最佳操作：低价捡漏' : '最佳操作：亏损最小',
      detail: `${winner?.name ?? '玩家'}在第${round.index + 1}轮“${round.containerName}”以${round.payment.toLocaleString()}成交，真值${round.trueValue.toLocaleString()}，净收益${round.profit.toLocaleString()}。`,
      amount: round.profit
    };
  }
  return {
    playerId: winner?.id,
    playerName: winner?.name,
    roundIndex: round.index,
    title: '最大失误：高价接盘',
    detail: `${winner?.name ?? '玩家'}在第${round.index + 1}轮“${round.containerName}”净亏${Math.abs(round.profit).toLocaleString()}，复盘时应重点看赝品、修复费和假情报线索。`,
    amount: round.profit
  };
}
