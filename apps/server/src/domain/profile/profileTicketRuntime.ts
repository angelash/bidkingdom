import { Ticket } from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';

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
