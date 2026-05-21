import { useEffect } from 'react';

interface UseGameKeyboardLayerArgs {
  bidComposerOpen: boolean;
  confirmBidOpen: boolean;
  enabled: boolean;
  liveIntelOpen: boolean;
  onCloseBidComposer: () => void;
  onCloseConfirmBid: () => void;
  onCloseLiveIntel: () => void;
  onReturnHome: () => void;
}

export function useGameKeyboardLayer({
  bidComposerOpen,
  confirmBidOpen,
  enabled,
  liveIntelOpen,
  onCloseBidComposer,
  onCloseConfirmBid,
  onCloseLiveIntel,
  onReturnHome
}: UseGameKeyboardLayerArgs): void {
  useEffect(() => {
    function closeCurrentGameLayer(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || !enabled) {
        return;
      }
      event.preventDefault();
      if (bidComposerOpen) {
        onCloseBidComposer();
        return;
      }
      if (confirmBidOpen) {
        onCloseConfirmBid();
        return;
      }
      if (liveIntelOpen) {
        onCloseLiveIntel();
        return;
      }
      onReturnHome();
    }
    window.addEventListener('keydown', closeCurrentGameLayer);
    return () => window.removeEventListener('keydown', closeCurrentGameLayer);
  }, [
    bidComposerOpen,
    confirmBidOpen,
    enabled,
    liveIntelOpen,
    onCloseBidComposer,
    onCloseConfirmBid,
    onCloseLiveIntel,
    onReturnHome
  ]);
}
