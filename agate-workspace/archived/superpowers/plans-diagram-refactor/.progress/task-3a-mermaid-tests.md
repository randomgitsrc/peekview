# Task 3A: MermaidRenderer 测试 (TDD RED)

## 开始时间
- 2026-06-27 13:30

## 当前步骤
- [x] 读取上下文（plan Task 3、MermaidDiagram.vue、useDiagramViewer.ts、useDiagramViewer.spec.ts、package.json、vite/vitest config、useMermaid.ts、theme store）
- [x] 创建测试目录 `frontend-v3/src/components/renderers/__tests__/`
- [x] 写测试文件 `MermaidRenderer.spec.ts`（98 行）
- [x] 跑 vitest 确认 RED（MermaidRenderer.vue 不存在 → 失败）
- [x] 更新 progress

## RED 验证结果
命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/components/renderers/__tests__/MermaidRenderer.spec.ts`
失败原因：`Error: Failed to resolve import "../MermaidRenderer.vue"` — 文件不存在（feature missing，非 typo/mock 问题）
状态：1 failed suite / 0 tests（import 解析失败，符合 TDD RED）

## 交付
- 测试文件：`frontend-v3/src/components/renderers/__tests__/MermaidRenderer.spec.ts`（98 行，4 个测试）
- progress 文件：`docs/superpowers/plans/.progress/task-3a-mermaid-tests.md`
- 等待 Task 3B/实现 MermaidRenderer.vue 后转 GREEN

## 契约来源
- Props: `code: string`, `theme: "dark" | "light"`（plan 3.2）
- Emits: `renderError`（render 失败时）
- defineExpose: `{ openFullscreen, closeFullscreen, refresh, exportPng, downloadPng }`（plan 3.2 #13）
- Template 外层容器 class `diagram-svg-container`（plan 3.2）
- 用 `useMermaid().render(id, code, theme) => Promise<string>`（useMermaid.ts 实测签名）
- 用 `useDiagramViewer` / `useModalPanZoom`（真实 composable，svg-pan-zoom mock）

## 对任务模板的修正
1. useMermaid mock 用 `vi.hoisted` 共享单一 `mockRender` 实例（原模板每次调用生成新 mock，error 测试无法生效）
2. defineExpose 测试增加 `downloadPng`（plan 3.2 #13 包含它）
3. SVG 内容测试额外断言 `.diagram-svg-container svg` 渲染出 svg
