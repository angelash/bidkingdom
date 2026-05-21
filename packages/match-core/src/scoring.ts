import type { RevealedItem } from '@bitkingdom/shared';
import type { GameConfig } from '@bitkingdom/config';
import type { RuntimePlayer } from './types';

export function sumItemValue(items: readonly RevealedItem[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

export function sumRepairCost(items: readonly RevealedItem[], repairDiscountRate: number): number {
  const raw = items.reduce((sum, item) => sum + item.repairCost, 0);
  return Math.round(raw * (1 - repairDiscountRate));
}

export function calculateSetBonus(items: readonly RevealedItem[], config: GameConfig): number {
  const ownedIds = new Set(items.map((item) => item.id));
  let bonus = 0;
  for (const set of config.sets) {
    const ownedSetItems = set.itemIds.filter((itemId) => ownedIds.has(itemId));
    if (ownedSetItems.length >= Math.min(3, set.itemIds.length)) {
      const setValue = items
        .filter((item) => item.setId === set.id)
        .reduce((sum, item) => sum + item.value, 0);
      bonus += Math.round(setValue * set.bonusRate);
    }
  }
  return bonus;
}

export function calculateNetWorth(player: RuntimePlayer, config: GameConfig): number {
  return player.cash + sumItemValue(player.holdings) + calculateSetBonus(player.holdings, config);
}
