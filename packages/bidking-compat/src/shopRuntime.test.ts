import { describe, expect, it } from 'vitest';
import {
  bidKingShopItemRuntimeSummary,
  bidKingShopRuntimeSummary,
  shopCanRefresh
} from './shopRuntime';
import { Shop } from './tables/Shop';
import { ShopItem } from './tables/ShopItem';

describe('BidKing shop runtime helpers', () => {
  it('explains Shop refresh and ShopItem UI fields from original rows', () => {
    const randomShop = Shop.find((shop) => shop.random > 0 && shop.randcounts > 0)!;
    const fixedShop = Shop.find((shop) => shop.random === 0 && shop.randcounts === 0 && shop.autofresh === 0)!;
    const item = ShopItem.find((row) => row.shopid === randomShop.id && row.randvalue > 0)!;
    const shopSummary = bidKingShopRuntimeSummary(randomShop);
    const itemSummary = bidKingShopItemRuntimeSummary(item, randomShop);

    expect(shopSummary.refreshable).toBe(true);
    expect(shopSummary.randomCount).toBe(randomShop.randcounts);
    expect(shopCanRefresh(fixedShop)).toBe(false);
    expect(itemSummary.randomWeight).toBe(item.randvalue);
    expect(itemSummary.rateBands.length).toBe(item.rate.length);
    expect(itemSummary.buyLimit).toBe(item.buycounts);
    expect(itemSummary.currencyDisplay).toEqual(randomShop.currencydisplay);
  });
});
