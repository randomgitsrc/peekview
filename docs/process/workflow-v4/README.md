# Workflow v4 — 子 Agent 编排工作流

> 版本：v4.0
> 适用：OpenCode / Claude Code / Codex 等支持 subagent 的 Agent 平台
> 这是当前唯一生效的开发流程。新 Agent 只需掌握本目录，无需了解历史版本。

---

## v4 是什么

v4 是一套「主 Agent 编排、子 Agent 执行」的开发流程。主 Agent 不亲自写代码或文档，而是把每个阶段派发给独立上下文的 subagent，自己只做四件事：读状态、派发、验门槛、更新状态。任务状态全部落盘到文件，会话中断也能恢复。

v4 建立在两条主线上：

**编排主线（继承自前代，已被真实任务验证）**
- 可执行的派发协议：用 task 工具派发 subagent，只传文件路径不传内容，门槛机器可判定，状态落盘
- 双层角色体系：执行角色（execution-roles）+ 评审角色（review-roles），收拢在 `assets/`
- 状态机落盘 + 可选的 /loop 自动编排

**需求与验收主线（v4 新增）**
- **P1 需求基线**：先质疑需求、识别隐含依赖、用 BDD 写验收条件，建立一条"活的"需求基线
- **SCOPE+ 贯穿反馈**：任何阶段的 subagent 发现新的隐含需求，都能向上反馈、增补基线，而非憋着或擅自扩大
- **P6 验收**：把 BDD 条件逐条实际跑一遍，结果翻译成人能看懂的行为描述
- **NEED_CONFIRM 按需介入**：需求明确时 Agent 自走并始终产出可见文件；只有判断拿不准方向时才停下找人

> 前代版本（v2 架构描述、v3 编排框架）已归档于 `docs/archived/process/`，仅供考古，日常开发不需要。

---

## 目录结构

```
docs/process/workflow-v4/
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
    ├── execution-roles/         # 执行角色库
    │   ├── analyst.md           # P1 需求分析师（需求质疑 + BDD 基线 + 能力预检）
    │   ├── architect.md         # P2 方案设计师（设计 + P7 一致性检查）
    │   ├── test-designer.md     # P3 测试设计师（TDD + E2E）
    │   ├── implementer.md       # P4 实现工程师（实现 + P8 多包发布）
    │   ├── verifier.md          # P5 技术验证 / P6 验收（BDD 实跑）
    │   └── vision-analyst.md    # UI 视觉结构分析（被 P6 verifier 按需派发）
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

## 适用边界（v4 不适合什么）

v4 的派发机制有固定开销——每次派发约需写 25 行派发 prompt。**只有当"被隔离的内容量" > "派发开销"时，走 v4 才划算。**

| 任务类型 | 建议 |
|----------|------|
| 微任务（typo、文案、单行配置、debug 后的精确修复）| 直接做，不走 v4 |
| 小任务（明确的 bug 修复、加一个字段）| 裁剪流程：P1 + P4 + P5（+ P6 若有 BDD 验收条件），跳过 P2/P3/P7 |
| 中任务（新功能）| 完整 P1-P8 |
| 大任务（跨模块重构）| P1 拆成多个子任务，各自走 P1-P8 |

### 可裁剪的阶段

- **核心阶段（不可跳）**：P1 需求基线、P4 实现、P5 技术验证
- **可选阶段（按需加）**：P2 设计+评审（方案不明确时）、P3 测试先行（需 TDD 时）、P6 验收（有明确 BDD 验收条件时）、P7 一致性（多文件改动时）
- P8 发布准备：涉及发布的任务必做
- **裁剪必须附理由**：P1 分析师判定复杂度后，在 `P1-requirements.md` 的「裁剪说明」节写明每个跳过阶段的理由；主 Agent 按声明推进，不强制全 8 阶段
- **裁剪不等于跳过需求质疑**：无论任务大小，P1 的需求基线（哪怕一句话）都要建立，因为隐含需求的识别不依赖任务规模

---

## P1-P8 阶段总览

| 阶段 | 名称 | 执行角色 | 评审角色 | 门槛（进入下一阶段的条件）|
|------|------|----------|----------|--------------------------|
| P1 | 需求基线 | analyst（需求质疑模式）| office-hours（大任务时按需）| P1-requirements.md 存在，含 BDD 验收条件；无未决 `[NEED_CONFIRM]` |
| P2 | 方案设计 | architect | plan-eng-review / plan-ceo-review | P2-review.md 的 status == approved；P2 声明 `packages:` `domains:` `ui_affected:` `gate_commands:` |
| P3 | 测试设计 | test-designer | gate 自检（TDD 红灯）| `scripts/check-tdd-red.sh` exit 0 |
| P4 | 代码实现 | implementer | review / cso（按需）| `git log --oneline -1` 含 P4 commit |
| P5 | 技术验证 | verifier | gate 自检（pytest 全绿）| `pytest -q` exit 0 AND failed==0 |
| P6 | 验收 | verifier（验收模式）| — | P6-acceptance.md 存在，BDD 条件逐条有实跑结果；UI 条件须 vision-analyst YAML `summary.blocker_count==0`；无未决 `[NEED_CONFIRM]` |
| P7 | 一致性检查 | architect | gate 自检（grep BLOCKER）| 无 `[BLOCKER]` 标记 |
| P8 | 发布准备 | implementer | gate 自检（发布检查命令）| 各 `package` 的发布检查命令 exit 0 + git diff 确认 version bump + CHANGELOG |
| READY | 待发布 | — | — | 人手动 `make publish` → DONE |

**P1 与 P6 的关系**：P1 用 BDD（Given/When/Then）写下"做完之后应该表现成什么样"，P6 把这些条件逐条实际跑一遍、把结果翻译成人能看懂的行为描述。P1 是"约定"，P6 是"兑现验证"。

**P6 vs P7 的区别**：P6 验收是"行为对不对"（用户视角，BDD 条件是否满足）；P7 一致性是"实现和设计一致不一致"（技术视角，代码是否偏离 P2）。两者关注点不同，不可互相替代。

详细派发方式见 `dispatch-protocol.md`，角色定义见 `assets/`。

---

## 核心原则

### 原则 1：主 Agent 只编排，不执行

主 Agent 的职责严格限定为四件事：
1. 读状态（active-tasks.md + 当前阶段文件）
2. 派发 subagent（用 task 工具，见 dispatch-protocol.md）
3. 检查门槛（可判定条件）
4. 更新状态

**主 Agent 永远不自己写阶段产出（P1-requirements.md、P2-design.md、代码……）。** 这些都由 subagent 在独立上下文里产出。

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

## 需求与验收机制（v4 核心）

v4 在编排之上加了一层"做对的事并持续校准"。三个机制贯穿全流程。

### 需求基线：活的、向前累加

P1 不是把需求一次性定死，而是建立一条**基线**：质疑原始需求、识别隐含依赖、用 BDD 写出验收条件。这条基线是"活的"——后续任何阶段都能向它增补，它永远是最新最全的需求真相源（写在 `P1-requirements.md`，后续增补也回写到这里）。

BDD 验收条件用 Given/When/Then 描述行为，例如：

```
Given 用户创建 entry 不指定过期时间
When  查询该 entry
Then  过期时间是创建时刻起 15 天后
```

写不出 BDD 条件，说明需求本身还不清楚——这本身就是需要 `[NEED_CONFIRM]` 的信号。

### [SCOPE+]：任何阶段都能向上反馈新需求

P1 不可能预见所有隐含需求。P2 设计、P4 实现时，subagent 常会发现"前序阶段没覆盖、但技术上必须做"的事。这时 subagent 在产出文件中标注：

```
[SCOPE+] 发现：createEntry 和 publishFiles 的 expires 参数类型不一致
         必须做的理由：不统一会导致 MCP 两个工具行为分叉
         影响：P1 基线需新增一条 BDD；涉及 packages: [mcp-server]
```

主 Agent 看到 `[SCOPE+]` → 把它翻译成 BDD 形式 → 增补进 P1 基线（标记 `[SCOPE+ from Pn]`）→ 按"定向回补"决定哪些已完成阶段需要局部更新。

**与 `[SCOPE_GAP]` 的区别**：`[SCOPE+]` 是"发现了所有人都没想到的新需求"（向上涨）；`[SCOPE_GAP]` 是"主 Agent 的 prompt 漏了 P2 已声明的东西"（向下漏，见 dispatch-protocol.md）。

### 定向回补：不全重跑，只补受影响的部分

`[SCOPE+]` 触发后，**不是回到 P1 重走一遍**，而是：

1. **基线增补**：新需求写进 P1-requirements.md（唯一真相源，永远最新）
2. **判断影响范围**：主 Agent 对照新需求，看已完成的阶段里哪些产出需要跟着改
3. **定向局部回补**：受影响的阶段**增量更新**对应文件，未受影响的阶段和未来阶段自然消费最新基线

回补深度由"这条新需求实际需要哪些阶段"决定，不机械从 P1 重来。回补的转移规则见 `state-machine.md`。

### [NEED_CONFIRM]：默认自走，拿不准才找人

需求明确时，Agent 自走，**但每个阶段的产出文件始终生成**（人随时可看）。只有当 subagent 或主 Agent 判断"拿不准方向"时，才标注 `[NEED_CONFIRM]` 停下问人。

触发 `[NEED_CONFIRM]` 的条件（写进角色定义，不靠临场感觉）：
- 原始需求有多种合理理解，选哪种会显著影响结果
- `[SCOPE+]` 的新需求改动较大、伤及已确认内容
- 隐含需求涉及业务方向决策（"这个功能到底要不要做"）
- 安全、数据迁移、外部资源等不可逆或高风险操作

**人确认的是"行为/方向对不对"（能判断），不是"代码/技术对不对"（Agent 负责）。** BDD 条件由 Agent 起草，人只做加/删/改。条件写漏是 Agent 的责任，不是确认人的责任。

---

## 三种使用方式

### 方式 A：手动逐阶段（最稳）

人工逐个触发每个阶段的派发。主 Agent 派发一个 subagent，检查门槛，等人确认后派发下一个。适合关键任务、需要人工把关的场景。

### 方式 B：半自动（推荐）

主 Agent 连续派发，每过一个门槛自动推进，只在门槛失败或重试超限时停下来问人。详见 `loop-orchestration.md`。

### 方式 C：全自动 /loop（增强）

主 Agent 自动跑完 P1-P8，全程不需人工介入，只在最终发布前汇报。仅在方式 B 稳定后启用。详见 `loop-orchestration.md`。

---

## 平台适配

不同 Agent 平台的 subagent 机制不同，派发协议的具体调用方式见 `dispatch-protocol.md` 的平台适配章节。已覆盖：

- **OpenCode**：`task` 工具派发。**经 validation-report 验证：自定义 subagent（方法 A）因 issue #29616 不可用，统一用 general subagent + prompt 注入角色文件（方法 B）**。custom-role.md 模板走方法 B 路径。
- **Claude Code**：Agent Teams（2026-02 起）+ Task 工具
- **Codex**：spawn_agent / wait / close_agent 工具套件

---

*主流程文档，详细机制见同目录其他文件*
