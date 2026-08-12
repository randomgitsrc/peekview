---
phase: P2
task_id: T022-diagram-renderer-refactor
type: design
parent: P1-requirements.md
  trace_id: T022-P2-20260625-r2
  status: revised
  created: 2026-06-25
---

# P2 方案设计 — T022 diagram-renderer-refactor

> 本方案基于 P2-progress.md（现有结构分析成果）+ P1-requirements.md（需求基线 + 29 BDD + I2 三胞胎差异矩阵 + I3 16-case handler 差异矩阵）+ P0-brief.md（路线 B + 12 known_risks + 行为保真策略）。
> 设计原则：用户感知保真（必须，字符级）> 技术内部保真（不破坏外部即可）。禁止「重构+优化」捆绑。

## 第 1 节：架构总览

### 1.1 重构后文件清单

| 操作 | 文件路径 | 行数目标 | 说明 |
|------|---------|---------|------|
| 新增 | `src/components/diagrams/BaseDiagram.vue` | < 400 | 基类骨架：zoom/fullscreen/pan/PNG 导出 + refresh + slot 注入 |
| 新增 | `src/components/diagrams/MermaidDiagram.vue` | < 150 | 薄包装：useMermaid 渲染源 + 差异 props/emits |
| 新增 | `src/components/diagrams/PlantUmlDiagram.vue` | < 150 | 薄包装：usePlantUML 渲染源 + 差异 props |
| 新增 | `src/components/diagrams/SvgDiagram.vue` | < 150 | 薄包装：DOMPurify 净化后的源 + 差异 props |
| 新增 | `src/composables/useCodeBlockRenderer.ts` | < 200 | 状态 composable：cache/sourcesMap/renderToken/instances/resize |
| 改写 | `src/utils/useMarkdown.ts` | ~300 | 注册模式：Map<fence-lang, renderer> 查表路由 |
| 改写 | `src/components/MarkdownViewer.vue` | < 300 脚本 | 退化为「识别 + 派发」：v-html + 挂载 + emit handler |
| 删除 | `src/components/MermaidDiagram.vue`（原） | — | 内容迁入 diagrams/ 子目录 |
| 删除 | `src/components/PlantUmlDiagram.vue`（原） | — | 同上 |
| 删除 | `src/components/SvgDiagram.vue`（原） | — | 同上 |

**目录组织决策**：新建 `src/components/diagrams/` 子目录承载 BaseDiagram + 三薄包装，便于未来新增图表类型（可扩展性目标：1 文件 + 1 行注册）。import 路径变化属技术内部保真，不影响外部行为。CSS（原 1192 行）按归属拆分：block 通用样式随 BaseDiagram，差异样式随各薄包装，front-matter/code-block-wrapper/dark-mode 保留在 MarkdownViewer。

### 1.2 数据流图

```
输入: markdown content + theme
  │
  ▼
MarkdownViewer.renderContent()  ← watch([content, theme])
  │  const result = await useMarkdown().render(content, theme)
  ▼
useMarkdown.render()  ← 注册模式核心
  │  1. markdown-it 解析，fence 收集 codeBlocks[{lang, code, index}]
  │  2. 生成占位符 <!--CODE_BLOCK_N-->
  │  3. 对每个 block 查 rendererRegistry.get(lang):
  │     ├─ 命中: renderer.renderCodeView(code, theme) [code 视图 HTML]
  │     │         renderer 占位符块包装 HTML（含 data-block-id/data-mode）
  │     │         renderer 调 useCodeBlockRenderer 获取/写入 cache
  │     └─ 未注册(含 code/markdown/html/image): 默认 Shiki 高亮 code block
  │  4. 二轮替换占位符为 blockHtml
  │  5. DOMPurify.sanitize(ADD_ATTR 白名单) [T020 安全债保留]
  ▼
返回 { html, headings, sources: Map<index, BlockSource> }
  │  (sources 取代原 mermaidSources/plantumlSources/svgSources 三 Map，技术内部保真)
  │
  ▼
MarkdownViewer: v-html(result.html) + renderToken 校验
  │  await nextTick() → 查 .xxx-viewer-mount → 挂载组件
  ▼
挂载阶段 (MarkdownViewer.mountDiagram)
  │  根据 lang 查 wrapperRegistry → h(Wrapper, props) + vueRender(mountPoint)
  │  wrapperRegistry: { mermaid: MermaidDiagram, plantuml: PlantUmlDiagram, svg: SvgDiagram }
  │  instance 存入 useCodeBlockRenderer.{mermaid,plantuml,svg}Instances
  ▼
MermaidDiagram/PlantUmlDiagram/SvgDiagram (薄包装)
  │  <BaseDiagram v-bind="commonProps" v-on="wrapperEmits">
  │    <template #renderer> [SVG 源注入] </template>
  │  </BaseDiagram>
  │  仅提供: 渲染源 + 差异 props (fillRect/viewBox fallback/final size/touch/refresh class)
  ▼
BaseDiagram.vue (基类骨架)
  │  通用: panZoom init/zoom/fullscreen/pan/PNG export/refresh listener
  │  差异由 props 参数化 (见第 2 节)
  ▼
用户交互 → emit
  │  子组件 emit('zoom-in'|'zoom-out'|'reset'|'fullscreen'|'download-png'|)
  │  MarkdownViewer emit handler 按 P1 I3 差异矩阵 16-case 差异化处理
  ▼
外部契约不变: EntryDetailView 只感知 :content 输入 + headings slot/emit 输出
```

### 1.3 与 P0-brief「范围声明」的边界对应

**做（本方案覆盖）**：
- ✅ BaseDiagram.vue 基类（zoom/fullscreen/pan/PNG 骨架）→ 第 2 节
- ✅ 三 Diagram 改薄包装 < 150 行 → 第 3 节
- ✅ useMarkdown 注册模式（fence-lang → renderer 查表）→ 第 5 节
- ✅ useCodeBlockRenderer composable（cache/sourcesMap/renderToken/instances 迁出）→ 第 4 节
- ✅ MarkdownViewer 退化 < 300 脚本 → 第 6 节 + CSS 拆分
- ✅ data-action → emit 迁移（16-case 差异保留）→ 第 6 节
- ✅ 全部测试保留 + 新增（P3 红线）→ 第 8 节 gate_commands
- ✅ 行为保真 9 维度逐项一致 → 第 7 节逐条回应 known_risks

**不做（明确边界）**：
- ❌ 统一 Block 协议：code/markdown/html/image/mermaid/plantuml/svg 性质差异大，仅 diagram 三族抽基类，非 diagram 类型走默认 code block（不进 rendererRegistry）
- ❌ 动 EntryDetailView 主体：仅 MarkdownViewer 内部重构，EntryDetailView L136-141 调用面零改动（`:content` 输入 + dormant `:headings` fallthrough + `@select-heading` 哑监听保持原状，progress 已确认）
- ❌ 动 backend/MCP/CLI：纯 frontend-v3 单包
- ❌ 改 API 行为：render() 返回 Map 结构可变（技术内部），但 content 输入 + headings 输出契约不变
- ❌ 新第三方依赖：仅用现有 vue/svg-pan-zoom/mermaid/plantuml/shiki/DOMPurify/markdown-it
- ❌ 换 markdown 库：保留 markdown-it


## 第 2 节：BaseDiagram.vue 骨架设计

> 定位：三薄包装的共同根组件，承担 panZoom/zoom/fullscreen/pan/PNG 导出/refresh 监听骨架。差异点全部 props 参数化，不写死任何 mermaid/plantuml/svg 专有逻辑。

### 2.1 props 接口（基于 P1 I2 差异矩阵逐条参数化）

```typescript
interface BaseDiagramProps {
  // ── 渲染源 ──
  svgContent: string                    // 已渲染/已净化的最终 SVG 字符串（modal 模式也用此，复用主图 props.svgContent）
  codeViewHtml: string                 // code 视图 HTML（mermaid/plantuml=escapeHtml 同步输出；svg=Shiki 异步高亮输出）。由 useMarkdown.renderCodeView 产出，经 sourcesMap 传入薄包装，再传 BaseDiagram v-html 渲染。详见 5.2/4.2

  // ── 标识 ──
  blockId: string | number              // data-block-id
  blockIndex: number                    // data-index
  classPrefix: 'mermaid' | 'plantuml' | 'svg'   // CSS class 前缀 + header label 派生

  // ── 主题 ──
  theme: 'light' | 'dark'

  // ── PNG 导出差异（P1 I2 矩阵 7 行）──
  pngBackground: '#ffffff' | 'transparent'       // mermaid/plantuml 白；svg 透明
  pngViewBoxFallback: 'g-root-getBBox' | 'width-height-attrs'  // mermaid 专有 vs 其他
  pngFinalSize: { width: number; height: number } // mermaid/plantuml 800×600；svg 400×300
  pngBrFix: boolean                    // mermaid true（<br>→<br/>）；其他 false
  pngFilenamePrefix: string             // 'mermaid-diagram'/'plantuml-diagram'/'svg-diagram'

  // ── panZoom 配置差异 ──
  panZoomMinZoom: number                // 0.1（三族一致）
  panZoomMaxZoom: number                // 主图 10。modal panZoom 是 BaseDiagram 内部独立实例，maxZoom 硬编码 20（三族一致，见 2.4.1），不用此 prop
  panZoomInitTryCatch: boolean          // mermaid/plantuml false；svg true（warn + null）

  // ── 交互差异 ──
  touchEnabled: boolean                 // mermaid/svg true；plantuml false
  resizeEnabled: boolean                // mermaid/svg true；plantuml false

  // ── refresh 事件差异 ──
  refreshEventName: string              // 'mermaid-refresh'/'plantuml-refresh'/'svg-refresh'

  // ── modal 差异 ──
  modalTitle: string                    // 'Mermaid Diagram'/'PlantUML Diagram'/'SVG Diagram'
  // 注：modal 是 BaseDiagram 内部 Teleport+v-if overlay（非外部二次挂载实例），无 isModal prop。
  //   modal svgContent 复用主图 props.svgContent，modal panZoom 独立实例 maxZoom=20 硬编码。详见 2.4.1
}
```

**差异覆盖核对**（对照 P1 I2 矩阵 24 行）：
- 渲染源 → `svgContent` ✅
- 代码视图高亮（mermaid/plantuml escapeHtml vs svg Shiki 异步）→ useMarkdown renderer 层产出 `codeViewHtml` 填入 `sourcesMap`（见 5.2/4.2），薄包装从 sourcesMap 取 `codeViewHtml` 传入 BaseDiagram props.codeViewHtml，BaseDiagram template 内 `<div class="${prefix}-content code-mode" v-html="codeViewHtml">` 渲染 ✅
- panZoom init 容错 → `panZoomInitTryCatch` ✅
- minZoom/maxZoom → `panZoomMinZoom/MaxZoom`（主图 10；modal panZoom 是 BaseDiagram 内部独立实例，maxZoom 硬编码 20，三族一致，见 2.4.1）✅
- inline/modal PNG 路径 → `downloadPng()`（用挂载 DOM svg）vs `exportToPng(svgContent)`（用 props）✅
- PNG 背景 → `pngBackground` ✅
- PNG viewBox fallback → `pngViewBoxFallback` ✅
- PNG 最终 fallback → `pngFinalSize` ✅
- PNG `<br>` 修复 → `pngBrFix` ✅
- resize-handle → `resizeEnabled` ✅
- touch → `touchEnabled` ✅
- refresh 事件名 → `refreshEventName` ✅
- fullscreen 触发机制（hidden-button hack vs 直接 exposed）→ 统一为 `toggleFullscreen()` 直接调用（废弃 hidden-button hack，技术内部保真，外部行为=点按钮开 modal 不变）✅
- defineExpose 集 → 薄包装 re-expose（见 2.4）✅
- emit 声明 → 仅 BaseDiagram emit，薄包装透传（mermaid 5 emit 保留信号，plantuml/svg 无 emit 薄包装不监听）✅
- modal title → `modalTitle` ✅
- PNG 文件名 → `pngFilenamePrefix` ✅
- 渲染错误处理 → 不在 BaseDiagram（在 composable renderer，见第 4 节）✅
- header label / block CSS class 前缀 → `classPrefix` 派生 ✅

### 2.2 slots

```vue
<BaseDiagram v-bind="props">
  <!-- 默认 slot：薄包装注入渲染源 DOM（仅在需要额外包装时；通常 svgContent 直接渲染） -->
  <template #renderer>
    <!-- 默认：直接 v-html svgContent 到 .xxx-viewer 内 -->
  </template>
</BaseDiagram>
```

默认行为：BaseDiagram 内部 `<div class="${classPrefix}-viewer" v-html="svgContent" />`。slot 仅在薄包装需注入特殊 DOM（如 mermaid 的 tempDiv for getBBox）时覆写。三族默认都用 svgContent 直渲，slot 可空。**结论：slot 非必需，保留作扩展点。**

### 2.3 emits（替代 data-action 的部分 case）

```typescript
const emit = defineEmits<{
  // ── zoom（BLOCKER-4 修订：zoom 不 emit，BaseDiagram 内部 @click 直调 panZoom.zoomIn/zoomOut/reset）──
  //   源码核实：三族 zoom 按钮均在组件模板内 @click="zoomInModal" 直调 modalPanZoomInstance（modal 内），
  //   主图 zoom 通过 touch pinch + wheel（无 zoom 按钮）。handleDelegatedAction 16 case 无 zoom-in/out/reset
  //   （L345-362 实测仅 toggle/fullscreen/menu/download/copy × 3 族 + copy-code-block）。
  //   mermaid 的 emit('zoomIn') 是历史遗留无 handler 的死信号（MarkdownViewer 无 zoom handler），去掉不影响行为。
  //   svg defineExpose 3 项不含 zoomIn（保真 P1 I2），MarkdownViewer 不调 instance.zoomIn() → 无矛盾。
  // ── fullscreen ──
  (e: 'fullscreen', blockId: string | number): void
  // ── download-png（svg inline 委托；mermaid/plantuml inline 走 MarkdownViewer re-render fresh，不 emit 此事件）──
  (e: 'download-png', blockId: string | number): void
  // ── view toggle（P1 I3 差异：mermaid/svg 派发 refresh + 更新 toggle-text；plantuml 仅 toggle is-active）──
  (e: 'toggle-view', blockId: string | number): void
  // ── menu toggle（P1 I3：mermaid/svg 关闭其他+click-outside；plantuml 仅 toggle show）──
  (e: 'toggle-menu', blockId: string | number): void
  // ── copy code（P1 I3：mermaid/svg 有 ✓Copied 反馈；plantuml 仅 console.log）──
  (e: 'copy-code', blockId: string | number): void
  // ── resize（mermaid/svg 有；plantuml 无 → resizeEnabled=false 时不渲染 handle，不 emit）──
  (e: 'start-resize', blockId: string | number, startY: number): void
}>()
```

**关键差异保留策略**：BaseDiagram 只 emit 信号 + blockId，**不实现 handler 业务逻辑**。handler 差异（refresh/toggle-text/click-outside/Copied 反馈）由 MarkdownViewer emit handler 按 `classPrefix` 分族差异化处理（见第 6 节）。这样 BaseDiagram 保持通用，差异不丢失。

### 2.4 defineExpose（公共方法）

```typescript
defineExpose({
  zoomIn,                    // panZoom.zoomIn()
  zoomOut,                   // panZoom.zoomOut()
  resetZoom,                 // panZoom.reset()
  toggleFullscreen,          // 开/关 modal overlay
  refreshPanZoom,            // 销毁+重建 panZoom（响应 refresh 事件）
  getSvgElement,             // 返回挂载的 <svg> DOM
  downloadPng,               // inline 路径：用挂载 DOM svg 转 PNG（svg 用；mermaid/plantuml 不调此，走 MarkdownViewer fresh）
  exportToPng,               // modal 路径：用传入 svgContent 转 PNG（三族 modal 都用）
})
```

**薄包装 re-expose 差异**（保真 P1 I2 defineExpose 集）：
- `MermaidDiagram` / `PlantUmlDiagram`：re-expose 全 8 项（`exportMermaidToPng`/`exportPlantUmlToPng` 别名指向 `exportToPng`）
- `SvgDiagram`：仅 re-expose 3 项（`toggleFullscreen`/`downloadPng`/`refreshPanZoom`），其余不暴露

MarkdownViewer 调用面：`xxxInstances.get(id).toggleFullscreen()` / `svgInstances.get(id).downloadPng()` 签名不变 → 外部行为保真。

### 2.4.1 modal 渲染源设计（BLOCKER-5/D3 修订：废弃 hidden-button hack 后渲染源明确）

**源码核实结论**：原 mermaid/plantuml/svg 的 modal 均是**组件内部** `<Teleport to="body"><div v-if="isFullscreen" class="xxx-modal-overlay">...<div v-html="svgContent">...</div></div></Teleport>`。modal 内 svg 复用**主图 props.svgContent**（同一字符串 v-html 到 modal 内独立 div），不二次渲染、不重新 fetch。modal 内有独立 `modalPanZoomInstance`（maxZoom=20，与主图 panZoomInstance 分离）。`toggleFullscreen()` = `isFullscreen.value = true` + `nextTick(initModalPanZoom)`。

**hidden-button hack 存在原因**（源码 MarkdownViewer L459-469）：`vueRender` 不直接返回组件实例，mermaid/plantuml 的 instance 存的是闭包对象 `{ toggleFullscreen: () => mountPoint.querySelector('.xxx-fullscreen-trigger').click() }`——点击组件内隐藏按钮（`@click="toggleFullscreen"`）间接触发。svg（L564-565）则取真实 vue 实例 `vNode.component.exposed`，直接 `instance.toggleFullscreen()`。

**废弃 hack 后的新路径**：薄包装 re-expose `toggleFullscreen`（指向 BaseDiagram 的 toggleFullscreen），MarkdownViewer `getInstance(prefix, id).toggleFullscreen()` 直接调真实方法。**渲染源不变**——modal 仍复用主图 props.svgContent（薄包装传入的 svgContent，即 sourcesMap 的 svgContent 或外部强制传入）。

```vue
<!-- BaseDiagram.vue template modal 部分 -->
<Teleport to="body">
  <div v-if="isFullscreen" :class="`${classPrefix}-modal-overlay`" @click.self="closeFullscreen">
    <div :class="`${classPrefix}-modal`">
      <div :class="`${classPrefix}-modal-toolbar`">
        <span class="modal-title">{{ modalTitle }}</span>
        <button class="toolbar-btn" @click="zoomInModal" title="Zoom In">+</button>
        <button class="toolbar-btn" @click="zoomOutModal" title="Zoom Out">−</button>
        <button class="toolbar-btn" @click="resetZoomModal" title="Reset">⟲</button>
        <button class="toolbar-btn" @click="handleDownloadPng" title="Download PNG">⬇</button>
        <button class="toolbar-btn close-btn" @click="closeFullscreen" title="Close">×</button>
      </div>
      <div ref="modalContainer" :class="`${classPrefix}-modal-container`" @wheel="onWheelModal">
        <div ref="modalSvgWrapper" class="svg-wrapper" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</Teleport>
```

```typescript
// BaseDiagram 内部状态
const isFullscreen = ref(false)
let modalPanZoomInstance: any = null

function toggleFullscreen() {
  isFullscreen.value = true
  emit('fullscreen', props.blockId)   // 通知 MarkdownViewer（可选，保真 mermaid emit）
  nextTick(async () => { await initModalPanZoom() })   // modal panZoom 独立初始化，maxZoom 硬编码 20
}
function closeFullscreen() {
  isFullscreen.value = false
  modalPanZoomInstance?.destroy()
  modalPanZoomInstance = null
}
// zoom 按钮直调 modalPanZoomInstance（组件内部，不 emit，见 2.3 BLOCKER-4 修订）
function zoomInModal() { modalPanZoomInstance?.zoomIn() }
function zoomOutModal() { modalPanZoomInstance?.zoomOut() }
function resetZoomModal() { modalPanZoomInstance?.reset(); modalPanZoomInstance?.center() }
// modal 内 PNG：用 props.svgContent（exportToPng 路径，三族 modal 一致）
```

**BDD 维度 2 fullscreen 对应**：
- `xxx-modal-overlay` 遮罩出现 ✅（v-if isFullscreen）
- `modal-title` 文本 = modalTitle prop ✅（'Mermaid Diagram' 等）
- 遮罩内 `<svg>` 可见 ✅（v-html svgContent，复用主图）
- Escape 关闭 ✅（closeFullscreen，保真原 close-btn + overlay click.self）

**为何不是二次挂载实例**：源码 modal 是同实例 overlay（Teleport+v-if），非 MarkdownViewer 挂载第二个 BaseDiagram。新方案保真此结构。modal panZoom 独立实例（maxZoom=20）在 BaseDiagram 内部 initModalPanZoom 硬编码，不依赖 props.panZoomMaxZoom（那是主图的 10）。

### 2.5 PNG 导出实现（BaseDiagram 内部，参数化差异）

```typescript
// 工具函数（也可由 useCodeBlockRenderer 复用，见第 4 节）
async function svgToPng(svgString: string, opts: {
  background: '#ffffff' | 'transparent'
  viewBoxFallback: 'g-root-getBBox' | 'width-height-attrs'
  finalSize: { width: number; height: number }
  brFix: boolean
  filename: string
}): Promise<void> {
  if (opts.brFix) svgString = svgString.replace(/<br>/g, '<br/>')
  // 解析 viewBox：
  //   g-root-getBBox: 注入 tempDiv → querySelector('g.root') → getBBox() (mermaid 专有)
  //   width-height-attrs: 读 <svg width height> 属性
  // fallback 到 opts.finalSize (800×600 或 400×300)
  // canvas 2d: if background==='#ffffff' fillRect('#ffffff')；transparent 跳过（alpha=0）
  // Image → drawImage → toBlob → download (filename=opts.filename)
}

async function downloadPng() {
  const svgEl = getSvgElement(); if (!svgEl) return
  await svgToPng(svgEl.outerHTML, { /* 从 props 拼 */ })
}
async function exportToPng(svgContent: string) {
  await svgToPng(svgContent, { /* 同 props */ })
}
```

### 2.6 行数预算

| 部分 | 行数 |
|------|------|
| `<template>`（block 容器 + header + toggle/menu/copy/png/fullscreen 按钮 + content[diagram viewer + code 视图 v-html codeViewHtml] + resize handle + modal overlay[Teleport+v-if+modalPanZoom] + viewer mount） | ~130 |
| `<script setup>`（props/emits/expose + panZoom init/destroy + zoom/fullscreen/pan + svgToPng + refresh 监听 + touch 处理） | ~180 |
| `<style>`（通用 block 基础样式，差异样式由薄包装补充） | ~80 |
| 合计 | < 400 ✅ |

## 第 3 节：三个子组件薄包装设计

> 每个薄包装职责：① 调 useCodeBlockRenderer 获取/注入渲染源 ② 向 BaseDiagram 传差异 props ③ 选择性 re-expose 方法。目标 < 150 行/个。

### 3.1 MermaidDiagram.vue（< 150 行）

**差异点配置**（对照 P1 I2 + progress MermaidDiagram 598 行现状）：
```typescript
const props = defineProps<{
  code: string              // mermaid 源码
  theme: 'light' | 'dark'
  blockId: string | number
  blockIndex: number
  svgContent?: string       // 外部强制传入时优先用（默认从 sourcesMap 取）
}>()

// 调 composable 获取渲染后的 svgContent（走 mermaidCache）+ code 视图 HTML
const renderer = useCodeBlockRenderer()
// 按 blockIndex 查 sourcesMap（preRender 已填，见 4.3）；外部传入 props.svgContent 时优先用
const svgContent = computed(() => props.svgContent ?? renderer.getMermaidSvgByIndex(props.blockIndex))
const codeViewHtml = computed(() => renderer.getCodeViewHtml(props.blockIndex) ?? '')

// 差异 props（硬编码 mermaid 专有）
const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: codeViewHtml.value,
  blockId: props.blockId, blockIndex: props.blockIndex, classPrefix: 'mermaid' as const,
  theme: props.theme,
  pngBackground: '#ffffff' as const,
  pngViewBoxFallback: 'g-root-getBBox' as const,   // mermaid 专有：注入 tempDiv → g.root getBBox
  pngFinalSize: { width: 800, height: 600 },
  pngBrFix: true,                                    // <br>→<br/>
  pngFilenamePrefix: 'mermaid-diagram',
  panZoomMinZoom: 0.1, panZoomMaxZoom: 10,            // 主图 10；modal panZoom 内部独立实例 maxZoom 硬编码 20（见 2.4.1）
  panZoomInitTryCatch: false,                        // mermaid 无 try-catch
  touchEnabled: true, resizeEnabled: true,
  refreshEventName: 'mermaid-refresh',
  modalTitle: 'Mermaid Diagram',
}))
```

**emit 5 事件**（mermaid 当前有，薄包装声明 re-emit；实际 handler 在 MarkdownViewer）：
```typescript
defineEmits(['zoom-in', 'zoom-out', 'reset', 'fullscreen', 'download-png'])
// 薄包装不实现业务，仅声明让 attrs 不被吞；BaseDiagram emit 透传到 MarkdownViewer
```

**defineExpose 8 项**（保真）：
```typescript
const baseRef = ref()
defineExpose({
  zoomIn: () => baseRef.value?.zoomIn(),
  zoomOut: () => baseRef.value?.zoomOut(),
  resetZoom: () => baseRef.value?.resetZoom(),
  toggleFullscreen: () => baseRef.value?.toggleFullscreen(),
  refreshPanZoom: () => baseRef.value?.refreshPanZoom(),
  getSvgElement: () => baseRef.value?.getSvgElement(),
  downloadPng: () => baseRef.value?.downloadPng(),
  exportMermaidToPng: (svg: string) => baseRef.value?.exportToPng(svg),  // modal 别名
})
```

**template**（极薄）：
```vue
<template>
  <BaseDiagram ref="baseRef" v-bind="baseProps" v-on="$attrs" />
</template>
```

**inline PNG re-render fresh**：mermaid 的 inline download 走 MarkdownViewer handler，调 `renderer.renderMermaidFresh(code, theme)` 生成 fresh SVG（非挂载 DOM），再调 `BaseDiagram.svgToPng`。薄包装不参与 inline PNG（保真 P1 I2「mermaid/plantuml inline 在 MarkdownViewer re-render fresh」）。

**行数预算**：~90 行（script + template + style）。

### 3.2 PlantUmlDiagram.vue（< 150 行）

**差异点配置**（对照 P1 I2 + progress PlantUmlDiagram 416 行现状）：
```typescript
const props = defineProps<{
  code: string; theme: 'light' | 'dark'
  blockId: string | number; blockIndex: number
  svgContent?: string
}>()
const renderer = useCodeBlockRenderer()
const svgContent = computed(() => props.svgContent ?? renderer.getPlantUmlSvgByIndex(props.blockIndex))
const codeViewHtml = computed(() => renderer.getCodeViewHtml(props.blockIndex) ?? '')

const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: codeViewHtml.value,
  blockId: props.blockId, blockIndex: props.blockIndex, classPrefix: 'plantuml' as const,
  theme: props.theme,
  pngBackground: '#ffffff' as const,                  // 白底
  pngViewBoxFallback: 'width-height-attrs' as const, // 读 svg width/height 属性
  pngFinalSize: { width: 800, height: 600 },
  pngBrFix: false,                                    // 无 br 修复
  pngFilenamePrefix: 'plantuml-diagram',
  panZoomMinZoom: 0.1, panZoomMaxZoom: 10,            // 主图 10；modal 内部独立 maxZoom 20（见 2.4.1）
  panZoomInitTryCatch: false,                         // plantuml 无 try-catch
  touchEnabled: false,                                // ★ 无 touch（保真 P1 I2）
  resizeEnabled: false,                               // ★ 无 resize-handle（保真 P1 I2）
  refreshEventName: 'plantuml-refresh',
  modalTitle: 'PlantUML Diagram',
}))
```

**无 emit**：`defineEmits([])`（plantuml 现状无 emit → 薄包装不声明，attrs 自动 fallthrough 到 BaseDiagram，BaseDiagram 的 emit 仍可达 MarkdownViewer handler；handler 按 classPrefix='plantuml' 走「无 refresh/无 toggle-text/无 click-outside/无 Copied」分支保真）。

**defineExpose 8 项**（结构同 mermaid，别名 `exportPlantUmlToPng`）。

**串行约束保留**（P1 I5）：`renderer.getPlantUmlSvg` 内部调 `usePlantUML.render`，该函数保留模块级 `renderQueue` Promise 链串行（usePlantUML 不改）。薄包装不并行化，不引入 `Promise.all`。**关键保真点**。

**inline PNG re-render fresh**：同 mermaid，走 MarkdownViewer handler + `renderer.renderPlantUmlFresh` + `BaseDiagram.svgToPng`（白底/800×600/无 brFix）。

**行数预算**：~85 行。

### 3.3 SvgDiagram.vue（< 150 行）

**差异点配置**（对照 P1 I2 + progress SvgDiagram 478 行现状）：
```typescript
const props = defineProps<{
  code: string              // 原始 svg 源码（经 DOMPurify 净化后传入，见 useMarkdown 第 5 节）
  theme: 'light' | 'dark'
  blockId: string | number; blockIndex: number
  svgContent?: string
}>()
const renderer = useCodeBlockRenderer()
// svg 无渲染器，直接用净化后的 code（DOMPurify 在 useMarkdown 已处理，T020 安全债保留）
const svgContent = computed(() => props.svgContent ?? props.code)
// svg code 视图 = Shiki 异步高亮输出，preRender 阶段 await 填入 sourcesMap.codeViewHtml（见 5.2）
const codeViewHtml = computed(() => renderer.getCodeViewHtml(props.blockIndex) ?? '')

const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: codeViewHtml.value,
  blockId: props.blockId, blockIndex: props.blockIndex, classPrefix: 'svg' as const,
  theme: props.theme,
  pngBackground: 'transparent' as const,               // ★ 透明 alpha=0，不调 fillRect
  pngViewBoxFallback: 'width-height-attrs' as const,
  pngFinalSize: { width: 400, height: 300 },          // ★ 400×300（非 800×600）
  pngBrFix: false,
  pngFilenamePrefix: 'svg-diagram',
  panZoomMinZoom: 0.1, panZoomMaxZoom: 10,            // 主图 10；modal 内部独立 maxZoom 20（见 2.4.1）
  panZoomInitTryCatch: true,                           // ★ svg 有 try-catch（warn + null）
  touchEnabled: true, resizeEnabled: true,
  refreshEventName: 'svg-refresh',
  modalTitle: 'SVG Diagram',
}))
```

**无 emit**：同 plantuml，`defineEmits([])`，attrs fallthrough。

**defineExpose 3 项**（保真 P1 I2「svg 仅 toggleFullscreen/downloadPng/refreshPanZoom」）：
```typescript
defineExpose({
  toggleFullscreen: () => baseRef.value?.toggleFullscreen(),
  downloadPng: () => baseRef.value?.downloadPng(),       // ★ inline 委托组件（非 re-render fresh）
  refreshPanZoom: () => baseRef.value?.refreshPanZoom(),
})
```

**inline PNG 委托 downloadPng**：svg 的 inline download 走 `svgInstances.get(id).downloadPng()`（调 BaseDiagram.downloadPng 用挂载 DOM svg → svgToPng 透明背景/400×300）。**不**走 MarkdownViewer re-render fresh（保真 P1 I2「svg inline 委托组件 downloadPng」）。

**DOMPurify 净化位置**（T020 安全债硬约束）：净化发生在 useMarkdown.render 阶段（renderer 层，见第 5 节），svg code 在进入薄包装前已净化。薄包装直接用 props.code 作 svgContent，不再二次净化。P6 须验证：svgContent 不含 `<script>`/`onclick`/`foreignObject`。

**行数预算**：~90 行。

### 3.4 三薄包装差异速查（P4 实现参照）

| 维度 | Mermaid | PlantUML | SVG |
|------|---------|----------|-----|
| pngBackground | `#ffffff` | `#ffffff` | `transparent` |
| pngViewBoxFallback | `g-root-getBBox` | `width-height-attrs` | `width-height-attrs` |
| pngFinalSize | 800×600 | 800×600 | 400×300 |
| pngBrFix | true | false | false |
| panZoomInitTryCatch | false | false | true |
| touchEnabled | true | **false** | true |
| resizeEnabled | true | **false** | true |
| refreshEventName | mermaid-refresh | plantuml-refresh | svg-refresh |
| modalTitle | Mermaid Diagram | PlantUML Diagram | SVG Diagram |
| classPrefix | mermaid | plantuml | svg |
| defineExpose | 8 项 | 8 项 | **3 项** |
| emit 声明 | 5 事件 | 无 | 无 |
| inline PNG | MarkdownViewer fresh | MarkdownViewer fresh | 组件 downloadPng |
| 渲染串行 | — | **usePlantUML.renderQueue** | — |

## 第 4 节：useCodeBlockRenderer composable 设计

> 定位：从 MarkdownViewer 迁出渲染状态 + 渲染调用，供 MarkdownViewer 与薄包装共享。目标 < 200 行。

### 4.1 迁出的状态变量（对照 progress 41 行清单）

| 变量 | 原位置（MarkdownViewer） | 迁入 composable | 类型 |
|------|--------------------------|-----------------|------|
| `mermaidCache` | ref Map | `mermaidCache` | `Map<string, string>` key=`${theme}-${code}` |
| `mermaidSourcesMap` | ref Map | `sourcesMap`（合并） | 见 4.2 |
| `plantumlSourcesMap` | ref Map | `sourcesMap`（合并） | 同上 |
| `svgSourcesMap` | ref Map | `sourcesMap`（合并） | 同上 |
| `renderToken` | ref number | `renderToken` | `Ref<number>` |
| `mermaidInstances` | ref Map | `instances.mermaid` | `Map<string, ComponentPublicInstance>` |
| `plantumlInstances` | ref Map | `instances.plantuml` | 同上 |
| `svgInstances` | ref Map | `instances.svg` | 同上 |
| `resizingBlock` | ref | `resizingBlock` | `Ref<string \| null>` |
| `startY` | ref | `startY` | `Ref<number>` |
| `startHeight` | ref | `startHeight` | `Ref<number>` |

### 4.2 sourcesMap 合并设计（技术内部保真）

```typescript
// 原：三个独立 Map<number, string>（mermaidSources/plantumlSources/svgSources）
// 新：统一 sourcesMap，key=index, value 带类型标记
interface BlockSource {
  lang: 'mermaid' | 'plantuml' | 'svg'
  code: string                 // 原始源码（svg 已经 DOMPurify 净化）
  svgContent?: string          // 渲染后 SVG（mermaid/plantuml 渲染后填，svg 等于 code）
  codeViewHtml?: string        // code 视图 HTML（mermaid/plantuml=escapeHtml 同步；svg=Shiki 异步高亮，preRender 阶段 await 填入）。薄包装挂载时从此取值传 BaseDiagram props.codeViewHtml。详见 5.2
  error?: string               // 渲染错误标记（preRender 抛错时填，如 'Failed to render diagram'）。mount 阶段 MarkdownViewer 检查此字段决定错误 UI。详见 4.4 错误处理流程
}
const sourcesMap = new Map<number, BlockSource>()
```

**API 兼容判定**（P1 I1）：`render()` 返回值从 `{ html, headings, mermaidSources, plantumlSources, svgSources }` 改为 `{ html, headings, sources }`。progress 已确认下游消费者仅 MarkdownViewer（L386-392），EntryDetailView 不消费 render() 返回值。→ **技术内部保真，非 breaking**。MarkdownViewer 同步改消费 `result.sources`。EntryDetailView 调用面（`:content` + headings emit）零改动。

### 4.3 composable 公开 API

```typescript
export function useCodeBlockRenderer() {
  // ── 状态（4.1 表）──
  const mermaidCache = new Map<string, string>()
  const sourcesMap = new Map<number, BlockSource>()
  const renderToken = ref(0)
  const instances = {
    mermaid: new Map<string, ComponentPublicInstance>(),
    plantuml: new Map<string, ComponentPublicInstance>(),
    svg: new Map<string, ComponentPublicInstance>(),
  }
  const resizingBlock = ref<string | null>(null)
  const startY = ref(0)
  const startHeight = ref(0)

  // ── 渲染源获取（薄包装 computed 调用，按 blockIndex 查 sourcesMap）──
  // preRender 阶段已 await 填入 sourcesMap，薄包装挂载时同步取值。查找键统一为 blockIndex（number），
  //   不再用 code（薄包装持有 blockIndex，sourcesMap 以 index 为 key）。mermaidCache 仍以 `${theme}-${code}` 为 key
  //   （cache 内部查找），但薄包装不直接查 cache——薄包装查 sourcesMap，sourcesMap miss 时返回空（preRender 应已填）。
  function getMermaidSvgByIndex(index: number): string {
    return sourcesMap.get(index)?.svgContent ?? ''
  }
  function getPlantUmlSvgByIndex(index: number): string {
    return sourcesMap.get(index)?.svgContent ?? ''
  }
  function getCodeViewHtml(index: number): string | undefined {
    return sourcesMap.get(index)?.codeViewHtml
  }
  function getError(index: number): string | undefined {
    return sourcesMap.get(index)?.error
  }

  // ── 预渲染（MarkdownViewer.renderContent 内调，填 sourcesMap + cache）──
  // 错误处理策略（BLOCKER-2 修订）：preRender 抛错时 composable 在 sourcesMap.set(index, { ..., error })
  //   标记错误（不操作 DOM——preRender 在 v-html 前执行，mountPoint 不存在）。mount 阶段 MarkdownViewer
  //   挂载循环检查 source.error 决定错误 UI（见 4.4 错误处理流程图）。
  async function preRenderMermaid(index: number, code: string, theme: string, codeViewHtml: string): Promise<void> {
    const key = `${theme}-${code}`
    try {
      let svg = mermaidCache.get(key)
      if (!svg) {
        svg = await useMermaid.render(index, code, theme)   // 5s timeout 保留
        mermaidCache.set(key, svg)
      }
      sourcesMap.set(index, { lang: 'mermaid', code, svgContent: svg, codeViewHtml })
    } catch (err) {
      console.error('Mermaid render failed:', err)
      sourcesMap.set(index, { lang: 'mermaid', code, codeViewHtml, error: 'Failed to render diagram' })
    }
  }
  async function preRenderPlantUml(index: number, code: string, theme: string, codeViewHtml: string): Promise<void> {
    try {
      const svg = await usePlantUML.render(code, theme)     // ★ 走模块级 renderQueue 串行（P1 I5 保留）
      sourcesMap.set(index, { lang: 'plantuml', code, svgContent: svg, codeViewHtml })
    } catch (err) {
      console.error('PlantUML render failed:', err)
      // plantuml 错误标记：mount 阶段切 code 视图 + dataset.rendered=true（保真原 L518-528 行为）
      sourcesMap.set(index, { lang: 'plantuml', code, codeViewHtml, error: 'plantuml-validate-failed' })
    }
  }
  async function registerSvg(index: number, code: string, theme: string): Promise<void> {
    // svg 无渲染器；DOMPurify 净化在 useMarkdown 层（第 5 节），此处存净化后 code
    // svg code 视图 Shiki 异步高亮：preRender 阶段 await 填 codeViewHtml（见 5.2 renderCodeViewAsync）
    let codeViewHtml = ''
    try {
      codeViewHtml = await highlightCode(code, 'xml', theme)   // 异步 Shiki
    } catch (err) {
      console.error('SVG Shiki highlight failed:', err)
      // Shiki 失败不阻断，codeViewHtml 留空（保真：原 svg code 视图 Shiki 失败也留空占位）
    }
    // svg 渲染错误（解析失败）保留在 mount 阶段 vueRender try/catch（保真原 L566-569），不在此标记
    sourcesMap.set(index, { lang: 'svg', code, svgContent: code, codeViewHtml })
  }

  // ── fresh SVG（inline PNG re-render，mermaid/plantuml 专用）──
  async function renderMermaidFresh(code: string, theme: string): Promise<string> {
    return await useMermaid.render(Date.now(), code, theme)  // 非 cache，fresh
  }
  async function renderPlantUmlFresh(code: string, theme: string): Promise<string> {
    return await usePlantUML.render(code, theme)             // 串行队列保留
  }

  // ── PNG 工具（BaseDiagram.downloadPng/exportToPng + MarkdownViewer fresh handler 复用）──
  async function svgToPng(svgString: string, opts: PngOptions): Promise<void> { /* 见 2.5 */ }

  // ── renderToken 防竞态（P1 I4 保留）──
  function nextToken(): number { return ++renderToken.value }
  function isCurrent(token: number): boolean { return token === renderToken.value }

  // ── instance 注册 ──
  function registerInstance(lang: string, id: string, inst: ComponentPublicInstance) {
    instances[lang].set(id, inst)
  }
  function unregisterInstance(lang: string, id: string) { instances[lang].delete(id) }
  function getInstance(lang: string, id: string) { return instances[lang].get(id) }

  // ── resize 状态（start-resize handler 用，P1 I3）──
  function beginResize(id: string, y: number, h: number) {
    resizingBlock.value = id; startY.value = y; startHeight.value = h
  }
  function endResize() { resizingBlock.value = null }

  // ── 清理（组件 unmount / 主题切换重渲染前）──
  function clearInstances() {
    instances.mermaid.clear(); instances.plantuml.clear(); instances.svg.clear()
  }

  return {
    mermaidCache, sourcesMap, renderToken, instances,
    resizingBlock, startY, startHeight,
    getMermaidSvgByIndex, getPlantUmlSvgByIndex, getCodeViewHtml, getError,
    preRenderMermaid, preRenderPlantUml, registerSvg,
    renderMermaidFresh, renderPlantUmlFresh, svgToPng,
    nextToken, isCurrent,
    registerInstance, unregisterInstance, getInstance,
    beginResize, endResize, clearInstances,
  }
}
```

### 4.4 renderToken 防竞态保留（P1 I4 硬约束）

**问题**：原 MarkdownViewer 8 个 async 边界后检查 `if (myToken !== renderToken) return`（L387/396/414/416/484/489/500/539）。若 composable 把渲染封装成不透明调用，检查点丢失 → 主题快速切换旧 SVG 覆盖新 SVG。

**方案**：composable **不封装不透明 render 调用**。`nextToken()`/`isCurrent()` 仅暴露 token 管理，检查点留在 MarkdownViewer.renderContent 显式调用：

```typescript
// MarkdownViewer.renderContent 内
const myToken = renderer.nextToken()
const result = await useMarkdown().render(content, theme)
if (!renderer.isCurrent(myToken)) return                    // 检查点 1
// 预渲染三族
await renderer.preRenderMermaid(...)                         // 每个 block
if (!renderer.isCurrent(myToken)) return                    // 检查点 2
html.value = result.html
await nextTick()
if (!renderer.isCurrent(myToken)) return                    // 检查点 3
// 挂载组件循环
for (const [index, source] of renderer.sourcesMap) {
  if (!renderer.isCurrent(myToken)) return                  // 检查点 4
  // mountDiagram...
}
// ...其余检查点对应原 8 个
```

**保真**：8 个检查点全部保留在 MarkdownViewer 显式位置，语义与原一致。composable 不吞检查。

#### 4.4.1 错误处理流程图（BLOCKER-2 修订：composable 标记 → mount 阶段消费）

**时序矛盾根因**：原 MarkdownViewer L425-571 把「调渲染器」与「写错误 DOM」耦合在同一 try/catch（mountPoint 此时已存在，v-html + nextTick 后）。新方案拆 composable.preRender（v-html 前，无 mountPoint）+ MarkdownViewer.mount（v-html 后，有 mountPoint）两处 → preRender 抛错时无 mountPoint 可写错误 UI。修订：preRender 只标记 error（不操作 DOM），mount 阶段消费 error 标记写错误 UI。

```
renderContent()
  │
  ├─ preRender 阶段（v-html 前，composable 内）
  │   ├─ preRenderMermaid(index, code, theme, codeViewHtml)
  │   │   try { useMermaid.render → sourcesMap.set(index, { svgContent, codeViewHtml }) }
  │   │   catch { sourcesMap.set(index, { codeViewHtml, error: 'Failed to render diagram' }) }  ← 标记，不操作 DOM
  │   ├─ preRenderPlantUml(index, code, theme, codeViewHtml)
  │   │   try { usePlantUML.render → sourcesMap.set(index, { svgContent, codeViewHtml }) }
  │   │   catch { sourcesMap.set(index, { codeViewHtml, error: 'plantuml-validate-failed' }) }  ← 标记
  │   └─ registerSvg(index, code, theme)
  │       try { highlightCode → sourcesMap.set(index, { svgContent:code, codeViewHtml }) }
  │       catch { sourcesMap.set(index, { svgContent:code, codeViewHtml:'' }) }  ← Shiki 失败不阻断
  │
  ├─ html.value = result.html   ← v-html（占位容器 + codeViewHtml 已在 sourcesMap）
  ├─ await nextTick()           ← mountPoint 此时存在
  │
  └─ mount 阶段（MarkdownViewer 挂载循环，每个 source）
      ├─ const source = renderer.sourcesMap.get(index)
      ├─ if (source.error)  ← 检查错误标记
      │   ├─ mermaid error → mountPoint.innerHTML = '<div class="mermaid-error">Failed to render diagram</div>'
      │   │                   （不挂载 MermaidDiagram 组件，保真原 L470-473）
      │   ├─ plantuml error → 切 code 视图（diagram-mode 移除 is-active + code-mode 加 is-active）
      │   │                     + dataset.rendered='true'（不重试，保真原 L520-527）
      │   └─ （svg error 不在此分支——svg 渲染错误在下面 vueRender catch 兜底）
      ├─ else
      │   try { h(Wrapper, props) + vueRender(vNode, mountPoint) + registerInstance }
      │   catch {  ← vueRender 自身抛错兜底（如 svg 解析失败，保真原 L566-569）
      │     if (lang==='svg') mountPoint.innerHTML = '<div class="svg-error">Failed to render SVG</div>'
      │     // mermaid/plantuml vueRender 极少抛错（preRender 已渲染），但保留 catch 兜底
      │   }
      └─ dataset.rendered='true'（成功或错误处理后均标记，防重试）
```

**BDD 维度 9 三条逐条对应**：
- mermaid render 抛错 → preRenderMermaid catch 标记 error → mount 阶段 mountPoint.innerHTML = mermaid-error div ✅（字符级保真 '<div class="mermaid-error">Failed to render diagram</div>'）
- plantuml validateSource 失败 → preRenderPlantUml catch 标记 error → mount 阶段切 code 视图 + dataset.rendered=true ✅（保真原 L520-527）
- svg 解析失败 → mount 阶段 vueRender catch 兜底 → mountPoint.innerHTML = svg-error div ✅（保真原 L566-569）

**为何不把 svg 错误也迁 preRender**：原 svg 错误发生在 mount 阶段 vueRender（挂载组件时 svg 解析），非 preRender（registerSvg 只存 code，无渲染）。保真原时序，svg 错误保留 mount 阶段 vueRender catch。

### 4.5 串行约束保留（P1 I5 硬约束）

**方案**：`preRenderPlantUml` / `renderPlantUmlFresh` 直接调 `usePlantUML.render(code, theme)`。`usePlantUML` 模块级 `renderQueue: Promise<unknown>`（L13、L62-72）**完全不动**。composable 不引入 `Promise.all` 并行化 plantuml 渲染。

**并行化边界**（建议-3 收紧）：**禁止**对所有 diagram 预渲染使用 `Promise.all`（含 mermaid/svg/plantuml），保留原始串行 `for...of await` 循环。mermaid 库内部状态（securityLevel:'strict' 全局配置、mermaidAPI 全局）是否真无共享未经源码验证，并行化有静默覆盖风险。仅允许 cache 命中时同步跳过 preRender 渲染调用。**严禁** `Promise.all` 包裹 plantuml（P1 I5 硬约束）。

### 4.6 行数预算

| 部分 | 行数 |
|------|------|
| 状态声明 + 类型 | ~30 |
| 渲染源获取/预渲染/fresh | ~60 |
| svgToPng 工具 | ~40 |
| renderToken/instance/resize 管理 | ~40 |
| return 导出 | ~20 |
| 合计 | < 200 ✅ |

## 第 5 节：useMarkdown 注册模式设计

> 定位：识别 fenced code block → 查表路由 → 生成 block HTML。不再显式 `if (lang === 'mermaid'|'plantuml'|'svg')` 三分支。

### 5.1 渲染器注册表结构

```typescript
// 通用元数据（差异点参数化），非完整 renderer 对象——通用渲染逻辑留在 useMarkdown
interface DiagramTypeMeta {
  lang: 'mermaid' | 'plantuml' | 'svg' | string   // fence 语言
  classPrefix: string                              // 'mermaid'/'plantuml'/'svg' → CSS class + label 派生
  label: string                                    // 'MERMAID'/'PLANTUML'/'SVG'
  codeViewHighlighter: 'escape-html' | 'shiki-xml' // mermaid/plantuml=escapeHtml 同步；svg=Shiki 异步
  sanitize?: (code: string) => string              // svg 专用：DOMPurify 净化（T020 安全债）
}

const diagramRegistry = new Map<string, DiagramTypeMeta>([
  ['mermaid',  { lang: 'mermaid',  classPrefix: 'mermaid',  label: 'MERMAID',  codeViewHighlighter: 'escape-html' }],
  ['plantuml', { lang: 'plantuml', classPrefix: 'plantuml', label: 'PLANTUML', codeViewHighlighter: 'escape-html' }],
  ['svg',      { lang: 'svg',      classPrefix: 'svg',      label: 'SVG',
                 codeViewHighlighter: 'shiki-xml',
                 sanitize: (code) => DOMPurify.sanitize(code, SVG_SANITIZE_CONFIG) }],
])

// 注册 API（可扩展性目标：1 行注册）
export function registerDiagramType(meta: DiagramTypeMeta) {
  diagramRegistry.set(meta.lang, meta)
}
```

**可扩展性验证**（P0 量化验收）：新增图表类型（如 `d2`）→ ① 新增 `D2Diagram.vue` 薄包装 ② `registerDiagramType({ lang:'d2', classPrefix:'d2', label:'D2', codeViewHighlighter:'escape-html' })` 1 行。不需改 useMarkdown 核心 / useCodeBlockRenderer / BaseDiagram。✅ 达标。

### 5.2 现有三分支 if/else → 查表路由

**原（伪代码）**：
```typescript
if (lang === 'mermaid')  { blockHtml = renderMermaidBlock(...) }
else if (lang === 'plantuml') { blockHtml = renderPlantUmlBlock(...) }
else if (lang === 'svg') { blockHtml = renderSvgBlock(...) }
else { blockHtml = defaultCodeBlock(code, lang, theme, index) }
```

**新（查表）**：
```typescript
const meta = diagramRegistry.get(lang)
let blockHtml: string
if (meta) {
  const safeCode = meta.sanitize ? meta.sanitize(code) : code   // svg 净化（T020）
  const codeViewHtml = renderCodeView(meta, safeCode, theme, index)
  blockHtml = renderDiagramBlockWrapper(meta, index, codeViewHtml)
  sources.set(index, { lang, code: safeCode })                  // 填 sourcesMap（composable 预渲染消费）
} else {
  blockHtml = await defaultCodeBlock(code, lang, theme, index)   // Shiki 高亮（含 code/markdown/html/image）
}
// 替换占位符 <!--CODE_BLOCK_N-->
```

**通用渲染函数**（差异由 meta 参数化，不重复 85% 结构）：
```typescript
// 同步产出 code 视图 HTML（mermaid/plantuml）。svg 的 Shiki 高亮为异步，见 renderCodeViewAsync。
function renderCodeView(meta, code, theme, index): string {
  // diagram 视图占位：<div class="${prefix}-viewer-mount" data-block-id=...></div>
  //   —— 占位容器，MarkdownViewer 挂载整个 BaseDiagram wrapper 到此（见 6.1）
  // code 视图（escape-html 分支，mermaid/plantuml）：escapeHtml(code) 同步输出
  //   —— 返回的字符串存入 sourcesMap.codeViewHtml（见 renderDiagramBlockWrapper 后 sources.set）
  if (meta.codeViewHighlighter === 'escape-html') return escapeHtml(code)
  // shiki-xml 分支（svg）走 renderCodeViewAsync，此处返回空占位
  return ''
}

// svg 专用：异步 Shiki 高亮，preRender 阶段 await 填入 sourcesMap.codeViewHtml
//   —— 关键时机决策：原 useMarkdown 在 v-html 后二轮替换占位符（mountPoint 已存在）。
//   新方案把 code 视图 HTML 迁入 BaseDiagram v-html（template 内），故 codeViewHtml 必须在
//   v-html 前就绪 → preRender 阶段（composable）await highlightCode 后填 sourcesMap.codeViewHtml。
//   不在 mount 阶段二轮填充（避免 BaseDiagram 挂载后 code 视图空白闪烁）。
async function renderCodeViewAsync(meta, code, theme, index): Promise<string> {
  if (meta.codeViewHighlighter === 'shiki-xml') return await highlightCode(code, 'xml', theme)
  return renderCodeView(meta, code, theme, index)
}

function renderDiagramBlockWrapper(meta, index, codeViewHtml): string {
  // 通用 block 结构：header(label + toggle-btn + menu) + content[diagram viewer-mount 占位 + code 视图占位]
  //   —— 注意：code 视图的 HTML 不在此 wrapper 内联（已迁 BaseDiagram template v-html codeViewHtml）
  //   wrapper 仅产出占位容器 + data-block-id/data-index/data-lang，BaseDiagram 挂载后渲染完整 block
  // resize-handle 由 BaseDiagram 按 resizeEnabled prop 决定是否渲染（不在 wrapper HTML 内）
}
```

**数据流补全（code 视图 HTML 路径）**：useMarkdown.render → 对每个 block：① `const codeViewHtml = meta.codeViewHighlighter==='shiki-xml' ? '' : renderCodeView(meta, safeCode, theme, index)`（同步 escapeHtml）② `sources.set(index, { lang, code: safeCode, codeViewHtml })`（先填同步部分）③ `blockHtml = renderDiagramBlockWrapper(meta, index, codeViewHtml)` → 占位符替换 → DOMPurify 整体净化 → 返回 `{ html, headings, sources }`。MarkdownViewer.renderContent 拿到 result 后，调 `renderer.preRenderMermaid/preRenderPlantUml/registerSvg`：mermaid/plantuml 内部 await 渲染器 + 填 `sourcesMap.set(index, { ..., svgContent, codeViewHtml: sources.get(index).codeViewHtml })`；svg 内部 `const ch = await renderCodeViewAsync(meta, code, theme, index); sourcesMap.set(index, { ..., codeViewHtml: ch })`（svg 的异步 Shiki 在 preRender await 完成）。薄包装挂载时 `renderer.getCodeViewHtml(index)` 取值传 BaseDiagram props.codeViewHtml。**svg 异步 Shiki 时机锁定为 preRender 阶段 await**（非 mount 二轮），与 BLOCKER-2 错误处理时序一致。

### 5.3 公开 API 兼容声明

**原签名**：
```typescript
useMarkdown().render(content, theme): Promise<{
  html: string; headings: Heading[];
  mermaidSources: Map<number,string>;
  plantumlSources: Map<number,string>;
  svgSources: Map<number,string>;
}>
```

**新签名**：
```typescript
useMarkdown().render(content, theme): Promise<{
  html: string; headings: Heading[];
  sources: Map<number, BlockSource>;   // 合并三 Map，BlockSource 见 4.2
}>
```

**兼容判定**（progress L25-30 + P1 I1）：
- 下游消费者：**仅 MarkdownViewer**（L386-392 解构 result）。EntryDetailView 不消费 render() 返回值（progress 实测）。
- MarkdownViewer 同步改消费 `result.sources`，遍历调 `renderer.preRenderXxx`。
- EntryDetailView 调用面：`:content` 输入 + dormant `:headings` fallthrough + `@select-heading` 哑监听 → **零改动**（progress 确认真实外部契约仅 `:content`）。
- → **API 非 breaking（对 EntryDetailView），对 MarkdownViewer 是技术内部改动（同步改）**。

### 5.4 DOMPurify 净化保留位置（T020 安全债硬约束）

**两层净化，全部保留**：

1. **svg code 专属净化**（`meta.sanitize`）：在 `renderCodeView` 前，对 svg 源码调 `DOMPurify.sanitize(code, SVG_SANITIZE_CONFIG)`，剥除 `<script>`/`onclick`/`foreignObject` 等。净化后 code 存入 sourcesMap，传 SvgDiagram 薄包装。**位置不变**（原在 useMarkdown svg 分支，现迁入 svg meta.sanitize）。
2. **整体 HTML 净化**（末尾）：`DOMPurify.sanitize(finalHtml, { ADD_ATTR: ['data-action','data-block-id','data-index','data-mode','data-code','data-line','target','rel'], ADD_TAGS: ['button'] })`。**完全保留**（原 useMarkdown L363，末尾不变）。

**P6 验证点**（BDD 维度 5）：svgContent 不含 `<script>`/`alert(1)`/`onclick`/`foreignObject`；最终 HTML 不含内联事件处理器；data-action 等白名单属性保留。

### 5.5 挂载机制保留（P1 I6）

保留原两阶段流程：① `v-html(result.html)` 渲染占位 HTML（含 `.xxx-viewer-mount`）② `await nextTick()` → `querySelector('.xxx-viewer-mount')` → `h(Wrapper, props)` + `vueRender(vnode, mountPoint)` 挂载组件。`dataset.rendered` 去重 + 重渲染前 `delete dataset.rendered` 保留。**不改为 `<component :is>` 模板挂载**（避免时机变化导致 mountPoint 不存在）。MarkdownViewer 挂载阶段查 `wrapperRegistry`：

```typescript
const wrapperRegistry = {
  mermaid: MermaidDiagram, plantuml: PlantUmlDiagram, svg: SvgDiagram,
}
```

（wrapperRegistry 可与 diagramRegistry 合并：meta 增加 `wrapper: Component` 字段。但为职责分离，分开声明更清晰。P4 可合并。）

### 5.6 内联 svg 不走代码块管线（P1 I8 保留）

`useMarkdown` 的 fence renderer 仅在 `lang === 'svg'`（命中 registry）时走 SvgDiagram 分支。内联 svg（非围栏）走 markdown inline html，**不产生** `.svg-block` 容器。registry 查表天然满足：inline 不触发 fence renderer。BDD TC-10 保留。

### 5.7 行数预算

useMarkdown.ts 原 372 行 → 目标 ~300 行（移除三分支重复 + 通用 renderDiagramBlockWrapper）。新增 registry 定义 ~30 行，净减。

## 第 6 节：事件委托迁移（data-action → emit）

> 核心：按钮从 useMarkdown 生成的 v-html 静态 HTML 移入 BaseDiagram 组件模板 → `@click` → `emit`。handler 业务逻辑 + 三族差异保留在 MarkdownViewer。

### 6.1 挂载边界重划（emit 的前提）

**原**：useMarkdown 生成完整 block HTML（header+按钮+content+mountPoint）→ v-html → 组件只挂载到 `.xxx-viewer-mount`（viewer 部分）。按钮是静态 HTML，无 Vue 事件 → 靠 `data-action` + `closest()` + switch 委托。

**新**：useMarkdown 生成占位容器 `<div class="xxx-block" data-block-id data-index data-lang></div>` + codeViewHtml 存 sourcesMap → MarkdownViewer 挂载 **整个 BaseDiagram wrapper** 到该容器 → BaseDiagram template 渲染完整 block（header+按钮+content[diagram viewer + code 视图 v-html codeViewHtml]+resize+modal）。**按钮在组件模板内，`@click="emit(...)"` 天然成立**，去掉 `data-action` 字符串协议。

### 6.2 15-case diagram handler 映射 + 1 case 保留（对照 P1 I3 矩阵，建议-1 修正）

| 原 data-action case | BaseDiagram emits | MarkdownViewer handler 行为（按 classPrefix 差异） | 差异保留 |
|---------------------|-------------------|---------------------------------------------------|---------|
| `toggle-mermaid-view` / `toggle-plantuml-view` / `toggle-svg-view` | `emit('toggle-view', blockId)` | mermaid/svg: 切 is-active + 更新 toggle-text("Diagram"↔"Code") + dispatch refreshEventName；plantuml: **仅切 is-active，无 refresh，无 toggle-text**（保真 P1 I3） | ✅ 是 |
| `toggle-mermaid-menu` / `toggle-plantuml-menu` / `toggle-svg-menu` | `emit('toggle-menu', blockId)` | mermaid/svg: 关闭其他同族菜单 + toggle show + click-outside 监听；plantuml: **仅 toggle show，无关闭其他，无 click-outside**（保真） | ✅ 是 |
| `copy-mermaid-code` / `copy-plantuml-code` / `copy-svg-code` | `emit('copy-code', blockId)` | mermaid/svg: clipboard.writeText + `✓ Copied!` UI 反馈 2s；plantuml: clipboard + **仅 console.log，无 UI 反馈**（保真） | ✅ 是 |
| `download-mermaid-png` / `download-plantuml-png` / `download-svg-png` | `emit('download-png', blockId)` | mermaid/plantuml: `renderer.renderXxxFresh(code,theme)` → `renderer.svgToPng(freshSvg, 白底/800×600/brFix)`；svg: `instance.downloadPng()`（委托组件，透明/400×300） | ✅ 是 |
| `open-mermaid-fullscreen` / `open-plantuml-fullscreen` / `open-svg-fullscreen` | `emit('fullscreen', blockId)` | 三族: `renderer.getInstance(prefix,id).toggleFullscreen()`。**废弃 hidden-button hack**（原 mermaid/plantuml 闭包对象 `{ toggleFullscreen: () => btn.click() }` → 改薄包装 re-expose 真实 toggleFullscreen，MarkdownViewer 直接调 instance.toggleFullscreen()）。**modal 渲染源**：BaseDiagram 内部 `<Teleport to="body"><div v-if="isFullscreen" class="xxx-modal-overlay">...<div v-html="svgContent">...</div></div></Teleport>`，复用主图 props.svgContent（不二次渲染），独立 `modalPanZoomInstance`（maxZoom=20）。详见 2.4.1 | ✅ 内部统一 |
| `start-resize`（mermaid/svg） | `emit('start-resize', blockId, startY)` | mermaid/svg: `renderer.beginResize` + mousemove 改高(min 200,maxHeight=none) + mouseup 固定；plantuml: `resizeEnabled=false` → **不渲染 handle，不 emit**（保真） | ✅ 是 |
| `zoom-in` / `zoom-out` / `reset` | **不 emit**（BLOCKER-4 修订） | BaseDiagram 内部 `@click="panZoomInstance.zoomIn()"` 直调（modal 内 `@click="modalPanZoomInstance.zoomIn()"`）。**不迁 emit**——源码核实 zoom 按钮在组件模板内直调 panZoom，不经 data-action 委托。svg instance 不 expose zoomIn（3 项保持），MarkdownViewer 无 zoom handler，无矛盾 | ✅ 不迁移 |
| `copy-code-block`（通用代码块复制，非 diagram 专用） | **不 emit** | 保留在 MarkdownViewer（不迁移），非 diagram 三族 handler。6.2 表标题修正为「15-case diagram handler 映射 + 1 case 保留」 | ✅ 不迁移 |

**handler 实现位置**：MarkdownViewer（需操作 instance + DOM + composable）。BaseDiagram 仅 emit 信号 + blockId，不含业务。

### 6.3 交互差异 props 补充（BaseDiagram 新增，第 2 节 props 扩展）

为参数化 P1 I3 的 toggle/copy/menu 差异，BaseDiagram 新增 props：

```typescript
// 交互行为差异（P1 I3 矩阵）
toggleTextUpdates: boolean      // mermaid/svg true（更新 "Diagram"↔"Code"）；plantuml false
refreshOnToggle: boolean        // mermaid/svg true（dispatch refreshEventName）；plantuml false
copyFeedback: boolean           // mermaid/svg true（✓Copied 2s）；plantuml false（console.log）
menuClickOutside: boolean       // mermaid/svg true；plantuml false
menuCloseOthers: boolean        // mermaid/svg true；plantuml false
```

三薄包装配置：
| prop | Mermaid | PlantUML | SVG |
|------|---------|----------|-----|
| toggleTextUpdates | true | **false** | true |
| refreshOnToggle | true | **false** | true |
| copyFeedback | true | **false** | true |
| menuClickOutside | true | **false** | true |
| menuCloseOthers | true | **false** | true |

BaseDiagram 内部根据这些 prop 决定是否更新 toggle-text / dispatch refresh / 显示 Copied / 绑 click-outside / 关闭其他。**差异不丢失**。

### 6.4 CSP 合规确认

**结论：不需 minimal_validation**（第 8 节声明 `needed: false`）。

理由：
- Vue `@click` 是框架机制（编译为 `addEventListener`），非 HTML 内联事件属性（`onclick=""`）。运行时 DOM 无 `onclick` 属性 → 不违反主应用 CSP `script-src 'self' 'unsafe-eval'`。
- 去掉 `data-action` 后，HTML 中不再有事件相关属性。DOMPurify 净化仍保留（ADD_ATTR 白名单含 data-action 无害，可保留或移除，不影响安全）。
- BDD 维度 8（CSP）：渲染输出 HTML 不含 `onclick=`/`onload=` 内联事件，主应用 CSP 不违规。Vue 模板按钮天然满足。

### 6.5 data-action 属性处置

- **HTML 生成**：useMarkdown 新占位容器不带 `data-action`。BaseDiagram 模板按钮用 `@click`，不写 `data-action` 属性。
- **DOMPurify ADD_ATTR**：`data-action` 可保留在白名单（无害，向后兼容已净化 HTML）或移除。**建议保留**（避免误伤其他可能残留的 data-* 属性，且白名单多一项不影响安全）。
- **测试影响**（P1 I10）：`SvgBlock.spec.ts` L139 断言 `[data-action="toggle-svg-view"]` 将失效 → P3 须同步更新为断言 emit 触发或等价按钮选择器（如 `.svg-view-toggle` class + click）。**P3 必做**。

### 6.6 MarkdownViewer 脚本结构（< 300 行目标）

```
MarkdownViewer.vue script:
  - props/emits（:content 输入 + headings emit 输出，签名不变）
  - useCodeBlockRenderer() 解构
  - renderContent(content, theme): watch([content,theme]) 触发
      - nextToken + useMarkdown.render + 8 检查点
      - preRender 三族（填 sourcesMap）
      - v-html + nextTick + 挂载循环（h+vueRender+registerInstance）
  - emit handler: onToggleView/onToggleMenu/onCopyCode/onDownloadPng/onFullscreen/onStartResize/onZoomIn...
      - 按 classPrefix 分族差异化（6.2 表）
  - handleResizeMove/Up（start-resize 的 mousemove/mouseup）
  - onUnmounted: clearInstances + panZoom destroy
  - watch theme: 触发 renderContent（重渲染）
```

CSS 拆分（P1 I7）：front-matter / code-block-wrapper / dark-mode 保留 MarkdownViewer；block 通用样式随 BaseDiagram；差异样式随薄包装。

## 第 7 节：行为保真保障

> 逐条回应 P0-brief known_risks 12 条 + 末条（共 13 条）。每条标注：风险 → 本方案对策 → 验证阶段。

### 7.1 known_risks 逐条回应

| # | 风险 | 本方案对策 | 验证 |
|---|------|-----------|------|
| 1 | 🔴 行为回归（渲染 HTML 字符级/按钮交互/状态丢失/性能/安全/响应式/主题/CSP/错误处理） | 用户感知保真分层（1.3）+ HTML 快照测试（7.2）+ 9 维度 BDD（P1）+ 主 Agent 亲自 Playwright（P6）。**错误处理时序**：composable preRender 标记 error → mount 阶段消费（见 4.4.1 错误处理流程图），BDD 维度 9 三条逐条对应 | P3 快照红线 + P6 逐条实跑 |
| 2 | 测试覆盖不能降（86 单测 + 16 BDD 全绿） | P3 先跑重构前基线作红线，重构期挂即停；新增 composable/registry 纯函数单测优先（T020 教训）；SvgBlock.spec data-action 断言同步更新（6.5） | P3 红线 + P5 全绿对比 |
| 3 | 与 T021 时序冲突 | P1 I9 确认 T021 已 DONE（v0.1.67），EntryDetailView 调用面现状锁定。本方案不动 EntryDetailView 主体，仅 MarkdownViewer 内部重构 | P6 复核 EntryDetailView 调用面零改动 |
| 4 | useMarkdown 公开 API 稳定性 | render() 返回 sources 合并 Map（技术内部，progress 确认仅 MarkdownViewer 消费）。EntryDetailView 外部契约（:content + headings emit）零改动（5.3） | P6 验 EntryDetailView 无 diff |
| 5 | Mermaid 串行约束保留 | composable `preRenderPlantUml`/`renderPlantUmlFresh` 直调 `usePlantUML.render`，模块级 renderQueue 不动，禁 `Promise.all`（4.5） | P5 单测：并发 plantuml 渲染顺序一致 |
| 6 | renderToken 防竞态保留 | composable 暴露 `nextToken/isCurrent`，8 检查点保留在 MarkdownViewer 显式位置，不封装不透明调用（4.4） | P5/P6：快速切主题无旧 SVG 覆盖 |
| 7 | 三胞胎差异点识别不全 | P1 I2 矩阵 24 行 + P2 第 3 节速查表逐条参数化，差异 props 全覆盖。第 3.4 节速查表作 P4 实现参照 | P6 逐族验证差异行为 |
| 8 | 主题切换/IME 行为 | watch([content,theme]) 触发 renderContent 保留；mermaidCache key 含 theme 保留；svg code 视图 Shiki 高亮重挂载（highlightCode 用新 theme）保留 | P6 BDD 维度 7 |
| 9 | PNG 透明背景 | BaseDiagram `pngBackground` prop：mermaid/plantuml `#ffffff`（fillRect 白），svg `transparent`（不调 fillRect，alpha=0）。svgToPng 参数化（2.5） | P6 BDD：下载 PNG 验证背景 |
| 10 | CSP 影响 | Vue @click 非内联事件（6.4），不需 minimal_validation。去 data-action 不引入新内联事件 | P6 BDD 维度 8 |
| 11 | subagent 抗不住复杂 Vue 测试 | P3 拆分：纯函数单测（composable/registry）优先，组件集成后置。files_to_read 控制上下文（第 8 节） | P3 执行 |
| 12 | subagent 自我报告不可信 | P6 主 Agent 亲自跑 Playwright，不接受 subagent PASS 作 gate。gate_commands 固化（第 8 节） | P6 主 Agent 执行 |
| 13 | 重构+优化捆绑 | P4 每子步骤 commit message 回答「是否改变外部行为」=否。本方案纯结构重构，PNG 路径统一（mermaid/plantuml fresh → composable.svgToPng）属结构迁移非优化（输出字节级一致） | P4 commit review |

### 7.2 渲染输出字符级一致策略（HTML 快照）

**P3 快照红线**：
- 重构前录制：对固定 markdown 样本（含 mermaid/plantuml/svg/code/inline-svg 混合），`useMarkdown.render()` 输出的 `html` 字符串存快照（jest/vitest snapshot）。
- 重构后对比：快照必须 **100% 字符级匹配**（允许 sourcesMap 结构变化，但 html 字段不变）。

**字符级一致性约束**：
- block HTML 结构：原 useMarkdown 硬编码 `<div class="xxx-block" data-block-id data-index>...完整结构...</div>`。新方案占位容器 + BaseDiagram 模板渲染 → **最终 DOM 结构可能变化**（按钮从 v-html 静态变组件渲染）。
- **关键判定**：BDD 维度 1 断言的是「DOM 中存在 class 含 X 的元素」+ 挂载点 + svg 元素，**非 HTML 字符串字符级**。只要 DOM 查询断言通过 = 用户感知保真。
- HTML 字符串快照用于 **useMarkdown.render 输出**（占位容器 + codeViewHtml），不含按钮（按钮迁组件模板）。这部分字符级一致可行。
- BaseDiagram 渲染的 DOM 结构：P3 加 DOM 快照（`mountComponent` 后的 `.xxx-block` outerHTML）对比，允许属性顺序差异但结构一致。

**结论**：useMarkdown.render 输出 html 快照字符级一致；BaseDiagram 渲染 DOM 结构快照语义一致（P3 录制重构前 DOM 结构作基线）。

### 7.3 主题切换保留策略

- `watch([content, theme], renderContent)` 保留（MarkdownViewer）。
- `mermaidCache` key = `${theme}-${code}`，切主题 cache miss → 重新 `useMermaid.render`（5s timeout 保留）。
- plantuml 无 cache（每主题重渲染，串行队列保留）。
- svg code 视图：`highlightCode(code, 'xml', theme)` 异步重挂载，theme 变 → Shiki 用新主题高亮。
- panZoom 重渲染后销毁重建（`refreshPanZoom` + refreshEventName dispatch）。
- dark mode CSS 覆写：保留在 MarkdownViewer + BaseDiagram style，`.dark` 选择器生效不变。

### 7.4 IME 保留策略

- MarkdownViewer 是渲染器（非输入框），无 IME 输入场景。IME 主要影响 EntryDetailView 的搜索/评论输入，本任务不动 EntryDetailView → IME 零影响。
- 复核：markdown content 来自 props（父组件传入），无用户直接输入 markdown 的场景 → IME 不涉。

### 7.5 响应式保留策略

- CSS 媒体查询 `@media (max-width: 768px)` 保留（随 block 样式迁移到 BaseDiagram/薄包装）。
- BDD 维度 6：断点下 header padding/toggle-text 隐藏/action-btn 尺寸/content min-height 全部保留。
- resize-handle：`resizeEnabled` prop 控制（mermaid/svg 渲染，plantuml 不渲染）。mousedown→mousemove 改高 min 200 + maxHeight=none → mouseup 固定，逻辑迁 MarkdownViewer handler + composable.beginResize/endResize。

### 7.6 性能基线保留

- mermaidCache 命中率不降（key 格式不变 `${theme}-${code}`）。
- renderToken 检查点不丢（4.4）。
- panZoom init/destroy 时机不变。
- P3 录制重构前首屏时间（含 3 mermaid 块）作红线，P5 对比不退化。

### 7.7 实现完成标志（P4/P5 判定标准）

- [ ] BaseDiagram.vue < 400 行，三薄包装各 < 150 行
- [ ] useCodeBlockRenderer.ts < 200 行
- [ ] MarkdownViewer.vue 脚本 < 300 行
- [ ] useMarkdown.ts 三分支改查表，registerDiagramType API 可用
- [ ] 加 d2 类型：1 文件 + 1 行注册（P5 验证可扩展性 BDD）
- [ ] 86 单测全绿（含更新后的 SvgBlock.spec）
- [ ] 16 BDD 全绿
- [ ] HTML 快照字符级一致 + DOM 结构快照语义一致
- [ ] EntryDetailView.vue 零 diff
- [ ] 渲染输出/按钮交互/状态/性能/安全/响应式/主题/CSP/错误处理 9 维度逐项一致（P6 实跑）

## 第 8 节：声明字段（gate 硬要求）

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
ui_interaction_points:
  - mermaid block: toggle view / toggle menu / copy code / download png(白底 fresh) / fullscreen / resize / zoom / pinch-touch
  - plantuml block: toggle view(无refresh/无toggle-text) / toggle menu(无click-outside/无close-others) / copy code(无Copied反馈) / download png(白底 fresh) / fullscreen / zoom(无touch/无resize)
  - svg block: toggle view / toggle menu / copy code / download png(透明底委托组件) / fullscreen / resize / zoom / pinch-touch
  - 主题切换重渲染 / 响应式断点(≤768px) / mermaid cache 命中 / renderToken 防竞态 / DOMPurify svg 净化
```

### gate_commands

```yaml
gate_commands:
  unit: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  typecheck: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  build: "cd frontend-v3 && npm run build 2>&1 | tail -10"
  regression: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no 2>&1 | tail -10"
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P6_e2e: "make debug-test 2>&1 | tail -30"   # 需 debug backend 运行在 :8888
```

> 主 Agent 派发 P5/P6 时从此字段读取命令，不得自行修改。subagent 要求跳过/降级 = `[SCOPE_GAP]`，该阶段不通过。命令跑不通 = `[CAPABILITY_GAP]` 交人决策。

### env_constraints

```yaml
env_constraints:
  debug_env:
    backend: "make debug-start（127.0.0.1:8888，PEEKVIEW_DEBUG_MODE=1，数据目录 /tmp/peekview-debug/）"
    frontend_test: "cd frontend-v3 && ./node_modules/.bin/vitest run（非 npx vitest；vitest v1 不支持 --tb=short）"
    frontend_build: "cd frontend-v3 && npm run build（自动复制 dist → static/）"
    e2e: "make debug-test（需 debug backend 运行）"
    forbidden:
      - "pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）"
      - "peekview create CLI 创建测试 entry（AGENTS.md 铁律 8）—— 只通过 debug backend HTTP API"
      - "直接 sqlite3 操作生产数据库（AGENTS.md 铁律 6）"
  isolation_check:
    - "测试 entry 通过 curl -X POST http://127.0.0.1:8888/api/v1/entries 创建，验证数据落 /tmp/peekview-debug/peekview.db"
    - "vitest 默认隔离（无 DB 依赖，纯前端单测）"
    - "Playwright E2E 走 debug backend :8888，不触生产 :8080"
```

### files_to_read

```yaml
files_to_read:
  # ── 核心：公开 API + 渲染流程 ──
  - path: frontend-v3/src/utils/useMarkdown.ts
    lines: "1-50, 66-368"
    why: 公开 render() 签名 + fence 收集 + 三分支 block HTML 生成 + DOMPurify 净化(L363) + sourcesMap 填充

  # ── MarkdownViewer：事件委托 + 状态 + 挂载 ──
  - path: frontend-v3/src/components/MarkdownViewer.vue
    lines: "1-50, 340-400, 381-540"
    why: defineProps(L22)/emit(L23) + 状态声明(L34-42) + handleDelegatedAction 16-case(L340-363) + start-resize(L366) + renderContent+renderToken(L381-382) + 挂载循环 + 8 检查点

  # ── 三胞胎：差异点参照（P4 实现薄包装时对照）──
  - path: frontend-v3/src/components/MermaidDiagram.vue
    lines: "1-50, 55-100, 137-210, 245-260"
    why: defineProps(L40)/defineEmits 5事件(L41-46) + panZoom init 无try-catch(L56,79-94) + zoom(L137-153) + toggleFullscreen(L178) + downloadPng 白底(L195-206) + getBBox fallback(L249-251)

  - path: frontend-v3/src/components/PlantUmlDiagram.vue
    lines: "1-50, 55-80, 104-115, 124-150, 215-225"
    why: defineProps(L38) 无emit + panZoom 无try-catch(L46,61-74) + zoom(L104-111) + toggleFullscreen(L124) + downloadPng 白底(L137-148) + fillRect(L220)

  - path: frontend-v3/src/components/SvgDiagram.vue
    lines: "1-50, 55-115, 126-155, 215-225"
    why: defineProps(L38) 无emit + panZoom 有try-catch(L61-79) + toggleFullscreen(L126) + downloadPng 透明(L139-150) + 不调fillRect alpha=0(L221)

  # ── 渲染器依赖（串行约束 + 安全）──
  - path: frontend-v3/src/utils/usePlantUML.ts
    lines: "1-75"
    why: 模块级 renderQueue 串行约束(L13, L62-72) —— composable 调用路径必须保留，禁 Promise.all

  - path: frontend-v3/src/utils/useMermaid.ts
    lines: "1-50"
    why: useMermaid.render(id,code,theme) 5s timeout + securityLevel:'strict' —— composable preRenderMermaid 调用契约

  # ── EntryDetailView 调用面（边界确认，不改动）──
  - path: frontend-v3/src/views/EntryDetailView.vue
    lines: "130-145"
    why: MarkdownViewer 调用面(L136-141) :content + dormant :headings + @select-heading 哑监听 —— 重构须零 diff

  # ── 测试基线（P3 红线 + data-action 断言更新）──
  - path: frontend-v3/src/components/__tests__/SvgBlock.spec.ts
    lines: "130-150"
    why: data-action="toggle-svg-view" 断言(L139) —— 迁 emit 后失效，P3 须同步更新
```

### minimal_validation

```yaml
minimal_validation:
  needed: false
  reason: >
    纯代码逻辑重构（组件结构重组 + 状态迁移 + 事件委托改 emit）。
    Vue @click 是框架编译机制（addEventListener），非 HTML 内联事件属性，
    不涉及浏览器安全模型/CSP 新行为，不需浏览器最小验证。
    三胞胎结构差异已在 P1 I2 矩阵 + P2-progress 分析中逐行核对确认完整，
    无「凭想象设计」的假设。svg DOMPurify 净化是项目内已有模式（T020 先例），非新外部能力。
    P3 TDD 快照 + P6 Playwright 实跑覆盖验证。
  assumption: "Vue @click 不违反 CSP script-src 'self' 'unsafe-eval'"
  method: "无需（框架机制已知，CSP 合规见 6.4）"
  result: "not_needed"
```

### 补充：[SCOPE+] 声明

本轮 P2 设计中**未发现** P1 未预见的必须做的新隐含需求。P1 I1-I10 已覆盖（API 兼容/三胞胎差异/16-case handler/renderToken/串行/挂载机制/CSS/内联svg/T021/T020）。本方案对 I1-I10 逐条有对策（见第 2-7 节）。无 [SCOPE+]。

---

## 完成标志（供 P3 测试设计 + P5 验证参照）

1. BaseDiagram.vue < 400 行，含 props(2.1)/emits(2.3)/defineExpose(2.4)/svgToPng(2.5)
2. 三薄包装各 < 150 行，差异 props 对照 3.4 速查表
3. useCodeBlockRenderer.ts < 200 行，含 renderToken/串行/svgToPng(4.4-4.5)
4. useMarkdown.ts 查表路由，registerDiagramType 可用，DOMPurify 两层保留(5.4)
5. MarkdownViewer.vue 脚本 < 300 行，emit handler 16-case 差异保留(6.2)
6. EntryDetailView.vue 零 diff
7. 加 d2 类型：1 文件 + 1 行注册
8. 86 单测 + 16 BDD 全绿，HTML 快照字符级一致
9. 9 维度行为保真逐项一致（P6 主 Agent 亲自实跑）

---

## 修订记录（round 2）

> 上一轮方案经工程评审（P2-review-eng.md，3 BLOCKER）+ 设计评审（P2-review-design.md，3 BLOCKER）打回。共 6 个 BLOCKER，去重合并为 5 条修订（E2 与 D1 同为错误处理，合并）。逐条说明如下。

### 修订 1：[E1] BaseDiagram props 接口遗漏 codeViewHtml，code 视图 HTML 无传入路径

- **BLOCKER 描述**：6.1 明确 BaseDiagram template 渲染完整 block（含 code 视图 v-html codeViewHtml），但 2.1 BaseDiagramProps 只有 svgContent 无 codeViewHtml。useMarkdown renderCodeView 产出的 code 视图 HTML 既未存入 sourcesMap（4.2 BlockSource 无字段），也未传入 BaseDiagram，数据流断裂。
- **修订位置**：2.1（BaseDiagramProps 新增 codeViewHtml）+ 2.1 差异覆盖核对「代码视图高亮」行 + 4.2（BlockSource 新增 codeViewHtml/error）+ 5.2（renderCodeView/renderCodeViewAsync 明确产出 + 数据流补全）+ 3.1/3.2/3.3（薄包装传 codeViewHtml）。
- **修订内容**：① BaseDiagramProps 新增 `codeViewHtml: string`，BaseDiagram template 内 `<div class="${prefix}-content code-mode" v-html="codeViewHtml">` 渲染。② BlockSource 新增 `codeViewHtml?: string`，useMarkdown.render 产出 escapeHtml 同步填入 sources（mermaid/plantuml），svg 的 Shiki 异步高亮在 preRender 阶段 `await renderCodeViewAsync` 填入 sourcesMap.codeViewHtml（锁定为 preRender 阶段，非 mount 二轮填充，避免 BaseDiagram 挂载后 code 视图空白闪烁）。③ 薄包装 `renderer.getCodeViewHtml(props.blockIndex)` 取值传 BaseDiagram props.codeViewHtml。
- **为何解决**：code 视图 HTML 有明确数据流路径（useMarkdown → sourcesMap → 薄包装 → BaseDiagram props → template v-html），不再凭空消失。svg 异步 Shiki 时机明确（preRender await），与 BLOCKER-2 错误处理时序一致。

### 修订 2：[E2+D1] 渲染错误处理流程时序矛盾 + 薄包装/composable 错误处理缺失（合并）

- **BLOCKER 描述**：E2——4.4 草图把 preRender 放在 v-html 前，但原错误处理（L470-473/518-528/566-569）全部操作 mountPoint DOM（v-html+nextTick 后才存在），preRender 抛错时无 mountPoint 可写错误 UI，错误处理归属未决。D1——composable preRenderMermaid/preRenderPlantUml/registerSvg 均无 try/catch，渲染失败 sourcesMap 不填该项，薄包装 getMermaidSvg 返回空 → BaseDiagram 渲染空白，用户看不到错误提示（BDD 维度 9 三条必 FAIL）。
- **修订位置**：4.3（preRenderMermaid/preRenderPlantUml 增加 try/catch + error 标记）+ 4.4.1（新增错误处理流程图）+ 4.2（BlockSource 新增 error 字段）+ 7.1 第 1 条（展开错误处理时序指向 4.4.1）。
- **修订内容**：① BlockSource 新增 `error?: string`。② preRenderMermaid try/catch，catch 时 `sourcesMap.set(index, { ..., error: 'Failed to render diagram' })`（标记，不操作 DOM）；preRenderPlantUml catch 标记 `error: 'plantuml-validate-failed'`；registerSvg 的 Shiki 失败不阻断（codeViewHtml 留空）。③ 新增 4.4.1 错误处理流程图：preRender 阶段标记 error → mount 阶段 MarkdownViewer 挂载循环检查 source.error——mermaid error → mountPoint.innerHTML = mermaid-error div；plantuml error → 切 code 视图 + dataset.rendered=true；svg 渲染错误保留 mount 阶段 vueRender try/catch 兜底（保真原 L566-569，因 svg 无 preRender 渲染）。④ BDD 维度 9 三条逐条对应说明。
- **为何解决**：错误处理跨两阶段归属明确——composable preRender 只标记（不操作 DOM，因 mountPoint 不存在），mount 阶段消费 error 标记写错误 UI（mountPoint 此时存在）。时序矛盾消除，BDD 维度 9 三条有明确实现路径，字符级保真原 innerHTML 错误提示。

### 修订 3：[E3] getMermaidSvg 接口契约不连贯（查找键混用 + 占位 bug）

- **BLOCKER 描述**：4.3 的 `sourcesMap.get(...)` 省略 key（占位未填），无法实现。mermaidCache 以 `${theme}-${code}` 为 key，sourcesMap 以 index 为 key，两套查找键不互通。薄包装 MermaidDiagram computed 调 `renderer.getMermaidSvg(props.code, props.theme)` 按 code 查，但 preRender 填 sourcesMap 按 index 存，函数内部无法用 code 查 sourcesMap。
- **修订位置**：4.3（getMermaidSvg → getMermaidSvgByIndex，新增 getPlantUmlSvgByIndex/getCodeViewHtml/getError）+ 3.1/3.2/3.3（薄包装 computed 改用 blockIndex 查）+ 4.3 return 导出。
- **修订内容**：① 薄包装统一持有 blockIndex，composable 公开 `getMermaidSvgByIndex(index)`/`getPlantUmlSvgByIndex(index)`/`getCodeViewHtml(index)`/`getError(index)`，全部按 index 查 sourcesMap。② mermaidCache 仍以 `${theme}-${code}` 为 key（cache 内部查找，preRenderMermaid 内部用），但薄包装不直接查 cache——薄包装查 sourcesMap（preRender 已填），sourcesMap miss 返回空。③ 消除占位 `sourcesMap.get(...)`，给出无占位完整实现。④ 薄包装 computed 入参统一为 blockIndex（MermaidDiagram/PlantUmlDiagram/SvgDiagram 三处改）。
- **为何解决**：查找键统一为 blockIndex（薄包装持有），sourcesMap 与薄包装入参一致。mermaidCache 与 sourcesMap 职责分离（cache 是渲染缓存，sourcesMap 是挂载源数据），不再混淆。占位消除，实现可落地。

### 修订 4：[D2] svg zoom 交互路径自相矛盾（defineExpose 3 项 vs handler 统一调 instance.zoomIn）

- **BLOCKER 描述**：2.3 emits 注释暗示 zoom 统一走 emit 到 MarkdownViewer，2.4 defineExpose SvgDiagram 仅 3 项（不含 zoomIn），6.2 表 zoom handler 调 `svgInstances.get(id).zoomIn()` → undefined（svg instance 未 expose zoomIn）→ 报错或静默失败。
- **修订位置**：2.3（emits 移除 zoom-in/zoom-out/reset）+ 6.2 表（zoom 行改为不迁移 + 补 copy-code-block 行）+ 6.2 标题（15-case + 1 保留）。
- **修订内容**：① 源码核实：三族 zoom 按钮均在组件模板内 `@click="zoomInModal"` 直调 modalPanZoomInstance（modal 内），主图 zoom 通过 touch pinch + wheel（无 zoom 按钮）。handleDelegatedAction 16 case 实测（L345-362）无 zoom-in/out/reset。mermaid 的 `emit('zoomIn')` 是历史遗留无 handler 的死信号（MarkdownViewer 无 zoom handler）。② BaseDiagram zoom 按钮 `@click` 直接调内部 `panZoomInstance.zoomIn()`/`modalPanZoomInstance.zoomIn()`，**不 emit zoom 信号**。③ emits 移除 zoom-in/zoom-out/reset。④ SvgDiagram defineExpose 3 项保持不变（保真 P1 I2，不 expose zoomIn），MarkdownViewer 不调 instance.zoomIn() → 无矛盾。⑤ 6.2 表补 copy-code-block 行（不迁移，保留 MarkdownViewer），标题改「15-case diagram handler 映射 + 1 case 保留」。
- **为何解决**：zoom 保留组件内部 @click 直调 panZoom（与源码现状一致），不 emit 到外层。SvgDiagram 不需 expose zoomIn，MarkdownViewer 不需 zoom handler，defineExpose 3 项与无 zoom emit 自洽。消除「统一 emit」过度设计，避免 panZoom 时机/instance re-expose 链路的行为回归风险。

### 修订 5：[D3] modal（fullscreen）的 svgContent 来源未设计（废弃 hidden-button hack 后渲染源断链）

- **BLOCKER 描述**：2.1 props svgContent 声称 modal 也用此，但 MarkdownViewer 何时传入未设计。6.2 表 fullscreen handler 声称废弃 hidden-button hack 直接调 instance.toggleFullscreen()，但 toggleFullscreen 如何打开 modal 并传入 svgContent 未说明。原 modal panZoom maxZoom=20（主图 10）说明 modal 是独立 panZoom 实例，新方案 BaseDiagram 内部 modal 如何创建第二个 panZoom 实例未设计。BDD 维度 2 fullscreen BDD 必 FAIL。
- **修订位置**：2.1（panZoomMaxZoom 注释修正 + isModal prop 移除）+ 2.4.1（新增 modal 渲染源设计小节）+ 6.2 表 fullscreen 行 + 3.1/3.2/3.3（薄包装移除 isModal）。
- **修订内容**：① 源码核实：modal 是组件**内部** `<Teleport to="body"><div v-if="isFullscreen" class="xxx-modal-overlay">...<div v-html="svgContent">...</div></div></Teleport>`，modal 内 svg 复用**主图 props.svgContent**（同一字符串 v-html 到 modal 内独立 div），不二次渲染。modal 内有独立 `modalPanZoomInstance`（maxZoom=20 硬编码，与主图 panZoomInstance 分离）。② hidden-button hack 存在原因：vueRender 不返回实例，mermaid/plantuml 存闭包对象 `{ toggleFullscreen: () => btn.click() }` 间接触发；svg 取真实 vue 实例直接调。③ 废弃 hack 后：薄包装 re-expose toggleFullscreen（指向 BaseDiagram.toggleFullscreen），MarkdownViewer 直接调 instance.toggleFullscreen()。渲染源不变（modal 复用主图 props.svgContent）。④ 新增 2.4.1：给出 BaseDiagram modal template 完整结构 + toggleFullscreen/closeFullscreen/zoomInModal 实现 + modal panZoom 独立实例 maxZoom=20 硬编码。⑤ 移除 isModal prop（modal 是内部 overlay 非外部二次挂载），薄包装 panZoomMaxZoom 固定主图 10。⑥ BDD 维度 2 fullscreen 对应：modal-overlay（v-if）+ modal-title（prop）+ svg 可见（v-html svgContent）+ Escape 关闭（closeFullscreen）。
- **为何解决**：modal 渲染源明确（复用主图 props.svgContent，BaseDiagram 内部 Teleport+v-if overlay），不依赖 MarkdownViewer 二次挂载实例或传 svgContent。modal panZoom 独立实例（maxZoom=20 硬编码）在 BaseDiagram 内部 initModalPanZoom，不依赖 props.panZoomMaxZoom。废弃 hidden-button hack 的等价性论证完整（原 hack 仅为触发组件内 toggleFullscreen，新路径直接调真实方法，渲染源不变）。BDD 维度 2 fullscreen 各断言有明确实现路径。

### 顺带处理的非阻断建议

- **建议-1（copy-code-block + zoom）**：6.2 表补 copy-code-block 行（不迁移，保留 MarkdownViewer），zoom 改不迁移（见修订 4）。6.2 标题修正为「15-case diagram handler 映射 + 1 case 保留」。
- **建议-3（并行化措辞收紧）**：4.5 措辞从「可保留串行」改为「**禁止**对所有 diagram 预渲染使用 Promise.all（含 mermaid/svg/plantuml）」，仅允许 cache 命中同步跳过。
- **建议-2/4/5/6 + S1-S6**：非阻断，供 P3/P4 落实（CSS 选择器映射、测试影响 grep、resize 监听层级、主题切换触发路径、cross-族 menu、IME 声明、fullscreen hack 过渡保留等），不阻塞 P2 放行。

### 修订完整性自检

- ✅ 6 个 BLOCKER 全部有对应修订（E1→修订1，E2+D1→修订2，E3→修订3，D2→修订4，D3→修订5）
- ✅ 四字段（packages/domains/ui_affected/gate_commands）保持完整未删（第 8 节）
- ✅ env_constraints / files_to_read / minimal_validation 保持完整
- ✅ 修订未引入新矛盾：codeViewHtml 数据流闭环、错误处理时序自洽、查找键统一 blockIndex、zoom 不 emit 自洽、modal 内部 overlay 无 isModal 依赖
- ✅ BDD 维度 9（错误处理）+ 维度 2（fullscreen）覆盖补齐，无未覆盖 BDD
- ✅ 行为保真铁律未违反：所有修订均对照源码现状保真（error 标记字符级、modal 复用 svgContent、zoom 组件内部直调）

