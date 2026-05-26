import { useMemo, type CSSProperties } from 'react';
import { Archive, BadgeDollarSign, Crown, Gem, Sparkles, Trophy } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import type {
  PlayerSnapshot,
  RevealedItem,
  WarehouseSlotView
} from '@bitkingdom/shared';
import { containerArtForKey, itemIconForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

interface BattleFinalCeremonyProps {
  round: CurrentRound;
  selfPlayerId?: string;
  snapshot: PlayerSnapshot;
}

export function BattleFinalCeremony({
  round,
  selfPlayerId,
  snapshot
}: BattleFinalCeremonyProps): JSX.Element {
  const settlement = round.settlement;

  const players = snapshot.public.players;
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

      </div>

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
  const itemIcon = item ? itemIconForKey(item.iconKey) : undefined;
  const shapeKey = `${Math.max(1, slot.w)}x${Math.max(1, slot.h)}`;
  const opened = Boolean(item);
  const rarity = item?.rarity;
  const delay = item ? Math.min(revealed.index, 16) * 42 : index * 8;

  return (
    <div
      className={`ceremony-warehouse-slot shape-${shapeKey} ${opened ? 'revealed' : 'pending'} ${rarity ? `rarity-${rarity}` : ''}`}
      style={{
        '--slot-delay': `${delay}ms`,
        gridColumn: `${Math.max(1, slot.x + 1)} / span ${Math.max(1, slot.w)}`,
        gridRow: `${Math.max(1, slot.y + 1)} / span ${Math.max(1, slot.h)}`
      } as CSSProperties}
    >
      {opened && <span className="ceremony-slot-sheen" />}
      <div>
        {item ? (
          <>
            {itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <span className="slot-shape" />}
            <strong>{item.name}</strong>
            <em>{formatCurrency(item.value)}</em>
          </>
        ) : (
          <span className="ceremony-slot-silhouette" />
        )}
      </div>
    </div>
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

function formatCurrency(value: number): string {
  return value.toLocaleString();
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}`;
}
