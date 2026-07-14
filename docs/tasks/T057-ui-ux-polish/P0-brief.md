---
phase: P0
task_id: T057
task_name: ui-ux-polish
type: brief
trace_id: T057-P0-20260714
created: 2026-07-14
status: draft
parent: UI/UX 体验打磨 — OverflowMenu + ShareManagementPanel
---

# T057: UI/UX 重构与打磨

## 任务简报

### 需求 1：OverflowMenu (桌面端布局优化)
**问题**：桌面端 OverflowMenu（在 Detail Header 中）显示紧凑，对齐不统一（居中/左对齐混合），且 Light 模式下背景透明导致透传下方页面元素，视觉效果杂乱。
**方案**：
1. **轻量级优化**：不引入复杂 blur 效果，严格遵循现有设计系统。
2. **背景修复**：设置 `background: var(--bg-primary)`，确保 Light 模式下不再透传，视觉清晰。
3. **布局规范化**：标准化 `padding: 8px 12px`，Flex 布局强制 `align-items: center`，确保所有菜单项左对齐，Icon 和 Text 间距统一。

### 需求 2：ShareManagementPanel (重设计)
**问题**：目前分享后在底部展示的全屏宽度通栏，设计粗糙，交互（如复制链接、查看分享状态）不直观。
**方案：Contextual Unified Popover (上下文统一弹层)**
1. **交互逻辑**：摒弃底部通栏，改为紧贴分享按钮的 Popover。采用单层逻辑：
   - 无活跃分享：直接显示 `[ 生成分享链接 ]` 按钮。
   - 有活跃分享：显示分享链接详情行（带复制图标按钮） + 行尾 `[ 撤销分享 ]` (trash-2) 图标按钮。
2. **视觉规范**：
   - 复用现有 `--bg-primary`、`--border-color`、`--radius-md`、`--text-secondary` 等变量。
   - 图标：**必须使用 Lucide SVG**。
   - 字号：`font-size: 13px`。


## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 前端 `npx vue-tsc --noEmit` CI 强制

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| OverflowMenu 样式污染 | 布局调整影响其他组件 | 使用 CSS module 或 BEM 类名隔离 |
| SharePanel 响应式问题 | 桌面/移动端布局切换困难 | 定义清晰的 responsive breakpoints |

## 裁剪倾向

- P6（验收）保留：UI/UX 改动必须 Playwright 实跑+截图
- P7（一致性）可裁剪：纯前端改动，无跨包影响

## packages

- `frontend-v3/src/components/OverflowMenu.vue`
- `frontend-v3/src/components/ShareManagementPanel.vue`
- `frontend-v3/src/styles/layout.css`

## domains

- `ui-polish`：OverflowMenu 布局+视觉规范化
- `share-ux`：分享管理面板交互与视觉重设计
