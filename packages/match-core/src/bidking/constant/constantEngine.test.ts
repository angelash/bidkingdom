import { describe, expect, it } from 'vitest';
import { Constant } from '@bitkingdom/bidking-compat';
import { constantNumber, constantNumberArray, constantNumberRows, constantRawValue, constantValue } from './constantEngine';

describe('constantEngine', () => {
  it('reads scalar constants', () => {
    expect(constantNumber('initial_warehouse_capacity')).toBe(50);
    expect(constantValue('initial_warehouse_capacity')).toBe(50);
  });

  it('reads number array constants', () => {
    expect(constantNumberArray('guide_bidmaps')).toEqual([2301, 2303]);
  });

  it('reads number row constants', () => {
    expect(constantNumberRows('init_items')[0]).toEqual([6, 6001, 1]);
  });

  it('keeps raw values available for unsupported constant types', () => {
    expect(constantRawValue('init_head')).toBe('120000');
  });

  it('covers every Constant value type in the synchronized table', () => {
    const valueTypes = [...new Set(Constant.map((row) => row.Type))].sort();
    expect(valueTypes).toEqual(['bool', 'int', 'int[]', 'int[][]', 'string']);
    expect(constantValue('sys_apply_lock')).toBe('0');
    expect(constantValue('vip_pass_bg')).toBe('vip_pass_bg_1');
  });
});
