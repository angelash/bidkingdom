import { describe, expect, it } from 'vitest';
import { socialEmojiActionsForProfile } from './emojiSocialRuntime';

describe('social Emoji runtime', () => {
  it('exposes every Emoji row for the friend panel entrance', () => {
    const actions = socialEmojiActionsForProfile({ inventory: [] });

    expect(actions).toHaveLength(16);
    expect(actions[0]).toEqual(expect.objectContaining({
      id: '101',
      disabled: false,
      soundId: 171001,
      visualClass: 'chat'
    }));
  });

  it('keeps premium effect Emoji locked until the original cost item exists', () => {
    const locked = socialEmojiActionsForProfile({ inventory: [] }).find((action) => action.id === '201')!;
    expect(locked).toEqual(expect.objectContaining({
      disabled: true,
      animationKey: 'Bullet_Fish',
      effectKey: 'Expression_Fish',
      effectViewIds: [2],
      visualClass: 'projectile'
    }));
    expect(locked.title).toContain('3001');

    const unlocked = socialEmojiActionsForProfile({
      inventory: [{
        key: 'inv_3001',
        type: 'item',
        refId: '3001',
        quantity: 1,
        updatedAt: 1
      }]
    }).find((action) => action.id === '201')!;
    expect(unlocked.disabled).toBe(false);
    expect(unlocked.title).toContain('Expression_Fish');
  });
});
