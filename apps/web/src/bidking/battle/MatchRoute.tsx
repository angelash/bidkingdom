import type { PlayerSnapshot } from '@bitkingdom/shared';
import { BattleFinalCeremony } from '../settlement/BattleFinalCeremony';
import type { LiveIntelActions } from '../intel/useLiveIntelActions';
import { BattleOverlayLayer } from './BattleOverlayLayer';
import { MatchShell } from './MatchShell';
import type { BidComposerActions } from './useBidComposerActions';
import type { MatchDerivedState } from './useMatchDerivedState';

interface MatchRouteProps {
  bidComposer: BidComposerActions;
  liveIntel: LiveIntelActions;
  matchState: MatchDerivedState;
  snapshot?: PlayerSnapshot;
  onPassAuction: () => void;
  onSelectSkillTarget: (playerId: string) => void;
  onUseBattleItem: (itemId: number, targetPlayerId?: string) => void;
}

export function MatchRoute({
  bidComposer,
  liveIntel,
  matchState,
  snapshot,
  onPassAuction,
  onSelectSkillTarget,
  onUseBattleItem
}: MatchRouteProps): JSX.Element {
  const currentRound = matchState.currentRound;
  const showFinalCeremony = Boolean(
    snapshot &&
    currentRound &&
    currentRound.settlement?.isFinal &&
    (snapshot.public.status === 'ended' || currentRound.phase === 'reveal' || currentRound.phase === 'settlement')
  );

  return (
    <>
      {snapshot && currentRound && (snapshot.public.status !== 'ended' || showFinalCeremony) && (
        showFinalCeremony ? (
          <BattleFinalCeremony
            round={currentRound}
            selfPlayerId={matchState.selfPlayer?.id}
            snapshot={snapshot}
          />
        ) : (
          <MatchShell
            canBid={matchState.canBid}
            canUseBattleItem={matchState.canUseBattleItem}
            currentRound={currentRound}
            equippedBattleItems={matchState.equippedBattleItems}
            phaseRemaining={matchState.phaseRemaining}
            selectedSkillTargetId={matchState.selectedSkillTargetId}
            selfPlayer={matchState.selfPlayer}
            showBattleRandom={matchState.showBattleRandom}
            showIntelligencePanel={matchState.showIntelligencePanel}
            skillTargets={matchState.skillTargets}
            snapshot={snapshot}
            onInspectWarehouseSlot={liveIntel.inspectWarehouseSlot}
            onOpenLiveIntel={() => liveIntel.openLiveIntel()}
            onPassAuction={onPassAuction}
            onSelectSkillTarget={onSelectSkillTarget}
            onSubmitBid={bidComposer.submitBidClick}
            onUseBattleItem={onUseBattleItem}
          />
        )
      )}

      <BattleOverlayLayer
        availableCash={bidComposer.availableCash}
        bidAmountHidden={bidComposer.bidAmountHidden}
        bidComposerOpen={bidComposer.bidComposerOpen}
        bidDraft={bidComposer.bidDraft}
        bidDraftError={bidComposer.bidDraftError}
        bidDraftValid={bidComposer.bidDraftValid}
        confirmBidAmount={bidComposer.confirmBidAmount}
        currentRound={currentRound}
        liveIntelOpen={liveIntel.liveIntelOpen}
        liveIntelSeed={liveIntel.liveIntelSeed}
        previousBid={matchState.previousSelfBid}
        onBackspaceBid={bidComposer.backspaceBidDraft}
        onCancelBidComposer={bidComposer.closeBidComposer}
        onCancelConfirmBid={bidComposer.closeConfirmBid}
        onClearBid={bidComposer.clearBidDraft}
        onCloseLiveIntel={liveIntel.closeLiveIntel}
        onConfirmBid={bidComposer.submitConfirmedBid}
        onDoubleBid={bidComposer.doubleBidDraft}
        onPressBidKey={bidComposer.pressBidKey}
        onRequestBidConfirm={bidComposer.requestBidConfirm}
        onSetBidToMax={bidComposer.setBidDraftToMax}
        onSetBidToMinimum={bidComposer.setBidDraftToMinimum}
        onToggleBidHidden={bidComposer.toggleBidAmountHidden}
        onUsePreviousBid={bidComposer.usePreviousBidAmount}
      />

    </>
  );
}
