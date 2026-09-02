---
phase: P2
task_id: TPV0095-team-visibility
type: design
parent: P1-requirements.md
trace_id: TPV0095-P2-rev1-20260902
status: draft
created: 2026-09-02
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2
packages: [backend/peekview, frontend-v3, packages/mcp-server]
domains: [backend, frontend, mcp, security]
ui_affected: true
ui_design_section: true
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: backend, complexity: high}, {id: frontend, complexity: medium}, {id: mcp, complexity: low}]}
---

# P2 方案设计 — TPV0095 团队可见性机制（Team Visibility）

> 语义权威：design-note v4（9 决策 A-I / A1-A14 已锁）；验收权威：P1-requirements.md（43 BDD，approved）。本文件在其上做**实现层选型**，不推翻已定语义。影响面梳理基于 P1 §5 同类扫描 A-E 表 + 本文件作者的实读代码核对（P1 修订后 A 表行号已按 43 BDD 版重核到文件函数级）。

## 0. 影响面梳理（强制节，先于候选方案）

### 0.1 改什么（Modify）

逐文件改动点 + 关联 BDD 编号（落点 = 文件 + 函数/节）：

**A. 数据模型与迁移（backend，BDD-16/17/18/19/20/24）**

| 文件 | 函数/节 | 改动 | BDD |
|---|---|---|---|
| `backend/peekview/models.py` | 新增 `Team` / `TeamMember` 表模型（:118 User 附近，`__tablename__`/`__table_args__` 模式）；`Entry`(:186) 加 `team_id: int\|None` FK `teams.id ON DELETE SET NULL`；`EntryCreate`(:466)/`EntryUpdate`(:503)/`CreateEntryRequest`(:705) 加 `team_id`；`EntryResponse`(:620)/`EntryListItem`(:644) 加 `team_id` + `team: {slug,name}\|None`；`StarItem`(:585) 加同字段；新增 Team 请求/响应 schema（`TeamCreateRequest{name}` / `TeamRenameRequest{name}` / `MemberAddRequest{username}` / `TeamSummary{slug,name,member_count}` / `TeamDetail{...,owner_username,members:[{id,username}]}` / `TeamsListResponse{owned:[TeamSummary],joined:[TeamSummary]}`） | 16-20 |
| `backend/peekview/database.py` | `_run_migrations`(:40) 追加段：先 `CREATE TABLE IF NOT EXISTS teams/team_members`（raw fallback，旧库兜底），再 `PRAGMA table_info(entries)` 检测后 `ALTER TABLE entries ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`；索引 `idx_team_members_user_id`/`idx_entries_team_id`（IF NOT EXISTS）。`_setup_indexes`(:318) 不重复。顺序 = create_all(:302 已先建 metadata 新表) → migration（见 §2 顺序） | 16,17 |
| `check_schema`(:229) | 无需改代码——metadata 加列后自动对存量 entries 表比对 team_id（漏 ALTER 会 SchemaMismatchError，正是 BDD-17 校验语义） | 17 |

**B. 权限收敛（backend，BDD-1~6/7/14/15/23/25）**

| 文件 | 函数/节 | 改动 | BDD |
|---|---|---|---|
| `backend/peekview/services/entry_service.py` | 模块级 `can_read_entry(...)`（放 :48 logger 之后）+ import `team_membership_exists`（来自 `services/team_membership.py` 独立薄模块——落点权威 = §3.2 锁定，entry_service/star_service 共用免环）；`get_entry`(:326-383) 非 archived 分支(:357-364) 条件替换为 can_read（is_public OR admin OR owner OR team 成员）；archived 分支(:343-355) **保持**星标语义不动（BDD-6）；`list_entries`(:385-629)：新增 `team: str\|None` 形参，Phase 3(:479-518) 登录用户 All 分支 + team 可见项 `EXISTS(team_members)`；`team=me` 聚合我的 teams；`team={slug}` 过滤（解析 slug→id，非成员/未知→空列表 200，BDD-10）；starred_cond(:491-497) 加 team 成员项（BDD-14/15）；`create_entry`(:124-324) 加 `team_id` 形参 + 校验（不存在/非成员/匿名带 team_id → 抛 `ParameterValidationError` = 422，R2 锁定：文案统一不区分存在性与成员身份）强制 is_public=false；`update_entry`(:631-799) 加 `team_id` 写路径 + 归属校验（同抛 `ParameterValidationError` = 422，R2）+ team→public 撤销 share（:705-709 的 was_private 分支改为 was_private_or_team→public 触发）；`_build_response`(:1095-1146) 加 team 解析（仅非 share 上下文 attach）；新增 `get_entry_by_api_key(slug)`（返回 Entry row，全局 key 用，补存量 bug） | 1-6,10,14,15,21-24,27-30 |
| `backend/peekview/services/star_service.py` | `_build_star_item`(:365-371) 可见性条件加 team 成员项（import `team_membership_exists` 自 §3.2 锁定的 `services/team_membership.py`） | 14,15 |
| `backend/peekview/services/team_membership.py`（**新增**，N2-eng 落点权威） | 独立薄模块：仅 `team_membership_exists(session, user_id, team_id) -> bool`（EXISTS 子查询）+ 常量；entry_service/star_service 共同 import，零成环单点形态（§3.2 锁定） | 1-6,14,15 |
| `backend/peekview/api/files.py` | `_resolve_entry`(:130-176)/`resolve_entry_raw` share 分支(:377-393)：收敛判定下沉——`entry.team_id` 且当前用户是成员时走 `service.get_entry`（放行），share 分支只保留 share 语义 | 2,5 |
| `backend/peekview/api/files.py` + `backend/peekview/models.py` | `resolve_entry_raw`(:352) + `EntryRawResponse`(:679) 加**可选 `team` 字段**（[SCOPE+ §12 第二项] 采纳，N4 落表）：仅 owner/成员/全局 key 附 team `{slug,name}`，share 访问者不附；MCP get_entry（走 /raw）与 BDD-36 依赖此贯通 | 36 |
| `backend/peekview/api/entries.py` | `_check_share_cookie`(:37-67)/`get_entry` share 分支(:200-234)：team 成员登录用户不再落入 share 兜底（经 get_entry 正常放行）；`download_entry_files`(:467-537) 全局 key 分支改调 `service.get_entry_by_api_key` | 2,5,7 |
| `backend/peekview/services/share_service.py` | `create_share`(:51)/`list_shares`(:129)/`revoke_shares`(:169) 的 `ForbiddenError` → `NotFoundError`（403→404）；成员不可建 team share 由现状 owner/admin 判定天然保证（BDD-12） | 11,12,13 |

**C. teams API + 前端/CLI/MCP 侧贯通（BDD-7~10/22/31~43）**

| 文件 | 改动 | BDD |
|---|---|---|
| `backend/peekview/services/team_service.py`（**新增**） | Team CRUD + 成员管理 + owned/joined 查询 + team 详情（成员列表）+ username 添加成员（不存在→NotFoundError）+ 校验（name 空/超长、owner 内重名 IntegrityError→ValidationError）；slug 生成 + `-N` 冲突重试（复用 entry `_retry_with_slug_suffix` 模式） | 7,8,9,18,19,20 |
| `backend/peekview/api/teams.py`（**新增**） | 9 路由（§3.3 表），参照 `api/shares.py`/`api/entries.py` 薄封装模式；无权一律 404 | 7,8,9 |
| `backend/peekview/main.py` | services 注册(:200-243) 加 `team_service`；include_router(:431-439) 加 teams_router | — |
| `backend/peekview/cli.py` | `create`(:215-353) 加 `--team`/`--user`（本地归属）；`list`(:424-546) 加 `--team`/`--user`；新增 `teams` 子命令 group（`--user` 本地必填、远程透传——参照 apikey create `--user` 先例 cli.py:1920，非 user_cmd）；**本地 `_get_backend`(:78) / `_resolve_user_local`(:2079) 的 `init_db` 改 `run_migrations=True`**（R1 锁定：幂等、与 serve 同语义，CLI 本地路径也可迁移存量旧库 / 建两索引） | 31-34 |
| `backend/peekview/client.py` | `create_entry` payload 透传 `team_id`(:148-156)；`list_entries` 加 `team` 参数(:183-193)；新增 `list_teams()`（GET /teams，参照 :270-282） | 34 |
| `frontend-v3/src/types/index.ts` | `Entry`/`ListEntriesParams`(:9-68) 加 `teamId`/`team`/`team?`；新增 Team 类型 | 38-43 |
| `frontend-v3/src/api/types.ts` | `EntryResponse`/`EntryListItemResponse`(:4-54) 加 `team_id`/`team` 原始字段 | 38-43 |
| `frontend-v3/src/api/client.ts` | `transformListItem`/`transformEntry`(:52-107)/`transformStarEntry`(:218-238) 加 team 转换；`listEntries`(:124-144) 传 team；`updateEntry`(:159) 支持 team_id | 38-43 |
| `frontend-v3/src/stores/entryList.ts` | `toggleVisibility`(:45-73) 顶部加 teamId 守卫 | 40 |
| `frontend-v3/src/views/EntryListView.vue` | 5 tab（All/Mine/Teams/Archived/Starred）+ team chips + `currentTeam`/`view` 状态 + 四维互斥 + URL team/view + 单一"不可用"态 + 管理团队链接 + ~9 调用点统一透传（§5.4 状态模型） | 38,41,42 |
| `frontend-v3/src/views/searchUrl.logic.ts` | `RestoredQuery`/`parseRestoreQuery`/`mergeQuery` 扩展 team/view | 38,41 |
| `frontend-v3/src/views/TeamsView.vue`（**新增**） + `router.ts` `/teams` 路由 + 守卫 | /teams 管理页（owned 管理 + joined 退出 + 新建/重命名/删除/成员增删 + 全状态） | 42 |
| `frontend-v3/src/components/UserMenu.vue` | 加 Teams 入口 | 42 |
| `frontend-v3/src/components/BaseBadge.vue` | `team` 变体 + label 参数化（禁 emoji/hex，DESIGN.md 约束） | 39 |
| `frontend-v3/src/components/EntryCard.vue`/`EntryListRow.vue` | badge 优先级 `teamId ? 'team' : (isPublic?'public':'private')` + toggle 按钮对 team entry 隐藏 + tooltip | 39,40 |
| `frontend-v3/src/components/FilterChip.vue` | dismiss aria-label 参数化 | 41 |
| `frontend-v3/src/components/ExpiresInDialog.vue` | `api.updateEntry` 调用不破坏 team（PATCH 不带 team_id 即不动归属——verify 不改） | 25 |
| `frontend-v3/src/views/EntryDetailView.vue`/`EntryDetailHeader.vue`/`EntryMetaTagsBar.vue` | **detail 状态标签对 team entry 的处理（[SCOPE+] 见 §12）** | — |
| `packages/mcp-server/src/tools/createEntry.ts`/`publishFiles.ts` | schema 加 `team_id`（optional）+ description 加 TEAM VISIBILITY 引导块（含"omitting team_id → default PUBLIC"硬提示） | 35,37 |
| `packages/mcp-server/src/tools/listTeams.ts`（**新增**）+ `index.ts` 注册到 common | 无参只读 list_teams | 35 |
| `packages/mcp-server/src/client.ts` | `createEntry` payload 加 team_id；新增 `listTeams()`；`getEntry` team 透传 | 35,36 |
| `packages/mcp-server/src/tools/getEntry.ts` | 输出加 `team: {slug,name}\|null` | 36 |
| `packages/mcp-server/src/types.ts` | Team 类型 + EntryResponse/TeamList | 35,36 |
| `VERSIONS.json` | mcp_server 0.11.0→0.12.0（P8 执行；peekview 0.21.0→0.22.0 由 P8 定） | 35 |
| `DESIGN.md` | Tabs 规则(:200-201) 修订为"5 扁平过滤 tab 移动端可横滚 + 触达 ≥44px" | 43 |

### 0.2 不改什么（Not Modify）

显式列出"看起来该改但决定不改"的范围 + 理由（P4 范围边界依据）：

1. **`entry_service.py` update_entry/delete_entry 的写权判定不进 can_read_entry**（design-note §5.3 只收敛读路径；P1 E1）。本任务只补 team_id 写校验（BDD-21/28-30），不重构写权。
2. **`share_service.py:54` public entry 不可建 share 的 ValidationError 语义**（P1 C4）——与 team 无关，保留。
3. **`api/entries.py` reads(:315-336)/unstar 回退(:457-463) 判定**（P1 A9）——reads 保持 owner/admin；unstar 无星标时回退 get_entry 可读性（team 成员经 get_entry 自动放行），不额外改。
4. **`auth.py` / `_shared.py _is_global_api_key_auth`**（P1 E4）——身份解析层语义不变；全局 key 缺口只在 A7 的 `get_entry_by_api_key` 补。
5. **FTS 检索可见性**（P1 E5）——FTS 只定位 entry id，最终读权仍走 list/get 判定；不加 team 过滤。BDD-26 EXPLAIN 用 pytest 断言（§3.5）。
6. **read_tracking 探针 team 上下文**（design-note §10，P1 E6）——v2，本任务不做。
7. **`scripts/seed-data/python-entry-service/entry_service.py` 样例镜像**（P1 E3）——不参与权限收敛；team fixture 由 P3 自建，seed-data 不新增 team。
8. **`frontend-v3` 无创建表单**——实读确认前端无 `POST /entries` 调用面（创建全走 CLI/API/MCP，design-note §8.7 的"创建表单三选一"在 frontend-v3 无 UI 落点）。编辑面 = 卡片/溢出 toggle（仅 is_public）+ ExpiresInDialog（仅 expires_in）。因此 team 归属变更 UI 不新增编辑表单，只做**卡片 toggle 隐藏 + store 守卫**（BDD-40 即验收）；team entry 变更归属由 CLI/MCP/API PATCH 承载。**不改** detail 溢出菜单的 Make Private/Public 项本身——由 store 守卫在 team entry 上拒绝（§5.3），避免单处遗漏。
9. **`api/files.py` download_file/get_file_content/render 路由体**——经 `_resolve_entry` 收敛（A3/A8），不改路由逻辑本身。
10. **admin 不自动接管 team 管理**（design-note §5.7）——teams 管理接口 owner 判定不含 admin 管理权（admin 可见不管理）。
11. **备份/恢复的 merge 表清单**——teams/team_members/entries.team_id 不进 `_restore_merge` 逐行拷贝（现状 merge 本就只拷 users/entries/files/shares/reads/api_keys，`_table_exists` 保护）；replace 模式整体换库天然含新表。teams merge 缺口记录为 [SCOPE+]（§12），**不改** restore（防扩散，非本任务验收路径）。

### 0.3 风险在哪（Risk × 缓解）

| # | 风险 | 缓解 |
|---|---|---|
| R1 | **权限收敛 7 路径漏改一处** → 团队成员 files/raw/download 404（本任务最大风险，P1 §5 拦截声明） | 收敛判定集中在 entry_service.get_entry/can_read + team_membership.py 助手（§3.2 落点），7 处读路径 API 侧已多数 delegate get_entry（A3/A5/A7），需逐点核对并写**权限矩阵回归用例**（7 路径 × 5 actor，P3 §13#1；BDD-2/5 承载）；P6 逐格实跑 |
| R2 | **迁移顺序**：ALTER entries 时 teams 被引用表不存在 → SQLite 报错；漏 check_schema 对齐 → 升级启动 SchemaMismatchError | init_db 顺序天然 = create_all(建 teams/team_members) → _run_migrations(ALTER entries)（**minimal_validation #1 已实测**）；migration 幂等（IF NOT EXISTS + 列检测）；P3 写旧库升级双启动用例（BDD-17） |
| R3 | **防枚举一致性**：任何 403 残留 → 存在性 oracle | share 三接口 + team 管理接口 + username 添加统一 404（service 层抛 NotFoundError）；?team= 服务端零信号（200+空 items）；grep 断言测试覆盖 |
| R4 | **can_read SQL 性能**：EXISTS 子查询未命中索引 → 全表扫描 | idx_team_members_user_id / idx_entries_team_id 两索引 + BDD-26 pytest EXPLAIN 断言（§3.5）；存量 file_count N+1 不新增 |
| R5 | **update 的 is_public 存储不变量绕过**：客户端 PATCH `is_public=true` 不带 team_id 剥离 team（BDD-28 只测去 team_id 路径） | 服务端写路径统一强制：**行级不变量 team_id NOT NULL → is_public 恒 false**（create/update 落库前统一 clamp，见 §3.1 决策 D3）——不只 create 时强制一次 |
| R6 | **前端状态矩阵**：双 tab 高亮 / 残留维度 / URL 恢复错乱 | 四维互斥集中在一个 `setFilter` 入口；`All 激活判定加 !currentTeam`；URL 为唯一持久源，restore 三处（restoreFromURL/onBeforeRouteUpdate/auth watch）收敛为同一 restore 函数（§5.4）；P3 组件测试覆盖矩阵 |
| R7 | **迁移后既有行为回归**：list 聚合/star 可见性改动影响存量数据 | ?view=all 对匿名零变化（匿名仍只见 public）；新增字段全 optional；BDD-25 零变化回归线 + 既有测试套件（make test-quick） |
| R8 | **MCP 身份/全局 key 语义分叉**：全局 key get_entry/download AttributeError | 补 get_entry_by_api_key（全仓唯一调用点 entries.py:478）；P6 断言全局 key 对 team entry 200 |
| R9 | **MCP agent 省略 team_id 默认公开**（数据泄露） | description 硬提示文案 + list_teams 发布前知情（BDD-37）；服务端校验契约绝不静默忽略（BDD-21） |
| R10 | **CLI 本地模式 owner 语义缺失**（create 现状 owner_id=NULL） | teams/--team 本地模式要求显式 `--user`（参照 apikey create `--user` 先例 cli.py:1920），owner 判定落到 resolve 出的 User；本地 init_db(run_migrations=True) 免存量旧库 SchemaMismatch（R1）；远程模式经 PeekClient 身份透传（BDD-34 锚） |
| R11 | **share 语义回归**：team→public 撤销 share 路径遗漏 | update 撤销条件扩展为 `(was_private or was_team) and now_public`，复用 revoke_all_for_entry（BDD-28）；share 生命周期与成员变动无关断言（BDD-13） |
| R12 | **restore merge 丢 team 关联**（[SCOPE+] 缺口） | 本任务不改 restore；记录 §12 供主 Agent 裁定是否 P1 增补（不阻塞 P2） |

## 1. 候选方案（≥2 + 权衡 + 选择）

> design-note 已锁语义（数据模型/API/校验契约/安全表）。真实自由度在**实现组织层**的三个正交子决策：(a) 读路径判定函数落点、(b) 前端查询状态归属、(c) teams 业务归属。以下组成两个自洽集成方案，正文如实权衡。

### 候选方案 A（选定）：收敛点贴近现状域 + 前端状态留视图层 + teams 独立 service

- **(a) 权限判定**：`team_membership_exists(session, user_id, team_id)`（返回 bool，EXISTS 子查询）定义在**独立薄模块 `backend/peekview/services/team_membership.py`**（落点权威 = §3.2 锁定，entry_service/star_service 共同 import，零成环）；`can_read_entry(entry, user_id, is_admin, is_team_member)`（纯函数式判定：is_public OR is_admin OR owner OR team_member）放 entry_service 模块级。`get_entry` 非 archived 分支改走它；list_entries 的 SQL 分支与 star_service 的每行判定引用同一助手。
- **(b) 前端状态**：explore 的 owner/status/starred/tags/team/view 全部保持**组件本地 ref**（现状 owner/status/starred/tags 就在 EntryListView.vue 本地），team 并入 `loadEntries` 单一查询对象；URL 恢复三处收敛成一个 restore 函数。Pinia entryList store 只透传 params，不加查询态。
- **(c) teams 业务**：新建 `services/team_service.py` + `api/teams.py`，注册到 `app.state.team_service`（与 share_service/star_service 并列）。entry_service 权限判定查 team_membership 走自身 session（不依赖 team_service 实例）。

**优点**：改动面贴合现状（权限判定所在即 get_entry/list_entries 所在，session 已在作用域内，无跨模块新依赖）；前端零 store 重构（9 个 loadEntries 调用点只加一个参数透传）；teams CRUD 独立成域与 share/star 对称，main.py 注册模式现成。
**风险/成本**：entry_service 与 team_service 对 team_members 的 SQL 各写一份（同一 WHERE 形态，双处需同步——低风险因为形态 3 行且 P3 权限矩阵回归双覆盖）；team_membership_exists 独立成模块后 entry_service/star_service 只做单向 import（entry_service→star_service 既有单向边不动），无环；见 §3.2 免环锁定。
**工作量**：中（后端集中 + 前端沿用组件模式）。

### 候选方案 B：集中抽象模块（permission.py + Pinia store + TeamService 全托管）

- (a) 新建 `backend/peekview/services/permission.py`（can_read_entry + team_membership + SQL 片段生成），entry_service/star_service/API share 分支全部 import；teams 判定统一出 permission 模块。
- (b) 前端新建 `stores/entryQuery.ts`（Pinia）承载全部 5 维度查询态，EntryListView 只订阅。
- (c) TeamService 同时承载 membership 查询（team_service.is_member()），permission 模块调 team_service。

**优点**：职责单一（权限一处定义，跨域可测）；查询态集中后组件瘦身、未来多入口复用（如 /users 也带 team 维度）。
**风险/成本**：permission 模块依赖 session 作第一参 + team_service 依赖 engine → 双向依赖/生命周期耦合（permission 与 service 交叉调用需破环）；现有 API 层多处**已 delegate get_entry 拿到 EntryResponse 而非 Entry row**（files._resolve_entry 依赖 get_entry 返回 id），改成"先查 row + can_read(row)"要把这些调用重写成 row 级，反而扩大 diff；前端把 5 维度搬 store 需重写 EntryListView 的 setFilter/restore/9 调用点 + watch 逻辑，超出本任务状态复杂度预算（四维互斥本就是视图级交互模型，搬 store 无收益）。
**工作量**：高（三层重构面），且部分改动与 design-note "只收敛读路径、不重构写权/查询架构"的边界冲突。

### 权衡与选择

| 维度 | A | B |
|---|---|---|
| 与现状代码贴合度 | 高（判定就在判定所在处） | 低（需 row 级重写读路径调用） |
| 跨模块耦合 | 低（独立 team_membership.py 薄模块 + session 传参，单向 import） | 高（permission↔team_service↔entry_service 成环风险） |
| 前端改动成本 | 中（只加维度参数 + restore 收敛） | 高（store 重构 + 全视图逻辑迁移） |
| 可测性 | 中（权限矩阵回归测试双覆盖两处 SQL 形态） | 高（permission 单测直接） |
| 范围边界 | 与"不重构查询架构"约束一致 | 越界 |

**选定方案 A**：三端多包任务的首要风险是"收敛漏改 + 迁移顺序"，不是"职责抽象不足"。A 让权限判定落在最接近数据的地方、前端沿用既有组件状态模式，最小化回归面；B 的抽象收益（一处定义）在本任务里被"跨 service 双向依赖 + 读路径 row 级重写"的高成本抵消，且与 design-note §5.3 边界冲突。方案 A 内的双处 SQL 形态由 P3 权限矩阵用例 + BDD-26 EXPLAIN 双兜底。

## 2. 数据模型与迁移（方案 A 实现层定稿）

```sql
teams (
  id INTEGER PK, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  owner_id INTEGER FK -> users.id ON DELETE CASCADE,      -- 与 entries.owner_id 同 CASCADE 语义
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_id, name)
)
team_members (
  team_id INTEGER FK -> teams.id ON DELETE CASCADE,
  user_id INTEGER FK -> users.id ON DELETE CASCADE,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id)
)
entries.team_id INTEGER NULL FK -> teams.id ON DELETE SET NULL
idx_team_members_user_id (team_members.user_id)
idx_entries_team_id (entries.team_id)
```

- SQLModel 表模型 `Team`/`TeamMember`（table=True）+ `Entry.team_id` → `create_all` 建新表/加 metadata 列；`_run_migrations` 负责**存量库** entries 加列 + 两索引（IF NOT EXISTS / 列检测幂等）。顺序：`init_db` = create_all(:302) → `_run_migrations`(:306) → `_setup_indexes`(:309) —— teams 表在 create_all 阶段已存在，ALTER 加 FK 时被引用表就绪。**minimal_validation #1 实测 confirmed**（SET NULL/级联/幂等）。
- **模型层 FK ondelete 显式声明（与 raw DDL 双源一致）**：SQLModel 字段必须带 `ForeignKey(..., ondelete=...)` —— `Team.owner_id` → `ondelete="CASCADE"`；`TeamMember.team_id` / `TeamMember.user_id` → `ondelete="CASCADE"`；`Entry.team_id` → `ondelete="SET NULL"`（DB 层 `foreign_keys=ON` 强制，见 database.py DEFAULT_PRAGMAS；漏 ondelete 会让全新库 create_all 路径删 team/删 user 触发 FK 违约 5xx，BDD-16/19/20 红灯——P3 补全新库删 team/删 user FK 行为断言，见测试缺口）。
- BDD-17 旧库升级：测试用 `_create_entries_without_owner_id` 同款手法造"无 teams/无 team_id"旧库 → init_db(run_migrations=True) 双启动 → 断言无 SchemaMismatchError、存量完好、team_id NULL、二次幂等。
- BDD-18 name/slug：owner 内唯一由 `UNIQUE(owner_id,name)` 拦截（IntegrityError → ValidationError）；slug 全局唯一冲突在 service 层 `-N` 重试（复用 entry `_retry_with_slug_suffix` 同款 try/except IntegrityError 循环）。
- BDD-19/20 owner 失效：禁用（is_active=false）→ 不触碰 teams/team_members/entries 行 → 冻结语义天然成立（成员读权仍在，owner 无法登录 = 无管理）；删除 → users 行 CASCADE 连带 teams（owner_id FK）→ team_members CASCADE → entries.team_id **不受 teams 删除影响**（SET NULL 只对 teams 删除触发；owner 删除时 entries 先被 users.owner_id CASCADE 删掉——现有 admin delete_user 先逐条 delete_entry（ORM 层，含 _delete_with_tombstone）再删 api_keys 再删 user（CASCADE stars），已实读核对，与本 DDL 一致；tombstone 墓碑走 delete_entry 由 admin_service 显式处理，不受 teams 删除影响）。

## 3. 后端设计

### 3.1 entry 侧 team 语义（服务端强制不变量）

- **D1 强制私有**：create/update 请求带非空 `team_id` 且校验通过 → 落库 `is_public=False`（不 422，BDD-27）。
- **D2 校验契约（422 统一，绝不静默忽略）**：team_id 非空 → 校验"team 存在 + 当前用户是成员（owned/joined 皆可）"，任一不满足抛 `ParameterValidationError`（**status_code=422**，exceptions.py 实读；`ValidationError`=400 不用于此——BDD-21/22/30 断言 422）统一文案（如 `team not found or not accessible`，不区分存在性与成员身份）；current_user 为 None（匿名/无身份）携带 team_id → 同样抛 `ParameterValidationError`（422，BDD-22）。create 与 update 同口径（P1 F3 成员口径，BDD-29）。
- **D3 存储不变量**：服务层每次落库前 clamp——**entry.team_id 非空则 is_public 强制 False**（覆盖"PATCH is_public=true 而未动 team_id"的绕过，BDD-27 精神扩展到 update；BDD-28 的"转 public"必须显式传 team_id=None）。此规则在 create_entry/update_entry 的 team 处理段统一执行。
- **D4 team→public 撤销 share**：update 撤销触发条件从 `is_public is True and was_private` 扩展为 `is_public is True and (was_private or was_team)`，其中 was_team = 更新前 entry.team_id 非空。复用 `revoke_all_for_entry`（BDD-28）。
- **D5 archived 不延伸**：get_entry archived 分支(:343-355) 一字不改（owner/admin/星标持有者），team 可见性只加在非 archived 分支（BDD-6）。

### 3.2 权限收敛实现（方案 A 的具体化）

**落点锁定（一处权威）**：`team_membership_exists` 独立成薄模块 `backend/peekview/services/team_membership.py`（内容即下方代码块），entry_service 与 star_service **共同 import**，零成环、单点形态——本文件 §0.1/§1/§7 均以本节为准，不再出现"entry_service 顶部模块级 / 模块级助手"等旧表述。`can_read_entry` 属 entry domain，放 `entry_service.py` 模块级（logger 之后、class 之前）。

```python
# backend/peekview/services/team_membership.py —— 仅此函数 + 常量
def team_membership_exists(session, user_id: int | None, team_id: int | None) -> bool:
    if user_id is None or team_id is None:
        return False
    return session.exec(
        select(1).select_from(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == user_id
        )
    ).first() is not None

# backend/peekview/services/entry_service.py 模块级
def can_read_entry(entry, user_id, is_admin, is_team_member) -> bool:
    # 调用方已解析 is_team_member（entry.team_id 非空才查）
    return entry.is_public or is_admin or entry.owner_id == user_id or is_team_member
```

- `get_entry`（非 archived）：`is_team_member = team_membership_exists(session, current_user_id, entry.team_id)`，条件替换为 can_read 语义（不满足 → NotFoundError）。archived 分支不动。
- `list_entries` SQL：登录非 admin 默认分支（:514-518）改为
  `is_public OR owner_id==me OR EXISTS(SELECT 1 FROM team_members WHERE user_id=:me AND team_id=entries.team_id)`；
  `starred_cond`(:491-497) 加同一 EXISTS 项；admin 不变；匿名（:511-513）仍只见 public（team 内容对匿名零可见）。
- `team` 形参：`team='me'` → 过滤条件退化为上述 EXISTS 可见项 + 页内只保留 team entry？**否**——`team=me` = 仅团队内容聚合（同 EXISTS 判定，不加 is_public/own 项）；`team={slug}` → 先解析 slug→team id（`SELECT id,owner_id FROM teams WHERE slug=?`），解析失败或当前用户非成员/匿名 → 返回 200+空 items（BDD-10 零信号）；成员 → `entries.team_id == team_id`。status/owner/starred 与 team 的互斥由**前端 URL 矩阵**保证（§5.4），服务端不互斥校验（容忍非法组合返回空/过滤结果，不 422——BDD-10 语义优先于参数互斥报错）。
- **star_service 免环（本设计锁）**：`_build_star_item`(:365-371) 需 team 成员判定但 star_service 反向 import entry_service 会成环（entry_service→star_service 是既有单向边）。**解**：`team_membership_exists` 已在 `services/team_membership.py`（上述落点锁定），star_service 直接 import 该薄模块，无环；行级判定与 entry_service 共用同一 WHERE 形态，list_entries 用 SQL 表达式 EXISTS（无 session 二次查询）。两处形态由 BDD-14/15 星标闭环用例 + BDD-26 EXPLAIN 兜底。
- **7 路径核对表（A1-A7 × 收敛机制）**：A1 get_entry=can_read；A2 list_entries=EXISTS 表达式；A3 _resolve_entry=delegate get_entry（team 成员经 get_entry 放行）；A4 resolve_entry_raw share 分支：share 前先走 get_entry 判定（entry.team_id 且成员 → get_entry 200 → 不进 share 分支；非成员 → 404，share 分支只对"有合法 share token 的访问者"开放——get_entry_with_share 语义不变 BDD-13）；A5 get_entry share 分支/_check_share_cookie：同样先走 get_entry（成员正常读、share cookie 仅服务 share 访问者，响应不含 team 字段）；A6 get_entry_with_share 不改（share 语义，响应 team=None）；A7 download：全局 key → get_entry_by_api_key（可读一切）；其余 → get_entry + share cookie 兜底不变。**共享契约**：share 访问者响应一律不含 team 字段（team_membership 只对登录用户判定）。

### 3.3 teams API（无权一律 404）

| 方法 | 路径 | 权限 | 实现要点 |
|---|---|---|---|
| POST | `/api/v1/teams` | 登录 | name 校验 + slug 生成/`-N` 重试；owner=当前用户；201 TeamDetail |
| GET | `/api/v1/teams` | 登录 | owned = owner_id=me；joined = member 且非 owner；各 TeamSummary{slug,name,member_count} |
| GET | `/api/v1/teams/{slug}` | owner+成员 | TeamDetail + members[{id,username}]；无关者 404（BDD-7） |
| PATCH | `/api/v1/teams/{slug}` | 仅 owner | 重命名（owner 内重名→409/400 明确错误） |
| DELETE | `/api/v1/teams/{slug}` | 仅 owner | entries.team_id SET NULL（自动）→ entry 转 private |
| POST | `/api/v1/teams/{slug}/members` | 仅 owner | username 不存在→404（BDD-9）；已是成员→409/400"已是成员"；添加 owner 自己→校验拒 |
| DELETE | `/api/v1/teams/{slug}/members/{user_id}` | 仅 owner | 移除成员 |
| POST | `/api/v1/teams/{slug}/leave` | 成员本人 | 自助退出（owner 调用→404/400，owner 不能退） |

- 非 owner/非成员一律 `NotFoundError`（404，非 403）——管理探测与详情探测同语义（BDD-8 成员管理写权 404，读权 200 由 GET 详情承载）。
- owner 判定：`teams.owner_id == current_user_id`；admin **不自动接管**（design-note §5.7；BDD-19/20）。
- 错误码复用 exceptions：404 NotFoundError / 400 ValidationError（重名、非法 name）/ 409 按需（重名或与 400 合并，BDD-42 只锁三文案互异不锁状态码）。

### 3.4 CLI 与 PeekClient（BDD-31~34）

- **本地模式归属（R4 契约）**：本地 create/list/teams 加 `--user <username>`，**本地模式必填**——参照 apikey create 的 `--user` 先例（cli.py:1920 `Username (required in local mode)`，本地缺 --user 即报错 exit 1，:1943-1945），**不是** user_cmd group（user_cmd 无 --user 选项）。P1 BDD-31~33 已由主 Agent 批准增补 `--user alice` 锚（[BASELINE_CHANGE] 2026-09-02），本节示例与 BDD When 一致：`peekview teams --user alice` / `peekview create -s 报告 --team proj-a --user alice file.md` / `peekview list --team proj-a --user alice`。local 解析 = `_resolve_user_local`(:2077) → 以该 User 为 current_user 调 TeamService/EntryService（create 传 current_user_id=user.id 使 owner 判定成立）。**注意**：现状本地 create 不传 current_user_id → owner_id=NULL 匿名条目（test_cli 全断言基于此）。加 --team 的本地 create 必须以 --user 归属，否则 team 校验（成员）无解；不带 --team 的 create 行为保持现状（owner_id=NULL，回归 BDD-25 语义不变）——--user 仅在本任务 team 相关命令上启用，防破坏既有 create 语义（--user 单独提供对非 team create **不改归属**）。
- **CLI 本地 DB 迁移路径（R1 锁定）**：本地模式 `_get_backend`(cli.py:78) 与 `_resolve_user_local`(cli.py:2079) 的 `init_db(config.db_path)` **改传 `run_migrations=True`**（方案 1：幂等，与 serve 同语义——存量旧库先跑 CLI teams/--team 前即完成 entries.team_id 加列 + 两索引迁移；全新 CLI 直建库也建全索引，杜绝 SchemaMismatchError / BDD-26 索引线失效）。`check_schema` 保留（迁移后校验）。**P3 测试缺口（本修订补）**：CLI 本地直建库含 `idx_entries_team_id`/`idx_team_members_user_id` 两索引断言 + 旧库（无 team_id）先跑 `peekview teams` 自愈迁移断言（BDD-16/17/26/31 覆盖）。
- `peekview teams --user U [--json]`：owned/joined 分区输出 `{owned:[{slug,name}], joined:[...]}`。
- `create --team {slug}`：与 `--visibility public` 互斥 → fail fast 报错 exit≠0（BDD-32）；远程模式 PeekClient.create_entry 透传 team_id（BDD-34）；错误信息含"先运行 peekview teams 查看你的 team"。
- `list --team {slug}`：显式过滤（本地传 team slug 给 service；远程经 PeekClient.list_entries(team=slug)）。
- PeekClient 补 `list_teams()`（GET /api/v1/teams，Bearer/X-API-Key 已有）→ CLI 远程 teams 用。

### 3.5 性能回归（BDD-26）

pytest 内嵌 `EXPLAIN QUERY PLAN` 断言：构造含 team 成员与 team entry 的 fixture，对"成员视角 list + team 可见 EXISTS"查询 `EXPLAIN QUERY PLAN` → 断言输出含 `idx_team_members_user_id`/`idx_entries_team_id` 相关条目、无 entries/team_members 的裸 `SCAN` 行。用 sqlite `EXPLAIN QUERY PLAN` 文本断言（SQLAlchemy `text()` 直跑）。

## 4. MCP 设计（BDD-35~37）

- `create_entry`/`publish_files` zod schema 加 `team_id: z.string().optional()`（slug 形态）；handler 透传 `client.createEntry({... team_id})`。
- description 追加 TEAM VISIBILITY 块（两工具一致）：
  ```
  TEAM VISIBILITY:
  - To publish to a team (visible to team members only):
    1. Call list_teams to see your teams
    2. Pass team_id from the result, e.g. {"team_id": "proj-a"}
  - IMPORTANT: if you omit team_id, the entry follows is_public (default: PUBLIC!)
  ```
- 新增 `listTeams.ts`（无参只读）→ `client.listTeams()` → GET /api/v1/teams → `{owned:[{slug,name,member_count}], joined:[...]}`；注册进 `tools/index.ts` 的 common（local 与 remote 双模式都有——list_teams 是只读查询，无 create 语义冲突）。
- `get_entry` 输出 base 加 `team: {slug,name}|null`：MCP get_entry 走后端 `/raw`（fetchEntryRawAuthenticated）→ **EntryRawResponse 加可选 `team` 字段**（[SCOPE+ §12 第二项，主 Agent 已采纳；§0.1 B 表 N4 行）——仅 owner/成员/全局 key 时非 null（files.py resolve_entry_raw 三个分支都可得 entry.team_id），share 访问者 raw 不含（响应 team=null）。
- 全局 master key get_entry：files.py resolve_entry_raw 的全局 key 分支（:403-412）已直读 entry → raw 响应加 team 需该分支也解析（全局 key 可读一切 → 附 team）；非全局 key 的 get_entry（/entries/{slug} 端点）已有 get_entry 收敛（A7 下载端点补 get_entry_by_api_key）。BDD-36 断言全局 key 200。

## 5. 前端设计（BDD-38~43）

### 5.1 Explore 5-tab 结构（EntryListView.vue）

- tab 行：`All | Mine | Teams | Archived | Starred`。新增 data-testid 到全部 5 tab（`tab-all`/`tab-mine`/`tab-teams`/`tab-archived`/`tab-starred`，现有 `tab-starred` 保留命名兼容）。
- **状态维度（组件本地）**：`currentOwner / currentStatus / currentStarred / currentTags`（现状）+ `currentTeam` + `activeView`（'all'|'teams' 派生，URL `view` 参数）。
- 高亮规则：All 激活 = `!currentOwner && !currentStatus && !currentStarred && !currentTeam && view!=='teams'`；Teams tab 激活 = `view==='teams'`（可叠加 team chip）。
- **范围声明（防 P4 歧义）**：高亮规则 = 现状语义 + team 扩展（All 激活判定补 `!currentTeam`），**不重构 archived/starred 与 All 的既有激活关系**（现状 status=archived 时 All 仍激活的双激活路径保留，非本任务范围；BDD-38 只断言 Teams/All 互斥）。
- Teams tab（无 chip）= `team=me` 聚合；点具体 team chip → `team={slug}` + chip 显示；chip 用 `FilterChip`（aria-label 参数化"移除团队过滤：{teamName}"）。
- 本任务新增态/容器/交互的**稳定测试标识集中在 §5.7 清单**（实现按清单落 `data-testid`，P3/P6 定位用 testid 不用 class）。

### 5.2 单一"不可用"态（BDD-41）

- 客户端维护"我的 teams"（GET /teams on mount/auth，登录后加载进 `stores/team.ts` myTeams，见 §5.5 动作清单）。
- URL `team={slug}`：slug ∈ my teams → 正常加载（成员但无内容 → "该团队暂无内容"）；slug ∉ my teams 或 team 不存在 → **不调用** listEntries，直接渲染"团队不可用"态 + "清除过滤"CTA。匿名带 team/view → auth 门控（同 starred），恢复忽略。
- **判定依赖 myTeams 已加载（防竞态误判）**：不可用态判定只发生在 myTeams settle 之后（登录态已确定且 GET /teams 已返回）；匿名 / myTeams 加载中窗口 → 不渲染不可用态、不判定 slug，等待 auth/myTeams settle 后再判（空态/loading 优先）。
- **三态文案归属表（语义可区分，BDD-41）**：

  | 场景 | 呈现态 | 文案 | 是否调 listEntries | testid |
  |---|---|---|---|---|
  | teams 聚合（`view=teams` 无 chip）且我无任何 team | 空态 | 「暂无团队内容」 | 是（返回空） | `teams-empty` |
  | `team={slug}` ∈ myTeams 但该 team 无 entry | 空态 | 「该团队暂无内容」 | 是（返回空） | `team-empty` |
  | `team={slug}` ∉ myTeams / team 不存在 | **不可用态（非空态）** | 「团队不可用」+ 清除过滤 CTA（可选附 team slug 名帮助理解，本地 myTeams 已知 slug） | **否**（不调接口） | `team-unavailable` / `team-unavailable-clear` |

- **badge 渲染声明（list 视图边界，防过度渲染）**：非 owner 列表项**不显示任何可见性 badge（含 team badge）**——EntryCard（现状 isOwner||isExpired 才显示 footer badge 区）与 EntryListRow（现状 :84 `v-else-if="isOwner"`）两视图一致；team badge 仅在 owner 视角/成员自身可见处渲染，private 语义不叠加（§5.3 badge 优先级）。

### 5.3 卡片 toggle 守卫（BDD-39/40）

- `EntryCard`/`EntryListRow`：`entry.teamId` 非空 → 隐藏 toggle（可见性切换）按钮（:7-11/:88-95），title/tooltip「此内容为团队可见，请在编辑中调整」；badge：`teamId ? 'team' : (isPublic ? 'public' : 'private')`（两视图统一，:96-98/:82-84）。
- **隐藏边界（防整组误删）**：toggle 与 delete 按钮同容器（EntryCard card-actions :3-20 / EntryListRow entry-actions :86-105）——仅隐藏 **visibility toggle 按钮**，**delete 保留**；同一隐藏语义对两视图的 toggle 目标统一 testid `visibility-toggle`（断言 count=0，见 §5.7），detail 溢出菜单的 Make Private/Public 项**不改**（§0.2-8，store 守卫拒绝）。
- `entryList.ts toggleVisibility` 顶部：`if (entry.teamId) { toast?; return false }`（守卫，UI 与 store 双保险）。
- BaseBadge：加 `team` 变体（色板用现有 token——建议 `--c-badge-shared-bg`/`--c-warning` 同类警示系或新增 token 命名沿用 `--c-badge-*-bg` 规范，**禁裸 hex/emoji**）；label 参数化 `label?: string`（默认 = status 词，team 时传「仅团队可见 · {teamName}」）+ aria-label 支持（badge 文案即 aria，无需额外）。

### 5.4 状态 × URL 矩阵与恢复收敛

- 四维互斥 `setFilter(owner, status, starred, team/view)`：点任一 tab/入口清其它维度（含 tags？tags 与 view 可共存——现状 tags 与 owner/status 共存，保持）。
- URL：`view` 表达聚合态（teams）、`team` 表达具体过滤；URL 恢复时**静默丢弃非法组合**（互斥矩阵外组合，如 owner=me+team=x → 丢 team）。
- 恢复三处（restoreFromURL / onBeforeRouteUpdate / watch(authState)）收敛为**单一 restore 函数**（`applyUrlToState()`），消除现在三处逻辑漂移（现状三处已不一致，本任务顺带收敛——属必要的矩阵承载改动）。
- updateURL/loadEntries：team/view 并入单一查询对象透传（9 调用点统一）。
- auth 登出：currentTeam 清零 + 焦点归还 hack（:469 querySelector('.owner-tab')）随清零一起。

### 5.5 /teams 管理页（TeamsView.vue + 入口）

- 路由 `/teams`（守卫：未登录 → '/'）；双入口：UserMenu 加 Teams 项（data-testid `user-menu-teams-item`）+ explore Teams tab 内"管理团队"链接（data-testid `teams-manage-link`）。防 /stars 无入口反模式（BDD-42 DOM 断言）。
- 结构（参照 SettingsView 桌面 tab + mobile-stacked 双形态）：
  - **我拥有的（`teams-owned` 分区）**：新建表单 + team 卡（管理 → 详情：成员列表[移除] / 添加成员 username / 重命名 / 删除 team[确认框含"该团队的所有内容将转为仅自己可见"后果提示，alertdialog]）；owner 不显示退出。
  - **我加入的（`teams-joined` 分区）**：只读卡 + 退出团队（确认后消失）。
- 状态：loading（分区 skeleton）/ 成员空（"暂无成员…"）/ 添加失败三类（username 不存在 / 已是成员 / 无权操作——三文案互异，BDD-42）/ 重命名重名提示 / 删除确认 / 离开确认。表单：username input label + aria-describedby 错误关联；操作结果 live region（`role="status"`，testid `teams-status-live`）。
- **新建表单组件级输入/输出（design N2）**：容器 `team-create-form`；name 输入 `team-name-input`（label + aria-describedby 关联错误，校验：空 / 超长 / owner 内重名——实时错误提示，错误区 `team-error`）→ 提交成功（后端 201 TeamDetail）→ **slug 自动生成并展示于 owned 分区**（成功反馈 = 新卡出现在 `teams-owned` 顶部 + live region 播报「已创建团队 {name}」+ 清空 name 输入）；失败（重名 / 网络）→ 错误区显示 + live region 播报，输入保留供修正。添加成员：username 输入 `team-member-username-input` → 成功即入成员列表（**该成员即时可读，无缓存窗口**——与 BDD-23 语义一致：成员快照只作 UI 判定用，服务端读权实时判定；失败三类错误入 `team-error`）。
- 新团队/管理操作调 `api` 新方法（client.ts 加 teams 全套：listTeams/listTeam/createTeam/renameTeam/deleteTeam/addMember/removeMember/leaveTeam）→ types/API raw types 同步。
- **stores/team.ts myTeams 动作清单（design N2）**：① 加载时机——登录成功后 + explore/teams mount 时（登录前不加载，匿名 myTeams 空）；② 登出清零——auth 登出时 myTeams=[]（焦点归还 hack 同 §5.4）；③ /teams 增删改后同步——createTeam/renameTeam/deleteTeam/addMember/removeMember/leaveTeam 成功后更新本地 myTeams（owned/joined 分区重算）；④ 过期语义——myTeams 是**当前会话快照**（成员被移出后刷新 team 列表才生效，与 BDD-23"权限判定基于当前成员关系、服务端无缓存窗口"一致：快照只影响 explore 不可用态/空态判定，不承载读权）；⑤ explore 与 /teams 共享同一 store 实例（单一来源）。**新增 store 仅承载 teams 数据与成员判定**，不承载 explore 查询态，与候选 A 不冲突。

### 5.6 移动端 + a11y + DESIGN.md

- tab 栏：`role="tablist"`（容器）+ `role="tab" aria-selected` 5 按钮；键盘导航**锁定 tablist + 方向键**（←/→ 在 tab 间移动焦点，Home/End 到首/末，激活 tab 跟随；`aria-pressed` 最低限度方案不采用——BDD-43 断言锁 tablist 语义 + 方向键）；移动端 `.owner-tabs` 改 `overflow-x:auto` + `scrollbar-width:none` + 末尾 fade；tab 触达高 ≥44px（现 :681 padding ≈32px 不足 → 加 min-height）；修订 DESIGN.md :200-201。
- 过滤结果变化复用现有 sr-only live region；badge 文字+图标成对（无 icon 时文字自足 + aria-label 含"仅团队可见"）。
- 桌面（1280×800）/移动（390×844 / Pixel5 E2E project）两档截图留给 P6。

### 5.7 稳定测试标识清单（data-testid，design N2 集中节）

> 仿 §6.5 先例（star.spec.ts 引"P2-design §6.5 稳定测试标识"）。P4 实现按清单落 testid（class 可重构、testid 不变）；P3/P6 定位一律用 testid 不用 class。既有 `tab-starred` 命名保留兼容。

| 元素 | testid | 断言用途 |
|---|---|---|
| 5 tab | `tab-all` / `tab-mine` / `tab-teams` / `tab-archived` / `tab-starred` | BDD-38 高亮互斥（唯一激活） |
| 具体 team chip（FilterChip） | `team-chip-{slug}`（chip 容器 testid） | BDD-38 chip 过滤态 |
| 不可用态容器 + 清除 CTA | `team-unavailable` / `team-unavailable-clear` | BDD-41 不可用态渲染 + CTA |
| teams 聚合空态 | `teams-empty` | BDD-41 三态之一 |
| team 空态（成员无内容） | `team-empty` | BDD-41 三态之一 |
| 卡片/行 badge（team 变体） | `badge-team` | BDD-39「team entry 不渲染 private badge」的存在/不存在断言 |
| visibility toggle 按钮 | `visibility-toggle`（EntryCard 与 EntryListRow **统一命名**） | BDD-40 隐藏后 **count=0** 断言目标 |
| /teams 我拥有的分区 | `teams-owned` | BDD-42 新建成功入分区 |
| /teams 我加入的分区 | `teams-joined` | BDD-42 退出后消失 |
| 新建团队表单 / name 输入 | `team-create-form` / `team-name-input` | BDD-42 新建输入态 |
| 添加成员 username 输入 | `team-member-username-input` | BDD-42 成员输入态 |
| 错误区（新建/成员操作共用） | `team-error` | BDD-42 三错误文案互异断言 |
| 操作结果 live region | `teams-status-live` | 成功/失败播报断言 |
| 双入口 | `user-menu-teams-item` / `teams-manage-link` | BDD-42 DOM 存在性 |
| 删除/退出确认 | ConfirmDialog 复用（alertdialog role 可定位，无独立 testid 亦可） | BDD-42 确认对话框 |

### 5.8 detail 状态标签三态（BDD-44 [SCOPE+] 实现规格）

- 改动点：`EntryDetailHeader.vue:68` + `EntryMetaTagsBar.vue:7` 现状按 is_public 渲染 Public/Private（独立 span.status-tag，实读确认）；`EntryDetailMobileBar.vue` **不改**（无可见性标签，实读确认）。
- **三态逻辑（写死）**：`teamId ? team 文案 : (isPublic ? 'Public' : 'Private')`——team entry 显示「仅团队可见 · {teamName}」语义文案（含"团队"/team 名称），不显示 Private；private 仍 "Private"、public 仍 "Public"，三态可区分。
- **实现载体二选一（锁定前者）**：**BaseBadge status union + team 变体**（复用 §5.3 的 BaseBadge team 变体，detail 标签与卡片 badge 视觉一致）——不就地扩展 span.status-tag；detail 两处与卡片同源渲染。
- P6：三态逐态 Playwright 断言 + 截图（与 §5.5 输入态复核同法，落为自动化动作非散文"人工复核"）。

## UI 设计（ui_affected: true 必含）

### 渲染形态声明（与 P1 一致）
- 渲染形态: layout（布局型）
- 适用维度: 布局结构、交互行为（视觉呈现维度为辅助——本任务全部 UI 沿用既有设计系统 token，无新色板/字体/图标，故视觉 checklist 以"沿用约束"形式覆盖）

### 布局 checklist（布局结构维度）
- [x] 页面/组件层级：explore header（logo+UserMenu+ThemeToggle）→ toolbar（5-tab 栏 / chips / 搜索 / grid-list toggle）→ 内容区（grid: EntryCard / list: EntryListRow）→ footer；新增 Teams tab 与 chips 在既有 toolbar 结构内扩展，不新建 shell
- [x] 关键区域占位：主区=entry 列表；弹层=/teams 删除确认（ConfirmDialog alertdialog 复用）、/teams 新建表单为内联表单非弹层
- [x] 桌面与移动两档：桌面 5-tab 横排 1 行；移动 <768px tab 栏 overflow-x 横滚（无换行堆叠）、触达 ≥44px；/teams 页桌面分区并排、移动 mobile-stacked 堆叠（参照 SettingsView）
- [x] badge 放置：EntryCard footer badge 区（:96-98）、EntryListRow entry-right（:82-84）——team badge 与 private 不叠加（teamId 优先）；长 teamName 截断 ellipsis + title 全名

### 交互 checklist（交互行为维度）
- [x] 键盘可达：tab 区 role=tablist/aria-selected + 方向键（§5.6 锁定 tablist+方向键）；所有 toggle/删除/退出按钮原生 button；登出焦点归还 hack 随 currentTeam 清零
- [x] 输入态规格已设计（非"待人工复核"散文）：§5.5 新建 name/添加成员 username 的输入→输出逐态规格（校验/成功/失败 + live region）；§5.2 URL team 非法 → 不可用态；§5.8 detail 三态——实现细节已落设计节
- [x] 反馈：loading（列表 skeleton / /teams 分区 loading）、error（错误 toast/态）、empty（§5.2 三态文案表：「暂无团队内容」vs「该团队暂无内容」vs「团队不可用」+ 不可用态区分）、disable（成员空时移除按钮 disabled 等）、删除/退出确认对话框
- [x] 输入态变化类用例的 P6 复核落为**明确自动化动作**：teams-page.spec.ts 内输入态**逐态 Playwright 断言 + 截图**（新建 name 空/超长/重名→错误文案；创建成功→owned 分区出现 + slug 展示；添加成员 username 不存在/已是成员/无权→三文案互异断言；URL team 非法→不可用态）——不再用散文"人工复核"承接

### 视觉 checklist（视觉呈现维度——沿用既有设计系统）
- [x] 颜色/对比度：全部用现有 `--c-*` token（tab active=--c-accent、badge team 变体复用 badge token 族/警示语义色），无新 hex；文字对底色沿用既有 WCAG AA 保证；禁 emoji（DESIGN.md）
- [x] 字体层级：tab `--font-sm` 500、badge `--font-xs` mono capitalize（BaseBadge 现状）、/teams 页 h1/分区标题沿用 Settings/Stars 层级
- [x] 组件一致性：tab/chip/badge/确认框均复用既有组件与 token（无新增圆角/阴影/图标风格；tab ≥44px 触达是唯一 CSS 规范修订并同步 DESIGN.md）

## 6. gate_commands（P2 固化，P4-P6 不得改）

```yaml
gate_commands:
  P3: "make test-quick"                  # backend TDD 红灯运行器（check-tdd-red 消费；P3 不受 timeout_seconds 管理，走 AGATE_TDD_TIMEOUT）
  P3_frontend: "make test-frontend"      # frontend vitest（BDD-38~43 组件测试落点）
  P3_mcp: "make test-mcp-unit"
  P5: "make test-quick"
  P5_frontend: "make test-frontend"
  P5_mcp: "make test-mcp-unit"
  P5_typecheck: "make typecheck"
  P5_lint: "make lint"          # ⚠️ bash 沙箱 ruff 不在 PATH：须 PATH=backend/.venv/bin:$PATH make lint（见 env_constraints）
  P5_e2e_a: "E2E_SPEC=e2e/team-visibility.spec.ts make debug-test"
  P5_e2e_b: "E2E_SPEC=e2e/teams-page.spec.ts make debug-test"
  P5_timeout_seconds: 240
  P5_frontend_timeout_seconds: 180
  P5_mcp_timeout_seconds: 120
  P5_typecheck_timeout_seconds: 180
  P5_lint_timeout_seconds: 120
  P5_e2e_a_timeout_seconds: 300
  P5_e2e_b_timeout_seconds: 300
  P6: "make test-quick"
  P6_frontend: "make test-frontend"
  P6_mcp: "make test-mcp-unit"
  P6_e2e_a: "E2E_SPEC=e2e/team-visibility.spec.ts make debug-test"
  P6_e2e_b: "E2E_SPEC=e2e/teams-page.spec.ts make debug-test"
  P6_timeout_seconds: 240
  P6_frontend_timeout_seconds: 180
  P6_mcp_timeout_seconds: 120
  P6_e2e_a_timeout_seconds: 300
  P6_e2e_b_timeout_seconds: 300
  project_module: "backend/peekview"
```

- **拆键说明（R3）**：每键一条命令、无 `&&` 链（`--strict` 短路反模式规避）；backend/frontend/mcp 三端独立键——P3 的 `P3_frontend`/`P3_mcp` 供红灯阶段确认前端/mcp 单测归位（若 run-test-with-formatter 只消费 P3 主键，其余键按各自阶段单独实跑）；P6_e2e 拆 `a`/`b` 两键逐 spec 跑（run-e2e-tests.sh 单 spec 传参，`E2E_SPEC` 不支持逗号多 spec——P6 两键各跑一次，teams-page.spec 承载 BDD-42，team-visibility.spec 承载 BDD-38~41/43）。timeout_seconds 为静态声明（层级 1），实际 shell 超时 = 预期耗时 ×1.5。

- P5/P6 另含非 gate 键的逐条验收动作（权限矩阵实跑、EXPLAIN、BDD 逐条、UI 截图），由 P5/P6 阶段按 P1 §8/P2 §11 执行。
- E2E spec 命名：新增 `frontend-v3/e2e/team-visibility.spec.ts`（explore 5-tab + team chips + badge + 不可用态 + 卡片 toggle 守卫 + 移动端 tab 横滚），`e2e/teams-page.spec.ts`（/teams 双入口 + owner 全操作 + 成员退出 + 错误三文案 + 删除确认 + 输入态逐态断言，BDD-42）。P6 逐 spec 跑（与 run-e2e-tests.sh 单 spec 传参语义一致）；全量 `make debug-test` 已知 >5min CDP 可能超时（TPV0093 教训），不设全量 E2E gate 键。

## 7. files_to_read（P4 上下文地图）

```yaml
files_to_read:
  - path: backend/peekview/database.py:40-215, 264-352
    why: _run_migrations 既有 ALTER/CREATE 幂等模式 + init_db 顺序（新 migration 段插入点）；_setup_indexes 索引先例
  - path: backend/peekview/models.py:105-240, 466-520, 585-760
    why: User/Entry 表模型与 __table_args__ 模式；EntryCreate/EntryUpdate/CreateEntryRequest 加 team_id；EntryResponse/EntryListItem/StarItem/Team schema 参考与新增位置
  - path: backend/peekview/services/team_membership.py
    why: 新增薄模块（EXISTS 助手），entry_service/star_service 共用免环
  - path: backend/peekview/services/entry_service.py:48-124, 124-324, 326-384, 385-629, 631-800, 1095-1155
    why: can_read_entry/import team_membership 区、create/get/list/update/_build_response 的 team 改动落点（行号含 archived 分支 :343-355 不动边界；team_membership_exists 本体在 team_membership.py，不在此定义）
  - path: backend/peekview/services/star_service.py:337-389
    why: _build_star_item 可见性条件加 team 成员项（import team_membership.py 助手）
  - path: backend/peekview/services/share_service.py:38-190, 267-287
    why: 三接口 403→404 + revoke_all_for_entry（update 撤销复用）
  - path: backend/peekview/services/team_service.py
    why: 新增（参照 share_service.py 结构 + entry_service._retry_with_slug_suffix slug 冲突模式）
  - path: backend/peekview/api/teams.py
    why: 新增 9 路由（参照 api/shares.py 薄封装 + require_auth/get_current_user）
  - path: backend/peekview/api/entries.py:37-67, 183-312, 339-390, 467-537
    why: share 分支收敛次序、update 传 team_id、download 补 get_entry_by_api_key
  - path: backend/peekview/api/files.py:130-176, 352-433, 516-524
    why: _resolve_entry / resolve_entry_raw share 分支收敛；raw 响应加可选 team 字段（[SCOPE+] N4-eng：仅 owner/成员/全局 key 附 team）
  - path: backend/peekview/main.py:196-243, 425-445
    why: team_service 注册 + teams_router include
  - path: backend/peekview/exceptions.py:34-70, 178-190, 226-236
    why: ValidationError(400)/ParameterValidationError(422，**team 校验契约锁用此 = 422，见 §3.1 D2**)/NotFoundError/ForbiddenError 语义
  - path: backend/peekview/cli.py:43-81, 215-353, 424-546, 1482-1553, 1920-1960, 2077-2090
    why: _get_backend(:78 run_migrations=True 改点)、create/list 加 --team/--user、teams 子命令（参照 apikey create --user cli.py:1920，非 user_cmd）、_resolve_user_local(:2077 run_migrations=True 改点)
  - path: backend/peekview/client.py:137-233
    why: create_entry 透传 team_id、list_entries 加 team、list_teams 新增
  - path: backend/peekview/services/admin_service.py:716-850
    why: restore 边界（[SCOPE+] teams merge 缺口理解，不改）
  - path: backend/peekview/auth.py:138-235
    why: get_current_user/require_auth 依赖模式（teams 路由依赖）
  - path: frontend-v3/src/views/EntryListView.vue
    why: 5-tab/team chips/状态矩阵/URL 恢复收敛（改动核心，读全文）
  - path: frontend-v3/src/views/searchUrl.logic.ts
    why: mergeQuery/parseRestoreQuery 扩展 team/view
  - path: frontend-v3/src/stores/entryList.ts:19-73
    why: loadEntries params + toggleVisibility team 守卫
  - path: frontend-v3/src/stores/team.ts
    why: 新增 myTeams store（explore + /teams 共享）
  - path: frontend-v3/src/types/index.ts:9-70
    why: Entry/ListEntriesParams + Team 类型
  - path: frontend-v3/src/api/types.ts:4-60
    why: EntryResponse/EntryListItemResponse snake_case 原始字段
  - path: frontend-v3/src/api/client.ts:52-163, 205-263
    why: transform 三处 + listEntries/updateEntry 参数 + teams API 新方法
  - path: frontend-v3/src/components/BaseBadge.vue
    why: team 变体 + label 参数化
  - path: frontend-v3/src/components/EntryCard.vue:1-150 + EntryListRow.vue:1-130
    why: badge 优先级 + toggle 隐藏
  - path: frontend-v3/src/components/FilterChip.vue
    why: dismiss aria-label 参数化
  - path: frontend-v3/src/components/UserMenu.vue
    why: Teams 入口（参照 Settings 项 :10）
  - path: frontend-v3/src/router.ts:6-53, 85-99
    why: /teams 路由 + 守卫
  - path: frontend-v3/src/views/SettingsView.vue + components/UserManagerTab.vue
    why: 页面骨架 + 管理型 tab 操作/表单/错误处理参照（/teams 页）
  - path: frontend-v3/src/components/ConfirmDialog.vue
    why: 删除/退出确认（alertdialog）复用
  - path: DESIGN.md:200-201
    why: Tabs 规则修订文字
  - path: packages/mcp-server/src/tools/createEntry.ts + publishFiles.ts:124-338
    why: schema team_id + description TEAM VISIBILITY 硬提示
  - path: packages/mcp-server/src/tools/listEntries.ts
    why: list_teams 工具结构参照
  - path: packages/mcp-server/src/tools/index.ts:16-33
    why: list_teams 注册到 common
  - path: packages/mcp-server/src/client.ts:152-205
    why: createEntry payload team_id + listTeams + getEntry team
  - path: packages/mcp-server/src/types.ts:20-70
    why: Team/TeamList 类型 + EntryResponse team 字段
  - path: packages/mcp-server/src/tools/getEntry.ts:55-110
    why: 输出 team 字段
  - path: VERSIONS.json + Makefile:163,173,185,193,648,702
    why: 版本源与 gate target 真相源（P8/P5 用）
```

## 8. env_constraints

```yaml
env_constraints:
  debug_env: |
    - 后端：make test-quick（backend/.venv/bin/python -m pytest tests/ -n auto，conftest autouse 隔离 tmp）
    - 前端：make typecheck / make test-frontend（vitest run）
    - MCP：make test-mcp-unit（packages/mcp-server npm run test:unit）
    - 集成/E2E：make debug-start（:8888 /tmp/peekview-debug/）→ E2E_SPEC=... make debug-test；debug-seed 用户 alice/bob/carol(testpass123)；CDP Chrome :18800
    - 多实例（可选）：make debug-extra PORT=8889（数据 /tmp/peekview-debug-8889/）
    - CLI 远程测试：test_cli_remote.py 自起临时 server（xdist worker 端口 18888+），隔离自动
  lint_note: |
    ⚠️ bash 沙箱中 ruff 不在 PATH（在 backend/.venv/bin/）——跑 make lint 前须 export PATH=backend/.venv/bin:$PATH（或 PATH=backend/.venv/bin:$PATH make lint）；typecheck 需 frontend-v3/node_modules（make test-frontend 会自动 npm ci）
  isolation_check: |
    - 测试隔离：pytest conftest autouse（PEEKVIEW_STORAGE__DATA_DIR/DB_PATH → tmp_path）；debug :8888 → /tmp/peekview-debug/；禁止触碰 :8080 生产 / ~/.peekview/ / pipx peekview
    - CLI 本地 teams/--team 测试：设 PEEKVIEW_STORAGE__* 指向 tmp（test_cli.py isolated_fs 同款）
    - MCP 集成测试仅指向 127.0.0.1:8888 debug backend，绝不 :8080
    - 测试 entry/team 只经 debug HTTP API 创建（铁律 6）；如需 team fixture P3 在测试代码内建，不改 seed-data
    - 状态标记：[PROD_NOT_TOUCHED]（本 P2 仅只读代码 + tmp sqlite 最小验证，未触碰生产）
```

## 9. minimal_validation

```yaml
minimal_validation:
  assumption: |
    - ① SQLite 迁移顺序：create_all 先建 teams/team_members 表、再 ALTER entries 加 team_id（FK 被引用表已存在）；DELETE team → entries.team_id SET NULL（BDD-16/17 前提）
    - ② 权限收敛点 7 处现状形态（A1-A7 是否多数已 delegate get_entry）
    - ③ 前端 create 表单不存在 → design-note §8.7 在 frontend-v3 无落点（改 UI 范围判定）
  method: |
    ① tmp sqlite3 脚本：旧库(users/entries 无 teams/team_id) → CREATE teams/team_members → ALTER entries ADD team_id FK SET NULL → DELETE team → 断言 SET NULL + PRAGMA foreign_key_check/integrity_check
    ② 读代码核对 A1-A7（entry_service.get_entry/list_entries、files._resolve_entry/resolve_entry_raw、entries.py _check_share_cookie/get_entry/download、get_entry_with_share）——收敛机制与 delegate 关系
    ③ grep frontend-v3 POST /entries 调用面（无 create UI）
  result: "confirmed"
  note: |
    - ① confirmed：tmp DB 实测"建 teams/team_members → ALTER entries team_id FK SET NULL → DELETE team"→ entries.team_id=None、foreign_key_check 空、integrity_check ok；与 database.py init_db(:302-306 create_all→_run_migrations) 顺序一致 → BDD-16/17 迁移前提成立，migration 段可安全插入
    - ② confirmed：7 路径中 A3(_resolve_entry)/A5(share cookie)/A7(download) 已 delegate service.get_entry → 收敛 = get_entry 判定扩展 + A4(raw share 分支)/A6(get_entry_with_share) share 语义保持 + list_entries/star 两处 SQL 条件扩展；收敛点落在 entry_service.get_entry 非 archived 分支 + 模块级 team_membership 助手
    - ③ confirmed：frontend-v3 无 POST /entries 调用（创建走 CLI/API/MCP）；UI 编辑面 = 卡片/溢出 toggle(is_public) + ExpiresInDialog(expires_in) → team 归属变更 UI = 隐藏 toggle + store 守卫（BDD-40），无新增创建/编辑表单
    - 纯代码逻辑声明：本方案除①的 SQLite 迁移顺序（依赖外部 SQLite 行为，已实测）外均为纯代码逻辑，无浏览器/外部服务行为依赖；依赖的内部转换 = team_membership_exists/EXISTS SQL + 权限矩阵收敛 + PATCH clamp + 校验契约（P3 用例全量覆盖）
```

## 10. 批次设计 / dispatch_plan（TAG0014）

- 工作量评估：后端（schema 迁移 + 权限收敛 + teams API + CLI + PeekClient）= **high**；前端（explore 矩阵 + /teams 页 + badge/toggle + 移动端）= medium；MCP（3 工具 + list_teams + client）= low。存在 high → **必须拆批**（不能单发）。
- 批次表（frontmatter dispatch_plan）：`static-batch`，parallel_limit 3：

| batch | 内容 | complexity | 产出/输入边界 |
|---|---|---|---|
| backend | models/database/entry_service/star/share/team_service/api/teams/main/cli/client/exceptions | high | 权限矩阵 + 迁移 + teams 全后端 + CLI（本地/远程） |
| frontend | EntryListView/searchUrl/entryList/types/api/components/router/teams store+view/DESIGN.md | medium | explore 矩阵 + /teams + badge/toggle + a11y + 移动端 |
| mcp | createEntry/publishFiles/listTeams/getEntry/client/types/index/VERSIONS(mcp 0.12) | low | schema + list_teams + description 硬提示 |

- **批次边界约束**：① 契约先行——P2 本文已锁 team 字段命名贯通链（models ↔ service ↔ api 响应 ↔ client.ts transform ↔ types ↔ MCP schema ↔ PeekClient ↔ CLI），三批共享契约文档 = 本 P2-design，不跨批改同一文件；② 跨批共享件单列：`VERSIONS.json`（backend + mcp 两批都声明 bump）由主 Agent 在 P8 统一处理，P4 各批**不**动版本号；`DESIGN.md` 归 frontend 批；③ 依赖方向：frontend/mcp 的字段契约依赖 backend 响应形状（本文 §2/§3 已定死 snake_case `team_id`/`team:{slug,name}`），并行实现无阻塞（单测/组件测试 mock，不依赖 backend 运行）；④ 资源密集：三批 gate（test-quick / test-frontend+typecheck / test-mcp-unit）非全量 E2E，并行可行；E2E/联调在 P5/P6（backend 完成后）统一跑，默认串行。
- batch gate：backend 批 → `make test-quick`；frontend 批 → `make test-frontend && make typecheck && make lint`（P4 本地验证串，非 §6 gate_commands 键）；mcp 批 → `make test-mcp-unit`。全量回归按 §6 gate_commands 拆键逐键跑（`P5`/`P5_frontend`/`P5_mcp`/`P5_typecheck`/`P5_lint` 各自独立，不 `&&` 链），由 P5 收口。

## 11. 实现完成标志（P3/P5 判定依据）

1. **迁移**：旧库（无 teams/team_id）init_db(run_migrations=True) 启动成功 + 存量完好 + 二次幂等（BDD-17 通过）；新库建表/索引齐全；`PRAGMA foreign_key_check`/`integrity_check` 在 team 删除后全过（BDD-16）；**全新库（create_all 路径）删 team/删 user 的 FK 行为断言**（模型层 ondelete 生效，见 §2 N1-eng）。
2. **权限矩阵**：`make test-quick` 中新增矩阵用例通过——public/team/private × 匿名/JWT成员/JWT非成员/owner/admin × 7 路径（get/list/raw/files-content/render/download/share-read）非成员一律 404、成员全放行（BDD-2/5）；归档 team entry 无星标成员 404、星标 200（BDD-6）。
3. **teams API**：9 路由 + 404 防枚举（BDD-7/8/9）+ name/slug 唯一（BDD-18）+ owner 禁用冻结/删除 CASCADE（BDD-19/20）。
4. **校验契约**：create/update team_id 不存在/非成员/匿名一律抛 `ParameterValidationError` → 响应 **422** 统一语义、绝不静默忽略（BDD-21/22/30，状态码断言非文案）；is_public 强制 false（BDD-27）；team→public 撤销 share（BDD-28）；成员口径迁移成功（BDD-29）。
5. **share/star**：share 三接口 403→404（BDD-11/12/13）；starred 列表含成员 team entry（BDD-14/15）。
6. **CLI**：`peekview teams --user alice` owned/joined 分区（BDD-31，--user 必填 fail fast 双路径）、`create --team proj-a --user alice` + `--visibility public` 互斥 fail fast（BDD-32）、`list --team proj-a --user alice` 显式过滤（BDD-33）、远程 PeekClient 透传 team_id（BDD-34）；**CLI 本地直建库含两索引断言 + 旧库先跑 `peekview teams` 自愈迁移断言**（R1 缺口，见 §3.4）。
7. **MCP**：create_entry/publish_files 带 team_id 发布成功 + list_teams 两分区 + description 硬提示（BDD-35/37）；get_entry team 字段 + 全局 key 200（BDD-36）。
8. **前端**：5-tab 高亮互斥（BDD-38）、badge 不叠加 private + detail 三态标签（BDD-39/44）、toggle 隐藏（delete 保留）+ store 守卫（BDD-40）、单一不可用态三态文案区分（§5.2 表）+ 判定依赖 myTeams 已加载（BDD-41）、/teams 双入口 + owner 全操作 + 成员退出 + 三错误文案互异 + 输入态逐态 Playwright 断言（BDD-42）、移动端 tab 横滚 + ≥44px + 键盘 tablist+方向键（BDD-43）。
9. **性能**：BDD-26 EXPLAIN 断言通过（无逐行子查询、索引命中）。
10. **回归**：§6 gate_commands 拆键逐键全绿——`P5` + `P5_frontend` + `P5_mcp` + `P5_typecheck` + `P5_lint`（既有 1068+ 后端用例 + 前端/mcp 单测零回归 = BDD-25 零变化线）。

## 12. 新隐含需求（[SCOPE+] 报告）

- [SCOPE+] 发现：**detail 页状态标签对 team entry 显示 "Private"**（`EntryDetailHeader.vue:68` / `EntryMetaTagsBar.vue:7` 按 is_public 渲染 Public/Private 文案，无条件）。成员打开自己的 team entry 详情看到 "Private"，与"团队内可见"语义相悖（误导）。
  必须做的理由：可见性档位新增后，详情头不区分 private 与 team 属于展示层语义失真；P1 BDD-39 只覆盖卡片 badge，未覆盖 detail 状态标签。
  影响：**主 Agent 已采纳** → P1 增补 BDD-44（[BASELINE_CHANGE] 2026-09-02）；改动点 = EntryDetailHeader.vue + EntryMetaTagsBar.vue（三态实现载体见 §5.8：BaseBadge status union + team 变体，与卡片 badge 视觉一致；不改 EntryDetailMobileBar）；§0.1 A 表已列行。
- [SCOPE+] 发现：**MCP get_entry 的 team 字段需后端 `/raw` 响应补 `team`**（design-note §7.1 "get_entry 响应加 team" 在 MCP 路径走 EntryRawResponse 而非 EntryResponse）。P1 A 表未列 raw 结构改动；BDD-36 的"成员 get_entry 响应含 team"若 raw 不含则无法满足。
  必须做的理由：MCP get_entry 唯一后端路径 = `/raw`（fetchEntryRawAuthenticated），team 字段必须在 raw 响应层贯通（仅 owner/成员/全局 key 附 team，share 访问者不附）。
  影响：**主 Agent 已采纳** → P1 基线备注更新（raw 响应结构含可选 team 字段）；改动点 = files.py resolve_entry_raw + models.EntryRawResponse（§0.1 B 表 N4 行 + §4 MCP 已列）；不改 packages。
- [SCOPE+] 发现：**backup restore 的 merge 模式不拷贝 teams/team_members/entries.team_id**（admin_service._restore_merge 逐表清单无 teams，新版本 backup 在旧目标 merge 时丢 team 关联；replace 模式天然完整）。
  必须做的理由：本任务引入新表后，restore merge 成为"导入旧 backup 或跨库 merge"时的数据不完整点（预存缺口，非本任务引入的回归——现状 restore 本就不全量）。
  影响：不改（超出验收路径，§0.2-11）；建议记入 roadmap/improvement-backlog 或后续任务；不阻塞本任务。
- [SCOPE+] 发现：**CLI 本地模式 create/list 的 owner 语义**——现状本地 create owner_id=NULL（匿名条目）。本任务 teams 相关命令引入 `--user` 归属（仅 team 场景启用），非 team 的本地 create 行为保持不变。若未来要"本地 CLI 以 --user 身份创建归属条目"是独立特性（超出 BDD），记录不扩。

## 13. 备注

- P7 交叉核对：P4 若因实现歧义自主决策须标 `[DESIGN_GAP:]`；P7 逐条转抄 + REVIEWED。
- P8：peekview 0.21.0→0.22.0（minor，新功能+schema）+ mcp_server 0.11.0→0.12.0（schema 向后兼容）；VERSIONS.json 唯一源双路径检查。
- CHANGELOG：[Unreleased] 及时记录（铁律 8）。
