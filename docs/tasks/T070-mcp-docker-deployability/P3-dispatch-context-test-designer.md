---
phase: P3
task_id: T070
task_name: mcp-docker-deployability
type: dispatch-context
role: test-designer
trace_id: T070-P3-20260725
created: 2026-07-25
---

# P3 派发指引 — test-designer

## 目标

为 T070 的 24 条 BDD 编写 TDD 测试代码。测试当前必须全部失败（红灯），因为实现尚未编写。

## 约束

- 测试框架：vitest（packages/mcp-server 已有 vitest 配置）
- 测试代码目录：`docs/tasks/T070-mcp-docker-deployability/P3-test-code/`
- ui_affected: false — 不需要 Playwright/E2E 用例
- 测试必须引用 BDD 编号（如 `describe('BDD-1: ...')` 或 `it('BDD-1: ...')`）
- 每条 BDD-NN 对应至少一个测试用例（1:1 映射）
- 测试必须能运行且当前全部失败（红灯）

## 上游关联

- P1-requirements.md：24 条 BDD 验收条件
- P2-design.md：方案设计 + files_to_read

## 输入文件（必读）

1. `docs/tasks/T070-mcp-docker-deployability/P1-requirements.md` — 24 条 BDD
2. `docs/tasks/T070-mcp-docker-deployability/P2-design.md` — 方案设计
3. `packages/mcp-server/src/tools/publishFiles.ts` — 被测代码（CWD guard bug）
4. `packages/mcp-server/src/config/merge.ts` — 被测代码（allowed_paths 解析）
5. `packages/mcp-server/src/server.ts` — 被测代码（/health 端点）
6. `packages/mcp-server/src/cli/config.ts` — 被测代码（config list/verify）
7. `packages/mcp-server/tests/` — 现有测试（了解测试模式）

## 测试分组建议

按改动域分组测试文件：

1. **publishFiles.cwd-guard.test.ts** — BDD-1~5, BDD-6（CWD guard 修复 + 错误信息）
2. **config.allowed-paths.test.ts** — BDD-7~9（allowed_paths 容错 + 空数组）
3. **cli.config-list.test.ts** — BDD-10~12（config list 增强）
4. **cli.config-verify.test.ts** — BDD-13~14（config verify 增强）
5. **server.health.test.ts** — BDD-15~17（/health 增强）

BDD-18~24 是文档和工具描述相关，不适合自动化测试——在 P3-test-cases.md 中标注为"manual verification"。

## 关键测试设计注意

- CWD guard 测试需 mock `process.cwd()` 返回 `/`
- allowed_paths 容错测试需构造 YAML 字符串输入
- config list/verify 测试需 mock 文件系统和环境变量
- /health 测试需用 supertest（已有依赖）
- trust_all_paths=true + cwd=/ 测试（BDD-5）需同时 mock process.cwd() 和 config

## AGATE_CARD

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
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
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
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

## 按包拆分并行（可选）

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

## 产出路径

- `docs/tasks/T070-mcp-docker-deployability/P3-test-cases.md`
- `docs/tasks/T070-mcp-docker-deployability/P3-test-code/`
