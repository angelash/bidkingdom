import type { FastifyInstance } from 'fastify';
import type { ProfileService } from '../services/profileService';

export function registerEconomyRoutes(app: FastifyInstance, profiles: ProfileService): void {
  app.post<{
    Body: { playerId?: string; shopItemId?: number };
  }>('/api/shop/buy', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.shopItemId !== 'number') {
      reply.code(400);
      return { error: 'playerId and shopItemId are required' };
    }
    try {
      return profiles.buyShopItem(request.body.playerId, request.body.shopItemId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'shop buy failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; shopId?: number };
  }>('/api/shop/refresh', async (request, reply) => {
    if (!request.body.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.refreshShop(request.body.playerId, request.body.shopId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'shop refresh failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemId?: number; collected?: boolean };
  }>('/api/shop/collect', async (request, reply) => {
    if (!request.body.playerId || typeof request.body.itemId !== 'number' || typeof request.body.collected !== 'boolean') {
      reply.code(400);
      return { error: 'playerId, itemId and collected are required' };
    }
    try {
      return profiles.setShopItemCollection(request.body.playerId, request.body.itemId, request.body.collected);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'shop collect failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; packageId?: string };
  }>('/api/gift-package/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.packageId) {
      reply.code(400);
      return { error: 'playerId and packageId are required' };
    }
    try {
      return profiles.claimGiftPackage(request.body.playerId, request.body.packageId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'gift package claim failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; payId?: string };
  }>('/api/pay/order', async (request, reply) => {
    if (!request.body.playerId || !request.body.payId) {
      reply.code(400);
      return { error: 'playerId and payId are required' };
    }
    try {
      return profiles.createDemoPayOrder(request.body.playerId, request.body.payId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'pay order create failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; payId?: string };
  }>('/api/pay/order/complete-demo', async (request, reply) => {
    if (!request.body.playerId || !request.body.payId) {
      reply.code(400);
      return { error: 'playerId and payId are required' };
    }
    try {
      return profiles.completeDemoPayOrder(request.body.playerId, request.body.payId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'pay order failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; orderId?: string };
  }>('/api/pay/order/cancel-demo', async (request, reply) => {
    if (!request.body.playerId || !request.body.orderId) {
      reply.code(400);
      return { error: 'playerId and orderId are required' };
    }
    try {
      return profiles.cancelDemoPayOrder(request.body.playerId, request.body.orderId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'pay order cancel failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; purchaseId?: string };
  }>('/api/purchase-list/complete-demo', async (request, reply) => {
    if (!request.body.playerId || !request.body.purchaseId) {
      reply.code(400);
      return { error: 'playerId and purchaseId are required' };
    }
    try {
      return profiles.completePurchaseListOrder(request.body.playerId, request.body.purchaseId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'purchase list order failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; dlcId?: string };
  }>('/api/dlc/unlock-demo', async (request, reply) => {
    if (!request.body.playerId || !request.body.dlcId) {
      reply.code(400);
      return { error: 'playerId and dlcId are required' };
    }
    try {
      return profiles.unlockDemoDlc(request.body.playerId, request.body.dlcId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'dlc unlock failed' };
    }
  });

  app.get('/api/exchange/restock', async () => profiles.getExchangeRestockSnapshot());

  app.get('/api/sim/snapshot', async () => profiles.getSimSnapshot());

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/activity/progress', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.getActivityProgress(request.query.playerId);
  });

  app.post<{
    Body: { playerId?: string; refId?: string; quantity?: number; price?: number; orderType?: 'trade' | 'auction'; note?: string };
  }>('/api/market/order', async (request, reply) => {
    const { playerId, refId, quantity, note, orderType, price } = request.body;
    if (!playerId || !refId || typeof quantity !== 'number' || typeof price !== 'number' || (orderType !== 'trade' && orderType !== 'auction')) {
      reply.code(400);
      return { error: 'playerId, refId, quantity, price and orderType are required' };
    }
    try {
      return profiles.createMarketOrder(playerId, refId, quantity, price, orderType, note);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'market order failed' };
    }
  });

  app.get<{
    Querystring: { orderType?: 'trade' | 'auction' };
  }>('/api/market/orders', async (request, reply) => {
    const { orderType } = request.query;
    if (orderType !== undefined && orderType !== 'trade' && orderType !== 'auction') {
      reply.code(400);
      return { error: 'orderType must be trade or auction' };
    }
    return profiles.listMarketOrders(orderType);
  });

  app.post<{
    Body: { playerId?: string; orderId?: string; action?: 'settle' | 'cancel' };
  }>('/api/market/order/action', async (request, reply) => {
    const { playerId, orderId, action } = request.body;
    if (!playerId || !orderId || (action !== 'settle' && action !== 'cancel')) {
      reply.code(400);
      return { error: 'playerId, orderId and action are required' };
    }
    try {
      return action === 'settle'
        ? profiles.settleMarketOrder(playerId, orderId)
        : profiles.cancelMarketOrder(playerId, orderId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'market order action failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; mapCid?: number; itemSelections?: Array<{ stockId?: number; boxId?: number }> };
  }>('/api/send-auction', async (request, reply) => {
    const { playerId, mapCid, itemSelections } = request.body;
    if (!playerId || typeof mapCid !== 'number' || !Array.isArray(itemSelections)) {
      reply.code(400);
      return { error: 'playerId, mapCid and itemSelections are required' };
    }
    const normalizedSelections = itemSelections.map((selection) => ({
      stockId: Number(selection.stockId),
      boxId: Number(selection.boxId)
    }));
    if (normalizedSelections.some((selection) => !Number.isFinite(selection.stockId) || !Number.isFinite(selection.boxId))) {
      reply.code(400);
      return { error: 'itemSelections must include stockId and boxId' };
    }
    try {
      return profiles.createSendAuction(playerId, mapCid, normalizedSelections);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'send auction failed' };
    }
  });

  app.get<{
    Querystring: { playerId?: string; includeHistory?: string };
  }>('/api/send-auctions', async (request, reply) => {
    const { playerId, includeHistory } = request.query;
    if (!playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return {
        generatedAt: Date.now(),
        auctions: profiles.listSendAuctions(playerId, includeHistory !== '0')
      };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'send auction list failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; sendAuctionId?: string; slotId?: number; action?: 'settle' | 'recycle'; finalPrice?: number };
  }>('/api/send-auction/action', async (request, reply) => {
    const { playerId, sendAuctionId, slotId, action, finalPrice } = request.body;
    if (!playerId || (action !== 'settle' && action !== 'recycle')) {
      reply.code(400);
      return { error: 'playerId and action are required' };
    }
    if (action === 'settle' && !sendAuctionId) {
      reply.code(400);
      return { error: 'sendAuctionId is required for settlement' };
    }
    if (action === 'recycle' && typeof slotId !== 'number') {
      reply.code(400);
      return { error: 'slotId is required for recycle' };
    }
    try {
      return action === 'settle'
        ? profiles.settleSendAuction(playerId, sendAuctionId!, finalPrice)
        : profiles.recycleSendAuction(playerId, slotId!);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'send auction action failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; activityId?: string };
  }>('/api/activity/claim', async (request, reply) => {
    if (!request.body.playerId || !request.body.activityId) {
      reply.code(400);
      return { error: 'playerId and activityId are required' };
    }
    try {
      return profiles.claimActivityReward(request.body.playerId, request.body.activityId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'activity claim failed' };
    }
  });
}
