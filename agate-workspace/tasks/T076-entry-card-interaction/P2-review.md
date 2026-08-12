---
phase: P2
task_id: T076-entry-card-interaction
type: review
parent: P2-design.md
trace_id: T076-P2-review-20260730
status: approved
created: 2026-07-30
agent: plan-design-review
---

## 评审结论

**status: approved**（含 7 条 NOTE，均为建议级，无 BLOCKER）

方案 A（BaseTag 多态 href + 原生 `<a>` + CSS tooltip）从前端设计/UX 视角满足设计系统、交互语义、可访问性、移动端要求。原生 `<a>` 是满足 BDD-04/05（右键复制链接）与 BDD-20（键盘聚焦）的正确选择，方案 B 的 `<span>`+emit 无法原生支持这些浏览器行为，选择理由（P2-design §1「选择理由」）成立。候选方案 ≥2、四字段齐全、gate_commands.P5_e2e 已声明、files_to_read 合理、env_constraints 正确。

复核重点（CSS tooltip 移动端 touch 可行性，P0 已知风险）：**通过，但需 P4/P6 落实 NOTE-1**。`tabindex="0"` + tap → `:focus` 在 Android Chrome / 桌面成立；iOS Safari 对非表单元素（`<span tabindex="0">`）的 tap-to-focus 不可靠。方案已记录降级路径（`@click toggle class`，纯 CSS 不影响架构），故非 BLOCKER；但建议直接采用更稳健的变体（见 NOTE-1）。

## 评分（角色维度，0-10）

| 维度 | 分数 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 8 | hover/focus/右键/SPA 导航全覆盖；tag 过滤空状态依赖现有列表渲染（NOTE-6），loading/error 复用现状未单独说明 |
| AI Slop 风险 | 9 | 目标 HTML 结构（P0-brief §A）+ CSS 片段 + 「实现完成的标志」10 条，留给实现的模糊空间小 |
| 移动端考虑 | 7 | tag 跳转原生 `<a>` 可靠；tooltip touch 主路径在 iOS 存疑（NOTE-1），P6 CDP 无法验证 iOS（NOTE-2） |
| 可访问性 | 8 | 原生 `<a>` 语义 + 全局 focus-visible ring 符合 DESIGN §10；tag-overflow 缺 aria-label（NOTE-3） |

## 六维度核查（dispatch_guide 强制维度）

### 1. DESIGN.md 设计系统遵循 — PASS

- 颜色全走 `--c-*` token：tooltip 用 `--c-surface`/`--c-border-strong`，focus 用 `--c-accent-secondary`（P2-design §「tag-overflow tooltip」/§「focus 样式」）。已核 variables.css 全部存在（`--radius-md:6px`、`--shadow-md`、`--transition-fast:150ms`、`--c-tag-bg`、`--font-xs:12px`）。符合 DESIGN §11 Do「Use --c-* token variables for every color」。
- spacing 在 4px 网格：tooltip padding `--space-2 var(--space-3)` = 8px/12px（DESIGN §4）。
- radius `--radius-md`=6px，在 DESIGN §13「6–14px」范围；BaseTag focus `border-radius:6px`。
- typography `--font-xs`=12px mono，与 DESIGN §6 Tag/Badge「12px mono」一致。
- focus ring `outline:2px solid var(--c-accent-secondary); outline-offset:2px` 与 DESIGN §6 Button Focus 完全一致。
- 未引入 UI 框架（CSS-only tooltip + 原生 `<a>`），符合 DESIGN「No Tailwind」+ scoped CSS 约定。
- tag 样式（bg `--c-tag-bg`/text `--c-accent-secondary`/radius 6px/padding 4px 10px）与 DESIGN §6 Tag/Badge 及现状 BaseTag.vue 一致。

### 2. 交互语义正确性 — PASS（含 NOTE-4）

- card-title/username/tag 各自独立 `<a>`（P2-design §「EntryCard 结构」），覆盖 BDD-01/03/04/05/07。
- 右键复制链接指向正确：title href=`/{slug}`、username href=`/users/{username}`、tag href=`/explore?tags={tag}`，真实 href 保留供右键（BDD-04/05）。这是方案 A 相对 B 的核心优势，正确。
- SPA 导航：`@click.prevent` + `router.push` 保留真实 href（BDD-02/16），并保留 firstFileId query 逻辑（P2-design §「navigate emit 清理」）。
- hover 下划线只对可点击元素：BaseTag 显式 `text-decoration:none` + `:hover underline`（P2-design §「BaseTag 改造」），meta-username 现状已有（EntryCard.vue:203-205）。**但 card-title 从 `<h3>` 变 `<a>` 后，浏览器默认对 `<a>` 永久下划线，需显式 `text-decoration:none` + `:hover underline` 才满足 BDD-01「仅 hover 下划线」——方案未对 card-title 明确写出此 CSS（见 NOTE-4）**。「实现完成的标志」#5 与 BDD-01 已锁定意图，故为 NOTE 非 BLOCKER。
- BDD-06（非链接区无下划线/默认箭头）：meta-time 现状 `cursor:default`（EntryCard.vue:213），card-body 移除 `cursor:pointer`（P2-design §「EntryCard 结构」末），符合。

### 3. 键盘可访问性 — PASS（含 NOTE-3）

- 原生 `<a>` 天然 tab 聚焦，title/username/tag 依次获焦（BDD-20）。
- 全局 `:focus-visible` ring（P2-design §「focus 样式」）符合 DESIGN §10「All interactive elements must have visible focus indicators」；BaseTag `<a>` 额外 `:focus-visible` outline + border-radius 6px。
- tag-overflow `tabindex="0"` 可聚焦 + `:focus` 显示 tooltip + `:focus-visible` outline（P2-design §「tag-overflow tooltip」）。
- NOTE-3：tag-overflow 的全部 tags 仅在 `::after content` 中，建议补 `aria-label`（完整 tag 列表）以保障屏幕阅读器；若按 NOTE-1 改为 `<button aria-expanded>` 则语义更佳。

### 4. 移动端（重点复核 CSS tooltip touch 可行性）— PASS（含 NOTE-1/2/5）

- tag 点击跳转：原生 `<a>` 在 touch 可靠（BDD-07/10/17）。
- **CSS tooltip touch（P0 已知风险，重点复核结论）**：方案主路径 `tabindex="0"` + tap → `:focus` → `::after opacity:1`：
  - Android Chrome / 桌面：tap 触发 `:focus` 成立 ✓。
  - **iOS Safari：对 `<span tabindex="0">` 的 tap-to-focus 不可靠**（iOS 通常只对 `<a>`/`<button>`/`<input>` 等 tap 聚焦）。这是真实风险点。
  - 方案已记录降级（P2-design §minimal_validation note：`@click toggle class`，纯 CSS 不影响架构），且 BDD-10 允许「tooltip 或展开形式」，故判定 **非 BLOCKER**。
  - **建议（NOTE-1）**：P4 直接采用稳健变体——tag-overflow 用 `<button type="button" aria-expanded>` + `@click` toggle class 显示 tooltip（button 在 iOS tap 可靠聚焦/激活，且语义正确），从源头规避而非事后降级。
  - **验证局限（NOTE-2）**：P6 用 CDP Chrome（桌面 Chromium touch 模拟，行为≈Android），**无法验证 iOS Safari**。P6 touch 通过仅证明 Chromium 行为，建议在 P6 记录此局限；若采纳 NOTE-1 的 button 方案则 iOS 风险基本消除。
  - NOTE-5：tag 触摸目标 < 44px（DESIGN §9「Touch targets: minimum 44px」），但这是现状 BaseTag 尺寸（DESIGN §6 Tag/Badge padding 4px 10px），非本任务回归，记录备查。

### 5. EntryCard 与 EntryListRow 一致性 — PASS（含 NOTE-7）

- 两组件同构改造：`<a>`→`<div>`、title→`<a>`、username→`<a>`、BaseTag 传 href、tag-overflow tooltip（P2-design §「EntryListRow 结构」），覆盖 BDD-16/17/18/19。
- EntryListRow 新增 `TAG_LIMIT=3`（现状显示全部，EntryListRow.vue:94-96），对齐 EntryCard 并解决 P1 隐含需求#2（行高一致）。
- 行 hover 背景保留在 `.entry-list-row:hover`（不依赖 `<a>`，EntryListRow.vue:115-117），满足 BDD-19/21。
- NOTE-7：行改 `<div>` 后现状 `.entry-list-row:focus-visible`（EntryListRow.vue:119-122）成为死 CSS（div 不可聚焦），P4 应清理；EntryListView 的 `@navigate` 有 **两处**绑定（:146 grid / :158 list），移除时需两处都删（方案「改什么」表已含「移除 @navigate 监听」，提示落实）。navigateToEntry 迁入两组件存在重复，但与现状 navigateToUser 已在两组件重复（EntryCard.vue:82-86 / EntryListRow.vue:88-92）的约定一致，可接受。

### 6. tag 过滤 UI 指示 — PASS（含 NOTE-6）

- FilterChips 可移除：复用 FilterChip.vue（已核存在，`label` prop + `@dismiss` emit + dismiss 按钮 `aria-label="Remove filter"`），满足 BDD-12，且与现状 owner 过滤 chip（EntryListView.vue:55）模式一致。
- 数据链路：`currentTags` ref + restoreFromURL 读 tags + loadEntries 传 tags + removeTag→updateURL→reload + onBeforeRouteUpdate 同步（P2-design §「EntryListView tag 过滤」），覆盖 BDD-11/13/14/15 及 P1 隐含需求#3/#4（URL 同步 + 与 q/owner/status/page 组合）。
- URL 编码：tag href 用 `encodeURIComponent(tag)`（P2-design §「EntryCard 结构」），覆盖 P1 边界（空格/中文）。
- parseRestoreQuery 扩展返回 `tags:string[]`（P2-design §「EntryListView tag 过滤」#6），与现状 searchUrl.logic.ts:38 模式一致。
- NOTE-6：tag 过滤零结果的空状态依赖现有列表渲染路径（DESIGN §12 Explore「Empty state when no results」），方案未单独说明；因复用同一 loadEntries，现有空状态应自动适用，P6 顺带确认即可。

## NOTE 汇总（建议级，不阻断推进）

| # | 维度 | 内容 | 落实阶段 |
|---|------|------|----------|
| 1 | 移动端 | tag-overflow 建议直接用 `<button aria-expanded>` + `@click` toggle，规避 iOS Safari 对 `span[tabindex=0]` tap-to-focus 不可靠 | P4 |
| 2 | 移动端 | P6 CDP Chrome 无法验证 iOS Safari；记录此局限（采纳 NOTE-1 后风险基本消除） | P6 |
| 3 | 可访问性 | tag-overflow 补 `aria-label`（完整 tag 列表）保障屏幕阅读器 | P4 |
| 4 | 交互语义 | card-title 变 `<a>` 后需显式 `text-decoration:none` + `:hover underline`（BDD-01），方案仅对 BaseTag 明确写出 | P4 |
| 5 | 移动端 | tag 触摸目标 <44px 系现状（DESIGN §6 Tag 规格），非回归，备查 | — |
| 6 | tag 过滤 | 确认现有空状态覆盖 tag 过滤零结果 | P6 |
| 7 | 一致性 | 清理死 CSS `.entry-list-row:focus-visible`；移除 EntryListView 两处 `@navigate`（:146/:158） | P4 |

## 产出规格符合性（P2 设计质量）

- 候选方案 ≥2（方案 A/B）+ 权衡 + 选择理由 ✓
- 四字段齐全：packages=[frontend-v3] / domains=[frontend] / ui_affected=true / gate_commands ✓
- gate_commands.P5_e2e 已声明（ui_affected:true）且用 Makefile target（`E2E_SPEC=... make debug-test`），符合 AGENTS.md「Makefile 是测试命令唯一真相源」✓
- files_to_read 8 项各带 why，范围合理不臃肿 ✓
- env_constraints（debug :8888 隔离 + isolation_check）正确 ✓
- minimal_validation 已记录假设/方法/结论/降级；结论 `not_needed` 略乐观（见 NOTE-1/2），但降级路径已写明，可接受 ✓

## 给主 Agent

- File: docs/tasks/T076-entry-card-interaction/P2-review.md
- Status: approved
- 无 BLOCKER；7 条 NOTE 建议 P4/P6 落实（NOTE-1/2 为移动端稳健性重点）
