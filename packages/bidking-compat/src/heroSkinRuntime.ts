import type { BidKingHeroSkinRow } from './schema';
import { HeroSkin } from './tables/HeroSkin';

export interface BidKingHeroSkinAccessCost {
  resourceType: number;
  amount: number;
}

export interface BidKingHeroSkinResourceKeys {
  skinClass: string;
  skinGround: string;
  icon: string;
  iconDetail: string;
  iconBattle: string;
  illustration: string;
  background: string;
}

export interface BidKingHeroSkinRuntime {
  skinId: number;
  heroId: number;
  heroTag: number;
  label: string;
  description: string;
  accessCost?: BidKingHeroSkinAccessCost;
  accessLabel: string;
  voiceIds: number[];
  battleBgmIds: number[];
  resourceKeys: BidKingHeroSkinResourceKeys;
  accentHue: number;
  cleanRoomMode: 'approved_role_art_tint';
  sourceFields: Array<
    | 'HeroSkin.skin_class'
    | 'HeroSkin.skinground'
    | 'HeroSkin.icon_path'
    | 'HeroSkin.icon_path2'
    | 'HeroSkin.icon_path3'
    | 'HeroSkin.illustration_path'
    | 'HeroSkin.bg_path'
    | 'HeroSkin.access'
    | 'HeroSkin.voices'
    | 'HeroSkin.battleBgm'
    | 'HeroSkin.hero_tag'
  >;
}

export function bidKingHeroSkinRuntime(skin: BidKingHeroSkinRow): BidKingHeroSkinRuntime {
  return {
    skinId: skin.id,
    heroId: skin.skinhero,
    heroTag: skin.hero_tag,
    label: skin.packaged_name,
    description: skin.packaged_desc,
    accessCost: heroSkinAccessCost(skin),
    accessLabel: heroSkinAccessLabel(skin),
    voiceIds: [...skin.voices],
    battleBgmIds: [...skin.battleBgm],
    resourceKeys: {
      skinClass: skin.skin_class,
      skinGround: skin.skinground,
      icon: skin.icon_path,
      iconDetail: skin.icon_path2,
      iconBattle: skin.icon_path3,
      illustration: skin.illustration_path,
      background: skin.bg_path
    },
    accentHue: heroSkinAccentHue(skin),
    cleanRoomMode: 'approved_role_art_tint',
    sourceFields: [
      'HeroSkin.skin_class',
      'HeroSkin.skinground',
      'HeroSkin.icon_path',
      'HeroSkin.icon_path2',
      'HeroSkin.icon_path3',
      'HeroSkin.illustration_path',
      'HeroSkin.bg_path',
      'HeroSkin.access',
      'HeroSkin.voices',
      'HeroSkin.battleBgm',
      'HeroSkin.hero_tag'
    ]
  };
}

export function bidKingHeroSkinRuntimeRows(): BidKingHeroSkinRuntime[] {
  return HeroSkin.map((skin) => bidKingHeroSkinRuntime(skin));
}

export function bidKingHeroSkinsForHero(heroId: number): BidKingHeroSkinRuntime[] {
  return HeroSkin
    .filter((skin) => skin.skinhero === heroId)
    .map((skin) => bidKingHeroSkinRuntime(skin));
}

function heroSkinAccessCost(skin: BidKingHeroSkinRow): BidKingHeroSkinAccessCost | undefined {
  const [resourceType, amount] = skin.access;
  if (
    typeof resourceType !== 'number' ||
    typeof amount !== 'number' ||
    !Number.isFinite(resourceType) ||
    !Number.isFinite(amount) ||
    resourceType <= 0 ||
    amount <= 0
  ) {
    return undefined;
  }
  return {
    resourceType: Math.trunc(resourceType),
    amount: Math.trunc(amount)
  };
}

function heroSkinAccessLabel(skin: BidKingHeroSkinRow): string {
  const cost = heroSkinAccessCost(skin);
  return cost ? `资源 ${cost.resourceType} x${cost.amount}` : '默认';
}

function heroSkinAccentHue(skin: BidKingHeroSkinRow): number {
  return Math.abs((skin.hero_tag * 37 + skin.id) % 360);
}
