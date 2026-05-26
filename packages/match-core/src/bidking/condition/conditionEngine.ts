import { Access, Condition, bidKingConditionDisplayLabel, bidKingRawTableDisplayName } from '@bitkingdom/bidking-compat';
import type { BidKingConditionRow } from '@bitkingdom/bidking-compat';

export interface ConditionContext {
  completedMatches: number;
  level: number;
  collectionLevel?: number;
  now?: number;
  selectedItemId?: number;
  selectedHeroId?: number;
  selectedMapId?: number;
  selectedBidMapId?: number;
  usedItemIds?: readonly number[];
  usedItemCount?: number;
  dailyUsedItemCount?: number;
  usedItemCountsById?: Readonly<Record<string, number>>;
  auctionAcquiredItemIds?: readonly number[];
  shopAcquiredItemIds?: readonly number[];
  inventory?: Readonly<Record<string, number>>;
  completedTaskCount?: number;
  tradeBoughtCount?: number;
  tradeSoldCount?: number;
  successfulAuctionCount?: number;
  failedAuctionCount?: number;
  highestAuctionBidAmount?: number;
  highestSingleAuctionProfit?: number;
  currentTotalAssets?: number;
  totalAuctionProfit?: number;
  dailyAuctionProfit?: number;
  highestAuctionItemValue?: number;
  highestAuctionItemTotalValue?: number;
  lowestAuctionItemTotalValue?: number;
  completedMapIds?: readonly number[];
  completedBidMapIds?: readonly number[];
  successfulAuctionCountByMap?: Readonly<Record<string, number>>;
  lowestAuctionItemTotalValueByMap?: Readonly<Record<string, number>>;
  lowestAuctionItemTotalValueByBidMap?: Readonly<Record<string, number>>;
}

const SUPPORTED_CONDITION_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25]);
const UNMAPPED_CONDITION_TYPES = new Set<number>();

export interface AccessCheckResult {
  ok: boolean;
  accessId?: string;
  label: string;
  reason?: string;
  requirementType?: number;
  requirementValue?: number;
}

export interface ConditionCheckResult {
  ok: boolean;
  conditionId?: number;
  conditionType?: number;
  currentValue: number;
  requiredValue: number;
  label: string;
  reason?: string;
}

export function evaluateBidKingCondition(
  conditionOrId: BidKingConditionRow | number,
  context: ConditionContext
): ConditionCheckResult {
  const row = typeof conditionOrId === 'number'
    ? Condition.find((candidate) => candidate.id === conditionOrId)
    : conditionOrId;
  if (!row) {
    throw new Error(`BidKing Condition ${conditionOrId} is missing from source table`);
  }

  const prerequisiteResult = evaluatePrerequisites(row, context);
  if (prerequisiteResult && !prerequisiteResult.ok) {
    return {
      ...prerequisiteResult,
      conditionId: row.id,
      conditionType: row.condition,
      label: bidKingConditionDisplayLabel(row)
    };
  }

  const currentValue = currentValueForCondition(row, context);
  if (currentValue === undefined) {
    throw new Error(`BidKing Condition ${row.id} has unmapped condition type ${row.condition}`);
  }

  const requiredValue = row.maxvalue > 0 ? row.maxvalue : 1;
  const ok = currentValue >= requiredValue;
  return {
    ok,
    conditionId: row.id,
    conditionType: row.condition,
    currentValue,
    requiredValue,
    label: bidKingConditionDisplayLabel(row),
    reason: ok ? undefined : `需要 ${requiredValue}，当前 ${currentValue}`
  };
}

export function bidKingConditionTypeCoverage(): {
  tableTypes: number[];
  supportedTypes: number[];
  unmappedTypes: number[];
  unexpectedTypes: number[];
} {
  const tableTypes = uniqueSorted(Condition.map((row) => row.condition));
  const supportedTypes = uniqueSorted(tableTypes.filter((type) => SUPPORTED_CONDITION_TYPES.has(type)));
  const unmappedTypes = uniqueSorted(tableTypes.filter((type) => UNMAPPED_CONDITION_TYPES.has(type)));
  const unexpectedTypes = uniqueSorted(tableTypes.filter((type) => (
    !SUPPORTED_CONDITION_TYPES.has(type) &&
    !UNMAPPED_CONDITION_TYPES.has(type)
  )));
  return {
    tableTypes,
    supportedTypes,
    unmappedTypes,
    unexpectedTypes
  };
}

export function checkBidKingAccess(
  context: ConditionContext,
  accessId?: string | number
): AccessCheckResult {
  if (accessId === undefined || accessId === '' || Number(accessId) === 0) {
    return { ok: true, label: '默认开放' };
  }

  const row = Access.find((candidate) => candidate.id === String(accessId));
  if (!row) {
    throw new Error(`BidKing Access ${accessId} is missing from source table`);
  }

  const requirementType = Number(row.columns[3] ?? 0);
  const requirementValue = Number(row.columns[4] ?? 0);
  const label = bidKingRawTableDisplayName(row);

  if (requirementType === 0) {
    return { ok: true, accessId: row.id, label, requirementType, requirementValue };
  }
  if (requirementType === 1) {
    const ok = context.completedMatches >= requirementValue;
    return {
      ok,
      accessId: row.id,
      label,
      requirementType,
      requirementValue,
      reason: ok ? undefined : `需要完成 ${requirementValue} 局拍场`
    };
  }
  if (requirementType === 2) {
    const ok = context.level >= requirementValue;
    return {
      ok,
      accessId: row.id,
      label,
      requirementType,
      requirementValue,
      reason: ok ? undefined : `需要掌柜等级 ${requirementValue}`
    };
  }

  throw new Error(`BidKing Access ${row.id} has unmapped requirement type ${requirementType}`);
}

function currentValueForCondition(row: BidKingConditionRow, context: ConditionContext): number | undefined {
  const target = conditionTarget(row);
  switch (row.condition) {
    case 1:
      return 1;
    case 2:
      return target === 0 || context.selectedItemId === target ? 1 : 0;
    case 3:
      return target === 0 || context.selectedHeroId === target ? 1 : 0;
    case 4:
      return target === 0 || context.selectedMapId === target || context.completedMapIds?.includes(target ?? 0) ? 1 : 0;
    case 5:
      return target === 0 || context.selectedBidMapId === target || context.completedBidMapIds?.includes(target ?? 0) ? 1 : 0;
    case 6:
      return usedItemCountForCondition(row, context);
    case 7:
      return countMatching(context.auctionAcquiredItemIds, acquiredItemTarget(row));
    case 8:
      return countMatching(context.shopAcquiredItemIds, acquiredItemTarget(row));
    case 9:
      return context.tradeBoughtCount ?? 0;
    case 10:
      return context.tradeSoldCount ?? 0;
    case 11:
    case 12:
      return inventoryQuantity(context.inventory, target);
    case 13:
      return context.completedTaskCount ?? 0;
    case 14:
      return thresholdSatisfied(context.highestAuctionBidAmount ?? 0, firstPositiveParam(row));
    case 15:
    case 20:
      return context.completedMatches;
    case 21:
      return context.collectionLevel ?? context.level;
    case 22:
      return timeIntervalCondition(row, context);
    case 16:
      return successfulAuctionCountForCondition(row, context);
    case 17:
      return context.failedAuctionCount ?? 0;
    case 18:
      return thresholdSatisfied(context.highestSingleAuctionProfit ?? 0, firstPositiveParam(row));
    case 19:
      return auctionValueCondition(row, context);
    case 24:
      return auctionProfitForCondition(row, context);
    case 25:
      return totalAssetsBelowThreshold(row, context);
    default:
      return undefined;
  }
}

function conditionTarget(row: BidKingConditionRow): number | undefined {
  if (row.condition === 11 || row.condition === 12) {
    return row.conditionparams.find((value) => value > 0) ?? row.conditionparams[0];
  }
  return row.conditionparams[0];
}

function acquiredItemTarget(row: BidKingConditionRow): number | undefined {
  return row.conditionparams.find((value) => value >= 100000);
}

function auctionValueCondition(row: BidKingConditionRow, context: ConditionContext): number {
  const [minimumItemValue = 0, maximumTotalValue = 0] = row.conditionparams;
  if (minimumItemValue > 0) {
    return (context.highestAuctionItemValue ?? 0) >= minimumItemValue ? 1 : 0;
  }
  if (maximumTotalValue > 0) {
    const mapId = mapPrerequisiteTarget(row);
    const bidMapId = bidMapPrerequisiteTarget(row);
    const totalValue = mapId !== undefined
      ? context.lowestAuctionItemTotalValueByMap?.[String(mapId)]
      : bidMapId !== undefined
        ? context.lowestAuctionItemTotalValueByBidMap?.[String(bidMapId)]
      : context.lowestAuctionItemTotalValue;
    return totalValue !== undefined && totalValue > 0 && totalValue < maximumTotalValue ? 1 : 0;
  }
  return (context.successfulAuctionCount ?? 0) > 0 ? 1 : 0;
}

function usedItemCountForCondition(row: BidKingConditionRow, context: ConditionContext): number {
  const itemId = row.conditionparams.find((value) => value >= 100000);
  if (itemId) {
    return context.usedItemCountsById?.[String(itemId)] ?? countMatching(context.usedItemIds, itemId);
  }
  if (row.id === 30003 || row.desc === 'condition_desc_30003') {
    return context.dailyUsedItemCount ?? context.usedItemCount ?? countMatching(context.usedItemIds);
  }
  return context.usedItemCount ?? countMatching(context.usedItemIds);
}

function thresholdSatisfied(currentValue: number, threshold: number): number {
  return currentValue >= threshold ? 1 : 0;
}

function firstPositiveParam(row: BidKingConditionRow): number {
  return row.conditionparams.find((value) => value > 0) ?? row.maxvalue ?? 1;
}

function auctionProfitForCondition(row: BidKingConditionRow, context: ConditionContext): number {
  if (row.id === 30002 || row.desc === 'condition_desc_30002') {
    return context.dailyAuctionProfit ?? context.totalAuctionProfit ?? 0;
  }
  return context.totalAuctionProfit ?? context.dailyAuctionProfit ?? 0;
}

function successfulAuctionCountForCondition(row: BidKingConditionRow, context: ConditionContext): number {
  const mapId = mapPrerequisiteTarget(row);
  if (mapId !== undefined) {
    return context.successfulAuctionCountByMap?.[String(mapId)] ?? 0;
  }
  return context.successfulAuctionCount ?? 0;
}

function totalAssetsBelowThreshold(row: BidKingConditionRow, context: ConditionContext): number {
  const threshold = row.conditionparams.find((value) => value > 0 && value !== row.conditionparams[0]) ?? row.conditionparams.find((value) => value > 0);
  if (!threshold) {
    return context.currentTotalAssets ?? 0;
  }
  return (context.currentTotalAssets ?? 0) < threshold ? 1 : 0;
}

function timeIntervalCondition(row: BidKingConditionRow, context: ConditionContext): number {
  const [rawStart = 0, rawEnd = 0] = row.conditionparams;
  if (rawStart <= 0 && rawEnd <= 0) {
    return 1;
  }
  const start = normalizeDaySecond(rawStart);
  const end = normalizeDaySecond(rawEnd);
  const current = shanghaiSecondOfDay(context.now ?? Date.now());
  const inRange = start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
  return inRange ? 1 : 0;
}

function normalizeDaySecond(value: number): number {
  return value <= 24 ? value * 60 * 60 : value;
}

function shanghaiSecondOfDay(now: number): number {
  const date = new Date(now + 8 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 * 60 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
}

function mapPrerequisiteTarget(row: BidKingConditionRow): number | undefined {
  const index = row.preorconditions.findIndex((conditionType) => conditionType === 4);
  return index >= 0 ? row.preorconditionsparam[index]?.find((value) => value > 0) : undefined;
}

function bidMapPrerequisiteTarget(row: BidKingConditionRow): number | undefined {
  const index = row.preorconditions.findIndex((conditionType) => conditionType === 5);
  return index >= 0 ? row.preorconditionsparam[index]?.find((value) => value > 0) : undefined;
}

function evaluatePrerequisites(
  row: BidKingConditionRow,
  context: ConditionContext
): ConditionCheckResult | undefined {
  const andResult = evaluateConditionGroup(row.preconditions, row.preconditionsparam, context, true);
  if (andResult && !andResult.ok) {
    return andResult;
  }
  const orResult = evaluateConditionGroup(row.preorconditions, row.preorconditionsparam, context, false);
  if (orResult && !orResult.ok) {
    return orResult;
  }
  return undefined;
}

function evaluateConditionGroup(
  conditionTypes: readonly number[] | undefined,
  params: readonly (readonly number[])[] | undefined,
  context: ConditionContext,
  requireAll: boolean
): ConditionCheckResult | undefined {
  const types = (conditionTypes ?? []).filter((type) => type > 0);
  if (types.length === 0) {
    return undefined;
  }
  const results = types.map((conditionType, index) => {
    const syntheticRow: BidKingConditionRow = {
      id: 0,
      type: 0,
      preorconditions: [],
      preorconditionsparam: [],
      preconditions: [],
      preconditionsparam: [],
      condition: conditionType,
      conditionparams: [...(params?.[index] ?? [])],
      divided: 1,
      maxvalue: 1,
      desc: `precondition_${conditionType}`,
      packaged_desc: `前置门槛 ${conditionType}`
    };
    return evaluateBidKingCondition(syntheticRow, context);
  });
  if (requireAll) {
    const failed = results.find((result) => !result.ok);
    return failed ? { ...failed, reason: failed.reason ?? '前置条件未满足' } : undefined;
  }
  return results.some((result) => result.ok) ? undefined : {
    ...results[0]!,
    ok: false,
    reason: '任一前置条件未满足'
  };
}

function countMatching(values: readonly number[] | undefined, target?: number): number {
  if (!values) {
    return 0;
  }
  if (!target) {
    return values.length;
  }
  return values.filter((value) => value === target).length;
}

function inventoryQuantity(inventory: Readonly<Record<string, number>> | undefined, target?: number): number {
  if (!inventory) {
    return 0;
  }
  if (!target) {
    return Object.values(inventory).reduce((sum, value) => sum + value, 0);
  }
  return inventory[String(target)] ?? 0;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}
