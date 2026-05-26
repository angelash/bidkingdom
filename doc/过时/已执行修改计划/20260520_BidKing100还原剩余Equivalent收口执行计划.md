# 20260520 BidKing 100 还原剩余 Equivalent 收口执行计划

> 目标：在现有 `52 表 Verified / M0-M11 Verified` 的基础上，继续推进到可审计的 `Equivalent`。这里的 `Equivalent` 指 clean-room 机制等价、状态流等价、界面链路等价、代码结构可追溯、测试和截图证据完整；不复制原始商业源码、原始图片、原始音频、线上服务或真实支付能力。

## 0. 当前基线

### 已完成到什么程度

- 52 张配置表、19687 行配置已经全部登记到 `bidking_restore_table_matrix.md`，当前状态为 `Verified`。
- 1256 个原 C# 类已经全部纳入 `bidking_restore_class_matrix.md`，没有 `Unknown` 类群。
- 80 个 `UIWnd` 窗口已经纳入 `bidking_restore_uiwnd_matrix.md`。
- M0-M11 阶段验收矩阵已经全部到 `Verified`，说明自动化验证闭环已经覆盖主要系统。
- 最新已推送代码基线为 `b09a7e0f feat: restore bidking collection income claims`，收藏柜收益已经接入 `Item.collection_coin + Number.numberbonus`。

### 为什么还不能宣称 100%

`Verified` 表示“有运行层、有测试、有基本验收证据”；`Equivalent` 还需要更严格：

- 每个系统不只可操作，还要覆盖原工程的关键事件来源、边界条件、状态迁移、入口链路和反馈表现。
- 每个表不只被读取，还要说明哪些字段驱动行为、哪些字段只做包装展示、哪些字段由于本项目替换资产或线上能力缺失而采用 clean-room 等价方案。
- 每个窗口不只在 React 中有入口，还要有原 UIWnd 的打开来源、层级、弹窗链、空态、禁用态、红点、刷新、错误反馈和移动端表现证据。
- 每轮开发后需要同步更新矩阵、审查报告、测试结果和截图证据，避免账本状态与真实代码脱节。

### 执行前必须处理的现场问题

当前工作区存在未提交代码改动，不能盲目覆盖或混入计划提交。归档时已观察到的代码 dirty 文件包括：

- `apps/server/src/domain/battle/roomRoundRuntime.ts`
- `apps/server/src/roomManager.ts`
- `apps/web/src/bidking/app/BidKingApp.tsx`
- `apps/web/src/bidking/battle/BattleOverlayLayer.tsx`
- `apps/web/src/bidking/battle/BattlePanels.tsx`
- `apps/web/src/bidking/battle/MatchRoute.tsx`
- `apps/web/src/bidking/battle/useBidComposerActions.ts`
- `apps/web/src/bidking/battle/useMatchDerivedState.ts`
- `apps/web/src/styles.css`
- `packages/match-core/src/auction.ts`
- `packages/match-core/tests/matchCore.test.ts`

E0 阶段必须先判定这些改动属于哪一块功能、是否能通过测试、是否需要单独提交。后续所有开发只按模块 staged，避免把未审查改动带入无关提交；如果执行时 dirty 文件继续变化，以 `git status --short` 的实时结果为准。

## 1. 收口原则

1. 每个阶段都以“原表字段 + 原类群职责 + 当前运行层 + 可执行测试 + 前端入口证据”为闭环。
2. 每次只推进一个清晰功能域，提交信息按功能模块命名。
3. 不把“配置可见”当成完成，必须有服务端状态、前端操作、账本或事件、失败反馈和测试。
4. 不把“表行全覆盖测试”当成等价，必须补具体行为差异和人工复审结论。
5. 对真实支付、平台库存、线上社交、原始资产、音频和动画资源，采用自有资源与模拟服务等价，并在文档中标明替代边界。

## 执行进展

### 2026-05-20 E0 已完成

- 已将当前战斗出价和回合定时器 dirty 改动归类为“核心竞拍回合稳态与出价防错”。
- 已提交并推送 `a95f6b41 feat: harden bidking round timers and bid entry`。
- 覆盖内容包括：押金明拍超额出价从静默裁剪改为明确阻断；前端出价面板补最低/推荐/最大/上一轮快捷按钮、键盘输入、现金不足提示；服务端回合定时器补日志、异常重试和卡阶段时快照保活。
- 验证已通过：match-core 57 tests、server 59 tests、web 6 tests、全仓 typecheck、Web build、`git diff --check`。

### 2026-05-20 E1 进行中，Activity 进度主链路已接入

- 服务端新增 `/api/activity/progress?playerId=`，按 `Activity` 原表输出 `activityId / type / sort / path / panelName / pageIcon / duration / rewardRows / claimed / claimable / redPoint / progress / target / actionTarget`。
- 通行证/活动页已改为读取服务端进度快照，并展示进度条、红点、时间窗、奖励领取和排行/好友/协会跳转。
- 服务端测试新增 Activity 进度快照覆盖，路由测试新增 activity progress endpoint 覆盖；server 测试增至 60 个。
- E1 剩余项并入 E11：后台活动审计聚合仍需在后台 Parity Dashboard 阶段补齐。

### 2026-05-20 E2 首批事件源已接入

- `ProfileConditionStatsState` 新增 `tradeBoughtCount / tradeSoldCount`，市场双边成交会分别写入买家买入次数和卖家卖出次数。
- `Condition` 类型 9/10 对应的买入/卖出任务不再只依赖 seller order 兜底，买家与卖家在成交后都会通过 `missionProgress` 即时进入可领取状态。
- `buildProfileSnapshot` 已增加 `ensureProfileShape + refreshTicketState + refreshMissionProgress` 兜底，所有 profile snapshot 读取都会刷新任务/成就进度。
- 服务端测试已覆盖 buyer/seller 成交后 `1001201 / 1001101` 任务进度。

### 2026-05-20 E2 获得道具事件源继续补齐

- `ProfileConditionStatsState` 新增 `auctionAcquiredItemIds / shopAcquiredItemIds`，对局揭示藏品和商店购买奖励会写入获得来源。
- `Condition` 类型 7/8 已从“解释器支持”推进到“有 profile 事件来源”，并补了指定藏品 id 的参数解析。
- match-core 测试增至 58 个，服务端测试保持 60 个，通过覆盖商店获得道具和竞拍获得藏品任务进度。

### 2026-05-20 E2 跨域事件归档收口

- 新增 profile mission event 归档层，统一从 profile ledger 记录 `battle / economy / social / collection / system / growth` 六类事件计数。
- 商店、市场、邮件、公告、引导、设置、好友、协会、收藏柜、局内道具、任务/成就/等级/活动奖励等关键动作会随账本写入 `conditionStats.missionEventCounts / missionEventDomainCounts`，并即时刷新 Mission/Achievement；snapshot 读取仍保留兜底修复。
- `Mission` 当前实际命中的 Condition 6/7/9/10/11/12/13/15/16/19/20/24 均已有 profile 状态来源，后台 Config Parity 将 Mission 标记为 `Equivalent`。

### 2026-05-20 E3 首批 BattleItem 效果计划已接入

- `packages/match-core/src/items.ts` 新增 `BattleItemEffectPlan`，把 `BattleItem.skill_group -> SkillGroup -> Skill -> SkillEffect` 解释为结构化运行计划。
- 计划字段已覆盖 `skill_count / skill_round / skill_CD / skilltarget* / SkillEffect.Category`，输出揭示类型、目标模式、数量、持续回合、冷却、目标玩家需求、实现状态和解释文本。
- 战中使用 `BattleItem` 时，`battle_item_used` 事件 payload 已带 `effectPlan`，后台回放和后续 UI 可直接展示原表字段解释与实际情报结果。
- 64 个 `BattleItem` 全量测试已从“外键连通”升级为“每个道具有解释计划、SkillEffect、目标数量、冷却/持续字段和多类 reveal kind”。

### 2026-05-20 E3 BattleItem 冷却与前端状态已接入

- `RuntimePlayer` 新增 `battleItemCooldowns`，每轮递减，并通过 `PrivatePlayerState.battleItemCooldowns` 只下发给本人；`useBattleItem` 会在局内阻断冷却中的同一道具。
- `useBattleItem` socket payload 新增 `targetPlayerId`，match-core 对需要目标玩家的效果保留服务端校验入口，事件 payload 记录目标玩家和冷却剩余。
- 前端 `battleItemUi` 统一从 `BattleItemEffectPlan` 生成按钮 title、禁用原因和徽标，局内 action bar 展示 reveal kind、原表目标、冷却/持续和实现状态。
- 测试新增 match-core 冷却快照/递减/阻断用例与 Web BattleItem action state 用例。

### 2026-05-20 E3 后台 BattleItem 回放解释已接入

- 后台逐轮事件时间线已识别 `battle_item_used`，展示道具 id、Skill、Effect、Category、揭示类型、目标模式、冷却剩余、目标玩家和实际线索文本。
- Web 新增 `adminFormatters.test.ts`，锁定后台回放对 `BattleItemEffectPlan` 的可读解释，避免回退成 JSON payload。

### 2026-05-20 E3 BattleItem Playwright 局内证据已接入

- 新增 `apps/web/playwright/bidking-battle-item.playwright.ts`，通过真实前端流程创建档案、商店购买、装备 `BattleItem 100102`、进入竞拍房间、开局并点击局内道具按钮。
- 用例会通过 `/api/admin/matches` 反查当前对局，确认后台事件流出现 `battle_item_used`，并校验 payload 中的 `itemId / effectPlan.targetCount / revealKind / description`，避免只验证按钮存在。
- Playwright 证据覆盖“携带、使用、结果进入后台回放、页面无 NaN/待开发占位”，冷却和目标玩家专项仍保留在 match-core/Web 单测中做确定性夹具覆盖。

### 2026-05-20 E4 首批 Bot 决策审计已接入

- `chooseBotAction` 新增 `BotActionAudit`，每次 Bot 决策都会携带 profile、阶段、拍卖模式、`RankAi` 行 id、风险/诈唬/溢价/加价参数、估值、最高可出价和下一口价。
- 房间 Bot 执行层新增 `bot_action_chosen / bot_action_failed` match event，后台逐轮回放可直接看到 Bot 决策来源和失败原因。
- match-core 测试补 `BotActionAudit` 字段断言，server 新增 `roomBotRuntime.test.ts` 覆盖 Bot 决策事件，server 测试增至 61 个。

### 2026-05-20 E4 成交线与加赛决策审计已接入

- `RoundBidFeedback` 新增 `decision`，把 `BidMap.auction_rounds_rate` 解释为结构化 `close / continue / extra_round / no_valid_bid` 决策。
- 决策快照记录成交线阈值、领先价、第二价、领先差距、是否平局、来源字段和可读原因；`round_feedback` 事件同步携带该决策。
- 后台事件格式化已识别成交线决策和 Bot 决策事件，逐轮时间线不再只显示原始 JSON。
- match-core 新增最终轮平价加赛测试，测试增至 59 个。

### 2026-05-20 E4 断线重连状态审计已接入

- 房间生命周期新增 `markSocketRejoined`，重连恢复不再散落在 socket handler 中，统一恢复 room player 与 runtime player 状态。
- socket 断线/重连会写入 `player_disconnected / player_rejoined` match event，payload 带房间、玩家、match、round、phase 和 phaseEndsAt。
- 后台事件格式化已识别断线/重连事件，server 新增生命周期测试，server 测试增至 62 个。

### 2026-05-20 E5 首批市场订单状态机已接入

- `MarketOrderState.status` 扩展为 `listed / locked / sold / cancelled / expired / failed`，订单新增 `expiresAt / lockedAt / expiredAt / failedAt / failureReason` 字段。
- 新建市场订单会按交易/拍卖类型写入过期时间；读取 snapshot、列表、成交和撤单前会自动过期回收，并返还锁定库存、写入 `market_order_expired_return` 账本。
- 修复买家铜钱不足时订单先被误标 `sold` 的状态污染：现在会先校验买家余额，再进入 `locked -> sold`。
- 前端市场/拍卖面板展示中文状态和过期倒计时；server 测试增至 64 个。

### 2026-05-20 E5 上架数量边界已接入

- 市场上架校验新增 `marketOrderQuantityLimit`，读取 `Item.max_stack_size / max_per_listing` 计算单笔上限。
- 交易/拍卖上架数量超过原表限制时明确拒绝；前端库存卡展示单笔上限。
- server 新增上架数量边界测试，server 测试增至 65 个。

### 2026-05-20 E6 首批协会权限闭环已接入

- `donateGuildCoinsForProfile` 现在会读取 `GuildPermissions.donate`，低权限职位不能捐献刷协会积分。
- 协会面板捐献按钮同步按 `membership.permissions.donate` 禁用。
- server 新增 `GuildPermissions.donate` 权限测试，server 测试增至 66 个。

### 2026-05-20 E7 首批收藏柜与图鉴字段闭环已接入

- 收藏柜陈列从“只校验图鉴解锁”升级为读取 `Cabinet.quality_requirement / place_max / max_slot_limit`，不满足品质门槛会在服务端明确拒绝。
- 新增收藏柜移出接口和 `cabinet_clear` 账本，前端收藏柜展示容量、品质禁用原因、陈列和移出操作。
- `bidking-compat` 新增 `bidKingItemRuntimeFlags / bidKingItemRuntimeFacts / bidKingItemTypeRule`，统一解释 `Item.specified_obtain / show_item / collection / rank7count / item_access / number / cost / exchangeId / is_sale / room_price` 和 `ItemType` 交易/拍卖开关。
- 藏品百科新增原表开关筛选和字段 fact 展示，能按可交易、可拍卖、可陈列、可兑换、可出售、房价过滤。
- 定向验证已通过：server `profileService/profileRestoreCoverage` 60 tests、`bidking-compat` itemRuntime 1 test、server/web typecheck。

### 2026-05-20 E8 首批商店刷新与商品展示闭环已接入

- `bidking-compat` 新增 `bidKingShopRuntimeSummary / bidKingShopItemRuntimeSummary / shopCanRefresh`，统一解释 `Shop.random / randcounts / autofresh / ticket / setting / buyuitype / currencydisplay` 与 `ShopItem.front / buycounts / randvalue / rate / ratevalue / buytype / price`。
- 服务端 `refreshShopForProfile` 现在只允许刷新原表标记为随机池或自动刷新的商店；固定商店手动刷新会明确拒绝，避免绕过购买限制。
- 商店前端展示随机池数量、自动刷新小时、货币显示、商品随机权重、倍率档和购买 UI 类型；固定商店刷新按钮同步禁用。
- 定向验证已通过：`bidking-compat` shopRuntime 1 test、server `profileService/profileRestoreCoverage` 61 tests、server/web typecheck。

### 2026-05-20 E8 票券边界与开局预检已接入

- `bidking-compat` 新增 `bidKingTicketRuntimeSummary`，解释 `Ticket.recovertime / max / maxlimit / buyrefresh / buycounts / buyquantity / buycurrency / price / reserveticket / reservetime / reservelimit`，并记录 clean-room 开局失败策略为 `preflight_no_spend`。
- 房间开局在扣票前会先读取所有真人 profile 的票券快照；任意玩家票不足时直接拒绝开局，不会出现前面玩家已扣票、后面玩家失败的部分扣票状态。
- 背包面板展示当前票券、恢复规则、购买能力和“开局预检扣票”策略；当前原表 `recovertime=0 / buycounts=0` 因而显示为不自动恢复、不可购买。
- 验证已通过：`bidking-compat` ticketRuntime 1 test、server 68 tests、server/web/bidking-compat typecheck。

### 2026-05-20 E9 首批 UIWnd 运行语义已接入

- `bidking-compat` 新增 `bidKingUIWndRuntime / bidKingUIWndRuntimeRows / findBidKingUIWndRuntime`，统一解释 `UIWnd.IsMainWnd / Layer / CommonSet / ResSet / BGM / IsBlur / Path`。
- 前端 `windowRegistry` 现在保存原窗口 runtime：`navigationMode / closeBehavior / commonSet / resourceSet / bgm / blur`，不再只保留名称和目标模块。
- Web system test 已断言所有 80 个 UIWnd 都有 runtime，且 blur 弹窗可被解释为 close/modal 语义。
- 验证已通过：`bidking-compat` uiWndRuntime 1 test、Web systemTables 4 tests、web/bidking-compat typecheck。

### 2026-05-20 E9 ErrorCode 运行语义已下沉

- `bidking-compat` 新增 `bidKingErrorCodeRuntime / bidKingErrorCodeForMessage / stableErrorCodeIndex`，统一解释 `ErrorCode` 的 id、messageKey、code 和显示名。
- 服务端 `apiErrorEnvelope` 已改为复用兼容层 helper，不再本地重复哈希和列号解释。
- 验证已通过：`bidking-compat` errorCodeRuntime 1 test、server routes 3 tests、server/bidking-compat typecheck。

### 2026-05-20 E9 DirtyWords 社交输入闭环已接入

- 好友系统新增备注状态、`/api/social/friend/remark` 路由和前端保存入口，备注会按 `DirtyWords` 表过滤后落入 profile。
- 协会系统新增公告状态、`/api/guild/notice` 路由和前端保存入口，公告会按 `DirtyWords` 表过滤，并读取 `GuildPermissions.editNotice` 阻断低权限职位编辑。
- 服务端账本新增 `friend_remark_update / guild_notice_update` 来源，后台可从 profile ledger 追踪社交文本变更。
- 验证已通过：server `profileService/routes` 58 tests、server/web/shared typecheck、Web 6 tests。

### 2026-05-20 E6 地区资源奖励闭环已接入

- `GuildArea.columns[3] -> GuildResources` 已进入服务端动作链，新增 `/api/guild/area/resource/claim`，只能领取当前协会地区绑定资源。
- 地区资源领取读取 `GuildPermissions.manageResource`，低权限职位会被服务端阻断，成功领取写入 `guild_area_resource_claim` 账本。
- 协会地区卡新增“领取地区资源”按钮，当前地区且有资源管理权限时可直接领取绑定资源。
- 验证已通过：server `profileRestoreCoverage/routes` 10 tests、server/web/shared typecheck、Web 6 tests。

### 2026-05-20 E11 后台审查快照导出已接入

- 新增 `/api/admin/review-snapshot`，一次性返回 `audit / configParity / tableMatrix / equivalentSummary / validationCommands`，用于最终复审归档。
- `AdminReviewSnapshot` 已进入 shared API 类型，后台页面新增“导出审查快照”入口。
- routes 测试覆盖 review snapshot 的 52 表矩阵和验证命令清单；验证已通过 server routes 3 tests、server/web/shared typecheck。

### 2026-05-20 E11 Equivalent 分类口径已拆分

- `AdminConfigParityRow` 新增 `equivalentStatus`，后台配置 Parity 不再只显示 `Verified`，而是展示 `Equivalent / Visual Substitute / Service Simulated / Manual Review Required`。
- `/api/admin/review-snapshot` 的 `equivalentSummary` 已拆出 `equivalentTables / visualSubstituteTables / serviceSimulatedTables / manualReviewTables`，避免把视觉替代和服务模拟误算成普通待复审。
- 当前首批 Equivalent 表包括 `Access / Achievement / Activity / Area / BattleItem / BidMap / Cabinet / Condition / Constant / DirtyWords / Drop / ErrorCode / ExchangeRestock / GiftPackage / Guide / GuildArea / GuildPermissions / GuildPoints / GuildResources / Hero / Item / ItemRestock / ItemType / Language / LanguageName / LevelUp / Mail / Map / Mission / Notice / NumberTable / Rank / RankAi / RankMap / RankReward / Shop / ShopItem / Sim / Skill / SkillEffect / SkillGroup / Ticket / UIWnd / WareHouse`；`Pay / PurchaseList / Dlc` 标记为服务模拟，`Emoji / Head / HeroSkin / LanguageListen / Sound` 标记为视觉替代。
- 验证已通过：server routes 3 tests、server/web/shared typecheck、`npm run test:playwright` 2 tests。

### 2026-05-20 E11 成长/条件表 Parity 收口

- `Access / Achievement / Constant / LevelUp` 已基于既有运行层和测试证据从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增具体表名断言，锁定 `Access / Achievement / Condition / Constant / LevelUp / Mission` 均为 `Equivalent`，避免后台审查快照只保留泛化数量。

### 2026-05-20 E11 Rank Parity 收口

- `Rank` 已基于服务端排行快照、地区/赛季/角色/type 元信息、分页接口、前端切榜入口和既有 server 覆盖测试，从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增 `Rank` 具体表名断言，确保后台审查快照不会把排行表退回人工复审。

### 2026-05-20 E11 Activity Parity 收口

- `AdminAuditSnapshot` 新增 `activityAuditRows / claimedActivityRewardCount / activityClaimableCount / activityRedPointCount`，后台审计不再只统计 profile 总量。
- `/api/admin/audit` 与 `/api/admin/review-snapshot` 会按原 `Activity` 表逐活动聚合活跃人数、过期人数、已领人数、可领人数、红点人数、平均进度和 action target 分布。
- 后台新增“活动审计”面板，直接展示可领、已领、红点和每个活动的平均进度；routes 测试已覆盖 review snapshot 中的 Activity 审计字段。
- `Activity` 已基于服务端进度快照、领取/过期/红点状态、前端通行证面板、后台审计聚合和既有覆盖测试，从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增 `Activity` 具体表名断言，确保后台审查快照不会把活动/通行证表退回人工复审。

### 2026-05-20 E11 Mail Parity 收口

- `Mail` 已基于原表附件奖励、初始投递、`validity_period` 过期时间、已读、删除、附件删除保护、过期领取阻断和删除后不复活状态，从 `Manual Review Required` 推进到后台 `Equivalent`。
- 前端邮件面板已展示模板行数、已读/未读、附件摘要、过期状态和领取/删除/标记已读操作；服务端覆盖 `claimMail / markMailRead / deleteMail` 与 profile ledger 来源。
- routes 测试新增 `Mail` 具体表名断言，确保后台审查快照不会把邮件表退回人工复审。

### 2026-05-20 E11 Notice Parity 收口

- `Notice` 启动公告队列已按原表优先级排序并跳过已读公告，profile `readNotices` 与本地 dismissed 状态共同避免重复弹出。
- 前端启动公告已读取 `ButtonOk / ButtonCancel` 语言键、`Type` 与送拍类公告动作目标，确认按钮可跳到对应局外窗口，取消按钮只写回已读状态。
- `Notice` 已基于 bootstrap 摘要、启动公告浮层、已读状态、按钮键、跳转目标、重复弹出规则、服务端账本和 Web/Server 覆盖测试，从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增 `Notice` 具体表名断言，确保后台审查快照不会把公告表退回人工复审。

### 2026-05-20 E11 Guide Parity 收口

- `Guide` runtime 已解释原表目标窗口、节点路径、锚点/焦点坐标、引导类型、触发类型、角色条件、动态节点、遮罩透明度、延迟毫秒和 step 排序。
- 前端大厅引导浮层读取 `nextBidKingGuideStep`，按 profile `completedGuides` 跳过已完成步骤，并把动态、遮罩和延迟作为运行数据挂到浮层节点。
- `Guide` 已基于 bootstrap 摘要、目标解析、完成状态、重复跳过、服务端账本和 Web/Server 覆盖测试，从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增 `Guide` 具体表名断言，确保后台审查快照不会把引导表退回人工复审。

### 2026-05-20 E11 GuildResources Parity 收口

- `GuildResources` 已基于协会资源领取、地区资源绑定领取、消耗、`GuildPermissions.manageResource` 权限检查、账本记录和前端协会资源操作，从 `Manual Review Required` 推进到后台 `Equivalent`。
- `bidking-compat` runtime 已逐行解释 `type / name / image`，类型 1 为协会徽章素材、类型 2 为成员称号模板，并保证所有原表行都有已知用途。
- routes 测试新增 `GuildResources` 具体表名断言，确保后台审查快照不会把协会资源表退回人工复审。

### 2026-05-20 E11 NumberTable Parity 收口

- `NumberTable` 已基于原表 `counts / numberbonus` 驱动收藏数量档位、`activeBonus` 快照、背包档位展示和收藏柜离线收益加成结算，从 `Manual Review Required` 推进到后台 `Equivalent`。
- 收藏柜收益链路按 `Item.collection_coin * 3600 * (1 + Number.numberbonus)` 结算，并保留 24 小时离线收益上限；`profileRestoreCoverage.test.ts` 与 `profileService.test.ts` 已覆盖档位激活和收益领取。
- routes 测试新增 `NumberTable` 具体表名断言，确保后台审查快照不会把收藏数量档位表退回人工复审。

### 2026-05-20 E11 WareHouse Parity 收口

- `WareHouse` 已基于原表 `house_name / house_type` 解释仓库入口语言 key、可见道具类型和 ItemType 标签，从 `Manual Review Required` 推进到后台 `Equivalent`。
- 背包页按 `profile.inventory` 命中 `WareHouse.house_type` 生成仓库筛选、数量、选中详情和使用/交易/拍卖/陈列/兑换禁用态说明；`wareHouseRuntime.test.ts` 与 `profileRestoreCoverage.test.ts` 已覆盖原表解析和成长仓库链路。
- routes 测试新增 `WareHouse` 具体表名断言，确保后台审查快照不会把仓库表退回人工复审。

### 2026-05-20 E11 ItemType Parity 收口

- `ItemType` 已基于原表 `showin_tradingbuy / showin_auction / store_type` 驱动交易所、拍卖行和仓库筛选，从 `Manual Review Required` 推进到后台 `Equivalent`。
- `ItemTypeFilterStrip` 与 `itemTypeFilterRuntime` 已把原表分类入口复用到市场、拍卖和收藏柜/仓库视图，并保留 `store_type` 摘要；`itemTypeFilterRuntime.test.ts` 覆盖筛选选项、命中规则和摘要。
- routes 测试新增 `ItemType` 具体表名断言，确保后台审查快照不会把道具分类表退回人工复审。

### 2026-05-20 E11 批量 Parity 收口：核心/技能/商业/地区/仓库

- 核心竞拍 `BidMap / Drop / Map / RankMap` 已基于选图、掉落递归、地图分组、最低出价/时长、同 seed 回放和成交线决策审计，从 `Manual Review Required` 批量推进到后台 `Equivalent`。
- 技能与战斗道具 `BattleItem / Hero / RankAi / Skill / SkillEffect / SkillGroup` 已基于 Hero.cast_type 链路、BattleItemEffectPlan、冷却私有状态、Bot action audit、后台回放解释和 match-core/Web/Server 覆盖测试，从 `Manual Review Required` 批量推进到后台 `Equivalent`。
- 商业表 `Shop / ShopItem / ItemRestock / ExchangeRestock / GiftPackage` 已基于刷新池、购买限制、商品排序/收藏、兑换材料扣减、礼包 Pay 门槛和前端禁用态，从 `Manual Review Required` 批量推进到后台 `Equivalent`。
- 仓库与地区表 `Cabinet / Item / Area / GuildArea / Sim` 已基于收藏柜容量/收益、Item 36 列字段审计、地区/协会地区动作、Sim 快速套用入口和既有覆盖测试，从 `Manual Review Required` 批量推进到后台 `Equivalent`。
- routes 测试扩展为完整 Equivalent 表名清单，确保后续后台审查快照不会把这些已闭环表退回人工复审。

### 2026-05-20 E11 Language Parity 收口

- `Language` 已基于 5214 行原表、语言列归一化、`translateBidKingLanguage` key 翻译、系统面板语言列样例和 Web 覆盖测试，从 `Manual Review Required` 推进到后台 `Equivalent`。
- routes 测试新增 `Language` 具体表名断言，后台 Config Parity 现在不再保留 `Manual Review Required` 表。

### 2026-05-20 E10 后台前端 Evidence 冒烟已加固

- Playwright 后台冒烟已从“页面可打开”升级为校验 `/api/admin/review-snapshot` 契约：`19687` 配置行、`52` 表矩阵、`UIWnd=80` 行、Parity 失败为 0、验证命令清单包含 Playwright。
- 桌面后台页已自动校验“导出审查快照”入口 href 指向服务端 review snapshot，确保前端入口和服务端审查快照同源。
- 桌面和移动后台冒烟都会生成当前运行截图到 Playwright 输出目录，作为可重跑证据；`apps/web/test-results/` 与 `apps/web/playwright-report/` 已加入忽略，避免临时产物混入提交。
- 验证已通过：`npm run test:playwright` 2 tests、`npm run typecheck -w @bitkingdom/web`。

### 2026-05-20 E12 最终 Review Snapshot 契约加固

- `/api/admin/review-snapshot` 已输出最终收口状态和三类表名清单：`52 Verified / 44 Equivalent / 5 Visual Substitute / 3 Service Simulated / 0 Manual Review Required`，`closureStatus=closed`。
- Visual Substitute 固定为 `Emoji / Head / HeroSkin / LanguageListen / Sound`，Service Simulated 固定为 `Dlc / Pay / PurchaseList`，避免最终复审误把视觉替代和服务模拟当作未完成缺口。
- 后台配置 Parity 面板直接展示四类收口计数；routes 测试和 Playwright 后台冒烟改为精确断言，后续任一表回退到 Manual Review 会直接失败。

### 2026-05-20 E12 Clean-room 边界说明入快照

- `/api/admin/review-snapshot.equivalentBoundaries` 已为 8 个非普通 Equivalent 表输出 `reason / cleanRoomBoundary / evidence`，把视觉替代和服务模拟的授权边界与测试证据固化到后台导出结果。
- 后台配置 Parity 面板同步展示 Visual Substitute 与 Service Simulated 表名清单，便于人工复审时直接核对替代边界。
- routes 测试和 Playwright 后台冒烟已锁定 8 条边界说明，避免后续只保留数量而丢失替代原因。

### 2026-05-20 E12 最终矩阵摘要入快照

- `/api/admin/review-snapshot.restoreMatrixSummary` 已固化四份基线摘要：`1256` 个 Scripts 类全部 mapped、`52` 表 `19687` 行闭环、`80` 个 UIWnd mapped、`13` 个阶段中 `M0-M10 Verified / M11+E12 Equivalent Closed`。
- 后台新增“最终验收摘要”面板，直接显示 class/table/UIWnd/acceptance 四类闭环计数，人工复审无需再手工翻四份矩阵确认数量。
- routes 测试和 Playwright 后台冒烟已断言矩阵摘要、最终阶段 `E12`、Manual Review `0`、UIWnd registry 来源，避免文档基线和接口结果再次漂移。

### 2026-05-20 E12 最终验收包与复审清单

- `/api/admin/review-snapshot.finalReviewChecklist` 已输出六项最终复审清单：baseline matrices、config classification、clean-room boundaries、runtime evidence、validation gates、redistribution boundary。
- 后台新增“最终复审清单”面板，直接展示基线矩阵、配置分类、替代边界和验证命令四个可视核对项，Playwright 已断言面板可见且全部 PASS。
- 新增 `doc/20260520_BidKing100最终验收包.md`，集中记录最终结论、权威复审入口、固定验证命令、表级例外边界和生成 PNG 独立评审口径。

### 2026-05-21 E5/E7/E9 经济常量二次收口

- 新增 `marketRuleRuntime / economyRuleRuntime`，将市场拍卖 `item_bid_* / auction_*`、`mail_max_count`、收藏收益 `cabinet_* / collection_counts_max` 和结算 `bid_fanli` 统一进入运行层。
- 市场上架已按原公式拆分上架费、交易手续费、阶梯税、净到账、槽位上限、信箱满阻断、竞价窗和全服快照上限；前端市集/拍场同步展示这些规则。
- `relief_fund_*` 已从规则展示推进为服务端低资产主动领取，按每日次数和总资产线发放并写账本。
- 收藏收益快照补收藏计数上限、重复倍率和领取间隔；核心竞拍结算补亏损返利交易。
- 验证已通过：`validate:bidking-compat`、match-core 68 tests、server 78 tests、web 18 tests、server/web/match-core typecheck。

## 2. 阶段计划

### E0. 现场收敛与基线再冻结

目标：把当前未提交代码改动归类、验证、提交或明确搁置，重新形成一个干净基线。

开发任务：

- 审查当前代码 dirty 文件的 diff，判断它们属于战斗出价、回合状态机、UI 表现、测试补充还是其他功能。
- 对 `packages/match-core/src/auction.ts` 与 `packages/match-core/tests/matchCore.test.ts` 做一致性核对，确认规则变化是否来自 BidKing 还原需求。
- 如果改动完整且测试通过，按功能单独提交；如果不是本轮可收口内容，只记录为待处理，不混入后续提交。
- 重新运行固定验证链，记录通过版本。

验收证据：

- `git status --short` 只剩明确可解释的后续工作改动，或完全干净。
- `npm test -w @bitkingdom/match-core -- --run`
- `npm test -w @bitkingdom/server -- --run`
- `npm test -w @bitkingdom/web -- --run`
- `npm run typecheck`
- `npm run build -w @bitkingdom/web`

### E1. Activity / 通行证进度事件收口

目标：把 `Activity` 从“可领奖 + 可展示”推进到“活动/通行证进度、红点、时间窗、入口跳转和奖励状态完整”。

开发任务：

- 服务端新增活动进度快照，按 `Activity.type / path / delayedhide / cleanitem / panelname / pageicon` 输出状态。
- 活动快照包含 `activityId / claimed / claimable / expired / progress / target / redPoint / window / actionTarget`。
- 把当前 profile 事件源接入活动进度：对局完成、排行积分、好友/协会、充值礼包、商店购买、道具使用、收藏柜收益。
- 前端通行证/活动页改为读取服务端活动进度，不再只展示静态卡片和 claim 按钮。
- 入口跳转按 `path` 映射到排行、好友、协会、商店、战前或系统页。
- 后台审计加入活动进度与活动领奖记录。

验收证据：

- 服务端测试覆盖活动进度、过期、已领、可领红点、入口目标。
- Web 测试覆盖活动卡片、领取、已领禁用和入口跳转。
- 表矩阵 `Activity` 的通行证进度事件缺口改为已完成。

### E2. Mission / Achievement 全事件来源收口

目标：任务与成就不只“条件解释器支持”，还要让所有可由 demo 触发的原表任务都有真实事件来源。

开发任务：

- 建立统一 profile event bus 或薄事件归档层，所有局外/局内动作写入任务可消费事件。
- 对局事件：完成局数、胜负、利润、出价次数、失败次数、指定 BidMap、指定地图、指定角色、使用道具、获得指定价值藏品。
- 经济事件：购买商品、兑换、充值模拟到账、礼包领取、DLC 解锁、市场上架/购买/成交/撤单。
- 社交事件：加好友、删好友、加入协会、迁区、捐献、改职、资源领取/消耗。
- 收藏事件：获得藏品、陈列、收益领取、收藏等级变化、图鉴解锁。
- 系统事件：邮件读/领/删，公告已读，引导完成，设置保存，昵称修改。
- 任务进度刷新从“读取 profile 时派生”升级为“关键事件后即时刷新 + 读取兜底修复”。
- 成就红点与阶段领奖复用同一进度源，避免 Mission 和 Achievement 口径分叉。

验收证据：

- `profileService.test.ts` 新增跨域事件驱动任务进度用例。
- `profileRestoreCoverage.test.ts` 对 Mission 使用到的事件类型逐类验证。
- 前端任务页至少覆盖日/周/成就/等级链路的操作后即时刷新。

### E3. BattleItem / Skill / SkillEffect 逐效果收口

目标：64 个 `BattleItem` 不只连通 `SkillGroup -> Skill -> SkillEffect`，还要尽可能按技能效果类别落实到局内行为。

开发任务：

- 梳理 `SkillEffect.Category` 现有 36 行效果类别，标记已运行、简化运行、仅展示三种状态。
- 为每类效果建立运行解释器：揭示目标、揭示数量、揭示范围、持续回合、冷却、可用时机、目标玩家限制。
- 将 `Skill.skill_count / skill_round / skill_CD / skilltarget* / skill_value / skill_opt*` 纳入解释，不再只读技能名。
- 局内使用道具时输出结构化 effect result，前端按 result 展示情报、禁用原因、冷却和目标选择。
- 后台回放展示道具效果原始字段、解释结果和实际影响。（已完成首版事件时间线解释）
- 对无法 clean-room 准确还原的视觉特效，用自有表现替代，并在矩阵中标注“视觉替代，机制等价”。

验收证据：

- 64 个 BattleItem 全量测试从“链路连通”升级为“每个道具有解释结果和可用/不可用状态”。（已完成）
- 至少覆盖 reveal、round-limited 字段解释、cooldown 私有状态、inventory cost、前端禁用态五类行为测试；target player 与 role/hero restriction 需要等原表命中目标玩家/角色限制字段后继续补专项夹具。
- 前端已补局内按钮冷却/目标/结果描述展示；Playwright 已覆盖真实携带、使用、后台事件确认和页面占位检查，冷却/目标玩家仍由单元测试和后续专项 UI 夹具兜底。

### E4. 核心竞拍和房间状态机 Equivalent

目标：把核心玩法从“可玩且接表”推进到“规则、边界、回放、断线恢复、Bot 和 UI 节奏可审计等价”。

开发任务：

- 核对 `BidMap.auction_rounds_rate / RankMap.match_time / min_bid_range / bid_type / role_spawn` 是否全部进入战斗准备和回合状态机。
- 清理当前 `auction.ts` dirty 改动，确认成交线、最低出价、明拍/暗拍、押金或资金上限的规则来源。
- Bot 行为继续对齐 `RankAi.min_bid_ratio / item_use_probability / bid_time / bid_pk`。
- 房间阶段补齐：准备、匹配、地图抽选、道具配置、每轮出价、结算、复盘、重连快照。
- 回放记录补齐：每轮公共揭示、私人情报、道具使用、Bot 决策、出价锁定、成交原因、最终收益。
- 前端修正战斗界面未审查改动，保证所有新增 UI 状态有移动端适配。

验收证据：

- 同 seed + 同脚本回放确定性测试保留，并新增异常边界测试。
- 后台逐轮回放能解释每次成交和每个 Bot 动作来源。
- Playwright 覆盖桌面/移动战斗主流程。

### E5. 市场 / 拍卖行 / 兑换 Equivalent

目标：市场和拍卖行从“可双边成交”推进到“订单状态、筛选、手续费、撤单、买卖双方审计和兑换池完整”。

开发任务：

- 订单状态机补齐：listed、locked、sold、cancelled、expired、failed。
- 成交过程补事务边界：买家扣款、卖家入账、手续费、库存交割、失败回滚。
- 交易/拍卖筛选按 `ItemType.showin_tradingbuy / showin_auction / store_type` 接入。
- 价格、上架数量、最大堆叠、最大单笔数量读取 `Item.max_stack_size / max_per_listing / transaction_tax_rate`。
- 兑换池把 `ExchangeRestock` 与对应 `ShopItem` 关系写入快照和后台审计。
- 前端补购买确认、竞得确认、撤单确认、库存不足、余额不足、已售罄和过期态。

验收证据：

- 服务端订单状态机单测覆盖成功、失败、撤单、重复请求和跨玩家成交。
- 后台账本能按订单、买家、卖家和资源类型筛选。
- 前端市场/拍卖行 Playwright 覆盖上架、购买、撤单、兑换。

### E6. 协会 / 好友 / 地区 Equivalent

目标：协会系统从“加入、迁区、捐献、资源操作”推进到“权限、成员管理、地区资源和好友社交链完整”。

开发任务：

- 协会成员列表持久化，支持会长、管理员、普通成员三类角色。
- 接入 `GuildPermissions` 的审批、邀请、转让、任命、编辑信息、改称号、踢人权限。
- 协会资源补产出/消耗用途，`GuildResources` 不只可领取/消耗，还要有资源类型用途说明和账本。
- 地区榜补地区奖励、地区资源汇总、地区成员统计和迁区限制。
- 好友补申请/同意/拒绝/删除状态机，当前直接添加可作为 demo 快捷入口保留，但要标注。
- `LanguageName` 扩展到 Bot、推荐好友、地区玩家名生成入口。

验收证据：

- 服务端测试覆盖权限矩阵、非法操作阻断、迁区、资源产消、好友申请流。
- 前端协会面板展示成员、权限、地区、资源和操作禁用原因。
- 后台可审计协会成员、职位变更、资源流水和地区变更。

### E7. 仓库 / 收藏柜 / 图鉴 / 藏品字段 Equivalent

目标：`Item / Cabinet / WareHouse / ItemType / Number` 从主字段运行化推进到完整仓库交互与字段审计。

开发任务：

- 原仓库页补全：库存筛选、分类、品质、可交易、可拍卖、可陈列、可兑换、可出售状态。
- 图鉴和藏品详情补 `Item` 长尾字段展示或解释：`specified_obtain / show_item / collection / rank7count / item_access / number / cost / exchangeId / is_sale / room_price`。
- 收藏柜陈列补拖拽/替换/清空/容量边界、收益上限、收益动效和账本详情。
- `Number` 档位变化触发 profile snapshot 更新，并在前端明确显示当前档、下一档和收益加成。
- `ItemType` 筛选状态和原表开关进入交易、拍卖、图鉴、背包的共同过滤器。

验收证据：

- 服务端测试覆盖陈列替换、收益上限、字段解释和筛选规则。
- Web 测试覆盖仓库筛选、陈列、收益领取、图鉴详情。
- 表矩阵中 `Item / Cabinet / WareHouse / ItemType / Number` 的长尾字段有解释结论。

### E8. 商店 / 票券 / 礼包 / 支付模拟 / DLC Equivalent

目标：商业系统从“可购买/可到账”推进到“刷新成本、限制、票券恢复、SKU 边界和礼包门槛完整”。

开发任务：

- `Ticket` 补恢复计时、上限、开局失败返还或不返还规则说明。
- `Shop.random / randcounts / autofresh / ticket / setting / random` 完整解释，补刷新成本和刷新失败反馈。
- `ShopItem.front / rate / ratevalue / buycounts / buyuitype / currencydisplay` 进入商品可见性、随机权重和 UI 展示。
- 礼包按 Pay 门槛、领取状态、过期状态和重复到账防护继续收口。
- Pay/PurchaseList/DLC 明确模拟边界：本地订单代替真实平台支付，仍保留 SKU、价格、到账、取消、邮件投递和审计链。

验收证据：

- 服务端测试覆盖票券恢复、商店刷新成本、商品前置、随机权重、礼包门槛。
- 前端商店/充值 Playwright 覆盖购买、刷新、到账、DLC、礼包领取。
- 后台能按订单和商品查看到账与发放来源。

### E9. Sound / Language / DirtyWords / ErrorCode / Guide / Notice / UIWnd Equivalent

目标：系统表从“可见/可保存”推进到“真实运行层覆盖 UI 文案、声音提示、错误反馈、公告引导和窗口链”。

开发任务：

- `Language` 逐步替换硬编码业务文案：先覆盖按钮、toast、错误、面板标题和表驱动描述。
- `LanguageListen` 与 `Sound` 建立播放 cue 队列，支持 BGM、按钮音、角色试听、表情音效、战斗事件音效。
- `DirtyWords` 覆盖所有用户输入路径：昵称、市场备注、协会信息、好友备注、反馈、订单备注。
- `ErrorCode` 统一服务端错误 envelope 与前端 toast，不再散落字符串错误。
- `Notice` 启动公告补优先级、已读、按钮动作、跳转和重复弹出规则。
- `Guide` 补多窗口目标、遮罩、延迟、动态节点、完成条件和跳过状态。
- `UIWnd` 补窗口层级、modal/back 行为、blur、BGM、关闭来源、移动端布局和入口溯源。

验收证据：

- Web system tests 覆盖语言 key、声音 cue、错误码、公告、引导、窗口 registry。
- Playwright 覆盖启动公告、引导浮层、错误 toast、设置音量/语言。
- 截图归档覆盖桌面和移动端关键窗口。

### E10. 前端窗口链和视觉/交互 Evidence 收口

目标：前端不只“无待开发入口”，还要每个原 UIWnd 映射窗口有可操作、可截图、可复核的证据。

开发任务：

- 按 `bidking_restore_uiwnd_matrix.md` 80 个窗口逐项核对入口、层级、空态、禁用态、错误态和移动端。
- 对每个一级系统建立 Playwright smoke：大厅、战前、战斗、结算、背包、图鉴、竞买人、商店、交易、拍卖、排行、任务、协会、好友、邮件、活动、系统、后台。
- 补红点逻辑：活动、任务、邮件、礼包、排行、商店、协会资源、收藏收益。
- 补 loading、空列表、失败重试、禁用原因和操作成功反馈。
- 视觉资源继续使用自有三国/古代珍宝包装，所有原资源替代都在文档中说明。

验收证据：

- `apps/web/playwright` 新增或扩展主流程脚本。
- 每个一级系统至少 1 张桌面截图和 1 张移动截图归档到可忽略或可提交的证据目录。
- 无文字溢出、无互相遮挡、无 `待开发`、无无效按钮。

### E11. 后台审计和 Parity Dashboard 收口

目标：后台可以解释所有系统状态，开发和复审时不用翻数据库或日志猜原因。

开发任务：

- 配置 parity 页面增加 `Equivalent` 字段：Verified、Equivalent、Visual Substitute、Service Simulated、Manual Review Required。
- 后台 profile 审计补任务、成就、活动、票券、商店刷新、订单、协会、好友、收藏柜收益、声音/语言设置。（Activity 聚合已完成）
- 后台 match 回放补 Bot 来源、RankAi 参数、SkillEffect 解释、BattleItem 结果。
- 后台 ledger 支持按 source、resource、player、order、match、guild、activity 过滤。
- 导出审查快照：一键生成当前 profile、config parity、table matrix 状态和最近验证命令摘要。

验收证据：

- routes 测试覆盖新增后台接口。
- 后台 Playwright 覆盖筛选、配置 parity、match 详情、profile 审计。
- 最终审查报告可以直接引用后台截图与接口结果。

### E12. 文档、矩阵和最终人工复审

目标：把“做完了”变成“可证明做完了”。

开发任务：

- 每完成一个阶段，更新：
  - `20260519_BidKingDemo还原完整度审查报告.md`
  - `20260519_BidKing全功能全结构100还原开发计划.md`
  - `bidking_restore_table_matrix.md`
  - `bidking_restore_acceptance_matrix.md`
  - `README_最新文档导航.md`
- 新增最终审查文档：按 52 表、80 UIWnd、1256 类群、主流程截图和测试命令列证据。
- 对所有“视觉替代 / 服务模拟 / 原资源不可提交”条目建立例外清单。
- 最终执行全验证命令，并归档日志摘要。

验收证据：

- 52 表都有 Equivalent 结论或明确 clean-room 替代边界。
- 80 UIWnd 都有窗口链路和截图证据。
- 1256 类群都能追溯到当前模块或“无需运行层”的说明。
- 全验证链通过。

## 3. 推荐执行顺序

| 顺序 | 阶段 | 原因 | 预计提交粒度 |
| --- | --- | --- | --- |
| 1 | E0 现场收敛 | 当前 dirty 改动不先厘清，会污染后续判断 | 1 个基线提交或无提交 |
| 2 | E1 Activity/通行证 | 表矩阵仍明确留有 Equivalent 缺口 | 1-2 个功能提交 |
| 3 | E2 Mission/Achievement 事件源 | 影响任务、活动、成就、红点和后台审计 | 2-3 个功能提交 |
| 4 | E3 BattleItem/SkillEffect | 直接影响核心局内还原度 | 2-4 个功能提交 |
| 5 | E4 核心竞拍状态机 | 需要结合当前 battle dirty 改动收口 | 2-3 个功能提交 |
| 6 | E5 市场/拍卖/兑换 | 经济状态和交易审计补完 | 2 个功能提交 |
| 7 | E6 协会/好友/地区 | 社交系统完整度补完 | 2-3 个功能提交 |
| 8 | E7 仓库/收藏柜/图鉴 | 补 Item 长尾字段和仓库交互 | 2 个功能提交 |
| 9 | E8 商业系统 | 补刷新成本、票券恢复和 SKU 边界 | 1-2 个功能提交 |
| 10 | E9 系统表运行层 | 语言、声音、错误、公告、引导统一 | 2-3 个功能提交 |
| 11 | E10 前端 Evidence | 补窗口链、红点、移动端和截图 | 2 个功能提交 |
| 12 | E11 后台审计 | 让最终人工复审可直接查证 | 1-2 个功能提交 |
| 13 | E12 最终复审 | 更新全部矩阵和结论 | 1 个文档提交 |

## 4. 每阶段固定完成定义

每个阶段完成前必须满足：

- 服务端状态已经落 profile、match、ledger、order、guild 或对应权威对象，不只存在前端 state。
- 前端入口有成功态、失败态、禁用态、空态和刷新态。
- 后台或测试能解释关键状态变化来源。
- 至少新增或更新一组自动化测试。
- 相关矩阵和审查报告同步更新。
- 只 stage 本阶段文件，不混入无关 dirty 改动。

固定验证命令：

```bash
npm run validate:bidking-compat
npm test -w @bitkingdom/match-core -- --run
npm test -w @bitkingdom/server -- --run
npm test -w @bitkingdom/web -- --run
npm run typecheck
npm run build -w @bitkingdom/web
npm run test:playwright
git diff --check
```

如果某阶段没有触及前端，可以说明跳过 Playwright 的理由；最终 E12 不允许跳过。

## 5. 100% Equivalent 最终判定口径

最终可以宣布 100% clean-room 等价时，必须同时满足：

- 52 张表全部从 `Verified` 推进到 `Equivalent / Visual Substitute / Service Simulated` 三类明确结论，不再有“后续补”措辞。
- 80 个 UIWnd 都能在当前前端找到入口、层级和截图证据。
- 1256 个原类群都有目标模块、无需实现原因或替代实现说明。
- 核心竞拍同 seed 回放稳定，局内道具、技能、Bot、结算、复盘都能审计。
- 任务、成就、活动、通行证、商店、市场、排行、协会、好友、邮件、仓库、图鉴、设置、公告、引导都有完整操作闭环。
- 所有经济变化都可在 ledger 中追溯，重复请求幂等。
- 前端桌面和移动端无待开发入口、无明显遮挡、无关键按钮失效。
- 后台能查 profile、ledger、match replay、config parity、activity progress、guild、market、mail、mission。
- 全验证链通过，并有最终审查文档记录命令、截图和例外清单。

## 6. 当前下一步

当前 E0-E12 的代码收口主线已经推进到 `Manual Review Required=0`。下一步不再新增表级等价分类，而是执行最终全验证链并处理任何回归：

1. 固定运行 `validate:bidking-compat / typecheck / test / web build / Playwright / git diff --check`。
2. 若验证失败，只按失败域最小修复，不回滚已有 Equivalent 结论。
3. 若验证通过，提交并推送最终收口批次。
4. 后续工作转为截图归档、体验打磨和任何新发现的 UI/文案/性能问题。
