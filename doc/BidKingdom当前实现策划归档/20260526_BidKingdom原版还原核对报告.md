# 20260526 BidKingdom 原版还原核对报告

## 核对口径

核对口径为“玩法 100% 原版还原 + 三国表现包装”。数值、流程内核、技能链、掉落、AI、结算、任务、经济限制和局外落账必须回到原版《竞拍之王》；原版后端不可见部分按协议推断做到客户端可观测等价。角色名、称号、剧情、美术、音频和 UI 皮肤可以三国化。

原版线上服务端源码不可见的逻辑，不作为阻塞项。缺后端源码时按协议推断实现：以 `GameData`、`UserLog`、`HeroSkillLog`、`MapSkillLog`、`ItemSkillLog`、`NextRoundTime` 等协议字段，Unity 客户端消费行为和原始配置表为依据，补齐后端权威逻辑。

## 来源等级

| 等级 | 含义 | 可作为 |
| --- | --- | --- |
| A | 原始配置表、表类、Unity 客户端、协议字段直接证据 | 强约束 |
| B | `GameServerDemo` 中可验证公式或字段意图 | 辅助证据 |
| C | 按协议和客户端展示行为推断出的服务端实现 | 允许实现，需标注 |
| D | Web/Server 形态补的包装或临时逻辑 | 待复核，不自动视为设计 |

## 总体结论

工程核心还原基础为：52 张 typed 原表、`Hero.cast_type` 技能链、`BattleItem.id -> Item.id -> Item.skills[0] -> Skill -> SkillEffect` 道具链、`Drop` 递归掉落、`GameData` 形状快照、`RankAi` 参数接入、`bid_fanli` 等经济常量。

固定运行口径：核心状态机从回合开始直接进入 `intel`；父拍场按 `map_group` 权重解析实际子 `BidMap`。公共估值内部生成、Bot 行为树和部分系统类 `SkillEffect` 属于原版后端不可见区域，按协议推断实现并在审计字段中标注。

## 核对明细

| 模块 | 状态 | 判定 | 处理建议 |
| --- | --- | --- | --- |
| 配置表规模 | `@bitkingdom/bidking-compat` 已生成 52 表、19687 行，核心表规模与原版归档一致 | 已对齐，来源 A | 保持 generated 表为游戏性源头，包装字段不得反向影响原表字段 |
| 三国包装名 | `Hero.packaged_name` 等为三国/古代名，`cast_type` 等原字段仍保留 | 可接受包装，来源 D | 表现可替换；`Hero.id/cast_type/Skill` 不得被包装改写 |
| 首轮阶段机 | `match.ts` 首轮直接进入 `intel`；`roomRoundRuntime.ts` 按该阶段调度；前端在 `intel` 内按源条件播放原版 `BattleRandom_Main` 场景随机和 `IntelligencePanel` 情报暗牌动画 | 对齐，来源 A+C | `BattleRandom_Main` 只在匹配入口 `BidMap.map_group` 非空时播放；动画必须保留为纯表现，不改变用道具、出价、技能触发和计时规则 |
| `GameData` 权威快照 | `buildBidKingGameDataSnapshot` 归档 `StockContainer/UserLog/HeroSkillLog/MapSkillLog/ItemSkillLog` | 协议推断可接受，来源 A+C | 后端不可见逻辑按该形状补齐，报告中标注为协议推断 |
| 成交线 | 用 `getBidKingCloseThreshold = rate / 1000 - 1` 后按领先差距判断 | 对齐，来源 A+B | 数学上等价于按 `BidMap.auction_rounds_rate` 判断最高价与第二价关系；边界包含无人、平价、最终轮、second=0 |
| `BidMap.map_group` | `bidMapRuntime` 按 `map_group` 权重解析实际子 `BidMap`，并把 `coreResolvedBidMapId` 用于仓库、GameData 和结算统计；`openingCandidates` 固定来自源父拍场 `map_group` | 对齐，来源 A+C | 父拍场可作为选择入口/表现包装；随机动画候选、掉落、门槛、场景名和随机结果以原表 `map_group`/实际 `BidMap` 为准 |
| 掉落与仓库 | 按 `BidMap.drop_group_id -> Drop -> Item` 递归，并构建仓库格 | 基本对齐，来源 A+C | 原表路线缺失时直接报错，不生成替代路线 |
| 公共估值 | 内部生成 `estimateMin/estimateMax`，玩家侧 `estimateHidden` 显示为 0/0；原版 `Battle_Main.CalYuguPrice()` 按已知格子估算，UI 只展示已知情报估算；Bot 审计标注 `publicEstimateSource=protocol_inferred_hidden_range` | 对齐，来源 A+C | 玩家侧不展示内部总估值；Bot 使用隐藏区间必须保持审计可见 |
| 竞买人技能 | 测试覆盖 `Hero.cast_type` 自动触发、跨回合技能和目标计数语义 | 基本对齐，来源 A+C | 按 `Hero.cast_type -> Skill -> SkillEffect` 验收，不允许手动技能改造原版自动链 |
| SkillEffect 分类 | 1/5/6/7/11 等仓库情报、2/3/4/8/9/10 聚合、12-15 文本、16-28 系统类已有分类；Category 15 为价格指定位文本线索 | 基本对齐，来源 A+C | 系统类 16-28 继续按协议日志和 UI 行为补完整表现；未知 Category 直接报错 |
| BattleItem | 按 `BattleItem.id -> Item.id -> Item.skills[0] -> Skill -> SkillEffect` 解析；64 个源表道具命中 Category 1/2/3/4/5/6/7/8/10/11 | 对齐，来源 A | 缺少 `Item`、`Item.skills`、`Skill` 或 `SkillEffect` 时直接报错 |
| Bot / RankAi | 读取 `RankAi.role_id/round_count/min_bid_ratio/item_use_probability/bid_pk/item_usage_group`，服务端不可见估值和决策按协议推断实现 | 协议推断可接受但需标注，来源 A+C+D | 原版服务端 AI 不可见；允许按协议推断实现，但文档中不要写成逐行源码还原 |
| 局外落账 | 任务、成就、图鉴、收藏柜、协会积分、`bid_fanli` 等已有表驱动入口 | 基本对齐，来源 A+C | 按局外协议/客户端行为核对邮件、排行、活动、委托拍卖等异步落账 |
| 字段级协议映射 | `20260527_BidKingdom策划归档_11_源码比对细化补充.md` 已把 `GameData`、`RoomData`、`SendAuctionGameData`、`MailItemData`、`ShopStatusData` 落到共享类型、运行时、服务端和前端表现文件 | 对齐，来源 A+C | 后续修改这些字段时按该分册核对 |
| 源协议时间单位 | `GameData.ServerTime/NextRoundTime`、`SendAuctionData.SendTime`、`SendAuctionGameData.GameOverTime` 统一按 Unix 秒写入 | 对齐，来源 A | 原版客户端 `TimerTool.ServerTime` 和 `GetLocalTime()` 以秒解释这些字段 |

## 固定约束补充

- 成交线展示统一按领先差距表达：`rate=2000/1600/1300/1100` 分别表示最高价高出第二名 100%/60%/30%/10% 才成交。
- Bot 行为树只产生出价、放弃、试宝令和表情动作；竞买人技能走 `Hero.cast_type -> Skill -> SkillEffect` 自动链，手动 `useSkill` 请求直接报错。
- 资源映射、默认角色和测试数据只允许 20 个源绑定竞买人；非源绑定角色不得进入战斗、资源 manifest 或默认配置。
- 试宝令只按 `BattleItem.id -> Item.id -> Item.skills[0] -> Skill -> SkillEffect` 源链解析，不使用 `SkillGroup` 改写道具技能链。

## 测试记录

已执行：

```powershell
npm run typecheck -w @bitkingdom/match-core
npm run typecheck -w @bitkingdom/server
npm run typecheck -w @bitkingdom/web
npm run test -w @bitkingdom/match-core
npm run test -w @bitkingdom/server -- roomBotRuntime roomRoundRuntime roomLifecycleRuntime profileService routes roomActionRuntime
npm run test -w @bitkingdom/web
```

结果：

| 测试 | 结果 |
| --- | --- |
| `@bitkingdom/match-core` typecheck | 通过 |
| `@bitkingdom/server` typecheck | 通过 |
| `@bitkingdom/web` typecheck | 通过 |
| `@bitkingdom/match-core` test | 7 个测试文件，117 个用例通过 |
| server targeted test | 6 个测试文件，89 个用例通过 |
| `@bitkingdom/web` test | 11 个测试文件，26 个用例通过 |

## 固定核对项

| 等级 | 项目 | 固定口径 |
| --- | --- | --- |
| P0 | 首轮阶段机 | 核心局从回合开始直接进入 `intel` |
| P0 | `BidMap.map_group` 实际拍场解析 | 父拍场按权重解析实际子 `BidMap`，并进入仓库/协议/结算 |
| P0 | 场景随机显示条件 | 只有匹配入口 `BidMap.map_group` 非空才播放 `BattleRandom_Main` |
| P1 | Bot 估值来源 | 隐藏公共估值在 Bot 审计中标为 `protocol_inferred_hidden_range` |
| P1 | SkillEffect Category 15/16-28 | Category 15 为价格指定位文本线索；16-28 不进入源表试宝令链，进入对应协议事件时按协议推断实现；未知 Category 直接报错 |
| P1 | 公共估值展示口径 | 原版 UI 展示的是已知格子估算，内部总估值不直接给玩家 |
| P2 | 局外异步系统 | 任务、邮件、排行、协会、商店、委托拍卖按 UIWnd/协议逐项验收 |
| P2 | 字段级文档索引 | 以 `20260527_BidKingdom策划归档_11_源码比对细化补充.md` 作为工程落点索引 |

## 执行原则

开发时不用卡在“没有原版后端源码”。只要原版客户端通过协议字段消费某个结果，就可以按协议推断实现服务端逻辑；实现后必须在测试和文档中写清楚它的证据等级。证据增强时，用更精确的还原覆盖协议推断。
