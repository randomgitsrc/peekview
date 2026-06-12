# Workflow v3 — 子 Agent 编排工作流

> 版本：v3.0
> 创建：2026-06-11
> 取代：`docs/process/workflow-v2.md`（v2 描述了架构但缺少可执行的派发协议）
> 适用：OpenCode / Claude Code / Codex 等支持 subagent 的 Agent 平台

---

## 为什么有 v3

v2 描述了"主 Agent 编排、子 Agent 执行各阶段"的理想架构，但实践中暴露两个问题：

1. **主 Agent 不派发子 Agent，自己一路走到底** → 所有阶段上下文堆在一个会话，触发自动压缩。根因：v2 只有描述性的"主 Agent 写入上下文给子 Agent"，没有**可执行的派发指令**（用什么工具、传什么、怎么返回）。LLM 面对模糊指令时选择阻力最小的路径——自己继续做。

2. **角色库只有评审角色，没有执行角色** → P1/P2/P4 这些需要"执行者"的阶段，没有对应的角色定义，只能套用通用 agent。

v3 的核心改进：

- **可执行的派发协议**：明确"用 task 工具派发 subagent"、"只传文件路径不传内容"、"门槛可判定"、"状态落盘"
- **双层角色体系**：执行角色（execution-roles）+ 评审角色（review-roles），都收拢在 `assets/`
- **状态机落盘**：任务状态存在文件里，不在 LLM 记忆里，支持中断恢复
- **可选的 /loop 编排**：自动读状态 → 派发 → 检查 → 推进

---

## 目录结构

```
docs/process/workflow-v3/
├── README.md                    # 本文件：主流程
├── dispatch-protocol.md         # 子 Agent 派发协议（核心，解决问题 1）
├── role-system.md               # 双层角色体系说明（解决问题 2）
├── loop-orchestration.md        # /loop 自动编排设计
├── state-machine.md             # 状态机落盘设计
├── git-integration.md           # 状态落盘的 git 持久化（多 agent 协作）
├── validation-plan.md           # 落地验证方案（投入真实任务前先跑这个）
└── assets/
    ├── review-roles/            # 评审角色库（从 gstack 提取）
    │   ├── review.md            # /review 偏执 Staff Engineer
    │   ├── plan-ceo-review.md   # /plan-ceo-review 创始人/CEO
    │   ├── plan-eng-review.md   # /plan-eng-review 工程经理
    │   ├── design-review.md     # /design-review 高级设计师+前端
    │   ├── plan-design-review.md
    │   ├── qa.md                # /qa QA 工程师
    │   ├── investigate.md       # /investigate 调试专家
    │   ├── office-hours.md      # /office-hours YC 合伙人
    │   └── cso.md               # /cso 安全官
    ├── execution-roles/         # 执行角色库（v3 新增）
    │   ├── analyst.md           # P1 问题分析师
    │   ├── architect.md         # P2 方案设计师
    │   ├── test-designer.md     # P3 测试设计师
    │   ├── implementer.md       # P4 实现工程师
    │   └── verifier.md          # P5 验证工程师
    └── templates/
        ├── custom-role.md       # 自定义角色模板
        ├── dispatch-prompt.md   # 派发 prompt 模板
        └── task-files.md        # 各阶段产出文件模板
```

---

## 任务目录命名约定（重要）

任务目录名是 **`Txxx-描述`** 格式，不是纯编号。实际例子：
```
docs/tasks/T001-mcp-namespace-map/
docs/tasks/T002-fix-db-migration/
```

本文档及模板中的 `{Txxx}` / `{task_id}` 是占位简写，**实际拼路径时必须用完整目录名**（含描述后缀）。主 Agent 派发时，要先确认实际目录名（`ls docs/tasks/`），不要假设是纯 `T002`——按 `docs/tasks/T002/` 拼路径会找不到文件。

## 适用边界（v3 不适合什么）

v3 的派发机制有固定开销——每次派发约需写 25 行派发 prompt。**只有当"被隔离的内容量" > "派发开销"时，走 v3 才划算。**

| 任务类型 | 建议 |
|----------|------|
| 微任务（typo、文案、单行配置）| 直接做，不走 v3 |
| 小任务（明确的 bug 修复、加一个字段）| 裁剪流程：P1 + P4 + P5，跳过 P2/P3/P6 |
| 中任务（新功能）| 完整 P1-P7 |
| 大任务（跨模块重构）| P1 拆成多个子任务，各自走 P1-P7 |

**粗略判据**：任务产出 < 100 行且无需评审 → 不值得走完整 v3，直接做或用裁剪流程。

### 可裁剪的阶段

- **核心阶段（不可跳）**：P1 定义、P4 实现、P5 验证
- **可选阶段（按需加）**：P2 设计+评审（方案不明确时）、P3 测试先行（需 TDD 时）、P6 一致性（多文件改动时）
- P1 分析师判定任务复杂度，在 task Header 声明 `phases: [P1,P4,P5]`，主 Agent 按声明推进，不强制全 7 阶段

---

## P1-P7 阶段总览

| 阶段 | 名称 | 执行角色 | 评审角色 | 门槛（进入下一阶段的条件）|
|------|------|----------|----------|--------------------------|
| P1 | 问题定义 | analyst | office-hours（大任务时按需）| P1-problems.md + P1-test-strategy.md 存在 |
| P2 | 方案设计 | architect | plan-eng-review / plan-ceo-review | P2-review.md 的 status == approved |
| P3 | 测试设计 | test-designer | gate 自检（TDD 红灯）| `scripts/check-tdd-red.sh` exit 0 |
| P4 | 代码实现 | implementer | review / cso（按需）| `git log --oneline -1` 含 P4 commit |
| P5 | 逐项验证 | verifier | gate 自检（pytest 全绿）| `pytest -q` exit 0 AND failed==0 |
| P6 | 一致性检查 | architect | gate 自检（grep BLOCKER）| 无 `[BLOCKER]` 标记 |
| P7 | 发布准备 | implementer | gate 自检（发布检查命令）| 发布检查命令 exit 0 + git diff 确认 version bump + CHANGELOG |
| READY | 待发布 | — | — | 人手动 `make publish` → DONE |

详细派发方式见 `dispatch-protocol.md`，角色定义见 `assets/`。

---

## 核心原则

### 原则 1：主 Agent 只编排，不执行

主 Agent 的职责严格限定为四件事：
1. 读状态（active-tasks.md + 当前阶段文件）
2. 派发 subagent（用 task 工具，见 dispatch-protocol.md）
3. 检查门槛（可判定条件）
4. 更新状态

**主 Agent 永远不自己写阶段产出（P1-problems.md、P2-design.md、代码……）。** 这些都由 subagent 在独立上下文里产出。

### 原则 2：上下文隔离 = 只传路径

派发 subagent 时，prompt 里只写**文件路径**，不塞文件内容。subagent 在自己的上下文窗口里读文件、干活，主 Agent 的上下文只增加"路径 + 一句话摘要"。

这是解决上下文爆炸的核心机制。

### 原则 3：状态在文件里，不在记忆里

任务的当前状态（在哪个阶段、哪些门槛过了）落盘到 `docs/tasks/Txxx/` 和 active-tasks.md。即使会话被压缩、中断、重启，主 Agent 重新读文件就能接着干。

**状态落盘必须配合 git 持久化**（见 git-integration.md）：每阶段门槛通过后主 Agent commit 一次，让状态真正持久、可恢复、可多 agent 共享。只写本地文件不 commit，崩溃就丢。

### 原则 4：门槛必须机器可判定

进入下一阶段的条件必须是文件里可读取的明确值（status==approved、failed==0），不能是"方案足够好"这类模糊判断。

### 原则 5：重试有上限

门槛不通过时打回重做，但有次数上限（默认 2-3 次）。超限则停下来报告人工介入，避免无限循环。

---

## 三种使用方式

### 方式 A：手动逐阶段（最稳）

人工逐个触发每个阶段的派发。主 Agent 派发一个 subagent，检查门槛，等人确认后派发下一个。适合关键任务、需要人工把关的场景。

### 方式 B：半自动（推荐）

主 Agent 连续派发，每过一个门槛自动推进，只在门槛失败或重试超限时停下来问人。详见 `loop-orchestration.md`。

### 方式 C：全自动 /loop（增强）

主 Agent 自动跑完 P1-P7，全程不需人工介入，只在最终发布前汇报。仅在方式 B 稳定后启用。详见 `loop-orchestration.md`。

---

## 与 v2 的迁移

- v2 的任务目录结构（`docs/tasks/Txxx/P1-P7`）**完全保留**，v3 不改文件组织
- v2 的门槛表保留并强化为"可判定条件"
- v2 缺的派发协议由 `dispatch-protocol.md` 补齐
- v2 引用的 gstack 角色库提取到 `assets/review-roles/`，不再外部引用

现有进行中的任务（T001、T002）可以继续用 v2 完成，新任务用 v3。

---

## 平台适配

不同 Agent 平台的 subagent 机制不同，派发协议的具体调用方式见 `dispatch-protocol.md` 的平台适配章节。已覆盖：

- **OpenCode**：`task` 工具 + markdown 文件定义自定义角色（注意 issue #29616：jsonc 定义的 subagent 可能调不起来，优先用 markdown 文件方式）
- **Claude Code**：Agent Teams（2026-02 起）+ Task 工具
- **Codex**：spawn_agent / wait / close_agent 工具套件

---

*主流程文档，详细机制见同目录其他文件*
