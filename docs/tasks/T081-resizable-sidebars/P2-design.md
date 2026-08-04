---
phase: P2
task_id: T081-resizable-sidebars
type: design
parent: P1-requirements.md
trace_id: T081-P2-20260804
status: draft
created: 2026-08-04
agent: architect
---

# P2 方案设计：详情页侧边栏可拖拽调整宽度

## 影响域分析

### 改什么

| 文件 | 改动内容 |
|------|----------|
| `frontend-v3/src/components/EntryDetailContent.vue` | 移除 scoped `.file-sidebar`/`.toc-sidebar` **整个规则块**（含 `width: 200px`/`240px` 及 `overflow-y: auto`）；在两个 `<aside>` 内部添加 resize handle 元素；引入 useSidebarResize composable |
| `frontend-v3/src/composables/useSidebarResize.ts` | **新建**。localStorage 持久化（load/save/clamp）+ 拖拽事件链（mousedown/mousemove/mouseup）+ 双击 reset + rAF 节流 |
| `frontend-v3/src/styles/variables.css` | 新增 `--sidebar-width-min`/`--sidebar-width-max`/`--toc-width-min`/`--toc-width-max` 变量 |
| `frontend-v3/src/styles/layout.css` | 新增 `.resize-handle` 全局样式（位置、尺寸、cursor、focus ring、移动端隐藏）；给 `.file-sidebar` 补 `overflow-y: auto`；给 `.file-sidebar`/`.toc-sidebar` 补 `position: relative` |

### 不改什么

| 文件 | 理由 |
|------|------|
| `FileTree.vue` | 无宽度逻辑，填满父容器，不需要改动 |
| `TocNav.vue` | 无宽度逻辑，填满父容器，不需要改动 |
| `EntryDetailView.vue` | 不需要传递 resize 状态——resize handle 的 v-if 与侧边栏的 v-if 相同，直接在 EntryDetailContent.vue 内联即可 |
| `useResponsiveLayout.ts` | 移动端断点由 CSS @media 控制，不需要 JS 介入 |
| `useViewMode.ts` | 参照模式，不修改 |
| 后端 / MCP / CLI | 纯前端任务 |

### 风险在哪

| 风险 | 缓解 |
|------|------|
| scoped 样式移除后宽度闪变 | layout.css 已有 `width: var(--sidebar-width)`/`var(--toc-width)`，移除 scoped 后自动回退到变量值，无闪变 |
| mousemove 性能 | requestAnimationFrame 节流（参照 useResponsiveLayout.ts:14-18 的 rAF 模式） |
| 拖拽时文字被选中 | 拖拽期间给 `document.body` 添加 `user-select: none` class，结束后移除 |
| 拖拽时触发内容区滚动 | flex 布局中 mousemove 不直接触发滚动；拖拽期间 `user-select: none` + `cursor: col-resize` 的视觉效果使用户不会试图滚动。无需额外 `overflow: hidden` 或 `pointer-events: none`（pointer-events 阻止点击不阻止滚动，描述不精确已移除） |
| localStorage 非法值 | load 函数做 Number.isFinite + clamp 校验，非法值回退到 CSS 变量默认值 |
| z-index 冲突 | handle z-index: 50，低于 drawer overlay (scoped 200 / global 100) |
| 多 tab 并发写 localStorage | 最后写入的 tab 胜出，可接受（与 useViewMode.ts 一致的行为） |

## §1 候选方案

### follows_existing_pattern 声明

```yaml
follows_existing_pattern:
  - frontend-v3/src/composables/useViewMode.ts  # localStorage load/save + 值校验模式
  - frontend-v3/src/composables/useResponsiveLayout.ts  # rAF 节流 + 事件监听器管理模式
```

理由：T081 的核心能力（localStorage 持久化 + 事件驱动交互）在项目中已有成熟模式。useViewMode.ts 提供了 localStorage 的 load/save 函数 + 值校验范式；useResponsiveLayout.ts 提供了 rAF 节流 + 事件监听器注册/清理范式。新 composable 组合这两个已有模式即可，不需要探索新的架构方向。

### 候选方案 A：独立 composable + CSS 变量驱动（选定）

**选择理由**：T081 的核心能力（localStorage 持久化 + 事件驱动交互）在项目中已有成熟模式，无需探索替代方案。useViewMode.ts 提供了 localStorage 的 load/save 函数 + 值校验范式；useResponsiveLayout.ts 提供了 rAF 节流 + 事件监听器注册/清理范式。新 composable 组合这两个已有模式即可。

**架构**：

```
useSidebarResize.ts (composable)
  ├── 配置: { storageKey, cssVar, defaultPx, minPx, maxPx, side: 'left'|'right' }
  ├── loadWidth(): number  — localStorage 读取 + Number.isFinite + clamp 校验
  ├── saveWidth(px: number): void  — clamp 后写入 localStorage
  ├── startDrag(event: MouseEvent): void  — mousedown 入口，注册 mousemove/mouseup 到 document
  ├── onDoubleClick(): void  — reset 到 defaultPx
  └── cleanup(): void  — 移除所有事件监听器

EntryDetailContent.vue
  ├── <aside class="file-sidebar">
  │     <FileTree ... />
  │     <div class="resize-handle resize-handle-right" ... />  ← handle 在 sidebar 内部，定位在右边缘
  │   </aside>
  ├── <main class="content-area">...</main>
  └── <aside class="toc-sidebar">
        <div class="resize-handle resize-handle-left" ... />  ← handle 在 sidebar 内部，定位在左边缘
        <TocNav ... />
      </aside>
```

**宽度控制路径**：
1. composable 初始化时 `loadWidth()` → 得到合法 px 值
2. 通过 `document.documentElement.style.setProperty(cssVar, '${px}px')` 设置 CSS 变量
3. layout.css 的 `width: var(--sidebar-width)` 自动生效
4. 拖拽时 mousemove → rAF → `setProperty` 更新变量 → saveWidth 持久化

**拖拽事件链**：
```
mousedown(handle)
  → 记录 startX = e.clientX, startWidth = currentWidth
  → document.addEventListener('mousemove', onMouseMove)
  → document.addEventListener('mouseup', onMouseUp)
  → document.body.classList.add('resize-active')  // user-select: none

mousemove(document)
  → rAF(() => {
      delta = e.clientX - startX
      newWidth = side === 'left' ? startWidth + delta : startWidth - delta
      clamped = clamp(newWidth, minPx, maxPx)
      setProperty(cssVar, clamped + 'px')
    })

mouseup(document)
  → removeEventListener(mousemove, mouseup)
  → document.body.classList.remove('resize-active')
  → saveWidth(currentWidth)
```

**双击 reset**：
```
dblclick(handle)
  → setProperty(cssVar, defaultPx + 'px')
  → saveWidth(defaultPx)
```

**键盘可访问性**：
- handle 是 `<div role="separator" tabindex="0" aria-orientation="vertical" aria-label="...">`
- keydown: ArrowLeft/ArrowRight → 宽度 ±8px（参照 ARIA separator 规范）
- focus-visible: outline 2px solid var(--c-accent)

**移动端隐藏**：
```css
@media (max-width: 1023px) {
  .resize-handle { display: none; }
}
```
与侧边栏的 `display: none` 一致（layout.css:100, 122）。

**条件渲染联动**：
- handle 在 `<aside>` 内部，aside 的 v-if 消失时 handle 一起消失，无需额外逻辑

**min/max clamp 值**：

| 侧边栏 | min | default | max |
|--------|-----|---------|-----|
| file-sidebar | 160px | 260px | 500px |
| toc-sidebar | 150px | 240px | 400px |

**优点**：
- 完全遵循已有模式（useViewMode + useResponsiveLayout）
- CSS 变量驱动，layout.css 已有 `var()` 引用，改动最小
- handle 在 aside 内部，v-if 自动联动，无额外逻辑
- composable 可独立测试（vitest + mock localStorage）

**风险**：
- `document.documentElement.style.setProperty` 在 :root 上设置 inline style，specificity 高于 variables.css 的 `:root {}`，能正确覆盖（这是期望行为）
- 拖拽期间 body class 添加 `resize-active`，需要确保不影响其他样式（新 class，无冲突）

**工作量**：~150 行 composable + ~20 行 template + ~30 行 CSS = ~200 行

## 四字段声明

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
ui_interaction_points:
  - "file-sidebar 右边缘 resize handle：mousedown 拖拽改变宽度"
  - "toc-sidebar 左边缘 resize handle：mousedown 拖拽改变宽度"
  - "resize handle 双击：reset 默认宽度"
  - "resize handle Tab 聚焦：显示 focus ring"
  - "resize handle ArrowLeft/Right 键盘调整宽度"
gate_commands:
  P3: "cd frontend-v3 && npx vitest run --reporter=dot src/composables/__tests__/useSidebarResize.spec.ts"
  P5: "cd frontend-v3 && npx vitest run --reporter=dot"
  P5_e2e: "cd frontend-v3 && npx playwright test e2e/t081-resizable-sidebars.spec.ts --reporter=line"
  project_module: "src/"
```

## env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick (:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — E2E 前后计数不变"
  test_framework: "vitest 1.6.1 (frontend-v3/) + Playwright CDP (Chrome 151 :18800)"
  build_cmd: "make build-frontend"
  typecheck_cmd: "cd frontend-v3 && npx vue-tsc --noEmit"
```

## files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/components/EntryDetailContent.vue
    why: 移除 scoped 硬编码宽度，添加 resize handle 元素，引入 composable
  - path: frontend-v3/src/composables/useViewMode.ts
    why: localStorage load/save + 值校验的参照模式
  - path: frontend-v3/src/composables/useResponsiveLayout.ts
    why: rAF 节流 + 事件监听器管理的参照模式
  - path: frontend-v3/src/styles/variables.css:29-33
    why: 现有 --sidebar-width/--toc-width 定义位置，新增 min/max 变量
  - path: frontend-v3/src/styles/layout.css:99-162
    why: 现有 .file-sidebar/.toc-sidebar 样式 + @media 断点 + zen mode
  - path: frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts
    why: composable 单测的 BDD 命名 + DOM mock 模式
```

## minimal_validation

```yaml
minimal_validation:
  assumption: "document.documentElement.style.setProperty('--sidebar-width', '350px') 能覆盖 variables.css 中 :root { --sidebar-width: 260px } 的定义"
  method: "纯代码逻辑，无外部系统依赖。依赖的内部函数/转换：CSS 自定义属性优先级规则（inline style > stylesheet rule）+ localStorage 读写 API + Vue 3 响应式系统。这三个都是 W3C/MDN 标准行为，无需浏览器行为验证。"
  result: "not_needed"
  note: "CSS 变量 inline style 覆盖 stylesheet 是 W3C 规范行为（CSS Custom Properties Level 1 §2），在所有现代浏览器中一致。localStorage API 是 W3C Web Storage 标准。Vue 3 响应式系统不参与 resize 逻辑（纯 DOM 事件 + CSS 变量），无框架行为风险。"
```

## 修订说明（P2 修复轮）

### ISSUE-1: overflow-y: auto 丢失（MINOR）— 已解决

**策略**：采用推荐选项 B — 移除 scoped 整个 `.file-sidebar`/`.toc-sidebar` 规则块，将 `overflow-y: auto` 补入 layout.css。

**具体改动**：
- `EntryDetailContent.vue` scoped 样式：移除整个 `.file-sidebar { width: 200px; border-right: ...; overflow-y: auto; flex-shrink: 0; }` 规则块（不只移除 width 声明）
- `layout.css` 的 `.file-sidebar` 规则：补 `overflow-y: auto`（与 toc-sidebar layout.css:127 的 `overflow-y: auto` 对齐）
- toc-sidebar 无此问题（layout.css:127 已有 `overflow-y: auto`），只需移除 scoped 中的 width 声明

**理由**：彻底统一到全局样式管理，避免 scoped/global 双源维护。layout.css 已管理 width/border/flex-shrink，overflow-y 一并纳入更内聚。

### ISSUE-2: aside 缺少 position: relative（MINOR）— 已解决

**策略**：在 layout.css 改动中给 `.file-sidebar` 和 `.toc-sidebar` 均添加 `position: relative`。

**理由**：resize handle 使用 `position: absolute` 定位在 aside 边缘，aside 必须是定位祖先元素（`position: relative`），否则 handle 会相对于更外层定位元素偏移，不贴在侧边栏边缘。

**具体改动**：
- layout.css `.file-sidebar` 规则：添加 `position: relative`
- layout.css `.toc-sidebar` 规则：添加 `position: relative`

### ISSUE-3: BDD-13 滚动阻止机制描述不精确（INFO）— 已解决

**澄清**：原设计写 "pointer-events: none on content-area" 是不精确的——`pointer-events: none` 阻止点击/悬停事件，但不阻止滚轮/触控板滚动。

**实际机制**：
- flex 布局中，mousemove 事件不直接触发 content-area 的滚动。content-area 的 `overflow-y: auto` 只响应滚轮（wheel）/键盘（PageDown 等）/触控板惯性滚动
- 拖拽期间 `document.body.classList.add('resize-active')` 设置 `user-select: none` + `cursor: col-resize`，视觉上用户感知到"正在拖拽"，不会主动尝试滚动
- 拖拽期间用户手在按住鼠标拖动 handle，物理上无法同时操作滚轮
- 因此无需额外设置 `overflow: hidden` 或 `pointer-events: none`

**P3 测试声明**：BDD-13 的 P3 测试不模拟 wheel 事件——验证拖拽期间 `user-select: none` body class 已添加即可（拖拽期间不选中文字隐含覆盖了"拖拽是独占交互"的语义）。wheel 滚动行为属于浏览器默认行为，非本任务引入的逻辑。

## 实现完成的标志

| 标志 | 验证方式 |
|------|----------|
| scoped 硬编码宽度已移除 | EntryDetailContent.vue 中 grep 不到 `width: 200px` 或 `width: 240px` |
| file-sidebar overflow-y 保留 | layout.css `.file-sidebar` 规则含 `overflow-y: auto`（长文件列表可滚动） |
| aside position: relative 已添加 | layout.css `.file-sidebar`/`.toc-sidebar` 均含 `position: relative`（handle 贴边定位正确） |
| CSS 变量可被 JS 动态修改 | `document.documentElement.style.setProperty('--sidebar-width', '350px')` 后侧边栏宽度变为 350px |
| 拖拽改变宽度 | mouse down → move → up 后侧边栏宽度变化（±2px 误差） |
| min/max clamp 生效 | 拖拽超出边界时宽度固定在 min/max |
| localStorage 持久化 | 拖拽后刷新页面，宽度恢复 |
| 非法 localStorage 值回退 | 手动写入 `"abc"` 后刷新，宽度为默认值 |
| 移动端不显示 handle | viewport <1024px 时 handle display:none |
| zen mode 隐藏 handle | 进入 zen mode 后 handle 随 aside 一起消失 |
| 双击 reset | 双击 handle 后宽度恢复默认值 |
| 拖拽期间文字不被选中 | 拖拽过程中鼠标经过 content-area 不高亮文字 |
| 键盘可聚焦 | Tab 键聚焦 handle 时显示 focus ring |
| 条件渲染联动 | file-sidebar/toc-sidebar v-if=false 时 handle 不渲染 |

[PROD_NOT_TOUCHED]
