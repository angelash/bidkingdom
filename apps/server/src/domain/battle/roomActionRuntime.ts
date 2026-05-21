import {
  BattleItem,
  bidKingEmojiPresentation,
  emojiAllowedHeroIds,
  emojiAllowedRoleIds,
  emojiCooldownMs,
  findBidKingEmoji,
  emojiSoundId,
  emojiUnlockRequirements,
  type BidKingEmojiPresentation,
  type BidKingEmojiUnlockRequirement,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { MatchRuntimeState } from '@bitkingdom/match-core';
import type { RevealedItem } from '@bitkingdom/shared';

export {
  emojiAllowedHeroIds,
  emojiAllowedRoleIds,
  emojiCooldownMs,
  emojiHeroIdForSeat,
  emojiSoundId,
  emojiUnlockRequirements
} from '@bitkingdom/bidking-compat';

export type EmojiCooldownStore = Map<string, number>;

export interface EmojiRuntimeOptions {
  playerId: string;
  cooldowns: EmojiCooldownStore;
  roleId?: string;
  heroId?: number;
  inventory?: Record<string, number>;
  now?: number;
}

export interface EmojiRuntimeResult {
  label: string;
  soundId?: number;
  cooldownMs: number;
  cooldownUntil: number;
  requirements: BidKingEmojiUnlockRequirement[];
  presentation: BidKingEmojiPresentation;
}

export function resolveBattleItem(itemId: number): (typeof BattleItem)[number] {
  const item = BattleItem.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('战斗道具不存在');
  }
  return item;
}

export function emojiForPayload(value: string): BidKingRawTableRow | undefined {
  return findBidKingEmoji(value);
}

export function applyEmojiRuntime(
  emoji: BidKingRawTableRow,
  options: EmojiRuntimeOptions
): EmojiRuntimeResult {
  const requirements = assertEmojiAccess(emoji, options);
  const now = options.now ?? Date.now();
  const key = `${options.playerId}:${emoji.id}`;
  const previousUntil = options.cooldowns.get(key) ?? 0;
  if (previousUntil > now) {
    throw new Error(`表情冷却中 ${Math.ceil((previousUntil - now) / 1000)} 秒`);
  }
  const cooldownMs = emojiCooldownMs(emoji);
  const cooldownUntil = now + cooldownMs;
  const presentation = bidKingEmojiPresentation(emoji);
  options.cooldowns.set(key, cooldownUntil);
  return {
    label: emoji.packaged_name.slice(0, 12),
    soundId: emojiSoundId(emoji),
    cooldownMs,
    cooldownUntil,
    requirements,
    presentation
  };
}

export function assertBattleItemPhase(match: MatchRuntimeState, playerId: string): void {
  const round = match.currentRound;
  if (!round || !['intel', 'auction'].includes(round.phase)) {
    throw new Error('战斗道具只能在情报或竞价阶段使用');
  }
  const player = match.players.find((candidate) => candidate.id === playerId);
  if (match.coreMode && round.phase === 'auction' && (player?.hasSubmittedBid || round.bids.some((bid) => bid.playerId === playerId))) {
    throw new Error('BidKing 战斗道具必须在出价前使用');
  }
}

export function revealDelayForItem(item?: RevealedItem): number {
  const delays: Record<RevealedItem['rarity'], number> = {
    junk: 520,
    common: 620,
    fake: 720,
    fine: 920,
    rare: 1350,
    legendary: 1900
  };
  return item ? delays[item.rarity] : 700;
}

function assertEmojiAccess(emoji: BidKingRawTableRow, options: EmojiRuntimeOptions): BidKingEmojiUnlockRequirement[] {
  const allowedRoles = emojiAllowedRoleIds(emoji);
  if (allowedRoles.length > 0 && (!options.roleId || !allowedRoles.includes(String(options.roleId)))) {
    throw new Error('当前身份不可使用该表情');
  }

  const allowedHeroIds = emojiAllowedHeroIds(emoji);
  if (allowedHeroIds.length > 0 && (!options.heroId || !allowedHeroIds.includes(options.heroId))) {
    throw new Error('当前竞买人不可使用该表情');
  }

  const requirements = emojiUnlockRequirements(emoji);
  for (const requirement of requirements) {
    const quantity = options.inventory?.[requirement.refId] ?? 0;
    if (quantity < requirement.quantity) {
      throw new Error(`表情未解锁：缺少道具 ${requirement.refId} x${requirement.quantity}`);
    }
  }
  return requirements;
}
