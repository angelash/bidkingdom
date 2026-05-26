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

export function bidKingMailMaxCount(): number {
  return positiveNumber('mail_max_count');
}

export function bidKingCollectionRuleRuntime(): BidKingCollectionRuleRuntime {
  return {
    collectionCountMax: positiveNumber('collection_counts_max'),
    duplicateRatesPerMille: positiveArray('cabinet_rate'),
    gainIntervalSeconds: positiveNumber('cabinet_gaincoin')
  };
}

export function bidKingBidLossRebateRuntime(): BidKingBidLossRebateRuntime {
  const values = constantNumberArray('bid_fanli');
  if (values.length < 2) {
    throw new Error('BidKing Constant.bid_fanli must contain threshold and rate');
  }
  const [threshold = 0, ratePerMille = 0] = values;
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

function positiveNumber(id: string): number {
  const value = constantNumber(id);
  if (value <= 0) {
    throw new Error(`BidKing Constant.${id} must be positive`);
  }
  return value;
}

function positiveArray(id: string): number[] {
  const values = constantNumberArray(id).filter((value) => value > 0);
  if (values.length === 0) {
    throw new Error(`BidKing Constant.${id} must contain positive values`);
  }
  return values;
}
