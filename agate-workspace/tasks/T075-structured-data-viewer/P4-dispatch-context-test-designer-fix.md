# P4 修复派发指引 — T075 test-designer（修正 P3 测试 bug）

## 目标

修正 P3-test-code/TableView.spec.ts 中 3 条数学上不可能成立的断言（BDD-12/18/20），使其符合 P1 BDD 语义。修复后 TableView.spec.ts 全绿（配合 P4 已实现的 TableView.vue）。

## 任务背景

P4 implementer 实现完成后发现 P3 测试有 bug：3 条断言与 P1 BDD 语义矛盾，数学上不可能通过。按 agate 决策树，测试与 P1 BDD 矛盾 → 修测试（不是改实现）。P4 实现已按 P1 BDD 语义实现（正确行为），需修正测试断言。

## 约束

- 只改 `docs/tasks/T075-structured-data-viewer/P3-test-code/TableView.spec.ts` 的 3 条错误断言
- **同步更新实际位置的副本** `frontend-v3/src/components/__tests__/TableView.spec.ts`（内容必须一致）
- 不改实现代码（TableView.vue 等 P4 产物）
- 修复方向 = 让断言符合 P1 BDD 语义，不削足适履

## 上游关联

- P1-requirements.md：BDD-12/18/20 原文
- P4-implementation-frontend.md §4：3 条 DESIGN_GAP 详细说明
- P3-test-code/TableView.spec.ts：需修复的文件

## 修复项（implementer 诊断 + P1 原文核对）

### 1. BDD-12 `test_bdd_12_csv_renders_table_with_headers_and_rows`（L42-53）

**问题**：content `'name,age\n alice,30\nbob,25'` 只有 2 列，但断言 `headers.length === 3`。且同测试断言 `headers[0]==='name'`、`headers[1]==='age'`——与 3 列矛盾。

**修复方向**（二选一，选最小改动）：
- 改 content 为 3 列：`'name,age,city\nalice,30,NY\nbob,25,LA'`，则 `headers.length === 3`、`headers[0]==='name'`、`headers[1]==='age'`、`headers[2]==='city'`、`tbody tr` === 2 全成立
- 或改断言 `headers.length === 2`

**推荐**：改 content 为 3 列（E2E 版也是 3 列 `name,age,city`，保持一致），并补 `headers[2].text()).toBe('city')`。

### 2. BDD-18 `test_bdd_18_filter_column_contains_only`（L110-125）

**问题**：`'alicia'.toLowerCase().includes('alice')` === false，但 filter 'alice' 后断言 2 行且都 toContain('alice')——自相矛盾。`'alicia40'` 不含 'alice'。

**修复方向**：改数据，让 'alice' 是两行的公共子串。如 content 改为 `'name,age\nalice,30\nbob,25\nalicia,40'` → filter 'ali' 匹配 alice + alicia 共 2 行，每行都 toContain('ali')。
- filter 输入改 'ali'，断言 rows.length === 2，每行 toContain('ali')

### 3. BDD-20 `test_bdd_20_per_page_switch_resets_page_one`（L138-158）

**问题**：`csvRows(250)` = 250 数据行，perPage=100 → 第 3 页只有 50 行，但断言 `tbody tr` === 100。100 行需要 ≥300 数据行。

**修复方向**：改 `csvRows(250)` → `csvRows(300)`（300 行 → 3 页各 100 行），或改断言为 50（第 3 页 50 行）。推荐改 csvRows(300)，保持"第 3 页 100 行"断言（更符合"当前在第 3 页"的 Given 场景）。

### 4. BDD-22 超时（L157+ 附近）

**问题**：50000 行渲染在 jsdom 需 ~171s，vitest 默认超时 5s，且整个 TableView.spec 需 ~3 分钟。

**修复方向**：BDD-22 截断测试可改用小数据 + mock 截断阈值，或 `it('...', async () => {...}, 300000)` 增加超时。**推荐**：给该测试设长超时（`300000`），保持真实 50000 行验证；或在测试中临时降低 maxRows 阈值验证截断逻辑（但 P2 §3.6 定义 maxRows=50000 是默认值，useCsvParser 应接受可配置 maxRows——若实现已支持，测试可传小阈值）。

**注意**：先读 useCsvParser.ts 实际实现，确认是否支持自定义 maxRows；若支持，用 小阈值（如 5）验证截断逻辑，避免 50000 行慢渲染。

## 门槛

- P3-test-code/TableView.spec.ts 3 条断言修复 + BDD-22 超时处理
- frontend-v3/src/components/__tests__/TableView.spec.ts 副本同步（diff 为空）
- `cd frontend-v3 && npx vitest run src/components/__tests__/TableView.spec.ts --reporter=dot` 全绿
- 不改实现代码

## 返回给主 Agent

只返回两行：修改的文件路径 + 一句话摘要（3 条断言已修正，TableView.spec 全绿）。

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。
1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. git add 代码文件 → git commit
5. 预跑 check-gate.sh P4（确认暂存区有代码文件）
6. 更新 .state.yaml phase=P4 → P5

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`docs/tasks/Txxx/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `docs/tasks/Txxx/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.sh 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 派发 verifier subagent 执行 gate_commands.P5，主 Agent 验 gate（检查产出 + failed 计数 + N5 最小校验）。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | —（plan-eng-review 在 P2 已派）| — |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.sh 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前**必须**为每个 subagent 的 dispatch-context 分配上述隔离参数。当前无 gate 脚本检查（已知缺口），但未分配导致运行时冲突（端口占用/数据库锁）时计为重试，不算环境问题。

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（无触发评审角色时此项自动满足）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **写完代码不改 .state.yaml 就 commit**：commit 后更新 phase 标记为 P5
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->
