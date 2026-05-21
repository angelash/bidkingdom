import type { BidKingRawTableRow } from './schema';

export interface BidKingActivityWindow {
  active: boolean;
  durationSeconds?: number;
  expiresAt?: number;
  remainingMs?: number;
  startedAt: number;
}

export interface BidKingActivityClaimState {
  active: boolean;
  claimable: boolean;
  claimed: boolean;
  hasReward: boolean;
  redPoint: boolean;
  reason: string;
  window: BidKingActivityWindow;
}

export function activityRewardRows(activity: BidKingRawTableRow): number[][] {
  return parseRawNumberRows(activity.columns[12] ?? '');
}

export function activityDurationSeconds(activity: BidKingRawTableRow): number | undefined {
  const value = Number(activity.columns[11] ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export function activityRuntimeWindow(
  activity: BidKingRawTableRow,
  profileCreatedAt: number | undefined,
  now = Date.now()
): BidKingActivityWindow {
  const durationSeconds = activityDurationSeconds(activity);
  const startedAt = Number.isFinite(profileCreatedAt) && profileCreatedAt ? Math.max(0, Math.trunc(profileCreatedAt)) : now;
  const expiresAt = durationSeconds ? startedAt + durationSeconds * 1000 : undefined;
  const remainingMs = expiresAt === undefined ? undefined : Math.max(0, expiresAt - now);
  return {
    active: expiresAt === undefined || expiresAt > now,
    durationSeconds,
    expiresAt,
    remainingMs,
    startedAt
  };
}

export function activityClaimState(
  activity: BidKingRawTableRow,
  options: { claimed: boolean; profileCreatedAt?: number; now?: number }
): BidKingActivityClaimState {
  const window = activityRuntimeWindow(activity, options.profileCreatedAt, options.now);
  const hasReward = activityRewardRows(activity).length > 0;
  const claimable = window.active && hasReward && !options.claimed;
  return {
    active: window.active,
    claimable,
    claimed: options.claimed,
    hasReward,
    redPoint: claimable,
    reason: activityClaimReason({ active: window.active, claimed: options.claimed, hasReward }),
    window
  };
}

function activityClaimReason(state: { active: boolean; claimed: boolean; hasReward: boolean }): string {
  if (state.claimed) {
    return '已领取';
  }
  if (!state.active) {
    return '已过期';
  }
  if (!state.hasReward) {
    return '无奖励';
  }
  return '可领取';
}

function parseRawNumberRows(raw: string): number[][] {
  if (!raw || raw === '[[]]') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    if (parsed.every((value) => typeof value === 'number')) {
      const [refId = 0, quantity = 1] = parsed;
      return refId ? [[0, refId, quantity]] : [];
    }
    return parsed
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
  } catch {
    return [];
  }
}
