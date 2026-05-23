import type { PlayerProfile, PlayerSnapshot } from '@bitkingdom/shared';
import { BattleFinalCeremony } from '../settlement/BattleFinalCeremony';
import type { LiveIntelActions } from '../intel/useLiveIntelActions';
import { FinalSummaryPanel } from '../settlement/SettlementPanels';
import type { ReplayActions } from '../settlement/useReplayActions';
import { BattleOverlayLayer } from './BattleOverlayLayer';
import { MatchShell } from './MatchShell';
import type { BidComposerActions } from './useBidComposerActions';
import type { MatchDerivedState } from './useMatchDerivedState';

interface MatchRouteProps {
  bidComposer: BidComposerActions;
  liveIntel: LiveIntelActions;
  matchState: MatchDerivedState;
  profile: PlayerProfile;
  replay: ReplayActions;
  snapshot?: PlayerSnapshot;
  tutorialDismissed: boolean;
  onDismissTutorial: () => void;
  onPassAuction: () => void;
  onReturnHome: () => void;
  onSelectSkillTarget: (playerId: string) => void;
  onSendEmote: (emote: string) => void;
  onUseBattleItem: (itemId: number, targetPlayerId?: string) => void;
  onUseSkill: () => void;
}

export function MatchRoute({
  bidComposer,
  liveIntel,
  matchState,
  profile,
  replay,
  snapshot,
  tutorialDismissed,
  onDismissTutorial,
  onPassAuction,
  onReturnHome,
  onSelectSkillTarget,
  onSendEmote,
  onUseBattleItem,
  onUseSkill
}: MatchRouteProps): JSX.Element {
  const currentRound = matchState.currentRound;
  const riskWarning = Boolean(
    matchState.canBid &&
    matchState.recommendedBid &&
    bidComposer.bidAmount > matchState.recommendedBid.safePrice
  );
  const showFinalCeremony = Boolean(
    snapshot &&
    currentRound &&
    snapshot.public.status !== 'ended' &&
    currentRound.settlement?.isFinal &&
    (currentRound.phase === 'reveal' || currentRound.phase === 'settlement')
  );

  return (
    <>
      {snapshot && currentRound && snapshot.public.status !== 'ended' && (
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
            canUseSkill={matchState.canUseSkill}
            currentRound={currentRound}
            equippedBattleItems={matchState.equippedBattleItems}
            phaseRemaining={matchState.phaseRemaining}
            profile={profile}
            recommendedBid={matchState.recommendedBid}
            riskWarning={riskWarning}
            selectedSkillTargetId={matchState.selectedSkillTargetId}
            selfPlayer={matchState.selfPlayer}
            showAuctioneerReveal={matchState.showAuctioneerReveal}
            showMapIntro={matchState.showMapIntro}
            skillTargets={matchState.skillTargets}
            snapshot={snapshot}
            tutorialDismissed={tutorialDismissed}
            onDismissTutorial={onDismissTutorial}
            onFillRecommendedBid={bidComposer.fillRecommendedBid}
            onInspectWarehouseSlot={liveIntel.inspectWarehouseSlot}
            onOpenLiveIntel={() => liveIntel.openLiveIntel()}
            onPassAuction={onPassAuction}
            onSelectSkillTarget={onSelectSkillTarget}
            onSendEmote={onSendEmote}
            onSubmitBid={bidComposer.submitBidClick}
            onUseBattleItem={onUseBattleItem}
            onUseSkill={onUseSkill}
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
        recommendedBid={matchState.recommendedBid?.safePrice}
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
        onUseRecommendedBid={bidComposer.fillRecommendedBid}
        onUsePreviousBid={bidComposer.usePreviousBidAmount}
      />

      {snapshot?.public.status === 'ended' && (
        <FinalSummaryPanel
          snapshot={snapshot}
          profile={profile}
          replay={replay.replay}
          showReplay={replay.showReplay}
          onLoadReplay={replay.loadReplay}
          onToggleReplay={replay.toggleReplay}
          onReturnHome={onReturnHome}
        />
      )}
    </>
  );
}
