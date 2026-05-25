import type { FastifyInstance } from 'fastify';
import type { ProfileService } from '../services/profileService';

export function registerSocialRoutes(app: FastifyInstance, profiles: ProfileService): void {
  app.post<{
    Body: { playerId?: string; rank?: number };
  }>('/api/rank/claim', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.rank !== 'number') {
      reply.code(400);
      return { error: 'playerId and rank are required' };
    }
    try {
      return profiles.claimRankReward(request.body.playerId, request.body.rank);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'rank claim failed' };
    }
  });

  app.get<{
    Querystring: { rankId?: string; page?: string; pageSize?: string };
  }>('/api/rank/snapshot', async (request) => profiles.getRankSnapshot(
    request.query.rankId,
    Number(request.query.page ?? 1),
    Number(request.query.pageSize ?? 8)
  ));

  app.get('/api/area/snapshot', async () => profiles.getAreaSnapshot());

  app.post<{
    Body: { playerId?: string; friendId?: string };
  }>('/api/social/friend/remove', async (request, reply) => {
    if (!request.body.playerId || !request.body.friendId) {
      reply.code(400);
      return { error: 'playerId and friendId are required' };
    }
    try {
      return profiles.removeFriend(request.body.playerId, request.body.friendId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'friend remove failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; friendId?: string; remark?: string };
  }>('/api/social/friend/remark', async (request, reply) => {
    if (!request.body.playerId || !request.body.friendId) {
      reply.code(400);
      return { error: 'playerId and friendId are required' };
    }
    try {
      return profiles.setFriendRemark(request.body.playerId, request.body.friendId, request.body.remark ?? '');
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'friend remark failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; areaId?: string };
  }>('/api/guild/join', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.joinGuild(request.body.playerId, request.body.areaId);
  });

  app.post<{
    Body: { playerId?: string; roleId?: string };
  }>('/api/guild/role', async (request, reply) => {
    if (!request.body.playerId || !request.body.roleId) {
      reply.code(400);
      return { error: 'playerId and roleId are required' };
    }
    try {
      return profiles.setGuildRole(request.body.playerId, request.body.roleId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild role failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; applicantId?: string };
  }>('/api/guild/member/approve', async (request, reply) => {
    if (!request.body.playerId || !request.body.applicantId) {
      reply.code(400);
      return { error: 'playerId and applicantId are required' };
    }
    try {
      return profiles.approveGuildMember(request.body.playerId, request.body.applicantId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild member approve failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; memberId?: string };
  }>('/api/guild/member/kick', async (request, reply) => {
    if (!request.body.playerId || !request.body.memberId) {
      reply.code(400);
      return { error: 'playerId and memberId are required' };
    }
    try {
      return profiles.kickGuildMember(request.body.playerId, request.body.memberId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild member kick failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; notice?: string };
  }>('/api/guild/notice', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.updateGuildNotice(request.body.playerId, request.body.notice ?? '');
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild notice failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; amount?: number };
  }>('/api/guild/donate', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.amount !== 'number') {
      reply.code(400);
      return { error: 'playerId and amount are required' };
    }
    try {
      return profiles.donateGuildCoins(request.body.playerId, request.body.amount);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild donate failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; resourceId?: string };
  }>('/api/guild/resource/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.resourceId) {
      reply.code(400);
      return { error: 'playerId and resourceId are required' };
    }
    try {
      return profiles.claimGuildResource(request.body.playerId, request.body.resourceId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild resource claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; areaId?: string };
  }>('/api/guild/area/resource/claim', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.claimAreaResource(request.body.playerId, request.body.areaId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild area resource claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; resourceId?: string; quantity?: number };
  }>('/api/guild/resource/use', async (request, reply) => {
    if (!request.body.playerId || !request.body.resourceId) {
      reply.code(400);
      return { error: 'playerId and resourceId are required' };
    }
    try {
      return profiles.useGuildResource(request.body.playerId, request.body.resourceId, request.body.quantity);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guild resource use failed' };
    }
  });
}
