# Workflow v4 专家评审报告

> 评审日期：2026-06-12
> 评审者：主 Agent
> 评审对象：docs/process/workflow-v4/ 全部文档（8 个主文件 + 17 个 assets）

---

## 总体评价

v4 是一套设计精良、实战驱动的 Agent 编排流程。核心改进（需求基线、SCOPE+ 反馈、BDD 验收闭环）切中真实痛点。整体架构清晰、文档完备。

**综合评分：7.4/10** — 架构优秀，细节和文档需一轮打磨。

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | 9 | 主从隔离 + 状态落盘 + SCOPE+ 反馈，设计优雅 |
| 可执行性 | 7 | P3 跳过后 P4 门槛未定义，P7 grep 命令有误，部分门槛不够严格 |
| 文档一致性 | 6 | v3/v4 混标，P7/P8 小结触发点矛盾，已实现改进项未清理 |
| 实战适配 | 7 | 微任务开销偏重，BDD 质量无检查，并行依赖未定义 |
| 抗风险 | 8 | A1/C7/重试上限/硬中断点设计扎实，但连锁上溯和 PAUSED 恢复有缺口 |

---

## 设计亮点

1. **主 Agent 只编排不执行** — 严格上下文隔离，解决 LLM 长对话失控根本问题
2. **SCOPE+ 定向回补** — 不全量重跑，增量增补基线，最优雅的需求变更机制
3. **A1 原则（gate 以主 Agent 亲自跑命令为准）** — T005 教训提炼，杜绝 subagent 自我报告造假
4. **domains → 评审角色机械映射** — 消除"主 Agent 没想起要请谁评审"的盲区
5. **C7 规则** — 简洁有力的防骗规则
6. **retry 计数按阶段独立累积、回退不清零** — 防绕过上限，设计严谨
7. **validation-plan.md 的渐进验证策略** — 先证明地基可行再上自动，工程思维正确

---

## 结构性问题（需修复）

### S1. P3 门槛逻辑自相矛盾

**位置**：`state-machine.md:68-69` vs `README.md:90-91`

`state-machine.md` 定义 P3 门槛为 `check-tdd-red.sh exit 0`，但 `README.md` 和 `dispatch-protocol.md` 声明 P3 是"可选阶段"。

**矛盾**：P3 跳过时直接 P2→P4，但 P4 门槛依赖 P3 测试代码（P4 要让 P3 红灯变绿）。跳过 P3 后 P4 门槛怎么判定？文档未定义。

**建议**：
- P3 跳过时，P4 门槛改为 `git log 确认 P4 commit + pytest -q exit 0`（实现+测试一起做）
- 或明确声明"P3 跳过 = TDD 降级为实现后补测试，P4 门槛只要求最终 pytest 全绿"

### S2. P6 验收的"实跑"定义模糊

**位置**：`verifier.md` P6 模式

要求"把 P1 的每条 BDD 条件实际跑一遍"，但很多 BDD 条件是行为描述而非可脚本化断言（如"已有 entry 不受影响"——手动 SQL？pytest？Playwright？）。

**建议**：P6 "实跑"分两层：
- **可自动化**的 BDD 条件：P6 subagent 写/跑验收脚本，产出 exit code
- **需人工确认**的 BDD 条件（视觉/语义判断）：Playwright 截图 + 标 `[NEED_CONFIRM]` 交人

### S3. SCOPE+ 定向回补缺少影响范围判断规则

**位置**：`README.md:191`

"主 Agent 对照新需求，看已完成的阶段里哪些产出需要跟着改"——这是 SCOPE+ 最关键步骤，但文档只说"主 Agent 判断"，没给判断规则。

**建议**：增加决策矩阵：

| SCOPE+ 类型 | 需要回补的阶段 |
|---|---|
| 新增 BDD 条件（行为层面） | P6（验收）+ 视情况 P4（实现）|
| 修改已有 BDD 条件 | P4（实现）+ P5（验证）+ P6（验收）|
| 新增 packages/domains | P2（设计）+ P3（测试）+ P4+P5+P6 |
| 仅文档/注释遗漏 | 不回补，记入 P7 |

### S4. P7 一致性检查门槛有 bug 且覆盖度不足

**位置**：`state-machine.md:90`

**问题 1**：`grep -L 'BLOCKER' P7-consistency.md` 语义有误。`grep -L` 打印**不包含**匹配的文件名，当文件包含 BLOCKER 时无输出且 exit code 不确定。应改为 `! grep -q '\[BLOCKER\]' P7-consistency.md` 或检查 `grep -c` 结果为 0。

**问题 2**：P7 门槛只检查"有没有 BLOCKER"，不检查一致性检查覆盖度。subagent 可写空壳 P7-consistency.md（无 BLOCKER 但也没做检查）就过门槛。

**建议**：
- 修正 grep 命令
- 增加 P7 门槛：P7-consistency.md 必须对 P2-design.md 每个设计要点逐项对照，至少 N 条一致性声明（N >= P2 设计要点数）

---

## 机制缺口（建议补充）

### G1. 缺少 PAUSED→恢复协议

PAUSED 有报告模板，但缺少：
- 人回复后主 Agent 如何恢复？重读 PAUSED 报告？从哪个阶段重新开始？
- PAUSED 期间 SCOPE+ 触发怎么处理？

**建议**：在 state-machine.md 增加 PAUSED→恢复的转移规则。

### G2. 缺少并行任务间依赖机制

大任务拆成多个子任务（各自 P1-P8），但子任务间可能有依赖（T003 依赖 T002 的产出）。当前文档只说"各自走 P1-P8"，没定义跨任务依赖如何表达和检查。

**建议**：P1-requirements.md 增加 `depends_on: [Txxx]` 字段，主 Agent 派发前检查依赖任务的阶段。

### G3. mcp domain 的评审映射不够具体

**位置**：`role-system.md:60`

> mcp | review + 关注 MCP 接口契约

"关注 MCP 接口契约"是模糊描述，不是可执行指令。

**建议**：mcp domain 映射到 `review`（P4 后）+ P2-design.md 中 MCP 相关接口变更必须声明 `mcp_contract_changed: true`，触发 review 时额外检查接口契约一致性。

### G4. 缺少 subagent 产出 Header 格式校验

Header 要求 phase/task_id/parent/trace_id 四字段，但门槛检查只验证"文件存在 + 有 Header"，不验证字段值正确性（如 parent 是否指向上游文件、trace_id 格式是否正确）。

**建议**：门槛检查增加：验证 parent 字段与上一阶段产出文件名匹配。

---

## 文档一致性问题

| # | 位置 | 问题 |
|---|------|------|
| D1 | `validation-plan.md` 标题 | 写"v3"，应为"v4" |
| D2 | `validation-report.md` 全篇 | 写"v3"，应为"v4" |
| D3 | `state-machine.md` P5 L2 上溯 | P5 上溯到 P4，P4 上溯到 P2，组合等于跨多阶段回退，但"跨多阶段回退禁止自动"规则只拦截单跳，不拦截链式上溯 |
| D4 | `loop-orchestration.md:210` | "评审角色选择的可判定化"列为未实现改进项，但 `role-system.md` 已实现 domains→评审角色机械映射 |
| D5 | `dispatch-protocol.md:293` vs `state-machine.md:108` | 前者说"P7 gate 通过、状态进入 READY 时"输出小结，后者是 P8 gate 通过后进 READY — 不一致，应为 P8 |

---

## 实操风险

### R1. BDD 验收条件质量依赖 P1 分析师能力

BDD 是整个流程脊梁（P1 写、P3 测试、P6 验收都依赖它），但 P1 分析师可能写出"伪 BDD"（如 `Given 用户使用系统 When 正常操作 Then 体验良好`）。当前无 BDD 质量检查机制。

**建议**：P1 门槛增加：每条 BDD 的 Then 子句必须包含可量化/可断言的预期值，不含模糊词。

### R2. 8 阶段固定开销对小任务仍偏重

即使裁剪到 P1+P4+P5，一个 typo 修复也需 P1 写 requirements.md（含 BDD + 裁剪说明）、P4 实现、P5 验证。

**建议**：增加"快速通道"：修改范围 ≤3 行且不涉及逻辑变更时，主 Agent 可直接执行并 commit，跳过 v4 流程。在 active-tasks.md 标记 `fast-path`。

### R3. P5→P4→P2 连锁上溯风险

P5 失败 MAX → 上溯 P4，P4 也耗尽 → 上溯 P2。两步单跳都合法，但组合等于跨多阶段回退。

**建议**：L2 上溯增加"跨阶段上溯前先 PAUSED 通知人"规则。当前只有 P6→P1 等大跨度单跳被禁止自动，但链式上溯未拦截。

---

## 修复优先级

| 优先级 | 项 | 理由 |
|--------|-----|------|
| P0 | 修正 P7 grep 命令（S4 问题 1） | 命令有 bug，门槛形同虚设 |
| P0 | 统一 D5：确认小结在 P8 后输出 | 文档互相矛盾 |
| P1 | 定义 P3 跳过后 P4 门槛（S1） | 小任务高频场景，不定义走不通 |
| P1 | 修复 D1/D2 v3→v4 标注 | 文档身份混乱 |
| P1 | 增加 PAUSED→恢复协议（G1） | 实操中断后无恢复路径 |
| P2 | 增加 SCOPE+ 影响范围决策矩阵（S3） | 核心机制缺操作规则 |
| P2 | 增加 BDD 质量门槛（R1） | 脊梁不稳全流程摇晃 |
| P2 | 清理 D4 已实现改进项 | 减少信息噪音 |
| P3 | 增加快速通道（R2） | 降低微任务摩擦 |
| P3 | 增加跨任务依赖（G2） | 大任务拆分场景需要 |
