---
phase: P3
task_id: TPV0093-star-lifecycle
type: test-cases
parent: P2-design.md
trace_id: TPV0093-P3-20260816-backend
status: ready
---

# P3 派发上下文 — test-designer（backend 包）

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

## 目标

为 TPV0093 star-lifecycle **backend 包**（`backend/peekview/`）设计 TDD 测试：覆盖 P1 中后端可测的 BDD（星标 API/生命周期/权限/迁移），测试代码当前必须红灯（实现未写）。

## 上游关联

- `P1-requirements.md`（28 BDD，其中后端可测：BDD-1/2/3/4/5/7/8/9/10/11/12/13/15/16/17/27/28）
- `P2-design.md`（§3 数据模型 / §4 服务层 / §4.6 API 契约 / §5 迁移与 backfill / §7 BDD 覆盖映射）
- 本包只写 backend 测试；frontend 测试由另一个 test-designer 并行负责（API 契约已冻结，两包解耦）

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0093-star-lifecycle/P1-requirements.md`
2. `agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`
3. `agate-workspace/tasks/TPV0093-star-lifecycle/P0-brief.md`
4. 现有测试模式（新测试遵循既有约定）：
   - `backend/tests/conftest.py`（autouse 隔离到 tmp_path）
   - `backend/tests/factories.py`（测试数据构建器）
   - `backend/tests/test_api_entries.py` / `test_admin_cleanup.py`（API/清理测试模式）
   - `backend/peekview/database.py`（迁移/backfill 测试模式：FTS backfill 已有测试）

## 约束

- 只写 `backend/tests/` 目录下的测试文件，不写 frontend 测试
- **不修改任何源码**（models.py/services/api 均不动——TDD：测试先写，实现留给 P4）
- 环境隔离：测试由 conftest autouse 隔离到 tmp_path；不触碰生产 :8080 / ~/.peekview/
- 新测试文件命名：`test_star_api.py` / `test_star_lifecycle.py` / `test_star_migration.py`（或按需拆分），不覆盖既有测试文件
- **已有测试必须保持绿**（新增测试不能破坏现有 suite）
- vitest mock hoisting 反模式不适用（backend 是 pytest），但注意 freezegun 用法

## 测试覆盖要点（后端）

- **BDD-1/2/3/4/5**：star/unstar API（计数 ±1、重复已存在、匿名拒绝、多用户各计 1、部分唯一索引防并发重复）
- **BDD-7/8/9/10**：cleanup 豁免——有星标不删、有效期内星标归档后豁免、取消星标恢复缓冲（freezegun 推进时间）、最后星标取消剩余≤0 下周期删
- **BDD-11/12/13**：作者删除强制覆盖 + 有星标建墓碑（reason=author_deleted）+ 墓碑随最后引用移除清理；star 行绑定 tombstone_id；ownerless 删除路径
- **BDD-15/16/17**：archived 读取权限——星标用户 200（详情/raw/文件三处）、非星标 404（防枚举）、owner/admin 200；**公开→星标→转私有→归档链路**（BLOCKER-1）；**ownerless archived 匿名 404**（BLOCKER-4）
- **BDD-27**：backfill 迁移——存量 archived 从上线日起算 + 幂等（跑两次结果一致）；**存量库 user_version=2 → 升级 → backfill 生效且 user_version 仍 2**（BLOCKER-3 回归锚）
- **BDD-28**：share 通道独立授权——archived 持有效 share 仍 200（回归保护）
- **BLOCKER-2 用例**：非 owner 对私有/archived slug 星标 → 404；未知 slug → 404（防 slug 探测）
- **N7 用例**：并发重复星标 → IntegrityError 捕获 → 幂等响应非 500
- **N9 用例**：转私有后取消星标仍 200

## 产出

- `agate-workspace/tasks/TPV0093-star-lifecycle/P3-test-cases.md`（含 `test_code_dir` 声明，backend 部分）
- `agate-workspace/tasks/TPV0093-star-lifecycle/P3-test-code/backend/`（测试代码；注意这是任务目录，测试运行需引用 backend 测试实际位置——如不能运行，可在声明中说明测试代码位置与运行方式）

⚠️ 路径是硬约束：产出文件必须写入上述任务目录，不得写 /tmp 或其他位置。

## 门槛

- 测试名引用 BDD 编号（如 `test_bdd_1_...`）；每条后端可测 BDD 有对应用例
- 测试代码能运行且当前红灯（未实现导致的失败）；**已有测试保持绿**
- P3-test-cases.md 声明 `test_code_dir`
- 返回：N 个测试用例，当前全部红灯
