import {
  finishRound,
  passAuction,
  revealNextItem,
  setRoundPhase,
  settleCurrentRound,
  startNextRound
} from '@bitkingdom/match-core';
import {
  CORE_AUCTIONEER_REVEAL_MS,
  CORE_AUCTION_MS,
  CORE_ROUND_INTEL_MS,
  CORE_WAREHOUSE_SELECTED_MS
} from './roomRuntimeConfig';
import { revealDelayForItem } from './roomActionRuntime';
import { runBotAuctionForRoom } from './roomBotRuntime';
import {
  scheduleRoomTimer
} from './roomLifecycleRuntime';
import type { Room } from './roomLifecycleRuntime';

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

  function runCoreRound(room: Room): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || match.status !== 'playing' || !round) {
      return;
    }
    deps.logRoundEvent('core_round_pulse', roundLogContext(room));
    if (round.phase === 'intel') {
      runBotAuctionForRoom(room);
      deps.broadcastMatch(room);
    }
    if (['warehouse_roll', 'warehouse_selected', 'auctioneer_reveal', 'intel'].includes(round.phase)) {
      const remainingMs = Math.max(350, round.phaseEndsAt - Date.now());
      scheduleRoundTimer(room, remainingMs, 'advance_core_phase', () => advanceCorePhase(room));
      return;
    }
    if (round.phase !== 'auction') {
      return;
    }
    runBotAuctionForRoom(room);
    deps.broadcastMatch(room);
    const remainingMs = Math.max(1000, round.phaseEndsAt - Date.now());
    scheduleRoundTimer(room, remainingMs, 'settle_room_round', () => settleRoomRound(room));
    if (round.auctionMode === 'open') {
      scheduleRoundTimer(room, 3500, 'open_bot_tick', () => openBotTick(room));
    }
  }

  function advanceCorePhase(room: Room): void {
    const match = room.match;
    const round = match?.currentRound;
    if (!match || match.status !== 'playing' || !round) {
      return;
    }
    const now = Date.now();
    if (round.phaseEndsAt > now + 120) {
      scheduleRoundTimer(room, Math.max(250, round.phaseEndsAt - now), 'advance_core_phase_wait', () => advanceCorePhase(room));
      return;
    }
    const fromPhase = round.phase;
    if (round.phase === 'warehouse_roll') {
      setRoundPhase(match, 'warehouse_selected', CORE_WAREHOUSE_SELECTED_MS, now);
    } else if (round.phase === 'warehouse_selected') {
      setRoundPhase(match, 'auctioneer_reveal', CORE_AUCTIONEER_REVEAL_MS, now);
    } else if (round.phase === 'auctioneer_reveal') {
      setRoundPhase(match, 'intel', CORE_ROUND_INTEL_MS, now);
    } else if (round.phase === 'intel') {
      setRoundPhase(match, 'auction', round.container.auctionDurationMs ?? CORE_AUCTION_MS, now);
    } else {
      return;
    }
    deps.logRoundEvent('core_phase_advanced', {
      ...roundLogContext(room),
      fromPhase,
      toPhase: match.currentRound?.phase
    });
    deps.broadcastMatch(room);
    runCoreRound(room);
  }

  function openBotTick(room: Room): void {
    if (
      !room.match ||
      room.match.currentRound?.phase !== 'auction' ||
      !['open', 'deposit_open'].includes(room.match.currentRound.auctionMode)
    ) {
      return;
    }
    runBotAuctionForRoom(room);
    deps.broadcastMatch(room);
    maybeSettleEarly(room);
    if (room.match?.currentRound?.phase === 'auction') {
      scheduleRoundTimer(room, 3500, 'open_bot_tick', () => openBotTick(room));
    }
  }

  function settleRoomRound(room: Room): void {
    if (!room.match || room.match.currentRound?.phase !== 'auction') {
      return;
    }
    const round = room.match.currentRound;
    deps.logRoundEvent('auction_settle_started', roundLogContext(room));
    for (const player of room.match.players) {
      if (!player.hasSubmittedBid && room.match.currentRound.auctionMode !== 'open') {
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
    deps.logRoundEvent('round_timer_scheduled', {
      ...roundLogContext(room),
      reason,
      delayMs: ms,
      nextTimerCount: room.timers.length + 1
    });
    scheduleRoomTimer(room, ms, () => {
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
