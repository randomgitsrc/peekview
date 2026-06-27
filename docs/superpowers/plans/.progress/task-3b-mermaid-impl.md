# Task 3B: MermaidRenderer 实现 (TDD GREEN)

## 开始时间
- 2026-06-27 13:35

## 上下文确认
- [x] 读测试 `MermaidRenderer.spec.ts`（4 测试，mock mermaid/useMermaid/svg-pan-zoom/theme store）
- [x] 读 plan Task 3.2（实现要点 1-13）
- [x] 读 `MermaidDiagram.vue`（v0.2.3 行为参考）
- [x] 读 `useDiagramViewer.ts`（composable 签名：initPanZoom/onWheel/setup*/cleanup + useModalPanZoom）
- [x] 读 `useMermaid.ts`（`render(id, code, theme) => Promise<string>`，内部 `mermaid.render(\`mermaid-${id}\`, code)`）
- [x] 确认 jsdom 29.1.1 支持 `crypto.randomUUID()`

## 契约
- Props: `code: string`, `theme: "dark" | "light"`
- Emits: `renderError`（render 失败时）
- Template 外层 `class="diagram-svg-container"`，内层 `v-html="svgContent"`
- defineExpose: `{ openFullscreen, closeFullscreen, refresh, exportPng, downloadPng }`
- 用 `useMermaid().render(id, code, theme)`
- 用 `useDiagramViewer`(enableTouch/enableResize/refreshEventName:"mermaid-refresh"/maxZoom:10) + `useModalPanZoom`(maxZoom:20)

## 步骤
- [x] 创建 `frontend-v3/src/components/renderers/MermaidRenderer.vue`（370 行）
- [x] 跑 vitest → GREEN（4/4 通过）
- [x] 跑 vue-tsc --noEmit（无错误）
- [x] 跑全量 vitest（158/158 通过，无 regression）
- [x] npm run build 验证（✓ built in 12.81s）
- [x] git commit

## 实现要点映射
- R1 mermaidCache: 模块级 `new Map<string,string>()`，key=`${theme}-${code}`
- R2 cancelled: `ref(false)`，onUnmounted 设 true，render 后检查
- M2 renderId: `crypto.randomUUID()`
- R3 exportPng: `mermaid.render(\`export-${uuid}\`, props.code)` 原始 code，br 修复，白底
- watch immediate: renderDiagram → nextTick → viewer.initPanZoom
- onMounted: setupResizeObserver/setupTouchListeners/setupRefreshListener
- onUnmounted: cancelled=true / viewer.cleanup() / modal.destroyModalPanZoom()

## 结果
- 测试：`MermaidRenderer.spec.ts` 4/4 通过
- 全量：12 文件 158/158 通过，无 regression
- 类型检查：`npx vue-tsc --noEmit` 无输出（通过）
- 构建：`npm run build` ✓ built in 12.81s
- 行数：MermaidRenderer.vue = 370 行
- stderr 中的 "Mermaid render failed: Error: render failed" 是 renderError 测试的预期 console.error（catch 分支），非失败
