import { bidKingBattleItemDisplayDesc, bidKingBattleItemDisplayName, type BidKingBattleItemRow } from '@bitkingdom/bidking-compat';
import { battleItemEffectPlanForItem, type BattleItemEffectPlan } from '@bitkingdom/match-core';

export interface BattleItemActionState {
  actionTitle: string;
  badges: string[];
  canUse: boolean;
  cooldownRemaining: number;
  disabledReason?: string;
  effectPlan?: BattleItemEffectPlan;
}

export interface BuildBattleItemActionStateArgs {
  canUseBattleItem: boolean;
  cooldowns?: Record<string, number>;
  inventory: number;
  itemId: number;
  row?: BidKingBattleItemRow;
  selectedTargetId?: string;
}

export function buildBattleItemActionState({
  canUseBattleItem,
  cooldowns,
  inventory,
  itemId,
  row,
  selectedTargetId
}: BuildBattleItemActionStateArgs): BattleItemActionState {
  const cooldownRemaining = Math.max(0, Math.floor(cooldowns?.[String(itemId)] ?? 0));
  if (!row) {
    return {
      actionTitle: `试宝令 ${itemId} 缺少配置`,
      badges: ['缺配置'],
      canUse: false,
      cooldownRemaining,
      disabledReason: '缺配置'
    };
  }

  const effectPlan = battleItemEffectPlanForItem(row);
  const disabledReason = battleItemDisabledReason({
    canUseBattleItem,
    cooldownRemaining,
    effectPlan,
    inventory,
    selectedTargetId
  });
  const badges = battleItemBadges(effectPlan, cooldownRemaining);
  const titleLines = [
    bidKingBattleItemDisplayName(row),
    bidKingBattleItemDisplayDesc(row),
    effectPlan.description,
    `机缘 ${effectPlan.skillId ?? '-'} / 效果 ${effectPlan.effectId ?? '-'}`,
    `目标：${targetModeLabel(effectPlan.targetMode)} · ${targetValuesText(effectPlan)}`,
    `冷却：${cooldownRemaining > 0 ? `剩余 ${cooldownRemaining} 回合` : cooldownLabel(effectPlan.cooldownRounds)}`,
    disabledReason ? `不可用：${disabledReason}` : '当前可使用'
  ].filter(Boolean);

  return {
    actionTitle: titleLines.join('\n'),
    badges,
    canUse: !disabledReason,
    cooldownRemaining,
    disabledReason,
    effectPlan
  };
}

function battleItemDisabledReason({
  canUseBattleItem,
  cooldownRemaining,
  effectPlan,
  inventory,
  selectedTargetId
}: {
  canUseBattleItem: boolean;
  cooldownRemaining: number;
  effectPlan: BattleItemEffectPlan;
  inventory: number;
  selectedTargetId?: string;
}): string | undefined {
  if (inventory <= 0) {
    return '库存不足';
  }
  if (!canUseBattleItem) {
    return '当前阶段不可使用';
  }
  if (cooldownRemaining > 0) {
    return `冷却 ${cooldownRemaining} 回合`;
  }
  if (effectPlan.targetPlayerRequired && !selectedTargetId) {
    return '请选择目标玩家';
  }
  return undefined;
}

function battleItemBadges(effectPlan: BattleItemEffectPlan, cooldownRemaining: number): string[] {
  return [
    revealKindLabel(effectPlan.revealKind),
    battleItemTargetCountLabel(effectPlan),
    targetModeLabel(effectPlan.targetMode),
    effectPlan.durationRounds > 0 ? `持续${effectPlan.durationRounds}` : '即时',
    cooldownRemaining > 0 ? `冷却${cooldownRemaining}` : cooldownLabel(effectPlan.cooldownRounds),
    effectPlan.implementationStatus === 'implemented'
      ? '已落实'
      : '协议推断'
  ];
}

function battleItemTargetCountLabel(effectPlan: BattleItemEffectPlan): string {
  if (effectPlan.revealKind === 'system') {
    return '无仓库目标';
  }
  return effectPlan.requestedTargetCount === 999 ? '全量目标' : `${effectPlan.targetCount}目标`;
}

function targetValuesText(effectPlan: BattleItemEffectPlan): string {
  const primary = effectPlan.skillTargetValue.filter((value) => value > 0).slice(0, 4).join('/');
  const secondary = effectPlan.secondaryTargets
    .filter((target) => target.target > 0)
    .map((target) => `${target.target}:${target.values.filter((value) => value > 0).slice(0, 3).join('/') || '任意'}`)
    .join('；');
  return [primary ? `${effectPlan.skillTarget}:${primary}` : `目标${effectPlan.skillTarget}`, secondary].filter(Boolean).join('；');
}

function cooldownLabel(rounds: number): string {
  return rounds > 0 ? `冷却${rounds}` : '无冷却';
}

function revealKindLabel(kind: BattleItemEffectPlan['revealKind']): string {
  const labels: Record<BattleItemEffectPlan['revealKind'], string> = {
    category: '品类',
    footprint: '轮廓',
    identity: '本体',
    quality: '品质',
    quantity: '数量',
    system: '系统',
    value: '估值'
  };
  return labels[kind];
}

function targetModeLabel(mode: BattleItemEffectPlan['targetMode']): string {
  const labels: Record<BattleItemEffectPlan['targetMode'], string> = {
    highest_value: '高价值',
    largest_slots: '大格位',
    skill_target: '指定目标',
    system_effect: '系统效果'
  };
  return labels[mode];
}
