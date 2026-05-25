import type { BidKingRawTableRow } from './schema';

export type BidKingDlcServiceMode = 'external_platform_entitlement';

export interface BidKingDlcRuntime {
  dlcId: string;
  platformSku: string;
  typeCode: number;
  rewardRows: number[][];
  mailTemplateId?: string;
  serviceMode: BidKingDlcServiceMode;
  serviceModeLabel: string;
  price: number;
}

export function bidKingDlcRuntime(row: BidKingRawTableRow): BidKingDlcRuntime {
  const mailTemplateId = String(row.columns[5] ?? '').trim() || undefined;
  return {
    dlcId: row.id,
    platformSku: row.id,
    typeCode: Number(row.columns[3] ?? 0) || 0,
    rewardRows: parseRawNumberRows(row.columns[4] ?? ''),
    mailTemplateId,
    serviceMode: 'external_platform_entitlement',
    serviceModeLabel: '外部平台权益',
    price: 0
  };
}

function parseRawNumberRows(raw: string): number[][] {
  if (!raw || raw === '[[]]') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
      .filter((row) => row.length > 0);
  } catch {
    return [];
  }
}
