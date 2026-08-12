2026-06-25 19:10:08
# P1 Progress Log — T022 diagram-renderer-refactor

Started: 2026-06-25 19:10:08

## [1] 读取 useMarkdown.ts 完成 (2026-06-25)
关键发现：
- `render()` 显式 if-block 路由 mermaid/plantuml/svg（L233-329），每个生成带 data-action 字符串协议的 HTML 块
- 返回 3 个独立 Map: mermaidSources/plantumlSources/svgSources（公开 API 签名）
- DOMPurify.sanitize 在 L363，ADD_ATTR 含 data-action/data-code/data-line/data-block-id/data-index/data-mode
- mermaid/plantuml 代码块用 escapeHtml 直接放 <pre><code>（同步）；svg 代码块走 highlightCode(block.code,'xml',theme)（异步高亮）—— 差异点！
- 普通 code block 走 highlightCode + 包裹 code-block-wrapper，有 data-action="copy-code-block"
- front matter 解析在 render 内部（前置逻辑，重构需保留）

## [2] 读取 MermaidDiagram.vue 完成 (2026-06-25)
关键发现：
- Props: svgContent(string), id(string)
- 已有 emit: zoomIn/zoomOut/reset/fullscreen/downloadPng（5 个）—— 说明事件迁移已部分存在
- panZoom options: minZoom 0.1, maxZoom 10（inline）; modal: minZoom 0.1, maxZoom 20 —— 差异点！modal maxZoom 不同
- mouseWheelZoomEnabled: false（自定义 onWheel 处理），preventMouseEventsDefault: false
- Touch handling: pinch zoom + drag pan（自定义，passive:false）
- ResizeObserver: 监听容器尺寸，resize()+fit()+center()
- PNG 导出: fillRect #ffffff 白底（L320-321），用 viewBox 算尺寸，解析原始 svgContent（非 DOM）
- defineExpose: zoomIn/zoomOut/resetZoom/toggleFullscreen/refreshPanZoom/getSvgElement/downloadPng/exportMermaidToPng
- 监听 'mermaid-refresh' 自定义事件（从父组件触发 refreshPanZoom）
- 有 resize-handle（useMarkdown HTML 里有 mermaid-resize-handle）

## [3] 三胞胎组件差异矩阵（读 PlantUml/Svg 后）(2026-06-25)
**MermaidDiagram (598)**: emit 5个(.zoomIn/Out/reset/fullscreen/downloadPng且zoom函数内emit) | initPanZoom 无try-catch | PNG: viewBox→getBBox(g.root) fallback→800x600→白底fillRect→<br>修复 | 有resize-handle | 有touch(pinch+drag) | refresh事件'mermaid-refresh' | expose 8个(含exportMermaidToPng/getSvgElement)
**PlantUmlDiagram (416)**: 无emit | initPanZoom 无try-catch | PNG: viewBox→svgEl.width/height attr fallback→800x600→白底fillRect→无<br>修复 | 无resize-handle | **无touch处理!** | refresh'plantuml-refresh' | expose 8个(含exportPlantUmlToPng/getSvgElement)
**SvgDiagram (478)**: 无emit | initPanZoom **有try-catch**(warn+null) | initModalPanZoom **有try-catch** | PNG: viewBox→svgEl.width/height attr fallback→**400x300**→**透明底无fillRect**→无<br>修复 | 有resize-handle | 有touch(pinch+drag) | refresh'svg-refresh' | **expose仅3个**(toggleFullscreen/downloadPng/refreshPanZoom，无zoomIn/Out/reset/getSvgElement/export)

useMarkdown.ts 代码块差异:
- mermaid code-mode: escapeHtml(同步，无高亮)
- plantuml code-mode: escapeHtml(同步，无高亮)
- svg code-mode: highlightCode(block.code,'xml',theme)(异步Shiki高亮!) ← 差异点

## [4] 读取 MarkdownViewer.vue 完成 (2026-06-25)
脚本逻辑 L1-795，CSS L797-1989（1192行CSS！P0目标<300行应指脚本，CSS迁移是隐含依赖）

**待迁移到 composable 的状态**:
- mermaidCache: Map<string,string> (key=`${theme}-${code}`) L34
- mermaidSourcesMap/plantumlSourcesMap/svgSourcesMap: Map<number,string> L35-37
- renderToken: number (防竞态) L38
- mermaidInstances/plantumlInstances/svgInstances: Map<string,any> L40-42

**renderToken 防竞态机制**（核心，迁移边界条件）:
- renderContent L382: `const myToken = ++renderToken`
- 检查点 L387/396/414/416/484/489/500/539（每个 async 边界后都查）
- 迁移到 composable 时必须保留这些检查点位置

**事件委托 data-action 协议** (L340-363): closest('[data-action]') + dataset.action + switch 16 case
- handleDelegatedAction (click) + handleDelegatedResize (mousedown)
- 注册在 contentRef.addEventListener

**16 个 data-action case 的行为差异（关键！不能一刀切）**:
- toggle-view: mermaid有refresh事件+toggle-text更新；plantuml**仅toggle is-active无refresh无text更新**；svg有refresh+text但用contentRef.querySelector而非document.getElementById
- toggle-menu: mermaid/svg有关闭其他菜单+click-outside；plantuml**仅toggle show无关闭其他无click-outside**
- copy-code: mermaid/svg有✓Copied!UI反馈；plantuml**仅console.log无UI反馈**
- download-png: mermaid/plantuml在MarkdownViewer内re-render fresh SVG；svg**委托svgInstances.get(blockId).downloadPng()组件方法**
- fullscreen触发: mermaid/plantuml用hidden-button-click hack；svg用component.exposed直接调用

**错误处理差异**: mermaid→mermaid-error div；plantuml→切换到code模式；svg→svg-error div
**resize handle**: 仅mermaid/svg有，plantuml无

**T020 XSS净化位置**: renderSvgBlocks L549 DOMPurify.sanitize(code) 对svg源码净化后才传给SvgDiagram。mermaid/plantuml的SVG来自受信渲染器不净化
**挂载机制**: h()+vueRender(vNode,mountPoint) 到 .xxx-viewer-mount，dataset.rendered防重复

## [5] 测试基线 + 渲染源 composable (2026-06-25)
**单元测试（与管线相关）**:
- src/composables/__tests__/useMarkdown.svg.spec.ts: svg块识别 + svgSources Map + Shiki xml高亮 + DOMPurify净化(script/onclick/foreignObject剥离+保留path/circle/rect/text/g)
- src/components/__tests__/SvgBlock.spec.ts: mount MarkdownViewer → 断言 .svg-block结构/toggle切换/code视图/three-family共存(TC-12)。**依赖data-action="toggle-svg-view"字符串协议**——重构迁移到emit后这些测试需更新
- src/composables/__tests__/usePlantUML.spec.ts: 串行队列+validateSource+timeout

**E2E BDD**:
- viewer.spec.ts: TC-001~050(code/markdown/TOC/responsive/theme/fileOps)
- mermaid.spec.ts: SVG填充容器/code-toggle/fullscreen-modal
- png-download.spec.ts: modal内PNG下载(valid PNG signature)
- 注意：E2E依赖真实测试entry(test-mermaid-2/png-test-2/ngajri/lu4prg)在debug backend

**渲染源 composable**:
- useMermaid.render(id,code,theme): mermaid.render('mermaid-${id}',code)→{svg}；securityLevel:'strict'；5s timeout
- usePlantUML.render(code,theme): **模块级renderQueue Promise链保证串行**(不可并行)；MutationObserver检测svg；validateSource(@start/@end)；vendor viz-global.js+plantuml.js

**useMarkdown 公开API签名（下游依赖）**:
`useMarkdown().render(content, theme): Promise<{ html, headings, mermaidSources, plantumlSources, svgSources }>`
消费者: MarkdownViewer(L386 render调用) + emit('headings')

## [6] API 消费者 + 测试计数确认 (2026-06-25)
**EntryDetailView 消费 MarkdownViewer** (L136-141):
`<MarkdownViewer :content="entryStore.fileContent" :headings="tocHeadings" @select-heading="scrollToHeading" />`
- content prop 是硬依赖；:headings 落入 fallthrough；@select-heading 与 MarkdownViewer 的 emit('headings') 名称不一致（既有不一致，重构须保真=保留现状不修不破）
- MarkdownViewer 还暴露 `<slot name="toc" :headings="headings" />`（L3）—— slot API 须保留

**单元测试实际计数**: 140 个 it/test（P0 称86，实际更多；全保留红线不变）
**相关测试文件**: useMarkdown.svg.spec / SvgBlock.spec / usePlantUML.spec（SvgBlock依赖data-action字符串协议，迁移emit后需更新——P3须处理）

## [7] 结论：无 [NEED_CONFIRM]，无 [CAPABILITY_GAP] (2026-06-25)
- user_decisions 已确认，方向明确
- 三胞胎差异矩阵已详尽识别（15%差异点）
- 能力：P6 需浏览器视觉验证，playwright-cdp skill + Chrome CDP:18800 可用 → supplementable/available，非GAP
- T021 时序约束已解除（v0.1.67发布），P4可直启
- 开始撰写 P1-requirements.md

## [8] P1 完成 (2026-06-25)
P1-requirements.md 已落盘。gate 自检：
- Header 完整（phase/task_id/type/parent/trace_id/status/created）✓
- 29 条 BDD（Given/When/Then）覆盖 9 维度 + 可扩展性 ✓
- 三胞胎差异矩阵（I2）逐行核对源码 ✓
- 待确认清单：无 ✓
- 能力缺口：无（全部 available）✓
- 裁剪：全阶段 [P1-P8] 保留 ✓

## [8] P1 完成 (2026-06-25)
P1-requirements.md 已落盘。gate 验证：
- Header 完整 ✓
- 29 条 BDD（Given/When/Then）覆盖 9 维度 ✓
- 三胞胎差异矩阵（I2，24 行对比表）✓
- 10 项隐含需求识别（I1-I10）✓
- [NEED_CONFIRM]=0 ✓
- [CAPABILITY_GAP]=0（全 available）✓
- 裁剪：全阶段保留 [P1..P8] ✓
