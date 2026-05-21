import { ErrorCode } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import {
  bidKingErrorCodeStyle,
  bidKingToastErrorStyle
} from './errorCodeStyleRuntime';

describe('BidKing ErrorCode style runtime', () => {
  it('maps ErrorCode rows to stable business style groups', () => {
    expect(bidKingErrorCodeStyle(ErrorCode.find((row) => row.id === '0')!)).toEqual(expect.objectContaining({
      className: 'error-tone-info',
      label: '通用提示',
      tone: 'info'
    }));
    expect(bidKingErrorCodeStyle(ErrorCode.find((row) => row.id === '70')!)).toEqual(expect.objectContaining({
      className: 'error-tone-warning',
      label: '业务校验',
      tone: 'warning'
    }));
    expect(bidKingErrorCodeStyle(ErrorCode.find((row) => row.id === '102')!)).toEqual(expect.objectContaining({
      className: 'error-tone-danger',
      label: '阻断',
      tone: 'danger'
    }));
  });

  it('reuses the same style groups for toast error envelopes', () => {
    expect(bidKingToastErrorStyle('CODE_103 · 铜钱不足').tone).toBe('danger');
    expect(bidKingToastErrorStyle('准备连接拍卖场...').tone).toBe('info');
  });
});
