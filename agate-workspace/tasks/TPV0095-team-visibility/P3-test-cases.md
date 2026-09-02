---
phase: P3
task_id: TPV0095
type: test-cases
parent: P2-design.md
trace_id: TPV0095-P3-20260902
status: draft
agent: test-designer (backend + frontend + mcp 三批合并)
created: 2026-09-02
---

# P3 测试用例清单 — TPV0095 team-visibility（三批合并）

> 三批 test-designer 并行产出（backend/frontend/mcp），主 Agent 合并本文件。
> test_code_dir 总声明：
> - backend: `backend/tests/`（新建 test_team_visibility.py / test_team_validation.py / test_teams_api.py / test_share_team.py / test_team_migration.py / test_teams_owner_fail.py / test_cli_teams.py / _team_helpers.py）
> - frontend: `frontend-v3/src/**/__tests__/`（10 个 tpv0095-*.spec.ts）+ `frontend-v3/e2e/team-visibility.spec.ts` + `frontend-v3/e2e/teams-page.spec.ts`
> - mcp: `packages/mcp-server/tests/team-visibility.test.ts`
> 红灯确认：backend 37 red(B)/1 green(BDD-25 基线)；frontend 24 fail(B)/13 pass；mcp 10 red(B)。
> [PROD_NOT_TOUCHED]：三批均未触碰生产 :8080 / ~/.peekview/ / pipx。

---


## backend 批

# P3 测试用例清单 — backend 域（TPV0095 team-visibility）

> 本文件是 backend 批的用例清单片段，主 Agent 负责与 frontend/mcp 批合并为 P3-test-cases.md。
> test_code_dir: `backend/tests/`（新建文件，见下方 test 文件清单）
> 红灯确认：38 个用例，37 个当前红灯（失败原因均为 B 类——被测模块未实现：Team/TeamMember 模型、teams API、can_read_entry/team_membership、share 403→404、star team 条件、CLI --team/--user、get_entry_by_api_key、/raw team 字段等均未实现）；1 个绿灯为 BDD-25 零变化回归基线（断言"不带 team 参数的既有行为不变"，本就应绿，非新功能 TDD）。已自跑确认无 A 类（测试自身 bug）。
> [PROD_NOT_TOUCHED]：本批只读代码 + 仅运行 pytest（conftest autouse 隔离 tmp），未触碰生产 :8080 / ~/.peekview/ / pipx。

## 1. actor 与 fixture 约定（backend 批统一）

- actor：alice=owner、bob=成员、carol=非成员登录用户、admin=系统管理员、anon=匿名。
- 数据构造以 `create_app(data_dir=tmp, db_path=tmp)`（main.create_app 自跑 run_migrations=True）+ `_register_user(client, name)` + `Session(app.state.engine)` 直插 Team/TeamMember/Entry/EntryStar（新建测试文件内置 helper，参照 test_star_api/test_archived_visibility 惯例）。
- Team 直插 helper 必须显式指定 `slug`（P4 实现后由 teams API/service 承担 slug 生成；P3 红绿灯测试造数阶段直插以锁定测试语义）。

## 2. BDD → 用例映射（1:1，43 条 BDD 中 backend 域 32 条 → 后端用例 42 个）

> 映射到 P1 `#### BDD-NN`。BDD-38~44（frontend）由 frontend 批负责；本批含 MCP 后端 raw/下载支撑路径（BDD-35/36/37 的 MCP 测试由 mcp 批负责，后端侧只覆盖其依赖的 backend 契约如 /raw team 字段与全局 key download）。

| BDD | 用例（test_team_*.py） | 测试名 | 说明 |
|---|---|---|---|
| BDD-1 | test_team_visibility.py | `test_bdd_1_owner_and_member_can_read_team_entry_anon_404` | GET /entries/{slug}：owner 200 / bob 200 / anon 404，owner+member 响应含 `team:{slug,name}` |
| BDD-2 | test_team_visibility.py | `test_bdd_2_nonmember_404_all_7_read_paths_indistinguishable` | carol 走 7 路径全 404，与不存在 slug 的响应体同构（key 集一致） |
| BDD-3 | test_team_visibility.py | `test_bdd_3_nonmember_list_all_excludes_team_entry` | carol GET /entries 的 items 不含 team entry |
| BDD-4 | test_team_visibility.py | `test_bdd_4_member_list_all_and_team_filter_include` | bob All 聚合含 team entry；`?team=proj-a` 只含该 team |
| BDD-5 | test_team_visibility.py | `test_bdd_5_member_200_all_7_read_paths` | bob 全路径 200（share-read 用 owner 建的合法 share token） |
| BDD-6 | test_team_visibility.py | `test_bdd_6_archived_team_entry_nonstar_member_404_star_member_200` | 归档 team entry：无星标成员 404 / 星标成员 200 |
| BDD-7 | test_teams_api.py | `test_bdd_7_team_detail_owner_member_200_carol_404` | GET /api/v1/teams/proj-a：owner/bob 200 含成员列表；carol 404 |
| BDD-8 | test_teams_api.py | `test_bdd_8_member_and_carol_manage_operations_404_owner_succeeds` | 重命名 PATCH / 删除 DELETE / 添加成员 POST members / 移除成员 DELETE members/{id}：bob、carol 全 404；owner 成功（200/201/204） |
| BDD-9 | test_teams_api.py | `test_bdd_9_add_member_unknown_username_404` | owner 添加不存在 username → 404 |
| BDD-10 | test_team_visibility.py | `test_bdd_10_team_filter_unknown_and_nonmember_identical_empty` | 4 组（anon×2 + carol×2）状态码与 body 结构一致：200 + items=[]，无 teamFound/差异字段 |
| BDD-11 | test_share_team.py | `test_bdd_11_owner_and_admin_create_share_for_team_entry` | alice/admin 建 share → 201 + token 可读 200 |
| BDD-12 | test_share_team.py | `test_bdd_12_member_cannot_create_share_404` | bob 对 team entry 建 share → 404（非 403） |
| BDD-13 | test_share_team.py | `test_bdd_13_share_outlives_member_removal_and_team_delete` | bob 移出 + team 删除转 private 后，原 token 仍 200 |
| BDD-14 | test_team_visibility.py | `test_bdd_14_member_starred_team_entry_in_star_lists` | `/entries?starred=true` 与 GET /api/v1/stars 均含该 entry |
| BDD-15 | test_team_visibility.py | `test_bdd_15_nonmember_star_does_not_leak_team_entry` | carol 残留 live star：star 列表不含 + 详情 404 |
| BDD-16 | test_team_migration.py | `test_bdd_16_delete_team_entries_team_id_null_owner_readable_data_intact` | 删 team → entries.team_id NULL、owner 200、bob 404、`PRAGMA foreign_key_check`/`integrity_check` 通过、文件完好 |
| BDD-17 | test_team_migration.py | `test_bdd_17_old_db_upgrade_twice_ok_data_intact` | 造无 teams/team_id 旧库 → init_db(run_migrations=True) 双启动 → 无异常、存量在、team_id NULL、幂等 |
| BDD-18 | test_teams_api.py | `test_bdd_18_name_unique_per_owner_slug_global_suffix` | 用户 B 建同名 "Alpha" 成功且 slug=alpha-1；A 再建同名 → 校验错误（不静默加后缀） |
| BDD-19 | test_teams_owner_fail.py | `test_bdd_19_owner_disabled_team_frozen_member_reads_remain` | alice 禁用：bob 读路径/星标/GET /teams 均 200（joined 分区含 proj-a）；无登录用户可管理（admin 不接管） |
| BDD-20 | test_teams_owner_fail.py | `test_bdd_20_owner_deleted_team_and_entries_cascade` | admin 删 alice → teams/team_members/entries 链式删除，bob GET /teams 无 proj-a、entry 全 404、foreign_key_check 通过 |
| BDD-21 | test_team_validation.py | `test_bdd_21_create_unknown_and_nonmember_team_422_indistinguishable` | carol 以不存在 team_id 与非成员 team_id 创建 → 均 422、错误同构、绝不静默忽略成 public |
| BDD-22 | test_team_validation.py | `test_bdd_22_anonymous_create_with_team_id_422` | 匿名（allow_anonymous_create 开）带 team_id → 422 |
| BDD-23 | test_team_validation.py | `test_bdd_23_removed_member_immediate_read_404` | bob 移出后立即 GET/raw → 404 |
| BDD-24 | test_team_validation.py | `test_bdd_24_concurrent_team_delete_and_list_no_5xx` | team 删除与成员 list_entries 并发 → 非 5xx |
| BDD-25 | test_team_validation.py | `test_bdd_25_no_team_param_behavior_zero_change` | 不带 team 字段的 create（含私有/公开）/list 响应与既有语义一致（既有 1068+ 用例为回归主体，此用例只验关键路径仍 201/200 形状） |
| BDD-26 | test_team_migration.py | `test_bdd_26_explain_plan_index_hit_no_scan_on_team_members` | 成员视角 team EXISTS + `?team=` 查询 EXPLAIN：team_members 无 SCAN、entries team 过滤命中 idx_entries_team_id |
| BDD-27 | test_team_validation.py | `test_bdd_27_create_with_team_id_forces_is_public_false` | alice 传 team_id + is_public=true → 201 且落库 is_public=false、team_id 指向 proj-a |
| BDD-28 | test_share_team.py | `test_bdd_28_update_team_to_public_revokes_all_shares` | owner 将 team entry PATCH 为 public（去 team_id）→ 200 且全部活跃 share 撤销（revoked_shares） |
| BDD-29 | test_team_validation.py | `test_bdd_29_update_migrate_to_joined_team_succeeds` | alice 是 team B joined 成员 → PATCH team_id=B 成功、is_public 保持 false |
| BDD-30 | test_team_validation.py | `test_bdd_30_update_migrate_to_nonmember_and_unknown_422` | alice PATCH team_id=非成员 team 与不存在 team → 均 422、与 create 同构 |
| BDD-31 | test_cli_teams.py | `test_bdd_31_teams_owned_joined_partitions` | `peekview teams --user alice`（文本含 owned/joined）+ `--json` 结构 `{owned:[{slug,name}], joined:[...]}`；本地缺 --user fail fast exit 非 0 |
| BDD-32 | test_cli_teams.py | `test_bdd_32_create_team_flag_requires_user_visibility_conflict` | `create -s 报告 --team proj-a --user alice file.md` 成功（is_public=false）；`--team + --visibility public` → fail fast exit 非 0 |
| BDD-33 | test_cli_teams.py | `test_bdd_33_list_team_explicit_filter` | proj-a 2 entry + 其他 1 → `list --team proj-a --user alice` 只列 2 个 |
| BDD-34 | test_cli_teams.py | `test_bdd_34_remote_create_peekclient_passes_team_id` | 远程模式 mock PeekClient：断言 create_entry 收到 team_id 且非 public |
| BDD-35 | （mcp 批） | — | 后端只读支撑见 test_team_visibility.py raw/team 契约 |
| BDD-36 | test_team_visibility.py | `test_bdd_36_raw_team_field_member_and_global_key` | 成员 /raw 含 team 字段；carol /raw 404；全局 key（PEEKVIEW_SERVER__API_KEY）raw 200 且含 team；share 访问者 raw 不含 team |
| BDD-37 | （mcp 批） | — | description 元数据（mcp 批） |
| BDD-38~44 | （frontend 批） | — | |

## 3. 补强用例（BDD 之外，承接 P2 §2/§11 明确的 P3 测试缺口）

| 来源 | 用例 | 测试名 | 说明 |
|---|---|---|---|
| P2 §11-1 全新库 FK | test_team_migration.py | `test_fk_delete_team_cascades_members_set_null_entries` | 全新库 create_all 路径删 team → team_members CASCADE、entries.team_id SET NULL |
| P2 §11-1 全新库 FK | test_team_migration.py | `test_fk_delete_user_cascades_teams` | 全新库删 user（FK CASCADE）→ teams 连带删 |
| P2 §3.4/R1 CLI 索引 | test_cli_teams.py | `test_bdd_31_cli_local_db_has_team_indexes` | CLI 本地直建库含 idx_entries_team_id / idx_team_members_user_id |
| P2 §3.4/R1 CLI 旧库自愈 | test_team_migration.py | `test_cli_old_db_teams_command_self_heals` | 旧库（无 team_id）先跑 `peekview teams` → 自愈迁移成功 |

## 4. 用例设计要点（红灯语义锚定）

- **BDD-1/2/5/36 team 响应字段**：EntryResponse/EntryListItem/EntryRawResponse 现无 `team` 字段。绿灯后响应含 `team: {slug, name}`；本批红灯已按该契约断言（字段缺失 → KeyError/断言失败=B 类）。
- **BDD-2 防枚举同构断言**：比较响应 JSON 的 key 集合（错误结构同构），锁 404 不锁文案。
- **BDD-21/22/30 422 契约**：断言 `resp.status_code == 422`（非 400/201）+ 错误 code 为 PARAMETER_VALIDATION_ERROR（存在性不区分）。
- **BDD-27 create 强制私有**：创建后直读 DB 断言 entry.is_public False + team_id 正确（防"API 层强制、落库仍 public"半吊子实现）。
- **BDD-28 撤销 share**：复用 `revoked_shares` 字段（现 update 已返回，team→public 后应 >0）。
- **BDD-36 share 访问者 raw 不含 team**：现有 raw share 分支走 get_entry_with_share，team 字段对 share 访问者为 null——锚定 P2 §3.1 共享契约。
- **BDD-31~33 CLI**：`CliRunner` + isolated_fs 同款 fixture；本地 create 需文件路径参数（nargs 允许空 → 建空 entry，避免误读路径）。
- **BDD-34 远程**：`monkeypatch` PeekClient 子类 stub 记录调用参数（本地 create 路径团队归属需要 --user，远程模式 create 不带 --user 也走 PeekClient——透传锚）。

## 5. 测试文件清单（新建，均红灯）

| 文件 | 覆盖 |
|---|---|
| `backend/tests/test_team_visibility.py` | BDD-1/2/3/4/5/6/10/14/15/36 权限矩阵 + team 过滤 + raw |
| `backend/tests/test_team_validation.py` | BDD-21/22/23/24/25/27/29/30 校验契约 + 竞态 |
| `backend/tests/test_teams_api.py` | BDD-7/8/9/18 teams CRUD + 成员管理 + 唯一性 |
| `backend/tests/test_share_team.py` | BDD-11/12/13/28 share × team 交互 |
| `backend/tests/test_team_migration.py` | BDD-16/17/26 + 全新库 FK 断言 + CLI 旧库自愈 |
| `backend/tests/test_teams_owner_fail.py` | BDD-19/20 owner 禁用/删除 |
| `backend/tests/test_cli_teams.py` | BDD-31/32/33/34 + CLI 本地直建库两索引 |

---

## frontend 批

# P3 测试用例清单 — TPV0095 frontend 域（BDD-38~44）

> 本文件是 frontend 批的用例清单片段，由主 Agent 与 backend/mcp 批合并为 P3-test-cases.md。
> 依据：P1-requirements.md §3.13（BDD-38~44）+ P2-design.md §5（前端设计 + §5.7 data-testid 清单 + §5.8 detail 三态）。
> 环境隔离：[PROD_NOT_TOUCHED] — 仅写测试文件 + 本文档，未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未跑 npm run dev。

## 被测对象（尚未实现 → 红灯）

| 待实现（P4） | 说明 |
|---|---|
| `EntryListView.vue` explore 第 5 tab（Teams）+ `tab-teams` | BDD-38 |
| team chips（`team-chip-{slug}`，FilterChip 承载）+ URL `team`/`view` 维度 | BDD-38/41 |
| 单一「团队不可用」态（`team-unavailable` + `team-unavailable-clear`）与空态区分（`teams-empty` / `team-empty`） | BDD-41 |
| `BaseBadge.vue` team 变体 + `label` 参数化（`data-testid="badge-team"`） | BDD-39/44 |
| `EntryCard.vue` / `EntryListRow.vue`：badge 优先级 `teamId ? team : (isPublic?public:private)`；toggle 按钮 team entry 隐藏 + tooltip；统一 `visibility-toggle` testid | BDD-39/40 |
| `stores/entryList.ts` `toggleVisibility` teamId 守卫 | BDD-40 |
| `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue` 状态标签三态（team → 「仅团队可见 · {teamName}」，不显示 Private） | BDD-44 |
| `views/searchUrl.logic.ts` `parseRestoreQuery`/`mergeQuery` 扩展 team/view；四维互斥 restore（All 激活含 `!currentTeam`） | BDD-38 |
| `stores/team.ts`（myTeams 快照）、`router.ts` /teams 路由、`TeamsView.vue`、`UserMenu.vue` Teams 入口、explore Teams tab 内「管理团队」链接 | BDD-41/42 |
| 移动端 tab 栏横向滚动 + tab 触达 ≥44px + tablist/aria-selected 语义 | BDD-43 |

## test_code_dir 声明

```
test_code_dir:
  component_specs:
    - frontend-v3/src/views/__tests__/tpv0095-entry-list-view-teams.spec.ts      # BDD-38/41/43（视图 5-tab + 不可用态 + a11y）
    - frontend-v3/src/views/__tests__/tpv0095-search-url-team.spec.ts              # BDD-38/41（searchUrl.logic team/view 扩展）
    - frontend-v3/src/components/__tests__/tpv0095-base-badge-team.spec.ts         # BDD-39/44（BaseBadge team 变体 + label）
    - frontend-v3/src/components/__tests__/tpv0095-entry-card-team.spec.ts         # BDD-39/40（EntryCard badge/toggle）
    - frontend-v3/src/components/__tests__/tpv0095-entry-list-row-team.spec.ts     # BDD-39/40（EntryListRow badge/toggle）
    - frontend-v3/src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts       # BDD-40（store 守卫 toggleVisibility）
    - frontend-v3/src/stores/__tests__/tpv0095-team-store.spec.ts                  # BDD-41/42（team store 动作清单）
    - frontend-v3/src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts   # BDD-44（detail 三态标签载体：入口组件需含 team 语义渲染）
  e2e_specs:
    - frontend-v3/e2e/team-visibility.spec.ts      # BDD-38/39/40/41/43
    - frontend-v3/e2e/teams-page.spec.ts           # BDD-42（含输入态逐态 Playwright 断言 + 三文案互异）
```

> e2e/teams-page.spec.ts 为 P2-design §6 gate 键 `P5_e2e_b`/`P6_e2e_b` 消费对象；e2e/team-visibility.spec.ts 为 `P5_e2e_a`/`P6_e2e_a` 消费对象（`E2E_SPEC` 单 spec 传参，不做逗号多 spec）。

## BDD ↔ 用例映射（1:1）

| BDD | 验收条件（P1） | 测试用例（编号引用 BDD） | 载体 | testid（P2 §5.7） |
|---|---|---|---|---|
| BDD-38 | explore 5 互斥 tab，仅当前激活高亮；Teams tab 激活时 All 不高亮（All 激活判定含 !currentTeam）；URL 反映 `?view=teams`/`?team={slug}` | `bdd38_explore_5_tabs_mutually_exclusive`：登录态渲染 5 tab（All/Mine/Teams/Archived/Starred），任意时刻至多 1 tab 带 active 类；Teams 激活时 All 无 active | 组件 spec（视图）+ E2E | `tab-all`/`tab-mine`/`tab-teams`/`tab-archived`/`tab-starred` |
| BDD-38 | 点 Teams tab → URL `view=teams`；点 team chip → URL `team={slug}` | `bdd38_teams_tab_url_view_teams`：激活 Teams → loadEntries 收到 team=me / URL 含 view=teams（store spy） | 组件 spec（视图） | `tab-teams` |
| BDD-38 | 点具体 team chip 过滤 | `bdd38_team_chip_sets_url_and_filter`：选中 chip → URL 含 `team={slug}`，chip 显示可移除 | 组件 spec（视图） | `team-chip-{slug}` |
| BDD-39 | team entry 卡片显示「仅团队可见 · {teamName}」badge；不叠加 private badge（两视图统一） | `bdd39_team_entry_badge_no_private_*`（EntryCard + EntryListRow 两套）：teamId 非空 → 渲染 badge-team 文案含团队语义；同时断言无 private/public 徽标并存 | 组件 spec | `badge-team` |
| BDD-39 | badge 用现有色板 token，禁新增 hex/emoji | `bdd39_badge_no_new_hex_or_emoji`：badge 容器 style/class 不出现在设计的 token 集合之外（class 断言 `badge-team`；文案不含 emoji 范围字符） | 组件 spec | `badge-team` |
| BDD-40 | team entry 卡片隐藏 toggle 按钮（含 tooltip 提示） | `bdd40_team_entry_hides_visibility_toggle_*`（两视图）：teamId 非空 + isOwner → 全 DOM 中 `visibility-toggle` count=0；同卡 delete 仍存在 | 组件 spec | `visibility-toggle` |
| BDD-40 | store 层 toggleVisibility 对 teamId entry 拒绝 | `bdd40_store_toggle_rejects_team_entry`：team entry → toggleVisibility 返回 false 且不发 API；条目 isPublic 不变 | 组件 spec（store） | — |
| BDD-40 | UI 与 store 双保险 | `bdd40_entry_list_view_guard_consistent`：视图 toggle handler 对 team 项不调 store（store spy 未调用） | 组件 spec（视图） | — |
| BDD-41 | `?team={slug}` 且 slug ∉ myTeams（不存在/非成员）→ 统一「团队不可用」态 + 清除 CTA | `bdd41_unavailable_state_for_unknown_team_*`：URL team=未知/非成员 → 渲染 `team-unavailable`；点击清除 → 过滤清除、URL 恢复 | 组件 spec + E2E | `team-unavailable` / `team-unavailable-clear` |
| BDD-41 | 不调 listEntries（不可用态判定依赖 myTeams settle） | `bdd41_unavailable_does_not_call_list`：未知 team → entry store loadEntries 未被调用（team=me 聚合正常调用） | 组件 spec（视图） | — |
| BDD-41 | 成员但无内容 → 「该团队暂无内容」（`team-empty`）；我无任何 team 聚合 → 「暂无团队内容」（`teams-empty`） | `bdd41_empty_states_distinct`：三态文案两两可区分 | 组件 spec（视图） | `team-empty` / `teams-empty` |
| BDD-41 | FilterChip dismiss aria-label 参数化 | `bdd41_team_chip_aria_label`：团队 chip dismiss aria-label 含「移除团队过滤」与团队名 | 组件 spec（FilterChip 复测） | — |
| BDD-42 | UserMenu 含 Teams 项且可达 /teams | `bdd42_user_menu_teams_entry`：UserMenu 渲染含 Teams 项且导航到 /teams | 组件 spec（UserMenu） | `user-menu-teams-item` |
| BDD-42 | explore Teams tab 内「管理团队」链接存在且指向 /teams | `bdd42_manage_teams_link_dom`：explore 登录态可见管理团队链接 href=/teams | 组件 spec（视图） | `teams-manage-link` |
| BDD-42 | 路由 /teams 存在 + 守卫（未登录 → /） | `bdd42_teams_route_registered`：router 路由表含 /teams（守卫逻辑 P6 实跑） | 组件 spec（router 静态断言） | — |
| BDD-42 | owner 在 /teams 新建成功显示于「我拥有的」分区 | `bdd42_create_team_shown_in_owned`：createTeam 成功后 owned 分区含新卡（team store 联动） | 组件 spec（team store 动作 + 视图待 P6） | `teams-owned` / `team-create-form` / `team-name-input` |
| BDD-42 | 成员添加失败三类（username 不存在 / 已是成员 / 无权）三文案两两互异 | `bdd42_member_add_error_copy_distinct`：三种失败文案捕获后两两不等（store 层 error 传播）；断言互异不锁字面 | 组件 spec（team store） | `team-error` |
| BDD-42 | 删除 team 有确认对话框（含「内容将转为仅自己可见」后果提示）；退出需确认后从「我加入的」消失；owner 不显示退出按钮 | `bdd42_delete_confirm_and_leave_flow`：删除触发确认；离开动作调 leaveTeam 并从 joined 消失；owner 无退出按钮（组件 spec 覆盖 store/判断逻辑，DOM 层 P6 e2e 实跑） | 组件 spec（team store + E2E） | `teams-joined` / `teams-owned` |
| BDD-43 | 移动端 5-tab 可横向滚动（overflow-x）、tab 触达高度 ≥44px、tablist/aria-selected 语义 | `bdd43_mobile_tablist_overflow_min_height`：tab 容器 overflow-x 样式 / tab 高度 ≥44px / role=tablist + tab aria-selected（jsdom 断言 class+attr；滚动视觉由 P6 截图） | 组件 spec（视图，样式与语义断言）+ E2E（Mobile project） | `tab-all`…`tab-starred` |
| BDD-44 | detail 头部状态标签对 team entry 显示 team 语义（含「团队」/team 名），不显示「Private」；private 仍 Private、public 仍 Public | `bdd44_detail_status_tag_team_semantics`：team entry（isPublic=false + teamId）→ EntryDetailHeader 状态标签含「团队可见 ·」team 名、不含 Private；private（无 teamId）→ Private；public → Public（三态可区分） | 组件 spec（detail 载体组件：EntryDetailHeader/EntryMetaTagsBar 或等价渲染入口） | —（detail 标签按 §5.8 落 BaseBadge team 变体 → `badge-team`） |

## 红灯确认记录（P3 自检，实测 2026-09-02）

组件 spec 10 文件 vitest run 自跑：**24 failed | 13 passed（37），0 SyntaxError**——红灯全部为 B 类（被测未实现/缺模块）：
- search-url-team / base-badge-team / entry-card-team / entry-list-row-team / entry-list-store-team / user-menu-teams / filter-chip-team / detail-visibility-tag / entry-list-view-teams：断言级失败（缺字段/变体/容器/testid/守卫）。
- team-store：`@/stores/team` 模块不存在 → import 失败（B 类，P4 新增模块）。
- 13 passed = 现状行为基线（public/private 正例、非 team toggle、匿名重定向路径结构等），证明 spec 挂接正确。
- e2e 两 spec：esbuild 语法/结构通过；P3 期 /teams 页面与 teams API 未实现 → 运行失败属预期红灯。未声称跑绿。
- 状态标记：[PROD_NOT_TOUCHED]

---

## mcp 批

# P3 测试用例 — MCP 批（TPV0095 team-visibility，BDD-35~37）

> 本片段由 mcp 批 test-designer 产出，主 Agent 合并为最终 P3-test-cases.md。
> test_code_dir: `packages/mcp-server/tests/`
> gate_commands 引用（P2 §6 固化）：P3_mcp = `make test-mcp-unit`（= packages/mcp-server `npm run test:unit`）

## 状态标记

`[PROD_NOT_TOUCHED]` — 本批只写测试文件（`packages/mcp-server/tests/team-visibility.test.ts`）+ 测试运行器登记（`package.json` test:unit 清单追加一行，属测试基础设施，非实现代码）；未写任何实现代码，未触碰生产 :8080 / ~/.peekview/ / pipx。

## 测试文件与用例清单（1:1 BDD 映射）

| # | 测试名（team-visibility.test.ts） | BDD | 被测对象（P2 §4） | 红灯根因（现状未实现点） |
|---|----------------------------------|-----|------------------|--------------------------|
| 1 | create_entry 传 team_id → POST body 透传 team_id | BDD-35 | createEntry.ts schema 加 `team_id: z.string().optional()` + handler 透传 | schema 无 team_id（zod strip 未知键）→ body.team_id undefined |
| 2 | publish_files 传 team_id → POST body 透传 team_id | BDD-35 | publishFiles.ts schema 加 team_id + handler 透传 | 同上 |
| 3 | client.listTeams() GET /api/v1/teams 带 Bearer 返回 owned/joined | BDD-35 | client.ts 新增 listTeams() | client.listTeams is not a function |
| 4 | list_teams 注册进 remote 模式 common 工具集 | BDD-35 | tools/index.ts 注册 listTeamsTool 到 common | tools/list 不含 list_teams |
| 5 | list_teams 注册进 local 模式 common 工具集 | BDD-35 | 同上（local 与 remote 双模式都有） | 同上 |
| 6 | listTeamsTool handler 无参只读：无查询参数 + Bearer + owned/joined 两分区 | BDD-35 | 新增 src/tools/listTeams.ts | 模块不存在（import 失败） |
| 7 | raw 响应含 team → get_entry 输出含 team: {slug,name} | BDD-36 | getEntry.ts buildOutput 透传 raw.team | GetEntryOutput 无 team 字段 → undefined |
| 8 | raw 响应无 team → get_entry 输出 team: null | BDD-36 | 同上（team: {slug,name}\|null 契约） | 无 team 键 → undefined ≠ null |
| 9 | create_entry description 含 TEAM VISIBILITY + list_teams + omit team_id → PUBLIC 硬提示 | BDD-37 | createEntry.ts description 加 TEAM VISIBILITY 块 | description 无该块 |
| 10 | publish_files description 同上 | BDD-37 | publishFiles.ts description 加 TEAM VISIBILITY 块 | description 无该块 |

**共 10 用例，覆盖 BDD-35~37（BDD-35: 用例 1-6，BDD-36: 用例 7-8，BDD-37: 用例 9-10）。**

## BDD → 断言要点

- **BDD-35**（MCP publish_files/create_entry 传 team_id 发布成功 + list_teams 两分区）：
  - create_entry 与 publish_files handler 传 `team_id: 'proj-a'` → msw 捕获的 POST /api/v1/entries body 含 `team_id: 'proj-a'`（服务端强制 is_public=false / 422 属 backend 批，MCP 层只锁透传）
  - `client.listTeams(token)` → GET /api/v1/teams 带 `Bearer`，返回 `{owned:[{slug,name,member_count}], joined:[...]}` 两分区结构
  - `createTools` remote 与 local 模式工具名清单均含 `list_teams`（P2：注册进 common，双模式都有）
  - listTeamsTool handler 无参只读：请求 URL 无查询串、带 Bearer、输出文本含 owned/joined 分区 slug
- **BDD-36**（MCP get_entry 对 team entry 响应含 team 字段；非成员 404 / 全局 key 200 属 backend 批 P6 矩阵，MCP 层锁 team 字段贯通）：
  - raw 响应含 `team: {slug,name}` → get_entry JSON 输出含同等 team 对象
  - raw 响应无 team（公开/私有/share 访问者）→ get_entry 输出 `team: null`（P2 §4：team: {slug,name}|null，share 访问者不附）
- **BDD-37**（description 含"省略 team_id 默认公开"硬提示）：
  - create_entry 与 publish_files 的 description 均匹配 `/TEAM VISIBILITY/`、含 list_teams 引导、含 omit team_id → PUBLIC 语义（`/omit team_id/i` + `/PUBLIC/`）

## 测试基础设施登记（非实现）

- `packages/mcp-server/package.json` `test:unit` 显式文件清单追加 `tests/team-visibility.test.ts`（vitest include 虽为 glob，但 npm script 是显式清单；不登记则 `make test-mcp-unit` 永不执行本文件 → check-tdd-red 假绿灯）

## 红灯自跑确认（P3 自检）

命令：`cd packages/mcp-server && timeout 300s npx vitest run --reporter=dot`

结果（2026-09-02，TPV0095 引入测试）：
- 本批 10 用例 **10 失败（全红）**，失败类别全部为 **B 类真红灯**（被测目标未实现）：
  1. `create_entry` / `publish_files` 透传：`AssertionError: expected undefined to be 'proj-a'`（schema 无 team_id）
  2. `client.listTeams is not a function`
  3. remote / local 工具集 `expected [...] to include 'list_teams'`
  4. listTeamsTool handler：`Failed to load url ../src/tools/listTeams.js ... Does the file exist?`
  5. get_entry team 字段：`expected undefined to deeply equal { slug: 'proj-a', name: 'Proj A' }` / `expected undefined to be null`
  6. description：`expected 'Create a new PeekView entry...' to match /TEAM VISIBILITY/`（两工具）
- 既有测试回归：25 passed 文件中 324 passed / 7 skipped；唯一额外失败为 `publishFiles.test.ts > 默认白名单：拒绝 cwd/tmpdir 外文件` → `EROFS: read-only file system, mkdtemp '/var/tmp/pv-outside-...'` —— **环境性失败（沙箱 /var/tmp 只读），与 TPV0095 无关的既有用例**，未触碰（本批不写实现、不越 scope）

---
