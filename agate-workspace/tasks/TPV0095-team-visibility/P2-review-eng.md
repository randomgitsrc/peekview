---
phase: P2
task_id: TPV0095-team-visibility
type: review
parent: P2-design.md
trace_id: TPV0095-P2-plan-eng-review-rev1-20260902
status: approved
created: 2026-09-02
agent: plan-eng-review
---

# P2 工程方案评审（复审 rev1）— TPV0095 team-visibility（plan-eng-review）

> 评审对象：`P2-design.md` rev1（574 行，修订上轮 R1-R4/N1-N4）
> 验收基线：`P1-requirements.md`（44 BDD，含 [BASELINE_CHANGE] 2026-09-02）；语义权威：`docs/design-notes/team-visibility.md` v4
> 方法：只读评审；逐份实读上轮评审 → 修订后设计 → P1 BDD-31~34 基线 → 关键代码复核（cli.py / database.py / exceptions.py，防行号漂移）
> 环境隔离：`[PROD_NOT_TOUCHED]`（仅只读源码 + 进程内核对，未触碰 :8080 / ~/.peekview/ / pipx）

## 结论

**Status: approved**（无 BLOCKER / 无阻塞修订项——上轮 R1-R4/N1-N4 全部落实，核心架构未被修订破坏，无新引入问题；仅 3 项非阻塞观察供 P4 参考，不阻断）。

总体判断：rev1 按上轮评审把 8 项修订全部补钉到位——CLI 本地迁移路径锁定（R1）、422 错误类口径锁定（R2）、gate_commands 拆键 + frontend/MCP 键补入（R3）、CLI --user 与 P1 BDD-31~34 基线对齐（R4）、FK ondelete 显式化（N1）、team_membership 落点统一（N2）、节号修正（N3）、raw team 字段入 Modify 表（N4）；上轮测试缺口（CLI 直建库索引 / BDD-31~33 双路径矩阵 / 双源 FK / 422 状态码断言 / teams-page.spec 入 gate）均由新增 P3 缺口条款与 §6 拆键闭合。核心架构（迁移顺序 / 7 路径收敛 / 免环 / EXPLAIN / 防枚举 404）实读复核未被破坏。

---

## 架构问题（阻塞级）

无。

## 架构问题（非阻塞 / 建议 P4 前于 P2 消歧，均不阻断）

### O1 §3.4 CLI 本地迁移修复的范围边界宜补一行声明

§3.4「CLI 本地 DB 迁移路径（R1 锁定）」只改 `_get_backend`(cli.py:78) 与 `_resolve_user_local`(cli.py:2079) 两处 init_db → `run_migrations=True`。复核 cli.py：`user_cmd` 族本地直连（:1532/1559/1585/1609/1643/1677 裸 init_db + check_schema）、`_get_apikey_service_local`(:2091)、`_get_admin_service`(:2115) 均不经上述两函数；`check_schema`(:229) 对既有 entries 表按 metadata 比对 → 存量旧库升级后若用户**先跑这些命令**仍会 SchemaMismatchError（须先 serve 或先跑任一 team/--team 命令完成迁移）。与 R1 推荐方案 1 的原文范围（team 相关路径）一致，无功能缺口，但建议 §3.4 补一句「本地其余命令（user/apikey/admin）在旧库上仍要求先经 serve 或 teams/--team 触发迁移」的范围声明，防 P4 误以为全 CLI 自愈。

### O2 §3.4「本地必填 --user」字面过宽，建议消歧一句

§3.4 首句「本地 create/list/teams 加 `--user <username>`，本地模式必填」若按字面读，与后文「不带 --team 的 create 行为保持现状（owner_id=NULL）」「--user 仅在本任务 team 相关命令上启用」及 P1 BDD-33（默认 list 行为不变）冲突。正确读法 = **team 相关命令**（teams / create --team / list --team）本地必填；非 team create/list 不触发。P1 BDD-31~33 锚（[BASELINE_CHANGE] 2026-09-02）已按此口径写入。建议 §3.4 将该句收紧为「teams/--team 相关命令本地模式必填」，消除 P4 歧义。

### O3 §3.3 路由表 8 行 vs §11 #3「9 路由」计数不一致

§3.3 表列 8 行（POST /teams、GET /teams、GET /teams/{slug}、PATCH、DELETE、POST members、DELETE members、POST leave）；§11 #3 与 §0.1 C 表称「9 路由」。疑缺算某成员管理端点或合并计法。语义无冲突（9 个 handler 可为 8 行表含组合语义），建议统一为「8 行表 / 9 端点」或补第 9 行，防 P4/P3 对路由数与测试用例计数对不上。

---

## 上轮 R/N 落实核对（逐项，结论引用修订后锚点）

| 项 | 落实 | 修订后锚点 |
|---|---|---|
| R1 CLI 本地迁移路径 | ✅ | §3.4「CLI 本地 DB 迁移路径（R1 锁定）」`_get_backend`(cli.py:78)/`_resolve_user_local`(cli.py:2079) `init_db` 改 `run_migrations=True`；§0.1 A 表 cli 行；§7 files_to_read cli.py:436；§11 #6；P3 缺口 = 直建库两索引断言 + 旧库先跑 `peekview teams` 自愈断言 |
| R2 422 错误类 | ✅ | §3.1 D2 显式锁「抛 `ParameterValidationError`（status_code=422；`ValidationError`=400 不用于此）」，create/update/匿名同口径；§0.1 B 行；§7 exceptions.py:434；§11 #4 |
| R3 gate_commands | ✅ | §6 拆键零 `&&`：P3/P3_frontend/P3_mcp、P5/P5_frontend/P5_mcp/P5_typecheck/P5_lint、P6/P6_frontend/P6_mcp + P5/P6_e2e_a、P5/P6_e2e_b 两 spec 分键；per-key timeout_seconds；§6 拆键说明引 run-e2e-tests.sh 单 spec 语义 |
| R4 CLI --user + 基线对齐 | ✅ | §3.4「本地模式归属（R4 契约）」示例与 P1 BDD-31~33 [BASELINE_CHANGE]（P1:288/293/298）When 一致（`--user alice`）；参照对象 = apikey create cli.py:1920（非 user_cmd）；非 team create 保持 owner_id=NULL |
| N1 FK ondelete | ✅ | §2 line 169 模型层三字段 `ForeignKey(..., ondelete=...)` 显式声明 + DB `foreign_keys=ON` 理由 + P3 全新库删 team/user FK 断言缺口（§11 #1） |
| N2 team_membership 落点 | ✅ | §3.2「落点锁定（一处权威）」独立薄模块 `services/team_membership.py`；§0.1 B/§1 候选 A/§7 均改指该锁定（grep 确认旧表述仅在 §3.2 作「不再出现」声明引用） |
| N3 节号漂移 | ✅ | 全文 grep「§4.4」零命中 |
| N4 raw team 字段 | ✅ | §0.1 B 表新增行：`resolve_entry_raw` + `EntryRawResponse` 可选 `team`（仅 owner/成员/全局 key 附，share 不附）；§7 files_to_read files.py:430；§4/§12 同步 |

## 核心架构完整性核对（rev1 未破坏）

- **迁移顺序**：§2/§0.1 A 表 = create_all(:302) → _run_migrations(:306，列检测 + IF NOT EXISTS 幂等，实读 database.py:40-110 确认既有段全幂等) → _setup_indexes(:309) —— 与 database.py 实读一致，被引用表先建，未被修订改动。
- **7 路径收敛**：§3.2 A1-A7 核对表 + can_read_entry 条件 + archived 分支不动（D5）——机制保留。
- **免环**：§3.2「star_service 免环（本设计锁）」team_membership.py 单向 import——保留。
- **EXPLAIN/BDD-26**：§3.5 + §11 #9 + §0.3 R4 缓解——保留。
- **防枚举 404**：§3.3 无权一律 NotFoundError + share 三接口 403→404（§0.1 B 行）——保留。
- **修订新增引用行号经实读复核**（cli.py:78/:2079/:1920/init_db 13 处 / exceptions.py:41=400、:233=422 / database.py init_db/check_schema / ruff=backend/.venv/bin）——无漂移。

## 无新引入问题

- 复核上轮 8 项修订的联动：R1 的 run_migrations=True 仅限两函数（幂等迁移，重复调用安全——迁移段全 IF NOT EXISTS/列检测）；R3 拆键后每键语义独立（P3 主键仍为 backend 红灯运行器，P3_frontend/P3_mcp 为补充键，与 check-tdd-red 单键消费不冲突）；R4 的 --user 口径与 P1 [BASELINE_CHANGE] 双向一致；N1 的模型层 ondelete 与 raw DDL 双源同值。
- 未发现因修订引入的新不一致或新缺口。残余观察 O1-O3 为非阻塞文档级消歧项，不构成 needs-revision。

---

## 测试缺口

上轮测试缺口已全部闭合：
1. BDD-26 CLI 直建库索引线 → §3.4 P3 缺口（直建库含两索引断言）+ §11 #6。
2. BDD-31~33 本地/远程矩阵 → §11 #6（--user fail fast 双路径 + 远程透传 BDD-34 锚）。
3. 双源 FK 行为 → §2 line 169 + §11 #1（全新库 create_all 路径删 team/删 user FK 断言）。
4. 422 状态码断言 → §11 #4（状态码断言非文案）。
5. teams-page.spec 未入 gate → §6 P6_e2e_b（E2E_SPEC=e2e/teams-page.spec.ts）+ §6 拆键说明（两 spec 各自承载 BDD-42 与 BDD-38~41/43）。

## 锁定决策（rev1 复核后确认成立的技术方向）

1. **CLI 本地迁移修复 = 方案 1**（init_db(run_migrations=True) 于 _get_backend/_resolve_user_local，幂等、与 serve 同语义）——不是索引移 _setup_indexes；两索引留迁移段 + CLI 直建库经 run_migrations 补建（§3.4 锁定）。
2. **422 契约 = ParameterValidationError**（ValidationError=400 明确不用于 team 校验），create/update/匿名统一（§3.1 D2）。
3. **gate_commands = 全拆键**，backend/frontend/mcp 三端独立键 + P5/P6_e2e_a/b 分 spec（§6）。
4. **CLI --user 参照 apikey create 先例**（cli.py:1920，required in local mode，非 user_cmd）；非 team create 保持 owner_id=NULL（§3.4 + P1 BDD-31~34 [BASELINE_CHANGE]）。
5. **team_membership 落点 = 独立薄模块** services/team_membership.py（§3.2 一处权威，§0.1/§1/§7 已统一）。
6. **模型层 FK ondelete 双源一致**（§2 line 169）——全新库 create_all 路径的 FK 行为由模型字段保证，raw DDL 供旧库兜底。
7. **7 路径收敛 / 迁移顺序 / 免环 / EXPLAIN / 防枚举 404** —— rev1 复核未破坏，维持上轮锁定。

## BLOCKER 清单

无。

[PROD_NOT_TOUCHED]
