import { Emoji } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import {
  applyEmojiRuntime,
  emojiAllowedRoleIds,
  emojiCooldownMs,
  emojiForPayload,
  emojiSoundId,
  emojiUnlockRequirements
} from '../src/domain/battle/roomActionRuntime';

describe('BidKing battle action runtime', () => {
  it('drives Emoji cooldown and sound metadata from original rows', () => {
    const emoji = Emoji[0]!;
    const cooldowns = new Map<string, number>();

    expect(emojiForPayload(emoji.id)).toBe(emoji);
    expect(emojiForPayload(emoji.columns[3]!)).toBe(emoji);
    expect(emojiCooldownMs(emoji)).toBe(2000);
    expect(emojiSoundId(emoji)).toBe(Number(emoji.columns[6]));

    const first = applyEmojiRuntime(emoji, {
      playerId: 'p_emoji',
      cooldowns,
      now: 1000
    });
    expect(first).toEqual(expect.objectContaining({
      cooldownMs: 2000,
      cooldownUntil: 3000,
      label: emoji.packaged_name,
      soundId: Number(emoji.columns[6]),
      presentation: expect.objectContaining({
        emojiId: emoji.id,
        visualClass: 'chat'
      })
    }));
    expect(() => applyEmojiRuntime(emoji, {
      playerId: 'p_emoji',
      cooldowns,
      now: 2500
    })).toThrow('表情冷却中');
    expect(applyEmojiRuntime(emoji, {
      playerId: 'p_emoji',
      cooldowns,
      now: 3000
    }).cooldownUntil).toBe(5000);
  });

  it('enforces Emoji unlock and role restrictions before cooldown', () => {
    const premium = Emoji.find((row) => emojiUnlockRequirements(row).length > 0)!;
    const requirement = emojiUnlockRequirements(premium)[0]!;
    expect(requirement).toEqual(expect.objectContaining({
      refId: '3001',
      quantity: 1,
      resourceType: '3'
    }));

    expect(() => applyEmojiRuntime(premium, {
      playerId: 'p_locked',
      cooldowns: new Map<string, number>(),
      inventory: {},
      now: 1000
    })).toThrow('表情未解锁');

    const unlocked = applyEmojiRuntime(premium, {
      playerId: 'p_unlocked',
      cooldowns: new Map<string, number>(),
      inventory: { [requirement.refId]: requirement.quantity },
      now: 1000
    });
    expect(unlocked.requirements).toEqual([requirement]);
    expect(unlocked.presentation).toEqual(expect.objectContaining({
      animationKey: 'Bullet_Fish',
      effectKey: 'Expression_Fish',
      effectViewIds: [2],
      visualClass: 'projectile'
    }));

    const restricted = {
      ...premium,
      columns: [...premium.columns]
    };
    restricted.columns[9] = '["appraiser"]';
    expect(emojiAllowedRoleIds(restricted)).toEqual(['appraiser']);
    expect(() => applyEmojiRuntime(restricted, {
      playerId: 'p_wrong_role',
      roleId: 'smuggler',
      cooldowns: new Map<string, number>(),
      inventory: { [requirement.refId]: requirement.quantity },
      now: 1000
    })).toThrow('当前身份不可使用该表情');
  });
});
