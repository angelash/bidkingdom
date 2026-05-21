import type { PlayerProfile, ProfileSnapshot, ProfileTransaction } from '@bitkingdom/shared';
import { refreshMissionProgress } from './profileProgressRuntime';
import { ensureProfileShape } from './profileShape';
import { refreshTicketState } from './profileTicketRuntime';

export function buildProfileSnapshot(
  profile: PlayerProfile,
  transactions: ProfileTransaction[]
): ProfileSnapshot {
  ensureProfileShape(profile);
  refreshTicketState(profile);
  refreshMissionProgress(profile);
  return {
    profile,
    transactions
  };
}

export function listProfilesForAdmin(profiles: Iterable<PlayerProfile>): PlayerProfile[] {
  const profileList = [...profiles];
  for (const profile of profileList) {
    ensureProfileShape(profile);
    refreshTicketState(profile);
    refreshMissionProgress(profile);
  }
  return profileList.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function listProfileTransactions(
  transactions: readonly ProfileTransaction[],
  limit: number,
  playerId?: string
): ProfileTransaction[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return transactions
    .filter((transaction) => !playerId || transaction.playerId === playerId)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, safeLimit);
}
