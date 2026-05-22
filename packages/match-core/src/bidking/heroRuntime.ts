import { Hero, HeroSkin, Item } from '@bitkingdom/bidking-compat';
import type {
  PlayerInventoryEntry,
  PlayerProfile,
  ProfileHeroAccessCost,
  ProfileHeroState,
  RoleConfig
} from '@bitkingdom/shared';
import { bidKingStarterInventoryRewards } from './profileInitialRuntime';

const HERO_ITEM_TYPE = 15;
const TRIAL_HERO_ITEM_TYPE = 19;

export function bidKingHeroIdForRoleId(roleId: string | undefined, roles: readonly Pick<RoleConfig, 'id'>[]): number {
  const index = Math.max(0, roles.findIndex((role) => role.id === roleId));
  return Hero[index]?.id ?? Hero[0]?.id ?? 0;
}

export function bidKingRoleIdForHeroId(heroId: number | undefined, roles: readonly Pick<RoleConfig, 'id'>[]): string | undefined {
  const index = Hero.findIndex((hero) => hero.id === heroId);
  return index >= 0 ? roles[index]?.id : undefined;
}

export function bidKingStarterOwnedHeroIds(): number[] {
  return heroIdsFromInventoryRefs(bidKingStarterInventoryRewards().map((reward) => reward.refId), HERO_ITEM_TYPE);
}

export function bidKingStarterTrialHeroIds(): number[] {
  return heroIdsFromInventoryRefs(bidKingStarterInventoryRewards().map((reward) => reward.refId), TRIAL_HERO_ITEM_TYPE);
}

export function bidKingStarterSelectableHeroIds(): number[] {
  return uniqueHeroIds([...bidKingStarterOwnedHeroIds(), ...bidKingStarterTrialHeroIds()]);
}

export function bidKingStarterHeroIds(count?: number): number[] {
  const starterIds = bidKingStarterSelectableHeroIds();
  return typeof count === 'number' ? starterIds.slice(0, Math.max(1, count)) : starterIds;
}

export function bidKingDefaultHeroId(): number {
  return bidKingStarterOwnedHeroIds()[0]
    ?? bidKingStarterSelectableHeroIds()[0]
    ?? Hero[0]?.id
    ?? 0;
}

export function bidKingHeroExists(heroId: number): boolean {
  return Hero.some((hero) => hero.id === heroId);
}

export function bidKingHeroSkinForHero(heroId: number | undefined, selectedHeroSkins?: Record<string, number>): number | undefined {
  if (!heroId || !selectedHeroSkins) {
    return undefined;
  }
  const selectedSkinId = selectedHeroSkins[String(heroId)];
  return typeof selectedSkinId === 'number' && HeroSkin.some((skin) => skin.id === selectedSkinId && skin.skinhero === heroId)
    ? selectedSkinId
    : undefined;
}

export function bidKingHeroItemIdForHero(heroId: number): number | undefined {
  return heroItemForHero(heroId)?.id;
}

export function bidKingHeroTrialItemIdsForHero(heroId: number): number[] {
  return Item
    .filter((item) => item.item_type_ids.includes(TRIAL_HERO_ITEM_TYPE) && item.skills.includes(heroId))
    .map((item) => item.id);
}

export function bidKingHeroAccessCost(heroId: number): ProfileHeroAccessCost | undefined {
  const hero = Hero.find((row) => row.id === heroId);
  const [accessType = 0, quantity = 0] = hero?.access ?? [];
  if (!hero || !accessType || quantity <= 0) {
    return undefined;
  }
  if (accessType === 1) {
    return { accessType, resource: 'coins', refId: 1, quantity, label: '银币' };
  }
  if (accessType === 2) {
    return { accessType, resource: 'goldCoins', refId: 2, quantity, label: '金币' };
  }
  if (accessType === 3) {
    return { accessType, resource: 'external', quantity, label: '交易获取' };
  }
  if (accessType === 4) {
    return { accessType, resource: 'external', quantity, label: '抽取获取' };
  }
  if (accessType === 5) {
    return { accessType, resource: 'item', quantity, label: '道具获取' };
  }
  return { accessType, resource: 'external', quantity, label: `来源 ${accessType}` };
}

export function bidKingHeroStateFromProfile(
  profile: Pick<PlayerProfile, 'inventory' | 'ownedHeroIds' | 'freeHeroIds' | 'selectedHeroSkins' | 'heroStates'>,
  heroId: number
): ProfileHeroState {
  const stored = profile.heroStates?.find((state) => state.heroId === heroId);
  if (stored) {
    return stored;
  }
  const heroItemId = bidKingHeroItemIdForHero(heroId);
  const heroItemQuantity = heroItemId ? inventoryQuantity(profile.inventory, heroItemId) : 0;
  const owned = (profile.ownedHeroIds?.includes(heroId) ?? false) || heroItemQuantity > 0;
  const free = profile.freeHeroIds?.includes(heroId) ?? false;
  const trialItem = bidKingHeroTrialItemIdsForHero(heroId)
    .map((itemId) => ({ itemId, quantity: inventoryQuantity(profile.inventory, itemId) }))
    .find((entry) => entry.quantity > 0);
  const state = owned ? 'owned' : free ? 'free' : trialItem ? 'trial' : 'locked';
  return {
    heroId,
    state,
    skinId: bidKingHeroSkinForHero(heroId, profile.selectedHeroSkins),
    heroItemId,
    trialItemId: trialItem?.itemId,
    quantity: owned ? Math.max(1, heroItemQuantity) : trialItem?.quantity,
    accessCost: bidKingHeroAccessCost(heroId)
  };
}

export function bidKingHeroSelectableFromProfile(
  profile: Pick<PlayerProfile, 'inventory' | 'ownedHeroIds' | 'freeHeroIds' | 'selectedHeroSkins' | 'heroStates'>,
  heroId: number
): boolean {
  return bidKingHeroStateFromProfile(profile, heroId).state !== 'locked';
}

function heroItemForHero(heroId: number): (typeof Item)[number] | undefined {
  return Item.find((item) => item.item_type_ids.includes(HERO_ITEM_TYPE) && item.skills.includes(heroId));
}

function heroIdsFromInventoryRefs(refIds: readonly (string | number)[], itemTypeId: number): number[] {
  const heroIds = refIds.flatMap((refId) => {
    const item = Item.find((candidate) => candidate.id === sourceInventoryItemId(refId));
    return item?.item_type_ids.includes(itemTypeId) ? item.skills.filter((skill) => skill > 0) : [];
  });
  return uniqueHeroIds(heroIds);
}

function inventoryQuantity(inventory: readonly PlayerInventoryEntry[] | undefined, refId: number): number {
  return inventory
    ?.filter((entry) => sourceInventoryItemId(entry.refId) === refId)
    .reduce((sum, entry) => sum + Math.max(0, entry.quantity), 0)
    ?? 0;
}

function sourceInventoryItemId(value: number | string): number {
  const raw = String(value);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  return Number(compatMatch?.[1] ?? raw);
}

function uniqueHeroIds(heroIds: readonly number[]): number[] {
  const order = new Map(Hero.map((hero, index) => [hero.id, index]));
  return [...new Set(heroIds)]
    .filter((heroId) => order.has(heroId))
    .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}
