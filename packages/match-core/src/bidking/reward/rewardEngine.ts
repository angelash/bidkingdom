import { RankReward, bidKingRawTableDisplayName } from '@bitkingdom/bidking-compat';

export type BidKingRewardResource = 'coins' | 'item';

export interface BidKingRewardPlan {
  resource: BidKingRewardResource;
  rewardType: number;
  refId: number;
  quantity: number;
  inventoryType: string;
}

export interface RankRewardPlan {
  rewardId: string;
  activityId: string;
  rankId: string;
  rankRange: [number, number];
  rewardRows: number[][];
  extraRewardRows: number[][];
  mailId?: string;
  label: string;
}

export function createRewardPlans(rewards: readonly (readonly number[])[]): BidKingRewardPlan[] {
  const plans: BidKingRewardPlan[] = [];
  for (const reward of rewards) {
    const [rewardType = 0, refId = 0, amount = reward[3] ?? 1] = reward;
    const quantity = Number(amount || 1);
    if (!refId || quantity <= 0) {
      continue;
    }
    if (rewardType === 1 && refId === 1) {
      plans.push({
        resource: 'coins',
        rewardType,
        refId,
        quantity,
        inventoryType: 'coins'
      });
      continue;
    }
    plans.push({
      resource: 'item',
      rewardType,
      refId,
      quantity,
      inventoryType: String(rewardType || 'item')
    });
  }
  return plans;
}

export function parseBidKingNumberRows(raw?: string): number[][] {
  if (!raw || raw === '[[]]') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((row): row is unknown[] => Array.isArray(row) && row.length > 0)
      .map((row) => row.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
  } catch {
    return [];
  }
}

export function activityRewardRowsFromRaw(raw?: string): number[][] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'number')) {
      const [refId = 0, quantity = 1] = parsed;
      return refId ? [[0, refId, quantity]] : [];
    }
  } catch {
    return [];
  }
  return parseBidKingNumberRows(raw);
}

export function rankRewardPlans(): RankRewardPlan[] {
  return RankReward.map((row) => {
    const range = parseRankRewardRange(row.columns[4]);
    return {
      rewardId: row.id,
      activityId: row.columns[2] ?? '',
      rankId: row.columns[3] ?? '',
      rankRange: range,
      rewardRows: parseBidKingNumberRows(row.columns[5]),
      extraRewardRows: parseBidKingNumberRows(row.columns[7]),
      mailId: row.columns[8] || undefined,
      label: bidKingRawTableDisplayName(row)
    };
  });
}

export function rankRewardForRank(rank: number): RankRewardPlan | undefined {
  return rankRewardPlans().find((plan) => rank >= plan.rankRange[0] && rank <= plan.rankRange[1]);
}

export function parseRankRewardRange(raw?: string): [number, number] {
  if (!raw) {
    return [1, 1];
  }
  const values = raw.match(/\d+/g)?.map(Number) ?? [];
  const first = values[0] ?? 1;
  return [first, values[1] ?? first];
}
