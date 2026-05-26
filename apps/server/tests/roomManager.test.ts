import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
