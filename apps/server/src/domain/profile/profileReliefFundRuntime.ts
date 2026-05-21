import { Item } from '@bitkingdom/bidking-compat';
import { bidKingReliefFundRuntime, createRewardPlans } from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { canonicalCodexItemId } from './profileInventory';
import { ensureProfileShape } from './profileShape';

const RELIEF_DATE_KEY = 'bidkingReliefFundDate';
const RELIEF_CLAIMS_KEY = 'bidkingReliefFundClaims';

export interface ReliefFundSnapshot {
  playerId: string;
  dateKey: string;
  totalAssets: number;
  limit: number;
  times: number;
  claimedToday: number;
  remainingClaims: number;
  eligible: boolean;
  reason: string;
  rewardRows: number[][];
  rewardCoins: number;
}

export type ReliefFundRewardApplier = (
  profile: PlayerProfile,
  sourcePrefix: string,
  rewards: readonly (readonly number[])[],
  reason: string
) => void;

export type ReliefFundTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export function reliefFundSnapshotForProfile(profile: PlayerProfile, now = Date.now()): ReliefFundSnapshot {
  ensureProfileShape(profile);
  const runtime = bidKingReliefFundRuntime();
  const dateKey = shanghaiDateKey(now);
  const claimedToday = profile.settings[RELIEF_DATE_KEY] === dateKey
    ? Math.max(0, Math.floor(Number(profile.settings[RELIEF_CLAIMS_KEY] ?? 0) || 0))
    : 0;
  const totalAssets = profileTotalAssets(profile);
  const remainingClaims = Math.max(0, runtime.times - claimedToday);
  const eligible = runtime.times > 0 && remainingClaims > 0 && totalAssets < runtime.limit;
  const rewardCoins = createRewardPlans(runtime.rewardRows)
    .filter((reward) => reward.resource === 'coins')
    .reduce((sum, reward) => sum + reward.quantity, 0);
  return {
    playerId: profile.playerId,
    dateKey,
    totalAssets,
    limit: runtime.limit,
    times: runtime.times,
    claimedToday,
    remainingClaims,
    eligible,
    reason: eligible
      ? '可领取'
      : remainingClaims <= 0
        ? '今日次数已用完'
        : totalAssets >= runtime.limit
          ? '总资产高于救济线'
          : '救济金未配置',
    rewardRows: runtime.rewardRows,
    rewardCoins
  };
}

export function claimReliefFundForProfile(
  profile: PlayerProfile,
  applyRewardRows: ReliefFundRewardApplier,
  recordTransaction: ReliefFundTransactionRecorder,
  now = Date.now()
): boolean {
  const snapshot = reliefFundSnapshotForProfile(profile, now);
  if (!snapshot.eligible) {
    throw new Error(snapshot.reason);
  }
  const nextClaimCount = snapshot.claimedToday + 1;
  profile.settings[RELIEF_DATE_KEY] = snapshot.dateKey;
  profile.settings[RELIEF_CLAIMS_KEY] = nextClaimCount;
  const sourcePrefix = `relief_fund:${profile.playerId}:${snapshot.dateKey}:${nextClaimCount}`;
  applyRewardRows(profile, sourcePrefix, snapshot.rewardRows, 'relief_fund_reward');
  recordTransaction(profile, `${sourcePrefix}:claim`, 'relief_fund_claim', 'task', snapshot.claimedToday, 1);
  profile.updatedAt = now;
  return true;
}

export function profileTotalAssets(profile: PlayerProfile): number {
  ensureProfileShape(profile);
  const inventoryValue = profile.inventory.reduce((sum, entry) => (
    sum + itemAssetValue(entry.refId) * Math.max(0, Math.floor(entry.quantity))
  ), 0);
  const cabinetValue = (profile.cabinetItemIds ?? []).reduce((sum, itemId) => (
    sum + itemAssetValue(itemId)
  ), 0);
  return Math.max(0, Math.floor(profile.coins + inventoryValue + cabinetValue));
}

function itemAssetValue(refId: string | number): number {
  const canonicalId = canonicalCodexItemId(String(refId));
  const numericId = Number(String(canonicalId).replace(/^compat_/, ''));
  const item = Item.find((row) => row.id === numericId);
  if (!item) {
    return 0;
  }
  return Math.max(0, Math.floor(item.base_value || item.auction_baseprice[0] || 0));
}

function shanghaiDateKey(now: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric'
  }).formatToParts(new Date(now));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}
