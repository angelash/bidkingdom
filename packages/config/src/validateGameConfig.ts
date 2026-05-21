import type { GameConfig } from './schema';
import { gameConfigSchema } from './schema';

export interface ConfigValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateGameConfig(config: GameConfig): ConfigValidationResult {
  const errors: string[] = [];
  const parsed = gameConfigSchema.safeParse(config);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { ok: false, errors };
  }

  const itemIds = new Set(config.items.map((item) => item.id));
  const setIds = new Set(config.sets.map((set) => set.id));

  for (const item of config.items) {
    if (item.setId && !setIds.has(item.setId)) {
      errors.push(`item ${item.id} references missing set ${item.setId}`);
    }
    if (item.isFake && item.rarity !== 'fake') {
      errors.push(`item ${item.id} is fake but rarity is ${item.rarity}`);
    }
    const area = item.footprint.w * item.footprint.h;
    if (area > 6) {
      errors.push(`item ${item.id} footprint ${item.footprint.w}x${item.footprint.h} is too large for an auction crate`);
    }
    if (item.category === '印章' && area > 2) {
      errors.push(`item ${item.id} is a seal but has oversized footprint ${item.footprint.w}x${item.footprint.h}`);
    }
    if (item.category === '珠宝' && area > 2) {
      errors.push(`item ${item.id} is jewelry but has oversized footprint ${item.footprint.w}x${item.footprint.h}`);
    }
  }

  for (const set of config.sets) {
    for (const itemId of set.itemIds) {
      if (!itemIds.has(itemId)) {
        errors.push(`set ${set.id} references missing item ${itemId}`);
      }
    }
  }

  for (const container of config.containers) {
    const [minCount, maxCount] = container.itemCountRange;
    if (minCount > maxCount) {
      errors.push(`container ${container.id} has invalid itemCountRange`);
    }
    const weightSum = Object.values(container.auctionModeWeights).reduce((sum, value) => sum + value, 0);
    if (weightSum <= 0) {
      errors.push(`container ${container.id} has no auction mode weight`);
    }
    for (const itemId of container.itemPool) {
      if (!itemIds.has(itemId)) {
        errors.push(`container ${container.id} references missing item ${itemId}`);
      }
    }
  }

  for (const round of config.scriptedRounds) {
    if (round.estimateMin > round.estimateMax) {
      errors.push(`scripted round ${round.id} has invalid estimate range`);
    }
    for (const itemId of round.itemIds) {
      if (!itemIds.has(itemId)) {
        errors.push(`scripted round ${round.id} references missing item ${itemId}`);
      }
    }
    if (round.auctionMode === 'deposit_open' && !round.depositValue) {
      errors.push(`scripted round ${round.id} uses deposit_open without depositValue`);
    }
  }

  return { ok: errors.length === 0, errors };
}
