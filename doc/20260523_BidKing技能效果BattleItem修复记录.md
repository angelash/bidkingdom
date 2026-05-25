# BidKing 技能效果与 BattleItem 修复记录

日期：2026-05-23

## 本轮结论

本轮修正的是 P1 `SkillEffect / BattleItem` 还原偏差。原先实现把 `BattleItem.battle_item_type` 生成出的 `skill_group` 当作技能入口，再从 `SkillGroup` 随机抽技能；这不是源码主链路。源码配置中 64 个局内道具都能在 `Skill.skill_name` 找到 `itemName_<BattleItemId>` 的直接技能行。

## 源码证据

- `reverse/bidking/code/decompiled/Scripts/Table_BattleItem.cs`：`Table_BattleItem` 只有 `id / item_type_id / item_quality / battle_item_type`，没有 `skill_group` 字段。
- `reverse/bidking/config/tables_tsv/Skill.txt`：例如 `100100 -> Skill 100 / itemName_100100 / [1000]`，`100103 -> Skill 200 / [2000]`，`100121 -> Skill 500 / [10000]`，`100169 -> Skill 10014 / skilltarget=7 / [8000]`。
- `reverse/bidking/code/decompiled/Scripts/GameServerDemo/Utils.cs`：`skill_count == 0` 会转为 `999`，代表全量匹配，不是按品质折算为 1-3 个目标。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：客户端 `DealSkillEffect` 直接显示类只处理 `Category 1/5/6/7/11/22`；`GetSkillParams` 处理 `2/3/4/8/9/10/12/13/14` 的聚合或文本参数。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：`GetSkillParams` 中 `Category 4` 使用 `GameSkillData.HitItemIndex` 作为命中藏品数量；只有当 `HitItemIndex == 0` 且客户端本地还持有完整 `GridItemData` 时才回退到 `datas.Count`。因此 `HitItemIndex` 不是仓库位置索引。
- `reverse/bidking/code/decompiled/Scripts/GameServerDemo/Utils.cs`：服务端 demo 的 `DealSkillEffect` 对 `Category 2/3/4/8/9/10` 分别计算总占格、平均占格、命中数量、平均价格、每格均价、总价格，`Category 4` 明确为 `datas.Count`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/GameSkillData.cs` 与 `ConstantReflection.cs`：`GameSkillData` 字段包含 `HitItemIndex / HitBoxList / AllHitItemAvgPrice / AllHitBoxAvgPrice / AllHitItemAvgBoxIndex / HitItemTotalPrice / TotalHitBoxIndex / HitItemTypeList / HitItemQuilityList`。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：`GetItemSlotIdxs(pos, wareHouseWidth=10)` 使用 `pos + i * 10 + j` 推导占格，说明源 `BoxId` 是线性格位。
- `reverse/bidking/code/decompiled/Scripts/GuideManager.cs`：构造 `StockBoxData` 时 `BoxId=j`，并把 `Position.X=j/10`、`Position.Y=j%10`；源形 `BoxPositionData.X/Y` 是由 `BoxId` 拆出的行/列，不是前端坐标的 `x/y`。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：`Category 12/13/14` 只在 `GetSkillParams` 中分别转成品质文本、品类文本、价格位数；`DealSkillEffect(List<GridItemData>...)` 没有把它们同步进 `BattleGridItemData`，因此不应永久改变仓库格的品质、品类或价值区间可见状态。
- `Skill.txt` 中 `skilltarget=6` 的表值是四元组语义：`[预过滤类型, 预过滤值, 排序字段, 最大/最小]`，例如 `[1,106,3,1]` 表示先筛文物古董类，再按价值取最大。
- `Skill.txt` 中 `skilltarget=7` 用于按占格数筛选，例如 `10014 单格均价` 使用 `[1]`。
- `reverse/bidking/code/decompiled/Scripts/BattleGridItemData.cs`：`hasShowSize()` / `hasShowRank()` / `hasShowAll()` 分别表示轮廓、品质、完整藏品信息是否已知；`Skill.txt` 中 `skilltarget=10` 的 `[2,2,2]`、`[0,1,0]`、`[1,1,0]` 等值应按这些已知/未知状态筛选，不是按真实藏品形状筛选。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：`checkCanUseItem(GameData)` 在当前 `UserLog.UseItemLog` 已存在本回合记录时返回 false，普通对局一名玩家本回合不能再次用道具。
- `reverse/bidking/code/decompiled/Scripts/Battle_Main.cs`：`CalRoundItemUseCount()` 普通局/私人房返回 `1`，训练局读取 `GameData.RoundCanUseItemCount`；`canUseItem` 来自本回合剩余次数。
- `reverse/bidking/config/tables_tsv/SkillEffect.txt`：`16001/16002` 是 `Category 16` 道具携带量上限效果，`21001/21002` 是 `Category 21` 本回合可用道具次数效果。
- `reverse/bidking/config/tables_tsv/SkillEffect.txt`：`25000` 为 `Category 25` 获得道具，参数 `[11,8001,1]`；`27000` 为 `Category 27` 丢弃道具，参数 `[1,11,0]`；`28001/28002` 为 `Category 28` 使用角色技能，分别是指定皮肤 `1410101` 和随机其他角色。
- `reverse/bidking/config/tables_tsv/Skill.txt`：`3041/3042/3054/3065/3066/3067/3068/3071` 是当前表内引用 `Category 25/27/28` 的完整技能集合，触发点包括开局、回合开始、道具耗尽、获得遗物和主动使用。
- `reverse/bidking/code/decompiled/Scripts/Table_Skill.cs`：`Skill` 表直接加载 `skill_active_type / skill_opt / skill_opt_param1 / skill_opt_param2 / skill_cast / skill_round / skill_CD`，这些字段是训练/遗物触发时机、概率、CD 和主动使用边界的源数据。
- `reverse/bidking/config/tables_tsv/Skill.txt`：全表 `skill_opt` 实际取值只有 `0/11/21/31/33/34/41`；其中 `11` 是每局开始，`21` 是回合开始，`31` 是获得遗物，`33` 是使用道具，`34` 是道具耗尽，`41` 按 `skill_opt_param1` 区分揭示品质、轮廓、完整信息触发。
- `reverse/bidking/config/tables_tsv/Skill.txt`：`3068` 的 `skill_cast=[[1,500,0]]` 对应 50% 触发；`3054` 的 `skill_CD=10`；`3072-3081` 的 `skill_opt_param2=[[1,101]]...[[1,110]]` 对应各藏品品类完整信息充能；`3082-3091` 才是 `skill_active_type=1` 的主动使用技能。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs` 与 `PlayerManager.cs`：训练局使用普通携带道具走 `C2S_128/S2C_129 SimGameUseItem`，使用增益道具走 `C2S_156/S2C_157 SimGameUseBuffItem`，成功后由服务端返回 `UpdateGameData` 并播放新增 `GameSkillData`。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：训练局道具使用成功后通过 `GetNoPlaySkills(PlayerGameData.Instance.simGameLog.GameData)` 找新增技能日志，再逐条 `DealSkillDataAsync`；这说明当前工程不能在本地伪造完整 `GameSkillData`，只能先产出事件触发计划和可证状态落点。
- `reverse/bidking/code/decompiled/Scripts/BattleItemData.cs`：训练局从 `GameData.UserLog[].SimBuffItemList` 收集可主动使用的增益道具，再追加 `SimSelectItemList` 普通道具；被动/充能类增益道具虽然不一定可点击，但仍保留在 `SimBuffItemList` 供服务端触发。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`：`SimGameUseItem` 发送 `C2S_128(ItemUid, TargetBoxId)`，成功后读取 `S2C_129.UpdateGameData`；`SimGameUseBuffItem` 发送 `C2S_156(BuffItemCid, TargetBoxId)`，成功后读取 `S2C_157.UpdateGameData`，两者都会重建 `BattleItemData.CreateList(simGameLog)`。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`：`SimGameBidPrice` 发送 `C2S_126(Price)`，响应 `S2C_127` 携带 `IsWin / IsNextRound / NextRoundGameData`。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：训练出价后若 `IsNextRound`，客户端先 `PlayerGameData.UpdateSimGameData(result.NextRoundGameData)`，再 `S2C_OnRoundStartOnTraining2(result.NextRoundGameData)`；该方法从 `MapSkillLog + HeroSkillLog + ItemSkillLog` 中过滤未处理 `Uid`，按 `CastTime` 排序播放。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：训练出价后若 `IsNextRound == false`，客户端不会消费 `NextRoundGameData`，而是在 500ms 后调用 `S2C_OnGameOver(gameData, result.IsWin, price)`。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：训练局 `S2C_OnGameOver(GameData,bool,int)` 会把玩家本轮 `priceNum` 写入拍卖展示，再按 `isWin` 组装 winner/game over 展示数据。
- `reverse/bidking/code/decompiled/Scripts/Battle_Main.cs`：训练战斗结束后先 `PlayerGameData.InitSimGame()`，若 `simGameLog.GameWinItemList.Count > 0`，再 `ChooseEffect_Main.Choose()`、`PlayerManager.ChooseSpecialItem(chooseId)`，成功后再次 `InitSimGame()`。
- `reverse/bidking/code/decompiled/Scripts/IdentifyTrainingPanel.cs`：训练开始前也会先检查 `GameWinItemList`，有待选奖励时必须先选择并 `InitSimGame()` 刷新后才继续进入训练。
- `reverse/bidking/code/decompiled/Scripts/ChooseEffect_Main.cs`：胜利奖励选择 UI 直接读取 `simGameLog.GameWinItemList`，默认选择第一个，倒计时 30 秒后自动确认。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs` 与 `Protodata/C2S_134_sim_game_select_win_item.cs`：选择胜利奖励发送 `C2S_134(Token, ItemCid, DiscardItemUid=0)`；`S2C_135_sim_game_select_win_item` 响应体只有 `ErrorCode`，成功后的权威状态来自下一次 `InitSimGame()`。
- `reverse/bidking/code/decompiled/Scripts/PlayerGameData.cs`：`InitSimGame()` 直接执行 `simGameLog = await PlayerManager.GetSimGameLog()`，是整包替换；这条链路不同于 `UpdateSimGameData(GameData)` 的局部同步。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`：`GetSimGameLog()` 发送 `C2S_130_get_sim_game_log`，成功回包是 `S2C_131_get_sim_game_log`，失败返回 `null`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/S2C_131_get_sim_game_log.cs` 与 `SimgameReflection.cs`：`S2C_131` 字段为 `MaxWinLevel / SimGold / GameWinItemList / SimShopStatus / GameData / Level / SimSelectItemList / SimBuffItemList / SelectItemCount / RoundCanUseItemCount / GameCarryItemMax / GameGoldRateMax`。
- `reverse/bidking/code/decompiled/Scripts/IdentifyTrainingPanel.cs`：训练面板的次数、最高层数、成功率区间读取 `simGameLog.Level / MaxWinLevel`；开始训练前如有 `GameWinItemList` 会先强制选择奖励，再重新 `InitSimGame()`。
- `reverse/bidking/code/decompiled/Scripts/Table_Sim.cs` 与 `reverse/bidking/config/tables_tsv/Sim.txt`：`Sim` 表字段包含 `success_interval / simgold / simdorp / simshop / roudtime`；当前 101 层的 `simdorp` 均为 `801`。
- `reverse/bidking/code/decompiled/Scripts/Table_Drop.cs` 与 `reverse/bidking/config/tables_tsv/Drop.txt`：`Drop 801` 名为“个人模拟测试”，包含 64 个 `item_type=8` 的训练道具候选，权重均为 10，范围从 `8001` 到 `8068`，其中没有 `8045/8048-8050`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/Error.cs`：存在 `Code47SimGameIsNotWin`，说明胜利奖励选择还有服务端胜利状态校验；客户端没有本地决定是否可选。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：`CheckBuffItemCanUsed` 只认 `skill_active_type == 1` 的增益道具，`CheckItemNeedChoose` 只在技能目标为 `skilltarget == 8` 时进入选择目标格；这些说明 `25/27/28` 是训练/遗物状态效果，不是普通仓库情报揭示。
- `reverse/bidking/config/tables_tsv/SkillEffect.txt`：`17000/17001` 对应模拟局每轮货币利息上限，`18001/18002` 对应模拟局商店购买道具格数，`19000` 对应商店折扣概率，`20001/20002` 对应胜负后奖励，`23001/23002` 对应增益道具充能，`24000` 打开模拟竞拍商店 `6`，`26001/26002` 是道具状态改变。
- `reverse/bidking/config/tables_tsv/Skill.txt`：当前表中 `17/18/19/20/24/26` 没有任何 Skill 引用；`Category 23` 只由 `3069/3070/3072-3081` 引用，均为充能触发技能。
- `reverse/bidking/code/decompiled/Scripts/Battle_ItemUse.cs`、`Battle_BuffItem.cs`、`Battle_BuffItemTip.cs`：增益道具 UI 使用 `UserSimBuffItemData.Power/CD` 和 `Item.cost[1]/cost[2]` 判断最大充能与使用消耗。
- `reverse/bidking/code/decompiled/Scripts/IdentifyTraining_ItemBuyPanel.cs`：模拟竞拍商店购买逻辑读取 `SimShopStatus`、`ShopItemData.DiscountRate`、`SimGold` 和 `GameCarryItemMax`，说明 `18/19/24` 是训练商店状态，不是普通 BattleItem 情报。
- `reverse/bidking/code/decompiled/Scripts/Protodata/UserSimSelectGameItemData.cs`：训练局普通携带道具只有 `ItemUid / ItemCid`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/UserSimBuffItemData.cs`：训练局增益道具有 `ItemCid / ItemCount / Power / CD`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/S2C_131_get_sim_game_log.cs`：训练日志顶层包含 `SimGold / GameWinItemList / SimShopStatus / SimSelectItemList / SimBuffItemList / SelectItemCount / RoundCanUseItemCount / GameCarryItemMax / GameGoldRateMax`。
- `reverse/bidking/code/decompiled/Scripts/Protodata/ShopStatusData.cs`、`ShopItemData.cs`：训练商店状态由 `ShopCid / NextRefreshTime / ShopItemList` 组成，商品项为 `ItemUid / ShopItemCid / CanBuyCount / BuyCount / DiscountRate`。
- `reverse/bidking/code/decompiled/Scripts/IdentifyTraining_ItemBuyPanel.cs`：模拟商店商品排序为 `Table_ShopItem.order -> shopItem.id -> DiscountRate -> ItemUid`；价格为 `price[0][1] * DiscountRate * 0.001`；金币不足、售罄、购买次数不足都会阻止购买；携带道具满时会带 `DiscardItemUid`。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`：`SimGameBuyItem` 发送 `C2S_132(ItemUid, DiscardItemUid)`，成功后客户端先把 `{ ItemUid=itemUid, ItemCid=itemId }` 追加到 `SimSelectItemList`，然后 UI 再通过 `InitSimGame()` 拉服务端权威状态。
- `reverse/bidking/code/decompiled/Scripts/ChooseEffect_Main.cs`、`IdentifyTrainingPanel.cs`、`Battle_Main.cs`：`GameWinItemList` 非空时先弹选择框，选择后走 `C2S_134 ItemCid`，成功后重新 `InitSimGame()`；客户端响应体 `S2C_135` 只带错误码。
- `reverse/bidking/config/tables_tsv/SkillEffect.txt`：`20001/20002` 是胜利/失败后获得物品 `1` 的 `500/100` 数量；`26001/26002` 只有状态模式参数 `[1]/[2]`，当前表内没有 Skill 引用；`28001/28002` 是指定皮肤法蒂玛/随机角色技能复用。
- `reverse/bidking/config/tables_tsv/Item.txt`：`Item 1` 是银币，不是模拟币；模拟币是 `Item 6`，训练商店价格也使用 `6:xxx`，因此 `Category 20` 不应被写成 `SimGold` 增减。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`：`UseGameTestSkill` 发送 `C2S_290_test_game_cast_skill(GameUid, ItemCid, SkillCid, HeroCid, MapCid)`，响应 `S2C_291` 携带 `ItemSkillLog / NewGameData / HeroSkillLog / MapSkillLog / SkillLog`，客户端按 `ItemSkillLog -> HeroSkillLog -> MapSkillLog -> SkillLog` 播放技能。
- `reverse/bidking/code/decompiled/Scripts/PlayerManager.cs`、`Battle_Handler.cs`：训练道具/增益道具使用成功后读取 `S2C_129/S2C_157.UpdateGameData`，再通过 `PlayerGameData.UpdateSimGameData()` 同步 `SimSelectItemList/SimBuffItemList`，随后播放尚未处理的技能日志。
- `reverse/bidking/code/decompiled/Scripts/Battle_Handler.cs`：训练道具使用后的 `GetNoPlaySkills(GameData)` 汇总顺序是 `ItemSkillLog -> MapSkillLog -> HeroSkillLog`，只过滤已处理 `Uid`，不按 `CastTime` 重排；下一轮 `S2C_OnRoundStartOnTraining2` 另走 `MapSkillLog -> HeroSkillLog -> ItemSkillLog` 汇总并按 `CastTime` 排序。
- `reverse/bidking/code/decompiled/Scripts/MainUtils.cs`：`CheckItemNeedChoose()` 只在道具技能存在 `skilltarget == 8` 时返回 true；当前表中 `skilltarget=8` 只出现在 `3030-3040`，对应 `8029-8039` 训练百科/大全道具。
- `reverse/bidking/code/decompiled/Scripts/Battle_ItemUseContainer.cs`、`Battle_BuffItem.cs`、`BattleSkillChoose.cs`：需要选择目标的道具会打开 `skillChooseMask`，从 `wareHouse.allGridItems` 选择一个 `BattleGridItemData`，再通过 `Battle_Handler.GetPos()` 取目标藏品格位传给 `TargetBoxId`；这不是目标玩家协议。
- `reverse/bidking/code/decompiled/Scripts/BattleItemData.cs`：训练局从 `S2C_131_get_sim_game_log.SimSelectItemList` 创建普通可用道具；从 `GameData.UserLog[].SimBuffItemList` 和 `SimSelectItemList` 创建局内道具列表，增益道具会先经过 `CheckBuffItemCanUsed()`。
- `reverse/bidking/code/decompiled/Scripts/PlayerGameData.cs`：`UpdateSimGameData(GameData)` 会把 `GameData.UserLog[0].SimSelectItemList` 和 `SimBuffItemList` 同步回 `simGameLog`；`AddSpecialItem` 会按 `ItemCid` 合并 `SimBuffItemList.ItemCount`。

## 已修复内容

代码：

- `packages/match-core/src/items.ts`
  - BattleItem 优先通过 `Skill.skill_name === itemName_<BattleItemId>` 找直接技能。
  - `skill_count=0` 按源口径转为 `requestedTargetCount=999`，运行时命中所有匹配目标。
  - 使用道具时先按源技能筛选目标，再生成 clue、`SkillFeedEntry` 和事件 payload，`targetCount` 记录实际命中数。
  - `battle_item_used` 的 `entry.hitBoxList` 现在按 `SkillEffect.Category` 输出源形 `BoxInfoData`，不再只给 target ids 后续猜。
  - `skilltarget=7` 不再被误判为需要目标玩家。

- `packages/match-core/src/bidking/skillTargeting.ts`
  - 新增共用技能命中模块，英雄/地图技能和 BattleItem 共享目标筛选。
  - 统一实现 `skill_count=0 -> 999`、目标 1/2/3、随机类型 4、排序 6、占格筛选 7、已知信息筛选 10。
  - 修正 `skilltarget=6` 的预过滤 + 排序四元组。
  - 新增 `skilltarget=8` 显式目标格筛选：必须由调用方提供 `targetBoxId/targetBoxIds`，命中该格位对应的藏品；没有目标格上下文时保持空命中，不回退随机。
  - `skilltarget=10` 现在按 per-player 当前已知状态解释 `[轮廓, 品质, 完整信息]`，值 `0` 表示忽略、`1` 表示必须已知、`2` 表示必须未知；没有符合条件时保持空命中，不再回退成随机目标。

- `packages/match-core/src/bidking/skillEffectRuntime.ts`
  - 新增 `SkillEffect.Category` 源码行为分类：`warehouse / aggregate / text / system / unsupported`。
  - 明确只有 `1/5/6/7/11/22` 会改变仓库格知识；`2/3/4/8/9/10` 是聚合参数；`12/13/14` 是文本参数；`16-21/23-28` 是系统/遗物类效果；`15` 暂按源码未接入处理。
  - 统一公开 hitBox 字段白名单，避免 `13/14/15+` 这类非仓库揭示效果被前端当成品类、价格或目标格知识。

- `packages/match-core/src/bidking/systemEffectRuntime.ts`
  - 新增 `GameData` 系统限制计算：基础值为 `roundCanUseItemCount=1`、`gameCarryItemMax=3`、`gameGoldRateMax=0`。
  - 接入 `Category 16/21` 的 `[1,per-mille]` 倍率增加和 `[2,value]` 固定增加语义；例如 `Skill 3056 -> 16001` 把携带上限从 3 算到 6，`Skill 3049 -> 21002` 把每回合可用次数从 1 算到 2。
  - 新增 `Category 25/27/28` 的源码语义解码器：`25` 输出获得训练道具操作，`27` 输出按参数选择丢弃训练道具操作，`28` 输出复用角色技能操作。
  - `28001 [1,1410101]` 会解析为 HeroSkin `1410101 -> Hero 101`，并携带该竞买人的 `Hero.cast_type` 技能链；`28002 [2]` 保持为随机其他角色技能操作，并保留 `Skill 3041` 的 `skill_opt/skill_opt_param1/skill_opt_param2` 作为触发证据。
  - 新增 `Category 17/18/19/20/23/24/26` 的源码语义解码：利息上限、商店购买格数、商店折扣概率、胜负奖励、增益道具充能、打开模拟商店、道具状态改变。
  - `Category 17` 已接入 `GameData.gameGoldRateMax` 的限制计算，保留基础值 `0`，只在明确应用效果时按 `[1,per-mille]` 或 `[2,value]` 修改。

- `packages/match-core/src/bidking/simItemRuntime.ts`
  - 新增训练道具状态模型：`simSelectItemList` 对应源 `UserSimSelectGameItemData(ItemUid/ItemCid)`；`simBuffItemList` 对应源 `UserSimBuffItemData(ItemCid/ItemCount/Power/CD)`。
  - 新增 `gain_sim_item`、`discard_sim_item`、`charge_sim_buff_item` 的状态落点：获得道具会追加 `SimSelectItemList` 并生成递增 `itemUid`；丢弃道具会从 `SimSelectItemList` 移除；充能会按 `Item.cost[1]` 最大充能上限和 `SkillEffect.Param` 修改 `Power`。
  - 新增 `bidKingCanUseSimBuffItem`，按源码 `CheckBuffItemCanUsed + CD == 0 + Power >= Item.cost[2]` 判断增益道具是否可用；`bidKingUseSimBuffItem` 使用后扣除 `Power`。
  - 新增训练日志状态模型：`simGold`、`gameWinItemList`、`simShopStatus` 对齐 `S2C_131_get_sim_game_log` 顶层状态。
  - 新增训练商店运行时：按源码排序 `ShopItemData`，按 `DiscountRate` 计算购买价格，校验金币、售罄、购买次数和携带上限；购买成功会扣 `SimGold`、递增 `BuyCount`，并按源码客户端口径把商品 `ItemUid` 和 `Table_ShopItem.itemid[0][0]` 追加进 `SimSelectItemList`。
  - 新增 `GameWinItemList` 选择 helper：只移除已选择的待选项；不在本地擅自推断服务端刷新后的奖励落点，保留源码 `InitSimGame()` 权威刷新边界。
  - 新增 `S2C_129/S2C_157.UpdateGameData` 同步 helper：按源码 `UpdateSimGameData(GameData)` 只同步 `GameData.UserLog[].SimSelectItemList/SimBuffItemList`，不误改 `SimGold/GameWinItemList`。
  - 新增 `S2C_131` 整包训练日志刷新 helper：`bidKingSimTrainingStateForGameLog`、`bidKingApplySimGameLogRefresh`、`bidKingSimGameLogForTrainingState` 会按 `InitSimGame()` 口径替换 `MaxWinLevel/Level/SimGold/GameWinItemList/SimShopStatus/GameData/SimSelectItemList/SimBuffItemList/SelectItemCount/RoundCanUseItemCount/GameCarryItemMax/GameGoldRateMax`。
  - `GameWinItemList` 现在被明确建模为 `S2C_131_get_sim_game_log` 的服务端字段；客户端只读候选、提交 `C2S_134`，再等待下一次 `InitSimGame()` 权威刷新。
  - 新增 `bidKingSimGameWinItemDropGroupIdForLevel` 和 `bidKingSimGameWinItemCandidatePoolForLevel`：只暴露 `Table_Sim.simdorp -> Drop.items_list` 的候选池证据，明确 `generationAuthority='server'`，不把 Drop 801 误当作最终 `GameWinItemList`。
  - 新增 `Category 20` 胜负奖励 helper：按 `Item 1 = 银币` 输出外部奖励计划，不把它误写为模拟币 `SimGold`。
  - 新增 `Category 26` 状态变更 marker：只保留 `stateMode`，不发明协议里没有的客户端字段。
  - 新增 `Category 28` 角色技能复用请求 helper：指定皮肤模式按 `HeroSkin 1410101 -> Hero 101 -> cast_type[round]` 产出接近 `C2S_290` 的技能请求；随机角色模式没有服务端随机结果时保持空，不做本地随机兜底。

- `packages/match-core/src/bidking/simSkillTriggerRuntime.ts`
  - 新增 `skill_active_type / skill_opt / skill_cast / skill_round / skill_CD` 的源码触发矩阵解码。
  - 将 `skill_opt=11/21/31/33/34/41` 分别解码为开局、回合开始、获得遗物、使用道具、道具耗尽、揭示信息触发；`skill_opt=41` 继续按参数拆为揭示品质、轮廓、完整信息。
  - 保留 `chancePerMille`、`acceptedRounds`、`acceptedSourceItemTypeIds`、`acceptedTargetItemTypeIds`，用于后续接入训练局服务端事件链。
  - `skilltarget=8` 的触发 profile 会标记 `targetBoxRequired`，揭示轮廓触发时没有目标格上下文不算命中，避免百科类训练道具在本地误随机。
  - `skill_active_type=1` 且 `skill_opt=0` 才视为主动使用；`3071` 这类 `skill_active_type=2` 保持 `unknown`，避免把充能/放电类被动效果误判成可点击主动技能。

- `packages/match-core/src/bidking/simTrainingEventRuntime.ts`
  - 新增训练事件触发运行时：从 `SimBuffItemList/SimSelectItemList` 或显式 item 列表生成触发源，按 `skill_opt` 矩阵匹配开局、回合开始、获得遗物、使用道具、道具耗尽、揭示轮廓/完整信息、主动使用。
  - 对源码可证的本地状态操作执行落点：`gain_sim_item` 追加 `SimSelectItemList`，`discard_sim_item` 移除普通训练道具，`charge_sim_buff_item` 给触发源增益道具充能。
  - 对不能由客户端本地决定的内容保持计划/待处理边界：`use_hero_skill` 输出接近 `C2S_290` 的请求计划；仓库揭示类技能只记录触发，不伪造服务端 `GameSkillData`。
  - 默认要求源/目标类型上下文齐全，避免 `3070` 在不知道“使用了 11 类型道具”时误充能，或 `3072` 在不知道目标藏品品类时误充能。
  - 新增 `bidKingUseSimTrainingSelectItem` 和 `bidKingUseSimTrainingBuffItem`：分别对应源码 `C2S_128/S2C_129` 与 `C2S_156/S2C_157`，返回协议请求、`UpdateGameData` 同步边界、主动使用触发、使用道具触发和道具耗尽触发。
  - 普通训练道具使用会投影移除 `SimSelectItemList` 中的 `ItemUid`，再触发 `use_sim_item` 和 `sim_item_depleted` 监听；增益道具使用会按 `Item.cost[2]` 扣 Power，再触发主动使用技能。
  - 新增 `bidKingSimTrainingItemRequiresTargetBox`：按 `Item.skills -> Skill.skilltarget == 8` 判断是否必须选择目标格；`8029-8039` 这类训练百科/大全道具没有 `targetBoxId` 时返回 `missing_target_box`，显式传 `targetBoxId=0` 仍按源码允许选择 0 号格。
  - 失败分支已按源码 UI 判断拆开：普通道具缺失、增益道具缺失、非主动增益道具、CD 未结束、Power 不足、缺目标格。
  - 新增 `bidKingSimTrainingBidPriceRequest`、`bidKingApplySimTrainingNextRoundGameData` 和 `bidKingSimTrainingUnplayedSkillLogs`：分别对应 `C2S_126` 请求、`S2C_127.NextRoundGameData` 同步与 `S2C_OnRoundStartOnTraining2` 未播放技能日志筛选。
  - `NextRoundGameData` 同步后会按源码只覆盖 `SimSelectItemList/SimBuffItemList`，再触发 `round_start` 事件计划；未播放技能日志按 `MapSkillLog + HeroSkillLog + ItemSkillLog` 汇总、过滤 `playedSkillUids`、按 `CastTime` 排序。
  - 新增 `bidKingSimTrainingGameOverResult`：对应 `S2C_127.IsNextRound=false` 分支，明确不消费 `NextRoundGameData`，而是进入 `Battle_Handler.S2C_OnGameOver`，并保留 `Battle_Main.Training -> InitSimGame` 作为赛后权威刷新边界。
  - 新增 `bidKingSimTrainingWinItemChoiceRequest` 和 `bidKingApplySimTrainingWinItemChoice`：对应 `C2S_134/S2C_135` 胜利奖励选择链路，请求携带 `ItemCid/DiscardItemUid=0`，响应只认 `ErrorCode`，本地仅移除已选择的候选项，不擅自发放奖励或修改 `SimGold/SimSelectItemList`。
  - 新增 `bidKingSimTrainingGameLogRefreshRequest` 和 `bidKingApplySimTrainingGameLogRefresh`：对应 `C2S_130/S2C_131 GetSimGameLog`，把 `InitSimGame` 和 `UpdateSimGameData` 的刷新边界拆开，避免把训练日志顶层字段错误归到下一轮 `GameData` 更新里。
  - 新增 `bidKingSimTrainingNoPlaySkillLogs`、`bidKingSimTrainingTestSkillCastRequest` 和 `bidKingApplySimTrainingTestSkillCastResponse`：分别锁定训练道具使用后的 `GetNoPlaySkills` 顺序、`C2S_290` 请求字段，以及 `S2C_291` 回包字段和播放顺序；真实 `GameSkillData` 仍由服务端生成，本地只消费回包日志。

- `packages/shared/src/index.ts`、`packages/match-core/src/types.ts`、`packages/match-core/src/match.ts`、`packages/match-core/src/bidking/gameDataRuntime.ts`
  - `CreateMatchPlayer / RuntimePlayer / PrivatePlayerState / GameUserDataSnapshot` 都补上 `simSelectItemList` 和 `simBuffItemList`。
  - `buildBidKingGameDataSnapshot()` 会把训练道具源形字段写入 `GameData.UserLog[]`，私有快照也会保留同一份当前玩家状态。
  - `CreateMatchPlayer / RuntimePlayer / PrivatePlayerState` 继续补齐 `simGold / gameWinItemList / simShopStatus`，避免训练日志顶层状态丢失。
  - `GameSkillData.HitItemIndex` 已按源码聚合参数口径改为命中藏品数量，不再误填第一个命中藏品的仓库序号。
  - `HitItemIndex / AllHitItemAvgPrice / AllHitBoxAvgPrice / AllHitItemAvgBoxIndex / HitItemTotalPrice / TotalHitBoxIndex / HitItemTypeList / HitItemQuilityList` 统一由同一个 hit-slot 统计 helper 生成，避免英雄/地图技能日志和 BattleItem 事件日志分叉。
  - `StockContainer.StockBoxes[].position` 和 `ItemData.boxPositionData[]` 已按源码 `BoxId -> X=row, Y=column` 输出；前端内部 slot 仍保留 `x=column, y=row`，但源形 `GameData` 不再把两套坐标混用。

- `apps/server/src/domain/economy/profileSendAuctionRuntime.ts`
  - 送拍回放构造的 `BidKingGameUserDataSnapshot` 补空 `simSelectItemList/simBuffItemList`，避免局外送拍 GameData 与对局 GameData 结构分叉。

- `packages/match-core/src/bidking/battleItemUseRuntime.ts`
  - 新增本回合 BattleItem 使用次数、上限、剩余次数推导，事件源为 `battle_item_used` 的当前 roundId。
  - `packages/match-core/src/items.ts` 在使用道具前校验剩余次数，默认普通局一回合只能用 1 个试宝令。
  - `packages/match-core/src/match.ts` 将 `battleItemUseLimitThisRound / battleItemUsesThisRound / battleItemUsesRemainingThisRound` 放入私有快照。
  - `apps/server/src/domain/battle/roomActionRuntime.ts` 在 Socket 入口也执行同一限制，`apps/web/src/bidking/battle/useMatchDerivedState.ts` 用剩余次数关闭按钮。

- `packages/match-core/src/bidking/compatRuntime.ts`
  - 地图/英雄技能也切到共用命中模块，避免同一套 Skill 表在不同入口解释不一致。
  - 目标筛选会从历史回合、当前回合和同轮已触发技能的可见 `skillFeed` 推导玩家已知状态，供 `skilltarget=10` 使用。
  - `Hero.cast_type` 不再只在首轮生成自动技能；现在每回合按 `cast_type[roundIndex]` 触发，且按源码客户端顺序先处理地图技能、再处理英雄技能。
  - 自动英雄技能在回合开始 feed 阶段重新生成并同步玩家私有线索，避免同轮地图技能已经揭示的信息没有进入英雄技能目标筛选。
  - `skilltarget=10` 无命中时保持空 `targetItemIds / hitBoxList`，不再由 clue 兜底逻辑回退成随机命中。
  - `Category 12` 从“揭示一个格子的品质”改为文本型“本场竞拍最高品质为...”；`Category 13` 文案改为文本型目标品类，不再暗示永久揭示仓库格。

- `packages/match-core/src/match.ts`
  - 仓库可见状态现在通过 `skillEffectRuntime` 分类判断，只把 `Category 1/5/6/7/11/22` 视为会持久改变格子知识的效果。
  - `Category 12/13/14` 仍保留技能日志和目标，但不再写入 `visibleRarity / visibleCategory / visibleValueRange / markedBySkill`。
  - 公开 `skillFeed.hitBoxList` 会按可见效果清洗字段，避免 `Category 14` 这类文本型价格位数效果把完整 `itemPrice` 暴露给前端。

- `packages/match-core/src/items.ts`、`apps/web/src/bidking/battle/battleItemUi.ts`、`apps/web/src/bidking/admin/adminFormatters.ts`
  - BattleItem 计划新增 `system` reveal kind 和 `system_effect` target mode。
  - 系统/遗物类 SkillEffect 不再生成仓库目标，也不再在 UI/admin 里显示成“品类/指定目标”。
  - `Category 13` 作为文本型品类参数改为已落实状态，不再因 revealKind=`category` 被误标为 simplified。


- `packages/match-core/src/bidking/gameDataRuntime.ts`
  - `battle_item_used` 归档为 `itemSkillLog` 时优先使用事件中的源形 `hitBoxList`，避免聚合类道具被回放层补成完整 BoxInfo 而泄漏信息。
  - `Category 12/13/14` 的内部 `GameData` 回放仍保留源形 hitBox 字段，用于复盘/参数证据；只是公开快照不把这些字段当作仓库可见知识。
  - `roundCanUseItemCount / gameCarryItemMax / gameGoldRateMax` 改为从系统效果限制计算，不再在所有快照里写死 1/3/0。

- `packages/match-core/src/index.ts`
  - 导出 `skillForBattleItem`，便于审计和测试直接核对 BattleItem 源技能。

- `apps/web/src/bidking/battle/battleItemUi.ts`
  - `requestedTargetCount=999` 的道具按钮徽标显示为“全量目标”，不再误显示“999目标”。

测试：

- `packages/match-core/src/bidking/compatRuntime.test.ts`
  - 覆盖 64 个 BattleItem 均有 `itemName_<id>` 直接 Skill。
  - 锁定 `100100` 全库透视命中全仓，`hitBoxList` 只有轮廓字段。
  - 锁定 `100103` 总格数聚合归档字段，且不泄漏完整 item box。
  - 锁定 `100169` `skilltarget=7` 只命中 1 格藏品，并计算平均价值。
  - 锁定英雄技能 `skilltarget=6` 四元组能按最高品质命中。
  - 锁定 `skilltarget=10`：`[2,2,2]` 排除已知轮廓/品质/完整信息，`[0,1,0]` 只命中品质已知，`[1,1,0]` 只命中轮廓和品质均已知；无已知品质时不随机兜底。
  - 锁定 `Hero 104` 第二回合触发 `cast_type[1]`，且不会重复命中第一回合已由该玩家私有技能揭示的目标。
  - 锁定 `Hero 301` 这类首轮空槽配置不会在第一回合误触发，但会在源码配置的第五回合触发 `100301`。
  - 锁定 `Category 12/13/14`：不改变前端仓库格可见知识，不进入 per-player 已知状态；公开 hitBox 不泄漏品质/品类/完整价格，内部 GameData 仍保留源形字段。
  - 锁定 `SkillEffect.Category` 分类边界：仓库知识类仅 `1/5/6/7/11/22`，聚合类 `2/3/4/8/9/10`，文本类 `12/13/14`，系统类 `16-21/23-28`，`15` 暂未接入。
  - 锁定系统类效果计划：例如 `Skill 3056 -> SkillEffect 16001` 生成 `system/system_effect`，无仓库目标，状态为 simplified。
  - 锁定 `Category 16/21` 对 `GameData` 限制字段的影响，并锁定普通局默认每玩家每回合只能使用 1 个 BattleItem；带 `3049/3056` 的系统技能快照会显示 `roundCanUseItemCount=2`、`gameCarryItemMax=6`。
  - 锁定 `Category 25/27/28` 的完整引用技能集合为 `3041/3042/3054/3065/3066/3067/3068/3071`，并验证每个技能均能解码出结构化系统操作。
  - 锁定 `25000` 获得的是 Item 表训练道具 `8001`，不是 BattleItem；锁定 `27000` 的丢弃选择参数；锁定 `28001` 从皮肤 `1410101` 解析到 Hero `101` 和对应 `cast_type`；锁定 `28002` 是随机其他角色技能而不是仓库目标。
  - 锁定 `17/18/19/20/24/26` 当前没有 Skill 引用，避免把表中预留效果误接进普通对局。
  - 锁定 `23` 的完整引用技能集合为 `3069/3070/3072/3073/3074/3075/3076/3077/3078/3079/3080/3081`，并验证充能效果保留触发参数。
  - 锁定 `17000/17001` 对 `gameGoldRateMax` 的修改、`18002` 商店购买格数修改、`19000` 折扣概率、`20001/20002` 胜负奖励、`24000 -> Shop 6`、`26001/26002` 状态变更。
  - 锁定 `GameData.UserLog[].SimSelectItemList / SimBuffItemList` 的源形字段进入快照；锁定私有快照同步这些状态。
  - 锁定 `gain_sim_item` 追加 `SimSelectItemList`、`discard_sim_item` 移除普通训练道具、`charge_sim_buff_item` 给增益道具充能且不会超过 `Item.cost[1]`。
  - 锁定增益道具可用条件：例如 `8059` 有 `skill_active_type=1` 的主动技能，`Power=5/CD=0` 可用；`8058` 没有主动技能，即使满充能也不可直接使用。
  - 锁定 `SimGold / SimShopStatus / GameWinItemList` 进入私有快照；锁定训练商店按源码排序、折扣价、售罄、金币不足和携带满需丢弃；锁定通关奖励选择只清理待选项，不越过源码服务端刷新边界。
  - 锁定 `Category 20` 产出银币奖励计划且不改 `SimGold`；锁定 `Category 26` 只暴露 `stateMode`；锁定 `Category 28` 指定法蒂玛皮肤时按回合产出 `100101/1001011` 技能请求，随机模式无服务端选择时不本地随机。
  - 锁定 `UpdateGameData` 同步只覆盖 `SimSelectItemList/SimBuffItemList`，不会误改 `SimGold/GameWinItemList`。
  - 锁定全表非零 `skill_opt` 均可解码为已知触发事件，不再落入 unknown。
  - 锁定训练道具触发矩阵：`3041/3042` 为开局，`3054` 为道具耗尽且 `CD=10`，`3066/3067` 为回合开始，`3068` 为获得遗物且 50% 触发，`3069/3070/3072-3081` 为充能触发，`3082-3091` 为主动使用。
  - 锁定 `8057/8058/8059/8068` 的组合技能：`8058` 没有 `skill_active_type=1` 不能主动使用，`8059` 有 `3082` 可主动使用；`3072/3081` 分别只匹配品类 `101/110` 的完整信息揭示。
  - 锁定训练事件触发链：开局 `8053` 会落地获得 `8001`，`8041` 只输出角色技能复用请求；回合开始 `8054/8055` 会先丢弃再获得；`8056` 只有 50% 命中时获得道具；`8058` 只有传入源道具类型 `11` 才充能；`8057` 揭示轮廓充能；`8059` 只有目标品类 `101` 的完整信息揭示才充能。
  - 锁定主动使用 `8059/3082` 只记录触发、不会本地伪造仓库揭示结果；真实 `GameSkillData` 仍由服务端日志链负责。
  - 锁定 `C2S_128` 普通训练道具入口：使用 `100100` 会生成 `ItemUid/TargetBoxId` 请求、移除对应 `SimSelectItemList`、触发 `8058/3070` 充能、触发 `8051/3054` 耗尽监听获得 `8001`，并保留 `S2C_129.UpdateGameData` 为权威同步边界。
  - 锁定 `C2S_156` 增益道具入口：使用 `8059` 会生成 `BuffItemCid/TargetBoxId` 请求、扣除 Power、触发 `3082`，但不本地伪造揭示结果，并保留 `S2C_157.UpdateGameData` 为权威同步边界。
  - 锁定 `skilltarget=8` 目标格边界：`3030-3040` 需要显式 `targetBoxId`，`selectBidKingSlotsBySkill` 没有目标格时不随机命中；`8029` 不传目标格会返回 `missing_target_box`，传 `targetBoxId=0` 会生成合法 `C2S_128` 请求。
  - 锁定训练道具使用失败边界：缺普通道具、缺增益道具、非主动增益道具、CD 未结束、Power 不足、缺目标格均有明确 failure。
  - 锁定 `C2S_126` 训练出价请求和 `S2C_127` 下一轮边界：`Price` 会取整，`NextRoundGameData` 进入 `UpdateSimGameData` 同步，`round_start` 会触发 `8054/3066` 丢弃和 `8055/3067` 获得，`GameWinItemList/SimGold` 不会被误改。
  - 锁定训练未播放技能日志筛选：下一轮开始按 `MapSkillLog + HeroSkillLog + ItemSkillLog` 汇总，排除已处理 `Uid`，再按 `CastTime` 排序；训练道具使用后的 `GetNoPlaySkills` 按 `ItemSkillLog + MapSkillLog + HeroSkillLog` 汇总，排除已处理 `Uid`，不重排。
  - 锁定 `C2S_290/S2C_291` 测试技能施放边界：请求字段为 `GameUid/ItemCid/SkillCid/HeroCid/MapCid`，响应字段为 `ItemSkillLog/NewGameData/HeroSkillLog/MapSkillLog/SkillLog`，播放顺序为 `ItemSkillLog -> HeroSkillLog -> MapSkillLog -> SkillLog`，`NewGameData` 只走 `UpdateSimGameData` 同步。
  - 锁定 `GameSkillData` 聚合字段：`Category 4` 的 `hitItemIndex` 等于命中藏品数量；`Category 2/3/8/9/10` 对应 `totalHitBoxIndex/allHitItemAvgBoxIndex/allHitItemAvgPrice/allHitBoxAvgPrice/hitItemTotalPrice`，并继续保证聚合类 `hitBoxList` 不泄漏完整藏品字段。
  - 锁定 `StockContainer` 坐标：`boxId = row * 10 + column`，`position.x = row`、`position.y = column`，`item.boxPositionData[0]` 同样按源坐标输出。
  - 锁定 profile 实体库存坐标：源码 `StockBoxData.BoxId` 是格子线性位置，不是实体 id；profile 内部保留本地实体句柄，但送拍 `ItemList.BoxId`、送拍回放 `StockContainerData`、战斗道具携带选择均按源码格子位置输出/消费。

## 当前还原度变化

- BattleItem 技能入口：从约 50% 提升到约 90%。剩余差距主要是库存实体消耗、原 ack 响应体和目标用户类特殊道具协议。
- BattleItem SkillEffect 日志：从约 55% 提升到约 95%。直接显示类、聚合类、文本参数类已经拆开处理，`16/17/21` 系统限制已进入 `GameData` 字段和使用次数校验；`18/19/24` 已接入训练商店状态，`20` 已能产出外部奖励计划，`23/25/27` 已有基础训练道具状态落点，`26/28` 已推进到源码边界清晰的请求/状态标记，训练/遗物 `skill_opt` 触发矩阵、事件触发计划、`C2S_128/156` 使用入口和 `C2S_126/S2C_127` 下一轮入口已结构化。
- GameSkillData 聚合字段：从约 80% 提升到约 88%。`HitItemIndex`、平均价格、每格均价、平均占格、总价、总占格已按源码 `GetSkillParams` / demo `DealSkillEffect` 口径生成；剩余差距仍是服务端权威生成时序、真实 protobuf 回包和训练局服务端日志生成算法。
- StockContainer 源形坐标：从约 82% 提升到约 88%。普通对局归档、送拍回放、profile 实体库存 `ItemData.BoxPositionData`、战斗道具携带选择都已按源码 `BoxId=position`、`Position.X=行/Position.Y=列` 口径输出；剩余差距是内部 `ProfileStockBoxState.boxId` 仍为本地实体句柄，以及 stock move/split/merge/lock/unlock 原协议未完整提供。
- 英雄/竞买人自动技能：从约 84% 提升到约 86%。`cast_type` 多回合触发、首轮空槽延迟触发、同轮地图技能先入已知状态已修；剩余差距主要是英雄拥有状态、皮肤/语音/BGM 和完整 `GameSkillData` 下发形态。
- 通用 SkillEffect 分类：从约 70% 提升到约 94%。`1-14/22` 已按仓库、聚合、文本三类进入运行边界，`16/17/21` 已接入 `GameData` 限制和道具使用门禁，`18-20/23-28` 已建立结构化语义、触发矩阵、事件触发计划和训练使用/回合入口；剩余差距是完整训练/遗物服务端日志状态机。
- 训练/模拟局赛后链路：从约 66% 提升到约 72%。`C2S_126/S2C_127` 的下一轮与结束两条分支、`C2S_130/S2C_131` 整包训练日志刷新、`C2S_134/S2C_135` 胜利奖励选择边界、`C2S_290/S2C_291` 测试技能施放回包边界已结构化；`Sim.simdorp -> Drop 801` 候选池已锁定。剩余差距是服务端如何从候选池生成最终 `GameWinItemList`，以及真实 `GameSkillData` 生成算法。
- 通用 Skill target：从约 70% 提升到约 90%。`skilltarget=6/7/8/10` 已修，且 `skilltarget=8` 明确为目标格/目标藏品选择，不再误当目标玩家；剩余差距主要是服务器生成 `GameSkillData` 的完整算法和协议形态。

## 验证命令

- `npm run typecheck -w @bitkingdom/match-core`
- `npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`
- `npm run test -w @bitkingdom/match-core`
- `npm run typecheck -w @bitkingdom/web`
- `npm run test -w @bitkingdom/web -- src/bidking/battle/battleItemUi.test.ts`

结果：首次 BattleItem 入口修复时全部通过，当时 match-core 为 96 个测试通过；后续追加修复见下方记录。

追加验证：`skilltarget=10` 修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 match-core 为 97 个测试通过。

追加验证：`Category 12/13/14` 修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 match-core 为 98 个测试通过。

追加验证：`Hero.cast_type` 多回合触发修复后，`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core` 均通过；当前 match-core 为 99 个测试通过。

追加验证：`SkillEffect.Category` 分类边界修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/web`、`npm run test -w @bitkingdom/web -- src/bidking/battle/battleItemUi.test.ts` 均通过；当前 match-core 为 101 个测试通过。

追加验证：`Category 16/21` 系统限制和 BattleItem 每回合使用门禁修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run test -w @bitkingdom/web` 均通过；当前 match-core 为 102 个测试通过。

追加验证：`Category 25/27/28` 系统效果语义解码修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 match-core 为 103 个测试通过。

追加验证：`Category 17/18/19/20/23/24/26` 系统效果语义解码修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 match-core 为 104 个测试通过。

追加验证：`SimSelectItemList/SimBuffItemList` 训练道具状态模型修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run typecheck -w @bitkingdom/shared`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web` 均通过；当时 match-core 为 105 个测试通过。

追加验证：`SimShopStatus/GameWinItemList/SimGold` 训练日志状态修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/shared`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 39 个测试通过。

追加验证：`Category 20/26/28` 训练局状态边界和 `UpdateGameData` 同步修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 40 个测试通过。

追加验证：`skill_opt / skill_active_type / skill_cast` 触发矩阵修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run typecheck -w @bitkingdom/shared` 均通过；当前 compatRuntime 为 41 个测试通过，match-core 为 108 个测试通过。

追加验证：训练事件触发运行时修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run typecheck -w @bitkingdom/shared` 均通过；当前 compatRuntime 为 42 个测试通过，match-core 为 109 个测试通过。

追加验证：`C2S_128/C2S_156` 训练道具使用入口修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run typecheck -w @bitkingdom/shared` 均通过；当前 compatRuntime 为 43 个测试通过，match-core 为 110 个测试通过。

追加验证：`C2S_126/S2C_127` 训练回合推进修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run typecheck -w @bitkingdom/shared` 均通过；当前 compatRuntime 为 44 个测试通过，match-core 为 111 个测试通过。

追加验证：训练结束和胜利奖励选择边界修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web`、`npm run typecheck -w @bitkingdom/shared` 均通过；当前 compatRuntime 为 44 个测试通过，match-core 为 111 个测试通过。

追加验证：`InitSimGame -> C2S_130/S2C_131` 整包训练日志刷新修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run typecheck -w @bitkingdom/shared`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 44 个测试通过。

追加验证：`GameWinItemList` 候选池证据边界修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 44 个测试通过。

追加验证：真实 `GameSkillData` 投递边界修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 44 个测试通过。

追加验证：`skilltarget=8` 目标格选择边界修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts` 均通过；当前 compatRuntime 为 45 个测试通过。

追加验证：`GameSkillData` 聚合字段修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 compatRuntime 为 45 个测试通过，match-core 为 112 个测试通过。

追加验证：`StockContainer` 源形坐标修复后，`npm run typecheck -w @bitkingdom/match-core`、`npm run test -w @bitkingdom/match-core -- src/bidking/compatRuntime.test.ts`、`npm run test -w @bitkingdom/match-core` 均通过；当前 compatRuntime 为 45 个测试通过，match-core 为 112 个测试通过。

追加验证：profile 实体库存坐标和 `BoxId=position` 修复后，`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server` 均通过；当前 server 为 93 个测试通过。

追加验证：市场上架 `C2S_276` 源字段归档修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server` 均通过；当前 server 为 93 个测试通过。源码证据为 `PutawayPop_Main.cs` 上架调用传 `gridData.stockId/gridData.pos`，`PlayerManager.SentLanchItemToAuctionHouse` 写入 `StockId/BoxId/Price/LanchTime/StartPrice/ItemCount/BagItemCid`，`AuctionhouseReflection` 确认 `C2S_276` 字段列表。

追加验证：拍卖行 `AuctionHouseLanchItem` 源形列表修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts`、`npm run test -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web` 均通过；当前 server 为 93 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `AuctionHouseLanchItem`、`S2C_275`、`S2C_279` 字段列表，`PlayerManager.GetAuctionHouseLanchItemList/GetAuctionHouseItemList` 消费同一 `AuctionHouseLanchItem`，`AuctionPlaceSaleItem/AuctionPlaceSupPanel4/BidPop_Main` 读取 `LanchItemUid/ItemCid/NumberCid/No/StartLanchTime/EndLanchTime/DisplayPeriodEndTime/Price/MaxPrice/StartPrice/Count`。

追加验证：拍卖行 `C2S_280/S2C_281` 出价和 `C2S_304/S2C_305` 出价日志修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts`、`npm run test -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web` 均通过；当前 server 为 93 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `C2S_280(Token/ItemUid/Price)`、`S2C_281(ErrorCode)`、`AuctionHouseBidLog(BidTime/BidPrice/LanchItem)` 和 `S2C_305(ErrorCode/BidLogList)` 字段列表，`BidPop_Main` 成功后扣款并维护个人出价记录，`AuctionPlaceItem` 用个人 `BidPrice` 与拍品 `MaxPrice` 判断是否被超价。

追加验证：拍卖行 `C2S_282/S2C_283` 源 `ItemUid` 撤拍修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts` 均通过；当前 profileService 为 66 个测试通过，routes 为 7 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `C2S_282(Token/ItemUid)`、`S2C_283(ErrorCode)` 字段列表，`PlayerManager.UnAuctionlanchItem` 写入 `ItemUid`，`AuctionPlaceSaleItem.OnXiajiaClick` 传入 `lunchData.LanchItemUid`。本地新增 `/api/auction-house/unlanch-item`，用 `ItemUid=LanchItemUid` 映射订单，并修正取消路径中过期分支也会触发竞价保证金退款。

追加验证：拍卖行到期最高出价结算修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts` 均通过；当前 profileService 为 68 个测试通过，routes 为 7 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `AuctionHouseTradeInfo(TradeTime/ItemCid/NumberCid/No/Price)`、`S2C_285(TradeInfoInList/TradeInfoOutList)` 和 `AuctionHouseItemPriceInfo(ItemCid/AvgPrice/Count)` 字段列表，`PlayerManager.GetAuctionHouseTradeInfo/GetAuctionHouseItemPriceInfo` 只消费这些服务端结果；客户端没有服务端结算实现，因此本地按已扣押最高出价进行权威结算：赢家不二次扣款，实体藏品入赢家仓库，卖家收成交价并扣手续费，订单记录 `sourceAuctionHouseTradeTime/sourceAuctionHouseTradePrice` 为后续交易记录和均价聚合打底。

追加验证：拍卖行 `C2S_284/S2C_285` 源形交易记录修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts` 均通过；当前 profileService 为 68 个测试通过，routes 为 7 个测试通过。源码证据为 `AuctionPlaceSupPanel3` 将 `TradeInfoInList` 包装成 `isBuy=true`、`TradeInfoOutList` 包装成 `isBuy=false`，`TradingInfoItem.SetData2` 展示 `ItemCid/No/Price/TradeTime` 且数量固定 `x1`。本地新增 `/api/auction-house/trade-info`，按玩家输出 `AuctionHouseTradeInfoSnapshot { tradeTime, itemCid, numberCid, no, price }` 的买入/卖出列表。

追加验证：拍卖行 `C2S_292/S2C_293` 平均价/在售数量修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts` 均通过；当前 profileService 为 68 个测试通过，routes 为 7 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `AuctionHouseItemPriceInfo(ItemCid/AvgPrice/Count)`、`C2S_292(Token)`、`S2C_293(ErrorCode/AllAuctionHouseItemPriceInfo)` 字段列表，`PlayerManager.GetAuctionHouseItemPriceInfo` 消费该列表，`AuctionPlaceItem.SetBuild` 展示 `AvgPrice` 并把 `Count` 放在 `zaishouRoot` 在售数量区域。当前新增 `/api/auction-house/item-price-info`，按 sold auction order 聚合 `avgPrice`，按活跃上架聚合 `count`。

追加验证：拍卖行 `C2S_302/S2C_303` 上架槽解锁修复后，`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts` 均通过；当前 profileService 为 68 个测试通过，routes 为 7 个测试通过。源码证据为 `AuctionhouseReflection.cs` 中 `C2S_302(Token/UnlockCount)`、`S2C_303(ErrorCode)` 字段列表，`PlayerManager.UnlockAuctionHouseLanchSlot` 发送 `UnlockCount`，`AuctionPlaceSupPanel2.AddBoxClick` 固定传 `1`，并按 `auction_slot_price[my_shangjiaBoxCount - item_bid_slot_base]` 校验费用，成功后刷新 `GetAuctionHouseLanchItemList`。当前新增 `/api/auction-house/unlock-lanch-slot`，成功后扣 `coins`、增加 `bidkingMarketSlotUnlocks`，并让后续 `lanchMax` 增加；同时补正 `UnlockCount` 必须为正数、满槽和余额不足边界。

追加验证：拍卖行无出价过期列表态修复后，`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts` 均通过；当前 profileService 为 69 个测试通过。源码证据为 `AuctionPlaceSaleItem.SetData` 根据 `EndLanchTime` 与服务器时间切换 `reexchangeGo/expiredGo`，`OnTimeEnd` 只派发刷新事件，`OnXiajiaClick` 调用 `UnAuctionlanchItem(lunchData.LanchItemUid)`；`AuctionPlaceSupPanel2.RefreshSaleItems` 直接展示 `GetAuctionHouseLanchItemList` 返回列表并用列表数量占槽。本地改为：无出价拍卖到期后保留在卖家上架列表、继续占用槽位，不进入公共竞拍列表，直到卖家下架才返还实体库存；`AuctionPlaceSaleItem.OnReExchangeClick` 在客户端为空方法，当前不凭空实现重上架。

追加验证：拍卖行 `C2S_304/S2C_305` 竞价日志结束态复核后，源码证据显示 bid log 是未结束拍卖的个人出价展示列表：`AuctionPlacePanel_Main` 和 `AuctionPlaceSupPanel5.RefreshView` 调 `PlayerManager.GetAuctionHouseBidLog()` 刷新列表，`AuctionPlaceSupPanel5.OnAuctionSaleRefresh` 在拍品结束事件中按 `LanchItemUid` 从 `auctionHouseBidLogs` 移除，`AuctionPlaceItem.SetBuild2` 用 `BidPrice` 与 `LanchItem.MaxPrice` 展示是否被超价；成交记录另由 `C2S_284/S2C_285` 承载。当前将 `/api/auction-house/bid-logs` 显式限定为未过期、活跃拍卖，并补测撤拍和到期成交后竞拍人 bid log 清空，避免把已结束拍卖误当作竞价日志历史。

追加验证：交易行 `ExchangeReflection C2S_52/54/64` 源形上架状态修复后，源码证据为 `ExchangeReflection.cs` 中 `ExchangeLunchItem(LunchItemUid/ItemCid/StartLunchTime/EndLunchTime/ItemCount/TotalPrice/TradeCount)`、`C2S_54(Token/ItemCid/Count/TotalPrice/ReLanchItemUid)` 和 `C2S_64(Token/ItemUid)` 字段列表；`PlayerManager.ReExchangeItem` 只填 `ReLanchItemUid`，`TradingSaleItem.SetData` 对过期项显示 `reexchangeGo/expiredGo`，`OnReExchangeClick` 调 `ReExchangeItem(lunchData.LunchItemUid)`，`OnXiajiaClick` 调 `UnlanchItem(lunchData.LunchItemUid)`；`TradingSubPanel2.RefreshSaleItems` 直接展示 `GetExchangeItems()` 返回列表并按 `ConstantConfig.listed_quantity` 补空槽。当前新增 `/api/exchange/lanch-items`、`/api/exchange/lanch-item`、`/api/exchange/unlanch-item`，交易行过期订单保留库存锁定和卖家列表，重上架刷新时间，下架才返还实体库存，过期购买按 `E_OnTradingInfoExpired` 语义拒绝。

追加验证：交易行 `ExchangeReflection C2S_56/58/60/62` 购买侧修复后，源码证据为 `ExchangeReflection.cs` 中 `ExchangeItemPriceInfo(ItemCid/Price)`、`ExchangeItemTradeInfo(Price/PeopleCount)`、`C2S_60(Token/ItemCid/ItemCount/EstimatePrice)`、`ExchangeTradeInfo(TradeTime/ItemCid/ItemCount/Price)` 和 `S2C_63(TradeInfoInList/TradeInfoOutList)` 字段列表；`PlayerManager.GetItemTradeInfo` 会把 `TradeInfoList` 按 `Price` 升序排序，`TradingTree.SetMyCount` 从低价档开始累计 `totalPrice`，`TradingBuy_Main.DoBuy` 传入该累计值作为 `EstimatePrice`，`PlayerManager.ExchangeBuyItem` 在 `Error.Code33ExchangeInfoNull` 时派发 `E_OnTradingInfoExpired`；`TradingSubPanel3` 则直接展示 `TradeInfoInList/TradeInfoOutList`。当前新增 `/api/exchange/info`、`/api/exchange/item-trade-info`、`/api/exchange/buy-item`、`/api/exchange/trade-info`，按未过期在售订单聚合最低价和价格档，购买时低价优先撮合且估价不一致即拒绝，成交后写入买入/卖出源形交易记录；同时修正部分成交后下架/过期只返还剩余库存，避免按原订单总数重复返还。

追加验证：交易行 `ExchangeReflection C2S_66/68/70` 收藏侧修复后，源码证据为 `ExchangeReflection.cs` 中 `C2S_66(Token/ItemCid)`、`S2C_67(ErrorCode)`、`C2S_68(Token/ItemCid)`、`S2C_69(ErrorCode)`、`C2S_70(Token)` 和 `S2C_71(ErrorCode/CollectItemList)` 字段列表；`PlayerManager.CollectItem/UnCollectItem/GetAllCollectionItems` 分别发送这三条请求，`GetAllCollectionItems` 会把 `CollectItemList` 排序，`PlayerGameData.collectionIds` 与 `collectionShopIds` 是两套列表，`CollectionItem.OnClick` 成功后才更新本地收藏图标并派发 `E_OnCollectItem`。当前新增 `/api/exchange/collect-item`、`/api/exchange/uncollect-item`、`/api/exchange/collect-items`，并新增 `profile.exchangeCollections` 独立承载交易行收藏，避免继续混用商店 `shopCollections`。

追加验证：送拍 `SendauctionReflection C2S_294/296/298/300` 字段级修复后，源码证据为 `SendauctionReflection.cs` 中 `SendAuctionData(Uid/MapCid/SlotId/StockData/SendTime)`、`SendAuctionGameData(Uid/MapCid/GameData/GameOverTime/UserSkillList)`、`SendAuctionItemData(StockId/BoxId)`、`C2S_294(Token/SlotId/MapCid/ItemList)`、`S2C_295(ErrorCode/SendAuctionData)`、`S2C_297(ErrorCode/SendAuctionDataList)`、`S2C_299(ErrorCode)` 和 `S2C_301(ErrorCode/SendAuctionGameDataList)` 字段列表；`SendAuctionPanel.OnSendAuctionClick` 会先按 `ConstantConfig.entrust_slot_base` 找空闲 `SlotId`，从仓库格子 `data.pos` 写入 `SendAuctionItemData.BoxId`，再调用 `PlayerManager.SendAuction(slotId, mapCid, datas)`；`AuctionData.Build(SendAuctionData)` 用 `SlotId` 和 `StockData.StockBoxes[].BoxId` 重建委托箱。当前 `/api/send-auction` 支持客户端传 `slotId`，不传时保留兼容推断；创建响应新增 `sourceSendAuction { errorCode, sendAuctionData }`，列表新增 `errorCode/sendAuctionDataList`，回收新增 `sourceSendAuctionRecycle { errorCode }`，历史对局新增 `errorCode/sendAuctionGameDataList`，并把送拍 `StockData.StockId` 改回槽位值。验证命令：`npm run typecheck -w @bitkingdom/shared`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts tests/routes.test.ts`、`npm run test -w @bitkingdom/server`、`npm run typecheck -w @bitkingdom/web` 均通过；当前 server 为 98 个测试通过。

追加验证：交易行 `TradingExchange_Main` 上架手续费/成交税费修复后，源码证据为 `MainUtils.CalYujiPrice(itemId, perPrice, count)`：`fee=(totalPrice * ConstantConfig.item_fee_rate) / 1000`，`tax` 按 `Item.transaction_tax_rate` 或铜钱特殊规则计算，`finalPrice=totalPrice-fee-tax`；`TradingExchange_Main.RefreshExchangePanel` 把 `shouxufei=data.fee` 并展示 `total/tax/fee/finalPrice`，`OnExchangeClick` 只在上架前校验 `shouxufei > coinNum` 并发送 `ExchangeItem(itemId,count,totalPrice)`；拍卖上架仍由 `PutawayPop_Main.OnRefreshQipaiPrice` 使用 `ConstantConfig.item_bid_cost` 计算 `cur_shangjiafei_price`。当前 `profileMarketRuntime` 已将 `trade` 与 `auction` 费用模型拆开：交易行上架扣 `CalYujiPrice.fee`，成交只扣 `tax`，`netPrice` 保持 `TotalPrice-fee-tax`；拍卖行继续使用原 `item_bid_cost` 上架成本路径。已补 `profileService.test.ts` 和 `profileRestoreCoverage.test.ts` 断言上架费、成交税、部分成交税费。验证命令：`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts`、`npm run test -w @bitkingdom/server -- tests/profileRestoreCoverage.test.ts`、`npm run test -w @bitkingdom/server` 均通过；当前 server 为 98 个测试通过。

追加验证：交易行 `max_per_listing/listed_quantity` 上架槽位修复后，源码证据为 `TradingExchange_Main.RefreshExchange` 将 `countSlider.maxValue` 设为 `PlayerGameData.GetCanSaleItemCount(itemId)`，而不是 `max_per_listing`；`RefreshExchangePanel` 只用 `tb.max_per_listing` 计算 `useCount = Ceil(count / max_per_listing)`，并用 `ConstantConfig.listed_quantity` 计算剩余交易行槽；`TradingSubPanel2.RefreshSaleItems` 同样按 `ConstantConfig.listed_quantity` 补空槽和展示上架数。本地修正为：交易行槽位上限使用 `listed_quantity=10`，不再混用拍卖行 `item_bid_slot_base`；源 `C2S_54` 上架数量超过 `Item.max_per_listing` 时拆为多个 `ExchangeLunchItem`，价格档仍按总剩余数量聚合；拍卖行 `LanchMax` 保持原拍卖槽逻辑。验证命令：`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts`、`npm run test -w @bitkingdom/server -- tests/routes.test.ts`、`npm run test -w @bitkingdom/server -- tests/profileRestoreCoverage.test.ts`、`npm run test -w @bitkingdom/server` 均通过；当前 server 为 99 个测试通过。

追加验证：交易行 `C2S_60` 购买前仓库容量预检修复后，源码证据为 `TradingBuy_Main.OnBuyClick` 在调用 `PlayerManager.ExchangeBuyItem(itemId,count,totalPrice)` 之前先构造 `{ itemId, count }` 并执行 `PlayerGameData.Instance.CheckCanAddItems(items)`，失败时只派发 `bubblebox_warehousefull` 并 `return`；`PlayerGameData.CheckCanAddItems` 会在仓库克隆上逐件 `TryAddItems`，因此购买请求不会发出。本地修正为：`profileStockRuntime.assertCanAddStockItemsToWarehouse` 使用同一格子占用算法在克隆仓库上试放待入库实体藏品；`buyExchangeItemForProfiles` 在扣买家铜钱、搬锁定箱子和更新卖家订单前先预检，失败保持买家铜钱、卖家订单和锁定库存不变；通用市场购买与拍卖到期成交搬运实体藏品也接入同一预检，避免 `returnStockBoxesToWarehouse` 部分成功后抛错。验证命令：`npm run typecheck -w @bitkingdom/server`、`npm run test -w @bitkingdom/server -- tests/profileService.test.ts` 已通过；当前 profileService 为 73 个测试通过。

## 下一步

下一轮建议继续处理交易/拍卖/送拍剩余协议差距：

- 继续复核 `TradingExchange_Main` 同账号自买、并发锁、成交历史保留窗口这些真实服务端不可见边界，必要时用可见客户端行为写明假设。
- 继续复核 `AuctionPlace* / Trading*` 剩余 UI 行为与可见服务端假设；送拍下一步只剩真实服务端结算生成算法和 UI 历史展示细节不可见边界。
