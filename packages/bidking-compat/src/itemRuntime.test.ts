import { describe, expect, it } from 'vitest';
import {
  bidKingItemFieldAudit,
  bidKingItemRuntimeFacts,
  bidKingItemRuntimeFlags,
  bidKingItemTypeRule,
  BID_KING_ITEM_ORIGINAL_FIELD_KEYS
} from './itemRuntime';
import {
  BID_KING_ITEM_PACKAGING_OVERRIDES,
  bidKingItemDisplayName
} from './itemPackagingOverrides';
import { Item } from './tables/Item';

describe('BidKing item runtime helpers', () => {
  it('explains Item long-tail fields and ItemType filters from original rows', () => {
    const placeable = Item.find((item) => item.slot_type > 0 && item.item_type_ids.some((typeId) => typeId >= 100 && typeId <= 110))!;
    const auctionTypeVisible = Item.find((item) => item.item_type_ids.some((typeId) => typeId >= 101 && typeId <= 110))!;
    const auctionItemFlagged = Item.find((item) => item.is_auction > 0)!;
    const exchangeable = Item.find((item) => item.exchangeId.length > 0);
    const priced = Item.find((item) => typeof item.room_price === 'number' && item.room_price > 0);
    const typeRule = bidKingItemTypeRule(placeable);
    const flags = bidKingItemRuntimeFlags(placeable);
    const facts = bidKingItemRuntimeFacts(exchangeable ?? priced ?? placeable);
    const audit = bidKingItemFieldAudit(placeable);

    expect(typeRule.itemTypeIds.length).toBeGreaterThan(0);
    expect(typeRule.names.length).toBeGreaterThan(0);
    expect(flags.placeable).toBe(true);
    expect(bidKingItemRuntimeFlags(auctionTypeVisible).auctionable).toBe(true);
    expect(bidKingItemRuntimeFlags(auctionItemFlagged).auctionable).toBe(true);
    expect(audit.total).toBe(36);
    expect(audit.covered).toBe(audit.total);
    expect(audit.facts.map((fact) => fact.key)).toEqual([...BID_KING_ITEM_ORIGINAL_FIELD_KEYS]);
    expect(facts.map((fact) => fact.key)).toEqual(
      expect.arrayContaining([
        'specified_obtain',
        'show_item',
        'collection',
        'rank7count',
        'item_access',
        'number',
        'cost',
        'exchangeId',
        'is_sale',
        'room_price'
      ])
    );
  });

  it('uses manually curated Three Kingdoms display names for collection items', () => {
    const incenseBurner = Item.find((item) => item.id === 1011001)!;
    const luBuHalberd = Item.find((item) => item.id === 1046002)!;
    const curatedNames = [
      bidKingItemDisplayName(incenseBurner),
      bidKingItemDisplayName(luBuHalberd)
    ];

    expect(BID_KING_ITEM_PACKAGING_OVERRIDES[1011001]?.name).toBe('凡品·兽耳铜香炉');
    expect(bidKingItemDisplayName(incenseBurner)).toBe('凡品·兽耳铜香炉');
    expect(bidKingItemDisplayName(luBuHalberd)).toBe('国宝·吕布方天画戟');
    expect(curatedNames.join(' / ')).not.toMatch(/格方件|横件|竖件|10\d{5}/);
    expect(bidKingItemDisplayName({ id: -1, packaged_name: '原始占位名' })).toBe('原始占位名');
  });
});
