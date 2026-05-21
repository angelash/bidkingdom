import { Cabinet, Head, HeroSkin, Item } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { canonicalCodexItemId } from './profileInventory';
import { sanitizeSettings } from './profileShape';

export type PreferenceTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
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
  if (!profile.codex.includes(canonicalId)) {
    throw new Error('藏品尚未解锁，无法陈列');
  }
  const rule = cabinetPlacementRuleForItem(canonicalId);
  if (!rule) {
    throw new Error('藏品配置不存在');
  }
  if (!rule.accepted) {
    throw new Error(rule.reason ?? '藏品不符合收藏柜要求');
  }
  profile.cabinetItemIds ??= [];
  profile.cabinetItemIds = [canonicalId, ...profile.cabinetItemIds.filter((entry) => entry !== canonicalId)]
    .slice(0, rule.placeLimit);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `cabinet:${profile.playerId}:${canonicalId}:${Date.now()}`, 'cabinet_place', 'item', profile.cabinetItemIds.length - 1, 1);
}

export function clearCabinetItemForProfile(
  profile: PlayerProfile,
  itemId: string,
  recordTransaction: PreferenceTransactionRecorder
): boolean {
  const canonicalId = canonicalCodexItemId(itemId);
  const before = profile.cabinetItemIds ?? [];
  if (!before.includes(canonicalId)) {
    return false;
  }
  profile.cabinetItemIds = before.filter((entry) => entry !== canonicalId);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `cabinet_clear:${profile.playerId}:${canonicalId}:${Date.now()}`, 'cabinet_clear', 'item', before.length, -1);
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
  const accepted = qualityRequirement.length === 0 || qualityRequirement.includes(item.item_quality);
  const placeMax = positiveLimit(cabinet.place_max, 15);
  const maxSlotLimit = positiveLimit(cabinet.max_slot_limit, placeMax);
  const placeLimit = Math.min(placeMax, maxSlotLimit);
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
      : `藏品品质不符合收藏柜要求：需要 ${qualityRequirement.join('/')}，当前 ${item.item_quality}`,
    sourceItemId: item.id
  };
}

function itemForCanonicalId(canonicalId: string): BidKingItemRow | undefined {
  return Item.find((row) => `compat_${row.id}` === canonicalId || String(row.id) === canonicalId);
}

function cabinetForItem(item: BidKingItemRow): BidKingCabinetRow | undefined {
  return Cabinet.find((cabinet) => item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)))
    ?? Cabinet[0];
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback;
}
