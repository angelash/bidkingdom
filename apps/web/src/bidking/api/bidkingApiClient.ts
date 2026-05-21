import type {
  MatchEventLog,
  ProfileSnapshot,
  TransactionLog
} from '@bitkingdom/shared';

interface ApiErrorPayload {
  error?: string;
  errorCode?: string;
  errorName?: string;
}

export interface ReplayBundlePayload {
  events: MatchEventLog[];
  transactions: TransactionLog[];
}

export async function fetchProfileSnapshot(serverUrl: string, playerId: string, playerName: string): Promise<ProfileSnapshot> {
  const url = new URL('/api/profile', serverUrl);
  url.searchParams.set('playerId', playerId);
  url.searchParams.set('playerName', playerName);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('profile fetch failed');
  }
  return await response.json() as ProfileSnapshot;
}

export async function postProfileActionSnapshot(
  serverUrl: string,
  playerId: string,
  path: string,
  body: Record<string, unknown>
): Promise<ProfileSnapshot> {
  const response = await fetch(new URL(path, serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId, ...body })
  });
  const payload = await response.json() as ProfileSnapshot | ApiErrorPayload;
  if (!response.ok || !isProfileSnapshot(payload)) {
    throw new Error(apiErrorText(payload, '操作失败'));
  }
  return payload;
}

export async function fetchReplayBundle(serverUrl: string, matchId: string): Promise<ReplayBundlePayload> {
  const [eventsResponse, transactionsResponse] = await Promise.all([
    fetch(`${serverUrl}/api/matches/${matchId}/events`),
    fetch(`${serverUrl}/api/matches/${matchId}/transactions`)
  ]);
  const eventsPayload = await eventsResponse.json() as Pick<ReplayBundlePayload, 'events'>;
  const transactionsPayload = await transactionsResponse.json() as Pick<ReplayBundlePayload, 'transactions'>;
  return {
    events: eventsPayload.events ?? [],
    transactions: transactionsPayload.transactions ?? []
  };
}

function isProfileSnapshot(payload: ProfileSnapshot | ApiErrorPayload): payload is ProfileSnapshot {
  return 'profile' in payload && 'transactions' in payload;
}

function apiErrorText(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const record = payload as ApiErrorPayload;
  const message = record.error ?? fallback;
  return record.errorCode ? `${record.errorCode} · ${message}` : message;
}
