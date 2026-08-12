---
phase: P0
task_id: T029
task_name: card-list-layout-polish
type: feature
trace_id: T029-P0-20260629
created: 2026-06-29
status: draft
---

task: 卡片/列表布局打磨 — 3 项

1. 卡片 Tag 数量限制 + 折叠：限制显示 2-3 个 tag，超出折叠为 +N，控制卡片最高高度
2. 卡片/列表 meta 信息位置调整：meta（@user · 日期 · file数）放在 title 下方，布局顺序 title → meta → tags(限数折叠) → badge
3. 详情页标题 2 行显示：标题从 1 行截断改为 2 行（line-clamp: 2），header 高度从固定 56px 改为 min-height 自适应

改动域: EntryCard.vue + EntryListRow.vue + layout.css

known_risks:
  - Tag 折叠交互需设计 +N 的 tooltip/popover 展开方式
  - 详情页 header 标题 2 行后高度自适应，需确认不挤压右侧按钮布局

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 3 项全是 CSS+模板改动，方案清晰

phase_hint: [P1, P4, P5, P6]
