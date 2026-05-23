import React, { useEffect, useState } from 'react';
import { Archive, Eye, History, Info, Lock, Sparkles } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import type {
  PlayerSnapshot,
  PublicPlayer,
  Rarity,
  SkillFeedEntry,
  WarehouseSlotView
} from '@bitkingdom/shared';
import { containerArtForKey, itemIconForKey, roleAvatarForRoleId } from '../../artAssets';

export function CloseRuleLadder({ currentRound }: { currentRound: number }): JSX.Element {
  const rules = [
    '第1轮 超过第二名200%',
    '第2轮 超过第二名160%',
    '第3轮 超过第二名130%',
    '第4轮 超过第二名110%',
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

export function MapIntroOverlay({ round }: { round: NonNullable<PlayerSnapshot['public']['currentRound']> }): JSX.Element {
  const fallbackChoices = gameConfig.containers.slice(0, 8).map((container) => ({
    id: `${container.id}_fallback`,
    templateId: container.id,
    name: container.name,
    source: container.source,
    tags: [...container.tags],
    risk: container.risk,
    estimateMin: round.container.estimateMin,
    estimateMax: round.container.estimateMax,
    artKey: container.artKey
  }));
  const containerChoices = round.openingCandidates?.length ? round.openingCandidates : fallbackChoices;
  const selectedIndex = Math.max(0, containerChoices.findIndex((container) => (
    container.id === round.container.id || container.templateId === round.container.templateId || container.artKey === round.container.artKey
  )));
  const loopCount = 4;
  const stopIndex = containerChoices.length * 2 + selectedIndex;
  const cardWidth = 184;
  const cardGap = 22;
  const cardStep = cardWidth + cardGap;
  const trackStyle = {
    '--card-width': `${cardWidth}px`,
    '--card-gap': `${cardGap}px`,
    '--start-shift': `${cardStep * 2.9}px`,
    '--final-shift': `${-stopIndex * cardStep}px`
  } as React.CSSProperties;
  const rollingContainers = Array.from({ length: loopCount }, (_, loopIndex) => (
    containerChoices.map((container, index) => ({
      container,
      rollIndex: loopIndex * containerChoices.length + index
    }))
  )).flat();
  return (
    <section className="map-intro-overlay">
      <div className="map-intro-title">{round.phase === 'warehouse_selected' ? '藏宝仓已选中' : '随机藏宝仓抽选中...'}</div>
      <div className="map-carousel-window">
        <div className="map-selection-frame">
          <strong>选中</strong>
        </div>
        <div className="map-track" style={trackStyle}>
          {rollingContainers.map(({ container, rollIndex }) => {
            const selected = rollIndex === stopIndex;
            return (
              <div className={`map-card ${selected ? 'selected' : ''}`} key={`${container.id}_${rollIndex}`}>
                <img src={containerArtForKey(container.artKey)} alt="" />
                <span>{selected ? round.container.name : container.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="map-result">
        <span>当前随机到的仓</span>
        <strong>{round.container.name}</strong>
        <p>{round.container.source} · {round.container.tags.join(' / ')}</p>
        <em>{round.container.estimateMin.toLocaleString()} - {round.container.estimateMax.toLocaleString()}</em>
      </div>
    </section>
  );
}

export function AuctioneerRevealOverlay({ round }: { round: NonNullable<PlayerSnapshot['public']['currentRound']> }): JSX.Element {
  const clue = round.auctioneerClue;
  const choices = round.auctioneerChoices?.length ? round.auctioneerChoices : clue ? [clue] : [];
  const cardCount = Math.max(4, choices.length || 4);
  return (
    <section className="auctioneer-overlay">
      <div className="auctioneer-panel">
        <span>即将揭示情报</span>
        <h2>掌眼人情报</h2>
        <div className="auctioneer-card-row">
          {Array.from({ length: cardCount }, (_, index) => {
            const choice = choices[index];
            const selected = Boolean(choice && clue && choice.id === clue.id);
            return (
              <div className={`auctioneer-card ${selected ? 'selected' : ''}`} key={choice?.id ?? `auctioneer_card_${index}`}>
                <strong>{selected ? '选中' : `札${index + 1}`}</strong>
                <small>{choice ? trimText(choice.text.replace(/^候选情报：/, ''), 22) : '待抽取'}</small>
              </div>
            );
          })}
        </div>
        <div className="auctioneer-clue">
          <Info size={18} />
          <p>{clue?.text ?? '掌眼人正在整理本仓第一条公共情报。'}</p>
        </div>
      </div>
    </section>
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
        const currentAmount = currentRank?.visibleAmount && currentRank.amount !== undefined ? ` · ${formatCompactCurrency(currentRank.amount)}` : '';
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
                  const amountText = entry?.visibleAmount && entry.amount !== undefined ? formatCompactCurrency(entry.amount) : undefined;
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

export function BidComposerModal({
  amount,
  amountHidden,
  availableCash,
  canConfirm,
  error,
  previousBid,
  recommendedBid,
  round,
  onPress,
  onBackspace,
  onClear,
  onDouble,
  onUseMax,
  onUseMinimum,
  onUseRecommended,
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
  recommendedBid?: number;
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
  onPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDouble: () => void;
  onUseMax: () => void;
  onUseMinimum: () => void;
  onUseRecommended: () => void;
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
          <button disabled={recommendedBid === undefined} onClick={onUseRecommended}>推荐</button>
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
          <strong>{amountHidden ? '••••••' : Number(amount || 0).toLocaleString()}</strong>
          <small>
            现金 {formatCompactCurrency(availableCash)}
            {recommendedBid !== undefined ? ` · 推荐 ${formatCompactCurrency(recommendedBid)}` : ''}
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
  const isOpenLike = round.auctionMode === 'open' || round.auctionMode === 'deposit_open';
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
  const visibleFeed = feed.slice(-7);
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
        <em>{actorName}</em>
      </div>
      <p>{trimText(entry.text, 86)}</p>
    </div>
  );
}

export function WarehouseGrid({
  round,
  onInspectSlot
}: {
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
  onInspectSlot?: (slot: WarehouseSlotView) => void;
}): JSX.Element {
  const slots = round.warehouseSlots ?? [];
  const revealedById = new Map(round.revealedItems.map((item, index) => [item.id, { item, index }]));
  if (slots.length === 0) {
    return <></>;
  }
  return (
    <section className="warehouse-board">
      <div className="section-title small">
        <Archive size={16} />
        <h3>仓内珍物</h3>
      </div>
      <div className="warehouse-grid">
        {slots.map((slot) => {
          const revealed = slot.itemId ? revealedById.get(slot.itemId) : undefined;
          const itemIcon = revealed ? itemIconForKey(revealed.item.iconKey) : slot.iconKey ? itemIconForKey(slot.iconKey) : undefined;
          const shapeKey = `${Math.max(1, slot.w)}x${Math.max(1, slot.h)}`;
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
                gridColumn: `span ${Math.max(1, slot.w)}`,
                gridRow: `span ${Math.max(1, slot.h)}`,
                ...revealStyle
              }}
              title="查看掌眼候选"
              type="button"
            >
              {revealed && <span className="slot-spinner" />}
              <div className="slot-content">
                {itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <span className="slot-shape" />}
                <strong>{revealed?.item.name ?? slot.itemName ?? slot.visibleCategory ?? (slot.visibleRarity ? rarityName(slot.visibleRarity) : slot.visibleSizeCount ? `${slot.visibleSizeCount}格` : '未知')}</strong>
                {revealed ? (
                  <em>{revealed.item.value.toLocaleString()}</em>
                ) : slot.visibleValueRange && (
                  <em>{slot.visibleValueRange.min.toLocaleString()}-{slot.visibleValueRange.max.toLocaleString()}</em>
                )}
              </div>
              {slot.markedBySkill && <small>{slot.markReason ?? '掌眼标记'}</small>}
              <span className="slot-intel-hint">情报</span>
            </button>
          );
        })}
      </div>
    </section>
  );
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
    warehouse_roll: '随机仓',
    warehouse_selected: '仓型确认',
    auctioneer_reveal: '掌眼情报',
    intel: '情报',
    auction: '竞价',
    reveal: '开箱',
    settlement: '结算',
    ended: '结束'
  };
  return names[phase] ?? phase;
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
    sealed: '暗拍',
    second_price: '次高价',
    deposit_open: '押金明拍',
    flash: '闪拍'
  };
  return names[mode] ?? mode;
}

export function auctionRuleText(mode: string): string {
  const rules: Record<string, string> = {
    open: '明拍：本轮只显示谁已出价，轮后公开上一轮金额；按最高价与第二名比例判断是否成交。',
    sealed: '暗拍：过程只显示提交与排名，拍成后进入价格与藏品结算。',
    second_price: '最高出价者成交，但只支付第二高价 + 1,000。',
    deposit_open: '押金明拍：本轮只显示谁已出价，轮后公开金额；首次出价先付押金。',
    flash: '10秒暗拍，提交后不能修改，适合最后一轮翻盘。'
  };
  return rules[mode] ?? '特殊拍卖规则。';
}

function bidRuleNotice(round: NonNullable<PlayerSnapshot['public']['currentRound']>): string {
  const multiplier = closeRuleMultiplier(round.index);
  if (round.auctionMode === 'open' || round.auctionMode === 'deposit_open') {
    return multiplier > 0
      ? `本轮不会公开当前价；轮后最高价需超过第二名 ${multiplier}% 才会直接成交。`
      : '本轮不会公开当前价；轮后最高价高于第二名即可成交，同价追加回合。';
  }
  return multiplier > 0
    ? `暗拍只公开排名，最高价需超过第二名 ${multiplier}% 才会直接成交。`
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

function closeRuleMultiplier(roundIndex: number): number {
  return [200, 160, 130, 110, 0][Math.min(roundIndex, 4)] ?? 0;
}

export function playerNameById(players: PublicPlayer[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? '未知玩家';
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(abs >= 1_000_000_000 ? 1 : 2).replace(/\.0+$/, '')}亿`;
  }
  if (abs >= 10_000) {
    return `${(value / 10_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}万`;
  }
  return value.toLocaleString();
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

function rarityName(rarity: Rarity): string {
  const names: Record<Rarity, string> = {
    junk: '杂项',
    common: '普通',
    fine: '精品',
    rare: '稀有',
    legendary: '传说',
    fake: '特殊'
  };
  return names[rarity];
}

function revealDurationForRarity(rarity: Rarity): number {
  const durations: Record<Rarity, number> = {
    junk: 520,
    common: 620,
    fake: 720,
    fine: 920,
    rare: 1350,
    legendary: 1900
  };
  return durations[rarity];
}
