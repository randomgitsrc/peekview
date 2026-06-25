---
phase: P2
task_id: T021
task_name: zen-mode
type: design
parent: P1-requirements.md
trace_id: T021-P2-20260625
status: revised
created: 2026-06-25
---

# P2 技术方案 — T021 zen-mode

## 声明字段

```yaml
packages: [frontend-v3]

domains: [frontend]

ui_affected:
  - EntryDetailView.vue: zen 状态 ref + aria 通知 ref + 全局键盘监听 + 焦点重定向 + CSS class 绑定 + tabindex + aria-live span
  - layout.css: zen-mode CSS 规则（.zen-mode 下隐藏 header/sidebar/mobile-actions）
  - P6 E2E 覆盖点:
    - 按 f 进入 zen（header/aside/mobile-actions 不可见，content-area 占满视口）
    - 按 Esc 退出 zen（全部恢复可见）
    - 再按 f toggle 退出
    - 输入框焦点排除（LoginDialog/ConfirmDialog 内不触发）
    - 退出后状态零丢失（FileTree 展开状态、TOC 滚动位置、content-area scrollTop）
    - HtmlViewer iframe 不重载
    - 单文件 entry 进入 zen 无 JS 错误
    - 进入 zen 时焦点在 header 按钮上 → 焦点重定向到 content-area
    - aria-live 区域播报 zen 状态变化

gate_commands:
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P6: "cd frontend-v3 && npx playwright test --reporter=line 2>&1 | tail -30"

env_constraints:
  debug_env: "make debug（127.0.0.1:8888，/tmp/peekview-debug/，PEEKVIEW_DEBUG_MODE=1）"
  isolation_check: "ls /tmp/peekview-debug/peekview.db 存在且 ~/.peekview/peekview.db 无新改动"

files_to_read:
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: 核心改动文件：添加 zen ref、aria 通知 ref、键盘监听、焦点重定向、class 绑定、tabindex、aria-live span
  - path: frontend-v3/src/views/EntryDetailView.vue:1-293
    why: template 区域——需在根 div 添加 :class 绑定 + aria-live span + content-area tabindex
  - path: frontend-v3/src/views/EntryDetailView.vue:295-560
    why: script 区域——添加 zenMode/zenAriaText ref、键盘监听、焦点判断/重定向函数
  - path: frontend-v3/src/styles/layout.css
    why: 添加 .zen-mode CSS 规则
  - path: frontend-v3/src/styles/layout.css:105-121
    why: @media (min-width: 1024px) 规则——zen CSS 需覆盖此处的 display:block/none
  - path: frontend-v3/src/styles/base.css:116-125
    why: .sr-only class 定义——aria-live span 复用此 class
  - path: frontend-v3/src/components/ConfirmDialog.vue
    why: BDD-10 验证：ConfirmDialog 打开时 f 键不触发 zen
  - path: frontend-v3/src/components/HtmlViewer.vue:51-71
    why: iframe 渲染方式确认（:src=renderUrl，非 srcdoc）

minimal_validation:
  assumption: "CSS display:none 切换不触发 iframe 重新加载"
  method: "Playwright 脚本加载含 iframe 的测试页，记录 load 事件次数，toggle display:none 后验证 load 次数不变"
  result: "confirmed"
  note: "测试页 http://127.0.0.1:9876/zen-iframe-test.html，iframe load 事件在 hide/show 前后均为 1 次。CSS display:none 不触发 iframe reload。"
```

## 1. 影响域分析

### 改什么

| 文件 | 改动内容 | 风险 |
|------|----------|------|
| `EntryDetailView.vue` template | 根 div `.entry-detail` 添加 `:class="{ 'zen-mode': zenMode }"` + aria-live sr-only span + `.content-area` 添加 `tabindex="-1"` | 低：纯 class 绑定 + 可访问性属性 |
| `EntryDetailView.vue` script | 添加 `zenMode` ref + `onMounted`/`onUnmounted` 键盘监听 + `shouldHandleZenShortcut` 纯函数 + 焦点重定向逻辑 + aria 通知文本 ref | 低：新增逻辑，不修改现有 |
| `layout.css` | 添加 `.zen-mode` 下隐藏规则 | 低：CSS-only，不影响非 zen 状态 |

### 不改什么

| 文件/组件 | 原因 |
|-----------|------|
| `v-if` 条件（showFileSidebar/showTocSidebar） | zen 模式不改变 v-if 逻辑，用 CSS class 覆盖 |
| HtmlViewer / CodeViewer / MarkdownViewer / ImageViewer | 内容组件不做任何改动 |
| FileTree / TocNav | 侧边栏子组件不做改动 |
| ConfirmDialog / LoginDialog | 对话框组件不做改动 |
| router.ts | 不新增路由 |
| stores/ | 不新增 store |
| backend/ | 纯前端功能 |
| packages/mcp-server/ | 不涉及 |

### 风险点

1. **CSS 优先级**：layout.css 的 `@media (min-width: 1024px)` 给 `.file-sidebar` 和 `.toc-sidebar` 设了 `display: block`，zen-mode CSS 必须用 `!important` 或更高特异性覆盖
2. **mobile-actions 的 v-if**：`v-if="entryStore.currentEntry"` 控制 mobile-actions 是否渲染。若 entry 未加载，mobile-actions 不存在，zen CSS 的 `display:none` 无目标——但这是安全的（不存在的元素无需隐藏）
3. **ConfirmDialog 打开时的焦点**：ConfirmDialog 的取消按钮在打开时自动获得焦点（watch visible → nextTick → focus），此时 `document.activeElement` 在 Teleport 内的按钮上。按钮不是 input/textarea/contenteditable，按 f 会触发 zen——但 BDD-10 要求不触发。需额外判断：当有模态对话框打开时，不触发 zen
4. **焦点丢失风险（B1）**：进入 zen 时若焦点在被隐藏的元素内（header 按钮、侧边栏链接），`display:none` 导致焦点丢失到 body。需焦点重定向（见 §2.4 焦点重定向逻辑）
5. **aria-live 通知（B2）**：zen 状态变化对屏幕阅读器用户不可感知，需 `aria-live` 区域通知（见 §2.1 aria 通知设计）

## 2. 设计方案

### 2.1 zen 状态管理

```typescript
const zenMode = ref(false)
const zenAriaText = ref('')
```

组件级 `ref`，不持久化。生命周期：
- 页面刷新 → 重置为 false
- 路由离开 → 随组件销毁
- slug watch → 保持不变（不重置）

**aria-live 通知（B2）**：`zenAriaText` ref 驱动一个 visually-hidden 的 `aria-live="polite"` 区域，在 zen 状态切换时更新文本，屏幕阅读器自动播报。项目已有 `.sr-only` class（base.css:116），直接复用。

template 中添加（放在根 div 内首位置）：

```html
<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>
```

zen 状态切换时更新通知文本：

```typescript
function updateZenAria(zen: boolean) {
  zenAriaText.value = zen ? 'Zen mode on. Press f or Escape to exit.' : 'Zen mode off.'
}
```

选择 `aria-live="polite"` 而非 `assertive`：zen 模式切换不是紧急警告，`polite` 在屏幕阅读器当前朗读结束后播报，不打断用户。

### 2.2 CSS class 绑定 + tabindex

在根 div 上绑定 zen class，在 `.content-area` 上添加 `tabindex="-1"` 使其可接收 programmatic focus（焦点重定向目标，见 §2.4）：

```html
<div class="entry-detail" :class="{ 'zen-mode': zenMode }">
  <span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>
  ...
  <main class="content-area" tabindex="-1">
  ...
```

`tabindex="-1"` 不将元素加入 Tab 序列（键盘 Tab 不会停在此处），仅允许 `element.focus()` 调用。这是焦点管理的标准模式。

### 2.3 CSS 隐藏规则（layout.css）

在 layout.css 末尾（`@media (min-width: 1024px)` 之后）添加：

```css
/* Zen mode: hide all page chrome, content-area fills viewport */
.zen-mode .detail-header,
.zen-mode .file-sidebar,
.zen-mode .toc-sidebar,
.zen-mode .mobile-actions {
  display: none;
}
```

**特异性分析**：
- `.zen-mode .file-sidebar`（两个 class）特异性 0-2-0
- `@media (min-width: 1024px) .file-sidebar`（一个 class）特异性 0-1-0
- 不加 `!important` 时，`.zen-mode .file-sidebar { display: none }` 的特异性已经高于 `.file-sidebar { display: block }`，可以覆盖
- zen-mode 规则放在 layout.css 末尾（在 `@media (min-width: 1024px)` 之后），特异性 0-2-0 > 0-1-0，且声明顺序在后，足以覆盖
- **决策：不用 `!important`**。避免 `!important` 污染。

**`.zen-mode .mobile-actions` 规则说明（S4）**：当前范围内（桌面端 zen、移动端不触发），此规则永远不会产生视觉差异——移动端无 f 键不触发 zen，桌面端 `@media (min-width: 1024px)` 已将 `.mobile-actions` 设为 `display:none`。保留此规则作为防御性声明：若未来 zen 触发方式扩展（如工具栏按钮），移动端 zen 可立即生效而无需补 CSS。

### 2.4 键盘监听 + 焦点重定向

```typescript
function shouldHandleZenShortcut(event: KeyboardEvent): boolean {
  if (event.key !== 'f' && event.key !== 'F' && event.key !== 'Escape') return false
  if (event.key === 'Escape') return true
  const active = document.activeElement
  if (!active) return true
  const tag = active.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return false
  if (active.isContentEditable || active.getAttribute('contenteditable') === 'true') return false
  if (active.closest('[role="alertdialog"], .confirm-overlay')) return false
  return true
}

function redirectFocusIfHidden() {
  const active = document.activeElement
  if (active && active.closest('.detail-header, .file-sidebar, .toc-sidebar, .mobile-actions')) {
    const contentArea = document.querySelector('.content-area') as HTMLElement | null
    contentArea?.focus()
  }
}

function handleZenKeydown(event: KeyboardEvent) {
  if (!shouldHandleZenShortcut(event)) return
  if (event.key === 'Escape' && zenMode.value) {
    zenMode.value = false
    updateZenAria(false)
    event.preventDefault()
    return
  }
  if (event.key === 'f' || event.key === 'F') {
    zenMode.value = !zenMode.value
    if (zenMode.value) {
      redirectFocusIfHidden()
    }
    updateZenAria(zenMode.value)
    event.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleZenKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleZenKeydown)
})
```

**挂载方式**：直接在 `onMounted`/`onUnmounted` 中添加/移除 `document` 级监听。不抽 composable——逻辑仅 ~30 行，且仅 EntryDetailView 使用，composable 增加间接性无收益。需新增 `onUnmounted` import（当前仅 import `onMounted`）。

**焦点排除逻辑**：
- `document.activeElement` 全局检查（覆盖 Teleport 组件内的输入框）
- 排除 `INPUT`/`TEXTAREA`/`contenteditable`
- 不排除按钮（按钮上按 f 应触发 zen，按钮不接收字母键输入）

**BDD-10 处理**：ConfirmDialog 打开时，`document.activeElement` 是对话框内的 `<button>`（cancelBtn）。按钮不是 input/textarea/contenteditable，按 f 会触发 zen。但 BDD-10 要求不触发。

解决方案：`active.closest('[role="alertdialog"], .confirm-overlay')` 检测焦点是否在模态对话框内。ConfirmDialog 的根 div 有 `role="alertdialog"`，覆盖层有 `.confirm-overlay` class。这种方式：
- 不依赖组件内部 ref（松耦合）
- 自动覆盖未来新增的模态对话框（只要它们用 `role="alertdialog"`）
- LoginDialog 不在 EntryDetailView 中（仅在 EntryListView），不存在 f 键冲突场景

**焦点重定向（B1）**：`redirectFocusIfHidden()` 在进入 zen 时调用。若 `document.activeElement` 在即将被 `display:none` 隐藏的元素内（header 按钮、侧边栏链接等），焦点会丢失到 body。重定向到 `.content-area`（已设 `tabindex="-1"`，见 §2.2），确保焦点不丢失。退出 zen 时无需重定向——被隐藏元素恢复可见后，用户可通过 Tab 自然导航回 header/侧边栏。

**Esc + ConfirmDialog 交互（S3）**：zen 开 + ConfirmDialog 开 → 按 Esc → 退出 zen，ConfirmDialog 仍打开。这是期望行为：BDD-10 仅要求 f 键不触发 zen，未要求 Esc 关闭 ConfirmDialog。ConfirmDialog 没有 `@keydown.escape` 处理，Esc 在此场景下唯一效果是退出 zen，用户仍需点击按钮关闭对话框。

### 2.5 v-if 侧边栏的 CSS 隐藏策略

**核心设计**：zen 模式用 CSS class 强制 `display:none`，不改变 `v-if` 条件。

- 若侧边栏未渲染（`v-if=false`，如单文件 entry 无 file-sidebar），zen CSS 的 `.zen-mode .file-sidebar { display: none }` 无目标元素，无副作用
- 若侧边栏已渲染（`v-if=true`，多文件 entry），zen CSS 强制 `display:none`，侧边栏 DOM 保留，内部状态完整
- 退出 zen 时移除 `.zen-mode` class，侧边栏恢复可见，状态零丢失

**与 layout.css media query 的交互**：
- 桌面端（≥1024px）：`.file-sidebar { display: block }`（media query）→ `.zen-mode .file-sidebar { display: none }`（zen 规则，特异性更高+声明在后）→ 隐藏
- 移动端（<1024px）：`.file-sidebar { display: none }`（默认）→ zen 规则也是 `display: none`→ 无变化
- 退出 zen：移除 `.zen-mode` class → 恢复 media query 控制的原始显示状态

### 2.6 content-area 滚动位置保持

**分析**：
- `.content-area` 自身 `overflow: hidden`，不是滚动容器
- 实际滚动容器：
  - CodeViewer: `.code-body`（`overflow: auto`，code.css:48）
  - MarkdownViewer: `.markdown-viewer`（`overflow: auto`，MarkdownViewer.vue:800）
  - HtmlViewer: iframe 内部（`overflow: auto`，HtmlViewer.vue:307）
- zen 模式隐藏 header 后，`.detail-content`（`flex:1`）获得更多垂直空间，`.content-area`（`flex:1`）自动扩展
- 子滚动容器的 `scrollTop` 是相对于自身的，父容器高度变化不影响 `scrollTop`
- CSS `display:none` 不触发子组件 DOM 重建，scrollTop 保持

**结论**：无需额外保存/恢复 scrollTop。CSS-only 方案天然保持滚动位置。

### 2.7 zen 与 block-fullscreen（T020）的独立性

zen mode 在 `.entry-detail` 根 div 上添加 class，block-fullscreen 在组件内部渲染模态覆盖层。两者：
- 不同的 DOM 层级
- 不同的状态管理（zen 是 EntryDetailView ref，block-fullscreen 是组件内部状态）
- 不同的触发方式（zen 是键盘，block-fullscreen 是按钮点击）
- 可同时激活，互不干扰

### 2.8 drawer 组件处理

移动端 drawer（File Drawer / TOC Drawer）使用 `v-if` + fixed 定位。移动端无法触发 zen（无 f 键），桌面端 drawer 不可见（CSS media query 控制）。无需额外处理。

### 2.9 Edge case 声明

**loading/error/empty 状态下按 f（S1）**：允许触发 zen。此时 `entryStore.currentEntry` 为 null，`mobile-actions` 不渲染（`v-if="entryStore.currentEntry"`），侧边栏不渲染。按 f 进入 zen 后只隐藏 header，content-area 显示 "Loading..." / "Error" / "Entry not found" 占满视口。功能上无害，退出后 header 恢复。zen 是页面级状态，不依赖内容加载完成。

**zen + slug watch 侧边栏可见性（S2）**：多文件 entry A（zen 开，侧边栏 CSS 隐藏）→ 切换到单文件 entry B（zen 仍开，侧边栏 `v-if=false` 不渲染）→ 切换回 entry A（zen 仍开，侧边栏 `v-if=true` 重新渲染，`.zen-mode` class 仍在根 div 上，侧边栏出现即被 CSS 隐藏）。此链路正确，状态零丢失。

**zen 模式下 entry 加载完成瞬间**：loading → loaded 转换时，`mobile-actions` 从不渲染变为渲染（`v-if="entryStore.currentEntry"` 变为 true）。此时 `.zen-mode` class 已在根 div 上，新渲染的 `.mobile-actions` 立即被 CSS 隐藏。正确。

## 3. BDD 验收条件覆盖

| BDD | 方案覆盖 | 实现要点 |
|-----|----------|----------|
| BDD-01 按 f 进入 zen | ✅ | `zenMode = true` → `.zen-mode` class → CSS `display:none` + 焦点重定向 + aria 通知 |
| BDD-02 按 Esc 退出 zen | ✅ | `zenMode = false` → 移除 class → 恢复原始布局 + aria 通知 |
| BDD-03 再按 f toggle 退出 | ✅ | `zenMode = !zenMode` |
| BDD-04 输入框焦点排除 | ✅ | `shouldHandleZenShortcut` 检查 `document.activeElement` tag + contenteditable |
| BDD-05 退出后状态零丢失 | ✅ | CSS-only 隐藏，不销毁 DOM，状态天然保持 |
| BDD-06 content-area 滚动不跳动 | ✅ | scrollTop 相对于子滚动容器，父容器高度变化不影响 |
| BDD-07 HtmlViewer iframe 不重载 | ✅ | minimal_validation 已确认：CSS display:none 不触发 iframe reload |
| BDD-08 非详情页不触发 | ✅ | 键盘监听仅在 EntryDetailView 的 onMounted 注册，组件销毁时移除 |
| BDD-09 zen 与 block-fullscreen 共存 | ✅ | 不同 DOM 层级 + 不同状态，互不干扰 |
| BDD-10 ConfirmDialog 打开时 f 不触发 | ✅ | `active.closest('[role="alertdialog"]')` 检测 |
| BDD-11 单文件 entry 进入 zen | ✅ | v-if=false 的侧边栏无 DOM，zen CSS 无目标，无副作用 |
| — 焦点重定向（B1） | ✅ | `redirectFocusIfHidden()`：进入 zen 时若焦点在被隐藏元素内，重定向到 `.content-area`（tabindex=-1） |
| — aria-live 通知（B2） | ✅ | `zenAriaText` ref + `<span class="sr-only" aria-live="polite">`，进入时播报 "Zen mode on. Press f or Escape to exit."，退出时播报 "Zen mode off." |
| — loading/error/empty 下 zen（S1） | ✅ | 允许触发，仅隐藏 header，功能无害（见 §2.9） |

## 4. 实现计划

### Step 1: layout.css 添加 zen-mode CSS 规则

在 layout.css 末尾（`@media (min-width: 1024px)` 之后）添加：

```css
.zen-mode .detail-header,
.zen-mode .file-sidebar,
.zen-mode .toc-sidebar,
.zen-mode .mobile-actions {
  display: none;
}
```

### Step 2: EntryDetailView.vue 添加 zen 状态和键盘监听

1. template：
   - 根 div 添加 `:class="{ 'zen-mode': zenMode }"`
   - 根 div 内首位置添加 `<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>`
   - `.content-area` 的 `<main>` 添加 `tabindex="-1"`
2. script：
   - 添加 `const zenMode = ref(false)`
   - 添加 `const zenAriaText = ref('')`
   - 添加 `updateZenAria(zen: boolean)` 函数
   - 添加 `shouldHandleZenShortcut(event: KeyboardEvent): boolean` 纯函数
   - 添加 `redirectFocusIfHidden()` 焦点重定向函数
   - 添加 `handleZenKeydown(event: KeyboardEvent)` 处理函数
   - 在 `onMounted` 中注册 `document.addEventListener('keydown', handleZenKeydown)`
   - 在 `onUnmounted` 中移除 `document.removeEventListener('keydown', handleZenKeydown)`
   - 新增 `onUnmounted` import

### Step 3: P3 单元测试

`shouldHandleZenShortcut` 纯函数测试：
- f 键 + body 焦点 → true
- f 键 + input 焦点 → false
- f 键 + textarea 焦点 → false
- f 键 + contenteditable 焦点 → false
- f 键 + button 焦点 → true
- f 键 + alertdialog 内焦点 → false
- Esc 键 → true（无论焦点）
- 非 zen 状态下按 Esc → zenMode 不变（无副作用）
- 其他键 → false

`redirectFocusIfHidden` 测试：
- 焦点在 header 内 → 进入 zen 后焦点移到 .content-area
- 焦点在 .content-area 内 → 进入 zen 后焦点不动
- 焦点在 body → 进入 zen 后焦点不动

## 5. 完成标志

- [ ] `.zen-mode` class 在 layout.css 中定义，覆盖 `@media (min-width: 1024px)` 的 display 规则
- [ ] EntryDetailView 根 div 绑定 `:class="{ 'zen-mode': zenMode }"`
- [ ] `.content-area` 的 `<main>` 添加 `tabindex="-1"`
- [ ] `zenMode` ref 存在，初始值 false
- [ ] `zenAriaText` ref 存在，`<span class="sr-only" aria-live="polite">` 在 template 中
- [ ] `updateZenAria()` 在 zen 切换时被调用
- [ ] `shouldHandleZenShortcut` 纯函数存在，覆盖 input/textarea/contenteditable/alertdialog 排除
- [ ] `redirectFocusIfHidden` 在进入 zen 时调用，焦点在被隐藏元素内时重定向到 .content-area
- [ ] `onMounted` 注册 keydown 监听，`onUnmounted` 移除
- [ ] 按 f → zenMode toggle + 焦点重定向 + aria 通知，按 Esc → zenMode = false + aria 通知
- [ ] vitest 单元测试全绿
- [ ] Playwright E2E 验收全绿
