import { useMemo } from 'react';
import { BattleItem as bidKingBattleItems } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, PlayerSnapshot, PublicPlayer, RoomSnapshot } from '@bitkingdom/shared';
import { inventoryQuantity } from '../profile/profileInventory';
import { lastSubmittedBidAmount } from './BattlePanels';
import type { EquippedBattleItemView } from './MatchShell';
import { buildBattleItemActionState } from './battleItemUi';
import { calculateRecommendedBid } from './bidRecommendation';

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
  canUseSkill: boolean;
  currentRound?: NonNullable<PlayerSnapshot['public']['currentRound']>;
  equippedBattleItems: EquippedBattleItemView[];
  isHost: boolean;
  phaseRemaining: number;
  previousSelfBid?: number;
  recommendedBid?: { safePrice: number; reason: string };
  selectedSkillTargetId?: string;
  selfPlayer?: PublicPlayer;
  showAuctioneerReveal: boolean;
  showMapIntro: boolean;
  skillTargets: PublicPlayer[];
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
  const isBidKingCoreRound = Boolean(currentRound?.container.templateId.startsWith('bidmap_'));
  const canBid = Boolean(currentRound?.phase === 'auction' && !selfAlreadyActed);
  const canUseSkill = Boolean(
    currentRound &&
    !isBidKingCoreRound &&
    ['intel', 'auction'].includes(currentRound.phase) &&
    !(currentRound.phase === 'auction' && selfAlreadyActed) &&
    !snapshot?.private?.skillUsedThisRound &&
    snapshot?.private?.skillCooldown === 0 &&
    (snapshot?.private?.skillUsesRemaining ?? 0) > 0
  );
  const canUseBattleItem = Boolean(
    currentRound &&
    ['intel', 'auction'].includes(currentRound.phase) &&
    !(currentRound.phase === 'auction' && selfAlreadyActed) &&
    (snapshot?.private?.battleItemUsesRemainingThisRound ?? 1) > 0
  );
  const recommendedBid = snapshot ? calculateRecommendedBid(snapshot) : undefined;
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
    canUseSkill,
    currentRound,
    equippedBattleItems,
    isHost,
    phaseRemaining,
    previousSelfBid,
    recommendedBid,
    selectedSkillTargetId,
    selfPlayer,
    showAuctioneerReveal: currentRound?.phase === 'auctioneer_reveal',
    showMapIntro: Boolean(currentRound && ['warehouse_roll', 'warehouse_selected'].includes(currentRound.phase)),
    skillTargets
  };
}
