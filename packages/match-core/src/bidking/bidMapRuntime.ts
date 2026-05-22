import { BidMap, Hero, RankMap } from '@bitkingdom/bidking-compat';
import type { BidKingBidMapRow } from '@bitkingdom/bidking-compat';
import { createRandom, hashSeed } from '../random';
import { bidKingDefaultRoomPlayerCount } from './roomRuleRuntime';

export interface BidKingBotHeroSpawnOptions {
  bidMapId?: number;
  count: number;
  seed: string | number;
  excludeHeroIds?: readonly number[];
}

export function bidKingBidMapPlayerCount(bidMapId?: number, fallback = bidKingDefaultRoomPlayerCount(4)): number {
  const bidMap = bidKingBidMapForId(bidMapId);
  const count = Math.floor(bidMap?.bidder_number ?? fallback);
  return count > 0 ? count : fallback;
}

export function bidKingPlayableBidMaps(): BidKingBidMapRow[] {
  return BidMap.filter((row) => row.is_visiable === 1 && row.auction_rounds_rate.some((rate) => rate > 0));
}

export function bidKingRandomBidMapCandidates(bidMapId?: number): number[] {
  const bidMap = bidKingBidMapForId(bidMapId);
  const candidates = bidMap?.map_group
    .filter((row) => row.length > 0 && (row[0] ?? 0) > 0)
    .map((row) => row[0]!)
    ?? [];
  return candidates.length > 0 ? [...new Set(candidates)] : (bidMapId ? [bidMapId] : []);
}

export function bidKingResolveRandomBidMapId(bidMapId: number | undefined, seed: string | number): number | undefined {
  const bidMap = bidKingBidMapForId(bidMapId);
  if (!bidMap) {
    return bidMapId;
  }
  const weighted = bidMap.map_group
    .map(([id = 0, weight = 0]) => ({ item: id, weight: Math.max(0, weight) }))
    .filter((candidate) => bidKingBidMapForId(candidate.item) && candidate.weight > 0);
  if (weighted.length === 0) {
    return bidMap.id;
  }
  const rng = createRandom(hashSeed(['bidking-random-bidmap', bidMap.id, seed].join(':')));
  return rng.weighted(weighted);
}

export function bidKingBotHeroIdForBidMap(options: Omit<BidKingBotHeroSpawnOptions, 'count'>): number | undefined {
  return bidKingBotHeroIdsForBidMap({ ...options, count: 1 })[0];
}

export function bidKingBotHeroIdsForBidMap(options: BidKingBotHeroSpawnOptions): number[] {
  const count = Math.max(0, Math.floor(options.count));
  if (count === 0) {
    return [];
  }
  const seed = hashSeed([
    'bidking-bot-spawn',
    options.bidMapId ?? 'default',
    options.seed,
    options.excludeHeroIds?.join(',') ?? ''
  ].join(':'));
  const rng = createRandom(seed);
  const excluded = new Set((options.excludeHeroIds ?? []).filter((heroId) => heroExists(heroId)));
  const sourceCandidates = roleSpawnCandidates(options.bidMapId);
  const unrestrictedFallback = Hero.map((hero) => ({ item: hero.id, weight: 1 }));
  const selected: number[] = [];

  while (selected.length < count) {
    const available = sourceCandidates.filter((candidate) => (
      !excluded.has(candidate.item)
      && !selected.includes(candidate.item)
    ));
    const fallback = sourceCandidates.filter((candidate) => !selected.includes(candidate.item));
    const candidates = available.length > 0
      ? available
      : fallback.length > 0
        ? fallback
        : unrestrictedFallback;
    selected.push(rng.weighted(candidates));
  }

  return selected;
}

function bidKingBidMapForId(bidMapId?: number): BidKingBidMapRow | undefined {
  return bidMapId ? BidMap.find((row) => row.id === bidMapId) : undefined;
}

function roleSpawnCandidates(bidMapId?: number): Array<{ item: number; weight: number }> {
  const row = bidMapId
    ? RankMap.find((candidate) => candidate.id === bidMapId)
    : undefined;
  const source = row ?? RankMap[0];
  const candidates = source?.role_spawn
    .map(([heroId = 0, weight = 0]) => ({ item: heroId, weight: Math.max(0, weight) }))
    .filter((candidate) => heroExists(candidate.item) && candidate.weight > 0);
  if (candidates && candidates.length > 0) {
    return candidates;
  }
  return Hero.map((hero) => ({ item: hero.id, weight: 1 }));
}

function heroExists(heroId: number): boolean {
  return Hero.some((hero) => hero.id === heroId);
}
