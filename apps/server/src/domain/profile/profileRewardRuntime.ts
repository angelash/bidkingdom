import { createRewardPlans, rankRewardForRank } from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { addInventory, inventoryQuantity } from './profileInventory';

export type RewardNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export type RewardTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export function applyRewardRowsToProfile(
  profile: PlayerProfile,
  sourcePrefix: string,
  rewards: readonly (readonly number[])[],
  reason: string,
  applyNumberChange: RewardNumberChangeApplier,
  recordTransaction: RewardTransactionRecorder
): void {
  for (const [index, reward] of createRewardPlans(rewards).entries()) {
    const rewardSourcePrefix = `${sourcePrefix}:reward:${index}:${reward.refId}`;
    if (reward.resource === 'coins') {
      applyNumberChange(profile, `${rewardSourcePrefix}:coins`, `${reason}_coins`, 'coins', reward.quantity);
      continue;
    }
    const before = inventoryQuantity(profile, reward.refId);
    addInventory(profile, reward.inventoryType, String(reward.refId), reward.quantity, `${rewardSourcePrefix}:item`);
    recordTransaction(profile, `${rewardSourcePrefix}:item`, `${reason}_item`, 'item', before, reward.quantity);
  }
}

export function claimRankRewardForProfile(
  profile: PlayerProfile,
  rank: number,
  applyRewardRows: (
    profile: PlayerProfile,
    sourcePrefix: string,
    rewards: readonly (readonly number[])[],
    reason: string
  ) => void,
  recordTransaction: RewardTransactionRecorder
): boolean {
  const plan = rankRewardForRank(rank);
  if (!plan) {
    throw new Error('没有可领取的榜单奖励');
  }
  const sourceId = `rank_reward:${profile.playerId}:${plan.rewardId}`;
  if (profile.claimedRankRewards.includes(plan.rewardId)) {
    return false;
  }
  const rewardRows = [...plan.rewardRows, ...plan.extraRewardRows];
  if (rewardRows.length > 0) {
    applyRewardRows(profile, sourceId, rewardRows, 'rank_reward');
  }
  if (plan.mailId) {
    recordTransaction(profile, `${sourceId}:mail:${plan.mailId}`, 'rank_reward_mail', 'mail', 0, 1);
  }
  recordTransaction(profile, `${sourceId}:claim`, 'rank_reward_claim', 'task', 0, 1);
  profile.claimedRankRewards.push(plan.rewardId);
  profile.updatedAt = Date.now();
  return true;
}
