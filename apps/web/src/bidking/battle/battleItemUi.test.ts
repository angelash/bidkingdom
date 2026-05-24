import { BattleItem } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import { buildBattleItemActionState } from './battleItemUi';

describe('battle item action UI state', () => {
  it('exposes original BattleItem skill plan labels for the in-match action bar', () => {
    const row = BattleItem[0]!;
    const state = buildBattleItemActionState({
      canUseBattleItem: true,
      inventory: 2,
      itemId: row.id,
      row
    });

    expect(state.canUse).toBe(true);
    expect(state.effectPlan).toEqual(expect.objectContaining({
      itemId: row.id,
      targetMode: 'skill_target'
    }));
    expect(state.badges).toEqual(expect.arrayContaining(['指定目标', '全量目标', '无冷却', '已落实']));
    expect(state.actionTitle).toContain(`机缘 ${state.effectPlan?.skillId}`);
  });

  it('blocks use when server snapshot reports item cooldown or missing inventory', () => {
    const row = BattleItem[0]!;
    const cooldown = buildBattleItemActionState({
      canUseBattleItem: true,
      cooldowns: { [String(row.id)]: 2 },
      inventory: 1,
      itemId: row.id,
      row
    });
    const missing = buildBattleItemActionState({
      canUseBattleItem: true,
      inventory: 0,
      itemId: row.id,
      row
    });

    expect(cooldown.canUse).toBe(false);
    expect(cooldown.disabledReason).toBe('冷却 2 回合');
    expect(missing.canUse).toBe(false);
    expect(missing.disabledReason).toBe('库存不足');
  });
});
