import { Item, bidKingItemRuntimeFlags } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import { addInventory, inventoryQuantity } from './profileInventory';
import { createDefaultProfile } from './profileLifecycle';
import {
  sellAllInventoryItemsForProfile,
  type InventorySaleNumberApplier,
  type InventorySaleTransactionRecorder
} from './profileInventorySaleRuntime';

describe('profileInventorySaleRuntime', () => {
  it('sells all saleable warehouse items and keeps locked items', () => {
    const saleable = Item.find((item) => bidKingItemRuntimeFlags(item).saleable && item.item_quality < 7);
    const retained = Item.find((item) => !bidKingItemRuntimeFlags(item).saleable || item.item_quality >= 7);
    if (!saleable || !retained) {
      throw new Error('BidKing item fixtures must include saleable and retained items');
    }
    const profile = createDefaultProfile('sale_all_test', 'sale_all_test', 1_700_000_000_000);
    profile.inventory = [];
    profile.stockContainers = [];
    profile.stockState = { nextBoxId: 1, nextItemNo: 1 };
    profile.settings.bidkingStockContainersV1 = true;
    profile.cabinetItemIds = [];
    profile.coins = 100;
    addInventory(profile, 'item', `compat_${saleable.id}`, 2, 'test:saleable');
    addInventory(profile, 'item', `compat_${retained.id}`, 3, 'test:retained');
    const transactions: Array<{ reason: string; resource: string; amountChange: number }> = [];
    const applyNumberChange: InventorySaleNumberApplier = (target, sourceId, reason, resource, amountChange) => {
      transactions.push({ reason: `${sourceId}:${reason}`, resource, amountChange });
      target[resource] += amountChange;
    };
    const recordTransaction: InventorySaleTransactionRecorder = (_target, sourceId, reason, resource, _before, amountChange) => {
      transactions.push({ reason: `${sourceId}:${reason}`, resource, amountChange });
    };

    const result = sellAllInventoryItemsForProfile(profile, applyNumberChange, recordTransaction, 1_700_000_000_500);

    expect(result.quantity).toBe(2);
    expect(result.totalCoins).toBe(saleable.base_value * 2);
    expect(profile.coins).toBe(100 + saleable.base_value * 2);
    expect(inventoryQuantity(profile, `compat_${saleable.id}`)).toBe(0);
    expect(inventoryQuantity(profile, `compat_${retained.id}`)).toBe(3);
    expect(profile.cabinetItemIds).not.toContain(`compat_${saleable.id}`);
    expect(transactions.some((transaction) => transaction.reason.includes('cabinet_sell_item'))).toBe(true);
    expect(transactions.some((transaction) => transaction.reason.includes('cabinet_sell_coins'))).toBe(true);
  });
});
