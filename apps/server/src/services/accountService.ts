import type { AccountSessionSnapshot, PublicPlayerAccount } from '@bitkingdom/shared';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { sanitizeDisplayName, sanitizeText } from '../domain/system/textGuard';
import type { ProfileService } from './profileService';
import type { ServerStore, StoredAccountSession, StoredPlayerAccount } from './store';

const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_SESSION_TTL_MS = 30 * 24 * 3600_000;
const GUEST_SESSION_TTL_MS = 180 * 24 * 3600_000;

export interface AccountService {
  registerAccount(input: AccountPasswordInput): AccountSessionSnapshot;
  loginAccount(input: AccountPasswordInput): AccountSessionSnapshot;
  createGuestSession(input: GuestAccountInput): AccountSessionSnapshot;
  upgradeGuestAccount(token: string, input: AccountPasswordInput): AccountSessionSnapshot;
  changePassword(token: string, input: AccountPasswordChangeInput): AccountSessionSnapshot;
  getSessionSnapshot(token: string): AccountSessionSnapshot | undefined;
  resolveProfileIdForSession(token: string | undefined): string | undefined;
  logout(token: string): boolean;
  logoutAll(token: string): boolean;
}

export interface AccountPasswordInput {
  accountName?: string;
  password?: string;
  playerName?: string;
}

export interface AccountPasswordChangeInput {
  currentPassword?: string;
  nextPassword?: string;
}

export interface GuestAccountInput {
  deviceId?: string;
  playerName?: string;
}

export function createAccountService(store: ServerStore, profiles: ProfileService): AccountService {
  function registerAccount(input: AccountPasswordInput): AccountSessionSnapshot {
    const accountName = cleanAccountName(input.accountName);
    const normalizedName = normalizeAccountName(accountName);
    const password = cleanPassword(input.password);
    if (accountByNormalizedName(normalizedName)) {
      throw new Error('账号已存在');
    }
    const now = Date.now();
    const profileId = `p_${randomUUID()}`;
    profiles.getOrCreateProfile(profileId, input.playerName || accountName);
    const account: StoredPlayerAccount = {
      accountId: `a_${randomUUID()}`,
      accountName,
      displayName: sanitizeDisplayName(input.playerName || accountName, accountName),
      kind: 'password',
      normalizedName,
      passwordHash: hashPassword(password),
      profileId,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };
    store.state.accounts[account.accountId] = account;
    const session = createSession(account, PASSWORD_SESSION_TTL_MS, now);
    store.save();
    return snapshotFor(account, session);
  }

  function loginAccount(input: AccountPasswordInput): AccountSessionSnapshot {
    const normalizedName = normalizeAccountName(sanitizeText(input.accountName ?? ''));
    const account = accountByNormalizedName(normalizedName);
    if (!account || account.kind !== 'password' || !account.passwordHash || !verifyPassword(input.password ?? '', account.passwordHash)) {
      throw new Error('账号或密码不正确');
    }
    const now = Date.now();
    account.lastLoginAt = now;
    account.updatedAt = now;
    if (input.playerName?.trim()) {
      account.displayName = sanitizeDisplayName(input.playerName, account.displayName);
      profiles.getOrCreateProfile(account.profileId, account.displayName);
    }
    const session = createSession(account, PASSWORD_SESSION_TTL_MS, now);
    store.save();
    return snapshotFor(account, session);
  }

  function createGuestSession(input: GuestAccountInput): AccountSessionSnapshot {
    const deviceId = cleanDeviceId(input.deviceId);
    const accountId = `guest_${hashStable(deviceId).slice(0, 24)}`;
    const now = Date.now();
    let account = store.state.accounts[accountId];
    if (!account) {
      const profileId = `p_${accountId}`;
      const guestName = `游客${hashStable(deviceId).slice(0, 4).toUpperCase()}`;
      profiles.getOrCreateProfile(profileId, input.playerName || guestName);
      account = {
        accountId,
        accountName: guestName,
        displayName: sanitizeDisplayName(input.playerName, guestName),
        kind: 'guest',
        normalizedName: `guest:${accountId}`,
        profileId,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      };
      store.state.accounts[account.accountId] = account;
    } else {
      account.lastLoginAt = now;
      account.updatedAt = now;
      if (input.playerName?.trim()) {
        account.displayName = sanitizeDisplayName(input.playerName, account.displayName);
        profiles.getOrCreateProfile(account.profileId, account.displayName);
      }
    }
    const session = createSession(account, GUEST_SESSION_TTL_MS, now);
    store.save();
    return snapshotFor(account, session);
  }

  function upgradeGuestAccount(token: string, input: AccountPasswordInput): AccountSessionSnapshot {
    const session = activeSession(token);
    if (!session) {
      throw new Error('登录已过期');
    }
    const account = store.state.accounts[session.accountId];
    if (!account) {
      throw new Error('账号不存在');
    }
    if (account.kind !== 'guest') {
      return snapshotFor(account, session);
    }
    const accountName = cleanAccountName(input.accountName);
    const normalizedName = normalizeAccountName(accountName);
    const password = cleanPassword(input.password);
    const duplicate = accountByNormalizedName(normalizedName);
    if (duplicate && duplicate.accountId !== account.accountId) {
      throw new Error('账号已存在');
    }
    const now = Date.now();
    account.accountName = accountName;
    account.displayName = sanitizeDisplayName(input.playerName || account.displayName, account.displayName);
    account.kind = 'password';
    account.normalizedName = normalizedName;
    account.passwordHash = hashPassword(password);
    account.updatedAt = now;
    account.lastLoginAt = now;
    session.expiresAt = now + PASSWORD_SESSION_TTL_MS;
    session.lastSeenAt = now;
    profiles.getOrCreateProfile(account.profileId, account.displayName);
    store.save();
    return snapshotFor(account, session);
  }

  function changePassword(token: string, input: AccountPasswordChangeInput): AccountSessionSnapshot {
    const session = activeSession(token);
    if (!session) {
      throw new Error('登录已过期');
    }
    const account = store.state.accounts[session.accountId];
    if (!account || account.kind !== 'password' || !account.passwordHash) {
      throw new Error('当前账号尚未设置密码');
    }
    if (!verifyPassword(input.currentPassword ?? '', account.passwordHash)) {
      throw new Error('当前密码不正确');
    }
    const now = Date.now();
    account.passwordHash = hashPassword(cleanPassword(input.nextPassword));
    account.updatedAt = now;
    session.lastSeenAt = now;
    store.save();
    return snapshotFor(account, session);
  }

  function getSessionSnapshot(token: string): AccountSessionSnapshot | undefined {
    const session = activeSession(token);
    if (!session) {
      return undefined;
    }
    const account = store.state.accounts[session.accountId];
    if (!account) {
      return undefined;
    }
    session.lastSeenAt = Date.now();
    store.save();
    return snapshotFor(account, session);
  }

  function resolveProfileIdForSession(token: string | undefined): string | undefined {
    if (!token) {
      return undefined;
    }
    return activeSession(token)?.profileId;
  }

  function logout(token: string): boolean {
    const session = store.state.accountSessions[token];
    if (!session || session.revokedAt) {
      return false;
    }
    session.revokedAt = Date.now();
    session.lastSeenAt = session.revokedAt;
    store.save();
    return true;
  }

  function logoutAll(token: string): boolean {
    const session = activeSession(token);
    if (!session) {
      return false;
    }
    const now = Date.now();
    for (const candidate of Object.values(store.state.accountSessions)) {
      if (candidate.accountId === session.accountId && !candidate.revokedAt) {
        candidate.revokedAt = now;
        candidate.lastSeenAt = now;
      }
    }
    store.save();
    return true;
  }

  function accountByNormalizedName(normalizedName: string): StoredPlayerAccount | undefined {
    return Object.values(store.state.accounts).find((account) => account.normalizedName === normalizedName);
  }

  function activeSession(token: string): StoredAccountSession | undefined {
    const session = store.state.accountSessions[token];
    if (!session || session.revokedAt || session.expiresAt <= Date.now()) {
      return undefined;
    }
    return session;
  }

  function createSession(account: StoredPlayerAccount, ttlMs: number, now: number): StoredAccountSession {
    const session: StoredAccountSession = {
      token: randomBytes(32).toString('base64url'),
      accountId: account.accountId,
      profileId: account.profileId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + ttlMs
    };
    store.state.accountSessions[session.token] = session;
    return session;
  }

  function snapshotFor(account: StoredPlayerAccount, session: StoredAccountSession): AccountSessionSnapshot {
    return {
      account: publicAccount(account),
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      profile: profiles.getSnapshot(account.profileId, account.displayName)
    };
  }

  return {
    registerAccount,
    loginAccount,
    createGuestSession,
    upgradeGuestAccount,
    changePassword,
    getSessionSnapshot,
    resolveProfileIdForSession,
    logout,
    logoutAll
  };
}

export function bearerToken(value: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(value ?? '');
  return match?.[1]?.trim() || undefined;
}

function publicAccount(account: StoredPlayerAccount): PublicPlayerAccount {
  return {
    accountId: account.accountId,
    accountName: account.accountName,
    displayName: account.displayName,
    kind: account.kind,
    profileId: account.profileId,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastLoginAt: account.lastLoginAt
  };
}

function cleanAccountName(value: string | undefined): string {
  const cleaned = sanitizeText((value ?? '').trim()).slice(0, 32);
  if (cleaned.length < 3) {
    throw new Error('账号至少需要 3 个字符');
  }
  if (/\s/.test(cleaned)) {
    throw new Error('账号不能包含空格');
  }
  return cleaned;
}

function normalizeAccountName(value: string): string {
  return value.trim().toLowerCase();
}

function cleanPassword(value: string | undefined): string {
  const password = value ?? '';
  if (password.length < 6) {
    throw new Error('密码至少需要 6 位');
  }
  if (password.length > 72) {
    throw new Error('密码过长');
  }
  return password;
}

function cleanDeviceId(value: string | undefined): string {
  const cleaned = (value ?? '').trim();
  if (/^[a-zA-Z0-9_-]{12,96}$/.test(cleaned)) {
    return cleaned;
  }
  return randomUUID();
}

function hashStable(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${key}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expectedHex] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !expectedHex) {
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
