import { constantNumber, constantNumberArray, constantNumberRows } from './constant/constantEngine';

export interface BidKingReliefFundRuntime {
  times: number;
  limit: number;
  rewardRows: number[][];
}

export function bidKingBidGameCountChoices(): number[] {
  return positiveSortedChoices('bid_game_count_chooses');
}

export function bidKingDefaultBidGameCount(fallback = 5): number {
  return bidKingBidGameCountChoices()[0] ?? fallback;
}

export function bidKingRoundTimeChoicesSeconds(): number[] {
  return positiveSortedChoices('round_time_chooses');
}

export function bidKingDefaultRoundTimeSeconds(fallback = 60): number {
  const choices = bidKingRoundTimeChoicesSeconds();
  return choices.find((choice) => choice >= fallback) ?? choices[Math.floor(choices.length / 2)] ?? fallback;
}

export function bidKingDefaultAuctionDurationMs(fallbackMs = 60_000): number {
  return bidKingDefaultRoundTimeSeconds(Math.max(1, Math.round(fallbackMs / 1000))) * 1000;
}

export function bidKingRoomPlayerCountChoices(): number[] {
  return positiveSortedChoices('room_playernum_chooses');
}

export function bidKingDefaultRoomPlayerCount(fallback = 4): number {
  const choices = bidKingRoomPlayerCountChoices();
  return choices[choices.length - 1] ?? fallback;
}

export function bidKingMaxBotCount(fallback = 3): number {
  return Math.max(0, bidKingDefaultRoomPlayerCount(fallback + 1) - 1);
}

export function bidKingRoomModeChoices(): number[] {
  return positiveSortedChoices('room_mode_chooses');
}

export function bidKingBidRateChoices(): number[] {
  return constantNumberArray('bid_rate_chooses')
    .filter((value) => value >= 0)
    .sort((left, right) => right - left);
}

export function bidKingHeroChoiceIds(): number[] {
  return positiveSortedChoices('heros_chooses');
}

export function bidKingBattleItemChoiceIds(): number[] {
  return positiveSortedChoices('items_chooses');
}

export function bidKingInitialWarehouseCapacity(fallback = 50): number {
  const capacity = constantNumber('initial_warehouse_capacity', fallback);
  return capacity > 0 ? capacity : fallback;
}

export function bidKingEntrustSlotBase(fallback = 3): number {
  const slotBase = constantNumber('entrust_slot_base', fallback);
  return slotBase > 0 ? slotBase : fallback;
}

export function bidKingReliefFundRuntime(): BidKingReliefFundRuntime {
  return {
    times: constantNumber('relief_fund_times', 0),
    limit: constantNumber('relief_fund_limit', 0),
    rewardRows: constantNumberRows('relief_fund_amount')
  };
}

function positiveSortedChoices(id: string): number[] {
  return constantNumberArray(id)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
}
