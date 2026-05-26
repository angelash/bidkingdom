import { Constant } from '@bitkingdom/bidking-compat';

export type BidKingConstantValue = string | number | readonly number[] | readonly (readonly number[])[];

export function constantRawValue(id: string): string | undefined {
  return Constant.find((row) => row.Id === id)?.Value;
}

export function constantNumber(id: string): number {
  const raw = constantRawValue(id);
  if (raw === undefined) {
    throw new Error(`Missing BidKing Constant.${id}`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric BidKing Constant.${id}: ${raw}`);
  }
  return value;
}

export function constantNumberArray(id: string): number[] {
  const parsed = parseConstantJson(id);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid number array BidKing Constant.${id}`);
  }
  return parsed.map((entry, index) => {
    const value = Number(entry);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number in BidKing Constant.${id}[${index}]`);
    }
    return value;
  });
}

export function constantNumberRows(id: string): number[][] {
  const parsed = parseConstantJson(id);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid number row BidKing Constant.${id}`);
  }
  return parsed.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`Invalid row in BidKing Constant.${id}[${rowIndex}]`);
    }
    return row.map((entry, columnIndex) => {
      const value = Number(entry);
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid number in BidKing Constant.${id}[${rowIndex}][${columnIndex}]`);
      }
      return value;
    });
  });
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
    throw new Error(`Missing BidKing Constant.${id}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON BidKing Constant.${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
