import { expect, test, type APIRequestContext, type APIResponse, type Locator, type Page, type Request, type Response } from '@playwright/test';
import { Item, bidKingItemDisplayName, bidKingRawTableDisplayName } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileSnapshot } from '@bitkingdom/shared';
import {
  expectBidKingPanelLayoutStable,
  expectBidKingPanelToHideRawText
} from './bidking-ui-guards';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://127.0.0.1:5188';
const SERVER_URL = process.env.PLAYWRIGHT_SERVER_URL ?? 'http://127.0.0.1:8787';
const TARGET_SHOP_ITEM_ID = 10001;
const TARGET_ITEM_REF_ID = '100104';
const TARGET_ITEM_NAME = bidKingItemDisplayName(Item.find((row) => row.id === Number(TARGET_ITEM_REF_ID)) ?? {
  id: Number(TARGET_ITEM_REF_ID),
  packaged_name: '凡品军令消耗1格方件100104'
});
const TARGET_SHOP_ITEM_NAME = TARGET_ITEM_NAME;
const AUCTION_ITEM_REF_ID = '2';
const AUCTION_ITEM_NAME = bidKingItemDisplayName(Item.find((row) => row.id === Number(AUCTION_ITEM_REF_ID)) ?? {
  id: Number(AUCTION_ITEM_REF_ID),
  packaged_name: '典藏杂项道具2'
});
const FIRST_SELL_MISSION_ID = '1001101';
const GUILD_RESOURCE_ID = '1001';

test.describe('BidKing outgame action flows', () => {
  test('commerce, mail, guild, market and recharge actions update the real profile', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    const profileId = `p_pw_outgame_${Date.now()}`;
    const playerName = '局外流掌柜';

    await seedProfile(page, request, profileId, playerName);
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoSeededHome(page, profileId);

    await openPanel(page, { buttonName: /^宝铺/ });
    const shopCard = page.locator('.shop-item-card').filter({ hasText: TARGET_SHOP_ITEM_NAME }).first();
    await expect(shopCard).toBeVisible();
    await clickAndExpectProfile(page, shopCard.getByRole('button', { name: /购入/ }), '/api/shop/buy', (profile) => (
      profile.shopPurchases.some((purchase) => purchase.shopItemId === TARGET_SHOP_ITEM_ID && purchase.bought >= 1)
      && inventoryQuantity(profile, TARGET_ITEM_REF_ID) >= 1
    ), 'shop purchase');

    await openPanel(page, { selector: 'button[title="信札"]' });
    const mailCard = page.locator('.config-table-panel article').filter({ hasText: bidKingRawTableDisplayName({ id: '1001', table: 'Mail', packaged_name: '信札1001' }) }).first();
    await expect(mailCard).toBeVisible();
    await clickAndExpectProfile(page, mailCard.getByRole('button', { name: '领取' }), '/api/mail/claim', (profile) => (
      profile.mail.some((mail) => mail.templateId === '1001' && mail.claimed)
      && profile.inventory.length >= 2
    ), 'mail claim');

    await openPanel(page, { buttonName: /鉴宝会/ });
    const guildIntro = page.locator('.config-table-panel article').filter({ hasText: /未加入鉴宝会/ }).first();
    const joined = await clickAndExpectProfile(page, guildIntro.getByRole('button', { name: /加入鉴宝会/ }), '/api/guild/join', (profile) => Boolean(profile.guildMembership), 'guild join');
    const pointsBeforeDonate = joined.profile.guildMembership?.points ?? 0;
    await clickAndExpectProfile(page, page.getByRole('button', { name: '捐献1000' }), '/api/guild/donate', (profile) => (
      (profile.guildMembership?.points ?? 0) > pointsBeforeDonate
      && profile.coins < joined.profile.coins
    ), 'guild donation');

    await openPanel(page, { buttonName: /市集/ });
    await page.getByPlaceholder(/写一句寄售说明/).fill('PW局外可玩流');
    const marketCard = page.locator('.config-table-panel article').filter({ hasText: TARGET_SHOP_ITEM_NAME }).filter({ hasText: '库存' }).first();
    await expect(marketCard).toBeVisible();
    const listed = await clickAndExpectProfile(page, marketCard.getByRole('button', { name: /寄售/ }), '/api/market/order', (profile) => (
      profile.marketOrders.some((order) => order.refId === TARGET_ITEM_REF_ID && order.status === 'listed' && order.note === 'PW局外可玩流')
    ), 'market listing');
    const orderId = listed.profile.marketOrders.find((order) => order.refId === TARGET_ITEM_REF_ID && order.status === 'listed')?.id;
    expect(orderId).toBeTruthy();
    const orderCard = page.locator('.config-table-panel article').filter({ hasText: 'PW局外可玩流' }).first();
    await clickAndExpectProfile(page, orderCard.getByRole('button', { name: '成交' }), '/api/market/order/action', (profile) => (
      profile.marketOrders.some((order) => order.id === orderId && order.status === 'sold')
    ), 'market settlement');

    await openPanel(page, { buttonName: /^钱庄/ });
    const payCard = page.locator('.config-table-panel article').filter({ hasText: bidKingRawTableDisplayName({ id: '1', table: 'Pay', packaged_name: '钱庄档位1' }) }).first();
    await expect(payCard).toBeVisible();
    await clickAndExpectProfile(page, payCard.getByRole('button', { name: /立契/ }), '/api/pay/order', (profile) => (
      profile.purchaseOrders.some((order) => order.source === 'pay' && order.refId === '1' && order.status === 'created')
    ), 'pay order created');
    await clickAndExpectProfile(page, payCard.getByRole('button', { name: /入账/ }), '/api/pay/order/complete-demo', (profile) => (
      profile.purchaseOrders.some((order) => order.source === 'pay' && order.refId === '1' && order.status === 'completed')
    ), 'pay order completed');
    const giftCard = page.locator('.config-table-panel article').filter({ hasText: bidKingRawTableDisplayName({ id: '1', table: 'GiftPackage', packaged_name: '礼包1' }) }).first();
    await giftCard.scrollIntoViewIfNeeded();
    await clickAndExpectProfile(page, giftCard.getByRole('button', { name: /领取礼匣/ }), '/api/gift-package/claim', (profile) => (
      profile.claimedGiftPackages.includes('1') && inventoryQuantity(profile, '2') >= 60
    ), 'gift package claim');

    await expect(page.getByText('操作失败')).toHaveCount(0);
    await expect(page.getByText('NaN')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('outgame-actions-complete.png'),
      fullPage: true
    });
  });

  test('social, guild resource, auction and task reward actions stay playable', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    const profileId = `p_pw_social_${Date.now()}`;
    const playerName = '社交流掌柜';

    await seedProfile(page, request, profileId, playerName);
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoSeededHome(page, profileId);

    await openPanel(page, { selector: 'button[title="同游"]' });
    const friendAdded = await clickAndExpectProfile(page, page.getByRole('button', { name: /添加同游/ }), '/api/social/friend/add', (profile) => profile.friends.length === 1, 'friend add');
    const friend = friendAdded.profile.friends[0]!;
    const remarkInput = page.locator('input[aria-label^="同游备注 "]').first();
    const friendCard = page.locator('.config-table-panel article').filter({ has: remarkInput }).first();
    await expect(remarkInput, `friend remark input for ${friend.name}`).toBeVisible({ timeout: 15_000 });
    const saveRemarkButton = friendCard.getByRole('button', { name: '保存备注' });
    await remarkInput.fill('PW同游dirtywords_2_1');
    await expect(remarkInput).toHaveValue('PW同游dirtywords_2_1');
    await expect(saveRemarkButton).toBeEnabled();
    await dispatchAndExpectProfile(page, saveRemarkButton, '/api/social/friend/remark', (profile) => (
      profile.friends.some((candidate) => candidate.id === friend.id && candidate.remark === 'PW同游***')
    ), 'friend remark');
    const updatedFriendCard = page.locator('.config-table-panel article').filter({ has: remarkInput }).first();
    await dispatchAndExpectProfile(page, updatedFriendCard.getByRole('button', { name: /移出名册/ }), '/api/social/friend/remove', (profile) => profile.friends.length === 0, 'friend remove');

    await openPanel(page, { buttonName: /鉴宝会/ });
    await clickAndExpectProfile(
      page,
      page.locator('.config-table-panel article').filter({ hasText: /未加入鉴宝会/ }).first().getByRole('button', { name: /加入鉴宝会/ }),
      '/api/guild/join',
      (profile) => Boolean(profile.guildMembership),
      'guild join for resource flow'
    );
    const noticeInput = page.getByLabel(/会馆告示/);
    await noticeInput.fill('PW告示dirtywords_2_1');
    await clickAndExpectProfile(page, page.getByRole('button', { name: /保存告示/ }), '/api/guild/notice', (profile) => profile.guildMembership?.notice === 'PW告示***', 'guild notice');
    const applied = await clickAndExpectProfile(page, page.getByRole('button', { name: /新拜帖/ }), '/api/guild/application/demo', (profile) => (
      (profile.guildMembership?.pendingApplications?.length ?? 0) > 0
    ), 'guild application');
    const applicant = applied.profile.guildMembership?.pendingApplications?.[0];
    expect(applicant).toBeTruthy();
    await clickAndExpectProfile(page, page.getByRole('button', { name: new RegExp(escapeRegExp(applicant!.name)) }), '/api/guild/member/approve', (profile) => (
      profile.guildMembership?.members?.some((member) => member.playerId === applicant!.playerId && member.status === 'member') === true
      && (profile.guildMembership?.pendingApplications?.length ?? 0) === 0
    ), 'guild member approve');
    const areaResourceButton = page.getByRole('button', { name: /领取地区资源/ }).first();
    await areaResourceButton.scrollIntoViewIfNeeded();
    await clickAndExpectProfile(page, areaResourceButton, '/api/guild/area/resource/claim', (profile) => (
      (profile.guildMembership?.resources?.[GUILD_RESOURCE_ID] ?? 0) >= 1
    ), 'guild area resource claim');
    const resourceCard = page.locator('.config-table-panel article')
      .filter({ hasText: /洛阳木牌/ })
      .filter({ hasText: '领取资源' })
      .first();
    await resourceCard.scrollIntoViewIfNeeded();
    await expect(resourceCard).toContainText('已领取 1');
    await clickAndExpectProfile(page, resourceCard.getByRole('button', { name: '使用资源' }), '/api/guild/resource/use', (profile) => (
      (profile.guildMembership?.resources?.[GUILD_RESOURCE_ID] ?? 0) === 0
    ), 'guild resource use');

    await expectProfileSnapshot(await apiPostOk<ProfileSnapshot>(request, '/api/pay/order', {
      playerId: profileId,
      payId: '1'
    }), (profile) => profile.purchaseOrders.some((order) => order.source === 'pay' && order.refId === '1' && order.status === 'created'), 'auction seed pay order');
    await expectProfileSnapshot(await apiPostOk<ProfileSnapshot>(request, '/api/pay/order/complete-demo', {
      playerId: profileId,
      payId: '1'
    }), (profile) => profile.purchaseOrders.some((order) => order.source === 'pay' && order.refId === '1' && order.status === 'completed'), 'auction seed pay');
    const auctionSeed = expectProfileSnapshot(await apiPostOk<ProfileSnapshot>(request, '/api/gift-package/claim', {
      playerId: profileId,
      packageId: '1'
    }), (profile) => (
      profile.claimedGiftPackages.includes('1')
      && inventoryQuantity(profile, AUCTION_ITEM_REF_ID) >= 1
    ), 'auction item gift seed');
    await refreshPageProfile(page, auctionSeed);

    await openPanel(page, { buttonName: /拍场/ });
    await page.getByPlaceholder(/写一句寄拍说明/).fill('PW寄拍流');
    const auctionCard = page.locator('.config-table-panel article').filter({ hasText: AUCTION_ITEM_NAME }).filter({ hasText: '库存' }).first();
    await expect(auctionCard).toBeVisible();
    const listed = await clickAndExpectProfile(page, auctionCard.getByRole('button', { name: /寄拍/ }), '/api/market/order', (profile) => (
      profile.marketOrders.some((order) => order.orderType === 'auction' && order.refId === AUCTION_ITEM_REF_ID && order.status === 'listed' && order.note === 'PW寄拍流')
    ), 'auction listing');
    const auctionOrderId = listed.profile.marketOrders.find((order) => order.orderType === 'auction' && order.refId === AUCTION_ITEM_REF_ID && order.status === 'listed')?.id;
    expect(auctionOrderId).toBeTruthy();
    await clickAndExpectProfile(page, page.locator('.config-table-panel article').filter({ hasText: 'PW寄拍流' }).first().getByRole('button', { name: '成交' }), '/api/market/order/action', (profile) => (
      profile.marketOrders.some((order) => order.id === auctionOrderId && order.status === 'sold')
      && profile.missionProgress?.[FIRST_SELL_MISSION_ID]?.claimable === true
    ), 'auction settlement mission progress');

    await openPanel(page, { buttonName: /^委托/ });
    const missionRow = page.locator('.task-detail-row').filter({ hasText: `委托号 ${FIRST_SELL_MISSION_ID}` }).first();
    await expect(missionRow).toBeVisible();
    await clickAndExpectProfile(page, missionRow.getByRole('button', { name: '领取' }), '/api/mission/claim', (profile) => (
      profile.claimedMissionRewards.includes(FIRST_SELL_MISSION_ID)
      || profile.missionProgress?.[FIRST_SELL_MISSION_ID]?.claimed === true
    ), 'mission reward claim');

    await expect(page.getByText('操作失败')).toHaveCount(0);
    await expect(page.getByText('NaN')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('social-auction-task-complete.png'),
      fullPage: true
    });
  });
});

async function seedProfile(page: Page, request: APIRequestContext, profileId: string, playerName: string): Promise<ProfileSnapshot> {
  await waitForApiHealth(request);
  await apiGetOk(request, `/api/profile?playerId=${profileId}&playerName=${encodeURIComponent(playerName)}`);
  const snapshot = await apiGetOk<ProfileSnapshot>(request, `/api/profile?playerId=${profileId}`);
  const seededProfile = {
    ...snapshot.profile,
    readNotices: ['1', '2', '3', '4', '5', '6'],
    completedGuides: ['1', '2', '3', '4', '5', '6', '7', '8']
  } satisfies PlayerProfile;
  await page.addInitScript(({ seededProfile, seededProfileId, seededPlayerName }) => {
    localStorage.setItem('bk_profile_id_v1', seededProfileId);
    localStorage.setItem('bk_player_name', seededPlayerName);
    localStorage.setItem('bk_profile_v2', JSON.stringify(seededProfile));
    localStorage.setItem('bk_tutorial_dismissed', '1');
    localStorage.removeItem('bk_session_v2');
  }, { seededProfile, seededProfileId: profileId, seededPlayerName: playerName });
  return snapshot;
}

async function gotoSeededHome(page: Page, profileId: string): Promise<void> {
  await waitForHomeProfileLoad(page, profileId, () => page.goto(WEB_URL));
}

async function reloadSeededHome(page: Page, profileId: string): Promise<void> {
  await waitForHomeProfileLoad(page, profileId, () => page.reload());
}

async function waitForHomeProfileLoad(page: Page, profileId: string, load: () => Promise<unknown>): Promise<void> {
  void profileId;
  let pendingProfileRequests = 0;
  const onRequest = (request: Request): void => {
    if (isProfileGetRequest(request)) {
      pendingProfileRequests += 1;
    }
  };
  const onRequestDone = (request: Request): void => {
    if (isProfileGetRequest(request)) {
      pendingProfileRequests = Math.max(0, pendingProfileRequests - 1);
    }
  };
  page.on('request', onRequest);
  page.on('requestfinished', onRequestDone);
  page.on('requestfailed', onRequestDone);
  try {
    await load();
    await expect(page.getByRole('button', { name: /开拍/ }).first()).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect.poll(() => pendingProfileRequests, { timeout: 45_000 }).toBe(0);
    await dismissHomeOverlays(page);
    await page.waitForTimeout(500);
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onRequestDone);
    page.off('requestfailed', onRequestDone);
  }
}

async function dismissHomeOverlays(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const noticeCard = page.locator('.startup-notice-card');
    if (!(await noticeCard.isVisible().catch(() => false))) {
      break;
    }
    await noticeCard.getByRole('button').last().click();
    await expect(noticeCard).toBeHidden({ timeout: 15_000 });
  }
  const guideCard = page.locator('.guide-overlay-card');
  if (await guideCard.isVisible().catch(() => false)) {
    await guideCard.getByRole('button', { name: '完成' }).click();
    await expect(guideCard).toBeHidden({ timeout: 15_000 });
  }
}

function isProfileGetRequest(request: Request): boolean {
  if (request.method() !== 'GET') {
    return false;
  }
  try {
    return new URL(request.url()).pathname.endsWith('/api/profile');
  } catch {
    return false;
  }
}

async function openPanel(page: Page, opener: { buttonName?: RegExp; selector?: string }): Promise<void> {
  await closePanels(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const button = opener.selector
    ? page.locator(opener.selector).first()
    : page.getByRole('button', { name: opener.buttonName }).first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const panelRoot = page.locator('.detail-modal, .system-fullscreen-shell').last();
  await expect(panelRoot).toBeVisible();
  await expectCurrentOutgamePanelStable(page, `open:${String(opener.buttonName ?? opener.selector ?? 'panel')}`);
}

async function closePanels(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const closeButton = page.locator('.modal-close, .system-fullscreen-close').last();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true });
      continue;
    }
    if (!(await page.locator('.detail-modal, .system-fullscreen-shell').last().isVisible().catch(() => false))) {
      return;
    }
    await page.keyboard.press('Escape');
  }
}

async function refreshPageProfile(page: Page, snapshot: ProfileSnapshot): Promise<void> {
  await page.evaluate((profile) => {
    localStorage.setItem('bk_profile_v2', JSON.stringify(profile));
  }, snapshot.profile);
  await reloadSeededHome(page, snapshot.profile.playerId);
}

async function clickAndExpectProfile(
  page: Page,
  action: Locator,
  pathPart: string,
  predicate: (profile: PlayerProfile) => boolean,
  label: string,
  options: { force?: boolean } = {}
): Promise<ProfileSnapshot> {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => (
      candidate.request().method() === 'POST'
      && candidate.url().includes(pathPart)
    ), { timeout: 30_000 }),
    clickAction(action, options)
  ]);
  const snapshot = await profileSnapshotFromResponse(response, label);
  const expected = expectProfileSnapshot(snapshot, predicate, label);
  await expectCurrentOutgamePanelStable(page, `action:${label}`);
  return expected;
}

async function dispatchAndExpectProfile(
  page: Page,
  action: Locator,
  pathPart: string,
  predicate: (profile: PlayerProfile) => boolean,
  label: string
): Promise<ProfileSnapshot> {
  const responsePromise = page.waitForResponse((candidate) => (
    candidate.request().method() === 'POST'
    && candidate.url().includes(pathPart)
  ), { timeout: 30_000 });
  await action.dispatchEvent('click');
  const response = await responsePromise;
  const snapshot = await profileSnapshotFromResponse(response, label);
  const expected = expectProfileSnapshot(snapshot, predicate, label);
  await expectCurrentOutgamePanelStable(page, `action:${label}`);
  return expected;
}

async function expectCurrentOutgamePanelStable(page: Page, label: string): Promise<void> {
  const panelRoot = page.locator('.detail-modal, .system-fullscreen-shell').last();
  await expect(panelRoot).toBeVisible();
  await expectBidKingPanelToHideRawText(panelRoot);
  await expectBidKingPanelLayoutStable(panelRoot, `outgame:${label}`, { allowVerticalScroll: true });
}

async function clickAction(action: Locator, options: { force?: boolean }): Promise<void> {
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeEnabled();
  await action.click(options.force ? { force: true } : undefined);
}

async function profileSnapshotFromResponse(response: Response, label: string): Promise<ProfileSnapshot> {
  const payload = await response.json() as unknown;
  expect(
    response.ok() && isProfileSnapshot(payload),
    `${label}: ${response.status()} ${response.url()} ${JSON.stringify(payload).slice(0, 500)}`
  ).toBe(true);
  return payload as ProfileSnapshot;
}

function expectProfileSnapshot(
  snapshot: ProfileSnapshot,
  predicate: (profile: PlayerProfile) => boolean,
  label: string
): ProfileSnapshot {
  expect(predicate(snapshot.profile), `${label}: ${profileDebug(snapshot.profile)}`).toBe(true);
  return snapshot;
}

function isProfileSnapshot(payload: unknown): payload is ProfileSnapshot {
  return Boolean(
    payload
    && typeof payload === 'object'
    && 'profile' in payload
    && 'transactions' in payload
  );
}

function profileDebug(profile: PlayerProfile): string {
  return JSON.stringify({
    coins: profile.coins,
    friends: profile.friends.length,
    guildResources: profile.guildMembership?.resources,
    inventory: profile.inventory,
    marketOrders: profile.marketOrders,
    mission1001101: profile.missionProgress?.[FIRST_SELL_MISSION_ID],
    purchaseOrders: profile.purchaseOrders,
    shopPurchases: profile.shopPurchases
  });
}

function inventoryQuantity(profile: PlayerProfile, refId: string): number {
  return profile.inventory
    .filter((entry) => entry.refId === refId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectOk<T = unknown>(responsePromise: Promise<APIResponse>): Promise<T> {
  const response = await responsePromise;
  expect(response.ok(), `${response.status()} ${response.url()}`).toBe(true);
  return response.json();
}

async function apiGetOk<T = unknown>(request: APIRequestContext, path: string): Promise<T> {
  return expectOk<T>(retryApiResponse(() => request.get(apiUrl(path))));
}

async function apiPostOk<T = unknown>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  return expectOk<T>(retryApiResponse(() => request.post(apiUrl(path), { data })));
}

async function retryApiResponse(run: () => Promise<APIResponse>, attempts = 8): Promise<APIResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await run();
      if (response.ok() || response.status() < 500 || attempt === attempts) {
        return response;
      }
      lastError = new Error(`${response.status()} ${response.url()}`);
    } catch (error) {
      lastError = error;
    }
    await waitForApiRetry(attempt);
  }
  throw lastError;
}

function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
}

async function waitForApiHealth(request: APIRequestContext): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await request.get(apiUrl('/health'));
      if (response.ok()) {
        return;
      }
      lastError = new Error(`${response.status()} ${response.url()}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw lastError;
}

async function waitForApiRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, attempt * 750));
}
