---
phase: P0
task_id: T029
task_name: frontend-ux-improvements
type: feature
trace_id: T029-P0-20260629
created: 2026-06-29
status: draft
---

task: 前端体验改进 — 3 个独立改进项：HTML 多文件引用提示、C# 语法高亮修复、Entry description API 字段暴露

known_risks:
  - Shiki 语言别名修改可能影响其他语言的注册
  - sibling 注入限制是架构决策，提示改进不能突破安全边界
  - API 响应加字段是破坏性变更的边界情况（新增字段通常是兼容的，但需确认前端不依赖字段顺序）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 3 个改进项涉及后端 API + 前端渲染 + Shiki 配置，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
