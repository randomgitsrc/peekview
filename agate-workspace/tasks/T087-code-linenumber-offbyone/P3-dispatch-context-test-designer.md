---
phase: P3
task_id: T087-code-linenumber-offbyone
role: test-designer
dispatch_type: initial
---

# P3 dispatch-context — T087 test-designer

## 目标

产出 `docs/tasks/T087-code-linenumber-offbyone/P3-test-cases.md` + 测试代码目录，TDD 红灯。10 条 BDD 1:1 映射测试用例。

## 任务背景

修复 `useShiki.ts` 行号 off-by-one。P2 方案 A：在 `highlight()` 和 `highlightCode()` 内部对 `code` 做 `replace(/\n$/,'')`，trim 后的 code 同时传给 `codeToHtml` 和 `renderLineNumbers`。`renderLineNumbers` 函数体不改。

## P2 设计的关键约束（测试须验证）

1. **三联对齐**：行号数 == `.line` 数 == 逻辑行数（末尾 `\n` 不产生额外行）
2. **trim 同时作用于两列输入**：只改 renderLineNumbers 会引入错位（P1 实测）
3. **renderLineNumbers 不改**：测试通过 highlight/highlightCode 间接验证，不直接测 renderLineNumbers 内部（除非 export）
4. **6 个边界 case**：末尾换行 / 无换行 / 空文件 / 单行 / 仅换行符 / 中间空行+末尾换行

## P2 §6 单测设计指引（直接采信）

在 `frontend-v3/src/composables/__tests__/useShiki.spec.ts` 或新文件加测试。

**renderLineNumbers 纯函数测试**（当前未 export）：
- 选择 (b) 通过 highlight/highlightCode 间接测（mock codeToHtml，断言返回 HTML 中 `.line-number` count），避免改函数签名
- 或 (a) export 它直接测——由你决定，(b) 推荐

**highlight/highlightCode 集成测试**（mock codeToHtml 返回固定 `.line` 数）：
- `"a\nb\n"` → `.line-number` count == 2, mock `.line` count == 2
- `"a\nb"` → 2 == 2
- `"a"` → 1 == 1
- `""` → highlight 不触发（CodeViewer 短路）；纯函数层 1 == 1
- `"\n"` → 1 == 1
- `"a\n\n"` → 2 == 2

**关键断言**：`.line-number` count == `.line` count（三联对齐核心），非只断言行号数。

## BDD → 测试映射（10 条 1:1）

| BDD | 测试 case | 类型 |
|-----|-----------|------|
| BDD-1 末尾换行 | highlight("a\nb\n") → 2 行号 + 2 .line | vitest 单测 |
| BDD-2 无换行 | highlight("a\nb") → 2+2 | vitest 单测 |
| BDD-3 单行 | highlight("a") → 1+1 | vitest 单测 |
| BDD-4 空文件 | CodeViewer 空短路（现有测试覆盖，确认不回归） | vitest 单测 |
| BDD-5 仅换行符 | highlight("\n") → 1+1 | vitest 单测 |
| BDD-6 中间空行+末尾换行 | highlight("a\n\n") → 2+2 | vitest 单测 |
| BDD-7 Markdown 代码块对齐 | highlightCode("a\nb\n") → 2+2 | vitest 单测 |
| BDD-8 Markdown 多代码块不回归 | viewer.spec.ts E2E 回归 | E2E（现有 spec） |
| BDD-9 wrap 对齐 | viewer.spec.ts TC-003 wrap toggle | E2E（现有 spec） |
| BDD-10 源码视图切换 | viewer.spec.ts CodeViewer 路径 | E2E（现有 spec） |

**注意**：BDD-8/9/10 走现有 viewer.spec.ts E2E 回归（P5_e2e 跑），P3 主要写 vitest 单测覆盖 BDD-1~7。E2E 用例在 P5 跑（P3 不必新写 E2E，现有 viewer.spec.ts 已覆盖 .line count + wrap）。

## vitest mock hoisting 反模式（T079 教训，必读）

vitest 的 `vi.mock()` 会被 hoisting 到文件顶部。mock 回调中**只使用字符串字面量**，不引用外部变量；如需动态 mock，用 `vi.doMock` 在 `beforeEach` 中设置。否则 P3 表现为 B 类红灯（被放行），P4 才暴露为 A 类错误。

## 红灯要求

测试当前必须全部失败（红灯）：
- B类红灯（assertion 失败 / 项目内 import 失败）= 正确，可推进
- A类红灯（SyntaxError / 第三方 import 失败）= 测试代码自身错误，须修
- 绿了 = 实现先于测试，违反 TDD

check-tdd-red.sh exit 0 = 真红灯可推进。gate_commands.P3 = `cd frontend-v3 && ./node_modules/.bin/vitest run`，formatter = vitest.sh。

## 约束

- **domains**: frontend
- **不碰**：后端、MCP、CLI、路由、权限、实现代码（只写测试，实现是 P4 的活）
- **环境隔离**：vitest 单测不依赖后端；E2E 走 make debug-test
- **test_code_dir**: 声明在 P3-test-cases.md（如 `frontend-v3/src/composables/__tests__/`）
- 未触生产写 [PROD_NOT_TOUCHED]

## 输入文件

- `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`（10 BDD）
- `docs/tasks/T087-code-linenumber-offbyone/P2-design.md`（方案 A + §6 单测指引 + files_to_read）
- `frontend-v3/src/composables/useShiki.ts`（被测代码，看 highlight/highlightCode/renderLineNumbers 签名）
- `frontend-v3/src/composables/__tests__/useShiki.spec.ts`（现有单测参照，若存在）
- `frontend-v3/e2e/viewer.spec.ts`（E2E 回归 spec 参照，确认现有覆盖）

## 输出

1. `docs/tasks/T087-code-linenumber-offbyone/P3-test-cases.md`（测试用例清单，含 test_code_dir 声明）
2. 测试代码文件（在 test_code_dir 声明的目录下）

P3-test-cases.md Header：
---
phase: P3
task_id: T087-code-linenumber-offbyone
type: test-cases
parent: P2-design.md
---

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
