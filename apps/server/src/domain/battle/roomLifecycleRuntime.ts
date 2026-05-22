import { bidKingBidMapPlayerCount } from '@bitkingdom/match-core';
import type { MatchRuntimeState } from '@bitkingdom/match-core';
import type {
  CoreAuctionMode,
  RoomSnapshot
} from '@bitkingdom/shared';
import {
  createBotRoomPlayer,
  validRole
} from './roomLobbyRuntime';
import type { RoomPlayer } from './roomLobbyRuntime';

export interface Room {
  id: string;
  code: string;
  hostId: string;
  botCount: number;
  totalRounds: number;
  initialCash: number;
  coreAuctionMode: CoreAuctionMode;
  selectedBidMapId?: number;
  status: RoomSnapshot['status'];
  players: RoomPlayer[];
  botProfiles: Map<string, string>;
  match?: MatchRuntimeState;
  timers: NodeJS.Timeout[];
}

interface CreateRoomStateArgs {
  id: string;
  code: string;
  hostId: string;
  botCount: number;
  totalRounds: number;
  initialCash: number;
  coreAuctionMode: CoreAuctionMode;
  selectedBidMapId?: number;
}

interface CreateHumanPlayerArgs {
  id: string;
  name: string;
  roleId?: string;
  heroCid?: number;
  heroSkinCid?: number;
  socketId: string;
}

export function createRoomState(args: CreateRoomStateArgs): Room {
  const maxPlayers = roomPlayerCapacity(args);
  return {
    id: args.id,
    code: args.code,
    hostId: args.hostId,
    botCount: Math.max(0, Math.min(Math.max(0, maxPlayers - 1), args.botCount)),
    totalRounds: args.totalRounds,
    initialCash: args.initialCash,
    coreAuctionMode: args.coreAuctionMode,
    selectedBidMapId: args.selectedBidMapId,
    status: 'lobby',
    players: [],
    botProfiles: new Map(),
    timers: []
  };
}

export function createHumanRoomPlayer(args: CreateHumanPlayerArgs): RoomPlayer {
  return {
    id: args.id,
    name: args.name,
    kind: 'human',
    roleId: validRole(args.roleId),
    heroCid: args.heroCid,
    heroSkinCid: args.heroSkinCid,
    socketId: args.socketId,
    ready: false,
    status: 'connected'
  };
}

export function addHumanPlayerToRoom(room: Room, player: RoomPlayer): boolean {
  const botIndex = room.players.findIndex((candidate) => candidate.kind === 'bot');
  if (botIndex >= 0) {
    const removed = room.players[botIndex]!;
    room.botProfiles.delete(removed.id);
    room.players[botIndex] = player;
    return true;
  }
  if (room.players.length >= roomPlayerCapacity(room)) {
    return false;
  }
  room.players.push(player);
  return true;
}

export function fillRoomBots(room: Room, createBotId: (seat: number) => string): void {
  while (room.players.length < roomPlayerCapacity(room)) {
    const seat = room.players.length;
    const bot = createBotForRoomSeat(room, seat, createBotId(seat));
    room.botProfiles.set(bot.player.id, bot.profileId);
    room.players.push(bot.player);
  }
}

export function replaceLobbyPlayerWithBot(room: Room, playerId: string, createBotId: (seat: number) => string): void {
  const seat = room.players.findIndex((player) => player.id === playerId);
  if (seat < 0) {
    return;
  }
  const bot = createBotForRoomSeat(room, seat, createBotId(seat));
  room.players[seat] = bot.player;
  room.botProfiles.set(bot.player.id, bot.profileId);
}

export function roomPlayerCapacity(room: Pick<Room, 'selectedBidMapId' | 'players'> | Pick<CreateRoomStateArgs, 'selectedBidMapId'>): number {
  return bidKingBidMapPlayerCount(room.selectedBidMapId, 4);
}

export function syncRoomBotsForBidMap(room: Room, createBotId: (seat: number) => string): void {
  const target = roomPlayerCapacity(room);
  while (room.players.length > target) {
    const botIndex = lastBotIndex(room.players);
    if (botIndex < 0) {
      break;
    }
    const removed = room.players.splice(botIndex, 1)[0];
    if (removed) {
      room.botProfiles.delete(removed.id);
    }
  }
  room.botCount = Math.max(0, Math.min(Math.max(0, target - 1), room.botCount));
  fillRoomBots(room, createBotId);
}

function createBotForRoomSeat(room: Room, seat: number, id: string): ReturnType<typeof createBotRoomPlayer> {
  return createBotRoomPlayer(seat, id, {
    selectedBidMapId: room.selectedBidMapId,
    occupiedHeroIds: room.players.map((player) => player.heroCid).filter((heroCid): heroCid is number => typeof heroCid === 'number'),
    seed: `${room.id}:${room.code}:${seat}:${id}`
  });
}

function lastBotIndex(players: readonly RoomPlayer[]): number {
  for (let index = players.length - 1; index >= 0; index -= 1) {
    if (players[index]?.kind === 'bot') {
      return index;
    }
  }
  return -1;
}

export function markSocketDisconnected(room: Room, playerId: string, socketId: string): void {
  const roomPlayer = room.players.find((player) => player.id === playerId);
  const wasActiveSocket = roomPlayer?.socketId === socketId;
  if (roomPlayer && wasActiveSocket) {
    roomPlayer.status = 'disconnected';
    roomPlayer.socketId = undefined;
  }
  const runtimePlayer = room.match?.players.find((player) => player.id === playerId);
  if (runtimePlayer && !wasActiveSocket) {
    runtimePlayer.status = 'playing';
  } else if (runtimePlayer) {
    runtimePlayer.status = 'disconnected';
  }
}

export function markSocketRejoined(room: Room, playerId: string, socketId: string): boolean {
  const roomPlayer = room.players.find((player) => player.id === playerId && player.kind === 'human');
  if (!roomPlayer) {
    return false;
  }
  roomPlayer.socketId = socketId;
  roomPlayer.status = room.status === 'playing' ? 'playing' : 'connected';
  const runtimePlayer = room.match?.players.find((player) => player.id === playerId);
  if (runtimePlayer) {
    runtimePlayer.status = 'playing';
  }
  return true;
}

export function markSocketLeftRoom(room: Room, playerId: string, socketId: string): void {
  const leavingPlayer = room.players.find((player) => player.id === playerId);
  if (leavingPlayer?.socketId === socketId) {
    leavingPlayer.socketId = undefined;
    leavingPlayer.ready = false;
    leavingPlayer.status = 'disconnected';
  }
  const runtimePlayer = room.match?.players.find((player) => player.id === playerId);
  if (runtimePlayer) {
    runtimePlayer.status = 'disconnected';
  }
}

export function connectedHumanPlayers(room: Room): RoomPlayer[] {
  return room.players.filter((player) => player.kind === 'human' && player.socketId);
}

export function createUniqueRoomCode(isTaken: (code: string) => boolean): string {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (isTaken(code));
  return code;
}

export function scheduleRoomTimer(room: Room, ms: number, callback: () => void): void {
  const timer = setTimeout(() => {
    room.timers = room.timers.filter((candidate) => candidate !== timer);
    callback();
  }, ms);
  room.timers.push(timer);
}

export function clearRoomTimers(room: Room): void {
  for (const timer of room.timers) {
    clearTimeout(timer);
  }
  room.timers = [];
}
