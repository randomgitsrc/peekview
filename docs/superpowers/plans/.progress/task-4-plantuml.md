# Task 4: PlantUmlRenderer (TDD RED → GREEN)

## 开始时间
- 2026-06-27 13:45

## 上下文确认
- [x] 读 plan Task 4（行 409-483）：renderError 无参 / 无 touch / 无 resize / 无 cache / ensureLoaded+render / 白底无 br fix / 无 getBBox fallback 800×600 / downloadPng 失败只 console.error / refreshEventName:"plantuml-refresh" / modal title "PlantUML Diagram"
- [x] 读 `MermaidRenderer.vue`（370 行，模式参考）
- [x] 读 `MermaidRenderer.spec.ts`（测试风格参考，vi.hoisted 共享 mock 实例）
- [x] 读 `PlantUmlDiagram.vue`（v0.2.3 实现，exportPng 行为参考）
- [x] 读 `usePlantUML.ts`（`render(code, theme?) => Promise<string>` / `ensureLoaded() => Promise`，命名导出）
- [x] 读 `useDiagramViewer.ts`（enableTouch/enableResize/refreshEventName 参数）

## 契约
- Props: `code: string`, `theme: "dark" | "light"`
- Emits: `renderError`（无参，render 失败时）
- Template 外层 `class="diagram-svg-container"`，内层 `v-html="svgContent"`
- modal title "PlantUML Diagram"
- defineExpose: `{ openFullscreen, closeFullscreen, refresh, exportPng, downloadPng }`
- 用 `usePlantUML.ensureLoaded()` + `usePlantUML.render(code, theme)`（命名空间导入）
- 用 `useDiagramViewer`(enableTouch:false / enableResize:false / refreshEventName:"plantuml-refresh" / maxZoom:10) + `useModalPanZoom`(maxZoom:20)
- 无 mermaidCache / 无 touch / 无 resize observer

## 步骤
- [x] RED: 写 `PlantUmlRenderer.spec.ts`（92 行）
- [x] RED 验证：`Failed to resolve import "../PlantUmlRenderer.vue"`（文件不存在，feature missing）
- [x] GREEN: 写 `PlantUmlRenderer.vue`（340 行）
- [x] GREEN 验证：4/4 通过
- [x] 类型检查：vue-tsc --noEmit（无输出，通过）
- [x] 全量测试：14 文件 166/166 通过（无 regression）
- [x] 构建：npm run build ✓ built in 12.42s
- [x] git commit: 44e8e252
- [x] 更新 progress

## RED 验证结果
命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/components/renderers/__tests__/PlantUmlRenderer.spec.ts`
失败原因：`Error: Failed to resolve import "../PlantUmlRenderer.vue"` — 文件不存在（feature missing，非 typo/mock 问题）
状态：1 failed suite / 0 tests（import 解析失败，符合 TDD RED）

## 实现要点映射
- 命名空间导入 `import * as usePlantUML`，调用 `usePlantUML.ensureLoaded()` + `usePlantUML.render(code, theme)`
- renderError 无参 emit（与 MermaidRenderer 的 `[err]` 不同，对齐 spec #66）
- enableTouch:false / enableResize:false / refreshEventName:"plantuml-refresh" / maxZoom:10
- onMounted 仅 setupRefreshListener（无 touch/resize observer）
- exportPng 用 `usePlantUML.render(props.code, props.theme)` 重新渲染，无 br fix，白底，维度回退 viewBox→width/height attr→800×600（无 getBBox）
- downloadPng 失败只 console.error，无 alert（对齐 spec #58）
- 无 mermaidCache（PlantUML 无缓存，spec #67）
- cancelled flag：onUnmounted 设 true，ensureLoaded 后 + render 后双重检查
- modal title "PlantUML Diagram"

## 结果
- 测试：`PlantUmlRenderer.spec.ts` 4/4 通过
- 全量：14 文件 166/166 通过，无 regression
- 类型检查：`npx vue-tsc --noEmit` 无输出（通过）
- 构建：`npm run build` ✓ built in 12.42s
- 行数：PlantUmlRenderer.vue = 340 行 / PlantUmlRenderer.spec.ts = 92 行
- commit: 44e8e252 `feat(PlantUmlRenderer): plantuml render + pan-zoom + renderError emit (TDD)`
- stderr 中的 "PlantUML render failed: Error: render failed" 是 renderError 测试的预期 console.error（catch 分支），非失败

## 进度
- 完成 ✅
