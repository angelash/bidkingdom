import {
  Skill,
  SkillGroup,
  bidKingBattleItemDisplayName,
  bidKingSkillDisplayName,
  itemById,
  skillById,
  skillEffectById
} from '@bitkingdom/bidking-compat';
import type { BidKingBattleItemRow, BidKingSkillEffectRow, BidKingSkillGroupRow, BidKingSkillRow } from '@bitkingdom/bidking-compat';
import type { Clue, SkillFeedEntry } from '@bitkingdom/shared';
import { pushEvent, requirePlayer, requireRound } from './match';
import type { MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from './types';

export type BattleItemRevealKind = 'value' | 'risk' | 'category' | 'quality' | 'quantity' | 'footprint' | 'identity';
export type BattleItemTargetMode = 'skill_target' | 'highest_value' | 'risk_first' | 'largest_slots';
export type BattleItemEffectImplementationStatus = 'implemented' | 'simplified';

export interface BattleItemEffectPlan {
  itemId: number;
  battleItemType: number;
  skillGroupId: number;
  skillId?: number;
  skillName?: string;
  skillTarget: number;
  skillTargetValue: readonly number[];
  secondaryTargets: readonly {
    target: number;
    values: readonly number[];
  }[];
  skillCountType?: number;
  requestedTargetCount: number;
  targetCount: number;
  durationRounds: number;
  cooldownRounds: number;
  effectId?: number;
  effectCategory?: number;
  effectKey?: string;
  effectName?: string;
  revealKind: BattleItemRevealKind;
  targetMode: BattleItemTargetMode;
  targetPlayerRequired: boolean;
  valueHint: boolean;
  riskHint: boolean;
  categoryHint: boolean;
  qualityHint: boolean;
  quantityHint: boolean;
  identityHint: boolean;
  implementationStatus: BattleItemEffectImplementationStatus;
  description: string;
}

export function useBattleItem(
  state: MatchRuntimeState,
  playerId: string,
  item: BidKingBattleItemRow,
  now = Date.now(),
  targetPlayerId?: string
): MatchRuntimeState {
  const { round, player, skillContext, effectPlan, targetPlayer } = prepareBattleItemUse(state, playerId, item, targetPlayerId);
  let clue = buildBattleItemClue(state, playerId, item, skillContext, effectPlan, now);
  if (targetPlayer) {
    clue = {
      ...clue,
      text: `${clue.text} 目标玩家：${targetPlayer.name}。`
    };
  }
  player.privateClues.push(clue);
  round.container.privateCluesByPlayerId[player.id] = [
    ...(round.container.privateCluesByPlayerId[player.id] ?? []),
    clue
  ];
  const cooldownRemaining = applyBattleItemCooldown(player, item.id, effectPlan.cooldownRounds);
  const itemName = bidKingBattleItemDisplayName(item);
  const entry: SkillFeedEntry = {
    id: `${round.id}_battle_item_${player.id}_${item.id}_${round.skillFeed.length + 1}`,
    round: round.index + 1,
    playerId: player.id,
    source: 'item',
    sourceName: itemName,
    skillName: battleItemEffectName(item, skillContext),
    skillCid: skillContext.skill?.id,
    effectId: skillContext.effect?.EffectId,
    effectCategory: skillContext.effect?.Category,
    effectKey: skillContext.effect?.effect_key,
    effectName: skillContext.effect?.effect_desc,
    skillTarget: skillContext.skill?.skilltarget,
    targetCount: effectPlan.targetCount,
    text: clue.text,
    visibility: 'private',
    targetItemIds: clue.targetItemIds ?? (clue.targetItemId ? [clue.targetItemId] : undefined),
    createdAt: now
  };
  round.skillFeed.push(entry);
  state.updatedAt = now;
  pushEvent(state, 'battle_item_used', playerId, {
    roundId: round.id,
    itemId: item.id,
    skillGroup: item.skill_group,
    skillId: skillContext.skill?.id,
    effectCategory: skillContext.effect?.Category,
    effectPlan,
    targetPlayerId: targetPlayer?.id,
    targetPlayerName: targetPlayer?.name,
    cooldownRemaining,
    clue,
    entry
  }, now);
  return state;
}

export function battleItemCooldownRemaining(state: MatchRuntimeState, playerId: string, itemId: number): number {
  return battleItemCooldownRemainingForPlayer(requirePlayer(state, playerId), itemId);
}

interface BattleItemUseRuntime {
  round: RuntimeRound;
  player: RuntimePlayer;
  skillContext: BattleItemSkillContext;
  effectPlan: BattleItemEffectPlan;
  targetPlayer?: RuntimePlayer;
}

function prepareBattleItemUse(
  state: MatchRuntimeState,
  playerId: string,
  item: BidKingBattleItemRow,
  targetPlayerId?: string
): BattleItemUseRuntime {
  const round = requireRound(state);
  const player = requirePlayer(state, playerId);
  if (!['intel', 'auction'].includes(round.phase)) {
    throw new Error('Battle items are only allowed during intel or auction phase');
  }
  if (round.phase === 'auction' && (player.hasSubmittedBid || round.bids.some((bid) => bid.playerId === playerId))) {
    throw new Error('Battle items must be used before bidding');
  }
  const cooldownRemaining = battleItemCooldownRemainingForPlayer(player, item.id);
  if (cooldownRemaining > 0) {
    throw new Error(`Battle item is on cooldown for ${cooldownRemaining} round(s)`);
  }

  const skillContext = battleItemSkillContext(state, item);
  const effectPlan = battleItemEffectPlanForItem(item, skillContext);
  const targetPlayer = targetPlayerId ? state.players.find((candidate) => candidate.id === targetPlayerId) : undefined;
  if (effectPlan.targetPlayerRequired && !targetPlayer) {
    throw new Error('Battle item requires a target player');
  }
  if (targetPlayer && targetPlayer.id === playerId) {
    throw new Error('Battle item target must be another player');
  }
  return {
    round,
    player,
    skillContext,
    effectPlan,
    targetPlayer
  };
}

function battleItemCooldownRemainingForPlayer(player: RuntimePlayer, itemId: number): number {
  return Math.max(0, Math.floor(player.battleItemCooldowns[String(itemId)] ?? 0));
}

function applyBattleItemCooldown(player: RuntimePlayer, itemId: number, cooldownRounds: number): number {
  const key = String(itemId);
  const cooldown = Math.max(0, Math.floor(cooldownRounds));
  if (cooldown <= 0) {
    delete player.battleItemCooldowns[key];
    return 0;
  }
  player.battleItemCooldowns[key] = cooldown;
  return cooldown;
}

export interface BattleItemSkillContext {
  skill?: BidKingSkillRow;
  effect?: BidKingSkillEffectRow;
}

export function skillGroupForBattleItem(item: BidKingBattleItemRow): BidKingSkillGroupRow | undefined {
  const direct = SkillGroup.find((row) => row.groupid === item.skill_group || row.groupid === item.skill_group + 100);
  if (direct) {
    return direct;
  }
  const fallbackGroupIds = SkillGroup.map((row) => row.groupid).sort((left, right) => left - right);
  if (fallbackGroupIds.length === 0) {
    return undefined;
  }
  const fallbackGroupId = fallbackGroupIds[Math.max(0, item.battle_item_type - 1) % fallbackGroupIds.length]!;
  return SkillGroup.find((row) => row.groupid === fallbackGroupId);
}

export function battleItemEffectPlanForItem(
  item: BidKingBattleItemRow,
  skillContext: BattleItemSkillContext = battleItemSkillContext(undefined, item)
): BattleItemEffectPlan {
  const skill = skillContext.skill;
  const effect = skillContext.effect;
  const requestedTargetCount = skill?.skill_count && skill.skill_count > 0
    ? skill.skill_count
    : 1 + Math.floor(item.item_quality / 3);
  const targetCount = Math.max(1, Math.min(3, requestedTargetCount));
  const effectCategory = effect?.Category;
  const revealKind = battleItemRevealKind(item, effectCategory);
  const targetMode = battleItemTargetMode(item, revealKind, skill);
  const plan: BattleItemEffectPlan = {
    itemId: item.id,
    battleItemType: item.battle_item_type,
    skillGroupId: item.skill_group,
    skillId: skill?.id,
    skillName: skill ? bidKingSkillDisplayName(skill) : undefined,
    skillTarget: skill?.skilltarget ?? 0,
    skillTargetValue: skill?.skilltargetvalue ?? [0],
    secondaryTargets: [
      { target: skill?.skilltarget2 ?? 0, values: skill?.skilltargetvalue2 ?? [0] },
      { target: skill?.skilltarget3 ?? 0, values: skill?.skilltargetvalue3 ?? [0] }
    ],
    skillCountType: skill?.skill_count_type,
    requestedTargetCount,
    targetCount,
    durationRounds: Math.max(0, skill?.skill_round ?? 0),
    cooldownRounds: Math.max(0, skill?.skill_CD ?? 0),
    effectId: effect?.EffectId,
    effectCategory,
    effectKey: effect?.effect_key,
    effectName: effect?.effect_desc,
    revealKind,
    targetMode,
    targetPlayerRequired: Boolean(skill && [7, 8, 9].includes(skill.skilltarget)),
    valueHint: revealKind === 'value',
    riskHint: revealKind === 'risk',
    categoryHint: revealKind === 'category',
    qualityHint: revealKind === 'quality',
    quantityHint: revealKind === 'quantity' || revealKind === 'footprint',
    identityHint: revealKind === 'identity',
    implementationStatus: battleItemEffectImplementationStatus(revealKind, effectCategory),
    description: battleItemEffectDescription(item, skill, effect, revealKind, targetCount)
  };
  return plan;
}

function buildBattleItemClue(
  state: MatchRuntimeState,
  playerId: string,
  item: BidKingBattleItemRow,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan,
  now: number
): Clue {
  const round = requireRound(state);
  const targets = battleItemTargets(state, skillContext, effectPlan);
  const targetItems = targets.map((slot) => slot.item);
  const prefix = `battle_item_${item.id}_${playerId}_${round.index}_${now}`;
  const itemName = bidKingBattleItemDisplayName(item);
  const skillName = skillContext.skill ? bidKingSkillDisplayName(skillContext.skill) : undefined;
  if (effectPlan.revealKind === 'value') {
    const totalValue = targetItems.reduce((sum, target) => sum + target.value, 0);
    return {
      id: prefix,
      kind: 'value',
      text: `${itemName}·${skillName ?? '掌眼'}：锁定 ${targetItems.length} 个格位，估值约 ${Math.round(totalValue * 0.9).toLocaleString()} ～ ${Math.round(totalValue * 1.12).toLocaleString()}。`,
      accuracy: Math.min(0.96, 0.68 + item.item_quality * 0.045),
      targetItemIds: targetItems.map((target) => target.id),
      valueHint: {
        min: Math.round(totalValue * 0.9),
        max: Math.round(totalValue * 1.12)
      },
      source: 'skill',
      isTruthful: true
    };
  }
  const target = targetItems[0] ?? round.container.hiddenItems[0]!;
  if (effectPlan.revealKind === 'identity') {
    return {
      id: prefix,
      kind: 'category',
      text: `${itemName}·${skillName ?? '辨形'}：显示藏品本体，${target.name}，${target.category}，品质接近${target.rarity}。`,
      accuracy: Math.min(0.97, 0.7 + item.item_quality * 0.045),
      targetItemId: target.id,
      targetItemIds: [target.id],
      riskHint: target.isFake ? 'fake' : target.repairCost > 0 ? 'repair' : 'safe',
      source: 'skill',
      isTruthful: true
    };
  }
  const riskHint = target.isFake ? 'fake' : target.repairCost > 0 ? 'repair' : 'safe';
  return {
    id: prefix,
    kind: effectPlan.revealKind === 'risk' ? 'risk' : 'category',
    text: effectPlan.revealKind === 'risk'
      ? `${itemName}·${skillName ?? '验伪'}：命中格位风险为${riskHint === 'fake' ? '赝品风险' : riskHint === 'repair' ? '修复风险' : '安全'}，品类 ${target.category}。`
      : battleItemClueTextForPlan(item, skillContext, effectPlan, target),
    accuracy: Math.min(0.95, 0.62 + item.item_quality * 0.05),
    targetItemId: target.id,
    riskHint,
    source: 'skill',
    isTruthful: true
  };
}

function battleItemTargets(
  state: MatchRuntimeState,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan
): WarehouseSlot[] {
  const round = requireRound(state);
  const count = effectPlan.targetCount;
  const skill = skillContext.skill;
  let slots = skill
    ? slotsByBattleItemSkillTarget(round.container.warehouseSlots, state, skill, effectPlan)
    : [...round.container.warehouseSlots];
  if (slots.length === 0) {
    slots = [...round.container.warehouseSlots];
  }
  if (effectPlan.targetMode === 'highest_value') {
    return slots.sort((left, right) => right.item.value - left.item.value).slice(0, count);
  }
  if (effectPlan.targetMode === 'risk_first') {
    const risky = slots
      .filter((slot) => slot.item.isFake || slot.item.repairCost > 0)
      .sort((left, right) => Number(right.item.isFake) - Number(left.item.isFake) || right.item.repairCost - left.item.repairCost);
    return (risky.length > 0 ? risky : slots.sort((left, right) => right.item.value - left.item.value)).slice(0, count);
  }
  return slots.sort((left, right) => (right.w * right.h) - (left.w * left.h)).slice(0, count);
}

function battleItemSkillContext(state: MatchRuntimeState | undefined, item: BidKingBattleItemRow): BattleItemSkillContext {
  const group = skillGroupForBattleItem(item);
  const candidates = group?.skill_group
    .map(([skillId, weight]) => ({ item: skillById(skillId), weight }))
    .filter((candidate): candidate is { item: BidKingSkillRow; weight: number } => Boolean(candidate.item));
  const weighted = candidates?.filter((candidate) => candidate.weight > 0) ?? [];
  const skill = resolveBattleItemSkill(state, item, candidates, weighted);
  const effectId = skill?.skilleffect_position[0];
  return {
    skill,
    effect: effectId ? skillEffectById(effectId) : undefined
  };
}

function resolveBattleItemSkill(
  state: MatchRuntimeState | undefined,
  item: BidKingBattleItemRow,
  candidates: { item: BidKingSkillRow; weight: number }[] | undefined,
  weighted: { item: BidKingSkillRow; weight: number }[]
): BidKingSkillRow {
  if (state && weighted.length > 0) {
    return state.rng.weighted(weighted);
  }
  if (state && candidates && candidates.length > 0) {
    return state.rng.weighted(candidates.map((candidate) => ({ ...candidate, weight: 1 })));
  }
  return weighted[0]?.item
    ?? candidates?.[0]?.item
    ?? Skill.find((candidate) => Number(candidate.skill_group) === item.skill_group || Number(candidate.skill_group) === item.skill_group + 100)
    ?? Skill[0]!;
}

function battleItemEffectName(item: BidKingBattleItemRow, skillContext: BattleItemSkillContext): string {
  if (skillContext.skill) {
    const skillName = bidKingSkillDisplayName(skillContext.skill);
    return skillContext.effect
      ? `${skillName} · ${skillContext.effect.effect_desc}`
      : skillName;
  }
  if (item.battle_item_type === 2) {
    return '估值掌眼';
  }
  if (item.battle_item_type === 3) {
    return '风险验伪';
  }
  return '格位侦察';
}

function battleItemRevealKind(item: BidKingBattleItemRow, effectCategory: number | undefined): BattleItemRevealKind {
  if (effectCategory !== undefined) {
    if ([5, 8, 9, 10, 14].includes(effectCategory)) {
      return 'value';
    }
    if ([2, 3, 4, 11].includes(effectCategory)) {
      return 'quantity';
    }
    if ([7, 12].includes(effectCategory)) {
      return 'quality';
    }
    if (effectCategory === 6) {
      return 'identity';
    }
    if ([1, 22].includes(effectCategory)) {
      return 'footprint';
    }
    if ([13].includes(effectCategory)) {
      return 'category';
    }
  }
  if (item.battle_item_type === 2) {
    return 'value';
  }
  if (item.battle_item_type === 3) {
    return 'risk';
  }
  return 'category';
}

function battleItemTargetMode(
  item: BidKingBattleItemRow,
  revealKind: BattleItemRevealKind,
  skill: BidKingSkillRow | undefined
): BattleItemTargetMode {
  if (skill && skill.skilltarget !== 0) {
    return 'skill_target';
  }
  if (revealKind === 'value' || item.battle_item_type === 2) {
    return 'highest_value';
  }
  if (revealKind === 'risk' || item.battle_item_type === 3) {
    return 'risk_first';
  }
  return 'largest_slots';
}

function battleItemEffectImplementationStatus(
  revealKind: BattleItemRevealKind,
  effectCategory: number | undefined
): BattleItemEffectImplementationStatus {
  const directlyImplemented = effectCategory === undefined
    || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 22].includes(effectCategory);
  return directlyImplemented && revealKind !== 'category' ? 'implemented' : 'simplified';
}

function battleItemEffectDescription(
  item: BidKingBattleItemRow,
  skill: BidKingSkillRow | undefined,
  effect: BidKingSkillEffectRow | undefined,
  revealKind: BattleItemRevealKind,
  targetCount: number
): string {
  const itemName = bidKingBattleItemDisplayName(item);
  const skillName = skill ? bidKingSkillDisplayName(skill) : '默认试宝情报';
  const effectName = effect?.effect_desc ?? '按试宝令类型生成情报';
  const duration = skill && skill.skill_round > 0 ? `，持续 ${skill.skill_round} 回合` : '';
  const cooldown = skill && skill.skill_CD > 0 ? `，冷却 ${skill.skill_CD} 回合` : '';
  return `${itemName} 使用 ${skillName}/${effectName}，揭示 ${targetCount} 个目标的${battleItemRevealLabel(revealKind)}${duration}${cooldown}`;
}

function battleItemRevealLabel(revealKind: BattleItemRevealKind): string {
  if (revealKind === 'value') {
    return '估值';
  }
  if (revealKind === 'risk') {
    return '风险';
  }
  if (revealKind === 'quality') {
    return '品质';
  }
  if (revealKind === 'quantity') {
    return '数量';
  }
  if (revealKind === 'footprint') {
    return '轮廓';
  }
  if (revealKind === 'identity') {
    return '藏品本体';
  }
  return '品类';
}

function battleItemClueTextForPlan(
  item: BidKingBattleItemRow,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan,
  target: WarehouseSlot['item']
): string {
  const itemName = bidKingBattleItemDisplayName(item);
  const skillName = skillContext.skill ? bidKingSkillDisplayName(skillContext.skill) : '格位侦察';
  if (effectPlan.revealKind === 'quality') {
    return `${itemName}·${skillName}：命中格位品质接近${target.rarity}，品类 ${target.category}。`;
  }
  if (effectPlan.revealKind === 'quantity') {
    return `${itemName}·${skillName}：命中格位占用 ${target.footprint.w * target.footprint.h} 格，尺寸 ${target.footprint.w}x${target.footprint.h}。`;
  }
  if (effectPlan.revealKind === 'footprint') {
    return `${itemName}·${skillName}：命中格位轮廓 ${target.footprint.w}x${target.footprint.h}，品类 ${target.category}。`;
  }
  if (effectPlan.revealKind === 'identity') {
    return `${itemName}·${skillName}：显示藏品本体，${target.name}，${target.category}，品质接近${target.rarity}。`;
  }
  return `${itemName}·${skillName}：命中格位属于${target.category}，品质接近${target.rarity}。`;
}

function slotsByBattleItemSkillTarget(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  skill: BidKingSkillRow,
  effectPlan: BattleItemEffectPlan
): WarehouseSlot[] {
  let filtered = applyBattleItemTarget(slots, state, skill.skilltarget, skill.skilltargetvalue, effectPlan);
  filtered = applyBattleItemSecondaryTarget(filtered, skill.skilltarget2, skill.skilltargetvalue2);
  filtered = applyBattleItemSecondaryTarget(filtered, skill.skilltarget3, skill.skilltargetvalue3);
  return filtered.length > 0 ? filtered : [...slots];
}

function applyBattleItemTarget(
  slots: readonly WarehouseSlot[],
  state: MatchRuntimeState,
  targetType: number,
  values: readonly number[],
  effectPlan: BattleItemEffectPlan
): WarehouseSlot[] {
  if (targetType === 0) {
    return shuffleBattleItemSlots(slots, state);
  }
  if (targetType === 1) {
    return slots.filter((slot) => values.some((value) => itemRowForBattleItemSlot(slot)?.item_type_ids.includes(value)));
  }
  if (targetType === 2) {
    return slots.filter((slot) => values.includes(itemRowForBattleItemSlot(slot)?.item_quality ?? -1));
  }
  if (targetType === 3) {
    return slots.filter((slot) => values.includes(numericItemIdForBattleItemSlot(slot) ?? -1));
  }
  if (targetType === 4) {
    const typeId = weightedBattleItemTargetValue(values, state, [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
    return slots.filter((slot) => itemRowForBattleItemSlot(slot)?.item_type_ids.includes(typeId));
  }
  if (targetType === 5) {
    const quality = weightedBattleItemTargetValue(values, state, [1, 2, 3, 4, 5, 6]);
    return slots.filter((slot) => itemRowForBattleItemSlot(slot)?.item_quality === quality);
  }
  if (targetType === 6) {
    return sortBattleItemSlotsByFilter(slots, values, effectPlan);
  }
  if (targetType === 10) {
    return filterBattleItemSlotsByShape(slots, values);
  }
  return shuffleBattleItemSlots(slots, state);
}

function applyBattleItemSecondaryTarget(
  slots: WarehouseSlot[],
  targetType: number,
  values: readonly number[]
): WarehouseSlot[] {
  if (targetType === 0 || slots.length === 0) {
    return slots;
  }
  if (targetType === 1) {
    return slots.filter((slot) => values.some((value) => itemRowForBattleItemSlot(slot)?.item_type_ids.includes(value)));
  }
  if (targetType === 2) {
    return slots.filter((slot) => values.includes(itemRowForBattleItemSlot(slot)?.item_quality ?? -1));
  }
  if (targetType === 3) {
    return slots.filter((slot) => values.includes(numericItemIdForBattleItemSlot(slot) ?? -1));
  }
  if (targetType === 10) {
    return filterBattleItemSlotsByShape(slots, values);
  }
  return slots;
}

function sortBattleItemSlotsByFilter(
  slots: readonly WarehouseSlot[],
  values: readonly number[],
  effectPlan: BattleItemEffectPlan
): WarehouseSlot[] {
  const filterType = values[0] ?? (effectPlan.valueHint ? 3 : 1);
  const isMax = values[1] !== 2;
  return [...slots].sort((left, right) => {
    const diff = battleItemFilterValue(right, filterType) - battleItemFilterValue(left, filterType);
    return isMax ? diff : -diff;
  });
}

function battleItemFilterValue(slot: WarehouseSlot, filterType: number): number {
  if (filterType === 1) {
    return slot.item.footprint.w * slot.item.footprint.h;
  }
  if (filterType === 2) {
    return itemRowForBattleItemSlot(slot)?.item_quality ?? 0;
  }
  if (filterType === 3) {
    return slot.item.value;
  }
  if (filterType === 4) {
    return slot.item.isFake ? 1 : 0;
  }
  return slot.item.value;
}

function itemRowForBattleItemSlot(slot: WarehouseSlot): ReturnType<typeof itemById> {
  const itemId = numericItemIdForBattleItemSlot(slot);
  return itemId ? itemById(itemId) : undefined;
}

function numericItemIdForBattleItemSlot(slot: WarehouseSlot): number | undefined {
  const match = /^compat_(\d+)_/.exec(slot.item.id);
  return match?.[1] ? Number(match[1]) : undefined;
}

function filterBattleItemSlotsByShape(slots: readonly WarehouseSlot[], values: readonly number[]): WarehouseSlot[] {
  const [w, h, area] = values;
  return slots.filter((slot) => {
    const footprintArea = slot.item.footprint.w * slot.item.footprint.h;
    return (w === undefined || w === 0 || slot.item.footprint.w === w)
      && (h === undefined || h === 0 || slot.item.footprint.h === h)
      && (area === undefined || area === 0 || footprintArea === area);
  });
}

function weightedBattleItemTargetValue(
  values: readonly number[],
  state: MatchRuntimeState,
  fallback: readonly number[]
): number {
  if (values.length <= 1 && (values[0] ?? 0) === 0) {
    return state.rng.pick([...fallback]);
  }
  const pairs: Array<{ item: number; weight: number }> = [];
  for (let index = 0; index < values.length; index += 2) {
    const value = values[index];
    const weight = values[index + 1] ?? 1;
    if (value !== undefined && value > 0 && weight > 0) {
      pairs.push({ item: value, weight });
    }
  }
  if (pairs.length === 0) {
    return state.rng.pick([...fallback]);
  }
  return state.rng.weighted(pairs);
}

function shuffleBattleItemSlots(slots: readonly WarehouseSlot[], state: MatchRuntimeState): WarehouseSlot[] {
  const shuffled = [...slots];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(state.rng.next() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}
