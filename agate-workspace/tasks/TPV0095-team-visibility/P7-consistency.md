---
phase: P7
task_id: TPV0095
type: consistency
parent: P2-design.md
trace_id: TPV0095-P7-consistency-20260902
status: approved
created: 2026-09-03
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 8
design_gap_reviewed_count: 8
---

# P7 一致性审查报告 — TPV0095 team-visibility

> 审查范围：P1-requirements.md ↔ P2-design.md ↔ P3-test-cases.md ↔ P4-implementation.md ↔ P5-test-results/ ↔ P6-acceptance.md ↔ P6.5-judge-verdict.md 全链交叉核对。
> 审查方式：批判第三方视角双向检查（文档 ↔ 文档；文档 ↔ 代码落点抽验）。只读检查，未修改任何源文件。
> 状态标记：`[PROD_NOT_TOUCHED]`（全程只读任务目录文件 + git 跟踪代码路径 grep 抽验；未触碰生产 :8080 / ~/.peekview/ / pipx peekview / VERSIONS.json）。
> SCOPE 基线计数：P1 共 44 条 BDD（`#### BDD-NN:` 实测 44，BDD-1~44 连续）+ 3 条 `[SCOPE_RESOLVED]`（P1:478/479/480）+ 1 条 `[SCOPE+ from P2]`（BDD-44，P1:359）。

## 0. 结论摘要

- BLOCKER：0（无任何产出文件含 `[BLOCKER]` / `[DEVIATION-CRITICAL]` 行首标记）
- DESIGN_GAP 配对：P4 声明 8 条 → P7 转抄 8 条 + `[DESIGN_GAP_REVIEWED]` 配对 8 条（全部 已确认，无打回 P2）
- SCOPE+ 闭环：3 `[SCOPE_RESOLVED]` + BDD-44 `[BASELINE_CHANGE]` 增补全部确认纳入基线
- 跨文件一致性：packages / BDD 数量 / 实现路径三向核对一致，无偏离

## 1. DESIGN_GAP 配对（强制项，P4 §标注 → 转抄 + REVIEWED）

来源核对：P4-implementation.md 行首 `[DESIGN_GAP:` 实测 **8 条**（frontend 5：:104/:106/:108/:110/:112；backend 3：:200/:202/:204），与 dispatch-context 声明（frontend 5 + backend 3）及 P4-progress.md 记录（backend 3 + frontend 5）一致。mcp 批与 retry 批均为散文「无 [DESIGN_GAP]」声明（P4:51/:253/:341），非声明条目，不计入。

### 1.1 frontend DESIGN_GAP-1 — detail 三态标签载体（P4-implementation.md:104）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: P2 §5.8 指定 detail 状态标签载体=BaseBadge（复用 team 变体），但 P3 spec（tpv0095-detail-visibility-tag.spec.ts）find('.status-tag') 断言，BaseBadge 渲染 .base-badge.badge-team 无法满足 → 实现保留 .status-tag 载体实现三态（team 态 class='status-tag team'，色板同 .badge-team token），P7 交叉核对。]`

- [DESIGN_GAP_REVIEWED: 已确认 — 载体偏离属实（P2§5.8 锁定 BaseBadge 载体「不就地扩展 span.status-tag」vs P3 spec 断 `.status-tag`）；但 P3 spec 是已批准红灯基线、不可改（P4-dispatch-context 约束「P3 测试不改」），且视觉意图（detail 与卡片 badge 同 token 同色）经 `.status-tag.team` 复用 `.badge-team` 色板 token 不破；P4-review-design §1.5 已判定合理 + P6 BDD-44 PASS（CDP .status-tag 三态文案 + vision 三截图）实证。无需回 P2。]

### 1.2 frontend DESIGN_GAP-2 — UserMenu Teams 按钮 v-show 常驻（P4-implementation.md:106）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: P3 spec（tpv0095-user-menu-teams.spec.ts）trigger 后未 await 即断言 Teams 项存在，Vue v-if 渲染异步 → Teams 按钮 always-mounted（v-show），class 用 .menu-item-teams 规避既有 UserMenu.spec 对 .dropdown-item 精确 2 项断言；菜单跨容器布局，dropdown 用 calc 偏移对齐——P6 视觉复核。]`

- [DESIGN_GAP_REVIEWED: 已确认 — v-show 常驻是为满足 P3 spec 未 await 即断言（v-if 首帧异步不满足）的测试约束驱动决策；功能可达（P6 BDD-42 E2E spec b 14/14 + CDP UserMenu Teams 项 → /teams）；已知布局代价（跨容器 calc 偏移）已由 P4-review-design 列为 S2 建议项（技术债，非 BLOCKER），P6 视觉复核完成无 blocker（vision bdd-42.yaml blocker_count=0）。无需回 P2。]

### 1.3 frontend DESIGN_GAP-3 — UserMenu Teams 项非 .dropdown-item class（P4-implementation.md:108）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: UserMenu 既有 spec 锁 .dropdown-item 精确 [Settings, Logout]，BDD-42 又要 Teams 入菜单 → 测试约束驱动的 DOM 布局决策（非 .dropdown-item class）。]`

- [DESIGN_GAP_REVIEWED: 已确认 — 既有 UserMenu.spec 锁 `.dropdown-item` 精确 2 项 [Settings, Logout]（含 e2e 末项 Logout 断言），复用 .dropdown-item class 会破坏既有基线；改独立 class `.menu-item-teams` + data-testid 是零回归最小方案；P4-review-design §1.9 GAP-3 判定合理（连带布局 hack 记 S2 债）；P6 BDD-42 PASS（双入口 DOM 可达）。无需回 P2。]

### 1.4 frontend DESIGN_GAP-4 — searchUrl team/view 用 undefined 表达缺失（P4-implementation.md:110）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: searchUrl.logic 既有 spec toEqual 精确对象（无 team/view 键）vs 新 spec 要键存在 → 用 undefined（非 null）表达缺失：toEqual 忽略 undefined 属性（旧 spec 兼容）+ toHaveProperty/spread 感知键（新 spec 兼容），无需拆函数。]`

- [DESIGN_GAP_REVIEWED: 已确认 — 两 spec 对 parseRestoreQuery 返回值的键集约束互斥（旧 spec toEqual 精确无 team/view 键；新 spec 要求键存在），用 undefined 而非 null 表达缺失使 Jest toEqual 忽略 undefined 属性 → 零回归且新 spec 感知键，是双兼容最小解（P4-progress.md 记录过拆函数与加 null 两条被否路径）；P4-review-design §1.9 GAP-4 判定合理；P6 BDD-38/41 URL 恢复断言 PASS。无需回 P2。]

### 1.5 frontend DESIGN_GAP-5 — URL 恢复提前到 setup 期同步（P4-implementation.md:112）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: EntryListView 不可用态需 setup 期同步判定（P3 spec mount 未 await 即断言）→ URL 恢复从 onMounted 提前到 script setup 同步 applyUrlToState()（与 §5.4 单一 restore 精神一致、时机不同）。]`

- [DESIGN_GAP_REVIEWED: 已确认 — P3 spec mount 后未 await 即断言不可用态 → 判定须在首帧同步完成，从 onMounted 提前到 script setup 执行 `applyUrlToState()` 属时机提前而非逻辑分叉；与 P2§5.4「三处恢复收敛为单一 restore 函数」精神一致（仍为单一入口，仅执行时机前移）；P4-review-design §1.9 GAP-5 判定合理；P6 BDD-41 PASS（团队不可用态 + 清除 CTA + URL 恢复）。无需回 P2。]

### 1.6 backend DESIGN_GAP-6 — share 判别：登录非成员 + 合法 share token（P4-implementation.md:200）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: P2 §3.2 A4/A5 的 share 判别未显式定义「登录非成员 + 合法 share token」行为；BDD-2（carol 登录 + owner 合法 token → 404）与 BDD-11/13（匿名 + token → 200）冲突。实现取判别 = 登录用户若非 owner/admin/team 成员且 entry 属 team → share 分支直接 404（share 只服务匿名外部访问者），匿名 token 访问者不受限。]`

- [DESIGN_GAP_REVIEWED: 已确认 — P2§3.2 A4/A5 共享契约只锁「share 访问者响应不含 team 字段」，未覆盖「登录非特权用户 + 合法 token」的判别分支，属 P2 规格空白而非矛盾；BDD-2 要求 carol 登录 + 合法 token 也 404（防枚举），BDD-11/13 只约束匿名外部访问者 200 —— 实现判别（登录非 owner/admin/成员 + team entry → 404；匿名不受限）是两族 BDD 的唯一自洽解；该判别经 P4-review-eng BLOCKER-1 打回后由 retry1-B1 扩展覆盖 cookie 全 4 通道、retry2 R1 补齐 owner 项，终审 approved；P6 BDD-2/23 PASS（7 路径 + 成员移除即时 404）实证。无需回 P2。]

### 1.7 backend DESIGN_GAP-7 — 全局 key 请求时配置精确比对（P4-implementation.md:202）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: BDD-36 全局 key 测试在 create_app 后运行时 mutate config.server.api_key 并发送裸 Authorization 头；现状 _is_global_api_key_auth 是「形似非 pv_」启发式且不比对配置。实现升级为请求时配置精确比对 + 裸 Authorization 兼容 + header 覆盖 cookie。]`

- [DESIGN_GAP_REVIEWED: 已确认 — BDD-36 断言（成员/非成员/全局 key 三身份 get_entry）要求运行时 mutate 后的配置精确比对 + 裸 Authorization 头生效，现状「形似非 pv_」启发式无法满足，属测试契约驱动的必要升级；改动面在身份解析层 `_shared._is_global_api_key_auth`（P1 E4 曾声明「语义不变」——此处修正为「行为等价 + 判定精确化」，不破坏既有 pv_/JWT 分支，header > cookie 优先级与现状 auth 三层一致）；P4-review-eng 认可 + P6 BDD-36 PASS（MCP 2/2 + TestBdd36RawTeam：成员/全局 key raw 200、carol 404）实证。无需回 P2。]

### 1.8 backend DESIGN_GAP-8 — 空文件 entry download 改空 zip 200（P4-implementation.md:204）

> P4 原始行（逐字转抄）：
> `[DESIGN_GAP: 空文件 entry 的 download 现状返回 NO_FILES 404；BDD-5 成员 fileless team entry 期望 download 200。实现去 NO_FILES 分支改空 zip 200（无 legacy 断言依赖 NO_FILES）。]`

- [DESIGN_GAP_REVIEWED: 已确认 — BDD-5 的 7 读路径矩阵含 download，成员对 fileless team entry 期望 200；现状 NO_FILES 404 与矩阵契约冲突，属 P1 未显式声明的既有行为修订；改动为去 NO_FILES 404 → 空 zip 200，影响面收窄（仅 fileless entry download）；P4-review-eng 认可 + 全量回归（P5 1164 passed、P6 BDD-5 PASS）证实无 legacy 断言依赖 NO_FILES 语义。无需回 P2。]

**配对结果：8/8 全部 `[DESIGN_GAP_REVIEWED: 已确认]`，无打回 P2。** 判定共同依据：① 每条均为 P1/P2 规格空白或测试约束驱动的真实偏差（非臆造）；② 均有 P4-review-design / P4-review-eng 评审节点先行背书；③ 最终语义均被 P6 逐条 PASS（backend pytest + MCP vitest + frontend E2E/CDP/vision）实证；④ 未破坏任何 P1 BDD 断言或 P2 设计意图（载体/落点/防枚举/权限收敛语义均保持）。

## 2. SCOPE+ 闭环（P1 §8 备注 + BDD-44 增补）

| SCOPE+ 条目 | 来源 | P1 闭环标记 | 状态 |
|---|---|---|---|
| MCP get_entry team 字段需 /raw 响应补 team | P2 §12 SCOPE+2 | P1:478 `[SCOPE_RESOLVED]`（files.py resolve_entry_raw + models.EntryRawResponse 加可选 team） | [OK] 已纳入 P2 §0.1 B 表 + §4；P6 BDD-36 PASS |
| CLI 本地 create/list owner 语义（--user 归属） | P2 §12 SCOPE+4 | P1:479 `[SCOPE_RESOLVED]`（--user 仅 team 场景启用，非 team create 保持 owner_id=NULL） | [OK] P1 BDD-31/32/33 `[BASELINE_CHANGE]` 锚 + P2 §3.4 R4；P6 BDD-31/32/33 PASS |
| backup restore merge 不拷 teams | P2 §12 SCOPE+3 | P1:480 `[SCOPE_RESOLVED]`（超出验收路径不采纳，记 backlog） | [OK] P2 §0.2-11 不改声明一致；P1 明确记录不扩 |
| detail 状态标签三态（team ≠ Private） | P2 §12 SCOPE+1（P1 §3.13 增补） | P1:355-359 `#### BDD-44` 编号入基线 + `[BASELINE_CHANGE: SCOPE+ 主 Agent 批准 2026-09-02]`（P1:359） | [OK] BDD-44 成为正式验收条目；P2 §5.8 给实现规格；P6 BDD-44 PASS |

- 附加确认：P4 自标 `[SCOPE+]` ×2（frontend 批 t093 4→5 tab 断言更新 + P3 spec @ts-expect-error 清理）与 backend retry1-B2 自标 `[SCOPE+]`（star_service owner 项，后经主 Agent 采纳落入 retry2 定向修复）——均为 P4 实现期发现并获 design-review / review-eng approved 的受限增补，非 P1 基线漂移；P5/P6 全绿佐证。
- 结论：SCOPE+ 全部闭环，无遗留未决增补。`[OK]`

## 3. 跨文件一致性核对（引用源文件节名）

### 3.1 packages ↔ P8 bump 范围（P2§packages）

- P1 frontmatter `packages:`（P1:20-23）= P2 frontmatter `packages: [backend/peekview, frontend-v3, packages/mcp-server]`（P2:12）= P4 三批 `implementation_dir`（`P4§impl-path`：mcp=packages/mcp-server/src/、frontend=frontend-v3/、backend=backend/）——三源一致。
- P4 各批改动文件逐一落在 P2 §0.1 A/B/C 逐文件清单内（含新增 team_membership.py/team_service.py/teams.py/listTeams.ts/stores/team.ts/TeamsView.vue），未发现清单外代码改动（P4 每批声明批次边界未跨包）。
- 版本锚：P2 §13 备注声明 P8 bump = peekview 0.21.0→0.22.0（minor，新功能+schema）+ mcp_server 0.11.0→0.12.0（schema 向后兼容）；实测 VERSIONS.json 仍为 0.21.0/0.11.0（未提前改动，符合 P2 §10 批次边界②「VERSIONS.json 由主 Agent 在 P8 统一处理」）。P8 尚未产出（P7 先于 P8 执行），bump 双路径一致性作为前向检查点交 P8 gate 按 VERSIONS.json 唯一源校验，本阶段不构成缺口。`[OK]`

### 3.2 P1 BDD 44 ↔ P6 PASS 44 ↔ judge 44（P1§BDD / P6§验收 / P6.5§verdict）

- 数量：P1 `#### BDD-NN:` = 44（BDD-1~44 连续，minmax 1/44）；P6 `- PASS BDD-NN:` = 44；P6.5 judge `- PASS BDD-NN:` = 44。
- 编号集合：P1 set == P6 set == judge set（差集为空，P6 无多余无遗漏）。`[OK]`
- 内容映射（防「数量对、条目错位」反模式）：44 条逐条按编号比对 P1 标题 vs P6 断言首句 vs judge 复核句，主题指纹全部对应（如 BDD-5「7 条读路径对 team 成员全部放行」、BDD-44「detail 状态标签三态」三处一致；差异仅为 P6/judge 的措辞缩写，无编号错位）。`[OK]`
- V1/V2 分区无跨域裂缝：P6 §交叉核对记录（P6:26-32）声明 V1=BDD-1~37（backend/CLI/MCP）+ V2=BDD-38~44（frontend UI），与 P1 §3.1~3.13 节分组一致；BDD-44 的 raw/team 后端契约由 BDD-36 TestBdd36RawTeam 承担（V1 实测），前端 detail 三态在其上做 DOM/vision 验收。`[OK]`

### 3.3 P4 实现路径 ↔ P2 方案 A（P4§impl-path / P2§1 方案 A / P2§3.2）

- 方案 A 落点逐项核对：`team_membership.py` 独立薄模块（P2 §3.2 落点权威）→ P4 新增文件含之（P4:164）；`can_read_entry` entry_service 模块级 + 仅进 get_entry 非 archived 分支、archived 分支不动（P2 B 表/§3.1 D5）→ P4 实现要点 1 一致（P4:182）；star_service 免环 import（P2 §3.2）→ P4 star_service 改动一致；teams 独立 service + 9 路由无权 404（P2 §3.3）→ P4 teams.py/team_service.py 一致。
- 方案 A owner 语义对偶（owner 视为团队可见范围成员）为 P4 实现期发现并经 P4-review-eng BLOCKER-2/复审 R1-R2 三次定向修复收敛（retry1-B2 + retry2），终审 approved——与 P2 方案 A 无方向冲突，属设计空白补全（同 DESIGN_GAP-6 形态，已在 §1 覆盖）。`[OK]`

### 3.4 team_id 字段贯通链抽验（跨三包代码落点，文档 ↔ 代码双向）

- backend：models.py `team_id` FK（:97）↔ entry_service `can_read_entry`/`team_visible_expr`（文件命中）↔ 新方法 `get_entry_by_api_key`（entry_service.py:1412 + 调用点 entries.py:546 download 分支）↔ api/teams.py 19 处 team 命中 ↔ cli.py `--team`×11 / `--user`×43 ↔ client.py PeekClient `team_id` payload 透传（:146-159）+ `list_teams`（:214）。
- frontend：types/index.ts `teamId/team`（:50-51）+ api/types.ts `team_id` 原始字段 ×3 ↔ api/client.ts transform 映射 `teamId: entry.team_id ?? null` / `team: {...}`（:67-68/:90-91/:239）+ teams API 全套（:492-515）↔ stores/team.ts + views/TeamsView.vue 文件存在。
- mcp：types.ts `team_id?: string`（:27）+ client.ts listTeams GET /teams（:190）+ tools/listTeams.ts 注册 + tools/getEntry.ts 输出 `team: raw.team ?? null`（:61）。
- 结论：P2 §10 批次边界①声明的「models ↔ service ↔ api ↔ client.ts ↔ types ↔ MCP schema ↔ PeekClient ↔ CLI」team 字段命名贯通链在三个包代码落点全部存在，无断链。`[OK]`

## 4. 未决项清零

- P1-requirements.md：无行首 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]` 残留（实测 grep 命中 0）；P1:38 与 P1:434 为 `[NO_NEED_CONFIRM]`（语义相反，确认无未决）。`[OK]`
- P6-acceptance.md：无 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]`，frontmatter `pass: 44 / fail: 0`。`[OK]`
- P6.5-judge-verdict.md：`criteria_passed: 44/44`，`status: passed`，无 NEEDS-REVISION。`[OK]`
- 全链产出文件（P1/P2/P3/P4/P6/P6.5）行首 `[BLOCKER]`/`[DEVIATION-CRITICAL]` grep 实测 0（P4-review-eng 的 BLOCKER-1/2 是评审中间态已修复并 approved，非产出残留）。`[OK]`
- 已知环境性失败（test_cli_remote Errno 30、backup .tmp flaky）已登记 known-failures.md 且与本次改动无关（P4/P5 基线同款），不构成未决项。`[OK]`

## 5. CODE-MAP 核对

`{AGATE_WORKSPACE}/agents/CODE-MAP.md` 与 P2-skeleton.md 均不存在（实测 agents/ 仅 project.md；P4 三批「新增文件核对表」均声明骨架/CODE-MAP 机制未采用 → 本节省略）——CODE-MAP 机制未启用，frontmatter 不填 code_map 计数，gate 免检。`[OK]`

## 6. 审查结论

- 无 `[BLOCKER]` / `[DEVIATION-CRITICAL]`；DEVIATION=0（3.1-3.4 全部一致）；EXTENSION 无（无清单外代码改动发现）。
- DESIGN_GAP 8/8 全部转抄 + `[DESIGN_GAP_REVIEWED: 已确认]` 配对（§1.1~1.8）。
- SCOPE+ 闭环确认（§2）；跨文件一致性确认（§3）；未决项清零确认（§4）。
- 状态标记：`[PROD_NOT_TOUCHED]`。

**Summary**: BLOCKER=0 / DEVIATION-CRITICAL=0 / DESIGN_GAP 8 条全配对 REVIEWED（8/8 已确认，0 打回 P2）/ SCOPE+ 闭环 / BDD 44↔P6 44↔judge 44 一致。P7 通过，可推进 P8。
