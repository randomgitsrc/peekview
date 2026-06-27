# Task 5: SvgRenderer (TDD)

## 开始时间
- 2026-06-27 13:45

## 上下文确认
- [x] 读 plan Task 5（485-594 行：SvgRenderer 差异矩阵 0-9 + 脚本大纲）
- [x] 读 `MermaidRenderer.vue`（变体参考，370 行）
- [x] 读 `MermaidRenderer.spec.ts`（测试风格参考，4 用例 + hoisted mock 模式）
- [x] 读 `SvgDiagram.vue`（v0.2.3 行为参考：透明 PNG / 400x300 fallback / console.error 不 alert / download filename svg-diagram-${id}.png）
- [x] 读 `useDiagramViewer.ts`（composable 签名：initPanZoom/refreshPanZoom/setup*/cleanup + useModalPanZoom）

## 契约
- Props: `code: string`, `theme: "dark" | "light"`
- Emits: `renderError: []`（sanitize 返回空时）
- Template 外层 `class="diagram-svg-container"`，内层 `v-html="sanitized"`，modal title "SVG Diagram"
- defineExpose: `{ openFullscreen, closeFullscreen, refresh, exportPng, downloadPng }`
- 用 `useDiagramViewer`(enableTouch/enableResize/refreshEventName:"svg-refresh"/maxZoom:10) + `useModalPanZoom`(maxZoom:20)
- DOMPurify sanitize（非 mermaid render）：doSanitize() 在 onMounted + watch(code, immediate)

## 与 MermaidRenderer 关键差异
1. 无 mermaid / 无 useMermaid / 无 mermaidCache
2. DOMPurify.sanitize(props.code, { ADD_ATTR, ADD_TAGS }) → sanitized ref
3. cancelled flag（R2 一致性，pan-zoom init 异步）
4. exportPng 直接用 sanitized.value（不重新 render），透明背景（无 fillRect），fallback 400x300
5. downloadPng 失败只 console.error（无 alert）
6. refreshEventName: "svg-refresh"

## 步骤
### RED
- [x] 写 `SvgRenderer.spec.ts`（4 用例：mount/expose/renderError 空 sanitize/渲染 SVG）
- [x] 跑 vitest → RED（组件不存在：Failed to resolve import "../SvgRenderer.vue"）

### GREEN
- [x] 写 `SvgRenderer.vue`（337 行）
- [x] 跑 vitest → GREEN（4/4 通过，0 stderr）
- [x] 跑 vue-tsc --noEmit（EXIT=0，无错误）
- [x] 跑全量 vitest（14 文件 166/166 通过，无 regression；PlantUML 由并行任务新增）
- [x] npm run build（✓ built in 11.90s）
- [x] git commit

## 实现要点映射
- 无 mermaid / 无 useMermaid / 无 mermaidCache（与 MermaidRenderer 核心差异）
- doSanitize(): DOMPurify.sanitize(code, { ADD_ATTR, ADD_TAGS }) → sanitized ref；空结果 → hasError + emit("renderError")
- cancelled flag（R2 一致性）：onUnmounted 设 true
- watch(code, immediate): doSanitize + nextTick(refreshPanZoom) — 单一 init 路径（对齐 MermaidRenderer，避免 double-init 泄漏）
- onMounted: setupResizeObserver/setupTouchListeners/setupRefreshListener（不重复 doSanitize/initPanZoom）
- exportPng: 直接用 sanitized.value（不重新 render），透明背景（无 fillRect），fallback 400×300，width/height attr 兜底
- downloadPng: 失败只 console.error（无 alert），filename `svg-diagram-${Date.now()}.png`
- refreshEventName: "svg-refresh"
- modal title "SVG Diagram"，template v-html="sanitized"

## 调查记录
- 首次测试 run 出现 3 次 "svg-pan-zoom init failed" stderr（疑似 vitest 动态 import mock 时序抖动）
- 排查：写 debug 测试确认 svgPanZoomMock 被调用；确认文件为单一 init 路径（doSanitize 仅在 watch，initPanZoom 仅在 refreshPanZoom 内）
- 连续 3 次 run 验证：4/4 通过，0 stderr（稳定，首次为瞬态）

## 结果
- 测试：`SvgRenderer.spec.ts` 4/4 通过，0 stderr
- 全量：14 文件 166/166 通过，无 regression
- 类型检查：`npx vue-tsc --noEmit` EXIT=0（无输出）
- 构建：`npm run build` ✓ built in 11.90s
- 行数：SvgRenderer.vue = 337 行 / SvgRenderer.spec.ts = 90 行
