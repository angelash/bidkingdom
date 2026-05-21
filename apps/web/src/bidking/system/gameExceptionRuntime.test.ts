import { describe, expect, it } from 'vitest';
import {
  createGameExceptionRecord,
  exceptionActionLabel,
  mergeGameExceptionRecord
} from './gameExceptionRuntime';

describe('BidKing game exception runtime', () => {
  it('opens blocking room failures as return-home modal records', () => {
    const record = createGameExceptionRecord({
      kind: 'room',
      message: '房间不存在，请重新开局',
      tone: 'danger'
    }, 1000);
    expect(record.action).toBe('return_home');
    expect(record.modal).toBe(true);
    expect(record.title).toBe('操作被阻断');
  });

  it('keeps repeated server errors under one active key', () => {
    const first = createGameExceptionRecord({
      message: 'CODE_103 · 铜钱不足'
    }, 1000);
    const merged = mergeGameExceptionRecord(first, {
      message: 'CODE_103 · 铜钱不足'
    }, 1200);
    expect(merged.key).toBe(first.key);
    expect(merged.count).toBe(2);
    expect(merged.tone).toBe('danger');
  });

  it('has stable labels for exception actions', () => {
    expect(exceptionActionLabel('request_snapshot')).toBe('重新同步');
    expect(exceptionActionLabel('return_home')).toBe('返回主界面');
  });
});
