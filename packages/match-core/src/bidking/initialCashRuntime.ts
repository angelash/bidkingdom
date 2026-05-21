import { RankMap } from '@bitkingdom/bidking-compat';
import { constantNumberArray } from './constant/constantEngine';

const FALLBACK_INITIAL_CASH = 100_000;
const PREFERRED_DEFAULT_INITIAL_CASH = 1_000_000;

export function bidKingInitialCashChoices(): number[] {
  const choices = constantNumberArray('initial_points_chooses')
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  return choices.length > 0 ? choices : [FALLBACK_INITIAL_CASH];
}

export function bidKingItemBudgetChoices(): number[] {
  return constantNumberArray('item_budget_chooses')
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
}

export function bidKingDefaultInitialCash(fallback = FALLBACK_INITIAL_CASH): number {
  const choices = bidKingInitialCashChoices();
  return choices.find((value) => value >= PREFERRED_DEFAULT_INITIAL_CASH)
    ?? choices[Math.floor(choices.length / 2)]
    ?? fallback;
}

export function bidKingHighestConfiguredMinimumBidForBidMap(bidMapId: number): number {
  const row = RankMap.find((candidate) => candidate.id === bidMapId);
  return row?.min_bid_range.reduce((max, range) => Math.max(max, range[1] ?? range[0] ?? 0), 0) ?? 0;
}

export function bidKingInitialCashForBidMap(bidMapId?: number, fallback = FALLBACK_INITIAL_CASH): number {
  const choices = bidKingInitialCashChoices();
  const requiredByMap = bidMapId ? bidKingHighestConfiguredMinimumBidForBidMap(bidMapId) : 0;
  const requestedInitialCash = Number.isFinite(fallback) && fallback > 0 ? fallback : FALLBACK_INITIAL_CASH;
  const target = Math.max(bidKingDefaultInitialCash(fallback), requiredByMap, requestedInitialCash);
  return choices.find((value) => value >= target) ?? choices[choices.length - 1] ?? fallback;
}

export function bidKingInitialCashForProfileCoins(
  profileCoins: number | undefined,
  bidMapId?: number,
  fallback = FALLBACK_INITIAL_CASH
): number {
  const choices = bidKingInitialCashChoices();
  const safeCoins = Number.isFinite(profileCoins) && profileCoins && profileCoins > 0
    ? Math.floor(profileCoins)
    : 0;
  const profileTier = choices.filter((value) => value <= safeCoins).at(-1);
  return bidKingInitialCashForBidMap(bidMapId, profileTier ?? fallback);
}
