export const artAssets = {
  backgroundAuctionHall: '/art/approved/backgrounds/background_auction_hall_v1.webp',
  backgroundBlackMarket: '/art/approved/backgrounds/background_black_market_v1.webp',
  roleLineup: '/art/approved/roles/role_lineup_v1.webp',
  containerPalace: '/art/approved/containers/container_palace_v1.webp',
  containerBattlefield: '/art/approved/containers/container_battlefield_v1.webp',
  containerShip: '/art/approved/containers/container_ship_v1.webp',
  containerArmory: '/art/approved/containers/container_armory_v1.webp',
  containerAcademy: '/art/approved/containers/container_academy_v1.webp',
  containerBlackMarket: '/art/approved/containers/container_black_market_v1.webp',
  settlementPlate: '/art/approved/ui/ui_settlement_plate_v1.webp'
} as const;

function roleArt(roleId: string): { avatar: string; portrait: string } {
  return {
    avatar: `/art/approved/roles/role_${roleId}_avatar_v1.webp`,
    portrait: `/art/approved/roles/role_${roleId}_portrait_v1.webp`
  };
}

const roleArtById: Record<string, { avatar: string; portrait: string }> = {
  academy_professor: roleArt('academy_professor'),
  appraiser: roleArt('appraiser'),
  arms_dealer: roleArt('arms_dealer'),
  caravan_master: roleArt('caravan_master'),
  eastern_appraiser: roleArt('eastern_appraiser'),
  fashion_tailor: roleArt('fashion_tailor'),
  field_medic: roleArt('field_medic'),
  historian: roleArt('historian'),
  insurer: roleArt('insurer'),
  intel_analyst: roleArt('intel_analyst'),
  layout_artist: roleArt('layout_artist'),
  market_vendor: roleArt('market_vendor'),
  mentor_teacher: roleArt('mentor_teacher'),
  old_noble: roleArt('old_noble'),
  restorer: roleArt('restorer'),
  secret_broker: roleArt('secret_broker'),
  treasure_hunter: roleArt('treasure_hunter'),
  trend_hunter: roleArt('trend_hunter'),
  veteran_broker: roleArt('veteran_broker'),
  young_savant: roleArt('young_savant')
};

const containerArtByKey: Record<string, string> = {
  container_palace: artAssets.containerPalace,
  container_battlefield: artAssets.containerBattlefield,
  container_ship: artAssets.containerShip,
  container_armory: artAssets.containerArmory,
  container_academy: artAssets.containerAcademy,
  container_black_market: artAssets.containerBlackMarket
};

export function containerArtForKey(artKey?: string): string {
  return artKey ? containerArtByKey[artKey] ?? artAssets.backgroundAuctionHall : artAssets.backgroundAuctionHall;
}

export function roleAvatarForRoleId(roleId?: string): string | undefined {
  if (!roleId) {
    return undefined;
  }
  return roleArtById[roleId]?.avatar;
}

export function rolePortraitForRoleId(roleId?: string): string | undefined {
  if (!roleId) {
    return undefined;
  }
  return roleArtById[roleId]?.portrait;
}

export function itemIconForKey(iconKey?: string): string | undefined {
  if (!iconKey) {
    return undefined;
  }

  const bidKingItemMatch = /^bidking_item_(\d+)$/.exec(iconKey);
  if (bidKingItemMatch?.[1]) {
    return `/art/generated/bidking/items/bidking_item_${bidKingItemMatch[1]}.webp`;
  }
  return undefined;
}
