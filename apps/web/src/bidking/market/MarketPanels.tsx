import { useEffect, useState } from 'react';
import {
  bidKingMarketBidIncrement,
  bidKingMarketListingCost,
  bidKingMarketOrderDurationHours,
  bidKingMarketRuleRuntime
} from '@bitkingdom/match-core';
import {
  BattleItem as bidKingBattleItems,
  ExchangeRestock as bidKingExchangeRestocks,
  Item as bidKingCompatItems,
  ItemRestock as bidKingItemRestocks,
  Rank as bidKingRanks,
  RankReward as bidKingRankRewards,
  bidKingBattleItemDisplayName,
  bidKingItemDisplayName,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName
} from '@bitkingdom/bidking-compat';
import type { MarketOrderState, MarketOrdersSnapshot, PlayerProfile } from '@bitkingdom/shared';
import { ItemTypeFilterStrip } from '../catalog/ItemTypeFilterStrip';
import {
  itemMatchesItemTypeFilter,
  itemTypeFilterSummary,
  type BidKingItemTypeFilterId
} from '../catalog/itemTypeFilterRuntime';
import { qualityClassFromSourceQuality } from '../catalog/qualityVisuals';
import { inventoryQuantity } from '../profile/profileInventory';

interface MarketPanelProps {
  profile: PlayerProfile;
  serverUrl: string;
  onBuyItem: (shopItemId: number) => void;
  onCreateMarketOrder: (refId: string, quantity: number, price: number, orderType: 'trade' | 'auction', note?: string) => void;
  onActOnMarketOrder: (orderId: string, action: 'settle' | 'cancel') => void;
}

interface ExchangeRestockView {
  pools: Array<{
    exchangeId: string;
    shopId: number;
    shopItemIds: number[];
    itemIds: number[];
    itemNames: string[];
    offers: Array<{
      shopItemId: number;
      itemId: number;
      itemName: string;
      price: Array<{ refId: number; quantity: number; name: string }>;
    }>;
  }>;
}

export function TradePanelView({
  profile,
  serverUrl,
  onBuyItem,
  onCreateMarketOrder,
  onActOnMarketOrder
}: MarketPanelProps): JSX.Element {
  const orders = profile.marketOrders.filter((order) => order.orderType === 'trade');
  const [typeFilter, setTypeFilter] = useState<BidKingItemTypeFilterId>('all');
  const inventory = profile.inventory
    .filter((entry) => entry.quantity > 0)
    .filter((entry) => itemMatchesItemTypeFilter(entry.refId, typeFilter, 'trade'));
  const [orderNote, setOrderNote] = useState('');
  const [marketSnapshot, setMarketSnapshot] = useState<MarketOrdersSnapshot>();
  const [exchangeSnapshot, setExchangeSnapshot] = useState<ExchangeRestockView>();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`${serverUrl}/api/market/orders?orderType=trade`).then((response) => response.json() as Promise<MarketOrdersSnapshot>),
      fetch(`${serverUrl}/api/exchange/restock`).then((response) => response.json() as Promise<ExchangeRestockView>)
    ]).then(([market, exchange]) => {
      if (!cancelled) {
        setMarketSnapshot(market);
        setExchangeSnapshot(exchange);
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orders.length, serverUrl]);

  const globalOrders = marketSnapshot?.orders
    .filter((order) => itemMatchesItemTypeFilter(order.refId, typeFilter, 'trade'))
    .slice(0, 6) ?? [];
  const marketRules = bidKingMarketRuleRuntime();
  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>珍宝市集</strong>
        <span>{bidKingItemRestocks.length} 条补货 · {exchangeSnapshot?.pools.length ?? bidKingExchangeRestocks.length} 条互市轮换 · {marketRules.slotBase}/{marketRules.slotMax} 槽 · 全服 {marketSnapshot?.orders.length ?? orders.length}/{marketRules.auctionCounts}</span>
      </header>
      <ItemTypeFilterStrip selected={typeFilter} scope="trade" onSelect={setTypeFilter} />
      {(exchangeSnapshot?.pools ?? []).slice(0, 4).map((pool) => (
        <article key={`exchange_pool_${pool.exchangeId}`}>
          <strong>互市池 {pool.exchangeId}</strong>
          <p>{pool.itemIds.map(marketItemName).join('、') || '暂无可兑换藏品'}</p>
          <em>{pool.itemIds.length} 个候选 · {pool.shopItemIds.length} 个互市项</em>
          {pool.offers.slice(0, 2).map((offer) => {
            const affordable = exchangeOfferAffordable(profile, offer.price);
            return (
              <div className="inline-action-row" key={offer.shopItemId}>
                <span>{marketItemName(offer.itemId)} · {exchangePriceLabel(offer.price)}</span>
                <button disabled={!affordable} onClick={() => onBuyItem(offer.shopItemId)} type="button">
                  {affordable ? '互市' : '材料不足'}
                </button>
              </div>
            );
          })}
        </article>
      ))}
      <article className="market-note-panel">
        <strong>市集备注</strong>
        <input maxLength={80} onChange={(event) => setOrderNote(event.target.value)} placeholder="写一句寄售说明" value={orderNote} />
      </article>
      {inventory.map((entry) => {
        const price = marketSuggestedPrice(entry.refId, 'trade');
        const listingCost = bidKingMarketListingCost(price, bidKingMarketOrderDurationHours('trade'));
        return (
          <article className={`market-item-card ${marketQualityClass(entry.refId)}`} key={`trade_inventory_${entry.key}`}>
            <strong>{marketItemName(entry.refId)}</strong>
            <p>库存 {entry.quantity} · {inventoryTypeLabel(entry.type)} · 单契上限 {marketListingLimit(entry.refId)}</p>
            <p>{itemTypeFilterSummary(entry.refId)}</p>
            <em>建议价 {price.toLocaleString()} · 上架费 {listingCost.toLocaleString()} · {bidKingMarketOrderDurationHours('trade')}小时</em>
            <button onClick={() => onCreateMarketOrder(entry.refId, 1, price, 'trade', orderNote)} type="button">寄售</button>
          </article>
        );
      })}
      {orders.map((order) => (
        <article className={`market-item-card claimed ${marketQualityClass(order.refId)}`} key={order.id}>
          <strong>{marketItemName(order.refId)}</strong>
          <p>数量 {order.quantity} · 状态 {marketOrderStatusLabel(order.status)} · {marketOrderExpiryText(order)}</p>
          {order.note && <p>{order.note}</p>}
          <em>寄售价 {marketOrderPriceText(order)} · 上架费 {(order.listingCost ?? 0).toLocaleString()} · 税费 {(order.fee ?? 0).toLocaleString()} · 到账 {(order.netPrice ?? marketOrderTotalPrice(order)).toLocaleString()}</em>
          {order.status === 'listed' && (
            <div className="inline-action-row">
              <button onClick={() => onActOnMarketOrder(order.id, 'settle')} type="button">成交</button>
              <button onClick={() => onActOnMarketOrder(order.id, 'cancel')} type="button">撤契</button>
            </div>
          )}
        </article>
      ))}
      {globalOrders.map((order) => (
        <article className={`market-item-card ${marketQualityClass(order.refId)}`} key={`global_trade_${order.id}`}>
          <strong>{marketItemName(order.refId)}</strong>
          <p>{order.playerName} · {marketOrderStatusLabel(order.status)} · 数量 {order.quantity} · {marketOrderExpiryText(order)}</p>
          {order.note && <p>{order.note}</p>}
          <em>市集挂价 {marketOrderPriceText(order)} · 到账 {(order.netPrice ?? marketOrderTotalPrice(order)).toLocaleString()}</em>
          {order.status === 'listed' && order.playerId !== profile.playerId && (
            <button disabled={marketOrderTotalPrice(order) > profile.coins} onClick={() => onActOnMarketOrder(order.id, 'settle')} type="button">
              {marketOrderTotalPrice(order) > profile.coins ? '铜钱不足' : '购入'}
            </button>
          )}
        </article>
      ))}
      {inventory.length === 0 && (
        <article>
          <strong>暂无可上架库存</strong>
          <p>先通过宝铺、信札、名士榜或委托获得珍物后，市集会显示可寄售条目。</p>
          <em>补货线索：等待补货池刷新</em>
        </article>
      )}
    </div>
  );
}

export function AuctionHousePanelView({
  profile,
  serverUrl,
  onCreateMarketOrder,
  onActOnMarketOrder
}: MarketPanelProps): JSX.Element {
  const orders = profile.marketOrders.filter((order) => order.orderType === 'auction');
  const [typeFilter, setTypeFilter] = useState<BidKingItemTypeFilterId>('all');
  const inventory = profile.inventory
    .filter((entry) => entry.quantity > 0)
    .filter((entry) => itemMatchesItemTypeFilter(entry.refId, typeFilter, 'auction'));
  const [orderNote, setOrderNote] = useState('');
  const [marketSnapshot, setMarketSnapshot] = useState<MarketOrdersSnapshot>();

  useEffect(() => {
    let cancelled = false;
    fetch(`${serverUrl}/api/market/orders?orderType=auction`)
      .then((response) => response.json() as Promise<MarketOrdersSnapshot>)
      .then((payload) => {
        if (!cancelled) {
          setMarketSnapshot(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orders.length, serverUrl]);

  const globalOrders = marketSnapshot?.orders
    .filter((order) => itemMatchesItemTypeFilter(order.refId, typeFilter, 'auction'))
    .slice(0, 6) ?? [];
  const marketRules = bidKingMarketRuleRuntime();
  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>寄拍拍场</strong>
        <span>{bidKingRanks.length} 个榜单 · {bidKingRankRewards.length} 道榜赏 · {marketRules.listingDurationHours.join('/')}小时 · 竞价窗 {marketRules.auctionTimeLimitSeconds[0] ?? 0}秒 · 全服 {marketSnapshot?.orders.length ?? orders.length}/{marketRules.auctionCounts}</span>
      </header>
      <ItemTypeFilterStrip selected={typeFilter} scope="auction" onSelect={setTypeFilter} />
      <article className="market-note-panel">
        <strong>寄拍备注</strong>
        <input maxLength={80} onChange={(event) => setOrderNote(event.target.value)} placeholder="写一句寄拍说明" value={orderNote} />
      </article>
      {inventory.map((entry) => {
        const price = marketSuggestedPrice(entry.refId, 'auction');
        const listingCost = bidKingMarketListingCost(price, bidKingMarketOrderDurationHours('auction'));
        return (
          <article className={`market-item-card ${marketQualityClass(entry.refId)}`} key={`auction_inventory_${entry.key}`}>
            <strong>{marketItemName(entry.refId)}</strong>
            <p>库存 {entry.quantity} · 单契上限 {marketListingLimit(entry.refId)}</p>
            <p>{itemTypeFilterSummary(entry.refId)}</p>
            <em>起拍价 {price.toLocaleString()} · 加价 {bidKingMarketBidIncrement(price).toLocaleString()} · 上架费 {listingCost.toLocaleString()}</em>
            <button onClick={() => onCreateMarketOrder(entry.refId, 1, price, 'auction', orderNote)} type="button">寄拍</button>
          </article>
        );
      })}
      {orders.map((order) => (
        <article className={`market-item-card claimed ${marketQualityClass(order.refId)}`} key={order.id}>
          <strong>{marketItemName(order.refId)}</strong>
          <p>数量 {order.quantity} · 状态 {marketOrderStatusLabel(order.status)} · {marketOrderExpiryText(order)}</p>
          {order.note && <p>{order.note}</p>}
          <em>起拍价 {marketOrderPriceText(order)} · 上架费 {(order.listingCost ?? 0).toLocaleString()} · 税费 {(order.fee ?? 0).toLocaleString()} · 到账 {(order.netPrice ?? marketOrderTotalPrice(order)).toLocaleString()}</em>
          {order.status === 'listed' && (
            <div className="inline-action-row">
              <button onClick={() => onActOnMarketOrder(order.id, 'settle')} type="button">成交</button>
              <button onClick={() => onActOnMarketOrder(order.id, 'cancel')} type="button">撤契</button>
            </div>
          )}
        </article>
      ))}
      {globalOrders.map((order) => (
        <article className={`market-item-card ${marketQualityClass(order.refId)}`} key={`global_auction_${order.id}`}>
          <strong>{marketItemName(order.refId)}</strong>
          <p>{order.playerName} · {marketOrderStatusLabel(order.status)} · 数量 {order.quantity} · {marketOrderExpiryText(order)}</p>
          {order.note && <p>{order.note}</p>}
          <em>拍场起价 {marketOrderPriceText(order)} · 到账 {(order.netPrice ?? marketOrderTotalPrice(order)).toLocaleString()}</em>
          {order.status === 'listed' && order.playerId !== profile.playerId && (
            <button disabled={marketOrderTotalPrice(order) > profile.coins} onClick={() => onActOnMarketOrder(order.id, 'settle')} type="button">
              {marketOrderTotalPrice(order) > profile.coins ? '铜钱不足' : '竞得'}
            </button>
          )}
        </article>
      ))}
      {inventory.length === 0 && bidKingRanks.slice(0, 6).map((rank) => (
        <article key={rank.id}>
          <strong>{bidKingRawTableDisplayName(rank)}</strong>
          <p>{bidKingRawTableDisplayDesc(rank)}</p>
          <em>{rank.columns[5] === '1' ? '地区榜' : '全服榜'} · {rank.columns[8] === '1' ? '升序' : '降序'}</em>
        </article>
      ))}
    </div>
  );
}

function marketItemName(refId: string | number): string {
  const numericId = sourceItemIdFromRef(refId);
  const item = bidKingCompatItems.find((candidate) => candidate.id === numericId);
  const battleItem = bidKingBattleItems.find((candidate) => candidate.id === numericId);
  return item ? bidKingItemDisplayName(item) : battleItem ? bidKingBattleItemDisplayName(battleItem) : `珍物${refId}`;
}

function marketQualityClass(refId: string | number): string {
  return qualityClassFromSourceQuality(bidKingItemByRef(refId)?.item_quality);
}

function inventoryTypeLabel(type: string): string {
  if (type === 'item') {
    return '藏品';
  }
  if (type === 'battleItem') {
    return '试宝令';
  }
  return '珍物';
}

function marketSuggestedPrice(refId: string | number, orderType: 'trade' | 'auction'): number {
  const item = bidKingItemByRef(refId);
  const base = item?.base_value && item.base_value > 0 ? item.base_value : item?.auction_baseprice?.[0] ?? 800;
  const rawPrice = Math.max(100, Math.round(base * (orderType === 'auction' ? 1.6 : 1.1)));
  const step = bidKingMarketBidIncrement(rawPrice);
  return Math.ceil(rawPrice / step) * step;
}

function marketListingLimit(refId: string | number): number {
  const item = bidKingItemByRef(refId);
  const limits = [item?.max_stack_size, item?.max_per_listing]
    .map((value) => Math.floor(Number(value) || 0))
    .filter((value) => value > 0);
  return limits.length > 0 ? Math.min(...limits) : 999;
}

function bidKingItemByRef(refId: string | number) {
  const numericId = sourceItemIdFromRef(refId);
  return Number.isFinite(numericId) ? bidKingCompatItems.find((candidate) => candidate.id === numericId) : undefined;
}

function sourceItemIdFromRef(refId: string | number): number {
  if (typeof refId === 'number') {
    return refId;
  }
  const compatMatch = /^compat_(\d+)/.exec(refId);
  return Number(compatMatch?.[1] ?? refId);
}

function marketOrderStatusLabel(status: MarketOrderState['status']): string {
  const names: Record<MarketOrderState['status'], string> = {
    listed: '挂单中',
    locked: '成交锁定',
    sold: '已成交',
    cancelled: '已撤单',
    expired: '已过期',
    failed: '失败'
  };
  return names[status];
}

function marketOrderTotalPrice(order: Pick<MarketOrderState, 'price' | 'quantity' | 'totalPrice'>): number {
  return order.totalPrice ?? order.price * Math.max(1, order.quantity);
}

function marketOrderPriceText(order: Pick<MarketOrderState, 'price' | 'quantity' | 'totalPrice'>): string {
  const total = marketOrderTotalPrice(order);
  return order.quantity > 1
    ? `${order.price.toLocaleString()} x${order.quantity} = ${total.toLocaleString()}`
    : total.toLocaleString();
}

function marketOrderExpiryText(order: Pick<MarketOrderState, 'expiresAt' | 'status'>): string {
  if (!order.expiresAt || order.status !== 'listed') {
    return '无倒计时';
  }
  const remainingMs = order.expiresAt - Date.now();
  if (remainingMs <= 0) {
    return '待过期回收';
  }
  const hours = Math.max(1, Math.ceil(remainingMs / 3600_000));
  return `${hours} 小时后过期`;
}

function exchangeOfferAffordable(profile: PlayerProfile, price: Array<{ refId: number; quantity: number }>): boolean {
  const costs = new Map<number, number>();
  for (const row of price) {
    if (row.refId > 0 && row.quantity > 0) {
      costs.set(row.refId, (costs.get(row.refId) ?? 0) + row.quantity);
    }
  }
  return [...costs.entries()].every(([refId, quantity]) => (
    refId === 1 ? profile.coins >= quantity : inventoryQuantity(profile, refId) >= quantity
  ));
}

function exchangePriceLabel(price: Array<{ refId: number; name: string; quantity: number }>): string {
  return price.map((row) => `${marketItemName(row.refId)} x${row.quantity}`).join(' / ') || '免费';
}
