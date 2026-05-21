export interface PackageIncomeMotion {
  amount: number;
  key: string;
  label: string;
  ariaLabel: string;
}

export function createPackageIncomeMotion(claimableCoins: number, now = Date.now()): PackageIncomeMotion | undefined {
  const amount = Math.max(0, Math.floor(claimableCoins));
  if (amount <= 0) {
    return undefined;
  }
  const formatted = amount.toLocaleString();
  return {
    amount,
    key: `${now}_${amount}`,
    label: `+${formatted}`,
    ariaLabel: `收藏柜收益 ${formatted} 铜钱`
  };
}
