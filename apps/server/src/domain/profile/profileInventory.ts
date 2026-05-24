import type { PlayerInventoryEntry, PlayerProfile, ProfileStockBoxState } from '@bitkingdom/shared';
import {
  addStockItemsForInventoryRef,
  consumeStockItemsForInventoryRef,
  ensureProfileStockState,
  isStockBackedInventoryRef
} from './profileStockRuntime';

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

export function addInventory(
  profile: PlayerProfile,
  type: string,
  refId: string,
  quantity: number,
  sourceId: string
): ProfileStockBoxState[] {
  if (isStockBackedInventoryRef(refId)) {
    ensureProfileStockState(profile);
  }
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
  const createdStockBoxes = addStockItemsForInventoryRef(profile, refId, quantity, sourceId, entry.updatedAt);
  // Inventory transactions use the quantity counter for audit readability.
  profile.updatedAt = Date.now();
  void before;
  void sourceId;
  return createdStockBoxes;
}

export function inventoryQuantity(profile: PlayerProfile, itemId: number | string): number {
  return profile.inventory
    .filter((entry) => inventoryRefMatches(entry.refId, itemId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

export function consumeInventory(profile: PlayerProfile, itemId: number | string, quantity: number): void {
  if (isStockBackedInventoryRef(itemId)) {
    ensureProfileStockState(profile);
  }
  let remaining = quantity;
  for (const entry of profile.inventory.filter((candidate) => inventoryRefMatches(candidate.refId, itemId))) {
    if (remaining <= 0) {
      break;
    }
    const consumed = Math.min(entry.quantity, remaining);
    entry.quantity -= consumed;
    entry.updatedAt = Date.now();
    remaining -= consumed;
  }
  profile.inventory = profile.inventory.filter((entry) => entry.quantity > 0);
  consumeStockItemsForInventoryRef(profile, itemId, quantity);
  profile.updatedAt = Date.now();
}

function inventoryRefMatches(left: number | string, right: number | string): boolean {
  return sourceInventoryItemId(left) === sourceInventoryItemId(right);
}

function sourceInventoryItemId(value: number | string): string {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return compatMatch?.[1] ?? raw;
}
