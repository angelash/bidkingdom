import { describe, expect, it } from 'vitest';
import { Hero, RankMap } from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import {
  bidKingBidMapPlayerCount,
  bidKingBotHeroIdsForBidMap,
  bidKingPlayableBidMaps,
  bidKingRandomBidMapCandidates,
  bidKingResolveRandomBidMapId
} from './bidMapRuntime';
import { createMatch } from '../match';
import { bidKingHeroIdForRoleId, bidKingRoleHasSourceHero, bidKingSourceRoles } from './heroRuntime';

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

  it('keeps selectable bidder roles bounded to original Hero rows', () => {
    const sourceRoles = bidKingSourceRoles(gameConfig.roles);
    const extraRole = gameConfig.roles[Hero.length];

    expect(sourceRoles).toHaveLength(Hero.length);
    expect(bidKingRoleHasSourceHero(sourceRoles[sourceRoles.length - 1]?.id, gameConfig.roles)).toBe(true);
    expect(bidKingRoleHasSourceHero(extraRole?.id, gameConfig.roles)).toBe(false);
    expect(bidKingHeroIdForRoleId(sourceRoles[sourceRoles.length - 1]?.id, gameConfig.roles)).toBe(Hero[Hero.length - 1]?.id);
    expect(bidKingHeroIdForRoleId(extraRole?.id, gameConfig.roles)).toBe(Hero[0]?.id);
  });

  it('keeps the selected source BidMap id instead of rerolling map_group branches', () => {
    const candidates = bidKingRandomBidMapCandidates(2101);
    const resolved = bidKingResolveRandomBidMapId(2101, 'random-map-test');

    expect(candidates).toEqual([2101]);
    expect(resolved).toBe(2101);
    expect(bidKingResolveRandomBidMapId(2101, 'random-map-test')).toBe(resolved);
    expect(bidKingRandomBidMapCandidates(999999)).toEqual([999999]);
    expect(bidKingResolveRandomBidMapId(999999, 'random-map-test')).toBe(999999);
  });
});
