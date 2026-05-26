import {
  BidMap,
  bidKingBidMapDisplayDesc,
  bidKingBidMapDisplayName,
  bidKingItemDisplayName,
  bidKingSkillDisplayName,
  Drop,
  getBidKingCloseThreshold,
  Hero,
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
import { sumItemValue } from '../scoring';
import type { ContainerInstance, MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from '../types';
import { bidKingRandomBidMapCandidates, bidKingResolveRandomBidMapId } from './bidMapRuntime';
import { bidKingHeroIdForRoleId } from './heroRuntime';
import {
  bidKingKnowledgeByItemIdFromSkillFeed,
  bidKingSourceHitBoxList,
  bidKingSourceHitBoxListForCategories,
  selectBidKingSlotsBySkill
} from './skillTargeting';

export { getBidKingCloseThreshold };

export function createBidKingCoreWarehouseInstance(state: MatchRuntimeState, now: number): ContainerInstance {
  const { sourceBidMap, resolvedBidMap } = resolveBidMapForState(state);
  state.coreSourceBidMapId = sourceBidMap.id;
  state.coreResolvedBidMapId = resolvedBidMap.id;
  const hiddenItems = drawItemsForBidMap(state, resolvedBidMap);
  return createContainerFromBidMap(
    state,
    resolvedBidMap,
    hiddenItems,
    now,
    bidKingRoundRuleForBidMap(resolvedBidMap, state.roundIndex, state)
  );
}

export function applyBidKingRoundRule(
  container: ContainerInstance,
  roundIndex: number,
  state?: MatchRuntimeState
): ContainerInstance {
  const bidMap = bidMapFromTemplateId(container.templateId);
  if (!bidMap) {
    throw new Error(`Container template ${container.templateId} is not backed by BidMap`);
  }
  const rule = bidKingRoundRuleForBidMap(bidMap, roundIndex, state);
  return {
    ...container,
    auctionDurationMs: rule.auctionDurationMs,
    minimumBid: rule.minimumBid
  };
}

export function buildBidKingOpeningCandidates(
  state: MatchRuntimeState,
  selected: PublicContainerInfo,
  now: number
): PublicContainerInfo[] | undefined {
  const rows = openingCandidateRowsForState(state);
  if (rows.length === 0) {
    return undefined;
  }
  const candidates: PublicContainerInfo[] = rows
    .slice(0, 7)
    .map((row, index) => openingCandidateInfo(row, now + index + 1));
  return [
    ...candidates,
    {
      ...selected,
      tags: [...selected.tags]
    }
  ];
}

function openingCandidateRowsForState(state: MatchRuntimeState): BidKingBidMapRow[] {
  const sourceBidMap = BidMap.find((row) => row.id === (state.coreSourceBidMapId ?? state.coreBidMapId));
  if (!sourceBidMap) {
    throw new Error(`Unknown BidMap ${state.coreSourceBidMapId ?? state.coreBidMapId}`);
  }
  return bidKingRandomBidMapCandidates(sourceBidMap.id)
    .map((id) => {
      const row = BidMap.find((candidate) => candidate.id === id && candidate.is_visiable === 1);
      if (!row) {
        throw new Error(`BidMap ${sourceBidMap.id} references unavailable opening candidate ${id}`);
      }
      return row;
    });
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
        text: buildMapSkillFeedText(bidMapName, mapSkillName, mapSkill, mapEffect, hitSlots),
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
    const entry: SkillFeedEntry = {
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
    };
    entries.push(entry);
    entries.push(...buildCompositeHeroSkillFeedEntries(state, round, player, hero, skill, now, entries));
  }

  return entries;
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
    estimateHidden: true,
    artKey: bidMap.art_key
  };
  return {
    id: publicInfo.id,
    templateId: publicInfo.templateId,
    publicInfo,
    hiddenItems,
    warehouseSlots: buildWarehouseSlots(hiddenItems),
    publicClues: [],
    privateCluesByPlayerId: Object.fromEntries(state.players.map((player) => [player.id, []])),
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
  const row = RankMap.find((candidate) => candidate.id === bidMap.id);
  if (!row) {
    throw new Error(`Missing RankMap ${bidMap.id}`);
  }
  const seconds = bidMap.map_time[Math.min(Math.max(0, roundIndex), Math.max(0, bidMap.map_time.length - 1))]
    ?? weightedRangeValue(row.match_time, state);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`BidMap ${bidMap.id} round ${roundIndex + 1} has invalid auction duration`);
  }
  return {
    auctionDurationMs: seconds * 1000,
    minimumBid: weightedRangeValue(row.min_bid_range, state)
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
  if (!group) {
    throw new Error(`BidMap ${bidMap.id} map_random_skill references missing SkillGroup ${groupId}`);
  }
  const candidates = group.skill_group
    .map(([skillId, weight]) => {
      const skill = skillById(skillId);
      if (!skill) {
        throw new Error(`SkillGroup ${groupId} references missing Skill ${skillId}`);
      }
      return { item: skill, weight };
    })
    .filter((candidate) => candidate.weight > 0);
  if (candidates.length === 0) {
    throw new Error(`SkillGroup ${groupId} has no positive Skill weights`);
  }
  return state.rng.weighted(candidates);
}

function resolveBidMapForState(state: MatchRuntimeState): {
  sourceBidMap: BidKingBidMapRow;
  resolvedBidMap: BidKingBidMapRow;
} {
  const sourceBidMap = BidMap.find((row) => row.id === state.coreBidMapId);
  if (!sourceBidMap) {
    throw new Error(`Unknown BidMap ${state.coreBidMapId}`);
  }
  if (sourceBidMap.is_visiable !== 1) {
    throw new Error(`BidMap ${state.coreBidMapId} is not visible`);
  }
  if (sourceBidMap.bidder_number !== state.players.length) {
    throw new Error(`BidMap ${state.coreBidMapId} requires exactly ${sourceBidMap.bidder_number} players`);
  }
  const seed = `${state.seed}:${state.id}`;
  return {
    sourceBidMap,
    resolvedBidMap: resolveBidMapGroup(sourceBidMap, seed)
  };
}

function resolveBidMapGroup(bidMap: BidKingBidMapRow, seed: string | number): BidKingBidMapRow {
  const resolvedId = bidKingResolveRandomBidMapId(bidMap.id, seed);
  const resolved = BidMap.find((row) => row.id === resolvedId);
  if (!resolved) {
    throw new Error(`BidMap ${bidMap.id} resolved missing BidMap ${resolvedId}`);
  }
  return resolved;
}

function openingCandidateInfo(bidMap: BidKingBidMapRow, idSeed: number): PublicContainerInfo {
  return {
    id: `${templateIdForBidMap(bidMap)}_opening_${idSeed}`,
    templateId: templateIdForBidMap(bidMap),
    name: bidKingBidMapDisplayName(bidMap),
    source: bidKingBidMapDisplayDesc(bidMap),
    tags: [...bidMap.packaged_tags],
    risk: bidMap.risk,
    estimateMin: 0,
    estimateMax: 0,
    estimateHidden: true,
    artKey: bidMap.art_key
  };
}

function weightedRangeValue(ranges: readonly (readonly number[])[], state?: MatchRuntimeState): number {
  const candidates = ranges
    .filter((range) => range.length >= 2)
    .map((range) => ({
      min: Math.round(range[0] ?? 0),
      max: Math.round(range[1] ?? range[0] ?? 0),
      weight: Math.max(0, range[2] ?? 1)
    }))
    .filter((range) => range.max >= range.min && range.weight > 0);
  if (candidates.length === 0) {
    throw new Error('Weighted range table has no valid candidates');
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
    .map((drop) => {
      const item = itemById(drop.item_id);
      if (!item) {
        throw new Error(`Drop route for BidMap ${bidMap.id} references missing Item ${drop.item_id}`);
      }
      return item;
    });
  const routeKnown = routeType === 9999
    ? routeGroupId !== undefined && Drop.some((candidate) => candidate.group_id === routeGroupId)
    : routeGroupId !== undefined && Boolean(itemById(routeGroupId));
  if (!routeKnown) {
    throw new Error(`BidMap ${bidMap.id} references unknown drop route ${JSON.stringify(bidMap.drop_group_id)}`);
  }
  return rows;
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
    throw new Error(`Drop group ${groupId} exceeded recursion depth`);
  }
  const group = Drop.find((candidate) => candidate.group_id === groupId);
  const drops = group?.items_list.filter((row) => row.drop_weight > 0) ?? [];
  if (dropCount <= 0) {
    return [];
  }
  if (!group || drops.length === 0) {
    throw new Error(`Missing or empty Drop group ${groupId}`);
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
  const effectSummary = skillEffectSummaryLabel(skill, effect);
  const clueId = `${core.id}_${trigger}_${player.id}_${roundIndex + 1}_${hero.id}_${skill.id}`;
  const selectedSlots = selectSlotsBySkill(core, state, skill, trigger, player.id, extraSkillFeed);
  const selectedItemIds = slotItemIds(selectedSlots);
  const skillName = bidKingSkillDisplayName(skill);

  if (selectedSlots.length === 0 && skillUsesKnowledgeStateTarget(skill)) {
    return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
  }

  if ([8, 9, 10].includes(effect.Category)) {
    const targetItems = selectedSlots.map((slot) => slot.item);
    const targetValue = targetItems.reduce((sum, item) => sum + item.value, 0);
    const cells = Math.max(1, targetItems.reduce((sum, item) => sum + item.footprint.w * item.footprint.h, 0));
    const value =
      effect.Category === 8
        ? Math.round(targetValue / Math.max(1, targetItems.length))
        : effect.Category === 9
          ? Math.round(targetValue / cells)
          : targetValue;
    const precision = trigger === 'manual' ? 0.08 : 0.16 - Math.min(0.08, roundIndex * 0.015);
    const low = targetItems.length === 0 ? 0 : Math.max(1000, Math.round(value * (0.9 - precision)));
    const high = targetItems.length === 0 ? 0 : Math.max(low + 1000, Math.round(value * (1.1 + precision)));
    const label = effect.Category === 8 ? '平均价值' : effect.Category === 9 ? '每格均价' : '总价值';
    return {
      id: clueId,
      kind: 'value',
      text: targetItems.length === 0
        ? `${hero.packaged_name}·${skillName}：${label}为 0。`
        : `${hero.packaged_name}·${skillName}：命中样本价值约在 ${low.toLocaleString()} ～ ${high.toLocaleString()}。`,
      accuracy: trigger === 'manual' ? 0.9 : 0.82,
      valueHint: { min: low, max: high },
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if ([2, 3, 4].includes(effect.Category)) {
    const targetItems = selectedSlots.map((slot) => slot.item);
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
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：命中一个候选格，${target.item.category}，价值约 ${target.item.value.toLocaleString()}。`,
      accuracy: 0.88,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds,
      valueHint: {
        min: Math.max(1000, Math.round(target.item.value * 0.9)),
        max: Math.max(2000, Math.round(target.item.value * 1.1))
      },
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 6) {
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：显示藏品本体，${target.item.name}，${target.item.category}，品质接近${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.9,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 7) {
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：揭示一个命中格的${effectSummary}，品质接近${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 12) {
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：本场竞拍最高品质为${rarityNameForText(target.item.rarity)}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 14) {
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
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
      targetItemIds: selectedItemIds,
      valueHint: { min, max },
      source: 'skill',
      isTruthful: true
    };
  }

  if ([1, 11, 22].includes(effect.Category)) {
    const targets = selectedSlots;
    if (targets.length === 0) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：揭示 ${targets.length} 个命中格的${effectSummary}。`,
      accuracy: 0.86,
      targetItemIds: targets.map((slot) => slot.item.id),
      source: 'skill',
      isTruthful: true
    };
  }

  if (effect.Category === 13) {
    const target = selectedSlots[0];
    if (!target) {
      return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
    }
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：目标品类为${target.item.category}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: selectedItemIds,
      source: 'skill',
      isTruthful: true
    };
  }

  const targetItems = selectedSlots.slice(0, 3).map((slot) => slot.item);
  if (targetItems.length === 0) {
    return buildBidKingNoHitSkillClue(clueId, hero.packaged_name, skillName);
  }
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

function buildBidKingNoHitSkillClue(clueId: string, heroName: string, skillName: string): Clue {
  return {
    id: clueId,
    kind: 'category',
    text: `${heroName}·${skillName}：未命中符合条件的藏品。`,
    accuracy: 1,
    targetItemIds: [],
    source: 'skill',
    isTruthful: true
  };
}

interface CompositeHeroSkillFeedSpec {
  suffix: string;
  target: number;
  values: readonly number[];
  target2?: number;
  values2?: readonly number[];
  countType?: number;
  count: number;
  effectId: number;
  text: (targetCount: number) => string;
}

function buildCompositeHeroSkillFeedEntries(
  state: MatchRuntimeState,
  round: RuntimeRound,
  player: RuntimePlayer,
  hero: ReturnType<typeof heroForPlayer>,
  skill: BidKingSkillRow,
  now: number,
  existingEntries: readonly SkillFeedEntry[]
): SkillFeedEntry[] {
  return compositeHeroSkillFeedSpecs(hero.id, skill.id).flatMap((spec) => {
    const effect = skillEffectById(spec.effectId);
    if (!effect) {
      return [];
    }
    const virtualSkill = skillWithRuntimeOverrides(skill, {
      skilltarget: spec.target,
      skilltargetvalue: [...spec.values],
      skilltarget2: spec.target2 ?? 0,
      skilltargetvalue2: [...(spec.values2 ?? [0])],
      skilltarget3: 0,
      skilltargetvalue3: [0],
      skill_count_type: spec.countType ?? 1,
      skill_count: spec.count,
      skilleffect_position: [spec.effectId]
    });
    const hitSlots = selectSlotsBySkill(round.container, state, virtualSkill, 'auto', player.id, existingEntries);
    const targetItemIds = slotItemIds(hitSlots);
    const effectCategories = [effect.Category];
    return [{
      id: `${round.id}_hero_skill_${player.id}_${skill.id}_${spec.suffix}`,
      round: round.index + 1,
      playerId: player.id,
      source: 'hero' as const,
      sourceName: hero.packaged_name,
      skillName: bidKingSkillDisplayName(skill),
      ...skillFeedEffectMetadata(virtualSkill, effect, targetItemIds),
      skillCid: skill.id,
      effectCategories,
      text: `${hero.packaged_name}·${bidKingSkillDisplayName(skill)}：${spec.text(targetItemIds.length)}`,
      iconKey: skill.skill_icon,
      visibility: 'private' as const,
      targetItemIds,
      hitBoxList: bidKingSourceHitBoxListForCategories(round, hitSlots, effectCategories),
      createdAt: now
    }];
  });
}

function compositeHeroSkillFeedSpecs(heroId: number, skillId: number): CompositeHeroSkillFeedSpec[] {
  if (heroId === 110 && skillId === 100110) {
    return [{
      suffix: 'jewelry_shape',
      target: 1,
      values: [102],
      count: 4,
      effectId: 1000,
      text: (count) => `显示 ${count} 件矿玉珠宝类藏品的轮廓。`
    }];
  }
  if (heroId === 106 && skillId === 100106) {
    return [{
      suffix: 'trend_digital_shape',
      target: 1,
      values: [103, 107],
      count: 0,
      effectId: 1000,
      text: (count) => `显示 ${count} 件锦衣冠服与机巧器具类藏品的轮廓。`
    }];
  }
  if (heroId === 203 && skillId === 100203) {
    return [{
      suffix: 'antique_rank',
      target: 1,
      values: [106],
      count: 2,
      effectId: 7000,
      text: (count) => `显示 ${count} 件文玩古器类藏品的品质。`
    }];
  }
  if (heroId === 206 && skillId === 100206) {
    return [{
      suffix: 'book_painting_shape',
      target: 1,
      values: [110],
      count: 0,
      effectId: 1000,
      text: (count) => `显示 ${count} 件书画典籍类藏品的轮廓。`
    }];
  }
  return [];
}

function skillWithRuntimeOverrides(skill: BidKingSkillRow, overrides: Partial<BidKingSkillRow>): BidKingSkillRow {
  return { ...skill, ...overrides };
}

function heroForPlayer(player: RuntimePlayer, state?: MatchRuntimeState) {
  const mappedHeroId = player.heroCid ?? bidKingHeroIdForRoleId(player.roleId, state?.config.roles ?? []);
  const hero = Hero.find((candidate) => candidate.id === mappedHeroId);
  if (!hero) {
    throw new Error(`Player ${player.id} role ${player.roleId} is not mapped to a BidKing Hero`);
  }
  return hero;
}

function skillForHero(hero: ReturnType<typeof heroForPlayer>, roundIndex: number): BidKingSkillRow | undefined {
  const indexedId = hero.cast_type[Math.max(0, roundIndex)] ?? 0;
  return indexedId > 0 ? skillById(indexedId) : undefined;
}

function effectForSkill(skill: BidKingSkillRow): BidKingSkillEffectRow {
  const effectId = skill.skilleffect_position[0];
  if (!effectId) {
    throw new Error(`Skill ${skill.id} has no SkillEffect reference`);
  }
  const effect = skillEffectById(effectId);
  if (!effect) {
    throw new Error(`Skill ${skill.id} references missing SkillEffect ${effectId}`);
  }
  return effect;
}

function skillEffectSummaryLabel(skill: BidKingSkillRow, primaryEffect: BidKingSkillEffectRow): string {
  const effectiveCategories = skillEffectCategories(skill, primaryEffect);
  if (effectiveCategories.includes(6)) {
    return '完整信息';
  }
  const labels: string[] = [];
  if (effectiveCategories.some((category) => category === 1 || category === 22)) {
    labels.push('轮廓');
  }
  if (effectiveCategories.some((category) => category === 7 || category === 12)) {
    labels.push('品质');
  }
  if (effectiveCategories.includes(5)) {
    labels.push('价值');
  }
  if (effectiveCategories.includes(11)) {
    labels.push('占格数');
  }
  if (effectiveCategories.includes(13)) {
    labels.push('品类');
  }
  if (effectiveCategories.includes(14)) {
    labels.push('价格位数');
  }
  if (effectiveCategories.includes(10)) {
    labels.push('总价值');
  }
  if (effectiveCategories.includes(4)) {
    labels.push('命中数量');
  }
  if (effectiveCategories.includes(3)) {
    labels.push('平均占格');
  }
  if (effectiveCategories.includes(2)) {
    labels.push('总占格');
  }
  return labels.length > 0 ? [...new Set(labels)].join('和') : primaryEffect.effect_desc;
}

function buildMapSkillFeedText(
  bidMapName: string,
  skillName: string,
  skill: BidKingSkillRow,
  primaryEffect: BidKingSkillEffectRow,
  hitSlots: readonly WarehouseSlot[]
): string {
  const categories = skillEffectCategories(skill, primaryEffect);
  const effectName = skillEffectSummaryLabel(skill, primaryEffect);
  const targetCount = hitSlots.length;
  const prefix = `${bidMapName}·${skillName}`;
  if (targetCount === 0) {
    return `${prefix}：未命中符合条件的藏品。`;
  }
  const totalCells = hitSlots.reduce((sum, slot) => sum + Math.max(1, slot.w * slot.h), 0);
  const totalValue = hitSlots.reduce((sum, slot) => sum + slot.item.value, 0);
  const firstSlot = hitSlots[0]!;
  if (categories.includes(10)) {
    return `${prefix}：命中藏品总价值为 ${totalValue.toLocaleString()}。`;
  }
  if (categories.includes(8)) {
    return `${prefix}：命中藏品平均价值为 ${Math.round(totalValue / Math.max(1, targetCount)).toLocaleString()}。`;
  }
  if (categories.includes(9)) {
    return `${prefix}：命中藏品格均价值为 ${Math.round(totalValue / Math.max(1, totalCells)).toLocaleString()}。`;
  }
  if (categories.includes(2)) {
    return `${prefix}：命中藏品总占格为 ${totalCells}。`;
  }
  if (categories.includes(3)) {
    return `${prefix}：命中藏品平均占格为 ${Math.round(totalCells / Math.max(1, targetCount))}。`;
  }
  if (categories.includes(4)) {
    return `${prefix}：命中藏品数量为 ${targetCount}。`;
  }
  if (categories.includes(14)) {
    return `${prefix}：命中格价格为 ${String(Math.max(0, Math.floor(firstSlot.item.value))).length} 位数。`;
  }
  if (categories.includes(13)) {
    return `${prefix}：命中格品类为${firstSlot.item.category}。`;
  }
  if (categories.includes(12)) {
    return `${prefix}：命中格品质为${rarityNameForText(firstSlot.item.rarity)}。`;
  }
  if (categories.includes(5)) {
    return `${prefix}：命中格价值为 ${firstSlot.item.value.toLocaleString()}。`;
  }
  if (categories.includes(6)) {
    return `${prefix}：显示藏品本体，${firstSlot.item.name}，${firstSlot.item.category}，品质${rarityNameForText(firstSlot.item.rarity)}。`;
  }
  return `${prefix}：揭示 ${targetCount} 个命中格的${effectName}。`;
}

function skillEffectCategories(skill: BidKingSkillRow, primaryEffect: BidKingSkillEffectRow): number[] {
  const categories = [...new Set(skill.skilleffect_position
    .map((effectId) => skillEffectById(effectId)?.Category)
    .filter((category): category is number => typeof category === 'number' && category > 0))];
  return categories.length > 0 ? categories : [primaryEffect.Category];
}

function skillFeedEffectMetadata(
  skill: BidKingSkillRow,
  effect: BidKingSkillEffectRow,
  targetItemIds: readonly string[]
): Pick<SkillFeedEntry, 'skillCid' | 'effectId' | 'effectCategory' | 'effectCategories' | 'effectKey' | 'effectName' | 'skillTarget' | 'targetCount'> {
  const effectName = skillEffectSummaryLabel(skill, effect);
  const effectCategories = skillEffectCategories(skill, effect);
  return {
    skillCid: skill.id,
    effectId: effect.EffectId,
    effectCategory: effect.Category,
    effectCategories,
    effectKey: effect.effect_key,
    effectName,
    skillTarget: skill.skilltarget,
    targetCount: targetItemIds.length
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
  if (row.item_quality === 5) {
    return 'legendary';
  }
  return 'mythic';
}

function rarityNameForText(rarity: Rarity): string {
  const names: Record<Rarity, string> = {
    junk: '普通',
    common: '良品',
    fine: '精品',
    rare: '稀有',
    legendary: '传世',
    mythic: '典藏'
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

function templateIdForBidMap(bidMap: BidKingBidMapRow): string {
  return `bidmap_${bidMap.id}`;
}
