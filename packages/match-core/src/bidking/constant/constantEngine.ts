import { Constant } from '@bitkingdom/bidking-compat';

export type BidKingConstantValue = string | number | readonly number[] | readonly (readonly number[])[];

export function constantRawValue(id: string): string | undefined {
  return Constant.find((row) => row.Id === id)?.Value;
}

export function constantNumber(id: string, fallback = 0): number {
  const raw = constantRawValue(id);
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function constantNumberArray(id: string): number[] {
  const parsed = parseConstantJson(id);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(Number).filter((value) => Number.isFinite(value));
}

export function constantNumberRows(id: string): number[][] {
  const parsed = parseConstantJson(id);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map(Number).filter((value) => Number.isFinite(value)));
}

export function constantValue(id: string): BidKingConstantValue | undefined {
  const row = Constant.find((candidate) => candidate.Id === id);
  if (!row) {
    return undefined;
  }
  if (row.Type === 'int') {
    return constantNumber(id);
  }
  if (row.Type === 'int[]') {
    return constantNumberArray(id);
  }
  if (row.Type === 'int[][]') {
    return constantNumberRows(id);
  }
  return row.Value;
}

function parseConstantJson(id: string): unknown {
  const raw = constantRawValue(id);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
