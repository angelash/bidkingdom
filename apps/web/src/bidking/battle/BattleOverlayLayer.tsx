import type { PlayerSnapshot } from '@bitkingdom/shared';
import { bidKingLiveIntelItems } from '../catalog/codexRuntime';
import { LiveIntelModal, type LiveIntelSeed } from '../intel/LiveIntelPanels';
import { BidComposerModal, ConfirmBidModal } from './BattlePanels';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

interface BattleOverlayLayerProps {
  availableCash: number;
  bidAmountHidden: boolean;
  bidComposerOpen: boolean;
  bidDraft: string;
  bidDraftError?: string;
  bidDraftValid: boolean;
  confirmBidAmount?: number;
  currentRound?: CurrentRound;
  liveIntelOpen: boolean;
  liveIntelSeed?: LiveIntelSeed;
  previousBid?: number;
  onBackspaceBid: () => void;
  onCancelBidComposer: () => void;
  onCancelConfirmBid: () => void;
  onClearBid: () => void;
  onCloseLiveIntel: () => void;
  onConfirmBid: () => void;
  onDoubleBid: () => void;
  onPressBidKey: (key: string) => void;
  onRequestBidConfirm: () => void;
  onSetBidToMax: () => void;
  onSetBidToMinimum: () => void;
  onToggleBidHidden: () => void;
  onUsePreviousBid: (amount: number) => void;
}

export function BattleOverlayLayer({
  availableCash,
  bidAmountHidden,
  bidComposerOpen,
  bidDraft,
  bidDraftError,
  bidDraftValid,
  confirmBidAmount,
  currentRound,
  liveIntelOpen,
  liveIntelSeed,
  previousBid,
  onBackspaceBid,
  onCancelBidComposer,
  onCancelConfirmBid,
  onClearBid,
  onCloseLiveIntel,
  onConfirmBid,
  onDoubleBid,
  onPressBidKey,
  onRequestBidConfirm,
  onSetBidToMax,
  onSetBidToMinimum,
  onToggleBidHidden,
  onUsePreviousBid
}: BattleOverlayLayerProps): JSX.Element {
  return (
    <>
      {bidComposerOpen && currentRound && (
        <BidComposerModal
          amount={bidDraft}
          amountHidden={bidAmountHidden}
          availableCash={availableCash}
          canConfirm={bidDraftValid}
          error={bidDraftError}
          previousBid={previousBid}
          round={currentRound}
          onPress={onPressBidKey}
          onBackspace={onBackspaceBid}
          onClear={onClearBid}
          onDouble={onDoubleBid}
          onUseMax={onSetBidToMax}
          onUseMinimum={onSetBidToMinimum}
          onToggleHidden={onToggleBidHidden}
          onUsePrevious={onUsePreviousBid}
          onCancel={onCancelBidComposer}
          onConfirm={onRequestBidConfirm}
        />
      )}

      {confirmBidAmount !== undefined && (
        <ConfirmBidModal
          amount={confirmBidAmount}
          onCancel={onCancelConfirmBid}
          onConfirm={onConfirmBid}
        />
      )}

      {liveIntelOpen && currentRound && (
        <LiveIntelModal
          items={bidKingLiveIntelItems}
          initialSeed={liveIntelSeed}
          key={liveIntelSeed?.slotId ?? 'all_intel'}
          round={currentRound}
          onClose={onCloseLiveIntel}
        />
      )}
    </>
  );
}
