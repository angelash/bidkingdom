import type { FastifyInstance } from 'fastify';
import type { AuctionHouseItemSortModel } from '@bitkingdom/shared';
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

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/exchange/lanch-items', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listExchangeLanchItems(request.query.playerId);
  });

  app.get('/api/exchange/info', async () => profiles.listExchangeInfo());

  app.get<{
    Querystring: { itemCid?: string };
  }>('/api/exchange/item-trade-info', async (request, reply) => {
    const itemCid = Number(request.query.itemCid);
    if (!Number.isFinite(itemCid) || itemCid <= 0) {
      reply.code(400);
      return { error: 'itemCid is required' };
    }
    return profiles.listExchangeItemTradeInfo(itemCid);
  });

  app.post<{
    Body: { playerId?: string; itemCid?: number; itemCount?: number; estimatePrice?: number };
  }>('/api/exchange/buy-item', async (request, reply) => {
    const { estimatePrice, itemCid, itemCount, playerId } = request.body;
    if (!playerId || typeof itemCid !== 'number' || typeof itemCount !== 'number' || typeof estimatePrice !== 'number') {
      reply.code(400);
      return { error: 'playerId, itemCid, itemCount and estimatePrice are required' };
    }
    try {
      return profiles.buyExchangeItem(playerId, itemCid, itemCount, estimatePrice);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'exchange buy failed' };
    }
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/exchange/trade-info', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listExchangeTradeInfo(request.query.playerId);
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/exchange/collect-items', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listExchangeCollectItems(request.query.playerId);
  });

  app.post<{
    Body: { playerId?: string; itemCid?: number };
  }>('/api/exchange/collect-item', async (request, reply) => {
    const { itemCid, playerId } = request.body;
    if (!playerId || typeof itemCid !== 'number') {
      reply.code(400);
      return { error: 'playerId and itemCid are required' };
    }
    try {
      return profiles.collectExchangeItem(playerId, itemCid);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'exchange collect failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemCid?: number };
  }>('/api/exchange/uncollect-item', async (request, reply) => {
    const { itemCid, playerId } = request.body;
    if (!playerId || typeof itemCid !== 'number') {
      reply.code(400);
      return { error: 'playerId and itemCid are required' };
    }
    try {
      return profiles.uncollectExchangeItem(playerId, itemCid);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'exchange uncollect failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemCid?: number; count?: number; totalPrice?: number; reLanchItemUid?: number };
  }>('/api/exchange/lanch-item', async (request, reply) => {
    const { count, itemCid, playerId, reLanchItemUid, totalPrice } = request.body;
    if (!playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    const isReLanch = typeof reLanchItemUid === 'number' && reLanchItemUid > 0;
    if (!isReLanch && (typeof itemCid !== 'number' || typeof count !== 'number' || typeof totalPrice !== 'number')) {
      reply.code(400);
      return { error: 'itemCid, count and totalPrice are required unless reLanchItemUid is provided' };
    }
    try {
      return profiles.lanchExchangeItem(
        playerId,
        itemCid ?? 0,
        count ?? 0,
        totalPrice ?? 0,
        reLanchItemUid ?? 0
      );
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'exchange lanch failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; itemUid?: number };
  }>('/api/exchange/unlanch-item', async (request, reply) => {
    const { itemUid, playerId } = request.body;
    if (!playerId || typeof itemUid !== 'number') {
      reply.code(400);
      return { error: 'playerId and itemUid are required' };
    }
    try {
      return profiles.cancelExchangeLanchItem(playerId, itemUid);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'exchange unlanch failed' };
    }
  });

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

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/auction-house/lanch-items', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listAuctionHouseLanchItems(request.query.playerId);
  });

  app.get<{
    Querystring: { itemCid?: string; isDisplayPeriod?: string; sortType?: string; page?: string; pageSize?: string; reverse?: string };
  }>('/api/auction-house/items', async (request, reply) => {
    const sortType = parseAuctionHouseSortType(request.query.sortType);
    if (request.query.sortType !== undefined && !sortType) {
      reply.code(400);
      return { error: 'sortType must be LanchTime, Price, MaxPrice or StartPrice' };
    }
    return profiles.listAuctionHouseItems({
      itemCid: optionalNumber(request.query.itemCid),
      isDisplayPeriod: optionalNumber(request.query.isDisplayPeriod),
      sortType,
      page: optionalNumber(request.query.page),
      pageSize: optionalNumber(request.query.pageSize),
      reverse: optionalBoolean(request.query.reverse)
    });
  });

  app.get('/api/auction-house/item-price-info', async () => {
    return profiles.listAuctionHouseItemPriceInfo();
  });

  app.post<{
    Body: { playerId?: string; itemUid?: number; price?: number };
  }>('/api/auction-house/bid', async (request, reply) => {
    const { itemUid, playerId, price } = request.body;
    if (!playerId || typeof itemUid !== 'number' || typeof price !== 'number') {
      reply.code(400);
      return { error: 'playerId, itemUid and price are required' };
    }
    try {
      return profiles.bidAuctionHousePrice(playerId, itemUid, price);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'auction house bid failed' };
    }
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/auction-house/bid-logs', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listAuctionHouseBidLogs(request.query.playerId);
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/auction-house/trade-info', async (request, reply) => {
    if (!request.query.playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    return profiles.listAuctionHouseTradeInfo(request.query.playerId);
  });

  app.post<{
    Body: { playerId?: string; itemUid?: number };
  }>('/api/auction-house/unlanch-item', async (request, reply) => {
    const { itemUid, playerId } = request.body;
    if (!playerId || typeof itemUid !== 'number') {
      reply.code(400);
      return { error: 'playerId and itemUid are required' };
    }
    try {
      return profiles.cancelAuctionHouseLanchItem(playerId, itemUid);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'auction house unlanch failed' };
    }
  });

  app.post<{
    Body: { playerId?: string; unlockCount?: number };
  }>('/api/auction-house/unlock-lanch-slot', async (request, reply) => {
    const { playerId, unlockCount } = request.body;
    if (!playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    if (unlockCount !== undefined && (typeof unlockCount !== 'number' || !Number.isFinite(unlockCount) || unlockCount < 1)) {
      reply.code(400);
      return { error: 'unlockCount must be a positive number' };
    }
    try {
      return profiles.unlockAuctionHouseLanchSlot(playerId, unlockCount ?? 1);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'auction house slot unlock failed' };
    }
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
    Body: { playerId?: string; slotId?: number; mapCid?: number; itemSelections?: Array<{ stockId?: number; boxId?: number }> };
  }>('/api/send-auction', async (request, reply) => {
    const { playerId, slotId, mapCid, itemSelections } = request.body;
    if (!playerId || typeof mapCid !== 'number' || !Array.isArray(itemSelections)) {
      reply.code(400);
      return { error: 'playerId, mapCid and itemSelections are required' };
    }
    const normalizedSlotId = slotId === undefined ? undefined : Number(slotId);
    if (normalizedSlotId !== undefined && (!Number.isFinite(normalizedSlotId) || !Number.isInteger(normalizedSlotId))) {
      reply.code(400);
      return { error: 'slotId must be an integer when provided' };
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
      return profiles.createSendAuction(playerId, mapCid, normalizedSelections, normalizedSlotId);
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
      return profiles.listSendAuctions(playerId, includeHistory !== '0');
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'send auction list failed' };
    }
  });

  app.get<{
    Querystring: { playerId?: string };
  }>('/api/send-auction/games', async (request, reply) => {
    const { playerId } = request.query;
    if (!playerId) {
      reply.code(400);
      return { error: 'playerId is required' };
    }
    try {
      return profiles.listSendAuctionGames(playerId);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'send auction game list failed' };
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

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === 'true' || value === '1';
}

function parseAuctionHouseSortType(value: string | undefined): AuctionHouseItemSortModel | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === 'LanchTime' || value === 'Price' || value === 'MaxPrice' || value === 'StartPrice'
    ? value
    : undefined;
}
