---
phase: P1
task_id: TPV0102
parent: P0-brief.md
trace_id: TPV0102-P1-20261110
agent: analyst
status: draft
created: '2026-11-10'
risk_level: medium
phases:
- P1
- P2
- P3
- P4
- P5
- P6
- P7
- P8
packages:
- peekview
- frontend-v3
- docs
domains:
- backend
- frontend
- api
- cli
ceremony: standard
ui_render_shape: layout
ui_ux_dimensions:
- 布局结构
- 交互行为
- 视觉呈现
prod_touched: false
---
# P1 需求基线 — Explore 列表体验修正（时间显示 / 文件数 / 可见性下拉 / 空态）

[NO_NEED_CONFIRM]

> **人工体验路径验收**：见 BDD-26（Given 按文档 seed 数据 → Explore 页有内容且时间/文件数按新规则渲染）。本任务产出用户可见页面且页面内容受 seed 数据影响，按 P1 卡强制节追加该 BDD，不以 fixture / 单测断言替代。
>
> **UX 类别 BDD**：`ui_render_shape: layout`（布局型），`ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`。UX 类别写入 BDD 标题后缀（BDD-01/02/03/13/16/19/25/27/28/29/30）。
>
> **P0 时效性**：已核对，命中**轻微漂移** 3 处（均为客观事实校正，不推翻任何决策），见第 7 节。
>
> **本文件不含 PASS/FAIL 预判**——判定结果属 P6。

---

## 1. 需求复述

Explore 页卡片模式与列表模式的四项用户体验缺陷，四项均为用户可见改动：

1. **时间显示**：现状主显相对时间（`3h ago`），悬停才给绝对时间，且绝对时间用裸 `toLocaleString()`（跟随浏览器 locale，**不带时区标识**）。用户看不出"这是哪个时区的时间"。改为：**主显绝对时间（含 `GMT±N` 偏移标识）**，悬停给「相对时间 · 绝对时间（含完整偏移 + IANA 时区名）」。时区基准由用户选定为**浏览器时区**，不做服务端时区配置；locale 仍跟随浏览器（不强制某种格式），但断言墙上时间字面量的验收须固定 locale（见 I-24）。
2. **文件数按语义显隐**：现状 `fileCount` 非 0 即渲染 `N file(s)`，导致 `1 file` 这种零信息量文本满屏。改为：`0` 与 `1` 不渲染，仅 `2+` 渲染 `N files`。
3. **可见性入口从单按钮改为下拉菜单**：现状 `Make Public` / `Make Private` 单按钮**无法表达团队可见性**——团队内容时卡片被替换成空占位 `span`、列表模式连占位都没有、详情页只有只读标签无任何编辑入口。改为下拉菜单，直接并列 `Public` / `Private` / `Team ▸ 子菜单`，抽取共享组件三处复用。
4. **0 文件 entry 的详情页空态**：后端允许创建无文件 entry（`CreateEntryRequest.files` 默认空数组；`api/entries.py:563` 注释明写 "empty zip when the entry has no files"），但前端对 0 文件 entry 落到与「多文件但未选中」相同的 `Select a file to view` 分支，用户无法区分"这个 entry 根本没有文件"与"我没选文件"。

**语义澄清（P1 补充，非方案设计）**：第 3 项的动作语义是**切换可见性状态**，不是"移动到团队"。三态模型为 `{is_public, team_id}` 的笛卡尔子集：`Public = (true, null)`、`Private = (false, null)`、`Team X = (false, X)`。因此"Team A → Public"必须同时清空团队并把公开位打开，否则后端会停在 private。

**明确排除（不写进任何 BDD）**：

| 项 | 去向 |
|---|---|
| 主文件语义（README 优先 / `is_primary` 字段 / MCP `primary_path`） | roadmap #57 |
| `/{slug}/f` 多文件无法指定展示文件 | roadmap #58 |

理由（P0 已定）：前者动 schema 与 MCP 契约，后者动**已发布的公开 URL 契约**，均需独立兼容性评估。本任务不得顺手修改这两处行为。

---

## 2. 隐含需求识别

逐维度过一遍。每条的"为什么必须"写明不做的后果。

### 2.1 数据 / 序列化（时间项的真正主战场）

| # | 隐含需求 | 为什么必须 |
|---|---|---|
| I-1 | **响应层必须显式声明时区（补 `Z`）** | DB 存 naive UTC（25 个列均 `DateTime(timezone=False)`，实测 SQLite 下 `timezone=True/False` 行为完全一致 → 改列无效）。前端 `new Date("2026-11-10T09:43:00")` 按**本地时间**解析——实测在 `Asia/Shanghai` 下与带 `Z` 的正确瞬间相差 **-8 小时**。现状因显示相对时间未暴露，**改成绝对时间会立刻暴露**。 |
| I-2 | **序列化契约只能落在叶响应模型** | `Entry` 继承 `EntryBase`，`EntryBase` 含 3 个 datetime 字段。改 `EntryBase` 会污染表模型（`Entry.model_dump()` 变成字符串、列类型语义错乱）。 |
| I-3 | **覆盖必须完整（15 个叶响应模型 / 31 个 datetime 字段）** | 部分字段带 `Z`、部分不带 → 前端字符串排序与相对计算错序，且属**静默错误**（无异常、无日志）。 |
| I-4 | **`when_used='json'` 必须显式声明** | `field_serializer` 默认 `when_used='always'`，会让 `model_dump()`（python 模式）也返回字符串，破坏所有按 datetime 消费的服务层代码。 |
| I-5 | **`client.py` 的 `fromisoformat` 必须兼容 `Z`** | `requires-python = ">=3.10"`，CPython 3.10 的 `fromisoformat` **不接受 `Z`**（3.11+ 才支持；本机 3.12 实测可用）。补 `Z` 后不修则**打断 CLI remote 模式**——这是本任务自引入的破坏性变更，必须同任务修复。 |
| I-6 | **CLI 输出时区标记与 API 语义一致** | `cli.py` 与 `admin_service.py` 共 10 处 `.isoformat()` 输出无时区标记（Python 的 `isoformat()` 用 `+00:00`，不用 `Z`）。API 补 `Z` 而 CLI 不变 → 同一系统的两种输出形态不一致，`--json` 消费方需写两套解析。 |

### 2.2 前端（显示与交互）

| # | 隐含需求 | 为什么必须 |
|---|---|---|
| I-7 | **时间渲染点有三处，不是两处** | `EntryCard.vue:43`、`EntryListRow.vue:19`、**`EntryDetailHeader.vue:62`**（详情页同形态 `<span :title="fullTime">{{ relativeTime }}</span>`）。只改卡片/列表 → 同一 entry 在列表页与详情页显示规则不一致。 |
| I-8 | **移动端详情页还有第四处时间渲染** | `EntryMetaTagsBar.vue:4` 渲染 `{{ relativeTime }}`（无 title）。移动端只有这一处元信息条，改规则后必须同规则，否则移动端仍是相对时间。 |
| I-9 | **`formatRelativeTime` 的两个边界缺陷需一并修** | 实测：无效日期 → `"NaNm ago"`；未来时间 → `"just now"`。改版后相对时间只藏在 tooltip 里，但**仍然可被用户看到**（悬停），输出 `NaNm ago` 属可见缺陷。 |
| I-10 | **`toLocaleString` 的 `dateStyle`/`timeStyle` 与 `timeZoneName` 不能共存** | 实测抛 `TypeError: Invalid option : option`。必须逐字段写 `year/month/day/hour/minute/second`。 |
| I-11 | **时区标识不能用 `short`，且不可字符串拼接** | 实测 `America/New_York` → `EST`（也可能是澳洲东部）、`Europe/London` → `GMT`、`CST` 有四种含义 → 必须用 `shortOffset`/`longOffset`。且 `zh-CN` 下时区名位于**时间之前**（实测 `2026/11/10 GMT+8 17:43:00`）→ 只能整体交给 `toLocaleString`，禁止拼接。 |
| I-12 | **团队列表只拉一次，不能每张卡片各拉一次** | 可见性菜单的 Team 子菜单需要团队列表。若每个 `EntryCard`/`EntryListRow` 各自调用 `listTeams()`，一页 20 条 → 20 个重复请求。`teamStore.allTeams` 是 `computed`，但 `loadMyTeams()` 目前只在 `EntryListView`（`ensureMyTeamsLoaded`）与 `TeamsView` 调用，详情页无调用 → 详情页需单独保证已加载。 |
| I-13 | **`teamStore.allTeams` 的加载时机覆盖详情页** | 详情页（`EntryDetailView`）当前不调用 `loadMyTeams()`。若不补，详情页菜单的 Team 项会因 `allTeams` 为空而整体不渲染——用户会以为"没有团队"。 |
| I-14 | **store 层的 `toggleVisibility` 现有守卫必须被替代而非叠加** | `entryList.ts:45` 对 `entry.teamId` 直接拒绝（返回 false + warning toast）。新菜单要求团队 entry **也能切换**，旧守卫与之直接矛盾；`entryDetail.ts:101` 的 `syncVisibility(slug, isPublic)` 只同步 `isPublic`，无 team 维度 → 切换后详情页状态会残留。 |
| I-15 | **详情页 `EntryDetailHeader` 目前无任何编辑入口** | 只有只读 `status-tag`。新增菜单会改变详情页头部交互密度 → 需视觉确认（P0 已知风险已登记）。 |
| I-24 | **显示跟随浏览器 locale，但验收必须固定 locale** | 时间文本的墙上时间格式**随 locale 变**（实测同一时刻 `Asia/Shanghai`：`zh-CN` → `2026/11/10 GMT+8 17:43:00`、`en-US` → `11/10/2026, 05:43:00 PM GMT+8`、`ja-JP` → `2026/11/10 17時43分00秒 GMT+8`）。**需求侧**：显示仍跟随浏览器 locale，不引入服务端 locale 配置、不强制某种格式（用户已选定"靠浏览器"）。**验收侧**：凡断言墙上时间字面量的 BDD 必须在 Given 显式固定 locale（否则 CI 默认 `en-US` 下实现正确也会假 FAIL）。两者不矛盾——前者是产品语义，后者是判定手段，本文件 BDD-04 已按此固定 `zh-CN`。 |

### 2.3 多端

| # | 隐含需求 | 为什么必须 |
|---|---|---|
| I-16 | **MCP 侧时间消费无需改代码，但需验证** | `packages/mcp-server/src/tools/createEntry.ts:121`、`publishFiles.ts:551` 用 `new Date(entry.expires_at)`。补 `Z` 后由"错 8 小时"变为正确，**代码不变**。但若不验证，无法排除"补 Z 后 MCP 输出反而变化"（如 ISO 字符串直接透传）。 |
| I-17 | **API 无端点/契约变更** | `frontend-v3/src/api/client.ts:203` 的 `updateEntry` 已支持 `is_public` 与 `team_id` 两字段，后端 `PATCH /entries/{slug}` 已支持。故本次是**纯表示层 + 前端交互**改动，不新增端点。 |
| I-18 | **CHANGELOG + 升级说明** | 时间字段多 `Z` 属**对外可见的响应格式变更**（破坏性变更，影响第三方 `--json` / 直接消费 API 的脚本）。 |

### 2.4 边界 / 兼容

| # | 隐含需求 | 为什么必须 |
|---|---|---|
| I-19 | **0 文件 entry 的验收素材必须现造** | 实测 `scripts/seed-data/image-gallery/` 虽只有 `meta.json`（0 内容文件），但 `scripts/seed-debug.py:184` 对 `if not files: SKIP` → **该 entry 根本不会入库**。故 0 文件场景**没有现成 seed**，P3/P6 必须走 debug backend HTTP API（`POST /api/v1/entries` 传空 `files`）现造，**禁止用 `peekview create` CLI**（可能写生产 DB）。 |
| I-20 | **0 文件空态与「多文件未选中」空态必须可区分** | 两者当前落到同一分支（`EntryDetailContent.vue:59-61`）。若只加文案不改判定条件，会误伤多文件场景（`loadEntry` 在 `files.length > 0` 时总会选中第一个文件，故"多文件未选中"实际只在极端情况下出现，但语义仍须区分）。 |
| I-21 | **`archive_delete_at` 类倒计时数值会因补 `Z` 而变** | `CountdownInfo.archive_delete_at` 补 `Z` 后前端算出的剩余时间会变化（现状按本地时间解析 → 偏差 8h）。P6 需 before/after 对比，不能当成回归。 |
| I-22 | **E2E 断言不得硬编码 `GMT+8`** | CI runner 时区可能不同。断言必须用形态匹配（`GMT±N`）或显式固定 `TZ`。 |
| I-23 | **TPV0095 的「团队 entry 无 visibility-toggle」断言需随基线更新** | `frontend-v3/e2e/team-visibility.spec.ts:137-152`（BDD-40）与 4 个单测文件（`tpv0095-entry-card-team.spec.ts` / `tpv0095-entry-list-row-team.spec.ts` / `tpv0095-entry-list-store-team.spec.ts` / `tpv0095-detail-visibility-tag.spec.ts`）断言团队 entry **不存在**可见性入口。本任务要求团队 entry **有**菜单（这是 P0 决策 3 的核心动机）→ 该断言被**有意取代**。必须显式登记，不能让它变红后当成"测试要修"草率删除。 |

### 2.5 同类扫描（强制节）

见第 6 节完整表。

---

## 3. BDD 验收条件

共 **30 条**（BDD-01 ~ BDD-30，编号连续）。每条为独立可二值判定（PASS / FAIL）的行为单元。判据**不绑定** CSS 类名 / HTML 属性名 / 组件名 / 具体 API 调用名；UX 类别写入标题后缀。

### 3.1 时间显示（前端）

#### BDD-01: 布局结构：卡片与列表的时间主显为绝对时间且含 GMT±N 偏移标识
- Given 任意一个 entry，其 `created_at` 为已知 UTC 时刻
- When 在 Explore 页分别以卡片模式与列表模式查看该 entry
- Then 两种模式下该 entry 的时间文本均匹配「含 `GMT+数字` 或 `GMT-数字` 子串、且含 4 位年份」的形态，且**不**匹配 `ago` / `just now` 形态

#### BDD-02: 交互行为：悬停时间同时显示相对时间与绝对时间
- Given 任意一个 entry 的列表卡片，且浏览器 locale 为 `en-US`（Playwright 默认值，本 BDD 不限定时区）
- When 鼠标悬停在该 entry 的时间文本上
- Then 出现的提示文本同时包含：①相对时间（匹配 `just now` / `Nm ago` / `Nh ago` / `Nd ago` / `Nw ago` / `Nmo ago` / `Ny ago` 之一）②绝对时间（含 `GMT+HH:MM` 或 `GMT-HH:MM` 完整偏移）③一个 IANA 时区名字符串，其值等于该浏览器运行时 `Intl.DateTimeFormat().resolvedOptions().timeZone` 的返回值（在 UTC 时区下该值为 `UTC`，同样成立）

> **判据③为何这样写（P1 修订说明）**：原判据为「形如 `Area/City`」，实测 `TZ=UTC` 时 `Intl.DateTimeFormat().resolvedOptions().timeZone` 返回 `"UTC"`（**不含 `/`**），CI runner 默认 UTC → 该判据必然假 FAIL。改为「等于运行时解析值」后，UTC 与 `Asia/Shanghai` 两种环境均可二值判定，且仍精确锁定「提示里必须出现浏览器实际时区名」这一真实语义。**不**为过测试而放宽对 tooltip 内容的要求。

#### BDD-03: 视觉呈现：详情页头部与移动端元信息条的时间规则与列表一致
- Given 同一个 entry 同时在 Explore 列表与详情页可见
- When 对比列表卡片、详情页桌面头部、详情页移动端元信息条三处的时间文本
- Then 三处主显文本均为绝对时间且含 `GMT±N` 偏移标识，三处悬停提示均同时含相对时间与绝对时间

#### BDD-04: 布局结构：已知 UTC 时刻在 Asia/Shanghai 时区下显示为 +8 小时
- Given 一个 `created_at` 为 `2026-11-10T09:43:00Z` 的 entry，浏览器时区固定为 `Asia/Shanghai`，浏览器 locale 固定为 `zh-CN`
- When 打开 Explore 页查看该 entry 的时间文本
- Then 该时间文本包含 `17:43:00`（UTC+8 后的墙上时间）且包含 `GMT+8`；**不**包含 `09:43:00`

> **判据为何固定 locale（P1 修订说明）**：原判据未固定 locale，而 `toLocaleString` 的墙上时间格式**随 locale 变**——实测对同一时刻（`Asia/Shanghai` + `shortOffset`）：`zh-CN` → `2026/11/10 GMT+8 17:43:00`（含 `17:43:00`）；**`en-US` → `11/10/2026, 05:43:00 PM GMT+8`（12 小时制，不含 `17:43:00`）**；`ja-JP` → `2026/11/10 17時43分00秒 GMT+8`（不含 `17:43:00`）。项目 `frontend-v3/playwright.config.ts` 的 `use` 块**未设 `locale`** → Playwright 默认 `en-US` → 不固定 locale 则实现正确也会假 FAIL。故按 `capability_requirements` 的 `locale-controlled-execution` 条目在 Given 显式固定 locale。
>
> **为何不采用「用 `new Date(文本)` 反解绝对时刻」的替代判据**：实测该路径**不可靠**——同一批本地化文本喂给 `new Date()`：`zh-CN` 与 `en-US` 得到正确的 `2026-11-10T09:43:00Z`，但 `ja-JP`（`2026/11/10 17時43分00秒 GMT+8`）得到 **`NaN`**，`de-DE`（`10.11.2026, 17:43:00 GMT+8`）被解析成 **`2026-10-11T09:43:00Z`（错月份/错日期）**。用一条本身不可靠的解析作判据会把假 PASS 风险引入验收，故放弃该替代方向。

#### BDD-05: 交互行为：无效时间值不产生 NaN 文本
- Given 一个 `created_at` 为无法解析的字符串的 entry（测试构造）
- When 渲染其卡片时间与悬停提示
- Then 任何位置的时间文本均**不**包含子串 `NaN`

#### BDD-06: 交互行为：未来时间的相对时间描述方向正确
- Given 一个 `created_at` 比当前时间晚 24 小时的 entry
- When 查看其悬停提示中的相对时间部分
- Then 该部分**不**显示为 `just now`（过去时态文案），且**不**包含 `NaN`

### 3.2 序列化契约（后端）

#### BDD-07: 布局结构：所有叶响应模型的 datetime 字段在 JSON 输出中均以 Z 结尾
- Given 后端服务运行中
- When 遍历 `backend/peekview/models.py` 中**所有非 `table=True` 且不被任何 `table=True` 模型继承的类**（不硬编码模型名单），对每个类调用其对应端点，检查响应 JSON 中每一个非 null 的 datetime 字段值
- Then 每个值均以字符 `Z` 结尾，且**无任何一个**以无时区后缀（形如 `...:00`）结尾

> **判据为何用遍历而非点名（P1 修订说明）**：原 When 逐个点名 15 个模型，与 §6.10「机械清单式、新模型自动纳入、不靠人工维护清单」的拦截声明自相矛盾——照字面实现，未来新增的第 16 个叶模型不会被抓。改为遍历后判据与 §6.10 一致。
>
> **遍历条件「不被任何 `table=True` 模型继承」的必要性**：AST 实测 `models.py` 中「非 `table=True` 且含 datetime 字段」的类共 **17 个**，其中 `EntryBase`（3 字段，`:82`）与 `UserBase`（1 字段，`:116`）分别被表模型 `Entry` / `User` 继承——它们**必须排除**（I-2）。加上该排除条件后命中 **15 个类 / 31 个字段**，与 §6.9 附录清单逐项吻合。故遍历条件必须含"非 table 且不被 table 模型继承"两个合取项，缺后者会误抓 `EntryBase`/`UserBase`。
>
> **当前基线清单（附录，非判据主体；随模型增删由遍历自动更新）**：`ReadStatsResponse`(1) / `ReadEventResponse`(2) / `CountdownInfo`(1) / `StarResponse`(1) / `TombstoneResponse`(1) / `StarItem`(3) / `EntryResponse`(4) / `EntryListItem`(4) / `EntryRawResponse`(1) / `CreateEntryResponse`(2) / `UserResponse`(2) / `ApiKeyResponse`(3) / `ApiKeyCreateResponse`(2) / `EntryStats`(1) / `ShareResponse`(3) = **15 类 / 31 字段**（行号与字段明细见 §6.9）。`ShareCreateResponse` 继承 `ShareResponse`，经继承即得覆盖。

#### BDD-08: 布局结构：数据库表模型的时间字段在非 JSON 序列化下不被响应层污染
- Given Python 侧已加载一条 `Entry` 表记录
- When 以非 JSON 模式（python 模式）序列化该记录
- Then 其 `created_at` / `updated_at` / `expires_at` / `archived_at` / `archive_delete_at` 的值仍为 `datetime` 对象（**不是** `str`），且转成字符串后**不**以 `Z` 结尾

#### BDD-09: 布局结构：叶响应模型的时间字段在非 JSON 序列化下仍为 datetime 对象
- Given 一个 `EntryResponse` 响应对象
- When 以非 JSON 模式（python 模式）序列化该对象
- Then `created_at` / `updated_at` 等时间字段仍为 `datetime` 对象，**不是** `str`

#### BDD-10: 交互行为：CLI remote 模式能解析带 Z 的 API 时间字符串
- Given 服务端返回的时间字符串以 `Z` 结尾
- When 用 CLI 以 remote 模式从服务端读取 entry
- Then 读取成功、无解析异常，且得到的时间值为 timezone-aware 且 UTC 偏移为 0

#### BDD-11: 视觉呈现：CLI `--json` 输出的时间字段带时区标记
- Given 用 CLI 以 `--json` 输出 entry 列表或创建结果
- When 检查输出 JSON 中的时间字段字符串
- Then 每个非 null 的时间值均带显式时区标记（以 `Z` 结尾或以 `+00:00` 结尾），**不**出现无时区后缀的值

#### BDD-12: 布局结构：存量数据 UTC 语义一次性审计无异常行
- Given debug 数据库中全部 entry 行
- When 执行"`created_at` 晚于数据库当前 UTC 时间"的行计数（排除 `expires_at` / `archive_delete_at` 这类天然未来列）
- Then 计数结果为 0

### 3.3 文件数显隐（前端）

#### BDD-13: 视觉呈现：1 个文件的 entry 在卡片与列表均不显示文件数
- Given 一个 `file_count` 为 1 的 entry
- When 在 Explore 页以卡片模式与列表模式查看
- Then 该 entry 的元信息区**不**出现匹配 `1 file` 的文本（含 `1 files`）

#### BDD-14: 视觉呈现：0 个文件的 entry 在卡片与列表均不显示文件数
- Given 一个 `file_count` 为 0 的 entry
- When 在 Explore 页以卡片模式与列表模式查看
- Then 该 entry 的元信息区**不**出现任何匹配 `\d+ files?` 的文本

#### BDD-15: 视觉呈现：3 个文件的 entry 在卡片与列表均显示 "3 files"
- Given 一个 `file_count` 为 3 的 entry
- When 在 Explore 页以卡片模式与列表模式查看
- Then 两种模式下该 entry 的元信息区均出现文本 `3 files`

### 3.4 可见性下拉菜单（前端 + 权限边界）

#### BDD-16: 交互行为：菜单不包含当前可见性状态项
- Given 一个属于当前用户、当前为 Public（`is_public=true`、无团队）的 entry
- When 打开该 entry 的可见性菜单
- Then 菜单项中**不**包含 `Public` 项，且包含 `Private` 项与 `Team` 入口

#### BDD-17: 交互行为：用户无任何团队时菜单不渲染 Team 入口
- Given 一个属于当前用户、但当前用户不属于任何团队的 entry
- When 打开该 entry 的可见性菜单
- Then 菜单中**不**出现 `Team` 入口

#### BDD-18: 交互行为：Team 一律以子菜单呈现且子菜单排除当前团队
- Given 一个属于当前用户、当前归属 Team A 的 entry，且该用户同时属于 Team A 与 Team B
- When 打开该 entry 的可见性菜单并展开 Team 子菜单
- Then 子菜单中**不**包含 Team A、包含 Team B，且 Team 入口本身不直接执行切换（须经子菜单选择）

#### BDD-19: 交互行为：升为 Public 需二次确认，确认后 entry 变 public 且团队清空
- Given 一个当前归属 Team A 的本人 entry
- When 在可见性菜单选择 `Public`
- Then 在用户确认之前不发出修改请求；用户确认后，该 entry 的可见性状态变为 `is_public=true` 且 `team` 为空

#### BDD-20: 交互行为：降级可见性不弹二次确认
- Given 一个当前为 Public 的本人 entry
- When 在可见性菜单选择 `Private`
- Then 不出现确认对话框，且该 entry 的可见性状态变为 `is_public=false`

#### BDD-21: 交互行为：切换失败时状态保持原值并提示失败
- Given 一个本人 entry，其可见性切换请求被服务端拒绝（测试构造非 2xx）
- When 在可见性菜单选择另一个可见性状态
- Then 该 entry 的可见性状态与操作前完全一致，且出现失败提示

#### BDD-22: 交互行为：非 owner 用户看不到可见性菜单
- Given 一个属于其他用户的 entry（当前用户非 owner）
- When 在卡片、列表、详情页三处查看该 entry
- Then 三处均**不**出现可见性菜单入口

#### BDD-23: 交互行为：详情页提供可见性菜单入口
- Given 一个属于当前用户的 entry
- When 打开该 entry 的详情页
- Then 详情页头部（桌面视口）与详情页元信息条（移动视口）均出现可见性菜单入口

#### BDD-24: 交互行为：切换请求进行中菜单不可重复触发
- Given 一个本人 entry，其可见性切换请求处于未完成状态
- When 在请求返回前再次尝试点击菜单项
- Then 不发出第二个修改请求

### 3.5 0 文件空态（前端）

#### BDD-25: 视觉呈现：0 文件 entry 的详情页显示专用空态提示且与未选中文件提示可区分
- Given 一个 `files` 为空数组的 entry
- When 打开该 entry 的详情页
- Then 正文区出现"该 entry 无文件"语义的空态提示，且该提示文本**不**等于多文件未选中时的提示文本

### 3.6 人工体验路径

#### BDD-26: 交互行为：按文档 seed 数据后 Explore 页有内容且时间与文件数按新规则渲染
- Given 按项目文档执行 `make debug`（或 `make debug-start` + `make debug-seed`）灌入 `scripts/seed-data/` 数据，并用 seed 用户登录 debug 站点（`127.0.0.1:8888`）
- When 人工打开 Explore 页并以卡片模式浏览
- Then ①页面渲染出多于 1 个 entry 卡片（非空列表）②每张卡片的时间文本含 `GMT±N` 偏移标识且不含 `ago` ③`unicode-filenames`（8 文件）与 `multi-format-demo`（4 文件）卡片显示 `N files`，`yaml-docker-compose`（1 文件）等单文件卡片不显示文件数

### 3.7 可见性转换结果（前端 + 权限边界，承接决策 3 的 5 个转换）

#### BDD-27: 交互行为：Private entry 选 Team A 后归属 Team A 且保持非公开
- Given 一个属于当前用户、当前为 Private（`is_public=false`、无团队）的 entry，且当前用户属于 Team A
- When 在可见性菜单展开 Team 子菜单并选择 Team A
- Then 该 entry 的可见性状态变为 `is_public=false` 且 `team` 为 Team A（两字段均须断言）

#### BDD-28: 交互行为：Team A entry 选 Team B 后归属改为 Team B 且保持非公开
- Given 一个属于当前用户、当前归属 Team A 的 entry，且当前用户同时属于 Team A 与 Team B
- When 在可见性菜单展开 Team 子菜单并选择 Team B
- Then 该 entry 的可见性状态变为 `is_public=false` 且 `team` 为 Team B（`team` 不再是 Team A），且未出现确认对话框

#### BDD-29: 交互行为：Team A entry 选 Private 后团队清空且保持非公开
- Given 一个属于当前用户、当前归属 Team A 的 entry
- When 在可见性菜单选择 `Private`
- Then 该 entry 的可见性状态变为 `is_public=false` 且 `team` 为空（两字段均须断言），且未出现确认对话框

> **BDD-27/28/29 的由来（P1 修订说明）**：P0 决策 3（`P0-brief.md:159-163`）给出 5 个可见性转换，原基线仅覆盖 2 个（Public→Private 见 BDD-20、Team A→Public 见 BDD-19）。决策 3 的立项理由原文即「现状单按钮**无法表达团队可见性**」——「Private → Team A」（BDD-27）正是本次头号新能力，缺它则 P3 无从写红灯、P6 无从判 PASS/FAIL。补 BDD-27/28/29 后 5 个转换**全部**有验收条件。
>
> **BDD-29 的判据为何强调两字段**：后端对 `team_id: null` 的语义是「只清团队，**不改** `is_public`」（`entry_service.py:809-818`），故 Team A → Private 后必须停在 `is_public=false`。只断言"团队没了"会漏掉"是否被误置为 public"这一真实风险。

### 3.8 可访问性（前端）

#### BDD-30: 交互行为：可见性菜单可被键盘关闭且焦点回到触发入口
- Given 一个属于当前用户的 entry，其可见性菜单处于打开状态且焦点位于菜单内
- When 按下 `Escape` 键
- Then 菜单关闭（菜单项不再可见），且当前焦点回到打开该菜单的触发入口元素

> **为何补此条（P1 修订说明）**：新增的可见性菜单是复合交互控件（触发按钮 + 菜单 + 子菜单 + 二次确认弹窗），是典型的键盘/读屏可达面，而原基线全文 a11y 覆盖为 0。项目已有明确先例可循：`OverflowMenu.vue:140-155`（`Escape` 关闭，且 `close()` 内执行 `triggerRef.value?.focus()` 使焦点回归触发按钮）、`ConfirmDialog.vue:6-9`（`role="alertdialog"` + `aria-labelledby`/`aria-describedby`）、`DataTreeNode.vue:7-8`（`aria-expanded`/`aria-label`）、`EntryCard.vue:86`（`role="alertdialog"`）。故本任务**不裁**该项，按既有惯例实现。
>
> **判据为何不绑属性名**：Then 只断言用户可观测的两个结果（菜单关闭 + 焦点回到触发入口），不绑定 `aria-expanded` / `role="menu"` 等具体属性名，避免把实现细节写进验收条件。

---

## 4. 待确认清单

[NO_NEED_CONFIRM] — 无阻塞项。

倾向项（不阻塞，主 Agent 可直接采纳）：

[SUGGEST: 推荐 CLI `--json` 输出统一改为带 `Z` 后缀（与 API 形态完全一致），理由：CLI 与 API 是同一系统的两个出口，形态不一致会迫使 `--json` 消费方写两套解析；改用 `Z` 而非 `+00:00` 使 CLI 输出可直接喂给前端 `new Date()` 与 MCP 的 `new Date()`。该变更属可见格式变更但非破坏性（`+00:00` 与 `Z` 均为合法 ISO 8601，任何合规解析器都能读），需在 CHANGELOG `[Unreleased]` 与升级说明中列出]

[SUGGEST: 推荐"团队列表加载"在 `EntryListView` 与 `EntryDetailView` 各触发一次 `loadMyTeams()`（已加载则跳过），由视图层下发 `allTeams` 给菜单组件，理由：P0 已定"团队列表只拉一次、由列表页父级下发"，但详情页当前不加载团队（实测 `loadMyTeams` 仅在 `EntryListView`/`TeamsView` 调用）——若不补，详情页菜单的 Team 项会整体缺失。P2 需在组件契约里明确这个 prop 链]

[SUGGEST: 推荐把 `formatRelativeTime` / `formatFullDate` 作为**唯一时间格式化入口**保留在 `composables/useRelativeTime.ts`，并把 `ApiKeySettingsTab.vue:273`、`ApiKeyListView.vue:288` 两处本地重复实现登记为技术债而非本次合并，理由：这两处服务于 API key 的 "Last used" 场景，不在本任务四项范围内；本次合并会扩大改动面并引入与本任务无关的回归风险。若评审认为应一并消除，请在 P2 明确并接受范围扩大]

[SUGGEST: 推荐 P3/P4 显式更新 TPV0095 的 BDD-40 相关断言（4 个单测文件 + 1 个 E2E spec），并在 P7 记录"TPV0095 BDD-40 被本任务有意取代"，理由：本任务的核心动机就是让团队 entry 也有可见性入口，与 TPV0095 BDD-40「团队 entry 无 visibility-toggle」直接矛盾。**不可**以"测试变红就改断言"的方式静默处理，必须有显式取代记录，否则未来无法判断这是回归还是演进]

---

## 5. 裁剪说明

`risk_level: medium`。依据：含**权限边界**（可见性三态切换 + owner 判定 + 团队归属）、**跨层契约变更**（响应序列化格式，影响前端 / CLI / MCP 三类消费方）、**三处组件复用**，且 naive-UTC 时间解析存在已量化的 8 小时偏移风险（实测 -8h）。

`phases: [P1, P2, P3, P4, P5, P6, P7, P8]` — 全部保留，无裁剪。

| 阶段 | 保留 | 理由 |
|---|---|---|
| P1 | 必留 | 不可裁（核心阶段）；含 30 条 BDD + 权限边界 + 同类扫描，须评审 |
| P2 | 必留 | 不可裁。三处复用的组件契约（prop 形态、菜单项构造、二次确认归属）是设计核心；frontend 域 → plan-design-review，backend 域（序列化契约）→ plan-eng-review |
| P3 | 保留 | 时间格式化（含两个边界缺陷）、文件数三态、菜单选项构造（三态笛卡尔子集）、序列化覆盖均有可单测行为，红灯可造 |
| P4 | 必留 | 不可裁 |
| P5 | 必留 | 不可裁。含序列化契约的全端点验证与存量 UTC 审计（一次性脚本） |
| P6 | 必留 | 不可裁。30 条 BDD 逐条实跑 + UI 截图 + before/after 倒计时对比；`ui_affected: true` → 视觉证据强制 |
| P7 | 保留 | 多文件改动 + 三处组件复用 + 跨层契约 → 一致性检查不可省 |
| P8 | 保留 | 用户可见改动 + 响应格式破坏性变更 → CHANGELOG `[Unreleased]` + bump |

**跳过风险**：无跳过阶段，本项不适用。

---

## 6. 同类扫描结论（强制节）

扫描动作：对下列关键符号 grep 全仓（`frontend-v3/src`、`frontend-v3/e2e`、`backend/peekview`、`packages/mcp-server/src`），记录命中数 + 文件清单 + 逐条判定。

### 6.1 `formatRelativeTime` / `formatFullDate` / `useRelativeTime`

| 位置 | 类型 | 判定 |
|---|---|---|
| `frontend-v3/src/composables/useRelativeTime.ts:3` `formatRelativeTime` | 定义（唯一共享实现） | **本次处理**：修 `NaNm ago` / 未来时间两处边界缺陷 |
| `frontend-v3/src/composables/useRelativeTime.ts:24` `formatFullDate` | 定义（唯一） | **本次处理**：改为带 `shortOffset`/`longOffset` 的绝对时间格式化 |
| `frontend-v3/src/composables/useRelativeTime.ts:28` `useRelativeTime` | 定义 | **本次处理**：新增悬停组合文本输出 |
| `components/settings/ApiKeySettingsTab.vue:273` | **重复实现**（本地定义） | **本次不处理**：服务于 API key "Last used"，不属四项范围；已登记 SUGGEST 技术债 |
| `views/ApiKeyListView.vue:288` | **重复实现**（本地定义） | **本次不处理**：同上 |
| `components/EntryCard.vue:173` | 消费（`useRelativeTime`） | **本次处理** |
| `components/EntryListRow.vue:171` | 消费 | **本次处理** |
| `views/EntryDetailView.vue:203` | 消费 | **本次处理** |
| `__tests__/header-layout.test.ts:68,74` | 测试（断言 `\d+d ago` 与 `toBeTruthy()`） | **本次处理**：`\d+d ago` 断言随主显改为绝对时间需更新；`formatFullDate` 断言需加强为含 `GMT±N` |
| `__tests__/t093-star-exempt.test.ts:23`、`filter-tabs.test.ts:9`、`expired-warning.test.ts:9`、`t068-account-settings.spec.ts:74`、`t067-detail-framework.spec.ts:96`、`t031-entry-detail-view.spec.ts:101` | 测试（`vi.mock` 整个 composable） | **本次不处理**：mock 形态不变（仍返回 `{relative, full}`），只要不改 composable 的对外形状即不受影响。P3 若改形状须一并评估 |

### 6.2 `toLocaleString` / `toLocaleDateString`

命中 7 处（其中 1 处 `TableView.vue:5` 为数字千分位格式化，非时间）：

| 位置 | 判定 |
|---|---|
| `composables/useRelativeTime.ts:25` | **本次处理**（核心改动点） |
| `components/PublishResultPanel.vue:56` | **本次不处理**：publish 结果面板的过期时间，不属四项范围 |
| `components/settings/ProfileTab.vue:59` | **本次不处理**：用户注册时间（`toLocaleDateString`），不属四项范围 |
| `components/settings/UserManagerTab.vue:162` | **本次不处理**：禁用时间，不属四项范围 |
| `components/settings/ApiKeySettingsTab.vue:270` | **本次不处理**：API key 过期日期 |
| `views/ApiKeyListView.vue:285` | **本次不处理**：API key 过期日期 |
| `components/TableView.vue:5` | **本次不处理**：数字千分位格式化（`maxRows.toLocaleString()`），非时间 |

> 结论：`toLocaleString` 用于**时间**的共 6 处，仅 `useRelativeTime.ts:25` 属本任务范围。其余 5 处的共同缺陷（无时区标识）是同一类问题，但服务于不同页面与不同字段——**已确认它们不构成同一问题**（用户报告的缺陷是"Explore 卡片时间看不出时区"），故不纳入；若后续要统一，应作为独立任务。

### 6.3 `fileCount`

命中 30 处（含测试 fixture）。生产代码渲染点：

| 位置 | 判定 |
|---|---|
| `components/EntryCard.vue:44,46` | **本次处理**（`v-if` 由 truthy 改为 `>= 2`） |
| `components/EntryListRow.vue:20,22` | **本次处理**（同上） |
| `components/FileTree.vue:9,32` | **本次不处理**：侧栏标题 `Files · N` 计数，语义是"当前 entry 的文件总数"，与卡片元信息不同用途；且侧栏只在多文件时出现，`1` 的情况本就不会显示计数（`isMultiFile` 门槛） |
| `components/EntryDetailContent.vue:8,93` | **本次不处理**：把 `files.length` 传给 `FileTree`，属上一条的调用侧 |
| `api/client.ts:99`（`fileCount: entry.file_count`）、`api/client.ts:296`（`fileCount: 0`） | **本次不处理**：数据映射层，字段语义不变 |
| `types/index.ts:42` | **本次不处理**：类型声明 |
| 测试 fixture（`t093-*`、`filter-tabs`、`expired-warning`、`t031-*`、`t076-*`、`EntryListRow.spec.ts`、`tpv0095-*` 等） | **本次不处理**：fixture 值本身不需改；但断言 `2 file` / `3 files` 的用例需按新规则复核（`fileCount: 2` / `3` 仍显示，`1` 需新增负向用例） |

> 结论：**"已确认只此一处"不成立**——`fileCount` 有两处渲染点（卡片 + 列表），均须改。第三处 `FileTree` 语义不同，不纳入。

### 6.4 可见性切换入口（`isPublic` / `teamId` 三态）

| 位置 | 现状 | 判定 |
|---|---|---|
| `components/EntryCard.vue:4-27` | 单按钮（`v-if="!entry.teamId"`）+ 团队时渲染**空 span** `team-visibility-hint` | **本次处理**：替换为共享菜单 |
| `components/EntryListRow.vue:93-103` | 单按钮（`v-if="!entry.teamId"`），团队时**无任何元素** | **本次处理**：替换为共享菜单 |
| `components/EntryDetailHeader.vue:66-73` | 只读 `status-tag`（`仅团队可见 · X` / `Public` / `Private`） | **本次处理**：新增菜单入口 |
| `components/EntryMetaTagsBar.vue:6-13` | 移动端只读 `status-tag`（同三态） | **本次处理**：移动端入口（BDD-23 覆盖） |
| `stores/entryList.ts:45` `toggleVisibility` | 有 `entry.teamId` 守卫 → 直接拒绝并 toast | **本次处理**：守卫须被替代（新语义允许团队 entry 切换） |
| `stores/entryDetail.ts:101` `syncVisibility(slug, isPublic)` | 只同步 `isPublic`，无 team 维度 | **本次处理**：需扩展为同步 `{isPublic, teamId, team}` |
| `stores/entry.ts:19` | 转导出 `listStore.toggleVisibility` | **本次不处理**：透传层，签名不变 |
| `composables/useEntryDetailActions.ts:47,78` | 详情页 overflow 菜单里的 visibility 项 | **本次处理**：改为打开新菜单或复用同一构造逻辑 |
| `views/EntryListView.vue:637` `handleToggleVisibility` + `:175,186` 事件绑定 | 列表页事件处理 + toast 文案 | **本次处理**：toast 文案需覆盖三态（`Made public` / `Now private` / `Shared with Team X`） |
| `api/client.ts:196` `toggleEntryVisibility` | 只发 `is_public` | **本次不处理**：保留（仍有单字段场景），新增路径走 `updateEntry` |
| `api/client.ts:203` `updateEntry` | 已支持 `is_public` + `team_id` | **本次不处理**：已具备所需能力，无需改 |
| `views/PublishView.vue:124-133` `publish-visibility-toggle` | 发布页的公开复选框（独立于列表） | **本次不处理**：发布流程不属于"Explore 列表体验"，且发布页另有团队下拉（`:154-166`）。P2 若认为应统一交互，须显式扩范围 |
| `backend/peekview/services/entry_service.py:808-818` | `team_id_set` 区分"不传"与"传 null"；非 null team 强制 `is_public=false` | **本次不处理**：后端语义正确，是前端必须遵守的约束（BDD-19 的依据） |
| `backend/peekview/services/entry_service.py:846-856` | `is_public` 分支：team 未清空时无法变 public | **本次不处理**：同上，正是"必须两字段同传"的根据 |

> 结论：可见性入口**共 4 个渲染点**（卡片 / 列表 / 详情桌面 / 详情移动），全部纳入。`PublishView` 的第 5 个入口语义不同（发布时选，非发布后切），**显式不纳入**。

### 6.5 `new Date(` 消费 API 时间字段（补 Z 后的影响面）

命中 73 处（含测试与本地时间计算）。**生产代码中消费服务端时间字段**的点：

| 位置 | 判定 |
|---|---|
| `composables/useRelativeTime.ts:4,5,25` | **本次处理**（主改动点） |
| `utils/expires.ts:2,3,14,15,24` | **本次不处理**：补 `Z` 后自动变正确（现状按本地解析 → 偏差 8h，属被修复而非回归）。P6 需 before/after 对比 |
| `components/StarToggle.vue:99,107,112` | **本次不处理**：同上（`expiresAt` 日期文案） |
| `components/EntryDetailHeader.vue:65`（`formatExpiresIn`） | **本次不处理**：同上 |
| `components/ShareDialogContent.vue:169,188,189` | **本次不处理**：share `expiresAt` 倒计时，自动受益 |
| `views/EntryDetailView.vue:186` | **本次不处理**：share 过期判定，自动受益 |
| `views/StarManageView.vue:274`（`deletedAt`） | **本次不处理**：墓碑删除日期，自动受益 |
| `components/settings/ApiKeySettingsTab.vue:266,274,275` / `views/ApiKeyListView.vue:281,289,290` | **本次不处理**：API key 时间，自动受益 |
| `components/PublishResultPanel.vue:56` | **本次不处理**：`expiresAt` 显示，自动受益 |
| `components/settings/ProfileTab.vue:59` / `UserManagerTab.vue:152,153` | **本次不处理**：用户时间，自动受益 |
| `views/LandingView.vue:217`（`new Date().getFullYear()`） | **本次不处理**：当前年份，不消费服务端时间 |
| 测试内 `new Date()`（约 30 处） | **本次不处理**：构造 fixture，不受影响 |

> 结论：补 `Z` 是**全局正确性修复**，影响面覆盖约 12 个前端文件的**既有**时间解析（全部由错变对，无代码改动）。因此 P6 必须做 before/after 对比，不能把这些数值变化当回归。

### 6.6 `isoformat()` / `fromisoformat`

| 位置 | 判定 |
|---|---|
| `cli.py:378,443,444,564,571,2287,2318`（7 处） | **本次处理**：统一 helper，输出带时区标记（BDD-11） |
| `services/admin_service.py:643,644,645`（3 处） | **本次处理**：同上 |
| `client.py:89`（`datetime.fromisoformat(v)`） | **本次处理**：兼容 `Z`（BDD-10，破坏性变更必改） |
| `services/admin_service.py:1257`（`_parse_db_datetime`） | **本次不处理**：解析备份文件里的 DB 字符串，不来自 API 响应，不会出现 `Z` |
| `services/read_tracking_service.py:248` | **本次不处理**：解析 `SELECT MAX(updated_at)` 的 SQLite 原始字符串 |
| `backend/tests/test_entry_lifecycle.py:406,581`、`test_share_create.py:114,140`、`test_share_lifecycle.py:270` | **本次不处理**：测试已自带 `.replace("Z", ...)` 处理，补 Z 后仍绿 |

> 行号漂移记录：P0 给的 `cli.py:378/443/561` → 实测为 `378/443/444/564/571`（另有 `2287/2318` 两处 P0 未列出）。已按实测更新，不构成漂移判定（属 P1 应做的清单核实）。

### 6.7 MCP 侧

| 位置 | 判定 |
|---|---|
| `packages/mcp-server/src/tools/createEntry.ts:121`（`new Date(entry.expires_at)`） | **本次不处理**：代码不变，补 `Z` 后由"错 8 小时"变正确。P6 需验证 MCP 输出未意外变化 |
| `packages/mcp-server/src/tools/publishFiles.ts:551`（同上） | **本次不处理**：同上 |

> 结论：MCP 共 2 处消费，均**无需改代码**，属"自动受益"。这是 I-16 的依据，也是 P0「多端需同步吗」维度的答案：**不需要改代码，但需要验证**。

### 6.8 后端 datetime 列（`DateTime(timezone=False)`，25 处）

**本次不处理**（全部）：P0 已实测定案——SQLite 下 `timezone=True/False` 行为完全一致，改列无效且会推翻 TPV0101（25 列 + 依赖守卫 + 静态守卫测试）。缺陷在表示层，不在存储层。

### 6.9 后端叶响应模型 datetime 字段（31 个 / 15 个模型）

全部 **本次处理**。P0 第 4 条硬约束要求 P1 出完整清单并逐项核对——清单如下（实测自 `backend/peekview/models.py`）：

| # | 模型 | 行号 | datetime 字段 | 字段数 |
|---|---|---|---|---|
| 1 | `ReadStatsResponse` | 514 | `last_read_at` | 1 |
| 2 | `ReadEventResponse` | 523 | `read_at`, `updated_at` | 2 |
| 3 | `CountdownInfo` | 716 | `archive_delete_at` | 1 |
| 4 | `StarResponse` | 724 | `created_at` | 1 |
| 5 | `TombstoneResponse` | 734 | `deleted_at` | 1 |
| 6 | `StarItem` | 754 | `starred_at`, `expires_at`, `archived_at` | 3 |
| 7 | `EntryResponse` | 791 | `expires_at`, `archived_at`, `created_at`, `updated_at` | 4 |
| 8 | `EntryListItem` | 817 | `expires_at`, `archived_at`, `created_at`, `updated_at` | 4 |
| 9 | `EntryRawResponse` | 854 | `created_at` | 1 |
| 10 | `CreateEntryResponse` | 913 | `expires_at`, `created_at` | 2 |
| 11 | `UserResponse` | 1026 | `created_at`, `disabled_at` | 2 |
| 12 | `ApiKeyResponse` | 1083 | `expires_at`, `last_used_at`, `created_at` | 3 |
| 13 | `ApiKeyCreateResponse` | 1094 | `expires_at`, `created_at` | 2 |
| 14 | `EntryStats` | 1108 | `latest_created_at` | 1 |
| 15 | `ShareResponse` | 1185 | `expires_at`, `created_at`, `revoked_at` | 3 |
| | **合计** | | | **31** |

**核对要点（逐项结论）**：

1. P0 说"约 30 个字段"，实测 **31** 个 → 吻合。
2. **`ShareCreateResponse`（1196）继承 `ShareResponse`**，无需单独覆盖（继承即得）。但它是一个独立端点（`POST /shares`）的响应，P6 需单独验证（BDD-07 覆盖）。
3. **`EntryBase`（82）含 3 个 datetime 字段**（`expires_at` / `archived_at` / `archive_delete_at`）且被表模型 `Entry` 继承 → **严禁在此加 serializer**（I-2）。
4. **`UserBase`（116）含 `disabled_at`** 且被表模型 `User` 继承 → 同上，严禁。
5. 所有 `table=True` 的模型（`User`/`Team`/`TeamMember`/`ApiKey`/`Entry`/`EntryShare`/`EntryRead`/`EntryStar`/`EntryTombstone`/`EntryReadStats`/`File`）**一律不处理**。
6. `ReadEventListResponse` / `EntryListResponse` / `StarListResponse` / `UserListResponse` / `ShareListResponse` / `TeamsListResponse` 等**容器模型**自身无 datetime 字段（元素模型已覆盖）→ 不处理。
7. 嵌套引用关系：`EntryResponse.read_stats` → `ReadStatsResponse`、`.countdown` → `CountdownInfo`；`StarItem.countdown` → `CountdownInfo`、`.tombstone` → `TombstoneResponse` → 三个嵌套模型均已在本清单内，无遗漏。
8. `response_model` 契约：实测 10 处 `response_model=`（`api/admin.py` 7 处、`api/config_router.py` 3 处），其中 `UserResponse`（4 个 admin 端点）、`UserListResponse`、`AdminStatsResponse`（含 `EntryStats`）涉及 datetime → **这几处落在 `response_model` 指名的类上**，符合 P0 第 2 条硬约束。`api/entries.py` / `shares.py` / `stars.py` / `files.py` **无 `response_model`**（走 `JSONResponse(model_dump(mode="json"))` 或直接返回实例）→ 无"重新校验丢 Z"风险。

### 6.10 回归拦截（防同类问题未来新增）

同类问题会**持续新增**（新端点 → 新响应模型 → 新 datetime 字段），故需求声明拦截手段：

| 拦截手段 | 对应 BDD |
|---|---|
| 遍历 `models` 模块，断言"每个非 table 类中的每个 datetime 字段"在 JSON 输出中带 `Z`（**机械清单式**，新模型自动纳入，不靠人工维护清单） | BDD-07 |
| 断言表模型 `model_dump()` 仍返回 datetime（防 `when_used` 回归为 `always`） | BDD-08 |
| 断言 python 模式 `model_dump()` 仍返回 datetime | BDD-09 |
| 前端断言 `new Date(带 Z 字符串)` 得正确瞬间（锁住端到端时区语义） | BDD-04 |
| 文件数三态各一条用例（0/1/3），新增 `2+` 阈值时自动覆盖 | BDD-13/14/15 |
| 菜单选项构造按三态笛卡尔子集逐态断言（`(true,null)` / `(false,null)` / `(false,A)`） | BDD-16/18 |
| 可见性**转换结果**按决策 3 的 5 个转换逐条断言（`is_public` + `team` 两字段），新增转换方向时须同步补 BDD | BDD-19/20/27/28/29 |
| 菜单键盘可达性（`Escape` 关闭 + 焦点回归触发入口）单测，防新增复合控件丢失 a11y | BDD-30 |

---

## 7. P0-brief 时效性质疑

P0 立项日期 2026-11-10，本日开工（同日）。逐条核对 P0 卡的严重 3 条判据：

| 判据 | 核对结果 |
|---|---|
| 1. `task` 的目标方案是否仍成立 | **仍成立**。四项缺陷实测复现：时间主显相对 + `toLocaleString()` 无时区（`useRelativeTime.ts:24-26`）；`1 file` 会显示（`EntryCard.vue:44` 的 `v-if` 对 1 为真）；可见性单按钮 + 团队时空占位（`EntryCard.vue:14-20`）；0 文件 entry 落到 `Select a file to view`（`EntryDetailContent.vue:59-61`）。序列化方案（叶模型 `field_serializer` / `Annotated[..., PlainSerializer(when_used='json')]`）未被推翻。 |
| 2. `executor_env` 平台前提是否仍成立 | **仍成立**。branch `main`、HEAD `8ab8f58b`（与 P0 commit 一致）、工作树干净（仅本任务未跟踪文件）。Python 3.12.3（`requires-python >=3.10`，3.10 不接受 `Z` 的结论仍有效）。 |
| 3. `known_risks` 的"已解决前提"是否实际未解决/已被他任务解决 | **无命中**。`known_risks` 中被划掉的"时区解析坑"仍成立（naive 值 = UTC）；`client.py:89` 的 `fromisoformat` 仍为裸调用（未被他任务修）；`EntryBase` 仍被 `Entry` 继承。 |

**结论：不命中严重 3 条 → 不阻塞。** 但核对中发现 3 处**客观事实性漂移**（不影响任何决策，属 P1 应做的核实修正），按"轻微"处理并记录：

[P0_STALE: 主 Agent 在 P1 dispatch-context 的 objective_info 称 `scripts/seed-data/image-gallery/`（0 内容文件）是"现成的 0 文件 entry，可作决策 4 的验收素材"——实测不成立：`scripts/seed-debug.py:184` 对 `if not files: print("SKIP ... no content files"); continue`，该目录 0 个内容文件（仅 `meta.json`）→ **不会入库**。已更新：本文件 I-19 改为"0 文件 entry 必须走 debug backend HTTP API 现造"，并写入 BDD-25 的 Given 前提。属轻微（决策 4 本身不受影响，仅验收素材的获取方式变化）]

[P0_STALE: 主 Agent 在 P1 dispatch-context 的 objective_info 称含 `team_id` 的 seed 有 3 个"均为 `backend-solo`"——实测团队分别为 `csv-employees` → `backend-solo`（owner carol）、`markdown-test` → `frontend-team`（owner alice）、`mermaid-charts` → `frontend-team`（owner alice）。已更新：BDD-18/BDD-26 的团队分支改用实测团队名（`frontend-team` 为 alice 所属，可直接验 BDD-18；`backend-solo` 属 carol）。属轻微（决策 3 的 Team 分支仍有现成数据，只是名称与归属需修正）]

[P0_STALE: P0 的配套改动清单第 2 行给出 `cli.py` 的 `.isoformat()` 行号为 `378/443/561`——实测为 `378/443/444/564/571`，另有 `2287/2318` 两处该清单未列出（共 7 处，非 3 处）。已更新：本文件 6.6 节按实测行号登记。属轻微（配套改动 #2 的范围由"3 处"扩为"7 处 + `admin_service.py` 3 处"）]

> **三条的处置说明**：三条均**不推翻任何 P0 决策**（决策 1-4 全部维持原判，BDD 判定强度未削弱）。来源归因分别为——第 1/2 条的错误来源是**编排侧**（主 Agent 在 `P1-dispatch-context-analyst.md` 的 `<objective_info>` 块，第 371 行；`P0-brief.md` 中不存在 `image-gallery` / `backend-solo` / `objective_info` 任何一处，已 grep 实测为 0 命中），第 3 条是 **P0-brief 自身**的行号漂移（`P0-brief.md:191` 配套改动清单第 2 行）。

> 注：P0 的 `EntryCard.vue:43` / `EntryListRow.vue:19` / `EntryDetailHeader.vue:62` 行号实测**准确**，无需修正。

---

## 8. 能力需求声明

```yaml
capability_requirements:
  - need: visual / vision 截图分析
    why: 本任务 domains 含 frontend 且 ui_affected=true——P6 验收需对 Explore 卡片/列表/详情页的三处时间显示、文件数显隐、可见性下拉菜单（含子菜单与二次确认）做截图视觉核对，确认无布局溢出与遮挡
    available:
      - "vision-engine skill（DSH 侧 ~/.dsh/skills/vision-engine，主 Agent 实测 self-test 8 个模型 alive）"
      - "具体可用模型：google-free/gemini-flash-lite-latest、google-free/gemini-3.5-flash-lite、alibailian/qwen3-vl-plus、alibailian/qwen3.7-flash、alibailian/qwen3.7-plus、alibailian/qwen3.8-max、volcengine/doubao-seed-2-0-lite-260428、xrouter/nx-vision"
      - "Playwright 截图（mcp__pwtest__* / CDP :18800）"
    status: available
    note: "P6 调用需把 ratelimit 目录重定向到项目内可写路径（.agate-tmp/ve/），属调用方式而非能力缺失——沙箱下 ~/.local/share/vision-engine 只读会导致 record_usage() 崩溃"

  - need: browser-automation 真实浏览器交互
    why: 可见性下拉菜单需验证悬停展开、子菜单、二次确认弹窗、请求中禁用等真实交互；悬停 tooltip 与 toLocaleString 输出依赖真实浏览器 locale/时区
    available:
      - "mcp__pwtest__*（干净无登录态，默认）"
      - "Playwright CDP :18800（WSL/GPU 场景）"
      - "frontend-v3/e2e/ Playwright spec（现有 42 个 *.spec.ts，定向用 E2E_SPEC=）"
    status: available

  - need: timezone-controlled-execution 时区固定执行
    why: BDD-04 要求"浏览器时区固定为 Asia/Shanghai"才能二值判定 +8 小时；BDD-01/BDD-02/BDD-26 断言不得硬编码 GMT+8（CI runner 时区可能不同）
    available:
      - "Playwright context 的 timezoneId 选项（每个 test 显式 test.use({ timezoneId: 'Asia/Shanghai' })）"
      - "进程级 TZ 环境变量（对 Node 侧 new Date().toLocaleString 生效）"
    status: available

  - need: locale-controlled-execution 浏览器 locale 固定执行
    why: 时间文本的墙上时间格式随 locale 变（实测同一时刻 `Asia/Shanghai` 下 `zh-CN` → `2026/11/10 GMT+8 17:43:00`、`en-US` → `11/10/2026, 05:43:00 PM GMT+8`、`ja-JP` → `2026/11/10 17時43分00秒 GMT+8`）。BDD-04 断言 `17:43:00` 字面量、BDD-02 断言偏移形态，均须在固定 locale 下才可二值判定。项目 `frontend-v3/playwright.config.ts` 的 `use` 块未设 `locale` → Playwright 默认 `en-US`，不固定则实现正确也会假 FAIL
    available:
      - "Playwright context 的 locale 选项（每个 test 显式 test.use({ locale: 'zh-CN' })；仓库已有 test.use({ viewport }) 同款先例）"
      - "Playwright 配置文件 use.locale 全局固定（会影响既有 42 个 spec，不推荐）"
    status: available
```

**verification_env 声明**：

```yaml
verification_env: "debug backend http://127.0.0.1:8888（make debug-start / make debug-quick）+ 数据目录 /tmp/peekview-debug/ + make debug-seed 灌入 scripts/seed-data/"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

**边界说明**：本任务不需要 `requires_minimal_validation: true`——时间格式化与菜单选项构造均可在 Node/vitest 环境直接断言，无需依赖浏览器特有行为或外部系统行为。唯一涉浏览器的判定是 BDD-04（时区 + locale）与 BDD-02（悬停），两者均可用 Playwright 的 `timezoneId` / `locale` 选项与真实 hover 直接验证，不构成"实现不可推断"的情形。

---

## 9. 范围声明

`packages: [peekview, frontend-v3, docs]`、`domains: [backend, frontend, api, cli]` — 已写入文件头 frontmatter，此处不重复。

- `peekview`（后端包）：`models.py`（叶响应模型序列化）、`client.py`（`fromisoformat`）、`cli.py`（`isoformat` 统一）、`services/admin_service.py`（`isoformat`）、新增序列化契约测试
- `frontend-v3`：`composables/useRelativeTime.ts`、`components/EntryCard.vue`、`EntryListRow.vue`、`EntryDetailHeader.vue`、`EntryMetaTagsBar.vue`、`EntryDetailContent.vue`、新增共享可见性菜单组件、`stores/entryList.ts`、`stores/entryDetail.ts`、`composables/useEntryDetailActions.ts`、`views/EntryListView.vue`、`views/EntryDetailView.vue`、相关单测与 E2E
- `docs`：`CHANGELOG.md`（`[Unreleased]`）、升级说明（响应格式变更）

**可访问性范围（显式声明，不留沉默）**：新增共享可见性菜单的**键盘可达性纳入本任务范围**，验收条件为 BDD-30（`Escape` 关闭菜单 + 焦点回归触发入口）。按项目既有惯例实现（`OverflowMenu.vue:140-155` 的 `Escape` + `triggerRef.focus()` 模式）。**不纳入**本任务的是完整 ARIA 菜单语义的穷尽实现（`role="menu"`/`menuitem` 完整角色树、方向键在菜单项间移动、子菜单的 `aria-haspopup`/`aria-controls` 关联）——该项留作独立任务，**待登记 roadmap**（当前 `docs/roadmap/improvement-backlog.md` 最大编号为 #58，本 P1 阶段不代填编号，由 P2/P8 按当时编号追加）。理由：完整菜单角色树属独立的可访问性专项，需配合读屏实测，与本任务四项体验缺陷的范围不同源；而"能关掉且焦点不丢失"是键盘用户的最低可用门槛，属新增复合控件的必要配套。

**不在范围**：`packages/mcp-server/`（无代码改动，仅验证）、`PublishView` 的发布页可见性控件、`FileTree` 的文件计数、`ApiKeySettingsTab`/`ApiKeyListView` 的本地时间格式化重复实现。

---

## 10. 依赖与前置条件

| 项 | 说明 |
|---|---|
| 前置任务 | 无。TPV0101（sqlmodel-datetime-compat，25 列 `timezone=False`）已完成，是本任务"不做 DB 迁移"的前提 |
| 关联但不阻塞 | TPV0095（team-visibility）已完成，其 BDD-40 断言被本任务有意取代（见 I-23） |
| 环境 | debug 服务 `:8888` 由主 Agent 按 verification_env 统一准备；**严禁**触碰生产 `:8080` / `~/.peekview/` |
| 数据 | `make debug-seed` 提供 24 个 seed 目录中 23 个 entry（`image-gallery` 因 0 内容文件被跳过，见 I-19）；0 文件 entry 需 HTTP API 现造 |

状态标记：[PROD_NOT_TOUCHED]
