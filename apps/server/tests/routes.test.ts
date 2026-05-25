import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Activity, Item } from '@bitkingdom/bidking-compat';
import type {
  AccountSessionSnapshot,
  AdminReviewSnapshot,
  AuctionHouseBidLogListSnapshot,
  AuctionHouseItemInfoSnapshot,
  AuctionHouseItemPriceInfoListSnapshot,
  AuctionHouseLanchItemListSnapshot,
  AuctionHouseUnlockLanchSlotResponse,
  AuctionHouseTradeInfoListSnapshot,
  AuctionHouseUnlanchItemResponse,
  ExchangeCollectItemListSnapshot,
  ExchangeInfoSnapshot,
  ExchangeItemTradeInfoListSnapshot,
  ExchangeLunchItemListSnapshot,
  ExchangeTradeInfoListSnapshot,
  ExchangeUnlanchItemResponse,
  PlayerProfile,
  ProfileSnapshot,
  SendAuctionCreateResponse,
  SendAuctionGameListSnapshot,
  SendAuctionListSnapshot,
  SendAuctionRecycleResponse
} from '@bitkingdom/shared';
import { describe, expect, it } from 'vitest';
import { addInventory } from '../src/domain/profile/profileInventory';
import { createBitKingdomServer, type BitKingdomServerRuntime } from '../src/serverApp';

const equivalentTables = [
  'Access',
  'Achievement',
  'Activity',
  'Area',
  'BattleItem',
  'BidMap',
  'Cabinet',
  'Condition',
  'Constant',
  'DirtyWords',
  'Drop',
  'ErrorCode',
  'ExchangeRestock',
  'GiftPackage',
  'Guide',
  'GuildArea',
  'GuildPermissions',
  'GuildPoints',
  'GuildResources',
  'Hero',
  'Item',
  'ItemRestock',
  'ItemType',
  'Language',
  'LanguageName',
  'LevelUp',
  'Mail',
  'Map',
  'Mission',
  'Notice',
  'NumberTable',
  'Rank',
  'RankAi',
  'RankMap',
  'RankReward',
  'Shop',
  'ShopItem',
  'Sim',
  'Skill',
  'SkillEffect',
  'SkillGroup',
  'Ticket',
  'UIWnd',
  'WareHouse'
] as const;

const visualSubstituteTables = ['Emoji', 'Head', 'HeroSkin', 'LanguageListen', 'Sound'] as const;
const externalServiceTables = ['Dlc', 'Pay', 'PurchaseList'] as const;
const SEND_AUCTION_ROUTE_ITEM_ID = 1015001;

async function withRouteRuntime(testBody: (runtime: BitKingdomServerRuntime) => Promise<void>): Promise<void> {
  const previousDriver = process.env.BITKINGDOM_STORE_DRIVER;
  const previousPath = process.env.BITKINGDOM_STORE_PATH;
  process.env.BITKINGDOM_STORE_DRIVER = 'json';
  process.env.BITKINGDOM_STORE_PATH = join(mkdtempSync(join(tmpdir(), 'bitkingdom-route-store-')), 'store.json');
  const runtime = await createBitKingdomServer({ logger: false });
  try {
    await testBody(runtime);
  } finally {
    runtime.io.close();
    await runtime.app.close();
    restoreEnv('BITKINGDOM_STORE_DRIVER', previousDriver);
    restoreEnv('BITKINGDOM_STORE_PATH', previousPath);
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function resetRouteStockInventory(profile: PlayerProfile): void {
  profile.inventory = [];
  profile.stockContainers = [];
  profile.stockState = { nextBoxId: 1, nextItemNo: 1 };
  profile.settings.bidkingStockContainersV1 = true;
}

function selectRouteWarehouseStockBoxes(profile: PlayerProfile, itemCid: number, quantity: number): Array<{ stockId: number; boxId: number }> {
  const warehouse = profile.stockContainers?.find((container) => container.kind === 'warehouse');
  const boxes = warehouse?.boxes.filter((box) => box.item.cid === itemCid).slice(0, quantity) ?? [];
  if (!warehouse || boxes.length < quantity) {
    throw new Error(`仓库藏品不足：${itemCid}`);
  }
  return boxes.map((box) => ({ stockId: warehouse.stockId, boxId: box.boxId }));
}

async function createGuestAuth(
  app: BitKingdomServerRuntime['app'],
  legacyProfileId: string,
  playerName = legacyProfileId
): Promise<{ profileId: string; sessionToken: string; headers: { authorization: string } }> {
  const guest = await app.inject({
    method: 'POST',
    url: '/api/account/guest',
    payload: { deviceId: `device_${legacyProfileId}`, legacyProfileId, playerName }
  });
  const guestPayload = JSON.parse(guest.payload) as AccountSessionSnapshot;

  expect(guest.statusCode).toBe(200);
  return {
    profileId: guestPayload.account.profileId,
    sessionToken: guestPayload.sessionToken,
    headers: { authorization: `Bearer ${guestPayload.sessionToken}` }
  };
}

describe('server routes', () => {
  it('creates persisted account sessions bound to server profiles', async () => {
    await withRouteRuntime(async ({ app }) => {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/account/register',
        payload: { accountName: 'formal_user', password: 'secret123', playerName: '正式掌柜' }
      });
      const registeredPayload = JSON.parse(registered.payload) as AccountSessionSnapshot;

      expect(registered.statusCode).toBe(200);
      expect(registeredPayload.account.accountName).toBe('formal_user');
      expect(registeredPayload.account.kind).toBe('password');
      expect(registeredPayload.profile.profile.name).toBe('正式掌柜');
      expect(registeredPayload.profile.profile.mail).toEqual([]);

      const session = await app.inject({
        method: 'GET',
        url: '/api/account/session',
        headers: { authorization: `Bearer ${registeredPayload.sessionToken}` }
      });
      const sessionPayload = JSON.parse(session.payload) as AccountSessionSnapshot;

      expect(session.statusCode).toBe(200);
      expect(sessionPayload.account.profileId).toBe(registeredPayload.account.profileId);
      expect(sessionPayload.profile.profile.playerId).toBe(registeredPayload.account.profileId);

      const unauthenticatedProfile = await app.inject({
        method: 'GET',
        url: '/api/profile?playerId=p_other_profile'
      });
      expect(unauthenticatedProfile.statusCode).toBe(401);

      const mismatch = await app.inject({
        method: 'GET',
        url: '/api/profile?playerId=p_other_profile',
        headers: { authorization: `Bearer ${registeredPayload.sessionToken}` }
      });
      expect(mismatch.statusCode).toBe(403);

      const login = await app.inject({
        method: 'POST',
        url: '/api/account/login',
        payload: { accountName: 'formal_user', password: 'secret123' }
      });
      const loginPayload = JSON.parse(login.payload) as AccountSessionSnapshot;

      expect(login.statusCode).toBe(200);
      expect(loginPayload.account.profileId).toBe(registeredPayload.account.profileId);
    });
  });

  it('upgrades guest accounts without changing the bound profile', async () => {
    await withRouteRuntime(async ({ app }) => {
      const guest = await app.inject({
        method: 'POST',
        url: '/api/account/guest',
        payload: { deviceId: 'guest-device-upgrade-001', playerName: '游客掌柜' }
      });
      const guestPayload = JSON.parse(guest.payload) as AccountSessionSnapshot;
      expect(guest.statusCode).toBe(200);
      expect(guestPayload.account.kind).toBe('guest');

      const upgraded = await app.inject({
        method: 'POST',
        url: '/api/account/upgrade',
        headers: { authorization: `Bearer ${guestPayload.sessionToken}` },
        payload: { accountName: 'upgraded_user', password: 'secret123', playerName: '绑定掌柜' }
      });
      const upgradedPayload = JSON.parse(upgraded.payload) as AccountSessionSnapshot;

      expect(upgraded.statusCode).toBe(200);
      expect(upgradedPayload.account.kind).toBe('password');
      expect(upgradedPayload.account.profileId).toBe(guestPayload.account.profileId);
      expect(upgradedPayload.profile.profile.name).toBe('绑定掌柜');

      const password = await app.inject({
        method: 'POST',
        url: '/api/account/password',
        headers: { authorization: `Bearer ${upgradedPayload.sessionToken}` },
        payload: { currentPassword: 'secret123', nextPassword: 'secret456' }
      });
      expect(password.statusCode).toBe(200);

      const oldLogin = await app.inject({
        method: 'POST',
        url: '/api/account/login',
        payload: { accountName: 'upgraded_user', password: 'secret123' }
      });
      expect(oldLogin.statusCode).toBe(401);

      const newLogin = await app.inject({
        method: 'POST',
        url: '/api/account/login',
        payload: { accountName: 'upgraded_user', password: 'secret456' }
      });
      expect(newLogin.statusCode).toBe(200);

      const logoutAll = await app.inject({
        method: 'POST',
        url: '/api/account/logout-all',
        headers: { authorization: `Bearer ${upgradedPayload.sessionToken}` }
      });
      expect(logoutAll.statusCode).toBe(200);

      const expired = await app.inject({
        method: 'GET',
        url: '/api/account/session',
        headers: { authorization: `Bearer ${upgradedPayload.sessionToken}` }
      });
      expect(expired.statusCode).toBe(401);
    });
  });

  it('protects send auction routes and binds them to the account profile', async () => {
    await withRouteRuntime(async ({ app, store }) => {
      const unauthenticated = await app.inject({
        method: 'POST',
        url: '/api/send-auction',
        payload: { mapCid: 101, itemSelections: [] }
      });
      expect(unauthenticated.statusCode).toBe(401);
      const unauthenticatedGames = await app.inject({
        method: 'GET',
        url: '/api/send-auction/games'
      });
      expect(unauthenticatedGames.statusCode).toBe(401);

      const { profileId, headers } = await createGuestAuth(app, 'route_send_auction', '路由委托');
      const profile = store.state.profiles[profileId]!;
      resetRouteStockInventory(profile);
      profile.coins = 10_000;
      addInventory(profile, 'warehouse', String(SEND_AUCTION_ROUTE_ITEM_ID), 15, 'test:route:send_auction');

      const created = await app.inject({
        method: 'POST',
        url: '/api/send-auction',
        headers,
        payload: {
          slotId: 2,
          mapCid: 101,
          itemSelections: selectRouteWarehouseStockBoxes(profile, SEND_AUCTION_ROUTE_ITEM_ID, 15)
        }
      });
      const createdPayload = JSON.parse(created.payload) as ProfileSnapshot & { sourceSendAuction: SendAuctionCreateResponse };
      const auction = createdPayload.profile.sendAuctions?.[0]!;
      const unitValue = Item.find((item) => item.id === SEND_AUCTION_ROUTE_ITEM_ID)?.base_value ?? 0;

      expect(created.statusCode).toBe(200);
      expect(auction).toEqual(expect.objectContaining({
        mapCid: 101,
        slotId: 2,
        status: 'listed',
        totalValue: unitValue * 15
      }));
      expect(createdPayload.sourceSendAuction).toEqual(expect.objectContaining({
        errorCode: 0,
        sendAuctionData: expect.objectContaining({
          mapCid: 101,
          slotId: 2,
          stockData: expect.objectContaining({
            stockId: 2,
            stockCid: 2101
          })
        })
      }));
      expect(createdPayload.profile.coins).toBe(9_000);

      const listed = await app.inject({
        method: 'GET',
        url: '/api/send-auctions?includeHistory=0',
        headers
      });
      const listedPayload = JSON.parse(listed.payload) as SendAuctionListSnapshot;
      expect(listed.statusCode).toBe(200);
      expect(listedPayload.errorCode).toBe(0);
      expect(listedPayload.sendAuctionDataList).toEqual([expect.objectContaining({ slotId: 2, mapCid: 101 })]);
      expect(listedPayload.auctions).toEqual([expect.objectContaining({ id: auction.id, status: 'listed' })]);

      const recycled = await app.inject({
        method: 'POST',
        url: '/api/send-auction/action',
        headers,
        payload: { action: 'recycle', slotId: auction.slotId }
      });
      const recycledPayload = JSON.parse(recycled.payload) as ProfileSnapshot & { sourceSendAuctionRecycle: SendAuctionRecycleResponse };
      expect(recycled.statusCode).toBe(200);
      expect(recycledPayload.sourceSendAuctionRecycle).toEqual({ errorCode: 0 });
      expect(recycledPayload.profile.sendAuctions?.find((candidate) => candidate.id === auction.id)).toEqual(expect.objectContaining({
        status: 'recycled',
        finalPrice: unitValue * 15
      }));

      const games = await app.inject({
        method: 'GET',
        url: '/api/send-auction/games',
        headers
      });
      const gamesPayload = JSON.parse(games.payload) as SendAuctionGameListSnapshot;
      expect(games.statusCode).toBe(200);
      expect(gamesPayload.errorCode).toBe(0);
      expect(gamesPayload.sendAuctionGameDataList).toEqual([expect.objectContaining({
        mapCid: 101,
        gameData: expect.objectContaining({ mapId: 2101 })
      })]);
      expect(gamesPayload.games).toEqual([expect.objectContaining({
        sendAuctionId: auction.id,
        finalPrice: unitValue * 15
      })]);
      expect(gamesPayload.games[0]?.gameData.userLog.some((user) =>
        user.priceLog.at(-1)?.itemCidOrPrice === unitValue * 15
      )).toBe(true);
    });
  });

  it('exports safe admin snapshots, runs maintenance, and sends compensation mail', async () => {
    await withRouteRuntime(async ({ app, store }) => {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/account/register',
        payload: { accountName: 'ops_user', password: 'secret123', playerName: '运营掌柜' }
      });
      const registeredPayload = JSON.parse(registered.payload) as AccountSessionSnapshot;
      const playerId = registeredPayload.account.profileId;
      const authHeaders = { authorization: `Bearer ${registeredPayload.sessionToken}` };

      const exported = await app.inject({ method: 'GET', url: '/api/admin/export?includeTransactions=1' });
      const exportedPayload = JSON.parse(exported.payload) as {
        schemaVersion: number;
        accounts: Array<{ accountName: string; passwordConfigured: boolean; passwordHash?: string }>;
        sessions: Array<{ token?: string }>;
        profiles: Array<{ playerId: string }>;
      };
      expect(exported.statusCode).toBe(200);
      expect(exportedPayload.schemaVersion).toBe(2);
      expect(exportedPayload.accounts.find((account) => account.accountName === 'ops_user')?.passwordConfigured).toBe(true);
      expect(JSON.stringify(exportedPayload)).not.toContain('passwordHash');
      expect(exportedPayload.sessions.every((session) => session.token === undefined)).toBe(true);
      expect(exportedPayload.profiles.some((profile) => profile.playerId === playerId)).toBe(true);

      const compensation = await app.inject({
        method: 'POST',
        url: '/api/admin/compensation/mail',
        payload: {
          playerIds: [playerId],
          sourceKey: 'ops_compensation_test',
          title: '补偿测试',
          body: '测试补偿到账',
          rewards: [[1, 1, 321]]
        }
      });
      expect(compensation.statusCode).toBe(200);

      const profileBeforeClaim = await app.inject({
        method: 'GET',
        url: `/api/profile?playerId=${playerId}`,
        headers: authHeaders
      });
      const profileBeforeClaimPayload = JSON.parse(profileBeforeClaim.payload) as { profile: { coins: number; mail: Array<{ id: string; title: string }> } };
      const mail = profileBeforeClaimPayload.profile.mail.find((entry) => entry.title === '补偿测试');
      expect(mail).toBeDefined();

      const claimed = await app.inject({
        method: 'POST',
        url: '/api/mail/claim',
        headers: authHeaders,
        payload: { playerId, mailId: mail!.id }
      });
      const claimedPayload = JSON.parse(claimed.payload) as { profile: { coins: number } };
      expect(claimed.statusCode).toBe(200);
      expect(claimedPayload.profile.coins).toBe(profileBeforeClaimPayload.profile.coins + 321);

      store.state.accountSessions.expired_ops_session = {
        token: 'expired_ops_session',
        accountId: registeredPayload.account.accountId,
        profileId: playerId,
        createdAt: 1,
        lastSeenAt: 1,
        expiresAt: 1
      };
      const maintenance = await app.inject({
        method: 'POST',
        url: '/api/admin/maintenance/run',
        payload: {}
      });
      const maintenancePayload = JSON.parse(maintenance.payload) as { profilesRefreshed: number; prunedSessions: number };
      expect(maintenance.statusCode).toBe(200);
      expect(maintenancePayload.profilesRefreshed).toBeGreaterThan(0);
      expect(maintenancePayload.prunedSessions).toBeGreaterThanOrEqual(1);
    });
  });

  it('serves system bootstrap and config parity from modular route registration', async () => {
    await withRouteRuntime(async ({ app }) => {
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect((JSON.parse(health.payload) as { ok: boolean }).ok).toBe(true);

      const bootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap' });
      const bootstrapPayload = JSON.parse(bootstrap.payload) as { configVersion: string; system: { dirtyWordCount: number } };
      expect(bootstrap.statusCode).toBe(200);
      expect(bootstrapPayload.configVersion).toBe('bidking-compat-52');
      expect(bootstrapPayload.system.dirtyWordCount).toBeGreaterThan(0);

      const parity = await app.inject({ method: 'GET', url: '/api/admin/config-parity' });
      const parityPayload = JSON.parse(parity.payload) as {
        status: string;
        tableCount: number;
        rows: { table: string; runtimeStatus: string; equivalentStatus: string }[];
      };
      expect(parity.statusCode).toBe(200);
      expect(parityPayload.status).toBe('ok');
      expect(parityPayload.tableCount).toBe(52);
      expect(parityPayload.rows.every((row) => row.runtimeStatus === 'Verified')).toBe(true);
      expect(parityPayload.rows.some((row) => row.equivalentStatus === 'Equivalent')).toBe(true);
      expect(parityPayload.rows.some((row) => row.equivalentStatus === 'Visual Substitute')).toBe(true);
      expect(parityPayload.rows.some((row) => row.equivalentStatus === 'External Service Boundary')).toBe(true);
      const equivalentByTable = new Map(parityPayload.rows.map((row) => [row.table, row.equivalentStatus]));
      expect(parityPayload.rows.filter((row) => row.equivalentStatus === 'Equivalent')).toHaveLength(44);
      expect(parityPayload.rows.filter((row) => row.equivalentStatus === 'Visual Substitute')).toHaveLength(5);
      expect(parityPayload.rows.filter((row) => row.equivalentStatus === 'External Service Boundary')).toHaveLength(3);
      for (const table of equivalentTables) {
        expect(equivalentByTable.get(table)).toBe('Equivalent');
      }
      for (const table of visualSubstituteTables) {
        expect(equivalentByTable.get(table)).toBe('Visual Substitute');
      }
      for (const table of externalServiceTables) {
        expect(equivalentByTable.get(table)).toBe('External Service Boundary');
      }
      expect(parityPayload.rows.filter((row) => row.equivalentStatus === 'Manual Review Required')).toHaveLength(0);

      const missingProfile = await app.inject({ method: 'GET', url: '/api/profile' });
      const errorPayload = JSON.parse(missingProfile.payload) as { error: string; errorCode: string; messageKey: string };
      expect(missingProfile.statusCode).toBe(401);
      expect(errorPayload.error).toBe('session token is required');
      expect(errorPayload.errorCode).toMatch(/^CODE_/);
      expect(errorPayload.messageKey).toMatch(/^text_ErrorCode_/);

      for (const playerId of ['p_admin_profile_1', 'p_admin_profile_2', 'p_admin_profile_3']) {
        const auth = await createGuestAuth(app, playerId, playerId);
        const profile = await app.inject({
          method: 'GET',
          url: `/api/profile?playerId=${playerId}&playerName=${playerId}`,
          headers: auth.headers
        });
        expect(profile.statusCode).toBe(200);
      }
      const limitedProfiles = await app.inject({ method: 'GET', url: '/api/admin/profiles?limit=2' });
      const limitedProfilesPayload = JSON.parse(limitedProfiles.payload) as { profiles: unknown[] };
      expect(limitedProfiles.statusCode).toBe(200);
      expect(limitedProfilesPayload.profiles).toHaveLength(2);
    });
  });

  it('keeps profile and economy endpoints available after route extraction', async () => {
    await withRouteRuntime(async ({ app, store }) => {
      const auth = await createGuestAuth(app, 'p_route', '掌柜路由');
      const playerId = auth.profileId;
      const profile = await app.inject({
        method: 'GET',
        url: `/api/profile?playerId=${playerId}&playerName=%E6%8E%8C%E6%9F%9C%E8%B7%AF%E7%94%B1`,
        headers: auth.headers
      });
      const profilePayload = JSON.parse(profile.payload) as { profile: { name: string; coins: number } };
      expect(profile.statusCode).toBe(200);
      expect(profilePayload.profile.name).toBe('掌柜路由');

      const text = await app.inject({
        method: 'POST',
        url: '/api/text/validate',
        payload: { text: 'hello dirtywords_2_1' }
      });
      const textPayload = JSON.parse(text.payload) as { ok: boolean; sanitized: string };
      expect(text.statusCode).toBe(200);
      expect(textPayload.ok).toBe(false);
      expect(textPayload.sanitized).toBe('hello ***');

      const shop = await app.inject({
        method: 'POST',
        url: '/api/shop/refresh',
        headers: auth.headers,
        payload: { playerId }
      });
      const shopPayload = JSON.parse(shop.payload) as { profile: { shopRestocks: unknown[] } };
      expect(shop.statusCode).toBe(200);
      expect(shopPayload.profile.shopRestocks.length).toBeGreaterThan(0);

      const routeProfile = store.state.profiles[playerId]!;
      resetRouteStockInventory(routeProfile);
      routeProfile.coins = 20_000;
      addInventory(routeProfile, 'warehouse', '100102', 2, 'test:route:auction_house');
      const auctionOrder = await app.inject({
        method: 'POST',
        url: '/api/market/order',
        headers: auth.headers,
        payload: { playerId, refId: '100102', quantity: 1, price: 1500, orderType: 'auction' }
      });
      const auctionOrderPayload = JSON.parse(auctionOrder.payload) as ProfileSnapshot;
      const sourceUid = auctionOrderPayload.profile.marketOrders[0]?.sourceAuctionHouseLanchItemUid;
      expect(auctionOrder.statusCode).toBe(200);
      expect(sourceUid).toEqual(expect.any(Number));

      const exchangeLanch = await app.inject({
        method: 'POST',
        url: '/api/exchange/lanch-item',
        headers: auth.headers,
        payload: { playerId, itemCid: 100102, count: 1, totalPrice: 2400 }
      });
      const exchangeLanchPayload = JSON.parse(exchangeLanch.payload) as ProfileSnapshot & { sourceExchangeLanchItem: { errorCode: number; lunchItemUid: number; orderId: string } };
      const exchangeUid = exchangeLanchPayload.sourceExchangeLanchItem.lunchItemUid;
      expect(exchangeLanch.statusCode).toBe(200);
      expect(exchangeLanchPayload.sourceExchangeLanchItem).toEqual(expect.objectContaining({
        errorCode: 0,
        lunchItemUid: expect.any(Number)
      }));

      const exchangeLanchList = await app.inject({
        method: 'GET',
        url: `/api/exchange/lanch-items?playerId=${playerId}`,
        headers: auth.headers
      });
      const exchangeLanchListPayload = JSON.parse(exchangeLanchList.payload) as ExchangeLunchItemListSnapshot;
      expect(exchangeLanchList.statusCode).toBe(200);
      expect(exchangeLanchListPayload.lunchItemList[0]).toEqual(expect.objectContaining({
        lunchItemUid: exchangeUid,
        itemCid: 100102,
        itemCount: 1,
        totalPrice: 2400,
        tradeCount: 0
      }));

      const exchangeInfo = await app.inject({
        method: 'GET',
        url: '/api/exchange/info',
        headers: auth.headers
      });
      const exchangeInfoPayload = JSON.parse(exchangeInfo.payload) as ExchangeInfoSnapshot;
      expect(exchangeInfo.statusCode).toBe(200);
      expect(exchangeInfoPayload.allItemPriceInfo).toEqual([]);
      const selfScopedExchangeInfo = await app.inject({
        method: 'GET',
        url: `/api/exchange/info?playerId=${playerId}`,
        headers: auth.headers
      });
      const selfScopedExchangeInfoPayload = JSON.parse(selfScopedExchangeInfo.payload) as ExchangeInfoSnapshot;
      expect(selfScopedExchangeInfo.statusCode).toBe(200);
      expect(selfScopedExchangeInfoPayload.allItemPriceInfo).toEqual([]);

      const exchangeItemTradeInfo = await app.inject({
        method: 'GET',
        url: '/api/exchange/item-trade-info?itemCid=100102',
        headers: auth.headers
      });
      const exchangeItemTradeInfoPayload = JSON.parse(exchangeItemTradeInfo.payload) as ExchangeItemTradeInfoListSnapshot;
      expect(exchangeItemTradeInfo.statusCode).toBe(200);
      expect(exchangeItemTradeInfoPayload.tradeInfoList).toEqual([]);
      const selfScopedExchangeItemTradeInfo = await app.inject({
        method: 'GET',
        url: `/api/exchange/item-trade-info?itemCid=100102&playerId=${playerId}`,
        headers: auth.headers
      });
      const selfScopedExchangeItemTradeInfoPayload = JSON.parse(selfScopedExchangeItemTradeInfo.payload) as ExchangeItemTradeInfoListSnapshot;
      expect(selfScopedExchangeItemTradeInfo.statusCode).toBe(200);
      expect(selfScopedExchangeItemTradeInfoPayload.tradeInfoList).toEqual([]);

      store.state.profiles[playerId]!.marketOrders.find((order) => order.id === exchangeLanchPayload.sourceExchangeLanchItem.orderId)!.expiresAt = Date.now() - 1;
      const exchangeReLanch = await app.inject({
        method: 'POST',
        url: '/api/exchange/lanch-item',
        headers: auth.headers,
        payload: { playerId, reLanchItemUid: exchangeUid }
      });
      expect(exchangeReLanch.statusCode).toBe(200);
      expect(JSON.parse(exchangeReLanch.payload).sourceExchangeLanchItem).toEqual(expect.objectContaining({
        errorCode: 0,
        lunchItemUid: exchangeUid,
        reLanchItemUid: exchangeUid
      }));

      store.state.profiles[playerId]!.marketOrders.find((order) => order.id === exchangeLanchPayload.sourceExchangeLanchItem.orderId)!.expiresAt = Date.now() - 1;
      const exchangeUnlanch = await app.inject({
        method: 'POST',
        url: '/api/exchange/unlanch-item',
        headers: auth.headers,
        payload: { playerId, itemUid: exchangeUid }
      });
      const exchangeUnlanchPayload = JSON.parse(exchangeUnlanch.payload) as ProfileSnapshot & { sourceExchangeUnlanchItem: ExchangeUnlanchItemResponse };
      expect(exchangeUnlanch.statusCode).toBe(200);
      expect(exchangeUnlanchPayload.sourceExchangeUnlanchItem).toEqual({
        errorCode: 0,
        itemUid: exchangeUid,
        orderId: exchangeLanchPayload.sourceExchangeLanchItem.orderId
      });
      expect(exchangeUnlanchPayload.profile.marketOrders.find((order) => order.id === exchangeLanchPayload.sourceExchangeLanchItem.orderId)?.status).toBe('expired');

      const exchangeBuyLanch = await app.inject({
        method: 'POST',
        url: '/api/exchange/lanch-item',
        headers: auth.headers,
        payload: { playerId, itemCid: 100102, count: 1, totalPrice: 1800 }
      });
      const exchangeBuyLanchPayload = JSON.parse(exchangeBuyLanch.payload) as ProfileSnapshot & { sourceExchangeLanchItem: { errorCode: number; orderId: string } };
      expect(exchangeBuyLanch.statusCode).toBe(200);
      expect(exchangeBuyLanchPayload.sourceExchangeLanchItem).toEqual(expect.objectContaining({ errorCode: 0 }));

      const exchangeBuyerAuth = await createGuestAuth(app, 'p_route_exchange_buyer', '路由交易买家');
      store.state.profiles[exchangeBuyerAuth.profileId]!.level = 25;
      const buyerScopedExchangeInfo = await app.inject({
        method: 'GET',
        url: '/api/exchange/info',
        headers: exchangeBuyerAuth.headers
      });
      const buyerScopedExchangeInfoPayload = JSON.parse(buyerScopedExchangeInfo.payload) as ExchangeInfoSnapshot;
      expect(buyerScopedExchangeInfo.statusCode).toBe(200);
      expect(buyerScopedExchangeInfoPayload.allItemPriceInfo).toEqual([
        { itemCid: 100102, price: 1800 }
      ]);
      const buyerScopedExchangeItemTradeInfo = await app.inject({
        method: 'GET',
        url: '/api/exchange/item-trade-info?itemCid=100102',
        headers: exchangeBuyerAuth.headers
      });
      const buyerScopedExchangeItemTradeInfoPayload = JSON.parse(buyerScopedExchangeItemTradeInfo.payload) as ExchangeItemTradeInfoListSnapshot;
      expect(buyerScopedExchangeItemTradeInfo.statusCode).toBe(200);
      expect(buyerScopedExchangeItemTradeInfoPayload.tradeInfoList).toEqual([
        { price: 1800, peopleCount: 1 }
      ]);
      const exchangeBuy = await app.inject({
        method: 'POST',
        url: '/api/exchange/buy-item',
        headers: exchangeBuyerAuth.headers,
        payload: { playerId: exchangeBuyerAuth.profileId, itemCid: 100102, itemCount: 1, estimatePrice: 1800 }
      });
      const exchangeBuyPayload = JSON.parse(exchangeBuy.payload) as ProfileSnapshot & { sourceExchangeBuyItem: { errorCode: number; itemCid: number; itemCount: number; estimatePrice: number } };
      expect(exchangeBuy.statusCode).toBe(200);
      expect(exchangeBuyPayload.sourceExchangeBuyItem).toEqual({
        errorCode: 0,
        itemCid: 100102,
        itemCount: 1,
        estimatePrice: 1800
      });

      const exchangeTradeInfoIn = await app.inject({
        method: 'GET',
        url: `/api/exchange/trade-info?playerId=${exchangeBuyerAuth.profileId}`,
        headers: exchangeBuyerAuth.headers
      });
      const exchangeTradeInfoInPayload = JSON.parse(exchangeTradeInfoIn.payload) as ExchangeTradeInfoListSnapshot;
      expect(exchangeTradeInfoIn.statusCode).toBe(200);
      expect(exchangeTradeInfoInPayload.tradeInfoInList).toEqual([
        expect.objectContaining({ itemCid: 100102, itemCount: 1, price: 1800 })
      ]);

      const exchangeTradeInfoOut = await app.inject({
        method: 'GET',
        url: `/api/exchange/trade-info?playerId=${playerId}`,
        headers: auth.headers
      });
      const exchangeTradeInfoOutPayload = JSON.parse(exchangeTradeInfoOut.payload) as ExchangeTradeInfoListSnapshot;
      expect(exchangeTradeInfoOut.statusCode).toBe(200);
      expect(exchangeTradeInfoOutPayload.tradeInfoOutList).toEqual([
        expect.objectContaining({ itemCid: 100102, itemCount: 1, price: 1800 })
      ]);

      const exchangeCollect = await app.inject({
        method: 'POST',
        url: '/api/exchange/collect-item',
        headers: auth.headers,
        payload: { playerId, itemCid: 100102 }
      });
      const exchangeCollectPayload = JSON.parse(exchangeCollect.payload) as ProfileSnapshot & { sourceExchangeCollectItem: { errorCode: number; itemCid: number } };
      expect(exchangeCollect.statusCode).toBe(200);
      expect(exchangeCollectPayload.sourceExchangeCollectItem).toEqual({
        errorCode: 0,
        itemCid: 100102
      });
      expect(exchangeCollectPayload.profile.exchangeCollections).toEqual([100102]);

      const exchangeCollectItems = await app.inject({
        method: 'GET',
        url: `/api/exchange/collect-items?playerId=${playerId}`,
        headers: auth.headers
      });
      const exchangeCollectItemsPayload = JSON.parse(exchangeCollectItems.payload) as ExchangeCollectItemListSnapshot;
      expect(exchangeCollectItems.statusCode).toBe(200);
      expect(exchangeCollectItemsPayload.collectItemList).toEqual([100102]);

      const exchangeUncollect = await app.inject({
        method: 'POST',
        url: '/api/exchange/uncollect-item',
        headers: auth.headers,
        payload: { playerId, itemCid: 100102 }
      });
      const exchangeUncollectPayload = JSON.parse(exchangeUncollect.payload) as ProfileSnapshot & { sourceExchangeUncollectItem: { errorCode: number; itemCid: number } };
      expect(exchangeUncollect.statusCode).toBe(200);
      expect(exchangeUncollectPayload.sourceExchangeUncollectItem).toEqual({
        errorCode: 0,
        itemCid: 100102
      });
      expect(exchangeUncollectPayload.profile.exchangeCollections).toEqual([]);

      const auctionLanchList = await app.inject({
        method: 'GET',
        url: `/api/auction-house/lanch-items?playerId=${playerId}`,
        headers: auth.headers
      });
      const auctionLanchListPayload = JSON.parse(auctionLanchList.payload) as AuctionHouseLanchItemListSnapshot;
      expect(auctionLanchList.statusCode).toBe(200);
      expect(auctionLanchListPayload.lanchItemList[0]).toEqual(expect.objectContaining({
        lanchItemUid: sourceUid,
        itemCid: 100102,
        price: 0,
        startPrice: 1500,
        count: 1
      }));

      const auctionSlotUnlock = await app.inject({
        method: 'POST',
        url: '/api/auction-house/unlock-lanch-slot',
        headers: auth.headers,
        payload: { playerId, unlockCount: 1 }
      });
      const auctionSlotUnlockPayload = JSON.parse(auctionSlotUnlock.payload) as ProfileSnapshot & { sourceAuctionHouseUnlockLanchSlot: AuctionHouseUnlockLanchSlotResponse };
      expect(auctionSlotUnlock.statusCode).toBe(200);
      expect(auctionSlotUnlockPayload.sourceAuctionHouseUnlockLanchSlot).toEqual({
        errorCode: 0,
        unlockCount: 1,
        cost: 50,
        lanchMax: auctionLanchListPayload.lanchMax + 1
      });

      const invalidAuctionSlotUnlock = await app.inject({
        method: 'POST',
        url: '/api/auction-house/unlock-lanch-slot',
        headers: auth.headers,
        payload: { playerId, unlockCount: 0 }
      });
      expect(invalidAuctionSlotUnlock.statusCode).toBe(400);

      const auctionItems = await app.inject({
        method: 'GET',
        url: '/api/auction-house/items?itemCid=100102&sortType=StartPrice&page=1&pageSize=5',
        headers: auth.headers
      });
      const auctionItemsPayload = JSON.parse(auctionItems.payload) as AuctionHouseItemInfoSnapshot;
      expect(auctionItems.statusCode).toBe(200);
      expect(auctionItemsPayload.itemInfoList[0]?.lanchItemUid).toBe(sourceUid);

      const auctionItemPriceInfo = await app.inject({
        method: 'GET',
        url: '/api/auction-house/item-price-info',
        headers: auth.headers
      });
      const auctionItemPriceInfoPayload = JSON.parse(auctionItemPriceInfo.payload) as AuctionHouseItemPriceInfoListSnapshot;
      expect(auctionItemPriceInfo.statusCode).toBe(200);
      expect(auctionItemPriceInfoPayload.allAuctionHouseItemPriceInfo).toEqual([
        expect.objectContaining({
          itemCid: 100102,
          avgPrice: 0,
          count: 1
        })
      ]);

      const bidderAuth = await createGuestAuth(app, 'p_route_auction_bidder', '路由竞拍人');
      const auctionBid = await app.inject({
        method: 'POST',
        url: '/api/auction-house/bid',
        headers: bidderAuth.headers,
        payload: { playerId: bidderAuth.profileId, itemUid: sourceUid, price: 2_000 }
      });
      const auctionBidPayload = JSON.parse(auctionBid.payload) as ProfileSnapshot & { sourceAuctionHouseBidPrice: { errorCode: number; price: number } };
      expect(auctionBid.statusCode).toBe(200);
      expect(auctionBidPayload.sourceAuctionHouseBidPrice).toEqual(expect.objectContaining({ errorCode: 0, price: 2_000 }));
      const bidderCoinsAfterBid = auctionBidPayload.profile.coins;

      const auctionBidLogs = await app.inject({
        method: 'GET',
        url: `/api/auction-house/bid-logs?playerId=${bidderAuth.profileId}`,
        headers: bidderAuth.headers
      });
      const auctionBidLogsPayload = JSON.parse(auctionBidLogs.payload) as AuctionHouseBidLogListSnapshot;
      expect(auctionBidLogs.statusCode).toBe(200);
      expect(auctionBidLogsPayload.bidLogList[0]).toEqual(expect.objectContaining({
        bidPrice: 2_000,
        lanchItem: expect.objectContaining({ lanchItemUid: sourceUid, maxPrice: 2_000 })
      }));

      const emptyAuctionTradeInfo = await app.inject({
        method: 'GET',
        url: `/api/auction-house/trade-info?playerId=${bidderAuth.profileId}`,
        headers: bidderAuth.headers
      });
      const emptyAuctionTradeInfoPayload = JSON.parse(emptyAuctionTradeInfo.payload) as AuctionHouseTradeInfoListSnapshot;
      expect(emptyAuctionTradeInfo.statusCode).toBe(200);
      expect(emptyAuctionTradeInfoPayload).toEqual(expect.objectContaining({
        errorCode: 0,
        tradeInfoInList: [],
        tradeInfoOutList: []
      }));

      const auctionUnlanch = await app.inject({
        method: 'POST',
        url: '/api/auction-house/unlanch-item',
        headers: auth.headers,
        payload: { playerId, itemUid: sourceUid }
      });
      const auctionUnlanchPayload = JSON.parse(auctionUnlanch.payload) as ProfileSnapshot & { sourceAuctionHouseUnlanchItem: AuctionHouseUnlanchItemResponse };
      expect(auctionUnlanch.statusCode).toBe(200);
      expect(auctionUnlanchPayload.sourceAuctionHouseUnlanchItem).toEqual(expect.objectContaining({ errorCode: 0, itemUid: sourceUid }));
      expect(auctionUnlanchPayload.profile.marketOrders.find((order) => order.id === auctionOrderPayload.profile.marketOrders[0]?.id)?.status).toBe('cancelled');
      expect(store.state.profiles[bidderAuth.profileId]?.coins).toBe(bidderCoinsAfterBid + 2_000);

      const activity = await app.inject({
        method: 'GET',
        url: `/api/activity/progress?playerId=${playerId}`,
        headers: auth.headers
      });
      const activityPayload = JSON.parse(activity.payload) as { activities: unknown[]; redPointCount: number };
      expect(activity.statusCode).toBe(200);
      expect(activityPayload.activities.length).toBeGreaterThan(0);
      expect(activityPayload.redPointCount).toBeGreaterThanOrEqual(0);

      const friendId = 'route_friend_1';
      routeProfile.friends.push({
        id: friendId,
        name: '路由好友',
        headId: '120000',
        areaId: '101',
        createdAt: Date.now()
      });

      const friendRemark = await app.inject({
        method: 'POST',
        url: '/api/social/friend/remark',
        headers: auth.headers,
        payload: { playerId, friendId, remark: 'friend dirtywords_2_1' }
      });
      const friendRemarkPayload = JSON.parse(friendRemark.payload) as { profile: { friends: Array<{ remark?: string }> } };
      expect(friendRemark.statusCode).toBe(200);
      expect(friendRemarkPayload.profile.friends[0]?.remark).toBe('friend ***');

      const guild = await app.inject({
        method: 'POST',
        url: '/api/guild/join',
        headers: auth.headers,
        payload: { playerId }
      });
      const guildPayload = JSON.parse(guild.payload) as { profile: { guildMembership?: { areaId: string; resources?: Record<string, number> } } };
      expect(guild.statusCode).toBe(200);
      const areaId = guildPayload.profile.guildMembership!.areaId;

      const areaResource = await app.inject({
        method: 'POST',
        url: '/api/guild/area/resource/claim',
        headers: auth.headers,
        payload: { playerId, areaId }
      });
      const areaResourcePayload = JSON.parse(areaResource.payload) as { profile: { guildMembership?: { resources?: Record<string, number> } } };
      expect(areaResource.statusCode).toBe(200);
      expect(Object.values(areaResourcePayload.profile.guildMembership?.resources ?? {}).some((value) => value > 0)).toBe(true);

      const applicantId = 'route_applicant_1';
      routeProfile.guildMembership!.pendingApplications = [{
        playerId: applicantId,
        name: '路由申请人',
        roleId: '3',
        areaId,
        points: 0,
        status: 'pending',
        requestedAt: Date.now()
      }];

      const guildApprove = await app.inject({
        method: 'POST',
        url: '/api/guild/member/approve',
        headers: auth.headers,
        payload: { playerId, applicantId }
      });
      const guildApprovePayload = JSON.parse(guildApprove.payload) as { profile: { guildMembership?: { members?: Array<{ playerId: string }> } } };
      expect(guildApprove.statusCode).toBe(200);
      expect(guildApprovePayload.profile.guildMembership?.members?.some((member) => member.playerId === applicantId)).toBe(true);

      const guildKick = await app.inject({
        method: 'POST',
        url: '/api/guild/member/kick',
        headers: auth.headers,
        payload: { playerId, memberId: applicantId }
      });
      const guildKickPayload = JSON.parse(guildKick.payload) as { profile: { guildMembership?: { members?: Array<{ playerId: string }> } } };
      expect(guildKick.statusCode).toBe(200);
      expect(guildKickPayload.profile.guildMembership?.members?.some((member) => member.playerId === applicantId)).toBe(false);

      const guildNotice = await app.inject({
        method: 'POST',
        url: '/api/guild/notice',
        headers: auth.headers,
        payload: { playerId, notice: 'guild dirtywords_1_1' }
      });
      const guildNoticePayload = JSON.parse(guildNotice.payload) as { profile: { guildMembership?: { notice?: string } } };
      expect(guildNotice.statusCode).toBe(200);
      expect(guildNoticePayload.profile.guildMembership?.notice).toBe('guild ***');

      const review = await app.inject({ method: 'GET', url: '/api/admin/review-snapshot' });
      const reviewPayload = JSON.parse(review.payload) as AdminReviewSnapshot;
      expect(review.statusCode).toBe(200);
      expect(reviewPayload.audit.profileCount).toBeGreaterThan(0);
      expect(reviewPayload.audit.activityAuditRows.length).toBeGreaterThan(0);
      expect(reviewPayload.audit.activityAuditRows[0]?.activityId).toBeTruthy();
      expect(reviewPayload.audit.activityAuditRows[0]?.averageProgressPercent).toBeGreaterThanOrEqual(0);
      expect(reviewPayload.audit.activityClaimableCount).toBeGreaterThanOrEqual(0);
      expect(reviewPayload.audit.activityRedPointCount).toBeGreaterThanOrEqual(0);
      expect(reviewPayload.configParity.tableCount).toBe(52);
      expect(reviewPayload.tableMatrix).toHaveLength(52);
      expect(reviewPayload.restoreMatrixSummary.classMatrix).toMatchObject({
        scriptsClassFiles: 1256,
        mappedClasses: 1256,
        unknownClasses: 0,
        status: 'Mapped'
      });
      expect(reviewPayload.restoreMatrixSummary.tableMatrix).toMatchObject({
        tableCount: 52,
        configRowCount: 19687,
        verifiedTables: 52,
        manualReviewTables: 0,
        closureStatus: 'closed'
      });
      expect(reviewPayload.restoreMatrixSummary.uiWndMatrix).toMatchObject({
        uiWndCount: 80,
        mappedWindows: 80,
        unknownWindows: 0,
        registrySource: 'apps/web/src/bidking/app/windowRegistry.ts'
      });
      expect(reviewPayload.restoreMatrixSummary.acceptance).toMatchObject({
        totalMilestones: 13,
        verifiedMilestones: 11,
        equivalentClosedMilestones: 2,
        finalStage: 'E12',
        closureStatus: 'Equivalent Closed'
      });
      expect(reviewPayload.finalReviewChecklist.map((item) => item.id)).toEqual([
        'baseline-matrices',
        'config-classification',
        'clean-room-boundaries',
        'runtime-evidence',
        'validation-gates',
        'redistribution-boundary'
      ]);
      expect(reviewPayload.finalReviewChecklist.every((item) => item.status === 'pass')).toBe(true);
      expect(reviewPayload.finalReviewChecklist.every((item) => item.summary && item.evidence.length > 0)).toBe(true);
      expect(reviewPayload.equivalentSummary.verifiedTables).toBe(52);
      expect(reviewPayload.equivalentSummary.equivalentTables).toBe(44);
      expect(reviewPayload.equivalentSummary.visualSubstituteTables).toBe(5);
      expect(reviewPayload.equivalentSummary.externalServiceTables).toBe(3);
      expect(reviewPayload.equivalentSummary.manualReviewTables).toBe(0);
      expect(reviewPayload.equivalentSummary.closureStatus).toBe('closed');
      expect(reviewPayload.equivalentSummary.equivalentTableNames).toEqual([...equivalentTables]);
      expect(reviewPayload.equivalentSummary.visualSubstituteTableNames).toEqual([...visualSubstituteTables]);
      expect(reviewPayload.equivalentSummary.externalServiceTableNames).toEqual([...externalServiceTables]);
      expect(reviewPayload.equivalentSummary.manualReviewTableNames).toEqual([]);
      expect(reviewPayload.equivalentBoundaries.map((row) => row.table)).toEqual([
        'Dlc',
        'Emoji',
        'Head',
        'HeroSkin',
        'LanguageListen',
        'Pay',
        'PurchaseList',
        'Sound'
      ]);
      expect(reviewPayload.equivalentBoundaries.every((row) => row.reason && row.cleanRoomBoundary && row.evidence)).toBe(true);
      expect(reviewPayload.equivalentBoundaries.filter((row) => row.status === 'Visual Substitute')).toHaveLength(5);
      expect(reviewPayload.equivalentBoundaries.filter((row) => row.status === 'External Service Boundary')).toHaveLength(3);
      expect(reviewPayload.validationCommands).toContain('npm run validate:bidking-compat');
    });
  });

  it('filters admin ledger by player id for audit panels', async () => {
    await withRouteRuntime(async ({ app, profiles }) => {
      const activity = Activity.find((row) => row.columns[12]?.trim()) ?? Activity[0]!;
      profiles.getOrCreateProfile('p_ledger_left', '账本左');
      profiles.claimActivityReward('p_ledger_left', activity.id);
      profiles.buyShopItem('p_ledger_left', 40001);
      profiles.joinGuild('p_ledger_left');
      profiles.claimActivityReward('p_ledger_right', activity.id);

      const allLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?limit=200' });
      const allPayload = JSON.parse(allLedger.payload) as { transactions: { playerId: string }[] };
      expect(allLedger.statusCode).toBe(200);
      expect(allPayload.transactions.some((transaction) => transaction.playerId === 'p_ledger_left')).toBe(true);
      expect(allPayload.transactions.some((transaction) => transaction.playerId === 'p_ledger_right')).toBe(true);

      const filteredLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?playerId=p_ledger_left&limit=200' });
      const filteredPayload = JSON.parse(filteredLedger.payload) as { transactions: { playerId: string }[] };
      expect(filteredLedger.statusCode).toBe(200);
      expect(filteredPayload.transactions.length).toBeGreaterThan(0);
      expect(filteredPayload.transactions.every((transaction) => transaction.playerId === 'p_ledger_left')).toBe(true);

      const shopLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?source=shop&limit=200' });
      const shopPayload = JSON.parse(shopLedger.payload) as { transactions: { sourceId: string; reason: string }[] };
      expect(shopLedger.statusCode).toBe(200);
      expect(shopPayload.transactions.length).toBeGreaterThan(0);
      expect(shopPayload.transactions.every((transaction) => transaction.sourceId.startsWith('shop:') || transaction.sourceId.startsWith('shop_') || transaction.reason.startsWith('shop_'))).toBe(true);

      const activityLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?source=activity&query=activity%3A&limit=200' });
      const activityPayload = JSON.parse(activityLedger.payload) as { transactions: { sourceId: string; reason: string }[] };
      expect(activityLedger.statusCode).toBe(200);
      expect(activityPayload.transactions.length).toBeGreaterThan(0);
      expect(activityPayload.transactions.every((transaction) => transaction.sourceId.startsWith('activity:') || transaction.reason.startsWith('activity_'))).toBe(true);

      const guildLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?source=guild&limit=200' });
      const guildPayload = JSON.parse(guildLedger.payload) as { transactions: { sourceId: string; reason: string }[] };
      expect(guildLedger.statusCode).toBe(200);
      expect(guildPayload.transactions.length).toBeGreaterThan(0);
      expect(guildPayload.transactions.every((transaction) => transaction.sourceId.startsWith('guild_') || transaction.reason.startsWith('guild_'))).toBe(true);

      const coinLedger = await app.inject({ method: 'GET', url: '/api/admin/ledger?resource=coins&limit=200' });
      const coinPayload = JSON.parse(coinLedger.payload) as { transactions: { resource: string }[] };
      expect(coinLedger.statusCode).toBe(200);
      expect(coinPayload.transactions.length).toBeGreaterThan(0);
      expect(coinPayload.transactions.every((transaction) => transaction.resource === 'coins')).toBe(true);
    });
  });
});
