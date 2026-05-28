import type { CSSProperties } from 'react';
import { Archive, BadgeDollarSign, BookOpen, Gavel, Smile } from 'lucide-react';
import {
  bidKingBattleItemDisplayName,
  type BidKingBattleItemRow
} from '@bitkingdom/bidking-compat';
import type { PlayerSnapshot, PublicPlayer, WarehouseSlotView } from '@bitkingdom/shared';
import { containerArtForKey } from '../../artAssets';
import { MarketIntelPanel } from '../intel/LiveIntelPanels';
import {
  BattleRandomOverlay,
  CloseRuleLadder,
  IntelligencePanelOverlay,
  PlayerGrid,
  WarehouseGrid,
  auctionModeName,
  auctionRuleText,
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
  selectedSkillTargetId?: string;
  selfPlayer?: PublicPlayer;
  showBattleRandom: boolean;
  showIntelligencePanel: boolean;
  skillTargets: PublicPlayer[];
  snapshot: PlayerSnapshot;
  onInspectWarehouseSlot: (slot: WarehouseSlotView) => void;
  onOpenHandBook: () => void;
  onOpenLiveIntel: () => void;
  onPassAuction: () => void;
  onSendEmote: (emote: string) => void;
  onSelectSkillTarget: (playerId: string) => void;
  onSubmitBid: () => void;
  onUseBattleItem: (itemId: number, targetPlayerId?: string) => void;
}

export function MatchShell({
  canBid,
  canUseBattleItem,
  currentRound,
  equippedBattleItems,
  phaseRemaining,
  selectedSkillTargetId,
  selfPlayer,
  showBattleRandom,
  showIntelligencePanel,
  skillTargets,
  snapshot,
  onInspectWarehouseSlot,
  onOpenHandBook,
  onOpenLiveIntel,
  onPassAuction,
  onSendEmote,
  onSelectSkillTarget,
  onSubmitBid,
  onUseBattleItem
}: MatchShellProps): JSX.Element {
  const canSelectTarget = equippedBattleItems.some((entry) => (
    entry.effectPlan?.targetPlayerRequired && entry.inventory > 0 && canUseBattleItem
  ));

  return (
    <section
      className="match-layout auction-room"
      style={{ '--room-art': `url(${containerArtForKey(currentRound.container.artKey)})` } as CSSProperties}
    >
      {showBattleRandom && <BattleRandomOverlay round={currentRound} />}
      {showIntelligencePanel && <IntelligencePanelOverlay round={currentRound} />}

      <aside className="player-rail">
        <PlayerGrid players={snapshot.public.players} selfPlayerId={selfPlayer?.id} compact roundIndex={currentRound.index} />
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
        </div>
        <CloseRuleLadder currentRound={currentRound.index} />
        <MarketIntelPanel snapshot={snapshot} />
      </section>

      <aside className="warehouse-side">
        <WarehouseGrid
          round={currentRound}
          onInspectSlot={onInspectWarehouseSlot}
          onOpenEncyclopedia={onOpenHandBook}
        />
      </aside>

      {currentRound.phase === 'auction' && (
        <section className="action-bar">
          <div className="action-main-row">
            <div className="cash-box">
              <BadgeDollarSign size={18} />
              {selfPlayer?.cash.toLocaleString() ?? '-'}
            </div>
            <button className="primary" onClick={onSubmitBid} disabled={!canBid} type="button">
              <Gavel size={18} />
              出价
            </button>
            <button className="danger" onClick={onPassAuction} disabled={!canBid} type="button">停手</button>
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
            <button className="intel-action-button" onClick={onOpenLiveIntel} type="button">
              <BookOpen size={18} />
              情报
            </button>
          </div>
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
        </section>
      )}

      <button className="battle-emote-button" onClick={() => onSendEmote('101')} title="表情" type="button">
        <Smile size={24} />
      </button>
    </section>
  );
}
