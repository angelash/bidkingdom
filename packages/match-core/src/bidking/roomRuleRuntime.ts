import { constantNumber, constantNumberArray, constantNumberRows } from './constant/constantEngine';

export interface BidKingReliefFundRuntime {
  times: number;
  limit: number;
  rewardRows: number[][];
}

export function bidKingBidGameCountChoices(): number[] {
  return positiveSortedChoices('bid_game_count_chooses');
}

export function bidKingDefaultBidGameCount(): number {
  return requireFirstChoice('bid_game_count_chooses', bidKingBidGameCountChoices());
}

export function bidKingRoundTimeChoicesSeconds(): number[] {
  return positiveSortedChoices('round_time_chooses');
}

export function bidKingDefaultRoundTimeSeconds(): number {
  const choices = bidKingRoundTimeChoicesSeconds();
  return requireFirstChoice('round_time_chooses', choices);
}

export function bidKingDefaultAuctionDurationMs(): number {
  return bidKingDefaultRoundTimeSeconds() * 1000;
}

export function bidKingRoomPlayerCountChoices(): number[] {
  return positiveSortedChoices('room_playernum_chooses');
}

export function bidKingDefaultRoomPlayerCount(): number {
  const choices = bidKingRoomPlayerCountChoices();
  const choice = choices[choices.length - 1];
  if (choice === undefined) {
    throw new Error('Missing positive BidKing Constant.room_playernum_chooses');
  }
  return choice;
}

export function bidKingMaxBotCount(): number {
  return Math.max(0, bidKingDefaultRoomPlayerCount() - 1);
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

export function bidKingInitialWarehouseCapacity(): number {
  return positiveConstant('initial_warehouse_capacity');
}

export function bidKingEntrustSlotBase(): number {
  return positiveConstant('entrust_slot_base');
}

export function bidKingReliefFundRuntime(): BidKingReliefFundRuntime {
  return {
    times: nonNegativeConstant('relief_fund_times'),
    limit: nonNegativeConstant('relief_fund_limit'),
    rewardRows: constantNumberRows('relief_fund_amount')
  };
}

function positiveSortedChoices(id: string): number[] {
  return constantNumberArray(id)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
}

function requireFirstChoice(id: string, choices: readonly number[]): number {
  const choice = choices[0];
  if (choice === undefined) {
    throw new Error(`Missing positive BidKing Constant.${id}`);
  }
  return choice;
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
