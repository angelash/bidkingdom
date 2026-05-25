# BidKing 旧 Demo 逻辑残留归档

日期：2026-05-25

## 背景

当前正式核心局已经固定走 `coreMode: true`，旧的随机/脚本货柜流程不会被正常房间直接启动。但项目中仍保留了多处旧 Demo、本地模拟、教学辅助逻辑，其中一部分仍会影响正式局开局观感。

## 优先处理：仍会影响核心局观感

1. 公共估值仍在核心局容器中生成并展示。
   - 核心生成：`packages/match-core/src/bidking/compatRuntime.ts`
   - 仓库侧栏展示：`apps/web/src/bidking/battle/MatchShell.tsx`
   - 情报面板展示：`apps/web/src/bidking/intel/LiveIntelPanels.tsx`
   - 影响：开局直接出现估值中枢，正式感偏弱。

2. 推荐价仍按公共估值/价值线索计算。
   - 位置：`apps/web/src/bidking/battle/bidRecommendation.ts`
   - 影响：开局出现教学型辅助判断，不像原生正式对局。

3. 本地生成的“掌眼人情报”仍存在。
   - 位置：`packages/match-core/src/match.ts`
   - 当前状态：已移除点亮具体格子的能力，但仍会根据隐藏物生成高品质数量、最多品类、总占格等摘要。
   - 影响：如果正式版没有这张公共牌，应删除或改成只由源协议/地图技能产生。

4. 核心仓创建时仍先生成旧 `publicClues/privateClues`，再由当前轮覆盖。
   - 生成位置：`packages/match-core/src/bidking/compatRuntime.ts`
   - 覆盖位置：`packages/match-core/src/match.ts`
   - 影响：目前基本不外泄，但核心路径内部仍携带旧 Demo 线索源。

5. 地图抽选/掌眼阶段 UI 与服务端阶段机半闲置。
   - UI：`apps/web/src/bidking/battle/BattlePanels.tsx`
   - 服务端阶段机：`apps/server/src/domain/battle/roomRoundRuntime.ts`
   - 核心轮起始阶段：`packages/match-core/src/match.ts`
   - 影响：核心局当前起始为 `auction`，但旧展示阶段仍留在类型、UI、调度逻辑中，需要统一。

## 保留但正常房间不开启

1. 非核心旧拍卖 Demo 引擎。
   - 脚本局、随机货柜、渐进揭示、自动角色线索仍在 `packages/match-core/src/match.ts`。
   - 主要函数：`createLegacyContainerInstance`、`createRandomContainerInstance`、`createScriptedContainerInstance`、`buildProgressivePublicClues`、`buildProgressivePrivateClues`、`buildWarehouseSlotViews`、`buildAutoRoleClues`。

2. 旧 Demo 公共/私人线索生成器。
   - 位置：`packages/match-core/src/clues.ts`
   - 残留线索：`public_value`、`private_value_*`、`private_best_*`。

3. 样例配置数据。
   - 位置：`packages/config/src/data.ts`
   - 包含：`sampleItems`、本地生成 `containers`、`scriptedRounds`。

4. 旧角色技能模型。
   - 类型：`packages/shared/src/index.ts`
   - 非核心技能实现：`packages/match-core/src/skills.ts`
   - 示例：`appraise_value`、`single_treasure`、`spread_rumor`、`loss_insurance`。
   - 核心局会映射到源英雄，但旧技能类型和非核心实现仍保留。

5. 本地 Bot / 推荐估值行为。
   - 位置：`packages/match-core/src/bots.ts`
   - 说明：属于本地行为树，不是原生服务端 AI。

6. 场外 Demo 接口与 fallback。
   - 经济接口：`apps/server/src/routes/economyRoutes.ts`
   - 社交接口：`apps/server/src/routes/socialRoutes.ts`
   - 活动 fallback：`apps/web/src/bidking/activity/ActivityPanels.tsx`
   - 示例：模拟充值入账、模拟 DLC 解锁、加好友、加协会申请。

## 建议执行顺序

1. 核心局隐藏/停用公共估值和推荐价。
2. 移除或协议化本地“掌眼人情报”公共摘要。
3. 核心仓创建时不再生成旧 `publicClues/privateClues`。
4. 统一核心局阶段：要么恢复完整原生阶段流，要么删除半闲置展示阶段。
5. 将非核心旧 Demo 引擎隔离到测试/演示入口，避免被正式路径误用。
6. 后续再清理场外 Demo 接口命名和 fallback 活动逻辑。

