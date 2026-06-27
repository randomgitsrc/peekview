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
| 4 | 注册表 | composable（B） | `useDiagramRegistry()` 返回 lang→配置映射。加新类型只改注册表 + 写渲染器 |
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
    { type: 'diagram', lang: 'mermaid', code: '...', codeViewHtml: '...' },
    { type: 'diagram', lang: 'plantuml', code: '...', codeViewHtml: '...' },
    { type: 'diagram', lang: 'svg', code: '...', codeViewHtml: '...' },
  ]
  注意：code 块保留事件委托（只有 copy button），diagram 块完全 Vue 响应式

MarkdownViewer.vue（简化渲染）
  v-for block:
    text → v-html
    code → v-html（保留事件委托处理 copy）
    diagram → <DiagramBlock :block="block" :registry="registry" />

DiagramBlock.vue（外壳，~200行）
  props: block (diagram type), registry
  管理：header 按钮 / toggle Diagram↔Code / fullscreen modal / dropdown menu / resize handle / code 模式
  <slot> 插入渲染器
  CSS: diagram-* 统一规则（非 scoped，放在这里或独立 CSS 文件）

渲染器（各 ~100-150行）：
  MermaidRenderer.vue — mermaid render + pan-zoom + touch + resize
  PlantUmlRenderer.vue — plantuml server render + pan-zoom（无 touch 无 resize）
  SvgRenderer.vue — DOMPurify sanitize + pan-zoom + touch + resize + try-catch

useDiagramRegistry.ts（~60行）
  返回 { mermaid: { component, render, pngBg, hasResize, hasTouch, hasCloseOthers, hasClickOutside, copyFeedback, ... }, plantuml: {...}, svg: {...} }

useDiagramViewer.ts（~150行）
  composable：pan-zoom init / destroy / refresh / wheel / touch / resize
  被 3 个渲染器调用，参数化 maxZoom / minZoom 等
```

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
| 7 | diagram-mode 样式 | background:var(--bg-secondary), overflow:hidden, width:100% | getComputedStyle |
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

### 去重计算
- 组件 scoped CSS：360 行 → 120 行（-240行）
- MarkdownViewer 非 scoped diagram CSS：~720 行 → ~240 行（-480行）
- 总计 CSS 去重：-720 行

## 7. 验证策略

### 7.1 自动化测试（vitest）
- useMarkdown：blocks 结构正确（type/lang/code/codeViewHtml）
- useDiagramRegistry：注册表查询正确
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
- `frontend-v3/src/composables/useDiagramRegistry.ts`（~60行）
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
- v0.3.0 预计：~1530 行（-62%）
  - DiagramBlock: ~200
  - MermaidRenderer: ~150
  - PlantUmlRenderer: ~120
  - SvgRenderer: ~150
  - useDiagramRegistry: ~60
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
| 双重 DOM 嵌套 | DOM 结构简化为 3 层，无 placeholder mount point |
| 双重状态管理 | 完全 Vue 响应式，无事件委托，无 DOM class 操作 |
| P6 BDD 全绿但功能损坏 | 验收用 Playwright 视觉对比，不只靠 vitest |
| subagent 只关注逻辑迁移 | 实现计划按"旧组件每个部分（template/script/style）怎么迁移"分解任务 |
