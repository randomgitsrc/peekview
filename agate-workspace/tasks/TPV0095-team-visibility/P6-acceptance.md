---
phase: P6
task_id: TPV0095
type: acceptance
parent: P5-test-results.md
trace_id: TPV0095-P6-20260902
status: approved
created: 2026-09-03
agent: verifier
# ── v2.0 机器汇总 ──
pass: 44
fail: 0
ui_affected: true
---

# P6 验收报告 — 团队可见性机制 Team Visibility（TPV0095）

> 汇总 verifier（merge）整合 V1（backend/CLI/MCP 域 BDD-1~37）+ V2（frontend UI 域 BDD-38~44）验收结果。
> 证据基础：`P6-evidence/backend/`（V1 证据，test-output.log 尾行 `EXIT_CODE: 0`）+ `P6-evidence/frontend/`（V2 证据，test-output.log 尾行 `EXIT_CODE: 0`）。
> 状态标记：`[PROD_NOT_TOUCHED]`（V1/V2 全程仅触 :8888 debug / /tmp 隔离 HOME / :18800 CDP / workspace；未触 :8080 生产 / ~/.peekview / pipx peekview）
> 状态标记：`[NO_NEED_CONFIRM]`
> 验收方式：backend pytest + MCP vitest + 真实远程 CLI HTTP 实测 + 7 路径权限矩阵 live 逐格 + frontend Playwright E2E + CDP DOM/几何/键盘断言 + vision-engine 视觉分析，逐条二值判定（先实跑后结论，V1/V2 各自于 2026-09-02/03 实跑）。

## 交叉核对记录（V1 + V2 = P1 全部 44 条，无重复/遗漏）

- P1-requirements.md `#### BDD-NN:` 标题数：**44**（BDD-1~44 连续，见第 5 节修订记录 35→43 后增补 BDD-44 [SCOPE+] 为 44 条）
- V1 `P6-evidence/backend/results.md` PASS 行：BDD-1~37 共 **37 条**（连续无缺口、无重复）
- V2 `P6-evidence/frontend/results.md` PASS 行：BDD-38~44 共 **7 条**（连续无缺口、无重复）
- V1 覆盖 BDD-1~37 = P1 3.1~3.12 节（后端权限/teams API/防枚举/share/star/生命周期/校验契约/竞态/兼容性能/API 契约/CLI/MCP）
- V2 覆盖 BDD-38~44 = P1 3.13 节（前端 UI：Teams tab/badge/toggle 守卫/单一不可用态//teams 管理页/移动端 tab/detail 三态标签）
- 并集 = {BDD-1 … BDD-44} = P1 全部 44 条，交集为空（V1 文件已声明不涉 BDD-38~44；V2 文件已声明不涉 BDD-1~37）；**无重复、无遗漏**
- 后端侧契约锚核对：BDD-44 的 raw/team 后端契约由 BDD-36 后端 raw 断言（TestBdd36RawTeam）承担，V1 已实测，V2 detail 页三态标签在此基础上做 DOM+vision 验收，无跨域裂缝

## BDD 逐条验收结果

- PASS BDD-1: team 创建者发布的 team entry 对 owner 与成员均 200 且响应含 `team: {slug, name}`、匿名 404 — pytest `TestBdd1::test_bdd_1_owner_and_member_can_read_team_entry_anon_404` PASSED (backend/test-output.log, backend/pytest-team-run1.log, backend/pytest-team-run2.log, backend/results.md)
- PASS BDD-2: 非成员对 7 条读路径（get/list/raw/files-content/render/download/share-read）全 404 且与 slug 不存在不可区分 — pytest `TestBdd2::test_bdd_2_nonmember_404_all_7_read_paths_indistinguishable` PASSED + live 矩阵 carol 全 404 (backend/test-output.log, backend/matrix-7paths-live.txt)
- PASS BDD-3: 非成员列表 All 视图不含 team entry — pytest `TestBdd3::test_bdd_3_nonmember_list_all_excludes_team_entry` PASSED + live carol All-view 不含 (backend/test-output.log)
- PASS BDD-4: 成员列表 All 聚合与 team= 过滤视图均含该 entry — pytest `TestBdd4::test_bdd_4_member_list_all_and_team_filter_include` PASSED (backend/test-output.log)
- PASS BDD-5: 7 条读路径对 team 成员全部放行 200 — pytest `TestBdd5::test_bdd_5_member_200_all_7_read_paths` PASSED + live 矩阵 bob 全 200（权限收敛后无一路径漏改 404） (backend/test-output.log, backend/matrix-7paths-live.txt)
- PASS BDD-6: 归档 team entry 对无星标成员 404、星标成员 200（星标不变量，team 可见性不延伸归档态） — pytest `TestBdd6::test_bdd_6_archived_team_entry_star_member_200` PASSED (backend/test-output.log)
- PASS BDD-7: team 详情（含成员列表）读权 owner+成员 200、无关者 404 且与 team 不存在不可区分 — pytest `TestBdd7::test_bdd_7_team_detail_owner_member_200_carol_404` PASSED (backend/test-output.log)
- PASS BDD-8: team 管理操作（重命名/删除/加成员/移成员）仅 owner——member/Carol 一律 404（读权 200 不延伸为写权）、owner 按接口语义 200/201/204 成功 — pytest `TestBdd8::test_bdd_8_member_and_carol_manage_operations_404_owner_succeeds` PASSED (backend/test-output.log)
- PASS BDD-9: 添加成员 username 不存在返回 404、错误语义与非 owner 操作一致（无 username 存在性 oracle） — pytest `TestBdd9::test_bdd_9_add_member_unknown_username_404` PASSED (backend/test-output.log)
- PASS BDD-10: ?team= 对"不存在的 team"与"非成员 team"四组响应（匿名×2 + Carol×2）状态码与响应体结构完全一致（200+空 items，无 teamFound/错误码/差异字段） — pytest `TestBdd10::test_bdd_10_team_filter_unknown_and_nonmember_identical_empty` PASSED (backend/test-output.log)
- PASS BDD-11: owner 与 admin 均可创建 team entry 的 share（201 + token），token 可读该 entry（200） — pytest `TestBdd11::test_bdd_11_owner_and_admin_create_share_for_team_entry` PASSED + live share-read 200 (backend/test-output.log)
- PASS BDD-12: team 成员不可创建 team entry 的 share → 404（现状 403 收紧，防私有 entry 存在性探测） — pytest `TestBdd12::test_bdd_12_member_cannot_create_share_404` PASSED (backend/test-output.log)
- PASS BDD-13: share 生命周期与成员变动/team 删除无关——成员被移出或 team 被删后原 token 仍可读（200） — pytest `TestBdd13::test_bdd_13_share_outlives_member_removal_and_team_delete` PASSED (backend/test-output.log)
- PASS BDD-14: 成员 star 的 team entry 出现在星标列表（?starred=true 与 /stars）——两处 starred 可见性条件（list_entries starred_cond + star_service._build_star_item）补 team 缺口修复 — pytest `TestBdd14::test_bdd_14_member_starred_team_entry_in_star_lists` PASSED (backend/test-output.log)
- PASS BDD-15: 非成员残留 star 不构成越权读通道——星标列表不含该 entry 且详情 404 — pytest `TestBdd15::test_bdd_15_nonmember_star_does_not_leak_team_entry` PASSED (backend/test-output.log)
- PASS BDD-16: 删除 team 后其 entry `team_id` 置 NULL、owner 仍可读、非 owner 不可读；`PRAGMA foreign_key_check`/`integrity_check` 均通过且文件数据完好 — pytest `TestBdd16::test_bdd_16_delete_team_entries_team_id_null_owner_readable_data_intact` PASSED + `TestFreshDbFkTeam::test_fk_delete_team_cascades_members_set_null_entries` PASSED (backend/test-output.log)
- PASS BDD-17: 旧库（无 teams/team_members 表、entries 无 team_id 列）升级双启动成功、存量 entries 完好且 team_id 为 NULL、迁移幂等无重复建表/加列错误 — pytest `TestBdd17::test_bdd_17_old_db_upgrade_twice_ok_data_intact` PASSED (backend/test-output.log)
- PASS BDD-18: team name 在 owner 内唯一（跨 owner 同名不冲突）、slug 全局唯一冲突自动 -N 后缀（A 的 slug=alpha 不变、B 得 alpha-1）、owner 内重复 name 收到明确校验错误 — pytest `TestBdd18::test_bdd_18_name_unique_per_owner_slug_global_suffix` PASSED (backend/test-output.log)
- PASS BDD-19: owner 被禁用 → team 冻结：成员读权/星标/我的 teams 均保留（200），admin 不自动接管管理、无任何登录用户可执行 owner 管理操作 — pytest `TestBdd19::test_bdd_19_owner_disabled_team_frozen_member_reads_remain` PASSED (backend/test-output.log)
- PASS BDD-20: owner 账号删除 → team 与 entries 沿现有 CASCADE 连带删除、FK 链式无孤儿行、从一切读路径消失 — pytest `TestBdd20::test_bdd_20_owner_deleted_team_and_entries_cascade` PASSED + `TestFreshDbFkUser::test_fk_delete_user_cascades_teams` PASSED (backend/test-output.log)
- PASS BDD-21: team_id 不存在或非成员创建 entry 一律 422、响应体不可区分存在性、绝不静默忽略（防误发 public 数据泄露） — pytest `TestBdd21::test_bdd_21_create_unknown_and_nonmember_team_422_indistinguishable` PASSED (backend/test-output.log)
- PASS BDD-22: 匿名携带非空 team_id 创建 entry 返回 422 — pytest `TestBdd22::test_bdd_22_anonymous_create_with_team_id_422` PASSED (backend/test-output.log)
- PASS BDD-23: 成员被移除后立即重读任一读路径返回 404（权限判定基于当前成员关系、无缓存窗口） — pytest `TestBdd23::test_bdd_23_removed_member_immediate_read_404` PASSED (backend/test-output.log)
- PASS BDD-24: team 删除与 list_entries 并发不抛 5xx（2xx/4xx 任一一致视图，无未捕获异常） — pytest `TestBdd24::test_bdd_24_concurrent_team_delete_and_list_no_5xx` PASSED (backend/test-output.log)
- PASS BDD-25: 不传 team 参数的既有创建/列表行为零变化（新增字段 optional 非 breaking，私有/公开发布语义与上线前一致） — pytest `TestBdd25::test_bdd_25_no_team_param_behavior_zero_change` PASSED (backend/test-output.log)
- PASS BDD-26: list_entries team 聚合 `EXPLAIN QUERY PLAN` 命中索引（idx_entries_team_id / idx_team_members_user_id）、无 entries/team_members 逐行全表 SCAN — pytest `TestBdd26Explain::test_bdd_26_explain_plan_index_hit_no_scan_on_team_members` PASSED (backend/test-output.log)
- PASS BDD-27: create 携带 team_id 时服务端强制 is_public=false（不 422，201 成功）— pytest `TestBdd27::test_bdd_27_create_with_team_id_forces_is_public_false` PASSED + live debug 实测 entry is_public=False (backend/test-output.log, backend/matrix-7paths-live.txt)
- PASS BDD-28: update 将 team entry 转 public（去 team_id）时撤销该 entry 全部活跃 share（复用 was_private 撤销逻辑显式覆盖 team→public 路径） — pytest `TestBdd28::test_bdd_28_update_team_to_public_revokes_all_shares` PASSED (backend/test-output.log)
- PASS BDD-29: update 将 entry 迁移到当前用户为成员的 team 成功（成员口径：owned/joined 皆可，is_public 保持 false，与 create 校验一致） — pytest `TestBdd29::test_bdd_29_update_migrate_to_joined_team_succeeds` PASSED (backend/test-output.log)
- PASS BDD-30: update 迁移到非成员/不存在的 team 均返回 422、与 create 校验（BDD-21）同构、不可区分存在性 — pytest `TestBdd30::test_bdd_30_update_migrate_to_nonmember_and_unknown_422` PASSED (backend/test-output.log)
- PASS BDD-31: `peekview teams` 输出 owned+joined 两分区、`--json` 结构 `{owned:[...], joined:[...]}` 正确、本地库含两 team 索引 — pytest `TestBdd31::test_bdd_31_teams_owned_joined_partitions` PASSED + `TestCliIndexes::test_bdd_31_cli_local_db_has_team_indexes` PASSED (backend/test-output.log)
- PASS BDD-32: `peekview create --team` 发布到指定 team（is_public=false）；与 `--visibility public` 互斥 fail fast（请求发出前报错退出、exit code 非 0） — pytest `TestBdd32::test_bdd_32_create_team_and_visibility_conflict` PASSED (backend/test-output.log)
- PASS BDD-33: `peekview list --team` 只列该 team 的 entry（显式过滤、不做隐式聚合；不传 --team 默认行为不变） — pytest `TestBdd33::test_bdd_33_list_team_explicit_filter` PASSED (backend/test-output.log)
- PASS BDD-34: CLI 远程模式经 PeekClient 透传 team_id（验收锚）——pytest stub 断言 + 真实 HTTP 实测（tmp HOME + PEEKVIEW_REMOTE__URL=:8888 远程 create --team proj-a → debug 实例 entry y5yyna 实查 team={slug:proj-a,name:Proj A} + is_public=False） (backend/test-output.log, backend/matrix-7paths-live.txt)
- PASS BDD-35: MCP publish_files/create_entry 传 team_id 发布成功（不撞 422，is_public=false、team 归属正确）；list_teams 两分区无参只读（remote+local 注册） — MCP vitest 6 条 PASSED (backend/mcp-team-visibility-run1.log)
- PASS BDD-36: MCP get_entry 对 team entry 响应含 `team: {slug,name}`（200）；非成员 404；全局 master key 200（含后端 /raw 契约 TestBdd36RawTeam：成员 raw 200 含 team / carol raw 404 / 全局 key raw 200） — MCP vitest 2 条 PASSED + backend pytest PASSED (backend/mcp-team-visibility-run1.log, backend/test-output.log)
- PASS BDD-37: MCP create_entry/publish_files 工具 description 均含 TEAM VISIBILITY 引导块与"omitting team_id → default PUBLIC"显式硬提示 — MCP vitest 2 条 PASSED (backend/mcp-team-visibility-run1.log)
- PASS BDD-38: 布局结构——explore 顶栏 5 个互斥 tab（All/Mine/Teams/Archived/Starred）；Teams 激活高亮且 All 不高亮（All 激活判定含 !currentTeam）；URL 反映 ?view=teams — E2E spec a 2 用例 DOM+URL 断言通过 + CDP tabs 状态 [{tab-teams active=true, tab-all active=false}] URL=http://127.0.0.1:8888/explore?view=teams；vision 截图确认 5 tab 顺序与 Teams 蓝色下划线激活、All 未高亮 (screenshots/bdd38-teams-tab-desktop.png, screenshots/bdd38-teams-view-url-desktop.png, frontend/logs/e2e-speca.log, frontend/logs/bdd-visual-capture.log, frontend/bdd-visual-capture.cjs, frontend/logs/vision/raw-bdd38.txt) (vision: P6-evidence/frontend/vision-reports/bdd-38.yaml)
- PASS BDD-39: 布局结构——team entry 卡片/行显示「仅团队可见 · {teamName}」badge 且不叠加 private badge（EntryCard 与 EntryListRow 两视图统一） — E2E spec a 断言 badge-team 文案含「仅团队可见」+ 无 .badge-private；CDP grid card {teamBadge:"仅团队可见 · PV6-…", privBadges:0} + list row {privBadges:0}；vision 全卡逐一读得 badge 文案、无 private 字样 (screenshots/bdd39-team-badge-grid-desktop.png, screenshots/bdd39-team-badge-list-desktop.png, screenshots/tpv0095-bdd39-team-badge.png, frontend/logs/vis-bdd39.json, frontend/logs/vis-bdd39.err, frontend/logs/vision/raw-bdd39.txt) (vision: P6-evidence/frontend/vision-reports/bdd-39.yaml)
- PASS BDD-40: 交互行为——team entry 卡片隐藏 visibility-toggle（count=0，delete 保留）；store 层 toggleVisibility 对 teamId 存在 entry 拒绝调用（UI 与守卫双保险） — E2E spec a 断言 toggle count=0 + delete 可见；CDP 全视图 toggle count=0 且 card hasDelete=true；单测 tpv0095-entry-list-store-team.spec.ts 覆盖 store 守卫（P5 frontend 1338 passed） (screenshots/bdd39-team-badge-list-desktop.png, frontend/logs/vision/raw-bdd40.txt) (vision: P6-evidence/frontend/vision-reports/bdd-40.yaml)
- PASS BDD-41: 交互行为——?team= 对不存在/无权限 team 统一呈现「团队不可用」态 + 清除过滤 CTA；清除后 URL team 参数消失；与「该团队暂无内容」两文案可区分（后者仅用于成员且确实无内容的 team） — E2E spec a 断言 team-unavailable + clear CTA + URL 恢复；CDP unav 文案「团队不可用/你无权访问该团队，或该团队不存在。清除过滤」clearVisible=true、清除后 URL=?view=teams (screenshots/bdd41-team-unavailable-desktop.png, screenshots/tpv0095-bdd41-team-unavailable.png, frontend/logs/vision/raw-bdd41.txt) (vision: P6-evidence/frontend/vision-reports/bdd-41.yaml)
- PASS BDD-42: 交互行为——/teams 双入口（UserMenu Teams 项 + Teams tab「管理团队」链接→/teams，DOM 存在性断言防 /stars 无入口反模式）+ owner 新建/删除（确认框含「仅自己可见」后果提示）/添加成员（username 不存在/已是成员/无权三类错误文案两两互异）/成员退出（确认后从 joined 消失）+ owner 无退出按钮 — E2E spec b 14/14（含 bob∈proj-a fixture 下 rerun#2 真执行退出流）+ CDP 补充：退出 alertdialog 文案→确认→joined 消失 LEAVE_FLOW_OK、三错误文案 unique=3、owned leave buttons=0；manual-review 记录见 frontend/manual-review-bdd42.md (screenshots/bdd42-teams-owned-desktop.png, screenshots/bdd42-user-menu-teams.png, screenshots/bdd42-member-error-1-desktop.png, screenshots/bdd42-member-errors-desktop.png, screenshots/bdd42-leave-confirm-desktop.png, screenshots/bdd42-after-leave-desktop.png, screenshots/tpv0095-bdd42-create-team.png, screenshots/tpv0095-bdd42-delete-confirm.png, screenshots/tpv0095-bdd42-member-error-copies.png, frontend/logs/e2e-specb.log, frontend/logs/e2e-specb-rerun2.log, frontend/logs/bdd42-leave.log, frontend/bdd42-leave.cjs, frontend/logs/vision/raw-bdd42a.txt, frontend/logs/vision/raw-bdd42b.txt, frontend/logs/vision/raw-bdd42c.txt, frontend/manual-review-bdd42.md) (vision: P6-evidence/frontend/vision-reports/bdd-42.yaml)
- PASS BDD-43: 布局结构（UX）——移动端（390×844）5-tab 单行可横向滚动（overflow-x=auto，无换行堆叠）、每 tab 触达高 ≥44px（heights [44,44,44,44,44]）、aria-selected 全存在、键盘可用（tablist + ArrowRight 焦点/激活跟随） — E2E spec a Mobile Chrome project 断言 + CDP mobile 同断言 + 键盘实测 KEYBOARD_OK: true；manual-review 记录见 frontend/manual-review-bdd43.md (screenshots/bdd43-mobile-tablist.png, screenshots/tpv0095-bdd43-mobile-tabs.png, frontend/logs/bdd43-keyboard.log, frontend/bdd43-keyboard.cjs, frontend/logs/vision/raw-bdd43.txt, frontend/manual-review-bdd43.md) (vision: P6-evidence/frontend/vision-reports/bdd-43.yaml)
- PASS BDD-44: 布局结构——detail 页状态标签三态可区分：team entry 显示「仅团队可见 · Proj A」（不显示误导性 Private）、private 仍 "Private"、public 仍 "Public"（EntryDetailHeader/EntryMetaTagsBar .status-tag 两处） — CDP 三态 × desktop+mobile DOM 断言 .status-tag 文案全 OK（bdd44-run.log ALL_OK: true）；vision 三张截图分别读得 仅团队可见 · Proj A / Private / Public；manual-review 记录见 frontend/manual-review-bdd44.md (screenshots/bdd44-team-desktop.png, screenshots/bdd44-team-mobile.png, screenshots/bdd44-private-desktop.png, screenshots/bdd44-private-mobile.png, screenshots/bdd44-public-desktop.png, screenshots/bdd44-public-mobile.png, frontend/logs/bdd44-run.log, frontend/bdd44-three-state.cjs, frontend/logs/vision/raw-bdd44a.txt, frontend/logs/vision/raw-bdd44b.txt, frontend/logs/vision/raw-bdd44c.txt, frontend/manual-review-bdd44.md) (vision: P6-evidence/frontend/vision-reports/bdd-44.yaml)

## 视觉质量 checklist 核对（P2 §5.5/§5.6/§5.8 + P1 UX 类别 BDD）

- **渲染正确性（layout 布局型）**：checked — 以 DOM/几何断言 + vision 双证判定（BDD-38 tab 激活态、BDD-39 badge 文案与 .badge-private 缺失、BDD-41 文案、BDD-43 overflow-x/heights/aria-selected、BDD-44 .status-tag 三态文案），vision YAML blocker_count 全 0；判据均为存在性/文案/几何量化断言，非主观描述。
- **交互行为**：checked — BDD-40 toggle count=0 + store 守卫单测、BDD-41 清除 CTA 后 URL 断言、BDD-42 E2E 14/14 全操作流 + CDP 退出流、BDD-43 键盘 ArrowRight 焦点/激活断言，均为自动化动作断言（人工复核记录见 manual-review-bdd42/43/44.md）。
- **动效/时序**：本任务无动效类判据（layout 常规布局型，无帧序列/时序截图需求），不适用项标注 unchecked（无对应 BDD）。
- **沿用约束**：checked — BDD-39 禁新增 hex/emoji（badge 用现有色板 token），BDD-43 触达 ≥44px 量化锚。无主观词（可读/美观/流畅等）作为判据。

## 人工复核记录摘要（输入态/交互形态变化类 BDD-42/43/44）

复核人：verifier V2（TPV0095-P6）；复核时间：2026-09-03；结论：PASS。
判定依据 = P2-design §5.5/§5.6/§5.8「输入态变化类用例的 P6 复核落为明确自动化动作」——BDD-42 添加成员三错误、新建、删除确认、退出确认均在 teams-page.spec.ts（E2E spec b 14/14）+ CDP 逐态脚本（logs/bdd42-leave.log、logs/bdd-visual-capture.log）断言 + 截图；BDD-43 移动端滚动与触达高度为 CDP 几何断言（overflow-x/heights/aria-selected）+ E2E Mobile Chrome；BDD-44 三态为 CDP DOM 文案断言 + vision 截图双证。无人工散文复核缺口。

**Summary**: 44/44 PASS, 0 FAIL（BDD-1~37 backend/CLI/MCP + BDD-38~44 frontend UI）
