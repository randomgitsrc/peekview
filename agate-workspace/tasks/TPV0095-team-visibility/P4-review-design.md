---
phase: P4
task_id: TPV0095
type: review
parent: P4-implementation.md
trace_id: TPV0095-P4-design-review-20260902
agent: design-review
reviewed_domain: frontend
production_status: PROD_NOT_TOUCHED
status: approved
revision: rev2（2026-09-02 F3 修复核验通过 → approved，见文末 rev2 复审节）
---

# P4 实现评审（design-review 前端）— TPV0095 team-visibility frontend 批

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未跑 npm run dev；未改代码；只读评审）
> 评审对象：工作树 P4 frontend 改动（git diff 461936ad..HEAD 的 P3 spec + 工作树 P4 实现——P4 未 commit，实审 diff HEAD..working frontend-v3/ + DESIGN.md + 新增 teams.ts/TeamsView.vue）
> 评审基线：P1 BDD-38~44、P2 §5.1-5.8 + §5.7 testid 表、P3 10 组件 spec + 2 e2e spec
> 结论锚点：全部结论引用组件/BDD/testid；无 BLOCKER → 非 rejected；1 个 needs-fix（双 testid 冲突）→ needs-revision

## 结论摘要

| 维度 | 判定 |
|---|---|
| 5-tab 互斥/高亮（BDD-38） | ✅ approved |
| URL 恢复收敛（BDD-41 + P2 §5.4） | ✅ approved（1 建议项） |
| /teams 管理页（BDD-42） | ✅ approved（1 建议项） |
| 卡片 toggle 守卫 + badge（BDD-39/40） | ✅ approved |
| detail 三态标签（BDD-44） | ✅ approved（DESIGN_GAP 判定合理） |
| 移动端 + a11y（BDD-43） | ✅ approved（高度需 P6 实测，建议项） |
| data-testid 一致性（P2 §5.7） | ⚠️ 1 处 needs-fix（见 F1） |
| AI Slop / 视觉 / token | ✅ approved |
| DESIGN_GAP×5 + SCOPE+×2 判定 | ✅ 全部合理（见 §3） |
| 生产隔离 | [PROD_NOT_TOUCHED] |

## 1. 评审重点逐项核

### 1.1 5-tab 互斥/高亮（BDD-38）— approved
- `EntryListView.vue` `tabDefs` + `isTabActive()`（:341-364）为高亮单一来源：`teams` 激活 = `activeView==='teams'`（:356-358），不依赖 currentTeam；`all` 激活补 `!currentTeam && activeView!=='teams'`（:350-352）→ **Teams 激活时 All 不高亮**（BDD-38 Then）。
- 四维互斥 `selectTab`（:480-524）：每 tab 清零 owner/status/starred/team 后设自身，`team=me` 聚合经 `effectiveTeam` computed（:333-337）→ store 参数 `team:'me'`（BDD-38 spec :176 断言 objectContaining 命中）。
- URL 表达：`view=teams` / `team={slug}` 由 selectTab/selectTeamChip 写 updateURL（:522, :533）→ e2e BDD-38 URL 断言（team-visibility.spec.ts :96/:110）与 spec :182 均命中。
- **范围声明**：archived/All 既有双激活保留（P2 §5.1 明示非本任务范围）——实读 isTabActive archived（:359-361）在 status=archived 时返回 true 且 All 需 `!currentStatus` 才 true → 现状 archived 激活时 All 不同时激活？核对：`isTabActive('all')` 要求 `!currentStatus`，archived 时 currentStatus='archived' → All false、archived true——**实为单激活**；原 P2 声明"archived 时 All 仍激活的双激活保留"在旧实现即已不成立（旧模板 currentStatus==='archived' 激活 archived、All 需 !currentStatus）。实现忠实于**现状语义 + team 扩展**（未重构既有关系），无回归引入。判定：通过（该维度本为观察声明，未违背"不重构"约束）。

### 1.2 状态×URL 恢复收敛（BDD-41 / P2 §5.4）— approved
- **单一 restore**：三处漂移收敛为 `applyUrlToState()`（:664-730），setup 期同步执行（:748）+ onBeforeRouteUpdate（:787-796）+ watch(authState)（:751-759）三处调用同一函数。`restoreFromURL()` 旧函数已删除（diff -:98-123）。符合 P2 §5.4。
- **非法组合静默丢弃**：owner/status/archived 与 team/view 互斥——applyUrlToState 内 team 分支只设 currentTeam/unavailableTeam，不设 owner/status（且 :699-703 先清零 owner/status 再按 ownerParam/statusParam 设）；starred 优先返回（:689-696）。owner=me+team=x 场景：ownerParam='me' 设 currentOwner='me'，随后 teamParam 存在再设 currentTeam → **互斥矩阵外组合未显式清除 currentOwner**，但 currentTeam 一旦设置，effectiveOwner 仍返回 'me'（effectiveOwner = props.owner || currentOwner），effectiveTeam 返回 currentTeam（slug 优先于 'me'）→ loadEntries 同时带 owner=me + team=slug 到后端。核对：URL `owner=me&team=proj-a`（非 UI 生成，手工构造）→ 后端 `?owner=me&team=proj-a` 语义未在 P2 定义——**风险为真但触发面为"手工 URL + owner=me 与 team 并存"**；实际 UI 生成的互斥 URL 不会出现该组合。判为建议项（S4）而非 BLOCKER：BDD-41 只锁 `team ∉ myTeams → 不可用态`，该路径在 team 合法时仍会因 currentTeam 存在走 team 过滤，不可用态不受影响。
- **不可用态判定时序**（BDD-41 核心）：setup 同步 applyUrlToState；若 URL team 且 teamsLoaded 未 settle → `teamRestorePending=true`（:727），teamsLoaded watch（:732-745）settle 后按 isTeamMember 分流：成员 → currentTeam（正常），非成员 → unavailableTeam（不可用态）。
  - **待核窗口**：applyUrlToState 设 teamRestorePending=true 后返回，调用方 onMounted/load 均判 `!teamUnavailable`（此时 unavailableTeam=null → 真）→ **onMounted 对 pending 的非法 team 仍发一次 listEntries（team 参数 = currentTeam? 否 → effectiveTeam = activeView? 'all' → undefined）→ 实际发的是无 team 的全量列表请求**。该次请求结果（如 entries 非空）会在 teamsLoaded settle 前短暂显示全量内容，settle 后不可用态才覆盖。竞态窗口 = myTeams 加载时长（本地后端 <100ms，通常首帧前 settle；spec 用 mock 同步 settle 不暴露）。判为**建议项（S3）**：pending 时应跳过首次 loadEntries，待 settle 后统一（与 spec bdd41_unknown_team_slug 断言 "not.toHaveBeenCalled" 的意图一致）。非 BLOCKER：视觉瞬闪级，无状态破坏（settle 后不可用态终态正确，且 teamUnavailable computed 参与渲染门控）。
- **清空 CTA**：`clearTeamFilter()`（:536-543）清 currentTeam/unavailableTeam + 回 team=me 聚合 + URL 去 team → spec bdd41_clear_cta 断言命中。
- **三态文案归属**（P2 §5.2 表）：
  - teams 聚合空态 `teams-empty`：teamsEmptyVisible（:392-401）auth + view=teams + 无 chip + owned/joined 空 + entries 空 → heading「暂无团队内容」（:412）+ EmptyState 包 data-testid（:149-159）✓ spec bdd41_teams_aggregation :231
  - team 成员空态 `team-empty`：teamEmptyVisible（:383-390）→「该团队暂无内容」（:411）✓ spec :240
  - 不可用态 `team-unavailable` + CTA：:134-143，标题「团队不可用」+ desc「你无权访问该团队，或该团队不存在。」+ CTA「清除过滤」✓ spec :207-208；**不调 listEntries**（teamUnavailable 门控 :782-784, :793-795）✓ spec :209
  - 两文案可区分 ✓（「暂无团队内容」vs「该团队暂无内容」不同字串，BDD-41 Then）
- 匿名带 team/view：applyUrlToState 内 team/view 分支均需 `authenticated`（:714, :718）；匿名 → 不设 activeView/currentTeam → auth 门控后无恢复。✓ P2 §5.2「匿名带 team/view → 恢复忽略」。

### 1.3 /teams 管理页（BDD-42）— approved
- **双入口 DOM**：UserMenu `.menu-item-teams` + data-testid `user-menu-teams-item`（UserMenu.vue :8-13，v-show 常驻，navigateToTeams push('/teams') :63-66）；explore Teams tab 内 `teams-manage-link` router-link（EntryListView.vue :61，v-if teamsChipRowVisible）。两入口均在 Teams 视图触发后可达。✓ 防 /stars 无入口反模式。
- **owner 全操作**：新建（create-form/team-name-input/team-error）、重命名（team-rename-form/input）、删除（team-delete + ConfirmDialog 后果提示「该团队的所有内容将转为仅自己可见」（TeamsView :256）——BDD-42「含'内容将转为仅自己可见'后果提示」命中）、添加成员（team-member-username-input + team-error）、移除成员（team-member-remove-{username}，owner 不可自移除 v-if :86）、成员退出（joined 分区 team-leave-{slug} 确认）。✓
- **owner 不显示退出按钮**：joined 分区才有 team-leave；owned 分区卡无退出按钮（模板 :45-118 无 leave）。✓ BDD-42
- **三错误文案互异**：TeamsView 将后端 detail 原文透传（serverError :189-197 取 `response.data.detail ?? error.message`）；`team-error` 显示文案（:38/:72/:107 三处共用同一错误区 testid 但分属 create/rename/member 表单上下文——e2e 用 `.first()` 定位当前表单区）。文案互异性由**后端 team_service 的三条不同 message** 保证（username 不存在 404 / 已是成员 409 / 无权 404——均会经 serverError 呈差异化文案）。e2e teams-page.spec.ts :162-167 逐态断言 Set 大小 3。**判定**：前端透传逻辑正确；互异性成立依赖后端文案互异（review-eng 已 approved 后端，方案 A owner 读权含三文案），BDD-42 的文案互异断言 P6 实跑。✓
- **live region**：`teams-status-live` role=status（TeamsView :19）+ speak() 播报创建/删除/退出/成员操作（:213/:247/:260/:305/:318）。✓
- **成员即时可读无缓存窗口**：addMember 成功后 `teamMembers[slug] = detail.members`（:304）直接更新；store addMember upsertOwned 更新 memberCount。与 BDD-23 语义一致（服务端实时判定读权）。✓
- **建议项（S5）**：TeamsView `openDetail` 只对**第一个 owned team** 自动展开（watch owned :345-349），多 team 时其余成员列表靠手动「重命名」旁无展开入口——实读模板：team-card 内成员区**恒渲染**（无展开 gate），openDetail 由 watch owned 首卡触发填充 teamMembers[slug]；其余卡的 member list 因 `teamMembers[slug]?.length` 为空显示「暂无成员…」（:94）——**成员显示不完整**：非首卡成员实际存在但显示空。核对 store：owned 摘要含 memberCount，但列表区以 teamMembers 记录驱动。判定：owner 多 team 场景下非首卡成员列表空白，属 **needs-fix 级（功能正确性）**？——重看：watch 只触发一次（teams[0]），若用户点了另一卡无手动入口…实读 `startRename(team)` 仅重命名。**结论**：非首卡成员列表无加载入口 → 显示「暂无成员…」误导（与 memberCount>0 矛盾）。判为 needs-fix（F2 候选）——但 BDD-42 e2e 用单 team fixture，未暴露。设计 §5.5 描述「team 卡（管理 → 详情：成员列表…）」未定义逐卡展开交互——实现取「watch 首卡自动展开」不覆盖全卡。此项**建议 implementer 补逐卡 openDetail 触发（如卡片点击/展开按钮）或渲染时对全部 owned 卡 fetchDetail**；若 P1/P2 无逐卡断言则 P6 无法覆盖。降级为建议项 S5（非 BDD 锚点断言、单 fixture e2e 不红），但 P6 前应确认多卡体验。

### 1.4 卡片 toggle 守卫 + badge（BDD-39/40）— approved
- EntryCard：toggle 按钮 `v-if="!entry.teamId"` + data-testid `visibility-toggle`（:4-11）；v-else 渲染 `team-visibility-hint` span（:14-20，title「此内容为团队可见，请在编辑中调整」，aria-hidden，pointer-events:none）——**保持动作位宽、delete 保留**（:21-29 删除钮独立）。✓ spec bdd40 :79-81（visibility-toggle count=0 + delete 存在）
- EntryListRow：同构（:93-101 v-if !teamId + data-testid visibility-toggle；delete data-action=delete 保留 :104-112）。✓ spec bdd40 :76-78
- **store 守卫**：`entryList.ts toggleVisibility` 顶部 `if (entry.teamId) { toast warning '此内容为团队可见，请在编辑中调整'; return false }`（:46-50）——不发 API、不翻转乐观态。✓ BDD-40「UI 与守卫双保险」。spec entry-list-store-team 断言守卫（已转绿）。
- **badge 优先级 + 不叠加**：EntryCard footer badge 链（:106-114）：expired → archived → `v-else-if="entry.teamId"` team badge（label「仅团队可见 · {teamName}」+ badge-team + testid）→ v-else public/private——**team 分支独占，private/public 不渲染**。✓ spec bdd39 :63-67（无 badge-private/public）
  - EntryListRow badge 链（:82-90）：`v-else-if="entry.teamId && isOwner"` team → `v-else-if="isOwner"` public/private。**非 owner 不显示任何 badge**（P2 §5.2 badge 渲染声明：非 owner 列表项不显示可见性 badge）——EntryListRow 顶部 else 分支被 isOwner 门控，非 owner 落入无 badge。✓ 与 spec :37-49（owner）不冲突。
  - **不对称点（观察）**：EntryCard 的 team badge 分支**无 isOwner 门控**（`v-else-if="entry.teamId"`），EntryListRow 有（`entry.teamId && isOwner`）。但 EntryCard badge 区本身 `v-if="isOwner || isExpiredButActive"`（:65）→ 非 owner 非 expired 不进该区；**非 owner 且 expired 的 team entry**（他人 team entry + expired）→ 进 isExpiredButActive 分支显示 expired badge（不显示 team）——语义可接受（expired 优先于可见性）。owner 场景两视图一致。判定：无 BDD 违规（BDD-39 场景为 owner 视角列表同时含 team+private entry）。✓
- **色板**：badge team 用 `--c-badge-shared-bg` + `--c-warning`（BaseBadge :68-71；EntryDetailHeader/EntryMetaTagsBar .status-tag.team 同 token）——复用警示系既有 token，无新增 hex。✓ P2 §5.3 建议项命中。

### 1.5 detail 三态标签（BDD-44）— approved（载体偏离已由 DESIGN_GAP-1 覆盖）
- EntryDetailHeader :68-75：`v-if currentEntry?.teamId` → `.status-tag.team` 文案「仅团队可见 · {team?.name || team?.slug}」；v-else-if currentEntry → `.status-tag.public/private` Public/Private。EntryMetaTagsBar :7-17 同构。
- 三态：team 文案含「仅团队可见」+ team name、不含 Private；private→Private；public→Public。✓ spec bdd44（:135-149 三断言全命中，P4 转绿）。
- **DESIGN_GAP-1 判定**：P2 §5.8 指定载体 = BaseBadge team 变体复用（detail 与卡片同源），P3 spec 锁 `.status-tag` class → 实现保留 .status-tag 载体 + team 类扩展。**判定合理**：① P3 spec 断言 `.status-tag`（spec :112 定位）+ P3 spec 是已批准红灯基线，改 spec 即改基线（SCOPE+ 之外）；② 三态视觉一致性：.status-tag.team 与 badge-team 同 token 同色（--c-badge-shared-bg/--c-warning）；③ P2 §5.8「实现载体二选一（锁定前者）」的意图是 detail 与卡片视觉一致 + 三态可区分——保留 .status-tag 载体**不破坏意图**（视觉同 token）。非 BLOCKER。✓
- **注意点（视觉）**：`.status-tag` 原尺寸 font-size:10px 小字（与卡片 badge 的 --font-xs/4px 10px padding 不同形）——.status-tag.team 沿用 .status-tag 基样式（小 tag 形），与卡片 badge 形不同但同为警示色。三态内部一致（private/public 同小 tag 形）。判定：非 BLOCKER，P6 视觉复核项（S6）。

### 1.6 移动端 + a11y（BDD-43）— approved（2 建议项）
- `.owner-tabs` role=tablist + aria-label + @keydown.onTablistKeydown（:20）；5 tab 均 role=tab + aria-selected 布尔 + data-testid（:21-31）。✓ spec bdd43 :273-282 + e2e :181-187
- **键盘方向键**：onTablistKeydown（:551-571）←/→ 焦点移动 + selectTab（roving + 激活跟随）、Home/End 首末。P2 §5.6 锁定 tablist + 方向键方案命中（非 aria-pressed 最低限度）。✓
- **移动横滚**：.owner-tabs overflow-x:auto + scrollbar-width:none + ::-webkit-scrollbar display:none（:933-940）；tab min-height:44px + white-space:nowrap + flex-shrink:0（:1051-1055）。✓ e2e BDD-43 断言 overflow-x + height≥44（:192-202）
  - **建议项（S1）**：CSS 为 min-height:44px —— 若 padding 不足则实际高可 <44（min-height 只保证下限 → 实际 ≥44 恒真：内容高度 + min-height 取较大值，44px min-height 保证 ≥44）。核对：min-height 44 + 无固定 height → 渲染高 ≥44 成立（display:inline-flex + align-items:center，无 height 上限）→ 实际高 = max(内容高, 44) ≥ 44。**e2e 断言恒过**（无需 S1）。撤回建议。
  - **实质建议项（S1'）**：`focus-visible` 样式——owner-tab/team-chip/teams-manage-link/dropdown-item/menu-item-teams/TeamsView 新按钮均无显式 :focus-visible（项目 layout.css 既有按钮有 :focus-visible 先例）。审查设计规则「outline:none 有替代（accessibility）」——本实现未移除 outline（默认浏览器 focus ring 保留），不触发该违规；但新控件与既有控件焦点样式不一致。判建议项（非 BLOCKER，无 outline:none 裸删）。
- **FilterChip dismissLabel**：`dismissLabel` prop 默认 'Remove filter'（FilterChip :5-6），EntryListView 传「移除团队过滤：{teamName}」（:39）。✓ spec filter-chip-team（已转绿）。

### 1.7 AI Slop / 视觉 / token — approved
- **无紫色渐变/emoji/hex**：全改动用既有 `--c-*` token（.status-tag.team/.badge-team = --c-badge-shared-bg + --c-warning；tab active = --c-accent；team-chip active = --c-accent-surface 等）；无 emoji（`×` dismiss 为既有 FilterChip 字符，非新增）；新文案全中文描述性（「团队不可用」「仅团队可见」「该团队暂无内容」），无泛化营销文案（无 "Unlock the power" 类）。✓
- **布局层级**：teams 页沿用 Settings/Stars 层级（h1 + 分区 h2 + 卡）；explore 扩 tab/chips 在既有 toolbar 结构内，未新建 shell。✓
- **hover/focus/active**：新增交互控件均有 hover（team-chip/teams-manage-link/owner-tab 已有/新增、TeamsView primary-btn/link-btn 等复用既有样式）；tab active = accent + border-bottom。loading/error/empty 三态在 explore（既有 skeleton/error-state/EmptyState + 新增三态容器）与 teams 页（section-loading/error/live）均覆盖。✓
- **CSS 冒号/拼接卫生**：UserMenu.vue :197 `.menu-item-teams:hover { ... }.dropdown-enter-active {` —— 两规则拼接缺换行（功能合法，CSS 解析正确，但可读性差）；scoped CSS 内 `.menu-item-teams` 规则**重复定义两次**（:131-148 绝对定位版本 + :176-187 覆盖为静态版本）——**后者覆盖前者**（同特异性后者胜）：实际生效 = display:block + 无绝对定位 → Teams 按钮**在文档流内**（trigger 下方），而非定位下拉浮层。核对语义：v-show 常驻隐藏 + 点击 trigger 显示。trigger 在 header（.explore-actions flex），Teams 按钮 v-show 展开时插入 flow —— 因其在 .user-menu-wrapper (position:relative) 内且无 absolute → **展开时撑开 header**（把 Settings 下拉推到下方 36px 的绝对定位基于 wrapper）。这是 DESIGN_GAP-2/3 链的已知代价（「菜单跨容器布局，dropdown 用 calc 偏移对齐」）。**视觉风险**：Teams 按钮展开占据 trigger 下方 flow 空间 + dropdown 绝对定位于 `calc(100% + space-1 + 36px)` 硬编码 36px —— 若菜单项高/字号变化（如 admin badge、用户名换行）则 dropdown 与 Teams 按钮**错位**（硬编码偏移）。**判定**：功能可达（P3 spec + e2e BDD-42 通过：trigger→Teams 项可见→push /teams），布局为硬编码偏移 hack，非 BLOCKER 但列入 P6 视觉复核 + 建议项（S2）：将 Teams 按钮纳入 .user-dropdown 同容器（绝对定位浮层内）或改 flow 布局，去掉 36px 魔数。两处重复 .menu-item-teams 规则亦应合并（dead rule :131-148 被 :176-187 覆盖）。

### 1.8 data-testid 一致性（P2 §5.7）— **1 处 needs-fix（F1）**
- 逐项核对 §5.7 表：tab-all/mine/teams/archived/starred ✓、team-unavailable + clear ✓、teams-empty/team-empty ✓（包在 EmptyState 外层 div data-testid）、badge-team ✓、visibility-toggle ✓（两视图统一）、teams-owned/joined ✓、team-create-form/team-name-input/team-member-username-input/team-error/teams-status-live/user-menu-teams-item/teams-manage-link ✓、ConfirmDialog alertdialog ✓（复用，无独立 testid 亦可）。
- **F1（needs-fix）**：`team-chip-{slug}` **两处重复**——① filter-chip-bar 内 FilterChip（EntryListView :37-42，`currentTeam && currentTeamInfo` 时显示，语义=当前激活过滤 chip）；② teams-chip-row 内 team-chip 按钮（:51-60，v-for teamChips，语义=可选团队列表）。两元素同 data-testid `team-chip-{slug}` 时（点选 chip 后 filter-chip-bar 出现同名 chip，同时 teams-chip-row 仍在）→ 同页**两元素同 testid**。P2 §5.7 表定义 `team-chip-{slug}` 一次（FilterChip 容器）；实现为满足 e2e「点 chip 后 URL team={slug}」在 row 按钮复用同名 → **e2e BDD-38 :107 用 .first() 规避**（自认歧义）。修复：teams-chip-row 的按钮改独立 testid（如 `team-row-{slug}`）或 filter-chip 与 row 按钮择一保留 chip 态；需同步 e2e/spec 锚。判 needs-fix（testid 是稳定契约，同页重复违反 §5.7「testid 不变 + 定位用 testid」意图）。

### 1.9 DESIGN_GAP×5 + SCOPE+×2 判定 — 全部合理
| 标注 | 内容 | 判定 |
|---|---|---|
| DESIGN_GAP-1 | detail 三态载体 .status-tag（非 BaseBadge） | 合理（§1.5：P3 spec 锁 .status-tag + 同 token 视觉一致，意图不破） |
| DESIGN_GAP-2 | UserMenu Teams v-show 常驻（非 v-if 异步） | 合理（P3 spec :69 未 await 即断言 → v-if 渲染异步不满足；v-show 常驻 DOM 保 spec 通过） |
| DESIGN_GAP-3 | UserMenu 非 .dropdown-item class | 合理（UserMenu.spec 锁 .dropdown-item 精确 [Settings, Logout] 数组 + e2e t079/debug-server 锁 .dropdown-item 末项 Logout → 复用即破坏既有基线）——但**连带布局 hack（硬编码 36px calc）是设计代价，S2 建议项** |
| DESIGN_GAP-4 | searchUrl team/view 用 undefined 表达缺失（不拆函数） | 合理（旧 spec toEqual 精确对象忽略 undefined 属性 → 零回归；新 spec toHaveProperty/spread 感知键 → 双兼容。实测 searchUrl.logic.spec.ts :131-222 7+ 处 toEqual 无 team/view 键 → 若 null 表达破坏 → undefined 方案正确） |
| DESIGN_GAP-5 | applyUrlToState setup 期同步（URL 恢复从 onMounted 提前） | 合理（P3 spec mount 未 await 即断言不可用态 → 需首帧同步判定；与 §5.4「单一 restore 精神」一致，仅时机提前） |
| SCOPE+-1 | t093 遗留 4 tab → 5 tab | 合理（BDD-38 扩 tab 后遗留回归断言过时，改 1 行断言 + 补 tab-teams 存在断言，零逻辑改动） |
| SCOPE+-2 | P3 spec @ts-expect-error 失效清理 | 合理（P4 类型就位后 unused @ts-expect-error → vue-tsc CI 失败；删 15 处注释行零断言改动） |

### 1.10 一致性隐患核查（非 BLOCKER）
- **慢加载窗口 team chip 点击**：teamsChipRowVisible 需 showTabs（auth），chips 数据来自 myOwned/myJoined——但 store 未 settle（teamsLoaded=false）时 teamChips 为空数组（无 chips 可点）→ 仅 Teams tab 可点（触发 ensureMyTeamsLoaded + loadNow team=me）→ team=me 先发，settle 后无 chip 态（无二次 load 必要：team=me 结果即聚合）。**当前实现无二次请求问题**（chips 未 settle 前不可点）。仅 URL 直接带 team=slug 且 teamsLoaded=false 走 pending 路径（S3 已述，首次 load 时机问题）。撤回先前「二次 load」疑虑——因 chips 依赖 myTeams 数据本身，未 settle 时无 slug 可点。✓
- **auth logout 未 reset team store**（S7 建议项）：handleLogout（:593-601）清 currentTeam/activeView，但**不调 teamStore.reset()**；auth.ts logout（:48-51）亦无 reset 钩子 → 登出后 myOwned/myJoined/teamsLoaded 残留 → 另一账号登录（同 SPA 会话）explore 加载时 teamsLoaded=true（残留）→ URL team 恢复走「已 settle」分支用**上一账号的 myTeams 判定** → 新账号首次进入可能误判不可用态/误显示上账号 team chips（teamsLoaded 残留 true，chips 显示上账号 owned/joined 直到 loadMyTeams 覆写）。核对：登出后新账号在 explore mount 时 `ensureMyTeamsLoaded()` 因 teamsLoaded=true 不触发 → **loadMyTeams 不会被调** → explore 页持续显示上账号 teams（跨账号数据泄漏显示风险）。watch(authState) 登出分支（:760-776）清 currentTeam 但不 reset store。**判定：需 fix（跨账号会话残留 myTeams 快照，explore chips/不可用态判定用错账号数据）**——但 P1/P2 §5.5 动作清单②「登出清零——auth 登出时 myTeams=[]」**明确要求**登出清零。实读 auth.ts logout 无 teamStore 引用（入口在 UserMenu handleLogout + EntryListView handleLogout emit）——EntryListView handleLogout 未调 teamStore.reset()。**此项违反 P2 §5.5-②** → 列 needs-fix（F2）。验证：登出→匿名（EntryListView 仍在）watch(authState) 登出分支重置本地态但 store.myTeams 残留 → 匿名时 explore 不显示 chips（showTabs false）→ 再登录另一账号：watch(authState) auth 分支 applyUrlToState + ensureMyTeamsLoaded（teamsLoaded 残留 true → 不加载）→ **旧账号 teams 数据在新账号可见**（chips row 出现条件 showTabs+activeView==='teams'；若新账号点 Teams tab：teamChips = 残留旧数据 → 显示旧账号团队 + 可点 chip → isTeamMember 判定也基于旧数据 → 误判）。**确认 F2 为真实缺陷**（P2 §5.5-② 明示登出清零，实现遗漏 store.reset）。

## 2. 问题清单

### needs-fix（F 级，非 BLOCKER）
- **F1 [testid 冲突]** EntryListView `team-chip-{slug}` 同页双元素（filter-chip-bar FilterChip + teams-chip-row 按钮），e2e :107 用 .first() 规避。Fix：row 按钮独立 testid（如 `team-row-{slug}`）或二择一，同步 spec/e2e 锚。
- **F2 [跨账号残留]** 登出未调 `teamStore.reset()`（P2 §5.5-②「登出清零 myTeams=[]」未实现）：myOwned/myJoined/teamsLoaded 残留 → 新账号登录 explore 显示上一账号 team chips / URL team 恢复误判（isTeamMember 基于旧数据）。Fix：EntryListView handleLogout（:593-601）与 UserMenu handleLogout（:68-72）登出路径补 `useTeamStore().reset()`；或 auth store logout 内建 reset 钩子（后者更稳，覆盖所有登出入口）。

### 建议项（S 级，P6 视觉复核 / 后续技术债）
- **S1 focus-visible 一致性**：新增交互控件（owner-tab 迁移、team-chip、teams-manage-link、menu-item-teams、TeamsView 按钮/表单）无显式 :focus-visible（项目 layout.css 既有按钮有先例）。未删 outline（无违规），但建议补全（若既有全局 focus ring 已覆盖按钮则豁免——待 P6 实测键盘导航）。
- **S2 UserMenu 布局 hack**：.menu-item-teams 规则重复定义（绝对定位版 :131-148 被静态版 :176-187 覆盖，dead rule）+ .user-dropdown `top: calc(100% + space-1 + 36px)` 硬编码 36px 对齐 Teams 按钮高度——菜单内容变化即错位。Fix：合并重复规则 + 同容器浮层或取消硬编码偏移。
- **S3 pending 首次 load**：teamRestorePending=true 时 onMounted/route-update 仍发一次无 team 的全量 loadEntries（unavailableTeam 未 settle 前为 null → 门控放行）。Fix：pending 时跳过首次 load，settle 后统一触发（与 BDD-41「不可用态判定在 settle 后」意图一致）。竞态窗口 = myTeams 加载时长，通常首帧前 settle → 非 BLOCKER。
- **S4 owner=me+team 并存**：手工 URL `owner=me&team=x` 时互斥矩阵未清 currentOwner → loadEntries 同时带 owner+team。UI 生成路径不会出现；Fix：applyUrlToState team 分支清 owner/status。
- **S5 TeamsView 多卡成员列表**：openDetail 仅 watch owned[0] 自动填充；多 owned team 时非首卡成员区显示「暂无成员…」但 memberCount>0（无逐卡加载入口）。单 fixture e2e 不红；Fix：每卡展开/点击触发 fetchDetail 或全卡预取。
- **S6 detail .status-tag.team 视觉形**：与卡片 badge-team 不同形（10px 小 tag vs badge 形），同色不同形——P6 视觉复核三态/卡片一致性。
- **S7 parseRestoreQuery 成为 dead export**：EntryListView 不再调用（改 applyUrlToState 直读 URLSearchParams），函数仅被 spec 消费——保留作纯逻辑单测面可接受；若清理需同步旧 spec（非本批范围）。

## 3. 结论

无 BLOCKER（无数据安全/功能主线/BDD 断言违背）。DESIGN_GAP×5 + SCOPE+×2 全部判定合理。F1（testid 同页重复）+ F2（登出未 reset team store，违反 P2 §5.5-②）需 implementer 定向修复后转 approved；建议项 S1-S6 留 P6 视觉/键盘复核或技术债登记。

**gate status: needs-revision**（计入重试；修复范围仅 F1+F2，改动小）

---

## rev1 复审（F1/F2 修复核验，2026-09-02）

> 复审对象：EntryListView.vue teams-chip-row testid 改独立 `teams-chip-{slug}`；stores/auth.ts logout() + peekview:auth-expired 内建 useTeamStore().reset()；新增 2 自检 spec（F1/F2 各 2 用例，4 用例全绿——实测 vitest 4 passed）。
> 状态标记：[PROD_NOT_TOUCHED]（只读复审，未改代码）

### F2 判定 — 修复正确 ✅
- auth.ts logout（:49-55）：`api.logout(); user=null; useTeamStore().reset()` —— reset 清 owned/joined/loading/teamsLoaded/error（team.ts :15-21）。单点覆盖 UserMenu.handleLogout → emit → EntryListView.handleLogout → authStore.logout 链；LandingView 等任何调 auth.logout 的入口同覆盖。✓ P2 §5.5-②
- peekview:auth-expired handler（:72-78）：401 过期自动登出场景同 reset。✓
- **无 import 环**：auth.ts → team.ts → api/client.ts；team.ts 不反向 import auth → 无 cycle。✓
- **无 spec 回归**：预存 entry-store-auth.spec.ts（15 用例，含 auth-expired 三断言）实测全绿——新增 teamStore.reset() 在其 harness 下不抛（setActivePinia 存在）。✓
- **边界核对**：reset() 也清 teamsLoaded=false → 新账号登录后 ensureMyTeamsLoaded 因 teamsLoaded=false 重新 loadMyTeams → 无残留误判。✓
- F2 自检 spec（stores/__tests__/tpv0095-review-fix.spec.ts）：owned/joined 清空 + isMemberOf 复位两断言，覆盖核心语义。✓

### F1 判定 — 组件层修复正确，但 **P3 e2e 锚点被孤儿化（新 F3）** ⚠️
- EntryListView.vue :57 row 按钮 testid = `teams-chip-{slug}`；:40 FilterChip 保留 `team-chip-{slug}`（选中态 chip）。两 testid 互异，**同页双元素冲突已消除**。✓ 组件层（F1 原义）修复正确。
- F1 自检 spec（views/__tests__/tpv0095-review-fix-entry-list.spec.ts）f1_row_button_and_selected_filter_chip_do_not_share_testid：点 row → FilterChip `team-chip-proj-a` 与 row `teams-chip-proj-a` 同存且 testid 互异——断言准确。✓
- **F3（新 needs-fix）— e2e 锚点孤儿化**：P3 e2e `team-visibility.spec.ts` BDD-38 chip 用例（:99-112）仍锚 `[data-testid="team-chip-proj-a"]` 并在**首次加载 `/explore?view=teams`** 时定位——修复后首次加载只有 row 按钮 `teams-chip-{slug}`（FilterChip `team-chip-{slug}` 仅在选中后出现），故该用例 waitForSelector `.catch(()=>{})` + `if(count>0)` 双重守卫 → **count=0 → 静默跳过，断言永不执行**。该用例是「点 chip → URL 反映 ?team={slug}」（BDD-38 URL 表达）**唯一**实跑锚点（P3 单测 entry-list-view-teams.spec 只断 team=me 聚合，不断 chip 点击 URL；review-fix spec 只断 DOM testid 互异不断 URL）。修复：e2e :106-107 锚点改 `[data-testid="teams-chip-proj-a"]`（row 按钮）；同时 :9 注释的 §5.7 testid 清单表意（team-chip-{slug} 为 FilterChip 选中态）建议同步注记 `teams-chip-{slug}` 行按钮语义，避免后续再混。
- 波及面核对：e2e teams-page.spec.ts 无 team-chip/teams-chip 锚（只断双入口/管理链接）→ 不受影响；P3 entry-list-view-teams.spec / search-url spec 均未锚 row chip → 不受影响。**仅 team-visibility.spec.ts BDD-38 chip 用例需改 1 行锚点。**

### rev1 结论
- F1 组件层修复正确、F2 修复正确且无新引入问题（无环、无 spec 回归、reset 语义完整）。
- **新 F3**：P3 e2e BDD-38 chip 用例锚点孤儿化（静默 no-op → BDD-38 URL 表达实跑覆盖丢失）。改动极小（e2e :106-107 锚点 team-chip-proj-a → teams-chip-proj-a），修复后转 approved。
- 建议项 S1-S6 维持（P6 视觉/键盘复核或技术债），不阻断。

**gate status: needs-revision**（rev1；修复范围 = e2e team-visibility.spec.ts BDD-38 chip 用例锚点 1 行）

---

## rev2 复审（F3 修复核验，2026-09-02）— **approved**

> 复审对象：frontend-v3/e2e/team-visibility.spec.ts :106-107 chip 锚点 `team-chip-proj-a` → `teams-chip-proj-a`（主 Agent 最小修复，1 行 selector）。
> 状态标记：[PROD_NOT_TOUCHED]（只读复审，未改代码）

### F3 判定 — 修复正确 ✅
- diff 核验：:106 waitForSelector 与 :107 locator 均改为 `[data-testid="teams-chip-proj-a"]`，与 EntryListView.vue :57 row 按钮 testid 一致。✓
- **语义正确性**：该用例在**首载** `/explore?view=teams` 定位 chip → teams-chip-row 在 view=teams + showTabs（auth）时即渲染 row 按钮（含 teams-chip-proj-a，前提 myTeams settle 含 proj-a）→ 锚点现指向首载即存在的元素，click → selectTeamChip → URL `?view=teams&team=proj-a` → waitForURL `/team=proj-a/` 可命中。用例不再静默 no-op，BDD-38「点 team chip 后 URL 反映 ?team={slug}」实跑覆盖恢复。✓
- **残余核对**：全 e2e 仅余 :9 注释 `team-chip-{slug}`（§5.7 清单原义 = FilterChip 选中态，非锚点引用，无害）；无其它首载错误锚点。✓
- **时序说明（记录，非阻断）**：首载 row 按钮出现依赖 myTeams settle（GET /teams 返回且含 proj-a）；e2e ensureTeamEntry 先建 proj-a team entry + login 后 goto，myTeams 加载 <首帧后短暂窗口 → waitForSelector timeout 10s 覆盖。若 myTeams 未 settle 时 row 尚缺，waitForSelector 等待至出现（非 .catch 吞掉即不会 no-op——catch 仅防 404 环境差异，settle 后必出现）。✓

### rev2 总结论
- F1（组件 testid 去重）/ F2（登出 reset myTeams）/ F3（e2e 锚点对齐）三修复全部核验正确，无新引入问题。
- DESIGN_GAP×5 + SCOPE+×2 全部判定合理（见 §1.9）。
- 无 BLOCKER、无未决 needs-fix；建议项 S1-S6 维持为 P6 视觉/键盘复核或技术债（不阻断）。

**gate status: approved**（design-review 前端评审通过；P4 推进条件满足）
