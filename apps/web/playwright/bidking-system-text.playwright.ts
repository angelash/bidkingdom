import { expect, test, type Page } from '@playwright/test';
import {
  expectBidKingPanelLayoutStable,
  expectBidKingPanelToHideRawText
} from './bidking-ui-guards';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://127.0.0.1:5188';

const panelChecks: Array<{
  id: string;
  buttonName?: RegExp;
  selector?: string;
}> = [
  { id: 'package', selector: 'button[title="行囊"]' },
  { id: 'handbook', buttonName: /珍宝谱/ },
  { id: 'shop', buttonName: /^宝铺/ },
  { id: 'tasks', buttonName: /^委托/ },
  { id: 'mail', selector: 'button[title="信札"]' },
  { id: 'guild', buttonName: /鉴宝会/ },
  { id: 'trade', buttonName: /市集/ },
  { id: 'auctionHouse', buttonName: /拍场/ },
  { id: 'rank', buttonName: /名士榜/ },
  { id: 'pass', buttonName: /珍宝令/ },
  { id: 'recharge', buttonName: /^钱庄/ },
  { id: 'friend', selector: 'button[title="同游"]' },
  { id: 'settings', selector: 'button[title="章程"]' },
  { id: 'feedback', buttonName: /呈报/ },
  { id: 'bidder', buttonName: /竞买人/ }
];

const viewportChecks = [
  { id: 'desktop', width: 1640, height: 900 },
  { id: 'mobile', width: 390, height: 844 }
] as const;

test.describe('BidKing system panel text polish', () => {
  test.setTimeout(240_000);

  test('home entrance does not expose raw keys or overflow', async ({ page }, testInfo) => {
    for (const viewport of viewportChecks) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(WEB_URL);
      await dismissStartupNotice(page);
      await closePanels(page);

      const homeRoot = page.locator('.bidking-home');
      await expect(homeRoot).toBeVisible();
      await expectBidKingPanelToHideRawText(homeRoot);
      await expectBidKingPanelLayoutStable(homeRoot, `${viewport.id}:home`, { allowVerticalScroll: viewport.id === 'mobile' });
      await page.screenshot({
        path: testInfo.outputPath(`${viewport.id}-home-text-polish.png`),
        fullPage: true
      });
    }
  });

  test('main outgame panels do not expose raw keys or overflow', async ({ page }, testInfo) => {
    for (const viewport of viewportChecks) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const panel of panelChecks) {
        await page.goto(WEB_URL);
        await dismissStartupNotice(page);
        await closePanels(page);
        await page.evaluate(() => window.scrollTo(0, 0));

        const opener = panel.selector
          ? page.locator(panel.selector).first()
          : page.getByRole('button', { name: panel.buttonName }).first();
        await opener.scrollIntoViewIfNeeded();
        await opener.click();
        const panelRoot = page.locator('.detail-modal, .system-fullscreen-shell').last();
        await expect(panelRoot).toBeVisible();
        await expectBidKingPanelToHideRawText(panelRoot);
        await expectBidKingPanelLayoutStable(panelRoot, `${viewport.id}:${panel.id}`);
        await page.screenshot({
          path: testInfo.outputPath(`${viewport.id}-${panel.id}-text-polish.png`),
          fullPage: true
        });
      }
    }
  });

  test('battle preparation hides raw window keys', async ({ page }, testInfo) => {
    for (const viewport of viewportChecks) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(WEB_URL);
      await dismissStartupNotice(page);
      await closePanels(page);
      await page.waitForTimeout(1_000);

      const startAuctionButton = page.getByRole('button', { name: '开拍' }).first();
      await expect(startAuctionButton).toBeVisible();
      await startAuctionButton.scrollIntoViewIfNeeded();
      await startAuctionButton.click();

      const battlePrevShell = page.locator('.battle-prev-shell');
      await expect(battlePrevShell).toBeVisible();
      await dismissGuideOverlays(page);
      await expectBidKingPanelToHideRawText(battlePrevShell);
      await expectBidKingPanelLayoutStable(battlePrevShell, `${viewport.id}:battle-prev`, { allowVerticalScroll: viewport.id === 'mobile' });
      await page.screenshot({
        path: testInfo.outputPath(`${viewport.id}-battle-prev-text-polish.png`),
        fullPage: true
      });
    }
  });
});

async function dismissStartupNotice(page: Page): Promise<void> {
  const legacyAction = page.locator('.notice-action').first();
  if (await legacyAction.isVisible().catch(() => false)) {
    await legacyAction.click();
  }

  const startupNotice = page.getByRole('dialog', { name: '启动公告' });
  if (!(await startupNotice.isVisible().catch(() => false))) {
    return;
  }
  const firstAction = startupNotice.getByRole('button').first();
  if (await firstAction.isVisible().catch(() => false)) {
    await firstAction.click();
  }
  await closePanels(page);

  await dismissGuideOverlays(page);
}

async function dismissGuideOverlays(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const guideCard = page.locator('.guide-overlay-card');
    if (!(await guideCard.isVisible().catch(() => false))) {
      return;
    }
    await guideCard.getByRole('button', { name: '完成' }).dispatchEvent('click');
    await page.waitForTimeout(250);
  }
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
