# Diagram 组件重构设计 spec

- 创建：2026-06-27
- 状态：draft
- 优先级：🟠 近期
- 版本目标：v0.3.0
- 行为基线：v0.2.3（= v0.1.67 diagram 代码，已验证功能正常）

## 1. 背景与目标

T022 尝试将 3 个独立 diagram 组件（MermaidDiagram / PlantUmlDiagram / SvgDiagram）重构为 BaseDiagram + 薄包装架构，但 P4 执行遗漏 3 个系统性缺陷（CSS 全未迁移、双重 DOM 嵌套、双重状态管理），导致功能全面损坏。T022 已回退到 v0.1.67（发布为 v0.2.3）。

本次重做采用不同策略：Vue 响应式渲染 + 注册表 + composable。

**两个目标**：
1. **去重**：3 套 ×120 行 scoped CSS + 大量重复 script → 一套统一规则 + composable。预期 4021 行 → ~1500 行（-63%）
2. **扩展性**：加新 diagram 类型（如 graphviz、d2）只需写渲染器 + 注册表加一行

**硬约束**：行为零变更。v0.2.3 的所有用户可见行为必须 100% 保真。

## 2. 架构决策（7 项）

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 核心驱动力 | 去重 + 扩展性（D） | 3 套组件 ×120 行 CSS 重复 + 加新类型要改 4 处 |
| 2 | 风险容忍度 | 保守（A） | T022 教训：重构不应改行为 |
| 3 | 事件委托 | 改成 Vue 响应式（B1） | 事件委托是技术债，两套状态管理系统（DOM class + Vue）是 bug 源头。diagram 部分改成 Vue 响应式，非 diagram 代码块保留事件委托 |
| 4 | 注册表 | composable（B） | ~~`useDiagramRegistry()` 返回 lang→配置映射~~ **（第二轮评审修订为 v-if/v-else-if，见 §3「注册表设计决策」）** |
| 5 | DOM 结构 | 简化嵌套（B） | 5 层→3 层：`.diagram-block > .diagram-header + .diagram-viewer + .diagram-code` |
| 6 | 组件结构 | 外壳+渲染器（B） | DiagramBlock 管 header/toggle/fullscreen/menu/code（公共），渲染器管 SVG 渲染+pan-zoom（差异） |
| 7 | CSS | 统一 `diagram-*` class | 非 scoped 共享 CSS，用逗号选择器去重。从 3×120 行 → 1×120 行 |

## 3. 新架构

```
useMarkdown.ts（重写 render 逻辑）
  ↓ 返回结构化 blocks
  blocks: [
    { type: 'text', html: '<p>...' },
    { type: 'code', lang: 'python', html: '<pre>...', copyCode: '...' },
    { type: 'diagram', lang: 'mermaid', code: '...', codeViewHtml: '<pre><code class="hljs language-mermaid">...</code></pre>' },
    { type: 'diagram', lang: 'plantuml', code: '...', codeViewHtml: '<pre><code>...</code></pre>' },
    { type: 'diagram', lang: 'svg', code: '...', codeViewHtml: '<pre><code class="hljs language-xml">...</code></pre>' },
  ]
  注意：
  - code 块保留事件委托（只有 copy button），diagram 块完全 Vue 响应式
  - codeViewHtml 包含完整的 <pre><code> wrapper，DiagramBlock code 模式直接 v-html 渲染
  - Mermaid/PlantUML 的 codeViewHtml 用 escapeHtml()，SVG 的用 highlightCode(code, 'xml', theme)
  - 与 v0.2.3 一致：useMarkdown 在 render() 时生成 codeViewHtml，渲染器不参与生成

MarkdownViewer.vue（简化渲染）
  v-for block:
    text → v-html
    code → v-html（保留事件委托处理 copy）
    diagram → <DiagramBlock :block="block" />

DiagramBlock.vue（外壳，~200行）
  props: block (diagram block 对象，含 type/lang/code/codeViewHtml)
  管理：header 按钮 / toggle Diagram↔Code / dropdown menu / resize handle / code 模式
  通过 v-if/v-else-if 选择渲染器（而非注册表动态组件）：
    <MermaidRenderer v-if="block.lang === 'mermaid'" :code="block.code" :theme="theme" ref="rendererRef" />
    <PlantUmlRenderer v-else-if="block.lang === 'plantuml'" :code="block.code" :theme="theme" ref="rendererRef" />
    <SvgRenderer v-else-if="block.lang === 'svg'" :code="block.code" :theme="theme" ref="rendererRef" />
  通过 rendererRef.value.openFullscreen() / .refresh() / .exportPng() 调用渲染器方法
  CSS: diagram-* 统一规则（非 scoped，所有规则以 .diagram-block 为根前缀）

渲染器（各 ~100-150行）：
  通用 props: code (原始 diagram 源码), theme (当前主题)
  MermaidRenderer.vue — mermaid render + pan-zoom + touch + resize + fullscreen modal
  PlantUmlRenderer.vue — plantuml server render + pan-zoom + fullscreen modal（无 touch 无 resize）
  SvgRenderer.vue — DOMPurify sanitize + pan-zoom + touch + resize + try-catch + fullscreen modal
  注意：
  - fullscreen modal 在渲染器内（modal 内含 SVG + 独立 pan-zoom 实例），与 v0.2.3 架构一致
  - 渲染器通过 defineExpose 暴露：openFullscreen / closeFullscreen / refresh / exportPng
  - 渲染器持有 code prop 使 PNG 下载可重新 mermaid.render/plantuml.render 获取干净 SVG（与 v0.2.3 一致）

useDiagramViewer.ts（~150行）
  composable：pan-zoom init / destroy / refresh / wheel / touch / resize
  被 3 个渲染器调用，参数化 maxZoom / minZoom 等
```

### 注册表设计决策：不使用 useDiagramRegistry

第二轮评审指出 useDiagramRegistry 是过度工程：
- PeekView 的 diagram 类型是编译时确定的（mermaid/plantuml/svg），无需运行时动态注册
- 三种类型的**行为差异巨大**（Mermaid 有缓存+重新render PNG+`<br>` fix，PlantUML 有串行约束+ensureLoaded+错误切 code，SVG 有 DOMPurify+透明 PNG+try-catch pan-zoom），flag 列表膨胀成巨型 config 对象后反而不如各自封装
- DiagramBlock 用 `v-if/v-else-if` 选择渲染器，加新类型时改 DiagramBlock 加一个 `v-else-if` + 写渲染器，比"注册表加一行"多改一处，但避免了 flag 膨胀和类型系统模拟

公共行为差异由 DiagramBlock 内部根据 `block.lang` 分支处理（toggle 文字变化、dropdown close-others 等），渲染器各自封装特有逻辑。

### 3.5 关键风险对策（第二轮评审 5 个高风险 + 2 个中风险）

第二轮目标导向评审发现 5 个高风险遗漏，必须在实现前明确方案，否则 P6 验收大概率发现行为偏差。

#### R1. mermaidCache 归属 — 🔴 高风险

**现状（v0.2.3）**：`mermaidCache` 是 MarkdownViewer 的模块级 `Map<string, string>`，key 为 `${theme}-${code}`。同主题+同代码不重复 `mermaid.render()`，主题切换时 cache key 变化自动失效。

**风险**：spec 未指定 v0.3.0 的 cache 归属。若放在 MermaidRenderer 实例内，每个 block 独立——同一 mermaid 代码出现两次时重复渲染（v0.2.3 不会），且主题切换后 MermaidRenderer 重新 mount 时 cache 丢失。

**对策**：`mermaidCache` 保留为**模块级 Map**（在 `MermaidRenderer.vue` 顶部或独立 `mermaid-cache.ts`），与 v0.2.3 语义一致。
- key: `${theme}-${code}`，value: 渲染后的 SVG string
- 生命周期：模块级，跨 block 共享，跨主题切换（不同 theme 不同 key 自然隔离）
- 清理：主题切换不需要显式清空（不同 theme 产生不同 key，旧 theme 的 entry 变成 dead memory 但量级可控；可选在 `MermaidRenderer` 模块卸载时清空，但 SPA 中模块不会卸载）
- 行为保真：第 67 条"Mermaid 渲染缓存"——同 theme+code 命中缓存跳过 render

#### R2. renderToken 竞态控制 — 🔴 高风险

**现状（v0.2.3）**：MarkdownViewer 持有单调递增 `renderToken`，每次 `renderContent()` 自增并捕获当前 token。异步 render 完成后比对 token，不匹配则丢弃结果。防止 `content` prop 快速变化时旧 render 覆盖新 render。

**风险**：v0.3.0 各渲染器独立，无全局 renderToken。若 MarkdownViewer 的 `content` prop 快速变化触发 `useMarkdown.render()` 重跑，blocks 更新导致 Vue 销毁旧 DiagramBlock/渲染器、创建新的。但旧渲染器的 `onMounted` 里的异步 `mermaid.render()`/`plantuml.render()` 可能还在执行——结果不会显示（组件已销毁），但可能造成 **mermaid ID 冲突**（多次 `mermaid.render('mermaid-0', code)` 同时执行）。

**对策**：渲染器内用 `onUnmounted` 设置 `cancelled` flag，异步操作完成时检查 flag：
```ts
// MermaidRenderer.vue
const cancelled = ref(false)
onUnmounted(() => { cancelled.value = true })
onMounted(async () => {
  const svg = await renderMermaid(code, theme)  // 走 mermaidCache，命中则同步
  if (cancelled.value) return  // 组件已销毁，丢弃结果
  svgContent.value = svg
})
```
- 同时 MermaidRenderer 用 `crypto.randomUUID()` 生成 render ID（而非 index），避免多实例 mermaid ID 冲突
- PlantUmlRenderer 同理：`onUnmounted` 设 flag，render 完成检查；`plantuml.js` 的模块级 `renderQueue` 保证串行，flag 保证销毁组件不接收结果
- behavior 保真：v0.2.3 的 renderToken 是 MarkdownViewer 级别的整体防抖；v0.3.0 改为渲染器级别的取消——功能等价（旧 render 结果不会显示），机制不同但行为一致

#### R3. Mermaid/PlantUML PNG 下载的重新 render 数据流 — 🔴 高风险

**现状（v0.2.3）**：PNG 下载时 MarkdownViewer 调 `mermaid.render('export-${blockId}', code)` 用**原始代码**重新渲染，获取未被 pan-zoom 修改的干净 SVG。PlantUML 同理调 `usePlantUML.render(code, theme)`。

**风险**：若 MermaidRenderer 只收到 `svgContent`（已渲染 SVG string），无法重新 render——因为：(a) 没有原始 mermaid 代码，(b) SVG DOM 已被 pan-zoom 修改（width/height 被移除、style 被改）。

**对策**：渲染器 props 包含 `code`（原始 diagram 源码），在 §3 架构中已明确：
```
<MermaidRenderer :code="block.code" :theme="theme" ref="rendererRef" />
```
- `exportPng()` 时：MermaidRenderer 调 `mermaid.render('export-${uuid}', props.code)` 重新渲染拿干净 SVG（与 v0.2.3 一致）
- PlantUmlRenderer 的 `exportPng()` 调 `usePlantUML.render(props.code, props.theme)` 重新渲染
- SvgRenderer 的 `exportPng()` 直接用 `props.code`（原始 SVG，未经 pan-zoom 修改）——v0.2.3 也是直接用原始 SVG
- 行为保真：第 53/54/55 条 PNG 下载（Mermaid/PlantUML 白底重新 render，SVG 透明直接用原 SVG）

#### R4. PlantUML 并发 mount 安全 — 🔴 高风险

**现状（v0.2.3）**：`renderPlantUmlDiagrams` 顺序 for 循环，配合 `usePlantUML.render` 内部模块级 `renderQueue` Promise 链保证串行。`ensureLoaded()` 在循环前调一次（模块级 `loadPromise` 单例）。

**风险**：v0.3.0 的 PlantUmlRenderer 在 `v-for` 中同时 mount，各自 `onMounted` 并发调 `usePlantUML.render()`。模块级 `renderQueue` 仍保证串行执行，但：(a) 旧 render 完成时组件可能已销毁，结果写入已销毁组件；(b) `ensureLoaded()` 并发调用虽安全（模块级单例），但需确认。

**对策**：
- `ensureLoaded()`：模块级 `loadPromise` 单例保证只执行一次加载——v0.2.3 已有此机制，v0.3.0 保持，PlantUmlRenderer `onMounted` 先 `await ensureLoaded()` 再 render
- 组件销毁防护：与 R2 共用 `cancelled` flag 机制。`render()` 返回的 Promise resolve 后检查 `cancelled.value`，若已销毁则不更新 DOM
- `renderQueue` 串行保证：`plantuml.js` 的模块级 `renderQueue` 不变，v0.3.0 各 PlantUmlRenderer 调 `usePlantUML.render()` 自动排队串行
- 行为保真：PlantUML 串行渲染约束（第 65 条）——并发 mount 时 render 仍串行执行

#### R5. CSS `!important` 交互 + modal Teleport 脱离 `.diagram-block` — 🔴 高风险

**现状（v0.2.3）**：scoped CSS 的 `[data-v-xxx]` 属性提供特异性保护，不受全局 `!important` 和注入顺序影响。fullscreen modal 用 `Teleport to body`，modal 内容在 body 下，脱离 scoped 作用域——但 v0.2.3 的 modal CSS 也在组件 scoped 内，靠 `[data-v-xxx]` 作用域。

**风险**：
1. MarkdownViewer 有 ~20 条 `!important` 规则（如 `.markdown-body pre * { background-color: transparent !important }`），非 scoped CSS 无法用特异性压过 `!important`——会穿透到 diagram 的 modal/code 区域
2. fullscreen modal 用 `Teleport to body` 后，modal 内的 `.diagram-toolbar-btn` 等元素**脱离了 `.diagram-block` 前缀作用域**——`.diagram-block .diagram-toolbar-btn` 选择器匹配不到 modal 内的元素

**对策**：
1. **`!important` 审计**：实现前 grep MarkdownViewer 所有 `!important` 规则，逐条判断是否影响 diagram 区域：
   - 影响的：在 DiagramBlock CSS 里加等价 `!important` 反制（如 `.diagram-block pre * { background-color: transparent !important }`），或确认 diagram 区域不包含匹配元素
   - 不影响的：忽略
   - 这份审计结果作为 P4 实现的前置输入，列入实现计划 checklist
2. **modal CSS 双前缀**：modal 内元素用 `.diagram-modal` 前缀（而非依赖 `.diagram-block`）：
   ```css
   .diagram-modal { position:fixed; inset:0; ... }
   .diagram-modal .diagram-modal-title { ... }
   .diagram-modal .diagram-toolbar-btn { ... }
   ```
   - modal 的根元素加 `class="diagram-modal"`，所有子元素规则以 `.diagram-modal` 为前缀
   - 与 `.diagram-block` 前缀的规则**互不依赖**——modal Teleport 到 body 后仍能匹配
   - 共享样式（如 `.diagram-toolbar-btn` 的基础外观）在 DiagramBlock 非 scoped CSS 里写两条：一条 `.diagram-block .diagram-toolbar-btn`，一条 `.diagram-modal .diagram-toolbar-btn`，或用选择器列表 `.diagram-block .diagram-toolbar-btn, .diagram-modal .diagram-toolbar-btn`
3. **注入顺序**：v0.3.0 的 `.diagram-block .diagram-viewer svg`（0,2,1）vs 全局 `.markdown-body .mermaid svg`（0,2,1）——同特异性靠后声明胜出。由于 MarkdownViewer 仍存在（保留 code 块处理），其全局 CSS 仍在。DiagramBlock 的 CSS 需在 MarkdownViewer 之后注入（Vue 组件 import 顺序天然保证：MarkdownViewer import DiagramBlock，子组件 CSS 在父组件之后）。P5 验证时用 Playwright 检查 SVG 是否纵向溢出确认

#### M1. DOMPurify sanitize 时机 — 🟡 中风险

**现状（v0.2.3）**：DOMPurify 在 MarkdownViewer 的 `renderSvgBlocks` 里做一次（行 549-552），配置 `ADD_ATTR: ['data-action', 'data-code', ...]`（给事件委托用）。sanitize 后的 cleanSvg 传给 SvgDiagram。

**对策**：v0.3.0 的 sanitize 移到 **SvgRenderer 的 `onMounted`**（或 `watch(code)`），只做一次：
- 配置：保留 v0.2.3 的 `ADD_ATTR` 列表（多余但无害，避免遗漏合法属性），不用精简
- 时机：`onMounted` 调 `DOMPurify.sanitize(code, { ADD_TAGS, ADD_ATTR })`，结果存入 reactive `sanitized` ref
- 不在 useMarkdown 里做（useMarkdown 只负责生成 codeViewHtml，不处理 SVG 内容 sanitize——保持职责清晰）
- 行为保真：sanitize 一次，结果用于渲染 + PNG 导出（v0.2.3 也是 sanitize 一次传给组件）

#### M2. Mermaid render ID 唯一性 — 🟡 中风险

**现状（v0.2.3）**：用 `mermaid-${index}` 作为 render ID。顺序 for 循环保证不同时执行。

**对策**：MermaidRenderer 用 `crypto.randomUUID()` 生成 render ID（如 `mermaid-export-${uuid}`），保证多实例并发 mount 时不冲突。与 R2 的 cancelled flag 配合。

## 4. DOM 结构对比

**v0.2.3（5+层嵌套）**：
```html
<div class="mermaid-block" id="...">
  <div class="mermaid-header">
    <span class="mermaid-label">MERMAID</span>
    <div class="mermaid-header-actions">
      <button class="mermaid-view-toggle">...</button>
      <button class="mermaid-action-btn fullscreen-btn">...</button>
      <div class="mermaid-dropdown">
        <button class="mermaid-action-btn menu-btn">...</button>
        <div class="mermaid-dropdown-menu">...</div>
      </div>
    </div>
  </div>
  <div class="mermaid-content diagram-mode is-active">
    <div class="mermaid-viewer-mount">  ← Vue 挂载点（B1 不需要了）
      <div class="mermaid-viewer">     ← MermaidDiagram.vue 根
        <div class="svg-container">
          <svg>...</svg>
        </div>
      </div>
    </div>
    <div class="mermaid-resize-handle"></div>
  </div>
  <div class="mermaid-content code-mode">
    <pre><code>...</code></pre>
  </div>
</div>
```

**v0.3.0（3层嵌套）**：
```html
<div class="diagram-block" data-type="mermaid" data-index="0">
  <div class="diagram-header">
    <span class="diagram-label">MERMAID</span>
    <div class="diagram-header-actions">
      <button class="diagram-view-toggle">...</button>
      <button class="diagram-action-btn fullscreen-btn">...</button>
      <div class="diagram-dropdown">
        <button class="diagram-action-btn menu-btn">...</button>
        <div class="diagram-dropdown-menu">...</div>
      </div>
    </div>
  </div>
  <div class="diagram-viewer">  ← 合并了 content+viewer-mount+viewer+svg-container
    <svg>...</svg>
    <div class="diagram-resize-handle"></div>  ← 条件渲染（mermaid/svg 有，plantuml 无）
  </div>
  <div class="diagram-code">
    <pre><code>...</code></pre>
  </div>
</div>
```

## 5. 行为保真矩阵（77条）

以下每一条都必须在 v0.3.0 中 100% 复现。验证方法：Playwright 自动化 + 截图对比 v0.2.3。

### 5.1 渲染与结构

| # | 行为 | v0.2.3 具体值 | 验证方法 |
|---|------|--------------|---------|
| 1 | block 外观 | margin:1rem 0, border:1px solid var(--border-color), border-radius:var(--radius-md), overflow:hidden, background:var(--bg-secondary) | Playwright getComputedStyle |
| 2 | header 样式 | display:flex, justify-content:space-between, padding:8px 12px, background:var(--bg-tertiary), border-bottom:1px solid var(--border-color) | 同上 |
| 3 | label 文字 | MERMAID / PLANTUML / SVG（全大写） | textContent 检查 |
| 4 | label 样式 | font-weight:600, font-size:12px, color:var(--text-secondary), text-transform:uppercase | getComputedStyle |
| 5 | header-actions | display:flex, gap:var(--space-2), align-items:center | getComputedStyle |
| 6 | diagram-mode 默认高度 | height:400px, min-height:300px | getComputedStyle |
| 7 | diagram-mode 样式 | position:relative, background:var(--bg-secondary), overflow:hidden, width:100% | getComputedStyle |
| 8 | code-mode 样式 | background:var(--bg-secondary), min-height:100px | getComputedStyle |
| 9 | 隐藏机制 | `.not(.is-active)` 用 visually-hidden：position:absolute, width:1px, height:1px, padding:0, margin:-1px, overflow:hidden, clip:rect(0,0,0,0), white-space:nowrap, border:0 | getComputedStyle |
| 10 | code-mode pre | margin:0, padding:var(--space-3), overflow-x:auto, background:var(--bg-secondary) | getComputedStyle |

### 5.2 Toggle 按钮

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 11 | toggle 按钮存在 | ✅ | ✅ | ✅ | querySelector |
| 12 | toggle 按钮样式 | display:flex, gap:4px, padding:4px 10px, font-size:12px, font-weight:500, color:var(--text-secondary), background:var(--bg-primary), border:1px solid var(--border-color), border-radius:var(--radius-sm) | 同 | 同 | getComputedStyle |
| 13 | toggle 初始文字 | "Diagram" | "Diagram" | "Diagram" | textContent |
| 14 | toggle→Code 时文字 | 改成 "Code" + 加 code-active class | **不变**（始终 "Diagram"） | 改成 "Code" + 加 code-active class | click + textContent |
| 15 | toggle→Diagram 时 | 文字改回 "Diagram" + 移除 code-active + dispatch refresh 事件 | 只 toggle is-active class（不改文字，不 dispatch refresh） | 同 Mermaid | click + 检查 |
| 16 | code-active 样式 | color:var(--accent-color), border-color:var(--accent-color), background:rgba(var(--accent-rgb), 0.1) | 同 | 同 | getComputedStyle |
| 17 | toggle-icon | "◫" | "◫" | "◫" | textContent |

### 5.3 Action 按钮（fullscreen + menu）

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 18 | fullscreen-btn 存在 | ✅ | ✅ | ✅ | querySelector |
| 19 | fullscreen-btn 样式 | width:28px, height:28px, font-size:14px, color:var(--text-secondary), background:var(--bg-primary), border:1px solid var(--border-color), border-radius:var(--radius-sm) | 同 | 同 | getComputedStyle |
| 20 | fullscreen-btn 文字 | "⧉" | "⧉" | "⧉" | textContent |
| 21 | fullscreen-btn title | "Fullscreen" | "Fullscreen" | "Fullscreen" | getAttribute |
| 22 | menu-btn 存在 | ✅ | ✅ | ✅ | querySelector |
| 23 | menu-btn 文字 | "⋯" | "⋯" | "⋯" | textContent |
| 24 | menu-btn title | "More actions" | "More actions" | "More actions" | getAttribute |

### 5.4 Dropdown 菜单

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 25 | 菜单项数量 | 2 | 2 | 2 | querySelectorAll |
| 26 | 菜单项文字 | "⬇ Download PNG" + "⧉ Copy Code" | 同 | 同 | textContent |
| 27 | 菜单默认隐藏 | display:none | display:none | display:none | getComputedStyle |
| 28 | 菜单显示 | 加 .show class → display:block | 同 | 同 | click + getComputedStyle |
| 29 | close-others | ✅（打开新菜单时关闭其他 mermaid 菜单） | ❌（不关闭其他） | ✅（同 mermaid 但范围限 svg） | 多次 click 测试 |
| 30 | click-outside 关闭 | ✅ | ❌ | ✅ | 点击外部 + 检查 |
| 31 | 菜单样式 | position:absolute, top:100%, right:0, margin-top:4px, min-width:140px, background:var(--bg-primary), border:1px solid var(--border-color), border-radius:var(--radius-md), box-shadow:0 4px 12px rgba(0,0,0,0.15), z-index:100 | 同 | 同 | getComputedStyle |

### 5.5 Fullscreen Modal

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 32 | modal 触发 | 点击 fullscreen-btn → 调用 instance.toggleFullscreen() | 同 | 同 | click + 检查 modal |
| 33 | modal overlay | position:fixed, inset:0, background:rgba(0,0,0,0.85), z-index:1000, display:flex, align-items:center, justify-content:center, padding:var(--space-4) | 同 | 同 | getComputedStyle |
| 34 | modal 主体 | width:100%, max-width:1400px, height:90vh, background:var(--bg-primary), border-radius:var(--radius-lg), overflow:hidden, display:flex, flex-direction:column, box-shadow:0 25px 50px -12px rgba(0,0,0,0.5) | 同 | 同 | getComputedStyle |
| 35 | modal toolbar | display:flex, gap:var(--space-2), padding:var(--space-3) var(--space-4), background:var(--bg-tertiary), border-bottom:1px solid var(--border-color) | 同 | 同 | getComputedStyle |
| 36 | modal title | "Mermaid Diagram" / "PlantUML Diagram" / "SVG Diagram" | textContent |
| 37 | toolbar 按钮 | 5个：+(zoomIn) −(zoomOut) ⟲(reset) ⬇(downloadPNG) ×(close) | 同 | 同 | querySelectorAll |
| 38 | toolbar-btn 样式 | width:32px, height:32px, font-size:16px, background:var(--bg-primary), border:1px solid var(--border-color), border-radius:var(--radius-sm) | 同 | 同 | getComputedStyle |
| 39 | close-btn | margin-left:var(--space-2), font-size:20px | 同 | 同 | getComputedStyle |
| 40 | modal container | flex:1, overflow:hidden, display:flex, align-items:center, justify-content:center, background:var(--bg-secondary), cursor:grab | 同 | 同 | getComputedStyle |
| 41 | 关闭方式 | 点击 close-btn 或 overlay 空白处 | 同 | 同 | click + 检查 |
| 42 | 关闭后 | modalPanZoomInstance.destroy() | 同 | 同 | 内部实现 |

### 5.6 Pan-Zoom

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 43 | pan-zoom init | svg-pan-zoom, fit:true, center:true, minZoom:0.1, maxZoom:10, mouseWheelZoomEnabled:false | 同 | 同但 try-catch 包裹 | 检查 __panZoomInstance |
| 44 | modal pan-zoom | 同但 maxZoom:20 | 同 | 同但 try-catch | modal 内检查 |
| 45 | wheel 缩放 | e.preventDefault, deltaY>0→×0.9, deltaY<0→×1.1, clamp 0.1~10 | 同（modal 0.1~20） | 同 | wheel 事件 |
| 46 | cursor | grab → grabbing(active) | 同 | 同 | getComputedStyle |
| 47 | SVG 尺寸处理 | removeAttribute width/height, style.width=100%, style.maxWidth=100% | 同 | 同 | DOM 检查 |
| 48 | ResizeObserver | resize() + fit() + center() | 同 | 同 | 内部实现 |
| 49 | refresh 事件 | mermaid-refresh → destroy+reinit | plantuml-refresh → 同 | svg-refresh → 同 | dispatch event |
| 50 | touch 支持 | ✅ 双指缩放 + 单指拖拽 | ❌ 无 | ✅ 同 mermaid | touch 事件 |

### 5.7 PNG 下载

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 51 | 下载触发 | 事件委托→downloadMermaidPng()→**重新 mermaid.render** 获取干净 SVG | 事件委托→downloadPlantUmlPng()→重新 usePlantUML.render | 组件内 downloadPng()→用 props.svgContent | 检查调用路径 |
| 52 | PNG 背景 | 白底 (#ffffff fillRect) | 白底 | **透明**（不调 fillRect） | canvas pixel 检查 |
| 53 | `<br>` fix | ✅ svgString.replace(/<br>/gi, '<br/>') | ❌ 无 | ❌ 无 | 检查渲染前处理 |
| 54 | viewBox fallback | viewBox → g.root.getBBox() → 800×600 | viewBox → width/height attr → 800×600 | viewBox → width/height attr → 400×300 | 各种 SVG 输入 |
| 55 | padding | +20px (viewBox), +40px (getBBox fallback) | +20px | +20px | 检查尺寸计算 |
| 56 | min size | max(width, 100) × max(height, 100) | 同 | 同 | 小 SVG 测试 |
| 57 | 下载文件名 | mermaid-diagram-{blockId}.png | plantuml-diagram-{blockId}.png | svg-diagram-{id}.png | 检查 a.download |
| 58 | 下载失败 | console.error + alert() | console.error | console.error | mock 失败 |

### 5.8 Copy Code

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 59 | clipboard | navigator.clipboard.writeText(code) | 同 | 同 | mock clipboard |
| 60 | 反馈 | "✓ Copied!" 2秒（改菜单按钮文字） | **console.log only**（无视觉反馈） | "✓ Copied!" 2秒 | 检查 DOM/控制台 |

### 5.9 代码高亮

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 61 | code-mode 高亮 | escapeHtml（无 Shiki） | escapeHtml（无 Shiki） | **Shiki (xml)** | HTML 结构检查 |

### 5.10 SVG 处理

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 62 | DOMPurify | ❌ 不 sanitize | ❌ 不 sanitize | ✅ sanitize（ADD_ATTR 同 useMarkdown 配置） | 注入测试 |

### 5.11 Resize Handle

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 63 | 存在 | ✅ | ❌ 无 | ✅ | querySelector |
| 64 | 样式 | position:absolute, bottom:0, right:0, width:20px, height:20px, cursor:se-resize, linear-gradient(-45deg,...), z-index:100, opacity:0.6 | N/A | 同 mermaid | getComputedStyle |
| 65 | 拖拽行为 | mousedown→mousemove 改 height（min 200px, 去掉 maxHeight）, se-resize cursor, 加 .resizing class | N/A | 同 mermaid | mouse 事件模拟 |

### 5.12 Error 处理

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 66 | 渲染失败 | 显示 `.mermaid-error` div（padding:1rem, background:#ffeaea, border:1px solid #ff6b6b, color:#c92a2a）+ dark mode 变体 | **切到 code 模式**（diagram-mode 移除 is-active, code-mode 加 is-active） | 显示 `.svg-error` div（同 mermaid-error 样式） | 坏输入测试 |

### 5.13 渲染特性

| # | 行为 | Mermaid | PlantUML | SVG | 验证方法 |
|---|------|---------|---------|-----|---------|
| 67 | 缓存 | ✅ mermaidCache（key: theme-code） | ❌ 无 | ❌ 无 | 主题切换测试 |
| 68 | 串行约束 | 无 | ✅ plantuml.js 共享内部状态，必须串行（usePlantUML.render 内部 Promise 链队列） | 无 | 并发测试 |
| 69 | ensureLoaded | 无 | ✅ usePlantUML.ensureLoaded() 前置 | 无 | 检查调用 |
| 70 | 渲染器 | useMermaid.render(id, code, theme) | usePlantUML.render(code, theme) | DOMPurify.sanitize(code) | 检查调用 |

### 5.14 Mobile 响应式

| # | 行为 | v0.2.3 | 验证方法 |
|---|------|---------|---------|
| 71 | 768px 以下 header padding | 6px 10px | CDP setDeviceMetricsOverride |
| 72 | 768px 以下 toggle-text | display:none（只显示 icon） | 同上 |
| 73 | 768px 以下 action-btn | 26px×26px, font-size:12px（仅 mermaid 有此规则） | 同上 |
| 74 | 768px 以下 diagram-mode min-height | 150px（仅 mermaid 有此规则） | 同上 |

### 5.15 其他

| # | 行为 | v0.2.3 | 验证方法 |
|---|---------|---------|
| 75 | fullscreen-trigger 隐藏按钮 | display:none（v0.2.3 的 hack：parent 点这个隐藏按钮触发组件内 toggleFullscreen） | v0.3.0 不需要——DiagramBlock 直接管理 fullscreen 状态 |
| 76 | emits | MermaidDiagram 有 5 个 emits（zoomIn/zoomOut/reset/fullscreen/downloadPng）但 parent 从不监听 → 死代码，v0.3.0 全部删除 | 代码检查 |
| 77 | instance tracking | mermaidInstances: fake（click hidden button）, plantumlInstances: fake, svgInstances: real（vNode.component.exposed） | v0.3.0 不需要——DiagramBlock 直接持有渲染器 ref |

## 6. CSS 迁移策略

### 来源
v0.2.3 的 CSS 分布在两处：
1. **各组件 scoped CSS**（MermaidDiagram 479-598, PlantUmlDiagram 298-416, SvgDiagram 360-478）：viewer + svg-container + modal 全套，每套 ~120 行，三套**完全相同**（仅 class 前缀不同）
2. **MarkdownViewer 非 scoped CSS**（810-1989 行，~1180 行）：block 外观 + header + 按钮 + dropdown + content + resize-handle + error + mobile 响应式，三套 `.mermaid-*`/`.plantuml-*`/`.svg-*` 规则**完全相同**（仅 class 前缀不同）

### 目标
- 统一 class 名：`mermaid-*`/`plantuml-*`/`svg-*` → `diagram-*`
- 组件 scoped CSS（3×120行）→ DiagramBlock 非 scoped CSS（1×120行）
- MarkdownViewer 非 scoped diagram 部分（~720行 3 套重复）→ 移到 DiagramBlock 非 scoped CSS（~240行 1 套）
- 属性值**完全不变**（所有 var(--xxx) 保持原值）

### 🔴 作用域护栏（BLOCKER 级约束）

T022 CSS 失败根因之一是 scoped CSS 的 `[data-v-xxx]` 属性提供特异性保护消失后，裸 class 选择器打不过全局规则。v0.3.0 改非 scoped 后必须用**选择器特异性人工补回**这层保护。

**强制约定：所有 diagram CSS 规则以 `.diagram-block` 为根前缀**。
- ✅ `.diagram-block .diagram-header { ... }`（特异性 0,2,0）
- ✅ `.diagram-block .diagram-viewer svg { ... }`（特异性 0,2,1）
- ❌ `.diagram-header { ... }`（特异性 0,1,0，太低，会被全局规则覆盖）

这把特异性统一抬到 (0,2,x) 起步，复刻 v0.2.3 scoped `[data-v-xxx]` 提供的保护层。

### 🔴 `!important` 审计（BLOCKER 级约束）

非 scoped CSS 无法用特异性压过 `!important`——MarkdownViewer 的 ~20 条 `!important` 规则会穿透到 diagram 区域。scoped 的 `[data-v-xxx]` 天然不受 `!important` 影响（作用域隔离），非 scoped 必须逐一审计。

**实现前必做**：grep MarkdownViewer 所有 `!important` 规则，逐条判断：

| 规则（示例） | 影响范围 | 对策 |
|--------------|---------|------|
| `.markdown-body pre * { background-color: transparent !important }` | diagram code-mode 的 `<pre><code>` 子元素 | 确认 diagram code-mode 是否被 `.markdown-body` 包裹——若是，需 `.diagram-block pre * { background-color: var(--bg-secondary) !important }` 反制；若 diagram 不在 `.markdown-body` 下则无影响 |
| `.markdown-body svg { max-width: 100% !important }` | diagram viewer 内 SVG | 确认是否穿透——若影响，加 `.diagram-block .diagram-viewer svg { max-width: none !important }` |
| ...（实现时完整 grep） | | |

**checklist**：
- [ ] `grep '!important' frontend-v3/src/components/MarkdownViewer.vue` 列出全部
- [ ] 逐条判断是否匹配 diagram 区域（`.diagram-block` 下）
- [ ] 影响的：在 DiagramBlock CSS 加等价 `!important` 反制
- [ ] 不影响的：忽略
- [ ] P5 验证：Playwright 检查 diagram code-mode pre 背景、SVG max-width 是否与 v0.2.3 一致

### SVG 选择器特异性

v0.2.3 用 scoped `:deep(svg)` 实现的 `.svg-container[data-v-xxx] svg`（特异性 0,2,1），能压过全局 `.markdown-body .mermaid svg { max-width:100% }`（0,2,1，但注入顺序靠后胜出）。

v0.3.0 非 scoped 必须写成 `.diagram-block .diagram-viewer svg`（特异性 0,2,1），**不能用裸 `.diagram-viewer svg`**（0,1,1，会被全局规则覆盖导致 SVG 纵向溢出）。

### 无前缀 class 重命名

v0.2.3 组件 scoped 内有依赖 scoped 隔离的无前缀 class，非 scoped 后必须重命名加前缀：

| v0.2.3 class（scoped 内） | v0.3.0 class（非 scoped） |
|--------------------------|--------------------------|
| `.modal-title` | `.diagram-modal-title` |
| `.toolbar-btn` | `.diagram-toolbar-btn` |
| `.toolbar-btn.close-btn` | `.diagram-toolbar-btn.close-btn` |
| `.svg-wrapper` | `.diagram-svg-wrapper` |
| `.svg-container` | `.diagram-svg-container` |

### 基础规则拆分

v0.2.3 的 `.mermaid-content` 基础规则同时作用于 diagram-mode 和 code-mode。v0.3.0 拆成两个独立元素，属性落点必须明确：

| 属性 | 落点 | 说明 |
|------|------|------|
| `position: relative` | `.diagram-viewer` | resize-handle 锚点必需 |
| `min-height: 300px` | `.diagram-viewer` | |
| `height: 400px` | `.diagram-viewer` | 默认高度 |
| `background: var(--bg-secondary)` | `.diagram-viewer` + `.diagram-code` | 两者都有 |
| `overflow: hidden` | `.diagram-viewer` | |
| `width: 100%` | `.diagram-viewer` + `.diagram-code` | |
| `min-height: 100px` | `.diagram-code` | code 模式更小 |
| `aspect-ratio: auto` | `.diagram-code` | |

### `.resizing` 规则迁移

```css
/* v0.2.3 */
.mermaid-content.resizing { position: relative !important; }
.mermaid-content.resizing .mermaid-resize-handle { opacity:1; position:absolute !important; bottom:0 !important; right:0 !important; }

/* v0.3.0 */
.diagram-block .diagram-viewer.resizing { position: relative !important; }
.diagram-block .diagram-viewer.resizing .diagram-resize-handle { opacity:1; position:absolute !important; bottom:0 !important; right:0 !important; }
```

### Mobile 响应式差异（mermaid-only）

v0.2.3 三套 mobile 规则**不完全相同**。mermaid 有额外规则（action-btn 26px、viewer min-height 150px、toggle padding 4px 8px），svg/plantuml 没有。统一 class 后用 `[data-type]` 限定：

```css
@media (max-width: 768px) {
  /* 三类共用 */
  .diagram-block .diagram-header { padding: 6px 10px; }
  .diagram-block .diagram-view-toggle .toggle-text { display: none; }

  /* mermaid-only */
  .diagram-block[data-type="mermaid"] .diagram-view-toggle { padding: 4px 8px; }
  .diagram-block[data-type="mermaid"] .diagram-action-btn { width: 26px; height: 26px; font-size: 12px; }
  .diagram-block[data-type="mermaid"] .diagram-viewer { min-height: 150px; }
}
```

### 死代码清理

迁移时一并删除 MarkdownViewer 中的 v2 遗留死代码（CSS 中存在但无模板/脚本引用）：
- `.diagram-view`（MarkdownViewer.vue:996, 1777）
- `.mermaid-view`（:1773）
- `.code-toggle-btn`（:968-989, 1750-1771）
- `.mermaid-actions`（:961-965, 1744-1748）

### 🔴 modal Teleport CSS 双前缀方案（BLOCKER 级约束）

fullscreen modal 用 `Teleport to body` 后，modal 内元素脱离 `.diagram-block` 前缀作用域——`.diagram-block .diagram-toolbar-btn` 选择器匹配不到 body 下的 modal 元素。

**对策**：modal 根元素加 `class="diagram-modal"`，所有 modal 内规则以 `.diagram-modal` 为前缀（独立于 `.diagram-block`）：

```css
/* modal 自身样式 */
.diagram-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.diagram-modal .diagram-modal-title { font-size: 16px; font-weight: 600; ... }
.diagram-modal .diagram-modal-content { width: 90%; height: 90%; ... }
.diagram-modal .diagram-toolbar-btn { ... }
.diagram-modal .diagram-toolbar-btn.close-btn { ... }
```

**共享样式**（toolbar-btn 基础外观在 block 内和 modal 内相同）：用选择器列表，避免重复：
```css
.diagram-block .diagram-toolbar-btn,
.diagram-modal .diagram-toolbar-btn {
  width: 28px; height: 28px; ... 共同样式 ...
}
/* 仅 modal 有的覆盖 */
.diagram-modal .diagram-toolbar-btn { font-size: 16px; /* modal 内更大 */ }
```

**checklist**：
- [ ] modal 根元素 `class="diagram-modal"`（不是 `diagram-block`）
- [ ] modal 内所有 CSS 规则以 `.diagram-modal` 为前缀
- [ ] block 内和 modal 内共享的样式用选择器列表
- [ ] P5 验证：Playwright 打开 fullscreen modal，检查 toolbar-btn 样式是否与 v0.2.3 一致

### 去重计算
- 组件 scoped CSS：360 行 → 120 行（-240行）
- MarkdownViewer 非 scoped diagram CSS：~720 行 → ~240 行（-480行）
- 死代码清理：~80 行
- 总计 CSS 去重：-800 行

## 7. 验证策略

### 7.1 自动化测试（vitest）
- useMarkdown：blocks 结构正确（type/lang/code/codeViewHtml）
- useDiagramViewer：pan-zoom init/destroy/refresh 逻辑
- DiagramBlock：toggle/fullscreen/dropdown/resize 交互
- 各渲染器：render/sanitize/error 处理

### 7.2 Playwright 视觉验证（关键）
对 v0.2.3 和 v0.3.0 分别截图，逐像素对比：
1. 3 种 diagram 的默认渲染状态
2. toggle 到 code 模式
3. dropdown 打开
4. fullscreen modal 打开
5. resize handle 拖拽后
6. dark/light 主题切换
7. mobile（768px）响应式

### 7.3 行为保真逐条验证
上述 77 条行为矩阵，每条用 Playwright 自动化验证 v0.3.0 与 v0.2.3 行为一致。

## 8. 文件变更清单

### 新增
- `frontend-v3/src/components/DiagramBlock.vue`（外壳，~200行）
- `frontend-v3/src/components/renderers/MermaidRenderer.vue`（~150行）
- `frontend-v3/src/components/renderers/PlantUmlRenderer.vue`（~120行）
- `frontend-v3/src/components/renderers/SvgRenderer.vue`（~150行）
- `frontend-v3/src/composables/useDiagramViewer.ts`（~150行）

### 修改
- `frontend-v3/src/composables/useMarkdown.ts`：render 返回 blocks 而非 HTML+sourcesMap
- `frontend-v3/src/components/MarkdownViewer.vue`：v-for blocks 渲染，删除 diagram 事件委托 handler/sourcesMap/instances/render 函数/CSS

### 删除
- `frontend-v3/src/components/MermaidDiagram.vue`
- `frontend-v3/src/components/PlantUmlDiagram.vue`
- `frontend-v3/src/components/SvgDiagram.vue`

### 预期行数变化
- v0.2.3 总计：4021 行
- v0.3.0 预计：~1470 行（-63%）
  - DiagramBlock: ~200
  - MermaidRenderer: ~150
  - PlantUmlRenderer: ~120
  - SvgRenderer: ~150
  - useDiagramViewer: ~150
  - useMarkdown: ~250（略增，blocks 结构化）
  - MarkdownViewer: ~450（大幅简化，删除 diagram handler+CSS）

## 9. 版本策略

发布为 v0.3.0（minor bump）。理由：
- 内部架构重大变更
- 用户可见行为零变更
- minor 表示"新架构，但向后兼容"

## 10. T022 教训应用

| T022 缺陷 | 本次对策 |
|-----------|---------|
| CSS 全未迁移 | CSS 迁移是 hard requirement，spec 明确列出每条 CSS 规则的去向 |
| CSS scoped → 非 scoped 特异性丢失 | 作用域护栏（`.diagram-block` 前缀）+ `!important` 审计 + modal Teleport 双前缀方案（3 个 BLOCKER 级约束） |
| 双重 DOM 嵌套 | DOM 结构简化为 3 层，无 placeholder mount point |
| 双重状态管理 | 完全 Vue 响应式，无事件委托，无 DOM class 操作 |
| P6 BDD 全绿但功能损坏 | 验收用 Playwright 视觉对比，不只靠 vitest |
| subagent 只关注逻辑迁移 | 实现计划按"旧组件每个部分（template/script/style）怎么迁移"分解任务 |
| 异步竞态未处理 | 渲染器 `onUnmounted` cancelled flag + mermaid UUID render ID + PlantUML 模块级 renderQueue（R2/R4） |
| PNG 下载数据流断裂 | 渲染器持有 `code` prop，exportPng 重新 render 获取干净 SVG（R3） |
