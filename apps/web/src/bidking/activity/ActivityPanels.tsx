import { useEffect, useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import {
  Activity as bidKingActivities,
  Dlc as bidKingDlcs,
  GiftPackage as bidKingGiftPackages,
  Pay as bidKingPays,
  PurchaseList as bidKingPurchaseList,
  RankReward as bidKingRankRewards,
  Sim as bidKingSims,
  bidKingDlcRuntime,
  bidKingPayRuntime,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { safeBidKingDisplayText } from '../system/bidKingSystemRuntime';
import { bidKingRewardRowsLabel, parseBidKingRewardRows } from '../system/rewardText';

interface RechargePanelViewProps {
  profile: PlayerProfile;
  onClaimGiftPackage: (packageId: string) => void;
}

interface PassPanelViewProps {
  profile: PlayerProfile;
  serverUrl: string;
  onClaimActivityReward: (activityId: string) => void;
  onApplySimPlan: (plan: SimPlanView) => void;
  onOpenActivityTarget?: (target: ActivityTargetView) => void;
}

export interface SimPlanView {
  id: string;
  bidRange: number[];
  base: number;
  itemId: string;
  botCount: number;
  roomBotCount: number;
  roundCount: number;
}

interface SimSnapshotView {
  plans: SimPlanView[];
}

export type ActivityTargetView = 'rank' | 'friend' | 'club' | 'pass';

interface ActivityProgressEntryView {
  activityId: string;
  name: string;
  description: string;
  type: number;
  sort: number;
  path: number;
  banner: string;
  panelName: string;
  pageIcon: string;
  rewardRows: number[][];
  hasReward: boolean;
  claimed: boolean;
  active: boolean;
  expired: boolean;
  claimable: boolean;
  redPoint: boolean;
  reason: string;
  progress: number;
  target: number;
  completed: boolean;
  progressLabel: string;
  actionTarget?: ActivityTargetView | 'claim';
  startedAt: number;
  durationSeconds?: number;
  expiresAt?: number;
  remainingMs?: number;
}

interface ActivityProgressSnapshotView {
  playerId: string;
  generatedAt: number;
  redPointCount: number;
  activities: ActivityProgressEntryView[];
}

export function RechargePanelView({
  profile,
  onClaimGiftPackage
}: RechargePanelViewProps): JSX.Element {
  const orders = profile.purchaseOrders ?? [];
  const unlocks = new Set(profile.dlcUnlocks ?? []);
  const claimedGiftPackages = new Set(profile.claimedGiftPackages ?? []);
  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>钱庄与礼包</strong>
        <span>{bidKingPays.length} 道钱契 · {bidKingGiftPackages.length} 份礼匣 · {bidKingPurchaseList.length} 张外部宝券</span>
      </header>
      {bidKingPays.map((pay) => (
        <PayPurchaseCard
          key={`pay_${pay.id}`}
          orders={orders}
          pay={pay}
        />
      ))}
      {bidKingGiftPackages.map((giftPackage) => {
        const claimed = claimedGiftPackages.has(giftPackage.id);
        const payId = rawColumn(giftPackage, 6);
        const paid = !payId || payOrderCompleted(orders, payId);
        return (
          <article className={claimed ? 'claimed' : ''} key={`gift_${giftPackage.id}`}>
            <strong>{bidKingRawTableDisplayName(giftPackage)}</strong>
            <p>{bidKingRawTableDisplayDesc(giftPackage)}</p>
            <em>{giftPackageRewardLabel(giftPackage)} · {giftPackagePayLabel(orders, payId)} · {claimed ? '已领' : '限领一回'}</em>
            <button disabled={claimed || !paid} type="button" onClick={() => onClaimGiftPackage(giftPackage.id)}>
              <Sparkles size={16} />
              {claimed ? '已领' : paid ? '领取礼匣' : '待钱庄到账'}
            </button>
          </article>
        );
      })}
      {[...bidKingPurchaseList, ...bidKingDlcs].map((row) => (
        row.table === 'Dlc' ? (
          <DlcPurchaseCard
            key={`${row.packaged_name}_${row.id}`}
            row={row}
            unlocked={unlocks.has(row.id)}
          />
        ) : (
          <article key={`${row.packaged_name}_${row.id}`}>
            <strong>{bidKingRawTableDisplayName(row)}</strong>
            <p>{bidKingRawTableDisplayDesc(row)}</p>
            <em>{purchaseListSkuLabel(row)} · {purchaseOrderSummary(orders, 'purchaseList', row.id)}</em>
            <div className="purchase-action-row">
              <button disabled={!rawColumn(row, 7)} type="button" onClick={() => openPurchaseUrl(row)}>
                外部契据
              </button>
            </div>
          </article>
        )
      ))}
    </div>
  );
}

function PayPurchaseCard({
  pay,
  orders
}: {
  pay: BidKingRawTableRow;
  orders: NonNullable<PlayerProfile['purchaseOrders']>;
}): JSX.Element {
  const runtime = bidKingPayRuntime(pay);
  return (
    <article>
      <strong>{bidKingRawTableDisplayName(pay)}</strong>
      <p>{bidKingRawTableDisplayDesc(pay)}</p>
      <em>
        {runtime.totalCoins.toLocaleString()} 铜钱
        {' '}({runtime.baseCoins.toLocaleString()}+{runtime.bonusCoins.toLocaleString()})
        {' '}· 钱庄价 {runtime.rmb} · 折银 {runtime.usd} · {commerceServiceLabel(runtime.serviceModeLabel)}
        {' '}· 票面 {runtime.iconKey ? '已绘' : '未绘'} · 契文 {runtime.steamDescriptionKey ? '已备' : '未备'}
        {' '}· {purchaseOrderSummary(orders, 'pay', runtime.payId)}
      </em>
    </article>
  );
}

function DlcPurchaseCard({
  row,
  unlocked
}: {
  row: BidKingRawTableRow;
  unlocked: boolean;
}): JSX.Element {
  const runtime = bidKingDlcRuntime(row);
  return (
    <article className={unlocked ? 'claimed' : ''}>
      <strong>{bidKingRawTableDisplayName(row)}</strong>
      <p>{bidKingRawTableDisplayDesc(row)}</p>
      <em>
        通牒 {runtime.platformSku} · {commerceServiceLabel(runtime.serviceModeLabel)} · 信札 {runtime.mailTemplateId ?? '无'} · {bidKingRewardRowsLabel(runtime.rewardRows)}
      </em>
    </article>
  );
}

export function PassPanelView({
  profile,
  serverUrl,
  onClaimActivityReward,
  onApplySimPlan,
  onOpenActivityTarget
}: PassPanelViewProps): JSX.Element {
  const [simSnapshot, setSimSnapshot] = useState<SimSnapshotView>();
  const [activitySnapshot, setActivitySnapshot] = useState<ActivityProgressSnapshotView>();

  useEffect(() => {
    let cancelled = false;
    fetch(`${serverUrl}/api/sim/snapshot`)
      .then((response) => response.json() as Promise<SimSnapshotView>)
      .then((payload) => {
        if (!cancelled) {
          setSimSnapshot(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [serverUrl]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ playerId: profile.playerId });
    fetch(`${serverUrl}/api/activity/progress?${params}`)
      .then((response) => response.json() as Promise<ActivityProgressSnapshotView>)
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.activities)) {
          setActivitySnapshot(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile.playerId, profile.updatedAt, serverUrl]);

  const activityRows = activitySnapshot?.activities ?? [];

  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>珍宝令与活动</strong>
        <span>
          {activityRows.length} 个活动 · 红点 {activitySnapshot?.redPointCount ?? activityRows.filter((activity) => activity.redPoint).length}
          {' '}· {bidKingRankRewards.length} 道榜赏 · {simSnapshot?.plans.length ?? bidKingSims.length} 套演武试局
        </span>
      </header>
      {activityRows.map((activity) => {
        return (
          <article className={activity.claimed ? 'claimed' : ''} key={activity.activityId}>
            <strong>
              {activityDisplayName(activity)}
              {activity.redPoint && <span className="activity-redpoint">可推进</span>}
            </strong>
            <p>{activityDisplayDesc(activity)}</p>
            <ActivityProgressBar activity={activity} />
            <em>
              {activity.progressLabel} · {activity.reason}{activityWindowLabel(activity)}
              {activity.panelName ? ` · ${activityPanelLabel(activity.panelName)}` : ''}
            </em>
            <div className="purchase-action-row">
              <button disabled={!activity.claimable} onClick={() => onClaimActivityReward(activity.activityId)} type="button">
                {activity.claimable ? '领取赏格' : activity.reason}
              </button>
              <button
                disabled={!isOpenableActivityTarget(activity.actionTarget) || !onOpenActivityTarget}
                onClick={() => {
                  if (isOpenableActivityTarget(activity.actionTarget)) {
                    onOpenActivityTarget?.(activity.actionTarget);
                  }
                }}
                type="button"
              >
                {activityTargetLabel(activity.actionTarget)}
              </button>
            </div>
          </article>
        );
      })}
      {(simSnapshot?.plans ?? []).slice(0, 8).map((sim) => (
        <article key={sim.id}>
          <strong>演武试局 {sim.id}</strong>
          <p>出价区间 {sim.bidRange.join('-') || '未配置'} · 基准 {sim.base}</p>
          <em>试宝令 {sim.itemId} · 随从 {sim.botCount} · 入场人数 {sim.roomBotCount} · 回合 {sim.roundCount}</em>
          <button onClick={() => onApplySimPlan(sim)} type="button">
            <Play size={16} />
            套用试局
          </button>
        </article>
      ))}
      {!simSnapshot && bidKingSims.slice(0, 8).map((sim) => (
        <article key={sim.id}>
          <strong>{bidKingRawTableDisplayName(sim)}</strong>
          <p>{bidKingRawTableDisplayDesc(sim)}</p>
          <em>演武编号 {sim.id}</em>
        </article>
      ))}
    </div>
  );
}

function ActivityProgressBar({ activity }: { activity: ActivityProgressEntryView }): JSX.Element {
  const percent = activity.target > 0 ? Math.max(0, Math.min(100, (activity.progress / activity.target) * 100)) : 0;
  return (
    <div className="activity-progress-meter" aria-label={`${activity.progress}/${activity.target}`}>
      <span style={{ width: `${percent}%` }} />
      <em>{activity.progress}/{activity.target}</em>
    </div>
  );
}

function giftPackageRewardLabel(row: BidKingRawTableRow): string {
  return rawRewardLabel(row, 7);
}

function giftPackagePayLabel(orders: NonNullable<PlayerProfile['purchaseOrders']>, payId: string): string {
  if (!payId) {
    return '免兑礼匣';
  }
  const pay = bidKingPays.find((row) => row.id === payId);
  const completed = payOrderCompleted(orders, payId);
  return `${pay ? bidKingRawTableDisplayName(pay) : `钱契${payId}`} ${completed ? '已入账' : '待入账'}`;
}

function payOrderCompleted(orders: NonNullable<PlayerProfile['purchaseOrders']>, payId: string): boolean {
  return orders.some((order) => order.source === 'pay' && order.refId === payId && order.status === 'completed');
}

function rawRewardLabel(row: BidKingRawTableRow, column: number): string {
  return bidKingRewardRowsLabel(parseBidKingRewardRows(rawColumn(row, column)));
}

function activityWindowLabel(activity: Pick<ActivityProgressEntryView, 'durationSeconds' | 'remainingMs'>): string {
  if (!activity.durationSeconds) {
    return '';
  }
  if (activity.remainingMs === undefined || activity.remainingMs <= 0) {
    return ' · 已到期';
  }
  const hours = Math.ceil(activity.remainingMs / 3600_000);
  return ` · 剩余 ${hours} 小时`;
}

function activityDisplayName(activity: Pick<ActivityProgressEntryView, 'activityId' | 'name'>): string {
  const row = bidKingActivities.find((candidate) => candidate.id === String(activity.activityId));
  return row
    ? bidKingRawTableDisplayName(row)
    : safeBidKingDisplayText(activity.name, `活动 ${activity.activityId}`) || `活动 ${activity.activityId}`;
}

function activityDisplayDesc(activity: Pick<ActivityProgressEntryView, 'activityId' | 'description'>): string {
  const row = bidKingActivities.find((candidate) => candidate.id === String(activity.activityId));
  return row
    ? bidKingRawTableDisplayDesc(row)
    : safeBidKingDisplayText(activity.description, '完成活动目标后可领取奖励。') || '完成活动目标后可领取奖励。';
}

function isOpenableActivityTarget(target: ActivityProgressEntryView['actionTarget']): target is ActivityTargetView {
  return target === 'rank' || target === 'friend' || target === 'club' || target === 'pass';
}

function activityTargetLabel(target: ActivityProgressEntryView['actionTarget']): string {
  if (target === 'rank') {
    return '前往名士榜';
  }
  if (target === 'friend') {
    return '前往同游';
  }
  if (target === 'club') {
    return '前往鉴宝会';
  }
  if (target === 'pass') {
    return '查看珍宝令';
  }
  return '暂不前往';
}

function activityPanelLabel(panelName: string): string {
  const labels: Record<string, string> = {
    ActivityPanel_Rank: '名士榜活动',
    ActivityPanel_Social: '同游活动',
    ActivityPanel_Pass: '珍宝令活动'
  };
  return labels[panelName] ?? '活动入口';
}

function purchaseOrderSummary(
  orders: NonNullable<PlayerProfile['purchaseOrders']>,
  source: 'pay' | 'purchaseList' | 'dlc',
  refId: string
): string {
  const order = orders.find((candidate) => candidate.source === source && candidate.refId === refId);
  if (!order) {
    return '未立契';
  }
  if (order.status === 'completed') {
    return `已入账 · ${order.coins.toLocaleString()} 铜钱`;
  }
  if (order.status === 'cancelled') {
    return '已撤契';
  }
  return `待入账 · 契价 ${order.price}`;
}

function purchaseListSkuLabel(row: BidKingRawTableRow): string {
  const category = safeBidKingDisplayText(rawColumn(row, 6), '外部宝券') || '外部宝券';
  const flags = [
    rawColumn(row, 9) === 'True' ? '可交易' : '不可交易',
    rawColumn(row, 10) === 'True' ? '可入市' : '不可入市',
    rawColumn(row, 12) === 'True' ? '局内可用' : '局外契据',
    rawColumn(row, 13) === 'True' ? '自动堆叠' : '不堆叠'
  ];
  return `契号 ${rawColumn(row, 0)} · ${category} · ${flags.join(' / ')}`;
}

function commerceServiceLabel(label: string): string {
  const localServicePattern = new RegExp(['Mo' + 'ck', '模拟'].join('|'), 'gi');
  return label.replace(/Steam|SKU|DLC/gi, '外部契据').replace(localServicePattern, '外部平台');
}

function openPurchaseUrl(row: BidKingRawTableRow): void {
  const url = rawColumn(row, 7);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function rawColumn(row: BidKingRawTableRow, index: number): string {
  return row.columns[index] ?? '';
}
