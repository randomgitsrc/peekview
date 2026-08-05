# P1 dispatch-context: requirements-review

## 目标

独立视角审查 P1-requirements.md，发现 analyst 的作者盲点（遗漏的隐含需求、不可判定的 BDD、混入的解决方案设计）。产出 P1-review.md，含 BDD 编号锚点 + 覆盖维度标注。

## 约束

- 只审不写——不直接改 P1-requirements.md，产出评审意见
- 评审结论必须引用具体 BDD 编号（gate 检查锚点存在性）
- Header status 字段：approved / rejected / needs-revision
- 本任务经主 Agent + 用户确认了 6 个 NEED_CONFIRM（已转为 [CONFIRMED]），评审时关注这些决策是否合理、是否引入新风险（尤其审计字段纳入 → schema 变更 + 迁移）
- 严禁触碰生产环境

## 上游关联

- P1-requirements.md（待评审）：19 条 BDD + 6 个 CONFIRMED 决策 + domains/packages/risk_level/phases 声明
- P0-brief.md：任务简报 + 环境约束
- 6 个已确认决策（见 P1-requirements.md §4）：
  1. 审计字段 Phase 1 纳入（disabled_at/disabled_by/disabled_reason）
  2. LastAdmin 保护补齐 demote/disable/delete 三者
  3. 非 admin 访问 /admin 跳 /explore
  4. list_users 改为 {items,total,page,per_page}
  5. reset_password 强制 ≥8 字符
  6. 前端操作入口用 OverflowMenu

## 输入文件

1. `docs/tasks/T080-admin-user-management/P1-requirements.md` — 待评审的需求基线
2. `docs/tasks/T080-admin-user-management/P0-brief.md` — 任务简报（核对需求是否对齐 P0）
3. `/home/kity/.agate/assets/review-roles/requirements-review.md` — 评审角色定义
4. `backend/peekview/models.py` — User 模型现状（核对审计字段影响）
5. `backend/peekview/auth.py` — require_admin / LastAdmin 现状（核对 BDD-09/10/11 可行性）
6. `backend/peekview/api/auth.py` — delete_self 的 LastAdminError（第 240-249 行，核对一致性）
7. `DESIGN.md` — §6 组件规则（核对前端 BDD 是否对齐）

## 客观查证信息

- BDD 共 19 条，编号 BDD-01 至 BDD-19，格式 `#### BDD-NN:`
- domains: backend/frontend/cli/security
- risk_level: medium-high
- phases: P0-P8 全走不裁剪
- capability_requirements: 3 项全 available，无 GAP
- 6 个 CONFIRMED 决策已回写到 §4 + §2 内联标记，无残留 [NEED_CONFIRM]
- 审计字段纳入意味着：models.py 加字段 + database.py migration + admin_service 记录审计 + 前端可展示

## 特别关注

- BDD 可二值判定性：每条 Given/When/Then 是否能明确 PASS/FAIL，有无中间态
- 隐含需求覆盖：数据/前端/多端/边界/兼容五维度是否遗漏
  - 数据：审计字段 migration 对已有数据的影响（disabled_at 默认 null？）
  - 前端：OverflowMenu 移动端 bottom sheet、禁用状态 Badge 展示、操作确认弹窗
  - 多端：API {items,total} 结构 vs CLI 不走 API、promote/demote API 新端点 vs CLI 现有命令
  - 边界：并发操作、最后一个 admin 的判定时机、禁用用户的内容是否仍可见（BDD-03 已覆盖 public entries）
  - 兼容：list_users 返回结构变更是否破坏其他消费方（Explore 已确认 CLI 不走 API）
- P1 纯净性：有无掺入解决方案设计（如"用 migration 加字段"是 P1 范围声明还是 P2 设计？边界在哪）
- 裁剪合理性：P0-P8 全走，risk=medium-high，是否匹配（审计字段 + 多端 + 权限模型，medium-high 合理）
- LastAdmin 保护决策：补齐 delete_user 是否会改变现有 delete_user 语义（之前能删最后一个 admin，之后不能）——这是 bug 修复，评审确认 BDD 覆盖

## 产出路径

`docs/tasks/T080-admin-user-management/P1-review.md`

## 产出要求

- Header: phase=P1, task_id=T080-admin-user-management, trace_id=T080, type=review, parent=P1-requirements.md, status=draft, agent=requirements-review
- BDD 评审节：逐条 BDD-NN 判定 + 覆盖维度标注（数据/前端/多端/边界/兼容）
- 隐含需求覆盖节：五维度逐项
- 裁剪评审节（本任务无裁剪，确认全走合理）
- 门槛结论：status 改为 approved / rejected / needs-revision
- approved 必须含每条 BDD 编号引用 + 覆盖维度清单

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
<!-- AGATE_CARD_END -->