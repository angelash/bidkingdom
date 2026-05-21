import { constantNumber, constantNumberRows } from './constant/constantEngine';
import { createRewardPlans } from './reward/rewardEngine';

const FALLBACK_PROFILE_COINS = 12_000;

export interface BidKingStarterInventoryReward {
  type: string;
  refId: string;
  quantity: number;
}

export function bidKingStarterRewardRows(): number[][] {
  return constantNumberRows('init_items');
}

export function bidKingStarterCoins(fallback = FALLBACK_PROFILE_COINS): number {
  const coins = createRewardPlans(bidKingStarterRewardRows())
    .filter((reward) => reward.resource === 'coins')
    .reduce((total, reward) => total + reward.quantity, 0);
  return coins > 0 ? coins : fallback;
}

export function bidKingStarterInventoryRewards(): BidKingStarterInventoryReward[] {
  return createRewardPlans(bidKingStarterRewardRows())
    .filter((reward) => reward.resource === 'item')
    .map((reward) => ({
      type: reward.inventoryType,
      refId: String(reward.refId),
      quantity: reward.quantity
    }));
}

export function bidKingStarterHeadId(fallback?: string): string | undefined {
  const headId = constantNumber('init_head');
  return headId > 0 ? String(headId) : fallback;
}
