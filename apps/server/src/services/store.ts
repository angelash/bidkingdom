import type { PlayerProfile, ProfileTransaction, PublicPlayerAccount } from '@bitkingdom/shared';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ServerStoreState {
  schemaVersion: number;
  profiles: Record<string, PlayerProfile>;
  transactions: ProfileTransaction[];
  transactionSourceIds: string[];
  accounts: Record<string, StoredPlayerAccount>;
  accountSessions: Record<string, StoredAccountSession>;
}

export interface ServerStore {
  state: ServerStoreState;
  save(): void;
}

export interface StoredPlayerAccount extends PublicPlayerAccount {
  normalizedName: string;
  passwordHash?: string;
}

export interface StoredAccountSession {
  token: string;
  accountId: string;
  profileId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revokedAt?: number;
}

export const CURRENT_STORE_SCHEMA_VERSION = 2;

const EMPTY_STATE: ServerStoreState = {
  schemaVersion: CURRENT_STORE_SCHEMA_VERSION,
  profiles: {},
  transactions: [],
  transactionSourceIds: [],
  accounts: {},
  accountSessions: {}
};

interface SQLiteDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatementSync;
}

interface SQLiteStatementSync {
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): void;
}

interface SQLiteProfileRow {
  player_id: string;
  value: string;
}

interface SQLiteTransactionRow {
  value: string;
}

interface SQLiteSourceRow {
  source_id: string;
}

interface SQLiteAccountRow {
  account_id: string;
  value: string;
}

interface SQLiteSessionRow {
  token: string;
  value: string;
}

interface SQLiteMetaRow {
  value: string;
}

const require = createRequire(import.meta.url);

export function createServerStore(): ServerStore {
  const driver = process.env.BITKINGDOM_STORE_DRIVER ?? 'sqlite';
  if (driver === 'json') {
    return createJsonFileStore();
  }
  return createSQLiteStore();
}

export function createJsonFileStore(filePath = process.env.BITKINGDOM_STORE_PATH ?? defaultStorePath()): ServerStore {
  const resolvedPath = resolve(filePath);
  const state = readState(resolvedPath);
  return {
    state,
    save() {
      state.schemaVersion = CURRENT_STORE_SCHEMA_VERSION;
      mkdirSync(dirname(resolvedPath), { recursive: true });
      writeFileSync(resolvedPath, JSON.stringify(state, null, 2), 'utf8');
    }
  };
}

export function createSQLiteStore(filePath = process.env.BITKINGDOM_SQLITE_PATH ?? defaultSQLiteStorePath()): ServerStore {
  const resolvedPath = resolve(filePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SQLiteDatabaseSync };
  const db = new DatabaseSync(resolvedPath);
  migrateSQLiteStore(db);
  const state = readSQLiteState(db);
  return {
    state,
    save() {
      saveSQLiteState(db, state);
    }
  };
}

function defaultStorePath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../tmp/server-store.json');
}

function defaultSQLiteStorePath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../tmp/server-store.sqlite');
}

function readState(filePath: string): ServerStoreState {
  if (!existsSync(filePath)) {
    return cloneEmptyState();
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ServerStoreState>;
    return {
      schemaVersion: parsed.schemaVersion ?? 1,
      profiles: parsed.profiles ?? {},
      transactions: parsed.transactions ?? [],
      transactionSourceIds: parsed.transactionSourceIds ?? [],
      accounts: parsed.accounts ?? {},
      accountSessions: parsed.accountSessions ?? {}
    };
  } catch {
    return cloneEmptyState();
  }
}

function cloneEmptyState(): ServerStoreState {
  return {
    schemaVersion: CURRENT_STORE_SCHEMA_VERSION,
    profiles: { ...EMPTY_STATE.profiles },
    transactions: [...EMPTY_STATE.transactions],
    transactionSourceIds: [...EMPTY_STATE.transactionSourceIds],
    accounts: { ...EMPTY_STATE.accounts },
    accountSessions: { ...EMPTY_STATE.accountSessions }
  };
}

function migrateSQLiteStore(db: SQLiteDatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      player_id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transaction_sources (
      source_id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      normalized_name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (
      token TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function readSQLiteState(db: SQLiteDatabaseSync): ServerStoreState {
  const schemaVersion = Number((db.prepare("SELECT value FROM store_meta WHERE key = 'schema_version'").all() as SQLiteMetaRow[])[0]?.value ?? 1);
  const profiles: Record<string, PlayerProfile> = {};
  for (const row of db.prepare('SELECT player_id, value FROM profiles').all() as SQLiteProfileRow[]) {
    try {
      profiles[row.player_id] = JSON.parse(row.value) as PlayerProfile;
    } catch {
      // Skip corrupt rows; the admin parity endpoint will still expose row counts.
    }
  }
  const transactions = (db.prepare('SELECT value FROM transactions ORDER BY created_at ASC').all() as SQLiteTransactionRow[])
    .map((row) => {
      try {
        return JSON.parse(row.value) as ProfileTransaction;
      } catch {
        return undefined;
      }
    })
    .filter((row): row is ProfileTransaction => Boolean(row));
  const transactionSourceIds = (db.prepare('SELECT source_id FROM transaction_sources').all() as SQLiteSourceRow[])
    .map((row) => row.source_id);
  const accounts: Record<string, StoredPlayerAccount> = {};
  for (const row of db.prepare('SELECT account_id, value FROM accounts').all() as SQLiteAccountRow[]) {
    try {
      const account = JSON.parse(row.value) as StoredPlayerAccount;
      accounts[row.account_id] = normalizeStoredAccount(account);
    } catch {
      // Skip corrupt account rows; users can recreate login state without profile loss.
    }
  }
  const accountSessions: Record<string, StoredAccountSession> = {};
  for (const row of db.prepare('SELECT token, value FROM account_sessions').all() as SQLiteSessionRow[]) {
    try {
      const session = JSON.parse(row.value) as StoredAccountSession;
      accountSessions[row.token] = session;
    } catch {
      // Skip corrupt sessions so the rest of the store remains usable.
    }
  }
  return {
    schemaVersion,
    profiles,
    transactions,
    transactionSourceIds,
    accounts,
    accountSessions
  };
}

function saveSQLiteState(db: SQLiteDatabaseSync, state: ServerStoreState): void {
  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.exec('DELETE FROM profiles; DELETE FROM transactions; DELETE FROM transaction_sources; DELETE FROM accounts; DELETE FROM account_sessions;');
    const profileInsert = db.prepare('INSERT INTO profiles (player_id, updated_at, value) VALUES (?, ?, ?)');
    for (const profile of Object.values(state.profiles)) {
      profileInsert.run(profile.playerId, profile.updatedAt, JSON.stringify(profile));
    }
    const transactionInsert = db.prepare('INSERT INTO transactions (id, player_id, source_id, created_at, value) VALUES (?, ?, ?, ?, ?)');
    for (const transaction of state.transactions) {
      transactionInsert.run(transaction.id, transaction.playerId, transaction.sourceId, transaction.createdAt, JSON.stringify(transaction));
    }
    const sourceInsert = db.prepare('INSERT INTO transaction_sources (source_id) VALUES (?)');
    for (const sourceId of state.transactionSourceIds) {
      sourceInsert.run(sourceId);
    }
    const accountInsert = db.prepare('INSERT INTO accounts (account_id, normalized_name, kind, profile_id, updated_at, value) VALUES (?, ?, ?, ?, ?, ?)');
    for (const account of Object.values(state.accounts)) {
      accountInsert.run(
        account.accountId,
        account.normalizedName,
        account.kind,
        account.profileId,
        account.updatedAt,
        JSON.stringify(account)
      );
    }
    const sessionInsert = db.prepare('INSERT INTO account_sessions (token, account_id, profile_id, expires_at, value) VALUES (?, ?, ?, ?, ?)');
    for (const session of Object.values(state.accountSessions)) {
      sessionInsert.run(session.token, session.accountId, session.profileId, session.expiresAt, JSON.stringify(session));
    }
    state.schemaVersion = CURRENT_STORE_SCHEMA_VERSION;
    db.prepare('INSERT OR REPLACE INTO store_meta (key, value) VALUES (?, ?)').run('schema_version', String(state.schemaVersion));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function normalizeStoredAccount(account: StoredPlayerAccount): StoredPlayerAccount {
  return {
    ...account,
    normalizedName: account.normalizedName || account.accountName.trim().toLowerCase(),
    kind: account.kind === 'password' ? 'password' : 'guest'
  };
}
