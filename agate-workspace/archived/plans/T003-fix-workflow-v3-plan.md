# Workflow v3 修复方案（T003 任务）

> 目的：基于 `docs/reviews/workflow-v3-postmortem-T002.md`（16 项改进）制定完整修复计划
> 验证依据：专家评审 9.2/10
> 创建日期：2026-06-12
> 任务编号：T003-fix-workflow-v3

---

## 一、方案概述

### 1.1 目标

将 workflow-v3 从"架构正确但实现有缺陷"升级为"可信赖的自动化流程"。修复 16 项问题，按优先级分批推进。

### 1.2 范围

| 类别 | 数量 | 优先级 |
|------|------|--------|
| A. Gate 与验证 | 3 | 🔴 高 |
| B. Subagent 安全 | 2 | 🟡 中（B4 修正为简化）|
| C. 评审与质量 | 3 | 🟡 中 |
| D. 上下文与 Handoff | 3 | 🟡 中（2 项）/ 🟢 低（1 项）|
| E. 状态管理 | 1 | 🟡 中 |
| F. UX 与知识管理 | 4 | 🟡 中（2 项）/ 🟢 低（2 项）|

### 1.3 不变项（5 条经 T002 验证正确）

| # | 不变项 | 理由 |
|---|--------|------|
| 1 | 派发 prompt「只返回路径+摘要」 | subagent 不应做自我验证 |
| 2 | 主 Agent「只传路径不传内容」 | 上下文隔离有效 |
| 3 | Subagent 不附验证证据 | 主 Agent 自己跑命令验证 |
| 4 | 状态机落盘 + git 持久化 | 多轮中断恢复依赖此机制 |
| 5 | P1-P7 阶段划分和文件目录结构 | 完整跑通且可追溯 |

---

## 二、修复内容详细设计

### A. Gate 与验证（🔴 高优先级）

#### A1. Gate 判定必须跑命令，不只读文件

**现状**：
- v3 gate 判定依赖读 subagent 产出文件的字段（如 `unit.md` 的 `failed: 0`）
- subagent 写的文件不可信

**修复设计**：

修改 `state-machine.md` 的转移规则：

| 阶段 | 当前判定 | 修复为 |
|------|----------|--------|
| P3→P4 | 读文件确认 test 存在 | 主 Agent 跑 `scripts/check-tdd-red.sh` 退出 0：`assertion_failures > 0 AND collection_errors == 0` |
| P4→P5 | 读 P4-implementation/ 存在 | 主 Agent 读目录列出文件 + `git log --oneline -1` 确认最近 commit 含 P4 代码 |
| P5→P6 | 读 unit.md 的 `failed` 字段 | 主 Agent 跑 `pytest -q` 捕获 exit code 0 且 `failed=N` 行 N=0 |
| P6→P7 | 读 P6-consistency.md 无 BLOCKER | 主 Agent grep 确认无 `[BLOCKER]` 标记（**已知限制**：P6 为定性分析，不可全自动验证；主 Agent 可抽查 1-2 条一致性声明 vs 实际代码确认，完整性由 P5 回归测试兜底）|
| P7→READY | 读 P7-release.md 存在 | 主 Agent 跑项目配置的发布检查命令（默认 `make pre-publish`，含前端构建；纯后端任务可配 `make test && make lint` 跳过构建）+ `git diff` 确认 version bump + CHANGELOG 更新 |

**为什么不用 `git diff` 判定 P4→P5**：

v3 的 `git-integration.md` 规定「每阶段门槛通过后 commit」。P4 代码会在 P4 完成时 commit，主 Agent 执行 `git diff` 时工作区干净，无输出 → gate 永远失败。

替代方案：
- `git log --oneline -1` 确认最近 commit 包含 P4 实现文件
- 或 `git diff HEAD~1` 对比最近一次 commit

**为什么 P3→P4 用 `scripts/check-tdd-red.sh`**：

「失败均为 assertion failure」需要解析 pytest 输出（`FAILED` vs `ERROR`），LLM 解析同样不可靠（与 A1 教训一致——不可信 LLM 做的文本解析）。shell wrapper 输出机器可解析的「assertion_failures=N, collection_errors=M」，gate 判定为 `assertion_failures > 0 AND collection_errors == 0`。

**为什么 P6→P7 标注已知限制**：

P6 一致性是定性分析，无法自动化。即使主 Agent grep 无 `[BLOCKER]`，subagent 写「5/5 一致」但实际有遗漏也无法发现。完整性最终由 P5 回归测试兜底。

#### A2. 主 Agent 校验增加独立验证步骤

**修复设计**：

修改 `dispatch-protocol.md` 的「subagent 返回校验」4 条规则，**增加第 5 条**：

```markdown
### 5. 独立验证 subagent 的声明

主 Agent 必须亲自执行 gate 命令验证门槛，不能仅凭 subagent
返回的摘要或产出文件中的声明判定通过。

例：P5 subagent 说 "failed=0" → 主 Agent 跑 pytest -q
    确认 exit 0 且 failed 行确实为 0，才算通过。
```

**不变项**：
- 派发 prompt「只返回路径+摘要」继续保留
- subagent 仍不附验证证据

#### A3. P7 重定义为「发布准备」，发布由人触发

**修复设计**：

修改 `state-machine.md` 的 P7 状态定义：

| 原状态机 | 新状态机 |
|----------|----------|
| `P7 --[P7-release.md 存在]--> DONE` | `P7 --[make pre-publish exit 0 AND git diff 确认 version bump AND CHANGELOG 更新]--> READY` |
| DONE = 任务完成 | `READY --[人手动 make publish]--> DONE` |

**新概念**：

| 概念 | 含义 | 谁执行 |
|------|------|--------|
| 发布准备 (READY) | version bump + CHANGELOG + lint + test 全通过 | Subagent + 主 Agent 验证 |
| 发布 (DONE) | 上传到 PyPI/npm | 人手动触发 |

**修改文件**：
- `state-machine.md`：转移规则
- `dispatch-protocol.md`：阶段说明
- `README.md`：P7 阶段总览

---

### B. Subagent 安全

#### B4. Subagent 硬超时保护（修正方案）

**原方案问题**：
- 主 Agent 检查 subagent 产出文件进展 → OpenCode 阻塞模型下不可行
- 主 Agent 调 `task` 工具后被阻塞，无法并发检查

**修正方案**：

修改 `dispatch-protocol.md`，增加以下规则：

```markdown
## Subagent 硬超时

### 1. 硬超时
- `task` 工具设 generous timeout（默认 10 分钟）
- 防止无限等待（死循环、无限重试）

### 2. 进展标记
- 派发 prompt 要求 subagent 每隔若干关键操作输出进展标记：
  `[progress] N/M files processed`
- 标记输出到 stdout，让平台日志可追溯

### 3. 存活检查（已知限制）
- 真正的存活监控（心跳、文件增长检测）需平台原生支持并发后补
- 当前仅记录为已知限制
```

#### B5. Subagent 升级机制 + P1 范围把关

**修复设计**：

修改 `dispatch-protocol.md`，增加升级机制：

```markdown
## Subagent 升级机制

subagent 可在产出文件中标注 `[UPGRADE]` 并附建议：
> 建议拆分为 Txxx-a / Txxx-b，原因：xxx

主 Agent 看到 `[UPGRADE]`：
1. 停止自动流程
2. 状态置为 PAUSED
3. 交人工决策
```

**P1 范围把关**（修改 `dispatch-protocol.md` 的 P1 阶段说明）：

```markdown
## P1 范围把关

触发条件（满足任一）：
- 任务优先级 P0/P1
- 任务涉及架构变更
- 任务范围跨越 3+ 模块

触发后，在 P1 完成后派发 `office-hours`（YC 合伙人）评审
审问题定义是否准确、范围是否合理、AC 是否可验证
```

---

### C. 评审与质量

#### C6. 专家组并行评审 + 组长汇总

**修复设计**：

修改 `dispatch-protocol.md`，增加并行评审流程：

```markdown
## 专家组并行评审 + 组长汇总

P2 评审 = 并行派发 N 个评审 + 组长汇总：

### Step 1：并行派发
主 Agent 同时派发 N 个评审（多个 task 调用）：
├── plan-eng-review   → P2-review-eng.md
├── plan-ceo-review   → P2-review-ceo.md
└── cso               → P2-review-cso.md

### Step 2：派发组长
所有评审返回后，组长汇总：
- 角色：review 角色 + 指定为「专家组组长」
- 输入：所有评审文件路径
- 任务：汇总、去重、归类（BLOCKER/建议/可忽略）、标注分歧
- 输出：P2-review.md（统一 status: approved/rejected）

### 组长规则
- 组长不发表新意见，只汇总
- 任何专家标 BLOCKER → status: rejected
- 多位专家分歧 → 标「专家组分歧」交人工
- 全票无 BLOCKER → status: approved
```

P4 后评审同理（review + cso + design-review 并行）。

#### C7. P1 问题定义增加可选评审

**修复设计**：

修改 `dispatch-protocol.md` P1 阶段说明：

```markdown
## P1 后可选评审

### 触发条件
- 任务优先级 P0/P1
- 任务涉及架构变更
- 任务范围跨越 3+ 模块

### 评审角色
`office-hours`（YC 合伙人）

### 评审内容
- 问题定义是否准确
- 范围是否合理
- AC 是否可验证
```

#### C8. P6 增加双向一致性检查

**修复设计**：

修改 `assets/execution-roles/architect.md` 的 P6 部分：

```markdown
## P6 一致性检查（双向）

### 方向 1：设计 → 实现
对照 P2-design.md 检查代码实现
- 偏差用 [BLOCKER] 或 [OK] 标记

### 方向 2：实现 → 设计（新增）
对照代码变更，检查设计文档中是否有不再适用的要求
- 为已否决方案写的 AC（僵尸需求）→ [DEVIATION]
- 已废弃的约束 → [DEVIATION]
- 实现超出设计但合理 → [EXTENSION]
```

---

### D. 上下文与 Handoff

#### D9. 派发 Prompt 增加项目上下文固定段

**修复设计**：

修改 `assets/templates/dispatch-prompt.md`，增加固定段：

```markdown
## 项目上下文（必读，每个 subagent 都需要）
- {project_conventions_file}（项目约定、命名规范、目录结构）
- {project_index_file}（项目总览）
- docs/process/workflow-v3/README.md（流程规范）

本项目关键约定（从项目配置摘要，不替代读原文）：
{project_summary}
```

**占位符映射**（PeekView）：
- `{project_conventions_file}` = `CLAUDE.md`
- `{project_index_file}` = `INDEX.md`
- `{project_summary}` = 从 `OPENCODE.md` 摘要

**通用性约束**：所有项目特定路径用 `{placeholder}`，不硬编码到 v3 规范。

#### D10. P2→P4 方案答疑闭环（🟢）

**修复设计**：

修改 `assets/execution-roles/implementer.md`：

```markdown
## P4 实现答疑

如对 P2 方案有疑问，在产出文件中标注 `[CLARIFY: xxx]`：
> [CLARIFY: 方案 §3 中的边界情况应该如何处理？]

主 Agent 看到 [CLARIFY] → 暂停 → 派发 architect 解答 → 回到 P4
```

#### D11. 文件路径显式声明（修正方案）

**修复设计**：

修改 `assets/templates/task-files.md`：

```markdown
## 文件路径（占位符化）

| 阶段 | 占位符 | 含义 |
|------|--------|------|
| P3 | {test_code_dir} | 测试代码目录（项目自定义） |
| P4 | {implementation_dir} | 源码目录（项目自定义） |
| P5 | {test_results_dir} | 测试结果目录 |
```

**占位符声明位置**：
- P3-test-cases.md 必须显式声明：`test_code_dir: {实际路径}`
- P4-implementation.md 必须显式声明：`implementation_dir: {实际路径}`
- 派发 prompt 引用声明而非固定路径

---

### E. 状态管理

#### E12. 每任务独立 .state.yaml

**修复设计**：

修改 `state-machine.md`，增加：

```markdown
## 状态文件结构

### 每任务独立状态文件
位置：`docs/tasks/{Txxx}/.state.yaml`

格式：
```yaml
task_id: T002
phase: P4
status: in_progress
retry: { P2: 0, P4: 0, P5: 0 }
updated: 2026-06-12
```

### active-tasks.md 降级为汇总视图
- 不再由 subagent 直接修改
- 由主 Agent 在 push 前重建（扫描所有 .state.yaml）
- 消除多 Agent 并发冲突

### .state.yaml commit 时机

与 gate commit 同步——一次 commit 包含：
- stage output file（新阶段的产出文件）
- `.state.yaml` 更新（阶段前进）
- active-tasks.md 重建（如有变更）

避免「commit 了 stage output 但 .state.yaml 还是上一阶段状态」的不一致。
```

**修改文件**：
- `state-machine.md`：状态结构
- `active-tasks.md`：使用说明
- `git-integration.md`：并发策略 + commit 时机说明

---

### F. UX 与知识管理

#### F13. /loop 每阶段输出进度

**修复设计**：

修改 `loop-orchestration.md`，增加：

```markdown
## 进度输出

每个阶段完成后主 Agent 输出一行进度：

[T002] P4 done (14/14 passed) → P5
[T002] P5 done (failed=0, P1 3/3) → P6
[T002] P6 done (5/5, 无 BLOCKER) → P7

档位 C 全自动也至少输出进度行。
```

#### F14. Lessons Learned 按类别组织（🟢）

**修复设计**：

修改 `assets/execution-roles/implementer.md` P7 部分：

```markdown
## P7 沉淀 Lessons Learned

P7 产出文件增加「Lessons Learned」节（2-3 条关键教训）。

主 Agent 将这些汇入项目级 docs/process/lessons.md。

**组织方式**：按类别（安全/架构/流程/测试），方便检索。
每条教训标注来源任务和日期。
```

#### F15. 任务依赖管理（🟢）

**修复设计**：

修改 `active-tasks.md`，增加「依赖」列：

```markdown
| 序号 | 任务名 | 状态 | 阶段 | 依赖 |
|------|--------|------|------|------|
| T002 | fix-db-migration | ✅✅ 已完成 | — | — |
| T003 | fix-workflow-v3 | ⬜ 待开始 | — | T002 |
```

主 Agent 启动任务前检查依赖列：所有依赖任务状态为 DONE 才启动。

#### F16. 主 Agent 任务完成后输出结构化小结

**修复设计**：

修改 `dispatch-protocol.md`，增加任务完成小结模板：

```markdown
## 任务完成小结

DONE 后主 Agent 输出固定格式：

[T002] DONE — 数据库迁移机制修复 v0.1.53

改动：exceptions.py +18 / database.py +51 / cli.py +7 / main.py +2
验证：14/14 migration tests + 486 regression tests
说明：Server 独占迁移，CLI schema 兼容检查
```

**字段来源**：
- 改动行数：`git diff --stat`
- 验证结果：各阶段 gate check 的输出拼出
- 说明：P2-design.md 摘要

---

## 三、修改文件清单

| 文件 | 修改内容 | 涉及项 |
|------|----------|--------|
| `state-machine.md` | Gate 命令化 + P7 重定义 + .state.yaml | A1, A3, E12 |
| `dispatch-protocol.md` | 独立验证 + 硬超时 + 升级 + P1 评审 + 进度 + 小结 | A2, B4, B5, C7, F13, F16 |
| `role-system.md` | 专家组并行评审 + 组长汇总 | C6 |
| `assets/execution-roles/architect.md` | P6 双向一致性 | C8 |
| `assets/execution-roles/implementer.md` | P4 答疑 + P7 Lessons | D10, F14 |
| `assets/execution-roles/analyst.md` | P1 范围把关说明 | B5 |
| `assets/templates/dispatch-prompt.md` | 项目上下文固定段 | D9 |
| `assets/templates/task-files.md` | 路径占位符化 | D11 |
| `loop-orchestration.md` | 进度输出 | F13 |
| `active-tasks.md` | 依赖列 | F15 |
| `README.md` | P7 概念说明 + 状态机 | A3, E12 |

---

## 四、实施分批

### 4.1 分批策略

按依赖关系分 4 批，每批内部修复项可独立验证：

| 批次 | 修复项 | 优先级 | 风险 |
|------|--------|--------|------|
| **第一批** | A1 + A2 + A3 | 🔴 高 | 中（gate 改造影响所有阶段）|
| **第二批** | B4 + B5 + C6 + C7 + C8 | 🟡 中 | 低（增补不破坏现有）|
| **第三批** | D9 + D10 + D11 + E12 | 🟡/🟢 | 中（涉及目录结构变化）|
| **第四批** | F13 + F14 + F15 + F16 | 🟡/🟢 | 低（UX 改进）|

### 4.2 实施原则

| 原则 | 说明 |
|------|------|
| **每批独立验证** | 修复完一批后跑 T002（或新造一个测试任务）验证 |
| **失败即停** | 某批验证失败 → 修复该批 → 重新验证 |
| **文档同步** | 修复同时更新 `CHANGELOG.md` 和 `version` |
| **评审把关** | 每批修复后写 `expert-review-T003-batch-N.md` |

---

## 五、验证方案

### 5.1 单元验证

每批修复后执行：
```bash
# 验证文档一致性
make check-doc-sync

# 验证示例命令（如有）
pytest -q tests/test_v3_validation.py -v
```

### 5.2 集成验证

修复完所有 4 批后，**重跑 T002**（数据库迁移任务）：

| 验证点 | 期望 |
|--------|------|
| Gate 命令化生效 | pytest exit 0 才进 P6 |
| 独立验证生效 | 主 Agent 跑命令验证 subagent 声明 |
| P7 重定义生效 | READY 状态需 `make pre-publish` + git diff |
| 状态机正确 | 每阶段转移符合新规则 |
| 总结结构化 | 任务完成有标准格式小结 |

### 5.3 回归测试

| 测试 | 方法 |
|------|------|
| A1 修复 | 故意让 subagent 写错误数字 → 主 Agent 跑 pytest 抓出 |
| A3 修复 | P7 不再要求人执行 `make publish` 才能 DONE |
| E12 修复 | 模拟两个 agent 并发修改不同任务 → 无 git 冲突 |

---

## 六、风险与回退

### 6.1 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Gate 命令化破坏现有任务 | 高 | 保留读文件逻辑作为 fallback，命令化作为优先 |
| 状态机修改影响中断恢复 | 中 | 状态文件兼容旧格式，主 Agent 自动迁移 |
| 占位符化不完整 | 中 | 评审时专项检查所有模板 |

### 6.2 回退方案

如果某批修复验证失败：
1. `git revert` 该批 commit
2. 记录失败原因到 `docs/process/lessons.md`
3. 调整方案后重新实施

---

## 七、验收标准

### 7.1 文档验收

- [ ] 16 项改进全部落实到具体文件
- [ ] 不变项 5 条未被破坏
- [ ] 占位符化防止项目特定路径硬编码
- [ ] CHANGELOG.md 更新

### 7.2 行为验收

- [ ] T002 重跑通过所有 P1-P7 门槛
- [ ] Gate 判定全部由主 Agent 跑命令验证
- [ ] P7→READY 需 `make pre-publish` + git diff
- [ ] 多 Agent 并发无 git 冲突（`.state.yaml` 隔离）

### 7.3 评审验收

- [ ] 每批修复后有专家评审
- [ ] 评分 ≥ 9.0/10
- [ ] 评审意见全部处理

---

## 八、时间估算

| 批次 | 修复项数 | 预估工作量 |
|------|----------|------------|
| 第一批 | 3 | 2-3 小时（gate 改造需要细致测试）|
| 第二批 | 5 | 2-3 小时（增补为主）|
| 第三批 | 4 | 3-4 小时（涉及状态文件结构变化）|
| 第四批 | 4 | 1-2 小时（UX 改进）|
| 验证 | T002 重跑 | 1-2 小时 |
| **总计** | **16 项** | **9-14 小时** |

---

## 九、任务编号

**T003-fix-workflow-v3** 包含本方案所有 16 项修复。

子任务编号：
- T003-batch-1：Gate 与验证（A1+A2+A3）
- T003-batch-2：安全与评审（B4+B5+C6+C7+C8）
- T003-batch-3：上下文与状态（D9+D10+D11+E12）
- T003-batch-4：UX 与知识（F13+F14+F15+F16）

---

## 十、评审修正记录

> 评审：`docs/reviews/expert-review-T003-plan-2026-06-12.md`（8.6/10）
> 修正日期：2026-06-12

### 中危修正（🟡）

#### 修正 1：P4→P5 gate `git diff` 不可用

**原方案**：
```
P4→P5 | 主 Agent 读目录列出文件 + `git diff` 确认有代码改动
```

**问题**：v3 在 P4 完成时 commit，主 Agent 执行 `git diff` 时工作区干净，无输出。

**修正**：
```
P4→P5 | 主 Agent 读目录列出文件 + `git log --oneline -1` 确认最近 commit 含 P4 代码
```

#### 修正 2：P3→P4 assertion failure 解析方案

**原方案**：
```
P3→P4 | 主 Agent 跑 `pytest --collect-only -q` 收集成功 + 失败均为 assertion failure
```

**问题**：LLM 解析 pytest 输出（`FAILED` vs `ERROR`）同样不可靠。

**修正**：
```
P3→P4 | 主 Agent 跑 `scripts/check-tdd-red.sh` exit 0：
       assertion_failures > 0 AND collection_errors == 0
```

新增 shell wrapper（`scripts/check-tdd-red.sh`）输出机器可解析字段。

#### 修正 3：P6→P7 gate 标注已知限制

**原方案**：
```
P6→P7 | 主 Agent grep 确认无 `[BLOCKER]` 标记
```

**问题**：P6 是定性分析，不可全自动验证（违反 A1 原则）。

**修正**：
```
P6→P7 | 主 Agent grep 确认无 `[BLOCKER]` 标记
       （已知限制：P6 为定性分析，不可全自动验证。
        主 Agent 可抽查 1-2 条一致性声明 vs 实际代码确认。
        完整性最终由 P5 回归测试兜底。）
```

### 低危修正（🟢）

#### 修正 4：P7 gate 命令可配置

**原方案**：
```
P7→READY | 主 Agent 跑 `make pre-publish` exit 0
```

**修正**：
```
P7→READY | 主 Agent 跑项目配置的发布检查命令
          | 默认 `make pre-publish`（含前端构建）
          | 纯后端任务可配置为 `make test && make lint`（跳过构建）
```

#### 修正 5：`.state.yaml` commit 时机

**原方案**：未明确定义。

**修正**：与 gate commit 同步——一次 commit 包含 stage output + `.state.yaml` 更新 + active-tasks.md 重建。

### 修正后评分

| 维度 | 修正前 | 修正后 |
|------|--------|--------|
| 方案完整性 | 10/10 | 10/10 |
| 技术正确性 | 7/10 | 9/10 |
| 实现可行性 | 8/10 | 9/10 |
| 分批策略 | 9/10 | 9/10 |
| 标准化 | 9/10 | 10/10 |
| **整体** | **8.6/10** | **9.4/10** |

---

*方案创建：2026-06-12*
*评审依据：workflow-v3-postmortem-T002.md + expert-review 9.2/10*
*修正后：expert-review-T003-plan-2026-06-12.md 全部 5 项已处理*