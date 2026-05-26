import { bidKingStarterCoins } from '@bitkingdom/match-core';

export const DEFAULT_PROFILE_COINS = bidKingStarterCoins();
export const DEFAULT_PROFILE_RANK_POINTS = 0;
export const MAX_RECENT_PROFILE_TRANSACTIONS = 80;

export const PROFILE_TASK_IDS = [
  'daily_complete_match',
  'daily_use_skill',
  'daily_light_codex',
  'ach_first_profit',
  'ach_rare_collector',
  'ach_legendary_find'
] as const;
