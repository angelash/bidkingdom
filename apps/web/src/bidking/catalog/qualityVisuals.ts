import type { Rarity } from '@bitkingdom/shared';

export function rarityFromSourceQuality(quality?: number): Rarity | undefined {
  if (quality === undefined || !Number.isFinite(quality)) {
    return undefined;
  }
  if (quality <= 1) {
    return 'junk';
  }
  if (quality === 2) {
    return 'common';
  }
  if (quality === 3) {
    return 'fine';
  }
  if (quality === 4) {
    return 'rare';
  }
  if (quality === 5) {
    return 'legendary';
  }
  return 'mythic';
}

export function qualityClassFromSourceQuality(quality?: number): string {
  const rarity = rarityFromSourceQuality(quality);
  return rarity ? `rarity-${rarity}` : '';
}
