# Git 集成：状态落盘的持久化

> workflow-v4，定义"状态文件何时入 git"——这是状态落盘真正生效的保证

---

## 为什么这是必要机制，不是可选项

v4 强调"状态落盘 + 抗中断恢复"。但有个隐含前提：**这些落盘的文件什么时候提交到 git？**

如果不提交：
- 状态文件只在本地，会话崩溃 / 环境重置后**全部丢失**——抗中断设计失效
- 多 agent 协作时（一台机器多个 agent），其他 agent pull 不到当前进度，重复劳动或冲突

所以 git commit 是状态落盘机制的**必要组成部分**，不是额外的运维步骤。

---

## 三条规则

### 规则 1：commit 由主 Agent 做，不是 subagent

subagent 在独立上下文里只负责产出文件，**不碰 git**。commit 是编排层（主 Agent）的职责。

如果每个 subagent 自己 commit，会产生混乱的提交历史，且 subagent 不知道全局状态，无法写出有意义的 commit message。

### 规则 2：一个阶段 = 一个 commit

不是每个 subagent 的中间操作都 commit（噪音太多），也不是整个任务才 commit 一次（中途崩溃丢进度）。

**粒度：每个阶段门槛通过后，主 Agent commit 一次。** 一个 Pn 阶段的产出是一个原子的进度单位。

```
P2 门槛通过（status==approved）→ 主 Agent commit
  message: "wf(T002-P2): 方案设计通过 — schema_version 表 + 顺序迁移脚本"

P5 门槛通过（failed==0）→ 主 Agent commit
  message: "wf(T002-P5): 验证通过 — 23 测试全绿，P1 问题 5/5 解决"
```

commit message 格式：`wf({task_id}-{phase}): {一句话进度}`，可追溯。

> 注：`wf()` 前缀是 v4 工作流进度提交的专用约定，与项目现有的 Conventional Commits（`feat:`/`fix:`/`docs:` 等）**并行使用，不冲突**。`wf()` 用于任务阶段进度，其他前缀用于常规变更（功能、修复、文档）。

### 规则 3：push 分档位，且 push 前必须 pull --rebase

push 涉及和远端同步，多 agent 并发 push 会频繁冲突。不该每个 commit 都立即 push。

```
档位 A/B（手动/半自动）：
  - 每个任务完成（P7）后 push 一次
  - 或用户明确要求 push 时

档位 C（/loop 全自动）：
  - 默认每个任务完成时 push
  - 可配置 --push-every-phase 改为每阶段 push（多 agent 需要实时同步时）

push 前必须：git pull --rebase origin main
push 失败（远端有新提交）→ pull --rebase → 重新 push，最多重试 3 次
  → 仍失败 → PAUSED 报告人工（可能有冲突需要手动解决）
```

---

## 多 Agent 并发的特别说明

一台机器多个 agent 同时跑不同任务时，git 是共享的。冲突主要来自：

1. **active-tasks.md 并发修改**：多个 agent 同时更新看板 → 冲突高发
2. **同时 push**：A push 成功后 B push 被 reject

### 缓解策略

**策略 1：任务目录隔离**
每个任务的产出在自己的 `docs/tasks/Txxx/` 目录，不同任务的 agent 改不同目录，文件级冲突少。

**策略 2：active-tasks.md 只改自己任务那一行**
看板更新：owner agent 从该任务 `.state.yaml` 派生，**只重写自己负责的那一行**，不整体重写，不碰其他任务的行。`.state.yaml` 是唯一真相源，active-tasks.md 是派生视图。（与 state-machine.md 一致）

**策略 3：push 串行化（推荐）**
多 agent 环境下，push 操作天然串行（git 远端是单点）。每个 agent push 前 pull --rebase，失败就重试。这是 git 的标准并发模型，能 work，只是偶尔要重试（本项目开发过程中已多次验证：rebase 后重推即可）。

**策略 4：高并发时考虑分支**
如果 agent 数量多、冲突频繁，可以每个任务用独立分支，完成后合并。但这增加复杂度，单机 5 个 agent 的规模用 main + rebase 通常够用。

---

## commit/push 在状态机里的位置

```
主 Agent 单步函数（见 state-machine.md），补充 git 步骤：

function 执行一步(task_id):
    1. 读 active-tasks.md → 当前状态
    2. 确认输入就绪
    3. 派发 subagent
    4. 接收返回 + 校验
    5. 判定门槛
    6. 更新 active-tasks.md
    7. 【新增】git commit（规则 2：一阶段一 commit）
       git add docs/tasks/{task_id}/ docs/process/.../active-tasks.md
       git commit -m "wf({task_id}-{phase}): {摘要}"
    8. 【新增】按档位决定是否 push（规则 3）
       if 该 push:
           git pull --rebase origin main
           git push（失败则 rebase 重试，最多 3 次）
    9. 返回下一状态
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| commit 失败（无改动）| 跳过，可能是 subagent 没产出文件，回到门槛检查 |
| push reject（远端更新）| pull --rebase → 重推，最多 3 次 |
| rebase 冲突 | PAUSED，报告人工（自动解冲突风险高，不做）|
| 3 次重推仍失败 | PAUSED，报告人工 |

**rebase 冲突绝不自动解决**——自动解冲突可能丢数据。遇到冲突就停下来交给人。

---

## 与"抗中断恢复"的闭环

git 集成让状态落盘真正闭环：

```
状态写入文件（state-machine）
    ↓
每阶段 commit（git-integration）← 持久化到版本库
    ↓
会话崩溃 / 环境重置
    ↓
重新 clone / pull → 状态文件完整恢复
    ↓
读 active-tasks.md → 接着上次的阶段继续
```

没有 git 集成，"状态落盘"只是写本地文件，崩溃就丢。有了它，状态真正持久、可恢复、可多 agent 共享。

---

*git 集成是状态落盘机制的必要组成部分，配合 state-machine.md 和 loop-orchestration.md*
