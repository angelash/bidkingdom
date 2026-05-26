# 20260521 BidKing 最终 Playwright 截图证据清单

> 生成依据：2026-05-21 执行 `npm run test:playwright`，全量 9 个 Playwright 用例通过。截图位于 `apps/web/test-results/`，该目录按仓库规则忽略，不作为源码资产提交；需要复审时重跑命令即可再生成。

## 1. 覆盖结论

- 后台复审：桌面与移动各 1 张。
- 首页入口：桌面与移动各 1 张。
- 局外主窗口：15 个一级窗口，桌面与移动各 15 张。
- 战前整备：桌面与移动各 1 张。
- 房间大厅与局内：BattleItem 真实开局流程桌面/移动各 2 张。
- 局外动作流：商店/邮件/协会/市场/充值/礼包流程 1 张，社交/协会资源/拍场/任务流程 1 张。
- 所有截图对应用例均同时执行 raw key guard、横向溢出 guard、非滚动文本截断 guard 或真实状态变更断言。

## 2. 验证命令

```bash
npm run test:playwright
```

最近一次结果：

```text
9 passed
```

## 3. 后台复审截图

| 视口 | 截图 |
| --- | --- |
| 桌面 | `apps/web/test-results/bidking-admin-smoke.playwr-4de69-ave-no-pending-placeholders/desktop-admin-review.png` |
| 移动 | `apps/web/test-results/bidking-admin-smoke.playwr-0aa11-dit-panels-remain-reachable/mobile-admin-review.png` |

## 4. 首页与战前整备截图

| 场景 | 桌面 | 移动 |
| --- | --- | --- |
| 首页 | `apps/web/test-results/bidking-system-text.playwr-4a8d9-expose-raw-keys-or-overflow/desktop-home-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-4a8d9-expose-raw-keys-or-overflow/mobile-home-text-polish.png` |
| 战前整备 | `apps/web/test-results/bidking-system-text.playwr-49f7b-ation-hides-raw-window-keys/desktop-battle-prev-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-49f7b-ation-hides-raw-window-keys/mobile-battle-prev-text-polish.png` |

## 5. 局外主窗口截图

| 窗口 | 桌面截图 | 移动截图 |
| --- | --- | --- |
| 背包 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-package-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-package-text-polish.png` |
| 藏品百科 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-handbook-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-handbook-text-polish.png` |
| 宝铺 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-shop-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-shop-text-polish.png` |
| 委托 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-tasks-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-tasks-text-polish.png` |
| 信札 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-mail-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-mail-text-polish.png` |
| 鉴宝会 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-guild-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-guild-text-polish.png` |
| 市集 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-trade-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-trade-text-polish.png` |
| 拍场 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-auctionHouse-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-auctionHouse-text-polish.png` |
| 名士榜 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-rank-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-rank-text-polish.png` |
| 珍宝令 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-pass-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-pass-text-polish.png` |
| 钱庄 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-recharge-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-recharge-text-polish.png` |
| 同游 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-friend-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-friend-text-polish.png` |
| 章程 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-settings-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-settings-text-polish.png` |
| 呈报 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-feedback-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-feedback-text-polish.png` |
| 竞买人 | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/desktop-bidder-text-polish.png` | `apps/web/test-results/bidking-system-text.playwr-646a8-expose-raw-keys-or-overflow/mobile-bidder-text-polish.png` |

## 6. 房间大厅与局内截图

| 视口 | 房间大厅 | 局内 BattleItem |
| --- | --- | --- |
| 桌面 | `apps/web/test-results/bidking-battle-item.playwr-760e3-m-through-the-real-match-UI/desktop-room-ready-hall-polish.png` | `apps/web/test-results/bidking-battle-item.playwr-760e3-m-through-the-real-match-UI/desktop-battle-item-used.png` |
| 移动 | `apps/web/test-results/bidking-battle-item.playwr-cd432-m-through-the-real-match-UI/mobile-room-ready-hall-polish.png` | `apps/web/test-results/bidking-battle-item.playwr-cd432-m-through-the-real-match-UI/mobile-battle-item-used.png` |

## 7. 局外动作流截图

| 流程 | 截图 |
| --- | --- |
| 商店、邮件、协会、市场、充值、礼包 | `apps/web/test-results/bidking-outgame-actions.pl-b1dfb-ons-update-the-real-profile/outgame-actions-complete.png` |
| 同游、协会资源、拍场、任务奖励 | `apps/web/test-results/bidking-outgame-actions.pl-2fd9e-eward-actions-stay-playable/social-auction-task-complete.png` |

## 8. 复审口径

- 截图目录是可再生测试输出，不作为长期源文件提交。
- 文档只记录可重跑路径和覆盖口径，避免把大量测试产物混入源码。
- 若 Playwright test title 变化导致目录哈希变化，以同名截图文件和最新 `npm run test:playwright` 输出为准更新本清单。
