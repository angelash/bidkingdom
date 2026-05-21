import { describe, expect, it } from 'vitest';
import { compareShopItemsByStoreOrder, ShopItem, shopItemsForShop } from './ShopItem';

describe('ShopItem runtime helpers', () => {
  it('sorts store items like the original StorePanel list', () => {
    const rows = shopItemsForShop(505);

    expect(rows.map((row) => row.id)).toEqual([505001, 505002, 505003, 505004]);
    expect(rows).toEqual([...rows].sort(compareShopItemsByStoreOrder));
  });

  it('uses id descending as the original tie breaker when order matches', () => {
    const source = ShopItem.filter((row) => row.shopid === 504);
    const rows = shopItemsForShop(504);

    expect(source).toHaveLength(17);
    expect(source.every((row) => row.order === 1)).toBe(true);
    expect(rows.map((row) => row.id)).toEqual([...source].map((row) => row.id).sort((left, right) => right - left));
  });
});
