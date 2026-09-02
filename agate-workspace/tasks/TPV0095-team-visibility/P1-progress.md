# P1 Progress — TPV0095 team-visibility（analyst）

trace_id: TPV0095-P1-analyst-20260902
phase: P1
agent: analyst
[PROD_NOT_TOUCHED]

## 2026-09-02 读取记录

1. [x] dispatch-context（P1-dispatch-context-analyst.md）— 目标/约束/输入清单/客观查证信息已读
2. [x] analyst 角色文件（~/.agate/assets/execution-roles/analyst.md）— 方法论已载入
3. [x] P0-brief.md — 四字段齐全；core 逻辑 9 条 + 决策 A-F + 三端改动清单 + known_risks
4. [x] design-note team-visibility.md（v4 终版，494 行）— §2 用户故事 / §5.3 权限 7 处 / §12 风险 / §13 测试清单 11 项 已读
5. [x] docs/roadmap/improvement-backlog.md #48 — 上下文已读（🔄 TPV0095 P0 立项）

## P0-brief 时效性质疑

- 立项 2026-09-02（commit 5525c319），design-note v4 与 P0-brief 同日落地；executor_env（opencode/has_task_tool/has_local_runtime/network full）与当前 DSH 平台映射一致；版本声明 peekview 0.21.0 / mcp 0.11.0 需与 VERSIONS.json 核对。
- → 待 VERSIONS.json 核对后写结论行。

## 待办

- VERSIONS.json 版本核对
- 同类扫描（can_read 权限判定/可见性符号 grep 全仓）
- 隐含需求识别 + BDD 起草
- frontmatter 机器字段

## P0-brief 时效性结论

已核对 P0-brief 时效性，无漂移（立项 commit 5525c319 为 2026-09-02 当日；VERSIONS.json 实测 peekview 0.21.0 / mcp 0.11.0 与 brief 声明一致；executor_env 平台前提成立）。

## 同类扫描进行中（可见性/权限判定符号）

- 已确认：entry_service.py 中 `get_entry_by_api_key` **不存在**（design-note §5.3 存量 bug 属实，grep 0 命中）——调用点在 entries.py（待定位行号确认）
- 权限检查分散点确认存在：entry_service.get_entry(:326) / list_entries(:385) / get_entry_with_share(:1155) / get_entry_by_slug(:1215) / get_entry_files(:1220)；api/files.py _resolve_entry(:130) / resolve_entry_raw(:352) / get_entry_raw(:517)；api/entries.py _check_share_cookie(:37) / list_entries(:130) / get_entry(:184) / download_entry_files(:468)

- 已确认 7 处读路径分散权限检查（对照 design-note §5.3 表格全部属实）：
  1. entry_service.get_entry(:326) — is_public OR owner OR admin + archived 星标分支
  2. entry_service.list_entries(:385 Phase 3 :480-518) — is_public OR owner（登录）/ admin 全见
  3. files._resolve_entry(:130) — 非全局 key 走 get_entry；share cookie 兜底
  4. files.resolve_entry_raw(:352) — share 分支 :377 is_public OR owner/admin
  5. api/entries.py get_entry(:184) + _check_share_cookie(:37) — share cookie / share token
  6. entry_service.get_entry_with_share(:1155) — share 校验
  7. entries.download_entry_files(:468) — 同 get_entry + share cookie
- 存量 bug 确认：entries.py:478 `service.get_entry_by_api_key(slug)` 调不存在方法（entry_service.py grep 0 命中）——全局 master key /download 会 AttributeError
- share_service.create_share(:51) / list_shares(:129) 非 owner 非 admin → ForbiddenError(403)；public entry 不可建 share（ValidationError）
- star 可见性缺口确认：entry_service.py:491-497（starred_cond 无 team）+ star_service.py:365-368（_build_star_item 同缺）——两处与 design-note §5.6 一致

- 迁移机制已核对：init_db 顺序 = create_all（建新表）→ _run_migrations（ALTER 加列）→ _setup_indexes。若 Team/TeamMember 模型进 SQLModel.metadata，teams/team_members 表由 create_all 先建，再 ALTER entries 加 team_id——顺序天然满足"先建表后 ALTER"；check_schema 对存量表比对模型列，漏对齐 team_id → SchemaMismatchError。_run_migrations 内 teams/team_members CREATE TABLE IF NOT EXISTS fallback + 幂等模式与现状（entry_stars 先例）一致。
- share 三接口（api/shares.py）：create_share(:18)/list_shares(:37)/revoke_shares(:52) 均 Depends(require_auth)；service 层非 owner 非 admin → ForbiddenError(403)。revoke 同 :169。

- CLI：create(:216) 带 --visibility(:228)，is_public = visibility=="public"(:316)；list_entries(:434) 已有 --status/--tag/--query。teams/--team 待加。
- MCP：publishFiles.ts schema(:124) 有 is_public.optional()；createEntry.ts schema(:7) is_public.optional()；listEntries.ts schema(:6)；getEntry.ts schema(:16)。team_id 待加；list_teams 待新建。
- 前端：views/ 现有 Landing/EntryList/EntryDetail/ApiKeyList/NotFound/Settings/StarManage；/teams 为新路由。router.ts 现有 explore(EntryListView)/settings/users/:username/star 无 UI 入口（:27 /stars StarManageView 存在但无入口——design-note §8.1 避坑属实）/admin → NotFound。
- EntryListView.vue tab 现状：All/Mine/Archived/Starred（:20-39 四个 .owner-tab，starred data-testid="tab-starred"）；setFilter 三态(:350)；restoreFromURL/onBeforeRouteUpdate 多个恢复点。team 维度待并入。
- entryList store toggleVisibility(:45) 现状无 teamId 守卫；components EntryCard/EntryListRow 有 toggleVisibility emit。

- BaseBadge.vue：status union 7 值（public/private/shared/archived/expired/disabled/admin），label 无参数化（labelMap 仅 disabled/admin），CSS 变体需加 team（DESIGN.md 禁新 hex/emoji，用现有 token）。FilterChip.vue dismiss aria-label 硬编码 "Remove filter"（design-note §8.8 属实）。
- entryList store toggleVisibility(:45)：直接翻 isPublic 无 teamId 守卫（design-note §8.6 属实，需加守卫拒绝 team entry 调用）。
- EntryListView.vue 现有 4 tab（All/Mine/Archived/Starred）→ Teams 是第 5 tab。
- UserMenu.vue：Settings 单项（navigateToSettings）→ Teams 主入口加在此（与 Settings 同级）。
- models.py：Entry/EntryShare/EntryRead/User/ApiKey 现有表；CreateEntryRequest(:705) / EntryUpdate(:503) schema 需加 team_id。
- 客户端契约：BaseBadge status union + labelMap、Entry 类型、transformListItem/transformEntry、api client listEntries params——team 字段需贯通。

## 同类扫描结论要点（详细版进 P1-requirements.md 正文）

**读路径权限判定（本次处理核心，can_read_entry 收敛）——全仓 grep「权限可见性」命中：**
- backend/peekview/services/entry_service.py：get_entry(:326 非 archived 分支 :357-364 is_public/owner/admin + archived 分支 :343-355)、list_entries(Phase 3 :479-518)、get_entry_with_share(:1155-1168)、update_entry(:657-668 写路径 owner/admin 判定，收敛范围外但语义相关)、delete_entry(:839-846)
- backend/peekview/api/entries.py：get_entry(share 分支 :200-234)、_check_share_cookie(:37-67)、download_entry_files(:468-493)、unstar_entry(:442-464 回退 get_entry 可读性)、update_entry(:339-387)
- backend/peekview/api/files.py：_resolve_entry(:130-176)、resolve_entry_raw(share 分支 :377-393)、get_file_content(:234 _resolve_entry)、download_file(:189 _resolve_entry)、render_html_file(:315 _resolve_entry)、get_entry_raw(:516-524)
- backend/peekview/services/star_service.py：_build_star_item(:365-371 is_public OR own OR archived)
- backend/peekview/services/share_service.py：create_share(:51)/list_shares(:129)/revoke_shares(:169)——owner/admin 判定非 owner → ForbiddenError(403)

**判定：**
- get_entry/list_entries/_resolve_entry/resolve_entry_raw/entries.get_entry+_check_share_cookie/get_entry_with_share/download_entry_files = design-note §5.3 表格 7 处，本次统一走 can_read_entry
- star_service._build_star_item + entry_service.list_entries starred_cond = §5.6 star 缺口 2 处，本次加 team 项
- share_service 三接口 403 → 404（§5.4）
- update/delete/unstar/reads 等 owner 写路径：不进 can_read_entry（design-note 未列），本次只随迁移补 team 语义校验，不重构
- 前端 base-badge 可见性渲染组件 / EntryCard / EntryListRow / filter / tab = UI 层处理
- scripts/seed-data/python-entry-service/entry_service.py（样例数据镜像）与 backend/peekview/client.py（PeekClient create_entry/list_entries payload）——影响 CLI 远程模式与 seed 样例，标记为「需同步」而非权限重构

## P1-requirements.md 产出落盘

- 已 Write 产出 P1-requirements.md（正文完整：质疑结论 / 需求复述 / 隐含需求逐维度 / BDD-1~34 / 裁剪 / 同类扫描 A-E / NO_NEED_CONFIRM / capability yaml 块）
- frontmatter 机器字段已填：risk_level=high, phases=[P1..P8], packages=[backend/peekview, frontend-v3, packages/mcp-server], domains=[backend, frontend, mcp, security]（agate-md-field-set 写入）；ceremony=standard, ui_render_shape=layout, ui_ux_dimensions=[布局结构, 交互行为]（edit 补充）
- capability_requirements 正文 YAML 块含 browser-vision（need 含 vision，status=available）+ multi-user + migration + MCP 四项
- 自检中：check-frontmatter.py + BDD 编号连续性 + UX 类别 BDD 标题

## 自检结果（全部通过）

- check-frontmatter.py exit=0
- BDD 编号连续性：BDD-1 ~ BDD-35 连续无跳号（16a 已重排并入 17，正文全部引用同步）
- frontmatter 机器字段齐全：risk_level=high / phases=[P1..P8] / packages=[backend/peekview, frontend-v3, packages/mcp-server] / domains=[backend, frontend, mcp, security] / ceremony=standard / ui_render_shape=layout / ui_ux_dimensions=[布局结构, 交互行为]
- capability_requirements 正文 YAML 块含 browser-vision（need 含 vision，status=available）+ multi-user + migration + MCP 四项（均 available）
- gate 单测：_gate_p1_vision_capability PASS / _gate_p1_ui_shape PASS
- UX 类别 BDD：BDD-30/31/35（布局结构）+ BDD-32/33/34（交互行为）标题带类别后缀，判据可量化
- 同类扫描：A 表（9 行读路径收敛）+ B 表（2 处 star）+ C 表（3 处 share + 1 保留）+ D 表（7 处前端）+ E 表（6 项不处理）均落盘正文
- [NO_NEED_CONFIRM]（无未决）；1 条 [SUGGEST:]（版本 bump，不阻塞）
- P0-brief 时效性已核对无漂移（记录在文件头）
- [PROD_NOT_TOUCHED]（全程只读代码分析 + progress/产出落盘，未触碰 :8080 / ~/.peekview/ / pipx）

## 完成

P1-requirements.md 产出完成（35 BDD / domains=[backend,frontend,mcp,security] / NO_NEED_CONFIRM）

## rev1 修订轮（analyst，P1-review F1-F8）

- 已读 rev1 dispatch-context（F1-F5 阻塞 + F6-F8 建议）、P1-review.md §三、P1-requirements.md（35 BDD 首版）、design-note v4 相关节（§3.5/§5.1/§5.2/§8.1/§13）、P0-brief、首轮 dispatch-context。
- 修订计划：BDD 7→7+8（F1 拆详情读权/管理操作权）；20→24+25（F2 拆竞态）；23→29+30+31（F3 拆三路径 + update 目标 team 口径定「当前用户是成员」，与 create 一致）；F4 新增 CLI 远程 PeekClient 透传 BDD-35；F5 新增 owner 禁用→冻结读权/管理、owner 删除→CASCADE（§3.5 19/20/21）+ EXPLAIN（§3.8 27）；F6 BDD-17→18 actor 澄清；F7 BDD-22→28 标题改 create-only；F8 BDD-34→43 三文案互异 + 入口 DOM 断言。总条数 35 → 44。
- [PROD_NOT_TOUCHED]

## rev1 修订完成（自检全绿）

- F1-F8 全部落实：F1 BDD-7→7/8；F2 BDD-20→23/24；F3 BDD-23→28/29/30 + update 目标 team 口径定为「当前用户是成员」（§1.9/§2.5/BDD-29/30 显式统一，与 create 同口径）；F4 新增 BDD-34（CLI 远程 PeekClient 透传）；F5 新增 BDD-19（owner 禁用→冻结）/BDD-20（owner 删除→CASCADE）/BDD-26（EXPLAIN 索引命中无逐行子查询）；F6 BDD-17→18 actor 预期澄清；F7 BDD-22→27 标题改 create-only；F8 BDD-34→42 三文案互异 + UserMenu/Teams tab 双入口 DOM 断言。
- 编号重排：35 → 43 条连续（BDD-1~43 无跳号，awk 校验通过）；§3 分组行 / §0 / §1 / §2 / §5 表 / §6 / §8 全部 BDD 引用已同步。
- 每条 BDD 单一 G-W-T（awk 逐块校验通过）；UX 类别后缀保留（BDD-38~43，ui_ux_dimensions 未变）。
- frontmatter 经 agate-md-field-set 重写（risk_level=high / phases P1..P8 / packages 三包 / domains 四域，与首轮一致），check-frontmatter.py exit=0。
- [PROD_NOT_TOUCHED]（全程只改 P1-requirements.md + progress 追加）
