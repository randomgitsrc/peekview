---
phase: P7
task_id: T069
type: consistency
parent: P6-acceptance.md
trace_id: T069-P7-20260726
status: draft
created: 2026-07-26
agent: architect
---

## 方向 1：设计→实现（逐项对照 P2-design.md）

### §2.1 Auth Guard 修复（router.ts）

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| beforeEach 改为 async | `router.beforeEach(async (to) => {` (router.ts:75) | 一致 |
| authState='loading' 时 await waitForAuthInit | `if (authStore.authState === 'loading') { await waitForAuthInit(authStore, 5000) }` (router.ts:77-79) | 一致 |
| waitForAuthInit: watch(initializing) + setTimeout 竞速 | 完整实现 (router.ts:62-73)，与 P2 伪代码逐行对应 | 一致 |
| 超时 5s | `waitForAuthInit(authStore, 5000)` (router.ts:78) | 一致 |
| initializing 变 false → 清超时、停 watch、resolve | `clearTimeout(timeout); stop(); resolve()` (router.ts:67-69) | 一致 |
| 超时 → resolve（按当前 authState 判定） | `setTimeout(resolve, ms)` (router.ts:64) | 一致 |
| import watch from vue | `import { watch } from 'vue'` (router.ts:3) | 一致 |
| 守卫逻辑：/ + authenticated → /explore | `if (to.path === '/') { if (authStore.authState === 'authenticated') return '/explore' }` (router.ts:80-82) | 一致 |
| 守卫逻辑：/settings + !authenticated → / | `if (to.path === '/settings') { if (authStore.authState !== 'authenticated') return '/' }` (router.ts:83-85) | 一致 |

BDD-1~6 覆盖：t069-auth-guard.test.ts 6 个 describe 逐条对应 ✓

### §2.2 桌面端 Header 品牌与标题分离

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| .detail-logo-word color: --c-text-tertiary | `color: var(--c-text-tertiary)` (layout.css:36) | 一致 |
| .detail-logo:hover .detail-logo-word color: --c-accent | `color: var(--c-accent)` (layout.css:41) | 一致 |
| .brand-sep: 1px/20px/--c-border/margin 0 8px | 完整实现 (layout.css:44-51) | 一致 |
| 模板新增 brand-sep span | `<span class="brand-sep"></span>` (EntryDetailView.vue:24) | 一致 |

BDD-7~9 覆盖：P6 全 PASS ✓

### §2.3 桌面端 Files Toggle Badge

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| toggle-btn 内新增 toggle-badge | `<span v-if="currentEntry?.files.length" class="toggle-badge">{{ currentEntry.files.length }}</span>` (EntryDetailView.vue:37) | 一致 |
| .toggle-badge 复用 share-badge 样式 | absolute/16px/accent bg/11px font (layout.css:53-70) | 一致 |
| v-if 控制 | `v-if="currentEntry?.files.length"` (EntryDetailView.vue:37) | 一致 |

BDD-10~11 覆盖：P6 全 PASS ✓

### §2.4 FileTree 面板头部

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| 新增可选 prop fileCount?: number | `fileCount?: number` (FileTree.vue:32) | 一致 |
| 模板：Files · N | `Files<template v-if="fileCount !== undefined"> · {{ fileCount }}</template>` (FileTree.vue:9) | 一致 |
| 桌面端传入 :file-count | `:fileCount="currentEntry?.files.length"` (EntryDetailView.vue:145) | 一致 |
| 移动端 drawer 传入 :file-count | `:fileCount="currentEntry?.files.length"` (EntryDetailView.vue:290) | 一致 |

BDD-12 覆盖：P6 PASS ✓

### §2.5 移动端 Sticky Header

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| 去掉 back-btn（← 箭头） | 模板中无 back-btn，grep 确认不存在 | 一致 |
| 去掉 sticky-brand（PeekView 文字） | 模板中无 sticky-brand，grep 确认不存在 | 一致 |
| 新增 mobile-logo-link（24px SVG） | `<router-link to="/" class="mobile-logo-link">` + 24px SVG (EntryDetailView.vue:6-8) | 一致 |
| 标题改为 sticky-title two-line | `<span class="sticky-title two-line">` (EntryDetailView.vue:9) | 一致 |
| Sign in 改为 mobile-signin-link | `<a class="mobile-signin-link" @click="showLogin = true">Sign in</a>` (EntryDetailView.vue:10-14) | 一致 |
| Header 高度 52px → 56px | `height: 56px` (layout.css:352) | 一致 |
| .sticky-title.two-line 样式 | 12px/600/line-clamp:2/line-height:1.3 (layout.css:389-399) | 一致 |
| .mobile-signin-link 样式 | 13px/500/accent/min-height:44px (layout.css:401-416) | 一致 |
| 移除 ChevronLeftIcon/LogInIcon 导入 | grep 确认不存在 | 一致 |

BDD-13~16 覆盖：P6 全 PASS ✓

### §2.6 移动端 Bottom Bar

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| Files: toggle-btn + toggle-badge + active 绑定 showFileDrawer | `:class="['toggle-btn', { active: showFileDrawer }]"` + badge (EntryDetailView.vue:255-261) | 一致 |
| TOC: toggle-btn + active 绑定 showTocDrawer | `:class="['toggle-btn', { active: showTocDrawer }]"` (EntryDetailView.vue:262-267) | 一致 |
| 去掉 Explore router-link | 模板中无 Explore（移动端 bottom bar 区域） | 一致 |
| 去掉 Share 按钮 | 模板中无 Share（移动端 bottom bar 区域） | 一致 |
| 保留 Copy/Wrap 和 Overflow | Wrap + Copy + OverflowMenu (EntryDetailView.vue:269-277) | 一致 |
| mobile bottom bar toggle-btn 38px | `.mobile-bottom-bar .toggle-btn { width: 38px; height: 38px; }` (layout.css:499-503) | 一致 |

BDD-17~22 覆盖：P6 全 PASS ✓

### §2.7 移动端 Drawer 头部

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| File drawer: Files · N | `Files · {{ currentEntry?.files.length ?? 0 }}` (EntryDetailView.vue:284) | 一致 |
| TOC drawer: Table of Contents · N | `Table of Contents · {{ tocHeadings.length }}` (EntryDetailView.vue:299) | 一致 |

BDD-23~24 覆盖：P6 全 PASS ✓

### §2.8 移动端 toggle-btn active 状态同步

| P2 设计项 | 实现状态 | 判定 |
|-----------|----------|------|
| Files active 绑定 showFileDrawer | `:class="['toggle-btn', { active: showFileDrawer }]"` (EntryDetailView.vue:256) | 一致 |
| TOC active 绑定 showTocDrawer | `:class="['toggle-btn', { active: showTocDrawer }]"` (EntryDetailView.vue:263) | 一致 |
| drawer overlay @click 关闭 | `@click="showFileDrawer = false"` / `@click="showTocDrawer = false"` (EntryDetailView.vue:281,296) | 一致 |
| 无需额外 watch | ref 直接绑定 class，无额外 watch | 一致 |

### P2 "不改什么" 验证

| 不改项 | 验证结果 | 判定 |
|--------|----------|------|
| 后端（API/数据库/服务层） | 无后端文件变更 | 一致 |
| authStore 的 fetchMe 逻辑 | auth.ts 未修改 | 一致 |
| main.ts 初始化顺序 | main.ts 未修改 | 一致 |
| 桌面端 Explore 按钮 | `<router-link to="/explore">` + CompassIcon 保留 (EntryDetailView.vue:86-89) | 一致 |
| 桌面端 TOC toggle | toggle-btn + ListIcon 保留 (EntryDetailView.vue:41-49) | 一致 |
| 桌面端 Copy/Share/Overflow 布局 | icon-btn + share-btn + OverflowMenu 保留 (EntryDetailView.vue:51-79) | 一致 |
| zen mode 逻辑 | zenMode ref + handleZenKeydown + v-show="!zenMode" 未变 | 一致 |

### P2 声明字段验证

| 字段 | P2 声明 | 实际 | 判定 |
|------|---------|------|------|
| packages | [frontend-v3] | P4 改动文件全在 frontend-v3/src/ | 一致 |
| domains | [frontend] | 无后端/MCP/安全改动 | 一致 |
| ui_affected | true | P6 Playwright 实跑验证 | 一致 |

## 方向 2：实现→设计（检查设计文档中是否有不再适用的要求）

| 实现发现 | 设计文档对应 | 判定 |
|----------|-------------|------|
| P4 改动文件含 t067-detail-framework.spec.ts（测试更新） | P2 影响域未列出此文件 | [DEVIATION] 非核心：测试文件因选择器变更而更新，属于实现必然，P2 影响域通常不含测试文件 |
| 移动端 bottom bar toggle-btn 尺寸 38px | P2 §2.6 提到"可能需要微调尺寸" | 一致：设计预留了微调空间 |
| FileTree.vue 模板用 `v-if="fileCount !== undefined"` 而非 `v-if="fileCount"` | P2 §2.4 写 `v-if="fileCount !== undefined"` | 一致 |
| 移动端 sticky header 用 `v-if="isMobile"` 而非 CSS media query 控制 | P2 §2.5 未指定实现方式 | [EXTENSION] 合理：isMobile computed 已存在，v-if 比 CSS display:none 更干净 |

## DESIGN_GAP 配对

P4-implementation.md 中无 `[DESIGN_GAP:]` 声明。无需配对。

## SCOPE+ 闭环

P1-requirements.md 和 P2-design.md 中无 `[SCOPE+]` 声明。P1 待确认清单为 `[NO_NEED_CONFIRM]`。无未闭环项。

## 跨文件一致性

| 检查项 | 结果 |
|--------|------|
| P2§packages [frontend-v3] vs P4 改动范围 | 一致：所有改动在 frontend-v3 |
| P1 BDD 数量 (24) vs P6 PASS 数量 (24) | 一致：24/24 PASS |
| P4 实现路径 vs P2 方案设计 | 一致：方案 A（async guard + Promise.race）完整落地 |
| P2 gate_commands vs P5 实际执行 | 一致：P5 执行 `cd frontend-v3 && npx vitest run --reporter=dot` |
| P2 minimal_validation (confirmed) vs 实际实现 | 一致：async beforeEach 可行 |
| P5 预存失败 (t068) vs T069 无关 | 确认无关 |

## P6 BDD 二值规则检查

P6-acceptance.md 中 24 条 BDD 全部为 PASS，无中间态（调整/跳过/覆盖）。一致。

## 未决项清零

| 检查项 | 结果 |
|--------|------|
| [NEED_CONFIRM] | 无残留 |
| [BLOCKER] | 无残留 |
| [DEVIATION-CRITICAL] | 无残留 |
| [NO_NEED_CONFIRM] | P1 待确认清单已声明 |

## 一致性结论

**BLOCKER=0, DEVIATION-CRITICAL=0**

P2 设计方案 A（async guard + Promise.race + UI 打磨）完整落地，24 条 BDD 全 PASS。实现与设计双向一致，无核心偏差。1 个非核心 DEVIATION（测试文件未列入 P2 影响域）和 1 个 EXTENSION（移动端 header 用 v-if 替代 CSS 控制），均不阻塞。
