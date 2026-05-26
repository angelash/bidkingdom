import { gameConfig } from '@bitkingdom/config';
import { createMatch, setRoundPhase, startNextRound } from '@bitkingdom/match-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoomRoundRuntime } from '../src/domain/battle/roomRoundRuntime';
import type { Room } from '../src/domain/battle/roomLifecycleRuntime';

const players = [
  { id: 'p1', name: 'Player', kind: 'human' as const, roleId: gameConfig.roles[0]!.id },
  { id: 'b1', name: 'Bot 1', kind: 'bot' as const, roleId: gameConfig.roles[1]!.id },
  { id: 'b2', name: 'Bot 2', kind: 'bot' as const, roleId: gameConfig.roles[2]!.id },
  { id: 'b3', name: 'Bot 3', kind: 'bot' as const, roleId: gameConfig.roles[3]!.id }
];

describe('room round runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores stale settle timers from earlier rounds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const match = createMatch({
      id: 'stale-round-timer',
      seed: 52525,
      players,
      totalRounds: 5,
      coreMode: true,
      coreAuctionMode: 'open',
      coreBidMapId: 2601,
      config: gameConfig,
      now: Date.now()
    });
    for (const player of match.players) {
      player.cash = 1_000_000;
    }
    startNextRound(match, Date.now());
    setRoundPhase(match, 'auction', 60_000, Date.now());
    const room: Room = {
      id: 'room-stale-round-timer',
      code: 'STAL',
      hostId: 'p1',
      botCount: 3,
      totalRounds: 5,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'open',
      selectedBidMapId: 2601,
      status: 'playing',
      players: [],
      botProfiles: new Map([
        ['b1', 'mentor'],
        ['b2', 'risk_taker'],
        ['b3', 'clue_reader']
      ]),
      match,
      timers: []
    };
    const events: string[] = [];
    const runtime = createRoomRoundRuntime({
      broadcastRoom: () => undefined,
      broadcastMatch: () => undefined,
      settleProfilesForEndedMatch: () => undefined,
      logRoundEvent: (event) => events.push(event),
      warnRoundIssue: () => undefined,
      warnSettleFailed: () => undefined
    });

    runtime.runCoreRound(room);
    expect(room.timers).toHaveLength(1);
    expect(match.currentRound?.phase).toBe('auction');
    expect(match.players.find((player) => player.id === 'p1')?.hasSubmittedBid).toBe(false);

    startNextRound(match, Date.now() + 1_000);
    setRoundPhase(match, 'auction', 60_000, Date.now() + 1_000);
    expect(match.currentRound?.index).toBe(1);
    expect(match.currentRound?.phase).toBe('auction');

    await vi.advanceTimersByTimeAsync(60_000);

    expect(events).toContain('round_timer_stale');
    expect(match.currentRound?.index).toBe(1);
    expect(match.currentRound?.phase).toBe('auction');
    expect(match.players.find((player) => player.id === 'p1')?.hasSubmittedBid).toBe(false);
    expect(match.players.find((player) => player.id === 'p1')?.passed).toBe(false);
  });
});
