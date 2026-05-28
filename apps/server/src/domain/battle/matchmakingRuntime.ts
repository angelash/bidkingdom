import type { CoreAuctionMode } from '@bitkingdom/shared';

export const MATCHMAKING_MAX_WAIT_MS = 10_000;
export const MATCHMAKING_DISCONNECT_GRACE_MS = 3_000;

export interface MatchmakingEntry {
  ticketId: string;
  socketId: string;
  playerId: string;
  playerName: string;
  profileId: string;
  selectedBidMapId: number;
  coreAuctionMode: CoreAuctionMode;
  roleId?: string;
  sourceHeroId?: number;
  enqueuedAt: number;
  lastSeenAt: number;
  status: 'queued' | 'matched' | 'cancelled';
}

export interface MatchmakingBucket {
  key: string;
  capacity: number;
  entries: MatchmakingEntry[];
  timer?: NodeJS.Timeout;
}

export interface MatchmakingBucketInput {
  selectedBidMapId: number;
  coreAuctionMode: CoreAuctionMode;
  capacity: number;
  rulesVersion?: string;
}

export function matchmakingBucketKey(input: MatchmakingBucketInput): string {
  return [
    'normal',
    input.selectedBidMapId,
    input.coreAuctionMode,
    input.capacity,
    input.rulesVersion ?? 'v1'
  ].join(':');
}

export function activeMatchmakingEntries(bucket: MatchmakingBucket): MatchmakingEntry[] {
  return bucket.entries
    .filter((entry) => entry.status === 'queued')
    .sort((left, right) => left.enqueuedAt - right.enqueuedAt || left.ticketId.localeCompare(right.ticketId));
}

export function matchmakingBucketElapsedMs(bucket: MatchmakingBucket, now: number): number {
  const first = activeMatchmakingEntries(bucket)[0];
  return first ? Math.max(0, now - first.enqueuedAt) : 0;
}

export function shouldStartMatchmakingBucket(bucket: MatchmakingBucket, now: number): boolean {
  const entries = activeMatchmakingEntries(bucket);
  if (entries.length === 0) {
    return false;
  }
  if (entries.length >= bucket.capacity) {
    return true;
  }
  return now - entries[0]!.enqueuedAt >= MATCHMAKING_MAX_WAIT_MS;
}

export function takeMatchmakingBatch(bucket: MatchmakingBucket, now: number): MatchmakingEntry[] | undefined {
  if (!shouldStartMatchmakingBucket(bucket, now)) {
    return undefined;
  }
  const batch = activeMatchmakingEntries(bucket).slice(0, bucket.capacity);
  if (batch.length === 0) {
    return undefined;
  }
  const batchIds = new Set(batch.map((entry) => entry.ticketId));
  bucket.entries = bucket.entries.filter((entry) => !batchIds.has(entry.ticketId));
  return batch.map((entry) => ({
    ...entry,
    status: 'matched'
  }));
}
