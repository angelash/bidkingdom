import type {
  AuctionMode,
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
  insuranceActive: boolean;
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
  depositValue?: number;
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
  openingCandidates?: PublicRoundState['openingCandidates'];
  auctioneerClue?: Clue;
  auctioneerChoices?: Clue[];
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
  depositPaidByPlayerId: Record<string, boolean>;
  historyRecorded?: boolean;
}

export interface MatchRuntimeState {
  id: string;
  status: PublicMatchState['status'];
  seed: number;
  coreMode: boolean;
  coreAuctionMode?: CoreAuctionMode;
  coreBidMapId?: number;
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
  coreAuctioneerClue?: Clue;
  coreAuctioneerChoices?: Clue[];
  createdAt: number;
  updatedAt: number;
}
