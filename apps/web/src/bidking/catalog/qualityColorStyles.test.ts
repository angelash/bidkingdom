import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('quality color styles', () => {
  it('keeps source quality 2 and 3 as fixed green and blue semantics', () => {
    expect(styles).toContain('--quality-color-2: #4ade80;');
    expect(styles).toContain('--quality-color-3: #38bdf8;');
    expect(styles).toContain('.rarity-common,');
    expect(styles).toContain('--item-quality-color: var(--quality-color-2);');
    expect(styles).toContain('.rarity-fine,');
    expect(styles).toContain('--item-quality-color: var(--quality-color-3);');
    expect(styles).toContain('.quality-filter-row .quality-2::before { border-color: var(--quality-color-2); }');
    expect(styles).toContain('.quality-filter-row .quality-3::before { border-color: var(--quality-color-3); }');
    expect(styles).toContain('.battle-item-token.quality-2 { color: var(--quality-color-2); }');
    expect(styles).toContain('.battle-item-token.quality-3 { color: var(--quality-color-3); }');
    expect(styles).toContain('.battle-scene-pocket-row span.filled.quality-2');
    expect(styles).toContain('border-color: rgba(var(--quality-rgb-2), 0.76);');
    expect(styles).toContain('.battle-scene-pocket-row span.filled.quality-3');
    expect(styles).toContain('border-color: rgba(var(--quality-rgb-3), 0.78);');
    expect(styles).toContain('.ceremony-warehouse-slot.rarity-common');
    expect(styles).toContain('border-color: rgba(var(--quality-rgb-2), 0.86);');
    expect(styles).toContain('.ceremony-warehouse-slot.rarity-fine');
    expect(styles).toContain('border-color: rgba(var(--quality-rgb-3), 0.88);');
  });

  it('applies fixed quality language to item-related cards across screens', () => {
    expect(styles).toContain('.cabinet-browser-slot[class*="rarity-"],');
    expect(styles).toContain('.warehouse-stock-grid button[class*="rarity-"],');
    expect(styles).toContain('.warehouse-detail-card[class*="rarity-"],');
    expect(styles).toContain('.shop-item-card[class*="rarity-"],');
    expect(styles).toContain('.config-table-panel article.market-item-card[class*="rarity-"],');
    expect(styles).toContain('.live-intel-item[class*="rarity-"],');
    expect(styles).toContain('.item-detail-view[class*="rarity-"] .item-detail-hero');
    expect(styles).toContain('.battle-final-latest[class*="rarity-"]');
  });
});
