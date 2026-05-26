import type { GameConfig } from '@bitkingdom/config';
import { BattleItem, Drop, Emoji, Hero, RankAi, bidKingBattleItemDisplayName, bidKingRawTableDisplayName } from '@bitkingdom/bidking-compat';
import type { AuctionMode, Clue, Rarity, SkillId, WarehouseSlotView } from '@bitkingdom/shared';
import { getBidKingCloseThreshold } from './bidking/compatRuntime';
import { bidKingBattleItemUsesRemainingThisRound } from './bidking/battleItemUseRuntime';
import { bidKingHeroIdForRoleId } from './bidking/heroRuntime';
import { battleItemCooldownRemaining, battleItemEffectPlanForItem } from './items';
import { createRandom, hashSeed } from './random';
import { calculateNetWorth, sumItemValue } from './scoring';
import type { MatchRuntimeState, RuntimePlayer, RuntimeRound } from './types';

export interface BotActionAudit {
  profileId: string;
  phase?: string;
  auctionMode?: AuctionMode;
  behaviorTree?: string[];
  roleId?: string;
  skillId?: SkillId;
  rankAiRowId?: number;
  rankAiRoleId?: number;
  rankAiRoundCount?: number;
  rankAiMinBidRatio?: number;
  rankAiPkRatio?: number;
  rankAiBidTimeSeconds?: number;
  rankAiTargetRatio?: number;
  rankAiItemUseProbability?: number;
  rankAiItemUsageGroupId?: number;
  battleItemId?: number;
  battleItemName?: string;
  riskAppetite: number;
  bluffChance: number;
  overpayTolerance: number;
  bidAggression: number;
  publicEstimate?: number;
  publicEstimateHidden?: boolean;
  publicEstimateSource?: BotEstimateSource;
  protocolInferredEstimate?: boolean;
  clueEstimate?: number;
  slotEstimate?: number;
  estimate?: number;
  confidence?: number;
  riskPenalty?: number;
  valueRangeWidth?: number;
  maxBid?: number;
  targetBid?: number;
  bidFloor?: number;
  minimumBid?: number;
  availableCash?: number;
  nextOpenBid?: number;
  previousOwnBid?: number;
  previousRank?: number;
  closeThreshold?: number;
  desiredCloseBid?: number;
  trueValue?: number;
  targetBidRatio?: number;
  maxBidRatio?: number;
  bidFloorRatio?: number;
  actionBidRatio?: number;
  projectedProfitAtTarget?: number;
  projectedProfitAtAction?: number;
  targetPlayerId?: string;
  skillIntent?: string;
  decisionStyle?: string;
}

export type BotEstimateSource = 'public_estimate_range' | 'protocol_inferred_hidden_range';

export interface BotAction {
  type: 'bid' | 'pass' | 'battle_item' | 'emote';
  amount?: number;
  itemId?: number;
  itemUsageGroupId?: number;
  targetPlayerId?: string;
  emote?: string;
  reason: string;
  audit?: BotActionAudit;
}

interface BotContext {
  state: MatchRuntimeState;
  player: RuntimePlayer;
  round: RuntimeRound;
  profile: GameConfig['botProfiles'][number];
  role?: GameConfig['roles'][number];
  tuning: BotTuning;
  assessment: BotAuctionAssessment;
  skillIntent: SkillIntent;
  targetOpponent?: RuntimePlayer;
}

type BehaviorStatus = 'success' | 'failure';

interface BehaviorTick {
  status: BehaviorStatus;
  trace: string[];
  action?: BotAction;
}

interface BehaviorNode {
  name: string;
  tick(context: BotContext): BehaviorTick;
}

interface BotTuning {
  riskAppetite: number;
  bluffChance: number;
  overpayTolerance: number;
  bidAggression: number;
  minBidRatio: number;
  pkRatio: number;
  bidTimeSeconds: number;
  itemUseProbability: number;
  itemUsageGroup: readonly (readonly number[])[];
  rankAiRowId?: number;
  rankAiRoleId?: number;
  rankAiRoundCount?: number;
}

interface PreviousRoundSignal {
  ownBid?: number;
  rank?: number;
  leaderPlayerId?: string;
  decision?: string;
}

interface SlotEstimate {
  estimate?: number;
  coverage: number;
}

interface BotAuctionAssessment {
  publicEstimate: number;
  publicEstimateHidden: boolean;
  publicEstimateSource: BotEstimateSource;
  protocolInferredEstimate: boolean;
  clueEstimate?: number;
  slotEstimate?: number;
  estimate: number;
  confidence: number;
  riskPenalty: number;
  valueRangeWidth: number;
  maxBid: number;
  targetBid: number;
  bidFloor: number;
  availableCash: number;
  nextOpenBid: number;
  previous?: PreviousRoundSignal;
  closeThreshold: number;
  desiredCloseBid?: number;
  decisionStyle: string;
}

interface SkillIntent {
  score: number;
  reason: string;
  targetPlayerId?: string;
}

export function chooseBotAction(
  state: MatchRuntimeState,
  playerId: string,
  profileId?: string
): BotAction {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const round = state.currentRound;
  if (!player || !round) {
    return { type: 'pass', reason: 'No active player or round' };
  }

  const profile = state.config.botProfiles.find((candidate) => candidate.id === profileId) ?? state.config.botProfiles[0]!;
  const tuning = botTuningForPlayer(state, player, profile);
  const context = buildBotContext(state, player, round, profile, tuning);
  const result = BOT_ROOT.tick(context);
  if (!result.action) {
    throw new Error(`RankAi bot ${player.id} produced no action in ${round.phase}`);
  }
  const action = result.action;

  return {
    ...action,
    audit: buildBotActionAudit(context, result.trace, action)
  };
}

const BOT_ROOT = selector('BidKingBotRoot', [
  sequence('IntelBattleItemSequence', [
    condition('IsIntelPhaseForItem', (context) => context.round.phase === 'intel'),
    condition('CanUseRankAiBattleItem', canUseBattleItem),
    condition('RankAiItemHasIntelValue', (context) => shouldUseBattleItem(context, 'intel')),
    action('UseRankAiBattleItemForIntel', (context) => battleItemAction(context, 'Bot uses RankAi item group before bidding'))
  ]),
  sequence('AuctionBattleItemSequence', [
    condition('IsAuctionPhase', (context) => context.round.phase === 'auction'),
    condition('CanUseRankAiBattleItemInAuction', canUseBattleItem),
    condition('RankAiItemCanStillChangeBid', (context) => shouldUseBattleItem(context, 'auction')),
    action('UseRankAiBattleItemBeforeBid', (context) => battleItemAction(context, 'Bot uses RankAi item group before committing a bid'))
  ]),
  sequence('AuctionBidSequence', [
    condition('IsAuctionPhaseForBid', (context) => context.round.phase === 'auction'),
    action('ChooseAuctionBid', chooseAuctionAction)
  ]),
  action('IdlePersonaAction', (context) => idleEmoteAction(context, 'Bot waits outside actionable phases'))
]);

function selector(name: string, children: BehaviorNode[]): BehaviorNode {
  return {
    name,
    tick(context) {
      for (const child of children) {
        const result = child.tick(context);
        if (result.status === 'success') {
          return { ...result, trace: [name, ...result.trace] };
        }
      }
      return { status: 'failure', trace: [name] };
    }
  };
}

function sequence(name: string, children: BehaviorNode[]): BehaviorNode {
  return {
    name,
    tick(context) {
      const trace = [name];
      let actionResult: BotAction | undefined;
      for (const child of children) {
        const result = child.tick(context);
        if (result.status === 'failure') {
          return { status: 'failure', trace: [...trace, ...result.trace] };
        }
        trace.push(...result.trace);
        actionResult = result.action ?? actionResult;
      }
      return { status: 'success', trace, action: actionResult };
    }
  };
}

function condition(name: string, predicate: (context: BotContext) => boolean): BehaviorNode {
  return {
    name,
    tick(context) {
      return predicate(context)
        ? { status: 'success', trace: [name] }
        : { status: 'failure', trace: [name] };
    }
  };
}

function action(name: string, run: (context: BotContext) => BotAction): BehaviorNode {
  return {
    name,
    tick(context) {
      return { status: 'success', trace: [name], action: run(context) };
    }
  };
}

function buildBotContext(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  round: RuntimeRound,
  profile: GameConfig['botProfiles'][number],
  tuning: BotTuning
): BotContext {
  const role = state.config.roles.find((candidate) => candidate.id === player.roleId);
  const targetOpponent = pickRelevantOpponent(state, player);
  const assessment = assessAuction(state, player, round, tuning);
  const skillIntent = buildSkillIntent(state, player, round, assessment, tuning, role, targetOpponent);
  return {
    state,
    player,
    round,
    profile,
    role,
    tuning,
    assessment,
    skillIntent,
    targetOpponent
  };
}

function assessAuction(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  round: RuntimeRound,
  tuning: BotTuning
): BotAuctionAssessment {
  const publicInfo = round.container.publicInfo;
  const publicEstimate = Math.max(1, (publicInfo.estimateMin + publicInfo.estimateMax) / 2);
  const publicEstimateHidden = Boolean(publicInfo.estimateHidden);
  const publicEstimateSource: BotEstimateSource = publicEstimateHidden
    ? 'protocol_inferred_hidden_range'
    : 'public_estimate_range';
  const valueRangeWidth = (publicInfo.estimateMax - publicInfo.estimateMin) / publicEstimate;
  const visibleClues = visibleCluesForBot(round, player);
  const clueEstimate = estimateFromValueClues(visibleClues);
  const slotEstimate = estimateFromVisibleSlots(round.warehouseSlots, publicEstimate);
  const previous = previousRoundSignalForPlayer(state, player.id);
  const riskPenalty = riskPenaltyFromVisibleInfo(round, visibleClues);
  const confidence = estimateConfidence({
    valueClueCount: visibleClues.filter((clue) => clue.valueHint).length,
    privateSkillClueCount: player.privateClues.filter((clue) => clue.source === 'skill').length,
    slotCoverage: slotEstimate.coverage,
    valueRangeWidth,
    risk: publicInfo.risk
  });
  const estimate = finalVisibleEstimate({
    publicEstimate,
    clueEstimate,
    slotEstimate: slotEstimate.estimate,
    confidence,
    riskPenalty,
    riskAppetite: tuning.riskAppetite
  });
  const availableCash = availableCashForBid(state, player, round);
  const bidFloor = bidFloorForRound(state, player, round);
  const nextOpenBid = bidFloor;
  const maxBid = maxBidForAssessment(estimate, confidence, riskPenalty, availableCash, tuning, round, state.coreMode, state.config.rules.minIncrement);
  const closeThreshold = state.coreMode ? getBidKingCloseThreshold(round.index) : 0;
  const desiredCloseBid = desiredOpenCloseBid(state, round, closeThreshold);
  const targetBid = targetBidForAssessment({
    state,
    round,
    estimate,
    confidence,
    riskPenalty,
    maxBid,
    bidFloor,
    previous,
    tuning
  });

  return {
    publicEstimate: Math.round(publicEstimate),
    publicEstimateHidden,
    publicEstimateSource,
    protocolInferredEstimate: publicEstimateHidden,
    clueEstimate,
    slotEstimate: slotEstimate.estimate,
    estimate,
    confidence,
    riskPenalty,
    valueRangeWidth,
    maxBid,
    targetBid,
    bidFloor,
    availableCash,
    nextOpenBid,
    previous,
    closeThreshold,
    desiredCloseBid,
    decisionStyle: decisionStyleFor(tuning, confidence, riskPenalty, previous)
  };
}

function visibleCluesForBot(round: RuntimeRound, player: RuntimePlayer): Clue[] {
  const clues = [...round.container.publicClues];
  clues.push(...player.privateClues);
  return clues;
}

function estimateFromValueClues(clues: readonly Clue[]): number | undefined {
  const weighted = clues
    .filter((clue) => clue.valueHint)
    .map((clue) => {
      const midpoint = (clue.valueHint!.min + clue.valueHint!.max) / 2;
      const sourceWeight = clue.source === 'skill'
        ? 1.25
        : clue.source === 'private'
          ? 1.1
          : 0.85;
      const kindWeight = 1;
      return {
        value: midpoint,
        weight: Math.max(0.1, clue.accuracy * sourceWeight * kindWeight)
      };
    });
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum <= 0) {
    return undefined;
  }
  return Math.round(weighted.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weightSum);
}

function estimateFromVisibleSlots(slots: readonly WarehouseSlotView[], publicEstimate: number): SlotEstimate {
  if (slots.length === 0) {
    return { coverage: 0 };
  }
  const averagePublicItemValue = publicEstimate / Math.max(1, slots.length);
  let estimatedTotal = 0;
  let coverageWeight = 0;
  for (const slot of slots) {
    let observedValue = averagePublicItemValue;
    let observedWeight = 0;
    if (slot.visibleValueRange) {
      observedValue = (slot.visibleValueRange.min + slot.visibleValueRange.max) / 2;
      observedWeight = 1;
    } else if (slot.visibleRarity) {
      observedValue = averagePublicItemValue * rarityValueMultiplier(slot.visibleRarity);
      observedWeight = 0.42;
    } else if (slot.visibleShape || slot.visibleSizeCount) {
      const area = Math.max(1, slot.visibleSizeCount ?? slot.w * slot.h);
      observedValue = averagePublicItemValue * clamp(area / 2.2, 0.55, 1.45);
      observedWeight = 0.18;
    }
    estimatedTotal += averagePublicItemValue * (1 - observedWeight) + observedValue * observedWeight;
    coverageWeight += observedWeight;
  }
  if (coverageWeight <= 0) {
    return { coverage: 0 };
  }
  const coverage = clamp(coverageWeight / slots.length, 0, 1);
  const lowerBound = publicEstimate * (1 - coverage * 0.45);
  const upperBound = publicEstimate * (1 + coverage * 0.75);
  const estimate = Math.round(clamp(estimatedTotal, lowerBound, upperBound));
  return { estimate, coverage };
}

function rarityValueMultiplier(rarity: Rarity): number {
  const multipliers: Record<Rarity, number> = {
    junk: 0.22,
    common: 0.48,
    fine: 0.82,
    rare: 1.32,
    legendary: 2.15,
    mythic: 3.4
  };
  return multipliers[rarity];
}

function riskPenaltyFromVisibleInfo(
  round: RuntimeRound,
  clues: readonly Clue[]
): number {
  const riskBase = round.container.publicInfo.risk === 'high'
    ? 0.18
    : round.container.publicInfo.risk === 'medium'
      ? 0.1
      : 0.04;
  const hasSafeHint = clues.some((clue) => clue.riskHint === 'safe');
  return clamp(
    riskBase - (hasSafeHint ? 0.04 : 0),
    0,
    0.38
  );
}

function estimateConfidence(params: {
  valueClueCount: number;
  privateSkillClueCount: number;
  slotCoverage: number;
  valueRangeWidth: number;
  risk: RuntimeRound['container']['publicInfo']['risk'];
}): number {
  const riskDrag = params.risk === 'high' ? 0.08 : params.risk === 'medium' ? 0.03 : 0;
  return clamp(
    0.24 +
      Math.min(0.26, params.valueClueCount * 0.085) +
      Math.min(0.16, params.privateSkillClueCount * 0.055) +
      params.slotCoverage * 0.24 -
      Math.min(0.16, params.valueRangeWidth * 0.08) -
      riskDrag,
    0.12,
    0.92
  );
}

function finalVisibleEstimate(params: {
  publicEstimate: number;
  clueEstimate?: number;
  slotEstimate?: number;
  confidence: number;
  riskPenalty: number;
  riskAppetite: number;
}): number {
  const clueWeight = params.clueEstimate ? 0.28 + params.confidence * 0.25 : 0;
  const slotWeight = params.slotEstimate ? 0.16 + params.confidence * 0.12 : 0;
  const publicWeight = Math.max(0.2, 1 - clueWeight - slotWeight);
  const weighted =
    params.publicEstimate * publicWeight +
    (params.clueEstimate ?? params.publicEstimate) * clueWeight +
    (params.slotEstimate ?? params.publicEstimate) * slotWeight;
  const appetiteBoost = 0.94 + params.riskAppetite * 0.16;
  return Math.max(0, Math.round(weighted * appetiteBoost * (1 - params.riskPenalty * 0.45)));
}

function maxBidForAssessment(
  estimate: number,
  confidence: number,
  riskPenalty: number,
  availableCash: number,
  tuning: BotTuning,
  round: RuntimeRound,
  coreMode: boolean,
  minIncrement: number
): number {
  const corePressure = coreMode
    ? 0.1 + Math.min(round.index, 4) * 0.055 + tuning.bidAggression * 0.06
    : 0;
  const finalPressure = round.index >= 4 ? 0.06 + tuning.riskAppetite * 0.05 : 0;
  const confidenceFactor = 0.82 + confidence * 0.24;
  const styleBase = coreMode ? 0.92 : 0.72;
  const styleFactor = styleBase + tuning.bidAggression * 0.2 + tuning.overpayTolerance * 0.24 + corePressure + finalPressure;
  const riskScale = coreMode
    ? (confidence < 0.48 ? 0.32 : 0.18) + (1 - tuning.riskAppetite) * 0.1
    : confidence < 0.48 ? 0.9 : 0.55;
  const riskFactor = 1 - riskPenalty * riskScale;
  const behaviorTreeLimit = estimate * confidenceFactor * styleFactor * riskFactor;
  const raw = coreMode
    ? Math.max(behaviorTreeLimit, coreRankAiBidLimit(estimate, confidence, riskPenalty, tuning, round))
    : behaviorTreeLimit;
  return floorToIncrement(Math.min(availableCash, raw), minIncrement);
}

function targetBidForAssessment(params: {
  state: MatchRuntimeState;
  round: RuntimeRound;
  estimate: number;
  confidence: number;
  riskPenalty: number;
  maxBid: number;
  bidFloor: number;
  previous?: PreviousRoundSignal;
  tuning: BotTuning;
}): number {
  const { state, round, estimate, confidence, riskPenalty, maxBid, bidFloor, previous, tuning } = params;
  const roundCommitment = commitmentForRound(state, round);
  const rankAdjustment = previousRankAdjustment(previous, confidence);
  const confidenceAdjustment = (confidence - 0.5) * 0.2;
  const aggressionAdjustment = (tuning.bidAggression - 0.5) * 0.16;
  const pkAdjustment = (rankAiPkRatio(tuning, state.coreMode) - 1) * 0.08;
  const riskAdjustment = -riskPenalty * (state.coreMode ? 0.16 : 0.35);
  const commitment = clamp(
    roundCommitment + rankAdjustment + confidenceAdjustment + aggressionAdjustment + pkAdjustment + riskAdjustment,
    state.coreMode ? 0.44 : 0.32,
    round.index >= 4 ? 1.2 : state.coreMode ? 1.1 : 1.02
  );
  const tableRatio = rankAiMinBidRatio(tuning, state.coreMode);
  const tableAnchor = estimate * tableRatio;
  const tableTarget = state.coreMode
    ? estimate * coreRankAiRoundTargetRatio(round, tuning, confidence, riskPenalty, previous)
    : tableAnchor;
  const rawTarget = state.coreMode
    ? Math.max(estimate * commitment, tableTarget)
    : estimate * commitment * 0.78 + tableAnchor * 0.22;
  const competitiveFloor = state.coreMode
    ? estimate * coreCompetitiveBidFloorRatio(round, tuning, confidence, riskPenalty)
    : 0;
  const minimum = coreExtraRoundMinimum(state, round, previous?.ownBid, bidFloor);
  const target = Math.min(maxBid, Math.max(rawTarget, competitiveFloor));
  if (target >= minimum) {
    return roundToIncrement(target, state.config.rules.minIncrement);
  }
  return shouldBidAtFloor(estimate, minimum, confidence, riskPenalty, round, tuning, state.coreMode) && maxBid >= minimum
    ? minimum
    : 0;
}

function commitmentForRound(state: MatchRuntimeState, round: RuntimeRound): number {
  if (!state.coreMode) {
    return 0.94;
  }
  const coreCommitment = [0.66, 0.8, 0.92, 1.04, 1.12];
  if (round.index >= 5) {
    return 1.14;
  }
  return coreCommitment[Math.max(0, Math.min(round.index, coreCommitment.length - 1))] ?? 0.9;
}

function coreCompetitiveBidFloorRatio(
  round: RuntimeRound,
  tuning: BotTuning,
  confidence: number,
  riskPenalty: number
): number {
  const baseByRound = [0.56, 0.7, 0.82, 0.92, 1];
  const base = baseByRound[Math.max(0, Math.min(round.index, baseByRound.length - 1))] ?? 1;
  const confidenceAdjustment = clamp((confidence - 0.5) * 0.18, -0.05, 0.08);
  const aggressionAdjustment = clamp(
    (tuning.bidAggression - 0.5) * 0.12 + (rankAiPkRatio(tuning, true) - 1) * 0.05,
    -0.04,
    0.08
  );
  const riskAdjustment = riskPenalty * 0.1;
  const roundCeiling = round.index >= 4 ? 1.08 : 1;
  return clamp(base + confidenceAdjustment + aggressionAdjustment - riskAdjustment, 0.48, roundCeiling);
}

function coreRankAiRoundTargetRatio(
  round: RuntimeRound,
  tuning: BotTuning,
  confidence: number,
  riskPenalty: number,
  previous?: PreviousRoundSignal
): number {
  const minRatio = rankAiMinBidRatio(tuning, true);
  const pkRatio = rankAiPkRatio(tuning, true);
  const low = Math.min(minRatio, pkRatio);
  const high = Math.max(minRatio, pkRatio);
  const progress = clamp(round.index / 4, 0, 1);
  const historyPressure = previous?.rank === 2
    ? 0.22
    : previous?.rank === 1 && previous.decision === 'continue'
      ? 0.12
      : (previous?.rank ?? 0) >= 3
        ? confidence > 0.62 ? 0.04 : -0.12
        : 0;
  const confidencePressure = clamp((confidence - 0.45) * 0.4, -0.08, 0.16);
  const pressure = clamp(
    0.36 + progress * 0.34 + historyPressure + confidencePressure - riskPenalty * 0.18,
    0.15,
    round.index >= 4 ? 0.96 : 0.82
  );
  return clamp(low + (high - low) * pressure, 0.3, round.index >= 4 ? 2 : 1.75);
}

function previousRankAdjustment(previous: PreviousRoundSignal | undefined, confidence: number): number {
  if (!previous?.rank) {
    return 0;
  }
  if (previous.rank === 1) {
    return previous.decision === 'continue' ? 0.06 : -0.02;
  }
  if (previous.rank === 2) {
    return 0.13;
  }
  if (previous.rank === 3) {
    return confidence > 0.62 ? 0.03 : -0.07;
  }
  return confidence > 0.7 ? -0.02 : -0.12;
}

function shouldBidAtFloor(
  estimate: number,
  floor: number,
  confidence: number,
  riskPenalty: number,
  round: RuntimeRound,
  tuning?: BotTuning,
  coreMode = false
): boolean {
  if (floor <= 0) {
    return estimate > 0;
  }
  if (coreMode && tuning && floor <= coreRankAiBidLimit(estimate, confidence, riskPenalty, tuning, round)) {
    return true;
  }
  const edgeRatio = 0.025 + riskPenalty * 0.18 + (1 - confidence) * 0.05;
  return estimate >= floor * (1 + edgeRatio);
}

function buildSkillIntent(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  round: RuntimeRound,
  assessment: BotAuctionAssessment,
  tuning: BotTuning,
  role?: GameConfig['roles'][number],
  targetOpponent?: RuntimePlayer
): SkillIntent {
  const skillId = role?.skillId;
  const uncertainty = 1 - assessment.confidence;
  const valueStakes = clamp(assessment.publicEstimate / Math.max(1, state.config.rules.initialCash), 0, 1.4);
  const finalPressure = round.index >= 4 ? 0.16 : round.index >= 2 ? 0.08 : 0;
  const tableProbability = clamp(tuning.itemUseProbability / 1000, 0, 1) * 0.12;
  let score = uncertainty * 0.42 + valueStakes * 0.12 + finalPressure + tableProbability;
  let reason = 'generic uncertainty';

  if (skillId === 'appraise_value') {
    score += assessment.valueRangeWidth > 0.7 ? 0.2 : 0.08;
    reason = 'value range is wide';
  } else if (skillId === 'single_treasure') {
    const lacksSlotValue = assessment.slotEstimate === undefined || assessment.confidence < 0.55;
    score += lacksSlotValue ? 0.18 : 0.05;
    reason = 'high value slot is not identified';
  } else if (skillId === 'read_intent') {
    const hasOpponentPressure = Boolean(targetOpponent) && (assessment.previous?.rank === 2 || round.index >= 4);
    score += hasOpponentPressure ? 0.22 : 0.04;
    reason = 'opponent pressure matters';
  }

  if (player.skillUsesRemaining <= 1 && round.index <= 1) {
    score -= 0.14;
  }
  if (player.privateClues.some((clue) => clue.source === 'skill')) {
    score -= 0.1;
  }

  return {
    score: clamp(score, 0, 1),
    reason,
    targetPlayerId: skillId === 'read_intent' ? targetOpponent?.id : undefined
  };
}

function canUseBattleItem(context: BotContext): boolean {
  const { player, round, state } = context;
  if (!state.coreMode || !['intel', 'auction'].includes(round.phase)) {
    return false;
  }
  if (bidKingBattleItemUsesRemainingThisRound(state, player.id) <= 0) {
    return false;
  }
  if (round.phase === 'auction' && (player.hasSubmittedBid || round.bids.some((bid) => bid.playerId === player.id))) {
    return false;
  }
  const choice = rankAiBattleItemChoice(context);
  if (!choice || battleItemCooldownRemaining(state, player.id, choice.item.id) > 0) {
    return false;
  }
  const plan = battleItemEffectPlanForItem(choice.item);
  return !plan.targetPlayerRequired || Boolean(context.targetOpponent);
}

function shouldUseBattleItem(context: BotContext, timing: 'intel' | 'auction'): boolean {
  const probability = clamp(context.tuning.itemUseProbability / 1000, 0, 1);
  if (probability <= 0 || !rankAiBattleItemChoice(context)) {
    return false;
  }
  const pressure = timing === 'intel'
    ? context.assessment.confidence < 0.72 || context.round.index >= 2
    : context.assessment.confidence < 0.64 || context.assessment.targetBid > context.assessment.availableCash * 0.35;
  if (!pressure && context.skillIntent.score < 0.36) {
    return false;
  }
  return rankAiBattleItemRoll(context, timing) < probability;
}

function battleItemAction(context: BotContext, reason: string): BotAction {
  const choice = rankAiBattleItemChoice(context);
  if (!choice) {
    return idleEmoteAction(context, 'RankAi item group had no usable battle item');
  }
  const plan = battleItemEffectPlanForItem(choice.item);
  return {
    type: 'battle_item',
    itemId: choice.item.id,
    itemUsageGroupId: choice.dropGroupId,
    targetPlayerId: plan.targetPlayerRequired ? context.targetOpponent?.id : undefined,
    reason: `${reason}: ${bidKingBattleItemDisplayName(choice.item)} from Drop ${choice.dropGroupId}`
  };
}

function rankAiBattleItemChoice(context: BotContext): { item: (typeof BattleItem)[number]; dropGroupId: number } | undefined {
  const groups = context.tuning.itemUsageGroup
    .map((row) => ({ usageKey: row[0] ?? 0, dropGroupId: row[1] ?? 0 }))
    .filter((row) => row.dropGroupId > 0);
  if (groups.length === 0) {
    return undefined;
  }
  const rng = rankAiBattleItemRng(context, 'choice');
  const group = rng.pick(groups);
  const drop = Drop.find((candidate) => candidate.group_id === group.dropGroupId);
  const candidates = drop?.items_list
    .map((entry) => ({
      item: BattleItem.find((candidate) => candidate.id === entry.item_id),
      weight: Math.max(0, entry.drop_weight)
    }))
    .filter((entry): entry is { item: (typeof BattleItem)[number]; weight: number } => Boolean(entry.item) && entry.weight > 0);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }
  return {
    item: rng.weighted(candidates),
    dropGroupId: group.dropGroupId
  };
}

function rankAiBattleItemRoll(context: BotContext, timing: 'intel' | 'auction'): number {
  return rankAiBattleItemRng(context, timing).next();
}

function rankAiBattleItemRng(context: BotContext, salt: string) {
  if (context.tuning.rankAiRowId === undefined) {
    throw new Error(`Bot ${context.player.id} has no RankAi row for item RNG`);
  }
  const seed = [
    context.state.id,
    context.round.id,
    context.player.id,
    context.tuning.rankAiRowId,
    salt
  ].join(':');
  return createRandom(hashSeed(seed));
}

function chooseAuctionAction(context: BotContext): BotAction {
  const { round, player, assessment } = context;

  if (round.auctionMode === 'open') {
    return chooseOpenAuctionAction(context);
  }

  if (player.hasSubmittedBid) {
    return idleEmoteAction(context, 'Bot already submitted sealed bid');
  }

  const amount = sealedBidAmount(context);
  if (amount <= 0 || amount > assessment.availableCash) {
    return {
      type: 'pass',
      reason: `Bot stops: target ${assessment.targetBid} is below floor ${assessment.bidFloor} or available cash`
    };
  }

  return {
    type: 'bid',
    amount,
    reason: `Bot sealed bid from behavior estimate ${assessment.estimate} with confidence ${assessment.confidence.toFixed(2)}`
  };
}

function chooseOpenAuctionAction(context: BotContext): BotAction {
  const { round, player, assessment } = context;
  if (player.hasSubmittedBid || round.bids.some((bid) => bid.playerId === player.id)) {
    return idleEmoteAction(context, 'Bot already submitted open-auction bid');
  }
  if (player.passed) {
    return idleEmoteAction(context, 'Bot already passed this open auction');
  }

  const amount = openBidAmount(context);
  if (amount <= 0) {
    return {
      type: 'pass',
      reason: `Bot passes open auction: next ${assessment.nextOpenBid} exceeds target ${assessment.targetBid}`
    };
  }

  return {
    type: 'bid',
    amount,
    reason: `Bot open bid follows behavior tree target ${assessment.targetBid}`
  };
}

function openBidAmount(context: BotContext): number {
  return sealedBidAmount(context);
}

function sealedBidAmount(context: BotContext): number {
  const { state, round, assessment, tuning } = context;
  let amount = assessment.targetBid;
  const previous = assessment.previous;
  if (state.coreMode && previous?.ownBid && previous.ownBid > 0) {
    if (previous.rank === 1 && previous.decision === 'continue') {
      amount = Math.max(amount, previous.ownBid * (1.03 + tuning.bidAggression * 0.04));
    } else if (previous.rank === 2) {
      amount = Math.max(amount, previous.ownBid * (1.1 + tuning.bidAggression * 0.08));
    } else if ((previous.rank ?? 0) >= 3 && assessment.confidence < 0.58) {
      amount = Math.min(amount, previous.ownBid * (0.95 + tuning.riskAppetite * 0.06));
    }
  }

  const minimum = coreExtraRoundMinimum(state, round, previous?.ownBid, assessment.bidFloor);
  amount = Math.min(assessment.maxBid, Math.max(amount, minimum));
  amount = roundToIncrement(amount, state.config.rules.minIncrement);
  if (amount < minimum || amount > assessment.availableCash) {
    return 0;
  }
  if (!shouldBidAtFloor(assessment.estimate, amount, assessment.confidence, assessment.riskPenalty, round, tuning, state.coreMode)) {
    return 0;
  }
  return amount;
}

function idleEmoteAction(context: BotContext, reason: string): BotAction {
  const index = context.tuning.bluffChance > context.state.rng.next()
    ? 0
    : context.assessment.confidence > 0.62
      ? 2
      : 1;
  return {
    type: 'emote',
    emote: botEmojiName(index),
    reason
  };
}

function botEmojiName(index: number): string {
  const emoji = Emoji[Math.max(0, index) % Math.max(1, Emoji.length)];
  return emoji ? bidKingRawTableDisplayName(emoji) : 'polite nod';
}

function botTuningForPlayer(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  profile: GameConfig['botProfiles'][number]
): BotTuning {
  if (!state.coreMode) {
    throw new Error('RankAi tuning requires BidKing core mode');
  }
  const row = rankAiRowForPlayer(state, player);
  const minBidRatio = weightedRangeValue(row.min_bid_ratio, state, `${player.id}:${row.id}:min_bid_ratio`);
  const pkRatio = weightedRangeValue(row.bid_pk, state, `${player.id}:${row.id}:bid_pk`);
  const bidTimeSeconds = weightedRangeValue(row.bid_time, state, `${player.id}:${row.id}:bid_time`);
  const minIntensity = rankAiRatioIntensity(minBidRatio);
  const pkIntensity = rankAiRatioIntensity(pkRatio);
  const sourceRisk = clamp(0.18 + minIntensity * 0.24 + pkIntensity * 0.52, 0.16, 0.96);
  const sourceAggression = clamp(
    0.26 + minIntensity * 0.22 + pkIntensity * 0.5 + (row.round_count >= 4 ? 0.06 : 0),
    0.2,
    0.98
  );
  const sourceOverpay = clamp(Math.max(0, pkRatio - 1000) / 1000, 0.02, 0.9);
  return {
    rankAiRowId: row.id,
    rankAiRoleId: row.role_id,
    rankAiRoundCount: row.round_count,
    riskAppetite: clamp(sourceRisk * 0.82 + profile.riskAppetite * 0.18, 0.1, 0.98),
    bluffChance: clamp(row.bluff_chance * 0.82 + profile.bluffChance * 0.18, 0, 0.7),
    overpayTolerance: clamp(sourceOverpay * 0.82 + profile.overpayTolerance * 0.18, 0.02, 0.9),
    bidAggression: clamp(sourceAggression * 0.82 + profile.riskAppetite * 0.18, 0.18, 0.98),
    minBidRatio,
    pkRatio,
    bidTimeSeconds,
    itemUseProbability: row.item_use_probability,
    itemUsageGroup: row.item_usage_group
  };
}

function rankAiRowForPlayer(state: MatchRuntimeState, player: RuntimePlayer) {
  const mappedHeroId = player.heroCid ?? bidKingHeroIdForRoleId(player.roleId, state.config.roles);
  const hero = Hero.find((candidate) => candidate.id === mappedHeroId);
  if (!hero) {
    throw new Error(`Bot ${player.id} role ${player.roleId} is not mapped to a BidKing Hero`);
  }
  const roundCount = Math.max(1, state.roundIndex + 1);
  const row = RankAi.find((candidate) => candidate.role_id === hero.id && candidate.round_count === roundCount);
  if (!row) {
    throw new Error(`Missing RankAi row for Hero ${hero.id} round ${roundCount}`);
  }
  return row;
}

function rankAiRatioIntensity(ratio: number): number {
  return clamp((ratio - 100) / 1900, 0, 1);
}

function rankAiMinBidRatio(tuning: BotTuning, coreMode: boolean): number {
  return clamp(tuning.minBidRatio / 1000, coreMode ? 0.3 : 0.35, coreMode ? 2 : 1.35);
}

function rankAiPkRatio(tuning: BotTuning, coreMode: boolean): number {
  return clamp(tuning.pkRatio / 1000, coreMode ? 0.3 : 0.4, coreMode ? 2 : 1.8);
}

function coreRankAiBidLimit(
  estimate: number,
  confidence: number,
  riskPenalty: number,
  tuning: BotTuning,
  round: RuntimeRound
): number {
  const sourceRatio = Math.max(rankAiMinBidRatio(tuning, true) * 1.04, rankAiPkRatio(tuning, true));
  const confidenceScale = 0.94 + confidence * 0.18;
  const roundPressure = 0.98 + Math.min(round.index, 4) * 0.015 + (round.index >= 4 ? 0.04 : 0);
  const riskScale = 1 - riskPenalty * (0.14 + (1 - tuning.riskAppetite) * 0.12);
  return Math.max(0, estimate * sourceRatio * confidenceScale * roundPressure * riskScale);
}

function weightedRangeValue(
  ranges: readonly (readonly number[])[],
  state: MatchRuntimeState,
  salt?: string
): number {
  const candidates = ranges
    .filter((range) => range.length >= 2)
    .map((range) => ({
      min: Math.round(range[0]!),
      max: Math.round(range[1]!),
      weight: Math.max(0, range[2] ?? 1)
    }))
    .filter((range) => range.max >= range.min && range.weight > 0);
  if (candidates.length === 0) {
    throw new Error('RankAi weighted range is empty');
  }
  const rng = salt ? createRandom(hashSeed(`${state.id}:${state.roundIndex}:${salt}`)) : state.rng;
  const selected = rng.weighted(candidates.map((candidate) => ({ item: candidate, weight: candidate.weight })));
  return rng.int(selected.min, selected.max);
}

function bidFloorForRound(state: MatchRuntimeState, player: RuntimePlayer, round: RuntimeRound): number {
  const baseFloor = round.container.minimumBid ?? 0;
  return coreExtraRoundMinimum(state, round, previousRoundSignalForPlayer(state, player.id)?.ownBid, baseFloor);
}

function coreExtraRoundMinimum(
  state: MatchRuntimeState,
  round: RuntimeRound,
  previousOwnBid: number | undefined,
  baseFloor: number
): number {
  if (!state.coreMode || round.index <= 4 || !previousOwnBid || previousOwnBid <= 0) {
    return baseFloor;
  }
  return Math.max(baseFloor, previousOwnBid + state.config.rules.minIncrement);
}

function desiredOpenCloseBid(
  state: MatchRuntimeState,
  round: RuntimeRound,
  closeThreshold: number
): number | undefined {
  void state;
  void closeThreshold;
  if (round.auctionMode !== 'open') {
    return undefined;
  }
  return undefined;
}

function previousRoundSignalForPlayer(state: MatchRuntimeState, playerId: string): PreviousRoundSignal | undefined {
  for (let index = state.roundHistory.length - 1; index >= 0; index -= 1) {
    const history = state.roundHistory[index]!;
    const ownBid = history.bids.find((bid) => bid.playerId === playerId)?.amount;
    const ownRank = history.bidFeedback?.publicRanking.find((entry) => entry.playerId === playerId)?.rank;
    if (ownBid !== undefined || ownRank !== undefined) {
      return {
        ownBid,
        rank: ownRank,
        leaderPlayerId: history.bidFeedback?.leaderPlayerId,
        decision: history.bidFeedback?.decision?.decision
      };
    }
  }
  return undefined;
}

function availableCashForBid(state: MatchRuntimeState, player: RuntimePlayer, round: RuntimeRound): number {
  void state;
  void round;
  return player.cash;
}

function pickRelevantOpponent(state: MatchRuntimeState, player: RuntimePlayer): RuntimePlayer | undefined {
  const previousLeaderId = previousRoundSignalForPlayer(state, player.id)?.leaderPlayerId;
  const previousLeader = previousLeaderId && previousLeaderId !== player.id
    ? state.players.find((candidate) => candidate.id === previousLeaderId)
    : undefined;
  if (previousLeader) {
    return previousLeader;
  }
  return [...state.players]
    .filter((candidate) => candidate.id !== player.id)
    .sort((left, right) => {
      const humanBias = (right.kind === 'human' ? 1 : 0) - (left.kind === 'human' ? 1 : 0);
      if (humanBias !== 0) {
        return humanBias;
      }
      return calculateNetWorth(right, state.config) - calculateNetWorth(left, state.config);
    })[0];
}

function decisionStyleFor(
  tuning: BotTuning,
  confidence: number,
  riskPenalty: number,
  previous?: PreviousRoundSignal
): string {
  if (riskPenalty > 0.22 && confidence < 0.5) {
    return 'risk-control';
  }
  if (previous?.rank === 2 && confidence > 0.5) {
    return 'chasing-leader';
  }
  if (tuning.bidAggression > 0.68) {
    return 'pressure-bidder';
  }
  if (confidence > 0.66) {
    return 'clue-backed';
  }
  return 'probing';
}

function buildBotActionAudit(context: BotContext, trace: string[], action: BotAction): BotActionAudit {
  const { profile, round, role, tuning, assessment, skillIntent } = context;
  const trueValue = sumItemValue(round.container.hiddenItems);
  const ratioBase = Math.max(1, assessment.estimate || assessment.publicEstimate);
  const actionBid = action.type === 'bid' ? action.amount : undefined;
  return {
    profileId: profile.id,
    phase: round.phase,
    auctionMode: round.auctionMode,
    behaviorTree: trace,
    roleId: role?.id,
    skillId: role?.skillId,
    rankAiRowId: tuning.rankAiRowId,
    rankAiRoleId: tuning.rankAiRoleId,
    rankAiRoundCount: tuning.rankAiRoundCount,
    rankAiMinBidRatio: tuning.rankAiRowId !== undefined ? tuning.minBidRatio : undefined,
    rankAiPkRatio: tuning.rankAiRowId !== undefined ? tuning.pkRatio : undefined,
    rankAiBidTimeSeconds: tuning.rankAiRowId !== undefined ? tuning.bidTimeSeconds : undefined,
    rankAiTargetRatio: tuning.rankAiRowId !== undefined
      ? roundNumber(coreRankAiRoundTargetRatio(round, tuning, assessment.confidence, assessment.riskPenalty, assessment.previous), 3)
      : undefined,
    rankAiItemUseProbability: tuning.rankAiRowId !== undefined ? tuning.itemUseProbability : undefined,
    rankAiItemUsageGroupId: action.itemUsageGroupId,
    battleItemId: action.itemId,
    battleItemName: action.itemId ? bidKingBattleItemDisplayName(BattleItem.find((item) => item.id === action.itemId) ?? BattleItem[0]!) : undefined,
    riskAppetite: tuning.riskAppetite,
    bluffChance: tuning.bluffChance,
    overpayTolerance: tuning.overpayTolerance,
    bidAggression: tuning.bidAggression,
    publicEstimate: assessment.publicEstimate,
    publicEstimateHidden: assessment.publicEstimateHidden,
    publicEstimateSource: assessment.publicEstimateSource,
    protocolInferredEstimate: assessment.protocolInferredEstimate,
    clueEstimate: assessment.clueEstimate,
    slotEstimate: assessment.slotEstimate,
    estimate: assessment.estimate,
    confidence: roundNumber(assessment.confidence, 3),
    riskPenalty: roundNumber(assessment.riskPenalty, 3),
    valueRangeWidth: roundNumber(assessment.valueRangeWidth, 3),
    maxBid: assessment.maxBid,
    targetBid: assessment.targetBid,
    bidFloor: assessment.bidFloor,
    minimumBid: round.container.minimumBid,
    availableCash: assessment.availableCash,
    nextOpenBid: assessment.nextOpenBid,
    previousOwnBid: assessment.previous?.ownBid,
    previousRank: assessment.previous?.rank,
    closeThreshold: assessment.closeThreshold,
    desiredCloseBid: assessment.desiredCloseBid,
    trueValue,
    targetBidRatio: roundNumber(assessment.targetBid / ratioBase, 3),
    maxBidRatio: roundNumber(assessment.maxBid / ratioBase, 3),
    bidFloorRatio: roundNumber(assessment.bidFloor / ratioBase, 3),
    actionBidRatio: actionBid !== undefined ? roundNumber(actionBid / ratioBase, 3) : undefined,
    projectedProfitAtTarget: trueValue - assessment.targetBid,
    projectedProfitAtAction: actionBid !== undefined ? trueValue - actionBid : undefined,
    targetPlayerId: action.targetPlayerId,
    skillIntent: `${skillIntent.reason} (${roundNumber(skillIntent.score, 2)})`,
    decisionStyle: assessment.decisionStyle
  };
}

function roundToIncrement(value: number, increment: number): number {
  return Math.max(0, Math.round(value / increment) * increment);
}

function floorToIncrement(value: number, increment: number): number {
  return Math.max(0, Math.floor(value / increment) * increment);
}

function roundNumber(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
