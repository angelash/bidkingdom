import { Cabinet, Head, Hero, HeroSkin, Item } from '@bitkingdom/bidking-compat';
import {
  bidKingHeroAccessCost,
  bidKingHeroItemIdForHero,
  bidKingStarterOwnedHeroIds
} from '@bitkingdom/match-core';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { addInventory, canonicalCodexItemId } from './profileInventory';
import { addOwnedHeroToProfile, ensureProfileHeroState, heroStateForProfile } from './profileHeroRuntime';
import { sanitizeSettings } from './profileShape';
import { clearStockItemFromCabinet, placeStockItemInCabinet } from './profileStockRuntime';

export type PreferenceTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type PreferenceNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'goldCoins' | 'boundGoldCoins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

type BidKingCabinetRow = (typeof Cabinet)[number];
type BidKingItemRow = (typeof Item)[number];

export interface CabinetPlacementRule {
  accepted: boolean;
  cabinetId: number;
  cabinetName: string;
  itemId: string;
  itemQuality: number;
  maxSlotLimit: number;
  placeLimit: number;
  placeMax: number;
  qualityRequirement: readonly number[];
  reason?: string;
  sourceItemId: number;
}

export function updateProfileSettings(
  profile: PlayerProfile,
  settings: Record<string, string | number | boolean>
): void {
  profile.settings = { ...profile.settings, ...sanitizeSettings(settings) };
  profile.updatedAt = Date.now();
}

export function selectHeadForProfile(
  profile: PlayerProfile,
  headId: string,
  recordTransaction: PreferenceTransactionRecorder
): void {
  const head = Head.find((row) => row.id === headId);
  if (!head) {
    throw new Error('头像配置不存在');
  }
  profile.headId = head.id;
  profile.updatedAt = Date.now();
  recordTransaction(profile, `head:${profile.playerId}:${head.id}:${Date.now()}`, 'head_select', 'task', 0, 1);
}

export function setCabinetItemForProfile(
  profile: PlayerProfile,
  itemId: string,
  recordTransaction: PreferenceTransactionRecorder
): void {
  const canonicalId = canonicalCodexItemId(itemId);
  const rule = cabinetPlacementRuleForItem(canonicalId);
  if (!rule) {
    throw new Error('藏品配置不存在');
  }
  if (!rule.accepted) {
    throw new Error(rule.reason ?? '藏品不符合收藏柜要求');
  }
  const before = profile.cabinetItemIds?.length ?? 0;
  const placed = placeStockItemInCabinet(profile, canonicalId);
  if (!placed) {
    return;
  }
  profile.cabinetItemIds ??= [];
  if (!profile.codex.includes(canonicalId)) {
    profile.codex.push(canonicalId);
  }
  profile.updatedAt = Date.now();
  recordTransaction(profile, `cabinet:${profile.playerId}:${canonicalId}:${Date.now()}`, 'cabinet_place', 'item', before, 1);
}

export function clearCabinetItemForProfile(
  profile: PlayerProfile,
  itemId: string,
  recordTransaction: PreferenceTransactionRecorder
): boolean {
  const canonicalId = canonicalCodexItemId(itemId);
  const before = profile.cabinetItemIds?.length ?? 0;
  if (!clearStockItemFromCabinet(profile, canonicalId)) {
    return false;
  }
  profile.updatedAt = Date.now();
  recordTransaction(profile, `cabinet_clear:${profile.playerId}:${canonicalId}:${Date.now()}`, 'cabinet_clear', 'item', before, -1);
  return true;
}

export function selectHeroSkinForProfile(
  profile: PlayerProfile,
  skinId: number,
  recordTransaction: PreferenceTransactionRecorder
): void {
  const skin = HeroSkin.find((row) => row.id === skinId);
  if (!skin) {
    throw new Error('皮肤配置不存在');
  }
  profile.selectedHeroSkins ??= {};
  profile.selectedHeroSkins[String(skin.skinhero)] = skin.id;
  profile.updatedAt = Date.now();
  recordTransaction(profile, `hero_skin:${profile.playerId}:${skin.id}:${Date.now()}`, 'hero_skin_select', 'task', 0, 1);
}

export function selectHeroForProfile(
  profile: PlayerProfile,
  heroId: number,
  recordTransaction: PreferenceTransactionRecorder
): void {
  const hero = Hero.find((row) => row.id === heroId);
  if (!hero) {
    throw new Error('竞买人配置不存在');
  }
  ensureProfileHeroState(profile);
  const state = heroStateForProfile(profile, hero.id);
  if (state.state === 'locked') {
    throw new Error('竞买人尚未解锁');
  }
  const before = profile.selectedHeroId ?? 0;
  profile.selectedHeroId = hero.id;
  profile.updatedAt = Date.now();
  recordTransaction(profile, `hero_select:${profile.playerId}:${hero.id}:${Date.now()}`, 'hero_select', 'task', before, 1);
}

export function unlockHeroForProfile(
  profile: PlayerProfile,
  heroId: number,
  applyNumberChange: PreferenceNumberChangeApplier,
  recordTransaction: PreferenceTransactionRecorder
): boolean {
  const hero = Hero.find((row) => row.id === heroId);
  if (!hero) {
    throw new Error('竞买人配置不存在');
  }
  ensureProfileHeroState(profile);
  const beforeState = heroStateForProfile(profile, hero.id);
  if (beforeState.state === 'owned') {
    return false;
  }
  const cost = bidKingHeroAccessCost(hero.id);
  if (!cost || cost.resource === 'external' || cost.resource === 'item') {
    throw new Error('竞买人暂不支持直接购买');
  }
  const balance = profile[cost.resource] ?? 0;
  if (balance < cost.quantity) {
    throw new Error(`${cost.label}不足`);
  }

  const sourcePrefix = `hero_unlock:${profile.playerId}:${hero.id}:${Date.now()}`;
  applyNumberChange(profile, `${sourcePrefix}:cost`, 'hero_unlock_cost', cost.resource, -cost.quantity);
  const heroItemId = bidKingHeroItemIdForHero(hero.id);
  const beforeOwnedCount = profile.ownedHeroIds?.length ?? 0;
  if (heroItemId) {
    addInventory(profile, String(15), String(heroItemId), 1, `${sourcePrefix}:item`);
    recordTransaction(profile, `${sourcePrefix}:item`, 'hero_unlock_item', 'item', 0, 1);
  }
  addOwnedHeroToProfile(profile, hero.id);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `${sourcePrefix}:owned`, 'hero_unlock', 'task', beforeOwnedCount, 1);
  return true;
}

export function starterHeroIds(): number[] {
  return bidKingStarterOwnedHeroIds();
}

export function cabinetPlacementRuleForItem(itemId: string): CabinetPlacementRule | undefined {
  const canonicalId = canonicalCodexItemId(itemId);
  const item = itemForCanonicalId(canonicalId);
  if (!item) {
    return undefined;
  }
  const cabinet = cabinetForItem(item) ?? Cabinet[0];
  if (!cabinet) {
    return undefined;
  }
  const qualityRequirement = cabinet.quality_requirement;
  const typeAccepted = item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId));
  const qualityAccepted = qualityRequirement.length === 0 || qualityRequirement.includes(item.item_quality);
  const accepted = typeAccepted && qualityAccepted;
  const placeMax = positiveLimit(cabinet.place_max, 'Cabinet.place_max');
  const maxSlotLimit = positiveLimit(cabinet.max_slot_limit, 'Cabinet.max_slot_limit');
  const placeLimit = placeMax;
  return {
    accepted,
    cabinetId: cabinet.id,
    cabinetName: cabinet.packaged_name,
    itemId: canonicalId,
    itemQuality: item.item_quality,
    maxSlotLimit,
    placeLimit,
    placeMax,
    qualityRequirement,
    reason: accepted
      ? undefined
      : !typeAccepted
        ? '藏品分类不符合收藏柜要求'
        : `藏品品质不符合收藏柜要求：需要 ${qualityRequirement.join('/')}，当前 ${item.item_quality}`,
    sourceItemId: item.id
  };
}

function itemForCanonicalId(canonicalId: string): BidKingItemRow | undefined {
  return Item.find((row) => `compat_${row.id}` === canonicalId || String(row.id) === canonicalId);
}

function cabinetForItem(item: BidKingItemRow): BidKingCabinetRow | undefined {
  return Cabinet.find((cabinet) => item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)));
}

function positiveLimit(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || value <= 0) {
    throw new Error(`${field} must be positive`);
  }
  return value;
}
