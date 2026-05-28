import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import {
  bidKingItemDisplayName,
  bidKingItemTypeDisplayName,
  ItemType as bidKingItemTypes,
  itemFootprint,
  type BidKingItemRow
} from '@bitkingdom/bidking-compat';
import type { PlayerSnapshot, Rarity, SkillFeedEntry, WarehouseSlotView } from '@bitkingdom/shared';
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

const OPENING_MAP_INTRO_MS = 1600;
const OPENING_INTELLIGENCE_PANEL_MS = 4600;
const MARKET_INTEL_TIP_HOLD_MS = 1450;
const MARKET_INTEL_TIP_MOVE_MS = 600;
const MARKET_INTEL_TIP_SETTLE_MS = 300;
const MARKET_INTEL_STEP_MS = MARKET_INTEL_TIP_HOLD_MS + MARKET_INTEL_TIP_MOVE_MS + MARKET_INTEL_TIP_SETTLE_MS;
const MARKET_INTEL_ROW_VISIBLE_MS = MARKET_INTEL_TIP_HOLD_MS + MARKET_INTEL_TIP_MOVE_MS;

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
  const now = useMarketIntelNow();
  const cumulativeSkillEntries = useMemo(
    () => round ? marketIntelEntriesForDisplay(round.skillFeed ?? [], round.index + 1) : [],
    [round]
  );
  const currentRoundSkillEntries = useMemo(
    () => round ? currentRoundMarketIntelEntries(cumulativeSkillEntries, round.index + 1) : [],
    [cumulativeSkillEntries, round]
  );
  if (!round) {
    return <></>;
  }
  const showEstimate = !round.container.estimateHidden;
  const presentationDelayMs = openingPresentationDelayMs(round);
  const sequenceStartAt = currentRoundSkillEntries.length > 0
    ? Math.min(...currentRoundSkillEntries.map((entry) => entry.createdAt)) + presentationDelayMs
    : 0;
  const sequenceElapsedMs = currentRoundSkillEntries.length > 0
    ? now - sequenceStartAt
    : Number.POSITIVE_INFINITY;
  const sequenceTotalMs = currentRoundSkillEntries.length > 0
    ? (currentRoundSkillEntries.length - 1) * MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS
    : 0;
  const isSequencing = sequenceElapsedMs < sequenceTotalMs;
  const visibleCurrentSkillEntries = currentRoundSkillEntries.filter((_, index) => (
    !isSequencing || sequenceElapsedMs >= marketIntelRowVisibleAt(index)
  ));
  const visibleCurrentSkillEntryIds = new Set(visibleCurrentSkillEntries.map((entry) => entry.id));
  const visibleSkillEntries = cumulativeSkillEntries.filter((entry) => (
    entry.round < round.index + 1 || visibleCurrentSkillEntryIds.has(entry.id)
  ));
  const activeTip = isSequencing ? marketIntelActiveTip(currentRoundSkillEntries, sequenceElapsedMs) : undefined;
  return (
    <section className="market-intel-panel">
      <div className="intel-header">
        <span>{round.container.tags.join(' / ')}</span>
          <strong>{showEstimate ? `当前仓估中值：${Math.round((round.container.estimateMin + round.container.estimateMax) / 2).toLocaleString()}` : round.container.name}</strong>
      </div>
      {activeTip && (
        <div
          className={`market-intel-tip source-${activeTip.entry.source} ${activeTip.moving ? 'moving' : ''}`}
          key={activeTip.entry.id}
        >
          <i>{skillSourceName(activeTip.entry.source)}</i>
          <strong>{marketIntelTipTitle(activeTip.entry)}</strong>
          <span>{activeTip.entry.text}</span>
        </div>
      )}
      <div className="intel-list">
        {visibleSkillEntries.map((entry) => (
          <p className={`skill source-${entry.source}`} key={entry.id}>
            <em>{skillSourceName(entry.source)}</em>
            <span><strong>{entry.skillName}</strong>{entry.text}</span>
          </p>
        ))}
        {cumulativeSkillEntries.length > 0 && visibleSkillEntries.length === 0 && (
          <p>
            <em>情报</em>
            <span>正在揭示本轮情报。</span>
          </p>
        )}
        {cumulativeSkillEntries.length === 0 && (
          <p>
            <em>情报</em>
            <span>等待本轮情报披露。</span>
          </p>
        )}
      </div>
    </section>
  );
}

function useMarketIntelNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function marketIntelEntriesForDisplay(
  skillFeed: readonly SkillFeedEntry[],
  roundNumber: number
): SkillFeedEntry[] {
  const seen = new Set<string>();
  return skillFeed
    .filter((entry) => entry.round <= roundNumber)
    .sort((left, right) => (
      left.round - right.round
      || marketIntelSourceOrder(left.source) - marketIntelSourceOrder(right.source)
      || left.createdAt - right.createdAt
      || left.id.localeCompare(right.id)
    ))
    .filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
}

function currentRoundMarketIntelEntries(
  skillFeed: readonly SkillFeedEntry[],
  roundNumber: number
): SkillFeedEntry[] {
  return skillFeed.filter((entry) => entry.round === roundNumber);
}

function openingPresentationDelayMs(round: NonNullable<PlayerSnapshot['public']['currentRound']>): number {
  if (round.index !== 0) {
    return 0;
  }
  const mapIntroMs = (round.openingCandidates?.length ?? 0) > 1 ? OPENING_MAP_INTRO_MS : 0;
  const intelligencePanelMs = round.intelligenceClue ? OPENING_INTELLIGENCE_PANEL_MS : 0;
  return mapIntroMs + intelligencePanelMs;
}

function marketIntelSourceOrder(source: SkillFeedEntry['source']): number {
  const orders: Record<SkillFeedEntry['source'], number> = {
    map: 0,
    hero: 1,
    item: 2,
    manual: 3,
    auto: 4
  };
  return orders[source];
}

function marketIntelRowVisibleAt(index: number): number {
  return index * MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS;
}

function marketIntelActiveTip(
  entries: readonly SkillFeedEntry[],
  sequenceElapsedMs: number
): { entry: SkillFeedEntry; moving: boolean } | undefined {
  if (sequenceElapsedMs < 0) {
    return undefined;
  }
  for (let index = 0; index < entries.length; index++) {
    const start = index * MARKET_INTEL_STEP_MS;
    const end = start + MARKET_INTEL_ROW_VISIBLE_MS;
    if (sequenceElapsedMs >= start && sequenceElapsedMs < end) {
      const entry = entries[index];
      if (!entry) {
        return undefined;
      }
      return {
        entry,
        moving: sequenceElapsedMs >= start + MARKET_INTEL_TIP_HOLD_MS
      };
    }
  }
  return undefined;
}

function marketIntelTipTitle(entry: SkillFeedEntry): string {
  return `${entry.sourceName}：${entry.skillName}`;
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
