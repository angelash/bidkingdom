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
  MarketOrderAuctionHouseBidState,
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
  bidKingMarketSnapshotLimit
} from '@bitkingdom/match-core';
import { randomUUID } from 'node:crypto';
import { addInventory, consumeInventory, inventoryQuantity } from '../profile/profileInventory';
import { ensureProfileShape } from '../profile/profileShape';
import {
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

export function createMarketOrderForProfile(
  profile: PlayerProfile,
  refId: string,
  quantity: number,
  price: number,
  orderType: 'trade' | 'auction',
  recordTransaction: ProfileTransactionRecorder,
  note = '',
  applyNumberChange?: ProfileNumberChangeApplier
): void {
  ensureProfileShape(profile);
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const safePrice = Math.max(1, Math.floor(price));
  const safeNote = sanitizeText(note).trim().slice(0, 80);
  const quantityLimit = marketOrderQuantityLimit(refId);
  const durationHours = bidKingMarketOrderDurationHours(orderType);
  const breakdown = marketOrderPriceBreakdown(refId, safePrice, safeQuantity, durationHours);
  const before = inventoryQuantity(profile, refId);
  const now = Date.now();
  if (safeQuantity > quantityLimit) {
    throw new Error(`单笔上架数量不能超过 ${quantityLimit}`);
  }
  const activeListings = activeMarketOrderCount(profile);
  const listingSlotLimit = marketListingSlotLimit(profile);
  if (activeListings >= listingSlotLimit) {
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
    expireMarketOrder(profile, order, recordTransaction, now);
    return true;
  }
  order.fee = order.fee ?? marketOrderFee(order.refId, order.price);
  const totalPrice = marketOrderTotalPrice(order);
  order.totalPrice = totalPrice;
  order.netPrice = Math.max(0, totalPrice - order.fee);
  if (buyerProfile && buyerProfile.playerId !== profile.playerId) {
    ensureProfileShape(buyerProfile);
    if (buyerProfile.coins < totalPrice) {
      throw new Error('买家铜钱不足');
    }
  }
  const lockedStockBoxes = order.lockedStockBoxes ?? [];
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
  refundAuctionHouseBidEscrow?.(order, now);
  returnMarketOrderInventory(profile, order, now, `market:${profile.playerId}:${order.id}:cancel`);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}:cancel`, 'market_order_cancel', 'item', before, order.quantity);
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
    lanchMax: marketListingSlotLimit(profile)
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
  const currentLanchMax = marketListingSlotLimit(profile);
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
    lanchMax: marketListingSlotLimit(profile)
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

function activeMarketOrderCount(profile: PlayerProfile): number {
  ensureProfileShape(profile);
  return profile.marketOrders.filter((order) => order.status === 'listed' || order.status === 'locked').length;
}

function marketListingSlotLimit(profile: PlayerProfile): number {
  return Math.min(auctionHouseLanchSlotUnlockMax(), bidKingMarketListingSlotBase() + marketListingSlotUnlockCount(profile));
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
  refundAuctionHouseBidEscrow?.(order, now);
  returnMarketOrderInventory(profile, order, now, `market:${profile.playerId}:${order.id}:expire`);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}:expire`, 'market_order_expired_return', 'item', before, order.quantity);
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
  if (lockedStockBoxes.length > 0) {
    returnStockBoxesToWarehouse(profile, lockedStockBoxes, now, { preserveBoxIds: true });
    incrementInventoryCounter(profile, 'warehouse', order.refId, order.quantity, now);
    order.lockedStockBoxes = unlockedStockBoxes(lockedStockBoxes);
    return;
  }
  addInventory(profile, order.orderType, order.refId, order.quantity, sourceId);
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

function auctionHouseOrderItemCid(order: PlayerProfile['marketOrders'][number]): number {
  const item = Item.find((row) => String(row.id) === String(order.refId) || `compat_${row.id}` === String(order.refId));
  return order.itemCid ?? item?.id ?? (Number(order.refId) || 0);
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
