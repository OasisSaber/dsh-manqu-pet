# dsh-manqu-pet Agent Workflow

> 本文件是仓库唯一入口:定义加载顺序与分域权威,不复制规则正文。
> 规则分布:
> - 任务来源、工作区检查、验证真实性、diff 审阅、自审与交接:[core/workflow.md](core/workflow.md)
> - 权限与聚合授权、外部写操作边界、人类审批门、发布事务、安全停止条件:[core/policy.md](core/policy.md)
> - Git 发布执行命令:[profiles/git.md](profiles/git.md)
> - Harness 边界:[adapters/generic.md](adapters/generic.md)
> 各层通过链接引用,不复制同一规则。

## 项目事实

- 项目名:dsh-manqu-pet
- 项目目标:维护 DeepSeek Harness 的 Codex 桌宠「满区 Manqu」DSH 插件(图集播放器 + 会话情绪联动),并随 DSH 插件生态持续演进
- 技术栈:Node.js ESM、esbuild(客户端 bundle)、CodexPet v2 图集(192×208×8列×11行)、node:test 单测
- 默认分支:`main`
- 工具基线:Git `2.34.0` 或更高版本(含 Git Bash 的 Git for Windows)
- 平台状态:`VERIFIED` 为 Ubuntu GitHub Actions 中的 Bash 入口;`PARTIAL` 为真实 Windows PowerShell 7 + Git for Windows,采用时必须执行平台烟雾测试
- 验证入口:
  ```bash
  bash scripts/check.sh
  ```
  PowerShell 等价委托入口(转发同一权威命令):
  ```powershell
  pwsh -NoProfile -File scripts/check.ps1
  ```
- 合并方式:只接受人类决定的 Squash Merge
- 版本通道:跟随插件包版本(package.json `version`),发布为 GitHub Release(tag-only,见 [profiles/git.md](profiles/git.md))
- merge、release、部署与受保护分支推进未经人类明确批准不得执行;人类一次批准完整发布事务(见 [core/policy.md](core/policy.md))后,Agent 可在已列明范围内连续执行

## 权威顺序

1. 系统安全、法律与平台权限
2. 项目安全、隐私、合规和数据保护要求
3. 受保护分支、发布、部署和破坏性操作限制(授权语义见 [core/policy.md](core/policy.md))
4. 根部 `AGENTS.md` 及其引用的 `core/` 规则
5. 当前 Issue 或明确人类授权
6. 项目架构、测试和交付资料
7. README、CONTRIBUTING、采用指南和其他辅助材料

当前 Issue 或明确人类授权只能定义任务目标、范围和验收条件,不能覆盖安全、隐私、合规、数据保护、受保护分支、发布、部署或破坏性操作限制。

## 加载顺序

开始工作前按以下顺序加载:

1. 根部 `AGENTS.md`(本文件);
2. [core/workflow.md](core/workflow.md)(任务来源、工作区、验证、自审);
3. [core/policy.md](core/policy.md)(授权与发布);
4. 执行 [core/workflow.md](core/workflow.md) §0 治理所有权预检;若为
   `ABSTAINED`,报告后停止 TheMasterplan 工作流;
5. `ACTIVE` 时再加载 [profiles/git.md](profiles/git.md)(Git 命令)
   与 [adapters/generic.md](adapters/generic.md)(薄 Harness 边界);
6. 当前 Issue 或明确人类授权。

## 任务路径

复杂任务与小型低风险任务的路径、适用范围与授权记录要求见
[core/workflow.md](core/workflow.md) §1。无 Issue 时不得伪造编号;实现需要
扩大范围时必须停止,向人类说明原因并转为 Issue 路径。

## 验证与交付

工作区检查、任务 change 卫生、权威验证、完整 diff 审阅与 Agent 自审要求见
[core/workflow.md](core/workflow.md) §2-§6。每次 push 前必须运行权威验证
入口:

```bash
bash scripts/check.sh
```

验证失败时必须修正并重跑,不得把失败或未验证状态表述为成功。fetch 后发现
`main`、`main@origin` 或任务分支冲突时必须停止,不得猜测目标、自动解决或
push。审查意见只使用三类表述:合并前必须修复、建议本次修复、可以后续处理。

## 人工批准与聚合授权

人类保留最终决定权,不表示人类必须亲自操作。Agent 不得未经批准执行
merge、release、删除远端数据、破坏性操作或扩大范围;取得人类明确批准后,
Agent 可在批准范围内连续执行,不得把可由自身工具完成的操作转交人类手工
执行。

发布采用单一最终授权门,聚合授权的定义、审核要素、失效条件、部分失败处理
与术语对照见 [core/policy.md](core/policy.md);Git 下的安全执行方式见
[profiles/git.md](profiles/git.md)。

Agent 不得把允许 push 或创建 Pull Request 解释为允许 merge 或 release。

## 安全与卫生

- 不提交密钥、访问令牌或明显的私人数据。
- 不提交本机绝对路径、缓存、临时文件或无关生成物。
- `main` 只接受经 Pull Request 的人类决定 Squash Merge。
- 发现当前操作违反已记录规则、权限或范围时,必须在产生外部影响前停止并请求人类修正或明确授权。
