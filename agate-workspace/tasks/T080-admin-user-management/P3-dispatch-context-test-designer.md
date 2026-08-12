# P3 dispatch-context: test-designer

## 目标

为 24 条 BDD 设计测试用例（1:1 映射），产出 P3-test-cases.md + 测试代码。测试当前必须失败（红灯，实现未写）。覆盖后端 pytest + 前端 vitest + Playwright E2E。

## 约束

- TDD：测试先于实现，当前全部红灯（assertion 失败或 B 类 import 失败，非 A 类 syntax/import 错误）
- 每条 BDD-NN 对应一个测试用例，测试名引用 BDD 编号（如 `test_bdd_01_admin_sees_user_list_paginated`）
- UI 任务（ui_affected=true）：必须含 Playwright/E2E 用例覆盖每个交互点
- Playwright 多 viewport：desktop 1280x800 + mobile 390x844，截图存 docs/tasks/T080-admin-user-management/evidences/
- 后端测试用 pytest（backend/tests/），前端单测用 vitest（frontend-v3/src/ 或 tests/），E2E 用 Playwright（frontend-v3/e2e/）
- vitest mock 用字符串字面量，不引用外部变量（T079 教训）
- 严禁触碰生产环境（:8080 / ~/.peekview/），E2E 用 :8888（make debug）
- gate_commands.P3 = make test-quick（后端 pytest）

## 上游关联

- P1-requirements.md：24 条 BDD（BDD-01..24）
- P2-design.md：候选方案 A（独立 POST 端点）+ files_to_read + ui_affected=true + gate_commands
- 现有测试模式：backend/tests/（factories.py 构建器 + conftest autouse 隔离）、frontend-v3/src/（vitest + jsdom）、frontend-v3/e2e/（Playwright CDP）

## 输入文件

1. `docs/tasks/T080-admin-user-management/P1-requirements.md` — 24 BDD
2. `docs/tasks/T080-admin-user-management/P2-design.md` — 方案设计 + files_to_read + ui_interaction_points
3. `docs/tasks/T080-admin-user-management/P0-brief.md` — 环境约束
4. `backend/tests/conftest.py` — pytest 隔离模式 + autouse
5. `backend/tests/factories.py` — 测试数据构建器
6. `backend/tests/test_admin.py` — 现有 admin 测试（参照模式，list_users/delete_user/reset_password 已有测试）
7. `backend/tests/test_auth.py` — delete_self / LastAdmin 现有测试（参照模式）
8. `frontend-v3/src/stores/auth.ts` — isAdmin + authState（前端单测 mock）
9. `frontend-v3/e2e/` — 现有 Playwright E2E 模式（参照一个 spec 看结构）
10. `frontend-v3/playwright.config.ts` — Playwright 配置（确认 viewport project 模式）

## 客观查证信息

- 24 BDD 分类：
  - 后端 API 测试（pytest）：BDD-03/04/05/07/08/09/10/11/12/13/16/22/23（API 行为 + LastAdmin + 自操作 + 级联）
  - CLI 测试（pytest 或 subprocess）：BDD-17/18/19/24（CLI disable/enable/demote LastAdmin）
  - 前端单测（vitest）：路由守卫逻辑 BDD-14/15（beforeEach + isAdmin 判断）
  - Playwright E2E：BDD-01/02/06/20/21（列表渲染 + 状态标记 + 自操作 UI 反馈）+ BDD-12（PasswordResetDialog）
- 现有 test_admin.py 已有 list_users/delete_user/reset_password 测试，新增 disable/enable/promote/demote 测试参照同模式
- 现有 test_auth.py 有 delete_self + LastAdmin 测试，决策 A 移除 confirm_username 旁路需更新这些测试（现有测试可能依赖旁路，需检查）
- conftest.py autouse 隔离到 tmp_path，无需手动隔离
- factories.py 提供用户构建器

## 特别关注

- 测试代码目录：backend/tests/（后端）+ frontend-v3/e2e/admin.spec.ts（E2E）+ frontend-v3/src/__tests__/ 或 tests/（前端单测）
- P3-test-cases.md 声明 test_code_dir
- BDD-11（delete_self confirm_username 旁路移除）：现有 test_auth.py 的 delete_self 测试可能断言"confirm_username 可删最后一个 admin"——这是旧行为，决策 A 移除后该测试需更新为"绝对拒绝"。test-designer 负责更新现有测试以匹配新需求。
- BDD-04（JWT 软失效）：测试禁用用户后用旧 JWT 请求返回 401
- BDD-22/23（admin 计数边界）：2 admin 场景禁用其中一个 → 成功；剩余唯一活跃 admin 再被禁用 → 拒绝
- Playwright E2E 用 debug backend :8888，需 make debug-start（但 P3 阶段测试应能跑红灯，实际 E2E 红灯可能因页面/路由不存在——这是 B 类红灯可接受）
- vitest mock：mock auth store 的 isAdmin，用字符串字面量

## 产出路径

- `docs/tasks/T080-admin-user-management/P3-test-cases.md` — 测试用例清单
- `docs/tasks/T080-admin-user-management/P3-test-code/` — 或直接写到 backend/tests/ + frontend-v3/e2e/ + frontend-v3/src/__tests__/（test-designer 决定，P3-test-cases.md 声明 test_code_dir）

## 产出要求

- Header: phase=P3, task_id=T080-admin-user-management, trace_id=T080, type=test-cases, parent=P2-design.md, status=draft, agent=test-designer
- 24 条 BDD 1:1 映射测试用例
- test_code_dir 声明
- 每条测试用例：编号 + 对应 BDD + 预期 + 测试文件路径
- UI 任务：Playwright E2E 用例 + 多 viewport 配置

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