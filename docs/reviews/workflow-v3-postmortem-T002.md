---
review_type: postmortem
task: T002
date: 2026-06-12
author: 主 Agent (T002 编排者)
trigger: T002 P7 完成后 PM 发现 5 个问题，深入分析后扩展为 16 项改进
status: final
---

# Workflow-v3 复盘：T002 暴露的机制缺陷与改进建议

## 背景

T002（数据库迁移机制修复）是 v3 规范下跑完的第一个完整 P1-P7 任务。PM 在 P7 完成后指出 5 个问题，经系统分析后归纳为 **6 个类别、16 项改进**。

---

## 原始问题回溯

| # | PM 反馈 | 暴露的机制问题 |
|---|---------|---------------|
| 1 | 小结缺失，只有版本号无改动说明 | 主 Agent 未做总结（编排层职责缺失） |
| 2 | CHANGELOG 有更新但没看到 | 同上 |
| 3 | P1 AC 定义不合理（AC6 为已否决方案而写） | P6 单向检查漏过 + P1 无评审把关 |
| 4 | PyPI 未发布，仍是 v0.1.52 | P7 gate 定义错误（文件存在 ≠ 已发布） |
| 5 | 主 Agent 全面相信 subagent，未验证 | Gate 验证读文件而非跑命令 |

---

## A. Gate 与验证（影响正确性）— 3 项

### A1. Gate 判定必须跑命令，不只读文件 🔴

**问题**：v3 所有 gate 判定依赖「读 subagent 产出文件的字段」（`unit.md` 里 `failed: 0`、`P7-release.md` 存在）。**subagent 写的文件本质不可信**——它可以写任何东西，主 Agent 无法分辨真假。

只有主 Agent 自己观测到的结果才可信：自己跑的 `pytest -q` 的 exit code、自己跑的 `make lint` 的输出、自己 `git diff` 看到的内容。

**修复**：

| 阶段 | 当前判定 | 修复为（主 Agent 亲自执行） |
|------|----------|--------------------------|
| P3→P4 | 读文件确认 test file 存在 | `pytest --collect-only -q` 收集成功 + 所有失败均为 assertion failure（非 error） |
| P5→P6 | 读 unit.md 的 failed 字段 | `pytest -q` exit 0（亲手跑，不相信 unit.md） |
| P7→DONE | P7-release.md 存在 | `make pre-publish` exit 0 + `git diff` 确认 version bump + CHANGELOG 更新 |

**手动验证项的处理**：P5 的 manual.md 含手工检查结论（如逐个对照 P1 问题），主 Agent 无法自动化验证。但自动化部分（pytest 全绿 + lint 通过）独立验证通过后，手动部分合理可信。

> 命令输出引入主 Agent 上下文（如 pytest 结果行），但量极小（<10 行），远小于读文件全文。

### A2. 主 Agent 校验增加独立验证步骤 🔴

**问题**：`dispatch-protocol.md` 的「subagent 返回校验」4 条都是存在性检查（文件在不在、Header 合不合法、内容空不空）。没有「主 Agent 独立验证 subagent 声明」这一步。

**修复**：增加第 5 条校验规则：

```
5. 独立验证 subagent 的声明：
   主 Agent 必须亲自执行 gate 命令验证门槛，不能仅凭 subagent
   返回的摘要或产出文件中的声明判定通过。

   例：P5 subagent 说 "failed=0" → 主 Agent 跑 pytest -q
       确认 exit 0 且 failed 行确实为 0，才算通过。
```

**不变项**：派发 prompt 模板「只返回路径 + 一句话摘要」是正确的——subagent 不应附验证证据，它写的不可信。验证必须由主 Agent 独立完成。

### A3. P7 重定义为「发布准备」，发布由人触发 🔴

**问题**：`state-machine.md` 定义 `P7 --[P7-release.md 存在]--> DONE`。两层错误：

- P7 不等于「已发布」——不是每次任务都需要发版到 PyPI（内部重构、文档变更不需要）
- 真正发版是不可逆操作，不能交给 subagent 自动化

**修复**：P7 重定义为「发布准备」：

| 概念 | 含义 | 谁执行 |
|------|------|--------|
| 发布准备 (P7 gate) | version bump + CHANGELOG + lint + test 全通过 | Subagent 产出 + 主 Agent 验证 |
| 发布 (`make publish`) | 上传到 PyPI | 人手动触发 |

P7 gate = `make pre-publish` exit 0 + `git diff` 确认 version bump + CHANGELOG 更新。P7 完成后，人决定是否执行 `make publish`。

---

## B. Subagent 安全（影响可靠性）— 2 项

### B4. Subagent 存活监控（非简单超时杀死） 🔴

**问题**：subagent 可能无限等待（陷入循环、上下文压缩后胡言乱语、网络超时）。但简单设 timeout 不合理——部分任务天然需要长时间执行。

**修复**：分两层：

1. **硬超时**：task 工具设 generous timeout（如 10 分钟），防止无限等待
2. **存活检查**：subagent 在执行过程中向产出文件写入中间产物（阶段性 checkpoint）。主 Agent 检查文件是否有进展（文件增长、新文件出现）。如果一段时间无任何进展 → 判定卡死 → 终止 + 计入重试

**不是**「超过 N 秒就杀死」，而是「超过 N 秒无进展才杀死」。

### B5. Subagent 可请求任务升级/拆分 + P1 范围把关 🟡

**问题**：architect 发现「需求要拆成 3 个独立任务」或 implementer 发现「改动范围远超预期」——当前 subagent 只能硬扛或产出不合格文件。同时 P1 阶段没有评审，问题定义的质量（范围过大、AC 不合理）无人把关，到 P6 才发现。

**修复**：

1. **升级机制**：subagent 可在产出文件中标注 `[UPGRADE]` 并附建议（如「建议拆分为 Txxx-a / Txxx-b，原因：xxx」）。主 Agent 看到 `[UPGRADE]` → 停止自动流程 → PAUSED 交人工决策

2. **P1 把关**：大任务或业务关键任务在 P1 后派发 `office-hours` (YC 合伙人) 评审，审问题定义是否准确、范围是否合理、AC 是否可验证。`loop-orchestration.md` 已提到「拆成多个任务替代 agent 嵌套」，需要补充触发机制

---

## C. 评审与质量（影响质量）— 3 项

### C6. 专家组并行评审 + 组长汇总 🟡

**问题**：当前 v3 评审是串行单评审。P2 需要工程审 + 产品审 + 安全审，需串行派发 3 次。单一视角无法覆盖多个维度，多个意见散落无人汇总。

**修复**：

```
P2 评审 = 并行派发 N 个评审 + 组长汇总：

1. 主 Agent 同时派发 N 个评审（并行，task 工具多个调用）：
   ├── plan-eng-review   → P2-review-eng.md
   ├── plan-ceo-review   → P2-review-ceo.md
   └── cso               → P2-review-cso.md

2. 所有评审返回后，主 Agent 派发组长：
   ├── 角色：review 角色 + 指定为「专家组组长」
   ├── 输入：所有评审文件路径
   ├── 任务：汇总、去重、归类（BLOCKER/建议/可忽略）、标注分歧
   └── 输出：P2-review.md（统一 status: approved/rejected）
```

**组长规则**：
- 组长不发表新意见，只汇总、去重、标注冲突
- 任何一位专家标 BLOCKER → status: rejected
- 多位专家对同一问题有分歧 → 标「专家组分歧」交人工判断
- 全票无 BLOCKER → status: approved

P4 后评审同理（review + cso + design-review 并行）。

**实现基础**：v3 `loop-orchestration.md` 已识别「并行执行」为已知改进项，专家评审天然满足并行条件（各评审互不依赖，读同样的输入，产出各自文件）。

### C7. P1 问题定义增加可选评审 🟡

**问题**：P1 是后续所有阶段的基石，但当前没有评审环节。T002 的 AC6（为已否决方案写的验收标准）在 P1 就错了，到 P6 才发现。大任务的问题定义质量直接影响整个任务成败。

**修复**：P1 后增加可选评审节点。触发条件：
- 任务优先级 P0/P1 → 必须评审
- 任务涉及架构变更 → 必须评审
- 任务范围跨越 3+ 模块 → 必须评审

评审角色：`office-hours`（YC 合伙人），审问题定义是否准确、范围是否合理、AC 是否可验证。

### C8. P6 增加双向一致性检查 🟡

**问题**：P6 当前只做「设计文档要求 → 代码是否实现」的单向检查。漏掉了反向：「代码实现了但设计文档没要求的」和「设计文档有但已不适用」的情况。T002 的 AC6 属于后者。

**修复**：P6 角色定义增加第二方向检查：「对照代码变更，检查设计文档中是否有不再适用的要求（为已否决方案写的 AC、已废弃的约束）。如有则标 `[DEVIATION]`。」

---

## D. 上下文与 Handoff（影响质量）— 3 项

### D9. 派发 Prompt 增加项目上下文固定段 🟡

**问题**：subagent 每次从零开始理解项目，缺少项目级知识。

| 缺的上下文 | 后果 |
|-----------|------|
| 项目目录结构 | 不知道文件在哪，放错位置 |
| 命名/代码规范 | 代码风格不一致 |
| 技术选型 | 引入不兼容的库/模式 |
| 踩坑教训 | 重复已知错误（如 opencode.jsonc 自定义 agent 调不起来） |

**修复**：派发 prompt 模板增加固定段，所有 subagent 派发时自动注入：

```
## 项目上下文（必读，每个 subagent 都需要）
- CLAUDE.md（项目约定、命名规范、目录结构）
- INDEX.md（项目总览）
- docs/process/workflow-v3/README.md（流程规范）

本项目关键约定（从 CLAUDE.md 摘要，不替代读原文）：
- 后端包名 peekview（不是 peek）
- DI 通过 app.state（不是 module globals）
- 测试用 tmp_path fixture（不碰真实 ~/.peekview/）
```

主 Agent 派发任何 subagent 时自动插入这一段。

### D10. P2→P4 方案答疑闭环 🟢

**问题**：architect 写方案，implementer 独立实现。implementer 可能对方案理解有偏差，但没有答疑渠道。

**修复**：P4 dispatch prompt 加一句：「如对 P2 方案有疑问，在产出文件中标注 `[CLARIFY: xxx]`，主 Agent 会转交给 architect 解答」。P4 产出含 `[CLARIFY]` → 暂停 → 派发 architect 解答 → 回到 P4 继续。

### D11. 测试/代码文件路径显式声明 🟢

**问题**：v3 模板约定测试代码在 `docs/tasks/Txxx/P3-test-code/`，但实际项目测试在 `backend/tests/`。路径分散导致 subagent 找不到输入文件。

**修复**：`P3-test-cases.md` 和 `P4-implementation/implementation.md` 中必须显式声明实际文件路径，不在模板中推断。派发 prompt 引用这些声明而非固定路径。

---

## E. 状态管理（影响可靠性）— 1 项

### E12. 每任务独立状态文件，替代单一 active-tasks.md 🟡

**问题**：`active-tasks.md` 是单一文件，多 Agent 并发修改同一行 → git conflict。v3 `git-integration.md` 的缓解策略（「只改自己那行」）不可靠，rebase 仍会冲突。

**修复**：每任务独立状态文件 `docs/tasks/Txxx/.state.yaml`：

```yaml
task_id: T002
phase: P4
status: in_progress
retry: { P2: 0, P4: 0, P5: 0 }
updated: 2026-06-12
```

`active-tasks.md` 降级为汇总视图，由主 Agent 在 push 前重建（扫描所有 `.state.yaml`），不再由 subagent 直接修改。消除冲突源。

---

## F. UX 与知识管理（影响可用性）— 4 项

### F13. /loop 每阶段输出进度 🟡

**问题**：`/loop T002` 全自动跑，用户看到的是沉默 30 秒 → 突然返回结果。中间 P1-P7 每一步在干什么完全不可见。

**修复**：每个阶段完成后主 Agent 输出一行进度：

```
[T002] P4 done (14/14 passed) → P5
[T002] P5 done (failed=0, P1 3/3) → P6
[T002] P6 done (5/5, 无 BLOCKER) → P7
```

档位 C 全自动也至少输出进度行。

### F14. P7 沉淀 Lessons Learned → 项目知识库 🟢

**问题**：T002 学到的关键教训（不在生产 DB 上 ALTER TABLE、P1 要仔细定义 AC）散落在复盘文件里，下一个类似任务不会自动获得这些知识。

**修复**：P7 产出文件增加「Lessons Learned」节（2-3 条关键教训）。主 Agent 将这些汇入项目级 `docs/process/lessons.md`（按任务索引，标注日期和来源）。后续 subagent 通过「项目上下文」固定段自动读取。

### F15. 任务依赖管理 🟢

**问题**：`active-tasks.md` 有优先级列但无依赖声明。T003（v3 改进）依赖 T002 的经验，但当前无「T003 依赖 T002 完成后才能开始」的机制。

**修复**：任务表增加「依赖」列：

```markdown
| T002 | fix-db-migration | ✅✅ 已完成 | — |
| T003 | fix-workflow-v3  | ⬜ 待开始   | T002 |
```

主 Agent 在开始任务前检查依赖列：所有依赖任务状态为 DONE 才启动。

### F16. 主 Agent 任务完成后输出结构化小结 🟡

**问题**：T002 完成后主 Agent 只说了「v0.1.53 发布」，没有改动摘要、验证结果、影响范围。

**修复**：DONE 后主 Agent 输出固定格式的小结：

```
[T002] DONE — 数据库迁移机制修复 v0.1.53

改动：exceptions.py +18 / database.py +51 / cli.py +7 / main.py +2
验证：14/14 migration tests + 486 regression tests
说明：Server 独占迁移，CLI schema 兼容检查
```

不需要读文件全文——从各阶段 gate check 的输出就能拼出。

---

## 改进总表（按优先级排序）

| # | 类别 | 改进项 | 影响文件 | 优先级 |
|---|------|--------|----------|--------|
| A1 | Gate | Gate 判定必须跑命令，不只读文件 | `dispatch-protocol.md` | 🔴 高 |
| A2 | Gate | 主 Agent 校验增加第 5 条「独立验证 subagent 声明」 | `dispatch-protocol.md` | 🔴 高 |
| A3 | Gate | P7 重定义为「发布准备」；发布由人手动触发 | `dispatch-protocol.md`, `state-machine.md` | 🔴 高 |
| B4 | 安全 | Subagent 存活监控（硬超时 + 进展检查，非简单杀死） | `dispatch-protocol.md` | 🔴 高 |
| B5 | 安全 | Subagent 可请求升级拆分 + P1 范围把关 | `dispatch-protocol.md`, `state-machine.md` | 🟡 中 |
| C6 | 评审 | 专家组并行评审 + 组长汇总 | `dispatch-protocol.md`, `role-system.md` | 🟡 中 |
| C7 | 评审 | P1 问题定义增加可选评审 | `dispatch-protocol.md` | 🟡 中 |
| C8 | 评审 | P6 增加双向一致性检查 | `assets/execution-roles/architect.md` | 🟡 中 |
| D9 | 上下文 | 派发 prompt 模板增加「项目上下文」固定段 | `assets/templates/dispatch-prompt.md` | 🟡 中 |
| D10 | 上下文 | P2→P4 方案答疑闭环 | `dispatch-protocol.md` | 🟢 低 |
| D11 | 上下文 | 测试/代码文件路径显式声明 | `assets/templates/task-files.md` | 🟢 低 |
| E12 | 状态 | 每任务独立 .state.yaml，active-tasks.md 降级为汇总 | `state-machine.md`, `active-tasks.md` | 🟡 中 |
| F13 | UX | /loop 每阶段输出进度 | `loop-orchestration.md` | 🟡 中 |
| F14 | 知识 | P7 沉淀 Lessons Learned → 项目知识库 | `assets/execution-roles/implementer.md` | 🟢 低 |
| F15 | UX | 任务依赖管理 | `active-tasks.md` | 🟢 低 |
| F16 | UX | 主 Agent 任务完成后输出结构化小结 | `dispatch-protocol.md` | 🟡 中 |

---

## 不变项

以下 v3 设计原则经 T002 验证是**正确的**，不需要改：

- 派发 prompt 模板「只返回路径 + 一句话摘要」（subagent 不应做自我验证）
- 上下文隔离原则「主 Agent 只传路径不传内容」
- Subagent 不应在产出文件中附验证证据（它写的不可信，主 Agent 自己跑命令验证）
- 状态机落盘 + git 持久化的基础机制
- P1-P7 阶段划分和文件目录结构

---

## 是否创建 T003

以上 16 项改进建议作为一个任务跟踪。候选名：

**`T003-fix-workflow-v3-mechanisms`**

建议首批实现 A1-A3 + B4（4 个高优先），其余在后续迭代中按优先级推进。
