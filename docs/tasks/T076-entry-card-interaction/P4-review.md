---
phase: P4
task_id: T076-entry-card-interaction
type: review
parent: P4-implementation.md
trace_id: T076-P4-review-20260730
status: approved
created: 2026-07-30
agent: design-review
---

## 评审结论

**status: approved**（无 BLOCKER；3 条 NOTE 均为建议级，不阻断推进）

从前端设计/UX 视角独立复核 T076 的 P4 实现代码（5 实现文件 + 6 旧测试适配），结论：实现忠实于 P2 方案 A，遵循 DESIGN.md 设计系统，交互语义/键盘可访问性/移动端/两组件一致性均满足，旧测试改动为结构适配而非删除断言。P2-review 的 7 条 NOTE 中，P4 阶段应落实的 NOTE-3/4/7 均已落实；NOTE-1 的核心目标（iOS tap-to-focus 可靠性）通过 `<button>` 元素达成。

## 评分（角色维度，0-10）

| 维度 | 分数 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 9 | hover/focus-visible/右键/SPA 导航全覆盖；title/username/tag/overflow 各有独立 focus ring |
| AI Slop 风险 | 9 | 无渐变/无泛化文案/层级清晰（title>meta>tags>footer）；数据列表卡片统一是功能视图的合理形态 |
| 移动端考虑 | 8 | tag 原生 `<a>` 可靠；overflow 改 `<button>` 解决 iOS tap-to-focus；row 移动端折叠 + action 常显 |
| 可访问性 | 9 | 原生 `<a>` 语义 + 全局 focus-visible ring + overflow aria-label，符合 DESIGN §10 |

## 七维度核查（dispatch_guide 强制维度）

### 1. 实现忠实于 P2 方案 A — PASS

逐项核对方案 A 的六个特征：

- **card-body `<div>`**：EntryCard.vue:21 `<div class="card-body">`；EntryListRow.vue:2 `<div class="entry-list-row">`（原 `<a>` 已拆）✓
- **card-title/username/tag 独立 `<a>`**：EntryCard.vue:22（title `<a :href="'/' + entry.slug">`）、:26-31（username `<a :href="'/users/' + entry.username">`）、:40-45（BaseTag 传 href）✓
- **BaseTag 多态 href**：BaseTag.vue:2 `<a v-if="href" ... @click.prevent="$emit('navigate', href)">`、:5 `<span v-else>`（向后兼容，无 href 保持 span）✓
- **CSS tooltip**：EntryCard.vue:272-294 `::after { content: attr(data-tags) }` + `:hover/:focus` 触发，零 JS ✓
- **FilterChip 复用**：EntryListView.vue:56-61 `<FilterChip v-for="tag in currentTags" :label="tag" @dismiss="removeTag(tag)" />`（复用现有组件，未改 FilterChip.vue）✓
- **searchUrl.logic tags 扩展**：searchUrl.logic.ts:36 `RestoredQuery.tags: string[]`、:45-46 逗号分隔解析 ✓

实现与 P2-design §「设计细节」逐字对应，无方案漂移。

### 2. DESIGN.md 设计系统遵循 — PASS

- **颜色全走 `--c-*` token**：tooltip 用 `--c-surface`/`--c-border-strong`（EntryCard.vue:278-279），focus 用 `--c-accent-secondary`（:206/237/297），tag 用 `--c-tag-bg`/`--c-accent-secondary`（BaseTag.vue:22-23）。已核 variables.css 全部存在（dark/light 双主题，variables.css:46/51/106/111）。符合 DESIGN §11 Do。
- **spacing 在 4px 网格**：tooltip padding `var(--space-2) var(--space-3)` = 8px/12px（variables.css:5-6）；BaseTag/overflow `padding: 4px 10px` 与 DESIGN §6 Tag/Badge 规格逐字一致（10px 为该组件规格的水平内边距，设计系统钦定例外）。
- **radius**：`--radius-md`=6px（variables.css:22），在 DESIGN §13「6–14px」范围。
- **typography**：`--font-xs`=12px mono（variables.css:13），与 DESIGN §6 Tag/Badge「12px mono」一致。
- **focus ring**：`outline: 2px solid var(--c-accent-secondary); outline-offset: 2px`（EntryCard.vue:206-207 等）与 DESIGN §6 Button Focus 完全一致。
- **无 UI 框架**：CSS-only tooltip + 原生 `<a>`/`<button>`，scoped style，符合 DESIGN「No Tailwind」。
- **无内联魔法值（新引入）**：meta-sep 的 `style="font-family: Inter..."`（EntryCard.vue:32）经 git diff 核实为**预存**（context 行，非本次新增），不计入本任务。

### 3. 交互语义 — PASS

- **hover 下划线只对可点击元素**：
  - card-title `text-decoration:none`（EntryCard.vue:198）+ `:hover underline`（:201-203）——NOTE-4 已落实，满足 BDD-01「仅 hover 下划线」
  - meta-username `text-decoration:none`（:229）+ `:hover underline`（:232-234）
  - BaseTag `a.base-tag text-decoration:none`（BaseTag.vue:31）+ `:hover underline`（:35-37），满足 BDD-08
- **右键复制链接指向正确 URL**（真实 href 保留）：
  - title href=`/{slug}`（EntryCard.vue:22）→ BDD-04
  - username href=`/users/{username}`（:29）→ BDD-05
  - tag href=`/explore?tags={tag}` + `encodeURIComponent`（:43）→ BDD-07，覆盖 P1 边界（空格/中文）
- **非链接区无交互**：meta-time `cursor:default`（:246-248）、meta-sep/card-footer 无 hover/cursor 样式 → BDD-06 ✓
- **SPA 导航保持**：`@click.prevent` + `router.push`，navigateToEntry 保留 firstFileId query 逻辑（:89-96）→ BDD-02/16，P1 隐含需求#1 ✓

### 4. 键盘可访问性 — PASS

- 原生 `<a>` 天然 tab 聚焦，title/username/tag 依次获焦 → BDD-20 ✓
- 所有新增交互元素均有 `:focus-visible` ring：card-title（EntryCard.vue:205-208）、meta-username（:236-239）、BaseTag `<a>`（BaseTag.vue:39-43，额外 border-radius 6px）、tag-overflow button（EntryCard.vue:296-299）；EntryListRow 同步（:161-164/195-198/247-250）。符合 DESIGN §10「All interactive elements must have visible focus indicators」✓
- tag-overflow `aria-label="All tags: ..."`（EntryCard.vue:52）→ NOTE-3 已落实，屏幕阅读器可获取完整 tag 列表 ✓

### 5. 移动端 — PASS（NOTE-1 核心目标达成）

- **tag 点击跳转**：原生 `<a>` 在 touch 可靠 → BDD-07/17 ✓
- **tag-overflow tooltip touch（P0 已知风险，重点复核）**：实现将 P2 的 `<span tabindex="0">` 改为 `<button type="button">`（EntryCard.vue:46-53）。**这正是 NOTE-1 的核心目标**——iOS Safari 对 `<button>` 的 tap-to-focus 可靠（button 是表单元素），CSS `:focus::after`（:291-294）随之触发 tooltip。Android Chrome/桌面同样成立。BDD-10 允许「tooltip 或展开形式」，满足。
  - 实现未采用 NOTE-1 建议的 `@click toggle class` + `aria-expanded` 字面机制，而是保留 CSS-only `:focus` 路径——这是更优的取舍：button 元素已解决 iOS 可靠性问题（实际风险点），无需引入 JS 状态；aria-label（NOTE-3）已覆盖屏幕阅读器语义，aria-expanded 对瞬态 tooltip 非必需（P2-review 原文「语义更佳」非强制）。判定 NOTE 级，非 BLOCKER。
- **row 移动端**：`@media (max-width: 640px)` 折叠为单列（EntryListRow.vue:300-311），entry-actions `opacity:1` 常显（:308-310），符合 DESIGN §9「Hover-only action buttons must be visible on touch devices」✓
- NOTE-5（tag 触摸目标 <44px）系现状 BaseTag 规格（DESIGN §6），非本任务回归，备查。

### 6. EntryCard 与 EntryListRow 一致性 — PASS

两组件同构改造，逐项对齐：

| 项 | EntryCard | EntryListRow |
|----|-----------|--------------|
| 根元素 `<div>` | :21 | :2 |
| title `<a>` + navigateToEntry | :22 / :89-96 | :7 / :97-104 |
| username `<a>` + navigateToUser | :26-31 / :98-102 | :12-17 / :106-110 |
| BaseTag href + navigateToTag | :40-45 / :104-106 | :27-32 / :112-114 |
| TAG_LIMIT=3 | :108 | :116 |
| tag-overflow button + tooltip | :46-53 / :258-299 | :33-40 / :209-250 |

- TAG_LIMIT=3 对齐，解决 P1 隐含需求#2（行高一致）✓
- 行 hover 背景保留在 `.entry-list-row:hover`（EntryListRow.vue:138-140，不依赖 `<a>`）→ BDD-19/21 ✓
- **NOTE-7 已落实**：死 CSS `.entry-list-row:focus-visible` 已移除（核 EntryListRow.vue style 段，仅存 `.entry-title/.meta-username/.tag-overflow:focus-visible`）；EntryListView 两处 `@navigate` 已移除（grep 确认 EntryListView.vue 无 `@navigate`）；`navigateToEntry` 死代码已从 EntryListView 清除（grep 确认仅存于两组件内部）✓

### 7. 旧测试适配的合理性 — PASS

独立复核 6 个旧 spec 的 git diff，确认均为**结构适配**而非删除断言：

- **expired-warning.test.ts / filter-tabs.test.ts**：TC-B15 从 `expect(role).toBe('link')`（span）改为 `expect(tagName).toBe('a')`——断言意图（username 可点击）保留，仅更新到新 `<a>` 结构；新增 vue-router mock（组件现调用 useRouter）。✓
- **searchUrl.logic.spec.ts**：7 处 toEqual 增加 `tags: []`——适配 RestoredQuery 接口新增字段，断言完整保留。✓
- **EntryListRow.spec.ts / t031-entry-card.spec.ts / t031-entry-list-row.spec.ts**：
  - 移除 routerLinkStub（组件不再用 router-link，改原生 `<a>` + useRouter）+ 加 pushMock
  - `navigate` emit 断言 → `pushMock` 断言（导航意图保留，emit 按设计移除）
  - card-body/root `<a>` 断言 → title `<a>` + 根 `<div>` 断言（结构意图保留）
  - username span role=link → `<a>` + href 断言（更强，含 href 校验）
  - **唯一删除**：EntryListRow.spec.ts「does not emit navigate on Space key」——该测试针对旧「整行是 `<a>`」行为，行改 `<div>` 后行为已按设计消失，等价覆盖由「renders title as a native link with href」承接。属合理删除，非削弱覆盖。

方向与 P2 一致，与主 Agent 查证（span role=link → `<a>` + vue-router mock）吻合。P3 基线 t076-*.spec.ts + e2e/entry-card-interaction.spec.ts 经 git status 确认未被修改。

## NOTE 汇总（建议级，不阻断推进）

| # | 维度 | 内容 | 文件定位 | 建议 |
|---|------|------|----------|------|
| 1 | 交互语义 | tag-overflow 为 `<button>` 但 `cursor: default` 且无 click handler；button 语义暗示可点击，cursor 与语义略不一致 | EntryCard.vue:269 / EntryListRow.vue:220 | 可保留（视觉上与 tag chip 一致是合理取舍）；若追求语义一致可加 `cursor: help` 或 `cursor: pointer`。非缺陷 |
| 2 | 移动端 | tooltip `white-space: nowrap`，tags 多且名称长时可能横向溢出视口 | EntryCard.vue:283 / EntryListRow.vue:234 | P2 已承认 CSS-only 单行限制；可后续按需加 `max-width` + 换行。非回归 |
| 3 | 可访问性 | NOTE-1 建议的 `aria-expanded` 未加（用了 button + aria-label 替代） | EntryCard.vue:46-53 | aria-label 已覆盖屏幕阅读器（NOTE-3 落实）；aria-expanded 对瞬态 tooltip 非必需。可接受 |

## 给主 Agent

- File: docs/tasks/T076-entry-card-interaction/P4-review.md
- Status: approved
- 无 BLOCKER；3 条 NOTE 均建议级。实现忠实方案 A、DESIGN 合规、交互/键盘/移动/一致性全满足、旧测试为结构适配。可推进 P5 gate。
