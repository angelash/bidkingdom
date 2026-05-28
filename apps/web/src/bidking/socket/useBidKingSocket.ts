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
import type { GameExceptionInput } from '../system/gameExceptionRuntime';

export type BidKingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseBidKingSocketArgs {
  enabled?: boolean;
  serverUrl: string;
  onException?: (exception: GameExceptionInput) => void;
  onProfileUpdated: (profile: ProfileSnapshot) => void;
  profileId?: string;
  sessionToken?: string;
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

export function useBidKingSocket({ enabled = true, serverUrl, onException, onProfileUpdated, profileId, sessionToken }: UseBidKingSocketArgs): BidKingSocketRuntime {
  const [socket, setSocket] = useState<BidKingSocket | null>(null);
  const activeRoomCodeRef = useRef<string>();
  const [connected, setConnected] = useState(false);
  const [selfPlayerId, setSelfPlayerId] = useState<string>();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>();
  const [toast, setToast] = useState('准备连接拍卖场...');
  const onExceptionRef = useRef(onException);
  const onProfileUpdatedRef = useRef(onProfileUpdated);

  useEffect(() => {
    onExceptionRef.current = onException;
  }, [onException]);

  useEffect(() => {
    onProfileUpdatedRef.current = onProfileUpdated;
  }, [onProfileUpdated]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setSocket(null);
      return;
    }
    const clearActiveMatchState = (message?: string): void => {
      activeRoomCodeRef.current = undefined;
      setRoom(undefined);
      setSnapshot(undefined);
      setSelfPlayerId(undefined);
      if (message) {
        setToast(message);
      }
    };
    const nextSocket: BidKingSocket = io(serverUrl, {
      transports: ['websocket'],
      auth: sessionToken ? { sessionToken } : undefined
    });
    nextSocket.on('connect', () => {
      setConnected(true);
      const savedSession = loadSession();
      if (savedSession && profileId && savedSession.playerId !== profileId) {
        clearSession();
        clearActiveMatchState('账号会话已切换，请重新开局');
        onExceptionRef.current?.({
          action: 'return_home',
          key: 'account-session-switched',
          kind: 'account',
          message: '账号会话已切换，请重新开局',
          modal: true,
          source: '账号',
          title: '账号会话已切换',
          tone: 'danger'
        });
        return;
      }
      if (!savedSession) {
        clearActiveMatchState();
        return;
      }
      activeRoomCodeRef.current = savedSession.roomCode.trim().toUpperCase();
      nextSocket.emit('rejoinRoom', savedSession, (ack) => {
        if (!ack.ok) {
          const message = `${ack.error}，请重新开局`;
          clearSession();
          clearActiveMatchState(message);
          onExceptionRef.current?.({
            action: 'return_home',
            key: `room-rejoin-failed:${ack.error}`,
            kind: 'room',
            message,
            modal: true,
            source: '房间重连',
            title: '房间已失效',
            tone: 'danger'
          });
          return;
        }
        activeRoomCodeRef.current = ack.room.code;
        setSelfPlayerId(ack.selfPlayerId);
        setRoom(ack.room);
        setToast(`已重连房间 ${ack.room.code}`);
      });
    });
    nextSocket.on('disconnect', () => {
      setConnected(false);
      setToast('连接中断，正在尝试重连');
      onExceptionRef.current?.({
        action: 'request_snapshot',
        key: 'socket-disconnected',
        kind: 'connection',
        message: '连接中断，正在尝试重连',
        modal: false,
        source: '连接',
        title: '连接状态异常',
        tone: 'warning'
      });
    });
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
    nextSocket.on('toast', (payload) => {
      setToast(payload.message);
      if (payload.tone === 'warning' || payload.tone === 'danger') {
        onExceptionRef.current?.({
          kind: 'server',
          message: payload.message,
          modal: payload.tone === 'danger',
          source: '服务端',
          title: '操作未完成',
          tone: payload.tone
        });
      }
    });
    setSocket(nextSocket);
    return () => {
      nextSocket.close();
    };
  }, [enabled, profileId, serverUrl, sessionToken]);

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
