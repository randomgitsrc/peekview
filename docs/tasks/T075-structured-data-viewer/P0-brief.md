---
phase: P0
task_id: T075
task_name: structured-data-viewer
type: brief
trace_id: T075-P0-20260728
created: 2026-07-28
status: draft
parent: AI 时代结构化数据查看需求
---

## 任务简述

为 PeekView 新增结构化数据的富渲染能力：TableView（CSV/TSV）+ TreeView（JSON/YAML/XML）+ 统一的源码/渲染切换机制（补齐 Markdown 缺口）。

当前 CSV/TSV/JSON/YAML/XML 一律走 CodeViewer（Shiki 代码高亮），对结构化数据体验差。这些是 AI Agent 高频产出的格式，应该有专用渲染器。

## 背景痛点

1. CSV/TSV 当代码看：无表格对齐、无分页、无筛选，10 行以上就不堪用
2. JSON/YAML/XML 当代码看：无展开/折叠、无路径搜索，嵌套深了看不清结构
3. Markdown 无源码切换：只有渲染视图，想看原始 Markdown 源码时无处可切（Diagram 渲染失败时有"查看源码"，但正常渲染没有）
4. 新增渲染器后，源码/渲染切换是统一需求，需要一个一致的切换机制

## 任务范围

### A. TableView 渲染器（CSV / TSV）

- **检测**：filename `.csv`/`.tsv` 或 language 为 csv/tsv → TableView
- **Parse**：前端 split parse（CSV 逗号分隔 / TSV tab 分隔），处理引号转义
- **渲染**：TanStack Table v8（headless，~15KB，npm install + Vite 打包内嵌）
- **分页**：复用现有 `Pagination.vue` 组件，默认每页 100 行，用户可选 50/100/500
- **列交互**：列头排序（升/降/原序）、列头筛选（文本包含匹配）、横向滚动、动态列宽（自动 fit + 手动拖拽）
- **大数据量**：>50000 行时截断到前 50000 行 + 顶部提示"数据量过大，已显示前 50,000 行" + 下载按钮
- **依赖**：TanStack Table v8（headless，不引入 UI 框架，模板和样式自己写，与项目现有风格一致）

### B. TreeView 渲染器（JSON / YAML / XML）

- **检测**：
  - `.json` / language=json → JSON parse
  - `.yaml`/`.yml` / language=yaml → YAML parse
  - `.xml` / language=xml → XML parse
- **渲染**：递归树节点，展开/折叠，类型标签（string / number / boolean / array / object / null）
- **Parse 层**：
  - JSON：`JSON.parse()`（原生，零依赖）
  - YAML：`js-yaml`（~18KB，必须用 `SAFE_SCHEMA` 防止任意代码执行）
  - XML：`DOMParser` → 递归转 TreeNode（~50 行转换函数，零依赖，浏览器 DOMParser 天然防 XXE）
- **交互**：路径搜索（按 key/value 模糊匹配高亮节点）、点击复制节点值
- **大数据量**：>2MB 时截断 + 提示 + 下载按钮
- **依赖**：js-yaml（npm install + Vite 打包内嵌）

### C. 源码/渲染切换（统一机制）

- 所有富渲染格式统一支持源码 ↔ 渲染切换
- 切换按钮位置：内容区右上角（和现有 Copy/Share 按钮同行或其上方工具栏）
- 切换默认：渲染视图优先
- 切换时状态重置：文件切换时回到渲染视图
- **Markdown 补缺口**：当前 MarkdownViewer 只有渲染视图，新增源码视图（复用 CodeViewer + language=markdown）
- CSV/TSV 源码视图：复用 CodeViewer
- JSON/YAML/XML 源码视图：复用 CodeViewer

### D. 格式检测修正

- 后端 `language.py` 确认对 .csv/.tsv/.json/.yaml/.yml/.xml 的 language 返回值
- 如缺失，补充扩展名 → language 映射
- 前端格式检测属性（`isMarkdown`/`isHtml`/`isImage`）已由 T082 拆分到 `composables/useEntryDetailComputed.ts`，新增 `isCsv`/`isTsv`/`isJson`/`isYaml`/`isXml` 检测应在此 composable 中添加，渲染组件入口在 `EntryDetailContent.vue`

## 不做

- Markdown 内嵌 code block 的 CSV/JSON 渲染 — 只处理独立文件
- 编码检测（GBK/BOM 嗅探）— 后端问题（当前 `decode("utf-8", errors="replace")` 丢失非 UTF-8 内容），降级 roadmap，等真实乱码场景触发
- Code 内置搜索 — 浏览器 Ctrl+F 可用，降级 roadmap
- 虚拟滚动 — 后续按需，当前分页 + 截断足够

## 环境约束

- 前端：Vue 3 + TypeScript，零 UI 框架（TanStack Table 是 headless 纯逻辑，不破坏架构）
- 离线可用：TanStack Table / js-yaml 均通过 npm install + Vite 打包内嵌，不外链 CDN
- 遵循 DESIGN.md 设计系统（CSS 变量、spacing、typography、radius）
- 分页复用现有 `Pagination.vue` 组件
- 后端改动面小：仅 language.py 的扩展名映射

## 已知风险

- risk=medium：新增 2 个渲染器 + 1 个切换机制 + 后端格式检测修正
- TanStack Table headless API 学习成本（需要自己写模板和样式，不像 Ant Design 那样开箱即用）
- Markdown 源码切换改动 MarkdownViewer 和 EntryDetailView，需确保不影响 TOC、DiagramBlock、scrollToHeading 等现有功能
- YAML 安全：必须用 `SAFE_SCHEMA`，否则 `!!python/object` 等标签可执行任意代码
- CSV parse 边界：引号内换行、双引号转义、BOM 头等 edge case

## 验证标准

- .csv 文件显示为可分页、可排序、可筛选、可横向滚动的表格
- .tsv 同上
- .json 文件显示为可展开/折叠的树，带类型标签
- .yaml/.yml 同上
- .xml 同上
- 表格/树视图可一键切换到源码视图（CodeViewer 高亮）
- Markdown 可一键切换到源码视图
- 切换按钮位置和风格统一
- 文件切换时重置为渲染视图
- 超大数据量显示截断提示 + 下载按钮
- Pagination 组件复用正常
- `make typecheck` 通过
- `make build-frontend` 通过
- `make lint` 通过
