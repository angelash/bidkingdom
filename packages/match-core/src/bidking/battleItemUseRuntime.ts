import type { MatchRuntimeState } from '../types';
import { bidKingGameDataSystemLimitsForSkillIds } from './systemEffectRuntime';

export function bidKingBattleItemUseLimitThisRound(state: MatchRuntimeState): number {
  return bidKingGameDataSystemLimitsForSkillIds(state.bidKingActiveSystemSkillIds).roundCanUseItemCount;
}

export function bidKingBattleItemUsesThisRound(
  state: MatchRuntimeState,
  playerId: string,
  roundId = state.currentRound?.id
): number {
  if (!roundId) {
    return 0;
  }
  return state.events.filter((event) => {
    if (event.type !== 'battle_item_used' || event.actorId !== playerId) {
      return false;
    }
    const payload = event.payload as { roundId?: unknown; entry?: { id?: unknown } } | undefined;
    return payload?.roundId === roundId
      || (typeof payload?.entry?.id === 'string' && payload.entry.id.startsWith(`${roundId}_battle_item_${playerId}_`));
  }).length;
}

export function bidKingBattleItemUsesRemainingThisRound(
  state: MatchRuntimeState,
  playerId: string
): number {
  return Math.max(0, bidKingBattleItemUseLimitThisRound(state) - bidKingBattleItemUsesThisRound(state, playerId));
}
