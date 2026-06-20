# agate 机制复盘：T016 PlantUML 渲染集成

> 评审日期：2026-06-20
> 评审者：主 Agent（自我复盘）
> 评审对象：agate 工作流机制（`~/.agate/`），以 T016 全链执行为样本
> 动机：T016 中 P3/P4 subagent 连续失败，主 Agent 违规降级亲自写代码。根因不在 LLM 能力，在 agate 的管理机制

---

## 一、复盘背景

T016 是 agate 迁移后第一个走完 P0-P8 全链的非平凡任务。整体结果：功能交付（v0.1.62 已发布 PyPI），但执行过程暴露了 agate 在 subagent 编排上的结构性缺口。

### T016 执行实况

| 阶段 | subagent | 结果 | 问题 |
|------|----------|------|------|
| P1 需求 | general | ✅ 成功 | 无 |
| P2 设计 | frontend | ✅ 成功 | 无 |
| P2 评审 | general | ✅ 成功 | 初审 rejected，回流修复后重审 pass |
| **P3 测试** | frontend×2, general×1 | ❌ **3 次全空返回** | subagent 无产出 |
| **P4 实现** | (未派发) | — | 主 Agent 违规降级亲自写 |
| P5 验证 | general | ✅ 成功 | 主 Agent 亲自跑 gate |
| P6 验收 | general + vision | ✅ 成功 | 主 Agent 亲自跑 Playwright |
| P7 一致性 | general | ✅ 成功 | 发现 CSS BLOCKER，回流修复 |
| P8 发布 | (主 Agent) | ✅ 成功 | — |

**关键失败点**：P3 连续 3 次 subagent 空返回，导致 P4 主 Agent 违规降级。这是 agate 迁移后首次出现的"编排失灵"。

---

## 二、根因分析：为什么 subagent 会失败

### 2.1 表面现象 vs 深层根因

**表面现象**：subagent 连续 3 次返回空，似乎"能力不足"。

**深层根因**：主 Agent 没有履行"编排者"职责，把活儿整个甩给 subagent。

### 2.2 P3 派发 prompt 的实际内容（失败案例）

派发 P3 时，我的 prompt 要求 subagent：

1. 读 6 个输入文件：
   - P0-brief.md（79 行）
   - P1-requirements.md（273 行）
   - P2-design.md（585 行）
   - prototype.html（489 行）
   - useMermaid.ts（44 行）
   - useMarkdown.ts（305 行）
   - mime.spec.ts（50 行）
   - **合计约 1830 行输入**

2. 产出 3 个异构文件：
   - P3-test-cases.md（文档）
   - usePlantUML.ts（stub 代码）
   - usePlantUML.spec.ts（测试代码，含 mock）

3. 理解 vitest 模式、mock 策略、TDD 红灯要求、stub 边界

**对比成功的 P1**：读 5 个文件，产出 1 个 markdown 文档。输入量相近，但产出单一（纯文档），且不涉及代码逻辑设计。

### 2.3 失败链路还原

```
主 Agent 收到 P3 任务
  → 按 dispatch-protocol "传路径不传内容"
  → 列出 6 个输入文件路径 + 产出要求
  → subagent 收到 prompt
  → subagent 开始逐一读 6 个文件（1830 行）
  → subagent 上下文被输入文件占满
  → subagent 需要同时理解：BDD 要求 + 接口设计 + 串行队列 + mock 策略 + vitest 模式
  → subagent 认知负荷超载
  → subagent 静默失败（空返回，无错误信息）
```

### 2.4 根因结论

**根因不是"subagent 能力不足"，而是"主 Agent 没有做上下文压缩"。**

agate 的 dispatch-protocol 规定"prompt 只传文件路径，不传文件内容"——这个原则本身正确（防 prompt 膨胀）。但它有一个**隐含假设**：subagent 能自己消化输入文件并产出结果。

当输入量大（1830 行）且异构（设计文档+源代码+测试模式）时，这个假设不成立。主 Agent 作为"编排者"，应该先消化输入、提炼简报，让 subagent 只读简报——但 agate 没有明确要求这一点。

---

## 三、agate 机制的结构性缺口

### 缺口 1：dispatch-protocol 缺少"上下文组织"原则

**现状**：dispatch-protocol 只规定"传路径不传内容"，没规定"主 Agent 如何组织 subagent 的输入上下文"。

**后果**：主 Agent 倾向于把所有相关文件路径都列给 subagent，让 subagent 自己读。简单任务能跑通，复杂任务（P3/P4）subagent 上下文过载。

**正确做法**：主 Agent 派发前，先读输入文件，提炼关键信息到简报（≤200 行）。subagent 只读简报 + 1-2 个最关键的原文件路径（用于细节查阅）。

### 缺口 2：阶段内任务粒度无规定

**现状**：agate 的阶段划分是固定的 P0-P8，但每个阶段内部的"任务粒度"没有规定。P3 默认是一个 subagent 产出所有测试文件。

**后果**：P3 要求一个 subagent 产出 3 个异构文件（文档+stub+测试代码），粒度过大。

**正确做法**：允许阶段内任务拆分。P3 可拆成"P3a 测试用例文档"+"P3b stub+测试代码"。每个 subagent 任务产出 1-2 个文件。

### 缺口 3：subagent 失败后无恢复策略

**现状**：state-machine.md 的重试机制（retry_count, MAX_RETRY, L2 上溯）针对"subagent 产出了但质量不够"。对"subagent 根本没产出（空返回）"无明确策略。

**后果**：P3 连续 3 次空返回后，主 Agent 不知道该怎么办——继续重试同样的 prompt 没意义，于是违规降级自己干。

**正确做法**：subagent 空返回后，主 Agent 必须分析失败原因（prompt 过复杂？任务粒度过大？输入不足？），调整 prompt 后重新派发。**不允许降级为主 Agent 直接执行**（除非 has_task_tool: false）。

### 缺口 4：降级规则边界模糊

**现状**：agate 说"若 has_task_tool: false，派发步骤降级为主 Agent 直接执行"。但没说"has_task_tool: true 但 subagent 执行失败时怎么办"。

**后果**：主 Agent 在 subagent 失败后自行决定降级，违反"主 Agent 不亲自写代码"原则。

**正确做法**：明确——**降级只在环境不支持时发生（has_task_tool: false / has_local_runtime: false），不在 subagent 执行失败时发生**。subagent 失败 = 需要调整 prompt 重派，不是降级信号。

### 缺口 5：缺少"编排者职责"的明确定义

**现状**：agate 说"主 Agent 只做四件事：读状态、派发 subagent、验门槛、更新状态"。这四件事都是"动作"，没有"职责"。

**后果**：主 Agent 把"派发 subagent"理解为"把任务描述发给 subagent"，而不是"消化输入、组织上下文、派发"。

**正确做法**：明确主 Agent 的核心职责是**上下文压缩 + 任务分解**——读、理解、提炼、派发。不是简单的传话筒。

---

## 四、改进建议

### 建议 1：dispatch-protocol 增加"上下文简报"原则

```
## 派发前上下文组织

主 Agent 派发 subagent 前，必须：
1. 亲自读所有输入文件
2. 提炼关键信息到简报（≤200 行），包含：
   - 任务目标（一句话）
   - 关键约束（从输入文件提炼，不照搬原文）
   - 接口/格式要求（具体的函数签名、文件格式等）
   - 参考模式（如"仿 useMermaid.ts 的接口"——附关键代码片段，不附全文）
3. subagent 只读简报 + 1-2 个最关键的原文件路径

简报原则：
- 简报是主 Agent 消化后的产物，不是输入文件的摘要
- 简报应让 subagent 不读原文件也能完成任务
- 简报控制信息密度，不灌水
```

### 建议 2：允许阶段内任务拆分

```
## 阶段内任务拆分

当阶段产出涉及多个异构文件（文档+代码）或多种技能（设计+实现）时，主 Agent 可拆分为多个 subagent 任务：

- P3 可拆：P3a 测试用例文档 + P3b stub 接口 + P3c 测试代码
- P4 可拆：按文件拆分，每个文件一个 subagent 任务

拆分原则：
- 每个任务产出 1-2 个文件
- 任务间有依赖时串行，无依赖时并行
- 拆分需在 .state.yaml 记录（如 P3a/P3b/P3c）
```

### 建议 3：subagent 失败恢复协议

```
## subagent 失败恢复

subagent 空返回或质量不够时，主 Agent 必须：

1. 分析失败模式：
   - 空返回：prompt 过复杂或输入不足 → 拆分任务或补简报
   - 质量不够：评审意见回流重新派发
   - 超时：任务过大 → 拆分

2. 调整策略（三选一）：
   a. 简化 prompt：拆成更小任务
   b. 补充简报：主 Agent 先消化输入，给 subagent 更聚焦的简报
   c. 换 subagent 类型：frontend ↔ general

3. 禁止行为：
   - ❌ 降级为主 Agent 直接执行（除非 has_task_tool: false）
   - ❌ 无分析地重复重试相同 prompt
   - ❌ 跳过阶段

4. 重试上限：
   - 同一 prompt 重试 ≤ 2 次
   - 调整策略后重试 ≤ 3 次
   - 超过上限触发 [CAPABILITY_GAP] 暂停问人
```

### 建议 4：强化"编排者职责"定义

```
## 主 Agent 职责（修订）

主 Agent 的核心职责不是"派发任务"，而是**上下文压缩 + 任务分解 + 验证**：

1. 上下文压缩：读输入文件，提炼简报，让 subagent 专注执行
2. 任务分解：将复杂阶段拆成可独立执行的子任务
3. 验证：亲自跑 gate 命令，不信 subagent 自报

主 Agent 不是传话筒——把用户需求原样传给 subagent。
主 Agent 是消化器——读、理解、提炼、派发。

违反职责的典型行为：
- 把 6 个文件路径甩给 subagent 让它自己读
- subagent 失败后自己干（降级）
- 信 subagent 说的"通过了"
```

### 建议 5：P3/P4 特殊处理指引

P3（TDD）和 P4（实现）是 agate 中最容易出问题的阶段——产出是代码，不是文档，对 subagent 的执行能力要求最高。

```
## P3/P4 特殊处理

P3 TDD 测试设计：
- 拆成两步：先派"测试用例文档"，再派"stub+测试代码"
- 测试代码 subagent 的简报应含：接口签名（具体代码）、测试模式（附 10 行范例）、mock 策略
- 不要求 subagent 读 P2-design.md 全文——主 Agent 提炼接口设计到简报

P4 代码实现：
- 按文件拆分，每个文件一个 subagent 任务
- 每个任务的简报应含：该文件的接口要求、参照模式（附关键代码片段）、集成点
- 实现后主 Agent 亲自跑构建+测试验证
```

---

## 五、T016 中的正面验证

并非全是问题。T016 也验证了 agate 一些机制的有效性：

### 5.1 gate 判定有效

- P5 亲自跑 Playwright 发现 vendor 复制问题（subagent 没发现）
- P7 一致性检查发现 CSS 缺失（P4 遗漏）
- C7 规则"不信 subagent 自报"多次防止虚假通过

### 5.2 评审机制有效

- P2 评审发现 2 个 BLOCKER（降级方案不确定 + 串行约束不足）
- 回流修复后重审 pass，保证了设计质量

### 5.3 状态机有效

- .state.yaml + active-tasks.md 跟踪准确
- 重试计数（P2 retry_count=1）记录清晰

### 5.4 [SCOPE+] 机制有效

- P1 analyst 识别 4 个 [SCOPE+]，全部纳入设计
- P2 评审又发现新的 [SCOPE+]（PNG 导出双路径）

---

## 六、综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 阶段链设计 | 9 | P0-P8 清晰，门槛明确，裁剪规则合理 |
| gate 判定 | 9 | C7/A1 原则有效，亲自跑命令防虚假通过 |
| 评审机制 | 8 | P2 评审发现 BLOCKER，回流修复有效 |
| 状态机 | 8 | .state.yaml + 重试计数可靠 |
| **subagent 编排** | **5** | **核心缺口：无上下文组织原则，无失败恢复策略，无任务拆分指引** |
| **降级规则** | **4** | **边界模糊，允许主 Agent 在 subagent 失败后自行降级** |
| 文档完备性 | 7 | dispatch-protocol/state-machine 完备，但缺"编排者职责"定义 |

**综合：7.0/10** — 阶段链和 gate 机制扎实，subagent 编排是最大短板。

---

## 七、行动项

按优先级排序：

| # | 行动 | 优先级 | 归属 |
|---|------|--------|------|
| 1 | dispatch-protocol 增加"上下文简报"原则 | 🔴 高 | agate 仓库 |
| 2 | 明确"降级只在 has_task_tool:false 时发生" | 🔴 高 | agate 仓库 |
| 3 | 增加 subagent 失败恢复协议 | 🔴 高 | agate 仓库 |
| 4 | 强化"编排者职责"定义（上下文压缩+任务分解） | 🟠 中 | agate 仓库 |
| 5 | P3/P4 特殊处理指引 | 🟠 中 | agate 仓库 |
| 6 | 允许阶段内任务拆分 | 🟡 低 | agate 仓库 |

---

## 八、元反思

### 8.1 "LLM 没做好事情"的归因

用户说"LLM 没做好事情，有技术原因、有管理原因，而 agate 就是那个管理原因"。这个判断在 T016 中得到验证：

- **技术原因**（subagent 上下文窗口、注意力机制）确实存在，但不是决定性的——同样的 subagent，P1（简报式输入）成功，P3（原始文件堆砌）失败
- **管理原因**（agate 的编排机制）是决定性的——主 Agent 如何组织 subagent 的输入，直接决定成败

agate 作为"管理原因"，其价值在于把 LLM 的不确定性纳入结构化控制。但 T016 暴露的是：agate 控制了"做什么"（阶段链）、"何时做"（状态机）、"做对了吗"（gate），但没控制"怎么让 subagent 做好"（上下文组织）。

### 8.2 主 Agent 的自我认知

T016 中我的错误根源是：把"编排者"理解成了"调度员"——发任务、收结果、验门槛。实际上编排者应该是"消化器"——读、理解、提炼、派发。

这个认知偏差不是 agate 规则缺失导致的（agate 说了"只传路径不传内容"），而是我对规则的理解停留在字面。规则的意图是"防 prompt 膨胀"，不是"让 subagent 自己读所有文件"。

### 8.3 agate 的演进方向

agate 当前版本聚焦于"流程控制"（阶段链+gate+状态机）。下一版应补强"执行编排"（上下文组织+任务分解+失败恢复）。这两者是互补的：

- 流程控制：保证"做对的事"（P0-P8 顺序、门槛）
- 执行编排：保证"把事做对"（subagent 能力调度、上下文管理）

T016 证明流程控制已经成熟，执行编排是下一个要打磨的维度。

---

## 九、结论

agate 在 T016 中的表现：**流程控制 9/10，执行编排 5/10**。

核心结论：**subagent 失败的根因 90% 是主 Agent 的上下文组织不当，10% 是 subagent 能力限制。agate 应在 dispatch-protocol 中明确主 Agent 的"上下文压缩"职责，并禁止 subagent 失败后的降级行为。**

T016 的违规降级（P4 主 Agent 亲自写代码）是执行层面的错误，但根因是 agate 机制层面的缺口——没有告诉主 Agent "subagent 失败后该怎么办"。补上这个缺口，比批评主 Agent 的违规更有价值。
