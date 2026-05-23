import {
  finishRound,
  passAuction,
  revealNextItem,
  setRoundPhase,
  settleCurrentRound,
  startNextRound
} from '@bitkingdom/match-core';
import { revealDelayForItem } from './roomActionRuntime';
import { runBotAuctionForRoom } from './roomBotRuntime';
import {
  CORE_AUCTIONEER_REVEAL_MS,
  CORE_AUCTION_MS,
  CORE_ROUND_INTEL_MS,
  CORE_WAREHOUSE_SELECTED_MS
} from './roomRuntimeConfig';
import {
  scheduleRoomTimer
} from './roomLifecycleRuntime';
import type { Room } from './roomLifecycleRuntime';

type ActiveRound = NonNullable<NonNullable<Room['match']>['currentRound']>;

interface RoomRoundRuntimeDeps {
  broadcastRoom(room: Room): void;
  broadcastMatch(room: Room): void;
  settleProfilesForEndedMatch(room: Room): void;
  logRoundEvent(event: string, context: Record<string, unknown>): void;
  warnRoundIssue(error: unknown, event: string, context: Record<string, unknown>): void;
  warnSettleFailed(error: unknown): void;
}

export interface RoomRoundRuntime {
  runCoreRound(room: Room): void;
  maybeSettleEarly(room: Room): void;
}

export function createRoomRoundRuntime(deps: RoomRoundRuntimeDeps): RoomRoundRuntime {
  const settleFailureCountByRound = new Map<string, number>();
  const scheduledTimerKeys = new Set<string>();

  function runCoreRound(room: Room): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || match.status !== 'playing' || !round) {
      return;
    }
    deps.logRoundEvent('core_round_pulse', roundLogContext(room));
    if (round.phase === 'warehouse_roll') {
      schedulePhaseTransition(room, 'warehouse_selected', CORE_WAREHOUSE_SELECTED_MS, 'select_core_warehouse');
      return;
    }
    if (round.phase === 'warehouse_selected') {
      schedulePhaseTransition(room, 'auctioneer_reveal', CORE_AUCTIONEER_REVEAL_MS, 'reveal_auctioneer_clue');
      return;
    }
    if (round.phase === 'auctioneer_reveal') {
      schedulePhaseTransition(room, 'intel', CORE_ROUND_INTEL_MS, 'start_intel_phase');
      return;
    }
    if (round.phase === 'intel') {
      runBotActionsOnceForPhase(room, 'intel');
      deps.broadcastMatch(room);
      schedulePhaseTransition(room, 'auction', auctionDurationMs(round), 'start_auction_phase');
      return;
    }
    runBotAuctionForRoom(room);
    deps.broadcastMatch(room);
    maybeSettleEarly(room);
    if (room.match?.currentRound?.phase !== 'auction') {
      return;
    }
    const remainingMs = Math.max(1000, round.phaseEndsAt - Date.now());
    scheduleRoundTimer(room, remainingMs, 'settle_room_round', () => settleRoomRound(room));
  }

  function schedulePhaseTransition(
    room: Room,
    nextPhase: ActiveRound['phase'],
    durationMs: number,
    reason: string
  ): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || !round) {
      return;
    }
    const currentRoundId = round.id;
    const currentPhase = round.phase;
    const remainingMs = Math.max(0, round.phaseEndsAt - Date.now());
    scheduleRoundTimer(room, remainingMs, reason, () => {
      if (!room.match || room.match.currentRound?.id !== currentRoundId || room.match.currentRound.phase !== currentPhase) {
        return;
      }
      setRoundPhase(room.match, nextPhase, durationMs);
      deps.broadcastMatch(room);
      runCoreRound(room);
    });
  }

  function runBotActionsOnceForPhase(room: Room, phase: 'intel'): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || !round || round.phase !== phase || botPhaseActionRecorded(room, phase)) {
      return;
    }
    runBotAuctionForRoom(room);
  }

  function botPhaseActionRecorded(room: Room, phase: 'intel'): boolean {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || !round) {
      return false;
    }
    const botIds = match.players.filter((player) => player.kind === 'bot').map((player) => player.id);
    if (botIds.length === 0) {
      return true;
    }
    return botIds.every((playerId) => match.events.some((event) => {
      const payload = event.payload as { roundId?: string; audit?: { phase?: string } } | undefined;
      return (event.type === 'bot_action_chosen' || event.type === 'bot_action_failed')
        && event.actorId === playerId
        && payload?.roundId === round.id
        && payload.audit?.phase === phase;
    }));
  }

  function auctionDurationMs(round: ActiveRound): number {
    return Math.max(1000, round.container.auctionDurationMs ?? CORE_AUCTION_MS);
  }

  function settleRoomRound(room: Room): void {
    if (!room.match || room.match.currentRound?.phase !== 'auction') {
      return;
    }
    const round = room.match.currentRound;
    deps.logRoundEvent('auction_settle_started', roundLogContext(room));
    for (const player of room.match.players) {
      if (!player.hasSubmittedBid) {
        try {
          passAuction(room.match, player.id);
          deps.logRoundEvent('auction_auto_passed_player', {
            ...roundLogContext(room),
            playerId: player.id
          });
        } catch (error) {
          deps.warnRoundIssue(error, 'auction_auto_pass_failed', {
            ...roundLogContext(room),
            playerId: player.id
          });
        }
      }
    }
    try {
      settleCurrentRound(room.match);
      settleFailureCountByRound.delete(round.id);
    } catch (error) {
      const failureCount = (settleFailureCountByRound.get(round.id) ?? 0) + 1;
      settleFailureCountByRound.set(round.id, failureCount);
      deps.warnRoundIssue(error, 'auction_settle_failed', {
        ...roundLogContext(room),
        failureCount
      });
      deps.warnSettleFailed(error);
      if (failureCount < 3) {
        scheduleRoundTimer(room, 1200, 'settle_room_round_retry', () => settleRoomRound(room));
      }
      return;
    }
    deps.logRoundEvent('auction_settled', roundLogContext(room));
    deps.broadcastMatch(room);
    if (room.match.currentRound?.settlement?.isFinal === false) {
      const feedbackDuration = Math.max(1000, room.match.currentRound.phaseEndsAt - Date.now());
      scheduleRoundTimer(room, feedbackDuration, 'finish_interim_round', () => finishAndContinue(room));
      return;
    }
    scheduleRoundTimer(room, 700, 'reveal_tick', () => revealTick(room));
  }

  function revealTick(room: Room): void {
    if (!room.match || room.match.currentRound?.phase !== 'reveal') {
      return;
    }
    const revealIndex = room.match.currentRound.revealedItems.length;
    revealNextItem(room.match);
    const revealedItem = room.match.currentRound.revealedItems[revealIndex];
    deps.broadcastMatch(room);
    if (room.match.currentRound.phase === 'reveal') {
      scheduleRoundTimer(room, revealDelayForItem(revealedItem), 'reveal_tick', () => revealTick(room));
      return;
    }
    scheduleRoundTimer(room, 8000, 'finish_final_round', () => finishAndContinue(room));
  }

  function finishAndContinue(room: Room): void {
    if (!room.match) {
      return;
    }
    finishRound(room.match);
    startNextRound(room.match);
    if (room.match.status === 'ended') {
      room.status = 'ended';
      deps.settleProfilesForEndedMatch(room);
      deps.broadcastRoom(room);
      deps.broadcastMatch(room);
      return;
    }
    deps.broadcastMatch(room);
    deps.logRoundEvent('round_finished_continue', roundLogContext(room));
    runCoreRound(room);
  }

  function maybeSettleEarly(room: Room): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || !round || round.phase !== 'auction') {
      return;
    }
    if (match.players.every((player) => player.hasSubmittedBid || player.passed)) {
      deps.logRoundEvent('auction_all_players_done', roundLogContext(room));
      settleRoomRound(room);
    }
  }

  function scheduleRoundTimer(room: Room, ms: number, reason: string, callback: () => void): void {
    const key = roundTimerKey(room, reason);
    if (scheduledTimerKeys.has(key)) {
      return;
    }
    scheduledTimerKeys.add(key);
    deps.logRoundEvent('round_timer_scheduled', {
      ...roundLogContext(room),
      reason,
      delayMs: ms,
      nextTimerCount: room.timers.length + 1
    });
    scheduleRoomTimer(room, ms, () => {
      scheduledTimerKeys.delete(key);
      deps.logRoundEvent('round_timer_fired', {
        ...roundLogContext(room),
        reason
      });
      try {
        callback();
      } catch (error) {
        deps.warnRoundIssue(error, 'round_timer_callback_failed', {
          ...roundLogContext(room),
          reason
        });
      }
    });
  }

  function roundTimerKey(room: Room, reason: string): string {
    const round = room.match?.currentRound;
    return [
      room.id,
      round?.id ?? 'no-round',
      round?.phase ?? 'no-phase',
      round?.phaseEndsAt ?? 0,
      reason
    ].join(':');
  }

  function roundLogContext(room: Room): Record<string, unknown> {
    const match = room.match;
    const round = match?.currentRound;
    const now = Date.now();
    return {
      roomCode: room.code,
      roomStatus: room.status,
      matchId: match?.id,
      matchStatus: match?.status,
      roundId: round?.id,
      roundIndex: round?.index,
      totalRounds: match?.totalRounds,
      phase: round?.phase,
      auctionMode: round?.auctionMode,
      phaseEndsAt: round?.phaseEndsAt,
      phaseRemainingMs: round ? round.phaseEndsAt - now : undefined,
      bidCount: round?.bids.length,
      positiveBidCount: round?.bids.filter((bid) => bid.amount > 0).length,
      submittedCount: match?.players.filter((player) => player.hasSubmittedBid).length,
      passedCount: match?.players.filter((player) => player.passed).length,
      timerCount: room.timers.length,
      players: match?.players.map((player) => ({
        id: player.id,
        kind: player.kind,
        status: player.status,
        submitted: player.hasSubmittedBid,
        passed: player.passed,
        cash: player.cash
      }))
    };
  }

  return {
    runCoreRound,
    maybeSettleEarly
  };
}
