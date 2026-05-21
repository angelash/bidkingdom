import type { FastifyInstance } from 'fastify';
import { bearerToken, type AccountService } from '../services/accountService';

export function registerAccountRoutes(app: FastifyInstance, accounts: AccountService): void {
  app.post<{
    Body: { accountName?: string; password?: string; playerName?: string };
  }>('/api/account/register', async (request, reply) => {
    try {
      return accounts.registerAccount(request.body ?? {});
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'register failed' };
    }
  });

  app.post<{
    Body: { accountName?: string; password?: string; playerName?: string };
  }>('/api/account/login', async (request, reply) => {
    try {
      return accounts.loginAccount(request.body ?? {});
    } catch (error) {
      reply.code(401);
      return { error: error instanceof Error ? error.message : 'login failed' };
    }
  });

  app.post<{
    Body: { deviceId?: string; playerName?: string; legacyProfileId?: string };
  }>('/api/account/guest', async (request, reply) => {
    try {
      return accounts.createGuestSession(request.body ?? {});
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guest session failed' };
    }
  });

  app.post<{
    Body: { accountName?: string; password?: string; playerName?: string };
  }>('/api/account/upgrade', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: 'session token is required' };
    }
    try {
      return accounts.upgradeGuestAccount(token, request.body ?? {});
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'upgrade failed' };
    }
  });

  app.post<{
    Body: { currentPassword?: string; nextPassword?: string };
  }>('/api/account/password', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: 'session token is required' };
    }
    try {
      return accounts.changePassword(token, request.body ?? {});
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'password change failed' };
    }
  });

  app.get<{
    Querystring: { sessionToken?: string };
  }>('/api/account/session', async (request, reply) => {
    const token = bearerToken(request.headers.authorization) ?? request.query.sessionToken;
    if (!token) {
      reply.code(401);
      return { error: 'session token is required' };
    }
    const session = accounts.getSessionSnapshot(token);
    if (!session) {
      reply.code(401);
      return { error: 'session expired' };
    }
    return session;
  });

  app.post('/api/account/logout', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: 'session token is required' };
    }
    return { ok: accounts.logout(token) };
  });

  app.post('/api/account/logout-all', async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return { error: 'session token is required' };
    }
    return { ok: accounts.logoutAll(token) };
  });
}
