import { useMemo, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import {
  bidKingItemDisplayName,
  bidKingItemTypeDisplayName,
  ItemType as bidKingItemTypes,
  itemFootprint,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';
import type { PlayerSnapshot, Rarity, WarehouseSlotView } from '@bitkingdom/shared';
import { itemIconForKey } from '../../artAssets';

export interface LiveIntelItem {
  id: string;
  name: string;
  category: string;
  rarity: Rarity;
  displayValue: number;
  iconKey: string;
  footprint: {
    w: number;
    h: number;
  };
}

export interface LiveIntelSeed {
  rarity: Rarity | 'all';
  category: string;
  shape: string;
  slotId?: string;
  slotLabel?: string;
}

interface LiveIntelModalProps {
  round: NonNullable<PlayerSnapshot['public']['currentRound']>;
  items: LiveIntelItem[];
  initialSeed?: LiveIntelSeed;
  onClose: () => void;
}

interface MarketIntelPanelProps {
  snapshot: PlayerSnapshot;
}

const intelCategoryOptions = bidKingItemTypes
  .filter((type) => type.id === 100 || (type.id >= 101 && type.id <= 110))
  .map((type) => bidKingItemTypeDisplayName(type));

export function LiveIntelModal({
  round,
  items,
  initialSeed,
  onClose
}: LiveIntelModalProps): JSX.Element {
  const [rarity, setRarity] = useState<Rarity | 'all'>(initialSeed?.rarity ?? 'all');
  const [category, setCategory] = useState(initialSeed?.category ?? 'all');
  const [shape, setShape] = useState(initialSeed?.shape ?? 'all');
  const categories = useMemo(() => orderedCategoriesFromItems(items), [items]);
  const shapeOptions = useMemo(() => [...new Set(items.map(shapeKeyForItem))].sort(compareShapeKeys), [items]);
  const filteredItems = items
    .filter((item) => rarity === 'all' || item.rarity === rarity)
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => shape === 'all' || shapeKeyForItem(item) === shape);
  const candidates = [...filteredItems].sort((left, right) => right.displayValue - left.displayValue).slice(0, 96);
  const minValue = filteredItems.length ? Math.min(...filteredItems.map((item) => item.displayValue)) : 0;
  const maxValue = filteredItems.length ? Math.max(...filteredItems.map((item) => item.displayValue)) : 0;
  const rarityOptions: Array<{ value: Rarity | 'all'; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'junk', label: rarityName('junk') },
    { value: 'common', label: rarityName('common') },
    { value: 'fine', label: rarityName('fine') },
    { value: 'rare', label: rarityName('rare') },
    { value: 'legendary', label: rarityName('legendary') },
    { value: 'mythic', label: rarityName('mythic') }
  ];

  return (
    <section className="modal-layer live-intel-layer">
      <div className="live-intel-modal">
        <header>
          <div>
            <span>{round.container.name}</span>
            <h3>掌眼情报</h3>
          </div>
          <button onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="live-intel-context">
          <div>
            <span>{initialSeed?.slotLabel ?? '全仓候选'}</span>
            <strong>{filteredItems.length} 件候选</strong>
          </div>
          <em>{filteredItems.length ? `${minValue.toLocaleString()} - ${maxValue.toLocaleString()}` : '暂无估值'}</em>
          <button
            type="button"
            onClick={() => {
              setRarity('all');
              setCategory('all');
              setShape('all');
            }}
          >
            重置筛选
          </button>
        </div>
        <div className="live-intel-filters">
          <div className="live-filter-group rarity-filter">
            <span>品质</span>
            <div>
              {rarityOptions.map((option) => (
                <button
                  className={rarity === option.value ? 'active' : ''}
                  key={option.value}
                  onClick={() => setRarity(option.value)}
                  type="button"
                >
                  <i className={`rarity-dot rarity-${option.value}`} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="live-filter-group category-filter">
            <span>类别</span>
            <div>
              <button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')} type="button">全部</button>
              {categories.map((value) => (
                <button className={category === value ? 'active' : ''} onClick={() => setCategory(value)} key={value} type="button">
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="live-filter-group shape-filter">
            <span>轮廓</span>
            <div>
              <button className={shape === 'all' ? 'active' : ''} onClick={() => setShape('all')} type="button">全部</button>
              {shapeOptions.map((value) => (
                <button className={shape === value ? 'active' : ''} onClick={() => setShape(value)} key={value} type="button">
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="live-intel-list">
          {candidates.map((item) => (
            <div className="live-intel-item" key={item.id}>
              <img src={itemIconForKey(item.iconKey)} alt="" loading="lazy" />
              <div>
                <strong>{item.name}</strong>
                <span>{item.category} · {rarityName(item.rarity)} · {shapeKeyForItem(item)}</span>
              </div>
              <span className="intel-shape-mini" style={{ '--w': item.footprint.w, '--h': item.footprint.h } as CSSProperties} />
              <em>{item.displayValue.toLocaleString()}</em>
            </div>
          ))}
          {candidates.length === 0 && <p className="muted">没有符合当前筛选的候选藏品</p>}
        </div>
      </div>
    </section>
  );
}

export function MarketIntelPanel({ snapshot }: MarketIntelPanelProps): JSX.Element {
  const round = snapshot.public.currentRound;
  if (!round) {
    return <></>;
  }
  const showEstimate = !round.container.estimateHidden;
  const publicClues = round.publicClues.slice(-2);
  const privateClues = (snapshot.private?.privateClues ?? []).slice(-1);
  const skillEntries = (round.skillFeed ?? [])
    .filter((entry) => entry.round === round.index + 1)
    .slice(-3);
  return (
    <section className="market-intel-panel">
      <div className="intel-header">
        <span>{round.container.tags.join(' / ')}</span>
          <strong>{showEstimate ? `当前仓估中值：${Math.round((round.container.estimateMin + round.container.estimateMax) / 2).toLocaleString()}` : round.container.name}</strong>
      </div>
      <div className="intel-list">
        {publicClues.map((clue) => (
          <p key={clue.id}>
            <em>{clueSourceName(clue.source)}</em>
            <span>{clue.text}</span>
          </p>
        ))}
        {privateClues.map((clue) => (
          <p className="private" key={clue.id}>
            <em>{clueSourceName(clue.source)}</em>
            <span>{clue.text}</span>
          </p>
        ))}
        {skillEntries.map((entry) => (
          <p className="skill" key={entry.id}>
            <em>{skillSourceName(entry.source)}</em>
            <span><strong>{entry.skillName}</strong>{entry.text}</span>
          </p>
        ))}
        {publicClues.length + privateClues.length + skillEntries.length === 0 && (
          <p>
            <em>情报</em>
            <span>等待本轮情报披露。</span>
          </p>
        )}
      </div>
    </section>
  );
}

export function liveIntelItemFromCompat(item: BidKingItemRow): LiveIntelItem {
  return {
    id: `compat_${item.id}`,
    name: bidKingItemDisplayName(item),
    category: item.packaged_category,
    rarity: rarityFromCompatItem(item),
    displayValue: item.base_value,
    iconKey: item.packaged_icon_key,
    footprint: itemFootprint(item.slot_type)
  };
}

export function liveIntelSeedFromSlot(slot: WarehouseSlotView): LiveIntelSeed {
  const slotLabel = slot.itemName
    ?? slot.visibleCategory
    ?? (slot.visibleRarity ? `${rarityName(slot.visibleRarity)}藏品格` : '未知藏品格');
  return {
    rarity: slot.visibleRarity ?? 'all',
    category: slot.visibleCategory ?? 'all',
    shape: slot.visibleShape ? `${Math.max(1, slot.w)}x${Math.max(1, slot.h)}` : 'all',
    slotId: slot.slotId,
    slotLabel
  };
}

function orderedCategoriesFromItems(items: Array<{ category: string }>): string[] {
  const availableCategories = new Set(items.map((item) => item.category));
  return intelCategoryOptions.filter((category) => availableCategories.has(category));
}

function shapeKeyForItem(item: Pick<LiveIntelItem, 'footprint'>): string {
  return `${item.footprint.w}x${item.footprint.h}`;
}

function compareShapeKeys(left: string, right: string): number {
  const [leftW = 1, leftH = 1] = left.split('x').map(Number);
  const [rightW = 1, rightH = 1] = right.split('x').map(Number);
  return leftW * leftH - rightW * rightH || leftW - rightW || leftH - rightH;
}

function clueSourceName(source: string): string {
  const names: Record<string, string> = {
    public: '公共',
    private: '私有',
    skill: '掌眼'
  };
  return names[source] ?? source;
}

function skillSourceName(source: string): string {
  const names: Record<string, string> = {
    map: '场地',
    hero: '名士',
    item: '试宝令',
    manual: '过程',
    auto: '自动'
  };
  return names[source] ?? '掌眼';
}

function rarityFromCompatItem(item: BidKingItemRow): Rarity {
  if (item.item_quality <= 1) {
    return 'junk';
  }
  if (item.item_quality === 2) {
    return 'common';
  }
  if (item.item_quality === 3) {
    return 'fine';
  }
  if (item.item_quality === 4) {
    return 'rare';
  }
  if (item.item_quality === 5) {
    return 'legendary';
  }
  return 'mythic';
}

function rarityName(rarity: Rarity): string {
  const names: Record<Rarity, string> = {
    junk: '普通',
    common: '良品',
    fine: '精品',
    rare: '稀有',
    legendary: '传说',
    mythic: '典藏'
  };
  return names[rarity];
}
