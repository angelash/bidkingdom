import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import {
  expectBidKingPanelLayoutStable,
  expectBidKingPanelToHideRawText
} from './bidking-ui-guards';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://127.0.0.1:5188';
const SERVER_URL = process.env.PLAYWRIGHT_SERVER_URL ?? 'http://127.0.0.1:8787';
const ADMIN_PANEL_TIMEOUT = 60_000;

interface ReviewSnapshotContract {
  audit: {
    configRowCount: number;
    parityFailureCount: number;
  };
  restoreMatrixSummary: {
    classMatrix: {
      scriptsClassFiles: number;
      mappedClasses: number;
      unknownClasses: number;
      status: string;
    };
    tableMatrix: {
      tableCount: number;
      configRowCount: number;
      verifiedTables: number;
      manualReviewTables: number;
      closureStatus: string;
    };
    uiWndMatrix: {
      registrySource: string;
      uiWndCount: number;
      mappedWindows: number;
      unknownWindows: number;
      status: string;
    };
    acceptance: {
      totalMilestones: number;
      verifiedMilestones: number;
      equivalentClosedMilestones: number;
      finalStage: string;
      closureStatus: string;
    };
  };
  equivalentSummary: {
    verifiedTables: number;
    equivalentTables: number;
    visualSubstituteTables: number;
    serviceSimulatedTables: number;
    manualReviewTables: number;
    closureStatus: string;
    equivalentTableNames: string[];
    visualSubstituteTableNames: string[];
    serviceSimulatedTableNames: string[];
    manualReviewTableNames: string[];
  };
  equivalentBoundaries: Array<{
    table: string;
    status: string;
    reason: string;
    cleanRoomBoundary: string;
    evidence: string;
  }>;
  finalReviewChecklist: Array<{
    id: string;
    label: string;
    status: string;
    summary: string;
    evidence: string[];
  }>;
  tableMatrix: Array<{
    table: string;
    actualRows: number;
    expectedRows: number;
    equivalentStatus: string;
  }>;
  validationCommands: string[];
}

test.describe('BidKing restoration smoke', () => {
  test.setTimeout(120_000);

  test('desktop home and admin audit panels have no pending placeholders', async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(WEB_URL);
    await closeStartupDialogs(page);
    await expect(page.getByRole('button', { name: /开拍/ }).first()).toBeVisible();
    await expect(page.getByText('待开发')).toHaveCount(0);

    const audit = await apiGetOk<{ configRowCount: number; parityFailureCount: number }>(request, '/api/admin/audit');
    expect(audit.configRowCount).toBe(19687);
    expect(audit.parityFailureCount).toBe(0);

    const reviewSnapshot = await apiGetOk<ReviewSnapshotContract>(request, '/api/admin/review-snapshot');
    expect(reviewSnapshot.audit.configRowCount).toBe(19687);
    expect(reviewSnapshot.audit.parityFailureCount).toBe(0);
    expect(reviewSnapshot.tableMatrix).toHaveLength(52);
    expect(reviewSnapshot.tableMatrix.find((row) => row.table === 'UIWnd')?.actualRows).toBe(80);
    expect(reviewSnapshot.restoreMatrixSummary.classMatrix.scriptsClassFiles).toBe(1256);
    expect(reviewSnapshot.restoreMatrixSummary.classMatrix.mappedClasses).toBe(1256);
    expect(reviewSnapshot.restoreMatrixSummary.classMatrix.unknownClasses).toBe(0);
    expect(reviewSnapshot.restoreMatrixSummary.tableMatrix.tableCount).toBe(52);
    expect(reviewSnapshot.restoreMatrixSummary.tableMatrix.configRowCount).toBe(19687);
    expect(reviewSnapshot.restoreMatrixSummary.tableMatrix.manualReviewTables).toBe(0);
    expect(reviewSnapshot.restoreMatrixSummary.uiWndMatrix.uiWndCount).toBe(80);
    expect(reviewSnapshot.restoreMatrixSummary.uiWndMatrix.mappedWindows).toBe(80);
    expect(reviewSnapshot.restoreMatrixSummary.uiWndMatrix.registrySource).toBe('apps/web/src/bidking/app/windowRegistry.ts');
    expect(reviewSnapshot.restoreMatrixSummary.acceptance.totalMilestones).toBe(13);
    expect(reviewSnapshot.restoreMatrixSummary.acceptance.finalStage).toBe('E12');
    expect(reviewSnapshot.restoreMatrixSummary.acceptance.closureStatus).toBe('Equivalent Closed');
    expect(reviewSnapshot.equivalentSummary.verifiedTables).toBe(52);
    expect(reviewSnapshot.equivalentSummary.equivalentTables).toBe(44);
    expect(reviewSnapshot.equivalentSummary.visualSubstituteTables).toBe(5);
    expect(reviewSnapshot.equivalentSummary.serviceSimulatedTables).toBe(3);
    expect(reviewSnapshot.equivalentSummary.manualReviewTables).toBe(0);
    expect(reviewSnapshot.equivalentSummary.closureStatus).toBe('closed');
    expect(reviewSnapshot.equivalentSummary.equivalentTableNames).toHaveLength(44);
    expect(reviewSnapshot.equivalentSummary.visualSubstituteTableNames).toEqual([
      'Emoji',
      'Head',
      'HeroSkin',
      'LanguageListen',
      'Sound'
    ]);
    expect(reviewSnapshot.equivalentSummary.serviceSimulatedTableNames).toEqual(['Dlc', 'Pay', 'PurchaseList']);
    expect(reviewSnapshot.equivalentSummary.manualReviewTableNames).toEqual([]);
    expect(reviewSnapshot.equivalentBoundaries).toHaveLength(8);
    expect(reviewSnapshot.equivalentBoundaries.map((row) => row.table)).toEqual([
      'Dlc',
      'Emoji',
      'Head',
      'HeroSkin',
      'LanguageListen',
      'Pay',
      'PurchaseList',
      'Sound'
    ]);
    expect(reviewSnapshot.equivalentBoundaries.every((row) => row.reason && row.cleanRoomBoundary && row.evidence)).toBe(true);
    expect(reviewSnapshot.finalReviewChecklist.map((item) => item.id)).toEqual([
      'baseline-matrices',
      'config-classification',
      'clean-room-boundaries',
      'runtime-evidence',
      'validation-gates',
      'redistribution-boundary'
    ]);
    expect(reviewSnapshot.finalReviewChecklist.every((item) => item.status === 'pass')).toBe(true);
    expect(reviewSnapshot.finalReviewChecklist.every((item) => item.summary && item.evidence.length > 0)).toBe(true);
    expect(
      reviewSnapshot.equivalentSummary.equivalentTables +
        reviewSnapshot.equivalentSummary.visualSubstituteTables +
        reviewSnapshot.equivalentSummary.serviceSimulatedTables +
        reviewSnapshot.equivalentSummary.manualReviewTables
    ).toBe(reviewSnapshot.tableMatrix.length);
    expect(reviewSnapshot.validationCommands).toContain('npm run test:playwright');

    await page.goto(`${WEB_URL}/admin`);
    await expect(page.getByText('权威状态审计')).toBeVisible();
    await expect(page.getByText('配置 Parity')).toBeVisible();
    const configParityPanel = page.locator('.admin-config-panel').filter({ hasText: '配置 Parity' });
    await expect(configParityPanel.getByText('正在读取配置校验...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    await expect(configParityPanel.getByText(/44 Equivalent/)).toBeVisible();
    await expect(configParityPanel.getByText(/Manual Review 0/)).toBeVisible();
    await expect(configParityPanel.getByText(/Visual Substitute: Emoji \/ Head \/ HeroSkin/)).toBeVisible();
    await expect(configParityPanel.getByText(/Service Simulated: Dlc \/ Pay \/ PurchaseList/)).toBeVisible();
    const reviewPanel = page.locator('.admin-review-panel').filter({ hasText: '最终验收摘要' });
    await expect(reviewPanel.getByText('正在读取最终验收摘要...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    await expect(reviewPanel.getByText(/1256 类/)).toBeVisible();
    await expect(reviewPanel.getByText(/52 表/)).toBeVisible();
    await expect(reviewPanel.getByText(/80 UIWnd/)).toBeVisible();
    await expect(reviewPanel.getByText(/Manual Review 0/)).toBeVisible();
    await expect(reviewPanel.getByText(/13 阶段/)).toBeVisible();
    const checklistPanel = page.locator('.admin-review-checklist-panel').filter({ hasText: '最终复审清单' });
    await expect(checklistPanel.getByText('正在读取最终复审清单...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    await expect(checklistPanel.getByText('基线矩阵')).toBeVisible();
    await expect(checklistPanel.getByText('配置分类')).toBeVisible();
    await expect(checklistPanel.getByText('替代边界')).toBeVisible();
    await expect(checklistPanel.getByText('验证命令')).toBeVisible();
    await expect(checklistPanel.getByText('PASS')).toHaveCount(4);
    await expect(page.getByText('全局账本')).toBeVisible();
    const exportLink = page.getByRole('link', { name: '导出审查快照' });
    await expect(exportLink).toBeVisible();
    await expect(exportLink).toHaveAttribute('href', `${SERVER_URL}/api/admin/review-snapshot`);
    await expect(page.getByLabel('账本掌柜')).toBeVisible();
    await page.getByLabel('账本资源').selectOption('coins');
    await page.getByLabel('对局状态').selectOption('ended');
    await page.getByLabel('档案搜索').fill('player');
    await expect(page.getByText('NaN')).toHaveCount(0);
    await expect(page.getByText('待开发')).toHaveCount(0);
    const adminRoot = page.locator('.admin-layout');
    await expect(adminRoot).toBeVisible();
    await expectBidKingPanelToHideRawText(adminRoot);
    await expectBidKingPanelLayoutStable(adminRoot, 'desktop:admin-layout', { allowVerticalScroll: true });
    await page.screenshot({
      path: testInfo.outputPath('desktop-admin-review.png'),
      fullPage: true
    });
  });

  test('mobile admin audit panels remain reachable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB_URL}/admin`);

    await expect(page.getByText('对局后台')).toBeVisible();
    await expect(page.getByText('权威状态审计')).toBeVisible();
    await expect(page.getByText('配置 Parity')).toBeVisible();
    const configParityPanel = page.locator('.admin-config-panel').filter({ hasText: '配置 Parity' });
    await expect(configParityPanel.getByText('正在读取配置校验...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    await expect(page.getByRole('heading', { name: '最终复审清单' })).toBeVisible();
    const reviewPanel = page.locator('.admin-review-panel').filter({ hasText: '最终验收摘要' });
    await expect(reviewPanel.getByText('正在读取最终验收摘要...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    const checklistPanel = page.locator('.admin-review-checklist-panel').filter({ hasText: '最终复审清单' });
    await expect(checklistPanel.getByText('正在读取最终复审清单...')).toHaveCount(0, { timeout: ADMIN_PANEL_TIMEOUT });
    await expect(page.getByText('全局账本')).toBeVisible();
    await expect(page.getByRole('link', { name: '导出审查快照' })).toBeVisible();
    await expect(page.getByLabel('账本资源')).toBeVisible();
    await expect(page.getByLabel('档案搜索')).toBeVisible();
    await expect(page.getByText('NaN')).toHaveCount(0);
    await expect(page.getByText('待开发')).toHaveCount(0);
    const adminRoot = page.locator('.admin-layout');
    await expect(adminRoot).toBeVisible();
    await expectBidKingPanelToHideRawText(adminRoot);
    await expectBidKingPanelLayoutStable(adminRoot, 'mobile:admin-layout', { allowVerticalScroll: true });
    await page.screenshot({
      path: testInfo.outputPath('mobile-admin-review.png'),
      fullPage: true
    });
  });
});

async function closeStartupDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dialog = page.getByRole('dialog').last();
    if (!(await dialog.isVisible().catch(() => false))) {
      return;
    }
    const action = dialog.getByRole('button', { name: /取消|知道了|阅毕|稍后/ }).last();
    if (await action.isVisible().catch(() => false)) {
      await action.click();
      await page.waitForTimeout(150);
      continue;
    }
    const closeButton = page.locator('.modal-close, .notice-action').last();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }
    return;
  }
}

async function apiGetOk<T = unknown>(request: APIRequestContext, path: string): Promise<T> {
  return expectOk<T>(retryApiResponse(() => request.get(apiUrl(path))));
}

async function expectOk<T = unknown>(responsePromise: Promise<APIResponse>): Promise<T> {
  const response = await responsePromise;
  expect(response.ok(), `${response.status()} ${response.url()}`).toBe(true);
  return response.json();
}

async function retryApiResponse(run: () => Promise<APIResponse>, attempts = 3): Promise<APIResponse> {
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
