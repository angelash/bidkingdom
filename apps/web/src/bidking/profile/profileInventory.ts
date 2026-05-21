import type { PlayerProfile } from '@bitkingdom/shared';

export function inventoryQuantity(profile: PlayerProfile, refId: number | string): number {
  return profile.inventory
    .filter((entry) => entry.refId === String(refId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}
