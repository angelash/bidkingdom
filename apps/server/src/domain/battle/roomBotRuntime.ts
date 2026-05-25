import {
  chooseBotAction,
  passAuction,
  pushEvent,
  submitBid,
  useBattleItem
} from '@bitkingdom/match-core';
import { BattleItem, bidKingEmojiPresentation, emojiSoundId, findBidKingEmoji } from '@bitkingdom/bidking-compat';
import type { Room } from './roomLifecycleRuntime';
import { appendServerLog } from '../../services/serverLogSink';

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
        } else if (action.type === 'battle_item' && action.itemId !== undefined) {
          const item = BattleItem.find((candidate) => candidate.id === action.itemId);
          if (!item) {
            throw new Error(`Unknown bot battle item ${action.itemId}`);
          }
          useBattleItem(match, player.id, item, now, action.targetPlayerId);
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
          itemId: action.itemId,
          itemUsageGroupId: action.itemUsageGroupId,
          targetPlayerId: action.targetPlayerId,
          emote: action.emote,
          reason: action.reason,
          audit: action.audit
        }, now);
        logBotAction(room, 'bot_action_chosen', player.id, action, now);
      } catch (error) {
        pushEvent(match, 'bot_action_failed', player.id, {
          roundId: match.currentRound?.id,
          actionType: action.type,
          amount: action.amount,
          itemId: action.itemId,
          itemUsageGroupId: action.itemUsageGroupId,
          targetPlayerId: action.targetPlayerId,
          emote: action.emote,
          reason: action.reason,
          audit: action.audit,
          error: error instanceof Error ? error.message : String(error)
        }, now);
        logBotAction(room, 'bot_action_failed', player.id, action, now, error instanceof Error ? error.message : String(error));
        player.passed = match.currentRound?.phase === 'auction';
        followUp = false;
      }
    }
  }
}

function logBotAction(
  room: Room,
  event: 'bot_action_chosen' | 'bot_action_failed',
  playerId: string,
  action: ReturnType<typeof chooseBotAction>,
  now: number,
  error?: string
): void {
  const match = room.match;
  const round = match?.currentRound;
  appendServerLog(error ? 'warn' : 'info', event, {
    roomCode: room.code,
    roomStatus: room.status,
    matchId: match?.id,
    matchStatus: match?.status,
    roundId: round?.id,
    roundIndex: round?.index,
    totalRounds: match?.totalRounds,
    phase: round?.phase,
    auctionMode: round?.auctionMode,
    playerId,
    actionType: action.type,
    amount: action.amount,
    itemId: action.itemId,
    itemUsageGroupId: action.itemUsageGroupId,
    targetPlayerId: action.targetPlayerId,
    emote: action.emote,
    reason: action.reason,
    audit: action.audit,
    error,
    decidedAt: now
  });
}
