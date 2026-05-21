import { useState, type ReactNode } from 'react';
import { BookOpen, Crown } from 'lucide-react';
import {
  ItemType as bidKingItemTypes,
  bidKingItemTypeDisplayName,
  type BidKingItemRuntimeFact,
  type BidKingItemRuntimeFlagKey,
  type BidKingItemRuntimeFlags,
  type BidKingItemFieldAudit
} from '@bitkingdom/bidking-compat';
import { itemIconForKey } from '../../artAssets';
import { FullScreenPanel } from '../ui/FullScreenPanel';

interface HandbookItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  displayValue: number;
  fieldAudit?: BidKingItemFieldAudit;
  iconKey: string;
  bidKingQuality?: number;
  fieldFacts?: BidKingItemRuntimeFact[];
  footprint: {
    w: number;
    h: number;
  };
  interactionFlags?: BidKingItemRuntimeFlags;
  sourceItemId?: number;
  typeNames?: string[];
}

interface HandBookPanelProps {
  items: HandbookItem[];
  onClose: () => void;
}

const handbookShapeOptions = Array.from({ length: 6 }, (_, wIndex) =>
  Array.from({ length: 6 }, (_, hIndex) => `${wIndex + 1}x${hIndex + 1}`)
).flat();

const handbookCategoryOptions = bidKingItemTypes
  .filter((type) => type.id === 100 || (type.id >= 101 && type.id <= 110))
  .map((type) => bidKingItemTypeDisplayName(type));

export function HandBookPanel({ items, onClose }: HandBookPanelProps): JSX.Element {
  const [quality, setQuality] = useState<number | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [runtimeFlag, setRuntimeFlag] = useState<BidKingItemRuntimeFlagKey | 'all'>('all');
  const [shape, setShape] = useState('all');
  const [query, setQuery] = useState('');
  const categories = orderedCategoriesFromItems(items);
  const filteredItems = items
    .filter((item) => quality === 'all' || item.bidKingQuality === quality)
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => runtimeFlag === 'all' || item.interactionFlags?.[runtimeFlag])
    .filter((item) => shape === 'all' || shapeKeyForItem(item) === shape)
    .filter((item) =>
      !query.trim() ||
      item.name.includes(query.trim()) ||
      item.category.includes(query.trim()) ||
      item.typeNames?.some((name) => name.includes(query.trim()))
    );
  const averageValue = filteredItems.length
    ? Math.round(filteredItems.reduce((sum, item) => sum + item.displayValue, 0) / filteredItems.length)
    : 0;

  return (
    <FullScreenPanel icon={<BookOpen size={32} />} title="藏品百科" english="ENCYCLOPEDIA" onClose={onClose}>
      <section className="handbook-layout">
        <aside className="handbook-filter-panel">
          <FilterSection title="藏品品阶" value={quality === 'all' ? '全部' : qualityLabel(quality)} isAll={quality === 'all'} onReset={() => setQuality('all')}>
            <div className="quality-filter-row">
              {([1, 2, 3, 4, 5, 6] as const).map((entry) => (
                <button
                  className={`${quality === entry ? 'selected' : ''} quality-${entry}`}
                  key={entry}
                  onClick={() => setQuality(entry)}
                  title={qualityLabel(entry)}
                  type="button"
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection title="珍物门类" value={category === 'all' ? '全部' : category} isAll={category === 'all'} onReset={() => setCategory('all')}>
            <div className="category-filter-grid">
              {categories.map((entry) => (
                <button className={category === entry ? 'selected' : ''} key={entry} onClick={() => setCategory(entry)} title={entry} type="button">
                  <span>{categoryButtonLabel(entry)}</span>
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection title="陈列占位（长×宽）" value={shape === 'all' ? '全部' : shapeLabel(shape)} isAll={shape === 'all'} onReset={() => setShape('all')}>
            <div className="shape-filter-grid">
              {handbookShapeOptions.map((entry) => (
                <button className={shape === entry ? 'selected' : ''} key={entry} onClick={() => setShape(entry)} title={shapeLabel(entry)} type="button">
                  <SlotGridIcon shape={entry} />
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection
            title="玩法标记"
            value={runtimeFlag === 'all' ? '全部' : runtimeFlagLabel(runtimeFlag)}
            isAll={runtimeFlag === 'all'}
            onReset={() => setRuntimeFlag('all')}
          >
            <div className="runtime-filter-grid">
              {runtimeFlagOptions.map((entry) => (
                <button
                  className={runtimeFlag === entry ? 'selected' : ''}
                  key={entry}
                  onClick={() => setRuntimeFlag(entry)}
                  title={runtimeFlagLabel(entry)}
                  type="button"
                >
                  <span>{runtimeFlagLabel(entry)}</span>
                </button>
              ))}
            </div>
          </FilterSection>
        </aside>

        <section className="handbook-result-panel">
          <header className="handbook-result-header">
            <span>当前筛选藏品平均价值为 {averageValue.toLocaleString()}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索藏品" />
          </header>
          <div className="handbook-card-grid">
            {filteredItems.map((item) => {
              const icon = itemIconForKey(item.iconKey);
              return (
                <article className={`handbook-card rarity-${item.rarity}`} key={item.id}>
                  <strong>{item.name}</strong>
                  <div className="handbook-card-art">
                    {icon ? <img src={icon} alt="" loading="lazy" /> : <Crown size={42} />}
                  </div>
                  <SlotGridIcon className="handbook-shape" shape={shapeKeyForItem(item)} />
                  <div className="handbook-runtime-tags">
                    {runtimeTagsForItem(item).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  {item.fieldAudit && (
                    <span
                      className="handbook-field-coverage"
                      title={item.fieldAudit.facts.map((fact) => `${fact.label}:${fact.detail}`).join('\n')}
                    >
                      档案完整 {item.fieldAudit.covered}/{item.fieldAudit.total}
                    </span>
                  )}
                  <ul className="handbook-field-facts">
                    {(item.fieldFacts ?? []).filter((fact) => fact.state === 'active').slice(0, 3).map((fact) => (
                      <li key={fact.key}>
                        <span>{fact.label}</span>
                        <strong>{fact.detail}</strong>
                      </li>
                    ))}
                  </ul>
                  <em>{item.displayValue.toLocaleString()}</em>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </FullScreenPanel>
  );
}

const runtimeFlagOptions: BidKingItemRuntimeFlagKey[] = [
  'tradable',
  'auctionable',
  'placeable',
  'exchangeable',
  'saleable',
  'roomPriced'
];

function FilterSection({
  title,
  value,
  children,
  isAll,
  onReset
}: {
  title: string;
  value: string;
  children: ReactNode;
  isAll: boolean;
  onReset: () => void;
}): JSX.Element {
  return (
    <section className="filter-section">
      <header>
        <span>{title}</span>
        <strong>{value}</strong>
        <button
          className={`filter-all-button ${isAll ? 'selected' : ''}`}
          onClick={onReset}
          title="全部"
          type="button"
        >
          <span />
        </button>
      </header>
      {children}
    </section>
  );
}

function orderedCategoriesFromItems(items: Array<{ category: string }>): string[] {
  const availableCategories = new Set(items.map((item) => item.category));
  return handbookCategoryOptions.filter((category) => availableCategories.has(category));
}

function categoryButtonLabel(category: string): string {
  return category.length > 2 ? `${category.slice(0, 2)}\n${category.slice(2)}` : category;
}

function parseShapeKey(shape: string): { w: number; h: number } {
  const [wRaw, hRaw] = shape.split('x');
  return {
    w: Math.max(1, Math.min(6, Number(wRaw) || 1)),
    h: Math.max(1, Math.min(6, Number(hRaw) || 1))
  };
}

function shapeLabel(shape: string): string {
  const { w, h } = parseShapeKey(shape);
  return `${w}×${h}`;
}

function qualityLabel(quality: number): string {
  const labels: Record<number, string> = {
    1: '普通',
    2: '良品',
    3: '精品',
    4: '稀有',
    5: '传说',
    6: '典藏'
  };
  return labels[quality] ?? `品质${quality}`;
}

function runtimeFlagLabel(flag: BidKingItemRuntimeFlagKey): string {
  const labels: Record<BidKingItemRuntimeFlagKey, string> = {
    auctionable: '可拍卖',
    exchangeable: '可兑换',
    placeable: '可陈列',
    roomPriced: '包厢价',
    saleable: '可出售',
    showInCatalog: '珍宝谱',
    tradable: '可互市'
  };
  return labels[flag];
}

function runtimeTagsForItem(item: Pick<HandbookItem, 'interactionFlags'>): string[] {
  const flags = item.interactionFlags;
  if (!flags) {
    return [];
  }
  return runtimeFlagOptions.filter((flag) => flags[flag]).map(runtimeFlagLabel);
}

function SlotGridIcon({ shape, className = '' }: { shape: string; className?: string }): JSX.Element {
  const { w, h } = parseShapeKey(shape);
  return (
    <span className={`slot-grid-icon ${className}`} aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => {
        const col = index % 6 + 1;
        const row = Math.floor(index / 6) + 1;
        return <i className={col <= w && row <= h ? 'lit' : ''} key={index} />;
      })}
    </span>
  );
}

function shapeKeyForItem(item: Pick<HandbookItem, 'footprint'>): string {
  return `${item.footprint.w}x${item.footprint.h}`;
}
