import { gameConfig } from '@bitkingdom/config';
import {
  bidKingBidMapAccess,
  bidKingHeroIdForRoleId,
  bidKingHeroSkinForHero,
  bidKingInitialCashForBidMap,
  bidKingRoleHasSourceHero,
  bidKingRoleIdForHeroId,
  bidKingDefaultBidGameCount,
  bidKingMaxBotCount,
  createMatch,
  passAuction,
  pushEvent,
  startNextRound,
  submitBid,
  useBattleItem
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
import { bidKingSourceBoxIdForProfileStockBox } from './domain/profile/profileStockRuntime';
import { createRoomRoundRuntime } from './domain/battle/roomRoundRuntime';
import { apiErrorEnvelope } from './domain/system/errorCodeCatalog';
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
  markSocketDisconnected,
  markSocketLeftRoom,
  markSocketRejoined,
  replaceLobbyPlayerWithBot,
  roomPlayerCapacity,
  syncRoomBotsForBidMap
} from './domain/battle/roomLifecycleRuntime';
import type { Room } from './domain/battle/roomLifecycleRuntime';
import { appendServerLog } from './services/serverLogSink';
import type { AccountService } from './services/accountService';
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

export function createRoomManager(io: AppServer, log: FastifyBaseLogger, services: { accounts?: AccountService; profiles: ProfileService }): RoomManager {
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
  const maxBotCount = bidKingMaxBotCount();

  function bindSocket(socket: AppSocket): void {
    socket.on('createRoom', (payload, ack) => {
      try {
        const room = createRoom(
          socket,
          payload.playerName,
          payload.roleId,
          payload.sourceHeroId,
          payload.botCount,
          payload.coreAuctionMode,
          payload.selectedBidMapId,
          payload.profileId
        );
        const selfPlayerId = socketToPlayer.get(socket.id);
        ack({ room: snapshotRoom(room), selfPlayerId: selfPlayerId ?? room.hostId });
        broadcasts.emitProfileSnapshot(socket, selfPlayerId ?? room.hostId);
        broadcasts.broadcastRoom(room);
      } catch (error) {
        emitError(socket, error);
      }
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
      const player = addHumanToRoom(room, socket, payload.playerName, payload.roleId, payload.sourceHeroId, payload.profileId);
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
      const sessionProfileId = profileIdForSocket(socket);
      const requestedPlayerId = sessionProfileId ?? payload.playerId;
      if (sessionProfileId && payload.playerId !== sessionProfileId) {
        ack({ ok: false, error: '账号会话与玩家档案不匹配' });
        return;
      }
      const player = room.players.find((candidate) => candidate.id === requestedPlayerId && candidate.kind === 'human');
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
      const resolved = resolveRoleSelection(payload.roleId, payload.sourceHeroId);
      const player = context.room.players.find((candidate) => candidate.id === context.playerId);
      if (!player || !resolved || context.room.status !== 'lobby') {
        return;
      }
      try {
        const profile = services.profiles.selectHero(context.playerId, resolved.heroCid).profile;
        player.roleId = resolved.roleId;
        player.heroCid = resolved.heroCid;
        player.heroSkinCid = bidKingHeroSkinForHero(resolved.heroCid, profile.selectedHeroSkins);
        broadcasts.emitProfileSnapshot(socket, context.playerId);
      } catch (error) {
        emitError(socket, error);
        return;
      }
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
      const profile = services.profiles.getSnapshot(context.playerId).profile;
      let nextBidMapId: number;
      try {
        nextBidMapId = requireAccessibleBidMap(profile, payload.bidMapId);
      } catch (error) {
        emitError(socket, error);
        return;
      }
      const nextCapacity = roomPlayerCapacity({ selectedBidMapId: nextBidMapId, players: context.room.players });
      const humanCount = context.room.players.filter((player) => player.kind === 'human').length;
      if (humanCount > nextCapacity) {
        emitError(socket, new Error(`当前已有 ${humanCount} 名玩家，不能切换到 ${nextCapacity} 人拍场`));
        return;
      }
      context.room.selectedBidMapId = nextBidMapId;
      context.room.initialCash = bidKingInitialCashForBidMap(nextBidMapId);
      syncRoomBotsForBidMap(context.room, () => `bot_${randomUUID()}`);
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

    socket.on('useSkill', () => {
      emitError(socket, new Error('BidKing hero skills are automatic'));
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
            heroId: player.heroCid ?? emojiHeroIdForSeat(player.seat),
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
    roleId: string | undefined,
    sourceHeroId: number | undefined,
    requestedBotCount: number,
    requestedCoreAuctionMode: CoreAuctionMode,
    requestedBidMapId: number,
    requestedProfileId?: string
  ): Room {
    const code = createUniqueRoomCode((candidate) => rooms.has(candidate));
    const sessionProfileId = profileIdForSocket(socket);
    if (sessionProfileId && requestedProfileId && requestedProfileId !== sessionProfileId) {
      emitError(socket, new Error('账号会话与玩家档案不匹配'));
    }
    const requestedPlayerId = requestedProfileId?.trim();
    const playerId = sessionProfileId ?? (requestedPlayerId || `p_${randomUUID()}`);
    const hostProfile = services.profiles.getOrCreateProfile(playerId, playerName);
    const selectedBidMapId = resolveAccessibleBidMap(hostProfile, requestedBidMapId);
    const room = createRoomState({
      id: `room_${randomUUID()}`,
      code,
      hostId: playerId,
      botCount: Math.max(0, Math.min(maxBotCount, requestedBotCount)),
      totalRounds: bidKingDefaultBidGameCount(),
      initialCash: bidKingInitialCashForBidMap(selectedBidMapId),
      coreAuctionMode: validCoreAuctionMode(requestedCoreAuctionMode),
      selectedBidMapId,
    });
    rooms.set(code, room);
    addHumanToRoom(room, socket, playerName, roleId, sourceHeroId, playerId);
    fillBots(room);
    log.info({ roomCode: code }, 'room created');
    return room;
  }

  function addHumanToRoom(room: Room, socket: AppSocket, playerName: string, roleId?: string, sourceHeroId?: number, fixedPlayerId?: string): ReturnType<typeof createHumanRoomPlayer> | undefined {
    const sessionProfileId = profileIdForSocket(socket);
    if (sessionProfileId && fixedPlayerId && fixedPlayerId !== sessionProfileId) {
      emitError(socket, new Error('账号会话与玩家档案不匹配'));
    }
    const playerId = sessionProfileId ?? fixedPlayerId ?? `p_${randomUUID()}`;
    let profile = services.profiles.getOrCreateProfile(playerId, playerName);
    const profileRoleId = bidKingRoleIdForHeroId(profile.selectedHeroId, gameConfig.roles);
    const resolvedSelection = resolveRoleSelection(roleId, sourceHeroId)
      ?? resolveRoleSelection(profileRoleId, profile.selectedHeroId);
    if (!resolvedSelection) {
      emitError(socket, new Error('竞买人配置不存在'));
      return undefined;
    }
    const { roleId: resolvedRoleId, heroCid } = resolvedSelection;
    if (profile.selectedHeroId !== heroCid) {
      try {
        profile = services.profiles.selectHero(playerId, heroCid).profile;
      } catch (error) {
        emitError(socket, error);
        return undefined;
      }
    }
    const heroSkinCid = bidKingHeroSkinForHero(heroCid, profile.selectedHeroSkins);
    const player = createHumanRoomPlayer({
      id: playerId,
      name: profile.name,
      roleId: resolvedRoleId,
      heroCid,
      heroSkinCid,
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

  function resolveRoleSelection(roleId?: string, sourceHeroId?: number): { roleId: string; heroCid: number } | undefined {
    const normalizedHeroId = typeof sourceHeroId === 'number' && Number.isInteger(sourceHeroId) ? sourceHeroId : undefined;
    const roleIdFromHero = bidKingRoleIdForHeroId(normalizedHeroId, gameConfig.roles);
    if (roleIdFromHero) {
      return !roleId || roleId === roleIdFromHero
        ? { roleId: roleIdFromHero, heroCid: normalizedHeroId! }
        : undefined;
    }
    if (bidKingRoleHasSourceHero(roleId, gameConfig.roles)) {
      return { roleId: roleId!, heroCid: bidKingHeroIdForRoleId(roleId, gameConfig.roles) };
    }
    return undefined;
  }

  function fillBots(room: Room): void {
    syncRoomBotsForBidMap(room, () => `bot_${randomUUID()}`);
  }

  function startMatch(room: Room): void {
    fillBots(room);
    const maxPlayers = roomPlayerCapacity(room);
    if (room.players.length > maxPlayers) {
      throw new Error(`当前拍场仅支持 ${maxPlayers} 人同局`);
    }
    const matchBidMapId = room.selectedBidMapId;
    room.initialCash = bidKingInitialCashForBidMap(matchBidMapId);
    const humanPlayers = room.players.filter((candidate) => candidate.kind === 'human');
    for (const player of humanPlayers) {
      const access = bidKingBidMapAccess(services.profiles.getSnapshot(player.id).profile, room.selectedBidMapId);
      if (!access.canEnter) {
        throw new Error(`${player.name}未满足入场条件：${access.reasons.join('、')}`);
      }
    }
    clearRoomTimers(room);
    clearEmojiCooldowns(room);
    for (const player of humanPlayers) {
      services.profiles.consumeBidMapEntryCost(player.id, room.selectedBidMapId, `match_start:${room.id}:${player.id}:bidmap:${room.selectedBidMapId}`);
      broadcasts.emitRoomPlayerProfile(room, player.id);
    }
    const match = createMatch({
      id: `match_${randomUUID()}`,
      players: room.players.slice(0, maxPlayers).map((player) => ({
        id: player.id,
        name: player.name,
        kind: player.kind,
        roleId: player.roleId,
        heroCid: matchHeroCid(player),
        heroSkinCid: matchHeroSkinCid(player),
        selectedItemList: matchSelectedItemList(player)
      })),
      totalRounds: room.totalRounds,
      coreMode: true,
      coreAuctionMode: room.coreAuctionMode,
      coreBidMapId: matchBidMapId,
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
    const equipped = profile.equippedBattleItems.find((entry) => entry.itemId === itemId);
    if (!equipped) {
      throw new Error('战斗道具未携带');
    }
    if ((inventoryRecord(profile)[String(itemId)] ?? 0) <= 0) {
      throw new Error('战斗道具库存不足');
    }
    if (equipped.stockId !== undefined && equipped.boxId !== undefined) {
      const selectedBox = profile.stockContainers
        ?.find((container) => container.stockId === equipped.stockId)
        ?.boxes.find((box) => (
          (bidKingSourceBoxIdForProfileStockBox(box) === equipped.boxId || box.boxId === equipped.boxId) &&
          box.item.cid === itemId
        ));
      if (!selectedBox) {
        throw new Error('战斗道具实体已不在仓库');
      }
    }
  }

  function matchHeroCid(player: Room['players'][number]): number {
    if (player.kind === 'human') {
      const profile = services.profiles.getSnapshot(player.id).profile;
      const heroCid = profile.selectedHeroId ?? player.heroCid;
      if (!heroCid) {
        throw new Error(`Human player ${player.id} has no BidKing hero`);
      }
      return heroCid;
    }
    if (!player.heroCid) {
      throw new Error(`Bot player ${player.id} has no BidKing hero`);
    }
    return player.heroCid;
  }

  function matchHeroSkinCid(player: Room['players'][number]): number | undefined {
    if (player.kind !== 'human') {
      return player.heroSkinCid;
    }
    const profile = services.profiles.getSnapshot(player.id).profile;
    return bidKingHeroSkinForHero(matchHeroCid(player), profile.selectedHeroSkins);
  }

  function matchSelectedItemList(player: Room['players'][number]) {
    if (player.kind !== 'human') {
      return [];
    }
    const profile = services.profiles.getSnapshot(player.id).profile;
    return profile.equippedBattleItems
      .filter((entry) => entry.stockId !== undefined && entry.boxId !== undefined)
      .map((entry) => {
        const selectedBox = profile.stockContainers
          ?.find((container) => container.stockId === entry.stockId)
          ?.boxes.find((box) => (
            (bidKingSourceBoxIdForProfileStockBox(box) === entry.boxId || box.boxId === entry.boxId) &&
            box.item.cid === entry.itemId
          ));
        return {
          itemCid: entry.itemId,
          isUsed: false,
          stockId: entry.stockId!,
          boxId: selectedBox ? bidKingSourceBoxIdForProfileStockBox(selectedBox) : entry.boxId!
        };
      });
  }

  function clearEmojiCooldowns(room: Room): void {
    for (const key of [...emojiCooldowns.keys()]) {
      if (room.players.some((player) => key.startsWith(`${player.id}:`))) {
        emojiCooldowns.delete(key);
      }
    }
  }

  function resolveAccessibleBidMap(profile: ReturnType<ProfileService['getOrCreateProfile']>, requestedBidMapId: number): number {
    const selectedBidMapId = validBidMapId(requestedBidMapId);
    const access = bidKingBidMapAccess(profile, selectedBidMapId);
    if (!access.canEnter) {
      throw new Error(`未满足入场条件：${access.reasons.join('、')}`);
    }
    return selectedBidMapId;
  }

  function requireAccessibleBidMap(profile: ReturnType<ProfileService['getOrCreateProfile']>, requestedBidMapId: number): number {
    const bidMapId = validBidMapId(requestedBidMapId);
    const access = bidKingBidMapAccess(profile, bidMapId);
    if (!access.canEnter) {
      throw new Error(`未满足入场条件：${access.reasons.join('、')}`);
    }
    return bidMapId;
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

  function profileIdForSocket(socket: AppSocket): string | undefined {
    const token = typeof socket.handshake.auth?.sessionToken === 'string'
      ? socket.handshake.auth.sessionToken
      : undefined;
    return services.accounts?.resolveProfileIdForSession(token);
  }

  function getPlayingContext(socketId: string): { room: Room; playerId: string } | undefined {
    const context = getSocketContext(socketId);
    if (!context?.room.match || context.room.status !== 'playing') {
      return undefined;
    }
    return context;
  }

  function emitError(socket: AppSocket, error: unknown): void {
    const message = error instanceof Error ? error.message : '操作失败';
    const envelope = apiErrorEnvelope(message);
    const id = Number(envelope.errorCodeId) || 0;
    socket.emit('toast', {
      tone: id >= 100 ? 'danger' : 'warning',
      message: `${envelope.errorCode} · ${envelope.error}`
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
