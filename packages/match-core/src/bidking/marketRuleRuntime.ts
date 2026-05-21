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
    listingFeeRatePerMille: nonNegativeConstant('item_fee_rate', 0),
    auctionTaxRatePerMille: nonNegativeConstant('item_bid_fax', 0),
    auctionStorageFeeRatePerMille: nonNegativeConstant('item_bid_fee', 0),
    bidIncrementRatePerTenThousand: nonNegativeConstant('item_bid_price_add', 0),
    listingCostRatePerTenThousand24h: nonNegativeConstant('item_bid_cost', 0),
    listingDurationHours: positiveArray('item_bid_time'),
    publicTimeHours: nonNegativeConstant('item_bid_public_time', 0),
    slotBase: positiveConstant('item_bid_slot_base', 5),
    slotMax: positiveConstant('item_bid_slot_max', 10),
    auctionTimeLimitSeconds: positiveArray('auction_time_limit'),
    auctionSlotPrices: positiveArray('auction_slot_price'),
    auctionCounts: positiveConstant('auction_counts', 100),
    priceNoticePerMille: positiveConstant('auction_price_notice', 2500)
  };
}

export function bidKingMarketOrderDurationHours(orderType: BidKingMarketOrderType, fallback = 24): number {
  const durations = bidKingMarketRuleRuntime().listingDurationHours;
  const index = orderType === 'auction' ? 1 : 0;
  return durations[index] ?? durations[0] ?? fallback;
}

export function bidKingMarketOrderDurationMs(orderType: BidKingMarketOrderType, fallbackMs = 24 * HOUR_MS): number {
  return bidKingMarketOrderDurationHours(orderType, Math.max(1, Math.round(fallbackMs / HOUR_MS))) * HOUR_MS;
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

function positiveConstant(id: string, fallback: number): number {
  const value = constantNumber(id, fallback);
  return value > 0 ? value : fallback;
}

function nonNegativeConstant(id: string, fallback: number): number {
  const value = constantNumber(id, fallback);
  return value >= 0 ? value : fallback;
}

function positiveArray(id: string): number[] {
  return constantNumberArray(id).filter((value) => value > 0);
}
