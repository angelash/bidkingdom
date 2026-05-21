import type { FastifyInstance } from 'fastify';
import type { ProfileService } from '../services/profileService';

export function registerProfileRoutes(app: FastifyInstance, profiles: ProfileService): void {
  app.get<{
    Querystring: { playerId?: string; playerName?: string };
  }>('/api/profile', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.getSnapshot(request.query.playerId, request.query.playerName);
  });

  app.post<{
    Body: { playerId?: string; settings?: Record<string, string | number | boolean> };
  }>('/api/profile/settings', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.updateSettings(request.body.playerId, request.body.settings ?? {});
  });

  app.post<{
    Body: { playerId?: string; headId?: string };
  }>('/api/profile/head/select', async (request, reply) => {
    if (!request.body.playerId || !request.body.headId) {
      reply.code(400);
      return { error: 'playerId and headId are required' };
    }
    try {
      return profiles.selectHead(request.body.playerId, request.body.headId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'head select failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemId?: string };
  }>('/api/cabinet/set', async (request, reply) => {
    if (!request.body.playerId || !request.body.itemId) {
      reply.code(400);
      return { error: 'playerId and itemId are required' };
    }
    try {
      return profiles.setCabinetItem(request.body.playerId, request.body.itemId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'cabinet set failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemId?: string };
  }>('/api/cabinet/clear', async (request, reply) => {
    if (!request.body.playerId || !request.body.itemId) {
      reply.code(400);
      return { error: 'playerId and itemId are required' };
    }
    try {
      return profiles.clearCabinetItem(request.body.playerId, request.body.itemId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'cabinet clear failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; refId?: string; quantity?: number };
  }>('/api/cabinet/sell', async (request, reply) => {
    if (!request.body.playerId || !request.body.refId || typeof request.body.quantity !== 'number') {
      reply.code(400);
      return { error: 'playerId, refId and quantity are required' };
    }
    try {
      return profiles.sellInventoryItem(request.body.playerId, request.body.refId, request.body.quantity);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'cabinet sell failed' };
    }
  });

  app.post<{
    Body: { playerId?: string };
  }>('/api/cabinet/sell-all', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.sellAllInventoryItems(request.body.playerId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'cabinet sell all failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; skinId?: number };
  }>('/api/hero-skin/select', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.skinId !== 'number') {
      reply.code(400);
      return { error: 'playerId and skinId are required' };
    }
    try {
      return profiles.selectHeroSkin(request.body.playerId, request.body.skinId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'hero skin select failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; seed?: number };
  }>('/api/profile/language-name', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.applyLanguageName(request.body.playerId, request.body.seed);
  });

  app.post<{
    Body: { playerId?: string };
  }>('/api/ticket/refresh', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.refreshTickets(request.body.playerId);
  });

  app.post<{
    Body: { playerId?: string; mailId?: string };
  }>('/api/mail/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.mailId) {
      reply.code(400);
      return { error: 'playerId and mailId are required' };
    }
    try {
      return profiles.claimMail(request.body.playerId, request.body.mailId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'mail claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; mailId?: string };
  }>('/api/mail/read', async (request, reply) => {
    if (!request.body.playerId || !request.body.mailId) {
      reply.code(400);
      return { error: 'playerId and mailId are required' };
    }
    try {
      return profiles.markMailRead(request.body.playerId, request.body.mailId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'mail read failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; mailId?: string };
  }>('/api/mail/delete', async (request, reply) => {
    if (!request.body.playerId || !request.body.mailId) {
      reply.code(400);
      return { error: 'playerId and mailId are required' };
    }
    try {
      return profiles.deleteMail(request.body.playerId, request.body.mailId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'mail delete failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; taskId?: string };
  }>('/api/mission/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.taskId) {
      reply.code(400);
      return { error: 'playerId and taskId are required' };
    }
    try {
      return profiles.claimMissionReward(request.body.playerId, request.body.taskId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'mission claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; achievementId?: string };
  }>('/api/achievement/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.achievementId) {
      reply.code(400);
      return { error: 'playerId and achievementId are required' };
    }
    try {
      return profiles.claimAchievementReward(request.body.playerId, request.body.achievementId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'achievement claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; level?: number };
  }>('/api/level/reward/claim', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.level !== 'number') {
      reply.code(400);
      return { error: 'playerId and level are required' };
    }
    try {
      return profiles.claimLevelReward(request.body.playerId, request.body.level);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'level reward claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemIds?: number[] };
  }>('/api/battle/items/equip', async (request, reply) => {
    if (!request.body.playerId || !Array.isArray(request.body.itemIds)) {
      reply.code(400);
      return { error: 'playerId and itemIds are required' };
    }
    try {
      return profiles.equipBattleItems(request.body.playerId, request.body.itemIds);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'battle item equip failed' };
    }
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/profile/collection-bonus', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.getCollectionBonus(request.query.playerId);
  });

  app.post<{
    Body: { playerId?: string };
  }>('/api/profile/collection-income/claim', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.claimCollectionIncome(request.body.playerId);
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/profile/relief-fund', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.getReliefFundSnapshot(request.query.playerId);
  });

  app.post<{
    Body: { playerId?: string };
  }>('/api/profile/relief-fund/claim', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.claimReliefFund(request.body.playerId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'relief fund claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; noticeId?: string };
  }>('/api/notice/read', async (request, reply) => {
    if (!request.body.playerId || !request.body.noticeId) {
      reply.code(400);
      return { error: 'playerId and noticeId are required' };
    }
    try {
      return profiles.markNoticeRead(request.body.playerId, request.body.noticeId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'notice read failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; guideId?: string };
  }>('/api/guide/complete', async (request, reply) => {
    if (!request.body.playerId || !request.body.guideId) {
      reply.code(400);
      return { error: 'playerId and guideId are required' };
    }
    try {
      return profiles.completeGuide(request.body.playerId, request.body.guideId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'guide complete failed' };
    }
  });
}
