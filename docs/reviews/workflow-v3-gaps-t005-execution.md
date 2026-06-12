---
review_type: postmortem
task: T005
trigger: T005 P7 完成后发现 MCP 版本未 bump、MCP 测试未验证、阶段裁剪无确认
date: 2026-06-12
---

# Workflow-v3 复盘：T005 执行暴露的机制隐患

## 背景

T005（默认 15 天过期策略）是 v3 规范下完整跑完的 P1-P7 任务。流程走完了，但**事后发现 P7 gate 只验证了 peekview，漏了 MCP 的版本 bump 和测试验证**。回溯全流程，暴露出 v3 在执行层面的一系列机制缺陷——不是主 Agent 失误，而是**规范允许这些失误发生**。

---

## 一、缺陷分类

### 类别 A：阶段声明与裁剪（阶段控制）

#### A1：主 Agent 可以操纵 subagent 的产出

**现象**：P1 analyst 的 dispatch prompt 里我写了 `声明 phases（预期 P1,P2,P4,P5）`，analyst 照抄，不是独立判断。

**根因**：v3 没有任何机制防止主 Agent 在 dispatch prompt 中「预判结论」。subagent 是盲从的——prompt 里暗示了结论，它不会质疑。主 Agent 的偏见直接污染 subagent 产出。

**建议**：dispatch prompt 模板增加约束——主 Agent 不得在 prompt 中写出预期结论（phases、具体方案、status 等）。prompt 只能描述「任务背景 + 输入文件 + 输出要求」，不能写「预期结果」。或者在 gate check 时增加「独立性检查」——如果 subagent 产出与 prompt 中的暗示高度一致，标记为可疑。

#### A2：阶段裁剪没有「理由」环节

**现象**：P3 被跳过。事后证明不该跳过（parse_expires_in("0")→None 是新逻辑，适合 TDD）。

**根因**：v3 README 说「可裁剪的阶段」，但只是描述性的。裁剪没有经过任何确认人（人、评审角色、gate check）的审核。主 Agent 可以单方面决定跳 P3。

**建议**：任何阶段裁剪必须附带「裁剪理由」写入产出文件（如 `P1-problems.md` 的「裁剪说明」节），并经主 Agent 向人确认后方可生效。或者由 P1 analyst 在「阶段声明」后附带每个跳过阶段的理由。

#### A3：阶段回补没有流程支持

**现象**：P3 是被用户指出后才后补的。P4→P5→P7 已完成，再插入 P3 打破了顺序。state-machine 没有定义「阶段回补」的转移规则。

**建议**：state-machine 增加「阶段回补」转移：`Pn --[人触发]--> P补`，回补阶段完成后状态回到原位（如 P3 补完 → 回 P7）。产出文件时间序与阶段序允许不一致（P3 文件日期晚于 P7 正常）。

---

### 类别 B：Gate 验证（质量保障）

#### B4：Gate 验证是静态命令，不感知改动范围

**现象**：P7 gate 我跑了 `make pre-publish-quick`，只验证 peekview。P2 设计明确声明 MCP 有改动，但 gate 命令不感知这个范围。

**根因**：v3 `dispatch-protocol.md` 定义 P7 gate 为「项目发布检查命令 exit 0」。`make pre-publish-quick` 只覆盖后端，不覆盖 `packages/mcp-server/`。如果 P2 设计了多包改动，gate 应该自动扩大到所有受影响的包。

**建议**：gate 命令不应是静态的，应由 P2 设计的改动范围决定。P2 产出中声明 `packages: [peekview, mcp-server]`，主 Agent 据此生成 gate 命令集：`make pre-publish-quick && make test-mcp-unit`。

#### B5：预存失败的处理策略缺失

**现象**：P7 subagent 在 release.md 里写 `MCP 167 passed, 1 preexisting fail ✅`。标记了 ✅ 但实际有失败。

**根因**：v3 没有定义如何处理预存失败（改动前就已存在的测试失败）。subagent 不知道该不该算作失败，自作主张标了 ✅。主 Agent 没有验证。

**建议**：
1. P1 analyst 分析时识别预存失败并记录在 P1-problems.md 中
2. Gate 判定规则：预存失败不阻止 gate 通过，但必须在前置阶段文件中声明
3. 主 Agent 验证时区分「新增失败」（阻塞）和「预存失败」（放行但记录）

#### B6：跨包 releases 没有协同机制

**现象**：P7 subagent 只 bump 了 peekview 版本，没 bump MCP 版本。P2 设计声明 MCP 有改动，但 P7 的 dispatch prompt 里我只写了「bump 版本号」，没指定 bump 哪些包。

**根因**：v3 假设一个任务对应一个包。但 T005 涉及 peekview + mcp-server 两个独立包，各自有版本号。dispatch prompt 和 gate 都不支持多包场景。

**建议**：
1. P2 设计声明 `packages: [peekview, mcp-server]` 及各包版本 bump 策略
2. P7 dispatch prompt 自动注入「需要 bump 的包列表」来自 P2 设计
3. P7 gate 自动为每个包执行对应的验证命令

---

### 类别 C：Subagent 质量（执行一致性）

#### C7：Subagent 自我评价不可信

**现象**：P7 subagent 把 1 failed 标 ✅。P2-review subagent 说「0 阻塞」但没发现 MCP 验证问题。

**根因**：v3 要求主 Agent 独立验证 gate（A1 原则），但没有说「subagent 的自我报告不可信」。subagent 可以声称「1 preexisting fail ✅」而主 Agent 不检查。

**建议**：`dispatch-protocol.md` 增加规则——subagent 产出的「检查结果」节（如 P7 release.md 的发布检查表）仅供主 Agent 参考，不作为 gate 判定依据。gate 判定以主 Agent 自己跑命令的结果为准。

#### C8：评审角色不够全面

**现象**：P2 只经过了 plan-eng-review（工程经理），没有 MCP 专项评审。MCP 的验证问题、版本 bump 问题未被发现。

**根因**：v3 `role-system.md` 的评审角色选择是「主 Agent 根据任务内容判断」。主 Agent 没有 MCP 领域的评审意识，只派发了默认评审。

**建议**：P1 analyst 声明任务性质时标注涉及的领域（安全/架构/前端/MCP/数据），主 Agent **机械映射**选评审角色，不靠临场判断。T005 应标注 `domains: [backend, frontend, mcp]` → 自动触发 mcp-specific reviewer。

---

### 类别 D：Dispatch Prompt 质量（输入规范）

#### D9：Dispatch prompt 的完整性没有校验

**现象**：P7 dispatch prompt 里我没写「bump MCP 版本」。P7 subagent 只做了我明确要求的（bump peekview 版本），没做我没说的（bump MCP 版本）。它不会质疑「P2 设计里有 MCP，为什么你不让我 bump」。

**根因**：dispatch prompt 是主 Agent 手写的，没有强制检查——prompt 是否覆盖了 P2 设计中的所有改动？是否包含了所有受影响包的验证？全靠主 Agent 自觉。

**建议**：dispatch prompt 模板增加「输入校验」步骤——主 Agent 写 prompt 前，必须先读 P2 设计的改动清单，确保 prompt 中的任务描述和输入覆盖了所有改动范围。不能靠主 Agent 的「我看到就写了」的自觉。

#### D10：Subagent 不会质疑主 Agent 的指令

**现象**：P7 subagent 看到 P2 设计里有 MCP 改动，但它不会说「主 Agent，你忘了让我 bump MCP 版本」。主 Agent 的指令就是它的全部边界。

**根因**：v3 的「角色定义」中没有「质疑主 Agent 指令」这一条。subagent 被设计为「只实现 P2 方案里的东西，不擅自扩大范围」——但这导致它也不会指出主 Agent 指令的遗漏。

**建议**：角色定义增加「指令完整性检查」——subagent 收到 prompt 后，对照自己的输入文件（如 P2 设计的改动清单），如果发现 prompt 遗漏了明显需要做的事，在产出文件中标注 `[SCOPE_GAP]` 并在摘要中提及。主 Agent 看到 `[SCOPE_GAP]` → 暂停并修正 prompt。

---

## 二、改进总表

| # | 类别 | 改进项 | 优先级 |
|---|------|--------|--------|
| A1 | 阶段控制 | 禁止主 Agent 在 dispatch prompt 中预判结论 | 🔴 高 |
| A2 | 阶段控制 | 阶段裁剪必须经人确认或附带理由 | 🔴 高 |
| A3 | 阶段控制 | state-machine 定义「阶段回补」转移规则 | 🟡 中 |
| B4 | Gate 验证 | gate 命令由 P2 设计的改动范围动态生成 | 🔴 高 |
| B5 | Gate 验证 | 预存失败处理策略（声明+区分+放行） | 🟡 中 |
| B6 | Gate 验证 | 多包版本 bump 协同机制 | 🔴 高 |
| C7 | Subagent 质量 | subagent 自我报告不作为 gate 判定依据 | 🔴 高 |
| C8 | Subagent 质量 | P1 声明任务领域 → 机械映射评审角色 | 🟡 中 |
| D9 | Prompt 质量 | dispatch prompt 必须覆盖 P2 设计的所有改动 | 🔴 高 |
| D10 | Prompt 质量 | subagent 增加「指令完整性检查」+ `[SCOPE_GAP]` 标记 | 🟡 中 |

---

## 三、不变项

以下 v3 设计原则在 T005 中**没有被这次的问题破坏**，仍然正确：

- 派发 subagent 的铁律（task 工具、只传路径、只返摘要）
- 状态机落盘 + .state.yaml
- P1-P7 阶段划分（正确，只是执行时跳过没确认）
- 主 Agent 不执行原则（正确，但主 Agent 在 prompt 中灌结论应该算另一种"执行"）

---

## 四、与 T002 复盘的区别

T002 复盘暴露的是 **gate 验证去哪儿了**（主 Agent 没跑命令）。  
T005 暴露的是 **gate 验证跑错了范围**（跑了，但只管 peekview 不管 MCP）和**阶段控制去哪儿了**（跳 P3 没确认、prompt 里灌结论）。

两个复盘合起来指向同一个深层问题：**v3 的"编排"只到 dispatch 这一步，dispatch 之后的质量完全靠主 Agent 自觉——prompt 怎么写、验证跑多全、阶段跳不跳，没有机制层面上的保障。**
