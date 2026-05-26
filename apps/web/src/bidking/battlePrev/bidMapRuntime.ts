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

export function loadSelectedBidMapId(): number | undefined {
  const raw = localStorage.getItem(SELECTED_BID_MAP_KEY);
  const id = raw ? Number(raw) : undefined;
  return id && bidKingBidMaps.some((map) => map.id === id && map.is_visiable === 1) ? id : undefined;
}

export function buildBidKingBattleMapGroups(): BidKingBattleMapGroup[] {
  const visibleBidMaps = bidKingBidMaps.filter((map) => (
    map.is_visiable === 1
    && map.auction_rounds_rate.some((rate) => rate > 0)
  ));
  const openParents = bidKingMaps.filter((map) => map.is_open === 1);
  const xs = openParents.map((map) => map.map_position[0] ?? 0);
  const ys = openParents.map((map) => map.map_position[1] ?? 0);
  const minX = Math.min(...xs, -360);
  const maxX = Math.max(...xs, 360);
  const minY = Math.min(...ys, -260);
  const maxY = Math.max(...ys, 260);

  const groups = openParents
    .map((parent, index) => {
      const children = visibleBidMaps
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
  return spreadBattleMapGroups(groups);
}

function normalizeMapCoordinate(value: number, min: number, max: number, low: number, high: number): number {
  if (max <= min) {
    return (low + high) / 2;
  }
  return Math.round(low + ((value - min) / (max - min)) * (high - low));
}

function spreadBattleMapGroups(groups: BidKingBattleMapGroup[]): BidKingBattleMapGroup[] {
  const result = groups.map((group) => ({ ...group }));
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < result.length; index += 1) {
      const current = result[index]!;
      for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
        const previous = result[previousIndex]!;
        const dx = Math.abs(current.x - previous.x);
        const dy = Math.abs(current.y - previous.y);
        if (dx >= 17 || dy >= 13) {
          continue;
        }
        const verticalDirection = current.y >= previous.y ? 1 : -1;
        current.y = clampMapPercent(current.y + verticalDirection * (13 - dy + 2), 14, 80);
        if (Math.abs(current.x - previous.x) < 17 && Math.abs(current.y - previous.y) < 13) {
          const horizontalDirection = current.x >= previous.x ? 1 : -1;
          current.x = clampMapPercent(current.x + horizontalDirection * (17 - dx + 2), 10, 90);
        }
      }
    }
  }
  return result;
}

function clampMapPercent(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
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
