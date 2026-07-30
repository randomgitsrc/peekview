---
phase: P0
task_id: T081
task_name: resizable-sidebars
trace_id: T081
created: 2026-07-30
status: pending
parent: null
---

# T081: 详情页侧边栏可拖拽调整宽度

## 问题

详情页桌面端左侧 file tree（260px）和右侧 TOC（240px）固定宽度，长文件名&长标题被遮挡，观感不好。用户无法按需调整空间分配。

## 约束

- 只影响桌面端（>= 1024px），移动端侧边栏是 drawer，不适用
- 拖拽 handle 在侧边栏内边缘，鼠标 cursor 改为 col-resize
- 设最小宽度（file tree 180px, TOC 160px）和最大宽度（file tree 400px, TOC 320px）
- 宽度持久化到 localStorage，刷新后恢复
- 拖拽时内容区自适应（flex: 1），不需要手动计算
-Gutter<4px 不占可视空间，拖拽区域用 hit area 扩大

## 已知风险

- 拖拽DPI/触控板灵敏度差异，需测试不同输入设备
- 快速拖拽时可能出现布局抖动，需用 requestAnimationFrame 或 CSS resize 优化
- 与 zen mode 交互：zen mode 隐藏侧边栏，退出后应恢复拖拽后的宽度

## 关联

- T082 后侧边栏 DOM 和 CSS 在 `EntryDetailContent.vue`（非主组件 `EntryDetailView.vue`）
- `EntryDetailContent.vue`: `.file-sidebar` width:200px / `.toc-sidebar` width:240px（拖拽后需动态覆盖）
- variables.css: `--sidebar-width` / `--toc-width`（拖拽后动态覆盖 CSS variable）
- DESIGN.md §4=三栏布局描述
