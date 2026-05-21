import {
  BidMap,
  bidKingBidMapDisplayDesc,
  bidKingBidMapDisplayName,
  bidKingItemDisplayName,
  bidKingSkillDisplayName,
  dropsForGroup,
  getBidKingCloseThreshold,
  Hero,
  Item,
  itemById,
  itemFootprint,
  RankMap,
  Skill,
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
import { bidKingHighestConfiguredMinimumBidForBidMap } from './initialCashRuntime';

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
  roundIndex: number
): Clue[] {
  return [buildBidKingSkillClue(core, state, player, roundIndex, 'auto')].filter((clue): clue is Clue => Boolean(clue));
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
      entries.push({
        id: `${round.id}_map_skill_${mapSkill.id}`,
        round: roundNumber,
        source: 'map',
        sourceName: bidMapName,
        skillName: mapSkillName,
        text: `${bidMapName}触发${mapSkillName}，本轮公共情报与仓库可见格更新。`,
        iconKey: mapSkill.skill_icon || bidMap.art_key,
        visibility: 'public',
        createdAt: now
      });
    }
  }

  for (const player of state.players) {
    const hero = heroForPlayer(player);
    const skill = skillForHero(hero, round.index);
    const skillName = bidKingSkillDisplayName(skill);
    const clue = player.privateClues.find((candidate) => (
      candidate.id.includes(`_auto_${player.id}_${roundNumber}_${hero.id}_${skill.id}`)
    ));
    entries.push({
      id: `${round.id}_hero_skill_${player.id}_${skill.id}`,
      round: roundNumber,
      playerId: player.id,
      source: 'hero',
      sourceName: hero.packaged_name,
      skillName,
      text: clue?.text ?? `${hero.packaged_name}触发${skillName}，获得一条专属情报。`,
      iconKey: skill.skill_icon,
      visibility: 'private',
      targetItemIds: clue?.targetItemIds ?? (clue?.targetItemId ? [clue.targetItemId] : undefined),
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
  const hero = heroForPlayer(player);
  const skill = skillForHero(hero, round.index);
  const clue = buildBidKingSkillClue(round.container, state, player, round.index, 'manual', targetPlayerId);
  return {
    clue,
    publishTo: 'private',
    insuranceActive: false,
    cooldownRounds: Math.max(1, skill.skill_CD)
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
  const hero = heroForPlayer(player);
  const skill = skillForHero(hero, round.index);
  const skillName = bidKingSkillDisplayName(skill);
  return {
    id: `${round.id}_manual_skill_${player.id}_${skill.id}_${round.skillFeed.length + 1}`,
    round: round.index + 1,
    playerId: player.id,
    source: 'manual',
    sourceName: hero.packaged_name,
    skillName,
    text: clue?.text ?? `${hero.packaged_name}使用${skillName}，获得一条专属情报。`,
    iconKey: skill.skill_icon,
    visibility: 'private',
    targetItemIds: clue?.targetItemIds ?? (clue?.targetItemId ? [clue.targetItemId] : undefined),
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
  const grouped = weightedBidMapGroup(requested, state);
  if (grouped) {
    return grouped;
  }
  if (requested.bidder_number === state.players.length || eligible.length === 0) {
    return requested;
  }
  return state.rng.pick(eligible);
}

function weightedBidMapGroup(selected: BidKingBidMapRow, state: MatchRuntimeState): BidKingBidMapRow | undefined {
  const weightedRows = selected.map_group
    .filter((entry) => (entry[0] ?? 0) > 0 && (entry[1] ?? 0) > 0)
    .map((entry) => {
      const row = BidMap.find((candidate) => candidate.id === entry[0] && candidate.is_visiable === 1);
      return row ? { item: row, weight: entry[1] ?? 0 } : undefined;
    })
    .filter((entry): entry is { item: BidKingBidMapRow; weight: number } => Boolean(entry))
    .filter((entry) => entry.item.bidder_number === state.players.length);
  if (weightedRows.length === 0) {
    return undefined;
  }
  return state.rng.weighted(weightedRows);
}

function eligibleBidMapsForPlayerCount(playerCount: number, maxMinimumBid?: number): BidKingBidMapRow[] {
  const visible = BidMap.filter((row) => row.is_visiable === 1 && row.auction_rounds_rate.some((rate) => rate > 0));
  const exact = visible.filter((row) => row.bidder_number === playerCount);
  if (exact.length > 0) {
    const affordable = maxMinimumBid === undefined
      ? exact
      : exact.filter((row) => bidKingHighestConfiguredMinimumBidForBidMap(row.id) <= maxMinimumBid);
    return affordable.length > 0 ? affordable : exact;
  }
  const multiplayer = visible.filter((row) => row.bidder_number > 1);
  if (multiplayer.length > 0) {
    const affordable = maxMinimumBid === undefined
      ? multiplayer
      : multiplayer.filter((row) => bidKingHighestConfiguredMinimumBidForBidMap(row.id) <= maxMinimumBid);
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
  const [routeType, routeGroupId, routeMin, routeMax] = bidMap.drop_group_id;
  const fallbackItems = Item.filter((item) => item.drop_group_id === routeGroupId);
  const count = state.rng.int(bidMap.item_count_min, bidMap.item_count_max);
  return Array.from({ length: count }, (_, index) => {
    const drop = routeType === 9999 && routeGroupId !== undefined
      ? pickDropLeaf(state, routeGroupId)
      : directDropFromRoute(routeGroupId, routeMin, routeMax);
    const item = drop
      ? itemById(drop.item_id)
      : fallbackItems[index % Math.max(1, fallbackItems.length)];
    const row = item ?? Item[((routeGroupId ?? bidMap.id) * 11 + index * 17) % Item.length]!;
    return toRevealedItem(row, index);
  });
}

function directDropFromRoute(itemId: number | undefined, minCount?: number, maxCount?: number): BidKingDropItemRow | undefined {
  if (itemId === undefined) {
    return undefined;
  }
  return {
    item_type: 0,
    item_id: itemId,
    min_count: minCount ?? 1,
    max_count: maxCount ?? minCount ?? 1,
    drop_weight: 1
  };
}

function pickDropLeaf(state: MatchRuntimeState, groupId: number, depth = 0): BidKingDropItemRow | undefined {
  if (depth > 8) {
    return undefined;
  }
  const drops = dropsForGroup(groupId);
  if (drops.length === 0) {
    return undefined;
  }
  const selected = state.rng.weighted(drops.map((row) => ({ item: row, weight: row.drop_weight })));
  if (selected.item_type === 9999) {
    return pickDropLeaf(state, selected.item_id, depth + 1);
  }
  return selected;
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
  _targetPlayerId?: string
): Clue | undefined {
  const hero = heroForPlayer(player);
  const skill = skillForHero(hero, roundIndex);
  const effect = effectForSkill(skill);
  const clueId = `${core.id}_${trigger}_${player.id}_${roundIndex + 1}_${hero.id}_${skill.id}`;
  const selectedSlots = selectSlotsBySkill(core, state, skill, trigger);
  const scanSlots = selectedSlots.slice(0, trigger === 'manual' ? 3 : 2);
  const skillName = bidKingSkillDisplayName(skill);

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
      targetItemIds: scanSlots.map((slot) => slot.item.id),
      source: 'skill',
      isTruthful: true
    };
  }

  if ([5, 6].includes(effect.Category)) {
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
      targetItemIds: [target.item.id],
      valueHint: {
        min: Math.max(1000, Math.round(target.item.value * 0.9)),
        max: Math.max(2000, Math.round(target.item.value * 1.1))
      },
      source: 'skill',
      isTruthful: true
    };
  }

  if ([7, 12].includes(effect.Category)) {
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
      targetItemIds: [target.item.id],
      source: 'skill',
      isTruthful: true
    };
  }

  if ([1, 11, 22].includes(effect.Category)) {
    const targets = scanSlots.length > 0 ? scanSlots : shuffleByRng(core.warehouseSlots, state).slice(0, trigger === 'manual' ? 3 : 2);
    return {
      id: clueId,
      kind: 'category',
      text: `${hero.packaged_name}·${skillName}：揭示 ${targets.length} 个命中格的占位轮廓。`,
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
      text: `${hero.packaged_name}·${skillName}：揭示一个命中格的品类，属于${target.item.category}。`,
      accuracy: 0.86,
      targetItemId: target.item.id,
      targetItemIds: [target.item.id],
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

function heroForPlayer(player: RuntimePlayer) {
  return Hero[player.seat % Hero.length]!;
}

function skillForHero(hero: ReturnType<typeof heroForPlayer>, roundIndex: number) {
  const castIds = hero.cast_type.filter((id) => id > 0);
  const indexedId = castIds[Math.min(Math.max(0, roundIndex), Math.max(0, castIds.length - 1))];
  return (indexedId ? skillById(indexedId) : undefined)
    ?? castIds.map((id) => skillById(id)).find((skill): skill is BidKingSkillRow => Boolean(skill))
    ?? Skill[0]!;
}

function effectForSkill(skill: BidKingSkillRow): BidKingSkillEffectRow {
  const effectId = skill.skilleffect_position[0] ?? 1000;
  return skillEffectById(effectId) ?? { EffectId: 1000, Category: 1, Param: [0], effect_key: 'category_1', effect_desc: '显示轮廓尺寸' };
}

function selectSlotsBySkill(
  core: ContainerInstance,
  state: MatchRuntimeState,
  skill: BidKingSkillRow,
  trigger: 'auto' | 'manual'
): WarehouseSlot[] {
  const targetCount = skill.skill_count === 0 ? 999 : skill.skill_count;
  let slots = slotsByTarget(core.warehouseSlots, state, skill.skilltarget, skill.skilltargetvalue, targetCount);
  slots = applySecondaryTarget(slots, skill.skilltarget2, skill.skilltargetvalue2);
  slots = applySecondaryTarget(slots, skill.skilltarget3, skill.skilltargetvalue3);
  if (slots.length === 0) {
    slots = shuffleByRng(core.warehouseSlots, state);
  }
  const limit = targetCount === 999 ? (trigger === 'manual' ? slots.length : Math.min(2, slots.length)) : targetCount;
  return slots.slice(0, Math.max(1, limit));
}

function slotsByTarget(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  targetType: number,
  values: readonly number[],
  targetCount: number
): WarehouseSlot[] {
  if (targetType === 0) {
    return shuffleByRng(slots, state);
  }
  if (targetType === 1) {
    return slots.filter((slot) => {
      const row = itemRowForSlot(slot);
      return row ? values.some((value) => row.item_type_ids.includes(value)) : false;
    });
  }
  if (targetType === 2) {
    return slots.filter((slot) => {
      const row = itemRowForSlot(slot);
      return row ? values.includes(row.item_quality) : false;
    });
  }
  if (targetType === 3) {
    return slots.filter((slot) => {
      const row = itemRowForSlot(slot);
      return row ? values.includes(row.id) : false;
    });
  }
  if (targetType === 4) {
    const typeId = weightedTargetValue(values, state, [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
    return slots.filter((slot) => itemRowForSlot(slot)?.item_type_ids.includes(typeId));
  }
  if (targetType === 5) {
    const quality = weightedTargetValue(values, state, [1, 2, 3, 4, 5, 6]);
    return slots.filter((slot) => itemRowForSlot(slot)?.item_quality === quality);
  }
  if (targetType === 6) {
    const filterType = values[0] ?? 3;
    const isMax = values[1] === 1;
    const sorted = [...slots].sort((left, right) => {
      const diff = filterValueForSlot(right, slots, filterType) - filterValueForSlot(left, slots, filterType);
      return isMax ? diff : -diff;
    });
    if (targetCount === 999 && sorted[0]) {
      const best = filterValueForSlot(sorted[0], slots, filterType);
      return sorted.filter((slot) => filterValueForSlot(slot, slots, filterType) === best);
    }
    return sorted;
  }
  if (targetType === 10) {
    return filterSlotsByShape(slots, values);
  }
  return shuffleByRng(slots, state);
}

function applySecondaryTarget(slots: WarehouseSlot[], targetType: number, values: readonly number[]): WarehouseSlot[] {
  if (targetType === 0 || slots.length === 0) {
    return slots;
  }
  if (targetType === 1) {
    return slots.filter((slot) => {
      const row = itemRowForSlot(slot);
      return row ? values.some((value) => row.item_type_ids.includes(value)) : false;
    });
  }
  if (targetType === 2) {
    return slots.filter((slot) => {
      const row = itemRowForSlot(slot);
      return row ? values.includes(row.item_quality) : false;
    });
  }
  if (targetType === 10) {
    return filterSlotsByShape(slots, values);
  }
  return slots;
}

function filterSlotsByShape(slots: readonly WarehouseSlot[], values: readonly number[]): WarehouseSlot[] {
  const [w, h, area] = values;
  return slots.filter((slot) => {
    const footprintArea = slot.item.footprint.w * slot.item.footprint.h;
    return (w === undefined || w === 0 || slot.item.footprint.w === w)
      && (h === undefined || h === 0 || slot.item.footprint.h === h)
      && (area === undefined || area === 0 || footprintArea === area);
  });
}

function weightedTargetValue(values: readonly number[], state: MatchRuntimeState, fallback: readonly number[]): number {
  if (values.length <= 1 && (values[0] ?? 0) === 0) {
    return state.rng.pick([...fallback]);
  }
  const pairs: Array<{ item: number; weight: number }> = [];
  for (let index = 0; index < values.length; index += 2) {
    const value = values[index];
    const weight = values[index + 1] ?? 1;
    if (value && weight > 0) {
      pairs.push({ item: value, weight });
    }
  }
  return pairs.length > 0 ? state.rng.weighted(pairs) : state.rng.pick([...fallback]);
}

function filterValueForSlot(slot: WarehouseSlot, allSlots: readonly WarehouseSlot[], filterType: number): number {
  const row = itemRowForSlot(slot);
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
    return Math.round(row.base_value / Math.max(1, slot.item.footprint.w * slot.item.footprint.h));
  }
  if (filterType === 5) {
    return allSlots.filter((candidate) => itemRowForSlot(candidate)?.id === row.id).length;
  }
  if (filterType === 6) {
    return allSlots.filter((candidate) => itemRowForSlot(candidate)?.item_type_id === row.item_type_id).length;
  }
  if (filterType === 7) {
    return allSlots.filter((candidate) => itemRowForSlot(candidate)?.item_quality === row.item_quality).length;
  }
  return row.base_value;
}

function itemRowForSlot(slot: WarehouseSlot): BidKingItemRow | undefined {
  const match = /^compat_(\d+)_/.exec(slot.item.id);
  const itemId = match?.[1] ? Number(match[1]) : undefined;
  return itemId ? itemById(itemId) : undefined;
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
  const columns = 8;
  let x = 0;
  let y = 0;
  let rowHeight = 1;
  return items.map((item, index) => {
    const w = Math.max(1, Math.min(6, item.footprint.w));
    const h = Math.max(1, Math.min(5, item.footprint.h));
    if (x + w > columns) {
      x = 0;
      y += rowHeight;
      rowHeight = 1;
    }
    const slot = {
      slotId: `slot_${index + 1}`,
      item,
      x,
      y,
      w,
      h
    };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return slot;
  });
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
