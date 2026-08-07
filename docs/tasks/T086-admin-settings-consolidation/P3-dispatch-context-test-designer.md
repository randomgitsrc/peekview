---
phase: P3
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: test-designer
trace_id: T086-P3-20260807
created: 2026-08-07
---

# P3 派发指引 — test-designer

## 目标

为 T086 的 17 条 BDD（P1-requirements.md）设计测试，覆盖 P2-design.md 方案一的实现（tab computed 化 + 三处统一 isAdmin 判断 + UserManagerTab 迁移 + UserMenu 动态落地 tab）。本任务是**修改现有测试文件**（不是新建）：`frontend-v3/e2e/admin.spec.ts`（迁移 8 个既有场景 + 新增 BDD-11/12）+ `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`（原地重写，测路由级 guard 改为测 tab 级回退逻辑）。

## 约束

- **1:1 映射**：P1 的 17 条 BDD 每条对应至少一个测试用例，测试名引用 BDD 编号
- **ui_affected: true**，必须有 Playwright/E2E 用例覆盖每个交互点（P2-design.md §5 已列出需 E2E 覆盖的交互点清单）
- **关键风险点（P2-review.md Advisory Note #1，必须处理）**：`UserManagerTab` 会在 `SettingsView.vue` 中被桌面 `tab-content`（`v-else-if`）与移动端 `mobile-stacked`（`v-if="isAdmin"`）同时挂载两份，`data-testid="admin-user-row"` 等选择器会匹配到 2 倍数量的 DOM 节点。迁移 `e2e/admin.spec.ts` 中含 `count()`/`toHaveCount` 类断言的用例（至少 BDD-01）时，**必须**比照代码库已有先例 `frontend-v3/e2e/raw-api.spec.ts:38` 的写法，用 `.desktop-only`/`.mobile-only` 父容器限定选择器范围，不能直接照抄原 `/admin` 独立路由下的选择器（那时只有单实例挂载，count 语义不同）
- **vitest mock hoisting 反模式**（T079 教训，见 test-designer.md 角色文件）：重写 `t080-admin-route-guard.test.ts` 时若用 `vi.mock()`，回调只能用字符串字面量，不能引用外部变量，否则 P3 阶段会被放行成 B 类红灯但 P4 才暴露 A 类错误
- 5 个既有 `it()`（`test_bdd_14`/`14b`/`15`/`15b`/`15c`）的迁移映射，P2-design.md §3.6 已给出方向：`test_bdd_14`→BDD-6（非 admin 回退 profile）、`test_bdd_14b`→BDD-4 反面验证（admin 能拿到该 tab）、`test_bdd_15`/`15b`/`15c` 的时序测试处理方式，若发现无处可迁移可标 `[DESIGN_GAP: ...]`（P4 会审查，P7 会转抄+配对 REVIEWED），不要强行编造迁移
- P3 gate 要求真红灯：当前实现还未改（router.ts 仍有 /admin 路由，SettingsView 无 user-manager tab），迁移后的 admin.spec.ts 和重写后的 t080 测试运行应该失败（因为被测功能还不存在），这是正常的红灯，不要因为"测试写完发现全红"就以为写错了

## 上游关联

parent: P2-design.md（架构方案，已 approved）
祖先: P1-requirements.md（17 条 BDD）、P1-review.md（Advisory Note）、P2-review.md（Advisory Note #1：双挂载 count 断言风险）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`（17 条 BDD，第 3 节）
2. `docs/tasks/T086-admin-settings-consolidation/P2-design.md`（方案设计，§3.5/3.6 是测试迁移的直接依据，§4 UI 测试标识清单）
3. `docs/tasks/T086-admin-settings-consolidation/P2-review.md`（Advisory Note #1 双挂载风险 + #2 可访问性现状缺口记录建议）
4. `frontend-v3/e2e/admin.spec.ts`（待修改，8 个既有 test()）
5. `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`（待重写，5 个 it()）
6. `frontend-v3/e2e/raw-api.spec.ts:30-45`（`.desktop-only`/`.mobile-only` 限定选择器的先例写法）
7. `frontend-v3/e2e/helpers`（若存在，`adminLogin()` 等 helper 函数定义，供新用例复用）

## 客观查证信息（已由 P1/P2 核实，直接引用不需重新验证）

- e2e/admin.spec.ts 当前实际是 8 个 test() 调用点（desktop+mobile 两个 viewport 循环运行 6 个：BDD-01/02/06/12/20/21；独立运行 2 个：BDD-14/15）
- t080-admin-route-guard.test.ts 当前实际是 5 个 it()，自建 mock router，不依赖真实 router.ts
- gate_commands（P2 已固化）：`P3: cd frontend-v3 && npx vitest run src/__tests__/t080-admin-route-guard.test.ts`（P3_formatter: vitest.sh）；`P5_e2e: E2E_SPEC=e2e/admin.spec.ts make debug-test`

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
