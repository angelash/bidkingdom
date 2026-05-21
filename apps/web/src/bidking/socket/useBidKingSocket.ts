import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  PlayerSnapshot,
  ProfileSnapshot,
  RoomSnapshot,
  ServerToClientEvents
} from '@bitkingdom/shared';
import { clearSession, loadSession } from '../profile/profileSession';

export type BidKingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseBidKingSocketArgs {
  serverUrl: string;
  onProfileUpdated: (profile: ProfileSnapshot) => void;
}

interface BidKingSocketRuntime {
  activeRoomCodeRef: MutableRefObject<string | undefined>;
  connected: boolean;
  room?: RoomSnapshot;
  selfPlayerId?: string;
  setRoom: (room?: RoomSnapshot) => void;
  setSelfPlayerId: (playerId?: string) => void;
  setSnapshot: (snapshot?: PlayerSnapshot) => void;
  setToast: (message: string) => void;
  snapshot?: PlayerSnapshot;
  socket: BidKingSocket | null;
  toast: string;
}

export function useBidKingSocket({ serverUrl, onProfileUpdated }: UseBidKingSocketArgs): BidKingSocketRuntime {
  const [socket, setSocket] = useState<BidKingSocket | null>(null);
  const activeRoomCodeRef = useRef<string>();
  const [connected, setConnected] = useState(false);
  const [selfPlayerId, setSelfPlayerId] = useState<string>();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>();
  const [toast, setToast] = useState('准备连接拍卖场...');
  const onProfileUpdatedRef = useRef(onProfileUpdated);

  useEffect(() => {
    onProfileUpdatedRef.current = onProfileUpdated;
  }, [onProfileUpdated]);

  useEffect(() => {
    const nextSocket: BidKingSocket = io(serverUrl, { transports: ['websocket'] });
    nextSocket.on('connect', () => {
      setConnected(true);
      const savedSession = loadSession();
      if (savedSession) {
        activeRoomCodeRef.current = savedSession.roomCode.trim().toUpperCase();
        nextSocket.emit('rejoinRoom', savedSession, (ack) => {
          if (!ack.ok) {
            activeRoomCodeRef.current = undefined;
            clearSession();
            return;
          }
          activeRoomCodeRef.current = ack.room.code;
          setSelfPlayerId(ack.selfPlayerId);
          setRoom(ack.room);
          setToast(`已重连房间 ${ack.room.code}`);
        });
      }
    });
    nextSocket.on('disconnect', () => setConnected(false));
    nextSocket.on('roomUpdated', (nextRoom) => {
      if (activeRoomCodeRef.current !== nextRoom.code) {
        return;
      }
      setRoom(nextRoom);
    });
    nextSocket.on('matchSnapshot', (nextSnapshot) => {
      if (!activeRoomCodeRef.current) {
        return;
      }
      setSnapshot(nextSnapshot);
      if (nextSnapshot.private?.playerId) {
        setSelfPlayerId(nextSnapshot.private.playerId);
      }
    });
    nextSocket.on('profileUpdated', (nextProfile) => onProfileUpdatedRef.current(nextProfile));
    nextSocket.on('toast', (payload) => setToast(payload.message));
    setSocket(nextSocket);
    return () => {
      nextSocket.close();
    };
  }, [serverUrl]);

  return {
    activeRoomCodeRef,
    connected,
    room,
    selfPlayerId,
    setRoom,
    setSelfPlayerId,
    setSnapshot,
    setToast,
    snapshot,
    socket,
    toast
  };
}
