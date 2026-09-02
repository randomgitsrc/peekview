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
