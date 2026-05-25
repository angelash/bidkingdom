import {
  Skill,
  SkillGroup,
  bidKingBattleItemDisplayName,
  bidKingSkillDisplayName,
  skillById,
  skillEffectById
} from '@bitkingdom/bidking-compat';
import type { BidKingBattleItemRow, BidKingSkillEffectRow, BidKingSkillGroupRow, BidKingSkillRow } from '@bitkingdom/bidking-compat';
import type { Clue, SkillFeedEntry } from '@bitkingdom/shared';
import {
  bidKingKnowledgeByItemIdFromSkillFeed,
  bidKingSkillRequiresTargetBox,
  bidKingSourceHitBoxList,
  bidKingSourceTargetCount,
  selectBidKingSlotsBySkill
} from './bidking/skillTargeting';
import { bidKingBattleItemUsesRemainingThisRound } from './bidking/battleItemUseRuntime';
import { bidKingSkillEffectRuntimeProfile } from './bidking/skillEffectRuntime';
import { pushEvent, requirePlayer, requireRound } from './match';
import type { MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from './types';

export type BattleItemRevealKind = 'value' | 'category' | 'quality' | 'quantity' | 'footprint' | 'identity' | 'system';
export type BattleItemTargetMode = 'skill_target' | 'highest_value' | 'largest_slots' | 'system_effect';
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
  targetBoxRequired: boolean;
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
  const targets = battleItemTargets(state, playerId, skillContext, effectPlan);
  const resolvedEffectPlan = {
    ...effectPlan,
    targetCount: targets.length,
    description: battleItemEffectDescription(item, skillContext.skill, skillContext.effect, effectPlan.revealKind, targets.length, effectPlan.requestedTargetCount)
  };
  let clue = buildBattleItemClue(state, playerId, item, skillContext, resolvedEffectPlan, targets, now);
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
    targetCount: targets.length,
    text: clue.text,
    visibility: 'private',
    targetItemIds: clue.targetItemIds ?? (clue.targetItemId ? [clue.targetItemId] : undefined),
    hitBoxList: skillContext.skill ? bidKingSourceHitBoxList(round, targets, skillContext.skill) : undefined,
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
    effectPlan: resolvedEffectPlan,
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
  if (bidKingBattleItemUsesRemainingThisRound(state, playerId) <= 0) {
    throw new Error('Battle item use limit reached for this round');
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
  const requestedTargetCount = skill
    ? bidKingSourceTargetCount(skill)
    : 1 + Math.floor(item.item_quality / 3);
  const targetCount = requestedTargetCount;
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
    targetPlayerRequired: false,
    targetBoxRequired: Boolean(skill && bidKingSkillRequiresTargetBox(skill)),
    valueHint: revealKind === 'value',
    riskHint: false,
    categoryHint: revealKind === 'category',
    qualityHint: revealKind === 'quality',
    quantityHint: revealKind === 'quantity' || revealKind === 'footprint',
    identityHint: revealKind === 'identity',
    implementationStatus: battleItemEffectImplementationStatus(revealKind, effectCategory),
    description: battleItemEffectDescription(item, skill, effect, revealKind, targetCount, requestedTargetCount)
  };
  return plan;
}

function buildBattleItemClue(
  state: MatchRuntimeState,
  playerId: string,
  item: BidKingBattleItemRow,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan,
  targets: readonly WarehouseSlot[],
  now: number
): Clue {
  const round = requireRound(state);
  const targetItems = targets.map((slot) => slot.item);
  const prefix = `battle_item_${item.id}_${playerId}_${round.index}_${now}`;
  const targetItemIds = targetItems.map((target) => target.id);
  const sourceText = battleItemClueTextForPlan(item, skillContext, effectPlan, targets);
  if (effectPlan.revealKind === 'value') {
    const valueHint = battleItemValueHint(effectPlan, targets);
    return {
      id: prefix,
      kind: 'value',
      text: sourceText,
      accuracy: Math.min(0.96, 0.68 + item.item_quality * 0.045),
      targetItemIds,
      valueHint,
      source: 'skill',
      isTruthful: true
    };
  }
  if (effectPlan.revealKind === 'system') {
    return {
      id: prefix,
      kind: 'category',
      text: sourceText,
      accuracy: 1,
      targetItemIds: [],
      source: 'skill',
      isTruthful: true
    };
  }
  const target = targetItems[0] ?? round.container.hiddenItems[0]!;
  if (targetItems.length === 0) {
    return {
      id: prefix,
      kind: 'category',
      text: sourceText,
      accuracy: Math.min(0.95, 0.62 + item.item_quality * 0.05),
      targetItemIds: [],
      riskHint: 'safe',
      source: 'skill',
      isTruthful: true
    };
  }
  if (effectPlan.revealKind === 'identity') {
    return {
      id: prefix,
      kind: 'category',
      text: sourceText,
      accuracy: Math.min(0.97, 0.7 + item.item_quality * 0.045),
      targetItemId: target.id,
      targetItemIds: targetItemIds.length > 0 ? targetItemIds : [target.id],
      riskHint: 'safe',
      source: 'skill',
      isTruthful: true
    };
  }
  return {
    id: prefix,
    kind: 'category',
    text: sourceText,
    accuracy: Math.min(0.95, 0.62 + item.item_quality * 0.05),
    targetItemId: target.id,
    targetItemIds: targetItemIds.length > 0 ? targetItemIds : [target.id],
    riskHint: 'safe',
    source: 'skill',
    isTruthful: true
  };
}

function battleItemTargets(
  state: MatchRuntimeState,
  playerId: string,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan
): WarehouseSlot[] {
  const round = requireRound(state);
  const count = effectPlan.requestedTargetCount;
  const skill = skillContext.skill;
  if (effectPlan.revealKind === 'system') {
    return [];
  }
  if (skill) {
    return selectBidKingSlotsBySkill(round.container.warehouseSlots, state, skill, {
      knownInfoByItemId: bidKingKnowledgeByItemIdFromSkillFeed(round.container.warehouseSlots, round.skillFeed, playerId)
    });
  }
  let slots = [...round.container.warehouseSlots];
  if (slots.length === 0) {
    slots = [...round.container.warehouseSlots];
  }
  if (effectPlan.targetMode === 'highest_value') {
    return slots.sort((left, right) => right.item.value - left.item.value).slice(0, count === 999 ? slots.length : count);
  }
  return slots.sort((left, right) => (right.w * right.h) - (left.w * left.h)).slice(0, count === 999 ? slots.length : count);
}

function battleItemSkillContext(state: MatchRuntimeState | undefined, item: BidKingBattleItemRow): BattleItemSkillContext {
  const directSkill = skillForBattleItem(item);
  if (directSkill) {
    const effectId = directSkill.skilleffect_position[0];
    return {
      skill: directSkill,
      effect: effectId ? skillEffectById(effectId) : undefined
    };
  }
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

export function skillForBattleItem(item: BidKingBattleItemRow): BidKingSkillRow | undefined {
  return Skill.find((candidate) => candidate.skill_name === `itemName_${item.id}`);
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
    return '格位观察';
  }
  return '格位侦察';
}

function battleItemRevealKind(item: BidKingBattleItemRow, effectCategory: number | undefined): BattleItemRevealKind {
  if (effectCategory !== undefined) {
    const effectProfile = bidKingSkillEffectRuntimeProfile(effectCategory);
    if (effectProfile.runtimeKind === 'system' || effectProfile.runtimeKind === 'unsupported') {
      return 'system';
    }
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
  return 'category';
}

function battleItemTargetMode(
  item: BidKingBattleItemRow,
  revealKind: BattleItemRevealKind,
  skill: BidKingSkillRow | undefined
): BattleItemTargetMode {
  if (revealKind === 'system') {
    return 'system_effect';
  }
  if (skill) {
    return 'skill_target';
  }
  if (revealKind === 'value' || item.battle_item_type === 2) {
    return 'highest_value';
  }
  return 'largest_slots';
}

function battleItemEffectImplementationStatus(
  revealKind: BattleItemRevealKind,
  effectCategory: number | undefined
): BattleItemEffectImplementationStatus {
  if (effectCategory === undefined) {
    return revealKind === 'category' || revealKind === 'system' ? 'simplified' : 'implemented';
  }
  const effectProfile = bidKingSkillEffectRuntimeProfile(effectCategory);
  return effectProfile.runtimeKind === 'system' || effectProfile.runtimeKind === 'unsupported'
    ? 'simplified'
    : 'implemented';
}

function battleItemEffectDescription(
  item: BidKingBattleItemRow,
  skill: BidKingSkillRow | undefined,
  effect: BidKingSkillEffectRow | undefined,
  revealKind: BattleItemRevealKind,
  targetCount: number,
  requestedTargetCount: number
): string {
  const itemName = bidKingBattleItemDisplayName(item);
  const skillName = skill ? bidKingSkillDisplayName(skill) : '默认试宝情报';
  const effectName = effect?.effect_desc ?? '按试宝令类型生成情报';
  const duration = skill && skill.skill_round > 0 ? `，持续 ${skill.skill_round} 回合` : '';
  const cooldown = skill && skill.skill_CD > 0 ? `，冷却 ${skill.skill_CD} 回合` : '';
  if (revealKind === 'system') {
    return `${itemName} 使用 ${skillName}/${effectName}，触发非仓库情报效果${duration}${cooldown}`;
  }
  const countText = requestedTargetCount === 999 && targetCount === 999
    ? '所有匹配目标'
    : requestedTargetCount === 999
      ? `${targetCount} 个匹配目标`
      : `${targetCount} 个目标`;
  return `${itemName} 使用 ${skillName}/${effectName}，揭示 ${countText}的${battleItemRevealLabel(revealKind)}${duration}${cooldown}`;
}

function battleItemRevealLabel(revealKind: BattleItemRevealKind): string {
  if (revealKind === 'value') {
    return '估值';
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
  if (revealKind === 'system') {
    return '系统效果';
  }
  return '品类';
}

function battleItemClueTextForPlan(
  item: BidKingBattleItemRow,
  skillContext: BattleItemSkillContext,
  effectPlan: BattleItemEffectPlan,
  targets: readonly WarehouseSlot[]
): string {
  const itemName = bidKingBattleItemDisplayName(item);
  const skillName = skillContext.skill ? bidKingSkillDisplayName(skillContext.skill) : '格位侦察';
  const target = targets[0]?.item;
  const targetItems = targets.map((slot) => slot.item);
  const count = targetItems.length;
  const cells = targetItems.reduce((sum, candidate) => sum + candidate.footprint.w * candidate.footprint.h, 0);
  const totalValue = targetItems.reduce((sum, candidate) => sum + candidate.value, 0);
  const category = effectPlan.effectCategory;
  const categories = skillContext.skill?.skilleffect_position
    .map((effectId) => skillEffectById(effectId)?.Category)
    .filter((entry): entry is number => typeof entry === 'number') ?? [];
  if (effectPlan.revealKind === 'system') {
    return `${itemName}·${skillName}：触发${effectPlan.effectName ?? '系统效果'}，不直接揭示仓库藏品。`;
  }
  if (categories.includes(1) && categories.includes(7)) {
    return `${itemName}·${skillName}：显示 ${count} 件藏品的轮廓和品质。`;
  }
  if (category === 2) {
    return `${itemName}·${skillName}：命中藏品总格数为 ${cells} 格。`;
  }
  if (category === 3) {
    return `${itemName}·${skillName}：命中藏品平均格数为 ${formatBattleItemNumber(cells / Math.max(1, count))} 格。`;
  }
  if (category === 4) {
    return `${itemName}·${skillName}：命中藏品数量为 ${count} 件。`;
  }
  if (category === 5) {
    return target
      ? `${itemName}·${skillName}：显示 ${count} 件藏品价值，首个命中格价值 ${target.value.toLocaleString()}。`
      : `${itemName}·${skillName}：没有命中藏品价值。`;
  }
  if (category === 8) {
    return `${itemName}·${skillName}：命中藏品平均价值为 ${formatBattleItemNumber(totalValue / Math.max(1, count))}。`;
  }
  if (category === 9) {
    return `${itemName}·${skillName}：命中藏品每格均价为 ${formatBattleItemNumber(totalValue / Math.max(1, cells))}。`;
  }
  if (category === 10) {
    return `${itemName}·${skillName}：命中藏品总价值为 ${totalValue.toLocaleString()}。`;
  }
  if (category === 11) {
    return `${itemName}·${skillName}：命中藏品总占格为 ${cells} 格。`;
  }
  if (category === 12) {
    return target
      ? `${itemName}·${skillName}：目标品质为${target.rarity}。`
      : `${itemName}·${skillName}：没有命中品质信息。`;
  }
  if (category === 13) {
    return target
      ? `${itemName}·${skillName}：目标品类为${target.category}。`
      : `${itemName}·${skillName}：没有命中品类信息。`;
  }
  if (category === 14) {
    const digits = target ? String(Math.max(0, Math.floor(target.value))).length : 0;
    return `${itemName}·${skillName}：命中格价格为 ${digits} 位数。`;
  }
  if (!target) {
    return `${itemName}·${skillName}：没有命中藏品。`;
  }
  if (effectPlan.revealKind === 'quality') {
    return `${itemName}·${skillName}：命中格位品质接近${target.rarity}，品类 ${target.category}。`;
  }
  if (effectPlan.revealKind === 'quantity') {
    return `${itemName}·${skillName}：命中格位占用 ${target.footprint.w * target.footprint.h} 格，尺寸 ${target.footprint.w}x${target.footprint.h}。`;
  }
  if (effectPlan.revealKind === 'footprint') {
    return `${itemName}·${skillName}：命中 ${count} 件藏品轮廓，首个命中格 ${target.footprint.w}x${target.footprint.h}。`;
  }
  if (effectPlan.revealKind === 'identity') {
    return `${itemName}·${skillName}：显示藏品本体，${target.name}，${target.category}，品质接近${target.rarity}。`;
  }
  return `${itemName}·${skillName}：命中格位属于${target.category}，品质接近${target.rarity}。`;
}

function battleItemValueHint(
  effectPlan: BattleItemEffectPlan,
  targets: readonly WarehouseSlot[]
): { min: number; max: number } | undefined {
  const targetItems = targets.map((slot) => slot.item);
  const target = targetItems[0];
  if (!target) {
    return undefined;
  }
  const totalValue = targetItems.reduce((sum, candidate) => sum + candidate.value, 0);
  const cells = targetItems.reduce((sum, candidate) => sum + candidate.footprint.w * candidate.footprint.h, 0);
  if (effectPlan.effectCategory === 5) {
    return { min: target.value, max: target.value };
  }
  if (effectPlan.effectCategory === 14) {
    const digits = Math.max(1, String(Math.max(0, Math.floor(target.value))).length);
    return { min: digits === 1 ? 0 : 10 ** (digits - 1), max: 10 ** digits - 1 };
  }
  if (effectPlan.effectCategory === 8) {
    const value = Math.round(totalValue / Math.max(1, targetItems.length));
    return { min: value, max: value };
  }
  if (effectPlan.effectCategory === 9) {
    const value = Math.round(totalValue / Math.max(1, cells));
    return { min: value, max: value };
  }
  if (effectPlan.effectCategory === 10) {
    return { min: totalValue, max: totalValue };
  }
  return { min: totalValue, max: totalValue };
}

function formatBattleItemNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
