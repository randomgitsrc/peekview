---
phase: P1
task_id: T075-structured-data-viewer
type: problems
parent: P0-brief.md
trace_id: T075-P1-20260731
status: revised
created: 2026-07-31
revised: 2026-07-31
agent: analyst
---

## 1. 需求复述

为 PeekView 新增结构化数据的富渲染能力，解决 AI Agent 高频产出的 CSV/TSV/JSON/YAML/XML 格式当前一律走 CodeViewer（纯代码高亮）体验差的问题。具体包含四个子任务：

- **A. TableView 渲染器（CSV/TSV）**：将 CSV/TSV 文件渲染为可分页、可排序、可筛选、可横向滚动的表格，使用 TanStack Table v8（headless 纯逻辑库），复用现有 Pagination.vue 组件。
- **B. TreeView 渲染器（JSON/YAML/XML）**：将 JSON/YAML/XML 文件渲染为递归树，支持展开/折叠、类型标签、路径搜索、点击复制节点值。
- **C. 源码/渲染切换（统一机制）**：所有富渲染格式（含 Markdown）统一支持源码 ↔ 渲染视图切换，渲染优先，文件切换时重置为渲染视图。补齐 Markdown 当前只有渲染视图无源码切换的缺口。
- **D. 格式检测修正**：后端 language.py 扩展名映射修正（.tsv 当前错误映射为 'csv'），前端 useEntryDetailComputed.ts 新增 isCsv/isTsv/isJson/isYaml/isXml 检测属性。

## 2. 隐含需求识别

### 2.1 后端 .tsv 映射 bug（必须修）

**现状**：`language.py` 第 69 行 `.tsv` → `'csv'`，导致 .tsv 和 .csv 文件返回相同的 language 值 `'csv'`。

**为什么必须**：前端格式检测依赖 `activeFile.language` 字段判断渲染器类型。如果 .tsv 返回 `'csv'`，前端无法区分 CSV 和 TSV，无法选择正确的分隔符（逗号 vs tab）。P0 任务 D 明确要求"确认/补充扩展名 → language 映射"，这里不是缺失而是映射错误，属于"修正"范畴。

**影响**：修改 `.tsv` → `'tsv'`，需同步将 `'tsv'` 加入 `PLAIN_TEXT_LANGS`（Shiki 无 TSV 语法高亮，走纯文本）。已有 `test_language.py` 无 .csv/.tsv 测试用例，需补充。

### 2.2 源码/渲染切换状态管理（统一机制，非 per-component）

**现状**：DiagramBlock 有 per-component 的 `isCodeMode` 切换（仅在渲染失败时显示"查看源码"按钮）。`useViewMode.ts` 是 explore 页面 grid/list 布局切换，与源码/渲染无关。项目中不存在统一的源码/渲染切换机制。

**为什么必须**：P0 要求所有富渲染格式统一支持切换，且"文件切换时回到渲染视图"。这意味着切换状态不能放在各渲染器内部（否则文件切换时需要通知每个渲染器重置），必须提升到统一管理层级管理。

**影响**：文件切换时需重置为渲染视图，切换机制需统一管理。具体状态管理位置和 prop 传递方式由 P2 决定。

### 2.3 Markdown 源码切换补缺口

**现状**：MarkdownViewer 只有渲染视图，无源码切换。DiagramBlock 在渲染失败时有"查看源码"，但正常渲染的 Markdown 没有查看源码入口。

**为什么必须**：P0 明确要求补齐此缺口。切换到源码视图时，复用 CodeViewer + language='markdown' 显示原始 Markdown 源码。

**影响**：Markdown 分支需支持源码/渲染切换。需确保不影响 TOC、DiagramBlock、scrollToHeading 等现有功能——源码视图时 TOC 和 DiagramBlock 自然不显示（因为走 CodeViewer 而非 MarkdownViewer）。

### 2.4 每页行数可选

**现状**：Pagination.vue 接收 page/perPage/total props，内部计算 totalPages，有页码导航和跳转，但没有每页行数选择器。

**为什么必须**：P0 要求 TableView 默认每页 100 行，用户可选 50/100/500。Pagination.vue 不含此功能。

**影响**：用户需可选每页行数（50/100/500），切换每页行数时回到第一页。具体 UI 布局和状态管理由 P2 决定。

### 2.5 CSV 解析边界情况

**为什么必须**：CSV 格式有多种边界情况——引号内逗号、引号内换行、双引号转义（`""` → `"`）、BOM 头。简单 `split(',')` 会破坏数据。P0 已识别此风险。

**影响**：需处理 CSV 边界情况（引号内逗号、引号内换行、双引号转义、BOM 头）。具体解析实现方式由 P2 决定。

### 2.6 YAML 安全性

**为什么必须**：YAML 默认 schema 允许 `!!python/object` 等标签执行任意代码。P0 已识别此风险，明确要求用 `SAFE_SCHEMA`。

**影响**：js-yaml 的 `load()` 必须传 `{ schema: SAFE_SCHEMA }` 或使用 `safeLoad()`（等价于 `load(..., { schema: DEFAULT_SAFE_SCHEMA })`）。

### 2.7 大数据量截断与下载

**为什么必须**：P0 要求 >50000 行截断（CSV/TSV）和 >2MB 截断（JSON/YAML/XML），显示提示 + 下载按钮。不截断会导致浏览器卡死。

**影响**：渲染器需在 parse 后检测数据量，超限时截断并显示提示条。下载按钮复用 `useEntryDetailComputed` 中已有的 `downloadFile()` 函数。

### 2.8 深色/浅色双主题

**为什么必须**：DESIGN.md 要求所有组件在深色和浅色主题下正常工作。现有组件使用 `--c-*` / `--bg-*` / `--text-*` CSS 变量。

**影响**：TableView 和 TreeView 的所有样式必须使用语义别名 CSS 变量，不能硬编码颜色。类型标签（string/number/boolean 等）需在两个主题下都有足够对比度。

### 2.9 移动端响应式

**为什么必须**：DESIGN.md 要求移动端单列布局，触摸目标 ≥44px。

**影响**：TableView 需横向滚动（移动端窄屏无法显示全部列）。TreeView 的展开/折叠触摸目标需 ≥44px。源码/渲染切换按钮需在移动端可见。

### 2.10 新增 npm 依赖

**为什么必须**：TanStack Table v8（~15KB）和 js-yaml（~18KB）当前未安装。P0 要求通过 npm install + Vite 打包内嵌，不外链 CDN。

**影响**：需新增 npm 依赖（TanStack Table + js-yaml），Vite 打包内嵌。

### 2.11 渲染器调度链插入点

**现状**：EntryDetailContent.vue 的 v-if 链为 isHtml → isMarkdown → isImage → CodeViewer(fallback)。

**为什么必须**：新渲染器需插入此链，在 CodeViewer fallback 之前。

**影响**：新渲染器需插入现有渲染调度链。具体链顺序由 P2 决定。

## 3. BDD 验收条件

### 格式检测

#### BDD-01: .csv 文件后端返回 language='csv'
- Given 一个扩展名为 .csv 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'csv'

#### BDD-02: .tsv 文件后端返回 language='tsv'
- Given 一个扩展名为 .tsv 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'tsv'（不是 'csv'）

#### BDD-03: .json 文件后端返回 language='json'
- Given 一个扩展名为 .json 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'json'

#### BDD-04: .yaml 文件后端返回 language='yaml'
- Given 一个扩展名为 .yaml 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'yaml'

#### BDD-05: .yml 文件后端返回 language='yaml'
- Given 一个扩展名为 .yml 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'yaml'

#### BDD-06: .xml 文件后端返回 language='xml'
- Given 一个扩展名为 .xml 的文件
- When 后端 detect_language 处理该文件名
- Then 返回的 language 值为 'xml'

#### BDD-07: 前端 isCsv 检测属性正确响应 language 值
- Given 一个文件的 language 字段为 'csv'
- When useEntryDetailComputed 计算格式检测属性
- Then isCsv 为 true，isTsv/isJson/isYaml/isXml 均为 false

#### BDD-08: 前端 isTsv 检测属性正确响应 language 值
- Given 一个文件的 language 字段为 'tsv'
- When useEntryDetailComputed 计算格式检测属性
- Then isTsv 为 true，isCsv/isJson/isYaml/isXml 均为 false

#### BDD-09: 前端 isJson 检测属性正确响应 language 值
- Given 一个文件的 language 字段为 'json'
- When useEntryDetailComputed 计算格式检测属性
- Then isJson 为 true，isCsv/isTsv/isYaml/isXml 均为 false

#### BDD-10: 前端 isYaml 检测属性正确响应 language 值
- Given 一个文件的 language 字段为 'yaml'
- When useEntryDetailComputed 计算格式检测属性
- Then isYaml 为 true，isCsv/isTsv/isJson/isXml 均为 false

#### BDD-11: 前端 isXml 检测属性正确响应 language 值
- Given 一个文件的 language 字段为 'xml'
- When useEntryDetailComputed 计算格式检测属性
- Then isXml 为 true，isCsv/isTsv/isJson/isYaml 均为 false

### TableView 渲染（CSV/TSV）

#### BDD-12: CSV 文件渲染为表格视图
- Given 用户打开一个包含 .csv 文件的 entry
- When 文件加载完成
- Then 内容区显示表格视图（表头行 + 数据行），而非代码高亮视图

#### BDD-13: TSV 文件渲染为表格视图
- Given 用户打开一个包含 .tsv 文件的 entry
- When 文件加载完成
- Then 内容区显示表格视图，tab 分隔的数据正确解析为列

#### BDD-14: CSV 引号内逗号不拆列
- Given 一个 CSV 文件内容包含 `"hello, world"` 这样的引号包裹字段
- When 渲染为表格
- Then 该字段显示为单个单元格内容 `hello, world`，而非拆成两列

#### BDD-15: CSV 引号内换行不拆行
- Given 一个 CSV 文件内容包含 `"line1\nline2"` 这样的引号包裹字段（字段内含换行符）
- When 渲染为表格
- Then 该字段显示为单个单元格内容（含换行），而非拆成两行

#### BDD-16: CSV 双引号转义正确
- Given 一个 CSV 文件内容包含 `"say ""hi"""` 这样的转义双引号字段
- When 渲染为表格
- Then 该字段显示为单个单元格内容 `say "hi"`，而非保留 `""`

#### BDD-17: 表格列头排序
- Given 用户正在查看一个 CSV 表格视图
- When 用户点击某列列头
- Then 该列数据按升序排序，再次点击切换为降序，第三次点击恢复原序

#### BDD-18: 表格列头筛选
- Given 用户正在查看一个 CSV 表格视图
- When 用户在某列筛选框输入文本
- Then 表格仅显示该列包含该文本的行

#### BDD-19: 表格默认每页 100 行
- Given 一个超过 100 行的 CSV 文件
- When 用户在表格视图中查看
- Then 默认每页显示 100 行，底部显示分页控件

#### BDD-20: 每页行数切换后回到第一页
- Given 用户正在查看一个 CSV 表格视图，当前在第 3 页
- When 用户将每页行数从 100 切换为 50
- Then 表格回到第一页，每页显示 50 行

#### BDD-21: 表格横向滚动
- Given 一个列数超过视口宽度的 CSV 文件
- When 用户查看表格
- Then 表格内容区可横向滚动，列头跟随滚动保持可见

#### BDD-22: CSV 超过 50000 行截断
- Given 一个超过 50000 行的 CSV 文件
- When 渲染表格
- Then 仅显示前 50000 行
- And 顶部显示截断提示信息
- And 提示区域包含下载按钮可下载完整文件

#### BDD-23: 空 CSV 文件渲染不崩溃
- Given 一个内容为空的 CSV 文件（0 行数据）
- When 渲染表格
- Then 显示空表格或"无数据"提示，页面不崩溃

### TreeView 渲染（JSON/YAML/XML）

#### BDD-24: JSON 文件渲染为树视图
- Given 用户打开一个包含 .json 文件的 entry
- When 文件加载完成
- Then 内容区显示树视图，根节点可展开/折叠，子节点显示类型标签

#### BDD-25: YAML 文件渲染为树视图
- Given 用户打开一个包含 .yaml 文件的 entry
- When 文件加载完成
- Then 内容区显示树视图，YAML 内容正确解析为树结构

#### BDD-26: XML 文件渲染为树视图
- Given 用户打开一个包含 .xml 文件的 entry
- When 文件加载完成
- Then 内容区显示树视图，XML 元素/属性/文本节点正确映射为树节点

#### BDD-27: 树节点展开
- Given 用户正在查看一个 JSON 树视图，根节点下有嵌套子节点，子节点当前隐藏
- When 用户点击根节点的展开图标
- Then 子节点显示

#### BDD-28: 树节点折叠
- Given 用户正在查看一个 JSON 树视图，根节点的子节点当前显示
- When 用户点击根节点的折叠图标
- Then 子节点隐藏

#### BDD-29: 树节点类型标签
- Given 用户正在查看一个树视图
- When 节点为不同 JSON 类型（string/number/boolean/array/object/null）
- Then 每个节点旁显示对应的类型标签

#### BDD-30: 树路径搜索高亮
- Given 用户正在查看一个树视图
- When 用户在搜索框输入文本
- Then key 或 value 包含该文本的节点高亮显示

#### BDD-31: 树节点点击复制值
- Given 用户正在查看一个树视图
- When 用户点击某个叶子节点的值
- Then 该值被复制到剪贴板

#### BDD-32: YAML 使用 SAFE_SCHEMA 解析
- Given 一个包含 `!!python/object` 标签的 YAML 文件
- When 前端解析该 YAML
- Then 解析抛出错误或拒绝执行该标签（不执行任意代码），渲染器显示解析错误提示

#### BDD-33: JSON 超过 2MB 截断
- Given 一个超过 2MB 的 JSON 文件
- When 渲染树视图
- Then 显示截断提示信息
- And 提示区域包含下载按钮可下载完整文件

#### BDD-34: YAML 超过 2MB 截断
- Given 一个超过 2MB 的 YAML 文件
- When 渲染树视图
- Then 显示截断提示信息
- And 提示区域包含下载按钮可下载完整文件

#### BDD-35: XML 超过 2MB 截断
- Given 一个超过 2MB 的 XML 文件
- When 渲染树视图
- Then 显示截断提示信息
- And 提示区域包含下载按钮可下载完整文件

#### BDD-36: 空 JSON 文件渲染不崩溃
- Given 一个内容为 `{}` 或 `[]` 或 `null` 的 JSON 文件
- When 渲染树视图
- Then 显示空树或"无数据"提示，页面不崩溃

### 源码/渲染切换

#### BDD-37: 富渲染格式默认显示渲染视图
- Given 用户打开一个包含 .csv 文件的 entry
- When 文件加载完成
- Then 默认显示表格渲染视图，而非源码视图

#### BDD-38: 切换到源码视图
- Given 用户正在查看一个 CSV 表格视图
- When 用户点击源码切换按钮
- Then 内容区切换为 CodeViewer 代码高亮视图

#### BDD-39: 切换回渲染视图
- Given 用户当前处于源码视图（CodeViewer）
- When 用户点击渲染切换按钮
- Then 内容区切换回表格渲染视图

#### BDD-40: Markdown 切换到源码视图
- Given 用户正在查看一个 Markdown 渲染视图
- When 用户点击源码切换按钮
- Then 显示 Markdown 源码（CodeViewer + language=markdown）

#### BDD-41: Markdown 切换回渲染视图恢复 TOC
- Given 用户当前处于 Markdown 源码视图
- When 用户点击渲染切换按钮
- Then 恢复 Markdown 渲染视图，TOC 功能正常

#### BDD-42: 文件切换时重置为渲染视图
- Given 用户在查看 CSV 文件时切换到了源码视图
- When 用户切换到另一个文件
- Then 新文件默认显示渲染视图（源码视图状态不保留）

#### BDD-43: CSV 格式支持源码切换
- Given 用户打开一个 .csv 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

#### BDD-44: TSV 格式支持源码切换
- Given 用户打开一个 .tsv 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

#### BDD-45: JSON 格式支持源码切换
- Given 用户打开一个 .json 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

#### BDD-46: YAML 格式支持源码切换
- Given 用户打开一个 .yaml 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

#### BDD-47: XML 格式支持源码切换
- Given 用户打开一个 .xml 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

#### BDD-48: Markdown 格式支持源码切换
- Given 用户打开一个 .md 文件并处于渲染视图
- When 用户点击源码切换按钮
- Then 切换到 CodeViewer 源码视图，再次点击可切换回渲染视图

### 异常处理

#### BDD-49: CSV 解析失败时降级显示源码
- Given 一个格式损坏的 CSV 文件（如引号未闭合）
- When 前端尝试解析
- Then 解析失败时不导致页面崩溃，降级显示源码视图（CodeViewer）

#### BDD-50: JSON 解析失败时显示错误提示
- Given 一个格式无效的 JSON 文件
- When 前端尝试 JSON.parse
- Then 显示解析错误提示信息，并提供查看源码的入口

### 主题与响应式

#### BDD-51: 深色/浅色双主题下渲染器正常显示
- Given 用户切换深色主题和浅色主题
- When 查看 TableView 和 TreeView
- Then 所有元素使用语义 CSS 变量着色，无明显对比度问题（类型标签、表头、单元格、树节点均可辨识）

#### BDD-52: 移动端响应式布局
- Given 移动端视口（窄屏）
- When 查看 TableView 和 TreeView
- Then 表格内容区可横向滚动，树节点展开/折叠触摸目标 ≥44px，源码/渲染切换按钮在移动端可见

### 端到端

#### BDD-53: 后端 language 值驱动前端渲染器选择
- Given 后端对一个 .tsv 文件返回 language='tsv'
- When 前端加载该文件并渲染
- Then 前端进入 TSV 表格渲染分支（而非 CSV 分支或 CodeViewer fallback），验证后端→前端渲染器选择的完整链路一致性

## 4. 待确认清单

[NO_NEED_CONFIRM]

## 5. 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

裁剪理由：无阶段裁剪。任务涉及新增渲染器、统一切换机制、后端修正，risk=medium，走完整 agate 阶段链。

## 6. 范围声明

```yaml
domains:
  - frontend    # 新增 TableView/TreeView 组件、源码/渲染切换机制、格式检测属性
  - backend     # language.py .tsv 映射修正

packages:
  # 后端
  - backend/peekview/language.py           # .tsv 映射修正
  - backend/tests/test_language.py         # 补充 .csv/.tsv 测试

  # 前端 — 新增渲染器组件（目录级，具体文件名由 P2 决定）
  - frontend-v3/src/components/            # 新增表格渲染器组件、树渲染器组件

  # 前端 — 新增解析逻辑（目录级，具体文件名由 P2 决定）
  - frontend-v3/src/composables/           # 新增 CSV/TSV 解析逻辑、JSON/YAML/XML → 树结构转换逻辑

  # 前端 — 修改
  - frontend-v3/src/composables/useEntryDetailComputed.ts  # 新增 isCsv/isTsv/isJson/isYaml/isXml
  - frontend-v3/src/components/EntryDetailContent.vue      # 新增渲染器调度 + 源码/渲染切换
  - frontend-v3/src/components/EntryDetailHeader.vue       # 桌面端切换按钮
  - frontend-v3/src/components/EntryDetailMobileBar.vue    # 移动端切换按钮
  - frontend-v3/src/views/EntryDetailView.vue              # 源码/渲染切换状态管理
  - frontend-v3/src/components/MarkdownViewer.vue          # 适配源码切换
  - frontend-v3/package.json                               # 新增依赖

  # 前端测试（目录级，具体文件名由 P2 决定）
  - frontend-v3/src/composables/__tests__/                 # 格式检测属性测试、解析逻辑测试
  - frontend-v3/src/components/__tests__/                  # 渲染器组件测试
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 TableView/TreeView 的渲染效果、源码/渲染切换交互、深色/浅色主题
    available:
      - "vision-engine skill（vision-analyst 角色或 CLI 工具）"
      - "playwright-cdp skill（Chrome CDP :18800 截图）"
    status: available

  - need: frontend-test-runner
    why: P3/P5 需要运行 vitest 单元测试验证 CSV parser、TreeData 转换、格式检测属性
    available:
      - "make test-frontend（vitest 非 watch 模式）"
      - "make typecheck（vue-tsc 类型检查）"
      - "make build-frontend（Vite 构建）"
    status: available

  - need: backend-test-runner
    why: P3/P5 需要运行 pytest 验证 language.py .tsv 映射修正
    available:
      - "make test-quick（pytest with venv）"
    status: available
```

`requires_minimal_validation: true` — P6 验收依赖浏览器视觉验证（TableView/TreeView 渲染效果、主题适配、交互行为），P2 architect 需产出 `minimal_validation:` 块。
