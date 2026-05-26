import type { CSSProperties } from 'react';
import { Archive, BadgeDollarSign, BookOpen, Gavel } from 'lucide-react';
import {
  Emoji as bidKingEmojis,
  bidKingBattleItemDisplayName,
  bidKingEmojiPresentation,
  emojiAllowedHeroIds,
  emojiAllowedRoleIds,
  emojiHeroIdForSeat,
  emojiUnlockRequirements,
  type BidKingBattleItemRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile, PlayerSnapshot, PublicPlayer, WarehouseSlotView } from '@bitkingdom/shared';
import { containerArtForKey } from '../../artAssets';
import { MarketIntelPanel } from '../intel/LiveIntelPanels';
import {
  ClueReviewPanel,
  LootRevealSummary,
  ProgressPanel,
  RareRevealBanner,
  RoundFeedbackPanel,
  SettlementPanel
} from '../settlement/SettlementPanels';
import { BattleFeedbackLayer } from './BattleFeedbackLayer';
import {
  AuctioneerRevealOverlay,
  BidPanel,
  CloseRuleLadder,
  MapIntroOverlay,
  PlayerGrid,
  SkillFeedPanel,
  WarehouseGrid,
  auctionModeName,
  auctionRuleText,
  playerNameById,
  roundPhaseName
} from './BattlePanels';
import type { BattleItemActionState } from './battleItemUi';

export interface EquippedBattleItemView extends BattleItemActionState {
  inventory: number;
  itemId: number;
  row?: BidKingBattleItemRow;
}

interface MatchShellProps {
  canBid: boolean;
  canUseBattleItem: boolean;
  currentRound: NonNullable<PlayerSnapshot['public']['currentRound']>;
  equippedBattleItems: EquippedBattleItemView[];
  phaseRemaining: number;
  profile: PlayerProfile;
  selectedSkillTargetId?: string;
  selfPlayer?: PublicPlayer;
  showAuctioneerReveal: boolean;
  showMapIntro: boolean;
  skillTargets: PublicPlayer[];
  snapshot: PlayerSnapshot;
  onInspectWarehouseSlot: (slot: WarehouseSlotView) => void;
  onOpenLiveIntel: () => void;
  onPassAuction: () => void;
  onSelectSkillTarget: (playerId: string) => void;
  onSendEmote: (emote: string) => void;
  onSubmitBid: () => void;
  onUseBattleItem: (itemId: number, targetPlayerId?: string) => void;
}

export function MatchShell({
  canBid,
  canUseBattleItem,
  currentRound,
  equippedBattleItems,
  phaseRemaining,
  profile,
  selectedSkillTargetId,
  selfPlayer,
  showAuctioneerReveal,
  showMapIntro,
  skillTargets,
  snapshot,
  onInspectWarehouseSlot,
  onOpenLiveIntel,
  onPassAuction,
  onSelectSkillTarget,
  onSendEmote,
  onSubmitBid,
  onUseBattleItem
}: MatchShellProps): JSX.Element {
  const emojiActions = bidKingEmojis.map((emoji) => ({
    emoji,
    presentation: bidKingEmojiPresentation(emoji),
    ...emojiButtonState(emoji, profile, selfPlayer)
  }));
  const canSelectTarget = equippedBattleItems.some((entry) => (
    entry.effectPlan?.targetPlayerRequired && entry.inventory > 0 && canUseBattleItem
  ));

  return (
    <section
      className="match-layout auction-room"
      style={{ '--room-art': `url(${containerArtForKey(currentRound.container.artKey)})` } as CSSProperties}
    >
      {showMapIntro && <MapIntroOverlay round={currentRound} />}
      {showAuctioneerReveal && <AuctioneerRevealOverlay round={currentRound} />}

      <BattleFeedbackLayer
        currentRound={currentRound}
        phaseRemaining={phaseRemaining}
        selfPlayer={selfPlayer}
        snapshot={snapshot}
      />

      <aside className="player-rail">
        <PlayerGrid players={snapshot.public.players} selfPlayerId={selfPlayer?.id} compact roundIndex={currentRound.index} />
        <ProgressPanel snapshot={snapshot} />
      </aside>

      <section className="auction-stage">
        <div className="round-hud">
          <span>第 {currentRound.index + 1}/{snapshot.public.totalRounds} 轮</span>
          <strong>{auctionModeName(currentRound.auctionMode)}</strong>
          <span>{roundPhaseName(currentRound)} · {phaseRemaining}s</span>
        </div>
        <div className="rule-strip">
          <Gavel size={16} />
          <span>{auctionRuleText(currentRound.auctionMode)}</span>
          {currentRound.bidFeedback?.leaderPlayerId && (
            <strong>本轮反馈：{playerNameById(snapshot.public.players, currentRound.bidFeedback.leaderPlayerId)}领先</strong>
          )}
        </div>
        <CloseRuleLadder currentRound={currentRound.index} />
        <MarketIntelPanel snapshot={snapshot} />
        <SkillFeedPanel snapshot={snapshot} />
        <BidPanel players={snapshot.public.players} snapshot={snapshot} />
        <RoundFeedbackPanel players={snapshot.public.players} snapshot={snapshot} />
        {currentRound.settlement && (
          <SettlementPanel
            round={currentRound}
            settlement={currentRound.settlement}
            players={snapshot.public.players}
            selfPlayerId={selfPlayer?.id}
          />
        )}
        {currentRound.settlement && currentRound.phase !== 'reveal' && <ClueReviewPanel settlement={currentRound.settlement} />}
      </section>

      <aside className="warehouse-side">
        <div className={`warehouse-header risk-${currentRound.container.risk}`}>
          <span>{currentRound.container.source}</span>
          <strong>{currentRound.container.name}</strong>
          {!currentRound.container.estimateHidden && (
            <em>{currentRound.container.estimateMin.toLocaleString()} - {currentRound.container.estimateMax.toLocaleString()}</em>
          )}
        </div>
        <LootRevealSummary round={currentRound} />
        <RareRevealBanner round={currentRound} />
        <WarehouseGrid round={currentRound} onInspectSlot={onInspectWarehouseSlot} />
      </aside>

      {currentRound.phase === 'auction' && (
        <section className="action-bar">
          <div className="cash-box">
            <BadgeDollarSign size={18} />
            {selfPlayer?.cash.toLocaleString() ?? '-'}
          </div>
          <button className="primary" onClick={onSubmitBid} disabled={!canBid}>
            <Gavel size={18} />
            出价
          </button>
          <button className="danger" onClick={onPassAuction} disabled={!canBid}>停手</button>
          <select
            className="target-select"
            value={selectedSkillTargetId ?? ''}
            onChange={(event) => onSelectSkillTarget(event.target.value)}
            disabled={!canSelectTarget || skillTargets.length === 0}
            title="试宝令目标"
          >
            {skillTargets.map((player) => (
              <option value={player.id} key={player.id}>{player.name}</option>
            ))}
          </select>
          {equippedBattleItems.length > 0 && (
            <div className="battle-item-action-row">
              {equippedBattleItems.map((entry) => (
                <button
                  className={`battle-item-action ${entry.cooldownRemaining > 0 ? 'cooldown' : ''}`}
                  disabled={!entry.canUse}
                  key={entry.itemId}
                  onClick={() => onUseBattleItem(
                    entry.itemId,
                    entry.effectPlan?.targetPlayerRequired ? selectedSkillTargetId : undefined
                  )}
                  title={entry.actionTitle}
                  type="button"
                >
                  <span>
                    <Archive size={16} />
                    <strong>{entry.row ? bidKingBattleItemDisplayName(entry.row) : `试宝令${entry.itemId}`}</strong>
                    <b>x{entry.inventory}</b>
                  </span>
                  <small>{entry.disabledReason ?? entry.badges.slice(0, 3).join(' · ')}</small>
                </button>
              ))}
            </div>
          )}
          <button onClick={onOpenLiveIntel}>
            <BookOpen size={18} />
            情报
          </button>
          <div className="emoji-action-row">
            {emojiActions.map(({ emoji, presentation, disabled, title }) => (
              <button
                className={`emote-${presentation.visualClass}`}
                key={emoji.id}
                disabled={disabled}
                onClick={() => onSendEmote(emoji.id)}
                title={title}
                type="button"
              >
                {presentation.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

type EmojiRow = (typeof bidKingEmojis)[number];

function emojiButtonState(
  emoji: EmojiRow,
  profile: PlayerProfile,
  selfPlayer?: PublicPlayer
): { disabled: boolean; title: string } {
  const allowedRoles = emojiAllowedRoleIds(emoji);
  if (allowedRoles.length > 0 && (!selfPlayer?.roleId || !allowedRoles.includes(selfPlayer.roleId))) {
    return { disabled: true, title: '当前身份不可使用该表情' };
  }

  const allowedHeroIds = emojiAllowedHeroIds(emoji);
  const currentHeroId = selfPlayer ? emojiHeroIdForSeat(selfPlayer.seat) : undefined;
  if (allowedHeroIds.length > 0 && (!currentHeroId || !allowedHeroIds.includes(currentHeroId))) {
    return { disabled: true, title: '当前竞买人不可使用该表情' };
  }

  const missingRequirement = emojiUnlockRequirements(emoji).find(
    (requirement) => profileInventoryQuantity(profile, requirement.refId) < requirement.quantity
  );
  if (missingRequirement) {
    return {
      disabled: true,
      title: `未解锁：需要珍物 ${missingRequirement.refId} x${missingRequirement.quantity}`
    };
  }

  return {
    disabled: false,
    title: bidKingEmojiPresentation(emoji).description
  };
}

function profileInventoryQuantity(profile: PlayerProfile, refId: string): number {
  return profile.inventory
    .filter((entry) => entry.refId === refId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}
