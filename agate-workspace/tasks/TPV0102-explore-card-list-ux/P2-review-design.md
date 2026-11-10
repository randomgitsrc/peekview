---
phase: P2
task_id: TPV0102
type: review
parent: P2-design.md
trace_id: TPV0102-P2-review-design-20261110
status: approved
created: '2026-11-10'
agent: plan-design-review
review_round: 3
review_scope: ui
ui_render_shape: layout
dimensions_scored: 交互状态覆盖率 AI_Slop_风险 移动端考虑 组件完整性 可访问性 视觉设计 交互设计细节
candidate_count_reviewed: 2
prod_touched: false
---

# P2 设计评审（复审 · 第 3 轮）— Explore 列表体验修正（plan-design-review）

> **被评审对象**：`P2-design.md`（1406 行，本轮由 1227 行修订而来）
> **本轮性质**：**第 3 轮复审**。核验上轮 5 项缺口 N-1~N-5 的闭合，其中 **N-3 本轮改判**（详见 §3）。
> **判定基准**：独立复验源码/规范原文，不采信 architect `§13.6` 的自述。
> **retry 预算**：P2 已到 2/3，仅剩 1 次。本评审据此**区分硬缺陷与软问题**：硬缺陷才阻塞，软问题落 SUGGEST 并给 P4 默认路径。
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 0. 结论摘要

**Status: approved**

| 项 | 结果 |
|---|---|
| **N-1**（高）`Team.id` 不存在 | ✅ **已闭合**（4 处落点逐条实测） |
| **N-2**（中）`variant="sheet"` 切换主体悬空 | ✅ **已闭合**（机制真实存在 + 接线写死 + 成对性成立） |
| **N-3**（高，**主 Agent 判我上轮误判**） | ✅ **本轮改判为闭合** —— 撤回"契约必然在 P6 红"的结论（§3 给出改判理由） |
| **N-4**（中）`inline`/`icon` 文案 + `aria-label` 未定义 | ✅ **已闭合**（三子表 + 自查表，文案与源码逐字对上） |
| **N-5**（低）§6.4#5 行号与影响面偏差 | ✅ **已闭合**（`:111-112` + 3 条断言写清） |
| **复查「上轮判过、不应被破坏」** | ✅ 全部未被破坏（含 B/C 候选与权衡、§5 两节「维度不适用」、BDD-30 对标、`## UI 设计` 裸标题、D-1~D-5、2 项裁决） |
| **E-1 / E-2 顺带处理是否引入新问题** | 未引入（`:900` 已读回 900；E-2 归属在 §3.5 与 §5/§6.2 三处一致） |

**5/5 闭合，且独立复验后未发现新的阻断级问题。**

**本轮新发现 4 项，全部判为 SUGGEST（不阻塞）**，集中在同一簇——**详情页接入契约**（`select` 落地主体 / `isOwner` 来源 / `disabled` 链）与两处文档级小偏差（`OverflowMenu.vue` 行号差 1、store `toggleVisibility` 处置二选一）。每一项都已在 §6 给出**可照抄的 P4 默认路径**，故不构成"P4 需自行发明设计"的空洞。

**为什么这次是 `approved`（与上轮的区分）**：
- 上轮判 needs-revision 的两条最高理由是"**P4 照 spec 写必然失败**"——N-1 是**根本没有合法派生路径**（`Team`/`TeamRef`/`TeamSummary` 三者都无 `id`，加了 `as any` 也拿不到"当前团队"），N-3 是**冻结契约内部自相矛盾**（VC-4 要 44px 而实现规格只给 28×28，两个分支都违反一处）。
- 本轮残留的 4 项**都有多条编译安全的分支**，且不触动任何设计取舍：最坏情形是 P5 `make typecheck` 报一处可 2 行修掉的错（§6 S-1/S-3），或 `select` 落地由 P4 按我已写出的默认路径接（§6 S-2）。
- 「在 spec 阶段抓设计问题」的价值仍在——所以我仍把这 4 项**写清并给了默认路径**，只是不再用掉最后一个 retry 预算去要求它们先进文档。

---

## 1. 形态分派确认（沿用上轮结论）

| 项 | 值 | 一致性 |
|---|---|---|
| P1 frontmatter `ui_render_shape` | `layout` | — |
| P2 §UI 设计「渲染形态」声明（`:794`） | `layout`（布局型） | 一致 |
| 加载维度组 | 布局组（移动端考虑 / 组件完整性）+ 交互组（交互状态覆盖率 / 交互设计细节 / 可访问性）+ 视觉组（视觉设计） | 按角色定义 |
| 渲染正确性与时序维度 | **不启用**（非渲染组件型 / 时序特效型） | 按角色定义，不制造打分噪音 |

`## UI 设计` 仍为**裸标题**（`P2-design.md:788`，无编号前缀），gate 正则 `^#{2,3}\s+UI 设计` 可命中。

---

## 2. N-1 / N-2 / N-4 / N-5 逐条核验（4/4 闭合）

### N-1 `Team.id` 不存在 → 改 `entry.team?.slug` 派生 — ✅ **已闭合**

| 核验点 | 实测落点 | 判定 |
|---|---|---|
| 纯函数入参改名 | `:447` `currentTeamSlug: string \| null   // = entry.team?.slug ?? null；"当前团队"的唯一来源` | ✅ |
| 派生式写死 | `:455` `const currentTeamSlug = entry.team?.slug \| null`（原文 `entry.team?.slug ?? null`） | ✅ |
| 子菜单按 slug 排除 | `:457` `teams.filter(t => t.slug !== currentTeamSlug.value)`；`:102`（§1.1 D1）同步为"按 **slug** 排除" | ✅ |
| `applyPatch` 的 `team` 字段形状 | `:678` 改 `team = { slug, name }`（`TeamRef`）；`:683-687` 明写"**P4 不得**为了三字段同写而伪造 `teamId`（如 `teams.indexOf(t)`）" | ✅ |
| 是否残留 `Team.id` / `t.id ===` 用于"当前团队" | 全文 `t.id ===` **仅 2 处**：`:453`、`:1385`，**均为"不得这样做"的否定陈述**（合法，且是有价值的反例记录） | ✅ |
| 类型事实复验（不看自述） | `types/index.ts:9-12` `TeamRef {slug,name}`、`:14-18` `Team {slug,name,memberCount}` —— **均无 `id`**；`models.py:747-752` `TeamRef{slug,name}`、`:947-952` `TeamSummary{slug,name,member_count}` —— **均无 `id`** | ✅ 与设计陈述一致 |
| `entry.team` 在 Explore 两个面可用（通路） | `api/client.ts:107`（`transformListItem`）与 `:130`（`transformEntry`）均 `team: entry.team ? {slug,name} : null`；后端 `entry_service.py:717` `team_map = {t.id: TeamRef(...)}`、`:1255-1261` `_team_ref()` 实测存在 | ✅ 通路真实 |

→ `tsc` 层面已无报错点，BDD-18「排除当前团队」有唯一派生路径。**闭合**。

> 唯一措辞级残留（不阻塞，已记 §6 S-4）：`applyPatch` 字段表的 `team` 行标题是"**无 `updated` 时**"，却仍写 `teamId = <该 team 的数字 id>`，而紧接着的澄清块（`:680-688`）明确说"乐观路径**不可**取 teamId，故不写"。表行与澄清块口径不一致，P4 读表可能误判。修正方向：表行该格直接写"`teamId` 见下澄清（乐观路径不写）"。

### N-2 `variant="sheet"` 切换主体 — ✅ **已闭合**（并修正我上轮的事实错误）

**先纠正我上轮的措辞**：上轮我写"项目无 `useMediaQuery`"——**这一句本身是对的**（`frontend-v3/src` 全量 grep 0 命中），但我据此推出的"项目无响应式机制"**不成立**。实测：

- `frontend-v3/src/composables/useResponsiveLayout.ts` **存在**：`viewportWidth` + `handleResize`（`requestAnimationFrame` 节流）+ `isMobile = computed(() => viewportWidth.value <= 640)` + `isDesktop`。
- 既有使用方 **2 处**：`EntryDetailView.vue:133` import / `:156` `const { isMobile, isDesktop, handleResize } = useResponsiveLayout()`；`UserManagerTab.vue:77` import / `:87` `const { isMobile } = useResponsiveLayout()`。
- 设计（`:512`）正是引用它而非新造机制，并把 `useMediaQuery` 记为"全仓 0 命中，本项目不引入第二套"——**判断成立**。

**接线完整性逐条核验**：

| 核验点 | 实测 | 判定 |
|---|---|---|
| 详情页零改动可用 | `EntryDetailView.vue:217` `window.addEventListener('resize', handleResize)` / `:227` `window.removeEventListener('resize', handleResize)`（在 `onMounted`/`onUnmounted` 内）——**成对存在**，设计 `:526`/`:751` 的陈述属实 | ✅ |
| Explore 页确实缺 `isMobile` | `EntryListView.vue` 全文件 grep `useResponsiveLayout` / `handleResize` / `resize` / `matchMedia` → **0 命中**；`IsMobileKey` provide 全仓仅 `EntryDetailView.vue:159` | ✅ 设计的缺口描述属实 |
| `onBeforeUnmount` 是否真的缺 | `EntryListView.vue:262` `import { ref, computed, onMounted, watch, nextTick } from 'vue'` —— **确实缺 `onBeforeUnmount`**，设计 `:517` 点名要补 | ✅ |
| 成对性（`add`/`remove`） | `:520-521` 同时给出 `onMounted(add)` 与 `onBeforeUnmount(remove)`，**未出现只加不减** | ✅ |
| prop 链是否含 `variant`/`teamsFailed` | `:735-741` 链图 + `:743-751` 取值来源表，三个宿主（卡/列表/头部/元信息条）全覆盖 | ✅ |
| 落地形态是否与先例一致 | `EntryDetailMobileBar.vue:50` 实测 `<OverflowMenu :items="overflowItems" variant="sheet" />` | ✅ |
| 裁剪面理由是否成立 | `EntryListView.vue` 有 `.entry-panel { overflow: hidden }`（`:1117-1122` 区段）、`EntryCard.vue:206-213` `.card-actions { z-index: 1 }`；卡/列表**不在** `.content-area` 内 → 设计 `:532` 说"需要独立 Teleport 理由"是**主动补的**，不是套用详情页理由 | ✅ |

→ 切换主体从"悬空"变为"视图层下发 + 三处写死表达式 + 成对监听"。**闭合**。

> 措辞级小偏差（不阻塞）：设计用 `onBeforeUnmount`，既有 `EntryDetailView` 用 `onUnmounted`。两者在 Vue 3 均为合法卸载钩子且都能 remove，属风格不统一，不影响正确性。

### N-4 可见文案 + `aria-label` — ✅ **已闭合**

| 核验点 | 实测 | 判定 |
|---|---|---|
| ① `variant` × 三态可见文案表 | `:555-559` 三行表：`inline` = `Public` / `Private` / `仅团队可见 · {{ team.name }}`；`icon` = 无可见文字、仅 Lucide（14/16）；`sheet` = 触发按钮同 `icon` + 浮层标题「可见性」（英文 `Visibility`） | ✅ |
| ② `aria-label` 覆盖**全部**变体 | `:561-579`：`visibilityStatusLabel(entry)` 纯函数为**唯一文案源**，`:aria-label="`Visibility: ${label}`"`；明写"所有 `variant` 都必须有" | ✅ |
| ③ 复用同一函数防漂移 | `:571-577` 可见文本与 `aria-label` 共用 `visibilityStatusLabel` | ✅ |
| 文案与源码**逐字**对上（关键） | `EntryDetailHeader.vue:68-72`：`仅团队可见 · {{ currentEntry.team?.name \|\| currentEntry.team?.slug }}` / `Public` / `Private`；`EntryMetaTagsBar.vue:7-11` 同上 —— 设计引的行号与文案**都对** | ✅ |
| 先例引用是否准确 | `OverflowMenuSheet.vue:16` `<span class="sheet-title">More actions</span>`、`:17` `aria-label="Close"` —— 设计 `:559`/`:599` 引用准确 | ✅ |
| 子菜单 `aria-haspopup`/`aria-expanded` 自查是否补 | `:598` `Team` 入口补 `aria-haspopup="true"` + `:aria-expanded="isTeamSubmenuOpen"`（列入 `:612` 行为约定） | ✅ |
| sheet 关闭按钮 `aria-label` | `:599` 复用 `OverflowMenuSheet.vue:17` 的 `aria-label="Close"` | ✅ |
| 菜单项文案表（供 P3 断言） | `:583-589` 五行情景（含 `visibility-team-option-{slug}` 与失败禁用项同 testid 靠 `disabled` 区分）+ `:591` 状态名非动作名的理由 | ✅ |

> **唯一瑕疵（不阻塞）**：设计多处引 `OverflowMenu.vue:14` 为 `aria-label` 先例，实测该行是 `:14 :aria-expanded="isOpen"`，`aria-label` 在 **`:15`**（`:13` = `aria-haspopup`）。差 1 行，纯文档偏差，不影响实现（同文件 `:6` `:disabled`、`:11-12` Enter/Space、`:13-14` haspopup/expanded、`:123-126` `close()` 含 `triggerRef.value?.focus()`、`:139-146` Escape/Tab 双分支、`:148-156` 成对增删——**其余引用全部准确**）。记 §6 S-4。

### N-5 §6.4#5 行号与影响面 — ✅ **已闭合**

| 核验点 | 实测 | 判定 |
|---|---|---|
| 行号是否改为 `:111-112` | `:972` 表行位置列 = `src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts:111-112`（`statusTagText()` 助手，内含 `wrapper.find('.status-tag')`） | ✅ |
| 实测该文件 | `:111` `function statusTagText(...)`、`:112` `const tag = wrapper.find('.status-tag')` —— **逐行对上** | ✅ |
| 影响面是否写清为 3 条 | `:972` 明写"影响面是 **3 条**断言而非 1 条：`:135`（team：`toContain('团队')` + `toContain('Proj A')`）、`:143`（private：`toContain('Private')`）、`:148`（public：`toContain('Public')`）" | ✅ |
| 断言条数实测 | grep 实测 `statusTagText(wrapper)` 消费点正是 `:135` / `:143` / `:148` —— **3 条，元数据准确** | ✅ |
| 附带理由是否成立 | `:972` 补"不能沿用 `.status-tag` 类名定位——`EntryDetailHeader.vue:63-64` 的 `Archived` / `Expired` 也带该类，`find()` 取首个会误命中"；实测 `EntryDetailHeader.vue:63` `class="status-tag">Archived`、`:64` `status-tag` Expired —— **属实，且这条提醒很关键** | ✅ |

---

## 3. N-3 重新判定 —— **改判为闭合（撤回上轮结论）**

### 我上轮判了什么

上轮我判 **N-3（高）**：「VC-4 要求移动端触发按钮 ≥44px，但 `§5:732` 把卡片/列表触发按钮尺寸写死 28×28，且全文无任何实现侧 44px 规则 → 冻结的视觉契约与实现规格自相矛盾 → **P4 照 spec 写必红**」。

### 本版实测（不采信自述，逐行读）

| 核验点 | 实测落点 | 结论 |
|---|---|---|
| §5 组件一致性节是否仍只写 28×28 | **已不是单行**。`:865-870` 扩为**4 行「新 vs 既有」表**：行 1 = `VisibilityMenu` 移动端 `variant="sheet"`（≤640px）**44×44**，归属"本任务新增"，**VC-4 ✅ 断言**；行 2 = 桌面 `variant="icon"` 28×28（沿用既有尺寸），**VC-4 ❌ 不断言**；行 3 = `variant="inline"` 沿用 `status-tag`（实高≈18px），移动端按行 1 走 44px，**VC-4 ❌ 不断言**；行 4 = **既有删除按钮 28×28 —— "既有，本任务不改"，VC-4 ❌ 不得断言** | ✅ |
| 是否有实现侧 44px 规则 | **有，且写死**。`:872-878`：`@media (max-width: 640px) { .visibility-toggle { min-height: 44px; min-width: 44px; } }`，并加两条禁令——**只作用于 `VisibilityMenu` 自己的触发按钮（新类 `.visibility-toggle`）**、**不得**写到 `.card-action-btn` / `.action-btn` 上（"那会把既有 28px 按钮一起放大 = 扩大范围"） | ✅ |
| 既有 28×28 是否被明确排除 | `:880` 明写"既有 28×28 不改……属既有债务 → §7.1 S2 登记，本任务不动（VC-4 若断言它们，等于把既有不达标写成'已达标'）"；§7.1 S2（`:1013`）实测存在且理由一致 | ✅ |
| VC-4 断言本身 | `:890`："**本任务新增的**菜单触发按钮在**移动端**的触达高度（**只看** 组件一致性节表内第 1 行）"，`expect(boundingBox().height).toBeGreaterThanOrEqual(44)` | ✅ 与行 1 对齐 |
| 口径块是否可能与表冲突 | `:895-898` 三条：VC-4 = 第 1 行；第 4 行不在范围；第 2/3 行不断言 —— 与表**逐行一致**，无互斥 | ✅ |

### 改判理由（为什么我上轮错了）

1. **我的上轮结论建立在一个已被推翻的前提上**：我当时读到的 `:732` 只有一行"卡片 28×28 / 列表 28×28"，且全文无实现侧规则，于是推定"P4 会（也只能）按 28×28 实现新按钮"→ VC-4 必红。**本版给新按钮单列了 44px 媒体查询规则并限定选择器**，P4 照 spec 写会得到 44×44 → VC-4 绿。前提消失，结论不成立。
2. **"既有 28×28 在范围内"也是我的误读**：我上轮把 `:747-749` 的拆分读成"仍需解决矛盾"，但本版把它扩成 4 行表后，行 4 的归属列直接写"既有组件 / 本任务不改"，并把 S2 债务登记对齐（`:1013`）。**既有 28px 不在本任务范围从隐含变成显式**。
3. **不因"我上轮判了高"而坚持**：设计评审的职责是在 spec 阶段消灭"实现后再改的成本"，而本版已经把这条成本消灭了——留下的 44 vs 28 并排密度属**视觉取舍**（见 §4），不是契约矛盾。

**→ N-3 改判：闭合。上轮"契约必然在 P6 红"的结论撤回。**

---

## 4. 复查「上轮判过、本轮不应被破坏」的部分（全部未破坏）

| 复查项 | 实测 | 结论 |
|---|---|---|
| **D-1**（props `disabled` / emits `confirm-cancel` / 5 项内部状态表） | `:497` `disabled` 行（含"上一轮正文引用了 `props.disabled` 但 props 声明里没有"的自注）；`:539` `confirm-cancel` 行；`:543-549` **5 行状态表**（`isOpen`/`isTeamSubmenuOpen`/`pendingTarget`/`isConfirming`/`triggerRef`，含类型/初值/用途/转换） | ✅ 仍在 |
| **D-2**（不设 `visibility-confirm` testid） | `:766` 明写"**不设** `visibility-confirm` testid"+ Teleport/`.confirm-dialog`/无 `data-testid` 三条机制理由；`:616` 同向；§1.2 `:139` `ConfirmDialog.vue` 不改 | ✅ 仍在（且 §1.2 措辞仍说"改由 `VisibilityMenu` 侧的容器承担"，与 §3.5 的"改用 `.confirm-dialog` 类名"并存但不矛盾——前者指不依赖 `ConfirmDialog` 支持 testid 透传） |
| **D-4**（sheet variant + Teleport） | `:496` `variant` 三值；`:516`/`:615` sheet 走 `Teleport to="body"` | ✅ 仍在（切换主体已由 N-2 补齐） |
| **D-5**（VC-4 = 44px 且不向下对齐） | `:742`/`:890` `toBeGreaterThanOrEqual(44)`；无任何 `24px` 向下对齐残留 | ✅ 仍在 |
| **裁决 1**（overflow 移除 + `t052...test.ts:100` **不**列入待改） | §6.4 表 11 行（`:966-978`）无该行；第 9 项只列 E2E `:108-112` + `:114`（`:976`）；`:980-985` 范围裁定块原文仍在（含"`label` 只是测试自身构造的字面量数据，与组件行为无关"） | ✅ 仍在 |
| **裁决 2**（`visibility-toggle` 沿用、无 `visibility-menu-trigger` 残留） | `:768-770` 沿用说明 + "上一版已删除前者"；全文 `visibility-menu-trigger` 仅出现在**否定句**（`先 :606` "**不得**另命名"、`:770`/`:1310`/`:1346`/`:1403` 的"已删除"记录） | ✅ 仍在（表 `:757-764` 无重复行） |
| **B 候选与权衡** | `:211-231` B1/B2 双向优缺点 + 选择理由；调用方数字仍为 **3 处并列名**（`EntryDetailHeader.vue:53` / `EntryDetailMobileBar.vue:50` / `settings/UserManagerTab.vue:38`）；`EntryDetailMobileBar.vue:50` 实测命中 | ✅ 仍在，非稻草人 |
| **C 候选与权衡** | `:247-273` C1/C2/C3 三候选均带实测结论（C1 `getByText` 命中 0；C3 命中 0 且 `textContent` 不含；C2 唯一可断言 + `opacity:0` 反例），选 C2 理由成立 | ✅ 仍在 |
| **§5 两节「维度不适用」** | `:902-904` 渲染正确性 checklist `**维度不适用**` + 理由；`:906-908` 动效时序 checklist `**维度不适用**` + 理由（"菜单/tooltip 仅 `visibility` 切换，无 transition 动画，不涉帧采样"） | ✅ 仍在（显式声明"不适用"是**消除**留白，不属 AI Slop） |
| **BDD-30 对标 `OverflowMenu`** | 设计 `:610` "照抄 `close()` 模式——`isOpen=false` 后 `triggerRef.value?.focus()`；`Escape` 与 `Tab` 均触发；`document` 监听在 `onMounted`/`onUnmounted` 成对增删；点击外部关闭"；实测 `OverflowMenu.vue:123-126`（`close()` 含 `triggerRef.value?.focus()`）、`:139-146`（Escape + Tab 两分支）、`:148-156`（成对增删 click/keydown）—— **逐条对上** | ✅ 仍在且准确 |
| **`## UI 设计` 裸标题** | `:788`，无编号前缀 | ✅ 仍在 |

---

## 5. E-1 / E-2 顺带处理：是否引入新问题

| 项 | 核验 | 结论 |
|---|---|---|
| **E-1** `P5_e2e_legacy_timeout_seconds: 600 → 900` | §9 实测读回 `P5_e2e_legacy_timeout_seconds: 900`；`P5_e2e_timeout_seconds: 900` 亦为 900；声明要点（`:1150` 区段）改写为"同理且必须等值——等值不满足规则，声明不能自相矛盾" | 无新问题 |
| **E-2** 双 toast → 视图层唯一发出 | §3.5 `:649-650` store 只 `return { ok, revokedShares }`；`:661` `type SetVisibilityResult = { ok, revokedShares }`；`:664-670` 三条归属理由 + **P4 硬约束**"store 内不得出现 `toast.show`/`useToast`"；§5 `:829` success 四态注明"唯一发出点是视图层"；§6.2 `:942` 明写该 spec **不断言 toast** | 三处一致，无新问题 |

> **附一条与 E-2 相关的观察（不阻塞，见 §6 S-1）**：E-2 的归属理由第 3 条（`:668`）写"详情页（`useEntryDetailActions.ts`）不走本 store 方法（§1.1 D9 已裁定其 overflow 入口移除）"。但 D8 在详情页头部**新增**了 `VisibilityMenu` 入口，它的 `select` 必须落到某处——该句在 D6 之后作为"详情页无 store 调用方"的论据已不完全成立。

---

## 6. 本轮新发现：4 项 SUGGEST（**均不阻塞**，含 P4 默认路径）

> 分级口径（本轮特别声明）：**阻塞项 = P4 照 spec 写会得到相互矛盾的结果，或某条 BDD/契约根本无实现路径**。以下 4 项都不满足该口径——每项都有 ≥2 条编译安全的分支，且可由 P5 的 `make typecheck` / P6 截图确定性暴露，故落 SUGGEST 并在下面把默认路径写死，避免 P4 自由发挥。

| # | 级别 | 发现 | 落点 | P4 默认路径（可直接照做） |
|---|---|---|---|---|
| **S-1** | 中 | **D4「`toggleVisibility` 替代为 `setVisibility`」与 D6「移除 overflow 项」未交代 `useEntryDetailActions.handleToggleVisibility` 的处置**。实测 `useEntryDetailActions.ts:50` 是 `entryListStore.toggleVisibility` 的唯一生产调用方（`:131` 还把它放进了 composable 返回值），而 §6.4#10（`:977`）又把 `useEntryDetailActions.ts:52` 的 toast 文案列为"待改"。若 P4 按 D4 删掉 store 的 `toggleVisibility` → 该处 `tsc` 报错；若保留 → 它成了无 UI 入口的死码，§6.4#10 有半条登记失效 | `:105`（D4）、`:107`（D6）、`:977`（§6.4#10） | **保留 `toggleVisibility` 为薄包装**（`toggleVisibility(entry) => setVisibility(entry, entry.isPublic ? {kind:'private'} : {kind:'public'})`）+ 删除 `useEntryDetailActions.handleToggleVisibility` 及其返回值项与 overflow 项，§6.4#10 只保留 `EntryListView.vue:640` 一处文案改动。三处动作互不冲突，`tsc`/`noUnusedLocals`（`tsconfig.json:15-16` 已启用）全绿 |
| **S-2** | 中 | **详情页 `VisibilityMenu` 的 `select` 落地主体未定义**。§3.5 `:538` 只写"组件内不发请求，由视图层调 store + 出 toast"，§1.1 D9 只给 **Explore 侧** `handleVisibilityChange`；`mount-detail` 批（`:284`）要交付"桌面头部/移动元信息条菜单"，但没有一句说详情页收到 `select` 后调什么、是否发 toast、`disabled`（inFlight）从哪来。§3.7 链图（`:738-739`）只下发 `teams` / `variant` / `teamsFailed`，**不含 `disabled`** | `:538`、`:605`、`:738-739` | `EntryDetailView` 加 `handleVisibilityChange(target)`：调 `entryListStore.setVisibility(currentEntry, target)`（store 内已有 `detailStore.syncVisibility`，见 `:645-647`，详情页状态会自动同步），按同一 `SetVisibilityResult` 四态发 toast；`disabled` 用 `entryListStore.inFlight.has(currentEntry.slug)`（store 已把 `inFlight` 做成 `ref<Set>`，`:624`）下发。**与 Explore 侧共用同一函数语义**，不新增 API |
| **S-3** | 中 | **详情页 `isOwner` 来源未进 prop 链**。§3.5 `:605` 说"`v-if="isOwner"` 由父组件控制"，但 `EntryDetailHeader` 现有 props（`:107-124` 实测）**无 `isOwner`**、`EntryMetaTagsBar` props（`:27-30`）只有 `currentEntry`/`relativeTime`；§3.7 链图也不含它。若 P4 改为在组件内 `useAuthStore().isOwner(...)`，既有 `tpv0095-detail-visibility-tag.spec.ts:18-30` 的 `useAuthStore` mock（`mockAuthStore` 只有 `user`/`authState`/`isAdmin`/`logout`，**无 `isOwner`**）会 `TypeError`，而该 mock 不在 §6.4 登记面 | `:605`、`:738-739`、`:109`（D8） | 在 `EntryDetailView` 已有 `authStore.isOwner(currentEntry?.ownerId ?? null)` 调用（`:37` 用于 `EntryDetailBanners`）处复用，给 header / meta-bar 新增 `:is-owner` prop 下传（连带在 §6.4 补一条"该 spec 的 props 补 `isOwner`"）。**不要**在子组件内直连 store——那会打破该 spec 的 mock 契约 |
| **S-4** | 低 | 两处文档级偏差：①`OverflowMenu.vue` 的 `aria-label` 先例在 **`:15`**，设计（及我上轮评审）写 `:14`；②`applyPatch` 字段表 `team` 行（`:678`）标题为"无 `updated` 时"却写 `teamId = <数字 id>`，与紧跟的澄清块（`:680-688`）"乐观路径**不写** `teamId`"口径不一 | `:576`、`:678` | ①行号改 `:15`（同文件其余引用 `:6`/`:11-12`/`:13-14`/`:123-126`/`:139-146`/`:148-156` **均准确**，只此一处偏移）；②表行该格改为"`teamId` 见下澄清（乐观路径不写，待服务端响应回填）" |

**另有一项视觉判断，供 P6 复核（不构成缺陷）**：移动端卡片内新增 44×44 的 `VisibilityMenu` 触发按钮与既有 28×28 删除按钮**并排**（`card-actions`），垂直对齐与密度表现未被 VC-1~VC-7 覆盖（VC-7 只覆盖桌面 `meta-row`）。这不是契约矛盾（行 1 与行 4 的尺寸差异是显式设计），但建议 P6 的 `mobile_390x844` 截图专门看这一处。

---

## 7. 各维度评分（本轮 vs 上轮）

| 维度 | 上轮 | **本轮** | 变化依据 |
|---|---|---|---|
| 交互状态覆盖率 | 9 / 10 | **9 / 10** | N-2 闭合使 sheet 路径在 Explore 两个面上有了确定主体（展开/关闭/切换形态不再悬空）；BDD-24 仍是"store `inFlight` 守卫 + 组件 `disabled` 视觉"双层。**扣 1**：详情页 `select` 后的状态转换与失败反馈归属未写（S-2） |
| AI Slop 风险（越高＝留白越少） | 7 / 10 | **9 / 10** | 三处最大留白全部消灭：N-1（伪代码不可编译→编译安全）、K-4（可见文案 + `aria-label` + 菜单项文案 + testid 四处全定义）、N-3（44px 有 CSS 规则）。**扣 1**：详情页接入三件（select/`isOwner`/`disabled`）仍需 P4 决策（S-1~S-3，均已给默认路径） |
| 移动端考虑 | 7 / 10 | **9 / 10** | N-2 落地（`useResponsiveLayout` 接线写死 + `EntryCard`/`EntryListRow` 透传 + 详情页零改动）、N-3 落地（`@media (max-width:640px)` 的 `.visibility-toggle` 规则）、D-7 的移动 tooltip 右对齐 + 换行仍在。**扣 1**：44 vs 28 并排密度无契约覆盖（仅建议 P6 截图） |
| 组件完整性 | 7 / 10 | **8 / 10** | `VisibilityMenu` 契约已完整（props 5 / emits 2 / 状态 5 / 文案 3 表 / testid 9 行）；N-1 的字段口径澄清（`:680-688`）把"不能伪造 teamId"写成硬约束。**扣 2**：宿主组件接入面未成链——`isOwner` 无 prop（S-3）、`disabled` 未入详情链（S-2）、`toggleVisibility` 处置二选一（S-1） |
| 可访问性 / 键盘可达 | 8 / 10 | **9 / 10** | N-4 补齐了 icon-only 按钮的读屏名称（既有 `OverflowMenu.vue:15` 惯例）+ 子菜单 `aria-haspopup`/`aria-expanded` + sheet 关闭按钮 `aria-label="Close"`；`aria-label` + `aria-haspopup` + `aria-expanded` 三者并存的组合写清；D-12 的焦点环/焦点回归/取消后回归全在。**扣 1**：`inline` 变体（详情页桌面）的可见文本虽沿用现状，但其作为 `<button>` 与既有 `<span>` 的语义差异未说明（视觉无误，仅为读屏语流的边际差异） |
| **视觉设计** | **8 / 10** | **8 / 10** | 布局一致性 **2/2**（z-index 三处对齐六档表、浮层关系完整、VC-1~VC-7 可量化）；颜色与对比度 **2/3**（tertiary 亮 3.04:1 / 暗 3.84:1 低于 AA，**如实陈述 + S1 登记 + P6 不得写成"已达标"**——本任务不改色，属既有债）；字体与间距 **2/3**（`2px/6px` → `var(--space-1) var(--space-2)` 兑现 4px 基数，但 `inline` 沿用 `status-tag` 10px + `1px 6px`、tooltip 11px 属表外值——两者均**显式声明为既有例外**）；组件一致性 **2/2**（token 组合、圆角/阴影/图标尺寸、`VisibilityMenu` 4 行尺寸表 + 写死 CSS 均对齐 `OverflowMenuDropdown`/`OverflowMenuSheet`） |
| **交互设计细节** | **8 / 10** | **8 / 10** | 输入态反馈 **3/4**（四态 toast + 三字段回滚 + 取消路径 + 请求中禁用 + 加载失败禁用项全定义；扣详情页 `select` 反馈归属）；键盘可达与焦点 **3/3**（Escape/Tab/焦点回归/取消后回归/子菜单两级 Escape/`Tab` 逐项）；过渡与禁用态 **2/3**（禁用态 `opacity:.5; cursor:not-allowed` + `aria-disabled` 已定义；过渡仍为"无 transition"，在 `visibility` 离散属性约束下是合理取舍，但 sheet 无入场过渡、拖拽/滚动锁定已登记 S4，轻扣） |

**两维主分对比**：视觉设计 **8 → 8**、交互设计细节 **8 → 8**（**未变动**）。

**为什么不涨分（必须说清，否则"5 项全闭合却不涨分"看起来像走过场）**：

1. **视觉的 4 个扣分点里，2 分是"本任务不能修的既有债"**——AA 对比度（S1）要改全局 `--c-text-tertiary`，会波及全部既有组件；`status-tag` 的 10px/`1px 6px` 是刻意保持替换前后视觉权重的例外。这两项在 P2 retry 里**无论怎么改设计都拿不到分**，给分只会变成鼓励超范围改造。
2. **交互的扣分点在"未接入面"而非"已定义面"**——`VisibilityMenu` 自身的交互规格已达 9-10 分水平；扣分来自详情页宿主如何接线（S-1~S-3），而它已被我给出默认路径，属 P4 执行层而非设计缺洞。
3. **上轮的 8/10 与本轮 8/10 不是同一质量的 8**：上轮 8 分是"方向对但契约有 2 个必炸的洞"（N-1/N-3），本轮 8 分是"洞已闭、扣分全落登记债务与执行接线"。**分数稳定说明的不是没进步，而是进步用在了把 7 分项拉上来（AI Slop 7→9、移动端 7→9、可访问性 8→9），而两个主分的天花板由既有债决定。**

### UI 层 ≥2 候选 + 权衡（角色硬要求）复核

`candidate_count: 7` = A1-A3 / B1-B2 / C1-C3。UI 层两项 + 布局维度：

- **决策点 B**（`:211-231`）：B1 / B2 双向优缺点 + 选择理由，`EntryDetailMobileBar.vue:50` 等 3 处调用方实测命中 → **成立，非稻草人**。
- **决策点 C**（`:247-273`）：C1（现状形态）/ C2（选定）/ C3（项目已有 `.tag-overflow::after` 先例）三候选均带实测结论 → **成立**。
- **布局维度**（`:233-241` §2.2b）：3 个被排除替代 + 具体反对理由（"放在 `title-row` 的 `actions-area`"这条的反对理由有真实语义依据） → **成立**。
- **视觉维度**：配色仍"全部沿用既有变量"单候选，理由充分（`DESIGN.md:321` Do 与 §12 Don't 共同禁止新增/硬编码色）→ 维持上轮判定：**合理单候选，不扣分**。

**判定：≥2 候选 + 权衡要求满足，不构成打回理由。**

---

## 8. 判定

**status: approved**

### 判定依据

1. **上轮 5 项缺口 5/5 闭合**，且 N-3 经重新判定**改判为闭合**（我上轮的前提被本版推翻，撤回结论）。逐条证据见 §2、§3。
2. **无新增阻断级问题**。本轮 4 项新发现全部满足"≥2 条编译安全分支 + 可由现有 gate（`P5_typecheck` / P6 截图）确定性暴露"，且每项已给可照抄的 P4 默认路径（§6）。
3. **交付能力足以支撑 30 条 BDD 的 UI 层**：状态覆盖（loading/error/empty/disabled/进行中/取消/子菜单展开/加载失败）齐、组件契约（props 5 / emits 2 / 状态 5 / 文案 3 表 / testid 9 行）齐、a11y 惯例对齐既有先例、视觉契约 7 条均为可量化 DOM 度量。
4. **未违反 `DESIGN.md`**：z-index 按六档表取 10/100、间距走 4px 基数并显式列例外、触达 44px 落地、语义别名 token 优先、焦点环强制项有指派。对比度不达标项**如实登记为既有债**而非掩盖（`DESIGN.md:289` 的 4.5:1 要求由 S1 承接，P6 不得写成"已满足 AA"）。
5. **三项架构选择（A2 / B1 / C2）与全部裁决结论均维持**，本轮改动只补契约不动取舍。

### 为什么不是 needs-revision

P2 retry 已到 2/3，仅剩 1 次预算。上轮判 needs-revision 的两条硬理由（N-1 无合法派生路径、N-3 冻结契约自相矛盾）本轮**都已消失**；残留 4 项的最坏后果是 P5 一处可 2 行修掉的 `tsc` 报错或 P4 按默认路径接一处 handler——用掉最后一个 retry 去换这 4 行文档，代价高于收益，且会挤掉 P3 红灯与 P6 验收的预算。

### 为什么不是 rejected

无 CRITICAL，无架构性返工需求，所有 BDD 均有实现路径与验收口径。

### 给主 Agent 与下游的交接提示

- **P4 implementer 请先读 §6 的"P4 默认路径"列**（S-1/S-2/S-3 三条），按其中路径实现即可，不必再回问设计。
- **P6 请在两份截图之外加看一处**：`mobile_390x844` 下卡片 `card-actions` 内 44×44（新菜单）与 28×28（既有删除）的并排观感（§6 末段）。
- **P6 报告不得**写"对比度已满足 WCAG AA"（S1 未修）；也**不得**把既有 28×28 按钮写成"已达标"（VC-4 明确只断言第 1 行）。

---

## 9. 环境隔离与只读纪律核验

- **[PROD_NOT_TOUCHED]**：未触碰 `:8080`，未访问/写入 `~/.peekview/`，未启动任何后端 / 浏览器 / debug 实例。
- **未运行任何写类工具**：`agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` / `agate-task-init.py` 均未调用。
- **未对被评审文件做任何修改**；未执行任何破坏性 git 命令（仅 `git status --porcelain` 只读查询）。
- **未在 `backend/tests/` 或 `frontend-v3/src/` 下建任何 scratch 探针**；所有核验为 `read` / `grep` / `glob` + `sed` 只读查看与 `check-gate.py P2`（只读 gate）。
- `check-gate.py P2` 实测 **exit 1**，唯一原因 `P2-review.md 不存在（P2 评审不可裁剪，必须派发独立 subagent 产出）` —— **符合预期**（组长汇总阶段产出）；`RECONCILE SUMMARY: 0 mismatches across 2 fields`。
- 本轮唯一写入：本文件（覆盖写）+ `P2-review-design-progress.md`（追加）。
