import { Item as bidKingItems } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import {
  itemMatchesItemTypeFilter,
  itemTypeFilterOptions,
  itemTypeFilterSummary
} from './itemTypeFilterRuntime';

describe('BidKing ItemType UI filters', () => {
  it('projects showin_tradingbuy and showin_auction into market filter options', () => {
    const tradeOptions = itemTypeFilterOptions('trade');
    const auctionOptions = itemTypeFilterOptions('auction');

    expect(tradeOptions.map((option) => option.id)).toContain(101);
    expect(auctionOptions.map((option) => option.id)).toContain(101);
    expect(tradeOptions.map((option) => option.id)).not.toContain(100);
    expect(auctionOptions.map((option) => option.id)).not.toContain(100);
  });

  it('filters Item rows by ItemType scope and store type summary', () => {
    const tradable = bidKingItems.find((item) => item.item_type_ids.includes(101))!;
    const nonMarket = bidKingItems.find((item) => item.item_type_ids.includes(2))!;

    expect(itemMatchesItemTypeFilter(tradable.id, 101, 'trade')).toBe(true);
    expect(itemMatchesItemTypeFilter(`compat_${tradable.id}`, 101, 'warehouse')).toBe(true);
    expect(itemMatchesItemTypeFilter(nonMarket.id, 'all', 'trade')).toBe(false);
    expect(itemTypeFilterSummary(tradable.id)).toContain('珍阁分类');
  });
});
