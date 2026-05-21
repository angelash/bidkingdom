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
});
