import { useState } from 'react';
import { RefreshCw, Star } from 'lucide-react';
import {
  Item as bidKingCompatItems,
  Shop as bidKingShops,
  Ticket as bidKingTickets,
  bidKingItemDisplayName,
  bidKingShopDisplayDesc,
  bidKingShopDisplayName,
  bidKingShopItemRuntimeSummary,
  bidKingShopRuntimeSummary,
  bidKingTicketDisplayName,
  compareShopItemsByStoreOrder,
  shopItemsForShop
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { qualityClassFromSourceQuality } from '../catalog/qualityVisuals';
import { inventoryQuantity } from '../profile/profileInventory';

interface ShopPanelViewProps {
  profile: PlayerProfile;
  onBuyItem: (shopItemId: number) => void;
  onRefreshShop: (shopId?: number) => void;
  onSetShopItemCollection: (itemId: number, collected: boolean) => void;
}

export function ShopPanelView({ profile, onBuyItem, onRefreshShop, onSetShopItemCollection }: ShopPanelViewProps): JSX.Element {
  const [selectedShopId, setSelectedShopId] = useState(bidKingShops[0]?.id ?? 0);
  const selectedShop = bidKingShops.find((shop) => shop.id === selectedShopId) ?? bidKingShops[0];
  const selectedShopRuntime = selectedShop ? bidKingShopRuntimeSummary(selectedShop) : undefined;
  const restock = selectedShop ? profile.shopRestocks?.find((entry) => entry.shopId === selectedShop.id) : undefined;
  const now = Date.now();
  const restockExpired = Boolean(restock?.nextRefreshAt && restock.nextRefreshAt <= now);
  const refreshTicketBlocked = Boolean(selectedShopRuntime?.refreshable && selectedShopRuntime.ticketCost > profile.tickets.current);
  const shopRows = selectedShop ? shopItemsForShop(selectedShop.id) : [];
  const entriesSource = restock?.shopItemIds.length
    ? restock.shopItemIds
      .map((shopItemId) => shopRows.find((entry) => entry.id === shopItemId))
      .filter((entry): entry is (typeof shopRows)[number] => Boolean(entry))
    : shopRows.slice(0, 18);
  const entries = sortShopEntriesForProfile(profile, entriesSource);
  const ticket = bidKingTickets[0];

  return (
    <div className="shop-config-panel">
      <aside className="shop-tab-list">
        {bidKingShops.map((shop) => (
          <button className={shop.id === selectedShop?.id ? 'active' : ''} key={shop.id} onClick={() => setSelectedShopId(shop.id)} type="button">
            <strong>{bidKingShopDisplayName(shop)}</strong>
            <span>{shopRuntimeLabel(shop)} · {shopItemsForShop(shop.id).length} 件货</span>
          </button>
        ))}
      </aside>
      <main className="shop-item-list">
        <header>
          <div>
            <strong>{selectedShop ? bidKingShopDisplayName(selectedShop) : '宝铺'}</strong>
            <p>{selectedShop ? bidKingShopDisplayDesc(selectedShop) : '未找到宝铺配置。'}</p>
          </div>
          <div className="shop-header-actions">
            {ticket && <span>{bidKingTicketDisplayName(ticket)}上限 {ticket.max}</span>}
            {selectedShopRuntime && <span>{shopCurrencyDisplayLabel(selectedShopRuntime.currencyDisplay)}</span>}
            {selectedShopRuntime?.refreshable && <span>{shopRefreshCostLabel(selectedShopRuntime.ticketCost)}</span>}
            {restock && <span>{shopRestockSummary(restock)}</span>}
            {restockExpired && <span className="shop-refresh-ready">可补货</span>}
            <button type="button" onClick={() => onRefreshShop(selectedShop?.id)} disabled={!selectedShopRuntime?.refreshable || refreshTicketBlocked}>
              <RefreshCw size={16} />
              {refreshTicketBlocked ? '券不足' : selectedShopRuntime?.refreshable ? (restockExpired ? '立即补货' : '补货') : '不可补货'}
            </button>
          </div>
        </header>
        <div className="shop-item-grid">
          {entries.map((entry) => {
            const purchase = profile.shopPurchases.find((candidate) => candidate.shopItemId === entry.id);
            const bought = purchase?.bought ?? 0;
            const limit = entry.buycounts;
            const soldOut = limit > 0 && bought >= limit;
            const affordable = shopPriceAffordable(profile, entry.price);
            const disabled = soldOut || !affordable;
            const itemId = entry.itemid[0]?.[0] ?? 0;
            const collected = shopItemCollected(profile, entry);
            const runtime = bidKingShopItemRuntimeSummary(entry, selectedShop);
            const qualityClass = shopItemQualityClass(entry);
            return (
              <article className={`shop-item-card ${qualityClass}`} key={entry.id}>
                <div className="shop-item-card-header">
                  <span>{shopItemTypeLabel(entry.type)}</span>
                  {itemId > 0 && (
                    <button
                      aria-label={collected ? '取消宝铺收藏' : '收藏宝铺货品'}
                      className={collected ? 'shop-collect-button active' : 'shop-collect-button'}
                      onClick={() => onSetShopItemCollection(itemId, !collected)}
                      title={collected ? '取消宝铺收藏' : '收藏宝铺货品'}
                      type="button"
                    >
                      <Star fill={collected ? 'currentColor' : 'none'} size={15} />
                    </button>
                  )}
                </div>
                <strong>{shopItemDisplayName(entry)}</strong>
                <p>{shopItemRewardLabel(entry.itemid)}</p>
                <div className="shop-runtime-row">
                  {runtime.randomWeight > 0 && <span>权重 {runtime.randomWeight}</span>}
                  {runtime.rateBands.some((band) => band.rate > 0 || band.value > 0) && <span>{shopRateBandLabel(runtime.rateBands)}</span>}
                  {runtime.buyUiType > 0 && <span>柜台 {runtime.buyUiType}</span>}
                </div>
                <em>{shopPriceLabel(entry.price)} · {limit > 0 ? `${bought}/${limit}` : '不限购'}</em>
                <button disabled={disabled} onClick={() => onBuyItem(entry.id)} type="button">
                  {soldOut ? '已售罄' : affordable ? '购入' : '材料不足'}
                </button>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function shopItemTypeLabel(type: number): string {
  if (type === 1) {
    return '限购';
  }
  if (type === 2) {
    return '轮换';
  }
  return `货类${type}`;
}

function shopRuntimeLabel(shop: (typeof bidKingShops)[number]): string {
  const runtime = bidKingShopRuntimeSummary(shop);
  if (runtime.random && runtime.autoRefreshHours) {
    return `轮换 ${runtime.randomCount} 件 · ${runtime.autoRefreshHours}时辰`;
  }
  if (runtime.refreshable && runtime.autoRefreshHours) {
    return `定时补货 · ${runtime.autoRefreshHours}时辰`;
  }
  if (runtime.random) {
    return `轮换 ${runtime.randomCount} 件`;
  }
  return '常驻柜台';
}

function shopCurrencyDisplayLabel(currencyDisplay: readonly number[]): string {
  const visible = currencyDisplay.filter((entry) => entry > 0);
  if (visible.length === 0) {
    return '默认铜钱';
  }
  return `收取 ${visible.map((entry) => {
    const item = bidKingCompatItems.find((candidate) => candidate.id === entry);
    return item ? bidKingItemDisplayName(item) : entry;
  }).join('/')}`;
}

function shopRefreshCostLabel(ticketCost: number): string {
  return ticketCost > 0 ? `补货耗券 ${ticketCost}` : '免费补货';
}

function shopRateBandLabel(rateBands: Array<{ rate: number; value: number }>): string {
  const active = rateBands.filter((band) => band.rate > 0 || band.value > 0).slice(0, 2);
  return active.map((band) => `${band.rate}:${band.value}`).join(' / ');
}

function sortShopEntriesForProfile<T extends ReturnType<typeof shopItemsForShop>[number]>(profile: PlayerProfile, rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftCollected = shopItemCollected(profile, left);
    const rightCollected = shopItemCollected(profile, right);
    if (leftCollected !== rightCollected) {
      return Number(rightCollected) - Number(leftCollected);
    }
    const leftPurchase = profile.shopPurchases.find((candidate) => candidate.shopItemId === left.id);
    const rightPurchase = profile.shopPurchases.find((candidate) => candidate.shopItemId === right.id);
    if (left.buycounts > 0 && right.buycounts > 0 && (leftPurchase?.bought ?? 0) !== (rightPurchase?.bought ?? 0)) {
      return (leftPurchase?.bought ?? 0) - (rightPurchase?.bought ?? 0);
    }
    return compareShopItemsByStoreOrder(left, right);
  });
}

function shopItemCollected(profile: PlayerProfile, row: ReturnType<typeof shopItemsForShop>[number]): boolean {
  const itemId = row.itemid[0]?.[0];
  return itemId !== undefined && Boolean(profile.shopCollections?.includes(itemId));
}

function shopItemRewardLabel(itemRefs: readonly (readonly number[])[]): string {
  return itemRefs
    .filter((entry) => entry.length > 0)
    .slice(0, 2)
    .map((entry) => {
      const itemId = entry[0] ?? 0;
      const count = entry[1] ?? 1;
      const item = bidKingCompatItems.find((candidate) => candidate.id === itemId);
      return `${item ? bidKingItemDisplayName(item) : `珍物${itemId}`} x${count}`;
    })
    .join('、') || '未配置货品';
}

function shopPriceLabel(priceRows: readonly (readonly number[])[]): string {
  return priceRows
    .filter((entry) => entry.length > 0)
    .slice(0, 2)
    .map((entry) => {
      const currency = entry[0] ?? 0;
      const min = entry[1] ?? 0;
      const max = entry[3] ?? min;
      const item = bidKingCompatItems.find((candidate) => candidate.id === currency);
      const name = currency === 1 ? '铜钱' : item ? bidKingItemDisplayName(item) : `珍物${currency}`;
      return min === max ? `${name} x${min}` : `${name} x${min}-${max}`;
    })
    .join(' / ') || '免费';
}

function shopItemDisplayName(entry: ReturnType<typeof shopItemsForShop>[number]): string {
  const itemId = entry.itemid[0]?.[0] ?? 0;
  const item = bidKingCompatItems.find((candidate) => candidate.id === itemId);
  if (!item) {
    return entry.packaged_name;
  }
  return bidKingItemDisplayName(item);
}

function shopItemQualityClass(entry: ReturnType<typeof shopItemsForShop>[number]): string {
  const itemId = entry.itemid[0]?.[0] ?? 0;
  const item = bidKingCompatItems.find((candidate) => candidate.id === itemId);
  return qualityClassFromSourceQuality(item?.item_quality);
}

function shopPriceAffordable(profile: PlayerProfile, priceRows: readonly (readonly number[])[]): boolean {
  const costs = new Map<number, number>();
  for (const price of priceRows) {
    const refId = Number(price[0] ?? 0);
    const quantity = Number(price[1] ?? price[2] ?? 0);
    if (refId > 0 && quantity > 0) {
      costs.set(refId, (costs.get(refId) ?? 0) + quantity);
    }
  }
  return [...costs.entries()].every(([refId, quantity]) => (
    refId === 1 ? profile.coins >= quantity : inventoryQuantity(profile, refId) >= quantity
  ));
}

function shopRestockSummary(restock: NonNullable<PlayerProfile['shopRestocks']>[number]): string {
  const next = restock.nextRefreshAt ? new Date(restock.nextRefreshAt).toLocaleTimeString() : '手动补货';
  return `补货池 ${restock.shopItemIds.length} 件 · ${next}`;
}
