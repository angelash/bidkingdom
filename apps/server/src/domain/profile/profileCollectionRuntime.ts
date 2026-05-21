import { Item, NumberTable } from '@bitkingdom/bidking-compat';
import { bidKingCollectionRuleRuntime } from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { canonicalCodexItemId } from './profileInventory';

const MAX_COLLECTION_INCOME_MS = 24 * 3600_000;

export interface CollectionIncomeSnapshot {
  activeBonus: number;
  cabinetHourlyCoins: number;
  claimableCoins: number;
  collectionCountMax: number;
  duplicateRatesPerMille: number[];
  elapsedMs: number;
  gainIntervalSeconds: number;
  lastClaimedAt: number;
  nextClaimAt: number;
}

export type CollectionIncomeNumberApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins'>,
  amountChange: number
) => void;

export function collectionIncomeSnapshot(profile: PlayerProfile, now = Date.now()): CollectionIncomeSnapshot {
  const rule = bidKingCollectionRuleRuntime();
  const cabinetHourlyCoins = collectionCabinetHourlyCoins(profile);
  const activeBonus = NumberTable
    .filter((row) => profile.codex.length >= row.counts)
    .reduce((sum, row) => sum + row.numberbonus, 0);
  const lastClaimedAt = profile.lastCollectionIncomeAt ?? profile.createdAt ?? now;
  const elapsedMs = Math.min(MAX_COLLECTION_INCOME_MS, Math.max(0, now - lastClaimedAt));
  const nextClaimAt = lastClaimedAt + rule.gainIntervalSeconds * 1000;
  const claimableCoins = now >= nextClaimAt
    ? Math.floor(cabinetHourlyCoins * (1 + activeBonus) * (elapsedMs / 3600_000))
    : 0;
  return {
    activeBonus,
    cabinetHourlyCoins,
    claimableCoins,
    collectionCountMax: rule.collectionCountMax,
    duplicateRatesPerMille: rule.duplicateRatesPerMille,
    elapsedMs,
    gainIntervalSeconds: rule.gainIntervalSeconds,
    lastClaimedAt,
    nextClaimAt
  };
}

export function claimCollectionIncomeForProfile(
  profile: PlayerProfile,
  applyNumberChange: CollectionIncomeNumberApplier,
  now = Date.now()
): boolean {
  const income = collectionIncomeSnapshot(profile, now);
  if (income.claimableCoins <= 0) {
    return false;
  }
  applyNumberChange(
    profile,
    `collection_income:${profile.playerId}:${income.lastClaimedAt}:${now}`,
    'collection_income_claim',
    'coins',
    income.claimableCoins
  );
  profile.lastCollectionIncomeAt = now;
  profile.updatedAt = now;
  return true;
}

function collectionCabinetHourlyCoins(profile: PlayerProfile): number {
  return (profile.cabinetItemIds ?? [])
    .map((itemId) => Item.find((row) => canonicalCodexItemId(`compat_${row.id}`) === canonicalCodexItemId(itemId)))
    .filter((item): item is (typeof Item)[number] => Boolean(item))
    .reduce((sum, item) => sum + item.collection_coin * 3600, 0);
}
