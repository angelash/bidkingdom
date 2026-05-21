import { describe, expect, it } from 'vitest';
import {
  Item,
  bidKingWareHouseItemTypeLabels,
  bidKingWareHouseItemVisible,
  bidKingWareHouseRuntime
} from './index';

describe('BidKing WareHouse runtime', () => {
  it('parses the original WareHouse house_type list into type rules', () => {
    const runtime = bidKingWareHouseRuntime();

    expect(runtime).toEqual(expect.objectContaining({
      id: '1',
      languageKey: 'wh_allitem',
      itemTypeIds: [2, 3, 4, 5, 6, 7, 8, 16, 19],
      sourceFields: ['WareHouse.house_name', 'WareHouse.house_type']
    }));
    expect(runtime.typeRules.map((rule) => rule.typeId)).toEqual(runtime.itemTypeIds);
    expect(runtime.typeRules[0]).toEqual(expect.objectContaining({
      typeId: 2,
      label: '券契'
    }));
  });

  it('uses WareHouse house_type to decide item visibility', () => {
    const runtime = bidKingWareHouseRuntime();
    const warehouseItem = Item.find((item) => item.item_type_ids.includes(2))!;
    const collectionItem = Item.find((item) => item.item_type_ids.includes(101))!;

    expect(bidKingWareHouseItemVisible(warehouseItem, runtime)).toBe(true);
    expect(bidKingWareHouseItemTypeLabels(warehouseItem, runtime)).toContain('券契');
    expect(bidKingWareHouseItemVisible(collectionItem, runtime)).toBe(false);
  });
});
