import { afterEach, describe, expect, it, vi } from 'vitest';
import { bidKingBidMapPlayerCount } from '@bitkingdom/match-core';
import { createRoomManager } from '../src/roomManager';
import { createProfileService } from '../src/services/profileService';
import type { ServerStore } from '../src/services/store';

type SocketHandler = (...args: unknown[]) => void;

interface FakeSocket {
  id: string;
  handshake: { auth: Record<string, unknown> };
  handlers: Record<string, SocketHandler>;
  emitted: Array<{ event: string; payload: unknown }>;
  rooms: string[];
  on(event: string, handler: SocketHandler): FakeSocket;
  emit(event: string, payload?: unknown): boolean;
  join(room: string): void;
}

function createMemoryStore(): ServerStore {
  return {
    state: {
      schemaVersion: 2,
      profiles: {},
      transactions: [],
      transactionSourceIds: [],
      accounts: {},
      accountSessions: {}
    },
    save() {
      // In-memory tests do not persist to disk.
    }
  };
}

function createFakeSocket(id: string): FakeSocket {
  const socket: FakeSocket = {
    id,
    handshake: { auth: {} },
    handlers: {},
    emitted: [],
    rooms: [],
    on(event, handler) {
      socket.handlers[event] = handler;
      return socket;
    },
    emit(event, payload) {
      socket.emitted.push({ event, payload });
      return true;
    },
    join(room) {
      socket.rooms.push(room);
    }
  };
  return socket;
}

function createFakeIo() {
  const emitted: Array<{ target: string; event: string; payload: unknown }> = [];
  return {
    emitted,
    to(target: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ target, event, payload });
        }
      };
    }
  };
}

describe('BidKing room manager entry costs', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts a default unknown BidMap with only the configured entry fee when tickets are zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T12:00:00+08:00'));
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_zero_ticket_bidmap', '零票掌柜');
    profile.coins = 2_100_000;
    profile.tickets.current = 0;
    profile.auctionStats!.highestWinningItemTotalValue = 2_000_000;
    const io = createFakeIo();
    const manager = createRoomManager(io as never, { info: vi.fn(), warn: vi.fn() } as never, { profiles });
    const socket = createFakeSocket('socket_zero_ticket');

    manager.bindSocket(socket as never);
    const createRoomPayload = {
      playerName: profile.name,
      profileId: profile.playerId,
      selectedBidMapId: 2401
    };
    let roomAck: { room: { selectedBidMapId?: number } } | undefined;
    socket.handlers.createRoom?.(createRoomPayload, (ack: typeof roomAck) => {
      roomAck = ack;
    });

    expect(roomAck?.room.selectedBidMapId).toBe(2401);

    socket.handlers.startMatch?.();

    const room = manager.listRooms()[0];
    const snapshot = profiles.getSnapshot(profile.playerId);
    expect(room?.status).toBe('playing');
    expect(snapshot.profile.coins).toBe(2_090_000);
    expect(snapshot.profile.tickets.current).toBe(0);
    expect(snapshot.transactions.filter((transaction) => transaction.reason === 'bidmap_entry_cost_coins')).toHaveLength(1);
    expect(snapshot.transactions.some((transaction) => transaction.reason === 'ticket_spend_match')).toBe(false);
    expect(socket.emitted.some((entry) => (
      entry.event === 'toast'
      && JSON.stringify(entry.payload).includes('竞拍票不足')
    ))).toBe(false);
  });

  it('groups normal matchmaking players into one room as soon as the bucket is full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00+08:00'));
    const bidMapId = 2401;
    const capacity = bidKingBidMapPlayerCount(bidMapId);
    const profiles = createProfileService(createMemoryStore());
    const io = createFakeIo();
    const manager = createRoomManager(io as never, { info: vi.fn(), warn: vi.fn() } as never, { profiles });
    const sockets = Array.from({ length: capacity }, (_, index) => createFakeSocket(`socket_match_${index}`));

    sockets.forEach((socket, index) => {
      const profile = profiles.getOrCreateProfile(`p_match_${index}`, `玩家${index + 1}`);
      profile.coins = 2_100_000;
      profile.tickets.current = 0;
      profile.auctionStats!.highestWinningItemTotalValue = 2_000_000;
      manager.bindSocket(socket as never);
      socket.handlers.matchGame?.({
        playerName: profile.name,
        profileId: profile.playerId,
        selectedBidMapId: bidMapId,
        coreAuctionMode: 'sealed'
      }, vi.fn());
    });

    const room = manager.listRooms()[0];
    expect(room?.status).toBe('playing');
    expect(room?.players.filter((player) => player.kind === 'human')).toHaveLength(capacity);
    expect(new Set(room?.players.filter((player) => player.kind === 'human').map((player) => player.id))).toEqual(
      new Set(Array.from({ length: capacity }, (_, index) => `p_match_${index}`))
    );
    expect(sockets.every((socket) => socket.emitted.some((entry) => entry.event === 'matchFound'))).toBe(true);
  });

  it('starts a partial normal matchmaking bucket after timeout and fills missing seats with bots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:05:00+08:00'));
    const bidMapId = 2401;
    const capacity = bidKingBidMapPlayerCount(bidMapId);
    const humanCount = Math.max(1, capacity - 1);
    const profiles = createProfileService(createMemoryStore());
    const io = createFakeIo();
    const manager = createRoomManager(io as never, { info: vi.fn(), warn: vi.fn() } as never, { profiles });
    const sockets = Array.from({ length: humanCount }, (_, index) => createFakeSocket(`socket_timeout_${index}`));

    sockets.forEach((socket, index) => {
      const profile = profiles.getOrCreateProfile(`p_timeout_${index}`, `超时玩家${index + 1}`);
      profile.coins = 2_100_000;
      profile.tickets.current = 0;
      profile.auctionStats!.highestWinningItemTotalValue = 2_000_000;
      manager.bindSocket(socket as never);
      socket.handlers.matchGame?.({
        playerName: profile.name,
        profileId: profile.playerId,
        selectedBidMapId: bidMapId,
        coreAuctionMode: 'sealed'
      }, vi.fn());
    });

    expect(manager.listRooms()).toHaveLength(0);
    vi.advanceTimersByTime(10_000);

    const room = manager.listRooms()[0];
    expect(room?.status).toBe('playing');
    expect(room?.players).toHaveLength(capacity);
    expect(room?.players.filter((player) => player.kind === 'human')).toHaveLength(humanCount);
    expect(room?.players.filter((player) => player.kind === 'bot')).toHaveLength(capacity - humanCount);
  });
});
