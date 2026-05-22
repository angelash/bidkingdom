import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import type { ServerStore } from '../../services/store';

export interface EconomyLedger {
  hasSource(sourceId: string): boolean;
  record(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: ProfileTransaction['resource'],
    amountBefore: number,
    amountChange: number
  ): void;
  applyNumberChange(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: Extract<ProfileTransaction['resource'], 'coins' | 'goldCoins' | 'boundGoldCoins' | 'rankPoints' | 'xp'>,
    amountChange: number
  ): void;
  transactionsFor(playerId: string, limit: number): ProfileTransaction[];
}

export function createEconomyLedger(store: ServerStore): EconomyLedger {
  function hasSource(sourceId: string): boolean {
    return store.state.transactionSourceIds.includes(sourceId);
  }

  function record(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: ProfileTransaction['resource'],
    amountBefore: number,
    amountChange: number
  ): void {
    if (hasSource(sourceId)) {
      return;
    }
    const transaction: ProfileTransaction = {
      id: `txn_${randomUUID()}`,
      playerId: profile.playerId,
      sourceId,
      reason,
      resource,
      amountBefore,
      amountChange,
      amountAfter: amountBefore + amountChange,
      createdAt: Date.now()
    };
    store.state.transactions.push(transaction);
    store.state.transactionSourceIds.push(sourceId);
  }

  function applyNumberChange(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: Extract<ProfileTransaction['resource'], 'coins' | 'goldCoins' | 'boundGoldCoins' | 'rankPoints' | 'xp'>,
    amountChange: number
  ): void {
    if (hasSource(sourceId) || amountChange === 0) {
      return;
    }
    const before = profile[resource] ?? 0;
    profile[resource] = Math.max(0, before + amountChange);
    record(profile, sourceId, reason, resource, before, profile[resource] - before);
  }

  function transactionsFor(playerId: string, limit: number): ProfileTransaction[] {
    return store.state.transactions
      .filter((transaction) => transaction.playerId === playerId)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  }

  return {
    hasSource,
    record,
    applyNumberChange,
    transactionsFor
  };
}
