# P4-progress — TPV0095 backend implementer

## 2026-09-02 — 输入读取
- [x] 读 implementer.md 角色 + P4-dispatch-context-implementer-backend.md
- [x] 读 P2-design.md 全文（§0.1 A/B/C 改动表 / §2 DDL / §3.1-3.5 / §7 files_to_read / §11 / §12）
- [x] 读 P0-brief.md
- 下一步：读 P1-requirements.md（BDD-1~34 后端线）→ P3-test-cases-backend.md → backend/tests/test_team_*.py → files_to_read 代码导航

---

# P4-progress — TPV0095 frontend implementer（追加节，与 backend 批共享此文件）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；不用 npm run dev）

## 2026-09-02 — 输入读取（frontend 批）
- [x] 读 implementer.md 角色文件（最小实现、DESIGN_GAP/SCOPE+/SCOPE_GAP 规则、自查≠gate）
- [x] 读 P4-dispatch-context-implementer-frontend.md（批次边界：只改 frontend-v3/ + DESIGN.md；testid 清单 §5.7）
- [x] 读 P2-design.md 全文（§5 前端设计 §5.1-5.8 / §5.7 testid / UI 设计节 / §7 files_to_read 前端项 / §11 完成标志）
- [x] 读 P0-brief.md + P1-requirements.md §3.13 BDD-38~44
- [x] 读 P3-test-cases-frontend.md + 10 个 P3 组件 spec 全文（行为契约，见下逐项）
  - entry-list-view-teams.spec.ts（5 tab 互斥/URL view=teams/team=me 聚合/不可用态/空态 teams-empty+team-empty/teams-manage-link/tablist 语义）
  - search-url-team.spec.ts（mergeQuery/parseRestoreQuery 需支持 team/view）
  - base-badge-team.spec.ts（status union +'team'，label prop，class badge-team，禁 public/private class）
  - entry-card-team.spec.ts / entry-list-row-team.spec.ts（badge-team + 文案含"仅团队可见"/team name；visibility-toggle count=0 on teamId；delete 保留 data-action=delete）
  - entry-list-store-team.spec.ts（toggleVisibility teamId 守卫返回 false 不发 api）
  - team-store.spec.ts（stores/team.ts：owned/joined/isMemberOf/loadMyTeams/createTeam/leaveTeam/deleteTeam/addMember/reset；Team/TeamDetail 类型）
  - detail-visibility-tag.spec.ts（EntryDetailHeader .status-tag 三态：team 文案含"团队"+name、不含 Private；private→Private；public→Public）
  - user-menu-teams.spec.ts（.user-menu-trigger 点击后 user-menu-teams-item 存在，点击 push /teams）
  - filter-chip-team.spec.ts（dismissLabel prop，默认 'Remove filter'）
- [x] 读 e2e 两 spec（team-visibility.spec.ts / teams-page.spec.ts）——结构确认，P5/P6 实跑
- [x] 按 P2 §7 files_to_read 读前端代码（EntryListView.vue 全文 879 行 / searchUrl.logic.ts / entryList.ts / auth.ts / entryDetail.ts / types/index.ts / api/types.ts / api/client.ts / BaseBadge.vue / FilterChip.vue / EntryCard.vue / EntryListRow.vue / UserMenu.vue / router.ts / EntryDetailHeader.vue / EntryMetaTagsBar.vue / ConfirmDialog.vue / EmptyState.vue / SettingsView.vue / StarManageView.vue 参照 / DESIGN.md:200-201 + token 表 / variables.css）
- [x] 读既有约束测试（防回归面）：
  - UserMenu.spec.ts 锁 `.dropdown-item` = [Settings, Logout] 全角（BDD-07/08/09/10/12 多处）——**Teams 项不得用 .dropdown-item class**，用独立 class（.menu-item-teams 等）+ data-testid user-menu-teams-item
  - e2e/t079-auth-consistency.spec.ts:219 锁 menu items = ['Settings','Logout']；:244 uses has-text Settings
  - e2e/debug-server.spec.ts:635 `.dropdown-item`.last() = Logout
  - searchUrl.logic.spec.ts 旧断言 **toEqual 精确对象**（无 team/view 键）→ parseRestoreQuery 加键破坏旧用例；tpv0095-search-url-team.spec.ts 需要返回值含 team/view → **两 spec 冲突 → [DESIGN_GAP 候选]：拆 `parseRestoreQuery`（旧键，兼容旧 spec 精确 toEqual）保留 + 新增键只在不破坏旧 spec 处暴露；实读 tpv0095 spec 是 `parseRestoreQuery` 同名 import → 见实现节定夺**
  - t031-entry-list-view.spec.ts stub searchUrl.logic（不受影响）
  - EntryListRow.spec / t031 卡片系列：非 team 断言保留 .card-action-btn / data-action=toggle-visibility/delete
  - BaseBadge.spec.ts / FilterChip.spec.ts 旧断言兼容（status union 超集 + dismissLabel 默认）
  - EntryListRow 非 owner 无 badge 断言（:66-70）——team badge 仅 owner 视角渲染（两视图一致）
- [x] 基线实测：make test-frontend = **24 failed | 1303 passed**（与 P3 记录一致）；vue-tsc = **21 处 spec 文件类型错误**（tpv0095 spec 的 @ts-expect-error 与缺类型）——P3 spec 在 vue-tsc 门禁内
- [x] 关键设计裁定（记录，P4-implementation.md 详述）：
  - searchUrl：tpv0095 spec 与旧 spec 对 parseRestoreQuery 返回值冲突（前者要 team/view 键、后者 toEqual 精确对象无键）→ **[DESIGN_GAP] 方案：RestoredQuery 接口不变（旧 spec 兼容），新增第二个纯函数 `parseRestoreQueryFull()` 返回 {…parseRestoreQuery, team, view}**；视图层改用 Full。tpv0095 spec import parseRestoreQuery 同名 → 只能通过增加键解决（不可行）→ **替代裁定：给 tpv0095 spec 用的 parseRestoreQuery 同一函数加键会破坏旧 spec toEqual（7+ 用例精确匹配）——旧 spec 在 tsconfig include 内且是既有绿测不可破坏。** → 最终 [DESIGN_GAP] 见实现
  - UserMenu Teams 项：复用 .dropdown-item 破坏 UserMenu.spec 精确数组 → 用独立 class `menu-item-teams`（共享 .dropdown-item 样式外观）
  - detail .status-tag：P2 §5.8 载体=BaseBadge 与 P3 spec .status-tag 断言冲突 → [DESIGN_GAP]：EntryDetailHeader 内 .status-tag 由 BaseBadge team 变体替换（spec 断 .status-tag 文本）→ 定夺见实现
- [x] DESIGN.md:200-201 现状 = "Horizontal row on desktop, stacked vertical sections on mobile" → 修订为 5 扁平过滤 tab + 移动横滚 + ≥44px（归本批）
- [x] 确认 token：`--c-accent-surface` 全仓**无定义**（组件引用但变量未定义 → fallback 无色）；badge team 变体用既有 `--c-badge-shared-bg`/`--c-warning`（警示系，DESIGN §5.3 建议项）
- [x] e2e 两 spec esbuild 结构检查通过（无需改 P3 测试）
- [ ] 实现（分层：types→api→store→searchUrl→components→视图→路由→teams 页→DESIGN.md）
- [ ] 自跑测试/typecheck/lint/构建
- [ ] 写 P4-implementation.md
- [x] 读 P1-requirements.md（BDD-1~34 后端线 + 43 条）
- [x] 读 P3-test-cases-backend.md（37 红 + BDD-25 绿基线）
- [x] 读 backend/tests/test_team_visibility.py / test_team_validation.py / test_teams_api.py / test_share_team.py / test_team_migration.py / test_teams_owner_fail.py / test_cli_teams.py / _team_helpers.py
- 关键契约观察：
  - create/update 的 team_id 字段传 **slug** 字符串（非 int id）；PATCH team_id=None 清归属
  - create 校验 owner-as-member 也通过（BDD-27 alice 未在 member 表仍能 create team entry）
  - raw/响应 team 字段 = 精确 {"slug": name} 结构
  - CLI teams --json owned/joined 项 = 精确 {slug,name}（无 member_count）
  - 迁移测试直接 init_db(path, run_migrations=True) 需容忍旧库无 teams 表
  - 接下来读 backend 代码（models/database/entry_service/star/share/api/main/exceptions/cli/client）

---

# P4-progress — TPV0095 implementer (mcp 批)（追加节）

> 状态标记：[PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview）

## 2026-09-02 — 输入读取（mcp 批）
- [x] 读 implementer.md 角色 + P4-dispatch-context-implementer-mcp.md（批次边界：只改 packages/mcp-server/，不碰 VERSIONS.json）
- [x] 读 P2-design.md（§4 MCP 设计 + §7 files_to_read mcp 项 + §10 批次表 mcp 行）
- [x] 读 P0-brief.md env_constraints + P1 BDD-35~37 上下文
- [x] 读 P3 红灯测试 packages/mcp-server/tests/team-visibility.test.ts（行为契约，10 用例全红）
- [x] files_to_read mcp 项读完：createEntry.ts / publishFiles.ts / listEntries.ts / deleteEntry.ts / index.ts / client.ts / types.ts / getEntry.ts / utils.ts / entryRef.ts
- [x] 回归面核对：server.test.ts / publishFiles.test.ts / tools.test.ts / getEntry.test.ts 均为 toContain/字段级断言，无整集长度或整对象 deep-equal → common 加 list_teams、raw 加 team 字段零回归风险

## 关键发现
1. createEntry/publishFiles handler 最终都走 `client.createEntry({...}, ctx.userToken)`——client.ts CreateEntryRequest 透传 body（JSON.stringify(request)），类型加 team_id 即透传；两 tool 的 zod schema parse 后需显式带 team_id。
2. publishFiles 的 createEntry 调用 :517-524；schema :124-133；description 模板串 :286-313。
3. getEntry buildOutput 的 base 对象（:56-61）是唯一集中处——加 `team: raw.team ?? null` 覆盖所有返回路径。
4. client.request() 自动加 Bearer + X-PeekView-Source header。
5. 测试 mock URL `http://localhost:8080` 仅 msw 进程内拦截，不触真实网络/生产。

## 实现步骤（进行中）
- [ ] types.ts：Team/TeamList 类型 + CreateEntryRequest.team_id + EntryRawResponse.team
- [ ] client.ts：listTeams()（GET /api/v1/teams 无参）
- [ ] createEntry.ts：schema team_id + TEAM VISIBILITY 描述块 + handler 透传
- [ ] publishFiles.ts：schema team_id + TEAM VISIBILITY 描述块 + handler 透传
- [ ] getEntry.ts：输出 team: {slug,name}|null
- [ ] listTeams.ts 新增 + index.ts 注册 common（local/remote 双模式）
- [ ] 自查 `make test-mcp-unit`（10 红转绿 + 既有零回归）
- [ ] P4-implementation.md 落盘

## 2026-09-02 — 实现完成（mcp 批自查）
- [x] types.ts：CreateEntryRequest.team_id + Team/TeamListResponse + EntryRawResponse.team
- [x] client.ts：listTeams() → GET /api/v1/teams
- [x] createEntry.ts：schema team_id + TEAM VISIBILITY 描述块（omit team_id → PUBLIC 硬提示）+ handler 透传
- [x] publishFiles.ts：schema team_id + TEAM VISIBILITY 描述块 + createEntry 调用透传
- [x] getEntry.ts：输出 base 加 team: raw.team ?? null（显式 null 全覆盖分支）
- [x] listTeams.ts（新增）+ index.ts 注册 common（local/remote 双模式）
- [x] 自查 `timeout 300s make test-mcp-unit`：team-visibility 10/10 转绿；总 277 passed + 1 failed（publishFiles EROFS /var/tmp 环境性，预声明不修）
- [x] 零回归对照：P3 HEAD(35ab58e9) 临时 worktree 跑同一 test:unit = 267 passed + 10 team 红 + 1 EROFS（278 总）；改后 277 passed（267+10 转绿）+ 1 EROFS——既有 267 全保留
- [x] P4-implementation.md 落盘（mcp 批节，implementation_dir: packages/mcp-server/src/）
- 标注：无 [DESIGN_GAP] / [SCOPE+] / [SCOPE_GAP]；未改 P3 测试文件、未动 package.json（test:unit 登记 P3 已就位）
- 提示：P4-implementation.md 与 backend/frontend 批共享文件名，需主 Agent 合并；[PROD_NOT_TOUCHED]

## 代码阅读完成 — 关键实现要点与已发现矛盾
- [x] 读完 files_to_read 后端清单：models/database/entry_service/star/share/api entries+files+shares/main/exceptions/cli/client/_shared/admin delete_user
- **冲突发现 1**：legacy 绿测 test_share_create.py B02 / test_share_list.py B21 / test_share_revoke.py B24 断言非 owner share 操作 403；P1/P2 批准改为 404（share 三接口防枚举）。实现后 3 个 legacy 测试将红。处置：按 P1/P2 批准基线把这三处断言 403→404（legacy 测试更新，非 P3 测试文件；在 P4-implementation.md 记录）
- **冲突发现 2**：BDD-2（carol 登录非成员 + 合法 share token → 404）vs BDD-11/13（匿名 + token → 200）→ 判别规则 = 登录非 owner/admin/成员 + team entry 走 share 分支一律 404；匿名 token 访问者不受限（见 P2 §3.2 A4/A5）
- **冲突发现 3**：BDD-36 全局 key 测试在 create_app 后突变 app.state.config.server.api_key 并发送裸 Authorization header → _is_global_api_key_auth 需按 request 时 config 比对 master key（含裸 Authorization），而非依赖中间件启动时快照
- **冲突发现 4**：BDD-5 成员 download 无文件 entry 期望 200 → 现有 NO_FILES 404 语义要改为空 zip 200（无 legacy 断言 NO_FILES 404）
- 索引/迁移：teams/team_members 表模型进 metadata（create_all 自动建）；idx_entries_team_id 需模型声明 + migration IF NOT EXISTS；CLI 索引测试走 create_all 模型声明
- 下一步：编辑代码

---

## 2026-09-02 — 实现完成（frontend 批自查）

### 自查结果
- [x] 组件单测：`npx vitest run` 全套 = 108 files / 1334 passed, 4 skipped（P3 基线 24 failed → 0）
- [x] typecheck：`make typecheck` exit 0（改前 spec 21 类型错误 → 0；P3 spec 的失效 @ts-expect-error 已删 [SCOPE+]）
- [x] 构建：`make build-frontend` ✓（dist 389 static files → backend/peekview/static/，gitignored 构建产物）
- [x] e2e 结构：两 spec esbuild 语法检查通过（页面联调 P5/P6）
- [x] lint：唯一失败 = `backend/peekview/services/team_service.py:7`（backend 并行批文件，非 frontend 范围，协调见 P4-implementation.md §5）
- [x] P4-implementation.md 落盘（frontend 批追加节，与 backend/mcp 共享文件名，主 Agent 合并）
- 标注：[DESIGN_GAP ×5]（detail 三态载体 .status-tag 非 BaseBadge / UserMenu Teams v-show 常驻 / UserMenu 非 .dropdown-item class / searchUrl undefined 表达缺失 / URL 恢复 setup 期同步）+ [SCOPE+ ×2]（t093 遗留 4→5 tab 断言 / P3 spec @ts-expect-error 清理）
- [PROD_NOT_TOUCHED]

- **关键决策（全局 key raw 契约）**：BDD-36 测试在 create_app 后运行时改 `app.state.config.server.api_key="test-master-key-xyz"` 并以**裸 Authorization** 头发 /raw → 期望 200+team。现状 `_is_global_api_key_auth` 只认 X-API-Key（非 pv_）与 `Bearer <非JWT非pv_>`，且是"看起来像"启发式，不与配置 master key 精确比对；对裸 Authorization 与运行时改配置均不识别。P1 E4 声称"身份解析层语义不变"，但 BDD-36 红测要求运行时配置精确比对生效 → 需要对 `_shared._is_global_api_key_auth` 做精确比对升级（含裸 Authorization + 请求时 config），标记 [DESIGN_GAP]

## 实现完成 — 自测结果
- [x] backend 全量 pytest：1164 passed / 3 skipped（唯一确定性失败 test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key 为 DSH 沙箱只读 ~/.peekview/config.yaml 环境问题，非本任务引入；make test-quick 另有 backup xdist 偶发并发 flake，单文件跑 40 passed 稳定）
- [x] team 七文件 38 测试全绿（37 红转绿 + BDD-25 基线绿）
- [x] ruff lint 全过；聚焦回归（entry/star/share/api/cli/models）全绿
- [PROD_NOT_TOUCHED]

## 收尾核对
- P4-implementation.md backend 节追加完成（共享文件：mcp + frontend + backend 三节）
- P4-implementation.md 中 backend 节 [DESIGN_GAP]=3 / [SCOPE_GAP]=1，行首单行格式
- 改动仅 backend/（新增 services/team_service.py + services/team_membership.py + api/teams.py）；frontend/mcp 改动为并行批既有
- 受改子系统回归 304 passed；ruff 全过；team 七文件 38/38 全绿

---
## P4 retry1-B1（implementer backend 单任务，2026-09-02 追加节）

### 输入读取
- 已读 dispatch-context retry1-b1 / P4-review-eng.md BLOCKER-1 / P4-implementation.md backend 节 / auth.get_current_user / _team_helpers。
- 已核对全部 share cookie 服务点（grep verify_share_cookie）：仅 `_check_share_cookie`（entries.py:37-70）一处构造 cookie 响应；`files.py:_resolve_entry` cookie fallback（:164-177）与 entries.py download / files.py resolve_entry_raw 的 cookie 分支都经 `_check_share_cookie` 或自身 verify——BLOCKER-1 判别放进 `_check_share_cookie` 即覆盖 get/download/raw 三主读路径的 cookie 通道。

### 修复设计（与 ?share= 分支 entries.py:254-258 同款语义）
- `_check_share_cookie(request, slug, service, current_user=None)`：share cookie 验证通过、构建 response 前插判别——
  - current_user 非空 且 entry.team_id 非空 且 非 owner（entry.owner_id==id）且 非 admin 且 非 team 成员（team_membership_exists，复用函数已开 session）→ `return None`（调用方按 NotFoundError 404）。
- 判别只作用于 **team entry**；非 team private entry 的 share cookie 对登录用户仍服务（既有 share 语义保持：匿名种 cookie → 之后登录仍可读自己的/被 share 的私有 entry——test_share_cookie B18 断言匿名 cookie 后无参 200，B17/B19 未涉及登录态）。archived 不另判（share 不适用于 archived 语义保持，cookie 通道对 non-team archived 不新增绕过——判别条件 team_id 非空自然排除）。
- 3 调用点全部传 current_user（每处上下文已有该变量）：entries.py get_entry:293 / download_entry_files:519、files.py resolve_entry_raw:441。files.py `_resolve_entry` 的直连 cookie fallback（:164-177）补同款判别（登录非特权 + team → 不放行）。
- 不动 ?share= query 分支；不动匿名（current_user=None 直接跳过判别）。

### 验证计划（隔离 tmp，conftest 级）
自写临时脚本（不落仓库）：anon+token 200 种 cookie → carol 登录带 cookie plain GET 404 / 对照 anon 无 cookie 404 / owner、成员带 cookie 200（走 normal 路径）/ carol + ?share= 404 / 非 team private entry cookie 语义不破坏。之后 test_share_team + test_team_visibility + test_share_cookie + 全量 make test-quick。

---

## 2026-09-02 — retry1-B2 定向修复（BLOCKER-2：owner 读成员发布 team entry）— 步骤落盘

### 输入读取
- [x] P4-dispatch-context-implementer-backend-retry1-b2.md（方案 A：owner 视为团队可见范围成员，只改 services 层）
- [x] P4-review-eng.md §BLOCKER-2（评审实测：can_read 未覆盖 team.owner_id；team_visible_expr 只查 team_members）
- [x] entry_service.py 现状（team_visible_expr :62-72 / can_read_entry :74-86 / get_entry :373-430 / list_entries team 分支 :531-615 / starred 分支）
- [x] models.py Team.owner_id、TeamMember；team_membership.py；_team_helpers.py；P3 测试 test_team_visibility.py（无 owner 读成员发布对偶用例）
- [x] P1-requirements BDD-1~6 现状（Given 均为 owner 发布；成员发布对偶未覆盖 = 评审裁定方案 A 扩展）
- [x] b1 dispatch（api 层共享 cookie 修复）确认无 services 层交集——本次只动 entry_service.py + team_membership.py 助手

### 修复方案（方案 A：owner 视为团队可见范围成员）
1. can_read_entry 加 `is_team_owner: bool = False` 参数（默认 False 向后兼容）；get_entry 调用点解析传入。
2. team_visible_expr(user_id) 改为 SQL OR：EXISTS(team_members 成员) OR EXISTS(teams t WHERE t.owner_id=user_id AND t.id=entries.team_id)。
3. list_entries 既有使用点（team=me / All / starred_cond）经 team_visible_expr 自动覆盖 owner；?team=slug 显式过滤（:550-556 已有 owner 判定）维持。
4. archived 分支、写权不动。

### 下一步
编辑代码 → 隔离 tmp 验证脚本（Alice owner 读 Bob 成员发布 E2 全路径）→ 相关测试全绿 → 追加 P4-implementation.md。

### 2026-09-02 retry1-B1 实现与验证完成
- 改动：entries.py 新增 `_share_cookie_allowed_for_user` + `_check_share_cookie(current_user=None)` 判别；3+1 调用点传 current_user（entries get_entry/download、files resolve_entry_raw + `_resolve_entry` 直连 fallback 补同款判别）。文件全量 diff 复核 OK。
- 实测（隔离 tmp，临时测试 4/4 passed 后删除）：
  - carol 登录 + share cookie plain GET → **404** ✓（BLOCKER-1）；raw/download 同 404 ✓
  - 成员移出 + cookie → 404 ✓（BDD-23）
  - owner/成员/admin + cookie → 200 ✓；header auth 200 回归 ✓
  - 匿名 ?share= 200 种 cookie ✓；非 team private cookie 登录后 200 ✓（share 语义不破坏）
- 回归：test_team_visibility + test_share_team + test_share_cookie + test_share_access = **34 passed**；全量 make test-quick = **1164 passed / 3 skipped / 1 预存环境失败**（test_cli_remote 写 ~/.peekview 沙箱只读，与改动无关）；ruff 两文件全过。
- 备注：验证期间观察到并行 retry1-b2（BLOCKER-2）在 entry_service.py 的瞬态 NameError（`_team_owner_exists` 半改），非本次改动引入；b2 完成重命名后服务层稳定，主树回归全绿。
- [PROD_NOT_TOUCHED]

### 2026-09-02 — retry1-B2 完成落盘
- [x] 编辑 entry_service.py（team_visible_expr 加 owner 项 + can_read_entry 加 is_team_owner 参数 + get_entry 调用点解析 team_owner_exists）
- [x] team_membership.py 新增 team_owner_exists（薄模块助手，与 team_membership_exists 同形）
- [x] 语法/import smoke ✓；ruff lint 两文件全过 ✓
- [x] 隔离实测（Downloads/tpv0095_b2_verify.py）：Alice owner 读 Bob 成员发布 E2 全路径 200（get/All/team=me/raw/team=proj-a）；Bob 成员各路径 200；Carol 非成员全 404/缺（BDD-2 回归）→ ALL CHECKS PASSED
- [x] 既有 team 测试 5 文件 29 passed；全量 1164 passed / 3 skipped / 1 env-fail（test_cli_remote Errno 30 已登记）零回归
- [x] P4-implementation.md 追加 retry1-B2 节（含 [SCOPE+]：owner 星标成员 entry 在 /stars 缺失的 star_service 镜像缺口）
- 标注：[PROD_NOT_TOUCHED]；未改 P3 测试；api 层（BLOCKER-1 领域）零触碰

---

## 2026-09-02 — P4 retry2 定向修复（R1/R2：方案 A 传播残留）完成

### 输入读取
- [x] dispatch-context retry2（R1 api 层 ?share= 分支 owner 判定传播 + R2 star_service._build_star_item owner 项）
- [x] P4-review-eng.md 复审 needs-revision（R1/R2 CRITICAL 语义残留详情 + 实测复现）
- [x] 修复位置：entries.py get_entry ?share= 分支（:236-285）/ files.py resolve_entry_raw share 分支（:357-409）/ star_service.py _build_star_item（:340-408）+ team_membership.py（team_owner_exists :33-47 已存在）
- [x] entry_service team_visible_expr/can_read 现状（方案 A 语义基准）

### 修复（3 文件小改）
- entries.py：share 分支正常访问判定补 is_team_owner（import team_owner_exists，entry.team_id 非空时解析）
- files.py：resolve_entry_raw share 分支同款补 is_team_owner
- star_service.py：_build_star_item 可见性加 team_owner_exists 项（import 行补函数）

### 自查验证（自查≠gate）
- 隔离脚本 Downloads/tpv0095_retry2_verify.py（临时）：14/14 passed
  - R1：alice(owner) + ?share= 读成员发布 E2 → 200；bob(成员) → 200；alice raw ?share= → 200；carol(非成员) ?share= → 404 回归；匿名 + token → 200（share 语义不破坏）
  - R2：alice star E2 → /stars 含 e2-member + ?starred=true 含（两表面一致）；carol star POST → 404 不泄露；carol /stars 空
- 相关 13 套件：**86 passed**
- 全量 make test-quick：**1164 passed / 3 skipped / 1 env-fail**（test_cli_remote Errno 30 写 ~/.peekview，P4 基线预存，与改动无关）
- ruff 三文件全过
- [PROD_NOT_TOUCHED]；未改 P3 测试

## 2026-09-02 — design-review retry（F1/F2 修复，frontend 批）

- [x] F1：EntryListView.vue teams-chip-row 按钮 testid `team-chip-{slug}` → `teams-chip-{slug}`（filter-chip-bar 的 FilterChip 保留 team-chip-{slug}，消除同页双元素歧义）
- [x] F2：auth.ts `logout()` + `peekview:auth-expired` 内建 `useTeamStore().reset()`（最小改动单点覆盖 UserMenu/EntryListView/LandingView 登出 + 401 会话过期）
- [x] 新增自检 spec（非 P3 文件）：tpv0095-review-fix-entry-list.spec.ts（F1 两用例）+ stores/__tests__/tpv0095-review-fix.spec.ts（F2 两用例）
- [x] 自查：全套 vitest 110 files / 1338 passed, 4 skipped（原 108/1334 + 4 新增）；make typecheck exit 0
- [x] P4-implementation.md frontend 节补 design-review retry 段 + auth.ts 行 + F1 落点行
- [PROD_NOT_TOUCHED]
