import type { BidKingShopItemRow, BidKingShopRow } from './schema';
import { Shop } from './tables/Shop';

export interface BidKingShopRuntimeSummary {
  autoRefreshHours?: number;
  buyUiType: number;
  currencyDisplay: readonly number[];
  random: boolean;
  randomCount: number;
  refreshable: boolean;
  settingEnabled: boolean;
  shopId: number;
  ticketCost: number;
}

export interface BidKingShopItemRateBand {
  rate: number;
  value: number;
}

export interface BidKingShopItemRuntimeSummary {
  buyLimit: number;
  buyType: number;
  buyUiType: number;
  currencyDisplay: readonly number[];
  frontAccessIds: number[];
  priceResourceIds: number[];
  randomWeight: number;
  rateBands: BidKingShopItemRateBand[];
  rewardCount: number;
  shopItemId: number;
  visibleByDefault: boolean;
}

export function bidKingShopRuntimeSummary(shop: BidKingShopRow): BidKingShopRuntimeSummary {
  return {
    autoRefreshHours: shop.autofresh > 0 ? shop.autofresh : undefined,
    buyUiType: shop.buyuitype,
    currencyDisplay: shop.currencydisplay,
    random: shop.random > 0,
    randomCount: shop.randcounts,
    refreshable: shopCanRefresh(shop),
    settingEnabled: shop.setting > 0,
    shopId: shop.id,
    ticketCost: Math.max(0, shop.ticket)
  };
}

export function bidKingShopItemRuntimeSummary(
  item: BidKingShopItemRow,
  shop: BidKingShopRow | undefined = Shop.find((candidate) => candidate.id === item.shopid)
): BidKingShopItemRuntimeSummary {
  return {
    buyLimit: item.buycounts,
    buyType: item.buytype,
    buyUiType: shop?.buyuitype ?? 0,
    currencyDisplay: shop?.currencydisplay ?? [],
    frontAccessIds: item.front.filter((value) => value > 0),
    priceResourceIds: item.price.map((row) => Number(row[0] ?? 0)).filter((value) => value > 0),
    randomWeight: Math.max(0, item.randvalue),
    rateBands: item.rate.map((rate, index) => ({ rate, value: item.ratevalue[index] ?? 0 })),
    rewardCount: item.itemid.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row[1] ?? 1))), 0),
    shopItemId: item.id,
    visibleByDefault: item.front.every((value) => value <= 0)
  };
}

export function shopCanRefresh(shop: BidKingShopRow): boolean {
  return shop.random > 0 || shop.randcounts > 0 || shop.autofresh > 0;
}
