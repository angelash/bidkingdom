import { Pay } from '@bitkingdom/bidking-compat';
import { activityRewardRowsFromRaw, parseBidKingNumberRows } from '@bitkingdom/match-core';

type ColumnRow = {
  columns: readonly string[];
};

type PurchaseListRow = {
  id: string | number;
};

type LevelRewardRow = {
  level_reward: readonly (readonly number[])[];
  bass_reward: readonly (readonly number[])[];
  big_bass_reward: readonly (readonly number[])[];
};

export function activityRewardRows(row: ColumnRow): number[][] {
  return activityRewardRowsFromRaw(row.columns[12]);
}

export function levelRewardRows(rows: readonly (readonly number[])[]): number[][] {
  return rows
    .map(([refId = 0, quantity = 1]) => (refId === 1 ? [1, 1, quantity] : [0, refId, quantity]))
    .filter(([, refId = 0, quantity = 0]) => refId > 0 && quantity > 0);
}

export function allLevelRewardRows(row: LevelRewardRow): number[][] {
  return [
    ...levelRewardRows(row.level_reward),
    ...levelRewardRows(row.bass_reward),
    ...levelRewardRows(row.big_bass_reward)
  ];
}

export function giftPackageRewards(row: ColumnRow): number[][] {
  return parseBidKingNumberRows(row.columns[7]);
}

export function dlcRewards(row: ColumnRow): number[][] {
  return parseBidKingNumberRows(row.columns[4]);
}

export function payCoinAmount(row: ColumnRow): number {
  const base = Number(row.columns[5] ?? 0);
  const bonus = Number(row.columns[8] ?? 0);
  return (Number.isFinite(base) ? base : 0) + (Number.isFinite(bonus) ? bonus : 0);
}

export function payPriceAmount(row: ColumnRow): number {
  const price = Number(row.columns[6] ?? 0);
  return Number.isFinite(price) ? price : 0;
}

export function payForPurchaseList(row: PurchaseListRow): (typeof Pay)[number] | undefined {
  const index = Math.max(0, Number(row.id) - 1001);
  return Pay[index] ?? Pay.find((candidate) => candidate.id === String(index + 1));
}
