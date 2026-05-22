import { Item, Map as BidKingMap, bidKingMapDisplayName } from '@bitkingdom/bidking-compat';
import { bidKingEntrustSlotBase } from '@bitkingdom/match-core';
import type {
  PlayerProfile,
  ProfileStockBoxState,
  ProfileStockContainerState,
  ProfileTransaction,
  SendAuctionItemState,
  SendAuctionState
} from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import { inventoryQuantity } from '../profile/profileInventory';
import { ensureProfileShape } from '../profile/profileShape';

type BidKingMapRow = (typeof BidKingMap)[number];
type BidKingItemRow = (typeof Item)[number];

export interface SendAuctionItemSelectionInput {
  stockId: number;
  boxId: number;
}

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

  const selected = uniqueSelections.map((selection) => selectedBoxForSendAuction(profile, selection));
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

  const slotId = firstFreeSendAuctionSlot(activeAuctions, slotBase);
  if (slotId < 0) {
    throw new Error('委托槽位已满');
  }

  if (fee > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${now}:slot:${slotId}:fee`, 'send_auction_fee', 'coins', -fee);
  }

  for (const item of itemStates) {
    const beforeQuantity = inventoryQuantity(profile, item.refId);
    removeStockBoxBySelection(profile, item, now);
    decrementInventoryCounter(profile, item.refId, 1, now);
    recordTransaction(profile, `send_auction:${profile.playerId}:${now}:slot:${slotId}:item:${item.boxId}`, 'send_auction_item_lock', 'item', beforeQuantity, -1);
  }

  const stockContainer = sendAuctionStockContainer(slotId, map, selected.map(({ box }) => cloneStockBox(box)), now);
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
  const auction = profile.sendAuctions!.find((candidate) => candidate.id === sendAuctionId);
  if (!auction) {
    throw new Error('委托不存在');
  }
  if (auction.status !== 'listed') {
    return false;
  }
  const safeFinalPrice = Math.max(0, Math.floor(finalPrice ?? auction.totalValue));
  auction.status = 'settled';
  auction.finalPrice = safeFinalPrice;
  auction.profit = safeFinalPrice - auction.totalValue;
  auction.settledAt = now;
  auction.updatedAt = now;
  if (safeFinalPrice > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${auction.id}:settle:coins`, 'send_auction_settle_coins', 'coins', safeFinalPrice);
  }
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
  const auction = profile.sendAuctions!.find((candidate) => candidate.slotId === slotId && candidate.status === 'listed');
  if (!auction) {
    throw new Error('委托槽位不存在');
  }
  auction.status = 'recycled';
  auction.finalPrice = auction.totalValue;
  auction.profit = 0;
  auction.recycledAt = now;
  auction.updatedAt = now;
  if (auction.totalValue > 0) {
    applyNumberChange(profile, `send_auction:${profile.playerId}:${auction.id}:recycle:coins`, 'send_auction_recycle_coins', 'coins', auction.totalValue);
  }
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
  selection: SendAuctionItemSelectionInput
): { container: ProfileStockContainerState; box: ProfileStockBoxState } {
  const container = profile.stockContainers?.find((candidate) => candidate.stockId === selection.stockId);
  const box = container?.boxes.find((candidate) => candidate.boxId === selection.boxId);
  if (!container || !box) {
    throw new Error(`委托藏品不存在：${selection.stockId}/${selection.boxId}`);
  }
  return { container, box };
}

function canSendAuctionItem(item: BidKingItemRow, box: ProfileStockBoxState): boolean {
  const isCollection = item.item_type_ids.some((typeId) => typeId > 100 && typeId <= 110)
    || (item.item_type_id > 100 && item.item_type_id <= 110);
  return isCollection && item.is_sale === 1 && !box.item.isLock;
}

function sendAuctionItemState(stockId: number, box: ProfileStockBoxState, item: BidKingItemRow): SendAuctionItemState {
  return {
    stockId,
    boxId: box.boxId,
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
  const index = container?.boxes.findIndex((candidate) => candidate.boxId === item.boxId && candidate.item.cid === item.itemCid) ?? -1;
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

function cloneStockBox(box: ProfileStockBoxState): ProfileStockBoxState {
  return {
    boxId: box.boxId,
    position: box.position,
    item: { ...box.item }
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
