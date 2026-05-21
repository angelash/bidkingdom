import type { FinalMatchSummary } from '@bitkingdom/shared';
import { Activity, Cabinet, Dlc, Item, Mission, Pay, Shop, ShopItem, bidKingDlcRuntime, bidKingPayRuntime } from '@bitkingdom/bidking-compat';
import {
  bidKingStarterHeadId,
  bidKingStarterInventoryRewards
} from '@bitkingdom/match-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { languageNameFromSeed, languageNamesFromSeed } from '../src/domain/profile/languageNameRuntime';
import { addMailFromTemplate } from '../src/domain/profile/profileMailRuntime';
import {
  DEFAULT_PROFILE_COINS,
  LEGACY_DEFAULT_PROFILE_COINS
} from '../src/domain/profile/profileRuntimeConfig';
import { createAccountService } from '../src/services/accountService';
import { createProfileService } from '../src/services/profileService';
import { createSQLiteStore, type ServerStore } from '../src/services/store';

function createMemoryStore(): ServerStore {
  return {
    state: {
      profiles: {},
      transactions: [],
      transactionSourceIds: [],
      accounts: {},
      accountSessions: {}
    },
    save() {
      // In-memory tests do not persist to disk.
    }
  };
}

function firstCabinetEligibleItem(): (typeof Item)[number] {
  const item = Item.find((candidate) =>
    candidate.slot_type > 0 &&
    Cabinet.some((cabinet) =>
      candidate.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)) &&
      cabinetAcceptsItem(cabinet, candidate)
    )
  );
  expect(item).toBeDefined();
  return item!;
}

function firstCabinetIneligibleItem(): (typeof Item)[number] {
  const item = Item.find((candidate) =>
    candidate.slot_type > 0 &&
    Cabinet.some((cabinet) =>
      candidate.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)) &&
      !cabinetAcceptsItem(cabinet, candidate)
    )
  );
  expect(item).toBeDefined();
  return item!;
}

function cabinetAcceptsItem(cabinet: (typeof Cabinet)[number], item: (typeof Item)[number]): boolean {
  return cabinet.quality_requirement.length === 0 || cabinet.quality_requirement.includes(item.item_quality);
}

describe('profile service', () => {
  it('creates a profile and consumes tickets idempotently per source', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.getSnapshot('p_test', '掌柜甲').profile;

    expect(created.name).toBe('掌柜甲');
    expect(created.headId).toBe(bidKingStarterHeadId());
    expect(created.settings.bidkingStarterRewardsV1).toBe(true);
    expect(created.mail).toEqual([]);
    expect(inventoryQuantity(created, '7101')).toBe(1);
    expect(inventoryQuantity(created, '8101')).toBe(5);
    expect(created.inventory.length).toBe(new Set(bidKingStarterInventoryRewards().map((reward) => `${reward.type}:${reward.refId}`)).size);
    expect(created.tickets.current).toBe(20);

    profiles.consumeTicketForMatch('p_test', 'match_start:room_1:p_test');
    profiles.consumeTicketForMatch('p_test', 'match_start:room_1:p_test');

    const next = profiles.getSnapshot('p_test').profile;
    expect(next.tickets.current).toBe(19);
  });

  it('migrates legacy starter coin defaults to original init_items coins', () => {
    const profiles = createProfileService(createMemoryStore());
    const legacy = profiles.getOrCreateProfile('p_legacy_money', '旧掌柜');
    legacy.coins = LEGACY_DEFAULT_PROFILE_COINS;
    legacy.auctionStats!.currentTotalAssets = LEGACY_DEFAULT_PROFILE_COINS;

    const migrated = profiles.getSnapshot('p_legacy_money').profile;

    expect(migrated.coins).toBe(DEFAULT_PROFILE_COINS);
    expect(migrated.auctionStats?.currentTotalAssets).toBe(DEFAULT_PROFILE_COINS);
    expect(migrated.settings.bidkingStarterRewardsV1).toBe(true);
    expect(inventoryQuantity(migrated, '7101')).toBe(1);
  });

  it('persists profile and ledger state through the SQLite store', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'bitkingdom-sqlite-')), 'store.sqlite');
    const firstProfiles = createProfileService(createSQLiteStore(dbPath));
    firstProfiles.getOrCreateProfile('p_sqlite', '掌柜数据库');
    firstProfiles.completeDemoPayOrder('p_sqlite', '1');

    const secondProfiles = createProfileService(createSQLiteStore(dbPath));
    const snapshot = secondProfiles.getSnapshot('p_sqlite');

    expect(snapshot.profile.name).toBe('掌柜数据库');
    expect(snapshot.profile.coins).toBe(DEFAULT_PROFILE_COINS + 700);
    expect(snapshot.transactions.some((transaction) => transaction.reason === 'pay_demo_complete')).toBe(true);
  });

  it('persists account bindings and sessions through the SQLite store', () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'bitkingdom-account-sqlite-')), 'store.sqlite');
    const firstStore = createSQLiteStore(dbPath);
    const firstProfiles = createProfileService(firstStore);
    const firstAccounts = createAccountService(firstStore, firstProfiles);
    const created = firstAccounts.registerAccount({ accountName: 'sqlite_user', password: 'secret123', playerName: '库房掌柜' });

    const secondStore = createSQLiteStore(dbPath);
    const secondProfiles = createProfileService(secondStore);
    const secondAccounts = createAccountService(secondStore, secondProfiles);
    const restored = secondAccounts.getSessionSnapshot(created.sessionToken);
    const loggedIn = secondAccounts.loginAccount({ accountName: 'sqlite_user', password: 'secret123' });

    expect(restored?.account.profileId).toBe(created.account.profileId);
    expect(restored?.profile.profile.name).toBe('库房掌柜');
    expect(loggedIn.account.profileId).toBe(created.account.profileId);
  });

  it('sanitizes profile names and string settings through DirtyWords', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.getSnapshot('p_dirty', '掌柜dirtywords_1_1').profile;

    expect(created.name).toBe('掌柜***');

    const updated = profiles.updateSettings('p_dirty', { motto: 'hello dirtywords_2_1' }).profile;
    expect(updated.settings.motto).toBe('hello ***');
  });

  it('tracks Notice, Guide, and LanguageName state through profile service', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_system', '掌柜系统');

    profiles.markNoticeRead('p_system', '1');
    profiles.markNoticeRead('p_system', '1');
    profiles.completeGuide('p_system', '1');
    profiles.completeGuide('p_system', '1');
    const renamed = profiles.applyLanguageName('p_system', 5).profile;

    expect(renamed.readNotices).toEqual(['1']);
    expect(renamed.completedGuides).toEqual(['1']);
    expect(renamed.name).toBe(languageNameFromSeed(5));
    expect(renamed.name).not.toMatch(/^languagename_/);
  });

  it('persists Head, Cabinet, and HeroSkin profile selections', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_cosmetic', '掌柜装扮');
    const cabinetItem = firstCabinetEligibleItem();
    const cabinetItemId = `compat_${cabinetItem.id}`;
    profile.codex = [cabinetItemId];

    profiles.selectHead('p_cosmetic', '120000');
    profiles.setCabinetItem('p_cosmetic', cabinetItemId);
    profiles.selectHeroSkin('p_cosmetic', 1410101);

    const next = profiles.getSnapshot('p_cosmetic').profile;
    expect(next.headId).toBe('120000');
    expect(next.cabinetItemIds).toEqual([cabinetItemId]);
    expect(next.selectedHeroSkins?.['101']).toBe(1410101);
  });

  it('rejects and clears Cabinet placement through original quality requirements', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_cabinet_rules', '掌柜柜规');
    const validItem = firstCabinetEligibleItem();
    const invalidItem = firstCabinetIneligibleItem();
    const validItemId = `compat_${validItem.id}`;
    const invalidItemId = `compat_${invalidItem.id}`;
    profile.codex = [validItemId, invalidItemId];

    expect(() => profiles.setCabinetItem(profile.playerId, invalidItemId)).toThrow('藏品品质不符合收藏柜要求');

    profiles.setCabinetItem(profile.playerId, validItemId);
    profiles.clearCabinetItem(profile.playerId, validItemId);
    const snapshot = profiles.getSnapshot(profile.playerId);

    expect(snapshot.profile.cabinetItemIds).toEqual([]);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['cabinet_place', 'cabinet_clear'])
    );
  });

  it('claims collection cabinet income from Item collection_coin and Number bonus', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_collection_income', '掌柜收益');
    const item = Item.find((candidate) =>
      candidate.collection_coin > 0 &&
      candidate.item_type_ids.some((typeId) =>
        Cabinet.some((cabinet) => cabinet.location_type.includes(typeId) && cabinetAcceptsItem(cabinet, candidate))
      )
    )!;
    const itemId = `compat_${item.id}`;
    profile.codex = [itemId];
    profile.lastCollectionIncomeAt = Date.now() - 2 * 3600_000;
    profiles.setCabinetItem(profile.playerId, itemId);

    const beforeSnapshot = profiles.getSnapshot(profile.playerId).profile;
    const beforeCoins = beforeSnapshot.coins;
    const beforeClaimedAt = beforeSnapshot.lastCollectionIncomeAt ?? 0;
    const claimed = profiles.claimCollectionIncome(profile.playerId);

    expect(claimed.profile.coins).toBeGreaterThan(beforeCoins);
    expect(claimed.profile.lastCollectionIncomeAt).toBeGreaterThan(beforeClaimedAt);
    expect(claimed.transactions.map((transaction) => transaction.reason)).toContain('collection_income_claim');
  });

  it('buys shop items through coins and limit records', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_shop', '掌柜乙');

    const bought = profiles.buyShopItem('p_shop', 40001).profile;
    expect(bought.coins).toBe(DEFAULT_PROFILE_COINS - 6_000);
    expect(bought.inventory.some((entry) => entry.refId === '100102')).toBe(true);
    expect(bought.shopPurchases.find((entry) => entry.shopItemId === 40001)?.bought).toBe(1);
    expect(bought.conditionStats?.shopAcquiredItemIds).toContain(100102);

    expect(() => profiles.buyShopItem('p_shop', 40001)).toThrow('商品已达购买上限');
  });

  it('collects and uncollects shop item ids through the Shop collect state', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_shop_collect', '掌柜收藏');

    const collected = [...(profiles.setShopItemCollection('p_shop_collect', 100102, true).profile.shopCollections ?? [])];
    const repeated = [...(profiles.setShopItemCollection('p_shop_collect', 100102, true).profile.shopCollections ?? [])];
    const uncollected = [...(profiles.setShopItemCollection('p_shop_collect', 100102, false).profile.shopCollections ?? [])];

    expect(collected).toEqual([100102]);
    expect(repeated).toEqual([100102]);
    expect(uncollected).toEqual([]);
    expect(() => profiles.setShopItemCollection('p_shop_collect', 99999999, true)).toThrow('收藏商品不存在');
  });

  it('buys exchange shop items through configured item costs', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_exchange_shop', '掌柜兑换');
    const exchangeItem = ShopItem.find((row) => row.id === 502001)!;

    for (const [refId = 0, quantity = 0] of exchangeItem.price) {
      profile.inventory.push({
        key: `item:${refId}`,
        type: 'item',
        refId: String(refId),
        quantity,
        updatedAt: Date.now()
      });
    }

    const bought = profiles.buyShopItem(profile.playerId, exchangeItem.id);

    expect(bought.profile.coins).toBe(DEFAULT_PROFILE_COINS);
    expect(inventoryQuantity(bought.profile, '101')).toBe(11);
    for (const [refId = 0] of exchangeItem.price) {
      expect(inventoryQuantity(bought.profile, String(refId))).toBe(0);
    }
    expect(bought.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['shop_buy_spend_item', 'shop_buy_item'])
    );
  });

  it('refreshes configured shop purchase limits', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_shop_refresh', '掌柜乙二');

    profiles.buyShopItem('p_shop_refresh', 40001);
    expect(() => profiles.buyShopItem('p_shop_refresh', 40001)).toThrow('商品已达购买上限');

    const refreshed = profiles.refreshShop('p_shop_refresh', 4).profile;
    const restockedShopItemIds = refreshed.shopRestocks?.find((entry) => entry.shopId === 4)?.shopItemIds ?? [40001];
    const funded = profiles.completeDemoPayOrder('p_shop_refresh', '6').profile;
    const restockedShopItemId = restockedShopItemIds.find((shopItemId) => {
      const row = ShopItem.find((candidate) => candidate.id === shopItemId);
      return (row?.price[0]?.[1] ?? 0) <= funded.coins;
    }) ?? restockedShopItemIds[0]!;
    const resetBought = refreshed.shopPurchases.find((entry) => entry.shopItemId === 40001)?.bought;
    const restockSize = refreshed.shopRestocks?.find((entry) => entry.shopId === 4)?.shopItemIds.length ?? 0;
    const boughtAgain = profiles.buyShopItem('p_shop_refresh', restockedShopItemId).profile;

    expect(resetBought).toBe(0);
    expect(restockSize).toBeGreaterThan(0);
    expect(boughtAgain.shopPurchases.find((entry) => entry.shopItemId === restockedShopItemId)?.bought).toBe(1);
  });

  it('spends configured Shop ticket refresh cost before restocking', () => {
    const profiles = createProfileService(createMemoryStore());
    const randomShop = Shop.find((row) => row.random > 0 && row.randcounts > 0)!;
    const originalTicket = randomShop.ticket;
    randomShop.ticket = 2;
    try {
      const profile = profiles.getOrCreateProfile('p_shop_ticket_refresh', '掌柜刷新票');
      const refreshed = profiles.refreshShop(profile.playerId, randomShop.id);

      expect(refreshed.profile.tickets.current).toBe(18);
      expect(refreshed.transactions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reason: 'shop_refresh_ticket_spend',
          resource: 'ticket',
          amountChange: -2
        })
      ]));

      const blocked = profiles.getOrCreateProfile('p_shop_ticket_blocked', '掌柜刷新不足');
      blocked.tickets.current = 1;
      expect(() => profiles.refreshShop(blocked.playerId, randomShop.id)).toThrow('竞拍票不足');
      expect(profiles.getSnapshot(blocked.playerId).profile.shopRestocks?.find((entry) => entry.shopId === randomShop.id)).toBeUndefined();
    } finally {
      randomShop.ticket = originalTicket;
    }
  });

  it('rejects manual refresh for fixed Shop rows', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_shop_fixed_refresh', '掌柜固定商铺');
    const fixedShop = Shop.find((row) => row.random === 0 && row.randcounts === 0 && row.autofresh === 0)!;

    expect(() => profiles.refreshShop('p_shop_fixed_refresh', fixedShop.id)).toThrow('商店不支持刷新');
  });

  it('auto refreshes expired Shop restock windows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_shop_auto', '掌柜自动刷新');
    profiles.refreshShop('p_shop_auto', 4);
    const restock = profile.shopRestocks?.find((entry) => entry.shopId === 4);
    expect(restock?.nextRefreshAt).toBeGreaterThan(restock?.refreshedAt ?? 0);

    restock!.refreshedAt = 1;
    restock!.nextRefreshAt = 1;
    const refreshed = profiles.getSnapshot('p_shop_auto').profile.shopRestocks?.find((entry) => entry.shopId === 4);

    expect(refreshed?.refreshedAt).toBeGreaterThan(1);
    expect(refreshed?.nextRefreshAt).toBeGreaterThan(refreshed?.refreshedAt ?? 0);
  });

  it('equips owned battle items through the BattleItem table', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_battle_item', '掌柜丁');

    expect(() => profiles.equipBattleItems('p_battle_item', [100102])).toThrow('库存不足');

    profiles.buyShopItem('p_battle_item', 40001);
    const equipped = profiles.equipBattleItems('p_battle_item', [100102]).profile;

    expect(equipped.equippedBattleItems).toEqual([
      expect.objectContaining({ itemId: 100102, quantity: 1 })
    ]);
  });

  it('consumes equipped battle items when used in battle', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_use_item', '掌柜丁二');
    profiles.buyShopItem('p_use_item', 40001);
    profiles.equipBattleItems('p_use_item', [100102]);

    const used = profiles.useBattleItem('p_use_item', 100102).profile;

    expect(used.inventory.some((entry) => entry.refId === '100102')).toBe(false);
    expect(used.equippedBattleItems).toEqual([]);
    expect(used.conditionStats).toEqual(expect.objectContaining({
      usedItemCount: 1,
      usedItemCountsById: expect.objectContaining({ 100102: 1 })
    }));
    expect(Object.values(used.conditionStats?.dailyUsedItemCount ?? {})).toContain(1);
    expect(used.missionProgress?.['1000301']).toEqual(expect.objectContaining({
      current: 1,
      required: 1,
      completed: true
    }));
  });

  it('claims RankReward rows from ranking ranges without inventing rewards', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_rank', '掌柜戊');

    profiles.claimRankReward('p_rank', 1);
    profiles.claimRankReward('p_rank', 1);

    const snapshot = profiles.getSnapshot('p_rank');
    expect(snapshot.profile.claimedRankRewards).toEqual(['1']);
    expect(snapshot.profile.inventory.find((entry) => entry.refId === '10002')).toBeUndefined();
    expect(snapshot.transactions.filter((transaction) => transaction.reason === 'rank_reward_claim')).toHaveLength(1);
  });

  it('claims completed mission rewards once through Mission rows', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_mission', '掌柜己');

    expect(() => profiles.claimMissionReward('p_mission', 'daily_complete_match')).toThrow('任务尚未完成');

    profiles.completeTask('p_mission', 'daily_complete_match');
    profiles.claimMissionReward('p_mission', 'daily_complete_match');
    profiles.claimMissionReward('p_mission', 'daily_complete_match');

    const profile = profiles.getSnapshot('p_mission').profile;
    expect(profile.claimedMissionRewards).toEqual(['daily_complete_match']);
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + 5_000);
  });

  it('claims refreshable Mission rewards once per table refresh period', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-20T01:00:00+08:00'));
      const profiles = createProfileService(createMemoryStore());
      const dailyMission = Mission.find((mission) => mission.refreshtype === 1)!;
      const taskId = String(dailyMission.Id);
      const created = profiles.getOrCreateProfile('p_daily_mission', '掌柜每日');
      created.completedMatches = ['match_daily_1'];

      profiles.claimMissionReward('p_daily_mission', taskId);
      profiles.claimMissionReward('p_daily_mission', taskId);

      const firstDay = profiles.getSnapshot('p_daily_mission').profile;
      expect(firstDay.claimedMissionRewards.filter((claim) => claim.startsWith(`${taskId}@daily:`))).toHaveLength(1);
      expect(firstDay.missionRewardClaims?.[taskId]?.periodKey).toBe('daily:2026-05-20');
      expect(firstDay.missionProgress?.[taskId]?.claimable).toBe(false);

      vi.setSystemTime(new Date('2026-05-21T01:00:00+08:00'));
      profiles.claimMissionReward('p_daily_mission', taskId);

      const secondDay = profiles.getSnapshot('p_daily_mission').profile;
      expect(secondDay.claimedMissionRewards.filter((claim) => claim.startsWith(`${taskId}@daily:`))).toHaveLength(2);
      expect(secondDay.missionRewardClaims?.[taskId]?.periodKey).toBe('daily:2026-05-21');
    } finally {
      vi.useRealTimers();
    }
  });

  it('claims successive Achievement mission rewards through Achievement rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.getOrCreateProfile('p_achievement', '掌柜成就');
    created.completedMatches = Array.from({ length: 30 }, (_, index) => `match_achievement_${index + 1}`);

    profiles.claimAchievementReward('p_achievement', '1001101');
    profiles.claimAchievementReward('p_achievement', '1001101');

    const profile = profiles.getSnapshot('p_achievement').profile;
    expect(profile.claimedAchievements).toEqual(['5101001', '5101002']);
    expect(profile.inventory.find((entry) => entry.refId === '131011')?.quantity).toBe(1);
  });

  it('claims LevelUp rewards once when the profile level is high enough', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_level', '掌柜等级');

    profiles.claimLevelReward('p_level', 1);
    profiles.claimLevelReward('p_level', 1);

    const profile = profiles.getSnapshot('p_level').profile;
    expect(profile.claimedLevelRewards).toEqual([1]);
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + 10_000);
    expect(() => profiles.claimLevelReward('p_level', 2)).toThrow('掌柜等级不足');
  });

  it('claims all LevelUp reward columns once', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_level_all_rewards', '掌柜等级全奖');
    profile.level = 2;

    profiles.claimLevelReward('p_level_all_rewards', 2);
    profiles.claimLevelReward('p_level_all_rewards', 2);

    const snapshot = profiles.getSnapshot('p_level_all_rewards').profile;
    expect(snapshot.coins).toBe(DEFAULT_PROFILE_COINS + 80_000);
    expect(snapshot.inventory.find((entry) => entry.refId === '100129')?.quantity).toBe(5);
    expect(snapshot.inventory.find((entry) => entry.refId === '7201')?.quantity).toBe(1);
    expect(snapshot.claimedLevelRewards).toEqual([2]);
  });

  it('claims configured Mail attachment rewards', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.getOrCreateProfile('p_mail', '掌柜庚');
    const attachmentMail = addMailFromTemplate(created, '1001', 'test_attachment');

    expect(attachmentMail).toBeDefined();

    profiles.claimMail('p_mail', attachmentMail!.id);
    profiles.claimMail('p_mail', attachmentMail!.id);

    const profile = profiles.getSnapshot('p_mail').profile;
    expect(profile.inventory.find((entry) => entry.refId === '140009')?.quantity).toBe(1);
    expect(profile.inventory.find((entry) => entry.refId === '150019')?.quantity).toBe(1);
  });

  it('marks, protects, expires, and deletes Mail inbox entries', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.getOrCreateProfile('p_mail_state', '掌柜邮件状态');
    const unreadMail = addMailFromTemplate(created, '101', 'test_unread')!;
    const attachmentMail = addMailFromTemplate(created, '1001', 'test_attachment')!;

    profiles.markMailRead('p_mail_state', unreadMail.id);
    expect(profiles.getSnapshot('p_mail_state').profile.mail.find((mail) => mail.id === unreadMail.id)?.read).toBe(true);
    expect(() => profiles.deleteMail('p_mail_state', attachmentMail.id)).toThrow('邮件附件未领取');

    profiles.claimMail('p_mail_state', attachmentMail.id);
    profiles.deleteMail('p_mail_state', attachmentMail.id);
    expect(profiles.getSnapshot('p_mail_state').profile.mail.some((mail) => mail.id === attachmentMail.id)).toBe(false);

    const expiredProfile = profiles.getOrCreateProfile('p_mail_expired', '掌柜过期邮件');
    const expiredMail = addMailFromTemplate(expiredProfile, '101', 'test_expired')!;
    expiredMail.expiresAt = Date.now() - 1;
    expect(() => profiles.claimMail('p_mail_expired', expiredMail.id)).toThrow('邮件已过期');
    profiles.deleteMail('p_mail_expired', expiredMail.id);
    expect(profiles.getSnapshot('p_mail_expired').profile.mail.some((mail) => mail.id === expiredMail.id)).toBe(false);
  });

  it('creates local market orders and locks listed inventory', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_market', '掌柜辛');
    profiles.buyShopItem('p_market', 40001);

    const listed = profiles.createMarketOrder('p_market', '100102', 1, 8800, 'trade', 'hello dirtywords_2_1').profile;

    expect(listed.inventory.some((entry) => entry.refId === '100102')).toBe(false);
    expect(listed.marketOrders).toEqual([
      expect.objectContaining({
        note: 'hello ***',
        orderType: 'trade',
        refId: '100102',
        quantity: 1,
        price: 8800,
        totalPrice: 8800,
        listingFee: 44,
        tax: 1010,
        listingCost: 88,
        fee: 1054,
        netPrice: 7746,
        status: 'listed'
      })
    ]);
    expect(listed.marketOrders[0]?.expiresAt).toBeGreaterThan(listed.marketOrders[0]?.createdAt ?? 0);
  });

  it('enforces Item max_stack_size and max_per_listing when listing market orders', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_limit', '掌柜限量');
    grantInventory(profile, '100102', 11);

    expect(() => profiles.createMarketOrder('p_market_limit', '100102', 11, 8800, 'trade')).toThrow('单笔上架数量不能超过 10');

    const listed = profiles.createMarketOrder('p_market_limit', '100102', 10, 8800, 'trade').profile;
    expect(listed.marketOrders[0]).toEqual(expect.objectContaining({ quantity: 10, status: 'listed' }));
  });

  it('settles market orders with Item transaction tax fees', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_market_fee', '掌柜手续费');
    profiles.buyShopItem('p_market_fee', 40001);
    const order = profiles.createMarketOrder('p_market_fee', '100102', 1, 8800, 'trade').profile.marketOrders[0]!;

    const settled = profiles.settleMarketOrder('p_market_fee', order.id).profile;
    const transactions = profiles.getSnapshot('p_market_fee').transactions;

    expect(settled.marketOrders[0]).toEqual(expect.objectContaining({ status: 'sold', listingFee: 44, tax: 1010, fee: 1054, netPrice: 7746 }));
    expect(settled.coins).toBe(DEFAULT_PROFILE_COINS + 1_658);
    expect(transactions.some((entry) => entry.reason === 'market_order_listing_cost' && entry.amountChange === -88)).toBe(true);
    expect(transactions.some((entry) => entry.reason === 'market_order_fee' && entry.amountChange === -1054)).toBe(true);
  });

  it('settles global market orders between seller and buyer profiles', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_market_seller', '卖家掌柜');
    const buyerBefore = profiles.getOrCreateProfile('p_market_buyer', '买家掌柜').coins;
    profiles.buyShopItem('p_market_seller', 40001);
    const listed = profiles.createMarketOrder('p_market_seller', '100102', 1, 1000, 'trade').profile;
    const sellerBefore = listed.coins;
    const order = listed.marketOrders[0]!;

    const buyerSnapshot = profiles.settleMarketOrder('p_market_buyer', order.id);
    const sellerSnapshot = profiles.getSnapshot('p_market_seller');
    const soldOrder = sellerSnapshot.profile.marketOrders.find((candidate) => candidate.id === order.id)!;

    expect(buyerSnapshot.profile.coins).toBe(buyerBefore - order.price);
    expect(buyerSnapshot.profile.inventory.find((entry) => entry.refId === '100102')?.quantity).toBe(1);
    expect(soldOrder).toEqual(expect.objectContaining({ status: 'sold', buyerId: 'p_market_buyer' }));
    expect(sellerSnapshot.profile.coins).toBe(sellerBefore + order.price - (order.fee ?? 0));
    expect(buyerSnapshot.profile.conditionStats?.tradeBoughtCount).toBe(1);
    expect(sellerSnapshot.profile.conditionStats?.tradeSoldCount).toBe(1);
    expect(buyerSnapshot.profile.missionProgress?.['1001201']).toEqual(expect.objectContaining({
      current: 1,
      completed: true,
      claimable: true
    }));
    expect(sellerSnapshot.profile.missionProgress?.['1001101']).toEqual(expect.objectContaining({
      current: 1,
      completed: true,
      claimable: true
    }));
    expect(buyerSnapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['market_order_buy_spend', 'market_order_bought_item'])
    );
  });

  it('keeps listed market orders intact when a buyer cannot pay', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_market_broke_seller', '卖家缺钱测试');
    const buyer = profiles.getOrCreateProfile('p_market_broke_buyer', '买家缺钱测试');
    buyer.coins = 0;
    grantInventory(seller, '100102', 1);
    const order = profiles.createMarketOrder('p_market_broke_seller', '100102', 1, 1000, 'trade').profile.marketOrders[0]!;

    expect(() => profiles.settleMarketOrder('p_market_broke_buyer', order.id)).toThrow('买家铜钱不足');

    const sellerSnapshot = profiles.getSnapshot('p_market_broke_seller').profile;
    expect(sellerSnapshot.marketOrders[0]).toEqual(expect.objectContaining({ id: order.id, status: 'listed' }));
    expect(inventoryQuantity(sellerSnapshot, '100102')).toBe(0);
  });

  it('settles and cancels local market orders', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_actions', '掌柜辛二');
    grantInventory(profile, '100102', 2);
    const tradeOrder = profiles.createMarketOrder('p_market_actions', '100102', 1, 1200, 'trade').profile.marketOrders[0]!;
    const sold = profiles.settleMarketOrder('p_market_actions', tradeOrder.id).profile;

    expect(sold.marketOrders[0]?.status).toBe('sold');
    expect(sold.coins).toBe(DEFAULT_PROFILE_COINS + 1_122);

    const auctionOrder = profiles.createMarketOrder('p_market_actions', '100102', 1, 1500, 'auction').profile.marketOrders[0]!;
    const cancelled = profiles.cancelMarketOrder('p_market_actions', auctionOrder.id).profile;

    expect(cancelled.marketOrders[0]?.status).toBe('cancelled');
    expect(inventoryQuantity(cancelled, '100102')).toBe(1);
  });

  it('lists global market orders for audit and UI snapshots', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_audit', '掌柜市场');
    grantInventory(profile, '100102', 2);
    const order = profiles.createMarketOrder('p_market_audit', '100102', 2, 2400, 'trade').profile.marketOrders[0]!;

    const snapshot = profiles.listMarketOrders('trade');

    expect(snapshot.orders).toEqual([
      expect.objectContaining({ id: order.id, playerId: 'p_market_audit', playerName: '掌柜市场', orderType: 'trade' })
    ]);
  });

  it('expires listed market orders and returns locked inventory', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_expire', '掌柜过期');
    grantInventory(profile, '100102', 1);
    const order = profiles.createMarketOrder('p_market_expire', '100102', 1, 2400, 'trade').profile.marketOrders[0]!;
    profiles.getOrCreateProfile('p_market_expire').marketOrders[0]!.expiresAt = Date.now() - 1;

    const snapshot = profiles.listMarketOrders('trade');
    const sellerSnapshot = profiles.getSnapshot('p_market_expire');

    expect(snapshot.orders.find((candidate) => candidate.id === order.id)).toEqual(expect.objectContaining({ status: 'expired' }));
    expect(sellerSnapshot.profile.marketOrders[0]).toEqual(expect.objectContaining({ status: 'expired' }));
    expect(inventoryQuantity(sellerSnapshot.profile, '100102')).toBe(1);
    expect(sellerSnapshot.transactions.some((entry) => entry.reason === 'market_order_expired_return')).toBe(true);
  });

  it('enforces original market slot and mail-cap constants before listing', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_slots', '掌柜槽位');
    grantInventory(profile, '100102', 6);

    for (let index = 0; index < 5; index += 1) {
      profiles.createMarketOrder('p_market_slots', '100102', 1, 1000 + index * 100, 'trade');
    }

    expect(() => profiles.createMarketOrder('p_market_slots', '100102', 1, 2000, 'trade')).toThrow('上架槽位已满');

    const fullMail = profiles.getOrCreateProfile('p_market_mail_full', '掌柜信箱满');
    fullMail.mail = Array.from({ length: 100 }, (_, index) => ({
      id: `mail_full_${index}`,
      templateId: '101',
      title: '测试邮件',
      body: '测试',
      read: true,
      claimed: true,
      attachmentSummary: '无附件',
      createdAt: Date.now() - index
    }));
    grantInventory(fullMail, '100102', 1);

    expect(() => profiles.createMarketOrder('p_market_mail_full', '100102', 1, 1000, 'trade')).toThrow('信箱已满');
  });

  it('claims relief fund only when total assets are below the original limit', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_relief', '掌柜救济');
    profile.coins = 0;
    profile.inventory = [];
    profile.cabinetItemIds = [];

    const relief = profiles.getReliefFundSnapshot(profile.playerId);
    expect(relief).toEqual(expect.objectContaining({
      eligible: true,
      limit: 100000,
      rewardCoins: 100000
    }));

    const claimed = profiles.claimReliefFund(profile.playerId);
    expect(claimed.profile.coins).toBe(100000);
    expect(claimed.profile.settings.bidkingReliefFundClaims).toBe(1);
    expect(claimed.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['relief_fund_reward_coins', 'relief_fund_claim'])
    );
    expect(profiles.getReliefFundSnapshot(profile.playerId).eligible).toBe(false);
  });

  it('builds rank snapshots from server profiles', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_rank_snapshot_a', '掌柜甲');
    profiles.getOrCreateProfile('p_rank_snapshot_b', '掌柜乙');
    profiles.claimRankReward('p_rank_snapshot_b', 1);
    const summary: FinalMatchSummary = {
      matchId: 'match_rank_snapshot',
      seed: 2,
      rankings: [],
      netWorthCurve: [],
      bestMove: { title: '测试', detail: '测试' },
      biggestMistake: { title: '测试', detail: '测试' },
      revealedItems: [],
      rewards: [{ playerId: 'p_rank_snapshot_b', xp: 0, coins: 0, rankPoints: 12 }],
      eventCount: 0,
      transactionCount: 0
    };
    profiles.applyMatchSummary('p_rank_snapshot_b', summary);

    const snapshot = profiles.getRankSnapshot('101');

    expect(snapshot.rankId).toBe('101');
    expect(snapshot.isRegional).toBe(true);
    expect(snapshot.isDated).toBe(true);
    expect(snapshot.isRoleBased).toBe(true);
    expect(snapshot.sortDirection).toBe('desc');
    expect(snapshot.entries[0]).toEqual(expect.objectContaining({ playerId: 'p_rank_snapshot_b', rank: 1, rankPoints: 12 }));
  });

  it('paginates rank snapshots while preserving absolute rank numbers', () => {
    const profiles = createProfileService(createMemoryStore());
    Array.from({ length: 12 }, (_, index) => {
      const profile = profiles.getOrCreateProfile(`p_rank_page_${index}`, `掌柜分页${index}`);
      profile.rankPoints = 120 - index;
    });

    const snapshot = profiles.getRankSnapshot('101', 2, 5);

    expect(snapshot.page).toBe(2);
    expect(snapshot.pageSize).toBe(5);
    expect(snapshot.totalEntries).toBe(12);
    expect(snapshot.totalPages).toBe(3);
    expect(snapshot.entries.map((entry) => entry.rank)).toEqual([6, 7, 8, 9, 10]);
  });

  it('claims Activity rewards once', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_activity', '掌柜壬');

    profiles.claimActivityReward('p_activity', '10001');
    profiles.claimActivityReward('p_activity', '10001');

    const profile = profiles.getSnapshot('p_activity').profile;
    expect(profile.claimedActivityRewards).toEqual(['10001']);
    expect(profile.inventory.find((entry) => entry.refId === '301')?.quantity).toBe(4);
  });

  it('blocks expired Activity rewards by original duration window', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_activity_expired', '掌柜活动过期');
    profile.createdAt = Date.now() - 86_401_000;

    expect(() => profiles.claimActivityReward('p_activity_expired', '10001')).toThrow('活动已过期');
  });

  it('builds Activity progress from profile state and original panel targets', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_activity_progress', '掌柜活动进度');
    profile.rankPoints = 135;
    profiles.addDemoFriend(profile.playerId);
    profiles.joinGuild(profile.playerId);

    const beforeClaim = profiles.getActivityProgress(profile.playerId);
    const rewardActivity = beforeClaim.activities.find((activity) => activity.activityId === '10001')!;
    const rankActivity = beforeClaim.activities.find((activity) => activity.panelName === 'ActivityPanel_Rank')!;
    const socialActivity = beforeClaim.activities.find((activity) => activity.panelName === 'ActivityPanel_Social')!;

    expect(beforeClaim.activities).toHaveLength(Activity.length);
    expect(rewardActivity).toEqual(expect.objectContaining({ claimable: true, redPoint: true, actionTarget: 'claim' }));
    expect(rankActivity).toEqual(expect.objectContaining({ progress: 135, actionTarget: 'rank' }));
    expect(socialActivity).toEqual(expect.objectContaining({ progress: 2, target: 2, completed: true }));

    profiles.claimActivityReward(profile.playerId, '10001');
    const afterClaim = profiles.getActivityProgress(profile.playerId).activities.find((activity) => activity.activityId === '10001')!;

    expect(afterClaim.claimed).toBe(true);
    expect(afterClaim.claimable).toBe(false);
    expect(afterClaim.redPoint).toBe(false);
  });

  it('claims GiftPackage rewards once through packaged rows', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_gift', '掌柜礼包');

    expect(() => profiles.claimGiftPackage('p_gift', '1')).toThrow('礼包对应充值未到账');
    profiles.completeDemoPayOrder('p_gift', '1');
    profiles.claimGiftPackage('p_gift', '1');
    profiles.claimGiftPackage('p_gift', '1');

    const profile = profiles.getSnapshot('p_gift').profile;
    expect(profile.claimedGiftPackages).toEqual(['1']);
    expect(profile.inventory.find((entry) => entry.refId === '2')?.quantity).toBe(60);
  });

  it('completes demo pay orders once through Pay rows', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_pay', '掌柜充值');
    const payRuntime = bidKingPayRuntime(Pay[0]!);

    const created = profiles.createDemoPayOrder('p_pay', payRuntime.payId).profile;
    expect(created.purchaseOrders?.[0]).toEqual(expect.objectContaining({
      source: 'pay',
      refId: payRuntime.payId,
      status: 'created',
      coins: payRuntime.totalCoins,
      price: payRuntime.rmb
    }));

    profiles.completeDemoPayOrder('p_pay', payRuntime.payId);
    profiles.completeDemoPayOrder('p_pay', payRuntime.payId);

    const profile = profiles.getSnapshot('p_pay').profile;
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + payRuntime.totalCoins);
    expect(profile.purchaseOrders?.filter((order) => order.source === 'pay' && order.refId === payRuntime.payId && order.status === 'completed')).toHaveLength(1);
  });

  it('cancels created demo pay orders before completion', () => {
    const profiles = createProfileService(createMemoryStore());
    const created = profiles.createDemoPayOrder('p_pay_cancel', '2').profile;
    const order = created.purchaseOrders?.[0];

    expect(order).toBeDefined();
    profiles.cancelDemoPayOrder('p_pay_cancel', order!.id);

    const profile = profiles.getSnapshot('p_pay_cancel').profile;
    expect(profile.purchaseOrders?.[0]?.status).toBe('cancelled');
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS);
  });

  it('completes PurchaseList demo orders through mapped Pay rows', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_purchase', '掌柜平台');

    profiles.completePurchaseListOrder('p_purchase', '1001');
    profiles.completePurchaseListOrder('p_purchase', '1001');

    const profile = profiles.getSnapshot('p_purchase').profile;
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + 700);
    expect(profile.purchaseOrders?.filter((order) => order.source === 'purchaseList' && order.refId === '1001' && order.status === 'completed')).toHaveLength(1);
  });

  it('unlocks Dlc rows once and applies configured rewards', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_dlc', '掌柜扩展');
    const dlcRuntime = bidKingDlcRuntime(Dlc[0]!);

    profiles.unlockDemoDlc('p_dlc', dlcRuntime.platformSku);
    profiles.unlockDemoDlc('p_dlc', dlcRuntime.platformSku);

    const profile = profiles.getSnapshot('p_dlc').profile;
    expect(profile.dlcUnlocks).toEqual([dlcRuntime.dlcId]);
    expect(profile.purchaseOrders?.find((order) => order.source === 'dlc' && order.refId === dlcRuntime.platformSku)).toEqual(expect.objectContaining({
      price: dlcRuntime.price,
      status: 'completed'
    }));
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + 2_000_000);
    expect(profile.inventory.find((entry) => entry.refId === '7101')?.quantity).toBe(3);
    expect(profile.inventory.find((entry) => entry.refId === '2')?.quantity).toBe(200);
    expect(profile.mail.filter((mail) => mail.templateId === dlcRuntime.mailTemplateId)).toHaveLength(1);
  });

  it('writes local friend and guild state', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_social', '掌柜癸');

    profiles.addDemoFriend('p_social');
    profiles.joinGuild('p_social');
    profiles.donateGuildCoins('p_social', 1000);

    const profile = profiles.getSnapshot('p_social').profile;
    expect(profile.friends).toHaveLength(1);
    expect(profile.friends[0]?.name).toBe(languageNameFromSeed(1));
    expect(profile.guildMembership?.roleId).toBe('1');
    expect(profile.guildMembership?.points).toBe(20);
    expect(profile.guildMembership?.permissions?.manageResource).toBe(true);
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS - 1_000);
  });

  it('enforces GuildPermissions.donate before guild coin donation', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_donate_perm', '掌柜捐献权限');
    profiles.joinGuild('p_guild_donate_perm');
    profiles.setGuildRole('p_guild_donate_perm', '3');

    expect(() => profiles.donateGuildCoins('p_guild_donate_perm', 1000)).toThrow('协会权限不足');

    const profile = profiles.getSnapshot('p_guild_donate_perm').profile;
    expect(profile.guildMembership?.roleId).toBe('3');
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS);
  });

  it('generates repeatable LanguageName batches for social actors', () => {
    expect(languageNamesFromSeed(1, 3)).toEqual([languageNameFromSeed(1), languageNameFromSeed(2), languageNameFromSeed(3)]);
    expect(languageNamesFromSeed(1, 0)).toEqual([]);
  });

  it('adds and removes friends through profile state and ledger', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_friend_state', '掌柜好友状态');

    const added = profiles.addDemoFriend('p_friend_state').profile.friends[0]!;
    const removed = profiles.removeFriend('p_friend_state', added.id);

    expect(removed.profile.friends).toHaveLength(0);
    expect(removed.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['friend_add', 'friend_remove'])
    );
    expect(() => profiles.removeFriend('p_friend_state', added.id)).toThrow('好友不存在');
  });

  it('filters social remarks and guild notices through DirtyWords', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_social_dirty', '掌柜社交过滤');
    const friend = profiles.addDemoFriend('p_social_dirty').profile.friends[0]!;

    profiles.setFriendRemark('p_social_dirty', friend.id, 'hello dirtywords_2_1');
    profiles.joinGuild('p_social_dirty');
    profiles.updateGuildNotice('p_social_dirty', 'notice dirtywords_1_1');

    const snapshot = profiles.getSnapshot('p_social_dirty');
    expect(snapshot.profile.friends[0]?.remark).toBe('hello ***');
    expect(snapshot.profile.guildMembership?.notice).toBe('notice ***');
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['friend_remark_update', 'guild_notice_update'])
    );

    profiles.setGuildRole('p_social_dirty', '3');
    expect(() => profiles.updateGuildNotice('p_social_dirty', 'new notice')).toThrow('协会权限不足');
  });

  it('uses GuildPoints ranges for configured donation rewards', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_points', '掌柜协会积分');

    profiles.completeDemoPayOrder('p_guild_points', '6');
    profiles.joinGuild('p_guild_points');
    profiles.donateGuildCoins('p_guild_points', 50_000);

    const profile = profiles.getSnapshot('p_guild_points').profile;
    expect(profile.guildMembership?.points).toBe(11);
  });

  it('changes GuildArea membership without resetting guild points or resources', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_area', '掌柜地区');

    profiles.joinGuild('p_guild_area', '101');
    profiles.donateGuildCoins('p_guild_area', 1000);
    profiles.claimGuildResource('p_guild_area', '1001');
    profiles.joinGuild('p_guild_area', '102');

    const snapshot = profiles.getSnapshot('p_guild_area');
    expect(snapshot.profile.guildMembership?.areaId).toBe('102');
    expect(snapshot.profile.guildMembership?.points).toBe(20);
    expect(snapshot.profile.guildMembership?.resources?.['1001']).toBe(1);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['guild_join_area', 'guild_area_change'])
    );
  });

  it('changes guild roles through GuildPermissions when allowed', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_role', '掌柜协会职位');

    profiles.joinGuild('p_guild_role');
    const changed = profiles.setGuildRole('p_guild_role', '2').profile;

    expect(changed.guildMembership?.roleId).toBe('2');
    expect(changed.guildMembership?.permissions?.changeRole).toBe(true);
    expect(changed.guildMembership?.permissions?.manageResource).toBe(false);
    expect(() => profiles.claimGuildResource('p_guild_role', '1001')).toThrow('协会权限不足');
  });

  it('approves and kicks demo guild members through GuildPermissions', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_members', '掌柜成员');

    profiles.joinGuild('p_guild_members');
    const requested = profiles.addDemoGuildApplication('p_guild_members').profile.guildMembership!;
    const applicant = requested.pendingApplications?.[0]!;

    expect(applicant.status).toBe('pending');
    const approved = profiles.approveGuildMember('p_guild_members', applicant.playerId).profile.guildMembership!;
    expect(approved.pendingApplications).toHaveLength(0);
    expect(approved.members?.find((member) => member.playerId === applicant.playerId)).toEqual(expect.objectContaining({
      name: applicant.name,
      roleId: '3',
      status: 'member'
    }));

    const kicked = profiles.kickGuildMember('p_guild_members', applicant.playerId);
    expect(kicked.profile.guildMembership?.members?.some((member) => member.playerId === applicant.playerId)).toBe(false);
    expect(kicked.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['guild_member_apply', 'guild_member_approve', 'guild_member_kick'])
    );

    profiles.setGuildRole('p_guild_members', '3');
    expect(() => profiles.addDemoGuildApplication('p_guild_members')).toThrow('协会权限不足');
    expect(() => profiles.kickGuildMember('p_guild_members', 'missing_member')).toThrow('协会权限不足');
  });

  it('claims configured guild resources with permission state', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_resource', '掌柜协会');

    profiles.joinGuild('p_guild_resource');
    profiles.claimGuildResource('p_guild_resource', '1001');
    profiles.claimGuildResource('p_guild_resource', '1001');
    profiles.useGuildResource('p_guild_resource', '1001');

    const profile = profiles.getSnapshot('p_guild_resource').profile;
    expect(profile.guildMembership?.resources?.['1001']).toBe(1);
    expect(profile.guildMembership?.permissions?.manageResource).toBe(true);
  });

  it('builds Area, Number, ExchangeRestock, and Sim runtime snapshots', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_snapshots', '掌柜快照');
    profile.codex = Array.from({ length: 500 }, (_, index) => `compat_${index + 1}`);
    profiles.joinGuild('p_snapshots', '101');
    profiles.donateGuildCoins('p_snapshots', 1000);

    const area = profiles.getAreaSnapshot();
    const bonus = profiles.getCollectionBonus('p_snapshots');
    const exchange = profiles.getExchangeRestockSnapshot();
    const sim = profiles.getSimSnapshot();

    expect(area.areas[0]).toEqual(expect.objectContaining({ areaId: '101', guildCount: 1 }));
    expect(area.areas[0]?.recommendedNames).toEqual(languageNamesFromSeed(Number(area.areas[0]!.guildAreaId ?? area.areas[0]!.areaId) * 10, 3));
    expect(bonus.activeBonus).toBeGreaterThan(0);
    expect(exchange.pools).toHaveLength(4);
    expect(sim.plans[0]).toEqual(expect.objectContaining({ id: '1', botCount: 6, roomBotCount: 3, roundCount: 5 }));
  });

  it('lists recent profile transactions for admin ledger audit', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_admin_ledger', '掌柜账本');

    profiles.completeDemoPayOrder('p_admin_ledger', '1');
    profiles.completeTask('p_admin_ledger', 'daily_complete_match');
    profiles.claimMissionReward('p_admin_ledger', 'daily_complete_match');

    const allTransactions = profiles.listTransactions(10);
    const playerTransactions = profiles.listTransactions(10, 'p_admin_ledger');

    expect(allTransactions.length).toBeGreaterThanOrEqual(2);
    expect(playerTransactions.every((transaction) => transaction.playerId === 'p_admin_ledger')).toBe(true);
    expect(playerTransactions.map((transaction) => transaction.reason)).toEqual(expect.arrayContaining(['pay_demo_complete', 'mission_reward_coins']));
  });

  it('applies match rewards once and marks basic mission tasks', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_match', '掌柜丙');
    const summary: FinalMatchSummary = {
      matchId: 'match_profile_test',
      seed: 1,
      rankings: [
        {
          playerId: 'p_match',
          name: '掌柜丙',
          rank: 1,
          cash: 120000,
          holdingsValue: 30000,
          setBonus: 0,
          netWorth: 150000
        }
      ],
      netWorthCurve: [],
      bestMove: { title: '稳健成交', detail: '测试' },
      biggestMistake: { title: '无', detail: '测试' },
      revealedItems: [
        {
          id: 'compat_100102_1',
          name: '测试藏品',
          category: '测试',
          rarity: 'rare',
          value: 1000,
          displayValue: 1000,
          isFake: false,
          repairCost: 0,
          iconKey: 'bidking_item_100102',
          footprint: { w: 1, h: 1 }
        }
      ],
      awardedItemsByPlayerId: {
        p_match: [
          {
            id: 'compat_100102_1',
            name: '测试藏品',
            category: '测试',
            rarity: 'rare',
            value: 1000,
            displayValue: 1000,
            isFake: false,
            repairCost: 0,
            iconKey: 'bidking_item_100102',
            footprint: { w: 1, h: 1 }
          }
        ]
      },
      auctionStats: [{
        playerId: 'p_match',
        totalProfit: 150000,
        netProfit: 150000,
        successfulAuctionCount: 1,
        failedAuctionCount: 1,
        highestBidAmount: 160000,
        highestSingleAuctionProfit: 150000,
        currentTotalAssets: 260000,
        highestItemValue: 12000,
        highestWinningItemTotalValue: 12000,
        lowestWinningItemTotalValue: 12000,
        completedMapIds: [101],
        completedBidMapIds: [],
        successfulAuctionCountByMap: { 101: 1 },
        lowestWinningItemTotalValueByMap: { 101: 12000 },
        lowestWinningItemTotalValueByBidMap: {}
      }],
      rewards: [{ playerId: 'p_match', xp: 80, coins: 0, rankPoints: 8 }],
      eventCount: 0,
      transactionCount: 0
    };

    profiles.applyMatchSummary('p_match', summary);
    profiles.applyMatchSummary('p_match', summary);

    const profile = profiles.getSnapshot('p_match').profile;
    expect(profile.completedMatches).toEqual(['match_profile_test']);
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS);
    expect(profile.rankPoints).toBe(8);
    expect(inventoryQuantity(profile, 'compat_100102')).toBe(1);
    expect(profile.completedTasks).toEqual(expect.arrayContaining(['daily_complete_match', 'daily_light_codex', 'ach_rare_collector']));
    expect(profile.auctionStats).toEqual(expect.objectContaining({
      totalProfit: 150000,
      successfulAuctionCount: 1,
      failedAuctionCount: 1,
      highestBidAmount: 160000,
      highestSingleAuctionProfit: 150000,
      currentTotalAssets: 260000,
      highestItemValue: 12000
    }));
    expect(profile.auctionStats?.completedMapIds).toContain(101);
    expect(profile.auctionStats?.successfulAuctionCountByMap?.['101']).toBe(1);
    expect(Object.values(profile.auctionStats?.dailyProfit ?? {})).toContain(150000);
    expect(profile.conditionStats?.auctionAcquiredItemIds).toContain(100102);
    expect(profile.missionProgress?.daily_complete_match).toEqual(expect.objectContaining({
      current: 1,
      required: 1,
      completed: true,
      claimable: true,
      redPoint: true
    }));
    expect(profile.missionProgress?.['3000009']).toEqual(expect.objectContaining({
      current: 150000,
      required: 100000,
      completed: true,
      claimable: true
    }));
    expect(profile.missionProgress?.['1000701']).toEqual(expect.objectContaining({
      current: 1,
      required: 1,
      completed: true
    }));
    expect(profile.missionProgress?.['1001501']).toEqual(expect.objectContaining({
      current: 1,
      required: 1,
      completed: true
    }));

    const sold = profiles.sellInventoryItem('p_match', 'compat_100102', 1).profile;
    expect(inventoryQuantity(sold, 'compat_100102')).toBe(0);
    expect(sold.coins).toBe(DEFAULT_PROFILE_COINS + (Item.find((item) => item.id === 100102)?.base_value ?? 0));
    expect(profiles.getSnapshot('p_match').transactions.map((transaction) => transaction.reason)).toEqual(expect.arrayContaining([
      'match_award_item',
      'cabinet_sell_item',
      'cabinet_sell_coins'
    ]));
  });

  it('adds GuildPoints from completed match profit tiers', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_guild_match', '掌柜协会比赛');
    profiles.joinGuild('p_guild_match');
    const summary: FinalMatchSummary = {
      matchId: 'match_guild_points',
      seed: 3,
      rankings: [
        {
          playerId: 'p_guild_match',
          name: '掌柜协会比赛',
          rank: 1,
          cash: 100000,
          holdingsValue: 50000,
          setBonus: 0,
          netWorth: 150000
        }
      ],
      netWorthCurve: [],
      bestMove: { title: '协会收益', detail: '测试' },
      biggestMistake: { title: '无', detail: '测试' },
      revealedItems: [],
      auctionStats: [{
        playerId: 'p_guild_match',
        totalProfit: 50_000,
        netProfit: 50_000,
        successfulAuctionCount: 1,
        failedAuctionCount: 0,
        highestItemValue: 1000,
        highestWinningItemTotalValue: 1000
      }],
      rewards: [{ playerId: 'p_guild_match', xp: 0, coins: 0, rankPoints: 0 }],
      eventCount: 0,
      transactionCount: 0
    };

    profiles.applyMatchSummary('p_guild_match', summary);
    profiles.applyMatchSummary('p_guild_match', summary);

    const snapshot = profiles.getSnapshot('p_guild_match');
    expect(snapshot.profile.guildMembership?.points).toBe(11);
    expect(snapshot.transactions.some((transaction) => transaction.reason === 'guild_points_match' && transaction.amountChange === 1)).toBe(true);
  });

  it('claims Mission rewards from refreshed table progress without manual completion', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_mission_progress', '掌柜任务进度');
    const summary: FinalMatchSummary = {
      matchId: 'match_profile_progress',
      seed: 2,
      rankings: [
        {
          playerId: 'p_mission_progress',
          name: '掌柜任务进度',
          rank: 1,
          cash: 100000,
          holdingsValue: 10000,
          setBonus: 0,
          netWorth: 110000
        }
      ],
      netWorthCurve: [],
      bestMove: { title: '达成', detail: '测试' },
      biggestMistake: { title: '无', detail: '测试' },
      revealedItems: [],
      rewards: [{ playerId: 'p_mission_progress', xp: 0, coins: 0, rankPoints: 0 }],
      eventCount: 0,
      transactionCount: 0
    };

    profiles.applyMatchSummary('p_mission_progress', summary);
    profiles.claimMissionReward('p_mission_progress', 'daily_complete_match');

    const profile = profiles.getSnapshot('p_mission_progress').profile;
    expect(profile.claimedMissionRewards).toContain('daily_complete_match');
    expect(profile.missionProgress?.daily_complete_match).toEqual(expect.objectContaining({
      completed: true,
      claimed: true,
      claimable: false,
      redPoint: false
    }));
  });
});

function inventoryQuantity(profile: { inventory: Array<{ refId: string; quantity: number }> }, refId: string): number {
  return profile.inventory
    .filter((entry) => entry.refId === refId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function grantInventory(profile: { inventory: Array<{ key: string; type: string; refId: string; quantity: number; updatedAt: number }> }, refId: string, quantity: number): void {
  profile.inventory.push({
    key: `item:${refId}:test_${profile.inventory.length}`,
    type: 'item',
    refId,
    quantity,
    updatedAt: Date.now()
  });
}
