import { describe, expect, it } from 'vitest';
import { qualityClassFromSourceQuality, rarityFromSourceQuality } from './qualityVisuals';

describe('quality visuals', () => {
  it('keeps source item_quality mapped to fixed rarity semantics', () => {
    expect(rarityFromSourceQuality(1)).toBe('junk');
    expect(rarityFromSourceQuality(2)).toBe('common');
    expect(rarityFromSourceQuality(3)).toBe('fine');
    expect(rarityFromSourceQuality(4)).toBe('rare');
    expect(rarityFromSourceQuality(5)).toBe('legendary');
    expect(rarityFromSourceQuality(6)).toBe('mythic');
  });

  it('returns reusable rarity classes for item quality surfaces', () => {
    expect(qualityClassFromSourceQuality(2)).toBe('rarity-common');
    expect(qualityClassFromSourceQuality(3)).toBe('rarity-fine');
    expect(qualityClassFromSourceQuality(undefined)).toBe('');
  });
});
