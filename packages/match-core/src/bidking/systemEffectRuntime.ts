import { Hero, HeroSkin, Shop, itemById, skillById, skillEffectById } from '@bitkingdom/bidking-compat';
import type { BidKingSkillEffectRow, BidKingSkillRow } from '@bitkingdom/bidking-compat';

export interface BidKingGameDataSystemLimits {
  roundCanUseItemCount: number;
  gameCarryItemMax: number;
  gameGoldRateMax: number;
}

export type BidKingSystemEffectOperation =
  | BidKingModifySimLimitOperation
  | BidKingSimShopDiscountOperation
  | BidKingPostGameRewardOperation
  | BidKingChargeSimBuffItemOperation
  | BidKingOpenSimShopOperation
  | BidKingGainSimItemOperation
  | BidKingChangeSimItemStateOperation
  | BidKingDiscardSimItemOperation
  | BidKingUseHeroSkillOperation;

export interface BidKingSystemEffectOperationBase {
  skillId?: number;
  skillOpt?: number;
  skillOptParam1?: readonly (readonly number[])[];
  skillOptParam2?: readonly (readonly number[])[];
  effectId: number;
  category: number;
  sourceParam: readonly number[];
  sourceEffectDesc: string;
}

export interface BidKingSystemEffectModifier {
  mode: 'per_mille' | 'flat' | 'unknown';
  value: number;
}

export interface BidKingModifySimLimitOperation extends BidKingSystemEffectOperationBase {
  kind: 'modify_sim_limit';
  limit: 'gold_interest_cap' | 'shop_buy_grid_count';
  modifier: BidKingSystemEffectModifier;
}

export interface BidKingSimShopDiscountOperation extends BidKingSystemEffectOperationBase {
  kind: 'sim_shop_discount';
  discountRatePerMille: number;
  chancePerMille: number;
}

export interface BidKingPostGameRewardOperation extends BidKingSystemEffectOperationBase {
  kind: 'post_game_reward';
  outcome: 'win' | 'loss' | 'unknown';
  rewardTypeId: number;
  rewardValue: number;
}

export interface BidKingChargeSimBuffItemOperation extends BidKingSystemEffectOperationBase {
  kind: 'charge_sim_buff_item';
  modifier: BidKingSystemEffectModifier;
}

export interface BidKingOpenSimShopOperation extends BidKingSystemEffectOperationBase {
  kind: 'open_sim_shop';
  shopId: number;
  shopName?: string;
}

export interface BidKingGainSimItemOperation extends BidKingSystemEffectOperationBase {
  kind: 'gain_sim_item';
  itemTypeId: number;
  itemId: number;
  itemCount: number;
  itemName?: string;
}

export interface BidKingChangeSimItemStateOperation extends BidKingSystemEffectOperationBase {
  kind: 'change_sim_item_state';
  stateMode: number;
}

export interface BidKingDiscardSimItemOperation extends BidKingSystemEffectOperationBase {
  kind: 'discard_sim_item';
  selectorMode: number;
  itemTypeId: number;
  itemId: number;
}

export interface BidKingUseHeroSkillOperation extends BidKingSystemEffectOperationBase {
  kind: 'use_hero_skill';
  mode: 'specified_skin' | 'random_other_hero';
  heroSkinCid?: number;
  heroCid?: number;
  heroSkillIds: readonly number[];
}

export function bidKingBaseGameDataSystemLimits(): BidKingGameDataSystemLimits {
  return {
    roundCanUseItemCount: 1,
    gameCarryItemMax: 3,
    gameGoldRateMax: 0
  };
}

export function bidKingGameDataSystemLimitsForSkillIds(
  skillIds: Iterable<number> | undefined
): BidKingGameDataSystemLimits {
  const skills = [...(skillIds ?? [])]
    .map((skillId) => skillById(skillId))
    .filter((skill): skill is BidKingSkillRow => Boolean(skill));
  return bidKingGameDataSystemLimitsForSkills(skills);
}

export function bidKingGameDataSystemLimitsForSkills(
  skills: Iterable<BidKingSkillRow>
): BidKingGameDataSystemLimits {
  let limits = bidKingBaseGameDataSystemLimits();
  for (const skill of skills) {
    for (const effectId of skill.skilleffect_position) {
      const effect = skillEffectById(effectId);
      if (effect) {
        limits = bidKingApplySystemSkillEffectLimits(limits, effect);
      }
    }
  }
  return limits;
}

export function bidKingApplySystemSkillEffectLimits(
  limits: BidKingGameDataSystemLimits,
  effect: BidKingSkillEffectRow
): BidKingGameDataSystemLimits {
  if (effect.Category === 16) {
    return {
      ...limits,
      gameCarryItemMax: applyPerMilleOrAddModifier(limits.gameCarryItemMax, effect.Param)
    };
  }
  if (effect.Category === 17) {
    return {
      ...limits,
      gameGoldRateMax: applyPerMilleOrAddModifier(limits.gameGoldRateMax, effect.Param, 0)
    };
  }
  if (effect.Category === 21) {
    return {
      ...limits,
      roundCanUseItemCount: applyPerMilleOrAddModifier(limits.roundCanUseItemCount, effect.Param)
    };
  }
  return limits;
}

export function bidKingSystemEffectOperationsForSkillIds(
  skillIds: Iterable<number> | undefined
): BidKingSystemEffectOperation[] {
  const skills = [...(skillIds ?? [])]
    .map((skillId) => skillById(skillId))
    .filter((skill): skill is BidKingSkillRow => Boolean(skill));
  return bidKingSystemEffectOperationsForSkills(skills);
}

export function bidKingSystemEffectOperationsForSkills(
  skills: Iterable<BidKingSkillRow>
): BidKingSystemEffectOperation[] {
  return [...skills].flatMap((skill) => bidKingSystemEffectOperationsForSkill(skill));
}

export function bidKingSystemEffectOperationsForSkill(skill: BidKingSkillRow): BidKingSystemEffectOperation[] {
  return skill.skilleffect_position.flatMap((effectId) => {
    const effect = skillEffectById(effectId);
    return effect ? bidKingSystemEffectOperationForSkillEffect(effect, skill) : [];
  });
}

export function bidKingSystemEffectOperationForSkillEffect(
  effect: BidKingSkillEffectRow,
  skill?: BidKingSkillRow
): BidKingSystemEffectOperation[] {
  const base = systemEffectOperationBase(effect, skill);
  if (effect.Category === 17) {
    return [{
      ...base,
      kind: 'modify_sim_limit',
      limit: 'gold_interest_cap',
      modifier: systemEffectModifier(effect.Param)
    }];
  }
  if (effect.Category === 18) {
    return [{
      ...base,
      kind: 'modify_sim_limit',
      limit: 'shop_buy_grid_count',
      modifier: systemEffectModifier(effect.Param)
    }];
  }
  if (effect.Category === 19) {
    return [{
      ...base,
      kind: 'sim_shop_discount',
      discountRatePerMille: effect.Param[0] ?? 0,
      chancePerMille: effect.Param[1] ?? 0
    }];
  }
  if (effect.Category === 20) {
    return [{
      ...base,
      kind: 'post_game_reward',
      outcome: postGameRewardOutcome(effect.Param[0] ?? 0),
      rewardTypeId: effect.Param[1] ?? 0,
      rewardValue: effect.Param[2] ?? 0
    }];
  }
  if (effect.Category === 23) {
    return [{
      ...base,
      kind: 'charge_sim_buff_item',
      modifier: systemEffectModifier(effect.Param)
    }];
  }
  if (effect.Category === 24) {
    const shopId = effect.Param[0] ?? 0;
    return [{
      ...base,
      kind: 'open_sim_shop',
      shopId,
      shopName: Shop.find((shop) => shop.id === shopId)?.packaged_name
    }];
  }
  if (effect.Category === 25) {
    return [{
      ...base,
      kind: 'gain_sim_item',
      itemTypeId: effect.Param[0] ?? 0,
      itemId: effect.Param[1] ?? 0,
      itemCount: effect.Param[2] ?? 0,
      itemName: itemById(effect.Param[1] ?? 0)?.packaged_name
    }];
  }
  if (effect.Category === 26) {
    return [{
      ...base,
      kind: 'change_sim_item_state',
      stateMode: effect.Param[0] ?? 0
    }];
  }
  if (effect.Category === 27) {
    return [{
      ...base,
      kind: 'discard_sim_item',
      selectorMode: effect.Param[0] ?? 0,
      itemTypeId: effect.Param[1] ?? 0,
      itemId: effect.Param[2] ?? 0
    }];
  }
  if (effect.Category === 28) {
    const mode = effect.Param[0] ?? 0;
    if (mode === 1) {
      const heroSkinCid = effect.Param[1] ?? 0;
      const heroCid = HeroSkin.find((skin) => skin.id === heroSkinCid)?.skinhero;
      const heroSkillIds = Hero.find((hero) => hero.id === heroCid)?.cast_type.filter((skillId) => skillId > 0) ?? [];
      return [{
        ...base,
        kind: 'use_hero_skill',
        mode: 'specified_skin',
        heroSkinCid,
        heroCid,
        heroSkillIds
      }];
    }
    if (mode === 2) {
      return [{
        ...base,
        kind: 'use_hero_skill',
        mode: 'random_other_hero',
        heroSkillIds: []
      }];
    }
  }
  return [];
}

function applyPerMilleOrAddModifier(base: number, params: readonly number[], min = 1): number {
  const mode = params[0] ?? 0;
  const value = params[1] ?? 0;
  if (mode === 1) {
    return clampInt(base + Math.floor((base * value) / 1000), min);
  }
  if (mode === 2) {
    return clampInt(base + value, min);
  }
  return clampInt(base, min);
}

function clampInt(value: number, min: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.floor(value));
}

function systemEffectModifier(params: readonly number[]): BidKingSystemEffectModifier {
  const mode = params[0] ?? 0;
  const value = params[1] ?? 0;
  if (mode === 1) {
    return { mode: 'per_mille', value };
  }
  if (mode === 2) {
    return { mode: 'flat', value };
  }
  return { mode: 'unknown', value };
}

function postGameRewardOutcome(mode: number): BidKingPostGameRewardOperation['outcome'] {
  if (mode === 1) {
    return 'win';
  }
  if (mode === 2) {
    return 'loss';
  }
  return 'unknown';
}

function systemEffectOperationBase(
  effect: BidKingSkillEffectRow,
  skill?: BidKingSkillRow
): BidKingSystemEffectOperationBase {
  return {
    skillId: skill?.id,
    skillOpt: skill?.skill_opt,
    skillOptParam1: skill?.skill_opt_param1,
    skillOptParam2: skill?.skill_opt_param2,
    effectId: effect.EffectId,
    category: effect.Category,
    sourceParam: effect.Param,
    sourceEffectDesc: effect.effect_desc
  };
}
