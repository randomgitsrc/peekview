---
phase: P1
task_id: T087-code-linenumber-offbyone
role: requirements-review
dispatch_type: initial
---

# P1 dispatch-context — T087 requirements-review

## 目标

独立评审 `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`，产出 `P1-review.md`（status: approved / rejected / needs-revision）。只审不写，不直接改 P1-requirements.md。

## 评审角色

你是 requirements-review，独立视角审查 P1 需求基线。analyst 写需求时有作者盲区——遗漏的隐含需求、不可判定的 BDD 条件、混入的解决方案设计。你的价值是独立视角发现这些盲点。

## 评审重点（按角色检查清单）

**BDD 条件可二值判定：**
- 每条 BDD 的 Given/When/Then 是否可明确判定 PASS 或 FAIL
- 不允许中间态
- BDD 编号是否用 `#### BDD-NN:` 标准格式且连续不跳号
- 每条 BDD 是否只有一条 Given-When-Then

**隐含需求覆盖（逐维度）：**
- 数据 / 前端 / 多端 / 边界 / 兼容

**BDD 跨条一致性：**
- 同场景多条 BDD 的 Then 是否矛盾

**裁剪合理性：**
- 跳过阶段理由是否充分
- risk_level 是否匹配
- capability_requirements 三态判断

**P1 纯净性：**
- 有无掺入解决方案设计（P1 只定义问题，P2 才设计方案）
- 有无混入实现细节

## 本次评审的特殊上下文

P1 有一个关键发现需要你重点审查其合理性：

1. **修正 P0 描述**：P1 称"实测 Shiki `codeToHtml` 与 `code.split('\n')` 产生相同数量的行（都多一个尾部空行）"，因此当前 bug 是"两列对齐但都多空行"，而非 P0 说的"两列错位"。请审查这个实测结论是否可信、是否影响 BDD 的可判定性。

2. **[DESIGN_CONSTRAINT] 留给 P2**：P1 发现"trim 必须同时作用于 codeToHtml 和 renderLineNumbers 两个输入"，但 P1 只定义结果行为（三联对齐），不规定实现方式。请审查这是否构成"混入解决方案设计"——还是合理的需求约束。

3. **空文件 BDD-4 vs 边界声明**：§2 边界说"空文件 renderLineNumbers 纯函数产生 1 个行号"，但 BDD-4 说"空文件不渲染行号列也不渲染高亮列（CodeViewer 短路）"。请审查这两处是否矛盾——BDD 锚点是"CodeViewer 实际渲染路径"还是"renderLineNumbers 纯函数"。

4. **BDD-7 Markdown 路径**：Given 写"token.content 可能已被 trim 末尾换行"，Then 是"无论 markdown-it 是否 trim，两列必须对齐"。请审查这个 BDD 是否可二值判定（"可能 trim"是否导致 Given 不确定）。

## 实质锚点要求

review 结论必须引用具体产物锚点，而非裸 "approved"：
- approved → 每条 BDD 编号 + 覆盖维度清单（数据/前端/多端/边界/兼容逐项标注）
- 不引用 BDD 编号的裸 "approved" 极可能是假完成

## 输出

`docs/tasks/T087-code-linenumber-offbyone/P1-review.md`，Header 必须含 `status` 字段（approved / rejected / needs-revision）。

输出格式参考：
```
## BDD 评审
- BDD-1: <判定> + <覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓>
- BDD-2: ...

## 隐含需求覆盖
- 数据维度：<覆盖/遗漏>
- 前端维度：<覆盖/遗漏>
...

## 裁剪评审
- ...

## P1 纯净性
- ...

## 结论
status: approved / rejected / needs-revision
```

## 输入文件

- `docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`（评审对象）
- `docs/tasks/T087-code-linenumber-offbyone/P0-brief.md`（上游，对照 P0 描述与 P1 修正）
- `frontend-v3/src/composables/useShiki.ts`（验证 P1 实测结论是否可信——重点看 codeToHtml 调用 + renderLineNumbers）

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
