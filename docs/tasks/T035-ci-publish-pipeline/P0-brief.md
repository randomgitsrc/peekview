---
phase: P0
task_id: T035
task_name: ci-publish-pipeline
type: infra
trace_id: T035-P0-20260629
created: 2026-06-29
status: draft
---

task: 发布通道统一到 CI — 消除双通道发布风险

来源: improvement-backlog #6

问题: peekview 和 peekview-mcp 均存在"本地 make publish + push tag 触发 CI publish"的双通道发布。两者都会上传到 PyPI/npm，第二个到的会因版本号冲突而失败。本地 token 安全性也不如 CI 的 OIDC Trusted Publishing。

方案方向:
- 本地 make publish 改为纯验证（lint + test + typecheck + build，不上传）
- 本地 make publish-npm 同理
- 发布流程标准化为：bump-version → 填 CHANGELOG → commit → push tag → 等 CI 绿
- PyPI 用 OIDC Trusted Publishing（CI 已配置），npm 用 secrets.NPM_TOKEN（CI 已配置）

known_risks:
  - CI 发布失败时无本地回退路径（需调试 CI 配置）
  - 需确认 CI workflow 已正确配置 Trusted Publishing

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: 不适用（CI 流程改动）

pruning_tendency: 可裁剪 — 方案明确，纯流程改动

phase_hint: [P1, P4, P5]
