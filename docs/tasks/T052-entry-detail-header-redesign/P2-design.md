---
phase: P2
task_id: T052-entry-detail-header-redesign
type: design
parent: P1-requirements.md
trace_id: T052-P2-20260710
status: draft
created: 2026-07-10
agent: architect
---

# P2 方案设计：Entry Detail Header 重新设计

## 1. 设计决策

### 1.1 Desktop 2-row layout（.title-row + .meta-row）

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: Pure flexbox（推荐）** | 与现有 `layout.css` 完全一致（`.detail-header` 已用 `display:flex`）；flex-gap 控制间距；meta-row 用 `padding-left: 38px` 对齐 title 文字基线 | 需要新增 `.title-row` 和 `.meta-row` 两个 flex container |
| B: CSS Grid | 2D 布局精确控制行和列；gap 统一 | 新引入 grid 模式增加学习成本；与现有 flex 体系不一致；meta-row 对齐需要额外 grid-template-columns 计算 |

**选择：A**。现有 `.detail-header` 已用 `display: flex`（layout.css:10-22），`header-right` 也是 flex column。扩展为 `.title-row { display: flex; align-items: center }` + `.meta-row { display: flex; align-items: center; padding-left: 38px }` 与现有模式一致。

**具体替换**：
- 现有 template 中 `<header class="detail-header">` 内的 logo + title-group + header-right 整体 → 包在 `<div class="title-row">` 内
- 现有 `header-meta-row`（line 17-48）移到 header 内独立 `<div class="meta-row">`
- `header-right` 不再需要（它的内容拆解到 title-row 的 actions-area 和 meta-row）
- `variables.css` 新增 `--header-height-desktop: 52px`（原 56px 不变用于 mobile sticky）

### 1.2 Toggle buttons（Files/TOC）→ sidebar 交互

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: PUSH layout（推荐）** | 与现有 layout.css 的 `.detail-content { display: flex }` + `.file-sidebar`/`.toc-sidebar` flex children 完全一致；`v-if` 切换无需 z-index/absolute；Files+TOC 可同时打开，content 在中间自适应 | 内容区宽度随 sidebar 开/关跳变 180px/240px |
| B: OVERLAY（absolute） | 内容区不 reflow，阅读无跳变 | 需要 `position: absolute; z-index;` 覆盖层；与现有 flex layout 冲突需大量重写；同时开 Files+TOC 需要处理两层 overlay 堆叠 |
| C: 混合（Files=push, TOC=overlay） | 兼顾文件导航持久性和目录临时性 | 两种交互模型增加维护成本；用户困惑为何左右 sidebar 行为不同 |

**选择：A**。PUSH 与现有代码架构一致（`layout.css:53-57`），最小化改动。180px shift 在 scrollable 内容区中可接受（已验证：`/tmp/sidebar-validation.html`）。

**实现**：
- 新增 `isFileTreeOpen = ref(false)` + `isTocOpen = ref(false)`（在 template script 中）
- 替换现有 `showFileSidebar` computed（line 552-554）为 `v-if="isFileTreeOpen && isMultiFile"`
- 替换现有 `showTocSidebar` computed（line 556-558）为 `v-if="isTocOpen && isMarkdown && tocHeadings.length > 0"`
- Files toggle 按钮 → `@click="isFileTreeOpen = !isFileTreeOpen"`，active class 绑定
- TOC toggle 按钮 → 同 pattern
- 两点同时打开时，content 仍然 flex:1 自适应（已验证 flex-grow 行为正确）

### 1.3 OverflowMenu dual-mode（dropdown + bottom sheet）

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: variant prop + v-if/v-else（推荐）** | 同一组件共享 items+逻辑，template 中 `<template v-if="variant==='dropdown'">` / `<template v-else>`；CSS 分两组 | template 略长但逻辑集中 |
| B: 抽离 shared rendering 组件 | 复用 item rendering | 小组件过度抽象，增加文件数 |

**选择：A**。OverflowMenu.vue 当前 182 行，加上 bottom sheet 后约 ~350 行，仍然可维护。

**接口变更**（`OverflowMenuItem`）：
```typescript
export interface OverflowMenuItem {
  label: string
  icon?: string           // Lucide icon name (e.g., 'moon', 'sun', 'globe')
  hint?: string           // right-aligned hint text (e.g., 'Tap to toggle', 'Currently Public')
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  divider?: boolean       // render a divider BEFORE this item
  action?: () => void
}
```

**variant prop**：
```typescript
defineProps<{
  items: OverflowMenuItem[]
  variant?: 'dropdown' | 'sheet'  // default: 'dropdown'
}>()
```

**Dropdown 变化**（P1 D16）：
- 定位从 `bottom: 100%` → `top: 100%`（DESIGN-SPEC §2.4：More▾ 按钮下方展开）
- 从 hover 打开改为 click toggle（当前已用 click）

**Sheet 实现**：
- Vue `<Teleport to="body">` 渲染
- `position: fixed; bottom: 0; left: 0; right: 0; z-index: 101`
- 包含 backdrop overlay（半透明，点击关闭）
- 圆角 16px 顶部 + drag handle 横条
- 分组 divider：Display / Owner / Common / Danger
- 需要 `safe-area-inset-bottom`

### 1.4 Mobile bottom bar 动态切换

**方案**：直接在 `EntryDetailView.vue` template 中用 v-if/v-else-if 条件链。

```html
<!-- bottom-bar: 48px, layout: [Files(N)] [flex:1] [dynamic buttons] [...] -->
<div class="mobile-bottom-bar">
  <!-- Files button -->
  <button v-if="isMultiFile" class="files-btn" @click="showFileDrawer = true">
    <FolderIcon /> Files <span class="badge">{{ currentEntry.files.length }}</span>
  </button>
  <div class="flex-spacer"></div>

  <!-- .md: [TOC] [...] -->
  <template v-if="isMarkdown && tocHeadings.length > 0">
    <button class="bottom-btn primary" @click="showTocDrawer = true">TOC</button>
  </template>

  <!-- text/code: [Wrap] [Copy] [...] -->
  <template v-else-if="!isBinary">
    <button v-if="canWrap" :class="['bottom-btn', wrapEnabled && 'primary']" @click="toggleWrap">Wrap</button>
    <button v-if="canCopy" class="bottom-btn primary" @click="copyContent">Copy</button>
  </template>

  <!-- binary: [...] only (no buttons besides overflow) -->
  <!-- overflow ellipsis -->
  <OverflowMenu :items="overflowItems" variant="sheet" />
</div>
```

**条件链**：
- `isMarkdown && tocHeadings.length > 0` → show TOC（primary）+ overflow
- `!isMarkdown && !isBinary` → show Wrap（if canWrap）+ Copy（primary, if canCopy）+ overflow
- `isBinary` → only overflow

**Files 按钮**：`isMultiFile` 控制显示（非 multi-file 不显示，与当前行为一致）。

**"[...]" overflow**：始终显示，作为 `OverflowMenu` trigger。

### 1.5 Mobile sticky header

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: 新 `.mobile-sticky-header` 元素 + media query show/hide（推荐）** | 与现有 `.detail-header` 干净分离；mobile header 内容简单（back + truncated title）；scoped CSS 独立 | 新增一个 DOM 元素 |
| B: 在 `.detail-header` 上用 media query 重写内容 | 复用 sticky positioning | media query 要 overwrite 大量现有样式，容易混乱 |

**选择：A**。

```html
<div class="mobile-sticky-header">
  <router-link to="/" class="back-btn"><ChevronLeftIcon /></router-link>
  <span class="sticky-title">{{ entryTitle }}</span>
</div>
```

- `position: sticky; top: 0; z-index: 10; height: 52px`
- `background: rgba(18, 24, 34, .88); backdrop-filter: blur(16px)`
- `display: none` at >= 1024px
- `.detail-header` 在 mobile 变为非 sticky（移除 current `position: sticky` via media query override）
- `.detail-logo` 在 mobile 隐藏

### 1.6 Meta-tags-bar scroll-hide

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: Intersection Observer（推荐）** | 性能好，无 scroll event 开销；逻辑清晰（observe sentinel 元素） | 需创建 sentinel 元素；兼容性（>= Chrome 58，已足够） |
| B: 保持现有 scroll event + RAF 模式 | 已有实现可复用 | 当前绑定在 `.markdown-viewer` 上，需要改为绑定 window；RAF 在 Safari 有精度问题 |

**选择：A**。新增一个 sentinel div 放在 `.meta-tags-bar` 上方，Intersection Observer 观察此 sentinel 是否离开视口。

```typescript
const metaTagsSentinel = ref<HTMLElement>()
const metaTagsHidden = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => { metaTagsHidden.value = !entry.isIntersecting },
    { threshold: 0 }
  )
  if (metaTagsSentinel.value) observer.observe(metaTagsSentinel.value)
  // cleanup in onUnmounted
})
```

CSS：`.meta-tags-bar { transition: opacity 0.3s; }` `.meta-tags-bar.hidden { opacity: 0; }`

### 1.7 ThemeToggle dual-render

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: ThemeToggle 保持 icon-only，mobile overflow 内联调用 theme store（推荐）** | ThemeToggle 组件不改结构（只换 SVGs）；mobile overflow item 自然复用 item rendering 管道 | ThemeToggle 不需要 variant prop |
| B: ThemeToggle 增加 variant prop | 组件自包含 | 增加复杂度；mobile 中 render 为 list item 需要完全不同的 HTML/CSS |

**选择：A**。ThemeToggle.vue 只做 emoji → Lucide SVG 替换。Mobile overflow 中的 Dark theme 切换以 `OverflowMenuItem` 形式呈现，直接在 overflowItems computed 中 push 一个调用 theme store toggle 的 item。

```typescript
// in overflowItems computed
items.push({
  label: 'Dark theme',
  icon: theme === 'dark' ? 'sun' : 'moon',
  hint: 'Tap to toggle',
  action: () => themeStore.toggle(),
})
```

Desktop 行中的 ThemeToggle 保持 standalone `<ThemeToggle />` 在 `.title-row` 最右侧（`actions-area` 内）。

### 1.8 Lucide SVG 策略

### 候选方案

| 候选方案 | 优点 | 风险/工作量 |
|---------|------|------------|
| **A: 安装 `lucide-vue-next`（推荐）** | 遵循 DESIGN.md §7 约定；icon name 对应清晰；tree-shaking | 需 `npm install lucide-vue-next`；包大小控制（tree-shaking 后 ~30KB） |
| B: inline SVG 组件 | 零依赖；完全控制 path | 每个 icon 要手动写 component；15+ 个 icon 重复劳动；和 DESIGN.md 标准冲突 |

**选择：A**。DESIGN.md §7 明确约定 `lucide-vue-next`。P4 implementer 需先 `npm install lucide-vue-next`。需要的 icons（约 15 个）：folder, list, copy, share-2, download, package, file-text, trash-2, moon, sun, globe, more-horizontal, chevron-down, chevron-left, x。

### 1.9 Meta 行时间格式（NC1）

**方案**：沿用相对时间（"3h ago"），DESIGN-SPEC 与 P0-brief 的 `profile example` 一致。NC1 确认方向：相对时间保持，与现有 `useRelativeTime` composable 一致。

### 1.10 Desktop Copy 按钮始终显示？（NC4）

**方案**：保留条件显示——仅 `canCopy` 时显示（非 binary 文件）。产品逻辑不变，只是从 labeled button 改为 icon-only。

### 1.11 响应式断点（D13）

**方案**：< 768px = mobile layout（sticky header + bottom bar + content meta-tags-bar），>= 768px = tablet/desktop layout（2-row header）。当前 border 在 768px（layout.css:800, 1074），保持统一。

---

## 2. 四字段

```yaml
packages:
  - peekview      # 仅前端 bundled in PyPI
  # 注意：MCP 不涉及，无 npm 包
domains:
  - frontend      # Vue components + CSS + stores
ui_affected: true
  interaction_points:
    - "[Desktop] title-row toggle buttons → sidebar push open/close"
    - "[Desktop] More▾ overflow toggle → dropdown menu"
    - "[Mobile] bottom bar [...] → bottom sheet with backdrop"
    - "[Mobile] bottom bar dynamic button re-rendering on file type change"
    - "[Mobile] meta-tags-bar scroll-hide via Intersection Observer"
    - "[Mobile] sticky header (52px, backdrop-filter)"
    - "[Both] ThemeToggle emoji → Lucide SVG"
    - "[Both] OverflowMenu dual-mode (dropdown/sheet)"
gate_commands:
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot"
  P5_e2e: "cd frontend-v3 && npx playwright test e2e/ --reporter=line"
  P6: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
```

---

## 3. files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/views/EntryDetailView.vue:1-274
    why: 当前 template（header + mobile-actions + drawers）及 script 中 overflowItems computed、sidebar computed、scroll 逻辑
  - path: frontend-v3/src/views/EntryDetailView.vue:796-1070
    why: scoped CSS（header、mobile-actions、meta-row、actions-row 全部需要重写或移除）
  - path: frontend-v3/src/components/OverflowMenu.vue
    why: 完整重写——dual-mode 支持、icon/hint/divider 接口变更、dropdown 方向变更
  - path: frontend-v3/src/components/ThemeToggle.vue
    why: emoji → Lucide SVG icon 替换
  - path: frontend-v3/src/styles/layout.css:123-162
    why: drawer 样式（复用 mobile drawer），sidebar 样式（复用 desktop push layout）
  - path: frontend-v3/src/styles/layout.css:53-121
    why: 当前 .detail-content / .file-sidebar / .toc-sidebar / .mobile-actions 布局定义
  - path: frontend-v3/src/styles/variables.css
    why: CSS token 确认（--header-height 是否需改、是否需要新增 desktop header height token）
  - path: frontend-v3/src/stores/entry.ts:26-50
    why: isMultiFile / canWrap / canCopy / canDownload / canPack 计算属性确认
  - path: frontend-v3/src/__tests__/header-layout.test.ts
    why: 现有 test 全需重写
```

---

## 4. minimal_validation

```yaml
minimal_validation:
  assumption: "Desktop sidebar push layout（v-if 控制 sidebar 显隐）对内容区宽度跳变的用户体验可接受"
  method: "10 行 HTML 测试页（/tmp/sidebar-validation.html）对比 PUSH vs OVERLAY 两种交互模型"
  result: "confirmed"
  note: >
    PUSH 验证通过：180px sidebar shift 在 scrollable 内容区中可接受，
    与现有 layout.css 的 flex 模式一致，无 z-index/absolute 复杂度。
    Files+TOC 同时打开时 content 仍 flex:1 自适应（已验证）。
    OVERLAY 会隐藏内容（不推荐），保留给 mobile drawer 模式。
```

---

## 5. env_constraints

```yaml
env_constraints:
  debug_env: "make debug（:8888 隔离数据 /tmp/peekview-debug/），前端测试 cd frontend-v3 && ./node_modules/.bin/vitest run，typecheck: cd frontend-v3 && npx vue-tsc --noEmit"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'（生产 :8080 离线时手动验证）"
  note: "P0-brief 约束已确认并细化。lucide-vue-next 需 npm install（package.json 当前无此 dep）"
```

---

## 6. [SCOPE+] 发现

**[SCOPE+] 需要安装 lucide-vue-next**：
- **P1 未覆盖**：DESIGN.md §7 约定用 `lucide-vue-next`（332-338），但 `package.json:11-24` 无此依赖。
- **必须做的理由**：15+ 个 icon 需要统一图标库管理，inline SVG 手工编写不可维护且违反 DESIGN.md 约定。
- **影响**：P4 需先 `npm install lucide-vue-next`。如果 install 失败或增加包体积过大，fallback 是 inline SVG 组件（方案 B），需标记 [DESIGN_GAP] 通知 P2。
- **涉及的 icon list**：文件夹(folder)、列表(list)、复制(copy)、分享(share-2)、下载(download)、打包(package)、原始文件(file-text)、删除(trash-2)、月亮(moon)、太阳(sun)、地球(globe)、更多(more-horizontal)、向下箭头(chevron-down)、向左箭头(chevron-left)、关闭(x)

**[SCOPE+] 现有 header-layout.test.ts 全部作废**：
- **P1 未覆盖**：P1 有 D12 但未列具体测试文件。
- **必须做的理由**：TC-D07 断言 `actions` 包含 `visibility/share/delete/wrap/copy` 五个 labeled button——新设计只有 Copy/Share 在桌面 title-row 作为 icon button，Visibility 移入 overflow。
- **影响**：P3 测试设计师需重写此文件（或删除后用 P3 新测试覆盖）。

---

## 7. 完成标准

- [ ] Desktop 2-row header（.title-row + .meta-row）高度 ≤ 80px
- [ ] icon-only 按钮 32×32，tooltip 悬停提示
- [ ] Files/TOC toggle 按钮条件显示 + active 态高亮 + v-if 控制 sidebar push
- [ ] Desktop sidebar PUSH 交互：两个 sidebar 可分别 Open/Close，也可同时打开
- [ ] More▾ dropdown 收纳正确操作列表（按 owner/guest 角色区分）
- [ ] Meta 行竖线分隔两组信息
- [ ] 移动端 sticky header 52px 毛玻璃（backdrop-filter）
- [ ] 移动端 meta-tags-bar Intersection Observer 隐藏
- [ ] 移动端底部栏 48px，布局 [Files(N)] [flex] [动态按钮] [...]
- [ ] 底部栏按文件类型动态变化（md/code/binary 三态）
- [ ] OverflowMenu dual-mode：desktop=dropdown（top:100%），mobile=bottom sheet（backdrop + drag handle + 圆角顶）
- [ ] OverflowMenuItem 接口包含 icon（Lucide name）、hint、divider
- [ ] ThemeToggle emoji → Lucide SVG，mobile 在 overflow sheet 中
- [ ] 无 emoji icon 残留
- [ ] `lucide-vue-next` 安装且 tree-shaking 生效
- [ ] `vue-tsc --noEmit` 通过
- [ ] `vitest run` 通过（header-layout.test.ts 已更新或替换）
