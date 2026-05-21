import { expect, type Locator } from '@playwright/test';

export const BIDKING_RAW_TEXT_PATTERN = /(?:activity_|guide_text_|language[a-z_]*_|languagelisten_|mail_|pay_orderdesc_|pay_steamdesc_|rank_|text_[A-Za-z0-9_]+|ui_[A-Za-z0-9_]+|voice_path_|wh_[A-Za-z0-9_]+|itemName_\d+|itemDesc_\d+|tx_\d+|hero_(?:n|skin|xq|bs|bg)_[A-Za-z0-9_]+|UI\/Prefab\/|WareHouse\.|house_type|store_type|profile\.inventory|[A-Za-z]+_[A-Za-z0-9_]*_Main\b|(?:login|uimain)BGM\b|BGM_?\d+\b|\[\s*\[.*\]\s*\]|本地化文本|配置行\s+\d+，保留结构|显示文本使用本项目包装)/i;

export async function expectBidKingPanelToHideRawText(panel: Locator): Promise<void> {
  await expect(panel).not.toContainText(BIDKING_RAW_TEXT_PATTERN);
}

export async function expectBidKingPanelLayoutStable(
  panel: Locator,
  label: string,
  options: { allowVerticalScroll?: boolean } = {}
): Promise<void> {
  const layout = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const horizontalViewportOverflow = Math.round(Math.max(0, rect.right - window.innerWidth) + Math.max(0, -rect.left));
    const verticalViewportOverflow = Math.round(Math.max(0, rect.bottom - window.innerHeight) + Math.max(0, -rect.top));
    const elementOverflow = Math.max(0, element.scrollWidth - element.clientWidth);
    let textOverflow = 0;
    const offenders: Array<{ className: string; text: string; scrollWidth: number; clientWidth: number }> = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      const node = walker.currentNode as HTMLElement;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      if (node.scrollWidth <= node.clientWidth + 2 || style.overflowX === 'auto' || style.overflowX === 'scroll') {
        continue;
      }
      textOverflow += 1;
      if (offenders.length < 3) {
        offenders.push({
          className: String(node.className),
          text: (node.textContent ?? '').trim().slice(0, 80),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth
        });
      }
    }

    return { horizontalViewportOverflow, verticalViewportOverflow, elementOverflow, textOverflow, offenders };
  });

  expect(layout.horizontalViewportOverflow, `${label} horizontal viewport overflow`).toBe(0);
  if (!options.allowVerticalScroll) {
    expect(layout.verticalViewportOverflow, `${label} vertical viewport overflow`).toBe(0);
  }
  expect(layout.elementOverflow, `${label} root horizontal overflow`).toBe(0);
  expect(layout.textOverflow, `${label} text overflow: ${JSON.stringify(layout.offenders)}`).toBe(0);
}
