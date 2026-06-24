---
phase: P2
task_id: T020
task_name: svg-codeblock-viewer
trace_id: T020-P2-20260624
parent: P1-requirements.md
role: architect
revision: 2
created: 2026-06-24
revised: 2026-06-24
---

# P2 方案设计 — T020 svg-codeblock-viewer

## 评审反馈修正（本轮 vs 上一轮）

上一轮被评审以 2 个 [BLOCKER] 打回（见 P2-review-plan-design.md）。本轮修正：

| BLOCKER | 根因（源码核实） | 本轮修正 |
|---------|----------------|---------|
| **B1: Shiki code-mode 不高亮，BDD-3 落空** | `useShiki.ts:25-41` `commonLangs` 不含 xml/svg；`:106-107` 未加载语言回退 `'text'` → `highlightCode(code,'xml',theme)` 产出纯文本。上一轮未把 `useShiki.ts` 列入改什么。 | **选评审方案 (A)**：将 `useShiki.ts` 列入"改什么"。核实 `frontend-v3/node_modules/shiki/dist/langs/` **有 `xml.mjs`、无 `svg.mjs`**（SVG 在 Shiki 归 xml grammar，标准做法）。static import `shiki/langs/xml.mjs` + 加入 `commonLangs`，使 `effectiveLang='xml'`（非 text）。fence renderer svg 分支调 `await highlightCode(block.code, 'xml', theme)`。见 §1 / §2 / §8 BDD-3。 |
| **B2: 主题切换 SvgDiagram 不重挂载，BDD-16/BDD-6 退化** | `MarkdownViewer.vue:372-407` renderContent 主题切换触发 `watch([content,theme])` → v-html 整体替换 DOM（旧 SvgDiagram 实例随旧 DOM 销毁）。mermaid/plantuml 靠 `:388-397` `delete dataset.rendered` 重挂载。SvgDiagram 的 `watch(svgContent)` 不会触发（rawSvg→svgContent 不变）。上一轮未声明 svg 的 flag 清理。 | `renderContent()` mount flag 清理块（`:388-397`）**追加** `.svg-viewer-mount` 的 `delete dataset.rendered`；`renderSvgBlocks()` 镜像 `renderMermaidDiagrams:417` 的 `dataset.rendered` 跳过逻辑。SvgDiagram `onMounted` 监听 `svg-refresh` 事件（镜像 `MermaidDiagram.vue:431`）。BDD-16 完成标志加"主题切换后 pan-zoom 仍可缩放"。见 §2 / §3 / §8 BDD-16。 |

同时采纳评审建议（非阻塞，提升一致性）：
- 建议1：mermaid 实为 5 action（`:342-346`），函数/case 计数统一为 5（原"6 个"为笔误）。
- 建议2：空 SVG 块（` ```svg ` 无内容）也走 §6 fallback，不留空白 diagram-mode。
- 建议3：SvgDiagram onMounted 显式注册 `svg-refresh` 监听（见 §3）。
- 建议4：`toggleSvgMenu` 只管 svg 族（镜像 `toggleMermaidMenu:269-274` 不互关）。

其余设计（三管线隔离 §5、DOMPurify 策略 §3、PNG 透明 §4、mime.spec §7）经评审"通过项确认"为正确，本轮保留不动。

## 声明字段

```yaml
packages:
  - frontend-v3          # 唯一改动包；markdown 渲染层 + Shiki 语言加载 + mime 单测
  # 发版映射：frontend-v3 构建产物进 static/，由 peekview(PyPI) 包发布
  # P8 需 bump peekview 版本 + CHANGELOG（frontend-v3 不独立发版）
domains:
  - frontend
  - security             # DOMPurify SVG 净化、XSS 攻击面控制
ui_affected: true
# 需 E2E/Playwright 覆盖的交互点：
#   1. ```svg 代码块默认渲染矢量图（非源码文本）
#   2. 图/码 toggle + toggle 文本变化 + code 走 Shiki xml 高亮
#   3. 下拉菜单 Copy Code + "Copied!" 反馈
#   4. Download PNG → 透明背景（对角像素 alpha=0）
#   5. 全屏 modal + 滚轮缩放 + 拖拽平移 + 关闭
#   6. XSS：含 <script>/on*/foreignObject/javascript: 的 SVG 净化后安全
#   7. 三管线共存：mermaid + plantuml + svg 同页互不干扰
#   8. 主题切换：svg 图形重挂载 + pan-zoom 仍可缩放 + code 重高亮
gate_commands:
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P5_build: "cd frontend-v3 && npm run build 2>&1 | tail -10"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P6: "playwright-vision skill 实跑 BDD-1..BDD-16（XSS/工具栏/透明 PNG/全屏/三管线共存/主题切换重挂载），逐条截图取证"
env_constraints:
  debug_env: "继承 P0-brief：后端 make debug（127.0.0.1:8888，/tmp/peekview-debug/）；前端 vitest 用 frontend-v3/node_modules/.bin/vitest；构建 npm run build"
  isolation_check: "测试 entry 仅经 debug backend HTTP API 创建（铁律 7）；vitest 默认 jsdom 隔离；Playwright 连本地 Chrome CDP 18800（playwright-vision skill），不触碰生产"
```

## 1. 影响域分析

### 改什么

| 文件 | 改动 | 说明 |
|------|------|------|
| `frontend-v3/src/composables/useMarkdown.ts` | fence renderer 新增 `svg` 分支（仿 mermaid/plantuml 第 231-294 行）；返回值新增 `svgSources: Map<number, string>`；svg 分支 code-mode 调 `await highlightCode(block.code, 'xml', theme)` | 存原始 SVG 到 Map，生成带工具栏 block HTML + mount point；code-mode 走 Shiki xml 高亮（满足 BDD-3） |
| `frontend-v3/src/composables/useShiki.ts` | **新增** static import `shiki/langs/xml.mjs`；`commonLangs` 数组追加 `xml` | **[BLOCKER-1 修正]** 使 highlighter 注册 xml grammar，`highlightCode(code,'xml',theme)` 时 `effectiveLang='xml'`（非 text）。已核实 `node_modules/shiki/dist/langs/xml.mjs` 存在（无 svg.mjs，SVG 归 xml grammar 为 Shiki 标准做法） |
| `frontend-v3/src/components/MarkdownViewer.vue` | 新增 `svgSourcesMap`、`renderSvgBlocks(myToken)`、5 个 svg action 函数、`handleDelegatedAction` 加 5 个 case；import SvgDiagram；`renderContent()` mount flag 清理块追加 `.svg-viewer-mount`；新增 `<style>` 段 `.svg-block` 系列（镜像 `.mermaid-block`） | 委托交互 + Vue 组件挂载 + **[BLOCKER-2 修正]** 主题切换重挂载机制 |
| `frontend-v3/src/components/SvgDiagram.vue` | **新建** | pan-zoom + fullscreen modal + 透明 PNG 导出；props 接收**已净化**的 svgContent；onMounted 监听 `svg-refresh` 事件 |
| `frontend-v3/src/utils/__tests__/mime.spec.ts` | 第 47-49 行断言 `null` → `'image/svg+xml'`；注释 "excluded by design" → "supported" | 修正过时测试（BDD-13） |

### 不改什么（边界）

- **`mime.ts`**：映射表已正确（`svg: 'image/svg+xml'`，e8069c6b 既定），**不动**。只改测试。
- **`useShiki.ts` 的高亮逻辑/回退策略**：只新增 xml 到 `commonLangs`，**不改** `:106-107` 的 `effectiveLang` 回退机制（未加载语言仍回退 text——健壮性兜底，保留）。
- **`useMarkdown.ts` 末尾全局 `DOMPurify.sanitize` 配置**：`ADD_ATTR`/`ADD_TAGS` 不变（§3 验证已满足）。改全局配置会波及内联 `<svg>` 管线（BDD-10 风险）。
- **`ImageViewer.vue`**：独立 `.svg` 文件管线（`<img :src="dataUri">`），不动。
- **`MermaidDiagram.vue` / `PlantUmlDiagram.vue`**：不改动。SvgDiagram 参照其模式但独立实现（PNG 透明差异）。
- **`EntryDetailView.vue`**：用 `guessMimeType` 判断 svg 走 ImageViewer，行为不变。
- **mermaid/plantuml 的 code-mode**：仍是 `escapeHtml` 纯文本（不扩范围改走 Shiki，见 §2 [SCOPE+] 决策）。

### 风险在哪

| 风险 | 控制 |
|------|------|
| XSS：用户 SVG 含 script/on*/foreignObject | svg 代码块内容**单独** DOMPurify.sanitize 后才传 SvgDiagram；不依赖全局末尾 sanitize（mount point 是空 div） |
| 全局配置波及内联 svg | 不改全局配置；svg 代码块用同一份配置值单独 sanitize，作用域隔离（§3） |
| PNG 误用白底 | SvgDiagram 独立导出函数，**不调** `fillRect`，canvas 默认透明（§4） |
| 大 SVG 卡顿 | svg-pan-zoom 已有 minZoom/maxZoom；mount point 固定高度 400px + overflow hidden |
| 非 SVG 内容混入 ```svg 块 | [SCOPE+] fallback：无 `<svg>` 根 → 退化为代码块（§6） |
| **Shiki xml 加载失败**（BLOCKER-1 新增风险） | xml.mjs 是静态 import，构建期打包，运行期无网络依赖；加载异常 Shiki catch 设 loadError，`highlightCode` 回退 text（不崩，仅降级无高亮）。P5 build gate 验证打包通过 |
| **主题切换后 SvgDiagram 残留旧实例**（BLOCKER-2 核心风险） | renderContent v-html 替换销毁旧 DOM（旧 Vue 实例随 unmount）；renderSvgBlocks 镜像 mermaid 的 `dataset.rendered` 清理 + 跳过机制确保重挂载（§2/§3） |

## 2. UI 壳复用方案

### fence renderer 特判（useMarkdown.ts）

在现有 `if (block.lang === 'plantuml') {...}`（第 264-294 行）之后、`highlightCode` 默认分支（第 296 行）之前，新增 `svg` 分支。结构完全镜像 mermaid 分支（第 231-262 行），仅替换类名前缀 `mermaid` → `svg`、label `MERMAID` → `SVG`、action 名前缀。

生成的 HTML 结构（`svgBlockId = svg-block-${block.index}`）：

```html
<div class="svg-block" id="svg-block-{i}" data-index="{i}">
  <div class="svg-header">
    <span class="svg-label">SVG</span>
    <div class="svg-header-actions">
      <button class="svg-view-toggle" data-action="toggle-svg-view" data-block-id="svg-block-{i}" title="Toggle Diagram/Code">
        <span class="toggle-icon">◫</span>
        <span class="toggle-text">Diagram</span>
      </button>
      <button class="svg-action-btn fullscreen-btn" data-action="open-svg-fullscreen" data-block-id="svg-block-{i}" title="Fullscreen">⧉</button>
      <div class="svg-dropdown">
        <button class="svg-action-btn menu-btn" data-action="toggle-svg-menu" data-block-id="svg-block-{i}" title="More actions">⋯</button>
        <div class="svg-dropdown-menu" id="menu-svg-block-{i}">
          <button data-action="download-svg-png" data-block-id="svg-block-{i}">⬇ Download PNG</button>
          <button data-action="copy-svg-code" data-block-id="svg-block-{i}">⧉ Copy Code</button>
        </div>
      </div>
    </div>
  </div>
  <div class="svg-content diagram-mode is-active" data-mode="diagram">
    <div class="svg-viewer-mount" data-index="{i}"></div>
  </div>
  <div class="svg-content code-mode" data-mode="code">
    <!-- [BLOCKER-1 修正] 走 Shiki xml 高亮，非 escapeHtml -->
    {await highlightCode(block.code, 'xml', theme)}
  </div>
</div>
```

注意：
- `data-action`/`data-block-id`/`data-index`/`data-mode` 均在现有全局 `ADD_ATTR` 白名单内（`useMarkdown.ts:329`），无需改 DOMPurify 配置。
- 不加 `svg-resize-handle`（mermaid 有，svg 代码块不要求可调大小；降低复杂度。若 P6 验收发现需要再补）。
- **code-mode 走 Shiki**：`render` 函数是 async（`useMarkdown.ts:296` 已在循环里 `await highlightCode`），svg 分支同样 `await highlightCode(block.code, 'xml', theme)`，返回的 `<pre class="shiki">` HTML 直接拼入 code-mode div。**前置条件**：`useShiki.ts` 已把 xml 加入 commonLangs（§1），否则 `effectiveLang` 回退 text。

[SCOPE+] 发现：mermaid/plantuml 的 code-mode 当前是纯 `escapeHtml`（`useMarkdown.ts:257/289`），未 Shiki 高亮。P1 BDD-3 明确要求 svg 代码视图 Shiki 高亮。两种选择：
- (a) svg 的 code-mode 走 `highlightCode(block.code, 'xml', theme)`——满足 BDD-3，但与 mermaid/plantuml 行为分叉
- (b) 统一：mermaid/plantuml/svg 的 code-mode 都改走 Shiki——扩大范围

**决策**：选 (a)。理由：BDD-3 是 P1 显式验收条件，SVG 源码本质是 XML，Shiki 有 xml grammar（已核实 `xml.mjs` 存在）。mermaid/plantuml 的 code-mode 不属本任务范围（BDD-10/12 只要求"行为不变"）。**本任务需改 `useShiki.ts` 注册 xml**（§1），这是满足 BDD-3 的必要改动，非可选实现细节。

影响：P1 基线无需新增 BDD（BDD-3 已覆盖），仅实现层用 Shiki。标注 [SCOPE+] 供主 Agent 知悉实现选择。

### MarkdownViewer.vue 交互挂载

镜像 mermaid 的 **5** 个 action 函数 + **5** 个委托 case（修正建议1：mermaid 实为 5 action，`MarkdownViewer.vue:342-346`）：

| action | 函数 | 行为 |
|--------|------|------|
| `toggle-svg-view` | `toggleSvgView(blockId)` | 切换 `.svg-content.diagram-mode` / `.code-mode` 的 `is-active`；toggle 文本 Diagram↔Code；切回 diagram 时在 `.svg-viewer` 上 dispatch `svg-refresh` 事件（镜像 `:243-246` mermaid-refresh）重 init pan-zoom |
| `open-svg-fullscreen` | `openSvgFullscreen(blockId)` | 调 svgInstances.get(blockId).toggleFullscreen() |
| `toggle-svg-menu` | `toggleSvgMenu(blockId)` | 切换 `.show` + click-outside 关闭（仿 mermaid `:269-274`，**只管 svg 族**，不互关 mermaid/plantuml 菜单——修正建议4） |
| `download-svg-png` | `downloadSvgPng(blockId)` | 调 svgInstances.get(blockId).downloadPng() |
| `copy-svg-code` | `copySvgCode(blockId)` | 从 svgSourcesMap 取原始源码，写剪贴板 + "✓ Copied!" 反馈 2s（仿 `copyMermaidCode:59-80`） |

`handleDelegatedAction` switch 加 **5** 个 case（download/copy 委托组件实例或直接取 Map，不在 MarkdownViewer 重复导出逻辑）。

**[BLOCKER-2 修正] 主题切换重挂载机制**：

`renderContent()`（`MarkdownViewer.vue:372-407`）主题切换时被 `watch([props.content, theme.value])` 触发 → `renderedHtml.value = result.html`（v-html 整体替换 DOM，旧 SvgDiagram 实例随旧 DOM 销毁）。mermaid/plantuml 通过 `:388-397` 显式 `delete mp.dataset.rendered` 让 `renderMermaidDiagrams`/`renderPlantUmlDiagrams` 重新挂载。

**svg 必须镜像此机制**。在 `:388-397` 的清理块追加：

```js
const svgMountPoints = contentRef.value.querySelectorAll('.svg-viewer-mount')
svgMountPoints.forEach(mp => {
  delete (mp as HTMLElement).dataset.rendered
})
```

随后在 `await renderMermaidDiagrams()` / `renderPlantUmlDiagrams(myToken)` 之后调用 `await renderSvgBlocks(myToken)`。

`renderContent()` 调用链（修正后）：
```
renderedHtml = result.html; svgSourcesMap = result.svgSources
await nextTick()
# [BLOCKER-2 修正] 清理三族 mount flag
delete .mermaid-viewer-mount dataset.rendered
delete .plantuml-viewer-mount dataset.rendered
delete .svg-viewer-mount dataset.rendered   # 新增
await renderMermaidDiagrams()
await renderPlantUmlDiagrams(myToken)
await renderSvgBlocks(myToken)               # 新增
```

## 3. SVG 渲染方案 + DOMPurify 净化策略

### 渲染流程（mount point + Vue 组件，仿 mermaid）

`renderSvgBlocks(myToken)`（MarkdownViewer 新增，**镜像 `renderMermaidDiagrams:409-459` 的 dataset.rendered 跳过逻辑**——BLOCKER-2 修正核心）：
```
for each .svg-block:
  if myToken !== renderToken: return          # 防竞态，同 plantuml
  mountPoint = block.querySelector('.svg-viewer-mount')
  if not mountPoint or mountPoint.dataset.rendered === 'true': continue   # 镜像 :417
  index = block.dataset.index
  rawSvg = svgSourcesMap.get(index)
  # 净化：用与全局末尾相同的配置，单独 sanitize（作用域隔离）
  cleanSvg = DOMPurify.sanitize(rawSvg, {
    ADD_ATTR: ['data-action','data-code','data-line','data-block-id','data-index','data-mode','target','rel'],
    ADD_TAGS: ['button']
  })
  # fallback：rawSvg 为空 或 净化后无 <svg> 根 → 退化为代码块（见 §6）
  if not rawSvg or not /<svg/i.test(cleanSvg):
      退化处理（移除 diagram-mode is-active + code-mode 加 is-active + mount point 写 svg-error/Empty SVG）
      mountPoint.dataset.rendered = 'true'    # 标记已处理防主题切换重复尝试
      continue
  mountPoint.dataset.rendered = 'true'         # 镜像 :434，标记已挂载防重复
  vNode = h(SvgDiagram, { svgContent: cleanSvg, id: `svg-${index}` })
  vueRender(vNode, mountPoint)
  svgInstances.set(`svg-block-${index}`, {
    toggleFullscreen: () => mountPoint.querySelector('.svg-fullscreen-trigger')?.click(),
    downloadPng: () => 组件实例方法   # 通过 ref 或事件委托
  })
```

**空 SVG 块处理（修正建议2）**：` ```svg ` 无内容时 `rawSvg` 为空字符串，走 §6 fallback 路径（切 code-mode + `svg-error` 提示 "Empty SVG"），不留空白 diagram-mode。

**为什么单独 sanitize 而非依赖全局末尾 sanitize**：mount point 是空 `<div class="svg-viewer-mount">`，SVG 内容不在 html 字符串里（由 Vue 组件 v-html 注入）。全局 sanitize 作用不到。单独 sanitize 使作用域明确：svg 代码块内容经 DOMPurify，内联 `<svg>` 经全局 DOMPurify，配置相同但路径独立——满足 BDD-14（不削弱非 SVG 内容净化）和 BDD-10（内联 svg 行为不变）。

### SvgDiagram.vue 组件

props: `{ svgContent: string; id: string }`（svgContent 已净化）。结构镜像 MermaidDiagram.vue：
- `<div ref="containerRef" class="svg-viewer" @wheel="onWheel"><div ref="svgContainer" v-html="svgContent"></div><button class="svg-fullscreen-trigger" style="display:none"></button></div>`
- Teleport fullscreen modal（同 mermaid，工具栏按钮 zoom in/out/reset/download/close 对照 `MermaidDiagram.vue:16-23`）
- `initPanZoom()` / `initModalPanZoom()`：`await import('svg-pan-zoom')`，options 同 mermaid（zoomEnabled/fit/center/minZoom 0.1/maxZoom 10/modal 20）
- `onWheel` / `onTouch*`：复制 mermaid 的滚轮 + 双指缩放
- `watch(() => props.svgContent)`：destroy + re-init pan-zoom（svgContent 变化时，如未来扩展）
- **[BLOCKER-2 修正 + 建议3] `onMounted` 监听 `svg-refresh`**（镜像 `MermaidDiagram.vue:431`）：
  ```js
  onMounted(() => {
    initPanZoom()
    containerRef.value?.addEventListener('svg-refresh', () => {
      refreshPanZoom()   // destroy + re-init，处理 toggle 切回 diagram 后 pan-zoom 失效
    })
  })
  ```
- `defineExpose({ toggleFullscreen, downloadPng, refreshPanZoom })`

### DOMPurify 最小验证结果（P2 强制验证，已实跑）

在 `frontend-v3` 下用 vitest + jsdom 跑探针（DOMPurify 3.4.9，配置 = 现有全局 `ADD_ATTR`/`ADD_TAGS`），6 项全绿：

| 输入 | `<script>` | `on*` | `<foreignObject>` | `javascript:` | 图形元素 |
|------|-----------|-------|-------------------|---------------|---------|
| `<svg><script>alert(1)</script><circle/></svg>` | 剥除 ✓ | — | — | — | circle 保留 ✓ |
| `<circle onclick onload r=10/>` | — | 剥除 ✓ | — | — | circle 保留 ✓ |
| `<foreignObject><div>x</div></foreignObject><path/>` | — | — | 剥除 ✓ | — | path 保留 ✓ |
| `<use href="javascript:alert(1)"/><rect/>` | — | — | — | 剥除 ✓ | rect 保留 ✓ |
| `<g><path/><circle/><rect/><text/></g>` | — | — | — | — | g/path/circle/rect/text/svg 全保留 ✓ |
| 内联 `<svg>` 混在 HTML block（含 `<script>`） | 剥除 ✓ | — | — | — | svg/circle 保留 ✓（与 svg 代码块同配置，行为一致） |

**结论**：DOMPurify 默认配置 + 现有 `ADD_ATTR`/`ADD_TAGS` 已满足 IR1 全部要求。**无需** `FORBID_TAGS`/`FORBID_ATTR`/自定义 SVG profile。全局配置不改 → 内联 `<svg>` 管线零影响（BDD-10/14）。

## 4. PNG 透明导出方案

### 独立导出函数（不复用 mermaid/plantuml 白底逻辑）

SvgDiagram 内 `exportSvgToPng(): Promise<Blob>`，参照 MermaidDiagram.vue:213-330 的 `exportMermaidToPng`，**关键差异**：

| 步骤 | mermaid | svg（本任务） |
|------|---------|--------------|
| SVG 源 | 重新 `mermaid.render` 取干净 SVG | `props.svgContent`（已净化，无需重渲染） |
| `<br>` → `<br/>` 修复 | 是（mermaid 特有） | 否 |
| g.root bbox 回退 | 是（mermaid 特有） | 否（通用回退即可） |
| **背景填充** | `ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h)` | **删除这两行** → canvas 默认透明 |
| 尺寸回退 | viewBox → g.root bbox → 800×600 | viewBox → width/height attr → 400×300（默认更小，用户 svg 尺寸不可控）；min 100×100 |

**透明性保证**：`canvas.getContext('2d')` 创建的 canvas 默认全像素 alpha=0（透明）。不调 `fillRect` 即保持透明；`drawImage(svg)` 后 SVG 透明区域仍透明。BDD-5 通过对角像素采样 alpha=0 验证。

**PNG 导出源确认**（建议5）：`props.svgContent` 是 DOMPurify 净化后的 SVG。DOMPurify 默认保留 `xmlns`、`xlink:href`（合法引用）、`viewBox`、`width`/`height` 等导出所需属性（§3 探针验证图形元素全保留）。BDD-5 透明像素采样用一个 sanitize 后仍合法可见的 SVG（如 `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>`），避免 sanitize 后变空导致导出空白。

### 尺寸回退链（BDD-15）

```
1. viewBox → parts[2]/parts[3] (+20 padding)
2. width/height 属性 → parseFloat (+20)
3. 都缺 → 400×300
4. max(., 100) 兜底
```

### 下载触发

`downloadPng()`（SvgDiagram 内，镜像 MermaidDiagram.vue:195-209）：blob = await exportSvgToPng()；url = URL.createObjectURL(blob)；a.download = `svg-diagram-${props.id}.png`；click + revoke。MarkdownViewer 的 `downloadSvgPng(blockId)` 委托给 `svgInstances.get(blockId).downloadPng()`（与 mermaid 模式一致）。

## 5. 三管线隔离确认

| 管线 | 入口 | 渲染路径 | 净化 | 本任务影响 |
|------|------|---------|------|-----------|
| ` ```svg ` 代码块 | useMarkdown fence renderer `lang==='svg'` | svgSources Map → mount point → SvgDiagram 组件 v-html | **单独** DOMPurify.sanitize（§3） | **新增** |
| 内联 `<svg>` | markdown-it `html:true` 解析进 html 字符串 | renderedHtml v-html（MarkdownViewer 根 div） | **全局末尾** DOMPurify.sanitize（配置不变） | **不变**（BDD-10） |
| 独立 `.svg` 文件 | EntryDetailView → ImageViewer | `<img :src="dataUri">` | 不经 markdown/DOMPurify（img 天然沙箱） | **不变**（BDD-11） |

隔离机制：
- svg 代码块的净化用**单独** `DOMPurify.sanitize(rawSvg, cfg)` 调用，cfg 值与全局相同但调用独立——改 svg 分支不影响全局配置。
- 内联 svg 仍由全局末尾 sanitize 处理，验证已确认行为不变（§3 最后一行）。
- ImageViewer 完全在 markdown 渲染之外，不读 svgSources，不受 fence renderer 改动影响。
- BDD-12（共存）：三个 fence 分支（mermaid/plantuml/svg）各自独立 Map + mount point + 组件，互不读写对方数据。

## 6. 非 SVG 内容 fallback（[SCOPE+]）

P1 未显式覆盖「```svg 块内容不是合法 SVG」的情况。mermaid 渲染失败有 fallback 到 code mode（MarkdownViewer.vue:502-512）。等价健壮性：

`renderSvgBlocks()` 里，`rawSvg` 为空 或 `DOMPurify.sanitize(rawSvg)` 后结果不含 `<svg` 标签（如用户写了纯文本、XML parse 失败、根本不是 SVG），则：
- 不挂载 SvgDiagram
- 将该 block 的 `.svg-content.diagram-mode` 移除 `is-active`，`.svg-content.code-mode` 加 `is-active`（直接显示源码）
- mount point 写 `<div class="svg-error">Not a valid SVG</div>`（空内容写 `Empty SVG`，仿 mermaid-error 样式）
- `mountPoint.dataset.rendered = 'true'`（标记已处理，防主题切换时重复尝试）

**[SCOPE+] 影响**：P1 基线无需新增 BDD（属 IR5 尺寸回退的健壮性延伸），仅实现层覆盖。标注供主 Agent 知悉。若主 Agent 认为需显式 BDD，可定向回补 P1。

## 7. mime.spec.ts 修复（BDD-13）

`frontend-v3/src/utils/__tests__/mime.spec.ts` 第 47-49 行：

```ts
// 改前
it('returns null for svg (excluded by design)', () => {
  expect(guessMimeType('icon.svg')).toBeNull()
})
// 改后
it('returns image/svg+xml for svg (supported)', () => {
  expect(guessMimeType('icon.svg')).toBe('image/svg+xml')
})
```

IR11 兼容性确认：`mime.ts` 自 e8069c6b 起返回 `image/svg+xml`，消费方（ImageViewer.vue、EntryDetailView.vue）依赖此值判断走图片渲染——修测试使期望与实际一致，**不引入回归**。唯一"依赖旧 null 语义"的就是这个过时测试本身。

## 8. BDD 覆盖矩阵

| BDD | 设计决策位置 | 完成标志 |
|-----|------------|---------|
| BDD-1 渲染矢量图 | §2 UI 壳 + §3 mount point + SvgDiagram v-html | `.svg-block` 存在 + 内联 `<svg>` 可见 |
| BDD-2 默认图形视图 | §2 `diagram-mode is-active` 默认 | toggle 文本 "Diagram"，code 隐藏 |
| BDD-3 图/码 toggle | §2 `toggle-svg-view` + [SCOPE+] Shiki code-mode + §1 useShiki.xml | 切换 is-active + 文本变 Diagram↔Code + **code `<pre>` 含 Shiki 生成的 class（`shiki`/`hljs-tag` 等），effectiveLang=xml 非 text** |
| BDD-4 复制源码 | §2 `copy-svg-code` | 剪贴板含原始源码 + "✓ Copied!" 2s |
| BDD-5 PNG 透明 | §4 删除 fillRect | PNG 对角像素 alpha=0 |
| BDD-6 全屏/缩放 | §3 SvgDiagram Teleport modal + svg-pan-zoom | modal 打开 + 滚轮缩放 + 拖拽 + 关闭 |
| BDD-7 script 剥除 | §3 DOMPurify 验证行1 | DOM 无 `<script>` + 无 alert + 图形可见 |
| BDD-8 on* 剥除 | §3 DOMPurify 验证行2 | DOM 无 `on*` + 点击无处理器 + 圆形可见 |
| BDD-9 foreignObject/js:href 剥除 | §3 DOMPurify 验证行3/4 | foreignObject/javascript: 移除 + path/rect 保留 |
| BDD-10 内联 svg 不变 | §5 三管线隔离 | 内联 `<svg>` 行为同改动前（无工具栏） |
| BDD-11 .svg 文件不变 | §5 三管线隔离 | ImageViewer 仍 `<img>`，无工具栏 |
| BDD-12 三者共存 | §5 隔离 + 独立 Map | mermaid/plantuml/svg 同页各自正确 |
| BDD-13 mime.spec 修复 | §7 | 测试期望 `image/svg+xml`，全套绿 |
| BDD-14 净化作用域 | §3 单独 sanitize + §3 验证行6 | svg 配置不削弱非 SVG；内联 svg 仍满足 BDD-10 |
| BDD-15 尺寸回退 | §4 回退链 + §6 空 SVG fallback | 无 width/height/viewBox 不崩溃、非零尺寸；空 SVG 块显示 Empty SVG 不留白 |
| BDD-16 主题响应 | §2 renderContent mount flag 清理 + §3 SvgDiagram svg-refresh 监听 + useMarkdown theme 重渲染 | 图形不坏 + code Shiki 重高亮 + **主题切换后 pan-zoom 仍可缩放（SvgDiagram 重挂载，pan-zoom 实例重新 init）** |

## 9. files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/composables/useMarkdown.ts:187-337   # fence renderer 二遍循环 + mermaid/plantuml 分支模板 + 末尾 DOMPurify 配置
    why: svg 分支插入点 + escapeHtml/highlightCode 用法 + 末尾 DOMPurify 配置（勿改）+ render 返回值结构
  - path: frontend-v3/src/composables/useShiki.ts:1-122        # 全文
    why: [BLOCKER-1] 需新增 xml static import + commonLangs 追加；highlightCode 签名 + effectiveLang 回退逻辑（不改）
  - path: frontend-v3/src/components/MarkdownViewer.vue:336-514  # handleDelegatedAction + renderContent + mermaid/plantuml 渲染/交互函数
    why: svg 的 5 个函数 + 5 个 case + renderSvgBlocks + [BLOCKER-2] mount flag 清理块的镜像模板
  - path: frontend-v3/src/components/MermaidDiagram.vue:1-477    # pan-zoom + fullscreen modal + PNG 导出 + svg-refresh 监听(:431)
    why: SvgDiagram.vue 的镜像蓝本（PNG 导出去 fillRect、去 mermaid 特有回退；onMounted svg-refresh 监听）
  - path: frontend-v3/src/components/PlantUmlDiagram.vue
    why: 第二个镜像参照（确认 pan-zoom 模式一致性 + plantuml-refresh 监听 :265）
  - path: frontend-v3/src/utils/mime.ts
    why: 确认映射表不动（只改测试）
  - path: frontend-v3/src/utils/__tests__/mime.spec.ts:47-49
    why: BDD-13 修改点
  - path: frontend-v3/src/components/ImageViewer.vue:1-60
    why: 确认独立 .svg 管线不经 markdown（三管线隔离验证）
```

## 10. 完成标志（供 P3/P5）

1. ` ```svg ` 代码块渲染出带工具栏的容器，图形视图可见内联 `<svg>`（非源码文本）
2. toggle 切换图/码，code 走 Shiki xml 高亮（`<pre>` 含 shiki class，effectiveLang=xml 非 text），文本 Diagram↔Code
3. Copy Code 写入剪贴板 + "✓ Copied!" 2s 反馈
4. Download PNG 产出透明背景 PNG（alpha=0）
5. Fullscreen 打开 modal，滚轮缩放 + 拖拽平移 + 关闭
6. 含 `<script>`/`on*`/`<foreignObject>`/`javascript:` 的 SVG 净化后安全（DOM 无危险节点/属性，图形保留）
7. 内联 `<svg>` 与独立 `.svg` 文件行为不变
8. mermaid + plantuml + svg 同页共存互不干扰
9. `mime.spec.ts` 全套绿（svg 期望 `image/svg+xml`）
10. 缺 width/height/viewBox 的 SVG 不崩溃、非零尺寸；空 SVG 块显示 Empty SVG
11. 主题切换：图形重挂载不坏 + code 重高亮 + pan-zoom 仍可缩放（BDD-16/BDD-6）
12. P5 gate 三命令全绿（vitest + build + vue-tsc）

## 11. 待确认

无 `[NEED_CONFIRM]`。所有方向由 P0 约束 + P2 验证确定：
- DOMPurify 默认配置够用（§3 实跑验证）
- PNG 透明靠删除 fillRect（标准 canvas 行为）
- 三管线隔离靠独立 sanitize 调用 + 不改全局配置
- Shiki code-mode 用 xml grammar（已核实 `xml.mjs` 存在，加入 commonLangs 即生效）
- 主题切换重挂载靠镜像 mermaid 的 `dataset.rendered` 清理 + 跳过机制 + SvgDiagram svg-refresh 监听

[SCOPE+] 两处（§2 Shiki code-mode、§6 非 SVG fallback）均为实现层选择，不阻塞流程，已标注供主 Agent 知悉。
