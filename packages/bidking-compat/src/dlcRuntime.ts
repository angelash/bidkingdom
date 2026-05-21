import type { BidKingRawTableRow } from './schema';

export type BidKingDlcServiceMode = 'local_simulated_platform_unlock';

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
    serviceMode: 'local_simulated_platform_unlock',
    serviceModeLabel: '本地模拟平台解锁',
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
