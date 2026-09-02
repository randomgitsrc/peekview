# P6 验收结果 — backend + CLI + MCP 域（BDD-1~37 非 UI 部分）

> verifier V1 产出，2026-09-02。汇总 verifier 转抄整合用；不进 gate（gate 只读汇总 P6-acceptance.md）。
> 状态标记：`[PROD_NOT_TOUCHED]`（全程仅触 :8888 debug / tmp HOME / msw mock；:8080 探测 000 不可达，未触 ~/.peekview / pipx）
> 证据主文件：`test-output.log`（pytest 38/38 + MCP 10/10 + 远程 CLI 实测 + 7 路径矩阵；尾行 `EXIT_CODE: 0`）
> BDD 编号覆盖：BDD-1~37（backend/CLI/MCP 线）。BDD-38~44 属 frontend UI 域，由 frontend verifier 负责（本文件不含）。BDD-44 的 raw/team 后端侧契约锚 = BDD-36 后端 raw 断言（TestBdd36RawTeam）。

## BDD → 证据映射（逐条实跑）

| BDD | 行为 | 测试锚 / 证据 | 结果 |
|-----|------|--------------|------|
| BDD-1 | owner+成员 200 含 team 字段；匿名 404 | pytest `TestBdd1::test_bdd_1_owner_and_member_can_read_team_entry_anon_404` PASSED | PASS |
| BDD-2 | 非成员 7 读路径 404 且与 slug 不存在不可区分 | pytest `TestBdd2::test_bdd_2_nonmember_404_all_7_read_paths_indistinguishable` PASSED（get/raw/download/files-content/render/share-read/list）+ live 矩阵 carol 全 404 | PASS |
| BDD-3 | 非成员列表不含 team entry | pytest `TestBdd3::test_bdd_3_nonmember_list_all_excludes_team_entry` PASSED + live carol All-view 不含 | PASS |
| BDD-4 | 成员 All 聚合 + team= 过滤均含 | pytest `TestBdd4::test_bdd_4_member_list_all_and_team_filter_include` PASSED | PASS |
| BDD-5 | 7 读路径对成员全放行 200 | pytest `TestBdd5::test_bdd_5_member_200_all_7_read_paths` PASSED + live 矩阵 bob 全 200 | PASS |
| BDD-6 | 归档 team entry：星标成员 200 / 无星标成员 404 | pytest `TestBdd6::test_bdd_6_archived_team_entry_star_member_200` PASSED | PASS |
| BDD-7 | team 详情读权 owner+成员 200 / 无关者 404 | pytest `TestBdd7::test_bdd_7_team_detail_owner_member_200_carol_404` PASSED | PASS |
| BDD-8 | 管理操作（重命名/删除/加成员/移成员）仅 owner；member+Carol 404、owner 成功 | pytest `TestBdd8::test_bdd_8_member_and_carol_manage_operations_404_owner_succeeds` PASSED | PASS |
| BDD-9 | 添加成员 username 不存在 404 | pytest `TestBdd9::test_bdd_9_add_member_unknown_username_404` PASSED | PASS |
| BDD-10 | ?team= 对不存在/非成员 team 响应完全一致（200+空 items） | pytest `TestBdd10::test_bdd_10_team_filter_unknown_and_nonmember_identical_empty` PASSED | PASS |
| BDD-11 | owner+admin 建 team share 201，token 可读 200 | pytest `TestBdd11::test_bdd_11_owner_and_admin_create_share_for_team_entry` PASSED + live share-read 200 | PASS |
| BDD-12 | 成员不可建 team share → 404 | pytest `TestBdd12::test_bdd_12_member_cannot_create_share_404` PASSED | PASS |
| BDD-13 | share 生命周期与成员移除/team 删除无关（token 仍 200） | pytest `TestBdd13::test_bdd_13_share_outlives_member_removal_and_team_delete` PASSED | PASS |
| BDD-14 | 成员 star 的 team entry 入星标列表（?starred=true + /stars） | pytest `TestBdd14::test_bdd_14_member_starred_team_entry_in_star_lists` PASSED | PASS |
| BDD-15 | 非成员残留 star 不越权：星标列表不含 + 详情 404 | pytest `TestBdd15::test_bdd_15_nonmember_star_does_not_leak_team_entry` PASSED | PASS |
| BDD-16 | 删 team → entry team_id NULL、owner 可读、FK/integrity 通过 | pytest `TestBdd16::test_bdd_16_delete_team_entries_team_id_null_owner_readable_data_intact` PASSED + `TestFreshDbFkTeam::test_fk_delete_team_cascades_members_set_null_entries` PASSED | PASS |
| BDD-17 | 旧库升级双启动成功、存量完好、幂等 | pytest `TestBdd17::test_bdd_17_old_db_upgrade_twice_ok_data_intact` PASSED | PASS |
| BDD-18 | name owner 内唯一；slug 全局唯一冲突 -N 后缀 | pytest `TestBdd18::test_bdd_18_name_unique_per_owner_slug_global_suffix` PASSED | PASS |
| BDD-19 | owner 禁用 → team 冻结：成员读权保留、admin 不接管管理 | pytest `TestBdd19::test_bdd_19_owner_disabled_team_frozen_member_reads_remain` PASSED | PASS |
| BDD-20 | owner 删除 → team+entries CASCADE 连带删除、FK 无孤儿 | pytest `TestBdd20::test_bdd_20_owner_deleted_team_and_entries_cascade` PASSED + `TestFreshDbFkUser::test_fk_delete_user_cascades_teams` PASSED | PASS |
| BDD-21 | team_id 不存在或非成员创建 → 422 不可区分 | pytest `TestBdd21::test_bdd_21_create_unknown_and_nonmember_team_422_indistinguishable` PASSED | PASS |
| BDD-22 | 匿名携带 team_id 创建 → 422 | pytest `TestBdd22::test_bdd_22_anonymous_create_with_team_id_422` PASSED | PASS |
| BDD-23 | 成员被移除后立即读 → 404（无缓存窗口） | pytest `TestBdd23::test_bdd_23_removed_member_immediate_read_404` PASSED | PASS |
| BDD-24 | team 删除与 list 并发不抛 5xx | pytest `TestBdd24::test_bdd_24_concurrent_team_delete_and_list_no_5xx` PASSED | PASS |
| BDD-25 | 不传 team 参数既有行为零变化（回归线） | pytest `TestBdd25::test_bdd_25_no_team_param_behavior_zero_change` PASSED | PASS |
| BDD-26 | list team 聚合 EXPLAIN 命中索引、无逐行 SCAN | pytest `TestBdd26Explain::test_bdd_26_explain_plan_index_hit_no_scan_on_team_members` PASSED | PASS |
| BDD-27 | create 带 team_id 强制 is_public=false（不 422） | pytest `TestBdd27::test_bdd_27_create_with_team_id_forces_is_public_false` PASSED + live y5yyna/my4foi is_public=False | PASS |
| BDD-28 | update team→public 撤销全部 share | pytest `TestBdd28::test_bdd_28_update_team_to_public_revokes_all_shares` PASSED | PASS |
| BDD-29 | update 迁移到"我是成员的 team"成功（成员口径） | pytest `TestBdd29::test_bdd_29_update_migrate_to_joined_team_succeeds` PASSED | PASS |
| BDD-30 | update 迁移到非成员/不存在 team → 422 不可区分 | pytest `TestBdd30::test_bdd_30_update_migrate_to_nonmember_and_unknown_422` PASSED | PASS |
| BDD-31 | `peekview teams` owned+joined 分区（--json 结构）+ 本地索引 | pytest `TestBdd31::test_bdd_31_teams_owned_joined_partitions` PASSED + `TestCliIndexes::test_bdd_31_cli_local_db_has_team_indexes` PASSED | PASS |
| BDD-32 | `create --team` 发布到 team；与 `--visibility public` 互斥 fail fast | pytest `TestBdd32::test_bdd_32_create_team_and_visibility_conflict` PASSED | PASS |
| BDD-33 | `list --team` 只列该 team entry（显式过滤） | pytest `TestBdd33::test_bdd_33_list_team_explicit_filter` PASSED | PASS |
| BDD-34 | CLI 远程模式经 PeekClient 透传 team_id（验收锚） | pytest `TestBdd34::test_bdd_34_remote_create_peekclient_passes_team_id` PASSED（CLI→PeekClient stub 断言 team_id 入参）+ **真实 HTTP 实测**：tmp HOME + PEEKVIEW_REMOTE__URL=:8888 远程 create --team proj-a → debug 实例 entry y5yyna 实查 `team={slug:proj-a,name:Proj A}` + `is_public=False`（client.py:158-159 payload 透传实证） | PASS |
| BDD-35 | MCP publish_files/create_entry 传 team_id 不撞 422；list_teams 两分区无参只读 | MCP vitest 6 条 PASSED（create_entry/publish_files 透传、listTeams GET、remote+local 注册、handler 无参只读两分区） | PASS |
| BDD-36 | MCP get_entry 对 team entry 含 team 字段；非成员 404；全局 master key 200 | MCP vitest 2 条 PASSED（raw 含 team → 输出含 team；raw 无 team → team:null）+ backend `TestBdd36RawTeam::test_bdd_36_raw_team_field_member_404_others` PASSED（成员 raw 200 含 team / carol raw 404 / 全局 key raw 200 含 team） | PASS |
| BDD-37 | MCP description 含"omit team_id → default PUBLIC"硬提示 | MCP vitest 2 条 PASSED（create_entry + publish_files description 断言） | PASS |

## 权限矩阵专项（BDD-2/5：actor × 7 读路径）

> pytest 锚：`TestBdd2`（非成员逐路径 404 + 与 ghost slug 同构）+ `TestBdd5`（成员逐路径放行）。live 矩阵在 debug :8888 对 file-bearing team entry（my4foi，HTML 文件 id=55）逐格实跑，记录于 `matrix-7paths-live.txt` / `test-output.log` [D]。

| actor \ 路径 | get | list 中该条目 | raw | files-content | render | download | share-read（owner 合法 token） |
|---|---|---|---|---|---|---|---|
| **owner (alice)** | 200 ✓ | 含 ✓ | 200 ✓ | 200 ✓ | 200 ✓ | 200 ✓ | 200 ✓ |
| **成员 (bob)** | 200 ✓ | 含 ✓ | 200 ✓ | 200 ✓ | 200 ✓ | 200 ✓ | 200 ✓ |
| **非成员 (carol)** | 404 ✓ | 不含 ✓ | 404 ✓ | 404 ✓ | 404 ✓ | 404 ✓ | 404 ✓ |
| **匿名** | 404 ✓ | 不含（仅公开）✓ | 404 ✓ | 404 ✓ | 404 ✓ | 404 ✓ | 200（share 持有者走 share 语义，BDD-13 不随 team 撤销）✓ |
| **admin** | 200（admin 全见，can_read_entry is_admin 分支；share 创建 201 见 BDD-11）✓ | 含 ✓ | 200 ✓ | —（经 _resolve_entry 与 get 同判定） | —（同上） | 200（get_entry_by_api_key 全局 key 补分支；raw 全局 key 200 见 BDD-36 锚）✓ | 可创建 share 201（BDD-11）✓ |
| **归档 team entry 成员（无星标）** | 404 ✓（BDD-6） | — | — | — | — | — | — |
| **归档 team entry 成员（已星标）** | 200 ✓（BDD-6 星标不变量） | 星标列表含 ✓（BDD-14） | — | — | — | — | — |

> 注：admin actor 行对 team entry 的读为 200（can_read_entry is_admin 恒真语义 + 全局 key 分支）；BDD-2/5 pytest 矩阵锚覆盖 owner/member/nonmember/anon + share 访问者，admin 的 team-entry 读权由 admin 语义与全局 key 分支测试（TestBdd36RawTeam 全局 key 200、BDD-11 admin share 201）佐证，逐格无 403 残留、无存在性信号外泄。

## 汇总

backend pytest（7 team 文件 + CLI teams）：**38/38 PASSED**（EXIT_CODE: 0，3.40s，逐条 PASSED 见 test-output.log [A]）
MCP team-visibility.test.ts：**10/10 PASSED**（EXIT_CODE: 0，582ms）
BDD-34 真实远程 CLI HTTP 实测：**exit 0**，debug 实例 entry `y5yyna` `team=proj-a` + `is_public=False`
权限矩阵 live 逐格：owner/成员 7 路径 200×7、非成员 404×7、匿名 get 404 + share 持有者 200（矩阵文件 matrix-7paths-live.txt）

**本域（BDD-1~37）结果：37/37 PASS（0 FAIL）**
BDD-1~37 = backend 1-30 + CLI 31-34 + MCP 35-37，全部逐条实跑 PASS；BDD-36 后端 raw 契约（TestBdd36RawTeam）与 MCP 契约（2 条 vitest）双端均已实测。BDD-38~44 属 frontend UI 域（frontend verifier 负责），非本文件范围。

**Summary**: 37/37 PASS, 0 FAIL (BDD-1~37, backend/CLI/MCP)

## PASS/FAIL 行（供汇总 verifier 转抄；证据路径相对本 results.md）

- PASS BDD-1: team 创建者发布的 team entry 对 owner 与成员 200 含 team 字段、匿名 404 (test-output.log)
- PASS BDD-2: 非成员对 7 条读路径全 404、与 slug 不存在不可区分 (test-output.log)
- PASS BDD-3: 非成员列表 All 视图不含 team entry (test-output.log)
- PASS BDD-4: 成员列表 All 聚合与 team= 过滤均含该 entry (test-output.log)
- PASS BDD-5: 7 条读路径对 team 成员全部放行 200 (test-output.log)
- PASS BDD-6: 归档 team entry 对无星标成员 404、星标成员 200（星标不变量） (test-output.log)
- PASS BDD-7: team 详情读权 owner+成员 200、无关者 404 含成员列表 (test-output.log)
- PASS BDD-8: team 管理操作权（重命名/删除/加成员/移成员）仅 owner，member/Carol 404、owner 成功 (test-output.log)
- PASS BDD-9: 添加成员 username 不存在返回 404 (test-output.log)
- PASS BDD-10: ?team= 过滤对不存在/非成员 team 四组响应完全一致（200+空 items） (test-output.log)
- PASS BDD-11: owner 与 admin 可创建 team entry share 201、token 可读 200 (test-output.log)
- PASS BDD-12: team 成员不可创建 team entry share → 404 (test-output.log)
- PASS BDD-13: share 生命周期与成员变动/team 删除无关（token 仍 200） (test-output.log)
- PASS BDD-14: 成员 star 的 team entry 出现在 ?starred=true 与 /stars 列表 (test-output.log)
- PASS BDD-15: 非成员残留 star 不越权——星标列表不含 + 详情 404 (test-output.log)
- PASS BDD-16: 删除 team 后 entry team_id NULL、owner 可读、FK/integrity 通过 (test-output.log)
- PASS BDD-17: 旧库（无 teams/team_id）升级双启动成功、存量完好、迁移幂等 (test-output.log)
- PASS BDD-18: team name owner 内唯一、slug 全局唯一冲突自动 -N 后缀 (test-output.log)
- PASS BDD-19: owner 禁用 → team 冻结：成员读权保留、admin 不接管管理 (test-output.log)
- PASS BDD-20: owner 删除 → team+entries 沿 CASCADE 连带删除、FK 无孤儿 (test-output.log)
- PASS BDD-21: team_id 不存在或非成员创建一律 422、不可区分存在性 (test-output.log)
- PASS BDD-22: 匿名携带 team_id 创建返回 422 (test-output.log)
- PASS BDD-23: 成员被移除后立即读任一读路径返回 404（无缓存窗口） (test-output.log)
- PASS BDD-24: team 删除与 list_entries 并发不抛 5xx (test-output.log)
- PASS BDD-25: 不传 team 参数既有创建/列表行为零变化（回归线） (test-output.log)
- PASS BDD-26: list_entries team 聚合 EXPLAIN 命中索引、无逐行 SCAN (test-output.log)
- PASS BDD-27: create 携带 team_id 强制 is_public=false（不 422） (test-output.log, matrix-7paths-live.txt)
- PASS BDD-28: update team→public 撤销该 entry 全部 share (test-output.log)
- PASS BDD-29: update 迁移到当前用户为成员的 team 成功（成员口径，is_public 保持 false） (test-output.log)
- PASS BDD-30: update 迁移到非成员/不存在 team 返回 422、与 create 校验同构 (test-output.log)
- PASS BDD-31: `peekview teams` 输出 owned+joined 两分区、--json 结构正确、本地库含两索引 (test-output.log)
- PASS BDD-32: `peekview create --team` 发布到指定 team、与 --visibility public 互斥 fail fast (test-output.log)
- PASS BDD-33: `peekview list --team` 只列该 team 的 entry（显式过滤） (test-output.log)
- PASS BDD-34: CLI 远程模式经 PeekClient 透传 team_id——真实 debug :8888 HTTP 实测 entry 归属 proj-a 且 is_public=false (test-output.log, matrix-7paths-live.txt)
- PASS BDD-35: MCP publish_files/create_entry 传 team_id 发布成功；list_teams 两分区无参只读（remote+local 注册） (mcp-team-visibility-run1.log)
- PASS BDD-36: MCP get_entry 对 team entry 响应含 team 字段、非成员 404、全局 master key 200（含后端 /raw 契约） (mcp-team-visibility-run1.log, test-output.log)
- PASS BDD-37: MCP create_entry/publish_files description 含"omitting team_id → default PUBLIC"硬提示 (mcp-team-visibility-run1.log)
