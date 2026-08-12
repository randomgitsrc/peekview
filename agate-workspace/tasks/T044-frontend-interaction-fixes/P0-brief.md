---
phase: P0
task_id: T044
task_name: frontend-interaction-fixes
type: fix
trace_id: T044-P0-20260630
created: 2026-06-30
status: draft
agent: main
---

task: 前端交互修正 — Ctrl+F 修饰键过滤 + Explore 视图模式持久化

## 1. Ctrl+F 被 zen mode 劫持

`zen-shortcut.ts` 的 `shouldHandleZenShortcut()` 只检查 `event.key`，不检查 `event.ctrlKey` / `event.metaKey` / `event.altKey`。按 Ctrl+F 时 `event.key` 仍是 `'f'`，zen mode 拦截并 `preventDefault()`，浏览器搜索被吃掉。

**修复**：`shouldHandleZenShortcut` 开头加一行 `if (event.ctrlKey || event.metaKey || event.altKey) return false`。

**改动域**: `frontend-v3/src/utils/zen-shortcut.ts`，补充 `frontend-v3/src/utils/__tests__/zen-shortcut.spec.ts` 测试用例

## 2. Explore 视图模式不持久化

`EntryListView.vue:264` 的 `viewMode` 是纯本地 ref，不写 localStorage 也不进 URL params。切换到列表模式 → 离开 explore → 回来又变回卡片模式。

**修复**：加 localStorage 持久化（key: `peekview-view-mode`），与 theme 持久化模式一致。初始化时读 localStorage，切换时写。

**改动域**: `frontend-v3/src/views/EntryListView.vue`

known_risks:
  - 修饰键过滤需确认不漏掉合法的 zen mode 快捷键（当前只有 F 和 Escape，都不需要修饰键）
  - localStorage 持久化需处理首次访问（无存储值）的默认值 fallback

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可适度裁剪 — 两项均为小改，方案明确。P3 保留（zen-shortcut 有现成测试文件可补充），P2/P7 可跳过。P6 保留（需实跑验证 Ctrl+F 恢复 + viewMode 持久化）

phase_hint: [P1, P3, P4, P5, P6]
