import { describe, expect, it } from 'vitest';
import { codexCatalogItems } from './codexRuntime';

describe('codexRuntime', () => {
  it('maps source item_quality 1-6 to distinct rarity classes', () => {
    const expected = new Map([
      [1, 'junk'],
      [2, 'common'],
      [3, 'fine'],
      [4, 'rare'],
      [5, 'legendary'],
      [6, 'mythic']
    ]);

    for (const [quality, rarity] of expected) {
      const item = codexCatalogItems.find((candidate) => candidate.bidKingQuality === quality);
      expect(item?.rarity).toBe(rarity);
    }
  });
});
