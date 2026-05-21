param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$docDir = Join-Path $Root 'doc'
$sourceIndexPath = Join-Path $Root 'reverse/bidking/code/source_index.csv'
$schemaIndexPath = Join-Path $Root 'reverse/bidking/config/table_schema_index.csv'
$schemaTsPath = Join-Path $Root 'packages/bidking-compat/src/schema.ts'
$uiWndTsvPath = Join-Path $Root 'reverse/bidking/config/tables_tsv/UIWnd.txt'

function Escape-Md([string]$Text) {
  if ($null -eq $Text -or $Text.Length -eq 0) {
    return ''
  }
  return ($Text -replace '\|', '\|' -replace "`r?`n", ' ').Trim()
}

function Write-Utf8File([string]$Path, [string[]]$Lines) {
  $content = ($Lines -join "`n") + "`n"
  Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
}

function Get-ClassGroup($Row) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($Row.path)
  $name = $base.ToLowerInvariant()
  $categories = [string]$Row.categories

  if ($name.StartsWith('e_')) {
    if ($name.Contains('achievement')) { return 'Achievement' }
    if ($name.Contains('activity')) { return 'Activity' }
    if ($name.Contains('friend')) { return 'Friend' }
    if ($name.Contains('club') -or $name.Contains('party') -or $name.Contains('guild')) { return 'Guild' }
    if ($name.Contains('mail')) { return 'Mail' }
    if ($name.Contains('guide')) { return 'Guide' }
    if ($name.Contains('emoji') -or $name.Contains('interaction')) { return 'EmojiArea' }
    if ($name.Contains('shop') -or $name.Contains('buy') -or $name.Contains('gift')) { return 'Shop' }
    if ($name.Contains('exchange') -or $name.Contains('trading') -or $name.Contains('sale') -or $name.Contains('auction')) { return 'Auction' }
    if ($name.Contains('room') -or $name.Contains('match') -or $name.Contains('game') -or $name.Contains('chujia') -or $name.Contains('bid') -or $name.Contains('sim')) { return 'Battle' }
    if ($name.Contains('stock') -or $name.Contains('cabinet') -or $name.Contains('collect')) { return 'WareHouse' }
    if ($name.Contains('head') -or $name.Contains('name') -or $name.Contains('badge')) { return 'Hero' }
    if ($name.Contains('voice') -or $name.Contains('sound') -or $name.Contains('volumn')) { return 'Sound' }
    if ($name.Contains('language')) { return 'Language' }
    if ($name.Contains('area')) { return 'EmojiArea' }
    if ($name.Contains('coin')) { return 'DataConfig' }
    if ($name.Contains('reddot') -or $name.Contains('loading') -or $name.Contains('waiting') -or $name.Contains('screen') -or $name.Contains('grid') -or $name.Contains('drag') -or $name.Contains('scroll') -or $name.Contains('refresh') -or $name.Contains('animation')) { return 'UI' }
    if ($name.Contains('logout') -or $name.Contains('online') -or $name.Contains('notify')) { return 'Network' }
    return 'EventBus'
  }

  if ($name.Contains('toggle') -or $name.Contains('button') -or $name.Contains('canvas') -or $name.Contains('click') -or $name.Contains('drag') -or $name.Contains('scroll') -or $name.Contains('text') -or $name.Contains('font') -or $name.Contains('color') -or $name.Contains('anim') -or $name.Contains('follow') -or $name.Contains('radar') -or $name.Contains('progressbar')) { return 'UI' }
  if ($name.Contains('eventdispatcher') -or $name.Contains('eventmanager') -or $name.Contains('eventdelegate') -or $name.Contains('eventhandler') -or $name.StartsWith('event')) { return 'EventBus' }
  if ($name.Contains('auth') -or $name.Contains('connector') -or $name.Contains('logout') -or $name.Contains('login')) { return 'Network' }
  if ($name.StartsWith('battleprev')) { return 'BattlePrev' }
  if ($name.StartsWith('battle') -or $categories -match 'battle') { return 'Battle' }
  if ($name.StartsWith('auction') -or $categories -match 'auction') { return 'Auction' }
  if ($name.StartsWith('shop')) { return 'Shop' }
  if ($name.StartsWith('mail')) { return 'Mail' }
  if ($name.StartsWith('task') -or $name.StartsWith('mission')) { return 'Mission' }
  if ($name.StartsWith('rank')) { return 'Rank' }
  if ($name.StartsWith('guild')) { return 'Guild' }
  if ($name.StartsWith('friend')) { return 'Friend' }
  if ($name.StartsWith('activity')) { return 'Activity' }
  if ($name.StartsWith('guide')) { return 'Guide' }
  if ($name.StartsWith('sound') -or $name.Contains('audio') -or $name.Contains('music')) { return 'Sound' }
  if ($name.StartsWith('language') -or $name.Contains('localization') -or $name.Contains('i18n')) { return 'Language' }
  if ($name.StartsWith('ui') -or $name.Contains('panel') -or $name.Contains('window') -or $name.Contains('wnd')) { return 'UI' }
  if ($name.StartsWith('hero') -or $name.Contains('role') -or $name.Contains('skin')) { return 'Hero' }
  if ($name.StartsWith('item') -or $name.Contains('prop')) { return 'Item' }
  if ($name.StartsWith('warehouse') -or $name.StartsWith('warehouse') -or $name.StartsWith('warehouse') -or $name.StartsWith('bag') -or $name.StartsWith('package') -or $name.StartsWith('cabinet')) { return 'WareHouse' }
  if ($name.StartsWith('pay') -or $name.StartsWith('purchase') -or $name.StartsWith('dlc') -or $name.StartsWith('gift')) { return 'PayDlc' }
  if ($name.StartsWith('achievement')) { return 'Achievement' }
  if ($name.StartsWith('notice') -or $name.StartsWith('errorcode') -or $name.StartsWith('message')) { return 'NoticeError' }
  if ($name.StartsWith('setting') -or $name.StartsWith('settings') -or $name.Contains('option')) { return 'Setting' }
  if ($name.StartsWith('emoji') -or $name.StartsWith('area')) { return 'EmojiArea' }
  if ($categories -match 'network' -or $name.Contains('network') -or $name.Contains('socket') -or $name.Contains('http') -or $name.Contains('request') -or $name.Contains('response') -or $name.Contains('packet') -or $name.Contains('client') -or $name.Contains('server')) { return 'Network' }
  if ($categories -match 'table_config' -or $name.Contains('config') -or $name.Contains('data') -or $name.Contains('table') -or $name.Contains('model') -or $name.EndsWith('vo') -or $name.EndsWith('dto')) { return 'DataConfig' }
  if ($categories -match 'asset_loading' -or $name.Contains('asset') -or $name.Contains('bundle') -or $name.Contains('loader') -or $name.Contains('download')) { return 'AssetLoading' }
  return 'SystemUtil'
}

function Get-ClassTarget([string]$Group) {
  switch ($Group) {
    'BattlePrev' { return 'apps/web/src/bidking/battle-prev + apps/server/src/domain/battle-loadout' }
    'Battle' { return 'apps/web/src/bidking/battle + packages/match-core/src/bidking/auction + apps/server/src/sockets/battle' }
    'Auction' { return 'apps/web/src/bidking/market + apps/server/src/domain/market + packages/match-core/src/bidking/auction' }
    'Shop' { return 'apps/web/src/bidking/shop + apps/server/src/domain/shop' }
    'Mail' { return 'apps/web/src/bidking/mail + apps/server/src/domain/mail' }
    'Mission' { return 'apps/web/src/bidking/mission + apps/server/src/domain/mission' }
    'Rank' { return 'apps/web/src/bidking/rank + apps/server/src/domain/rank' }
    'Guild' { return 'apps/web/src/bidking/guild + apps/server/src/domain/guild' }
    'Friend' { return 'apps/web/src/bidking/friend + apps/server/src/domain/friend' }
    'Activity' { return 'apps/web/src/bidking/activity + apps/server/src/domain/activity' }
    'Guide' { return 'apps/web/src/bidking/guide + apps/server/src/domain/guide' }
    'Sound' { return 'apps/web/src/bidking/system/SoundManager.ts' }
    'Language' { return 'apps/web/src/bidking/system/LanguageService.ts' }
    'UI' { return 'apps/web/src/bidking/app/windowRegistry.ts + feature panel modules' }
    'Hero' { return 'apps/web/src/bidking/hero + packages/match-core/src/bidking/skill' }
    'Item' { return 'apps/web/src/bidking/handbook + apps/web/src/bidking/package + apps/server/src/domain/inventory' }
    'WareHouse' { return 'apps/web/src/bidking/package + apps/server/src/domain/inventory' }
    'PayDlc' { return 'apps/web/src/bidking/activity + apps/server/src/domain/payment-demo' }
    'Achievement' { return 'apps/web/src/bidking/mission + apps/server/src/domain/achievement' }
    'NoticeError' { return 'apps/web/src/bidking/system + apps/server/src/domain/notice' }
    'Setting' { return 'apps/web/src/bidking/system/settings + apps/server/src/domain/profile' }
    'EmojiArea' { return 'apps/web/src/bidking/battle + apps/web/src/bidking/guild + apps/server/src/domain/social' }
    'Network' { return 'apps/server/src/routes + apps/server/src/sockets + packages/shared/src' }
    'EventBus' { return 'packages/shared/src/events + apps/web/src/bidking/app/eventBus + apps/server/src/domain/events' }
    'DataConfig' { return 'packages/bidking-compat + packages/match-core/src/bidking/config' }
    'AssetLoading' { return 'apps/web/src/artAssets.ts + apps/web/src/bidking/system/assets' }
    'SystemUtil' { return 'apps/web/src/bidking/system + packages/shared/src' }
    default { return 'M0 二次分类待处理' }
  }
}

function Get-ClassAcceptance([string]$Group) {
  switch ($Group) {
    'Battle' { return '竞拍 socket 流程、回放一致性、Playwright 局内冒烟' }
    'BattlePrev' { return '战前选图/选人/带道具/扣票流程测试' }
    'Auction' { return '局内竞拍与局外拍卖行订单测试' }
    'DataConfig' { return 'validate:bidking-compat 与字段 owner 校验' }
    'Network' { return 'REST/socket contract 测试' }
    'EventBus' { return '事件名、payload DTO、前后端派发/订阅测试' }
    'UI' { return 'UIWnd 打开/关闭/层级/红点 Playwright 测试' }
    'SystemUtil' { return '通用 UI/工具/生命周期封装测试，确认无业务状态遗漏' }
    default { return '单测 + 接口测试 + UI 冒烟 + 矩阵状态回填' }
  }
}

function Get-TableFileName([string]$ModuleName) {
  switch ($ModuleName) {
    'ItemType' { return 'Item_Type' }
    'NumberTable' { return 'Number' }
    'Head' { return 'head' }
    default { return $ModuleName }
  }
}

function Get-TableStatus([string]$Table) {
  $behavior = @('BidMap', 'Drop', 'Item', 'Hero', 'Skill', 'SkillGroup', 'SkillEffect', 'RankMap', 'RankAi', 'Map', 'Ticket', 'Shop', 'ShopItem', 'GiftPackage', 'Pay', 'PurchaseList', 'Dlc', 'ItemRestock', 'Mission', 'Achievement', 'LevelUp', 'Mail', 'Rank', 'RankReward', 'BattleItem', 'Activity', 'Access', 'Condition', 'Constant', 'DirtyWords', 'GuildPermissions', 'GuildPoints', 'GuildResources', 'Guide', 'Notice', 'LanguageName', 'Emoji', 'ExchangeRestock', 'NumberTable', 'Sim', 'Area', 'GuildArea', 'ItemType', 'Cabinet', 'HeroSkin', 'UIWnd', 'WareHouse', 'Head', 'Sound', 'Language', 'LanguageListen', 'ErrorCode')
  $ui = @()
  $skeleton = @()
  if ($behavior -contains $Table) { return 'Behavior' }
  if ($ui -contains $Table) { return 'UI' }
  if ($skeleton -contains $Table) { return 'Skeleton' }
  return 'Mapped'
}

function Get-TableDomain([string]$Table) {
  switch ($Table) {
    { $_ -in @('BidMap', 'Drop', 'RankMap', 'Map') } { return 'core-auction/map/drop' }
    { $_ -in @('Hero', 'HeroSkin', 'Skill', 'SkillGroup', 'SkillEffect', 'BattleItem', 'RankAi', 'Sim', 'Emoji') } { return 'battle/skill/bot' }
    { $_ -in @('Item', 'ItemType', 'Cabinet', 'WareHouse', 'NumberTable', 'Head', 'LevelUp') } { return 'growth/inventory/profile' }
    { $_ -in @('Mission', 'Achievement', 'Condition', 'Access', 'Constant') } { return 'condition/growth/access' }
    { $_ -in @('Shop', 'ShopItem', 'Ticket', 'ItemRestock', 'ExchangeRestock', 'GiftPackage', 'Pay', 'PurchaseList', 'Dlc') } { return 'commerce/economy' }
    { $_ -in @('Mail', 'Notice', 'ErrorCode') } { return 'message/system' }
    { $_ -in @('Rank', 'RankReward') } { return 'rank' }
    { $_ -in @('Activity') } { return 'activity/pass' }
    { $_ -in @('Area', 'GuildArea', 'GuildPermissions', 'GuildPoints', 'GuildResources', 'LanguageName') } { return 'social/guild/area' }
    { $_ -in @('UIWnd', 'Guide', 'Sound', 'Language', 'LanguageListen', 'DirtyWords') } { return 'ui/system/runtime' }
    default { return 'unassigned' }
  }
}

function Get-TableOwner([string]$Table) {
  if ($Table -in @('GiftPackage', 'Pay', 'PurchaseList', 'Dlc')) {
    return 'apps/server/src/domain/economy + apps/web/src/bidking/activity'
  }
  if ($Table -in @('Shop', 'ShopItem', 'Ticket', 'ItemRestock', 'ExchangeRestock')) {
    return 'apps/server/src/domain/shop + apps/server/src/domain/economy + apps/web/src/bidking/shop'
  }
  $domain = Get-TableDomain $Table
  switch -Wildcard ($domain) {
    'core-*' { return 'packages/match-core/src/bidking + apps/server/src/sockets/battle' }
    'battle*' { return 'packages/match-core/src/bidking/skill + apps/web/src/bidking/battle' }
    'growth*' { return 'apps/server/src/domain/profile + apps/web/src/bidking/package' }
    'condition*' { return 'packages/match-core/src/bidking/condition + apps/server/src/domain/access' }
    'commerce*' { return 'apps/server/src/domain/shop + apps/web/src/bidking/shop' }
    'message*' { return 'apps/server/src/domain/mail + apps/web/src/bidking/system' }
    'rank' { return 'apps/server/src/domain/rank + apps/web/src/bidking/rank' }
    'activity*' { return 'apps/server/src/domain/activity + apps/web/src/bidking/activity' }
    'social*' { return 'apps/server/src/domain/guild + apps/web/src/bidking/guild' }
    'ui*' { return 'apps/web/src/bidking/system + apps/server/src/domain/bootstrap' }
    default { return 'M0 待指定 owner' }
  }
}

function Get-TableNextAction([string]$Table) {
  switch ($Table) {
    'BattleItem' { return '逐行接 skill_group，取消按 battle_item_type 聚合的简化效果' }
    'Condition' { return '枚举所有条件类型，未知条件不再默认放行' }
    'Access' { return '所有入口、商品、角色、皮肤、地图和活动统一校验' }
    'Sound' { return '已接设置面板音频选择；补 SoundManager 注册、BGM/SFX 触发点和音量回放' }
    'Language' { return '已接语言列设置和本地化样例；补 LanguageService key 化，全 UI 文案走本项目包装 key' }
    'DirtyWords' { return '已接昵称和字符串设置过滤；补协会名、聊天、订单备注等输入全接过滤' }
    'ErrorCode' { return '已接 bootstrap 摘要、前端错误码面板、服务端 4xx/5xx 错误码信封和局外操作 toast；补 UI 逐业务错误提示样式' }
    'Notice' { return '已接 bootstrap 摘要、已读状态和 UI 操作；补启动公告弹窗、有效期和优先级' }
    'UIWnd' { return '建立 windowRegistry，驱动窗口层级、遮罩、BGM 和入口' }
    'Guide' { return '已接引导完成状态和 UI 操作；补触发条件、遮罩、跳过和关键节点定位' }
    'LanguageName' { return '已接服务端随机名应用；补 Bot、地区和好友随机名生成' }
    'GuildPermissions' { return '已接协会职位权限和资源操作鉴权；补成员审批、踢人、公告、改职和统一错误码' }
    'GuildPoints' { return '已接捐献积分档位；补活跃、比赛、地区积分来源全接事件' }
    'GuildResources' { return '已接协会资源领取、消耗和后台交易记录；补兑换、升级和地区产出' }
    'ItemRestock' { return '已接商店刷新快照和随机商品池；补刷新成本、自动刷新到期和 ExchangeRestock 联动' }
    'ExchangeRestock' { return '已接兑换刷新池快照；补兑换下单、库存扣减和刷新时间持久化' }
    'GiftPackage' { return '已接礼包奖励发放和幂等领取；补限购、时间窗口和购买链路' }
    'Pay' { return '已接本地模拟订单创建、完成、取消和幂等到账；补真实支付适配边界和后台订单筛选' }
    'PurchaseList' { return '已接平台商品模拟到账；补真实 SKU 关系、显示价格和购买限制' }
    'Dlc' { return '已接本地模拟 DLC 解锁、奖励发放和重复购买防护；补 DLC 入口红点和平台 SKU 关联' }
    'Sim' { return '接入模拟局、Bot 压测和收益演算' }
    'Emoji' { return '已接 socket 表情表校验和 Bot 表情来源；补冷却、音效和角色限制' }
    'NumberTable' { return '已接收藏档位加成快照；补收益结算和称号/头像联动' }
    'Area' { return '已接地区排行快照；补地区归属、地区资源和地图入口联动' }
    'GuildArea' { return '已接协会地区与地区资源快照；补地区榜奖励和区域徽章' }
    'LanguageListen' { return '已接设置面板语音 key 展示；补真实语音触发和 Sound i18n 路径联动' }
    'Achievement' { return '已按 Achievement -> Mission 阶段接领奖；补完整成就进度事件和红点' }
    'LevelUp' { return '已接等级奖励领取；补升级事件、升级动效和额外奖励档位' }
    default { return '按 100% 计划补字段解释、服务端行为、前端入口和测试证据' }
  }
}

function Get-UiTarget([string]$Name, [string]$Path) {
  $text = (($Name + ' ' + $Path).ToLowerInvariant())
  if ($text.Contains('battleprev')) { return 'apps/web/src/bidking/battle-prev' }
  if ($text.Contains('battle')) { return 'apps/web/src/bidking/battle' }
  if ($text.Contains('shop')) { return 'apps/web/src/bidking/shop' }
  if ($text.Contains('mail')) { return 'apps/web/src/bidking/mail' }
  if ($text.Contains('task') -or $text.Contains('mission') -or $text.Contains('achievement')) { return 'apps/web/src/bidking/mission' }
  if ($text.Contains('rank')) { return 'apps/web/src/bidking/rank' }
  if ($text.Contains('guild')) { return 'apps/web/src/bidking/guild' }
  if ($text.Contains('friend')) { return 'apps/web/src/bidking/friend' }
  if ($text.Contains('auction') -or $text.Contains('exchange') -or $text.Contains('market')) { return 'apps/web/src/bidking/market' }
  if ($text.Contains('activity') -or $text.Contains('pass') -or $text.Contains('gift') -or $text.Contains('pay') -or $text.Contains('purchase') -or $text.Contains('dlc')) { return 'apps/web/src/bidking/activity' }
  if ($text.Contains('handbook') -or $text.Contains('itemdetail')) { return 'apps/web/src/bidking/handbook' }
  if ($text.Contains('package') -or $text.Contains('warehouse') -or $text.Contains('bag') -or $text.Contains('cabinet')) { return 'apps/web/src/bidking/package' }
  if ($text.Contains('hero')) { return 'apps/web/src/bidking/hero' }
  if ($text.Contains('guide')) { return 'apps/web/src/bidking/guide' }
  if ($text.Contains('setting') -or $text.Contains('sound') -or $text.Contains('language') -or $text.Contains('login') -or $text.Contains('loading') -or $text.Contains('message') -or $text.Contains('bubble')) { return 'apps/web/src/bidking/system' }
  if ($text.Contains('uimain')) { return 'apps/web/src/bidking/app' }
  return 'apps/web/src/bidking/app/windowRegistry.ts'
}

function Get-UiRequirement([string]$Target) {
  switch -Wildcard ($Target) {
    '*battle-prev*' { return '战前窗口接地图、角色、皮肤、道具、票券和 Access 校验' }
    '*battle' { return '局内窗口接轮次、出价、技能、道具、表情、结算和回放' }
    '*shop*' { return '商店窗口接商品、刷新、购买、限购和错误提示' }
    '*mail*' { return '邮件窗口接已读、领取、删除、过期和附件发放' }
    '*mission*' { return '任务/成就窗口接进度、领奖、红点和重置' }
    '*rank*' { return '排行窗口接快照、排名、奖励和领奖状态' }
    '*guild*' { return '协会窗口接成员、职位、资源、权限和地区积分' }
    '*market*' { return '市场窗口接挂单、成交、撤单、竞价和交易记录' }
    '*activity*' { return '活动/通行证/礼包窗口接时间、奖励、模拟购买和红点' }
    '*system*' { return '系统窗口接 Sound/Language/ErrorCode/TextGuard/Notice' }
    default { return '注册到 UIWnd windowRegistry，补打开/关闭/层级/遮罩/BGM 行为' }
  }
}

$sourceRows = Import-Csv -LiteralPath $sourceIndexPath
$scriptRows = @($sourceRows | Where-Object { $_.assembly -eq 'Scripts' })
$classItems = foreach ($row in $scriptRows) {
  $group = Get-ClassGroup $row
  [pscustomobject]@{
    Path = $row.path
    ClassName = [System.IO.Path]::GetFileNameWithoutExtension($row.path)
    Lines = [int]$row.lines
    Categories = [string]$row.categories
    Types = [string]$row.types
    Methods = [string]$row.methods_preview
    Group = $group
    Target = Get-ClassTarget $group
    Status = 'Mapped'
    Acceptance = Get-ClassAcceptance $group
  }
}

$classLines = New-Object System.Collections.Generic.List[string]
$classLines.Add('# BidKing 原类映射账本')
$classLines.Add('')
$classLines.Add('> 生成时间：2026-05-19。来源：`reverse/bidking/code/source_index.csv`，仅纳入 `Scripts` 程序集 1256 个 `.cs` 文件。本文只记录路径、类名、行数、分类和本项目目标模块，不复制原始反编译源码。')
$classLines.Add('')
$classLines.Add('## 覆盖摘要')
$classLines.Add('')
$classLines.Add("| 项 | 数量 |")
$classLines.Add("| --- | ---: |")
$classLines.Add("| Scripts 原类文件 | $($classItems.Count) |")
($classItems | Group-Object Group | Sort-Object Count -Descending) | ForEach-Object {
  $classLines.Add("| $($_.Name) | $($_.Count) |")
}
$classLines.Add('')
$classLines.Add('## 逐类映射')
$classLines.Add('')
$classLines.Add('| # | 原文件 | 类/类型摘要 | 行数 | reverse 分类 | 目标类群 | 本项目目标模块 | 状态 | 验收方式 |')
$classLines.Add('| ---: | --- | --- | ---: | --- | --- | --- | --- | --- |')
$index = 1
foreach ($item in ($classItems | Sort-Object Group, Path)) {
  $classLines.Add("| $index | ``$(Escape-Md $item.Path)`` | $(Escape-Md $item.Types) | $($item.Lines) | $(Escape-Md $item.Categories) | $($item.Group) | ``$(Escape-Md $item.Target)`` | $($item.Status) | $(Escape-Md $item.Acceptance) |")
  $index++
}
Write-Utf8File (Join-Path $docDir 'bidking_restore_class_matrix.md') $classLines

$schemaText = Get-Content -LiteralPath $schemaTsPath -Raw
$targetMatches = [regex]::Matches($schemaText, '^\s+([A-Za-z][A-Za-z0-9]*):\s+(\d+),?', [System.Text.RegularExpressions.RegexOptions]::Multiline)
$schemaRows = Import-Csv -LiteralPath $schemaIndexPath
$fieldMap = @{}
foreach ($group in ($schemaRows | Group-Object table)) {
  $fieldMap[$group.Name] = ($group.Group | Sort-Object { [int]$_.column_index } | ForEach-Object { "$($_.field):$($_.type)" }) -join ', '
}

$tableItems = foreach ($match in $targetMatches) {
  $moduleName = $match.Groups[1].Value
  $targetRows = [int]$match.Groups[2].Value
  $sourceTable = Get-TableFileName $moduleName
  $fields = if ($fieldMap.ContainsKey($sourceTable)) { $fieldMap[$sourceTable] } else { '' }
  [pscustomobject]@{
    Module = $moduleName
    SourceTable = $sourceTable
    Rows = $targetRows
    FieldCount = if ($fields.Length -gt 0) { (($fields -split ', ').Count) } else { 0 }
    Fields = $fields
    Domain = Get-TableDomain $moduleName
    Owner = Get-TableOwner $moduleName
    Status = Get-TableStatus $moduleName
    NextAction = Get-TableNextAction $moduleName
    Tests = "packages/match-core/src/bidking/* + apps/server/tests/* + apps/web/tests/*"
  }
}

$tableLines = New-Object System.Collections.Generic.List[string]
$tableLines.Add('# BidKing 52 表行为接入账本')
$tableLines.Add('')
$tableLines.Add('> 生成时间：2026-05-19。来源：`packages/bidking-compat/src/schema.ts` 与 `reverse/bidking/config/table_schema_index.csv`。目标是让每张表都有运行层 owner、字段解释、测试和 100% 验收状态。')
$tableLines.Add('')
$tableLines.Add('## 覆盖摘要')
$tableLines.Add('')
$tableLines.Add('| 项 | 数量 |')
$tableLines.Add('| --- | ---: |')
$tableLines.Add("| 已登记表 | $($tableItems.Count) |")
$tableLines.Add("| 已登记数据行 | $(($tableItems | Measure-Object Rows -Sum).Sum) |")
($tableItems | Group-Object Status | Sort-Object Name) | ForEach-Object {
  $tableLines.Add("| 当前状态 $($_.Name) | $($_.Count) |")
}
$tableLines.Add('')
$tableLines.Add('## 逐表矩阵')
$tableLines.Add('')
$tableLines.Add('| 表模块 | 原表名 | 行数 | 字段数 | 功能域 | 当前状态 | Owner | 下一步 100% 动作 | 测试归属 |')
$tableLines.Add('| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |')
foreach ($item in ($tableItems | Sort-Object Domain, Module)) {
  $tableLines.Add("| ``$($item.Module)`` | ``$($item.SourceTable)`` | $($item.Rows) | $($item.FieldCount) | $(Escape-Md $item.Domain) | $($item.Status) | ``$(Escape-Md $item.Owner)`` | $(Escape-Md $item.NextAction) | ``$(Escape-Md $item.Tests)`` |")
}
$tableLines.Add('')
$tableLines.Add('## 字段索引')
$tableLines.Add('')
$tableLines.Add('| 表模块 | 字段摘要 |')
$tableLines.Add('| --- | --- |')
foreach ($item in ($tableItems | Sort-Object Module)) {
  $fieldText = if ($item.Fields.Length -gt 0) { $item.Fields } else { 'schema index 缺字段，需人工补齐' }
  $tableLines.Add("| ``$($item.Module)`` | $(Escape-Md $fieldText) |")
}
Write-Utf8File (Join-Path $docDir 'bidking_restore_table_matrix.md') $tableLines

$uiRows = Get-Content -LiteralPath $uiWndTsvPath | Where-Object { $_.Trim().Length -gt 0 } | ForEach-Object {
  $parts = $_.Split("`t")
  $id = $parts[0]
  $displayName = if ($parts.Count -gt 2) { $parts[2] } else { '' }
  $name = if ($parts.Count -gt 3) { $parts[3] } else { '' }
  $beizhu = if ($parts.Count -gt 4) { $parts[4] } else { '' }
  $path = if ($parts.Count -gt 5) { $parts[5] } else { '' }
  $isMain = if ($parts.Count -gt 6) { $parts[6] } else { '' }
  $layer = if ($parts.Count -gt 7) { $parts[7] } else { '' }
  $bgm = if ($parts.Count -gt 10) { $parts[10] } else { '' }
  $isBlur = if ($parts.Count -gt 11) { $parts[11] } else { '' }
  $target = Get-UiTarget $name $path
  [pscustomobject]@{
    Id = $id
    DisplayName = $displayName
    Name = $name
    Beizhu = $beizhu
    Path = $path
    IsMain = $isMain
    Layer = $layer
    BGM = $bgm
    IsBlur = $isBlur
    Target = $target
    Status = 'Mapped'
    Requirement = Get-UiRequirement $target
  }
}

$uiLines = New-Object System.Collections.Generic.List[string]
$uiLines.Add('# BidKing UIWnd 窗口映射账本')
$uiLines.Add('')
$uiLines.Add('> 生成时间：2026-05-19。来源：`reverse/bidking/config/tables_tsv/UIWnd.txt`。目标是把 UIWnd 的窗口名、Prefab 路径、层级、BGM、模糊规则映射到本项目 React 窗口注册系统。')
$uiLines.Add('')
$uiLines.Add('## 覆盖摘要')
$uiLines.Add('')
$uiLines.Add('| 项 | 数量 |')
$uiLines.Add('| --- | ---: |')
$uiLines.Add("| UIWnd 行数 | $($uiRows.Count) |")
($uiRows | Group-Object Target | Sort-Object Count -Descending) | ForEach-Object {
  $uiLines.Add("| ``$($_.Name)`` | $($_.Count) |")
}
$uiLines.Add('')
$uiLines.Add('## 逐窗口矩阵')
$uiLines.Add('')
$uiLines.Add('| Id | 显示名 | 窗口名 | Prefab 路径 | 主窗口 | Layer | BGM | Blur | 目标模块 | 状态 | 100% 接入要求 |')
$uiLines.Add('| ---: | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | --- |')
foreach ($row in ($uiRows | Sort-Object { [int]$_.Id })) {
  $uiLines.Add("| $($row.Id) | $(Escape-Md $row.DisplayName) | ``$($row.Name)`` | ``$(Escape-Md $row.Path)`` | $($row.IsMain) | $($row.Layer) | ``$(Escape-Md $row.BGM)`` | $($row.IsBlur) | ``$(Escape-Md $row.Target)`` | $($row.Status) | $(Escape-Md $row.Requirement) |")
}
Write-Utf8File (Join-Path $docDir 'bidking_restore_uiwnd_matrix.md') $uiLines

$acceptanceLines = @(
  '# BidKing 100% 还原验收矩阵',
  '',
  '> 生成时间：2026-05-19。本文是 `20260519_BidKing全功能全结构100还原开发计划.md` 的执行验收账本。只有状态到 `Equivalent` 的项才计入 100% 完成。',
  '',
  '## M0 基线',
  '',
  '| 项 | 当前值 | 100% 判定 | 当前状态 |',
  '| --- | ---: | --- | --- |',
  "| Scripts 原类映射 | $($classItems.Count) | 1256 个类都有映射结论，没有 Unknown | Mapped |",
  "| 配置表行为账本 | $($tableItems.Count) | 52 张表都有 owner、字段解释、测试和行为状态 | Mapped |",
  "| UIWnd 窗口账本 | $($uiRows.Count) | 80 个窗口都有目标模块、层级、BGM/Blur 处理 | Mapped |",
  '',
  '## 阶段验收',
  '',
  '| 阶段 | 目标 | 必过证据 | 当前状态 |',
  '| --- | --- | --- | --- |',
  '| M0 | 基线锁定与审查账本 | class/table/uiwnd/acceptance 四份矩阵生成并纳入导航 | Verified |',
  '| M1 | 代码结构复刻骨架 | main.tsx、roomManager.ts、profileService.ts、serverApp/routes 拆分；行为不回退 | Behavior |',
  '| M2 | Condition/Access/Reward/Constant 解释器 | 未知条件阻断；奖励统一走 ledger；解释器单测 | Behavior |',
  '| M3 | 核心竞拍深化 | BattleItem 逐道具接 SkillGroup；回放同 seed 一致 | Behavior |',
  '| M4 | 服务端权威状态与存储 | SQLite store、ledger、event、admin 审计 | Behavior |',
  '| M5 | 局外成长闭环 | 任务、成就、等级、头像、仓库、收藏柜全操作 | Behavior |',
  '| M6 | 商店票券礼包支付模拟 | 刷新池、礼包、购买列表、支付模拟完整 | Behavior |',
  '| M7 | 市场拍卖行排行 | 订单、成交、撤单、手续费、排行快照完整 | Behavior |',
  '| M8 | 协会好友地区社交 | 权限、资源、积分、好友申请、文本过滤完整 | Behavior |',
  '| M9 | 活动通行证公告引导 | 活动时间、通行证、Notice、Guide 完整 | Behavior |',
  '| M10 | 前端 100% 操作化 | 无待开发入口；桌面/移动 Playwright 通过 | Verified |',
  '| M11 | 后台调试和最终审查 | 后台审计、截图、测试记录、缺口清零 | Behavior |',
  '',
  '## 固定验证命令',
  '',
  '```bash',
  'npm run validate:bidking-compat',
  'npm run typecheck',
  'npm test',
  'npm run test:playwright',
  'npm run build -w @bitkingdom/web',
  '```',
  '',
  '## 100% 完成硬条件',
  '',
  '- 52 张表全部 `Equivalent`。',
  '- 1256 个原类全部有映射结论，没有 `Unknown`。',
  '- 80 个 UIWnd 窗口全部进入 windowRegistry。',
  '- 前端没有 `待开发` 入口。',
  '- 所有经济变更进入 profile + ledger。',
  '- 核心竞拍同 seed 可重放。',
  '- BattleItem、SkillEffect、Condition、Reward 类型均有测试。',
  '- 市场、协会、活动、通行证、商店、邮件、任务、成就、排行都能完整操作。',
  '- Sound、Language、DirtyWords、Guide、UIWnd 全部进入运行层。',
  '- 后台可审计 profile、ledger、event、match replay、config parity。',
  '- validate、typecheck、test、build、Playwright 全部通过。'
)
Write-Utf8File (Join-Path $docDir 'bidking_restore_acceptance_matrix.md') $acceptanceLines

Write-Host "Generated restore matrices:"
Write-Host "  doc/bidking_restore_class_matrix.md ($($classItems.Count) classes)"
Write-Host "  doc/bidking_restore_table_matrix.md ($($tableItems.Count) tables)"
Write-Host "  doc/bidking_restore_uiwnd_matrix.md ($($uiRows.Count) windows)"
Write-Host "  doc/bidking_restore_acceptance_matrix.md"
