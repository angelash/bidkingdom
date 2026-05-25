import { requirePlayer, requireRound } from './match';
import type { MatchRuntimeState } from './types';

export function useSkill(
  state: MatchRuntimeState,
  playerId: string,
  targetPlayerId?: string,
  now = Date.now()
): MatchRuntimeState {
  const round = requireRound(state);
  const player = requirePlayer(state, playerId);

  void round;
  void player;
  void targetPlayerId;
  void now;
  throw new Error('BidKing hero skills are automatic');
}
