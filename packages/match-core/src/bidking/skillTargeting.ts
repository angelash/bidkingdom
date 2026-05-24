import {
  itemById,
  skillById,
  skillEffectById,
  type BidKingItemRow,
  type BidKingSkillRow
} from '@bitkingdom/bidking-compat';
import type { BidKingBoxInfoDataSnapshot, SkillFeedEntry } from '@bitkingdom/shared';
import type { MatchRuntimeState, RuntimeRound, WarehouseSlot } from '../types';
import { bidKingSkillEffectKnowledge } from './skillEffectRuntime';
import { bidKingSourceBoxInfoForSlot } from './gameDataRuntime';

const ALL_ITEM_TYPES = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110] as const;
const ALL_QUALITIES = [1, 2, 3, 4, 5, 6] as const;

export interface BidKingKnownInfoState {
  shapeKnown: boolean;
  rankKnown: boolean;
  allKnown: boolean;
}

export interface BidKingSkillTargetingOptions {
  knownInfoByItemId?: ReadonlyMap<string, BidKingKnownInfoState>;
  targetBoxId?: number;
  targetBoxIds?: readonly number[];
}

export function bidKingSourceTargetCount(skill: BidKingSkillRow | undefined): number {
  if (!skill) {
    return 1;
  }
  return skill.skill_count === 0 ? 999 : Math.max(1, Math.floor(skill.skill_count));
}

export function selectBidKingSlotsBySkill(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  skill: BidKingSkillRow,
  options: BidKingSkillTargetingOptions = {}
): WarehouseSlot[] {
  const targetCount = bidKingSourceTargetCount(skill);
  const sourceSlots = [...slots];
  let filtered = applyBidKingTarget(sourceSlots, state, skill.skilltarget, skill.skilltargetvalue, targetCount, sourceSlots, false, options);
  filtered = applyBidKingTarget(filtered, state, skill.skilltarget2, skill.skilltargetvalue2, targetCount, sourceSlots, true, options);
  filtered = applyBidKingTarget(filtered, state, skill.skilltarget3, skill.skilltargetvalue3, targetCount, sourceSlots, true, options);
  if (filtered.length === 0 && !usesRequiredContextTarget(skill)) {
    filtered = shuffleBidKingSlots(sourceSlots, state);
  }
  const limit = targetCount === 999 ? filtered.length : targetCount;
  return filtered.slice(0, Math.max(1, limit));
}

export function bidKingKnowledgeByItemIdFromSkillFeed(
  slots: readonly WarehouseSlot[],
  skillFeed: readonly SkillFeedEntry[],
  playerId?: string
): Map<string, BidKingKnownInfoState> {
  const known = new Map<string, BidKingKnownInfoState>();
  const visibleFeed = skillFeed.filter((entry) => entry.visibility === 'public' || entry.playerId === playerId);
  for (const entry of visibleFeed) {
    for (const slot of slots) {
      const hitBox = sourceHitBoxForSlot(entry, slot);
      const targetMatched = entry.targetItemIds?.includes(slot.item.id) ?? false;
      if (!hitBox && !targetMatched) {
        continue;
      }
      applySourceKnowledge(knownStateForItem(known, slot.item.id), entry, hitBox);
    }
  }
  return known;
}

export function bidKingSourceEffectCategoriesForFeedEntry(
  entry: Pick<SkillFeedEntry, 'effectCategory' | 'skillCid'>
): Set<number> {
  const categories = new Set<number>();
  const skill = typeof entry.skillCid === 'number' ? skillById(entry.skillCid) : undefined;
  for (const effectId of skill?.skilleffect_position ?? []) {
    const category = skillEffectById(effectId)?.Category;
    if (typeof category === 'number' && category > 0) {
      categories.add(category);
    }
  }
  if (categories.size === 0 && typeof entry.effectCategory === 'number' && entry.effectCategory > 0) {
    categories.add(entry.effectCategory);
  }
  return categories;
}

export function bidKingSourceHitBoxList(
  round: RuntimeRound,
  slots: readonly WarehouseSlot[],
  skill: BidKingSkillRow
): BidKingBoxInfoDataSnapshot[] {
  const categories = skill.skilleffect_position
    .map((effectId) => skillEffectById(effectId)?.Category)
    .filter((category): category is number => typeof category === 'number' && category > 0);
  const effectiveCategories = categories.length > 0 ? categories : [1];
  return slots.map((slot) => mergeSourceBoxInfo(
    effectiveCategories.map((category) => bidKingSourceBoxInfoForSlot(slot, round.id, category))
  ));
}

export function bidKingItemRowForSlot(slot: WarehouseSlot): BidKingItemRow | undefined {
  const itemId = bidKingNumericItemIdForSlot(slot);
  return itemId ? itemById(itemId) : undefined;
}

function applyBidKingTarget(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  targetType: number,
  values: readonly number[],
  targetCount: number,
  allSlots: readonly WarehouseSlot[],
  secondary: boolean,
  options: BidKingSkillTargetingOptions
): WarehouseSlot[] {
  if (targetType === 0) {
    return secondary ? [...slots] : shuffleBidKingSlots(slots, state);
  }
  if (targetType === 1) {
    return filterByItemType(slots, values);
  }
  if (targetType === 2) {
    return slots.filter((slot) => values.includes(bidKingItemRowForSlot(slot)?.item_quality ?? -1));
  }
  if (targetType === 3) {
    return slots.filter((slot) => values.includes(bidKingNumericItemIdForSlot(slot) ?? -1));
  }
  if (targetType === 4) {
    const typeIds = weightedTargetValues(values, state, ALL_ITEM_TYPES);
    return filterByItemType(slots, typeIds);
  }
  if (targetType === 5) {
    const qualities = weightedTargetValues(values, state, ALL_QUALITIES);
    return slots.filter((slot) => qualities.includes(bidKingItemRowForSlot(slot)?.item_quality ?? -1));
  }
  if (targetType === 6) {
    return sortSlotsBySourceFilter(slots, state, values, targetCount, allSlots, options);
  }
  if (targetType === 7) {
    return filterSlotsByArea(slots, values);
  }
  if (targetType === 8) {
    return filterSlotsByTargetBox(slots, options);
  }
  if (targetType === 10) {
    return filterSlotsByKnowledgeState(slots, values, options);
  }
  return secondary ? [...slots] : shuffleBidKingSlots(slots, state);
}

function filterByItemType(slots: readonly WarehouseSlot[], values: readonly number[]): WarehouseSlot[] {
  return slots.filter((slot) => {
    const row = bidKingItemRowForSlot(slot);
    return row ? values.includes(row.item_type_id) : false;
  });
}

function sortSlotsBySourceFilter(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  values: readonly number[],
  targetCount: number,
  allSlots: readonly WarehouseSlot[],
  options: BidKingSkillTargetingOptions
): WarehouseSlot[] {
  const sort = parseSortTargetValues(values);
  const prefiltered = sort.prefilterTarget === 0
    ? [...slots]
    : applyBidKingTarget(slots, state, sort.prefilterTarget, sort.prefilterValues, 999, allSlots, true, options);
  const candidates = prefiltered.length > 0 ? prefiltered : [...slots];
  const sorted = [...candidates].sort((left, right) => {
    const leftValue = filterValueForSlot(left, allSlots, sort.filterType);
    const rightValue = filterValueForSlot(right, allSlots, sort.filterType);
    if (leftValue !== rightValue) {
      return sort.isMax ? rightValue - leftValue : leftValue - rightValue;
    }
    const leftItemId = bidKingItemRowForSlot(left)?.id ?? 0;
    const rightItemId = bidKingItemRowForSlot(right)?.id ?? 0;
    if (leftItemId !== rightItemId) {
      return sort.isMax ? rightItemId - leftItemId : leftItemId - rightItemId;
    }
    return sourceItemUidOrder(left) - sourceItemUidOrder(right);
  });
  if (targetCount === 999 && sorted[0]) {
    const best = filterValueForSlot(sorted[0], allSlots, sort.filterType);
    return sorted.filter((slot) => filterValueForSlot(slot, allSlots, sort.filterType) === best);
  }
  return sorted;
}

function parseSortTargetValues(values: readonly number[]): {
  prefilterTarget: number;
  prefilterValues: readonly number[];
  filterType: number;
  isMax: boolean;
} {
  if (values.length >= 4) {
    const prefilterTarget = Math.max(0, Math.floor(values[0] ?? 0));
    const prefilterValue = Math.max(0, Math.floor(values[1] ?? 0));
    return {
      prefilterTarget,
      prefilterValues: prefilterValue > 0 ? [prefilterValue] : [0],
      filterType: Math.max(0, Math.floor(values[2] ?? 3)),
      isMax: (values[3] ?? 1) === 1
    };
  }
  return {
    prefilterTarget: 0,
    prefilterValues: [0],
    filterType: Math.max(0, Math.floor(values[0] ?? 3)),
    isMax: (values[1] ?? 1) === 1
  };
}

function filterSlotsByArea(slots: readonly WarehouseSlot[], values: readonly number[]): WarehouseSlot[] {
  const allowed = new Set(values.filter((value) => value > 0));
  if (allowed.size === 0) {
    return [...slots];
  }
  return slots.filter((slot) => allowed.has(slot.item.footprint.w * slot.item.footprint.h));
}

function filterSlotsByTargetBox(
  slots: readonly WarehouseSlot[],
  options: BidKingSkillTargetingOptions
): WarehouseSlot[] {
  const targetBoxIds = new Set([
    ...(options.targetBoxId === undefined ? [] : [options.targetBoxId]),
    ...(options.targetBoxIds ?? [])
  ].map((boxId) => Math.max(0, Math.floor(boxId))));
  if (targetBoxIds.size === 0) {
    return [];
  }
  return slots.filter((slot) => targetBoxIds.has(slot.y * 10 + slot.x));
}

function filterSlotsByKnowledgeState(
  slots: readonly WarehouseSlot[],
  values: readonly number[],
  options: BidKingSkillTargetingOptions
): WarehouseSlot[] {
  const shapeCondition = normalizeKnownCondition(values[0] ?? 0);
  const rankCondition = normalizeKnownCondition(values[1] ?? 0);
  const allCondition = normalizeKnownCondition(values[2] ?? 0);
  return slots.filter((slot) => {
    const known = options.knownInfoByItemId?.get(slot.item.id) ?? unknownInfoState();
    return matchesKnownCondition(known.shapeKnown, shapeCondition)
      && matchesKnownCondition(known.rankKnown, rankCondition)
      && matchesKnownCondition(known.allKnown, allCondition);
  });
}

function weightedTargetValues(
  values: readonly number[],
  state: MatchRuntimeState,
  fallback: readonly number[]
): number[] {
  if (values.length <= 1 && (values[0] ?? 0) === 0) {
    return [state.rng.pick([...fallback])];
  }
  const countEncoded = values.length >= 3 && values.length % 2 === 1;
  const requestedCount = countEncoded ? Math.max(1, Math.floor(values[0] ?? 1)) : 1;
  const startIndex = countEncoded ? 1 : 0;
  const pairs: Array<{ item: number; weight: number }> = [];
  for (let index = startIndex; index < values.length; index += 2) {
    const value = values[index];
    const weight = values[index + 1] ?? 1;
    if (value !== undefined && value > 0 && weight > 0) {
      pairs.push({ item: value, weight });
    }
  }
  if (pairs.length === 0) {
    return [state.rng.pick([...fallback])];
  }
  const selected: number[] = [];
  const remaining = pairs.map((pair) => ({ ...pair }));
  while (selected.length < requestedCount && remaining.length > 0) {
    const picked = state.rng.weighted(remaining);
    selected.push(picked);
    const pickedIndex = remaining.findIndex((pair) => pair.item === picked);
    if (pickedIndex >= 0) {
      remaining.splice(pickedIndex, 1);
    }
  }
  return selected;
}

function filterValueForSlot(slot: WarehouseSlot, allSlots: readonly WarehouseSlot[], filterType: number): number {
  const row = bidKingItemRowForSlot(slot);
  if (!row) {
    return 0;
  }
  if (filterType === 1) {
    return row.item_quality;
  }
  if (filterType === 2) {
    return slot.item.footprint.w * slot.item.footprint.h;
  }
  if (filterType === 3) {
    return row.base_value;
  }
  if (filterType === 4) {
    return Math.floor(row.base_value / Math.max(1, slot.item.footprint.w * slot.item.footprint.h));
  }
  if (filterType === 5) {
    return allSlots.filter((candidate) => bidKingItemRowForSlot(candidate)?.id === row.id).length;
  }
  if (filterType === 6) {
    return allSlots.filter((candidate) => bidKingItemRowForSlot(candidate)?.item_type_id === row.item_type_id).length;
  }
  if (filterType === 7) {
    return allSlots.filter((candidate) => bidKingItemRowForSlot(candidate)?.item_quality === row.item_quality).length;
  }
  return row.base_value;
}

function mergeSourceBoxInfo(boxes: readonly BidKingBoxInfoDataSnapshot[]): BidKingBoxInfoDataSnapshot {
  const first = boxes[0] ?? {
    boxId: 0,
    itemUid: 0,
    itemCid: 0,
    itemSlotType: 0,
    itemType: [],
    itemQuility: 0,
    itemPrice: 0,
    itemBoxIndex: 0
  };
  return boxes.reduce((merged, box) => ({
    boxId: merged.boxId || box.boxId,
    itemUid: merged.itemUid || box.itemUid,
    itemCid: merged.itemCid || box.itemCid,
    itemSlotType: merged.itemSlotType || box.itemSlotType,
    itemType: [...new Set([...merged.itemType, ...box.itemType])],
    itemQuility: merged.itemQuility || box.itemQuility,
    itemPrice: merged.itemPrice || box.itemPrice,
    itemBoxIndex: merged.itemBoxIndex || box.itemBoxIndex
  }), { ...first, itemType: [...first.itemType] });
}

export function bidKingSkillRequiresTargetBox(skill: BidKingSkillRow): boolean {
  return skill.skilltarget === 8 || skill.skilltarget2 === 8 || skill.skilltarget3 === 8;
}

function usesRequiredContextTarget(skill: BidKingSkillRow): boolean {
  return bidKingSkillRequiresTargetBox(skill)
    || skill.skilltarget === 10
    || skill.skilltarget2 === 10
    || skill.skilltarget3 === 10;
}

function sourceHitBoxForSlot(entry: SkillFeedEntry, slot: WarehouseSlot): BidKingBoxInfoDataSnapshot | undefined {
  const boxId = slot.y * 10 + slot.x;
  return entry.hitBoxList?.find((box) => box.boxId === boxId);
}

function knownStateForItem(
  known: Map<string, BidKingKnownInfoState>,
  itemId: string
): BidKingKnownInfoState {
  const existing = known.get(itemId);
  if (existing) {
    return existing;
  }
  const created = unknownInfoState();
  known.set(itemId, created);
  return created;
}

function unknownInfoState(): BidKingKnownInfoState {
  return {
    shapeKnown: false,
    rankKnown: false,
    allKnown: false
  };
}

function applySourceKnowledge(
  known: BidKingKnownInfoState,
  entry: SkillFeedEntry,
  hitBox: BidKingBoxInfoDataSnapshot | undefined
): void {
  const categories = bidKingSourceEffectCategoriesForFeedEntry(entry);
  const knowledge = bidKingSkillEffectKnowledge(categories);
  if ((hitBox?.itemSlotType && knowledge.shape) || knowledge.shape) {
    known.shapeKnown = true;
  }
  if ((hitBox?.itemQuility && knowledge.rank) || knowledge.rank) {
    known.rankKnown = true;
  }
  if ((hitBox?.itemCid && knowledge.all) || knowledge.all) {
    known.allKnown = true;
    known.shapeKnown = true;
    known.rankKnown = true;
  }
}

function normalizeKnownCondition(value: number): 0 | 1 | 2 {
  return value === 1 || value === 2 ? value : 0;
}

function matchesKnownCondition(known: boolean, condition: 0 | 1 | 2): boolean {
  if (condition === 1) {
    return known;
  }
  if (condition === 2) {
    return !known;
  }
  return true;
}

function bidKingNumericItemIdForSlot(slot: WarehouseSlot): number | undefined {
  const match = /^compat_(\d+)_/.exec(slot.item.id);
  return match?.[1] ? Number(match[1]) : undefined;
}

function sourceItemUidOrder(slot: WarehouseSlot): number {
  const match = /^compat_\d+_(\d+)$/.exec(slot.item.id);
  return match?.[1] ? Number(match[1]) : slot.y * 10 + slot.x;
}

function shuffleBidKingSlots(slots: readonly WarehouseSlot[], state: MatchRuntimeState): WarehouseSlot[] {
  const shuffled = [...slots];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(state.rng.next() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}
