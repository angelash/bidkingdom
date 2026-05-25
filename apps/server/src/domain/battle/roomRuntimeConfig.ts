import { bidKingDefaultAuctionDurationMs } from '@bitkingdom/match-core';

export const BOT_ROLE_SEQUENCE = ['table_strategist', 'psychologist', 'insurer', 'smuggler'] as const;

export const CORE_ROUND_INTEL_MS = 3200;
export const CORE_AUCTION_MS = bidKingDefaultAuctionDurationMs(60_000);
