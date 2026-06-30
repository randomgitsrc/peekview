---
phase: P0
task_id: T039
task_name: explore-ui-polish
type: fix
trace_id: T039-P0-20260630
created: 2026-06-30
status: draft
---

task: Explore 页面三项 UI 修正 — Public badge 智能显隐 + summary 去重 + 标签折叠上下文感知

## 1. Public badge 智能显隐

**现状**: `EntryCard.vue:36` 和 `EntryListRow.vue:22` 无条件渲染 `<BaseBadge :status="entry.isPublic ? 'public' : 'private'" />`。未登录用户只能看到公开条目，每个都标 "Public" = 废信息。

**修正**:
- 非 owner → 隐藏 badge（非 owner 看不到私有条目，badge 无信息量）
- Owner 自己 → 显示 public/private badge（有实际意义：知道哪些公开哪些没公开）
- 实现方式：`v-if="isOwner"` 控制 BaseBadge 渲染

**改动域**: `EntryCard.vue`, `EntryListRow.vue`

## 2. Summary 去重

**现状**: 后端只有一个 `summary` 字段（"Human-readable description"），没有独立的 `title` 字段。前端同时渲染为 title 和 summary：
- `EntryListRow.vue:11` — title 行：`{{ entry.summary || entry.slug }}`
- `EntryListRow.vue:12` — summary 行：`{{ entry.summary }}`
- 两行显示完全相同内容

**修正**:
- 列表模式：删掉 `.entry-summary` 行，只保留 title（`summary || slug`）
- 卡片模式：无此问题（已只显示一行）
- 详情页：无此问题（只用 summary 作 h1）

**改动域**: `EntryListRow.vue`（删除 `.entry-summary` 行及其 `v-if` 条件 + 相关 CSS）

## 3. 标签折叠上下文感知

**现状**: `TAG_LIMIT = 3` 硬编码在三处：
- `EntryCard.vue:64` — 卡片模式（3 个后 +N，合理：控制卡片高度）
- `EntryListRow.vue:70` — 列表模式（3 个后 +N，**不合理**：列表行宽度充足，标签可以自然换行）
- `EntryDetailView.vue` — 详情页（3 个后 +N，**不合理**：详情页空间最充足）

**修正**:
- 卡片模式：保留 `TAG_LIMIT = 3`
- 列表模式：不限制，全部显示（`flex-wrap: wrap` 已有）
- 详情页：不限制，全部显示
- 实现：各组件内设不同 `TAG_LIMIT` 常量（卡片=3，列表和详情不设上限），简单直接

**改动域**: `EntryCard.vue`, `EntryListRow.vue`, `EntryDetailView.vue`

known_risks:
  - 删除 summary 行可能让列表行信息密度降低，但重复信息更差
  - 详情页标签不折叠在极端情况（>20 个标签）可能过长，可后续加 max-height + 展开
  - BaseBadge 显隐依赖 isOwner prop，需确认所有调用点正确传递

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可适度裁剪 — 三项均为小改，方案明确，P3 可跳过（现有测试覆盖足够），P7 可跳过（不涉及发布）
