import type {
  AccountSessionSnapshot,
  MatchEventLog,
  ProfileSnapshot,
  SendAuctionGameDataSnapshot,
  SendAuctionGameState,
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

export interface SendAuctionGamesPayload {
  generatedAt: number;
  errorCode?: number;
  sendAuctionGameDataList?: SendAuctionGameDataSnapshot[];
  games: SendAuctionGameState[];
}

export async function fetchProfileSnapshot(serverUrl: string, playerId: string, playerName: string, sessionToken?: string): Promise<ProfileSnapshot> {
  const url = new URL('/api/profile', serverUrl);
  url.searchParams.set('playerId', playerId);
  url.searchParams.set('playerName', playerName);
  const response = await fetch(url, { headers: authHeaders(sessionToken) });
  if (!response.ok) {
    throw new Error('profile fetch failed');
  }
  return await response.json() as ProfileSnapshot;
}

export async function postProfileActionSnapshot(
  serverUrl: string,
  playerId: string,
  path: string,
  body: Record<string, unknown>,
  sessionToken?: string
): Promise<ProfileSnapshot> {
  const response = await fetch(new URL(path, serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(sessionToken) },
    body: JSON.stringify({ playerId, ...body })
  });
  const payload = await response.json() as ProfileSnapshot | ApiErrorPayload;
  if (!response.ok || !isProfileSnapshot(payload)) {
    throw new Error(apiErrorText(payload, '操作失败'));
  }
  return payload;
}

export async function fetchAccountSession(serverUrl: string, sessionToken: string): Promise<AccountSessionSnapshot> {
  const response = await fetch(new URL('/api/account/session', serverUrl), {
    headers: authHeaders(sessionToken)
  });
  const payload = await response.json() as AccountSessionSnapshot | ApiErrorPayload;
  if (!response.ok || !isAccountSessionSnapshot(payload)) {
    throw new Error(apiErrorText(payload, '登录已过期'));
  }
  return payload;
}

export async function createGuestAccountSession(
  serverUrl: string,
  input: { deviceId: string; playerName: string }
): Promise<AccountSessionSnapshot> {
  return postAccountSession(serverUrl, '/api/account/guest', input);
}

export async function registerAccountSession(
  serverUrl: string,
  input: { accountName: string; password: string; playerName: string }
): Promise<AccountSessionSnapshot> {
  return postAccountSession(serverUrl, '/api/account/register', input);
}

export async function loginAccountSession(
  serverUrl: string,
  input: { accountName: string; password: string; playerName?: string }
): Promise<AccountSessionSnapshot> {
  return postAccountSession(serverUrl, '/api/account/login', input);
}

export async function upgradeGuestAccountSession(
  serverUrl: string,
  sessionToken: string,
  input: { accountName: string; password: string; playerName: string }
): Promise<AccountSessionSnapshot> {
  return postAccountSession(serverUrl, '/api/account/upgrade', input, sessionToken);
}

export async function changeAccountPasswordSession(
  serverUrl: string,
  sessionToken: string,
  input: { currentPassword: string; nextPassword: string }
): Promise<AccountSessionSnapshot> {
  return postAccountSession(serverUrl, '/api/account/password', input, sessionToken);
}

export async function logoutAccountSession(serverUrl: string, sessionToken: string): Promise<void> {
  await fetch(new URL('/api/account/logout', serverUrl), {
    method: 'POST',
    headers: authHeaders(sessionToken)
  });
}

export async function logoutAllAccountSessions(serverUrl: string, sessionToken: string): Promise<void> {
  await fetch(new URL('/api/account/logout-all', serverUrl), {
    method: 'POST',
    headers: authHeaders(sessionToken)
  });
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

export async function fetchSendAuctionGames(
  serverUrl: string,
  playerId: string,
  sessionToken?: string
): Promise<SendAuctionGamesPayload> {
  const url = new URL('/api/send-auction/games', serverUrl);
  url.searchParams.set('playerId', playerId);
  const response = await fetch(url, { headers: authHeaders(sessionToken) });
  const payload = await response.json() as SendAuctionGamesPayload | ApiErrorPayload;
  if (!response.ok || !isSendAuctionGamesPayload(payload)) {
    throw new Error(apiErrorText(payload, '委托记录读取失败'));
  }
  return payload;
}

function isProfileSnapshot(payload: ProfileSnapshot | ApiErrorPayload): payload is ProfileSnapshot {
  return 'profile' in payload && 'transactions' in payload;
}

function isAccountSessionSnapshot(payload: AccountSessionSnapshot | ApiErrorPayload): payload is AccountSessionSnapshot {
  return 'account' in payload && 'sessionToken' in payload && 'profile' in payload;
}

function isSendAuctionGamesPayload(payload: SendAuctionGamesPayload | ApiErrorPayload): payload is SendAuctionGamesPayload {
  return 'generatedAt' in payload && 'games' in payload && Array.isArray(payload.games);
}

async function postAccountSession(
  serverUrl: string,
  path: string,
  body: Record<string, unknown>,
  sessionToken?: string
): Promise<AccountSessionSnapshot> {
  const response = await fetch(new URL(path, serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(sessionToken) },
    body: JSON.stringify(body)
  });
  const payload = await response.json() as AccountSessionSnapshot | ApiErrorPayload;
  if (!response.ok || !isAccountSessionSnapshot(payload)) {
    throw new Error(apiErrorText(payload, '登录失败'));
  }
  return payload;
}

function authHeaders(sessionToken?: string): Record<string, string> {
  return sessionToken ? { authorization: `Bearer ${sessionToken}` } : {};
}

function apiErrorText(payload: unknown, defaultMessage: string): string {
  if (!payload || typeof payload !== 'object') {
    return defaultMessage;
  }
  const record = payload as ApiErrorPayload;
  const message = record.error ?? defaultMessage;
  return record.errorCode ? `${record.errorCode} · ${message}` : message;
}
