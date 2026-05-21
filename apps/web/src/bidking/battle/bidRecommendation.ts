import type { PlayerSnapshot } from '@bitkingdom/shared';

export function calculateRecommendedBid(snapshot: PlayerSnapshot): { safePrice: number; reason: string } | undefined {
  const round = snapshot.public.currentRound;
  const self = snapshot.public.players.find((player) => player.id === snapshot.private?.playerId);
  if (!round || !self) {
    return undefined;
  }
  const clueRanges = [
    ...round.publicClues,
    ...(snapshot.private?.privateClues ?? [])
  ].map((clue) => clue.valueHint).filter(Boolean) as Array<{ min: number; max: number }>;
  const range = clueRanges[clueRanges.length - 1] ?? {
    min: round.container.estimateMin,
    max: round.container.estimateMax
  };
  const riskFactor = round.container.risk === 'high' ? 0.62 : round.container.risk === 'medium' ? 0.72 : 0.82;
  const modeFactor = round.auctionMode === 'second_price' ? 1.08 : round.auctionMode === 'flash' ? 0.9 : 1;
  const safePrice = Math.max(0, Math.min(self.cash, Math.round(range.max * riskFactor * modeFactor / 1000) * 1000));
  return {
    safePrice,
    reason: clueRanges.length > 0 ? '基于已掌握价值线索' : '基于公共估值和风险等级'
  };
}
