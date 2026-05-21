export const artAssets = {
  backgroundAuctionHall: '/art/approved/backgrounds/background_auction_hall_v1.png',
  backgroundBlackMarket: '/art/approved/backgrounds/background_black_market_v1.png',
  roleLineup: '/art/approved/roles/role_lineup_v1.png',
  containerSampleHome: '/art/approved/containers/container_sample_home_v1.png',
  containerSampleAntique: '/art/approved/containers/container_sample_antique_v1.png',
  containerSampleArmory: '/art/approved/containers/container_sample_armory_v1.png',
  containerSampleBlackMarket: '/art/approved/containers/container_sample_black_market_v1.png',
  containerSampleFlashPalace: '/art/approved/containers/container_sample_flash_palace_v1.png',
  containerPalace: '/art/approved/containers/container_palace_v1.png',
  containerBattlefield: '/art/approved/containers/container_battlefield_v1.png',
  containerShip: '/art/approved/containers/container_ship_v1.png',
  containerArmory: '/art/approved/containers/container_armory_v1.png',
  containerAcademy: '/art/approved/containers/container_academy_v1.png',
  containerBlackMarket: '/art/approved/containers/container_black_market_v1.png',
  settlementPlate: '/art/approved/ui/ui_settlement_plate_v1.png'
} as const;

function roleArt(roleId: string): { avatar: string; portrait: string } {
  return {
    avatar: `/art/approved/roles/role_${roleId}_avatar_v1.png`,
    portrait: `/art/approved/roles/role_${roleId}_portrait_v1.png`
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
  psychologist: roleArt('psychologist'),
  restorer: roleArt('restorer'),
  rumormonger: roleArt('rumormonger'),
  secret_broker: roleArt('secret_broker'),
  smuggler: roleArt('smuggler'),
  treasure_hunter: roleArt('treasure_hunter'),
  trend_hunter: roleArt('trend_hunter'),
  veteran_broker: roleArt('veteran_broker'),
  young_savant: roleArt('young_savant')
};

const containerArtByKey: Record<string, string> = {
  container_sample_home: artAssets.containerSampleHome,
  container_sample_antique: artAssets.containerSampleAntique,
  container_sample_armory: artAssets.containerSampleArmory,
  container_sample_black_market: artAssets.containerSampleBlackMarket,
  container_sample_flash_palace: artAssets.containerSampleFlashPalace,
  container_palace: artAssets.containerPalace,
  container_battlefield: artAssets.containerBattlefield,
  container_ship: artAssets.containerShip,
  container_armory: artAssets.containerArmory,
  container_academy: artAssets.containerAcademy,
  container_black_market: artAssets.containerBlackMarket
};

const sampleItemArtByKey: Record<string, string> = {
  sample_r1_copper_basin: '/art/approved/items/item_sample_r1_copper_basin_v1.png',
  sample_r1_wood_carving: '/art/approved/items/item_sample_r1_wood_carving_v1.png',
  sample_r1_jade_pendant: '/art/approved/items/item_sample_r1_jade_pendant_v1.png',
  sample_r1_old_painting: '/art/approved/items/item_sample_r1_old_painting_v1.png',
  sample_r2_fake_porcelain: '/art/approved/items/item_sample_r2_fake_porcelain_v1.png',
  sample_r2_bronze_mirror: '/art/approved/items/item_sample_r2_bronze_mirror_v1.png',
  sample_r2_calligraphy: '/art/approved/items/item_sample_r2_calligraphy_v1.png',
  sample_r2_wood_box: '/art/approved/items/item_sample_r2_wood_box_v1.png',
  sample_r3_xiliang_helmet: '/art/approved/items/item_sample_r3_xiliang_helmet_v1.png',
  sample_r3_old_armor: '/art/approved/items/item_sample_r3_old_armor_v1.png',
  sample_r3_blade_fragment: '/art/approved/items/item_sample_r3_blade_fragment_v1.png',
  sample_r3_war_flag: '/art/approved/items/item_sample_r3_war_flag_v1.png',
  sample_r3_stirrup: '/art/approved/items/item_sample_r3_stirrup_v1.png',
  sample_r4_cracked_jade: '/art/approved/items/item_sample_r4_cracked_jade_v1.png',
  sample_r4_black_sword: '/art/approved/items/item_sample_r4_black_sword_v1.png',
  sample_r4_old_box: '/art/approved/items/item_sample_r4_old_box_v1.png',
  sample_r4_broken_burner: '/art/approved/items/item_sample_r4_broken_burner_v1.png',
  sample_r5_imperial_seal: '/art/approved/items/item_sample_r5_imperial_seal_v1.png',
  sample_r5_sachet: '/art/approved/items/item_sample_r5_sachet_v1.png',
  sample_r5_copper_lamp: '/art/approved/items/item_sample_r5_copper_lamp_v1.png',
  sample_r5_cloth_bundle: '/art/approved/items/item_sample_r5_cloth_bundle_v1.png'
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
  if (sampleItemArtByKey[iconKey]) {
    return sampleItemArtByKey[iconKey];
  }

  const bidKingItemMatch = /^bidking_item_(\d+)$/.exec(iconKey);
  if (bidKingItemMatch?.[1]) {
    return `/art/generated/bidking/items/bidking_item_${bidKingItemMatch[1]}.png`;
  }

  const generatedItemMatch = /^item_(\d{2})_([甲乙丙丁])$/.exec(iconKey);
  if (!generatedItemMatch) {
    return undefined;
  }

  const seedNo = generatedItemMatch[1];
  const suffix = generatedItemMatch[2];
  if (!seedNo || !suffix) {
    return undefined;
  }
  const suffixCode: Record<string, string> = { '甲': 'a', '乙': 'b', '丙': 'c', '丁': 'd' };
  const fileSuffix = suffixCode[suffix];
  return fileSuffix ? `/art/approved/items/item_${seedNo}_${fileSuffix}_v1.png` : undefined;
}
