---
phase: P0
task_id: T036
task_name: detail-info-completeness
type: feature
trace_id: T036-P0-20260629
created: 2026-06-29
status: draft
---

task: 详情页信息完善 — tags 显示 + 时间展示 + 时区统一

1. 详情页加 tags 显示（标题下方）
2. 时间用相对时间 + tooltip 显示完整日期
3. 前端统一用 toLocaleDateString() 走浏览器时区（确认 EntryCard/EntryListRow/DetailView 一致）

改动域: EntryDetailView.vue（header 区域）+ 时间格式化工具函数统一

known_risks:
  - 详情页 header 空间有限，加 tags 可能需要折叠区域
  - 移动端 header 已有 actions，tags 放不下需设计折叠交互

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 方案清晰，CSS+模板改动

phase_hint: [P1, P4, P5, P6]
