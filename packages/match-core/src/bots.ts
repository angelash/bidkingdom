import type { GameConfig } from '@bitkingdom/config';
import { Emoji, Hero, RankAi, bidKingRawTableDisplayName } from '@bitkingdom/bidking-compat';
import type { AuctionMode, Clue, Rarity, SkillId, WarehouseSlotView } from '@bitkingdom/shared';
import { getBidKingCloseThreshold } from './bidking/compatRuntime';
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
  riskAppetite: number;
  bluffChance: number;
  overpayTolerance: number;
  bidAggression: number;
  publicEstimate?: number;
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

export interface BotAction {
  type: 'bid' | 'pass' | 'skill' | 'emote';
  amount?: number;
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
  itemUseProbability: number;
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
  const action = result.action ?? idleEmoteAction(context, 'Behavior tree reached idle fallback');

  return {
    ...action,
    audit: buildBotActionAudit(context, result.trace, action)
  };
}

const BOT_ROOT = selector('BidKingBotRoot', [
  sequence('IntelSkillSequence', [
    condition('IsIntelPhase', (context) => context.round.phase === 'intel'),
    condition('CanUseSkill', canUseSkill),
    condition('SkillHasIntelValue', (context) => shouldUseSkill(context, 'intel')),
    action('UseSkillForIntel', (context) => skillAction(context, 'Bot uses skill to reduce valuation uncertainty before bidding'))
  ]),
  sequence('AuctionSkillSequence', [
    condition('IsAuctionPhase', (context) => context.round.phase === 'auction'),
    condition('CanUseSkillBeforeBid', canUseSkill),
    condition('SkillCanStillChangeBid', (context) => shouldUseSkill(context, 'auction')),
    action('UseSkillBeforeBid', (context) => skillAction(context, 'Bot uses skill before committing an auction bid'))
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
  const assessment = assessAuction(state, player, round, tuning, role);
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
  tuning: BotTuning,
  role?: GameConfig['roles'][number]
): BotAuctionAssessment {
  const publicEstimate = Math.max(1, (round.container.publicInfo.estimateMin + round.container.publicInfo.estimateMax) / 2);
  const valueRangeWidth = (round.container.publicInfo.estimateMax - round.container.publicInfo.estimateMin) / publicEstimate;
  const visibleClues = visibleCluesForBot(round, player);
  const clueEstimate = estimateFromValueClues(visibleClues);
  const slotEstimate = estimateFromVisibleSlots(round.warehouseSlots, publicEstimate);
  const previous = previousRoundSignalForPlayer(state, player.id);
  const riskPenalty = riskPenaltyFromVisibleInfo(round, visibleClues, player, role);
  const confidence = estimateConfidence({
    valueClueCount: visibleClues.filter((clue) => clue.valueHint).length,
    privateSkillClueCount: player.privateClues.filter((clue) => clue.source === 'skill').length,
    slotCoverage: slotEstimate.coverage,
    valueRangeWidth,
    risk: round.container.publicInfo.risk
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
  const nextOpenBid = Math.max(round.container.minimumBid ?? 0, round.currentBid + state.config.rules.minIncrement);
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
  if (round.auctioneerClue && !['warehouse_roll', 'warehouse_selected'].includes(round.phase)) {
    clues.unshift(round.auctioneerClue);
  }
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
          : clue.source === 'rumor'
            ? 0.35
            : 0.85;
      const kindWeight = clue.kind === 'false' ? 0.4 : 1;
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
  let observedValue = 0;
  let observedWeight = 0;
  for (const slot of slots) {
    if (slot.visibleValueRange) {
      observedValue += (slot.visibleValueRange.min + slot.visibleValueRange.max) / 2;
      observedWeight += 1;
      continue;
    }
    if (slot.visibleRarity) {
      observedValue += averagePublicItemValue * rarityValueMultiplier(slot.visibleRarity);
      observedWeight += 0.42;
      continue;
    }
    if (slot.visibleShape) {
      const area = Math.max(1, slot.w * slot.h);
      observedValue += averagePublicItemValue * clamp(area / 2.2, 0.55, 1.45);
      observedWeight += 0.18;
    }
  }
  if (observedWeight <= 0) {
    return { coverage: 0 };
  }
  const coverage = clamp(observedWeight / slots.length, 0, 1);
  const observedAverage = observedValue / observedWeight;
  const estimate = Math.round(observedAverage * slots.length);
  return { estimate, coverage };
}

function rarityValueMultiplier(rarity: Rarity): number {
  const multipliers: Record<Rarity, number> = {
    junk: 0.22,
    common: 0.48,
    fine: 0.82,
    rare: 1.32,
    legendary: 2.15,
    fake: 0.2
  };
  return multipliers[rarity];
}

function riskPenaltyFromVisibleInfo(
  round: RuntimeRound,
  clues: readonly Clue[],
  player: RuntimePlayer,
  role?: GameConfig['roles'][number]
): number {
  const riskBase = round.container.publicInfo.risk === 'high'
    ? 0.18
    : round.container.publicInfo.risk === 'medium'
      ? 0.1
      : 0.04;
  const hasFakeHint = clues.some((clue) => clue.riskHint === 'fake' || clue.kind === 'false' || clue.source === 'rumor');
  const hasRepairHint = clues.some((clue) => clue.riskHint === 'repair');
  const hasSafeHint = clues.some((clue) => clue.riskHint === 'safe');
  const repairRelief = role?.id === 'restorer' ? 0.04 : 0;
  const insuranceRelief = player.insuranceActive || role?.skillId === 'loss_insurance' ? 0.03 : 0;
  return clamp(
    riskBase + (hasFakeHint ? 0.1 : 0) + (hasRepairHint ? 0.07 : 0) - (hasSafeHint ? 0.04 : 0) - repairRelief - insuranceRelief,
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
    ? (confidence < 0.48 ? 0.45 : 0.25)
    : confidence < 0.48 ? 0.9 : 0.55;
  const riskFactor = 1 - riskPenalty * riskScale;
  const raw = estimate * confidenceFactor * styleFactor * riskFactor;
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
  const pkAdjustment = (clamp(tuning.pkRatio / 1000, 0.3, 1.6) - 1) * 0.08;
  const modeAdjustment = round.auctionMode === 'second_price'
    ? 0.08
    : round.auctionMode === 'flash'
      ? -0.08
      : 0;
  const riskAdjustment = -riskPenalty * (state.coreMode ? 0.16 : 0.35);
  const commitment = clamp(
    roundCommitment + rankAdjustment + confidenceAdjustment + aggressionAdjustment + pkAdjustment + modeAdjustment + riskAdjustment,
    state.coreMode ? 0.44 : 0.32,
    round.index >= 4 ? 1.2 : state.coreMode ? 1.1 : 1.02
  );
  const tableRatio = clamp(tuning.minBidRatio / 1000, state.coreMode ? 0.62 : 0.35, 1.35);
  const tableAnchor = estimate * tableRatio;
  const rawTarget = state.coreMode
    ? estimate * commitment * 0.62 + tableAnchor * 0.38
    : estimate * commitment * 0.78 + tableAnchor * 0.22;
  const competitiveFloor = state.coreMode
    ? estimate * coreCompetitiveBidFloorRatio(round, tuning, confidence, riskPenalty)
    : 0;
  const minimum = coreExtraRoundMinimum(state, round, previous?.ownBid, bidFloor);
  const target = Math.min(maxBid, Math.max(rawTarget, competitiveFloor));
  if (target >= minimum) {
    return roundToIncrement(target, state.config.rules.minIncrement);
  }
  return shouldBidAtFloor(estimate, minimum, confidence, riskPenalty, round) && maxBid >= minimum
    ? minimum
    : 0;
}

function commitmentForRound(state: MatchRuntimeState, round: RuntimeRound): number {
  if (!state.coreMode) {
    return round.auctionMode === 'flash' ? 0.82 : 0.94;
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
    (tuning.bidAggression - 0.5) * 0.12 + (clamp(tuning.pkRatio / 1000, 0.4, 1.8) - 1) * 0.05,
    -0.04,
    0.08
  );
  const riskAdjustment = riskPenalty * 0.1;
  const roundCeiling = round.index >= 4 ? 1.08 : 1;
  return clamp(base + confidenceAdjustment + aggressionAdjustment - riskAdjustment, 0.48, roundCeiling);
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
  round: RuntimeRound
): boolean {
  if (floor <= 0) {
    return estimate > 0;
  }
  const edgeRatio = round.auctionMode === 'second_price'
    ? -0.02
    : 0.025 + riskPenalty * 0.18 + (1 - confidence) * 0.05;
  if (round.auctionMode === 'flash' && confidence < 0.34 && riskPenalty > 0.18) {
    return false;
  }
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
    const hasOpponentPressure = Boolean(targetOpponent) && (round.auctionMode === 'open' || assessment.previous?.rank === 2 || round.index >= 4);
    score += hasOpponentPressure ? 0.22 : 0.04;
    reason = 'opponent pressure matters';
  } else if (skillId === 'spread_rumor') {
    score += state.coreMode ? -0.16 : tuning.bluffChance * 0.28;
    reason = state.coreMode ? 'rumor has limited core value' : 'bluff can distort public reads';
  } else if (skillId === 'repair_audit') {
    score += assessment.riskPenalty > 0.14 || round.container.publicInfo.risk === 'high' ? 0.22 : 0.03;
    reason = 'repair or risk audit can prevent overpay';
  } else if (skillId === 'loss_insurance') {
    score += round.container.publicInfo.risk === 'high' && assessment.targetBid > assessment.availableCash * 0.45 ? 0.24 : 0.04;
    reason = 'insurance helps near risky cash commitment';
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

function canUseSkill(context: BotContext): boolean {
  const { player, round, state } = context;
  if (!['intel', 'auction'].includes(round.phase)) {
    return false;
  }
  if (state.coreMode && round.phase === 'auction' && (player.hasSubmittedBid || round.bids.some((bid) => bid.playerId === player.id))) {
    return false;
  }
  return player.skillCooldown === 0 && !player.skillUsedThisRound && player.skillUsesRemaining > 0;
}

function shouldUseSkill(context: BotContext, timing: 'intel' | 'auction'): boolean {
  const { state, skillIntent, tuning, round } = context;
  const threshold = timing === 'intel'
    ? 0.48 + (round.index <= 1 ? 0.08 : 0)
    : 0.68;
  if (skillIntent.score >= threshold) {
    return true;
  }
  const opportunisticChance = timing === 'intel'
    ? 0.04 + tuning.riskAppetite * 0.04
    : round.auctionMode === 'open'
      ? 0.03 + tuning.bluffChance * 0.04
      : 0.01;
  return state.rng.next() < opportunisticChance && skillIntent.score > threshold - 0.12;
}

function skillAction(context: BotContext, reason: string): BotAction {
  return {
    type: 'skill',
    targetPlayerId: context.skillIntent.targetPlayerId,
    reason: `${reason}: ${context.skillIntent.reason}`
  };
}

function chooseAuctionAction(context: BotContext): BotAction {
  const { round, player, assessment } = context;

  if (round.auctionMode === 'open' || round.auctionMode === 'deposit_open') {
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
  const { state, round, player, assessment } = context;
  if (round.currentLeaderId === player.id) {
    return idleEmoteAction(context, 'Bot holds current open-auction lead');
  }
  if (state.coreMode && round.bids.some((bid) => bid.playerId === player.id)) {
    return idleEmoteAction(context, 'Bot already submitted core open-auction bid');
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
  const { state, round, assessment, tuning } = context;
  const nextBid = assessment.nextOpenBid;
  if (nextBid > assessment.maxBid || !shouldBidAtFloor(assessment.estimate, nextBid, assessment.confidence, assessment.riskPenalty, round)) {
    return 0;
  }
  const closeBid = assessment.desiredCloseBid;
  const shouldPressureClose =
    closeBid !== undefined &&
    closeBid >= nextBid &&
    closeBid <= assessment.maxBid &&
    closeBid <= Math.max(assessment.targetBid, nextBid) * 1.12 &&
    (round.index >= 3 || assessment.confidence > 0.62 || tuning.bidAggression > 0.68);
  if (state.coreMode) {
    const anchoredTarget = Math.max(nextBid, assessment.targetBid);
    const pressureTarget = shouldPressureClose && closeBid !== undefined
      ? Math.max(anchoredTarget, closeBid)
      : anchoredTarget;
    const amount = ceilToIncrement(Math.min(assessment.maxBid, pressureTarget), state.config.rules.minIncrement);
    return amount >= nextBid && shouldBidAtFloor(assessment.estimate, amount, assessment.confidence, assessment.riskPenalty, round)
      ? amount
      : 0;
  }
  if (shouldPressureClose) {
    return ceilToIncrement(closeBid, state.config.rules.minIncrement);
  }
  const canJump =
    round.currentLeaderId &&
    assessment.targetBid - nextBid >= state.config.rules.minIncrement * 4 &&
    tuning.bidAggression > 0.7 &&
    assessment.confidence > 0.54;
  if (canJump) {
    const jump = nextBid + state.config.rules.minIncrement * (1 + Math.round(tuning.bidAggression * 2));
    return Math.min(assessment.maxBid, ceilToIncrement(jump, state.config.rules.minIncrement));
  }
  return nextBid;
}

function sealedBidAmount(context: BotContext): number {
  const { state, round, assessment, tuning } = context;
  let amount = assessment.targetBid;
  if (round.auctionMode === 'second_price') {
    amount = Math.max(amount, assessment.estimate * (0.82 + assessment.confidence * 0.18));
  }
  if (round.auctionMode === 'flash') {
    amount *= 0.88 + assessment.confidence * 0.08;
  }

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
  if (!shouldBidAtFloor(assessment.estimate, amount, assessment.confidence, assessment.riskPenalty, round)) {
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
    return {
      riskAppetite: profile.riskAppetite,
      bluffChance: profile.bluffChance,
      overpayTolerance: profile.overpayTolerance,
      bidAggression: profile.riskAppetite,
      minBidRatio: 740 + profile.riskAppetite * 320,
      pkRatio: 820 + profile.riskAppetite * 420,
      itemUseProbability: Math.round(220 + profile.riskAppetite * 420)
    };
  }
  const row = rankAiRowForPlayer(state, player);
  return {
    rankAiRowId: row.id,
    rankAiRoleId: row.role_id,
    rankAiRoundCount: row.round_count,
    riskAppetite: row.risk_appetite,
    bluffChance: row.bluff_chance,
    overpayTolerance: row.overpay_tolerance,
    bidAggression: row.bid_aggression,
    minBidRatio: weightedRangeValue(row.min_bid_ratio, state, 850, `${player.id}:${row.id}:min_bid_ratio`),
    pkRatio: weightedRangeValue(row.bid_pk, state, 1000, `${player.id}:${row.id}:bid_pk`),
    itemUseProbability: row.item_use_probability
  };
}

function rankAiRowForPlayer(state: MatchRuntimeState, player: RuntimePlayer) {
  const hero = Hero[player.seat % Math.max(1, Hero.length)];
  const roundCount = Math.max(1, state.roundIndex + 1);
  const heroRows = hero ? RankAi.filter((row) => row.role_id === hero.id) : [];
  return heroRows.find((row) => row.round_count === roundCount) ??
    heroRows.find((row) => row.round_count > roundCount) ??
    heroRows.at(-1) ??
    RankAi.find((row) => row.round_count === roundCount) ??
    RankAi[(Math.max(0, state.roundIndex) * state.players.length + player.seat) % RankAi.length] ??
    RankAi[0]!;
}

function weightedRangeValue(
  ranges: readonly (readonly number[])[],
  state: MatchRuntimeState,
  fallback: number,
  salt?: string
): number {
  const candidates = ranges
    .filter((range) => range.length >= 2)
    .map((range) => ({
      min: Math.round(range[0] ?? fallback),
      max: Math.round(range[1] ?? range[0] ?? fallback),
      weight: Math.max(0, range[2] ?? 1)
    }))
    .filter((range) => range.max >= range.min && range.weight > 0);
  if (candidates.length === 0) {
    return fallback;
  }
  const rng = salt ? createRandom(hashSeed(`${state.id}:${state.roundIndex}:${salt}`)) : state.rng;
  const selected = rng.weighted(candidates.map((candidate) => ({ item: candidate, weight: candidate.weight })));
  return rng.int(selected.min, selected.max);
}

function bidFloorForRound(state: MatchRuntimeState, player: RuntimePlayer, round: RuntimeRound): number {
  const baseFloor = round.auctionMode === 'open' || round.auctionMode === 'deposit_open'
    ? Math.max(round.container.minimumBid ?? 0, round.currentBid + state.config.rules.minIncrement)
    : round.container.minimumBid ?? 0;
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
  if (!['open', 'deposit_open'].includes(round.auctionMode)) {
    return undefined;
  }
  const amounts = highestVisibleOpenAmounts(round);
  const secondAmount = amounts[1]?.amount ?? 0;
  if (secondAmount <= 0) {
    return undefined;
  }
  const pressure = closeThreshold > 0 ? closeThreshold + 0.035 : 0;
  return ceilToIncrement(secondAmount * (1 + pressure), state.config.rules.minIncrement);
}

function highestVisibleOpenAmounts(round: RuntimeRound): Array<{ playerId: string; amount: number }> {
  const highestByPlayer = new Map<string, number>();
  for (const bid of round.bids) {
    if (!bid.visible || bid.amount <= 0) {
      continue;
    }
    highestByPlayer.set(bid.playerId, Math.max(highestByPlayer.get(bid.playerId) ?? 0, bid.amount));
  }
  return [...highestByPlayer.entries()]
    .map(([playerId, amount]) => ({ playerId, amount }))
    .sort((left, right) => right.amount - left.amount);
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
  if (round.auctionMode !== 'deposit_open' || round.depositPaidByPlayerId[player.id]) {
    return player.cash;
  }
  const deposit = round.container.depositValue ?? state.config.rules.depositValue;
  return Math.max(0, player.cash - deposit);
}

function pickRelevantOpponent(state: MatchRuntimeState, player: RuntimePlayer): RuntimePlayer | undefined {
  const round = state.currentRound;
  const currentLeader = round?.currentLeaderId && round.currentLeaderId !== player.id
    ? state.players.find((candidate) => candidate.id === round.currentLeaderId)
    : undefined;
  if (currentLeader) {
    return currentLeader;
  }
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
    riskAppetite: tuning.riskAppetite,
    bluffChance: tuning.bluffChance,
    overpayTolerance: tuning.overpayTolerance,
    bidAggression: tuning.bidAggression,
    publicEstimate: assessment.publicEstimate,
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

function ceilToIncrement(value: number, increment: number): number {
  return Math.max(0, Math.ceil(value / increment) * increment);
}

function roundNumber(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
