import type { BidKingRawTableRow } from './schema';
import { ErrorCode } from './tables/ErrorCode';

export interface BidKingErrorCodeRuntime {
  code: string;
  id: string;
  messageKey: string;
  name: string;
  row: BidKingRawTableRow;
}

export function bidKingErrorCodeRuntime(row: BidKingRawTableRow): BidKingErrorCodeRuntime {
  return {
    code: row.columns[3] || row.id || 'CODE_0',
    id: row.id,
    messageKey: row.columns[1] || '',
    name: row.packaged_name || `错误码${row.id}`,
    row
  };
}

export function bidKingErrorCodeForMessage(message: string): BidKingErrorCodeRuntime {
  const row = ErrorCode[stableErrorCodeIndex(message, ErrorCode.length)] ?? ErrorCode[0]!;
  return bidKingErrorCodeRuntime(row);
}

export function stableErrorCodeIndex(value: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}
