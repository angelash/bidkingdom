import {
  Item,
  bidKingItemRuntimeFlags
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import {
  canonicalCodexItemId,
  consumeInventory,
  inventoryRecord,
  inventoryQuantity
} from './profileInventory';

export interface InventorySaleResult {
  refId: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  totalCoins: number;
}

export interface InventorySaleBatchResult {
  items: InventorySaleResult[];
  quantity: number;
  totalCoins: number;
}

export type InventorySaleNumberApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins'>,
  amountChange: number
) => void;

export type InventorySaleTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export function sellInventoryItemForProfile(
  profile: PlayerProfile,
  refId: string,
  quantity: number,
  applyNumberChange: InventorySaleNumberApplier,
  recordTransaction: InventorySaleTransactionRecorder,
  now = Date.now()
): InventorySaleResult {
  const item = bidKingItemByInventoryRef(refId);
  if (!item) {
    throw new Error('藏品不存在，无法出售');
  }
  if (!canSellBidKingItem(item)) {
    throw new Error('该藏品不可出售');
  }
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const beforeQuantity = inventoryQuantity(profile, refId);
  if (beforeQuantity < safeQuantity) {
    throw new Error('珍阁库存不足，无法出售');
  }

  const unitPrice = Math.max(0, Math.floor(item.base_value));
  const totalCoins = unitPrice * safeQuantity;
  const sourceId = `inventory_sell:${profile.playerId}:${canonicalCodexItemId(refId)}:${now}`;
  consumeInventory(profile, refId, safeQuantity);
  recordTransaction(profile, `${sourceId}:item`, 'cabinet_sell_item', 'item', beforeQuantity, -safeQuantity);
  applyNumberChange(profile, `${sourceId}:coins`, 'cabinet_sell_coins', 'coins', totalCoins);

  const remainingQuantity = inventoryQuantity(profile, refId);
  if (remainingQuantity <= 0) {
    removeCabinetItemRefs(profile, [refId]);
  }
  profile.updatedAt = now;

  return {
    refId,
    quantity: safeQuantity,
    remainingQuantity,
    unitPrice,
    totalCoins
  };
}

export function sellAllInventoryItemsForProfile(
  profile: PlayerProfile,
  applyNumberChange: InventorySaleNumberApplier,
  recordTransaction: InventorySaleTransactionRecorder,
  now = Date.now()
): InventorySaleBatchResult {
  const quantities = inventoryRecord(profile);
  const results: InventorySaleResult[] = [];
  const soldRefIds: string[] = [];

  for (const [refId, quantity] of Object.entries(quantities)) {
    const item = bidKingItemByInventoryRef(refId);
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (!item || !canSellBidKingItem(item) || safeQuantity <= 0) {
      continue;
    }

    const beforeQuantity = inventoryQuantity(profile, refId);
    const unitPrice = Math.max(0, Math.floor(item.base_value));
    const totalCoins = unitPrice * safeQuantity;
    const sourceId = `inventory_sell_all:${profile.playerId}:${canonicalCodexItemId(refId)}:${now}:${results.length}`;

    consumeInventory(profile, refId, safeQuantity);
    recordTransaction(profile, `${sourceId}:item`, 'cabinet_sell_item', 'item', beforeQuantity, -safeQuantity);
    applyNumberChange(profile, `${sourceId}:coins`, 'cabinet_sell_coins', 'coins', totalCoins);

    results.push({
      refId,
      quantity: safeQuantity,
      remainingQuantity: inventoryQuantity(profile, refId),
      unitPrice,
      totalCoins
    });
    soldRefIds.push(refId);
  }

  if (results.length === 0) {
    throw new Error('没有可出售的藏品');
  }

  removeCabinetItemRefs(profile, soldRefIds);
  profile.updatedAt = now;

  return {
    items: results,
    quantity: results.reduce((sum, result) => sum + result.quantity, 0),
    totalCoins: results.reduce((sum, result) => sum + result.totalCoins, 0)
  };
}

function canSellBidKingItem(item: (typeof Item)[number]): boolean {
  const flags = bidKingItemRuntimeFlags(item);
  return flags.saleable && item.item_quality < 7;
}

function removeCabinetItemRefs(profile: PlayerProfile, refIds: readonly string[]): void {
  if (!profile.cabinetItemIds?.length || refIds.length === 0) {
    return;
  }
  const soldItemIds = new Set(refIds.map((refId) => canonicalCodexItemId(refId)));
  profile.cabinetItemIds = profile.cabinetItemIds.filter((itemId) => !soldItemIds.has(canonicalCodexItemId(itemId)));
}

function bidKingItemByInventoryRef(refId: string) {
  const compatMatch = /^compat_(\d+)/.exec(refId);
  const sourceId = Number(compatMatch?.[1] ?? refId);
  return Number.isFinite(sourceId) ? Item.find((item) => item.id === sourceId) : undefined;
}
