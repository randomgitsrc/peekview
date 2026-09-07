---
phase: P8
task_id: TPV0096
trace_id: TPV0096-RT-20260907
type: retrospective
mechanism_issues:
  - 平台执行模型：DSH bash 调用不驻留服务 + subagent bash 为 bwrap 隔离，E2E 只能单调用自包含链（INCIDENT 1 次）
  - gate 口径脱节：check-gate.py P2 只认 P1 行首顶格裁剪声明，P1 卡样例却写于 §7 bullet 内，触发 P-1 needs-revision 一轮
  - provenance 预判正则误伤：^\s*- (PASS|FAIL)\b 误中 dispatch-context 格式示例行 2 处，缺示例行豁免机制（模板卡自指）
  - agate-md-field-set 白名单缺口：agent/status 等多阶段通用字段不可写，多轮派发被拒后手写，与「禁止手写 frontmatter」纪律张力
  - 执行器 cap 与声明超时冲突：600s 执行器上限截断 900s 声明链，BDD-3 run2 退出码未逐段显式捕获
  - check-tdd-red exit-code-only 判定：红灯性质需主 Agent 人工比对 debug log 核验
execution_issues:
  - P6 链 1 首跑 runner 传参/工作目录调用错误（verifier 未按 dispatch-context 形态预演，预算 2/2 轮内修正）
  - P6.5 verdict 两处笔误/表述级 DEVIATION（P7 登记，不动摇任何 BDD 判定）
feedback_ready: true
---

# TPV0096 复盘 — E2E 渲染类 spec 自建 entry 化

> 依据：orchestrator-log.md（全程记录）、P8-release.md §7、P7-consistency.md、P2-review.md（P-1/S-1~S-4）、
> 各 P{n}-progress.md 与 .state.yaml。事实以 log 为准。

## 一、事实基线

- **任务周期**：2026-09-05 立项（P0 完成）；同日用户叫停实施（PAUSED，P1 analyst interrupt，无产出落盘）；2026-09-07 用户指令放行，P1 重启续跑；P1-P8 全链于 2026-09-07～09-08 完成（orchestrator-log L7-L9；.state.yaml history paused/resumed 记录）。
- **阶段 commit 链**：98fda6a8(P1) → 5cb65177(P2) → a05e381f(P3) → 13594c9f(P4) → 333f5209(P5) → fb7e6c71(P6) → 04e0456e(P6.5) → f5bc4b6b(P7) → a33663c6(P8, phase=READY)（P7-consistency.md 首节 + orchestrator-log L25-L26）。
- **派发轮次**：subagent 派发约 16 轮（含 P1 analyst 中断后重启、P2 修复轮 analyst/architect/复审三连派），全部带独立 dispatch-context + AGATE_CARD 注入。
- **gate 记录**：P1-P8 gate 全部 PASS（exit code 判定）；评审轮 needs-revision 1 次（P2-review P-1 阻断级）；pre-commit 拦截 1 次（P6 amend 卡片 hash mismatch，重新注入后通过）；P6 环境失败 2 轮均在预算 2/2 内（P6-acceptance.md L19）。
- **验收数据**：BDD 13 条，P6 13/13 PASS、P6.5 judge 13/13、P7 DEVIATION 2（笔误级/表述级）；E2E 三 spec 14 用例双 project 全绿（6+2+6）；单测 1343 passed；P8 后审计 7 预判 reuse_blocked → P5 五键全量重跑 5/5 绿（orchestrator-log L25-L26）。
- **改动面**：代码/文档 4 文件封闭清单（3 spec + docs/process/debug-workflow.md），无产品代码改动，bump_type: none（P7-consistency.md §3.2 git 实证；P8-release.md §1-§3）。
- **技术债**：DEBT0010 翻转 closed（closure criteria 达成 + P5 全量重跑）；新登记 DEBT0011（t022/verify-mermaid 同型缺陷延后立项）、DEBT0012（seed-debug.py 422 预存缺陷）；DEBT0008 部分推进（P8-release.md §4；P7-consistency.md §6）。
- **生产触达**：0（全程 `[PROD_NOT_TOUCHED]`，:8888 隔离环境，每链 debug-stop 还原）。

## 二、做得好的 + 可复用模式

- **单调用自包含执行链**（start → seed → test → stop，`rc=$?; timeout 120s make debug-stop; exit $rc`）在本任务 P5/P6/P8 全量重跑中反复验证可靠——零残留、幂等可重跑、退出码语义完整（P6-acceptance.md L18；orchestrator-log L26）→ 去向：**回馈 agate**（见「## agate 反馈」第 1 条），同时已落项目侧 debug-workflow.md「E2E 编写规范」。
- **分阶段落盘 + progress 底稿**支撑跨暂停续跑：P1 analyst 被中断（无产出）后，P1-progress.md 底稿与 dispatch-context 保持可续跑，重启仅重注入卡片即恢复，零返工（orchestrator-log L7-L9）→ 去向：**回馈 agate**（验证 dispatch-protocol「分阶段落盘」设计在跨 PAUSED 场景同样有效）。
- **verifier 仿真预警**：P6 verifier 派发前对 dispatch-context 自跑预判正则仿真，提前暴露 2 处示例行误伤，主 Agent 复扫补修后才派发——「派发前对机械 gate 做一次仿真」避免了带病产出（orchestrator-log L24）→ 去向：**回馈 agate**（见反馈第 3 条，治本后该手法降级为可选）。
- **三 spec 分键串行 E2E**（P5_e2e/_b/_c 各 900s）使单键始终低于执行器上限，链 2 截断后剩余步骤可拆入下一条链补做，证据不丢弃（P2-review S-2；P6-acceptance.md L18）→ 去向：**回馈 agate**（gate_commands 键粒度与执行器上限的关系应成文）。
- **裁剪/简化的显式声明习惯**：bump_type 显式记 none 并附三处一致的理由（P1§7 = P2§1.2 = P8§1，P7-consistency.md §3.2 实证）→ 去向：**回馈 agate**（P8-release.md §7 Lesson 2 已提炼，协议侧可吸收为 P8 卡样例）。

## 三、发现的问题

> 每条按「现象 → 根因 → 影响 → 改进建议」展开，归因层面均为**机制缺口**；执行错误类条目单列于本节末尾。

### 3.1 平台执行模型：bash 不驻留 + subagent bwrap 隔离

- **现象**：P2 阶段主 Agent 以后台 job 保活 debug :8888 供 architect 做 minimal_validation，job 到期服务下线，architect 验证挂起（INCIDENT，orchestrator-log L14）；随后实测实锤：subagent bash 为 bwrap（`--unshare-pid --die-with-parent`），只可达**本调用进程树内**启动的服务，跨调用保活服务对 subagent 不可达；主 Agent 自身 bash 可达宿主服务（PLATFORM FACT，orchestrator-log L16）。
- **根因**：DSH 平台 bash 调用不驻留进程 + subagent 沙箱按调用隔离；agate 协议的 dispatch-protocol/阶段卡默认环境依赖可持续存在，未定义「服务可达性」能力约束维度。此前项目已有同族教训（TPV0092 P6：后台进程继承工具 fd 致 shell 卡死，AGENTS.md 已禁裸启动后台服务），但「subagent 服务可达性」这一维度至本任务才被实锤。
- **影响**：P2 minimal_validation 中断一次并需人工重启 + 通知补跑；若未在 P2 发现，P5/P6 验收将大面积以「服务不可达」失败重试。发现后转化为派发硬约束（所有 subagent 的 E2E/服务验证一律单调用自包含），P5/P6/P8 重跑零事故。
- **改进建议**：
  - 协议侧：dispatch-protocol.md 增补「服务依赖能力约束」节——凡产出需在线服务的验证，dispatch-context 必须声明单调用自包含链模板（`start; seed; test; rc=$?; stop; exit $rc`），并注明「跨调用保活对 subagent 不可达」的平台前提；P2 卡 minimal_validation 预算按自包含口径设计。
  - 平台侧：将「bash 不驻留 / subagent bwrap 隔离边界 / fd 继承」写入 DSH 平台能力文档与 agent preset，使编排 Agent 派发前可查，而非依赖事故实锤。
  - 项目侧：AGENTS.md「调试流程」节补一行「agent 派发场景的 E2E/服务验证一律单调用自包含」；debug-workflow.md 已落「E2E 编写规范」（BDD-13），与此互补。

### 3.2 gate 口径脱节：check-gate.py P2 与 P1 卡样例的声明位置约定（P2-review P-1）

- **现象**：P1 按卡样例把 design_trivial 简化声明写在 §7 bullet 内；plan-design-review 评审指出 P-1 阻断级——check-gate.py P2 只认 P1 **行首顶格**的 `design_trivial`/`follows_existing_pattern`，现写法机械扫描必 exit 1（orchestrator-log L17；P2-review.md P-1）。
- **根因**：机械扫描口径（行首顶格）与 phase 卡样例示范的位置（节内 bullet）脱节；卡样例是用户实际照抄的权威示范，却不是 gate 认可的形态。
- **影响**：1 轮 needs-revision + 修复轮双派发（analyst 补 P1 顶格声明 + architect 补 P2 §0 指针）+ [BASELINE_CHANGE] 审批 + 同评审者复审——纯位置修正消耗一轮完整评审闭环。
- **改进建议**：
  - 协议侧：二选一对齐——①check-gate.py P2 分支放宽为「顶格行或 P1 卡样例指定节内的显式声明」；②P1 卡样例改为顶格独立行示范并注明「gate 扫描以顶格为准」。同时 check-gate 对「命中关键词但位置不符」给出定向错误信息（当前需评审者人工发现）。
  - 项目侧：无（纯协议问题）。

### 3.3 provenance 预判正则误伤格式示例行（含模板卡自指）

- **现象**：P6-dispatch-context-verifier.md 两处格式示例行——L110 代码栅栏内的 `- PASS BDD-NN: {描述} ({证据路径})`、L274 行内示例 `- PASS BDD-1: … (test-output.log)`——命中 check-p6-provenance 预判正则 `^\s*- (PASS|FAIL)\b`；靠 verifier 仿真预警 + 主 Agent 复扫补修（orchestrator-log L24；P6-dispatch-context-verifier.md L110/L274 实读核对）。
- **根因**：预判扫描不区分「真实 PASS/FAIL 行」与「格式示例行」（尤其 code fence 内容）；且 dispatch-prompt 模板卡自身以行首 `- PASS BDD-NN:` 形态书写示例——模板自指问题：**照模板写出的派发文件必然在 P6 阶段触发误报**。
- **影响**：本任务两处误伤（均在派发前拦截，未污染产出）；机制上每个使用该模板卡的任务都会重复暴露此问题，依赖主 Agent 记得仿真预判。
- **改进建议**：
  - 协议侧：check-p6-provenance.py 预判扫描跳过 code fence 内容；对「示例」类行引入约定（如缩进或显式示例标记）后豁免；dispatch-prompt 模板卡内示例行改用非行首形态，消除自指。
  - 项目侧：本任务 dispatch-context 已修正两处形态，后续任务派发文件可 grep 自检 `^\s*- (PASS|FAIL)\b`。

### 3.4 agate-md-field-set 白名单缺口：多阶段通用字段不可写

- **现象**：全任务至少 6 个阶段产出的 `agent` 字段被工具拒绝写入（P2-progress L34、P3-progress L13、P4-progress L7、P5-progress L16、P7-consistency.md 尾注、P6/P6.5 dispatch-context 预留「被拒则手写」路径）；`status` 终态转移同样被角色白名单拒（P7 尾注：consistency-reviewer 写 approved 被拒后手写）；P8 的 `debt_check`、P1 的 `ui_render_shape`/`ui_ux_dimensions`/`internal_only_reason` 均不在 `--list` 白名单（P8-progress L34；P1-requirements.md L93/L244）。
- **根因**：白名单按阶段产出 schema 设计，未覆盖跨阶段通用字段（agent/status/phase/task_id/parent/trace_id）与部分已在卡内出现的可选字段；agent 禁写是防伪造身份的设计意图，但未提供「校验值等于 dispatch 声明角色」的替代路径。工具未提供写入路径 + dispatch 纪律「禁止手写 frontmatter」+ 卡内预留「被拒则手写」三者并存。
- **影响**：几乎每轮派发都要走一遍「--list → 被拒 → 手写 → progress 留痕」流程，属于常态化的纪律摩擦；「禁止手写」的通配纪律在事实层面已不成立，削弱其对真正误写（如机器计数字段）的约束力。
- **改进建议**：
  - 协议侧：①agate-md-field-set.py 将 phase/task_id/parent/trace_id/agent/status 并入通用可写字段；agent 改为值校验（必须等于 dispatch 声明角色）而非禁写；②status 终态转移白名单由 dispatch-context 显式授权到具体角色；③debt_check（P6/P8）、ui_render_shape/ui_ux_dimensions/internal_only_reason（P1）补入对应阶段 schema——本任务三处均以「写正文独立行」或缺省绕过，绕过路径不应成为惯例。
  - 项目侧：dispatch-context 模板把「哪些字段预期被拒、如何留痕」从口头预留改为固定小节，降低逐轮解释成本。

### 3.5 平台执行器 cap 与声明超时的冲突

- **现象**：P6 链 2 外层声明 900s，被执行器 600s 硬上限 SIGTERM 截断（P6-acceptance.md L18-L19）；BDD-3 run2 的逐 spec 退出码因此未显式捕获，judge 只能以组合证据（playwright 汇总行 + run2 后残留 14/14 = 0 + catchall 0 + debug-stop 目录销毁）判 PASS 并留痕「如需更强证据可补采」（P7-consistency.md §6.3）。同类约束在 P3 已出现过一次：check-tdd-red 包裹执行须提醒 AGATE_TDD_TIMEOUT=600（P2-review S-1，orchestrator-log L17-L18）。
- **根因**：外层声明的 timeout 是软约束，DSH bash 执行器 600s 是硬上限，两者无对齐与预警机制——声明超时不会感知执行器上限，超限即静默截断，截断点落在链中任意步骤。
- **影响**：验收最强证据（逐段退出码）降级为组合推断；截断若落在「stop 之前」将留下残留服务/数据（本任务靠「stop 步骤前移 + 每链必 stop + 残留查询」设计兜住，属防线设计而非机制保障）。
- **改进建议**：
  - 平台侧：执行器 cap 对声明 timeout 预检——声明 > cap 时派发前告警（而非运行中截断）；或提供可声明的长跑后台 job 形态。
  - 协议侧：dispatch/验收卡规定「单链步骤预算 ≤ 执行器 cap − stop 余量」，并将「每步退出码即时落盘（`rc=$?` → 文件）」列为链式执行的标准形态，使截断后已捕获段证据自足；gate_commands 键粒度按此设计（本任务三 spec 分键各 900s 的 S-2 采纳即是有效实践）。
  - 项目侧：无额外动作（P6-acceptance 已按组合证据如实留痕）。

### 3.6 check-tdd-red exit-code-only 判定：红灯性质需人工核验

- **现象**：P3 红灯 gate exit 0（真红灯）后，「红灯是否为预期 fixture 类失败」需主 Agent 另行比对 debug log 才能判定——`/entries/test-mermaid-2` 触发 NotFoundView 资源加载，属死路由 + 死 entry 的预期红灯，而非 A 类测试代码错误（orchestrator-log L19）。
- **根因**：check-tdd-red 只判 exit code，不输出红灯明细摘要（失败测试名/错误类型聚合），协议也未要求 P3 产出附「预期红灯形态」供比对。
- **影响**：红灯性质判定依赖主 Agent 的手动证据链；若误判（把 A 类代码错误当 fixture 红灯放行），P4 将在坏基线上实现。本任务判定正确但成本为人工。
- **改进建议**：
  - 协议侧：check-tdd-red 输出红灯摘要（失败清单 + 错误类聚合）；或在 P3 卡要求 test-designer 声明「预期红灯形态」，主 Agent 比对而非自行推断。
  - 项目侧：无（属协议能力）。

### 3.7 执行错误类条目（归因层面：执行错误）

- **P6 链 1 首跑 runner 传参/工作目录错误**：对 run-e2e-tests.sh 传位置参数且提前 cd frontend-v3 致 runner 内部 cd 失败 exit 1；修正为 repo 根 + `E2E_SPEC` 环境变量后重跑（P6-acceptance.md L19，verifier 自记「调用错误」）。dispatch-context 已给出正确形态，属未按形态预演——纪律问题，非协议缺口。
- **P6.5 verdict 两处笔误/表述级 DEVIATION**：「合计 27」（应为 23）与「4 个代码/文档文件」表述易误读（P7-consistency.md §7，deviation_count: 2，均不动摇判定）。

### 3.8 其他值得沉淀的点

- **seed 基建 422 预存缺陷**：team_id 时序致 3 条 seed 未入库，两次独立观察 + DB 全表真值 + P5 最早记录三方互证，已登记 DEBT0012（P6-acceptance.md L20；P7-consistency.md §6.2）——「环境预存事实如实记录、不混入本次验收面」的处置范式可复用。
- **dispatch-context 编辑落入卡片注入块**：P6 amend 首次被卡片 hash mismatch 拦截（补修 L110 时编辑落入了注入卡片块）——pre-commit 拦截有效，但同时说明对 dispatch-context 的修正应在重新注入规范卡片后进行（orchestrator-log L24）。
- **E2E 断言防御性形态**：容忍集 `[200, 204, 404]` + 其余 throw、创建成功才入队、认证配对结构化防混用（P6 BDD-5，cleanup-assertion.md）——项目资产已沉淀于 3 spec 与 debug-workflow.md 规范，DEBT0008 的 gate 侧缺口仍未关闭。

## 四、改进措施

| # | 措施 | 落点 | 对应问题 |
|---|------|------|---------|
| 1 | 裁剪声明位置口径对齐 + gate 定向报错 | agateon：check-gate.py P2 分支 / phase-cards P1 卡样例 | 3.2 |
| 2 | 预判正则跳过 code fence；模板卡示例行改非行首形态 | agateon：check-p6-provenance.py / dispatch-prompt 模板卡 | 3.3 |
| 3 | 通用字段并入白名单；agent 改值校验；status 授权到角色 | agateon：agate-md-field-set.py + dispatch-protocol.md | 3.4 |
| 4 | 「服务依赖能力约束」节：单调用自包含链范式 + 逐段退出码落盘 | agateon：dispatch-protocol.md + P2/P6 卡 | 3.1 / 3.5 |
| 5 | 执行器 cap 预检告警；长跑后台 job 形态 | DSH 平台侧（bash 执行器/沙箱文档） | 3.5 / 3.1 |
| 6 | check-tdd-red 红灯摘要输出或「预期红灯形态」声明 | agateon：check-tdd-red.py / P3 卡 | 3.6 |
| 7 | AGENTS.md 补「派发场景服务验证一律自包含」条目 | 项目：AGENTS.md 调试流程节（debug-workflow.md 规范已落盘） | 3.1 |
| 8 | DEBT0011/0012 单独立项跟进 | 项目：agate-workspace/debt/tech-debt.md（已登记，open） | 3.8 |

## 技术债登记核对清单

| 机制 | 应该触发？ | 实际触发？ | 未触发后果 | 原因 |
|------|-----------|-----------|-----------|------|
| retry 记录 | 是 | ✅ | — | P2 修复轮重派、P6 环境 2/2 预算内重试均留痕 |
| PAUSED | 是 | ✅ | — | 2026-09-05 用户叫停，.state.yaml paused/resumed 完整 |
| PROD_TOUCHED | 否 | — | — | 全程 [PROD_NOT_TOUCHED] |
| SCOPE+ | 是 | ✅ | — | P1 死选择器迁移等 4 项增补（orchestrator-log L10-L11） |
| SCOPE_RESOLVED | 是 | ✅ | — | P1 L61 闭环标记，P7 §2 五环链逐环可追溯 |
| DESIGN_GAP | 否 | — | — | P4 否定式声明，0 = 0 配对空集（P7 §1） |
| DESIGN_GAP_REVIEWED | 否 | — | — | 同上，无正式声明可转抄 |
| NEED_CONFIRM | 否 | — | — | P1 无 NEED_CONFIRM（4 条 SUGGEST 均已处置） |
| CAPABILITY_GAP | 否 | — | — | subagent 服务可达性缺口有补充路径（自包含链），未达「无补充路径」阈值；该维度本身已沉淀为 3.1 机制发现 |
| gate 验证（每阶段） | 是 | ✅ | — | 各阶段 GATE PASS 均 exit code 判定（log L12/L18-L26） |
| 阶段产出文件（每阶段） | 是 | ✅ | — | P1-P8 + P6.5 产出与证据目录齐全 |
| .state.yaml phase 同步 | 是 | ✅ | — | P6 amend 并入、P8 a33663c6 phase=READY |
| 裁剪条件 + override | 是 | ✅ | — | design_trivial 顶格声明（P-1 修复后）；[BASELINE_CHANGE] 主 Agent 批准 |
| capability_requirements | 是 | ✅ | — | P1 frontmatter domains/risk 声明 + 能力约束逐轮写入 dispatch-context |
| 分阶段落盘（防 subagent 空返回） | 是 | ✅ | — | 跨 PAUSED 续跑零返工（P1-progress 底稿复用） |
| phase-产出一致性 | 是 | ✅ | — | P6 amend 卡片 hash mismatch 被拦后重注入通过，拦截机制有效 |
| P6 evidence（含截图 + 引用 + vision YAML） | 是 | ✅ | — | evidence gate exit 0；截图 4 张 + 日志/JSON 证据；vision YAML 未用（量化断言转录属 dispatch 允许形态） |
| P2 候选方案 + 权衡（≥2） | 是（简化分支） | ✅ | — | design_trivial 1 候选，声明落位后 gate 通过 |
| P8 internal_only_reason | 否 | — | — | 未启用 internal_only（P1-requirements.md L244） |
| dispatch-context.md | 是 | ✅ | — | 每角色独立文件约 12 份，含平台执行约束预置 |
| pre-commit hook（gate / 状态转移 / 裁剪） | 是 | ✅ | — | 1 次有效拦截（卡片 hash mismatch） |
| CI backstop | 否 | — | — | 本任务 commit 均在本地推进，未触发 push 场景 |
| **技术债登记** | 是 | ✅ | DEBT0011 / DEBT0012（新登记）+ DEBT0010 翻转 closed + DEBT0008 推进（P7 §6、P8 §4） | — |

## agate 反馈

> 归因到 agate 机制层面、可脱离项目上下文反馈的条目：

1. **单调用自包含执行范式**应作为 dispatch-protocol 的标准能力约束沉淀：跨调用保活服务对沙箱化 subagent 不可达是普遍平台形态，产出需在线服务的验证必须 start/seed/test/stop 同调用完成，且每步退出码即时落盘。
2. **机械 gate 与 phase 卡样例的位置口径**需要单一真相源：gate 只认某形态时，卡样例必须示范同形态，或 gate 放宽到卡样例认可的位置；并给「命中关键词但位置不符」的定向报错。
3. **产出/派发文件的机械预判扫描应豁免示例行**：至少跳过 code fence 内容；模板卡内自带的格式示例不应必然触发下游 gate 误报（模板自指）。
4. **frontmatter 字段白名单**应覆盖跨阶段通用字段（agent/status/phase/task_id/parent/trace_id）；防伪造身份宜用「值等于 dispatch 声明」校验而非禁写；各卡出现过的可选字段（如 debt_check、裁剪相关可选字段）应进入对应阶段 schema，避免「被拒后手写」成为常态路径。
5. **声明超时应感知执行环境硬上限**：外层 timeout 超过执行器 cap 时应预检告警；gate_commands 键粒度设计应给出「单键预算 ≤ cap − 清理余量」的成文指引。
6. **红灯 gate 建议输出红灯性质摘要**（失败清单/错误类聚合），或将「预期红灯形态」声明纳入测试设计产出，减少 exit-code-only 判定下的人工证据链。
