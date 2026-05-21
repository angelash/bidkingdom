import {
  Head as bidKingHeads,
  Ticket as bidKingTickets,
  bidKingTicketDisplayName
} from '@bitkingdom/bidking-compat';
import {
  bidKingStarterCoins,
  bidKingStarterHeadId,
  bidKingStarterInventoryRewards
} from '@bitkingdom/match-core';
import type { AccountSessionSnapshot, CoreAuctionMode, PlayerInventoryEntry, PlayerProfile, PublicPlayerAccount } from '@bitkingdom/shared';
import { codexCatalogItems } from '../catalog/codexRuntime';

const PROFILE_KEY = 'bk_profile_v2';
const PROFILE_ID_KEY = 'bk_profile_id_v1';
const SESSION_KEY = 'bk_session_v2';
const ACCOUNT_SESSION_KEY = 'bk_account_session_v1';
const DEVICE_ID_KEY = 'bk_device_id_v1';
const CORE_AUCTION_MODE_KEY = 'bk_core_auction_mode';
const UNLOCK_ALL_CODEX_FOR_REVIEW = true;
const LEGACY_DEFAULT_PROFILE_COINS = 12_000;
const DEFAULT_PROFILE_COINS = bidKingStarterCoins(LEGACY_DEFAULT_PROFILE_COINS);

export interface StoredAccountSession {
  account: PublicPlayerAccount;
  sessionToken: string;
  expiresAt: number;
  profileId: string;
}

export function loadProfileId(): string {
  const existing = localStorage.getItem(PROFILE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `p_${crypto.randomUUID()}`
    : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(PROFILE_ID_KEY, id);
  return id;
}

export function loadProfile(): PlayerProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return normalizeProfileForReview(createDefaultProfile());
  }
  try {
    return normalizeProfileForReview({ ...createDefaultProfile(), ...JSON.parse(raw) } as PlayerProfile);
  } catch {
    return normalizeProfileForReview(createDefaultProfile());
  }
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadStoredAccountSession(): StoredAccountSession | undefined {
  const raw = localStorage.getItem(ACCOUNT_SESSION_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredAccountSession;
    if (!parsed.sessionToken || !parsed.profileId || parsed.expiresAt <= Date.now()) {
      clearStoredAccountSession();
      return undefined;
    }
    return parsed;
  } catch {
    clearStoredAccountSession();
    return undefined;
  }
}

export function saveAccountSession(snapshot: AccountSessionSnapshot): void {
  localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify({
    account: snapshot.account,
    sessionToken: snapshot.sessionToken,
    expiresAt: snapshot.expiresAt,
    profileId: snapshot.account.profileId
  } satisfies StoredAccountSession));
  localStorage.setItem(PROFILE_ID_KEY, snapshot.account.profileId);
  localStorage.setItem('bk_player_name', snapshot.profile.profile.name);
}

export function clearStoredAccountSession(): void {
  localStorage.removeItem(ACCOUNT_SESSION_KEY);
}

export function loadDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function loadCoreAuctionMode(): CoreAuctionMode {
  return localStorage.getItem(CORE_AUCTION_MODE_KEY) === 'open' ? 'open' : 'sealed';
}

export function saveCoreAuctionMode(mode: CoreAuctionMode): void {
  localStorage.setItem(CORE_AUCTION_MODE_KEY, mode);
}

function createDefaultProfile(): PlayerProfile {
  const ticket = bidKingTickets[0];
  const now = Date.now();
  return normalizeProfileForReview({
    playerId: loadProfileId(),
    name: localStorage.getItem('bk_player_name') ?? '试拍掌柜',
    createdAt: now,
    level: 1,
    xp: 0,
    coins: DEFAULT_PROFILE_COINS,
    rankPoints: 0,
    headId: bidKingStarterHeadId(bidKingHeads[0]?.id),
    codex: [],
    cabinetItemIds: [],
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
      updatedAt: now
    },
    claimedLevelRewards: [],
    tickets: {
      id: ticket?.id ?? 1,
      name: ticket ? bidKingTicketDisplayName(ticket) : '竞拍入场券',
      current: ticket?.max ?? 20,
      max: ticket?.max ?? 20,
      recoverTimeSeconds: ticket?.recovertime ?? 0,
      updatedAt: now
    },
    inventory: starterInventoryEntries(now),
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
    settings: { bidkingStarterRewardsV1: true },
    updatedAt: now
  });
}

export function normalizeProfileForReview(profile: PlayerProfile): PlayerProfile {
  const now = Date.now();
  const profileCoins = profile.coins === LEGACY_DEFAULT_PROFILE_COINS ? DEFAULT_PROFILE_COINS : profile.coins;
  const ticket = bidKingTickets.find((row) => row.id === profile.tickets?.id) ?? bidKingTickets[0];
  const catalogIds = new Set(codexCatalogItems.map((item) => item.id));
  const retainedCodex = profile.codex
    .map(canonicalCodexItemId)
    .filter((itemId) => catalogIds.has(itemId));
  const normalized = {
    ...profile,
    coins: profileCoins,
    claimedGiftPackages: profile.claimedGiftPackages ?? [],
    deletedMailTemplateIds: profile.deletedMailTemplateIds ?? [],
    tickets: {
      ...profile.tickets,
      name: ticket ? bidKingTicketDisplayName(ticket) : '竞拍入场券',
      max: ticket?.max ?? profile.tickets?.max ?? 20,
      recoverTimeSeconds: ticket?.recovertime ?? profile.tickets?.recoverTimeSeconds ?? 0
    },
    shopCollections: [...new Set((profile.shopCollections ?? []).map((itemId) => Math.floor(Number(itemId))).filter((itemId) => itemId > 0))].sort((left, right) => left - right),
    missionRewardClaims: profile.missionRewardClaims ?? {},
    missionProgress: profile.missionProgress ?? {},
    achievementProgress: profile.achievementProgress ?? {},
    auctionStats: {
      ...{
        totalProfit: 0,
        dailyProfit: {},
        successfulAuctionCount: 0,
        failedAuctionCount: 0,
        highestBidAmount: 0,
        highestSingleAuctionProfit: 0,
        currentTotalAssets: profileCoins ?? 0,
        highestItemValue: 0,
        highestWinningItemTotalValue: 0,
        completedMapIds: [],
        completedBidMapIds: [],
        successfulAuctionCountByMap: {},
        lowestWinningItemTotalValueByMap: {},
        lowestWinningItemTotalValueByBidMap: {},
        updatedAt: profile.updatedAt ?? now
      },
      ...(profile.auctionStats ?? {}),
      dailyProfit: profile.auctionStats?.dailyProfit ?? {},
      completedMapIds: profile.auctionStats?.completedMapIds ?? [],
      completedBidMapIds: profile.auctionStats?.completedBidMapIds ?? [],
      successfulAuctionCountByMap: profile.auctionStats?.successfulAuctionCountByMap ?? {},
      lowestWinningItemTotalValueByMap: profile.auctionStats?.lowestWinningItemTotalValueByMap ?? {},
      lowestWinningItemTotalValueByBidMap: profile.auctionStats?.lowestWinningItemTotalValueByBidMap ?? {}
    },
    conditionStats: {
      ...{
        usedItemCount: 0,
        dailyUsedItemCount: {},
        usedItemCountsById: {},
        updatedAt: profile.updatedAt ?? now
      },
      ...(profile.conditionStats ?? {}),
      dailyUsedItemCount: profile.conditionStats?.dailyUsedItemCount ?? {},
      usedItemCountsById: profile.conditionStats?.usedItemCountsById ?? {}
    },
    createdAt: profile.createdAt ?? profile.updatedAt ?? now
  };
  if (profile.coins === LEGACY_DEFAULT_PROFILE_COINS && normalized.auctionStats.currentTotalAssets === LEGACY_DEFAULT_PROFILE_COINS) {
    normalized.auctionStats.currentTotalAssets = DEFAULT_PROFILE_COINS;
  }
  ensureStarterRewards(normalized, now);
  if (!UNLOCK_ALL_CODEX_FOR_REVIEW) {
    return { ...normalized, codex: [...new Set(retainedCodex)] };
  }
  const allItemIds = [...catalogIds];
  const mergedCodex = [...new Set([...retainedCodex, ...allItemIds])];
  return {
    ...normalized,
    codex: mergedCodex
  };
}

function starterInventoryEntries(now: number): PlayerInventoryEntry[] {
  return bidKingStarterInventoryRewards().map((reward) => ({
    key: `${reward.type}:${reward.refId}`,
    type: reward.type,
    refId: reward.refId,
    quantity: reward.quantity,
    updatedAt: now
  }));
}

function ensureStarterRewards(profile: PlayerProfile, now: number): void {
  if (profile.settings.bidkingStarterRewardsV1 === true) {
    return;
  }
  profile.headId ??= bidKingStarterHeadId(bidKingHeads[0]?.id);
  for (const reward of bidKingStarterInventoryRewards()) {
    const key = `${reward.type}:${reward.refId}`;
    const entry = profile.inventory.find((candidate) => candidate.key === key);
    if (entry) {
      entry.quantity += reward.quantity;
      entry.updatedAt = now;
    } else {
      profile.inventory.push({
        key,
        type: reward.type,
        refId: reward.refId,
        quantity: reward.quantity,
        updatedAt: now
      });
    }
  }
  profile.settings.bidkingStarterRewardsV1 = true;
  profile.updatedAt = now;
}

function canonicalCodexItemId(itemId: string): string {
  const compatMatch = /^compat_(\d+)_\d+$/.exec(itemId);
  return compatMatch?.[1] ? `compat_${compatMatch[1]}` : itemId;
}

export function loadSession(): { roomCode: string; playerId: string } | undefined {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as { roomCode: string; playerId: string };
  } catch {
    return undefined;
  }
}

export function saveSession(roomCode: string, playerId: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId }));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
