import type { MarketOrdersSnapshot, PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import {
  bidKingMailMaxCount,
  bidKingMarketBidIncrement,
  bidKingMarketBidWindowMs,
  bidKingMarketListingSlotBase,
  bidKingMarketListingSlotMax,
  bidKingMarketOrderDurationHours,
  bidKingMarketOrderDurationMs,
  bidKingMarketPublicDelayMs,
  bidKingMarketSnapshotLimit
} from '@bitkingdom/match-core';
import { randomUUID } from 'node:crypto';
import { addInventory, consumeInventory, inventoryQuantity } from '../profile/profileInventory';
import { ensureProfileShape } from '../profile/profileShape';
import { sanitizeText } from '../system/textGuard';
import { marketOrderFee, marketOrderPriceBreakdown, marketOrderQuantityLimit } from './profileCommerceRuntime';

export const MARKET_ORDER_DURATION_MS: Record<'trade' | 'auction', number> = {
  trade: bidKingMarketOrderDurationMs('trade'),
  auction: bidKingMarketOrderDurationMs('auction')
};

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
  if (breakdown.listingCost > 0) {
    if (!applyNumberChange) {
      throw new Error('缺少上架费扣款处理');
    }
    if (profile.coins < breakdown.listingCost) {
      throw new Error('上架费铜钱不足');
    }
    applyNumberChange(profile, `market:${profile.playerId}:${now}:listing_cost`, 'market_order_listing_cost', 'coins', -breakdown.listingCost);
  }
  consumeInventory(profile, refId, safeQuantity);
  const order = {
    id: `order_${randomUUID()}`,
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
  order.status = 'locked';
  order.lockedAt = now;
  order.updatedAt = now;
  if (buyerProfile && buyerProfile.playerId !== profile.playerId) {
    const buyerSource = `market:${profile.playerId}:${order.id}:buyer:${buyerProfile.playerId}`;
    const buyerBefore = inventoryQuantity(buyerProfile, order.refId);
    applyNumberChange(buyerProfile, `${buyerSource}:coins`, 'market_order_buy_spend', 'coins', -totalPrice);
    addInventory(buyerProfile, order.orderType, order.refId, order.quantity, `${buyerSource}:item`);
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
  recordTransaction: ProfileTransactionRecorder
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
  const before = inventoryQuantity(profile, order.refId);
  addInventory(profile, order.orderType, order.refId, order.quantity, `market:${profile.playerId}:${order.id}:cancel`);
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
  now = Date.now()
): number {
  ensureProfileShape(profile);
  let expired = 0;
  for (const order of profile.marketOrders) {
    if (order.status === 'listed' && isMarketOrderExpired(order, now)) {
      expireMarketOrder(profile, order, recordTransaction, now);
      expired += 1;
    }
  }
  return expired;
}

export function buildMarketOrdersSnapshot(
  profiles: Iterable<PlayerProfile>,
  orderType?: 'trade' | 'auction'
): MarketOrdersSnapshot {
  const orders = [...profiles]
    .flatMap((profile) => {
      ensureProfileShape(profile);
      return profile.marketOrders
        .filter((order) => !orderType || order.orderType === orderType)
        .map((order) => ({
          ...order,
          playerId: profile.playerId,
          playerName: profile.name
        }));
    })
    .sort((left, right) => right.createdAt - left.createdAt);
  return {
    generatedAt: Date.now(),
    orders: orders.slice(0, bidKingMarketSnapshotLimit())
  };
}

function activeMarketOrderCount(profile: PlayerProfile): number {
  ensureProfileShape(profile);
  return profile.marketOrders.filter((order) => order.status === 'listed' || order.status === 'locked').length;
}

function marketListingSlotLimit(profile: PlayerProfile): number {
  const unlocked = Math.max(0, Math.floor(Number(profile.settings?.bidkingMarketSlotUnlocks ?? 0) || 0));
  return Math.min(bidKingMarketListingSlotMax(), bidKingMarketListingSlotBase() + unlocked);
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

function expireMarketOrder(
  profile: PlayerProfile,
  order: PlayerProfile['marketOrders'][number],
  recordTransaction: ProfileTransactionRecorder,
  now: number
): void {
  const before = inventoryQuantity(profile, order.refId);
  addInventory(profile, order.orderType, order.refId, order.quantity, `market:${profile.playerId}:${order.id}:expire`);
  recordTransaction(profile, `market:${profile.playerId}:${order.id}:expire`, 'market_order_expired_return', 'item', before, order.quantity);
  order.status = 'expired';
  order.expiredAt = now;
  order.updatedAt = now;
  profile.updatedAt = now;
}
