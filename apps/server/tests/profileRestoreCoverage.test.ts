import {
  Achievement,
  Activity,
  Area,
  BattleItem,
  Cabinet,
  DirtyWords,
  Dlc,
  ErrorCode,
  ExchangeRestock,
  GiftPackage,
  Guide,
  GuildArea,
  GuildPermissions,
  GuildPoints,
  GuildResources,
  Head,
  HeroSkin,
  Item,
  ItemRestock,
  ItemType,
  LevelUp,
  Mail,
  Mission,
  Notice,
  NumberTable,
  Pay,
  PurchaseList,
  Rank,
  RankReward,
  Shop,
  ShopItem,
  Ticket,
  WareHouse,
  bidKingGuildResourceRuntime
} from '@bitkingdom/bidking-compat';
import { parseBidKingNumberRows } from '@bitkingdom/match-core';
import { describe, expect, it } from 'vitest';
import { languageNamesFromSeed } from '../src/domain/profile/languageNameRuntime';
import { addMailFromTemplate } from '../src/domain/profile/profileMailRuntime';
import { createProfileService } from '../src/services/profileService';
import type { ServerStore } from '../src/services/store';

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

function cabinetForItem(item: (typeof Item)[number]): (typeof Cabinet)[number] {
  return Cabinet.find((cabinet) => item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)))
    ?? Cabinet[0]!;
}

function cabinetAcceptsItem(cabinet: (typeof Cabinet)[number], item: (typeof Item)[number]): boolean {
  return cabinet.quality_requirement.length === 0 || cabinet.quality_requirement.includes(item.item_quality);
}

function cabinetPlaceLimit(cabinet: (typeof Cabinet)[number]): number {
  const placeMax = cabinet.place_max > 0 ? cabinet.place_max : 15;
  const maxSlotLimit = cabinet.max_slot_limit > 0 ? cabinet.max_slot_limit : placeMax;
  return Math.min(placeMax, maxSlotLimit);
}

describe('BidKing profile restore coverage', () => {
  it('drives Head, HeroSkin, Cabinet, WareHouse, Item, and ItemType profile state from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_growth_tables', '掌柜成长表');
    const collectionItem = Item.find((item) =>
      item.slot_type > 0 &&
      Cabinet.some((cabinet) =>
        item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)) &&
        cabinetAcceptsItem(cabinet, item)
      )
    );

    expect(collectionItem).toBeDefined();
    const canonicalItemId = `compat_${collectionItem!.id}`;
    const matchingCabinet = cabinetForItem(collectionItem!);
    const compatibleItemIds = Item
      .filter((item) =>
        item.item_type_ids.some((typeId) => matchingCabinet.location_type.includes(typeId)) &&
        cabinetAcceptsItem(matchingCabinet, item)
      )
      .slice(0, cabinetPlaceLimit(matchingCabinet) + 3)
      .map((item) => `compat_${item.id}`);
    const head = Head.at(-1)!;
    const skin = HeroSkin[0]!;

    expect(() => profiles.setCabinetItem(profile.playerId, canonicalItemId)).toThrow('藏品尚未解锁');
    profile.codex = [...new Set(compatibleItemIds.filter((itemId) => itemId !== canonicalItemId)), canonicalItemId];
    profiles.selectHead(profile.playerId, head.id);
    profiles.selectHeroSkin(profile.playerId, skin.id);
    for (const itemId of profile.codex) {
      profiles.setCabinetItem(profile.playerId, itemId);
    }

    const snapshot = profiles.getSnapshot(profile.playerId);
    expect(snapshot.profile.headId).toBe(head.id);
    expect(snapshot.profile.selectedHeroSkins?.[String(skin.skinhero)]).toBe(skin.id);
    expect(snapshot.profile.cabinetItemIds?.[0]).toBe(canonicalItemId);
    expect(snapshot.profile.cabinetItemIds?.length).toBeLessThanOrEqual(cabinetPlaceLimit(matchingCabinet));
    expect(WareHouse[0]?.packaged_name).toBeTruthy();
    expect(ItemType.some((itemType) => collectionItem!.item_type_ids.includes(itemType.id))).toBe(true);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['head_select', 'hero_skin_select', 'cabinet_place'])
    );
  });

  it('drives Mission, Achievement, LevelUp, and Number growth rewards from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_growth_rewards', '掌柜成长奖励');
    const missionTaskRow = Mission.filter((mission) => mission.display > 0 || mission.reward.length > 0)[0]!;
    const achievement = Achievement[0]!;
    const levelRow = LevelUp.find((row) => row.id === 2) ?? LevelUp[0]!;
    const activeTier = NumberTable.reduce((best, row) => (row.counts < best.counts ? row : best), NumberTable[0]!);

    profiles.completeTask(profile.playerId, 'daily_complete_match');
    profiles.claimMissionReward(profile.playerId, 'daily_complete_match');
    profile.level = Math.max(profile.level, levelRow.id);
    profile.completedMatches = Array.from({ length: 7 }, (_, index) => `match_growth_${index + 1}`);
    profiles.claimLevelReward(profile.playerId, levelRow.id);
    profiles.claimAchievementReward(profile.playerId, achievement.id);
    profile.codex = Array.from({ length: activeTier.counts }, (_, index) => `compat_collection_${index + 1}`);

    const bonus = profiles.getCollectionBonus(profile.playerId);
    const snapshot = profiles.getSnapshot(profile.playerId);
    const actionableMissionIds = Mission
      .filter((mission) => mission.display > 0 || mission.reward.length > 0 || mission.conditions.length > 0 || mission.refreshtype > 0)
      .map((mission) => String(mission.Id));

    expect(snapshot.profile.claimedMissionRewards).toContain('daily_complete_match');
    expect(Object.keys(snapshot.profile.missionProgress ?? {})).toEqual(expect.arrayContaining(actionableMissionIds));
    expect(snapshot.transactions.some((transaction) => transaction.sourceId.includes(`:${missionTaskRow.Id}`))).toBe(true);
    expect(snapshot.profile.claimedLevelRewards).toContain(levelRow.id);
    expect(snapshot.profile.claimedAchievements?.length).toBeGreaterThan(0);
    expect(bonus.tiers).toHaveLength(NumberTable.length);
    expect(bonus.tiers.find((tier) => tier.id === activeTier.Id)).toEqual(
      expect.objectContaining({ active: true, bonus: activeTier.numberbonus })
    );
  });

  it('archives Mission and Achievement event sources across profile domains', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_mission_event_sources', '掌柜事件源');
    const collectionItem = Item.find((item) =>
      item.collection_coin > 0 &&
      Cabinet.some((cabinet) =>
        item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)) &&
        cabinetAcceptsItem(cabinet, item)
      )
    )!;
    const battleShopItemId = 40056;
    const battleItemId = 100121;

    expect(BattleItem.some((item) => item.id === battleItemId)).toBe(true);
    profile.coins = 600_000;
    profile.codex = [`compat_${collectionItem.id}`];
    profile.lastCollectionIncomeAt = Date.now() - 2 * 3600_000;

    profiles.buyShopItem(profile.playerId, battleShopItemId);
    profiles.equipBattleItems(profile.playerId, [battleItemId]);
    profiles.useBattleItem(profile.playerId, battleItemId);
    profiles.setCabinetItem(profile.playerId, `compat_${collectionItem.id}`);
    profiles.claimCollectionIncome(profile.playerId);
    profiles.addDemoFriend(profile.playerId);
    profiles.joinGuild(profile.playerId, GuildArea[0]!.id);
    profiles.markNoticeRead(profile.playerId, Notice[0]!.id);
    profiles.completeGuide(profile.playerId, Guide[0]!.id);
    profiles.updateSettings(profile.playerId, { uiScale: 1, motto: 'mission event source' });

    const snapshot = profiles.getSnapshot(profile.playerId);
    const eventCounts = snapshot.profile.conditionStats?.missionEventCounts ?? {};
    const domainCounts = snapshot.profile.conditionStats?.missionEventDomainCounts ?? {};

    for (const domain of ['battle', 'economy', 'social', 'collection', 'system'] as const) {
      expect(domainCounts[domain]).toBeGreaterThan(0);
    }
    expect(eventCounts['battle.battle_item_use']).toBeGreaterThan(0);
    expect(eventCounts['economy.shop_buy_item']).toBeGreaterThan(0);
    expect(eventCounts['collection.cabinet_place']).toBeGreaterThan(0);
    expect(eventCounts['collection.collection_income_claim']).toBeGreaterThan(0);
    expect(eventCounts['social.friend_add']).toBeGreaterThan(0);
    expect(eventCounts['social.guild_join_area']).toBeGreaterThan(0);
    expect(eventCounts['system.notice_read']).toBeGreaterThan(0);
    expect(eventCounts['system.guide_complete']).toBeGreaterThan(0);
    expect(eventCounts['system.profile_settings_update']).toBeGreaterThan(0);
    expect(snapshot.profile.missionProgress?.['5310001']).toEqual(expect.objectContaining({ completed: true }));
  });
});

describe('BidKing commerce restore coverage', () => {
  it('drives Ticket, Shop, ShopItem, ItemRestock, and ExchangeRestock runtime snapshots from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_commerce_tables', '掌柜商业表');
    const randomShop = Shop.find((shop) => shop.random > 0 && shop.randcounts > 0)!;
    const shopRows = ShopItem.filter((item) => item.shopid === randomShop.id);

    profiles.consumeTicketForMatch(profile.playerId, 'match_start:p_commerce_tables:one');
    const ticketSnapshot = profiles.refreshTickets(profile.playerId).profile;
    const shopSnapshot = profiles.refreshShop(profile.playerId, randomShop.id).profile;
    const restock = shopSnapshot.shopRestocks?.find((entry) => entry.shopId === randomShop.id);
    const exchange = profiles.getExchangeRestockSnapshot();

    expect(ticketSnapshot.tickets).toEqual(
      expect.objectContaining({
        id: Ticket[0]!.id,
        max: Ticket[0]!.max,
        name: Ticket[0]!.packaged_name,
        recoverTimeSeconds: Ticket[0]!.recovertime
      })
    );
    expect(restock?.shopItemIds).toHaveLength(Math.min(shopRows.length, randomShop.randcounts));
    expect(shopSnapshot.tickets.current).toBe(ticketSnapshot.tickets.current - Math.max(0, randomShop.ticket));
    expect(restock?.shopItemIds.every((shopItemId) => shopRows.some((row) => row.id === shopItemId))).toBe(true);
    expect(restock?.restockItemIds.length).toBeGreaterThan(0);
    expect(restock?.restockItemIds.every((itemId) => ItemRestock.some((row) => Number(row.columns[3]) === itemId))).toBe(true);
    expect(restock?.nextRefreshAt).toBeGreaterThan(restock?.refreshedAt ?? 0);
    expect(exchange.pools).toHaveLength(ExchangeRestock.length);
    expect(exchange.pools.every((pool) => pool.itemIds.every((itemId) => Item.some((item) => item.id === itemId)))).toBe(true);
    expect(exchange.pools.some((pool) => pool.shopItemIds.length > 0 && pool.offers.length > 0)).toBe(true);
    expect(exchange.pools.every((pool) => pool.offers.every((offer) => ShopItem.some((row) => row.id === offer.shopItemId)))).toBe(true);
  });

  it('applies GiftPackage, Pay, PurchaseList, and Dlc rows once through profile ledger state', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_commerce_rewards', '掌柜商业奖励');

    for (const pay of Pay) {
      profiles.createDemoPayOrder(profile.playerId, pay.id);
      profiles.completeDemoPayOrder(profile.playerId, pay.id);
      profiles.completeDemoPayOrder(profile.playerId, pay.id);
    }
    for (const giftPackage of GiftPackage) {
      profiles.claimGiftPackage(profile.playerId, giftPackage.id);
      profiles.claimGiftPackage(profile.playerId, giftPackage.id);
    }
    for (const purchase of PurchaseList) {
      profiles.completePurchaseListOrder(profile.playerId, purchase.id);
      profiles.completePurchaseListOrder(profile.playerId, purchase.id);
    }
    for (const dlc of Dlc) {
      profiles.unlockDemoDlc(profile.playerId, dlc.id);
      profiles.unlockDemoDlc(profile.playerId, dlc.id);
    }

    const snapshot = profiles.getSnapshot(profile.playerId);
    const expectedGiftItem2 = GiftPackage
      .flatMap((row) => parseBidKingNumberRows(row.columns[7]))
      .filter(([, refId = 0]) => refId === 2)
      .reduce((sum, [, , quantity = 0]) => sum + quantity, 0);

    expect(snapshot.profile.purchaseOrders?.filter((order) => order.source === 'pay' && order.status === 'completed')).toHaveLength(Pay.length);
    expect(snapshot.profile.purchaseOrders?.filter((order) => order.source === 'purchaseList' && order.status === 'completed')).toHaveLength(PurchaseList.length);
    expect(snapshot.profile.dlcUnlocks).toHaveLength(Dlc.length);
    expect(inventoryQuantity(snapshot.profile.inventory, '2')).toBeGreaterThanOrEqual(expectedGiftItem2);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining([
        'gift_package_claim',
        'pay_demo_complete',
        'purchase_list_demo_complete',
        'dlc_unlock'
      ])
    );
  });
});

describe('BidKing market, rank, and social restore coverage', () => {
  it('drives market orders, Rank snapshots, and RankReward claims from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const seller = profiles.getOrCreateProfile('p_market_rank_seller', '掌柜市集');
    const contender = profiles.getOrCreateProfile('p_market_rank_contender', '掌柜榜首');
    const rank = Rank[0]!;
    const topReward = RankReward[0]!;

    seller.rankPoints = 30;
    contender.rankPoints = 90;
    profiles.claimRankReward(seller.playerId, 1);
    profiles.buyShopItem(seller.playerId, 40001);
    const listed = profiles.createMarketOrder(seller.playerId, '100102', 1, 8800, 'trade').profile.marketOrders[0]!;
    const settled = profiles.settleMarketOrder(seller.playerId, listed.id).profile.marketOrders[0]!;
    const ranking = profiles.getRankSnapshot(rank.id);
    const marketSnapshot = profiles.listMarketOrders('trade');

    expect(ranking.title).toBe(rank.packaged_name);
    expect(ranking.entries[0]).toEqual(expect.objectContaining({ playerId: contender.playerId, rank: 1 }));
    expect(profiles.getSnapshot(seller.playerId).profile.claimedRankRewards).toContain(topReward.id);
    expect(inventoryQuantity(profiles.getSnapshot(seller.playerId).profile.inventory, topReward.columns[2]!)).toBe(0);
    expect(settled).toEqual(expect.objectContaining({ status: 'sold', listingFee: 44, tax: 1010, fee: 1054, netPrice: 7746 }));
    expect(marketSnapshot.orders[0]).toEqual(expect.objectContaining({ id: listed.id, playerId: seller.playerId, orderType: 'trade' }));
  });

  it('drives friend, guild, area, resource, points, permission, and LanguageName state from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_social_tables', '掌柜社交表');
    const guildArea = GuildArea[0]!;
    const permission = GuildPermissions[0]!;
    const pointTier = GuildPoints[0]!;
    const resource = GuildResources[0]!;
    const donationRange = parseBidKingNumberRows(pointTier.columns[3]).flat();
    const donationAmount = donationRange[0] ?? 50_000;

    profile.coins = Math.max(profile.coins, donationAmount + 10_000);
    profiles.addDemoFriend(profile.playerId);
    profiles.joinGuild(profile.playerId, guildArea.id);
    profiles.donateGuildCoins(profile.playerId, donationAmount);
    profiles.claimGuildResource(profile.playerId, resource.id);
    profiles.useGuildResource(profile.playerId, resource.id);
    profiles.claimAreaResource(profile.playerId, guildArea.id);
    const guildApplicant = profiles.addDemoGuildApplication(profile.playerId).profile.guildMembership!.pendingApplications![0]!;
    profiles.approveGuildMember(profile.playerId, guildApplicant.playerId);
    profiles.kickGuildMember(profile.playerId, guildApplicant.playerId);
    profiles.applyLanguageName(profile.playerId, 0);

    const snapshot = profiles.getSnapshot(profile.playerId);
    const areaSnapshot = profiles.getAreaSnapshot();
    const friend = snapshot.profile.friends[0]!;

    expect(friend.headId).toBe(Head[1]!.id);
    expect(GuildArea.some((row) => row.id === friend.areaId)).toBe(true);
    expect(friend.name).toBe(languageNamesFromSeed(1, 1)[0]);
    expect(friend.name).not.toMatch(/^languagename_/);
    expect(snapshot.profile.guildMembership).toEqual(
      expect.objectContaining({
        areaId: guildArea.id,
        roleId: permission.id,
        permissions: expect.objectContaining({ manageResource: permission.columns[6] === '1' })
      })
    );
    expect(snapshot.profile.guildMembership?.points).toBeGreaterThanOrEqual(Number(pointTier.columns[4] ?? 0));
    expect(snapshot.profile.guildMembership?.resources?.[resource.id]).toBe(1);
    expect(snapshot.profile.guildMembership?.pendingApplications).toHaveLength(0);
    expect(snapshot.profile.guildMembership?.members?.some((member) => member.playerId === guildApplicant.playerId)).toBe(false);
    expect(snapshot.profile.guildMembership?.members?.some((member) => member.playerId === profile.playerId)).toBe(true);
    expect(snapshot.profile.name).toBe(languageNamesFromSeed(0, 1)[0]);
    expect(snapshot.profile.name).not.toMatch(/^languagename_/);
    const joinedArea = areaSnapshot.areas.find((area) => area.areaName === Area.find((row) => row.id === guildArea.id)?.packaged_name || area.guildAreaId === guildArea.id);
    expect(joinedArea).toBeDefined();
    expect(joinedArea?.recommendedNames).toEqual(languageNamesFromSeed(Number(guildArea.id) * 10, 3));
    expect(joinedArea?.guildResourceUsage).toBe(bidKingGuildResourceRuntime(resource).usageLabel);
    expect(joinedArea?.guildResourceKey).toBe(bidKingGuildResourceRuntime(resource).iconKey || bidKingGuildResourceRuntime(resource).displayKey);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining([
        'guild_donate_spend',
        'guild_resource_claim',
        'guild_resource_use',
        'guild_area_resource_claim',
        'guild_member_apply',
        'guild_member_approve',
        'guild_member_kick',
        'language_name_apply'
      ])
    );
  });
});

describe('BidKing message and system restore coverage', () => {
  it('drives Activity, Mail, Notice, Guide, DirtyWords, and ErrorCode profile state from original rows', () => {
    const profiles = createProfileService(createMemoryStore());
    const profile = profiles.getOrCreateProfile('p_system_tables', '掌柜系统表');
    const mailTemplate = Mail.find((row) => parseBidKingNumberRows(row.columns[7]).length > 0) ?? Mail[0]!;
    const mail = addMailFromTemplate(profile, mailTemplate.id, 'restore_coverage')!;
    const activity = Activity.find((row) => row.columns[12]?.trim()) ?? Activity[0]!;
    const notice = Notice[0]!;
    const guide = Guide[0]!;
    const dirtyWord = DirtyWords[1]?.columns[1] ?? 'dirtywords_2_1';
    const errorCode = ErrorCode[0]!;

    profiles.claimMail(profile.playerId, mail.id);
    profiles.claimActivityReward(profile.playerId, activity.id);
    profiles.markNoticeRead(profile.playerId, notice.id);
    profiles.completeGuide(profile.playerId, guide.id);
    profiles.updateSettings(profile.playerId, { motto: `hello ${dirtyWord}` });

    const snapshot = profiles.getSnapshot(profile.playerId);

    expect(snapshot.profile.mail.find((entry) => entry.id === mail.id)?.claimed).toBe(true);
    expect(snapshot.profile.claimedActivityRewards).toContain(activity.id);
    expect(snapshot.profile.readNotices).toContain(notice.id);
    expect(snapshot.profile.completedGuides).toContain(guide.id);
    expect(String(snapshot.profile.settings.motto)).not.toContain(dirtyWord);
    expect(errorCode.columns[1]).toMatch(/^text_ErrorCode_/);
    expect(snapshot.transactions.map((transaction) => transaction.reason)).toEqual(
      expect.arrayContaining(['mail_claim', 'notice_read', 'guide_complete'])
    );
    expect(snapshot.transactions.some((transaction) => transaction.reason.startsWith('activity_reward'))).toBe(true);
  });
});

function inventoryQuantity(inventory: Array<{ refId: string; quantity: number }>, refId: string): number {
  return inventory
    .filter((entry) => entry.refId === refId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}
