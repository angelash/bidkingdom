# BidKing 旧 Demo 逻辑残留归档

日期：2026-05-25

## 背景

当前正式核心局已经固定走 `coreMode: true`。本归档记录 2026-05-25 对旧随机/脚本货柜、旧本地模拟、旧教学辅助与旧场外演示入口的清理结果；本轮清理后，可运行链路只保留与复刻还原相符的内容。

## 2026-05-25 技能链逐项核对

1. 已按源表 `Hero.cast_type` 覆盖 20 个竞买人的第 1-5 轮触发技能。
   - 位置：`packages/match-core/src/bidking/compatRuntime.test.ts`
   - 结论：当前竞买人绑定与触发轮次未发现错位；无技能轮次缺触发或误触发。

2. 已修复“空命中目标随机兜底”的源码不一致问题。
   - 位置：`packages/match-core/src/bidking/skillTargeting.ts`
   - 源逻辑：`GetItemsBySkillTarget` 在类型/品质/已知状态没有命中时返回空列表。
   - 旧实现问题：空列表会退回随机仓库格，导致技能在不符合条件时也揭示轮廓/品质。
   - 当前处理：不再随机兜底，空命中保持空命中。

3. 已同步修复空命中后的线索/回放兜底。
   - 位置：`packages/match-core/src/bidking/compatRuntime.ts`
   - 位置：`packages/match-core/src/items.ts`
   - 位置：`packages/match-core/src/bidking/gameDataRuntime.ts`
   - 当前处理：技能或道具没有目标时记录“未命中”，不再偷拿仓库首格或全仓库做展示。

4. 已把旧手动技能测试改为当前自动技能流程。
   - 位置：`packages/match-core/tests/matchCore.test.ts`
   - 当前规则：BidKing 竞买人技能在回合开始自动触发，`useSkill` 明确拒绝手动调用。
   - UI/服务端：已移除局内手动“掌眼”按钮，旧 `useSkill` socket 入口只返回自动技能提示。

5. 已移除首轮旧仓库抽选/拍卖师公共线索流程。
   - 位置：`packages/match-core/src/match.ts`
   - 当前规则：核心局每轮统一从 `intel` 进入，再按服务端阶段机推进竞价；不再进入旧 Demo 的 `warehouse_roll` 首轮候选仓流程。

## 2026-05-25 对局流程还原度核对

### 已对齐源码/源表的部分

1. 地图与对局人数来自 `BidMap` / `RankMap`。
   - `BidMap.auction_number` 决定 2 人/4 人局。
   - `BidMap.item_count`、`Drop`、`WareHouse`、`Item` 决定仓库规模与藏品池。
   - `RankMap.role_spawn` 决定核心 Bot 可用竞买人池。

2. 回合结算线来自 `BidMap.auction_rounds_rate`。
   - 源表可玩地图统一为 `[2000,1600,1300,1100,0]`。
   - 当前换算为领先第二名 `100% / 60% / 30% / 10% / 最终轮` 的成交判定。
   - 位置：`packages/bidking-compat/src/parity.ts`、`packages/match-core/src/auction.ts`

3. 每回合竞价时间来自 `BidMap.map_time`，兜底使用 `RankMap.match_time`。
   - 当前可玩地图时间分布为 40/50/60 秒。
   - 位置：`packages/match-core/src/bidking/compatRuntime.ts`

4. 最低出价与开局资金来自源表。
   - 最低出价按 `RankMap.min_bid_range` 生成。
   - 开局资金按地图/模式源表路径生成。
   - 位置：`packages/match-core/src/bidking/compatRuntime.ts`、`packages/match-core/src/bidking/initialCashRuntime.ts`

5. 竞买人技能链已按 `Hero.cast_type` 自动触发。
   - 已覆盖 20 个竞买人的 1-5 轮触发用例。
   - 不再支持旧 Demo 的局内手动 `useSkill`。
   - 位置：`packages/match-core/src/bidking/compatRuntime.test.ts`

6. 道具技能已接入源表 `BattleItem`/`Skill`/`SkillEffect`。
   - 道具可在情报/竞价阶段触发。
   - 空命中只记录未命中，不再随机点亮仓库格。
   - 位置：`packages/match-core/src/items.ts`、`packages/match-core/src/bidking/gameDataRuntime.ts`

7. 核心局旧阶段残留已移除。
   - 已删除 `warehouse_roll`、`warehouse_selected`、`auctioneer_reveal` 共享类型、服务端推进分支和客户端 overlay。
   - 当前流程为：创建同一仓库 -> `intel` -> `auction` -> `settlement/reveal` -> 下一轮或最终结算。
   - 位置：`packages/shared/src/index.ts`、`apps/server/src/domain/battle/roomRoundRuntime.ts`、`apps/web/src/bidking/battle/BattlePanels.tsx`

8. 公共估值/私人旧线索不再从核心仓泄漏给玩家。
   - 核心仓返回空 `publicClues/privateClues`，正式情报来自地图技能、竞买人技能和道具技能。
   - `estimateHidden: true`，玩家快照不再直接显示内部估值。
   - 位置：`packages/match-core/src/bidking/compatRuntime.ts`

### 本轮清理后状态

1. 旧 Demo 拍卖引擎已从可运行核心包移除。
   - 不再保留脚本局、随机货柜、渐进揭示、旧公共/私人线索生成器。
   - `packages/config/src/data.ts` 中样例货柜、样例物品、脚本回合已清空。
   - `packages/match-core/src/clues.ts` 只保留复核结算线索的逻辑。

2. 旧 Demo 经济与社交入口已移除。
   - 删除本地支付入账、购买列表完成、DLC 解锁、添加演示好友、添加演示协会申请等服务方法和路由。
   - `Pay` / `PurchaseList` / `Dlc` 仅保留外部服务元数据边界，不再由本地接口发奖励。

3. 旧拍卖设定已从运行链路收窄。
   - 只保留 `open` / `sealed`。
   - 已清掉押金、保险、次高价、闪拍、推荐价、安全价、旧手动技能和旧过场阶段。

4. 旧样例资产已移除。
   - `container_sample_*`、`item_sample_*` 和旧谣言角色图像已从 approved/generated/manifest 链路删除。
   - 艺术校验脚本改为 `validationItems` / `--validation-set`，不再使用 sample 命名。

5. 关键词复扫结果。
   - 在 `apps/web/src`、`apps/server/src`、`apps/server/tests`、`packages/shared/src`、`packages/config/src`、`packages/match-core/src`、`tools`、`apps/web/public/art/manifest.json` 范围内，以下关键词无命中：修复、赝、假情报、押金、保险、次高价、闪拍、推荐价、安全价、旧 Demo、Demo 接口、sample 资产、旧阶段名。

### 后续只剩非旧 Demo 复刻差异

1. Bot AI 仍是本项目按源表语义写出的本地决策，不是原版服务端逐步决策字节级复刻。
2. GameData / 回放快照是结构化还原，不是原协议字节级兼容。
3. Web 前端仍是 React 复刻，不是 Unity prefab/UIWnd 原样渲染。
4. `intel` 缓冲、竞价弹窗、回合反馈的精确时序仍需要源日志继续校准。

### 验证

1. `npm run typecheck`
2. `npm test`
