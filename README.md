# dsh-manqu-pet

**满区 Manqu** —— 灰泽满（Hazel Man）的 CodexPet 粉丝宠物，原版移植到 DSH Web GUI。

![manqu](.dsh-plugin/assets/favicon.png)

## 这是什么

把 Codex 桌面客户端里的宠物格式（**CodexPet v2**：`pet.json` + 单张 spritesheet 图集，192×208 单元格 × 8 列 × 11 行）完整搬进 DSH：**待机眨眼、拖动时一拱一拱地蠕动、鼠标靠近时视线跟随（16 方向）**，并接入 DSH 会话/任务情绪：

| 你做什么 / 发生什么 | 满区的表现 |
|---|---|
| 常态 | 待机（`idle`，随机眨眼） |
| 任一会话思考 / 任务运行中 | 工作（`running`） |
| 等待批准 | 期待等待（`waiting`） |
| 回合 / 任务完成 | 跳跃庆祝（`jumping`） |
| 任务失败 | 失落（`failed`） |
| 鼠标靠近（仅待机时） | 视线跟随（`look-a`/`look-b`，16 方向） |
| 点击 / 右键菜单打招呼 | 挥手（`waving`） |
| 双击 / 菜单跳一下 | 跳跃（`jumping`） |
| 拖拽 | 一拱一拱地蠕动（`running-left`/`running-right` 快放） |
| 空闲 | 随机散步（左右蠕动横移） |

## 安装

官方 **bundle 插件** 格式（`dsh.bundle` + `dsh.client`），经官方 profile 管理：

```sh
# 方式一：GitHub 安装
dsh plugin --profile web add "github:OasisSaber/dsh-manqu-pet"

# 方式二：本地开发安装
dsh plugin --profile web add "<仓库绝对路径>"
```

装完**重启 web**（bundle 层在启动时合成），右下角出现满区：点击打招呼、双击跳跃、拖拽移动（拖动时蠕动）、鼠标靠近视线跟随、右键菜单（打招呼/跳一下/隐藏）。位置与隐藏状态保存在 localStorage（`dsh-manqu-pet:*`）。

## 开发

```sh
npm i -D esbuild   # 首次
node scripts/build-client.mjs        # 生成 .dsh-plugin/client.js
node scripts/build-client.mjs --check  # 校验生成物新鲜（手改生成物禁止）
node --test tests/*.test.mjs          # 纯逻辑单测
```

- 改客户端逻辑 → 改 `.dsh-plugin/client/index.mjs` / `atlas.mjs`，重新 build。
- 路由前缀单一来源：`.dsh-plugin/src/routes.mjs`。
- 素材契约：`pet.json`（CodexPet manifest）+ `spritesheet.webp`（1536×2288，v2 图集）。

## 结构

```
.dsh-plugin/
  index.mjs          # Node half：/manqu/state 情绪聚合 + /manqu/assets + /manqu/events(SSE)
  client.js          # client bundle（esbuild 产物，勿手改）
  client/
    index.mjs        # 浏览器 half：图集播放器 + 交互
    atlas.mjs        # CodexPet v2 图集纯逻辑（状态表/帧检测/方向）
  src/
    routes.mjs       # 路由前缀单一来源
    state.mjs        # 情绪 → 基础状态纯函数（5 态；look/挥手/蠕动/散步由 client 本地覆盖）
    session-events.mjs  # turn 边沿解析
    assets.mjs       # assets 路径净化 + MIME
  assets/
    pet.json         # CodexPet manifest（满区）
    spritesheet.webp # v2 图集（1536×2288）
cordis.patch.yml     # bundle 挂载补丁
```

## 致谢

- 角色：**灰泽满**（Bilibili UP 主）的粉丝宠物 **Manqu**（满区）
- 格式：CodexPet v2（OpenAI Codex 桌面宠物格式）
- DSH bundle 插件范本：[vlln/whale-girl](https://github.com/vlln/whale-girl)

Manqu 相关图像与 manifest 素材的来源记录见 [`ASSET-NOTICE.md`](./ASSET-NOTICE.md)。
本仓库的 atlas 播放逻辑是独立实现，不把 PetViewer 的具体代码作为本项目代码来源。

## License

- **源代码**：MIT（见 [`LICENSE`](./LICENSE)）。该许可仅适用于本项目自行编写的源代码。
- **Manqu 素材**：第三方/粉丝向素材，不自动包含在 MIT 许可中；请先阅读
  [`ASSET-NOTICE.md`](./ASSET-NOTICE.md)。
- 本项目与灰泽满、相关创作者或 OpenAI 不构成官方关联、授权背书或赞助关系。
