import { Hero, Item, Map as BidKingMap, RankAi, bidKingMapDisplayName, itemFootprint } from '@bitkingdom/bidking-compat';
import { bidKingBaseGameDataSystemLimits, bidKingBotHeroIdsForBidMap, bidKingEntrustSlotBase } from '@bitkingdom/match-core';
import type {
  BidKingGameDataSnapshot,
  BidKingGameUserDataSnapshot,
  BidKingStockBoxDataSnapshot,
  BidKingStockContainerDataSnapshot,
  PlayerProfile,
  ProfileStockBoxState,
  ProfileStockContainerState,
  ProfileTransaction,
  SendAuctionCreateResponse,
  SendAuctionDataSnapshot,
  SendAuctionGameDataSnapshot,
  SendAuctionGameListSnapshot,
  SendAuctionGameState,
  SendAuctionItemState,
  SendAuctionListSnapshot,
  SendAuctionRecycleResponse,
  SendAuctionState
} from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import { inventoryQuantity } from '../profile/profileInventory';
import { addCustomMailToProfile } from '../profile/profileMailRuntime';
import { ensureProfileShape } from '../profile/profileShape';
import {
  bidKingSourceBoxIdForProfileStockBox,
  bidKingSourceBoxPositionDataForProfilePosition,
  bidKingSourceBoxPositionForProfilePosition
} from '../profile/profileStockRuntime';

type BidKingMapRow = (typeof BidKingMap)[number];
type BidKingItemRow = (typeof Item)[number];

export interface SendAuctionItemSelectionInput {
  stockId: number;
  boxId: number;
}

type SendAuctionSelectionMode = 'runtime' | 'source';

export type SendAuctionTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type SendAuctionNumberApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins'>,
  amountChange: number
) => void;

export function createSendAuctionForProfile(
  profile: PlayerProfile,
  mapCid: number,
  itemSelections: readonly SendAuctionItemSelectionInput[],
  applyNumberChange: SendAuctionNumberApplier,
  recordTransaction: SendAuctionTransactionRecorder,
  requestedSlotId?: number,
  now = Date.now()
): SendAuctionState {
  ensureProfileShape(profile);
  const map = sendAuctionMapForId(mapCid);
  if (!map || map.is_open !== 1 || map.entrust_bidmap <= 0 || map.entrust_value <= 0) {
    throw new Error('委托地图不可送拍');
  }

  const slotBase = bidKingEntrustSlotBase();
  const activeAuctions = activeSendAuctions(profile);
  if (activeAuctions.length >= slotBase) {
    throw new Error(`委托槽位已满，当前 ${activeAuctions.length}/${slotBase}`);
  }

  const uniqueSelections = normalizeSelections(itemSelections);
  const [minCount = 0, rawMaxCount = minCount] = map.entrust_num;
  const maxCount = Math.max(minCount, rawMaxCount);
  if (uniqueSelections.length < minCount || uniqueSelections.length > maxCount) {
    throw new Error(`委托件数需在 ${minCount}-${maxCount} 件之间`);
  }

  const selectionMode = inferSendAuctionSelectionMode(profile, uniqueSelections);
  const selected = uniqueSelections.map((selection) => selectedBoxForSendAuction(profile, selection, selectionMode));
  const itemStates = selected.map(({ box, container }) => {
    const item = Item.find((candidate) => candidate.id === box.item.cid);
    if (!item) {
      throw new Error(`藏品配置不存在：${box.item.cid}`);
    }
    if (container.kind !== 'warehouse') {
      throw new Error('只能从仓库选择藏品送拍');
    }
    if (!canSendAuctionItem(item, box)) {
      throw new Error(`藏品 ${item.id} 不可委托送拍`);
    }
    return sendAuctionItemState(container.stockId, box, item);
  });

  const totalValue = itemStates.reduce((sum, item) => sum + item.value, 0);
  if (totalValue < map.entrust_value) {
    throw new Error(`委托估价不足，至少需要 ${map.entrust_value}`);
  }

  const requiredCounts = requiredInventoryCounts(itemStates);
  for (const [refId, quantity] of requiredCounts) {
    if (inventoryQuantity(profile, refId) < quantity) {
      throw new Error(`仓库库存计数不足：${refId}`);
    }
  }

  const fee = Math.max(0, Math.floor(map.entrust_cost[2] ?? 0));
  if (profile.coins < fee) {
    throw new Error('委托手续费铜钱不足');
  }

  const slotId = resolveSendAuctionSlot(activeAuctions, slotBase, requestedSlotId);

  if (fee > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${now}:slot:${slotId}:fee`, 'send_auction_fee', 'coins', -fee);
  }

  for (const item of itemStates) {
    const beforeQuantity = inventoryQuantity(profile, item.refId);
    removeStockBoxBySelection(profile, item, now);
    decrementInventoryCounter(profile, item.refId, 1, now);
    recordTransaction(profile, `send_auction:${profile.playerId}:${now}:slot:${slotId}:item:${item.boxId}`, 'send_auction_item_lock', 'item', beforeQuantity, -1);
  }

  const stockContainer = sendAuctionStockContainer(slotId, map, selected.map(({ box }) => cloneStockBox(box, true)), now);
  const auction: SendAuctionState = {
    id: `send_auction_${randomUUID()}`,
    playerId: profile.playerId,
    playerName: profile.name,
    mapCid: map.id,
    mapName: bidKingMapDisplayName(map),
    bidMapId: map.entrust_bidmap,
    slotId,
    status: 'listed',
    items: itemStates,
    stockContainer,
    totalValue,
    targetValue: map.entrust_value,
    fee,
    entrustProbability: map.entrust_prob,
    itemCountRange: [minCount, maxCount],
    createdAt: now,
    updatedAt: now
  };
  profile.sendAuctions!.unshift(auction);
  recordTransaction(profile, `send_auction:${profile.playerId}:${auction.id}:create`, 'send_auction_create', 'task', activeAuctions.length, 1);
  profile.updatedAt = now;
  return auction;
}

export function settleSendAuctionForProfile(
  profile: PlayerProfile,
  sendAuctionId: string,
  finalPrice: number | undefined,
  applyNumberChange: SendAuctionNumberApplier,
  recordTransaction: SendAuctionTransactionRecorder,
  now = Date.now()
): boolean {
  ensureProfileShape(profile);
  profile.sendAuctionGames ??= [];
  const auction = profile.sendAuctions!.find((candidate) => candidate.id === sendAuctionId);
  if (!auction) {
    throw new Error('委托不存在');
  }
  if (auction.status !== 'listed') {
    return false;
  }
  const safeFinalPrice = Math.max(0, Math.floor(finalPrice ?? generatedSendAuctionFinalPrice(auction)));
  const game = buildSendAuctionGameState(profile, auction, safeFinalPrice, now);
  auction.status = 'settled';
  auction.finalPrice = safeFinalPrice;
  auction.profit = safeFinalPrice - auction.totalValue;
  auction.settledAt = now;
  auction.updatedAt = now;
  profile.sendAuctionGames.unshift(game);
  if (safeFinalPrice > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${auction.id}:settle:coins`, 'send_auction_settle_coins', 'coins', safeFinalPrice);
  }
  deliverSendAuctionResultMail(profile, auction, game, 'settled', recordTransaction, now);
  recordTransaction(profile, `send_auction:${profile.playerId}:${auction.id}:settle`, 'send_auction_settle', 'task', 0, 1);
  profile.updatedAt = now;
  return true;
}

export function recycleSendAuctionForProfile(
  profile: PlayerProfile,
  slotId: number,
  applyNumberChange: SendAuctionNumberApplier,
  recordTransaction: SendAuctionTransactionRecorder,
  now = Date.now()
): boolean {
  ensureProfileShape(profile);
  profile.sendAuctionGames ??= [];
  const auction = profile.sendAuctions!.find((candidate) => candidate.slotId === slotId && candidate.status === 'listed');
  if (!auction) {
    throw new Error('委托槽位不存在');
  }
  const game = buildSendAuctionGameState(profile, auction, auction.totalValue, now);
  auction.status = 'recycled';
  auction.finalPrice = auction.totalValue;
  auction.profit = 0;
  auction.recycledAt = now;
  auction.updatedAt = now;
  profile.sendAuctionGames.unshift(game);
  if (auction.totalValue > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${auction.id}:recycle:coins`, 'send_auction_recycle_coins', 'coins', auction.totalValue);
  }
  deliverSendAuctionResultMail(profile, auction, game, 'recycled', recordTransaction, now);
  recordTransaction(profile, `send_auction:${profile.playerId}:${auction.id}:recycle`, 'send_auction_recycle', 'task', 0, 1);
  profile.updatedAt = now;
  return true;
}

export function listSendAuctionsForProfile(profile: PlayerProfile, includeHistory = true): SendAuctionState[] {
  ensureProfileShape(profile);
  return profile.sendAuctions!
    .filter((auction) => includeHistory || auction.status === 'listed')
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function listSendAuctionGamesForProfile(profile: PlayerProfile): SendAuctionGameState[] {
  ensureProfileShape(profile);
  return profile.sendAuctionGames!.sort((left, right) => right.gameOverTime - left.gameOverTime);
}

export function buildSourceSendAuctionData(auction: SendAuctionState): SendAuctionDataSnapshot {
  return {
    uid: stableNumericId(auction.id),
    mapCid: auction.mapCid,
    slotId: auction.slotId,
    stockData: toBidKingStockContainer(auction.stockContainer),
    sendTime: toUnixSeconds(auction.createdAt)
  };
}

export function buildSourceSendAuctionCreateResponse(auction: SendAuctionState): SendAuctionCreateResponse {
  return {
    errorCode: 0,
    sendAuctionData: buildSourceSendAuctionData(auction)
  };
}

export function buildSourceSendAuctionRecycleResponse(): SendAuctionRecycleResponse {
  return {
    errorCode: 0
  };
}

export function buildSendAuctionListSnapshot(
  profile: PlayerProfile,
  includeHistory = true,
  generatedAt = Date.now()
): SendAuctionListSnapshot {
  const auctions = listSendAuctionsForProfile(profile, includeHistory);
  return {
    generatedAt,
    errorCode: 0,
    sendAuctionDataList: auctions.map(buildSourceSendAuctionData),
    auctions
  };
}

export function buildSourceSendAuctionGameData(game: SendAuctionGameState): SendAuctionGameDataSnapshot {
  return {
    uid: game.uid,
    mapCid: game.mapCid,
    gameData: game.gameData,
    gameOverTime: game.gameOverTime,
    userSkillList: game.userSkillList.map(cloneBidKingGameSkillData)
  };
}

export function buildSendAuctionGameListSnapshot(
  profile: PlayerProfile,
  generatedAt = Date.now()
): SendAuctionGameListSnapshot {
  const games = listSendAuctionGamesForProfile(profile);
  return {
    generatedAt,
    errorCode: 0,
    sendAuctionGameDataList: games.map(buildSourceSendAuctionGameData),
    games
  };
}

function buildSendAuctionGameState(
  profile: PlayerProfile,
  auction: SendAuctionState,
  finalPrice: number,
  now: number
): SendAuctionGameState {
  const stockContainer = toBidKingStockContainer(auction.stockContainer);
  const userLog = buildSendAuctionUserLog(auction, finalPrice);
  const ownerUid = stableNumericId(profile.playerId);
  const systemLimits = bidKingBaseGameDataSystemLimits();
  const nowSeconds = toUnixSeconds(now);
  const gameData: BidKingGameDataSnapshot = {
    uid: `${auction.id}:game:${now}`,
    mapId: auction.bidMapId,
    round: 1,
    stockContainer,
    userLog,
    heroSkillLog: [],
    mapSkillLog: [],
    itemSkillLog: [],
    nextRoundTime: nowSeconds,
    selectItemCount: 0,
    roundCanUseItemCount: systemLimits.roundCanUseItemCount,
    gameCarryItemMax: systemLimits.gameCarryItemMax,
    gameGoldRateMax: systemLimits.gameGoldRateMax,
    gameType: 1,
    sendAuctionUserUid: ownerUid,
    sendAuctionUserName: profile.name,
    sendAuctionUserHead: 0,
    sendAuctionHeadBox: 0,
    sendAuctionUserTitle: 0,
    serverTime: nowSeconds
  };
  return {
    id: `send_auction_game_${auction.id}_${now}`,
    sendAuctionId: auction.id,
    uid: stableNumericId(`${auction.id}:${now}`),
    playerId: profile.playerId,
    playerName: profile.name,
    mapCid: auction.mapCid,
    mapName: auction.mapName,
    bidMapId: auction.bidMapId,
    gameData,
    gameOverTime: nowSeconds,
    userSkillList: [],
    finalPrice,
    totalValue: auction.totalValue,
    profit: finalPrice - auction.totalValue,
    createdAt: now
  };
}

function toUnixSeconds(timestampMs: number): number {
  return Math.floor(timestampMs / 1000);
}

function toBidKingStockContainer(container: ProfileStockContainerState): BidKingStockContainerDataSnapshot {
  return {
    stockId: container.stockId,
    stockCid: container.cid,
    stockBoxes: container.boxes.map((box) => toBidKingStockBox(container, box)),
    cabinetLastGetRewardTime: 0,
    cabinetCumulativeReward: 0,
    cabinetBasicReward: 0,
    cabinetReward: 0
  };
}

function toBidKingStockBox(container: ProfileStockContainerState, box: ProfileStockBoxState): BidKingStockBoxDataSnapshot {
  const item = Item.find((candidate) => candidate.id === box.item.cid);
  const footprint = item ? itemFootprint(item.slot_type) : { w: 1, h: 1 };
  const positions = (box.item.boxPositionData ?? []).length > 0
    ? box.item.boxPositionData.map((position) => ({ ...position }))
    : bidKingSourceBoxPositionDataForProfilePosition(
        box.position,
        container.width,
        box.item.rotate ? { w: footprint.h, h: footprint.w } : footprint
      );
  return {
    boxId: bidKingSourceBoxIdForProfileStockBox(box),
    position: bidKingSourceBoxPositionForProfilePosition(box.position, container.width),
    item: {
      uid: box.item.sourceUid ?? stableNumericId(box.item.uid),
      cid: box.item.cid,
      count: box.item.count,
      boxPositionData: positions,
      rotate: box.item.rotate,
      canTrade: box.item.canTrade,
      no: box.item.no,
      isLock: box.item.isLock,
      quality: box.item.quality,
      sourceItemId: String(box.item.cid)
    }
  };
}

function buildSendAuctionUserLog(auction: SendAuctionState, finalPrice: number): BidKingGameUserDataSnapshot[] {
  const heroIds = bidKingBotHeroIdsForBidMap({
    bidMapId: auction.bidMapId,
    seed: auction.id,
    count: 4
  });
  const winnerIndex = stableNumericId(`${auction.id}:winner`) % Math.max(1, heroIds.length);
  const bids = heroIds.map((heroId, index) => {
    const rankAi = rankAiForHero(heroId, 1);
    const pressure = rankAiPressure(rankAi);
    const variance = deterministicUnit(`${auction.id}:${heroId}:${index}`);
    const amount = index === winnerIndex
      ? finalPrice
      : Math.min(
          Math.max(0, finalPrice - 1000),
          Math.round(auction.totalValue * (0.58 + pressure * 0.28 + variance * 0.18))
        );
    return {
      heroId,
      amount: Math.max(0, Math.floor(amount))
    };
  });
  const sorted = [...bids].sort((left, right) => right.amount - left.amount);
  if (sorted[0]) {
    sorted[0].amount = finalPrice;
  }
  return sorted.map(({ heroId, amount }, index) => {
    const hero = Hero.find((candidate) => candidate.id === heroId) ?? Hero[index % Math.max(1, Hero.length)];
    const playerId = `send_auction_bot_${auction.id}_${index + 1}`;
    return {
      userUid: stableNumericId(playerId),
      playerId,
      name: hero?.packaged_title || hero?.packaged_name || `竞买人${index + 1}`,
      heroCid: hero?.id ?? heroId,
      useItemLog: [],
      priceLog: amount > 0
        ? [{ round: 1, itemCidOrPrice: amount }]
        : [],
      isStandDown: amount <= 0,
      isQuit: false,
      headCid: 0,
      heroSkinCid: 0,
      simSelectItemList: [],
      simBuffItemList: [],
      selectItemList: [],
      headBoxCid: 0,
      titleCid: 0,
      remark: ''
    };
  });
}

function rankAiForHero(heroId: number, roundCount: number) {
  const heroRows = RankAi.filter((row) => row.role_id === heroId);
  const row = heroRows.find((candidate) => candidate.round_count === roundCount);
  if (!row) {
    throw new Error(`Missing RankAi row for hero ${heroId} round ${roundCount}`);
  }
  return row;
}

function rankAiPressure(rankAi: (typeof RankAi)[number]): number {
  const minRatio = weightedRangeAverage(rankAi.min_bid_ratio) / 1000;
  const pkRatio = weightedRangeAverage(rankAi.bid_pk) / 1000;
  return clamp((minRatio * 0.45 + pkRatio * 0.55 - 0.4) / 1.6, 0.15, 0.95);
}

function weightedRangeAverage(ranges: readonly (readonly number[])[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const range of ranges) {
    if (range.length < 2) {
      continue;
    }
    const min = Number(range[0]);
    const max = Number(range[1] ?? min);
    const weight = Math.max(0, Number(range[2] ?? 1));
    if (!Number.isFinite(min) || !Number.isFinite(max) || weight <= 0) {
      continue;
    }
    weighted += ((min + max) / 2) * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) {
    throw new Error('RankAi weighted range has no valid candidates');
  }
  return weighted / totalWeight;
}

function generatedSendAuctionFinalPrice(auction: SendAuctionState): number {
  const roll = deterministicUnit(`${auction.id}:final-price`);
  const probabilityBias = clamp(((auction.entrustProbability ?? 500) - 500) / 5000, -0.08, 0.08);
  const multiplier = 0.9 + probabilityBias + roll * 0.34;
  return Math.max(0, Math.round(auction.totalValue * multiplier));
}

function deliverSendAuctionResultMail(
  profile: PlayerProfile,
  auction: SendAuctionState,
  game: SendAuctionGameState,
  outcome: 'settled' | 'recycled',
  recordTransaction: SendAuctionTransactionRecorder,
  now: number
): void {
  const profitText = game.profit >= 0 ? `盈利 ${game.profit.toLocaleString()}` : `亏损 ${Math.abs(game.profit).toLocaleString()}`;
  const title = outcome === 'settled' ? '委托拍卖已成交' : '委托拍卖已回收';
  const body = outcome === 'settled'
    ? `${auction.mapName ?? '委托拍场'}送拍完成，${auction.items.length} 件藏品成交价 ${game.finalPrice.toLocaleString()}，估价 ${game.totalValue.toLocaleString()}，${profitText}。`
    : `${auction.mapName ?? '委托拍场'}委托已下架，${auction.items.length} 件藏品按系统价 ${game.finalPrice.toLocaleString()} 回收。`;
  const mail = addCustomMailToProfile(profile, {
    sourceKey: `send_auction_${game.uid}_${outcome}`,
    title,
    body,
    now
  });
  if (mail) {
    recordTransaction(profile, `send_auction:${profile.playerId}:${auction.id}:${outcome}:mail`, 'send_auction_result_mail', 'mail', 0, 1);
  }
}

function activeSendAuctions(profile: PlayerProfile): SendAuctionState[] {
  return profile.sendAuctions!.filter((auction) => auction.status === 'listed');
}

function normalizeSelections(itemSelections: readonly SendAuctionItemSelectionInput[]): SendAuctionItemSelectionInput[] {
  const seen = new Set<string>();
  const selections: SendAuctionItemSelectionInput[] = [];
  for (const selection of itemSelections) {
    const stockId = Math.floor(Number(selection.stockId));
    const boxId = Math.floor(Number(selection.boxId));
    if (!Number.isFinite(stockId) || !Number.isFinite(boxId)) {
      throw new Error('委托藏品选择无效');
    }
    const key = `${stockId}:${boxId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selections.push({ stockId, boxId });
  }
  return selections;
}

function selectedBoxForSendAuction(
  profile: PlayerProfile,
  selection: SendAuctionItemSelectionInput,
  mode: SendAuctionSelectionMode
): { container: ProfileStockContainerState; box: ProfileStockBoxState } {
  const container = profile.stockContainers?.find((candidate) => candidate.stockId === selection.stockId);
  const box = container ? findSendAuctionBox(container, selection.boxId, mode) : undefined;
  if (!container || !box) {
    throw new Error(`委托藏品不存在：${selection.stockId}/${selection.boxId}`);
  }
  return { container, box };
}

function inferSendAuctionSelectionMode(
  profile: PlayerProfile,
  selections: readonly SendAuctionItemSelectionInput[]
): SendAuctionSelectionMode {
  const sourceMatches = selections.every((selection) => {
    const container = profile.stockContainers?.find((candidate) => candidate.stockId === selection.stockId);
    return Boolean(container && findSendAuctionBox(container, selection.boxId, 'source'));
  });
  const runtimeMatches = selections.every((selection) => {
    const container = profile.stockContainers?.find((candidate) => candidate.stockId === selection.stockId);
    return Boolean(container && findSendAuctionBox(container, selection.boxId, 'runtime'));
  });
  if (sourceMatches && !runtimeMatches) {
    return 'source';
  }
  if (runtimeMatches && !sourceMatches) {
    return 'runtime';
  }
  return runtimeMatches ? 'runtime' : 'source';
}

function findSendAuctionBox(
  container: ProfileStockContainerState,
  boxId: number,
  mode: SendAuctionSelectionMode
): ProfileStockBoxState | undefined {
  return mode === 'source'
    ? container.boxes.find((candidate) => bidKingSourceBoxIdForProfileStockBox(candidate) === boxId)
    : container.boxes.find((candidate) => candidate.boxId === boxId);
}

function canSendAuctionItem(item: BidKingItemRow, box: ProfileStockBoxState): boolean {
  const isCollection = item.item_type_ids.some((typeId) => typeId > 100 && typeId <= 110)
    || (item.item_type_id > 100 && item.item_type_id <= 110);
  return isCollection && item.is_sale === 1 && !box.item.isLock;
}

function sendAuctionItemState(stockId: number, box: ProfileStockBoxState, item: BidKingItemRow): SendAuctionItemState {
  return {
    stockId,
    boxId: bidKingSourceBoxIdForProfileStockBox(box),
    itemCid: item.id,
    itemUid: box.item.uid,
    itemNo: box.item.no,
    position: box.position,
    value: Math.max(0, Math.floor(item.base_value)),
    refId: canonicalInventoryRef(item.id)
  };
}

function requiredInventoryCounts(items: readonly SendAuctionItemState[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.refId, (counts.get(item.refId) ?? 0) + 1);
  }
  return counts;
}

function removeStockBoxBySelection(profile: PlayerProfile, item: SendAuctionItemState, now: number): void {
  const container = profile.stockContainers?.find((candidate) => candidate.stockId === item.stockId);
  const index = container?.boxes.findIndex((candidate) => (
    (bidKingSourceBoxIdForProfileStockBox(candidate) === item.boxId || candidate.boxId === item.boxId) &&
    candidate.position === item.position &&
    candidate.item.cid === item.itemCid
  )) ?? -1;
  if (!container || index < 0) {
    throw new Error(`委托藏品不存在：${item.stockId}/${item.boxId}`);
  }
  container.boxes.splice(index, 1);
  container.updatedAt = now;
  profile.updatedAt = now;
}

function decrementInventoryCounter(profile: PlayerProfile, refId: string, quantity: number, now: number): void {
  let remaining = quantity;
  for (const entry of profile.inventory.filter((candidate) => inventoryRefMatches(candidate.refId, refId))) {
    if (remaining <= 0) {
      break;
    }
    const consumed = Math.min(entry.quantity, remaining);
    entry.quantity -= consumed;
    entry.updatedAt = now;
    remaining -= consumed;
  }
  if (remaining > 0) {
    throw new Error(`仓库库存计数不足：${refId}`);
  }
  profile.inventory = profile.inventory.filter((entry) => entry.quantity > 0);
}

function sendAuctionStockContainer(
  slotId: number,
  map: BidKingMapRow,
  boxes: ProfileStockBoxState[],
  now: number
): ProfileStockContainerState {
  return {
    stockId: slotId,
    cid: map.entrust_bidmap,
    kind: 'sendAuction',
    name: `${bidKingMapDisplayName(map)}委托箱`,
    width: 10,
    height: 40,
    boxes,
    updatedAt: now
  };
}

function cloneStockBox(box: ProfileStockBoxState, locked = box.item.isLock): ProfileStockBoxState {
  return {
    boxId: box.boxId,
    position: box.position,
    item: {
      ...box.item,
      boxPositionData: (box.item.boxPositionData ?? []).map((position) => ({ ...position })),
      isLock: locked
    }
  };
}

function firstFreeSendAuctionSlot(activeAuctions: readonly SendAuctionState[], slotBase: number): number {
  const used = new Set(activeAuctions.map((auction) => auction.slotId));
  for (let index = 0; index < slotBase; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return -1;
}

function resolveSendAuctionSlot(
  activeAuctions: readonly SendAuctionState[],
  slotBase: number,
  requestedSlotId?: number
): number {
  if (requestedSlotId === undefined) {
    const slotId = firstFreeSendAuctionSlot(activeAuctions, slotBase);
    if (slotId < 0) {
      throw new Error('委托槽位已满');
    }
    return slotId;
  }
  if (!Number.isFinite(requestedSlotId) || !Number.isInteger(requestedSlotId) || requestedSlotId < 0 || requestedSlotId >= slotBase) {
    throw new Error(`委托槽位无效：${requestedSlotId}`);
  }
  if (activeAuctions.some((auction) => auction.slotId === requestedSlotId)) {
    throw new Error(`委托槽位已占用：${requestedSlotId}`);
  }
  return requestedSlotId;
}

function cloneBidKingGameSkillData(skill: BidKingGameDataSnapshot['heroSkillLog'][number]): BidKingGameDataSnapshot['heroSkillLog'][number] {
  return {
    ...skill,
    hitBoxList: skill.hitBoxList.map((box) => ({
      ...box,
      itemType: [...box.itemType]
    })),
    hitItemTypeList: [...skill.hitItemTypeList],
    hitItemQuilityList: [...skill.hitItemQuilityList]
  };
}

function sendAuctionMapForId(mapCid: number): BidKingMapRow | undefined {
  const direct = BidKingMap.find((row) => row.id === mapCid);
  if (direct && direct.entrust_value > 0) {
    return direct;
  }
  return BidKingMap.find((row) => row.mapgroup === mapCid && row.entrust_value > 0)
    ?? direct;
}

function canonicalInventoryRef(itemId: number): string {
  return String(itemId);
}

function inventoryRefMatches(left: number | string, right: number | string): boolean {
  return sourceInventoryItemId(left) === sourceInventoryItemId(right);
}

function sourceInventoryItemId(value: number | string): string {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return compatMatch?.[1] ?? raw;
}

function deterministicUnit(value: string): number {
  return (stableNumericId(value) % 10_000) / 10_000;
}

function stableNumericId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.max(1, hash >>> 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
