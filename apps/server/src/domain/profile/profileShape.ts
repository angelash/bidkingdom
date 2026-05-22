import { Head } from '@bitkingdom/bidking-compat';
import { bidKingDefaultHeroId, bidKingStarterOwnedHeroIds } from '@bitkingdom/match-core';
import type { PlayerProfile } from '@bitkingdom/shared';
import { sanitizeText } from '../system/textGuard';
import { ensureProfileHeroState } from './profileHeroRuntime';
import { ensureProfileStockState } from './profileStockRuntime';

export function ensureProfileShape(profile: PlayerProfile): void {
  profile.createdAt ??= profile.updatedAt ?? Date.now();
  profile.inventory ??= [];
  profile.mail ??= [];
  profile.deletedMailTemplateIds ??= [];
  profile.shopPurchases ??= [];
  profile.shopRestocks ??= [];
  profile.shopCollections ??= [];
  profile.claimedMissionRewards ??= [];
  profile.claimedAchievements ??= [];
  profile.missionRewardClaims ??= {};
  profile.missionProgress ??= {};
  profile.achievementProgress ??= {};
  profile.auctionStats ??= {
    totalProfit: 0,
    dailyProfit: {},
    successfulAuctionCount: 0,
    failedAuctionCount: 0,
    highestBidAmount: 0,
    highestSingleAuctionProfit: 0,
    currentTotalAssets: profile.coins ?? 0,
    highestItemValue: 0,
    highestWinningItemTotalValue: 0,
    completedMapIds: [],
    completedBidMapIds: [],
    successfulAuctionCountByMap: {},
    lowestWinningItemTotalValueByMap: {},
    lowestWinningItemTotalValueByBidMap: {},
    updatedAt: profile.updatedAt ?? Date.now()
  };
  profile.auctionStats.totalProfit ??= 0;
  profile.auctionStats.successfulAuctionCount ??= 0;
  profile.auctionStats.failedAuctionCount ??= 0;
  profile.auctionStats.highestBidAmount ??= 0;
  profile.auctionStats.highestSingleAuctionProfit ??= 0;
  profile.auctionStats.currentTotalAssets ??= profile.coins ?? 0;
  profile.auctionStats.highestItemValue ??= 0;
  profile.auctionStats.highestWinningItemTotalValue ??= 0;
  profile.auctionStats.updatedAt ??= profile.updatedAt ?? Date.now();
  profile.auctionStats.dailyProfit ??= {};
  profile.auctionStats.completedMapIds ??= [];
  profile.auctionStats.completedBidMapIds ??= [];
  profile.auctionStats.successfulAuctionCountByMap ??= {};
  profile.auctionStats.lowestWinningItemTotalValueByMap ??= {};
  profile.auctionStats.lowestWinningItemTotalValueByBidMap ??= {};
  profile.conditionStats ??= {
    usedItemCount: 0,
    dailyUsedItemCount: {},
    usedItemCountsById: {},
    tradeBoughtCount: 0,
    tradeSoldCount: 0,
    auctionAcquiredItemIds: [],
    shopAcquiredItemIds: [],
    missionEventCounts: {},
    missionEventDomainCounts: {},
    updatedAt: profile.updatedAt ?? Date.now()
  };
  profile.conditionStats.usedItemCount ??= 0;
  profile.conditionStats.dailyUsedItemCount ??= {};
  profile.conditionStats.usedItemCountsById ??= {};
  profile.conditionStats.tradeBoughtCount ??= 0;
  profile.conditionStats.tradeSoldCount ??= 0;
  profile.conditionStats.auctionAcquiredItemIds ??= [];
  profile.conditionStats.shopAcquiredItemIds ??= [];
  profile.conditionStats.missionEventCounts ??= {};
  profile.conditionStats.missionEventDomainCounts ??= {};
  profile.conditionStats.updatedAt ??= profile.updatedAt ?? Date.now();
  profile.claimedLevelRewards ??= [];
  profile.headId ??= Head[0]?.id;
  profile.goldCoins ??= 0;
  profile.boundGoldCoins ??= 0;
  profile.ownedHeroIds ??= bidKingStarterOwnedHeroIds();
  profile.freeHeroIds ??= [];
  profile.selectedHeroId ??= profile.ownedHeroIds[0] ?? bidKingDefaultHeroId();
  profile.dailyMapEntries ??= {};
  profile.cabinetItemIds ??= [];
  profile.lastCollectionIncomeAt ??= profile.createdAt;
  profile.selectedHeroSkins ??= {};
  profile.equippedBattleItems ??= [];
  profile.claimedRankRewards ??= [];
  profile.claimedActivityRewards ??= [];
  profile.claimedGiftPackages ??= [];
  profile.marketOrders ??= [];
  profile.sendAuctions ??= [];
  profile.purchaseOrders ??= [];
  profile.dlcUnlocks ??= [];
  profile.friends ??= [];
  profile.readNotices ??= [];
  profile.completedGuides ??= [];
  profile.settings ??= {};
  ensureProfileStockState(profile);
  ensureProfileHeroState(profile);
}

export function sanitizeSettings(settings: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, typeof value === 'string' ? sanitizeText(value) : value])
  );
}
