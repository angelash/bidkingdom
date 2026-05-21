import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { createRoomManager } from './roomManager';
import { registerAdminRoutes } from './routes/adminRoutes';
import { registerEconomyRoutes } from './routes/economyRoutes';
import { registerErrorEnvelope } from './routes/errorEnvelope';
import { registerMatchRoutes } from './routes/matchRoutes';
import { registerProfileRoutes } from './routes/profileRoutes';
import { registerSocialRoutes } from './routes/socialRoutes';
import { registerSystemRoutes } from './routes/systemRoutes';
import { createProfileService, type ProfileService } from './services/profileService';
import { createServerStore, type ServerStore } from './services/store';

export interface BitKingdomServerOptions {
  logger?: boolean;
}

export interface BitKingdomServerRuntime {
  app: FastifyInstance;
  io: Server;
  store: ServerStore;
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
  const rooms = createRoomManager(io, app.log, { profiles });

  registerAdminRoutes(app, { profiles, rooms, store });
  registerEconomyRoutes(app, profiles);
  registerMatchRoutes(app, rooms);
  registerProfileRoutes(app, profiles);
  registerSocialRoutes(app, profiles);

  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'socket connected');
    socket.emit('toast', { tone: 'info', message: '已连接到珍宝局 Demo 服务' });
    rooms.bindSocket(socket);
  });

  return { app, io, store, profiles, rooms };
}
