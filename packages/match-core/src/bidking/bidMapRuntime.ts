import { BidMap, Hero, RankMap } from '@bitkingdom/bidking-compat';
import type { BidKingBidMapRow } from '@bitkingdom/bidking-compat';
import { createRandom, hashSeed } from '../random';

export interface BidKingBotHeroSpawnOptions {
  bidMapId: number;
  count: number;
  seed: string | number;
  excludeHeroIds?: readonly number[];
}

export function bidKingBidMapPlayerCount(bidMapId: number): number {
  const bidMap = requireBidMap(bidMapId);
  const count = Math.floor(bidMap.bidder_number);
  if (count <= 0) {
    throw new Error(`BidMap ${bidMapId} has invalid bidder_number ${bidMap.bidder_number}`);
  }
  return count;
}

export function bidKingPlayableBidMaps(): BidKingBidMapRow[] {
  return BidMap.filter((row) => row.is_visiable === 1 && row.auction_rounds_rate.some((rate) => rate > 0));
}

export function bidKingRandomBidMapCandidates(bidMapId: number): number[] {
  const bidMap = requireBidMap(bidMapId);
  const candidates = bidMap.map_group
    .map(([candidateId = 0]) => candidateId)
    .filter((candidateId) => candidateId > 0);
  for (const candidateId of candidates) {
    requireBidMap(candidateId);
  }
  return candidates;
}

export function bidKingResolveRandomBidMapId(bidMapId: number, seed: string | number): number {
  const bidMap = requireBidMap(bidMapId);
  const candidates = bidMap.map_group
    .map(([candidateId = 0, weight = 0]) => ({ item: candidateId, weight: Math.max(0, weight) }))
    .filter((candidate) => candidate.item > 0 && candidate.weight > 0);
  for (const candidate of candidates) {
    requireBidMap(candidate.item);
  }
  if (candidates.length === 0) {
    return bidMap.id;
  }
  const rng = createRandom(hashSeed([
    'bidking-map-group',
    bidMap.id,
    seed
  ].join(':')));
  return rng.weighted(candidates);
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
    options.bidMapId,
    options.seed,
    options.excludeHeroIds?.join(',') ?? ''
  ].join(':'));
  const rng = createRandom(seed);
  const excluded = new Set((options.excludeHeroIds ?? []).filter((heroId) => heroExists(heroId)));
  const sourceCandidates = roleSpawnCandidates(options.bidMapId);
  const selected: number[] = [];

  while (selected.length < count) {
    const available = sourceCandidates.filter((candidate) => (
      !excluded.has(candidate.item)
      && !selected.includes(candidate.item)
    ));
    if (available.length === 0) {
      throw new Error(`RankMap ${options.bidMapId} role_spawn cannot supply ${count} unique bot heroes`);
    }
    selected.push(rng.weighted(available));
  }

  return selected;
}

function requireBidMap(bidMapId: number): BidKingBidMapRow {
  const bidMap = BidMap.find((row) => row.id === bidMapId);
  if (!bidMap) {
    throw new Error(`Unknown BidMap ${bidMapId}`);
  }
  return bidMap;
}

function roleSpawnCandidates(bidMapId: number): Array<{ item: number; weight: number }> {
  const row = RankMap.find((candidate) => candidate.id === bidMapId);
  if (!row) {
    throw new Error(`Missing RankMap ${bidMapId}`);
  }
  const candidates = row.role_spawn
    .map(([heroId = 0, weight = 0]) => ({ item: heroId, weight: Math.max(0, weight) }))
    .filter((candidate) => heroExists(candidate.item) && candidate.weight > 0);
  if (candidates && candidates.length > 0) {
    return candidates;
  }
  throw new Error(`RankMap ${bidMapId} has no valid role_spawn heroes`);
}

function heroExists(heroId: number): boolean {
  return Hero.some((hero) => hero.id === heroId);
}
