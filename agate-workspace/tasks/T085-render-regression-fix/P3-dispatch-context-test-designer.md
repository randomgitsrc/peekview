# P3 派发指引 — T085 test-designer

## 目标

为 T085 的 11 条 BDD 设计 TDD 测试用例，产出 `P3-test-cases.md` + `P3-test-code/` 测试代码。测试当前必须红灯（实现未写）。

## 任务背景

5 个渲染缺陷修复，11 条 BDD（BDD-1~11）。P2 方案已 approved。本任务纯前端，无后端改动。

## BDD 清单

| BDD | 缺陷 | 描述 |
|-----|------|------|
| BDD-1 | P1 | SVG 文件默认渲染为图片预览 |
| BDD-2 | P1 | 普通 XML 文件仍渲染为树视图（防回归） |
| BDD-3 | P1 | SVG 文件不显示源码/渲染切换按钮 |
| BDD-4 | P2 | 富渲染格式源码视图可纵向滚动 |
| BDD-5 | P2 | 普通文本 fallback 源码视图可纵向滚动（防回归） |
| BDD-6 | P3 | 桌面端 Markdown 渲染视图左右留白 ≥32px |
| BDD-7 | P3 | 移动端 Markdown 渲染视图左右留白 ≥16px |
| BDD-8 | P4 | 滚动到底端后继续滚动不触发抖动 |
| BDD-9 | P5 | 真实点击可选中每页行数并回到第 1 页 |
| BDD-10 | P5 | 每页行数控件触达目标 ≥44px |
| BDD-11 | P5 | 每页行数控件支持键盘操作 |

## 约束

- ui_affected: true → 必须含 Playwright/E2E 用例
- BDD-9 必须用真实点击（`click()` 打开 → `click()` 选项），**禁止 `selectOption()`**
- P3 自检：跑测试确认每个红灯失败原因是"实现未写"而非"断言与数据矛盾"（T075 教训）
- 量化断言必须从数据可推导，不允许手写魔数（T075 教训）
- vitest mock hoisting 反模式：`vi.mock()` 回调只用字符串字面量
- 测试代码放 `docs/tasks/T085-render-regression-fix/P3-test-code/`
- E2E spec 文件名：`render-regression.spec.ts`

## 上游关联

- P1-requirements.md：11 BDD
- P2-design.md：修复方案 + files_to_read + gate_commands

## 输入文件

1. `docs/tasks/T085-render-regression-fix/P1-requirements.md`（BDD 条件）
2. `docs/tasks/T085-render-regression-fix/P2-design.md`（方案 + gate_commands）
3. `frontend-v3/src/composables/useEntryDetailComputed.ts`（isXml/isImage 现状）
4. `frontend-v3/src/components/EntryDetailContent.vue`（调度链 + content-area CSS）
5. `frontend-v3/src/styles/code.css`（.code-body 现状）
6. `frontend-v3/src/components/MarkdownViewer.vue`（padding 现状）
7. `frontend-v3/src/composables/useResponsiveLayout.ts`（scroll-hide 现状）
8. `frontend-v3/src/components/TableView.vue`（per-page select 现状）
9. `frontend-v3/e2e/structured-data-viewer.spec.ts`（现有 E2E 模式参考）

## gate_commands

```yaml
P3_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
```

## 门槛

- P3-test-cases.md 含 test_code_dir 声明
- 每条 BDD-1~11 有对应测试用例（1:1 映射）
- P3-test-code/ 目录存在
- UI 任务：Playwright/E2E 用例存在
- 测试当前红灯（实现未写）

## 返回

路径 + 一句话摘要。

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
3. git commit
4. 更新 .state.yaml phase=P3 → P4

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

## gate 规则（check-tdd-red.sh）

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
