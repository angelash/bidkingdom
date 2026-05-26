import { constantNumber, constantNumberArray } from './constant/constantEngine';

const HOUR_MS = 3600_000;

export type BidKingMarketOrderType = 'trade' | 'auction';

export interface BidKingMarketRuleRuntime {
  listingFeeRatePerMille: number;
  auctionTaxRatePerMille: number;
  auctionStorageFeeRatePerMille: number;
  bidIncrementRatePerTenThousand: number;
  listingCostRatePerTenThousand24h: number;
  listingDurationHours: number[];
  publicTimeHours: number;
  slotBase: number;
  slotMax: number;
  auctionTimeLimitSeconds: number[];
  auctionSlotPrices: number[];
  auctionCounts: number;
  priceNoticePerMille: number;
}

export function bidKingMarketRuleRuntime(): BidKingMarketRuleRuntime {
  return {
    listingFeeRatePerMille: nonNegativeConstant('item_fee_rate'),
    auctionTaxRatePerMille: nonNegativeConstant('item_bid_fax'),
    auctionStorageFeeRatePerMille: nonNegativeConstant('item_bid_fee'),
    bidIncrementRatePerTenThousand: nonNegativeConstant('item_bid_price_add'),
    listingCostRatePerTenThousand24h: nonNegativeConstant('item_bid_cost'),
    listingDurationHours: positiveArray('item_bid_time'),
    publicTimeHours: nonNegativeConstant('item_bid_public_time'),
    slotBase: positiveConstant('item_bid_slot_base'),
    slotMax: positiveConstant('item_bid_slot_max'),
    auctionTimeLimitSeconds: positiveArray('auction_time_limit'),
    auctionSlotPrices: positiveArray('auction_slot_price'),
    auctionCounts: positiveConstant('auction_counts'),
    priceNoticePerMille: positiveConstant('auction_price_notice')
  };
}

export function bidKingMarketOrderDurationHours(orderType: BidKingMarketOrderType): number {
  const durations = bidKingMarketRuleRuntime().listingDurationHours;
  const index = orderType === 'auction' ? 1 : 0;
  const value = durations[index];
  if (value === undefined) {
    throw new Error(`BidKing Constant.item_bid_time missing duration for ${orderType}`);
  }
  return value;
}

export function bidKingMarketOrderDurationMs(orderType: BidKingMarketOrderType): number {
  return bidKingMarketOrderDurationHours(orderType) * HOUR_MS;
}

export function bidKingMarketListingCost(price: number, durationHours: number): number {
  const safePrice = Math.max(0, Math.floor(price));
  if (safePrice <= 1) {
    return 0;
  }
  const rate = bidKingMarketRuleRuntime().listingCostRatePerTenThousand24h;
  const hours = Math.max(1, Math.floor(durationHours));
  return Math.floor(Math.max(safePrice * rate * hours / 10000 / 24, 1));
}

export function bidKingMarketListingFee(totalPrice: number): number {
  const safeTotal = Math.max(0, Math.floor(totalPrice));
  return Math.floor(safeTotal * bidKingMarketRuleRuntime().listingFeeRatePerMille / 1000);
}

export function bidKingMarketBidIncrement(price: number): number {
  const safePrice = Math.max(0, Math.floor(price));
  const rate = bidKingMarketRuleRuntime().bidIncrementRatePerTenThousand;
  return Math.max(1, Math.floor(safePrice * rate / 10000));
}

export function bidKingMarketListingSlotBase(): number {
  return bidKingMarketRuleRuntime().slotBase;
}

export function bidKingMarketListingSlotMax(): number {
  return bidKingMarketRuleRuntime().slotMax;
}

export function bidKingMarketSnapshotLimit(): number {
  return bidKingMarketRuleRuntime().auctionCounts;
}

export function bidKingMarketPublicDelayMs(): number {
  return bidKingMarketRuleRuntime().publicTimeHours * HOUR_MS;
}

export function bidKingMarketBidWindowMs(): number {
  return (bidKingMarketRuleRuntime().auctionTimeLimitSeconds[0] ?? 0) * 1000;
}

export function bidKingMarketPriceNoticeLimit(baseValue: number): number {
  const safeBase = Math.max(0, Math.floor(baseValue));
  return Math.floor(safeBase * bidKingMarketRuleRuntime().priceNoticePerMille / 1000);
}

function positiveConstant(id: string): number {
  const value = constantNumber(id);
  if (value <= 0) {
    throw new Error(`BidKing Constant.${id} must be positive`);
  }
  return value;
}

function nonNegativeConstant(id: string): number {
  const value = constantNumber(id);
  if (value < 0) {
    throw new Error(`BidKing Constant.${id} must be non-negative`);
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
