import { describe, expect, it } from 'vitest';
import {
  formatChineseCoinAmount,
  formatChineseCompactCurrency,
  formatSignedChineseCompactCurrency
} from './currencyFormat';

describe('BidKing currency formatting', () => {
  it('uses Chinese compact units for wallet-scale values', () => {
    expect(formatChineseCompactCurrency(0)).toBe('0');
    expect(formatChineseCompactCurrency(9_999)).toBe('9,999');
    expect(formatChineseCompactCurrency(10_000)).toBe('1万');
    expect(formatChineseCompactCurrency(10_500)).toBe('1.1万');
    expect(formatChineseCompactCurrency(2_000_000)).toBe('200万');
    expect(formatChineseCompactCurrency(123_456_789)).toBe('1.23亿');
    expect(formatChineseCompactCurrency(1_000_000_000)).toBe('10亿');
  });

  it('keeps signs and coin unit labels outside the compact value', () => {
    expect(formatSignedChineseCompactCurrency(25_000)).toBe('+2.5万');
    expect(formatSignedChineseCompactCurrency(-25_000)).toBe('-2.5万');
    expect(formatChineseCoinAmount(2_000_000)).toBe('200万 铜钱');
  });
});
