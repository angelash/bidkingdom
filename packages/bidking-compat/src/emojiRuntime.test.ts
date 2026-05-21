import { describe, expect, it } from 'vitest';
import {
  bidKingEmojiPresentation,
  Emoji,
  emojiAnimationKey,
  emojiEffectKey,
  emojiEffectViewIds
} from './index';

describe('BidKing Emoji runtime', () => {
  it('builds presentation metadata for every original Emoji row', () => {
    const presentations = Emoji.map((row) => bidKingEmojiPresentation(row));

    expect(presentations).toHaveLength(16);
    expect(presentations.every((entry) => entry.cleanRoomMode === 'css_motion')).toBe(true);
    expect(presentations.every((entry) => entry.cooldownMs === 2000)).toBe(true);
    expect(presentations.every((entry) => entry.sourceFields.includes('Emoji.activeRule'))).toBe(true);
  });

  it('keeps base chat rows lightweight and premium rows effect driven', () => {
    const base = Emoji.find((row) => row.id === '101')!;
    const premium = Emoji.find((row) => row.id === '201')!;

    expect(bidKingEmojiPresentation(base)).toEqual(expect.objectContaining({
      emojiId: '101',
      soundId: 171001,
      visualClass: 'chat'
    }));
    expect(emojiAnimationKey(base)).toBeUndefined();
    expect(emojiEffectKey(base)).toBeUndefined();
    expect(emojiEffectViewIds(base)).toEqual([]);

    expect(bidKingEmojiPresentation(premium)).toEqual(expect.objectContaining({
      emojiId: '201',
      animationKey: 'Bullet_Fish',
      effectKey: 'Expression_Fish',
      effectViewIds: [2],
      soundId: 172001,
      visualClass: 'projectile'
    }));
  });
});
