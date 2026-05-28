export function formatChineseCompactCurrency(value: number): string {
  const rounded = normalizeCurrencyValue(value);
  const abs = Math.abs(rounded);
  if (abs >= 100_000_000) {
    return `${trimFixed(rounded / 100_000_000, abs >= 1_000_000_000 ? 1 : 2)}亿`;
  }
  if (abs >= 10_000) {
    return `${trimFixed(rounded / 10_000, abs >= 100_000 ? 0 : 1)}万`;
  }
  return rounded.toLocaleString();
}

export function formatChineseCoinAmount(value: number): string {
  return `${formatChineseCompactCurrency(value)} 铜钱`;
}

export function formatSignedChineseCompactCurrency(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatChineseCompactCurrency(value)}`;
}

function normalizeCurrencyValue(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function trimFixed(value: number, fractionDigits: number): string {
  return value
    .toFixed(fractionDigits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
}
