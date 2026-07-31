---
phase: P2
task_id: T075-structured-data-viewer
type: review
parent: P2-design.md
trace_id: T075-P2-review-20260801
status: approved
created: 2026-08-01
agent: plan-design-review
---

## 复审总结

对 architect 修订后的 P2-design.md 进行复审。上一轮 review 提出 1 medium + 10 low 共 11 项缺口，architect 已全部修订。逐项验证修订到位，无新增问题，无回归。status: approved。

## 上一轮缺口修订验证

### #1 JSON 解析失败的错误提示 UI（medium）— ✅ 已修复

**上轮问题**：`parse-error` emit 只传空数组 `[]`，错误信息丢失；BDD-50 要求"显示解析错误提示信息"无法满足。

**修订内容**：
- §3.3 emit 签名改为 `emit('parse-error', errMsg)`，携带错误消息字符串
- §3.3 新增 `parseError: Ref<string | null>` 状态，渲染器 emit 时设置
- §3.3 新增 `showSourceView` computed（`sourceViewMode || parseError !== null`），统一判断降级
- §3.3 新增 `ParseErrorBanner` 设计：`role="alert"` + AlertCircleIcon + 错误消息文本，复用 `--error-surface` / `--error-color` 语义变量
- §3.3 明确引用 BDD-50："banner 满足此要求"
- §3.8 TableView emit 定义更新为 `'parse-error': (errMsg: string) => void`
- §3.9 TreeView emit 定义更新为 `'parse-error': (errMsg: string) => void`

**判定**：错误消息从渲染器到 EntryDetailContent 的传递链完整闭合，ParseErrorBanner 提供了用户可见的错误信息 + 源码入口（showSourceView 自动切到 CodeViewer）。BDD-50 验收条件可满足。

### #2 大文件解析阻塞声明（low）— ✅ 已修复

**上轮问题**：2MB 以下深嵌套 JSON parse 可能阻塞主线程，未声明设计假设。

**修订内容**：§3.7 新增"解析阻塞声明"段落——"解析在主线程同步执行。设计假设：<2MB 的 JSON/YAML/XML 和 <50000 行的 CSV/TSV，parse 耗时 <100ms，无需 loading 态。若 P6 验收发现实际有可感知卡顿，再评估 `requestIdleCallback` / `setTimeout(0)` 让出主线程的优化方案（当前不预实现，YAGNI）。"

**判定**：设计假设明确，优化路径预留，YAGNI 决策合理。

### #3 排序/筛选 reset 时机声明（low）— ✅ 已修复

**上轮问题**：TableView/TreeView 文件切换时内部状态重置行为未显式声明。

**修订内容**：§3.8 新增"文件切换时状态重置"段落——"TableView/TreeView 在文件切换时（activeFile 变化）因 v-if 调度链重建被销毁，Vue 默认重建组件实例，内部 sorting/filtering/page/perPage/expandedPaths 状态自然重置。无需手动 reset 逻辑。"

**判定**：v-if 重建导致状态重置是 Vue 的正确行为，声明准确。

### #4 类型标签 CSS 变量映射未锚定（low）— ✅ 已修复

**上轮问题**：类型标签颜色未指定具体 CSS 变量，实现者可能选择语义不符的变量。

**修订内容**：§3.10 新增完整映射表：

| NodeType | CSS 变量 | 语义来源 |
|----------|----------|----------|
| string | `--success-color` (`--c-success`) | 绿色，复用成功语义 |
| number | `--accent-color` (`--c-accent`) | 蓝色，复用强调语义 |
| boolean | `--warning-color` (`--c-warning`) | 橙色，复用警告语义 |
| null | `--text-tertiary` (`--c-text-tertiary`) | 灰色，复用弱化文本语义 |
| object / array | `--accent-hover` (`--c-accent-secondary`) | 紫蓝，复用强调悬停语义 |

并声明背景使用对应 `*-bg` 变量，标签文字本身即类型名，满足 DESIGN.md:285 "Color alone must not convey meaning"。

**判定**：映射表精确到变量名 + 别名，实现者无取色空间。语义复用合理（string→success 绿、number→accent 蓝、boolean→warning 橙等），与 DESIGN.md 语义变量系统一致。

### #5 移动端筛选框布局（low）— ✅ 已修复

**上轮问题**：窄屏移动端每列一个筛选 input 导致拥挤。

**修订内容**：§3.8 "移动端适配"段落新增——"列级筛选框：移动端（≤640px）用 CSS `display: none` 隐藏，避免 N 列 × N 个 input 拥挤；移动端用户依赖横向滚动浏览"。

**判定**：方案合理，与移动端使用场景匹配（横向滚动浏览优先于列级筛选）。

### #6 perPage select 移动端位置（low）— ✅ 已修复

**上轮问题**：perPage select 在移动端与 Pagination 控件可能溢出。

**修订内容**：§3.8 "移动端适配"段落新增——"perPage select：移动端置于 Pagination 组件上方，独占一行（`width: 100%`），不与页码导航挤在同一行"。

**判定**：布局明确，与 Pagination.vue:235-251 现有 `@media (max-width: 640px)` 移动端适配模式一致。

### #7 TableView aria-sort（low）— ✅ 已修复

**上轮问题**：列头排序缺少 `aria-sort`，屏幕阅读器无法感知排序状态。

**修订内容**：§3.8 thead 描述更新为"列头（可排序点击，`aria-sort` 绑定排序状态）"。

**判定**：aria-sort 声明到位，三态排序（ascending/descending/none）可绑定。

### #8 TreeView aria-expanded（low）— ✅ 已修复

**上轮问题**：DataTreeNode 展开/折叠缺少 `aria-expanded`。

**修订内容**：§3.10 更新为"展开/折叠（点击箭头图标，触摸目标 ≥44px，`aria-expanded` 绑定展开状态）"。

**判定**：与 §3.11 切换按钮的 aria-expanded 模式一致。

### #9 搜索高亮 SR 可访问性（low）— ✅ 已修复

**上轮问题**：搜索高亮是视觉的，屏幕阅读器用户无法感知匹配。

**修订内容**：
- §3.9 新增"搜索高亮可访问性声明"——"搜索高亮为视觉增强（背景色/文字色变化），屏幕阅读器用户通过搜索框旁的 `aria-live="polite"` 区域获知匹配数量（如 '3 matches'），不依赖高亮感知匹配位置"
- §3.9 搜索框描述新增 `aria-label="Search tree nodes"` 和 `aria-live="polite"` 区域播报匹配数量

**判定**：视觉增强 + aria-live 播报的双通道方案满足 a11y 要求。

### #10 筛选 input aria-label（low）— ✅ 已修复

**上轮问题**：TableView 筛选 input 缺少 `aria-label`。

**修订内容**：§3.8 thead 描述更新为"筛选输入框（`aria-label='Filter {column name}'`）"。

**判定**：满足 DESIGN.md:284 "Form inputs must have associated `<label>` or `aria-label`"。

### #11 复制反馈 a11y（low）— ✅ 已修复

**上轮问题**：复制成功/失败对屏幕阅读器用户不可见。

**修订内容**：§3.10 更新为"复制成功/失败通过 useToast composable 反馈（toast.success / toast.error）；Toast.vue 已有 `aria-live='polite'` + `role='alert'`，屏幕阅读器用户可感知复制结果"。

**判定**：复用现有 useToast + Toast.vue 的 a11y 机制，方案完整。

## 评分维度（复审）

### 1. 交互状态覆盖率 — 9/10（上轮 7→9）

所有交互状态已覆盖：
- Loading：继承现有 fileLoading skeleton ✅
- Error — 解析失败：ParseErrorBanner + 错误消息 + 源码降级 ✅
- Empty：空 CSV / 空 JSON / {} / [] / null 声明 ✅
- Edge case — 截断：CSV >50000 行 / JSON >2MB + TruncationBanner + 下载 ✅
- Edge case — CSV 边界：BOM / 引号内逗号 / 换行 / 转义 ✅
- Edge case — YAML 安全：js-yaml v4 load() 默认安全 ✅
- 解析阻塞声明：设计假设 + 优化路径预留 ✅
- 状态重置：v-if 重建自然重置声明 ✅

### 2. AI Slop 风险 — 9/10（上轮 8→9）

- UI 范式严格复用 toggle-btn/icon-btn ✅
- 类型标签 CSS 变量完整映射表，无取色空间 ✅
- 滚动架构遵循 DESIGN.md ✅
- 组件拆分清晰，7 个新增文件职责单一 ✅
- 无装饰性元素 ✅

### 3. 移动端考虑 — 9/10（上轮 8→9）

- 切换按钮移动端可见 ✅
- TableView 横向滚动 ✅
- 触摸目标 ≥44px ✅
- 移动端筛选框 CSS 隐藏声明 ✅
- perPage select 移动端独占一行声明 ✅

### 4. 可访问性 — 9/10（上轮 6→9）

- 切换按钮 aria-label + aria-expanded ✅
- TableView aria-sort ✅
- TreeView aria-expanded ✅
- 筛选 input aria-label ✅
- 搜索高亮 aria-live 播报 ✅
- 复制反馈 useToast + aria-live ✅
- 语义 HTML（thead/tbody/递归结构）✅
- ParseErrorBanner role="alert" ✅

## 结论

**Status: approved**

上一轮 11 项缺口（1 medium + 10 low）全部修订到位。修订质量高——每项都给出了具体的设计内容（变量映射表、aria 属性声明、移动端布局方案、错误消息传递链），而非空泛的"已补充"承诺。无新增问题，无回归。设计文档已具备进入 P4 实现的充分细节。
