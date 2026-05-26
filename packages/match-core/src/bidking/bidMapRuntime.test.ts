import { describe, expect, it } from 'vitest';
import { RankMap } from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import {
  bidKingBidMapPlayerCount,
  bidKingBotHeroIdsForBidMap,
  bidKingPlayableBidMaps,
  bidKingRandomBidMapCandidates,
  bidKingResolveRandomBidMapId
} from './bidMapRuntime';
import { createMatch } from '../match';
import { BID_KING_BIDDER_ROLE_BINDINGS, BID_KING_BIDDER_SOURCE_HERO_IDS } from './bidderCatalog';
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
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });

    expect(match.players).toHaveLength(2);
    expect(() => createMatch({
      id: 'short-two-player-bidmap',
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: 'appraiser', heroCid: 101 }
      ],
      coreMode: true,
      coreAuctionMode: 'sealed',
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
    const extraRole = gameConfig.roles.find((role) => !BID_KING_BIDDER_ROLE_BINDINGS.some((binding) => binding.roleId === role.id));

    expect(sourceRoles).toHaveLength(BID_KING_BIDDER_SOURCE_HERO_IDS.length);
    expect(sourceRoles.map((role) => role.id)).toEqual(BID_KING_BIDDER_ROLE_BINDINGS.map((binding) => binding.roleId));
    expect(sourceRoles.map((role) => bidKingHeroIdForRoleId(role.id, gameConfig.roles))).toEqual(BID_KING_BIDDER_SOURCE_HERO_IDS);
    expect(bidKingRoleHasSourceHero(sourceRoles[sourceRoles.length - 1]?.id, gameConfig.roles)).toBe(true);
    expect(bidKingRoleHasSourceHero(extraRole?.id, gameConfig.roles)).toBe(false);
    expect(bidKingHeroIdForRoleId(sourceRoles[sourceRoles.length - 1]?.id, gameConfig.roles)).toBe(301);
    expect(() => bidKingHeroIdForRoleId(extraRole?.id, gameConfig.roles)).toThrow(/not mapped/);
  });

  it('resolves selected source BidMap ids through original map_group weights', () => {
    const candidates = bidKingRandomBidMapCandidates(2101);
    const resolved = bidKingResolveRandomBidMapId(2101, 'random-map-test');
    const sampled = new Set(Array.from({ length: 24 }, (_, index) => (
      bidKingResolveRandomBidMapId(2101, `random-map-test-${index}`)
    )));

    expect(candidates).toEqual([2101, 2102, 2103, 2104, 2105, 2106, 2107]);
    expect(candidates).toContain(resolved);
    expect(bidKingResolveRandomBidMapId(2101, 'random-map-test')).toBe(resolved);
    expect([...sampled].every((id) => id !== undefined && candidates.includes(id))).toBe(true);
    expect(sampled.size).toBeGreaterThan(1);
    expect(bidKingRandomBidMapCandidates(4402)).toEqual([]);
    expect(() => bidKingRandomBidMapCandidates(999999)).toThrow(/Unknown BidMap/);
    expect(() => bidKingResolveRandomBidMapId(999999, 'random-map-test')).toThrow(/Unknown BidMap/);
  });
});
