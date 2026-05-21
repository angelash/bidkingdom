# BidKing 100% 还原验收矩阵

> 生成时间：2026-05-19。2026-05-20 已更新最终收口口径：`Verified` 表示已进入自动化验证闭环；最终配置 parity 已拆分为 `44 Equivalent / 5 Visual Substitute / 3 Service Simulated / 0 Manual Review Required`，并由 review snapshot 输出 class/table/UIWnd/acceptance 四份矩阵摘要。

## M0 基线

| 项 | 当前值 | 100% 判定 | 当前状态 |
| --- | ---: | --- | --- |
| Scripts 原类映射 | 1256 | 1256 个类都有映射结论，没有 Unknown | Mapped |
| 配置表行为账本 | 52 | 52 张表都有 owner、字段解释、测试和行为状态；后台 review snapshot 无 Manual Review Required | Equivalent Closed |
| UIWnd 窗口账本 | 80 | 80 个窗口都有目标模块、层级、BGM/Blur 处理 | Mapped |

## 阶段验收

| 阶段 | 目标 | 必过证据 | 当前状态 |
| --- | --- | --- | --- |
| M0 | 基线锁定与审查账本 | class/table/uiwnd/acceptance 四份矩阵生成并纳入导航 | Verified |
| M1 | 代码结构复刻骨架 | main.tsx、roomManager.ts、profileService.ts、serverApp/routes 拆分；行为不回退 | Verified |
| M2 | Condition/Access/Reward/Constant 解释器 | 未知条件阻断；奖励统一走 ledger；解释器单测 | Verified |
| M3 | 核心竞拍深化 | BattleItem 逐道具接 SkillGroup；回放同 seed 一致 | Verified |
| M4 | 服务端权威状态与存储 | SQLite store、ledger、event、admin 审计 | Verified |
| M5 | 局外成长闭环 | 任务、成就、等级、头像、仓库、收藏柜全操作 | Verified |
| M6 | 商店票券礼包支付模拟 | 刷新池、礼包、购买列表、支付模拟完整 | Verified |
| M7 | 市场拍卖行排行 | 订单、成交、撤单、手续费、排行快照完整 | Verified |
| M8 | 协会好友地区社交 | 权限、资源、积分、好友申请、文本过滤完整 | Verified |
| M9 | 活动通行证公告引导 | 活动时间、通行证、Notice、Guide 完整 | Verified |
| M10 | 前端 100% 操作化 | 无待开发入口；桌面/移动 Playwright 通过 | Verified |
| M11 | 后台调试和最终审查 | 后台审计、截图、测试记录、缺口清零 | Equivalent Closed |
| E12 | 最终 Equivalent 收口 | review snapshot 精确锁定 52 Verified、44 Equivalent、5 Visual Substitute、3 Service Simulated、0 Manual Review Required | Equivalent Closed |

## 固定验证命令

```bash
npm run validate:bidking-compat
npm run typecheck
npm test
npm run test:playwright
npm run build -w @bitkingdom/web
```

## 2026-05-20 最终 Equivalent 收口记录

- `/api/admin/review-snapshot` 已成为最终复审契约：`verifiedTables=52`、`equivalentTables=44`、`visualSubstituteTables=5`、`serviceSimulatedTables=3`、`manualReviewTables=0`、`closureStatus=closed`。
- `restoreMatrixSummary` 已把四份基线压成可机器断言的最终摘要：`1256` 个 Scripts 类全部 mapped、`52` 表 `19687` 行闭环、`80` 个 UIWnd mapped、`13` 个阶段中 `M0-M10 Verified / M11+E12 Equivalent Closed`。
- `finalReviewChecklist` 已导出六项复审清单，并由后台“最终复审清单”面板和 Playwright 冒烟锁定。
- `20260520_BidKing100最终验收包.md` 已作为最终交付索引，集中记录复审入口、命令、例外边界和剩余处理口径。
- Visual Substitute 清单固定为 `Emoji / Head / HeroSkin / LanguageListen / Sound`，均使用自有视觉或音频提示替代，不分发原素材。
- Service Simulated 清单固定为 `Dlc / Pay / PurchaseList`，均使用本地订单/平台模拟链路，不访问真实支付或平台服务。
- `equivalentBoundaries` 已为上述 8 张表导出 reason、clean-room boundary 和 evidence，确保最终复审能看到替代原因，而不只是状态数量。
- 后续若新增表或回退等价状态，routes 测试和 Playwright 后台冒烟会直接失败，避免人工复审账本漂移。

## 100% 完成硬条件

- 52 张表全部 `Verified`，且后台 review snapshot 已给出 `44 Equivalent / 5 Visual Substitute / 3 Service Simulated / 0 Manual Review Required` 的最终结论。
- 1256 个原类全部有映射结论，没有 `Unknown`。
- 80 个 UIWnd 窗口全部进入 windowRegistry。
- 前端没有 `待开发` 入口。
- 所有经济变更进入 profile + ledger。
- 核心竞拍同 seed 可重放。
- BattleItem、SkillEffect、Condition、Reward 类型均有测试。
- 市场、协会、活动、通行证、商店、邮件、任务、成就、排行都能完整操作。
- Sound、Language、DirtyWords、Guide、UIWnd 全部进入运行层。
- 后台可审计 profile、ledger、event、match replay、config parity。
- validate、typecheck、test、build、Playwright 全部通过。

