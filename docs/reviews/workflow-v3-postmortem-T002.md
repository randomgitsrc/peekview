---
review_type: postmortem
task: T002
date: 2026-06-12
author: 主 Agent (T002 编排者)
trigger: T002 P7 完成后 PM 发现 5 个问题
---

# Workflow-v3 复盘：T002 暴露的 3 个机制缺陷

## 背景

T002（数据库迁移机制修复）是 v3 规范下跑完的第一个完整 P1-P7 任务。PM 在 P7 完成后指出 5 个问题，经分析归因为 v3 的 3 个机制缺陷。

---

## 问题回溯

| # | PM 反馈 | 对应缺陷 |
|---|---------|----------|
| 1 | 小结缺失，只有版本号无改动说明 | 主 Agent 未做总结（编排层职责缺失） |
| 2 | CHANGELOG 有更新但没看到 | 同上 |
| 3 | P1 AC 定义不合理（AC6 为已否决方案而写） | P6 一致性检查不够深度 |
| 4 | PyPI 未发布，仍是 v0.1.52 | 缺陷 2：P7 gate 定义不完整 |
| 5 | 主 Agent 全面相信 subagent，未验证 | 缺陷 1+3：gate 验证不足 + 无证据要求 |

---

## 缺陷 1：Gate 验证是「读 subagent 写的文件」而非「主 Agent 自己跑命令」

### 现象

v3 所有 gate 判定依赖「读产出文件的字段」：

```
P5→P6: unit.md 里 failed: 0        ← subagent 写的
P7→DONE: P7-release.md 存在        ← subagent 写的
```

主 Agent 读 `unit.md` 看到 `failed: 0` 就判定通过。问题：**subagent 写的文件本质不可信**——subagent 可以在文件里写任何东西，主 Agent 无法分辨真假。

### 根因

`dispatch-protocol.md` 的 gate 判定方式全部是「读 subagent 产出文件的字段」，没有要求「主 Agent 自己跑命令独立验证」。这导致主 Agent 只能信任 subagent 的自我报告。

关键认知：只有主 Agent 自己观测到的结果才可信——自己跑的 `pytest -q` 的 exit code、自己跑的 `make lint` 的输出、自己 `git diff` 看到的内容。subagent 文件里的任何声明都是不可验证的二手信息。

### 修复方案

**主 Agent 在 gate check 时必须亲自执行验证命令，不依赖 subagent 产出文件中的声明。**

| 阶段 | 当前判定 | 修复为（主 Agent 亲自执行） |
|------|----------|--------------------------|
| P3→P4 | 读文件确认 test file 存在 | `pytest --collect-only -q` 收集成功 + 失败均为 assertion failure（非 error） |
| P5→P6 | 读 unit.md 的 failed 字段 | `pytest -q` exit 0（亲手跑，不相信 unit.md） |
| P7→DONE | P7-release.md 存在 | `make pre-publish` exit 0 + `git diff` 确认 version bump + CHANGELOG 更新 |

**手动验证项无法自动化怎么办？** P5 的 manual.md 含手工检查结论（如逐个对照 P1 问题），主 Agent 无法自动化验证。这类手动项仍依赖 subagent 文件，但主 Agent 可通过已跑过的自动化命令（pytest 全绿）建立信任基线——自动化部分独立验证通过，手动部分合理可信。

> ⚠️ 命令执行会引入输出到主 Agent 上下文（如 pytest 结果行），但量极小（pytest 结果行 <10 行），远小于读文件全文。这是可接受的 trade-off。

---

## 缺陷 2：P7 概念错误 —「发布」vs「发布准备」

### 现象

P7 subagent bump 了 `pyproject.toml` 版本号 + 更新 CHANGELOG，但**没有执行 `make publish`**。PyPI 仍显示 v0.1.52。

### 根因

`state-machine.md` 定义：
```
P7 --[P7-release.md 存在]--> DONE
```

这个定义有两层问题：

**问题 A：P7 不应该等于「已发布」。** 不是每次任务都需要发版到 PyPI（如内部重构、文档变更）。真正发版到 PyPI 是不可逆操作，必须由人手动执行，不能交给 subagent 自动化。

**问题 B：即使需要发版，gate 也不应该是「文件存在」这种无法验证实际结果的条件。**

### 修复方案

P7 重新定义为「**发布准备**」，不自动 publish：

```
P7 subagent 执行：
  1. bump version (pyproject.toml)
  2. 更新 CHANGELOG  
  3. 产出 P7-release.md（改动摘要 + 版本变更记录）

P7 gate（主 Agent 亲自验证）：
  1. make lint exit 0        ← 主 Agent 自己跑
  2. pytest -q exit 0        ← 主 Agent 自己跑
  3. git diff 确认 version bump + CHANGELOG 更新 ← 主 Agent 自己看

（可选）如果任务需要发版：
  P7 完成后 → 人手动执行 make publish
  无需发版的任务 → P7 完成即 DONE
```

**关键区分**：
- `make pre-publish` 通过 → 「具备发布条件」（P7 gate）
- `make publish` 成功 → 「已发布」（人手动触发，不在 v3 自动流程内）

---

## 缺陷 3：主 Agent 放弃了独立验证职责（不是 prompt 模板的问题）

### 现象

T002 中主 Agent 收到 subagent 返回「14/14 passed」就判定 gate 通过，没有自己跑 pytest 确认。PyPI 显示 v0.1.52，但主 Agent 看到 `P7-release.md` 存在就标记 DONE。

### 根因

`dispatch-protocol.md` 的「subagent 返回校验」4 条都是存在性检查（文件在不在、Header 合不合法、内容空不空）。没有一条说「主 Agent 要独立验证 subagent 的声明是否真实」。

**核心原则缺失**：主 Agent 对 subagent 产出的态度应该是「信任但独立验证」。subagent 返回什么不重要——主 Agent 自己跑命令看到的结果才重要。

### 澄清：派发 prompt 模板不需要改

当前模板要求 subagent「只返回路径 + 一句话摘要」是**正确的**。不应该让 subagent 附加验证证据——subagent 写的任何验证声明都不可信。验证必须由主 Agent 独立完成。

### 修复方案

`dispatch-protocol.md` 的「subagent 返回校验」增加第 5 条：

```
5. 独立验证 subagent 的声明：
   主 Agent 必须亲自执行 gate 命令验证门槛，不能仅凭 subagent
   返回的摘要或产出文件中的声明判定通过。

   例：P5 subagent 说 "failed=0" → 主 Agent 跑 pytest -q
       确认 exit 0 且 failed 行确实为 0，才算通过。
```

**对主 Agent 的要求**：每个 gate check 至少要跑一条命令 + 检查 exit code。命令输出就是验证证据——由主 Agent 自己生成，不来自 subagent。

---

## 附加缺陷：P6 一致性检查深度不足

### 现象

PM 指出 P1 的 AC6（busy_timeout 重试策略）不合理——方案 A 下 Server 启动时独占锁，busy_timeout 不是问题。但 P6 一致性检查报告「5/5 一致」，没有发现这个不一致。

### 根因

P6 architect 的检查是「设计文档写了什么 vs 代码实现了什么」。但如果设计文档本身有残留（为已否决方案写的 AC），P6 不会标 BLOCKER。P6 应该做**双向检查**：

1. 设计文档要求 → 代码是否实现（当前有）
2. 代码实现的功能 → 设计文档是否对应（**当前缺失**）

### 修复方案

P6 角色定义增加一步：「对照代码变更，检查设计文档中是否有不再适用的要求（为已否决方案写的 AC、已废弃的约束）。如有则标 DEVATION。」

---

## 改进清单

| # | 改进项 | 影响文件 | 优先级 |
|---|--------|----------|--------|
| 1 | Gate 验证改为「主 Agent 亲自跑命令 + 检查 exit code」 | `dispatch-protocol.md` | 🔴 高 |
| 2 | P7 重定义为「发布准备」；gate = `make pre-publish` exit 0；真正 publish 为人手动触发 | `dispatch-protocol.md`, `state-machine.md` | 🔴 高 |
| 3 | 主 Agent 校验增加第 5 条「独立验证 subagent 声明」（跑命令，不只读文件） | `dispatch-protocol.md` | 🔴 高 |
| 4 | P7 阶段名从「发布」改为「发布准备」 | `README.md`, `state-machine.md`, 所有引用处 | 🟡 中 |
| 5 | P6 增加双向一致性检查（代码看设计 + 设计看代码） | `assets/execution-roles/architect.md` | 🟡 中 |
| 6 | T002 P7 补验证（跑 pre-publish 确认） | T002 任务 | 🟡 中 |

**不变项**：
- 派发 prompt 模板不需要改（「只返回路径+摘要」是正确的，subagent 不应做自我验证）
- 上下文隔离原则不变（主 Agent 仍只传路径不传内容）

---

## 是否创建 T003

以上 6 个改进项应作为一个任务跟踪，T003 候选名：`fix-workflow-v3-gate-verification`。

等待 PM 确认后创建。
