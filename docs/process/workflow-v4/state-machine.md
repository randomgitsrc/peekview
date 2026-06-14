# 状态机落盘设计

> workflow-v4，解决"LLM 不能稳定执行长循环"的问题

---

## 核心思想

**状态存在文件里，不在 LLM 的记忆里。**

LLM 不是可靠的循环执行器。让它"一直 while 下去"，跑几轮后会忘记自己在循环里、会偏离、会自己开始干活。所以 v4 不依赖 LLM 记住状态，而是每一轮都从文件读状态、执行一步、把新状态写回文件。

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
parent: P1-requirements.md
trace_id: T002-P2-20260611
status: approved        # ← 门槛判定字段
---
```

这是"微观状态"——每个阶段的门槛过没过。

---

## 状态机定义

```
状态集合：{ P0, P1, P2, P3, P4, P5, P6, P7, P8, READY, DONE, PAUSED }
（P0 是主 Agent 亲自执行的简报阶段，不派发 subagent，完成后直接进入 P1）

转移规则（主 Agent 亲自跑命令验证，不靠读 subagent 产出文件字段）：
注意：所有"文件存在"判定 = 文件存在 AND 含合法 Header AND 有实质内容
     （不能只看文件存在——subagent 可能写一半崩了，留下空/半截文件）

P1 --[P1-requirements.md 有效 AND 含至少一条 BDD 验收条件 AND 无未决 NEED_CONFIRM AND 无 CAPABILITY_GAP]--> P2
P1 --[存在未决 NEED_CONFIRM]--> PAUSED（等人确认方向）
P1 --[存在 CAPABILITY_GAP]--> PAUSED（等人补充能力/确认降级方案）

任意阶段 --[出现 PROD_TOUCHED]--> PAUSED（生产环境被意外触碰，需人工处置）
任意阶段 --[出现 NEED_CONFIRM（不可逆操作）]--> PAUSED（等人确认后才可执行）

P2 --[P2-review.md 有效 AND status==approved AND P2-design.md 声明 packages/domains]--> P3
P2 --[P2-review.md status==rejected && retry<MAX]--> P2 (retry+1)
P2 --[retry>=MAX]--> PAUSED
    （若 P2 设计涉及 UI：P2-design.md 必须声明 ui_affected: true，并列出需 E2E 覆盖的交互点）

P3 --[scripts/check-tdd-red.sh exit 0 AND assertion_failures>0 AND collection_errors==0]--> P4
    （TDD 红灯：测试正确但因实现未写而断言失败。collection/import error 视为测试本身错误）
    （若 P2 声明 ui_affected：P3 必须包含对应的 Playwright/E2E 用例，否则 gate 不通过）
P3 --[retry>=MAX]--> PAUSED

P4 --[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit]--> P5
    （不能用 git diff，因为 P4 完成时会 commit，git diff 永远是空）
P4 --[retry>=MAX]--> PAUSED

P5 --[pytest -q exit 0 AND failed==0 AND 测试环境隔离正常（无 PROD_TOUCHED）AND (若 ui_affected: E2E/Playwright 实跑通过)]--> P6
    （主 Agent 亲手跑 pytest 捕获 exit code，不信 unit.md 里的数字）
    （UI 任务：P5 必须实际运行 Playwright，不能跳过、不能靠"代码看起来对"判断）
    （「测试环境隔离正常」判定：
      ① 无 [PROD_TOUCHED] 标记（被动检测）
      ② 若项目有生产数据状态检查机制：对比测试前后生产库状态（记录数/checksum），
         差值 > 0 说明测试写入了生产环境 → P5 失败。
         具体检查方式由项目约定（如 conftest snapshot），v4 不硬编码路径。
      ③ 以上均为最低要求，项目应在代码层面实现强制隔离（见 README 隔离原则）。）
    （若 P5 过程中出现任何 [PROD_TOUCHED] 标记 → 立即 PAUSED，不允许进入 P6）
P5 --[failed>0 && retry<MAX]--> P4 (retry+1)
P5 --[有 PROD_TOUCHED]--> PAUSED（生产环境被触碰，需人工处置后才能继续）
P5 --[retry>=MAX]--> PAUSED

P6 --[P6-acceptance.md 有效 AND P1 的每条 BDD 条件都有实跑结果 AND 无未决 NEED_CONFIRM]--> P7
    （验收 = 把 P1 的 BDD 条件逐条实际跑一遍，结果翻译成人能看懂的行为描述）
    （涉及显示/交互的 BDD 条件：必须 Playwright 实跑 + 截图佐证，不接受"应该能工作"）
P6 --[BDD 条件未满足 && retry<MAX]--> P4 (retry+1)（行为不符 → 回实现）
P6 --[存在未决 NEED_CONFIRM]--> PAUSED（验收结果需人判断方向）
P6 --[retry>=MAX]--> PAUSED

P7 --[! grep -qF '[BLOCKER]' P7-consistency.md]--> P8
    （已知限制：P7 定性分析不可全自动验证。主 Agent 可抽查 1-2 条一致性声明，
     完整性由 P5 回归测试兜底）
P7 --[retry>=MAX]--> PAUSED

P8 --[每个声明的 package 的发布检查命令 exit 0 + git diff 确认各包 version bump + CHANGELOG]--> READY
    （gate 命令集由 P2-design.md 的 packages: 声明动态生成，规则见 dispatch-protocol.md「packages 动态注入（B4/B6）」节。
     gate 命令由 P2 的 packages + gate_commands 字段动态生成，不同项目不同命令，v4 不硬编码）

阶段跳过转移规则（P1 裁剪声明驱动）：
  P1-requirements.md 的「裁剪说明」声明 phases: [列表]，主 Agent 据此跳过未列出的阶段。
  跳过时，当前阶段的 gate 自动判定为"通过"，直接转移到裁剪声明中的下一个阶段。

  可跳过的阶段及其跳过转移：
    跳过 P2（无设计阶段）→ P1--[P1 gate 通过]--> P3 或 P4（取决于 phases 列表）
    跳过 P3（无 TDD）→ P2--[P2 gate 通过]--> P4
      （P3 跳过时 P4 gate 不要求红灯变绿，P5 的 pytest 全绿兜底）
    跳过 P6（无验收）→ P5--[P5 gate 通过]--> P7
    跳过 P7（无一致性检查）→ P6--[P6 gate 通过]--> P8
    跳过 P8（无发布）→ P7--[P7 gate 通过]--> DONE（仅限不涉及发布的内部任务）

  不可跳过的阶段：P1（需求基线）、P4（实现）、P5（技术验证）
    P1 基线是全流程脊梁，无论任务大小都需建立（小任务可简化，见 README 适用边界）
    P4/P5 是交付底线——没有实现和验证就没有可发布产物

  gate 判定方式：主 Agent 读 P1-requirements.md 的 phases 字段，确认跳过列表，按上述转移规则推进。
  若 P1 声明的 phases 列表与实际 gate 判定冲突（如声明跳过 P6 但 P5 发现行为不符需验收），主 Agent PAUSED 报告人工决策。

特殊转移（SCOPE+ 定向回补）：
任意阶段 Pn 产出含 [SCOPE+] → 主 Agent 增补 P1 基线 → 判断影响范围 → 定向回补：
  Pn --[SCOPE+ 增补基线]--> P1（仅增补 requirements.md，不重跑 P1 分析）
  → 主 Agent 判断该新需求实际需要哪些阶段，定向回到最早受影响的阶段
  ⚠️ 已知限制：「判断影响范围」目前依赖主 Agent 临场判断，无明确决策规则。
     T004/T005/T006 均未触发 SCOPE+，尚无实战数据支撑规则化。
     下一个触发 SCOPE+ 的任务应记录判断过程，供后续规则化参考。
  → 例：P5 发现需写新代码 → 回 P4；仅验收条件遗漏 → 仅补 P6
  → 回补阶段完成后，沿正常转移继续，已完成且未受影响的阶段不重跑
  retry 计数：定向回补不清零目标阶段已有的 retry（防止借回补绕过重试上限）

特殊转移：
READY --[人手动触发 make publish]--> DONE

PAUSED 恢复协议：
  PAUSED --[人工确认/决策]--> 恢复到 PAUSED 前的阶段

  恢复步骤：
  1. 主 Agent 重读该任务的 .state.yaml → 获取 PAUSED 前的阶段和 retry 计数
  2. 人工回复的内容写入 docs/tasks/{Txxx}/PAUSED-resolution.md（含 Header）
  3. 主 Agent 将 PAUSED-resolution.md 路径加入重派 prompt（"人工决策见此文件"）
  4. 按 PAUSED 前的阶段重新派发 subagent

  recovery_bonus：若 PAUSED 原因是 retry 耗尽（如 P2 retry=3/3），恢复后该阶段获得 recovery_bonus=1（允许额外 1 次重试），避免恢复后立即再次超限导致无意义循环。recovery_bonus 写入 .state.yaml 对应阶段的计数。

  PAUSED 期间 SCOPE+ 处理：
  - SCOPE+ 在 PAUSED 期间暂不处理，等恢复后一并纳入 P1 基线增补
  - 如 SCOPE+ 与 PAUSED 原因相关（如验收中发现新需求导致 NEED_CONFIRM），恢复时优先处理

进入 READY 时（P8 gate 通过后，写状态前）：
主 Agent 必须立即输出交付小结（强制，不可跳过）：
  格式见 dispatch-protocol.md「任务完成小结」模板：
    [{task_id}] READY — {task_name} {version}
    改动：{git diff --stat 提取}
    验证：{各阶段 gate check 结果 + 验收 BDD 条目通过数}
    说明：{一句话设计摘要}
    下一步：make publish（人工触发）
  这是主 Agent 对 PM 的正式交付，是任务编排层的职责。
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

**P8 与 READY 的说明**：

P8 是**「发布准备」**，不是「发布」。P8 gate 通过后进入 READY 状态——表示每个受影响包的版本 bump、CHANGELOG 更新、测试全通过，**已准备好发布**。实际的 `make publish`（上传到 PyPI）由人手动触发。

| 概念 | 含义 | 谁执行 |
|------|------|--------|
| 发布准备 (READY) | 各包 version bump + CHANGELOG + lint + test 全通过 | Subagent + 主 Agent 验证 |
| 发布 (DONE) | 上传到 PyPI | 人手动触发 |

**多包发布（T005 教训）**：一个任务可能涉及多个独立版本的包（如 peekview + mcp-server）。P8 必须为 P2 声明的**每一个** package 执行 version bump 和发布检查，gate 命令由 packages 列表动态生成。漏 bump 某个包 = gate 不通过。

---

## 主 Agent 的单步执行（一轮）

主 Agent 不跑 while 循环，而是执行"单步函数"，每次调用推进一个阶段：

```
function 执行一步(task_id):
    1. 读 .state.yaml 或 active-tasks.md → 得到 (当前阶段, 重试计数)
    2. 确认 docs/tasks/{task_id}/P0-brief.md 存在（必填字段：task/known_risks/env_constraints/pruning_tendency）
       读 docs/tasks/{task_id}/ → 确认当前阶段输入文件就绪
    3. 派发当前阶段的 subagent（见 dispatch-protocol.md）
    4. subagent 返回摘要（路径 + 一句话）
    4.5 扫描 subagent 产出是否含 [SCOPE+] 或 [SCOPE_GAP]：
        - [SCOPE+]：发现新隐含需求 → 增补 P1 基线 → 定向回补（见特殊转移）
        - [SCOPE_GAP]：prompt 漏了 P2 已声明的改动 → 暂停修正 prompt 重派
        （subagent 的自我检查结果仅供参考，不作为 gate 判定依据——gate 以主 Agent 跑命令为准）
    5. 主 Agent 亲自跑 gate 命令验证门槛（A1 原则：跑命令不信文件）：
       - P1: P1-requirements.md 有 BDD 条件 && 无未决 NEED_CONFIRM && 无 CAPABILITY_GAP
       - P2: P2-review.md status==approved && P2-design.md 含 packages/domains/ui_affected/gate_commands 四字段
       - P3: scripts/check-tdd-red.sh exit 0（UI 任务额外查 Playwright 用例存在）
       - P4: git log --oneline -1 确认 P4 commit
       - P5: pytest -q exit 0 && failed==0 && 无 [PROD_TOUCHED]（UI 任务额外实跑 Playwright/E2E）
             确认整个过程在 debug_env 中进行，无 [PROD_TOUCHED] 标记
       - P6: P1 每条 BDD 都有实跑结果 && UI 条件 vision-analyst YAML summary.blocker_count==0 && 无未决 NEED_CONFIRM
       - P7: ! grep -qF '[BLOCKER]' P7-consistency.md
       - P8: 每个 package 的发布检查命令 exit 0
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
| P1 | 3 | 需求基线，涉及需求定义 |
| P2 | 3 | 涉及方案设计 |
| P3 | 2 | TDD 红灯，少轮次 |
| P4 | 3 | 实现复杂度高 |
| P5 | 2 | 技术验证，少轮次 |
| P6 | 2 | 验收，少轮次 |
| P7 | 2 | 一致性检查，少轮次 |
| P8 | 2 | 发布准备，少轮次 |

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
| P2 | P1 | P1 标记 needs-review，复审需求基线与 BDD |
| P3 | P2 | P2 标记 needs-review，architect 重新设计 |
| P4 | P2 | P2 标记 needs-review，质疑设计方案 |
| P5 | P4 | P4 标记 needs-review，重新实现 |
| P6 | P4 | P4 标记 needs-review，行为不符 → 重新实现（验收失败回实现）|
| P7 | P2 | P2 标记 needs-review，质疑设计（僵尸需求/偏差）|
| P8 | P7 | P7 标记 needs-review，重新检查一致性后再发布 |

**不区分原因、不判断分支**：主 Agent 只需确定 `retry_count[Pn] > MAX_RETRY` → 执行固定上溯动作，无需推理多变量决策。

### 用户介入边界

| 情况 | 动作 |
|------|------|
| P1 失败 3 轮 | PAUSED，报告用户需求可能不合理 |
| 涉及业务方向决策 | PAUSED，询问"这个功能要不要做" |
| 涉及外部资源/权限 | PAUSED，需 API key / 授权 |
| P1 检测到 CAPABILITY_GAP | PAUSED，等人补充能力路径或确认降级方案 |
| 任意阶段出现 [PROD_TOUCHED] | 立即 PAUSED，人工处置生产环境后才能继续 |
| 涉及批量删除或 schema 迁移（测试环境内）| [NEED_CONFIRM] → PAUSED，确认范围后才可执行 |
| 涉及安全/合规 | PAUSED，需要人判断 |
| retry 超限且上溯仍失败 | PAUSED，兜底机制 |

PAUSED 报告使用占位符模板（见 dispatch-protocol.md）。

---

*状态机是 /loop 自动编排的基础，配合 dispatch-protocol.md 和 loop-orchestration.md*
