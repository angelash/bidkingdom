import { gameConfig } from '@bitkingdom/config';
import { createMatch, startNextRound } from '@bitkingdom/match-core';
import { RankMap } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import {
  createHumanRoomPlayer,
  createRoomState,
  fillRoomBots,
  markSocketDisconnected,
  markSocketRejoined,
  replaceLobbyPlayerWithBot,
  roomPlayerCapacity,
  syncRoomBotsForBidMap
} from '../src/domain/battle/roomLifecycleRuntime';
import { snapshotRoom } from '../src/domain/battle/roomLobbyRuntime';
import { languageNameFromSeed } from '../src/domain/profile/languageNameRuntime';

describe('BidKing room lifecycle runtime', () => {
  it('restores room and runtime player status when a human reconnects', () => {
    const room = createRoomState({
      id: 'room_reconnect',
      code: 'RECO',
      hostId: 'p1',
      botCount: 0,
      totalRounds: 3,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed'
    });
    room.players.push(createHumanRoomPlayer({
      id: 'p1',
      name: '甲',
      roleId: gameConfig.roles[0]!.id,
      socketId: 'socket_old'
    }));
    room.status = 'playing';
    room.match = createMatch({
      id: 'match_reconnect',
      seed: 9090,
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: gameConfig.roles[0]!.id },
        { id: 'b1', name: '乙', kind: 'bot', roleId: gameConfig.roles[1]!.id },
        { id: 'b2', name: '丙', kind: 'bot', roleId: gameConfig.roles[2]!.id },
        { id: 'b3', name: '丁', kind: 'bot', roleId: gameConfig.roles[3]!.id }
      ],
      config: gameConfig,
      now: 1000
    });
    startNextRound(room.match, 2000);

    markSocketDisconnected(room, 'p1', 'socket_old');
    expect(room.players[0]?.status).toBe('disconnected');
    expect(room.match.players[0]?.status).toBe('disconnected');

    expect(markSocketRejoined(room, 'p1', 'socket_new')).toBe(true);
    expect(room.players[0]?.socketId).toBe('socket_new');
    expect(room.players[0]?.status).toBe('playing');
    expect(room.match.players[0]?.status).toBe('playing');
  });

  it('names filled and replacement bots through LanguageName rows', () => {
    const room = createRoomState({
      id: 'room_language_bot_names',
      code: 'LANG',
      hostId: 'p1',
      botCount: 3,
      totalRounds: 3,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed'
    });
    room.players.push(createHumanRoomPlayer({
      id: 'p1',
      name: '甲',
      roleId: gameConfig.roles[0]!.id,
      socketId: 'socket_1'
    }));

    fillRoomBots(room, (seat) => `bot_${seat}`);

    expect(room.players.slice(1).map((player) => player.name)).toEqual([
      languageNameFromSeed(10_001),
      languageNameFromSeed(10_002),
      languageNameFromSeed(10_003)
    ]);

    replaceLobbyPlayerWithBot(room, 'p1', (seat) => `bot_replacement_${seat}`);

    expect(room.players[0]).toEqual(expect.objectContaining({
      kind: 'bot',
      name: languageNameFromSeed(10_000)
    }));
  });

  it('bounds human role selection to source Hero-backed bidder rows', () => {
    const extraRole = gameConfig.roles[20]!;
    const player = createHumanRoomPlayer({
      id: 'p_extra_role',
      name: '甲',
      roleId: extraRole.id,
      socketId: 'socket_extra_role'
    });

    expect(player.roleId).toBe(gameConfig.roles[0]!.id);
  });

  it('previews original BidKing initial cash tiers before the match starts', () => {
    const room = createRoomState({
      id: 'room_initial_cash',
      code: 'CASH',
      hostId: 'p1',
      botCount: 0,
      totalRounds: 3,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed',
      selectedBidMapId: 2601
    });
    room.players.push(createHumanRoomPlayer({
      id: 'p1',
      name: '甲',
      roleId: gameConfig.roles[0]!.id,
      socketId: 'socket_cash'
    }));

    const snapshot = snapshotRoom(room);

    expect(snapshot.initialCash).toBe(3_000_000);
    expect(snapshot.players[0]?.cash).toBe(3_000_000);
  });

  it('sizes rooms and bot heroes from selected BidMap and RankMap rows', () => {
    const sourceHeroIds = new Set(RankMap.find((row) => row.id === 2101)?.role_spawn.map(([heroId]) => heroId));
    const room = createRoomState({
      id: 'room_rankmap_bots',
      code: 'RMAP',
      hostId: 'p1',
      botCount: 3,
      totalRounds: 3,
      initialCash: gameConfig.rules.initialCash,
      coreAuctionMode: 'sealed',
      selectedBidMapId: 2101
    });
    room.players.push(createHumanRoomPlayer({
      id: 'p1',
      name: '甲',
      roleId: gameConfig.roles[0]!.id,
      heroCid: 101,
      socketId: 'socket_rankmap'
    }));

    fillRoomBots(room, (seat) => `bot_${seat}`);

    expect(roomPlayerCapacity(room)).toBe(2);
    expect(room.players).toHaveLength(2);
    expect(room.players[1]).toEqual(expect.objectContaining({ kind: 'bot' }));
    expect(room.players[1]?.heroCid).not.toBe(101);
    expect(sourceHeroIds.has(room.players[1]?.heroCid ?? 0)).toBe(true);
    expect(snapshotRoom(room).maxPlayers).toBe(2);

    room.selectedBidMapId = 2601;
    syncRoomBotsForBidMap(room, (seat) => `bot_grow_${seat}`);
    expect(room.players).toHaveLength(4);

    room.selectedBidMapId = 2101;
    syncRoomBotsForBidMap(room, (seat) => `bot_trim_${seat}`);
    expect(room.players.map((player) => player.id)).toContain('p1');
    expect(room.players).toHaveLength(2);
  });
});
