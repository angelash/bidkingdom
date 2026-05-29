import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('quality color styles', () => {
  it('keeps source quality 2 and 3 as fixed green and blue semantics', () => {
    expect(styles).toContain('--quality-color-2: #4ade80;');
    expect(styles).toContain('--quality-color-3: #38bdf8;');
    expect(styles).toContain('.quality-filter-row .quality-2::before { border-color: var(--quality-color-2); }');
    expect(styles).toContain('.quality-filter-row .quality-3::before { border-color: var(--quality-color-3); }');
    expect(styles).toContain('.battle-item-token.quality-2 { color: var(--quality-color-2); }');
    expect(styles).toContain('.battle-item-token.quality-3 { color: var(--quality-color-3); }');
  });
});
