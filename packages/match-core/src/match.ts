import { gameConfig as defaultConfig } from '@bitkingdom/config';
import { BidMap, Item } from '@bitkingdom/bidking-compat';
import type {
  BidKingBoxInfoDataSnapshot,
  BidKingGameDataSnapshot,
  BidKingProtocolMessageRef,
  BidKingShopStatusDataSnapshot,
  BidKingSimGameLogSnapshot,
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
  RoomSnapshot,
  SkillFeedEntry,
  WarehouseSlotView
} from '@bitkingdom/shared';
import type { GameConfig } from '@bitkingdom/config';
import {
  applyBidKingRoundRule,
  buildBidKingOpeningCandidates,
  buildBidKingRoundStartSkillFeed,
  createBidKingCoreWarehouseInstance
} from './bidking/compatRuntime';
import { bidKingBidMapPlayerCount } from './bidking/bidMapRuntime';
import {
  bidKingBattleItemUseLimitThisRound,
  bidKingBattleItemUsesRemainingThisRound,
  bidKingBattleItemUsesThisRound
} from './bidking/battleItemUseRuntime';
import { bidKingBidLossRebateAmount } from './bidking/economyRuleRuntime';
import { buildBidKingGameDataSnapshot } from './bidking/gameDataRuntime';
import { bidKingInitialCashForBidMap } from './bidking/initialCashRuntime';
import { bidKingDefaultAuctionDurationMs } from './bidking/roomRuleRuntime';
import { bidKingSkillEffectKnowledge, bidKingSkillEffectPublicFields } from './bidking/skillEffectRuntime';
import { bidKingSourceEffectCategoriesForFeedEntry } from './bidking/skillTargeting';
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

const CORE_ROUND_INTEL_DURATION_MS = 3200;
const CORE_WAREHOUSE_ROLL_DURATION_MS = 4400;
const CORE_WAREHOUSE_SELECTED_DURATION_MS = 1500;
const CORE_AUCTIONEER_REVEAL_DURATION_MS = 5000;

export function createMatch(params: {
  id: string;
  players: CreateMatchPlayer[];
  seed?: number;
  totalRounds?: number;
  coreMode?: boolean;
  coreAuctionMode?: CoreAuctionMode;
  coreBidMapId?: number;
  bidKingActiveSystemSkillIds?: number[];
  config?: GameConfig;
  now?: number;
}): MatchRuntimeState {
  const config = params.config ?? defaultConfig;
  if (params.coreMode === false) {
    throw new Error('Only BidKing core mode is supported');
  }
  const matchInitialCash = bidKingInitialCashForBidMap(params.coreBidMapId, config.rules.initialCash);
  const runtimeConfig = matchInitialCash === config.rules.initialCash
    ? config
    : { ...config, rules: { ...config.rules, initialCash: matchInitialCash } };
  const seed = params.seed ?? hashSeed(params.id);
  const now = params.now ?? Date.now();
  const rng = createRandom(seed);
  const expectedPlayerCount = bidKingBidMapPlayerCount(params.coreBidMapId, 4);
  const players = params.players.slice(0, expectedPlayerCount).map<RuntimePlayer>((player, seat) => ({
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
    simGold: player.simGold,
    gameWinItemList: player.gameWinItemList ? [...player.gameWinItemList] : undefined,
    simShopStatus: cloneBidKingShopStatusData(player.simShopStatus),
    simGameLog: cloneBidKingSimGameLogSnapshot(player.simGameLog),
    simSelectItemList: player.simSelectItemList?.map((entry) => ({ ...entry })),
    simBuffItemList: player.simBuffItemList?.map((entry) => ({ ...entry })),
    cash: runtimeConfig.rules.initialCash,
    status: 'playing',
    passed: false,
    hasSubmittedBid: false,
    holdings: [],
    skillCooldown: 0,
    skillUsedThisRound: false,
    battleItemCooldowns: {},
    privateClues: []
  }));

  if (players.length !== expectedPlayerCount) {
    throw new Error(`A match requires exactly ${expectedPlayerCount} players, got ${players.length}`);
  }

  return {
    id: params.id,
    status: 'playing',
    seed,
    coreMode: true,
    coreAuctionMode: params.coreAuctionMode ?? rng.pick<CoreAuctionMode>(['open', 'sealed']),
    coreBidMapId: params.coreBidMapId,
    bidKingActiveSystemSkillIds: params.bidKingActiveSystemSkillIds ? [...params.bidKingActiveSystemSkillIds] : undefined,
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
    player.privateClues = [];
    player.skillCooldown = Math.max(0, player.skillCooldown - 1);
    player.battleItemCooldowns = decrementRoundCooldowns(player.battleItemCooldowns);
  }

  const container = createContainerInstance(state, now);
  const auctionMode = state.coreAuctionMode ?? 'sealed';
  const isOpeningRound = state.roundIndex === 0;
  const openingCandidates = isOpeningRound
    ? buildBidKingOpeningCandidates(state, container.publicInfo, now)
    : undefined;
  const startingPhase: RuntimeRound['phase'] = isOpeningRound ? 'warehouse_roll' : 'intel';
  const startingDurationMs = isOpeningRound ? CORE_WAREHOUSE_ROLL_DURATION_MS : CORE_ROUND_INTEL_DURATION_MS;
  const preAuctionDurationMs = isOpeningRound
    ? CORE_WAREHOUSE_ROLL_DURATION_MS
      + CORE_WAREHOUSE_SELECTED_DURATION_MS
      + CORE_AUCTIONEER_REVEAL_DURATION_MS
      + CORE_ROUND_INTEL_DURATION_MS
    : CORE_ROUND_INTEL_DURATION_MS;
  const round: RuntimeRound = {
    id: `${state.id}_round_${state.roundIndex + 1}`,
    index: state.roundIndex,
    phase: startingPhase,
    auctionMode,
    container,
    openingCandidates,
    bids: [],
    currentBid: 0,
    isFinalAuction: state.roundIndex >= 4 || state.roundIndex === state.totalRounds - 1,
    warehouseSlots: buildHiddenWarehouseSlotViews(container.warehouseSlots),
    revealedItems: [],
    skillFeed: [],
    phaseEndsAt: now + startingDurationMs,
    auctionEndsAt: now + preAuctionDurationMs + auctionDurationForRound(container)
  };

  for (const player of state.players) {
    const privateClues = container.privateCluesByPlayerId[player.id] ?? [];
    player.privateClues = privateClues;
  }
  round.skillFeed = buildBidKingRoundStartSkillFeed(state, round, now);
  prepareAuctioneerIntelCards(state, round);
  if (!isOpeningRound && hasCurrentRoundMapIntel(round)) {
    round.phase = 'auctioneer_reveal';
    round.phaseEndsAt = now + CORE_AUCTIONEER_REVEAL_DURATION_MS;
    round.auctionEndsAt = now
      + CORE_AUCTIONEER_REVEAL_DURATION_MS
      + CORE_ROUND_INTEL_DURATION_MS
      + auctionDurationForRound(container);
  }

  state.currentRound = round;
  state.updatedAt = now;
  pushEvent(state, 'round_started', undefined, {
    roundId: round.id,
    auctionMode,
    publicContainer: publicContainerInfoForClient(container.publicInfo)
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

function auctionDurationForRound(container: ContainerInstance): number {
  return Math.max(1000, container.auctionDurationMs ?? bidKingDefaultAuctionDurationMs());
}

function prepareAuctioneerIntelCards(state: MatchRuntimeState, round: RuntimeRound): void {
  const mapEntry = currentRoundMapIntel(round);
  if (!mapEntry) {
    round.auctioneerClue = undefined;
    round.auctioneerChoices = undefined;
    return;
  }
  const selectedIndex = state.rng.int(0, 3);
  const selectedClue = mapEntryToAuctioneerClue(round, mapEntry, selectedIndex);
  round.auctioneerClue = selectedClue;
  round.auctioneerChoices = Array.from({ length: 4 }, (_, index) => (
    index === selectedIndex ? selectedClue : hiddenAuctioneerClue(round, index)
  ));
}

function hasCurrentRoundMapIntel(round: RuntimeRound): boolean {
  return Boolean(currentRoundMapIntel(round));
}

function currentRoundMapIntel(round: RuntimeRound): SkillFeedEntry | undefined {
  return round.skillFeed.find((entry) => entry.source === 'map' && entry.round === round.index + 1);
}

function mapEntryToAuctioneerClue(round: RuntimeRound, entry: SkillFeedEntry, slotIndex: number): Clue {
  const categories = new Set(entry.effectCategories ?? (entry.effectCategory ? [entry.effectCategory] : []));
  return {
    id: `${round.id}_auctioneer_intel_slot_${slotIndex}`,
    kind: categories.has(5) || categories.has(8) || categories.has(9) || categories.has(10) || categories.has(14)
      ? 'value'
      : 'category',
    text: entry.text,
    accuracy: 1,
    targetItemIds: entry.targetItemIds ? [...entry.targetItemIds] : undefined,
    source: 'public',
    isTruthful: true
  };
}

function hiddenAuctioneerClue(round: RuntimeRound, slotIndex: number): Clue {
  return {
    id: `${round.id}_auctioneer_intel_slot_${slotIndex}`,
    kind: 'category',
    text: '',
    accuracy: 0,
    source: 'public',
    isTruthful: true
  };
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
  if (phase === 'intel') {
    round.auctionEndsAt = round.phaseEndsAt + auctionDurationForRound(round.container);
  }
  if (phase === 'auction') {
    round.auctionEndsAt = round.phaseEndsAt;
  }
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
    players: state.players.map((player) => publicPlayer(player, state.config, state)),
    currentRound: state.currentRound ? publicRound(state, state.currentRound, playerId) : undefined,
    roundHistory: publicRoundHistory(state),
    finalSummary: state.status === 'ended' ? state.finalSummary : undefined,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

function publicRoundHistory(state: MatchRuntimeState): RoundHistoryEntry[] {
  if (state.status === 'ended') {
    return state.roundHistory;
  }
  return state.roundHistory.map((history) => ({
    ...history,
    bidKingGameData: undefined
  }));
}

function cloneBidKingShopStatusData(
  shopStatus: BidKingShopStatusDataSnapshot | undefined
): BidKingShopStatusDataSnapshot | undefined {
  return shopStatus
    ? {
        ...shopStatus,
        shopItemList: shopStatus.shopItemList.map((entry) => ({ ...entry }))
      }
    : undefined;
}

function cloneBidKingSimGameLogSnapshot(
  simGameLog: BidKingSimGameLogSnapshot | undefined
): BidKingSimGameLogSnapshot | undefined {
  return simGameLog
    ? {
        ...simGameLog,
        gameWinItemList: [...simGameLog.gameWinItemList],
        simShopStatus: cloneBidKingShopStatusData(simGameLog.simShopStatus),
        gameData: cloneBidKingGameDataSnapshot(simGameLog.gameData),
        simSelectItemList: simGameLog.simSelectItemList.map((entry) => ({ ...entry })),
        simBuffItemList: simGameLog.simBuffItemList.map((entry) => ({ ...entry }))
      }
    : undefined;
}

function cloneBidKingGameDataSnapshot(
  gameData: BidKingGameDataSnapshot | undefined
): BidKingGameDataSnapshot | undefined {
  return gameData
    ? {
        ...gameData,
        stockContainer: {
          ...gameData.stockContainer,
          stockBoxes: gameData.stockContainer.stockBoxes.map((box) => ({
            ...box,
            position: { ...box.position },
            item: {
              ...box.item,
              boxPositionData: box.item.boxPositionData.map((position) => ({ ...position }))
            }
          }))
        },
        userLog: gameData.userLog.map((user) => ({
          ...user,
          useItemLog: user.useItemLog.map((entry) => ({ ...entry })),
          priceLog: user.priceLog.map((entry) => ({ ...entry })),
          simSelectItemList: user.simSelectItemList.map((entry) => ({ ...entry })),
          simBuffItemList: user.simBuffItemList.map((entry) => ({ ...entry })),
          selectItemList: user.selectItemList.map((entry) => ({ ...entry }))
        })),
        heroSkillLog: cloneBidKingSkillLogs(gameData.heroSkillLog),
        mapSkillLog: cloneBidKingSkillLogs(gameData.mapSkillLog),
        itemSkillLog: cloneBidKingSkillLogs(gameData.itemSkillLog)
      }
    : undefined;
}

function cloneBidKingSkillLogs(
  skillLogs: BidKingGameDataSnapshot['heroSkillLog']
): BidKingGameDataSnapshot['heroSkillLog'] {
  return skillLogs.map((log) => ({
    ...log,
    hitBoxList: log.hitBoxList.map((box) => ({ ...box, itemType: [...box.itemType] })),
    hitItemTypeList: [...log.hitItemTypeList],
    hitItemQuilityList: [...log.hitItemQuilityList]
  }));
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
          battleItemUseLimitThisRound: bidKingBattleItemUseLimitThisRound(state),
          battleItemUsesThisRound: bidKingBattleItemUsesThisRound(state, player.id),
          battleItemUsesRemainingThisRound: bidKingBattleItemUsesRemainingThisRound(state, player.id),
          battleItemCooldowns: Object.keys(player.battleItemCooldowns).length > 0
            ? { ...player.battleItemCooldowns }
            : undefined,
          simGold: player.simGold,
          gameWinItemList: player.gameWinItemList ? [...player.gameWinItemList] : undefined,
          simShopStatus: cloneBidKingShopStatusData(player.simShopStatus),
          simGameLog: cloneBidKingSimGameLogSnapshot(player.simGameLog),
          simSelectItemList: player.simSelectItemList?.map((entry) => ({ ...entry })),
          simBuffItemList: player.simBuffItemList?.map((entry) => ({ ...entry }))
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
    maxPlayers: bidKingBidMapPlayerCount(params.selectedBidMapId, params.players.length),
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
    sourceProtocols: bidKingSourceProtocolsForEvent(state, type),
    createdAt: now
  });
}

function bidKingSourceProtocolsForEvent(
  state: MatchRuntimeState,
  type: string
): BidKingProtocolMessageRef[] | undefined {
  if (!state.coreMode) {
    return undefined;
  }
  switch (type) {
    case 'round_started':
      return [
        state.roundIndex <= 0
          ? protocolRef(33, 'S2C_33_game_start_notify', 'S2C', ['GameData'])
          : protocolRef(37, 'S2C_37_game_next_round_notify', 'S2C', ['GameData'])
      ];
    case 'bid_submitted':
      return [
        protocolRef(34, 'C2S_34_game_bid', 'C2S', ['Token', 'GameUid', 'BidPrice']),
        protocolRef(35, 'S2C_35_game_bid', 'S2C', ['ErrorCode']),
        protocolRef(119, 'S2C_119_game_user_bid_price_notify', 'S2C', ['UserUid', 'GameUid'])
      ];
    case 'auction_passed':
      return [
        protocolRef(42, 'C2S_42_game_stand_down', 'C2S', ['Token', 'GameUid']),
        protocolRef(43, 'S2C_43_game_stand_down', 'S2C', ['ErrorCode'])
      ];
    case 'battle_item_used':
      return [
        protocolRef(38, 'C2S_38_game_use_item', 'C2S', ['Token', 'GameUid', 'ItemCid']),
        protocolRef(39, 'S2C_39_game_use_item', 'S2C', ['ErrorCode', 'ItemSkillLog'])
      ];
    case 'match_ended':
      return [
        protocolRef(45, 'S2C_45_game_over_notify', 'S2C', [
          'WinUserUid',
          'GameData',
          'OldCollectionExp',
          'NewCollectionExp',
          'LossRecovery',
          'UserSkillList'
        ])
      ];
    default:
      return undefined;
  }
}

function protocolRef(
  id: number,
  name: string,
  direction: BidKingProtocolMessageRef['direction'],
  fields: string[]
): BidKingProtocolMessageRef {
  return { id, name, direction, fields };
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
    publicClues: publicCluesForRound(round),
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
  if (!state.coreWarehouse) {
    state.coreWarehouse = createCoreWarehouseInstance(state, now);
  }
  return createProgressiveContainerInstance(state);
}

function createCoreWarehouseInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  return createBidKingCoreWarehouseInstance(state, now);
}

function createProgressiveContainerInstance(state: MatchRuntimeState): ContainerInstance {
  const core = applyBidKingRoundRule(state.coreWarehouse!, state.roundIndex, state);
  return {
    ...core,
    publicClues: [],
    privateCluesByPlayerId: buildEmptyPrivateClues(state),
    auctionModeOverride: state.coreAuctionMode,
    auctionDurationMs: core.auctionDurationMs,
    minimumBid: core.minimumBid
  };
}

function buildEmptyPrivateClues(state: MatchRuntimeState): Record<string, Clue[]> {
  return Object.fromEntries(state.players.map((player) => [player.id, []]));
}

function buildHiddenWarehouseSlotViews(slots: WarehouseSlot[]): WarehouseSlotView[] {
  return slots.map((slot) => ({
    slotId: slot.slotId,
    x: slot.x,
    y: slot.y,
    w: 1,
    h: 1,
    visibleShape: false
  }));
}

function publicPlayer(
  player: RuntimePlayer,
  config: GameConfig,
  state?: MatchRuntimeState
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
    bidRanks: state ? buildPlayerBidRanks(state, player.id) : undefined,
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
  playerId: string
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
    const revealAmount = shouldRevealHistoryBidAmounts(state, history);
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
    const revealAmount = shouldRevealRoundBidAmounts(currentRound);
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
    || state.status === 'ended'
    || Boolean(history.settlement.isFinal);
}

function shouldRevealRoundBidAmounts(round: RuntimeRound): boolean {
  if (round.auctionMode === 'open') {
    return Boolean(round.bidFeedback || ['reveal', 'settlement', 'ended'].includes(round.phase));
  }
  return Boolean(round.settlement?.isFinal && ['reveal', 'settlement', 'ended'].includes(round.phase));
}

function publicRound(
  state: MatchRuntimeState,
  round: RuntimeRound,
  playerId?: string
): PublicMatchState['currentRound'] {
  const exposeBidAmounts = shouldRevealRoundBidAmounts(round);
  const exposeAuctioneerClue = Boolean(round.auctioneerClue && !['warehouse_roll', 'warehouse_selected'].includes(round.phase));
  const cumulativeSkillFeed = cumulativeSkillFeedForRound(state, round);
  const visibleSkillFeed = visibleSkillFeedForRound(round, playerId, cumulativeSkillFeed);
  return {
    id: round.id,
    index: round.index,
    phase: round.phase,
    auctionMode: round.auctionMode,
    isFinalAuction: round.isFinalAuction,
    container: publicContainerInfoForClient(round.container.publicInfo),
    openingCandidates: round.openingCandidates?.map(publicContainerInfoForClient),
    auctioneerClue: exposeAuctioneerClue && round.auctioneerClue ? cloneClue(round.auctioneerClue) : undefined,
    auctioneerChoices: round.phase === 'auctioneer_reveal'
      ? round.auctioneerChoices?.map(cloneClue)
      : undefined,
    publicClues: publicCluesForRound(round),
    warehouseSlots: publicWarehouseSlots(round, playerId, visibleSkillFeed),
    bids: exposeBidAmounts
      ? round.bids.map((bid) => ({ ...bid, visible: true }))
      : round.bids.map((bid) => ({ ...bid, amount: 0, visible: false })),
    currentBid: round.currentBid,
    currentLeaderId: round.currentLeaderId,
    bidFeedback: personalizeBidFeedback(round.bidFeedback, round),
    skillFeed: publicSkillFeedForRound(visibleSkillFeed, playerId),
    revealedItems: round.revealedItems,
    settlement: ['reveal', 'settlement', 'ended'].includes(round.phase) ? round.settlement : undefined,
    phaseEndsAt: round.phaseEndsAt,
    minimumBid: round.container.minimumBid
  };
}

function cumulativeSkillFeedForRound(
  state: MatchRuntimeState,
  round: RuntimeRound
): SkillFeedEntry[] {
  const seenIds = new Set<string>();
  const feeds = [
    ...state.roundHistory
      .filter((history) => history.index < round.index)
      .flatMap((history) => history.skillFeed ?? []),
    ...round.skillFeed
  ];
  return feeds.filter((entry) => {
    if (seenIds.has(entry.id)) {
      return false;
    }
    seenIds.add(entry.id);
    return true;
  });
}

function visibleSkillFeedForRound(
  round: RuntimeRound,
  playerId: string | undefined,
  skillFeed: readonly SkillFeedEntry[]
): SkillFeedEntry[] {
  return skillFeed.filter((entry) => (
    skillFeedEntryVisibleInPhase(round, entry)
    && (entry.visibility === 'public' || entry.playerId === playerId)
  ));
}

function skillFeedEntryVisibleInPhase(round: RuntimeRound, entry: SkillFeedEntry): boolean {
  const isCurrentMapIntel = entry.source === 'map' && entry.round === round.index + 1;
  if (!isCurrentMapIntel) {
    return true;
  }
  return !['warehouse_roll', 'warehouse_selected'].includes(round.phase);
}

function publicContainerInfoForClient(info: PublicContainerInfo): PublicContainerInfo {
  return {
    ...info,
    tags: [...info.tags],
    estimateMin: info.estimateHidden ? 0 : info.estimateMin,
    estimateMax: info.estimateHidden ? 0 : info.estimateMax
  };
}

function personalizeBidFeedback(
  feedback: RuntimeRound['bidFeedback'],
  round: RuntimeRound
): RuntimeRound['bidFeedback'] {
  if (!feedback) {
    return feedback;
  }
  const exposeBidAmounts = shouldRevealRoundBidAmounts(round);
  return {
    ...feedback,
    publicRanking: feedback.publicRanking.map((entry) => {
      const visibleAmount = exposeBidAmounts;
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
      targetItemIds: entry.targetItemIds ? [...entry.targetItemIds] : undefined,
      hitBoxList: entry.hitBoxList?.map((box) => publicSourceHitBox(entry, box))
    }));
}

function publicSourceHitBox(entry: SkillFeedEntry, box: BidKingBoxInfoDataSnapshot): BidKingBoxInfoDataSnapshot {
  const categories = bidKingSourceEffectCategoriesForFeedEntry(entry);
  const fields = bidKingSkillEffectPublicFields(categories);
  return {
    boxId: box.boxId,
    itemUid: box.itemUid,
    itemCid: fields.itemCid ? box.itemCid : 0,
    itemSlotType: fields.itemSlotType ? box.itemSlotType : 0,
    itemType: fields.itemType ? [...box.itemType] : [],
    itemQuility: fields.itemQuility ? box.itemQuility : 0,
    itemPrice: fields.itemPrice ? box.itemPrice : 0,
    itemBoxIndex: fields.itemBoxIndex ? box.itemBoxIndex : 0
  };
}

function publicCluesForRound(round: RuntimeRound): Clue[] {
  const auctioneerClues = round.auctioneerClue && !['warehouse_roll', 'warehouse_selected'].includes(round.phase)
    ? [round.auctioneerClue]
    : [];
  return [...round.container.publicClues, ...auctioneerClues].map(cloneClue);
}

function cloneClue(clue: Clue): Clue {
  return {
    ...clue,
    targetItemIds: clue.targetItemIds ? [...clue.targetItemIds] : undefined,
    valueHint: clue.valueHint ? { ...clue.valueHint } : undefined
  };
}

function publicWarehouseSlots(
  round: RuntimeRound,
  playerId?: string,
  skillFeed: readonly SkillFeedEntry[] = round.skillFeed
) {
  const isFinalReveal = Boolean(round.settlement?.isFinal && ['reveal', 'settlement', 'ended'].includes(round.phase));
  if (!isFinalReveal) {
    return applyKnowledgeToSlotViews(round, playerId, skillFeed);
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

function applyKnowledgeToSlotViews(
  round: RuntimeRound,
  playerId?: string,
  skillFeed: readonly SkillFeedEntry[] = round.skillFeed
) {
  const privateTargets = playerId
    ? clueTargetIds(...(round.container.privateCluesByPlayerId[playerId] ?? []).filter((clue) => clue.source !== 'skill'))
    : new Set<string>();
  const visibleSkillFeed = skillFeed.filter((entry) => (
    skillFeedEntryRevealsWarehouse(entry)
    && (entry.visibility === 'public' || entry.playerId === playerId)
  ));

  return round.warehouseSlots.map((slotView) => {
    const realSlot = round.container.warehouseSlots.find((slot) => slot.slotId === slotView.slotId);
    if (!realSlot) {
      return { ...slotView };
    }
    let nextView = applySourceSkillKnowledgeToSlotView({ ...slotView }, realSlot, visibleSkillFeed);
    const privateMarked = privateTargets.has(realSlot.item.id);
    if (!privateMarked) {
      return nextView;
    }
    nextView = {
      ...nextView,
      itemId: realSlot.item.id,
      x: realSlot.x,
      y: realSlot.y,
      w: realSlot.w,
      h: realSlot.h,
      visibleShape: true,
      visibleRarity: realSlot.item.rarity,
      visibleCategory: realSlot.item.category,
      markedBySkill: true,
      markReason: '名士掌眼'
    };
    return nextView;
  });
}

function skillFeedEntryRevealsWarehouse(entry: SkillFeedEntry): boolean {
  const categories = bidKingSourceEffectCategoriesForFeedEntry(entry);
  const knowledge = bidKingSkillEffectKnowledge(categories);
  if (categories.size === 0 && entry.source === 'manual' && (entry.targetItemIds?.length ?? 0) > 0) {
    return true;
  }
  return knowledge.shape || knowledge.rank || knowledge.all || knowledge.value || knowledge.sizeCount;
}

function applySourceSkillKnowledgeToSlotView(
  slotView: WarehouseSlotView,
  realSlot: WarehouseSlot,
  skillFeed: readonly SkillFeedEntry[]
): WarehouseSlotView {
  let view = slotView;
  for (const entry of skillFeed) {
    const hitBox = sourceHitBoxForSlot(entry, realSlot);
    const targetMatched = entry.targetItemIds?.includes(realSlot.item.id) ?? false;
    if (!hitBox && !targetMatched) {
      continue;
    }
    view = applySourceHitBoxToSlotView(view, realSlot, entry, hitBox);
  }
  return view;
}

function sourceHitBoxForSlot(entry: SkillFeedEntry, realSlot: WarehouseSlot): BidKingBoxInfoDataSnapshot | undefined {
  const boxId = realSlot.y * 10 + realSlot.x;
  return entry.hitBoxList?.find((box) => box.boxId === boxId);
}

function applySourceHitBoxToSlotView(
  slotView: WarehouseSlotView,
  realSlot: WarehouseSlot,
  entry: SkillFeedEntry,
  hitBox: BidKingBoxInfoDataSnapshot | undefined
): WarehouseSlotView {
  const categories = bidKingSourceEffectCategoriesForFeedEntry(entry);
  const knowledge = bidKingSkillEffectKnowledge(categories);
  const view: WarehouseSlotView = {
    ...slotView
  };
  let revealed = false;

  if ((hitBox?.itemSlotType && knowledge.shape) || knowledge.shape) {
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.w = realSlot.w;
    view.h = realSlot.h;
    view.visibleShape = true;
    revealed = true;
  }
  if ((hitBox?.itemBoxIndex && knowledge.sizeCount) || knowledge.sizeCount) {
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.visibleSizeCount = hitBox?.itemBoxIndex || Math.max(1, realSlot.w * realSlot.h);
    revealed = true;
  }
  if ((hitBox?.itemQuility && knowledge.rank) || knowledge.rank) {
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.visibleRarity = realSlot.item.rarity;
    revealed = true;
  }
  if (hitBox?.itemPrice && knowledge.value) {
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.visibleValueRange = {
      min: hitBox.itemPrice,
      max: hitBox.itemPrice
    };
    revealed = true;
  }
  if ((hitBox?.itemCid && knowledge.all) || knowledge.all) {
    view.itemId = realSlot.item.id;
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.w = realSlot.w;
    view.h = realSlot.h;
    view.visibleShape = true;
    view.visibleRarity = realSlot.item.rarity;
    view.visibleCategory = realSlot.item.category;
    view.visibleValueRange = {
      min: realSlot.item.value,
      max: realSlot.item.value
    };
    view.itemName = realSlot.item.name;
    view.iconKey = realSlot.item.iconKey;
    revealed = true;
  }
  if (!revealed && categories.size === 0 && entry.source === 'manual') {
    view.itemId = realSlot.item.id;
    view.x = realSlot.x;
    view.y = realSlot.y;
    view.w = realSlot.w;
    view.h = realSlot.h;
    view.visibleShape = true;
    view.visibleRarity = realSlot.item.rarity;
    view.visibleCategory = realSlot.item.category;
    revealed = true;
  }
  return revealed
    ? {
        ...view,
        markedBySkill: true,
        markReason: entry.source === 'map' ? '拍场技能' : entry.source === 'item' ? '试宝令' : '名士掌眼'
      }
    : slotView;
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
  const lossRecoveryByPlayerId = buildLossRecoveryByPlayerId(state);
  const collectionXpByPlayerId = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      (awardedItemsByPlayerId[player.id] ?? []).reduce((sum, item) => sum + collectionExperienceValue(item), 0)
    ])
  );

  return {
    matchId: state.id,
    seed: state.seed,
    rankings,
    netWorthCurve,
    bestMove,
    biggestMistake,
    revealedItems: [...uniqueItems.values()],
    awardedItemsByPlayerId,
    lossRecoveryByPlayerId,
    auctionStats,
    bidKingReplay: state.coreMode
      ? state.roundHistory
          .map((round) => round.bidKingGameData)
          .filter((entry): entry is BidKingGameDataSnapshot => Boolean(entry))
      : undefined,
    rewards: rankings.map((player) => ({
      playerId: player.playerId,
      xp: collectionXpByPlayerId[player.playerId] ?? 0,
      coins: 0,
      rankPoints: [35, 15, -5, -15][player.rank - 1] ?? 0
    })),
    eventCount: state.events.length + 1,
    transactionCount: state.transactions.length
  };
}

function buildLossRecoveryByPlayerId(state: MatchRuntimeState): Record<string, number> {
  const lossRecoveryByPlayerId: Record<string, number> = Object.fromEntries(
    state.players.map((player) => [player.id, 0])
  );
  for (const player of state.players) {
    if (!hasPositiveBid(state, player.id)) {
      continue;
    }
    const loss = Math.max(0, state.config.rules.initialCash - calculateNetWorth(player, state.config));
    lossRecoveryByPlayerId[player.id] = bidKingBidLossRebateAmount(loss);
  }
  return lossRecoveryByPlayerId;
}

function hasPositiveBid(state: MatchRuntimeState, playerId: string): boolean {
  const rounds = state.currentRound
    ? [...state.roundHistory, state.currentRound]
    : state.roundHistory;
  return rounds.some((round) => round.bids.some((bid) => bid.playerId === playerId && bid.amount > 0));
}

function collectionExperienceValue(item: RevealedItem): number {
  const sourceId = Number(/^compat_(\d+)/.exec(item.id)?.[1]);
  const sourceItem = Number.isFinite(sourceId) ? Item.find((candidate) => candidate.id === sourceId) : undefined;
  const fallbackValue = item.displayValue > 0 ? item.displayValue : item.value;
  return Math.max(0, Math.floor(sourceItem?.base_value ?? fallbackValue));
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
    detail: `${winner?.name ?? '玩家'}在第${round.index + 1}轮“${round.containerName}”净亏${Math.abs(round.profit).toLocaleString()}，复盘时应重点看成交价、真实总值、出价节奏和线索来源。`,
    amount: round.profit
  };
}
