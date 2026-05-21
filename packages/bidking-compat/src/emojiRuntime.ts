import type { BidKingRawTableRow } from './schema';
import { bidKingRawTableDisplayDesc, bidKingRawTableDisplayName } from './itemPackagingOverrides';
import { Emoji } from './tables/Emoji';
import { Hero } from './tables/Hero';

export interface BidKingEmojiUnlockRequirement {
  resourceType: string;
  refId: string;
  quantity: number;
}

export type BidKingEmojiVisualClass = 'chat' | 'projectile' | 'broadcast';

export interface BidKingEmojiPresentation {
  emojiId: string;
  label: string;
  description: string;
  emojiType: number;
  soundId?: number;
  animationKey?: string;
  effectKey?: string;
  effectViewIds: number[];
  cooldownMs: number;
  visualClass: BidKingEmojiVisualClass;
  cleanRoomMode: 'css_motion';
  sourceFields: Array<'Emoji.animation' | 'Emoji.emojiEffectView' | 'Emoji.emojiEffect' | 'Emoji.sound' | 'Emoji.activeRule'>;
}

export function findBidKingEmoji(value: string | number): BidKingRawTableRow | undefined {
  const token = String(value);
  return Emoji.find(
    (row) =>
      row.id === token ||
      row.packaged_name === token ||
      row.columns[3] === token ||
      row.columns[4] === token
  );
}

export function emojiCooldownMs(emoji: BidKingRawTableRow): number {
  const raw = parseJsonArray(emoji.columns[13] ?? '');
  const value = Number(raw.at(2));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 2000;
}

export function emojiSoundId(emoji: BidKingRawTableRow): number | undefined {
  const value = Number(emoji.columns[6]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function emojiAnimationKey(emoji: BidKingRawTableRow): string | undefined {
  const value = String(emoji.columns[11] ?? '').trim();
  return value.length > 0 ? value : undefined;
}

export function emojiEffectKey(emoji: BidKingRawTableRow): string | undefined {
  const value = String(emoji.columns[16] ?? '').trim();
  return value.length > 0 ? value : undefined;
}

export function emojiEffectViewIds(emoji: BidKingRawTableRow): number[] {
  return parseNumberList(emoji.columns[15] ?? '').filter((entry) => entry > 0);
}

export function bidKingEmojiPresentation(emoji: BidKingRawTableRow): BidKingEmojiPresentation {
  const animationKey = emojiAnimationKey(emoji);
  const effectKey = emojiEffectKey(emoji);
  const effectViewIds = emojiEffectViewIds(emoji);
  const soundId = emojiSoundId(emoji);
  const emojiType = numericColumn(emoji.columns[5]);
  const sourceFields: BidKingEmojiPresentation['sourceFields'] = ['Emoji.activeRule'];
  if (soundId !== undefined) {
    sourceFields.push('Emoji.sound');
  }
  if (animationKey) {
    sourceFields.push('Emoji.animation');
  }
  if (effectViewIds.length > 0) {
    sourceFields.push('Emoji.emojiEffectView');
  }
  if (effectKey) {
    sourceFields.push('Emoji.emojiEffect');
  }

  return {
    emojiId: emoji.id,
    label: bidKingRawTableDisplayName(emoji),
    description: bidKingRawTableDisplayDesc(emoji),
    emojiType,
    soundId,
    animationKey,
    effectKey,
    effectViewIds,
    cooldownMs: emojiCooldownMs(emoji),
    visualClass: emojiVisualClass(emojiType, animationKey, effectKey, effectViewIds),
    cleanRoomMode: 'css_motion',
    sourceFields
  };
}

export function emojiUnlockRequirements(emoji: BidKingRawTableRow): BidKingEmojiUnlockRequirement[] {
  return parseJsonArray(emoji.columns[7] ?? '').flatMap((entry) => {
    if (!Array.isArray(entry)) {
      return [];
    }
    const refId = Number(entry[1]);
    const quantity = Number(entry[2] ?? 1);
    if (!Number.isFinite(refId) || refId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }
    return [{
      resourceType: String(entry[0] ?? ''),
      refId: String(Math.trunc(refId)),
      quantity: Math.trunc(quantity)
    }];
  });
}

export function emojiAllowedRoleIds(emoji: BidKingRawTableRow): string[] {
  return parseJsonArray(emoji.columns[9] ?? '')
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0 && entry !== '0');
}

export function emojiAllowedHeroIds(emoji: BidKingRawTableRow): number[] {
  return parseNumberList(emoji.columns[14] ?? '').filter((entry) => entry > 0);
}

export function emojiHeroIdForSeat(seat: number): number | undefined {
  if (Hero.length === 0) {
    return undefined;
  }
  const normalizedSeat = Number.isFinite(seat) ? Math.max(0, Math.trunc(seat)) : 0;
  return Hero[normalizedSeat % Hero.length]?.id;
}

function numericColumn(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function emojiVisualClass(
  emojiType: number,
  animationKey?: string,
  effectKey?: string,
  effectViewIds: number[] = []
): BidKingEmojiVisualClass {
  if (animationKey || effectKey || effectViewIds.length > 0) {
    return 'projectile';
  }
  return emojiType === 2 ? 'broadcast' : 'chat';
}

function parseNumberList(raw: string): number[] {
  return parseJsonArray(raw)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.trunc(entry));
}

function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
