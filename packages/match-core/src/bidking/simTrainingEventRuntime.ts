import { itemById, skillById } from '@bitkingdom/bidking-compat';
import type {
  BidKingGameDataSnapshot,
  BidKingGameSkillDataSnapshot,
  BidKingSimGameLogSnapshot
} from '@bitkingdom/shared';
import type { BidKingRewardPlan } from './reward/rewardEngine';
import {
  bidKingApplySimGameDataUpdate,
  bidKingApplySimSystemEffectOperation,
  bidKingCanUseSimBuffItem,
  bidKingChooseGameWinItem,
  bidKingSimHeroSkillCastRequestsForOperation,
  bidKingSimBuffItemHasActiveSkill,
  bidKingSimItemStateModeChangeForOperation,
  bidKingSimPostGameRewardsForOperation,
  bidKingUseSimBuffItem,
  bidKingUseSimSelectItem,
  type BidKingSimHeroSkillCastRequest,
  type BidKingSimItemStateModeChange,
  type BidKingSimPostGameOutcome,
  type BidKingSimTrainingState,
  bidKingApplySimGameLogRefresh
} from './simItemRuntime';
import {
  bidKingSimSkillMatchesTrigger,
  bidKingSimSkillTriggerProfilesForItem,
  type BidKingSimSkillTriggerContext,
  type BidKingSimSkillTriggerEvent,
  type BidKingSimSkillTriggerProfile
} from './simSkillTriggerRuntime';
import {
  bidKingSystemEffectOperationsForSkillIds,
  type BidKingSystemEffectOperation
} from './systemEffectRuntime';

export type BidKingSimSkillTriggerSourceKind = 'sim_buff' | 'sim_select' | 'explicit';
export type BidKingSimUseTrainingItemFailure =
  | 'missing_sim_select_item'
  | 'missing_sim_buff_item'
  | 'buff_item_not_active'
  | 'buff_item_on_cooldown'
  | 'insufficient_buff_power'
  | 'missing_target_box';

export type BidKingSimUseTrainingItemProtocolName =
  | 'C2S_128_sim_game_use_item'
  | 'C2S_156_sim_game_use_buff_item';

export type BidKingSimUseTrainingItemResponseProtocolName =
  | 'S2C_129_sim_game_use_item'
  | 'S2C_157_sim_game_use_buff_item';

export type BidKingSimTrainingBidPriceProtocolName = 'C2S_126_sim_game_bid_price';
export type BidKingSimTrainingBidPriceResponseProtocolName = 'S2C_127_sim_game_bid_price';
export type BidKingSimTrainingGameLogProtocolName = 'C2S_130_get_sim_game_log';
export type BidKingSimTrainingGameLogResponseProtocolName = 'S2C_131_get_sim_game_log';
export type BidKingSimTrainingWinItemChoiceProtocolName = 'C2S_134_sim_game_select_win_item';
export type BidKingSimTrainingWinItemChoiceResponseProtocolName = 'S2C_135_sim_game_select_win_item';
export type BidKingSimTrainingTestSkillCastProtocolName = 'C2S_290_test_game_cast_skill';
export type BidKingSimTrainingTestSkillCastResponseProtocolName = 'S2C_291_test_game_cast_skill';
export type BidKingSimTrainingSkillLogSource =
  | 'ItemSkillLog'
  | 'MapSkillLog'
  | 'HeroSkillLog'
  | 'SkillLog';

export interface BidKingSimSkillTriggerSource {
  itemCid: number;
  itemUid?: number;
  itemCount: number;
  kind: BidKingSimSkillTriggerSourceKind;
}

export interface BidKingApplySimSkillTriggerEventOptions {
  sources?: readonly BidKingSimSkillTriggerSource[];
  includeSimBuffItems?: boolean;
  includeSimSelectItems?: boolean;
  requireSourceContext?: boolean;
  chanceRollsPerSkillId?: Readonly<Record<number, number>>;
  gameUid?: string;
  mapCid?: number;
  roundIndex?: number;
  randomHeroCid?: number;
  randomHeroSkillIds?: readonly number[];
  postGameOutcome?: BidKingSimPostGameOutcome;
}

export interface BidKingTriggeredSimSkill {
  source: BidKingSimSkillTriggerSource;
  profile: BidKingSimSkillTriggerProfile;
  operations: BidKingSystemEffectOperation[];
}

export interface BidKingApplySimSkillTriggerEventResult {
  state: BidKingSimTrainingState;
  triggeredSkills: BidKingTriggeredSimSkill[];
  operations: BidKingSystemEffectOperation[];
  appliedOperations: BidKingSystemEffectOperation[];
  pendingOperations: BidKingSystemEffectOperation[];
  heroSkillCastRequests: BidKingSimHeroSkillCastRequest[];
  itemStateModeChanges: BidKingSimItemStateModeChange[];
  rewardPlans: BidKingRewardPlan[];
}

export interface BidKingSimUseTrainingItemProtocolRequest {
  protocolId: 128 | 156;
  protocolName: BidKingSimUseTrainingItemProtocolName;
  itemUid?: number;
  itemCid: number;
  targetBoxId: number;
}

export interface BidKingSimUseTrainingItemUpdateBoundary {
  responseProtocolId: 129 | 157;
  responseProtocolName: BidKingSimUseTrainingItemResponseProtocolName;
  responseFields: readonly ['ErrorCode', 'UpdateGameData'];
  updateGameDataField: 'UpdateGameData';
  syncMethod: 'PlayerGameData.UpdateSimGameData';
  skillLogSource: 'GetNoPlaySkills(simGameLog.GameData)';
  skillLogOrder: readonly ['ItemSkillLog', 'MapSkillLog', 'HeroSkillLog'];
  skillLogSort: false;
  skillLogGeneratedBy: 'server';
}

export interface BidKingUseSimTrainingItemResult {
  state: BidKingSimTrainingState;
  request?: BidKingSimUseTrainingItemProtocolRequest;
  updateBoundary?: BidKingSimUseTrainingItemUpdateBoundary;
  failure?: BidKingSimUseTrainingItemFailure;
  activeUseTrigger?: BidKingApplySimSkillTriggerEventResult;
  useItemTrigger?: BidKingApplySimSkillTriggerEventResult;
  depletedTrigger?: BidKingApplySimSkillTriggerEventResult;
}

export interface BidKingSimTrainingBidPriceRequest {
  protocolId: 126;
  protocolName: BidKingSimTrainingBidPriceProtocolName;
  price: number;
}

export interface BidKingSimTrainingGameLogRequest {
  protocolId: 130;
  protocolName: BidKingSimTrainingGameLogProtocolName;
}

export interface BidKingSimTrainingGameLogBoundary {
  responseProtocolId: 131;
  responseProtocolName: BidKingSimTrainingGameLogResponseProtocolName;
  assignmentMethod: 'PlayerGameData.InitSimGame';
  replaceMode: 'simGameLog = GetSimGameLog()';
  authoritativeFields: readonly [
    'MaxWinLevel',
    'SimGold',
    'GameWinItemList',
    'SimShopStatus',
    'GameData',
    'Level',
    'SimSelectItemList',
    'SimBuffItemList',
    'SelectItemCount',
    'RoundCanUseItemCount',
    'GameCarryItemMax',
    'GameGoldRateMax'
  ];
}

export interface BidKingApplySimTrainingGameLogRefreshResult {
  state: BidKingSimTrainingState;
  request: BidKingSimTrainingGameLogRequest;
  updateBoundary: BidKingSimTrainingGameLogBoundary;
}

export interface BidKingSimTrainingTestSkillCastRequest {
  protocolId: 290;
  protocolName: BidKingSimTrainingTestSkillCastProtocolName;
  gameUid: string;
  itemCid: number;
  skillCid: number;
  heroCid: number;
  mapCid: number;
}

export type BidKingSimTrainingTestSkillCastRequestInput = Pick<
  BidKingSimTrainingTestSkillCastRequest,
  'skillCid'
> & Partial<Pick<BidKingSimTrainingTestSkillCastRequest, 'gameUid' | 'itemCid' | 'heroCid' | 'mapCid'>>;

export interface BidKingSimTrainingTestSkillCastBoundary {
  responseProtocolId: 291;
  responseProtocolName: BidKingSimTrainingTestSkillCastResponseProtocolName;
  responseFields: readonly [
    'ErrorCode',
    'ItemSkillLog',
    'NewGameData',
    'HeroSkillLog',
    'MapSkillLog',
    'SkillLog'
  ];
  playOrder: readonly ['ItemSkillLog', 'HeroSkillLog', 'MapSkillLog', 'SkillLog'];
  newGameDataField: 'NewGameData';
  generatedBy: 'server';
}

export interface BidKingSimTrainingTestSkillCastResponse {
  itemSkillLog?: readonly BidKingGameSkillDataSnapshot[];
  newGameData?: BidKingGameDataSnapshot;
  heroSkillLog?: readonly BidKingGameSkillDataSnapshot[];
  mapSkillLog?: readonly BidKingGameSkillDataSnapshot[];
  skillLog?: readonly BidKingGameSkillDataSnapshot[];
}

export interface BidKingApplySimTrainingTestSkillCastResponseOptions {
  playerId?: string;
}

export interface BidKingApplySimTrainingTestSkillCastResponseResult {
  state: BidKingSimTrainingState;
  updateBoundary: BidKingSimTrainingTestSkillCastBoundary;
  playedSkillLogs: BidKingGameSkillDataSnapshot[];
  itemSkillLog: BidKingGameSkillDataSnapshot[];
  heroSkillLog: BidKingGameSkillDataSnapshot[];
  mapSkillLog: BidKingGameSkillDataSnapshot[];
  skillLog: BidKingGameSkillDataSnapshot[];
}

export interface BidKingSimTrainingNextRoundBoundary {
  responseProtocolId: 127;
  responseProtocolName: BidKingSimTrainingBidPriceResponseProtocolName;
  isNextRoundField: 'IsNextRound';
  nextRoundGameDataField: 'NextRoundGameData';
  syncMethod: 'PlayerGameData.UpdateSimGameData';
  roundStartMethod: 'Battle_Handler.S2C_OnRoundStartOnTraining2';
  skillLogSource: 'MapSkillLog + HeroSkillLog + ItemSkillLog';
  skillLogOrder: readonly ['MapSkillLog', 'HeroSkillLog', 'ItemSkillLog'];
  skillLogSort: 'CastTime';
}

export interface BidKingSimTrainingGameOverBoundary {
  responseProtocolId: 127;
  responseProtocolName: BidKingSimTrainingBidPriceResponseProtocolName;
  isNextRoundField: 'IsNextRound';
  isWinField: 'IsWin';
  nextRoundGameDataConsumed: false;
  gameOverMethod: 'Battle_Handler.S2C_OnGameOver';
  refreshMethod: 'Battle_Main.Training: PlayerGameData.InitSimGame';
  winItemChoiceMethod: 'ChooseEffect_Main.Choose -> PlayerManager.ChooseSpecialItem';
}

export interface BidKingSimTrainingGameOverOptions {
  rewardOperations?: Iterable<BidKingSystemEffectOperation>;
  rewardSkillIds?: Iterable<number>;
}

export interface BidKingSimTrainingGameOverResult {
  state: BidKingSimTrainingState;
  updateBoundary: BidKingSimTrainingGameOverBoundary;
  outcome: BidKingSimPostGameOutcome;
  isWin: boolean;
  finalPrice: number;
  rewardPlans: BidKingRewardPlan[];
}

export interface BidKingSimTrainingWinItemChoiceRequest {
  protocolId: 134;
  protocolName: BidKingSimTrainingWinItemChoiceProtocolName;
  itemCid: number;
  discardItemUid: number;
}

export interface BidKingSimTrainingWinItemChoiceBoundary {
  responseProtocolId: 135;
  responseProtocolName: BidKingSimTrainingWinItemChoiceResponseProtocolName;
  responseFields: readonly ['ErrorCode'];
  successRefreshMethod: 'PlayerGameData.InitSimGame';
  candidateSource: 'S2C_131_get_sim_game_log.GameWinItemList';
  chooseUi: 'ChooseEffect_Main.Choose';
}

export interface BidKingApplySimTrainingWinItemChoiceResult {
  state: BidKingSimTrainingState;
  request?: BidKingSimTrainingWinItemChoiceRequest;
  updateBoundary?: BidKingSimTrainingWinItemChoiceBoundary;
  chosenItemCid?: number;
  failure?: 'missing_item';
}

export interface BidKingApplySimTrainingNextRoundOptions
  extends Omit<BidKingApplySimSkillTriggerEventOptions, 'postGameOutcome'> {
  playerId?: string;
  playedSkillUids?: Iterable<number>;
  applyRoundStartTriggers?: boolean;
}

export interface BidKingApplySimTrainingNextRoundResult {
  state: BidKingSimTrainingState;
  updateBoundary: BidKingSimTrainingNextRoundBoundary;
  roundNumber: number;
  nextRoundTime: number;
  roundMapSkillLogs: BidKingGameSkillDataSnapshot[];
  unplayedSkillLogs: BidKingGameSkillDataSnapshot[];
  roundStartTrigger?: BidKingApplySimSkillTriggerEventResult;
}

export function bidKingSimSkillTriggerSourcesForState(
  state: BidKingSimTrainingState,
  options: Pick<BidKingApplySimSkillTriggerEventOptions, 'includeSimBuffItems' | 'includeSimSelectItems'> = {}
): BidKingSimSkillTriggerSource[] {
  const includeSimBuffItems = options.includeSimBuffItems ?? true;
  const includeSimSelectItems = options.includeSimSelectItems ?? true;
  const sources: BidKingSimSkillTriggerSource[] = [];
  if (includeSimBuffItems) {
    sources.push(...state.simBuffItemList.map((entry) => ({
      itemCid: entry.itemCid,
      itemCount: Math.max(1, Math.floor(entry.itemCount)),
      kind: 'sim_buff' as const
    })));
  }
  if (includeSimSelectItems) {
    sources.push(...state.simSelectItemList.map((entry) => ({
      itemCid: entry.itemCid,
      itemUid: entry.itemUid,
      itemCount: 1,
      kind: 'sim_select' as const
    })));
  }
  return sources;
}

export function bidKingApplySimSkillTriggerEvent(
  state: BidKingSimTrainingState,
  context: BidKingSimSkillTriggerContext,
  options: BidKingApplySimSkillTriggerEventOptions = {}
): BidKingApplySimSkillTriggerEventResult {
  let next = cloneSimTrainingState(state);
  const result: BidKingApplySimSkillTriggerEventResult = {
    state: next,
    triggeredSkills: [],
    operations: [],
    appliedOperations: [],
    pendingOperations: [],
    heroSkillCastRequests: [],
    itemStateModeChanges: [],
    rewardPlans: []
  };
  const sources = options.sources
    ? options.sources.map((source) => ({ ...source }))
    : bidKingSimSkillTriggerSourcesForState(next, options);

  for (const source of sources) {
    for (const profile of bidKingSimSkillTriggerProfilesForItem(source.itemCid)) {
      const triggerContext = triggerContextForProfile(profile, context, options);
      if (!bidKingSimSkillMatchesTrigger(profile, triggerContext)) {
        continue;
      }
      if ((options.requireSourceContext ?? true) && !hasRequiredTriggerContext(profile, triggerContext)) {
        continue;
      }

      const operations = bidKingSystemEffectOperationsForSkillIds([profile.skillId]);
      result.triggeredSkills.push({
        source,
        profile,
        operations
      });
      result.operations.push(...operations);

      for (const operation of operations) {
        const itemState = bidKingApplySimSystemEffectOperation(next, operation, {
          sourceItemCid: source.itemCid
        });
        if (itemState !== next && isLocallyAppliedSimOperation(operation)) {
          next = {
            ...next,
            simSelectItemList: itemState.simSelectItemList,
            simBuffItemList: itemState.simBuffItemList
          };
          result.appliedOperations.push(operation);
          result.state = next;
          continue;
        }

        const heroRequests = bidKingSimHeroSkillCastRequestsForOperation(operation, {
          gameUid: options.gameUid,
          itemCid: source.itemCid,
          mapCid: options.mapCid,
          roundIndex: options.roundIndex,
          randomHeroCid: options.randomHeroCid,
          randomHeroSkillIds: options.randomHeroSkillIds
        });
        const itemStateChange = bidKingSimItemStateModeChangeForOperation(operation);
        const rewardPlans = options.postGameOutcome
          ? bidKingSimPostGameRewardsForOperation(operation, options.postGameOutcome)
          : [];

        result.heroSkillCastRequests.push(...heroRequests);
        if (itemStateChange) {
          result.itemStateModeChanges.push(itemStateChange);
        }
        result.rewardPlans.push(...rewardPlans);
        result.pendingOperations.push(operation);
      }
    }
  }

  return result;
}

export function bidKingUseSimTrainingSelectItem(
  state: BidKingSimTrainingState,
  itemUid: number,
  options: Omit<BidKingApplySimSkillTriggerEventOptions, 'sources'> & { targetBoxId?: number } = {}
): BidKingUseSimTrainingItemResult {
  const usedItem = state.simSelectItemList.find((entry) => entry.itemUid === itemUid);
  if (!usedItem) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'missing_sim_select_item'
    };
  }
  if (bidKingSimTrainingItemRequiresTargetBox(usedItem.itemCid) && options.targetBoxId === undefined) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'missing_target_box'
    };
  }

  const request: BidKingSimUseTrainingItemProtocolRequest = {
    protocolId: 128,
    protocolName: 'C2S_128_sim_game_use_item',
    itemUid: usedItem.itemUid,
    itemCid: usedItem.itemCid,
    targetBoxId: normalizeTargetBoxId(options.targetBoxId)
  };
  const afterUse = withSimItemState(state, bidKingUseSimSelectItem(state, usedItem.itemUid).state);
  const activeUseTrigger = bidKingApplySimSkillTriggerEvent(afterUse, { event: 'active_use' }, {
    ...options,
    sources: [{
      itemCid: usedItem.itemCid,
      itemUid: usedItem.itemUid,
      itemCount: 1,
      kind: 'sim_select'
    }]
  });
  const sourceItemTypeId = bidKingPrimaryItemTypeId(usedItem.itemCid);
  const useItemTrigger = bidKingApplySimSkillTriggerEvent(activeUseTrigger.state, {
    event: 'use_sim_item',
    sourceItemTypeId
  }, options);
  const depletedTrigger = bidKingApplySimSkillTriggerEvent(useItemTrigger.state, {
    event: 'sim_item_depleted',
    sourceItemTypeId
  }, options);

  return {
    state: depletedTrigger.state,
    request,
    updateBoundary: simUseTrainingItemUpdateBoundary(129),
    activeUseTrigger,
    useItemTrigger,
    depletedTrigger
  };
}

export function bidKingUseSimTrainingBuffItem(
  state: BidKingSimTrainingState,
  itemCid: number,
  options: Omit<BidKingApplySimSkillTriggerEventOptions, 'sources'> & { targetBoxId?: number } = {}
): BidKingUseSimTrainingItemResult {
  const buffItem = state.simBuffItemList.find((entry) => entry.itemCid === itemCid);
  if (!buffItem) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'missing_sim_buff_item'
    };
  }
  if (!bidKingSimBuffItemHasActiveSkill(buffItem.itemCid)) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'buff_item_not_active'
    };
  }
  if (buffItem.cd !== 0) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'buff_item_on_cooldown'
    };
  }
  if (!bidKingCanUseSimBuffItem(buffItem)) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'insufficient_buff_power'
    };
  }
  if (bidKingSimTrainingItemRequiresTargetBox(buffItem.itemCid) && options.targetBoxId === undefined) {
    return {
      state: cloneSimTrainingState(state),
      failure: 'missing_target_box'
    };
  }

  const request: BidKingSimUseTrainingItemProtocolRequest = {
    protocolId: 156,
    protocolName: 'C2S_156_sim_game_use_buff_item',
    itemCid: buffItem.itemCid,
    targetBoxId: normalizeTargetBoxId(options.targetBoxId)
  };
  const afterUse = withSimItemState(state, bidKingUseSimBuffItem(state, buffItem.itemCid).state);
  const activeUseTrigger = bidKingApplySimSkillTriggerEvent(afterUse, { event: 'active_use' }, {
    ...options,
    sources: [{
      itemCid: buffItem.itemCid,
      itemCount: 1,
      kind: 'sim_buff'
    }]
  });
  const useItemTrigger = bidKingApplySimSkillTriggerEvent(activeUseTrigger.state, {
    event: 'use_sim_item',
    sourceItemTypeId: bidKingPrimaryItemTypeId(buffItem.itemCid)
  }, options);

  return {
    state: useItemTrigger.state,
    request,
    updateBoundary: simUseTrainingItemUpdateBoundary(157),
    activeUseTrigger,
    useItemTrigger
  };
}

export function bidKingSimTrainingBidPriceRequest(price: number): BidKingSimTrainingBidPriceRequest {
  return {
    protocolId: 126,
    protocolName: 'C2S_126_sim_game_bid_price',
    price: Math.max(0, Math.floor(price))
  };
}

export function bidKingSimTrainingGameLogRefreshRequest(): BidKingSimTrainingGameLogRequest {
  return {
    protocolId: 130,
    protocolName: 'C2S_130_get_sim_game_log'
  };
}

export function bidKingApplySimTrainingGameLogRefresh(
  state: BidKingSimTrainingState,
  simGameLog: BidKingSimGameLogSnapshot
): BidKingApplySimTrainingGameLogRefreshResult {
  return {
    state: bidKingApplySimGameLogRefresh(state, simGameLog),
    request: bidKingSimTrainingGameLogRefreshRequest(),
    updateBoundary: simTrainingGameLogBoundary()
  };
}

export function bidKingSimTrainingTestSkillCastRequest(
  request: BidKingSimTrainingTestSkillCastRequestInput
): BidKingSimTrainingTestSkillCastRequest {
  return {
    protocolId: 290,
    protocolName: 'C2S_290_test_game_cast_skill',
    gameUid: request.gameUid ?? '',
    itemCid: intOrZero(request.itemCid),
    skillCid: intOrZero(request.skillCid),
    heroCid: intOrZero(request.heroCid),
    mapCid: intOrZero(request.mapCid)
  };
}

export function bidKingApplySimTrainingTestSkillCastResponse(
  state: BidKingSimTrainingState,
  response: BidKingSimTrainingTestSkillCastResponse,
  options: BidKingApplySimTrainingTestSkillCastResponseOptions = {}
): BidKingApplySimTrainingTestSkillCastResponseResult {
  const itemSkillLog = cloneGameSkillLogs(response.itemSkillLog ?? []);
  const heroSkillLog = cloneGameSkillLogs(response.heroSkillLog ?? []);
  const mapSkillLog = cloneGameSkillLogs(response.mapSkillLog ?? []);
  const skillLog = cloneGameSkillLogs(response.skillLog ?? []);

  return {
    state: response.newGameData
      ? bidKingApplySimGameDataUpdate(state, response.newGameData, options.playerId)
      : cloneSimTrainingState(state),
    updateBoundary: simTrainingTestSkillCastBoundary(),
    playedSkillLogs: [
      ...itemSkillLog,
      ...heroSkillLog,
      ...mapSkillLog,
      ...skillLog
    ],
    itemSkillLog,
    heroSkillLog,
    mapSkillLog,
    skillLog
  };
}

export function bidKingSimTrainingGameOverResult(
  state: BidKingSimTrainingState,
  isWin: boolean,
  price: number,
  options: BidKingSimTrainingGameOverOptions = {}
): BidKingSimTrainingGameOverResult {
  const outcome: BidKingSimPostGameOutcome = isWin ? 'win' : 'loss';
  const rewardOperations = [
    ...(options.rewardOperations ? [...options.rewardOperations] : []),
    ...(options.rewardSkillIds
      ? bidKingSystemEffectOperationsForSkillIds([...options.rewardSkillIds])
      : [])
  ];
  return {
    state: cloneSimTrainingState(state),
    updateBoundary: simTrainingGameOverBoundary(),
    outcome,
    isWin,
    finalPrice: Math.max(0, Math.floor(price)),
    rewardPlans: rewardOperations.flatMap((operation) => bidKingSimPostGameRewardsForOperation(operation, outcome))
  };
}

export function bidKingSimTrainingWinItemChoiceRequest(
  itemCid: number,
  discardItemUid = 0
): BidKingSimTrainingWinItemChoiceRequest {
  return {
    protocolId: 134,
    protocolName: 'C2S_134_sim_game_select_win_item',
    itemCid: Math.max(0, Math.floor(itemCid)),
    discardItemUid: Math.max(0, Math.floor(discardItemUid))
  };
}

export function bidKingApplySimTrainingWinItemChoice(
  state: BidKingSimTrainingState,
  itemCid: number,
  options: { discardItemUid?: number } = {}
): BidKingApplySimTrainingWinItemChoiceResult {
  const chosen = bidKingChooseGameWinItem(state, itemCid);
  if (chosen.failure) {
    return {
      state: chosen.state,
      failure: chosen.failure
    };
  }
  return {
    state: chosen.state,
    request: bidKingSimTrainingWinItemChoiceRequest(itemCid, options.discardItemUid),
    updateBoundary: simTrainingWinItemChoiceBoundary(),
    chosenItemCid: chosen.chosenItemCid
  };
}

export function bidKingApplySimTrainingNextRoundGameData(
  state: BidKingSimTrainingState,
  nextRoundGameData: BidKingGameDataSnapshot,
  options: BidKingApplySimTrainingNextRoundOptions = {}
): BidKingApplySimTrainingNextRoundResult {
  const syncedState = bidKingApplySimGameDataUpdate(state, nextRoundGameData, options.playerId);
  const roundNumber = Math.max(0, Math.floor(nextRoundGameData.round));
  const roundStartTrigger = options.applyRoundStartTriggers === false
    ? undefined
    : bidKingApplySimSkillTriggerEvent(syncedState, {
        event: 'round_start',
        roundNumber
      }, options);

  return {
    state: roundStartTrigger?.state ?? syncedState,
    updateBoundary: simTrainingNextRoundBoundary(),
    roundNumber,
    nextRoundTime: nextRoundGameData.nextRoundTime,
    roundMapSkillLogs: nextRoundGameData.mapSkillLog
      .filter((log) => log.castRound === roundNumber)
      .map((log) => ({ ...log, hitBoxList: log.hitBoxList.map((box) => ({ ...box })) })),
    unplayedSkillLogs: bidKingSimTrainingUnplayedSkillLogs(nextRoundGameData, options.playedSkillUids),
    roundStartTrigger
  };
}

export function bidKingSimTrainingUnplayedSkillLogs(
  gameData: BidKingGameDataSnapshot,
  playedSkillUids: Iterable<number> | undefined = []
): BidKingGameSkillDataSnapshot[] {
  const played = new Set([...playedSkillUids].map((uid) => Math.floor(uid)));
  return [
    ...gameData.mapSkillLog,
    ...gameData.heroSkillLog,
    ...gameData.itemSkillLog
  ]
    .filter((log) => !played.has(log.uid))
    .map((log) => cloneGameSkillLog(log))
    .sort((left, right) => left.castTime - right.castTime);
}

export function bidKingSimTrainingNoPlaySkillLogs(
  gameData: BidKingGameDataSnapshot,
  playedSkillUids: Iterable<number> | undefined = []
): BidKingGameSkillDataSnapshot[] {
  const played = new Set([...playedSkillUids].map((uid) => Math.floor(uid)));
  return [
    ...gameData.itemSkillLog,
    ...gameData.mapSkillLog,
    ...gameData.heroSkillLog
  ]
    .filter((log) => !played.has(log.uid))
    .map((log) => cloneGameSkillLog(log));
}

export function bidKingSimTrainingItemRequiresTargetBox(itemCid: number): boolean {
  const item = itemById(itemCid);
  if (!item) {
    return false;
  }
  return item.skills.some((skillId) => {
    const skill = skillById(skillId);
    return Boolean(skill && (
      skill.skilltarget === 8 || skill.skilltarget2 === 8 || skill.skilltarget3 === 8
    ));
  });
}

export function bidKingExplicitSimSkillTriggerSources(
  itemCids: Iterable<number>
): BidKingSimSkillTriggerSource[] {
  return [...itemCids].map((itemCid) => ({
    itemCid,
    itemCount: 1,
    kind: 'explicit'
  }));
}

function triggerContextForProfile(
  profile: BidKingSimSkillTriggerProfile,
  context: BidKingSimSkillTriggerContext,
  options: BidKingApplySimSkillTriggerEventOptions
): BidKingSimSkillTriggerContext {
  const chanceRollPerMille = options.chanceRollsPerSkillId?.[profile.skillId] ?? context.chanceRollPerMille;
  return chanceRollPerMille === undefined ? context : { ...context, chanceRollPerMille };
}

function hasRequiredTriggerContext(
  profile: BidKingSimSkillTriggerProfile,
  context: BidKingSimSkillTriggerContext
): boolean {
  if (profile.acceptedRounds && !profile.acceptedRounds.includes(0) && context.roundNumber === undefined) {
    return false;
  }
  if (profile.acceptedSourceItemTypeIds && context.sourceItemTypeId === undefined) {
    return false;
  }
  const hasTargetItemType = context.targetItemTypeId !== undefined || (context.targetItemTypeIds?.length ?? 0) > 0;
  if (profile.acceptedTargetItemTypeIds && !hasTargetItemType) {
    return false;
  }
  return true;
}

function isLocallyAppliedSimOperation(operation: BidKingSystemEffectOperation): boolean {
  return operation.kind === 'gain_sim_item'
    || operation.kind === 'discard_sim_item'
    || operation.kind === 'charge_sim_buff_item';
}

function cloneSimTrainingState(state: BidKingSimTrainingState): BidKingSimTrainingState {
  const next: BidKingSimTrainingState = {
    simGold: state.simGold,
    gameWinItemList: [...state.gameWinItemList],
    simShopStatus: state.simShopStatus
      ? {
          ...state.simShopStatus,
          shopItemList: state.simShopStatus.shopItemList.map((entry) => ({ ...entry }))
        }
      : undefined,
    simSelectItemList: state.simSelectItemList.map((entry) => ({ ...entry })),
    simBuffItemList: state.simBuffItemList.map((entry) => ({ ...entry }))
  };
  if (state.simGameData !== undefined) {
    next.simGameData = cloneGameDataSnapshot(state.simGameData);
  }
  if (state.maxWinLevel !== undefined) {
    next.maxWinLevel = state.maxWinLevel;
  }
  if (state.level !== undefined) {
    next.level = state.level;
  }
  if (state.selectItemCount !== undefined) {
    next.selectItemCount = state.selectItemCount;
  }
  if (state.roundCanUseItemCount !== undefined) {
    next.roundCanUseItemCount = state.roundCanUseItemCount;
  }
  if (state.gameCarryItemMax !== undefined) {
    next.gameCarryItemMax = state.gameCarryItemMax;
  }
  if (state.gameGoldRateMax !== undefined) {
    next.gameGoldRateMax = state.gameGoldRateMax;
  }
  return next;
}

function withSimItemState(
  state: BidKingSimTrainingState,
  itemState: Pick<BidKingSimTrainingState, 'simSelectItemList' | 'simBuffItemList'>
): BidKingSimTrainingState {
  return {
    ...cloneSimTrainingState(state),
    simSelectItemList: itemState.simSelectItemList.map((entry) => ({ ...entry })),
    simBuffItemList: itemState.simBuffItemList.map((entry) => ({ ...entry }))
  };
}

function bidKingPrimaryItemTypeId(itemCid: number): number | undefined {
  const item = itemById(itemCid);
  if (!item) {
    return undefined;
  }
  return item.item_type_ids[0] ?? (item.item_type_id > 0 ? item.item_type_id : undefined);
}

function cloneGameDataSnapshot(
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
        heroSkillLog: cloneGameSkillLogs(gameData.heroSkillLog),
        mapSkillLog: cloneGameSkillLogs(gameData.mapSkillLog),
        itemSkillLog: cloneGameSkillLogs(gameData.itemSkillLog)
      }
    : undefined;
}

function cloneGameSkillLogs(
  skillLogs: readonly BidKingGameSkillDataSnapshot[]
): BidKingGameSkillDataSnapshot[] {
  return skillLogs.map((log) => cloneGameSkillLog(log));
}

function cloneGameSkillLog(log: BidKingGameSkillDataSnapshot): BidKingGameSkillDataSnapshot {
  return {
    ...log,
    hitBoxList: log.hitBoxList.map((box) => ({
      ...box,
      itemType: [...box.itemType]
    })),
    hitItemTypeList: [...log.hitItemTypeList],
    hitItemQuilityList: [...log.hitItemQuilityList]
  };
}

function intOrZero(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

function normalizeTargetBoxId(targetBoxId: number | undefined): number {
  return Math.max(0, Math.floor(targetBoxId ?? 0));
}

function simUseTrainingItemUpdateBoundary(
  responseProtocolId: 129 | 157
): BidKingSimUseTrainingItemUpdateBoundary {
  return responseProtocolId === 129
    ? {
        responseProtocolId,
        responseProtocolName: 'S2C_129_sim_game_use_item',
        responseFields: ['ErrorCode', 'UpdateGameData'],
        updateGameDataField: 'UpdateGameData',
        syncMethod: 'PlayerGameData.UpdateSimGameData',
        skillLogSource: 'GetNoPlaySkills(simGameLog.GameData)',
        skillLogOrder: ['ItemSkillLog', 'MapSkillLog', 'HeroSkillLog'],
        skillLogSort: false,
        skillLogGeneratedBy: 'server'
      }
    : {
        responseProtocolId,
        responseProtocolName: 'S2C_157_sim_game_use_buff_item',
        responseFields: ['ErrorCode', 'UpdateGameData'],
        updateGameDataField: 'UpdateGameData',
        syncMethod: 'PlayerGameData.UpdateSimGameData',
        skillLogSource: 'GetNoPlaySkills(simGameLog.GameData)',
        skillLogOrder: ['ItemSkillLog', 'MapSkillLog', 'HeroSkillLog'],
        skillLogSort: false,
        skillLogGeneratedBy: 'server'
      };
}

function simTrainingNextRoundBoundary(): BidKingSimTrainingNextRoundBoundary {
  return {
    responseProtocolId: 127,
    responseProtocolName: 'S2C_127_sim_game_bid_price',
    isNextRoundField: 'IsNextRound',
    nextRoundGameDataField: 'NextRoundGameData',
    syncMethod: 'PlayerGameData.UpdateSimGameData',
    roundStartMethod: 'Battle_Handler.S2C_OnRoundStartOnTraining2',
    skillLogSource: 'MapSkillLog + HeroSkillLog + ItemSkillLog',
    skillLogOrder: ['MapSkillLog', 'HeroSkillLog', 'ItemSkillLog'],
    skillLogSort: 'CastTime'
  };
}

function simTrainingTestSkillCastBoundary(): BidKingSimTrainingTestSkillCastBoundary {
  return {
    responseProtocolId: 291,
    responseProtocolName: 'S2C_291_test_game_cast_skill',
    responseFields: [
      'ErrorCode',
      'ItemSkillLog',
      'NewGameData',
      'HeroSkillLog',
      'MapSkillLog',
      'SkillLog'
    ],
    playOrder: ['ItemSkillLog', 'HeroSkillLog', 'MapSkillLog', 'SkillLog'],
    newGameDataField: 'NewGameData',
    generatedBy: 'server'
  };
}

function simTrainingGameLogBoundary(): BidKingSimTrainingGameLogBoundary {
  return {
    responseProtocolId: 131,
    responseProtocolName: 'S2C_131_get_sim_game_log',
    assignmentMethod: 'PlayerGameData.InitSimGame',
    replaceMode: 'simGameLog = GetSimGameLog()',
    authoritativeFields: [
      'MaxWinLevel',
      'SimGold',
      'GameWinItemList',
      'SimShopStatus',
      'GameData',
      'Level',
      'SimSelectItemList',
      'SimBuffItemList',
      'SelectItemCount',
      'RoundCanUseItemCount',
      'GameCarryItemMax',
      'GameGoldRateMax'
    ]
  };
}

function simTrainingGameOverBoundary(): BidKingSimTrainingGameOverBoundary {
  return {
    responseProtocolId: 127,
    responseProtocolName: 'S2C_127_sim_game_bid_price',
    isNextRoundField: 'IsNextRound',
    isWinField: 'IsWin',
    nextRoundGameDataConsumed: false,
    gameOverMethod: 'Battle_Handler.S2C_OnGameOver',
    refreshMethod: 'Battle_Main.Training: PlayerGameData.InitSimGame',
    winItemChoiceMethod: 'ChooseEffect_Main.Choose -> PlayerManager.ChooseSpecialItem'
  };
}

function simTrainingWinItemChoiceBoundary(): BidKingSimTrainingWinItemChoiceBoundary {
  return {
    responseProtocolId: 135,
    responseProtocolName: 'S2C_135_sim_game_select_win_item',
    responseFields: ['ErrorCode'],
    successRefreshMethod: 'PlayerGameData.InitSimGame',
    candidateSource: 'S2C_131_get_sim_game_log.GameWinItemList',
    chooseUi: 'ChooseEffect_Main.Choose'
  };
}

export type { BidKingSimSkillTriggerContext, BidKingSimSkillTriggerEvent };
