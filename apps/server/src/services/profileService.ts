import type {
  FinalMatchSummary,
  MarketOrdersSnapshot,
  PlayerProfile,
  ProfileSnapshot,
  ProfileTransaction,
  RankSnapshot
} from '@bitkingdom/shared';
import {
  MAX_RECENT_PROFILE_TRANSACTIONS
} from '../domain/profile/profileRuntimeConfig';
import {
  buyShopItemForProfile,
  refreshShopForProfile,
  setShopItemCollectionForProfile
} from '../domain/economy/profileCommerceRuntime';
import {
  buildMarketOrdersSnapshot,
  cancelMarketOrderForProfile,
  createMarketOrderForProfile,
  expireMarketOrdersForProfile,
  settleMarketOrderForProfile
} from '../domain/economy/profileMarketRuntime';
import {
  cancelDemoPayOrderForProfile,
  completeDemoPayOrderForProfile,
  completePurchaseListOrderForProfile,
  createDemoPayOrderForProfile,
  unlockDemoDlcForProfile
} from '../domain/economy/profilePurchaseRuntime';
import {
  equipBattleItemsForProfile,
  useBattleItemForProfile
} from '../domain/profile/profileBattleItemRuntime';
import {
  applyMatchSummaryForProfile,
  claimAchievementRewardForProfile,
  claimLevelRewardForProfile,
  claimMissionRewardForProfile,
  completeTaskForProfile
} from '../domain/profile/profileProgressRuntime';
import {
  claimActivityRewardForProfile,
  claimGiftPackageForProfile,
  claimMailForProfile,
  deleteMailForProfile,
  markMailReadForProfile
} from '../domain/profile/profileClaimRuntime';
import {
  applyRewardRowsToProfile,
  claimRankRewardForProfile
} from '../domain/profile/profileRewardRuntime';
import {
  buildProfileSnapshot,
  listProfilesForAdmin,
  listProfileTransactions
} from '../domain/profile/profileQueryRuntime';
import {
  clearCabinetItemForProfile,
  selectHeadForProfile,
  selectHeroSkinForProfile,
  setCabinetItemForProfile,
  updateProfileSettings
} from '../domain/profile/profilePreferenceRuntime';
import { getOrCreateProfileInState } from '../domain/profile/profileLifecycle';
import { claimCollectionIncomeForProfile } from '../domain/profile/profileCollectionRuntime';
import {
  claimReliefFundForProfile,
  reliefFundSnapshotForProfile,
  type ReliefFundSnapshot
} from '../domain/profile/profileReliefFundRuntime';
import { sellInventoryItemForProfile } from '../domain/profile/profileInventorySaleRuntime';
import { addCustomMailToProfile } from '../domain/profile/profileMailRuntime';
import { consumeTicketForMatchProfile, refreshTicketState } from '../domain/profile/profileTicketRuntime';
import { createEconomyLedger } from '../domain/economy/economyLedger';
import {
  addDemoFriendToProfile,
  addDemoGuildApplicationForProfile,
  approveGuildMemberForProfile,
  claimAreaResourceForProfile,
  claimGuildResourceForProfile,
  donateGuildCoinsForProfile,
  joinGuildForProfile,
  kickGuildMemberForProfile,
  removeFriendFromProfile,
  setFriendRemarkForProfile,
  setGuildRoleForProfile,
  updateGuildNoticeForProfile,
  useGuildResourceForProfile
} from '../domain/profile/guildRuntime';
import {
  applyLanguageNameToProfile,
  completeGuideForProfile,
  markNoticeReadForProfile
} from '../domain/profile/profileSystemRuntime';
import { recordMissionEventFromTransaction } from '../domain/profile/profileMissionEventRuntime';
import {
  buildAreaSnapshot,
  buildActivityProgressSnapshot,
  buildCollectionBonus,
  buildExchangeRestockSnapshot,
  buildRankSnapshot,
  buildSimSnapshot,
  type ActivityProgressSnapshot,
  type AreaSnapshot,
  type CollectionBonusSnapshot,
  type ExchangeRestockSnapshot,
  type SimSnapshot
} from '../domain/profile/profileSnapshotRuntime';
import { checkAccess } from './conditionService';
import type { ServerStore } from './store';
import type { ProfileService } from './profileServiceTypes';

export type { ProfileService } from './profileServiceTypes';

export function createProfileService(store: ServerStore): ProfileService {
  const economy = createEconomyLedger(store);

  function getOrCreateProfile(playerId: string, name?: string): PlayerProfile {
    const profile = getOrCreateProfileInState(store.state.profiles, playerId, name);
    store.save();
    return profile;
  }

  function getSnapshot(playerId: string, name?: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId, name);
    if (expireMarketOrdersForProfile(profile, recordTransaction) > 0) {
      store.save();
    }
    return buildProfileSnapshot(profile, transactionsFor(profile.playerId));
  }

  function updateSettings(playerId: string, settings: Record<string, string | number | boolean>): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    updateProfileSettings(profile, settings);
    const changedKeys = Object.keys(settings).length;
    if (changedKeys > 0) {
      recordTransaction(
        profile,
        `profile_settings:${profile.playerId}:${Date.now()}`,
        'profile_settings_update',
        'task',
        0,
        changedKeys
      );
    }
    store.save();
    return getSnapshot(playerId);
  }

  function selectHead(playerId: string, headId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    selectHeadForProfile(profile, headId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function setCabinetItem(playerId: string, itemId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    setCabinetItemForProfile(profile, itemId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function clearCabinetItem(playerId: string, itemId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (clearCabinetItemForProfile(profile, itemId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function selectHeroSkin(playerId: string, skinId: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    selectHeroSkinForProfile(profile, skinId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function refreshTickets(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    refreshTicketState(profile);
    store.save();
    return getSnapshot(playerId);
  }

  function consumeTicketForMatch(playerId: string, sourceId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (consumeTicketForMatchProfile(profile, sourceId, hasTransactionSource, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function completeTask(playerId: string, taskId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (completeTaskForProfile(profile, taskId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function claimMissionReward(playerId: string, taskId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimMissionRewardForProfile(profile, taskId, applyRewardRows)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function claimAchievementReward(playerId: string, achievementId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    claimAchievementRewardForProfile(profile, achievementId, applyRewardRows);
    store.save();
    return getSnapshot(playerId);
  }

  function claimLevelReward(playerId: string, level: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimLevelRewardForProfile(profile, level, applyRewardRows)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function applyMatchSummary(playerId: string, summary: FinalMatchSummary): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (applyMatchSummaryForProfile(profile, summary, applyNumberChange, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function sellInventoryItem(playerId: string, refId: string, quantity: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    sellInventoryItemForProfile(profile, refId, quantity, applyNumberChange, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function buyShopItem(playerId: string, shopItemId: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    buyShopItemForProfile(profile, shopItemId, checkAccess, applyNumberChange, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function refreshShop(playerId: string, shopId?: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    refreshShopForProfile(profile, shopId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function setShopItemCollection(playerId: string, itemId: number, collected: boolean): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (setShopItemCollectionForProfile(profile, itemId, collected, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function claimMail(playerId: string, mailId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    claimMailForProfile(profile, mailId, applyRewardRows, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function deliverSystemMail(
    playerId: string,
    input: { sourceKey: string; title: string; body: string; rewards?: number[][]; expiresAt?: number }
  ): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    const mail = addCustomMailToProfile(profile, {
      sourceKey: input.sourceKey,
      title: input.title,
      body: input.body,
      attachmentRewards: input.rewards,
      expiresAt: input.expiresAt
    });
    if (!mail) {
      throw new Error('邮件已存在或信箱已满');
    }
    recordTransaction(profile, `mail:${profile.playerId}:${mail.id}:deliver`, 'mail_system_deliver', 'mail', 0, 1);
    store.save();
    return getSnapshot(playerId);
  }

  function markMailRead(playerId: string, mailId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    markMailReadForProfile(profile, mailId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function deleteMail(playerId: string, mailId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    deleteMailForProfile(profile, mailId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function equipBattleItems(playerId: string, itemIds: number[]): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    equipBattleItemsForProfile(profile, itemIds, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function useBattleItem(playerId: string, itemId: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    useBattleItemForProfile(profile, itemId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function claimRankReward(playerId: string, rank: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimRankRewardForProfile(profile, rank, applyRewardRows, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function claimActivityReward(playerId: string, activityId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimActivityRewardForProfile(profile, activityId, applyRewardRows)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function claimGiftPackage(playerId: string, packageId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimGiftPackageForProfile(profile, packageId, applyRewardRows, recordTransaction, hasTransactionSource)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function createDemoPayOrder(playerId: string, payId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    createDemoPayOrderForProfile(profile, payId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function completeDemoPayOrder(playerId: string, payId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (completeDemoPayOrderForProfile(profile, payId, applyNumberChange, recordTransaction, hasTransactionSource)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function cancelDemoPayOrder(playerId: string, orderId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (cancelDemoPayOrderForProfile(profile, orderId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function completePurchaseListOrder(playerId: string, purchaseId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (completePurchaseListOrderForProfile(profile, purchaseId, applyNumberChange, recordTransaction, hasTransactionSource)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function unlockDemoDlc(playerId: string, dlcId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (unlockDemoDlcForProfile(profile, dlcId, applyRewardRows, recordTransaction, hasTransactionSource)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function createMarketOrder(
    playerId: string,
    refId: string,
    quantity: number,
    price: number,
    orderType: 'trade' | 'auction',
    note?: string
  ): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    expireMarketOrdersForProfile(profile, recordTransaction);
    createMarketOrderForProfile(profile, refId, quantity, price, orderType, recordTransaction, note, applyNumberChange);
    store.save();
    return getSnapshot(playerId);
  }

  function settleMarketOrder(playerId: string, orderId: string): ProfileSnapshot {
    const buyerProfile = getOrCreateProfile(playerId);
    const sellerProfile = Object.values(store.state.profiles)
      .find((profile) => profile.marketOrders.some((order) => order.id === orderId)) ?? buyerProfile;
    const expired = expireMarketOrdersForProfile(sellerProfile, recordTransaction);
    const buyer = sellerProfile.playerId === buyerProfile.playerId ? undefined : buyerProfile;
    if (settleMarketOrderForProfile(sellerProfile, orderId, applyNumberChange, recordTransaction, buyer) || expired > 0) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function cancelMarketOrder(playerId: string, orderId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    const expired = expireMarketOrdersForProfile(profile, recordTransaction);
    if (cancelMarketOrderForProfile(profile, orderId, recordTransaction) || expired > 0) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function listMarketOrders(orderType?: 'trade' | 'auction'): MarketOrdersSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireMarketOrdersForProfile(profile, recordTransaction);
    }
    if (expired > 0) {
      store.save();
    }
    return buildMarketOrdersSnapshot(Object.values(store.state.profiles), orderType);
  }

  function addDemoFriend(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (addDemoFriendToProfile(profile, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function removeFriend(playerId: string, friendId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (removeFriendFromProfile(profile, friendId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function setFriendRemark(playerId: string, friendId: string, remark: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (setFriendRemarkForProfile(profile, friendId, remark, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function joinGuild(playerId: string, areaId?: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    joinGuildForProfile(profile, areaId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function setGuildRole(playerId: string, roleId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (setGuildRoleForProfile(profile, roleId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function addDemoGuildApplication(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (addDemoGuildApplicationForProfile(profile, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function approveGuildMember(playerId: string, applicantId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (approveGuildMemberForProfile(profile, applicantId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function kickGuildMember(playerId: string, memberId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (kickGuildMemberForProfile(profile, memberId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function updateGuildNotice(playerId: string, notice: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (updateGuildNoticeForProfile(profile, notice, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function donateGuildCoins(playerId: string, amount: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    donateGuildCoinsForProfile(profile, amount, applyNumberChange);
    store.save();
    return getSnapshot(playerId);
  }

  function claimGuildResource(playerId: string, resourceId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    claimGuildResourceForProfile(profile, resourceId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function claimAreaResource(playerId: string, areaId?: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    claimAreaResourceForProfile(profile, areaId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function useGuildResource(playerId: string, resourceId: string, quantity = 1): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    useGuildResourceForProfile(profile, resourceId, quantity, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function getRankSnapshot(rankId?: string, page?: number, pageSize?: number): RankSnapshot {
    return buildRankSnapshot(Object.values(store.state.profiles), rankId, page, pageSize);
  }

  function getAreaSnapshot(): AreaSnapshot {
    return buildAreaSnapshot(Object.values(store.state.profiles));
  }

  function getActivityProgress(playerId: string): ActivityProgressSnapshot {
    return buildActivityProgressSnapshot(getOrCreateProfile(playerId));
  }

  function getCollectionBonus(playerId: string): CollectionBonusSnapshot {
    return buildCollectionBonus(getOrCreateProfile(playerId));
  }

  function claimCollectionIncome(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimCollectionIncomeForProfile(profile, applyNumberChange)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function getReliefFundSnapshot(playerId: string): ReliefFundSnapshot {
    return reliefFundSnapshotForProfile(getOrCreateProfile(playerId));
  }

  function claimReliefFund(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (claimReliefFundForProfile(profile, applyRewardRows, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function getExchangeRestockSnapshot(): ExchangeRestockSnapshot {
    return buildExchangeRestockSnapshot();
  }

  function getSimSnapshot(): SimSnapshot {
    return buildSimSnapshot();
  }

  function markNoticeRead(playerId: string, noticeId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (markNoticeReadForProfile(profile, noticeId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function completeGuide(playerId: string, guideId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (completeGuideForProfile(profile, guideId, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function applyLanguageName(playerId: string, seed = Date.now()): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    applyLanguageNameToProfile(profile, seed, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function applyRewardRows(
    profile: PlayerProfile,
    sourcePrefix: string,
    rewards: readonly (readonly number[])[],
    reason: string
  ): void {
    applyRewardRowsToProfile(profile, sourcePrefix, rewards, reason, applyNumberChange, recordTransaction);
  }

  function listProfiles(): PlayerProfile[] {
    const profileList = listProfilesForAdmin(Object.values(store.state.profiles));
    store.save();
    return profileList;
  }

  function listTransactions(limit = MAX_RECENT_PROFILE_TRANSACTIONS, playerId?: string): ProfileTransaction[] {
    return listProfileTransactions(store.state.transactions, limit, playerId);
  }

  function applyNumberChange(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
    amountChange: number
  ): void {
    const shouldRecordMissionEvent = amountChange !== 0 && !economy.hasSource(sourceId);
    economy.applyNumberChange(profile, sourceId, reason, resource, amountChange);
    if (shouldRecordMissionEvent) {
      recordMissionEventFromTransaction(profile, { sourceId, reason, resource, amountChange });
    }
  }

  function recordTransaction(
    profile: PlayerProfile,
    sourceId: string,
    reason: string,
    resource: ProfileTransaction['resource'],
    amountBefore: number,
    amountChange: number
  ): void {
    const shouldRecordMissionEvent = !economy.hasSource(sourceId);
    economy.record(profile, sourceId, reason, resource, amountBefore, amountChange);
    if (shouldRecordMissionEvent) {
      recordMissionEventFromTransaction(profile, { sourceId, reason, resource, amountChange });
    }
  }

  function hasTransactionSource(sourceId: string): boolean {
    return economy.hasSource(sourceId);
  }

  function transactionsFor(playerId: string): ProfileTransaction[] {
    return economy.transactionsFor(playerId, MAX_RECENT_PROFILE_TRANSACTIONS);
  }

  return {
    getOrCreateProfile,
    getSnapshot,
    updateSettings,
    selectHead,
    setCabinetItem,
    clearCabinetItem,
    selectHeroSkin,
    refreshTickets,
    consumeTicketForMatch,
    completeTask,
    claimMissionReward,
    claimAchievementReward,
    claimLevelReward,
    applyMatchSummary,
    sellInventoryItem,
    buyShopItem,
    refreshShop,
    setShopItemCollection,
    claimMail,
    deliverSystemMail,
    markMailRead,
    deleteMail,
    equipBattleItems,
    useBattleItem,
    claimRankReward,
    claimActivityReward,
    claimGiftPackage,
    createDemoPayOrder,
    completeDemoPayOrder,
    cancelDemoPayOrder,
    completePurchaseListOrder,
    unlockDemoDlc,
    createMarketOrder,
    settleMarketOrder,
    cancelMarketOrder,
    listMarketOrders,
    addDemoFriend,
    removeFriend,
    setFriendRemark,
    joinGuild,
    setGuildRole,
    addDemoGuildApplication,
    approveGuildMember,
    kickGuildMember,
    updateGuildNotice,
    donateGuildCoins,
    claimGuildResource,
    claimAreaResource,
    useGuildResource,
    markNoticeRead,
    completeGuide,
    applyLanguageName,
    getRankSnapshot,
    getAreaSnapshot,
    getActivityProgress,
    getCollectionBonus,
    claimCollectionIncome,
    getReliefFundSnapshot,
    claimReliefFund,
    getExchangeRestockSnapshot,
    getSimSnapshot,
    listTransactions,
    listProfiles
  };
}
