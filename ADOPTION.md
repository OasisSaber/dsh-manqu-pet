# TheMasterplan 采用记录

来源: TheMasterplan **v4.0.0**(`8895a0082358a569012e6be1d490aa91c37a699c`)
采用范围: 最小采用集合(AGENTS.md + core/ + profiles/git.md + adapters/generic.md)+ 中央调用模式(scripts/check.sh + .github/workflows/check.yml)
采用日期: 2026-08-16
首次演练任务: 明确人类授权(用户 2026-08-16:"发布完成后采纳 /themasterplan 工作流",目标=本仓库采用 TheMasterplan,范围=规则文件+验证入口+CI 调用器)
Jujutsu 版本: 未采用(仓库使用 Git)
Git 版本: 2.54.0.windows.1
平台与验证入口: Windows / `bash scripts/check.sh` + `pwsh scripts/check.ps1`(委托同一权威命令)
验证状态: VERIFIED(2026-08-16 真实 Windows 平台烟雾测试通过:Windows PowerShell 5.1 + Git for Windows 2.54.0,`powershell -File scripts/check.ps1` 委托同一权威命令:9/9 单测通过、client bundle 新鲜(--check OK)、`git diff --check` 干净;CI 端为 Ubuntu GitHub Actions 中央工作流)
首次演练 PR: https://github.com/OasisSaber/dsh-manqu-pet/pull/1

## 采用范围明细

| 文件 | 类型 | 说明 |
|---|---|---|
| `AGENTS.md` | project-owned | 定制:项目事实/技术栈/验证入口 |
| `core/workflow.md` | managed-replace | 复制自 TheMasterplan v4.0.0 |
| `core/policy.md` | managed-replace | 复制自 TheMasterplan v4.0.0 |
| `profiles/git.md` | managed-replace | 复制自 TheMasterplan v4.0.0 |
| `adapters/generic.md` | managed-replace | 复制自 TheMasterplan v4.0.0 |
| `scripts/check.sh` | project-owned | 项目权威验证入口(单测 + bundle 新鲜度 + 工作区卫生) |
| `scripts/check.ps1` | project-owned | Windows 委托入口 |
| `.github/pull_request_template.md` | project-owned | PR 正文契约模板 |
| `.github/workflows/check.yml` | project-owned | 薄调用器 → `OasisSaber/TheMasterplan/...@v4.0.0`(policy-ref: v4.0.0) |
| `.themasterplan/state.json` | project-owned | 采用状态(受 Git 跟踪) |
