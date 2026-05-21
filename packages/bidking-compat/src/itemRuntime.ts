import type { BidKingItemRow, BidKingItemTypeRow } from './schema';
import { bidKingItemTypeDisplayName } from './itemPackagingOverrides';
import { ItemType } from './tables/ItemType';

export type BidKingItemRuntimeFlagKey =
  | 'auctionable'
  | 'exchangeable'
  | 'placeable'
  | 'roomPriced'
  | 'saleable'
  | 'showInCatalog'
  | 'tradable';

export interface BidKingItemRuntimeFlags {
  auctionable: boolean;
  exchangeable: boolean;
  placeable: boolean;
  roomPriced: boolean;
  saleable: boolean;
  showInCatalog: boolean;
  tradable: boolean;
}

export interface BidKingItemRuntimeFact {
  detail: string;
  key: string;
  label: string;
  state: 'active' | 'empty' | 'off';
}

export type BidKingItemOriginalFieldKey = typeof BID_KING_ITEM_ORIGINAL_FIELD_KEYS[number];

export interface BidKingItemFieldAudit {
  covered: number;
  facts: BidKingItemRuntimeFact[];
  total: number;
}

export interface BidKingItemTypeRule {
  itemTypeIds: readonly number[];
  names: string[];
  showInAuction: boolean;
  showInTradingBuy: boolean;
  storeTypes: number[];
}

export function bidKingItemRuntimeFlags(
  item: BidKingItemRow,
  itemTypes: readonly BidKingItemTypeRow[] = ItemType
): BidKingItemRuntimeFlags {
  const typeRule = bidKingItemTypeRule(item, itemTypes);
  return {
    auctionable: item.is_auction > 0 || typeRule.showInAuction,
    exchangeable: item.exchangeId.length > 0,
    placeable: item.slot_type > 0 && item.item_type_ids.some((typeId) => typeId >= 100 && typeId <= 110),
    roomPriced: typeof item.room_price === 'number' && item.room_price > 0,
    saleable: item.is_sale > 0,
    showInCatalog: item.is_show > 0 || item.show_item.length > 0,
    tradable: item.is_tradable > 0 && typeRule.showInTradingBuy
  };
}

export function bidKingItemTypeRule(
  item: BidKingItemRow,
  itemTypes: readonly BidKingItemTypeRow[] = ItemType
): BidKingItemTypeRule {
  const rows = itemTypes.filter((type) => item.item_type_ids.includes(type.id));
  return {
    itemTypeIds: item.item_type_ids,
    names: rows.map((row) => bidKingItemTypeDisplayName(row) || row.type_name || String(row.id)),
    showInAuction: rows.some((row) => row.showin_auction > 0),
    showInTradingBuy: rows.some((row) => row.showin_tradingbuy > 0),
    storeTypes: [...new Set(rows.map((row) => row.store_type))]
  };
}

export function bidKingItemRuntimeFacts(item: BidKingItemRow): BidKingItemRuntimeFact[] {
  const flags = bidKingItemRuntimeFlags(item);
  return [
    fact('specified_obtain', '指定获取', item.specified_obtain.length > 0, matrixLabel(item.specified_obtain)),
    fact('show_item', '展示关联', item.show_item.length > 0, listLabel(item.show_item)),
    fact('collection', '套装编号', item.collection > 0, item.collection > 0 ? String(item.collection) : '无'),
    fact('rank7count', '七阶计数', item.rank7count > 0, item.rank7count > 0 ? String(item.rank7count) : '未参与'),
    fact('item_access', '准入条件', item.item_access.length > 0, listLabel(item.item_access)),
    fact('number', '数值档', item.number.length > 0, listLabel(item.number)),
    fact('cost', '成本项', item.cost.length > 0, listLabel(item.cost)),
    fact('exchangeId', '互市池', flags.exchangeable, listLabel(item.exchangeId)),
    fact('is_sale', '出售开关', flags.saleable, flags.saleable ? '可出售' : '不可出售'),
    fact('room_price', '包厢价', flags.roomPriced, flags.roomPriced ? String(item.room_price) : '未设置')
  ];
}

export function bidKingItemFieldAudit(item: BidKingItemRow): BidKingItemFieldAudit {
  const facts = BID_KING_ITEM_ORIGINAL_FIELD_KEYS.map((key) => {
    const detail = fieldDetail(item[key]);
    return fact(key, BID_KING_ITEM_FIELD_LABELS[key], !isEmptyFieldValue(item[key]), detail);
  });
  return {
    covered: facts.length,
    facts,
    total: BID_KING_ITEM_ORIGINAL_FIELD_KEYS.length
  };
}

export const BID_KING_ITEM_ORIGINAL_FIELD_KEYS = [
  'item_name',
  'item_nm',
  'item_desc',
  'item_type_id',
  'item_type_ids',
  'slot_type',
  'item_quality',
  'base_value',
  'in_case',
  'is_tradable',
  'binds_on_purchase',
  'is_auction',
  'auction_baseprice',
  'grid_count',
  'transaction_tax_rate',
  'max_stack_size',
  'max_per_listing',
  'collectible_item_type_id',
  'skills',
  'specified_obtain',
  'drop_group_id',
  'show_item',
  'icon_path',
  'icon_atlas',
  'collection',
  'rank7count',
  'item_access',
  'collection_coin',
  'number',
  'number_weight',
  'cost',
  'model_3D',
  'is_show',
  'exchangeId',
  'is_sale',
  'room_price'
] as const;

const BID_KING_ITEM_FIELD_LABELS: Record<BidKingItemOriginalFieldKey, string> = {
  auction_baseprice: '拍场底价',
  base_value: '基础价值',
  binds_on_purchase: '购入绑定',
  collection: '套装编号',
  collection_coin: '陈列收益',
  collectible_item_type_id: '收藏分类',
  cost: '成本项',
  drop_group_id: '掉落组',
  exchangeId: '互市池',
  grid_count: '占格数',
  icon_atlas: '图集',
  icon_path: '图标路径',
  in_case: '箱内标记',
  is_auction: '拍场开关',
  is_sale: '出售开关',
  is_show: '展示开关',
  is_tradable: '互市开关',
  item_access: '准入条件',
  item_desc: '描述键',
  item_name: '名称键',
  item_nm: '短名键',
  item_quality: '品质',
  item_type_id: '主类型',
  item_type_ids: '类型组',
  max_per_listing: '单笔上限',
  max_stack_size: '堆叠上限',
  model_3D: '3D模型',
  number: '数值档',
  number_weight: '数值权重',
  rank7count: '七阶计数',
  room_price: '包厢价',
  show_item: '展示关联',
  skills: '掌眼组',
  slot_type: '占位类型',
  specified_obtain: '指定获取',
  transaction_tax_rate: '交易税率'
};

function fact(key: string, label: string, active: boolean, detail: string): BidKingItemRuntimeFact {
  return {
    detail,
    key,
    label,
    state: active ? 'active' : detail === '无' || detail === '未设置' || detail === '未参与' ? 'empty' : 'off'
  };
}

function listLabel(values: readonly (number | string)[]): string {
  return values.length > 0 ? values.join('/') : '无';
}

function matrixLabel(values: readonly (readonly number[])[]): string {
  return values.length > 0 ? values.map((row) => row.join(':')).join(' / ') : '无';
}

function fieldDetail(value: BidKingItemRow[BidKingItemOriginalFieldKey]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '无';
    }
    if (value.every((entry) => Array.isArray(entry))) {
      return matrixLabel(value as readonly (readonly number[])[]);
    }
    return listLabel(value as readonly (number | string)[]);
  }
  if (value === '') {
    return '无';
  }
  return String(value);
}

function isEmptyFieldValue(value: BidKingItemRow[BidKingItemOriginalFieldKey]): boolean {
  if (value === '' || value === 0) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => (
      Array.isArray(entry)
        ? entry.length === 0 || entry.every((inner) => Number(inner) === 0)
        : Number(entry) === 0
    ));
  }
  return false;
}
