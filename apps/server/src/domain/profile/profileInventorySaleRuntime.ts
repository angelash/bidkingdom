import {
  Item,
  bidKingItemRuntimeFlags
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import {
  canonicalCodexItemId,
  consumeInventory,
  inventoryQuantity
} from './profileInventory';

export interface InventorySaleResult {
  refId: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
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
  const flags = bidKingItemRuntimeFlags(item);
  if (!flags.saleable || item.item_quality >= 7) {
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
  if (remainingQuantity <= 0 && profile.cabinetItemIds?.length) {
    const soldItemId = canonicalCodexItemId(refId);
    profile.cabinetItemIds = profile.cabinetItemIds.filter((itemId) => canonicalCodexItemId(itemId) !== soldItemId);
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

function bidKingItemByInventoryRef(refId: string) {
  const compatMatch = /^compat_(\d+)/.exec(refId);
  const sourceId = Number(compatMatch?.[1] ?? refId);
  return Number.isFinite(sourceId) ? Item.find((item) => item.id === sourceId) : undefined;
}
