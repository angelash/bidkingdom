import { gameConfig } from '@bitkingdom/config';
import { createMatch, setRoundPhase, startNextRound } from '@bitkingdom/match-core';
import { describe, expect, it } from 'vitest';
import { runBotAuctionForRoom } from '../src/domain/battle/roomBotRuntime';
import type { Room } from '../src/domain/battle/roomLifecycleRuntime';

describe('BidKing room bot runtime', () => {
  it('records bot decision audit events for admin replay', () => {
    const match = createMatch({
      id: 'bot-audit-match',
      seed: 30303,
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: gameConfig.roles[0]!.id },
        { id: 'b1', name: '乙', kind: 'bot', roleId: gameConfig.roles[1]!.id },
        { id: 'b2', name: '丙', kind: 'bot', roleId: gameConfig.roles[2]!.id },
        { id: 'b3', name: '丁', kind: 'bot', roleId: gameConfig.roles[3]!.id }
      ],
      config: gameConfig,
      now: 1000
    });
    startNextRound(match, 2000);
    setRoundPhase(match, 'auction', 30000, 3000);
    const room: Room = {
      id: 'room_bot_audit',
      code: 'BOTA',
      hostId: 'p1',
      botCount: 3,
      totalRounds: 3,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed',
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

    runBotAuctionForRoom(room);

    const botEvents = match.events.filter((event) => event.type === 'bot_action_chosen');
    expect(botEvents.length).toBeGreaterThan(0);
    const payload = botEvents[0]!.payload as {
      actionType: string;
      reason: string;
      audit: {
        profileId: string;
        phase: string;
        auctionMode: string;
        riskAppetite: number;
        estimate?: number;
        maxBid?: number;
      };
    };
    expect(['bid', 'pass', 'skill', 'emote']).toContain(payload.actionType);
    expect(payload.reason.length).toBeGreaterThan(0);
    expect(payload.audit).toEqual(expect.objectContaining({
      phase: 'auction',
      auctionMode: match.currentRound!.auctionMode,
      riskAppetite: expect.any(Number)
    }));
    expect(['mentor', 'risk_taker', 'clue_reader']).toContain(payload.audit.profileId);
  });

  it('lets behavior-tree bots use skills during the intel phase', () => {
    const match = createMatch({
      id: 'bot-intel-match',
      seed: 40404,
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: gameConfig.roles[0]!.id },
        { id: 'b1', name: '乙', kind: 'bot', roleId: gameConfig.roles[0]!.id },
        { id: 'b2', name: '丙', kind: 'bot', roleId: gameConfig.roles[1]!.id },
        { id: 'b3', name: '丁', kind: 'bot', roleId: gameConfig.roles[4]!.id }
      ],
      totalRounds: 5,
      coreMode: true,
      coreAuctionMode: 'sealed',
      config: gameConfig,
      now: 1000
    });
    for (const player of match.players) {
      player.cash = 1_000_000;
    }
    startNextRound(match, 2000);
    match.currentRound!.container.publicInfo.risk = 'high';
    match.currentRound!.container.publicInfo.estimateMin = 10_000;
    match.currentRound!.container.publicInfo.estimateMax = 900_000;
    for (const player of match.players.filter((candidate) => candidate.kind === 'bot')) {
      player.privateClues = [];
      player.skillCooldown = 0;
      player.skillUsesRemaining = 2;
      player.skillUsedThisRound = false;
    }
    setRoundPhase(match, 'intel', 15000, 3000);
    const room: Room = {
      id: 'room_bot_intel',
      code: 'BTIN',
      hostId: 'p1',
      botCount: 3,
      totalRounds: 5,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed',
      status: 'playing',
      players: [],
      botProfiles: new Map([
        ['b1', 'clue_reader'],
        ['b2', 'clue_reader'],
        ['b3', 'clue_reader']
      ]),
      match,
      timers: []
    };

    runBotAuctionForRoom(room);

    const skillEvents = match.events.filter((event) => event.type === 'skill_used' && event.actorId?.startsWith('b'));
    expect(skillEvents.length).toBeGreaterThan(0);
    const botChoice = match.events.find((event) => {
      const payload = event.payload as { actionType?: string } | undefined;
      return event.type === 'bot_action_chosen' && payload?.actionType === 'skill';
    });
    expect(botChoice?.payload).toEqual(expect.objectContaining({
      actionType: 'skill',
      audit: expect.objectContaining({
        phase: 'intel',
        behaviorTree: expect.arrayContaining(['IntelSkillSequence']),
        confidence: expect.any(Number),
        skillIntent: expect.any(String)
      })
    }));
  });
});
