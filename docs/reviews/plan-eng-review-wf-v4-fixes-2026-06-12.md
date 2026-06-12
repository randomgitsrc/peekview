---
review_id: plan-eng-review-wf-v4-fixes-2026-06-12
type: plan-eng-review
target: docs/plans/workflow-v4-review-fixes.md
status: rejected
created: 2026-06-12
---

# Plan-Eng-Review: Workflow v4 修复方案

## 评审结论

**Status: rejected** — 3 个阻塞级问题，需重新修改后再审。

---

## 架构问题（阻塞级）

### 1. Fix-4：P4 gate 注入测试验证，破坏 P4/P5 职责分离

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-4（第 105-122 行）

**问题**：Fix-4 试图在 P4 gate 中增加"P3 红灯测试变绿"条件，并定义 P3 跳过时的降级分支（`pytest -q exit 0 AND failed==0`）。

但当前状态机的 P4→P5 gate 是纯粹的实现产出确认（`state-machine.md:73`）：

```
P4 --[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit]--> P5
```

P4 gate **不依赖 P3**，也不验证测试结果。测试验证是 P5 gate 的独立职责（`state-machine.md:77`）：

```
P5 --[pytest -q exit 0 AND failed==0 AND (若 ui_affected: E2E/Playwright 实跑通过)]--> P6
```

这正是合理的职责分离：
- **P4**：实现者写代码，产出确认（文件 + commit）
- **P5**：验证者独立跑测试，结果确认（pytest exit 0）

Fix-4 的问题：
1. **"P3 已执行"变体新增"P3 红灯测试变绿"条件**——当前 P4 gate 无此条件，这是新增约束而非修复
2. **"P3 已跳过"变体的降级条件 `pytest -q exit 0 AND failed==0` 完全等同于 P5 gate**——把 P5 的职责注入 P4，造成双重验证
3. **P3 跳过场景在现有状态机中天然正确**：P4 gate 不引用 P3，P5 统一跑 pytest 检验，无论 P3 是否执行

**根因**：原评审报告声称"P4 门槛依赖 P3 测试代码"——此断言经核查不成立。`state-machine.md:73` 和 `dispatch-protocol.md:154` 的 P4 gate 定义均不引用 P3。原评审误判了依赖关系，Fix-4 基于错误诊断，属无效修复。

**建议**：**不实施 Fix-4**。现有状态机已正确分离 P4（产出确认）和 P5（测试验证）的 gate 职责。如需增强，应在 `assets/execution-roles/implementer.md` 增加自检规范（"实现者提交前应自行运行相关测试确认通过"），而非在 gate 层重复测试验证。

---

### 2. Fix-12："非相邻阶段拦截"与 L2 上溯表冲突

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-12（第 261-273 行），对比 `state-machine.md` L2 表（第 346-355 行）

**问题**：Fix-12 的拦截规则定义："当 L2 上溯的目标阶段与当前阶段不相邻时（即上溯会跳过至少一个中间阶段），先 PAUSED 通知人工"。

但 L2 上溯表（`state-machine.md:346-355`）本身包含非相邻的单次跳转：

| 失败阶段 | L2 上溯到 | 跳过的阶段 |
|----------|----------|-----------|
| P4 | P2 | P3 |
| P6 | P4 | P5 |
| P7 | P2 | P3, P4, P5, P6 |

这三个 L2 跳转**均跳过至少一个中间阶段**，按 Fix-12 的"非相邻即 PAUSED"规则，全部会被拦截。这将：
- 禁用 L2 核心机制（P4 实现失败回退到 P2 重新设计）
- 使重试超限后的自动回退实际上退化为 PAUSED（等效于没有 L2）
- 与 L2 的设计意图（`state-machine.md:344`：确定性单规则、无需主 Agent 推理）矛盾

**根因**：Fix-12 混淆了两种场景：
1. **单次 L2 跳转**（按 L2 表，可能非相邻，如 P4→P2）——这些是设计意图内的跳转
2. **链式多次 L2**（P5→P4→P2，即 P4 因累积重试再次触发 L2）——这才是需要拦截的链式上溯

Fix-12 的前提声明"L2 上溯每次只跳一个阶段"与 L2 表的事实不符。

**建议**：Fix-12 需重写。拦截条件应改为："当 L2 目标阶段已是之前通过 L2 进入的阶段（即本轮 L2 跳转发生在已标记 `needs-review` 的阶段），且再往前追溯将形成 P5→P4→P2 的链式效应，则 PAUSED。" 核心是检测"chain"而非"non-adjacent"。

---

### 3. 缺失：状态机无阶段跳过跳转

**位置**：`README.md` 可裁剪阶段声明（第 87-93 行） vs `state-machine.md` 转移规则（第 53-118 行）

**问题**：README 声明 P2、P3、P6、P7 为可选阶段，可由 P1 分析师在「裁剪说明」中声明跳过。但状态机只定义了完整的线性路径：

```
P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → READY
```

没有定义任何**跨阶段跳转**（如 P2→P4 当 P3 跳过、P1→P4 当 P2+P3 跳过等）。主 Agent 在阶段跳过时无形式转义规则可遵循，只能临场判断。这与 v4 原则 4 "门槛必须机器可判定"矛盾——"跳过"本身也是一种转移，需要可判定条件。

Fix 方案**未覆盖此缺口**。

**建议**：增补 Fix-13：在 `state-machine.md` 增加跳过转移规则段：
```
阶段跳过转移（根据 P1-requirements.md 裁剪声明）：
  主 Agent 读 P1-requirements.md 的「裁剪说明」→ 得出阶段列表 [P1, P4, P5, P8]

  P1 --[裁剪声明中 P2/P3 已跳过]--> P4
  P4 --[正常 gate]--> P5
  P5 --[裁剪声明中 P6/P7 已跳过]--> P8

  跳过转移的 gate：裁剪文件存在 AND 裁剪声明与 .state.yaml 当前阶段一致
```
gate 采用 `grep` 裁剪说明中的 `phases:` 列表来判定是否允许跳过。

---

## 架构问题（非阻塞）

### 4. Fix-1：脚本鲁棒性不足

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-1 脚本（第 31-57 行）

**问题**：
1. **GNU grep 依赖**：`grep -oP` 使用 Perl 正则语法，macOS/BSD grep 不支持 `-P`。脚本在非 GNU 环境下会报错。建议改用 `grep -oE`（扩展正则，跨平台兼容）或明确标注 `# requires GNU grep`。
2. **pytest 崩溃边缘情况**：若 pytest 因 segfault、OOM kill 等异常退出，输出可能不含 `N failed`/`N error` 行但 exit ≠ 0。此时 `FAILED` 和 `ERRORS` 均为空字符串，`ERRORS==0` → 误判为正确的红灯（exit 0）。建议在提取失败/错误计数后增加哨兵检查："若 EXIT≠0 但未提取到任何失败或错误计数 → exit 1（无法判定）"。
3. **ANSI 颜色码**：`pytest -q` 默认不输出颜色到管道，但 `--color=yes` 配置可能绑定在 pytest.ini 中。`2>&1` 合并 stderr 后，带颜色码的 `N failed` 行 `grep -oP '\d+ failed'` 可能匹配失败。建议脚本开头设置 `export FORCE_COLOR=0` 或使用 `pytest --no-header --tb=no -q` 最小化输出。

### 5. Fix-6：PAUSED 恢复后重试计数归零策略不明确

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-6（第 149-168 行）

**问题**：恢复协议规定"retry 计数不清零"。若 PAUSED 是因 retry 耗尽（如 P2 retry=3/3），恢复时重试计数仍为 3 → 回到 P2 立即又超限 → 再次 PAUSED。人工介入后应至少授予 1 次额外重试机会，否则恢复本身无意义。

**建议**：在恢复步骤 4 后增加："恢复后的首次重试不计入 retry 上限（人工已确认方向），但之后仍需遵守正常重试规则。" 或在 `retry_count` 旁增加 `recovery_bonus: 1` 字段。

### 6. Fix-5：validation-report.md 标签更新的历史准确性

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-5 D2-D2d（第 136-140 行）

**问题**：`validation-report.md` 是特定验证运行的事实性报告。若该验证实际在 v3 时期执行，将全文标签从 v3 改为 v4 会使报告失去历史上下文——报告描述的是"当时验证了什么"，而非"当前版本叫什么"。

**建议**：区分两类修改：
- **规格/设计文档**（`state-machine.md`、`loop-orchestration.md`、`dispatch-protocol.md`、`validation-plan.md`）：改 v3→v4，这些是版本无关的规范文档
- **事实性报告**（`validation-report.md`）：保留原始标签，或在报告首行添加"此验证在 v3 时期执行，其派发机制在 v4 中保持不变"的注释

### 7. Fix-3：grep 转义在不同模式下行为不一致

**位置**：`docs/plans/workflow-v4-review-fixes.md` Fix-3（第 77-99 行）

**问题**：`! grep -q '\[BLOCKER\]' P7-consistency.md` 中 `\[` 在 BRE（grep 默认模式）下行为实现定义（POSIX 未规定 `\[` 语义）。GNU grep 将 `\[` 视为字面 `[`，但不保证其他实现一致。

**建议**：使用 `grep -qF '[BLOCKER]' P7-consistency.md`（`-F` 固定字符串模式，零歧义）。这更简单、更鲁棒。

---

## 测试缺口

1. **Fix-1（check-tdd-red.sh）无测试**：脚本应配套测试用例覆盖：纯 assertion failure、纯 collection error、混合 failure+error、全绿、pytest 崩溃无输出、带颜色输出等至少 6 个场景。建议创建 `scripts/test-check-tdd-red.sh` 模拟各场景。

2. **Fix-6（PAUSED 恢复协议）无验证**：恢复→重派→通过/失败的端到端流程未定义测试或验证步骤。

3. **Fix-12（链式上溯拦截）无触发条件测试**：L2 链式上溯的触发边界（单次 vs 链式）未定义测试用例，修改后无法验证是否会误拦截现有 L2 跳转。

4. **状态机跳过转移（缺失修复）无覆盖**：当前缺失的阶段跳过转移规则导致主 Agent 在跳过场景无规则可循，但 fix 方案未包含此项。

---

## 锁定决策

以下方向经本次评审确认，可作为后续修改的基线：

1. **P4 gate 与 P5 gate 的职责分离确认**：P4 gate = 实现产出确认（文件存在 + commit），P5 gate = 测试验证（pytest exit 0）。二者不交叉。Fix-4 不实施。

2. **L2 单次跳转 vs 链式跳转区分**：L2 表定义的跳转（含非相邻如 P4→P2）是合法单次跳转；拦截目标是多次 L2 累积形成的链式回退。Fix-12 必须以"检测链"而非"检测非相邻"为核心逻辑。

3. **阶段跳过需要形式化转移**：README 的"可裁剪阶段"声明需在状态机中增加跨阶段跳转规则，使跳过本身也做到机器可判定。增补为 Fix-13。

4. **P8 gate 触发点**（dispatch-protocol.md:293）：小结输出触发时机为 P8 gate 通过后进入 READY 时，非 P7。Fix-2 方向正确。

5. **P7 gate 命令**：`! grep -qF '[BLOCKER]' P7-consistency.md`，使用 `-F` 固定字符串模式避免转义歧义。Fix-3 方向正确但命令需微调。

6. **P8 gate 补注**：state-machine.md P8 转移规则已含 packages 动态生成注释，Fix-7 仅增补交叉引用，无争议。

---

## 其他正确修复

以下修复无争议，可单独先行提交：

- **Fix-2**（D8 触发时机统一为 P8）：正确，dispatch-protocol.md:293 引用错误
- **Fix-3**（P7 grep 命令优化）：方向正确，建议微调为 `grep -qF`
- **Fix-7**（P8 gate 补注）：正确，仅增补文档交叉引用
- **Fix-8**（SCOPE+ 回补决策矩阵）：正确，将临场判断机制化
- **Fix-9**（BDD 质量门槛）：正确，Then 子句可量化要求合理
- **Fix-10**（P7 覆盖度门槛）：正确，设计要点逐项对照要求合理
- **Fix-11**（D7 已实现改进项清理）：正确，保持文档准确性
