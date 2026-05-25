import type { FinalMatchSummary, PlayerProfile } from '@bitkingdom/shared';
import { Activity, Cabinet, Dlc, Hero, Item, Mission, Pay, Shop, ShopItem, bidKingDlcRuntime, bidKingPayRuntime } from '@bitkingdom/bidking-compat';
import {
  bidKingHeroItemIdForHero,
  bidKingHeroTrialItemIdsForHero,
  bidKingDailyMapEntryKey,
  bidKingStarterHeadId,
  bidKingStarterInventoryRewards,
  bidKingStarterOwnedHeroIds
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
import { addInventory } from '../src/domain/profile/profileInventory';

function createMemoryStore(): ServerStore {
  return {
    state: {
      schemaVersion: 2,
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

const SEND_AUCTION_TEST_ITEM_ID = 1015001;

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

  it('deducts original BidMap entry costs once when a match starts', () => {
    const profiles = createProfileService(createMemoryStore());
    const itemCostProfile = profiles.getOrCreateProfile('p_bidmap_item_cost', '入场凭证');
    itemCostProfile.coins = 20_000;
    itemCostProfile.inventory = [];
    itemCostProfile.stockContainers = [];
    itemCostProfile.stockState = { nextBoxId: 1, nextItemNo: 1 };
    itemCostProfile.settings.bidkingStockContainersV1 = true;
    addInventory(itemCostProfile, 'warehouse', '102', 1, 'test:bidmap:item_cost');

    profiles.consumeBidMapEntryCost(itemCostProfile.playerId, 2102, 'match_start:entry_item');
    profiles.consumeBidMapEntryCost(itemCostProfile.playerId, 2102, 'match_start:entry_item');
    const afterItemCost = profiles.getSnapshot(itemCostProfile.playerId);

    expect(inventoryQuantity(afterItemCost.profile, '102')).toBe(0);
    expect(afterItemCost.profile.dailyMapEntries?.[bidKingDailyMapEntryKey(101)]).toBe(1);
    expect(afterItemCost.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.item.cid === 102)).toBe(false);
    expect(afterItemCost.transactions.map((transaction) => transaction.reason)).toEqual(expect.arrayContaining([
      'bidmap_entry_cost_item',
      'bidmap_entry_cost'
    ]));

    const coinCostProfile = profiles.getOrCreateProfile('p_bidmap_coin_cost', '入场扣费');
    coinCostProfile.coins = 2_010_000;
    coinCostProfile.auctionStats!.highestWinningItemTotalValue = 2_000_000;
    profiles.consumeBidMapEntryCost(coinCostProfile.playerId, 2401, 'match_start:entry_coin');
    profiles.consumeBidMapEntryCost(coinCostProfile.playerId, 2401, 'match_start:entry_coin');
    const afterCoinCost = profiles.getSnapshot(coinCostProfile.playerId);

    expect(afterCoinCost.profile.coins).toBe(2_000_000);
    expect(afterCoinCost.transactions.filter((transaction) => transaction.reason === 'bidmap_entry_cost_coins')).toHaveLength(1);
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

    expect(secondStore.state.schemaVersion).toBe(2);
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

  it('persists Head, Cabinet, Hero, and HeroSkin profile selections', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_cosmetic', '掌柜装扮');
    const cabinetItem = firstCabinetEligibleItem();
    const cabinetItemId = `compat_${cabinetItem.id}`;
    profile.codex = [cabinetItemId];
    addInventory(profile, 'warehouse', cabinetItemId, 1, 'test:cabinet:eligible');

    profiles.selectHead('p_cosmetic', '120000');
    profiles.selectHero('p_cosmetic', Hero[1]!.id);
    profiles.setCabinetItem('p_cosmetic', cabinetItemId);
    const heroSkin = 1410201;
    profiles.selectHeroSkin('p_cosmetic', heroSkin);

    const next = profiles.getSnapshot('p_cosmetic').profile;
    expect(next.headId).toBe('120000');
    expect(next.ownedHeroIds).toEqual(bidKingStarterOwnedHeroIds());
    expect(next.heroStates?.find((state) => state.heroId === Hero[1]!.id)?.state).toBe('trial');
    expect(next.selectedHeroId).toBe(Hero[1]!.id);
    expect(next.cabinetItemIds).toEqual([cabinetItemId]);
    expect(next.stockContainers?.find((container) => container.kind === 'cabinet')?.boxes).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          cid: cabinetItem.id,
          sourceUid: expect.any(Number),
          boxPositionData: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })])
        })
      })
    ]);
    expect(next.selectedHeroSkins?.[String(Hero[1]!.id)]).toBe(heroSkin);
  });

  it('unlocks locked heroes using original Hero.access currency and hero item state', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_hero_unlock', '掌柜名士');
    const lockedHero = Hero[0]!;
    const trialItemIds = new Set(bidKingHeroTrialItemIdsForHero(lockedHero.id).map(String));
    profile.inventory = profile.inventory.filter((entry) => !trialItemIds.has(entry.refId));
    profile.ownedHeroIds = profile.ownedHeroIds?.filter((heroId) => heroId !== lockedHero.id) ?? [];
    profile.heroStates = [];
    profile.goldCoins = 380;

    profiles.unlockHero(profile.playerId, lockedHero.id);
    profiles.selectHero(profile.playerId, lockedHero.id);

    const next = profiles.getSnapshot(profile.playerId).profile;
    const heroItemId = bidKingHeroItemIdForHero(lockedHero.id);
    expect(next.goldCoins).toBe(0);
    expect(next.ownedHeroIds).toContain(lockedHero.id);
    expect(next.heroStates?.find((state) => state.heroId === lockedHero.id)?.state).toBe('owned');
    expect(next.selectedHeroId).toBe(lockedHero.id);
    expect(next.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ refId: String(heroItemId), quantity: 1 })
    ]));
  });

  it('rejects and clears Cabinet placement through original quality requirements', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_cabinet_rules', '掌柜柜规');
    const validItem = firstCabinetEligibleItem();
    const invalidItem = firstCabinetIneligibleItem();
    const validItemId = `compat_${validItem.id}`;
    const invalidItemId = `compat_${invalidItem.id}`;
    profile.codex = [validItemId, invalidItemId];
    addInventory(profile, 'warehouse', validItemId, 1, 'test:cabinet:valid');
    addInventory(profile, 'warehouse', invalidItemId, 1, 'test:cabinet:invalid');

    expect(() => profiles.setCabinetItem(profile.playerId, invalidItemId)).toThrow('藏品品质不符合收藏柜要求');

    profiles.setCabinetItem(profile.playerId, validItemId);
    profiles.clearCabinetItem(profile.playerId, validItemId);
    const snapshot = profiles.getSnapshot(profile.playerId);

    expect(snapshot.profile.cabinetItemIds).toEqual([]);
    expect(snapshot.profile.stockContainers?.find((container) => container.kind === 'cabinet')?.boxes).toHaveLength(0);
    expect(snapshot.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.item.cid === validItem.id)).toBe(true);
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
    addInventory(profile, 'warehouse', itemId, 1, 'test:collection:cabinet');
    profiles.setCabinetItem(profile.playerId, itemId);
    const lastRewardAt = Date.now() - 2 * 3600_000;
    profile.lastCollectionIncomeAt = lastRewardAt;
    for (const container of profile.stockContainers ?? []) {
      if (container.kind === 'cabinet' && container.cabinet) {
        container.cabinet.lastRewardAt = lastRewardAt;
      }
    }

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
    const boughtStockBox = bought.stockContainers
      ?.find((container) => container.kind === 'warehouse')
      ?.boxes.find((box) => box.item.cid === 100102);
    expect(boughtStockBox).toEqual(expect.objectContaining({
      item: expect.objectContaining({
        sourceUid: expect.any(Number),
        sourceId: expect.stringContaining('shop:p_shop:40001'),
        boxPositionData: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]),
        isLock: false
      })
    }));
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

  it('collects and uncollects exchange item ids through source Exchange collect state', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_exchange_collect', '交易收藏');

    const collected = profiles.collectExchangeItem('p_exchange_collect', 100102);
    const repeated = profiles.collectExchangeItem('p_exchange_collect', 100102);

    expect(collected.sourceExchangeCollectItem).toEqual({
      errorCode: 0,
      itemCid: 100102
    });
    expect(collected.profile.exchangeCollections).toEqual([100102]);
    expect(repeated.profile.exchangeCollections).toEqual([100102]);
    expect(repeated.profile.shopCollections).toEqual([]);
    expect(profiles.listExchangeCollectItems('p_exchange_collect')).toEqual(expect.objectContaining({
      errorCode: 0,
      collectItemList: [100102]
    }));

    const uncollected = profiles.uncollectExchangeItem('p_exchange_collect', 100102);

    expect(uncollected.sourceExchangeUncollectItem).toEqual({
      errorCode: 0,
      itemCid: 100102
    });
    expect(uncollected.profile.exchangeCollections).toEqual([]);
    expect(profiles.listExchangeCollectItems('p_exchange_collect').collectItemList).toEqual([]);
    expect(() => profiles.collectExchangeItem('p_exchange_collect', 99999999)).toThrow('收藏藏品不存在');
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
    const equippedStockBox = equipped.stockContainers
      ?.find((container) => container.kind === 'warehouse')
      ?.boxes.find((box) => box.item.cid === 100102);

    expect(equipped.equippedBattleItems).toEqual([
      expect.objectContaining({ itemId: 100102, quantity: 1, stockId: expect.any(Number), boxId: equippedStockBox?.position })
    ]);
  });

  it('consumes equipped battle items when used in battle', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_use_item', '掌柜丁二');
    profiles.buyShopItem('p_use_item', 40001);
    profiles.equipBattleItems('p_use_item', [100102]);

    const used = profiles.useBattleItem('p_use_item', 100102).profile;

    expect(used.inventory.some((entry) => entry.refId === '100102')).toBe(false);
    expect(used.stockContainers?.flatMap((container) => container.boxes).some((box) => box.item.cid === 100102)).toBe(false);
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
        listingCost: 44,
        fee: 1010,
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

  it('splits source exchange lanch counts by Item max_per_listing slots', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_exchange_split', '交易拆单掌柜');
    grantInventory(profile, '100102', 11);

    const lanch = profiles.lanchExchangeItem('p_exchange_split', 100102, 11, 11_000);

    expect(lanch.sourceExchangeLanchItem).toEqual(expect.objectContaining({ errorCode: 0 }));
    expect(lanch.profile.marketOrders).toEqual([
      expect.objectContaining({ orderType: 'trade', quantity: 1, price: 1000, totalPrice: 1000 }),
      expect.objectContaining({ orderType: 'trade', quantity: 10, price: 1000, totalPrice: 10_000 })
    ]);
    expect(profiles.listExchangeLanchItems('p_exchange_split').lunchItemList).toEqual([
      expect.objectContaining({ itemCid: 100102, itemCount: 1, totalPrice: 1000, tradeCount: 0 }),
      expect.objectContaining({ itemCid: 100102, itemCount: 10, totalPrice: 10_000, tradeCount: 0 })
    ]);
    expect(profiles.listExchangeItemTradeInfo(100102).tradeInfoList).toEqual([
      { price: 1000, peopleCount: 11 }
    ]);
  });

  it('settles market orders with Item transaction tax fees', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_market_fee', '掌柜手续费');
    profiles.buyShopItem('p_market_fee', 40001);
    const order = profiles.createMarketOrder('p_market_fee', '100102', 1, 8800, 'trade').profile.marketOrders[0]!;

    const settled = profiles.settleMarketOrder('p_market_fee', order.id).profile;
    const transactions = profiles.getSnapshot('p_market_fee').transactions;

    expect(settled.marketOrders[0]).toEqual(expect.objectContaining({ status: 'sold', listingFee: 44, tax: 1010, fee: 1010, netPrice: 7746 }));
    expect(settled.coins).toBe(DEFAULT_PROFILE_COINS + 1_746);
    expect(transactions.some((entry) => entry.reason === 'market_order_listing_cost' && entry.amountChange === -44)).toBe(true);
    expect(transactions.some((entry) => entry.reason === 'market_order_fee' && entry.amountChange === -1010)).toBe(true);
  });

  it('settles global market orders between seller and buyer profiles', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_market_seller', '卖家掌柜');
    const buyerBefore = profiles.getOrCreateProfile('p_market_buyer', '买家掌柜').coins;
    profiles.buyShopItem('p_market_seller', 40001);
    const listed = profiles.createMarketOrder('p_market_seller', '100102', 1, 1000, 'trade').profile;
    const sellerBefore = listed.coins;
    const order = listed.marketOrders[0]!;

    expect(order).toEqual(expect.objectContaining({
      itemCid: 100102,
      numberCid: expect.any(Number),
      itemNo: expect.any(Number),
      lockedStockBoxes: [expect.objectContaining({
        item: expect.objectContaining({
          cid: 100102,
          sourceUid: expect.any(Number),
          boxPositionData: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]),
          isLock: true
        })
      })]
    }));
    expect(order.sourceAuctionHouseLaunches).toEqual([
      expect.objectContaining({
        stockId: 5001,
        boxId: order.lockedStockBoxes?.[0]?.position,
        price: 1000,
        startPrice: 1000,
        itemCount: 1,
        bagItemCid: 0
      })
    ]);
    expect(listed.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.item.cid === 100102)).toBe(false);

    const buyerSnapshot = profiles.settleMarketOrder('p_market_buyer', order.id);
    const sellerSnapshot = profiles.getSnapshot('p_market_seller');
    const soldOrder = sellerSnapshot.profile.marketOrders.find((candidate) => candidate.id === order.id)!;

    expect(buyerSnapshot.profile.coins).toBe(buyerBefore - order.price);
    expect(buyerSnapshot.profile.inventory.find((entry) => entry.refId === '100102')?.quantity).toBe(1);
    const boughtBox = buyerSnapshot.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.find((box) => box.item.cid === 100102);
    expect(boughtBox).toEqual(expect.objectContaining({
      item: expect.objectContaining({
        sourceUid: order.lockedStockBoxes?.[0]?.item.sourceUid,
        boxPositionData: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })])
      })
    }));
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
    expect(sellerSnapshot.marketOrders[0]?.lockedStockBoxes).toHaveLength(1);
    expect(inventoryQuantity(sellerSnapshot, '100102')).toBe(0);
  });

  it('settles and cancels local market orders', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_actions', '掌柜辛二');
    grantInventory(profile, '100102', 2);
    const tradeOrder = profiles.createMarketOrder('p_market_actions', '100102', 1, 1200, 'trade').profile.marketOrders[0]!;
    const sold = profiles.settleMarketOrder('p_market_actions', tradeOrder.id).profile;

    expect(sold.marketOrders[0]?.status).toBe('sold');
    expect(sold.coins).toBe(DEFAULT_PROFILE_COINS + 1_134);

    const auctionOrder = profiles.createMarketOrder('p_market_actions', '100102', 1, 1500, 'auction').profile.marketOrders[0]!;
    const lockedBoxId = auctionOrder.lockedStockBoxes?.[0]?.boxId;
    expect(auctionOrder.sourceAuctionHouseLaunches).toEqual([
      expect.objectContaining({
        stockId: 5001,
        boxId: auctionOrder.lockedStockBoxes?.[0]?.position,
        price: 0,
        startPrice: 1500,
        itemCount: 1,
        bagItemCid: 0
      })
    ]);
    expect(auctionOrder.sourceAuctionHouseLanchItemUid).toEqual(expect.any(Number));
    const sourceLanchList = profiles.listAuctionHouseLanchItems('p_market_actions');
    expect(sourceLanchList).toEqual(expect.objectContaining({
      errorCode: 0,
      lanchMax: expect.any(Number)
    }));
    expect(sourceLanchList.lanchItemList).toEqual([
      expect.objectContaining({
        lanchItemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
        itemCid: 100102,
        numberCid: auctionOrder.numberCid,
        no: auctionOrder.itemNo,
        startLanchTime: Math.floor(auctionOrder.createdAt / 1000),
        endLanchTime: Math.floor((auctionOrder.expiresAt ?? 0) / 1000),
        displayPeriodEndTime: Math.floor((auctionOrder.publicAt ?? auctionOrder.createdAt) / 1000),
        price: 0,
        maxPrice: 0,
        startPrice: 1500,
        count: 1
      })
    ]);
    const coinsBeforeSlotUnlock = profiles.getSnapshot('p_market_actions').profile.coins;
    const slotUnlock = profiles.unlockAuctionHouseLanchSlot('p_market_actions', 1);
    expect(slotUnlock.sourceAuctionHouseUnlockLanchSlot).toEqual({
      errorCode: 0,
      unlockCount: 1,
      cost: 50,
      lanchMax: sourceLanchList.lanchMax + 1
    });
    expect(slotUnlock.profile.settings.bidkingMarketSlotUnlocks).toBe(1);
    expect(slotUnlock.profile.coins).toBe(coinsBeforeSlotUnlock - 50);
    expect(profiles.listAuctionHouseLanchItems('p_market_actions').lanchMax).toBe(sourceLanchList.lanchMax + 1);
    expect(() => profiles.unlockAuctionHouseLanchSlot('p_market_actions', 0)).toThrow('解锁数量需为正整数');
    const maxSlotProfile = profiles.getOrCreateProfile('p_market_max_slot', '槽位上限');
    maxSlotProfile.settings.bidkingMarketSlotUnlocks = 5;
    expect(() => profiles.unlockAuctionHouseLanchSlot('p_market_max_slot', 1)).toThrow('拍卖上架槽位已达上限');
    const brokeSlotProfile = profiles.getOrCreateProfile('p_market_broke_slot', '槽位余额不足');
    brokeSlotProfile.coins = 49;
    expect(() => profiles.unlockAuctionHouseLanchSlot('p_market_broke_slot', 1)).toThrow('铜钱不足，无法解锁拍卖上架槽位');
    const sourceItemInfo = profiles.listAuctionHouseItems({ itemCid: 100102, sortType: 'StartPrice', page: 1, pageSize: 5 });
    expect(sourceItemInfo).toEqual(expect.objectContaining({
      errorCode: 0,
      currentPage: 1,
      totalPage: 1
    }));
    expect(sourceItemInfo.itemInfoList).toEqual([
      expect.objectContaining({
        lanchItemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
        itemCid: 100102,
        startPrice: 1500,
        price: 0,
        count: 1
      })
    ]);
    expect(profiles.listMarketOrders('auction').sourceAuctionHouseItemInfo?.itemInfoList[0]?.lanchItemUid).toBe(auctionOrder.sourceAuctionHouseLanchItemUid);

    const bidder = profiles.getOrCreateProfile('p_market_bidder', '竞拍人甲');
    const bidderBefore = bidder.coins;
    const bidSnapshot = profiles.bidAuctionHousePrice('p_market_bidder', auctionOrder.sourceAuctionHouseLanchItemUid!, 2_000);
    expect(bidSnapshot.sourceAuctionHouseBidPrice).toEqual(expect.objectContaining({
      errorCode: 0,
      itemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
      price: 2_000,
      bidLog: expect.objectContaining({
        bidPrice: 2_000,
        lanchItem: expect.objectContaining({
          lanchItemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
          maxPrice: 2_000
        })
      })
    }));
    expect(bidSnapshot.profile.coins).toBe(bidderBefore - 2_000);
    expect(profiles.listAuctionHouseBidLogs('p_market_bidder').bidLogList).toEqual([
      expect.objectContaining({
        bidPrice: 2_000,
        lanchItem: expect.objectContaining({
          lanchItemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
          maxPrice: 2_000
        })
      })
    ]);
    expect(profiles.listAuctionHouseItems({ itemCid: 100102 }).itemInfoList[0]?.maxPrice).toBe(2_000);

    const bidderB = profiles.getOrCreateProfile('p_market_bidder_b', '竞拍人乙');
    const bidderBBefore = bidderB.coins;
    profiles.bidAuctionHousePrice('p_market_bidder_b', auctionOrder.sourceAuctionHouseLanchItemUid!, 3_000);
    expect(profiles.getSnapshot('p_market_bidder').profile.coins).toBe(bidderBefore);
    expect(profiles.getSnapshot('p_market_bidder_b').profile.coins).toBe(bidderBBefore - 3_000);
    expect(profiles.listAuctionHouseItems({ itemCid: 100102 }).itemInfoList[0]?.maxPrice).toBe(3_000);
    expect(profiles.listAuctionHouseBidLogs('p_market_bidder').bidLogList[0]).toEqual(expect.objectContaining({
      bidPrice: 2_000,
      lanchItem: expect.objectContaining({ maxPrice: 3_000 })
    }));

    const unlanchSnapshot = profiles.cancelAuctionHouseLanchItem('p_market_actions', auctionOrder.sourceAuctionHouseLanchItemUid!);
    expect(unlanchSnapshot.sourceAuctionHouseUnlanchItem).toEqual({
      errorCode: 0,
      itemUid: auctionOrder.sourceAuctionHouseLanchItemUid,
      orderId: auctionOrder.id
    });
    const cancelled = unlanchSnapshot.profile;

    expect(cancelled.marketOrders[0]?.status).toBe('cancelled');
    expect(inventoryQuantity(cancelled, '100102')).toBe(1);
    expect(cancelled.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.boxId === lockedBoxId)).toBe(true);
    expect(profiles.getSnapshot('p_market_bidder_b').profile.coins).toBe(bidderBBefore);
    expect(profiles.listAuctionHouseBidLogs('p_market_bidder').bidLogList).toEqual([]);
    expect(profiles.listAuctionHouseBidLogs('p_market_bidder_b').bidLogList).toEqual([]);
  });

  it('settles expired auction bids through source unlanch without charging the winner twice', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_market_unlanch_expired', '过期撤拍卖家');
    grantInventory(seller, '100102', 1);
    const listed = profiles.createMarketOrder('p_market_unlanch_expired', '100102', 1, 1500, 'auction').profile;
    const sellerCoinsAfterListing = listed.coins;
    const order = listed.marketOrders[0]!;
    const bidder = profiles.getOrCreateProfile('p_market_unlanch_expired_bidder', '过期撤拍竞买人');
    const bidderBefore = bidder.coins;

    profiles.bidAuctionHousePrice('p_market_unlanch_expired_bidder', order.sourceAuctionHouseLanchItemUid!, 2_000);
    seller.marketOrders[0]!.expiresAt = Date.now() - 1;

    const snapshot = profiles.cancelAuctionHouseLanchItem('p_market_unlanch_expired', order.sourceAuctionHouseLanchItemUid!);

    expect(snapshot.sourceAuctionHouseUnlanchItem).toEqual(expect.objectContaining({
      errorCode: 0,
      itemUid: order.sourceAuctionHouseLanchItemUid
    }));
    const soldOrder = snapshot.profile.marketOrders[0]!;
    expect(soldOrder).toEqual(expect.objectContaining({
      status: 'sold',
      buyerId: 'p_market_unlanch_expired_bidder',
      totalPrice: 2_000,
      sourceAuctionHouseTradePrice: 2_000,
      sourceAuctionHouseTradeTime: expect.any(Number)
    }));
    expect(inventoryQuantity(snapshot.profile, '100102')).toBe(0);
    expect(snapshot.profile.coins).toBe(sellerCoinsAfterListing + 2_000 - (soldOrder.fee ?? 0));
    const winner = profiles.getSnapshot('p_market_unlanch_expired_bidder').profile;
    expect(winner.coins).toBe(bidderBefore - 2_000);
    expect(inventoryQuantity(winner, '100102')).toBe(1);
    expect(profiles.listAuctionHouseTradeInfo('p_market_unlanch_expired_bidder').tradeInfoInList).toEqual([
      {
        tradeTime: soldOrder.sourceAuctionHouseTradeTime,
        itemCid: 100102,
        numberCid: soldOrder.numberCid,
        no: soldOrder.itemNo,
        price: 2_000
      }
    ]);
    expect(profiles.listAuctionHouseTradeInfo('p_market_unlanch_expired').tradeInfoOutList).toEqual([
      {
        tradeTime: soldOrder.sourceAuctionHouseTradeTime,
        itemCid: 100102,
        numberCid: soldOrder.numberCid,
        no: soldOrder.itemNo,
        price: 2_000
      }
    ]);
  });

  it('keeps no-bid expired auctions in the seller lanch list until source unlanch', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_market_expired_no_bid', '无人出价过期卖家');
    grantInventory(seller, '100102', 1);
    const listed = profiles.createMarketOrder('p_market_expired_no_bid', '100102', 1, 1500, 'auction').profile;
    const order = listed.marketOrders[0]!;
    const lockedBoxId = order.lockedStockBoxes?.[0]?.boxId;
    seller.marketOrders[0]!.expiresAt = Date.now() - 1;

    expect(profiles.listAuctionHouseItems({ itemCid: 100102 }).itemInfoList).toEqual([]);
    const lanchList = profiles.listAuctionHouseLanchItems('p_market_expired_no_bid');
    expect(lanchList.lanchItemList).toEqual([
      expect.objectContaining({
        lanchItemUid: order.sourceAuctionHouseLanchItemUid,
        itemCid: 100102,
        maxPrice: 0,
        endLanchTime: Math.floor((seller.marketOrders[0]?.expiresAt ?? 0) / 1000)
      })
    ]);
    expect(profiles.getSnapshot('p_market_expired_no_bid').profile.marketOrders[0]).toEqual(expect.objectContaining({ status: 'listed' }));
    expect(inventoryQuantity(profiles.getSnapshot('p_market_expired_no_bid').profile, '100102')).toBe(0);

    const unlanchSnapshot = profiles.cancelAuctionHouseLanchItem('p_market_expired_no_bid', order.sourceAuctionHouseLanchItemUid!);

    expect(unlanchSnapshot.sourceAuctionHouseUnlanchItem).toEqual(expect.objectContaining({
      errorCode: 0,
      itemUid: order.sourceAuctionHouseLanchItemUid
    }));
    expect(unlanchSnapshot.profile.marketOrders[0]).toEqual(expect.objectContaining({ status: 'expired' }));
    expect(inventoryQuantity(unlanchSnapshot.profile, '100102')).toBe(1);
    expect(unlanchSnapshot.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.boxId === lockedBoxId)).toBe(true);
    expect(unlanchSnapshot.transactions.some((entry) => entry.reason === 'market_order_expired_return')).toBe(true);
  });

  it('settles expired auction bids during auction list refresh', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_market_expired_auction_seller', '过期拍卖卖家');
    grantInventory(seller, '100102', 1);
    const listed = profiles.createMarketOrder('p_market_expired_auction_seller', '100102', 1, 1500, 'auction').profile;
    const sellerCoinsAfterListing = listed.coins;
    const order = listed.marketOrders[0]!;
    const bidder = profiles.getOrCreateProfile('p_market_expired_auction_bidder', '过期拍卖赢家');
    const bidderBefore = bidder.coins;

    expect(profiles.listAuctionHouseItemPriceInfo().allAuctionHouseItemPriceInfo).toEqual([
      {
        itemCid: 100102,
        avgPrice: 0,
        count: 1
      }
    ]);

    profiles.bidAuctionHousePrice('p_market_expired_auction_bidder', order.sourceAuctionHouseLanchItemUid!, 2_500);
    expect(profiles.listAuctionHouseBidLogs('p_market_expired_auction_bidder').bidLogList).toEqual([
      expect.objectContaining({
        bidPrice: 2_500,
        lanchItem: expect.objectContaining({
          lanchItemUid: order.sourceAuctionHouseLanchItemUid,
          maxPrice: 2_500
        })
      })
    ]);
    seller.marketOrders[0]!.expiresAt = Date.now() - 1;

    const auctionItems = profiles.listAuctionHouseItems({ itemCid: 100102 });
    const sellerSnapshot = profiles.getSnapshot('p_market_expired_auction_seller').profile;
    const soldOrder = sellerSnapshot.marketOrders[0]!;
    const winner = profiles.getSnapshot('p_market_expired_auction_bidder').profile;

    expect(auctionItems.itemInfoList).toEqual([]);
    expect(soldOrder).toEqual(expect.objectContaining({
      status: 'sold',
      buyerId: 'p_market_expired_auction_bidder',
      totalPrice: 2_500,
      sourceAuctionHouseTradePrice: 2_500
    }));
    expect(sellerSnapshot.coins).toBe(sellerCoinsAfterListing + 2_500 - (soldOrder.fee ?? 0));
    expect(winner.coins).toBe(bidderBefore - 2_500);
    expect(inventoryQuantity(winner, '100102')).toBe(1);
    expect(profiles.listAuctionHouseTradeInfo('p_market_expired_auction_bidder').tradeInfoInList[0]).toEqual(expect.objectContaining({
      tradeTime: soldOrder.sourceAuctionHouseTradeTime,
      itemCid: 100102,
      price: 2_500
    }));
    expect(profiles.listAuctionHouseTradeInfo('p_market_expired_auction_seller').tradeInfoOutList[0]).toEqual(expect.objectContaining({
      tradeTime: soldOrder.sourceAuctionHouseTradeTime,
      itemCid: 100102,
      price: 2_500
    }));
    expect(profiles.listAuctionHouseBidLogs('p_market_expired_auction_bidder').bidLogList).toEqual([]);
    expect(profiles.listAuctionHouseItemPriceInfo().allAuctionHouseItemPriceInfo).toEqual([
      {
        itemCid: 100102,
        avgPrice: 2_500,
        count: 0
      }
    ]);
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

  it('keeps expired exchange listings locked until source relanch or unlanch', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_expire', '掌柜过期');
    grantInventory(profile, '100102', 1);
    const lanchSnapshot = profiles.lanchExchangeItem('p_market_expire', 100102, 1, 2400);
    const order = lanchSnapshot.profile.marketOrders[0]!;
    const lockedBoxId = order.lockedStockBoxes?.[0]?.boxId;
    const sourceItemUid = order.sourceExchangeLunchItemUid!;
    expect(lanchSnapshot.sourceExchangeLanchItem).toEqual({
      errorCode: 0,
      lunchItemUid: sourceItemUid,
      orderId: order.id
    });
    expect(order.sourceAuctionHouseLaunches?.[0]?.boxId).toBe(order.lockedStockBoxes?.[0]?.position);
    profiles.getOrCreateProfile('p_market_expire').marketOrders[0]!.expiresAt = Date.now() - 1;

    const snapshot = profiles.listMarketOrders('trade');
    const sellerSnapshot = profiles.getSnapshot('p_market_expire');

    expect(snapshot.orders.find((candidate) => candidate.id === order.id)).toEqual(expect.objectContaining({
      status: 'listed',
      sourceExchangeLunchItem: expect.objectContaining({
        lunchItemUid: sourceItemUid,
        itemCid: 100102,
        itemCount: 1,
        totalPrice: 2400,
        tradeCount: 0
      })
    }));
    expect(profiles.listExchangeLanchItems('p_market_expire').lunchItemList).toEqual([
      expect.objectContaining({
        lunchItemUid: sourceItemUid,
        itemCid: 100102,
        endLunchTime: Math.floor((profile.marketOrders[0]?.expiresAt ?? 0) / 1000)
      })
    ]);
    expect(sellerSnapshot.profile.marketOrders[0]).toEqual(expect.objectContaining({ status: 'listed' }));
    expect(inventoryQuantity(sellerSnapshot.profile, '100102')).toBe(0);
    expect(() => profiles.settleMarketOrder('p_market_expire_buyer', order.id)).toThrow('交易信息过期');

    const relanchSnapshot = profiles.lanchExchangeItem('p_market_expire', 0, 0, 0, sourceItemUid);
    expect(relanchSnapshot.sourceExchangeLanchItem).toEqual({
      errorCode: 0,
      lunchItemUid: sourceItemUid,
      orderId: order.id,
      reLanchItemUid: sourceItemUid
    });
    expect(relanchSnapshot.profile.marketOrders[0]).toEqual(expect.objectContaining({
      status: 'listed',
      sourceExchangeLunchItemUid: sourceItemUid
    }));
    expect((relanchSnapshot.profile.marketOrders[0]?.expiresAt ?? 0)).toBeGreaterThan(Date.now());

    profiles.getOrCreateProfile('p_market_expire').marketOrders[0]!.expiresAt = Date.now() - 1;
    const unlanchSnapshot = profiles.cancelExchangeLanchItem('p_market_expire', sourceItemUid);

    expect(unlanchSnapshot.sourceExchangeUnlanchItem).toEqual({
      errorCode: 0,
      itemUid: sourceItemUid,
      orderId: order.id
    });
    expect(unlanchSnapshot.profile.marketOrders[0]).toEqual(expect.objectContaining({ status: 'expired' }));
    expect(inventoryQuantity(unlanchSnapshot.profile, '100102')).toBe(1);
    expect(unlanchSnapshot.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.boxId === lockedBoxId)).toBe(true);
    expect(unlanchSnapshot.transactions.some((entry) => entry.reason === 'market_order_expired_return')).toBe(true);
  });

  it('buys exchange items by source price buckets and records in/out trades', () => {
    const profiles = createProfileService(createMemoryStore());
    const sellerA = profiles.getOrCreateProfile('p_exchange_seller_a', '交易卖家甲');
    const sellerB = profiles.getOrCreateProfile('p_exchange_seller_b', '交易卖家乙');
    const buyer = profiles.getOrCreateProfile('p_exchange_buyer', '交易买家');
    buyer.coins = 30_000;
    grantInventory(sellerA, '100102', 1);
    grantInventory(sellerB, '100102', 2);

    const lanchA = profiles.lanchExchangeItem('p_exchange_seller_a', 100102, 1, 1000);
    const orderA = lanchA.profile.marketOrders[0]!;
    const sellerACoinsAfterListing = lanchA.profile.coins;
    const lanchB = profiles.lanchExchangeItem('p_exchange_seller_b', 100102, 2, 3000);
    const orderB = lanchB.profile.marketOrders[0]!;
    const sellerBCoinsAfterListing = lanchB.profile.coins;

    expect(orderA).toEqual(expect.objectContaining({ listingFee: 5, listingCost: 5, tax: 50, fee: 50, netPrice: 945 }));
    expect(orderB).toEqual(expect.objectContaining({ listingFee: 15, listingCost: 15, tax: 150, fee: 150, netPrice: 2835 }));

    expect(profiles.listExchangeInfo().allItemPriceInfo).toEqual([
      { itemCid: 100102, price: 1000 }
    ]);
    expect(profiles.listExchangeItemTradeInfo(100102).tradeInfoList).toEqual([
      { price: 1000, peopleCount: 1 },
      { price: 1500, peopleCount: 2 }
    ]);

    const buySnapshot = profiles.buyExchangeItem('p_exchange_buyer', 100102, 2, 2500);

    expect(buySnapshot.sourceExchangeBuyItem).toEqual({
      errorCode: 0,
      itemCid: 100102,
      itemCount: 2,
      estimatePrice: 2500
    });
    expect(buySnapshot.profile.coins).toBe(27_500);
    expect(inventoryQuantity(buySnapshot.profile, '100102')).toBe(2);
    const sellerASnapshot = profiles.getSnapshot('p_exchange_seller_a');
    const sellerBSnapshot = profiles.getSnapshot('p_exchange_seller_b');
    const soldA = sellerASnapshot.profile.marketOrders.find((order) => order.id === orderA.id)!;
    const partialB = sellerBSnapshot.profile.marketOrders.find((order) => order.id === orderB.id)!;
    expect(soldA).toEqual(expect.objectContaining({
      status: 'sold',
      sourceExchangeTradeCount: 1,
      buyerId: 'p_exchange_buyer'
    }));
    expect(partialB).toEqual(expect.objectContaining({
      status: 'listed',
      sourceExchangeTradeCount: 1
    }));
    expect(partialB.lockedStockBoxes).toHaveLength(1);
    expect(sellerASnapshot.profile.coins).toBeGreaterThan(sellerACoinsAfterListing);
    expect(sellerBSnapshot.profile.coins).toBeGreaterThan(sellerBCoinsAfterListing);
    expect(sellerASnapshot.transactions.some((entry) => entry.reason === 'market_order_listing_cost' && entry.amountChange === -5)).toBe(true);
    expect(sellerASnapshot.transactions.some((entry) => entry.reason === 'exchange_order_fee' && entry.amountChange === -50)).toBe(true);
    expect(sellerBSnapshot.transactions.some((entry) => entry.reason === 'market_order_listing_cost' && entry.amountChange === -15)).toBe(true);
    expect(sellerBSnapshot.transactions.some((entry) => entry.reason === 'exchange_order_fee' && entry.amountChange === -75)).toBe(true);
    expect(profiles.listExchangeItemTradeInfo(100102).tradeInfoList).toEqual([
      { price: 1500, peopleCount: 1 }
    ]);
    expect(profiles.listExchangeLanchItems('p_exchange_seller_b').lunchItemList).toEqual([
      expect.objectContaining({
        lunchItemUid: orderB.sourceExchangeLunchItemUid,
        itemCount: 2,
        totalPrice: 3000,
        tradeCount: 1
      })
    ]);
    expect(profiles.listExchangeTradeInfo('p_exchange_buyer').tradeInfoInList).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemCid: 100102, itemCount: 1, price: 1000 }),
      expect.objectContaining({ itemCid: 100102, itemCount: 1, price: 1500 })
    ]));
    expect(profiles.listExchangeTradeInfo('p_exchange_seller_b').tradeInfoOutList).toEqual([
      expect.objectContaining({ itemCid: 100102, itemCount: 1, price: 1500 })
    ]);
    expect(() => profiles.buyExchangeItem('p_exchange_buyer', 100102, 1, 1000)).toThrow('交易信息过期');

    const unlanchB = profiles.cancelExchangeLanchItem('p_exchange_seller_b', orderB.sourceExchangeLunchItemUid!);

    expect(unlanchB.profile.marketOrders.find((order) => order.id === orderB.id)).toEqual(expect.objectContaining({ status: 'cancelled' }));
    expect(inventoryQuantity(unlanchB.profile, '100102')).toBe(1);
  });

  it('checks source exchange buyer warehouse capacity before mutating purchase state', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_exchange_full_seller', '满仓交易卖家');
    const buyer = profiles.getOrCreateProfile('p_exchange_full_buyer', '满仓交易买家');
    buyer.coins = 10_000;
    grantInventory(seller, '100102', 1);

    const lanch = profiles.lanchExchangeItem('p_exchange_full_seller', 100102, 1, 1000);
    const order = lanch.profile.marketOrders[0]!;
    const sellerCoinsAfterListing = lanch.profile.coins;
    const lockedBoxIds = order.lockedStockBoxes?.map((box) => box.boxId) ?? [];

    resetStockInventory(buyer);
    const item = Item.find((candidate) => candidate.id === 100102)!;
    const now = Date.now();
    buyer.stockContainers = [{
      stockId: 5001,
      cid: 5001,
      kind: 'warehouse',
      name: '主仓库',
      width: 1,
      height: 1,
      boxes: [{
        boxId: 1,
        position: 0,
        item: {
          uid: 'buyer_full:100102:1',
          sourceUid: 1,
          cid: 100102,
          count: 1,
          boxPositionData: [{ x: 0, y: 0 }],
          rotate: false,
          canTrade: true,
          no: 1,
          isLock: false,
          quality: item.item_quality,
          createdAt: now
        }
      }],
      updatedAt: now
    }];
    buyer.stockState = { nextBoxId: 2, nextItemNo: 2 };
    const buyerCoinsBefore = buyer.coins;

    expect(() => profiles.buyExchangeItem('p_exchange_full_buyer', 100102, 1, 1000)).toThrow('仓库空间不足');

    const buyerSnapshot = profiles.getSnapshot('p_exchange_full_buyer');
    const sellerSnapshot = profiles.getSnapshot('p_exchange_full_seller');
    const sellerOrder = sellerSnapshot.profile.marketOrders.find((candidate) => candidate.id === order.id)!;
    expect(buyerSnapshot.profile.coins).toBe(buyerCoinsBefore);
    expect(inventoryQuantity(buyerSnapshot.profile, '100102')).toBe(0);
    expect(buyerSnapshot.profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes).toHaveLength(1);
    expect(sellerSnapshot.profile.coins).toBe(sellerCoinsAfterListing);
    expect(sellerOrder).toEqual(expect.objectContaining({
      status: 'listed',
      sourceExchangeTradeCount: 0
    }));
    expect(sellerOrder.lockedStockBoxes?.map((box) => box.boxId)).toEqual(lockedBoxIds);
    expect(profiles.listExchangeItemTradeInfo(100102).tradeInfoList).toEqual([
      { price: 1000, peopleCount: 1 }
    ]);
  });

  it('enforces original market slot and mail-cap constants before listing', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_market_slots', '掌柜槽位');
    grantInventory(profile, '100102', 11);

    for (let index = 0; index < 10; index += 1) {
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

  it('creates source-style send auctions from concrete warehouse boxes and recycles at system value', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_send_auction', '委托掌柜');
    resetStockInventory(profile);
    profile.coins = 10_000;
    addInventory(profile, 'warehouse', String(SEND_AUCTION_TEST_ITEM_ID), 15, 'test:send_auction:create');
    const selectedBoxes = selectWarehouseStockBoxes(profile, SEND_AUCTION_TEST_ITEM_ID, 15);
    const firstSourceBox = profile.stockContainers
      ?.find((container) => container.kind === 'warehouse')
      ?.boxes.find((box) => box.boxId === selectedBoxes[0]?.boxId);
    const rowStartSourceBox = profile.stockContainers
      ?.find((container) => container.kind === 'warehouse')
      ?.boxes.find((box) => box.item.cid === SEND_AUCTION_TEST_ITEM_ID && box.position === 10);

    const unitValue = Item.find((item) => item.id === SEND_AUCTION_TEST_ITEM_ID)?.base_value ?? 0;
    const createdSnapshot = profiles.createSendAuction('p_send_auction', 101, selectedBoxes, 2);
    const created = createdSnapshot.profile;
    const auction = created.sendAuctions?.[0]!;

    expect(firstSourceBox?.item.sourceUid).toEqual(expect.any(Number));
    expect(firstSourceBox?.item.boxPositionData).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    ]));
    expect(rowStartSourceBox?.item.boxPositionData.slice(0, 2)).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ]);
    expect(auction).toEqual(expect.objectContaining({
      mapCid: 101,
      bidMapId: 2101,
      slotId: 2,
      status: 'listed',
      fee: 1000,
      totalValue: unitValue * 15,
      targetValue: 20_000
    }));
    expect(createdSnapshot.sourceSendAuction).toEqual(expect.objectContaining({
      errorCode: 0,
      sendAuctionData: expect.objectContaining({
        uid: expect.any(Number),
        mapCid: 101,
        slotId: 2,
        sendTime: auction.createdAt,
        stockData: expect.objectContaining({
          stockId: 2,
          stockCid: 2101,
          stockBoxes: expect.arrayContaining([
            expect.objectContaining({ boxId: expect.any(Number) })
          ])
        })
      })
    }));
    const listed = profiles.listSendAuctions('p_send_auction', false);
    expect(listed).toEqual(expect.objectContaining({
      errorCode: 0,
      auctions: [expect.objectContaining({ id: auction.id, status: 'listed' })],
      sendAuctionDataList: [expect.objectContaining({ uid: expect.any(Number), slotId: 2, mapCid: 101 })]
    }));
    expect(auction.items).toHaveLength(15);
    expect(auction.stockContainer.kind).toBe('sendAuction');
    expect(auction.stockContainer.boxes[0]?.item.sourceUid).toBe(firstSourceBox?.item.sourceUid);
    expect(auction.stockContainer.boxes[0]?.item.boxPositionData).toEqual(firstSourceBox?.item.boxPositionData);
    expect(auction.items.find((item) => item.position === 10)?.boxId).toBe(10);
    expect(auction.stockContainer.boxes.find((box) => box.position === 10)?.item.boxPositionData.slice(0, 2)).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ]);
    expect(auction.stockContainer.boxes[0]?.item.isLock).toBe(true);
    expect(created.coins).toBe(9_000);
    expect(inventoryQuantity(created, String(SEND_AUCTION_TEST_ITEM_ID))).toBe(0);
    expect(created.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.some((box) => box.item.cid === SEND_AUCTION_TEST_ITEM_ID)).toBe(false);

    const recycledSnapshot = profiles.recycleSendAuction('p_send_auction', auction.slotId);
    const recycled = recycledSnapshot.profile;
    expect(recycledSnapshot.sourceSendAuctionRecycle).toEqual({ errorCode: 0 });

    expect(recycled.sendAuctions?.find((candidate) => candidate.id === auction.id)).toEqual(expect.objectContaining({
      status: 'recycled',
      finalPrice: unitValue * 15,
      profit: 0
    }));
    const recycledGame = recycled.sendAuctionGames?.[0]!;
    expect(profiles.listSendAuctionGames('p_send_auction')).toEqual(expect.objectContaining({
      errorCode: 0,
      sendAuctionGameDataList: [expect.objectContaining({
        uid: recycledGame.uid,
        mapCid: 101,
        gameOverTime: recycledGame.gameOverTime,
        gameData: expect.objectContaining({ mapId: 2101 })
      })],
      games: [expect.objectContaining({ sendAuctionId: auction.id })]
    }));
    expect(recycledGame).toEqual(expect.objectContaining({
      sendAuctionId: auction.id,
      mapCid: 101,
      bidMapId: 2101,
      finalPrice: unitValue * 15,
      totalValue: unitValue * 15,
      profit: 0
    }));
    expect(recycledGame.gameData.stockContainer.stockBoxes).toHaveLength(15);
    expect(recycledGame.gameData.stockContainer.stockBoxes[0]?.item.uid).toBe(auction.stockContainer.boxes[0]?.item.sourceUid);
    expect(recycledGame.gameData.stockContainer.stockBoxes[0]?.item.boxPositionData).toEqual(auction.stockContainer.boxes[0]?.item.boxPositionData);
    expect(recycledGame.gameData.stockContainer.stockBoxes.find((box) => box.boxId === 10)).toEqual(expect.objectContaining({
      boxId: 10,
      position: { x: 1, y: 0 },
      item: expect.objectContaining({
        boxPositionData: [
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ]
      })
    }));
    expect(recycledGame.gameData.stockContainer.stockBoxes[0]?.item.isLock).toBe(true);
    expect(recycledGame.gameData.userLog.some((user) =>
      user.priceLog.at(-1)?.itemCidOrPrice === unitValue * 15
    )).toBe(true);
    expect(recycled.mail.some((mail) => mail.title === '委托拍卖已回收')).toBe(true);
    expect(recycled.coins).toBe(9_000 + unitValue * 15);
    expect(inventoryQuantity(recycled, String(SEND_AUCTION_TEST_ITEM_ID))).toBe(0);
    expect(profiles.getSnapshot('p_send_auction').transactions.map((transaction) => transaction.reason)).toEqual(expect.arrayContaining([
      'send_auction_fee',
      'send_auction_item_lock',
      'send_auction_recycle_coins',
      'send_auction_result_mail'
    ]));
  });

  it('settles send auctions with the auction final price and enforces original count/slot gates', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_send_auction_rules', '委托规则');
    resetStockInventory(profile);
    profile.coins = 1_000_000;
    addInventory(profile, 'warehouse', String(SEND_AUCTION_TEST_ITEM_ID), 75, 'test:send_auction:rules');

    expect(() => profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profile, SEND_AUCTION_TEST_ITEM_ID, 14))).toThrow('委托件数需在 15-20 件之间');

    const first = profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profile, SEND_AUCTION_TEST_ITEM_ID, 15)).profile.sendAuctions?.[0]!;
    const settled = profiles.settleSendAuction('p_send_auction_rules', first.id, first.totalValue + 5_000).profile;
    expect(settled.sendAuctions?.find((candidate) => candidate.id === first.id)).toEqual(expect.objectContaining({
      status: 'settled',
      finalPrice: first.totalValue + 5_000,
      profit: 5_000
    }));
    const settledGame = settled.sendAuctionGames?.[0]!;
    expect(settledGame).toEqual(expect.objectContaining({
      sendAuctionId: first.id,
      finalPrice: first.totalValue + 5_000,
      totalValue: first.totalValue,
      profit: 5_000
    }));
    expect(settledGame.gameData.mapId).toBe(first.bidMapId);
    expect(settledGame.gameData.sendAuctionUserName).toBe('委托规则');
    expect(settledGame.gameData.userLog.some((user) =>
      user.priceLog.at(-1)?.itemCidOrPrice === first.totalValue + 5_000
    )).toBe(true);
    expect(settled.mail.some((mail) => mail.title === '委托拍卖已成交')).toBe(true);

    const second = profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profiles.getOrCreateProfile('p_send_auction_rules'), SEND_AUCTION_TEST_ITEM_ID, 15)).profile.sendAuctions?.[0]!;
    const third = profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profiles.getOrCreateProfile('p_send_auction_rules'), SEND_AUCTION_TEST_ITEM_ID, 15)).profile.sendAuctions?.[0]!;
    const fourth = profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profiles.getOrCreateProfile('p_send_auction_rules'), SEND_AUCTION_TEST_ITEM_ID, 15)).profile.sendAuctions?.[0]!;

    expect([second.slotId, third.slotId, fourth.slotId]).toEqual([0, 1, 2]);
    expect(() => profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profiles.getOrCreateProfile('p_send_auction_rules'), SEND_AUCTION_TEST_ITEM_ID, 15), 1)).toThrow('委托槽位已满');
    expect(() => profiles.createSendAuction('p_send_auction_rules', 101, selectWarehouseStockBoxes(profiles.getOrCreateProfile('p_send_auction_rules'), SEND_AUCTION_TEST_ITEM_ID, 15))).toThrow('委托槽位已满');
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
    expect(profile.xp).toBe(Item.find((item) => item.id === 100102)?.base_value ?? 0);
    expect(profile.level).toBeGreaterThan(1);
    expect(profile.rankPoints).toBe(8);
    expect(profile.lastRewards).toEqual(expect.objectContaining({
      collectionExpBefore: 0,
      collectionExpAfter: Item.find((item) => item.id === 100102)?.base_value ?? 0,
      collectionLevelBefore: 1,
      collectionLevelAfter: profile.level,
      lossRecovery: 0
    }));
    expect(inventoryQuantity(profile, 'compat_100102')).toBe(1);
    const matchAwardBox = profile.stockContainers?.find((container) => container.kind === 'warehouse')?.boxes.find((box) => box.item.cid === 100102);
    expect(matchAwardBox).toEqual(expect.objectContaining({
      item: expect.objectContaining({
        sourceUid: expect.any(Number),
        sourceId: expect.stringContaining('match:match_profile_test:p_match:item:compat_100102'),
        boxPositionData: expect.arrayContaining([expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })]),
        isLock: false
      })
    }));
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

  it('applies match loss recovery and duplicate collection experience once', () => {
    const profiles = createProfileService(createMemoryStore());
    profiles.getOrCreateProfile('p_loss_recovery', '掌柜返利');
    const itemBaseValue = Item.find((item) => item.id === 100102)?.base_value ?? 0;
    const summary: FinalMatchSummary = {
      matchId: 'match_loss_recovery',
      seed: 4,
      rankings: [
        {
          playerId: 'p_loss_recovery',
          name: '掌柜返利',
          rank: 2,
          cash: 0,
          holdingsValue: 0,
          setBonus: 0,
          netWorth: 0
        }
      ],
      netWorthCurve: [],
      bestMove: { title: '测试', detail: '测试' },
      biggestMistake: { title: '测试', detail: '测试' },
      revealedItems: [],
      awardedItemsByPlayerId: {
        p_loss_recovery: [
          {
            id: 'compat_100102_1',
            name: '测试藏品',
            category: '测试',
            rarity: 'rare',
            value: itemBaseValue,
            displayValue: itemBaseValue,
            isFake: false,
            repairCost: 0,
            iconKey: 'bidking_item_100102',
            footprint: { w: 1, h: 1 }
          },
          {
            id: 'compat_100102_2',
            name: '测试藏品',
            category: '测试',
            rarity: 'rare',
            value: itemBaseValue,
            displayValue: itemBaseValue,
            isFake: false,
            repairCost: 0,
            iconKey: 'bidking_item_100102',
            footprint: { w: 1, h: 1 }
          }
        ]
      },
      lossRecoveryByPlayerId: { p_loss_recovery: 12_000 },
      rewards: [{ playerId: 'p_loss_recovery', xp: 999_999, coins: 0, rankPoints: -5 }],
      eventCount: 0,
      transactionCount: 0
    };

    profiles.applyMatchSummary('p_loss_recovery', summary);
    profiles.applyMatchSummary('p_loss_recovery', summary);

    const snapshot = profiles.getSnapshot('p_loss_recovery');
    const profile = snapshot.profile;
    expect(profile.coins).toBe(DEFAULT_PROFILE_COINS + 12_000);
    expect(profile.xp).toBe(itemBaseValue + Math.floor(itemBaseValue * 0.5));
    expect(profile.rankPoints).toBe(0);
    expect(inventoryQuantity(profile, 'compat_100102')).toBe(2);
    expect(profile.lastRewards).toEqual(expect.objectContaining({
      xp: itemBaseValue + Math.floor(itemBaseValue * 0.5),
      lossRecovery: 12_000,
      collectionExpBefore: 0,
      collectionExpAfter: itemBaseValue + Math.floor(itemBaseValue * 0.5)
    }));
    expect(snapshot.transactions.filter((transaction) => transaction.reason === 'match_loss_recovery')).toHaveLength(1);
    expect(snapshot.transactions.filter((transaction) => transaction.reason === 'match_award_item')).toHaveLength(1);
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

function resetStockInventory(profile: PlayerProfile): void {
  profile.inventory = [];
  profile.stockContainers = [];
  profile.stockState = { nextBoxId: 1, nextItemNo: 1 };
  profile.settings.bidkingStockContainersV1 = true;
}

function selectWarehouseStockBoxes(profile: PlayerProfile, itemCid: number, quantity: number): Array<{ stockId: number; boxId: number }> {
  const warehouse = profile.stockContainers?.find((container) => container.kind === 'warehouse');
  const boxes = warehouse?.boxes.filter((box) => box.item.cid === itemCid).slice(0, quantity) ?? [];
  if (!warehouse || boxes.length < quantity) {
    throw new Error(`仓库藏品不足：${itemCid}`);
  }
  return boxes.map((box) => ({ stockId: warehouse.stockId, boxId: box.boxId }));
}
