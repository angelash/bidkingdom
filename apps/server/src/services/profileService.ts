import type {
  AuctionHouseBidLogListSnapshot,
  AuctionHouseBidPriceResponse,
  AuctionHouseItemInfoSnapshot,
  AuctionHouseItemPriceInfoListSnapshot,
  AuctionHouseItemSortModel,
  AuctionHouseLanchItemListSnapshot,
  AuctionHouseTradeInfoListSnapshot,
  AuctionHouseUnlockLanchSlotResponse,
  AuctionHouseUnlanchItemResponse,
  ExchangeBuyItemResponse,
  ExchangeCollectItemListSnapshot,
  ExchangeCollectItemResponse,
  ExchangeInfoSnapshot,
  ExchangeItemTradeInfoListSnapshot,
  ExchangeLanchItemResponse,
  ExchangeLunchItemListSnapshot,
  ExchangeTradeInfoListSnapshot,
  ExchangeUnlanchItemResponse,
  FinalMatchSummary,
  MarketOrdersSnapshot,
  PlayerProfile,
  ProfileSnapshot,
  ProfileTransaction,
  RankSnapshot,
  SendAuctionCreateResponse,
  SendAuctionGameListSnapshot,
  SendAuctionListSnapshot,
  SendAuctionRecycleResponse
} from '@bitkingdom/shared';
import {
  bidKingBidMapAccess,
  bidKingBidMapEntryCosts,
  bidKingDailyMapEntryKey
} from '@bitkingdom/match-core';
import {
  MAX_RECENT_PROFILE_TRANSACTIONS
} from '../domain/profile/profileRuntimeConfig';
import {
  buyShopItemForProfile,
  refreshShopForProfile,
  setShopItemCollectionForProfile
} from '../domain/economy/profileCommerceRuntime';
import {
  bidAuctionHousePriceForProfiles,
  buildAuctionHouseBidLogListSnapshot,
  buildAuctionHouseItemInfoSnapshot,
  buildAuctionHouseItemPriceInfoListSnapshot,
  buildAuctionHouseLanchItemListSnapshot,
  buildAuctionHouseTradeInfoListSnapshot,
  buildExchangeCollectItemListSnapshot,
  buildExchangeInfoSnapshot,
  buildExchangeItemTradeInfoListSnapshot,
  buildExchangeLanchItemListSnapshot,
  buildExchangeTradeInfoListSnapshot,
  buildMarketOrdersSnapshot,
  buyExchangeItemForProfiles,
  collectExchangeItemForProfile,
  cancelAuctionHouseLanchItemForProfile,
  cancelExchangeLanchItemForProfile,
  cancelMarketOrderForProfile,
  createExchangeLanchItemForProfile,
  createMarketOrderForProfile,
  expireMarketOrdersForProfile,
  reExchangeLanchItemForProfile,
  settleExpiredAuctionHouseOrderForProfile,
  settleMarketOrderForProfile,
  unlockAuctionHouseLanchSlotForProfile
} from '../domain/economy/profileMarketRuntime';
import {
  buildSendAuctionGameListSnapshot,
  buildSendAuctionListSnapshot,
  buildSourceSendAuctionCreateResponse,
  buildSourceSendAuctionRecycleResponse,
  createSendAuctionForProfile,
  recycleSendAuctionForProfile,
  settleSendAuctionForProfile,
  type SendAuctionItemSelectionInput
} from '../domain/economy/profileSendAuctionRuntime';
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
  selectHeroForProfile,
  selectHeadForProfile,
  selectHeroSkinForProfile,
  setCabinetItemForProfile,
  unlockHeroForProfile,
  updateProfileSettings
} from '../domain/profile/profilePreferenceRuntime';
import { getOrCreateProfileInState } from '../domain/profile/profileLifecycle';
import { claimCollectionIncomeForProfile } from '../domain/profile/profileCollectionRuntime';
import {
  claimReliefFundForProfile,
  reliefFundSnapshotForProfile,
  type ReliefFundSnapshot
} from '../domain/profile/profileReliefFundRuntime';
import {
  sellAllInventoryItemsForProfile,
  sellInventoryItemForProfile
} from '../domain/profile/profileInventorySaleRuntime';
import { addCustomMailToProfile } from '../domain/profile/profileMailRuntime';
import { consumeInventory, inventoryQuantity } from '../domain/profile/profileInventory';
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
    if (expireProfileMarketOrders(profile) > 0) {
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

  function selectHero(playerId: string, heroId: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    selectHeroForProfile(profile, heroId, recordTransaction);
    store.save();
    return getSnapshot(playerId);
  }

  function unlockHero(playerId: string, heroId: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (unlockHeroForProfile(profile, heroId, applyNumberChange, recordTransaction)) {
      store.save();
    }
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

  function consumeBidMapEntryCost(playerId: string, bidMapId: number | undefined, sourceId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    const batchSourceId = `${sourceId}:entry_cost`;
    if (hasTransactionSource(batchSourceId)) {
      return getSnapshot(playerId);
    }
    const access = bidKingBidMapAccess(profile, bidMapId);
    if (!access.canEnter) {
      throw new Error(`未满足入场条件：${access.reasons.join('、')}`);
    }

    for (const cost of bidKingBidMapEntryCosts(bidMapId)) {
      const costSourceId = `${batchSourceId}:${cost.refId}`;
      if (cost.refId === 1) {
        applyNumberChange(profile, costSourceId, 'bidmap_entry_cost_coins', 'coins', -cost.quantity);
        continue;
      }
      const before = inventoryQuantity(profile, cost.refId);
      if (before < cost.quantity) {
        throw new Error(`缺少凭证 ${cost.refId} x${cost.quantity}`);
      }
      consumeInventory(profile, cost.refId, cost.quantity);
      recordTransaction(profile, costSourceId, 'bidmap_entry_cost_item', 'item', before, -cost.quantity);
    }
    if (access.parentMap?.daily_counts && access.parentMap.daily_counts > 0) {
      const dailyKey = bidKingDailyMapEntryKey(access.parentMap.id);
      profile.dailyMapEntries ??= {};
      const before = profile.dailyMapEntries[dailyKey] ?? 0;
      profile.dailyMapEntries[dailyKey] = before + 1;
      recordTransaction(profile, `${batchSourceId}:daily_map:${access.parentMap.id}`, 'bidmap_daily_entry', 'task', before, 1);
    }
    recordTransaction(profile, batchSourceId, 'bidmap_entry_cost', 'task', 0, 1);
    store.save();
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

  function sellAllInventoryItems(playerId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    sellAllInventoryItemsForProfile(profile, applyNumberChange, recordTransaction);
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
    expireProfileMarketOrders(profile);
    createMarketOrderForProfile(profile, refId, quantity, price, orderType, recordTransaction, note, applyNumberChange);
    store.save();
    return getSnapshot(playerId);
  }

  function lanchExchangeItem(
    playerId: string,
    itemCid: number,
    count: number,
    totalPrice: number,
    reLanchItemUid = 0
  ): ProfileSnapshot & { sourceExchangeLanchItem: ExchangeLanchItemResponse } {
    const profile = getOrCreateProfile(playerId);
    expireProfileMarketOrders(profile);
    const sourceExchangeLanchItem = reLanchItemUid > 0
      ? reExchangeLanchItemForProfile(profile, reLanchItemUid)
      : createExchangeLanchItemForProfile(profile, itemCid, count, totalPrice, recordTransaction, applyNumberChange);
    if (sourceExchangeLanchItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceExchangeLanchItem
    };
  }

  function settleMarketOrder(playerId: string, orderId: string): ProfileSnapshot {
    const buyerProfile = getOrCreateProfile(playerId);
    const sellerProfile = Object.values(store.state.profiles)
      .find((profile) => profile.marketOrders.some((order) => order.id === orderId)) ?? buyerProfile;
    const expired = expireProfileMarketOrders(sellerProfile);
    const buyer = sellerProfile.playerId === buyerProfile.playerId ? undefined : buyerProfile;
    if (settleMarketOrderForProfile(sellerProfile, orderId, applyNumberChange, recordTransaction, buyer) || expired > 0) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function cancelMarketOrder(playerId: string, orderId: string): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    const expired = expireProfileMarketOrders(profile);
    if (cancelMarketOrderForProfile(profile, orderId, recordTransaction, refundAuctionHouseBidEscrow, settleExpiredAuctionHouseOrder) || expired > 0) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function cancelExchangeLanchItem(
    playerId: string,
    itemUid: number
  ): ProfileSnapshot & { sourceExchangeUnlanchItem: ExchangeUnlanchItemResponse } {
    const profile = getOrCreateProfile(playerId);
    const sourceExchangeUnlanchItem = cancelExchangeLanchItemForProfile(profile, itemUid, recordTransaction);
    if (sourceExchangeUnlanchItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceExchangeUnlanchItem
    };
  }

  function cancelAuctionHouseLanchItem(
    playerId: string,
    itemUid: number
  ): ProfileSnapshot & { sourceAuctionHouseUnlanchItem: AuctionHouseUnlanchItemResponse } {
    const profile = getOrCreateProfile(playerId);
    const sourceAuctionHouseUnlanchItem = cancelAuctionHouseLanchItemForProfile(
      profile,
      itemUid,
      recordTransaction,
      refundAuctionHouseBidEscrow,
      settleExpiredAuctionHouseOrder
    );
    if (sourceAuctionHouseUnlanchItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceAuctionHouseUnlanchItem
    };
  }

  function unlockAuctionHouseLanchSlot(
    playerId: string,
    unlockCount = 1
  ): ProfileSnapshot & { sourceAuctionHouseUnlockLanchSlot: AuctionHouseUnlockLanchSlotResponse } {
    const profile = getOrCreateProfile(playerId);
    const sourceAuctionHouseUnlockLanchSlot = unlockAuctionHouseLanchSlotForProfile(
      profile,
      unlockCount,
      applyNumberChange
    );
    if (sourceAuctionHouseUnlockLanchSlot.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceAuctionHouseUnlockLanchSlot
    };
  }

  function listMarketOrders(orderType?: 'trade' | 'auction'): MarketOrdersSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    return buildMarketOrdersSnapshot(Object.values(store.state.profiles), orderType);
  }

  function listExchangeLanchItems(playerId: string): ExchangeLunchItemListSnapshot {
    const profile = getOrCreateProfile(playerId);
    const expired = expireProfileMarketOrders(profile);
    if (expired > 0) {
      store.save();
    }
    return buildExchangeLanchItemListSnapshot(profile);
  }

  function listExchangeInfo(playerId?: string): ExchangeInfoSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    return buildExchangeInfoSnapshot(Object.values(store.state.profiles), Date.now(), playerId);
  }

  function listExchangeItemTradeInfo(itemCid: number, playerId?: string): ExchangeItemTradeInfoListSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    return buildExchangeItemTradeInfoListSnapshot(Object.values(store.state.profiles), itemCid, Date.now(), playerId);
  }

  function buyExchangeItem(
    playerId: string,
    itemCid: number,
    itemCount: number,
    estimatePrice: number
  ): ProfileSnapshot & { sourceExchangeBuyItem: ExchangeBuyItemResponse } {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    const buyerProfile = getOrCreateProfile(playerId);
    const sourceExchangeBuyItem = buyExchangeItemForProfiles(
      Object.values(store.state.profiles),
      buyerProfile,
      itemCid,
      itemCount,
      estimatePrice,
      applyNumberChange,
      recordTransaction
    );
    if (expired > 0 || sourceExchangeBuyItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceExchangeBuyItem
    };
  }

  function listExchangeTradeInfo(playerId: string): ExchangeTradeInfoListSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    const profile = getOrCreateProfile(playerId);
    return buildExchangeTradeInfoListSnapshot(profile, Object.values(store.state.profiles));
  }

  function collectExchangeItem(
    playerId: string,
    itemCid: number
  ): ProfileSnapshot & { sourceExchangeCollectItem: ExchangeCollectItemResponse } {
    const profile = getOrCreateProfile(playerId);
    const sourceExchangeCollectItem = collectExchangeItemForProfile(profile, itemCid, true, recordTransaction);
    if (sourceExchangeCollectItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceExchangeCollectItem
    };
  }

  function uncollectExchangeItem(
    playerId: string,
    itemCid: number
  ): ProfileSnapshot & { sourceExchangeUncollectItem: ExchangeCollectItemResponse } {
    const profile = getOrCreateProfile(playerId);
    const sourceExchangeUncollectItem = collectExchangeItemForProfile(profile, itemCid, false, recordTransaction);
    if (sourceExchangeUncollectItem.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceExchangeUncollectItem
    };
  }

  function listExchangeCollectItems(playerId: string): ExchangeCollectItemListSnapshot {
    const profile = getOrCreateProfile(playerId);
    return buildExchangeCollectItemListSnapshot(profile);
  }

  function listAuctionHouseLanchItems(playerId: string): AuctionHouseLanchItemListSnapshot {
    const profile = getOrCreateProfile(playerId);
    const expired = expireProfileMarketOrders(profile);
    if (expired > 0) {
      store.save();
    }
    return buildAuctionHouseLanchItemListSnapshot(profile);
  }

  function listAuctionHouseItems(options: { itemCid?: number; isDisplayPeriod?: number; sortType?: AuctionHouseItemSortModel; page?: number; pageSize?: number; reverse?: boolean } = {}): AuctionHouseItemInfoSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    return buildAuctionHouseItemInfoSnapshot(Object.values(store.state.profiles), options);
  }

  function listAuctionHouseItemPriceInfo(): AuctionHouseItemPriceInfoListSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    return buildAuctionHouseItemPriceInfoListSnapshot(Object.values(store.state.profiles));
  }

  function bidAuctionHousePrice(
    playerId: string,
    itemUid: number,
    price: number
  ): ProfileSnapshot & { sourceAuctionHouseBidPrice: AuctionHouseBidPriceResponse } {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    const bidderProfile = getOrCreateProfile(playerId);
    const sourceAuctionHouseBidPrice = bidAuctionHousePriceForProfiles(
      Object.values(store.state.profiles),
      bidderProfile,
      itemUid,
      price,
      applyNumberChange,
      recordTransaction
    );
    if (expired > 0 || sourceAuctionHouseBidPrice.errorCode === 0) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceAuctionHouseBidPrice
    };
  }

  function listAuctionHouseBidLogs(playerId: string): AuctionHouseBidLogListSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    const profile = getOrCreateProfile(playerId);
    return buildAuctionHouseBidLogListSnapshot(profile, Object.values(store.state.profiles));
  }

  function listAuctionHouseTradeInfo(playerId: string): AuctionHouseTradeInfoListSnapshot {
    let expired = 0;
    for (const profile of Object.values(store.state.profiles)) {
      expired += expireProfileMarketOrders(profile);
    }
    if (expired > 0) {
      store.save();
    }
    const profile = getOrCreateProfile(playerId);
    return buildAuctionHouseTradeInfoListSnapshot(profile, Object.values(store.state.profiles));
  }

  function createSendAuction(
    playerId: string,
    mapCid: number,
    itemSelections: SendAuctionItemSelectionInput[],
    slotId?: number
  ): ProfileSnapshot & { sourceSendAuction: SendAuctionCreateResponse } {
    const profile = getOrCreateProfile(playerId);
    const auction = createSendAuctionForProfile(profile, mapCid, itemSelections, applyNumberChange, recordTransaction, slotId);
    store.save();
    return {
      ...getSnapshot(playerId),
      sourceSendAuction: buildSourceSendAuctionCreateResponse(auction)
    };
  }

  function settleSendAuction(playerId: string, sendAuctionId: string, finalPrice?: number): ProfileSnapshot {
    const profile = getOrCreateProfile(playerId);
    if (settleSendAuctionForProfile(profile, sendAuctionId, finalPrice, applyNumberChange, recordTransaction)) {
      store.save();
    }
    return getSnapshot(playerId);
  }

  function recycleSendAuction(playerId: string, slotId: number): ProfileSnapshot & { sourceSendAuctionRecycle: SendAuctionRecycleResponse } {
    const profile = getOrCreateProfile(playerId);
    if (recycleSendAuctionForProfile(profile, slotId, applyNumberChange, recordTransaction)) {
      store.save();
    }
    return {
      ...getSnapshot(playerId),
      sourceSendAuctionRecycle: buildSourceSendAuctionRecycleResponse()
    };
  }

  function listSendAuctions(playerId: string, includeHistory = true): SendAuctionListSnapshot {
    return buildSendAuctionListSnapshot(getOrCreateProfile(playerId), includeHistory);
  }

  function listSendAuctionGames(playerId: string): SendAuctionGameListSnapshot {
    return buildSendAuctionGameListSnapshot(getOrCreateProfile(playerId));
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
    resource: Extract<ProfileTransaction['resource'], 'coins' | 'goldCoins' | 'boundGoldCoins' | 'rankPoints' | 'xp'>,
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

  function expireProfileMarketOrders(profile: PlayerProfile): number {
    return expireMarketOrdersForProfile(profile, recordTransaction, Date.now(), refundAuctionHouseBidEscrow, settleExpiredAuctionHouseOrder);
  }

  function refundAuctionHouseBidEscrow(order: PlayerProfile['marketOrders'][number], now: number): void {
    const bidderId = order.sourceAuctionHouseMaxBidderId;
    const refund = Math.max(0, Math.floor(order.sourceAuctionHouseMaxPrice ?? 0));
    if (!bidderId || refund <= 0) {
      return;
    }
    const bidderProfile = store.state.profiles[bidderId];
    if (!bidderProfile) {
      return;
    }
    applyNumberChange(
      bidderProfile,
      `auction_house:${order.id}:${bidderId}:${now}:refund_closed`,
      'auction_house_bid_refund',
      'coins',
      refund
    );
  }

  function settleExpiredAuctionHouseOrder(
    sellerProfile: PlayerProfile,
    order: PlayerProfile['marketOrders'][number],
    now: number
  ): boolean {
    const bidderId = order.sourceAuctionHouseMaxBidderId;
    if (!bidderId) {
      return false;
    }
    const bidderProfile = store.state.profiles[bidderId];
    if (!bidderProfile) {
      return false;
    }
    return settleExpiredAuctionHouseOrderForProfile(
      sellerProfile,
      order,
      bidderProfile,
      applyNumberChange,
      recordTransaction,
      now
    );
  }

  function transactionsFor(playerId: string): ProfileTransaction[] {
    return economy.transactionsFor(playerId, MAX_RECENT_PROFILE_TRANSACTIONS);
  }

  return {
    getOrCreateProfile,
    getSnapshot,
    updateSettings,
    selectHead,
    selectHero,
    unlockHero,
    setCabinetItem,
    clearCabinetItem,
    selectHeroSkin,
    refreshTickets,
    consumeTicketForMatch,
    consumeBidMapEntryCost,
    completeTask,
    claimMissionReward,
    claimAchievementReward,
    claimLevelReward,
    applyMatchSummary,
    sellInventoryItem,
    sellAllInventoryItems,
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
    lanchExchangeItem,
    settleMarketOrder,
    cancelMarketOrder,
    cancelExchangeLanchItem,
    cancelAuctionHouseLanchItem,
    unlockAuctionHouseLanchSlot,
    listMarketOrders,
    listExchangeLanchItems,
    listExchangeInfo,
    listExchangeItemTradeInfo,
    buyExchangeItem,
    listExchangeTradeInfo,
    collectExchangeItem,
    uncollectExchangeItem,
    listExchangeCollectItems,
    listAuctionHouseLanchItems,
    listAuctionHouseItems,
    listAuctionHouseItemPriceInfo,
    bidAuctionHousePrice,
    listAuctionHouseBidLogs,
    listAuctionHouseTradeInfo,
    createSendAuction,
    settleSendAuction,
    recycleSendAuction,
    listSendAuctions,
    listSendAuctionGames,
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
