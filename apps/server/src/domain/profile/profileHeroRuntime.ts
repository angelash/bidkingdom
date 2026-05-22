import { Hero } from '@bitkingdom/bidking-compat';
import {
  bidKingDefaultHeroId,
  bidKingHeroItemIdForHero,
  bidKingHeroStateFromProfile,
  bidKingStarterOwnedHeroIds
} from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileHeroState } from '@bitkingdom/shared';

const LEGACY_FIRST_PASS_HERO_IDS = Hero.slice(0, 8).map((hero) => hero.id);

export function ensureProfileHeroState(profile: PlayerProfile, now = Date.now()): void {
  profile.goldCoins ??= 0;
  profile.boundGoldCoins ??= 0;
  profile.freeHeroIds ??= [];
  profile.selectedHeroSkins ??= {};

  const ownedHeroIds = normalizeOwnedHeroIds(profile);
  profile.ownedHeroIds = ownedHeroIds;
  profile.heroStates = [];
  profile.heroStates = Hero.map((hero) => bidKingHeroStateFromProfile(profile, hero.id));

  if (!profile.selectedHeroId || heroStateForProfile(profile, profile.selectedHeroId).state === 'locked') {
    profile.selectedHeroId = firstSelectableHeroId(profile) ?? bidKingDefaultHeroId();
    profile.updatedAt = now;
  }
}

export function heroStateForProfile(profile: PlayerProfile, heroId: number): ProfileHeroState {
  return profile.heroStates?.find((state) => state.heroId === heroId)
    ?? bidKingHeroStateFromProfile(profile, heroId);
}

export function profileCanSelectHero(profile: PlayerProfile, heroId: number): boolean {
  return heroStateForProfile(profile, heroId).state !== 'locked';
}

export function addOwnedHeroToProfile(profile: PlayerProfile, heroId: number): void {
  profile.ownedHeroIds ??= [];
  if (!profile.ownedHeroIds.includes(heroId)) {
    profile.ownedHeroIds.push(heroId);
  }
  ensureProfileHeroState(profile);
}

function normalizeOwnedHeroIds(profile: PlayerProfile): number[] {
  const profileOwnedIds = profile.ownedHeroIds ?? bidKingStarterOwnedHeroIds();
  const shouldReplaceLegacyDefault = profile.settings?.bidkingHeroSourceStateV1 !== true
    && sameHeroSet(profileOwnedIds, LEGACY_FIRST_PASS_HERO_IDS);
  const owned = new Set<number>(shouldReplaceLegacyDefault ? [] : profileOwnedIds);
  for (const hero of Hero) {
    const heroItemId = bidKingHeroItemIdForHero(hero.id);
    if (heroItemId && inventoryQuantity(profile, heroItemId) > 0) {
      owned.add(hero.id);
    }
  }
  profile.settings ??= {};
  profile.settings.bidkingHeroSourceStateV1 = true;
  return [...owned]
    .filter((heroId) => Hero.some((hero) => hero.id === heroId))
    .sort((left, right) => Hero.findIndex((hero) => hero.id === left) - Hero.findIndex((hero) => hero.id === right));
}

function firstSelectableHeroId(profile: PlayerProfile): number | undefined {
  return profile.heroStates?.find((state) => state.state !== 'locked')?.heroId;
}

function inventoryQuantity(profile: PlayerProfile, refId: number): number {
  return profile.inventory
    .filter((entry) => sourceInventoryItemId(entry.refId) === refId)
    .reduce((sum, entry) => sum + Math.max(0, entry.quantity), 0);
}

function sourceInventoryItemId(value: number | string): number {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return Number(compatMatch?.[1] ?? raw);
}

function sameHeroSet(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
