import { constantNumber, constantNumberRows } from './constant/constantEngine';
import { createRewardPlans } from './reward/rewardEngine';

export interface BidKingStarterInventoryReward {
  type: string;
  refId: string;
  quantity: number;
}

export function bidKingStarterRewardRows(): number[][] {
  return constantNumberRows('init_items');
}

export function bidKingStarterCoins(): number {
  const coins = createRewardPlans(bidKingStarterRewardRows())
    .filter((reward) => reward.resource === 'coins')
    .reduce((total, reward) => total + reward.quantity, 0);
  if (coins <= 0) {
    throw new Error('BidKing Constant.init_items must grant starter coins');
  }
  return coins;
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

export function bidKingStarterHeadId(): string {
  const headId = constantNumber('init_head');
  if (headId <= 0) {
    throw new Error('BidKing Constant.init_head must be positive');
  }
  return String(headId);
}
