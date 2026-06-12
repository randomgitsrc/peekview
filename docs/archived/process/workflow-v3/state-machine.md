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
状态集合：{ P1, P2, P3, P4, P5, P6, P7, READY, DONE, PAUSED }

转移规则（主 Agent 亲自跑命令验证，不靠读 subagent 产出文件字段）：
注意：所有"文件存在"判定 = 文件存在 AND 含合法 Header AND 有实质内容
     （不能只看文件存在——subagent 可能写一半崩了，留下空/半截文件）

P1 --[P1-problems.md 有效 AND 至少定义一个问题]--> P2
P2 --[P2-review.md 有效 AND status==approved]--> P3
P2 --[P2-review.md status==rejected && retry<MAX]--> P2 (retry+1)
P2 --[retry>=MAX]--> PAUSED

P3 --[scripts/check-tdd-red.sh exit 0 AND assertion_failures>0 AND collection_errors==0]--> P4
    （TDD 红灯：测试正确但因实现未写而断言失败。collection/import error 视为测试本身错误）
P3 --[retry>=MAX]--> PAUSED

P4 --[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit]--> P5
    （不能用 git diff，因为 P4 完成时会 commit，git diff 永远是空）
P4 --[retry>=MAX]--> PAUSED

P5 --[pytest -q exit 0 AND failed==0]--> P6
    （主 Agent 亲手跑 pytest 捕获 exit code，不信 unit.md 里的数字）
P5 --[failed>0 && retry<MAX]--> P4 (retry+1)
P5 --[retry>=MAX]--> PAUSED

P6 --[grep -L 'BLOCKER' P6-consistency.md 有输出]--> P7
    （已知限制：P6 定性分析不可全自动验证。主 Agent 可抽查 1-2 条一致性声明，
     完整性由 P5 回归测试兜底）
P6 --[retry>=MAX]--> PAUSED

P7 --[项目发布检查命令 exit 0 + git diff 确认 version bump + CHANGELOG]--> READY
    （默认命令 make pre-publish，纯后端任务可配 make test && make lint）

特殊转移：
READY --[人手动触发 make publish]--> DONE

进入 READY 时（P7 gate 通过后，写状态前）：
主 Agent 必须立即输出交付小结（强制，不可跳过）：
  格式见 dispatch-protocol.md「任务完成小结」模板：
    [{task_id}] READY — {task_name} {version}
    改动：{git diff --stat 提取}
    验证：{各阶段 gate check 结果}
    说明：{一句话设计摘要}
    下一步：make publish（人工触发）
  这是主 Agent 对 PM 的正式交付，是任务编排层的职责。
  T002 教训：小结缺失导致 PM 无法感知任务完成情况。
```

每次转移后，把新状态写回 active-tasks.md。

**"有效"的定义**：文件存在 + 含合法 Header（phase/task_id/parent/trace_id）+ 有实质内容（非空、非半截）。只看"文件存在"会被 subagent 写一半崩溃留下的垃圾文件误导。

**P3 红灯的特别说明**：TDD 要求测试先失败，但"失败"有两种——(1) 正确的红灯：测试逻辑对，因实现未写而断言不满足；(2) 错误的红灯：测试本身有语法/import/collection 错误，根本跑不起来。门槛只接受**第一种**（assertion failure）。

**判定方式**：主 Agent 跑 `scripts/check-tdd-red.sh`（见下），不自行解析 pytest 输出。脚本输出 `assertion_failures=N, collection_errors=M` 格式，gate 判定为 `assertion_failures > 0 AND collection_errors == 0`。

**`scripts/check-tdd-red.sh` 设计**：

```bash
#!/bin/bash
# 检查 TDD 红灯：只允许 assertion failure，拒绝 collection/import error
# 退出 0 = 正确的红灯（assertion failure > 0, collection error == 0）
# 退出 1 = 错误（有 collection/import error）
# 退出 2 = 测试全绿（说明实现先于测试写完，违反 TDD）

RESULT=$(pytest -q 2>&1)
EXIT=$?

FAILED=$(echo "$RESULT" | grep -oP '\d+ failed' | grep -oP '\d+')
ERRORS=$(echo "$RESULT" | grep -oP '\d+ error' | grep -oP '\d+')

echo "assertion_failures=${FAILED:-0}, collection_errors=${ERRORS:-0}"

if [ "$EXIT" -eq 0 ]; then
    echo "TDD_CHECK: tests pass, no red-light — implementation may be ahead of tests"
    exit 2
fi

if [ "${ERRORS:-0}" -gt 0 ]; then
    echo "TDD_CHECK: collection/import errors detected — test code has bugs, fix before proceeding"
    exit 1
fi

# exit code > 0 (pytest has failures) but not due to errors = assertion failures
exit 0
```

**P7 与 READY 的说明**：

P7 不再是「发布」，而是**「发布准备」**。P7 gate 通过后进入 READY 状态——表示版本 bump、CHANGELOG 更新、测试全通过，**已准备好发布**。实际的 `make publish`（上传到 PyPI）由人手动触发。

| 概念 | 含义 | 谁执行 |
|------|------|--------|
| 发布准备 (READY) | version bump + CHANGELOG + lint + test 全通过 | Subagent + 主 Agent 验证 |
| 发布 (DONE) | 上传到 PyPI | 人手动触发 |

---

## 主 Agent 的单步执行（一轮）

主 Agent 不跑 while 循环，而是执行"单步函数"，每次调用推进一个阶段：

```
function 执行一步(task_id):
    1. 读 .state.yaml 或 active-tasks.md → 得到 (当前阶段, 重试计数)
    2. 读 docs/tasks/{task_id}/ → 确认当前阶段输入就绪
    3. 派发当前阶段的 subagent（见 dispatch-protocol.md）
    4. subagent 返回摘要（路径 + 一句话）
    5. 主 Agent 亲自跑 gate 命令验证门槛（A1 原则：跑命令不信文件）：
       - P3: scripts/check-tdd-red.sh exit 0
       - P4: git log --oneline -1 确认 P4 commit
       - P5: pytest -q exit 0 && failed==0
       - P6: grep 无 [BLOCKER] 标记
       - P7: 项目发布检查命令 exit 0
    6. 计算下一状态（按转移规则）
    7. if 下一状态 == READY:
          输出交付小结（强制）：见「进入 READY 时」的格式要求
          再写回 .state.yaml
       else:
          写回 .state.yaml（新阶段 / 重试计数 / PAUSED）
    8. 返回：下一状态是什么
```

"一步"就是一次完整的派发 + 跑命令验证 + 状态更新。gate 判定由主 Agent 亲笔完成，不信任 subagent 产出的文件字段。

谁来反复调用？三种方式（见 loop-orchestration.md）：人工逐步、半自动、全自动 /loop。

---

## 重试上限

| 阶段 | MAX_RETRY | 说明 |
|------|-----------|------|
| P1 | 3 | 涉及需求定义 |
| P2 | 3 | 涉及方案设计 |
| P3 | 2 | TDD 红灯，少轮次 |
| P4 | 3 | 实现复杂度高 |
| P5 | 2 | pytest 全绿，少轮次 |
| P6 | 2 | 一致性检查，少轮次 |
| P7 | 2 | 发布准备，少轮次 |

重试计数按阶段独立存储于 `.state.yaml`，不因进入新阶段而清零。

---

## 每任务独立状态文件

除 active-tasks.md 宏观看板外，每任务有独立状态文件：

位置：`docs/tasks/{Txxx}/.state.yaml`

```yaml
task_id: T002
phase: P4
status: in_progress
retry_count: { P2: 0, P4: 0, P5: 0 }
review_scores:
  P2:
    - round: 1
      reviewer: plan-eng-review
      score: 7.5
      status: rejected
      feedback: "API 限流策略未考虑并发边界"
updated: 2026-06-12
```

**commit 时机**：与 gate commit 同步——一次 commit 包含 stage output + `.state.yaml` 更新，避免文件与实际阶段不一致。

**active-tasks.md 降级为汇总视图**：不再由 subagent 直接修改，由主 Agent 维护。更新规则：**owner agent 只重写自己任务那一行**（从该任务 .state.yaml 派生），不碰其他任务的行，不做全表覆写。这样多 Agent 并发时各写各的行，冲突面最小。（与 git-integration.md 策略2 一致，.state.yaml 是唯一真相源）

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

- .state.yaml 的 phase 字段和 active-tasks.md 的"阶段"列必须一致
- 如果两者冲突，以 **.state.yaml 为准**，修正 active-tasks.md
- 主 Agent 每轮开始先做这个一致性检查，避免状态漂移

---

## 评审迭代机制

### L1：阶段内再评审循环

```
阶段内循环：
  阶段执行者产出文件
       ↓
  主 Agent 跑 gate 命令（A1 原则）
       ↓
  通过？ ──是──→ 进入下一阶段
       ↓ 否
  派发评审角色读产出
       ↓
  评审角色产出 Pn-review.md (status: approved/rejected)
       ↓
  approved? ──是──→ 进入下一阶段
       ↓ 否
  retry_count[Pn] += 1
       ↓
  retry_count[Pn] > MAX_RETRY?
       ↓ 是
  触发 L2 上溯（见下）
       ↓ 否
  执行者重写产出（带回评审反馈）
       ↓
  回到"主 Agent 跑 gate 命令"步骤
```

### L2：单规则跨阶段上溯

**确定性单规则**：任何阶段失败 MAX_RETRY 轮 → 上溯到紧邻的上游阶段，上游标记为 `needs-review`。

| 失败阶段 | 上溯到 | 动作 |
|----------|--------|------|
| P1 | 用户 | PAUSED，报告用户需求可能不合理 |
| P2 | P1 | P1 标记 needs-review，office-hours 复审 AC |
| P3 | P2 | P2 标记 needs-review，architect 重新设计 |
| P4 | P2 | P2 标记 needs-review，质疑设计方案 |
| P5 | P4 | P4 标记 needs-review，重新实现 |
| P6 | P2 | P2 标记 needs-review，质疑 AC（僵尸需求）|
| P7 | P6 | P6 标记 needs-review，重新检查一致性 |

**不区分原因、不判断分支**：主 Agent 只需确定 `retry_count[Pn] > MAX_RETRY` → 执行固定上溯动作，无需推理多变量决策。

### 用户介入边界

| 情况 | 动作 |
|------|------|
| P1 失败 3 轮 | PAUSED，报告用户需求可能不合理 |
| 涉及业务方向决策 | PAUSED，询问"这个功能要不要做" |
| 涉及外部资源/权限 | PAUSED，需 API key / 授权 |
| 涉及安全/合规 | PAUSED，需要人判断 |
| retry 超限且上溯仍失败 | PAUSED，兜底机制 |

PAUSED 报告使用占位符模板（见 dispatch-protocol.md）。

---

*状态机是 /loop 自动编排的基础，配合 dispatch-protocol.md 和 loop-orchestration.md*
