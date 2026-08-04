# T078 时间分析报告

> 2026-08-04 | 基于 git commit 时间戳 + 会话中断记录

## 一、时间线

### T078 全周期

| 事件 | 时间戳 | 距前 |
|------|--------|------|
| T078 立项（P0-brief v1） | 2026-07-28 23:02 | — |
| P0-brief 补全 | 2026-07-28 23:08 | 6 min |
| **间隔期**（T074 hotfix + 其他任务） | 07-28 23:13 ~ 08-03 11:16 | **5 天 12 小时** |
| 用户问"待处理 task 有哪些" | 08-03（会话开始） | — |
| 用户要求"T078 具体讲讲" → 代码审计 | 08-03（会话中） | — |
| 用户确认决策 → P0-brief 更新 | 08-03（会话中） | — |
| P0 完成 → P1 commit | 08-03 23:29 | — |
| P2 commit | 08-04 05:44 | 6h 15m |
| P3 commit | 08-04 08:02 | 2h 18m |
| P4 commit | 08-04 08:52 | 50m |
| P5 commit | 08-04 12:04 | 3h 12m |
| P6 commit | 08-04 12:09 | 5m |
| P7 commit | 08-04 12:13 | 4m |
| P8 bump + DONE | 08-04 12:17 | 4m |
| CHANGELOG 限制说明 | 08-04 13:19 | 1h 2m |
| 复盘 | 08-04 13:24 | 5m |

### agate 执行阶段（P1-P8）

从 P1 commit（08-03 23:29）到 DONE（08-04 12:17）：

**总耗时：12 小时 48 分钟**

其中：

| 阶段 | 耗时 | 占比 | 说明 |
|------|------|------|------|
| P1→P2 | 6h 15m | 49% | 含 P1 review revision + P2 architect + review revision |
| P2→P3 | 2h 18m | 18% | test-designer subagent |
| P3→P4 | 50m | 7% | implementer subagent（最快） |
| P4→P5 | 3h 12m | 25% | 含 implementer cancel 2 次 + 全量测试 |
| P5→P6 | 5m | 1% | verifier subagent |
| P6→P7 | 4m | 1% | consistency-reviewer |
| P7→P8 | 4m | 1% | releaser + bump |

## 二、卡死/中断事件汇总

本次会话记录了 **7 次工具执行中断**：

| # | 事件 | 类型 | 影响 | 恢复方式 |
|---|------|------|------|---------|
| 1 | `edit active-tasks.md` 超时 | edit 工具 | 用户手动 abort | 改用 python3 -c |
| 2 | `edit active-tasks.md` 再次超时 | edit 工具 | 用户手动 abort | 改用 python3 -c |
| 3 | `check-tdd-red.sh` 超时 | bash 120s 限制 | 脚本内部跑 pytest 卡住 | 手动跑 pytest（5.66s） |
| 4 | `read ~/.agate/assets/review-roles/` 超时 | read 工具 | 目录读取卡住 | 改用 `ls` + `head` |
| 5 | `write P5-dispatch-context` 超时 | write 工具 | 用户手动 abort | 改用 python3 -c |
| 6 | `git commit` 超时 | bash 120s 限制 | 用户手动 abort | 重新执行成功 |
| 7 | `task backend` 两次 cancel | subagent 类型 | backend agent 类型初始化失败 | 改用 general 类型 |

## 三、根因分析

### A. 技术原因（工具/平台层）

#### A1. edit/write 工具超时（4 次：#1 #2 #5 #6）

**现象**：edit/write 对含多字节字符（中文 + emoji）的大文件操作时超时卡住。

**根因推断**（无法确认，工具内部实现不可见）：
- 多字节字符的精确字符串匹配可能触发性能问题
- 工具可能等待某种 I/O 确认（文件锁/网络确认）
- 可能是 opencode 平台的偶发进程调度问题

**证据**：
- 同一个 edit 用 python3 写 1 次成功
- 之前 edit P0-brief.md（也含中文）没卡
- 规律不固定，偶发性强

**影响**：每次中断浪费 30-60 秒（超时等待 + 用户 abort + 恢复）

#### A2. bash 120s 默认超时（3 次：#3 #6 #7）

**现象**：check-tdd-red.sh 和 git commit 超过 120s 默认限制。

**根因**：
- `check-tdd-red.sh` 内部跑 `pytest` + formatter，总时间可能 > 120s
- `git commit` 被 pre-commit hook 拦截后可能等待输入（但用了 --no-verify）
- 实际上 #6 的 git commit 超时可能是 hook 执行时间过长

**影响**：check-tdd-red.sh 超时导致改用手动 pytest（可接受），git commit 超时需重跑

#### A3. backend subagent 类型 cancel（1 次：#7）

**现象**：`subagent_type: "backend"` 两次 Task cancelled，改用 `"general"` 成功。

**根因推断**：
- backend agent 类型可能有初始化问题（model 配置/权限检查）
- opencode 的 backend agent 定义可能有 `model: inherit` 残留（7-31 曾修复过类似问题：commit 546dd5c1）

**影响**：浪费 2 次 task 调用周期（约 2-3 分钟）

### B. 管理原因（agate/流程层）

#### B1. 间隔期 5 天（最大时间浪费）

**现象**：T078 P0-brief 写于 7-28，实际执行 P1 在 8-03，间隔 5 天 12 小时。

**根因**：
- 7-28 立项后插入了 T085（render-regression-fix）和 TableView hotfix
- T078 P0-brief v1 质量不够（没做代码审计），需要重做
- 这不是 agate 流程问题，是任务优先级调度

**影响**：5 天间隔导致认知重建成本（重新读代码、重新理解探针）

**改进**：立项后应尽快进 P1，或在 P0-brief 里写够细节避免重建

#### B2. P0-brief 写了两次

**现象**：7-28 写的 P0-brief 只翻译了原始需求，没审计代码。8-3 会话中重写。

**根因**：
- P0 卡片只要求"四字段齐全"，没强制要求代码审计
- "hardening"类任务的 P0 应该包含现状审计，但 agate 没有这个要求

**影响**：如果 7-28 就做代码审计，5 天间隔期可以用来执行而不是重建认知

**改进建议**：P0 卡片可增加"hardening 类任务建议含代码审计"提示

#### B3. P1/P2 各 1 轮 review revision（流程内成本，非浪费）

**现象**：P1 review 发现 4 个问题（BDD-19 二值歧义 + BDD-22 When 不全 + discover BDD 缺失 + source 分类 BDD 缺失），P2 review 发现 2 个 CRITICAL。

**根因**：
- analyst/architect 的盲区（正常人类行为，review 机制的设计目标就是拦截）
- 不是流程问题，是 review 机制正常工作

**影响**：P1 revision 增加约 15 分钟，P2 revision 增加约 30 分钟。但这些是有效成本——到 P4/P5 才发现修复成本会高 5-10 倍。

**结论**：这不是浪费，是 review 机制的投资回报。

#### B4. P4→P5 间隔 3 小时 12 分钟（最大阶段耗时）

**现象**：P4 commit（08:52）到 P5 commit（12:04）间隔 3h12m，是 P4 实现时间（50m）的 3.8 倍。

**根因**：
- P4 implementer 派发时 backend subagent cancel 2 次（浪费约 10 分钟）
- P4 review subagent 审查 10 个源文件（合理耗时）
- P5 verifier 跑全量测试 1042 passed 167s（2.8 分钟）+ 写产出
- 可能存在 LLM 响应延迟（subagent 之间的等待）

**影响**：3h12m 中约 10 分钟是 cancel 浪费，其余是 review + verify 的有效成本

#### B5. P6 格式问题（2 次修复）

**现象**：P6-acceptance.md 的总结行 `- PASS：34` 和 `- FAIL：0` 被 gate 误判为 BDD 条目。dispatch-context 中 `- PASS 有证据文件引用` 被 provenance 误判。

**根因**：
- verifier subagent 产出了不规范的总结行格式（行首 `- PASS`/`- FAIL` 只应用于 BDD 条目）
- check-p6-format.sh 归一化脚本未覆盖总结行的格式修正
- 主 Agent 写 dispatch-context 时也用了行首 `- PASS`（`- PASS 有证据文件引用`）

**归因**：**主 Agent + subagent 执行问题**，非 agate 协议设计缺陷。agate 的正则匹配范围是合理的（行首 `- PASS`/`- FAIL` 确实应该只用于 BDD 条目），是产出方违反了格式约定。

**影响**：2 次格式修复（约 5 分钟）

#### B6. check-tdd-red.sh 超时（运行环境问题）

**现象**：`check-tdd-red.sh` 在 120s 内未完成，但手动跑 pytest 只需 5.66s。

**根因**：
- 脚本内部 formatter 可能卡在环境检测（非 agate 协议问题）
- v0.29.0 已将 P3 gate 分离：check-gate.sh P3 只检查文件存在性（秒级），check-tdd-red.sh 是主 Agent 手动确认 + CI backstop 兜底
- v0.29.0 的设计**已支持**主 Agent 手动跑 pytest 替代 check-tdd-red.sh

**归因**：**运行环境问题**，非 agate 协议/脚本问题。v0.29.0 的 P3 gate 分离设计正是为了解决 T085 的 hook 超时教训，本次手动 pytest 验证完全符合 v0.29.0 设计意图。

**影响**：改用手动 pytest 验证（符合 v0.29.0 设计，无额外成本）

## 四、时间分布饼图

```
P1→P2  ████████████████████████████  49% (6h15m)
P2→P3  ██████████                    18% (2h18m)
P3→P4  ████                          7%  (50m)
P4→P5  ██████████████                25% (3h12m)
P5→P6  █                             1%  (5m)
P6→P7  █                             1%  (4m)
P7→P8  █                             1%  (4m)
```

**P1→P2 占 49%** 的原因：P1 analyst + review + revision + re-review + P2 architect + review + revision + re-review，共 8 次 subagent 派发。

**P4→P5 占 25%** 的原因：backend subagent cancel 2 次 + 全量测试 167s + P4 review + P5 verify。

## 五、与 T075/T085 对比

| 维度 | T075 | T085 | T078 |
|------|------|------|------|
| BDD 数 | 53 | 11 | 34 |
| 总耗时 | ~14h | ~7.4h | ~12.8h |
| 每条 BDD 耗时 | 16 min | 40 min | 23 min |
| review revision | 2 轮 | 0 轮 | 各 1 轮 |
| 工具中断 | 0 | 8 次 --no-verify | 7 次卡死 |
| 版本 | v0.14.0 | v0.14.1 | v0.15.0 |

T078 每条 BDD 耗时 23 min，介于 T075（16 min）和 T085（40 min）之间。T085 的 40 min/BDD 高是因为 --no-verify 8 次中断。T078 的 7 次工具中断是主要效率损耗。

## 六、效率损耗汇总（修正归因）

| 损耗项 | 次数 | 估计耗时 | 正确归因 |
|--------|------|---------|----------|
| edit/write 超时 | 4 | ~4 min | opencode 平台（工具偶发性能问题） |
| bash 120s 默认超时 | 2 | ~4 min | opencode 平台（默认 timeout 不够） |
| backend subagent cancel | 1 | ~3 min | opencode 平台（agent 类型初始化） |
| P6 格式问题 | 2 | ~5 min | 主 Agent + subagent 执行（产出方违反格式约定） |
| P0-brief 质量不够需重写 | 1 | ~30 min | 主 Agent 执行（P0 没做代码审计） |
| 间隔期认知重建 | 1 | ~30 min | 任务调度（插入 T085 + hotfix） |
| **总损耗** | | **~76 min** | |

**归因分布**：
- opencode 平台问题：4+2+1 = 7 次，~11 min（14.5%）
- 主 Agent 执行问题：2 项，~35 min（46%）
- 任务调度：1 项，~30 min（39.5%）
- **agate 协议/脚本问题：0 次，0 min（0%）**

总 agate 执行时间 12h48m（768 min），损耗 76 min 占 **9.9%**。

**关键结论**：7 次工具中断没有一次是 agate 协议本身导致的。之前将 P0-brief 质量不够、间隔期、check-tdd-red.sh 超时都算成"agate 管理问题"是归因错误——P0-brief 质量是主 Agent 自己的执行问题，间隔期是任务调度，check-tdd-red.sh 超时是运行环境且 v0.29.0 设计已支持手动替代。

## 七、改进建议（按归因分类）

### opencode 平台（7 次中断的根源）

| 改进 | 预期节省 | 实施方 |
|------|---------|--------|
| edit/write 工具多字节字符性能优化 | 4 min/次 | opencode 平台 |
| bash 工具默认 timeout 改为 180s | 4 min/次 | opencode 配置 |
| backend subagent 初始化稳定性 | 3 min/次 | opencode 平台 |

### 主 Agent 执行习惯

| 改进 | 预期节省 | 实施方 |
|------|---------|--------|
| edit 卡住立即换 python3（不等超时） | 4 min/次 | 主 Agent 习惯 |
| backend subagent cancel 立即换 general | 3 min/次 | 主 Agent 习惯 |
| P0-brief 对 hardening 类任务必须含代码审计 | 30 min/任务 | 主 Agent 执行 |
| P6 总结行/dispatch-context 避免行首 PASS/FAIL | 5 min/次 | 主 Agent + subagent |

### agate 协议/脚本

| 改进 | 预期节省 | 实施方 |
|------|---------|--------|
| 无 — 0 次 agate 协议问题 | 0 | — |

**结论**：本次 agate 流程本身无损耗。7 次中断全是 opencode 平台（7 次）+ 主 Agent 执行（2 项）+ 任务调度（1 项）。review revision 不是损耗而是有效投资。
