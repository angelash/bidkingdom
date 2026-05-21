import { describe, expect, it } from 'vitest';
import {
  bidKingHeroSkinRuntime,
  bidKingHeroSkinRuntimeRows,
  bidKingHeroSkinsForHero,
  HeroSkin
} from './index';

describe('BidKing HeroSkin runtime', () => {
  it('builds clean-room visual metadata for every HeroSkin row', () => {
    const rows = bidKingHeroSkinRuntimeRows();

    expect(rows).toHaveLength(22);
    expect(rows.every((row) => row.cleanRoomMode === 'approved_role_art_tint')).toBe(true);
    expect(rows.every((row) => row.voiceIds.length > 0)).toBe(true);
    expect(rows.every((row) => row.battleBgmIds.length > 0)).toBe(true);
    expect(rows.every((row) => row.sourceFields.includes('HeroSkin.illustration_path'))).toBe(true);
    expect(rows.every((row) => row.sourceFields.includes('HeroSkin.bg_path'))).toBe(true);
  });

  it('preserves resource keys, access cost and alternate default skins', () => {
    const first = bidKingHeroSkinRuntime(HeroSkin[0]!);
    expect(first).toEqual(expect.objectContaining({
      skinId: 1410101,
      heroId: 101,
      heroTag: 101,
      accessCost: { resourceType: 1, amount: 2_000_000 },
      accessLabel: '资源 1 x2000000'
    }));
    expect(first.resourceKeys).toEqual(expect.objectContaining({
      skinClass: 'hero_skin_d_101_1',
      skinGround: 'hero_skin_c_101_1',
      illustration: 'hero_xq_101_2',
      background: 'hero_bg_101_2'
    }));

    const alternate = bidKingHeroSkinRuntime(HeroSkin.find((row) => row.id === 1410702)!);
    expect(alternate.accessCost).toBeUndefined();
    expect(alternate.accessLabel).toBe('默认');
    expect(bidKingHeroSkinsForHero(107).map((row) => row.skinId)).toEqual([1410701, 1410702]);
  });
});
