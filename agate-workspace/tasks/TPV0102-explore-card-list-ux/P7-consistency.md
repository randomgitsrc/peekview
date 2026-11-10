---
phase: P7
task_id: TPV0102
type: consistency
parent: P2-design.md
trace_id: TPV0102-P7-20261111
status: approved
created: '2026-11-11'
agent: consistency-reviewer
blocker_count: 0
deviation_count: 2
deviation_critical_count: 0
design_gap_count: 13
design_gap_reviewed_count: 13
prod_touched: false
design_gaps:
- id: DG1
  text: useRelativeTime.update() 由「仅 onMounted 内调用」改为「setup 内同步调用 + onMounted 只挂定时器」；P2
    §3.4 未规定初始化时机，副作用是脱离组件上下文时 Vue 打 2 条无实例告警
- id: DG2
  text: VisibilityMenu 的 item 类型用本地 VisibilityItem({kind}) 而非 VisibilityTarget 联合体；P2
    §3.5「Team 入口不带 onSelect」+ P3 断言 teamItems[0] 不含 teamSlug，窄类型是唯一同时满足两者的形状
- id: DG3
  text: Teleport 只对 sheet 变体启用，icon/inline 就地 position:absolute；P2 只强制 sheet Teleport，icon/inline
    的裁剪面改由父容器去 overflow:hidden + 首末行 border-radius:13px 解除
- id: DG4
  text: tpv0095-entry-list-store-team.spec.ts 首条用例改名 rejects_… → now_allows_…；P2 §6.4
    第 4 项只规定断言更新未规定用例名
- id: DG5
  text: EntryCard/EntryListRow 的 changeVisibility 载荷定为 {entry, target} 对象；P2 §1.1
    D9 只给事件名未定载荷形状，带 entry 免去父层按 slug 反查
- id: DG6
  text: EntryListView 用 isVisibilityPending(slug) 函数读 entryStore.inFlight 而非模板链式访问；既有视图
    spec 的 store mock 不含 inFlight 键，P2 §3.7 未涉及 disabled 取值来源
- id: DG7
  text: teamsFailed 由 teamStore.error !== null 派生，而 stores/team.ts 的 loadMyTeams catch
    只置 error 不置 teamsLoaded，故失败后每次 ensureMyTeamsLoaded() 都会重试（请求风暴）；本批按 P2 原样实现，store
    不在本批范围
- id: DG8
  text: VisibilityMenu 详情页两处加 v-if=currentEntry && isOwner；teamStore 的 owned/joined/error/teamsLoaded
    经 storeToRefs 后加 ?? [] 容错，以兼容 t067/t031 把 storeToRefs mock 成只挑 .value 键的写法
- id: DG9
  text: EntryDetailHeader/EntryMetaTagsBar 的 teams/teamsFailed/isOwner/variant/disabled
    全给默认值成为可选 prop；P2 §3.7 写成必填，但 T079-entry-detail-header.spec.ts 不在 §6.4 更新面内
- id: DG10
  text: EntryDetailContent.vue 的 EntryMetaTagsBar 未接 @confirm-cancel；VisibilityMenu
    内部已重开菜单 + nextTick 还焦点，P2 §3.5 D-10 的父层职责由组件自身完成
- id: DG11
  text: upgrading.md 新节标题版本对自定为 v0.26.1 → v0.27.0（minor）；P2 §1.1 E2 只说「追加一节（按版本号）」未指定目标版本，选
    minor 因本任务含破坏性变更（P1 I-18）
- id: DG12
  text: 'upgrading.md 新节引入三条既有节没有的 #### 四级标题（谁会受影响/为什么改/怎么迁移）；v0.21.0→v0.22.0 节只用
    ###，下沉一级使三件要件成为「破坏性变更」的子结构'
- id: DG13
  text: F-1 采用 review 备选 ②（去 .entry-panel 的 overflow:hidden）而非推荐 ①（icon/inline 也 Teleport）；VTU
    2.4.10 wrapper.find 不穿透 Teleport，选 ① 会一次性打断 7 个已通过 spec
design_gap_reviews:
- gap: DG1
  verdict: accepted
  checked_against:
  - P2 §3.4
  - P3 §6.2
  - P1 BDD-02
  basis: in_bdd
- gap: DG2
  verdict: accepted
  checked_against:
  - P2 §3.5
  - P1 BDD-18
  basis: in_bdd
- gap: DG3
  verdict: accepted
  checked_against:
  - P2 §3.5
  - P2 §3.8
  - P4-review-design F-1
  basis: in_bdd
- gap: DG4
  verdict: accepted
  checked_against:
  - P2 §6.4
  basis: out_of_scope
- gap: DG5
  verdict: accepted
  checked_against:
  - P2 §1.1 D9
  - P1 BDD-27
  basis: in_bdd
- gap: DG6
  verdict: accepted
  checked_against:
  - P2 §3.7
  - P1 BDD-24
  basis: in_bdd
- gap: DG7
  verdict: accepted
  checked_against:
  - P2 §3.5
  - P2 §3.7
  - P2 §7.1 S3
  basis: out_of_scope
- gap: DG8
  verdict: accepted
  checked_against:
  - P2 §3.7
  basis: out_of_scope
- gap: DG9
  verdict: accepted
  checked_against:
  - P2 §3.7
  - P2 §6.4
  basis: out_of_scope
- gap: DG10
  verdict: accepted
  checked_against:
  - P2 §3.5 D-10
  - P1 BDD-19
  basis: in_bdd
- gap: DG11
  verdict: accepted
  checked_against:
  - P2 §1.1 E2
  - P1 I-18
  - P8 bump 范围
  basis: out_of_scope
- gap: DG12
  verdict: accepted
  checked_against:
  - P2 §1.1 E2
  basis: out_of_scope
- gap: DG13
  verdict: accepted
  checked_against:
  - P2 §3.5
  - P4-review-design F-1
  basis: in_bdd
scope_resolved:
- id: TPV0102:P1-requirements:SP1
  note: 'P4 第 188 行 [SCOPE+]：t031-entry-card.spec.ts / t031-entry-list-row.spec.ts
    的 BDD-7 用例因 D7/D9 事件改名连带失效，P2 §6.4 的 11 项更新面未列。判 resolved——implementer 按「覆盖点不删、只改定位与断言」处理（P4
    表 #6/#7），用例覆盖点未减少、弱断言反而收紧为精确断言，不改功能语义，无需回补 P1 基线'
- id: TPV0102:P1-requirements:SP2
  note: P4 第 305 行 [SCOPE+]：CHANGELOG 变更 第 4 条（详情页 .status-tag 可见性文案消失 + overflow
    菜单四项移除）源自 P2 §12 裁决 1 与 §1.1 D8，P1 四项需求未单列。判 resolved——属第 3 项需求（可见性入口改下拉菜单）的文档连带面，P1
    原文已含「入口改下拉菜单」语义，未扩展验收范围，无需回补 P1 基线
findings:
- id: F1
  severity: note
  text: 既有视觉债：卡片长标题末尾被右上 hover 操作区覆盖。pre-task 2b382c9c 的 .card-actions 60px/覆盖 332px
    → 本任务 48px/覆盖 211px，减轻 121px。不在任何 BDD/VC 判据内
  status: deferred
  resolution: 登记为既有债，转 P8/roadmap 独立任务收口；本任务为减轻而非引入，不得记为本任务缺陷
  evidence: P6.5-judge-verdict.md 观察 3(a) + P6-evidence/logs/bdd-28-title-overlap-measure.log
- id: F2
  severity: note
  text: 既有缺陷：BaseBadge 的 label 在 setup 期求值一次，可见性切换后文字 stale（class/颜色已正确，刷新才对）。该文件本任务零改动
  status: deferred
  resolution: 登记为既有债，转 roadmap 独立任务（BaseBadge label 改 computed）；不阻断 BDD-20（其 Then
    判的是状态非徽章文字）
  evidence: P6.5-judge-verdict.md 观察 3(b) + P6-evidence/logs/bdd-20-basebadge-label-stale.log
    + git log BaseBadge.vue 无本任务提交
- id: F3
  severity: note
  text: P1 判据瑕疵：BDD-25 后半条对有文件 entry 不可测——entryDetail.loadEntry 恒把 activeFile 置为 files[0]（stores/entryDetail.ts:49-53）、selectFile
    也不置空 ⇒ empty-select-file 对「有文件的 entry」不可达
  status: deferred
  resolution: P4-rev2/P6 已改为「0 文件文案 ≠ EMPTY_SELECT_FILE_TEXT + 有文件 entry empty-no-files
    count=0」等价判据并 PASS；P1 原文不改（P7 只读），留待 P1 判据回归时修正
  evidence: P6.5-judge-verdict.md BDD-25 PASS 行 + stores/entryDetail.ts:49-53 源码核对
- id: F4
  severity: note
  text: P2 判据瑕疵：VC-5「时间主显与 @username 基线对齐」的 <=2px 在几何上不可满足——280px 卡宽 + 207px 绝对时间下
    en-US 桌面 20/20 卡都换行
  status: deferred
  resolution: 本任务改由形态/文本判据（BDD-01/02）承担，VC-5 未作为 P5/P6 门禁；留 P2 判据回归时改「同行或换行皆可」
  evidence: P2-design.md:892 VC-5 定义 + P6.5-judge-verdict.md 观察 4
- id: F5
  severity: note
  text: 派发单与实际协议不一致 2 处：① 角色定义路径写 assets/review-roles/consistency-reviewer.md，实际在
    assets/execution-roles/；② 派发单称 DESIGN_GAP 18 条，gate 权威口径实测 13 条（宽松 grep 把 4 处节标题
    + 1 处表格引用一并计入）
  status: resolved
  resolution: 以 gate 脚本口径为准：design_gap_count 取 13（= P4 行首声明数）；角色文件改从 execution-roles
    读取并在此登记
  evidence: agate_common.count_design_gap allow_blockquote=False = 13；grep 行首正则 =
    13；ls assets/execution-roles/ 含 consistency-reviewer.md
- id: F6
  severity: note
  text: 'P4 frontmatter packages: [peekview] 与其实际改动面不符——P4 提交 d8adbec7 实际触及 backend(6)
    + frontend-v3(28) + docs(1)；P1/P2 均正确声明三包'
  status: resolved
  resolution: 不影响 P8 bump 范围（以 P1/P2 三包为准，P8 需同步 bump peekview 版本 + CHANGELOG + upgrading
    节）；P4 声明缺漏登记，不要求回改（P7 只读）
  evidence: git show --name-only d8adbec7 按顶层目录计数 = backend 6/frontend-v3 28/docs
    1；P1:19-22 与 P2:11-14 均为三包
- id: F7
  severity: note
  text: P2 §3.3 标题写「16 个叶响应模型的基类替换」并列出 15 个类名（代码实测 class X(UtcSerializeMixin) = 15），标题数字与清单不一致（清单本身正确）
  status: resolved
  resolution: 以清单与代码为准（15 个 + ShareCreateResponse 经继承 = 16 个覆盖点），语义等价，不构成实现偏差
  evidence: grep UtcSerializeMixin 子类 backend/peekview/models.py = 15
- id: F8
  severity: note
  text: 既有 store 行为：stores/team.ts 的 loadMyTeams catch 分支只置 error 不置 teamsLoaded，失败后
    ensureMyTeamsLoaded() 每次触发都会重试（潜在请求风暴）。对应 DG7，本批按 P2 原样实现、未修 store
  status: deferred
  resolution: 转 roadmap/tech-debt 独立任务（catch 里补置 teamsLoaded 或加重试上限）；P7 无 tech-debt.md
    写权限，故不以 followup:DEBT 声明，改由 P8 决定登记去向
  evidence: P4-implementation.md DG7（第 184 行）+ stores/team.ts catch 分支只置 error
---

<!-- BODY -->

# P7 一致性审查 — TPV0102：Explore 卡片列表体验修正

**结论：PASS。** `[BLOCKER]` = 0 条，`[DEVIATION-CRITICAL]` = 0 条。
13 条 `[DESIGN_GAP]`（= P4 实际行首声明数）全部转抄 + 配对 `[DESIGN_GAP_REVIEWED]`；
2 处 `[SCOPE+]` 均判 `resolved` 并已回写 P1 `scope_resolved`；
4 条既有债/判据瑕疵 + 4 条本次发现的口径偏差全部记入 `findings`。

> **审查范围**：`P1-requirements.md` / `P2-design.md` / `P4-implementation.md` / `P4-review.md` /
> `P6-acceptance.md` / `P6.5-judge-verdict.md` / `known-failures.md` + 仓库实际代码
> （`git show d8adbec7`、`backend/peekview/models.py`、`frontend-v3/src/**`）。
> 本文件只读审查，除 `P1-requirements.md` 的 `scope_resolved` 外未改动任何被审查文件。

---

## 0. 关键口径纠偏（先说结论，因为它决定了全部计数）

派发单称 `P4-implementation.md` 里 `[DESIGN_GAP` **共 18 条**。**实测为 13 条**，差 5 条来自
宽松 grep 的假阳性：

| 匹配方式 | 条数 | 说明 |
|---|---|---|
| `grep -c "\[DESIGN_GAP"`（派发单口径） | **18** | 含 4 处二级节标题 + 1 处表格单元引用 |
| `grep -cE '^\s*-?\s*\[DESIGN_GAP:'`（gate 口径） | **13** | 行首声明，真条目 |
| `agate_common.count_design_gap(..., allow_blockquote=False)` | **13** | 与上行一致，gate 实际调用 |

被排除的 5 处**不是** gap 条目：
- 第 119 / 178 / 223 / 297 行 = 四个批次节里的**小节标题**
  `### 实现中自主决策（[DESIGN_GAP] 候选，供 P7 核对）`——注意是中括号无冒号的 `[DESIGN_GAP]`；
- 第 326 行 = `[rev1-fix]` 改动文件表里的**表格单元**（`第 3 条 [DESIGN_GAP] 记述改为与代码一致（F-7）`），
  是对既有条目的引用，不是新条目。

**13 条的真实分布**（与派发单表格的「5/4/3/3/3」也不同，实际是「4/3/3/2/1」）：

| 节 | 条数 | P4 行号 | 对应 DG |
|---|---|---|---|
| `[frontend-shared]` | 4 | 121–124 | DG1–DG4 |
| `[mount-explore]` | 3 | 180 / 182 / 184 | DG5–DG7 |
| `[mount-detail]` | 3 | 225 / 227 / 229 | DG8–DG10 |
| `[docs-changelog]` | 2 | 299 / 301 | DG11–DG12 |
| `[rev1-fix]` | 1 | 330 | DG13 |
| **合计** | **13** | | |

> 为什么必须纠偏：本任务 `task_level = 2`，P7 gate 走**成对声明聚合**判据
> （`check-gate.py::_gate_p7_structured`），它校验 `design_gaps` 的 id 集合与
> `design_gap_reviews` 的 `gap` 集合**相等**。若按派发单写 18，则 18 ≠ 13 → gate exit 1。
> 已实测：按 13 声明的 dryrun 副本跑 `check-gate.py P7` → **exit 0**。

---

## 1. DESIGN_GAP 逐条转抄与判定

判定口径：`verdict ∈ {accepted, rejected, followup}`、`basis ∈ {in_bdd, out_of_scope, followup:DEBT<n>}`
——这是 gate 脚本的枚举校验（派发单里写的 `needs-fix` / `implementation_detail` / `not_in_scope`
**都不在枚举内**，直接写入会 exit 1）。全部 13 条均为 `accepted`：每条都是实现期在
P2 未规定处做的**收窄性或等价性**选择，无一条改变 P1 的 30 条 BDD 行为语义。

### DG1 — `useRelativeTime.update()` 初始化时机
[DESIGN_GAP: `useRelativeTime.update()` 由「仅 onMounted 内调用」改为「setup 内同步调用 + onMounted 只挂定时器」]
[DESIGN_GAP_REVIEWED: DG1 → accepted；checked_against = P2 §3.4 / P3 §6.2 / P1 BDD-02；basis = in_bdd]
P2 §3.4 只规定 `formatRelativeTime` / `formatFullDate` / `formatTooltip` 的**输出契约**，未规定
`update()` 的**调用时机**。P3 的 `useRelativeTime.spec.ts` 在无组件实例时直接读 `absolute.value`，
且组件 setup 首帧即渲染文本 → setup 同步调用是唯一能满足二者的时机。副作用仅为脱离组件上下文时
Vue 打 2 条 `onMounted/onUnmounted` 无实例告警（stderr，不影响断言）。**判 accepted。**

### DG2 — `VisibilityMenu` 的 `item` 用窄类型
[DESIGN_GAP: `VisibilityMenu` 的 `item` 类型用本地 `VisibilityItem({kind})` 而非 `VisibilityTarget` 联合体]
[DESIGN_GAP_REVIEWED: DG2 → accepted；checked_against = P2 §3.5 / P1 BDD-18；basis = in_bdd]
P2 §3.5 明写「Team 入口自身不带 `onSelect`」，P3 的 `visibility-menu.spec.ts` 又断言
`JSON.stringify(teamItems[0])` 不含 `teamSlug`。用不含载荷的窄类型是**同时**满足这两条的唯一形状；
`visibility-options.ts` 同时导出两者，未丢类型信息。**判 accepted。**

### DG3 — Teleport 只对 `sheet` 变体启用
[DESIGN_GAP: Teleport 只对 `sheet` 变体启用，`icon`/`inline` 就地 `position:absolute`；裁剪面改由父容器去 `overflow:hidden` 解除]
[DESIGN_GAP_REVIEWED: DG3 → accepted；checked_against = P2 §3.5 / P2 §3.8 / P4-review-design F-1；basis = in_bdd]
P2 §3.5 只**强制** `sheet` 走 Teleport 以规避 `.entry-panel{overflow:hidden}` 裁剪，未禁止
`icon`/`inline` 就地渲染。实现改为「父容器不再设 `overflow:hidden`，圆角裁切由首/末行
`border-radius:13px` 自理」——已代码核实 `EntryListView.vue:1154-1168` 的 `.entry-panel` 确无
`overflow`，且首/末行有 13px 圆角规则。P4-review-design 的 F-1 正是这一取舍，`rev1-fix` 节
给了实测（`panelOverflow=visible`、浮层超出 `panelBottom` 88px 仍可点击）。**判 accepted。**

### DG4 — store spec 首条用例改名
[DESIGN_GAP: `tpv0095-entry-list-store-team.spec.ts` 首条用例改名 `rejects_…` → `now_allows_…`]
[DESIGN_GAP_REVIEWED: DG4 → accepted；checked_against = P2 §6.4 第 4 项；basis = out_of_scope]
P2 §6.4 第 4 项只要求「断言更新为团队 entry 正常发起请求」，未规定用例名。改名是避免名实不符的
纯文本变更，覆盖点未减（P4 §既有断言显式取代 已列原/新断言对照）。**判 accepted（out_of_scope：属命名细节，不在 P1 BDD 面）。**

### DG5 — `changeVisibility` 载荷形状
[DESIGN_GAP: `EntryCard`/`EntryListRow` 的 `changeVisibility` 载荷定为 `{entry, target}` 对象而非仅 `target`]
[DESIGN_GAP_REVIEWED: DG5 → accepted；checked_against = P2 §1.1 D9 / P1 BDD-27；basis = in_bdd]
P2 §1.1 D9 只给了事件名 `@change-visibility` 未定载荷。视图层 `handleVisibilityChange` 需要那份
entry 引用去调 `setVisibility(entry, target)`；只传 `target` 则父层须按 slug 反查，多一次查找且
易与列表刷新竞态。**判 accepted。**

### DG6 — `isVisibilityPending(slug)` 容错读 `inFlight`
[DESIGN_GAP: `EntryListView` 用 `isVisibilityPending(slug)` 函数读 `entryStore.inFlight` 而非模板链式访问]
[DESIGN_GAP_REVIEWED: DG6 → accepted；checked_against = P2 §3.7 / P1 BDD-24；basis = in_bdd]
既有视图 spec（`t031-entry-list-view` / `tpv0095-entry-list-view-teams`）的 store mock 不含
`inFlight` 键，模板里 `entryStore.inFlight.has(...)` 会在渲染期抛异常。P2 §3.7 只要求「下发
teams/variant/teamsFailed」，未涉及 `disabled` 的取值来源。函数封装是防御性等价实现，不新增
行为分支。BDD-24 的「只发 1 个 PATCH」判据仍由 store 侧 `inFlight.has(slug)` 早退保证。**判 accepted。**

### DG7 — `teamsFailed` 派生导致失败后重试
[DESIGN_GAP: `teamsFailed` 由 `teamStore.error !== null` 派生，而 `stores/team.ts` 的 `loadMyTeams` catch 只置 `error` 不置 `teamsLoaded`，故失败后每次 `ensureMyTeamsLoaded()` 都会重试]
[DESIGN_GAP_REVIEWED: DG7 → accepted；checked_against = P2 §3.5 / P2 §3.7 / P2 §7.1 S3；basis = out_of_scope]
P2 §3.5 的 prop 语义确实如此，实现按 P2 原样落地。**但这暴露了既有 store 的一个真实缺陷**
（失败后无退避重试 → 潜在请求风暴）。该缺陷不在 P1 四项需求内、修它要动 `stores/team.ts`
（P4 dispatch 明确划出本批范围），故**不在本任务修**，登记为 `findings` F8 转 roadmap。
P6/P6.5 未观察到请求风暴（`P6-acceptance.md` / `P6.5-judge-verdict.md` 均无相关记录）。
**判 accepted（out_of_scope：P2 已按草案实现，缺陷属既有 store）。**

### DG8 — 详情页两处 `v-if` + `storeToRefs` 容错
[DESIGN_GAP: `VisibilityMenu` 详情页两处加 `v-if="currentEntry && isOwner"`；`teamStore` 经 `storeToRefs` 后加 `?? []` / `?? null` / `?? false` 容错]
[DESIGN_GAP_REVIEWED: DG8 → accepted；checked_against = P2 §3.7；basis = out_of_scope]
`v-if` 是 BDD-22（非 owner 不见入口）的落实位置，属 P1 要求。`?? []` 容错是因为 `t067` / `t031`
把 `pinia` 的 `storeToRefs` mock 成「只挑有 `.value` 的键」，team store 在该 mock 下拿不到键；
写的写法与 `EntryListView.vue:308-315` 的既有同仓先例完全一致，不新增行为分支。P2 §3.7 未规定
mock 兼容策略。**判 accepted（out_of_scope：属测试兼容实现细节）。**

### DG9 — 新 props 全部给默认值
[DESIGN_GAP: `EntryDetailHeader`/`EntryMetaTagsBar` 的 `teams`/`teamsFailed`/`isOwner`/`variant`/`disabled` 全给默认值，成为可选 prop（P2 §3.7 写成必填）]
[DESIGN_GAP_REVIEWED: DG9 → accepted；checked_against = P2 §3.7 / P2 §6.4；basis = out_of_scope]
`T079-entry-detail-header.spec.ts` 直传旧的 `relativeTime`/`fullTime` 且不传新 props；若设为必填，
`vue-tsc` 与运行期都会报缺失。该文件**不在** P2 §6.4 的更新面内 → 是「不必改」的实现细节，
不是设计要求回退。生产路径（`EntryDetailView`）始终显式下发，不缺省依赖。**判 accepted。**

### DG10 — 未接 `@confirm-cancel`
[DESIGN_GAP: `EntryDetailContent.vue` 的 `EntryMetaTagsBar` 未接 `@confirm-cancel`（二次确认取消）]
[DESIGN_GAP_REVIEWED: DG10 → accepted；checked_against = P2 §3.5 D-10 / P1 BDD-19；basis = in_bdd]
P2 §3.5 D-10 只说该事件「供父层恢复焦点/重开菜单」，而这两个动作已由 `VisibilityMenu` 自身完成
（`VisibilityMenu.vue:216-221` 取消后重开菜单 + `nextTick` 还焦点）→ 父层无额外职责，
事件链不再上抛不丢行为。`confirm-cancel` 的 emit 本身保留（P3 `visibility-menu.spec.ts` 断言它）。
BDD-19 的「升 Public 需二次确认」判据不受影响。**判 accepted。**

### DG11 — upgrading.md 目标版本号自定为 0.27.0
[DESIGN_GAP: upgrading.md 新节标题版本对自定为 `v0.26.1 → v0.27.0`（minor）]
[DESIGN_GAP_REVIEWED: DG11 → accepted；checked_against = P2 §1.1 E2 / P1 I-18 / P8 bump 范围；basis = out_of_scope]
P2 §1.1 E2 只说「追加一节（按版本号）」，未指定目标版本。本次含对外可见的响应格式破坏性变更
（P1 I-18 已定性），按 semver 破坏性变更至少 minor（项目 0.x 未到 1.0；先例 `[mcp-v0.8.0]`
的 SSE→Streamable HTTP 走 minor）。**P8 须与此对齐**：`VERSIONS.json` 现为 `peekview 0.26.1`，
若 P8 定为 patch 则需改该标题（CHANGELOG 条目未写目标版本号，只写 `[Unreleased]`，无冲突）。
**判 accepted（out_of_scope：版本号由 P8 定）。**

### DG12 — upgrading.md 引入 `####` 四级标题
[DESIGN_GAP: upgrading.md 新节引入三条既有节没有的 `####` 四级标题（谁会受影响 / 为什么改 / 怎么迁移）]
[DESIGN_GAP_REVIEWED: DG12 → accepted；checked_against = P2 §1.1 E2；basis = out_of_scope]
既有 `v0.21.0 → v0.22.0` 节只用 `###`。用 `###` 并列会与 `### MCP 无需改动` / `### 窗口期风险`
同位，读者无法分辨哪些是必答要件；下沉一级使三件事成为「破坏性变更」的子结构，且
`## → ### → ####` 无跳级。**判 accepted（out_of_scope：文档结构细节）。**

### DG13 — F-1 采备选 ② 而非推荐 ①
[DESIGN_GAP: F-1 采用 review 备选 ②（去 `.entry-panel` 的 `overflow:hidden`）而非推荐 ①（icon/inline 也 Teleport 到 body + position:fixed）]
[DESIGN_GAP_REVIEWED: DG13 → accepted；checked_against = P2 §3.5 / P4-review-design F-1；basis = in_bdd]
技术依据充分且可复核：P3 契约 spec（7 文件）全部用 `wrapper.find('[data-testid="visibility-item-*"]')`
定位菜单项，而 VTU 2.4.10 的 `wrapper.find` **不穿透 Teleport**（P4 rev1-fix 记录已实测：
Teleport 后 `wrapper.find` 返 false、`document.body.querySelector` 返 true）→ 选 ① 会一次性打断
7 个已通过 spec。备选 ② 的视觉代价经实测为零（首/末行 13px 圆角与容器 14px 同心，行内缩进 1px）。
`rev1-fix` 给了正反向对照（临时设回 `overflow:hidden` → `hitInside` 变 false）。**判 accepted。**

> 汇总：`accepted` 13 / `rejected` 0 / `followup` 0。无一条需要退回实现。

---

## 2. `[SCOPE+]` 闭环

两处 `[SCOPE+]` 只存在于 `P4-implementation.md` 正文散文（第 188 行、第 305 行）。
`P1`/`P2` 的 frontmatter **均无** `scope_plus` / `scope_resolved` 声明字段
（grep 六个产出文件的 frontmatter 键，全 `(none)`）。

### SP1 — 两个 t031 spec 的 BDD-7 用例连带失效
**[SCOPE_RESOLVED]** `TPV0102:P1-requirements:SP1` — 判定 **resolved，无需回补 P1 基线**。
`t031-entry-card.spec.ts` / `t031-entry-list-row.spec.ts` 的 BDD-7 用例原断言
`emitted('toggleVisibility')` 且定位 `.card-action-btn` / `[data-action="toggle-visibility"]`；
D7/D9 改名后两处定位与事件名都消失。核查 P4「既有断言的显式取代」表 #6/#7：改的是
**定位方式与事件名**，覆盖点（点交互控件不触发导航）保留；且原弱断言
`toBeGreaterThanOrEqual(0)` / `toBeGreaterThan(0)` 反而**收紧**为精确 `toHaveLength(1)`。
属测试断言的连带更新，**不改功能语义**，不扩展 P1 验收范围。

### SP2 — CHANGELOG `### 变更` 第 4 条
**[SCOPE_RESOLVED]** `TPV0102:P1-requirements:SP2` — 判定 **resolved，无需回补 P1 基线**。
该条记录「详情页 `.status-tag` 可见性文案消失 + overflow 菜单四项移除」，源自 P2 §12 裁决 1 与
§1.1 D8。核查 P1 §1 需求 3 的原文：「可见性入口从单按钮改为下拉菜单 … 抽取共享组件三处复用」
——「三处复用」已包含详情页入口替换语义，`.status-tag` 只读标签的退场是其**必然连带面**，
不是新增需求。属文档连带更新，**不改功能语义**。

**闭环动作**：已用 `agate-md-field-set.py append scope_resolved` 给 `P1-requirements.md`
补写两条 `scope_resolved`（见 §6 写入留痕）。gate 判据要求
`scope_plus` id 集合 ⊆ `scope_resolved` id 集合；P1/P2 未声明 `scope_plus` ⇒ 该集合为空 ⇒
子集关系天然成立，补写后同时满足「P1 有 `scope_resolved`」的阶段卡要求。

---

## 3. 跨文件一致性检查

### 3.1 BDD 数量三方匹配
- **P1 §BDD**：`grep -cE '^#### BDD-[0-9]+:' P1-requirements.md` = **30**（BDD-01 ~ BDD-30 连续无缺号）
- **P6 §acceptance**：`grep -cE '^- PASS BDD-'` = **30**，`grep -cE '^- FAIL BDD-'` = **0**，
  frontmatter `pass: 30` / `fail: 0` 与正文逐条行一致
- **P6.5 §judge**：`criteria_total: 30` / `criteria_passed: 30`，正文 Summary「30/30 PASS」
→ **三方均为 30，匹配。** 且非仅数量对齐：抽查 BDD-25 在 P6 的判定文本确为该条的
`empty-no-files` / `empty-select-file` 互斥语义（不是别的条映射错位，即 P7 卡「常见错误 2」的情形）。

### 3.2 `packages` 与 P8 bump 范围
- **P1 §packages**（`P1:19-22`）= `peekview` / `frontend-v3` / `docs`
- **P2 §packages**（`P2:11-14`）= `peekview` / `frontend-v3` / `docs` —— 一致
- **P4 §packages**（`P4:14-15`）= **仅 `peekview`** —— **不一致**
- 实测 P4 提交 `d8adbec7` 触及路径按顶层目录：`backend` 6 / `frontend-v3` 28 / `docs` 1 →

**判定**：P4 的 frontmatter 声明**漏了 `frontend-v3` 与 `docs`**（见 `findings` F6）。但
P8 的 bump 范围应以 **P1/P2 的三包**为准（P1 是需求基线、P2 是方案基线，权限高于 P4 自查头），
故 P8 应：bump `peekview` 版本（0.26.1 → 0.27.0，与 DG11 对齐）+ 落 `CHANGELOG.md` +
`docs/process/upgrading.md` 已有节，`mcp_server` 版本仅在 MCP 包确无改动时不 bump
（P2 §1.2 不改什么 + upgrading 节 `### MCP 无需改动` 均声明 MCP 代码零改动）。
**不构成 bump 范围偏差，仅登记 P4 声明缺漏。**

### 3.3 P4 实现是否覆盖 P2 §3 详细设计（逐节对照）
| P2 §3 小节 | P4 对应落点 | 核对结果 |
|---|---|---|
| §3.1 `timefmt.py` 零依赖两函数 | `[backend-serialize]` 新建文件表 | ✅ `backend/peekview/timefmt.py` 实存；`utc_iso_z` / `parse_iso` 均在 |
| §3.2 `UtcSerializeMixin` | 同节「`now_utc` 与 `EntryBase` 之间新增」 | ✅ 位置与 `field_serializer("*", when_used="json", check_fields=False)` 一致 |
| §3.3 叶响应模型基类替换 | 同节「15 个叶响应模型」 | ✅ 代码实测 `class X(UtcSerializeMixin)` = **15**；P2 标题写「16 个」但清单列 15 个 + `ShareCreateResponse` 经继承 → 语义等价（见 F7） |
| §3.4 时间显示（`useRelativeTime` + `TimeDisplay`） | `[frontend-shared]` 改动表 | ✅ 四硬约束（真实 DOM tooltip / 无 `dateStyle`+`timeZoneName` 共存 / IANA 名不拼接）已逐条自查 |
| §3.5 可见性菜单（三片纯函数 + 组件契约 + store） | `[frontend-shared]` + `[mount-*]` | ✅ `visibility-options.ts` / `visibility-target.ts` / `VisibilityMenu.vue` 实存；DG2/DG3/DG10 为契约内收窄 |
| §3.6 文件数与空态 | `[mount-explore]` ② + `[mount-detail]` ① | ✅ `>= 2` 分支 + `empty-no-files` / `empty-select-file` 双支实存 |
| §3.7 团队列表加载（`loadMyTeams`） | `[mount-detail]` `EntryDetailView` ① | ✅ 原「零调用」已补；`onMounted` + `watch(authState)` 双触发、`teamsLoaded` 真则跳过 |
| §3.8 稳定测试标识清单 | 各批 `data-testid` | ✅ 抽查 `visibility-toggle` / `visibility-menu` / `time-display-main` / `empty-no-files` 均在组件源码命中 |

→ **P2 §3 全部 8 个小节均有对应实现落点，无缺节。** 偏差已在 §1 的 13 条 DG 里逐条记账。

### 3.4 声明与实际（P1 phases / risk_level / ceremony）
- **P1 §frontmatter `phases`** = `[P1..P8]` 全 8 阶段 → 实际已走完 P0–P6.5，
  `git log` 有 `wf(TPV0102-P1)`…`wf(TPV0102-P6.5)` 七个阶段 commit，**无裁剪跳阶** → 与声明一致
- **`risk_level: medium`** → 与「跨 backend/frontend/docs 三包 + 30 条 BDD + 5 批并行」的实际
  风险面相符；retries 记录（P1 ×1 / P2 ×2 / P4 ×2）亦符合 medium 的评审强度 → 一致
- **`ceremony: standard`** → 实际 P1/P2 双评审、P4 双专家 + 2 轮复审、P6.5 独立 judge 全做 →
  与 standard 一致（未降级为 simplified）

### 3.5 E2E spec 文件名
- **P2 §gate_commands `P5_e2e`**（P2:1119）= `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`
- **实际创建**：`frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`（**实存**，P3 提交 `20fd76b3`
  新建 1047 行，P4 追加 `vc08` 用例）
→ **文件名逐字匹配。** P2 §6.3 的「写死文件名 → 缺文件即 exit 1」机制保证成立
（P2 §8 V12 已实测 `--list` 不存在文件 → exit 1）。

---

## 4. 未决项清零
- `P1-requirements.md` 行首 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]` 正则扫描 → **0 命中**
- P1 第 38 行 `[NO_NEED_CONFIRM]` 与第 320 行 `[NO_NEED_CONFIRM] — 无阻塞项。` 成立：
  P1-review 结论 `approved`、P2 双评审 `approved`、P4 双专家 `2/2 approved`、P6.5 `30/30 PASS`，
  全程无遗留待确认项 → `[NO_NEED_CONFIRM]` 声明**成立**
- 本文件正文 `[BLOCKER]` = 0 条、`[DEVIATION-CRITICAL]` = 0 条（frontmatter
  `blocker_count: 0` / `deviation_critical_count: 0` 与正文一致）

---

## 5. CODE-MAP 与架构决策核对

### 5.1 CODE-MAP
`{AGATE_WORKSPACE}/agents/CODE-MAP.md` **不存在**（`ls agents/` 仅有 `project.md`）→ 按 P7 卡
「不存在则跳过并说明」处理：**跳过 CODE-MAP 配对**，`code_map_new_files_count` /
`code_map_reviewed_count` / `code_map` / `code_map_reviewed` 四个字段**均不声明** ——
gate 对「两字段均缺失 → 机制未采用，跳过」有显式分支（`_gate_p7_structured` 注释：
「两字段均缺失 → 机制未采用，两层校验全部跳过」），故跳过是合规路径而非漏项。
本任务实际新增文件 6 个（`timefmt.py` / `visibility-options.ts` / `visibility-target.ts` /
`TimeDisplay.vue` / `VisibilityMenu.vue` / `tpv0102-…spec.ts`），如需启用该机制应由主 Agent
先建 `agents/CODE-MAP.md` 再回填。

### 5.2 架构决策（`decisions/`）
`{AGATE_WORKSPACE}/decisions/` **不存在**（`ls` 报 No such file or directory）→ 按卡「仅核对，
不在 P7 撰写决策正文」处理：**无既有决策需标「已过时」，也无可核对的本任务落点**。

本任务产生了 3 条**跨任务架构决策候选**（派发单列出的三条），我的判断是**都值得登记**，
理由与去向如下（**不在本文件撰写决策正文**，按 DEBT0039 语义「由决策提出方在下一次 P2 前补写入
`decisions/`」）：

| # | 决策候选 | 为什么跨任务值得沉淀 | 建议去向 |
|---|---|---|---|
| ① | UTC 序列化的唯一落点是**叶响应模型 + `UtcSerializeMixin`**，表模型严禁继承 | 否则 `model_dump()` 会把 DB 层的 naive datetime 提前字符串化，破坏 ORM 语义；P5_fitness 已把「mixin 不进 `table=True` 的 MRO」做成常驻适应度断言，是机制而非一次约定 | `decisions/ADR-XXX-datetime-serialization.md` |
| ② | tooltip **必须**自定义 DOM 元素（原生 `title` / CSS `::after` 不可断言） | 原生 `title` 无法被 Playwright/VTU 取到文本、`::after` 的 `content` 不可被 `wrapper.find` 断言 → 任何后续 UI 若要「可验收的悬停提示」都得复用此结论，否则重复踩坑 | `decisions/`（与 DESIGN 的 tooltip 规范同址） |
| ③ | 可见性菜单 Teleport 与容器 `overflow` 的取舍：本任务选**去 `overflow:hidden`**（而非 body 级 `position:fixed`） | 关键约束是 **VTU 2.4.10 `wrapper.find` 不穿透 Teleport** —— 这条会影响**所有**后续「浮层 + 组件测试」的方案选择，是本任务付出实测代价换来的 | `decisions/`（附 VTU 版本约束） |

> 结论：`decisions/` 缺失时本轮无需写正文；上述三条作为**待办**移交主 Agent 决定是否在
> 下一次 P2 前补建 `decisions/` 并写入（本 Agent 无该目录写权限，且 P7 卡明确「仅核对」）。

---

## 6. 写入留痕（唯一一处修改被审查文件）

`P1-requirements.md` 补写 `scope_resolved`（两处 `[SCOPE+]` 的闭环动作），严格走工具而非手写：

```
FILE=.../P1-requirements.md python3 \
  ~/.agate/v0.83.2/agate/scripts/agate-md-field-set.py \
  append scope_resolved id=TPV0102:P1-requirements:SP1 note="..."
```

- 工具 `--list` 显示 `scope_resolved` 属「**仅登记/需 append（不可 set）**」，故用
  `append`（`set` 会被拒）；`id` 由工具按 `<相对路径去 .md>:<前缀><n>` 规则自动编号，
  这里显式给定 `SP1` / `SP2` 以与 P4 正文的两处登记一一对应
- 写入为原子写（tempfile + `os.replace`），未破坏 frontmatter 其余键
- 除本项外，未修改任何被审查的实现/测试/产出文件（见 §8 的 `git status` 核验）

---

## 7. 既有债与判据瑕疵（4 条，全部记入 `findings`）

以下 4 条**不是本任务引入的缺陷**，但 P7 是最后一处收口，必须留痕并说明去向。
**不写成本任务缺陷**——这是判定边界，不是措辞问题。

| # | 项 | 性质 | findings | 去向 |
|---|---|---|---|---|
| 1 | 卡片长标题与右上 hover 操作区重叠（最坏 34px） | **既有视觉债**。pre-task `.card-actions` 60px / 覆盖 332px → 本任务 48px / 覆盖 211px，**减轻 121px**。不在任何 BDD/VC 判据内 | `F1`（note / deferred） | 转 roadmap 独立任务；**不得**记为本任务缺陷 |
| 2 | `BaseBadge` 的 label 在 setup 期求值一次 → 可见性切换后徽章文字 stale（刷新才对） | **既有缺陷**。该文件本任务零改动，已核实 `git log BaseBadge.vue` 末次提交为 `2b382c9c`（TPV0095 的 P4），本任务 P4 提交 `d8adbec7` 无该文件 | `F2`（note / deferred） | 转 roadmap（label 改 computed）；不阻断 BDD-20（其 Then 判的是状态非徽章文字） |
| 3 | BDD-25 后半条对有文件 entry **不可测** | **P1 判据瑕疵**。`entryDetail.loadEntry` 恒把 `activeFile` 置为 `files[0]`（`stores/entryDetail.ts:49-53`）、`selectFile` 也不置空 ⇒ `empty-select-file` 对有文件的 entry 不可达 | `F3`（note / deferred） | 留待 P1 判据回归修正（P7 只读，不改 P1 原文）；P6 已用等价判据 PASS |
| 4 | P2 VC-5 的 `<=2px` 基线**几何上不可满足** | **P2 判据瑕疵**。280px 卡宽 + 207px 绝对时间下 en-US 桌面 20/20 卡都换行 | `F4`（note / deferred） | 留待 P2 判据回归改「同行或换行皆可」；本任务由 BDD-01/02 形态判据承担 |

第 3、4 条的共性：**判据本身写错了**（写了产品里不可达的场景 / 几何上不成立的等式），
不是实现没做到。这正是 P6/P6.5 用等价判据取代它们的原因。

### 本次审查额外发现的口径偏差（4 条，同样记入 `findings`）
| # | 项 | findings | 处置 |
|---|---|---|---|
| 5 | 派发单角色路径错（`review-roles/` → 实为 `execution-roles/`）+ DESIGN_GAP 18 vs 13 | `F5`（note / resolved） | 以 gate 脚本口径为准；本文件已按 13 记账 |
| 6 | P4 frontmatter `packages` 漏 `frontend-v3` / `docs` | `F6`（note / resolved） | 不影响 P8（以 P1/P2 三包为准） |
| 7 | P2 §3.3 标题「16 个」vs 清单 15 个 | `F7`（note / resolved） | 语义等价（15 + 继承 1 = 16），非实现偏差 |
| 8 | `stores/team.ts` 失败后无退避重试（既有 store 缺陷，对应 DG7） | `F8`（note / deferred） | 转 roadmap/tech-debt；P7 无 `tech-debt.md` 写权限，故未用 `followup:DEBT<n>` |

> 关于为何不用 `basis: followup:DEBT<n>`：该 basis 要求 gate 在 `{workspace}/debt/tech-debt.md`
> 中找到对应 DEBT 条目，且其 `source_ref` 须以 `TPV0102:DG7` 形式双向回指。实测
> `debt/tech-debt.md` 现有最大编号 `DEBT0021`，**`source_ref` 键 0 处**，且本 Agent 无该文件
> 写权限 → 强行声明 `followup:DEBT0022` 会让 gate 以「DEBT 条目不存在」exit 1。
> 故 DG7 用 `out_of_scope`，并把该债落到 `F8` 由 P8 决定登记去向（诚实优先于形式）。

---

## 8. 只读纪律与生产隔离核验

- **未执行**任何 `git checkout -- .` / `restore` / `reset` / `stash` / `clean` / `add` / `commit` / `switch -f`
- **未运行**写类 agate 工具（`agate-inject-card.py` / `agate-state-set.py` / `agate-task-init.py`）
- **唯一例外**：用 `agate-md-field-set.py append` 给 `P1-requirements.md` 补 `scope_resolved`（§6）
- 写入面：`P7-consistency.md`（本文件）+ `P1-requirements.md`（仅 scope_resolved 字段）
  + `P7-progress.md`；临时产物落 `.agate-tmp/`（dryrun 副本 + 字段写入探针）
- **`git status --porcelain` 核验**（结束时）：见末行
- **生产隔离**：全程未触碰 `:8080`，未读写 `~/.peekview/`；所有代码核对均为只读
  （`git show` / `grep` / `read`）

[PROD_NOT_TOUCHED]

---

## 9. 结论

| 判据 | 结果 |
|---|---|
| `[BLOCKER]` | **0** |
| `[DEVIATION-CRITICAL]` | **0** |
| `[DESIGN_GAP]` 转抄 + `[DESIGN_GAP_REVIEWED]` 配对 | **13 / 13**（= P4 实际行首声明数） |
| `design_gap_count` == `design_gap_reviewed_count` == P4 实际条数 | **13 == 13 == 13** ✅ |
| `[SCOPE+]` 闭环 | **2 / 2 resolved**，P1 已补 `scope_resolved` |
| 跨文件一致性 | BDD 30=30=30 ✅ / packages 见 F6 / P2 §3 八节全覆盖 ✅ / E2E 文件名匹配 ✅ |
| 既有债 4 条已留痕 | `F1`–`F4` ✅ |
| CODE-MAP | 机制未采用（`agents/CODE-MAP.md` 不存在），合规跳过 |
| 架构决策 | `decisions/` 不存在，3 条候选移交主 Agent |

**status: approved** —— 可推进 P8。P8 需注意三件事：① bump 范围以 P1/P2 三包为准（F6）；
② 版本号与 DG11 的 `0.27.0` 对齐；③ `F1`/`F2`/`F8` 三条既有债需有明确去向（roadmap 或 tech-debt）。
