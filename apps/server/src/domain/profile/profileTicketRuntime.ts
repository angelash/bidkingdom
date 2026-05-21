import { Ticket } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';

export type TicketTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type TicketSourceChecker = (sourceId: string) => boolean;

export function ticketRow() {
  return Ticket[0]!;
}

export function refreshTicketState(profile: PlayerProfile): PlayerProfile {
  const row = ticketRow();
  profile.tickets.max = row.max;
  profile.tickets.name = row.packaged_name;
  profile.tickets.recoverTimeSeconds = row.recovertime;
  if (row.recovertime <= 0) {
    profile.tickets.current = Math.min(profile.tickets.current, row.max);
    profile.tickets.nextRecoverAt = undefined;
    return profile;
  }
  const now = Date.now();
  while (profile.tickets.current < row.max && profile.tickets.nextRecoverAt && profile.tickets.nextRecoverAt <= now) {
    profile.tickets.current += 1;
    profile.tickets.updatedAt = now;
    profile.tickets.nextRecoverAt = profile.tickets.current < row.max
      ? profile.tickets.nextRecoverAt + row.recovertime * 1000
      : undefined;
  }
  if (profile.tickets.current < row.max && !profile.tickets.nextRecoverAt) {
    profile.tickets.nextRecoverAt = now + row.recovertime * 1000;
  }
  return profile;
}

export function consumeTicketForMatchProfile(
  profile: PlayerProfile,
  sourceId: string,
  hasTransactionSource: TicketSourceChecker,
  recordTransaction: TicketTransactionRecorder
): boolean {
  refreshTicketState(profile);
  if (hasTransactionSource(sourceId)) {
    return false;
  }
  if (profile.tickets.current <= 0) {
    throw new Error('竞拍票不足');
  }
  const before = profile.tickets.current;
  profile.tickets.current -= 1;
  profile.tickets.updatedAt = Date.now();
  if (profile.tickets.current < profile.tickets.max && profile.tickets.recoverTimeSeconds > 0 && !profile.tickets.nextRecoverAt) {
    profile.tickets.nextRecoverAt = Date.now() + profile.tickets.recoverTimeSeconds * 1000;
  }
  recordTransaction(profile, sourceId, 'ticket_spend_match', 'ticket', before, -1);
  return true;
}
