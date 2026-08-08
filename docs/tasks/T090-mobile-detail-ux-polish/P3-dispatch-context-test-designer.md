---
phase: P3
task_id: T090-mobile-detail-ux-polish
role: test-designer
---

# 派发指引 — T090 P3 TDD 测试设计

## 目标

为 P1 的 12 条 BDD 各设计至少 1 条测试用例（1:1 映射），本任务 `ui_affected: true`，必须含 Playwright/E2E 用例（P2-design.md 声明 `gate_commands.P5_e2e: "E2E_SPEC=e2e/t090-mobile-detail-ux-polish.spec.ts make debug-test"`，请把 E2E 测试文件写在这个路径）。

## 上游关联

- P1-requirements.md（approved，12 条 BDD，`#### BDD-1` 至 `#### BDD-12`）是测试用例的验收依据
- P2-design.md（approved，6 候选方案已选定）是实现方向依据，测试应针对**最终选定的方案**设计断言（不是针对被否决的候选）
- P2-design.md 第 4 节 data-testid 清单是你写 Playwright 选择器的依据，必须用这些稳定标识（`mobile-bottom-bar`/`meta-tags-bar`/`content-area`/`markdown-body`/`mobile-bar-wrap-btn`/`mobile-bar-copy-btn`/`mobile-bar-filetree-btn`/`mobile-bar-toc-btn`/`mobile-bar-source-toggle-btn`/`overflow-menu-trigger`），不要用 class 名选择器（重构会失效）

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（12 条 BDD，核心验收依据）
2. `docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（技术方案 + data-testid 清单 + 实现完成标志清单，第 5 节列出的检查点可直接转成测试断言）
3. `frontend-v3/e2e/t084-scroll-architecture.spec.ts`（P2-design.md 指定的同类历史任务 E2E 写法参照，viewport 断点/滚动断言模式可复用）
4. `frontend-v3/src/components/EntryDetailMobileBar.vue`（现有按钮结构，写测试前先了解现状）

## BDD → 测试类型映射提示

- BDD-1/2（滚动无跳变）：Playwright E2E，需要移动 viewport（≤640px），markdown + code 两种 entry，滚动过程中断言无一次性跳变（可用连续采样 `getBoundingClientRect`/`scrollTop` 判断位移是否连续，而非直接判断"是否跳变"这种主观描述——需要设计可编程判定的断言方式）
- BDD-3（metadata 完全由文档流位置决定）：Playwright E2E，断言 meta-tags-bar 元素不存在任何独立于滚动位置的 class 切换（如断言不存在 `.hidden` 这类切换 class，或断言其可见性只随 `getBoundingClientRect` 是否在 viewport 内变化）
- BDD-4/5（底部栏固定可见 + safe-area）：Playwright E2E，CDP mobile viewport + 多个滚动位置断言 `mobile-bottom-bar` 屏幕坐标不变；BDD-5 需要模拟两种可视高度（可用 `page.setViewportSize` 两次 + 重新断言）
- BDD-6/7（底部栏按钮功能，含 wrap 场景拆分）：Playwright E2E，需要两种不同 entry（markdown 多文件 / 非 markdown 非 html 多文件如 .py）分别验证
- BDD-8（markdown 边距缩减 ≥75%）：Playwright E2E，用 `getBoundingClientRect` 测量 `data-testid="markdown-body"` 相对 viewport 的左右间距，计算缩减比例断言 ≥75%（结合当前基线约 40px）
- BDD-9（375px 极小屏无溢出）：Playwright E2E，`page.setViewportSize({width:375, ...})`，断言 `document.documentElement.scrollWidth <= 375`（无横向滚动）
- BDD-10/11/12（桌面不回归）：Playwright E2E，桌面 viewport（>640px）下断言对应行为与移动端不同（bar 不出现/边距不变/header 行为不变）

## 单元测试范围

除 E2E 外，若 `useResponsiveLayout.ts` 删除 `setupScrollHide`/`metaTagsHidden` 后仍保留其他导出（`isMobile`/`isDesktop`/`handleResize`），可为这些保留的逻辑补充/确认现有单元测试仍覆盖（vitest，`frontend-v3/src/composables/__tests__/`），不需要新增关于已删除功能的单元测试。

## 环境约束

- E2E 测试运行环境：`make debug-quick` 启动 :8888 隔离环境，测试数据可能需要新建含多文件/多语言的 entry（用 debug backend HTTP API，不可用 CLI，见 AGENTS.md 铁律第 6 条）
- 本阶段只需写测试代码到红灯状态（实现代码尚未开始），不需要真的跑通 E2E（P3 gate 只要求红灯，即因组件/data-testid 尚不存在而失败——这本身就是合规的红灯）

## 门槛（什么算完成）

- P3-test-cases.md 声明 `test_code_dir:` 字段
- 12 条 BDD 每条至少 1 个测试用例，1:1 映射清晰可核对
- Playwright E2E 用例已写（因为 ui_affected: true）
- 测试用例的选择器全部用 P2-design.md 声明的 data-testid，不用 class 名
- 自跑测试确认红灯是"因为组件/data-testid 不存在导致失败"（B 类错误），不是测试代码自身语法错误（A 类错误）

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
