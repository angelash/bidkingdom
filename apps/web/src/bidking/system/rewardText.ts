import {
  Item as bidKingCompatItems,
  bidKingItemDisplayName
} from '@bitkingdom/bidking-compat';

export function parseBidKingRewardRows(raw: string): number[][] {
  if (!raw || raw === '[[]]') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
  } catch {
    return [];
  }
}

export function bidKingRewardRowsLabel(
  rewards: readonly (readonly number[])[],
  emptyLabel = '无赏格'
): string {
  return rewards
    .filter((reward) => reward.length > 0)
    .map(([type = 0, refId = 0, quantity = 1]) => `${bidKingRewardRefLabel(type, refId)} x${quantity.toLocaleString()}`)
    .join(' / ') || emptyLabel;
}

function bidKingRewardRefLabel(type: number, refId: number): string {
  if (type === 1 && refId === 1) {
    return '铜钱';
  }
  if (type === 1 && refId === 2) {
    return '青蚨钱券';
  }
  const item = bidKingCompatItems.find((candidate) => candidate.id === refId);
  if (item) {
    return bidKingItemDisplayName(item);
  }
  return rewardTypeLabel(type, refId);
}

function rewardTypeLabel(type: number, refId: number): string {
  const labels: Record<number, string> = {
    5: '珍物',
    17: '头像',
    18: '名牌'
  };
  return `${labels[type] ?? '赏格'} ${refId}`;
}
