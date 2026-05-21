import { useCallback, useState } from 'react';
import type { WarehouseSlotView } from '@bitkingdom/shared';
import { liveIntelSeedFromSlot, type LiveIntelSeed } from './LiveIntelPanels';

export interface LiveIntelActions {
  closeLiveIntel: () => void;
  inspectWarehouseSlot: (slot: WarehouseSlotView) => void;
  liveIntelOpen: boolean;
  liveIntelSeed?: LiveIntelSeed;
  openLiveIntel: (seed?: LiveIntelSeed) => void;
  resetLiveIntel: () => void;
}

export function useLiveIntelActions(): LiveIntelActions {
  const [liveIntelOpen, setLiveIntelOpen] = useState(false);
  const [liveIntelSeed, setLiveIntelSeed] = useState<LiveIntelSeed>();

  const openLiveIntel = useCallback((seed?: LiveIntelSeed): void => {
    setLiveIntelSeed(seed);
    setLiveIntelOpen(true);
  }, []);

  const closeLiveIntel = useCallback((): void => {
    setLiveIntelOpen(false);
  }, []);

  const resetLiveIntel = useCallback((): void => {
    setLiveIntelOpen(false);
    setLiveIntelSeed(undefined);
  }, []);

  const inspectWarehouseSlot = useCallback((slot: WarehouseSlotView): void => {
    openLiveIntel(liveIntelSeedFromSlot(slot));
  }, [openLiveIntel]);

  return {
    closeLiveIntel,
    inspectWarehouseSlot,
    liveIntelOpen,
    liveIntelSeed,
    openLiveIntel,
    resetLiveIntel
  };
}
