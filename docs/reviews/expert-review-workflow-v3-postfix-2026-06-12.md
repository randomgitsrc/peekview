---
review_id: expert-review-workflow-v3-postfix
date: 2026-06-12
reviewer: gstack /review（偏执 Staff Engineer）+ /plan-eng-review（工程经理）
scope: workflow-v3 全量（README / dispatch-protocol / state-machine / loop-orchestration / role-system / git-integration / validation-plan / validation-report + 5 执行角色 + 模板）
target_commit: 2ed9a6e6（主动批判性自评审 + 修复发现2/5）
前置: gstack-review-workflow-v3-self-critique.md（6 发现，落地 2 项）
---

# Workflow v3 修复后专家评审

## 评审结论

修复后的 v3 文档质量高、自洽性强，派发协议（A1 原则、只传路径、独立验证）是真正解决 v2 病灶的核心机制，已通过 OpenCode 实测（方法 B 可用）。但本轮以「修复刚落地、文档刚改动」的视角逐行核对，发现**修复动作本身引入了 1 个阻塞级 bug 和 2 个悬空引用**，另有 2 个文件间矛盾在历次评审中一直未被消化。

**3 个阻塞级（必须修，都来自最近一次修复或文档演进的副作用）：**
- 发现 A：`loop-orchestration.md` LOOP 伪代码出现两个「步骤 8」——发现2 修复时改编号引入，循环逻辑断裂。
- 发现 B：「L3 需求质疑」是悬空术语——只在 loop-orchestration 出现，state-machine 的评审迭代机制只定义了 L1/L2，硬中断点引用了一个不存在的层级。
- 发现 C：`active-tasks.md` 更新策略自相矛盾——state-machine 说「主 Agent 重建」，git-integration 说「追加不重写」，主 Agent 无所适从。

**2 个重要（结构性，沿自评审但尚未决策）：**
- 发现 D：v3 从没用自己跑过一个真实任务（自评审发现4），validation 只验证了 echo 级派发，未验证「门槛判定 + 重试 + 回退」闭环。
- 发现 E：多 Agent 并发的任务锁仍缺失（自评审发现3），与发现 C 是同一病根的两面。

下面逐项给文件、行号、改法。

---

## 一、/review 视角（找会在运行时炸的东西）

### 发现 A（🔴 阻塞）：LOOP 伪代码有两个「步骤 8」

**位置**：`loop-orchestration.md` §/loop 的执行逻辑，LOOP 块

**现象**：
```
    7. 执行一步 ...
    8. if 门槛失败 && 重试超限:
         标记 PAUSED ... 退出
    8. goto LOOP        ← 又一个 8
```

**机理**：发现2 修复把原步骤 5 拆成 5/6，后续 6/7 顺延为 7/8，但末尾的 `goto LOOP` 没跟着改，留下两个 8。这不是排版问题——LLM 读伪代码执行时，两个同号步骤会让「退出」和「继续循环」的控制流语义打架，可能在重试超限本该 PAUSED 时反而 goto 回去，绕过护栏。

**改法**：末尾 `goto LOOP` 改为步骤 9。顺带核对：步骤 5（硬中断）和步骤 6（软确认）的判定顺序正确（硬在前），保留。

---

### 发现 B（🔴 阻塞）：「L3 需求质疑」是悬空引用

**位置**：`loop-orchestration.md:51` 和 `:97`（硬中断点定义）

**现象**：发现2 修复引入「硬中断点 = L3 需求质疑 / P7 发布 / ...」。但全仓 grep `L3` 只命中 loop-orchestration 这两行。state-machine.md 的「评审迭代机制」只定义了 **L1（阶段内再评审）** 和 **L2（单规则跨阶段上溯）**，从来没有 L3。

**机理**：自评审在描述「需求质疑不可自动化」时借用了「L3」这个看起来成体系的编号，但 v3 的分层机制里根本没有第三层。读者按图索骥去 state-machine 找 L3 的定义会扑空，硬中断点的判定条件因此**不可判定**——这违反 v3 自己的「门槛必须机器可判定」原则（原则4）。

**两个改法二选一**：
- **方案1（轻，推荐）**：把「L3 需求质疑」改为指向已有机制的具体条件——即 state-machine「用户介入边界」表里的「涉及业务方向决策 → PAUSED，询问功能要不要做」。硬中断点直接复用这张表，不发明新层级。
- **方案2（重）**：在 state-machine 评审迭代机制里正式补一节「L3：需求层质疑」，定义触发条件（如 P1 失败 3 轮上溯到用户、或任一阶段发现 AC 自相矛盾），让 L3 成为真实存在的层级。

判断：v3 当前的核心问题是膨胀（自评审发现1），方案2 是加法，方案1 是复用存量。选方案1。

---

### 发现 C（🔴 阻塞）：active-tasks.md 更新策略两份文档打架

**位置**：`state-machine.md:206` vs `git-integration.md:77`

**现象**：
- state-machine：「active-tasks.md 降级为汇总视图，不再由 subagent 修改，由主 Agent 在 push 前**重建**（扫描所有 .state.yaml）」
- git-integration 策略2：「active-tasks.md 用**追加**而非重写，只改自己任务那一行，减少冲突面」

**机理**：「重建」和「追加/只改一行」是互斥的两种写法。主 Agent 读到这两条会无所适从：
- 若按 state-machine 重建（全量扫描 .state.yaml 覆写）→ 与并发 agent 同时重建必然整文件冲突，git-integration 想减少的冲突面反而最大化。
- 若按 git-integration 只改一行 → 又违反 state-machine「重建」的指令，且 .state.yaml 与 active-tasks.md 可能漂移。

这正是自评审发现3（多 agent 状态竞争）在文档层的投影：两处分别给了不兼容的缓解策略，没人统一。

**改法**：定一个唯一真相源（SSOT），另一处改为引用。
- 推荐：**`.state.yaml` 是 SSOT，active-tasks.md 是派生视图**。
- state-machine 保留「重建」，但限定为「**仅 owner agent 重建自己负责的任务行**」，不是全表覆写。
- git-integration 策略2 改为：「active-tasks.md 由各任务 owner 只重写自己那一行（从该任务 .state.yaml 派生），不碰他人行」——这样「重建（单行）」与「只改一行」统一了。
- 配套：明确 active-tasks.md 永不手写、永远从 .state.yaml 派生，消除双写漂移。

---

### 发现 F（🟡 提示）：check-tdd-red.sh 的数字解析脆弱

**位置**：`state-machine.md` 内嵌的脚本（仓库 `scripts/check-tdd-red.sh` 已存在，已确认）

**现象**：`grep -oP '\d+ failed'` 依赖 pytest 文本输出格式。pytest 版本变化、插件（如 pytest-xdist）改写 summary 行，或出现 `1 failed, 2 errors` 同行时，正则可能取错数。

**影响**：非阻塞——脚本有 exit code 兜底（exit 0/1/2 分流），即使数字解析偏差，collection error 的 exit 1 分支仍能挡住「假红灯」。但 gate 显示的 `assertion_failures=N` 可能不准，误导人工判断。

**改法（可选）**：优先用 `pytest --tb=no -q --co -q` 与 `pytest -rf` 的机器可读输出，或加 `--json-report`。当前正则方案标为「已知限制」即可，不阻塞。

---

## 二、/plan-eng-review 视角（架构会不会后悔）

### 发现 D（🟠 已更正｜原前提错误）

**原发现**：「v3 从未用自己跑过真实任务」——**此判断有误，已撤回。**

**实际情况**：T002（数据库迁移机制修复）完整跑了 v3 的 P1-P7，跑完后 PM 发现 5 个缺陷。这些缺陷被系统复盘（postmortem-T002.md），转化为 16 项改进，T003 批次落地修复，再经主动批判性自评审。现在看到的 v3 正是「跑过真实任务后基于实践反馈修改的版本」。

**修正后的实际状况**：v3 已完成「首次真实任务验证 → 复盘 → 修复」的完整循环，是经过实践检验的版本，而非纯文档设计。自评审发现4（「没 dogfood」）的结论在自评审写作时可能是有效观察，但当前状态已超越该阶段。

**真正待观察的问题**：T002 完整跑通了 P1-P7 正常路径，但**重试循环、L2 上溯、P5→P4 回退**这些异常路径尚未被真实任务触发过。这不是阻塞，是已知的验证边界——下一个遇到这些路径的任务会自然完成这部分验证。

---

### 发现 E（🟠 重要｜架构）：任务锁缺失，与发现 C 同根

**现象**：自评审发现3 已点出「5 个 agent 同机跑，无任务锁，同一任务可能被两 agent 同时跑」。当前 .state.yaml 无 owner/lease 字段，git-integration 靠「push 串行 + rebase 重试」缓解，但那只防 push 冲突，**防不住两 agent 同时认领同一任务并各跑各的**。

**与发现 C 的关系**：发现 C 是「同一文件并发写」的文档矛盾，发现 E 是「同一任务并发跑」的机制缺失。修发现 C 时若引入 owner 概念（owner agent 才能重建自己的任务行），正好为发现 E 的 lease 铺路——一并设计更省事。

**最小改法**：.state.yaml 加两字段：
```yaml
owner: agent-id          # 谁认领了这个任务
lease_until: 2026-06-12T10:00:00Z   # 租约到期时间
```
主 Agent 单步函数开头：读 .state.yaml，若 owner 非自己且 lease 未过期 → 跳过该任务。认领时写 owner + 刷新 lease。这是 owner+lease 的最小实现，不需要分布式锁。**但**——按发现 D 的精神，这条也不该现在就实现，应等真实任务暴露出并发确实是瓶颈再加。先记入 backlog。

---

### 发现 G（🟡 提示｜流程）：lessons.md 被引用但不存在

**位置**：`implementer.md` P7 节「主 Agent 将这些汇入项目级 docs/process/lessons.md」

**现象**：仓库无 `docs/process/lessons.md`（已确认 MISSING）。首个走完 P7 的任务会试图追加一个不存在的文件。

**影响**：非阻塞，但会让首个 P7 任务的主 Agent 多一次「文件不存在」的判断。属于发现 D 那类「没真跑过才留下的空引用」。

**改法**：要么先建一个空的 `docs/process/lessons.md`（带表头：分类/教训/来源任务/日期），要么在 implementer.md 注明「文件不存在则创建」。建议后者，避免空文件占位。

---

## 三、修复清单（按优先级）

| # | 严重度 | 文件 | 改动 | 工作量 |
|---|--------|------|------|--------|
| A | 🔴 阻塞 | loop-orchestration.md | 末尾 `goto LOOP` 改步骤 9 | 1 行 |
| B | 🔴 阻塞 | loop-orchestration.md | 「L3 需求质疑」改为引用 state-machine 用户介入边界表的「业务方向决策」 | 2 行 |
| C | 🔴 阻塞 | state-machine.md + git-integration.md | 统一 active-tasks.md 派生策略：.state.yaml 为 SSOT，owner 只重写自己那一行 | ~6 行 |
| G | 🟡 提示 | implementer.md | lessons.md 注明「不存在则创建」 | 1 行 |
| D | ~~🟠 决策~~ | ~~（流程）~~ | ~~前提错误，已撤回：T002 已完整跑通 v3 P1-P7~~ | 撤回 |
| E | 🟠 决策 | （记入 backlog）| owner+lease 任务锁，等真实任务暴露并发瓶颈再实现 | 暂不做 |
| F | 🟡 可选 | state-machine.md | check-tdd-red 数字解析改机器可读，当前标已知限制 | 暂不做 |

A/B/C/G 是文档级机械修复，已落地。D 前提错误已撤回。E/F 记入 backlog，不现在做。

---

## 四、一句话总结

发现2 的修复方向对（硬中断点确实该有），但落地时引入了编号 bug（发现A）和悬空层级 L3（发现B），加上一直没消化的 active-tasks 双写矛盾（发现C），构成本轮必修的 3 个阻塞项——均已修复。发现D「v3 没跑过真实任务」前提有误：T002 已完整跑通 P1-P7，v3 是经过实践反馈修改的版本；真正的边界是异常路径（重试/L2 上溯/回退）尚未被触发，下一个遇到这些路径的任务会自然验证。当前 v3 在正常路径上是经过验证的可用系统。
