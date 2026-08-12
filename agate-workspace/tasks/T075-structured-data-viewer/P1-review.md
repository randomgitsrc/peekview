---
phase: P1
task_id: T075-structured-data-viewer
type: review
parent: P1-requirements.md
trace_id: T075-P1-review-20260731
status: approved
created: 2026-07-31
agent: requirements-review
---

## 评审摘要

复审轮。上一轮 review 给出 needs-revision（3 BLOCKER + 10 WARN），analyst 已修订。本轮逐条验证修订结果：

- **3 BLOCKER 全部修复**：BDD-03 拆为 BDD-03~06（4 扩展名独立），BDD-04 拆为 BDD-07~11（5 检测属性独立），P1 纯净性违规全部清理（2.2/2.4/2.5/2.10/2.11 改为"由 P2 决定"，packages 改为目录级声明）。
- **10 WARN 全部修复**：BDD 拆分完成（分页、展开/折叠、截断、源码切换、Markdown 切换、6 格式切换），CSV 边界补充（引号内换行 + 双引号转义），双主题 + 移动端 BDD 补充，空文件 BDD 补充，端到端 BDD 补充。
- **BDD 编号连续性**：BDD-01 ~ BDD-53，无跳号、无重复。
- **单条 Given-When-Then 规则**：53 条 BDD 全部通过自动化校验，每条仅 1 Given + 1 When + ≥1 Then（And 扩展）。

## BLOCKER 修复验证

### B1 — 原 BDD-03（4 扩展名合并）→ 已修复

原 BDD-03 将 .json/.yaml/.yml/.xml 合并为 1 条 Given-When-Then。修订后拆为：

- **BDD-03**: .json → language='json'（Given 一个扩展名 / When detect_language / Then 返回 'json'）
- **BDD-04**: .yaml → language='yaml'
- **BDD-05**: .yml → language='yaml'
- **BDD-06**: .xml → language='xml'

每条单 Given-When-Then，可独立二值判定。✅ 修复到位。

### B2 — 原 BDD-04（5 检测属性合并）→ 已修复

原 BDD-04 标题覆盖 5 个 is* 属性但 Given 仅验证 isCsv。修订后拆为：

- **BDD-07**: isCsv（language='csv' → isCsv=true，其余 false）
- **BDD-08**: isTsv（language='tsv' → isTsv=true，其余 false）
- **BDD-09**: isJson（language='json' → isJson=true，其余 false）
- **BDD-10**: isYaml（language='yaml' → isYaml=true，其余 false）
- **BDD-11**: isXml（language='xml' → isXml=true，其余 false）

每条验证目标属性为 true 且其余 4 个为 false，互斥语义清晰。✅ 修复到位。

### B3 — P1 纯净性违规 → 已修复

逐条验证 6 个违规点：

| # | 位置 | 原问题 | 修订后 | 判定 |
|---|------|--------|--------|------|
| 1 | 隐含需求 2.2 | 规定 EntryDetailView viewMode 状态、prop 传递 | "文件切换时需重置为渲染视图，切换机制需统一管理。具体状态管理位置和 prop 传递方式由 P2 决定。" | ✅ |
| 2 | 隐含需求 2.4 | 规定 TableView 内部 perPage 状态、选择器位置 | "用户需可选每页行数（50/100/500），切换每页行数时回到第一页。具体 UI 布局和状态管理由 P2 决定。" | ✅ |
| 3 | 隐含需求 2.5 | 规定"手写解析"实现决策 | "需处理 CSV 边界情况（引号内逗号、引号内换行、双引号转义、BOM 头）。具体解析实现方式由 P2 决定。" | ✅ |
| 4 | 隐含需求 2.10 | 规定 package.json 添加具体依赖名 | "需新增 npm 依赖（TanStack Table + js-yaml），Vite 打包内嵌。" — 引用 P0 技术约束，无文件操作步骤 | ✅ |
| 5 | 隐含需求 2.11 | 规定渲染调度链具体顺序 | "新渲染器需插入现有渲染调度链。具体链顺序由 P2 决定。" | ✅ |
| 6 | packages 部分 | 列出具体新建文件名（useCsvParser.ts/useTreeData.ts/TableView.vue/TreeView.vue） | 改为目录级声明（src/components/、src/composables/）并标注"目录级，具体文件名由 P2 决定" | ✅ |

额外校验：grep 搜索 `useCsvParser|useTreeData|TableView\.vue|TreeView\.vue|手写解析|链顺序为|EntryDetailView 需新增|TableView 组件内部管理|viewMode 状态` → 0 匹配。无残留实现规范。✅ 修复到位。

## WARN 修复验证

### W1 — 原 BDD-10（分页 + perPage 合并）→ 已修复

拆为 BDD-19（默认每页 100 行）+ BDD-20（每页行数切换后回到第一页）。✅

### W2 — 原 BDD-16（展开 + 折叠合并）→ 已修复

拆为 BDD-27（树节点展开）+ BDD-28（树节点折叠）。✅

### W3 — 原 BDD-21（标题 3 格式但 Given 仅 JSON）→ 已修复

拆为 BDD-33（JSON >2MB）+ BDD-34（YAML >2MB）+ BDD-35（XML >2MB），每条独立 Given-When-Then。✅

### W4 — 原 BDD-23（3 个 Then 合并）→ 已修复

拆为 BDD-38（切换到源码视图）+ BDD-39（切换回渲染视图）。✅

### W5 — 原 BDD-24（2 个 When-Then 合并）→ 已修复

拆为 BDD-40（Markdown 切换到源码）+ BDD-41（Markdown 切换回渲染恢复 TOC）。✅

### W6 — 原 BDD-26（6 种格式合并）→ 已修复

拆为 BDD-43（CSV）+ BDD-44（TSV）+ BDD-45（JSON）+ BDD-46（YAML）+ BDD-47（XML）+ BDD-48（Markdown），每条独立 Given-When-Then。✅

### W7 — CSV 边界仅覆盖引号内逗号 → 已修复

拆为 BDD-14（引号内逗号不拆列）+ BDD-15（引号内换行不拆行）+ BDD-16（双引号转义正确）。✅

> **INFO（非阻断）**：隐含需求 2.5 还提到 BOM 头，但无独立 BDD。BOM 处理属解析器实现细节（strip BOM），用户不可见且难以通过 P6 截图验证。不作为阻断项，P2/P3 可在单元测试中覆盖。

### W8 — 双主题 + 移动端无 BDD → 已修复

补充 BDD-51（深色/浅色双主题下渲染器正常显示）+ BDD-52（移动端响应式布局）。✅

### W9 — 无空文件/空数据 BDD → 已修复

补充 BDD-23（空 CSV 文件渲染不崩溃）+ BDD-36（空 JSON 文件渲染不崩溃）。✅

### W10 — 无端到端 BDD → 已修复

补充 BDD-53（后端 language 值驱动前端渲染器选择），以 .tsv 为例验证后端→前端渲染器选择的完整链路。✅

## BDD 逐条评审（53 条）

### 格式检测（BDD-01 ~ BDD-11）

- **BDD-01**: .csv → language='csv' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-02**: .tsv → language='tsv' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-03**: .json → language='json' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-04**: .yaml → language='yaml' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-05**: .yml → language='yaml' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-06**: .xml → language='xml' — PASS | 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **BDD-07**: isCsv 检测 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-08**: isTsv 检测 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-09**: isJson 检测 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-10**: isYaml 检测 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-11**: isXml 检测 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### TableView 渲染（BDD-12 ~ BDD-23）

- **BDD-12**: CSV 渲染为表格视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-13**: TSV 渲染为表格视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-14**: CSV 引号内逗号不拆列 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-15**: CSV 引号内换行不拆行 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-16**: CSV 双引号转义正确 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-17**: 表格列头排序 — PASS | 数据✓ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-18**: 表格列头筛选 — PASS | 数据✓ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-19**: 表格默认每页 100 行 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-20**: 每页行数切换后回到第一页 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-21**: 表格横向滚动 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-22**: CSV 超过 50000 行截断 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-23**: 空 CSV 文件渲染不崩溃 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### TreeView 渲染（BDD-24 ~ BDD-36）

- **BDD-24**: JSON 渲染为树视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-25**: YAML 渲染为树视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-26**: XML 渲染为树视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-27**: 树节点展开 — PASS | 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-28**: 树节点折叠 — PASS | 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-29**: 树节点类型标签 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-30**: 树路径搜索高亮 — PASS | 数据✓ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-31**: 树节点点击复制值 — PASS | 数据✓ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-32**: YAML SAFE_SCHEMA 解析 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-33**: JSON 超过 2MB 截断 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-34**: YAML 超过 2MB 截断 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-35**: XML 超过 2MB 截断 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-36**: 空 JSON 文件渲染不崩溃 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### 源码/渲染切换（BDD-37 ~ BDD-48）

- **BDD-37**: 富渲染格式默认显示渲染视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-38**: 切换到源码视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-39**: 切换回渲染视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-40**: Markdown 切换到源码视图 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-41**: Markdown 切换回渲染视图恢复 TOC — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-42**: 文件切换时重置为渲染视图 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-43**: CSV 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-44**: TSV 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-45**: JSON 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-46**: YAML 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-47**: XML 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-48**: Markdown 格式支持源码切换 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### 异常处理（BDD-49 ~ BDD-50）

- **BDD-49**: CSV 解析失败时降级显示源码 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-50**: JSON 解析失败时显示错误提示 — PASS | 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### 主题与响应式（BDD-51 ~ BDD-52）

- **BDD-51**: 深色/浅色双主题下渲染器正常显示 — PASS | 数据✗ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-52**: 移动端响应式布局 — PASS | 数据✗ 前端✓ 多端✓ 边界✓ 兼容✓

### 端到端（BDD-53）

- **BDD-53**: 后端 language 值驱动前端渲染器选择 — PASS | 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

## 隐含需求覆盖

### 数据维度：✓ 覆盖
- 2.1 后端 .tsv 映射 bug — BDD-01/02 覆盖
- 2.5 CSV 解析边界 — BDD-14（引号内逗号）/ BDD-15（引号内换行）/ BDD-16（双引号转义）覆盖；BOM 头无独立 BDD（INFO，P2/P3 单测覆盖）
- 2.7 大数据量截断 — BDD-22（CSV 50000 行）/ BDD-33/34/35（JSON/YAML/XML 2MB）覆盖

### 前端维度：✓ 覆盖
- 2.2 源码/渲染切换状态管理 — BDD-37~48 覆盖
- 2.3 Markdown 源码切换补缺口 — BDD-40/41/48 覆盖
- 2.4 每页行数可选 — BDD-19/20 覆盖
- 2.8 深色/浅色双主题 — BDD-51 覆盖
- 2.9 移动端响应式 — BDD-52 覆盖

### 多端维度：✓ 覆盖
- 前后端契约：BDD-01~06 覆盖后端 language 返回值，BDD-07~11 覆盖前端消费
- 端到端链路：BDD-53 覆盖"后端返回 → 前端渲染器选择"完整链路

### 边界维度：✓ 覆盖
- 空值：BDD-23（空 CSV）/ BDD-36（空 JSON）覆盖
- 极大值：BDD-22（50000 行）/ BDD-33/34/35（2MB）覆盖
- 解析失败：BDD-49（CSV 降级）/ BDD-50（JSON 错误提示）覆盖
- 并发：不适用（纯前端渲染）
- 时区：不适用（结构化数据无时间戳语义）
- 编码：P0 明确不做，合理

### 兼容维度：✓ 覆盖
- BDD-49/50 覆盖解析失败降级到源码视图
- BDD-42 覆盖文件切换时状态重置
- BDD-01 保护 .csv 回归

## 裁剪评审

**无阶段裁剪**——声明合理，与上一轮一致。

- phases: [P1,P2,P3,P4,P5,P6,P7,P8] 全保留
- risk_level: medium — 与实际匹配
- P2 不可裁剪：新增组件 + 统一切换机制需设计评审 ✓
- P3 保留：CSV parse / YAML safe load / 格式检测有可测试行为 ✓
- P6 不可裁剪：UI 任务必须 Playwright 截图验证 ✓
- P7 保留：多文件改动 ✓

**capability_requirements 三态判断**：
- browser-vision: available ✓
- frontend-test-runner: available ✓
- backend-test-runner: available ✓

## P1 纯净性

✓ 通过。上一轮 6 个违规点全部修复：

1. 隐含需求 2.2 — 删除状态管理位置和 prop 传递方案，改为"由 P2 决定"
2. 隐含需求 2.4 — 删除 UI 布局和状态管理方案，改为"由 P2 决定"
3. 隐含需求 2.5 — 删除"手写解析"实现决策，改为"由 P2 决定"
4. 隐含需求 2.10 — 删除 package.json 文件操作步骤，仅引用 P0 技术约束
5. 隐含需求 2.11 — 删除调度链具体顺序，改为"由 P2 决定"
6. packages 部分 — 改为目录级声明，标注"具体文件名由 P2 决定"

grep 验证无残留实现规范关键词（useCsvParser/useTreeData/TableView.vue/TreeView.vue/手写解析/链顺序为/viewMode 状态）。

## 结论

**Status: approved**

3 BLOCKER 全部修复（BDD 拆分 + P1 纯净性清理），10 WARN 全部修复（BDD 拆分 + 边界/主题/移动端/端到端 BDD 补充）。53 条 BDD 编号连续（BDD-01~53）、每条单 Given-When-Then、可二值判定。隐含需求 2.1~2.11 覆盖完整（数据/前端/多端/边界/兼容五维度均✓）。无阶段裁剪合理。P1 纯净性通过。可进入 P2 方案设计。
