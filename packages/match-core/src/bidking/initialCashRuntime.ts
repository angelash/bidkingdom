import { BidMap, Map as BidKingMap, RankMap } from '@bitkingdom/bidking-compat';
import type { BidKingBidMapRow, BidKingMapRow } from '@bitkingdom/bidking-compat';
import { bidKingPlayableBidMaps } from './bidMapRuntime';
import { constantNumberArray, constantNumberRows } from './constant/constantEngine';

const PREFERRED_DEFAULT_INITIAL_CASH = 1_000_000;
const COIN_ITEM_ID = 1;

export interface BidKingEntryInventoryItem {
  refId: string | number;
  quantity: number;
}

export interface BidKingBidMapEntryCost {
  refId: number;
  quantity: number;
}

export interface BidKingBidMapAccessProfile {
  coins: number;
  inventory?: readonly BidKingEntryInventoryItem[];
  dailyMapEntries?: Record<string, number>;
  auctionStats?: {
    highestWinningItemTotalValue?: number;
  };
}

export interface BidKingBidMapAccessResult {
  bidMap?: BidKingBidMapRow;
  parentMap?: BidKingMapRow;
  canEnter: boolean;
  reasons: string[];
  requiredCoins: number;
  entryCostCoins: number;
  initialCash: number;
  dailyCountLimit: number;
  dailyCountUsed: number;
  nextOpenAt?: number;
  worldProcess?: BidKingWorldProcessStatus;
}

export interface BidKingWorldProcessStatus {
  statusCid: number;
  requiredValue: number;
  requiredPeopleCount: number;
  peopleCounts: number;
  unlocked: boolean;
}

export function bidKingInitialCashChoices(): number[] {
  const choices = constantNumberArray('initial_points_chooses')
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  if (choices.length === 0) {
    throw new Error('BidKing Constant.initial_points_chooses must contain positive values');
  }
  return choices;
}

export function bidKingItemBudgetChoices(): number[] {
  return constantNumberArray('item_budget_chooses')
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
}

export function bidKingDefaultInitialCash(): number {
  const choices = bidKingInitialCashChoices();
  return choices.find((value) => value >= PREFERRED_DEFAULT_INITIAL_CASH)
    ?? choices[choices.length - 1]!;
}

export function bidKingHighestConfiguredMinimumBidForBidMap(bidMapId: number): number {
  const row = requireRankMap(bidMapId);
  return row.min_bid_range.reduce((max, range) => Math.max(max, range[1] ?? range[0] ?? 0), 0);
}

export function bidKingInitialCashForBidMap(bidMapId: number): number {
  const choices = bidKingInitialCashChoices();
  const bidMap = requireBidMap(bidMapId);
  const parentMap = requireParentMapForBidMap(bidMap);
  const target = parentMap?.auction_limit_notify && parentMap.auction_limit_notify > 0
    ? parentMap.auction_limit_notify
    : Math.max(bidKingBidMapRequiredCoins(bidMap.id), bidKingHighestConfiguredMinimumBidForBidMap(bidMap.id));
  return choices.find((value) => value >= target) ?? choices[choices.length - 1]!;
}

export function bidKingInitialCashForProfileCoins(
  _profileCoins: number | undefined,
  bidMapId: number
): number {
  return bidKingInitialCashForBidMap(bidMapId);
}

export function bidKingBidMapRequiredCoins(bidMapId: number): number {
  const bidMap = requireBidMap(bidMapId);
  return maxCoinAmount(bidMap.required_items);
}

export function bidKingBidMapEntryCostCoins(bidMapId: number): number {
  return bidKingBidMapEntryCosts(bidMapId)
    .filter((cost) => cost.refId === COIN_ITEM_ID)
    .reduce((sum, cost) => sum + cost.quantity, 0);
}

export function bidKingBidMapEntryCosts(bidMapId: number): BidKingBidMapEntryCost[] {
  const bidMap = requireBidMap(bidMapId);
  const costs = new Map<number, number>();
  const rows = bidKingIsDefaultUnknownBidMap(bidMap.id)
    ? [bidMap.currency_cost]
    : [bidMap.currency_cost, ...bidMap.item_cost];
  for (const row of bidMapCostRows(rows)) {
    const refId = row[1] ?? 0;
    const quantity = row[2] ?? 0;
    if (refId <= 0 || quantity <= 0) {
      continue;
    }
    costs.set(refId, (costs.get(refId) ?? 0) + quantity);
  }
  return [...costs.entries()].map(([refId, quantity]) => ({ refId, quantity }));
}

export function bidKingIsDefaultUnknownBidMap(bidMapId: number): boolean {
  const bidMap = requireBidMap(bidMapId);
  const defaultBidMap = BidMap
    .filter((candidate) => (
      candidate.parent_map_id === bidMap.parent_map_id
      && candidate.is_visiable === 1
      && candidate.auction_rounds_rate.some((rate) => rate > 0)
    ))
    .sort((left, right) => left.id - right.id)[0];
  return defaultBidMap?.id === bidMap.id;
}

export function bidKingBidMapAccess(
  profile: BidKingBidMapAccessProfile,
  bidMapId: number,
  now = Date.now()
): BidKingBidMapAccessResult {
  const bidMap = requireBidMap(bidMapId);
  const parentMap = requireParentMapForBidMap(bidMap);
  const reasons: string[] = [];
  const requiredCoins = bidKingBidMapRequiredCoins(bidMapId);
  const entryCostCoins = bidKingBidMapEntryCostCoins(bidMapId);
  const initialCash = bidKingInitialCashForBidMap(bidMapId);
  const dailyCountLimit = parentMap?.daily_counts && parentMap.daily_counts > 0 ? parentMap.daily_counts : 0;
  const dailyCountUsed = parentMap ? bidKingMapDailyEntryCount(profile, parentMap.id, now) : 0;
  const nextOpenAt = parentMap ? bidKingMapNextOpenAt(parentMap, now) : undefined;
  const worldProcess = parentMap ? bidKingWorldProcessStatusForProfile(profile, parentMap.world_process) : undefined;

  if (bidMap.is_visiable !== 1) {
    reasons.push('仓型未开放');
  }
  if (parentMap.is_open !== 1) {
    reasons.push('场景未开放');
  }
  if (profile.coins < requiredCoins) {
    reasons.push(`余额门槛 ${formatCompactNumber(requiredCoins)}`);
  }
  if (profile.coins < entryCostCoins) {
    reasons.push(`入场费 ${formatCompactNumber(entryCostCoins)}`);
  }
  if (dailyCountLimit > 0 && dailyCountUsed >= dailyCountLimit) {
    reasons.push(`今日次数 ${dailyCountUsed}/${dailyCountLimit}`);
  }
  if (nextOpenAt && nextOpenAt > now) {
    reasons.push(`开放时间 ${formatDateTime(nextOpenAt)}`);
  }
  if (worldProcess && !worldProcess.unlocked) {
    reasons.push(`世界进度 ${worldProcess.peopleCounts}/${worldProcess.requiredPeopleCount}，目标 ${formatCompactNumber(worldProcess.requiredValue)}`);
  }

  for (const cost of bidKingBidMapEntryCosts(bidMapId)) {
    if (cost.refId === COIN_ITEM_ID) {
      continue;
    }
    if (inventoryQuantity(profile.inventory, cost.refId) < cost.quantity) {
      reasons.push(`缺少凭证 ${cost.refId} x${cost.quantity}`);
    }
  }

  return {
    bidMap,
    parentMap,
    canEnter: reasons.length === 0,
    reasons,
    requiredCoins,
    entryCostCoins,
    initialCash,
    dailyCountLimit,
    dailyCountUsed,
    nextOpenAt,
    worldProcess
  };
}

export function bidKingWorldProcessRows(): BidKingWorldProcessStatus[] {
  return constantNumberRows('world_process')
    .map((row) => ({
      statusCid: Math.max(0, Math.floor(row[0] ?? 0)),
      requiredValue: Math.max(0, Math.floor(row[1] ?? 0)),
      requiredPeopleCount: Math.max(0, Math.floor(row[2] ?? 0)),
      peopleCounts: 0,
      unlocked: false
    }))
    .filter((row) => row.statusCid > 0 && row.requiredPeopleCount > 0);
}

export function bidKingWorldProcessStatusForProfile(
  profile: Pick<BidKingBidMapAccessProfile, 'auctionStats'>,
  statusCid: number
): BidKingWorldProcessStatus | undefined {
  if (statusCid <= 0) {
    return undefined;
  }
  const row = bidKingWorldProcessRows().find((candidate) => candidate.statusCid === statusCid);
  if (!row) {
    return undefined;
  }
  const qualified = (profile.auctionStats?.highestWinningItemTotalValue ?? 0) >= row.requiredValue;
  const peopleCounts = qualified ? row.requiredPeopleCount : 0;
  return {
    ...row,
    peopleCounts,
    unlocked: peopleCounts >= row.requiredPeopleCount
  };
}

export function bidKingBestAvailableBidMapId(
  profile: BidKingBidMapAccessProfile,
  preferredBidMapId?: number
): number | undefined {
  if (preferredBidMapId && bidKingBidMapAccess(profile, preferredBidMapId).canEnter) {
    return preferredBidMapId;
  }
  return bidKingPlayableBidMaps()
    .map((row) => ({ row, access: bidKingBidMapAccess(profile, row.id) }))
    .filter((entry) => entry.access.canEnter)
    .sort((left, right) => (
      right.access.requiredCoins - left.access.requiredCoins
      || right.access.initialCash - left.access.initialCash
      || left.row.id - right.row.id
    ))[0]?.row.id;
}

function requireBidMap(bidMapId: number): BidKingBidMapRow {
  const bidMap = BidMap.find((candidate) => candidate.id === bidMapId);
  if (!bidMap) {
    throw new Error(`Unknown BidMap ${bidMapId}`);
  }
  return bidMap;
}

function requireParentMapForBidMap(bidMap: BidKingBidMapRow): BidKingMapRow {
  const parentMap = BidKingMap.find((candidate) => candidate.id === bidMap.parent_map_id);
  if (!parentMap) {
    throw new Error(`Missing Map ${bidMap.parent_map_id} for BidMap ${bidMap.id}`);
  }
  return parentMap;
}

function requireRankMap(bidMapId: number) {
  const row = RankMap.find((candidate) => candidate.id === bidMapId);
  if (!row) {
    throw new Error(`Missing RankMap ${bidMapId}`);
  }
  return row;
}

export function bidKingDailyMapEntryKey(mapId: number, now = Date.now()): string {
  return `${localDateKey(now)}:${mapId}`;
}

export function bidKingMapDailyEntryCount(profile: Pick<BidKingBidMapAccessProfile, 'dailyMapEntries'>, mapId: number, now = Date.now()): number {
  return Math.max(0, Math.floor(profile.dailyMapEntries?.[bidKingDailyMapEntryKey(mapId, now)] ?? 0));
}

export function bidKingMapNextOpenAt(map: BidKingMapRow, now = Date.now()): number | undefined {
  const windows = map.open_time.filter((row) => row.length >= 5 && (row[0] ?? 0) > 0);
  if (windows.length === 0) {
    return undefined;
  }
  const current = new Date(now);
  const currentSeconds = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
  const currentWeekday = jsWeekdayToBidKingWeekday(current.getDay());
  for (const window of windows) {
    const [weekday = 0, startHour = 0, startMinute = 0, endHour = 0, endMinute = 0] = window;
    if (weekday !== currentWeekday) {
      continue;
    }
    const startSeconds = startHour * 3600 + startMinute * 60;
    const endSeconds = endHour * 3600 + endMinute * 60;
    if (currentSeconds >= startSeconds && currentSeconds <= endSeconds) {
      return undefined;
    }
  }
  return nextOpenWindowStart(windows, current);
}

function bidMapCostRows(rows: readonly (readonly number[])[] | undefined): readonly (readonly number[])[] {
  return rows?.filter((row) => row.length > 0 && (row[0] ?? 0) > 0) ?? [];
}

function maxCoinAmount(rows: readonly (readonly number[])[]): number {
  return rows.reduce((max, row) => {
    const refId = row[1];
    const amount = row[2] ?? 0;
    return refId === COIN_ITEM_ID && amount > max ? amount : max;
  }, 0);
}

function inventoryQuantity(inventory: readonly BidKingEntryInventoryItem[] | undefined, refId: number): number {
  return inventory
    ?.filter((entry) => sourceInventoryItemId(entry.refId) === String(refId))
    .reduce((sum, entry) => sum + Math.max(0, entry.quantity), 0)
    ?? 0;
}

function sourceInventoryItemId(value: number | string): string {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return compatMatch?.[1] ?? raw;
}

function formatCompactNumber(value: number): string {
  if (value >= 10_000) {
    return `${Math.round(value / 10_000)}万`;
  }
  return String(value);
}

function localDateKey(now: number): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function jsWeekdayToBidKingWeekday(day: number): number {
  return day === 0 ? 7 : day;
}

function nextOpenWindowStart(windows: readonly (readonly number[])[], current: Date): number | undefined {
  let best: number | undefined;
  const currentWeekday = jsWeekdayToBidKingWeekday(current.getDay());
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidateWeekday = ((currentWeekday + dayOffset - 1) % 7) + 1;
    for (const window of windows) {
      const [weekday = 0, startHour = 0, startMinute = 0] = window;
      if (weekday !== candidateWeekday) {
        continue;
      }
      const candidate = new Date(current);
      candidate.setDate(current.getDate() + dayOffset);
      candidate.setHours(startHour, startMinute, 0, 0);
      const time = candidate.getTime();
      if (time > current.getTime() && (best === undefined || time < best)) {
        best = time;
      }
    }
  }
  return best;
}

function formatDateTime(value: number): string {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}
