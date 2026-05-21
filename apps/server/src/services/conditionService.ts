import { checkBidKingAccess } from '@bitkingdom/match-core';
import type { PlayerProfile } from '@bitkingdom/shared';
import type { AccessCheckResult } from '@bitkingdom/match-core';

export type { AccessCheckResult };

export function checkAccess(profile: PlayerProfile, accessId?: string | number): AccessCheckResult {
  return checkBidKingAccess(
    {
      completedMatches: profile.completedMatches.length,
      level: profile.level
    },
    accessId
  );
}
