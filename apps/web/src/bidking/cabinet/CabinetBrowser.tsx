import { useState, type CSSProperties } from 'react';
import { Archive, Crown, Lock } from 'lucide-react';
import {
  Cabinet as bidKingCabinets,
  Item as bidKingCompatItems,
  WareHouse as bidKingWareHouses,
  bidKingCabinetDisplayDesc,
  bidKingCabinetDisplayName,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import type { PlayerProfile, Rarity } from '@bitkingdom/shared';
import { itemIconForKey } from '../../artAssets';
import { ItemTypeFilterStrip } from '../catalog/ItemTypeFilterStrip';
import {
  itemMatchesItemTypeFilter,
  type BidKingItemTypeFilterId
} from '../catalog/itemTypeFilterRuntime';

type CabinetItem = (typeof gameConfig.items)[number] & { bidKingQuality?: number; collectionCoinPerHour?: number };

interface CodexItemGroup {
  id: string;
  items: CabinetItem[];
  sample: CabinetItem;
  unlockedItems: CabinetItem[];
  unlockedCount: number;
  totalCount: number;
}

interface CabinetBrowserProps {
  items: CabinetItem[];
  profile: PlayerProfile;
  selectedItemId?: string;
  onSelectItem: (itemId: string) => void;
  onClearCabinetItem: (itemId: string) => void;
  onSetCabinetItem: (itemId: string) => void;
}

export function CabinetBrowser({
  items,
  profile,
  selectedItemId,
  onSelectItem,
  onClearCabinetItem,
  onSetCabinetItem
}: CabinetBrowserProps): JSX.Element {
  const unlockedIds = new Set(items.map((item) => item.id));
  const [typeFilter, setTypeFilter] = useState<BidKingItemTypeFilterId>('all');
  const filteredItems = items.filter((item) => itemMatchesItemTypeFilter(item.id, typeFilter, 'warehouse'));
  const groups = buildCodexItemGroups(filteredItems, unlockedIds);
  const selectedGroup = groups.find((group) => group.items.some((item) => item.id === selectedItemId)) ?? groups[0];
  const selectedItem = selectedGroup?.items.find((item) => item.id === selectedItemId) ?? selectedGroup?.sample;
  if (!selectedItem) {
    return (
      <div className="cabinet-browser">
        <ItemTypeFilterStrip selected={typeFilter} scope="warehouse" onSelect={setTypeFilter} />
        <div className="empty-state-panel">
          <Archive size={28} />
          <strong>收藏柜尚未陈列珍藏</strong>
          <p>拍卖结算后收录稀有或传说藏品，这里会出现可点选的展示位。</p>
        </div>
      </div>
    );
  }
  const activeCabinet = selectedItem ? cabinetForItem(selectedItem) : undefined;
  const placement = selectedItem && activeCabinet ? cabinetPlacementForItem(selectedItem, activeCabinet) : undefined;
  const wareHouse = bidKingWareHouses[0];
  const cabinetSet = new Set(profile.cabinetItemIds ?? []);
  const selectedIsPlaced = cabinetSet.has(selectedItem.id);
  const canPlaceSelected = !selectedIsPlaced && (placement?.accepted ?? true);
  return (
    <div className="cabinet-browser">
      {activeCabinet && (
        <section className="cabinet-config-strip">
          <strong>{bidKingCabinetDisplayName(activeCabinet)}</strong>
          <span>{bidKingCabinetDisplayDesc(activeCabinet)}{wareHouse ? ' · 珍阁库存' : ''}</span>
          <em>{qualityRequirementLabel(activeCabinet.quality_requirement)} · {cabinetPlaceLimit(activeCabinet)} 件陈列</em>
        </section>
      )}
      <ItemTypeFilterStrip selected={typeFilter} scope="warehouse" onSelect={setTypeFilter} />
      <div className="cabinet-browser-grid">
        {groups.map((group) => {
          const itemIcon = itemIconForKey(group.sample.iconKey);
          const shapeKey = shapeKeyForItem(group.sample);
          return (
            <button
              className={`cabinet-browser-slot rarity-${group.sample.rarity} shape-${shapeKey} ${selectedGroup?.id === group.id ? 'selected' : ''}`}
              key={group.id}
              onClick={() => onSelectItem(group.sample.id)}
              style={itemGridSpan(group.sample)}
              type="button"
            >
              {itemIcon ? <img src={itemIcon} alt="" loading="lazy" /> : <Crown size={18} />}
              <strong>{codexGroupName(group)}</strong>
              <span>{rarityName(group.sample.rarity)} · {shapeKey} · {group.unlockedCount}件</span>
            </button>
          );
        })}
      </div>
      <ItemDetailView
        item={selectedItem}
        unlocked
        variantItems={selectedGroup?.items}
        unlockedIds={unlockedIds}
        selectedItemId={selectedItem.id}
        onSelectItem={onSelectItem}
      />
      <section className="detail-block">
        <strong>陈列状态</strong>
        <p>
          当前收藏柜已陈列 {(profile.cabinetItemIds ?? []).length}/{activeCabinet ? cabinetPlaceLimit(activeCabinet) : '-'} 件，
          珍阁分类、品质门槛与容量已按珍宝局柜阁规则核验。
        </p>
        {placement && !placement.accepted && <p className="cabinet-placement-warning">{placement.reason}</p>}
        <div className="cabinet-action-row">
          <button disabled={!canPlaceSelected} onClick={() => onSetCabinetItem(selectedItem.id)} type="button">
            {cabinetButtonLabel(selectedIsPlaced, placement)}
          </button>
          <button disabled={!selectedIsPlaced} onClick={() => onClearCabinetItem(selectedItem.id)} type="button">
            移出陈列
          </button>
        </div>
      </section>
    </div>
  );
}

function ItemDetailView({
  item,
  unlocked,
  variantItems = [],
  unlockedIds,
  selectedItemId,
  onSelectItem
}: {
  item: CabinetItem;
  unlocked: boolean;
  variantItems?: CabinetItem[];
  unlockedIds?: Set<string>;
  selectedItemId?: string;
  onSelectItem?: (itemId: string) => void;
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
        <DetailStat label="真值" value={unlocked ? item.value.toLocaleString() : '待揭示'} />
        <DetailStat label="展示估值" value={unlocked ? item.displayValue.toLocaleString() : '待揭示'} />
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
      {variantItems.length > 1 && unlockedIds && onSelectItem && (
        <section className="variant-block">
          <strong>数值变体</strong>
          <div className="variant-grid">
            {variantItems.map((variant) => {
              const variantUnlocked = unlockedIds.has(variant.id);
              return (
                <button
                  className={`variant-chip ${selectedItemId === variant.id ? 'selected' : ''} ${variantUnlocked ? '' : 'locked'}`}
                  key={variant.id}
                  onClick={() => onSelectItem(variant.id)}
                  type="button"
                >
                  <span>{itemVariantLabel(variant)}</span>
                  <strong>{variantUnlocked ? `${variant.value.toLocaleString()} · ${shapeKeyForItem(variant)}` : '未点亮'}</strong>
                </button>
              );
            })}
          </div>
        </section>
      )}
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

function buildCodexItemGroups(items: CabinetItem[], unlockedIds: Set<string>): CodexItemGroup[] {
  const grouped = new Map<string, CabinetItem[]>();
  for (const item of items) {
    const key = codexGroupKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].map(([id, groupItems]) => {
    const sample = groupItems.find((item) => unlockedIds.has(item.id)) ?? groupItems[0]!;
    const unlockedItems = groupItems.filter((item) => unlockedIds.has(item.id));
    return {
      id,
      items: groupItems,
      sample,
      unlockedItems,
      unlockedCount: unlockedItems.length,
      totalCount: groupItems.length
    };
  });
}

function codexGroupKey(item: CabinetItem): string {
  const generated = /^item_(\d{3})_/.exec(item.id);
  return generated?.[1] ? `generated_${generated[1]}` : item.id;
}

function codexGroupName(group: CodexItemGroup): string {
  const generated = /^item_\d{3}_/.test(group.sample.id);
  return generated
    ? group.sample.name.replace(/^(残缺|旧藏|精工|稀世|传世|仿制)/, '').replace(/·[甲乙丙丁]$/, '')
    : group.sample.name;
}

function itemVariantLabel(item: CabinetItem): string {
  const generated = /^item_\d{3}_(junk|common|fine|rare|legendary|fake)_([abcd])$/.exec(item.id);
  if (!generated) {
    return item.name;
  }
  const variantNames: Record<string, string> = { a: '甲', b: '乙', c: '丙', d: '丁' };
  return `${rarityName(generated[1] as Rarity)}·${variantNames[generated[2]!] ?? generated[2]}`;
}

function shapeKeyForItem(item: Pick<CabinetItem, 'footprint'>): string {
  return `${item.footprint.w}x${item.footprint.h}`;
}

function compatItemForDefinition(item: Pick<CabinetItem, 'id'>): BidKingItemRow | undefined {
  const match = /^compat_(\d+)/.exec(item.id);
  const sourceId = match?.[1] ? Number(match[1]) : undefined;
  return sourceId ? bidKingCompatItems.find((row) => row.id === sourceId) : undefined;
}

function cabinetForItem(item: Pick<CabinetItem, 'id'>): (typeof bidKingCabinets)[number] | undefined {
  const source = compatItemForDefinition(item);
  if (!source) {
    return bidKingCabinets[0];
  }
  return bidKingCabinets.find((cabinet) => source.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)))
    ?? bidKingCabinets[0];
}

function cabinetPlacementForItem(
  item: Pick<CabinetItem, 'id'>,
  cabinet: (typeof bidKingCabinets)[number]
): { accepted: boolean; reason?: string } {
  const source = compatItemForDefinition(item);
  if (!source || cabinet.quality_requirement.length === 0 || cabinet.quality_requirement.includes(source.item_quality)) {
    return { accepted: true };
  }
  return {
    accepted: false,
    reason: `品质 ${source.item_quality} 未达到 ${bidKingCabinetDisplayName(cabinet)} 要求：${cabinet.quality_requirement.join('/')}`
  };
}

function cabinetButtonLabel(selectedIsPlaced: boolean, placement?: { accepted: boolean }): string {
  if (selectedIsPlaced) {
    return '已陈列';
  }
  if (placement && !placement.accepted) {
    return '品质不足';
  }
  return '陈列该藏品';
}

function cabinetPlaceLimit(cabinet: (typeof bidKingCabinets)[number]): number {
  const placeMax = cabinet.place_max > 0 ? cabinet.place_max : 15;
  const maxSlotLimit = cabinet.max_slot_limit > 0 ? cabinet.max_slot_limit : placeMax;
  return Math.min(placeMax, maxSlotLimit);
}

function qualityRequirementLabel(qualityRequirement: readonly number[]): string {
  return qualityRequirement.length > 0 ? `${qualityRequirement.join('-')} 品质` : '不限品质';
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
