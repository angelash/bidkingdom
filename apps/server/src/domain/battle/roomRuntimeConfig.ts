import { bidKingDefaultAuctionDurationMs } from '@bitkingdom/match-core';

export const BOT_ROLE_SEQUENCE = ['rumormonger', 'psychologist', 'insurer', 'smuggler'] as const;

export const CORE_WAREHOUSE_SELECTED_MS = 1900;
export const CORE_AUCTIONEER_REVEAL_MS = 4200;
export const CORE_ROUND_INTEL_MS = 3200;
export const CORE_AUCTION_MS = bidKingDefaultAuctionDurationMs(60_000);
