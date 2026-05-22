import { describe, expect, it } from 'vitest';
import type { AdminMatchDetail } from '@bitkingdom/shared';
import { eventName, eventPayloadText } from './adminFormatters';

describe('admin match event formatters', () => {
  it('explains BattleItem effect plans in the replay timeline', () => {
    const detail = {
      summary: {
        players: [
          { id: 'p1', name: '掌柜甲' },
          { id: 'p2', name: '掌柜乙' }
        ]
      }
    } as AdminMatchDetail;

    const text = eventPayloadText({
      itemId: 100102,
      targetPlayerId: 'p2',
      cooldownRemaining: 2,
      effectPlan: {
        skillId: 200001,
        effectId: 1000,
        effectCategory: 1,
        revealKind: 'footprint',
        targetCount: 2,
        targetMode: 'skill_target'
      },
      clue: {
        text: '铁算盘100102：命中格位轮廓 2x2，品类 古籍。'
      }
    }, detail);

    expect(eventName('battle_item_used')).toBe('使用试宝令');
    expect(text).toContain('试宝令 100102');
    expect(text).toContain('机缘 200001');
    expect(text).toContain('揭示 2 个轮廓');
    expect(text).toContain('指定目标');
    expect(text).toContain('冷却 2 回合');
    expect(text).toContain('目标 掌柜乙');
  });

  it('explains manual SkillEffect plans in the replay timeline', () => {
    const detail = {
      summary: {
        players: [
          { id: 'p1', name: '掌柜甲' },
          { id: 'p2', name: '掌柜乙' }
        ]
      }
    } as AdminMatchDetail;

    const text = eventPayloadText({
      skillCid: 100101,
      targetPlayerId: 'p2',
      effectPlan: {
        effectId: 5000,
        effectCategory: 5,
        targetCount: 1,
        skillTarget: 6
      },
      clue: {
        text: '卧龙掌眼：命中一个候选格，价值约 100,000。'
      }
    }, detail);

    expect(eventName('skill_used')).toBe('使用掌眼');
    expect(text).toContain('掌眼 100101');
    expect(text).toContain('效果 5000');
    expect(text).toContain('Category 5');
    expect(text).toContain('命中 1 个目标');
    expect(text).toContain('目标 掌柜乙');
  });
});
