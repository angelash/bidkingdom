import { useState } from 'react';
import type { PlayerSnapshot } from '@bitkingdom/shared';
import { codexCatalogItems } from '../catalog/codexRuntime';
import { HandBookPanel } from '../catalog/HandBookPanel';
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
  onContinueFinalCeremony: () => void;
  onSendEmote: (emote: string) => void;
  onSelectSkillTarget: (playerId: string) => void;
  onUseBattleItem: (itemId: number, targetPlayerId?: string) => void;
}

export function MatchRoute({
  bidComposer,
  liveIntel,
  matchState,
  snapshot,
  onContinueFinalCeremony,
  onPassAuction,
  onSendEmote,
  onSelectSkillTarget,
  onUseBattleItem
}: MatchRouteProps): JSX.Element {
  const [handBookOpen, setHandBookOpen] = useState(false);
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
            onContinue={onContinueFinalCeremony}
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
            onOpenHandBook={() => setHandBookOpen(true)}
            onOpenLiveIntel={() => liveIntel.openLiveIntel()}
            onPassAuction={onPassAuction}
            onSendEmote={onSendEmote}
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

      {handBookOpen && (
        <HandBookPanel
          items={codexCatalogItems}
          onClose={() => setHandBookOpen(false)}
        />
      )}
    </>
  );
}
