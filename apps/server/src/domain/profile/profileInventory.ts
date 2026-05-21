import type { PlayerInventoryEntry, PlayerProfile } from '@bitkingdom/shared';

export function inventoryRecord(profile: PlayerProfile): Record<string, number> {
  const record: Record<string, number> = {};
  for (const entry of profile.inventory) {
    record[entry.refId] = (record[entry.refId] ?? 0) + entry.quantity;
  }
  return record;
}

export function canonicalCodexItemId(itemId: string): string {
  const compatMatch = /^compat_(\d+)(?:_\d+)?$/.exec(itemId);
  return compatMatch?.[1] ? `compat_${compatMatch[1]}` : itemId;
}

export function addInventory(profile: PlayerProfile, type: string, refId: string, quantity: number, sourceId: string): void {
  const key = `${type}:${refId}`;
  let entry: PlayerInventoryEntry | undefined = profile.inventory.find((candidate) => candidate.key === key);
  if (!entry) {
    entry = {
      key,
      type,
      refId,
      quantity: 0,
      updatedAt: Date.now()
    };
    profile.inventory.push(entry);
  }
  const before = entry.quantity;
  entry.quantity += quantity;
  entry.updatedAt = Date.now();
  // Inventory transactions use the quantity counter for audit readability.
  profile.updatedAt = Date.now();
  void before;
  void sourceId;
}

export function inventoryQuantity(profile: PlayerProfile, itemId: number | string): number {
  return profile.inventory
    .filter((entry) => entry.refId === String(itemId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

export function consumeInventory(profile: PlayerProfile, itemId: number | string, quantity: number): void {
  let remaining = quantity;
  for (const entry of profile.inventory.filter((candidate) => candidate.refId === String(itemId))) {
    if (remaining <= 0) {
      break;
    }
    const consumed = Math.min(entry.quantity, remaining);
    entry.quantity -= consumed;
    entry.updatedAt = Date.now();
    remaining -= consumed;
  }
  profile.inventory = profile.inventory.filter((entry) => entry.quantity > 0);
  profile.updatedAt = Date.now();
}
