# 20260526 BidKingdom 策划归档 08 AI 与 Bot

## RankAi 规模

`RankAi` 共 120 行，覆盖 20 个 Hero，每个 Hero 6 行，对应回合 1-6。

## Bot 行为树

Bot 决策由行为树驱动：

1. 情报阶段先判断是否用试宝令。
2. 核心局依赖自动 Hero 技能和试宝令。
3. 竞价阶段在未出价前也可用试宝令。
4. 最后根据协议推断的隐藏估值区间、技能可见信息、风险、上一轮排名、成交线和 `RankAi` 参数决定出价或停手。

## 关键 AI 参数

| 字段 | 用途 |
| --- | --- |
| `min_bid_ratio` | 最低出价倾向区间 |
| `bid_pk` | 对抗/压价强度 |
| `item_use_probability` | 使用试宝令概率，分布 0-700 |
| `item_usage_group` | 试宝令掉落组 |
| `bid_time` | Bot 延迟/节奏 |
| `risk_appetite` | 风险偏好 |
| `bluff_chance` | 诈唬倾向 |
| `overpay_tolerance` | 溢价容忍度 |
| `bid_aggression` | 进攻性 |

## 行为树节点

| 顺序 | 节点 | 阶段 | 动作 |
| ---: | --- | --- | --- |
| 1 | `IntelBattleItemSequence` | `intel` | 满足可用次数、概率和道具组时使用试宝令 |
| 2 | `AuctionBattleItemSequence` | `auction` | 出价前判断试宝令是否仍能改变出价 |
| 3 | `AuctionBidSequence` | `auction` | 计算目标价、最高价、最低可出价后出价或停手 |
| 4 | `IdlePersonaAction` | 其他 | 等待或表情 |

`roomBotRuntime.ts` 对每个 Bot 最多连续执行两步，允许“先用试宝令，再出价”；试宝令失败会记录 `bot_action_failed`，竞价阶段失败时该 Bot 进入停手状态。

## RankAi 字段落点

| `RankAi` 字段 | 实现落点 | 说明 |
| --- | --- | --- |
| `role_id` | `rankAiRowForPlayer()` | 由 `Hero.id` 匹配 |
| `round_count` | `rankAiRowForPlayer()` | 由 `state.roundIndex + 1` 匹配 |
| `min_bid_ratio` | `botTuningForPlayer()`、`rankAiMinBidRatio()` | 影响最低出价倾向和最高可承受价 |
| `bid_pk` | `botTuningForPlayer()`、`coreRankAiRoundTargetRatio()` | 影响对抗压力和目标价 |
| `bid_time` | `botTuningForPlayer()`、审计字段 | 记录节奏参数 |
| `item_use_probability` | `shouldUseBattleItem()` | 千分比概率 |
| `item_usage_group` | `rankAiBattleItemChoice()` | 按配置组抽取可用试宝令 |

送拍结果里的虚拟竞买人也读取 `RankAi`：`profileSendAuctionRuntime.ts` 用 `rankAiPressure()` 根据 `min_bid_ratio` 与 `bid_pk` 生成其他竞买人的出价压力，最终成交价写入 `SendAuctionGameData.gameData.userLog.priceLog`。

## 策划理解

Bot 不是只按真实价值出价，而是综合以下信息形成可解释行为：

- 隐藏估值区间中点和估值宽度；玩家侧不展示，Bot 审计标为 `protocol_inferred_hidden_range`。
- 私有技能线索与已显示格位的覆盖程度。
- 拍场风险。
- 自身上一轮出价与排名。
- 回合成交线压力。
- `RankAi` 给出的最低出价、对抗比例和道具使用偏好。

后台事件会记录 `BotActionAudit`，可复盘 Bot 估值、估值来源、信心、目标价、最高可出价、成交线、动作类型和试宝令选择。原版服务端 AI 不可见的部分按协议推断实现，不写作逐行源码还原。
