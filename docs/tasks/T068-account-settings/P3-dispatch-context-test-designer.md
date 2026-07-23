---
phase: P3
task_id: T068-account-settings
role: test-designer
created: 2026-07-23
---

# P3 派发指引 — test-designer

## 目标

设计 T068 的 TDD 测试用例，每条 P1 BDD 对应测试用例，当前全部红灯。

## 约束

- 后端测试：pytest + httpx AsyncClient，测试命令 `make test-quick`
- 前端测试：vitest + jsdom，测试命令 `make test-frontend`
- ui_affected: true → 必须含 Playwright/E2E 用例（P5/P6 跑）
- 项目铁律：不加注释
- 后端测试文件：backend/tests/test_auth_me.py（PATCH /auth/me 相关）
- 前端测试文件：frontend-v3/src/components/__tests__/t068-*.spec.ts
- 后端须 mock auth，前端须 mock authStore + API client

## 上游关联

- P1: 14 条 BDD 验收条件（BDD-1 到 BDD-14）
- P2: 方案 A（单组件+条件渲染 tab），files_to_read 清单

## 输入文件（必读）

1. docs/tasks/T068-account-settings/P1-requirements.md — 14 条 BDD
2. docs/tasks/T068-account-settings/P2-design.md — 方案设计 + files_to_read
3. docs/tasks/T068-account-settings/P0-brief.md — 环境约束

## 特别注意

- 后端新增 PATCH /auth/me 端点需 pytest 测试（认证+输入校验+并发）
- 前端 SettingsView 组件需 vitest 测试（tab 切换+auth guard+表单提交）
- 改密码 BDD 需 mock POST /auth/change-password
- API Keys tab 功能等价迁移需回归测试

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：agate/phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.sh 确认红灯
3. git commit
4. 更新 .state.yaml phase=P3 → P4

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 未被裁剪时）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 BDD 验收条件
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则（check-tdd-red.sh）

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**非 pytest 技术栈**：设置 `TEST_RUNNER` 环境变量指向项目实际测试命令（如 `TEST_RUNNER="npm test"`），check-tdd-red.sh 会使用该命令而非默认的 pytest 探测。这是 agate 协议保持技术栈无关的标准接入点，不需要绕过脚本手动验证。

## 推进条件

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
