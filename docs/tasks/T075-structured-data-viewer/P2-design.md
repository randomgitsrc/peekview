---
phase: P2
task_id: T075-structured-data-viewer
type: design
parent: P1-requirements.md
trace_id: T075-P2-20260801
status: revised
created: 2026-08-01
agent: architect
---

## 0. 声明字段

```yaml
packages:
  - backend       # language.py .tsv 映射修正
  - frontend      # 新增渲染器、切换机制、格式检测
domains:
  - frontend
  - backend
ui_affected: true
ui_e2e_points:
  - "CSV 文件渲染为表格视图（表头+数据行）"
  - "TSV 文件渲染为表格视图（tab 分隔正确解析）"
  - "CSV 引号内逗号/换行/双引号转义正确"
  - "表格列头排序（升/降/原序三态）"
  - "表格列头筛选（文本包含匹配）"
  - "表格分页 + 每页行数切换（50/100/500）"
  - "表格横向滚动（列头跟随）"
  - "CSV >50000 行截断提示 + 下载按钮"
  - "JSON 文件渲染为树视图（展开/折叠）"
  - "YAML 文件渲染为树视图"
  - "XML 文件渲染为树视图"
  - "树节点类型标签（string/number/boolean/array/object/null）"
  - "树路径搜索高亮"
  - "树节点点击复制值"
  - "YAML !!python/object 拒绝执行（SAFE_SCHEMA）"
  - "JSON/YAML/XML >2MB 截断提示 + 下载按钮"
  - "源码/渲染切换（CSV/TSV/JSON/YAML/XML/Markdown 全覆盖）"
  - "文件切换时重置为渲染视图"
  - "Markdown 源码切换 → 恢复渲染 → TOC 正常"
  - "深色/浅色双主题下渲染器正常显示"
  - "移动端响应式（横向滚动、触摸目标 ≥44px、切换按钮可见）"
  - "CSV 解析失败降级显示源码"
  - "JSON 解析失败显示错误提示 + 查看源码入口"
```

```yaml
gate_commands:
  P3_backend: "cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no"
  P3_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_backend: "cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no"
  P5_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_build: "cd frontend-v3 && npm run build"
  P5_e2e: "E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test"
  project_module: "src/"
```

```yaml
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, 独立数据目录 /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认测试数据在 debug DB 不在生产 DB"
  prod_not_touched: "[PROD_NOT_TOUCHED]"
```

## 1. 候选方案

### 1.1 总体架构方案

### 方案 A（推荐）：统一切换状态在 EntryDetailView，渲染器组件自包含

**设计**：
- 源码/渲染切换状态 `sourceViewMode: Ref<boolean>` 管理在 `EntryDetailView.vue`
- `watch(activeFile)` 重置 `sourceViewMode = false`（文件切换时回到渲染视图）
- `sourceViewMode` 通过 props 传给 `EntryDetailContent.vue`，EntryDetailContent 内部 v-if 决定渲染器 vs CodeViewer
- 切换按钮放在 `EntryDetailHeader.vue`（桌面端 actions-area）和 `EntryDetailMobileBar.vue`（移动端）
- 新增 `isRichRenderable` computed（= isCsv||isTsv||isJson||isYaml||isXml||isMarkdown），决定是否显示切换按钮
- 各渲染器组件（TableView/TreeView）自包含解析逻辑，接收 `content: string` prop，内部 parse + 截断 + 渲染
- 解析失败时渲染器 emit `parse-error` 携带错误消息字符串（`emit('parse-error', errMsg)`），EntryDetailContent 捕获后自动切到 CodeViewer，并在 CodeViewer 上方显示 error banner 展示错误消息

**优点**：
- 切换状态单一来源（EntryDetailView），文件切换重置逻辑集中
- 渲染器组件无状态依赖（纯 props in），可独立测试
- 不侵入 store（关注点分离：store 管数据，view 管渲染模式）
- 与现有 isFileTreeOpen/isTocOpen 管理模式一致

**风险**：
- EntryDetailView props 传递链变长（多一个 sourceViewMode + isRichRenderable）
- EntryDetailContent 需新增 parse-error 处理逻辑

**工作量**：中等。修改 4 个现有文件 + 新增 4-5 个文件。

### 方案 B：切换状态在 entryDetail store，渲染器组件自包含

**设计**：
- `sourceViewMode: Ref<boolean>` 放在 `entryDetail` store
- `selectFile()` 内部重置 `sourceViewMode = false`
- 新增 `toggleSourceView()` action
- 其余同方案 A

**优点**：
- 文件切换重置逻辑在 store 内部，不需要 watch
- store 已有 wrapEnabled 类似模式

**风险**：
- store 承担了渲染模式管理职责，违反关注点分离
- store 变胖，后续加渲染模式不好扩展
- wrapEnabled 是 per-file 持久状态（文件切换不重置），sourceViewMode 是 per-file 重置状态，语义不同

**工作量**：与方案 A 相近。

#### 选择理由

选 **方案 A**。`sourceViewMode` 是渲染层关注点，不应进入数据层 store。EntryDetailView 已管理多个 UI 状态（isFileTreeOpen/isTocOpen/showFileDrawer/showTocDrawer），加一个 sourceViewMode 符合现有模式。文件切换重置用 `watch(activeFile)` 是 Vue 惯用模式，比在 store selectFile 内部加业务逻辑更清晰。

### 1.2 CSV 解析方案

#### 方案 A（推荐）：自实现 CSV parser（~60 行）

**设计**：
- 新增 `composables/useCsvParser.ts`
- 状态机解析：遍历字符，跟踪 inQuotes 状态
- 处理：引号内逗号、引号内换行、双引号转义（`""` → `"`）、BOM 头（`\uFEFF`）
- 分隔符参数化：comma（CSV）或 tab（TSV）
- 返回 `string[][]`（行 × 列）

**优点**：
- 零额外依赖
- 完全控制边界行为（BDD-14/15/16）
- 可独立单元测试

**风险**：
- 需仔细处理状态机边界

**工作量**：小。~60 行 + 测试。

#### 方案 B：使用 PapaParse（~45KB）

**优点**：成熟库，边界情况覆盖完善
**风险**：新增 ~45KB 依赖，P0 约束倾向最小依赖
**工作量**：更小，但引入依赖

#### 选择理由

选 **方案 A**。CSV 解析状态机是经典算法，~60 行可控。P0 明确要求最小依赖（TanStack Table + js-yaml 已是新增依赖）。自实现可精确覆盖 BDD-14/15/16/23/49 边界情况，且可独立测试。

### 1.3 JSON/YAML/XML → TreeData 转换方案

#### 方案 A（推荐）：统一 TreeData 中间结构 + 各格式独立转换函数

**设计**：
- 定义 `TreeDataNode` 类型：`{ key: string, value: unknown, type: NodeType, children?: TreeDataNode[], path: string }`
- NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
- `jsonToTreeData(data: unknown): TreeDataNode[]` — 递归转换
- `yamlToTreeData(content: string): TreeDataNode[]` — js-yaml load → jsonToTreeData
- `xmlToTreeData(content: string): TreeDataNode[]` — DOMParser → 递归转 TreeNode
- XML 节点特殊处理：元素名 → key，属性 → children(type='attribute')，文本 → children(type='text')

**优点**：
- 统一中间结构，TreeView 组件只处理 TreeDataNode
- 各格式转换逻辑独立，可单独测试
- XML 的特殊结构（属性/文本/CDATA）有专门处理

**风险**：
- XML → TreeDataNode 映射需要设计好属性/文本的表示

**工作量**：中等。3 个转换函数各 ~30-50 行。

#### 方案 B：各格式独立渲染组件

**设计**：JSON/Tree、YAML/Tree、XML/Tree 各一个组件
**风险**：大量重复代码（展开/折叠/搜索/复制逻辑 ×3）
**工作量**：大

#### 选择理由

选 **方案 A**。统一中间结构让 TreeView 组件只写一次，展开/折叠/搜索/复制逻辑不重复。转换函数纯逻辑，可独立测试。

### 1.4 源码/渲染切换 UI 方案

#### 方案 A（推荐）：toggle-btn 模式，复用现有 icon-btn 样式

**设计**：
- 桌面端：EntryDetailHeader actions-area 加一个 toggle-btn，图标用 Lucide Code/FileCode
- 移动端：EntryDetailMobileBar 加一个 toggle-btn
- 按钮只在 `isRichRenderable` 时显示
- 激活态（源码视图）用 `.active` class（同 isFileTreeOpen 模式）
- tooltip: "Source" / "Render"

**优点**：与现有按钮风格完全一致
**工作量**：小

#### 方案 B：浮动按钮覆盖在内容区

**风险**：与现有 UI 风格不一致，DESIGN.md 未定义此模式
**工作量**：中等

#### 选择理由

选 **方案 A**。复用现有 toggle-btn/icon-btn 模式，零新增 UI 范式。

## 2. 影响域分析

### 2.1 改什么

#### 后端（1 文件 + 1 测试文件）

| 文件 | 改动 |
|------|------|
| `backend/peekview/language.py:69` | `.tsv: "csv"` → `.tsv: "tsv"` |
| `backend/peekview/language.py:255-270` | `PLAIN_TEXT_LANGS` 加 `"tsv"` |
| `backend/tests/test_language.py` | 补 .csv/.tsv 测试用例 + 更新 `test_plain_text_langs_count` 断言 14→15 |

#### 前端 — 新增文件

| 文件 | 职责 |
|------|------|
| `frontend-v3/src/components/TableView.vue` | CSV/TSV 表格渲染器（TanStack Table + Pagination 复用） |
| `frontend-v3/src/components/TreeView.vue` | JSON/YAML/XML 树渲染器（递归节点 + 搜索 + 复制） |
| `frontend-v3/src/components/DataTreeNode.vue` | 递归树节点组件（展开/折叠/类型标签/复制） |
| `frontend-v3/src/components/TruncationBanner.vue` | 截断提示条（提示文字 + 下载按钮，TableView/TreeView 复用） |
| `frontend-v3/src/composables/useCsvParser.ts` | CSV/TSV 解析（状态机，处理引号/换行/转义/BOM） |
| `frontend-v3/src/composables/useTreeData.ts` | JSON/YAML/XML → TreeDataNode 转换 |
| `frontend-v3/src/types/structured-data.ts` | TreeDataNode / NodeType / CsvParseResult 类型定义 |

#### 前端 — 修改文件

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable computed |
| `frontend-v3/src/components/EntryDetailContent.vue` | 调度链插入 TableView/TreeView + 源码/渲染切换 v-if + parse-error 降级 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | 桌面端源码/渲染切换按钮 |
| `frontend-v3/src/components/EntryDetailMobileBar.vue` | 移动端源码/渲染切换按钮 |
| `frontend-v3/src/views/EntryDetailView.vue` | sourceViewMode 状态管理 + watch(activeFile) 重置 + props 传递 |
| `frontend-v3/src/components/MarkdownViewer.vue` | 无需改动（源码切换在 EntryDetailContent 层处理，MarkdownViewer 本身不变） |
| `frontend-v3/package.json` | 新增 @tanstack/vue-table + js-yaml |

#### 前端 — 新增测试文件

| 文件 | 测试内容 |
|------|---------|
| `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts` | CSV/TSV 解析边界情况（BDD-14/15/16/23/49） |
| `frontend-v3/src/composables/__tests__/useTreeData.spec.ts` | JSON/YAML/XML → TreeDataNode 转换（BDD-24/25/26/29/32/36） |
| `frontend-v3/src/composables/__tests__/useEntryDetailComputed.structured.spec.ts` | isCsv/isTsv/isJson/isYaml/isXml 检测属性（BDD-07~11） |
| `frontend-v3/src/components/__tests__/TableView.spec.ts` | 表格渲染、排序、筛选、分页（BDD-12~22） |
| `frontend-v3/src/components/__tests__/TreeView.spec.ts` | 树渲染、展开/折叠、搜索、复制（BDD-24~36） |

### 2.2 不改什么

| 保持不变 | 理由 |
|---------|------|
| `entryDetail` store 结构 | sourceViewMode 是渲染层状态，不放 store（方案 A 决策） |
| `Pagination.vue` 组件 | 复用原样，per-page 选择器在 TableView 内部实现（Pagination 不含此功能，改它影响面大） |
| `CodeViewer.vue` 组件 | 源码视图直接复用，不改 |
| `MarkdownViewer.vue` 内部逻辑 | 源码切换在调度层（EntryDetailContent）处理，MarkdownViewer 自身不变 |
| `DiagramBlock.vue` 的 isCodeMode | 独立的 per-component 切换（渲染失败时），不纳入统一切换机制 |
| `useShiki.ts` / `useMarkdown.ts` | 不涉及 |
| 后端 API | 无 API 变更，仅 language.py 映射修正 |
| 路由 | 无路由变更 |
| `useViewMode.ts` | 是 explore 页面 grid/list 切换，不相关 |

### 2.3 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| CSV 解析状态机边界错误 | BDD-14/15/16 失败 | TDD 先写测试覆盖所有边界 |
| js-yaml 版本 API 差异 | v4 vs v5 API 不同 | 锁定 ^4.3.1，load() 默认安全 |
| TanStack Table headless API 学习成本 | 表格渲染可能不符合预期 | P4 前验证 API 基本用法 |
| sourceViewMode props 传递链断裂 | 切换不生效 | EntryDetailView → Content → Header/MobileBar 全链路 |
| Markdown 源码切换影响 TOC | BDD-41 失败 | 源码模式走 CodeViewer，TOC sidebar 在 isMarkdown && !sourceViewMode 时显示 |
| 大文件解析卡 UI | >50000 行 CSV / >2MB JSON | 解析前先检测大小，截断后再 parse |
| XML DOMParser XXE | 安全风险 | DOMParser 天然不解析外部实体（浏览器安全模型） |

## 3. 详细设计

### 3.1 后端 language.py 修正

```python
# language.py:69
# 修正前: ".tsv": "csv",
# 修正后:
".tsv": "tsv",

# language.py:255-270 PLAIN_TEXT_LANGS
# 新增 "tsv"（Shiki 无 TSV 语法高亮，走纯文本）
PLAIN_TEXT_LANGS = {
    "text", "log", "csv", "tsv",  # ← 新增 "tsv"
    "ignore", "git_attributes", ...
}
```

### 3.2 前端格式检测属性

```typescript
// useEntryDetailComputed.ts 新增
const isCsv: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'csv')
const isTsv: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'tsv')
const isJson: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'json')
const isYaml: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'yaml')
const isXml: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'xml')

// 是否支持富渲染（显示切换按钮的条件）
const isRichRenderable: ComputedRef<boolean> = computed(() =>
  isCsv.value || isTsv.value || isJson.value || isYaml.value || isXml.value || isMarkdown.value
)
```

### 3.3 调度链设计

EntryDetailContent.vue 的 v-if 链（修改后）：

```
isHtml → HtmlViewer
isMarkdown && !sourceViewMode → MarkdownViewer
isMarkdown && sourceViewMode → CodeViewer (language=markdown)
isCsv/isTsv && !sourceViewMode && !parseError → TableView
isCsv/isTsv && (sourceViewMode || parseError) → ParseErrorBanner + CodeViewer
isJson/isYaml/isXml && !sourceViewMode && !parseError → TreeView
isJson/isYaml/isXml && (sourceViewMode || parseError) → ParseErrorBanner + CodeViewer
isImage → ImageViewer
else → CodeViewer (fallback)
```

简化实现：用一个 `showSourceView` computed 统一判断：

```typescript
// EntryDetailContent.vue 内部
const showSourceView = computed(() =>
  props.sourceViewMode || parseError.value !== null
)
// parseError: Ref<string | null> — 渲染器 emit('parse-error', errMsg) 时设置
```

调度链顺序：isHtml → isMarkdown → isCsv/isTsv → isJson/isYaml/isXml → isImage → CodeViewer。每个富渲染分支内部根据 `showSourceView` 决定渲染器或（ParseErrorBanner + CodeViewer）。

**ParseErrorBanner**：当 `parseError !== null` 时，在 CodeViewer 上方显示一个 error banner，复用现有 `--error-surface` / `--error-color` 语义变量（与 DiagramBlock.vue:215 `.diagram-error` 同类样式），展示错误消息文本 + 一个"查看源码"链接（已有 sourceViewMode 可见时即源码视图）。BDD-50 要求"显示解析错误提示信息，并提供查看源码的入口"——banner 满足此要求。

```html
<!-- EntryDetailContent.vue — showSourceView 分支内部 -->
<div v-if="parseError" class="parse-error-banner" role="alert">
  <AlertCircleIcon :size="16" />
  <span>{{ parseError }}</span>
</div>
<CodeViewer ... />
```

### 3.4 源码/渲染切换状态管理

```typescript
// EntryDetailView.vue
const sourceViewMode = ref(false)

// 文件切换时重置为渲染视图
watch(() => entryDetailStore.activeFile?.id, () => {
  sourceViewMode.value = false
})

// 传递给子组件
// EntryDetailContent: sourceViewMode prop
// EntryDetailHeader: sourceViewMode + isRichRenderable + @toggle-source-view
// EntryDetailMobileBar: sourceViewMode + isRichRenderable + @toggle-source-view
```

### 3.5 TOC sidebar 适配

```html
<!-- EntryDetailContent.vue -->
<!-- TOC 只在 Markdown 渲染视图时显示（源码视图走 CodeViewer，无 TOC） -->
<aside v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0" class="toc-sidebar">
```

### 3.6 CSV/TSV 解析器（useCsvParser.ts）

```typescript
interface CsvParseResult {
  headers: string[]
  rows: string[][]
  totalRows: number
  truncated: boolean
}

function parseCsv(content: string, delimiter: ',' | '\t', maxRows: number = 50000): CsvParseResult
```

状态机逻辑：
1. 移除 BOM 头（`\uFEFF`）
2. 遍历每个字符，跟踪 `inQuotes` 状态
3. `inQuotes` 内：逗号/换行不分割，`""` → `"`
4. `inQuotes` 外：分隔符 → 列边界，换行 → 行边界
5. 超 maxRows 截断，设 `truncated: true`

### 3.7 TreeData 转换（useTreeData.ts）

```typescript
// types/structured-data.ts
type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

interface TreeDataNode {
  key: string           // 对象 key / 数组索引 / XML 元素名
  value: string         // 叶子节点的显示值（序列化）
  type: NodeType
  children?: TreeDataNode[]
  path: string          // JSON pointer 风格路径（用于搜索高亮）
}

// JSON → TreeDataNode[]
function jsonToTreeData(data: unknown): TreeDataNode[]

// YAML → TreeDataNode[]（js-yaml load → jsonToTreeData）
function yamlToTreeData(content: string): TreeDataNode[]

// XML → TreeDataNode[]（DOMParser → 递归）
function xmlToTreeData(content: string): TreeDataNode[]
```

XML 特殊处理：
- 元素节点 → key=tagName, type='object', children=[属性 + 子元素 + 文本]
- 属性 → key=`@attrName`, type='string'
- 文本节点 → key=`#text`, type='string'
- 多个同名子元素 → 数组化（children 同名合并）

大小检测：
- JSON/YAML/XML 在 parse 前检测 `content.length > 2 * 1024 * 1024`（2MB）
- 超限不 parse，显示截断提示 + 下载按钮

解析阻塞声明：
- 解析在主线程同步执行。设计假设：<2MB 的 JSON/YAML/XML 和 <50000 行的 CSV/TSV，parse 耗时 <100ms，无需 loading 态。若 P6 验收发现实际有可感知卡顿，再评估 `requestIdleCallback` / `setTimeout(0)` 让出主线程的优化方案（当前不预实现，YAGNI）。

### 3.8 TableView.vue 组件设计

```
Props:
  - content: string          // 原始 CSV/TSV 内容
  - delimiter: ',' | '\t'    // 分隔符
  - filename: string         // 用于下载
  - downloadFn: () => void   // 下载函数（复用 useEntryDetailComputed.downloadFile）

内部状态:
  - parsed: CsvParseResult   // 解析结果
  - parseError: boolean      // 解析失败标志
  - sorting: column state    // TanStack Table 排序状态
  - filtering: column filters // TanStack Table 筛选状态
  - page: number             // 当前页
  - perPage: number          // 每页行数 (50/100/500，默认 100)

布局:
  - TruncationBanner（截断时显示）
  - 表格区（TanStack Table headless）
    - thead: 列头（可排序点击，`aria-sort` 绑定排序状态）+ 筛选输入框（`aria-label="Filter {column name}"`）
    - tbody: 数据行
    - overflow-x: auto（横向滚动）
  - perPage 选择器（select: 50/100/500，移动端置于 Pagination 上方独占一行）
  - Pagination 组件（复用）

移动端适配:
  - 列级筛选框：移动端（≤640px）用 CSS `display: none` 隐藏，避免 N 列 × N 个 input 拥挤；移动端用户依赖横向滚动浏览
  - perPage select：移动端置于 Pagination 组件上方，独占一行（`width: 100%`），不与页码导航挤在同一行

文件切换时状态重置:
  - TableView/TreeView 在文件切换时（activeFile 变化）因 v-if 调度链重建被销毁，Vue 默认重建组件实例，内部 sorting/filtering/page/perPage/expandedPaths 状态自然重置。无需手动 reset 逻辑。

emit:
  - 'parse-error': (errMsg: string) => void   // 通知父组件降级到 CodeViewer，携带错误消息
```

### 3.9 TreeView.vue 组件设计

```
Props:
  - content: string          // 原始 JSON/YAML/XML 内容
  - format: 'json' | 'yaml' | 'xml'
  - filename: string         // 用于下载
  - downloadFn: () => void

内部状态:
  - treeData: TreeDataNode[] // 转换后的树数据
  - parseError: string | null // 解析错误信息
  - searchQuery: string      // 搜索文本
  - expandedPaths: Set<string> // 展开的节点路径
  - truncated: boolean       // 大小截断标志

布局:
  - TruncationBanner（截断时显示）
  - 搜索框（输入 → 高亮匹配节点；搜索框 `aria-label="Search tree nodes"`，匹配数量通过 `aria-live="polite"` 区域播报）
  - 树容器（overflow-y: auto，但遵循 DESIGN.md：不声明 overflow-y，让 .content-area 滚动）
  - 递归 DataTreeNode 组件

搜索高亮可访问性声明:
  - 搜索高亮为视觉增强（背景色/文字色变化），屏幕阅读器用户通过搜索框旁的 `aria-live="polite"` 区域获知匹配数量（如 "3 matches"），不依赖高亮感知匹配位置

emit:
  - 'parse-error': (errMsg: string) => void   // 通知父组件降级到 CodeViewer，携带错误消息
```

### 3.10 DataTreeNode.vue 组件设计

```
Props:
  - node: TreeDataNode
  - depth: number
  - searchQuery: string      // 用于高亮
  - expandedPaths: Set<string>

功能:
  - 展开/折叠（点击箭头图标，触摸目标 ≥44px，`aria-expanded` 绑定展开状态）
  - 类型标签（颜色编码，使用现有语义 CSS 变量，不新增变量）：

    | NodeType | CSS 变量 | 语义来源 |
    |----------|----------|----------|
    | string | `--success-color` (`--c-success`) | 绿色，复用成功语义 |
    | number | `--accent-color` (`--c-accent`) | 蓝色，复用强调语义 |
    | boolean | `--warning-color` (`--c-warning`) | 橙色，复用警告语义 |
    | null | `--text-tertiary` (`--c-text-tertiary`) | 灰色，复用弱化文本语义 |
    | object / array | `--accent-hover` (`--c-accent-secondary`) | 紫蓝，复用强调悬停语义 |

    类型标签背景使用对应 `*-bg` 变量（`--success-bg` / `--accent-light` / `--warning-bg` 等），与现有 badge 样式模式一致（见 variables.css badge 变量）。标签文字本身即类型名（`string` / `number` / ...），满足 DESIGN.md:285 "Color alone must not convey meaning; pair with icons or text"。

  - 叶子节点点击复制值（navigator.clipboard.writeText），复制成功/失败通过 useToast composable 反馈（toast.success / toast.error）；Toast.vue 已有 `aria-live="polite"` + `role="alert"`，屏幕阅读器用户可感知复制结果
  - 搜索高亮（key 或 value 包含 searchQuery 时高亮，视觉增强）
  - 递归子节点
```

### 3.11 切换按钮设计

```html
<!-- EntryDetailHeader.vue actions-area 新增 -->
<button
  v-if="isRichRenderable"
  :class="['toggle-btn', { active: sourceViewMode }]"
  @click="$emit('toggle-source-view')"
  :aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"
  :aria-expanded="sourceViewMode"
>
  <CodeIcon v-if="!sourceViewMode" :size="16" />
  <EyeIcon v-else :size="16" />
  <span class="tooltip">{{ sourceViewMode ? 'Render' : 'Source' }}</span>
</button>
```

```html
<!-- EntryDetailMobileBar.vue 新增 -->
<button
  v-if="isRichRenderable"
  :class="['toggle-btn', { active: sourceViewMode }]"
  @click="$emit('toggle-source-view')"
  :aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"
>
  <CodeIcon v-if="!sourceViewMode" :size="16" />
  <EyeIcon v-else :size="16" />
</button>
```

### 3.12 依赖版本

```json
{
  "@tanstack/vue-table": "^8.21.3",
  "js-yaml": "^4.3.1"
}
```

js-yaml v4 决策理由：
- v4 `load()` 默认安全（DEFAULT_SCHEMA = DEFAULT_SAFE_SCHEMA），满足 BDD-32
- v5 是 2026-06 刚发布的 breaking change 大版本，稳定性未验证
- v4 `safeLoad()` deprecated 但 `load()` 已等价安全
- v4-legacy tag 维护中（4.3.1）

### 3.13 截断策略

| 格式 | 截断阈值 | 截断行为 | 提示 |
|------|---------|---------|------|
| CSV/TSV | >50000 行 | 仅 parse 前 50000 行 | "数据量过大，已显示前 50,000 行" + 下载按钮 |
| JSON | >2MB | 不 parse，直接显示截断提示 | "文件超过 2MB，已截断显示" + 下载按钮 |
| YAML | >2MB | 同 JSON | 同上 |
| XML | >2MB | 同 JSON | 同上 |

## 4. files_to_read

```yaml
files_to_read:
  # 后端
  - path: backend/peekview/language.py:9-134,255-270
    why: EXTENSION_MAP 第 69 行 .tsv 修正 + PLAIN_TEXT_LANGS 加 tsv
  - path: backend/tests/test_language.py:204-239
    why: TestPlainTextLanguages.test_plain_text_langs_count 断言更新 14→15

  # 前端 — 核心修改目标
  - path: frontend-v3/src/composables/useEntryDetailComputed.ts
    why: 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable computed，复用 downloadFile()
  - path: frontend-v3/src/components/EntryDetailContent.vue
    why: 调度链插入 TableView/TreeView + 源码/渲染切换 v-if + parse-error 降级 + TOC 条件修改
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: sourceViewMode 状态管理 + watch(activeFile) 重置 + props 传递 + isRichRenderable 传递
  - path: frontend-v3/src/components/EntryDetailHeader.vue:21-45,102-129
    why: actions-area 加切换按钮，props 新增 sourceViewMode/isRichRenderable
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue:1-64
    why: 移动端加切换按钮，props 新增

  # 前端 — 复用参考
  - path: frontend-v3/src/components/Pagination.vue
    why: TableView 分页复用，理解 props/emit 接口
  - path: frontend-v3/src/components/CodeViewer.vue
    why: 源码视图复用，理解 props 接口
  - path: frontend-v3/src/components/TreeNodeItem.vue
    why: 递归树组件参考（EXPAND_KEY inject 模式），DataTreeNode 借鉴递归+展开模式
  - path: frontend-v3/src/stores/entryDetail.ts
    why: activeFile/selectFile 理解，watch(activeFile) 重置 sourceViewMode

  # 前端 — 样式参考
  - path: frontend-v3/src/styles/variables.css
    why: CSS 变量语义别名（--bg-*/--text-*/--border-*/--accent-*），类型标签颜色选择
  - path: frontend-v3/src/components/EntryDetailHeader.vue:149-182
    why: toggle-btn/icon-btn 样式模式，切换按钮复用

  # 前端 — 类型参考
  - path: frontend-v3/src/types/index.ts
    why: File interface（language 字段）、现有 TreeNode 类型（不混用，新类型在 structured-data.ts）

  # 测试参考
  - path: frontend-v3/src/components/__tests__/Pagination.spec.ts
    why: 组件测试模式（mount + props/emit 断言）
  - path: frontend-v3/src/composables/__tests__/useShiki.spec.ts:1-40
    why: composable 测试模式

  # 设计系统
  - path: DESIGN.md:188,261-275
    why: Content Viewers 列表 + 移动端规则 + 滚动架构
```

## 5. minimal_validation

```yaml
minimal_validation:
  - assumption: "TanStack vue-table v8 支持 Vue 3 且 headless API 可用"
    method: "npm view @tanstack/vue-table peerDependencies — 确认 vue>=3.2"
    result: "confirmed"
    note: "@tanstack/vue-table@8.21.3, peerDep vue>=3.2，项目 Vue 3.4+ 兼容。headless API 提供 useVueTable() composable + FlexRender 组件"

  - assumption: "js-yaml v4 load() 默认安全（拒绝 !!python/object 等危险标签）"
    method: "查阅 js-yaml v4.0.0 CHANGELOG — 'removed safe* functions. Use load which is safe by default'"
    result: "confirmed"
    note: "js-yaml@4.3.1 (v4-legacy tag)。v4 load() 使用 DEFAULT_SCHEMA (= DEFAULT_SAFE_SCHEMA)，默认拒绝 !!python/object。v5 (2026-06 发布) 有 breaking API 变更，选 v4 更稳定。BDD-32 由 v4 默认安全行为满足"

  - assumption: "DOMParser 在 vitest jsdom 环境可用"
    method: "vitest.config.ts 已配置 environment: 'jsdom'，jsdom 提供 DOMParser"
    result: "confirmed"
    note: "jsdom 实现 DOMParser，XML 解析可在单元测试中验证。浏览器中 DOMParser 天然防 XXE（不解析外部实体）"

  - assumption: "CSV 解析状态机可覆盖引号内逗号/换行/双引号转义/BOM 边界"
    method: "纯代码逻辑，无外部系统依赖。依赖字符遍历 + inQuotes 状态跟踪"
    result: "not_needed"
    note: "纯代码逻辑，无外部系统依赖。状态机算法经典可控，TDD 先写边界测试（BDD-14/15/16/23/49）再实现"

  - assumption: "JSON/YAML/XML → TreeDataNode 转换是纯数据转换"
    method: "纯代码逻辑，无外部系统依赖。JSON.parse → 递归遍历；js-yaml load → 递归遍历；DOMParser → 递归遍历"
    result: "not_needed"
    note: "纯代码逻辑，无外部系统依赖。依赖 JSON.parse（原生）、js-yaml load（已验证安全）、DOMParser（已验证 jsdom 可用）"
```

## 6. 实现完成的标志

### 后端
- [ ] `detect_language("file.tsv")` 返回 `"tsv"`（不是 `"csv"`）
- [ ] `"tsv" in PLAIN_TEXT_LANGS`
- [ ] `test_language.py` 全绿，含 .csv/.tsv 新测试用例
- [ ] `test_plain_text_langs_count` 断言更新为 15

### 前端 — 格式检测
- [ ] `useEntryDetailComputed` 返回 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable
- [ ] BDD-07~11 测试全绿

### 前端 — TableView
- [ ] CSV/TSV 文件渲染为表格视图（表头+数据行）
- [ ] 引号内逗号/换行/双引号转义正确（BDD-14/15/16）
- [ ] 列头排序（升/降/原序三态）
- [ ] 列头筛选（文本包含匹配）
- [ ] 分页 + 每页行数切换（50/100/500，切换回到第一页）
- [ ] 横向滚动（列头跟随）
- [ ] >50000 行截断 + 下载按钮
- [ ] 空 CSV 不崩溃
- [ ] 解析失败降级 CodeViewer

### 前端 — TreeView
- [ ] JSON/YAML/XML 渲染为树视图
- [ ] 展开/折叠
- [ ] 类型标签（string/number/boolean/array/object/null）
- [ ] 路径搜索高亮
- [ ] 点击复制值
- [ ] YAML !!python/object 拒绝执行
- [ ] >2MB 截断 + 下载按钮
- [ ] 空 JSON/{} /[] /null 不崩溃
- [ ] 解析失败显示错误提示 + 查看源码入口

### 前端 — 源码/渲染切换
- [ ] 所有富渲染格式支持源码 ↔ 渲染切换
- [ ] Markdown 源码切换 → 恢复渲染 → TOC 正常
- [ ] 文件切换时重置为渲染视图
- [ ] 切换按钮在桌面端 Header 和移动端 MobileBar 都可见
- [ ] 切换按钮只在 isRichRenderable 时显示

### 前端 — 主题与响应式
- [ ] 深色/浅色双主题下所有元素使用语义 CSS 变量
- [ ] 移动端横向滚动、触摸目标 ≥44px、切换按钮可见

### 验证命令
- [ ] `make test-quick`（后端 pytest 全绿）
- [ ] `make test-frontend`（vitest 全绿）
- [ ] `make typecheck`（vue-tsc 零错误）
- [ ] `make build-frontend`（Vite 构建成功）
- [ ] `make lint`（ruff 全绿）

## 7. [SCOPE+] 检查

无新增隐含需求。P1 的 11 个隐含需求全部在设计中覆盖：
- 2.1 .tsv 映射 bug → §3.1
- 2.2 源码/渲染切换状态管理 → §1.1 方案 A + §3.4
- 2.3 Markdown 源码切换 → §3.3 调度链 + §3.5 TOC 适配
- 2.4 每页行数可选 → §3.8 TableView perPage 选择器
- 2.5 CSV 解析边界 → §3.6 useCsvParser 状态机
- 2.6 YAML 安全性 → §3.7 js-yaml v4 load() 默认安全
- 2.7 大数据量截断 → §3.13 截断策略
- 2.8 深色/浅色双主题 → 所有组件使用语义 CSS 变量
- 2.9 移动端响应式 → §3.11 切换按钮 + TableView 横向滚动 + DataTreeNode ≥44px
- 2.10 新增 npm 依赖 → §3.12 依赖版本
- 2.11 渲染器调度链插入点 → §3.3 调度链设计
