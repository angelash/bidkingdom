import {
  BidMap as bidKingBidMaps,
  bidKingBidMapDisplayName,
  Map as bidKingMaps,
  type BidKingBidMapRow,
  type BidKingMapRow
} from '@bitkingdom/bidking-compat';
import type { CoreAuctionMode } from '@bitkingdom/shared';
import type { BidKingBattleMapGroup } from './BattlePrevPanelView';

export const SELECTED_BID_MAP_KEY = 'bk_selected_bid_map';

export function loadSelectedBidMapId(defaultBidMapId?: number): number | undefined {
  const raw = localStorage.getItem(SELECTED_BID_MAP_KEY);
  const id = raw ? Number(raw) : undefined;
  return id && bidKingBidMaps.some((map) => map.id === id && map.is_visiable === 1) ? id : defaultBidMapId;
}

export function buildBidKingBattleMapGroups(): BidKingBattleMapGroup[] {
  const visibleBidMaps = bidKingBidMaps.filter((map) => (
    map.is_visiable === 1
    && map.auction_rounds_rate.some((rate) => rate > 0)
  ));
  const fallbackBidMaps = visibleBidMaps.length > 0
    ? visibleBidMaps
    : bidKingBidMaps.filter((map) => map.is_visiable === 1 && map.auction_rounds_rate.some((rate) => rate > 0));
  const openParents = bidKingMaps.filter((map) => map.is_open === 1);
  const xs = openParents.map((map) => map.map_position[0] ?? 0);
  const ys = openParents.map((map) => map.map_position[1] ?? 0);
  const minX = Math.min(...xs, -360);
  const maxX = Math.max(...xs, 360);
  const minY = Math.min(...ys, -260);
  const maxY = Math.max(...ys, 260);

  return openParents
    .map((parent, index) => {
      const children = fallbackBidMaps
        .filter((bidMap) => bidMap.parent_map_id === parent.id)
        .sort((left, right) => left.id - right.id);
      if (children.length === 0) {
        return undefined;
      }
      const [x, y] = parent.map_position;
      return {
        parent,
        children,
        x: normalizeMapCoordinate(x ?? index * 97, minX, maxX, 13, 86),
        y: normalizeMapCoordinate(y ?? index * 71, minY, maxY, 18, 76)
      };
    })
    .filter((group): group is BidKingBattleMapGroup => Boolean(group))
    .sort((left, right) => left.parent.id - right.parent.id);
}

function normalizeMapCoordinate(value: number, min: number, max: number, low: number, high: number): number {
  if (max <= min) {
    return (low + high) / 2;
  }
  return Math.round(low + ((value - min) / (max - min)) * (high - low));
}

function parentMapForBidMap(bidMap?: BidKingBidMapRow): BidKingMapRow | undefined {
  return bidMap ? bidKingMaps.find((map) => map.id === bidMap.parent_map_id) : undefined;
}

export function modeForBidMapId(bidMapId?: number): CoreAuctionMode | undefined {
  const bidMap = bidMapId ? bidKingBidMaps.find((map) => map.id === bidMapId) : undefined;
  const parent = parentMapForBidMap(bidMap);
  return parent ? modeForBidKingMap(parent) : undefined;
}

function modeForBidKingMap(parent: BidKingMapRow): CoreAuctionMode {
  return parent.type === 1 ? 'sealed' : 'open';
}

export function bidKingDisplayBidMapName(bidMap: BidKingBidMapRow): string {
  return bidKingBidMapDisplayName(bidMap);
}
