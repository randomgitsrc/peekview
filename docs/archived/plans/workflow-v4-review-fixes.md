# Workflow v4 评审修复方案

> 创建：2026-06-12
> 关联评审：docs/reviews/expert-review-workflow-v4-2026-06-12.md
> 优先级：🟠 近期（P0 阻塞项 + P1 文档一致性）

---

## 修复范围

按评审报告的优先级分三批执行，每批可独立 commit。

| 批次 | 优先级 | 项数 | 说明 |
|------|--------|------|------|
| 第 1 批 | P0 | 3 项 | 实操阻塞 + 文档矛盾 |
| 第 2 批 | P1 | 4 项 | 逻辑缺口 + 文档身份 |
| 第 3 批 | P2 | 5 项 | 机制增强 |

---

## 第 1 批：P0（实操阻塞）

### Fix-1：创建 `scripts/check-tdd-red.sh`（对应 S6）

**问题**：P3 gate 依赖此脚本，仓库中不存在。

**修复**：按 `state-machine.md:129-158` 的设计，实际创建脚本文件。

**文件**：`scripts/check-tdd-red.sh`

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

exit 0
```

**验证**：`bash scripts/check-tdd-red.sh` 在有 pytest 项目的目录下可执行。

---

### Fix-2：统一小结触发时机为 P8（对应 D8）

**问题**：`dispatch-protocol.md:293` 写"P7 gate 通过、状态进入 READY 时"输出小结，`state-machine.md:108` 是 P8 gate 通过后进 READY。应为 P8。

**修复**：

文件 `dispatch-protocol.md`，第 293 行：
```
- 旧：**触发时机：P7 gate 通过、状态进入 READY 时。强制输出，不可跳过。**
+ 新：**触发时机：P8 gate 通过、状态进入 READY 时。强制输出，不可跳过。**
```

---

### Fix-3：修正 P7 grep 命令（对应 S4 问题 1）

**问题**：`grep -L 'BLOCKER' P7-consistency.md 有输出` 逻辑正确但晦涩，且 exit code 不可靠。

**修复**：

文件 `state-machine.md`，P7 转移规则（第 90 行区域）：
```
- 旧：P7 --[grep -L 'BLOCKER' P7-consistency.md 有输出]--> P8
+ 新：P7 --[! grep -q '\[BLOCKER\]' P7-consistency.md]--> P8
```

同步更新 `state-machine.md` 单步函数中 P7 门槛描述：
```
- 旧：P7: grep 无 [BLOCKER] 标记
+ 新：P7: ! grep -q '\[BLOCKER\]' P7-consistency.md
```

同步更新 `dispatch-protocol.md` 门槛表中 P7→P8 行：
```
- 旧：P7→P8 | 一致性通过 | `grep` 无 `[BLOCKER]`
+ 新：P7→P8 | 一致性通过 | `! grep -q '\[BLOCKER\]' P7-consistency.md`
```

---

## 第 2 批：P1（逻辑缺口 + 文档身份）

### Fix-4：定义 P3 跳过后 P4 门槛（对应 S1）

**问题**：P3 可选跳过，但 P4 门槛依赖 P3 测试代码。跳过后 P4 门槛未定义。

**修复**：在 `state-machine.md` P4 转移规则后增加 P3 跳过的替代门槛：

```
P4（P3 已执行）--[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit AND P3 红灯测试变绿]--> P5
P4（P3 已跳过）--[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit AND pytest -q exit 0 AND failed==0]--> P5
```

在 `README.md` 可裁剪阶段说明中补注：

```
P3 跳过时，P4 的门槛自动从"P3 红灯变绿"降级为"pytest 全绿"（实现与测试一起做，TDD 降级为实现后补测试）。
```

在 `dispatch-protocol.md` 门槛表中 P4→P5 行增加分支说明。

---

### Fix-5：修复 8 处 v3→v4 标注（对应 D1-D5）

逐文件修改：

| # | 文件 | 行 | 旧文本 | 新文本 |
|---|------|-----|--------|--------|
| D1 | `validation-plan.md` | 1 | `Workflow v3 落地验证方案` | `Workflow v4 落地验证方案` |
| D1b | `validation-plan.md` | 3 | `验证 v3 的派发机制` | `验证 v4 的派发机制` |
| D1c | `validation-plan.md` | 11 | `v3 的派发机制` | `v4 的派发机制` |
| D1d | `validation-plan.md` | 13 | `1. **主 Agent 会派发子 Agent**，而不是自己一路干到底（这是 v2 的核心病灶）` | `1. **主 Agent 会派发子 Agent**，而不是自己一路干到底（这是 v2 的核心病灶）`（此条保留 v2，正确） |
| D1e | `validation-plan.md` | 19 | `验证方法 B（v3 推荐` | `验证方法 B（v4 推荐` |
| D2 | `validation-report.md` | 1 | `Workflow v3 验证报告` | `Workflow v4 验证报告` |
| D2b | `validation-report.md` | 5 | `验证 workflow-v3 的派发机制` | `验证 workflow-v4 的派发机制` |
| D2c | `validation-report.md` | 18 | `**最终判定**：✅ **v3 可用**` | `**最终判定**：✅ **v4 可用**` |
| D2d | `validation-report.md` | 120 | `**v3 可以投入使用` | `**v4 可以投入使用` |
| D3 | `state-machine.md` | 11 | `所以 v3 不依赖 LLM 记住状态` | `所以 v4 不依赖 LLM 记住状态` |
| D4 | `loop-orchestration.md` | 207 | `v3 当前严格串行派发` | `v4 当前严格串行派发` |
| D5 | `dispatch-protocol.md` | 339 | `*派发协议是 v3 解决上下文爆炸的核心` | `*派发协议是 v4 解决上下文爆炸的核心` |

实际修改时需逐文件 grep `v3` 确认完整列表，上表为评审已识别的 8 处。

---

### Fix-6：增加 PAUSED→恢复协议（对应 G1）

**问题**：PAUSED 有报告模板但无恢复规则。

**修复**：在 `state-machine.md` 特殊转移区域增加：

```
PAUSED 恢复协议：
  PAUSED --[人工确认/决策]--> 恢复到 PAUSED 前的阶段

  恢复步骤：
  1. 主 Agent 重读该任务的 .state.yaml → 获取 PAUSED 前的阶段和 retry 计数
  2. 人工回复的内容写入 docs/tasks/{Txxx}/PAUSED-resolution.md（含 Header）
  3. 主 Agent 将 PAUSED-resolution.md 路径加入重派 prompt（"人工决策见此文件"）
  4. 按 PAUSED 前的阶段重新派发 subagent（retry 计数不清零）

  PAUSED 期间 SCOPE+ 处理：
  - SCOPE+ 在 PAUSED 期间暂不处理，等恢复后一并纳入 P1 基线增补
  - 如 SCOPE+ 与 PAUSED 原因相关（如验收中发现新需求导致 NEED_CONFIRM），恢复时优先处理
```

---

### Fix-7：P8 gate 补注 packages 动态生成规则（对应 S5）

**问题**：state-machine.md P8 门槛未引用 dispatch-protocol.md 的 packages 动态注入规则。

**修复**：在 `state-machine.md` P8 转移规则（第 95 行区域）末尾补注：

```
P8 --[每个声明的 package 的发布检查命令 exit 0 + git diff 确认各包 version bump + CHANGELOG]--> READY
    （gate 命令集由 P2-design.md 的 packages: 声明动态生成，规则见 dispatch-protocol.md「packages 动态注入（B4/B6）」节。
     单包默认 make pre-publish；多包如 [peekview, mcp-server] → make pre-publish && make test-mcp-unit）
```

替换当前版本中已有的简短注释，使其与 dispatch-protocol.md 完全对齐。

---

## 第 3 批：P2（机制增强）

### Fix-8：增加 SCOPE+ 影响范围决策矩阵（对应 S3）

**修复**：在 `README.md`「定向回补」节后增加：

```
### SCOPE+ 回补决策矩阵

主 Agent 判断回补范围时，按以下矩阵决策，不靠临场判断：

| SCOPE+ 类型 | 需要回补的阶段 | 不需要回补的 |
|---|---|---|
| 新增 BDD 条件（纯行为层面） | P6（验收）+ 视情况 P4（实现） | P2/P3（设计/测试不受影响） |
| 修改已有 BDD 条件 | P4（实现）+ P5（验证）+ P6（验收） | P2/P3 |
| 新增 packages/domains | P2（设计）+ P3（测试）+ P4+P5+P6 | — |
| 仅文档/注释遗漏 | 不回补，记入 P7 | 所有执行阶段 |
```

---

### Fix-9：增加 BDD 质量门槛（对应 R1）

**修复**：在 `state-machine.md` P1 转移规则和 `dispatch-protocol.md` 门槛表中，P1→P2 门槛追加：

```
P1→P2 门槛追加：每条 BDD 的 Then 子句必须包含可量化/可断言的预期值
（如"15 天后""status=200""返回 N 条记录"），不含模糊词（如"体验良好""正常工作""更快"）。
主 Agent 在判定 P1 门槛时，grep Then 行中是否含模糊词，有则标记需补充。
```

在 `analyst.md` 质量门槛中追加：

```
- BDD Then 子句含可量化预期值，无模糊词
```

---

### Fix-10：增加 P7 覆盖度门槛（对应 S4 问题 2）

**修复**：在 `state-machine.md` P7 转移规则增加覆盖度检查：

```
P7 --[! grep -q '\[BLOCKER\]' P7-consistency.md AND P7-consistency.md 包含对 P2-design.md 每个设计要点的逐项对照（一致性声明数 >= P2 设计要点数）]--> P8
```

在 `architect.md` P7 质量门槛中追加：

```
- P7 一致性声明覆盖 P2-design.md 每个设计要点，声明数 >= P2 设计要点数
```

---

### Fix-11：清理 D7 已实现改进项（对应 D7）

**修复**：在 `loop-orchestration.md`「已知改进项」中，删除第 2 项：

```
删除：
**2. 评审角色选择的可判定化**
当前评审角色由主 Agent"根据任务内容判断"，这是模糊判断...
```

替换为：

```
**2. ~~评审角色选择的可判定化~~**（已实现：role-system.md domains→评审角色机械映射，C8 规则）
```

---

### Fix-12：链式上溯拦截规则（对应 D6/R3）

**修复**：在 `state-machine.md` L2 上溯机制后增加拦截规则：

```
### 链式上溯拦截

L2 上溯每次只跳一个阶段。但多次上溯可能链式组合，等效于跨多阶段回退（如 P5→P4→P2）。

**拦截规则**：当 L2 上溯的目标阶段与当前阶段不相邻时（即上溯会跳过至少一个中间阶段），先 PAUSED 通知人工，不自动执行。

具体：上溯时检查 retry_count[目标阶段]，若目标阶段与当前阶段之间还有中间阶段未耗尽 retry，优先在中间阶段重试；只有中间阶段全部耗尽后才允许跳过，但必须 PAUSED 报告。
```

---

## 不在本方案范围

以下项已搁置，记录至 docs/roadmap/improvement-backlog.md（#14-#17）：

| 项 | 搁置理由 |
|----|----------|
| Fix-4（P3 跳过后 P4 门槛） | B1: P4 gate 不依赖 P3，现有状态机天然正确 |
| Fix-8（SCOPE+ 决策矩阵） | 待 5-10 个真实 SCOPE+ 场景积累后再评估 |
| Fix-9（BDD 可量化门槛） | 待 P6 验收失败数据积累后再评估 |
| Fix-10（P7 覆盖度门槛） | 待 P7 产出与回归结果关联分析后再评估 |
| Fix-12（链式上溯拦截） | B2: 原方案与 L2 表冲突，待真实链式场景后再设计 |

以下 P3 项留待后续按需推进：

| 项 | 理由 |
|----|------|
| 小任务 P1 降级（R2） | 需实际任务验证降级后的基线是否够用 |
| 跨任务依赖（G2） | 大任务拆分场景尚未出现 |
| mcp domain 评审映射具体化（G3） | 需 MCP 变更任务验证 |
| Header 格式校验（G4） | 低频问题，实操中再观察 |
| P6 实跑分层（S2） | 需验收阶段实际执行后总结经验 |

---

## 执行状态

| 批次 | 状态 | commit | 内容 |
|------|------|--------|------|
| 第 1 批（P0） | ✅ 完成 | `2af1985e` | Fix-1 + Fix-2 + Fix-3 + Fix-11 |
| 第 2 批（P1） | ✅ 完成 | `a4d64f04` | Fix-6 + Fix-7 + Fix-5 + Fix-13 |
| 第 3 批（P2） | ⏸ 搁置 | — | Fix-8/9/10/12 → improvement-backlog.md #14-#17 |

---

## 执行顺序（原计划，已调整）

```
第 1 批（P0）：Fix-1 → Fix-2 → Fix-3 → commit "fix(wf-v4): P0 fixes — create check-tdd-red.sh, unify D8, fix P7 grep"
第 2 批（P1）：Fix-4 → Fix-5 → Fix-6 → Fix-7 → commit "fix(wf-v4): P1 fixes — P3-skip P4 gate, v3→v4 labels, PAUSED recovery, P8 gate cross-ref"
第 3 批（P2）：Fix-8 → Fix-9 → Fix-10 → Fix-11 → Fix-12 → commit "feat(wf-v4): P2 enhancements — SCOPE+ matrix, BDD quality, P7 coverage, chain-escalation guard"
```
