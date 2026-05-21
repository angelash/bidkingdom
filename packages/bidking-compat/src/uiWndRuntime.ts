import type { BidKingUIWndRow } from './schema';
import { UIWnd } from './tables/UIWnd';

export type BidKingUIWndNavigationMode = 'main' | 'modal' | 'overlay' | 'panel';

export interface BidKingUIWndRuntime {
  bgm: readonly number[];
  closeBehavior: 'back' | 'close' | 'replace';
  commonSet: number;
  hasBgm: boolean;
  hasResourceSet: boolean;
  id: number;
  isBlur: boolean;
  isMain: boolean;
  layer: number;
  name: string;
  navigationMode: BidKingUIWndNavigationMode;
  path: string;
  resourceSet: readonly number[];
}

export function bidKingUIWndRuntime(row: BidKingUIWndRow): BidKingUIWndRuntime {
  const isMain = row.IsMainWnd === 1;
  const isBlur = row.IsBlur === 1;
  return {
    bgm: row.BGM,
    closeBehavior: isMain ? 'replace' : isBlur || row.Layer > 1 ? 'close' : 'back',
    commonSet: row.CommonSet,
    hasBgm: row.BGM.some((entry) => entry > 0),
    hasResourceSet: row.ResSet.some((entry) => entry > 0),
    id: row.id,
    isBlur,
    isMain,
    layer: row.Layer,
    name: row.Name,
    navigationMode: navigationModeForRow(row, isMain, isBlur),
    path: row.Path,
    resourceSet: row.ResSet
  };
}

export function bidKingUIWndRuntimeRows(rows: readonly BidKingUIWndRow[] = UIWnd): BidKingUIWndRuntime[] {
  return rows.map(bidKingUIWndRuntime);
}

export function findBidKingUIWndRuntime(sourceName: string): BidKingUIWndRuntime | undefined {
  const normalized = sourceName.toLowerCase();
  const row = UIWnd.find((candidate) =>
    candidate.Name.toLowerCase() === normalized ||
    candidate.Path.toLowerCase().endsWith(normalized) ||
    candidate.Path.toLowerCase().includes(`/${normalized}/`)
  );
  return row ? bidKingUIWndRuntime(row) : undefined;
}

function navigationModeForRow(
  row: BidKingUIWndRow,
  isMain: boolean,
  isBlur: boolean
): BidKingUIWndNavigationMode {
  if (isMain) {
    return 'main';
  }
  if (isBlur || row.Layer > 1) {
    return 'modal';
  }
  if (row.Layer < 0) {
    return 'overlay';
  }
  return 'panel';
}
