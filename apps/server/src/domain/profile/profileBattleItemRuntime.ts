import { BattleItem } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { consumeInventory, inventoryQuantity } from './profileInventory';

export type BattleItemTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export function equipBattleItemsForProfile(
  profile: PlayerProfile,
  itemIds: number[],
  recordTransaction: BattleItemTransactionRecorder
): void {
  const uniqueIds = [...new Set(itemIds)].slice(0, 3);
  const equipped = uniqueIds.map((itemId) => {
    const row = BattleItem.find((candidate) => candidate.id === itemId);
    if (!row) {
      throw new Error(`道具 ${itemId} 不存在`);
    }
    const inventory = inventoryQuantity(profile, itemId);
    if (inventory <= 0) {
      throw new Error(`${row.packaged_name} 库存不足`);
    }
    return {
      itemId,
      quantity: 1,
      updatedAt: Date.now()
    };
  });
  profile.equippedBattleItems = equipped;
  profile.updatedAt = Date.now();
  recordTransaction(profile, `battle_item_equip:${profile.playerId}:${uniqueIds.join('_')}:${Date.now()}`, 'battle_item_equip', 'item', 0, uniqueIds.length);
}

export function useBattleItemForProfile(
  profile: PlayerProfile,
  itemId: number,
  recordTransaction: BattleItemTransactionRecorder
): void {
  const row = BattleItem.find((candidate) => candidate.id === itemId);
  if (!row) {
    throw new Error(`道具 ${itemId} 不存在`);
  }
  const equipped = profile.equippedBattleItems.find((entry) => entry.itemId === itemId);
  if (!equipped) {
    throw new Error(`${row.packaged_name} 未携带`);
  }
  const before = inventoryQuantity(profile, itemId);
  if (before <= 0) {
    profile.equippedBattleItems = profile.equippedBattleItems.filter((entry) => entry.itemId !== itemId);
    throw new Error(`${row.packaged_name} 库存不足`);
  }
  consumeInventory(profile, itemId, 1);
  if (inventoryQuantity(profile, itemId) <= 0) {
    profile.equippedBattleItems = profile.equippedBattleItems.filter((entry) => entry.itemId !== itemId);
  } else {
    equipped.updatedAt = Date.now();
  }
  recordBattleItemUseStats(profile, itemId);
  recordTransaction(profile, `battle_item_use:${profile.playerId}:${itemId}:${Date.now()}`, 'battle_item_use', 'item', before, -1);
  profile.updatedAt = Date.now();
}

function recordBattleItemUseStats(profile: PlayerProfile, itemId: number): void {
  const now = Date.now();
  const periodKey = dailyPeriodKey(now);
  profile.conditionStats ??= {
    usedItemCount: 0,
    dailyUsedItemCount: {},
    usedItemCountsById: {},
    tradeBoughtCount: 0,
    tradeSoldCount: 0,
    auctionAcquiredItemIds: [],
    shopAcquiredItemIds: [],
    missionEventCounts: {},
    missionEventDomainCounts: {},
    updatedAt: now
  };
  profile.conditionStats.usedItemCount += 1;
  profile.conditionStats.dailyUsedItemCount[periodKey] = (profile.conditionStats.dailyUsedItemCount[periodKey] ?? 0) + 1;
  profile.conditionStats.usedItemCountsById[String(itemId)] = (profile.conditionStats.usedItemCountsById[String(itemId)] ?? 0) + 1;
  profile.conditionStats.updatedAt = now;
}

function dailyPeriodKey(now: number): string {
  const shifted = now + 8 * 60 * 60 * 1000;
  const dayStart = Math.floor(shifted / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  return `daily:${new Date(dayStart).toISOString().slice(0, 10)}`;
}
