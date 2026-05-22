import { Head } from '@bitkingdom/bidking-compat';
import {
  bidKingDefaultHeroId,
  bidKingStarterOwnedHeroIds,
  bidKingStarterHeadId,
  bidKingStarterInventoryRewards
} from '@bitkingdom/match-core';
import type { PlayerProfile } from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import { refreshExpiredShopRestocks } from '../economy/profileCommerceRuntime';
import { sanitizeDisplayName } from '../system/textGuard';
import {
  DEFAULT_PROFILE_COINS,
  DEFAULT_PROFILE_RANK_POINTS,
  LEGACY_DEFAULT_PROFILE_COINS
} from './profileRuntimeConfig';
import { addInventory } from './profileInventory';
import { ensureProfileHeroState } from './profileHeroRuntime';
import { ensureStarterMail } from './profileMailRuntime';
import { refreshMissionProgress } from './profileProgressRuntime';
import { ensureProfileShape } from './profileShape';
import { ensureProfileStockState } from './profileStockRuntime';
import { refreshTicketState, ticketRow } from './profileTicketRuntime';

export function getOrCreateProfileInState(
  profiles: Record<string, PlayerProfile>,
  playerId: string,
  name?: string
): PlayerProfile {
  const safeId = playerId.trim() || `p_${randomUUID()}`;
  const existing = profiles[safeId];
  if (existing) {
    return hydrateExistingProfile(existing, name);
  }
  const profile = createDefaultProfile(safeId, name, Date.now());
  profiles[safeId] = profile;
  return profile;
}

export function hydrateExistingProfile(profile: PlayerProfile, name?: string): PlayerProfile {
  ensureProfileShape(profile);
  const refreshed = refreshTicketState(profile);
  migrateLegacyStarterCoins(refreshed);
  ensureStarterRewards(refreshed);
  ensureProfileHeroState(refreshed);
  const nextName = sanitizeDisplayName(name, profile.name);
  if (name?.trim() && profile.name !== nextName) {
    refreshed.name = nextName;
    refreshed.updatedAt = Date.now();
  }
  refreshExpiredShopRestocks(refreshed);
  refreshMissionProgress(refreshed);
  ensureStarterMail(refreshed);
  return refreshed;
}

function migrateLegacyStarterCoins(profile: PlayerProfile): void {
  if (profile.coins !== LEGACY_DEFAULT_PROFILE_COINS) {
    return;
  }
  profile.coins = DEFAULT_PROFILE_COINS;
  if (profile.auctionStats?.currentTotalAssets === LEGACY_DEFAULT_PROFILE_COINS) {
    profile.auctionStats.currentTotalAssets = DEFAULT_PROFILE_COINS;
  }
  profile.updatedAt = Date.now();
}

function ensureStarterRewards(profile: PlayerProfile): void {
  if (profile.settings.bidkingStarterRewardsV1 === true) {
    return;
  }
  profile.headId ??= bidKingStarterHeadId(Head[0]?.id);
  for (const reward of bidKingStarterInventoryRewards()) {
    addInventory(profile, reward.type, reward.refId, reward.quantity, `starter:init_items:${reward.type}:${reward.refId}`);
  }
  profile.settings.bidkingStarterRewardsV1 = true;
  profile.updatedAt = Date.now();
}

export function createDefaultProfile(playerId: string, name: string | undefined, now: number): PlayerProfile {
  const displayName = sanitizeDisplayName(name, '试拍掌柜');
  const profile: PlayerProfile = {
    playerId,
    name: displayName,
    createdAt: now,
    level: 1,
    xp: 0,
    coins: DEFAULT_PROFILE_COINS,
    goldCoins: 0,
    boundGoldCoins: 0,
    rankPoints: DEFAULT_PROFILE_RANK_POINTS,
    headId: bidKingStarterHeadId(Head[0]?.id),
    selectedHeroId: bidKingDefaultHeroId(),
    ownedHeroIds: bidKingStarterOwnedHeroIds(),
    freeHeroIds: [],
    heroStates: [],
    dailyMapEntries: {},
    codex: [],
    cabinetItemIds: [],
    lastCollectionIncomeAt: now,
    selectedHeroSkins: {},
    completedMatches: [],
    completedTasks: [],
    claimedMissionRewards: [],
    claimedAchievements: [],
    missionRewardClaims: {},
    missionProgress: {},
    achievementProgress: {},
    auctionStats: {
      totalProfit: 0,
      dailyProfit: {},
      successfulAuctionCount: 0,
      failedAuctionCount: 0,
      highestBidAmount: 0,
      highestSingleAuctionProfit: 0,
      currentTotalAssets: DEFAULT_PROFILE_COINS,
      highestItemValue: 0,
      highestWinningItemTotalValue: 0,
      completedMapIds: [],
      completedBidMapIds: [],
      successfulAuctionCountByMap: {},
      lowestWinningItemTotalValueByMap: {},
      lowestWinningItemTotalValueByBidMap: {},
      updatedAt: now
    },
    conditionStats: {
      usedItemCount: 0,
      dailyUsedItemCount: {},
      usedItemCountsById: {},
      tradeBoughtCount: 0,
      tradeSoldCount: 0,
      auctionAcquiredItemIds: [],
      shopAcquiredItemIds: [],
      missionEventCounts: {},
      missionEventDomainCounts: {},
      updatedAt: now
    },
    claimedLevelRewards: [],
    tickets: {
      id: ticketRow().id,
      name: ticketRow().packaged_name,
      current: ticketRow().max,
      max: ticketRow().max,
      recoverTimeSeconds: ticketRow().recovertime,
      updatedAt: now
    },
    inventory: [],
    stockContainers: [],
    stockState: {
      nextBoxId: 1,
      nextItemNo: 1
    },
    mail: [],
    deletedMailTemplateIds: [],
    shopPurchases: [],
    shopRestocks: [],
    shopCollections: [],
    equippedBattleItems: [],
    claimedRankRewards: [],
    claimedActivityRewards: [],
    claimedGiftPackages: [],
    marketOrders: [],
    purchaseOrders: [],
    dlcUnlocks: [],
    friends: [],
    readNotices: [],
    completedGuides: [],
    settings: {},
    updatedAt: now
  };
  ensureProfileStockState(profile, now);
  ensureStarterRewards(profile);
  ensureProfileHeroState(profile, now);
  refreshMissionProgress(profile);
  ensureStarterMail(profile);
  return profile;
}
