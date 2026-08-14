---
phase: P3
task_id: TPV0094-treeview-default-expand
type: test-cases
parent: P2-design.md
trace_id: TPV0094-P3-20260814
status: draft
---

# P3 派发上下文 — test-designer

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

## 目标

产出 `P3-test-cases.md`（测试用例清单，BDD 1:1 映射）+ 更新/新增测试代码（红灯）。本任务测试代码**修改现有测试文件**（非新建 P3-test-code/ 目录），test_code_dir 指向现有文件。

## 关键背景（P2 已定稿，勿重做）

- **改动面**：3 源文件（TreeView.vue + TreeView.spec.ts + e2e/structured-data-viewer.spec.ts）+ 1 新增脚本（scripts/measure-treeview-perf.ts，红线实测，P6 执行，P3 不用写）
- **实现语义（P2-design.md §2/§3）**：
  - `totalNodeCount` 递归计数所有节点
  - `≤ DEFAULT_EXPAND_THRESHOLD` → 收集所有含子节点节点的 path 进 expandedPaths（全展开）
  - `> 阈值` → expandedPaths 置空 Set（根也折叠，大平层也真实折叠）
  - `shouldCollapse = totalNodeCount > 阈值 && 存在含子节点节点`；banner 渲染条件 = shouldCollapse && 非 truncated 分支；`data-testid="tree-collapse-banner"`，文案「内容较大，已折叠部分」
  - `DEFAULT_EXPAND_THRESHOLD = 2000`（导出常量，P6 实测后更新）
- **现有断言需同步**：TreeView.spec.ts L84-111 test_bdd_27/28 + e2e/structured-data-viewer.spec.ts L206-225 test_bdd_27/28 均断言初始 `aria-expanded="false"`——默认展开后必挂，必须改为适配新默认态的断言
- **红线 fixture**：平铺结构（单根+N-1 叶子）专用于红线实测（P6），**不用于 BDD-3/4**；BDD-3/4 用 10000 节点「根→20 子树×500」分支结构；BDD-5 多文件 entry 含小（≤100）与大（10000）

## 测试用例映射（8 BDD → 用例）

| BDD | 单测（TreeView.spec.ts） | E2E（structured-data-viewer.spec.ts） |
|-----|------------------------|--------------------------------------|
| BDD-1 小 JSON 全展开 | 新增：小 fixture（≤阈值，相对 DEFAULT_EXPAND_THRESHOLD 构建）mount 后所有含子节点行 aria-expanded=true 且 .tree-node 数=节点总数 | 新增：小 JSON entry 打开后全展开 |
| BDD-2 小 YAML/XML 全展开 | — | 新增：小 YAML entry + 小 XML entry 各自验证全展开 |
| BDD-3 超阈值折叠+提示 | 新增：>阈值深层链 fixture（约 2001 节点，链式结构控 jsdom 挂载耗时）mount 后 banner 存在 + .tree-node 数 < 总数 | 新增：10000 节点分支 JSON entry 打开后 banner 存在 + 未全展开 |
| BDD-4 大文件折叠态手动展开 | — | 新增：BDD-3 场景点开根 toggle → 第一层可见；再点开一个子树 toggle → 该子树子节点可见 |
| BDD-5 切文件重置 | — | 新增：多文件 entry（小+大）从大切到小 → 小文件按自身节点数重新决定展开态 |
| BDD-6 toggle 可逆 | 新增：小 fixture 初始全展开 → 点击含子节点行一次 aria-expanded=false 子节点隐藏 → 再点一次恢复 | 新增：同语义 E2E |
| BDD-7 折叠态搜索 | 新增：>阈值 fixture 折叠态下输入搜索词 → 计数非零（aria-live） | 新增：同语义 E2E |
| BDD-8 红线实测 | — | —（measure-treeview-perf.ts 脚本，P6 执行） |

**必须更新**：test_bdd_27/28（单测 + E2E）初始态断言从「折叠」改为「展开」（按新默认语义）。

## 约束

1. **只写测试代码，不写实现**：TreeView.vue / DataTreeNode.vue 一律不改（P4 的事）
2. **test_code_dir 声明**：指向现有测试文件位置（`frontend-v3/src/components/__tests__/` 与 `frontend-v3/e2e/`），在 P3-test-cases.md 中声明
3. **红灯要求**：新用例 + 更新的 test_bdd_27/28 在实现未改时**必须失败**（B 类红灯：assertion 失败，因被测模块尚未实现新行为）——这正是 TDD 要的红灯
4. **单测 fixture 用相对阈值构建**：引用导出的 `DEFAULT_EXPAND_THRESHOLD`（小文件 < 阈值、大文件 > 阈值），阈值 P6 变更后测试不炸
5. **BDD-3 单测用深层链**（约 2001 节点链式）控 jsdom 挂载耗时，不用 10000 节点平铺/宽分支（P2 §9 实现提示）
6. **BDD-4 E2E 单次点击渲染量受控**：点开根（20 子树头）+ 一个子树（500 节点），不整树展开
7. **UI 稳定标识**：banner 用 `data-testid="tree-collapse-banner"`（实现未加，断言它存在会红——正确）；现有 class 选择器（.tree-node/.expand-toggle/aria-expanded/.no-data/.truncation-banner）沿用
8. **fixture 建 entry 方式**：E2E 用现有 beforeAll 经 debug backend API 建 entry 先例（e2e/structured-data-viewer.spec.ts L34-60）；单测用 jsdom mount + mock 数据
9. **环境隔离**：只改测试文件 + P3 产出文件；严禁触碰 :8080/~/.peekview/；E2E 用例写入 spec 文件即可，P3 不实跑 E2E（红灯确认只跑单测 `make test-frontend`）
10. **vitest mock hoisting 反模式**：`vi.mock()` 回调只使用字符串字面量，不引用外部变量；动态 mock 用 `vi.doMock` 在 beforeEach 设置
11. 产出写 `agate-workspace/tasks/TPV0094-treeview-default-expand/P3-test-cases.md`
12. 每读完一个输入文件，把发现追加到 `P3-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0094-treeview-default-expand/P2-design.md`（方案：§2 候选 A 代码块 / §3 边界 / §4 fixture / §9 完成标志）
2. `agate-workspace/tasks/TPV0094-treeview-default-expand/P1-requirements.md`（8 条 BDD）
3. `frontend-v3/src/components/TreeView.vue`（现状：resetExpansion/watch/matchCount/模板结构）
4. `frontend-v3/src/components/DataTreeNode.vue`（aria-expanded/toggle 契约）
5. `frontend-v3/src/components/__tests__/TreeView.spec.ts`（现有 13 用例 + mount/fixture 模式 + test_bdd_27/28）
6. `frontend-v3/e2e/structured-data-viewer.spec.ts`（E2E 断言 + beforeAll 建 entry 先例 + test_bdd_27/28）
7. `frontend-v3/src/types/structured-data.ts`（TreeDataNode）
8. `AGENTS.md`（铁律）

## 验证手段（可用）

- 写测试代码后自跑 `make test-frontend`（cd frontend-v3）确认红灯（不许为了绿而改实现）
- 不实跑 E2E（需 debug backend，P5/P6 跑）

## 产出规格

P3-test-cases.md 必须包含：
- `test_code_dir:` 声明
- 用例清单：编号 ↔ BDD-NN 映射 ↔ 预期（含更新 test_bdd_27/28 的说明）
- 红灯确认方式说明

## 返回

路径 + 一句话摘要（N 个测试用例，当前全部红灯——只报告单测红灯状态）。
