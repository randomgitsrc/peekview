# Workflow v3 文档体系评审

> 评审日期：2026-06-11
> 评审对象：`docs/process/workflow-v3/` 全体（README + 5 机制文档 + 14 资产文件 + 3 模板）
> 评审团：技术评审 + 标准化评审 + 需求评审
> 前置评审：无（新体系首次评审）

---

## 评审结论

workflow-v3 是对 v2「主 Agent 不派发子 Agent」问题的精准打击：**派发协议**把模糊的「写入上下文」翻译成了明确的 task 工具调用，**状态机落盘**让中断恢复不再依赖 LLM 记忆，**双层角色体系**补齐了执行角色的空白。上下文隔离（只传路径不传内容）是解决上下文爆炸的正确方案。

**核心阻塞项仅 1 个**：评审角色的地位映射未统一（`role-system.md` 的「结论→status 映射表」在 9 个 review-roles 中没有一个实际落地的 `status` 字段声明），会导致主 Agent 无法稳定判定 P2 门槛。另有 3 个建议项。整体架构设计优良，修完阻塞项即可投入使用。

---

## 一、技术评审

### 发现 1（🔴 高危）：评审角色缺少统一的 `status` 字段映射落地

**位置**：`role-system.md:82-95` vs `assets/review-roles/*.md`

**现象**：`role-system.md` 定义了评审角色结论→status 的映射规则：

| 评审结论 | 映射到 status |
|----------|---------------|
| 确认/通过/PASS/approved | `approved` |
| 转向/打回/HOLD/BLOCKER/rejected | `rejected` |
| 需补充/needs revision | `needs-revision` |

但是 9 个 `review-roles/*.md` 中：
- `review.md` — 输出格式未提及 `status` 字段，只说「PASS / 发现 N 个 CRITICAL」
- `plan-eng-review.md` / `plan-ceo-review.md` / `cso.md` / `qa.md` / `design-review.md` 等——它们的输出格式未定义 Header 中的 `status` 字段

**机理分析**：P2→P3 的门槛判定依赖「P2-review.md 的 Header `status: approved`」。但主 Agent 读到的评审文件 Header 中如果没有 `status` 字段（因为评审角色没有要求它），门槛判定就无法执行——主 Agent 不知道该评审结论映射到哪个 status。

**影响**：这是系统的核心判定链路断裂。如果 P2 评审产出文件 header 缺 `status: approved`，主 Agent 要么永远卡在 P2，要么回退到模糊判断（这正是 v3 要消灭的问题）。

**整改建议**：在 9 个 review-roles 角色定义中，**每个**角色的「输出格式」或「返回给主 Agent」节都明确：

```markdown
## 输出
- docs/tasks/{Txxx}/P2-review.md（含 Header, **必须含 status 字段**）

## 返回给主 Agent
File: docs/tasks/{Txxx}/P2-review.md
Status: approved（映射：本角色的"PASS/通过"→approved，"HOLD/打回"→rejected）
```

至少给 `plan-eng-review.md`（P2 门槛最常用审查者）加这个要求。

**验证方式**：
- [ ] `grep -l "status" docs/process/workflow-v3/assets/review-roles/*.md` 至少匹配 3 个角色文件
- [ ] `plan-eng-review.md` 明确要求产出文件 Header `status: approved|rejected`

---

### 发现 2（🟡 中危）：P3→P4 门槛定义在不同文件中不一致

**位置**：`dispatch-protocol.md:150` vs `state-machine.md:64`

**dispatch-protocol.md**：
```
P3→P4 | 测试先失败（TDD） | 运行测试，确认 failed > 0（红灯）
```

**state-machine.md**：
```
P3 --[测试代码存在 AND 已确认失败（TDD 红灯）]--> P4

P3 红灯的特别说明：TDD 要求测试先失败，但"失败"有两种——
(1) 正确的红灯：测试逻辑对，因实现未写而断言不满足；
(2) 错误的红灯：测试本身有语法/import/collection 错误，根本跑不起来。
门槛只接受第一种（assertion failure）。
如果是 collection error / import error，说明测试本身写错了，门槛不通过。
```

**机理分析**：dispatch-protocol 的 `failed > 0` 过于粗糙——如果测试文件有 import error，pytest 的 `failed` 也是 > 0，但这不是 TDD 期望的「红灯」。state-machine 的精确定义更正确，但两处说法不一致。

**整改建议**：将 dispatch-protocol 的 P3→P4 门槛改为：
```
P3→P4 | TDD 红灯（真 failure，非 error） | 运行测试，无 collection/import error，
       所有 failure 均为 assertion failure（共 N 个，对应 P1 的 N 个问题）
```

**验证方式**：
- [ ] `grep -A2 "P3→P4" docs/process/workflow-v3/dispatch-protocol.md` 与 state-machine.md 一致

---

### 发现 3（🟡 中危）：执行角色定义过于精简，缺乏有效的方法论指导

**位置**：`assets/execution-roles/{analyst,architect,test-designer,implementer,verifier}.md`

**现象**：5 个执行角色文件平均 35 行。以 `analyst.md`（32 行）为例：

- 认知模式：3 条（「先问真正要解决的问题」「区分问题和方案」「每个问题要可验证」）
- 输入/输出/质量门槛：各 2-3 条
- 返回：1 行

**对比**：评审角色 `review.md`（47 行）包含 3 个 pass 的具体检查清单、输出格式模板、处理规则。而执行角色是「该做什么」的骨架，缺少「怎么做对」的方法论。

**影响**：subagent 拿到执行角色后，如果方法论不足，产出质量方差会很大——两次派发可能产出完全不同风格的 P1-problems.md。

**建议**：以 `analyst.md` 为例，补充：
- 问题拆分方法论（5 Whys、fishbone 方向）
- 验收标准的写法要求（Given-When-Then 或 可量化指标）
- 反例（什么不是好的问题定义，举 1-2 个例子）

不需要太长，但要有「照着做就能产出正确结果」的指导力。

**验证方式**：
- [ ] `analyst.md` 的行数 > 50（至少扩充到有 2-3 个具体例子）

---

## 二、标准化评审

### 发现 4（🟡 中危）：三个工作流版本共存，优先级关系不清晰

**位置**：
- `docs/process/workflow.md`（v1, P0-P4, 388 行）
- `docs/process/workflow-v2.md`（v2, P1-P7, 570 行）
- `docs/process/workflow-v3/`（v3, 新体系）

**现象**：
- workflow-v2.md 顶部已标注「v3 已发布，新任务用 v3」，自身保留
- workflow.md（v1）顶部无任何退役/取代声明
- v1 使用 `docs/process/checkpoints/P0-{task-id}/` 目录，v2/v3 使用 `docs/tasks/Txxx/`
- v1 的阶段编号（P0-P4）与 v2/v3（P1-P7）含义不同

**影响**：新贡献者可能读到 workflow.md 的 P0-P4 定义，与实际使用的 P1-P7 混淆。T002 任务已按 v2/v3 的 P1-P7 进行。

**整改建议**：
1. `workflow.md` 顶部加退役标注：「⚠️ 退役：v3 已发布（`docs/process/workflow-v3/`），本文件保留仅供历史参考」
2. `workflow-v2.md` 移到 `docs/process/archived/`（v2 已被 v3 取代）

---

### 发现 5（🟢 低危）：`git-integration.md` 的 commit message 格式是新约定，未反映在现有 CHANGELOG/hooks 中

**位置**：`git-integration.md:41`

**现象**：
```
commit message 格式：wf({task_id}-{phase}): {一句话进度}
```
现有 commit 使用 `feat(T002-P3):` / `docs(review):` / `fix(T002-P3):` 等 Conventional Commits 格式。

**分析**：`wf()` 前缀是 v3 内部约定，与项目现有的 `feat:`/`fix:`/`docs:` 前缀不冲突——前者用于任务进度提交，后者用于其他变更。但两套格式并存可能令人困惑。

**建议**：在 git-integration.md 中加一句说明「与项目现有的 Conventional Commits 并行使用，不影响其他类型提交」。

---

### 标准化通过项

| 检查项 | 结论 |
|--------|------|
| 所有 17 个资产文件（5+9+3）存在且与 README 目录清单一致 | ✅ 通过 |
| 各角色文件含 frontmatter（role_id/type/phases/source） | ✅ 通过 |
| dispatch-prompt.md 模板结构清晰，占位符明确 | ✅ 通过 |
| task-files.md 列出了 11 个阶段产出的 Header 规范 | ✅ 通过 |
| README 的平台适配章节覆盖 OpenCode/Claude Code/Codex | ✅ 通过 |
| state-machine.md 状态转移规则用伪代码清晰表达 | ✅ 通过 |
| loop-orchestration.md 四道护栏设计完整 | ✅ 通过 |

---

## 三、需求/设计评审

### 设计亮点（无发现，纯肯定）

**1. 问题诊断精确**

v3 的出发点是对 v2 使用中暴露的两个具体问题的诊断：
- 「主 Agent 不派发子 Agent」— 根因是 v2 的指令不可执行
- 「角色库只有评审角色」— 根因是缺乏执行角色

不是泛泛的「做得更好」，而是针对具体失败模式的设计。

**2. 上下文隔离机制优雅**

「prompt 只传路径」「subagent 只返回路径+摘要」「主 Agent 永不读产出全文」——三条铁律串起来，上下文增量是常数级。

**3. 三档自动化推进**

不追求一步到位的全自动，而是手动→半自动→全自动渐进。匹配实际使用场景——先证明每个部件可靠，再串成自动循环。

**4. 状态机抗中断**

「状态在文件里不在记忆里」是 LLM 工作流的核心问题，v3 的方案（文件 Header 状态 + active-tasks.md + git commit 持久化）形成了一个完整闭环。

**5. 自定义角色模板**

不假设预定义的 14 个角色够用，提供模板让任务能定义专门角色，且优先推荐不依赖平台机制的「方法 B」（general subagent + prompt 注入）。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 问题诊断 | 10/10 | 精确打击 v2 两个具体失败模式 |
| 架构设计 | 9/10 | 派发协议+状态机+角色+git 四层闭环，P3 门槛定义需统一 |
| 标准化 | 7/10 | 文件齐全，但 3 个工作流版本并存、commit 格式未协调 |
| 可执行性 | 7/10 | 派发 prompt 模板可直接使用，但角色定义过于精简、status 字段未落地 |
| 整体 | **8.2/10** | |

---

## 待办

### 阻塞项
- [ ] **发现 1**：9 个 review-roles 角色文件中至少 `plan-eng-review.md` 明确要求产出 Header `status: approved|rejected`

### 建议项
- [ ] **发现 2**：`dispatch-protocol.md` P3→P4 门槛定义与 `state-machine.md` 统一（区分 assertion failure vs collection error）
- [ ] **发现 3**：扩充执行角色定义（尤其 `analyst.md` 和 `architect.md`），加入方法论和反例
- [ ] **发现 4**：`workflow.md`（v1）加退役标注；`workflow-v2.md` 归档
