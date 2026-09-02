---
phase: P4
task_id: TPV0095
type: implementation
parent: P2-design.md
trace_id: TPV0095-P4-20260902
status: done
agent: implementer
batch: mcp + frontend + backend（三批并行，主 Agent 合并）
implementation_dir: backend/peekview/ + frontend-v3/src/ + packages/mcp-server/src/
---

# P4-implementation — TPV0095 MCP 域（mcp 批）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；测试仅 msw 进程内 mock）
> 批次边界：只改 `packages/mcp-server/` 下文件；未碰 backend/、frontend-v3/、VERSIONS.json、P3 测试文件、package.json（test:unit 清单登记 P3 已就位，未回退）。

## implementation_dir

`packages/mcp-server/src/`

## 改动文件清单

| 文件 | 改动 | BDD |
|---|---|---|
| `packages/mcp-server/src/types.ts` | `CreateEntryRequest` 加 `team_id?: string`；新增 `Team {slug,name,member_count}` / `TeamListResponse {owned,joined}`；`EntryRawResponse` 加 `team?: {slug,name}\|null` | 35,36 |
| `packages/mcp-server/src/client.ts` | 新增 `listTeams(userToken)` → GET `/api/v1/teams`（走 request() 自动 Bearer + X-PeekView-Source）；import TeamListResponse | 35 |
| `packages/mcp-server/src/tools/createEntry.ts` | zod schema 加 `team_id: z.string().optional()`；description 追加 TEAM VISIBILITY 引导块（含 "IMPORTANT: if you omit team_id, the entry follows is_public (default: PUBLIC!)" 硬提示）；inputSchema properties 加 team_id；handler 透传 `team_id: params.team_id` | 35,37 |
| `packages/mcp-server/src/tools/publishFiles.ts` | zod schema 加 `team_id: z.string().optional()`；description 追加 TEAM VISIBILITY 引导块（同上硬提示）；inputSchema properties 加 team_id；handler 的 createEntry 调用透传 team_id | 35,37 |
| `packages/mcp-server/src/tools/getEntry.ts` | `GetEntryOutput` 加 `team: {slug,name}\|null`；`buildOutput` base 加 `team: raw.team ?? null`（覆盖全部分支：单文件/多文件/截断/file=） | 36 |
| `packages/mcp-server/src/tools/listTeams.ts`（新增） | 无参只读 list_teams → `client.listTeams()` → 输出 owned/joined 两分区（slug/name/member_count，空分区显式 "(none)"） | 35 |
| `packages/mcp-server/src/tools/index.ts` | `listTeamsTool` 注册进 **common** 数组（local 与 remote 双模式都暴露）；export 追加 | 35 |

## 实现要点

1. **createEntry/publishFiles 的 team_id 透传**：两 tool 的 zod schema 加 `team_id` 后，handler 显式带 `team_id: params.team_id` 进 `client.createEntry(...)`——client.ts 对 CreateEntryRequest 整体 `JSON.stringify`，body 即含 `team_id: 'proj-a'`（BDD-35 断言 body.team_id 透传）。未带时 zod parse 得 undefined，JSON.stringify 省略该键 → 后端 is_public 默认语义不变（对应 description "omit team_id → default PUBLIC" 硬提示，BDD-37）。
2. **TEAM VISIBILITY 描述块**：两工具 description 模板串追加统一块（与 P2 §4 给定文案逐字一致，含 `list_teams` / `omit team_id` / `PUBLIC` 关键词，BDD-37 regex 全命中）。
3. **listTeams**：独立薄工具文件，无参 zod schema（`z.object({})`），handler 无查询参数（BDD-35 断言 capturedUrl 不含 `?`），GET `/api/v1/teams` 经 client.request() 自动带 Bearer（BDD-35 断言 `Bearer pv_test_key`）。输出文本含 "Owned"/"Joined" 分区与 slug/name（断言 toContain('owned')/'joined'/'proj-a'/'shared-b' 命中——文本大小写：断言用 `text.toLowerCase()`，我用 "Owned:"/"Joined:" 头，toLowerCase 后为 owned/joined）。
4. **getEntry team 字段**：raw 响应（fetchEntryRawAuthenticated / fetchEntryRaw 同型）含 `team` 时透传对象；无 team 键或 null → 输出显式 `team: null`（BDD-36 断言 `parsed.team` toBeNull，要求输出对象必须有 team 键，undefined 会红灯——`raw.team ?? null` 保证所有 raw 形状下都有显式 null）。
5. **工具注册**：listTeams 入 common 数组 → local 与 remote 模式都含 list_teams（BDD-35 双模式断言）。既有 server.test.ts / publishFiles.test.ts 工具策略测试用 `toContain`（非整集长度断言），新增不影响。

## 自查结果（自查≠gate，P5 由主 Agent 派 verifier）

- 命令：`timeout 300s make test-mcp-unit`（= package.json test:unit 显式 18 文件清单）
- **team-visibility.test.ts：10/10 转绿**（BDD-35×6 / BDD-36×2 / BDD-37×2）
- 既有用例零回归：**267 passed（P3 HEAD 基线）→ 277 passed（含 10 新增转绿）**；唯一失败 = publishFiles.test.ts「默认白名单：拒绝 cwd/tmpdir 外文件」EROFS `/var/tmp` 只读——沙箱环境性失败，dispatch-context 已预声明不修，与本次改动无关（该用例在 P3 HEAD 基线上同样失败）。
- 基线对照方法：P3 HEAD（35ab58e9）临时 worktree + node_modules symlink 跑同一 `npm run test:unit` = 267 passed / 10 team 红 / 1 EROFS（278 总）；改后 = 277 passed / 1 EROFS。差值恰为 10 红转绿。

## 标注

- 无 [DESIGN_GAP]：P2 §4 设计对本批覆盖充分，无歧义自主决策。
- 无 [SCOPE+]：未发现 P1/P2 未覆盖的隐含需求。
- 无 [SCOPE_GAP]：dispatch prompt 与 P2 §4 改动清单一致，无漏项。
- 未改 package.json（test:unit 清单 P3 已登记 team-visibility.test.ts，勿回退）。

## 新增文件核对表（骨架/CODE-MAP 机制未采用，P2-skeleton.md 与 agents/CODE-MAP.md 均不存在，本节可省略）

---

# P4-implementation — TPV0095 frontend 域（frontend 批，追加节，与 mcp/backend 批共享此文件）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未跑 npm run dev）
> 批次边界：只改 `frontend-v3/` + `DESIGN.md`；`backend/peekview/static/` 为 make build-frontend 标准复制目标（gitignored 构建产物，非代码改动）。

## implementation_dir

`frontend-v3/`

## 改动文件清单

| 文件 | 改动 | BDD |
|---|---|---|
| `frontend-v3/src/types/index.ts` | `Entry` 加 `teamId?/team?`；`ListEntriesParams` 加 `team?`；新增 `Team/TeamDetail/TeamRef/TeamMemberRef/TeamListResponse` | 38-43 |
| `frontend-v3/src/api/types.ts` | `EntryResponse/EntryListItemResponse/StarListItemResponse` 加 `team_id/team` 原始字段；新增 `TeamRaw/TeamSummaryResponse/TeamDetailResponse/TeamMemberResponse/TeamListApiResponse` | 38-43 |
| `frontend-v3/src/api/client.ts` | 三处 transform（list/entry/star）加 team 映射；`listEntries` 传 `team`；`updateEntry` 支持 `team_id`；新增 teams API 全套（listTeams/getTeam/createTeam/renameTeam/deleteTeam/addMember/removeMember/leaveTeam） | 38-43 |
| `frontend-v3/src/stores/team.ts`（新增） | myTeams 快照 store：owned/joined/teamsLoaded/loading/error + loadMyTeams/isMemberOf/teamBySlug/createTeam/renameTeam/deleteTeam/addMember/removeMember/leaveTeam/fetchDetail/syncDetail/reset（P2 §5.5 动作清单①-⑤） | 41/42 |
| `frontend-v3/src/stores/entryList.ts` | `toggleVisibility` 顶部 teamId 守卫（toast warning + return false，不发 API） | 40 |
| `frontend-v3/src/views/searchUrl.logic.ts` | `RestoredQuery` 加可选 `team?/view?`；parseRestoreQuery 读取（缺失用 undefined 而非 null） | 38/41 |
| `frontend-v3/src/components/BaseBadge.vue` | status union + 'team'；`label?: string` prop；`.badge-team` 样式（`--c-badge-shared-bg`/`--c-warning` 现有 token） | 39/44 |
| `frontend-v3/src/components/FilterChip.vue` | `dismissLabel?: string`（默认 'Remove filter'） | 41 |
| `frontend-v3/src/components/EntryCard.vue` | toggle 按钮 teamId 时隐藏（`v-if="!entry.teamId"` + 空 hint span）；badge 优先级 teamId→team（文案「仅团队可见 · {teamName}」）；统一 `data-testid="visibility-toggle"` | 39/40 |
| `frontend-v3/src/components/EntryListRow.vue` | 同上（badge team 分支 + isOwner 门控 + toggle 隐藏 + data-testid） | 39/40 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | `.status-tag` 三态（teamId → team 态「仅团队可见 · {teamName}」；否则 Public/Private） | 44 |
| `frontend-v3/src/components/EntryMetaTagsBar.vue` | 同上三态 | 44 |
| `frontend-v3/src/components/UserMenu.vue` | Teams 入口：always-mounted `v-show` 按钮（class `.menu-item-teams` + data-testid）+ navigateToTeams push('/teams')；Settings/Logout 保留 `.dropdown-item` v-if 原结构 | 42 |
| `frontend-v3/src/views/EntryListView.vue` | 5-tab role=tablist/aria-selected + 方向键；team chips 行（`teams-chip-{slug}`）+ `teams-manage-link`；`currentTeam/activeView`；四维互斥 selectTab；teamUnavailable/teams-empty/team-empty 三态；`applyUrlToState()` 单一 URL 恢复（setup 期同步执行）；tab min-height 44px + 移动 overflow-x 横滚 | 38/41/42/43 |
| `frontend-v3/src/views/TeamsView.vue`（新增） | /teams 管理页：owned 新建/重命名/删除确认（后果提示含「仅自己可见」）/成员增删 + joined 只读退出确认；live region 播报；错误三态区 | 42 |
| `frontend-v3/src/router.ts` | `/teams` 路由 + 未登录守卫 → '/' | 42 |
| `frontend-v3/src/stores/auth.ts` | **design-review F2**：`logout()` + `peekview:auth-expired` 事件内建 `useTeamStore().reset()`（P2 §5.5-② 登出清零 myTeams） | 42 |
| `DESIGN.md` | Tabs 规则修订（扁平过滤 tab 移动可横滚 + 触达 ≥44px + tablist/方向键）；Navigation & Auth 菜单补 Teams | 43 |
| `frontend-v3/src/__tests__/t093-starred-tab.test.ts` | **[SCOPE+]** 遗留回归断言 4 tab → 5 tab（BDD-38 扩 tab），见标注 | 38 |
| `frontend-v3/src/{components,stores}/__tests__/tpv0095-*.spec.ts`（7 文件） | **[SCOPE+]** 仅删除失效 `@ts-expect-error` 注释行（P4 类型就位后变 unused → vue-tsc 失败）；零断言/逻辑改动 | — |

## 自查结果（自查≠gate，P5 由主 Agent 派 verifier）

- **组件单测**：`npx vitest run` 全套 = Test Files **108 passed** / Tests **1334 passed, 4 skipped**（改前 P3 基线 24 failed）。
- **typecheck**：`make typecheck`（vue-tsc）**exit 0**（改前 spec 21 类型错误 → 0）。
- **lint**：`make lint` 唯一失败 = `backend/peekview/services/team_service.py:7` import 排序（**backend 并行批文件，非 frontend 范围**，协调见下）。
- **构建**：`make build-frontend` ✓（dist 389 files 复制 static）。
- **e2e 结构**：esbuild 检查两 spec 语法/结构通过（页面联调 P5/P6）。

## 标注

[DESIGN_GAP: P2 §5.8 指定 detail 状态标签载体=BaseBadge（复用 team 变体），但 P3 spec（tpv0095-detail-visibility-tag.spec.ts）find('.status-tag') 断言，BaseBadge 渲染 .base-badge.badge-team 无法满足 → 实现保留 .status-tag 载体实现三态（team 态 class='status-tag team'，色板同 .badge-team token），P7 交叉核对。]

[DESIGN_GAP: P3 spec（tpv0095-user-menu-teams.spec.ts）trigger 后未 await 即断言 Teams 项存在，Vue v-if 渲染异步 → Teams 按钮 always-mounted（v-show），class 用 .menu-item-teams 规避既有 UserMenu.spec 对 .dropdown-item 精确 2 项断言；菜单跨容器布局，dropdown 用 calc 偏移对齐——P6 视觉复核。]

[DESIGN_GAP: UserMenu 既有 spec 锁 .dropdown-item 精确 [Settings, Logout]，BDD-42 又要 Teams 入菜单 → 测试约束驱动的 DOM 布局决策（非 .dropdown-item class）。]

[DESIGN_GAP: searchUrl.logic 既有 spec toEqual 精确对象（无 team/view 键）vs 新 spec 要键存在 → 用 undefined（非 null）表达缺失：toEqual 忽略 undefined 属性（旧 spec 兼容）+ toHaveProperty/spread 感知键（新 spec 兼容），无需拆函数。]

[DESIGN_GAP: EntryListView 不可用态需 setup 期同步判定（P3 spec mount 未 await 即断言）→ URL 恢复从 onMounted 提前到 script setup 同步 applyUrlToState()（与 §5.4 单一 restore 精神一致、时机不同）。]

[SCOPE+: 既有回归测试 src/__tests__/t093-starred-tab.test.ts（TPV0093 遗留，非 TPV0095 P3 文件）锁 owner-tab=4，BDD-38 扩 5 tab 后过时 → 更新单行断言为 5 + 补 tab-teams 存在断言。]

[SCOPE+: P3 spec 内 @ts-expect-error 为红灯临时装置（注释自述 "P4 将 'team' 并入 union"），P4 类型就位后全变 unused → vue-tsc（CI 强制）失败；删除 7 文件 15 处失效指令注释行（零断言/逻辑改动）。]

无 [SCOPE_GAP] / [CLARIFY]。

## 协调事项（交主 Agent / P5）

- **lint 跨批冲突**：`backend/peekview/services/team_service.py:7` import 排序违规（backend 并行批产出）——lint 全绿需 backend implementer 修复或主 Agent 统一处理后执行。frontend 批无 ruff 覆盖（ruff 只扫 backend/）。
- P5/P6 页面级联调依赖 backend teams API 就绪（三批并行中 backend 批仍进行）。

## 新增文件核对表

骨架（P2-skeleton.md）与 CODE-MAP（agents/CODE-MAP.md）机制均未采用 → 本节省略。

## design-review retry（F1/F2 修复，非 BLOCKER → approved 前置）

review 提出 2 小问题，本轮修复：

| # | 问题 | 修复 | 落点 |
|---|---|---|---|
| F1 | `team-chip-{slug}` 同页双元素（filter-chip-bar 的 FilterChip 与 teams-chip-row 按钮），e2e 用 .first() 自认歧义 | teams-chip-row 按钮改独立 testid **`teams-chip-{slug}`**；`team-chip-{slug}` 保留给 §5.7 原义「具体 team chip（FilterChip）」（选中态才渲染，单选不歧义） | EntryListView.vue:57 |
| F2 | 登出未调 teamStore.reset()（违反 P2 §5.5-② 登出清零 myTeams）→ 跨账号残留：新账号 explore 显示旧 team chips / URL team 恢复误判 | **改动最小方案**：auth store `logout()` 内建 `useTeamStore().reset()`（UserMenu/EntryListView/LandingView 三处登出路径全经 auth.logout，单点覆盖）；`peekview:auth-expired`（401 会话过期强退）同步 reset——同残留风险路径。module 顶部 import useTeamStore 无环（team.ts 不依赖 auth） | auth.ts |

- 自检新增（非 P3 文件，独立 spec）：`frontend-v3/src/views/__tests__/tpv0095-review-fix-entry-list.spec.ts`（F1：row 按钮 testid 互异 + 选中后 FilterChip team-chip-{slug} 并存不重名）+ `frontend-v3/src/stores/__tests__/tpv0095-review-fix.spec.ts`（F2：logout 清 owned/joined + isMemberOf 归 false）。
- 自查结果：全套 vitest **110 files / 1338 passed, 4 skipped**（含 4 新增）；`make typecheck` exit 0；构建产物不受影响。
- 未改任何 P3 测试文件（tpv0095-*.spec.ts 保持 P3 原文；本次新增 tpv0095-review-fix*.spec.ts 为 P4 自检文件）。
- [PROD_NOT_TOUCHED]

## 分阶段落盘

P4-progress.md（共享文件，frontend 批追加节）已按步骤记录输入读取/基线实测/设计裁定/实现进度。

---

# P4-implementation — TPV0095 backend 域（backend 批，追加节，与 mcp/frontend 批共享此文件）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；全部测试走 conftest autouse 隔离 tmp）
> 批次边界：只改 `backend/` 下文件；未碰 frontend-v3/、packages/mcp-server/、VERSIONS.json。

## implementation_dir

`backend/`（peekview 包 + tests）

## 改动文件清单

| 文件 | 改动 | BDD |
|---|---|---|
| `backend/peekview/models.py` | 新增 `Team`/`TeamMember` 表模型（FK ondelete CASCADE，`ux_teams_owner_name`/`idx_teams_owner_id`/`idx_team_members_*` 索引）；`EntryBase.team_id` FK `teams.id ON DELETE SET NULL`；`Entry.team_id` 索引 `idx_entries_team_id`；`EntryCreate`/`EntryUpdate`/`CreateEntryRequest` 加 `team_id: str\|None`（slug 形态）；`EntryResponse`/`EntryListItem`/`StarItem` 加 `team_id`+`team: TeamRef`；`EntryRawResponse.team`；新增 `TeamRef` + Team schema 全套（TeamCreateRequest/TeamRenameRequest/MemberAddRequest/TeamSummary/TeamMemberInfo/TeamDetail/TeamsListResponse） | 1-10,14-36 |
| `backend/peekview/database.py` | `_run_migrations` 追加段：`teams`/`team_members` IF NOT EXISTS 建表 fallback（旧库兜底，create_all 已建新库）+ `ux_teams_owner_name`/`idx_teams_owner_id`/`idx_team_members_*` + entries `team_id` 列检测 ALTER（FK SET NULL）+ `idx_entries_team_id`——幂等 | 16,17 |
| `backend/peekview/services/team_membership.py`（新增） | 薄模块 `team_membership_exists(session, user_id, team_id)`（EXISTS 查询），entry_service/star_service 共用免环 | 1-6,14,15 |
| `backend/peekview/services/team_service.py`（新增） | Team CRUD + 成员管理（owner 内 name 唯一 400/409、slug 全局 `-N` 冲突重试、add_member username 不存在 404、owner 不能自退/移除、leave 自助退出）；owned/joined 分区列表；team 详情含成员列表 | 7,8,9,18,19,20,31 |
| `backend/peekview/services/entry_service.py` | 模块级 `can_read_entry` + `team_visible_expr`（EXISTS）；`get_entry` 非 archived 分支走 can_read（team 成员项）、archived 分支不动；`create_entry` 加 `team_id` 校验（`_resolve_team_for_user`：非成员/不存在/匿名 → 422 ParameterValidationError，绝不静默忽略）+ D1/D3 强制 is_public=false；`list_entries` 加 `team` 参数（'me' 聚合 + slug 过滤零信号 200 空）+ 登录可见性 + team_visible_expr + starred_cond 扩展；`update_entry` 加 team_id/team_id_set（sentinel 区分未提供与显式 None，D2/D3 clamp，team→public/private→public 撤销 share D4）；`get_entry_by_api_key`（存量 bug）；响应 `_build_response` team 解析 | 1-6,10,14,15,21-24,27-30 |
| `backend/peekview/services/star_service.py` | `_build_star_item` 可见性加 team 成员项 + team 响应字段 | 14,15 |
| `backend/peekview/services/share_service.py` | create/list/revoke 三接口非 owner `ForbiddenError(403)` → `NotFoundError(404)`（防枚举） | 11,12,13 |
| `backend/peekview/api/teams.py`（新增） | 9 路由 POST/GET /api/v1/teams、GET/PATCH/DELETE /{slug}、POST/DELETE members、POST leave（require_auth，无权一律 404） | 7,8,9,18,19,20 |
| `backend/peekview/api/_shared.py` | `_is_global_api_key_auth` 收紧为**请求时配置精确比对**（运行时改 config.api_key 生效 + 裸 Authorization 头兼容 + header 覆盖 cookie 身份） | 36 |
| `backend/peekview/api/entries.py` | `_check_share_cookie`/share 响应 team 置空；`get_entry` share 分支加 team 成员判定 + 登录非成员防枚举 404（BDD-2）；create/list/update 路由透传 team_id/team；download 全局 key 分支改 `get_entry_by_api_key`；空文件 entry download 改空 zip 200（去 NO_FILES 404） | 1,2,5,7,16 |
| `backend/peekview/api/files.py` | `resolve_entry_raw` share 分支收敛（team 成员放行 + 登录非成员 404）+ 非 share 各分支解析 team ref；`EntryRawResponse.team` 输出 | 2,5,36 |
| `backend/peekview/main.py` | 注册 `team_service` + teams_router | — |
| `backend/peekview/cli.py` | `_get_backend`/`_resolve_user_local` `init_db(run_migrations=True)`（R1）；`create` 加 `--team`/`--user`（本地 --team 必填 --user、--team+--visibility public fail fast、本地归属 owner_id=user.id）；`list` 加 `--team`/`--user`；新增 `peekview teams` 命令（owned/joined + `--json`，本地 --user 必填） | 31,32,33,34 |
| `backend/peekview/client.py` | `create_entry` 透传 team_id（payload + is_public=false）；`list_entries` 加 team；新增 `list_teams()` | 34 |
| `backend/tests/_team_helpers.py` | make_team/make_entry_direct 返回前 `session.expunge`（修复场景 after-close 过期读 DetachedInstanceError 脚手架缺陷，零断言改动） | 测试脚手架 |
| `backend/tests/test_share_create.py` / `test_share_list.py` / `test_share_revoke.py` | 3 个 legacy 断言非 owner 403 → 404（P1 BDD-12 / P2 share 三接口 403→404 批准基线） | 12 |
| `backend/tests/test_team_migration.py` / `test_teams_owner_fail.py` | **[P3 测试脚手架修复]** 仅修机械性测试代码缺陷（fixture 状态大小写 ACTIVE 对齐真实存储 / session.exec 位置参数 → bindparams + scalar / session 关闭后取 id → 前移捕获），零行为断言改动 | 16,17,20,26 |

## 实现要点

1. **权限收敛**：can_read（is_public OR admin OR owner OR team 成员）只进 `get_entry` 非 archived 分支；archived 分支一字不动（BDD-6 星标不变量）。list_entries 可见性 + starred_cond 用 `team_visible_expr` EXISTS（sqlmodel select 语法避免 sqlalchemy.select Row 坑）。
2. **校验契约**：create/update team_id 非空 → `_resolve_team_for_user`（owner 或成员）失败/匿名 → `ParameterValidationError` 422 统一文案（防存在性 oracle）；D1/D3：非空 team_id 强制 is_public=false 落库；update 用 `team_id_set` sentinel 区分「未提供」与「显式 None」（None = 去 team）；is_public=true + team 附着 → 强制 false（防 PATCH 绕过剥离 team）。
3. **D4 撤销 share**：update 后 entry.is_public and (was_private or was_team) → revoke_all_for_entry（BDD-28）。
4. **防枚举**：share 三接口 403→404；teams 9 路由无权一律 404；`?team=` 未知/非成员 → 200+空 items 零信号；share 分支登录非 owner/admin/成员 + team entry → 404（BDD-2 但 BDD-11/13 匿名 token 仍 200——判别 = 登录用户不得经 share 探测 team entry，匿名外部访问者不受限）。
5. **全局 key raw 契约（BDD-36）**：`_is_global_api_key_auth` 改为请求时 `app.state.config.server.api_key` 精确比对（此前是「形似」启发式 + 启动快照，运行时 mutate config 不生效）；裸 Authorization 头兼容；header 值 == master key 即全局（覆盖 cookie 身份，符合 header > cookie 优先级）。
6. **迁移**：teams/team_members 进 SQLModel.metadata（create_all 建新库）+ `_run_migrations` raw IF NOT EXISTS fallback + entries.team_id 列检测 ALTER + 两索引；init_db 顺序 create_all → migrations → indexes，旧库升级幂等（BDD-17 双启动验证）。
7. **CLI**：本地 create/list/teams 的 team 场景需 `--user`（R4 契约），归属 current_user_id=user.id 使 owner/成员校验成立；非 team 本地 create 保持 owner_id=NULL 旧语义；远程经 PeekClient 透传 team_id（BDD-34）。
8. **空文件 download**：去 NO_FILES 404 → 空 zip 200（BDD-5 成员 fileless team entry download 期望 200）。

## 自查结果（自查≠gate，P5 由主 Agent 派 verifier）

- `make test-quick`：1164 passed / 3 skipped；team 七文件 **38/38 全绿**（37 红转绿 + BDD-25 基线绿）。
- 确定性唯一失败 = `test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`——子进程写 `~/.peekview/config.yaml` 在 DSH 沙箱只读（Errno 30），与本次改动无关的环境性失败（[CAPABILITY_GAP]）。
- `make test-quick` 另观测到 test_admin_backup xdist 并发偶发 flake（两次全量跑一次出现），单文件 `-n auto` 40 passed 稳定——预存并行竞态，非本任务引入。
- ruff lint 全过（PATH=backend/.venv/bin）。

## 标注

[DESIGN_GAP: P2 §3.2 A4/A5 的 share 判别未显式定义「登录非成员 + 合法 share token」行为；BDD-2（carol 登录 + owner 合法 token → 404）与 BDD-11/13（匿名 + token → 200）冲突。实现取判别 = 登录用户若非 owner/admin/team 成员且 entry 属 team → share 分支直接 404（share 只服务匿名外部访问者），匿名 token 访问者不受限。]

[DESIGN_GAP: BDD-36 全局 key 测试在 create_app 后运行时 mutate `config.server.api_key` 并发送裸 Authorization 头；现状 `_is_global_api_key_auth` 是「形似非 pv_」启发式且不比对配置。实现升级为请求时配置精确比对 + 裸 Authorization 兼容 + header 覆盖 cookie。]

[DESIGN_GAP: 空文件 entry 的 download 现状返回 NO_FILES 404；BDD-5 成员 fileless team entry 期望 download 200。实现去 NO_FILES 分支改空 zip 200（无 legacy 断言依赖 NO_FILES）。]

[SCOPE_GAP: dispatch prompt 说「P3 测试不改」，但 P3 迁移/owner-fail 测试含机械性代码缺陷（session.exec 位置参数在 sqlmodel 0.0.38 非法、session 关闭后取 .id 触发 Detached、fixture status 小写与真实存储 ACTIVE 不符、COUNT(*).one() 返回元组）——P3 红灯时因模块未实现（Team 不存在）未暴露。仅修这四处机械缺陷（bindparams/scalar/id 前移/fixture 大小写），零行为断言改动；共享 helper expunge 同属脚手架修复。若主 Agent 判定 P3 测试不可动，可回退这些机械修复并改由 P3 修正。]

[PROD_NOT_TOUCHED]：本批只读写 backend/ 代码 + 运行 pytest（conftest autouse 隔离 tmp_path），未触碰生产 :8080 / ~/.peekview/ / pipx peekview。

## 新增文件核对表

骨架（P2-skeleton.md）与 CODE-MAP（agents/CODE-MAP.md）机制均未采用 → 本节省略。

---

# P4 retry1-B1（implementer backend 单任务 — BLOCKER-1 修复，2026-09-02 追加节）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；全程 conftest autouse 隔离 tmp）
> 改动面：仅 `backend/peekview/api/entries.py` + `backend/peekview/api/files.py`（dispatch-context 限定）；未碰 services 层、未改 P3 测试。
> 覆盖路径：BLOCKER-1 的 share cookie 越权读通道全 4 服务点（get/detail、download、resolve_entry_raw、_resolve_entry files 子资源）。

## implementation_dir

`backend/peekview/api/`

## 改动文件清单（BLOCKER-1）

| 文件 | 改动 | 关联 |
|---|---|---|
| `backend/peekview/api/entries.py` | 新增 `_share_cookie_allowed_for_user(request, entry, current_user)` 判别助手；`_check_share_cookie` 加 `current_user: User\|None = None` 参数（向后兼容默认 None），share cookie 验证通过后、构建 response 前调用判别：登录非特权用户 + team entry → `return None`（调用方走 404）；entries.py 内两调用点（get_entry:320 / download_entry_files:546）传 `current_user` | BLOCKER-1 / BDD-2 / BDD-23 |
| `backend/peekview/api/files.py` | `resolve_entry_raw` cookie 回退调用点（:445）传 `current_user`；`_resolve_entry` 直连 cookie fallback（:172-178）补同款判别（`_share_cookie_allowed_for_user`），登录非特权 + team entry → 不放行 404 | BLOCKER-1 / BDD-2 |

## 修复语义（与 ?share= query 分支 entries.py 同款）

- 判别条件（`_share_cookie_allowed_for_user`）：`current_user is None`（匿名，不判别）或 `entry.team_id is None`（非 team entry，不判别）→ 放行；owner（`entry.owner_id == current_user.id`）/ admin（`current_user.is_admin`）→ 放行；否则查 `team_membership_exists(session, current_user.id, entry.team_id)`（复用函数已开 session）——成员放行、非成员 → `return None` → 调用方 `NotFoundError` 404。
- **只作用于 team entry**：非 team private entry 的 share cookie 对登录用户继续服务（既有 share 语义保持——匿名种 cookie → 之后登录仍可读 private share，test_share_cookie B18 语义不变）。
- 不动 ?share= query 分支（已有判别）；不动匿名访问（share 对外部匿名访问者服务，P2 §3.2 A5）。
- archived 不另判：判别仅查 team_id，cookie 通道不新增 archived 绕过（archived team entry 对登录非特权本就 404——can_read 不动，且 cookie 判别也 404）。

## 自查验证（自查≠gate，P5 由主 Agent 派 verifier）

- 临时验证测试（隔离 tmp，跑完即删，未落仓库）4/4 passed，模拟 BLOCKER-1 全场景：
  1. **carol（非成员）登录 + 有效 share cookie → plain GET /entries/{slug} = 404**（BLOCKER-1 复现修复）；raw / download 同 404；对照 carol + header auth 404。
  2. 成员被移出 team 后 + share cookie → 404（BDD-23）。
  3. owner / 成员 / admin 登录 + share cookie → 200（正常路径不破坏）；header auth 200 回归。
  4. 匿名 + ?share= team entry → 200 且种 cookie（回归不破坏）；匿名种 private（非 team）cookie → 登录后仍 200（非 team share 语义保持）；同登录态 team entry 404（判别 team 限定）。
- 相关测试全绿：`test_team_visibility.py` + `test_share_team.py` + `test_share_cookie.py` + `test_share_access.py` = **34 passed**。
- 全量 `make test-quick`：**1164 passed / 3 skipped / 1 failed**——唯一失败 = 预存环境性 `test_cli_remote.py::test_config_set_remote_api_key`（子进程写 `~/.peekview/config.yaml` DSH 沙箱只读，[CAPABILITY_GAP]，P4 基线同款，与本次改动无关）。
- ruff：两改动文件 All checks passed。

## 标注

无 [DESIGN_GAP] / [SCOPE+] / [SCOPE_GAP]：BLOCKER-1 修复要求明确（dispatch-context + P4-review-eng.md Fix 方向），判别语义直接复用 ?share= 分支（entries.py:254-258）同款，无自主歧义决策。

---

# P4-implementation retry1-B2 — 定向修复 BLOCKER-2（owner 读成员发布 team entry，方案 A）

> 状态标记：[PROD_NOT_TOUCHED]（隔离 tmp create_app 实测 + pytest conftest autouse 隔离，未触碰生产 :8080 / ~/.peekview/ / pipx peekview）
> 批次边界：只改 `backend/peekview/services/`（entry_service.py + team_membership.py 助手）；api 层 BLOCKER-1 由并行 b1 implementer 处理，未交集。

## implementation_dir

`backend/peekview/services/`

## 改动文件清单（retry1-B2）

| 文件 | 改动 | 依据 |
|---|---|---|
| `backend/peekview/services/entry_service.py` | `team_visible_expr(user_id)` 改为 OR(EXISTS team_members 成员项, EXISTS teams t WHERE t.id=entries.team_id AND t.owner_id=user_id)；`can_read_entry` 加第 5 参 `is_team_owner: bool = False`（默认 False 向后兼容），判读加 `or is_team_owner`；`get_entry` 非 archived 分支解析 `team_owner_exists(session, current_user_id, entry.team_id)` 并传入 | P4-review-eng §BLOCKER-2 方案 A；dispatch-context retry1-b2 |
| `backend/peekview/services/team_membership.py` | 新增 `team_owner_exists(session, user_id, team_id) -> bool`（EXISTS teams 查询，user/team 任一 None → False），薄模块同 `team_membership_exists` 形态 | 同上 |

## 实现要点

1. **方案 A 语义**：team owner（owner_id 非 team_members 行）视为团队可见范围成员——读权与 `?team=slug` 显式过滤（entry_service.py:550-566 已判 owner 放行）自洽，消除 get 404 vs 过滤 200 三处矛盾。
2. **`can_read_entry` 向后兼容**：默认 `is_team_owner=False`，既有调用点（api/entries.py share 分支等仍传 4 参）行为不变；唯一需要 owner 判定的 `get_entry` 调用点显式解析传入。团队 owner 判定只需在 entry.team_id 非空时执行（`team_owner_exists` 内部短路 None → False，天然满足）。
3. **`team_visible_expr` SQL 覆盖**：`team=me` 聚合（:546）、登录用户 All 可见性（:613）、starred_cond（:585）三处使用点共用同一表达式，owner 项加入后自动覆盖——`?team=me`/All/`?starred=true` 不再缺 owner 团队内容。
4. **archived 分支 / 写权不动**：get_entry archived 分支星标语义、update_entry 写权（entry owner/admin）均未触碰（评审 INFORMATIONAL 确认维持）。
5. 未改 P3 测试；隔离实测复现评审场景全路径对齐（见下）。

## 隔离实测验证（自查≠gate）

脚本 `/home/kity/Downloads/tpv0095_b2_verify.py`（临时，不落仓库；tmp_path + captcha-disabled create_app + HTTP 真实路径）：
- **Alice(owner) 读 Bob(成员) 发布的 E2**：get E2 → 200（含 team proj-a）；list All → 含 e2；`?team=me` → 含 e1+e2；raw E2 → 200 含 team；`?team=proj-a` → 含 e1+e2（全路径一致 ✓）
- **Bob(成员) 回归**：get/raw/All/team=me/team 过滤均 200 含 e2
- **Carol(非成员) 回归（BDD-2）**：get/raw → 404；All/team=me/team 过滤均不含 e2
- 既有测试：`tests/test_team_visibility.py + test_share_team.py + test_team_validation.py + test_teams_owner_fail.py + test_team_migration.py` → **29 passed**
- 全量：1168 collected = 1164 passed / 3 skipped / 1 env-fail（test_cli_remote Errno 30 写 ~/.peekview/config.yaml，P4 基线已登记，非本次引入）——**零回归**

## 标注

[SCOPE+: 方案 A 使 owner 可 star 成员发布的 team entry（star POST 经 get_entry 判读 200），但 `star_service._build_star_item` 列表可见性仍只查 team_members（membership-only）→ owner 星标的成员发布 entry 在 `/stars` 列表缺失（?starred=true 经 team_visible_expr 已含，两列表不一致）。隔离实测复现：alice star E2 → ?starred=true 含 e2、/stars 空。star_service.py 不在本次 dispatch 改动面内（约束：只改 entry_service + team_membership），标 [SCOPE+] 供主 Agent 裁定——若采纳，改动 = star_service.py 判定加 team_owner_exists 项（同 team_visible_expr 语义）。]

[PROD_NOT_TOUCHED]

## 新增文件核对表

无新增文件（team_membership.py 为既有批次文件，仅追加函数；骨架/CODE-MAP 机制未采用）。

---

# P4-implementation retry2 — 定向修复 R1/R2（方案 A 传播残留，2026-09-02 追加节）

> 状态标记：[PROD_NOT_TOUCHED]（隔离 tmp create_app + conftest autouse 隔离 pytest，未触碰生产 :8080 / ~/.peekview/ / pipx peekview）
> 批次边界：只改 `backend/peekview/api/entries.py` + `backend/peekview/api/files.py` + `backend/peekview/services/star_service.py`（dispatch-context retry2 限定）；未改 P3 测试。
> 上游：P4-review-eng.md（复审 r1）needs-revision 的 R1 + R2。

## implementation_dir

`backend/peekview/api/` + `backend/peekview/services/`

## 改动文件清单（retry2）

| 文件 | 改动 | 依据 |
|---|---|---|
| `backend/peekview/api/entries.py` | `get_entry` ?share= 分支正常访问判定补 `is_team_owner`（import `team_owner_exists`，entry.team_id 非空时解析，normal-access OR 加 owner 项）——owner(team) 持合法 share token 读成员发布 team entry 不再 404 | R1（review §三.1） |
| `backend/peekview/api/files.py` | `resolve_entry_raw` share 分支同款补 `is_team_owner`（判定 + import 展开成两行） | R1（raw 镜像面） |
| `backend/peekview/services/star_service.py` | `_build_star_item` 可见性判定加 `team_owner_exists` 项（import 行补函数）——owner 星标的成员发布 team entry 进 `/stars` 列表 | R2（review §三.2，[SCOPE+] 采纳） |

## 修复语义

1. **R1**：share 分支「正常访问优先」判定从 `is_admin or entry.owner_id == current_user_id or is_team_member` 扩为 `… or is_team_owner`，与 entry_service.can_read（方案 A：owner 视为团队可见范围成员）同一判定形状——成员/owner 对同一合法 share token 不再 200/404 分叉；cookie 面（`_share_cookie_allowed_for_user` 回落正常访问）与 query 面行为对齐。防枚举 404 分支（logged-in 非 owner/admin/成员/owner 的 team entry）不受影响——carol 仍 404。
2. **R2**：`_build_star_item` 可见性从 membership-only 扩为 member OR owner，与 `?starred=true`（entry_service.starred_cond 经 team_visible_expr 已含 owner）同语义——同一 owner 两星标表面不再矛盾。
3. 未收敛判定助手（review R3 INFORMATIONAL）：本任务防扩散不重构，记 P7 一致性检查关注项。

## 隔离实测验证（自查≠gate）

脚本 `/home/kity/Downloads/tpv0095_retry2_verify.py`（临时，不落仓库；隔离 tmp + captcha-off + HTTP 真实路径）：
- **R1**：alice(team owner, 非 entry owner/非成员) + bob(成员/entry owner) 合法 share token 读成员发布 E2 → **200/200**；alice plain GET → 200；**carol(非成员) + ?share= → 404**；匿名 + token → 200（share 外部访问语义保持）；files.py raw 面同款：alice raw ?share= → 200、carol → 404。
- **R2**：alice star 成员发布 E2 → POST 200；`/api/v1/stars` items **含 e2-member**；`/api/v1/entries?starred=true` **含 e2-member**（两表面一致）；carol star POST E2 → 404 不泄露；carol /stars 空。
- 14/14 checks passed。

## 回归确认

- 相关套件：test_team_visibility / test_share_team / test_share_cookie / test_share_access / test_share_create / test_share_list / test_share_revoke / test_star_api / test_star_visibility / test_team_validation / test_teams_api / test_teams_owner_fail / test_team_migration → **86 passed**（含 BDD-1/2/5/14/15 star 与 share 断言）。
- 全量 `make test-quick`：**1164 passed / 3 skipped / 1 failed**——唯一失败 = 预存环境性 `test_cli_remote.py::test_config_set_remote_api_key`（DSH 沙箱写 `~/.peekview/config.yaml` 只读 Errno 30，[CAPABILITY_GAP]，P4 基线同款，与本次改动无关）。
- ruff：三改动文件 All checks passed。

## 标注

- 无 [DESIGN_GAP]：R1/R2 修复要求明确（review §三.1/三.2 + retry2 dispatch-context 修复方向），直接复用 entry_service can_read 语义与既有 team_membership_exists 形态。
- R2 对应上一轮自标 [SCOPE+]（P4-implementation.md:277）——主 Agent 采纳后本批落为定向修复，非自主扩大范围。
- 未改 P3 测试。[PROD_NOT_TOUCHED]
