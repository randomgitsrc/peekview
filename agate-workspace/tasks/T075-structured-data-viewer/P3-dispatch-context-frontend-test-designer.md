# P3 派发指引 — T075 frontend test-designer

## 目标

为 T075 的前端部分设计 TDD 测试用例（BDD-07~53），产出 `P3-test-cases.md`（总表）+ `P3-test-code/` 测试代码目录，使测试当前必须红灯（实现未写）。

## 任务背景

T075 前端部分：TableView（CSV/TSV）+ TreeView（JSON/YAML/XML）+ 源码/渲染切换 + 格式检测属性。47 条 BDD（BDD-07~53）需 1:1 映射测试用例。

## 约束

- 只负责 frontend 包：`frontend-v3/src/` 下的测试 + E2E spec
- 后端部分（BDD-01~06）由另一个 backend test-designer 并行负责，你不碰后端
- ui_affected: true → 必须含 Playwright/E2E 用例
- 测试必须当前失败（红灯）——因为 TableView/TreeView/useCsvParser/useTreeData/isCsv 等尚未实现
- 测试名引用 BDD 编号（如 `test_bdd_12_csv_renders_table`）
- vitest mock hoisting 反模式：`vi.mock()` 回调中只使用字符串字面量，不引用外部变量；动态 mock 用 `vi.doMock` 在 `beforeEach` 中设置
- 测试文件放在 `docs/tasks/T075-structured-data-viewer/P3-test-code/` 目录（不是直接放 frontend-v3/src——P4 implementer 会复制到实际位置）
- 不要修改任何实现代码（那是 P4 的事）

## 上游关联

- P1-requirements.md：BDD-07~53
- P2-design.md：§3.2~3.13 前端设计 + gate_commands.P3_frontend

## 输入文件（按顺序读取）

1. `docs/tasks/T075-structured-data-viewer/P1-requirements.md` — BDD-07~53
2. `docs/tasks/T075-structured-data-viewer/P2-design.md` — 前端详细设计（§3.2~3.13）+ files_to_read + gate_commands
3. `frontend-v3/src/composables/useEntryDetailComputed.ts` — 现有格式检测（isMarkdown/isHtml/isImage/isBinary），新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable
4. `frontend-v3/src/components/EntryDetailContent.vue` — 调度链 v-if（isHtml → isMarkdown → isImage → CodeViewer）
5. `frontend-v3/src/components/Pagination.vue` — 分页复用组件（props/emit 接口）
6. `frontend-v3/src/components/CodeViewer.vue` — 源码视图复用（props 接口）
7. `frontend-v3/src/components/__tests__/Pagination.spec.ts` — 组件测试模式（mount + props/emit 断言）
8. `frontend-v3/src/composables/__tests__/useShiki.spec.ts` L1-40 — composable 测试模式

## 客观查证信息

- P2-design.md 前端新增文件（P4 实现，P3 测试引用它们会 import 失败 = B 类红灯）：
  - `src/components/TableView.vue`
  - `src/components/TreeView.vue`
  - `src/components/DataTreeNode.vue`
  - `src/components/TruncationBanner.vue`
  - `src/composables/useCsvParser.ts`
  - `src/composables/useTreeData.ts`
  - `src/types/structured-data.ts`
- P2-design.md 前端修改文件（P3 测试会断言新 computed 不存在 → 红灯）：
  - `src/composables/useEntryDetailComputed.ts`（新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable）
- 依赖：P4 会新增 `@tanstack/vue-table` + `js-yaml@^4.3.1`（P3 阶段测试代码不要直接依赖这些库——用 mock 或测试纯逻辑）
- vitest 当前全绿（1129 passed | 1 skipped），新增测试应红灯
- 测试框架：vitest（jsdom 环境，`@vue/test-utils` mount，`.spec.ts` 后缀）+ Playwright E2E
- Playwright E2E 测试文件最终放 `frontend-v3/e2e/`（P4 implementer 复制），P3-test-code/ 里先写

## 红灯设计（每个测试必须在当前实现下失败）

| BDD 组 | 测试文件（P3-test-code/） | 红灯原因（当前实现） |
|--------|--------------------------|---------------------|
| BDD-07~11 | `useEntryDetailComputed.structured.spec.ts` | isCsv/isTsv/isJson/isYaml/isXml 不存在 → import/断言失败 |
| BDD-14/15/16/23/49 | `useCsvParser.spec.ts` | useCsvParser.ts 不存在 → import 失败 |
| BDD-24/25/26/29/32/36 | `useTreeData.spec.ts` | useTreeData.ts 不存在 → import 失败 |
| BDD-12~22 | `TableView.spec.ts` | TableView.vue 不存在 → import 失败 |
| BDD-24~36 | `TreeView.spec.ts` | TreeView.vue 不存在 → import 失败 |
| BDD-12~52 交互 | `structured-data-viewer.spec.ts`（E2E） | 页面无渲染器 → E2E 断言失败 |

**BDD 与测试对应关系（47 条前端 BDD）**：
- BDD-07~11：格式检测属性（5 条）→ useEntryDetailComputed.structured.spec.ts
- BDD-12~23：TableView（12 条）→ useCsvParser.spec.ts + TableView.spec.ts + E2E
- BDD-24~36：TreeView（13 条）→ useTreeData.spec.ts + TreeView.spec.ts + E2E
- BDD-37~48：源码/渲染切换（12 条）→ E2E
- BDD-49/50：异常处理（2 条）→ useCsvParser.spec.ts + E2E
- BDD-51/52：主题/响应式（2 条）→ E2E
- BDD-53：端到端（1 条）→ E2E

每条 BDD 至少一个测试用例，测试名引用 BDD 编号。

## 产出

1. 写 `docs/tasks/T075-structured-data-viewer/P3-test-cases.md` — 全部 53 BDD 总表（含后端 BDD-01~06 标注由 backend test-designer 覆盖，前端 47 条详细映射） + `test_code_dir: docs/tasks/T075-structured-data-viewer/P3-test-code`
2. 写 `docs/tasks/T075-structured-data-viewer/P3-test-code/` 下的测试文件（vitest + Playwright E2E）
3. 追加 `docs/tasks/T075-structured-data-viewer/P3-progress.md`（分阶段落盘）

## 门槛

- `P3-test-cases.md` 存在且含 `test_code_dir` 声明
- `P3-test-code/` 目录存在且测试文件非空
- 每条 BDD-07~53 有对应测试用例（1:1 映射）
- UI 任务：Playwright/E2E 用例存在
- 测试当前红灯（`npx vitest run` 有失败用例）
- 不修改任何实现代码

## 返回给主 Agent

只返回两行：产出文件路径 + 一句话摘要（N 个测试，当前全部红灯）。

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
