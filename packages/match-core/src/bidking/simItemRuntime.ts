import { ShopItem, Sim, dropsForGroup, itemById, skillById } from '@bitkingdom/bidking-compat';
import type { BidKingDropItemRow, BidKingShopItemRow } from '@bitkingdom/bidking-compat';
import type {
  BidKingGameDataSnapshot,
  BidKingShopItemDataSnapshot,
  BidKingShopStatusDataSnapshot,
  BidKingSimGameLogSnapshot,
  BidKingUserSimBuffItemDataSnapshot,
  BidKingUserSimSelectGameItemDataSnapshot
} from '@bitkingdom/shared';
import type { RuntimePlayer } from '../types';
import type { BidKingSystemEffectOperation } from './systemEffectRuntime';
import type { BidKingRewardPlan } from './reward/rewardEngine';

export interface BidKingSimItemState {
  simSelectItemList: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList: BidKingUserSimBuffItemDataSnapshot[];
}

export interface BidKingSimTrainingState extends BidKingSimItemState {
  simGold: number;
  gameWinItemList: number[];
  simShopStatus?: BidKingShopStatusDataSnapshot;
  simGameData?: BidKingGameDataSnapshot;
  maxWinLevel?: number;
  level?: number;
  selectItemCount?: number;
  roundCanUseItemCount?: number;
  gameCarryItemMax?: number;
  gameGoldRateMax?: number;
}

export interface BidKingApplySimSystemEffectOptions {
  sourceItemCid?: number;
}

export interface BidKingBuySimShopItemOptions {
  gameCarryItemMax?: number;
  discardItemUid?: number;
}

export type BidKingBuySimShopItemFailure =
  | 'missing_shop_status'
  | 'missing_shop_item'
  | 'missing_shop_item_row'
  | 'sold_out'
  | 'buy_count_not_enough'
  | 'insufficient_gold'
  | 'carry_full';

export interface BidKingBuySimShopItemResult {
  state: BidKingSimTrainingState;
  purchasedItem?: BidKingUserSimSelectGameItemDataSnapshot;
  shopItem?: BidKingShopItemDataSnapshot;
  cost?: number;
  failure?: BidKingBuySimShopItemFailure;
}

export type BidKingChooseGameWinItemFailure = 'missing_item';

export interface BidKingChooseGameWinItemResult {
  state: BidKingSimTrainingState;
  chosenItemCid?: number;
  failure?: BidKingChooseGameWinItemFailure;
}

export type BidKingSimPostGameOutcome = 'win' | 'loss';

export interface BidKingSimItemStateModeChange {
  stateMode: number;
}

export interface BidKingSimHeroSkillCastRequest {
  gameUid?: string;
  itemCid?: number;
  skillCid: number;
  heroCid?: number;
  mapCid?: number;
  mode: 'specified_skin' | 'random_other_hero';
}

export interface BidKingSimHeroSkillCastRequestOptions {
  gameUid?: string;
  itemCid?: number;
  mapCid?: number;
  roundIndex?: number;
  randomHeroCid?: number;
  randomHeroSkillIds?: readonly number[];
}

export interface BidKingSimGameWinItemCandidatePool {
  level: number;
  simDropGroupId: number;
  candidateItemCids: number[];
  dropItems: BidKingDropItemRow[];
  tableSource: 'Table_Sim.simdorp -> Table_Drop.items_list';
  authoritativeField: 'S2C_131_get_sim_game_log.GameWinItemList';
  generationAuthority: 'server';
}

export function bidKingSimItemStateForPlayer(player: RuntimePlayer): BidKingSimItemState {
  return {
    simSelectItemList: (player.simSelectItemList ?? player.simGameLog?.simSelectItemList ?? [])
      .map((entry) => ({ ...entry })),
    simBuffItemList: (player.simBuffItemList ?? player.simGameLog?.simBuffItemList ?? [])
      .map((entry) => ({ ...entry }))
  };
}

export function bidKingSimTrainingStateForPlayer(player: RuntimePlayer): BidKingSimTrainingState {
  const logState = player.simGameLog ? bidKingSimTrainingStateForGameLog(player.simGameLog) : undefined;
  return {
    ...(logState ?? bidKingEmptySimTrainingState()),
    ...bidKingSimItemStateForPlayer(player),
    simGold: player.simGold ?? logState?.simGold ?? 0,
    gameWinItemList: player.gameWinItemList ? [...player.gameWinItemList] : logState?.gameWinItemList ?? [],
    simShopStatus: player.simShopStatus
      ? cloneShopStatusData(player.simShopStatus)
      : cloneShopStatusData(logState?.simShopStatus)
  };
}

export function bidKingWriteSimItemStateToPlayer(player: RuntimePlayer, state: BidKingSimItemState): void {
  player.simSelectItemList = state.simSelectItemList.map((entry) => ({ ...entry }));
  player.simBuffItemList = state.simBuffItemList.map((entry) => ({ ...entry }));
}

export function bidKingWriteSimTrainingStateToPlayer(player: RuntimePlayer, state: BidKingSimTrainingState): void {
  bidKingWriteSimItemStateToPlayer(player, state);
  player.simGold = state.simGold;
  player.gameWinItemList = [...state.gameWinItemList];
  player.simShopStatus = cloneShopStatusData(state.simShopStatus);
  player.simGameLog = bidKingSimGameLogForTrainingState(state);
}

export function bidKingApplySimSystemEffectOperation(
  state: BidKingSimItemState,
  operation: BidKingSystemEffectOperation,
  options: BidKingApplySimSystemEffectOptions = {}
): BidKingSimItemState {
  const next = cloneSimItemState(state);
  if (operation.kind === 'gain_sim_item') {
    for (let index = 0; index < Math.max(0, operation.itemCount); index += 1) {
      next.simSelectItemList.push({
        itemUid: bidKingNextSimSelectItemUid(next),
        itemCid: operation.itemId
      });
    }
    return next;
  }
  if (operation.kind === 'discard_sim_item') {
    next.simSelectItemList = discardSimSelectItem(next.simSelectItemList, operation.itemId);
    return next;
  }
  if (operation.kind === 'charge_sim_buff_item') {
    const itemCid = options.sourceItemCid;
    if (!itemCid) {
      return next;
    }
    const buff = ensureSimBuffItem(next.simBuffItemList, itemCid);
    const maxPower = bidKingSimBuffItemMaxPower(itemCid);
    const delta = operation.modifier.mode === 'per_mille'
      ? Math.floor((maxPower * operation.modifier.value) / 1000)
      : operation.modifier.mode === 'flat'
        ? operation.modifier.value
        : 0;
    buff.power = clampInt(buff.power + delta, 0, maxPower);
    return next;
  }
  return next;
}

export function bidKingApplySimGameDataUpdate(
  state: BidKingSimTrainingState,
  gameData: BidKingGameDataSnapshot | undefined,
  playerId?: string
): BidKingSimTrainingState {
  const next = cloneSimTrainingState(state);
  next.simGameData = cloneGameDataSnapshot(gameData);
  const userLog = playerId
    ? gameData?.userLog.find((entry) => entry.playerId === playerId)
    : gameData?.userLog[0];
  if (!userLog) {
    return next;
  }
  next.simSelectItemList = userLog.simSelectItemList.map((entry) => ({ ...entry }));
  next.simBuffItemList = userLog.simBuffItemList.map((entry) => ({ ...entry }));
  return next;
}

export function bidKingSimTrainingStateForGameLog(
  simGameLog: BidKingSimGameLogSnapshot
): BidKingSimTrainingState {
  return {
    simGold: Math.max(0, Math.floor(simGameLog.simGold)),
    gameWinItemList: simGameLog.gameWinItemList.map((itemCid) => Math.max(0, Math.floor(itemCid))),
    simShopStatus: cloneShopStatusData(simGameLog.simShopStatus),
    simGameData: cloneGameDataSnapshot(simGameLog.gameData),
    maxWinLevel: Math.max(0, Math.floor(simGameLog.maxWinLevel)),
    level: Math.max(0, Math.floor(simGameLog.level)),
    simSelectItemList: simGameLog.simSelectItemList.map((entry) => ({ ...entry })),
    simBuffItemList: simGameLog.simBuffItemList.map((entry) => ({ ...entry })),
    selectItemCount: Math.max(0, Math.floor(simGameLog.selectItemCount)),
    roundCanUseItemCount: Math.max(0, Math.floor(simGameLog.roundCanUseItemCount)),
    gameCarryItemMax: Math.max(0, Math.floor(simGameLog.gameCarryItemMax)),
    gameGoldRateMax: Math.max(0, Math.floor(simGameLog.gameGoldRateMax))
  };
}

export function bidKingApplySimGameLogRefresh(
  state: BidKingSimTrainingState,
  simGameLog: BidKingSimGameLogSnapshot
): BidKingSimTrainingState {
  return {
    ...cloneSimTrainingState(state),
    ...bidKingSimTrainingStateForGameLog(simGameLog)
  };
}

export function bidKingSimGameLogForTrainingState(
  state: BidKingSimTrainingState
): BidKingSimGameLogSnapshot {
  return {
    maxWinLevel: Math.max(0, Math.floor(state.maxWinLevel ?? 0)),
    simGold: Math.max(0, Math.floor(state.simGold)),
    gameWinItemList: state.gameWinItemList.map((itemCid) => Math.max(0, Math.floor(itemCid))),
    simShopStatus: cloneShopStatusData(state.simShopStatus),
    gameData: cloneGameDataSnapshot(state.simGameData),
    level: Math.max(0, Math.floor(state.level ?? 0)),
    simSelectItemList: state.simSelectItemList.map((entry) => ({ ...entry })),
    simBuffItemList: state.simBuffItemList.map((entry) => ({ ...entry })),
    selectItemCount: Math.max(0, Math.floor(state.selectItemCount ?? state.simSelectItemList.length)),
    roundCanUseItemCount: Math.max(0, Math.floor(state.roundCanUseItemCount ?? 0)),
    gameCarryItemMax: Math.max(0, Math.floor(state.gameCarryItemMax ?? 0)),
    gameGoldRateMax: Math.max(0, Math.floor(state.gameGoldRateMax ?? 0))
  };
}

export function bidKingSimGameWinItemDropGroupIdForLevel(level: number): number | undefined {
  const row = simRowForLevel(level);
  if (!row) {
    return undefined;
  }
  const dropGroupId = Number.parseInt(row.columns[5] ?? '', 10);
  return Number.isFinite(dropGroupId) && dropGroupId > 0 ? dropGroupId : undefined;
}

export function bidKingSimGameWinItemCandidatePoolForLevel(
  level: number
): BidKingSimGameWinItemCandidatePool | undefined {
  const safeLevel = Math.max(0, Math.floor(level));
  const simDropGroupId = bidKingSimGameWinItemDropGroupIdForLevel(safeLevel);
  if (!simDropGroupId) {
    return undefined;
  }
  const dropItems = dropsForGroup(simDropGroupId);
  return {
    level: safeLevel,
    simDropGroupId,
    candidateItemCids: dropItems.map((entry) => entry.item_id),
    dropItems: dropItems.map((entry) => ({ ...entry })),
    tableSource: 'Table_Sim.simdorp -> Table_Drop.items_list',
    authoritativeField: 'S2C_131_get_sim_game_log.GameWinItemList',
    generationAuthority: 'server'
  };
}

export function bidKingSimPostGameRewardsForOperation(
  operation: BidKingSystemEffectOperation,
  outcome: BidKingSimPostGameOutcome
): BidKingRewardPlan[] {
  if (operation.kind !== 'post_game_reward' || operation.outcome !== outcome) {
    return [];
  }
  const refId = Math.max(0, Math.floor(operation.rewardTypeId));
  const quantity = Math.max(0, Math.floor(operation.rewardValue));
  if (!refId || quantity <= 0) {
    return [];
  }
  return [{
    resource: refId === 1 ? 'coins' : 'item',
    rewardType: refId === 1 ? 1 : 0,
    refId,
    quantity,
    inventoryType: refId === 1 ? 'coins' : 'item'
  }];
}

export function bidKingSimPostGameRewardsForOperations(
  operations: Iterable<BidKingSystemEffectOperation>,
  outcome: BidKingSimPostGameOutcome
): BidKingRewardPlan[] {
  return [...operations].flatMap((operation) => bidKingSimPostGameRewardsForOperation(operation, outcome));
}

export function bidKingSimItemStateModeChangeForOperation(
  operation: BidKingSystemEffectOperation
): BidKingSimItemStateModeChange | undefined {
  return operation.kind === 'change_sim_item_state'
    ? { stateMode: operation.stateMode }
    : undefined;
}

export function bidKingSimHeroSkillCastRequestsForOperation(
  operation: BidKingSystemEffectOperation,
  options: BidKingSimHeroSkillCastRequestOptions = {}
): BidKingSimHeroSkillCastRequest[] {
  if (operation.kind !== 'use_hero_skill') {
    return [];
  }
  const heroCid = operation.mode === 'specified_skin' ? operation.heroCid : options.randomHeroCid;
  const heroSkillIds = operation.mode === 'specified_skin'
    ? operation.heroSkillIds
    : options.randomHeroSkillIds ?? [];
  const skillCid = heroSkillIdForRound(heroSkillIds, options.roundIndex ?? 0);
  if (!skillCid) {
    return [];
  }
  return [{
    gameUid: options.gameUid,
    itemCid: options.itemCid,
    skillCid,
    heroCid,
    mapCid: options.mapCid,
    mode: operation.mode
  }];
}

export function bidKingSimShopItemsSorted(
  shopStatus: BidKingShopStatusDataSnapshot | undefined
): BidKingShopItemDataSnapshot[] {
  return (shopStatus?.shopItemList ?? [])
    .map((entry) => ({ ...entry }))
    .sort(compareSimShopItemData);
}

export function bidKingSimShopItemCost(shopItemData: BidKingShopItemDataSnapshot): number {
  const row = bidKingShopItemRow(shopItemData.shopItemCid);
  const baseCost = row?.price[0]?.[1] ?? 0;
  const discountRate = Math.max(0, Math.floor(shopItemData.discountRate));
  return Math.floor((Math.max(0, baseCost) * discountRate) / 1000);
}

export function bidKingSimShopRemainingBuyCount(shopItemData: BidKingShopItemDataSnapshot): number {
  if (shopItemData.canBuyCount === 0) {
    return 5;
  }
  return Math.max(0, shopItemData.canBuyCount - shopItemData.buyCount);
}

export function bidKingCanBuySimShopItem(
  state: BidKingSimTrainingState,
  shopItemUid: number,
  options: BidKingBuySimShopItemOptions = {}
): { canBuy: boolean; failure?: BidKingBuySimShopItemFailure; cost?: number } {
  const resolved = resolveSimShopBuy(state, shopItemUid, options);
  return {
    canBuy: !resolved.failure,
    failure: resolved.failure,
    cost: resolved.cost
  };
}

export function bidKingBuySimShopItem(
  state: BidKingSimTrainingState,
  shopItemUid: number,
  options: BidKingBuySimShopItemOptions = {}
): BidKingBuySimShopItemResult {
  const next = cloneSimTrainingState(state);
  const resolved = resolveSimShopBuy(next, shopItemUid, options);
  if (resolved.failure) {
    return {
      state: next,
      failure: resolved.failure,
      cost: resolved.cost
    };
  }

  const purchasedItem = {
    itemUid: resolved.shopItem.itemUid,
    itemCid: resolved.purchasedItemCid
  };
  if (next.simSelectItemList.length >= resolved.gameCarryItemMax && options.discardItemUid) {
    next.simSelectItemList = discardSimSelectItemByUid(next.simSelectItemList, options.discardItemUid);
  }
  next.simSelectItemList.push(purchasedItem);
  next.simGold = Math.max(0, next.simGold - resolved.cost);
  resolved.shopItem.buyCount += 1;

  return {
    state: next,
    purchasedItem,
    shopItem: { ...resolved.shopItem },
    cost: resolved.cost
  };
}

export function bidKingChooseGameWinItem(
  state: BidKingSimTrainingState,
  itemCid: number
): BidKingChooseGameWinItemResult {
  const next = cloneSimTrainingState(state);
  const index = next.gameWinItemList.indexOf(itemCid);
  if (index < 0) {
    return {
      state: next,
      failure: 'missing_item'
    };
  }
  next.gameWinItemList.splice(index, 1);
  return {
    state: next,
    chosenItemCid: itemCid
  };
}

export function bidKingUseSimSelectItem(
  state: BidKingSimItemState,
  itemUid: number
): { state: BidKingSimItemState; usedItem?: BidKingUserSimSelectGameItemDataSnapshot } {
  const next = cloneSimItemState(state);
  const index = next.simSelectItemList.findIndex((entry) => entry.itemUid === itemUid);
  if (index < 0) {
    return { state: next };
  }
  const [usedItem] = next.simSelectItemList.splice(index, 1);
  return {
    state: next,
    usedItem
  };
}

export function bidKingUseSimBuffItem(
  state: BidKingSimItemState,
  itemCid: number
): { state: BidKingSimItemState; usedBuff?: BidKingUserSimBuffItemDataSnapshot } {
  const next = cloneSimItemState(state);
  const buff = next.simBuffItemList.find((entry) => entry.itemCid === itemCid);
  if (!buff || !bidKingCanUseSimBuffItem(buff)) {
    return { state: next };
  }
  const usedBuff = { ...buff };
  buff.power = Math.max(0, buff.power - bidKingSimBuffItemUseCost(itemCid));
  return {
    state: next,
    usedBuff
  };
}

export function bidKingCanUseSimBuffItem(buffItem: BidKingUserSimBuffItemDataSnapshot): boolean {
  if (!bidKingSimBuffItemHasActiveSkill(buffItem.itemCid)) {
    return false;
  }
  if (buffItem.cd !== 0) {
    return false;
  }
  return buffItem.power >= bidKingSimBuffItemUseCost(buffItem.itemCid);
}

export function bidKingSimBuffItemHasActiveSkill(itemCid: number): boolean {
  const item = itemById(itemCid);
  return Boolean(item?.skills.some((skillId) => skillById(skillId)?.skill_active_type === 1));
}

export function bidKingSimBuffItemMaxPower(itemCid: number): number {
  const cost = itemById(itemCid)?.cost ?? [];
  return Math.max(0, Math.floor(cost[1] ?? 0));
}

export function bidKingSimBuffItemUseCost(itemCid: number): number {
  const cost = itemById(itemCid)?.cost ?? [];
  return Math.max(0, Math.floor(cost[2] ?? 0));
}

export function bidKingNextSimSelectItemUid(state: BidKingSimItemState): number {
  const maxUid = state.simSelectItemList.reduce((max, entry) => Math.max(max, entry.itemUid), 0);
  return maxUid + 1;
}

function cloneSimItemState(state: BidKingSimItemState): BidKingSimItemState {
  return {
    simSelectItemList: state.simSelectItemList.map((entry) => ({ ...entry })),
    simBuffItemList: state.simBuffItemList.map((entry) => ({ ...entry }))
  };
}

function cloneSimTrainingState(state: BidKingSimTrainingState): BidKingSimTrainingState {
  return {
    ...cloneSimItemState(state),
    simGold: state.simGold,
    gameWinItemList: [...state.gameWinItemList],
    simShopStatus: cloneShopStatusData(state.simShopStatus),
    simGameData: cloneGameDataSnapshot(state.simGameData),
    maxWinLevel: state.maxWinLevel,
    level: state.level,
    selectItemCount: state.selectItemCount,
    roundCanUseItemCount: state.roundCanUseItemCount,
    gameCarryItemMax: state.gameCarryItemMax,
    gameGoldRateMax: state.gameGoldRateMax
  };
}

function bidKingEmptySimTrainingState(): BidKingSimTrainingState {
  return {
    simGold: 0,
    gameWinItemList: [],
    simShopStatus: undefined,
    simGameData: undefined,
    maxWinLevel: undefined,
    level: undefined,
    selectItemCount: undefined,
    roundCanUseItemCount: undefined,
    gameCarryItemMax: undefined,
    gameGoldRateMax: undefined,
    simSelectItemList: [],
    simBuffItemList: []
  };
}

function cloneShopStatusData(
  shopStatus: BidKingShopStatusDataSnapshot | undefined
): BidKingShopStatusDataSnapshot | undefined {
  return shopStatus
    ? {
        ...shopStatus,
        shopItemList: shopStatus.shopItemList.map((entry) => ({ ...entry }))
      }
    : undefined;
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
  skillLogs: BidKingGameDataSnapshot['heroSkillLog']
): BidKingGameDataSnapshot['heroSkillLog'] {
  return skillLogs.map((log) => ({
    ...log,
    hitBoxList: log.hitBoxList.map((box) => ({
      ...box,
      itemType: [...box.itemType]
    })),
    hitItemTypeList: [...log.hitItemTypeList],
    hitItemQuilityList: [...log.hitItemQuilityList]
  }));
}

function resolveSimShopBuy(
  state: BidKingSimTrainingState,
  shopItemUid: number,
  options: BidKingBuySimShopItemOptions
): {
  shopItem: BidKingShopItemDataSnapshot;
  purchasedItemCid: number;
  cost: number;
  gameCarryItemMax: number;
  failure?: BidKingBuySimShopItemFailure;
} {
  const gameCarryItemMax = Math.max(0, Math.floor(options.gameCarryItemMax ?? 3));
  const missingShopItem = {
    shopItem: emptyShopItemData(shopItemUid),
    purchasedItemCid: 0,
    cost: 0,
    gameCarryItemMax
  };
  if (!state.simShopStatus) {
    return {
      ...missingShopItem,
      failure: 'missing_shop_status'
    };
  }
  const shopItem = state.simShopStatus.shopItemList.find((entry) => entry.itemUid === shopItemUid);
  if (!shopItem) {
    return {
      ...missingShopItem,
      failure: 'missing_shop_item'
    };
  }
  const row = bidKingShopItemRow(shopItem.shopItemCid);
  if (!row) {
    return {
      shopItem,
      purchasedItemCid: 0,
      cost: 0,
      gameCarryItemMax,
      failure: 'missing_shop_item_row'
    };
  }
  const purchasedItemCid = Math.max(0, Math.floor(row.itemid[0]?.[0] ?? 0));
  const cost = bidKingSimShopItemCost(shopItem);
  if (shopItem.canBuyCount !== 0 && shopItem.buyCount >= shopItem.canBuyCount) {
    return {
      shopItem,
      purchasedItemCid,
      cost,
      gameCarryItemMax,
      failure: 'sold_out'
    };
  }
  if (bidKingSimShopRemainingBuyCount(shopItem) < 1) {
    return {
      shopItem,
      purchasedItemCid,
      cost,
      gameCarryItemMax,
      failure: 'buy_count_not_enough'
    };
  }
  if (state.simGold < cost) {
    return {
      shopItem,
      purchasedItemCid,
      cost,
      gameCarryItemMax,
      failure: 'insufficient_gold'
    };
  }
  if (
    state.simSelectItemList.length >= gameCarryItemMax &&
    !state.simSelectItemList.some((entry) => entry.itemUid === options.discardItemUid)
  ) {
    return {
      shopItem,
      purchasedItemCid,
      cost,
      gameCarryItemMax,
      failure: 'carry_full'
    };
  }
  return {
    shopItem,
    purchasedItemCid,
    cost,
    gameCarryItemMax
  };
}

function compareSimShopItemData(
  left: BidKingShopItemDataSnapshot,
  right: BidKingShopItemDataSnapshot
): number {
  const leftRow = bidKingShopItemRow(left.shopItemCid);
  const rightRow = bidKingShopItemRow(right.shopItemCid);
  const leftOrder = leftRow?.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = rightRow?.order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (left.shopItemCid !== right.shopItemCid) {
    return left.shopItemCid - right.shopItemCid;
  }
  if (left.discountRate !== right.discountRate) {
    return left.discountRate - right.discountRate;
  }
  return left.itemUid === right.itemUid ? 0 : left.itemUid > right.itemUid ? 1 : -1;
}

function bidKingShopItemRow(shopItemCid: number): BidKingShopItemRow | undefined {
  return ShopItem.find((row) => row.id === shopItemCid);
}

function emptyShopItemData(itemUid: number): BidKingShopItemDataSnapshot {
  return {
    itemUid,
    shopItemCid: 0,
    canBuyCount: 0,
    buyCount: 0,
    discountRate: 0
  };
}

function simRowForLevel(level: number): (typeof Sim)[number] | undefined {
  const safeLevel = Math.max(0, Math.floor(level));
  return Sim.find((row) => Number.parseInt(row.id, 10) === safeLevel);
}

function heroSkillIdForRound(skillIds: readonly number[], roundIndex: number): number | undefined {
  const safeRoundIndex = Math.max(0, Math.floor(roundIndex));
  const byRound = skillIds[safeRoundIndex];
  if (byRound && byRound > 0) {
    return byRound;
  }
  return skillIds.find((skillId) => skillId > 0);
}

function discardSimSelectItem(
  items: BidKingUserSimSelectGameItemDataSnapshot[],
  itemCid: number
): BidKingUserSimSelectGameItemDataSnapshot[] {
  const index = itemCid > 0
    ? items.findIndex((entry) => entry.itemCid === itemCid)
    : items.length > 0 ? 0 : -1;
  if (index < 0) {
    return items;
  }
  return items.filter((_, candidateIndex) => candidateIndex !== index);
}

function discardSimSelectItemByUid(
  items: BidKingUserSimSelectGameItemDataSnapshot[],
  itemUid: number
): BidKingUserSimSelectGameItemDataSnapshot[] {
  const index = items.findIndex((entry) => entry.itemUid === itemUid);
  if (index < 0) {
    return items;
  }
  return items.filter((_, candidateIndex) => candidateIndex !== index);
}

function ensureSimBuffItem(
  items: BidKingUserSimBuffItemDataSnapshot[],
  itemCid: number
): BidKingUserSimBuffItemDataSnapshot {
  const existing = items.find((entry) => entry.itemCid === itemCid);
  if (existing) {
    return existing;
  }
  const created = {
    itemCid,
    itemCount: 1,
    power: 0,
    cd: 0
  };
  items.push(created);
  return created;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}
