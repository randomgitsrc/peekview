---
phase: P4
task_id: T069
type: implementation
parent: P2-design.md
trace_id: T069-P4-20260726
status: draft
created: 2026-07-26
agent: implementer
---

## implementation_dir

`frontend-v3/src/`

## 改动文件清单

| 文件 | 改动摘要 |
|------|----------|
| `frontend-v3/src/router.ts` | beforeEach 改 async + waitForAuthInit（watch initializing + 5s timeout 竞速） |
| `frontend-v3/src/views/EntryDetailView.vue` | 桌面端：brand-sep + Files toggle-badge；移动端：logo icon 替代 back-btn+sticky-brand、two-line 标题、mobile-signin-link、bottom bar toggle-btn 风格 Files/TOC、去掉 Explore/Share、drawer 头部加数量；移除 ChevronLeftIcon/LogInIcon 导入 |
| `frontend-v3/src/components/FileTree.vue` | 新增可选 fileCount prop，面板头部 "FILES · N" |
| `frontend-v3/src/styles/layout.css` | .detail-logo-word tertiary 色、.brand-sep、.toggle-badge、.mobile-logo-link、.sticky-title.two-line、.mobile-signin-link、mobile bottom bar toggle-btn 38px、移除 .back-btn/.sticky-brand/.mobile-signin-btn/.files-btn 样式 |
| `frontend-v3/src/components/__tests__/t067-detail-framework.spec.ts` | 更新选择器匹配新 class 名（mobile-signin-link、mobile-logo-link、toggle-btn/toggle-badge） |

## §2.1 Auth Guard 修复

- `router.beforeEach` 改为 async
- 新增 `waitForAuthInit(authStore, 5000)`：watch `authStore.initializing` + setTimeout 5s 竞速
- authState='loading' 时 await 等待，结束后按实际 authState 判定
- BDD-1~6 覆盖

## §2.2 桌面端 Header 品牌与标题分离

- `.detail-logo-word` color 从 `--c-text` 降级为 `--c-text-tertiary`
- 新增 `.brand-sep`（1px 竖线，20px 高，`--c-border`，左右 8px margin）
- BDD-7~9 覆盖

## §2.3 桌面端 Files Toggle Badge

- Files toggle-btn 内新增 `.toggle-badge`（复用 share-badge 样式：absolute 定位、accent bg、16px height）
- `v-if="currentEntry?.files.length"` 控制显示
- BDD-10~11 覆盖

## §2.4 FileTree 面板头部

- 新增可选 prop `fileCount?: number`
- 模板：`Files<template v-if="fileCount !== undefined"> · {{ fileCount }}</template>`
- EntryDetailView 桌面端和移动端 drawer 均传入 `:file-count`
- BDD-12 覆盖

## §2.5 移动端 Sticky Header

- 去掉 `.back-btn`（← 箭头）和 `.sticky-brand`（PeekView 文字）
- 新增 `.mobile-logo-link`（24px SVG logo icon，router-link to="/"）
- 标题改为 `.sticky-title.two-line`（12px/600/line-clamp:2/line-height:1.3）
- Sign in 改为 `.mobile-signin-link`（13px/500/accent 色，hover underline）
- Header 高度 52px → 56px
- BDD-13~16 覆盖

## §2.6 移动端 Bottom Bar

- Files：`.files-btn` → `.toggle-btn` + `.toggle-badge`（active 绑定 showFileDrawer）
- TOC：`.bottom-btn.primary` → `.toggle-btn`（active 绑定 showTocDrawer）
- 去掉 Explore router-link
- 去掉 Share 按钮（已在 Overflow 中）
- 保留 Copy/Wrap 和 Overflow
- BDD-17~22 覆盖

## §2.7 移动端 Drawer 头部

- File drawer：`Files` → `Files · {{ currentEntry?.files.length ?? 0 }}`
- TOC drawer：`Table of Contents` → `Table of Contents · {{ tocHeadings.length }}`
- BDD-23~24 覆盖

## 自查结果

- vitest: 72/73 pass（1 pre-existing t068 failure，与 T069 无关）
- vue-tsc --noEmit: pass
