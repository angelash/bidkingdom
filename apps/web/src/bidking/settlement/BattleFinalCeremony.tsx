import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Archive, BadgeDollarSign, Crown, Gem, Sparkles, Trophy } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import { sourceFinalRevealDelayMs } from '@bitkingdom/shared';
import type {
  PlayerSnapshot,
  RevealedItem,
  WarehouseSlotView
} from '@bitkingdom/shared';
import { containerArtForKey, itemIconForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;
type RevealPresentationState = 'loading' | 'revealed';
type RevealedItemPresentation = { item: RevealedItem; index: number; state: RevealPresentationState };

interface BattleFinalCeremonyProps {
  round: CurrentRound;
  selfPlayerId?: string;
  snapshot: PlayerSnapshot;
  onContinue: () => void;
}

export function BattleFinalCeremony({
  onContinue,
  round,
  selfPlayerId,
  snapshot
}: BattleFinalCeremonyProps): JSX.Element {
  const settlement = round.settlement;
  const [presentedRevealIds, setPresentedRevealIds] = useState<Set<string>>(() => new Set());
  const revealTimersRef = useRef(new Map<string, number>());

  const players = snapshot.public.players;
  const revealedById = useMemo(() => new Map(
    round.revealedItems.map((item, index) => [
      item.id,
      {
        item,
        index,
        state: presentedRevealIds.has(item.id) ? 'revealed' : 'loading'
      } satisfies RevealedItemPresentation
    ])
  ), [presentedRevealIds, round.revealedItems]);
  const slotRevealOrder = useMemo(() => new Map(
    [...(round.warehouseSlots ?? [])]
      .sort((left, right) => left.y - right.y || left.x - right.x || left.slotId.localeCompare(right.slotId))
      .map((slot, index) => [slot.slotId, index])
  ), [round.warehouseSlots]);
  const presentedItems = useMemo(
    () => round.revealedItems.filter((item) => presentedRevealIds.has(item.id)),
    [presentedRevealIds, round.revealedItems]
  );

  useEffect(() => {
    const currentIds = new Set(round.revealedItems.map((item) => item.id));

    setPresentedRevealIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of previous) {
        if (currentIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed || next.size !== previous.size ? next : previous;
    });

    for (const [id, timer] of revealTimersRef.current) {
      if (!currentIds.has(id)) {
        window.clearTimeout(timer);
        revealTimersRef.current.delete(id);
      }
    }

    for (const item of round.revealedItems) {
      if (presentedRevealIds.has(item.id) || revealTimersRef.current.has(item.id)) {
        continue;
      }
      const timer = window.setTimeout(() => {
        revealTimersRef.current.delete(item.id);
        setPresentedRevealIds((previous) => {
          if (previous.has(item.id)) {
            return previous;
          }
          const next = new Set(previous);
          next.add(item.id);
          return next;
        });
      }, sourceFinalRevealDelayMs(item.rarity));
      revealTimersRef.current.set(item.id, timer);
    }
  }, [presentedRevealIds, round.revealedItems]);

  useEffect(() => () => {
    for (const timer of revealTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    revealTimersRef.current.clear();
  }, []);

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
  const revealedValue = presentedItems.reduce((sum, item) => sum + item.value, 0);
  const allRevealed = totalSlots > 0 && presentedItems.length >= totalSlots;
  const matchEnded = snapshot.public.status === 'ended';
  const canContinue = matchEnded && allRevealed;
  const progressiveProfit = allRevealed || round.phase === 'settlement'
    ? settlement.profit
    : revealedValue
      - settlement.payment
      + (settlement.lossRebateRefund ?? 0);
  const latestItem = presentedItems.at(-1);
  const progress = totalSlots > 0 ? Math.min(100, Math.round((presentedItems.length / totalSlots) * 100)) : 0;
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
              <strong>{presentedItems.length}/{Math.max(totalSlots, round.revealedItems.length)} 件</strong>
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
                revealOrder={slotRevealOrder.get(slot.slotId) ?? index}
                slot={slot}
              />
            ))}
          </div>

          <footer className="battle-final-continue-hint">
            <span>{canContinue ? '收益与奖励已入账' : allRevealed ? '藏品已全部揭露，正在完成收益与奖励入账' : '藏品逐件揭露中，估值和盈亏会随揭露更新'}</span>
            {canContinue ? (
              <button className="battle-final-continue-button" type="button" onClick={onContinue}>继续</button>
            ) : (
              <em>{allRevealed ? '结算中' : '揭露中'}</em>
            )}
          </footer>
        </main>

      </div>

    </section>
  );
}

function CeremonyWarehouseSlot({
  index,
  revealed,
  revealOrder,
  slot
}: {
  index: number;
  revealed?: RevealedItemPresentation;
  revealOrder: number;
  slot: WarehouseSlotView;
}): JSX.Element {
  const item = revealed?.state === 'revealed' ? revealed.item : undefined;
  const loadingItem = revealed?.state === 'loading' ? revealed.item : undefined;
  const itemIcon = item ? itemIconForKey(item.iconKey) : undefined;
  const shapeKey = `${Math.max(1, slot.w)}x${Math.max(1, slot.h)}`;
  const opened = Boolean(item);
  const rarity = item?.rarity;
  const delay = item ? 0 : Math.min(revealOrder, 16) * 8 + index * 2;
  const stateClass = opened ? 'revealed' : loadingItem ? 'loading' : 'pending';
  const loadingStyle = loadingItem
    ? { '--loading-total-duration': `${sourceFinalRevealDelayMs(loadingItem.rarity)}ms` } as CSSProperties
    : undefined;

  return (
    <div
      className={`ceremony-warehouse-slot shape-${shapeKey} ${stateClass} ${rarity ? `rarity-${rarity}` : ''}`}
      style={{
        '--slot-delay': `${delay}ms`,
        gridColumn: `${Math.max(1, slot.x + 1)} / span ${Math.max(1, slot.w)}`,
        gridRow: `${Math.max(1, slot.y + 1)} / span ${Math.max(1, slot.h)}`
      } as CSSProperties}
    >
      {opened && <span className="ceremony-slot-sheen" />}
      {loadingItem && (
        <span className="ceremony-slot-loading" style={loadingStyle}>
          <span />
        </span>
      )}
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
