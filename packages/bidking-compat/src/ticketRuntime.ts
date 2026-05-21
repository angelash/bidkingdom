import type { BidKingTicketRow } from './schema';
import { Ticket } from './tables/Ticket';

export interface BidKingTicketRuntimeSummary {
  buyCounts: number;
  buyCurrency: number;
  buyQuantity: number;
  buyRefresh: number;
  max: number;
  maxLimit: number;
  price: readonly number[];
  purchasable: boolean;
  recoverTimeSeconds: number;
  recoversAutomatically: boolean;
  reserveEnabled: boolean;
  reserveLimit: number;
  reserveTicket: number;
  reserveTimeSeconds: number;
  startFailurePolicy: 'preflight_no_spend';
  ticketId: number;
}

export function bidKingTicketRuntimeSummary(row: BidKingTicketRow = Ticket[0]!): BidKingTicketRuntimeSummary {
  return {
    buyCounts: row.buycounts,
    buyCurrency: row.buycurrency,
    buyQuantity: row.buyquantity,
    buyRefresh: row.buyrefresh,
    max: row.max,
    maxLimit: row.maxlimit,
    price: row.price,
    purchasable: row.buycounts > 0 && row.buyquantity > 0,
    recoverTimeSeconds: row.recovertime,
    recoversAutomatically: row.recovertime > 0,
    reserveEnabled: row.reserveticket > 0 && row.reservelimit > 0,
    reserveLimit: row.reservelimit,
    reserveTicket: row.reserveticket,
    reserveTimeSeconds: row.reservetime,
    startFailurePolicy: 'preflight_no_spend',
    ticketId: row.id
  };
}
