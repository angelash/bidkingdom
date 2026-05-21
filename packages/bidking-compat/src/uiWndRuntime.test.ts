import { describe, expect, it } from 'vitest';
import {
  bidKingUIWndRuntime,
  bidKingUIWndRuntimeRows,
  findBidKingUIWndRuntime
} from './uiWndRuntime';
import { UIWnd } from './tables/UIWnd';

describe('BidKing UIWnd runtime helper', () => {
  it('explains layer, blur, BGM, resource, and navigation semantics for every UIWnd row', () => {
    const runtimes = bidKingUIWndRuntimeRows();
    const mainWindow = UIWnd.find((row) => row.IsMainWnd === 1)!;
    const modalWindow = UIWnd.find((row) => row.IsBlur === 1 || row.Layer > 1)!;

    expect(runtimes).toHaveLength(UIWnd.length);
    expect(bidKingUIWndRuntime(mainWindow).navigationMode).toBe('main');
    expect(bidKingUIWndRuntime(modalWindow).closeBehavior).toBe('close');
    expect(findBidKingUIWndRuntime(mainWindow.Name)?.id).toBe(mainWindow.id);
    expect(runtimes.every((runtime) => runtime.path.length > 0 && runtime.name.length > 0)).toBe(true);
  });
});
