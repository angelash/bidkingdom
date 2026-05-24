import {
  BidMap,
  bidKingBidMapDisplayDesc,
  bidKingBidMapDisplayName,
  bidKingItemDisplayName,
  bidKingSkillDisplayName,
  Drop,
  dropsForGroup,
  getBidKingCloseThreshold,
  Hero,
  Item,
  itemById,
  itemFootprint,
  RankMap,
  SkillGroup,
  skillById,
  skillEffectById,
  type BidKingBidMapRow,
  type BidKingDropItemRow,
  type BidKingItemRow,
  type BidKingSkillEffectRow,
  type BidKingSkillRow
} from '@bitkingdom/bidking-compat';
import type { Clue, PublicContainerInfo, RevealedItem, Rarity, SkillFeedEntry } from '@bitkingdom/shared';
import { buildPrivateClues, buildPublicClues } from '../clues';
import { sumItemValue } from '../scoring';
import type { ContainerInstance, MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from '../types';
import {
  bidKingHighestConfiguredMinimumBidForBidMap,
  bidKingInitialCashForBidMap
} from './initialCashRuntime';
import { bidKingHeroIdForRoleId } from './heroRuntime';
import {
  bidKingKnowledgeByItemIdFromSkillFeed,
  bidKingSourceHitBoxList,
  bidKingSourceTargetCount,
  selectBidKingSlotsBySkill
} from './skillTargeting';

export { getBidKingCloseThreshold };

export function createBidKingCoreWarehouseInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  const bidMap = resolveBidMapForState(state);
  const hiddenItems = drawItemsForBidMap(state, bidMap);
  return createContainerFromBidMap(state, bidMap, hiddenItems, now, bidKingRoundRuleForBidMap(bidMap, state.roundIndex, state));
}

export function buildBidKingOpeningCandidates(
  state: MatchRuntimeState,
  selected: PublicContainerInfo,
  now: number
): PublicContainerInfo[] {
  const selectedBidMap = BidMap.find((row) => selected.templateId === templateIdForBidMap(row));
  const others = shuffleByRng(
    eligibleBidMapsForState(state).filter((row) => row.id !== selectedBidMap?.id),
    state
  ).slice(0, 7);
  const maps = shuffleByRng(
    [selectedBidMap, ...others].filter((row): row is BidKingBidMapRow => Boolean(row)),
    state
  );
  return maps.map((bidMap, index) => (
    selectedBidMap && bidMap.id === selectedBidMap.id
      ? selected
      : buildBidMapPreview(bidMap, now, index)
  ));
}

export function applyBidKingRoundRule(
  container: ContainerInstance,
  roundIndex: number,
  state?: MatchRuntimeState
): ContainerInstance {
  const bidMap = bidMapFromTemplateId(container.templateId);
  if (!bidMap) {
    return container;
  }
  const rule = bidKingRoundRuleForBidMap(bidMap, roundIndex, state);
  return {
    ...container,
    auctionDurationMs: rule.auctionDurationMs,
    minimumBid: rule.minimumBid
  };
}

export function buildBidKingAutoSkillClues(
  core: ContainerInstance,
  state: MatchRuntimeState,
  player: RuntimePlayer,
  roundIndex: number,
  extraSkillFeed: readonly SkillFeedEntry[] = []
): Clue[] {
  return [buildBidKingSkillClue(core, state, player, roundIndex, 'auto', undefined, extraSkillFeed)]
    .filter((clue): clue is Clue => Boolean(clue));
}

export function buildBidKingRoundStartSkillFeed(
  state: MatchRuntimeState,
  round: RuntimeRound,
  now: number
): SkillFeedEntry[] {
  const bidMap = bidMapFromTemplateId(round.container.templateId);
  const roundNumber = round.index + 1;
  const entries: SkillFeedEntry[] = [];
  if (bidMap) {
    const mapSkill = skillForMapRound(bidMap, round.index, state);
    if (mapSkill) {
      const bidMapName = bidKingBidMapDisplayName(bidMap);
      const mapSkillName = bidKingSkillDisplayName(mapSkill);
      const mapEffect = effectForSkill(mapSkill);
      const hitSlots = selectSlotsBySkill(round.container, state, mapSkill, 'map', undefined, entries);
      const targetItemIds = slotItemIds(hitSlots);
      entries.push({
        id: `${round.id}_map_skill_${mapSkill.id}`,
        round: roundNumber,
        source: 'map',
        sourceName: bidMapName,
        skillName: mapSkillName,
        ...skillFeedEffectMetadata(mapSkill, mapEffect, targetItemIds),
        text: `${bidMapName}触发${mapSkillName}，本轮公共情报与仓库可见格更新。`,
        iconKey: mapSkill.skill_icon || bidMap.art_key,
        visibility: 'public',
        targetItemIds,
        hitBoxList: bidKingSourceHitBoxList(round, hitSlots, mapSkill),
        createdAt: now
      });
    }
  }

  for (const player of state.players) {
    const hero = heroForPlayer(player, state);
    const skill = skillForHero(hero, round.index);
    if (!skill) {
      continue;
    }
    const effect = effectForSkill(skill);
    const skillName = bidKingSkillDisplayName(skill);
    const clue = buildBidKingSkillClue(round.container, state, player, round.index, 'auto', undefined, entries);
    if (clue) {
      upsertRoundPrivateClue(round, player, clue);
    }
    const targetItemIds = clueTargetItemIds(clue);
    const hitSlots = slotsForTargetItemIds(round.container.warehouseSlots, targetItemIds);
    entries.push({
      id: `${round.id}_hero_skill_${player.id}_${skill.id}`,
      round: roundNumber,
      playerId: player.id,
      source: 'hero',
      sourceName: hero.packaged_name,
      skillName,
      ...skillFeedEffectMetadata(skill, effect, targetItemIds),
      text: clue?.text ?? `${hero.packaged_name}触发${skillName}，获得一条专属情报。`,
      iconKey: skill.skill_icon,
      visibility: 'private',
      targetItemIds,
      hitBoxList: bidKingSourceHitBoxList(round, hitSlots, skill),
      createdAt: now
    });
  }

  return entries;
}

export interface BidKingManualSkillResult {
  clue?: Clue;
  publishTo: 'public' | 'private';
  insuranceActive: boolean;
  cooldownRounds: number;
  effectPlan: BidKingSkillEffectPlan;
}

export interface BidKingSkillEffectPlan {
  skillId: number;
  skillName: string;
  skillTarget: number;
  skillTargetValue: readonly number[];
  secondaryTargets: readonly {
    target: number;
    values: readonly number[];
  }[];
  requestedTargetCount: number;
  targetCount: number;
  durationRounds: number;
  cooldownRounds: number;
  effectId: number;
  effectCategory: number;
  effectKey: string;
  effectName: string;
  targetItemIds: readonly string[];
  trigger: 'auto' | 'manual' | 'map' | 'item';
  description: string;
}

export function buildBidKingManualSkillResult(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  targetPlayerId?: string
): BidKingManualSkillResult | undefined {
  const round = state.currentRound;
  if (!round) {
    return undefined;
  }
  const hero = heroForPlayer(player, state);
  const skill = skillForHero(hero, round.index);
  if (!skill) {
    return undefined;
  }
  const effect = effectForSkill(skill);
  const clue = buildBidKingSkillClue(round.container, state, player, round.index, 'manual', targetPlayerId);
  const cooldownRounds = Math.max(1, skill.skill_CD);
  return {
    clue,
    publishTo: 'private',
    insuranceActive: false,
    cooldownRounds,
    effectPlan: buildBidKingSkillEffectPlan(skill, effect, clue, 'manual', cooldownRounds)
  };
}

export function buildBidKingManualSkillFeedEntry(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  clue: Clue | undefined,
  now: number
): SkillFeedEntry | undefined {
  const round = state.currentRound;
  if (!round) {
    return undefined;
  }
  const hero = heroForPlayer(player, state);
  const skill = skillForHero(hero, round.index);
  if (!skill) {
    return undefined;
  }
  const effect = effectForSkill(skill);
  const skillName = bidKingSkillDisplayName(skill);
  const targetItemIds = clueTargetItemIds(clue);
  return {
    id: `${round.id}_manual_skill_${player.id}_${skill.id}_${round.skillFeed.length + 1}`,
    round: round.index + 1,
    playerId: player.id,
    source: 'manual',
    sourceName: hero.packaged_name,
    skillName,
    ...skillFeedEffectMetadata(skill, effect, targetItemIds),
    text: clue?.text ?? `${hero.packaged_name}使用${skillName}，获得一条专属情报。`,
    iconKey: skill.skill_icon,
    visibility: 'private',
    targetItemIds,
    createdAt: now
  };
}

export function minimumBidForRound(round: RuntimeRound): number {
  return round.container.minimumBid ?? 0;
}

function createContainerFromBidMap(
  state: MatchRuntimeState,
  bidMap: BidKingBidMapRow,
  hiddenItems: RevealedItem[],
  now: number,
  roundRule: BidKingRoundRule
): ContainerInstance {
  const trueValue = sumItemValue(hiddenItems);
  const estimateMin = Math.max(1000, Math.round(trueValue * bidMap.public_estimate_min_rate * (0.9 + state.rng.next() * 0.12)));
  const estimateMax = Math.max(estimateMin + 1000, Math.round(trueValue * bidMap.public_estimate_max_rate * (0.94 + state.rng.next() * 0.14)));
  const publicInfo: PublicContainerInfo = {
    id: `${templateIdForBidMap(bidMap)}_${now}`,
    templateId: templateIdForBidMap(bidMap),
    name: bidKingBidMapDisplayName(bidMap),
    source: bidKingBidMapDisplayDesc(bidMap),
    tags: [...bidMap.packaged_tags],
    risk: bidMap.risk,
    estimateMin,
    estimateMax,
    artKey: bidMap.art_key
  };
  const publicClues = buildPublicClues({
    source: publicInfo.source,
    tags: publicInfo.tags,
    risk: publicInfo.risk,
    trueValue,
    estimateMin,
    estimateMax,
    hiddenItems
  });
  return {
    id: publicInfo.id,
    templateId: publicInfo.templateId,
    publicInfo,
    hiddenItems,
    warehouseSlots: buildWarehouseSlots(hiddenItems),
    publicClues,
    privateCluesByPlayerId: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        buildPrivateClues({ player, hiddenItems, trueValue, rng: state.rng })
      ])
    ),
    auctionDurationMs: roundRule.auctionDurationMs,
    minimumBid: roundRule.minimumBid
  };
}

interface BidKingRoundRule {
  auctionDurationMs: number;
  minimumBid: number;
}

function bidKingRoundRuleForBidMap(
  bidMap: BidKingBidMapRow,
  roundIndex: number,
  state?: MatchRuntimeState
): BidKingRoundRule {
  const row = RankMap.find((candidate) => candidate.id === bidMap.id) ?? RankMap[Math.max(0, roundIndex) % RankMap.length]!;
  const seconds = bidMap.map_time[Math.min(Math.max(0, roundIndex), Math.max(0, bidMap.map_time.length - 1))]
    ?? weightedRangeValue(row.match_time, state)
    ?? 60;
  return {
    auctionDurationMs: seconds * 1000,
    minimumBid: weightedRangeValue(row.min_bid_range, state) ?? 1000
  };
}

function bidMapFromTemplateId(templateId: string): BidKingBidMapRow | undefined {
  const match = /^bidmap_(\d+)$/.exec(templateId);
  const id = match?.[1] ? Number(match[1]) : undefined;
  return id ? BidMap.find((row) => row.id === id) : undefined;
}

function skillForMapRound(
  bidMap: BidKingBidMapRow,
  roundIndex: number,
  state: MatchRuntimeState
): BidKingSkillRow | undefined {
  const groupId = bidMap.map_random_skill[Math.min(Math.max(0, roundIndex), Math.max(0, bidMap.map_random_skill.length - 1))];
  if (!groupId) {
    return undefined;
  }
  const group = SkillGroup.find((row) => row.groupid === groupId);
  const candidates = group?.skill_group
    .map(([skillId, weight]) => ({ item: skillById(skillId), weight }))
    .filter((candidate): candidate is { item: BidKingSkillRow; weight: number } => Boolean(candidate.item));
  if (!candidates || candidates.length === 0) {
    return undefined;
  }
  const weighted = candidates.filter((candidate) => candidate.weight > 0);
  return state.rng.weighted(weighted.length > 0 ? weighted : candidates.map((candidate) => ({ ...candidate, weight: 1 })));
}

function eligibleBidMapsForState(state: MatchRuntimeState): BidKingBidMapRow[] {
  return eligibleBidMapsForPlayerCount(state.players.length, state.config.rules.initialCash);
}

function resolveBidMapForState(state: MatchRuntimeState): BidKingBidMapRow {
  const eligible = eligibleBidMapsForState(state);
  const requested = state.coreBidMapId
    ? BidMap.find((row) => row.id === state.coreBidMapId && row.is_visiable === 1)
    : undefined;
  if (!requested) {
    return state.rng.pick(eligible);
  }
  if (requested.bidder_number === state.players.length || eligible.length === 0) {
    return requested;
  }
  return state.rng.pick(eligible);
}

function eligibleBidMapsForPlayerCount(playerCount: number, maxMinimumBid?: number): BidKingBidMapRow[] {
  const visible = BidMap.filter((row) => row.is_visiable === 1 && row.auction_rounds_rate.some((rate) => rate > 0));
  const exact = visible.filter((row) => row.bidder_number === playerCount);
  if (exact.length > 0) {
    const affordable = maxMinimumBid === undefined
      ? exact
      : exact.filter((row) => (
        bidKingHighestConfiguredMinimumBidForBidMap(row.id) <= maxMinimumBid
        && bidKingInitialCashForBidMap(row.id) <= maxMinimumBid
      ));
    return affordable.length > 0 ? affordable : exact;
  }
  const multiplayer = visible.filter((row) => row.bidder_number > 1);
  if (multiplayer.length > 0) {
    const affordable = maxMinimumBid === undefined
      ? multiplayer
      : multiplayer.filter((row) => (
        bidKingHighestConfiguredMinimumBidForBidMap(row.id) <= maxMinimumBid
        && bidKingInitialCashForBidMap(row.id) <= maxMinimumBid
      ));
    return affordable.length > 0 ? affordable : multiplayer;
  }
  return BidMap;
}

function weightedRangeValue(ranges: readonly (readonly number[])[], state?: MatchRuntimeState): number | undefined {
  const candidates = ranges
    .filter((range) => range.length >= 2)
    .map((range) => ({
      min: Math.round(range[0] ?? 0),
      max: Math.round(range[1] ?? range[0] ?? 0),
      weight: Math.max(0, range[2] ?? 1)
    }))
    .filter((range) => range.max >= range.min && range.weight > 0);
  if (candidates.length === 0) {
    return undefined;
  }
  if (!state) {
    return candidates[0]!.min;
  }
  const selected = state.rng.weighted(candidates.map((range) => ({ item: range, weight: range.weight })));
  return state.rng.int(selected.min, selected.max);
}

function drawItemsForBidMap(state: MatchRuntimeState, bidMap: BidKingBidMapRow): RevealedItem[] {
  const rows = drawSourceItemRowsForBidMap(state, bidMap);
  const revealedItems = rows.map((row, index) => toRevealedItem(row, index));
  return buildWarehouseSlots(revealedItems).map((slot) => slot.item);
}

function drawSourceItemRowsForBidMap(state: MatchRuntimeState, bidMap: BidKingBidMapRow): BidKingItemRow[] {
  const [routeType, routeGroupId, routeMin, routeMax] = bidMap.drop_group_id;
  const routeCount = sourceRandomCount(
    state,
    routeMin ?? bidMap.item_count_min,
    routeMax ?? bidMap.item_count_max
  );
  const drops = routeType === 9999 && routeGroupId !== undefined
    ? doSourceDrop(state, routeGroupId, routeCount)
    : directSourceDrop(routeGroupId, routeCount);
  const rows = drops
    .map((drop) => itemById(drop.item_id))
    .filter((item): item is BidKingItemRow => Boolean(item));
  const routeKnown = routeType === 9999
    ? routeGroupId !== undefined && Drop.some((candidate) => candidate.group_id === routeGroupId)
    : routeGroupId !== undefined && Boolean(itemById(routeGroupId));
  if (routeKnown || rows.length > 0) {
    return rows;
  }
  const fallbackItems = Item.filter((item) => item.drop_group_id === routeGroupId);
  const fallbackCount = Math.max(1, routeCount);
  return Array.from({ length: fallbackCount }, (_, index) => (
    fallbackItems[index % Math.max(1, fallbackItems.length)]
    ?? Item[((routeGroupId ?? bidMap.id) * 11 + index * 17) % Item.length]!
  ));
}

function directSourceDrop(itemId: number | undefined, count: number): BidKingDropItemRow[] {
  if (itemId === undefined || count <= 0) {
    return [];
  }
  return Array.from({ length: count }, () => ({
    item_type: 0,
    item_id: itemId,
    min_count: 1,
    max_count: 1,
    drop_weight: 1
  }));
}

function doSourceDrop(state: MatchRuntimeState, groupId: number, dropCount = 1, depth = 0): BidKingDropItemRow[] {
  if (depth > 8) {
    return [];
  }
  const group = Drop.find((candidate) => candidate.group_id === groupId);
  const drops = group?.items_list.filter((row) => row.drop_weight > 0) ?? [];
  if (!group || drops.length === 0 || dropCount <= 0) {
    return [];
  }
  const result: BidKingDropItemRow[] = [];
  for (let index = 0; index < dropCount; index += 1) {
    const selected = group.weight_type === 1
      ? sourceProbabilityDrops(state, drops)
      : [state.rng.weighted(drops.map((row) => ({ item: row, weight: row.drop_weight })))];
    for (const drop of selected) {
      const count = sourceRandomCount(state, drop.min_count, drop.max_count);
      if (drop.item_type === 9999) {
        result.push(...doSourceDrop(state, drop.item_id, count, depth + 1));
      } else {
        for (let copy = 0; copy < count; copy += 1) {
          result.push(drop);
        }
      }
    }
  }
  return result;
}

function sourceProbabilityDrops(state: MatchRuntimeState, drops: readonly BidKingDropItemRow[]): BidKingDropItemRow[] {
  const total = drops.reduce((sum, row) => sum + Math.max(0, row.drop_weight), 0);
  if (total <= 0) {
    return [];
  }
  return drops.filter((row) => state.rng.next() < Math.max(0, row.drop_weight) / total);
}

function sourceRandomCount(state: MatchRuntimeState, num1 = 1, num2 = 1): number {
  const left = Math.round(num1);
  const right = Math.round(num2);
  if (left === right) {
    return left;
  }
  const min = Math.min(left, right);
  const max = Math.max(left, right);
  return Math.floor(state.rng.next() * Math.max(1, max - min)) + min;
}

function toRevealedItem(row: BidKingItemRow, instanceIndex: number): RevealedItem {
  const footprint = itemFootprint(row.slot_type);
  return {
    id: `compat_${row.id}_${instanceIndex + 1}`,
    name: bidKingItemDisplayName(row),
    category: row.packaged_category,
    rarity: rarityFromQuality(row),
    value: row.base_value,
    displayValue: row.base_value,
    isFake: false,
    repairCost: 0,
    setId: row.collection > 0 ? `compat_collection_${row.collection}` : undefined,
    iconKey: row.packaged_icon_key,
    footprint
  };
}

function buildBidKingSkillClue(
  core: ContainerInstance,
  state: MatchRuntimeState,
  player: RuntimePlayer,
  roundIndex: number,
  trigger: 'auto' | 'manual',
  _targetPlayerId?: string,
  extraSkillFeed: readonly SkillFeedEntry[] = []
): Clue | undefined {
  const hero = heroForPlayer(player, state);
  const skill = skillForHero(hero, roundIndex);
  if (!skill) {
    return undefined;
  }
  const effect = effectForSkill(skill);
  const clueId = `${core.id}_${trigger}_${player.id}_${roundIndex + 1}_${hero.id}_${skill.id}`;
  const selectedSlots = selectSlotsBySkill(core, state, skill, trigger, player.id, extraSkillFeed);
  const scanSlots = selectedSlots.slice(0, trigger === 'manual' ? 3 : 2);
  const selectedItemIds = slotItemIds(selectedSlots);
  const skillName = bidKingSkillDisplayName(skill);

  if (selectedSlots.length === 0 && skillUsesKnowledgeStateTarget(skill)) {
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：未命中符合条件的藏品。`,
      accuracy: 1,
      targetItemIds: [],
      source: 'skill',
      isTruthful: true
    };
  }

  if ([8, 9, 10].includes(effect.Category)) {
    const targetItems = selectedSlots.length > 0 ? selectedSlots.map((slot) => slot.item) : core.hiddenItems;
    const targetValue = targetItems.reduce((sum, item) => sum + item.value, 0);
    const cells = Math.max(1, targetItems.reduce((sum, item) => sum + item.footprint.w * item.footprint.h, 0));
    const value =
      effect.Category === 8
        ? Math.round(targetValue / Math.max(1, targetItems.length))
        : effect.Category === 9
          ? Math.round(targetValue / cells)
          : targetValue;
    const precision = trigger === 'manual' ? 0.08 : 0.16 - Math.min(0.08, roundIndex * 0.015);
    const low = Math.max(1000, Math.round(value * (0.9 - precision)));
    const high = Math.max(low + 1000, Math.round(value * (1.1 + precision)));
    return {
      id: clueId,
      kind: 'value',
      text: `${hero.packaged_name}·${skillName}：命中样本价值约在 ${low.toLocaleString()} ～ ${high.toLocaleString()}。`,
      accuracy: trigger === 'manual' ? 0.9 : 0.82,
      valueHint: { min: low, max: high },
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if ([2, 3, 4].includes(effect.Category)) {
    const targetItems = selectedSlots.length > 0 ? selectedSlots.map((slot) => slot.item) : core.hiddenItems;
    const totalCells = targetItems.reduce((sum, item) => sum + item.footprint.w * item.footprint.h, 0);
    const value = effect.Category === 2
      ? totalCells
      : effect.Category === 3
        ? Math.round(totalCells / Math.max(1, targetItems.length))
        : targetItems.length;
    const label = effect.Category === 2
      ? '总占格'
      : effect.Category === 3
        ? '平均占格'
        : '命中数量';
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：${label}为 ${value}。`,
      accuracy: trigger === 'manual' ? 0.9 : 0.84,
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 5) {
    const target = selectedSlots[0] ?? [...core.warehouseSlots].sort((left, right) => right.item.value - left.item.value)[0];
    if (!target) {
      return undefined;
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：命中一个候选格，${target.item.category}，价值约 ${target.item.value.toLocaleString()}。`,
      accuracy: 0.88,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      valueHint: {
        min: Math.max(1000, Math.round(target.item.value * 0.9)),
        max: Math.max(2000, Math.round(target.item.value * 1.1))
      },
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 6) {
    const target = selectedSlots[0] ?? scanSlots[0];
    if (!target) {
      return undefined;
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：显示藏品本体，${target.item.name}，${target.item.category}，品质接近${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.9,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 7) {
    const target = selectedSlots[0] ?? scanSlots[0];
    if (!target) {
      return undefined;
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：揭示一个命中格的品质，接近${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 12) {
    const target = selectedSlots[0] ?? scanSlots[0];
    if (!target) {
      return undefined;
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：本场竞拍最高品质为${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 14) {
    const target = selectedSlots[0] ?? [...core.warehouseSlots].sort((left, right) => right.item.value - left.item.value)[0];
    if (!target) {
      return undefined;
    }
    const digits = Math.max(1, String(Math.max(0, Math.floor(target.item.value))).length);
    const min = digits === 1 ? 0 : 10 ** (digits - 1);
    const max = 10 ** digits - 1;
    return {
      id: clueId,
      kind: 'value',
      text: `${hero.packaged_name}·${skillName}：命中格价格为 ${digits} 位数。`,
      accuracy: 0.82,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      valueHint: { min, max },
      source: 'skill',
      isTruthful: true
    };
  }

  if ([1, 11, 22].includes(effect.Category)) {
    const targets = selectedSlots.length > 0 ? selectedSlots : shuffleByRng(core.warehouseSlots, state).slice(0, trigger === 'manual' ? 3 : 2);
    const label = effect.Category === 11 ? '占格数' : '占位轮廓';
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：揭示 ${targets.length} 个命中格的${label}。`,
      accuracy: 0.86,
      targetItemIds: targets.map((slot) => slot.item.id),
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 13) {
    const target = selectedSlots[0] ?? scanSlots[0];
    if (!target) {
      return undefined;
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：目标品类为${target.item.category}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds.length > 0 ? selectedItemIds : [target.item.id],
      source: 'skill',
      isTruthful: true
    };
  }

  const targetItems = (scanSlots.length > 0 ? scanSlots.map((slot) => slot.item) : core.hiddenItems).slice(0, 3);
  const targetValue = targetItems.reduce((sum, item) => sum + item.value, 0);
  return {
    id: clueId,
    kind: 'category',
    text: `${hero.packaged_name}·${skillName}：命中 ${targetItems.length} 个格位，合计价值约 ${targetValue.toLocaleString()}。`,
    accuracy: 0.86,
    targetItemIds: targetItems.map((item) => item.id),
    valueHint: targetItems.length > 0 ? { min: Math.round(targetValue * 0.78), max: Math.round(targetValue * 1.18) } : undefined,
    source: 'skill',
    isTruthful: true,
    riskHint: 'safe'
  };
}

function heroForPlayer(player: RuntimePlayer, state?: MatchRuntimeState) {
  const mappedHeroId = player.heroCid ?? bidKingHeroIdForRoleId(player.roleId, state?.config.roles ?? []);
  return Hero.find((hero) => hero.id === mappedHeroId) ?? Hero[player.seat % Hero.length]!;
}

function skillForHero(hero: ReturnType<typeof heroForPlayer>, roundIndex: number): BidKingSkillRow | undefined {
  const indexedId = hero.cast_type[Math.max(0, roundIndex)] ?? 0;
  return indexedId > 0 ? skillById(indexedId) : undefined;
}

function effectForSkill(skill: BidKingSkillRow): BidKingSkillEffectRow {
  const effectId = skill.skilleffect_position[0] ?? 1000;
  return skillEffectById(effectId) ?? { EffectId: 1000, Category: 1, Param: [0], effect_key: 'category_1', effect_desc: '显示轮廓尺寸' };
}

function skillFeedEffectMetadata(
  skill: BidKingSkillRow,
  effect: BidKingSkillEffectRow,
  targetItemIds: readonly string[]
): Pick<SkillFeedEntry, 'skillCid' | 'effectId' | 'effectCategory' | 'effectKey' | 'effectName' | 'skillTarget' | 'targetCount'> {
  return {
    skillCid: skill.id,
    effectId: effect.EffectId,
    effectCategory: effect.Category,
    effectKey: effect.effect_key,
    effectName: effect.effect_desc,
    skillTarget: skill.skilltarget,
    targetCount: targetItemIds.length
  };
}

function buildBidKingSkillEffectPlan(
  skill: BidKingSkillRow,
  effect: BidKingSkillEffectRow,
  clue: Clue | undefined,
  trigger: BidKingSkillEffectPlan['trigger'],
  cooldownRounds = Math.max(0, skill.skill_CD)
): BidKingSkillEffectPlan {
  const targetItemIds = clueTargetItemIds(clue);
  const requestedTargetCount = bidKingSourceTargetCount(skill);
  const skillName = bidKingSkillDisplayName(skill);
  return {
    skillId: skill.id,
    skillName,
    skillTarget: skill.skilltarget,
    skillTargetValue: skill.skilltargetvalue,
    secondaryTargets: [
      { target: skill.skilltarget2, values: skill.skilltargetvalue2 },
      { target: skill.skilltarget3, values: skill.skilltargetvalue3 }
    ],
    requestedTargetCount,
    targetCount: targetItemIds.length,
    durationRounds: Math.max(0, skill.skill_round),
    cooldownRounds,
    effectId: effect.EffectId,
    effectCategory: effect.Category,
    effectKey: effect.effect_key,
    effectName: effect.effect_desc,
    targetItemIds,
    trigger,
    description: `${skillName}/${effect.effect_desc} 命中 ${targetItemIds.length} 个目标`
  };
}

function clueTargetItemIds(clue: Clue | undefined): string[] {
  if (!clue) {
    return [];
  }
  return clue.targetItemIds ?? (clue.targetItemId ? [clue.targetItemId] : []);
}

function slotItemIds(slots: readonly WarehouseSlot[]): string[] {
  return [...new Set(slots.map((slot) => slot.item.id))];
}

function slotsForTargetItemIds(slots: readonly WarehouseSlot[], targetItemIds: readonly string[]): WarehouseSlot[] {
  if (targetItemIds.length === 0) {
    return [];
  }
  const ids = new Set(targetItemIds);
  return slots.filter((slot) => ids.has(slot.item.id));
}

function upsertRoundPrivateClue(round: RuntimeRound, player: RuntimePlayer, clue: Clue): void {
  const nextClues = upsertClue(player.privateClues, clue);
  player.privateClues = nextClues;
  round.container.privateCluesByPlayerId[player.id] = nextClues;
}

function upsertClue(clues: readonly Clue[], clue: Clue): Clue[] {
  const index = clues.findIndex((candidate) => candidate.id === clue.id);
  if (index < 0) {
    return [...clues, clue];
  }
  return clues.map((candidate, candidateIndex) => candidateIndex === index ? clue : candidate);
}

function selectSlotsBySkill(
  core: ContainerInstance,
  state: MatchRuntimeState,
  skill: BidKingSkillRow,
  trigger: 'auto' | 'manual' | 'map' = 'auto',
  playerId?: string,
  extraSkillFeed: readonly SkillFeedEntry[] = []
): WarehouseSlot[] {
  const historicalSkillFeed = state.roundHistory.flatMap((history) => history.skillFeed ?? []);
  const currentRoundFeed = state.currentRound?.container.id === core.id
    ? state.currentRound.skillFeed
    : [];
  const skillFeed = [...historicalSkillFeed, ...currentRoundFeed, ...extraSkillFeed];
  const visiblePlayerId = trigger === 'map' ? undefined : playerId;
  return selectBidKingSlotsBySkill(core.warehouseSlots, state, skill, {
    knownInfoByItemId: bidKingKnowledgeByItemIdFromSkillFeed(core.warehouseSlots, skillFeed, visiblePlayerId)
  });
}

function skillUsesKnowledgeStateTarget(skill: BidKingSkillRow): boolean {
  return skill.skilltarget === 10 || skill.skilltarget2 === 10 || skill.skilltarget3 === 10;
}

function rarityFromQuality(row: BidKingItemRow): Rarity {
  if (row.item_quality <= 1) {
    return 'junk';
  }
  if (row.item_quality === 2) {
    return 'common';
  }
  if (row.item_quality === 3) {
    return 'fine';
  }
  if (row.item_quality === 4) {
    return 'rare';
  }
  return 'legendary';
}

function rarityNameForText(rarity: Rarity): string {
  const names: Record<Rarity, string> = {
    junk: '残品',
    common: '普通',
    fine: '精品',
    rare: '稀有',
    legendary: '传世',
    fake: '特殊'
  };
  return names[rarity];
}

function buildWarehouseSlots(items: RevealedItem[]): WarehouseSlot[] {
  const width = 10;
  const height = 60;
  const occupied = new Array<boolean>(width * height).fill(false);
  const slots: WarehouseSlot[] = [];
  for (const item of items) {
    const placement = findSourceWarehousePlacement(item, occupied, width, height);
    if (!placement) {
      continue;
    }
    markSourceWarehousePlacement(placement, occupied, width);
    slots.push({
      slotId: `slot_${slots.length + 1}`,
      item,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      rotate: placement.rotate
    });
  }
  return slots;
}

function findSourceWarehousePlacement(
  item: RevealedItem,
  occupied: readonly boolean[],
  width: number,
  height: number
): { x: number; y: number; w: number; h: number; rotate: boolean } | undefined {
  for (let pos = 0; pos < occupied.length; pos += 1) {
    if (occupied[pos]) {
      continue;
    }
    const normal = sourceWarehousePlacementAt(item, pos, false, occupied, width, height);
    if (normal) {
      return normal;
    }
    if (item.footprint.w !== item.footprint.h) {
      const rotated = sourceWarehousePlacementAt(item, pos, true, occupied, width, height);
      if (rotated) {
        return rotated;
      }
    }
  }
  return undefined;
}

function sourceWarehousePlacementAt(
  item: RevealedItem,
  pos: number,
  rotate: boolean,
  occupied: readonly boolean[],
  width: number,
  height: number
): { x: number; y: number; w: number; h: number; rotate: boolean } | undefined {
  const w = Math.max(1, rotate ? item.footprint.h : item.footprint.w);
  const h = Math.max(1, rotate ? item.footprint.w : item.footprint.h);
  const x = pos % width;
  const y = Math.floor(pos / width);
  if (x + w > width || y + h > height) {
    return undefined;
  }
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      if (occupied[(y + dy) * width + x + dx]) {
        return undefined;
      }
    }
  }
  return { x, y, w, h, rotate };
}

function markSourceWarehousePlacement(
  placement: { x: number; y: number; w: number; h: number },
  occupied: boolean[],
  width: number
): void {
  for (let dy = 0; dy < placement.h; dy += 1) {
    for (let dx = 0; dx < placement.w; dx += 1) {
      occupied[(placement.y + dy) * width + placement.x + dx] = true;
    }
  }
}

function buildBidMapPreview(
  bidMap: BidKingBidMapRow,
  now: number,
  index: number
): PublicContainerInfo {
  const [, routeGroupId] = bidMap.drop_group_id;
  const drops = routeGroupId !== undefined ? collectDropLeaves(routeGroupId).slice(0, 12) : [];
  const sampleRows = drops
    .slice(0, 8)
    .map((drop) => itemById(drop.item_id))
    .filter((item): item is BidKingItemRow => Boolean(item));
  const averageValue = sampleRows.length
    ? sampleRows.reduce((sum, item) => sum + item.base_value, 0) / sampleRows.length
    : 22000;
  const averageCount = (bidMap.item_count_min + bidMap.item_count_max) / 2;
  const previewValue = averageValue * averageCount;
  return {
    id: `${templateIdForBidMap(bidMap)}_preview_${now}_${index}`,
    templateId: templateIdForBidMap(bidMap),
    name: bidKingBidMapDisplayName(bidMap),
    source: bidKingBidMapDisplayDesc(bidMap),
    tags: [...bidMap.packaged_tags],
    risk: bidMap.risk,
    estimateMin: Math.max(1000, Math.round(previewValue * bidMap.public_estimate_min_rate)),
    estimateMax: Math.max(2000, Math.round(previewValue * bidMap.public_estimate_max_rate)),
    artKey: bidMap.art_key
  };
}

function collectDropLeaves(groupId: number, depth = 0, seen = new Set<number>()): BidKingDropItemRow[] {
  if (depth > 8 || seen.has(groupId)) {
    return [];
  }
  seen.add(groupId);
  const result: BidKingDropItemRow[] = [];
  for (const drop of dropsForGroup(groupId)) {
    if (drop.item_type === 9999) {
      result.push(...collectDropLeaves(drop.item_id, depth + 1, new Set(seen)));
    } else {
      result.push(drop);
    }
    if (result.length >= 64) {
      break;
    }
  }
  return result;
}

function shuffleByRng<T>(items: readonly T[], state: MatchRuntimeState): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = state.rng.int(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function templateIdForBidMap(bidMap: BidKingBidMapRow): string {
  return `bidmap_${bidMap.id}`;
}
