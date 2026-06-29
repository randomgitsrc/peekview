---
phase: P0
task_id: T030
task_name: frontend-interaction-enhancements
type: feature
trace_id: T030-P0-20260629
created: 2026-06-29
status: draft
---

task: 前端交互增强 — 2 个独立增强项：代码行交替色(zebra stripe) + 移动端底部按钮溢出折叠(overflow menu)

known_risks:
  - zebra stripe 在 dark/light 两套主题下都需要配色调整，不能太刺眼
  - overflow menu 组件需要设计交互模式（dropdown vs popover vs slide-up），影响移动端体验
  - zebra stripe 对 HTML render iframe 内的代码块不生效（iframe 有独立样式）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 2 个增强项涉及新组件设计 + CSS 变量体系扩展，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
