# P3 Dispatch Context — test-designer

## 任务目标

为 TPV0089（unicode-filename-link-fix）产出 TDD 测试：`P3-test-cases.md` + `P3-test-code/`，并为 P6 E2E 准备 seed-data fixture（`scripts/seed-data/unicode-filenames/`）。

## 上游关联

- 输入文件（必读）：
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P0-brief.md`（环境约束 + 已知风险）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P1-requirements.md`（需求基线 + 13 BDD）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P2-design.md`（批准的方案 A，含 gate_commands/files_to_read/UI 测试选择器）
  - `AGENTS.md`（项目约定）
  - `frontend-v3/src/utils/path-map.ts`（被测文件，必读——理解现状函数签名）
  - `frontend-v3/src/utils/path-map.test.ts`（既有测试基线 TC-RP/TC-NR/TC-BPM，新增用例不能破坏它们）
  - `frontend-v3/src/composables/useMarkdown.ts:111-134,293-327`（4 处调用点，了解 E2E 行为）

## 已确认事实（P1/P2 结论，直接采用）

1. **根因**：`resolvePath()` 未 decode markdown-it 已 percent-encode 的 href/src
2. **方案 A**（P2 approved）：`resolvePath` 内 raw 优先 + decode-once 兜底 + 守卫重跑 + matchRef 抽取。`normalizeRef`/`buildPathMap` 零改动
3. **13 条 BDD**：BDD-1~9 单元级（path-map.test.ts），BDD-10~13 端到端（P6 Playwright）
4. **BDD-7 前提勘误**：真实 markdown-it 对字面 `%` 原样保留（不编 %25），BDD-7 保留为 decode 恰好一次语义的单测；BDD-8 覆盖真实链路（raw 直接命中）
5. **fixture 需求**：`scripts/seed-data/` 现无任何非 ASCII 文件名（P1 [SUGGEST]），P3 需新建 `scripts/seed-data/unicode-filenames/`（含中文/日文/重音/空格文件名图片 + 引用它们的 markdown）供 P6 E2E 使用
6. **P2 UI 测试选择器**：图片断言 src 以 `/api/v1/entries/{slug}/files/{id}/content` 结尾；链接断言 `a[data-peekview-file-id]` 存在且 href 为 `/{slug}?file={id}`

## 约束

- **TDD 红灯**：测试代码当前必须失败（实现未写）——本次派发只写测试代码，**不写实现**（path-map.ts 保持原样）
- 单测落在 `frontend-v3/src/utils/path-map.test.ts`（追加，不删除既有 TC-RP/TC-NR/TC-BPM 用例）
- E2E 用例：P6 才实跑，但 P3 需产出 Playwright 用例（可放 `frontend-v3/e2e/` 或 P3-test-code/，按项目既有 E2E 结构）
- **fixture 必须**：`scripts/seed-data/unicode-filenames/` 子目录，格式参照现有 seed-data 结构（meta.json + 内容文件），图片文件用真实 PNG（可用最小 1x1 PNG），markdown 正文用相对路径引用（空格文件名需尖括号包裹 `![x](<images/report final.png>)`，P2 minimal_validation 已实测）
- 禁止触碰生产 :8080 / ~/.peekview/
- 测试命名引用 BDD 编号（如 `test_bdd_1_chinese_path`）

## gate_commands（P2 已固化，P3 用）

```yaml
gate_commands:
  P3: "cd frontend-v3 && npx vitest run src/utils/path-map.test.ts"
  P5: "make test-frontend"
  P5_typecheck: "make typecheck"
  P5_e2e: "make debug-test"
  project_module: "frontend-v3/src/"
```

## 输入文件列表（按序读取，每读完一个追加 P3-progress.md）

1. `docs/tasks/TPV0089-unicode-filename-link-fix/P1-requirements.md`
2. `docs/tasks/TPV0089-unicode-filename-link-fix/P2-design.md`
3. `AGENTS.md`
4. `frontend-v3/src/utils/path-map.ts`
5. `frontend-v3/src/utils/path-map.test.ts`
6. `scripts/seed-data/`（现有结构参考，为 fixture 做准备）

## 产出要求

1. `docs/tasks/TPV0089-unicode-filename-link-fix/P3-test-cases.md`
   - 声明 `test_code_dir: {路径}`
   - 每条测试用例对应一条 BDD（1:1 映射，BDD-1~13）
   - 含 fixture 说明（unicode-filenames/ 的目录结构 + 用途）

2. 测试代码（追加到 `frontend-v3/src/utils/path-map.test.ts`）

3. `scripts/seed-data/unicode-filenames/`（fixture，P6 E2E 素材）

文件 Header（直接复制）：
---
phase: P3
task_id: TPV0089-unicode-filename-link-fix
type: test-cases
parent: P2-design.md
trace_id: TPV0089-P3-20260811
status: draft
created: 2026-08-11
agent: test-designer
---

## 返回给主 Agent

两行：产出文件路径 + 一句话摘要（N 个测试用例，当前全部红灯，不超过 30 字）

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

<objective_info>
- 环境状态：debug backend :8888 已启动（22 entries）；CDP Chrome :18800 可用；vitest 1.6.1
- 关键标识：被测文件 frontend-v3/src/utils/path-map.ts；既有测试 path-map.test.ts（TC-RP-01~10/TC-NR-01~18/TC-BPM-01~10）；fixture 目标 scripts/seed-data/unicode-filenames/
- 查证结果：P1 基线 13 BDD（BDD-1~9 单元 / BDD-10~13 E2E）；方案 A 已 approved
</objective_info>
