# 子 Agent 派发协议

> workflow-v3 核心文件，解决"主 Agent 不派发、自己一路走到底"的问题

---

## 问题诊断

v2 说"主 Agent 写入 P1 输出到子 Agent 2 上下文"——这对 LLM 是**不可执行的描述**。"写入上下文"具体是什么操作？没说。LLM 面对模糊指令，会选阻力最小的路径：自己继续做。

v3 的派发协议把这句话翻译成**明确的工具调用 + 精确的输入输出规范**。

---

## 派发的三条铁律

### 铁律 1：用 task 工具派发，动词是"派发"不是"执行"

主 Agent 到了某个阶段，**不自己产出文件**，而是调用 task 工具启动一个 subagent。

```
❌ 错误理解："P2 阶段我要产出 P2-design.md" → 主 Agent 自己写
✅ 正确理解："P2 阶段我要派发一个 architect subagent 去产出 P2-design.md"
```

### 铁律 2：prompt 只传文件路径，不传文件内容

```
❌ 错：把 P1-problems.md 的全文复制进 subagent 的 prompt
✅ 对：prompt 写"读取 docs/tasks/T002/P1-problems.md"
```

subagent 在自己独立的上下文里读文件。主 Agent 的上下文永远不碰这些文件的全文。**这是上下文隔离的核心。**

### 铁律 3：subagent 只返回"路径 + 一句话摘要"

```
❌ 错：subagent 把 P2-design.md 全文返回给主 Agent
✅ 对：subagent 返回 "已产出 docs/tasks/T002/P2-design.md，方案采用 schema version 表 + 迁移脚本目录，3 个迁移步骤"
```

主 Agent 只拿摘要做门槛判断，需要细节时让下一个 subagent 自己去读文件。

---

## subagent 返回校验（处理 subagent 自身失败）

subagent 可能崩溃、超时、不产出文件、或不遵守"只返回摘要"。主 Agent 收到返回后必须校验，不能假设 subagent 一定成功。

```
subagent 返回后，主 Agent 校验：
  1. 约定的产出文件是否真的存在？
     不存在 → 派发失败，计入重试，带"未产出文件"原因重派
  2. 返回是否是"路径+摘要"格式？
     返回了文件全文 → 直接判失败重试，要求 subagent 重新只返回摘要
     （不要主 Agent 自己读全文补救——那会污染主 Agent 上下文，
      违背"主 Agent 永不碰文件全文"的核心原则。惩罚违规 subagent 而非替它擦屁股）
  3. 产出文件是否含合法 Header（phase/task_id/parent/trace_id）？
     没有或不完整 → 门槛不通过，计入重试
  4. 产出文件内容是否非空且有实质内容？
     空文件或半截内容（写一半崩了）→ 视为失败，重试

任一校验失败 → 计入重试计数，超限则 PAUSED。
```

**关键：主 Agent 永远不信任 subagent 的口头返回，以文件的实际存在和有效性为准。**

---

## 标准派发流程（每个阶段）

```
主 Agent 执行：

1. 读状态
   读 docs/tasks/active-tasks.md → 确认当前任务和阶段
   读 docs/tasks/Txxx/ → 确认上一阶段产出文件存在

2. 选角色
   按阶段从 assets/execution-roles/ 选执行角色
   （P1→analyst, P2→architect, P3→test-designer, P4→implementer, P5→verifier）

3. 派发 subagent（task 工具）
   传入：
     - 角色定义文件路径（assets/execution-roles/xxx.md）
     - 输入文件路径（上一阶段产出，不传内容）
     - 输出要求（产出哪个文件 + Header 规范 + 门槛）
     - 返回要求（只返回路径 + 摘要）

4. 接收返回
   只读 subagent 的摘要，不读产出文件全文

5. 门槛检查
   读产出文件的 Header / 关键字段，判断门槛是否通过
   （可判定条件，见下）

6. 更新状态
   更新 active-tasks.md 的阶段和状态
   门槛通过 → 进入下一阶段（回到步骤 1）
   门槛失败 → 重试（重试计数 +1，超限则停下报告）
```

---

## 派发 prompt 模板

主 Agent 调用 task 工具时，prompt 用这个结构（详见 `assets/templates/dispatch-prompt.md`）：

```
你是 {阶段} 阶段的 {角色名} 子 Agent。

## 你的角色定义
读取并遵循：docs/process/workflow-v3/assets/execution-roles/{role}.md

## 输入（自己读取，不要等我提供内容）
- docs/tasks/{Txxx}/{上一阶段产出文件}
- docs/process/workflow-v3/README.md（流程规范）

## 任务
{这个阶段要做什么，一两句话}

## 输出
产出文件：docs/tasks/{Txxx}/{本阶段产出文件}
必须包含 Header：
  phase: {Pn}
  task_id: {Txxx}
  parent: {上一阶段文件名}
  trace_id: {Txxx}-{Pn}-{日期}

## 门槛（什么算完成）
{可判定的完成条件}

## 返回给我
只返回两行：
  1. 产出文件路径
  2. 一句话摘要（不超过 30 字）
不要返回文件全文。
```

---

## 可判定门槛规范

门槛必须是**从文件里能读出的明确值**，不能是模糊判断。

| 阶段 | 门槛 | 怎么判定 |
|------|------|----------|
| P1→P2 | 问题已定义 | P1-problems.md 和 P1-test-strategy.md 都存在且有 Header |
| P2→P3 | 方案已批准 | P2-review.md 的 Header `status: approved` |
| P3→P4 | TDD 真红灯（assertion failure，非 error）| 运行测试，无 collection/import error，所有失败均为断言不满足（详见 state-machine.md）|
| P4→P5 | 实现完成 | P4-implementation/ 下有代码文件 |
| P5→P6 | 全部通过 | P5-test-results/unit.md 里 `failed: 0` |
| P6→P7 | 一致性通过 | P6-consistency.md 存在且无 `[BLOCKER]` 标记 |

**反例（禁止用作门槛）：**
- ❌ "方案足够好"
- ❌ "代码看起来对"
- ❌ "测试差不多了"

这些 LLM 无法稳定判定，必须换成可读取的明确值。

---

## 重试与上限

```
门槛失败时：
  retry_count += 1
  if retry_count <= MAX_RETRY (默认 3):
      带着失败原因重新派发同阶段 subagent
      （prompt 里加上"上次失败原因：xxx，请修正"）
  else:
      停止自动流程
      在 active-tasks.md 标记任务为 ⏸️ 暂停
      向人汇报：哪个阶段、失败了几次、失败原因
```

重试计数也落盘（写进 active-tasks.md 或任务目录），避免主 Agent 忘记重试了几次。

---

## 平台适配

### OpenCode

用 `task` 工具派发，`subagent_type` 指定角色。

**自定义角色用 markdown 文件方式定义**（放在 OpenCode 的 agent 目录，文件名即角色名）。

⚠️ **已知坑（issue #29616）**：用 `opencode.jsonc` 里 `mode: "subagent"` 定义的自定义 agent 可能无法被 task 工具调起来（subagent_type 枚举硬编码只有 explore/general）。**优先用 markdown 文件方式定义自定义角色**，并在实际环境先做最小验证：定义一个测试角色，让主 Agent 派发它，确认能调起来。

如果自定义角色确实调不起来，退路：用内置的 general subagent，把角色定义文件路径写进派发 prompt 让它读取遵循（角色行为靠 prompt 注入而非平台机制）。

### Claude Code

用 Agent Teams（2026-02 起）或 Task 工具派发。lead agent spawn teammate agent，各自独立上下文，通过消息传递协调。角色定义可以放 `.claude/agents/` 下的 markdown。

### Codex

用 spawn_agent / send_input / wait / close_agent 工具套件。`agents.max_depth` 默认 1（允许直接子 agent，禁止深层嵌套）。自定义 agent 在 `[agents]` 配置。Codex 只在被明确要求时才 spawn subagent，所以派发指令要明确。

---

## 完整派发示例（T002 P2 阶段）

```
主 Agent：

1. 读 active-tasks.md → T002 在 P2 阶段
2. 确认 docs/tasks/T002/P1-problems.md 存在 ✓
3. 选角色：architect（P2 执行角色）
4. 调用 task 工具：
   subagent_type: architect（或 general + 注入角色文件）
   prompt:
     你是 P2 阶段的 architect 子 Agent。
     角色定义：读取 docs/process/workflow-v3/assets/execution-roles/architect.md
     输入：读取 docs/tasks/T002/P1-problems.md 和 P1-test-strategy.md
     任务：为数据库迁移问题设计方案
     输出：docs/tasks/T002/P2-design.md（含 Header）
     门槛：方案覆盖 P1 列出的所有问题
     返回：只返回文件路径 + 一句话摘要
5. subagent 返回："docs/tasks/T002/P2-design.md，采用 schema_version 表 + 顺序迁移脚本"
6. 派发评审 subagent（plan-eng-review 角色）→ 产出 P2-review.md
7. 读 P2-review.md 的 Header status
   - approved → 更新 active-tasks.md，T002 进入 P3
   - rejected → 重试 architect（retry_count=1），带上评审意见
```

---

*派发协议是 v3 解决上下文爆炸的核心，配合 state-machine.md 和 loop-orchestration.md 使用*
