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
import type {
  SendAuctionItemSelectionInput
} from '../domain/economy/profileSendAuctionRuntime';
import type {
  ReliefFundSnapshot
} from '../domain/profile/profileReliefFundRuntime';
import type {
  AreaSnapshot,
  ActivityProgressSnapshot,
  CollectionBonusSnapshot,
  ExchangeRestockSnapshot,
  SimSnapshot
} from '../domain/profile/profileSnapshotRuntime';

export interface ProfileService {
  getOrCreateProfile(playerId: string, name?: string): PlayerProfile;
  getSnapshot(playerId: string, name?: string): ProfileSnapshot;
  updateSettings(playerId: string, settings: Record<string, string | number | boolean>): ProfileSnapshot;
  selectHead(playerId: string, headId: string): ProfileSnapshot;
  selectHero(playerId: string, heroId: number): ProfileSnapshot;
  unlockHero(playerId: string, heroId: number): ProfileSnapshot;
  setCabinetItem(playerId: string, itemId: string): ProfileSnapshot;
  clearCabinetItem(playerId: string, itemId: string): ProfileSnapshot;
  selectHeroSkin(playerId: string, skinId: number): ProfileSnapshot;
  refreshTickets(playerId: string): ProfileSnapshot;
  consumeTicketForMatch(playerId: string, sourceId: string): ProfileSnapshot;
  consumeBidMapEntryCost(playerId: string, bidMapId: number | undefined, sourceId: string): ProfileSnapshot;
  completeTask(playerId: string, taskId: string): ProfileSnapshot;
  claimMissionReward(playerId: string, taskId: string): ProfileSnapshot;
  claimAchievementReward(playerId: string, achievementId: string): ProfileSnapshot;
  claimLevelReward(playerId: string, level: number): ProfileSnapshot;
  applyMatchSummary(playerId: string, summary: FinalMatchSummary): ProfileSnapshot;
  sellInventoryItem(playerId: string, refId: string, quantity: number): ProfileSnapshot;
  sellAllInventoryItems(playerId: string): ProfileSnapshot;
  buyShopItem(playerId: string, shopItemId: number): ProfileSnapshot;
  refreshShop(playerId: string, shopId?: number): ProfileSnapshot;
  setShopItemCollection(playerId: string, itemId: number, collected: boolean): ProfileSnapshot;
  claimMail(playerId: string, mailId: string): ProfileSnapshot;
  deliverSystemMail(playerId: string, input: { sourceKey: string; title: string; body: string; rewards?: number[][]; expiresAt?: number }): ProfileSnapshot;
  markMailRead(playerId: string, mailId: string): ProfileSnapshot;
  deleteMail(playerId: string, mailId: string): ProfileSnapshot;
  equipBattleItems(playerId: string, itemIds: number[]): ProfileSnapshot;
  useBattleItem(playerId: string, itemId: number): ProfileSnapshot;
  claimRankReward(playerId: string, rank: number): ProfileSnapshot;
  claimActivityReward(playerId: string, activityId: string): ProfileSnapshot;
  claimGiftPackage(playerId: string, packageId: string): ProfileSnapshot;
  createDemoPayOrder(playerId: string, payId: string): ProfileSnapshot;
  completeDemoPayOrder(playerId: string, payId: string): ProfileSnapshot;
  cancelDemoPayOrder(playerId: string, orderId: string): ProfileSnapshot;
  completePurchaseListOrder(playerId: string, purchaseId: string): ProfileSnapshot;
  unlockDemoDlc(playerId: string, dlcId: string): ProfileSnapshot;
  createMarketOrder(playerId: string, refId: string, quantity: number, price: number, orderType: 'trade' | 'auction', note?: string): ProfileSnapshot;
  lanchExchangeItem(playerId: string, itemCid: number, count: number, totalPrice: number, reLanchItemUid?: number): ProfileSnapshot & { sourceExchangeLanchItem: ExchangeLanchItemResponse };
  settleMarketOrder(playerId: string, orderId: string): ProfileSnapshot;
  cancelMarketOrder(playerId: string, orderId: string): ProfileSnapshot;
  cancelExchangeLanchItem(playerId: string, itemUid: number): ProfileSnapshot & { sourceExchangeUnlanchItem: ExchangeUnlanchItemResponse };
  listMarketOrders(orderType?: 'trade' | 'auction'): MarketOrdersSnapshot;
  listExchangeLanchItems(playerId: string): ExchangeLunchItemListSnapshot;
  listExchangeInfo(playerId?: string): ExchangeInfoSnapshot;
  listExchangeItemTradeInfo(itemCid: number, playerId?: string): ExchangeItemTradeInfoListSnapshot;
  buyExchangeItem(playerId: string, itemCid: number, itemCount: number, estimatePrice: number): ProfileSnapshot & { sourceExchangeBuyItem: ExchangeBuyItemResponse };
  listExchangeTradeInfo(playerId: string): ExchangeTradeInfoListSnapshot;
  collectExchangeItem(playerId: string, itemCid: number): ProfileSnapshot & { sourceExchangeCollectItem: ExchangeCollectItemResponse };
  uncollectExchangeItem(playerId: string, itemCid: number): ProfileSnapshot & { sourceExchangeUncollectItem: ExchangeCollectItemResponse };
  listExchangeCollectItems(playerId: string): ExchangeCollectItemListSnapshot;
  listAuctionHouseLanchItems(playerId: string): AuctionHouseLanchItemListSnapshot;
  listAuctionHouseItems(options?: { itemCid?: number; isDisplayPeriod?: number; sortType?: AuctionHouseItemSortModel; page?: number; pageSize?: number; reverse?: boolean }): AuctionHouseItemInfoSnapshot;
  listAuctionHouseItemPriceInfo(): AuctionHouseItemPriceInfoListSnapshot;
  bidAuctionHousePrice(playerId: string, itemUid: number, price: number): ProfileSnapshot & { sourceAuctionHouseBidPrice: AuctionHouseBidPriceResponse };
  cancelAuctionHouseLanchItem(playerId: string, itemUid: number): ProfileSnapshot & { sourceAuctionHouseUnlanchItem: AuctionHouseUnlanchItemResponse };
  unlockAuctionHouseLanchSlot(playerId: string, unlockCount?: number): ProfileSnapshot & { sourceAuctionHouseUnlockLanchSlot: AuctionHouseUnlockLanchSlotResponse };
  listAuctionHouseBidLogs(playerId: string): AuctionHouseBidLogListSnapshot;
  listAuctionHouseTradeInfo(playerId: string): AuctionHouseTradeInfoListSnapshot;
  createSendAuction(playerId: string, mapCid: number, itemSelections: SendAuctionItemSelectionInput[], slotId?: number): ProfileSnapshot & { sourceSendAuction: SendAuctionCreateResponse };
  settleSendAuction(playerId: string, sendAuctionId: string, finalPrice?: number): ProfileSnapshot;
  recycleSendAuction(playerId: string, slotId: number): ProfileSnapshot & { sourceSendAuctionRecycle: SendAuctionRecycleResponse };
  listSendAuctions(playerId: string, includeHistory?: boolean): SendAuctionListSnapshot;
  listSendAuctionGames(playerId: string): SendAuctionGameListSnapshot;
  addDemoFriend(playerId: string): ProfileSnapshot;
  removeFriend(playerId: string, friendId: string): ProfileSnapshot;
  setFriendRemark(playerId: string, friendId: string, remark: string): ProfileSnapshot;
  joinGuild(playerId: string, areaId?: string): ProfileSnapshot;
  setGuildRole(playerId: string, roleId: string): ProfileSnapshot;
  addDemoGuildApplication(playerId: string): ProfileSnapshot;
  approveGuildMember(playerId: string, applicantId: string): ProfileSnapshot;
  kickGuildMember(playerId: string, memberId: string): ProfileSnapshot;
  updateGuildNotice(playerId: string, notice: string): ProfileSnapshot;
  donateGuildCoins(playerId: string, amount: number): ProfileSnapshot;
  claimGuildResource(playerId: string, resourceId: string): ProfileSnapshot;
  claimAreaResource(playerId: string, areaId?: string): ProfileSnapshot;
  useGuildResource(playerId: string, resourceId: string, quantity?: number): ProfileSnapshot;
  markNoticeRead(playerId: string, noticeId: string): ProfileSnapshot;
  completeGuide(playerId: string, guideId: string): ProfileSnapshot;
  applyLanguageName(playerId: string, seed?: number): ProfileSnapshot;
  getRankSnapshot(rankId?: string, page?: number, pageSize?: number): RankSnapshot;
  getAreaSnapshot(): AreaSnapshot;
  getActivityProgress(playerId: string): ActivityProgressSnapshot;
  getCollectionBonus(playerId: string): CollectionBonusSnapshot;
  claimCollectionIncome(playerId: string): ProfileSnapshot;
  getReliefFundSnapshot(playerId: string): ReliefFundSnapshot;
  claimReliefFund(playerId: string): ProfileSnapshot;
  getExchangeRestockSnapshot(): ExchangeRestockSnapshot;
  getSimSnapshot(): SimSnapshot;
  listTransactions(limit?: number, playerId?: string): ProfileTransaction[];
  listProfiles(): PlayerProfile[];
}
