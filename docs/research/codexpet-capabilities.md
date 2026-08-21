# CodexPet 原版能力研究（2026-08-21）

> 调研对象：OpenAI Codex / ChatGPT 桌面端「宠物（Pets）」功能的完整原版能力、CodexPet v2 图集格式契约、以及社区生态。
> 本研究基于四类一手来源：① 官方文档 `learn.chatgpt.com/docs/pets`；② 开源 Codex CLI 源码 `openai/codex` 的 `codex-rs/tui/src/pets/` 模块；③ 官方 `openai/skills` 仓库的 `hatch-pet` skill；④ 社区参考实现 `noir-hedgehog/PetViewer` 源码逐行解剖。所有关键结论均附出处；查不到证据的条目明确标注「未找到证据」。
> 本文 star 数均为 2026-08-21 GitHub API 实测值。

## 一、格式与 manifest 契约

### 1.1 包结构

一个 CodexPet = 一个文件夹，最少两个文件：`pet.json`（manifest）+ 精灵图集（`spritesheet.webp` 或 `.png`）。（来源：https://github.com/noir-hedgehog/PetViewer README.md:5；https://github.com/openai/skills `skills/.curated/hatch-pet/references/animation-rows.md`）

安装位置（官方 CLI 实测源码）：自定义宠物放 `$CODEX_HOME/pets/<pet-id>/pet.json`（即 `~/.codex/pets/`）；另有遗留兼容路径 `$CODEX_HOME/avatars/<id>/avatar.json`（旧「头像」格式，同样能作为宠物加载）。内置宠物则由 CLI 按需从 CDN 下载到 `$CODEX_HOME/cache/tui-pets/v1/assets/`。（来源：openai/codex `codex-rs/tui/src/pets/model.rs:185-203`、`asset_pack.rs:17-22`）

### 1.2 manifest 字段全集

**五个规范字段**（官方 hatch-pet skill 打包命令原样产出，与 PetViewer 全部 6 个内置宠物、与我们仓库 `.dsh-plugin/assets/pet.json` 完全一致）：

```json
{
  "id": "manqu",
  "displayName": "Manqu",
  "description": "…",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```
（来源：openai/skills `hatch-pet/SKILL.md` 内 `jq -n … '{id:…, displayName:…, description:…, spritesheetPath:"spritesheet.webp"}'` 打包行；noir-hedgehog/PetViewer `assets/*/pet.json` ×6 实测）

**字段逐个说明与容错别名**：

| 字段 | 必填 | 说明 | 出处 |
| --- | --- | --- | --- |
| `id` | 否 | 宠物 id；缺省时回退目录名/slugify | PetViewer app.js:801；CLI model.rs:244-261 |
| `displayName` | 否 | 显示名；PetViewer 另接受别名 `name` | PetViewer app.js:811 |
| `description` | 否 | 描述文本，查看器详情页展示 | PetViewer app.js:812 |
| `spriteVersionNumber` | 否 | `1` 或 `2`；缺省时按图集行数推断（≥11 行→2，否则 1）。**注意：开源 CLI 完全忽略此字段**（serde 宽容未知键），它是桌面端/生态侧字段 | PetViewer app.js:800；CLI model.rs:115-128 无此字段 |
| `spritesheetPath` | 否 | 图集相对路径，默认 `"spritesheet.webp"`；PetViewer 另接受别名 `spritesheet`；只允许目录内相对子路径（禁止绝对路径与 `..` 穿越） | PetViewer app.js:743,781；CLI model.rs:296-312 |

**仅开源 CLI 支持的可选扩展字段**（桌面端是否支持未找到证据）：

| 字段 | 类型 | 说明 | 出处 |
| --- | --- | --- | --- |
| `frame` | `{width,height,columns,rows}` | 自定义帧网格。默认 `192×208, 8列×9行`；网格必须恰好铺满整张图集，总帧数 ≤256 | CLI model.rs:130-147,327-359（测试含 `384×104,4×18` 合法用例 :789-802） |
| `animations` | `Map<名称,{frames:[帧序号], fps, loop, fallback}>` | 自定义动画轨道：`frames` 为精灵索引数组；`fps` 默认 8、上限 60；`loop` 默认 true；`fallback` 默认 `"idle"` 且必须指向已存在的轨道 | CLI model.rs:153-162,388-452 |

音效、速度、缩放、喂食等字段：**全部格式的 manifest 中均不存在，未找到证据**。（来源：上述三处一手来源全量字段核对）

### 1.3 v1 与 v2

| 版本 | 图集 | 尺寸 | `spriteVersionNumber` | 能力 |
| --- | --- | --- | --- | --- |
| v1 | 8 列 × 9 行 | 1536×1872 | 省略或 `1` | 9 条标准动画行 |
| v2 | 8 列 × 11 行 | 1536×2288 | `2` | 标准动画 + 第 9/10 行共 16 个顺时针视线朝向（000°–337.5°，步进 22.5°，000°=上） |

（来源：noir-hedgehog/PetViewer README.md:39-41；legeling/awesome-codex-pet README「Pet Versions」表——社区最明确的版本定义文档）

版本考证结论：
- **v1 是原始格式**：官方 ChatGPT 网页端「上传自定义宠物」至今仍要求「透明 PNG/WebP、恰好 1536×1872、≤20 MiB」——即网页端只收 v1。（来源：https://learn.chatgpt.com/docs/pets Upload a custom pet 节）
- **开源 CLI 也只认 v1 几何**：`validate_app_spritesheet_dimensions` 硬校验图集必须恰为 1536×1872，v2 的 11 行图集会被 CLI 拒绝。（来源：CLI catalog.rs:10-15 + model.rs:314-325）
- **v2 是桌面端浮动宠物的扩展**：新增两行视线朝向，供鼠标跟随 look 使用；官方「Settings → Pets → Update」提供 AI 辅助 v1→v2 升级（保留 9 动画行、生成 16 朝向、写出 11 行图集并标记 `spriteVersionNumber: 2`）。（来源：awesome-codex-pet README「Upgrade an Existing v1 Pet」节；PetViewer app.js:254-255 look-a/look-b `v2:true`）
- 官方 hatch-pet skill 至今生成的是 **8×9（v1 几何）** 图集：「The Codex app reads one fixed atlas: 8 columns, 9 rows」「Final atlas is PNG or WebP, 1536x1872」。（来源：openai/skills hatch-pet references/animation-rows.md 与 SKILL.md:531）
- CLI 下载的内置宠物资产文件名带 `-v4` 后缀（如 `dewey-spritesheet-v4.webp`），这是**资产修订号**而非格式版本号；更新内置宠物 = 发布新文件名而非原地改写。（来源：CLI catalog.rs:25-74、asset_pack.rs 注释）
- v1→v2 的确切演进时间线：**未找到证据**（官方 changelog 抓取范围内无相关条目）。

### 1.4 内置宠物目录与 CDN

CLI 内置 8 只宠物（目录注释明言「ported from the Codex App avatar catalog」）：`codex`（The original Codex companion）、`dewey`（鸭）、`fireball`、`rocky`、`seedy`、`stacky`、`bsod`（蓝屏小精灵）、`null-signal`。下载地址 `https://persistent.oaistatic.com/codex/pets/v1/<id>-spritesheet-v4.webp`，单文件上限 4 MiB、超时 60s、staging 原子安装、下载后重新校验几何。（来源：CLI catalog.rs:25-74、asset_pack.rs:17-22,44-100）

### 1.5 格式是官方公开还是社区逆向？

**介于两者之间**：官方从未发布过「CodexPet 格式规范」文档；但①格式核心逻辑随开源 CLI 全量公开（manifest 解析、动画默认表、几何校验都是 Rust 源码）；②官方维护的 `openai/skills` 仓库公开了 hatch-pet skill 及其 `animation-rows.md` 逐行帧数表——这就是事实上的官方格式文档；③官方 Pets 文档页只讲 UX 不讲格式内部。社区画廊（petdex、awesome-codex-pet）则把契约进一步成文化。（来源：本节所引各处）

## 二、原版完整状态表与帧时长

### 2.1 官方逐行状态表（9 行标准动画）

下表为官方 hatch-pet skill 的 `references/animation-rows.md` 原文数据，与 PetViewer `STATES` 表（app.js:190-256）及 CLI `default_animations()`（model.rs:484-582）三方交叉一致：

| 行 | 状态 id | 帧数 | 逐帧时长 (ms) | 官方语义 |
| --- | --- | --- | --- | --- |
| 0 | `idle` | 6 | 280, 110, 110, 140, 140, 320 | 平静呼吸/眨眼循环；reduced-motion 时定格首帧 |
| 1 | `running-right` | 8 | 120×7, 220 | 向右移动，8 帧须有方向感 |
| 2 | `running-left` | 8 | 120×7, 220 | 向左移动；可由 running-right 镜像派生（须保持帧序与时序语义） |
| 3 | `waving` | 4 | 140×3, 280 | 打招呼/引起注意：起手-举起-收回 |
| 4 | `jumping` | 5 | 140×4, 280 | 预备-起跳-顶点-下落-落地 |
| 5 | `failed` | 8 | 140×7, 240 | 出错/沮丧反应，可读但不吵闹 |
| 6 | `waiting` | 6 | 150×5, 260 | **等待用户输入**（审批/求助/等决定的期待姿势） |
| 7 | `running`（查看器标签 Working/工作中） | 6 | 120×5, 220 | **任务工作中**：专注思考/扫描/打字——不是跑步！禁止迈步/跑步机动作 |
| 8 | `review` | 6 | 150×5, 280 | 专注检查/审阅循环 |

每行用完的列之后剩余单元格必须完全透明。（来源：openai/skills `hatch-pet/references/animation-rows.md` 全文）

### 2.2 v2 视线行（第 9/10 行）

- 行 9 `look-a`：方向索引 0–7（000°/022.5°/045°/067.5°/090°/112.5°/135°/157.5°），行 10 `look-b`：索引 8–15（180°–337.5°）。每行 8 帧，无专属时长表（PetViewer 回落默认 140ms）。（来源：PetViewer app.js:254-255,270-287）
- 方向索引公式：`directionIndex = round(normalize(atan2(dy,dx)·180/π + 90) / 22.5) % 16`（0°=正上，顺时针）；索引 <8 → look-a，否则 look-b；帧号 = 索引 % 8；鼠标距中心 <42px 视为 Neutral（idle 第 0 帧）。反查公式：`directionIndex = (row−9)×8 + frame`。（来源：PetViewer app.js:1094-1119,1205,1227）

### 2.3 播放行为细节（CLI 权威实现）

- **一次性状态的收尾结构**：waiting/jumping/failed 等 one-shot 状态在 CLI 中被组装为「主帧序列 ×3 → 接 idle 循环」，`loop_start` 指向 idle 段起点，`fallback` 为 `"idle"`——即动作播放三遍后沉入待机。（来源：CLI model.rs:598-627 及测试 :691-708）
- **CLI 待机是慢速「calm loop」**：CLI 默认 idle 时长为 `[1680, 660, 660, 840, 840, 1920]ms`，与官方 skill/PetViewer 的快版 `[280,110,110,140,140,320]` 不同——同一张图，终端渲染刻意放慢。（来源：CLI model.rs:584-596 及测试名 `app_idle_animation_uses_calm_loop`）
- **空帧检测**：PetViewer `detectPopulatedFrames` 把图集画到 canvas 后每 4px 采样一次 alpha>8 判定有像素；检测失败（如跨域污染）则回落到各状态标准帧数。（来源：PetViewer app.js:826-862,1189-1195）
- reduced-motion（`animations_enabled=false`）时定格动画首帧且不再调度后续帧。（来源：CLI ambient.rs:303-316,519-527）

## 三、原版交互行为全集

### 3.1 ChatGPT/Codex 桌面端浮动宠物（官方文档记载）

- 浮动于其他窗口之上；`/pet` 命令或命令菜单 **Wake Pet / Tuck Away Pet** 唤起/收起；选择与**屏幕位置跨重启持久化**（隐含支持拖动移位）。（来源：https://learn.chatgpt.com/docs/pets Use a floating pet 节）
- **单击宠物 → 返回 ChatGPT** 或打开对应会话；多会话活动时有独立 activity tray（活动托盘）可选会话。（同上 Understand pet status 节）
- **状态优先级**：多个会话同时有活动时，按 Needs input > Blocked > Ready > Running 展示最高优先级。（同上）
- macOS 上 Computer Use 画中画窗口可吸附到醒着的宠物上，移动宠物窗口跟随（Follow Computer Use）。（同上）
- 尊重系统 reduced-motion 设置：开启后用静帧替代精灵动画。（同上 Reduce animation 节）
- 自定义宠物创建：Settings > Pets → Create your own pet → 自动安装内置 `hatch-pet` skill 并新开会话描述需求 → Refresh 后入选。（同上 Create a custom pet 节）
- 拖动蠕动的旁证：满区 pet.json 的官方打包描述即写明「待机眨眼，拖动时一拱一拱地蠕动」——说明原版桌面端存在拖拽行为且打包者按原版行为写了文案。（来源：PetViewer `assets/manqu/pet.json` description 字段）

**官方文档未记载、也未找到可靠证据的原版行为**：双击动作、右键菜单、悬停反应、音效、喂食/养成、统计面板、自主随机散步、多屏特殊处理。这些要么是第三方查看器自行加的（见 §3.3），要么不存在。「随机散步」在 PetViewer、CLI ambient 渲染（固定锚定 composer 上方右侧）中均无对应实现——我们插件的空闲散步属于自创行为，非原版复刻。

### 3.2 Codex CLI 终端宠物（开源源码权威）

- 命令面：`/pets` 或 `/pet` 开选择器；`/pets <name>` 直选；`/pets off` 关闭（off/disable/hide/hidden/none 同义）。配置持久化在 config.toml `[tui] pet = "<id>"`，另有 `pet_anchor = "composer"（默认）|"screen-bottom"` 锚位设置。（来源：官方 pets 文档 Choose a terminal pet 节；CLI picker.rs:92、config/src/types.rs:657、core/src/config/mod.rs:4235-4237）
- 渲染：锚定输入框上方右对齐，目标高 75px，占位 1–2 行通知气泡；文本换行宽度自动为宠物让位；模态/弹窗打开时隐藏；渲染出错自动当次会话禁用。（来源：CLI ambient.rs:37-44,214-249；chatwidget/pets.rs:84-111；app/pets.rs:22-45）
- **通知语义映射**（标签与桌面端词汇一致，测试名即 `notification_labels_match_codex_app_vocabulary`）：
  - 任务开始 → `running`（Running）
  - 各类审批请求（exec/patch/网络等 8 处触发点）→ `waiting`（Needs input）
  - 任务完成 → `review`（Ready），气泡正文取 agent 最后消息预览
  - 出错结束回合 → `failed`（Blocked)
  （来源：CLI chatwidget/turn_runtime.rs:99,193,369；chatwidget/tool_requests.rs:289-440；pets/ambient.rs:46-90）
- **通知寿命**：Running 3 分钟、Failed 1 小时、Waiting 24 小时、Review 7 天，过期自动回落 idle。（来源：CLI ambient.rs:41-44,108-111）
- 终端兼容：需 iTerm2 3.6+ / Kitty 图形协议 / Sixel；tmux 与 Zellij 内不可用；协议探测失败给出明确提示。（来源：官方文档；CLI image_protocol.rs:56-159）
- 选择器预览用 idle 首帧静态图，不播动画。（来源：CLI ambient.rs:251-275）
- 帧缓存：`$CODEX_HOME/cache/tui-pets/frame-cache/<pet.id>/<sha256>-WxH-CxR/frames/`，按图集内容哈希失效。（来源：CLI model.rs:102-110、ambient.rs:157-165）

### 3.3 第三方桌面查看器补全的交互（非原版，仅供对照）

- bsvgu/codex-pets-viewer（Windows 便携版）：左键拖动移位、双击执行可配置动作（打开浏览器 URL / 启动应用 / 无）、右键菜单、滚轮或 +/- 缩放、Esc 退出。（来源：https://github.com/bsvgu/codex-pets-viewer README）
- MingfengHong/petpack 打包的独立桌宠：70%–140% 缩放、底部拖动、悬停工具栏、托盘尺寸菜单。（来源：https://github.com/MingfengHong/petpack README v0.3.1 更新节）

## 四、查看器能力（设置/窗口/系统级）

以 PetViewer（我们的契约基准）为准的完整能力清单：

- **导入**：pet.json URL 直连（`spritesheetPath` 相对该 URL 解析）、本地文件夹选择、散装 .json/.webp/.png 拖拽导入、`?pet=<url>` / `?petJson=<url>` 深链接远程加载（CORS 失败自动降级无 CORS 重试图像）。（来源：PetViewer app.js:548-588,719-750,1237-1253；README.md:27-33）
- **宠物库**：多宠物共存，按 petId 去重替换；6 个内置预设（Noir/Manqu/Miki/Yua/灰泽满×弥希双人/弥希×灰泽满 CP）。（来源：app.js:328-395,864-866）
- **手动触发**：9 个动作按钮 + 数字键 1–9 快捷键（不含 look 行）。（来源：app.js:258-268,653-666,900-916）
- **播放控制**：播放/暂停、速度 0.5–2×（步进 0.25，默认 1×，除法作用于帧时长）、状态下拉、帧条点击步进（暂停）、图集检查器点格跳转。（来源：index.html:169,200；app.js:597-620,1013-1042）
- **视图**：缩放 1–3×（步进 0.25，默认 2×）、棋盘格背景开关、中英双语界面（localStorage 持久化）。（来源：app.js:473-495,609-620）
- **校验**：宽度必须 8×192、高度按版本期望 9/11 行、空帧剔除成功与否三项状态灯。（来源：app.js:989-1011）
- **鼠标视线预览**：仅 v2 且 ≥11 行启用；进入预览区暂停播放并记忆现场，离开恢复。（来源：app.js:622-651）
- **明确没有的**：透明度调节、置顶、开机自启、多屏管理——PetViewer 是零构建静态网页，不存在窗口/系统级能力；官方桌面端的设置面也只有选宠物 + Wake/Tuck，未见缩放/透明度设置项。（来源：PetViewer 仓库全量文件核对；https://learn.chatgpt.com/docs/reference/settings#Pets 节）

## 五、CodexPet 生态盘点（现成轮子清单）

> 用户铁律：先盘现成轮子。以下为 2026-08-21 GitHub API 实测的 CodexPet 格式相关项目全景（star 为当日值）。

### 5.1 画廊 / 分发平台

| 项目 | ★ | 一句话 | 链接 |
| --- | --- | --- | --- |
| crafter-station/petdex | 3945 | 最大生态：web 画廊 petdex.dev + `npx petdex install` CLI + 三平台原生浮动桌宠 app（Zig hook server :7777，响应 coding agent 活动）；HTTP API `/api/manifest` 返回全部过审宠物 | https://github.com/crafter-station/petdex |
| legeling/awesome-codex-pet | 738 | codexpet.top 背后目录：202 只宠物、11 分类、一键安装脚本（装到 `~/.codex/pets/`）、SHA256 校验、v1/v2 版本表最权威的社区成文规范 | https://github.com/legeling/awesome-codex-pet |
| YaKun9/codex-pets | 25 | 中文画廊站（14+ 只全 v2 宠物），一键复制 AI 安装提示词 | https://github.com/YaKun9/codex-pets |
| portons/codex-pet-share | 119 | 宠物分享（TypeScript） | https://github.com/portons/codex-pet-share |
| CHELSEADOPAMIN/CodexPetss | 24 | 宠物合集 | https://github.com/CHELSEADOPAMIN/CodexPetss |

### 5.2 查看器 / 独立运行时

| 项目 | ★ | 一句话 | 链接 |
| --- | --- | --- | --- |
| noir-hedgehog/PetViewer | 14 | 我们的图集契约基准；在线预览器 + 6 内置宠物（含 Manqu） | https://github.com/noir-hedgehog/PetViewer |
| bsvgu/codex-pets-viewer | 0 | Windows 便携桌宠查看器（拖动/双击动作/右键菜单/滚轮缩放） | https://github.com/bsvgu/codex-pets-viewer |
| MingfengHong/petpack | 63 | Tauri 2：把 Codex/Petdex 宠物包打成不依赖 Codex 的 Win/macOS/Linux 独立桌宠 | https://github.com/MingfengHong/petpack |
| RyanNiu/codexpet-nest | 14 | CodexPet 桌面伴侣 app（TypeScript） | https://github.com/RyanNiu/codexpet-nest |
| fangbm/CodexPetDesk | 6 | 桌面端实现 | https://github.com/fangbm/CodexPetDesk |
| mergisi/codex-pet-gen | 0 | 无 image_gen 的参数化 CLI 造宠+预览+安装 | https://github.com/mergisi/codex-pet-gen |

### 5.3 跨 agent 桌宠（含 Claude Code / DSH！）

| 项目 | ★ | 一句话 | 链接 |
| --- | --- | --- | --- |
| rullerzhou-afk/clawd-on-desk | 5993 | 像素螃蟹桌宠，实时响应 20+ coding agent（Claude Code/Codex/Cursor/opencode/**DeepSeek Harness 实验性插件集成**…）；12 种动画状态、权限气泡、可导入 Codex Pet zip 当主题 | https://github.com/rullerzhou-afk/clawd-on-desk |
| alterhq/openpets | 91 | macOS 原生共享桌宠：菜单栏 app + MCP server + CLI，多工具共用一只宠物，支持安装 8×9 Codex Pets，带用量环插件 | https://github.com/alterhq/openpets |
| bleeeet/TermiPet | 85 | macOS 终端/Claude Code 伴侣桌宠，状态卡 | https://github.com/bleeeet/TermiPet |
| sjyinzju/Galcode_island | 43 | 把 Claude Code/OpenCode/Codex 放进同一套桌宠式界面的本地工作台 | https://github.com/sjyinzju/Galcode_island |

### 5.4 配件

| 项目 | ★ | 一句话 | 链接 |
| --- | --- | --- | --- |
| petergpt/codex-pet-limit-rings | 85 | macOS：围绕宠物窗口画 5h/周用量双环，跟随宠物移动（监听 Codex 本地 global-state 文件感知宠物位置） | https://github.com/petergpt/codex-pet-limit-rings |
| MRKMKR/codex-pet-limits-viewer | 2 | 悬停宠物显示用量 | https://github.com/MRKMKR/codex-pet-limits-viewer |
| IceSaury/CodexPetdexSkins | 7 | Petdex 宠物皮肤 | https://github.com/IceSaury/CodexPetdexSkins |

### 5.5 宠物包（部分）

HanaAyane/remielle-codex-pet（★317，小蕾米 v2 资源包）、cuNuo/aemeath-mini-codex-pet（★169）、sherlidian01-web/phoebe-codex-pet（★70）/Phrolova-codex-pet（★37，鸣潮同人）、gmskywalker/deepseek-fat-fish-codex-pet（★33，DeepSeek 大肥鱼）、wasabihhh/kunkun-codex-pet（★5）、LiOH-1228/codexpet-daimao-felyne（★12）、Kurumi-Tao/codexpet-Aemeathyoung（★8）、Ruiwang66/codexpetFirefly（★5）、sarrithomas/lyh-codex-pet（★2）、it0615/codexPets（★0）等。（来源：GitHub API search「codex pet」「codexpet」「codex 桌宠」2026-08-21）

### 5.6 造宠 skill（hatch-pet 系）

| 项目 | ★ | 一句话 | 链接 |
| --- | --- | --- | --- |
| openai/skills `.curated/hatch-pet` | 官方 | 官方造宠 skill：$imagegen 生成 + 确定性脚本拼装/QA/打包，产出 8×9 图集 + 5 字段 pet.json | https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet |
| DwDestiny/codex-visual-asset-skills | 59 | 透明素材与精灵图集系列 skill | https://github.com/DwDestiny/codex-visual-asset-skills |
| AstrariaX/Ark-codex-skill | 11 | 自动生成明日方舟干员桌宠的 skill | https://github.com/AstrariaX/Ark-codex-skill |
| leduy-it/hatch-pet-plus | 13 | 双宿主（Codex+Claude Code）增强版 hatch-pet；记录了非官方 `stages` 多形态扩展（pet.json 里声明 stages 数组，不识别的宿主回落 spritesheetPath） | https://github.com/leduy-it/hatch-pet-plus |
| srwang0506/HatchPet-CapybaraLulu / DongmingShenDS/hatch-real-pet-skill / sehjk/hatch-fighter-pet / tpmoonchefryan/joi-channel-codex-hatch-pet | 19/8/9/9 | 各类 hatch-pet 产物与变体 | 同 GitHub |

## 六、官方 Codex app 桌宠功能考证

- **功能定位**：Pets 是「跟随工作的可选动画伙伴」，改变外观不影响任务执行；覆盖四个界面：ChatGPT 桌面 app（浮动 overlay+活动托盘）、ChatGPT 网页（Work 会话内嵌，无浮动层）、Codex CLI（终端图像协议渲染）、Codex IDE 扩展（**不支持**）。（来源：https://learn.chatgpt.com/docs/pets 全文）
- **与 agent 状态联动细节**（官方四态 + 优先级 + 托盘）：见 §3.1/§3.2。我们已移植的 waiting/jumping/failed 映射与官方语义对齐；官方还有第四态 Ready（完成未读，对应 review 行）——我们用 jumping 表达完成庆祝属合理增强，但「Ready=有未读活动」这个语义我们没有。
- **我们没有的原版能力清单**：
  1. **多会话活动托盘 + 状态优先级仲裁**（Needs input > Blocked > Ready > Running）；
  2. **Ready 态**（完成但有未读，区别于纯完成庆祝）；
  3. **通知气泡正文**（CLI 用 agent 最后一条消息做气泡内容，且有 3min/1h/24h/7天 四档寿命过期回落）；
  4. **位置持久化**（重启恢复宠物位置——我们已有 localStorage，等价）；
  5. **reduced-motion 尊重系统设置**（我们未实现，可用 `prefers-reduced-motion` 媒体查询一行接入）;
  6. **macOS PiP 吸附跟随**（DSH web 场景不适用，仅记录）；
  7. **官方 hatch-pet 式造宠流水线**（skill 驱动 AI 造宠 + QA contact sheet + 校验脚本）；
  8. **v1→v2 升级流**（Settings 内 AI 辅助补 16 朝向）。
- **音效/喂食/多宠物同屏/统计**：官方文档、CLI 源码、changelog 中均无痕迹——**未找到证据**，应视为原版没有。
- **格式公开性**：UX 层官方公开；格式层经开源 CLI + 官方 skill 事实上公开；无正式规范文档。
- **上线时间**：官方 changelog 抓取范围内最早相关条目为 Codex app 26.608（2026-06-09，「Settings 搜索扩展到 Git 和 pets 面板」）与 CLI 0.147.0/0.149.0（pet 资产下载走共享 HTTP client、测试精灵图编码缓存）；确切首发版本**未找到证据**。（来源：https://developers.openai.com/codex/changelog 页面抓取）

## 七、资料可信度与缺口

**Tier A（官方一手，可直接引用）**
- https://learn.chatgpt.com/docs/pets （官方 Pets 文档，`.md` 后缀可取 Markdown 原文）
- openai/codex `codex-rs/tui/src/pets/`（model/ambient/catalog/asset_pack/image_protocol/picker 等 12 文件，本次 sparse clone 至 /tmp 实读）
- openai/skills `skills/.curated/hatch-pet/`（SKILL.md + references/animation-rows.md）
- https://developers.openai.com/codex/changelog 、`/codex/settings`

**Tier B（社区一手源码/成文规范，经交叉验证）**
- noir-hedgehog/PetViewer app.js（1283 行全量实读；其 STATES 表/时长/directionFor/detectPopulatedFrames 与官方 skill 及 CLI 源码三方一致）
- legeling/awesome-codex-pet README 版本表与升级流程
- crafter-station/petdex README 格式节

**Tier C（单源、未交叉验证，引用需谨慎）**
- 各生态项目自述（star 数、功能描述均为各自 README 口径）
- hatch-pet-plus 的 `stages` 扩展（自述为非官方约定，官方源码不识别）

**缺口清单（诚实声明）**
1. ChatGPT 桌面 app 闭源，浮动宠物的精确交互集（是否有 hover 反应、右键菜单、双击）无官方记载——本文只收录官方文档明文行为；
2. 桌面端是否解析 CLI 的 `frame`/`animations` 扩展字段：未找到证据（CLI 支持、桌面端未知）；
3. Pets 功能首发日期与 v1→v2 演进时间线：未找到证据；
4. web 端上传只收 v1 而桌面端流通 v2 的原因与时间线：未找到证据；
5. 「随机散步」在任何一手来源中均无原型，属我们插件的原创行为，不应在文档中表述为「原版能力」。

## 八、差距对照：原版能力 × dsh-manqu-pet 现状

现状盘点基于本仓库 `.dsh-plugin/client/index.mjs`（506 行）、`client/atlas.mjs`、`src/state.mjs` 实读（2026-08-21，main=`506bfd5`）。

| # | 原版能力（出处见 §2/§3/§6） | 我们现状 | 判定 |
| --- | --- | --- | --- |
| 1 | 四态语义 Running / Needs input / Ready / Blocked | running / waiting / jumping(增强) / failed；**Ready 缺失**——图集第 8 行 `review` 已注册却无任何行为使用 | **缺口，且素材零成本** |
| 2 | 状态优先级仲裁 Needs input > Blocked > Ready > Running | failed > jumping > waiting > running > idle；单会话内合理，但缺 Ready 位，且官方把 waiting 排在 blocked 之前（跨会话仲裁口径） | 部分差距 |
| 3 | 多会话活动托盘（activity tray，点击选会话） | 无——`/manqu/state` 已聚合多任务 titles，但 UI 只展示第一条 | **缺口** |
| 4 | 通知气泡正文（agent 最后消息预览）+ 四档寿命回落（3min/1h/24h/7天） | hover 状态条显示任务标题；celebrate 4s / failed 5s 已有寿命；waiting 无过期（web 场景可接受）；无消息正文气泡 | 部分差距 |
| 5 | reduced-motion：定格首帧替代动画 | 部分：0.5× 减速 + 停散步，动画仍在播 | 小差距，一行可对齐 |
| 6 | 单击宠物 → 返回对应会话 | 单击 = 挥手 | 设计取舍（见 §9-6） |
| 7 | Wake / Tuck Away + 位置持久化 | 隐藏 + 右下角恢复按钮；localStorage 存 x/y/hidden | 等价，无差距 |
| 8 | 拖动蠕动、16 方向视线跟随（v2）、待机眨眼 | 均已实现（视线仅待机触发，deadzone 36px vs 原版 42px，无实质差异） | 无差距 |
| 9 | one-shot 收尾结构：主序列 ×3 → 沉入 idle | 播 1 遍 → hold 末帧 500ms → 回基础态 | 观感差异，可选对齐 |
| 10 | CLI calm loop（idle 放慢 6 倍） | 用官方快版时长表 | 终端场景特有，不采纳 |
| 11 | `frame`/`animations` manifest 扩展字段 | 不支持 | CLI-only 且桌面端支持未证实（§7 缺口 2），观望 |
| 12 | hatch-pet 造宠流水线 / v1→v2 AI 升级流 | 无 | 独立项目范畴，不在本插件做 |
| 13 | 音效 / 喂食 / 多宠同屏 / 统计面板 | 无 | 原版也无（§6「未找到证据」），不做 |
| 14 | 随机散步 | 有（20–42s 间隔，仅贴底待机时） | **我们的原创行为**，非原版复刻（§7 缺口 5）；文档表述已纠正 |

另有四次审查遗留的自身缺陷（d1ff5b80 检查点 P3，至今未修）：onResize 只钳 x 不重钳 y、鼠标离开窗口/失焦后 look 不清除、canvas 固定 192×208 内部像素高 DPI 发糊、死代码（`wander.from`/`wanderUntil`/`lastPaint`）。

## 九、制作同样的功能：分期计划

> 原则：先对齐原版语义，再加 DSH 场景增强；每期一个 PR 量级，`bash scripts/check.sh` 全绿才 push；单测覆盖所有纯函数改动。

### 第一期：对齐原版语义（小改，收益最大）

1. **启用 Ready 态（`review` 行）**：
   - Node half：mood 增加 `readyUntil`（回合/任务完成后置位，建议 10 分钟或直至用户交互，区别于 jumping 的 4s 庆祝窗口）；
   - `pickBaseState` 优先级改为：failed > jumping > waiting > **review** > running > idle（Ready 位于 Needs input 之下、Running 之上，对齐官方仲裁序）；
   - client：用户单击宠物即视为「已读」，清除 ready；
   - 单测：`tests/` 补 pickBaseState 六态用例。
2. **reduced-motion 对齐官方**：`prefers-reduced-motion: reduce` 时定格各状态首帧（替代现在的 0.5× 减速），散步保持禁用。
3. **顺手修四个遗留缺陷**：onResize 重钳 y；`document mouseleave` + `window blur` 清 look；canvas 按 `devicePixelRatio` 放大消除高 DPI 模糊；删三处死代码。

### 第二期：DSH 场景增强（原版有对应物的功能）

4. **多会话活动托盘**：右键菜单顶部加「活动」区——每个活跃会话一行（状态点颜色 = 四态 + 标题截断），点击跳转对应会话；数据源扩展 `/manqu/state` 返回 `{sessionId, state, title}[]`（宿主 ctx.sessions/jobs 已具备，需核对会话路由跳转 API）。
5. **完成气泡正文**：任务完成时气泡显示 agent 最后消息预览（若宿主 snapshot 可得；拿不到就降级为任务标题，现有 bubble 组件直接复用）。

### 第三期：可选打磨（逐项拍板再做）

6. **单击语义取舍**：方案 A 保持挥手（情感向）；方案 B 有未读时单击=已读+挥手（对齐官方「点击回会话」精神）。倾向 B，成本相同。
7. **one-shot ×3 收尾**：waving/jumping/failed 播完 3 遍再沉底，替换 500ms hold（纯观感）。
8. **缩放设置**：官方没有，但生态查看器标配（petpack 70–140%、codex-pets-viewer 滚轮缩放）；可在右键菜单加 3 档，localStorage 记忆。

### 明确不做（有据可依）

- 音效/喂食/多宠同屏/统计面板——原版无证据（§6）；
- macOS PiP 吸附跟随——平台不适用；
- `frame`/`animations` 扩展字段——桌面端支持未证实，等上游；
- 独立桌宠 app（系统级浮动窗）——**现成轮子已饱和**：petdex（3945★，三平台原生 app + Zig hook server）、petpack（63★，Tauri 打包）、clawd-on-desk（5993★，含 DSH 实验性集成）都做了，重复造轮子无意义；若未来想要「GUI 之外的桌宠」，优先评估 clawd-on-desk 的 DSH 集成而不是自研。

### 验收口径

- 每期：`node --test tests/*.test.mjs` 全绿 + `node scripts/build-client.mjs --check` 新鲜 + `bash scripts/check.sh` 全绿；
- 第一期额外验收：真实跑一个任务到完成，观察 jumping(4s) → review(持续) → 单击后回 idle 的链路；
- 文档同步：README 行为表补 review 行，措辞遵守 §7 缺口 5（散步标注为自创行为）。
