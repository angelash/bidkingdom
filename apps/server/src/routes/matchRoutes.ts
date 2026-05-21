import type { FastifyInstance } from 'fastify';
import type { createRoomManager } from '../roomManager';

type RoomManager = ReturnType<typeof createRoomManager>;

export function registerMatchRoutes(app: FastifyInstance, rooms: RoomManager): void {
  app.get('/api/rooms', async () => rooms.listRooms());

  app.get<{
    Params: { matchId: string };
  }>('/api/matches/:matchId/events', async (request, reply) => {
    const match = rooms.findMatch(request.params.matchId);
    if (!match) {
      reply.code(404);
      return { error: 'match not found' };
    }
    return { events: match.events };
  });

  app.get<{
    Params: { matchId: string };
  }>('/api/matches/:matchId/transactions', async (request, reply) => {
    const match = rooms.findMatch(request.params.matchId);
    if (!match) {
      reply.code(404);
      return { error: 'match not found' };
    }
    return { transactions: match.transactions };
  });
}
