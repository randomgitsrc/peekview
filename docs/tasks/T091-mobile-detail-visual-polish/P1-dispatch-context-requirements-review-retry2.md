---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: requirements-review
---

# 派发指引 — T091 P1 需求基线复核（第 3 轮评审，P1 最后一次机会，MAX=3）

## ⚠️ 重要提醒

这是 P1 阶段 retry 上限内的最后一轮评审。若本轮仍判定 needs-revision/rejected，任务会触发 PAUSED 需要人工介入。请保持一贯的审查标准，只聚焦本轮唯一改动点（BDD-2 阈值），不要因为"是最后一轮"而放水，也不要因为想显得严格去挑无关紧要的新问题。

## 上轮产出

- 第 2 轮评审：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（status: needs-revision，唯一剩余问题：BDD-2 的 DOM 阈值理论公式站不住）
- 主 Agent 已亲自用 Playwright CDP 实测（`page.addStyleTag` 实时注入目标 CSS 到 `markdown-test` 页面），测得改动后 meta-tags-bar 真实高度为 **89px**
- 本轮待评审文件：`docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（BDD-2 已基于 89px 实测数据修订为 71px 阈值 = 89×0.8，其余 12 条 BDD 未改动）

## 复核清单（只需核这一处）

1. **BDD-2 新阈值 71px 的推导是否合理**：89px 是主 Agent 实测的真实数据（不是本轮才编造），71px = 89×0.8 打了 8 折留安全边际，且 71px 相对 17px 基线仍有约 4.2 倍差距，判断这个折扣系数和最终阈值是否经得起复核（不要求你重新用 CDP 复现 89px 这个数字本身，主 Agent 已实测确认，重点是"71px 这个阈值本身是否是从 89px 合理推导出来的，逻辑链是否成立"）
2. **是否明确锚定了具体测试 entry**：确认 BDD-2 是否明确写了"针对 markdown-test 这个 entry"，避免这个 71px 数字被误用到标签数量不同、高度天然不同的其他 entry 上
3. **其余 12 条 BDD 是否原样未动**：核对 BDD-1/3/4/5/6/7/8/9/10/11/12/13 与第 2 轮评审时的版本逐字一致，未被意外改动

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（本轮待评审主文件，重点看 BDD-2）
2. `docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（第 2 轮评审，理解问题背景）

## 输出路径（硬约束）

覆写同一文件：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`。Header `revised` 字段更新为本轮日期。

## 门槛（什么算完成）

- 逐一给出复核结论
- 若 BDD-2 阈值推导合理且其余 BDD 未被意外改动 → approved（需按角色定义给出完整 13 条 BDD 编号锚点覆盖）
- 若仍有问题 → needs-revision，但请确认这不是吹毛求疵

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
