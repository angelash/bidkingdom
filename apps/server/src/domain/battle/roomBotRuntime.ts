import {
  chooseBotAction,
  passAuction,
  pushEvent,
  submitBid,
  useSkill
} from '@bitkingdom/match-core';
import { bidKingEmojiPresentation, emojiSoundId, findBidKingEmoji } from '@bitkingdom/bidking-compat';
import type { Room } from './roomLifecycleRuntime';

export function runBotAuctionForRoom(room: Room): void {
  const match = room.match;
  if (!match || !match.currentRound || !['intel', 'auction'].includes(match.currentRound.phase)) {
    return;
  }
  for (const player of match.players.filter((candidate) => candidate.kind === 'bot' || candidate.status === 'disconnected')) {
    let followUp = true;
    let actionCount = 0;
    while (followUp && actionCount < 2 && match.currentRound && ['intel', 'auction'].includes(match.currentRound.phase)) {
      actionCount += 1;
      const action = chooseBotAction(match, player.id, room.botProfiles.get(player.id) ?? 'mentor');
      const now = Date.now();
      followUp = false;
      try {
        if (action.type === 'bid' && action.amount !== undefined) {
          submitBid(match, player.id, action.amount, now);
        } else if (action.type === 'pass') {
          passAuction(match, player.id, now);
        } else if (action.type === 'skill') {
          useSkill(match, player.id, action.targetPlayerId, now);
          followUp = match.currentRound?.phase === 'auction';
        } else if (action.type === 'emote' && action.emote) {
          const emoji = findBidKingEmoji(action.emote);
          const presentation = emoji ? bidKingEmojiPresentation(emoji) : undefined;
          player.emote = emoji?.packaged_name.slice(0, 12) ?? action.emote;
          player.emoteSoundId = emoji ? emojiSoundId(emoji) : undefined;
          player.emoteAnimationKey = presentation?.animationKey;
          player.emoteEffectKey = presentation?.effectKey;
          player.emoteEffectViewIds = presentation?.effectViewIds;
          player.emoteVisualClass = presentation?.visualClass;
        }
        pushEvent(match, 'bot_action_chosen', player.id, {
          roundId: match.currentRound?.id,
          actionType: action.type,
          amount: action.amount,
          targetPlayerId: action.targetPlayerId,
          emote: action.emote,
          reason: action.reason,
          audit: action.audit
        }, now);
      } catch (error) {
        pushEvent(match, 'bot_action_failed', player.id, {
          roundId: match.currentRound?.id,
          actionType: action.type,
          amount: action.amount,
          targetPlayerId: action.targetPlayerId,
          emote: action.emote,
          reason: action.reason,
          audit: action.audit,
          error: error instanceof Error ? error.message : String(error)
        }, now);
        player.passed = match.currentRound?.phase === 'auction';
        followUp = false;
      }
    }
  }
}
