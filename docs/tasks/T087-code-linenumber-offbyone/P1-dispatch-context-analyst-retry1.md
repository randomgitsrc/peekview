---
phase: P1
task_id: T087-code-linenumber-offbyone
role: analyst
dispatch_type: retry-1
---

# P1 dispatch-context — T087 analyst retry#1

## 目标

按 P1-review.md 的修订清单修订 `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`，解决 2 项强制措辞修订 + 1 项建议。修订后 P1 可直接 approve，无需重新走完整评审。

## 修订清单（来自 P1-review.md §修订清单）

| # | 位置 | 问题 | 修订要求 |
|---|------|------|---------|
| 1 | §2 空文件边界声明 | 与 BDD-4 措辞冲突（纯函数层 vs 组件层混写） | 分层表述：组件层短路不渲染（见 BDD-4）；纯函数层 1 行号但组件层不触发 |
| 2 | §2 [DESIGN_CONSTRAINT] | 措辞有实现倾向（"trim 必须同时作用于"） | 改写为纯结果导向：两列行数一致且等于逻辑行数；实现手段由 P2 决定 |
| 3（建议非强制） | BDD-7 | "可能 trim"的二值判定路径不够显式 | 补注"验收取实际渲染结果比对，不依赖 markdown-it 是否 trim" |

## 具体修订指引

### 修订 1：§2 空文件边界声明

当前：
> 空文件（`""`）：CodeViewer 路径在 `!props.content` 时短路不渲染；`renderLineNumbers` 纯函数对 `""` 产生 1 个行号（与 Shiki 1 个 `.line` 对齐）。

改为（分层表述，参考 review 建议）：
> 空文件（`""`）：CodeViewer 组件层在 `!props.content` 时短路不渲染（见 BDD-4，行号列与高亮列均不渲染）。`renderLineNumbers` 纯函数层对 `""` 产生 1 个行号（与 Shiki 1 个 `.line` 对齐），但此路径在组件层不会被触发。

### 修订 2：§2 [DESIGN_CONSTRAINT]

当前：
> [DESIGN_CONSTRAINT]：末尾换行的 trim 必须**同时作用于** `codeToHtml` 的输入和 `renderLineNumbers` 的输入，才能保持两列对齐且行号数 = 逻辑行数。

改为（纯结果导向，参考 review 建议）：
> [DESIGN_CONSTRAINT] 修复后 `codeToHtml` 输出的 `.line` 数与 `renderLineNumbers` 输出的行号数必须一致且等于文件内容的逻辑行数（末尾 `\n` 不产生额外行）。实现手段（trim 输入 / 后处理 split 结果 / Shiki 选项 / 其他）由 P2 决定，P1 只定义结果行为。

### 修订 3（建议）：BDD-7 补注

在 BDD-7 的 Then 后补一句：
> 验收时取实际渲染结果比对两列数量，不依赖 markdown-it 是否 trim 末尾换行。

## 约束

- **只改措辞，不改 BDD 的 Given/When/Then 语义**（P1 基线保护）
- 修订后 P1-requirements.md 的 BDD 数量仍为 10 条，编号不变
- 不引入新的 [NEED_CONFIRM]
- 标 `[BASELINE_CHANGE: 措辞修订，不改语义，P1-review retry#1]` 在修订处（按 P1 基线保护规则，主 Agent 已批准此措辞修订）

## 输入文件

- `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`（修订对象）
- `docs/tasks/T087-code-linenumber-offbyone/P1-review.md`（修订清单来源）

## 输出

直接修改 `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`（在原文件上修订，不新建文件）。返回一句话摘要：修订了哪几处。

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. 更新 .state.yaml phase=P1 → P2
5. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
6. git commit -m "wf({Txxx}-P1): {摘要}"

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
<!-- AGATE_CARD_END -->
