---
phase: P2
task_id: T069
type: design
parent: P1-requirements.md
trace_id: T069-P2-20260726
status: draft
created: 2026-07-26
agent: architect
---

## 影响域分析

### 改什么

| 文件 | 改动内容 |
|------|----------|
| `router.ts` | beforeEach 改为 async，authState='loading' 时等待初始化完成（带超时） |
| `EntryDetailView.vue` | 桌面端：品牌文字颜色降级 + 分隔符 + Files badge；移动端：去掉 ← 箭头+"PeekView"文字、logo icon 替代、Sign in 改文本链接、bottom bar 改 toggle-btn 风格、去掉 Explore/Share、drawer 头部加数量 |
| `FileTree.vue` | 面板头部 "FILES" → "FILES · N"，新增 fileCount prop |
| `layout.css` | 桌面端品牌文字 tertiary 色 + hover accent、分隔符样式、移动端 sticky header 56px + logo icon + 两行标题 + Sign in 文本链接、bottom bar toggle-btn 风格、drawer 头部数量样式 |

### 不改什么

- 后端（API/数据库/服务层）
- authStore 的 fetchMe 逻辑（只改守卫等待策略）
- main.ts 的初始化顺序（app.use(router) 仍在 fetchMe 之前，守卫自行等待）
- 桌面端 Explore 按钮（保留）
- 桌面端 TOC toggle（不变）
- 桌面端 Copy/Share/Overflow 布局（不变）
- zen mode 逻辑（不变）

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| 守卫等待期间页面空白 | 用户看到短暂白屏 | fetchMe 通常 <200ms，可接受；超时后按 anonymous 处理 |
| 守卫超时后误判 | 网络慢时已登录用户被踢到 / | 超时 5s 足够覆盖正常场景；超时后按当前 authState 判定 |
| 移动端 toggle-btn active 状态不同步 | drawer 关闭后按钮仍高亮 | watch drawer 状态同步 toggle active |
| FileTree 新增 prop 破坏现有调用 | FileTree 在桌面端和移动端 drawer 都被使用 | fileCount 可选 prop，默认不显示数量 |

## §1 候选方案

### 方案 A：守卫内 await + Promise.race 超时（推荐）

**Auth Guard**：将 `beforeEach` 改为 async 函数，当 `authState === 'loading'` 时，await 一个 Promise：监听 `initializing` ref 变为 false，或 5s 超时，取先到者。超时后按当前 authState 判定。

```typescript
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.authState === 'loading') {
    await waitForAuthInit(authStore, 5000)
  }
  if (to.path === '/') {
    if (authStore.authState === 'authenticated') return '/explore'
  }
  if (to.path === '/settings') {
    if (authStore.authState !== 'authenticated') return '/'
  }
})

function waitForAuthInit(authStore: ReturnType<typeof useAuthStore>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms)
    const stop = watch(() => authStore.initializing, (val) => {
      if (!val) {
        clearTimeout(timeout)
        stop()
        resolve()
      }
    }, { immediate: true })
  })
}
```

**UI 改动**：按 P0-brief 设计方案逐项实现（品牌降级、分隔符、badge、移动端重构）。

| 维度 | 评估 |
|------|------|
| 优点 | 标准模式（Vue Router 官方推荐 async guard）；最小改动（只改 router.ts 守卫逻辑）；不改变 main.ts 初始化顺序；超时兜底防无限挂起 |
| 风险 | 守卫等待期间导航暂停，页面空白（但 fetchMe 通常 <200ms）；需 import watch 从 vue |
| 工作量 | 小（守卫 ~20 行 + waitForAuthInit ~10 行） |

### 方案 B：main.ts 延迟 router 安装

**Auth Guard**：不改守卫逻辑。改 main.ts：先 await fetchMe()，再 app.use(router)，最后 app.mount('#app')。

```typescript
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const authStore = useAuthStore()
await authStore.fetchMe()
app.use(router)  // 此时 authState 已确定
app.mount('#app')
```

**UI 改动**：同方案 A。

| 维度 | 评估 |
|------|------|
| 优点 | 守卫逻辑完全不变（零风险）；authState 在路由初始化时已确定 |
| 风险 | 改变 main.ts 初始化顺序——router 插件延迟安装可能影响其他依赖 router 的组件；fetchMe 失败/超时时整个应用无法启动（无 router = 无页面）；与 P0-brief "不改 authStore 的 fetchMe 逻辑"约束不冲突但改变了调用时序 |
| 工作量 | 小（main.ts 改 3 行） |

### 选择理由

选方案 A。理由：
1. **符合约束**：P0-brief 明确"只改守卫的等待策略"，方案 A 只改守卫，方案 B 改了初始化时序
2. **标准模式**：async guard 是 Vue Router 官方文档推荐的处理异步认证方式
3. **超时兜底**：方案 A 有明确的超时机制（BDD-6 要求），方案 B 无超时——fetchMe 挂起则整个应用挂起
4. **最小验证已通过**：实测确认 Vue Router 4.x beforeEach async/await 可行
5. **风险隔离**：方案 A 的改动局限在 router.ts 守卫函数内，方案 B 影响全局初始化流程

## §2 详细设计

### 2.1 Auth Guard 修复（router.ts）

**改动**：`beforeEach` 改为 async，新增 `waitForAuthInit` 辅助函数。

**逻辑**：
1. 守卫入口检查 `authState === 'loading'`
2. 若 loading → await `waitForAuthInit(authStore, 5000)`
3. `waitForAuthInit` 内部：`watch(initializing)` + `setTimeout(5000)` 竞速
4. initializing 变 false → 清超时、停 watch、resolve
5. 超时 → resolve（authState 可能仍是 'loading'，守卫后续逻辑按 'loading' ≠ 'authenticated' 处理，即视为 anonymous）
6. 等待结束后，守卫逻辑与现有相同（`authState === 'authenticated'` 判定）

**BDD 覆盖**：
- BDD-1: loading → 等待 → authenticated → 不重定向 ✓
- BDD-2: loading → 等待 → anonymous → 重定向到 / ✓
- BDD-3: SPA 内导航时 initializing=false → 不等待 → 正常 ✓
- BDD-4: loading → 等待 → authenticated → 重定向到 /explore ✓
- BDD-5: loading → 等待 → anonymous → 停留 / ✓
- BDD-6: 超时 5s → resolve → 不会无限挂起 ✓

### 2.2 桌面端 Header 品牌与标题分离

**EntryDetailView.vue 模板改动**：
- `detail-logo-word` class 保留，样式改为 `--c-text-tertiary` 色
- 在 `detail-logo` router-link 和 `title-group` 之间新增分隔符 `<span class="brand-sep"></span>`

**layout.css 改动**：
- `.detail-logo-word`: `color: var(--c-text-tertiary)`（从 `--c-text` 降级）
- `.detail-logo:hover .detail-logo-word`: `color: var(--c-accent)`（保留 hover 效果）
- `.brand-sep`: `width: 1px; height: 20px; background: var(--c-border); margin: 0 8px; flex-shrink: 0; align-self: center;`

**BDD 覆盖**：BDD-7 ✓ BDD-8 ✓ BDD-9 ✓

### 2.3 桌面端 Files Toggle Badge

**EntryDetailView.vue 模板改动**：
- Files toggle-btn 内新增 badge：`<span v-if="currentEntry?.files.length" class="toggle-badge">{{ currentEntry.files.length }}</span>`

**layout.css 改动**：
- `.toggle-badge`: 复用 share-badge 样式（absolute 定位、accent bg、16px height、11px font）

**BDD 覆盖**：BDD-10 ✓ BDD-11 ✓（单文件时 `v-if="entryStore.isMultiFile"` 已隐藏整个 toggle-btn）

### 2.4 FileTree 面板头部

**FileTree.vue 改动**：
- 新增可选 prop `fileCount?: number`
- 模板：`<h3>Files<template v-if="fileCount !== undefined"> · {{ fileCount }}</template></h3>`

**EntryDetailView.vue 改动**：
- 桌面端 FileTree 传入 `:file-count="currentEntry?.files.length"`
- 移动端 File drawer 内 FileTree 也传入 `:file-count="currentEntry?.files.length"`

**BDD 覆盖**：BDD-12 ✓

### 2.5 移动端 Sticky Header

**EntryDetailView.vue 模板改动**：
- 去掉 `<router-link to="/" class="back-btn">`（← 箭头）
- 去掉 `<span class="sticky-brand">PeekView</span>`
- 新增 logo icon（复用桌面端 SVG，24px）作为 router-link to="/"
- 标题改为两行：`<span class="sticky-title two-line">{{ entryTitle }}</span>`
- Sign in 改为文本链接：`<a class="mobile-signin-link" @click="showLogin = true">Sign in</a>`

**layout.css 改动**：
- `.mobile-sticky-header`: height 52px → 56px
- `.sticky-title.two-line`: `font-size: 12px; font-weight: 600; line-height: 1.3; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;`
- `.mobile-signin-link`: `font-size: 13px; font-weight: 500; color: var(--c-accent); cursor: pointer; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; padding: 0 8px;`
- `.mobile-signin-link:hover`: `text-decoration: underline;`
- 移动端 logo icon: 24px SVG in router-link

**BDD 覆盖**：BDD-13 ✓ BDD-14 ✓ BDD-15 ✓ BDD-16 ✓

### 2.6 移动端 Bottom Bar

**EntryDetailView.vue 模板改动**：
- Files 按钮：从 `files-btn` 文字按钮改为 `toggle-btn` 风格 + badge
  ```html
  <button v-if="entryStore.isMultiFile"
    :class="['toggle-btn', { active: showFileDrawer }]"
    @click="showFileDrawer = !showFileDrawer"
    aria-label="Files">
    <FolderIcon :size="16" />
    <span v-if="currentEntry?.files.length" class="toggle-badge">{{ currentEntry.files.length }}</span>
  </button>
  ```
- TOC 按钮：从 `bottom-btn primary` 文字按钮改为 `toggle-btn` 风格
  ```html
  <button v-if="isMarkdown && tocHeadings.length > 0"
    :class="['toggle-btn', { active: showTocDrawer }]"
    @click="showTocDrawer = !showTocDrawer"
    aria-label="Table of Contents">
    <ListIcon :size="16" />
  </button>
  ```
- 去掉 Explore router-link
- 去掉 Share 按钮（已在 Overflow 中）
- 保留 Copy/Wrap 和 Overflow

**layout.css 改动**：
- 移动端 bottom bar 内 toggle-btn 样式适配（可能需要微调尺寸）
- 移动端 `.toggle-badge` 样式（同桌面端）

**BDD 覆盖**：BDD-17 ✓ BDD-18 ✓ BDD-19 ✓ BDD-20 ✓ BDD-21 ✓ BDD-22 ✓

### 2.7 移动端 Drawer 头部

**EntryDetailView.vue 模板改动**：
- File drawer header：`<span>Files</span>` → `<span>Files · {{ currentEntry?.files.length ?? 0 }}</span>`
- TOC drawer header：`<span>Table of Contents</span>` → `<span>Table of Contents · {{ tocHeadings.length }}</span>`

**BDD 覆盖**：BDD-23 ✓ BDD-24 ✓

### 2.8 移动端 toggle-btn active 状态同步

**EntryDetailView.vue 逻辑改动**：
- Files toggle-btn 的 active 绑定 `showFileDrawer`（已有 ref）
- TOC toggle-btn 的 active 绑定 `showTocDrawer`（已有 ref）
- drawer overlay 的 `@click` 已设置 `showFileDrawer = false` / `showTocDrawer = false`
- drawer close 按钮已设置关闭
- 无需额外 watch——ref 直接绑定 class 即可同步

## §3 BDD 覆盖矩阵

| BDD | 方案节 | 实现位置 |
|-----|--------|----------|
| BDD-1 | 2.1 | router.ts beforeEach async wait |
| BDD-2 | 2.1 | router.ts beforeEach async wait |
| BDD-3 | 2.1 | router.ts（SPA 内 initializing=false，不等待） |
| BDD-4 | 2.1 | router.ts `/` guard |
| BDD-5 | 2.1 | router.ts `/` guard |
| BDD-6 | 2.1 | router.ts waitForAuthInit 5s timeout |
| BDD-7 | 2.2 | layout.css .detail-logo-word color |
| BDD-8 | 2.2 | EntryDetailView.vue brand-sep + layout.css |
| BDD-9 | 2.2 | layout.css .detail-logo:hover .detail-logo-word |
| BDD-10 | 2.3 | EntryDetailView.vue toggle-badge |
| BDD-11 | 2.3 | v-if="entryStore.isMultiFile" 已隐藏 |
| BDD-12 | 2.4 | FileTree.vue fileCount prop |
| BDD-13 | 2.5 | EntryDetailView.vue 去掉 back-btn + sticky-brand |
| BDD-14 | 2.5 | layout.css .sticky-title.two-line |
| BDD-15 | 2.5 | logo icon router-link to="/" |
| BDD-16 | 2.5 | mobile-signin-link 样式 |
| BDD-17 | 2.6 | toggle-btn + badge |
| BDD-18 | 2.6 | toggle-btn |
| BDD-19 | 2.6 | 去掉 Explore |
| BDD-20 | 2.6 | 去掉 Share |
| BDD-21 | 2.6 | :class active 绑定 showFileDrawer |
| BDD-22 | 2.6 | :class active 绑定 showTocDrawer |
| BDD-23 | 2.7 | File drawer header |
| BDD-24 | 2.7 | TOC drawer header |

## §4 声明字段

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected: true
ui_interaction_points:
  - "桌面端 header 品牌文字 hover 变色"
  - "桌面端 Files toggle badge 显示"
  - "移动端 sticky header logo icon 点击返回"
  - "移动端 Sign in 文本链接点击"
  - "移动端 Files/TOC toggle-btn 点击开 drawer"
  - "移动端 Files/TOC toggle-btn active 状态与 drawer 同步"
  - "Auth guard 全页刷新行为"

gate_commands:
  P5: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_e2e: "E2E_SPEC=e2e/detail-header.spec.ts make debug-test 2>&1 | tail -40"
  P6: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
```

```yaml
env_constraints:
  debug_env: "make debug（:8888 隔离数据，PEEKVIEW_DEBUG_MODE=1）"
  isolation_check: "curl -s http://127.0.0.1:8888/api/v1/entries | head -c 100（debug backend 在线验证）"
```

```yaml
files_to_read:
  - path: frontend-v3/src/router.ts
    why: Auth guard 修改目标，需理解当前 beforeEach 逻辑
  - path: frontend-v3/src/stores/auth.ts:8-15
    why: authState computed 和 initializing ref 定义，waitForAuthInit 依赖
  - path: frontend-v3/src/views/EntryDetailView.vue:1-350
    why: 模板改动主文件——header/bottom bar/drawer 全部在此
  - path: frontend-v3/src/views/EntryDetailView.vue:351-826
    why: script setup——需理解 ref/computed/imports，新增逻辑加在此
  - path: frontend-v3/src/components/FileTree.vue:6-22
    why: 面板头部模板改动 + 新增 fileCount prop
  - path: frontend-v3/src/styles/layout.css:23-46
    why: detail-logo-word 样式改动 + brand-sep 新增
  - path: frontend-v3/src/styles/layout.css:231-283
    why: toggle-btn 样式参考 + active 状态
  - path: frontend-v3/src/styles/layout.css:319-394
    why: mobile-sticky-header 样式改动（高度/标题/Sign in）
  - path: frontend-v3/src/styles/layout.css:466-555
    why: mobile-bottom-bar 样式改动（toggle-btn 替换文字按钮）
  - path: frontend-v3/src/styles/variables.css:44-46
    why: --c-text-tertiary 和 --c-accent-secondary 变量定义
```

```yaml
minimal_validation:
  assumption: "Vue Router 4.x beforeEach 支持 async/await——返回 Promise 时导航暂停直到 resolve"
  method: "在项目 node_modules 环境下创建测试脚本，使用 createMemoryHistory + async beforeEach + Promise 竞速，模拟 auth 未初始化时导航到受保护路由"
  result: "confirmed"
  note: "测试通过：beforeEach async 函数正确暂停导航，await Promise resolve 后导航完成到目标路由。waitForAuthInit 的 watch(initializing) + setTimeout 竞速模式可行。"
```

## §5 实现完成标志

1. `router.ts` beforeEach 为 async，authState='loading' 时等待初始化（≤5s 超时）
2. 桌面端 header 品牌文字为 tertiary 色，hover 变 accent，与标题间有 1px 竖线分隔符
3. 桌面端 Files toggle 显示文件数量 badge（多文件 entry）
4. FileTree 面板头部显示 "FILES · N"
5. 移动端 sticky header 无 ← 箭头和 "PeekView" 文字，有 logo icon（点击回首页），标题最多两行，Sign in 为文本链接
6. 移动端 bottom bar Files/TOC 为 toggle-btn 风格 + active 同步，无 Explore/Share
7. 移动端 File drawer 头部 "Files · N"，TOC drawer 头部 "Table of Contents · N"
8. 所有 24 条 BDD 验收条件通过
