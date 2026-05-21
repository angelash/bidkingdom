import type {
  FinalMatchSummary,
  MarketOrdersSnapshot,
  PlayerProfile,
  ProfileSnapshot,
  ProfileTransaction,
  RankSnapshot
} from '@bitkingdom/shared';
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
  setCabinetItem(playerId: string, itemId: string): ProfileSnapshot;
  clearCabinetItem(playerId: string, itemId: string): ProfileSnapshot;
  selectHeroSkin(playerId: string, skinId: number): ProfileSnapshot;
  refreshTickets(playerId: string): ProfileSnapshot;
  consumeTicketForMatch(playerId: string, sourceId: string): ProfileSnapshot;
  completeTask(playerId: string, taskId: string): ProfileSnapshot;
  claimMissionReward(playerId: string, taskId: string): ProfileSnapshot;
  claimAchievementReward(playerId: string, achievementId: string): ProfileSnapshot;
  claimLevelReward(playerId: string, level: number): ProfileSnapshot;
  applyMatchSummary(playerId: string, summary: FinalMatchSummary): ProfileSnapshot;
  sellInventoryItem(playerId: string, refId: string, quantity: number): ProfileSnapshot;
  buyShopItem(playerId: string, shopItemId: number): ProfileSnapshot;
  refreshShop(playerId: string, shopId?: number): ProfileSnapshot;
  setShopItemCollection(playerId: string, itemId: number, collected: boolean): ProfileSnapshot;
  claimMail(playerId: string, mailId: string): ProfileSnapshot;
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
  settleMarketOrder(playerId: string, orderId: string): ProfileSnapshot;
  cancelMarketOrder(playerId: string, orderId: string): ProfileSnapshot;
  listMarketOrders(orderType?: 'trade' | 'auction'): MarketOrdersSnapshot;
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
