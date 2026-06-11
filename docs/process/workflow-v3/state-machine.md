# 状态机落盘设计

> workflow-v3，解决"LLM 不能稳定执行长循环"的问题

---

## 核心思想

**状态存在文件里，不在 LLM 的记忆里。**

LLM 不是可靠的循环执行器。让它"一直 while 下去"，跑几轮后会忘记自己在循环里、会偏离、会自己开始干活。所以 v3 不依赖 LLM 记住状态，而是每一轮都从文件读状态、执行一步、把新状态写回文件。

即使会话被压缩、中断、重启，主 Agent 重新读文件就知道接着干什么。

---

## 状态存在哪

状态分两层落盘：

### 第一层：任务看板（active-tasks.md）

记录每个任务的**当前阶段、状态、重试计数**：

```markdown
| 序号 | 任务名 | 状态 | 阶段 | 重试 | 更新日期 |
|------|--------|------|------|------|----------|
| T002 | fix-db-migration | 🔄 进行中 | P4 | 0 | 2026-06-11 |
```

这是"宏观状态"——任务走到哪了。

### 第二层：阶段产出文件（docs/tasks/Txxx/Pn-*.md）

每个阶段的产出文件本身就是"这个阶段完成了"的证据。文件的 Header 里有可判定字段：

```yaml
---
phase: P2
task_id: T002
parent: P1-problems.md
trace_id: T002-P2-20260611
status: approved        # ← 门槛判定字段
---
```

这是"微观状态"——每个阶段的门槛过没过。

---

## 状态机定义

```
状态集合：{ P1, P2, P3, P4, P5, P6, P7, DONE, PAUSED }

转移规则（读文件判定，不靠记忆）：
注意：所有"文件存在"判定 = 文件存在 AND 含合法 Header AND 有实质内容
     （不能只看文件存在——subagent 可能写一半崩了，留下空/半截文件）

P1 --[P1-problems.md 有效 AND 至少定义一个问题]--> P2
P2 --[P2-review.md 有效 AND status==approved]--> P3
P2 --[P2-review.md status==rejected && retry<MAX]--> P2 (retry+1)
P2 --[retry>=MAX]--> PAUSED
P3 --[测试代码存在 AND 因断言不满足而失败(真红灯)]--> P4
P4 --[实现文件存在 AND 非空]--> P5
P5 --[unit.md 有效 AND failed==0]--> P6
P5 --[failed>0 && retry<MAX]--> P4 (retry+1)
P5 --[retry>=MAX]--> PAUSED
P6 --[P6-consistency.md 有效 AND 无 BLOCKER]--> P7
P7 --[P7-release.md 存在]--> DONE
```

每次转移后，把新状态写回 active-tasks.md。

**"有效"的定义**：文件存在 + 含合法 Header（phase/task_id/parent/trace_id）+ 有实质内容（非空、非半截）。只看"文件存在"会被 subagent 写一半崩溃留下的垃圾文件误导。

**P3 红灯的特别说明**：TDD 要求测试先失败，但"失败"有两种——(1) 正确的红灯：测试逻辑对，因实现未写而断言不满足；(2) 错误的红灯：测试本身有语法/import/collection 错误，根本跑不起来。门槛只接受**第一种**（assertion failure）。如果是 collection error / import error，说明测试本身写错了，门槛不通过，打回 test-designer 重写。test-designer 产出时必须附"失败原因分类"（assertion failure ✓ / error ✗）。

---

## 主 Agent 的单步执行（一轮）

主 Agent 不跑 while 循环，而是执行"单步函数"，每次调用推进一个阶段：

```
function 执行一步(task_id):
    1. 读 active-tasks.md → 得到 (当前阶段, 重试计数)
    2. 读 docs/tasks/{task_id}/ → 确认当前阶段输入就绪
    3. 派发当前阶段的 subagent（见 dispatch-protocol.md）
    4. subagent 返回摘要
    5. 读产出文件 Header → 判定门槛
    6. 计算下一状态（按转移规则）
    7. 写回 active-tasks.md（新阶段 / 重试计数 / PAUSED）
    8. 返回：下一状态是什么
```

"一步"就是一次完整的派发 + 判定 + 状态更新。要推进整个任务，就是反复调用"执行一步"，直到 DONE 或 PAUSED。

谁来反复调用？三种方式（见 loop-orchestration.md）：人工逐步、半自动、全自动 /loop。

---

## 为什么这样能抗中断

```
场景：主 Agent 在 P4 派发到一半，会话被压缩/中断

恢复时：
  1. 主 Agent 重新读 active-tasks.md → "T002 在 P4，重试 0"
  2. 读 docs/tasks/T002/ → P4-implementation/ 是否已有文件？
     - 有 → P4 已完成，直接判定门槛，进 P5
     - 没有 → P4 没做完，重新派发 P4 subagent
  3. 接着干
```

状态完全由文件重建，不依赖会话记忆。这是"状态落盘"的核心价值。

---

## 重试计数也要落盘

重试计数不能存在 LLM 记忆里（会忘）。**按阶段独立计数**，写进 active-tasks.md 或 `docs/tasks/Txxx/.retry`（每阶段一个计数）：

```
retry: { P2: 1, P5: 0, ... }   # 每个阶段独立计数

每次某阶段门槛失败：该阶段计数 +1 → 写回
```

**关键：不要"进入新阶段就把所有计数归零"。** 否则存在绕过上限的漏洞：

```
P2 retry 用到 2/3 → approved 进 P3 → 若简单归零
P3 发现 P2 设计有问题，回退到 P2 → retry 又从 0 开始 → P2 可被反复重试远超上限
```

按阶段独立计数后，P2 的计数累积保留，即使从 P3 回退到 P2，P2 的历史重试次数仍在，不会被绕过。

### 阶段回退规则

明确允许哪些回退，避免无限打转：

| 回退 | 是否允许 | 说明 |
|------|----------|------|
| P5 → P4 | ✅ 允许 | 测试失败回到实现，设计内的正常回归 |
| P2 → P2 | ✅ 允许 | 评审打回重做（同阶段重试）|
| P3/P6 → P2 | ⚠️ 谨慎 | 发现上游设计问题。允许，但 P2 的 retry 计数累积保留，且计入全局步数上限 |
| 跨多阶段回退 | ❌ 禁止自动 | 如 P6→P1，说明问题严重，停下 PAUSED 报告人工 |

全局步数上限（护栏 2，默认 20）是最后兜底，但按阶段独立计数 + 回退规则让它不必单独扛所有失控场景。

---

## 一致性要求

- active-tasks.md 的"阶段"列必须和任务目录里实际存在的文件一致
- 如果两者冲突（看板说 P4，但目录里没有 P3 产出），以**文件为准**，修正看板
- 主 Agent 每轮开始先做这个一致性检查，避免状态漂移

---

*状态机是 /loop 自动编排的基础，配合 dispatch-protocol.md 和 loop-orchestration.md*
