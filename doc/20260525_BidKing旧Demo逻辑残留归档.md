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
   - `RankMap.role_spawn` 决定核心局可用竞买人池。

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

### 可还原口径调整

本节从 2026-05-26 起改为“只跟进本地已有源码/源表/协议证据可还原的内容”。

## 2026-05-26 可还原范围复核与推进

### 可作为 100% 复刻依据的本地证据

1. 源表：`BidMap`、`RankMap`、`Hero`、`Skill`、`SkillEffect`、`BattleItem`、`RankAi`。
2. 客户端反编译链路：`Battle_Handler.cs`、`Battle_Main.cs`、`Battle_InputDevice.cs`、`Protodata/GameData.cs`。
3. 随客户端带出的演示服务端：`GameServerDemo/ServerHandler.cs`、`GameServerDemo/Utils.cs`。
4. 可落地边界：回合开始、技能触发、竞价倒计时字段、出价倍率按钮、GameData 字段单位、仓库/技能/道具可见信息。

### 本轮已推进到源码一致的项目

1. 首轮旧仓库抽选/唱牌官情报阶段彻底删除。
   - 源依据：`GameServerDemo.ServerHandler.EnterRound()` 直接发送 `S2C_OnRoundStart`，客户端 `Battle_Handler.S2C_OnRoundStart(GameData)` 进入回合处理；无 `warehouse_roll` / `warehouse_selected` / `auctioneer_reveal` 这组三段正式协议。
   - 当前实现：共享类型、核心状态、服务端阶段机、前端 overlay 均已删除旧阶段。
   - 位置：`packages/shared/src/index.ts`、`packages/match-core/src/match.ts`、`apps/server/src/domain/battle/roomRoundRuntime.ts`、`apps/web/src/bidking/battle/BattlePanels.tsx`

2. `GameData.nextRoundTime` / `serverTime` 改为源协议单位。
   - 源依据：`Battle_Handler.SyncTime()` 使用 `ServerTime * 1000` 校时；`Battle_Main.OnNewRound()` 用 `NextRoundTime.GetLocalTime()` 与 `TimerTool.ServerTime.GetLocalTime()` 计算倒计时，因此两者都是 Unix 秒。
   - 当前实现：`serverTime` 输出 Unix 秒；`nextRoundTime` 输出本轮竞价截止 Unix 秒，并在进入 `auction` 后保留精确 `auctionEndsAt`，不再把当前 UI 阶段结束时间误写成回合竞价截止。
   - 位置：`packages/match-core/src/bidking/gameDataRuntime.ts`、`packages/match-core/src/match.ts`、`packages/match-core/src/types.ts`

3. 出价倍率按钮改为按源成交线逐轮变化。
   - 源依据：`Battle_Main` 每轮 `rate = auction_rounds_rate[round - 1] * 0.001f`，`Battle_InputDevice.SetRate()` 显示 `x2.0 / x1.6 / x1.3 / x1.1 / x0.0`。
   - 当前实现：出价面板倍率从固定 `x2.0` 改为按轮次 `x2.0 / x1.6 / x1.3 / x1.1`，最终轮禁用倍率按钮并提示成交线。
   - 位置：`apps/web/src/bidking/battle/BattlePanels.tsx`、`apps/web/src/bidking/battle/useBidComposerActions.ts`

4. 出价面板的 `0` 按源逻辑作为停手/弃权入口。
   - 源依据：`Battle_InputDevice.ChujiaClick()` 中 `price == 0` 走 `C2S_Qiquan()`；当前服务端 `submitBid(0)` 已映射到 `passAuction()`。
   - 当前实现：出价草稿允许 `0` 通过确认，不再被前端校验拦截。
   - 位置：`apps/web/src/bidking/battle/useBidComposerActions.ts`

### 当前可还原项状态

1. 回合骨架：已按本地可见源码证据收口为 `round start -> skill/intel -> auction -> feedback/reveal/settlement`。
2. 成交线：已按 `BidMap.auction_rounds_rate`。
3. 回合时间：已按 `BidMap.map_time`，`GameData` 时间字段已按源协议秒级单位。
4. 技能触发：已按 `Hero.cast_type`、`Skill`、`SkillEffect`。
5. 出价面板：倍率和 `0` 停手已按 `Battle_InputDevice`。
6. 可见信息：空命中不兜底，核心仓不泄漏旧公共/私人估值线索。

### 验证

1. `npm run typecheck`
2. `npm test`

## 2026-05-26 旧阶段清零、源码音效与飘字反馈

### 本轮处理结果

1. 旧 Demo 首轮阶段入口已清零。
   - 删除共享类型、核心运行态、服务端阶段机、前端派生状态与 Shell 传参里的 `warehouse_roll`、`warehouse_selected`、`auctioneer_reveal`。
   - 删除 `openingCandidates`、`auctioneerClue`、`auctioneerChoices` 及 `buildBidKingOpeningCandidates` 等旧候选/唱牌官情报入口。
   - 复扫范围：`apps`、`packages` 下 `.ts/.tsx/.css`，旧关键词无命中。

2. 回合时间与 `GameData.nextRoundTime` 保持源协议口径。
   - `startNextRound` 从 `intel` 开始，`auctionEndsAt = intel 结束时间 + BidMap.map_time`。
   - `setRoundPhase(..., 'auction')` 会同步 `auctionEndsAt = phaseEndsAt`，避免服务端调度或测试手动推进阶段后仍使用旧截止时间。

3. 音效从源码工程资产目录读取。
   - 资产源：`reverse/bidking/exported_assets_full/AudioClip/sound`。
   - Web 侧新增 Vite 只读中间件 `/source-audio/...`，不把 1.5GB 音频复制进工程。
   - 声音路径按源表 `Sound.FullPathName` / `LanguageListen` 映射，已验证 `bell_start_None.wav` 与 `rolesvoices/english/hero_voice_104_1_None.wav` 返回 200。

4. 局内源码事件音效与飘字反馈已接入。
   - 回合开始：播放 `Sound 10`，首轮自角色延迟播放登场语音。
   - 竞价倒计时 5 秒：播放 `Sound 20`。
   - 技能触发：按竞买人 `Hero.voices[1]` 播放技能语音，并显示短飘字。
   - 最终成交：播放 `Sound 9`，赢家播放胜利/赚赔语音。
   - 表情：沿用服务端下发的 `emoteSoundId` 播放源表音效。
   - 飘字动画为 Web 等效实现，Unity prefab/timeline 级动画未强行复刻。

### 本轮验证

1. `npm run typecheck`
2. `npm run test -w @bitkingdom/match-core`
3. `npx vitest run apps/server/tests/roomRoundRuntime.test.ts --reporter=dot`
4. 浏览器烟测 `http://127.0.0.1:5188`：无 4xx/5xx、无控制台错误，根节点正常挂载。
