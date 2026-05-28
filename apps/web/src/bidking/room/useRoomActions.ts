import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import type {
  CoreAuctionMode,
  PlayerProfile,
  PlayerSnapshot,
  RoomAck,
  RoomSnapshot
} from '@bitkingdom/shared';
import { gameConfig } from '@bitkingdom/config';
import {
  bidKingBidMapAccess,
  bidKingHeroIdForRoleId,
  bidKingInitialCashForBidMap
} from '@bitkingdom/match-core';
import {
  SELECTED_BID_MAP_KEY,
  modeForBidMapId
} from '../battlePrev/bidMapRuntime';
import {
  saveCoreAuctionMode,
  saveSession
} from '../profile/profileSession';
import type { BidKingSocket } from '../socket/useBidKingSocket';

interface UseRoomActionsArgs {
  activeRoomCodeRef: MutableRefObject<string | undefined>;
  botCount: number;
  coreAuctionMode: CoreAuctionMode;
  defaultBidMapId?: number;
  isHost: boolean;
  playerName: string;
  profile: PlayerProfile;
  profileId: string;
  room?: RoomSnapshot;
  selectedBidMapId?: number;
  selectedRoleId: string;
  setCoreAuctionMode: (mode: CoreAuctionMode) => void;
  setRoom: (room?: RoomSnapshot) => void;
  setSelectedBidMapId: (bidMapId?: number) => void;
  setSelectedRoleId: (roleId: string) => void;
  setSelfPlayerId: (playerId?: string) => void;
  setToast: (message: string) => void;
  onMatchmakingStarted: (state: { bidMapId: number; estimatedSeconds: number; startedAt: number; ticketId?: string }) => void;
  snapshot?: PlayerSnapshot;
  socket: BidKingSocket | null;
}

export interface RoomActions {
  cancelMatchmaking: () => void;
  createRoom: (nextBidMapId?: number, roleId?: string) => boolean;
  matchGame: (nextBidMapId?: number, roleId?: string) => boolean;
  selectBidMap: (bidMapId: number) => void;
  selectCoreAuctionMode: (mode: CoreAuctionMode) => void;
  selectRole: (roleId: string) => void;
  startMatch: () => void;
}

export function useRoomActions({
  activeRoomCodeRef,
  botCount,
  coreAuctionMode,
  isHost,
  playerName,
  profile,
  profileId,
  room,
  selectedBidMapId,
  selectedRoleId,
  setCoreAuctionMode,
  setRoom,
  setSelectedBidMapId,
  setSelectedRoleId,
  setSelfPlayerId,
  setToast,
  onMatchmakingStarted,
  snapshot,
  socket
}: UseRoomActionsArgs): RoomActions {
  const matchmakingTicketRef = useRef<string>();

  const emitCreateRoom = useCallback((
    nextBidMapId: number | undefined,
    roleId: string | undefined,
    onAck: (ack: RoomAck, bidMapId: number) => void
  ): boolean => {
    if (!socket) {
      setToast('正在连接拍场，请稍候');
      return false;
    }
    const bidMapId = nextBidMapId ?? selectedBidMapId;
    if (!bidMapId) {
      setToast('请选择拍场');
      return false;
    }
    const access = bidKingBidMapAccess(profile, bidMapId);
    if (!access.canEnter) {
      setToast(`未满足入场条件：${access.reasons.join('、')}`);
      return false;
    }
    if (bidMapId !== selectedBidMapId) {
      setSelectedBidMapId(bidMapId);
    }
    const requestedRoleId = roleId ?? selectedRoleId;
    if (requestedRoleId !== selectedRoleId) {
      setSelectedRoleId(requestedRoleId);
    }
    const sceneMode = modeForBidMapId(bidMapId) ?? coreAuctionMode;
    localStorage.setItem('bk_player_name', playerName);
    saveCoreAuctionMode(sceneMode);
    localStorage.setItem(SELECTED_BID_MAP_KEY, String(bidMapId));
    setCoreAuctionMode(sceneMode);
    socket.emit('createRoom', {
      playerName,
      profileId,
      roleId: requestedRoleId,
      sourceHeroId: bidKingHeroIdForRoleId(requestedRoleId, gameConfig.roles),
      botCount,
      coreAuctionMode: sceneMode,
      selectedBidMapId: bidMapId,
      initialCash: bidKingInitialCashForBidMap(bidMapId)
    }, (ack: RoomAck) => {
      activeRoomCodeRef.current = ack.room.code;
      setSelfPlayerId(ack.selfPlayerId);
      saveSession(ack.room.code, ack.selfPlayerId);
      onAck(ack, bidMapId);
      setRoom(ack.room);
    });
    return true;
  }, [
    activeRoomCodeRef,
    botCount,
    coreAuctionMode,
    playerName,
    profile,
    profileId,
    selectedBidMapId,
    selectedRoleId,
    setCoreAuctionMode,
    setSelectedBidMapId,
    setSelectedRoleId,
    setRoom,
    setSelfPlayerId,
    setToast,
    socket
  ]);

  const createRoom = useCallback((nextBidMapId?: number, roleId?: string): boolean => (
    emitCreateRoom(nextBidMapId, roleId, (ack) => {
      setToast(`房间 ${ack.room.code} 已创建`);
    })
  ), [emitCreateRoom, setToast]);

  const matchGame = useCallback((nextBidMapId?: number, roleId?: string): boolean => {
    if (!socket) {
      setToast('正在连接拍场，请稍候');
      return false;
    }
    const bidMapId = nextBidMapId ?? selectedBidMapId;
    if (!bidMapId) {
      setToast('请选择拍场');
      return false;
    }
    const access = bidKingBidMapAccess(profile, bidMapId);
    if (!access.canEnter) {
      setToast(`未满足入场条件：${access.reasons.join('、')}`);
      return false;
    }
    if (bidMapId !== selectedBidMapId) {
      setSelectedBidMapId(bidMapId);
    }
    const requestedRoleId = roleId ?? selectedRoleId;
    if (requestedRoleId !== selectedRoleId) {
      setSelectedRoleId(requestedRoleId);
    }
    const sceneMode = modeForBidMapId(bidMapId) ?? coreAuctionMode;
    localStorage.setItem('bk_player_name', playerName);
    saveCoreAuctionMode(sceneMode);
    localStorage.setItem(SELECTED_BID_MAP_KEY, String(bidMapId));
    setCoreAuctionMode(sceneMode);
    socket.emit('matchGame', {
      playerName,
      profileId,
      roleId: requestedRoleId,
      sourceHeroId: bidKingHeroIdForRoleId(requestedRoleId, gameConfig.roles),
      coreAuctionMode: sceneMode,
      selectedBidMapId: bidMapId
    }, (ack) => {
      if (!ack.ok) {
        setToast(ack.error);
        return;
      }
      matchmakingTicketRef.current = ack.ticketId;
      onMatchmakingStarted({
        bidMapId,
        estimatedSeconds: ack.estimatedSeconds,
        startedAt: Date.now(),
        ticketId: ack.ticketId
      });
      setToast('正在匹配对局');
    });
    return true;
  }, [
    coreAuctionMode,
    onMatchmakingStarted,
    playerName,
    profile,
    profileId,
    selectedBidMapId,
    selectedRoleId,
    setCoreAuctionMode,
    setSelectedBidMapId,
    setSelectedRoleId,
    setToast,
    socket
  ]);

  const cancelMatchmaking = useCallback((): void => {
    const ticketId = matchmakingTicketRef.current;
    matchmakingTicketRef.current = undefined;
    socket?.emit('cancelMatchmaking', { ticketId });
  }, [socket]);

  const selectRole = useCallback((roleId: string): void => {
    setSelectedRoleId(roleId);
    socket?.emit('selectRole', { roleId, sourceHeroId: bidKingHeroIdForRoleId(roleId, gameConfig.roles) });
  }, [setSelectedRoleId, socket]);

  const selectCoreAuctionMode = useCallback((mode: CoreAuctionMode): void => {
    setCoreAuctionMode(mode);
    saveCoreAuctionMode(mode);
    if (room && !snapshot && isHost) {
      socket?.emit('setCoreAuctionMode', { mode });
    }
  }, [isHost, room, setCoreAuctionMode, snapshot, socket]);

  const selectBidMap = useCallback((bidMapId: number): void => {
    const access = bidKingBidMapAccess(profile, bidMapId);
    if (!access.canEnter) {
      setToast(`未满足入场条件：${access.reasons.join('、')}`);
      return;
    }
    setSelectedBidMapId(bidMapId);
    localStorage.setItem(SELECTED_BID_MAP_KEY, String(bidMapId));
    const sceneMode = modeForBidMapId(bidMapId);
    if (sceneMode) {
      setCoreAuctionMode(sceneMode);
      saveCoreAuctionMode(sceneMode);
      if (room && !snapshot && isHost) {
        socket?.emit('setCoreAuctionMode', { mode: sceneMode });
      }
    }
    if (room && !snapshot && isHost) {
      socket?.emit('setSelectedBidMap', { bidMapId });
    }
  }, [isHost, profile, room, setCoreAuctionMode, setSelectedBidMapId, setToast, snapshot, socket]);

  const startMatch = useCallback((): void => {
    socket?.emit('startMatch');
  }, [socket]);

  return useMemo(() => ({
    cancelMatchmaking,
    createRoom,
    matchGame,
    selectBidMap,
    selectCoreAuctionMode,
    selectRole,
    startMatch
  }), [cancelMatchmaking, createRoom, matchGame, selectBidMap, selectCoreAuctionMode, selectRole, startMatch]);
}
