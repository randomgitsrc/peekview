# Diagram 重构交接单

> **交接时间**: 2026-06-27 14:20
> **当前 HEAD**: `cf42aa56` chore: 提交遗留的 progress 文件和 MermaidRenderer 测试
> **从 opencode 迁移到 claude code 继续**

---

## 1. 任务全貌

把 v0.2.3 的 3 个重复 diagram 组件（4021 行）重构为 DiagramBlock + 3 渲染器 + composable（目标 ~1470 行），**行为零变更**。

- **Spec**: `docs/superpowers/specs/2026-06-27-diagram-refactor-design.md`（630 行，77 条行为保真矩阵，5 个高风险对策 R1-R5）
- **Plan**: `docs/superpowers/plans/2026-06-27-diagram-refactor.md`（976 行，9 个 Task，43 个 checkbox step）
- **策略**: Subagent-Driven + TDD（RED → GREEN → REFACTOR），分 3 批执行
- **Progress 文件**: `docs/superpowers/plans/.progress/` 目录下各 task 的进度记录

---

## 2. 整体进度

### Batch 1（基础设施）✅ 完成

| Task | commit | 行数 | 测试 |
|------|--------|------|------|
| 1. useMarkdown blocks 结构化 | `2db02850` | ~180 改动 | 15 ✅ |
| 2. useDiagramViewer composable | `9e6a02d4` | 274+389 | 17 ✅ |

### Batch 2（渲染器 + 外壳）部分完成

| Task | commit | 行数 | 测试 | 状态 |
|------|--------|------|------|------|
| 3. MermaidRenderer | `dfbafd65` | 370+95 | 4 ✅ | ✅ 完成 |
| 4. PlantUmlRenderer | `44e8e252` | 340+92 | 4 ✅ | ✅ 完成 |
| 5. SvgRenderer | `bd3024ef` | 337+90 | 4 ✅ | ✅ 完成 |
| 6A. DiagramBlock 基础 | `cca153e1` | 73+63 | 6 ✅ | ⚠️ 不完整 |

**DiagramBlock 只实现了基础结构（header + toggle）**，缺 4 个行为：

| 缺失行为 | spec 条目 | 说明 |
|----------|-----------|------|
| Dropdown menu | §5.4 #25-31 | mermaid/svg close-others + click-outside；plantuml 无 |
| Copy code | §5.8 #59-60 | mermaid/svg 有 "✓ Copied!" 2秒反馈；plantuml 只 console.log |
| Error 处理 | §5.12 #66 | mermaid/svg 显示 error div；plantuml 切到 code mode |
| Resize handle | §5.11 #63-65 | mermaid/svg 有 resize handle；plantuml 无 |

### Batch 3（集成 + 清理）未开始

| Task | 说明 | 风险 |
|------|------|------|
| 7. MarkdownViewer 切换 v-for blocks | 删除 diagram 事件委托，改用 DiagramBlock | 中 |
| 8. CSS 迁移 | !important 审计 + .diagram-block/.diagram-modal 前缀 | 🔴 BLOCKER |
| 9. 删除旧组件 + 验证 | 删 3 个旧组件，跑全量测试 + 构建 | 低 |

---

## 3. 当前测试和类型状态

```
测试: 172 passed (172) ✅
类型检查: npx vue-tsc --noEmit → EXIT:0 ✅
构建: npm run build → ✅
```

---

## 4. 关键文件清单

### 新建文件（已提交）

| 文件 | 行数 | 用途 |
|------|------|------|
| `frontend-v3/src/types/index.ts` | +23 | MarkdownBlock/HtmlBlock/DiagramBlockData/MarkdownBlocksResult 类型 |
| `frontend-v3/src/composables/useMarkdown.ts` | 315 | 重写：返回 blocks 数组而非 HTML+sourcesMap |
| `frontend-v3/src/composables/useDiagramViewer.ts` | 274 | pan-zoom/touch/resize composable（useDiagramViewer + useModalPanZoom） |
| `frontend-v3/src/components/renderers/MermaidRenderer.vue` | 370 | mermaid render + cache + cancelled + UUID + PNG 重新 render |
| `frontend-v3/src/components/renderers/PlantUmlRenderer.vue` | 340 | plantuml render + ensureLoaded + 无 touch/resize |
| `frontend-v3/src/components/renderers/SvgRenderer.vue` | 337 | DOMPurify + try-catch pan-zoom + 透明 PNG |
| `frontend-v3/src/components/DiagramBlock.vue` | 73 | 外壳（**不完整**，缺 dropdown/copy/error/resize） |

### 测试文件

| 文件 | 测试数 |
|------|--------|
| `useMarkdown.blocks.spec.ts` | 7 |
| `useMarkdown.svg.spec.ts` | 8（更新） |
| `useDiagramViewer.spec.ts` | 17 |
| `MermaidRenderer.spec.ts` | 4 |
| `PlantUmlRenderer.spec.ts` | 4 |
| `SvgRenderer.spec.ts` | 4 |
| `DiagramBlock.spec.ts` | 6 |

### 待删除文件（Batch 3 Task 9）

- `frontend-v3/src/components/MermaidDiagram.vue`（598 行）
- `frontend-v3/src/components/PlantUmlDiagram.vue`（416 行）
- `frontend-v3/src/components/SvgDiagram.vue`（478 行）

---

## 5. 兼容层（过渡期）

`useMarkdown.ts` 有兼容层（Task 7 会移除）：

```ts
// Compat type for MarkdownViewer (removed in Task 7)
export interface MarkdownRenderResult extends MarkdownBlocksResult {
  html: string
  mermaidSources: Map<number, string>
  plantumlSources: Map<number, string>
  svgSources: Map<number, string>
}
```

render() 返回值带空 compat 字段：`{ blocks, headings, html: '', mermaidSources: new Map(), ... }`

**Task 7 时要彻底改 MarkdownViewer，移除这个兼容层。**

---

## 6. 架构和契约

### 数据流

```
useMarkdown.render(content, theme)
  → blocks: MarkdownBlock[] (html | diagram)
  → html block: { type: "html", html: string }
  → diagram block: { type: "diagram", lang, code, codeViewHtml, index }

MarkdownViewer v-for blocks:
  html → v-html
  diagram → <DiagramBlock :block="block" :theme="theme" />

DiagramBlock:
  v-if lang === 'mermaid' → <MermaidRenderer :code :theme ref="rendererRef" />
  v-else-if plantuml → <PlantUmlRenderer ... />
  v-else-if svg → <SvgRenderer ... />
  defineExpose: { openFullscreen, refresh } → delegates to rendererRef
```

### 渲染器 defineExpose 契约

所有 3 个渲染器暴露：`{ openFullscreen, closeFullscreen, refresh, exportPng, downloadPng }`

### 风险对策已落地

| 风险 | 实现位置 |
|------|---------|
| R1 mermaidCache | MermaidRenderer.vue 模块级 Map |
| R2 cancelled flag | 3 个渲染器 onUnmounted |
| R3 PNG 重新 render | MermaidRenderer/PlantUmlRenderer 用原始 code 重新 render |
| R4 PlantUML 串行 | usePlantUML 模块级 renderQueue（不变） |
| R5 CSS !important + modal | Plan Task 8（未开始） |
| M1 DOMPurify 时机 | SvgRenderer onMounted + watch(code) |
| M2 UUID render ID | MermaidRenderer crypto.randomUUID() |

---

## 7. 下一步执行计划

### 步骤 1: 补全 DiagramBlock（Task 6B）

按 TDD 补 4 个行为。建议拆成 4 个独立小任务：

1. **Dropdown menu**：测试 close-others（mermaid/svg）+ click-outside + plantuml 无 close-others
2. **Copy code**：测试 mermaid/svg "✓ Copied!" 反馈 + plantuml console.log
3. **Error 处理**：测试 mermaid/svg 显示 error div + plantuml 切 code mode
4. **Resize handle**：测试 mermaid/svg 有 handle + plantuml 无 + mousedown 拖拽

### 步骤 2: Task 7 - MarkdownViewer 切换

- 改模板为 v-for blocks
- 删除所有 diagram 事件委托 handler
- 删除 sourcesMap/instances/render 函数
- 保留 renderToken + copyCodeBlock
- 移除 useMarkdown 兼容层
- 跑 `npx vue-tsc --noEmit` + `vitest run`

### 步骤 3: Task 8 - CSS 迁移（🔴 BLOCKER）

- 先做 `!important` 审计：`grep -n '!important' MarkdownViewer.vue`
- 从 MarkdownViewer 提取 diagram CSS → DiagramBlock 非 scoped CSS
- 统一 .mermaid-*/.plantuml-*/.svg-* → .diagram-*
- 所有规则以 `.diagram-block` 为根前缀
- modal Teleport 用 `.diagram-modal` 前缀
- 删除死代码（.mermaid-view/.code-toggle-btn 等）
- 删旧组件 scoped CSS

### 步骤 4: Task 9 - 删除旧组件 + 验证

- `rm MermaidDiagram.vue PlantUmlDiagram.vue SvgDiagram.vue`
- `npx vue-tsc --noEmit` + `vitest run` + `make build-frontend`
- Playwright 视觉验证（对比 v0.2.3 行为）

---

## 8. 环境和命令

```bash
# 测试（不要用 npm run test，会挂住）
cd frontend-v3 && ./node_modules/.bin/vitest run

# 类型检查（CI 强制）
cd frontend-v3 && npx vue-tsc --noEmit

# 构建（复制 dist 到 backend/static）
make build-frontend

# 后端 lint
cd backend && make lint

# 调试服务（独立数据，不碰生产）
make debug-start  # :8888
```

---

## 9. opencode 经验教训

**subagent 空返回问题**：
- 大任务（如完整 DiagramBlock）容易空返回
- 拆小后成功率高（Task 3-5 拆成测试+实现两步就成功了）
- **建议**：每个 subagent 任务控制在"写 1 个文件 + 跑测试"的粒度
- **建议**：要求 subagent 落盘 progress 文件，便于监控
- **建议**：复杂测试（需要 mock 多个依赖）主 Agent 亲自写，只派实现任务给 subagent
