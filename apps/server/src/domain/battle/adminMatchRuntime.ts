import { buildSnapshot, getPublicMatchState } from '@bitkingdom/match-core';
import type { MatchRuntimeState } from '@bitkingdom/match-core';
import type {
  AdminMatchDetail,
  AdminMatchListItem,
  AdminRoundReplay,
  MatchEventLog
} from '@bitkingdom/shared';

export interface AdminMatchRoom {
  id: string;
  code: string;
}

export function buildAdminMatchDetail(room: AdminMatchRoom, match: MatchRuntimeState): AdminMatchDetail {
  return {
    summary: buildAdminMatchSummary(room, match),
    publicState: getPublicMatchState(match),
    rounds: buildRoundReplay(match),
    events: match.events,
    transactions: match.transactions
  };
}

export function buildAdminMatchSummary(room: AdminMatchRoom, match: MatchRuntimeState): AdminMatchListItem {
  const rankings = match.finalSummary?.rankings;
  const winner = rankings?.[0];
  return {
    matchId: match.id,
    roomId: room.id,
    roomCode: room.code,
    status: match.status,
    roundIndex: match.roundIndex,
    totalRounds: match.totalRounds,
    players: match.players.map((player) => {
      const publicState = buildSnapshot(match, player.id).public.players.find((candidate) => candidate.id === player.id);
      return {
        id: player.id,
        seat: player.seat,
        name: player.name,
        kind: player.kind,
        roleId: player.roleId,
        cash: player.cash,
        netWorth: publicState?.netWorth ?? player.cash
      };
    }),
    winnerId: winner?.playerId,
    winnerName: winner?.name,
    winnerNetWorth: winner?.netWorth,
    eventCount: match.events.length,
    transactionCount: match.transactions.length,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}

export function buildRoundReplay(match: MatchRuntimeState): AdminRoundReplay[] {
  const eventsByRound = groupEventsByRound(match.events);
  const transactionsByRound = new Map<string, typeof match.transactions>();
  for (const tx of match.transactions) {
    if (!tx.roundId) {
      continue;
    }
    transactionsByRound.set(tx.roundId, [...(transactionsByRound.get(tx.roundId) ?? []), tx]);
  }

  const replayRounds: AdminRoundReplay[] = match.roundHistory.map((round) => ({
    roundId: round.roundId,
    index: round.index,
    label: `第${round.index + 1}轮`,
    containerName: round.containerName,
    auctionMode: round.auctionMode,
    publicClues: round.publicClues,
    privateCluesByPlayerId: round.privateCluesByPlayerId,
    bids: round.bids,
    skillFeed: round.skillFeed,
    ...(round.winnerId ? { winnerId: round.winnerId } : {}),
    payment: round.payment,
    trueValue: round.trueValue,
    profit: round.profit,
    title: round.title,
    revealedItems: round.revealedItems,
    settlement: round.settlement,
    events: eventsByRound.get(round.roundId) ?? [],
    transactions: transactionsByRound.get(round.roundId) ?? []
  }));

  const activeRound = match.currentRound;
  const hasActiveRound = activeRound && !replayRounds.some((round) => round.roundId === activeRound.id);
  if (activeRound && hasActiveRound) {
    const settlement = activeRound.settlement;
    replayRounds.push({
      roundId: activeRound.id,
      index: activeRound.index,
      label: `第${activeRound.index + 1}轮`,
      containerName: activeRound.container.publicInfo.name,
      auctionMode: activeRound.auctionMode,
      publicClues: activeRound.container.publicClues,
      privateCluesByPlayerId: Object.fromEntries(
        match.players.map((player) => [player.id, player.privateClues])
      ),
      bids: activeRound.bids,
      skillFeed: activeRound.skillFeed,
      ...(settlement?.winnerId ? { winnerId: settlement.winnerId } : {}),
      ...(settlement ? {
        payment: settlement.payment,
        trueValue: settlement.trueValue,
        profit: settlement.profit,
        title: settlement.title
      } : {}),
      revealedItems: activeRound.revealedItems,
      settlement,
      events: eventsByRound.get(activeRound.id) ?? [],
      transactions: transactionsByRound.get(activeRound.id) ?? []
    });
  }

  return replayRounds.sort((left, right) => left.index - right.index);
}

function groupEventsByRound(events: MatchEventLog[]): Map<string, MatchEventLog[]> {
  const grouped = new Map<string, MatchEventLog[]>();
  for (const event of events) {
    if (!event.roundId) {
      continue;
    }
    grouped.set(event.roundId, [...(grouped.get(event.roundId) ?? []), event]);
  }
  return grouped;
}
