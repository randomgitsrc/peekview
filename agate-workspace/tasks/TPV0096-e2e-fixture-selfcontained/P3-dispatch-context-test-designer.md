# P3-dispatch-context-test-designer — TPV0096

---
phase: P3
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0096
role: test-designer
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。

**创建型测试清理钩子（强制要求）**：测试含创建资源用例（建团队/条目等）时，须声明清理钩子要求——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；验收环境残留由清理钩子与 post-test 残留检查共同兜底（见 P6 卡）。

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.py 确认红灯
3. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P3，不要提前写 P4——phase = 本 commit 的产出阶段
4. git commit -m "wf({Txxx}-P3): {摘要}"（phase=P3，P3 产出含 P3-test-cases.md + 测试代码）
5. P3 commit 完成后进入 P4：**phase 推进 P4 随 P4 产出 commit 一起**（P4-implementation.md 就绪后），不是单独 phase commit

## refactor 任务：回归测试口径

> 适用：P1 frontmatter 声明 `change_type: refactor` 的任务（P2-design.md §3.4）。功能任务（缺省）走上方既有 TDD 口径，不受本节影响。

refactor 任务无新增功能行为可断言，P3 测试设计改用**回归测试口径**：

- **测试设计 = 回归测试口径**：复用/保留既有测试用例，标注每条回归用例覆盖了重构涉及的哪些文件/路径；**不新增功能行为断言**（无新行为可断言）。
- **跳过 check-tdd-red 红灯步骤**：重构无新功能断言，测试套件本就全绿，红灯语义不适用（check-tdd-red 对 refactor 任务会误报 exit 2 绿灯）。回归质量由 P5 全量回归（gate_commands.P5）+ P6 的 `regression.log`（全量回归重跑）兜底。CI backstop 对 refactor 任务同样跳过 check-tdd-red（ci-gate-backstop.py P3 分支 refactor 感知）。
- **P3 gate 不变**：仍为文件存在性检查——refactor 的 P3 产出是 P3-test-cases.md（回归口径声明 + 既有用例覆盖映射），文件存在即满足 gate。

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

**check-gate.py P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.py 独立确认）

**check-tdd-red.py**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.py $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.py 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据（本阶段特定）：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.py exit 0（真红灯确认）
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

## 目标

产出 P3-test-cases.md：把 P1 的 13 条 BDD 1:1 映射为测试用例设计（落到 3 个被改造 spec 的具体 test 结构 + 清理钩子声明），声明 test_code_dir，并给出 BDD-6/7/8 静态检查的机械判据。**本任务的测试代码即 P4 的实现对象**（改造后的 3 个 spec）——P3 只做用例设计落盘，不写 spec 代码（避免 P4 空转）。

## 约束

- 每条 `#### BDD-NN`（BDD-1~13）至少对应一个测试用例或验收动作；映射表 1:1 不挑验
- 测试代码目录声明 `test_code_dir: frontend-v3/e2e`（P4 改造产物的落点；P3 不新建目录）
- 清理钩子要求（P3 卡强制节）：创建型用例必须「创建即入队、afterEach 无条件删除、[200,204,404] 容忍、其余失败显式 FAIL」——P2 §2.1 四件套已定稿，用例设计须逐 spec 标注清理钩子归属
- 静态检查判据（BDD-6/7/8）写成可 grep 的机械口径（P2 §2.5 已给基础，你细化为 P6 可直接执行的命令级判据）
- BDD-9 双 project 口径与 BDD-12 基线对照（svg-inline-render / render-regression t085 既有 flaky bdd_4↔5 互换不计新失败）须在用例设计中明确验收动作归属（P5/P6）
- 不写任何 spec 代码、不改任何文件（P3-test-cases.md 之外零产出）；红灯确认由主 Agent 亲自跑（见「红灯语义」）
- 不启动服务、不跑测试；任意 bash 命令外层 timeout 60s
- 子派发能力：不启用

## 红灯语义（P2 评审已定案，写入用例设计文档的「红灯基线」节）

- 红灯命令 = gate_commands.P3 = `E2E_SPEC=e2e/mermaid.spec.ts make debug-test`，跑在**改造前代码**上：现状 spec 引用不存在的 test-mermaid-2 + 死选择器 + 死 goto，对干净 debug 环境必红灯（fixture/404/断言失败类）。
- 主 Agent 将亲自执行 check-tdd-red.py（AGATE_TDD_TIMEOUT=600，自包含环境）确认 exit 0（真红灯），结果引用进 P3-test-cases.md 的红灯基线节由主 Agent 回填——你只需在文档中预留该节结构与引用位。

## 上游关联

- P2-design.md M1-M3 逐行改动表（你的用例设计必须与改动表对账——每个迁移后的 test 断言对应 M 表行）+ §2.4 slug 定稿（e2e-<spec>-<case>-<project>，14 slug 上限）+ §2.2 fixture 内容定稿（每 test 独立 flowchart 内容块）
- P2-review approved（含 §1 实证锚点表，可直接复用——选择器行号/先例行号已核实）
- P1 13 BDD 是唯一验收源；BDD-13 对应 M4 文档节（用例 = 文档存在性 + 两条规则内容核对）

## 输入文件

- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P1-requirements.md（13 BDD）
- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P2-design.md（M1-M3 表 + §2 定稿 + §6 gate_commands）
- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P2-review.md（§1 实证锚点表）
- frontend-v3/e2e/mermaid.spec.ts / mermaid-check.spec.ts / mermaid-visual.spec.ts（现状结构——设计「改造后 test 结构」时对照）
- /home/kity/oclab/agateon/agate/assets/execution-roles/test-designer.md（角色定义）

## 产出文件字段

frontmatter 已知值：phase: P3 / task_id: TPV0096 / parent: P2-design.md / trace_id: TPV0096-P3-20260907 / agent: test-designer / status: draft。用 `FILE=<产出路径> python3 /home/kity/oclab/agateon/agate/scripts/agate-md-field-set.py --list` 查看后逐个写入，不要手写 frontmatter；产出前跑 check-frontmatter.py 自检。

正文必备：`test_code_dir:` 声明 → 13 BDD 1:1 用例映射表（用例名/spec/test 标题/断言要点/清理钩子/关联 M 行）→ 红灯基线节（预留主 Agent check-tdd-red 引用位）→ BDD-6/7/8 静态检查机械判据 → BDD-9/BDD-12 验收动作归属说明。
