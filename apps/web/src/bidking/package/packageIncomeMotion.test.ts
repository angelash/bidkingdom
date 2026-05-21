import { describe, expect, it } from 'vitest';
import { createPackageIncomeMotion } from './packageIncomeMotion';

describe('package income motion', () => {
  it('formats claimable Cabinet income for the reward burst', () => {
    expect(createPackageIncomeMotion(12800, 1000)).toEqual({
      amount: 12800,
      key: '1000_12800',
      label: '+12,800',
      ariaLabel: '收藏柜收益 12,800 铜钱'
    });
  });

  it('stays inactive when Cabinet income is not claimable', () => {
    expect(createPackageIncomeMotion(0, 1000)).toBeUndefined();
    expect(createPackageIncomeMotion(-10, 1000)).toBeUndefined();
  });
});
