---
phase: P4
task_id: T081-resizable-sidebars
type: implementation
parent: P2-design.md
trace_id: T081-P4-20260804
status: draft
created: 2026-08-04
agent: implementer
---

# P4 实现记录：详情页侧边栏可拖拽调整宽度

## implementation_dir

```
frontend-v3/src/
```

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend-v3/src/composables/useSidebarResize.ts` | 新建 | localStorage 持久化 + 拖拽事件链 + rAF 节流 + 双击 reset + cleanup |
| `frontend-v3/src/components/EntryDetailContent.vue` | 修改 | 移除 scoped 硬编码宽度；添加 resize handle 元素；引入 composable |
| `frontend-v3/src/styles/variables.css` | 修改 | 新增 --sidebar-width-min/max, --toc-width-min/max 变量 |
| `frontend-v3/src/styles/layout.css` | 修改 | .file-sidebar 补 overflow-y:auto + position:relative；.toc-sidebar 补 position:relative；新增 .resize-handle 全局样式 + body.resize-active + 移动端/zen-mode 隐藏 |

## 实现细节

### 1. useSidebarResize.ts（新建，111 行）

**配置接口**：
```ts
interface SidebarResizeConfig {
  storageKey: string
  cssVar: string
  defaultPx: number
  minPx: number
  maxPx: number
  side: 'left' | 'right'
}
```

**返回 API**：`{ startDrag, loadWidth, saveWidth, onDoubleClick, cleanup }`

**核心逻辑**：

- `loadWidth()`: localStorage 读取 → Number.isFinite + 范围校验 → 合法值 setProperty + 返回；非法/超范围 → defaultPx setProperty + 返回
- `saveWidth(px)`: clamp(min, max) → localStorage.setItem
- `startDrag(event)`: preventDefault → 记录 startX/startWidth（从 CSS var 读取当前值或 defaultPx） → body.classList.add('resize-active') → document 注册 mousemove/mouseup
- `onMouseMove(e)`: rAF 节流 → delta = clientX - startX → left: startWidth + delta / right: startWidth - delta → clamp → setProperty
- `onMouseUp()`: 移除监听器 → body.classList.remove('resize-active') → saveWidth(当前宽度)
- `onDoubleClick()`: setProperty(defaultPx) → saveWidth(defaultPx)
- `cleanup()`: 设置 cleanedUp=true → 移除监听器 → 移除 body class → cancelAnimationFrame

**cleanup 防重入**：cleanup 后 cleanedUp=true，后续 startDrag 调用直接 return，不注册新监听器（满足 P3 cleanup 测试）

### 2. EntryDetailContent.vue（修改）

**移除**：
- scoped `.file-sidebar { width: 200px; border-right: ...; overflow-y: auto; flex-shrink: 0; }` 整个规则块（ISSUE-1）
- scoped `.toc-sidebar { width: 240px; border-left: ...; overflow-y: auto; flex-shrink: 0; }` 整个规则块（ISSUE-1）

**添加**：
- file-sidebar 内部末尾：`<div class="resize-handle resize-handle-right" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize file sidebar" @mousedown="fileResize.startDrag($event)" @dblclick="fileResize.onDoubleClick()">`
- toc-sidebar 内部开头：`<div class="resize-handle resize-handle-left" ... @mousedown="tocResize.startDrag($event)" @dblclick="tocResize.onDoubleClick()">`
- script: import useSidebarResize，创建 fileResize/tocResize 实例，onMounted 调 loadWidth()，onUnmounted 调 cleanup()

### 3. variables.css（修改）

新增 4 个变量（line 33-36）：
```css
--sidebar-width-min: 160px;
--sidebar-width-max: 500px;
--toc-width-min: 150px;
--toc-width-max: 400px;
```

### 4. layout.css（修改）

- `.file-sidebar`: 补 `overflow-y: auto` + `position: relative`（ISSUE-1 + ISSUE-2）
- `.toc-sidebar`: 补 `position: relative`（ISSUE-2，已有 overflow-y: auto）
- 新增 `.resize-handle` 全局样式：
  - `position: absolute; top: 0; bottom: 0; width: 4px; cursor: col-resize; z-index: 50`
  - `.resize-handle-right { right: -2px }` / `.resize-handle-left { left: -2px }`
  - `:hover, :focus-visible { background: var(--c-accent) }`
  - `:focus-visible { outline: 2px solid var(--c-accent) }`
- `@media (max-width: 1023px) { .resize-handle { display: none } }`
- `body.resize-active { user-select: none; cursor: col-resize }`
- `.zen-mode .resize-handle { display: none }`

## 自查结果

### vitest 单元测试
```
cd frontend-v3 && npx vitest run --reporter=dot src/composables/__tests__/useSidebarResize.spec.ts
→ 14 tests | 14 passed (14)
```

### TypeScript 类型检查
```
cd frontend-v3 && npx vue-tsc --noEmit
→ (no errors)
```

### 硬编码宽度移除验证
```
rg "width: 200px|width: 240px" src/components/EntryDetailContent.vue
→ (no matches)
```

[PROD_NOT_TOUCHED]

## DESIGN_GAP 声明

无。实现完全遵循 P2-design.md 方案设计 + P2-review.md 修订（ISSUE-1/ISSUE-2/ISSUE-3）。

## SCOPE+ 声明

无。实现范围与 P2 声明完全一致。
