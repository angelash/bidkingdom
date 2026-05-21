import { constantNumber, constantNumberArray } from './constant/constantEngine';

export interface BidKingCollectionRuleRuntime {
  collectionCountMax: number;
  duplicateRatesPerMille: number[];
  gainIntervalSeconds: number;
}

export interface BidKingBidLossRebateRuntime {
  threshold: number;
  ratePerMille: number;
}

export function bidKingMailMaxCount(fallback = 100): number {
  const value = constantNumber('mail_max_count', fallback);
  return value > 0 ? value : fallback;
}

export function bidKingCollectionRuleRuntime(): BidKingCollectionRuleRuntime {
  return {
    collectionCountMax: positiveNumber('collection_counts_max', 10),
    duplicateRatesPerMille: constantNumberArray('cabinet_rate').filter((value) => value > 0),
    gainIntervalSeconds: positiveNumber('cabinet_gaincoin', 10)
  };
}

export function bidKingBidLossRebateRuntime(): BidKingBidLossRebateRuntime {
  const [threshold = 0, ratePerMille = 0] = constantNumberArray('bid_fanli');
  return {
    threshold: Math.max(0, Math.floor(threshold)),
    ratePerMille: Math.max(0, Math.floor(ratePerMille))
  };
}

export function bidKingBidLossRebateAmount(loss: number): number {
  const runtime = bidKingBidLossRebateRuntime();
  const safeLoss = Math.max(0, Math.floor(loss));
  if (runtime.threshold <= 0 || safeLoss < runtime.threshold || runtime.ratePerMille <= 0) {
    return 0;
  }
  return Math.floor(safeLoss * runtime.ratePerMille / 1000);
}

function positiveNumber(id: string, fallback: number): number {
  const value = constantNumber(id, fallback);
  return value > 0 ? value : fallback;
}
