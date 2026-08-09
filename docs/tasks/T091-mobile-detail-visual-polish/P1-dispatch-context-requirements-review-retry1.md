---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: requirements-review
---

# 派发指引 — T091 P1 需求基线复核（第 2 轮评审）

## 上轮产出

- 上轮评审：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（status: needs-revision，4 处具体缺口）
- 本轮待评审文件：`docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（已修订）
- 修订派发指引：`docs/tasks/T091-mobile-detail-visual-polish/P1-dispatch-context-analyst-retry1.md`（可参考修订要求原文）

## 目标

只需复核上轮提出的 4 处缺口是否真正修复，已通过评审的 BDD（3/4/5/6/7/8/12/13）不需要重新展开评审，除非发现被意外改动。

## 逐项复核清单

1. **BDD-1 是否已正确改为纯 DOM 断言措辞**，不再被归类为视觉断言
2. **BDD-2 的 DOM 辅助阈值是否合理**：analyst 声称补充了 `offsetHeight ≥ 40px`，推算依据是"16px+16px padding=32px 固定值 + 12px 字号×1.5行高≈18px，理论50px取80%保守下限"——请核实这个推算逻辑本身是否站得住（32+18=50，取80%=40，这个"取80%"的保守系数是否有说明理由，还是随意打的折扣；另外要确认这个 40px 阈值相对原基线约 17px 是否有足够区分度，不能定得太保守以至于跟原始糟糕状态也能"压线通过"）
3. **BDD-10/11 的判定标准是否真的可操作化**：核实 When 子句是否显式加入了 vision-engine 声明，"不可用尺寸"和"滚动冲突/抖动"是否给出了具体执行步骤（滑动手势序列、截图时机、比对依据），而不是停留在换个说法但依然抽象的描述
4. **BDD-9 的 Given 是否真的包含全部 10 个 entry**（含 svg-standalone/mermaid-charts/plantuml-arch）
5. **视觉断言占比数字是否重新统计且经得起复核**：analyst 声称新占比为 8/13≈61.5%——请重新独立核算一遍这个分数的分子分母，确认统计口径与上轮评审给出的标准一致（正文显式声明 vision-engine 作为验证方法的才算视觉断言），不要直接采信 analyst 的自报数字

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（本轮待评审主文件）
2. `docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（上轮评审，4 处问题的具体证据和判断标准）

## 输出路径（硬约束）

覆写同一文件：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（不要新建文件名）。Header 新增 `revised` 字段标注本轮日期。

## 门槛（什么算完成）

- 5 项逐一给出复核结论
- 若全部修复成立且未发现新问题 → approved（需按角色定义给出完整 BDD 编号锚点覆盖）
- 若仍有问题 → needs-revision，说明具体点

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
