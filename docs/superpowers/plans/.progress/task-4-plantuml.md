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
- [x] RED: 写 `PlantUmlRenderer.spec.ts`（90 行）
- [x] RED 验证：`Failed to resolve import "../PlantUmlRenderer.vue"`（文件不存在，feature missing）
- [ ] GREEN: 写 `PlantUmlRenderer.vue`
- [ ] GREEN 验证：跑 vitest 确认通过
- [ ] 类型检查：vue-tsc --noEmit
- [ ] 全量测试：vitest run
- [ ] 构建：npm run build
- [ ] git commit
- [ ] 更新 progress

## RED 验证结果
命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/components/renderers/__tests__/PlantUmlRenderer.spec.ts`
失败原因：`Error: Failed to resolve import "../PlantUmlRenderer.vue"` — 文件不存在（feature missing，非 typo/mock 问题）
状态：1 failed suite / 0 tests（import 解析失败，符合 TDD RED）

## 进度
- 进行中：GREEN 阶段
