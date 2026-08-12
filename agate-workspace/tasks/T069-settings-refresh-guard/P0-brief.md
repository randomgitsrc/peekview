---
phase: P0
task_id: T069
task_name: detail-page-header-polish
type: brief
trace_id: T069-P0-20260725
created: 2026-07-23
status: draft
parent: T068-P6-known-limitation + T067-设计修正
---

## 任务简述

详情页（EntryDetailView）header/bottom bar 的设计打磨，解决三个问题：

### 问题 1：auth guard 全页刷新 bug

已登录用户全页刷新 /settings 时，`router.beforeEach` 守卫在 `fetchMe()` 完成前运行，`authState='loading'` 被当作未认证，导致已登录用户被重定向到 `/`（Landing 页）。SPA 内导航正常，仅全页刷新触发。

根因：`app.use(router)` 在 `fetchMe()` 之前执行（main.ts L20 vs L24），Vue Router 初始导航在 `app.use(router)` 时就触发，此时 `initializing=true` → `authState='loading'` → 守卫 `authState !== 'authenticated'` 为 true → 踢到 `/`。

### 问题 2：品牌文字与标题视觉混淆

桌面端 header 中 "PeekView" 品牌文字（16px/700/`--c-text`）与 entry 标题（font-md/600/`--c-text`）字号字重接近、同色系、紧挨着，视觉上像一句话，读者分不清哪个是品牌、哪个是内容标题。

移动端 sticky header 中 "PeekView" 文字 + ← 箭头占空间，标题被挤压；且 logo icon 缺失，只有文字，品牌感弱。

### 问题 3：移动端交互元素不协调

- Sign in 按钮（蓝色实心小方块 + LogIn icon）在内容页 header 中视觉权重过大，丑
- 桌面端 header 有 Explore 按钮（Compass icon），移动端底部 bar 也有 Explore 按钮，两者与左上角 logo 功能重复——点击 logo 即可回首页，无需额外导航入口
- Files/TOC 按钮用文字按钮样式（"3 files"/"TOC"），与桌面端精致的 toggle-btn 风格不统一
- Share 按钮在底部 bar 占位，属于低频操作应收入 Overflow

## 设计方案

### 桌面端 Header

```
[icon] [PeekView] │ [entry 标题] ── [Files ③] [TOC] │ [Copy] [Share] │ [Sign in] [ThemeToggle]
```

| 元素 | 变化 | 样式 |
|------|------|------|
| Logo icon | 不变 | 28px SVG accent |
| "PeekView" 文字 | 保留，颜色降级 | 16px/700/`--c-text-tertiary`，hover 变 `--c-accent` |
| 分隔符 | 新增 | 1px 竖线 `--c-border`，高 20px，左右各 8px |
| Files toggle | 加文件数量 badge | 现有 toggle-btn + 右上角小 badge（同 share-badge 样式） |
| TOC toggle | 不变 | 现有 toggle-btn |
| 其余 | 不变 | — |

### 桌面端 FileTree 面板头部

当前：`FILES`（大写，无数量）。改为：`FILES · 3`——面板头部也显示文件数量。

### 移动端 Sticky Header

```
[icon] [标题（2行）...] [Sign in]
```

| 元素 | 变化 | 样式 |
|------|------|------|
| ← 箭头 | 去掉 | logo icon 兼任返回 |
| "PeekView" 文字 | 去掉 | 移动端空间宝贵，icon 足够 |
| Logo icon | 替代 ← 箭头 | 24px SVG，点击回首页 |
| 标题 | 两行紧凑显示 | 12px/600/`--c-text`，line-clamp: 2，行高 1.3 |
| Sign in | 改为文本链接 | 13px/500/`--c-accent`，hover underline（匿名时显示） |
| Header 高度 | 52px → 56px | 容纳两行标题 |

### 移动端 Bottom Bar

```
[Files ③] [TOC] ──── [Copy] [⋮]
```

| 元素 | 变化 | 样式 |
|------|------|------|
| Files | 改用 toggle-btn 28px + badge | 和桌面端同款，active 时 accent 高亮，点击开 file drawer |
| TOC | 改用 toggle-btn 28px | 和桌面端同款，active 时 accent 高亮，点击开 TOC drawer |
| Explore | 去掉 | logo 点击即可导航 |
| Share | 去掉 | 收入 Overflow |
| Copy/Wrap | 保留 | 高频内容操作 |
| Overflow | 保留 | 收进：Theme / Share / Download / Raw / Pack / Visibility / Delete |

### 移动端 Drawer 头部

File drawer：`Files · 3`（和桌面端 FileTree 面板头部一致）
TOC drawer：`Table of Contents · 12`

### Auth Guard 修复

`router.beforeEach` 守卫遇到 `authState === 'loading'` 时等待初始化完成再判断，而非立即当作未认证。具体实现：在守卫中 watch/authStore.initializing 或 await fetchMe 完成。

## 环境约束

- 改动范围：`frontend-v3/src/router.ts`（auth guard）、`frontend-v3/src/views/EntryDetailView.vue`（header/bottom bar 模板+逻辑）、`frontend-v3/src/styles/layout.css`（样式）、`frontend-v3/src/components/FileTree.vue`（面板头部加文件数量）
- 不改后端
- 不改 authStore 的 fetchMe 逻辑（只改守卫的等待策略）

## 已知风险

- 守卫等待 authState 初始化完成期间，页面可能短暂空白（需 loading 指示或延迟渲染）
- `/` 路由的守卫也有同样问题：`authState='loading'` 时不会重定向到 `/explore`，但这是可接受的（loading 结束后会自动重定向）
- 移动端 bottom bar 改用 toggle-btn 后，active 状态需要和 drawer 开关状态同步（drawer 关闭时取消 active）

## 裁剪倾向

- risk=medium：多文件改动，涉及 UI 布局 + 交互逻辑 + auth guard
- phases: [P1, P2, P3, P4, P5, P6, P7, P8] 全走
- P2 不可省略（UI 设计需评审）
- P6 需 Playwright 验证（ui_affected=true）

## executor_env

```yaml
platform: "opencode"
has_task_tool: true
has_local_runtime: true
network: "full"
```
