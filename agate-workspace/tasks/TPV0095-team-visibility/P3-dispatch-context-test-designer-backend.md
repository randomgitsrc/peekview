---
phase: P3
task_id: TPV0095
type: test-cases
parent: P2-design.md
trace_id: TPV0095-P3-test-designer-backend-20260902
status: draft
agent: test-designer
---

# P3 派发上下文 — test-designer（backend 批，TPV0095 team-visibility）

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

<dispatch_guide>

### 目标

为 TPV0095 **backend 域**写 TDD 测试（红灯）：迁移/模型（BDD-16/17/19/20）、权限矩阵（BDD-1~6）、防枚举（BDD-7~9）、share（BDD-10~12）、star（BDD-13/14）、校验契约（BDD-18/21/22/27/29/30）、竞态（BDD-23/24）、回归（BDD-25）、API 契约（BDD-28）、CLI（BDD-31~34）、EXPLAIN（BDD-26）。产出 P3-test-cases-backend.md（片段）+ 后端测试代码。

### 约束

1. **输入权威**：P1-requirements.md（44 BDD）+ P2-design.md（方案 A：team_membership.py 薄模块 / entry_service can_read / share_service 403→404 / get_entry_by_api_key / CLI --user/--team / ParameterValidationError 422）。
2. **1:1 映射**：每条 `#### BDD-NN` → 至少一个测试用例（测试名引用 BDD 编号如 `test_bdd_1_...`）。权限矩阵（BDD-2/5）需 actor×7 路径逐格用例。
3. **test_code_dir**：后端测试写 `backend/tests/` 下**新建文件**（如 `test_team_visibility.py` / `test_teams_api.py` / `test_team_migration.py`），不混入既有文件（避免污染）。可复用 conftest/factories 现有 fixture 模式（先读现有测试了解 fixture 命名：auth_headers 类、用户构造、client fixture）。
4. **BDD-26 EXPLAIN**：pytest 内嵌 EXPLAIN QUERY PLAN 断言（P2 §3.5）。
5. **BDD-16/17 迁移**：旧库升级双启动用例（参照 `_create_entries_without_owner_id` 同款手法造旧库）；全新库 FK 行为（删 team/删 user CASCADE/SET NULL）。
6. **CLI（BDD-31~34）**：本地模式 `--user` 锚（P1 BDD-31~33 [BASELINE_CHANGE] 已批准）；`--team` 与 `--visibility public` 互斥 fail fast；远程透传 team_id（可参照 test_cli_remote.py 或 mock PeekClient）。注意 CLI 现状测试在 test_cli.py（isolated_fs fixture）。
7. **红灯要求**：写完测试自跑确认红灯失败原因是"被测模块未实现"（import 失败/函数不存在/断言与未实现行为不符 = B 类）。若红灯是"断言与测试数据矛盾"（A 类）→ 先修断言再交付。**不要写实现代码**。
8. **环境隔离**：只写测试文件 + P3-progress.md + P3-test-cases-backend.md；禁碰生产 :8080 / ~/.peekview/。bash timeout。
9. **vitest/前端/MCP 测试由其他批的 test-designer 负责**——backend 批不写。

### 上游关联

- P1：44 BDD（backend 域 BDD-1~34 中后端部分）
- P2：方案 A 锁定（can_read_entry 7 路径收敛 / team_membership.py / share 403→404 / star 补 team / CLI --user/--team / ParameterValidationError(422)）

### 输入文件

1. `P1-requirements.md`（44 BDD）
2. `P2-design.md`（方案 A + §3 后端设计 + §11 实现完成标志）
3. `P0-brief.md`
4. 现有测试参照（backend/tests/conftest.py / factories.py / test_entry_service.py / test_cli.py / test_database.py）

### 产出

- `P3-test-cases-backend.md`（本批用例清单片段：BDD 编号映射 + test_code_dir + 红灯确认；**主 Agent 合并为 P3-test-cases.md**）
- backend/tests/test_team_*.py（新建测试文件，红灯）

### 返回

两行：① 本批测试文件路径清单；② 摘要（用例数/覆盖 BDD 范围/红灯确认，≤40 字）。
</dispatch_guide>
