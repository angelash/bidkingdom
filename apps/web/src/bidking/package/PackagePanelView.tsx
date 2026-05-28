import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import {
  Item as bidKingItems,
  ItemType as bidKingItemTypes,
  NumberTable as bidKingNumberTables,
  Ticket as bidKingTickets,
  bidKingItemDisplayName,
  bidKingItemRuntimeFlags,
  bidKingTicketRuntimeSummary,
  bidKingWareHouseItemTypeLabels,
  bidKingWareHouseItemVisible,
  bidKingWareHouseRuntime,
  type BidKingItemRow,
  type BidKingWareHouseRuntime
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import type { PlayerProfile } from '@bitkingdom/shared';
import { roleAvatarForRoleId } from '../../artAssets';
import { FullScreenPanel } from '../ui/FullScreenPanel';
import { createPackageIncomeMotion, type PackageIncomeMotion } from './packageIncomeMotion';

type RoleDefinition = (typeof gameConfig.roles)[number];
type WarehouseTypeFilter = 'all' | number;

interface WarehouseStockEntry {
  item: BidKingItemRow;
  key: string;
  quantity: number;
  refId: string;
  typeIds: number[];
  typeLabels: string[];
  updatedAt: number;
  flags: ReturnType<typeof bidKingItemRuntimeFlags>;
}

interface CollectionBonusView {
  codexCount: number;
  activeBonus: number;
  cabinetHourlyCoins: number;
  claimableCoins: number;
  collectionCountMax: number;
  duplicateRatesPerMille: number[];
  gainIntervalSeconds: number;
  incomeElapsedMs: number;
  lastCollectionIncomeAt: number;
  nextCollectionIncomeAt: number;
  tiers: Array<{ id: number; counts: number; bonus: number; active: boolean }>;
}

interface ReliefFundView {
  totalAssets: number;
  limit: number;
  times: number;
  claimedToday: number;
  remainingClaims: number;
  eligible: boolean;
  reason: string;
  rewardCoins: number;
}

interface PackagePanelViewProps {
  profile: PlayerProfile;
  roles: RoleDefinition[];
  serverUrl: string;
  sessionToken?: string;
  onClose: () => void;
  onClaimCollectionIncome: () => void;
  onClaimReliefFund: () => void;
}

export function PackagePanelView({
  profile,
  roles,
  serverUrl,
  sessionToken,
  onClose,
  onClaimCollectionIncome,
  onClaimReliefFund
}: PackagePanelViewProps): JSX.Element {
  const ticketRuntime = bidKingTicketRuntimeSummary(bidKingTickets[0]!);
  const wareHouseRuntime = bidKingWareHouseRuntime();
  const packageItems = [
    {
      id: 'starter_box',
      name: '名士自选锦匣',
      count: 1,
      kind: 'box',
      description: `可从以下竞买人中自选 1 位结识：${roles.slice(0, 12).map((role) => role.name).join('、')}`,
      rewardRoles: roles.slice(0, 5)
    },
    ...roles.slice(0, 15).map((role) => ({
      id: `trial_${role.id}`,
      name: `${role.name}试用名帖`,
      count: 5,
      kind: 'card',
      description: `启用后可请 ${role.name} 出场一回。${role.passive}`,
      rewardRoles: [role]
    }))
  ];
  const [selectedId, setSelectedId] = useState(packageItems[0]!.id);
  const [warehouseTypeFilter, setWarehouseTypeFilter] = useState<WarehouseTypeFilter>('all');
  const [selectedWarehouseKey, setSelectedWarehouseKey] = useState('');
  const selectedItem = packageItems.find((item) => item.id === selectedId) ?? packageItems[0]!;
  const warehouseEntries = createWarehouseStockEntries(profile, wareHouseRuntime);
  const filteredWarehouseEntries = warehouseEntries.filter((entry) => (
    warehouseTypeFilter === 'all' || entry.typeIds.includes(warehouseTypeFilter)
  ));
  const selectedWarehouseEntry =
    filteredWarehouseEntries.find((entry) => entry.key === selectedWarehouseKey) ??
    filteredWarehouseEntries[0];
  const [collectionBonus, setCollectionBonus] = useState<CollectionBonusView>();
  const [reliefFund, setReliefFund] = useState<ReliefFundView>();
  const [incomeMotion, setIncomeMotion] = useState<PackageIncomeMotion>();

  useEffect(() => {
    if (!sessionToken) {
      setCollectionBonus(undefined);
      return undefined;
    }
    let cancelled = false;
    fetch(`${serverUrl}/api/profile/collection-bonus?playerId=${encodeURIComponent(profile.playerId)}`, {
      headers: profileFetchHeaders(sessionToken)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('collection bonus unavailable');
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!cancelled && isCollectionBonusView(payload)) {
          setCollectionBonus(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCollectionBonus(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile.playerId, profile.codex.length, profile.cabinetItemIds?.join(','), profile.lastCollectionIncomeAt, serverUrl, sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      setReliefFund(undefined);
      return undefined;
    }
    let cancelled = false;
    fetch(`${serverUrl}/api/profile/relief-fund?playerId=${encodeURIComponent(profile.playerId)}`, {
      headers: profileFetchHeaders(sessionToken)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('relief fund unavailable');
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!cancelled && isReliefFundView(payload)) {
          setReliefFund(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReliefFund(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile.playerId, profile.coins, profile.inventory.length, profile.settings.bidkingReliefFundClaims, serverUrl, sessionToken]);

  useEffect(() => {
    if (!incomeMotion) {
      return undefined;
    }
    const timer = window.setTimeout(() => setIncomeMotion(undefined), 1200);
    return () => window.clearTimeout(timer);
  }, [incomeMotion]);

  function handleClaimCollectionIncome(): void {
    const motion = createPackageIncomeMotion(collectionBonus?.claimableCoins ?? 0);
    if (motion) {
      setIncomeMotion(motion);
    }
    onClaimCollectionIncome();
  }

  return (
    <FullScreenPanel icon={<Archive size={32} />} title="行囊" english="随身珍物" onClose={onClose}>
      <section className="package-layout">
        <main className="package-grid-panel">
          <header className="package-list-title">
            <strong>随身珍物</strong>
            <span>名帖与礼匣</span>
          </header>
          <div className="package-item-grid">
            {packageItems.map((item) => {
              const role = item.rewardRoles[0];
              return (
                <button
                  className={`package-item-card ${selectedItem.id === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="package-item-art">
                    {item.kind === 'box' ? <Archive size={70} /> : <img src={roleAvatarForRoleId(role?.id)} alt="" loading="lazy" />}
                  </div>
                  <em>x{item.count}</em>
                  <strong>{item.name}</strong>
                </button>
              );
            })}
          </div>
          <section className="warehouse-stock-panel">
            <header className="package-list-title">
              <strong>珍阁库存</strong>
              <span>{wareHouseRuntime.label} · {warehouseEntries.length} 项</span>
            </header>
            <div className="warehouse-filter-row">
              <button
                className={warehouseTypeFilter === 'all' ? 'active' : ''}
                onClick={() => setWarehouseTypeFilter('all')}
                type="button"
              >
                全部
              </button>
              {wareHouseRuntime.typeRules.map((rule) => {
                const count = warehouseEntries.filter((entry) => entry.typeIds.includes(rule.typeId)).length;
                return (
                  <button
                    className={warehouseTypeFilter === rule.typeId ? 'active' : ''}
                    disabled={count === 0}
                    key={rule.typeId}
                    onClick={() => setWarehouseTypeFilter(rule.typeId)}
                    title={`珍阁分类 ${rule.typeId} · 柜台 ${rule.storeType}`}
                    type="button"
                  >
                    {rule.label} <small>{count}</small>
                  </button>
                );
              })}
            </div>
            <div className="warehouse-stock-grid">
              {filteredWarehouseEntries.length === 0 ? (
                <div className="warehouse-empty-state">
                  <Archive size={24} />
                  <strong>暂无珍阁库存</strong>
                  <p>获得券契、令牌、宝匣、陈列柜、名帖等可入阁珍物后会进入这里。</p>
                </div>
              ) : filteredWarehouseEntries.map((entry) => (
                <button
                  className={selectedWarehouseEntry?.key === entry.key ? 'selected' : ''}
                  key={entry.key}
                  onClick={() => setSelectedWarehouseKey(entry.key)}
                  title={warehouseItemName(entry)}
                  type="button"
                >
                  <strong>{warehouseItemName(entry)}</strong>
                  <span>{entry.typeLabels.join(' / ') || `类型 ${entry.typeIds.join('/')}`}</span>
                  <em>x{entry.quantity}</em>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="package-detail-panel">
          <header>
            <h3>{selectedItem.name}</h3>
            <span>拥有：{selectedItem.count}</span>
          </header>
          <p>{selectedItem.description}</p>
          <section className="package-reward-row">
            <strong>可选名士：</strong>
            <div>
              {selectedItem.rewardRoles.map((role) => (
                <span key={role.id}>
                  <img src={roleAvatarForRoleId(role.id)} alt="" loading="lazy" />
                  <small>1</small>
                </span>
              ))}
            </div>
          </section>
          <section className="package-reward-row">
            <strong>收录档位：</strong>
            <div>
              {(collectionBonus?.tiers ?? bidKingNumberTables).slice(0, 7).map((tier) => {
                const tierId = 'id' in tier ? tier.id : tier.Id;
                const tierActive = 'active' in tier ? tier.active : profile.codex.length >= tier.counts;
                return (
                  <span key={`number_tier_${tierId}`}>
                    <small>{tierActive ? '✓' : tier.counts}</small>
                  </span>
                );
              })}
            </div>
          </section>
          <p>
            已收录 {collectionBonus?.codexCount ?? profile.codex.length} 件 · 加成 {(collectionBonus?.activeBonus ?? 0).toFixed(2)}
            · 陈列 {(collectionBonus?.cabinetHourlyCoins ?? 0).toFixed(1)}/小时
          </p>
          <p>
            收录计数上限 {collectionBonus?.collectionCountMax ?? 10} · 领取间隔 {collectionBonus?.gainIntervalSeconds ?? 10} 秒
            · 重复倍率 {(collectionBonus?.duplicateRatesPerMille ?? []).slice(0, 3).map((rate) => `${rate / 10}%`).join(' / ') || '-'}
          </p>
          <section className="package-ticket-strip">
            <span>{profile.tickets.name} {profile.tickets.current}/{ticketRuntime.max}</span>
            <span>{ticketRuntime.recoversAutomatically ? `${ticketRuntime.recoverTimeSeconds}秒恢复` : '不自回'}</span>
            <span>{ticketRuntime.purchasable ? `钱庄可兑 ${ticketRuntime.buyQuantity}` : '不可兑'}</span>
            <span>开拍前验券</span>
          </section>
          <section className="package-ticket-strip">
            <span>救济 {reliefFund?.remainingClaims ?? 0}/{reliefFund?.times ?? 0}</span>
            <span>资产 {(reliefFund?.totalAssets ?? profile.coins).toLocaleString()}</span>
            <span>线 {reliefFund ? reliefFund.limit.toLocaleString() : '-'}</span>
            <span>{reliefFund?.reason ?? '同步中'}</span>
          </section>
          <WarehouseDetailCard entry={selectedWarehouseEntry} runtime={wareHouseRuntime} />
          <button
            className="package-use-btn"
            disabled={!reliefFund?.eligible}
            onClick={onClaimReliefFund}
            type="button"
          >
            {reliefFund?.eligible ? `领取救济 ${reliefFund.rewardCoins.toLocaleString()} 铜钱` : reliefFund?.reason ?? '救济金同步中'}
          </button>
          <button
            className="package-use-btn"
            disabled={(collectionBonus?.claimableCoins ?? 0) <= 0}
            onClick={handleClaimCollectionIncome}
            type="button"
          >
            {incomeMotion && (
              <span aria-label={incomeMotion.ariaLabel} className="package-income-burst" key={incomeMotion.key}>
                {incomeMotion.label}
              </span>
            )}
            {(collectionBonus?.claimableCoins ?? 0) > 0 ? `领取 ${collectionBonus!.claimableCoins.toLocaleString()} 铜钱` : '暂无收益'}
          </button>
        </aside>
      </section>
    </FullScreenPanel>
  );
}

function profileFetchHeaders(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

function isCollectionBonusView(payload: unknown): payload is CollectionBonusView {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const data = payload as Partial<CollectionBonusView>;
  return (
    typeof data.codexCount === 'number' &&
    typeof data.activeBonus === 'number' &&
    typeof data.cabinetHourlyCoins === 'number' &&
    typeof data.claimableCoins === 'number' &&
    Array.isArray(data.tiers)
  );
}

function isReliefFundView(payload: unknown): payload is ReliefFundView {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const data = payload as Partial<ReliefFundView>;
  return (
    typeof data.totalAssets === 'number' &&
    typeof data.limit === 'number' &&
    typeof data.times === 'number' &&
    typeof data.remainingClaims === 'number' &&
    typeof data.eligible === 'boolean' &&
    typeof data.reason === 'string' &&
    typeof data.rewardCoins === 'number'
  );
}

function WarehouseDetailCard({
  entry,
  runtime
}: {
  entry?: WarehouseStockEntry;
  runtime: BidKingWareHouseRuntime;
}): JSX.Element {
  if (!entry) {
    return (
      <section className="warehouse-detail-card empty">
        <strong>{runtime.label}</strong>
        <p>当前行囊没有可入珍阁的珍物。</p>
      </section>
    );
  }
  const actionStates = warehouseActionStates(entry);
  return (
    <section className="warehouse-detail-card">
      <header>
        <strong>{warehouseItemName(entry)}</strong>
        <span>x{entry.quantity}</span>
      </header>
      <p>{warehouseItemDescription(entry)}</p>
      <div className="warehouse-detail-meta">
        <span>珍阁分类 {entry.typeIds.join('/')}</span>
        <span>{entry.typeLabels.join(' / ') || '未命名分类'}</span>
        <span>堆叠 {entry.item.max_stack_size}</span>
      </div>
      <div className="warehouse-action-grid">
        {actionStates.map((state) => (
          <button disabled={!state.enabled} key={state.label} title={state.reason} type="button">
            {state.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function warehouseItemName(entry: Pick<WarehouseStockEntry, 'item'>): string {
  return bidKingItemDisplayName(entry.item);
}

function warehouseItemDescription(entry: WarehouseStockEntry): string {
  const typeLabel = entry.typeLabels.join(' / ') || entry.item.packaged_category || '珍阁分类';
  const enabledActions = warehouseActionStates(entry)
    .filter((state) => state.enabled)
    .map((state) => state.label)
    .join('、') || '查看';
  return `${typeLabel}珍物，品质 ${entry.item.item_quality}，基础价值 ${entry.item.base_value.toLocaleString()}，可用于${enabledActions}。`;
}

function createWarehouseStockEntries(
  profile: PlayerProfile,
  runtime: BidKingWareHouseRuntime
): WarehouseStockEntry[] {
  return profile.inventory.flatMap((entry) => {
    const item = bidKingItemByInventoryRef(entry.refId);
    if (entry.quantity <= 0 || !item || !bidKingWareHouseItemVisible(item, runtime)) {
      return [];
    }
    const typeIds = item.item_type_ids.filter((typeId) => runtime.itemTypeIds.includes(typeId));
    return [{
      item,
      key: entry.key,
      quantity: entry.quantity,
      refId: entry.refId,
      typeIds,
      typeLabels: bidKingWareHouseItemTypeLabels(item, runtime),
      updatedAt: entry.updatedAt,
      flags: bidKingItemRuntimeFlags(item)
    }];
  }).sort((left, right) => (
    right.item.item_quality - left.item.item_quality ||
    right.updatedAt - left.updatedAt ||
    left.item.id - right.item.id
  ));
}

function bidKingItemByInventoryRef(refId: string): BidKingItemRow | undefined {
  const compatMatch = /^compat_(\d+)/.exec(refId);
  const sourceId = Number(compatMatch?.[1] ?? refId);
  return Number.isFinite(sourceId) ? bidKingItems.find((item) => item.id === sourceId) : undefined;
}

function warehouseActionStates(entry: WarehouseStockEntry): Array<{ label: string; enabled: boolean; reason: string }> {
  const typeNames = bidKingItemTypes
    .filter((type) => entry.item.item_type_ids.includes(type.id))
    .map((type) => type.packaged_name)
    .join(' / ');
  return [
    {
      label: '使用',
      enabled: entry.item.skills.length > 0 || entry.item.specified_obtain.length > 0,
      reason: entry.item.skills.length > 0 || entry.item.specified_obtain.length > 0
        ? `可触发掌眼或指定赏格：${entry.item.skills.join('/') || entry.item.specified_obtain.map((row) => row.join(':')).join('/')}`
        : '该珍物无可直接使用效果'
    },
    {
      label: '互市',
      enabled: entry.flags.tradable,
      reason: entry.flags.tradable ? `可入市集：${typeNames}` : '该珍物暂未开放市集流通'
    },
    {
      label: '寄拍',
      enabled: entry.flags.auctionable,
      reason: entry.flags.auctionable ? `拍场底价：${entry.item.auction_baseprice.join('/') || '珍宝局估价'}` : '该珍物暂未开放拍场寄售'
    },
    {
      label: '陈列',
      enabled: entry.flags.placeable,
      reason: entry.flags.placeable ? `占格 ${entry.item.slot_type}` : '非收藏柜藏品类型'
    },
    {
      label: '兑换',
      enabled: entry.flags.exchangeable,
      reason: entry.flags.exchangeable ? `可入互市池 ${entry.item.exchangeId.join('/')}` : '暂不可互市兑换'
    }
  ];
}
