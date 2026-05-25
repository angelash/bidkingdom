import { Item } from '@bitkingdom/bidking-compat';
import type {
  AuctionHouseBidLogListSnapshot,
  AuctionHouseBidLogSnapshot,
  AuctionHouseBidPriceResponse,
  AuctionHouseItemInfoSnapshot,
  AuctionHouseItemPriceInfoListSnapshot,
  AuctionHouseItemPriceInfoSnapshot,
  AuctionHouseItemSortModel,
  AuctionHouseLanchItemListSnapshot,
  AuctionHouseLanchItemSnapshot,
  AuctionHouseTradeInfoListSnapshot,
  AuctionHouseTradeInfoSnapshot,
  AuctionHouseUnlockLanchSlotResponse,
  AuctionHouseUnlanchItemResponse,
  ExchangeBuyItemResponse,
  ExchangeCollectItemListSnapshot,
  ExchangeCollectItemResponse,
  ExchangeInfoSnapshot,
  ExchangeItemTradeInfoListSnapshot,
  ExchangeLanchItemResponse,
  ExchangeLunchItemListSnapshot,
  ExchangeLunchItemSnapshot,
  ExchangeTradeInfoListSnapshot,
  ExchangeTradeInfoSnapshot,
  ExchangeUnlanchItemResponse,
  MarketOrderAuctionHouseBidState,
  MarketOrderSourceExchangeTrade,
  MarketOrderSourceAuctionHouseLaunch,
  MarketOrdersSnapshot,
  PlayerProfile,
  ProfileStockBoxState,
  ProfileTransaction
} from '@bitkingdom/shared';
import {
  bidKingMailMaxCount,
  bidKingMarketBidIncrement,
  bidKingMarketBidWindowMs,
  bidKingMarketListingSlotBase,
  bidKingMarketListingSlotMax,
  bidKingMarketOrderDurationHours,
  bidKingMarketOrderDurationMs,
  bidKingMarketPublicDelayMs,
  bidKingMarketRuleRuntime,
  bidKingMarketSnapshotLimit,
  constantNumber
} from '@bitkingdom/match-core';
import { randomUUID } from 'node:crypto';
import { addInventory, consumeInventory, inventoryQuantity } from '../profile/profileInventory';
import { ensureProfileShape } from '../profile/profileShape';
import {
  assertCanAddStockItemsToWarehouse,
  bidKingSourceBoxIdForProfileStockBox,
  extractStockItemsForInventoryRef,
  isStockBackedInventoryRef,
  MAIN_WAREHOUSE_STOCK_ID,
  returnStockBoxesToWarehouse
} from '../profile/profileStockRuntime';
import { sanitizeText } from '../system/textGuard';
import { marketOrderFee, marketOrderPriceBreakdown, marketOrderQuantityLimit } from './profileCommerceRuntime';

export const MARKET_ORDER_DURATION_MS: Record<'trade' | 'auction', number> = {
  trade: bidKingMarketOrderDurationMs('trade'),
  auction: bidKingMarketOrderDurationMs('auction')
};

export interface AuctionHouseItemListOptions {
  itemCid?: number;
  isDisplayPeriod?: number;
  sortType?: AuctionHouseItemSortModel;
  page?: number;
  pageSize?: number;
  reverse?: boolean;
  now?: number;
}

export type ProfileTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type ProfileNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export type AuctionHouseBidEscrowRefundApplier = (
  order: PlayerProfile['marketOrders'][number],
  now: number
) => void;

export type AuctionHouseExpiredSettlementApplier = (
  sellerProfile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  now: number
) => boolean;

type MarketOrderPriceBreakdownSnapshot = ReturnType<typeof marketOrderPriceBreakdown>;

function sourceMarketOrderPriceBreakdown(
  breakdown: MarketOrderPriceBreakdownSnapshot,
  orderType: 'trade' | 'auction'
): MarketOrderPriceBreakdownSnapshot {
  if (orderType !== 'trade') {
    return breakdown;
  }
  return {
    ...breakdown,
    listingCost: breakdown.listingFee,
    fee: breakdown.tax,
    netPrice: Math.max(0, breakdown.totalPrice - breakdown.listingFee - breakdown.tax)
  };
}

function marketOrderSettlementFee(
  order: PlayerProfile['marketOrders'][number],
  unitPrice: number,
  quantity: number
): number {
  if (order.orderType === 'trade') {
    return marketOrderPriceBreakdown(order.refId, unitPrice, quantity).tax;
  }
  return marketOrderFee(order.refId, unitPrice);
}

function marketOrderSettlementNetPrice(
  order: PlayerProfile['marketOrders'][number],
  totalPrice: number
): number {
  const fee = Math.max(0, Math.floor(order.fee ?? 0));
  if (order.orderType === 'trade') {
    const listingCost = Math.max(0, Math.floor(order.listingCost ?? order.listingFee ?? 0));
    return Math.max(0, totalPrice - listingCost - fee);
  }
  return Math.max(0, totalPrice - fee);
}

function assertExchangeBuyLevel(profile: PlayerProfile): void {
  const requiredLevel = constantNumber('bid_lv', 25);
  if (Math.max(1, Math.floor(profile.level ?? 1)) < requiredLevel) {
    throw new Error('CODE_105');
  }
}

export function createMarketOrderForProfile(
  profile: PlayerProfile,
  refId: string,
  quantity: number,
  price: number,
  orderType: 'trade' | 'auction',
  recordTransaction: ProfileTransactionRecorder,
  note = '',
  applyNumberChange?: ProfileNumberChangeApplier
): PlayerProfile['marketOrders'][number] {
  ensureProfileShape(profile);
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const safePrice = Math.max(1, Math.floor(price));
  const safeNote = sanitizeText(note).trim().slice(0, 80);
  const quantityLimit = marketOrderQuantityLimit(refId);
  const durationHours = bidKingMarketOrderDurationHours(orderType);
  const breakdown = sourceMarketOrderPriceBreakdown(
    marketOrderPriceBreakdown(refId, safePrice, safeQuantity, durationHours),
    orderType
  );
  const before = inventoryQuantity(profile, refId);
  const now = Date.now();
  if (safeQuantity > quantityLimit) {
    throw new Error(`单笔上架数量不能超过 ${quantityLimit}`);
  }
  const activeListings = activeMarketOrderSlotCount(profile, orderType);
  const requiredSlots = marketOrderListingSlotUsage(refId, safeQuantity, orderType);
  const listingSlotLimit = marketListingSlotLimit(profile, orderType);
  if (activeListings + requiredSlots > listingSlotLimit) {
    throw new Error(`上架槽位已满，当前 ${activeListings}/${listingSlotLimit}`);
  }
  const mailLimit = bidKingMailMaxCount();
  if ((profile.mail?.length ?? 0) >= mailLimit) {
    throw new Error(`信箱已满，最多保留 ${mailLimit} 封`);
  }
  if (before < safeQuantity) {
    throw new Error('库存不足，无法上架');
  }
  const stockBacked = isStockBackedInventoryRef(refId);
  let lockedStockBoxes: ProfileStockBoxState[] = [];
  if (stockBacked) {
    lockedStockBoxes = extractStockItemsForInventoryRef(profile, refId, safeQuantity, now, ['warehouse']);
    if (lockedStockBoxes.length < safeQuantity) {
      if (lockedStockBoxes.length > 0) {
        returnStockBoxesToWarehouse(profile, lockedStockBoxes, now, { preserveBoxIds: true });
      }
      throw new Error('仓库实体库存不足，无法上架');
    }
  }
  if (breakdown.listingCost > 0) {
    if (!applyNumberChange) {
      throw new Error('缺少上架费扣款处理');
    }
    if (profile.coins < breakdown.listingCost) {
      throw new Error('上架费铜钱不足');
    }
    applyNumberChange(profile, `market:${profile.playerId}:${now}:listing_cost`, 'market_order_listing_cost', 'coins', -breakdown.listingCost);
  }
  if (stockBacked) {
    decrementInventoryCounter(profile, refId, safeQuantity, now);
  } else {
    consumeInventory(profile, refId, safeQuantity);
  }
  const itemMetadata = marketOrderItemMetadata(refId, lockedStockBoxes);
  const sourceAuctionHouseLaunches = marketOrderSourceAuctionHouseLaunches(
    lockedStockBoxes,
    breakdown.unitPrice,
    durationHours,
    orderType
  );
  const orderId = `order_${randomUUID()}`;
  const order = {
    id: orderId,
    orderType,
    refId,
    quantity: breakdown.quantity,
    price: breakdown.unitPrice,
    totalPrice: breakdown.totalPrice,
    listingFee: breakdown.listingFee,
    tax: breakdown.tax,
    listingCost: breakdown.listingCost,
    fee: breakdown.fee,
    netPrice: breakdown.netPrice,
    ...itemMetadata,
    ...(lockedStockBoxes.length > 0 ? { lockedStockBoxes } : {}),
    ...(orderType === 'trade' ? {
      sourceExchangeLunchItemUid: bidKingExchangeLunchItemUidForOrderId(orderId),
      sourceExchangeTradeCount: 0,
      sourceExchangeTotalPrice: breakdown.totalPrice,
      sourceExchangeTrades: []
    } : {}),
    ...(sourceAuctionHouseLaunches.length > 0 ? { sourceAuctionHouseLaunches } : {}),
    sourceAuctionHouseLanchItemUid: bidKingAuctionHouseLanchItemUidForOrderId(orderId),
    ...(safeNote ? { note: safeNote } : {}),
    status: 'listed' as const,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + bidKingMarketOrderDurationMs(orderType),
    publicAt: now + bidKingMarketPublicDelayMs(),
    bidWindowMs: bidKingMarketBidWindowMs(),
    priceStep: bidKingMarketBidIncrement(breakdown.unitPrice),
    priceNoticeLimit: breakdown.priceNoticeLimit
  };
  profile.marketOrders.unshift(order);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}`, 'market_list_item', 'item', before, -safeQuantity);
  profile.updatedAt = now;
  return order;
}

export function settleMarketOrderForProfile(
  profile: PlayerProfile,
  orderId: string,
  applyNumberChange: ProfileNumberChangeApplier,
  recordTransaction: ProfileTransactionRecorder,
  buyerProfile?: PlayerProfile
): boolean {
  const order = profile.marketOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.status !== 'listed') {
    return false;
  }
  const now = Date.now();
  if (isMarketOrderExpired(order, now)) {
    if (isExpiredExchangeOrderAwaitingAction(order)) {
      throw new Error('交易信息过期');
    }
    expireMarketOrder(profile, order, recordTransaction, now);
    return true;
  }
  const totalPrice = marketOrderTotalPrice(order);
  order.fee = marketOrderSettlementFee(order, order.price, order.quantity);
  order.totalPrice = totalPrice;
  order.netPrice = marketOrderSettlementNetPrice(order, totalPrice);
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
  if (buyerProfile && buyerProfile.playerId !== profile.playerId) {
    ensureProfileShape(buyerProfile);
    if (buyerProfile.coins < totalPrice) {
      throw new Error('买家铜钱不足');
    }
    const stockItemCidsToReceive = marketOrderStockItemCidsToReceive(order, order.quantity);
    if (stockItemCidsToReceive.length > 0) {
      assertCanAddStockItemsToWarehouse(
        buyerProfile,
        stockItemCidsToReceive,
        now,
        '仓库空间不足，无法购买交易品'
      );
    }
  }
  order.status = 'locked';
  order.lockedAt = now;
  order.updatedAt = now;
  if (buyerProfile && buyerProfile.playerId !== profile.playerId) {
    const buyerSource = `market:${profile.playerId}:${order.id}:buyer:${buyerProfile.playerId}`;
    const buyerBefore = inventoryQuantity(buyerProfile, order.refId);
    applyNumberChange(buyerProfile, `${buyerSource}:coins`, 'market_order_buy_spend', 'coins', -totalPrice);
    if (lockedStockBoxes.length > 0) {
      returnStockBoxesToWarehouse(buyerProfile, lockedStockBoxes, now, { preserveBoxIds: false });
      incrementInventoryCounter(buyerProfile, 'warehouse', order.refId, order.quantity, now);
    } else {
      addInventory(buyerProfile, order.orderType, order.refId, order.quantity, `${buyerSource}:item`);
    }
    recordTransaction(buyerProfile, `${buyerSource}:item`, 'market_order_bought_item', 'item', buyerBefore, order.quantity);
    order.buyerId = buyerProfile.playerId;
    order.buyerName = buyerProfile.name;
    incrementTradeConditionStat(buyerProfile, 'tradeBoughtCount');
    buyerProfile.updatedAt = now;
  }
  order.status = 'sold';
  order.soldAt = now;
  order.updatedAt = order.soldAt;
  applyNumberChange(profile, `market:${profile.playerId}:${order.id}:coins`, 'market_order_sold', 'coins', totalPrice);
  if (order.fee > 0) {
    applyNumberChange(profile, `market:${profile.playerId}:${order.id}:fee`, 'market_order_fee', 'coins', -order.fee);
  }
  incrementTradeConditionStat(profile, 'tradeSoldCount');
  profile.updatedAt = now;
  return true;
}

export function cancelMarketOrderForProfile(
  profile: PlayerProfile,
  orderId: string,
  recordTransaction: ProfileTransactionRecorder,
  refundAuctionHouseBidEscrow?: AuctionHouseBidEscrowRefundApplier,
  settleExpiredAuctionHouseOrder?: AuctionHouseExpiredSettlementApplier
): boolean {
  const order = profile.marketOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.status !== 'listed') {
    return false;
  }
  const now = Date.now();
  if (isMarketOrderExpired(order, now)) {
    expireMarketOrder(profile, order, recordTransaction, now, refundAuctionHouseBidEscrow, settleExpiredAuctionHouseOrder);
    return true;
  }
  const before = inventoryQuantity(profile, order.refId);
  const returnQuantity = marketOrderRemainingQuantity(order);
  refundAuctionHouseBidEscrow?.(order, now);
  returnMarketOrderInventory(profile, order, now, `market:${profile.playerId}:${order.id}:cancel`);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}:cancel`, 'market_order_cancel', 'item', before, returnQuantity);
  order.status = 'cancelled';
  order.cancelledAt = now;
  order.updatedAt = order.cancelledAt;
  profile.updatedAt = now;
  return true;
}

export function expireMarketOrdersForProfile(
  profile: PlayerProfile,
  recordTransaction: ProfileTransactionRecorder,
  now = Date.now(),
  refundAuctionHouseBidEscrow?: AuctionHouseBidEscrowRefundApplier,
  settleExpiredAuctionHouseOrder?: AuctionHouseExpiredSettlementApplier
): number {
  ensureProfileShape(profile);
  let expired = 0;
  for (const order of profile.marketOrders) {
    if (order.status === 'listed' && isMarketOrderExpired(order, now)) {
      if (isExpiredAuctionHouseOrderAwaitingUnlanch(order)) {
        continue;
      }
      if (isExpiredExchangeOrderAwaitingAction(order)) {
        continue;
      }
      expireMarketOrder(profile, order, recordTransaction, now, refundAuctionHouseBidEscrow, settleExpiredAuctionHouseOrder);
      expired += 1;
    }
  }
  return expired;
}

export function buildMarketOrdersSnapshot(
  profiles: Iterable<PlayerProfile>,
  orderType?: 'trade' | 'auction'
): MarketOrdersSnapshot {
  const now = Date.now();
  const orders = [...profiles]
    .flatMap((profile) => {
      ensureProfileShape(profile);
      return profile.marketOrders
        .filter((order) => !orderType || order.orderType === orderType)
        .map((order) => ({
          ...order,
          playerId: profile.playerId,
          playerName: profile.name,
          ...(order.orderType === 'trade' ? { sourceExchangeLunchItem: buildExchangeLunchItem(order) } : {}),
          ...(order.orderType === 'auction' ? { sourceAuctionHouseLanchItem: buildAuctionHouseLanchItem(order) } : {})
        }));
    })
    .sort((left, right) => right.createdAt - left.createdAt);
  return {
    generatedAt: now,
    orders: orders.slice(0, bidKingMarketSnapshotLimit()),
    ...(orderType === 'auction' ? {
      sourceAuctionHouseItemInfo: buildAuctionHouseItemInfoSnapshotFromOrders(
        orders.filter((order) => order.orderType === 'auction'),
        { now, pageSize: bidKingMarketSnapshotLimit() }
      )
    } : {})
  };
}

export function createExchangeLanchItemForProfile(
  profile: PlayerProfile,
  itemCid: number,
  count: number,
  totalPrice: number,
  recordTransaction: ProfileTransactionRecorder,
  applyNumberChange: ProfileNumberChangeApplier
): ExchangeLanchItemResponse {
  const safeItemCid = Math.max(1, Math.floor(itemCid));
  const safeCount = Math.max(1, Math.floor(count));
  const safeTotalPrice = Math.max(1, Math.floor(totalPrice));
  const refId = String(safeItemCid);
  const unitPrice = Math.max(1, Math.floor(safeTotalPrice / safeCount));
  const chunks = splitExchangeListingQuantity(safeCount, sourceExchangeListingChunkSize(refId));
  const activeSlots = activeMarketOrderSlotCount(profile, 'trade');
  const listingSlotLimit = marketListingSlotLimit(profile, 'trade');
  if (activeSlots + chunks.length > listingSlotLimit) {
    throw new Error(`上架槽位已满，当前 ${activeSlots}/${listingSlotLimit}`);
  }
  if (inventoryQuantity(profile, refId) < safeCount) {
    throw new Error('库存不足，无法上架');
  }
  const orders: PlayerProfile['marketOrders'][number][] = [];
  for (const chunkCount of chunks) {
    const order = createMarketOrderForProfile(
      profile,
      refId,
      chunkCount,
      unitPrice,
      'trade',
      recordTransaction,
      '',
      applyNumberChange
    );
    const chunkTotalPrice = unitPrice * chunkCount;
    order.totalPrice = chunkTotalPrice;
    order.sourceExchangeTotalPrice = chunkTotalPrice;
    order.sourceExchangeLunchItemUid = order.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(order.id);
    order.sourceExchangeTradeCount = 0;
    order.sourceExchangeTrades = [];
    orders.push(order);
  }
  const order = orders[0];
  if (!order) {
    throw new Error('交易品不存在');
  }
  const lunchItemUid = order.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(order.id);
  order.sourceExchangeLunchItemUid = lunchItemUid;
  return {
    errorCode: 0,
    lunchItemUid,
    orderId: order.id
  };
}

export function reExchangeLanchItemForProfile(
  profile: PlayerProfile,
  itemUid: number,
  now = Date.now()
): ExchangeLanchItemResponse {
  ensureProfileShape(profile);
  const safeItemUid = Math.max(1, Math.floor(itemUid));
  const order = findExchangeOrderByItemUid(profile, safeItemUid);
  if (!order) {
    throw new Error('交易品不存在');
  }
  if (!isMarketOrderExpired(order, now)) {
    throw new Error('交易品尚未过期');
  }
  order.status = 'listed';
  order.createdAt = now;
  order.updatedAt = now;
  order.expiresAt = now + bidKingMarketOrderDurationMs('trade');
  order.publicAt = now;
  order.expiredAt = undefined;
  order.sourceExchangeLunchItemUid = order.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(order.id);
  order.sourceExchangeTradeCount = Math.min(
    Math.max(0, Math.floor(order.sourceExchangeTradeCount ?? 0)),
    Math.max(1, Math.floor(order.quantity))
  );
  profile.updatedAt = now;
  return {
    errorCode: 0,
    lunchItemUid: order.sourceExchangeLunchItemUid,
    orderId: order.id,
    reLanchItemUid: safeItemUid
  };
}

export function cancelExchangeLanchItemForProfile(
  profile: PlayerProfile,
  itemUid: number,
  recordTransaction: ProfileTransactionRecorder
): ExchangeUnlanchItemResponse {
  ensureProfileShape(profile);
  const safeItemUid = Math.max(1, Math.floor(itemUid));
  const order = findExchangeOrderByItemUid(profile, safeItemUid);
  if (!order) {
    throw new Error('交易品不存在');
  }
  const changed = cancelMarketOrderForProfile(profile, order.id, recordTransaction);
  if (!changed && order.status !== 'cancelled' && order.status !== 'expired') {
    throw new Error('交易品无法下架');
  }
  return {
    errorCode: 0,
    itemUid: safeItemUid,
    orderId: order.id
  };
}

export function buildExchangeLanchItemListSnapshot(
  profile: PlayerProfile,
  now = Date.now()
): ExchangeLunchItemListSnapshot {
  ensureProfileShape(profile);
  return {
    generatedAt: now,
    errorCode: 0,
    lunchItemList: profile.marketOrders
      .filter(isActiveExchangeOrder)
      .map((order) => buildExchangeLunchItem(order))
  };
}

export function buildExchangeInfoSnapshot(
  profiles: Iterable<PlayerProfile>,
  now = Date.now(),
  excludeSellerPlayerId?: string
): ExchangeInfoSnapshot {
  const minPriceByItemCid = new Map<number, number>();
  for (const candidate of exchangeLiveOrderCandidates(profiles, undefined, now)) {
    if (excludeSellerPlayerId && candidate.sellerProfile.playerId === excludeSellerPlayerId) {
      continue;
    }
    const currentMin = minPriceByItemCid.get(candidate.itemCid);
    if (currentMin === undefined || candidate.unitPrice < currentMin) {
      minPriceByItemCid.set(candidate.itemCid, candidate.unitPrice);
    }
  }
  return {
    generatedAt: now,
    errorCode: 0,
    allItemPriceInfo: [...minPriceByItemCid.entries()]
      .map(([itemCid, price]) => ({ itemCid, price }))
      .sort((left, right) => left.itemCid - right.itemCid)
  };
}

export function buildExchangeItemTradeInfoListSnapshot(
  profiles: Iterable<PlayerProfile>,
  itemCid: number,
  now = Date.now(),
  excludeSellerPlayerId?: string
): ExchangeItemTradeInfoListSnapshot {
  const safeItemCid = Math.max(1, Math.floor(itemCid));
  const countByPrice = new Map<number, number>();
  for (const candidate of exchangeLiveOrderCandidates(profiles, safeItemCid, now)) {
    if (excludeSellerPlayerId && candidate.sellerProfile.playerId === excludeSellerPlayerId) {
      continue;
    }
    countByPrice.set(candidate.unitPrice, (countByPrice.get(candidate.unitPrice) ?? 0) + candidate.availableCount);
  }
  return {
    generatedAt: now,
    errorCode: 0,
    tradeInfoList: [...countByPrice.entries()]
      .map(([price, peopleCount]) => ({ price, peopleCount }))
      .sort((left, right) => left.price - right.price)
  };
}

export function buyExchangeItemForProfiles(
  profiles: Iterable<PlayerProfile>,
  buyerProfile: PlayerProfile,
  itemCid: number,
  itemCount: number,
  estimatePrice: number,
  applyNumberChange: ProfileNumberChangeApplier,
  recordTransaction: ProfileTransactionRecorder,
  now = Date.now()
): ExchangeBuyItemResponse {
  ensureProfileShape(buyerProfile);
  assertExchangeBuyLevel(buyerProfile);
  const profileList = [...profiles];
  const safeItemCid = Math.max(1, Math.floor(itemCid));
  const safeItemCount = Math.max(1, Math.floor(itemCount));
  const safeEstimatePrice = Math.max(0, Math.floor(estimatePrice));
  const plan = buildExchangeBuyFillPlan(profileList, buyerProfile.playerId, safeItemCid, safeItemCount, now);
  if (plan.remainingCount > 0 || plan.totalPrice !== safeEstimatePrice || safeEstimatePrice <= 0) {
    throw new Error('交易信息过期');
  }
  if (buyerProfile.coins < plan.totalPrice) {
    throw new Error('买家铜钱不足');
  }
  const stockItemCidsToReceive = plan.fills.flatMap((fill) => marketOrderStockItemCidsToReceive(fill.order, fill.count));
  assertCanAddStockItemsToWarehouse(
    buyerProfile,
    stockItemCidsToReceive,
    now,
    '仓库空间不足，无法购买交易品'
  );
  const buyerSource = `exchange:${buyerProfile.playerId}:${now}:buy:${safeItemCid}:${safeItemCount}:${plan.totalPrice}`;
  applyNumberChange(buyerProfile, `${buyerSource}:coins`, 'exchange_buy_spend', 'coins', -plan.totalPrice);
  for (const [index, fill] of plan.fills.entries()) {
    const fillSource = `${buyerSource}:fill:${index}:${fill.order.id}`;
    const buyerBefore = inventoryQuantity(buyerProfile, fill.order.refId);
    transferExchangeOrderItemsToBuyer(fill.order, buyerProfile, fill.count, now, `${fillSource}:item`);
    recordTransaction(buyerProfile, `${fillSource}:item`, 'exchange_bought_item', 'item', buyerBefore, fill.count);

    const fee = marketOrderPriceBreakdown(fill.order.refId, fill.unitPrice, fill.count).tax;
    applyNumberChange(fill.sellerProfile, `${fillSource}:sold`, 'exchange_order_sold', 'coins', fill.totalPrice);
    if (fee > 0) {
      applyNumberChange(fill.sellerProfile, `${fillSource}:fee`, 'exchange_order_fee', 'coins', -fee);
    }
    applyExchangeOrderFill(fill.sellerProfile, fill.order, buyerProfile, fill.count, fill.totalPrice, now);
    incrementTradeConditionStat(fill.sellerProfile, 'tradeSoldCount');
  }
  incrementTradeConditionStat(buyerProfile, 'tradeBoughtCount');
  buyerProfile.updatedAt = now;
  return {
    errorCode: 0,
    itemCid: safeItemCid,
    itemCount: safeItemCount,
    estimatePrice: safeEstimatePrice
  };
}

export function buildExchangeTradeInfoListSnapshot(
  profile: PlayerProfile,
  profiles: Iterable<PlayerProfile>,
  now = Date.now()
): ExchangeTradeInfoListSnapshot {
  ensureProfileShape(profile);
  const trades = [...profiles].flatMap((sellerProfile) => {
    ensureProfileShape(sellerProfile);
    return sellerProfile.marketOrders.flatMap((order) => order.sourceExchangeTrades ?? []);
  });
  const tradeInfoInList = trades
    .filter((trade) => trade.buyerId === profile.playerId)
    .map((trade) => buildExchangeTradeInfoSnapshot(trade))
    .sort(compareExchangeTradeInfoByTime);
  const tradeInfoOutList = trades
    .filter((trade) => trade.sellerId === profile.playerId)
    .map((trade) => buildExchangeTradeInfoSnapshot(trade))
    .sort(compareExchangeTradeInfoByTime);
  return {
    generatedAt: now,
    errorCode: 0,
    tradeInfoInList,
    tradeInfoOutList
  };
}

export function collectExchangeItemForProfile(
  profile: PlayerProfile,
  itemCid: number,
  collected: boolean,
  recordTransaction: ProfileTransactionRecorder,
  now = Date.now()
): ExchangeCollectItemResponse {
  ensureProfileShape(profile);
  const safeItemCid = assertExchangeCollectItemCid(itemCid);
  profile.exchangeCollections ??= [];
  const existing = profile.exchangeCollections.includes(safeItemCid);
  if (existing !== collected) {
    const before = existing ? 1 : 0;
    profile.exchangeCollections = collected
      ? [...profile.exchangeCollections, safeItemCid].sort((left, right) => left - right)
      : profile.exchangeCollections.filter((candidate) => candidate !== safeItemCid);
    profile.updatedAt = now;
    recordTransaction(
      profile,
      `exchange_collect:${profile.playerId}:${safeItemCid}:${collected ? 'on' : 'off'}:${now}`,
      collected ? 'exchange_collect_item' : 'exchange_uncollect_item',
      'task',
      before,
      collected ? 1 : -1
    );
  }
  return {
    errorCode: 0,
    itemCid: safeItemCid
  };
}

export function buildExchangeCollectItemListSnapshot(
  profile: PlayerProfile,
  now = Date.now()
): ExchangeCollectItemListSnapshot {
  ensureProfileShape(profile);
  return {
    generatedAt: now,
    errorCode: 0,
    collectItemList: [...new Set(profile.exchangeCollections ?? [])]
      .map((itemCid) => Math.max(1, Math.floor(itemCid)))
      .filter((itemCid) => Item.some((row) => row.id === itemCid))
      .sort((left, right) => left - right)
  };
}

export function buildAuctionHouseLanchItemListSnapshot(
  profile: PlayerProfile,
  now = Date.now()
): AuctionHouseLanchItemListSnapshot {
  ensureProfileShape(profile);
  const lanchItemList = profile.marketOrders
    .filter(isActiveAuctionHouseOrder)
    .map((order) => buildAuctionHouseLanchItem(order));
  return {
    generatedAt: now,
    errorCode: 0,
    lanchItemList,
    lanchMax: marketListingSlotLimit(profile, 'auction')
  };
}

export function buildAuctionHouseItemInfoSnapshot(
  profiles: Iterable<PlayerProfile>,
  options: AuctionHouseItemListOptions = {}
): AuctionHouseItemInfoSnapshot {
  const now = options.now ?? Date.now();
  const orders = [...profiles]
    .flatMap((profile) => {
      ensureProfileShape(profile);
      return profile.marketOrders
        .filter(isActiveAuctionHouseOrder)
        .map((order) => ({
          ...order,
          playerId: profile.playerId,
          playerName: profile.name,
          sourceAuctionHouseLanchItem: buildAuctionHouseLanchItem(order)
        }));
    });
  return buildAuctionHouseItemInfoSnapshotFromOrders(orders, { ...options, now });
}

export function cancelAuctionHouseLanchItemForProfile(
  profile: PlayerProfile,
  itemUid: number,
  recordTransaction: ProfileTransactionRecorder,
  refundAuctionHouseBidEscrow?: AuctionHouseBidEscrowRefundApplier,
  settleExpiredAuctionHouseOrder?: AuctionHouseExpiredSettlementApplier
): AuctionHouseUnlanchItemResponse {
  ensureProfileShape(profile);
  const safeItemUid = Math.max(1, Math.floor(itemUid));
  const order = profile.marketOrders.find((candidate) => (
    isActiveAuctionHouseOrder(candidate) &&
    (candidate.sourceAuctionHouseLanchItemUid ?? bidKingAuctionHouseLanchItemUidForOrderId(candidate.id)) === safeItemUid
  ));
  if (!order) {
    throw new Error('拍卖品不存在');
  }
  const changed = cancelMarketOrderForProfile(profile, order.id, recordTransaction, refundAuctionHouseBidEscrow, settleExpiredAuctionHouseOrder);
  if (!changed && order.status !== 'cancelled' && order.status !== 'expired') {
    throw new Error('拍卖品无法下架');
  }
  return {
    errorCode: 0,
    itemUid: safeItemUid,
    orderId: order.id
  };
}

export function unlockAuctionHouseLanchSlotForProfile(
  profile: PlayerProfile,
  unlockCount: number,
  applyNumberChange: ProfileNumberChangeApplier,
  now = Date.now()
): AuctionHouseUnlockLanchSlotResponse {
  ensureProfileShape(profile);
  const safeUnlockCount = Math.floor(unlockCount);
  if (!Number.isFinite(unlockCount) || safeUnlockCount < 1) {
    throw new Error('解锁数量需为正整数');
  }
  const currentLanchMax = marketListingSlotLimit(profile, 'auction');
  const nextLanchMax = currentLanchMax + safeUnlockCount;
  const maxLanch = auctionHouseLanchSlotUnlockMax();
  if (currentLanchMax >= maxLanch || nextLanchMax > maxLanch) {
    throw new Error('拍卖上架槽位已达上限');
  }
  const cost = auctionHouseLanchSlotUnlockCost(currentLanchMax, safeUnlockCount);
  if (profile.coins < cost) {
    throw new Error('铜钱不足，无法解锁拍卖上架槽位');
  }
  const currentUnlocks = marketListingSlotUnlockCount(profile);
  applyNumberChange(
    profile,
    `auction_house:${profile.playerId}:${now}:unlock_lanch_slot:${currentUnlocks}:${safeUnlockCount}`,
    'auction_house_unlock_lanch_slot',
    'coins',
    -cost
  );
  profile.settings.bidkingMarketSlotUnlocks = currentUnlocks + safeUnlockCount;
  profile.updatedAt = now;
  return {
    errorCode: 0,
    unlockCount: safeUnlockCount,
    cost,
    lanchMax: marketListingSlotLimit(profile, 'auction')
  };
}

export function bidAuctionHousePriceForProfiles(
  profiles: Iterable<PlayerProfile>,
  bidderProfile: PlayerProfile,
  itemUid: number,
  price: number,
  applyNumberChange: ProfileNumberChangeApplier,
  recordTransaction: ProfileTransactionRecorder,
  now = Date.now()
): AuctionHouseBidPriceResponse {
  ensureProfileShape(bidderProfile);
  const profileList = [...profiles];
  const safeItemUid = Math.max(1, Math.floor(itemUid));
  const safePrice = Math.max(1, Math.floor(price));
  const orderRef = findAuctionHouseOrderByUid(profileList, safeItemUid);
  if (!orderRef) {
    throw new Error('拍卖品不存在');
  }
  const { order, profile: sellerProfile } = orderRef;
  if (!isActiveAuctionHouseOrder(order) || isMarketOrderExpired(order, now)) {
    throw new Error('拍卖品已结束');
  }
  if (sellerProfile.playerId === bidderProfile.playerId) {
    throw new Error('不能竞拍自己的拍卖品');
  }
  const minBidPrice = minimumAuctionHouseBidPrice(order);
  if (safePrice < minBidPrice) {
    throw new Error(`出价需不低于 ${minBidPrice}`);
  }
  const previousTopBidderId = order.sourceAuctionHouseMaxBidderId;
  const previousTopBidderPrice = Math.max(0, Math.floor(order.sourceAuctionHouseMaxPrice ?? highestAuctionHouseBidPrice(order)));
  const existingBid = latestAuctionHouseBidForPlayer(order, bidderProfile.playerId);
  const existingBidPrice = existingBid?.bidPrice ?? 0;
  const bidderIsTop = previousTopBidderId === bidderProfile.playerId;
  const requiredCoins = bidderIsTop ? Math.max(0, safePrice - existingBidPrice) : safePrice;
  if (bidderProfile.coins < requiredCoins) {
    throw new Error('竞拍铜钱不足');
  }
  if (previousTopBidderId && previousTopBidderId !== bidderProfile.playerId && previousTopBidderPrice > 0) {
    const previousTopProfile = profileList.find((profile) => profile.playerId === previousTopBidderId);
    if (previousTopProfile) {
      applyNumberChange(
        previousTopProfile,
        `auction_house:${order.id}:${previousTopBidderId}:${now}:refund`,
        'auction_house_bid_refund',
        'coins',
        previousTopBidderPrice
      );
    }
  }
  if (requiredCoins > 0) {
    applyNumberChange(
      bidderProfile,
      `auction_house:${order.id}:${bidderProfile.playerId}:${now}:bid`,
      'auction_house_bid_price',
      'coins',
      -requiredCoins
    );
  }
  const bidState: MarketOrderAuctionHouseBidState = {
    playerId: bidderProfile.playerId,
    playerName: bidderProfile.name,
    bidTime: toSourceUnixSeconds(now),
    bidPrice: safePrice
  };
  order.sourceAuctionHouseBidLogs = upsertAuctionHouseBidLog(order.sourceAuctionHouseBidLogs ?? [], bidState);
  order.sourceAuctionHouseMaxPrice = safePrice;
  order.sourceAuctionHouseMaxBidderId = bidderProfile.playerId;
  order.sourceAuctionHouseMaxBidderName = bidderProfile.name;
  order.sourceAuctionHouseMaxBidAt = now;
  order.updatedAt = now;
  recordTransaction(
    bidderProfile,
    `auction_house:${order.id}:${bidderProfile.playerId}:${now}:log`,
    'auction_house_bid_log',
    'task',
    existingBidPrice,
    safePrice - existingBidPrice
  );
  sellerProfile.updatedAt = now;
  bidderProfile.updatedAt = now;
  const bidLog = buildAuctionHouseBidLogSnapshot(order, bidState);
  return {
    errorCode: 0,
    itemUid: safeItemUid,
    price: safePrice,
    bidLog
  };
}

export function buildAuctionHouseBidLogListSnapshot(
  profile: PlayerProfile,
  profiles: Iterable<PlayerProfile>,
  now = Date.now()
): AuctionHouseBidLogListSnapshot {
  ensureProfileShape(profile);
  const bidLogList = [...profiles]
    .flatMap((sellerProfile) => {
      ensureProfileShape(sellerProfile);
      return sellerProfile.marketOrders
        .filter(isActiveAuctionHouseOrder)
        .filter((order) => !isMarketOrderExpired(order, now))
        .map((order) => {
          const bid = latestAuctionHouseBidForPlayer(order, profile.playerId);
          return bid ? buildAuctionHouseBidLogSnapshot(order, bid) : undefined;
        })
        .filter((log): log is AuctionHouseBidLogSnapshot => Boolean(log));
    })
    .sort((left, right) => right.bidTime - left.bidTime);
  return {
    generatedAt: now,
    errorCode: 0,
    bidLogList
  };
}

export function buildAuctionHouseTradeInfoListSnapshot(
  profile: PlayerProfile,
  profiles: Iterable<PlayerProfile>,
  now = Date.now()
): AuctionHouseTradeInfoListSnapshot {
  ensureProfileShape(profile);
  const soldAuctionOrders = [...profiles]
    .flatMap((sellerProfile) => {
      ensureProfileShape(sellerProfile);
      return sellerProfile.marketOrders
        .filter((order) => order.orderType === 'auction' && order.status === 'sold')
        .map((order) => ({ order, sellerProfile }));
    });
  const tradeInfoInList = soldAuctionOrders
    .filter(({ order }) => order.buyerId === profile.playerId)
    .map(({ order }) => buildAuctionHouseTradeInfoSnapshot(order))
    .sort(compareAuctionHouseTradeInfoByTime);
  const tradeInfoOutList = soldAuctionOrders
    .filter(({ sellerProfile }) => sellerProfile.playerId === profile.playerId)
    .map(({ order }) => buildAuctionHouseTradeInfoSnapshot(order))
    .sort(compareAuctionHouseTradeInfoByTime);
  return {
    generatedAt: now,
    errorCode: 0,
    tradeInfoInList,
    tradeInfoOutList
  };
}

export function buildAuctionHouseItemPriceInfoListSnapshot(
  profiles: Iterable<PlayerProfile>,
  now = Date.now()
): AuctionHouseItemPriceInfoListSnapshot {
  const aggregates = new Map<number, { activeCount: number; tradeCount: number; tradeTotal: number }>();
  for (const profile of profiles) {
    ensureProfileShape(profile);
    for (const order of profile.marketOrders) {
      if (order.orderType !== 'auction') {
        continue;
      }
      const itemCid = auctionHouseOrderItemCid(order);
      if (itemCid <= 0) {
        continue;
      }
      const aggregate = aggregates.get(itemCid) ?? { activeCount: 0, tradeCount: 0, tradeTotal: 0 };
      if (isActiveAuctionHouseOrder(order) && !isMarketOrderExpired(order, now)) {
        aggregate.activeCount += buildAuctionHouseLanchItem(order).count;
      }
      if (order.status === 'sold') {
        const tradePrice = Math.max(0, Math.floor(order.sourceAuctionHouseTradePrice ?? order.totalPrice ?? order.sourceAuctionHouseMaxPrice ?? order.price));
        if (tradePrice > 0) {
          aggregate.tradeCount += 1;
          aggregate.tradeTotal += tradePrice;
        }
      }
      aggregates.set(itemCid, aggregate);
    }
  }
  const allAuctionHouseItemPriceInfo: AuctionHouseItemPriceInfoSnapshot[] = [...aggregates.entries()]
    .filter(([, aggregate]) => aggregate.activeCount > 0 || aggregate.tradeCount > 0)
    .map(([itemCid, aggregate]) => ({
      itemCid,
      avgPrice: aggregate.tradeCount > 0 ? Math.floor(aggregate.tradeTotal / aggregate.tradeCount) : 0,
      count: aggregate.activeCount
    }))
    .sort((left, right) => right.itemCid - left.itemCid);
  return {
    generatedAt: now,
    errorCode: 0,
    allAuctionHouseItemPriceInfo
  };
}

export function settleExpiredAuctionHouseOrderForProfile(
  sellerProfile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  bidderProfile: PlayerProfile,
  applyNumberChange: ProfileNumberChangeApplier,
  recordTransaction: ProfileTransactionRecorder,
  now = Date.now()
): boolean {
  ensureProfileShape(sellerProfile);
  ensureProfileShape(bidderProfile);
  if (order.orderType !== 'auction' || order.status !== 'listed') {
    return false;
  }
  const bidderId = order.sourceAuctionHouseMaxBidderId;
  const settlementPrice = Math.max(0, Math.floor(order.sourceAuctionHouseMaxPrice ?? highestAuctionHouseBidPrice(order)));
  if (!bidderId || bidderId !== bidderProfile.playerId || settlementPrice <= 0) {
    return false;
  }
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
  const stockItemCidsToReceive = marketOrderStockItemCidsToReceive(order, order.quantity);
  if (stockItemCidsToReceive.length > 0) {
    assertCanAddStockItemsToWarehouse(
      bidderProfile,
      stockItemCidsToReceive,
      now,
      '仓库空间不足，无法购买拍卖品'
    );
  }
  const buyerSource = `auction_house:${sellerProfile.playerId}:${order.id}:buyer:${bidderProfile.playerId}`;
  const buyerBefore = inventoryQuantity(bidderProfile, order.refId);
  if (lockedStockBoxes.length > 0) {
    returnStockBoxesToWarehouse(bidderProfile, lockedStockBoxes, now, { preserveBoxIds: false });
    incrementInventoryCounter(bidderProfile, 'warehouse', order.refId, order.quantity, now);
  } else {
    addInventory(bidderProfile, 'auction', order.refId, order.quantity, `${buyerSource}:item`);
  }
  recordTransaction(bidderProfile, `${buyerSource}:item`, 'auction_house_bought_item', 'item', buyerBefore, order.quantity);
  order.fee = marketOrderFee(order.refId, settlementPrice);
  order.totalPrice = settlementPrice;
  order.netPrice = Math.max(0, settlementPrice - order.fee);
  order.buyerId = bidderProfile.playerId;
  order.buyerName = bidderProfile.name;
  order.status = 'sold';
  order.soldAt = now;
  order.updatedAt = now;
  order.sourceAuctionHouseTradeTime = toSourceUnixSeconds(now);
  order.sourceAuctionHouseTradePrice = settlementPrice;
  applyNumberChange(sellerProfile, `auction_house:${sellerProfile.playerId}:${order.id}:sold`, 'auction_house_order_sold', 'coins', settlementPrice);
  if (order.fee > 0) {
    applyNumberChange(sellerProfile, `auction_house:${sellerProfile.playerId}:${order.id}:fee`, 'auction_house_order_fee', 'coins', -order.fee);
  }
  incrementTradeConditionStat(bidderProfile, 'tradeBoughtCount');
  incrementTradeConditionStat(sellerProfile, 'tradeSoldCount');
  bidderProfile.updatedAt = now;
  sellerProfile.updatedAt = now;
  return true;
}

interface ExchangeLiveOrderCandidate {
  sellerProfile: PlayerProfile;
  order: PlayerProfile['marketOrders'][number];
  itemCid: number;
  unitPrice: number;
  availableCount: number;
}

interface ExchangeBuyFill {
  sellerProfile: PlayerProfile;
  order: PlayerProfile['marketOrders'][number];
  unitPrice: number;
  count: number;
  totalPrice: number;
}

interface ExchangeBuyFillPlan {
  fills: ExchangeBuyFill[];
  remainingCount: number;
  totalPrice: number;
}

function exchangeLiveOrderCandidates(
  profiles: Iterable<PlayerProfile>,
  itemCid: number | undefined,
  now: number
): ExchangeLiveOrderCandidate[] {
  const safeItemCid = itemCid !== undefined ? Math.max(1, Math.floor(itemCid)) : undefined;
  const candidates: ExchangeLiveOrderCandidate[] = [];
  for (const sellerProfile of profiles) {
    ensureProfileShape(sellerProfile);
    for (const order of sellerProfile.marketOrders) {
      if (!isActiveExchangeOrder(order) || isMarketOrderExpired(order, now)) {
        continue;
      }
      const candidateItemCid = exchangeOrderItemCid(order);
      if (candidateItemCid <= 0 || (safeItemCid !== undefined && candidateItemCid !== safeItemCid)) {
        continue;
      }
      const availableCount = marketOrderRemainingQuantity(order);
      if (availableCount <= 0) {
        continue;
      }
      candidates.push({
        sellerProfile,
        order,
        itemCid: candidateItemCid,
        unitPrice: exchangeOrderUnitPrice(order),
        availableCount
      });
    }
  }
  return candidates;
}

function buildExchangeBuyFillPlan(
  profiles: Iterable<PlayerProfile>,
  buyerPlayerId: string,
  itemCid: number,
  itemCount: number,
  now: number
): ExchangeBuyFillPlan {
  const fills: ExchangeBuyFill[] = [];
  let remainingCount = itemCount;
  let totalPrice = 0;
  const candidates = exchangeLiveOrderCandidates(profiles, itemCid, now)
    .filter((candidate) => candidate.sellerProfile.playerId !== buyerPlayerId)
    .sort(compareExchangeLiveOrderCandidatesForBuy);
  for (const candidate of candidates) {
    if (remainingCount <= 0) {
      break;
    }
    const count = Math.min(remainingCount, candidate.availableCount);
    if (count <= 0) {
      continue;
    }
    const fillTotalPrice = candidate.unitPrice * count;
    fills.push({
      sellerProfile: candidate.sellerProfile,
      order: candidate.order,
      unitPrice: candidate.unitPrice,
      count,
      totalPrice: fillTotalPrice
    });
    remainingCount -= count;
    totalPrice += fillTotalPrice;
  }
  return {
    fills,
    remainingCount,
    totalPrice
  };
}

function marketOrderStockItemCidsToReceive(
  order: PlayerProfile['marketOrders'][number],
  count: number
): number[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) {
    return [];
  }
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
  const stockItemCids = lockedStockBoxes
    .slice(0, safeCount)
    .map((box) => box.item.cid);
  const looseQuantity = safeCount - stockItemCids.length;
  if (looseQuantity > 0 && isStockBackedInventoryRef(order.refId)) {
    const itemCid = marketOrderItemCid(order);
    if (itemCid > 0) {
      stockItemCids.push(...Array.from({ length: looseQuantity }, () => itemCid));
    }
  }
  return stockItemCids;
}

function compareExchangeLiveOrderCandidatesForBuy(
  left: ExchangeLiveOrderCandidate,
  right: ExchangeLiveOrderCandidate
): number {
  if (left.unitPrice !== right.unitPrice) {
    return left.unitPrice - right.unitPrice;
  }
  if (left.order.createdAt !== right.order.createdAt) {
    return left.order.createdAt - right.order.createdAt;
  }
  return left.order.id.localeCompare(right.order.id);
}

function transferExchangeOrderItemsToBuyer(
  order: PlayerProfile['marketOrders'][number],
  buyerProfile: PlayerProfile,
  count: number,
  now: number,
  sourceId: string
): void {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) {
    return;
  }
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
  const stockBoxesToMove = lockedStockBoxes.slice(0, safeCount);
  if (stockBoxesToMove.length > 0) {
    returnStockBoxesToWarehouse(buyerProfile, stockBoxesToMove, now, { preserveBoxIds: false });
    incrementInventoryCounter(buyerProfile, 'warehouse', order.refId, stockBoxesToMove.length, now);
    order.lockedStockBoxes = lockedStockBoxes.slice(stockBoxesToMove.length);
  }
  const looseQuantity = safeCount - stockBoxesToMove.length;
  if (looseQuantity > 0) {
    addInventory(buyerProfile, 'warehouse', order.refId, looseQuantity, sourceId);
  }
}

function applyExchangeOrderFill(
  sellerProfile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  buyerProfile: PlayerProfile,
  count: number,
  totalPrice: number,
  now: number
): void {
  const safeCount = Math.max(1, Math.floor(count));
  const safeTotalPrice = Math.max(1, Math.floor(totalPrice));
  const itemCid = exchangeOrderItemCid(order);
  const quantity = Math.max(1, Math.floor(order.quantity));
  const tradeCount = Math.min(quantity, Math.max(0, Math.floor(order.sourceExchangeTradeCount ?? 0)) + safeCount);
  const lunchItemUid = order.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(order.id);
  const trade: MarketOrderSourceExchangeTrade = {
    tradeTime: toSourceUnixSeconds(now),
    itemCid,
    itemCount: safeCount,
    price: safeTotalPrice,
    buyerId: buyerProfile.playerId,
    buyerName: buyerProfile.name,
    sellerId: sellerProfile.playerId,
    sellerName: sellerProfile.name,
    orderId: order.id,
    lunchItemUid
  };
  order.sourceExchangeLunchItemUid = lunchItemUid;
  order.sourceExchangeTradeCount = tradeCount;
  order.sourceExchangeTrades = [...(order.sourceExchangeTrades ?? []), trade];
  order.updatedAt = now;
  if (tradeCount >= quantity) {
    order.status = 'sold';
    order.soldAt = now;
    order.buyerId = buyerProfile.playerId;
    order.buyerName = buyerProfile.name;
    order.lockedStockBoxes = [];
  }
  sellerProfile.updatedAt = now;
}

function exchangeOrderUnitPrice(order: PlayerProfile['marketOrders'][number]): number {
  const quantity = Math.max(1, Math.floor(order.quantity ?? 1));
  const totalPrice = Math.max(1, Math.floor(order.sourceExchangeTotalPrice ?? order.totalPrice ?? order.price * quantity));
  return Math.max(1, Math.floor(totalPrice / quantity));
}

function exchangeOrderItemCid(order: PlayerProfile['marketOrders'][number]): number {
  return marketOrderItemCid(order);
}

function buildExchangeTradeInfoSnapshot(
  trade: MarketOrderSourceExchangeTrade
): ExchangeTradeInfoSnapshot {
  return {
    tradeTime: Math.max(0, Math.floor(trade.tradeTime)),
    itemCid: Math.max(0, Math.floor(trade.itemCid)),
    itemCount: Math.max(1, Math.floor(trade.itemCount)),
    price: Math.max(0, Math.floor(trade.price))
  };
}

function compareExchangeTradeInfoByTime(
  left: ExchangeTradeInfoSnapshot,
  right: ExchangeTradeInfoSnapshot
): number {
  if (left.tradeTime !== right.tradeTime) {
    return right.tradeTime - left.tradeTime;
  }
  return right.price - left.price;
}

function activeMarketOrderSlotCount(profile: PlayerProfile, orderType: 'trade' | 'auction'): number {
  ensureProfileShape(profile);
  return profile.marketOrders
    .filter((order) => order.orderType === orderType && (order.status === 'listed' || order.status === 'locked'))
    .reduce((sum, order) => sum + marketOrderListingSlotUsage(order.refId, order.quantity, order.orderType), 0);
}

function marketListingSlotLimit(profile: PlayerProfile, orderType: 'trade' | 'auction'): number {
  if (orderType === 'trade') {
    return Math.max(1, Math.floor(constantNumber('listed_quantity', 10)));
  }
  return Math.min(auctionHouseLanchSlotUnlockMax(), bidKingMarketListingSlotBase() + marketListingSlotUnlockCount(profile));
}

function marketOrderListingSlotUsage(
  refId: string,
  quantity: number,
  orderType: 'trade' | 'auction'
): number {
  if (orderType !== 'trade') {
    return 1;
  }
  const chunkSize = sourceExchangeListingChunkSize(refId);
  if (!Number.isFinite(chunkSize)) {
    return 1;
  }
  return Math.max(1, Math.ceil(Math.max(1, Math.floor(quantity)) / chunkSize));
}

function sourceExchangeListingChunkSize(refId: string): number {
  const item = Item.find((row) => String(row.id) === String(refId));
  const maxPerListing = Math.floor(Number(item?.max_per_listing) || 0);
  return maxPerListing > 0 ? maxPerListing : Number.MAX_SAFE_INTEGER;
}

function splitExchangeListingQuantity(quantity: number, chunkSize: number): number[] {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const safeChunkSize = Number.isFinite(chunkSize)
    ? Math.max(1, Math.floor(chunkSize))
    : safeQuantity;
  const chunks: number[] = [];
  for (let remaining = safeQuantity; remaining > 0; remaining -= safeChunkSize) {
    chunks.push(Math.min(safeChunkSize, remaining));
  }
  return chunks;
}

function marketListingSlotUnlockCount(profile: PlayerProfile): number {
  return Math.max(0, Math.floor(Number(profile.settings?.bidkingMarketSlotUnlocks ?? 0) || 0));
}

function auctionHouseLanchSlotUnlockMax(): number {
  const rules = bidKingMarketRuleRuntime();
  return Math.min(bidKingMarketListingSlotMax(), bidKingMarketListingSlotBase() + rules.auctionSlotPrices.length);
}

function auctionHouseLanchSlotUnlockCost(currentLanchMax: number, unlockCount: number): number {
  const rules = bidKingMarketRuleRuntime();
  const base = bidKingMarketListingSlotBase();
  const safeUnlockCount = Math.floor(unlockCount);
  if (!Number.isFinite(unlockCount) || safeUnlockCount < 1) {
    throw new Error('解锁数量需为正整数');
  }
  let cost = 0;
  for (let offset = 0; offset < safeUnlockCount; offset += 1) {
    const price = rules.auctionSlotPrices[Math.max(0, currentLanchMax - base) + offset];
    if (price === undefined) {
      throw new Error('拍卖上架槽位已达上限');
    }
    cost += Math.max(0, Math.floor(price));
  }
  return cost;
}

function marketOrderTotalPrice(order: PlayerProfile['marketOrders'][number]): number {
  return Math.max(1, Math.floor(order.totalPrice ?? order.price * Math.max(1, order.quantity)));
}

function marketOrderRemainingQuantity(order: PlayerProfile['marketOrders'][number]): number {
  const quantity = Math.max(0, Math.floor(order.quantity ?? 0));
  if (order.orderType !== 'trade') {
    return quantity;
  }
  return Math.max(0, quantity - Math.max(0, Math.floor(order.sourceExchangeTradeCount ?? 0)));
}

function incrementTradeConditionStat(profile: PlayerProfile, key: 'tradeBoughtCount' | 'tradeSoldCount'): void {
  ensureProfileShape(profile);
  profile.conditionStats![key] = (profile.conditionStats![key] ?? 0) + 1;
  profile.conditionStats!.updatedAt = Date.now();
}

function isMarketOrderExpired(order: PlayerProfile['marketOrders'][number], now: number): boolean {
  return typeof order.expiresAt === 'number' && order.expiresAt <= now;
}

function isExpiredAuctionHouseOrderAwaitingUnlanch(order: PlayerProfile['marketOrders'][number]): boolean {
  return order.orderType === 'auction' && highestAuctionHouseBidPrice(order) <= 0;
}

function isExpiredExchangeOrderAwaitingAction(order: PlayerProfile['marketOrders'][number]): boolean {
  return order.orderType === 'trade';
}

function expireMarketOrder(
  profile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  recordTransaction: ProfileTransactionRecorder,
  now: number,
  refundAuctionHouseBidEscrow?: AuctionHouseBidEscrowRefundApplier,
  settleExpiredAuctionHouseOrder?: AuctionHouseExpiredSettlementApplier
): void {
  if (settleExpiredAuctionHouseOrder?.(profile, order, now)) {
    return;
  }
  const before = inventoryQuantity(profile, order.refId);
  const returnQuantity = marketOrderRemainingQuantity(order);
  refundAuctionHouseBidEscrow?.(order, now);
  returnMarketOrderInventory(profile, order, now, `market:${profile.playerId}:${order.id}:expire`);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}:expire`, 'market_order_expired_return', 'item', before, returnQuantity);
  order.status = 'expired';
  order.expiredAt = now;
  order.updatedAt = now;
  profile.updatedAt = now;
}

function returnMarketOrderInventory(
  profile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  now: number,
  sourceId: string
): void {
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
  const returnQuantity = marketOrderRemainingQuantity(order);
  if (returnQuantity <= 0) {
    return;
  }
  if (lockedStockBoxes.length > 0) {
    const boxesToReturn = lockedStockBoxes.slice(0, returnQuantity);
    const stockItemCidsToReturn = marketOrderStockItemCidsToReceive(order, returnQuantity);
    assertCanAddStockItemsToWarehouse(
      profile,
      stockItemCidsToReturn,
      now,
      '仓库空间不足，无法返还上架藏品'
    );
    returnStockBoxesToWarehouse(profile, boxesToReturn, now, { preserveBoxIds: true });
    incrementInventoryCounter(profile, 'warehouse', order.refId, boxesToReturn.length, now);
    const looseQuantity = returnQuantity - boxesToReturn.length;
    if (looseQuantity > 0) {
      addInventory(profile, order.orderType, order.refId, looseQuantity, sourceId);
    }
    order.lockedStockBoxes = unlockedStockBoxes(boxesToReturn);
    return;
  }
  const stockItemCidsToReturn = marketOrderStockItemCidsToReceive(order, returnQuantity);
  assertCanAddStockItemsToWarehouse(
    profile,
    stockItemCidsToReturn,
    now,
    '仓库空间不足，无法返还上架藏品'
  );
  addInventory(profile, order.orderType, order.refId, returnQuantity, sourceId);
}

function marketOrderItemMetadata(
  refId: string,
  lockedStockBoxes: readonly ProfileStockBoxState[]
): Pick<PlayerProfile['marketOrders'][number], 'itemCid' | 'itemNo' | 'numberCid'> {
  const item = Item.find((row) => String(row.id) === String(refId) || `compat_${row.id}` === String(refId));
  const firstBox = lockedStockBoxes[0];
  return {
    itemCid: item?.id ?? firstBox?.item.cid,
    numberCid: item?.number?.[1] ?? 0,
    itemNo: firstBox?.item.no
  };
}

function marketOrderSourceAuctionHouseLaunches(
  lockedStockBoxes: readonly ProfileStockBoxState[],
  unitPrice: number,
  durationHours: number,
  orderType: 'trade' | 'auction'
): MarketOrderSourceAuctionHouseLaunch[] {
  const safeUnitPrice = Math.max(1, Math.floor(unitPrice));
  const lanchTime = Math.max(0, Math.floor(durationHours * 3600));
  return lockedStockBoxes.map((box) => ({
    stockId: MAIN_WAREHOUSE_STOCK_ID,
    boxId: bidKingSourceBoxIdForProfileStockBox(box),
    price: orderType === 'auction' ? 0 : safeUnitPrice,
    lanchTime,
    startPrice: safeUnitPrice,
    itemCount: Math.max(1, Math.floor(box.item.count || 1)),
    bagItemCid: 0
  }));
}

function buildAuctionHouseItemInfoSnapshotFromOrders(
  orders: ReadonlyArray<PlayerProfile['marketOrders'][number] & { sourceAuctionHouseLanchItem?: AuctionHouseLanchItemSnapshot }>,
  options: AuctionHouseItemListOptions = {}
): AuctionHouseItemInfoSnapshot {
  const now = options.now ?? Date.now();
  const nowSeconds = toSourceUnixSeconds(now);
  const itemCid = Number.isFinite(options.itemCid) && Number(options.itemCid) > 0 ? Math.floor(Number(options.itemCid)) : undefined;
  const pageSize = Math.max(1, Math.floor(Number(options.pageSize ?? 20)) || 20);
  const page = Math.max(1, Math.floor(Number(options.page ?? 1)) || 1);
  const items = orders
    .filter(isActiveAuctionHouseOrder)
    .filter((order) => !isMarketOrderExpired(order, now))
    .map((order) => order.sourceAuctionHouseLanchItem ?? buildAuctionHouseLanchItem(order))
    .filter((item) => itemCid === undefined || item.itemCid === itemCid)
    .filter((item) => {
      if (options.isDisplayPeriod === undefined) {
        return true;
      }
      const inDisplayPeriod = item.displayPeriodEndTime > nowSeconds;
      return Number(options.isDisplayPeriod) > 0 ? inDisplayPeriod : !inDisplayPeriod;
    })
    .sort((left, right) => compareAuctionHouseLanchItems(left, right, options.sortType ?? 'MaxPrice', Boolean(options.reverse)));
  const totalPage = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPage);
  return {
    generatedAt: now,
    errorCode: 0,
    itemInfoList: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    currentPage: safePage,
    totalPage
  };
}

function buildAuctionHouseLanchItem(
  order: PlayerProfile['marketOrders'][number]
): AuctionHouseLanchItemSnapshot {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  const launch = order.sourceAuctionHouseLaunches?.[0];
  const startPrice = Math.max(1, Math.floor(order.price || launch?.startPrice || 1));
  return {
    lanchItemUid: order.sourceAuctionHouseLanchItemUid ?? bidKingAuctionHouseLanchItemUidForOrderId(order.id),
    itemCid: order.itemCid ?? item?.id ?? (Number(order.refId) || 0),
    numberCid: order.numberCid ?? item?.number?.[1] ?? 0,
    no: Math.max(0, Math.floor(order.itemNo ?? order.lockedStockBoxes?.[0]?.item.no ?? 0)),
    startLanchTime: toSourceUnixSeconds(order.createdAt),
    endLanchTime: toSourceUnixSeconds(order.expiresAt ?? order.createdAt + bidKingMarketOrderDurationMs(order.orderType)),
    displayPeriodEndTime: toDisplayPeriodEndTime(order),
    price: Math.max(0, Math.floor(launch?.price ?? (order.orderType === 'auction' ? 0 : order.price))),
    maxPrice: Math.max(0, Math.floor(order.orderType === 'auction' ? highestAuctionHouseBidPrice(order) : order.price)),
    startPrice,
    count: Math.max(1, Math.floor(launch?.itemCount ?? order.quantity ?? 1))
  };
}

function buildExchangeLunchItem(
  order: PlayerProfile['marketOrders'][number]
): ExchangeLunchItemSnapshot {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  const itemCount = Math.max(1, Math.floor(order.quantity ?? 1));
  return {
    lunchItemUid: order.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(order.id),
    itemCid: order.itemCid ?? item?.id ?? (Number(order.refId) || 0),
    startLunchTime: toSourceUnixSeconds(order.createdAt),
    endLunchTime: toSourceUnixSeconds(order.expiresAt ?? order.createdAt + bidKingMarketOrderDurationMs(order.orderType)),
    itemCount,
    totalPrice: Math.max(1, Math.floor(order.sourceExchangeTotalPrice ?? order.totalPrice ?? order.price * itemCount)),
    tradeCount: Math.min(itemCount, Math.max(0, Math.floor(order.sourceExchangeTradeCount ?? 0)))
  };
}

function auctionHouseOrderItemCid(order: PlayerProfile['marketOrders'][number]): number {
  return marketOrderItemCid(order);
}

function marketOrderItemCid(order: PlayerProfile['marketOrders'][number]): number {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  return order.itemCid ?? item?.id ?? (Number(order.refId) || 0);
}

function assertExchangeCollectItemCid(itemCid: number): number {
  const rawItemCid = Number(itemCid);
  if (!Number.isFinite(rawItemCid) || rawItemCid <= 0) {
    throw new Error('收藏藏品不存在');
  }
  const safeItemCid = Math.floor(rawItemCid);
  if (!Item.some((row) => row.id === safeItemCid)) {
    throw new Error('收藏藏品不存在');
  }
  return safeItemCid;
}

function findExchangeOrderByItemUid(
  profile: PlayerProfile,
  itemUid: number
): PlayerProfile['marketOrders'][number] | undefined {
  return profile.marketOrders.find((candidate) => (
    isActiveExchangeOrder(candidate) &&
    (candidate.sourceExchangeLunchItemUid ?? bidKingExchangeLunchItemUidForOrderId(candidate.id)) === itemUid
  ));
}

function findAuctionHouseOrderByUid(
  profiles: Iterable<PlayerProfile>,
  itemUid: number
): { profile: PlayerProfile; order: PlayerProfile['marketOrders'][number] } | undefined {
  for (const profile of profiles) {
    ensureProfileShape(profile);
    const order = profile.marketOrders.find((candidate) => (
      isActiveAuctionHouseOrder(candidate) &&
      (candidate.sourceAuctionHouseLanchItemUid ?? bidKingAuctionHouseLanchItemUidForOrderId(candidate.id)) === itemUid
    ));
    if (order) {
      return { profile, order };
    }
  }
  return undefined;
}

function isActiveAuctionHouseOrder(order: Pick<PlayerProfile['marketOrders'][number], 'orderType' | 'status'>): boolean {
  return order.orderType === 'auction' && (order.status === 'listed' || order.status === 'locked');
}

function isActiveExchangeOrder(order: Pick<PlayerProfile['marketOrders'][number], 'orderType' | 'status'>): boolean {
  return order.orderType === 'trade' && (order.status === 'listed' || order.status === 'locked');
}

function minimumAuctionHouseBidPrice(order: PlayerProfile['marketOrders'][number]): number {
  const currentMaxPrice = highestAuctionHouseBidPrice(order);
  if (currentMaxPrice > 0) {
    return currentMaxPrice + auctionHouseBidIncrement(order);
  }
  return buildAuctionHouseLanchItem(order).startPrice;
}

function auctionHouseBidIncrement(order: PlayerProfile['marketOrders'][number]): number {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  return Math.max(1, Math.floor(item?.auction_baseprice?.[1] ?? bidKingMarketBidIncrement(order.price)));
}

function highestAuctionHouseBidPrice(order: PlayerProfile['marketOrders'][number]): number {
  return Math.max(
    0,
    Math.floor(order.sourceAuctionHouseMaxPrice ?? 0),
    ...(order.sourceAuctionHouseBidLogs ?? []).map((bid) => Math.max(0, Math.floor(bid.bidPrice)))
  );
}

function latestAuctionHouseBidForPlayer(
  order: PlayerProfile['marketOrders'][number],
  playerId: string
): MarketOrderAuctionHouseBidState | undefined {
  return (order.sourceAuctionHouseBidLogs ?? [])
    .filter((bid) => bid.playerId === playerId)
    .sort((left, right) => right.bidTime - left.bidTime)[0];
}

function upsertAuctionHouseBidLog(
  logs: readonly MarketOrderAuctionHouseBidState[],
  next: MarketOrderAuctionHouseBidState
): MarketOrderAuctionHouseBidState[] {
  return [
    ...logs.filter((log) => log.playerId !== next.playerId),
    next
  ];
}

function buildAuctionHouseBidLogSnapshot(
  order: PlayerProfile['marketOrders'][number],
  bid: MarketOrderAuctionHouseBidState
): AuctionHouseBidLogSnapshot {
  return {
    bidTime: bid.bidTime,
    bidPrice: bid.bidPrice,
    lanchItem: buildAuctionHouseLanchItem(order)
  };
}

function buildAuctionHouseTradeInfoSnapshot(
  order: PlayerProfile['marketOrders'][number]
): AuctionHouseTradeInfoSnapshot {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  return {
    tradeTime: Math.max(0, Math.floor(order.sourceAuctionHouseTradeTime ?? toSourceUnixSeconds(order.soldAt ?? order.updatedAt ?? order.createdAt))),
    itemCid: order.itemCid ?? item?.id ?? (Number(order.refId) || 0),
    numberCid: order.numberCid ?? item?.number?.[1] ?? 0,
    no: Math.max(0, Math.floor(order.itemNo ?? order.lockedStockBoxes?.[0]?.item.no ?? 0)),
    price: Math.max(0, Math.floor(order.sourceAuctionHouseTradePrice ?? order.totalPrice ?? order.sourceAuctionHouseMaxPrice ?? order.price))
  };
}

function compareAuctionHouseTradeInfoByTime(
  left: AuctionHouseTradeInfoSnapshot,
  right: AuctionHouseTradeInfoSnapshot
): number {
  if (left.tradeTime !== right.tradeTime) {
    return right.tradeTime - left.tradeTime;
  }
  return right.price - left.price;
}

function compareAuctionHouseLanchItems(
  left: AuctionHouseLanchItemSnapshot,
  right: AuctionHouseLanchItemSnapshot,
  sortType: AuctionHouseItemSortModel,
  reverse: boolean
): number {
  const direction = reverse ? -1 : 1;
  const leftValue = auctionHouseSortValue(left, sortType);
  const rightValue = auctionHouseSortValue(right, sortType);
  if (leftValue !== rightValue) {
    return (leftValue - rightValue) * direction;
  }
  return (right.startLanchTime - left.startLanchTime) * direction;
}

function auctionHouseSortValue(item: AuctionHouseLanchItemSnapshot, sortType: AuctionHouseItemSortModel): number {
  switch (sortType) {
    case 'Price':
      return item.price;
    case 'StartPrice':
      return item.startPrice;
    case 'LanchTime':
      return item.endLanchTime;
    case 'MaxPrice':
    default:
      return item.maxPrice;
  }
}

function toDisplayPeriodEndTime(order: PlayerProfile['marketOrders'][number]): number {
  const end = toSourceUnixSeconds(order.expiresAt ?? order.createdAt + bidKingMarketOrderDurationMs(order.orderType));
  const publicAt = toSourceUnixSeconds(order.publicAt ?? order.createdAt);
  return Math.min(end, Math.max(toSourceUnixSeconds(order.createdAt), publicAt));
}

function toSourceUnixSeconds(value: number): number {
  return Math.max(0, Math.floor(value / 1000));
}

function bidKingAuctionHouseLanchItemUidForOrderId(orderId: string): number {
  const high = stableHash(`${orderId}:hi`) & 0x1fffff;
  const low = stableHash(`${orderId}:lo`);
  const uid = high * 0x100000000 + low;
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, uid));
}

function bidKingExchangeLunchItemUidForOrderId(orderId: string): number {
  const high = stableHash(`${orderId}:exchange:hi`) & 0x1fffff;
  const low = stableHash(`${orderId}:exchange:lo`);
  const uid = high * 0x100000000 + low;
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, uid));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function decrementInventoryCounter(profile: PlayerProfile, refId: string, quantity: number, now: number): void {
  let remaining = Math.max(0, Math.floor(quantity));
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
    throw new Error('库存不足，无法上架');
  }
  profile.inventory = profile.inventory.filter((entry) => entry.quantity > 0);
  profile.updatedAt = now;
}

function incrementInventoryCounter(profile: PlayerProfile, type: string, refId: string, quantity: number, now: number): void {
  const key = `${type}:${refId}`;
  let entry = profile.inventory.find((candidate) => candidate.key === key);
  if (!entry) {
    entry = {
      key,
      type,
      refId,
      quantity: 0,
      updatedAt: now
    };
    profile.inventory.push(entry);
  }
  entry.quantity += Math.max(0, Math.floor(quantity));
  entry.updatedAt = now;
  profile.updatedAt = now;
}

function unlockedStockBoxes(boxes: readonly ProfileStockBoxState[]): ProfileStockBoxState[] {
  return boxes.map((box) => ({
    boxId: box.boxId,
    position: box.position,
    item: {
      ...box.item,
      boxPositionData: (box.item.boxPositionData ?? []).map((position) => ({ ...position })),
      isLock: false
    }
  }));
}

function inventoryRefMatches(left: number | string, right: number | string): boolean {
  return sourceInventoryItemId(left) === sourceInventoryItemId(right);
}

function sourceInventoryItemId(value: number | string): string {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return compatMatch?.[1] ?? raw;
}
