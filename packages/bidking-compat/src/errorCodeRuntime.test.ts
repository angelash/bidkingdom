import { describe, expect, it } from 'vitest';
import {
  bidKingErrorCodeForMessage,
  bidKingErrorCodeRuntime,
  stableErrorCodeIndex
} from './errorCodeRuntime';
import { ErrorCode } from './tables/ErrorCode';

describe('BidKing ErrorCode runtime helper', () => {
  it('builds stable API error records from ErrorCode rows', () => {
    const row = ErrorCode[0]!;
    const runtime = bidKingErrorCodeRuntime(row);
    const first = bidKingErrorCodeForMessage('竞拍票不足');
    const second = bidKingErrorCodeForMessage('竞拍票不足');

    expect(runtime.code).toBe(row.columns[3]);
    expect(runtime.messageKey).toBe(row.columns[1]);
    expect(first).toEqual(second);
    expect(stableErrorCodeIndex('竞拍票不足', ErrorCode.length)).toBe(Number(first.id));
  });
});
