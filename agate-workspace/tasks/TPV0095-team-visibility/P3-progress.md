
## P3 test-designer(backend) 分阶段落盘 2026-09-02
- [x] 读 dispatch-context：backend 域负责 BDD-1~34 后端部分；产出 P3-test-cases-backend.md + backend/tests/test_team_*.py（新建、红灯）
- [x] 读角色定义 test-designer.md：BDD 1:1 映射、测试名引用 BDD 编号、自跑确认红灯（B 类=被测未实现 / A 类=测试 bug）
- [x] 读 P0-brief.md：9 条核心逻辑、can_read_entry 收敛 7 路径、防枚举 404、star 补 team、share 403→404、迁移顺序、存量 bug get_entry_by_api_key
- [x] 读 P1-requirements.md：backend 域 BDD-1~34（44 BDD 全文），actor 映射 Alice=owner/Bob=成员/Carol=非成员
- [ ] 读 P2-design.md 相关节（§3 后端设计 / §11 实现完成标志 / files_to_read）
- [ ] 读现有测试参照（conftest/factories/test_entry_service/test_cli/test_database 等）
- [ ] 写 P3-test-cases-backend.md
- [ ] 新建 backend/tests/test_team_*.py（红灯）
- [x] 自跑确认红灯为 B 类
- [x] 读 P2-design.md 全文：§2 数据模型/迁移（teams/team_members/entries.team_id SET NULL、FK ondelete 显式）、§3 后端设计（D1-D5 + team_membership.py 薄模块 + can_read_entry + list_entries EXISTS + teams API 9 路由 + CLI/PeekClient + EXPLAIN）、§6 gate_commands、§7 files_to_read、§11 实现完成标志（新增 P3 缺口：全新库删 team/删 user FK 断言 + CLI 本地直建库两索引 + 旧库自愈迁移）
# P3-progress — test-designer（mcp 批，TPV0095）

## 2026-09-02 会话开始（trace: TPV0095-P3-test-designer-mcp-20260902）

- 已读：dispatch-context（P3-dispatch-context-test-designer-mcp.md）+ 角色定义（test-designer.md）+ P0-brief + P1-requirements（BDD-35~37 全貌）+ P2-design（§4 MCP 设计 + §6 gate_commands：P3_mcp = `make test-mcp-unit`）
- P1 BDD-35~37 摘录：BDD-35 = publish_files/create_entry 传 team_id 发布成功 + list_teams 两分区无参只读；BDD-36 = get_entry 对 team entry 响应含 team{slug,name}（成员）/非成员 404/全局 master key 200；BDD-37 = create_entry 与 publish_files description 含 "omitting team_id → default PUBLIC" 硬提示
- P2 §4 摘录：createEntry.ts/publishFiles.ts zod schema 加 `team_id: z.string().optional()`（slug 形态）；description 追加 TEAM VISIBILITY 块（两工具一致，含 list_teams 引导 + IMPORTANT 硬提示）；新增 listTeams.ts（无参只读）→ client.listTeams() → GET /api/v1/teams → {owned:[{slug,name,member_count}], joined:[...]}，注册进 tools/index.ts 的 common（local 与 remote 双模式都有）；get_entry 输出 base 加 `team: {slug,name}|null`
- 已读现有 MCP 测试参照：getEntry.test.ts / tools.test.ts / publishFiles.test.ts / server.test.ts / client.test.ts 的 msw mock server 模式；tests/setup.ts 隔离 HOME；vitest fileParallelism: false
- 已核实现状（红/绿判定依据）：
  1. `packages/mcp-server/src/tools/createEntry.ts` schema **无** team_id（zod 默认剥离未知键 → handler 不透传）
  2. `publishFiles.ts` schema **无** team_id（同上）
  3. **无** src/tools/listTeams.ts；tools/index.ts createTools 的 common **无** list_teams
  4. `client.ts` **无** listTeams() 方法；createEntry payload 无 team_id（类型层，运行时透传已可带任意键）
  5. `getEntry.ts` buildOutput 输出 **无** team 字段（GetEntryOutput 无 team）
  6. 两工具 description **无** TEAM VISIBILITY 引导块
- 现状结论：以上全部未实现 → 对应测试将红灯（断言失败 / 模块缺失 = B类真红灯）
- 关键运行器事实：package.json `test:unit` 是**显式文件清单**（vitest run <files...>），新测试文件必须注册进该清单才会被 `make test-mcp-unit` 执行 → 需要给 package.json 追加一行（测试基础设施登记，非实现代码）

## P3 test-designer(frontend) 分阶段落盘 2026-09-02 [PROD_NOT_TOUCHED]
- [x] 读 dispatch-context：frontend 域负责 BDD-38~44；产出 P3-test-cases-frontend.md + 组件 spec（vitest）+ e2e/team-visibility.spec.ts + e2e/teams-page.spec.ts（红灯）
- [x] 读角色定义 test-designer.md：BDD 1:1 映射、测试名引用 BDD 编号、自跑确认红灯（B 类）、vi.mock hoisting 反模式（只字符串字面量）
- [x] 读 P0-brief.md：前端改动清单（/teams 页 + explore Teams tab/chips/badge + 单一不可用态 + toggle 守卫 + 移动端 tab + a11y + detail 三态）
- [x] 读 P1-requirements.md：BDD-38~44（前端 UI 线 7 条）
- [x] 读 P2-design.md：§5.1-5.8 前端设计 + §5.7 data-testid 清单（tab-teams/team-chip-{slug}/team-unavailable/team-empty/teams-empty/badge-team/visibility-toggle/teams-owned/teams-joined/team-create-form/team-name-input/team-member-username-input/team-error/teams-status-live/user-menu-teams-item/teams-manage-link）+ §5.8 detail 三态锁定 BaseBadge team 变体 + §6 gate 键（P5_e2e_a/b 单 spec 跑）
- [x] 读现有前端测试参照：e2e/star.spec.ts（BASE_URL 防 :8080 + health + login alice/testpass123 约定）、e2e/entry-card-interaction.spec.ts（seed via request API + waitForContent）、t082-store-split.spec.ts、t031-entry-store.spec.ts（vi.mock 全字面量 + setActivePinia）、t031-entry-list-view.spec.ts（storeToRefs mock + stubs 模式）、T079-entry-detail-header.spec.ts（provide IsMobileKey/ZenModeKey + stubs）、BaseBadge.spec.ts
- [x] 实读代码核对现状：EntryListView 4 tab 无 Teams；BaseBadge status union 7 值无 team 无 label 参数；EntryCard/EntryListRow toggle 无 data-testid、badge v-else-if 走 isPublic ? public : private；entryList.ts toggleVisibility 无 teamId 守卫；searchUrl.logic parseRestoreQuery 无 team/view；EntryDetailHeader/EntryMetaTagsBar status-tag 按 isPublic 渲染 Private（team entry 会误显）；router.ts 无 /teams；无 stores/team.ts
- [x] 写 P3-test-cases-frontend.md
- [x] 写组件 spec（10 文件）+ e2e spec（2 文件）
- [x] 自跑确认红灯

## 2026-09-02 产出与红灯确认（续）

- 已写产出：
  1. `packages/mcp-server/tests/team-visibility.test.ts`（10 用例，BDD-35~37 映射）
  2. `agate-workspace/tasks/TPV0095-team-visibility/P3-test-cases-mcp.md`（BDD 映射表 + test_code_dir + 红灯确认 + [PROD_NOT_TOUCHED]）
  3. `packages/mcp-server/package.json`：test:unit 清单追加 `tests/team-visibility.test.ts`（测试基础设施登记）
- 自跑确认（`npx vitest run`）：10/10 红灯，全部 B 类（schema 无 team_id → body undefined；client.listTeams 不存在；list_teams 未注册；listTeams.ts 模块缺失；get_entry 无 team 字段；description 无 TEAM VISIBILITY 块）
- 既有回归：324 passed / 7 skipped / 25 passed files；唯一额外失败 = publishFiles.test.ts「默认白名单：拒绝 cwd/tmpdir 外文件」→ EROFS /var/tmp 只读（沙箱环境性，与 TPV0095 无关，未触碰）
- 状态：`[PROD_NOT_TOUCHED]` —— 未写实现、未碰生产

## P3 test-designer(frontend) 自跑结果 2026-09-02 [PROD_NOT_TOUCHED]
- [x] 组件 spec 10 文件全部 vitest run 自跑：24 failed | 13 passed（37），0 SyntaxError——红灯均为 B 类（被测未实现/缺模块），绿=现状行为基线（private/public 正例等）
  - search-url-team：缺 team/view 字段（6 断言）
  - base-badge-team：缺 'team' union + label prop
  - entry-card / entry-list-row team：缺 teamId badge 逻辑、badge-team 变体、visibility-toggle testid
  - entry-list-store-team：toggleVisibility 无 teamId 守卫（B 类）
  - team-store：@/stores/team 模块不存在 → import 失败（B 类，P4 建）
  - detail-visibility-tag：team entry 现误显 "Private"（三态断言红灯）
  - user-menu-teams：缺 Teams 项
  - filter-chip-team：dismiss aria-label 未参数化
  - entry-list-view-teams：4 tab 无 Teams / 缺不可用态/空态容器 / 缺 teams-manage-link / 缺 tablist+aria-selected
- [x] e2e 两 spec（team-visibility + teams-page）：esbuild 语法通过（结构正确）；P3 期页面未实现 → 运行失败属预期红灯，不声称跑绿
- [x] git status 确认：仅新增 10 组件 spec + 2 e2e spec + P3-test-cases-frontend.md（无实现改动）
- [x] 读现有测试参照：conftest（autouse isolate env tmp）、factories、test_migration（_create_entries_without_owner_id 旧库手法）、test_star_api/_archived_visibility/_star_visibility（client+register+admin 手法、7 路径端点）、test_share_create/_access（share token、_register/_auth 模式）、test_cli/_t080（isolated_fs、runner.invoke）、test_admin_user_api（delete/disable user）
- [x] 核对实现层：models Entry/User/CreateEntryRequest/EntryUpdate/EntryResponse/EntryRawResponse/Share 全无 team 字段；exceptions.ParameterValidationError(422) 已存在；entry_service create/get/list/update 签名与 archived 分支;share_service 403;star _build_star_item;api 路由形状（entries/files/shares/stars/admin）;database init_db/run_migrations/_setup_indexes;cli create/list/user 组/--user 先例;client PeekClient;main create_app init_db(run_migrations=True)
- [x] 实测 pydantic CreateEntryRequest extra=ignore（team_id 现被静默丢弃→create 201 public = 现 BDD-21 的泄露风险红灯基准）；EXPLAIN QUERY PLAN 探针（team filter 命中 idx_entries_team_id SEARCH；成员 EXISTS 走 team_members covering index、外层 entries SCAN 不可避免——断言以"team_members 无 SCAN + entries team 索引命中"为界）
- [ ] 写 P3-test-cases-backend.md
- [ ] 新建 backend/tests/test_team_*.py（红灯）
- [ ] 自跑确认红灯为 B 类
- [x] 读 test_share_lifecycle（revoked_shares 断言先例）、test_star_review_fixes（?starred=true list）
- [ ] 写 P3-test-cases-backend.md
- [ ] 新建 backend/tests/test_team_*.py（红灯）
- [ ] 自跑确认红灯为 B 类
- [x] 写 P3-test-cases-backend.md（BDD 1:1 映射 32 条 + 5 补强，42 用例；test_code_dir 声明；7 个测试文件清单）
- [ ] 新建 backend/tests/test_team_*.py（红灯）
- [ ] 自跑确认红灯为 B 类
- [x] 写 P3-test-cases-backend.md
- [x] 新建 helper (_team_helpers.py) + 6 测试文件（visibility/validation/teams_api/share_team/migration/owner_fail/cli_teams）
- [x] 新建 7 个 backend/tests/test_team_*.py + tests/_team_helpers.py（共用数据构造，无 fixture，避免 F811 遮蔽）
- [x] ruff lint 全绿（--fix 排序/清理未用 import；F811 已通过"每文件本地 fixture + helper 只放 factory"消除）
- [x] 自跑确认红灯：38 collected = 37 fail（B 类：ImportError Team/TeamMember、teams 路由 404/405、CLI --team NoSuchOption、旧库升级缺 teams 表/team_id 列、匿名 team_id 静默忽略 201、BDD-12 403→404 未收等）+ 1 pass（BDD-25 零变化回归基线，属预期绿灯）
- [x] 红灯类型确认：无 A 类（无语法错/断言与数据矛盾——抽样核对每个失败均指向未实现目标）
- [ ] 返回主 Agent（两行）
- [x] 终检：ruff 全绿；37 failed + 1 passed（BDD-25 零变化基线）= 38 collected；全部 B 类确认
- [x] 交付完成
