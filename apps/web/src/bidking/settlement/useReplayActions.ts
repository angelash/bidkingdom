import { useCallback, useState } from 'react';
import { fetchReplayBundle } from '../api/bidkingApiClient';
import type { ReplayBundle } from './SettlementPanels';

interface UseReplayActionsArgs {
  matchId?: string;
  serverUrl: string;
}

export interface ReplayActions {
  loadReplay: () => Promise<void>;
  replay?: ReplayBundle;
  resetReplay: () => void;
  showReplay: boolean;
  toggleReplay: () => void;
}

export function useReplayActions({ matchId, serverUrl }: UseReplayActionsArgs): ReplayActions {
  const [replay, setReplay] = useState<ReplayBundle>();
  const [showReplay, setShowReplay] = useState(false);

  const loadReplay = useCallback(async (): Promise<void> => {
    if (!matchId) {
      return;
    }
    setReplay(await fetchReplayBundle(serverUrl, matchId));
    setShowReplay(true);
  }, [matchId, serverUrl]);

  const resetReplay = useCallback((): void => {
    setReplay(undefined);
    setShowReplay(false);
  }, []);

  const toggleReplay = useCallback((): void => {
    setShowReplay((value) => !value);
  }, []);

  return {
    loadReplay,
    replay,
    resetReplay,
    showReplay,
    toggleReplay
  };
}
