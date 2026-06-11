# Workflow v3 自评审

> 评审框架：gstack review（/plan-eng-review + /review）
> 日期：2026-06-11
> 评审对象：docs/process/workflow-v3/（17 文件，1386 行）

---

## 评审结论

v3 的核心设计正确：把 v2 的描述性流程升级为可执行的派发协议 + 状态落盘 + 双层角色。解决了用户的两个真实问题（上下文爆炸、缺执行角色）。发现 3 个需要补强的设计缺口。

---

## 解决用户问题的验证

| 用户问题 | v3 的解法 | 是否真正解决 |
|----------|-----------|-------------|
| 主 Agent 不派发，自己走到底，上下文爆炸 | dispatch-protocol 三铁律：用 task 工具派发 / 只传路径 / 只返回摘要 | ✅ 核心机制对：上下文增量是常数级（几行摘要）|
| 角色库只有评审角色，不支持自定义 | 双层角色（execution + review）+ 自定义模板 + 方法 B prompt 注入 | ✅ 且方法 B 规避了 OpenCode 的坑 |

---

## 需要补强的缺口

### 缺口 1：subagent 失败/超时的处理未定义

dispatch-protocol 定义了"门槛失败重试"，但没定义"subagent 本身执行失败"（崩溃、超时、返回格式错误、根本没产出文件）。

**场景：** 派发 architect subagent，但它没产出 P2-design.md（出错了），或返回了一堆文件全文（没遵守"只返回摘要"）。主 Agent 怎么办？

**补充：** dispatch-protocol 需要加"subagent 返回校验"：
```
subagent 返回后，主 Agent 校验：
  1. 约定的产出文件是否真的存在？（不存在 → 派发失败，重试）
  2. 返回是否是"路径+摘要"格式？（不是 → 不读全文，只取路径，自己 grep 摘要）
  3. 产出文件是否有合法 Header？（没有 → 门槛不通过）
任一校验失败计入重试。
```

这是 /review 视角的"错误边界"问题——只设计了 happy path 和门槛失败，没设计 subagent 自身失败。

### 缺口 2：状态一致性检查的"以文件为准"可能误判

state-machine 说"看板和目录冲突时以文件为准"。但有个边界：subagent 产出了文件但**内容不完整**（写了一半崩了）。文件存在，但内容是垃圾。"以文件存在为准"会误判为该阶段完成。

**补充：** 门槛判定不能只看"文件是否存在"，要看"文件是否含合法 Header + 必需字段"。state-machine 的转移规则应该强化：
```
P1 --[P1-problems.md 存在 AND 含合法 Header AND 有至少一个问题定义]--> P2
```
即"存在且有效"，不只是"存在"。

### 缺口 3：评审角色的 status 字段由谁写、格式是否统一

门槛判定依赖 P2-review.md 的 `status: approved/rejected`。但评审角色文件（plan-eng-review.md 等）里，只有 plan-eng-review 明确说了产出 status 字段，其他评审角色（plan-ceo-review、cso）没有统一约定要写 status。

**问题：** 如果 P2 用 plan-ceo-review 评审，它返回的是"方向结论"，不是 status==approved/rejected。主 Agent 没法判定门槛。

**补充：** 所有用于门槛的评审角色，必须统一产出 `status` 字段。在 role-system.md 里明确：
```
任何作为阶段门槛的评审，产出文件 Header 必须含 status: approved|rejected|needs-revision
评审角色的"结论"映射到 status：
  - 确认/通过/PASS → approved
  - 转向/打回/HOLD/有 BLOCKER → rejected
  - 需补充 → needs-revision（计入重试）
```

---

## 设计优点

1. **三铁律抓住了本质**：上下文爆炸的根因是"传内容+返回全文"，三铁律精准针对
2. **状态落盘抗中断**：状态在文件不在记忆，会话压缩也能恢复——这是 LLM 工作流的正确做法
3. **方法 B（prompt 注入角色）跨平台**：不依赖平台自定义 subagent 机制，规避了 OpenCode issue #29616，最稳
4. **门槛可判定**：明确禁止"方案足够好"这类模糊门槛，用 status/failed 等可读取字段
5. **护栏完整**：重试上限 + 全局步数上限 + 检查点确认 + 一致性检查，四道防失控
6. **自包含**：gstack 角色提取到 assets/，不依赖外部仓库

---

## 实施前必做的验证（文档已提及，强调一次）

1. **最小验证 OpenCode 派发**：先定义一个测试角色，确认主 Agent 能用 task 工具派发并拿到"路径+摘要"返回。这是地基，不验证就上 /loop 会塌。
2. **先档位 A 再档位 C**：手动逐步跑通 → 半自动 → 全自动，不要跳级。

---

## 修正清单

| 优先级 | 缺口 | 修正 |
|--------|------|------|
| 🟠 | subagent 自身失败未处理 | dispatch-protocol 加"返回校验"（文件存在性+格式+Header）|
| 🟠 | 门槛判定只看文件存在 | state-machine 改为"存在且有效（含合法 Header）"|
| 🟠 | 评审 status 字段不统一 | role-system 统一所有门槛评审产出 status 字段 |

3 个都是 P1 级（影响自动化可靠性，但不影响整体架构），修正后可投入试用。

评分：架构设计 9/10，错误边界 7/10（缺 subagent 失败处理），完整性 8/10。综合 8/10。

---

*自评审完成：2026-06-11*
