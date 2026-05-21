import {
  bidKingEmojiPresentation,
  Emoji as bidKingEmojis,
  emojiUnlockRequirements,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';

export interface SocialEmojiAction {
  id: string;
  label: string;
  title: string;
  disabled: boolean;
  visualClass: ReturnType<typeof bidKingEmojiPresentation>['visualClass'];
  soundId?: number;
  animationKey?: string;
  effectKey?: string;
  effectViewIds: number[];
}

export function socialEmojiActionsForProfile(
  profile: Pick<PlayerProfile, 'inventory'>,
  rows: BidKingRawTableRow[] = bidKingEmojis
): SocialEmojiAction[] {
  return rows.map((row) => {
    const presentation = bidKingEmojiPresentation(row);
    const missingRequirement = emojiUnlockRequirements(row).find(
      (requirement) => inventoryQuantity(profile, requirement.refId) < requirement.quantity
    );
    return {
      id: row.id,
      label: presentation.label,
      title: missingRequirement
        ? `未解锁：需要珍物 ${missingRequirement.refId} x${missingRequirement.quantity}`
        : socialEmojiTitle(presentation),
      disabled: Boolean(missingRequirement),
      visualClass: presentation.visualClass,
      soundId: presentation.soundId,
      animationKey: presentation.animationKey,
      effectKey: presentation.effectKey,
      effectViewIds: presentation.effectViewIds
    };
  });
}

function socialEmojiTitle(presentation: ReturnType<typeof bidKingEmojiPresentation>): string {
  const parts = [presentation.description];
  if (presentation.soundId) {
    parts.push(`声闻 ${presentation.soundId}`);
  }
  if (presentation.animationKey) {
    parts.push(presentation.animationKey);
  }
  if (presentation.effectKey) {
    parts.push(presentation.effectKey);
  }
  return parts.join(' · ');
}

function inventoryQuantity(profile: Pick<PlayerProfile, 'inventory'>, refId: string): number {
  return profile.inventory
    .filter((entry) => entry.refId === refId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}
