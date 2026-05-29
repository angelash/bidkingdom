import { gameConfig } from '@bitkingdom/config';
import {
  bidKingItemFieldAudit,
  bidKingItemDisplayName,
  bidKingItemRuntimeFacts,
  bidKingItemRuntimeFlags,
  bidKingItemTypeRule,
  Item as bidKingCompatItems,
  itemFootprint,
  type BidKingItemRuntimeFact,
  type BidKingItemRuntimeFlags,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';
import {
  liveIntelItemFromCompat,
  type LiveIntelItem
} from '../intel/LiveIntelPanels';
import { rarityFromSourceQuality } from './qualityVisuals';

export type CodexCatalogItem = (typeof gameConfig.items)[number] & {
  bidKingQuality?: number;
  collectionCoinPerHour?: number;
  fieldAudit?: ReturnType<typeof bidKingItemFieldAudit>;
  fieldFacts?: BidKingItemRuntimeFact[];
  interactionFlags?: BidKingItemRuntimeFlags;
  sourceItemId?: number;
  typeNames?: string[];
};

export const bidKingCollectionRows = bidKingCompatItems.filter(isBidKingCollectionItem);
export const bidKingLiveIntelItems: LiveIntelItem[] = bidKingCollectionRows.map(liveIntelItemFromCompat);
export const codexCatalogItems: CodexCatalogItem[] = bidKingCollectionRows.map(codexItemFromCompat);

function isBidKingCollectionItem(item: BidKingItemRow): boolean {
  return item.slot_type > 0 && item.item_type_ids.some((typeId) => typeId >= 100 && typeId <= 110);
}

function codexItemFromCompat(item: BidKingItemRow): CodexCatalogItem {
  const footprint = itemFootprint(item.slot_type);
  const rarity = rarityFromSourceQuality(item.item_quality) ?? 'junk';
  return {
    id: `compat_${item.id}`,
    name: bidKingItemDisplayName(item),
    category: item.packaged_category,
    rarity,
    value: item.base_value,
    displayValue: item.base_value,
    setId: item.collection > 0 ? `compat_collection_${item.collection}` : undefined,
    iconKey: item.packaged_icon_key,
    footprint,
    bidKingQuality: item.item_quality,
    collectionCoinPerHour: Number((item.collection_coin * 3600).toFixed(1)),
    fieldAudit: bidKingItemFieldAudit(item),
    fieldFacts: bidKingItemRuntimeFacts(item),
    interactionFlags: bidKingItemRuntimeFlags(item),
    sourceItemId: item.id,
    typeNames: bidKingItemTypeRule(item).names
  };
}
