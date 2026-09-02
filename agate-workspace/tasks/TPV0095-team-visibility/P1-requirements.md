---
phase: P1
task_id: TPV0095-team-visibility
type: problems
parent: P0-brief.md
trace_id: TPV0095-P1-analyst-20260902
status: draft
created: 2026-09-02
agent: analyst
risk_level: high
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
- backend/peekview
- frontend-v3
- packages/mcp-server
domains:
- backend
- frontend
- mcp
- security
ceremony: standard
ui_render_shape: layout
ui_ux_dimensions:
- 布局结构
- 交互行为
---

# P1 需求基线 — 团队可见性机制 Team Visibility（TPV0095）

[NO_NEED_CONFIRM]

> 需求唯一真相源：`docs/design-notes/team-visibility.md`（v4 终版，plan-eng + plan-design 双独立评审 PASS，commit 5525c319）。
> 本文件把 design-note 的用户故事与验收语义转成可二值判定的验收基线；**只定义问题与验收条件，不设计实现**。
> P0-brief 时效性：已核对 P0-brief 时效性，无漂移（立项 commit 5525c319 为 2026-09-02 当日；VERSIONS.json 实测 peekview 0.21.0 / mcp 0.11.0 与 brief 声明一致；executor_env 平台前提成立）。
> 修订记录：rev1（2026-09-02）按 P1-review.md F1-F8 修订——F1 拆 BDD-7 详情读权/管理操作权、F2 拆 BDD-20 竞态、F3 拆 BDD-23 三转换路径 + 定 update team 归属口径（成员）、F4 补 CLI 远程 PeekClient 透传锚、F5 补 owner 失效 2 条 + EXPLAIN 性能回归线、F6 澄清 BDD slug actor、F7 BDD-22 标题改 create-only、F8 BDD-34 文案量化 + DOM 断言；编号由 35 条重排为 43 条（BDD-1~43 连续）。

## 0. 需求质疑结论（先质疑，再定义）

design-note v4 已经过双独立评审、9 个决策点（A-I / A1-A14）全部定稿，本 P1 不再翻决策为待确认项；对 design-note 的质疑集中在「验收可测性」与「文档未覆盖边界」，逐条核对后结论：

1. **用户故事可直接测**：§2.1 Alice/Bob/Carol 场景覆盖主正常流。可测性缺口在**权限矩阵的路径维度**（design-note §13 测试清单第 1 项定义 7 条路径），已转成 BDD 矩阵类条目。
2. **两个"文档暗示但未写验收判据"的行为**需要显式基线：
   - team_id 校验的**统一文案**（§5.2 提到"统一文案，如 team not found or not accessible"）——BDD 只锁"422 + 不分存在性与成员身份"，不锁文案字面（文案锁字面会绑死实现，且存在性判定由状态码+响应体同构保证，见 BDD-21）。
   - 归档 team entry 的**读权**（§5.5 星标持有者可读）——archived 分支维持现状决策 A，team 成员若无星标对 archived team entry 404，BDD-6 显式写死该边界（防"team 可见性意外延伸到归档态"回归）。
3. **CLI 端归类**：CLI 改动（`teams` 子命令 + `--team`）代码在 `backend/peekview/cli.py`（backend 包内），本地模式直连 `EntryService`（复用后端权限），远程模式走 `PeekClient`（HTTP 透传）。**不单列 cli 域**（避免 P2 评审重复派发），归入 backend 域，但 BDD 中 CLI 行为独立编号（BDD-31/32/33/34，其中 BDD-34 为远程模式透传锚）保证验收不丢。
4. **MCP 的 schema 兼容性**：design-note §7.1 声明所有新增字段 optional → **非 breaking**。隐含要求：`publish_files`/`create_entry` 既有调用（不传 team_id）行为零变化（BDD-25 回归线）。MCP server 独立 bump minor v0.11.0 → v0.12.0（BDD-35）。
5. **风险 §12 迁移顺序**：`database.py:init_db` 现有顺序 = `create_all`（先建 SQLModel.metadata 新表）→ `_run_migrations`（ALTER 已有表）→ `_setup_indexes`（部分唯一索引）→ FTS5。teams/team_members 若进 metadata，create_all 先建表、再在 `_run_migrations` ALTER entries 加 `team_id` 列 → 顺序天然满足 SQLite "被引用表先存在"约束（BDD-17 回归验证旧库升级路径）。

## 1. 需求复述

**核心业务逻辑（P0-brief 9 条 + design-note §3-§5）：**

1. **可见性三选一**：public / team / private。`team_id` 非空 → 服务端强制 `is_public=false`（不 422，create 与 PATCH 同规则）。`team_id` 为 NULL = 非 team 可见（private 语义不变）。
2. **entry-team 一对多（单值）**：`entries.team_id` 外键 `ON DELETE SET NULL`——team 删除 → 相关 entry 转 private（仅 owner 可见），数据不丢。
3. **成员流**：owner 按 username 直接添加成员；成员自助退出；无邀请-接受流；team 不可搜索/浏览（防枚举）。
4. **权限收敛**：新增单一 `can_read_entry()` 判定（is_public OR owner OR admin OR team_member），替换 7 处分散读路径检查（get_entry / list_entries / _resolve_entry / resolve_entry_raw / _check_share_cookie / get_entry_with_share / download_entry_files）。
5. **防枚举**：非成员对 team entry 一律 404（非 403）；share 三接口 403 → 404；team 管理接口无权一律 404；`?team=` 过滤单一"不可用"态（服务端零存在性信号）。
6. **share 边界**：owner + admin 可建 team entry share；成员不可（share_service.py:51 现状已保证）；share token 生命周期与成员变动无关。
7. **star 缺口修复**：两处 starred 可见性条件（entry_service.list_entries + star_service._build_star_item）加 `team_id IN (我的 team)`。
8. **archived 边界**：team 可见性不延伸到归档态——归档 team entry 仅 owner + admin + 星标持有者可读（保持星标不变量）。
9. **校验契约**：`team_id` 不存在或非成员 → 422 统一语义（不区分存在性与成员身份）；匿名携带 → 422；**绝不静默忽略**（防 team 内容误发 public）。**归属口径**：create 与 update 一致——「目标 team 可用」= 当前用户是目标 team 的**成员**（owned 或 joined 皆可），design-note §5.2 update 段「属于本人」按成员口径解读（理由：前端 8.7 表单下拉 =「我的 teams」含 joined 分区；与 create 校验同口径避免同 team 在两接口判定相反）。
10. **存量 bug 连带修复**：`entries.py:478` 调用不存在的 `service.get_entry_by_api_key(slug)`（全仓仅此一处，全局 master key /download 路径现会 AttributeError）——补该方法，语义 = 全局 key 可读一切（与 raw/file 分支一致）。
11. **owner 账号失效**：owner 被禁用 → team 冻结（成员仍可见，无人可管理）；owner 被删除 → 现有 CASCADE（team 连带删除，与 BDD-19/20 验收锚对应，design-note §3.5 决策 D）。

**范围（改动清单按 P0-brief）：** 后端（迁移 + 模型 + teams API + entry team_id + can_read_entry 收敛 + star 修复 + share 404 化 + 存量 bug）、CLI（teams + create --team + list --team）、前端（/teams 管理页 + explore Teams tab/chips/badge + 表单三选一 + 移动端 tab + a11y + toggle 守卫）、MCP（team_id 参数 + list_teams 只读工具 + description 引导 + 全局 key get_entry 分支 + bump minor）。

## 2. 隐含需求识别（逐维度）

### 2.1 同类 / 影响面（同类扫描结论，见第 5 节）

### 2.2 数据
- **需要 schema 迁移**：新建 `teams` / `team_members` 表 + `entries.team_id` 列（FK `ON DELETE SET NULL`）+ 两索引（`idx_team_members_user_id` / `idx_entries_team_id`）。存量 entries 无 team_id → 全部保持现状（NULL），**零数据改写**。
- **存量 team 数据**：无（新功能，首个发布版本无历史 team 数据）。
- **read_tracking（v2 事项）**：design-note §10 明确"entry 是否属于 team、读者是否 team 成员"的探针上下文属 **v2**（需 ALTER entry_reads），**本次不做**——隐含需求已在 design-note 分期排除，不列入验收（防范围膨胀）。
- **check_schema 对齐**：模型加 team_id 后 `check_schema`（PRAGMA table_info vs metadata 列）对存量库做列比对；`_run_migrations` 必须补 ALTER 使存量库对齐，否则升级启动即 SchemaMismatchError（BDD-17）。

### 2.3 前端
- 有显示/交互变化 → `domains: frontend`，P2 须声明 `ui_affected: true`。变化面：explore 第 5 tab（Teams）、team chips、entry badge（team 变体 + "仅团队可见 · {teamName}" 文案 + aria-label）、/teams 管理页（新路由 + UserMenu 入口）、创建/编辑表单可见性三选一、卡片 toggle 按钮隐藏 + store 守卫、移动端可横向滚动 tab + 触达 ≥44px、状态×URL 四维互斥 + 单一"不可用"态。
- **/stars 路由无 UI 入口的教训**：/teams 必须挂入口（UserMenu + explore Teams tab 内"管理团队"链接），不能只建路由（BDD-42 补 DOM 存在性断言）。
- **类型贯通**：`frontend-v3/src/types/index.ts` Entry/ListEntriesParams、`api/client.ts` transformListItem/transformEntry/listEntries params、BaseBadge status union（7 值 + team）与 label 参数化、EntryCard/EntryListRow badge 优先级（有 team_id 不渲染 private badge）。

### 2.4 多端
- **MCP**：`packages/mcp-server/src/tools/publishFiles.ts`/`createEntry.ts` schema 加 `team_id`（optional）；新增只读 `list_teams`；`get_entry` 响应加 `team` 字段；description 加 TEAM VISIBILITY 引导文案（含"省略 team_id 默认公开！"硬提示）；全局 key 补 get_entry 分支。v0.11.0 → v0.12.0 bump。
- **CLI**：`peekview teams`（owned+joined 分区，--json）、`create --team {slug}`（与 `--visibility public` 互斥校验）、`list --team {slug}`。
- **PeekClient（backend/peekview/client.py）**：`create_entry` payload 需透传 team_id（CLI 远程模式 + 任何 Python 客户端），否则 CLI --team 远程模式丢参数（BDD-34 远程模式验收锚）。
- **样例 seed 数据**（`scripts/seed-data/python-entry-service/entry_service.py`）是样例镜像，非生产路径——**不纳入本次改动**（测试 seed 不含 team，如需 team fixture 由 P3 自建），记录为"不处理 + 理由"。

### 2.5 边界
- **防枚举**：非成员 team entry → 404 非 403；`?team=` 不存在的 team 与非成员 team → 服务端返回**完全一致**响应（200 + 空 items，无 teamFound/错误码字段）；team 管理接口 + 添加成员 username 不存在 → 404。
- **并发/竞态**：成员被移除后立即读 team entry → 404（BDD-23）；team 删除与 list_entries 并发不抛错（BDD-24）。
- **回滚/空值**：`team_id` NULL 处理 = private 语义（owner/admin 可读）；owner 禁用 → team 冻结（成员仍可见，无人可管理，BDD-19）；owner 删除 → 现有 CASCADE（team 连带删除，BDD-20）。
- **share 生命周期**：team entry 由 owner/admin 建 share；成员变动/team 删除不撤销已有 share（share 是 owner 的决定）。
- **update 转换**：team → public 撤销全部 share（复用现有 was_private 撤销逻辑，需覆盖 team→public 路径，BDD-28）；team A → team B 迁移校验目标 team 归属——**口径 = 当前用户是目标 team 成员**（owned/joined 皆可，与 create 校验一致，design-note §5.2「属于本人」按成员解读，BDD-29/30）；public/private ↔ team 三态互转。
- **详情读权**：team 详情（含成员列表）仅 owner + 成员可读、无关者 404；管理操作（重命名/删除/加成员/移成员）仅 owner（design-note §5.1，BDD-7/8）。

### 2.6 兼容
- 非 breaking 要求：所有新增请求字段 optional；`?view=all` 聚合（team 内容并入 All 视图对登录用户）不改变匿名行为（匿名仍只见 public）；CLI/MCP 旧调用不传 team 参数行为零变化。
- MCP server 版本 bump minor（向后兼容）；peekview 后端 bump 版本由 P8 决定（版本策略按 VERSIONS.json 唯一源）。
- **list_entries team 聚合性能回归线**：team 聚合用 `EXISTS` 子查询 + 索引，P5 用 `EXPLAIN QUERY PLAN` 验证索引命中、无逐行子查询（design-note §12 性能 + §13#10，BDD-26 验收锚）。

## 3. BDD 验收条件

> 分组：后端权限（BDD-1~6）/ teams API 权限（BDD-7~8）/ 防枚举（BDD-9~10）/ share（BDD-11~13）/ star（BDD-14~15）/ team 生命周期、迁移与 owner 失效（BDD-16~20）/ 校验契约（BDD-21~22）/ 竞态（BDD-23~24）/ 兼容与性能回归线（BDD-25~26）/ API 契约（BDD-27~30）/ CLI（BDD-31~34，34 为远程 PeekClient 透传）/ MCP（BDD-35~37）/ 前端 UI（BDD-38~43，UX 类别后缀标注）。
> 主场景 actor 映射：Alice=owner/创建者，Bob=Alice 添加的 team 成员，Carol=非该 team 的登录用户，admin=系统管理员。

### 3.1 team 数据模型与权限收敛（后端）

#### BDD-1: team 创建者发布到 team 后，该 entry 对 owner 与成员可见
- Given 用户 Alice 创建 team（如 slug=proj-a）并把 Bob 添加为成员，Alice 发布 entry 时指定该 team
- When 登录用户 Alice 和 Bob 分别请求该 entry 详情
- Then 两者均得到 200 且响应含 `team: {slug, name}`；匿名用户请求同一 entry 得到 404

#### BDD-2: team entry 对非成员登录用户不可见（404 防枚举）
- Given Alice 创建 team proj-a 并发布 team entry，Bob 为成员、Carol 非成员
- When 登录用户 Carol 请求该 entry 的 7 条读路径（get / list 中该条目 / raw / files-content / render / download / share-read）
- Then 每条路径均返回 404（非 403），且响应与"slug 不存在"不可区分

#### BDD-3: team entry 不出现在非成员的列表视图中
- Given 上述 team entry 存在，Carol 已登录
- When Carol 请求 entries 列表（默认 All 视图）
- Then 该 team entry 不在返回 items 中（All 聚合仅含公开 + 自己私有 + 自己所属 team 内容）

#### BDD-4: team entry 出现在成员的列表 All 聚合与 Team 过滤中
- Given Bob 是 team proj-a 成员
- When Bob 请求 entries 列表（All 视图）与带 team=proj-a 过滤的列表
- Then All 视图 items 含该 team entry；team 过滤视图 items 只含该 team 的 entry

#### BDD-5: 7 条读路径对 team 成员全部放行
- Given 上述 team entry，Bob 为成员
- When Bob 依次访问该 entry 的 get / list 中该条目 / raw / files-content / render / download / share-read（share-read 用 owner 建的合法 share token）
- Then 每条路径均返回 200（或 302 跳转后的内容 200），团队成员可完整读取（权限收敛后无一路径漏改 404）

#### BDD-6: 归档的 team entry 对无星标成员不可见（team 可见性不延伸到归档态）
- Given team entry 已归档，Bob 是成员但未星标该 entry
- When Bob 请求该 archived team entry 详情
- Then 返回 404；若 Bob 已星标该 entry 则返回 200（保持星标不变量——星标持有者可读 archived）

### 3.2 teams API 权限（详情读权 + 管理写权分离，design-note §5.1 裁决）

#### BDD-7: team 详情（含成员列表）读权 = owner + 成员 200 / 无关者 404
- Given team proj-a 存在，Alice 是 owner，Bob 是成员，Carol 完全无关
- When Bob 与 Carol 分别请求 `GET /teams/proj-a`（team 详情，含成员列表）
- Then Bob 得到 200 且响应含成员列表；Carol 得到 404（非 403），响应与 team 不存在不可区分

#### BDD-8: team 管理操作权（重命名/删除/成员添加/成员移除）仅 owner
- Given team proj-a 存在，Alice 是 owner，Bob 是成员，Carol 完全无关
- When Bob 与 Carol 分别对重命名 / 删除 / 成员添加 / 成员移除接口发起请求
- Then 两者一律收到 404（非 403，与 team 不存在不可区分）——成员读权（BDD-7 200）不延伸为管理写权；Alice（owner）对同类操作成功（200/201/204 按接口语义）

### 3.3 防枚举与单一"不可用"态（后端 + 前端契约）

#### BDD-9: 添加成员时 username 不存在返回 404
- Given Alice 是 team proj-a owner
- When Alice 向该 team 添加一个系统中不存在的 username
- Then 返回 404，且错误语义与"非 owner 操作"一致（不暴露 username 是否存在的 oracle）

#### BDD-10: ?team= 过滤对"不存在的 team"与"非成员 team"返回完全一致的响应
- Given 服务端已上线 team 功能，存在 team proj-a（成员含 Bob）
- When 匿名用户与 Carol（非成员）分别请求 `GET /entries?team=proj-a` 与 `GET /entries?team=does-not-exist`
- Then 四组响应（匿名×2 + Carol×2）的 HTTP 状态码与响应体结构完全一致（200 + 空 items，无 teamFound / 错误码 / 差异字段）；客户端对非成员 team 过滤展示统一"团队不可用"态

### 3.4 share 与 team 交互

#### BDD-11: owner 与 admin 可创建 team entry 的 share
- Given team entry 存在，Alice（owner）与 admin 均已登录
- When Alice 与 admin 分别对同一 team entry 创建 share
- Then 两者均得到 201 与 share token；share 创建成功后该 token 可读 entry（200）

#### BDD-12: team 成员不可创建 team entry 的 share
- Given team entry 存在，Bob 为成员（非 owner 非 admin）
- When Bob 请求对该 team entry 创建 share
- Then 返回 404（现状 403 收紧，防私有 entry 存在性探测）

#### BDD-13: share 生命周期与成员变动/team 删除无关
- Given Alice 为 team entry 创建了 share token，Bob 后被移出 team（或 team 被删除、entry 转 private）
- When 持有原 share token 的外部访问者访问该 entry
- Then 仍可读（200）——share 是 owner 的决定，不随成员变动与 team 删除撤销

### 3.5 star 可见性闭环

#### BDD-14: 成员 star 的 team entry 出现在其星标列表中
- Given Bob 是 team proj-a 成员，对某 team entry 执行 star 成功
- When Bob 请求星标列表（`?starred=true` 或 /api/v1/stars）
- Then 该 entry 出现在列表中（修复两处 starred 可见性条件漏 team 的缺口：list_entries starred_cond 与 star_service._build_star_item）

#### BDD-15: 非成员即使拿到 star 状态也不可见 team entry
- Given Carol 非 proj-a 成员，因故存在对该 team entry 的 live star（如曾是成员后退出，star 保留）
- When Carol 请求星标列表与 entry 详情
- Then 星标列表不含该 entry 且详情 404（star 不构成越权读的通道）

### 3.6 team 生命周期、迁移与 owner 失效

#### BDD-16: 删除 team 后其 entry 转 private 且数据完好
- Given Alice 删除 team proj-a（含该 team 的 entry 若干）
- When 执行删除后校验数据库与读取路径
- Then 原 team entry 的 `team_id` 为 NULL、owner（Alice）仍可读、非 owner 不可读；数据库 `PRAGMA foreign_key_check` 与 `integrity_check` 均通过，文件数据完好

#### BDD-17: 旧库（无 teams/team_id）升级启动成功且存量数据完好、迁移幂等
- Given 一份升级前的旧数据库（无 teams/team_members 表、entries 无 team_id 列）含存量 entries
- When 以该库启动新版本服务（run_migrations=true）并再次重启
- Then 首次启动成功（无 SchemaMismatchError、无迁移报错）、存量 entries 全部保留且 team_id 为 NULL；二次启动幂等（无重复建表/加列错误）

#### BDD-18: team 创建时 name 在 owner 内唯一、slug 全局唯一且冲突自动加 -N 后缀
- Given 用户 A 已创建 team 名 "Alpha"（slug=alpha）
- When 用户 B（另一 owner）创建同名 team 名 "Alpha"
- Then B 创建成功（owner 内 name 唯一约束不跨 owner）且 B 的 slug 自动为 `alpha-1`（全局 slug 冲突走 `-N` 后缀，A 的 slug=alpha 不变）；用户 A 若再创建同名 "Alpha"（owner 内重复）则收到明确校验错误，不静默加后缀（该冲突由 `UNIQUE(owner_id, name)` 拦截，与跨 owner 的 slug 冲突机制不同）

#### BDD-19: owner 账号被禁用 → team 冻结（成员读权保留、无 owner 可管理）
- Given team proj-a 的 owner Alice 被 admin 禁用（is_active=false），Bob 是成员
- When Bob 请求该 team 的 entry 读路径 / 星标列表 / 自己视角的 GET /teams
- Then proj-a 及其 team entry 对 Bob 仍全部可读（200，成员关系不变、team 不因 owner 禁用消失，proj-a 仍出现在 Bob 的"我加入的"分区）；team 管理接口（重命名/删除/成员管理）仍仅 owner 可调用而 Alice 已无法登录（admin 不自动接管管理，design-note §5.7）——team 进入"成员可见、无管理者"的冻结态，无任何登录用户可对其执行 owner 管理操作

#### BDD-20: owner 账号被删除 → team 与 entry 沿现有 CASCADE 连带删除
- Given team proj-a 的 owner Alice 拥有若干 team entry，Bob 是成员
- When admin 删除 Alice 账号（走现有 users 删除 CASCADE 语义）
- Then team proj-a 连带消失（Bob 的 GET /teams 不再含 proj-a，原 team entry 从一切读路径消失——Alice 的 entry 随 owner 删除连带删除，而非像 team 被删那样转 private）；数据库 `PRAGMA foreign_key_check` 通过（teams.owner_id / team_members / entries.owner_id 链式 CASCADE 无孤儿行）

### 3.7 校验契约

#### BDD-21: team_id 不存在或非成员一律 422（统一语义，绝不静默忽略）
- Given 登录用户 Carol（非任何相关 team 成员）
- When Carol 分别以"不存在的 team_id"与"非成员 team 的 team_id"创建 entry
- Then 两次请求均返回 422，响应体错误不可区分存在性与成员身份；**不会**静默忽略 team_id 而按 is_public 默认发布（若忽略则 entry 会误发 public，属数据泄露事故）；update 路径的同类校验见 BDD-30

#### BDD-22: 匿名携带 team_id 创建返回 422
- Given 匿名用户（未登录，allow_anonymous_create 开启）
- When 匿名用户带非空 team_id 创建 entry
- Then 返回 422（匿名连 private 都不能建，现状强制 is_public=true 语义扩展）

### 3.8 竞态

#### BDD-23: 成员被移除后立即读 team entry 返回 404
- Given Bob 曾是 team proj-a 成员，Alice 已将其移出 team
- When Bob 在被移出后立即再次请求该 entry 的任一读路径
- Then 返回 404（权限判定基于当前成员关系，无缓存窗口）

#### BDD-24: team 删除与 list_entries 并发发生不抛 5xx
- Given team proj-a 存在且含 entry，成员视角的 list_entries 请求进行中
- When 与列表请求并发发生 Alice 删除 team proj-a
- Then 列表请求完成且服务端不抛 5xx（不崩溃、无未捕获异常；返回结果可为删除前后任一一致视图，但状态码必须为 2xx/4xx 而非 5xx）

### 3.9 兼容与性能回归线

#### BDD-25: 不传 team 参数的所有既有创建/列表行为零变化
- Given 服务端已上线 team 功能
- When 客户端以不带任何 team 字段的请求体创建 entry / 请求列表 / 经 MCP publish_files 与 create_entry 发布
- Then 请求体与响应与上线前一致（新增字段 optional，非 breaking）；未传 team_id 的私有/公开发布语义与现状完全一致

#### BDD-26: list_entries team 聚合查询计划命中索引、无逐行子查询（性能回归线）
- Given 服务端已上线 team 功能，存在含 team entry 与成员关系的测试数据
- When 对成员视角的 list_entries team 聚合查询执行 `EXPLAIN QUERY PLAN`（P5/P6 验证环境）
- Then 查询计划对 team 可见性判定命中索引（`idx_entries_team_id` / `idx_team_members_user_id` 相关索引），**无**对 entries/team_members 的逐行全表扫描式子查询（EXPLAIN 输出无对应 SCAN 行；design-note §12 性能风险 + §13#10）

### 3.10 API 契约（create/update 的 team 语义）

#### BDD-27: create 携带 team_id 时服务端强制 is_public=false
- Given 登录用户 Alice 是 team proj-a 成员
- When Alice 创建 entry 时传 `team_id` 且同时传 `is_public: true`
- Then 创建成功（201，不 422）且存储的 entry `is_public=false`、`team_id` 指向 proj-a

#### BDD-28: update 将 team entry 转为 public（去 team_id）时撤销其全部 share
- Given team entry 已有 share token（owner 创建）
- When Alice（owner）将该 entry 更新为 public（去 team_id）
- Then 返回成功且该 entry 的全部活跃 share 被撤销（复用现有 was_private 撤销逻辑，显式覆盖 team→public 转换路径）

#### BDD-29: update 将 entry 迁移到当前用户是成员的 team 成功（成员口径）
- Given Alice 是 entry X 的 owner，且是 team B 的成员（joined 分区，非 B 的 owner）
- When Alice PATCH entry X 把 `team_id` 从原 team（或 NULL）改为 team B
- Then 返回成功，entry X 归属 team B 且 `is_public` 保持 false（update 的 team 归属口径 = 当前用户是目标 team **成员**，与 create/BDD-21 一致；"属于本人"按成员解读，owned/joined 皆可）

#### BDD-30: update 迁移到当前用户非成员的 team 返回 422（不可区分存在性）
- Given 登录用户 Alice 是 entry X 的 owner，Carol 无关、team C 存在但 Alice 非其成员
- When Alice PATCH entry X 把 `team_id` 改为 team C；另把 `team_id` 改为一个不存在的 team
- Then 两次请求均返回 422，错误与 create 校验（BDD-21）同构——不区分"team 不存在"与"非成员"（防存在性 oracle，绝不静默忽略目标 team）

### 3.11 CLI

#### BDD-31: `peekview teams` 输出 owned + joined 两分区
- Given 本地模式当前用户 Alice 拥有 team proj-a 并加入 team shared-b
- When 执行 `peekview teams`（与 `--json`）
- Then 文本输出含 owned/joined 分区；`--json` 输出 `{owned: [{slug,name}], joined: [...]}` 结构正确

#### BDD-32: `peekview create --team` 发布到指定 team，与 `--visibility public` 互斥报错
- Given 本地模式当前用户是 team proj-a 成员
- When 执行 `peekview create -s 报告 --team proj-a file.md`；另执行 `peekview create -s x --team proj-a --visibility public file.md`
- Then 前者创建成功且 entry 为 team 可见（is_public=false）；后者在发出请求前报错退出（fail fast，提示冲突），exit code 非 0

#### BDD-33: `peekview list --team` 只列该 team 的 entry
- Given team proj-a 有 2 个 entry、其他 team 有 1 个 entry
- When 执行 `peekview list --team proj-a`
- Then 只返回 proj-a 的 2 个 entry（CLI 保持显式过滤，不做隐式聚合；不传 --team 的默认 list 行为不变）

#### BDD-34: CLI 远程模式经 PeekClient 透传 team_id（验收锚）
- Given 远程模式 CLI（配置指向 debug backend 的 URL 与凭据，走 `PeekClient`），当前用户是 team proj-a 成员
- When 执行 `peekview create -s 报告 --team proj-a file.md`（远程模式）
- Then 后端 debug 实例收到的创建请求 payload 携带 `team_id`（PeekClient `create_entry` 透传不丢参数），创建的 entry 归属 proj-a 且 `is_public=false`（对 debug backend 实测断言，不触碰生产 :8080）

### 3.12 MCP

#### BDD-35: MCP publish_files / create_entry 传 team_id 发布成功且不撞 422；list_teams 返回两分区
- Given MCP server 已升级（schema 向后兼容），pv_ 用户 key 身份为 team 成员
- When 通过 MCP `publish_files` / `create_entry` 传 `team_id` 发布；再调用新增的 `list_teams`
- Then 发布成功（is_public=false、team 归属正确）；`list_teams` 返回 `{owned: [...], joined: [...]}` 两分区且无参数只读

#### BDD-36: MCP get_entry 对 team entry 响应含 team 字段且非成员 404
- Given pv_ key 身份为 team 成员、另一 pv_ key 身份非成员
- When 成员身份 get_entry 该 team entry、非成员身份 get_entry 同一 entry、全局 master key get_entry 同一 entry
- Then 成员响应含 `team: {slug, name}` 且 200；非成员 404；全局 master key 200（可读一切，含修复的 /download 分支）

#### BDD-37: MCP 工具 description 含"省略 team_id 默认公开"的硬提示文案
- Given MCP server 已升级
- When 读取 `create_entry` 与 `publish_files` 工具的 description 元数据
- Then 两者均含 TEAM VISIBILITY 引导块，且含"omitting team_id → default PUBLIC"语义的显式警告（防 agent 静默公开发布）

### 3.13 前端 UI（domains 含 frontend 必配 UX 类别 BDD）

#### BDD-38: 布局结构：explore 出现 Teams tab 且 tab 高亮互斥正确
- Given 登录用户在 /explore 页
- When 切换到 Teams tab（聚合）或点选具体 team chip
- Then 顶栏出现 5 个互斥 tab（All/Mine/Teams/Archived/Starred），仅当前激活 tab 高亮；Teams tab 激活时 All 不高亮（All 激活判定含 !currentTeam）；URL 反映 `?view=teams` 与 `?team={slug}`

#### BDD-39: 布局结构：team entry 卡片显示"仅团队可见"badge 且不叠加 private badge
- Given 列表中同时存在 team entry 与 private entry（owner 视角）
- When 渲染 EntryCard 与 EntryListRow 两种视图
- Then team entry 显示含团队语义的 badge（文案"仅团队可见 · {teamName}"，badge 用现有色板 token，禁新增 hex/emoji）；有 team_id 的 entry 不再渲染 private badge（两视图统一）

#### BDD-40: 交互行为：team entry 卡片隐藏 toggle 可见性按钮
- Given owner 视角的列表含 team entry
- When 检查该 entry 卡片的可见性 toggle 操作
- Then 无"Make public/private"切换按钮（隐藏，含 tooltip 提示"此内容为团队可见"）；store 层 toggleVisibility 对 teamId 存在的 entry 拒绝调用（UI 与守卫双保险，防误操作剥离 team 归属）

#### BDD-41: 交互行为：?team= 对不存在/无权限 team 统一呈现"团队不可用"态
- Given 客户端已加载"我的 teams"（GET /teams）
- When URL 含 `?team={slug}` 且 slug ∉ 我的 teams（不存在或非成员）
- Then 页面展示统一"团队不可用"提示与清除过滤 CTA；无"该团队暂无内容"歧义（后者仅用于成员且确实无内容的 team，两种文案可区分）

#### BDD-42: 交互行为：/teams 双入口存在 + 管理页覆盖 owner 全操作与成员退出
- Given 登录用户在 /explore（UserMenu 与 Teams tab 可见）
- When 检查两处入口的 DOM 可达性；owner 在 /teams 执行新建/重命名/删除/添加成员（username）/移除成员；成员执行退出
- Then UserMenu 含 Teams 项且点击可达 /teams、Teams tab 内"管理团队"链接存在且指向 /teams（两入口 DOM 存在性断言，防 /stars 无入口反模式）；新建成功显示于"我拥有的"分区；成员添加失败的三类情形（username 不存在 / 已是成员 / 无权操作）各给出明确错误提示且三文案两两互异（断言文案互异，不锁字面）；删除 team 有确认对话框（含"内容将转为仅自己可见"后果提示）；退出需确认后从"我加入的"消失；owner 不显示退出按钮

#### BDD-43: 布局结构（UX）：移动端 5-tab 可横向滚动且触达目标 ≥44px
- Given 视口宽度 <768px 的移动端打开 /explore
- When 渲染 5 个过滤 tab
- Then tab 栏可横向滚动（overflow-x，无换行堆叠），每个 tab 触达高度 ≥44px，末尾无内容截断异常；键盘可用（tablist 语义或 aria-pressed + 焦点可达）

#### BDD-44: 布局结构：detail 页状态标签对 team entry 显示 team 语义而非 Private
- Given 成员（或 owner）打开自己 team entry 的详情页（EntryDetailHeader / EntryMetaTagsBar）
- When 检查详情头部的可见性状态标签渲染
- Then 该标签显示 team 语义文案（含"团队"/team 名称，不显示误导性的 "Private"）；private entry 仍显示 "Private"，public entry 仍显示 "Public"（三态可区分）
- [SCOPE+ from P2] P2 architect 发现：detail 头按 is_public 渲染 Public/Private 文案，team entry（is_public=false）会误显 "Private"。主 Agent 采纳增补（可见性档位新增后展示层语义必须三态正确），改动点 = EntryDetailHeader.vue + EntryMetaTagsBar.vue + BaseBadge 复用（[BASELINE_CHANGE: SCOPE+ 主 Agent 批准 2026-09-02]）

## 4. 裁剪说明

- `phases: [P1, P2, P3, P4, P5, P6, P7, P8]` — **全走无裁剪**。理由（P0-brief 裁剪倾向 + 风险判定）：
  - **P2 不可裁**：schema 变更 + 三端（backend/frontend/mcp）+ 权限收敛（安全），backend 域强制 plan-eng-review。
  - **P3 必走**：design-note §13 测试清单 11 项，权限矩阵 / 迁移 / 竞态全为可测行为，medium-high risk 不跳 TDD。
  - **P6 不可裁**：权限矩阵逐条实跑（§13 清单第 1 项）+ UI Playwright + 截图（domains 含 frontend）。
  - P7 一致性检查：多文件跨包改动（backend/peekview + frontend-v3 + packages/mcp-server + Makefile/版本文件）必走。
  - P8 发布准备：涉及 MCP server bump minor + peekview bump（VERSIONS.json 双版本），走完整发布检查。
- `ceremony: standard`（不声明 thin——本任务涉及 schema 变更与安全，不做薄仪式）。

## 5. 同类扫描结论（强制节）

**扫描动作**：对「可见性/权限判定」关键符号（is_public / owner_id 判定 / star 可见性 / share 判定）grep 全仓（backend/peekview/、frontend-v3/src/、packages/mcp-server/src/），命中清单与逐条判定如下。

**A. 后端读路径权限判定（本次处理核心——can_read_entry 收敛对象）：**

| # | 位置 | 现状判定 | 处理 |
|---|------|---------|------|
| A1 | `entry_service.py:326 get_entry`（非 archived 分支 :357-364） | is_public OR owner OR admin | **本次处理**：走 can_read_entry（+team 成员项）；archived 分支 :343-355 保持星标语义不并入 |
| A2 | `entry_service.py:385 list_entries`（Phase 3 :479-518） | is_public OR owner / admin 全见 | **本次处理**：加 team 可见条目 + `?team=` 过滤 + team 聚合（含 EXPLAIN 回归线 BDD-26） |
| A3 | `files.py:130 _resolve_entry` | 非全局 key 走 get_entry + share cookie 兜底 | **本次处理**：经 get_entry 间接收敛（需验证 team 成员路径不 404） |
| A4 | `files.py:352 resolve_entry_raw`（share 分支 :377-393） | is_public OR owner/admin + share | **本次处理**：share 分支加 team 成员项（成员 raw 可读） |
| A5 | `entries.py:37 _check_share_cookie` + `entries.py:184 get_entry`（share 分支 :200-234） | share cookie / share token 校验 | **本次处理**：share 访问者响应不含 team 字段（design-note §5.2 单数 team 仅 owner/成员可见）；非 owner 探测 404 |
| A6 | `entry_service.py:1155 get_entry_with_share` | share 校验 | **本次处理**：share 语义不变（share 生命周期与 team 无关，BDD-13） |
| A7 | `entries.py:468 download_entry_files`（:477-493） | get_entry + share cookie + **全局 key 调不存在方法** | **本次处理**：补 `get_entry_by_api_key`（存量 bug），全局 key 可读一切 |
| A8 | `files.py` download_file/get_file_content/render_html_file/get_entry_raw（均经 _resolve_entry） | 经 _resolve_entry 收敛 | **本次处理**：随 A3 一并覆盖（files-content / render / download 三路径 = design-note §13 矩阵路径） |
| A9 | `entries.py:316 get_entry_reads`（:328-330）+ `entries.py:442 unstar_entry`（:457-463） | owner/admin + 可读性回退 | **本次处理**：reads 保持 owner/admin；unstar 回退 get_entry 可读性（team 成员可 unstar 需经 get_entry 校验放行）；不做读权收敛（design-note 未列，写路径语义） |

**B. star 可见性缺口（本次处理）：**

| # | 位置 | 现状条件 | 处理 |
|---|------|---------|------|
| B1 | `entry_service.py:491-497`（list_entries starred_cond） | is_public OR own OR archived | **本次处理**：加 `team_id IN (我的 team)`（BDD-14） |
| B2 | `star_service.py:365-368 _build_star_item` | is_public OR own OR archived | **本次处理**：同上（BDD-14/15） |

**C. share 接口防枚举（本次处理）：**

| # | 位置 | 现状 | 处理 |
|---|------|------|------|
| C1 | `share_service.py:51 create_share` | 非 owner 非 admin → ForbiddenError(403) | **本次处理**：403 → 404（BDD-12） |
| C2 | `share_service.py:129 list_shares` | 同上 403 | **本次处理**：403 → 404 |
| C3 | `share_service.py:169 revoke_shares` | 同上 403 | **本次处理**：403 → 404 |
| C4 | `share_service.py:54`（public entry 不可建 share → ValidationError） | 语义保留 | **本次不处理**：与 team 无关，保留现状 |

**D. 前端可见性 UI（本次处理）：**

| # | 位置 | 现状 | 处理 |
|---|------|------|------|
| D1 | `EntryListView.vue` owner-tabs（:20-39 4 tab） | All/Mine/Archived/Starred | **本次处理**：加 Teams 第 5 tab + team chips + 四维互斥（BDD-38/41） |
| D2 | `EntryCard.vue` / `EntryListRow.vue` visibility toggle | toggleVisibility 直接翻 isPublic | **本次处理**：team entry 隐藏按钮 + store 守卫（BDD-40） |
| D3 | `BaseBadge.vue`（status union 7 值 + labelMap） | public/private/shared/archived/expired/disabled/admin | **本次处理**：加 team 变体 + label 参数化（BDD-39） |
| D4 | `FilterChip.vue` dismiss aria-label 硬编码 "Remove filter" | — | **本次处理**：aria-label 参数化（"移除团队过滤：{teamName}"） |
| D5 | `api/client.ts` transformListItem/transformEntry/listEntries | Entry 无 teamId/team | **本次处理**：类型 + transform 贯通（teamId/team 字段） |
| D6 | `UserMenu.vue` | 仅 Settings 入口 | **本次处理**：加 Teams 入口（跳 /teams）（BDD-42 入口断言） |
| D7 | `router.ts` | /teams 不存在 | **本次处理**：新增 /teams 路由（挂入口，防 /stars 无入口反模式）（BDD-42 入口断言） |

**E. 不处理（记录 + 理由）：**

| # | 位置 | 判定理由 |
|---|------|---------|
| E1 | `entry_service.py` update_entry(:657-668) / delete_entry(:839-846) | 写路径 owner/admin 判定，**不进 can_read_entry**（design-note §5.3 只收敛读路径）；本次仅补 team_id 写校验（BDD-21/28-30），不重构写权 |
| E2 | `client.py` PeekClient | **本次处理**（透传 team_id payload，CLI 远程依赖，BDD-34）；但权限判定逻辑不在此（HTTP 透传） |
| E3 | `scripts/seed-data/python-entry-service/entry_service.py` | 样例数据镜像（测试/演示用），非生产路径。**本次不处理**：不参与权限收敛；如需 team fixture 由 P3 自建 |
| E4 | `auth.py` get_current_user / `_shared.py _is_global_api_key_auth` | 身份解析层，语义不变；全局 key 分支缺口在 A7 补 |
| E5 | FTS 全文检索 | team 可见性聚合不影响 FTS 结果可见性（FTS 只定位 entry id，最终读权仍走 list/get 判定）；**本次不处理**，EXPLAIN QUERY PLAN 索引命中验证走 BDD-26（P5 实跑，确认无逐行子查询） |
| E6 | read_tracking 探针带 team 上下文 | design-note §10 明确属 **v2**（需 ALTER entry_reads），本任务不做（记录避免范围膨胀） |

**回归拦截声明**：`can_read_entry` 收敛后，未来新增读路径（如新文件类端点）若绕过该函数会重现"漏改 404"反模式——拦截手段 = design-note §13 测试清单第 1 项权限矩阵测试固化为**既有 7 路径 × actor 矩阵回归用例**（P3 写入），新增读端点时必须扩展矩阵而非新增散点断言（BDD-2/5 的矩阵表述承载该拦截语义）。owner 失效语义（BDD-19/20）与 EXPLAIN 性能线（BDD-26）已从散文升级为独立 BDD 锚，P6 逐条实跑。

**扫描结论**：被报告的问题（7 处分散权限）经全仓 grep 确认恰为 A1-A7 七处 + 间接收敛的 A8，另发现同族缺口 B1/B2（star 可见性，§5.6 已列）与 C1-C3（share 403，§5.4 已列）及存量 bug（A7 `get_entry_by_api_key` 缺失）——以上全部纳入本次处理范围；其余命中（写路径、seed 镜像、auth 层）逐条判定不构成同一问题或不在本期范围（E1-E6），显式记录理由。**"只修被报告那一处"的反模式未发生：同类扫描把 7 处收敛 + 2 处 star + 3 处 share + 1 处存量 bug 全部纳入验收基线。**

## 6. 待确认清单

- [NO_NEED_CONFIRM] 无未决待确认项。design-note 9 决策点（A-I / A1-A14）已由双评审定稿直接采用；质疑产生的边界判据（归档态读权 BDD-6、统一文案不锁字面 BDD-21、update team 归属成员口径 BDD-29/30）均依 design-note 已有决策推定，无真实方向分叉需要人定夺。
- [SUGGEST: 版本 bump 节奏建议——peekview 后端 bump minor（0.21.0 → 0.22.0，新功能 + schema 迁移），MCP 独立 bump minor（0.11.0 → 0.12.0）。理由：功能任务走 minor 与 design-note §7.1 / P0-brief 版本声明一致；最终由 P8 依 VERSIONS.json 唯一源执行，本条不阻塞推进。]

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证前端交互（Teams tab / team badge / /teams 管理页 / 移动端 tab / 单一不可用态）
    available:
      - "vision-engine skill（主 agent 图片分析唯一入口）"
      - "playwright-cdp skill（CDP 连接本机 Chrome :18800，connectOverCDP 模式）"
    status: available

  - need: multi-user 场景测试
    why: team 权限矩阵（匿名 / 成员 / 非成员 / owner / admin）与迁移、owner 失效验证需要多用户多数据
    available:
      - "make debug（:8888 隔离实例，/tmp/peekview-debug/）"
      - "make debug-seed 测试用户 alice/bob/carol（密码 testpass123）"
    status: available

  - need: schema 迁移 / 旧库升级验证
    why: teams/team_members/entries.team_id 迁移需在"旧库无新表"前提上验证幂等 + 存量完好
    available:
      - "pytest 隔离库（conftest autouse 隔离 tmp_path）"
      - "make debug-extra（多实例独立数据目录，跨实例验证可选）"
    status: available

  - need: MCP 集成验证
    why: list_teams / team_id 发布 / 身份透传需对 debug backend 实测（绝不能指向生产 :8080）
    available:
      - "make test-mcp-unit（vitest node 环境）"
      - "MCP 集成测试指向 127.0.0.1:8888 debug backend（AGENTS.md 铁律 3）"
    status: available
```

**能力需求判断说明**：以上四项均为 `available`（环境已有补充路径，换模型/换角色即可获得能力 = 能力问题而非环境问题；debug backend / 测试用户 / skill 均由主 Agent 标准操作可准备，非不可得环境）。无 `supplementable` / 无 `GAP`。视觉能力条目 `browser-vision`（need 含 vision）已按 frontend 任务硬要求声明，status=available。

## 8. 备注（对下游的约束传递）

- P2 须声明 `ui_affected: true`（domains 含 frontend）；P2 UI 设计节渲染形态行复用本文件 `ui_render_shape` 值。
- P6 验收：BDD 逐条实跑 + 权限矩阵表（actor × 7 路径）逐格记录；UI 用 Playwright 截图 + vision-engine 分析（证据链含截图文件）。BDD-19/20（owner 失效）与 BDD-26（EXPLAIN）为 P3 §13#5/#10 的直接验收锚，P6 依锚实跑。
- P7 一致性检查：packages 覆盖 backend/peekview + frontend-v3 + packages/mcp-server + cli.py 所在包 + Makefile/VERSIONS.json（bump 双路径），跨文件交叉核对 team_id 字段贯通（models ↔ service ↔ api ↔ client.ts ↔ types ↔ MCP schema ↔ PeekClient）。
- P1 基线保护：本文件为需求基线，后续阶段修改须经主 Agent 批准并标注 `[BASELINE_CHANGE]`。
- [SCOPE_RESOLVED: MCP get_entry 的 team 字段需后端 /raw 响应补 team（P2 SCOPE+2，已采纳为 P2 实现约束：files.py resolve_entry_raw + models.EntryRawResponse 加可选 team 字段，仅 owner/成员/全局 key 附 team，share 访问者不附）]
- [SCOPE_RESOLVED: CLI 本地 create/list owner 语义（P2 SCOPE+4）——--user 仅本任务 team 场景启用，非 team 本地 create 行为保持现状（owner_id=NULL），记录不扩]
- [SCOPE_RESOLVED: restore merge 不拷 teams（P2 SCOPE+3）——超出验收路径不采纳；记入 backlog 后续任务处理]
