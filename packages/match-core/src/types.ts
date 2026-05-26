import type {
  AuctionMode,
  BidKingShopStatusDataSnapshot,
  BidKingUserSimBuffItemDataSnapshot,
  BidKingUserSimSelectGameItemDataSnapshot,
  BidKingUserSelectItemDataSnapshot,
  Clue,
  CoreAuctionMode,
  FinalMatchSummary,
  MatchEventLog,
  PublicContainerInfo,
  PublicMatchState,
  PublicPlayer,
  PublicRoundState,
  RevealedItem,
  RoundBidFeedback,
  RoundHistoryEntry,
  RoundSettlement,
  BidKingSimGameLogSnapshot,
  SkillFeedEntry,
  TransactionLog,
  WarehouseSlotView
} from '@bitkingdom/shared';
import type { GameConfig } from '@bitkingdom/config';
import type { RandomSource } from './random';

export interface CreateMatchPlayer {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  roleId: string;
  heroCid?: number;
  heroSkinCid?: number;
  selectedItemList?: BidKingUserSelectItemDataSnapshot[];
  simGold?: number;
  gameWinItemList?: number[];
  simShopStatus?: BidKingShopStatusDataSnapshot;
  simGameLog?: BidKingSimGameLogSnapshot;
  simSelectItemList?: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList?: BidKingUserSimBuffItemDataSnapshot[];
}

export interface RuntimePlayer {
  id: string;
  seat: number;
  name: string;
  kind: 'human' | 'bot';
  roleId: string;
  heroCid?: number;
  heroSkinCid?: number;
  selectedItemList?: BidKingUserSelectItemDataSnapshot[];
  simGold?: number;
  gameWinItemList?: number[];
  simShopStatus?: BidKingShopStatusDataSnapshot;
  simGameLog?: BidKingSimGameLogSnapshot;
  simSelectItemList?: BidKingUserSimSelectGameItemDataSnapshot[];
  simBuffItemList?: BidKingUserSimBuffItemDataSnapshot[];
  cash: number;
  status: PublicPlayer['status'];
  passed: boolean;
  hasSubmittedBid: boolean;
  emote?: string;
  emoteSoundId?: number;
  emoteAnimationKey?: string;
  emoteEffectKey?: string;
  emoteEffectViewIds?: number[];
  emoteVisualClass?: PublicPlayer['emoteVisualClass'];
  holdings: RevealedItem[];
  skillCooldown: number;
  skillUsesRemaining: number;
  skillUsedThisRound: boolean;
  battleItemCooldowns: Record<string, number>;
  privateClues: Clue[];
}

export interface ContainerInstance {
  id: string;
  templateId: string;
  publicInfo: PublicContainerInfo;
  hiddenItems: RevealedItem[];
  warehouseSlots: WarehouseSlot[];
  publicClues: Clue[];
  privateCluesByPlayerId: Record<string, Clue[]>;
  auctionModeOverride?: AuctionMode;
  auctionDurationMs?: number;
  minimumBid?: number;
}

export interface WarehouseSlot {
  slotId: string;
  item: RevealedItem;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: boolean;
}

export interface RuntimeRound {
  id: string;
  index: number;
  phase: PublicRoundState['phase'];
  auctionMode: AuctionMode;
  container: ContainerInstance;
  openingCandidates?: PublicContainerInfo[];
  intelligenceClue?: Clue;
  intelligenceChoices?: Clue[];
  bids: PublicRoundState['bids'];
  currentBid: number;
  currentLeaderId?: string;
  isFinalAuction?: boolean;
  warehouseSlots: WarehouseSlotView[];
  bidFeedback?: RoundBidFeedback;
  skillFeed: SkillFeedEntry[];
  revealedItems: RevealedItem[];
  settlement?: RoundSettlement;
  phaseEndsAt: number;
  auctionEndsAt?: number;
  historyRecorded?: boolean;
}

export interface MatchRuntimeState {
  id: string;
  status: PublicMatchState['status'];
  seed: number;
  coreMode: boolean;
  coreAuctionMode: CoreAuctionMode;
  coreBidMapId: number;
  coreSourceBidMapId?: number;
  coreResolvedBidMapId?: number;
  bidKingActiveSystemSkillIds?: number[];
  roundIndex: number;
  totalRounds: number;
  players: RuntimePlayer[];
  currentRound?: RuntimeRound;
  rng: RandomSource;
  config: GameConfig;
  transactions: TransactionLog[];
  events: MatchEventLog[];
  roundHistory: RoundHistoryEntry[];
  finalSummary?: FinalMatchSummary;
  coreWarehouse?: ContainerInstance;
  createdAt: number;
  updatedAt: number;
}
