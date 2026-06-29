---
phase: P0
task_id: T038
task_name: csharp-highlight-description-api
type: fix/feature
trace_id: T038-P0-20260629
created: 2026-06-29
status: draft
---

task: C# 语法高亮修复 + Entry description API 字段暴露

1. C# 语法高亮修复：Shiki 语言别名问题导致 C# 文件无高亮（可能需要注册 csharp → cs 别名或检查 Shiki 版本支持的语言 ID）
2. Entry description API 字段暴露：后端 list API 返回 description 字段，前端卡片可显示描述

改动域: 后端 models.py/schemas(加 description 字段) + 前端 Shiki 配置 + EntryCard

known_risks:
  - Shiki 语言别名修改可能影响其他语言的注册
  - API 响应加字段是破坏性变更的边界情况（新增字段通常是兼容的）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 2 项小修，方案清晰

phase_hint: [P1, P4, P5, P6]
