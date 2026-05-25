import type { BidKingRawTableRow } from './schema';

export type BidKingPayServiceMode = 'external_payment_metadata';

export interface BidKingPayRuntime {
  payId: string;
  typeCode: number;
  descriptionKey: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  rmb: number;
  usd: number;
  orderDescriptionKey: string;
  iconKey: string;
  steamDescriptionKey: string;
  serviceMode: BidKingPayServiceMode;
  serviceModeLabel: string;
}

export function bidKingPayRuntime(row: BidKingRawTableRow): BidKingPayRuntime {
  const baseCoins = finiteNumber(row.columns[5]);
  const bonusCoins = finiteNumber(row.columns[8]);
  return {
    payId: row.id,
    typeCode: finiteNumber(row.columns[3]),
    descriptionKey: rawString(row.columns[4]),
    baseCoins,
    bonusCoins,
    totalCoins: baseCoins + bonusCoins,
    rmb: finiteNumber(row.columns[6]),
    usd: finiteNumber(row.columns[7]),
    orderDescriptionKey: rawString(row.columns[9]),
    iconKey: rawString(row.columns[10]),
    steamDescriptionKey: rawString(row.columns[11]),
    serviceMode: 'external_payment_metadata',
    serviceModeLabel: '外部支付元数据'
  };
}

function finiteNumber(raw: string | undefined): number {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function rawString(raw: string | undefined): string {
  return String(raw ?? '').trim();
}
