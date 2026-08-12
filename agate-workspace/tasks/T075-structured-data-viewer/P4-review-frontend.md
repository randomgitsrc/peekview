---
phase: P4
task_id: T075-structured-data-viewer
type: review
parent: P4-implementation-frontend.md
trace_id: T075-P4-review-20260801
status: approved
created: 2026-08-01
agent: design-review
---

# P4 前端设计评审 — T075 structured-data-viewer

## 0. 评审范围与方法

- 评审对象：P4 前端实现（TableView / TreeView / DataTreeNode / TruncationBanner / useCsvParser / useTreeData / structured-data.ts + 5 个修改文件）
- 对照基准：`DESIGN.md`（设计系统）、`P2-design.md §3.2~3.13`（详细设计）、`P4-implementation-frontend.md`（实现声明）
- 环境隔离：`[PROD_NOT_TOUCHED]`（评审全程只读代码文件，未运行任何命令触碰生产/调试环境）
- 检查项：AI Slop / Typography / Spacing / 交互状态 / 移动端 / a11y / 滚动架构 / 对比度计算（WCAG 2.1 AA，逐色值计算）

## 1. 总评

实现质量整体高：**无 AI Slop**（零紫色渐变、零泛化文案、零全居中营销布局）、token 使用严格规范（新组件零硬编码 hex，全部走语义别名）、滚动架构符合 T084 约束、移动端决策有据可依、调度链与状态管理忠实于 P2 方案 A。

但存在 **3 项需修正项（needs-revision）**，集中在可访问性：

1. 树节点值复制仅 `span@click`，**无键盘可达性**（DataTreeNode.vue:15-23）
2. 列头排序仅 `th@click`，**无键盘可达性**（TableView.vue:18-23），且排序是 P1 核心功能（BDD-17/18）
3. 类型标签 10px 字级 + 浅色主题对比度不达 WCAG AA 4.5:1（DataTreeNode.vue:162-194）

其余为 MINOR 级建议，不阻断。详细见 §3。

## 2. 通过项（PASS，附行号证据）

### 2.1 AI Slop 检测 — PASS
- 无紫色/violet 渐变（全项目扫描新组件，唯一彩色来自语义 token `--success-*`/`--warning-*`/`--accent-*`，DataTreeNode.vue:170-194）
- 文案全为功能性：`无数据`（TableView.vue:10 / TreeView.vue:22）、`Search nodes...`（TreeView.vue:15）、`Download`（TruncationBanner.vue:8）、`数据量过大，已显示前 50,000 行`（TableView.vue:5）、`文件超过 2MB，已截断显示`（TreeView.vue:5）。无 "Unlock the power of..." 类文案
- 布局左对齐数据视图，无全居中卡片网格；"无数据"空态居中属惯例，不判违规

### 2.2 Token 与设计系统 — PASS
- 新组件全部使用语义别名（`--bg-*`/`--text-*`/`--border-*`/`--accent-*`/`--success-*`/`--warning-*`/`--error-*`/`--radius-*`/`--font-*`/`--space-*`），无 `--c-*` 原始 token 直用（符合 DESIGN.md:313）
- spacing 均为 4px 倍数：th padding `var(--space-2) var(--space-3)`（TableView.vue:197,237）、tree-node-row `var(--space-1) var(--space-2)`（DataTreeNode.vue:99）、缩进 `depth*20px`（DataTreeNode.vue:3，20=4×5）
- 字级：表格/树 14px `--font-sm`（TableView.vue:188 / TreeView.vue:169 / DataTreeNode.vue:141），meta 12px `--font-xs`（TableView.vue:216,228）——均在 DESIGN.md 字阶内（唯 `.type-tag` 10px 违规，见 §3-F）

### 2.3 滚动架构 — PASS（T084 约束）
- `.table-scroll` 仅 `overflow-x: auto`（TableView.vue:14,179-183），无 overflow-y；`thead th` sticky top:0 相对 `.content-area`（TableView.vue:191-193）
- TreeView/DataTreeNode 无任何 overflow 声明（TreeView.vue:183-187 / DataTreeNode.vue:196-200）——`.content-area`（EntryDetailContent.vue:170）保持唯一纵向滚动容器
- `.table-view`/`.tree-view` 均声明 `min-width: 0`（TableView.vue:175-177 / TreeView.vue:150-152），防止 flex 溢出

### 2.4 状态覆盖 — PASS
- loading：父级 skeleton（EntryDetailContent.vue:15-23，未改动）
- error：parse-error banner `role="alert"` + CodeViewer 降级（EntryDetailContent.vue:34,150；符合 BDD-50）
- empty：两组件均 `无数据`（TableView.vue:9-11 / TreeView.vue:21-23），空 CSV/`{}`/`[]`/null 不崩溃（jsonToTreeData 对 null/标量返回 []，useTreeData.ts:4-5）
- 截断态：CSV >50000 行 / 结构化 >2MB 均 banner + 下载按钮（TableView.vue:3-7,41-45 / TreeView.vue:3-7,69），且 2MB 时跳过 parse（TreeView.vue:88）——大文件不触发 js-yaml/DOMParser，性能与安全双达标

### 2.5 a11y 已覆盖项 — PASS
- 列头 `aria-sort` asc/desc（TableView.vue:21,167-171）
- 筛选输入 `aria-label`（TableView.vue:32）
- 展开按钮 `aria-expanded` + `aria-label`，触摸目标 `min-width/height: 44px`（DataTreeNode.vue:7-8,111-112）✓ DESIGN.md:261
- 切换按钮 `aria-label` 双向（EntryDetailHeader.vue:30 / EntryDetailMobileBar.vue:20）
- 搜索匹配数 `aria-live="polite"`（TreeView.vue:18）
- 类型标签文字即类型名（`string`/`number`...），非纯色传达（DataTreeNode.vue:25,163-167）✓ DESIGN.md:285

### 2.6 移动端 — PASS（含设计决策）
- 切换按钮在 MobileBar 可见（EntryDetailMobileBar.vue:16-23）
- 列级筛选框 ≤640px 隐藏（TableView.vue:285-287，P2 §3.8 设计决策）
- per-page select 移动端独占一行 `width: 100%` 置于 Pagination 上方（TableView.vue:275-283, 57-69）
- 表格横向滚动 + sticky 列头（TableView.vue:191-193）

### 2.7 文件切换重置 — PASS
- `watch(() => entryDetailStore.activeFile?.id)` 重置 sourceViewMode=false（EntryDetailView.vue:176-178）
- `watch(() => props.activeFile?.id)` 重置 parseError（EntryDetailContent.vue:162-164）
- v-if 调度链随文件切换重建组件实例，sorting/filtering/expandedPaths 自然重置（P4 实现 §3.4）

### 2.8 安全 — PASS
- js-yaml `load()` v4 默认 DEFAULT_SAFE_SCHEMA（useTreeData.ts:1,13），`!!python/object` 被拒（BDD-32）
- DOMParser + parsererror 检测（useTreeData.ts:17-24），无外部实体解析

## 3. 问题清单

### A. [INTERACTION][BLOCKER] 树节点值复制无键盘可达性
- 文件：`frontend-v3/src/components/DataTreeNode.vue:15-23`（`<span class="tree-node-label" ... @click="copyValue">`）、`:78-87`（copyValue）
- 问题：复制是叶子节点核心交互（BDD-35），但挂在 `<span>` 上——无 `tabindex`/`role`/键盘事件，键盘与读屏用户完全无法触达。违反 DESIGN.md:283"Use semantic HTML: `<button>` for actions"与 DESIGN.md:282"所有交互元素必须有可见焦点指示"
- Fix：改为 `<button type="button" class="tree-node-label">`（保留样式，补 `:focus-visible` 焦点环），或 `role="button" tabindex="0" @keydown.enter.prevent @keydown.space.prevent="copyValue"`

### B. [INTERACTION][BLOCKER] 列头排序无键盘可达性
- 文件：`frontend-v3/src/components/TableView.vue:18-23`（`<th ... @click="header.column.toggleSorting()">`）
- 问题：排序是 P1 核心功能（BDD-17/18 升/降/原序三态），但 `<th>` 默认不可聚焦、无 role、无键盘处理器——纯鼠标功能。同违反 DESIGN.md:283
- Fix：th 内嵌可聚焦排序控件（如 `th-content` 加 `<button>` 或 th 加 `tabindex="0" role="button" @keydown.enter.self/@keydown.space.self`），并补 `:focus-visible`；注意 tab 顺序与内部筛选 input 的焦点流不冲突

### C. [VISUAL][BLOCKER] 类型标签字级与浅色主题对比度不达标
- 文件：`frontend-v3/src/components/DataTreeNode.vue:162-168`（`.type-tag` 及 6 个 `.type-*`）
- 问题：① 字级 `font-size: 10px` 不在 DESIGN.md 字阶（最小 12px `--font-xs`，DESIGN.md §3）；② 浅色主题 10px 文本对比度实测不达 WCAG AA 4.5:1：
  - `type-string`：`#1a7f37` on rgba(26,127,55,.1)/#f6f8fa 混色 ≈ **4.18:1**
  - `type-number`：`#0969da` on rgba(9,105,218,.1) 混色 ≈ **4.25:1**
  - `type-boolean`：`#9a6700` on rgba(154,103,0,.1) 混色 ≈ **4.03:1**
  - `type-null`：`#8c959f` on `#eef0f3` ≈ **2.66:1**（token 级弱点；深色主题 null 亦仅 ~4.0:1）
  - 深色主题其余标签通过（string 9.4:1 / number 5.2:1 / boolean 8.8:1 / object-array 6.8:1）
- Fix：字级改 `var(--font-xs)`（12px，双收益：入字阶 + 读屏可辨）；浅色主题文案色组件内加深（如 `#116329`/`#0550ae`/`#825a00` 档位）或按 DESIGN.md 增补 `--tag-*` 深浅双主题变量；null 标签可接受降级但建议 ≥3:1

### D. [INTERACTION][MINOR] parseError 期间切换按钮失效（视觉惰性）
- 文件：`frontend-v3/src/components/EntryDetailContent.vue:150`（`showSourceView = sourceViewMode || parseError !== null`）、`:41-43`
- 问题：CSV/JSON 解析失败 → parseError 置位 → showSourceView 恒 true → 头部/底部切换按钮仍显示（isRichRenderable 只看格式不看 parseError），但点击只翻转 sourceViewMode、视图不变——按钮"存在但无效果"
- Fix：手动切换时清空 parseError（`toggle-source-view` 处理器里 `parseError.value = null`），或 parseError 时隐藏切换按钮

### E. [INTERACTION][MINOR] 可排序列头无 hover 反馈
- 文件：`frontend-v3/src/components/TableView.vue:191-202`
- 问题：th 有 `cursor: pointer; user-select: none`（:200-201）但无 hover 视觉，用户无法预判可点击
- Fix：`.table-scroll thead th:hover { background: var(--bg-tertiary); }`（与行 hover 一致，TableView.vue:246-248）

### F. [VISUAL][MINOR] type-tag 硬编码非 token 值
- 文件：`frontend-v3/src/components/DataTreeNode.vue:163-166`（`font-size: 10px; padding: 1px 6px; border-radius: 4px`）
- 问题：`10px`（字阶外）、`4px`（radius token 为 3/6/8，DESIGN.md:22-23）均为硬编码；`6px` padding 非 4px 基数（DESIGN.md:327 例外仅限 1px 边框）
- Fix：`font-size: var(--font-xs)`；`border-radius: var(--radius-sm)`；padding 走 `var(--space-1) var(--space-2)` 档（若视觉需要窄款，向 design 确认新增 token，不硬编码）

### G. [a11y][MINOR] 搜索匹配数不播报 0 匹配
- 文件：`frontend-v3/src/components/TreeView.vue:18,142-146`
- 问题：`matchCountText` 为 0 时返回 `''`，`aria-live` 静默——用户输入无结果词时读屏无反馈
- Fix：n===0 时输出 "No matches"（或 `0 matches`），配合 `aria-live="polite"` 播报

### H. [a11y][MINOR] TruncationBanner 无角色/播报
- 文件：`frontend-v3/src/components/TruncationBanner.vue:2-9`
- 问题：数据被截断是重要状态（用户需知悉数据不完整），但 banner 无 `role`，读屏不可感知
- Fix：加 `role="status"`（或 `aria-live="polite"`）

### I. [INTERACTION][MINOR] 视图切换按钮语义属性
- 文件：`frontend-v3/src/components/EntryDetailHeader.vue:30`、`EntryDetailMobileBar.vue:20`
- 问题：源码/渲染是**视图模式开关**，语义应为 `aria-pressed`（toggle button），非 `aria-expanded`（disclosure 展开）。P2 §3.11 设计如此，但 WAI-ARIA 语义可改进
- Fix：`:aria-pressed="sourceViewMode"`（保留 aria-label 双向文案）

### J. [INTERACTION][MINOR] 移动端底部栏按钮触摸目标 < 44px（新代码继承既有模式）
- 文件：`frontend-v3/src/components/EntryDetailMobileBar.vue:89-99`
- 问题：toggle-btn padding 4px + 16px 图标 ≈ 24px 命中区 < DESIGN.md:261 的 44px。与既有的 Folder/TOC 按钮（同组件 :3-15）完全一致——**非本次回归**，属应用级既有模式；新切换按钮沿用保持一致
- Fix（可选）：底部栏按钮统一 `min-width/height: 44px`；若动，覆盖 3 个按钮而非仅新按钮

### K. [a11y][MINOR] iOS 聚焦缩放风险
- 文件：`frontend-v3/src/components/TreeView.vue:161-170`（search input `--font-sm` 14px）
- 问题：iOS Safari 对 <16px 文本输入聚焦自动放大（TreeView 搜索框 14px）。筛选框隐藏于移动端（TableView.vue:285-287）不受影响
- Fix：移动端 media query 内 `font-size: var(--font-md)`（或确认应用既有搜索输入同尺寸则接受为既有模式）

### L. [ARCH][MINOR] TreeExpandKey 跨 SFC 循环引用
- 文件：`frontend-v3/src/components/TreeView.vue:38-47`（export symbol）← `frontend-v3/src/components/DataTreeNode.vue:45`（import）
- 问题：TreeView 组件脚本块与 DataTreeNode 形成循环依赖（Vite/ESM 处理 symbol 可工作，但属脆弱架构）
- Fix：symbol 移到独立模块（如 `src/composables/treeExpandKey.ts`），两组件各自 import（P7 一致性检查可一并处理）

### M. [COPY][MINOR] 空容器文案准确性
- 文件：`frontend-v3/src/components/TreeView.vue:21-23`
- 问题：`{}`/`[]`/YAML 标量根（`load('42')` → `[]`）显示"无数据"，语义上内容非空、结构为空——可辩护但文案易误读
- Fix（可选）：区分"Empty object/array"与真正无数据；标量根渲染为单叶子节点

### N. [VISUAL][MINOR] 复制 toast 信息过长
- 文件：`frontend-v3/src/components/DataTreeNode.vue:82`（`Copied: ${props.node.value}`）
- 问题：长字符串值会让 toast 撑满屏宽（Toast 顶部居中）
- Fix：展示截断值（如前 80 字符 + `…`），完整值走 clipboard

## 4. 与 P2 设计一致性核对

| P2 设计点 | 实现 | 结论 |
|-----------|------|------|
| §3.4 sourceViewMode 状态在 View + watch(activeFile) 重置 | EntryDetailView.vue:174-178 | ✅ |
| §3.3 调度链 isHtml→Markdown→CSV/TSV→JSON/YAML/XML→Image→CodeViewer | EntryDetailContent.vue:35-46 | ✅ |
| §3.3 showSourceView = sourceViewMode‖parseError + ParseErrorBanner | EntryDetailContent.vue:34,150 | ✅（联动缺陷见 §3-D） |
| §3.5 TOC 仅 `isMarkdown && !sourceViewMode` | EntryDetailContent.vue:55 | ✅ |
| §3.6 CSV 状态机（引号/换行/转义/BOM/截断/未闭合抛错） | useCsvParser.ts:16-66 | ✅ |
| §3.8 perPage 50/100/500、默认 100、切换回第 1 页、移动端 select 独占一行 | TableView.vue:129-130,162-165,275-283 | ✅ |
| §3.8 移动端隐藏列筛选 | TableView.vue:285-287 | ✅ |
| §3.9 搜索 aria-live 计数、2MB 截断 | TreeView.vue:10-19,67-69 | ✅（0 匹配静默见 §3-G） |
| §3.10 类型标签 token 映射（string→success 等） | DataTreeNode.vue:170-194 | ✅（token 映射正确，对比度问题见 §3-C） |
| §3.11 切换按钮 toggle-btn + Code/Eye + tooltip、仅 isRichRenderable 显示 | EntryDetailHeader.vue:30-34 / EntryDetailMobileBar.vue:16-23 | ✅ |
| §3.12 依赖 @tanstack/vue-table + js-yaml（+@types/js-yaml 编译必需） | package.json（P4 实现 §2） | ✅ |

## 5. 结论

**status: needs-revision**

3 项 BLOCKER（§3-A 键盘复制、§3-B 键盘排序、§3-C 类型标签对比度）需 implementer 定向修复后重派复验；11 项 MINOR（§3-D~N）建议一并处理但不阻断。

非空泛证据：全部结论已引用具体文件:行号，对比度数据为逐色值 WCAG 2.1 计算（§3-C）。

修复后建议回归项：`npx vue-tsc --noEmit`、`npm run build`、`make test-frontend`（TableView/TreeView spec 涉及排序/复制交互，改 a11y 结构时注意 spec 选择器兼容——如 sort 从 th 移到子 button，`click th` 的断言需同步）。

## 6. 复验轮（2026-08-01）— status: approved

> 复验方式：逐项对照 §3 A~N 核对修复后代码 + 对比度逐色值复算 + 自跑相关测试。

### 6.1 BLOCKER 复验（A/B/C 全部修复）

| 项 | 修复证据 | 复验结论 |
|----|----------|----------|
| **A** 复制按钮化 | DataTreeNode.vue:15-25 改为 `<button type="button" class="tree-node-label">`；:152-155 `.tree-node-label:focus-visible` 焦点环（outline 2px accent-hover + offset 2px）；非 leaf 保持 span（:26，不复制故无需按钮，正确） | ✅ |
| **B** 排序按钮化 | TableView.vue:23-32 th 内嵌 `<button type="button" class="th-sort-btn" @click="toggleSorting()">`；:224-227 `:focus-visible` 焦点环；th 上 `aria-sort` 保留（:21）；tab 顺序 button→filter input 不冲突 | ✅ |
| **C** type-tag 字级+对比度 | DataTreeNode.vue:174 `font-size: var(--font-xs)`（12px 入字阶）；:181-204 文案色全部走 `--tag-*` token；variables.css:91-94（深色）/155-158（浅色）双主题。浅色复算：string `#116329`≈6.11:1、number `#0550ae`≈6.23:1、boolean `#825a00`≈5.12:1、null `#57606a` on `#eef0f3`≈5.59:1，**全部 ≥4.5:1 AA**；深色 token 值未变（维持上轮 PASS 的 9.4/5.2/8.8/6.8:1） | ✅ |

### 6.2 MINOR 复验（D~N 全部修复）

| 项 | 修复证据 | 复验结论 |
|----|----------|----------|
| **D** parseError 清除 | EntryDetailView.vue:28,94 `@toggle-source-view="sourceViewMode = !sourceViewMode"` + EntryDetailContent.vue:166-168 `watch(() => props.sourceViewMode, ...)` 清 `parseError`。切换按钮不再"存在但无效果" | ✅ |
| **E** th hover | TableView.vue:206-208 `.table-scroll thead th:hover { background: var(--bg-tertiary); }`（与行 hover 一致） | ✅ |
| **F** type-tag token 化 | DataTreeNode.vue:174-176 `--font-xs` / `--radius-sm` / `var(--space-1) var(--space-2)`（4px 基数） | ✅ |
| **G** 0 匹配播报 | TreeView.vue:160-166 `if (n === 0) return 'No matches'`（:18 aria-live="polite" 保留） | ✅ |
| **H** banner role | TruncationBanner.vue:2 `role="status"` | ✅ |
| **I** aria-pressed | EntryDetailHeader.vue:30、EntryDetailMobileBar.vue:21 `:aria-pressed="sourceViewMode"`（aria-label 双向文案保留） | ✅ |
| **J** 44px 触摸目标 | EntryDetailMobileBar.vue:101-102 `.toggle-btn { min-width: 44px; min-height: 44px; }`——覆盖全部 3 个 toggle-btn（Folder/TOC/Source 共用类），符合上轮"若动则全覆盖"建议 | ✅ |
| **K** iOS 16px | TreeView.vue:216-220 `@media (max-width: 640px) { .tree-search-input { font-size: var(--font-md); } }` | ✅ |
| **L** treeExpandKey 独立 | 新模块 treeExpandKey.ts:1-8（`export const TreeExpandKey: unique symbol` + `TreeExpandContext` 接口）；TreeView.vue:44 import + :77 provide；DataTreeNode.vue:50 import + :58 inject。跨 SFC 循环依赖解除 | ✅ |
| **M** 空文案 | TreeView.vue:92-98 标量根渲染为单叶子节点（scalarLeaf :110-113）；:115-120 `emptyMessageFor` 区分 'Empty array'/'Empty object' | ✅ |
| **N** toast 截断 | DataTreeNode.vue:82-83 前 80 字符 + `…`，完整值走 clipboard | ✅ |

### 6.3 测试选择器同步 + 自跑验证

- **BLOCKER B 连带项**：TableView.spec.ts:95-109 `test_bdd_17_sort_cycle_asc_desc_original` 已同步为 `header.find('.th-sort-btn')` + `sortBtn.trigger('click')` ✓
- **BLOCKER A 兼容性**：TreeView.spec.ts:64,73,162 仍用 `.tree-node-label`（class 未变，现挂在 button 上，选择器兼容）✓
- 自跑：`npx vitest run TreeView.spec.ts` **13/13 通过**（含 BDD-31 复制、BDD-36 空输入）；`npx vitest run TableView.spec.ts` **13/13 通过**（含 BDD-17 排序按钮化、BDD-49 parse-error emit；BDD-22 耗时 180s 为构造 50000 行固有耗时，非回归）
- 自跑：`npx vue-tsc --noEmit` **exit 0**（MINOR L 重构后类型闭合）
- 环境隔离：`[PROD_NOT_TOUCHED]`（评审全程只读代码文件 + vitest 单测 jsdom 隔离，未触碰生产/调试环境）

### 6.4 复验结论

§3 全部 14 项（3 BLOCKER + 11 MINOR）修复到位，无遗留项。测试选择器同步无回归，typecheck 通过。

**status: approved**
