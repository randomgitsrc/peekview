---
review_type: retrospective
task_id: T060
task_name: archived-visibility-auth-refresh
version: v0.9.4
date: 2026-07-21
duration: ~4.5h (10:41–15:08)
author: main
---

# T060 复盘：Archived 条目可见性策略 + 登录退出内容刷新

## §1 时间线与规模

| 指标 | 数值 |
|------|------|
| 总耗时 | ~4.5h（10:41 P0 → 15:08 P8） |
| Git commits | 8 个（P0–P8 每阶段一个） |
| Subagent 派发 | 15 次（8 首次 + 4 修订轮 + 1 重试 + 2 拆分并行） |
| 产出文件 | 53 files changed, +5184/-48 lines |
| BDD 验收 | 19 条，19/19 PASS |
| 测试 | 后端 949/951 passed，前端 15/15，MCP 220/220 |
| 评审 | P1 1 次修订 → approved，P2 1 次修订 → approved |
| 涉及包 | backend (2 files), frontend-v3 (3 files), mcp-server (2 files) |

## §2 过程回顾

### P0–P2：需求与设计（~55min）

P0 立项→P1 analyst→P1 review (needs-revision, 9 项)→analyst 修订→re-review (approved)→P2 architect→P2 review (needs-revision, 7 项)→architect 修订→re-review (approved)。

**P1 和 P2 各经历 1 次修订循环**，这是正常的质量保障机制——不是问题，是设计评审在起作用。P1 review 发现的 9 项问题中，"P1 纯净性"（BDD When 子句混入实现细节）和 NEED_CONFIRM 遗留是最有价值的发现。P2 review 发现的竞态/失败 fallback/初始化误触发等 7 项问题直接提升了设计质量。

### P3：TDD（~25min，1 次重试）

首次派发 test-designer 因 LLM 用量限制返回空结果。策略调整：拆分为 backend + frontend/MCP 两个 test-designer 并行派发，成功。

**教训**：18 条 BDD 覆盖 3 个测试环境的 test-designer 任务对单个 subagent 过重。提前拆分是正确策略，不应等到空返回才补救。

### P4：实现（~74min）

三端并行实现：backend (general), frontend (general), MCP (general)。frontend subagent 类型不可用，降级为 general。实现完成后后端 43/43 全绿，前端 vue-tsc 通过，MCP build 通过。

**教训**：frontend/mcp subagent 类型在当前平台不可用（"Model not found: inherit/."），全部降级为 general。这不是 T060 特有问题——是平台层面的限制。

### P5–P6：验证与验收（~9min 实际工作 + commit 挣扎）

P5 测试全部通过（后端 43/43 + 前端 15/15 + MCP 220/220）。P6 验 19/19 PASS。

**但 P5 commit 被拦截 5 次**——这是 T060 最大的摩擦点：

| 拦截次数 | 原因 | 根因 |
|----------|------|------|
| 1 | CHANGELOG [Unreleased] 未记录 T060 | 忘了先更新 CHANGELOG |
| 2 | .state.yaml phase=P6 但无 P6-acceptance.md | 提前改了 phase（P5→P6 在 commit 前） |
| 3 | dispatch-context 缺 AGATE_CARD 标记 | 手写文件时忘了放 `<!-- AGATE_CARD_START -->` 占位符 |
| 4 | dispatch-context hash mismatch | agate-inject-card.sh 注入后缺占位符导致 hash 不对 |
| 5 | SCOPE+ 误报 | dispatch-context 里的约束指令含 `[SCOPE+]` 字面，被 hook 误判 |

**核心问题**：commit 流程对 gate 依赖过重，每次拦截需要读 hook 输出→诊断→修复→重试。5 次拦截消耗 ~20min。

### P7–P8：收尾（~100min）

P7 一致性检查顺利通过，发现 1 个 MINOR（P6 header BDD 数 18→19）。P8 bump v0.9.4 + 发布。

**发布时发现 T056 遗留的预存问题**：`prometheus-fastapi-instrumentator` 依赖在 pyproject.toml 声明了但本地 venv 未同步，导致 395/951 测试因 `ModuleNotFoundError` 失败。从 T056 到 T060 跨越 4 个任务周期未被发现——每个任务只跑相关子集测试，全量测试从未真正跑过。

## §3 问题分析

### 问题 A：commit 被 gate 反复拦截

**现象**：P5 commit 被拦截 5 次，消耗 ~20min。  
**根因**：
1. 工作流设计假设"每阶段完成时所有条件自然满足"，但实际操作中 phase 更新、CHANGELOG、dispatch-context 标记是跨步骤操作，容易遗漏
2. hook 报错信息不够可操作——"hash mismatch" 不说明是需要重新注入还是缺占位符

**建议**：
1. 在 phase-cards 中加入"commit 前自检清单"（phase 值/CHANGELOG/dispatch-context 标记/AGATE_CARD 占位符）
2. agate 侧：dispatch-context hash 检查失败时，输出更明确的修复指令（如"请确认文件含 `<!-- AGATE_CARD_START -->` 占位符"）

### 问题 B：依赖添加后本地 venv 未同步

**现象**：T056 加了 `prometheus-fastapi-instrumentator` 到 pyproject.toml，本地 venv 未同步，导致后续所有任务的 P5 全量测试虚设。

**影响范围**：395/951 测试（41%）因缺包失败，持续 T056→T058→T059→T060 共 4 个任务周期。

**为什么没被发现**：每个任务的 P5 都只跑了相关子集测试。agate 的 P5 gate_commands 建议跑全量套件，但未强制——`gate_commands.P5` 语句是声明性的，主 Agent 自行决定跑哪些测试。

**建议**：
1. P5 应**强制**跑全量测试套件至少一次（不仅仅是 gate_commands 中声明的命令）
2. P8 发布前应加入 `make dev`（重新同步 venv）作为强制步骤
3. 或：CI pipeline 中跑全量测试，让本地测试不必跑全量但 CI 必须过

### 问题 C：P3 任务过重导致空返回

**现象**：18 条 BDD 覆盖 3 个测试环境（pytest + vitest + Playwright + MCP vitest）的 test-designer 任务使 subagent 上下文过载，空返回。

**建议**：P3 拆分应在 dispatch 阶段就做预判——BDD ≥10 条或测试环境 ≥2 时，主动拆分为并行派发。

### 问题 D：dispatch-context 手写时易遗漏 AGATE_CARD 占位符

**现象**：P7 dispatch-context 手写时忘了放 `<!-- AGATE_CARD_START -->` 和 `<!-- AGATE_CARD_END -->`，导致 agate-inject-card.sh 注入失败（无占位符可替换），commit 时 hash mismatch。

**建议**：dispatch-context 模板中 AGATE_CARD 占位符应放在更显眼的位置（如文件顶部），或 agate-inject-card.sh 在找不到占位符时自动追加而非静默"成功"。

### 问题 E：phase 提前更新导致 commit 被拦

**现象**：`.state.yaml` phase 在 commit 前被更新到下一阶段（P5→P6），hook 检查到 phase=P6 但无 P6-acceptance.md，拦截。

**根因**：操作顺序问题——应该先 commit 当前阶段，再更新 phase。但实际操作中容易在 commit 之前顺手改 phase。

**建议**：在 phase-cards 的"推进条件"中显式写明"先 commit，后更新 .state.yaml phase"。

## §4 做得好的

1. **P1/P2 评审循环发挥了价值**：P1 review 9 项修改、P2 review 7 项修改——这些不是在浪费时间，而是在前期用低成本修正了后期会付出 10 倍代价的问题（如 BDD When 子句混入实现细节、竞态策略缺失）。
2. **P3 拆分策略正确**：空返回后拆 backend + frontend/MCP 并行，恢复快。
3. **P4 三端并行实现**：backend/frontend/MCP 同时派发，节省串行等待时间。
4. **P7 一致性检查发现了 P6 header BDD 计数偏差**：虽然不影响功能，但体现了交叉核对的防错价值。

## §5 改进建议汇总

| # | 建议 | 影响范围 | 优先级 |
|---|------|---------|--------|
| 1 | commit 前自检清单（phase/CHANGELOG/AGATE_CARD 占位符） | 流程 | 高 |
| 2 | P5 强制全量测试至少一次 | 流程 | 高 |
| 3 | P8 发布前加入 `make dev`（同步 venv） | 流程 | 高 |
| 4 | P3 BDD≥10 或环境≥2 时主动拆分 | 流程 | 中 |
| 5 | agate-inject-card.sh 找不到占位符时报错而非静默"成功" | agate 工具 | 中 |
| 6 | dispatch-context hash mismatch 报错更可操作 | agate 工具 | 低 |
| 7 | phase-cards 显式标注"commit 后更新 phase" | 文档 | 低 |

## §6 数据附录

| 阶段 | 派发次数 | 角色 | 修订 | 耗时(min) |
|------|----------|------|------|-----------|
| P0 | 0（主Agent自写） | main | — | 5 |
| P1 | 4 | analyst(2) + review(2) | 1 cycle | 25 |
| P2 | 4 | architect(2) + review(2) | 1 cycle | 30 |
| P3 | 3 | test-designer(3, 含1重试) | 0 | 25 |
| P4 | 1 | implementer(general) | 0 | 74 |
| P5 | 0（主Agent自验） | — | — | 4 |
| P6 | 1 | verifier | 0 | 5 |
| P7 | 1 | consistency-reviewer | 0 | 10 |
| P8 | 1 | implementer(releaser) | 0 | 9 |
| commit挣扎 | — | — | — | ~20 |
| **合计** | **15** | — | — | **~270** |
