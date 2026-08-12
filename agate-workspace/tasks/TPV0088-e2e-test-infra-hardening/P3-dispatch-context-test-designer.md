# P3 Dispatch Context — test-designer

## 任务目标

为 TPV0088（e2e-test-infra-hardening）产出 TDD 测试：子任务 B（shell 校验逻辑）的测试设计 + 测试代码；子任务 A（viewer.spec.ts 修复）不适用传统 TDD 红灯（测试代码本身），验收锚点 = BDD-1 的 19/19 实跑（P6）。

## 上游关联

- 输入文件（必读）：
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P0-brief.md`（环境约束 + 代码审计）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-requirements.md`（9 BDD + IMPL-S/D/B）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P2-design.md`（批准的方案，含 Check 6 设计 + --test-mtime 自检模式）
  - `AGENTS.md`（项目约定）
  - `scripts/e2e-safety-check.sh`（子任务 B 被修文件——P3 测试设计时它还没有 Check 6）
  - `Makefile:540-650`（debug-build/debug-test）

## 已确认事实（P1/P2 结论，直接采用）

1. **子任务 B**（P3 走真 TDD 红灯）：
   - Check 6 逻辑：`find "$src_dir" -type f -newer "$static_index"` 有输出即判过期；static 缺失先判 `[ -f ]`；函数 `check_static_freshness` 定义在脚本顶部（自检块之前）
   - `--test-mtime` 自检模式：可独立测试（临时 fixture + env 注入，无需 debug backend）
   - 两个 fixture 场景：旧 static + 新 src（应拦截）、新 static + 旧 src（应放行）
2. **子任务 A**：viewer.spec.ts 19 用例修复（路由/slug/死选择器/数据依赖）——**不适用传统 TDD**，P3 不写红灯测试（修复本身是测试代码），验收锚点 = P6 实跑 19/19

## 约束

- **P3 只做子任务 B 的 TDD**：写 `--test-mtime` 的测试 fixture + 断言脚本（当前 e2e-safety-check.sh 无 Check 6 → 测试应红灯）
- 测试代码放 `P3-test-code/`（如 `test-mtime.sh` 或文档化的测试用例）
- 子任务 A 在 P3 只需在 P3-test-cases.md 中列出修复清单（不写红灯测试）
- 禁止触碰生产 :8080 / ~/.peekview/
- 测试命名引用 BDD 编号

## gate_commands（P2 已固化，P3 用）

```yaml
gate_commands:
  P3: "bash scripts/e2e-safety-check.sh --test-mtime"
  P5: "make test-quick"
  P5_typecheck: "make typecheck"
  P5_e2e: "E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  project_module: ""
```

## 输入文件列表（按序读取，每读完一个追加 P3-progress.md）

1. `docs/tasks/TPV0088-e2e-test-infra-hardening/P2-design.md`
2. `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-requirements.md`
3. `scripts/e2e-safety-check.sh`
4. `AGENTS.md`

## 产出要求

1. `docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-cases.md`
   - 声明 `test_code_dir: {路径}`
   - 子任务 B：Check 6 的测试用例（对应 BDD-6/7/8 的 shell 级验证）
   - 子任务 A：19 用例修复清单（对应 BDD-1~5，标注每用例的修复点）
2. 测试代码：`P3-test-code/`（子任务 B 的 --test-mtime 测试 fixture/脚本）

文件 Header（直接复制）：
---
phase: P3
task_id: TPV0088-e2e-test-infra-hardening
type: test-cases
parent: P2-design.md
trace_id: TPV0088-P3-20260812
status: draft
created: 2026-08-12
agent: test-designer
---

## 返回给主 Agent

两行：产出文件路径 + 一句话摘要（N 个测试用例，当前红灯状态，不超过 30 字）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。
1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.sh 确认红灯
3. 更新 .state.yaml phase=P3 → P4
4. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
5. git commit -m "wf({Txxx}-P3): {摘要}"

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 不可裁剪）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则

**check-gate.sh P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.sh 独立确认）

**check-tdd-red.sh**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.sh 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.sh exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在

## 常见错误

1. **测试绿了才 commit**：测试已在 P4 之前通过 → 违反 TDD"测试先于实现"原则。P3 的 gate 要求红灯
2. **忘记声明 test_code_dir**：后续阶段找不到测试代码 → P5 跑 gate_commands 时找不到测试路径
3. **测试覆盖不全**：只为部分 BDD 写了测试 → P6 验收时那些 BDD 没有自动化验证
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。
5. **只覆盖交互路径，忽略前置状态**：测试设计应覆盖 BDD Given 隐含的前置状态，不只覆盖 When/Then 路径（详见 WORKFLOW.md §P3 测试设计指导）

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态：debug backend :8888 当前未运行（P6 需启动）；CDP Chrome :18800 可用
- 关键标识：e2e-safety-check.sh（现有 Check 1-5，P3 测试设计针对待加 Check 6）；viewer.spec.ts（19 用例待修复）
- 查证结果：P2 方案已 approved（Check 6 -type f + [ -f ] 防护 + --test-mtime 自检模式）
</objective_info>
