import { useCallback, type MutableRefObject } from 'react';
import type { PlayerSnapshot, RoomSnapshot } from '@bitkingdom/shared';
import type { BidComposerActions } from '../battle/useBidComposerActions';
import type { LiveIntelActions } from '../intel/useLiveIntelActions';
import { clearSession } from '../profile/profileSession';
import type { ReplayActions } from '../settlement/useReplayActions';
import type { BidKingSocket } from '../socket/useBidKingSocket';
import type { AppView } from './useBidKingAppState';

interface UseBidKingAppNavigationArgs {
  activeRoomCodeRef: MutableRefObject<string | undefined>;
  bidComposer: BidComposerActions;
  liveIntel: LiveIntelActions;
  replay: ReplayActions;
  selectedSkillTargetId?: string;
  setRoom: (room?: RoomSnapshot) => void;
  setSelfPlayerId: (playerId?: string) => void;
  setSkillTargetId: (playerId?: string) => void;
  setSnapshot: (snapshot?: PlayerSnapshot) => void;
  setToast: (message: string) => void;
  setView: (view: AppView) => void;
  socket: BidKingSocket | null;
}

export function useBidKingAppNavigation({
  activeRoomCodeRef,
  bidComposer,
  liveIntel,
  replay,
  selectedSkillTargetId,
  setRoom,
  setSelfPlayerId,
  setSkillTargetId,
  setSnapshot,
  setToast,
  setView,
  socket
}: UseBidKingAppNavigationArgs) {
  const returnHome = useCallback((): void => {
    socket?.emit('leaveRoom');
    activeRoomCodeRef.current = undefined;
    clearSession();
    setView('play');
    window.history.replaceState(null, '', '/');
    setRoom(undefined);
    setSnapshot(undefined);
    setSelfPlayerId(undefined);
    setSkillTargetId(undefined);
    replay.resetReplay();
    bidComposer.resetBidComposer();
    liveIntel.resetLiveIntel();
    setToast('已返回主界面，可以重新创建或加入房间');
  }, [
    activeRoomCodeRef,
    bidComposer,
    liveIntel,
    replay,
    setRoom,
    setSelfPlayerId,
    setSkillTargetId,
    setSnapshot,
    setToast,
    setView,
    socket
  ]);

  const useSkillClick = useCallback((): void => {
    socket?.emit('useSkill', { targetPlayerId: selectedSkillTargetId });
  }, [selectedSkillTargetId, socket]);

  const useBattleItemClick = useCallback((itemId: number, targetPlayerId?: string): void => {
    socket?.emit('useBattleItem', { itemId, targetPlayerId });
  }, [socket]);

  return {
    returnHome,
    useBattleItemClick,
    useSkillClick
  };
}
