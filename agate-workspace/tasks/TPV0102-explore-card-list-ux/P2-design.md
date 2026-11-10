---
phase: P2
task_id: TPV0102
type: design
parent: P1-requirements.md
trace_id: TPV0102-P2-20261110
status: draft
created: '2026-11-10'
agent: architect
candidate_count: 7
packages:
- peekview
- frontend-v3
- docs
domains:
- backend
- frontend
- api
- cli
ui_affected: true
ui_design_section: true
dispatch_plan:
  mode: static-batch
  parallel_limit: 5
  batches:
  - id: backend-serialize
    complexity: medium
  - id: frontend-shared
    complexity: medium
  - id: mount-explore
    complexity: medium
  - id: mount-detail
    complexity: medium
  - id: docs-changelog
    complexity: low
prod_touched: false
---

# P2 方案设计 — Explore 列表体验修正（时间显示 / 文件数 / 可见性下拉 / 空态）

> **上游**：P0-brief（4 项决策 + §1.2.1 四条硬约束）→ P1-requirements（30 条 BDD + 15 类/31 字段清单）。
> **本文件不含 PASS/FAIL 预判**——判定结果属 P6。
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 0. 设计摘要（一句话）

后端用**共享 mixin 的通配 `field_serializer`** 让所有叶响应模型的 datetime 在 JSON 输出带 `Z`（表模型零污染），前端把时间显示收敛到**单个 `TimeDisplay` 组件**（主显绝对时间 + 真实 DOM tooltip）、文件数改为 `>= 2` 才渲染、可见性入口收敛到**单个 `VisibilityMenu` 组件**四处复用、0 文件 entry 有独立空态；三处新增组件均由**纯函数选项构造器**驱动以便单测覆盖。

---

## 1. 影响面梳理

> 本节在候选方案之前完成——方案的取舍取决于它牵动多大面。量级来自 P0「同类/影响面预判」，清单来自 P1 §6 同类扫描，本节做**候选方案级**细化（落到「哪个文件的哪个函数/小节」）。

### 1.1 改什么（Modify）

#### A. 后端 `peekview`（序列化契约 + 时区标记）

| # | 文件:位置 | 改动 | 关联 BDD |
|---|---|---|---|
| A1 | `backend/peekview/timefmt.py`（**新增**） | 两个纯函数：`utc_iso_z(dt \| None) -> str \| None`（naive→UTC、`isoformat()` 后 `+00:00`→`Z`）、`parse_iso(s) -> datetime`（`fromisoformat(s.replace("Z","+00:00"))`，Python 3.10 兼容）。**零依赖模块**，被 models/cli/client/admin_service 四处引用，避免循环导入 | 10 / 11 |
| A2 | `backend/peekview/models.py`（`UtcSerializeMixin` 新增于 `now_utc` 之后、`EntryBase:82` 之前） | 新增 `class UtcSerializeMixin(SQLModel)`，内含 `@field_serializer("*", when_used="json", check_fields=False)`，对 `datetime` 值调 `utc_iso_z`、其余值原样透传 | 07 / 08 / 09 |
| A3 | `backend/peekview/models.py`（16 个叶响应模型的基类声明行） | 把 `class X(SQLModel)` 改为 `class X(UtcSerializeMixin)`：`ReadStatsResponse:514` / `ReadEventResponse:523` / `CountdownInfo:716` / `StarResponse:724` / `TombstoneResponse:734` / `StarItem:754` / `EntryResponse:791` / `EntryListItem:817` / `EntryRawResponse:854` / `CreateEntryResponse:913` / `UserResponse:1026` / `ApiKeyResponse:1083` / `ApiKeyCreateResponse:1094` / `EntryStats:1108` / `ShareResponse:1185`（**`ShareCreateResponse:1196` 经继承即得，不单独改**） | 07 |
| A4 | `backend/peekview/client.py:89`（`_parse_dt` 内的 `datetime.fromisoformat(v)`） | 改为 `parse_iso(v)` | 10 |
| A5 | `backend/peekview/cli.py:378, 443, 444, 564, 571, 2287, 2318`（7 处 `.isoformat()`） | 统一替换为 `utc_iso_z(...)`，`--json` 输出与 API 同形（`Z` 结尾） | 11 |
| A6 | `backend/peekview/services/admin_service.py:643, 644, 645`（3 处 `.isoformat()`） | 同上 | 11 |
| A7 | `backend/tests/test_utc_serialization.py`（**新增**） | 契约测试：①遍历 `models` 模块「非 table 且不被 table 模型继承」的类，断言每个 datetime 字段 JSON 输出以 `Z` 结尾；②表模型 `model_dump()` 仍为 `datetime`；③叶模型 python 模式 `model_dump()` 仍为 `datetime`；④mixin 不出现在任何 `table=True` 模型的 MRO（架构适应度）；⑤各端点实跑响应体逐字段判据 | 07 / 08 / 09 / 12 |

#### B. 前端 `frontend-v3`（时间显示）

| # | 文件:位置 | 改动 | 关联 BDD |
|---|---|---|---|
| B1 | `frontend-v3/src/composables/useRelativeTime.ts:3-22`（`formatRelativeTime`） | 修两个边界：`Number.isNaN(date.getTime())` → 返回 `''`；`diffMs < 0`（未来）→ 返回 `in ${n}m/h/d/w/mo/y` 而非 `just now` | 05 / 06 |
| B2 | `frontend-v3/src/composables/useRelativeTime.ts:24-26`（`formatFullDate`） | 改为**主显**格式化：`toLocaleString(undefined, {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'shortOffset'})`；无效日期返回 `'—'` | 01 / 03 / 04 / 05 |
| B3 | `frontend-v3/src/composables/useRelativeTime.ts:28-56`（`useRelativeTime`） | 返回值由 `{relative, full}` 扩为 `{relative, full, absolute}`：`absolute` = B2 的墙上时间；`full` = tooltip 文本 = `${relative} · ${longOffset 墙上时间} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`（整体交给 `toLocaleString`，禁止拼接时区名）；无效日期时 `full = 'Invalid date'` | 02 / 03 / 05 |
| B4 | `frontend-v3/src/components/TimeDisplay.vue`（**新增**） | 时间显示的唯一载体：根节点 `data-testid="time-display"`，内含主显 `<span class="time-display__main">` + tooltip `<span role="tooltip" data-testid="time-tooltip">`，默认 `visibility:hidden`，`:hover` / `:focus-within` 时 `visible`。**必须真实 DOM 元素**（理由见 §2.3 决策点 C 的实测）。`defineOptions({ inheritAttrs: false })`——**受控**透传：tooltip 节点的 `data-testid` 必须优先于父级透传的 `data-testid`（见 §3.4 实现约束 5） | 01 / 02 / 03 |
| B5 | 四个**渲染点**：`EntryCard.vue:43`、`EntryListRow.vue:19`、`EntryDetailHeader.vue:62`、`EntryMetaTagsBar.vue:4`；外加两个**上游 prop 链**：`EntryDetailView.vue`、`EntryListView.vue` | 四处 `<span :title="fullTime">{{ relativeTime }}</span>` / `{{ relativeTime }}` 全部替换为 `<TimeDisplay :date-str="..." />`。**prop 链同步调整**（逐点清单见下 B5 明细表）——四处目前都靠 prop 接收**已格式化字符串**，改为组件内自格式化后，上游 View 传给这些子组件的 `relativeTime` / `fullTime` prop 成为死参数，须一并删除 | 01 / 03 |

**B5 明细：调用点 × 现状 × 改后 × 上游需删的 prop**

| 调用点 | 现状形态 | 现状 prop 来源（上游） | 改后 | 上游需删 |
|---|---|---|---|---|
| `EntryCard.vue:43` | `<span :title="fullTime">{{ relativeTime }}</span>` | `EntryListView` → `EntryCard` 的 `relativeTime` / `fullTime` | `<TimeDisplay :date-str="entry.createdAt" />`（或对应时间字段） | `EntryListView.vue` 传给 `EntryCard` 的 `relativeTime` / `fullTime` 两个 prop 及其 `useRelativeTime` 解构 |
| `EntryListRow.vue:19` | 同上 | `EntryListView` → `EntryListRow` 同上 | `<TimeDisplay :date-str="entry.createdAt" />` | 同上（同一视图的两处绑定） |
| `EntryDetailHeader.vue:62` | 同上 | `EntryDetailView` → `EntryDetailHeader` 的 `relativeTime` / `fullTime`（props 声明含二者） | `<TimeDisplay :date-str="..." />` | `EntryDetailView.vue:203` 的 `const { relative: relativeTime, full: fullTime } = useRelativeTime(...)` 解构，及传给 `EntryDetailHeader` 的两个 prop |
| `EntryMetaTagsBar.vue:4` | `{{ relativeTime }}`（**无** `title`） | `EntryDetailView` → `EntryMetaTagsBar` 的 `relativeTime` | `<TimeDisplay :date-str="..." />` | `EntryDetailView` 传给 `EntryMetaTagsBar` 的 `relativeTime` prop |

> 与 `§6.4` 第 8 项的关系：第 8 项登记的是**测试侧**直传 prop 的 spec；本表登记的是**实现侧** prop 链改动（两处 View 文件），二者都进 `§1.1` Modify 面（`EntryDetailView.vue` 已有 D10 行，`EntryListView.vue` 已有 D9 行）。

#### C. 前端 `frontend-v3`（文件数 + 0 文件空态）

| # | 文件:位置 | 改动 | 关联 BDD |
|---|---|---|---|
| C1 | `EntryCard.vue:44-47`、`EntryListRow.vue:20-23` | `v-if="entry.fileCount"` → `v-if="(entry.fileCount ?? 0) >= 2"`；文案固定 `{{ entry.fileCount }} files` | 13 / 14 / 15 |
| C2 | `EntryDetailContent.vue:59-61` | 拆成两个互斥分支：`currentEntry && currentEntry.files.length === 0` → `data-testid="empty-no-files"`（文案「此 entry 无文件」）；否则 → `data-testid="empty-select-file"`（保留 `Select a file to view`） | 25 |

#### D. 前端 `frontend-v3`（可见性菜单）

| # | 文件:位置 | 改动 | 关联 BDD |
|---|---|---|---|
| D1 | `frontend-v3/src/utils/visibility-options.ts`（**新增**） | 纯函数 `buildVisibilityOptions({isPublic, currentTeamSlug, teams, teamsFailed?})` → `{items: VisibilityTarget[], teamSubmenu: TeamOption[], teamsFailed: boolean}`（`TeamOption = Team`）。规则：排除当前态项；`teams.length===0` → 无 `team` 入口；Team 恒为子菜单且**按 `slug`** 排除当前团队（`Team` 无 id，见 §3.5）；Team 入口自身无 `onSelect` | 16 / 17 / 18 |
| D2 | `frontend-v3/src/utils/visibility-target.ts`（**新增**） | 纯函数 `toPatchPayload(target)` → `{is_public?, team_id?}`：`public` → `{is_public:true, team_id:null}`（**两字段同传**，BDD-19 依据）；`private` → `{is_public:false, team_id:null}`；`team` → `{team_id: slug}`。另 `needsConfirm(target)` → 仅 `public` 为 true | 19 / 20 / 27 / 28 / 29 |
| D3 | `frontend-v3/src/components/VisibilityMenu.vue`（**新增**） | 菜单载体：触发按钮 + 菜单 + Team 子菜单 + 二次确认（复用 `ConfirmDialog.vue`）。props `{entry, teams, variant, disabled, teamsFailed}`，emits `select` / `confirm-cancel`，内部状态 5 项（完整契约见 §3.5）。a11y 按 `OverflowMenu.vue:113-156` 惯例（`Escape` → `close()` → `triggerRef.focus()`）+ `aria-haspopup` / `aria-expanded`（既有先例已有，零成本带上） | 16-24 / 27-30 |
| D4 | `frontend-v3/src/stores/entryList.ts:45-78`（`toggleVisibility`） | **替代**为 `setVisibility(entry, target)`：删除 `entry.teamId` 守卫；改调 `api.updateEntry(slug, toPatchPayload(target))`；乐观更新 + 失败回滚（同时回滚 `isPublic` 与 `teamId`/`team`）；请求中 `inFlight` 集合防连点；**成功分支保留 `revokedShares > 0` 的 warning toast**（B-4，见 §3.5） | 19-21 / 24 / 27-29 |
| D5 | `frontend-v3/src/stores/entryDetail.ts:101-105`（`syncVisibility`） | 签名扩为 `syncVisibility(slug, patch: {isPublic, teamId, team})`，三字段同同步 | 23 / 27-29 |
| D6 | `frontend-v3/src/composables/useEntryDetailActions.ts:72-80` | 详情页 overflow 菜单里的 `Make Public` / `Make Private` 项**移除**（可见性入口已上移到头部菜单，两处并存会语义重复） | 23 |
| D7 | `EntryCard.vue:3-30`（`card-actions`）、`EntryListRow.vue:92-113`（`entry-actions`） | 单按钮 + 团队时空 `span` 占位 → `<VisibilityMenu>`；卡片/列表的团队可见性表现由此统一 | 22 |
| D8 | `EntryDetailHeader.vue:66-73`（`meta-row` 的只读 `status-tag`）、`EntryMetaTagsBar.vue:7-12` | 只读标签 **原位替换** 为 `<VisibilityMenu>`（桌面头部 `variant="inline"`、移动元信息条 `variant="sheet"`，由视图层按 `isMobile` 下发——见 §3.5「`variant` 的切换主体」）。**语义裁定：替换，非并存**——只读 `.status-tag` 不再单独渲染，否则同一可见性语义在头部出现两个元素（裁决见 §12#4）。**可见文案逐字沿用现状三态**（`Public` / `Private` / `仅团队可见 · {team.name}`），并补 `aria-label`（N-4，见 §3.5） | 23 |
| D9 | `frontend-v3/src/views/EntryListView.vue:169-190`（两处组件绑定）、`:637-643`（`handleToggleVisibility`） | 事件改为 `@change-visibility="handleVisibilityChange"`（**toast 的唯一发出点**，E-2：store 只回传 `{ok, revokedShares}` 不发 toast）；toast **四态**文案（`Made public` / `Now private` / `Shared with Team <name>` / **`N share link(s) revoked — entry is now public`**〔`revokedShares > 0` 时追加，warning 级，B-4〕）；`:551` 的 `ensureMyTeamsLoaded` 已在，改为把 `teamStore.allTeams` 经 prop 下发给卡片/列表 | 19 / 20 / 27-29 |
| D10 | `frontend-v3/src/views/EntryDetailView.vue`（`onMounted` 之后、`:203` 附近） | **新增** `loadMyTeams()` 调用（已加载则跳过）+ 把 `teamStore.allTeams` 下发给头部与元信息条（当前完全没有调用，是陷阱 13） | 23 |

#### E. 文档 `docs`

| # | 文件 | 改动 | 关联 BDD |
|---|---|---|---|
| E1 | `CHANGELOG.md`（`[Unreleased]`） | 四项用户可见改动 + **响应格式破坏性变更**（datetime 字段多 `Z`）+ CLI `--json` 输出统一为 `Z` | — |
| E2 | `docs/process/upgrading.md`（若存在对应节） | 升级说明：消费 API 时间字符串的脚本需能解析 `Z`（合规 ISO 8601 解析器不受影响） | — |

### 1.2 不改什么（Not Modify）

> 这一栏是 P4 implementer 的范围边界——以下每一项都"看起来该改"，但本任务**决定不改**。

| 范围 | 理由 |
|---|---|
| `models.py:82` `EntryBase` / `:116` `UserBase` | 被表模型 `Entry` / `User` 继承。加 serializer 会让 `Entry.model_dump()` 返回字符串，污染表模型（P0 §1.2.1 第 5 条 + 本次实测反证） |
| 25 个 `DateTime(timezone=False)` 列定义 | SQLite 下 `timezone=True/False` 行为完全一致（P0 实测），改列无效且会推翻 TPV0101 的 25 列 + 依赖守卫 |
| `backend/peekview/api/entries.py` / `shares.py` / `stars.py` / `files.py` 的端点契约 | 走 `JSONResponse(model_dump(mode="json"))` 或直接返回实例，serializer 落在模型上即自动生效，**端点零改动** |
| `backend/peekview/api/admin.py`（7 处 `response_model=`）/ `config_router.py`（3 处） | 这些 `response_model` 指名的类（`UserResponse` / `UserListResponse` / `AdminStatsResponse`）已在本任务覆盖范围内，契约落在类上即满足 P0 §1.2.1 第 2 条 |
| `backend/peekview/services/admin_service.py:1257` `_parse_db_datetime` | 解析备份文件里的 DB 字符串，不来自 API 响应，不会出现 `Z` |
| `frontend-v3/src/api/client.ts:196` `toggleEntryVisibility` / `:203` `updateEntry` | `updateEntry` 已支持 `is_public` + `team_id` 两字段，能力齐备；`toggleEntryVisibility` 保留给无团队维度的既有调用方 |
| `frontend-v3/src/views/PublishView.vue:124-166` 的发布页可见性控件 | 发布时选 ≠ 发布后切，语义不同源（P1 §6.4 显式排除） |
| `frontend-v3/src/components/FileTree.vue:9,32` 的 `Files · N` | 侧栏标题语义是"当前 entry 的文件总数"，且只在多文件时出现（`isMultiFile` 门槛），`1` 的情况本就不显示计数 |
| `ApiKeySettingsTab.vue:270-275` / `ApiKeyListView.vue:281-290` 的本地时间格式化 | 服务 API key 的 "Last used"，不在四项范围内；P1 已登记 SUGGEST 技术债 |
| `PublishResultPanel.vue:56` / `ProfileTab.vue:59` / `UserManagerTab.vue:152-162` 的 `toLocaleString` | 同属"无时区标识"同一类问题，但服务不同页面/字段，用户报告的缺陷是 Explore 卡片（P1 §6.2 结论：不构成同一问题） |
| `packages/mcp-server/src/tools/createEntry.ts:121` / `publishFiles.ts:551` | `new Date(...)` 补 `Z` 后由"错 8 小时"变正确，**代码零改动**；仅 P6 验证输出未意外变化 |
| `frontend-v3/src/components/OverflowMenu.vue` 本体 | 只**复用其 a11y 惯例**（`Escape` → `close()` → `triggerRef.focus()`）+ `aria-haspopup`/`aria-expanded` 写法，不改组件（其 `OverflowMenuItem` 无子菜单能力，见 §2.2 决策点 B）。`OverflowMenuSheet` 亦不改，但**被 `VisibilityMenu` 的 `variant="sheet"` 复用其呈现形态** |
| 完整 ARIA 菜单角色树（`role="menu"`/`menuitem`、方向键移动、`aria-controls` 关联） | P1 §9 显式留作独立任务（roadmap 追加编号），本任务只做最低可用门槛（BDD-30）+ `aria-haspopup`/`aria-expanded`（既有 `OverflowMenu.vue:13-14` 已有，照抄零成本） |
| `ConfirmDialog.vue` 本体 | 不改（D-2：`visibility-confirm` 定位改由 `VisibilityMenu` 侧的容器承担，不再要求 `ConfirmDialog` 支持 testid 透传——其根为 `<Teleport to="body">`，attrs 透传不产生 DOM 属性） |
| 既有 `.card-meta-text` / `.entry-meta` 的 `--c-text-tertiary` 颜色 | 本任务把时间改为**主显绝对时间**但**不改色**——该色对比度 3.04:1（亮）/ 3.84:1（暗）低于 AA 正文 4.5:1，属**既有债务**（D-6）。本任务不扩大范围修（改色会波及全部使用该变量的既有组件），登记为 SUGGEST（§7）。时间若改用 `--c-text-secondary`（5.25:1 / 7.26:1）是可选的一次性改进，不在 BDD 范围内 |

### 1.3 风险在哪（Risk）

| # | 风险 | 触发条件 | 缓解措施 |
|---|---|---|---|
| R1 | **mixin 被表模型继承 → 表模型序列化污染** | P4 误把 `UtcSerializeMixin` 加进 `EntryBase`/`UserBase`，或新增表模型时误继承 | BDD-08 断言表模型 `model_dump()` 仍为 `datetime`；`P5_fitness` 独立断言「mixin 不出现在任何 `table=True` 模型的 MRO」 |
| R2 | **覆盖不全导致静默错序** | 漏掉某个叶响应模型 | 不靠人工清单：`field_serializer("*")` 让**未来新增 datetime 字段自动纳入**；BDD-07 用遍历判据而非点名 |
| R3 | **BDD-02/03 的 tooltip 不可断言**（本次已实测） | 用原生 `title` 属性或 CSS `::after` 实现 tooltip | 强制实现为**真实 DOM 元素 + `visibility` 切换**（`opacity:0` 在 Playwright 下 `isVisible()` 仍为 true，会破坏 Given/When 区分） |
| R4 | **`useRelativeTime` 返回值扩字段 → 6 个既有测试文件断言失效** | `{relative, full}` → `{relative, full, absolute}`；`title` 属性改为 DOM tooltip | 显式登记需同步更新的断言面（§6.4）：3 个 `vi.mock` 文件 + 3 个直传 prop 的 spec + 2 处 `title` 断言。**禁止**静默改断言，P7 需记录"被本任务有意取代" |
| R5 | **TPV0095 BDD-40 断言与本任务直接冲突** | 4 单测 + 1 E2E 断言团队 entry **无** `visibility-toggle` | P3/P4 显式更新断言，P7 记录「TPV0095 BDD-40 被本任务有意取代」（陷阱 16） |
| R6 | **BDD-07 遍历口径与 P1 §6.9 清单不一致** | P1 给 15 类/31 字段，遍历判据实测命中 **16 类/34 字段**（多 `ShareCreateResponse` 的 3 字段） | P1 已声明该清单是"附录，非判据主体；随模型增删由遍历自动更新"→ 遍历口径为准。P3 断言用遍历，**不硬编码 15/31**；P6 记录该差异为预期 |
| R7 | **补 `Z` 后既有前端数值变化被误判为回归** | `archive_delete_at` 倒计时、share 过期、star 墓碑日期等 12 个文件的计算值改变（由错变对） | P6 做 before/after 对比（P1 §6.5 已登记），不当回归 |
| R8 | **CLI `--json` 输出格式变更影响第三方消费方** | 7 处 `.isoformat()` → `Z` 结尾 | CHANGELOG `[Unreleased]` + 升级说明；`Z` 与 `+00:00` 均为合法 ISO 8601，合规解析器不受影响；`client.py` 自身同步修（否则自伤） |
| R9 | **详情页新增菜单改变头部交互密度** | `EntryDetailHeader` 此前只有只读标签 | P6 桌面 1280x800 / 移动 390x844 双档截图 + 视觉契约（UI 设计节的 VC-1..VC-7 DOM 度量断言）；**R9 的专用契约是 VC-7**（`meta-row` 高度 ≤ 两行），不再是"无契约"状态 |
| R10 | **团队很多时子菜单可用性** | `teams.length` 很大 | 子菜单限高 + 滚动（`max-height` + `overflow-y:auto`）；用户已接受"一律子菜单" |
| R11 | **团队列表加载失败被误认为"无团队"**（D-9） | `team.ts:22-35` 的 `loadMyTeams()` catch 只置 `error`，不置 `teamsLoaded`、`allTeams` 保持空数组；而 `teams.length === 0` → 不渲染 Team 入口 | 菜单 Team 位在 `teamStore.error` 非空时渲染**禁用项 + 失败文案**（而非静默隐藏），并显式声明"加载失败按无团队降级，但此降级**不满足 BDD-17 的 Given**（BDD-17 前提是'用户不属于任何团队'而非'加载失败'）"。实现见 §3.5 状态表 `isTeamsFailed` |
| R12 | **P3 聚合命令的 `tail -30` 截断 traceback → TDD 红灯误判 A 类**（本轮实测新发现） | 全量套件的 warnings summary 约 15 行，`ModuleNotFoundError` 距 EOF 超过 30 行 → 被 `tail -30` 砍掉，只剩路径被缩写的 `ERROR - ImportError while importing test module '...'` → formatter 取不到 module → A 类假红 | `P3` 命令**去掉 `tail -30`**，改用 `-q --tb=short` 自身的紧凑输出（实测全量输出仅 68 行 / 5.3 KB，无需管道截断）。实测五格矩阵见 §8 V10 |

---

## 2. 决策点与候选方案

> **场景类型判定**（architect 方法论表）：本任务同时命中「复杂交互」（`ui_affected: true` + 多步操作 + 状态依赖）与「原型/验证」（`minimal_validation` 字段触发 + 外部系统依赖）。
> 按方法论先做最小验证（§8），**不可行的方案直接排除、不写进候选**；再对三个真实分叉点各列候选。
> `candidate_count: 7` = 下列 A1-A3 / B1-B2 / C1-C2 七个候选。

### 2.1 决策点 A — 后端序列化契约的落点形态

**背景**：P0 §1.2 定案"在叶响应模型加 `field_serializer`"，但**具体形态**未定（P0 原文："建议抽公共 Mixin（如 `UtcSerializeMixin`）避免 15 处重复；P2 定具体形态"）。

#### 候选 A1 — 逐字段 `Annotated[datetime, PlainSerializer(..., when_used='json')]`

每个叶模型的每个 datetime 字段改写成 `created_at: UtcDT`（31 处）。

- **优点**：字段级显式，类型即契约，IDE 与 `model_json_schema()` 可见；无继承风险（不引入 mixin，表模型天然不受影响）。
- **风险**：31 处重复；**未来新增的 datetime 字段默认不带**（新人只写 `datetime` 就漏）——这正是 P1 I-3「覆盖不全导致静默错序」的成因形态，只是把风险从"今天漏"推迟到"明天漏"。
- **工作量**：中（31 处机械替换 + 一次性核对）。

#### 候选 A2 — 共享 mixin 内的通配 `@field_serializer("*", when_used="json", check_fields=False)`

新增 `class UtcSerializeMixin(SQLModel)`，16 个叶模型改为继承它。

- **优点**：**未来新增的 datetime 字段自动纳入**（`"*"` 通配 + `isinstance(v, datetime)` 判定），与 BDD-07「遍历判据、新模型自动纳入、不靠人工维护清单」的实现形态**同构**；单点定义，`_utc_iso_z` 逻辑只有一份。
- **风险**：mixin 若被 `table=True` 模型继承会污染表模型（**已实测反证**：表模型 `model_dump(mode="json")` 也变 `Z`）→ 需一条架构适应度断言守住。
- **工作量**：低（1 个 mixin + 16 行基类声明）。
- **实测**：见 §8 V2——`when_used="json"` 下 python 模式仍返回 `datetime`；嵌套模型（子模型也继承 mixin）+ `list`/`dict` 容器均正确；`ShareCreateResponse` 经继承即得；非 datetime 字段原样透传。

#### 候选 A3 — 端点层统一 helper（每个返回点包一层 `to_json_safe`）

在 `api/*.py` 的每个返回点手动转换。

- **优点**：不碰模型层，表模型零风险。
- **风险**：改动散落到 4 个路由文件的所有返回点；`response_model=` 路径（admin 7 处 + config 3 处）会**重新校验并丢掉手工转换**（P0 §1.2.1 第 2 条），即两条返回路径行为分叉；新增端点靠人记得。
- **工作量**：高（且需逐端点验证两条路径）。

#### 选择：**A2**

理由（三条，按权重）：
1. **与判据同构**——BDD-07 的 When 是"遍历所有叶模型、检查每个 datetime 字段"，A2 的实现也是"通配序列化所有 datetime 字段"，两者是同一集合的两种表达；A1 的集合是"31 个手写位置"，与判据集合只能靠人工同步。
2. **A1 的核心缺点正是本任务要消灭的缺陷形态**——I-3 说的是"部分字段带 Z、部分不带 → 静默错序"。A1 把这个风险从"本次 31 处"降级为"下次新增 1 处"，而 A2 直接消除。
3. A3 被 P0 §1.2.1 第 2 条实测结论排除（`response_model` 重新校验会让手工转换静默消失）——**不作为候选保留到方案层**，此处仅记录排除依据。

**A2 的强制配套**（写入 §1.3 R1 与 `P5_fitness`）：`UtcSerializeMixin` **绝不**出现在任何 `table=True` 模型的 MRO 中；`EntryBase` / `UserBase` 保持 `(SQLModel)` 不变。

> `[SCOPE+]` 无需增补：A2 的覆盖范围 = BDD-07 遍历判据的命中集合（16 类 / 34 字段，见 §8 V4），**不改变** P1 §6.9 的任何既定契约，只让覆盖机制与判据对齐。

### 2.2 决策点 B — 可见性菜单的载体

**背景**：P0 决策 3 定"抽取 `VisibilityMenu` 组件三处复用"，但**是新建还是扩展既有组件**未定；`useEntryDetailActions.ts:47,78` 的现有 visibility 项走哪条路也未定（dispatch-context 明确"具体走哪条由你定"）。

#### 候选 B1 — 新建 `VisibilityMenu.vue`（自建菜单 + 复用 `ConfirmDialog.vue`）

- **优点**：菜单模型天然支持子菜单（Team ▸）与"排除当前态项"；三个调用点的 props 一致（`entry` / `teams` / `variant`）；可独立单测（选项构造下沉到纯函数 `visibility-options.ts`）；a11y 惯例从 `OverflowMenu.vue` **抄模式而非改组件**。
- **风险**：新增一个菜单实现，与 `OverflowMenu` 存在样式/行为重复（可接受：两者用途不同——一个是"动作列表"，一个是"单选状态切换"）。
- **工作量**：中（1 组件 + 2 纯函数 + 1 二次确认接线）。

#### 候选 B2 — 扩展 `OverflowMenu.vue` 支持子菜单，各处传 `items`

- **优点**：复用既有组件，菜单外观天然一致，`Escape`/焦点回归/点击外部关闭全部免费。
- **风险**：`OverflowMenuItem`（`OverflowMenu.vue:79-89`）是**平铺模型**，加子菜单要改接口 → 波及 **3 处**既有 `<OverflowMenu` 调用方（`EntryDetailHeader.vue:53`、`EntryDetailMobileBar.vue:50`、`settings/UserManagerTab.vue:38`；实测 grep 命中 3 处，另加 T052 的 E2E 断言 `text=Make Private`）；且"排除当前态项 + 子菜单排除当前团队"是**状态语义**，塞进通用动作列表模型会让 `OverflowMenu` 承担业务规则。
- **工作量**：高（改公共组件 + 3 处调用方回归 + 既有 E2E 断言连带）。

#### 选择：**B1**

理由：B2 的收益（复用外观）抵不上代价（改公共组件接口 → 3 处调用方 + 既有 E2E 断言连带回归），且 B2 会让"单选状态 + 排除当前项"这类业务规则泄漏进通用动作列表组件。B1 把业务规则全部收敛在 `visibility-options.ts` 纯函数里（BDD-16/17/18 可直接单测），组件只管渲染与 a11y。

**B1 的强制配套**：a11y 按 `OverflowMenu.vue:113-156` 的既有惯例实现（`close()` 内 `triggerRef.value?.focus()`；`Escape` 与 `Tab` 均关闭；`onMounted`/`onUnmounted` 成对增删 `document` 监听）——BDD-30 直接对标该行为。

**样式与 `OverflowMenuDropdown` 保持一致性的机制**（design-review 2.6 扣分依据 2）：`VisibilityMenu` 的菜单容器**对齐 `OverflowMenuDropdown` 的 token 组合**——`var(--c-surface)` 背景 / `var(--c-border-strong)` 边框 / `var(--radius-md)` 圆角 / `var(--shadow-md)` 阴影，仅 Team 子菜单的缩进为新增。两者共用同一组 token 即保证视觉不漂移；不要求共用 CSS 规则（两个组件的 DOM 结构不同，强行共用会产生选择器耦合）。

> **裁决已定（原 `[NEEDS_P2_REVIEW_DECISION]`，plan-design-review §4 裁决 1 = 采纳"移除"）**：`useEntryDetailActions.ts:72-80` 的 `Make Public`/`Make Private` overflow 项**移除**（D6）。三条硬理由：① overflow 项只能表达二元公开/私有，**无法表达 Team 态**——对 team entry 它显示 `Make Public`（依据 `isPublic` 判定）但后端 `entry_service.py:846-856` 会对非空 team 强制落回 private，正是本任务要修的缺陷形态复现；② 不存在"零入口"窗口（`mount-detail` 批同时交付 `useEntryDetailActions.ts` 与 `EntryDetailHeader.vue`）；③ 入口单一化是 P0 决策 3 的立项动机。连带的既有断言更新面见 §6.4 第 9 项（**只改 E2E，不改 `t052-header-redesign.test.ts:100` 字面量**）。

### 2.2b 布局维度：详情页可见性入口的落位取舍（design-review 3.3 补记）

入口**落位**层只有"只读 `status-tag` → inline 菜单"一个候选，此处补记被排除的三个替代：

| 替代落位 | 为何不选 |
|---|---|
| 保留只读标签 + 新增独立图标按钮 | 同一可见性语义在头部出现两个元素，读屏与目视都会困惑；且 `.status-tag` 与按钮的视觉权重打架（design-review 2.6 已指出该风险） |
| 仅收敛进 overflow 菜单（不新增头部入口） | 违背 BDD-23「桌面头部 + 移动元信息条**均**出现入口」的硬约束 |
| 放在 `title-row` 的 `actions-area` 而非 `meta-row` | `actions-area` 承载的是「分享 / 编辑 / 删除」等**动作**，可见性在此会与"状态展示"这一语义脱节；且移动端 `title-row` 被折叠，BDD-23 的移动入口仍需 `EntryMetaTagsBar`，造成两套落位 |

### 2.3 决策点 C — 时间 tooltip 的实现形态

**背景**：BDD-02/03 要求"悬停后出现的提示文本同时包含相对时间、完整偏移、IANA 时区名"。**能否被 E2E 断言**取决于实现形态——这是本任务唯一可能到 P6 才发现不可行的假设，故做了三组实测（§8 V5/V6）。

#### 候选 C1 — 原生 `title` 属性

`<span :title="full">`（现状形态，只是内容变丰富）。

- **优点**：零成本、无 DOM 增重、浏览器原生 tooltip、移动端长按也可显示。
- **实测缺陷**：Playwright `getByText('3h ago')` **悬停前后均命中 0**（原生 tooltip 不在 DOM 中）→ BDD-02/03 只能读 `title` 属性字符串，无法验证"悬停**后**出现"。且 Given/When 失去意义（属性始终存在）。
- **工作量**：最低。

#### 候选 C2 — 自定义 DOM tooltip 元素（`visibility: hidden ↔ visible` + `role="tooltip"`）

主显与 tooltip 都是真实 DOM 节点，CSS 在 `:hover` / `:focus-within` 时切换 `visibility`。

- **优点**：**唯一可断言的形态**（实测：悬停前 `isVisible()=false`、悬停后 `true`、移开回到 `false`、`:focus-within` 也为 `true`，且 `getByText` 命中、`textContent` 可读）；同时天然获得键盘可达性（`focus-within` 让键盘用户也能看到 tooltip）；样式完全可控（暗色主题、换行、`max-width`）。
- **风险**：DOM 增重（每处 +1 节点）；需处理层级（`z-index`）与溢出；**不能**用 `opacity:0` 做隐藏（实测 `opacity:0` 元素 `isVisible()` 仍为 `true`，会让"未悬停"也判可见，破坏 BDD-02 的 Given/When 区分）。
- **工作量**：低-中（一个 `TimeDisplay.vue` + 样式）。

#### 候选 C3 — CSS `::after` + `content: attr(data-tip)`

- **优点**：无额外 DOM 节点，样式与动画最轻。
- **实测缺陷**：`getByText` **命中 0**、`textContent` 不含伪元素内容（伪元素不在 DOM 树内），只能靠 `getComputedStyle(el, '::after').content` 读字符串——该断言绑定了实现细节（伪元素），与 BDD-30"不绑属性名"的取向相悖；且伪元素内容不可选中、不可访问（读屏软件不读）。
- **工作量**：低。

#### 选择：**C2**

理由：BDD-02 的 When 是"鼠标悬停"，Then 是"出现的提示文本包含 …"。只有 C2 能让"出现"这件事在 DOM 层可观测（`isVisible()` 由 `false`→`true`），C1/C3 都让提示内容**常驻**（属性/伪元素），Given 与 When 退化为同一状态，判定强度实际下降。附带收益：`focus-within` 让键盘用户也能看到提示，与 BDD-30 的可访问性取向一致。

**C2 的强制配套**：`visibility` 切换（**不得**用 `opacity` / `display:none` 之外的等价手段替代 `visibility`——`display:none` 亦可，但 `visibility` 保留布局测量能力）；tooltip 加 `role="tooltip"` + `data-testid="time-tooltip"` 供 E2E 稳定定位。

### 2.4 批次设计（dispatch_plan）

`mode: static-batch`，5 批，`parallel_limit: 5`（**实际并发建议 2**：含 E2E 的批次属资源密集型，按 dispatch-protocol 默认串行）。

| 批 id | 交付能力（垂直切片） | complexity | 改动文件（`output`） | 边界依据 |
|---|---|---|---|---|
| `backend-serialize` | 所有叶响应模型 JSON 输出带 `Z`，CLI/API 同形，CLI remote 可解析 `Z` | medium | `timefmt.py`(新) / `models.py` / `client.py` / `cli.py` / `admin_service.py` / `tests/test_utc_serialization.py`(新) | 纯后端，与前端零文件重叠 |
| `frontend-shared` | 时间格式化/选项构造/菜单组件/store 能力就绪（尚未挂载） | medium | `useRelativeTime.ts` / `TimeDisplay.vue`(新) / `visibility-options.ts`(新) / `visibility-target.ts`(新) / `VisibilityMenu.vue`(新) / `stores/entryList.ts` / `stores/entryDetail.ts` | 全部是叶子/共享件，不被后续批二次修改 |
| `mount-explore` | Explore 卡片与列表：新时间显示 + 文件数 `>=2` + 可见性菜单 + toast 四态 | medium | `EntryCard.vue` / `EntryListRow.vue` / `EntryListView.vue` | 两个渲染点 + 其父视图，同批一次改完 |
| `mount-detail` | 详情页：桌面头部/移动元信息条菜单 + 新时间显示 + 0 文件空态 + 团队列表加载 | medium | `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue` / `EntryDetailContent.vue` / `EntryDetailView.vue` / `useEntryDetailActions.ts` | 详情页三个渲染点 + 其父视图 |
| `docs-changelog` | CHANGELOG `[Unreleased]` + 升级说明 | low | `CHANGELOG.md` / `docs/process/upgrading.md` | 文档，无代码依赖 |

**Tracer Bullet（判据一）**：`backend-serialize` 承担曳光弹角色——它是**唯一能端到端验证「API 响应带 Z → 前端 `new Date()` 得正确瞬间」这条关键路径**的批；其 `tests_filter` 覆盖冒烟级验证（一个端点的 `Z` 后缀 + 一个前端 `new Date(带Z字符串)` 断言），而非该批的完整单元测试。后续批按常规批级验证走；任务级红灯基线仍由 `gate_commands.P3` 承担。

**Vertical Slice（判据二）**：批 id 均回答"交付了什么能力"而非"动了哪层代码"。`frontend-shared` 是唯一例外（按技术层切）——**理由**：它交付的是被两个挂载批共同消费的叶子件，若拆进挂载批会导致同一文件被两批各改一次（违反"同一文件不跨批次被改两轮"），故单列为共享件批。

**Architecture Fitness（判据三）**：见 `gate_commands.P5_fitness`（mixin 不污染表模型）。

**`tests_filter`**（批级绿灯，非全量）：
- `backend-serialize`: `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=no`
- `frontend-shared`: `cd frontend-v3 && npx vitest run src/composables src/utils src/components/__tests__/visibility-menu.spec.ts`
- `mount-explore`: `cd frontend-v3 && npx vitest run src/components/__tests__/EntryCard src/components/__tests__/EntryListRow src/components/__tests__/tpv0095-entry-card-team.spec.ts src/components/__tests__/tpv0095-entry-list-row-team.spec.ts`
- `mount-detail`: `cd frontend-v3 && npx vitest run src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts src/components/__tests__/t067-detail-framework.spec.ts`
- `docs-changelog`: 无（文档批，`check-changelog` 属 P8）

**`expected_red` 提示**：`backend-serialize` 批的 `tests_filter` 在 P3 红灯基线期**应红**（该批交付面测试先于实现）；`mount-explore` / `mount-detail` 批会因 TPV0095 BDD-40 断言（陷阱 16 / R5）在设计上应红，须在 `P4-evidence/{batch}.log` 的 `expected_red` 键登记。

---

## 3. 详细设计

### 3.1 后端：`timefmt.py`（新增，零依赖）

```python
from datetime import datetime, timezone

def utc_iso_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return aware.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
```

约束：
- `parse_iso` **必须**做 `Z` 替换（CPython 3.10 的 `fromisoformat` 不接受 `Z`，`requires-python >=3.10`）。
- `utc_iso_z` 对 naive 值按 UTC 处理（DB 全表 naive 值经验证精确等于 UTC，P0 §1.2.3 三种独立方法确认）。

### 3.2 后端：`UtcSerializeMixin`（`models.py`）

```python
class UtcSerializeMixin(SQLModel):
    @field_serializer("*", when_used="json", check_fields=False)
    def _serialize_utc(self, value, _info):
        return utc_iso_z(value) if isinstance(value, datetime) else value
```

**为什么是通配 + `isinstance` 而不是逐字段列举**：见 §2.1 选择理由 1/2。

**硬约束（不可协商）**：
1. `when_used="json"` **必须显式声明**——默认 `always` 会让 `model_dump()`（python 模式）也返回字符串，破坏所有按 datetime 消费的服务层代码（P0 §1.2.1 第 1 条）。
2. `check_fields=False` **必须**——mixin 自身无字段，否则 Pydantic 报字段不存在。
3. `UtcSerializeMixin` **绝不**被任何 `table=True` 模型继承；`EntryBase` / `UserBase` 的基类声明保持 `(SQLModel)`。
4. 非 datetime 值**必须原样透传**（通配序列化器会经过所有字段，包括 `dict` / `list` / `str` / `int`）。

### 3.3 后端：16 个叶响应模型的基类替换

逐个把 `class X(SQLModel):` → `class X(UtcSerializeMixin):`。清单见 §1.1 A3。

**不动的两个**：`EntryBase:82`、`UserBase:116`（被表模型继承）。
**不单独改的一个**：`ShareCreateResponse:1196`（继承 `ShareResponse`，经继承即得——实测确认继承链上的序列化器生效）。

**`response_model` 契约核对**（P0 §1.2.1 第 2 条）：本项目 10 处 `response_model=` 指名的类为 `UserResponse` / `UserListResponse` / `AdminStatsResponse` 等，其中含 datetime 的类（`UserResponse` / `EntryStats` 经 `AdminStatsResponse`）**均在本任务覆盖范围内** → 契约落在 `response_model` 指名的那个类上，无"重新校验丢 Z"风险。P3 须为这条写一条断言（遍历 `api/` 的 `response_model=` 指名类，断言其在覆盖集合内）。

### 3.4 前端：时间显示（`useRelativeTime.ts` + `TimeDisplay.vue`）

**`formatRelativeTime(dateStr)` 契约**：

| 输入 | 输出 |
|---|---|
| 无法解析（`Number.isNaN(d.getTime())`） | `''`（空串） |
| 未来（`diffMs < 0`） | `in ${n}m` / `in ${n}h` / `in ${n}d` / `in ${n}w` / `in ${n}mo` / `in ${n}y` |
| `< 60s` | `just now` |
| 其余 | `${n}m ago` / `h` / `d` / `w` / `mo` / `y`（现状分级保留） |

> 未来时间用 `in N…` 而非 `just now`：BDD-06 要求"方向正确"。`N` 取绝对值。

**`formatFullDate(dateStr)` 契约**（主显，`shortOffset`）：

```ts
new Date(dateStr).toLocaleString(undefined, {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZoneName: 'shortOffset',
})
```
无效日期 → `'—'`（不含 `NaN`，满足 BDD-05）。

**`formatTooltip(dateStr)` 契约**（`longOffset` + IANA 名）：

```ts
const full = new Date(dateStr).toLocaleString(undefined, {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZoneName: 'longOffset',
})
return `${formatRelativeTime(dateStr)} · ${full} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
```
无效日期 → `'Invalid date'`。

**硬约束**：
- **禁止** `dateStyle`/`timeStyle` 与 `timeZoneName` 共存（`TypeError: Invalid option`，陷阱 7）。
- **禁止**字符串拼接时区名（`zh-CN` 下时区名位于时间**之前**，陷阱 8）——时区名单独作为 tooltip 的第三段是**允许**的（它不在 `toLocaleString` 的输出里），但**墙钟时间与偏移必须整体交给 `toLocaleString`**。
- 用 `shortOffset`/`longOffset`，**不用** `short`（`EST`/`CST` 歧义，陷阱 9）。

**`TimeDisplay.vue`**（新增）：

```vue
<template>
  <span class="time-display" data-testid="time-display">
    <span class="time-display__main">{{ absolute }}</span>
    <span class="time-display__tip" role="tooltip" data-testid="time-tooltip">{{ full }}</span>
  </span>
</template>
```
```css
.time-display { position: relative; display: inline-flex; }
/* 浮层：桌面左对齐；移动端右对齐（防 390px 视口溢出）。不设 ellipsis——
   BDD-02 要求三段文本完整可读，截断会让断言文本缺失。 */
.time-display__tip {
  position: absolute; top: calc(100% + var(--space-1)); left: 0;
  visibility: hidden; white-space: nowrap; z-index: 10;
  max-width: 320px;
}
@media (max-width: 640px) {
  .time-display__tip { left: auto; right: 0; white-space: normal; }
}
.time-display:hover .time-display__tip,
.time-display:focus-within .time-display__tip { visibility: visible; }
```

props：`dateStr: string`；内部用 `useRelativeTime(toRef(() => props.dateStr))`。

**实现约束（P4 不可自行变更）**：

1. **根节点必须带 `data-testid="time-display"`**（§3.8 清单与模板必须一致——上一轮清单有、模板漏写，`data-testid` 落在根 `<span>` 上）。
2. **`z-index` 取 `10`，不取 `30`**：`DESIGN.md` §4 的 Z-Index Scale 六档为 Base 0 / Sticky+tooltips **10** / Drawer+Dropdown 100 / Drawer panel 101 / Modal backdrop 200 / Modal content 210 / Toasts 300。上一轮的 `30` **不在任何档位上**；更要紧的是 `EntryDetailHeader.vue:161` 的 `.mobile-sticky-header` 是 `z-index: 50`，**高于 30** → 移动端详情页里 tooltip 上浮到 sticky header 区域会被盖住。取 10 与"Sticky+tooltips"档位语义一致；tooltip 与 sticky header 的遮挡关系由 **VC-1 + P6 移动端截图**共同核对（档位语义上 tooltip 低于 sticky header 是**设计系统既定**的取舍，故不要求 tooltip 盖住 sticky header）。
3. **不得用 `opacity: 0` 隐藏**（实测 `isVisible()` 仍为 true，破坏 BDD-02 的 Given/When 区分，见 §8 V6）；用 `visibility`。
4. **移动端 tooltip 右对齐 + 允许换行**：`left: 0` + `nowrap` + `max-width: 320px` 在 390px 视口下，若时间文本落在 `EntryMetaTagsBar`（`flex-wrap`）行尾，320px 左对齐展开会溢出容器右侧（D-7）。故 `@media (max-width:640px)` 改 `left: auto; right: 0` 并允许 `white-space: normal` 换行。
5. **必须去掉 `text-overflow: ellipsis`**：BDD-02 的 Then 要求提示文本**同时包含**相对时间、完整偏移、IANA 时区名三段。`ellipsis` 会在 `max-width: 320px` 下截断，导致 E2E 读到的 `textContent` 仍完整（CSS 截断不改 DOM 文本）但**用户看不到**——即"断言绿而体验红"。三段文本最坏长度估算 ≈ 9 + 3 + 28 + 3 + 20 ≈ 63 字符，11px 字体下约 420px > 320px，故**必须**允许换行而非截断。
6. **attrs 透传必须受控**：TimeDisplay 的根与 tooltip 各有一个 `data-testid`，若父组件透传 `data-testid` 会与硬编码字面量冲突（`inheritAttrs` 默认 `true`，根节点上的静态 `data-testid` 与透传的同名 attr 合并时字面量胜出、但 tooltip 节点的 `data-testid="time-tooltip"` 与根节点无冲突）。四处的父组件**不传** `data-testid`，故按默认 `inheritAttrs` 即可；若 P4 需要传，须显式 `defineOptions({ inheritAttrs: false })` 并自行绑定。**`data-testid="time-tooltip"` 必须字面写在 tooltip 节点上，不得由父级透传**（§6.4 第 6 项与 E2E 都依赖它）。

**为什么抽组件而不是四处各写**：BDD-03 要求三处（列表卡片 / 详情桌面头部 / 详情移动元信息条）**规则一致**——单组件是这条的机制保证；且 tooltip 的 DOM 结构只需在一处维护。

### 3.5 前端：可见性菜单

#### `visibility-options.ts`（纯函数，BDD-16/17/18）

```ts
type VisibilityTarget =
  | { kind: 'public' }
  | { kind: 'private' }
  | { kind: 'team'; teamSlug: string; teamName: string }

// 子菜单项 === 既有 Team 类型（types/index.ts:14-18，{slug, name, memberCount}）；
// 不新增字段、不引入 id——注意 Team 与 TeamRef 都**没有**数字 id。
type TeamOption = Team

function buildVisibilityOptions(input: {
  isPublic: boolean
  currentTeamSlug: string | null   // = entry.team?.slug ?? null；"当前团队"的唯一来源
  teams: Team[]                    // teamStore.allTeams
  teamsFailed?: boolean            // teamStore.error !== null；见本条规则 6
}): { items: VisibilityTarget[]; teamSubmenu: TeamOption[]; teamsFailed: boolean }
```

> **"当前团队"只有一个来源（N-1 修正）**：`Team` / `TeamRef` / 后端 `TeamSummary` **都没有数字 id**（`types/index.ts:9-18`、`models.py:747-752`、`models.py:947-952`），故**不得**用 `teams.find(t => t.id === …)`——`tsc` 直接报错（CI 强制），且 BDD-18 的"排除当前团队"没有可用派生路径。
>
> **唯一派生路径**：`const currentTeamSlug = entry.team?.slug ?? null`（`Entry.team: TeamRef | null`，`api/client.ts:130` 已由后端 `_team_ref()`/`team_map` 填充），子菜单按 **slug** 比对：
> ```ts
> const otherTeams = computed(() => teams.filter(t => t.slug !== currentTeamSlug.value))
> ```
> 找不到（团队列表未加载、或列表不含该团队）时按"无当前团队"处理，子菜单不排除任何项。`Entry.teamId`（数字，`types/index.ts:50`）是 entry 侧的归属 ID，**不能**用于与 `Team` 匹配（`TeamOption` 无 id 可匹配），本小节不使用它。
>
> **为什么 `entry.team` 在 Explore 两个面上都可用（通路已实测）**：`api/client.ts` 的两条 transform 都填了 `team`——列表 `transformListItem:107`（`:182` 的响应映射用它）、详情 `transformEntry:130`（`:193/200/205` 三处）。两者都从后端 `EntryListItem.team` / `EntryResponse.team: TeamRef | None`（`models.py:765/803`）取值，后端由 `entry_service.py:717` 的 `team_map = {t.id: TeamRef(slug=t.slug, name=t.name)}`（列表批量）/ `:1261` 的 `_team_ref()`（单条）填充。故 BDD-18 的"排除当前团队"在卡片、列表、详情三处**都**有派生路径。

规则（逐条对应 BDD）：
1. 当前态项**不出现**（而非置灰）——BDD-16。
2. `teams.length === 0` → `teamSubmenu` 为空数组，且**不产生** `Team` 入口——BDD-17。
3. Team 恒为子菜单（不做"≤8 平铺"的魔法阈值），子菜单**排除当前团队**——BDD-18。
4. `Team` 入口自身**不带** `onSelect`（不直接执行切换）——BDD-18 后半。
5. 三态的**判定口径写死**（`currentTeamSlug !== null` 即 team entry）：当前为 team entry（`currentTeamSlug !== null`，不论 `isPublic`）→ `items` 含 `public` + `private`（+ Team 子菜单）；当前为 public（`currentTeamSlug === null && isPublic`）→ 含 `private` + Team；当前为 private（`currentTeamSlug === null && !isPublic`）→ 含 `public` + Team。**不得**用 `entry.teamId` 判 team 态（虽同为 entry 侧字段，但本函数的入参只有 `currentTeamSlug`，混用会造成两套判定源）。
6. **`teamsFailed`**（D-9 / R11）：由调用方传入 `teamStore.error !== null` 的信息 → 见下方"团队加载失败"节。为避免纯函数依赖 store，`buildVisibilityOptions` 的 `teamsFailed` 由视图层作为第 4 个可选入参传入：`teamsFailed?: boolean`（缺省 `false`）。当 `teamsFailed: true` 时，`teamSubmenu` 仍为空、但返回 `teamsFailed: true` 供组件渲染**禁用项 + 失败文案**而非静默隐藏。

#### `visibility-target.ts`（纯函数，BDD-19/20/27/28/29）

```ts
function toPatchPayload(t: VisibilityTarget): UpdateEntryPayload {
  if (t.kind === 'public')  return { is_public: true,  team_id: null }  // 两字段同传
  if (t.kind === 'private') return { is_public: false, team_id: null }
  return { team_id: t.teamSlug }                                        // 后端强制 is_public=false
}
function needsConfirm(t: VisibilityTarget): boolean { return t.kind === 'public' }
```

**为什么 `public` 必须两字段同传**：后端 `entry_service.py:846-856` 的 `is_public` 分支在 `entry.team_id !== None` 时无法变 public（只能落 private）；清团队要 `team_id_set` 为真且 `team_id is None`（`:808-818`）。只传 `is_public: true` 会停在 private——这是 BDD-19「团队清空」判据的依据。

**为什么 `private` 也传 `team_id: null`**：BDD-29（Team A → Private 必须清团队且保持非公开）。`is_public:false` + `team_id:null` 在后端走"清团队 → 再置 is_public=false"，两步都成立。BDD-20（Public → Private）时 team 本就为 null，多传 null 无副作用（幂等）。

**为什么 `team` 只传 `team_id`**：后端对非 null team 强制 `is_public=false`（`:811-814`），无需前端重复声明；BDD-27（Private → Team A）与 BDD-28（Team A → Team B）均由此单字段完成。

#### `VisibilityMenu.vue` 完整契约（D-1 / D-2 / D-10 修订）

**props**

| prop | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entry` | `Entry` | ✓ | 当前 entry（取其 `isPublic` / `team?.slug`） |
| `teams` | `Team[]` | ✓ | `teamStore.allTeams` |
| `variant` | `'icon' \| 'inline' \| 'sheet'` | — | **由父组件显式传入、写死，组件内不做自动切换**（N-2 裁定，见下方「`variant` 的切换主体」）：`icon` = 卡片/列表的图标按钮位（默认）；`inline` = 详情页桌面头部的行内标签位；`sheet` = 移动端底部浮层形态（D-4） |
| `disabled` | `boolean` | — | **D-1 补入**：父组件传入 `inFlight` 状态 → 触发按钮 `disabled` + `aria-disabled`，菜单项不响应点击（BDD-24）。上一轮正文引用了 `props.disabled` 但 props 声明里没有 |
| `teamsFailed` | `boolean` | — | `teamStore.error !== null`；为真时 Team 位渲染禁用项 + 失败文案（R11） |

> **`currentTeamSlug` 仍不是 prop**：组件内由 `entry.team?.slug ?? null` 派生后传给纯函数（`Team` / `TeamRef` 均无数字 id，见 §3.5 `visibility-options.ts`）。上一轮把它列在 props 表是重复来源，本版维持"删除"，但纯函数的入参改名为 `currentTeamSlug`（是**派生值**，不是 prop）。

**`variant` 的切换主体（N-2 裁定：选 ② 视图层下发，写死不留 P4 发明空间）**

三选一的裁决与理由：

| 选项 | 内容 | 裁定 |
|---|---|---|
| ① | 新增 `useMediaQuery` composable，组件内自动切换 | ✗ 否决：多实例各建一份监听（Explore 一页 N 张卡 = N 个 listener）；单测需逐个 stub `matchMedia` |
| **②** | **视图层用既有的 `useResponsiveLayout()` 算 `isMobile`，作为 `variant` prop 下发** | **✓ 采纳**——见下方写死的接线 |
| ③ | 本任务不做 sheet，Explore 侧只用桌面下拉 + §7.1 登记 debt | ✗ 否决：等于把 D-4 的 `DESIGN.md:274`「bottom sheet on mobile」违约留给后续，D-4 的修复在 Explore 两个面上不落地 |

**为什么是 ② 而不是 ①**：项目**已有**响应式机制——`src/composables/useResponsiveLayout.ts`（`viewportWidth` + `isMobile = viewportWidth <= 640` + `handleResize`（rAF 节流）），已在 `EntryDetailView.vue:156`、`UserManagerTab.vue:87` 使用。`useMediaQuery` 全仓 0 命中，本项目不引入第二套。

**写死的接线（P4 照此实现，不得改用其它路径）**：

```ts
// EntryListView.vue：:262 的 import 需补 onBeforeUnmount（当前只有 onMounted/watch/nextTick）
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
const { isMobile, handleResize } = useResponsiveLayout()
onMounted(() => window.addEventListener('resize', handleResize))       // 与 :784 既有 onMounted 同处
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))
// 模板（:169-190 两处绑定）：卡片/列表按 viewport 切 sheet
//   <EntryCard :variant="isMobile ? 'sheet' : 'icon'" … />  /  <EntryListRow 同上 />
```

- `EntryDetailView.vue:156` **已有** `const { isMobile, handleResize } = useResponsiveLayout()`，且 `:217`/`:227` 已 `addEventListener`/`removeEventListener('resize', handleResize)` —— **零改动**即可用。下发：
  - `EntryDetailHeader`：`:variant="isMobile ? 'sheet' : 'inline'"`。该组件 `v-if="isDesktop"`（`EntryDetailHeader.vue:13`），故实际恒为 `inline`；写成条件只为契约完整，不引入新行为。
  - `EntryMetaTagsBar`：`:variant="isMobile ? 'sheet' : 'inline'"`。该组件仅在 `isMobile` 时渲染（`EntryDetailContent.vue:24`），故实际恒为 `sheet` —— 这就是 D-4 在详情页移动端的落地形态（P1 BDD-23 的移动入口）。
- `EntryCard.vue` / `EntryListRow.vue`：新增 `variant` prop 并**原样透传**给 `VisibilityMenu`，自身不解释该值。
- 390×844（`Mobile Chrome` project）下 Explore 卡片/列表 → `sheet`（`Teleport to="body"`）；1280×800 → `icon`（桌面下拉）。

**为什么 sheet 在 Explore 两个面上也需要 `Teleport to="body"`**（上一轮只解释了详情页）：卡片与列表**不在** `.content-area` 内，但各自有独立裁剪面——`.entry-panel { overflow: hidden }`（`EntryListView.vue:1117-1122`，列表模式容器）与 `.card-actions { z-index: 1 }`（`EntryCard.vue:206-213`）。浮层若就地渲染会被 `overflow:hidden` 裁掉或压在下层卡片下，故 `Teleport` 对两个面同样必要。

**emits**

| 事件 | 载荷 | 时机 |
|---|---|---|
| `select` | `[target: VisibilityTarget]` | 菜单项点击且（若 `needsConfirm`）二次确认**已确认**后。**组件内不发请求**，由视图层调 store + 出 toast |
| `confirm-cancel` | `[]` | **D-1 补入**：二次确认被取消。供父层恢复焦点/重开菜单（D-10） |

**内部状态（D-1 要求列成表——上一轮散落正文，implementer 需自定状态机）**

| 状态 | 类型 | 初值 | 用途 | 转换 |
|---|---|---|---|---|
| `isOpen` | `ref<boolean>` | `false` | 菜单展开态 | 触发按钮 `Enter`/`Space`/点击 → `true`；`Escape` / `Tab` / 点击外部 / 选中项 → `false` |
| `isTeamSubmenuOpen` | `ref<boolean>` | `false` | Team 二级浮层展开态 | 点 `Team` 项 / `Enter`/`Space` → `true`；`Escape` → 先关子菜单（`false`）再关菜单；选中某团队 → 两级同关 |
| `pendingTarget` | `ref<VisibilityTarget \| null>` | `null` | 等待二次确认的目标 | 点需确认的项 → 存值并开确认框；确认 → `emit('select', pendingTarget)` 后清空；取消 → 清空 + `emit('confirm-cancel')` |
| `isConfirming` | `computed<boolean>` | `false` | `pendingTarget !== null`，驱动 `ConfirmDialog` 的 `v-model:visible` | 同上 |
| `triggerRef` | `ref<HTMLElement \| null>` | `null` | 触发按钮引用，供 `close()` 回归焦点 | — |

**可见文案与 `aria-label`（N-4 补齐——上一轮只给了图标名，P4 需自行发明文案；icon-only 按钮无读屏名称是硬缺陷）**

**① 触发按钮的可见文案（按 `variant` × 三态）**

| `variant` | 三态可见文案 | 依据 / 与现状的关系 |
|---|---|---|
| `inline`（详情页桌面 `meta-row`；`EntryMetaTagsBar` 在移动端取 `sheet`，见 §3.7） | `Public` / `Private` / `仅团队可见 · {{ team.name }}` | **逐字沿用现状**（`EntryDetailHeader.vue:68-72`、`EntryMetaTagsBar.vue:7-11`）。D8 是"只读标签原位替换为按钮"，换的是元件不是文案——沿用可保证 TPV0095 的三态文案断言（中文"团队" + `Proj A`、`Private`、`Public`）语义不变，只是定位方式改 `data-testid` |
| `icon`（Explore 卡片 `card-actions` / 列表 `entry-actions`） | **无可见文字**，仅 Lucide 图标（`Globe`=当前 public、`Lock`=当前 private、`Users`=当前 team），尺寸 14（卡片）/16（列表） | 与现状一致：`EntryCard.vue:9-12` / `EntryListRow.vue:99-102` 本就是 icon-only（现状用 `:title` 语义，本版改由 `aria-label` + 菜单承载）。**不得**为容纳文字而加宽按钮——VC-4 与卡片密度（§7.1 S2）都不允许 |
| `sheet`（移动端底部浮层） | 触发按钮同 `icon`（无可见文字）；浮层标题固定 `可见性`（英文环境 `Visibility`） | 标题复用 `OverflowMenuSheet.vue:16` 的 `.sheet-title` 位（既有先例写 `More actions`）；未选中态不显示额外文案 |

**② 触发按钮的 `aria-label`（所有 `variant` 都必须有——icon-only 变体尤其）**

`aria-label` 取**当前状态**而非动作名（读屏用户先要知道"现在是什么"，动作由菜单展开后的项承担）：

```ts
// 唯一文案来源：纯函数 visibilityStatusLabel(entry)
function visibilityStatusLabel(entry: Entry): string {
  if (entry.team) return `仅团队可见 · ${entry.team.name}`
  return entry.isPublic ? 'Public' : 'Private'
}
// 触发按钮：可见文本（inline）与 aria-label（所有变体）共用它
const label = visibilityStatusLabel(entry)
// :aria-label="`Visibility: ${label}`"
```

- 照抄 `OverflowMenu.vue:14` 的先例（`:aria-label="variant === 'sheet' ? 'More actions' : 'More'"`）——该文件是全仓唯一给 icon-only 触发按钮补 `aria-label` 的既有惯例，本组件对齐它。
- 三态 `statusLabel` 直接复用上表 `inline` 的文案函数（**同一函数**，避免两处文案漂移）：`visibilityStatusLabel(entry)` 纯函数，`inline` 变体的可见文本与所有变体的 `aria-label` 共用它。
- 语言：既有 `aria-label` 惯例为英文（`OverflowMenu.vue` `'More actions'`、`EntryDetailHeader.vue:22,27,30,43,46` `'Toggle file tree'` / `'Table of Contents'` / `'Show source code'` / `'Copy'` / `'Share'`）。本任务**沿用英文** `Visibility: ${statusLabel}`，与既有惯例一致；不新造中文 ARIA 词（三态 `statusLabel` 里的"仅团队可见"是**可见文案**照现状沿用，aria-label 前缀保持英文）。
- **与 `aria-haspopup` / `aria-expanded` 并列**（同一条 `<button>` 上）：`aria-label` + `aria-haspopup="true"` + `:aria-expanded="isOpen"` 三者同时存在，无互斥。

**③ 菜单项文案（供 P3 断言，写死不发明）**

| 项 | 可见文案 | `data-testid` |
|---|---|---|
| Public | `Public` | `visibility-item-public` |
| Private | `Private` | `visibility-item-private` |
| Team 入口（子菜单触发器，**非团队态才出现**） | `Team` | `visibility-item-team` |
| 子菜单项 | `{{ team.name }}` | `visibility-team-option-{slug}` |
| 加载失败禁用项 | `团队列表加载失败`（`disabled` + `title` 同文案） | `visibility-item-team`（同 testid，靠 `disabled` 区分） |

> 文案一律英文小写名词（`Public` / `Private` / `Team`），与 `useEntryDetailActions.ts:73-79` 移除前的 `Make Public` / `Make Private` 的动作式命名区分——**菜单里是状态名，不是动作名**（本任务正是把"动作按钮"改成"状态菜单"，沿用动作式命名会让用户以为点击是执行动作）。

**④ 自查：全文其它"声称照抄惯例却漏 a11y"的位置**（N-4 第 ③ 问）

| 位置 | 结论 |
|---|---|
| 触发按钮 `aria-label` | 本轮补齐（见 ②） |
| 子菜单触发项（`Team` 入口） | 需 `aria-haspopup="true"` + `:aria-expanded="isTeamSubmenuOpen"`——**已在本轮补入**（上一轮只给了 `Enter`/`Space` 键盘路径，无 ARIA 状态；与 `OverflowMenu.vue:13-14` 同理，零成本） |
| `sheet` 浮层关闭按钮 | 复用 `OverflowMenuSheet.vue:17` 的 `aria-label="Close"`，不得省略 |
| `TimeDisplay` 的 tooltip | `role="tooltip"` 已有（§3.4）；主显节点无需 `aria-label`（其文本即名称），**不新增** `aria-describedby`（完整 ARIA 关联属 §1.2 已排除的 roadmap 项） |
| `ConfirmDialog` | 不改（§1.2）；其内部按钮文案与 `aria` 由既有组件承担 |

**其它渲染与行为约定**

- **渲染**：`v-if="isOwner"` 由父组件控制（BDD-22：非 owner 三处均无入口）。
- **触发按钮 testid 沿用 `visibility-toggle`**（见 §3.8 沿用说明），**不得**另命名 `visibility-menu-trigger`。
- **二次确认**：`needsConfirm(target)` 为真时先开 `ConfirmDialog.vue`（`variant="primary"`，`title`/`message` 说明"公开后任何获得链接的人都能看到"）；确认后才 `emit('select')`。BDD-19 的"用户确认之前不发出修改请求"由此保证。
- **取消路径（D-10 补入）**：`ConfirmDialog` 的 `cancel` → `VisibilityMenu` 清空 `pendingTarget`、`emit('confirm-cancel')`，并**重开菜单**（`isOpen = true`）+ `nextTick` 后把焦点放回触发按钮（`triggerRef.value?.focus()`）。理由：`ConfirmDialog.vue:38-42` 打开时 `cancelBtn.focus()`，关闭后焦点落到 `body`——键盘用户取消后会丢失焦点位置，必须由本组件补这一层。
- **请求中禁用**（BDD-24）：`props.disabled` → 触发按钮 `disabled` + `aria-disabled="true"`；菜单项不响应点击。**禁用态视觉**：`opacity: .5; cursor: not-allowed`，与既有 `.icon-btn:disabled` 的全局处理一致（`OverflowMenu.vue:6` 的 `:disabled` 依赖该全局类）。
- **a11y**（BDD-30）：照抄 `OverflowMenu.vue` 的 `close()` 模式——`isOpen=false` 后 `triggerRef.value?.focus()`；`Escape` 与 `Tab` 均触发 `close()`；`document` 监听在 `onMounted`/`onUnmounted` 成对增删；点击外部关闭。
- **`aria-label`（N-4，所有 `variant` 必须）**：`:aria-label="`Visibility: ${visibilityStatusLabel(entry)}`"`——照 `OverflowMenu.vue:14` 的 icon-only 先例。三态文案见上方「可见文案与 `aria-label`」表；`inline` 的可见文本与全部变体的 `aria-label` 共用同一纯函数，防文案漂移。
- **`aria-haspopup="true"` + `:aria-expanded="isOpen"`**（D-12 相关，零成本）：既有 `OverflowMenu.vue:13-14` 已有此两项，照抄即得；读屏用户可感知菜单开合。`Team` 子菜单触发项同理带 `aria-haspopup="true"` + `:aria-expanded="isTeamSubmenuOpen"`（N-4 自查补入）。完整 ARIA 菜单角色树仍留给 roadmap（§1.2）。
- **`:focus-visible` 焦点环**（D-12）：新增触发按钮所在的 `.card-action-btn`（`EntryCard.vue:225`）与 `.action-btn`（`EntryListRow.vue:447`）**均无** `:focus-visible`（实测两文件各只有 6 处 `:focus-visible`，不含这两个类）。`DESIGN.md:290` 强制"All interactive elements must have visible focus indicators"，故本任务必须为这两个类**补焦点环**（沿用 `layout.css:279` 的 `.icon-btn:focus-visible` 规则组合：`outline: 2px solid var(--c-accent); outline-offset: 2px`）。
- **Team 子菜单键盘路径（D-12 相关）**：`Enter`/`Space` 展开；`Escape` 先关子菜单、再按一次关整个菜单；子菜单内 `Tab` 逐项遍历（不做焦点陷阱，与 `OverflowMenu` 一致）。
- **移动端形态（D-4）**：`variant="sheet"` 时菜单渲染为底部浮层（复用 `OverflowMenuSheet` 的呈现形态与 token，但**不复用其平铺 item 模型**），并 `Teleport to="body"` 以规避 `EntryDetailContent.vue` 的 `.content-area { overflow-y: auto }` 裁剪（design-review 2.3 扣分依据 4）。桌面 `variant="icon"`/`"inline"` 的菜单容器显式 `z-index: 100`（`DESIGN.md` §4 的 Drawer+Dropdown 档；既有 `OverflowMenuDropdown.vue:74` 用 200 属偏离，新组件按规范取 100）。
- **`visibility-confirm` testid 的落点（D-2 修正）**：上一轮声明落在"`ConfirmDialog` 实例容器"，**不可实现**——`ConfirmDialog.vue` 根为 `<Teleport to="body">`（`:2`）、真正容器 `.confirm-dialog` 在 Teleport 内部，全文件无 `data-testid`，父组件透传 attrs 到 `Teleport` 不产生 DOM 属性。**改为**：`ConfirmDialog` **不改**（§1.2 已列不改动项），P3 用**既有类名定位惯例** `page.locator('.confirm-dialog')`（既有测试正是绕开 testid 靠类名：`t093-star-manage.test.ts:116` 用 `document.body.querySelector('.confirm__btn--destructive')`）。§3.8 清单中 `visibility-confirm` 一行**替换为**"`.confirm-dialog`（既有类名，无 testid）"。

#### store 改动

`entryList.setVisibility(entry, target)`（含 B-4 的 `revokedShares` 分支 + 已定义的 `applyPatch`/`restore`）：

```ts
// inFlight 必须是响应式的（D：裸 Set 驱动不了 props.disabled）
const inFlight = ref<Set<string>>(new Set())

type VisibilitySnapshot = { isPublic: boolean; teamId: number | null; team: TeamRef | null }

function takeSnapshot(entry: Entry): VisibilitySnapshot {
  return { isPublic: entry.isPublic, teamId: entry.teamId ?? null, team: entry.team ?? null }
}

// 把 target 落到 entry 的三字段上；updated 存在时以服务端返回为准
function applyPatch(target: VisibilityTarget, updated?: Entry): void
function restore(snapshot: VisibilitySnapshot): void

async function setVisibility(entry: Entry, target: VisibilityTarget): Promise<SetVisibilityResult> {
  if (inFlight.value.has(entry.slug)) return { ok: false, revokedShares: 0 }  // BDD-24（store 守卫）
  inFlight.value.add(entry.slug)
  const snapshot = takeSnapshot(entry)
  const patch = toPatchPayload(target)
  applyPatch(target)                                        // 乐观更新（含 team 维度）
  try {
    const updated = await api.updateEntry(entry.slug, patch)
    applyPatch(target, updated)                             // 以服务端返回为准
    detailStore.syncVisibility(entry.slug, {
      isPublic: updated.isPublic, teamId: updated.teamId, team: updated.team,
    })
    // B-4：Team→Public / Private→Public 时后端自动吊销全部分享链接，必须告知用户。
    // E-2：store **只回传计数**，不出 toast——toast 统一由视图层发（见下「toast 归属」）。
    return { ok: true, revokedShares: updated.revokedShares ?? 0 }
  } catch {
    restore(snapshot)                                       // BDD-21：完全回到原值
    return { ok: false, revokedShares: 0 }
  } finally { inFlight.value.delete(entry.slug) }
}
```

**`setVisibility` 的返回类型（E-2 归属裁定用）**：

```ts
type SetVisibilityResult = { ok: boolean; revokedShares: number }
```

> **E-2 裁定：toast 归属**——**只由视图层发**，store 只回传 `revokedShares` 计数。理由：现状 `entryList.ts:64-68` 在 store 内发 warning toast，而 §1.1 D9 / §5 的四态又要求视图层发同一句 → 两处都实现会**弹两条相同 warning**（升 public 时用户看到重复提示）。二者只能居其一，本版选视图层：
>
> 1. 视图层已有 `useToast`（`EntryListView.vue:637-643` 的 `handleVisibilityChange` 就是现状 toast 发出点），四态（三成功态 + 1 warning）由同一函数按 `result` 分派，**不会有两处文案漂移**；
> 2. store 若继续自己发 toast，则"store 无 UI 关注点"的边界被破坏（本任务正在把 store 从单组 `isPublic` 切换重写为三字段 `setVisibility`，是收窄边界的好时机）；
> 3. 详情页（`useEntryDetailActions.ts`）不走本 store 方法（§1.1 D9 已裁定其 overflow 入口移除），故没有"另一处 store 调用方需要 toast"的反例。
>
> **P4 硬约束**：`stores/entryList.ts` 的 `setVisibility` 内**不得**出现 `toast.show` / `useToast`；四态 toast 的唯一发出点是视图层的 `handleVisibilityChange`（现 `EntryListView.vue:637-643`，D9 改名）。§6.2 的 `entry-list-visibility.spec.ts` 相应地**不断言 toast 被调用**，而断言 `返回值的 revokedShares` 为 `N` / `0` / `undefined→0`；toast 文案的断言落在 §6.2 的视图层用例。

**`applyPatch` / `restore` 的字段契约**（上一轮只被引用未定义，P4 需自行发明的部分——现给出）：

| 目标 `kind` | `applyPatch` 写入的三个字段（无 `updated` 时） |
|---|---|
| `public` | `isPublic = true`、`teamId = null`、`team = null` |
| `private` | `isPublic = false`、`teamId = null`、`team = null` |
| `team` | `isPublic = false`、`teamId = <该 team 的**数字 id**>`、`team = { slug, name }`（`TeamRef`，从 `teams` 反查得到 `Team` 项后只取 `slug`/`name` 两字段） |

> **N-1 相关的字段口径澄清**：`VisibilitySnapshot.team` / `Entry.team` 的类型是 **`TeamRef`（`{slug, name}`，无 id）**，`Entry.teamId` 是**数字**（`types/index.ts:50`）。`applyPatch('team')` 需要的 `teamId: number` **不可**从 `Team`/`TeamRef` 取（它们无 id）——它只在 `updated`（服务端响应）路径上可信。**无 `updated` 的乐观更新路径**因此按如下写死：
> ```ts
> // 乐观更新：只填 entry 侧已有的两个可信字段，teamId 留待服务端响应回填
> // 依据：TeamOption/Team/TeamRef 均无数字 id，前端无从凭空造出 teamId
> entry.team = { slug: t.slug, name: t.name }   // TeamRef 形状
> entry.isPublic = false
> // entry.teamId 不写（沿用旧值）——服务端响应到达后 applyPatch(target, updated) 整体覆盖
> ```
> 这条不影响 BDD-27/28（后端以 `team_id: slug` 完成切换，响应回填正确值）与 BDD-21（`restore` 用快照整体写回）。**P4 不得**为了"三字段同写"而伪造 `teamId`（如 `teams.indexOf(t)`）——那是凭空造 ID。

- 有 `updated` 入参时，三字段**整体取** `updated.isPublic` / `updated.teamId` / `updated.team`，忽略 `target`。
- `restore(snapshot)` = 三字段逐一写回快照值（`isPublic` / `teamId` / `team`），**不做部分回滚**——BDD-21 要求"完全回到原值"。
- 三字段必须**同写**：只写 `isPublic` 会让 `entry.teamId` 残留旧值，导致菜单项排除判定（BDD-16）与徽标渲染出现自相矛盾的状态。

- **删除** 原 `toggleVisibility` 的 `entry.teamId` 守卫（陷阱 11：**替代**而非叠加）。
- **保留** 原 `toggleVisibility` 的 `revokedShares` **语义**（现状 `entryList.ts:64-68`）——不得静默丢弃（B-4）。但**实现位置改为回传计数**：store 内不再发 toast（E-2 裁定），改为 `return { ok: true, revokedShares }`，由视图层发 warning。现状 `entryList.ts:64-68` 的 `toast.show(...)` 两行**删除**，等价语义搬到 `EntryListView.vue` 的 `handleVisibilityChange`。
- `entryDetail.syncVisibility(slug, patch)` 扩为三字段（陷阱 12），否则详情页切换后状态残留。
- `stores/entry.ts:19` 的透传层需同步导出 `setVisibility`（签名变化，P4 注意）。
- **`inFlight` 响应式**：用 `ref(new Set())`（或 `reactive`）——裸 `new Set()` 不是响应式的，父组件传入的 `disabled` 不会随请求状态变化。注意 `ref(new Set())` 的 `.add/.delete` 需经 `.value` 且 Vue 3 的深度响应式对 `Set` 的增删**可**触发更新（`ref` 包裹的 `Set` 被 `reactive` 代理）；若 P4 实测不触发，退路是 `ref<string[]>([])` 或显式 `triggerRef`。**BDD-24 的判据（"不发出第二个修改请求"）由 store 的 `inFlight.has()` 守卫保证**，组件层 `disabled` 是**附加**的视觉反馈——两层都要，但判据以后者为准。

#### 团队列表加载失败（R11 / D-9）

`stores/team.ts:22-35` 的 `loadMyTeams()` 在 catch 分支只置 `error.value`，**不置 `teamsLoaded`、`allTeams` 保持空数组**。叠加 `teams.length === 0` → 不渲染 Team 入口的规则后，**加载失败时的界面与"我真的没有团队"完全一致**——用户会误以为团队消失了。

本设计的处置（三级）：

1. **组件层区分**：`VisibilityMenu` 收 `teamsFailed` prop；为真时 Team 位仍渲染，但为**禁用项 + 失败文案**（`title`/`hint` = "团队列表加载失败"），不静默隐藏。
2. **视图层传值**：`EntryListView` / `EntryDetailView` 把 `teamStore.error !== null` 作为 `teamsFailed` 下发。
3. **语义声明**：加载失败按"无团队"降级的路径**不满足 BDD-17 的 Given**——BDD-17 的前提是"用户不属于任何团队"，而非"团队列表加载失败"。故 P3 的 BDD-17 用例必须**显式构造"加载成功且 teams 为空"**（mock `listTeams` 返回 `{owned:[], joined:[]}`），**不得**用"不 mock / 让请求失败"来实现空团队场景——后者会测到降级路径而非目标路径。

> `[SCOPE+]` 是否新增 BDD：**不新增**。BDD-17 已覆盖"无团队"的判定语义，失败态属**错误处理**而非新行为契约，由 P3 的 UI 单测（`visibility-menu.spec.ts` 断言 `teamsFailed` 时 Team 位为禁用 + 有文案）与 P6 人工复核承担。登记在 §7。

### 3.6 前端：文件数与空态

- 卡片/列表：`v-if="(entry.fileCount ?? 0) >= 2"`，文案 `{{ entry.fileCount }} files`（BDD-13/14/15）。
- 详情页空态（`EntryDetailContent.vue:59-61`）：

```vue
<div v-if="currentEntry && currentEntry.files.length === 0" class="empty-state" data-testid="empty-no-files">
  <span>此 entry 无文件</span>
</div>
<div v-else class="empty-state" data-testid="empty-select-file">
  <span>Select a file to view</span>
</div>
```

两分支的判定条件互斥（`files.length === 0` vs 其余），文案不同 → BDD-25 的两条要求（专用空态 + 与未选中可区分）均满足。

### 3.7 团队列表加载（陷阱 12/13）

| 视图 | 现状 | 设计 |
|---|---|---|
| `EntryListView.vue` | `ensureMyTeamsLoaded()`（`:551`）已存在，在 `:755` 与 `:761` 触发 | 保留；把 `teamStore.allTeams` 作为 prop 下发给 `EntryCard` / `EntryListRow` |
| `EntryDetailView.vue` | **无任何调用** | 新增 `onMounted` 中 `if (authState === 'authenticated' && !teamStore.teamsLoaded) teamStore.loadMyTeams()`；把 `allTeams` 下发给 `EntryDetailHeader` 与 `EntryMetaTagsBar` |

**prop 链**（P1 SUGGEST 已采纳：视图层各触发一次、已加载则跳过；**N-2 修正后含 `variant`**）：
```
EntryListView  ──teams, variant(icon|sheet), teamsFailed──▶ EntryCard / EntryListRow ──同上──▶ VisibilityMenu
EntryDetailView ──teams, variant(inline|sheet), teamsFailed──▶ EntryDetailHeader ──同上──▶ VisibilityMenu
                └─teams, variant(inline|sheet), teamsFailed──▶ EntryMetaTagsBar ──同上──▶ VisibilityMenu
```
`teamStore.allTeams` 是 `computed`，视图层只调一次 `loadMyTeams()` → 全页共享，不会每卡一请求（I-12）。

**`variant` 的取值来源（N-2 裁定：视图层下发，组件不自判）**——上一轮此链只下发 `teams`，`variant` 悬空。现写死：

| 视图 | 取值表达式 | 依据 |
|---|---|---|
| `EntryListView.vue` | `:variant="isMobile ? 'sheet' : 'icon'"`，`isMobile` 来自既有 `useResponsiveLayout()`（`:262` import 补 `onBeforeUnmount`；`onMounted`/`onBeforeUnmount` 成对 `add`/`removeEventListener('resize', handleResize)`） | Explore 页原先**完全没有** `isMobile`（`IsMobileKey` 仅在 `EntryDetailView.vue:159` provide），本任务按 `UserManagerTab.vue:87` 的既有用法补上 |
| `EntryDetailView.vue` → `EntryDetailHeader` | `:variant="isMobile ? 'sheet' : 'inline'"` | `EntryDetailHeader` 根部 `v-if="isDesktop"`（`:13`），实际恒取 `inline`；写成条件只为契约完整 |
| `EntryDetailView.vue` → `EntryMetaTagsBar` | `:variant="isMobile ? 'sheet' : 'inline'"` | 该组件只在 `isMobile` 时渲染（`EntryDetailContent.vue:24`），实际恒取 `sheet`——**这就是 D-4 在详情页移动端的落地** |

`EntryDetailView.vue:156` 的 `const { isMobile, handleResize } = useResponsiveLayout()` 与 `:217`/`:227` 的 resize 监听**均已存在**，该视图零新增代码即可满足本表；只有 `EntryListView.vue` 需要新增接线。

### 3.8 稳定测试标识清单（供 P3 定位，禁绑 class 名）

| `data-testid` | 位置 | 用途 |
|---|---|---|
| `time-display` | `TimeDisplay.vue` **根 `<span>`** | 主显文本定位（BDD-01/03/04） |
| `time-tooltip` | `TimeDisplay.vue` tooltip 节点（`role="tooltip"`） | 悬停后可断言（BDD-02/03/05/06） |
| `visibility-toggle` | `VisibilityMenu.vue` **触发按钮**（沿用既有标识，见下方沿用说明）。该按钮**所有变体**都带 `aria-label="Visibility: {statusLabel}"`（N-4） | 打开菜单（BDD-16-24/27-30）；**非 owner 场景三处 count = 0**（BDD-22）；`inline` 变体另可用 `toHaveText` 断言三态可见文案 |
| `visibility-menu` | 菜单容器 | 菜单项存在性判定 |
| `visibility-item-public` / `-private` / `-team` | 菜单项 | 当前态排除判定（BDD-16/17/18） |
| `visibility-team-submenu` | 子菜单容器 | 子菜单排除当前团队（BDD-18） |
| `visibility-team-option-{slug}` | 子菜单项 | 选择具体团队（BDD-18/27/28） |
| `empty-no-files` / `empty-select-file` | `EntryDetailContent.vue` | 两种空态区分（BDD-25） |

> **二次确认的定位方式（D-2）**：**不设 `visibility-confirm` testid**——`ConfirmDialog.vue` 根为 `<Teleport to="body">`、真正容器 `.confirm-dialog` 在 Teleport 内部、全文件无 `data-testid`，父组件透传 attrs 到 `Teleport` 不产生 DOM 属性，该 testid **不可实现**。P3 沿用既有类名定位惯例：`page.locator('.confirm-dialog')`（既有测试同样绕开 testid 靠类名，如 `t093-star-manage.test.ts:116` 用 `.confirm__btn--destructive`）。若 P3 需要更稳的定位，可断言 `.confirm-dialog` 内的文案，而非新增 testid（新增需改 `ConfirmDialog.vue`，§1.2 已列为不改动项）。

**沿用既有标识**：`visibility-toggle`（TPV0095 引入，本任务**保留该名字**给菜单触发按钮——这样 TPV0095 的"团队 entry 无 `visibility-toggle`"断言语义变为"团队 entry **有** `visibility-toggle`"，只需翻转断言值，不必改名）。`badge-team` / `star-exempt-*` / `force-delete*` 不变。

> **裁决已定（原 §12#3，plan-design-review §4 裁决 2 = 采纳"沿用"）**：`visibility-toggle` **沿用、不改名**。理由：`EntryCard.vue:8` 与 `EntryListRow.vue:98` 已用该 testid；改名要动 2 处组件 + 5 处断言 + 1 处 E2E，漏改一处即静默红。**上一轮 §3.8 表内同时有 `visibility-menu-trigger`（指"触发按钮"）与"沿用 `visibility-toggle`"两条指向同一元素——本版已删除前者，只保留上表这一行。**

---

## 4. 实现完成的标志

供 P3 测试设计与 P5 验证使用：

1. **后端**：`backend/tests/test_utc_serialization.py` 全绿；遍历 `models` 模块「非 table 且不被 table 模型继承」的类，每个 datetime 字段 JSON 输出以 `Z` 结尾；表模型 `model_dump()` 全为 `datetime`；mixin 不在任何 `table=True` 模型 MRO。
2. **CLI**：`peekview list --json` 输出中每个非 null 时间值以 `Z` 结尾；remote 模式读取无解析异常且 `tzinfo` 为 UTC。
3. **前端单测**：`useRelativeTime` 三函数契约（含无效日期、未来时间）、`buildVisibilityOptions` 三态笛卡尔子集 + `teamsFailed`、`toPatchPayload` 五个转换、`VisibilityMenu` 的 `Escape` + 焦点回归 + `confirm-cancel` 路径、`setVisibility` 的 `revokedShares > 0` warning。
4. **E2E**：`e2e/tpv0102-explore-card-list-ux.spec.ts`（**文件名写死**，见 §6.3 与 §9）覆盖 BDD-01-06 / 13-25 / 27-30；桌面 1280x800 与移动 390x844 双档（Playwright 两个 project）。
5. **视觉契约**：tooltip 不溢出 viewport（`getBoundingClientRect().right <= innerWidth`）；菜单不遮挡触发按钮（菜单 `top >= trigger.bottom`）；卡片元信息行不因时间文本变长而溢出（`scrollWidth <= clientWidth + 1`）；移动端触发按钮触达高度 ≥ 44px；详情页 `meta-row` 高度 ≤ 两行。
6. **既有断言更新已登记**：TPV0095 BDD-40（4 单测 + 1 E2E）与 `title` 断言（2 处）+ `useRelativeTime` mock（3 处）+ `header-layout.test.ts` TC-D01/TC-D02 + toast 文案（2 文件）+ T052 E2E（1 处，**不含** `.test.ts:100` 字面量）全部显式更新，P7 记录"被本任务有意取代"。
7. **P3 红灯基线可判**：按 §9 的 `P3` 命令（`--tb=short` + 无 `tail` 截断）+ `P3_formatter: pytest.sh` 跑 `check-tdd-red.py`，判定为 **B 类红灯**（`import errors from missing project module 'peekview'`）而非 A 类假红——实测见 §8 V10。

---

## UI 设计

> 本节即第 5 节。**标题必须字面写 `## UI 设计`**（P2 gate 的 `parse_ui_design_section` 正则 `^#{2,3}\s+UI 设计` 不容编号前缀，写成 `## 5. UI 设计` 会 gate exit 1）。

### 渲染形态声明（必填，与 P1 形态声明一致）

- 渲染形态: layout（布局型——Explore 卡片/列表、详情页头部与移动端元信息条的分区与排布调整；无画布、无时序动效）
- 适用维度: 布局结构 / 交互行为 / 视觉呈现

### 布局 checklist（布局结构维度——常规布局型必选）

- [x] **页面/组件层级结构已描述**
  - Explore 卡片（`EntryCard.vue`）：`card-actions`（右上角绝对定位，含 `VisibilityMenu` + 删除按钮）→ `card-body`（`card-title` / `card-meta-text`〔`@username` · `TimeDisplay` · `N files`〕/ `card-tags` / `card-footer`〔`BaseBadge`〕）
  - Explore 列表（`EntryListRow.vue`）：`entry-content`（`entry-title` / `entry-meta-row` / `entry-tags-row`）+ `entry-right`（`BaseBadge` + `entry-actions`〔`VisibilityMenu` + 删除〕），两列 grid
  - 详情页桌面（`EntryDetailHeader.vue`）：`detail-header` → `title-row`（logo / 标题 / `actions-area`）+ `meta-row`（`@username` · `TimeDisplay` · 状态 · 读数 · `VisibilityMenu`〔inline〕· tags）
  - 详情页移动（`EntryMetaTagsBar.vue`）：单行 flex-wrap 元信息条，`VisibilityMenu`（inline）插入状态位
- [x] **关键区域占位关系已描述**
  - 菜单为**浮层**（`position:absolute` + `z-index`），不占文档流；卡片菜单向右对齐避免超出卡片右边界，列表/详情菜单向左对齐避免超出 viewport
  - Team 子菜单为菜单内的**二级浮层**，向右展开；限高 + 内部滚动
  - 二次确认弹窗走 `ConfirmDialog.vue` 的 `Teleport to="body"`（全屏遮罩 + 居中卡片），脱离父容器层级
  - tooltip 为时间文本下方的**浮层**（`position:absolute`，`z-index: 10` = `DESIGN.md` §4 的 Sticky+tooltips 档），不推动布局
  - 菜单容器 `z-index: 100`（Drawer+Dropdown 档）；`ConfirmDialog` 走既有 200/210（Modal 档）
- [x] **桌面与移动两档 viewport 布局均说明**
  - **桌面 1280×800**：卡片模式 3 列 grid（`entry-grid`）；列表模式 `grid-template-columns: 1fr auto`（内容 + 右侧徽标/动作）；`card-actions` / `entry-actions` 在 `@media (hover:hover)` 下默认 `opacity:0`、卡片/行悬停时 `opacity:1`（键盘用户由 `:focus-within` 保证可达）；详情页头部 `meta-row` 单行 `flex-wrap`
  - **移动 390×844**：`@media (max-width:640px)` 下 `entry-list-row` 改为单列（`grid-template-columns: 1fr`），`entry-right` 左对齐，`entry-actions` 恒 `opacity:1`（无 hover）；详情页改用 `EntryMetaTagsBar`（`flex-wrap:wrap`）承载时间与菜单；tooltip `max-width:320px` 且右对齐防止横向溢出
  - 两档均对应 P3 的 `desktop_1280x800` / `mobile_390x844` 截图

### 交互 checklist（交互行为维度——常规布局型必选）

- [x] **键盘可达性已覆盖**
  - `VisibilityMenu` 触发按钮为 `<button type="button">`，`Tab` 可达；`Enter` / `Space` 打开（照 `OverflowMenu.vue:11-12` 惯例）
  - `Escape` 关闭菜单 → `close()` 内 `triggerRef.value?.focus()` 焦点回到触发入口（BDD-30）
  - `Tab` 亦关闭（照 `OverflowMenu.vue:143-145`），避免焦点落进已关闭的浮层
  - `TimeDisplay` 主显节点带 `focus-within` 触发 tooltip（键盘用户可见提示）
  - 菜单项为 `<button>`，`Tab` 可逐项遍历
- [x] **输入态变化已定义**
  - 本任务**无文本输入态**用例（无 `<input>`）；"状态选择"类交互：点击菜单项 → 菜单关闭 → （`public` 时）弹二次确认 → 确认后菜单项区禁用 → 请求返回后菜单恢复可用且当前态项消失
  - 请求进行中：触发按钮 `disabled`、菜单项点击无效（BDD-24）
- [x] **反馈（loading/error/empty/disable）已覆盖**
  - **disable**：`disabled` prop → 触发按钮 `disabled` + `aria-disabled`；菜单项在请求中不响应
  - **error**：切换失败 → 状态完全回到原值（`isPublic` + `teamId` + `team` 三字段）+ `toast.show(..., 'error')`（BDD-21）
  - **success**：视图层 `handleVisibilityChange` 按 `SetVisibilityResult` 分派**四态**（BDD-19/20/27-29）——`Made public` / `Now private` / `Shared with Team <name>` 三条成功文案，加 **`result.revokedShares > 0` 时的 warning**（`N share link(s) revoked — entry is now public`，B-4/D-3）。**唯一发出点是视图层**；store 只 `return { ok, revokedShares }`、不自己发 toast（E-2 归属裁定，见 §3.5）
  - **empty**：0 文件 entry → `data-testid="empty-no-files"`（BDD-25）；无团队 → 菜单不渲染 Team 入口（BDD-17）
  - **loading**：详情页沿用既有 skeleton（`loading-state`）；菜单本身无 loading 态（乐观更新）
- [x] **输入态变化类用例：无输入态用例**——但**状态选择类**交互需 P6 人工复核（菜单展开层级、二次确认文案可读性、移动端浮层是否被底部栏遮挡），已在 P1 BDD-26 的人工体验路径中登记
- [x] **[渲染组件型可选] 手势/动作交互**：**维度不适用**——本任务为常规布局型，无画布/3D/拖拽类交互（既有的 `resize-handle` 侧栏拖拽不在本任务改动范围）

### 视觉 checklist（视觉呈现维度——常规布局型必选）

> **视觉契约（单源定义，P6 侧只交叉引用不重复）**：视觉呈现维度的断言以**视觉契约**形式表达——**视觉契约断言 = 可表达子集**：宽度 / 高度 / 对齐 / 重叠 / 溢出五类 **DOM 度量**（E2E 以 `getBoundingClientRect` 等 DOM 度量断言量化采集），**不收主观视觉**（美观/好看/协调不构成可断言契约，归入截图人工复核或 vision-analyst 描述）。

- [x] **颜色/对比度已说明**
  - 全部沿用既有 CSS 变量，**不新增颜色**：菜单背景 `var(--c-surface)`、边框 `var(--c-border-strong)`、文字 `var(--c-text)` / `var(--c-text-secondary)`、悬停 `var(--c-surface-lower)`、危险项 `var(--c-error)`；tooltip 背景 `var(--c-surface-lower)` + 文字 `var(--c-text)`（与既有 `.tooltip` 一致）
  - **对比度（如实陈述，D-6）**：既有变量**并非**全部满足 WCAG AA。实测本项目 `variables.css`，按 WCAG 2.x 相对亮度公式实算：

    | 组合 | 对比度 | AA 正文 4.5:1 |
    |---|---|---|
    | 暗色 `--c-text-tertiary` `#6a7682` on `--c-surface` `#121822` | **3.84 : 1** | ✗ 不达标 |
    | 亮色 `--c-text-tertiary` `#8c959f` on `--c-surface` `#ffffff` | **3.04 : 1** | ✗ 不达标 |
    | 暗色 `--c-text-secondary` `#9aa7b4` on `#121822` | 7.26 : 1 | ✓ |
    | 亮色 `--c-text-secondary` `#656d76` on `#ffffff` | 5.25 : 1 | ✓ |

    而**卡片与列表的时间文本正落在 tertiary 色**（`.card-meta-text` / `.entry-meta:245`）。本任务把时间从相对时间（短文本、辅助信息）改为**主显绝对时间**（信息量更大、更被依赖），却仍用 3.04:1 / 3.84:1 的颜色。**"风险为零"的上一版判断不成立**——但这是**既有债务**，不是本任务引入的新缺陷：修它要改 `--c-text-tertiary`（波及全部使用该变量的既有组件）或逐组件改色（超出四项范围）。故本任务**不改色**，登记为 SUGGEST（§7），由 roadmap 统一处置；P6 不做对比度整改验收，但**不得**把"已满足 AA"写成结论。
  - 新增组件样式**优先用语义别名 token**（`--text-primary` / `--bg-secondary` / `--border-color` 等，`DESIGN.md:326` 一带的 Do 明文：「Use semantic alias tokens … Primitive tokens (`--c-*`) are for defining semantic aliases in `variables.css` only」）。上文点名 `--c-*` 是**为与既有相邻组件对齐**（既有组件大量使用 primitive，属历史债）；新增代码按语义别名写，无对应别名时才回落 `--c-*` 并在此注明。
  - 状态标签：`status-tag.public` / `.private` / `.team` 三态配色不变（`EntryDetailHeader.vue:188-190`）
- [x] **字体层级与间距节奏已说明**
  - 时间主显：`font-size: 13px`（卡片/列表，`font-family: var(--font-mono)`，与既有 `.card-meta-text` / `.entry-meta` 一致）；详情页元信息 `var(--font-xs)`
  - tooltip：`font-size: 11px`（与既有 `.tooltip` 一致）、`line-height:1.4`、`padding: var(--space-1) var(--space-2)`（**`--space-1` = 4px**，替代上一版的字面 `2px 6px`；上一版既违反 `DESIGN.md` §4「Base Unit 4px / §12 Don't use spacing values that are not multiples of 4px」，又与本节末句「全部走 `var(--space-*)`、不写字面像素」自相矛盾）、`border-radius: var(--radius-sm)`
  - 菜单项：`font-size: var(--font-sm)`、`padding: var(--space-2) var(--space-3)`、项间 `gap: var(--space-1)`（替代字面 `2px`）；子菜单缩进 `padding-left: var(--space-5)`
  - **间距节奏全部走 `var(--space-*)` 刻度，不写字面像素**——本版已兑现该声明（上一版正文里残留 `2px` / `6px` 字面值，是本条自相矛盾的来源）
  - **例外声明**：详情 inline 触发按钮沿用 `status-tag` 的 `padding: 1px 6px`（**既有值，非新增**）——这是为保持替换前后视觉权重不变而刻意沿用的既有例外，`DESIGN.md` 的 4px 基数规则在既有 `status-tag` 上本就不成立。新增的菜单/tooltip 间距不得沿用该例外。
- [x] **组件一致性已说明**
  - 圆角：菜单容器 `var(--radius-md)`、菜单项 `var(--radius-sm)`、tooltip `var(--radius-sm)`（与 `OverflowMenuDropdown` / 既有 `.tooltip` 一致）
  - 阴影：菜单 `var(--shadow-md)`（与 `.tag-overflow::after` 一致）
  - 图标：`lucide-vue-next`（`Globe` / `Lock` / `Users` / `ChevronRight`），尺寸 14/16，与既有 `card-action-btn` 的 svg 尺寸一致
  - **触发按钮尺寸（N-3：新 vs 既有，逐行标注，勿混读）**

    | 行 | 按钮 | 尺寸 | 归属 | VC-4 是否断言 |
    |---|---|---|---|---|
    | 1 | `VisibilityMenu` 触发按钮 — **移动端 `variant="sheet"`**（`≤640px`） | **44×44**（`min-height/min-width: 44px`） | **本任务新增** | ✅ 断言 `height >= 44` |
    | 2 | `VisibilityMenu` 触发按钮 — **桌面 `variant="icon"`**（卡片 `card-actions` / 列表 `entry-actions`） | 28×28（复用 `.card-action-btn` / `.action-btn` 的既有视觉规格） | 本任务新增，但**沿用既有尺寸** | ❌ 不断言（VC-4 只管移动端） |
    | 3 | `VisibilityMenu` 触发按钮 — **`variant="inline"`**（详情页 `meta-row` / `EntryMetaTagsBar`） | 沿用 `status-tag` 的 `font-size:10px; padding:1px 6px`（实高 ≈18px）→ 移动端 `variant="sheet"` 时按第 1 行 44px | 本任务新增，但**沿用既有尺寸** | ❌ 不断言 |
    | 4 | 既有删除按钮（`card-action-btn--danger` / `action-btn` 删除位） | **28×28 — 既有，本任务不改** | **既有组件** | ❌ **不得**断言（改了会扩大范围、破坏卡片密度） |

    > **实现规则（写死）**：`VisibilityMenu` 的 CSS 必须有
    > ```css
    > @media (max-width: 640px) {
    >   .visibility-toggle { min-height: 44px; min-width: 44px; }
    > }
    > ```
    > 该规则**只作用于 `VisibilityMenu` 自己的触发按钮**（`.visibility-toggle`，新类），**不得**写到 `.card-action-btn` / `.action-btn` 上（那会把既有 28px 按钮一起放大 = 扩大范围）。
    >
    > **既有 28×28 不改**：`EntryCard.vue:225-238` 的 `.card-action-btn { width: 28px; height: 28px }` 与 `EntryListRow.vue:447-459` 的 `.action-btn` 同规格，二者在 `DESIGN.md:270`「Touch targets: minimum 44px」下**本就不达标**，属既有债务 → §7.1 S2 登记，本任务不动（VC-4 若断言它们，等于把既有不达标写成"已达标"）。
  - **层级（z-index，按 `DESIGN.md` §4 六档）**：tooltip `z-index: 10`（Sticky+tooltips 档）；菜单容器 `z-index: 100`（Drawer+Dropdown 档）；`ConfirmDialog` 走既有 200/210（Modal 档，不改）。**说明**：既有 `OverflowMenuDropdown.vue:74` 用 200 偏离规范，新组件按规范取 100，不跟随既有偏离。

**视觉契约（可量化 DOM 度量断言，P3 写、P5/P6 跑）**：

| # | 契约 | 断言（Playwright） |
|---|---|---|
| VC-1 | tooltip 不横向溢出 viewport（桌面 1280 / 移动 390） | `const r = await tip.boundingBox(); expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(viewport.width + 1)` |
| VC-2 | 菜单浮层不遮挡触发按钮 | `expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 1)` |
| VC-3 | 卡片元信息行不因时间文本变长而溢出 | `expect(await meta.scrollWidth).toBeLessThanOrEqual((await meta.clientWidth) + 1)` |
| VC-4 | **本任务新增的**菜单触发按钮在**移动端**的触达高度（**只看** 组件一致性节表内第 1 行） | `const btn = page.locator('[data-testid="visibility-toggle"]').first(); expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44)`（`Mobile Chrome` project / 390×844） |
| VC-5 | 时间主显文本与 `@username` 基线对齐 | `Math.abs(userBox.y + userBox.height - (timeBox.y + timeBox.height)) <= 2` |
| VC-6 | 列表行右侧动作区不与标题文本重叠 | `expect(actionsBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width - 1)` |
| VC-7 | 详情页 `meta-row` 视觉密度（R9 专用） | `expect((await metaRow.boundingBox()).height).toBeLessThanOrEqual(lineHeight * 2 + 1)`（1280px 下不超过两行） |

> **VC-4 的口径（D-5 + N-3：与上方「触发按钮尺寸」表逐行对齐，**新 vs 既有**一眼可辨）**：`DESIGN.md:270`「Touch targets: minimum 44px」是硬规范，上一版写 `>= 24` 等于**用新契约给既有 28px 按钮背书并放行到 24px**，是向下对齐。本版分两条：
> - **VC-4（本任务范围）= 上表第 1 行**：`VisibilityMenu` 自己的触发按钮在 `@media (max-width:640px)` 下（即 `variant="sheet"` 路径）触达高度 **≥ 44px**。这是本任务**新增**的交互元素，必须达标；实现规则见上表下的 `.visibility-toggle { min-height/min-width: 44px }` CSS 块。
> - **上表第 4 行（既有 28×28 按钮 `card-action-btn` / `action-btn`）不在本任务范围**：它们是既有组件，改成 44px 会改动 Explore 卡片/列表的既有布局密度（连带大量视觉断言），超出四项范围。登记为 SUGGEST（§7.1 S2），由 roadmap 统一改造。**VC-4 不得写成对既有 28px 按钮的断言**（那会把既有不达标写成"已达标"）。
> - **上表第 2/3 行（桌面 icon / inline）VC-4 不断言**：44px 是移动端触达规范，桌面鼠标目标按既有 28px/`status-tag` 视觉规格走。
>
> 以上 7 条均为可量化 DOM 度量；**不含**主观视觉判断。视觉美观度由 P6 截图 + vision 分析承担（P1 capability_requirements 已声明 vision 能力 available）。

### 渲染正确性 checklist（渲染正确性维度）

**维度不适用**——本任务为常规布局型（`ui_render_shape: layout`），无画布/绘制管线/参考图 diff 类判据。

### 动效时序 checklist（动效时序维度）

**维度不适用**——本任务无时序特效；菜单/tooltip 仅 `visibility` 切换（无 transition 动画），不涉帧采样或过渡时长断言。

---

## 6. 测试策略（P3 输入）

### 6.1 后端（pytest，`backend/tests/test_utc_serialization.py`）

| 用例 | 覆盖 BDD | 判据 |
|---|---|---|
| `test_all_leaf_models_json_dt_ends_with_z` | 07 | 遍历 `models` 模块：非 `table=True` 且不被任何 `table=True` 模型继承 → 每个 datetime 字段 → 断言实例化后 `model_dump(mode="json")` 值以 `Z` 结尾 |
| `test_table_models_python_dump_still_datetime` | 08 | `Entry` / `User` 的 `model_dump()`（python 模式）值 `isinstance(datetime)`，且 `str()` 不以 `Z` 结尾 |
| `test_leaf_models_python_dump_still_datetime` | 09 | `EntryResponse(...).model_dump()` 值 `isinstance(datetime)` |
| `test_mixin_not_in_table_mro` | 08 / 适应度 | 任何 `table=True` 模型的 MRO 不含 `UtcSerializeMixin` |
| `test_response_model_classes_covered` | 07 | 遍历 `api/` 的 `response_model=` 指名类，断言其在覆盖集合内 |
| `test_cli_remote_parses_z` | 10 | `parse_iso("...Z")` 返回 aware datetime，`utcoffset() == timedelta(0)` |
| `test_cli_json_output_has_tz` | 11 | 7 处 + 3 处输出值以 `Z` 结尾 |
| `test_existing_rows_utc_audit` | 12 | debug DB 全表 `created_at` 晚于当前 UTC 的行数为 0（**一次性审计脚本，不是 pytest 用例**——见下方约束 3） |

**P3 必须遵守的三条约束**：

1. **文件名写死**：`backend/tests/test_utc_serialization.py`——`P5_fitness` 直接引用该路径（`§9`），改名即断。
2. **测试函数名写死**：`test_mixin_not_in_table_mro` 必须保留该**函数名**（可加类前缀，`-k` 是子串匹配）——`P5_fitness` 用 `-k mixin_not_in_table_mro` 定向只跑它。**`-k` 零命中时 pytest exit 5（非 0）**，实测确认（`1 deselected` → exit 5）；函数名被改 → `P5_fitness` 假红。
3. **`test_existing_rows_utc_audit`（BDD-12）不得写成 pytest 用例**：`conftest.py` 的 `isolate_config_file` 是 `autouse=True`，每个测试自动把 `PEEKVIEW_STORAGE__DATA_DIR` / `DB_PATH` 指向 `tmp_path`（实测）——跑在 tmp DB 上对该断言无意义（必然 0 行命中，恒绿假象）。BDD-12 是**一次性存量审计**，P5 阶段对 debug DB（`/tmp/peekview-debug/peekview.db`）手工执行 SQL 并留存输出证据，**不进 pytest 套件**。若 P3 写了该用例 → 视为把 BDD-12 做成假用例，P7 记 DEVIATION。

### 6.2 前端单测（vitest）

| 文件 | 覆盖 BDD |
|---|---|
| `src/composables/__tests__/useRelativeTime.spec.ts` | 01/04/05/06（`formatFullDate` 含 `GMT±N`、无效→`—`、未来→`in N…`、`toLocaleString` 逐字段选项） |
| `src/utils/__tests__/visibility-options.spec.ts` | 16/17/18（三态笛卡尔子集 + 无团队 + 子菜单排除当前团队 + `teamsFailed` 时 Team 位为禁用而非消失） |
| `src/utils/__tests__/visibility-target.spec.ts` | 19/20/27/28/29（五转换的 payload 形状 + `needsConfirm`） |
| `src/components/__tests__/visibility-menu.spec.ts` | 19/20/24/30（确认前不发事件、`Escape` 关闭 + 焦点回归、disabled 不响应、**取消二次确认 → `confirm-cancel` + 菜单重开 + 焦点回归**、**`teamsFailed` 时 Team 位禁用 + 有失败文案**） |
| `src/components/__tests__/time-display.spec.ts` | 01/02/05（tooltip 元素存在 + 文本三段结构 + 根节点有 `data-testid="time-display"`） |
| `src/stores/__tests__/entry-list-visibility.spec.ts`（**新增，B-4 要求**） | 19/21/24（`setVisibility` 成功时三字段更新、失败时三字段完全回滚、`inFlight` 期间第二次调用返回 `{ok:false}`、**返回值 `revokedShares` 为 N 时原样回传**、`updated.revokedShares` 为 0/undefined 时返回 **0**）。**E-2 归属**：该 spec **不断言 toast**（toast 不归 store）——四态文案的断言落在视图层用例 `EntryListView` 的 `handleVisibilityChange` |

### 6.3 E2E（Playwright）

**文件名写死（B-1 修正）：`frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`**

> **P3 必须创建该文件名的 spec**——`gate_commands.P5_e2e` 已把文件名写死（不用正则），文件缺失即 `Error: No tests found` + exit 1（实测：`npx playwright test --list e2e/zzzznonexistent` → exit **1**）。这是本任务 E2E 覆盖**不可静默缺失**的机制保证。
>
> **为什么不用正则 alternation**：上一版写 `E2E_SPEC='e2e/(tpv0102|team-visibility)'`，实测 `npx playwright test --list 'e2e/(tpv0102|team-visibility)'` → **`Total: 12 tests in 1 file`**，全部来自既有的 `team-visibility.spec.ts`，`tpv0102` 命中 **0**。即该命令**今天就已经 exit 0**，而本任务 30 条 BDD 的 E2E 覆盖为 0——假绿不可由 exit code 察觉，也无日志提示。正则里的 `team-visibility` 保证了"零命中永不发生"，容忍变成了掩盖。

纪律：

- 固定 `test.use({ timezoneId: 'Asia/Shanghai', locale: 'zh-CN' })` 用于 BDD-04（**实测**该组合下输出 `2026/11/10 GMT+8 17:43:00`）。
- BDD-01/02/03/26 **不得**硬编码 `GMT+8`，用形态匹配 `/GMT[+-]\d/` + `/\d{4}/`（I-22）。
- 两个 Playwright project（`chromium` / `Mobile Chrome`）天然覆盖桌面 1280×800 与移动 390×844。
- **BDD-22（非 owner 三处无入口）的具体断言形态**：以**非 owner 身份**分别访问
  ① Explore 卡片（`/explore`，卡片内）、② Explore 列表行（`/explore` 列表模式）、③ 详情页（`/{slug}`，桌面头部 + 移动元信息条），
  均断言 `await expect(page.locator('[data-testid="visibility-toggle"]')).toHaveCount(0)`。
  三处共用同一 testid（`visibility-toggle`），**用 `count=0` 而非 `not.toBeVisible()`**——未渲染与渲染后隐藏是两件事，BDD-22 要求的是"无入口"（机制侧由 `v-if="isOwner"` 保证）。
- 0 文件 entry 素材：`POST /api/v1/entries`（debug backend，空 `files`）现造，**禁** `peekview create`（陷阱 14 / I-19）。
- **`team-visibility.spec.ts` 的回归不并入本 key**：若主 Agent 需保留该 spec 的回归覆盖，用**独立 key** `P5_e2e_legacy`（`is_legal_gate_key` 实测 True），各自独立跑、独立记录——不塞进 `P5_e2e` 的正则里（那正是 B-1 的成因形态）。

### 6.4 既有断言的显式更新面（**禁止静默改**）

| # | 位置 | 现状断言 | 更新为 | 依据 |
|---|---|---|---|---|
| 1 | `e2e/team-visibility.spec.ts:137-152`（BDD-40） | 团队 entry 卡片 `visibility-toggle` count = 0，且**整段断言被包在 `if ((await teamCard.count()) > 0) { … }` 里** | 团队 entry **有** `visibility-toggle`（count ≥ 1）。**同时必须拆掉 `if (count > 0)` 守卫**——改为前置断言 `await expect(teamCard).toHaveCount(1)`，再断言 `visibility-toggle` count ≥ 1。不拆守卫则卡片没渲染时断言同样被跳过 → 翻转后仍是假绿 | 陷阱 16 / R5 |
| 2 | `src/components/__tests__/tpv0095-entry-card-team.spec.ts:78-90` | 同上（count = 0） | 同上 | R5 |
| 3 | `src/components/__tests__/tpv0095-entry-list-row-team.spec.ts:75-86` | 同上 | 同上 | R5 |
| 4 | `src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts` | store 守卫：团队 entry `toggleVisibility` 返回 false | 团队 entry `setVisibility` 正常发起请求 | 陷阱 11 |
| 5 | `src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts:111-112`（`statusTagText()` 助手，内含 `wrapper.find('.status-tag')`） | 助手把 `.status-tag` 的文本取出供三态断言使用 | **改为定位菜单入口按钮**（`[data-testid="visibility-toggle"]`），助手改为读按钮文本 —— D8 的语义是**替换**（只读 `.status-tag` 不再单独渲染），不是"保留只读标签"。**影响面是 3 条断言而非 1 条**：`statusTagText()` 被 `:135`（team：`toContain('团队')` + `toContain('Proj A')`）、`:143`（private：`toContain('Private')`）、`:148`（public：`toContain('Public')`）三处消费——**改助手即一并覆盖三条**，P4 不要只改一处就以为完事。另注：不能保留 `.status-tag` 类名定位——`EntryDetailHeader.vue:63-64` 的 `Archived` / `Expired` 也带该类，替换后同页会出现多个 `.status-tag`，`find()` 取首个会误命中 | BDD-23 / D-11 |
| 6 | `src/__tests__/filter-tabs.test.ts:67`、`src/__tests__/expired-warning.test.ts:67` | `timeEl.attributes('title') === '2026-07-07 14:30'` | tooltip 元素文本包含相对时间 + 绝对时间（`[data-testid="time-tooltip"]` 的 `textContent` 三段结构） | R4（`title` 已改为 DOM tooltip） |
| 7 | `filter-tabs.test.ts:9`、`t093-star-exempt.test.ts:23`、`expired-warning.test.ts:9` | `vi.mock` 返回 `{relative, full}` | 补 `absolute` | R4（composable 返回值扩字段） |
| 8 | `t067-detail-framework.spec.ts:97`、`T079-entry-detail-header.spec.ts:79`、`tpv0095-detail-visibility-tag.spec.ts:75` | 直传 `relativeTime` prop | 改传 `:date-str`（或相应的 `TimeDisplay` prop） | R4 + B5 明细表 |
| 9 | `e2e/t052-header-redesign.e2e.spec.ts:108-112`（`await expect(dropdown.locator('text=Make Private')).toBeVisible()`）与 `:114`（`await expect(dropdown.locator('text=Currently Public')).toBeVisible()`） | overflow 菜单含 `Make Private` 项 + `Currently Public` hint | 该项**已移除** → 改为断言其**不存在**（`toHaveCount(0)`），或改断言新的头部菜单入口；**`:114` 的 `Currently Public` hint 断言随该项移除一并失效，须同改** | D6 裁决（移除） |
| 10 | `src/views/EntryListView.vue:640`、`src/composables/useEntryDetailActions.ts:52` 及其断言 | toast 文案 `Entry made public` / `Entry made private` | `Made public` / `Now private`（+ `Shared with Team <name>` / revoked warning 两态） | D-14（文案变更须显式登记，`§6.4` 标题即"禁止静默改"） |
| 11 | `src/__tests__/header-layout.test.ts:67-76` | `TC-D01` 断言 `formatRelativeTime(...)` 匹配 `/\d+d ago/`；`TC-D02` 只断言 `formatFullDate` `toBeTruthy()` | `TC-D01` 的语义前提（主显是相对时间）失效 → 改为断言主显为绝对时间形态（含 `/\d{4}/` 与 `/GMT[+-]\d/`）；`TC-D02` 强度提升为含 `GMT±N` 偏移（不再只 `toBeTruthy()`） | D-17 / R4（P1 §6.1 已登记该文件，上一版漏转抄） |

> **第 9 项的范围裁定（裁决 1）**：**只改 E2E（`:108-112` + `:114`），不改 `src/__tests__/t052-header-redesign.test.ts:100`**。实测该行是
> ```ts
> const item: OverflowMenuItem = { label: 'Make Private', icon: 'globe' }
> const isLucideName = !/[🌙☀️...]/.test(item.icon || '')
> ```
> 它断言的是"icon 是 Lucide 名称而非 emoji"，`label` 只是测试自身构造的字面量数据，**与组件行为无关**——把它列为"待更新断言"会让 P4 做无意义改动。
>
> **第 1/5 项是分工不同的两条**：第 1 项翻转 E2E 的 BDD-40（团队 entry 现在**有** toggle），第 5 项把详情页的 `.status-tag` 定位改为菜单入口——两者都源自同一批设计变更但作用在不同文件，不可合并。

---

## 7. `[SCOPE+]` 登记

```
[SCOPE+] 发现：`useRelativeTime` 的返回值形状需由 `{relative, full}` 扩为 `{relative, full, absolute}`，
         且 4 处渲染点的主显字段从 `relative` 改为 `absolute`——这会使 3 个 `vi.mock` 文件与
         3 个直传 prop 的 spec 需要同步更新（§6.4 第 6/7/8 项）。
         必须做的理由：主显绝对时间（BDD-01）与 tooltip 含相对时间（BDD-02）是两个不同字段，
         现有形状只够一个；不改形状则组件内要各自重复格式化逻辑，BDD-03 的"三处规则一致"失去机制保证。
         影响：P1 §6.1 已声明"mock 形态不变即不受影响"的前提被推翻（该前提假设 composable 形状不变）；
               BDD 基线**无需增补**（30 条已覆盖行为），但 §6.4 的断言更新面需在 P3/P7 显式登记。
         影响包：frontend-v3（仅此一个，backend / docs 不受影响）
```

> 结论：本 `[SCOPE+]` 不新增 BDD，只把"既有断言更新面"从隐式变为显式清单——**不扩大任务范围**。

### 7.1 SUGGEST 登记（本任务发现但不扩大范围修的既有债务）

以下四项均由 P2 评审发现、经我独立复现确认，但**修复会超出 P1 的四项范围**（会波及全部既有组件或既有布局密度），故不纳入本任务实现，登记为后续 roadmap 候选。P6 验收**不检查**这四项，但也**不得**在报告里把它们写成"已达标"。`S4` 是本轮（retry 2）随 N-2 裁定新增的登记项。

| # | 债务 | 实测依据 | 为何不在本任务修 | 建议处置 |
|---|---|---|---|---|
| S1 | `--c-text-tertiary` 对比度低于 WCAG AA 正文标准 | 暗色 `#6a7682` on `#121822` = **3.84:1**；亮色 `#8c959f` on `#ffffff` = **3.04:1**（均 < 4.5:1）。卡片/列表的时间文本正用该色 | 改 `--c-text-tertiary` 会波及**全部**使用该变量的既有组件（非本任务改动面）；逐组件改色同样超出四项范围 | 独立任务：统一把 tertiary 文本提到 `--c-text-secondary`（5.25:1 / 7.26:1）或调深 `--c-text-tertiary` 本身。时间主显改用 secondary 是可选的一次性改进 |
| S2 | 既有 28×28 动作按钮（`card-action-btn` / `action-btn`）触达高度低于 `DESIGN.md` 的 44px | `DESIGN.md:270` 「Touch targets: minimum 44px」；两处按钮实际 28×28 | 改成 44px 会改动 Explore 卡片/列表的既有布局密度，连带大量既有视觉断言 | 独立任务：移动端动作按钮统一到 44px。本任务只保证**新增**的 `VisibilityMenu` 移动端触发按钮 ≥ 44px（VC-4） |
| S3 | 团队列表加载失败的降级语义（R11）未上升为 BDD | `team.ts` catch 分支只置 `error`，`teamsLoaded` / `allTeams` 不变 | BDD-17 已覆盖"无团队"语义；失败态属错误处理，新增 BDD 会改 P1 基线 | P3 用 UI 单测覆盖（`visibility-menu.spec.ts` 的 `teamsFailed` 用例）+ P6 人工复核；若后续需要强约束再补 BDD |
| S4 | `variant="sheet"` 浮层的**交互细节**（拖拽关闭 / 浮层内 `max-height` 滚动 / 背景滚动锁定） | 本任务 sheet 复用 `OverflowMenuSheet` 的呈现形态，但**不复用其平铺 item 模型**（§3.5），故其拖拽手势与滚动锁定的完整实现需自行补齐 | 本任务只要求 `Teleport to="body"` + 打开/关闭可用（VC-2 / BDD-30）；拖拽与滚动锁定不在四项范围内 | 独立任务：抽 `BottomSheet` 基础组件供 `OverflowMenuSheet` 与 `VisibilityMenu` 共用。**注**：Explore 侧 sheet 的**形态与切换主体**已在本任务落地（N-2 裁定 ②），本项只登记交互细节，不推翻 N-2 |

---

## 8. 最小验证（`minimal_validation`）

本方案依赖**浏览器行为**（`toLocaleString` 的 locale/时区输出形态、悬停 tooltip 的可观测性、Playwright 的 `timezoneId`/`locale` 控制）与**外部系统行为**（Pydantic `field_serializer` + FastAPI 响应路径 + SQLModel `table=True` 交互）。**不是纯代码逻辑**，故逐项做了最小验证（脚本落 `.agate-tmp/`）。

```yaml
minimal_validation:
  - id: V1
    assumption: "PlainSerializer(when_used='json') 加在叶响应模型上，python 模式 model_dump() 仍返回 datetime，且不污染 table 模型"
    method: "backend/.venv/bin/python 跑 20 行脚本：定义 EntryBase(含 datetime) + Entry(EntryBase, table=True) + EntryResponse(含 UtcDT)，分别 dump json/python 两模式"
    result: confirmed
    note: "pydantic 2.13.4。TABLE json={'created_at':'2026-11-10T09:43:00'}（无 Z）；TABLE py=datetime；LEAF json='...Z'；LEAF py=datetime。when_used='json' 隔离成立"

  - id: V2
    assumption: "通配 @field_serializer('*', when_used='json', check_fields=False) 放在 mixin 里，能让叶模型所有 datetime 字段带 Z，且未来新增字段自动纳入"
    method: "backend/.venv/bin/python 跑 30 行脚本：UtcMixin + 单字段/多字段/嵌套模型/list/dict 容器/继承（ShareCreateResponse 继承 ShareResponse）/table 模型反证"
    result: confirmed
    note: "叶模型 json 全带 Z（含未来字段 future_field）；python 模式全 datetime；嵌套模型（也继承 mixin）递归生效；list/dict 原样透传；ShareCreateResponse 经继承即得。**反证**：让 table=True 模型继承 mixin 后 model_dump(mode='json') 也变 Z → 证实 R1 的缓解措施必要"

  - id: V3
    assumption: "FastAPI 的五条响应路径都能正确带出 Z（response_model 实例 / response_model dict / JSONResponse(model_dump(mode='json')) / 直接返回实例 / table 路径不带）"
    method: "backend/.venv/bin/python + fastapi.testclient 起 5 个端点实跑"
    result: confirmed
    note: "/rm_instance、/rm_dict、/jsonresponse、/plain 全部 '...Z'（含嵌套）；/table 为 '2026-11-10T09:43:00'（无 Z）→ P0 §1.2.1 第 2 条的'重新校验丢 Z'在本形态下不发生（契约落在 response_model 指名的类上）"

  - id: V4
    assumption: "BDD-07 的遍历判据（非 table 且不被 table 模型继承）可机械化实现，且命中集合与 P1 §6.9 的 15 类/31 字段一致"
    method: "backend/.venv/bin/python + inspect 遍历 peekview.models 的所有 SQLModel 子类，按 model_config['table'] 与 MRO 过滤"
    result: confirmed
    note: "命中 **16 类 / 34 字段**（比 P1 清单多 ShareCreateResponse 的 3 字段——P1 把'经继承即得'排除在附录外，但遍历会命中它）。EntryBase/UserBase 排除条件实测有效（inherited_by_table=True）。**判据以遍历为准**，P3 不硬编码 15/31（见 R6）"

  - id: V5
    assumption: "Playwright context 的 timezoneId + locale 能精确控制 toLocaleString 输出，使 BDD-04 可二值判定"
    method: "node + playwright chromium 起 3 个 context（Asia/Shanghai+zh-CN / UTC+en-US / 默认），对 '2026-11-10T09:43:00Z' 求 shortOffset 与 longOffset 输出"
    result: confirmed
    note: "Asia/Shanghai+zh-CN → '2026/11/10 GMT+8 17:43:00'（含 17:43:00 与 GMT+8，满足 BDD-04）；UTC+en-US → '11/10/2026, 09:43:00 AM GMT+0'；longOffset → 'GMT+08:00'（满足 BDD-02 的完整偏移判据）"

  - id: V6
    assumption: "tooltip 的内容在 E2E 里可被断言——决定了 tooltip 必须用什么形态实现（这是本任务唯一可能到 P6 才发现不可行的假设）"
    method: "node + playwright 对三种 tooltip 形态各建一个 HTML 探针，测 getByText 命中数、isVisible()、textContent、伪元素 computed content；另测 opacity:0 的 isVisible() 语义"
    result: refuted
    note: "**原生 title 属性**：悬停前后 getByText 均命中 0（不在 DOM 中）→ 不可断言'悬停后出现'。**CSS ::after + content:attr()**：getByText 命中 0、textContent 不含伪元素内容，只能读 getComputedStyle(el,'::after').content → 绑定实现细节。**自定义 DOM tooltip（visibility:hidden↔visible + role=tooltip）**：悬停前 isVisible=false、悬停后 true、移开 false、:focus-within 也 true，getByText 命中且 textContent 可读 → **唯一可断言形态**。**附加发现**：opacity:0 元素 isVisible() 仍为 true → 用 opacity 做隐藏会让'未悬停'也判可见，破坏 BDD-02 的 Given/When 区分。→ 结论驱动 §2.3 选 C2 + §1.3 R3"

  - id: V7
    assumption: "无效日期经 toLocaleString 不产生 NaN 文本；未来时间的 diff 计算方向可判"
    method: "node 对 'not-a-date' / '' / null / undefined 求 getTime() 与 shortOffset 输出；对未来 24h 求 diffMs 符号"
    result: confirmed
    note: "Invalid Date 的 toLocaleString 输出 'Invalid Date'（不含 NaN）；getTime() 为 NaN（Number.isNaN 可判）；未来 24h 的 diffMs = -86400000（负）→ 方向可判，`in N…` 分支可实施"

  - id: V8
    assumption: "P3 聚合命令（先后跑后端与前端两套测试、不用 && 短路）的 exit code 语义正确"
    method: "bash 脚本对 {true,false}×{true,false} 四种组合验证聚合表达式"
    result: confirmed
    note: "四种组合 exit 分别为 0/1/1/1 → 任一失败即失败，且两套测试都会被执行（不短路）。用于 gate_commands.P3"

  - id: V9
    assumption: "make debug-test 裸调用只跑 debug-server.spec.ts，定向须 E2E_SPEC="
    method: "读 scripts/run-e2e-tests.sh:78 确认默认值；实跑 npx playwright test --list 对『正则 alternation』与『写死文件名』两种形态各验一次"
    result: refuted
    note: "默认 `spec=\"${E2E_SPEC:-e2e/debug-server.spec.ts}\"`（TPV0099 假绿陷阱确认存在）。**上一版此处的判据用错了**——它验证的是『正则被 playwright 接受（列出 12 tests in 1 file）』就下结论『可用』；正确判据应是『**命中集合 == 期望集合**』。实测 `--list 'e2e/(tpv0102|team-visibility)'` → `Total: 12 tests in 1 file`，全部来自 `team-visibility.spec.ts`、`tpv0102` 命中 **0** → **命中集合 ≠ 期望集合**，且 `1 file`（而非 2 file）本身已经暴露问题。反向也实测：`--list 'e2e/zzzznonexistent'` → `Error: No tests found` exit **1**（『0 tests 也算 exit 0』的具体担忧**不成立**；真正的假绿来自 alternation 里的 team-visibility 保证永不为空）。→ 结论驱动 §6.3/§9 改为**写死文件名**"

  - id: V10
    assumption: "P3 聚合命令能产出可判的 TDD 红灯（B 类），而非 A 类假红——这决定了 `P3` 命令的形态（本轮新增，上一版未验）"
    method: "用真实 `agate_common.run_test_with_formatter(cmd, pytest.sh)` + 真实 `check-tdd-red.py::judge_result`，对**完整聚合 P3 命令**跑五格矩阵（探针脚本 `.agate-tmp/probe_b3.py` import 尚不存在的 `peekview.timefmt`，pytest exit 2，模拟 P3 实现未写场景）"
    result: confirmed
    note: |
      五格实测（project_module='peekview'）：

      | 变体 | exit | import_errors(module) | judge exit | 判定 |
      |---|---|---|---|---|
      | A `--tb=no` + `2>&1 | tail -30`，无 formatter | 1 | 0 | **1** | A 类假红 |
      | B `--tb=short` + `2>&1 | tail -30`，无 formatter | 1 | 0 | **1** | A 类假红 |
      | C `--tb=no` + `2>&1 | tail -30`，+ pytest.sh | 1 | 1 (`''`) | **1** | A 类假红 |
      | D `--tb=short` + `2>&1 | tail -30`，+ pytest.sh | 1 | 1 (`''`) | **1** | **A 类假红** |
      | **E `--tb=short`，去掉 `tail -30`，+ pytest.sh** | 1 | 3 (`'', peekview.timefmt, ''`) | **0** | ✅ B 类红灯 |

      **根因不是 `--tb=no`，而是 `2>&1 | tail -30` 把 traceback 截掉**：真实全量套件的 warnings summary ≈15 行，`ModuleNotFoundError` 落在距 EOF **10 行以外**（实测全量输出 41 行，命中在第 31 行；`tail -30` 只留末尾 30 行 → 被砍），只剩 short summary 的 `ERROR - ImportError while importing test module '.../....'`（pytest 把长路径缩写成 `....`，正则取不到 module → `module=''`）→ 落 `A-class error (import errors are NOT from project module 'peekview')`。
      **结论：三件事必须同时做**——① `--tb=no` → `--tb=short` ② 声明 `P3_formatter: pytest.sh` ③ **`P3` 命令里去掉 `tail -30`**。只做 ①②（主 Agent 矩阵的两件）会停在 D 格，仍然假红。
      **去掉 `tail` 后输出仍是紧凑的**：实测全量后端套件 `-q --tb=short` 输出仅 **68 行 / 5.3 KB**（绿路径 70 行 / 5.6 KB）——`-q --tb=short` 自身已是紧凑模式，无需管道截断（阶段卡「命令必须用紧凑输出模式」的目标由 `-q --tb=short` 达成，`tail -N` 只是工具无紧凑模式时的兜底，本项目不需要）。
      **前端精度**：单一 `pytest.sh` formatter 对 vitest 输出仍正确判红——实测喂 vitest 的 `FAIL ... Failed to resolve import` 输出 → `exit_code=1 / failed=1` → `classic red-light`，verdict **0**（精度下降但不误判），故聚合命令用单一 formatter 可行。

  - id: V11
    assumption: "`P5_fitness` 的 `-k` 定向在零命中时的退出码语义（决定是否必须在 §6.1 写死测试函数名）"
    method: "实跑 pytest -k 一个不存在于任何用例名的子串"
    result: confirmed
    note: "`.venv/bin/python -m pytest tests/test_models.py -q --tb=no -k definitelyno_such_test_name_xyz` → **exit 5**（`deselected`），非 0。故 P5_fitness 依赖的函数名 `test_mixin_not_in_table_mro` 必须在 §6.1 显式约束为『P3 必须保留』，否则假红"

  - id: V12
    assumption: "`P5_e2e` 写死文件名后，文件缺失能被 exit code 捕获（B-1 的机制保证是否真的落地）"
    method: "实跑 npx playwright test --list 指向一个尚不存在的 spec 文件名"
    result: confirmed
    note: "`npx playwright test --list e2e/tpv0102-explore-card-list-ux.spec.ts`（文件不存在）→ `Error: No tests found.` + `Total: 0 tests in 0 files` + **exit 1**。→ 写死文件名后『P3 忘记建 spec』会立即报错，而非静默假绿"
```

---

## 9. gate_commands

> 本节块由 `agate-md-field-set-gate-commands.py` 写入（非手写），逐 key 经 `is_legal_gate_key` 校验。

gate_commands:
  P3: "( cd backend && .venv/bin/python -m pytest tests/ -n auto -q --tb=short ); b=$?; ( cd frontend-v3 && npx vitest run --reporter=dot ); f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]"
  P3_formatter: "pytest.sh"
  P5: "make test-quick"
  P5_frontend: "make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test"
  P5_e2e_legacy: "E2E_SPEC=e2e/team-visibility.spec.ts make debug-test"
  P5_lint: "make lint"
  P5_typecheck: "make typecheck"
  P5_fitness: "cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro"
  P5_timeout_seconds: 180
  P5_frontend_timeout_seconds: 120
  P5_e2e_timeout_seconds: 900
  P5_e2e_legacy_timeout_seconds: 900
  P5_lint_timeout_seconds: 60
  P5_typecheck_timeout_seconds: 120
  P5_fitness_timeout_seconds: 120
  project_module: "peekview"

**声明要点**：

- **`P3` 为一条聚合命令**：先后跑后端 pytest 与前端 vitest，用 `b=$?; f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]` 聚合退出码——**不是** `&&` 短路链（两套测试都会被执行，V8 已实测四组合语义 0/1/1/1）。
- **`P3` 必须同时满足三件事（V10 五格实测，缺一即假红）**：
  1. **`--tb=short`**（不是 `--tb=no`）；
  2. **声明 `P3_formatter: "pytest.sh"`**；
  3. **不使用 `2>&1 | tail -30` 截断**。

  **为什么**：`pytest.py` formatter 靠逐行扫 `ImportError` / `ModuleNotFoundError` 提取 `import_errors`。`--tb=no` 抑制 traceback → `import_errors=[]` 但 `errors>0` → 落 `if errors > 0` 的 A 类分支（假红）。而 `tail -30` 会连 `--tb=short` 的 traceback 一起截掉——实测全量套件 warnings summary ≈15 行，`ModuleNotFoundError` 距 EOF 10 行以外被砍，只剩被缩写的 `ERROR - ImportError while importing test module '.../....'`（module 取不到 → `''`）→ 同样落 A 类。**只做 ①② 不做 ③ 仍然假红**（V10 的 D 格）。
  **去掉 `tail` 不会让输出变大**：`-q --tb=short` 本身即紧凑模式，实测全量后端套件输出仅 68 行 / 5.3 KB——`tail -N` 只是"工具无紧凑模式"时的兜底，本项目不需要。
  **前端精度**：单一 `pytest.sh` 对 vitest 输出仍判 `classic red-light`（实测 `failed=1` → verdict 0），精度下降但不误判，故聚合命令可共用单一 formatter。
- **`P5_e2e` 写死文件名（B-1 修正）**：`E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`。**不用正则 alternation**——上一版 `E2E_SPEC='e2e/(tpv0102|team-visibility)'` 实测命中 `Total: 12 tests in 1 file`（全来自既有 `team-visibility.spec.ts`，`tpv0102` 命中 **0**），**今天就已经 exit 0** 而本任务 E2E 覆盖为 0，假绿不可由 exit code 察觉。写死后缺文件 → `No tests found` + exit 1（V12 实测）。**§6.3 已写明 P3 必须创建该文件名**。
- **`P5_e2e_legacy` 独立 key**：`team-visibility.spec.ts` 的既有回归不并入 `P5_e2e` 的正则（那正是 B-1 的成因形态），拆独立 key 各自跑、各自记录。`is_legal_gate_key` 实测 True。
- **`P5_e2e_timeout_seconds: 900`（B-2 修正）**：`scripts/run-e2e-tests.sh:92` 的 `E2E_TIMEOUT="${E2E_TIMEOUT:-600}"` 是**内层**硬超时，随后 `timeout "$E2E_TIMEOUT" npx playwright test ...` 再套一层。**外层命令级超时必须大于内层硬超时**——上一版写 420 < 600，外层先到期会把内层连带杀掉，则 runner 的 `exit 124 → "✗ E2E 测试超时（600s）"` 分支根本走不到，主 Agent 看到的是外层超时、归因指向"E2E 挂了"而非"预算声明不足"。且 30 条 BDD × 2 个 project（`chromium` / `Mobile Chrome`）含登录/造数据/悬停/菜单展开/二次确认，420s 明显不够。900s 与项目先例 `TPV0099-fullscreen-link/P2-design.md:477-478` 一致。`P5_e2e_legacy_timeout_seconds: 900` **同理且必须等值**（E-1 修正）——上一版给 legacy key 写 600，与本条的规则「外层必须**大于**内层硬超时（默认 600s）」**等值不满足**：外层到期与内层硬超时同时触发，runner 的 `exit 124 → "✗ E2E 测试超时（600s）"` 分支仍可能走不到，B-2 的归因错乱会在 legacy key 上重演。虽然单 spec 12 用例量级远低于 600s、实际触发概率低，但**声明本身不能自相矛盾** → 改 **900**，与 `P5_e2e` 一致。
- `P5` = 后端单元（`make test-quick`），`P5_frontend` = 前端单元（`make test-frontend`），**分成两个 key**而非 `&&` 串联——短路会让后半段从未执行（阶段卡「`--strict` 反模式」）。
- `P5_lint` / `P5_typecheck` 独立 key。
- `P5_fitness` = 架构适应度：断言 `UtcSerializeMixin` 不出现在任何 `table=True` 模型的 MRO（R1 的唯一强制机制）。用 `-k mixin_not_in_table_mro` 定向——**§6.1 已写明 P3 必须保留该函数名**（`-k` 零命中 pytest exit 5，非 0，V11 实测）。
- 禁止声明 `P3_xxx` 检测键（只允许裸 `P3`；`P3_formatter` 是元键，`is_gate_meta_key` 豁免）。

---

## 10. files_to_read

> 只列**实现确实需要参考**的文件；大文件标行号范围。P4 implementer 按需读取，不必整目录通读。

```yaml
files_to_read:
  # ── 后端：序列化契约 ──
  - path: backend/peekview/models.py:70-130
    why: EntryBase:82 / UserBase:116 的确切定义与 3+1 个 datetime 字段——**严禁修改**，mixin 插入点在 now_utc 之后、EntryBase 之前
  - path: backend/peekview/models.py:510-560
    why: ReadStatsResponse:514 / ReadEventResponse:523 的字段清单（叶模型基类替换的第一批）
  - path: backend/peekview/models.py:710-770
    why: CountdownInfo:716 / StarResponse:724 / TombstoneResponse:734 / StarItem:754 四模型
  - path: backend/peekview/models.py:785-870
    why: EntryResponse:791 / EntryListItem:817 / EntryRawResponse:854（含嵌套 ReadStatsResponse/CountdownInfo 的引用关系）
  - path: backend/peekview/models.py:905-925
    why: CreateEntryResponse:913
  - path: backend/peekview/models.py:1020-1120
    why: UserResponse:1026 / ApiKeyResponse:1083 / ApiKeyCreateResponse:1094 / EntryStats:1108
  - path: backend/peekview/models.py:1180-1200
    why: ShareResponse:1185 + ShareCreateResponse:1196（继承关系，后者不单独改）
  - path: backend/peekview/client.py:80-100
    why: _parse_dt 的 datetime.fromisoformat(v) 裸调用位置（唯一需改的解析点）
  - path: backend/peekview/cli.py:370-380
    why: isoformat 第 1/2 处（created_at / updated_at）
  - path: backend/peekview/cli.py:555-580
    why: isoformat 第 3/4 处（list --json 的 item.created_at / updated_at）
  - path: backend/peekview/cli.py:2280-2325
    why: isoformat 第 5/6/7 处（stats latest_created_at 的 json 与 echo 两路）
  - path: backend/peekview/services/admin_service.py:635-650
    why: isoformat 3 处（backup 导出）
  - path: backend/tests/factories.py
    why: 既有测试数据构建器，新增序列化契约测试复用其模型实例化方式
  - path: backend/peekview/services/entry_service.py:800-870
    why: **可见性方案的后端依据**——`team_id_set` 分支（:808-818，非 null team 强制 is_public=False）/ `is_public` 分支（:846-856，team 未清空时无法变 public）/ `revoked_shares` 自动吊销（:856-865，Team→Public 与 Private→Public 时 `revoke_all_for_entry`）。§3.5 的五个转换与 B-4 的 revokedShares 反馈全部由此推导
  - path: backend/peekview/api/entries.py:435-450
    why: `team_id_set = "team_id" in data.model_fields_set` 的真实推导点——决定前端 payload 能否清空 team（`team_id: null` 必须显式出现在 body 里，不能靠省略字段）
  - path: backend/peekview/models.py:805-815
    why: `EntryResponse.revoked_shares` 字段定义（B-4 的 warning toast 数据来源）

  # ── 前端：时间显示 ──
  - path: frontend-v3/src/composables/useRelativeTime.ts
    why: 三个函数的现状全文（56 行，改动核心）
  - path: frontend-v3/src/components/EntryDetailHeader.vue:160-191
    why: 既有 .tooltip / .status-tag 样式（TimeDisplay 与 VisibilityMenu inline 变体要对齐）
  - path: frontend-v3/src/components/EntryMetaTagsBar.vue
    why: 移动端元信息条全文（47 行），TimeDisplay 与菜单的插入点

  # ── 前端：可见性菜单 ──
  - path: frontend-v3/src/components/OverflowMenu.vue:100-160
    why: a11y 惯例唯一权威源——close() 的 triggerRef.focus()、Escape/Tab 关闭、document 监听成对增删（BDD-30 照此实现）
  - path: frontend-v3/src/components/OverflowMenuDropdown.vue
    why: 浮层样式与点击外部关闭的既有实现（VisibilityMenu 菜单容器对齐）
  - path: frontend-v3/src/components/ConfirmDialog.vue
    why: 二次确认 API 形态（title/message/confirmLabel/variant + confirm/cancel 事件 + Teleport）
  - path: frontend-v3/src/stores/entryList.ts:45-78
    why: toggleVisibility 现状（含要删除的 teamId 守卫与乐观更新/回滚模式，以及要保留的 revokedShares warning toast `:64-68`）
  - path: frontend-v3/src/stores/entry.ts:1-40
    why: **store 透传层**——§3.5 要求同步导出 `setVisibility`（签名变化），此文件是导出面所在
  - path: frontend-v3/src/stores/entryDetail.ts:95-110
    why: syncVisibility 现状（只同步 isPublic，需扩三字段）
  - path: frontend-v3/src/stores/team.ts:10-40
    why: allTeams computed + loadMyTeams + teamsLoaded 标志 + **catch 分支只置 error 不置 teamsLoaded**（视图层"已加载则跳过"判据 + R11 团队加载失败降级）
  - path: frontend-v3/src/composables/useEntryDetailActions.ts:63-120
    why: overflowItems 构造（含要移除的 Make Public/Private 项与 divider 处理）

  # ── 前端：视图挂载点 ──
  - path: frontend-v3/src/views/EntryListView.vue:165-195
    why: EntryCard / EntryListRow 的 prop + 事件绑定（改为 @change-visibility + 下发 teams）
  - path: frontend-v3/src/views/EntryListView.vue:545-560,630-650
    why: ensureMyTeamsLoaded + handleToggleVisibility（toast 四态改写点，含 revokedShares warning）
  - path: frontend-v3/src/views/EntryDetailView.vue:1-80
    why: EntryDetailHeader / EntryDetailContent 的 prop 链（新增 teams 下发）
  - path: frontend-v3/src/views/EntryDetailView.vue:185-215
    why: onMounted 与 useRelativeTime 调用点（新增 loadMyTeams 的插入位置）
  - path: frontend-v3/src/components/EntryDetailContent.vue:20-62
    why: 三种空态分支（!currentEntry / activeFile / else）——0 文件空态的拆分点
  - path: frontend-v3/src/components/EntryCard.vue:1-60
    why: card-actions 单按钮 + 空 span 占位 + 元信息行（三处改动落点）
  - path: frontend-v3/src/components/EntryListRow.vue:1-60
    why: entry-actions 单按钮 + 元信息行（同上，注意列表无空占位）

  # ── 前端：类型与 API ──
  - path: frontend-v3/src/types/index.ts:35-75
    why: Entry / Team / TeamRef 类型（VisibilityMenu 的 props 契约）
  - path: frontend-v3/src/api/client.ts:190-215
    why: updateEntry 的 payload 类型（{is_public?, team_id?} 已支持，无需改）

  # ── 测试基线（P3 需对齐既有断言，对应 §6.4 的 11 项更新面） ──
  - path: frontend-v3/src/components/__tests__/tpv0095-entry-card-team.spec.ts:70-95
    why: §6.4#2 BDD-40 断言现状（团队 entry visibility-toggle count=0 → 需翻转）
  - path: frontend-v3/src/components/__tests__/tpv0095-entry-list-row-team.spec.ts:70-90
    why: §6.4#3 同上（列表行）
  - path: frontend-v3/src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts
    why: §6.4#4 store 守卫现状（团队 entry toggleVisibility 返回 false → 改为 setVisibility 正常发起）
  - path: frontend-v3/src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts:70-80
    why: §6.4#5/#8 详情页只读 status-tag 断言 + 直传 relativeTime prop（需改为定位菜单入口）
  - path: frontend-v3/src/__tests__/filter-tabs.test.ts:1-70
    why: §6.4#6/#7 title 断言 + vi.mock 返回值形状（需补 absolute）
  - path: frontend-v3/src/__tests__/expired-warning.test.ts:1-70
    why: §6.4#6/#7 同上
  - path: frontend-v3/src/__tests__/t093-star-exempt.test.ts:1-30
    why: §6.4#7 vi.mock 返回值形状
  - path: frontend-v3/src/__tests__/header-layout.test.ts:60-80
    why: §6.4#11 TC-D01 断言 /\d+d ago/（主显改绝对时间后语义前提失效）、TC-D02 强度需提升为含 GMT±N
  - path: frontend-v3/src/components/__tests__/t067-detail-framework.spec.ts:90-100
    why: §6.4#8 直传 relativeTime prop
  - path: frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts:70-85
    why: §6.4#8 同上
  - path: frontend-v3/e2e/team-visibility.spec.ts:130-155
    why: §6.4#1 E2E 层 BDD-40 断言现状（含要拆掉的 `if ((await teamCard.count()) > 0)` 守卫）+ 登录/造数据 helper（tpv0102 spec 可复用）
  - path: frontend-v3/e2e/t052-header-redesign.e2e.spec.ts:100-120
    why: §6.4#9 overflow 菜单 `text=Make Private` 与 `Currently Public` hint 断言（随 D6 移除一并失效）。**注意**：`src/__tests__/t052-header-redesign.test.ts:100` **不改**（字面量 + isLucideName 断言，与组件行为无关）
  - path: frontend-v3/playwright.config.ts
    why: 两个 project（chromium / Mobile Chrome）+ use 块无 locale/timezoneId（P3 需在 spec 内 test.use 固定）
```

---

## 11. env_constraints

> **边界提醒**：本节是**声明性字段**——只做信息确认/注入，不会被自动执行，也没有 gate 脚本会校验这里写的条件是否成立。需要被强制执行的约束已落到 `gate_commands`（`P5`/`P5_e2e`/`P5_lint`/`P5_typecheck`/`P5_fitness`）与 §6.3 的 E2E 纪律。

```yaml
env_constraints:
  debug_env: "make debug-quick（build-frontend-fast + debug-start + debug-seed，~20s）或 make debug（clean+build+start+verify-isolation+E2E+MCP，~5min）；服务 127.0.0.1:8888，数据目录 /tmp/peekview-debug/，DB /tmp/peekview-debug/peekview.db"
  debug_start_rule: "跨调用保活：`( make debug-start; sleep 3600 )` 挂后台 job 托底——前台 make debug-start 返回后其进程树被回收（PID 文件残留但 ss 无监听），后续 seed/E2E 必失败"
  prod_forbidden: "严禁触碰生产 :8080 与 ~/.peekview/；严禁 uvicorn 直接启动；严禁 pip3 install --break-system-packages；严禁 peekview create CLI 造数据（可能写生产 DB）"
  test_data_rule: "测试 entry 只经 debug backend HTTP API 创建：curl -X POST http://127.0.0.1:8888/api/v1/entries（0 文件 entry 传空 files 数组——seed-data/image-gallery 因 seed-debug.py:184 的 `if not files: SKIP` 不入库，无现成素材）"
  frontend_route: "页面路由是 /{slug}，不是 /entries/{slug}；API 是 /api/v1/entries（此错误反复导致 Playwright 验证失败）"
  isolation_check: "make debug-verify-isolation（依赖 :8080 在线）；不在线时用 sqlite3 /tmp/peekview-debug/peekview.db \"SELECT COUNT(*) FROM entries\" 手动验证；另可断言 pid 进程的 DB 路径含 peekview-debug"
  e2e_rule: "定向须 E2E_SPEC=<path|regex>——裸 make debug-test 只跑 e2e/debug-server.spec.ts（run-e2e-tests.sh:78）；BASE_URL 含 :8080 或 prod 时 spec 的 beforeAll 直接 throw"
  e2e_locale_tz: "playwright.config.ts 的 use 块无 locale / timezoneId → 默认 en-US + runner 时区；断言墙上时间字面量的 spec 必须 test.use({ timezoneId, locale }) 显式固定（BDD-04 用 Asia/Shanghai + zh-CN，实测输出 '2026/11/10 GMT+8 17:43:00'）"
  e2e_assertion_rule: "BDD-01/02/03/26 不得硬编码 GMT+8，用形态匹配 /GMT[+-]\\d/ + /\\d{4}/（CI runner 时区可能不同）"
  build_rule: "改前端后必须 make build-frontend（或 make debug-quick）重建 static——make debug-start 启动前强制检查 backend/peekview/static/index.html，缺失直接退出"
  python_rule: "后端测试用 backend/.venv/bin/python（make test-quick 的 guard-venv 保证）；不要裸 python3 -m pytest（系统 Python 无依赖）。requires-python >=3.10 但 CI/publish 用 3.12——client.py 的 Z 兼容必须在 3.10 语义下正确（用 replace 而非依赖 3.11+ 行为）"
  frontend_test_rule: "make test-frontend（npx vitest run，非 watch）；禁止 npm run test（watch 模式会挂住 agent）"
  temp_dir: "临时产物落 <项目根>/.agate-tmp/（已 gitignore），不要用 /tmp（受限 harness 下跨调用不可见）"
  timeout_rule: "所有 bash 命令外层 timeout（预期耗时 ×1.5）；gate_commands 已声明 {key}_timeout_seconds 的 key 直接取其值作为预期耗时"
  status_marker: "[PROD_NOT_TOUCHED]"
```

---

## 12. 裁决项（已全部裁定，本轮已采纳）

> 三项均已在 P2 retry 1 轮由评审给出结论并**被本版采纳**，不再是待决项。留此表作决策记录（P7 可据此核对实现是否偏离裁定）。

| # | 项 | 裁定 | 裁定依据 | 落实位置 |
|---|---|---|---|---|
| 1 | 详情页 `useEntryDetailActions.ts` 的 `Make Public`/`Make Private` overflow 项：移除 vs 保留 | **移除**（D6 采纳） | plan-design-review §4 裁决 1。三条硬理由：① overflow 项无法表达 Team 态，对 team entry 显示 `Make Public` 而后端 `entry_service.py:846-856` 对非空 team 强制落 private → 是本任务要修的缺陷形态复现；② 无"零入口"窗口（`mount-detail` 批同交付 `useEntryDetailActions.ts` + `EntryDetailHeader.vue`）；③ 入口单一化是 P0 决策 3 的立项动机 | §1.1 D6 / §2.2 裁决块 / §6.4#9（**只改 E2E，不改 `t052-header-redesign.test.ts:100`**） |
| 2 | BDD-07 遍历口径命中 16 类/34 字段 vs P1 §6.9 的 15 类/31 字段 | **以遍历为准**，P3 **不硬编码** 15/31；P6 记录该差异为预期 | plan-eng-review 锁定决策 4（独立复现：`ShareCreateResponse` 自身 0 个 datetime 字段、3 字段全继承自 `ShareResponse`；两评审均确认处置正确） | §1.3 R6 / §8 V4 / §6.1 首行判据 |
| 3 | `visibility-toggle` testid 沿用（翻转 TPV0095 断言）vs 改名 `visibility-menu-trigger` | **沿用，不改名** | plan-design-review §4 裁决 2：`EntryCard.vue:8` / `EntryListRow.vue:98` 已用该 testid；改名要动 2 处组件 + 5 处断言 + 1 处 E2E，漏改一处即静默红。**且 §3.8 表内原有 `visibility-menu-trigger` 与「沿用 `visibility-toggle`」两条指向同一元素 → 已删除前者** | §3.8（表已去重）+ §6.4#1~#4 |

---

## 13. 本轮修订对照表（P2 retry 1 闭合情况）

> 逐条对照 `P2-review-eng.md`（B-1~B-4 + 6 非阻塞）与 `P2-review-design.md`（D-1~D-20 + 2 裁决）。**全部闭合**。

### 13.1 eng-review 阻塞项（4/4 闭合）

| # | 闭合判据（评审原文） | 本版落点 | 状态 |
|---|---|---|---|
| B-1 | `P5_e2e` 为**写死文件名**的命令；§6.3 写明 P3 必须创建该文件名；若保留 `team-visibility` 回归则为独立 key | §9 `P5_e2e: E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`；`P5_e2e_legacy` 独立 key；§6.3 标题即「文件名写死」+ 必须创建声明；§8 V9 判据改为「命中集合 == 期望集合」（`refuted`）；新增 V12 证缺文件 exit 1 | ✅ |
| B-2 | `P5_e2e_timeout_seconds: 900` + §9 补理由 | §9 `P5_e2e_timeout_seconds: 900`；声明要点写明「外层命令级超时必须大于内层硬超时（`run-e2e-tests.sh:92` 默认 600s）」+ 30 BDD × 2 project 量级 + TPV0099 先例 | ✅ |
| B-3 | 声明 `P3_formatter: "pytest.sh"`，或 §9 的"不误判"结论改为与实测一致 | §9 已声明 `P3_formatter: "pytest.sh"`；`P3` 改 `--tb=short`；§9 原「不误判」结论已删除并改写为 V10 五格实证。**额外发现并修正第三件必须做的事：去掉 `tail -30`**（主 Agent 矩阵漏掉的 D 格，只做 ①② 仍假红） | ✅ |
| B-4 | `setVisibility` 成功分支补 `revokedShares > 0` 的 warning toast + §6.2 补对应单测 | §3.5 `setVisibility` 伪码回传 `revokedShares`（**retry 2 按 E-2 改为「store 只回传计数、视图层发 toast」**，warning 语义未丢）；§1.1 D4/D9 登记；§5 success 项四态；§6.2 新增 `entry-list-visibility.spec.ts`（断言返回值计数，toast 断言落视图层） | ✅ |

### 13.2 design-review 高级别项（D-1~D-5，5/5 闭合）

| # | 缺陷 | 本版落点 | 状态 |
|---|---|---|---|
| D-1 | `VisibilityMenu` props 缺 `disabled` / emits 缺 `confirm-cancel` / 内部状态未声明 | §3.5 三张表：props 5 项（含 `disabled` / `teamsFailed`；`currentTeamSlug` 行已删，其派生路径见 §13.6 N-1）、emits 2 项、内部状态 5 项 | ✅ |
| D-2 | `visibility-confirm` testid 不可实现 | §3.8 该行改为「不设 testid，用既有类名 `.confirm-dialog`」；§3.5 说明不可实现原因（Teleport 根 + 无 testid）；§1.2 列 `ConfirmDialog.vue` 不改 | ✅ |
| D-3 | 同 B-4（`revokedShares`） | 见 B-4 | ✅ |
| D-4 | 移动端无 sheet 形态，违反 `DESIGN.md` §9 | §3.5 `variant: 'icon' \| 'inline' \| 'sheet'`；`sheet` 走 `Teleport to="body"` 规避 `.content-area` 裁剪；与 `EntryDetailMobileBar.vue:50` 先例一致；§1.1 D3 登记 | ✅ |
| D-5 | VC-4 触达高度 24px < 44px | VC-4 改 **44px**，并拆成「本任务新增按钮必须 ≥44px」+「既有 28px 按钮不在本任务范围（§7.1 S2 登记）」两条 | ✅ |

### 13.3 design-review 中/低级别项（D-6~D-20，15/15 闭合）

| # | 缺陷 | 本版落点 |
|---|---|---|
| D-6 | 对比度「风险为零」不成立 | UI 设计节改为 4 行实测对比度表 + 如实陈述 + 债务归属；§7.1 S1 登记 SUGGEST |
| D-7 | tooltip `left:0`+`nowrap`+`ellipsis` 与 checklist 矛盾、且会截断三段文本 | §3.4 CSS 改桌面左对齐 / ≤640px 右对齐 + `white-space: normal`，**去掉 `ellipsis`**，附长度估算 |
| D-8 | `2px 6px` / `gap: 2px` 违反 4px 基数且与同节自述矛盾 | 改 `var(--space-1) var(--space-2)` / `var(--space-1)`；`status-tag` 的 `1px 6px` 显式声明为既有例外 |
| D-9 | 团队加载失败与"无团队"UI 相同 | §3.5 三级处置（`teamsFailed` prop + 禁用项文案 + 视图传值 + **语义声明"降级不满足 BDD-17 Given"**）+ R11 + §7.1 S3 + §6.2 单测 |
| D-10 | 二次确认取消态空白 | §3.5 取消路径：清 `pendingTarget` + `emit('confirm-cancel')` + 重开菜单 + `nextTick` 后焦点回触发按钮；§6.2 补单测 |
| D-11 | 双 testid 同指一元素 + §6.4#5 与 D8 矛盾 | §3.8 删 `visibility-menu-trigger` 行；§6.4#5 改为「定位菜单入口按钮」（与 D8 的"替换"统一） |
| D-12 | 新增触发按钮无 `:focus-visible` / 子菜单键盘路径空白 / 无 `aria-haspopup` | §3.5 补焦点环（点名 `.card-action-btn` / `.action-btn` + `layout.css:279` 规则组合）、`aria-haspopup`/`aria-expanded`、子菜单键盘约定 |
| D-13 | `z-index: 30` 不在刻度表且 < sticky header 50 | tooltip 改 **10**，菜单容器 **100**；§3.4 约束 2 + UI 设计节组件一致性 + §5 布局占位关系三处同步 |
| D-14 | toast 文案变更未进 §6.4 | §6.4 新增第 10 项（含 `EntryListView.vue:640` / `useEntryDetailActions.ts:52`） |
| D-15 | `applyPatch` / `restore` 未定义 | §3.5 给签名 + 字段契约表（三转换 × 三字段同写）+ 「三字段必须同写」理由 |
| D-16 | `data-testid="time-display"` 清单有模板无 | §3.4 模板补该属性 + 实现约束 1 声明"清单与模板必须一致" |
| D-17 | 四处调用点 prop 链改动未列清 | §1.1 B5 明细表（调用点 × 现状 × 上游 prop 来源 × 改后 × 上游需删） |
| D-18 | §6.4#9 误列 `t052...test.ts:100` | §6.4#9 已删除该行，只留 E2E `:108-112` + 补 `:114` hint 失效；附范围裁定块 |
| D-19 | §2.2「5 个既有调用方」实为 3 处 | 已校正为 3 处并列名（`EntryDetailHeader.vue:53` / `EntryDetailMobileBar.vue:50` / `settings/UserManagerTab.vue:38`） |
| D-20 | 布局维度缺 ≥2 候选 | 新增 §2.2b 入口落位取舍表（3 个被排除替代 + 理由） |

### 13.4 eng-review 非阻塞项（6/6 处置）

| 项 | 处置 |
|---|---|
| `inFlight` 裸 `Set` 非响应式但声称驱动 `props.disabled` | §3.5 改 `ref(new Set())`，并明确「BDD-24 判据由 store 守卫保证，组件 `disabled` 是附加视觉反馈」+ 给出退路 |
| `applyPatch` / `restore` 未定义 | 见 D-15 |
| "当前团队"两来源且优先级未定义 | 删除 prop `currentTeamSlug`（避免与 `entry` 重复来源）；"当前团队"改由 **`entry.team?.slug`** 派生后作为纯函数入参（**retry 2 / N-1 修正**：原先写"由 `entry.teamId` + `teams` 反查"，但 `Team`/`TeamRef` 无数字 id，该反查不可实现） |
| `EntryDetailHeader` prop 契约口径不一致 | §1.1 B5 明细表统一为 `:date-str`，并登记 `EntryDetailView.vue:203` 的 `useRelativeTime` 解构删除 |
| `P5_fitness` 依赖 P3 测试函数名但未写明约束 | §6.1 新增「P3 必须遵守的三条约束」第 2 条（`-k` 零命中 exit 5，V11 实测） |
| `files_to_read` 缺 4 项 | 已补：`services/entry_service.py:800-870` / `api/entries.py:435-450` / `models.py:805-815`（`revoked_shares`）/ `stores/entry.ts:1-40`；并把 §6.4 点名的既有测试文件全部补入（`files_to_read` 现 50 条，全部路径已实测存在） |
| §6.4 漏转抄 `header-layout.test.ts:67-76` | §6.4 新增第 11 项 |
| §6.4#1 未说要拆 `if (count>0)` 守卫 | §6.4#1 已写明拆守卫 + 前置 `toHaveCount(1)` |
| §6.3 补 BDD-22 具体断言形态 | §6.3 已补（非 owner × 三处 × `count=0` + 为何用 count 而非 `not.toBeVisible`） |

### 13.5 本轮新增的独立发现（不在两份评审中）

| 发现 | 影响 |
|---|---|
| **`P3` 的 `2>&1 \| tail -30` 会截断 traceback，导致 `--tb=short` + formatter 仍判 A 类假红** | 主 Agent 的四格矩阵只覆盖到"单独跑"场景，未覆盖**完整聚合命令 + 真实全量套件的 warnings summary 量级**。只做 ①② 两件事**仍会假红**（V10 的 D 格）。已把第三件事（去 `tail`）写入 `P3` 命令与 §9 声明要点、R12 |
| `-k` 零命中 pytest **exit 5**（非 0） | 已实测确认，写入 §6.1 约束 2 + V11。这与评审描述一致，属独立复现 |
| 写死 spec 文件名后缺文件 **exit 1** | 已实测（V12），确认 B-1 的修正方向真的能产生"缺文件即报错"的机制保证 |

### 13.6 P2 retry 2 修订对照表（N-1~N-5 + E-1/E-2）

> 本轮**只**处理 `P2-review-design.md` 新引入的 N-1~N-5 与 `P2-review-eng.md` 的两项一行级建议 E-1/E-2。**B-1~B-4 / D-1~D-5 / 2 项裁决 / 方案骨架全部未动**（见 §13.7 自查）。

| # | 缺口（评审原文要点） | 本版落点 | 状态 |
|---|---|---|---|
| **N-1** | `teams.find(t => t.id === teamId)` 与 `team = { id, slug, name }`——`Team`/`TeamRef`/`TeamSummary` 均**无 id**，`tsc` 报错且 BDD-18 无派生路径 | §3.5 `visibility-options.ts` 签名改 `{isPublic, currentTeamSlug, teams, teamsFailed?}`，`TeamOption = Team` 显式声明无 id，子菜单 `teams.filter(t => t.slug !== currentTeamSlug)`；派生式写死 `currentTeamSlug = entry.team?.slug ?? null`（`Entry.team` 由 `api/client.ts:130` 填充）；§3.5 `applyPatch` 表 `team` 行改 `{ slug, name }` + 澄清乐观更新**不得伪造 `teamId`**；§1.1 D1 同步 | ✅ |
| **N-2** | `variant="sheet"` 切换主体未定义（无 `useMediaQuery`、Explore 无 `isMobile`、prop 链不含 `variant`） | §3.5 新增「`variant` 的切换主体」节：**选定 ② 视图层下发并写死接线**（既有 `useResponsiveLayout()`，卡/列表 `isMobile ? 'sheet' : 'icon'`，header/meta-bar `isMobile ? 'sheet' : 'inline'`），附否决 ①/③ 的理由 + Explore 侧 sheet 也需 `Teleport` 的裁剪面证据；§3.7 prop 链补 `variant`/`teamsFailed` + 取值来源表；§7.1 新增 S4（sheet 交互细节债务） | ✅ |
| **N-3** | 评审称 VC-4 44px 与 §5:732 写死 28×28 矛盾 | **评审此条不成立**（上一版 `:747-749` 已显式拆分 VC-4 范围）。本轮仅**加固可读性**：§5 组件一致性节的单行尺寸说明扩为 **4 行「新 vs 既有」标注表**（行 1 = 新按钮移动端 44×44『VC-4 断言』；行 2/3 = 新按钮桌面/行内『沿用既有尺寸，VC-4 不断言』；行 4 = **既有 28×28『本任务不改』**），附写死的 `.visibility-toggle { min-height/min-width: 44px }` CSS 块并禁止写到 `.card-action-btn`/`.action-btn`；VC-4 行与口径块改为按表行号引用。**既有 28px 未改** | ✅ |
| **N-4** | `inline`/`icon` 变体的可见文案与全部触发按钮的 `aria-label` 未定义 | §3.5 新增「可见文案与 `aria-label`」三子表：①`variant × 三态` 可见文案（`inline` **逐字沿用现状** `Public`/`Private`/`仅团队可见 · {name}`；`icon` 无可见文字仅 14/16px Lucide；`sheet` 浮层标题 `可见性`）②所有变体 `aria-label="Visibility: {statusLabel}"`（引 `OverflowMenu.vue:14` 先例，英文与 `EntryDetailHeader.vue:22/27/30/43/46` 惯例一致）③菜单项状态名（非动作名）+ testid 对照 ④自查补 `Team` 子菜单项 `aria-haspopup`/`aria-expanded` + `sheet` 关闭按钮 `aria-label="Close"`；§3.5 行为约定、§1.1 D8、§3.8 表同步 | ✅ |
| **N-5** | §6.4#5 行号 `:75` 实为 `:111-112`，影响 3 条断言而非 1 条 | §6.4#5 行号改 **`:111-112`**（`statusTagText()` 助手），写明受影响的是 **3 条**断言（`:135` team / `:143` private / `:148` public），"改助手即一并覆盖三条"；另补"不能沿用 `.status-tag` 类名定位"的理由（`EntryDetailHeader.vue:63-64` 的 `Archived`/`Expired` 同带该类） | ✅ |
| **E-1** | `P5_e2e_legacy_timeout_seconds: 600` 与本设计 `:1000` 的"外层必须**大于**内层 600s"等值不满足 | §9 由 `agate-md-field-set-gate-commands.py` 重写块，`P5_e2e_legacy_timeout_seconds` 改 **900**；声明要点改写为"同理且必须等值——等值不满足规则，声明不能自相矛盾" | ✅ |
| **E-2** | store 与视图层双发同一 warning toast | **裁定：toast 只由视图层发**。§3.5 `setVisibility` 返回 `SetVisibilityResult = { ok, revokedShares }`、内部**删除** `toast.show`；新增三条归属理由 + P4 硬约束（store 内不得出现 `toast.show`/`useToast`）；§1.1 D9、§5 success 项、§6.2 `entry-list-visibility.spec.ts` 行、§13.1 B-4 行同步 | ✅ |

### 13.7 「必须保持不变的部分」自查（逐条核验未被破坏）

| 保持项 | 核验 |
|---|---|
| B-1（`P5_e2e` 写死文件名 + `P5_e2e_legacy` 独立 key） | ✅ §9 块回读：`P5_e2e` 仍为 `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`，`P5_e2e_legacy` 仍独立存在 |
| B-2（`P5_e2e_timeout_seconds: 900`） | ✅ §9 仍 900，未动 |
| B-3（`--tb=short` + `P3_formatter: pytest.sh` + 去 `tail`）与 `:993-995` / V10 的机制表述 | ✅ §9 `P3` 命令逐字符未变；V10 五格表与"去 tail 的理由是避免 A 类假红、不是假绿"的表述**未改一字** |
| B-4（`setVisibility` 的 `revokedShares` 分支） | ✅ warning 语义保留，仅按 E-2 把发出点移到视图层（§13.1 已注记） |
| D-1~D-5（props/emits/内部状态表；无 `visibility-confirm` testid；sheet variant；VC-4 拆分） | ✅ 三张表原样；§3.5 仍明写"不设 `visibility-confirm` testid"；`variant` 三值未变；VC-4 仍 44 且范围拆分仍在 |
| 裁决 1（overflow 移除且 `t052...test.ts:100` 不列入待改） | ✅ §6.4#9 未动，`:831-836` 范围裁定块原样 |
| 裁决 2（`visibility-toggle` 沿用且 `visibility-menu-trigger` 已删） | ✅ §3.8 表仍只有 `visibility-toggle` 一行 |
| 方案骨架（A2 / B1 / C2 权衡与选择、数据流、状态机 5 转换、16/34 口径） | ✅ §2.1/§2.2/§2.3 未动；内部状态仍 5 项；§1.3 R6 与 §12#2 的 16/34 口径未动 |
| `## UI 设计` **裸标题**、§5 两节「维度不适用」、BDD-30 对 `OverflowMenu.vue` 对标 | ✅ `:769` 仍为裸标题无编号；渲染正确性/动效时序两节仍在；§3.5 a11y 行仍逐条对标 `close()` 模式 |
| frontmatter 全部字段 | ✅ 回读 `:1-36`：`candidate_count: 7` / `packages` / `domains` / `ui_affected: true` / `ui_design_section: true` / `dispatch_plan`（5 批）全部原样 |
