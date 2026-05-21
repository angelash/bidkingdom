import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Archive, Coins, Crown, Lock, X } from 'lucide-react';
import {
  Item as bidKingCompatItems,
  bidKingItemRuntimeFlags,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import type { PlayerInventoryEntry, PlayerProfile, Rarity } from '@bitkingdom/shared';
import { itemIconForKey } from '../../artAssets';
import { ItemTypeFilterStrip } from '../catalog/ItemTypeFilterStrip';
import {
  itemMatchesItemTypeFilter,
  type BidKingItemTypeFilterId
} from '../catalog/itemTypeFilterRuntime';

type CabinetItem = (typeof gameConfig.items)[number] & { bidKingQuality?: number; collectionCoinPerHour?: number };

interface CabinetInventoryEntry {
  inventory: PlayerInventoryEntry;
  item: CabinetItem;
  refId: string;
  quantity: number;
  source: BidKingItemRow;
  flags: ReturnType<typeof bidKingItemRuntimeFlags>;
}

interface SaleQuote {
  entries: CabinetInventoryEntry[];
  itemCount: number;
  totalCoins: number;
}

interface CabinetBrowserProps {
  items: CabinetItem[];
  profile: PlayerProfile;
  onSellAllCabinetItems: () => void;
}

export function CabinetBrowser({
  items,
  profile,
  onSellAllCabinetItems
}: CabinetBrowserProps): JSX.Element {
  const [typeFilter, setTypeFilter] = useState<BidKingItemTypeFilterId>('all');
  const [selectedInventoryKey, setSelectedInventoryKey] = useState<string>();
  const [sellAllConfirmOpen, setSellAllConfirmOpen] = useState(false);
  const allInventoryEntries = useMemo(
    () => buildCabinetInventoryEntries(items, profile.inventory),
    [items, profile.inventory]
  );
  const inventoryEntries = allInventoryEntries
    .filter((entry) => itemMatchesItemTypeFilter(entry.item.id, typeFilter, 'warehouse'));
  const selectedEntry = selectedInventoryKey
    ? allInventoryEntries.find((entry) => entry.inventory.key === selectedInventoryKey)
    : undefined;
  const saleQuote = quoteSellAll(allInventoryEntries);
  const hasInventory = allInventoryEntries.length > 0;
  const hasFilteredInventory = inventoryEntries.length > 0;

  useEffect(() => {
    setSelectedInventoryKey(undefined);
    setSellAllConfirmOpen(false);
  }, [profile.playerId]);

  useEffect(() => {
    if (selectedInventoryKey && !allInventoryEntries.some((entry) => entry.inventory.key === selectedInventoryKey)) {
      setSelectedInventoryKey(undefined);
    }
  }, [allInventoryEntries, selectedInventoryKey]);

  function confirmSellAll(): void {
    setSellAllConfirmOpen(false);
    setSelectedInventoryKey(undefined);
    onSellAllCabinetItems();
  }

  return (
    <div className={`cabinet-browser warehouse-view ${selectedEntry ? 'has-detail' : ''}`}>
      <section className="cabinet-warehouse-summary">
        <div>
          <span>杂货柜</span>
          <strong>主仓库</strong>
        </div>
        <div className="warehouse-stat-strip">
          <span>{allInventoryEntries.length} 类藏品</span>
          <span>{totalQuantity(allInventoryEntries)} 件库存</span>
          <span>{formatCoins(saleQuote.totalCoins)} 可入账</span>
        </div>
      </section>

      <ItemTypeFilterStrip selected={typeFilter} scope="warehouse" onSelect={setTypeFilter} />

      <div className="cabinet-warehouse-stage">
        <section className="cabinet-warehouse-panel">
          <div className="cabinet-warehouse-panel-header">
            <strong>主仓库</strong>
            <span>{inventoryEntries.length}/{allInventoryEntries.length}</span>
          </div>
          {!hasInventory && (
            <div className="empty-state-panel warehouse-empty">
              <Archive size={28} />
              <strong>仓库暂无藏品</strong>
              <p>打完一局后，拍下来的藏品会进入这里，出售后再入账。</p>
            </div>
          )}
          {hasInventory && !hasFilteredInventory && (
            <div className="empty-state-panel warehouse-empty">
              <Archive size={28} />
              <strong>当前分类没有藏品</strong>
              <p>切换筛选后可以查看其它库存。</p>
            </div>
          )}
          {hasFilteredInventory && (
            <div className="cabinet-browser-grid warehouse-grid">
              {inventoryEntries.map((entry) => {
                const itemIcon = itemIconForKey(entry.item.iconKey);
                const shapeKey = shapeKeyForItem(entry.item);
                return (
                  <button
                    className={`cabinet-browser-slot rarity-${entry.item.rarity} shape-${shapeKey} ${selectedEntry?.inventory.key === entry.inventory.key ? 'selected' : ''}`}
                    key={entry.inventory.key}
                    onClick={() => setSelectedInventoryKey(entry.inventory.key)}
                    style={itemGridSpan(entry.item)}
                    type="button"
                  >
                    {itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <Crown size={18} />}
                    <strong>{entry.item.name}</strong>
                    <span>x{entry.quantity}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedEntry && (
          <aside className="warehouse-detail-panel" aria-label="藏品详情">
            <button
              aria-label="关闭藏品详情"
              className="warehouse-detail-close"
              onClick={() => setSelectedInventoryKey(undefined)}
              type="button"
            >
              <X size={20} />
            </button>
            <div className="warehouse-detail-topline">
              <span>《{selectedEntry.item.name}》</span>
              <strong>{formatCoins(selectedEntry.item.value)}</strong>
            </div>
            <ItemDetailView item={selectedEntry.item} unlocked />
            <section className="detail-block warehouse-selected-meta">
              <strong>仓库信息</strong>
              <div className="detail-stat-grid compact">
                <DetailStat label="库存" value={`x${selectedEntry.quantity}`} />
                <DetailStat
                  label="出售价"
                  value={canSellEntry(selectedEntry) ? formatCoins(salePriceForEntry(selectedEntry)) : '不可出售'}
                />
                <DetailStat label="品质" value={`${selectedEntry.source.item_quality}`} />
                <DetailStat label="占格" value={shapeKeyForItem(selectedEntry.item)} />
              </div>
            </section>
          </aside>
        )}
      </div>

      <footer className="cabinet-sale-footer">
        <div className="cabinet-sale-summary">
          <span>可出售 {saleQuote.itemCount} 件</span>
          <strong>{formatCoins(saleQuote.totalCoins)}</strong>
        </div>
        <button
          className="cabinet-sale-button"
          disabled={saleQuote.itemCount <= 0}
          onClick={() => setSellAllConfirmOpen(true)}
          type="button"
        >
          <Coins size={18} />
          出售
        </button>
      </footer>

      {sellAllConfirmOpen && (
        <div className="warehouse-confirm-backdrop" role="presentation">
          <div aria-modal="true" className="warehouse-confirm-dialog" role="dialog">
            <strong>出售全部藏品</strong>
            <p>
              将出售 {saleQuote.itemCount} 件可出售藏品，预计入账 {formatCoins(saleQuote.totalCoins)}。
              不可出售或高品质藏品会保留在仓库。
            </p>
            <div className="warehouse-confirm-actions">
              <button onClick={() => setSellAllConfirmOpen(false)} type="button">取消</button>
              <button disabled={saleQuote.itemCount <= 0} onClick={confirmSellAll} type="button">确认出售</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemDetailView({
  item,
  unlocked
}: {
  item: CabinetItem;
  unlocked: boolean;
}): JSX.Element {
  const itemIcon = itemIconForKey(item.iconKey);
  const setName = item.setId ? gameConfig.sets.find((set) => set.id === item.setId)?.name : undefined;
  return (
    <article className={`item-detail-view rarity-${item.rarity} ${unlocked ? '' : 'locked'}`}>
      <div className="item-detail-hero">
        <div className="item-detail-art">
          {unlocked && itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <Lock size={28} />}
        </div>
        <div>
          <span>{rarityName(item.rarity)} · {item.category}</span>
          <h3>{unlocked ? item.name : '未点亮藏品'}</h3>
          <p>{unlocked ? itemFlavorText(item) : '完成对局并开出该藏品后，会解锁名称、估值、品类与占格信息。'}</p>
        </div>
      </div>
      <div className="detail-stat-grid">
        <DetailStat label="稀有度" value={rarityName(item.rarity)} />
        <DetailStat label="品类" value={unlocked ? item.category : '待揭示'} />
        <DetailStat label="真值" value={unlocked ? formatCoins(item.value) : '待揭示'} />
        <DetailStat label="展示估值" value={unlocked ? formatCoins(item.displayValue) : '待揭示'} />
        {item.collectionCoinPerHour !== undefined && (
          <DetailStat label="基础收益" value={unlocked ? `${item.collectionCoinPerHour.toFixed(1)}/小时` : '待揭示'} />
        )}
        <DetailStat label="占格" value={unlocked ? shapeKeyForItem(item) : '待揭示'} />
        <DetailStat label="套装" value={unlocked ? setName ?? '无' : '待揭示'} />
      </div>
      <section className="detail-block">
        <strong>{unlocked ? '拍卖提示' : '解锁提示'}</strong>
        <p>{unlocked ? itemPlayTip(item) : '珍宝谱保留未点亮位置，方便掌柜知道仍有目标可追。单个藏品点亮后即可在这里查看完整详情。'}</p>
      </section>
    </article>
  );
}

function DetailStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function buildCabinetInventoryEntries(
  items: CabinetItem[],
  inventory: PlayerInventoryEntry[]
): CabinetInventoryEntry[] {
  const itemById = new Map(items.map((item) => [canonicalItemId(item.id), item]));
  return inventory.flatMap((entry) => {
    const item = itemById.get(canonicalItemId(entry.refId));
    const source = bidKingItemByInventoryRef(entry.refId);
    if (!item || !source || entry.quantity <= 0) {
      return [];
    }
    return [{
      inventory: entry,
      item,
      refId: entry.refId,
      quantity: entry.quantity,
      source,
      flags: bidKingItemRuntimeFlags(source)
    }];
  }).sort((left, right) => (
    right.item.value - left.item.value ||
    right.quantity - left.quantity ||
    left.item.name.localeCompare(right.item.name)
  ));
}

function quoteSellAll(entries: CabinetInventoryEntry[]): SaleQuote {
  const sellableEntries = entries.filter(canSellEntry);
  return {
    entries: sellableEntries,
    itemCount: totalQuantity(sellableEntries),
    totalCoins: sellableEntries.reduce((sum, entry) => sum + salePriceForEntry(entry) * entry.quantity, 0)
  };
}

function canSellEntry(entry: CabinetInventoryEntry): boolean {
  return entry.quantity > 0 && entry.flags.saleable && entry.source.item_quality < 7;
}

function salePriceForEntry(entry: CabinetInventoryEntry): number {
  return Math.max(0, Math.floor(entry.source.base_value));
}

function totalQuantity(entries: readonly CabinetInventoryEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function canonicalItemId(raw: string): string {
  const compatMatch = /^compat_(\d+)(?:_\d+)?$/.exec(raw);
  if (/^\d+$/.test(raw)) {
    return `compat_${raw}`;
  }
  return compatMatch?.[1] ? `compat_${compatMatch[1]}` : raw;
}

function bidKingItemByInventoryRef(refId: string): BidKingItemRow | undefined {
  const compatMatch = /^compat_(\d+)/.exec(refId);
  const sourceId = Number(compatMatch?.[1] ?? refId);
  return Number.isFinite(sourceId) ? bidKingCompatItems.find((row) => row.id === sourceId) : undefined;
}

function shapeKeyForItem(item: Pick<CabinetItem, 'footprint'>): string {
  return `${item.footprint.w}x${item.footprint.h}`;
}

function itemGridSpan(item: Pick<CabinetItem, 'footprint'>): CSSProperties {
  return {
    gridColumn: `span ${Math.max(1, item.footprint.w)}`,
    gridRow: `span ${Math.max(1, item.footprint.h)}`
  };
}

function itemFlavorText(item: CabinetItem): string {
  if (item.rarity === 'legendary') {
    return '高价值核心藏品，足以改变单轮收益和名士榜名次。';
  }
  return '稳定藏品，适合用来校准整仓真实价值、占格效率和品类线索。';
}

function itemPlayTip(item: CabinetItem): string {
  if (item.setId) {
    const setName = gameConfig.sets.find((set) => set.id === item.setId)?.name;
    return `${setName ?? '套装'}成员可形成额外收益预期，适合结合珍宝谱和拍场来源判断。`;
  }
  return '用该藏品的真值、占格和品类，反推同类整仓的竞价上限。';
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

function formatCoins(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString()} 铜钱`;
}
