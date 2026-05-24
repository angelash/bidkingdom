export type AuctionMode = 'open' | 'sealed' | 'second_price' | 'deposit_open' | 'flash';

export type CoreAuctionMode = Extract<AuctionMode, 'open' | 'sealed'>;

export type RoundPhase =
  | 'container'
  | 'warehouse_roll'
  | 'warehouse_selected'
  | 'auctioneer_reveal'
  | 'intel'
  | 'auction'
  | 'reveal'
  | 'settlement'
  | 'ended';

export type PlayerKind = 'human' | 'bot';

export type PlayerStatus = 'connected' | 'disconnected' | 'ready' | 'playing' | 'settled';

export type Rarity = 'junk' | 'common' | 'fine' | 'rare' | 'legendary' | 'fake';

export type ClueKind = 'value' | 'risk' | 'category' | 'set' | 'opponent' | 'false';

export type SkillId =
  | 'appraise_value'
  | 'single_treasure'
  | 'read_intent'
  | 'spread_rumor'
  | 'repair_audit'
  | 'loss_insurance';

export type SkillFeedSource = 'map' | 'hero' | 'item' | 'manual' | 'auto';

export interface SkillFeedEntry {
  id: string;
  round: number;
  playerId?: string;
  source: SkillFeedSource;
  sourceName: string;
  skillName: string;
  skillCid?: number;
  effectId?: number;
  effectCategory?: number;
  effectKey?: string;
  effectName?: string;
  skillTarget?: number;
  targetCount?: number;
  text: string;
  iconKey?: string;
  visibility: 'public' | 'private';
  targetItemIds?: string[];
  hitBoxList?: BidKingBoxInfoDataSnapshot[];
  createdAt: number;
}

export interface PlayerBidRound {
  round: number;
  rank?: number;
  submitted: boolean;
  amount?: number;
  visibleAmount?: boolean;
  usedSkillName?: string;
  usedSkillIconKey?: string;
  usedSkillSource?: SkillFeedSource;
}

export type EmojiVisualClass = 'chat' | 'projectile' | 'broadcast';

export interface PublicPlayer {
  id: string;
  seat: number;
  name: string;
  kind: PlayerKind;
  roleId: string;
  heroCid?: number;
  heroSkinCid?: number;
  cash: number;
  netWorth: number;
  status: PlayerStatus;
  hasSubmittedBid: boolean;
  passed: boolean;
  bidRanks?: PlayerBidRound[];
  emote?: string;
  emoteSoundId?: number;
  emoteAnimationKey?: string;
  emoteEffectKey?: string;
  emoteEffectViewIds?: number[];
  emoteVisualClass?: EmojiVisualClass;
}

export interface RoleConfig {
  id: string;
  name: string;
  animal: string;
  archetype: string;
  skillId: SkillId;
  passive: string;
  cooldownRounds: number;
  usesPerMatch: number;
  color: string;
}

export interface ItemConfig {
  id: string;
  name: string;
  category: string;
  rarity: Rarity;
  value: number;
  displayValue: number;
  isFake: boolean;
  repairCost: number;
  setId?: string;
  iconKey: string;
  footprint: ItemFootprint;
}

export interface ItemFootprint {
  w: number;
  h: number;
}

export interface ContainerTemplate {
  id: string;
  name: string;
  source: string;
  tags: string[];
  risk: 'low' | 'medium' | 'high';
  itemPool: string[];
  itemCountRange: [number, number];
  publicEstimateBias: [number, number];
  auctionModeWeights: Record<AuctionMode, number>;
  artKey: string;
}

export interface Clue {
  id: string;
  kind: ClueKind;
  text: string;
  accuracy: number;
  targetItemId?: string;
  targetItemIds?: string[];
  valueHint?: {
    min: number;
    max: number;
  };
  riskHint?: 'fake' | 'repair' | 'safe' | 'unknown';
  source: 'public' | 'private' | 'skill' | 'rumor';
  isTruthful: boolean;
}

export interface PublicContainerInfo {
  id: string;
  templateId: string;
  name: string;
  source: string;
  tags: string[];
  risk: 'low' | 'medium' | 'high';
  estimateMin: number;
  estimateMax: number;
  artKey: string;
}

export interface RevealedItem {
  id: string;
  name: string;
  category: string;
  rarity: Rarity;
  value: number;
  displayValue: number;
  isFake: boolean;
  repairCost: number;
  setId?: string;
  iconKey: string;
  footprint: ItemFootprint;
}

export interface BidKingBoxPositionDataSnapshot {
  x: number;
  y: number;
}

export interface BidKingBoxInfoDataSnapshot {
  boxId: number;
  itemUid: number;
  itemCid: number;
  itemSlotType: number;
  itemType: number[];
  itemQuility: number;
  itemPrice: number;
  itemBoxIndex: number;
}

export interface BidKingItemDataSnapshot {
  uid: number;
  cid: number;
  count: number;
  boxPositionData: BidKingBoxPositionDataSnapshot[];
  rotate: boolean;
  canTrade: boolean;
  no: number;
  isLock: boolean;
  quality: number;
  sourceItemId?: string;
}

export interface BidKingStockBoxDataSnapshot {
  boxId: number;
  position: BidKingBoxPositionDataSnapshot;
  item: BidKingItemDataSnapshot;
}

export interface BidKingStockContainerDataSnapshot {
  stockId: number;
  stockCid: number;
  stockBoxes: BidKingStockBoxDataSnapshot[];
  cabinetLastGetRewardTime: number;
  cabinetCumulativeReward: number;
  cabinetBasicReward: number;
  cabinetReward: number;
}

export interface BidKingGameUseItemOrPriceDataSnapshot {
  round: number;
  itemCidOrPrice: number;
}

export interface BidKingUserSelectItemDataSnapshot {
  itemCid: number;
  isUsed: boolean;
  stockId?: number;
  boxId?: number;
}

export interface BidKingUserSimSelectGameItemDataSnapshot {
  itemUid: number;
  itemCid: number;
}

export interface BidKingUserSimBuffItemDataSnapshot {
  itemCid: number;
  itemCount: number;
  power: number;
  cd: number;
}

export interface BidKingShopItemDataSnapshot {
  itemUid: number;
  shopItemCid: number;
  canBuyCount: number;
  buyCount: number;
  discountRate: number;
}

export interface BidKingShopStatusDataSnapshot {
  shopCid: number;
  nextRefreshTime: number;
  shopItemList: BidKingShopItemDataSnapshot[];
}

export interface BidKingGameUserDataSnapshot {
  userUid: number;
  playerId: string;
  name: string;
  heroCid: number;
  useItemLog: BidKingGameUseItemOrPriceDataSnapshot[];
  priceLog: BidKingGameUseItemOrPriceDataSnapshot[];
  isStandDown: boolean;
  isQuit: boolean;
  headCid: number;
  heroSkinCid: number;
  simSelectItemList: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList: BidKingUserSimBuffItemDataSnapshot[];
  selectItemList: BidKingUserSelectItemDataSnapshot[];
  headBoxCid: number;
  titleCid: number;
  remark: string;
}

export interface BidKingGameSkillDataSnapshot {
  skillCid: number;
  heroCid: number;
  mapCid: number;
  itemCid: number;
  castTime: number;
  castRound: number;
  hitItemIndex: number;
  hitBoxList: BidKingBoxInfoDataSnapshot[];
  allHitItemAvgPrice: number;
  allHitBoxAvgPrice: number;
  allHitItemAvgBoxIndex: number;
  hitItemTotalPrice: number;
  uid: number;
  totalHitBoxIndex: number;
  hitItemTypeList: number[];
  hitItemQuilityList: number[];
}

export interface BidKingGameDataSnapshot {
  uid: string;
  mapId: number;
  round: number;
  stockContainer: BidKingStockContainerDataSnapshot;
  userLog: BidKingGameUserDataSnapshot[];
  heroSkillLog: BidKingGameSkillDataSnapshot[];
  mapSkillLog: BidKingGameSkillDataSnapshot[];
  itemSkillLog: BidKingGameSkillDataSnapshot[];
  nextRoundTime: number;
  selectItemCount: number;
  roundCanUseItemCount: number;
  gameCarryItemMax: number;
  gameGoldRateMax: number;
  gameType: number;
  sendAuctionUserUid: number;
  sendAuctionUserName: string;
  sendAuctionUserHead: number;
  sendAuctionHeadBox: number;
  sendAuctionUserTitle: number;
  serverTime: number;
}

export interface BidKingSimGameLogSnapshot {
  maxWinLevel: number;
  simGold: number;
  gameWinItemList: number[];
  simShopStatus?: BidKingShopStatusDataSnapshot;
  gameData?: BidKingGameDataSnapshot;
  level: number;
  simSelectItemList: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList: BidKingUserSimBuffItemDataSnapshot[];
  selectItemCount: number;
  roundCanUseItemCount: number;
  gameCarryItemMax: number;
  gameGoldRateMax: number;
}

export interface BidRecord {
  playerId: string;
  amount: number;
  createdAt: number;
  visible: boolean;
}

export interface RoundSettlement {
  roundId: string;
  isFinal?: boolean;
  winnerId?: string;
  payment: number;
  depositCost: number;
  insuranceRefund: number;
  lossRebateRefund?: number;
  trueValue: number;
  repairCost: number;
  setBonus: number;
  profit: number;
  title: string;
  participants: RoundParticipantSettlement[];
  clueReview: ClueReview[];
  bidFeedback?: RoundBidFeedback;
}

export interface RoundBidFeedback {
  round: number;
  mode: AuctionMode;
  leaderPlayerId?: string;
  secondPlayerId?: string;
  publicPrice?: number;
  secondPrice?: number;
  closeThreshold?: number;
  leaderMarginRatio?: number;
  shouldClose?: boolean;
  isTie?: boolean;
  extraRound?: boolean;
  decision?: RoundBidDecision;
  publicRanking: Array<{
    playerId: string;
    rank: number;
    amount?: number;
    visibleAmount?: boolean;
  }>;
  message: string;
}

export interface RoundBidDecision {
  round: number;
  source: 'BidMap.auction_rounds_rate';
  threshold: number;
  thresholdPercent: number;
  leaderAmount: number;
  secondAmount: number;
  marginRatio: number;
  marginPercent?: number;
  isTie: boolean;
  decision: 'close' | 'continue' | 'extra_round' | 'no_valid_bid';
  reason: string;
}

export interface WarehouseSlotView {
  slotId: string;
  itemId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visibleShape: boolean;
  visibleRarity?: Rarity;
  visibleCategory?: string;
  visibleValueRange?: {
    min: number;
    max: number;
  };
  visibleSizeCount?: number;
  markedBySkill?: boolean;
  markReason?: string;
  itemName?: string;
  iconKey?: string;
}

export interface RoundParticipantSettlement {
  playerId: string;
  payment: number;
  depositPaid: number;
  depositRefund: number;
  insuranceRefund: number;
  lossRebateRefund?: number;
  trueValue: number;
  repairCost: number;
  setBonus: number;
  profit: number;
  title: string;
}

export interface RoundHistoryEntry {
  roundId: string;
  index: number;
  containerName: string;
  auctionMode: AuctionMode;
  isFinalAuction?: boolean;
  bidFeedback?: RoundBidFeedback;
  skillFeed?: SkillFeedEntry[];
  publicClues: Clue[];
  privateCluesByPlayerId: Record<string, Clue[]>;
  bids: BidRecord[];
  winnerId?: string;
  payment: number;
  trueValue: number;
  profit: number;
  title: string;
  revealedItems: RevealedItem[];
  settlement: RoundSettlement;
  netWorthAfter: Record<string, number>;
  bidKingGameData?: BidKingGameDataSnapshot;
}

export interface NetWorthPoint {
  label: string;
  values: Record<string, number>;
}

export interface FinalPlayerSummary {
  playerId: string;
  name: string;
  rank: number;
  cash: number;
  holdingsValue: number;
  setBonus: number;
  netWorth: number;
}

export interface FinalMatchInsight {
  playerId?: string;
  playerName?: string;
  roundIndex?: number;
  title: string;
  detail: string;
  amount?: number;
}

export interface FinalPlayerAuctionStats {
  playerId: string;
  totalProfit: number;
  netProfit: number;
  successfulAuctionCount: number;
  failedAuctionCount?: number;
  highestBidAmount?: number;
  highestSingleAuctionProfit?: number;
  currentTotalAssets?: number;
  highestItemValue: number;
  highestWinningItemTotalValue: number;
  lowestWinningItemTotalValue?: number;
  completedMapIds?: number[];
  completedBidMapIds?: number[];
  successfulAuctionCountByMap?: Record<string, number>;
  lowestWinningItemTotalValueByMap?: Record<string, number>;
  lowestWinningItemTotalValueByBidMap?: Record<string, number>;
}

export interface MatchReward {
  playerId: string;
  xp: number;
  coins: number;
  rankPoints: number;
}

export interface FinalMatchSummary {
  matchId: string;
  seed: number;
  rankings: FinalPlayerSummary[];
  netWorthCurve: NetWorthPoint[];
  bestMove: FinalMatchInsight;
  biggestMistake: FinalMatchInsight;
  revealedItems: RevealedItem[];
  awardedItemsByPlayerId?: Record<string, RevealedItem[]>;
  lossRecoveryByPlayerId?: Record<string, number>;
  auctionStats?: FinalPlayerAuctionStats[];
  bidKingReplay?: BidKingGameDataSnapshot[];
  rewards: MatchReward[];
  eventCount: number;
  transactionCount: number;
}

export interface ClueReview {
  clueId: string;
  text: string;
  result: string;
  verdict: 'hit' | 'partial' | 'miss' | 'rumor';
}

export interface PublicRoundState {
  id: string;
  index: number;
  phase: RoundPhase;
  auctionMode: AuctionMode;
  isFinalAuction?: boolean;
  container: PublicContainerInfo;
  openingCandidates?: PublicContainerInfo[];
  auctioneerClue?: Clue;
  auctioneerChoices?: Clue[];
  publicClues: Clue[];
  warehouseSlots?: WarehouseSlotView[];
  bids: BidRecord[];
  currentBid: number;
  currentLeaderId?: string;
  bidFeedback?: RoundBidFeedback;
  skillFeed?: SkillFeedEntry[];
  revealedItems: RevealedItem[];
  settlement?: RoundSettlement;
  phaseEndsAt: number;
  minimumBid?: number;
}

export interface PrivatePlayerState {
  playerId: string;
  privateClues: Clue[];
  skillCooldown: number;
  skillUsesRemaining: number;
  skillUsedThisRound: boolean;
  insuranceActive: boolean;
  battleItemUseLimitThisRound?: number;
  battleItemUsesThisRound?: number;
  battleItemUsesRemainingThisRound?: number;
  battleItemCooldowns?: Record<string, number>;
  simGold?: number;
  gameWinItemList?: number[];
  simShopStatus?: BidKingShopStatusDataSnapshot;
  simGameLog?: BidKingSimGameLogSnapshot;
  simSelectItemList?: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList?: BidKingUserSimBuffItemDataSnapshot[];
}

export interface PublicMatchState {
  id: string;
  status: 'lobby' | 'playing' | 'ended';
  seed: number;
  roundIndex: number;
  totalRounds: number;
  players: PublicPlayer[];
  currentRound?: PublicRoundState;
  roundHistory: RoundHistoryEntry[];
  finalSummary?: FinalMatchSummary;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerSnapshot {
  public: PublicMatchState;
  private?: PrivatePlayerState;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  players: PublicPlayer[];
  hostId: string;
  botCount: number;
  maxPlayers: number;
  totalRounds: number;
  initialCash: number;
  coreAuctionMode: CoreAuctionMode;
  selectedBidMapId?: number;
  status: 'lobby' | 'playing' | 'ended';
}

export interface AdminMatchPlayer {
  id: string;
  seat: number;
  name: string;
  kind: PlayerKind;
  roleId: string;
  cash: number;
  netWorth: number;
}

export interface AdminMatchListItem {
  matchId: string;
  roomId: string;
  roomCode: string;
  status: PublicMatchState['status'];
  roundIndex: number;
  totalRounds: number;
  players: AdminMatchPlayer[];
  winnerId?: string;
  winnerName?: string;
  winnerNetWorth?: number;
  eventCount: number;
  transactionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminRoundReplay {
  roundId: string;
  index: number;
  label: string;
  containerName?: string;
  auctionMode?: AuctionMode;
  publicClues: Clue[];
  privateCluesByPlayerId: Record<string, Clue[]>;
  bids: BidRecord[];
  skillFeed?: SkillFeedEntry[];
  winnerId?: string;
  payment?: number;
  trueValue?: number;
  profit?: number;
  title?: string;
  revealedItems: RevealedItem[];
  settlement?: RoundSettlement;
  bidKingGameData?: BidKingGameDataSnapshot;
  events: MatchEventLog[];
  transactions: TransactionLog[];
}

export interface AdminMatchDetail {
  summary: AdminMatchListItem;
  publicState: PublicMatchState;
  rounds: AdminRoundReplay[];
  events: MatchEventLog[];
  transactions: TransactionLog[];
}

export type AdminEquivalentStatus =
  | 'Verified'
  | 'Equivalent'
  | 'Visual Substitute'
  | 'Service Simulated'
  | 'Manual Review Required';

export interface AdminConfigParityRow {
  table: string;
  expectedRows: number;
  actualRows: number;
  owner: string;
  runtimeStatus: 'Mapped' | 'Skeleton' | 'Behavior' | 'Verified' | 'Equivalent';
  equivalentStatus: AdminEquivalentStatus;
  status: 'ok' | 'mismatch';
}

export interface AdminConfigParitySnapshot {
  generatedAt: number;
  tableCount: number;
  totalRows: number;
  failures: string[];
  rows: AdminConfigParityRow[];
  status: 'ok' | 'failed';
}

export interface AdminReviewMatrixSummary {
  classMatrix: {
    source: string;
    scriptsClassFiles: number;
    mappedClasses: number;
    unknownClasses: number;
    status: 'Mapped';
    evidence: string;
  };
  tableMatrix: {
    source: string;
    tableCount: number;
    configRowCount: number;
    verifiedTables: number;
    manualReviewTables: number;
    closureStatus: 'closed' | 'needs_review';
    evidence: string;
  };
  uiWndMatrix: {
    source: string;
    registrySource: string;
    uiWndCount: number;
    mappedWindows: number;
    unknownWindows: number;
    status: 'Mapped';
    evidence: string;
  };
  acceptance: {
    source: string;
    totalMilestones: number;
    verifiedMilestones: number;
    equivalentClosedMilestones: number;
    finalStage: 'E12';
    closureStatus: 'Equivalent Closed' | 'Needs Review';
    evidence: string;
  };
}

export interface AdminReviewChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'attention' | 'blocked';
  summary: string;
  evidence: string[];
}

export interface RoomAck {
  room: RoomSnapshot;
  selfPlayerId: string;
}

export interface TransactionLog {
  id: string;
  matchId: string;
  roundId?: string;
  playerId: string;
  reason: string;
  amountBefore: number;
  amountChange: number;
  amountAfter: number;
  createdAt: number;
}

export interface MatchEventLog {
  id: string;
  matchId: string;
  roundId?: string;
  type: string;
  actorId?: string;
  payload: unknown;
  sourceProtocols?: BidKingProtocolMessageRef[];
  createdAt: number;
}

export interface BidKingProtocolMessageRef {
  id: number;
  name: string;
  direction: 'C2S' | 'S2C';
  fields: string[];
}

export interface PlayerProfileLastRewards {
  matchId: string;
  xp: number;
  coins: number;
  rankPoints: number;
  newCodex: string[];
  lossRecovery?: number;
  collectionExpBefore?: number;
  collectionExpAfter?: number;
  collectionLevelBefore?: number;
  collectionLevelAfter?: number;
}

export interface TicketState {
  id: number;
  name: string;
  current: number;
  max: number;
  recoverTimeSeconds: number;
  nextRecoverAt?: number;
  updatedAt: number;
}

export interface PlayerInventoryEntry {
  key: string;
  type: string;
  refId: string;
  quantity: number;
  updatedAt: number;
}

export type ProfileStockContainerKind = 'cabinet' | 'market' | 'match' | 'sendAuction' | 'warehouse';

export interface ProfileStockItemState {
  uid: string;
  sourceUid: number;
  cid: number;
  count: number;
  boxPositionData: BidKingBoxPositionDataSnapshot[];
  rotate: boolean;
  canTrade: boolean;
  no: number;
  isLock: boolean;
  quality: number;
  sourceId?: string;
  createdAt: number;
}

export interface ProfileStockBoxState {
  boxId: number;
  position: number;
  item: ProfileStockItemState;
}

export interface ProfileCabinetStockState {
  cabinetId: number;
  lastRewardAt: number;
  cumulativeReward: number;
  basicRewardPerHour: number;
  pendingReward: number;
}

export interface ProfileStockContainerState {
  stockId: number;
  cid: number;
  kind: ProfileStockContainerKind;
  name?: string;
  width: number;
  height: number;
  boxes: ProfileStockBoxState[];
  cabinet?: ProfileCabinetStockState;
  updatedAt: number;
}

export interface ProfileStockRuntimeState {
  nextBoxId: number;
  nextItemNo: number;
  migratedInventoryAt?: number;
}

export interface MailInboxItem {
  id: string;
  templateId: string;
  title: string;
  body: string;
  read: boolean;
  claimed: boolean;
  attachmentSummary: string;
  attachmentRewards?: number[][];
  createdAt: number;
  expiresAt?: number;
}

export interface ShopPurchaseState {
  shopItemId: number;
  bought: number;
  limit: number;
  updatedAt: number;
}

export interface ShopRestockState {
  shopId: number;
  shopItemIds: number[];
  restockItemIds: number[];
  refreshedAt: number;
  nextRefreshAt?: number;
}

export interface EquippedBattleItem {
  itemId: number;
  quantity: number;
  stockId?: number;
  boxId?: number;
  updatedAt: number;
}

export interface MarketOrderState {
  id: string;
  orderType: 'trade' | 'auction';
  refId: string;
  quantity: number;
  price: number;
  totalPrice?: number;
  listingFee?: number;
  tax?: number;
  listingCost?: number;
  fee?: number;
  netPrice?: number;
  itemCid?: number;
  numberCid?: number;
  itemNo?: number;
  lockedStockBoxes?: ProfileStockBoxState[];
  sourceAuctionHouseLaunches?: MarketOrderSourceAuctionHouseLaunch[];
  sourceAuctionHouseLanchItemUid?: number;
  sourceAuctionHouseMaxPrice?: number;
  sourceAuctionHouseMaxBidderId?: string;
  sourceAuctionHouseMaxBidderName?: string;
  sourceAuctionHouseMaxBidAt?: number;
  sourceAuctionHouseBidLogs?: MarketOrderAuctionHouseBidState[];
  sourceAuctionHouseTradeTime?: number;
  sourceAuctionHouseTradePrice?: number;
  note?: string;
  status: 'listed' | 'locked' | 'sold' | 'cancelled' | 'expired' | 'failed';
  buyerId?: string;
  buyerName?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt?: number;
  expiresAt?: number;
  publicAt?: number;
  bidWindowMs?: number;
  priceStep?: number;
  priceNoticeLimit?: number;
  lockedAt?: number;
  soldAt?: number;
  cancelledAt?: number;
  expiredAt?: number;
  failedAt?: number;
}

export interface MarketOrderSourceAuctionHouseLaunch {
  stockId: number;
  boxId: number;
  price: number;
  lanchTime: number;
  startPrice: number;
  itemCount: number;
  bagItemCid: number;
}

export type AuctionHouseItemSortModel = 'LanchTime' | 'Price' | 'MaxPrice' | 'StartPrice';

export interface AuctionHouseLanchItemSnapshot {
  lanchItemUid: number;
  itemCid: number;
  numberCid: number;
  no: number;
  startLanchTime: number;
  endLanchTime: number;
  displayPeriodEndTime: number;
  price: number;
  maxPrice: number;
  startPrice: number;
  count: number;
}

export interface AuctionHouseLanchItemListSnapshot {
  generatedAt: number;
  errorCode: number;
  lanchItemList: AuctionHouseLanchItemSnapshot[];
  lanchMax: number;
}

export interface AuctionHouseItemInfoSnapshot {
  generatedAt: number;
  errorCode: number;
  itemInfoList: AuctionHouseLanchItemSnapshot[];
  currentPage: number;
  totalPage: number;
}

export interface AuctionHouseItemPriceInfoSnapshot {
  itemCid: number;
  avgPrice: number;
  count: number;
}

export interface AuctionHouseItemPriceInfoListSnapshot {
  generatedAt: number;
  errorCode: number;
  allAuctionHouseItemPriceInfo: AuctionHouseItemPriceInfoSnapshot[];
}

export interface MarketOrderAuctionHouseBidState {
  playerId: string;
  playerName: string;
  bidTime: number;
  bidPrice: number;
}

export interface AuctionHouseBidLogSnapshot {
  bidTime: number;
  bidPrice: number;
  lanchItem: AuctionHouseLanchItemSnapshot;
}

export interface AuctionHouseBidLogListSnapshot {
  generatedAt: number;
  errorCode: number;
  bidLogList: AuctionHouseBidLogSnapshot[];
}

export interface AuctionHouseBidPriceResponse {
  errorCode: number;
  itemUid: number;
  price: number;
  bidLog: AuctionHouseBidLogSnapshot;
}

export interface AuctionHouseUnlanchItemResponse {
  errorCode: number;
  itemUid: number;
  orderId: string;
}

export interface AuctionHouseUnlockLanchSlotResponse {
  errorCode: number;
  unlockCount: number;
  cost: number;
  lanchMax: number;
}

export interface AuctionHouseTradeInfoSnapshot {
  tradeTime: number;
  itemCid: number;
  numberCid: number;
  no: number;
  price: number;
}

export interface AuctionHouseTradeInfoListSnapshot {
  generatedAt: number;
  errorCode: number;
  tradeInfoInList: AuctionHouseTradeInfoSnapshot[];
  tradeInfoOutList: AuctionHouseTradeInfoSnapshot[];
}

export interface MarketOrderView extends MarketOrderState {
  playerId: string;
  playerName: string;
  sourceAuctionHouseLanchItem?: AuctionHouseLanchItemSnapshot;
}

export interface MarketOrdersSnapshot {
  generatedAt: number;
  orders: MarketOrderView[];
  sourceAuctionHouseItemInfo?: AuctionHouseItemInfoSnapshot;
}

export type SendAuctionStatus = 'listed' | 'settled' | 'recycled' | 'failed';

export interface SendAuctionItemState {
  stockId: number;
  boxId: number;
  itemCid: number;
  itemUid: string;
  itemNo: number;
  position: number;
  value: number;
  refId: string;
}

export interface SendAuctionState {
  id: string;
  playerId: string;
  playerName: string;
  mapCid: number;
  mapName?: string;
  bidMapId: number;
  slotId: number;
  status: SendAuctionStatus;
  items: SendAuctionItemState[];
  stockContainer: ProfileStockContainerState;
  totalValue: number;
  targetValue: number;
  fee: number;
  entrustProbability?: number;
  itemCountRange: [number, number];
  finalPrice?: number;
  profit?: number;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  settledAt?: number;
  recycledAt?: number;
  failedAt?: number;
}

export interface SendAuctionGameState {
  id: string;
  sendAuctionId: string;
  uid: number;
  playerId: string;
  playerName: string;
  mapCid: number;
  mapName?: string;
  bidMapId: number;
  gameData: BidKingGameDataSnapshot;
  gameOverTime: number;
  userSkillList: BidKingGameSkillDataSnapshot[];
  finalPrice: number;
  totalValue: number;
  profit: number;
  createdAt: number;
}

export interface FriendState {
  id: string;
  name: string;
  headId: string;
  areaId: string;
  remark?: string;
  createdAt: number;
}

export interface GuildMemberState {
  playerId: string;
  name: string;
  roleId: string;
  areaId: string;
  points: number;
  status: 'member' | 'pending';
  joinedAt?: number;
  requestedAt?: number;
}

export interface GuildMembershipState {
  guildId: string;
  name: string;
  areaId: string;
  roleId: string;
  notice?: string;
  points: number;
  permissions?: Record<string, boolean>;
  resources?: Record<string, number>;
  members?: GuildMemberState[];
  pendingApplications?: GuildMemberState[];
  joinedAt: number;
}

export interface PurchaseOrderState {
  id: string;
  source: 'pay' | 'purchaseList' | 'dlc';
  refId: string;
  status: 'created' | 'completed' | 'cancelled';
  coins: number;
  price: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  cancelledAt?: number;
}

export interface AuctionStatsState {
  totalProfit: number;
  dailyProfit: Record<string, number>;
  successfulAuctionCount: number;
  failedAuctionCount: number;
  highestBidAmount: number;
  highestSingleAuctionProfit: number;
  currentTotalAssets: number;
  highestItemValue: number;
  highestWinningItemTotalValue: number;
  lowestWinningItemTotalValue?: number;
  completedMapIds?: number[];
  completedBidMapIds?: number[];
  successfulAuctionCountByMap?: Record<string, number>;
  lowestWinningItemTotalValueByMap?: Record<string, number>;
  lowestWinningItemTotalValueByBidMap?: Record<string, number>;
  updatedAt: number;
}

export interface ProfileConditionStatsState {
  usedItemCount: number;
  dailyUsedItemCount: Record<string, number>;
  usedItemCountsById: Record<string, number>;
  tradeBoughtCount?: number;
  tradeSoldCount?: number;
  auctionAcquiredItemIds?: number[];
  shopAcquiredItemIds?: number[];
  missionEventCounts?: Record<string, number>;
  missionEventDomainCounts?: Record<string, number>;
  updatedAt: number;
}

export interface MissionProgressState {
  taskId: string;
  missionId: number;
  refreshType?: number;
  periodKey?: string;
  resetAt?: number;
  current: number;
  required: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
  redPoint: boolean;
  reason?: string;
}

export interface MissionRewardClaimState {
  taskId: string;
  missionId: number;
  periodKey: string;
  claimedAt: number;
}

export interface AchievementProgressState {
  achievementId: string;
  total: number;
  completed: number;
  claimed: number;
  claimable: boolean;
  redPoint: boolean;
  nextMissionId?: number;
  reason?: string;
}

export type ProfileHeroOwnershipState = 'locked' | 'trial' | 'free' | 'owned';

export type ProfileHeroAccessResource = 'coins' | 'goldCoins' | 'boundGoldCoins' | 'item' | 'external';

export interface ProfileHeroAccessCost {
  accessType: number;
  resource: ProfileHeroAccessResource;
  quantity: number;
  refId?: number;
  label: string;
}

export interface ProfileHeroState {
  heroId: number;
  state: ProfileHeroOwnershipState;
  skinId?: number;
  heroItemId?: number;
  trialItemId?: number;
  quantity?: number;
  expiresAt?: number;
  accessCost?: ProfileHeroAccessCost;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  createdAt: number;
  level: number;
  xp: number;
  coins: number;
  goldCoins?: number;
  boundGoldCoins?: number;
  rankPoints: number;
  headId?: string;
  selectedHeroId?: number;
  ownedHeroIds?: number[];
  freeHeroIds?: number[];
  heroStates?: ProfileHeroState[];
  codex: string[];
  cabinetItemIds?: string[];
  lastCollectionIncomeAt?: number;
  selectedHeroSkins?: Record<string, number>;
  dailyMapEntries?: Record<string, number>;
  completedMatches: string[];
  completedTasks: string[];
  claimedMissionRewards: string[];
  claimedAchievements?: string[];
  missionRewardClaims?: Record<string, MissionRewardClaimState>;
  missionProgress?: Record<string, MissionProgressState>;
  achievementProgress?: Record<string, AchievementProgressState>;
  auctionStats?: AuctionStatsState;
  conditionStats?: ProfileConditionStatsState;
  claimedLevelRewards?: number[];
  tickets: TicketState;
  inventory: PlayerInventoryEntry[];
  stockContainers?: ProfileStockContainerState[];
  stockState?: ProfileStockRuntimeState;
  mail: MailInboxItem[];
  deletedMailTemplateIds?: string[];
  shopPurchases: ShopPurchaseState[];
  shopRestocks?: ShopRestockState[];
  shopCollections?: number[];
  equippedBattleItems: EquippedBattleItem[];
  claimedRankRewards: string[];
  claimedActivityRewards: string[];
  claimedGiftPackages?: string[];
  marketOrders: MarketOrderState[];
  sendAuctions?: SendAuctionState[];
  sendAuctionGames?: SendAuctionGameState[];
  purchaseOrders?: PurchaseOrderState[];
  dlcUnlocks?: string[];
  friends: FriendState[];
  guildMembership?: GuildMembershipState;
  readNotices?: string[];
  completedGuides?: string[];
  settings: Record<string, string | number | boolean>;
  lastRewards?: PlayerProfileLastRewards;
  updatedAt: number;
}

export interface ProfileTransaction {
  id: string;
  playerId: string;
  sourceId: string;
  reason: string;
  resource: 'coins' | 'goldCoins' | 'boundGoldCoins' | 'rankPoints' | 'xp' | 'ticket' | 'item' | 'mail' | 'task';
  amountBefore: number;
  amountChange: number;
  amountAfter: number;
  createdAt: number;
}

export interface ProfileSnapshot {
  profile: PlayerProfile;
  transactions: ProfileTransaction[];
}

export type PlayerAccountKind = 'guest' | 'password';

export interface PublicPlayerAccount {
  accountId: string;
  accountName: string;
  displayName: string;
  kind: PlayerAccountKind;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface AccountSessionSnapshot {
  account: PublicPlayerAccount;
  sessionToken: string;
  expiresAt: number;
  profile: ProfileSnapshot;
}

export interface AdminProfileAuditItem {
  playerId: string;
  name: string;
  level: number;
  coins: number;
  rankPoints: number;
  inventoryEntries: number;
  codexCount: number;
  mailCount: number;
  marketOrderCount: number;
  guildRoleId?: string;
  completedMatches: number;
  completedTasks: number;
  updatedAt: number;
}

export interface AdminActivityAuditTarget {
  target: string;
  count: number;
}

export interface AdminActivityAuditRow {
  activityId: string;
  name: string;
  type: number;
  panelName: string;
  activeProfiles: number;
  expiredProfiles: number;
  claimedProfiles: number;
  claimableProfiles: number;
  redPointProfiles: number;
  averageProgressPercent: number;
  actionTargets: AdminActivityAuditTarget[];
}

export interface AdminAuditSnapshot {
  generatedAt: number;
  profileCount: number;
  transactionCount: number;
  transactionSourceCount: number;
  inventoryEntryCount: number;
  codexEntryCount: number;
  mailCount: number;
  marketOrderCount: number;
  activeMarketOrderCount: number;
  guildMemberCount: number;
  completedMatchCount: number;
  completedTaskCount: number;
  claimedActivityRewardCount: number;
  activityClaimableCount: number;
  activityRedPointCount: number;
  configTableCount: number;
  configRowCount: number;
  parityFailureCount: number;
  activityAuditRows: AdminActivityAuditRow[];
  latestTransactions: ProfileTransaction[];
  profiles: AdminProfileAuditItem[];
}

export interface AdminReviewSnapshot {
  generatedAt: number;
  audit: AdminAuditSnapshot;
  configParity: AdminConfigParitySnapshot;
  restoreMatrixSummary: AdminReviewMatrixSummary;
  finalReviewChecklist: AdminReviewChecklistItem[];
  equivalentSummary: {
    verifiedTables: number;
    equivalentTables: number;
    visualSubstituteTables: number;
    serviceSimulatedTables: number;
    manualReviewTables: number;
    closureStatus: 'closed' | 'needs_review';
    equivalentTableNames: string[];
    visualSubstituteTableNames: string[];
    serviceSimulatedTableNames: string[];
    manualReviewTableNames: string[];
  };
  equivalentBoundaries: Array<{
    table: string;
    status: Extract<AdminEquivalentStatus, 'Visual Substitute' | 'Service Simulated'>;
    reason: string;
    cleanRoomBoundary: string;
    evidence: string;
  }>;
  tableMatrix: Array<{
    table: string;
    expectedRows: number;
    actualRows: number;
    owner: string;
    runtimeStatus: AdminConfigParityRow['runtimeStatus'];
    equivalentStatus: AdminEquivalentStatus;
  }>;
  validationCommands: string[];
}

export interface RankSnapshotEntry {
  rank: number;
  playerId: string;
  name: string;
  rankPoints: number;
  level: number;
  completedMatches: number;
  coins: number;
  updatedAt: number;
}

export interface RankSnapshot {
  rankId: string;
  title: string;
  description: string;
  isRegional: boolean;
  isDated: boolean;
  isRoleBased: boolean;
  sortDirection: 'asc' | 'desc';
  rankType: number;
  generatedAt: number;
  page: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
  entries: RankSnapshotEntry[];
}

export interface ClientToServerEvents {
  createRoom: (
    payload: { playerName: string; profileId?: string; roleId?: string; botCount?: number; coreAuctionMode?: CoreAuctionMode; selectedBidMapId?: number; initialCash?: number },
    ack: (snapshot: RoomAck) => void
  ) => void;
  joinRoom: (
    payload: { roomCode: string; playerName: string; profileId?: string; roleId?: string },
    ack: (result: { ok: true; room: RoomSnapshot; selfPlayerId: string } | { ok: false; error: string }) => void
  ) => void;
  rejoinRoom: (
    payload: { roomCode: string; playerId: string },
    ack: (result: { ok: true; room: RoomSnapshot; selfPlayerId: string } | { ok: false; error: string }) => void
  ) => void;
  setReady: (payload: { ready: boolean }) => void;
  selectRole: (payload: { roleId: string }) => void;
  setCoreAuctionMode: (payload: { mode: CoreAuctionMode }) => void;
  setSelectedBidMap: (payload: { bidMapId: number }) => void;
  startMatch: () => void;
  leaveRoom: () => void;
  submitBid: (payload: { amount: number }) => void;
  passAuction: () => void;
  useSkill: (payload: { targetPlayerId?: string }) => void;
  useBattleItem: (payload: { itemId: number; targetPlayerId?: string }) => void;
  sendEmote: (payload: { emote: string }) => void;
  requestSnapshot: () => void;
}

export interface ServerToClientEvents {
  roomUpdated: (snapshot: RoomSnapshot) => void;
  matchSnapshot: (snapshot: PlayerSnapshot) => void;
  profileUpdated: (snapshot: ProfileSnapshot) => void;
  toast: (payload: { tone: 'info' | 'success' | 'warning' | 'danger'; message: string }) => void;
  eventLog: (event: MatchEventLog) => void;
}
