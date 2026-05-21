import {
  Item as bidKingItems,
  ItemType as bidKingItemTypes,
  bidKingItemRuntimeFlags,
  bidKingItemTypeDisplayName,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';

export type BidKingItemTypeFilterScope = 'auction' | 'trade' | 'warehouse';
export type BidKingItemTypeFilterId = 'all' | number;

export interface BidKingItemTypeFilterOption {
  id: BidKingItemTypeFilterId;
  label: string;
  detail: string;
}

export function itemTypeFilterOptions(scope: BidKingItemTypeFilterScope): BidKingItemTypeFilterOption[] {
  const typeRows = bidKingItemTypes.filter((row) => {
    if (scope === 'trade') {
      return row.showin_tradingbuy > 0;
    }
    if (scope === 'auction') {
      return row.showin_auction > 0;
    }
    return row.id >= 100 && row.id <= 110;
  });
  return [
    { id: 'all', label: '全部', detail: scopeLabel(scope) },
    ...typeRows.map((row) => ({
      id: row.id,
      label: bidKingItemTypeDisplayName(row),
      detail: `柜台分类 ${row.store_type}`
    }))
  ];
}

export function itemMatchesItemTypeFilter(
  refId: string | number,
  filterId: BidKingItemTypeFilterId,
  scope: BidKingItemTypeFilterScope
): boolean {
  const item = bidKingItemByRefId(refId);
  if (!item) {
    return filterId === 'all';
  }
  if (!itemVisibleInScope(item, scope)) {
    return false;
  }
  return filterId === 'all' || item.item_type_ids.includes(filterId);
}

export function itemTypeFilterSummary(refId: string | number): string {
  const item = bidKingItemByRefId(refId);
  if (!item) {
    return '非珍物表条目';
  }
  const typeRows = bidKingItemTypes.filter((row) => item.item_type_ids.includes(row.id));
  const names = typeRows.map((row) => bidKingItemTypeDisplayName(row)).join(' / ') || item.packaged_category;
  const storeTypes = [...new Set(typeRows.map((row) => row.store_type))].join('/');
  return `${names} · 珍阁分类 ${storeTypes || '无'}`;
}

function bidKingItemByRefId(refId: string | number): BidKingItemRow | undefined {
  const raw = String(refId);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  const numericId = Number(compatMatch?.[1] ?? raw);
  return Number.isFinite(numericId) ? bidKingItems.find((item) => item.id === numericId) : undefined;
}

function itemVisibleInScope(item: BidKingItemRow, scope: BidKingItemTypeFilterScope): boolean {
  if (scope === 'warehouse') {
    return item.slot_type > 0 && item.item_type_ids.some((typeId) => typeId >= 100 && typeId <= 110);
  }
  const flags = bidKingItemRuntimeFlags(item);
  return scope === 'trade' ? flags.tradable : flags.auctionable;
}

function scopeLabel(scope: BidKingItemTypeFilterScope): string {
  if (scope === 'trade') {
    return '互市可见';
  }
  if (scope === 'auction') {
    return '拍场可见';
  }
  return '珍阁藏品';
}
