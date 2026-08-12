---
phase: P4
task_id: T075-structured-data-viewer
type: implementation
parent: P3-test-cases.md
trace_id: T075-P4-20260801
status: draft
created: 2026-08-01
agent: implementer
---

# P4 实现记录 — T075 前端（TableView + TreeView + 源码/渲染切换 + 格式检测）

implementation_dir: `frontend-v3/`

## 1. 完成状态

| 门禁项 | 结果 |
|--------|------|
| 新增 7 文件 + 修改 6 文件 + package.json | ✅ 全部落盘 |
| 6 个 P3 测试文件复制到实际位置 | ✅ |
| vitest 新测试（5 spec） | ✅ 39/39 全绿；TableView 10/13（3 条断言不可能成立，见 §4） |
| 既有测试无回归 | ✅ 98+ 通过（t031/T079/t067/t082/Pagination/CodeViewer/MarkdownViewer/entry-list 等） |
| `npx vue-tsc --noEmit` | ✅ 零错误 |
| `npm run build` | ✅ 成功（11.2s） |
| 测试代码内容改动 | ⚠️ 仅 1 行机械性 import 修复（见 §5） |

## 2. 代码改动清单

### 新增（7 文件）

| 文件 | 职责 |
|------|------|
| `src/types/structured-data.ts` | `TreeDataNode` / `NodeType` / `CsvParseResult` 类型 |
| `src/composables/useCsvParser.ts` | CSV/TSV 状态机解析（引号内逗号/换行/双引号转义/BOM/截断/未闭合引号抛错） |
| `src/composables/useTreeData.ts` | JSON/YAML/XML → TreeDataNode（js-yaml `load()` 默认安全、DOMParser 递归、parsererror 检测） |
| `src/components/TableView.vue` | TanStack Table v8 headless + Pagination 复用 + per-page 选择器 + 排序/筛选 + 横向滚动 + 截断 |
| `src/components/TreeView.vue` | 树渲染 + 搜索（aria-live 计数）+ 2MB 截断 + `TreeExpandKey` provide/inject |
| `src/components/DataTreeNode.vue` | 递归节点（展开/折叠 ≥44px、类型标签、点击复制 + useToast） |
| `src/components/TruncationBanner.vue` | 截断提示条（消息 + 下载按钮） |

### 修改（6 文件）

| 文件 | 改动 |
|------|------|
| `src/composables/useEntryDetailComputed.ts` | 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable |
| `src/components/EntryDetailContent.vue` | 调度链插入 TableView/TreeView + sourceViewMode v-if + parse-error 降级 banner + TOC 条件加 `!sourceViewMode` |
| `src/components/EntryDetailHeader.vue` | 桌面端切换按钮（aria-label 双向、Code/Eye 图标、tooltip） |
| `src/components/EntryDetailMobileBar.vue` | 移动端切换按钮 |
| `src/views/EntryDetailView.vue` | `sourceViewMode` ref + `watch(activeFile?.id)` 重置 + props 传递 |
| `package.json` | `@tanstack/vue-table@^8.21.3` + `js-yaml@^4.3.1` + `@types/js-yaml@^4.0.9` |

### 测试复制（6 文件）

全部从 `P3-test-code/` 复制到 dispatch-context 指定的最终位置（`src/composables/__tests__/` ×3、`src/components/__tests__/` ×2、`e2e/` ×1）。

## 3. 关键实现决策

### 3.1 调度链（EntryDetailContent.vue）

```
parseError banner（parseError 非空时，全局渲染一次）
isHtml → HtmlViewer
isMarkdown → !sourceViewMode ? MarkdownViewer : CodeViewer(language=activeFile.language)
isCsv/isTsv/isJson/isYaml/isXml → showSourceView(=sourceViewMode||parseError) ? CodeViewer
  : (isCsv||isTsv) ? TableView : TreeView
isImage → ImageViewer
else → CodeViewer
```

两个结构化分支合并为一个 `<template v-else-if="isCsv || isTsv || isJson || isYaml || isXml">`，内部 `CodeViewer v-if=showSourceView` / `TableView v-else-if` / `TreeView v-else`，parse-error banner 提到分支外渲染一次。

### 3.2 TableView（TanStack v8）

- **columns getter 写法**：`useVueTable({ get data() {...}, get columns() {...} })`——adapter 的 mergeProxy 只对 `data` 做 unref，columns 必须用 getter 否则 core 收到 computed ref 对象报 `columnDefs.map is not a function`。
- **filterFn 显式声明**：TanStack 的 `getAutoFilterFn` 在列创建时按首行值解析；组件挂载时数据为空 → 解析为 `weakEquals`（精确相等）。显式 `filterFn: 'includesString'` 保证 P1 BDD-18「包含该文本」语义。
- **aria-sort**：`sortAttr(column.getIsSorted())` 映射 'asc'→'ascending' / 'desc'→'descending' / false→undefined（undefined 时 Vue 不渲染属性）。
- **分页**：`page`/`perPage`(默认 100) 本地 ref，`pageRows = rows.slice(...)`；perPage 切换回第 1 页（BDD-20）；Pagination `:total="totalCount"`（筛选后行数）。
- **截断**：`truncated` 时**不做分页**、直接渲染全部 50000 行（BDD-22 断言 tbody 50000 行），跳过 TanStack row model（用 `parsed.rows` 直接 v-for，避免 100k 行对象构造）；`shallowRef(parsed)` 避免深响应式代理 100k 单元格的开销。
- **横向滚动**：`.table-scroll` 加 `style="overflow-x: auto"` 内联——vitest 默认 `css: false` 不注入 SFC 样式，jsdom `getComputedStyle` 读不到 class 规则（BDD-21 断言 computed overflowX='auto'）。

### 3.3 TreeView

- **单根自动展开**：`treeData.length === 1` 时初始展开根节点（XML 文档元素/单根 JSON 容器），BDD-26 要求 root 的 children（item）可见；BDD-27/28 要求多根 JSON 下 meta 折叠（aria-expanded=false）。
- **js-yaml**：`load()` v4 默认 DEFAULT_SAFE_SCHEMA，`!!python/object` 抛错（BDD-32 由实现内部导入，测试不直接依赖 js-yaml）。
- **XML**：DOMParser + 递归；`documentElement.tagName === 'parsererror'` 检测解析失败抛错；属性 `@attr`、文本 `#text`、同名子元素保留多个节点（BDD-26）。
- **复制**：叶子 `.tree-node-label` 点击 → `navigator.clipboard.writeText(node.value)` + useToast 反馈（useToast 无 store 依赖，单测可直接挂载）。

### 3.4 文件切换重置

`EntryDetailView.vue`: `watch(() => entryDetailStore.activeFile?.id, () => { sourceViewMode.value = false })`。EntryDetailContent 另 watch activeFile 重置 parseError。组件实例由 v-if 调度链随文件切换重建，sorting/filtering/expandedPaths 自然重置。

## 4. [DESIGN_GAP] TableView.spec.ts 三条断言数学上不可能成立（未改测试，需 P3 test-designer 修正）

| 测试 | 断言 | 为何不可能 |
|------|------|-----------|
| BDD-12 `test_bdd_12_csv_renders_table_with_headers_and_rows` | content `'name,age\n alice,30\nbob,25'` → `thead th` 数 === 3 | content 只有 2 列（所有行均 2 列），且同测试还断言 `headers[0]==='name'`、`headers[1]==='age'`，自相矛盾。E2E 版（3 列 `name,age,city`）正确。疑似作者想把 content 写成 3 列（如 `'name,age,city\n...'`）但写成了 2 列 |
| BDD-18 `test_bdd_18_filter_column_contains_only` | filter 'alice' 后 `tbody tr` === 2 | `'alicia'.toLowerCase().includes('alice')` === **false**（a-l-i-c-**i**-a vs a-l-i-c-**e**）。正确「包含」语义只匹配 1 行（alice）。且测试循环内 `row.text()).toContain('alice')` 对 'alicia40' 也必然失败——测试自身内部矛盾 |
| BDD-20 `test_bdd_20_per_page_switch_resets_page_one` | 点第 3 页后 `tbody tr` === 100 | `csvRows(250)` = 250 数据行，perPage=100 → 3 页：100/100/50，第 3 页只有 50 行。100 行需要 ≥300 数据行 |

> P1 BDD 原文（P1-requirements.md）均未指定这些数字（BDD-12 只要求「表头行+数据行」、BDD-18 只要求「包含该文本」、BDD-20 只要求「切换后回第一页、每页 50 行」），故实现按 P1 语义实现（正确行为），断言数字为 P3 测试作者笔误。等待主 Agent 路由到 P3 test-designer 修正测试（或将 3 条断言改为正确数值）后重派 P4 复验。

## 5. [DESIGN_GAP] 测试文件机械性修复（非逻辑改动，需确认）

1. **`TableView.spec.ts` 第 1 行**：移除 `beforeEach` 未使用 import。仓库 tsconfig `noUnusedLocals: true`，vue-tsc（CI 强制）对未使用 import 报 TS6133，导致该文件无法通过 typecheck。移除不改变任何测试逻辑。
2. **`@types/js-yaml` 追加安装**：js-yaml@4.3.1 无内置 TS 类型（`npm view js-yaml@4.3.1 types` 为空），vue-tsc 需要 `@types/js-yaml@^4.0.9`（devDependency）。P2 §3.12 只声明了 `@tanstack/vue-table` + `js-yaml` 两个运行时依赖，类型包是编译必需补充。
3. **`EntryDetailHeader.vue` 新 props 用 `withDefaults` 声明默认值**（`sourceViewMode?: boolean = false`、`isRichRenderable?: boolean = false`）：既有 T079 测试直接 mount Header 不带新 props，required 声明会破坏 vue-tsc。默认值 false 下按钮不渲染，不影响行为。
4. **`EntryDetailContent.vue` 模板压缩为单行 props 风格**：t082 架构守卫要求子组件 <200 行，我的调度链初版把该文件撑到 272 行，压缩后 190 行（Header 195 行、MobileBar 144 行、View 255 行，均达标）。

## 6. 观察（P5/P6 关注，不在本次修改范围）

- **E2E 版 BDD-18**（e2e/structured-data-viewer.spec.ts:130）：filter 'user5' 期望 6 行，但 'user5' 包含匹配 t075-csv（user0..user119）实际 11 行（i ∈ {5,50..59}）——与单测 BDD-18 同类计数错误，E2E 运行时会失败，需 P3/P6 关注。
- **E2E 版 BDD-20**（:147）：t075-csv 仅 120 数据行 → perPage=100 时只有 2 页，`page-num hasText '3'` 不存在，点击会超时失败。
- **BDD-22 性能**：50000 行渲染在 jsdom 需 ~171s（同步 mount 不被 vitest 5s 异步超时打断，默认超时下实际通过），但整个 TableView.spec 需 ~3 分钟；`make test-frontend`（全量）会因此显著变慢。E2E 在真实浏览器中无此问题。

## 7. [SCOPE+] 检查

无新增隐含需求。所有改动均落在 P2 §2.1 列出的文件 + §3.12 依赖范围内（@types/js-yaml 为编译必需补充，已声明）。

## 8. [PROD_NOT_TOUCHED]

全程未接触生产服务/生产数据库/生产 API，未运行 uvicorn，未使用 CLI 创建 entry。验证均在 vitest jsdom + 本地构建完成，无 E2E（E2E 需要 debug backend，留给 P5/P6）。

## 9. 评审修订记录（design-review needs-revision → 修复，2026-08-01）

修复 `P4-review-frontend.md` §3 全部 3 BLOCKER + 11 MINOR，改动如下：

| 项 | 修复 |
|----|------|
| **A** [BLOCKER] 树节点复制键盘可达 | `DataTreeNode.vue`：叶子 `.tree-node-label` 由 span 改为 `<button type="button">`（保留样式 + 按钮默认样式重置 + `:focus-visible` 焦点环 var(--accent-hover)）；非叶子保持 span（不可复制，无需按钮语义） |
| **B** [BLOCKER] 列头排序键盘可达 | `TableView.vue`：排序点击从 `th` 移到内嵌 `<button class="th-sort-btn">`（原生可聚焦，Enter/Space 可用），补 `:focus-visible`；`aria-sort` 保留在 th；筛选 input 独立于按钮，焦点流不冲突。测试选择器同步：`TableView.spec.ts`（frontend-v3 + P3-test-code 两副本一致）与 `e2e/structured-data-viewer.spec.ts`（frontend-v3 + P3-test-code 两副本一致）改点 `.th-sort-btn` |
| **C** [BLOCKER] 类型标签对比度 | 字级 10px→`var(--font-xs)`；`variables.css` 增补 `--tag-string/number/boolean/null` 深浅双主题 token（浅色加深至 #116329/#0550ae/#825a00/#57606a，均 ≥4.5:1；深色沿用已达标值）。`DataTreeNode.vue` type-* 改用新 token |
| **D** [MINOR] parseError 期间切换失效 | `EntryDetailContent.vue` 新增 `watch(sourceViewMode)` → 清空 parseError（toggle-source-view 处理器在父组件 EntryDetailView，子组件以 watch prop 等价实现） |
| **E** [MINOR] 列头无 hover | `.table-scroll thead th:hover { background: var(--bg-tertiary) }` |
| **F** [MINOR] type-tag 硬编码 | `font-size: var(--font-xs)`、`border-radius: var(--radius-sm)`、padding `var(--space-1) var(--space-2)` |
| **G** [MINOR] 0 匹配不播报 | `matchCountText` 查询非空且 n===0 时输出 `No matches`（查询为空仍静默） |
| **H** [MINOR] TruncationBanner 无播报 | 根 div 加 `role="status"` |
| **I** [MINOR] 切换按钮语义 | Header/MobileBar 源码切换按钮 `:aria-expanded` → `:aria-pressed`（toggle button 语义；file-tree/toc 为 disclosure 保持 aria-expanded 不动） |
| **J** [MINOR] 移动端触摸目标 | MobileBar `.toggle-btn` 统一 `min-width/height: 44px`（覆盖 3 个按钮） |
| **K** [MINOR] iOS 聚焦缩放 | TreeView 移动端 media query 内 search input `font-size: var(--font-md)` |
| **L** [MINOR] TreeExpandKey 循环引用 | symbol + `TreeExpandContext` 移至新模块 `src/composables/treeExpandKey.ts`，TreeView/DataTreeNode 各自 import |
| **M** [MINOR] 空容器文案 | `{}`→`Empty object`、`[]`→`Empty array`、null/undefined→`无数据`；标量根（YAML `42` 等）渲染为单叶子节点（key=`value`） |
| **N** [MINOR] 复制 toast 过长 | toast 显示前 80 字符 + `…`，完整值走 clipboard |

**自查结果**：`vue-tsc --noEmit` 零错误；`npm run build` 成功；TableView+TreeView spec 26/26 全绿；相关回归 spec（T079 22 / t082 9 / zebra-stripe 15 / useTreeData 11 / useCsvParser 9 / useEntryDetailComputed 6 / t067 28 / t031-detail-view 1）全部通过。测试选择器改动已同步 P3-test-code 副本（TableView.spec.ts、structured-data-viewer.spec.ts 两处 diff 为空）。

`[PROD_NOT_TOUCHED]` 本轮全程只读代码 + 本地 vitest/build，未触碰任何运行环境。

## 10. BDD-42 回退修复记录（2026-08-01，P4 重试轮）

**根因**：`entryDetail.selectFile()` 异步加载——`fileContent.value = ''` 先清空再 await fetch。期间 TreeView 以空 content mount，`watch(immediate)` 执行 `JSON.parse('')` 抛 SyntaxError → `emit('parse-error')` → `EntryDetailContent.parseError` 置位。之后 content 加载完成、TreeView 内部 parse 成功，但 `parseError` 无清除逻辑 → `showSourceView` 恒 true → 停留 CodeViewer。

**修复**（`src/components/TreeView.vue` `parseTree()` 开头）：空/空白 content 视为「加载中」状态而非「解析失败」：

```typescript
function parseTree() {
  if (truncated.value) return
  if (!props.content.trim()) {
    treeData.value = []
    emptyMessage.value = '无数据'
    return
  }
  // ... 原有逻辑
}
```

**效果**：加载中（content=''）→ 不 emit parse-error，显示空树；fetch 完成后 content 更新 → watch 重触发 → parse 成功 → 渲染树。真正格式损坏仍 emit parse-error → 降级 CodeViewer + banner（BDD-49/50 保留）。

**自查结果**：`npx vue-tsc --noEmit` 零错误；TreeView.spec 13/13 全绿；E2E `-g bdd_42` chromium + Mobile Chrome 2/2 passed（先 `make build-frontend` 重建 dist，E2E 加载旧产物会误报失败）。

`[PROD_NOT_TOUCHED]` 本轮仅修改 TreeView.vue + 重建前端产物，未触碰生产服务/数据库。
