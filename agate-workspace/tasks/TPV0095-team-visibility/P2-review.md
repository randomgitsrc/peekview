---
phase: P2
task_id: TPV0095
type: review
parent: P2-design.md
trace_id: TPV0095-P2-review-lead-20260902
status: approved
created: 2026-09-02
agent: review
---

# P2 专家组组长汇总 — TPV0095 team-visibility（review）

> 评审对象：`P2-design.md` rev1（574 行）；验收基线：`P1-requirements.md`（43 BDD，rev1 编号 BDD-1~43，修订记录 2026-09-02）+ [SCOPE+]/[BASELINE_CHANGE] 增补 BDD-44 = 44 条验收线
> 角色声明：本文件为专家组组长**汇总轮**，只汇总两位评审的判定，不发表新意见（dispatch-context-review-lead 组长规则 1）。
> 环境隔离：`[PROD_NOT_TOUCHED]`（全程只读 task 目录内评审/设计文件 + P1 基线 grep 核对，未触碰生产 :8080 / ~/.peekview/ / pipx）

## 一、评审一结论摘要 — plan-eng-review（`P2-review-eng.md`）

**Status: approved**（无 BLOCKER / 无阻塞修订项；`[PROD_NOT_TOUCHED]`）

- **approved 理由**：上轮 R1-R4/N1-N4 共 8 项修订在 rev1 全部落实——R1 CLI 本地迁移路径锁定（`_get_backend` cli.py:78 / `_resolve_user_local` cli.py:2079 `init_db(run_migrations=True)`）、R2 422 错误类口径锁定（`ParameterValidationError`，`ValidationError`=400 不用于此）、R3 gate_commands 拆键零 `&&` + frontend/MCP 键补入、R4 CLI `--user` 与 P1 BDD-31~34 基线对齐、N1 模型层 FK `ondelete` 双源显式化、N2 `team_membership` 落点统一独立薄模块、N3 节号修正、N4 raw team 字段入 Modify 表。
- **上轮测试缺口已闭合**（CLI 直建库索引 / BDD-31~33 双路径矩阵 / 双源 FK / 422 状态码断言 / teams-page.spec 入 gate → 均由新增 P3 缺口条款与 §6 拆键覆盖）。
- **核心架构实读复核未被破坏**：迁移顺序（create_all → _run_migrations 幂等 → _setup_indexes）、7 路径收敛、team_membership 单向 import 免环、EXPLAIN/BDD-26、防枚举 404。
- **非阻塞观察 3 项**（O1-O3，文档级消歧，不阻断）：O1 §3.4 CLI 迁移修复范围边界补一句声明（本地其余 user/apikey/admin 命令旧库上仍须先经 serve 或 teams/--team 触发迁移）；O2 §3.4「本地必填 --user」字面过宽宜收紧为「teams/--team 相关命令本地模式必填」；O3 §3.3 路由 8 行表 vs §11「9 路由」计数口径统一（建议「8 行表 / 9 端点」）。均明确**不构成 needs-revision**。

## 二、评审二结论摘要 — plan-design-review（`P2-review-design.md`）

**Status: approved**（无 BLOCKER；`[PROD_NOT_TOUCHED]`）

- **approved 理由**：上轮 needs-revision 的 3 个修订项（N1-N3）与 4 条非阻塞建议在 rev1 全部落实——N1 UI 设计节交互 checklist「需人工复核」改为明确逐态 Playwright 断言动作；N2 §5.7 data-testid 集中清单（16 类元素，逐项与上轮列目对应）+ §5.3 toggle 隐藏边界 + §5.8 BDD-44 detail 三态载体写死（BaseBadge team 变体）+ §5.5 新建表单输入/输出规格 + myTeams store 动作清单 ①-⑤；N3 §5.2 三态文案归属表并排收口（含是否调 listEntries + testid 列）+ 非 owner 不渲染 badge 声明。
- **4 条非阻塞建议全采纳**（§5.1 高亮规则范围声明 / §5.2 判定依赖 myTeams 已加载 / §5.6 键盘导航锁定 tablist + 方向键 / E2E spec 拆分 P5/P6_e2e_a/b）。
- **与 BDD-38~44 逐条一致性核对全 ✅**（8/8）；P1-P2 形态声明一致（ui_render_shape=layout ↔ 渲染形态: layout，适用维度 = 布局结构/交互行为）。
- 未发现新引入缺口；残余 1 项非阻塞观察（`team-error` 共用 testid，若 P4 发现两表单同屏可加区分 testid，不影响本清单验收语义）。

## 三、专家组分歧检查

两位评审对 `P2-design.md` rev1 判定**一致**：均为 `approved`、均无 BLOCKER、均 `[PROD_NOT_TOUCHED]`、均确认上轮修订项全量闭合且无新引入问题。**无专家组分歧**，不触发人工仲裁。

## 四、组长汇总判定

按组长规则逐条适用：

1. 任一评审标 BLOCKER / status=rejected → 不满足（两评审均无 BLOCKER、均 approved）
2. 两位评审分歧 → 不满足（判定一致）
3. 全票无 BLOCKER → **成立**

→ **汇总 status: approved**。`P2-design.md` rev1 可进入 P2 gate 与 P3。两位评审的**非阻塞观察（O1-O3 / team-error testid 观察）不阻断本 gate**，按评审建议供 P4 实现参考（O2 的「--user 本地必填」口径收紧建议与 P1 BDD-31~34 [BASELINE_CHANGE] 已一致，P4 按 teams/--team 相关命令口径执行即可）。

## 五、引用锚点

### R/N 项已闭合列表

| 项 | 评审 | 修订后闭合锚点（P2-design.md） |
|---|---|---|
| R1 CLI 本地迁移路径 | eng | §3.4「CLI 本地 DB 迁移路径（R1 锁定）」`_get_backend`/`_resolve_user_local` 改 `run_migrations=True`；§0.1 A 表；§11 #6 |
| R2 422 错误类 | eng | §3.1 D2 锁 `ParameterValidationError`（422），`ValidationError`=400 不用于此 |
| R3 gate_commands 拆键 | eng | §6 拆键零 `&&`（P3/P5/P6 × backend/frontend/mcp + P5/P6_e2e_a/b）+ per-key timeout_seconds |
| R4 CLI --user + 基线对齐 | eng | §3.4「本地模式归属（R4 契约）」与 P1 BDD-31~33 [BASELINE_CHANGE] 双向一致 |
| N1 FK ondelete 显式化 | eng | §2 模型层三字段 `ForeignKey(..., ondelete=...)` + DB `foreign_keys=ON` + P3 全新库 FK 断言缺口（§11 #1） |
| N2 team_membership 落点统一 | eng | §3.2 独立薄模块 `services/team_membership.py`（一处权威） |
| N3 节号修正 | eng | 全文「§4.4」零命中 |
| N4 raw team 字段 | eng | §0.1 B 表 `resolve_entry_raw` + `EntryRawResponse` 可选 `team`（share 不附） |
| N1（design）UI checklist 落为自动化 | design | UI 设计节交互 checklist（§UI 设计 :359）+ §5.5 输入态逐态规格 + P6 载体 = teams-page.spec.ts 断言 |
| N2（design）testid 清单 + 边界 + 载体 | design | §5.7 稳定测试标识清单（16 类）；§5.3 toggle 隐藏边界；§5.8 BDD-44 三态载体锁定 BaseBadge；§5.5 新建表单 + myTeams 动作清单 |
| N3（design）三态文案收口 | design | §5.2「三态文案归属表」+「badge 渲染声明（list 视图边界）」 |

### BDD 覆盖

- 验收基线 44 条（BDD-1~43 + [SCOPE+] BDD-44）全部在设计内落锚：后端权限/teams API/防枚举/share/star/生命周期迁移/校验契约/竞态/兼容与性能线（BDD-1~30）→ §0.1 影响面 Modify 表 A-E 逐条关联；CLI（BDD-31~34）→ §3.4；MCP（BDD-35~37）→ MCP 端设计；前端 UI（BDD-38~44）→ §5.1-5.8 + §5.7 testid 清单逐条可断言。
- eng 评审确认上轮 5 项测试缺口由 §11 P3 缺口条款 + §6 拆键闭合（BDD-26 直建库索引 / BDD-31~33 矩阵 / 双源 FK / 422 状态码 / BDD-42 与 BDD-38~41、43 的 spec 分键承载）。
- design 评审 BDD-38~44 逐条一致性核对全 ✅（8/8，含 P6 逐态断言 + 截图载体）。

## 六、BLOCKER 清单

无（两评审 BLOCKER 清单均为空）。

## 附：环境隔离声明

[PROD_NOT_TOUCHED]

