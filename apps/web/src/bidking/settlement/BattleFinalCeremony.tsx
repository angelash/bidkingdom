import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Archive, BadgeDollarSign, Crown, Gem, Medal, Sparkles, Trophy, Users } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import type {
  PlayerSnapshot,
  PublicPlayer,
  RevealedItem,
  RoundParticipantSettlement,
  RoundSettlement,
  WarehouseSlotView
} from '@bitkingdom/shared';
import { containerArtForKey, itemIconForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;
type BidRankEntry = NonNullable<PublicPlayer['bidRanks']>[number];

interface BattleFinalCeremonyProps {
  round: CurrentRound;
  selfPlayerId?: string;
  snapshot: PlayerSnapshot;
}

interface ParticipantRow {
  bid?: BidRankEntry;
  player: PublicPlayer;
  settlement?: RoundParticipantSettlement;
}

export function BattleFinalCeremony({
  round,
  selfPlayerId,
  snapshot
}: BattleFinalCeremonyProps): JSX.Element {
  const settlement = round.settlement;
  const [previewVisible, setPreviewVisible] = useState(true);

  useEffect(() => {
    setPreviewVisible(true);
    const timer = window.setTimeout(() => setPreviewVisible(false), 2800);
    return () => window.clearTimeout(timer);
  }, [round.id, settlement?.winnerId]);

  const players = snapshot.public.players;
  const participantRows = useMemo(
    () => settlement && settlement.isFinal !== false ? buildParticipantRows(players, settlement, round.index) : [],
    [players, settlement, round.index]
  );
  const revealedById = useMemo(() => new Map(
    round.revealedItems.map((item, index) => [item.id, { item, index }])
  ), [round.revealedItems]);

  if (!settlement || settlement.isFinal === false) {
    return <></>;
  }

  const winner = players.find((player) => player.id === settlement.winnerId);
  const winnerRole = gameConfig.roles.find((role) => role.id === winner?.roleId);
  const winnerName = winner?.name ?? '流拍';
  const winnerPortrait = rolePortraitForRoleId(winnerRole?.id);
  const winnerAvatar = roleAvatarForRoleId(winnerRole?.id);
  const selfWon = Boolean(selfPlayerId && settlement.winnerId === selfPlayerId);
  const totalSlots = Math.max(round.warehouseSlots?.length ?? 0, round.revealedItems.length);
  const revealedValue = round.revealedItems.reduce((sum, item) => sum + item.value, 0);
  const allRevealed = totalSlots > 0 && round.revealedItems.length >= totalSlots;
  const progressiveProfit = allRevealed || round.phase === 'settlement'
    ? settlement.profit
    : revealedValue
      - settlement.payment
      + (settlement.lossRebateRefund ?? 0);
  const latestItem = round.revealedItems.at(-1);
  const progress = totalSlots > 0 ? Math.min(100, Math.round((round.revealedItems.length / totalSlots) * 100)) : 0;
  const stageStyle = {
    '--ceremony-room-art': `url(${containerArtForKey(round.container.artKey)})`
  } as CSSProperties;

  return (
    <section className={`battle-final-ceremony ${selfWon ? 'self-win' : 'self-lose'} phase-${round.phase}`} style={stageStyle}>
      <div className="battle-final-topline">
        <div>
          <span>对局结束</span>
          <strong>{round.container.name}</strong>
        </div>
        <em>{round.container.source} · 第 {round.index + 1}/{snapshot.public.totalRounds} 轮 · {round.phase === 'reveal' ? '藏品揭露' : '结算入账'}</em>
      </div>

      <div className="battle-final-scene">
        <aside className="battle-final-hero-panel">
          <div className="battle-final-result-title">
            <span>{selfWon ? '竞买成功' : settlement.winnerId ? '竞拍落定' : '无人得标'}</span>
            <h1>{selfWon ? '得标' : settlement.winnerId ? '结算' : '流拍'}</h1>
          </div>

          <div className="battle-final-winner">
            <div className="battle-final-winner-portrait">
              {winnerPortrait
                ? <img src={winnerPortrait} alt="" />
                : winnerAvatar
                  ? <img src={winnerAvatar} alt="" />
                  : <Crown size={72} />}
            </div>
            <div>
              <span>最终得主</span>
              <strong>{winnerName}</strong>
              <em>{winnerRole?.name ?? winner?.roleId ?? '未成交'}</em>
            </div>
          </div>

          <div className="battle-final-kpis">
            <FinalKpi icon={<BadgeDollarSign size={18} />} label="成交价" value={formatCurrency(settlement.payment)} />
            <FinalKpi icon={<Gem size={18} />} label="已揭估值" value={formatCurrency(revealedValue)} />
            <FinalKpi
              className={progressiveProfit >= 0 ? 'profit' : 'loss'}
              icon={<Trophy size={18} />}
              label="当前盈亏"
              value={formatSignedCurrency(progressiveProfit)}
            />
          </div>

          <div className="battle-final-player-list">
            <header>
              <Users size={16} />
              <span>竞买排行</span>
            </header>
            {participantRows.map((row, index) => (
              <div
                className={`battle-final-player-row ${row.player.id === selfPlayerId ? 'self' : ''} ${row.player.id === settlement.winnerId ? 'winner' : ''}`}
                key={row.player.id}
              >
                <strong>#{row.bid?.rank ?? index + 1}</strong>
                <span>{row.player.name}</span>
                <em>{row.bid?.amount !== undefined ? formatCurrency(row.bid.amount) : '未公开'}</em>
              </div>
            ))}
          </div>
        </aside>

        <main className="battle-final-reveal-panel">
          <header className="battle-final-reveal-header">
            <div>
              <Archive size={20} />
              <span>最终藏品揭露</span>
              <strong>{round.revealedItems.length}/{Math.max(totalSlots, round.revealedItems.length)} 件</strong>
            </div>
            <div className="battle-final-progress" aria-label={`揭露进度 ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </header>

          {latestItem && (
            <div className={`battle-final-latest rarity-${latestItem.rarity}`}>
              <Sparkles size={18} />
              <span>刚揭露</span>
              <strong>{latestItem.name}</strong>
              <em>{formatCurrency(latestItem.value)}</em>
            </div>
          )}

          <div className="ceremony-warehouse-grid">
            {(round.warehouseSlots ?? []).map((slot, index) => (
              <CeremonyWarehouseSlot
                index={index}
                key={slot.slotId}
                revealed={slot.itemId ? revealedById.get(slot.itemId) : undefined}
                slot={slot}
              />
            ))}
          </div>

          <footer className="battle-final-continue-hint">
            <span>{allRevealed ? '藏品已全部揭露，正在完成收益与奖励入账' : '藏品逐件揭露中，估值和盈亏会随揭露更新'}</span>
            <strong>点击这里继续</strong>
          </footer>
        </main>

        <aside className="battle-final-detail-panel">
          <section className="battle-final-round-strip">
            <header>
              <Medal size={16} />
              <span>五轮出价与掌眼</span>
            </header>
            <div>
              {Array.from({ length: Math.max(5, snapshot.public.totalRounds) }, (_, index) => {
                const roundNumber = index + 1;
                const bid = winner?.bidRanks?.find((entry) => entry.round === roundNumber);
                return (
                  <div className={`battle-final-round-cell ${bid?.rank ? 'ranked' : ''} ${bid?.usedSkillName ? 'skilled' : ''}`} key={`final_round_${roundNumber}`}>
                    <strong>{roundNumber}</strong>
                    <span>{bid?.amount !== undefined ? formatCompactCurrency(bid.amount) : '未出价'}</span>
                    <em>{bid?.usedSkillName ? skillBadgeText(bid.usedSkillName) : bid?.rank ? `#${bid.rank}` : '-'}</em>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="battle-final-ledger-panel">
            <header>
              <ClipboardTitle />
              <span>结算明细</span>
            </header>
            <LedgerLine label="成交" value={formatCurrency(settlement.payment)} />
            <LedgerLine label="真值" value={formatCurrency(settlement.trueValue)} />
            <LedgerLine label="返利" value={formatCurrency(settlement.lossRebateRefund ?? 0)} tone="profit" />
            <LedgerLine label="套装" value={formatCurrency(settlement.setBonus)} tone={settlement.setBonus > 0 ? 'profit' : undefined} />
            <LedgerLine label="总盈亏" value={formatSignedCurrency(settlement.profit)} tone={settlement.profit >= 0 ? 'profit' : 'loss'} strong />
          </section>

          <section className="battle-final-clue-panel">
            <header>
              <Sparkles size={16} />
              <span>线索复盘</span>
            </header>
            {settlement.clueReview.length === 0 ? (
              <p>本仓没有可展示的线索复盘。</p>
            ) : settlement.clueReview.slice(0, 4).map((review) => (
              <p className={`verdict-${review.verdict}`} key={review.clueId}>
                <strong>{review.result}</strong>
                <span>{review.text}</span>
              </p>
            ))}
          </section>
        </aside>
      </div>

      {previewVisible && (
        <BattleEndPreviewOverlay
          participantRows={participantRows}
          revealedItems={round.revealedItems}
          selfWon={selfWon}
          settlement={settlement}
          slots={round.warehouseSlots ?? []}
          winner={winner}
          winnerAvatar={winnerAvatar}
          winnerName={winnerName}
          winnerPortrait={winnerPortrait}
          winnerRoleName={winnerRole?.name ?? winner?.roleId}
          onSkip={() => setPreviewVisible(false)}
        />
      )}
    </section>
  );
}

function CeremonyWarehouseSlot({
  index,
  revealed,
  slot
}: {
  index: number;
  revealed?: { item: RevealedItem; index: number };
  slot: WarehouseSlotView;
}): JSX.Element {
  const item = revealed?.item;
  const itemIcon = item ? itemIconForKey(item.iconKey) : itemIconForKey(slot.iconKey);
  const shapeKey = `${Math.max(1, slot.w)}x${Math.max(1, slot.h)}`;
  const opened = Boolean(item || slot.itemName);
  const rarity = item?.rarity ?? slot.visibleRarity;
  const delay = item ? Math.min(revealed.index, 16) * 42 : index * 8;

  return (
    <div
      className={`ceremony-warehouse-slot shape-${shapeKey} ${opened ? 'revealed' : 'pending'} ${rarity ? `rarity-${rarity}` : ''}`}
      style={{
        '--slot-delay': `${delay}ms`,
        gridColumn: `span ${Math.max(1, slot.w)}`,
        gridRow: `span ${Math.max(1, slot.h)}`
      } as CSSProperties}
    >
      {opened && <span className="ceremony-slot-sheen" />}
      <div>
        {itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <span className="slot-shape" />}
        <strong>{item?.name ?? slot.itemName ?? slot.visibleCategory ?? '待揭露'}</strong>
        {item ? (
          <em>{formatCurrency(item.value)}</em>
        ) : slot.visibleValueRange ? (
          <em>{slot.visibleValueRange.min.toLocaleString()}-{slot.visibleValueRange.max.toLocaleString()}</em>
        ) : (
          <em>?</em>
        )}
      </div>
    </div>
  );
}

function BattleEndPreviewOverlay({
  participantRows,
  revealedItems,
  selfWon,
  settlement,
  slots,
  winner,
  winnerAvatar,
  winnerName,
  winnerPortrait,
  winnerRoleName,
  onSkip
}: {
  participantRows: ParticipantRow[];
  revealedItems: RevealedItem[];
  selfWon: boolean;
  settlement: RoundSettlement;
  slots: WarehouseSlotView[];
  winner?: PublicPlayer;
  winnerAvatar?: string;
  winnerName: string;
  winnerPortrait?: string;
  winnerRoleName?: string;
  onSkip: () => void;
}): JSX.Element {
  const previewItems = revealedItems.length > 0
    ? revealedItems.slice(0, 6)
    : slots.slice(0, 6).map(() => undefined);

  return (
    <section className={`battle-end-preview-overlay ${selfWon ? 'self-win' : 'self-lose'}`}>
      <div className="battle-end-preview-panel">
        <div className="battle-end-preview-title">
          <span>对局结束</span>
          <h2>{selfWon ? '竞拍成功' : settlement.winnerId ? '胜负已定' : '本仓流拍'}</h2>
          <p>{settlement.winnerId ? `${winnerName} 拍得整仓` : '无人达到成交条件'}</p>
        </div>

        <div className="battle-end-preview-body">
          <div className="battle-end-preview-portrait">
            {winnerPortrait
              ? <img src={winnerPortrait} alt="" />
              : winnerAvatar
                ? <img src={winnerAvatar} alt="" />
                : <Crown size={82} />}
          </div>
          <div className="battle-end-preview-winner">
            <span>最终得主</span>
            <strong>{winner?.name ?? winnerName}</strong>
            <em>{winnerRoleName ?? '未成交'}</em>
          </div>
          <div className="battle-end-preview-items">
            {previewItems.map((item, index) => {
              const icon = item ? itemIconForKey(item.iconKey) : undefined;
              return (
                <span className={item ? `rarity-${item.rarity}` : 'pending'} key={item?.id ?? `pending_item_${index}`}>
                  {icon ? <img src={icon} alt="" /> : <Archive size={20} />}
                </span>
              );
            })}
          </div>
        </div>

        <div className="battle-end-preview-bids">
          {participantRows.slice(0, 4).map((row) => (
            <span className={row.player.id === settlement.winnerId ? 'winner' : ''} key={row.player.id}>
              <strong>{row.player.name}</strong>
              <em>{row.bid?.amount !== undefined ? formatCurrency(row.bid.amount) : '未公开'}</em>
            </span>
          ))}
        </div>

        <button className="battle-end-preview-skip" type="button" onClick={onSkip}>
          点击这里继续
        </button>
      </div>
    </section>
  );
}

function FinalKpi({
  className,
  icon,
  label,
  value
}: {
  className?: string;
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className={`battle-final-kpi ${className ?? ''}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LedgerLine({
  label,
  strong = false,
  tone,
  value
}: {
  label: string;
  strong?: boolean;
  tone?: 'profit' | 'loss';
  value: string;
}): JSX.Element {
  return (
    <div className={`battle-final-ledger-line ${tone ?? ''} ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ClipboardTitle(): JSX.Element {
  return (
    <span className="battle-final-ledger-icon">
      <Archive size={12} />
    </span>
  );
}

function buildParticipantRows(
  players: PublicPlayer[],
  settlement: RoundSettlement,
  roundIndex: number
): ParticipantRow[] {
  const settlements = new Map(settlement.participants.map((entry) => [entry.playerId, entry]));
  return players
    .map((player) => ({
      bid: player.bidRanks?.find((entry) => entry.round === roundIndex + 1),
      player,
      settlement: settlements.get(player.id)
    }))
    .sort((left, right) => {
      if (left.player.id === settlement.winnerId) {
        return -1;
      }
      if (right.player.id === settlement.winnerId) {
        return 1;
      }
      return (left.bid?.rank ?? 99) - (right.bid?.rank ?? 99) || right.player.netWorth - left.player.netWorth;
    });
}

function formatCurrency(value: number): string {
  return value.toLocaleString();
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}`;
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
