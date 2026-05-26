# 20260526 BidKingdom 原版还原核对报告

## 核对口径

本轮按“玩法 100% 原版还原 + 三国表现包装”核对。数值、流程内核、技能链、掉落、AI、结算、任务、经济限制和局外落账必须回到原版《竞拍之王》；原版后端不可见部分按协议推断做到客户端可观测等价。角色名、称号、剧情、美术、音频和 UI 皮肤可以三国化。

原版线上服务端源码不可见的逻辑，不作为阻塞项。缺后端源码时按协议推断实现：以 `GameData`、`UserLog`、`HeroSkillLog`、`MapSkillLog`、`ItemSkillLog`、`NextRoundTime` 等协议字段，Unity 客户端消费行为，原始配置表和旧 Demo 可验证片段为依据，补齐当前后端权威逻辑。

## 来源等级

| 等级 | 含义 | 可作为 |
| --- | --- | --- |
| A | 原始配置表、表类、Unity 客户端、协议字段直接证据 | 强约束 |
| B | `GameServerDemo` 中可验证公式或字段意图 | 辅助证据 |
| C | 按协议和客户端展示行为推断出的服务端实现 | 允许实现，需标注 |
| D | 当前工程为 Web/Server 形态补的包装或临时逻辑 | 待复核，不自动视为设计 |

## 总体结论

当前工程已经有一批核心还原基础：52 张 typed 原表、`Hero.cast_type` 技能链、`BattleItem -> itemName_<id> Skill` 映射、`Drop` 递归掉落、`GameData` 形状快照、`RankAi` 参数接入、`bid_fanli` 等经济常量均已有运行入口和测试覆盖。

但仍有几项不能当成“已定设计”：首轮 `warehouse_roll -> warehouse_selected -> auctioneer_reveal` 三段流程、`BidMap.map_group` 随机拍场、公共估值内部生成和 Bot 行为树、`SkillEffect` 系统类/Category 15 处理，需要按原版证据或协议推断重新定级。

## 核对明细

| 模块 | 当前状态 | 判定 | 处理建议 |
| --- | --- | --- | --- |
| 配置表规模 | `@bitkingdom/bidking-compat` 已生成 52 表、19687 行，核心表规模与原版归档一致 | 已对齐，来源 A | 保持 generated 表为游戏性源头，包装字段不得反向影响原表字段 |
| 三国包装名 | `Hero.packaged_name` 等为三国/古代名，`cast_type` 等原字段仍保留 | 可接受包装，来源 D | 继续允许表现替换；验收时检查 `Hero.id/cast_type/Skill` 不被包装改写 |
| 首轮阶段机 | 当前 `match.ts` 和 `roomRoundRuntime.ts` 仍有 `warehouse_roll / warehouse_selected / auctioneer_reveal` | 待修偏差，来源 D | 原版普通局以 `GameData` 回合开始和 `E_OnRoundStartBid` 推进。若保留，应降为纯表现动画，不能改变用道具、出价、技能触发和计时规则 |
| `GameData` 权威快照 | 当前有 `buildBidKingGameDataSnapshot`，能归档 `StockContainer/UserLog/HeroSkillLog/MapSkillLog/ItemSkillLog` | 协议推断可接受，来源 A+C | 后端不可见逻辑按该形状继续补齐，报告中标注为协议推断 |
| 成交线 | 当前用 `getBidKingCloseThreshold = rate / 1000 - 1` 后按领先差距判断 | 基本对齐，来源 A+B | 数学上等价于旧 Demo `maxPrice > secondMax * rate`；继续补边界测试：无人、平价、最终轮、second=0 |
| `BidMap.map_group` | 当前 `bidMapRuntime` 明确保留选择的 BidMap id，不按 `map_group` 重抽 | 待修偏差，来源 D | 原表父拍场带权重子拍场组。需确认原版是实际子 BidMap 还是仅揭示动画；若影响掉落/门槛，应按权重解析实际 BidMap |
| 掉落与仓库 | 当前按 `BidMap.drop_group_id -> Drop -> Item` 递归，并构建仓库格 | 基本对齐，来源 A+C | fallback 分支只能作为容错，不应覆盖原表可解析路线；报告/测试需标注 fallback 未命中即异常 |
| 公共估值 | 当前内部生成 `estimateMin/estimateMax`，客户端因 `estimateHidden` 显示为 0/0，但 Bot 使用内部估值 | 待复核，来源 C+D | 若原版没有公开估值牌，玩家侧隐藏是正确方向；Bot 使用内部估值需标为协议推断或改为 `RankAi + 技能可见信息` |
| 竞买人技能 | 当前测试覆盖 `Hero.cast_type` 自动触发、跨回合技能和目标计数语义 | 基本对齐，来源 A+C | 继续按 `Hero.cast_type -> Skill -> SkillEffect` 验收，不允许手动技能改造原版自动链 |
| SkillEffect 分类 | 1/5/6/7/11 等仓库情报、2/3/4/8/9/10 聚合、12-14 文本、16-28 系统类已有分类；Category 15 仍落入 unsupported | 部分待修，来源 A+C | Category 15 和系统类 16-28 逐项补协议推断说明；可先实现可观测结果，不必等待服务端源码 |
| BattleItem | 当前优先按 `itemName_<BattleItem.id>` 找 Skill，测试覆盖 64 个道具映射 | 基本对齐，来源 A+C | system/unsupported 效果现在会标 `simplified`，需逐项转成原版等价或协议推断实现 |
| Bot / RankAi | 当前读取 `RankAi.role_id/round_count/min_bid_ratio/item_use_probability/bid_pk/item_usage_group`，但仍有本地行为树和估值模型 | 协议推断可接受但需标注，来源 A+C+D | 原版服务端 AI 不可见；允许按协议推断实现，但文档中不要写成已逐行还原 |
| 局外落账 | 任务、成就、图鉴、收藏柜、协会积分、`bid_fanli` 等已有表驱动入口 | 基本对齐，来源 A+C | 继续补局外协议/客户端行为核对，尤其邮件、排行、活动、委托拍卖等异步落账 |

## 本轮测试

已执行：

```powershell
npm run test -w @bitkingdom/match-core
npm run test -w @bitkingdom/server -- roomBotRuntime roomRoundRuntime
```

结果：

| 测试 | 结果 |
| --- | --- |
| `@bitkingdom/match-core` | 7 个测试文件，118 个用例通过 |
| server `roomBotRuntime` / `roomRoundRuntime` | 2 个测试文件，5 个用例通过 |

## 优先修正清单

| 优先级 | 项目 | 原因 |
| --- | --- | --- |
| P0 | 首轮三段阶段机 | 当前流程可能改变玩家可操作窗口和技能/道具时机，必须与原版 `GameData` 回合推进对齐 |
| P0 | `BidMap.map_group` 实际拍场解析 | 若父拍场没有重抽子拍场，会影响掉落、门槛、场景名和随机揭示仪式 |
| P1 | Bot 估值来源 | 当前 Bot 使用内部估值，需确认这是否是协议推断服务端信息，还是应只依赖可见情报和 `RankAi` |
| P1 | SkillEffect Category 15/16-28 | 必须从“结构化解释/简化”升级为原版等价或明确协议推断实现 |
| P1 | 公共估值展示口径 | 玩家侧隐藏已符合“不完整信息”方向，但 UI 是否应存在估值牌要按原版 `Battle_Main` 再核 |
| P2 | 局外异步系统 | 任务、邮件、排行、协会、商店、委托拍卖已接表，但还需要按 UIWnd/协议逐项验收 |

## 后续执行原则

开发时不用再卡在“没有原版后端源码”。只要原版客户端通过协议字段消费某个结果，就可以按协议推断实现服务端逻辑；实现后必须在测试和文档中写清楚它的证据等级。拿到更强证据时，再把协议推断替换为更精确的还原。
