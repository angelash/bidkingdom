import { gameConfig } from '@bitkingdom/config';
import {
  bidKingInitialCashChoices,
  bidKingInitialCashForBidMap,
  bidKingDefaultBidGameCount,
  bidKingMaxBotCount,
  createMatch,
  passAuction,
  pushEvent,
  startNextRound,
  submitBid,
  useBattleItem,
  useSkill
} from '@bitkingdom/match-core';
import type { MatchRuntimeState } from '@bitkingdom/match-core';
import type {
  AdminMatchDetail,
  AdminMatchListItem,
  ClientToServerEvents,
  CoreAuctionMode,
  RoomSnapshot,
  ServerToClientEvents
} from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Server, Socket } from 'socket.io';
import {
  buildAdminMatchDetail,
  buildAdminMatchSummary
} from './domain/battle/adminMatchRuntime';
import {
  applyEmojiRuntime,
  assertBattleItemPhase,
  emojiHeroIdForSeat,
  emojiForPayload,
  resolveBattleItem
} from './domain/battle/roomActionRuntime';
import { createRoomBroadcastRuntime } from './domain/battle/roomBroadcastRuntime';
import { inventoryRecord } from './domain/profile/profileInventory';
import { createRoomRoundRuntime } from './domain/battle/roomRoundRuntime';
import {
  snapshotRoom,
  validBidMapId,
  validCoreAuctionMode
} from './domain/battle/roomLobbyRuntime';
import {
  addHumanPlayerToRoom,
  connectedHumanPlayers,
  clearRoomTimers,
  createHumanRoomPlayer,
  createRoomState,
  createUniqueRoomCode,
  fillRoomBots,
  markSocketDisconnected,
  markSocketLeftRoom,
  markSocketRejoined,
  replaceLobbyPlayerWithBot
} from './domain/battle/roomLifecycleRuntime';
import type { Room } from './domain/battle/roomLifecycleRuntime';
import { appendServerLog } from './services/serverLogSink';
import type { ProfileService } from './services/profileService';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RoomManager {
  bindSocket(socket: AppSocket): void;
  listRooms(): RoomSnapshot[];
  listMatches(): AdminMatchListItem[];
  getMatchDetail(matchId: string): AdminMatchDetail | undefined;
  findMatch(matchId: string): MatchRuntimeState | undefined;
}

export function createRoomManager(io: AppServer, log: FastifyBaseLogger, services: { profiles: ProfileService }): RoomManager {
  const rooms = new Map<string, Room>();
  const socketToRoom = new Map<string, string>();
  const socketToPlayer = new Map<string, string>();
  const emojiCooldowns = new Map<string, number>();
  const broadcasts = createRoomBroadcastRuntime(io, services.profiles);
  const roundRuntime = createRoomRoundRuntime({
    broadcastRoom: broadcasts.broadcastRoom,
    broadcastMatch: broadcasts.broadcastMatch,
    settleProfilesForEndedMatch,
    logRoundEvent(event, context) {
      log.info(context, event);
      appendServerLog('info', event, context);
    },
    warnRoundIssue(error, event, context) {
      log.warn({ ...context, error }, event);
      appendServerLog('warn', event, { ...context, error });
    },
    warnSettleFailed(error) {
      log.warn({ error }, 'settle failed');
      appendServerLog('warn', 'settle_failed', { error });
    }
  });
  const maxBotCount = bidKingMaxBotCount(3);

  function bindSocket(socket: AppSocket): void {
    socket.on('createRoom', (payload, ack) => {
      const room = createRoom(
        socket,
        payload.playerName,
        payload.roleId,
        payload.botCount ?? maxBotCount,
        payload.coreAuctionMode,
        payload.selectedBidMapId,
        payload.initialCash,
        payload.profileId
      );
      const selfPlayerId = socketToPlayer.get(socket.id);
      ack({ room: snapshotRoom(room), selfPlayerId: selfPlayerId ?? room.hostId });
      broadcasts.emitProfileSnapshot(socket, selfPlayerId ?? room.hostId);
      broadcasts.broadcastRoom(room);
    });

    socket.on('joinRoom', (payload, ack) => {
      const room = rooms.get(payload.roomCode.trim().toUpperCase());
      if (!room) {
        ack({ ok: false, error: '房间不存在' });
        return;
      }
      if (room.status !== 'lobby') {
        ack({ ok: false, error: '对局已经开始' });
        return;
      }
      const player = addHumanToRoom(room, socket, payload.playerName, payload.roleId, payload.profileId);
      if (!player) {
        ack({ ok: false, error: '房间已满' });
        return;
      }
      ack({ ok: true, room: snapshotRoom(room), selfPlayerId: player.id });
      broadcasts.emitProfileSnapshot(socket, player.id);
      broadcasts.broadcastRoom(room);
    });

    socket.on('rejoinRoom', (payload, ack) => {
      const room = rooms.get(payload.roomCode.trim().toUpperCase());
      if (!room) {
        ack({ ok: false, error: '房间不存在' });
        return;
      }
      const player = room.players.find((candidate) => candidate.id === payload.playerId && candidate.kind === 'human');
      if (!player) {
        ack({ ok: false, error: '席位不存在' });
        return;
      }
      markSocketRejoined(room, player.id, socket.id);
      socket.join(room.code);
      socketToRoom.set(socket.id, room.code);
      socketToPlayer.set(socket.id, player.id);
      if (room.match) {
        pushEvent(room.match, 'player_rejoined', player.id, reconnectEventPayload(room, player.id));
      }
      ack({ ok: true, room: snapshotRoom(room), selfPlayerId: player.id });
      broadcasts.emitProfileSnapshot(socket, player.id);
      broadcasts.broadcastRoom(room);
      broadcasts.emitPersonalSnapshot(room, player.id);
    });

    socket.on('setReady', (payload) => {
      const context = getSocketContext(socket.id);
      if (!context) {
        return;
      }
      const player = context.room.players.find((candidate) => candidate.id === context.playerId);
      if (!player) {
        return;
      }
      player.ready = payload.ready;
      player.status = payload.ready ? 'ready' : 'connected';
      broadcasts.broadcastRoom(context.room);
    });

    socket.on('selectRole', (payload) => {
      const context = getSocketContext(socket.id);
      if (!context) {
        return;
      }
      const roleExists = gameConfig.roles.some((role) => role.id === payload.roleId);
      const player = context.room.players.find((candidate) => candidate.id === context.playerId);
      if (!player || !roleExists || context.room.status !== 'lobby') {
        return;
      }
      player.roleId = payload.roleId;
      broadcasts.broadcastRoom(context.room);
    });

    socket.on('setCoreAuctionMode', (payload) => {
      const context = getSocketContext(socket.id);
      if (!context || context.room.hostId !== context.playerId || context.room.status !== 'lobby') {
        return;
      }
      context.room.coreAuctionMode = validCoreAuctionMode(payload.mode);
      broadcasts.broadcastRoom(context.room);
    });

    socket.on('setSelectedBidMap', (payload) => {
      const context = getSocketContext(socket.id);
      if (!context || context.room.hostId !== context.playerId || context.room.status !== 'lobby') {
        return;
      }
      context.room.selectedBidMapId = validBidMapId(payload.bidMapId);
      context.room.initialCash = bidKingInitialCashForBidMap(context.room.selectedBidMapId, gameConfig.rules.initialCash);
      broadcasts.broadcastRoom(context.room);
    });

    socket.on('startMatch', () => {
      const context = getSocketContext(socket.id);
      if (!context || context.room.hostId !== context.playerId || context.room.status !== 'lobby') {
        return;
      }
      try {
        startMatch(context.room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('leaveRoom', () => {
      leaveSocketRoom(socket.id);
    });

    socket.on('submitBid', (payload) => {
      const context = getPlayingContext(socket.id);
      if (!context) {
        return;
      }
      try {
        submitBid(context.room.match!, context.playerId, payload.amount);
        broadcasts.broadcastMatch(context.room);
        roundRuntime.maybeSettleEarly(context.room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('passAuction', () => {
      const context = getPlayingContext(socket.id);
      if (!context) {
        return;
      }
      try {
        passAuction(context.room.match!, context.playerId);
        broadcasts.broadcastMatch(context.room);
        roundRuntime.maybeSettleEarly(context.room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('useSkill', (payload) => {
      const context = getPlayingContext(socket.id);
      if (!context) {
        return;
      }
      try {
        useSkill(context.room.match!, context.playerId, payload.targetPlayerId);
        services.profiles.completeTask(context.playerId, 'daily_use_skill');
        broadcasts.emitProfileSnapshot(socket, context.playerId);
        broadcasts.broadcastMatch(context.room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('useBattleItem', (payload) => {
      const context = getPlayingContext(socket.id);
      if (!context) {
        return;
      }
      try {
        const item = resolveBattleItem(payload.itemId);
        assertBattleItemPhase(context.room.match!, context.playerId);
        assertProfileBattleItemReady(context.playerId, payload.itemId);
        useBattleItem(context.room.match!, context.playerId, item, Date.now(), payload.targetPlayerId);
        services.profiles.useBattleItem(context.playerId, payload.itemId);
        services.profiles.completeTask(context.playerId, 'daily_use_skill');
        broadcasts.emitProfileSnapshot(socket, context.playerId);
        broadcasts.broadcastMatch(context.room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('sendEmote', (payload) => {
      const context = getPlayingContext(socket.id);
      if (!context) {
        return;
      }
      const player = context.room.match!.players.find((candidate) => candidate.id === context.playerId);
      if (player) {
        const emoji = emojiForPayload(payload.emote);
        if (!emoji) {
          emitError(socket, new Error('表情配置不存在'));
          return;
        }
        try {
          const profile = services.profiles.getOrCreateProfile(context.playerId);
          const runtime = applyEmojiRuntime(emoji, {
            playerId: context.playerId,
            cooldowns: emojiCooldowns,
            roleId: player.roleId,
            heroId: emojiHeroIdForSeat(player.seat),
            inventory: inventoryRecord(profile)
          });
          player.emote = runtime.label;
          player.emoteSoundId = runtime.soundId;
          player.emoteAnimationKey = runtime.presentation.animationKey;
          player.emoteEffectKey = runtime.presentation.effectKey;
          player.emoteEffectViewIds = runtime.presentation.effectViewIds;
          player.emoteVisualClass = runtime.presentation.visualClass;
        } catch (error) {
          emitError(socket, error);
          return;
        }
        broadcasts.broadcastMatch(context.room);
      }
    });

    socket.on('requestSnapshot', () => {
      const context = getSocketContext(socket.id);
      if (!context) {
        return;
      }
      roundRuntime.runCoreRound(context.room);
      broadcasts.emitPersonalSnapshot(context.room, context.playerId);
    });

    socket.on('disconnect', () => {
      const context = getSocketContext(socket.id);
      if (!context) {
        return;
      }
      markSocketDisconnected(context.room, context.playerId, socket.id);
      if (context.room.match) {
        pushEvent(context.room.match, 'player_disconnected', context.playerId, reconnectEventPayload(context.room, context.playerId));
      }
      socketToRoom.delete(socket.id);
      socketToPlayer.delete(socket.id);
      broadcasts.broadcastRoom(context.room);
      broadcasts.broadcastMatch(context.room);
    });
  }

  function leaveSocketRoom(socketId: string): void {
    const context = getSocketContext(socketId);
    if (!context) {
      return;
    }
    const { room, playerId } = context;
    markSocketLeftRoom(room, playerId, socketId);
    io.sockets.sockets.get(socketId)?.leave(room.code);
    socketToRoom.delete(socketId);
    socketToPlayer.delete(socketId);

    const connectedHumans = connectedHumanPlayers(room);
    if (connectedHumans.length === 0) {
      clearRoomTimers(room);
      clearEmojiCooldowns(room);
      rooms.delete(room.code);
      log.info({ roomCode: room.code, playerId }, 'room closed after last human left');
      return;
    }

    if (room.status === 'lobby') {
      replaceLobbyLeaverWithBot(room, playerId);
      if (room.hostId === playerId) {
        room.hostId = connectedHumans[0]!.id;
      }
    }

    broadcasts.broadcastRoom(room);
    broadcasts.broadcastMatch(room);
  }

  function replaceLobbyLeaverWithBot(room: Room, playerId: string): void {
    replaceLobbyPlayerWithBot(room, playerId, () => `bot_${randomUUID()}`);
  }

  function listRooms(): RoomSnapshot[] {
    return [...rooms.values()].map(snapshotRoom);
  }

  function listMatches(): AdminMatchListItem[] {
    return [...rooms.values()]
      .filter((room) => room.match)
      .map((room) => buildAdminMatchSummary(room, room.match!))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function getMatchDetail(matchId: string): AdminMatchDetail | undefined {
    const room = [...rooms.values()].find((candidate) => candidate.match?.id === matchId);
    const match = room?.match;
    if (!room || !match) {
      return undefined;
    }
    return buildAdminMatchDetail(room, match);
  }

  function findMatch(matchId: string): MatchRuntimeState | undefined {
    return [...rooms.values()].find((room) => room.match?.id === matchId)?.match;
  }

  function createRoom(
    socket: AppSocket,
    playerName: string,
    roleId?: string,
    requestedBotCount = 3,
    requestedCoreAuctionMode?: CoreAuctionMode,
    requestedBidMapId?: number,
    requestedInitialCash?: number,
    requestedProfileId?: string
  ): Room {
    const code = createUniqueRoomCode((candidate) => rooms.has(candidate));
    const playerId = requestedProfileId?.trim() || `p_${randomUUID()}`;
    services.profiles.getOrCreateProfile(playerId, playerName);
    const room = createRoomState({
      id: `room_${randomUUID()}`,
      code,
      hostId: playerId,
      botCount: Math.max(0, Math.min(maxBotCount, requestedBotCount)),
      totalRounds: bidKingDefaultBidGameCount(gameConfig.rules.totalRounds),
      initialCash: validInitialCashForBidMap(requestedInitialCash, validBidMapId(requestedBidMapId)),
      coreAuctionMode: validCoreAuctionMode(requestedCoreAuctionMode),
      selectedBidMapId: validBidMapId(requestedBidMapId),
    });
    rooms.set(code, room);
    addHumanToRoom(room, socket, playerName, roleId, playerId);
    fillBots(room);
    log.info({ roomCode: code }, 'room created');
    return room;
  }

  function addHumanToRoom(room: Room, socket: AppSocket, playerName: string, roleId?: string, fixedPlayerId?: string): ReturnType<typeof createHumanRoomPlayer> | undefined {
    const playerId = fixedPlayerId ?? `p_${randomUUID()}`;
    const player = createHumanRoomPlayer({
      id: playerId,
      name: services.profiles.getOrCreateProfile(playerId, playerName).name,
      roleId,
      socketId: socket.id,
    });
    if (!addHumanPlayerToRoom(room, player)) {
      return undefined;
    }

    socket.join(room.code);
    socketToRoom.set(socket.id, room.code);
    socketToPlayer.set(socket.id, playerId);
    return player;
  }

  function fillBots(room: Room): void {
    fillRoomBots(room, () => `bot_${randomUUID()}`);
  }

  function validInitialCashForBidMap(requestedInitialCash: number | undefined, bidMapId?: number): number {
    const requiredInitialCash = bidKingInitialCashForBidMap(bidMapId, gameConfig.rules.initialCash);
    if (!requestedInitialCash || requestedInitialCash <= 0) {
      return requiredInitialCash;
    }
    const choices = bidKingInitialCashChoices();
    const snappedInitialCash = choices.find((choice) => choice >= requestedInitialCash) ?? choices[choices.length - 1] ?? requiredInitialCash;
    return Math.max(requiredInitialCash, snappedInitialCash);
  }

  function startMatch(room: Room): void {
    fillBots(room);
    room.initialCash = bidKingInitialCashForBidMap(room.selectedBidMapId, room.initialCash);
    const humanPlayers = room.players.filter((candidate) => candidate.kind === 'human');
    const blockedPlayer = humanPlayers.find((player) => services.profiles.getSnapshot(player.id).profile.tickets.current <= 0);
    if (blockedPlayer) {
      throw new Error(`${blockedPlayer.name}竞拍票不足`);
    }
    clearRoomTimers(room);
    clearEmojiCooldowns(room);
    for (const player of humanPlayers) {
      services.profiles.consumeTicketForMatch(player.id, `match_start:${room.id}:${player.id}`);
      broadcasts.emitRoomPlayerProfile(room, player.id);
    }
    const match = createMatch({
      id: `match_${randomUUID()}`,
      players: room.players.slice(0, 4).map((player) => ({
        id: player.id,
        name: player.name,
        kind: player.kind,
        roleId: player.roleId
      })),
      totalRounds: room.totalRounds,
      coreMode: true,
      coreAuctionMode: room.coreAuctionMode,
      coreBidMapId: room.selectedBidMapId,
      config: { ...gameConfig, rules: { ...gameConfig.rules, initialCash: room.initialCash } }
    });
    room.match = match;
    room.status = 'playing';
    startNextRound(match);
    broadcasts.broadcastRoom(room);
    broadcasts.broadcastMatch(room);
    roundRuntime.runCoreRound(room);
  }

  function settleProfilesForEndedMatch(room: Room): void {
    const summary = room.match?.finalSummary;
    if (!summary) {
      return;
    }
    for (const player of room.players.filter((candidate) => candidate.kind === 'human')) {
      services.profiles.applyMatchSummary(player.id, summary);
      broadcasts.emitRoomPlayerProfile(room, player.id);
    }
  }

  function assertProfileBattleItemReady(playerId: string, itemId: number): void {
    const profile = services.profiles.getSnapshot(playerId).profile;
    if (!profile.equippedBattleItems.some((entry) => entry.itemId === itemId)) {
      throw new Error('战斗道具未携带');
    }
    if ((inventoryRecord(profile)[String(itemId)] ?? 0) <= 0) {
      throw new Error('战斗道具库存不足');
    }
  }

  function clearEmojiCooldowns(room: Room): void {
    for (const key of [...emojiCooldowns.keys()]) {
      if (room.players.some((player) => key.startsWith(`${player.id}:`))) {
        emojiCooldowns.delete(key);
      }
    }
  }

  function getSocketContext(socketId: string): { room: Room; playerId: string } | undefined {
    const roomCode = socketToRoom.get(socketId);
    const playerId = socketToPlayer.get(socketId);
    if (!roomCode || !playerId) {
      return undefined;
    }
    const room = rooms.get(roomCode);
    return room ? { room, playerId } : undefined;
  }

  function getPlayingContext(socketId: string): { room: Room; playerId: string } | undefined {
    const context = getSocketContext(socketId);
    if (!context?.room.match || context.room.status !== 'playing') {
      return undefined;
    }
    return context;
  }

  function emitError(socket: AppSocket, error: unknown): void {
    socket.emit('toast', {
      tone: 'warning',
      message: error instanceof Error ? error.message : '操作失败'
    });
  }

  function reconnectEventPayload(room: Room, playerId: string): Record<string, unknown> {
    return {
      roomCode: room.code,
      playerId,
      roomStatus: room.status,
      matchId: room.match?.id,
      roundId: room.match?.currentRound?.id,
      phase: room.match?.currentRound?.phase,
      phaseEndsAt: room.match?.currentRound?.phaseEndsAt
    };
  }

  return {
    bindSocket,
    listRooms,
    listMatches,
    getMatchDetail,
    findMatch
  };
}
