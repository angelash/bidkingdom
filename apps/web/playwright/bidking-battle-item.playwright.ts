import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type {
  AdminMatchDetail,
  AdminMatchListItem,
  MatchEventLog,
  PlayerProfile,
  ProfileSnapshot
} from '@bitkingdom/shared';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  expectBidKingPanelLayoutStable,
  expectBidKingPanelToHideRawText
} from './bidking-ui-guards';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://127.0.0.1:5188';
const SERVER_URL = process.env.PLAYWRIGHT_SERVER_URL ?? 'http://127.0.0.1:8787';
const BATTLE_ITEM_ID = 100102;
const viewportCases = [
  { id: 'desktop', width: 1366, height: 768 },
  { id: 'mobile', width: 390, height: 844 }
] as const;

test.describe('BidKing battle item flow', () => {
  for (const viewport of viewportCases) {
    test(`${viewport.id} equips and uses a BattleItem through the real match UI`, async ({ page, request }, testInfo) => {
      test.setTimeout(180_000);
      await runBattleItemEvidence(page, request, testInfo, viewport);
    });
  }
});

async function runBattleItemEvidence(
  page: Page,
  request: APIRequestContext,
  testInfo: TestInfo,
  viewport: (typeof viewportCases)[number]
): Promise<void> {
  const profileId = `p_pw_battle_item_${viewport.id}_${Date.now()}`;
  const playerName = viewport.id === 'mobile' ? '移动道具流掌柜' : '道具流掌柜';

  await waitForApiHealth(request);
  await apiGetOk(request, `/api/profile?playerId=${profileId}&playerName=${encodeURIComponent(playerName)}`);
  await apiPostOk(request, '/api/shop/buy', { playerId: profileId, shopItemId: 40001 });
  await apiPostOk(request, '/api/battle/items/equip', { playerId: profileId, itemIds: [BATTLE_ITEM_ID] });
  const profileSnapshot = await apiGetOk<ProfileSnapshot>(request, `/api/profile?playerId=${profileId}`);
  const profile = {
    ...profileSnapshot.profile,
    readNotices: ['1', '2', '3'],
    completedGuides: ['1', '2', '3']
  } satisfies PlayerProfile;

  await page.addInitScript(({ seededProfile, seededProfileId, seededPlayerName }) => {
    localStorage.setItem('bk_profile_id_v1', seededProfileId);
    localStorage.setItem('bk_player_name', seededPlayerName);
    localStorage.setItem('bk_profile_v2', JSON.stringify(seededProfile));
    localStorage.setItem('bk_tutorial_dismissed', '1');
    localStorage.removeItem('bk_session_v2');
  }, { seededProfile: profile, seededProfileId: profileId, seededPlayerName: playerName });

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(WEB_URL);
  const startAuctionButton = page.getByRole('button', { name: '开拍' }).first();
  await expect(startAuctionButton).toBeVisible();
  await startAuctionButton.scrollIntoViewIfNeeded();
  await startAuctionButton.click();
  await expect(page.getByText('开拍前整备')).toBeVisible();
  const confirmAuctionButton = page.getByRole('button', { name: /确认开拍/ });
  const startMatchButton = page.getByRole('button', { name: /^开始$/ });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await confirmAuctionButton.scrollIntoViewIfNeeded();
    await confirmAuctionButton.click();
    if (await startMatchButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      break;
    }
    if (!(await confirmAuctionButton.isVisible().catch(() => false))) {
      break;
    }
  }
  await expect(startMatchButton).toBeVisible({ timeout: 15_000 });
  const roomLobby = page.locator('.room-ready-hall');
  await expect(roomLobby).toBeVisible();
  await expectBidKingPanelToHideRawText(roomLobby);
  await expectBidKingPanelLayoutStable(roomLobby, `${viewport.id}:room-ready-hall`, { allowVerticalScroll: true });
  await page.screenshot({
    path: testInfo.outputPath(`${viewport.id}-room-ready-hall-polish.png`),
    fullPage: true
  });
  await startMatchButton.scrollIntoViewIfNeeded();
  await startMatchButton.click();

  const battleItemButton = page
    .locator('.battle-item-action')
    .filter({ hasText: /珍品·洛阳铁算盘|洛阳铁算盘|轮廓/ })
    .first();
  await expect(battleItemButton).toBeVisible({ timeout: 35_000 });
  await expect(battleItemButton).toContainText(/轮廓|数量|品类|估值|风险|品质/);
  await battleItemButton.scrollIntoViewIfNeeded();
  await battleItemButton.click();

  const event = await waitForBattleItemEvent(request, profileId);
  expect(event.actorId).toBe(profileId);
  const payload = event.payload as { itemId?: number; effectPlan?: { targetCount?: number; revealKind?: string; description?: string } };
  expect(payload.itemId).toBe(BATTLE_ITEM_ID);
  expect(payload.effectPlan?.targetCount).toBeGreaterThan(0);
  expect(payload.effectPlan?.revealKind).toEqual(expect.any(String));
  expect(payload.effectPlan?.description).toMatch(/洛阳铁算盘|轮廓/);
  const matchLayout = page.locator('.match-layout');
  await expect(matchLayout).toBeVisible();
  await expectBidKingPanelToHideRawText(matchLayout);
  await expectBidKingPanelLayoutStable(matchLayout, `${viewport.id}:match-layout`, { allowVerticalScroll: true });
  await expect(page.getByText('NaN')).toHaveCount(0);
  await expect(page.getByText('待开发')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath(`${viewport.id}-battle-item-used.png`),
    fullPage: true
  });
}

async function waitForBattleItemEvent(request: APIRequestContext, profileId: string): Promise<MatchEventLog> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const { matches } = await apiGetOk<{ matches: AdminMatchListItem[] }>(request, '/api/admin/matches');
    const match = matches.find((candidate) => candidate.players.some((player) => player.id === profileId));
    if (match) {
      const detail = await apiGetOk<AdminMatchDetail>(request, `/api/admin/matches/${match.matchId}`);
      const event = detail.events.find((candidate) => {
        const payload = candidate.payload as { itemId?: number } | undefined;
        return candidate.type === 'battle_item_used' && candidate.actorId === profileId && payload?.itemId === BATTLE_ITEM_ID;
      });
      if (event) {
        return event;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for battle_item_used ${BATTLE_ITEM_ID} from ${profileId}`);
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
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw lastError;
}

function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
}
