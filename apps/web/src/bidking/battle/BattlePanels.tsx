import React, { useEffect, useState } from 'react';
import { BookOpen, Eye, History, Info, Lock, Sparkles } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import { sourceFinalRevealDelayMs } from '@bitkingdom/shared';
import type {
  Clue,
  PlayerSnapshot,
  PublicContainerInfo,
  PublicPlayer,
  Rarity,
  SkillFeedEntry,
  WarehouseSlotView
} from '@bitkingdom/shared';
import { containerArtForKey, itemIconForKey, roleAvatarForRoleId } from '../../artAssets';
import { bidKingLiveIntelItems } from '../catalog/codexRuntime';
import { formatChineseCompactCurrency } from '../currencyFormat';
import { marketIntelSequenceTimingForRound } from '../intel/marketIntelSequence';
import { progressiveWarehouseSlotsForIntel } from '../intel/warehouseIntelSequence';

export function CloseRuleLadder({ currentRound }: { currentRound: number }): JSX.Element {
  const rules = [
    '第1轮 高出第二名100%',
    '第2轮 高出第二名60%',
    '第3轮 高出第二名30%',
    '第4轮 高出第二名10%',
    '第5轮 高于第二名成交，同价加赛'
  ];
  return (
    <div className="close-rule-ladder">
      {rules.map((rule, index) => (
        <span className={index === Math.min(currentRound, 4) ? 'active' : ''} key={rule}>{rule}</span>
      ))}
    </div>
  );
}

export function PlayerGrid({
  players,
  selfPlayerId,
  compact = false,
  roundIndex
}: {
  players: PublicPlayer[];
  selfPlayerId?: string;
  compact?: boolean;
  roundIndex?: number;
}): JSX.Element {
  return (
    <div className={`player-grid ${compact ? 'compact' : ''}`}>
      {players.map((player) => {
        const role = gameConfig.roles.find((candidate) => candidate.id === player.roleId);
        const roleAvatar = roleAvatarForRoleId(role?.id);
        const currentRank = roundIndex !== undefined ? player.bidRanks?.find((entry) => entry.round === roundIndex + 1) : undefined;
        const currentAmount = currentRank?.visibleAmount && currentRank.amount !== undefined ? ` · ${formatChineseCompactCurrency(currentRank.amount)}` : '';
        const rankLabel = currentRank?.rank ? `第 ${currentRank.rank}${currentAmount}` : player.hasSubmittedBid ? `已出价${currentAmount}` : player.passed ? '停手' : '未出价';
        return (
          <div className={`player-seat ${player.id === selfPlayerId ? 'self' : ''}`} key={player.id}>
            <div className="avatar" style={{ '--role-color': role?.color ?? '#d8b76f' } as React.CSSProperties}>
              {roleAvatar ? <img src={roleAvatar} alt="" loading="lazy" /> : role?.animal.slice(0, 1) ?? '掌'}
            </div>
            <div className="player-info">
              <strong>{player.name}</strong>
              <span>{role?.name ?? player.roleId} · {player.kind === 'bot' ? '随从' : player.status}</span>
            </div>
            <em>{player.netWorth.toLocaleString()}</em>
            {player.emote && (
              <small className={`player-emote emote-${player.emoteVisualClass ?? 'chat'}`} title={emoteTitle(player)}>
                <span>{player.emote}</span>
                {(player.emoteEffectKey || player.emoteAnimationKey) && <i aria-hidden="true" />}
              </small>
            )}
            {roundIndex !== undefined && <b className={`bid-status ${player.hasSubmittedBid || currentRank?.rank ? 'done' : ''}`}>{rankLabel}</b>}
            {roundIndex !== undefined && (
              <div className="round-rank-strip">
                {Array.from({ length: 5 }, (_, index) => {
                  const roundNumber = index + 1;
                  const entry = player.bidRanks?.find((candidate) => candidate.round === roundNumber);
                  const amountText = entry?.visibleAmount && entry.amount !== undefined ? formatChineseCompactCurrency(entry.amount) : undefined;
                  return (
                    <span
                      className={`${entry?.rank ? 'ranked' : entry?.submitted ? 'submitted' : ''} ${entry?.usedSkillName ? 'skilled' : ''} ${roundIndex === index ? 'current' : ''}`}
                      key={`${player.id}_rank_${roundNumber}`}
                      title={roundActionTitle(entry)}
                    >
                      <i>{entry?.rank ? `#${entry.rank}` : roundNumber}</i>
                      {amountText && <small>{amountText}</small>}
                      {entry?.usedSkillName && <b>{skillBadgeText(entry.usedSkillName)}</b>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BattleRandomOverlay({
  round
}: {
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
}): JSX.Element {
  const candidates = mapCandidateReel(round);
  const selected = round.container;
  return (
    <section className="map-intro-overlay" aria-live="polite">
      <div className="map-intro-panel">
        <div className="map-intro-title">
          <Sparkles size={18} />
          <span>场景轮选</span>
          <strong>正在抽取本局拍场</strong>
        </div>
        <div className="map-carousel-window">
          <div className="map-selection-frame" />
          <div className="map-track">
            {candidates.map((candidate, index) => (
              <div
                className={`map-card ${index === candidates.length - 1 ? 'selected' : ''}`}
                key={`${candidate.id}_${index}`}
                style={{ '--map-card-art': `url(${containerArtForKey(candidate.artKey)})` } as React.CSSProperties}
              >
                <span>{riskName(candidate.risk)}</span>
                <strong>{candidate.name}</strong>
                <em>{candidate.source}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="map-result" style={{ '--map-card-art': `url(${containerArtForKey(selected.artKey)})` } as React.CSSProperties}>
          <span />
          <div>
            <small>本局仓型</small>
            <strong>{selected.name}</strong>
            <em>{selected.source}</em>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IntelligencePanelOverlay({
  round
}: {
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
}): JSX.Element {
  const [mountedAt] = useState(() => Date.now());
  const now = useNow();
  const selected = round.intelligenceClue ?? round.publicClues.at(-1);
  const choices = intelligenceChoiceReel(round, selected);
  const revealedReady = now - mountedAt >= 1600;
  return (
    <section className="intelligence-overlay" aria-live="polite">
      <div className="intelligence-panel" style={{ '--intelligence-map-art': `url(${containerArtForKey(round.container.artKey)})` } as React.CSSProperties}>
        <div className="intelligence-heading">
          <Info size={18} />
          <strong>即将揭示情报</strong>
          <span>四张暗牌中随机披露一条拍场情报</span>
        </div>
        <div className="intelligence-card-row">
          {choices.map((choice, index) => {
            const revealed = Boolean(revealedReady && selected?.id === choice.id && choice.text);
            return (
              <div
                className={`intelligence-card ${revealed ? 'selected revealed' : 'hidden'}`}
                key={`${choice.id}_${index}`}
                style={{ '--card-delay': `${index * 120}ms` } as React.CSSProperties}
              >
                {revealed ? (
                  <>
                    <span>{clueKindLabel(choice.kind)}</span>
                    <strong>{trimText(choice.text, 48)}</strong>
                  </>
                ) : (
                  <>
                    <span>暗牌</span>
                    <strong>待揭示</strong>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="intelligence-clue">
          <small>本轮公开情报</small>
          <p>{revealedReady ? selected?.text || '正在整理拍场情报...' : '暗牌正在轮选...'}</p>
        </div>
      </div>
    </section>
  );
}

export function BidComposerModal({
  amount,
  amountHidden,
  availableCash,
  canConfirm,
  error,
  previousBid,
  round,
  onPress,
  onBackspace,
  onClear,
  onDouble,
  onUseMax,
  onUseMinimum,
  onToggleHidden,
  onUsePrevious,
  onCancel,
  onConfirm
}: {
  amount: string;
  amountHidden: boolean;
  availableCash: number;
  canConfirm: boolean;
  error?: string;
  previousBid?: number;
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
  onPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDouble: () => void;
  onUseMax: () => void;
  onUseMinimum: () => void;
  onToggleHidden: () => void;
  onUsePrevious: (amount: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  useEffect(() => {
    function handleBidKey(event: KeyboardEvent): void {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        onPress(event.key);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        onBackspace();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener('keydown', handleBidKey);
    return () => window.removeEventListener('keydown', handleBidKey);
  }, [onBackspace, onConfirm, onPress]);

  return (
    <section className="modal-layer bid-modal-layer">
      <div className="bid-composer">
        <div className="bid-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', '000'].map((key) => (
            <button key={key} onClick={() => onPress(key)}>{key}</button>
          ))}
        </div>
        <div className="bid-tools">
          <button onClick={onBackspace}>退格</button>
          <button onClick={onUseMinimum}>0</button>
          <button onClick={onDouble}>x2.0</button>
          <button disabled={previousBid === undefined} onClick={() => previousBid !== undefined && onUsePrevious(previousBid)}>上一轮</button>
          <button onClick={onUseMax}>最大</button>
          <button onClick={onClear}>归零</button>
          <button onClick={onToggleHidden} title="显示/隐藏金额">
            {amountHidden ? <Lock size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="bid-confirm-pane">
          <p>{bidRuleNotice(round)}</p>
          <strong className={amount ? '' : 'empty'}>{amount ? (amountHidden ? '••••••' : Number(amount).toLocaleString()) : ''}</strong>
          <small>
            现金 {formatChineseCompactCurrency(availableCash)}
          </small>
          {error && <em className="bid-draft-error">{error}</em>}
          <button className="primary" disabled={!canConfirm} onClick={onConfirm}>确认出价</button>
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </section>
  );
}

export function ConfirmBidModal({
  amount,
  onCancel,
  onConfirm
}: {
  amount: number;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <section className="modal-layer confirm-bid-layer">
      <div className="confirm-bid">
        <p>当前出价 {amount.toLocaleString()}，是否确认出价？</p>
        <div>
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </section>
  );
}

export function BidPanel({ players, snapshot }: { players: PublicPlayer[]; snapshot: PlayerSnapshot }): JSX.Element {
  const round = snapshot.public.currentRound;
  if (!round) {
    return <></>;
  }
  const isOpenLike = round.auctionMode === 'open';
  return (
    <section className="bid-block">
      <div className="section-title small">
        <History size={16} />
        <h3>{isOpenLike ? '本轮出价' : '提交状态'}</h3>
      </div>
      {!isOpenLike ? (
        players.map((player) => {
          const feedbackEntry = round.bidFeedback?.publicRanking.find((entry) => entry.playerId === player.id);
          const rank = feedbackEntry?.rank;
          const amount = feedbackEntry?.visibleAmount && feedbackEntry.amount !== undefined ? ` · ${feedbackEntry.amount.toLocaleString()}` : '';
          return (
            <div className="bid-row" key={`${player.id}_sealed`}>
              <span>{player.name}</span>
              <strong>{rank ? `第 ${rank}${amount}` : player.hasSubmittedBid ? '已提交' : '未提交'}</strong>
            </div>
          );
        })
      ) : (
        <>
          {round.bids.length === 0 && <p className="muted">暂无出价</p>}
          {round.bids.slice(-8).map((bid, index) => {
            const bidder = players.find((player) => player.id === bid.playerId);
            const label = bid.visible && bid.amount > 0
              ? bid.amount.toLocaleString()
              : bidder?.passed || (bid.visible && bid.amount === 0)
                ? '停手'
                : '已出价';
            return (
              <div className="bid-row" key={`${bid.playerId}_${bid.createdAt}_${index}`}>
                <span>{bidder?.name ?? playerNameById(players, bid.playerId)}</span>
                <strong>{label}</strong>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

export function SkillFeedPanel({ snapshot }: { snapshot: PlayerSnapshot }): JSX.Element {
  const round = snapshot.public.currentRound;
  const feed = round?.skillFeed ?? [];
  const visibleFeed = feed;
  return (
    <section className="skill-feed-panel">
      <div className="section-title small">
        <Sparkles size={16} />
        <h3>掌眼触发</h3>
      </div>
      {visibleFeed.length === 0 ? (
        <p className="muted">本轮掌眼尚未触发</p>
      ) : (
        <div className="skill-feed-list">
          {visibleFeed.map((entry) => (
            <SkillFeedRow entry={entry} players={snapshot.public.players} key={entry.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function SkillFeedRow({
  entry,
  players
}: {
  entry: SkillFeedEntry;
  players: PublicPlayer[];
}): JSX.Element {
  const actorName = entry.playerId ? playerNameById(players, entry.playerId) : entry.sourceName;
  return (
    <div className={`skill-feed-row source-${entry.source}`}>
      <span>{skillSourceName(entry.source)}</span>
      <div>
        <strong>{entry.skillName}</strong>
        <em>第 {entry.round} 轮 · {actorName}</em>
      </div>
      <p>{trimText(entry.text, 86)}</p>
    </div>
  );
}

export function WarehouseGrid({
  round,
  onInspectSlot,
  onOpenEncyclopedia
}: {
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
  onInspectSlot?: (slot: WarehouseSlotView) => void;
  onOpenEncyclopedia?: () => void;
}): JSX.Element {
  const now = useWarehouseIntelNow(round);
  const slots = progressiveWarehouseSlotsForIntel(round, now, marketIntelSequenceTimingForRound(round, now));
  const revealedById = new Map(round.revealedItems.map((item, index) => [item.id, { item, index }]));
  const knownMinimumEstimate = estimateKnownWarehouseMinimum(slots, revealedById);
  if (slots.length === 0) {
    return <></>;
  }
  return (
    <section className="warehouse-board">
      <header className="warehouse-title-bar">
        <h3>战利品</h3>
        <button onClick={onOpenEncyclopedia} type="button">
          <BookOpen size={16} />
          藏品百科
        </button>
      </header>
      <div className="warehouse-grid">
        {slots.map((slot) => {
          const revealed = slot.itemId ? revealedById.get(slot.itemId) : undefined;
          const shouldRenderSlot = Boolean(
            revealed
            || slot.visibleShape
            || slot.visibleRarity
            || slot.visibleCategory
            || slot.visibleValueRange
            || slot.visibleSizeCount
            || slot.markedBySkill
            || slot.itemName
            || slot.iconKey
          );
          if (!shouldRenderSlot) {
            return null;
          }
          const itemIcon = revealed ? itemIconForKey(revealed.item.iconKey) : slot.iconKey ? itemIconForKey(slot.iconKey) : undefined;
          const layoutW = revealed || slot.visibleShape ? Math.max(1, slot.w) : 1;
          const layoutH = revealed || slot.visibleShape ? Math.max(1, slot.h) : 1;
          const shapeKey = `${layoutW}x${layoutH}`;
          const slotLabel = revealed?.item.name
            ?? slot.itemName
            ?? slot.visibleCategory
            ?? (slot.visibleSizeCount ? `${slot.visibleSizeCount}格` : undefined);
          const revealStyle = revealed
            ? {
                '--reveal-duration': `${revealDurationForRarity(revealed.item.rarity)}ms`,
                '--reveal-delay': `${Math.min(revealed.index, 8) * 18}ms`
              } as React.CSSProperties
            : undefined;
          return (
            <button
              className={`warehouse-slot shape-${shapeKey} ${slot.visibleShape ? 'known' : 'unknown'} ${slot.visibleRarity ? `rarity-${slot.visibleRarity}` : ''} ${revealed ? `revealed rarity-${revealed.item.rarity}` : ''} ${slot.markedBySkill ? 'marked' : ''}`}
              key={slot.slotId}
              onClick={() => onInspectSlot?.(slot)}
              style={{
                gridColumn: `${Math.max(1, slot.x + 1)} / span ${layoutW}`,
                gridRow: `${Math.max(1, slot.y + 1)} / span ${layoutH}`,
                ...revealStyle
              }}
              title="查看掌眼候选"
              type="button"
            >
              {revealed && <span className="slot-spinner" />}
              <div className="slot-content">
                {itemIcon && <img src={itemIcon} alt="" loading="lazy" />}
                {slotLabel && <strong>{slotLabel}</strong>}
                {revealed ? (
                  <em>{revealed.item.value.toLocaleString()}</em>
                ) : slot.visibleValueRange && (
                  <em>{slot.visibleValueRange.min.toLocaleString()}-{slot.visibleValueRange.max.toLocaleString()}</em>
                )}
              </div>
              {slot.markedBySkill && <small>{slot.markReason ?? '掌眼标记'}</small>}
            </button>
          );
        })}
      </div>
      <div className="warehouse-estimate-bar">
        <span>当前预估最低价格：</span>
        <strong>{knownMinimumEstimate > 0 ? knownMinimumEstimate.toLocaleString() : '-'}</strong>
      </div>
    </section>
  );
}

type BattleRound = NonNullable<PlayerSnapshot['public']['currentRound']>;
type RevealedRoundItem = BattleRound['revealedItems'][number];

function estimateKnownWarehouseMinimum(
  slots: readonly WarehouseSlotView[],
  revealedById: Map<string, { item: RevealedRoundItem; index: number }>
): number {
  return slots.reduce((sum, slot) => {
    return sum + knownSlotLowerBound(slot, revealedById);
  }, 0);
}

function useWarehouseIntelNow(round: BattleRound): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, [round.id, round.phase]);
  return now;
}

function knownSlotLowerBound(
  slot: WarehouseSlotView,
  revealedById: Map<string, { item: RevealedRoundItem; index: number }>
): number {
  if (slot.itemId) {
    const revealed = revealedById.get(slot.itemId);
    if (revealed) {
      return revealed.item.value;
    }
  }
  if (slot.visibleValueRange) {
    return slot.visibleValueRange.min;
  }

  const exactName = slot.itemName?.trim();
  const exactIcon = slot.iconKey?.trim();
  if (exactName || exactIcon) {
    const exactCandidates = bidKingLiveIntelItems.filter((item) => {
      return (!exactName || item.name === exactName) && (!exactIcon || item.iconKey === exactIcon);
    });
    if (exactCandidates.length > 0) {
      return Math.min(...exactCandidates.map((item) => item.displayValue));
    }
  }

  const hasSourceEstimateAttributes = slot.visibleShape || Boolean(slot.visibleSizeCount) || Boolean(slot.visibleRarity);
  if (!hasSourceEstimateAttributes) {
    return 0;
  }

  const candidates = bidKingLiveIntelItems.filter((item) => {
    if (slot.visibleShape && (item.footprint.w !== Math.max(1, slot.w) || item.footprint.h !== Math.max(1, slot.h))) {
      return false;
    }
    if (slot.visibleSizeCount && item.footprint.w * item.footprint.h !== slot.visibleSizeCount) {
      return false;
    }
    if (slot.visibleRarity && item.rarity !== slot.visibleRarity) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    return 0;
  }
  return Math.min(...candidates.map((item) => item.displayValue));
}

export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function phaseName(phase: string): string {
  const names: Record<string, string> = {
    container: '看货',
    intel: '情报',
    auction: '竞价',
    reveal: '开箱',
    settlement: '结算',
    ended: '结束'
  };
  return names[phase] ?? phase;
}

function mapCandidateReel(round: NonNullable<PlayerSnapshot['public']['currentRound']>): PublicContainerInfo[] {
  const selected = round.container;
  const pool = (round.openingCandidates && round.openingCandidates.length > 0 ? round.openingCandidates : [selected])
    .filter((candidate) => candidate.id !== selected.id);
  const reel = pool.slice(0, 7);
  while (reel.length < 7) {
    reel.push(pool[reel.length % Math.max(1, pool.length)] ?? selected);
  }
  return [...reel, selected];
}

function intelligenceChoiceReel(
  round: NonNullable<PlayerSnapshot['public']['currentRound']>,
  selected?: Clue
): Clue[] {
  const choices = round.intelligenceChoices && round.intelligenceChoices.length > 0
    ? round.intelligenceChoices
    : selected
      ? [selected]
      : [];
  if (!selected || choices.some((choice) => choice.id === selected.id)) {
    return choices.slice(0, 4);
  }
  return [...choices.slice(0, 3), selected];
}

function clueKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    value: '估值',
    risk: '风险',
    category: '品类',
    set: '套组',
    opponent: '对手'
  };
  return labels[kind] ?? '情报';
}

function riskName(risk: PublicContainerInfo['risk']): string {
  const names: Record<PublicContainerInfo['risk'], string> = {
    low: '稳仓',
    medium: '变仓',
    high: '险仓'
  };
  return names[risk];
}

export function roundPhaseName(round: NonNullable<PlayerSnapshot['public']['currentRound']>): string {
  if (round.settlement?.isFinal === false) {
    return '反馈';
  }
  return phaseName(round.phase);
}

export function auctionModeName(mode: string): string {
  const names: Record<string, string> = {
    open: '明拍',
    sealed: '暗拍'
  };
  return names[mode] ?? mode;
}

export function auctionRuleText(mode: string): string {
  const rules: Record<string, string> = {
    open: '明拍：本轮只显示谁已出价，轮后公开上一轮金额；按最高价与第二名比例判断是否成交。',
    sealed: '暗拍：过程只显示提交与排名，拍成后进入价格与藏品结算。'
  };
  return rules[mode] ?? '特殊拍卖规则。';
}

function bidRuleNotice(round: NonNullable<PlayerSnapshot['public']['currentRound']>): string {
  const marginPercent = closeRuleMarginPercent(round.index);
  if (round.auctionMode === 'open') {
    return marginPercent > 0
      ? `本轮不会公开当前价；轮后最高价需高出第二名 ${marginPercent}% 才会直接成交。`
      : '本轮不会公开当前价；轮后最高价高于第二名即可成交，同价追加回合。';
  }
  return marginPercent > 0
    ? `暗拍只公开排名，最高价需高出第二名 ${marginPercent}% 才会直接成交。`
    : '暗拍只公开排名，最高价高于第二名即可成交；同价追加回合。';
}

export function lastSubmittedBidAmount(snapshot: PlayerSnapshot, playerId: string): number | undefined {
  const currentBid = snapshot.public.currentRound?.bids
    .filter((bid) => bid.playerId === playerId && bid.amount > 0)
    .at(-1)?.amount;
  if (currentBid) {
    return currentBid;
  }
  for (let index = snapshot.public.roundHistory.length - 1; index >= 0; index -= 1) {
    const bid = snapshot.public.roundHistory[index]?.bids
      .filter((entry) => entry.playerId === playerId && entry.amount > 0)
      .at(-1);
    if (bid) {
      return bid.amount;
    }
  }
  return undefined;
}

function closeRuleMarginPercent(roundIndex: number): number {
  return [100, 60, 30, 10, 0][Math.min(roundIndex, 4)] ?? 0;
}

export function playerNameById(players: PublicPlayer[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? '未知玩家';
}

function skillBadgeText(skillName: string): string {
  return Array.from(skillName.replace(/[·\s]/g, '')).slice(0, 2).join('');
}

function roundActionTitle(entry?: NonNullable<PublicPlayer['bidRanks']>[number]): string {
  if (!entry) {
    return '未出价';
  }
  const parts = [`第${entry.round}轮`];
  if (entry.rank) {
    parts.push(`排名 #${entry.rank}`);
  }
  if (entry.visibleAmount && entry.amount !== undefined) {
    parts.push(`出价 ${entry.amount.toLocaleString()}`);
  } else if (entry.submitted) {
    parts.push('已提交');
  }
  if (entry.usedSkillName) {
    parts.push(`掌眼 ${entry.usedSkillName}`);
  }
  return parts.join(' · ');
}

function emoteTitle(player: PublicPlayer): string | undefined {
  const parts = [
    player.emoteSoundId ? `声闻 ${player.emoteSoundId}` : '',
    player.emoteAnimationKey ?? '',
    player.emoteEffectKey ?? '',
    player.emoteEffectViewIds?.length ? `特效 ${player.emoteEffectViewIds.join('/')}` : ''
  ].filter((entry) => entry.length > 0);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function skillSourceName(source: string): string {
  const names: Record<string, string> = {
    map: '场地',
    hero: '名士',
    item: '试宝令',
    manual: '过程',
    auto: '自动'
  };
  return names[source] ?? '掌眼';
}

function trimText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function revealDurationForRarity(rarity: Rarity): number {
  return sourceFinalRevealDelayMs(rarity);
}
