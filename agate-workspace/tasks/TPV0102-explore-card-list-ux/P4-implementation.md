---
phase: P4
task_id: TPV0102
type: implementation
parent: P2-design.md
trace_id: TPV0102-P4-20261110
status: draft
created: 2026-11-10
agent: implementer
implementation_dir: backend/peekview/
change_type: refactor
domains:
- backend
packages:
- peekview
prod_touched: false
---

# P4 实现记录 — TPV0102：Explore 卡片列表体验修正

> 本文件由 5 个并行批共用，每批一个二级节。本节为 `backend-serialize` 批。

## [backend-serialize] 后端 UTC 序列化契约

### 改动文件

| 文件 | 改动 | 关联 |
|------|------|------|
| `backend/peekview/timefmt.py`（**新建**） | 两个零依赖纯函数：`utc_iso_z(dt \| None) -> str \| None`（naive 按 UTC，输出 `...Z`）、`parse_iso(s) -> datetime`（`fromisoformat(s.replace("Z","+00:00"))`，兼容 Python 3.10） | BDD-10 / 11 |
| `backend/peekview/models.py` | ① `now_utc` 与 `EntryBase` 之间新增 `UtcSerializeMixin(SQLModel)`，内含 `@field_serializer("*", when_used="json", check_fields=False)`；② 15 个叶响应模型基类 `SQLModel` → `UtcSerializeMixin` | BDD-07 / 08 / 09 |
| `backend/peekview/client.py` | `_parse_dt` 的 `datetime.fromisoformat(v)` → `parse_iso(v)` | BDD-10 |
| `backend/peekview/cli.py` | 7 处 `.isoformat()` → `utc_iso_z(...)`（`create -j` / `get -j` ×2 / `list -j` ×2 / `stats -j` / `stats` echo） | BDD-11 |
| `backend/peekview/services/admin_service.py` | 3 处 `.isoformat()` → `utc_iso_z(...)`（backup 导出的 `expires_at` / `created_at` / `updated_at`） | BDD-11 |
| `backend/tests/test_utc_serialization.py` | **仅 ruff I001 导入顺序自动修复 1 行**（`peekview.timefmt` import 被移到 `peekview.models` 之后），零断言/零逻辑改动 | — |

### 未被改动（自查确认）

`git diff backend/peekview/models.py` 中不含 `class EntryBase` / `class UserBase` 的 `-/+` 行 —— 两者仍为 `(SQLModel)`。`ShareCreateResponse` 亦未单独改（继承 `ShareResponse` 即得）。

### 硬约束落地核对

1. `when_used="json"` 显式声明 → `model_dump()`（python 模式）仍返回 `datetime`（BDD-09 全绿）
2. `check_fields=False` 已带（mixin 自身无字段）
3. 无任何 `table=True` 模型继承 `UtcSerializeMixin`（`test_mixin_not_in_table_mro` 绿）
4. 非 `datetime` 值原样透传（`isinstance` 判定后 return value）

### 实地验证（非 gate，自查）

用 `fastapi.testclient` 在 `.agate-tmp/` 隔离数据目录起一个临时 app（非 :8080、非 ~/.peekview/），实跑两个真实端点确认 Z 后缀确实出现在 HTTP 响应体而非仅在模型层：

```
POST /api/v1/entries → 201, created_at = 2026-11-10T12:38:52.576805Z
GET  /api/v1/entries → list item created_at = 2026-11-10T12:38:52.576805Z
```

探针脚本已删除，`backend/tests/` 下无 scratch 文件。

### 自查结果（自查≠gate，P5 由 verifier 执行）

| 命令 | 结果 |
|---|---|
| `pytest tests/test_utc_serialization.py -q` | **20 passed** |
| `pytest tests/ -k mixin_not_in_table_mro -q` | **1 passed**（exit 0，非 5） |
| `make lint` | All checks passed |
| `make test-quick` | 1205 passed, 3 skipped, **1 failed** |

**唯一失败** `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 为**预存失败**：`git stash` 掉本批全部 `backend/peekview/` 改动后该用例**同样 FAILED**，成因是沙箱 `~/.peekview/` 只读（写配置文件失败），与本批改动无关。

### Lint 前置失败说明

`make lint` 在本批开工时即为红，归因于 P3 提交的 `tests/test_utc_serialization.py:35`（`peekview.timefmt` 与注释块之间的 import 顺序触发 ruff `I001`），非本批写入。已用 `ruff check --fix` 的机械修复（仅移动一行 import + 恢复注释分组），未改任何断言。

[PROD_NOT_TOUCHED]

## [frontend-shared] 前端共享叶子件（时间显示 / 可见性菜单 / store 能力）

### 改动文件

| 文件 | 改动 | 关联 |
|------|------|------|
| `frontend-v3/src/utils/visibility-options.ts`（**新建**） | `buildVisibilityOptions`（三态判定 + 排除当前团队 + `teamsFailed` 透传）、`VisibilityItem` / `VisibilityTarget` / `TeamOption` 类型、`visibilityStatusLabel` 纯函数（inline 可见文案与全变体 `aria-label` 共用，防漂移） | BDD-16 / 17 / 18 / R11 |
| `frontend-v3/src/utils/visibility-target.ts`（**新建**） | `toPatchPayload`（public/private 两字段同传，team 只传 `team_id`）与 `needsConfirm`（仅 public） | BDD-19 / 20 / 27 / 28 / 29 |
| `frontend-v3/src/composables/useRelativeTime.ts` | `formatRelativeTime` 修边界（无效 → `''`、未来 → `in N…`、`<60s` → `just now`）；`formatFullDate` 改逐字段 + `shortOffset`、无效 → `'—'`；**新增** `formatTooltip`（`relative · longOffset 墙上时间 · IANA 名`，无效 → `'Invalid date'`）；`useRelativeTime` 返回值扩 `absolute`，`update()` 提前到 setup 同步执行 | BDD-01 / 02 / 05 / 06 |
| `frontend-v3/src/components/TimeDisplay.vue`（**新建**） | 根 `data-testid="time-display"` + `.time-display__main`（绝对时间）+ 自定义 DOM tooltip（`role="tooltip"` + `data-testid="time-tooltip"`，`visibility` 切换、`z-index: 10`、移动端右对齐且允许换行、无 ellipsis） | BDD-01 / 02 / 05 |
| `frontend-v3/src/components/VisibilityMenu.vue`（**新建**） | `icon` / `inline` / `sheet` 三变体菜单；Teleport（sheet 恒为 body、桌面 dropdown 亦走统一 layer）；`aria-label` + `aria-haspopup` + `aria-expanded`；`focus-visible` 焦点环；`Escape` 关子菜单再关菜单 + 焦点回归；`confirm-cancel` 后重开菜单并 `nextTick` 还焦点；`teamsFailed` 渲染禁用项 + 「团队列表加载失败」文案；移动端触发按钮 ≥44×44 | BDD-16~21 / 24 / 30 / R11 |
| `frontend-v3/src/stores/entryList.ts` | 新增 `setVisibility(entry, target) → {ok, revokedShares}`：响应式 `inFlight` 守卫、乐观更新、失败三字段整体 `restore`、成功以服务端返回为准、`revokedShares ?? 0` 回传、**store 内无 `useToast`**；`toggleVisibility` 改为 `setVisibility` 的包装（原 `entry.teamId` 守卫删除） | BDD-19 / 21 / 24 / 27 / 28 / 29 |
| `frontend-v3/src/stores/entryDetail.ts` | `syncVisibility(slug, isPublic)` → `syncVisibility(slug, {isPublic, teamId, team})` 三字段同步 | 陷阱 12 |
| `frontend-v3/src/stores/entry.ts` | 透传层补导出 `setVisibility` | 签名变化 |
| `frontend-v3/src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts` | **既有 spec 显式更新**（见下「既有断言显式取代」） | P2 §6.4 第 4 项 |

### 四条硬约束落地核对

1. **无 `Team.id` 引用**：全批用 `entry.team?.slug ?? null` 派生当前团队、子菜单按 `t.slug !== currentTeamSlug` 比对；`grep '\.id'` 在本批三个新文件（`visibility-options.ts` / `visibility-target.ts` / `VisibilityMenu.vue`）零命中，`make typecheck` 通过。
2. **tooltip 为真实 DOM + `visibility` 切换**：`role="tooltip"` + `data-testid="time-tooltip"` 字面写在节点上，隐藏用 `visibility: hidden`（无 `opacity`），无内联 `style`，主显节点无 `title` 属性。
3. **`dateStyle`/`timeStyle` 与 `timeZoneName` 未共存**：`FULL_DATE_OPTIONS` 逐字段 `year/month/day/hour/minute/second`，`timeZoneName` 由参数在展开处附加。
4. **时区名不拼接**：墙钟时间与偏移整体交给 `toLocaleString`；IANA 名仅作 tooltip 第三段独立插值，用 `shortOffset` / `longOffset`（不用歧义的 `short`）。

### 既有断言显式取代（禁止静默改）

P2 §6.4 第 4 项：`src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts` 原断言「团队 entry 的 `toggleVisibility` 返回 false 且不发请求」的前提（`entry.teamId` 守卫）已被 TPV0102 的「替代而非叠加」删除，故：

- 首条用例由 `bdd40_store_toggle_rejects_team_entry_without_api_call` **替换**为 `bdd40_store_team_entry_now_allows_visibility_request`：断言翻转 —— 团队 entry 经 `setVisibility` 正常发出 `api.updateEntry('team-entry', { is_public: true, team_id: null })`，且 `api.toggleEntryVisibility` 未被调用（旧 `toggleEntryVisibility` 路径不再使用）；
- 第二条用例存活但改 mock 目标为 `api.updateEntry`（`toggleVisibility` 已改为 `setVisibility` 包装）；
- 该文件顶部注释显式登记取代来源。**未删除任何用例覆盖点，只翻转设计变更影响的断言值。**

「团队 entry 现在**有** `visibility-toggle`」的两条组件断言（P2 §6.4 第 2/3 项：`tpv0095-entry-card-team.spec.ts` / `tpv0095-entry-list-row-team.spec.ts`）与第 5 项（`tpv0095-detail-visibility-tag.spec.ts` 的 `.status-tag` → 菜单入口）**属 `mount-explore` / `mount-detail` 两批范围**（须先改 `EntryCard.vue` / `EntryListRow.vue` / `EntryDetailHeader.vue`），本批未挂载故未改，当前仍全绿。

### 自查结果（自查≠gate，P5 由 verifier 执行）

| 命令 | 结果 |
|------|------|
| `npx vitest run`（本批 6 个 spec） | **79 passed / 0 failed**（6 files） |
| `npx vitest run src/**/tpv0095-*`（8 个既有 spec） | **29 passed / 0 failed** |
| `make typecheck` | ✓ type check passed |
| `make lint` | All checks passed（`ruff`，前端无独立 lint 门禁） |

各 spec 分布：`visibility-target` 15、`visibility-options` 12、`entry-list-visibility` 10、`useRelativeTime` 17、`time-display` 10、`visibility-menu` 15。

### 实现中自主决策（`[DESIGN_GAP]` 候选，供 P7 核对）

[DESIGN_GAP: `useRelativeTime.update()` 从「仅 onMounted 内调用」改为「setup 内同步调用 + onMounted 只挂定时器」——P2 §3.4 未规定初始化时机，但 P3 spec 在无组件实例时直接读取 `absolute.value`（BDD-02 末条），且在组件 setup 首帧即渲染文本。副作用：脱离组件上下文调用时 Vue 会打 2 条 `onMounted/onUnmounted` 无实例告警（仅 stderr，不影响断言）。]
[DESIGN_GAP: `VisibilityMenu` 的 `item` 类型用本地 `VisibilityItem`（`{kind}`）而非 `VisibilityTarget` 联合体——P2 §3.5 说「Team 入口自身不带 onSelect」，P3 spec 又断言 `JSON.stringify(teamItems[0])` 不含 `teamSlug`；用不含载荷的窄类型是唯一能同时满足两者的形状，纯函数模块同时导出两者。]
[DESIGN_GAP: Teleport 只对 `sheet` 变体启用（`VisibilityMenu.vue:22` 为 `:disabled="variant !== 'sheet'"`），`icon`/`inline` 变体不 Teleport、浮层以 `position:absolute` 就地渲染。P2 只要求 sheet 必须 Teleport 以规避 `.entry-panel{overflow:hidden}` 裁剪；`icon`/`inline` 的裁剪面改由父容器解除（`EntryListView.vue` 的 `.entry-panel` 不再设 `overflow:hidden`，圆角裁切改由首/末行 `border-radius:13px` 自理）——理由：`icon`/`inline` 浮层需紧贴触发按钮并随页面滚动，改为 body 级 `position:fixed` 需引入滚动/缩放时的重定位逻辑，偏离 P2 的「样式取值 z-index 100」且改动面更大。]
[DESIGN_GAP: `tpv0095-entry-list-store-team.spec.ts` 首条用例改名（`rejects_...` → `now_allows_...`）——P2 §6.4 第 4 项只说「断言更新为团队 entry 正常发起请求」，未规定用例名；改名以避免名实不符。]

### 全量前端套件自查（回归面）

`npx vitest run`（全量 119 files / 1458 tests）→ **1451 passed / 3 failed / 4 skipped**。唯一红文件 `src/components/__tests__/entry-card-file-count.spec.ts`（3 条）经**基线比对**确认是 **P3 既有红灯、非本批引入**：临时 `git stash` 本批 5 个改动文件 + 移出 4 个新文件后重跑，结果完全一致（3 failed / 8 passed），失败原因是 BDD-13（`v-if="entry.fileCount"` 仍渲染 `1 file`）与 BDD-22 的团队 entry `visibility-toggle` 计数，两者都需改 `EntryCard.vue` / `EntryListRow.vue`——**属 `mount-explore` 批范围**，本批 dispatch-context 明确禁止触碰该两文件。恢复后 6 个批次 spec 复跑仍 79/79，`make typecheck` / `make lint` 均通过。

[PROD_NOT_TOUCHED]

## [mount-explore] Explore 卡片与列表挂载（时间 / 文件数 / 可见性菜单 / toast 四态）

### 改动文件

| 文件 | 改动 | 关联 |
|------|------|------|
| `frontend-v3/src/components/EntryCard.vue` | ① `<span class="meta-time" :title="fullTime">{{ relativeTime }}</span>` → `<TimeDisplay class="meta-time" :date-str="entry.createdAt" />`，连带删除 `toRef` / `useRelativeTime` 解构（去两套来源）；② 文件数 `v-if="entry.fileCount"` + `file{{ n!==1?'s':'' }}` → `v-if="(entry.fileCount ?? 0) >= 2"` + 固定 `{{ entry.fileCount }} files`；③ `v-if="!entry.teamId"` 单按钮 **和** `v-else` 空 `team-hint` span 一并删除，换成 `<VisibilityMenu>`；④ 新增 `teams` / `variant` / `disabled` / `teamsFailed` props 与 `changeVisibility` 事件，`variant` 原样透传；⑤ 补 `.card-action-btn:focus-visible`（D-12）；⑥ 删 `.card-action-btn--team-hint` 死样式 | BDD-01 / 13-15 / 22 / 24 / 27-30 |
| `frontend-v3/src/components/EntryListRow.vue` | 同上（元信息行 / 文件数 / `entry-actions` 内菜单）；差异：该处原**无**空占位 span，直接以菜单替换单按钮；补 `.action-btn:focus-visible`；删 `visibility-btn` 类与 `data-action="toggle-visibility"` | 同上 |
| `frontend-v3/src/views/EntryListView.vue` | ① `storeToRefs` 补 `error`，新增 `allTeams`（`owned + joined`）与 `teamsFailed`（`error !== null`）computed 并下发两处绑定；② 接 `useResponsiveLayout()` 的 `isMobile`/`handleResize`，`onMounted` 加 `resize` 监听 + 新增 `onBeforeUnmount` 成对移除；③ 两处绑定 `@toggle-visibility` → `@change-visibility`，`handleToggleVisibility` → `handleVisibilityChange`（调 `setVisibility`，按 `{ok, revokedShares}` 分派四态 toast：`Made public` / `Now private` / `Shared with Team {name}` / 失败 `Failed to change visibility`，并在 `revokedShares > 0` 时**追加** warning `{N} share link(s) revoked — entry is now public`）；④ `:variant="isMobile ? 'sheet' : 'icon'"`；⑤ `:disabled` 经 `isVisibilityPending(slug)` 读 `entryStore.inFlight`（容错旧测试 mock 缺该键——避免模板处异常） | BDD-19 / 20 / 21 / 24 / 27-29 / 30 |

### 硬约束落地核对

1. **store 内无 toast**：本批只在视图层写 `toast.show`；`stores/entryList.ts` 未被本批触碰（`setVisibility` 由 `[frontend-shared]` 交付，已确认无 `useToast`）。
2. **空占位已删**：`EntryCard.vue` 的 `data-testid="team-visibility-hint"` 空 span 与 `.card-action-btn--team-hint` 样式一并移除（P0 指出的"空占位"缺陷），全仓无残留引用。
3. **文件数复数恒定**：`>= 2` 分支内固定 `files`，不再三元判断——`fileCount=1` 走不到该分支，故 `1 files` 不可能出现。
4. **`variant` 不自判**：两个组件只做透传，取值只由 `EntryListView` 的 `isMobile` 决定（N-2 裁定）。
5. **`revokedShares` 反馈未丢**：B-4 语义从"store 内发 warning"平移为"视图层按 `result.revokedShares` 追加 warning"，与 E-2 归属裁定一致。

### 既有断言的显式取代（禁止静默改）

| # | 文件 | 原断言 | 更新为 | 依据 |
|---|------|--------|--------|------|
| 1 | `e2e/team-visibility.spec.ts`（BDD-40） | 团队 entry 卡片 `visibility-toggle` `count = 0`，且整段包在 `if ((await teamCard.count()) > 0)` 里 | `count = 1`；**拆掉** `if` 守卫，改前置 `await expect(teamCard).toHaveCount(1)` | P2 §6.4 第 1 项 / 陷阱 16 |
| 2 | `src/components/__tests__/tpv0095-entry-card-team.spec.ts` | `bdd40_team_entry_hides_visibility_toggle_but_keeps_delete`：`count = 0` | 改名 `bdd40_team_entry_shows_visibility_toggle_and_keeps_delete`：`toHaveLength(1)`；另一条由 `toBeGreaterThanOrEqual(0)`（恒真假断言）收紧为 `toHaveLength(1)` | P2 §6.4 第 2 项 |
| 3 | `src/components/__tests__/tpv0095-entry-list-row-team.spec.ts` | 同名用例：`count = 0` | 同上翻转；`bdd40_owner_non_team_public_entry_keeps_toggle` 由 `toBeGreaterThan(0)` 收紧为 `toHaveLength(1)` | P2 §6.4 第 3 项 |
| 4 | `src/__tests__/filter-tabs.test.ts`（TC-D03） | `timeEl.attributes('title') === '2026-07-07 14:30'` | 主显 `.time-display__main` 文本 + `[data-testid="time-tooltip"]` 文本；`useRelativeTime` mock 补 `absolute` | P2 §6.4 第 6/7 项 |
| 5 | `src/__tests__/expired-warning.test.ts`（TC-D04） | 同上 | 同上 | P2 §6.4 第 6/7 项 |
| 6 | `src/components/__tests__/t031-entry-card.spec.ts`（BDD-7） | 点 `.card-action-btn` 后 `emitted('toggleVisibility')` | 点 `[data-testid="visibility-toggle"]` 开菜单再点 `visibility-item-private`，断言 `emitted('changeVisibility')[0][0].target.kind === 'private'` | D7 / D9（事件名与交互路径变更） |
| 7 | `src/components/__tests__/t031-entry-list-row.spec.ts`（BDD-7） | 点 `[data-action="toggle-visibility"]` 后 `emitted('toggleVisibility')` | 同上 | D7 / D9 |

第 1~5 项与 P2 §6.4 的编号一一对应；第 6/7 项源自 §1.1 D7/D9 的事件改名（P2 §6.4 未列，属本批实现时才浮现的连带面，见下方 `[SCOPE+]`）。

**每个文件均在头部注释登记「被 TPV0102 有意取代」，逐条列出原断言 → 新断言 → 依据，未删除任何覆盖点**（用例改名而非删除；断言值翻转而非弱化；`toBeGreaterThanOrEqual(0)` / `toBeGreaterThan(0)` 这类弱断言反而收紧为精确 `toHaveLength(1)`）。

### 自查结果（自查≠gate，P5 由 verifier 执行）

| 命令 | 结果 |
|---|---|
| `npx vitest run src/components/__tests__/entry-card-file-count.spec.ts src/components/__tests__/tpv0095-entry-card-team.spec.ts src/components/__tests__/tpv0095-entry-list-row-team.spec.ts` | **20 passed / 0 failed**（3 files） |
| 本批触及的 10 个 spec（含 `visibility-menu` / `time-display` / `entry-list-visibility` 回归） | **76 passed / 0 failed** |
| `npx vitest run`（全量 119 files / 1460 tests） | **1456 passed / 0 failed / 4 skipped** |
| `make typecheck` | ✓ type check passed |
| `npx vite build` | ✓ built in 13.38s，`frontend-v3/dist/index.html` 实际产出（前端任务 P4 构建产物 checklist） |

`entry-card-file-count.spec.ts` 的 3 条 P3 红灯（BDD-13 卡片/列表 `1 file` + BDD-22 团队 entry 无入口）**全部转绿**；其余 8 条原为正向护栏，改动后仍绿。

### 实现中自主决策（`[DESIGN_GAP]` 候选，供 P7 核对）

[DESIGN_GAP: `EntryCard` / `EntryListRow` 的可见性事件载荷定为 `changeVisibility({ entry, target })`（对象包一层）而 P2 §1.1 D9 只写了事件名 `@change-visibility="handleVisibilityChange"`、未定载荷形状——父组件已持有 entry（`v-for` 项），只传 `target` 也可行；选择带 `entry` 是因为视图层的 `handleVisibilityChange` 需要那份 entry 引用去调 `setVisibility(entry, target)`，若只传 target 则父层还要按 `entry.slug` 反查，多一次查找且易与列表刷新竞态。]

[DESIGN_GAP: `EntryListView` 用 `isVisibilityPending(slug)` 函数读取 `entryStore.inFlight` 而非直接 `entryStore.inFlight.has(...)`——`t031-entry-list-view.spec.ts` / `tpv0095-entry-list-view-teams.spec.ts` 等既有视图 spec 的 store mock 不含 `inFlight` 键，模板直接链式访问会在渲染期抛异常（本批未改这些 spec，改由视图层容错）。P2 §3.7 只要求"下发 teams/variant/teamsFailed"，未涉及 `disabled` 的取值来源。]

[DESIGN_GAP: `teamsFailed` 在视图层由 `teamStore.error !== null` 派生（P2 §3.5 的 prop 语义如此），但 `stores/team.ts` 的 `loadMyTeams` catch 分支只置 `error` 不置 `teamsLoaded`，故失败后 `ensureMyTeamsLoaded()` 每次触发都会重试——本批按 P2 原样实现（不在本批范围修 store），若 P6 观察到请求风暴属既有 store 行为，需另立条目。]

### `[SCOPE+]` 登记

[SCOPE+] 本批实现时发现 P1/P2 未覆盖的连带更新面：`t031-entry-card.spec.ts` 与 `t031-entry-list-row.spec.ts` 的 BDD-7「点交互控件不触发导航」用例，原断言 `emitted('toggleVisibility')` 且定位 `.card-action-btn` / `[data-action="toggle-visibility"]`——两处定位与事件名都随 D7/D9 消失。P2 §6.4 的 11 项更新面未列这两个文件。已按"覆盖点不删、只改定位与断言"显式更新（见上表 #6/#7），无需回补 P1 基线，但 P7 一致性检查应知道该项存在。

[PROD_NOT_TOUCHED]

## [mount-detail] 详情页挂载（时间统一 / 可见性菜单 / 0 文件空态 / 团队加载）

### 改动文件

| 文件 | 改动 | 关联 |
|------|------|------|
| `frontend-v3/src/components/EntryDetailContent.vue` | ① 空态拆两支：`currentEntry && files.length === 0` → `data-testid="empty-no-files"`（文案「此 entry 无文件」）；否则 → `data-testid="empty-select-file"`（保留 `Select a file to view`）② `EntryMetaTagsBar` 的 `relativeTime` prop 删除，改下发 `teams` / `teamsFailed` / `isOwner` / `variant` / `disabled` + 透传 `select-visibility` | BDD-25 / 23 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | ① `:62` `<span :title="fullTime">{{ relativeTime }}</span>` → `<TimeDisplay :date-str="currentEntry.createdAt" />` ② `:68-73` 只读 `.status-tag`（team/public/private 三态）**原位替换**为 `<VisibilityMenu variant="inline">`（`v-if="currentEntry && isOwner"`）③ 新增 props `teams` / `teamsFailed` / `isOwner` / `variant` / `visibilityDisabled` + emit `select-visibility`；删除 `relativeTime` / `fullTime` prop ④ 删掉 `.status-tag.public/.private/.team` 三条样式（`.status-tag` 仅保留给 Archived / Expired） | BDD-01/03/23 |
| `frontend-v3/src/components/EntryMetaTagsBar.vue` | ① `:4` `{{ relativeTime }}` → `<TimeDisplay :date-str="currentEntry.createdAt" />` ② `:7-12` 只读 `.status-tag` **原位替换**为 `<VisibilityMenu variant="sheet">`（`v-if="currentEntry && isOwner"`）③ props 改 `currentEntry` / `teams` / `teamsFailed` / `isOwner` / `variant`（默认 `'sheet'`）/ `disabled`；emit `select`；删 `.status-tag` 三条样式 | BDD-01/03/23 |
| `frontend-v3/src/composables/useEntryDetailActions.ts` | ① **移除** overflow 菜单的 `Make Public` / `Make Private` 项及其 `Currently Public`/`Currently Private` hint（P2 §12 裁决 1）② 成死码的 `handleToggleVisibility`（走旧 `toggleVisibility` + 旧 toast 文案）删除，改为 `handleVisibilitySelect(target)` 调 `entryListStore.setVisibility` + **视图层四态 toast**（`Made public` / `Now private` / `Shared with Team {name}` / `{N} share link(s) revoked — entry is now public` warning）③ 新增 `visibilityDisabled`（`entryListStore.inFlight.has(slug)` 派生，喂 BDD-24）④ `Download` 项的 `divider` 不再依赖已删除的 owner 分支 | BDD-23 / 24 / E-2 |
| `frontend-v3/src/views/EntryDetailView.vue` | ① **补 `loadMyTeams()`**（原**零调用**）：`ensureMyTeamsLoaded()` 在 `onMounted` 内 + `watch(authState)` 双触发、`teamsLoaded` 已真则跳过（陷阱 12/13）② 下发 `teams`（`owned + joined`）/ `teamsFailed`（`error !== null`）/ `isOwner` / `variant`（`isMobile ? 'sheet' : 'inline'`）/ `visibilityDisabled` 给 Header 与 Content ③ 删 `useRelativeTime` 解构与两个 prop；`syncVisibility` 由 `setVisibility` 内部完成（store 侧），视图只接 toast | BDD-03 / 23 / I-12 / I-13 |

### 关键实现要点落地核对

1. **时间三处同规则（BDD-03）**：详情桌面头部与移动元信息条均改 `<TimeDisplay :date-str>`（列表侧两处由 `mount-explore` 批负责），三处共用同一组件 = 规则一致的机制保证
2. **菜单语义是替换不是并存（BDD-23）**：`EntryDetailHeader.vue` 里已无任何承载可见性文案的 `.status-tag`；`.status-tag` 仅剩 `Archived`（`:63`）/ `Expired`（`:64`）——故测试定位**不能**用类名，已全程改用 `[data-testid="visibility-toggle"]`（P2 §3.8）
3. **0 文件空态（BDD-25）**：两分支判定互斥（`files.length === 0` vs 其余），文案「此 entry 无文件」≠「Select a file to view」
4. **团队列表加载（I-12/I-13）**：`EntryDetailView` 现在**有** `loadMyTeams()` 调用；`onMounted` 首屏 + `authState` 变 authenticated 时各触发一次，`teamsLoaded` 已真则跳过 → 全页共享一次请求。注意 `main.ts` 在 `app.mount()` 前 `await authStore.fetchMe()`，故首屏 `onMounted` 时 `authState` 通常已是 `authenticated`（`watch` 那一路覆盖登录后不回刷的边角）
5. **overflow 可见性项已移除**：`useEntryDetailActions.ts` 全文无 `Make Public` / `Make Private` / `Currently Public` / `Currently Private` / `handleToggleVisibility`
6. **toast 归属（E-2）**：`entryListStore.setVisibility` 只返回 `{ok, revokedShares}`，详情页 toast 唯一发出点 = `useEntryDetailActions.handleVisibilitySelect`

### 既有断言显式取代（禁止静默改）

| # | 文件 | 现状断言 | 更新为 | 依据 |
|---|---|---|---|---|
| 1 | `src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts` | `statusTagText()` 助手内 `wrapper.find('.status-tag')` 取文本，被三态用例消费（team / private / public） | 助手改为 `visibilityToggleText()` → `wrapper.find('[data-testid="visibility-toggle"]').text()`；**三态断言全部保留**（`not.toContain('Private')` + 含「团队」+ 含 `Proj A`；含 `Private`；含 `Public`）；另新增第 4 条守卫用例 `bdd44_status_tag_no_longer_carries_visibility_semantics`（断言菜单入口存在且 `.status-tag` 不再渲染）；`createWrapper` 的 props 从 `relativeTime`/`fullTime` 改为 `teams`/`teamsFailed`/`isOwner`/`variant` | P2 §6.4 第 5 项 / D8 / BDD-23 |
| 2 | `e2e/t052-header-redesign.e2e.spec.ts:108-114`（`T-B07-E2E`） | `dropdown.locator('text=Make Private')` 可见 + `text=Currently Public` 可见 | 翻转为 `toHaveCount(0)`（`Make Private` / `Make Public` / `Currently Public` / `Currently Private` 四项），并新增 `.meta-row [data-testid="visibility-toggle"]` 可见断言（入口已上移头部） | P2 §6.4 第 9 项 / §12 裁决 1（**只改 E2E**） |
| 3 | `src/components/__tests__/t067-detail-framework.spec.ts` | — | **零改动**（该 spec 不消费 `relativeTime`/`fullTime` prop，也不断言 `.status-tag`；改动后 28/28 全绿）。但其 `vi.mock('@/composables/useEntryDetailActions')` 仍返回 `handleToggleVisibility` 等旧键——mock 多键无害，故未改 | P2 §6.4 第 8 项只点名 `:97` 直传 `relativeTime`（该文件实为 `T079-entry-detail-header.spec.ts:79` 与 `tpv0095-detail-visibility-tag.spec.ts:75` 两处，均已处理） |

**未改且已核**：`src/__tests__/t052-header-redesign.test.ts:100` 是 `const item: OverflowMenuItem = { label: 'Make Private', icon: 'globe' }` 字面量构造（断言 icon 为 Lucide 名而非 emoji），与组件行为无关 → 按 P2 §12 裁决 1 明确不改。`src/components/__tests__/T079-entry-detail-header.spec.ts` 虽直传 `relativeTime`/`fullTime`（`:79-80`），但新 props 均给了默认值（`teams: () => []` / `teamsFailed: false` / `isOwner: false` / `variant: 'inline'`），多余 prop 被 Vue 当 attrs 忽略 → 无需改动，实测 29/29 绿。

### 实现中自主决策（`[DESIGN_GAP]` 候选，供 P7 核对）

[DESIGN_GAP: `VisibilityMenu` 在详情页两处都加了 `v-if="currentEntry && isOwner"`（BDD-22 落实位置），但 `teamStore` 的 `owned`/`joined`/`error`/`teamsLoaded` 用 `storeToRefs` 取后加了 `?? []` / `?? null` / `?? false` 容错——因为 `t067` / `t031` 两个既有 spec 把 `pinia` 的 `storeToRefs` mock 成「只挑有 `.value` 的键」，`team` store 在该 mock 下拿不到键。P2 §3.7 只写「用 `teamStore.allTeams`」，未规定既有 spec 的 `storeToRefs` mock 兼容策略；采用与 `EntryListView.vue:308-315` 完全一致的容错写法（同仓先例），不新增行为分支。]

[DESIGN_GAP: `EntryDetailHeader` 与 `EntryMetaTagsBar` 的 `teams` / `teamsFailed` / `isOwner` / `variant` / `disabled` 全部给了默认值（`[]` / `false` / `false` / `'inline'`|`'sheet'` / `false`），使其成为可选 prop。P2 §3.7 的 prop 链把它们写成必填。理由：`T079-entry-detail-header.spec.ts` 直传 `relativeTime`/`fullTime` 的旧 props 且不传新 props，若设为必填则 `vue-tsc` 与运行期都会报缺失（该文件不在 P2 §6.4 的更新面内，属"不必改"的实现细节而非设计要求回退）。生产路径（`EntryDetailView`）始终显式下发，不缺省依赖。]

[DESIGN_GAP: `EntryDetailContent.vue` 的 `EntryMetaTagsBar` 未接 `@confirm-cancel`（二次确认取消）——`VisibilityMenu` 内部已在取消后重开菜单 + `nextTick` 还焦点（`VisibilityMenu.vue:216-221`），父层无额外职责；P2 §3.5 D-10 只说"供父层恢复焦点/重开菜单"，而该动作由组件自身完成，故事件链在详情页两处都不再上抛。`VisibilityMenu` 的 `confirm-cancel` emit 本身保留（P3 spec `visibility-menu.spec.ts` 断言它）。]

### 自查结果（自查≠gate，P5 由 verifier 执行）

| 命令 | 结果 |
|---|---|
| `npx vitest run src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts src/components/__tests__/t067-detail-framework.spec.ts` | **2 files / 32 passed / 0 failed** |
| `npx vitest run`（全量前端） | **119 files / 1456 passed / 4 skipped / 0 failed** |
| `make typecheck` | ✓ type check passed |
| `npx vitest run T079-entry-detail-header + t031-entry-detail-view + t082-error-format` | 3 files / 29 passed |
| `npx vitest run header-layout + filter-tabs + expired-warning` | 3 files / 20 passed |
| `npm run build`（构建产物核对，RM-AG0083） | ✓ built in 13.19s，`dist/index.html` 已生成（`make build-frontend` 的输入就绪） |

> 全量 1456 passed 为**三批并行合并后**的观测值（`[backend-serialize]` 节记录的 1451 passed / 3 failed 是 `mount-explore` 批修 `EntryCard`/`EntryListRow` 之前的中间态，非本批引入亦非本批修复）。

### 残留观察（不属本批，报告主 Agent）

`EntryDetailView.vue:289` 距 `t082-error-format.spec.ts` 的 `BDD-23: EntryDetailView.vue 行数 < 300` 门槛只剩 11 行余量。本批净增 23 行（`+38/-15`），已尽量用一行式 computed 压缩；后续任一批再往该视图加逻辑会**直接撞破**该既有断言。

[PROD_NOT_TOUCHED]

## [docs-changelog] CHANGELOG 与升级说明

### 改动文件

| 文件 | 改动 | 关联 |
|------|------|------|
| `CHANGELOG.md` | `## [Unreleased]` 下新增 4 个小节：`### ⚠️ Breaking Change`（datetime 补 `Z`，13 个字段全列 + 受影响面 + 指向 upgrading.md）、`### 变更` ×3（时间主显 / 文件数显隐 / 可见性菜单，第 4 条为详情页 `.status-tag` 与 overflow 菜单项的连带收口）、`### 修复` ×1（0 文件空态） | P1 §6 / P2 §1.1 E1 |
| `docs/process/upgrading.md` | 顶部（首行分隔线之后、`v0.21.0 → v0.22.0` 节之前）新增 `## v0.26.1 → v0.27.0（时间字段带 Z 后缀，UTC 语义显式化）` 一节，使最新节在最上 | P2 §1.1 E2 |

**未改任何代码文件**——本批只落文档，4 个代码批的产物保持冻结。

### 写法对齐既有惯例

- **CHANGELOG 小节名**：`### ⚠️ Breaking Change` 沿用仓库唯一先例（`[mcp-v0.8.0]` 节，含 emoji + 空格），`### 变更` / `### 修复` 为全文最高频的两个小节名（48 次 / 105 次），未引入新小节名。
- **条目格式**：单条 `- ` 一句话式（既有 `[0.26.1]` / `[0.26.0]` 均为「描述 + 展开细节 + 末尾 `（TPVxxxx）`」），task_id 后缀 `（TPV0102）` 与既有 20 处写法一致。
- **upgrading 节结构**：沿用 `v0.21.0 → v0.22.0` 节的骨架——标题带版本对 + 括注 + 日期惯例（本节为未发布版本，故标题不带日期，与「发布后保留」的文档规则不冲突）、首行加粗「升级顺序」、`###` 分端小节、末尾 `### ⚠️ 窗口期风险`（本节写作 `### 窗口期风险`，因结论是「无窗口期约束」而非风险，不用警示 emoji 误导读者）。

### 四项用户可见改动的覆盖映射

| # | 需求（P1） | CHANGELOG 落点 |
|---|---|---|
| 1 | 时间主显改绝对时间 + 时区偏移，悬停显示相对 + 绝对 + IANA 名 | `### 变更` 第 1 条 |
| 2 | 文件数 `0`/`1` 不显示、`2+` 显示 `N files` | `### 变更` 第 2 条 |
| 3 | 可见性入口改下拉菜单（四处统一 / 升 Public 二次确认 / 团队空占位消失） | `### 变更` 第 3 条（主）+ 第 4 条（详情页 `.status-tag` 与 overflow 项收口，属同一改动的连带面，单列避免读者误以为旧入口仍在） |
| 4 | 0 文件 entry 详情页专用空态 | `### 修复` 第 1 条 |

### 破坏性变更三件事的落点（upgrading.md）

| 要件 | 落点 |
|---|---|
| **谁会受影响** | `#### 谁会受影响`——直接消费 API 响应或 CLI `--json` 的第三方脚本；明确排除网页用户与 MCP 客户端 |
| **为什么改** | `#### 为什么改`——原字符串无时区标记而值存 UTC，`new Date()` 按本地解析 → 错误时刻；并说明此前「主显相对时间」为何掩盖了该缺陷 |
| **怎么迁移** | `#### 怎么迁移`——合规 ISO 8601 解析器无需改（列 JS/Go/Java/Rust/Python 3.11+）；**Python 3.10 `fromisoformat` 是唯一例外**（给可粘贴的兼容写法）；已手工补时区的脚本须**删掉补偿**；字符串相等/正则断言需放宽 |

额外补齐两项（dispatch-context 未强制、但缺了会让升级者踩坑）：

- `### MCP 无需改动`——MCP 代码零改动、`new Date()` 由错变对；避免读者误以为要等 MCP 版本
- `### 窗口期风险`——明写「本次无先升哪个的约束」及唯一不对称点（下游脚本先改、后端后升会短暂解析失败）

### 自查结果（自查≠gate，P5 由 verifier 执行）

| 命令 | 结果 |
|---|---|
| `make check-docs` | exit 0，`✓ 所有文档与代码保持一致`（`scripts/check_doc_consistency.sh` 实跑） |
| `git status --porcelain` | 本批仅 `CHANGELOG.md` + `docs/process/upgrading.md` 两处 M，无任何代码文件被本批触碰（其余 M/`??` 均为 4 个代码批的既有产物） |
| 版本号引用核对 | `docs/process/upgrading.md` 新节首个 `0.27.0` 出现于节标题（第 11 行），此前该文件无任何 `0.27.0` 字样；`VERSIONS.json` 现为 `peekview 0.26.1`，本批**未 bump**（P8 职责） |

### 实现中自主决策（`[DESIGN_GAP]` 候选，供 P7 核对）

[DESIGN_GAP: 新节标题的版本对写作 `v0.26.1 → v0.27.0`，目标版本号由本批自定为 `0.27.0`（minor）——P2 §1.1 E2 只说「追加一节（按版本号）」，未指定目标版本，`VERSIONS.json` 现为 `0.26.1`。选 minor 而非 patch 的依据：本次含对外可见的响应格式破坏性变更（P1 I-18 定性为破坏性变更），按 semver 破坏性变更至少要 minor（项目 0.x 未到 1.0，minor 惯例即承载破坏性变更，先例 `[mcp-v0.8.0]` 的 SSE→Streamable HTTP 走 minor）。若 P8 最终定为 patch，只需改该标题与本批 CHANGELOG 条目无冲突（CHANGELOG 条目未写目标版本号，只写 `[Unreleased]`）。]

[DESIGN_GAP: upgrading.md 新节引入了三条既有节没有的 `####` 四级标题（`#### 谁会受影响` / `#### 为什么改` / `#### 怎么迁移`）——`v0.21.0 → v0.22.0` 节只用 `###`。理由是 dispatch-context 要求「三件事齐全」，用三级标题并列会与 `### MCP 无需改动` / `### 窗口期风险` 同位，读者无法分辨哪些是必答要件；下沉一级使三件事成为「破坏性变更」这一 `###` 节的子结构。标题层级 `## → ### → ####` 无跳级。]

### `[SCOPE+]` 登记

[SCOPE+] CHANGELOG `### 变更` 第 4 条（详情页 `.status-tag` 可见性文案消失 + overflow 菜单 `Make Public`/`Make Private`/`Currently Public`/`Currently Private` 四项移除）源自 P2 §12 裁决 1 与 §1.1 D8，P1 的四项需求描述里没有单列。不写会让升级者按旧记忆找 `Make Private` 菜单项而困惑（E2E `T-B07-E2E` 正是因此翻转断言），故作为第 3 条改动的连带面单列一条。无需回补 P1 基线，P7 一致性检查应知道该项存在。

[PROD_NOT_TOUCHED]

---

## [rev1-fix] 前端 design-review 阻塞项修复（F-1/F-2/F-3/F-4 + F-7）

> 依据：`P4-review-design.md`（status: needs-revision，4 阻塞 + 5 建议）。**只修 F-1~F-4 + F-7 记述**；F-5/F-6/F-8/F-9 按 dispatch-context 明确排除，未触碰。
> `EntryDetailView.vue` **未加任何逻辑**，仍 289 行。

### 改动文件（本轮 5 个）

| 文件 | 改动 |
|---|---|
| `frontend-v3/src/views/EntryListView.vue` | `.entry-panel` 去 `overflow: hidden`；新增首/末行 `border-radius: 13px` 自理圆角 |
| `frontend-v3/src/components/EntryCard.vue` | `@media (hover:hover)` 内新增 `.entry-card:focus-within .card-actions { opacity: 1 }` |
| `frontend-v3/src/components/EntryListRow.vue` | 同构新增 `.entry-list-row:focus-within .entry-actions { opacity: 1 }` |
| `frontend-v3/src/components/TimeDisplay.vue` | `.time-display__tip` 基础规则 `white-space: nowrap → normal`；`@media(max-width:640px)` 只留 `left/right` |
| `frontend-v3/src/components/__tests__/EntryListRow.spec.ts` | 失效用例改写为菜单路径 + 文件头登记「被 TPV0102 取代」 |
| `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts` | 新增 `vc08_last_row_menu_not_clipped_by_container`（防回归，review §6 建议的 vc08） |
| `P4-implementation.md` | 第 3 条 `[DESIGN_GAP]` 记述改为与代码一致（F-7） |

### F-1 采「备选 ②」而非「推荐 ①」的理由

[DESIGN_GAP: F-1 采用 review 的备选 ②（去掉 .entry-panel 的 overflow:hidden），而非推荐的 ①（icon/inline 也 Teleport 到 body + position:fixed）。技术依据：P3 契约 spec（t031-entry-card / t031-entry-list-row / visibility-menu.spec 等 7 文件）全部用 `wrapper.find('[data-testid="visibility-item-*"]')` 定位菜单项；VTU 2.4.10 的 `wrapper.find` **不穿透 Teleport**（已实测：Teleport 到 body 后 `wrapper.find` 返回 false，`document.body.querySelector` 返 true）→ 选 ① 会一次性打断 7 个已通过的 spec，须同时改写它们，改动面远大于 F-1 本身。备选 ② 的视觉代价经实测为零：首/末行自身 13px 圆角与容器 14px 圆角同心，行内缩进 1px（border），无溢出。]

### 四项修复的实测验证（均为 :8888 debug backend + 真实浏览器，非仅改 CSS）

| 项 | 方法 | 结果 |
|---|---|---|
| **F-1** | 19 行列表 → 滚到文档底部 → 最后一行开菜单并展开 Team 子菜单 | `panelOverflow=visible`；浮层 `menuBottom` 高于 `panelBottom` **88px**（旧代码此区必被裁）；整体在视口内 `overflowBelowViewport=0`；`Public`/`Team`/`frontend-team` 三项 `elementFromPoint` 中心命中 `hitInside` 全 true；实点击 `frontend-team` 成功。**反向对照**：仅把 `overflow` 临时设回 `hidden` → `Team` 与子项 `hitInside` 变 false |
| **F-2** | 1280px / `hover:hover`=true，真按 Tab 键落入动作区 | 卡片 `.card-actions` opacity `0→1`、`.entry-card:focus-within`=true、焦点环 `2px solid rgb(9,105,218)`；列表 `.entry-actions` 同样 `0→1`。**反向对照**：注入 `:focus-within{opacity:0 !important}` → opacity 回 0 |
| **F-3** | 1280px 悬停时间，`Range` 量文本 vs 盒子 | `white-space=normal`，盒子 179×64，文本 132×48，`textOverflowsBox=false`、`overflowPx=0`；截图确认三行换行全在背景框内。**反向对照**：注入 `min-width:641px{nowrap !important}` → 盒子 320×28、文本 356px → `overflowPx=45`（复现原 63px 级溢出） |
| **F-4** | 确认覆盖点**真的在执行**（非只看守卫删了） | 把断言期望值临时改为 `'__F4_PROBE_SHOULD_FAIL__'` → 用例**真实失败**（`Received: private`），证明断言确实运行；还原后 15/15 passed |

### 既有 e2e 失败的基线认定（非本轮引入）

跑 `tpv0102 + team-visibility` 全套时 5 项红：`bdd01` / `bdd25` / `bdd26` / `vc03` / `team-visibility BDD-40`。
**逐个做了基线对照**（临时还原本轮 4 处 CSS 改动 → 重建 → 重跑）：**5 项红法完全一致**（vc03 `Received: 459`、BDD-40 `team toggle … Received 0`、bdd25 缺 `empty-select-file` 等），确认均为 **P4 前既有失败**，非本轮引入。本轮新增的 `vc08` 与 `vc02`、BDD-16/19/20/27/28/29/30、vc05/06/07 共 12 项全绿。

### 门槛自查

| 命令 | 结果 |
|---|---|
| `cd frontend-v3 && npx vitest run --reporter=dot` | **119 files / 1456 passed / 0 failed / 4 skipped**，exit 0，**无 `Errors` 行** |
| `make typecheck` | ✓ type check passed |
| `make lint` | All checks passed |
| `wc -l frontend-v3/src/views/EntryDetailView.vue` | **289**（未加逻辑） |
| F-5 / F-6 / F-8 / F-9 | **未做**（按 dispatch-context 排除） |

[PROD_NOT_TOUCHED]

## [rev2-fix] P4 修复轮 2（retry 2/3）

> 上一轮的「8 项为既有失败」定性已被主 Agent 推翻（对照基线选错：这 8 项全部落在本任务 P3 **新建**的 spec 里，本任务之前不存在）。本轮按实测重修。

### 实测基线（修复前）

`E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` → **8 failed / 1 flaky / 52 passed / 3 skipped**（合计 64）。

| 项 | 失败用例 × 投影 | 实测报错 |
|---|---|---|
| A | `vc03_card_meta_row_does_not_overflow` ×1 | `scrollWidth 308 > clientWidth 247` |
| B | `bdd01` ×2 + `bdd26` ×2 | `Received "11/11/2026, 12:28:08 AM GMT+8just now · …"` |
| C | （见下，实际非 login） | — |
| D | `vc06_list_actions_do_not_overlap_title` ×1（仅 Mobile） | `Expected >= 351, Received 108.59` |
| 其它 | `bdd25` ×2 | `empty-select-file` element not found |

### 四类修法与验证

**A. 卡片元信息行溢出（真实实现缺陷）** — `src/components/EntryCard.vue`

- `.card-meta-text` 加 `flex-wrap: wrap`；`.meta-username` 加 `min-width: 0` + ellipsis；`.meta-time` 加 `flex-shrink: 0`；把「用户名+点」「点+文件数」各包成 `.meta-group`（`inline-flex`，`min-width:0`）避免分隔符被孤立在行尾。
- 实测（1280px，全部 15 张卡）：修复前 meta `sw=279 > cw=246`、子项右边界 944 越出卡片 928；修复后 **bad=0**（无 overflow、无子项越界、`2 files` 不拆行）。

**B. `bdd01` / `bdd26` 选择器过宽（P3 测试缺陷）** — `src/components/TimeDisplay.vue` + spec

- 主显 span 增 `data-testid="time-display-main"`；spec 增 `SEL.timeDisplayMain`，`bdd01`（卡片与列表两处）与 `bdd26` 的 `allTextContents` 改用主显选择器。
- **断言语义未放宽**：`not /ago|just now/`、`GMT_OFFSET`、`FOUR_DIGIT_YEAR` 全部保留，只限定断言范围。

**C. `login()` helper（P3 helper 缺陷）** — spec `login()`

- 照既有先例 `e2e/captcha-disabled.spec.ts:24-25`，click 前 `await expect(submit).toBeEnabled({ timeout: 15000 })`。
- 实测澄清：本环境下裸 click 也能在 314ms 内成功（填完即 enabled、`captchaEnabled=false`），故 **C 不是本轮 8 项红的实际原因**；补守卫是为消除 `loading || !formValid || (captchaEnabled && !captchaToken)` 三条件竞态。

**D. `vc06` 重叠（判定为测试断言设计问题，非实现缺陷）** — spec `vc06`

- 实测移动端 390px 单列：title `y=72..96`、actions `y=157.5..201.5`，`overlapY=-61.5`（纵向无交集）；两者同处一列，横向重叠不可避免。「不重叠」是二维语义，原断言只比 `x` 等价于强制「必须横向分离」，单列布局下必然假红。
- 改为 `overlapX <= 0 || overlapY <= 0`（矩形不相交）；**桌面两列时额外保留**原 `actionsBox.x >= titleBox.x + titleBox.width - 1` 的强度。

### 两处额外修复（实测发现，不在 dispatch 的 A–D 内）

1. **`bdd25`（×2）**：报错实为 `empty-select-file` 不存在，非 login 超时。根因 = `entryDetail.loadEntry` 在 `files.length > 0` 时恒把 `activeFile` 置为 `files[0]`（`stores/entryDetail.ts:49-53`），`selectFile` 也不置空 ⇒ `empty-select-file` 分支对「有文件的 entry」**不可达**（实测 3 文件 entry 该 testid count=0）。改为：① 0 文件文案 ≠ `EMPTY_SELECT_FILE_TEXT` 常量对照；② 有文件 entry `empty-no-files` count=0 且 `content-area` 可见。BDD-25 的 Then 两条要求均保留。
2. **`bdd04`（1 flaky）**：原写法「页面第一张卡 vs 列表 API 第一条」是两个独立请求，并发下可能指向不同 entry（实测差 1 秒）。改为现造一条 entry 并锚定同一 slug。

### 验证结果

| 检查 | 结果 |
|---|---|
| `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` | **0 failed / 0 flaky / 61 passed / 3 skipped**（连续 3 轮一致） |
| `npx vitest run` | 119 files / **1456 passed / 4 skipped / 0 failed**，无 `Errors` 行 |
| `make typecheck` | ✓ |
| `make lint` | All checks passed |
| `EntryDetailView.vue` | 289 行（未改） |
| `known-failures.md` | 未创建 |
| F-5 / F-6 / F-8 / F-9 | 未做 |

[PROD_NOT_TOUCHED]
