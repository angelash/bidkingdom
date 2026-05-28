import { useMemo } from 'react';
import { BattleItem as bidKingBattleItems } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, PlayerSnapshot, PublicPlayer, RoomSnapshot } from '@bitkingdom/shared';
import { inventoryQuantity } from '../profile/profileInventory';
import { lastSubmittedBidAmount } from './BattlePanels';
import type { EquippedBattleItemView } from './MatchShell';
import { buildBattleItemActionState } from './battleItemUi';

const MAP_INTRO_PRESENTATION_MS = 1600;
const INTELLIGENCE_PANEL_REVEAL_MS = 1600;
const INTELLIGENCE_PANEL_HOLD_MS = 3000;
const INTELLIGENCE_PANEL_PRESENTATION_MS = INTELLIGENCE_PANEL_REVEAL_MS + INTELLIGENCE_PANEL_HOLD_MS;
const INTEL_PRESENTATION_MS = MAP_INTRO_PRESENTATION_MS + INTELLIGENCE_PANEL_PRESENTATION_MS;

interface UseMatchDerivedStateArgs {
  now: number;
  profile: PlayerProfile;
  room?: RoomSnapshot;
  selfPlayerId?: string;
  skillTargetId?: string;
  snapshot?: PlayerSnapshot;
}

export interface MatchDerivedState {
  canBid: boolean;
  canUseBattleItem: boolean;
  currentRound?: NonNullable<PlayerSnapshot['public']['currentRound']>;
  equippedBattleItems: EquippedBattleItemView[];
  isHost: boolean;
  phaseRemaining: number;
  previousSelfBid?: number;
  selectedSkillTargetId?: string;
  selfPlayer?: PublicPlayer;
  showBattleRandom: boolean;
  showIntelligencePanel: boolean;
  skillTargets: PublicPlayer[];
}

export type RoundPresentationOverlay = 'battle_random' | 'intelligence_panel';

export function roundPresentationOverlay(
  currentRound: NonNullable<PlayerSnapshot['public']['currentRound']> | undefined,
  now: number
): RoundPresentationOverlay | undefined {
  if (!currentRound) {
    return undefined;
  }
  if (currentRound.phase !== 'intel') {
    return undefined;
  }
  if (currentRound.index !== 0) {
    return undefined;
  }

  const currentRoundFeed = (currentRound.skillFeed ?? []).filter((entry) => entry.round === currentRound.index + 1);
  const presentationStartedAt = currentRoundFeed.length > 0
    ? Math.min(...currentRoundFeed.map((entry) => entry.createdAt))
    : currentRound.phaseEndsAt - INTEL_PRESENTATION_MS;
  const elapsedMs = Math.max(0, now - presentationStartedAt);
  const hasMapIntro = currentRound.index === 0 && (currentRound.openingCandidates?.length ?? 0) > 1;
  const intelligenceStartMs = hasMapIntro ? MAP_INTRO_PRESENTATION_MS : 0;
  const hasIntelligencePanel = Boolean(currentRound.intelligenceClue ?? currentRound.publicClues.at(-1));
  if (hasMapIntro && elapsedMs < MAP_INTRO_PRESENTATION_MS) {
    return 'battle_random';
  }
  if (
    hasIntelligencePanel &&
    elapsedMs >= intelligenceStartMs &&
    elapsedMs < intelligenceStartMs + INTELLIGENCE_PANEL_PRESENTATION_MS
  ) {
    return 'intelligence_panel';
  }
  return undefined;
}

export function useMatchDerivedState({
  now,
  profile,
  room,
  selfPlayerId,
  skillTargetId,
  snapshot
}: UseMatchDerivedStateArgs): MatchDerivedState {
  const selfPlayer = useMemo(() => {
    const id = snapshot?.private?.playerId ?? selfPlayerId;
    return snapshot?.public.players.find((player) => player.id === id) ?? room?.players.find((player) => player.id === id);
  }, [room?.players, selfPlayerId, snapshot?.private?.playerId, snapshot?.public.players]);

  const currentRound = snapshot?.public.currentRound;
  const phaseRemaining = Math.max(0, Math.ceil(((currentRound?.phaseEndsAt ?? now) - now) / 1000));
  const isHost = room?.hostId === selfPlayerId;
  const selfCurrentBidRound = currentRound && selfPlayer
    ? selfPlayer.bidRanks?.find((entry) => entry.round === currentRound.index + 1)
    : undefined;
  const selfAlreadyActed = Boolean(selfPlayer?.passed || selfPlayer?.hasSubmittedBid || selfCurrentBidRound?.submitted);
  const canBid = Boolean(currentRound?.phase === 'auction' && !selfAlreadyActed);
  const presentationOverlay = roundPresentationOverlay(currentRound, now);
  const showBattleRandom = presentationOverlay === 'battle_random';
  const showIntelligencePanel = presentationOverlay === 'intelligence_panel';
  const canUseBattleItem = Boolean(
    currentRound &&
    ['intel', 'auction'].includes(currentRound.phase) &&
    !(currentRound.phase === 'auction' && selfAlreadyActed) &&
    (snapshot?.private?.battleItemUsesRemainingThisRound ?? 1) > 0
  );
  const skillTargets = snapshot?.public.players.filter((player) => player.id !== selfPlayer?.id) ?? [];
  const selectedSkillTargetId = skillTargets.some((player) => player.id === skillTargetId) ? skillTargetId : skillTargets[0]?.id;
  const equippedBattleItems = profile.equippedBattleItems
    .map((entry) => {
      const row = bidKingBattleItems.find((item) => item.id === entry.itemId);
      const inventory = inventoryQuantity(profile, entry.itemId);
      return {
        ...entry,
        ...buildBattleItemActionState({
          canUseBattleItem,
          cooldowns: snapshot?.private?.battleItemCooldowns,
          inventory,
          itemId: entry.itemId,
          row,
          selectedTargetId: selectedSkillTargetId
        }),
        row,
        inventory
      };
    })
    .filter((entry) => entry.row && entry.inventory > 0)
    .slice(0, 5);
  const previousSelfBid = useMemo(
    () => snapshot && selfPlayer?.id ? lastSubmittedBidAmount(snapshot, selfPlayer.id) : undefined,
    [selfPlayer?.id, snapshot]
  );

  return {
    canBid,
    canUseBattleItem,
    currentRound,
    equippedBattleItems,
    isHost,
    phaseRemaining,
    previousSelfBid,
    selectedSkillTargetId,
    selfPlayer,
    showBattleRandom,
    showIntelligencePanel,
    skillTargets
  };
}
