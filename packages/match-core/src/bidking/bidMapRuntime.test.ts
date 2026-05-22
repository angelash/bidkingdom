import { describe, expect, it } from 'vitest';
import { RankMap } from '@bitkingdom/bidking-compat';
import {
  bidKingBidMapPlayerCount,
  bidKingBotHeroIdsForBidMap,
  bidKingPlayableBidMaps
} from './bidMapRuntime';
import { createMatch } from '../match';

describe('BidKing bid map runtime', () => {
  it('reads playable room capacity from original BidMap rows', () => {
    expect(bidKingPlayableBidMaps().some((bidMap) => bidMap.bidder_number === 2)).toBe(true);
    expect(bidKingPlayableBidMaps().some((bidMap) => bidMap.bidder_number === 4)).toBe(true);
    expect(bidKingBidMapPlayerCount(2101)).toBe(2);
    expect(bidKingBidMapPlayerCount(2601)).toBe(4);
  });

  it('allows core matches to use the selected BidMap player count', () => {
    const match = createMatch({
      id: 'two-player-bidmap',
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: 'appraiser', heroCid: 101 },
        { id: 'b1', name: '乙', kind: 'bot', roleId: 'appraiser', heroCid: 101 }
      ],
      coreMode: true,
      coreBidMapId: 2101
    });

    expect(match.players).toHaveLength(2);
    expect(() => createMatch({
      id: 'short-two-player-bidmap',
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: 'appraiser', heroCid: 101 }
      ],
      coreMode: true,
      coreBidMapId: 2101
    })).toThrow(/exactly 2 players/);
  });

  it('draws bot heroes from original RankMap role_spawn weights', () => {
    const sourceHeroIds = new Set(RankMap.find((row) => row.id === 2101)?.role_spawn.map(([heroId]) => heroId));
    const spawn = bidKingBotHeroIdsForBidMap({
      bidMapId: 2101,
      count: 4,
      seed: 'rankmap-spawn-test',
      excludeHeroIds: [101]
    });

    expect(spawn).toHaveLength(4);
    expect(new Set(spawn).size).toBe(4);
    expect(spawn).not.toContain(101);
    expect(spawn.every((heroId) => sourceHeroIds.has(heroId))).toBe(true);
    expect(spawn).toEqual(bidKingBotHeroIdsForBidMap({
      bidMapId: 2101,
      count: 4,
      seed: 'rankmap-spawn-test',
      excludeHeroIds: [101]
    }));
  });
});
