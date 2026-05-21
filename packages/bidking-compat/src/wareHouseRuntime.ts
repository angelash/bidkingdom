import type { BidKingItemRow, BidKingRawTableRow } from './schema';
import { bidKingItemTypeDisplayName, bidKingRawTableDisplayName } from './itemPackagingOverrides';
import { ItemType } from './tables/ItemType';
import { WareHouse } from './tables/WareHouse';

export interface BidKingWareHouseTypeRule {
  typeId: number;
  label: string;
  storeType: number;
}

export interface BidKingWareHouseRuntime {
  id: string;
  label: string;
  languageKey: string;
  itemTypeIds: number[];
  typeRules: BidKingWareHouseTypeRule[];
  sourceFields: Array<'WareHouse.house_name' | 'WareHouse.house_type'>;
}

export function bidKingWareHouseRuntime(row: BidKingRawTableRow = WareHouse[0]!): BidKingWareHouseRuntime {
  const itemTypeIds = parseNumberList(row.columns[4] ?? '');
  return {
    id: row.id,
    label: bidKingRawTableDisplayName(row),
    languageKey: row.columns[3] ?? '',
    itemTypeIds,
    typeRules: itemTypeIds.map((typeId) => {
      const typeRow = ItemType.find((candidate) => candidate.id === typeId);
      return {
        typeId,
        label: typeRow ? bidKingItemTypeDisplayName(typeRow) : `分类${typeId}`,
        storeType: typeRow?.store_type ?? 0
      };
    }),
    sourceFields: ['WareHouse.house_name', 'WareHouse.house_type']
  };
}

export function bidKingWareHouseRuntimeRows(): BidKingWareHouseRuntime[] {
  return WareHouse.map((row) => bidKingWareHouseRuntime(row));
}

export function bidKingWareHouseItemVisible(
  item: Pick<BidKingItemRow, 'item_type_ids'>,
  runtime: BidKingWareHouseRuntime = bidKingWareHouseRuntime()
): boolean {
  return item.item_type_ids.some((typeId) => runtime.itemTypeIds.includes(typeId));
}

export function bidKingWareHouseItemTypeLabels(
  item: Pick<BidKingItemRow, 'item_type_ids'>,
  runtime: BidKingWareHouseRuntime = bidKingWareHouseRuntime()
): string[] {
  return runtime.typeRules
    .filter((rule) => item.item_type_ids.includes(rule.typeId))
    .map((rule) => rule.label);
}

function parseNumberList(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
      .map((entry) => Math.trunc(entry));
  } catch {
    return [];
  }
}
