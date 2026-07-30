---
phase: P1
generated_by: agate-inject-card.sh + 主 Agent
task_id: T082-arch-refactor
role: requirements-review
---

<dispatch_guide>
> 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
独立评审 T082 架构重构的 P1 需求基线（P1-requirements.md），产出 P1-review.md。这是纯重构任务的 BDD 验收条件审查——核心关注 BDD 可二值判定性、隐含需求覆盖完整性、裁剪合理性、P1 纯净性（无解决方案设计混入）。

### 约束
- 只审不写——不直接改 P1-requirements.md，产出评审意见 P1-review.md
- 评审结论必须引用具体 BDD 编号锚点，而非裸 "approved"
- agent 字段必须填 requirements-review（不能是 main）
- P1 评审不可裁——这是 gate 硬性要求
- 本任务是纯重构（不改行为，只改结构），BDD 的核心是"零回归"而非"新功能能用"——评审时按此基准判断 BDD 质量

### 上游关联
- analyst subagent 已产出 P1-requirements.md（31 条 BDD，BDD-1 到 BDD-31）
- analyst 的 progress 显示：11 个输入源文件已全部读取，3 处前端 .detail 依赖已确认（ExpiresInDialog/SecurityTab/ProfileTab），LoginDialog 的 e.detail 是 DOM CustomEvent 不受影响
- P1-requirements.md 声明：risk_level=high，无裁剪（P1-P8 全走），domains=backend+frontend，[NO_NEED_CONFIRM]
- capability_requirements: pytest/vitest/typecheck=available，playwright=supplementable（CDP Chrome :18800，降级 make debug-test）

### 输入文件
- docs/tasks/T082-arch-refactor/P1-requirements.md（评审对象——必读）
- docs/tasks/T082-arch-refactor/P0-brief.md（任务简报，判断需求是否覆盖 P0 的 6 项问题）
- AGENTS.md（项目约定，判断 BDD 是否符合项目架构约束）
</dispatch_guide>

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

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）

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
<!-- AGATE_CARD_END -->

<objective_info>
- P1-requirements.md BDD 统计：31 条（BDD-1 到 BDD-31），格式 `#### BDD-NN:`
- domains 声明：backend + frontend
- risk_level：high
- 裁剪：无（P1-P8 全走）
- [NEED_CONFIRM]：无（声明 [NO_NEED_CONFIRM]）
- capability_requirements status：pytest/vitest/typecheck=available，playwright=supplementable（无 GAP）
- 6 项重构问题 BDD 覆盖：BDD-1~5（DI 统一）、BDD-6~9（错误格式）、BDD-10~12（去重）、BDD-13~14（事务）、BDD-15（后端零回归）、BDD-16~19（store 拆分）、BDD-20~28（component 拆分）、BDD-29（前端错误兼容）、BDD-30~31（前端零回归）
</objective_info>
