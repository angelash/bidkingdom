import { BIDKING_AUCTION_ROUNDS_RATE } from './schema';

export function getBidKingCloseRate(roundIndex: number): number {
  return BIDKING_AUCTION_ROUNDS_RATE[Math.min(Math.max(0, roundIndex), BIDKING_AUCTION_ROUNDS_RATE.length - 1)]!;
}

export function getBidKingCloseThreshold(roundIndex: number): number {
  const rate = getBidKingCloseRate(roundIndex);
  return rate <= 0 ? 0 : rate / 1000 - 1;
}
