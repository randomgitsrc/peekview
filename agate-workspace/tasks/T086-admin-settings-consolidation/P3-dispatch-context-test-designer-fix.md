---
phase: P3
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: test-designer
trace_id: T086-P3-20260807-fix
created: 2026-08-07
---

# P3 派发指引 — test-designer（定向修复，PAUSED 恢复后）

## 目标

`docs/tasks/T086-admin-settings-consolidation/PAUSED-resolution.md` 记录的人工批准决策：修复 `frontend-v3/e2e/admin.spec.ts:276`（T086 BDD-11）的选择器缺陷——`[data-testid="user-manager-content"]` 未加视口 scope，撞上 `SettingsView.vue` 桌面/移动双渲染的已知模式（同文件 BDD-01/02 已用 `scopeOf(vp.name)` 消歧过同一模式）。

## 约束（严格遵守，本次是极小范围的定向修复，不是重新设计）

- **只改一行**：`admin.spec.ts:276`
  ```ts
  // 现状（有 bug）：
  await expect(page.locator('[data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
  ```
  改为加 `.desktop-only` scope 前缀（BDD-11 测试用例在第 270 行已显式 `page.setViewportSize({ width: 1280, height: 800 })`，固定跑桌面视口，不经过 `scopeOf(vp.name)` 循环，所以直接写死 `.desktop-only` 前缀即可，不需要引入 `scopeOf()`）：
  ```ts
  await expect(page.locator('.desktop-only [data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
  ```
- **不改** BDD-12（`admin.spec.ts:279-292`）——已核查它不查询 `[data-testid="user-manager-content"]`，本身没有选择器缺陷，之前只是因为同 describe 内 BDD-11 失败被 serial 级联跳过，不需要改动
- **不改**任何其他行、任何其他文件（不碰 `SettingsView.vue`/`UserManagerTab.vue`/产品代码，本次问题纯粹是测试选择器）
- **不需要重新走 TDD 红灯流程**：这是对已通过验收设计、已在 P4 实现完成后才暴露的测试代码缺陷做订正，不是新功能测试设计，不产生新 BDD，不改变验收语义（BDD-11 要验证的行为——"admin 能通过 UserMenu 到达 user-manager tab"——完全不变，只是选择器现在精确定位到当前可见的那一份 DOM，不再因双渲染产生歧义）
- 修复后自跑验证（不需要 debug backend，只需确认语法正确）：`cd frontend-v3 && npx playwright test --list e2e/admin.spec.ts` 确认解析无语法错误

## 上游关联

parent: PAUSED-resolution.md（人工批准的修复决策）
祖先: P5-gate-diagnosis-2.md（根因分析）、P5-test-results/e2e.md（本轮全量重跑发现该失败的原始记录）

## 输入文件

1. `docs/tasks/T086-admin-settings-consolidation/PAUSED-resolution.md`（必读，修复决策和范围）
2. `docs/tasks/T086-admin-settings-consolidation/P5-gate-diagnosis-2.md`（根因分析）
3. `frontend-v3/e2e/admin.spec.ts`（待修补文件，第 76-95 行附近有 `scopeOf()` 定义可参考写法，第 269-277 行是待修复的 BDD-11 用例）

## 客观查证信息

- `scopeOf()` helper 定义在 `admin.spec.ts:82` 附近，用于 viewport 循环内的用例（BDD-01/02/06/12/20/21）
- BDD-11/12 不在 viewport 循环内，是独立 `test()`，显式 `setViewportSize(1280, 800)` 固定桌面视口，因此修复不需要引入 `scopeOf()`，直接写 `.desktop-only` 字面量前缀即可
- BDD-12（`admin.spec.ts:279`）已核查不查询 `user-manager-content`，无需改动

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
