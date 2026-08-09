---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: requirements-review
---

# 派发指引 — T091 P1 需求基线评审

## 目标

独立评审 `P1-requirements.md`（13 条 BDD，对应 P0-brief 已定型的 4 处修复方案 + 9 种 viewer 覆盖范围扩展）。本任务的方案本身已和用户逐条讨论定型，评审重点不是"方案对不对"，是"BDD 写得是否真的可验证、是否真的覆盖了视觉呼吸感这个核心诉求，而不是又退化成纯数值判定"。

## 上游关联

- P0-brief.md 已记录 4 处方案的完整讨论过程和确认数值
- T090-mobile-detail-ux-polish/P1-requirements.md 是前序任务的需求基线，可参考其 BDD 编号风格，但本任务编号独立从 BDD-1 开始
- **本任务存在的核心理由**：T090 的 BDD 全是数值判定（"缩减≥75%"这类），P6 从未真正截图验证过效果，导致上线后视觉观感差。本轮评审必须重点核实"是否真的避免了同样的失败模式"

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（待评审主文件）
2. `docs/tasks/T091-mobile-detail-visual-polish/P0-brief.md`（核对 BDD 是否准确转译了已定型方案，数值有没有抄错）
3. `frontend-v3/src/components/EntryMetaTagsBar.vue`
4. `frontend-v3/src/components/EntryDetailMobileBar.vue`
5. `DESIGN.md`（L270-278 滚动架构，核实 BDD-10/11 对 Image/Html 例外场景的描述是否准确）

## 重点检查项

1. **视觉断言占比是否真实达标**：analyst 自称"至少 60% 是可截图验证的视觉断言"，请逐条核实这个自评是否准确——哪些 BDD 是真正的"用 vision-engine 判断好不好看"，哪些其实还是披着"用 vision-engine"外壳、实质仍是可以用纯 DOM 数值代替的伪视觉断言（比如 BDD-6/BDD-8 的 44×44 触控热区判定，本质是数值断言，不需要 vision-engine，这类不应该被算进"视觉断言"的分子里）
2. **BDD-2 的"视觉呼吸感"判定标准是否可操作**：BDD-2 要求 vision-engine 做"存在明显改善"的二值判定，这类主观判定容易在 P6 阶段产生"verifier 自己觉得改善了就判 PASS"的假通过风险，评审需要判断这条 BDD 的 Then 子句是否给出了足够具体的判定锚点（比如是否要求 vision-engine 输出具体的留白像素估算、而不是纯主观印象），如果不够具体，需要打回补充
3. **BDD-10/11（Image/Html 滚动架构例外）的技术描述是否准确**：核实 `ImageViewer.vue`/`HtmlViewer.vue` 的 `height:100%; overflow:hidden` 与 `EntryMetaTagsBar` 同级挂载在 `.content-area` 内这个 DOM 关系描述是否与源码一致，"meta-tags-bar 占用额外高度是否会压缩 viewer 可用区域"这个技术判断是否合理（这是 P0-brief 提出但未给出实现方案的开放技术问题，P1 只需要把这个不确定性转成可验证的 BDD，不需要在 P1 阶段就给出确定结论）
4. **P0-brief 讨论的方案数值是否被准确转译**：抽查几个关键数值（meta-bar padding 16px/16px、markdown-body padding 16px、bottom-bar padding 4px/4px、44px 触控热区）是否与 P0-brief 原文一致，有没有转译时抄错数字
5. **两条 [SUGGEST] 是否合理**：核实两条 SUGGEST（DESIGN.md 补充图标按钮判断准则、补充 content-area 例外说明）是否真的零风险、不涉及业务方向判断，可以被主 Agent 直接采纳

## 门槛（什么算完成）

- 产出 P1-review.md，Header `status:` 字段准确反映结论
- 每条 BDD 逐条判定 + 覆盖维度标注（数据/前端/多端/边界/兼容）
- 5 项重点检查逐一给出核实结论，引用具体 BDD 编号
- 隐含需求覆盖、裁剪评审按角色定义标准格式给出
- 结论明确：approved 需要完整锚点覆盖，不接受裸 "approved"

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
