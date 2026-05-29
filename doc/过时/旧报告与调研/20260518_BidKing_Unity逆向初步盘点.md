# 20260518 BidKing Unity 逆向初步盘点

> 依据 `unity-reverse-engineering-skill` 执行，只做授权本地副本的非破坏性静态盘点；未做补丁、绕过、反编译源码摘录或素材分发。

## 范围

- 目标路径：Steam 本地安装目录（路径已脱敏）
- 平台形态：Windows x64 / Steam 本地安装目录
- 盘点时间：2026-05-18
- 输出文件：`doc/20260518_BidKing_Unity_build_inventory.json`

## 构建判断

- Unity 版本主线：`2021.3.29f1`
  - 证据：`BidKing.exe`、`UnityPlayer.dll` 版本信息，以及 `BidKing_Data/globalgamemanagers` 中的版本字符串。
  - `UnityPlayer.dll` 中也出现 `2018.3.0a1` 字符串，判断为引擎内部兼容/历史字符串，不作为主构建版本。
- 脚本后端：IL2CPP
  - 证据：顶层存在 `GameAssembly.dll`。
  - 证据：存在 `BidKing_Data/il2cpp_data/Metadata/global-metadata.dat`。
  - 证据：标准 `Managed/` 游戏程序集未发现。
- Unity 主要结构：
  - `BidKing.exe`
  - `UnityPlayer.dll`
  - `GameAssembly.dll`
  - `BidKing_Data/`
  - `BidKing_Data/Plugins/x86_64/steam_api64.dll`

## 关键哈希

| 文件 | SHA256 |
| --- | --- |
| `BidKing.exe` | `3FDFFBB118EB4BBE5CFC6B9E2C1C3F6B2F96F53C80C71C9FAC76954A3C59062C` |
| `GameAssembly.dll` | `200A67B46A541F15B65024D9938DBBACEF55A7623430231848F3678AF8FB2352` |
| `UnityPlayer.dll` | `C18FE00CBF13B36BE72ED604DE11E210173540A3D5B5EC158D61DE8CC9946D98` |
| `global-metadata.dat` | `ED760DDFA65850AE9AB53B3F6A6D90227E4752AB54C21F0A23A0B8C230139219` |
| `StreamingAssets/filelist.txt` | `D20AF492C9553F63A76AB7E8908849C5C8F9C3CEF1E426B58FB1FF0C58D25C8F` |
| `StreamingAssets/StandaloneWindows64.manifest` | `4D3240238A60D244964912F5A2FF70978A4779FB975A5BAE713CAA988AC98B9E` |

## StreamingAssets 结构

`StreamingAssets` 是当前最重要的玩法/包装化入口。目录体量如下：

| 目录 | 文件数 | 大小 |
| --- | ---: | ---: |
| `ui` | 5682 | 2267.39 MB |
| `sound` | 2376 | 112.94 MB |
| `Tables` | 52 | 9.49 MB |
| `model` | 18 | 122.44 MB |
| `dll` | 16 | 8.68 MB |
| `scenes` | 6 | 86.23 MB |
| `common` | 4 | 168.46 MB |
| `anim` | 2 | 0.01 MB |
| `Gif` | 1 | 24.98 MB |

## 资源与更新线索

- `StreamingAssets/fileVersion` 当前值为 `287`。
- `StreamingAssets/filelist.txt` 首行显示 `Ver:287|FileCount:4114`，后续记录形如 `路径|校验值=$大小`。
- `StreamingAssets/fileDiff.txt` 指向 `http://cdna.bidking.cn/bidking/StandaloneWindows64/...`，说明本地包存在可差异更新的 CDN 资源清单机制。
- `StreamingAssets/StandaloneWindows64.manifest` 是 AssetBundle manifest，包含大量 `ui/atlas/*.data`、`ui/textures/*.data` 等依赖关系。
- 未发现标准 Addressables catalog 文件。

## 热更/脚本线索

`StreamingAssets/dll/` 下存在 `.dll.bytes` 与 `.pdb.bytes`：

- `Assembly-CSharp.dll.bytes` 与 `StompyRobot.SRF.dll.bytes` 以 `MZ` 开头，能识别为 .NET assembly metadata。
- `Scripts.dll.bytes`、`NotHotUpdate.dll.bytes`、`DOTween.dll.bytes`、`Google.Protobuf.dll.bytes`、`LitJson.dll.bytes`、`mscorlib.dll.bytes`、`System*.dll.bytes`、`UnityEngine*.dll.bytes` 等首 4 字节为 `3F-23-E2-73`，不是直接 PE 形态，疑似做过封装、压缩或变换。
- `Scripts.pdb.bytes` 存在且较大，说明构建/热更资源里可能保留了调试符号信息或符号载体。

这条线索对玩法复刻很关键：主壳是 IL2CPP，但实际业务逻辑可能有一部分通过 `StreamingAssets/dll` 装载或更新。

## 配置表线索

`StreamingAssets/Tables/` 下有 52 个表，明显覆盖玩法、经济、UI、角色、地图、商店、任务等系统。重点入口：

- 玩法与局内：`BidMap.txt`、`BattleItem.txt`、`Skill.txt`、`SkillEffect.txt`、`SkillGroup.txt`、`Condition.txt`
- 经济与物品：`Item.txt`、`Drop.txt`、`Shop.txt`、`ShopItem.txt`、`Pay.txt`、`PurchaseList.txt`
- 角色与成长：`Hero.txt`、`HeroSkin.txt`、`LevelUp.txt`、`Rank.txt`、`RankAi.txt`、`RankMap.txt`
- UI 与文案：`UIWnd.txt`、`Language.txt`、`LanguageName.txt`、`LanguageListen.txt`、`Notice.txt`
- 系统与常量：`Constant.txt`、`ErrorCode.txt`、`Guide.txt`、`Dlc.txt`、`Access.txt`

表内容不是普通可读 TSV，首行呈 Base64/编码字段特征。后续分析应先确认表字段分隔、编码和加载逻辑，再进入数据语义整理。

## 初步结论

1. 这是 Unity `2021.3.29f1` Windows x64 IL2CPP 构建。
2. 本地资源包采用 `StreamingAssets + AssetBundle manifest + filelist/fileVersion/fileDiff` 的更新/校验体系。
3. 玩法复刻优先入口不是直接反 IL2CPP，而是 `StreamingAssets/Tables` 与 `StreamingAssets/dll`。
4. `ui` 目录体量最大，适合优先做界面/素材结构映射；`Tables` 体量小但信息密度高，适合优先做玩法规则提取。
5. `StreamingAssets/dll` 的混合状态提示可能存在热更脚本、封装程序集或运行时加载逻辑，值得下一步专门追踪。

## 建议下一步

- 先做 `Tables` 编码与字段解析，建立表名、行数、字段结构、引用关系清单。
- 再做 `StandaloneWindows64.manifest` 依赖图，按 `ui/prefab`、`ui/atlas`、`ui/textures`、`model`、`sound` 分层整理资源包。
- 对 `StreamingAssets/dll` 做只读元数据/封装识别，确认哪些是可直接读取的 .NET assembly，哪些需要通过游戏加载逻辑还原。
- 若要深入代码层，下一阶段再把 `global-metadata.dat + GameAssembly.dll` 成对导入 IL2CPP 元数据工具，先恢复类型/方法索引，不直接做补丁。
