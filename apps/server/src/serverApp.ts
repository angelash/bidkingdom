import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { createRoomManager } from './roomManager';
import { registerAccountRoutes } from './routes/accountRoutes';
import { registerAdminRoutes } from './routes/adminRoutes';
import { registerEconomyRoutes } from './routes/economyRoutes';
import { registerErrorEnvelope } from './routes/errorEnvelope';
import { registerMatchRoutes } from './routes/matchRoutes';
import { registerProfileRoutes } from './routes/profileRoutes';
import { registerSocialRoutes } from './routes/socialRoutes';
import { registerSystemRoutes } from './routes/systemRoutes';
import { bearerToken, createAccountService, type AccountService } from './services/accountService';
import { createProfileService, type ProfileService } from './services/profileService';
import { createServerStore, type ServerStore } from './services/store';

export interface BitKingdomServerOptions {
  logger?: boolean;
}

export interface BitKingdomServerRuntime {
  app: FastifyInstance;
  io: Server;
  store: ServerStore;
  accounts: AccountService;
  profiles: ProfileService;
  rooms: ReturnType<typeof createRoomManager>;
}

export async function createBitKingdomServer(options: BitKingdomServerOptions = {}): Promise<BitKingdomServerRuntime> {
  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, {
    origin: true
  });

  registerErrorEnvelope(app);
  registerSystemRoutes(app);

  const io = new Server(app.server, {
    cors: {
      origin: true
    }
  });

  const store = createServerStore();
  const profiles = createProfileService(store);
  const accounts = createAccountService(store, profiles);
  const rooms = createRoomManager(io, app.log, { accounts, profiles });

  registerAdminRoutes(app, { profiles, rooms, store });
  registerAccountRoutes(app, accounts);
  registerAccountSessionGuard(app, accounts);
  registerEconomyRoutes(app, profiles);
  registerMatchRoutes(app, rooms);
  registerProfileRoutes(app, profiles);
  registerSocialRoutes(app, profiles);

  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'socket connected');
    socket.emit('toast', { tone: 'info', message: '已连接到珍宝局服务' });
    rooms.bindSocket(socket);
  });

  return { app, io, store, accounts, profiles, rooms };
}

function registerAccountSessionGuard(app: FastifyInstance, accounts: AccountService): void {
  app.addHook('preHandler', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    const protectedRoute = isProtectedProfileRoute(request.method, request.url);
    if (!token && !protectedRoute) {
      return;
    }
    if (!token) {
      await reply.code(401).send({ error: 'session token is required' });
      return;
    }
    const sessionProfileId = accounts.resolveProfileIdForSession(token);
    if (!sessionProfileId) {
      await reply.code(401).send({ error: 'session expired' });
      return;
    }
    const requestedPlayerId = requestPlayerId(request.body) ?? requestPlayerId(request.query);
    if (requestedPlayerId && requestedPlayerId !== sessionProfileId) {
      await reply.code(403).send({ error: 'profile session mismatch' });
      return;
    }
    if (protectedRoute) {
      bindSessionProfileId(request, sessionProfileId);
    }
  });
}

function isProtectedProfileRoute(method: string, rawUrl: string): boolean {
  const path = rawUrl.split('?')[0] ?? rawUrl;
  const verb = method.toUpperCase();
  if (path === '/api/profile' || path === '/api/activity/progress') {
    return true;
  }
  if (path === '/api/market/order' || path === '/api/market/order/action') {
    return true;
  }
  if (
    path === '/api/exchange/lanch-items' ||
    path === '/api/exchange/info' ||
    path === '/api/exchange/item-trade-info' ||
    path === '/api/exchange/buy-item' ||
    path === '/api/exchange/trade-info' ||
    path === '/api/exchange/collect-items' ||
    path === '/api/exchange/collect-item' ||
    path === '/api/exchange/uncollect-item' ||
    path === '/api/exchange/lanch-item' ||
    path === '/api/exchange/unlanch-item'
  ) {
    return true;
  }
  if (
    path === '/api/auction-house/lanch-items' ||
    path === '/api/auction-house/items' ||
    path === '/api/auction-house/item-price-info' ||
    path === '/api/auction-house/bid' ||
    path === '/api/auction-house/bid-logs' ||
    path === '/api/auction-house/trade-info' ||
    path === '/api/auction-house/unlanch-item' ||
    path === '/api/auction-house/unlock-lanch-slot'
  ) {
    return true;
  }
  if (path === '/api/send-auction' || path === '/api/send-auction/action' || path === '/api/send-auction/games' || path === '/api/send-auctions') {
    return true;
  }
  if (verb === 'GET' && (
    path === '/api/profile/collection-bonus' ||
    path === '/api/profile/relief-fund'
  )) {
    return true;
  }
  return [
    '/api/profile/',
    '/api/cabinet/',
    '/api/hero/',
    '/api/hero-skin/',
    '/api/ticket/',
    '/api/mail/',
    '/api/mission/',
    '/api/achievement/',
    '/api/level/',
    '/api/battle/items/',
    '/api/shop/',
    '/api/gift-package/',
    '/api/pay/',
    '/api/purchase-list/',
    '/api/dlc/',
    '/api/activity/claim',
    '/api/rank/claim',
    '/api/social/',
    '/api/guild/'
  ].some((prefix) => path.startsWith(prefix));
}

function bindSessionProfileId(request: { body?: unknown; query?: unknown; method: string }, profileId: string): void {
  const targetName = request.method.toUpperCase() === 'GET' ? 'query' : 'body';
  const target = request[targetName];
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    (target as { playerId?: string }).playerId = profileId;
    return;
  }
  request[targetName] = { playerId: profileId };
}

function requestPlayerId(source: unknown): string | undefined {
  if (!source || typeof source !== 'object' || !('playerId' in source)) {
    return undefined;
  }
  const value = (source as { playerId?: unknown }).playerId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
