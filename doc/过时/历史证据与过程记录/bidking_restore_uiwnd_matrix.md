# BidKing UIWnd 窗口映射账本

> 生成时间：2026-05-19。来源：`reverse/bidking/config/tables_tsv/UIWnd.txt`。目标是把 UIWnd 的窗口名、Prefab 路径、层级、BGM、模糊规则映射到本项目 React 窗口注册系统。

## 覆盖摘要

| 项 | 数量 |
| --- | ---: |
| UIWnd 行数 | 80 |
| `apps/web/src/bidking/app/windowRegistry.ts` | 18 |
| `apps/web/src/bidking/app` | 14 |
| `apps/web/src/bidking/battle` | 12 |
| `apps/web/src/bidking/system` | 9 |
| `apps/web/src/bidking/activity` | 5 |
| `apps/web/src/bidking/market` | 5 |
| `apps/web/src/bidking/mission` | 4 |
| `apps/web/src/bidking/rank` | 3 |
| `apps/web/src/bidking/handbook` | 2 |
| `apps/web/src/bidking/package` | 2 |
| `apps/web/src/bidking/battle-prev` | 1 |
| `apps/web/src/bidking/friend` | 1 |
| `apps/web/src/bidking/guide` | 1 |
| `apps/web/src/bidking/hero` | 1 |
| `apps/web/src/bidking/mail` | 1 |
| `apps/web/src/bidking/shop` | 1 |

## 逐窗口矩阵

| Id | 显示名 | 窗口名 | Prefab 路径 | 主窗口 | Layer | BGM | Blur | 目标模块 | 状态 | 100% 接入要求 |
| ---: | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | --- |
| 1001 | 登录界面 | `Login_Main` | `UI/Prefab/Login/Login` | 0 | 1 | `[1]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1002 | 加载界面 | `Loading_Main` | `UI/Prefab/Loading/Loading` | 0 | 6 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1003 | 主页 | `UIMain` | `UI/Prefab/UIMain/UIMain` | 1 | 1 | `[2]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1004 | 飘字 | `BubbleBox` | `UI/Prefab/Common/BubbleBox` | 0 | 5 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1005 | 确认弹窗 | `MessageBox` | `UI/Prefab/Common/MessageBox` | 0 | 5 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1006 | 匹配 | `Match_Main` | `UI/Prefab/Match/Match` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1007 | 战斗界面 | `Battle_Main` | `UI/Prefab/Battle/Battle` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情和回放；最终揭露阶段切至独立 `BattleFinalCeremony` |
| 1008 | 道具详情 | `ItemDetail_Main` | `UI/Prefab/UIMain/ItemDetail` | 0 | 4 | `[]` | 0 | `apps/web/src/bidking/handbook` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1009 | 取名界面 | `SetName_Main` | `UI/Prefab/Common/SetName` | 0 | 1 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1010 | 出售确认 | `SaleConfirm_Main` | `UI/Prefab/Common/SaleConfirm` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1011 | 交易行出售界面 | `TradingExchange_Main` | `UI/Prefab/Trading/TradingExchange` | 0 | 1 | `[]` | 1 | `apps/web/src/bidking/market` | Mapped | 市场窗口接挂单、成交、撤单、竞价和交易记录 |
| 1012 | 交易行购买界面 | `TradingBuy_Main` | `UI/Prefab/Trading/TradingBuy` | 0 | 1 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1013 | 藏品百科 | `BattleIntelligence_Main` | `UI/Prefab/Battle/BattleIntelligence` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1014 | 邮件 | `Mail_Main` | `UI/Prefab/Mail/Mail` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/mail` | Mapped | 邮件窗口接已读、领取、删除、过期和附件发放 |
| 1015 | 出售选择 | `SaleChoose_Main` | `UI/Prefab/UIMain/SaleChoose` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1016 | 自选界面 | `GainChoose_Main` | `UI/Prefab/UIMain/GainChoose` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1017 | 随机选界面 | `GainRandom_Main` | `UI/Prefab/UIMain/GainRandom` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1018 | 获得道具界面 | `RewardsBox` | `UI/Prefab/Common/RewardsBox` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1019 | 设置界面 | `Setting_Main` | `UI/Prefab/Setting/Setting` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1020 | 个人信息界面 | `PersonalInfo_Main` | `UI/Prefab/PersonalInfo/PersonalInfo` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1021 | 头像设置界面 | `SetHeadIcon_Main` | `UI/Prefab/PersonalInfo/HeadIconSet` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1022 | 地区设置界面 | `AreaSet_Main` | `UI/Prefab/PersonalInfo/AreaSet` | 0 | 1 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1023 | 竞拍历史详情 | `AuctionDetails_Main` | `UI/Prefab/PersonalInfo/AuctionDetails` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/market` | Mapped | 市场窗口接挂单、成交、撤单、竞价和交易记录 |
| 1024 | 地图随机界面 | `BattleRandom_Main` | `UI/Prefab/Battle/BattleRandom` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1025 | 排行榜 | `Rank_Main` | `UI/Prefab/Rank/Rank` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/rank` | Mapped | 排行窗口接快照、排名、奖励和领奖状态 |
| 1026 | 任务 | `Task_Main` | `UI/Prefab/Task/Task` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/mission` | Mapped | 任务/成就窗口接进度、领奖、红点和重置 |
| 1027 | 成就徽章 | `AchievementBadge_Main` | `UI/Prefab/PersonalInfo/AchievementBadge` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/mission` | Mapped | 任务/成就窗口接进度、领奖、红点和重置 |
| 1028 | 新手引导 | `Guide_Main` | `UI/Prefab/Guide/Guide` | 0 | 6 | `[]` | 0 | `apps/web/src/bidking/guide` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1029 | 规则描述 | `BattleRule_Main` | `UI/Prefab/Battle/BattleRule` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1030 | 通行证 | `BattlePass_Main` | `UI/Prefab/BattlePass/BattlePass` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1031 | 图鉴 | `HandBook_Main` | `UI/Prefab/PersonalInfo/HandBook` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/handbook` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1032 | 实时情报 | `BattleIntelligence2_Main` | `UI/Prefab/Battle/BattleIntelligence2` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1033 |  | `LevelUp_Main` | `UI/Prefab/LevelUp/LevelUp` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1034 | 一键补齐 | `OneKeyComplete_Main` | `UI/Prefab/UIMain/OneKeyComplete` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1035 | 选择角色 | `ChooseHero_Main` | `UI/Prefab/Battle/ChooseHero` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1036 | 三选一界面 | `ChooseEffect_Main` | `UI/Prefab/Battle/ChooseEffect` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1037 | 公告 | `Notices_Main` | `UI/Prefab/Login/Notices` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1038 | 好友 | `Friend_Main` | `UI/Prefab/UIMain/Friend` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/friend` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1039 | 输入密码 | `PasswordBox_Main` | `UI/Prefab/UIMain/PasswordBox` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/activity` | Mapped | 活动/通行证/礼包窗口接时间、奖励、模拟购买和红点 |
| 1040 | 跑马灯弹窗 | `PopUpBox` | `UI/Prefab/PopUpWindows/PopUpBox` | 0 | 7 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1041 | 检视界面 | `Model3DShow_Main` | `UI/Prefab/Collection/Model3DShow` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1042 | 藏品百科 | `BattleIntelligence_Main3` | `UI/Prefab/Battle/BattleIntelligence3` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1043 | 地图界面 | `BattlePrevPanel_Main` | `UI/Prefab/UIMain/BattlePrevPanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/battle-prev` | Mapped | 战前窗口接地图、角色、皮肤、道具、票券和 Access 校验 |
| 1044 | 充值 | `Purchase_Main` | `UI/Prefab/Purchase/Purchase` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/activity` | Mapped | 活动/通行证/礼包窗口接时间、奖励、模拟购买和红点 |
| 1045 | waiting | `Waiting_Main` | `UI/Prefab/Loading/Waiting` | 0 | 6 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1046 | 选择角色2（私人房间用） | `ChooseHero2_Main` | `UI/Prefab/Battle/ChooseHero2` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1047 |  | `TradingPanel` | `UI/Prefab/UIMain/TradingPanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1048 |  | `StorePanel` | `UI/Prefab/UIMain/StorePanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1049 |  | `HeroPanel` | `UI/Prefab/UIMain/HeroPanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/hero` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1050 |  | `PackagePanel` | `UI/Prefab/UIMain/PackagePanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/package` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1051 | 竞买人任务弹窗 | `HeroTaskPanel` | `UI/Prefab/UIMain/HeroTask` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/mission` | Mapped | 任务/成就窗口接进度、领奖、红点和重置 |
| 1052 | 收藏柜奖励 | `CollectAward_Main` | `UI/Prefab/UIMain/CollectAward` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1053 |  | `AchievementGot_Main` | `UI/Prefab/PersonalInfo/AchievementGot` | 0 | 5 | `[]` | 0 | `apps/web/src/bidking/mission` | Mapped | 任务/成就窗口接进度、领奖、红点和重置 |
| 1054 | 添加仓库箱子弹窗 | `AddBagPanel_Main` | `UI/Prefab/UIMain/AddBagPanel` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/package` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1055 | 送拍集装箱界面 | `SendAuctionPanel` | `UI/Prefab/UIMain/SendAuctionPanel` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/market` | Mapped | 市场窗口接挂单、成交、撤单、竞价和交易记录 |
| 1056 | 游戏测试弹窗 | `GameTestPanel_Main` | `UI/Prefab/Battle/GameTestPanel` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/battle` | Mapped | 局内窗口接轮次、出价、技能、道具、表情、结算和回放 |
| 1057 | 拍卖行 | `AuctionPlacePanel_Main` | `UI/Prefab/UIMain/AuctionPlacePanel` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/market` | Mapped | 市场窗口接挂单、成交、撤单、竞价和交易记录 |
| 1058 | 拍卖集装箱界面 | `AuctionContainerPanel` | `UI/Prefab/UIMain/AuctionContainerPanel` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/market` | Mapped | 市场窗口接挂单、成交、撤单、竞价和交易记录 |
| 1059 | 拍卖行出价弹窗 | `BidPop_Main` | `UI/Prefab/UIMain/BidPop` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1060 | 拍卖行上架弹窗 | `PutawayPop_Main` | `UI/Prefab/UIMain/PutawayPanel` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1061 | 协会主界面 | `Party_Main` | `UI/Prefab/Party/Party` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1062 | 协会商店 | `PartyShop_Main` | `UI/Prefab/Party/PartyShop` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/shop` | Mapped | 商店窗口接商品、刷新、购买、限购和错误提示 |
| 1063 | 区域协会排行 | `AreaPartyRank_Main` | `UI/Prefab/Party/AreaPartyRank` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/rank` | Mapped | 排行窗口接快照、排名、奖励和领奖状态 |
| 1064 | 玩家协会排行 | `PlayerPartyRank_Main` | `UI/Prefab/Party/PlayerPartyRank` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/rank` | Mapped | 排行窗口接快照、排名、奖励和领奖状态 |
| 1065 | 玩家协会设置 | `PlayerPartySetting_Main` | `UI/Prefab/Party/PlayerPartySetting` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1066 | 弹出菜单 | `ContextMenuBox` | `UI/Prefab/Common/ContextMenuBox` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1067 | 商店购买弹窗 | `StorePanel_InfoPanel` | `UI/Prefab/UIMain/StorePanel_InfoPane` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1068 | 邀请弹窗界面 | `InvitePanel` | `UI/Prefab/UIMain/InvitePanel` | 0 | 5 | `[]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1069 | 活动中心弹窗 | `ActivityCenter` | `UI/Prefab/Activity/ActivityCenter/ActivityCenter` | 0 | 1 | `[]` | 0 | `apps/web/src/bidking/activity` | Mapped | 活动/通行证/礼包窗口接时间、奖励、模拟购买和红点 |
| 1070 | 引导完毕首次弹窗 | `Gift_First_Main` | `UI/Prefab/UIMain/Gift_First` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/activity` | Mapped | 活动/通行证/礼包窗口接时间、奖励、模拟购买和红点 |
| 1071 | DLC1购买完成弹窗 | `Gift_DLC1_Main` | `UI/Prefab/UIMain/Gift_DLC1` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/activity` | Mapped | 活动/通行证/礼包窗口接时间、奖励、模拟购买和红点 |
| 1072 | 私人房间结算页面 | `BattleRoomEnd_Main` | `UI/Prefab/Battle/BattleRoomEnd` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/settlement/BattleFinalCeremony.tsx` | Mapped | 最终结算已独立呈现赢家、五轮掌眼/出价、逐件揭露、收益明细和线索复盘 |
| 1073 | 订单同步窗口 | `OnlineQA_Order` | `UI/Prefab/OLQA/OnlineQA_Order` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1074 | 在线QA主入口 | `OnlineQA_Main` | `UI/Prefab/OLQA/OnlineQA_Main` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1075 | 联系客服窗口 | `OnlineQA_Upload` | `UI/Prefab/OLQA/OnlineQA_Upload` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1076 | 交易所金币交易弹窗 | `CoinTradingBuyPanel_Main` | `UI/Prefab/Common/CoinTradingBuyPanel` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1077 | 充值疑问轮播弹窗 | `ChongzhiTips_Panel` | `UI/Prefab/UIMain/ChongzhiBanner` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1078 | 充值疑问弹窗 | `BuyErrorPanel_Main` | `UI/Prefab/Common/BuyErrorPanel` | 0 | 2 | `[]` | 1 | `apps/web/src/bidking/app/windowRegistry.ts` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |
| 1079 | waiting | `NetWaiting_Main` | `UI/Prefab/Loading/NetWaiting` | 0 | 6 | `[]` | 0 | `apps/web/src/bidking/system` | Mapped | 系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice |
| 1080 | 验证码弹窗 | `AuthCode_Main` | `UI/Prefab/UIMain/AuthCode` | 0 | 2 | `[]` | 0 | `apps/web/src/bidking/app` | Mapped | 注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为 |

