---
phase: P2
task_id: TPV0095
type: review-progress
parent: P2-design.md
trace_id: TPV0095-P2-plan-eng-review-20260902
status: in-progress
agent: plan-eng-review
---

# P2-review-progress — plan-eng-review（TPV0095 team-visibility）

## 2026-09-02 评审过程记录

### Step 1: dispatch-context 已读
- 评审重点 8 项已明确（迁移 / 权限收敛 7 路径 / 校验契约 / 候选 A 免环 / EXPLAIN / 防枚举 404 / 全局 key / CLI + gate_commands）
- 上游关联：候选 A 选定，3 SCOPE+（detail 标签 → BDD-44 采纳 / raw team 字段 → 实现约束 / restore merge → backlog）
- 输入文件清单：P2-design.md / P1-requirements.md / docs/design-notes/team-visibility.md / plan-eng-review.md 角色

### Step 2: 角色定义 + P0-brief 已读
- 评审重点、输出结构（BLOCKER/非阻塞/测试缺口/锁定决策）、产出规格明确
- P0-brief 关键约束：迁移顺序、7 路径权限收敛、防枚举 404、校验 422、MCP 语义

### Step 3: 输入文件阅读进度
- [x] P0-brief.md
- [x] P1-requirements.md（43+1 BDD，已读全文）
  - 重点锚点记录：BDD-2/5（7 路径矩阵）、BDD-7/8（teams API 权限）、BDD-9/10（防枚举）、BDD-11/12/13（share）、BDD-14/15（star）、BDD-16/17（迁移幂等）、BDD-19/20（owner 失效）、BDD-21/22/27/30（校验契约）、BDD-23/24（竞态）、BDD-26（EXPLAIN）、BDD-31~34（CLI）、BDD-35~37（MCP）
  - 同类扫描 A1-A9 / B1-B2 / C1-C4 / D1-D7 / E1-E6 表已确认（评审基准）
### Step 4: P2-design.md 已通读（508 行）
初步观察（待代码核验）：
- frontmatter 四字段齐全、candidate_count=2、ui_affected=true + UI 设计节存在（渲染形态 layout 与 P1 一致）、dispatch_plan 存在
- 待核验点：
  1) check_schema 与 _run_migrations 的调用时序（BDD-17 旧库升级前提）
  2) ValidationError 状态码映射 vs BDD-21/22/30 要求 422（§3.1 D2 说抛 ValidationError，files_to_read 提示 ValidationError=400 / ParameterValidationError=422——实现口径未锁）
  3) team_membership 助手落点三处表述不一致（§0.1 表=entry_service 顶部模块级；§1 候选 A=entry_service 模块级；§3.2 line 205「本设计锁」=独立 team_membership.py；§7 files_to_read 列 team_membership.py）——需确认锁定的最终形态
  4) gate_commands P3/P5/P6 用 `&&` 链两条 make 命令（短路掩盖风险）+ P5 缺 make test-frontend（P3 组件测试无处跑）+ P6_e2e 只覆盖 team-visibility.spec.ts、teams-page.spec.ts 未入 gate 命令
  5) BDD-31/32/33 CLI 示例未带 --user，设计 §3.4 要求本地 --team 命令 --user 必填——需对账
  6) §2 line 169「见 §4.4 核对」——本文无 §4.4 节（节号漂移），admin delete_user 行为待代码核验
  7) can_read_entry 签名（entry, user_id, is_admin, is_team_member 由调用方解析）vs 7 路径逐条 delegate 关系
- [ ] docs/design-notes/team-visibility.md（语义权威源）
- [ ] 代码核验（database.py 时序 / exceptions.py / entry_service / admin delete_user / Makefile / MCP index）

### Step 4: plan-design-review（本文件追加段）2026-09-02
评审角色：plan-design-review（frontend/UI 方案），与 plan-eng-review 共用本 progress 文件（前文 agent 字段为 eng 的历史段，现由 design 追加；Header 保持 plan-eng-review 原值不动——design 的独立过程以本节为准）。

已读：
- [x] P0-brief.md / P1-requirements.md（43+1 BDD，BDD-44 为 [SCOPE+] 增补）/ P2-design.md（全文，含 §5 前端 + UI 设计节）/ docs/design-notes/team-visibility.md v4（§8 前端权威源）
- [x] 项目约定：AGENTS.md/CLAUDE.md（只读评审 + [PROD_NOT_TOUCHED]）
- [x] 前端实读核对（评审重点逐项对码）：
  - EntryListView.vue：4 tab 现状（无 Teams）、All 激活条件 `!currentOwner && !currentStatus && !currentStarred`（缺 !currentTeam）、setFilter(owner,status,starred) 单入口、restoreFromURL / onBeforeRouteUpdate / watch(authState) 三处恢复逻辑确有漂移、logout 焦点归还 querySelector('.owner-tab')、loadEntries ~9 调用点
  - BaseBadge.vue：status union 7 值无 team、label 硬编码 labelMap（status 词直出）、禁 emoji 已符合
  - EntryCard.vue:96-98 / EntryListRow.vue:82-84 badge + toggle 按钮 :7-11/:88-95 实存；card toggle 与 row toggle 共用 store.toggleVisibility（:45-73 无 teamId 守卫）
  - FilterChip.vue:4 dismiss aria-label 硬编码 "Remove filter" 实存
  - UserMenu.vue:10 Settings 项 data-testid="user-menu-settings-item" 先例 → Teams 项仿照可行
  - router.ts：无 /teams；/stars 路由无 UI 入口（反模式属实）
  - EntryDetailHeader.vue:68 + EntryMetaTagsBar.vue:7 按 isPublic 渲染 Public/Private（BDD-44 缺口属实）；mobile bar 无 visibility 标签
  - useEntryDetailActions.ts:72-79 溢出菜单含 Make Private/Public（owner），走 entryListStore.toggleVisibility
  - entryList.ts store：无 teams 状态；toggleVisibility 为唯一翻 is_public 入口
  - searchUrl.logic.ts：mergeQuery/parseRestoreQuery 需扩展 team/view（现无）
  - DESIGN.md:200-201 Tabs 规则确需修订（现 "desktop 横排 / mobile 堆叠"）
  - SettingsView mobile-stacked 参照属实；ConfirmDialog alertdialog 复用属实；EmptyState 支持 CTA
  - e2e 现有 star.spec.ts 用 data-testid="tab-starred"；Makefile debug-test → run-e2e-tests.sh：`E2E_SPEC` 单 spec 传参，无逗号多 spec 支持（与 P2 §6 断言一致）
  - playwright projects：chromium + Mobile Chrome (Pixel 5) 实存 → P6 桌面/移动两档截图有项目支撑

进度：评审进行中，下一步产出 P2-review-design.md。

### Step 5: 产出 P2-review-design.md 完成 2026-09-02
- 产出文件：P2-review-design.md（Header status: needs-revision）
- 结论：无 BLOCKER；修订项 N1（P6「人工复核」落为断言动作）/ N2（data-testid 清单 + /teams 新建表单组件规格 + toggle 隐藏边界 + detail 三态载体二选一 + myTeams store 动作清单）/ N3（空态三态文案表 + list badge 声明）
- 环境隔离：[PROD_NOT_TOUCHED]

### Step 6: plan-eng-review 代码核验结论（2026-09-02，eng 评审追加段）
> 说明：本文件由 plan-design-review 追加了前端评审段；以下为 eng 评审（本 agent）的独立代码核验结论，与设计段内容不冲突。

**客观证据（实读代码）：**
- init_db 顺序 confirmed：create_all(:302) → _run_migrations(:306) → _setup_indexes(:309)（database.py 实读）；_run_migrations 只在 run_migrations=True 时跑（server startup main.py:200 + cli serve:181）；**cli 其余 10 处 init_db 无 run_migrations**（clapikey/user/teams 等本地命令走 check_schema 只查不迁）
- exceptions.py 实读：ValidationError.status_code=400 / ParameterValidationError.status_code=422 → **§3.1 D2「抛 ValidationError」=400 非 422，与 BDD-21/22/30 要求冲突（发现 #1）**；422 先例 = api/entries.py:145
- get_entry archived 分支(:343-355) 星标语义保留、非 archived(:357-364) = is_public OR admin OR owner——与设计 A1 一致
- list_entries Phase 3(:479-518) / starred_cond(:491-497) 与设计一致；sqlalchemy exists() 已 import
- star_service 不 import entry_service（只 import models/exceptions）→ §3.2 免环分析成立；_build_star_item(:365-371) 可见性 = is_public OR owner OR archived 属实
- share_service create/list/revoke 三处 ForbiddenError(:51/:129/:169)；revoke_all_for_entry(session=) 存在
- **存量 bug confirmed**：get_entry_by_api_key 全仓仅 entries.py:478 调用、entry_service 无此方法
- download_entry_files(:468-494)：global_key_auth → get_entry_by_api_key；否则 get_entry + _check_share_cookie
- _resolve_entry(files.py:130)：非全局 key → get_entry + share cookie 兜底；全局 key → get_entry_by_slug——delegate 属实
- resolve_entry_raw(:352)：share 分支/非 share 分支均经 get_entry/_check_share_cookie；**全局 key 直读 get_entry_by_slug 返回 Entry row**；raw = EntryRawResponse（无 team 字段）→ SCOPE+2 raw team 需新增可选字段（设计判断 confirmed）
- entries.py get_entry share 分支(:200-234)：is_public 或 owner/admin 走 get_entry，否则 get_entry_with_share/_check_share_cookie
- update_entry(:631-800)：`was_private = not entry.is_public`；撤销 = `is_public is True and was_private`——**现状不含 was_team**（设计 D4 扩展属实）
- delete_user(admin_service:510)：先逐条 delete_entry → 删 api_keys → 删 user（CASCADE）——设计 §2 描述可接受（ORM 层先删，DB CASCADE 兜底）
- Entry model files Relationship cascade all,delete-orphan；owner FK ondelete=CASCADE——download entry.files 是已加载关系（get_entry_by_api_key 需注意 session 生命周期）
- cli `_get_backend`(:43) 本地返回裸 EntryService；apikey_create --user(1920) "required in local mode" 先例 + _resolve_user_local(:2077, init_db 无 run_migrations + check_schema) → **CLI 本地旧库迁移缺口 confirmed（发现 #2 BLOCKER）**
- cli create/list 现状无 --team/--user/current_user_id 传参（create body :326 owner_id=NULL）；user_cmd group(:1482) 无 --user 选项
- e2e specs 在 frontend-v3/e2e/；debug-test → run-e2e-tests.sh 读 E2E_SPEC（单 spec，相对 frontend-v3）；E2E 超时默认 600s（:82）——P2 §6 的两条 spec 命令语义正确
- MCP tools/index.ts：common = getEntry/listEntries/deleteEntry + createEntry(local/remote) → list_teams 入 common 双模式都有（设计判断 confirmed）
- EntryDetailHeader.vue:68 / EntryMetaTagsBar.vue:7 按 isPublic 渲染 Public/Private（BDD-44 属实）
- Makefile lint 用 ruff（PATH 需 backend/.venv/bin）；typecheck vue-tsc；test-frontend vitest run——gate 引用 Makefile target 属实

### Step 7: P2-review-eng.md 产出 2026-09-02
- 产出文件：P2-review-eng.md
- 结论：1 BLOCKER（CLI 本地迁移）+ 7 修订项 → **status: needs-revision**（角色定义门槛为 approved/rejected；needs-revision 由派发上下文明示可选值）
- 环境隔离：[PROD_NOT_TOUCHED]

### Step 8: plan-design-review 复审 rev1（2026-09-02，本段由 rev1 评审追加）
- 已读：rev1 dispatch-context / 上轮 P2-review-design.md（N1-N3 + 4 非阻塞建议）/ 修订后 P2-design.md（全文 574 行，重点 §5.1-5.8 + UI 设计节 + §5.7 清单）/ P1-requirements.md（BDD-38~44 frontmatter ui_render_shape=layout 与 P2 一致）/ P2-review-progress.md（含上轮两评审段）
- 逐 N 核对结论：
  - N1 落实：UI 设计节交互 checklist :359「输入态规格已设计（非"待人工复核"散文）」+ :361「P6 复核落为明确自动化动作（teams-page.spec.ts 逐态 Playwright 断言+截图）」——散文"人工复核"不再作完成项
  - N2 落实：§5.7 集中 testid 清单（5 tab/team-chip-{slug}/team-unavailable+clear/teams-empty/team-empty/badge-team/visibility-toggle/teams-owned/teams-joined/team-create-form/team-name-input/team-member-username-input/team-error/teams-status-live/双入口/ConfirmDialog）全覆盖；§5.3 toggle 隐藏边界（delete 保留）;§5.8 detail 三态载体二选一锁定 BaseBadge;§5.5 新建表单输入/输出逐态规格;§5.5 myTeams store 动作清单 ①-⑤
  - N3 落实：§5.2 三态文案归属表（暂无团队内容/该团队暂无内容/团队不可用 + testid + 是否调接口）;§5.2 badge 渲染声明（非 owner 不显示任何可见性 badge）
  - 非阻塞建议全采纳：§5.1 高亮范围声明 / §5.2 判定依赖 myTeams settle / §5.6 锁定 tablist+方向键 / §6 E2E spec 拆分 a/b 两键
- 无新引入问题（唯一观察：team-error 新建/成员表单共用，多为非同时呈现，归非阻塞建议）
- 结论：Status: approved

### Step 8: plan-eng-review 复审 rev1（2026-09-02，覆盖上轮评审后复核）
- [x] 读 rev1 dispatch-context（复审核对清单 R1-R4/N1-N4 + 核心架构 + 无新引入问题）
- [x] 读上轮 P2-review-eng.md（R1-R4/N1-N4 全文）
- [x] 读修订后 P2-design.md（574 行全文）
- [x] 读 P1-requirements.md BDD-31/32/33 [BASELINE_CHANGE: P2 R4 批准 2026-09-02]（行 288/293/298）——与 §3.4 CLI 示例锚一致
- [x] 代码复核（防行号漂移）：cli.py init_db 13 处（:78/:181/:1532-2115）、check_schema 13 处、exceptions.py ValidationError=400(:41)/ParameterValidationError=422(:233)、database.py init_db 顺序 create_all(:302)→_run_migrations(:306 幂等列检测+IF NOT EXISTS)→_setup_indexes(:309)、check_schema(:229 只比对既有表)、ruff 在 backend/.venv/bin（make lint 需 PATH）

**逐 R/N 核对结论**：
- R1 ✓ §3.4「CLI 本地 DB 迁移路径（R1 锁定）」：_get_backend(:78)/_resolve_user_local(:2079) 改 run_migrations=True（方案 1 推荐项），§0.1 A 表 + §7 files_to_read cli.py 行 + §11 #6 + §3.4 P3 缺口（直建库两索引 + 旧库 teams 自愈）均已同步 → 落实
- R2 ✓ §3.1 D2 显式锁 ParameterValidationError(422)（ValidationError=400 不用于此）；§0.1 B 行、§7 exceptions.py 注解、§11 #4 一致 → 落实
- R3 ✓ §6 拆键无 &&：P3/P3_frontend/P3_mcp、P5/P5_frontend/P5_mcp/P5_typecheck/P5_lint、P6 同法 + P5/P6_e2e_a/b 两 spec 分键 + timeout_seconds → 落实
- R4 ✓ P1 BDD-31~33 [BASELINE_CHANGE] 批准写入；§3.4 示例与 BDD When 一致（--user alice）；参照对象 = apikey create cli.py:1920（非 user_cmd）；不带 --team create 保持 owner_id=NULL → 落实
- N1 ✓ §2 line 169 模型层 FK ondelete 显式化（三字段 + 理由 + P3 全新库 FK 断言缺口）→ 落实
- N2 ✓ §3.2 落点锁定一处权威；§0.1 B/§1 候选 A/§7 全部改指独立 team_membership.py（grep 确认仅 lock 行引旧表述作「不再出现」引用）→ 落实
- N3 ✓ §4.4 引用消失（grep 零命中）→ 落实
- N4 ✓ §0.1 B 表新行（files.py + EntryRawResponse 可选 team，仅 owner/成员/全局 key）→ 落实
- 核心架构：迁移顺序 / 7 路径收敛表(A1-A7) / 免环 / EXPLAIN(BDD-26) / 防枚举 404 —— 均未被修订破坏（§2/§3.2/§3.5 实读）
- 上轮测试缺口（BDD-26 CLI 库 / BDD-31~33 矩阵 / 双源 FK / 422 状态码 / teams-page.spec 入 gate）—— 已由 §3.4 P3 缺口、§11 #1/#4/#6、§6 P6_e2e_b 闭合

**残余非阻塞观察（不阻断 P4，记入评审）**：
1. R1 修复范围 = _get_backend/_resolve_user_local（及经 _get_backend 路由的 create/list/user/apikey/admin 命令），user_cmd 族本地直连（:1532-1677）与 _get_apikey_service_local(:2091)/_get_admin_service(:2115) 仍在旧库上裸 init_db+check_schema → 旧库升级后先跑这些命令仍 SchemaMismatchError（须先 serve 或 teams/--team 命令）。与 R1 推荐范围一致（方案 1 原文即限定 team 相关路径），建议 §3.4 补一行范围声明，非阻塞
2. §3.4「本地 create/list/teams 加 --user 本地必填」字面过宽——按后文「--user 仅在本任务 team 相关命令上启用 + 不带 --team create 保持现状 + BDD-33 默认 list 不变」，必填语义应读作 team 相关命令才触发；建议 P4 前在 §3.4 消歧一句（P1 BDD 锚已按此口径），非阻塞
3. §3.3 路由表列 8 行 vs §11 #3「9 路由」计数不一致（疑缺算某成员端点），建议统一为 8 或补第 9 行说明，非阻塞

**产出**：P2-review-eng.md 覆盖写完成，Header status: approved
- 环境隔离：[PROD_NOT_TOUCHED]
