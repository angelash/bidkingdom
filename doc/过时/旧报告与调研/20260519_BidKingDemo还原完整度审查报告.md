# 20260519 BidKing Demo 还原完整度审查报告

> 2026-05-20 最终复审更新：本报告正文保留 2026-05-19 的缺口审查历史；截至 2026-05-20，后台 review snapshot 已收口到 `52 Verified / 44 Equivalent / 5 Visual Substitute / 3 Service Simulated / 0 Manual Review Required`，配置表层面的人工复审缺口已清零。视觉替代项为 `Emoji / Head / HeroSkin / LanguageListen / Sound`，服务模拟项为 `Dlc / Pay / PurchaseList`。

> 2026-05-19 开发进展补记：已补第一阶段服务端权威状态底座，新增持久化 profile、票券、经济账本、商店购买、邮件领取、比赛奖励写回和后台档案摘要。随后继续补入 `Access / Condition` 基础校验、`Mission.reward` 领奖、`Mail` 附件发放、`BattleItem` 战前携带、`RankReward` 领奖和对应前端操作；第二批又补入交易/拍卖本地挂单、`Activity` 领奖、`Sound / Language / DirtyWords` 设置保存、好友与协会基础状态；第三批补入战中 `BattleItem` 使用/消耗、市场成交/撤单、协会捐献积分。该进展解决了“服务端只承载房间竞拍”的主要缺口，但原类级代码结构拆分、真实交易撮合、协会权限资源流和活动完整玩法仍需继续深化。

> 2026-05-20 继续补记：`Mission` 当前命中的 `Condition` 类型已全部接入运行层。新增 `FinalMatchSummary.auctionStats` 与 `PlayerProfile.auctionStats`，比赛结算会累计玩家竞拍利润、今日利润、成功竞拍次数、最高获得藏品价值和指定 BidMap 的低总值竞拍记录；`Condition` 类型 `19 / 24` 已从 Unsupported 改为 supported，用于驱动“获得指定价值藏品”“沉船密封舱低价值竞拍成功”“今日/累计竞拍利润”等原表任务。

> 2026-05-20 长尾条件补记：继续按原表确认并接入 `Condition` 类型 `5 / 14 / 17 / 18 / 25`，分别对应指定关卡/BidMap、竞拍出价阈值、竞拍失败次数、单次竞拍净利润和当前总资产低于阈值；地图/BidMap 维度统计也已进入 `auctionStats`。当前 24 类真实 Condition 中 22 类已有运行解释，仅 `21 / 22` 因缺少可确认事件来源继续保留 explicit Unsupported。

> 2026-05-20 全条件覆盖补记：`Condition` 类型 `21 / 22` 也已保守接入，分别按收藏等级和北京时间区间解释；空参数时间区间基础行视为无额外限制。当前 24 类真实 Condition 已全部 supported，explicit Unsupported 清零。

> 2026-05-20 任务事件来源补记：`BattleItem` 战中使用现在会写入 `PlayerProfile.conditionStats`，记录总道具使用次数、每日使用次数和指定道具 id 次数；`Condition 6` 已从“解释器支持”推进到“有服务端事件来源”，可驱动每日使用道具、累计使用道具和指定道具成就进度。

> 2026-05-20 Mission UI 补记：任务前端已从 6 个示例任务切换为按原 `Mission` 表全量生成 actionable 任务列表，任务详情不再截断 Mission/Achievement/LevelUp；服务端 `missionProgress` 同步覆盖可展示、有奖励、有条件和刷新型 Mission，避免原表任务有入口但无进度快照。

> 2026-05-20 Mail 状态补记：邮件系统已从“附件领取”补到已读、删除、过期阻断和删除防复活。`Mail.validity_period` 会生成 `expiresAt`，未领附件邮件删除会被服务端阻断，过期邮件不能领取但可删除。

> 2026-05-20 市场补记：交易所/拍卖行已从卖家本地模拟成交推进到跨玩家双边成交；买家付款并获得物品，卖家入账并按 `Item.transaction_tax_rate` 扣手续费，订单记录 `buyerId / buyerName`。

> 2026-05-20 LanguageName 社交补记：好友创建链路已从写死“掌柜好友N”改为读取 `LanguageName` 原表生成稳定随机名，并补 `languageNamesFromSeed` 批量生成 helper，后续 Bot 和地区名入口可复用同一规则。

> 2026-05-20 Area/GuildArea 补记：协会地区快照卡已变成可操作入口，可直接加入或迁入对应 `GuildArea`；服务端迁区保留协会积分和资源，并写入 `guild_join_area / guild_area_change` 账本。

> 2026-05-20 Rank 补记：排行快照接口已支持 `page/pageSize`，并返回 `Rank.isregional / isdated / isrolebased / updown / type` 元信息；排行榜面板可切换 10 个原表榜单并翻页展示。

> 2026-05-20 Sim 补记：`Sim` 快照保留原表 botCount，同时补充当前房间模型可用的 `roomBotCount`；通行证/活动面板的模拟参数卡可以一键套用到战前设置并打开配置页。

> 2026-05-20 Friend 补记：好友状态从单行文本展示推进到可操作列表；添加/移除好友均走服务端 profile 状态和 `friend_add / friend_remove` 账本，前端按 `Head / GuildArea` 展示好友名片。

> 2026-05-20 Cabinet/Number 收益补记：收藏柜陈列收益已进入服务端权威结算，按陈列藏品 `Item.collection_coin` 计算基础小时收益，叠加 `Number.numberbonus` 档位，加到铜钱账本 `collection_income_claim`。

> 2026-05-20 LevelUp 补记：等级领奖已从只读取 `level_reward` 改为合并 `level_reward / bass_reward / big_bass_reward` 三列，同时奖励账本 sourceId 细化到奖励序号，避免同一奖励组多笔铜钱或重复道具被去重。

> 2026-05-20 Dlc 补记：DLC 解锁已读取 `Dlc.dlc_mail` 并通过 Mail 模板投递系统邮件，当前 `4464600` 会投递 `Mail 110`，重复解锁不会重复发信。

> 2026-05-20 ExchangeRestock 补记：交易所兑换已从只展示候选推进到可执行兑换；`ShopItem.price` 中 `1` 扣铜钱，其余 refId 扣库存材料，`ExchangeRestock` 快照返回对应 ShopItem offer，前端按材料库存启停兑换按钮。

> 2026-05-20 GiftPackage 补记：礼包领取已读取 `payId` 并绑定 `Pay` completed 订单，未到账会阻断领取；充值/礼包面板同步展示绑定档位和到账状态。

> 2026-05-20 GuildPoints 补记：协会捐献积分已按 `GuildPoints.profit` 区间命中原表 `points`，不再被本地 `amount / 100` 兜底覆盖；协会面板新增区间捐献入口。

> 2026-05-20 GuildPermissions 补记：协会改职已读取当前职位 `changeRole` 权限并重算目标职位权限，role 2 会收紧资源管理权限，资源领取随之阻断。

> 2026-05-20 RankReward 补记：榜单奖励已按 schema 读取 `activityid / rankid / ranking / reward / extrareward / mailid`；当前同步表奖励列为空，因此领取只登记状态，不再把活动 id 和榜单 id 误发为道具。

> 2026-05-20 Pay/PurchaseList 补记：充值与平台商品页已展示 Pay 价格/订单/Steam 描述，以及 PurchaseList SKU、交易/市场/游戏内/堆叠标记和商店 URL。

> 2026-05-20 ShopItem 排序补记：商店页已按原 `StorePanel / PartyShop_Main` 规则解释 `ShopItem.order`，刷新池返回后仍会按已收录/持有、已买次数、`order` 降序和 `id` 降序重排，避免商品展示停留在生成数组顺序。

> 2026-05-20 Shop 收藏补记：商店商品收藏/取消收藏已按原 `C2S_242 / C2S_244 / C2S_246` 语义补成本地服务端状态；前端商品星标会写入 `PlayerProfile.shopCollections`，商店排序也改为读取真实收藏状态。

> 2026-05-20 GuildPoints 比赛来源补记：协会成员完成对局后，比赛结算会按 `auctionStats` 利润命中 `GuildPoints.profit` 区间并增加协会积分，写入 `guild_points_match` 账本；同一 matchId 幂等。

## 20260519 复评：当前还原度

> 本节是本次继续开发后的最新口径；下方旧审查段落保留为历史问题清单，其中部分 P0/P1 缺口已被后续实现覆盖。

### 总体判断

当前已经不是“核心竞拍 + 外圈配置展示壳”的状态，而是进入了“核心竞拍 + 服务端权威 profile + 多个局外系统可写闭环”的阶段。但它仍未达到 100% BidKing 等价复刻，主要差距从“有没有功能”转移到了“原行为细节、原类级结构、完整活动/协会/交易生态是否等价”。

按当前 demo 目标评估：约 70% 左右。玩家可以完成主链路、获得奖励、消费票券、买商品、带战斗道具、战中使用道具、领取邮件/任务/排行/活动奖励、创建市场订单、成交/撤单、加入协会并捐献。

按原工程全功能等价评估：约 45% 到 50%。配置表已全量登记，但大量表仍是安全包装后的简化解释；原 C# 类群没有按文件/类一对一拆分；真实交易撮合、完整协会权限资源、活动玩法、音频播放、本地化替换、引导流和支付/DLC 模拟仍未完整。

### 维度评分

| 维度 | 当前还原度 | 依据 | 主要缺口 |
| --- | ---: | --- | --- |
| 配置表登记 | 100% | `bidking-compat` 已导出 52 张表，`validate:bidking-compat` 通过 | 表结构已包装，但不是全部字段都有行为解释 |
| 核心竞拍循环 | 80%-85% | `BidMap / Drop / Item / RankMap / Hero / Skill / SkillGroup / SkillEffect / RankAi` 进入 match-core；BidKing 轮次、出价锁定、Bot、结算、回放可跑 | 局内 UI/动画、掌眼细节、异常边界、原数值公式仍非逐行等价 |
| 服务端权威状态 | 70%-75% | profile、ticket、shop、mail、mission、rank、activity、market、guild、battle item 都有服务端入口 | 仍是 JSON store，缺少正式 DB、并发事务、账号体系和完整后台审计 |
| 局外成长经济 | 65%-70% | 商店购买、任务领奖、邮件附件、排行奖励、活动奖励、市场成交/撤单、协会捐献已闭环 | 真实刷新池、复杂奖励类型、成就链、通行证等级、礼包/DLC/Pay 仍简化 |
| 战前/战中道具 | 65%-70% | `BattlePrev_ItemChoose` 可携带，socket `useBattleItem` 可战中消耗并生成 `item` 情报流 | 道具效果按类型简化，不是 64 个 BattleItem 逐个技能效果等价 |
| 前端可操作入口 | 55%-60% | 主界面大多数入口可打开，任务、排行、邮件、商店、交易、协会、通行证、设置已有操作 | 仍有大量配置卡片式页面，缺少原窗口层级、动效、弹窗链和深层交互 |
| 原代码结构复刻 | 20%-30% | 仍主要集中在 `apps/web/src/main.tsx`、`roomManager.ts`、`profileService.ts` | 没有按 `Battle* / BattlePrev* / Shop* / Mail* / Task* / Rank*` 原类群拆模块 |
| 音频/语言/过滤 | 25%-35% | `Sound / Language / DirtyWords` 已在设置页展示并保存设置 | 未真正播放 Sound，Language 还不是全 UI 文案源，DirtyWords 未接输入校验 |

### 已从旧缺口转为已完成或部分完成

- `Ticket`：已由服务端恢复/扣减，开始比赛会扣竞拍票。
- `Shop / ShopItem / Access`：已服务端校验、扣铜钱、写库存、记录限购。
- `Mission / Mail / RankReward / Activity`：已解释奖励列并幂等领奖。
- `BattleItem`：已完成战前携带、库存校验、战中使用、库存消耗和情报流展示。
- `Market / AuctionHouse`：已具备本地挂单、成交、撤单、库存锁定和铜钱入账。
- `Guild / Friend`：已具备基础好友、加入协会、协会积分和捐献。
- `Settings`：已保存 BGM、音量、语言列等 profile settings。

### 仍然不能宣称 100% 的关键原因

1. 原工程有 1256 个 `.cs` 文件和大量 `*Main / *Panel / *Item / *Data / *Reflection` 类，本项目还没有按原类群拆出等价目录和组件结构。
2. `Condition / Access` 解释器已覆盖当前 `Mission` 使用到的全部条件类型，但 `Condition` 表剩余未被任务命中的长尾类型仍需按原触发事件继续 case 化，严格 parity 模式下不能默认放行。
3. `BattleItem` 使用效果是按 `battle_item_type` 聚合生成情报，不是逐个道具、逐个 skill group 的完整原效果。
4. 市场/拍卖行是本地模拟账本，没有真实撮合、买家、手续费、取消规则、价格曲线和刷新池。
5. 协会只有加入和捐献积分，没有职位权限、协会资源产消、地区争夺、成员管理和资源兑换。
6. 活动/通行证只做了 Activity 奖励领取，没有完整页面、任务进度、赛季等级、活动类型面板和时间窗口。
7. `Sound / Language / DirtyWords` 已接设置展示，但未成为全局音频、本地化和输入过滤运行层。
8. 管理后台能看 profile 和 match，但还缺任务事件、市场订单、邮件、协会、活动、经济账本的细分调试页。

### 下一阶段优先级

1. 拆前端结构：先把 `main.tsx` 拆为 `Battle* / BattlePrev* / Shop* / Mail* / Task* / Rank* / Guild* / Market*` 模块，解决“连代码结构也复刻”的硬要求。
2. 扩展解释器：在已覆盖 Mission 命中类型的基础上，把剩余 `Condition / Access / Reward` 长尾类型继续统一 DSL 化，覆盖活动、商店、角色、皮肤、道具、协会等事件来源。
3. 战斗道具深化：按 `BattleItem.skill_group` 接 `SkillGroup / Skill / SkillEffect`，让每个道具效果不再只是类型聚合。
4. 市场和协会深化：补订单买家/手续费/刷新池，以及协会权限、资源、职位和地区积分。
5. 音频/语言/过滤进入运行层：SoundManager、LanguageService、DirtyWords 校验要接进真实 UI 和输入路径。

## 审查范围

- 当前工程：
  - `apps/web/src/main.tsx`
  - `apps/server/src/roomManager.ts`
  - `packages/match-core/src/bidking/compatRuntime.ts`
  - `packages/match-core/src/match.ts`
  - `packages/match-core/src/auction.ts`
  - `packages/match-core/src/bots.ts`
  - `packages/match-core/src/skills.ts`
  - `packages/bidking-compat/src/schema.ts`
  - `packages/bidking-compat/src/parity.ts`
  - `packages/config/src/data.ts`
- reverse 基线：
  - `reverse/bidking/code/source_index_summary.json`
  - `reverse/bidking/code/decompiled/Scripts/*.cs` 类名清单
  - `reverse/bidking/config/tables_tsv`
  - `reverse/bidking/config/table_schema_index.*`
  - `doc/20260518_BidKing代码配置资源提取报告.md`

## 现状证据

- reverse 侧 `Scripts` 业务逻辑共有 1256 个 `.cs` 文件，约 201305 行。
- reverse 侧可见 `*Panel*.cs` 约 94 个，`*Main*.cs` 约 67 个。
- 已提取配置表 52 张，本项目 `BIDKING_PARITY_TARGETS` 也登记了 52 张表。
- 本项目可审查 TS/TSX/CSS/JSON 文件约 98 个，业务主要集中在 `main.tsx`、`roomManager.ts`、`match-core` 和 `bidking-compat`。
- 当前校验通过：
  - `npm run validate:bidking-compat`
  - `npm run typecheck -w @bitkingdom/web`
  - `npm test -w @bitkingdom/match-core`，2 个测试文件、21 个用例通过。

## 严重缺口

### P0：表已登记，但大部分没有变成行为

`packages/bidking-compat/src/schema.ts` 已登记 52 张表，并为关键表定义结构。但许多外圈系统只保留行数据和包装描述，没有对应运行逻辑。

已真正进入竞拍核心的主要是：

- `BidMap`
- `Drop`
- `Item`
- `RankMap`
- `Hero`
- `Skill`
- `SkillGroup`
- `SkillEffect`
- `RankAi`

仍主要停留在展示或未解释的表包括：

- `Mission`
- `Condition`
- `Access`
- `Achievement`
- `Shop`
- `ShopItem`
- `Ticket`
- `Mail`
- `Notice`
- `Pay`
- `PurchaseList`
- `GiftPackage`
- `Dlc`
- `Guild*`
- `Rank`
- `RankReward`
- `Activity`
- `Sim`
- `Sound`
- `Language`
- `DirtyWords`
- `UIWnd`
- `Guide`
- `Emoji`
- `WareHouse`
- `ItemRestock`
- `ExchangeRestock`

影响：配置表数量达标不等于功能还原达标。现在很多表只是能“看到”，不能驱动玩法、条件、奖励、购买、领取、刷新、解锁、音频、本地化或网络状态。

### P0：服务器只承载房间竞拍，不承载原游戏外圈系统

`apps/server/src/roomManager.ts` 当前负责：

- 创建/加入/重连房间
- 选角色
- 选 BidMap
- 开始比赛
- 出价/放弃/用技能/表情
- 推送个人快照
- 机器人出价

没有看到以下服务端系统：

- 账号登录与角色档案服务
- 持久化背包/仓库
- 商店购买与刷新
- 货币扣减与充值发放
- 门票恢复与消耗
- 邮件发送/领取附件
- 任务进度与条件结算
- 成就解锁
- 好友
- 公会/协会
- 排行榜
- 交易/拍卖行订单
- 敏感词过滤
- 多语言配置下发

影响：外圈 UI 即使补完，缺服务器状态也不能做到原流程等价。

#### 服务端需求分析

服务端不能继续只做“房间中转”。如果要让 52 张表真正变成可玩的 BidKing 式 demo，服务端需要成为局外成长、经济、社交和竞拍结算的权威状态源。最低需求如下：

1. 账号与档案  
   维护 `playerId/sessionId`、昵称、头像、等级、经验、货币、票券、图鉴、背包、皮肤、设置、任务和成就状态。当前前端 `localStorage` 可以作为兜底，但不能作为权威来源。

2. 配置启动包  
   提供版本化 config bootstrap，向前端下发当前表版本、入口开关、资源键、公告、错误码、声音键、引导节点和敏感词过滤版本。这样前端 UI 不再散落读取全量表和手写入口状态。

3. 条件与奖励解释器  
   服务端统一解释 `Condition / Mission / Achievement / Access / ShopItem.front` 和奖励数组，输出本项目安全类型：货币、经验、道具、票券、头像、皮肤、邮件附件、通行证经验等。

4. 经济账本与库存  
   所有货币变化、物品发放、门票变化、商品购买、邮件领取、比赛奖励都写入同一套 transaction ledger，支持幂等 `sourceId`，避免刷新页面或重连重复领奖。

5. 门票系统  
   `Ticket` 需要在服务端恢复、封顶、购买刷新，并在 `createRoom/startMatch` 前消耗。竞拍入口不能只看前端展示的票券数量。

6. 任务、成就和等级  
   比赛结束、使用技能、点亮图鉴、购买商品、领取邮件、完成交易等事件进入 event bus，由任务/成就服务按 `Condition` 求值并发放奖励。

7. 商店与刷新  
   `Shop / ShopItem / ItemRestock / ExchangeRestock / Access / Ticket` 需要服务端维护商品状态、限购次数、刷新时间、随机池权重、前置条件、价格扣减和奖励发放。

8. 邮件、公告和错误码  
   邮件应有 inbox 状态、已读、附件领取、删除和模板实例化；公告应支持启动弹窗、轮播和版本有效期；错误码应统一映射到服务端业务错误。

9. 排行榜、交易与拍卖行  
   `Rank / RankReward` 需要服务器排行快照和领奖记录；交易所/拍卖行需要订单、价格、余量、竞价日志和取消/成交事务。demo 阶段可先做本地模拟账本，不接真实线上市场。

10. 好友、公会和社交  
    `Friend* / Guild* / Area / LanguageName / Emoji / DirtyWords` 对应好友列表、申请、协会职位权限、地区积分、昵称生成、表情和输入过滤。早期可先做单机/本地假数据，但接口形态要按服务端状态设计。

11. 战斗集成  
    `BattleItem` 的携带、消耗和战中使用必须由服务端校验；比赛结束的奖励、图鉴点亮、任务事件和排行积分也必须由服务端结算后推送 profile 更新。

#### 服务端设计

建议把 `apps/server/src/roomManager.ts` 从“唯一业务入口”降级为战斗房间模块，在服务端新增一层业务服务：

```text
apps/server/src/
  services/
    profileService.ts        # 档案、等级、设置、图鉴、背包汇总
    configBootstrapService.ts# 表版本、入口开关、公告、错误码、资源键
    conditionService.ts      # Condition / Access / Mission 条件解释
    rewardService.ts         # 奖励数组解释与发放计划
    economyService.ts        # 货币、票券、库存 transaction ledger
    ticketService.ts         # Ticket 恢复、消耗、购买刷新
    missionService.ts        # Mission / Achievement 事件结算
    shopService.ts           # Shop / ShopItem / Restock 购买刷新
    mailService.ts           # Mail 模板实例、附件领取
    rankService.ts           # Rank / RankReward 快照和领奖
    tradeService.ts          # Exchange / AuctionHouse 本地订单模拟
    socialService.ts         # Friend / Guild / Area 本地模拟
    textGuardService.ts      # DirtyWords、昵称/聊天过滤
  storage/
    store.ts                 # 存储接口
    memoryStore.ts           # 测试/演示默认
    jsonFileStore.ts         # 本地可持久 demo 存储
```

核心设计原则：

- 先抽象 `Store`，demo 默认用 memory/json file，后续再换 SQLite 或正式数据库。
- 所有服务只接受安全包装表和本项目 DTO，不暴露 reverse 原始文本或资源。
- 所有奖励发放走 `economyService.applyTransaction(sourceId, changes)`，避免重复发放。
- `roomManager` 只负责实时竞拍；进入房间、开始比赛、结算比赛时调用 `ticketService`、`missionService`、`rewardService`。
- 前端通过 `profileUpdated / shopUpdated / mailUpdated / missionUpdated / ticketUpdated` 等 socket 事件刷新，不再自行推导权威经济状态。
- 管理后台需要增加 profile、交易账本、邮件、任务事件、商店状态和排行榜快照的只读调试页。

#### 服务端接口草案

- `GET /api/bootstrap`：配置版本、入口开关、公告、错误码、资源键。
- `GET /api/profile`：当前玩家档案、货币、票券、任务、邮件未读数、商店状态摘要。
- `POST /api/profile/settings`：保存语言、音量、画质、输入等设置。
- `POST /api/ticket/refresh`：刷新并返回最新票券状态。
- `POST /api/shop/buy`：购买商品，校验 `Access / front / price / buycounts`。
- `POST /api/shop/refresh`：消耗刷新资源并重建商品池。
- `POST /api/mail/claim`：领取附件，写入账本。
- `POST /api/mission/claim`：领取任务/成就奖励。
- `POST /api/battle/items/equip`：战前携带道具，校验库存、上限和入口条件。
- `POST /api/trade/order`：创建本地模拟交易/拍卖行订单。
- `POST /api/rank/claim`：领取排行奖励。

`createRoom/startMatch` 也需要改成服务端流程：

1. 校验 `Access`：地图、角色、皮肤、道具是否可用。
2. 刷新并校验 `Ticket`。
3. 消耗门票，写 transaction。
4. 固化本局 loadout：角色、皮肤、战前道具、地图、随机种子。
5. 比赛结束后写 match result event，由任务、排行、图鉴、奖励服务统一结算。

#### 服务端验收标准

- 关闭浏览器再进入，货币、票券、任务、邮件、商店限购和图鉴状态不丢。
- 竞拍入口必须由服务端扣票，票不足不能开局。
- 同一场比赛结算重复推送不会重复发奖励。
- 商品购买、邮件领取、任务领奖都有 transaction 记录。
- 前端所有经济数字来自 profile snapshot，不再由本地手写状态自行计算。
- 管理后台能查看玩家档案、账本、任务事件、邮件状态、商店状态和本局战斗结果。

### P0：代码结构没有按原类结构复刻

reverse 侧存在明确的 UI/业务类群，例如：

- 战斗：`Battle_Main`、`Battle_Handler`、`Battle_Player`、`Battle_SkillShow`、`Battle_EmojiPanel`
- 战前：`BattlePrevPanel_Main`、`BattlePrev_HeroChoose`、`BattlePrev_ItemChoose`、`BattlePrev_BattleSet`
- 情报：`BattleIntelligence_Main`、`BattleIntelligence2_Main`、`BattleIntelligence_Main3`
- 竞拍行/交易：`AuctionPlacePanel_Main`、`AuctionDetails_Main`、`TradingExchange_Main`
- 商店：`ShopItem`、`ShopItem_CostItem`
- 邮件：`Mail_Main`、`Mail_InfoPanel`、`Mail_RewardItem`
- 好友：`Friend_Main`、`Friend_Panel1/2/3`
- 任务/成就：`Task_Main`、`AchievementBadge_Main`、`AchievementGot_Main`
- 通行证/活动：`BattlePass_Main`、`ActivityCenter`
- 设置/声音：`Setting_Main`、`SoundManager`

当前 Web 侧大多集中在单个 `apps/web/src/main.tsx`，外圈模块多为 React 函数组件加配置卡片，并不是逐 C# 类的一对一结构。

影响：如果目标是“连代码结构也复刻”，当前结构不满足。

## 模块审查

### 1. 配置兼容层

状态：表数量完整，功能解释不完整。

已完成：

- 52 张表数量校验。
- 关键竞拍表有 typed schema。
- `validate:bidking-compat` 通过。

缺口：

- `Language`、`DirtyWords` 等敏感/文本表采用本项目包装或占位描述，不能视为原文本/原本地化复刻。
- `Condition` 只有结构，没有条件求值引擎。
- `Access` 只有结构，没有解锁判定。
- `Mission` 有结构，但任务系统没有按原条件与奖励驱动。
- `ShopItem.front`、`price`、`buycounts`、`rate` 没有完整购买/刷新/限购解释。
- `Sound` 有结构，没有音频播放和事件绑定。

### 2. 核心竞拍/仓库

状态：部分还原，是当前最接近可玩的部分。

已完成：

- `compatRuntime.ts` 使用 `BidMap` 生成仓型。
- 使用 `Drop` 与 `Item` 抽取藏品。
- 使用 `RankMap` 推导时长和最低价。
- 使用 `auction_rounds_rate` 做 BidKing 严格成交线。
- UI 上有战前地图选择、进入房间、竞拍、揭示、结算。

缺口：

- `Auction.cs`、`AuctionContainerPanel.cs`、`AuctionPanel_Slot.cs`、`Battle_Main.cs`、`Battle_Handler.cs` 没有逐类复刻。
- 仓库格子、道具占格、UI 动画、揭示节奏、特殊焦点弹窗、结果面板与原类群并不等价。
- `WareHouse` 表和 `WareHousePanel` 类群没有形成完整仓库/背包系统。
- 竞拍模式、押金、暗拍/明拍等是本项目现有机制与 BidKing 表驱动混合，不是逐方法还原。

### 3. 技能/情报

状态：表驱动的线索生成已接入，但不是完整技能系统。

已完成：

- 使用 `Hero`、`Skill`、`SkillGroup`、`SkillEffect` 生成自动/手动线索。
- 使用技能 CD 控制。
- 可在战斗中使用技能并写入 skill feed。

缺口：

- `BattleIntelligence_Main`、`BattleIntelligence2_Main`、`BattleIntelligence_Main3` 三类情报面板没有按原面板逻辑拆分。
- `SkillEffect.Category` 只解释成若干类线索文本，没有覆盖原效果的全部目标、范围、触发、BUFF、可见性和面板表现。
- `BattleItem`、`Battle_ItemUse`、`Battle_ItemUseContainer` 尚未形成战前/战中道具使用系统。
- `Battle_BuffItem`、`Battle_BuffItems`、`Battle_BuffItemTip` 没有等价运行时。

### 4. 战前选择

状态：地图/角色选择部分可用，道具设置仍是待开发。

已完成：

- 战前 `BattlePrevPanelView` 可选 BidMap。
- 可选角色/皮肤展示的一部分。
- 可启动核心竞拍。

缺口：

- `BattlePrev_ItemChoose`、`BattlePrev_BattleSet` 当前在 UI 中明确显示为待开发。
- `BattleItem` 表没有用于战前道具格、消耗校验、携带上限、战中触发。
- `Access` 没有驱动地图/角色/皮肤/功能解锁。

### 5. 任务/成就/等级

状态：本项目硬编码任务加少量表展示，不是原任务系统。

已完成：

- `TaskDetailPanel` 展示本项目任务。
- `Achievement` 表展示前几行。
- `LevelUp` 用于等级所需收藏值兜底查询。

缺口：

- `Mission` 表没有驱动任务列表、刷新周期、前置任务、奖励、可选奖励。
- `Condition` 表没有统一求值。
- `Achievement` 没有原成就条件、Steam 成就、领取弹窗、徽章 UI。
- `Task_Main`、`Task_Item`、`AchievementBadge_Main`、`AchievementGot_Main` 未按类群复刻。

### 6. 商店/门票/经济

状态：商店是配置浏览器，不是交易系统。

已完成：

- `ShopPanelView` 可按 `Shop` 切 tab，显示 `ShopItem` 和 `Ticket` 上限。

缺口：

- 没有购买按钮与交易事务。
- 没有扣货币、加物品、校验 `front` 前置条件。
- 没有限购、刷新、随机池、权重、刷新票。
- `Ticket` 没有恢复计时、最大上限、购买刷新、进比赛消耗。
- `ShopReflection`、`ShopStatusData`、`ShopItemData` 等网络/状态类没有对应服务端实现。

### 7. 邮件/公告/反馈

状态：配置展示。

已完成：

- `MailPanelView` 展示邮件模板和附件列。
- `FeedbackPanelView` 展示公告与错误码。

缺口：

- 无邮件列表状态、已读状态、附件领取、删除。
- 无公告弹窗/跑马灯/版本公告策略。
- 无错误码到实际请求失败的统一映射。
- `Mail_Main`、`Mail_InfoPanel`、`Mail_RewardItem`、`Notices_Main` 未等价复刻。

### 8. 好友/社交/公会

状态：配置展示。

已完成：

- 好友入口显示头像/名刺资源键。
- 公会入口显示 `GuildResources`、`GuildPermissions`、`GuildPoints`、`GuildArea`。

缺口：

- 无好友列表、申请、搜索、邀请、状态同步。
- 无公会创建、权限、资源、积分、区域玩法。
- `Friend_Main`、`Friend_Panel1/2/3` 和相关 protobuf 状态类没有对应实现。

### 9. 交易/拍卖行/排行

状态：配置展示和本项目战斗排行并存。

已完成：

- `AuctionHousePanelView` 展示 `Rank` 与 `RankReward`。
- `TradePanelView` 展示 `ItemRestock` 与 `ExchangeRestock`。
- 战斗结算有本项目排行榜。

缺口：

- 无拍卖行挂单、竞价日志、价格信息、排序筛选、交易记录。
- 无交易所买卖、刷新、价格信息、余量。
- 无服务器排行榜结算与领奖。
- `AuctionPlacePanel_Main`、`AuctionDetails_Main`、`TradingExchange_Main`、`Rank_Main` 未等价复刻。

### 10. 充值/礼包/通行证/活动

状态：配置展示。

已完成：

- `RechargePanelView` 展示 `Pay`、`GiftPackage`、`PurchaseList`、`Dlc`。
- `PassPanelView` 展示 `Activity`、`RankReward`、`Sim`。

缺口：

- 无支付流程、平台商品、礼包购买、DLC 校验。
- 无通行证经验、等级、奖励领取。
- 无活动中心、活动任务、活动排行、活动社交。
- `Purchase_Main`、`BattlePass_Main`、`ActivityCenter` 未等价复刻。

### 11. 设置/声音/本地化/敏感词

状态：表展示或未接入。

已完成：

- 设置入口展示 `UIWnd` 主窗口。

缺口：

- 无 `Setting_Main` 的输入、语言选择、多选、滑杆等设置持久化。
- `Sound` 表没有接入 `SoundManager`、音效 ID、循环、淡入淡出、最大播放数。
- `Language` 未作为 UI 文案源。
- `DirtyWords` 未接入聊天/昵称/反馈过滤。

### 12. 引导/Emoji/聊天

状态：战斗表情有简化，其他基本未接入。

已完成：

- 房间/战斗中有短表情发送字段。

缺口：

- `Emoji` 表没有驱动表情面板、播放、气泡、资源。
- `Guide` 表没有驱动新手引导。
- `Battle_ChatItem`、`Battle_EmojiPanel`、`Guide_Main`、`GuideManager` 没有等价复刻。

### 13. 资源/美术

状态：本项目生成/批准资源与 reverse 资源参考并存，不是原资源等价。

已完成：

- 竞拍背景、部分藏品图片、图鉴展示可用。
- reverse 资源已在本机分析目录导出，仅作参考。

缺口：

- 当前工作区仍有大量 `apps/web/public/art/generated/bidking/items/*.png` 未提交/变更状态，说明生成素材批次还没稳定。
- 原 UI prefab、sprite、音频、模型、动画没有形成可发布的等价替代集。
- 没有按 `icon_path`、`model_3D`、`Sound.FullPathName` 做完整资源映射。

## 文件级结论

### `packages/bidking-compat/src/schema.ts`

复刻程度：表结构层较高，行为层低。

结论：作为配置兼容层合格，但它不是功能复刻完成证据。后续需要基于这些 schema 增加条件、奖励、商店、门票、访问控制、声音、本地化等解释器。

### `packages/match-core/src/bidking/compatRuntime.ts`

复刻程度：核心竞拍中等，技能/掉落/仓库局部。

结论：这是目前最重要的 BidKing 还原文件。它接入 BidMap/Drop/Item/RankMap/Hero/Skill，但大量逻辑是“转译为本项目抽象”，不是逐类逐方法复刻。技能效果尤其需要继续按 `SkillEffect` 扩展。

### `packages/match-core/src/match.ts`

复刻程度：本项目 match runtime 为主，BidKing 接入为分支。

结论：支持 core mode、阶段推进、快照、线索、结算，但仍保留大量本项目原有容器/线索/脚本局逻辑；不是 BidKing `Battle_Main`/`Battle_Handler` 的结构等价实现。

### `packages/match-core/src/auction.ts`

复刻程度：竞拍结算可玩，原规则覆盖不完整。

结论：已有出价、押金、支付、修复费、结算，但没有逐项对齐 reverse 侧 `Auction`、`AuctionData`、`AuctionPanel_Slot`、`AuctionContainerPanel` 的完整状态与 UI 行为。

### `packages/match-core/src/bots.ts`

复刻程度：AI 参数引用了 `RankAi`，行为简化。

结论：AI 用 `RankAi` 映射风险/虚张/出价容忍，但不是原 AI 逻辑复刻。需要进一步核对 `RankAi` 字段语义和 battle 侧 AI 调用流程。

### `packages/match-core/src/skills.ts`

复刻程度：手动技能入口存在，原技能系统不完整。

结论：入口转到 `compatRuntime`，但缺战前道具、BUFF、技能目标面板、技能展示流程。

### `apps/server/src/roomManager.ts`

复刻程度：实时房间高，外圈服务低。

结论：房间竞拍流程能跑；账号、背包、商城、邮件、好友、公会、排行榜、交易、充值、任务等原系统没有服务端状态。

### `apps/web/src/main.tsx`

复刻程度：主界面入口与核心战斗可演示，外圈多为壳。

结论：`MailPanelView`、`FriendPanelView`、`SettingsPanelView`、`FeedbackPanelView`、`TradePanelView`、`AuctionHousePanelView`、`ClubPanelView`、`RechargePanelView`、`PassPanelView` 和 `ShopPanelView` 多数是配置卡片；`BattlePrev_ItemChoose` 明确待开发。需要拆模块并逐类对齐原 UI 类群。

### `packages/config/src/data.ts`

复刻程度：本项目自定义配置仍较多。

结论：角色、机器人、藏品集合等仍带本项目自定义抽象。若目标是完全复刻，应逐步以 BidKing `Hero`、`HeroSkin`、`Skill`、`RankAi`、`ItemType`、`Cabinet` 等表替换或建立映射。

## 不是 100% 的直接判定

> 本节为 2026-05-19 历史缺口判定，保留用于说明后续 E0-E12 的来源；2026-05-20 最新复审结论见文首和文末更新。

当前不能判为 100% 复刻，原因是：

1. 原工程 1256 个 C# 业务文件，当前没有逐类结构映射。
2. 52 张表虽已登记，但很多表没有行为解释器。
3. Web 外圈大多是配置展示，不是可交互系统。
4. 服务端只管理房间竞拍，不管理账号经济和社交交易状态。
5. 技能、BUFF、战前道具、情报面板没有完整还原。
6. 商店、任务、邮件、好友、公会、交易、充值、通行证、活动、音频、本地化均未完成。
7. 测试只覆盖核心竞拍和兼容层基础，不覆盖全功能等价。

## 建议推进顺序

### 服务端并行前置：先建权威状态底座

1. 新增 `profileService / economyService / ticketService / conditionService / rewardService`，先用 memory/json file 存储。
2. `createRoom/startMatch` 接入 `Ticket` 消耗和 `Access` 校验。
3. 比赛结束统一写 match event，由 `missionService / rewardService` 结算任务、成就、图鉴和奖励。
4. 前端 profile 改为读取服务端 snapshot，`localStorage` 只保留游客 session 和离线兜底。
5. 管理后台增加 profile、账本、任务事件、商店状态的只读调试视图。

### 第一阶段：把“现在就该用”的基础表真正接入

1. 接 `Condition` 统一条件引擎。
2. 接 `Mission`/`Achievement`/`LevelUp` 任务、成就、等级奖励。
3. 接 `Ticket` 门票恢复、消耗、上限、购买刷新。
4. 接 `Access` 解锁判定，用于地图、角色、皮肤、商品、入口。
5. 接 `BattleItem`，补 `BattlePrev_ItemChoose` 与战中使用。

### 第二阶段：把核心商业闭环做成真功能

1. `Shop`/`ShopItem` 购买、限购、刷新、随机池、货币扣减。
2. `Mail` 附件发放与领取。
3. `ItemRestock`/`ExchangeRestock` 交易所刷新与兑换。
4. `Rank`/`RankReward` 服务器排行榜与领奖。

### 第三阶段：拆 UI 结构，按原类群复刻界面

1. 拆 `main.tsx` 为 `Battle*`、`BattlePrev*`、`Shop*`、`Mail*`、`Task*`、`Rank*` 等模块。
2. 每个 reverse `*_Main` 或关键 `*Panel*` 建一份对应 React module。
3. 每个 module 对应一份状态适配器和配置表使用清单。

### 第四阶段：补外围系统

1. 好友/公会。
2. 拍卖行/交易订单。
3. 充值/礼包/DLC/通行证/活动。
4. 设置/音频/本地化/敏感词/引导/Emoji。

## 最终判断

2026-05-19 原判断是：BidKing 配置兼容层已完整登记，核心竞拍可演示，但外圈系统和逐类结构仍处于中早期。

2026-05-20 复审收口后，配置表和运行证据的最终判断更新为：

> 52 张配置表已经全部进入可审计结论：44 张机制等价、5 张视觉替代、3 张服务模拟、0 张人工复审待处理。核心竞拍、局内道具、任务/活动/商店/市场/协会/邮件/排行/仓库/系统表和后台审计均已形成代码、测试与文档闭环。

下一步重点不再是“补表或补 UI 壳”，而是保持最终验证链通过，归档截图证据，并对体验、文案和性能做后续打磨。
