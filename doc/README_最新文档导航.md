# 最新文档导航

整理时间：2026-05-25

本目录现在按“当前有效依据优先”保留文档。根目录保留最新代码实现镜像、BidKing/竞拍之王分析与设计结果、以及仍有参考价值的基础设计文档；已经执行过或被新实现覆盖的过程计划已移入 `过时/已执行修改计划/`。

## 当前实现镜像

优先阅读这些文档，它们最接近当前代码和玩法实现状态：

- `20260526_BidKing源码配置与核心玩法策划归档.md`：源码配置与核心玩法策划归档索引；具体内容已按主题拆成 `20260526_BidKing策划归档_00_...` 至 `10_...` 多个文件，分别覆盖配置范围、局内流程、BidMap、竞买人、技能披露、试宝令、藏品、限制、AI、局外落账和风险源码索引。
- `20260525_AI驱动BidKing复刻开发心路与操作层技术方案归档.md`：面向制作人/老板的项目开发心路、AI 驱动生产方式和操作层技术方案归档，说明本项目如何从早期 Demo、公开资料分析、本地授权逆向、矩阵化还原、工程实现、测试证据到当前精确纠偏形成完整闭环。
- `20260518_BidKing配置逻辑等价复刻实施计划.md`：当前正在执行的表驱动、配置数量和逻辑等价复刻计划。
- `20260518_BidKing全表全功能等价复刻推进计划.md`：52 张配置表和全功能 clean-room 等价复刻的分批推进计划。
- `20260519_BidKing全功能全结构100还原开发计划.md`：基于最新完整度复评缺口制定的 100% 还原总计划，覆盖 52 张表、1256 个原类映射、服务端、前端、测试和最终验收。
- `20260520_BidKing100还原剩余Equivalent收口执行计划.md`：在 52 表与 M0-M11 均已 Verified 后，继续推进到真正 Equivalent 的剩余工作计划，明确 Activity/通行证、任务事件源、BattleItem/SkillEffect、核心竞拍、市场、协会、仓库、商业、系统表、前端证据、后台审计和最终复审的执行顺序。
- `20260520_BidKing100剩余内容归档与推进记录.md`：当前收口后的剩余内容归档和执行检查单，重点跟踪全验证链、raw key/配置占位文案外露、主要 UIWnd 版面巡检和玩家可见 polish。
- `bidking_restore_class_matrix.md`：M0 基线账本，覆盖 `Scripts` 程序集 1256 个 `.cs` 原类到本项目目标模块的映射。
- `bidking_restore_table_matrix.md`：M0 表行为账本，覆盖 52 张配置表的行数、字段、功能域、owner、当前状态和下一步动作。
- `bidking_restore_uiwnd_matrix.md`：M0 UIWnd 窗口账本，覆盖 80 个窗口的 Prefab、层级、BGM、Blur 和目标 React 模块。
- `bidking_restore_acceptance_matrix.md`：M0-M11 阶段验收账本，记录 100% 还原的阶段状态、必过证据和硬条件。
- `20260520_BidKing100最终验收包.md`：最终复审包，集中记录 review snapshot 契约、后台入口、最终复审清单、验证命令、clean-room 表级边界和剩余处理口径。
- `20260521_BidKing最终Playwright截图证据清单.md`：最终 Playwright 截图证据索引，记录后台、首页、15 个局外窗口、战前、房间/局内和局外动作流的桌面/移动截图输出路径。
- `20260521_BidKing结算阶段独立界面还原记录.md`：记录最终成交后 `EndPrevPanel / BattleRoomEnd` 独立结算仪式的反编译依据、实现范围和桌面/移动 Playwright 真实局内流验证。
- `20260523_BidKing源码工程全模块整理.md`：按源码资产整理反编译代码、协议、配置表、资源索引和原流程模块边界。
- `20260523_BidKing当前实现全模块整理.md`：按当前工程整理 packages/apps/tools 的实现模块、文件规模和责任边界。
- `20260523_BidKing源码实现逐模块还原度审计.md`：基于两份模块整理逐模块给出还原度百分比、代码细节差距和 P0/P1/P2 缺口。
- `20260523_BidKing协议覆盖矩阵.md`：按 Game/Stock/Shop/Sendauction/Warehouse 源码协议逐项对照当前 Socket、REST、快照和事件追踪出口，记录覆盖状态、明拍金额可见性结论和剩余协议差距。
- `20260523_BidKing技能效果BattleItem修复记录.md`：记录 BattleItem 直接 `itemName_<id>` 技能映射、`skill_count=0 -> 999`、源形 hitBoxList、`skilltarget=6/7` 修复和剩余 `skilltarget=10` 差距。
- `20260519_BidKingDemo还原完整度审查报告.md`：当前 Demo 对照 BidKing reverse 类群、52 张表和现有代码后的完整度审查；结论是核心竞拍可演示，但未达到 100% 功能/结构复刻。
- `20260518_竞拍核心复刻Demo当前实现设计文档.md`：当前 Demo 的模块、交互、数据流和实现镜像。
- `20260518_竞拍核心规则重校准需求分析.md`：当前规则校准依据，包含 BidKing 式成交线与随机仓方向。
- `20260518_BidKing系统梳理与三国包装复刻设计报告.md`：最新一次代码、配置、资源梳理后的完整复刻设计。
- `20260518_BidKing藏品与技能原表复刻校准报告.md`：最新藏品数值、占格尺寸、仓库详情、角色技能链路与透明 PNG Prompt 规则。
- `20260517_本地固定端口与服务脚本.md`：本地服务运行和端口约定。

## BidKing 分析与逆向结果

这些文档保留为竞拍之王复刻的依据：

- `20260517_竞拍之王玩法界面调研与当前实现差异.md`：截图和当前实现之间的差异盘点。
- `20260518_BidKing本地素材玩法分析与设计核心归档.md`：本地素材、玩法和包装方向归档。
- `20260518_BidKing_Unity逆向初步盘点.md`：Unity 构建结构、AssetBundle 和程序集初步盘点。
- `20260518_BidKing_Unity_build_inventory.json`：Unity 构建清单数据。
- `20260518_BidKing代码配置资源提取报告.md`：代码、配置、图片、音频、模型提取结果。
- `20260521_BidKing逆向资料快速查询索引.md`：逆向证据、配置表、代码索引、资源索引和当前实现之间的快速查询入口。
- `竞拍之王玩法复刻实现方案.md`：玩法复刻总体方案。

## 基础设计与历史基线

这些不是最新实现镜像，但仍可作为产品和架构背景：

- `多人暗拍博弈游戏详细设计文档.md`：早期完整玩法设计基线。
- `20260517_BS内部试验Demo需求分析与技术方案归档.md`：Demo 早期需求与技术方案归档。

## 已归档到过时目录

以下类型已经移入 `过时/已执行修改计划/`，不再作为当前开发依据：

- 已执行的珍宝局核心复刻包装化修改计划。
- 已执行的功能补强、后台回看、美术资产生成计划。
- 已完成的逐模块核对与迭代计划。
- 已生成并执行过的美术资产提示词清单。

## 当前最新状态摘要

- 核心竞拍体验已按 BidKing 方向校准：同仓五轮、明暗拍、成交线阶梯、随机仓、掌眼情报、四人五轮轨迹和最终开箱结算。
- 新一轮实施已继续落地：新增 `@bitkingdom/bidking-compat`，按 `BidMap / Item / Drop / Hero / Skill / SkillEffect / RankMap / RankAi` 等表名建立等价运行层；核心模式已从 `BidMap + Drop + Item` 生成仓库和掉落，成交线从 `auction_rounds_rate` 读取，`RankMap` 控制拍卖时长和最低出价，`Hero/Skill/SkillEffect` 驱动自动与手动情报，实时情报和局外图鉴候选库也已切到兼容 `Item`。
- 已结合本地截图、实录抽帧和反编译 UI 链路修正大厅定位：`Snipaste_2026-05-18_10-35-43.png` 是真实主界面，当前已改为顶部玩家/资源、中央木框大展板、右侧快捷货架、底部六模块导航和右下大 `竞拍` 按钮；`竞拍` 已先进入战前地图/地点详情/角色道具设置层，再确认到房间准备页。外层系统入口已按 windowRegistry 接入对应功能面板，局内保持全屏仓库 HUD、左侧 5 轮轨迹、中央信息流、右侧 Loot 格和底部竞价条。
- 最新 UI 框架补齐了 `HeroPanel` 竞买人、`HandBook_Main` 藏品百科和 `PackagePanel` 背包三条链路：竞买人按 `详情 / 外观 / 语音`、角色展示、技能说明和头像矩阵组织；藏品百科按品质/类型/占位筛选和两列藏品卡片组织；背包按道具网格、详情、可选奖励和 `使用` 操作组织。主界面右侧中段已纠正为纯底图/货架装饰，不再承载业务展示。
- 最新视觉修正已去掉主界面无数据来源的红点/叹号角标，并把首页与局外面板高亮色从 BidKing 式荧光色回收到《珍宝局》的木、纸、金、朱、玉色体系。
- 最新藏品校准已改为原 `Item` 表数值镜像：1136 行保留原 ID、类型数组、品质、`base_value`、`slot_type`、`collection_coin` 等字段；仓库/百科去掉此前自创的破损、赝品、修复费展示，基础收益按 `collection_coin * 3600` 还原为每小时收益。角色技能也改为按 `Hero.cast_type -> Skill -> SkillEffect.Category` 链路解释。
- 2026-05-19 完整度审查确认：52 张表已经登记校验，核心竞拍使用了 BidMap/Drop/Item/RankMap/Hero/Skill/SkillEffect/RankAi 的一部分；但任务、条件、成就、商店、门票、邮件、好友、公会、交易、充值、通行证、活动、声音、本地化、敏感词、引导、Emoji 等仍主要是配置展示或未接入，不可判定为 100% 还原。随后已按 100% 总计划完成 M0 基线账本：1256 原类、52 表、80 UIWnd 和 M0-M11 验收矩阵，并推进到 M1/M2/M3/M4/M5/M6/M7/M8/M9/M10/M11 `Verified`；最新结构推进已把后台页面拆到 `apps/web/src/bidking/admin/AdminDashboard.tsx`，服务端入口改为 `serverApp + routes/*` 工厂化注册，并新增 route 级冒烟测试；局外和局内入口 `mail/friend/system/rank/market/guild/activity/shop/task/package/bidder/catalog/cabinet/intel/battlePrev/settlement/battle/room/home` 面板已从 `main.tsx` 拆入对应功能目录，BidMap、codex、profile session、profile inventory、profile actions、API client、建议出价、socket runtime、room actions、keyboard layer、match shell、match route、bid composer actions、battle overlay、topbar、live intel actions、replay actions、home/lobby route、match derived state、app state、app navigation、app room sync 和 `BidKingApp` app shell 已拆到对应 domain 文件，`main.tsx` 降到 10 行、`BidKingApp` 降到 212 行；后台审计卡片、逐轮详情和格式化规则已拆入 `AdminAuditPanels.tsx / AdminMatchDetailView.tsx / adminFormatters.ts`，`AdminDashboard.tsx` 降到 287 行；`Access / Condition / Constant` 已有真实表全集测试，Condition 24 类类型已分为 supported/explicit Unsupported，累计竞拍类型 20 已运行化，Reward 已覆盖 Mission/Mail/Activity/GiftPackage/RankReward 来源表；`BattleItem / SkillGroup` 已有 64 个战斗道具全量连通性测试和同 seed 核心竞拍回放确定性测试，match-core 测试增至 50 个；SQLite 重开持久化、profile ledger、match events/transactions、后台 ledger 筛选、admin audit/config parity 和桌面/移动后台 Playwright 已作为 M4 验证证据；M5-M9 新增 `profileRestoreCoverage.test.ts` 与 `systemTables.test.ts`，核心/技能/Bot 补充 `compatRuntime.test.ts` 覆盖，锁定 Head/HeroSkin/Cabinet/WareHouse/Item/ItemType/Mission/Achievement/LevelUp/Number/Ticket/Shop/ShopItem/ItemRestock/ExchangeRestock/GiftPackage/Pay/PurchaseList/Dlc/Rank/RankReward/Area/GuildArea/GuildPermissions/GuildPoints/GuildResources/LanguageName/Activity/Mail/Notice/Guide/DirtyWords/ErrorCode/UIWnd/Sound/Language/LanguageListen/Emoji/Hero/RankAi/Sim/Skill/SkillEffect/BidMap/Drop/Map/RankMap 的表驱动验收，服务端测试增至 46 个、Web 测试增至 4 个，表矩阵当前 52 张均为 `Verified`；profile actions 已按 commerce/progress/social/preference 子域拆分，服务端 profile 表驱动 helper 已拆到 `domain/profile` 与 `domain/economy`，其中档案生命周期已拆入 `profileLifecycle.ts`，公告/引导/随机名系统行为已拆入 `profileSystemRuntime.ts`，交易市场状态机已拆入 `profileMarketRuntime.ts`，支付/PurchaseList/DLC 订单状态机已拆入 `profilePurchaseRuntime.ts`，战斗道具状态机已拆入 `profileBattleItemRuntime.ts`，头像/收藏柜/皮肤/设置已拆入 `profilePreferenceRuntime.ts`，邮件/活动/礼包领取已拆入 `profileClaimRuntime.ts`，rank reward 与奖励落库已拆入 `profileRewardRuntime.ts`，profile snapshot/list/ledger 查询已拆入 `profileQueryRuntime.ts`，好友和协会资源状态机已下沉到 `guildRuntime.ts`，商店购买/刷新已下沉到 `profileCommerceRuntime.ts`，profile 服务 API 合约已拆入 `profileServiceTypes.ts`，`profileService.ts` 降到 493 行并达成 500 行以内结构目标；后台对局摘要/公共快照/逐轮回放已拆入 `adminMatchRuntime.ts`，bot 席位/房间快照/lobby 入参归一化已拆入 `roomLobbyRuntime.ts`，战斗道具/表情/reveal 延迟规则已拆入 `roomActionRuntime.ts`，房间生命周期/AI 竞拍/轮次阶段机/广播推送已拆入 `roomLifecycleRuntime.ts / roomBotRuntime.ts / roomRoundRuntime.ts / roomBroadcastRuntime.ts`，`roomManager.ts` 降到 482 行并达成 500 行以内结构目标；后台已补对局状态、档案搜索、账本玩家/资源筛选；`ErrorCode` 已进入服务端 4xx/5xx 统一错误码信封和前端操作失败 toast；`Language / LanguageListen / Sound` 已补 key 解析、playback cue 和设置/竞买人试听触发；`DirtyWords` 已进入市场/拍卖订单备注过滤；`Notice / Guide` 已接启动公告队列、已读写回、引导目标解析和大厅浮层；Emoji 已补局内表情栏、冷却校验、Sound 音效 id 透传、角色/竞买人限制与解锁禁用态；Activity/GiftPackage 已补 duration 时间窗、过期阻断、红点可领取状态和已领禁用态；Shop/ItemRestock 已补 autofresh 到期自动刷新和可刷新提示；Mission/Achievement 已补原表条件目标值、前置链、进度快照、红点状态和 Mission.refreshtype 日/周刷新周期；Playwright 现在会自启动前后端服务。当前验证包含 `validate:bidking-compat`、全仓 typecheck/test、Web build 和桌面/移动 Playwright 冒烟。
- 2026-05-20 最新推进：`FinalMatchSummary / PlayerProfile` 已补 `auctionStats`，比赛结算会累计竞拍利润、今日利润、成功竞拍次数、最高获得藏品价值和 BidMap 低总值竞拍记录；`Condition` 类型 `19 / 24` 已运行化，Mission 当前命中的条件类型已无 Unsupported，match-core 测试增至 52 个。
- 2026-05-20 长尾条件推进：`Condition` 类型 `5 / 14 / 17 / 18 / 25` 已按原表接入指定关卡/BidMap、出价阈值、竞拍失败次数、单次利润和当前总资产判断；当前 24 类真实 Condition 中 22 类 supported，仅 `21 / 22` 保留 explicit Unsupported，match-core 测试增至 54 个。
- 2026-05-20 Condition 全覆盖：`Condition` 类型 `21 / 22` 已按收藏等级和北京时间区间保守解释，当前 24 类真实 Condition 全部 supported，explicit Unsupported 清零，match-core 测试增至 55 个。
- 2026-05-20 任务事件来源继续补齐：`PlayerProfile.conditionStats` 已记录 BattleItem 总使用次数、每日使用次数和指定道具使用次数；`Condition 6` 现在可驱动每日道具任务、累计使用道具任务和指定道具成就，match-core 测试增至 56 个。
- 2026-05-20 Mission UI 全量补齐：前端任务定义已从 6 个示例任务改为按原 `Mission` 表全量生成 actionable 任务，任务详情展示完整 Mission/Achievement/LevelUp 链路；服务端 `missionProgress` 与前端同口径覆盖可展示、有奖励、有条件和刷新型 Mission，Web 测试增至 6 个。
- 2026-05-20 Mail 状态补齐：`Mail.validity_period` 已生成过期时间，邮件已读、删除、附件删除保护、过期领取阻断和删除后不复活进入服务端状态；前端邮件面板新增标记已读/删除/过期展示，服务端测试增至 47 个。
- 2026-05-20 市场双边成交补齐：全服交易/拍卖订单现在支持买家付款收货、卖家扣手续费入账，并在订单上记录 `buyerId / buyerName`；前端全服订单可直接购买/竞得，服务端测试增至 48 个。
- 2026-05-20 LevelUp 奖励列补齐：等级领奖已合并 `level_reward / bass_reward / big_bass_reward` 三组原表奖励，奖励落库 sourceId 细化到奖励序号，避免同组多奖励被幂等吞掉；服务端测试增至 49 个。
- 2026-05-20 Dlc 邮件补齐：DLC 解锁现在读取 `Dlc.dlc_mail` 并按 `Mail` 模板投递系统邮件，`4464600 -> 110` 已有服务端测试覆盖。
- 2026-05-20 ExchangeRestock 兑换补齐：`ShopItem.price` 已支持道具材料扣减，`ExchangeRestock` 快照返回可兑换项与材料价格，交易所面板可直接兑换并按库存禁用；服务端测试增至 50 个。
- 2026-05-20 GiftPackage 支付门槛补齐：礼包领取现在读取 `GiftPackage.payId`，要求对应 Pay 模拟订单 completed 后才能领取；充值/礼包面板展示绑定档位与到账状态。
- 2026-05-20 GuildPoints 区间积分补齐：协会捐献命中 `GuildPoints.profit` 区间时严格使用原表 `points`，协会面板新增区间捐献按钮；服务端测试增至 51 个。
- 2026-05-20 GuildPermissions 改职补齐：协会职位切换现在读取 `changeRole` 权限，切职后重算目标职位权限并影响资源操作；服务端测试增至 52 个。
- 2026-05-20 RankReward schema 修正：榜单奖励按 `activityid / rankid / ranking / reward / extrareward / mailid` 解释，奖励列为空时只登记领取，不再把活动 id/榜单 id 误发成道具。
- 2026-05-20 Pay/PurchaseList SKU 展示补齐：充值页展示 RMB/USD、订单描述、Steam 描述、平台商品 itemdefid、价格分类、交易/市场/游戏内/堆叠标记和商店 URL 跳转。
- 2026-05-20 ShopItem 展示排序补齐：`ShopItem.order` 已按原 StorePanel/PartyShop 的降序规则进入兼容层和商店页刷新池展示，前端继续按已收录/持有与已买次数调整优先级。
- 2026-05-20 Shop 收藏补齐：商店商品星标收藏已接服务端 profile 状态、幂等账本和 `/api/shop/collect`，对应原 Shop collect/uncollect 协议。
- 2026-05-20 GuildPoints 比赛积分补齐：协会成员对局结算会按 `GuildPoints.profit` 利润区间增加协会积分，并写入 `guild_points_match` 账本。
- 2026-05-20 LanguageName 好友随机名补齐：好友创建已改为读取 `LanguageName` 原表生成稳定随机名，并新增批量生成 helper 供 Bot/地区名继续复用。
- 2026-05-20 E7 收藏柜/图鉴首批收口：收藏柜陈列已按 `Cabinet.quality_requirement / place_max / max_slot_limit` 校验并支持移出账本；`bidking-compat` 新增 Item 长尾字段解释 helper，藏品百科可按可交易、可拍卖、可陈列、可兑换、可出售、房价等原表开关筛选并展示字段 fact。
- 2026-05-20 E8 商店首批收口：`bidking-compat` 新增 Shop/ShopItem 运行解释 helper，服务端固定商店不再允许手动刷新绕过购买限制，商店页展示随机池数量、自动刷新小时、货币显示、商品随机权重、倍率档和购买 UI 类型。
- 2026-05-20 E8 票券边界补齐：`bidking-compat` 新增 Ticket 运行解释 helper，背包页展示票券恢复/购买/开局策略；房间开局改为先全员票券预检再扣票，避免开局失败产生部分扣票。
- 2026-05-20 E9 UIWnd 运行语义补齐：`bidking-compat` 新增 UIWnd runtime helper，前端窗口 registry 已记录 navigationMode、closeBehavior、CommonSet、ResSet、BGM 和 Blur，80 个原窗口均可解释运行层语义。
- 2026-05-20 E9 ErrorCode 运行语义补齐：`bidking-compat` 新增 ErrorCode runtime helper，服务端错误 envelope 复用同一套 id/messageKey/code 解析和稳定哈希口径。
- 2026-05-20 E9 DirtyWords 社交输入补齐：好友备注与协会公告已接服务端 profile 状态、路由和前端入口，文本按 `DirtyWords` 过滤，协会公告编辑读取 `GuildPermissions.editNotice`。
- 2026-05-20 E6 地区资源奖励补齐：`GuildArea.columns[3] -> GuildResources` 已接 `/api/guild/area/resource/claim`、权限校验、账本和协会地区卡领取按钮。
- 2026-05-20 E11 后台审查快照补齐：新增 `/api/admin/review-snapshot` 与 `AdminReviewSnapshot`，后台可一键导出 audit、config parity、52 表矩阵、Equivalent 汇总和验证命令清单。
- 2026-05-20 E11 Equivalent 分类口径补齐：Config Parity 与 review snapshot 已拆分 `Equivalent / Visual Substitute / Service Simulated / Manual Review Required`，首批 9 表进入 Equivalent、3 表标记服务模拟、5 表标记视觉替代。
- 2026-05-20 E11 Activity 后台审计聚合补齐：`AdminAuditSnapshot` 已按 Activity 表输出活跃/过期/已领/可领/红点/平均进度和 action target 分布，后台新增活动审计面板。
- 2026-05-20 E10 后台 Evidence 冒烟补齐：Playwright 已校验 review snapshot 契约、后台导出入口、桌面/移动后台可达性，并生成可重跑截图证据；`apps/web/test-results/` 和 `apps/web/playwright-report/` 已加入忽略。
- 2026-05-20 E12 最终矩阵摘要补齐：review snapshot 新增 `restoreMatrixSummary`，后台“最终验收摘要”可直接核对 `1256` 类 mapped、`52` 表 `19687` 行、`80` UIWnd mapped、`13` 阶段收口和 `Manual Review 0`。
- 2026-05-20 E12 最终验收包补齐：review snapshot 新增 `finalReviewChecklist` 六项复审清单，后台新增“最终复审清单”，并新增 `20260520_BidKing100最终验收包.md` 作为最终交付索引。
- 2026-05-20 Area/GuildArea 地区入口补齐：协会地区快照卡已可加入/迁入对应地区，服务端迁区保留协会积分与资源并写入地区账本。
- 2026-05-20 Rank 分页与赛季元信息补齐：排行快照已返回地区榜/赛季榜/角色榜/type 等原表字段，接口和面板支持切榜分页。
- 2026-05-20 Sim 快速套用入口补齐：模拟参数快照新增可执行房间 Bot 数，活动/通行证面板可一键套用到战前设置。
- 2026-05-20 Friend 好友列表操作补齐：好友添加/移除已进入服务端 profile 和账本，好友页按头像与地区表展示名片。
- 2026-05-20 Cabinet/Number 陈列收益补齐：收藏柜陈列收益按 `Item.collection_coin` 和 `Number.numberbonus` 在服务端结算并可从背包领取。
- 2026-05-21 经济常量二次收口：市场/拍卖行已读取 `item_bid_* / auction_*` 完成周期、槽位、竞价窗、上架费、阶梯税费、全服上限和高价提示；`mail_max_count` 阻断信箱满上架，`relief_fund_*` 已有低资产主动领取与账本，`cabinet_gaincoin / cabinet_rate / collection_counts_max` 进入收藏收益快照，`bid_fanli` 进入核心竞拍亏损返利结算。
- 2026-05-21 结算仪式收口：最终 `reveal / settlement` 阶段已从局内三栏 HUD 切到独立 `BattleFinalCeremony`，覆盖胜负预告、赢家角色、逐件揭露、竞买排行、五轮掌眼轨迹、结算明细和线索复盘；桌面 1366x768 与移动 390x844 真实局内 Playwright 流已确认 `.battle-final-ceremony` 出现且旧 `.match-layout` 卸载。
- 2026-05-20 E0/E1 Equivalent 收口推进：战斗回合定时器和前端出价面板已补防错、日志和卡阶段快照保活；`Activity` 新增服务端 `/api/activity/progress` 进度快照，通行证/活动页读取服务端红点、时间窗、奖励状态、排行/社交进度和跳转目标。
- 2026-05-20 E2 事件源首批补齐：市场成交会分别记录买家 `tradeBoughtCount` 和卖家 `tradeSoldCount`，Condition 9/10 的买入/卖出任务随 profile snapshot 即时刷新；snapshot 构建统一兜底刷新任务/成就进度。
- 2026-05-20 E2 获得道具事件源补齐：商店购买奖励写入 `shopAcquiredItemIds`，对局揭示藏品写入 `auctionAcquiredItemIds`；Condition 7/8 已有真实 profile 事件来源，并补指定藏品 id 参数解析。
- 2026-05-20 E3 BattleItem 效果计划首批补齐：局内道具使用已输出 `BattleItemEffectPlan`，按 `Skill.skill_count / skill_round / skill_CD / skilltarget* / SkillEffect.Category` 解释 reveal kind、目标模式、数量、冷却、持续回合和实现状态；64 个 BattleItem 全量测试升级为每个道具都有结构化解释计划。
- 2026-05-20 E3 BattleItem 局内状态补齐：match-core 已新增道具冷却私有状态、每轮递减、冷却阻断、目标玩家 payload 入口；前端局内道具按钮展示原表目标、冷却/持续、禁用原因和实现状态，Web 单测覆盖 action state。
- 2026-05-20 E3 BattleItem 后台回放补齐：后台事件时间线已把 `battle_item_used` 的 `BattleItemEffectPlan` 解释成 Skill/Effect/Category、揭示类型、目标模式、冷却、目标玩家和实际线索文本。
- 2026-05-20 E3 BattleItem Playwright 证据补齐：桌面 Playwright 已覆盖真实档案创建、商店购买、装备道具、进局开拍、前端点击 BattleItem 和后台 `battle_item_used` 事件确认。
- 2026-05-23 P1 BattleItem/SkillEffect 源码复核修复：BattleItem 入口已改为 64 个 `itemName_<BattleItemId>` 直接 Skill 映射，`skill_count=0` 按源码作为全量 `999`，道具战报输出源形 `hitBoxList`，聚合类 SkillEffect 不再泄漏完整 BoxInfo，并补 `skilltarget=6` 四元组排序和 `skilltarget=7` 占格筛选测试。
- 2026-05-20 E4 Bot 决策审计首批补齐：Bot action 现在携带 `BotActionAudit`，记录 `RankAi` 行 id、风险/诈唬/溢价/加价参数、估值、最高可出价和下一口价；房间 Bot 执行写入 `bot_action_chosen / bot_action_failed` 事件供后台回放审计。
- 2026-05-20 E4 成交线审计补齐：`RoundBidFeedback.decision` 现在按 `BidMap.auction_rounds_rate` 输出结构化成交/继续/平价加赛/无人出价原因，后台事件时间线可直接展示决策解释。
- 2026-05-20 E4 断线重连审计补齐：房间生命周期新增统一重连恢复 helper，断线/重连会写入 `player_disconnected / player_rejoined` match event，并带当前 round/phase 快照供后台追踪。
- 2026-05-20 E5 市场订单状态机首批补齐：市场/拍卖订单状态扩展为 `listed/locked/sold/cancelled/expired/failed`，新增过期自动返还库存、失败前置校验和前端过期倒计时展示。
- 2026-05-20 E5 上架数量边界补齐：市场订单创建读取 `Item.max_stack_size / max_per_listing` 计算单笔上限，服务端拒绝超量上架，前端库存卡展示单笔上限。
- 2026-05-20 E6 协会捐献权限补齐：协会捐献现在读取 `GuildPermissions.donate`，低权限职位服务端拒绝捐献，前端捐献按钮同步禁用。
- 包装方向保持三国/古代珍宝局：复刻交互和节奏，但资产命名、文案、视觉语汇继续使用本项目包装。
- `reverse/` 和 `doc/videos/` 是本地逆向与视频材料目录，已被忽略，不进入提交。
