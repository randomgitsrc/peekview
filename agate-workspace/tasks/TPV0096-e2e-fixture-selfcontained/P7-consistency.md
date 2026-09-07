---
phase: P7
task_id: TPV0096
type: consistency
parent: P6-acceptance.md
trace_id: TPV0096-P7-20260907
status: approved
created: '2026-09-08'
agent: consistency-reviewer
blocker_count: 0
deviation_count: 2
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

# P7 一致性检查 — TPV0096 E2E 红灯 spec 自建 entry 化

审查角色：consistency-reviewer（独立 subagent，agent≠main，只审不写）。
审查对象：本任务 P0-P6.5 全链产出 + `agate-workspace/debt/tech-debt.md`（DEBT0011/0012）+ git 阶段 commit 链。
审查方法：P7 卡五项检查清单 + 主 Agent dispatch-context 指定的收尾闭环核对（第六项），逐项交叉核对到节名锚点；纯文档审查（未跑测试、未启停服务、未触碰 :8080 与 `~/.peekview/`）。关键声明逐条独立 grep/read/git 实证，非转述上游自述。

**审查基线 commit 链**（`git log --oneline -15` 实测，与 dispatch-context 预期一致）：
98fda6a8（P1）→ 5cb65177（P2）→ a05e381f（P3，含红灯回填）→ 13594c9f（P4，含 P4-review）→ 333f5209（P5）→ fb7e6c71（P6）→ 04e0456e（P6.5）。

## 1. DESIGN_GAP 配对（清单①）

- P4 声明核实：`grep -n 'DESIGN_GAP' P4-implementation.md` 实跑，全文仅 L97 一处，为否定式声明「无 `[DESIGN_GAP:]`（实现严格按 P2 §1.1 M 表与 §2 定稿执行）」——不存在行首 `[DESIGN_GAP: …]` 正式声明（行首形态 0 处），dispatch-context 预期「P4 明文声明无 DESIGN_GAP」属实。
- 实现对账旁证：P4-review §3 对 P2§1.1 M1-M4 逐行对账结论「全部行落地，无缺失行，语义零偏差」，其 §9 发现汇总（F1-F5）判级均为非阻塞 QUALITY/CONFORMANCE，无一条属设计偏差。[SCOPE_GAP] 亦为否定式声明且经 P4-review §6「diff 恰等于 P2 §1.1 封闭清单 4 文件」实证。
- 转抄动作：P4 无正式 DESIGN_GAP 声明 → 本产出无需转抄，design_gap_count: 0 / design_gap_reviewed_count: 0。
- gate 交叉核对预判：check-gate.py gate_p7 的「P4 声明数 > P7 转抄数」分支按 0 > 0 不触发；「P4 含 design_gap 关键词但计数为 0」会输出预期内 WARNING——该关键词命中即 P4 L97 的否定式声明本身，主 Agent 见此 WARNING 可凭本节结论直接判定无需处理。

**结论：design_gap_count = 0 = design_gap_reviewed_count = 0，配对机制空集成立。**

## 2. SCOPE+ 闭环（清单②）

P1 §2.1 标记双存在（grep 实测）：

- L44 `[SCOPE+ from P1]`（节标题：死选择器迁移——仅自建 entry 无法转绿）。
- L61 行首 `[SCOPE_RESOLVED: 2.1 死选择器迁移——主 Agent 2026-09-07 采纳（P1-review 前 SUGGEST-1 定案），已纳入 P2 方案（§1.1 M1/M3 表）并由 P4 实现、P6 BDD-7 静态清零 PASS、P6.5 judge 独立复核确认；…… [BASELINE_CHANGE: 主 Agent 批准的闭环标记]]`。

逐落点核对（SCOPE_RESOLVED 指向与实际产物一致）：

| 闭环环节 | 实证锚点 | 判定 |
|---|---|---|
| 主 Agent 采纳 | P1§SCOPE_RESOLVED（L61，2026-09-07 采纳 + P1-review 前 SUGGEST-1 定案）；P1-review§建议/§流程合规确认 SCOPE+ 增补在案 | ✓ |
| P2 纳入方案 | P2§1.1 M1 表 BDD-7 行（L43-46）+ M3 表 BDD-6/7 行（L65-67）覆盖 §2.1 表全部 5 行死选择器迁移；P2§2.5 含 BDD-7 静态清零判据；P2-review§2 确认「四项 SCOPE+（死选择器 §2.1 / goto §2.2 / 假绿 §2.4 / 护栏 §2.6）全部承接，无遗漏」 | ✓ |
| P4 实现 | P4§M1 选择器迁移行（4 处映射与 P2 表逐条一致）；P6§PASS BDD-7（死类名 0 命中 + spec/src 双向正向对照，static-checks.log L17-57 命令级证据）；P6.5§PASS BDD-7（judge 独立亲跑同口径 0 命中，static-checks.log 为其 verdict_evidence 之一） | ✓ |

SCOPE_RESOLVED 声明的「P1 → P2 → P4 → P6 → P6.5」五环链逐环可追溯，标记指向一致，无环缺失。

**结论：SCOPE+ 闭环成立，链路完整可追溯。**

## 3. 跨文件一致性（清单③ + P3§7.3 指定的 P7 交叉范围）

### 3.1 P1 BDD 数量 ↔ P6 验收结果（逐条内容映射，非仅计数）

- 计数：P1 `#### BDD-` 标题实测 13 条（BDD-1~13，连续不跳号，P1-review§BDD 评审逐条核对）；P6 正文 `^- PASS BDD-` 实测 **13 行**，frontmatter `pass: 13 / fail: 0`；P6.5 judge `criteria_total: 13 / criteria_passed: 13`。三方计数一致。
- 内容映射抽查（P7 卡「常见错误 2」防回归）：BDD-6（无条件断言静态三判据）→ P6 L29 逐判据引用 static-checks.log（三负向 exit 1 + 正向 13/3/7）；BDD-7（死选择器清零）→ P6 L30 同证据文件双向对照；BDD-8（goto `/:slug`）→ P6 L31 负向 0 命中 + 正向 7 处 + 运行兜底；BDD-12（基线家族对照）→ P6 L35 对照 P3§5 基线并集，逐条归属在 regression-compare.log；BDD-13（文档两规则）→ P6 L36 引 doc-rules.log。抽查 5 条映射全部正确，未发现内容错位。
- 独立复证（本审查亲跑，非转述）：P3§6.3/§6.4 同口径 grep —— `/entries/` 在 3 spec 命中 0 处（rc=1）；`docs/process/debug-workflow.md` L245「E2E 编写规范」节、L249 规则 1（`/:slug` 非 `/entries/:slug`）、L250 规则 2（seed 或自建 + afterEach 清理队列）三条全命中。与 P6/P6.5 记录一致。

**结论：13 = 13，逐条映射无错位。**

### 3.2 P2 packages ↔ 实际改动面 ↔ P8 bump 口径

- P1§packages（frontmatter）与 P2§packages 均为 `[frontend-v3, docs]`；P1§1 范围边界「只改 frontend-v3/e2e/ 与 docs/，不 bump 版本」。
- 实际改动面（git 实证）：`git show --name-status 13594c9f` 中代码/文档改动恰为 4 文件——`frontend-v3/e2e/mermaid.spec.ts`、`mermaid-check.spec.ts`、`mermaid-visual.spec.ts`（3 spec，frontend-v3 包）+ `docs/process/debug-workflow.md`（docs 包）；其余为 agate 流程产物（.state.yaml/gate-events/orchestrator-log/任务产出），不属代码改动面。`git diff --name-only 13594c9f..HEAD -- frontend-v3 docs backend` 为空——P4 commit 后至 HEAD 无代码改动，P5/P6/P6.5 验收对象与当前代码同源。
- P8 bump 口径三处一致：P0§裁剪倾向「无需 bump（纯测试改动，走 CHANGELOG [Unreleased] 记录）」= P1§7 P8 行「不做 bump-version；CHANGELOG [Unreleased] 记录即可」= P2§1.2 不改清单「VERSIONS.json/版本号——P1 §7：纯测试改动不 bump，CHANGELOG 记录归 P8」。P1§7 裁剪声明（phases 全保留 + design_trivial 顶格声明 + medium risk 理由）与 P0 裁剪倾向（P2 简化 / P3 保留 / P6 不可裁 / P8 无 bump）逐项吻合，与 P6 frontmatter `ui_affected: false`（无用户可见 UI 变化）同口径。

**结论：packages 范围 ↔ 3 spec + debug-workflow.md 精确吻合，P8 预期无 bump 口径三处一致。**

### 3.3 P2 gate_commands ↔ P5 执行记录 ↔ P6 证据引用同源

| P2§6 键 | P5-test-results 记录 | 结果 |
|---|---|---|
| P3（红灯，mermaid.spec.ts） | P3§5 回填节：check-tdd-red.py exit 0 真红灯（NotFoundView 类），AGATE_TDD_TIMEOUT=600 | ✓ 同命令 |
| P5（test-frontend）/ P5_typecheck | unit.md：exit 0，1343 passed / 4 skipped / 0 failed；typecheck ✓ | ✓ 同命令同结论 |
| P5_e2e / P5_e2e_b / P5_e2e_c（三 spec 分键，各 900s） | e2e.md：三键 exit 0（6/2/6 passed，合计 14，0 flaky） | ✓ 同命令同结论 |

- fail-list.txt 为 0 字节空文件（与「0 failed」口径一致）。
- P6 证据与 P5/P2 同源：P6§1-2 执行环境（干净 debug :8888 + debug-start/seed/stop 自包含链）与 P2§4 env_constraints / §5 平台执行模式逐点一致；P6 被验收代码 = HEAD（333f5209 时点，13594c9f 后无代码改动，上节 git 实证）。
- P2§5 minimal_validation「confirmed」实测 7 步（匿名 POST 201 / DELETE 200 / 残留 0）与 P1§2.3 认证配对推断互证，R2 机制前提经实测成立。

**结论：gate_commands → P5 执行 → P6 证据三方同源同口径。**

### 3.4 P4 实现路径 ↔ P2 方案设计

P4§逐文件改动说明与 P2§1.1 M1-M4 表逐行对账（P4-review§3 逐行 ✅ 表核对无缺失行）：四件套范式（护栏/ensureEntry/清理队列/断言迁移）= P2§2.1；slug 显式枚举 14 上限 = P2§2.4；自起 chromium 保留 = P2§2.3；M4 四条规则 = P2§1.1 M4（本审查复核 P4-review§8「规范文本与代码实现零漂移」——规则 1 goto 模板与 static-checks.log 正向 7 处 `` goto(`${BASE_URL}/` `` 写法一致，规则 3 与三 spec 护栏对应）。P4§自查 expect 计数 13/3/7 与 static-checks.log L13-15 一致。

**结论：实现与设计吻合。**

### 3.5 BDD-13 规范文本 ↔ 3 spec 实际改造（P3§7.3 明文划入 P7 交叉）

- 规则 1（路由写法）：规范 goto 模板 = spec 实际 7 处写法（static-checks.log L63-69 逐行在案）✓
- 规则 2（seed 或自建 + afterEach 清理队列）：3 spec 均内联清理队列（cleanup-assertion.md §1 代码级记录，`[200,204,404]` 容忍 + 其余 throw），无依赖消失 entry 的路径（seed-isolation.log §5 seed slug 字面量 grep exit 1）✓
- 规则 3（防生产护栏）与规则 4（同认证上下文）：与三 spec 护栏实现（P4-review§3.1）和 R2 结构性配对（cleanup-assertion.md §2 认证配对行）对应 ✓
- 已知正向增补登记（P4-review F1）：debug-workflow.md L250 规则 2 末句「确定性 slug 加 `e2e-` 前缀，避免与 seed-data 条目冲突」为 P2§1.1 M4 清单外增补——内容与 P2§2.4「`e2e-` 前缀与 seed 24 条零交集」定稿一致（本审查按 seed-isolation.log §1 24 条逐一目视核对，无 e2e- 前缀，交集确为 0），属意图内沉淀。此处按 P4-review 指引登记为已知增补，不计偏差。

**结论：规范文本与实际改造零漂移（1 处正向增补已登记）。**

## 4. 未决项清零（清单④）

grep 实测（P1/P4/P6/P5 两文件，pattern `\[[A-Z-]*(NEED_CONFIRM|BLOCKER|DEVIATION-CRITICAL)`，rc=1 零命中）：

- P1§L26/§8 均为行首 `[NO_NEED_CONFIRM]`（非行首 NEED_CONFIRM）；4 条 [SUGGEST] 为倾向项，非阻塞。
- P6 无 NEED_CONFIRM（客观验收 PASS/FAIL 二值），无 [BLOCKER]、无 [DEVIATION-CRITICAL]。
- 任务目录全文（排除 dispatch-context）`\[DEVIATION` grep rc=1——上游各阶段无 DEVIATION 类标记残留。
- P5 fail-list 空 + P6 13/13 PASS，无未决失败项。

**结论：未决项清零成立。**

## 5. CODE-MAP 核对（清单⑤）

`{AGATE_WORKSPACE}/agents/CODE-MAP.md` glob 实测**不存在**；P4§新增文件核对表明文「未采用骨架/CODE-MAP 机制（P2-skeleton.md 与 agents/CODE-MAP.md 均不存在）……且本次 4 个文件全为既有文件改造，无新增文件」。git name-status 佐证：P4 commit 中 3 spec 与 debug-workflow.md 全为 `M`（修改），无 `A` 态代码文件。

**结论：机制未采用，按 dispatch-context 与 P7 卡规则跳过；不填 code_map_new_files_count/code_map_reviewed_count（gate 两字段均缺失时跳过 CODE-MAP 配对检查），无 [CODE_MAP_DRIFT:] / [CODE_MAP_SYNC:] 标记义务。**

## 6. 收尾闭环核对（清单⑥，主 Agent 指定）

tech-debt.md L245/L263 实测新增 DEBT0011/DEBT0012（均为 2026-09-07 登记，status: open），与上游对应关系逐条核对：

### 6.1 DEBT0011 ↔ P1§8.4 SUGGEST-4（judge 保留项无涉）

- DEBT0011 evidence note 明文引用「TPV0096 P1 同类扫描实证（P1 §4）：t022 7 test 全部 goto /entries/test-mermaid-2 等 + 死选择器 .mermaid-action-btn/.toolbar-btn；verify-mermaid goto /entries/test-mermaid-2-2（不存在）」并记录「主 Agent 采纳 SUGGEST-4 延后单独立项」。
- 对应源：P1§4 命中清单 t022/verify-mermaid 两行判定「本次不处理——延后立项（见 8.4）」；P1§8 SUGGEST-4 原文正是「t022 与 verify-mermaid 同型缺陷延后单独立项并登记 debt/roadmap，理由：超出 DEBT0010 closure criteria 范围，混入会扩大本任务验收面」——登记理由与 closure criteria 边界陈述一致。
- 内容完整性：DEBT0011 title/evidence/impact/recommendation/closure_criteria（「两 spec 全绿或正式 skip + 原因」）与 P1§4 描述的三重缺陷（死 goto + 死选择器 + 消失 fixture）逐项对应，recommendation 给出的处理方案与本次三 spec 已落地模式同构，BDD-13 规范被引为拦截手段（与 P1§4「回归拦截声明」一致）。
- 语义判定：**闭环成立**——P1 延后倾向项按倾向承诺落到 debt 登记，未混入本任务验收面（三 spec 与 t022/verify-mermaid 零交叉，P4 改动 4 文件封闭清单佐证）。

### 6.2 DEBT0012 ↔ P6.5 judge verdict 保留项②

- DEBT0012 evidence note 记录「TPV0096 P6 验收与 P6.5 judge 复核两次独立观察到 make debug-seed 输出 HTTP 422（team_id 时序），3 条 seed entry 未入库（DB 全表真值证实非清理误删）」。
- 对应源①：P6.5§4 保留项②原文——「seed 24 条中 4 条因 seed 基建预存缺陷（422 或无内容）本就不在库……属预存基建问题、非本任务回归，不阻断本判定；**建议主 Agent 另行跟踪 seed-debug.py 的 team_id 时序缺陷**」。
- 对应源②：P6§0 环境预存事实记录（seed-debug.py 422、20/24 入库、P5 e2e.md「Total entries: 19」同现象）；seed-isolation.log §6.4 sqlite 全表真值（markdown-test/mermaid-charts/csv-employees 三条不在 DB + 无内容跳过的 image-gallery）为「3 条 seed 未入库」的具体清单，与 DEBT0012「偶发 422 致部分 seed entry 未入库」互证；P5 e2e.md L54 为最早观察记录。
- 内容完整性：DEBT0012 impact（干扰「seed 24 条全可访问」类断言）正对应 judge 保留项②指出的 BDD-4 理想口径不可达问题；closure_criteria（连续 10 次 seed 零 422 + DB 全表 24 条稳定）可二值判定；recommendation 定位 scripts/seed-debug.py 与证据根因一致。
- 语义判定：**闭环成立**——judge 建议的「另行跟踪」已按建议落为 DEBT 登记，且两次独立观察 + DB 真值 + 最早记录（P5）三方证据链完整。

### 6.3 judge 保留项①处置判定（dispatch-context 要求显式表态）

P6.5§4 保留项①：BDD-3 run2 退出码未逐 spec 显式捕获（链 2 被执行器 600s 上限截断），judge 以组合证据（链 2 段原始 playwright 汇总行 6/2/6 + run2 后残留 14/14 = 0 + catchall 0 + debug-stop 目录销毁）判 PASS 并留痕「如需更强证据可在后续轮次补采 run2 逐段退出码」。

本审查判定：**不构成 [DEVIATION]，不计入 deviation_count**。理由：

1. 事实层无失真——P6-acceptance.md L18-19 如实记录截断与补做安排（「已捕获段完整，其后所有步骤移入链 3 补做」），无隐瞒；judge 亦独立核验了该事实并明示判定依据，属 review 方法论披露而非产出缺陷。
2. 判定层无缺口——BDD-3 判据为「每次退出码 0 + 第 2 次跑完残留仍 0」，组合证据对判据的两个支点（稳定、无残留）均给出可核验事实；补充逐段退出码只是证据强度增强项（judge 自己标为「如需」），非判据缺口。judge 终态 status: passed 为既有授权终态，无需 P7 追加标记。
3. 证据可回溯——residue-check.log / test-output.log 为组合证据载体，均在 verdict_evidence 清单内（本审查已实际读取复核）。

保留项①作为「已留痕的方法论说明」归档于 P6.5§4 原文，无需在本产出重复登记。

## 7. 发现汇总与计数

| # | 定位 | 定性 | 计数影响 |
|---|---|---|---|
| 1 | P6.5§2 BDD-6 行「合计 27」为合计数笔误（13+3+7=23） | [DEVIATION]（笔误级，证据本体 static-checks.log 数值无误，判定不受影响） | deviation_count +1 |
| 2 | P6.5§3 git 留痕行「P4 commit ……共 4 个代码/文档文件」计数含义易误读（git name-status 另含 7 个 agate 流程产物） | [DEVIATION]（表述级，限定语「代码/文档文件」语义可正确还原，P4-review§6 有精确对照可互证） | deviation_count +1 |

- 无 [BLOCKER]：六项清单全部通过（§1-§6）。
- 无 [DEVIATION-CRITICAL]：两条 [DEVIATION] 均为 judge verdict 单文件内的笔误/表述精度问题，不动摇任何 BDD 判定、不动摇任何跨文件对账结论，且原始证据（static-checks.log、git name-status）均为正确权威源。
- design_gap_count = 0（P4 无正式 DESIGN_GAP 声明，§1 核实）；配对计数 0 = 0。

## 8. 结论

**P7 一致性审查通过（BLOCKER = 0，DEVIATION-CRITICAL = 0，DEVIATION = 2（笔误级/表述级），DESIGN_GAP 配对空集，SCOPE+ 闭环，CODE-MAP 机制未采用）**。全链 P1→P2→P3→P4→P5→P6→P6.5 产出与 git commit 链 98fda6a8→04e0456e 交叉核对一致；DEBT0011/0012 两条收尾登记与 P1 SUGGEST-4、judge 保留项②对应闭环，judge 保留项①按 §6.3 判定无需 DEVIATION 记录。P8 可按「无 bump、CHANGELOG [Unreleased] 记录」口径推进（releaser 只产出文件，主 Agent 亲自 commit）。

[PROD_NOT_TOUCHED] 本审查为纯文档审查：未跑测试、未启停服务、未操作 :8080 生产服务与 `~/.peekview/`；命令仅限 read/grep/glob/git log/show（均 timeout 30s）。

尾注：frontmatter 字段经 agate-md-field-set.py --list 核对（5 个计数器字段值与手写一致）；status 由 draft 手写置为 approved——工具按角色白名单拒绝 consistency-reviewer 写入（本任务无 dispatch 指定的 review 字段写入角色，按 dispatch-context 预留的「agent 被拒则手写记录」路径处理，判定依据为审查通过、无 BLOCKER/CRITICAL）。
