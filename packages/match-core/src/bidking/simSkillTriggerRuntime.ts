import { itemById, skillById } from '@bitkingdom/bidking-compat';
import type { BidKingSkillRow } from '@bitkingdom/bidking-compat';

export type BidKingSimSkillTriggerEvent =
  | 'active_use'
  | 'game_start'
  | 'round_start'
  | 'gain_relic'
  | 'use_sim_item'
  | 'sim_item_depleted'
  | 'reveal_quality'
  | 'reveal_outline'
  | 'reveal_full_info'
  | 'unknown';

export interface BidKingSimSkillTriggerProfile {
  skillId: number;
  itemCid?: number;
  activeType: number;
  skillOpt: number;
  skillRound: number;
  skillCooldown: number;
  showType: number;
  castMode: number;
  chancePerMille: number;
  castDelay: number;
  trigger: BidKingSimSkillTriggerEvent;
  sourceParam1: readonly (readonly number[])[];
  sourceParam2: readonly (readonly number[])[];
  sourceCast: readonly (readonly number[])[];
  acceptedRounds?: readonly number[];
  acceptedSourceItemTypeIds?: readonly number[];
  acceptedTargetItemTypeIds?: readonly number[];
  targetBoxRequired: boolean;
}

export interface BidKingSimSkillTriggerContext {
  event: BidKingSimSkillTriggerEvent;
  roundNumber?: number;
  sourceItemTypeId?: number;
  targetItemTypeId?: number;
  targetItemTypeIds?: readonly number[];
  targetBoxId?: number;
  targetBoxIds?: readonly number[];
  chanceRollPerMille?: number;
}

export function bidKingSimSkillTriggerProfileForSkill(
  skillOrId: BidKingSkillRow | number,
  itemCid?: number
): BidKingSimSkillTriggerProfile | undefined {
  const skill = typeof skillOrId === 'number' ? skillById(skillOrId) : skillOrId;
  if (!skill) {
    return undefined;
  }

  const cast = skill.skill_cast[0] ?? [];
  const profile: BidKingSimSkillTriggerProfile = {
    skillId: skill.id,
    activeType: skill.skill_active_type,
    skillOpt: skill.skill_opt,
    skillRound: skill.skill_round,
    skillCooldown: skill.skill_CD,
    showType: skill.show_type,
    castMode: Math.max(0, Math.floor(cast[0] ?? 0)),
    chancePerMille: clampPerMille(cast[1] ?? 1000),
    castDelay: Math.max(0, Math.floor(cast[2] ?? 0)),
    trigger: bidKingSimSkillTriggerEventForSkill(skill),
    sourceParam1: skill.skill_opt_param1,
    sourceParam2: skill.skill_opt_param2,
    sourceCast: skill.skill_cast,
    targetBoxRequired: skill.skilltarget === 8 || skill.skilltarget2 === 8 || skill.skilltarget3 === 8
  };

  if (itemCid !== undefined) {
    profile.itemCid = itemCid;
  }

  const acceptedRounds = acceptedRoundsForSkill(skill);
  if (acceptedRounds.length > 0) {
    profile.acceptedRounds = acceptedRounds;
  }

  const acceptedSourceItemTypeIds = acceptedSourceItemTypeIdsForSkill(skill);
  if (acceptedSourceItemTypeIds.length > 0) {
    profile.acceptedSourceItemTypeIds = acceptedSourceItemTypeIds;
  }

  const acceptedTargetItemTypeIds = acceptedTargetItemTypeIdsForSkill(skill);
  if (acceptedTargetItemTypeIds.length > 0) {
    profile.acceptedTargetItemTypeIds = acceptedTargetItemTypeIds;
  }

  return profile;
}

export function bidKingSimSkillTriggerProfilesForItem(itemCid: number): BidKingSimSkillTriggerProfile[] {
  const item = itemById(itemCid);
  if (!item) {
    return [];
  }
  return item.skills
    .map((skillId) => bidKingSimSkillTriggerProfileForSkill(skillId, itemCid))
    .filter((profile): profile is BidKingSimSkillTriggerProfile => Boolean(profile));
}

export function bidKingSimSkillTriggerProfilesForItems(
  itemCids: Iterable<number>
): BidKingSimSkillTriggerProfile[] {
  return [...itemCids].flatMap((itemCid) => bidKingSimSkillTriggerProfilesForItem(itemCid));
}

export function bidKingSimSkillMatchesTrigger(
  profile: BidKingSimSkillTriggerProfile,
  context: BidKingSimSkillTriggerContext
): boolean {
  if (profile.trigger !== context.event) {
    return false;
  }
  if (!matchesRound(profile.acceptedRounds, context.roundNumber)) {
    return false;
  }
  if (!matchesItemType(profile.acceptedSourceItemTypeIds, definedNumbers([context.sourceItemTypeId]))) {
    return false;
  }
  if (!matchesItemType(
    profile.acceptedTargetItemTypeIds,
    definedNumbers([
      context.targetItemTypeId,
      ...(context.targetItemTypeIds ?? [])
    ])
  )) {
    return false;
  }
  if (profile.targetBoxRequired && definedNumbers([
    context.targetBoxId,
    ...(context.targetBoxIds ?? [])
  ]).length === 0) {
    return false;
  }
  return matchesChance(profile.chancePerMille, context.chanceRollPerMille);
}

function bidKingSimSkillTriggerEventForSkill(skill: BidKingSkillRow): BidKingSimSkillTriggerEvent {
  if (skill.skill_opt === 0) {
    return skill.skill_active_type === 1 ? 'active_use' : 'unknown';
  }
  if (skill.skill_opt === 11) {
    return 'game_start';
  }
  if (skill.skill_opt === 21) {
    return 'round_start';
  }
  if (skill.skill_opt === 31) {
    return 'gain_relic';
  }
  if (skill.skill_opt === 33) {
    return 'use_sim_item';
  }
  if (skill.skill_opt === 34) {
    return 'sim_item_depleted';
  }
  if (skill.skill_opt === 41) {
    const revealMode = skill.skill_opt_param1[0]?.[0] ?? 0;
    if (revealMode === 2) {
      return 'reveal_quality';
    }
    if (revealMode === 3) {
      return 'reveal_outline';
    }
    if (revealMode === 4) {
      return 'reveal_full_info';
    }
  }
  return 'unknown';
}

function acceptedRoundsForSkill(skill: BidKingSkillRow): readonly number[] {
  if (skill.skill_opt !== 21) {
    return [];
  }
  return uniquePositiveOrZero(skill.skill_opt_param1.flat());
}

function acceptedSourceItemTypeIdsForSkill(skill: BidKingSkillRow): readonly number[] {
  if (![31, 33, 34].includes(skill.skill_opt)) {
    return [];
  }
  return uniquePositive(skill.skill_opt_param1.map((row) => row[1] ?? 0));
}

function acceptedTargetItemTypeIdsForSkill(skill: BidKingSkillRow): readonly number[] {
  if (skill.skill_opt !== 41) {
    return [];
  }
  return uniquePositive(skill.skill_opt_param2.map((row) => row[1] ?? 0));
}

function matchesRound(acceptedRounds: readonly number[] | undefined, roundNumber: number | undefined): boolean {
  if (!acceptedRounds || acceptedRounds.length === 0 || acceptedRounds.includes(0) || roundNumber === undefined) {
    return true;
  }
  return acceptedRounds.includes(Math.floor(roundNumber));
}

function matchesItemType(acceptedItemTypeIds: readonly number[] | undefined, contextItemTypeIds: readonly number[]): boolean {
  if (!acceptedItemTypeIds || acceptedItemTypeIds.length === 0 || contextItemTypeIds.length === 0) {
    return true;
  }
  return contextItemTypeIds.some((itemTypeId) => acceptedItemTypeIds.includes(itemTypeId));
}

function matchesChance(chancePerMille: number, chanceRollPerMille: number | undefined): boolean {
  if (chanceRollPerMille === undefined) {
    return true;
  }
  const roll = Math.floor(chanceRollPerMille);
  return roll >= 0 && roll < clampPerMille(chancePerMille);
}

function uniquePositive(values: Iterable<number>): readonly number[] {
  return [...new Set([...values].map((value) => Math.floor(value)).filter((value) => value > 0))];
}

function uniquePositiveOrZero(values: Iterable<number>): readonly number[] {
  return [...new Set([...values].map((value) => Math.floor(value)).filter((value) => value >= 0))];
}

function definedNumbers(values: readonly (number | undefined)[]): readonly number[] {
  return values.filter((value): value is number => value !== undefined);
}

function clampPerMille(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1000, Math.max(0, Math.floor(value)));
}
