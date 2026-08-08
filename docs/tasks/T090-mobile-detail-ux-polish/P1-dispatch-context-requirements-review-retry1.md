---
phase: P1
task_id: T090-mobile-detail-ux-polish
role: requirements-review
---

# 派发指引 — T090 P1 需求基线复核（第 2 轮评审）

## 上轮产出

- 上轮评审：`docs/tasks/T090-mobile-detail-ux-polish/P1-review.md`（status: needs-revision，5 处具体缺口）
- 本轮待评审文件：`docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（已修订，文件开头有"本次为第 1 轮修订"摘要说明修改了哪些点）
- 修订派发指引：`docs/tasks/T090-mobile-detail-ux-polish/P1-dispatch-context-analyst-retry1.md`（可参考修订要求原文）

## 目标

只需复核上轮提出的 5 处缺口是否真正修复，不需要重新做一遍完整的首轮评审（BDD-1/3/4/5/8/10 已通过、[CORRECTION]/[BASELINE_CHANGE]/裁剪判断已核实合理，除非发现修订过程中破坏了这些已通过部分，否则不需重复论证）。

## 逐项复核清单

1. **BDD-2 范围收窄声明**：检查是否新增了"其余 viewer 共用同一 header，不逐个建 BDD"的显式声明（应在 BDD-2 后有"范围收窄声明"引用块）。
2. **BDD-6/BDD-7 拆分**：原 BDD-6 拆成了 BDD-6（markdown 场景，不含 wrap）+ BDD-7（非 markdown/html 场景，专测 wrap）。请重新读 `frontend-v3/src/stores/entryDetail.ts` 核实 canWrap 逻辑（analyst 声称路径是这个文件，L18-24），确认拆分后的 Given 场景确实能触达 wrap 按钮（`EntryDetailMobileBar.vue` 里 wrap 按钮的 `v-if` 条件），而不是又构造了一个同样测不到的场景。
3. **BDD-8（原 BDD-7）数值降级**：检查"≤10px"是否已从硬性验收线降级为参考值，判定标准是否改为"相对基线缩减 ≥75%"这类比例表述，且是否说明了 P2 后续选定其他满足比例的数值（如 11px/12px）不需要走 baseline-change。
4. **BDD-11（原 BDD-9）消歧**：检查是否已改为单一判定标准（"相等"或"不低于"二选一，而非两者并存）。
5. **4 项边界风险收口**：检查是否每项都有明确的"补 BDD"或"显式声明不验证+理由"处理，理由是否站得住（不是敷衍带过）。新增的 BDD-9（375px 极小屏）是否本身可二值判定。

## 额外核对

- BDD 编号是否连续不跳号（应为 BDD-1 至 BDD-12）
- 全文对 BDD 编号的交叉引用（如"BDD-1 markdown 场景"这类文字提及）是否已同步更新到新编号，没有残留旧编号引用
- 未涉及本轮修订的部分（BDD-1/3/4/5/10、[CORRECTION]、[BASELINE_CHANGE]、裁剪声明、domains/packages、capability_requirements）是否原样保留，没有被意外改动或破坏

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（本轮待评审主文件）
2. `docs/tasks/T090-mobile-detail-ux-polish/P1-review.md`（上轮评审，5 处缺口的具体证据）
3. `frontend-v3/src/stores/entryDetail.ts`（核实 canWrap 逻辑）
4. `frontend-v3/src/components/EntryDetailMobileBar.vue`（核实 wrap 按钮 v-if 条件）

## 输出路径（硬约束）

覆写同一文件：`docs/tasks/T090-mobile-detail-ux-polish/P1-review.md`（gate 脚本只认这个固定文件名，不要新建其他文件名）。覆写前请先完整读取旧内容作为参考，新内容整体替换旧内容（不是追加），Header 的 `created` 保持原值，可新增一行 `revised: 2026-08-09` 标注这是第 2 轮评审。

## 门槛（什么算完成）

- 覆写 P1-review.md，Header status 字段准确反映本轮结论
- 5 处缺口逐一给出复核结论（修复成立 / 仍不成立，给出具体理由）
- 若全部修复成立且未发现新问题 → approved
- 若仍有缺口或修订引入了新问题 → needs-revision，说明具体点（进入第 3 轮，注意 P1 retry 上限 MAX=3，本轮是第 2 次评审，如果这轮仍不过，第 3 轮修订后必须通过，否则触发 PAUSED）

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
