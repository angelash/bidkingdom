import { UIWnd, bidKingUIWndRuntime } from '@bitkingdom/bidking-compat';
import type { BidKingUIWndRow, BidKingUIWndRuntime } from '@bitkingdom/bidking-compat';

export type BidKingWindowTarget =
  | 'app'
  | 'battle'
  | 'battle-prev'
  | 'shop'
  | 'mail'
  | 'mission'
  | 'rank'
  | 'guild'
  | 'friend'
  | 'market'
  | 'activity'
  | 'handbook'
  | 'package'
  | 'hero'
  | 'guide'
  | 'system';

export interface BidKingWindowRegistration {
  id: number;
  name: string;
  path: string;
  displayName: string;
  description: string;
  isMain: boolean;
  layer: number;
  bgm: readonly number[];
  closeBehavior: BidKingUIWndRuntime['closeBehavior'];
  commonSet: number;
  isBlur: boolean;
  navigationMode: BidKingUIWndRuntime['navigationMode'];
  resourceSet: readonly number[];
  runtime: BidKingUIWndRuntime;
  target: BidKingWindowTarget;
  row: BidKingUIWndRow;
}

export const bidKingOutgameHubWindowSources = {
  codex: 'HandBook_Main',
  tasks: 'Task_Main',
  rank: 'Rank_Main',
  cabinet: 'PackagePanel',
  trade: 'TradingExchange_Main',
  auctionHouse: 'AuctionPlacePanel_Main',
  shop: 'StorePanel',
  club: 'Party_Main',
  recharge: 'Purchase_Main',
  pass: 'BattlePass_Main',
  friend: 'Friend_Main',
  mail: 'Mail_Main',
  settings: 'Setting_Main',
  feedback: 'OnlineQA_Main',
  package: 'PackagePanel',
  bidder: 'HeroPanel'
} as const;

export type BidKingOutgameHubWindowKey = keyof typeof bidKingOutgameHubWindowSources;

export const bidKingOutgameHubTitles: Record<BidKingOutgameHubWindowKey, string> = {
  codex: '珍宝谱',
  tasks: '委托',
  rank: '名士榜',
  cabinet: '珍阁',
  trade: '市集',
  auctionHouse: '拍场',
  shop: '宝铺',
  club: '鉴宝会',
  recharge: '钱庄',
  pass: '珍宝令',
  friend: '同游',
  mail: '信札',
  settings: '章程',
  feedback: '呈报',
  package: '行囊',
  bidder: '竞买人'
};

export const implementedBidKingOutgameHubs = new Set<BidKingOutgameHubWindowKey>([
  'codex',
  'tasks',
  'rank',
  'cabinet',
  'shop',
  'trade',
  'auctionHouse',
  'club',
  'recharge',
  'pass',
  'mail',
  'friend',
  'settings',
  'feedback',
  'package',
  'bidder'
]);

export const bidKingWindowRegistry: readonly BidKingWindowRegistration[] = UIWnd.map((row) => {
  const runtime = bidKingUIWndRuntime(row);
  return {
    id: row.id,
    name: row.Name,
    path: row.Path,
    displayName: row.packaged_name,
    description: row.packaged_desc,
    isMain: runtime.isMain,
    layer: runtime.layer,
    bgm: runtime.bgm,
    closeBehavior: runtime.closeBehavior,
    commonSet: runtime.commonSet,
    isBlur: runtime.isBlur,
    navigationMode: runtime.navigationMode,
    resourceSet: runtime.resourceSet,
    runtime,
    target: targetForWindow(row),
    row
  };
});

export const mainBidKingWindows = bidKingWindowRegistry.filter((window) => window.isMain);

export function findBidKingWindow(sourceName: string): BidKingWindowRegistration | undefined {
  return bidKingWindowRegistry.find(
    (window) =>
      window.name === sourceName ||
      window.path.endsWith(sourceName) ||
      window.path.endsWith(`/${sourceName}`) ||
      window.path.includes(`/${sourceName}/`)
  );
}

export function sourcePathForOutgameHub(panel: BidKingOutgameHubWindowKey): string {
  const sourceName = bidKingOutgameHubWindowSources[panel];
  return findBidKingWindow(sourceName)?.path ?? sourceName;
}

export function titleForOutgameHub(panel: BidKingOutgameHubWindowKey): string {
  return bidKingOutgameHubTitles[panel];
}

export function isOutgameHubImplemented(panel: BidKingOutgameHubWindowKey): boolean {
  return implementedBidKingOutgameHubs.has(panel);
}

function targetForWindow(row: BidKingUIWndRow): BidKingWindowTarget {
  const source = `${row.Name} ${row.Path}`.toLowerCase();
  if (source.includes('battleprev')) {
    return 'battle-prev';
  }
  if (source.includes('battle')) {
    return 'battle';
  }
  if (source.includes('shop') || source.includes('store')) {
    return 'shop';
  }
  if (source.includes('mail')) {
    return 'mail';
  }
  if (source.includes('task') || source.includes('mission') || source.includes('achievement')) {
    return 'mission';
  }
  if (source.includes('rank')) {
    return 'rank';
  }
  if (source.includes('guild') || source.includes('party')) {
    return 'guild';
  }
  if (source.includes('friend')) {
    return 'friend';
  }
  if (source.includes('auction') || source.includes('exchange') || source.includes('trading') || source.includes('market')) {
    return 'market';
  }
  if (
    source.includes('activity') ||
    source.includes('pass') ||
    source.includes('gift') ||
    source.includes('pay') ||
    source.includes('purchase') ||
    source.includes('dlc')
  ) {
    return 'activity';
  }
  if (source.includes('handbook') || source.includes('itemdetail')) {
    return 'handbook';
  }
  if (source.includes('package') || source.includes('warehouse') || source.includes('bag') || source.includes('cabinet')) {
    return 'package';
  }
  if (source.includes('hero')) {
    return 'hero';
  }
  if (source.includes('guide')) {
    return 'guide';
  }
  if (
    source.includes('login') ||
    source.includes('loading') ||
    source.includes('message') ||
    source.includes('bubble') ||
    source.includes('setting') ||
    source.includes('sound') ||
    source.includes('language')
  ) {
    return 'system';
  }
  return 'app';
}
