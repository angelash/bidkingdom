import { describe, expect, it } from 'vitest';
import { bidKingTicketRuntimeSummary } from './ticketRuntime';
import { Ticket } from './tables/Ticket';

describe('BidKing ticket runtime helper', () => {
  it('explains recovery, purchase, reserve, and start-failure policy from Ticket rows', () => {
    const row = Ticket[0]!;
    const summary = bidKingTicketRuntimeSummary(row);

    expect(summary.ticketId).toBe(row.id);
    expect(summary.max).toBe(row.max);
    expect(summary.recoverTimeSeconds).toBe(row.recovertime);
    expect(summary.recoversAutomatically).toBe(row.recovertime > 0);
    expect(summary.purchasable).toBe(row.buycounts > 0 && row.buyquantity > 0);
    expect(summary.reserveTicket).toBe(row.reserveticket);
    expect(summary.startFailurePolicy).toBe('preflight_no_spend');
  });
});
