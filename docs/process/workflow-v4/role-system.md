# 双层角色体系

> workflow-v4，解决"角色库只有评审角色、没有执行角色、不支持自定义"的问题

---

## 为什么分两层

v2 引用的 gstack 角色库全是**评审角色**（reviewer）——它们的职责是审查已有产出。但 P1-P8 流程里大部分阶段需要的是**执行者**（写问题定义、写设计、写代码），不是审查者。

v3 把角色分成两层：

```
执行角色（execution-roles）   ← 各阶段干活的，subagent 执行用
评审角色（review-roles）       ← 审查执行产出的，从 gstack 提取
```

加上**自定义角色模板**，让用户能按任务定义专门角色。

---

## 第一层：执行角色（assets/execution-roles/）

负责各阶段的实际产出。每个对应 P1-P8 的某些阶段：

| 角色 | 文件 | 负责阶段 | 职责 |
|------|------|----------|------|
| 需求分析师 | analyst.md | P1 | 需求质疑、建立 BDD 基线 |
| 方案设计师 | architect.md | P2、P7 | 写设计方案、一致性检查 |
| 测试设计师 | test-designer.md | P3 | 写测试用例和测试代码（TDD 红灯）|
| 实现工程师 | implementer.md | P4、P8 | 写代码、多包发布准备 |
| 验证工程师 | verifier.md | P5、P6 | P5 技术验证、P6 BDD 验收 |
| 视觉结构分析师 | vision-analyst.md | P6（按需）| UI 截图翻译成结构化 YAML，供 P6 验收和 design-review 使用 |

这些是 v3 新增的，gstack 里没有。

## 第二层：评审角色（assets/review-roles/）

从 gstack 提取，负责审查执行角色的产出。在关键阶段插入：

| 角色 | 文件 | 插入阶段 | 审什么 |
|------|------|----------|--------|
| 偏执 Staff Engineer | review.md | P4 后 | 生产级 bug |
| 创始人/CEO | plan-ceo-review.md | P2 | 方向对不对 |
| 工程经理 | plan-eng-review.md | P2 | 架构对不对 |
| 高级设计师+前端 | design-review.md | P4 后（前端）| UI 问题 |
| 设计评审（计划阶段）| plan-design-review.md | P2（前端）| spec 交互完整性 |
| QA 工程师 | qa.md | P5 | 功能跑通、找 bug |
| 调试专家 | investigate.md | 任意（出 bug 时）| 根因 |
| YC 合伙人 | office-hours.md | P1 前 | 产品方向 |
| 安全官 | cso.md | P4 后（涉敏感）| 安全审计 |

### 评审角色机械映射（C8 — 不靠主 Agent 临场判断）

P1 在 requirements.md 声明 `domains:`，主 Agent **机械映射**评审角色，不靠"我觉得需要谁"：

| domain | 自动触发的评审角色 |
|--------|-------------------|
| backend | review（P4 后）|
| frontend | design-review（P4 后）+ plan-design-review（P2）|
| mcp | review + 关注 MCP 接口契约（T005 教训：MCP 改动需专项评审）|
| security | cso（P4 后）|
| 业务方向不明 | office-hours / plan-ceo-review（P1 前 / P2）|

T005 漏 MCP 评审的根因：靠主 Agent 临场判断，它没有 MCP 评审意识。机械映射消除这个盲区。

---

## 角色如何被使用

### 执行角色：派发 subagent 时注入

主 Agent 派发 subagent 时，在 prompt 里指定角色定义文件：

```
你是 P2 阶段的 architect 子 Agent。
角色定义：读取 docs/process/workflow-v4/assets/execution-roles/architect.md
并严格遵循其中的认知模式、输入输出规范、质量门槛。
```

subagent 读取角色文件，按角色定义的方式工作。

### 评审角色：在阶段门槛处插入

某些阶段产出后，主 Agent 派发一个评审 subagent：

```
你是 plan-eng-review 评审角色。
角色定义：读取 docs/process/workflow-v4/assets/review-roles/plan-eng-review.md
评审对象：docs/tasks/T002/P2-design.md
产出：docs/tasks/T002/P2-review.md，Header 里 status 字段填 approved/rejected
```

评审产出的 `status` 字段就是门槛判定的依据。

### 门槛评审必须统一产出 status 字段

任何作为**阶段门槛**的评审角色，产出文件 Header 必须含统一的 `status` 字段，否则主 Agent 无法判定门槛。

评审角色的"结论"统一映射到 status：

| 评审角色的结论 | 映射到 status |
|----------------|---------------|
| 确认 / 通过 / PASS / approved | `approved` |
| 转向 / 打回 / HOLD / 有 BLOCKER / rejected | `rejected` |
| 需补充 / needs revision | `needs-revision`（计入重试）|

例如 plan-ceo-review 的结论是"转向"，映射为 `status: rejected`；plan-eng-review 的"approved"直接就是 `status: approved`。无论用哪个评审角色做门槛，主 Agent 都只读 `status` 字段判定，不需要理解各角色的具体结论语义。

**非门槛评审**（如纯参考的 office-hours 方向建议）不强制 status，但也不参与门槛判定。

---

## 第三层（机制）：自定义角色

用户可以为特定任务定义专门角色，不必都套用通用角色。

### 自定义角色模板

见 `assets/templates/custom-role.md`。核心字段：

```yaml
---
role_id: db-migration-specialist     # 唯一标识
type: execution | review              # 执行角色还是评审角色
phases: [P2, P4]                      # 适用哪些阶段
---

## 认知模式
{这个角色怎么思考，关注什么，优先级是什么}

## 输入
{必须读取的文件}

## 输出
{必须产出的文件 + 格式 + Header 规范}

## 质量门槛
{什么算"完成"，可判定}

## 返回给主 Agent
{只返回什么，控制上下文}
```

### 自定义角色怎么用

1. 按模板写一个 `assets/execution-roles/{role_id}.md` 或 `review-roles/{role_id}.md`
2. 在 OpenCode/Claude Code 的 agent 目录放一份对应的 markdown（让平台能识别）
3. 派发时指定这个角色文件路径

### OpenCode 自定义角色的坑

⚠️ issue #29616：`opencode.jsonc` 里 `mode: "subagent"` 定义的自定义 agent 可能无法被 task 工具调起来。

**规避方法（二选一）：**
- **方法 A**：用 markdown 文件方式定义（放 OpenCode agent 目录，文件名即角色名），比 jsonc 可靠
- **方法 B（退路）**：用内置的 general subagent，把自定义角色定义文件的路径写进派发 prompt，让 general subagent 读取并遵循。角色行为靠 prompt 注入实现，不依赖平台的自定义 subagent 机制。

方法 B 是最稳的——它不依赖任何平台特性，只要平台能派发一个通用 subagent + 让它读文件就行。**推荐优先用方法 B**，因为它跨平台、不踩坑。

---

## 角色选择决策

主 Agent 按阶段自动选执行角色（固定映射，见 README 阶段总览）。评审角色的选择：

```
P2 方案设计后：
  - 涉及架构/技术方案 → plan-eng-review
  - 涉及产品方向/要不要做 → plan-ceo-review
  - 涉及前端 UI → 加 plan-design-review

P4 实现后：
  - 默认 → review（找 bug）
  - 涉及前端 → 加 design-review
  - 涉及认证/输入/敏感数据 → 加 cso

出现无法解释的 bug → investigate
```

主 Agent 根据任务内容判断需要哪些评审角色，可以串联多个。

### 专家组并行评审 + 组长汇总

P2 评审可同时派发多个评审角色（并行）：

```
主 Agent 同时派发 N 个评审（多个 task 调用）：
├── plan-eng-review   → P2-review-eng.md
├── plan-ceo-review   → P2-review-ceo.md
├── plan-design-review（前端任务时）→ P2-review-design.md
└── cso（涉安全时）   → P2-review-cso.md
```

所有评审返回后，派发组长汇总：
- 角色：review 角色 + 指定为「专家组组长」
- 输入：所有评审文件路径
- 任务：汇总、去重、归类（BLOCKER/建议/可忽略）、标注分歧
- 输出：P2-review.md（统一 status: approved/rejected）

**组长规则**：
- 组长不发表新意见，只汇总
- 任何专家标 BLOCKER → status: rejected
- 多位专家分歧 → 标「专家组分歧」交人工
- 全票无 BLOCKER → status: approved

P4 后评审同理（review + cso + design-review 并行）。

---

## 与 gstack 的关系

review-roles 下的 9 个角色提取自 gstack（Garry Tan 开源，MIT）。提取而非引用的原因：

1. **自包含**：workflow-v4 不依赖外部文档，所有资产在 assets/ 下
2. **可定制**：提取后可以按 PeekView 的需要调整角色定义
3. **稳定**：外部仓库可能变动，提取的副本不受影响

原始来源：https://github.com/garrytan/gstack（保留出处标注）

---

*角色定义文件在 assets/ 下，配合 dispatch-protocol.md 使用*
