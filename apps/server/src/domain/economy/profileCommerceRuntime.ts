import { Item, ItemRestock, Shop, ShopItem, bidKingShopRuntimeSummary, shopCanRefresh } from '@bitkingdom/bidking-compat';
import {
  bidKingMarketListingCost,
  bidKingMarketListingFee,
  bidKingMarketPriceNoticeLimit,
  constantNumber
} from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileTransaction, ShopPurchaseState } from '@bitkingdom/shared';
import { addInventory, consumeInventory, inventoryQuantity } from '../profile/profileInventory';
import { ensureProfileShape } from '../profile/profileShape';
import { refreshTicketState } from '../profile/profileTicketRuntime';

type ShopRow = (typeof Shop)[number];

export type ShopAccessChecker = (
  profile: PlayerProfile,
  accessId?: string | number
) => { ok: boolean; reason?: string };

export type ShopNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export type ShopTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export interface MarketOrderPriceBreakdown {
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  listingFee: number;
  tax: number;
  listingCost: number;
  fee: number;
  netPrice: number;
  priceNoticeLimit?: number;
}

export function marketOrderFee(refId: string, price: number): number {
  return marketOrderPriceBreakdown(refId, price, 1).fee;
}

export function marketOrderPriceBreakdown(
  refId: string,
  price: number,
  quantity: number,
  durationHours = 24
): MarketOrderPriceBreakdown {
  const unitPrice = Math.max(1, Math.floor(price));
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const totalPrice = unitPrice * safeQuantity;
  const listingFee = bidKingMarketListingFee(totalPrice);
  const tax = marketOrderTax(refId, unitPrice, safeQuantity);
  const listingCost = bidKingMarketListingCost(unitPrice, durationHours);
  const fee = listingFee + tax;
  const item = Item.find((row) => String(row.id) === String(refId));
  return {
    unitPrice,
    quantity: safeQuantity,
    totalPrice,
    listingFee,
    tax,
    listingCost,
    fee,
    netPrice: Math.max(0, totalPrice - fee),
    priceNoticeLimit: item ? bidKingMarketPriceNoticeLimit(item.base_value) : undefined
  };
}

function marketOrderTax(refId: string, unitPrice: number, quantity: number): number {
  const item = Item.find((row) => String(row.id) === String(refId));
  if (!item) {
    return 0;
  }
  if (String(refId) === '2') {
    return Math.floor((unitPrice * quantity) / 10);
  }
  const brackets = item?.transaction_tax_rate ?? [];
  if (brackets.length === 1 && (brackets[0]?.[0] ?? 0) === 0) {
    return 0;
  }
  const baseValue = Math.max(0, Number(item.base_value) || 0);
  if (baseValue <= 0) {
    return 0;
  }
  let totalTaxValue = 0;
  for (let index = 0; index < brackets.length; index += 1) {
    const [curRate = 0, curFee = 0] = brackets[index] ?? [];
    const [preRate = 0] = index > 0 ? brackets[index - 1] ?? [] : [];
    const multiStartValue = baseValue * (preRate / 1000);
    const multiEndValue = baseValue * (curRate / 1000);
    const calValue = unitPrice >= multiEndValue
      ? multiEndValue - multiStartValue
      : unitPrice < multiStartValue
        ? 0
        : unitPrice - multiStartValue;
    totalTaxValue += Math.max(0, calValue) * (curFee / 1000);
  }
  return Math.floor(totalTaxValue) * quantity;
}

export function legacyMarketOrderFee(refId: string, price: number): number {
  const item = Item.find((row) => String(row.id) === String(refId));
  const brackets = item?.transaction_tax_rate ?? [];
  for (const [limit = 0, fee = 0] of brackets) {
    if (limit <= 0 && fee <= 0) {
      continue;
    }
    if (limit <= 0 || price <= limit) {
      return Math.max(0, Math.floor(fee));
    }
  }
  const fallback = brackets.at(-1);
  return Math.max(0, Math.floor(fallback?.[1] ?? 0));
}

export function marketOrderQuantityLimit(refId: string): number {
  const item = Item.find((row) => String(row.id) === String(refId));
  if (!item) {
    return Number.MAX_SAFE_INTEGER;
  }
  const globalLimit = constantNumber('listed_quantity', Number.MAX_SAFE_INTEGER);
  const limits = [item.max_stack_size, item.max_per_listing, globalLimit]
    .map((value) => Math.floor(Number(value) || 0))
    .filter((value) => value > 0);
  return limits.length > 0 ? Math.min(...limits) : Number.MAX_SAFE_INTEGER;
}

export function refreshShopRestock(profile: PlayerProfile, shop: ShopRow, now = Date.now()) {
  profile.shopRestocks ??= [];
  const existing = profile.shopRestocks.find((candidate) => candidate.shopId === shop.id);
  const candidates = ShopItem.filter((row) => row.shopid === shop.id);
  const summary = bidKingShopRuntimeSummary(shop);
  const count = Math.min(candidates.length, summary.randomCount > 0 ? summary.randomCount : candidates.length);
  const seed = hashString(`${profile.playerId}:${shop.id}:${now}:${existing?.refreshedAt ?? 0}`);
  const shopItemIds = weightedRestockItems(candidates, count, seed).map((row) => row.id);
  const restockItemIds = itemRestockRefs(count, seed);
  const refreshedAt = now;
  const nextRefreshAt = shop.autofresh > 0 ? refreshedAt + shop.autofresh * 3600_000 : undefined;
  if (existing) {
    existing.shopItemIds = shopItemIds;
    existing.restockItemIds = restockItemIds;
    existing.refreshedAt = refreshedAt;
    existing.nextRefreshAt = nextRefreshAt;
    return existing;
  }
  const restock = {
    shopId: shop.id,
    shopItemIds,
    restockItemIds,
    refreshedAt,
    nextRefreshAt
  };
  profile.shopRestocks.push(restock);
  return restock;
}

export function refreshExpiredShopRestocks(profile: PlayerProfile, now = Date.now()): number {
  profile.shopRestocks ??= [];
  let refreshed = 0;
  for (const restock of [...profile.shopRestocks]) {
    if (!restock.nextRefreshAt || restock.nextRefreshAt > now) {
      continue;
    }
    const shop = Shop.find((candidate) => candidate.id === restock.shopId);
    if (!shop || shop.autofresh <= 0) {
      continue;
    }
    refreshShopRestock(profile, shop, now);
    refreshed += 1;
  }
  if (refreshed > 0) {
    profile.updatedAt = now;
  }
  return refreshed;
}

export function ensurePurchase(profile: PlayerProfile, shopItemId: number, limit: number): ShopPurchaseState {
  let purchase = profile.shopPurchases.find((candidate) => candidate.shopItemId === shopItemId);
  if (!purchase) {
    purchase = {
      shopItemId,
      bought: 0,
      limit,
      updatedAt: Date.now()
    };
    profile.shopPurchases.push(purchase);
  }
  purchase.limit = limit;
  return purchase;
}

export function buyShopItemForProfile(
  profile: PlayerProfile,
  shopItemId: number,
  checkAccess: ShopAccessChecker,
  applyNumberChange: ShopNumberChangeApplier,
  recordTransaction: ShopTransactionRecorder
): void {
  const row = ShopItem.find((candidate) => candidate.id === shopItemId);
  if (!row) {
    throw new Error('商品不存在');
  }
  const shop = Shop.find((candidate) => candidate.id === row.shopid);
  if (shop?.random) {
    const restock = profile.shopRestocks?.find((candidate) => candidate.shopId === shop.id);
    if (restock && restock.shopItemIds.length > 0 && !restock.shopItemIds.includes(row.id)) {
      throw new Error('商品不在当前刷新池');
    }
  }
  const access = row.front.find((value) => value > 0);
  const accessResult = checkAccess(profile, access);
  if (!accessResult.ok) {
    throw new Error(accessResult.reason ?? '商品暂未解锁');
  }
  const purchase = ensurePurchase(profile, row.id, row.buycounts);
  if (purchase.limit > 0 && purchase.bought >= purchase.limit) {
    throw new Error('商品已达购买上限');
  }
  const priceCosts = shopPriceCosts(row.price);
  const coinCost = priceCosts.find((cost) => cost.resourceId === 1)?.quantity ?? 0;
  const itemCosts = priceCosts.filter((cost) => cost.resourceId !== 1);
  if (coinCost > profile.coins) {
    throw new Error('铜钱不足');
  }
  const missingItemCost = itemCosts.find((cost) => inventoryQuantity(profile, cost.resourceId) < cost.quantity);
  if (missingItemCost) {
    throw new Error(`${itemDisplayName(missingItemCost.resourceId)}不足`);
  }
  const sourcePrefix = `shop:${profile.playerId}:${row.id}:${purchase.updatedAt}:${purchase.bought + 1}`;
  if (coinCost > 0) {
    applyNumberChange(profile, `${sourcePrefix}:coins`, 'shop_buy_spend', 'coins', -coinCost);
  }
  for (const cost of itemCosts) {
    const before = inventoryQuantity(profile, cost.resourceId);
    consumeInventory(profile, cost.resourceId, cost.quantity);
    recordTransaction(profile, `${sourcePrefix}:cost:${cost.resourceId}`, 'shop_buy_spend_item', 'item', before, -cost.quantity);
  }
  for (const reward of row.itemid) {
    const [refId, quantity = 1] = reward;
    if (!refId || quantity <= 0) {
      continue;
    }
    const before = inventoryQuantity(profile, refId);
    addInventory(profile, String(row.type || 'item'), String(refId), quantity, `${sourcePrefix}:item:${refId}`);
    recordTransaction(profile, `${sourcePrefix}:item:${refId}`, 'shop_buy_item', 'item', before, quantity);
    recordShopAcquiredItem(profile, refId, quantity);
  }
  purchase.bought += 1;
  purchase.updatedAt = Date.now();
  profile.updatedAt = Date.now();
}

function recordShopAcquiredItem(profile: PlayerProfile, refId: number, quantity: number): void {
  ensureProfileShape(profile);
  const safeQuantity = Math.max(1, Math.floor(quantity));
  profile.conditionStats!.shopAcquiredItemIds!.push(...Array.from({ length: safeQuantity }, () => refId));
  profile.conditionStats!.updatedAt = Date.now();
}

export function refreshShopForProfile(
  profile: PlayerProfile,
  shopId: number | undefined,
  recordTransaction: ShopTransactionRecorder
): void {
  const shop = shopId === undefined ? undefined : Shop.find((candidate) => candidate.id === shopId);
  if (shopId !== undefined && !shop) {
    throw new Error('商店配置不存在');
  }
  if (shop && !shopCanRefresh(shop)) {
    throw new Error('商店不支持刷新');
  }
  const refreshableShops = shop ? [shop] : Shop.filter(shopCanRefresh);
  const refreshCosts = refreshableShops
    .map((row) => ({ shop: row, ticketCost: bidKingShopRuntimeSummary(row).ticketCost }))
    .filter((entry) => entry.ticketCost > 0);
  const totalTicketCost = refreshCosts.reduce((sum, entry) => sum + entry.ticketCost, 0);
  refreshTicketState(profile);
  if (totalTicketCost > profile.tickets.current) {
    throw new Error('竞拍票不足');
  }
  const targetShopIds = new Set(refreshableShops.map((row) => row.id));
  const targetItems = ShopItem.filter((row) => targetShopIds.has(row.shopid));
  const targetItemIds = new Set(targetItems.map((row) => row.id));
  const now = Date.now();
  if (totalTicketCost > 0) {
    const beforeTickets = profile.tickets.current;
    profile.tickets.current -= totalTicketCost;
    profile.tickets.updatedAt = now;
    if (profile.tickets.current < profile.tickets.max && profile.tickets.recoverTimeSeconds > 0 && !profile.tickets.nextRecoverAt) {
      profile.tickets.nextRecoverAt = now + profile.tickets.recoverTimeSeconds * 1000;
    }
    recordTransaction(
      profile,
      `shop_refresh:${profile.playerId}:${shopId ?? 'all'}:${now}:ticket`,
      'shop_refresh_ticket_spend',
      'ticket',
      beforeTickets,
      -totalTicketCost
    );
  }
  let resetCount = 0;
  for (const purchase of profile.shopPurchases) {
    if (!targetItemIds.has(purchase.shopItemId)) {
      continue;
    }
    const row = targetItems.find((candidate) => candidate.id === purchase.shopItemId);
    purchase.limit = row?.buycounts ?? purchase.limit;
    if (purchase.bought > 0) {
      resetCount += 1;
    }
    purchase.bought = 0;
    purchase.updatedAt = Math.max(now, purchase.updatedAt + 1);
  }
  for (const refreshedShop of refreshableShops) {
    refreshShopRestock(profile, refreshedShop, now);
  }
  recordTransaction(
    profile,
    `shop_refresh:${profile.playerId}:${shopId ?? 'all'}:${now}`,
    'shop_refresh',
    'task',
    0,
    resetCount
  );
  profile.updatedAt = now;
}

export function setShopItemCollectionForProfile(
  profile: PlayerProfile,
  itemId: number,
  collected: boolean,
  recordTransaction: ShopTransactionRecorder
): boolean {
  const canonicalItemId = Math.floor(Number(itemId));
  if (!ShopItem.some((row) => row.itemid.some(([refId = 0]) => refId === canonicalItemId))) {
    throw new Error('收藏商品不存在');
  }
  profile.shopCollections ??= [];
  const existing = profile.shopCollections.includes(canonicalItemId);
  if (collected === existing) {
    return false;
  }
  const before = existing ? 1 : 0;
  if (collected) {
    profile.shopCollections = [...profile.shopCollections, canonicalItemId].sort((left, right) => left - right);
  } else {
    profile.shopCollections = profile.shopCollections.filter((candidate) => candidate !== canonicalItemId);
  }
  profile.updatedAt = Date.now();
  recordTransaction(
    profile,
    `shop_collect:${profile.playerId}:${canonicalItemId}:${collected ? 'on' : 'off'}:${profile.updatedAt}`,
    collected ? 'shop_collect_item' : 'shop_uncollect_item',
    'task',
    before,
    collected ? 1 : -1
  );
  return true;
}

function weightedRestockItems<T extends { id: number; randvalue: number }>(rows: T[], count: number, seed: number): T[] {
  return [...rows]
    .map((row) => ({
      row,
      score: hashString(`${seed}:${row.id}`) / Math.max(1, row.randvalue)
    }))
    .sort((left, right) => left.score - right.score)
    .slice(0, count)
    .map((entry) => entry.row);
}

function itemRestockRefs(count: number, seed: number): number[] {
  return [...ItemRestock]
    .map((row) => ({
      itemId: Number(row.columns[3] ?? 0),
      score: hashString(`${seed}:item:${row.id}`)
    }))
    .filter((entry) => Number.isFinite(entry.itemId) && entry.itemId > 0)
    .sort((left, right) => left.score - right.score)
    .slice(0, count)
    .map((entry) => entry.itemId);
}

function shopPriceCosts(priceRows: readonly (readonly number[])[]): Array<{ resourceId: number; quantity: number }> {
  const costs = new Map<number, number>();
  for (const price of priceRows) {
    const resourceId = Math.floor(Number(price[0] ?? 0));
    const quantity = Math.floor(Number(price[1] ?? price[2] ?? 0));
    if (resourceId <= 0 || quantity <= 0) {
      continue;
    }
    costs.set(resourceId, (costs.get(resourceId) ?? 0) + quantity);
  }
  return [...costs.entries()].map(([resourceId, quantity]) => ({ resourceId, quantity }));
}

function itemDisplayName(itemId: number): string {
  return Item.find((item) => item.id === itemId)?.packaged_name ?? `道具${itemId}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
