import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ServerStoreState {
  profiles: Record<string, PlayerProfile>;
  transactions: ProfileTransaction[];
  transactionSourceIds: string[];
}

export interface ServerStore {
  state: ServerStoreState;
  save(): void;
}

const EMPTY_STATE: ServerStoreState = {
  profiles: {},
  transactions: [],
  transactionSourceIds: []
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
      profiles: parsed.profiles ?? {},
      transactions: parsed.transactions ?? [],
      transactionSourceIds: parsed.transactionSourceIds ?? []
    };
  } catch {
    return cloneEmptyState();
  }
}

function cloneEmptyState(): ServerStoreState {
  return {
    profiles: { ...EMPTY_STATE.profiles },
    transactions: [...EMPTY_STATE.transactions],
    transactionSourceIds: [...EMPTY_STATE.transactionSourceIds]
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
  `);
}

function readSQLiteState(db: SQLiteDatabaseSync): ServerStoreState {
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
  return {
    profiles,
    transactions,
    transactionSourceIds
  };
}

function saveSQLiteState(db: SQLiteDatabaseSync, state: ServerStoreState): void {
  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.exec('DELETE FROM profiles; DELETE FROM transactions; DELETE FROM transaction_sources;');
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
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
