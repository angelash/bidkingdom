import { buildSnapshot } from '@bitkingdom/match-core';
import type {
  ClientToServerEvents,
  ServerToClientEvents
} from '@bitkingdom/shared';
import type { Server, Socket } from 'socket.io';
import { snapshotRoom } from './roomLobbyRuntime';
import type { Room } from './roomLifecycleRuntime';
import type { ProfileService } from '../../services/profileService';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RoomBroadcastRuntime {
  broadcastRoom(room: Room): void;
  broadcastMatch(room: Room): void;
  emitPersonalSnapshot(room: Room, playerId: string): void;
  emitProfileSnapshot(socket: AppSocket, playerId: string): void;
  emitRoomPlayerProfile(room: Room, playerId: string): void;
}

export function createRoomBroadcastRuntime(io: AppServer, profiles: ProfileService): RoomBroadcastRuntime {
  function broadcastRoom(room: Room): void {
    io.to(room.code).emit('roomUpdated', snapshotRoom(room));
  }

  function broadcastMatch(room: Room): void {
    if (!room.match) {
      return;
    }
    for (const roomPlayer of room.players) {
      if (roomPlayer.kind !== 'human' || !roomPlayer.socketId) {
        continue;
      }
      emitPersonalSnapshot(room, roomPlayer.id);
    }
  }

  function emitPersonalSnapshot(room: Room, playerId: string): void {
    if (!room.match) {
      return;
    }
    const socketId = room.players.find((player) => player.id === playerId)?.socketId;
    if (!socketId) {
      return;
    }
    io.to(socketId).emit('matchSnapshot', buildSnapshot(room.match, playerId));
  }

  function emitProfileSnapshot(socket: AppSocket, playerId: string): void {
    socket.emit('profileUpdated', profiles.getSnapshot(playerId));
  }

  function emitRoomPlayerProfile(room: Room, playerId: string): void {
    const socketId = room.players.find((player) => player.id === playerId)?.socketId;
    if (!socketId) {
      return;
    }
    io.to(socketId).emit('profileUpdated', profiles.getSnapshot(playerId));
  }

  return {
    broadcastRoom,
    broadcastMatch,
    emitPersonalSnapshot,
    emitProfileSnapshot,
    emitRoomPlayerProfile
  };
}
