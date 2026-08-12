---
phase: P1
task_id: T090-mobile-detail-ux-polish
role: requirements-review
---

# 派发指引 — T090 P1 需求基线评审

## 目标

独立评审 `P1-requirements.md`，检查 10 条 BDD 是否可二值判定、隐含需求覆盖是否完整、裁剪是否合理、有无掺入方案设计。

## 上游关联

- 待评审文件由 analyst 产出，声称：10 条 BDD、risk_level=medium、phases 全走不裁剪、1 个 [SUGGEST]（不阻塞）、[NO_NEED_CONFIRM]
- analyst 在需求复述阶段发现并修正了 P0-brief 的一个误判：`EntryDetailMobileBar.vue` 组件其实已存在（只是缺 `position: fixed` + safe-area），P0-brief 误以为完全不存在。请重点核实这个修正本身是否站得住（可读该组件源码验证），以及是否因此影响了 BDD-4/5/6 的设计合理性。
- 本任务与已 DONE 的 T084/T085 有历史耦合（`.content-area` 单一滚动容器架构、scroll-hide 机制），P1 声明要保留前者、推翻后者（DESIGN.md L219 `[BASELINE_CHANGE]`）——请检查这个区分（哪条规则被推翻、哪条被保留）在 BDD 里是否有对应验证点，不是只在文字里声明。

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（待评审主文件）
2. `docs/tasks/T090-mobile-detail-ux-polish/P0-brief.md`（对照检查 analyst 是否遗漏了 P0-brief 提出的风险点）
3. `DESIGN.md`（L219、L254-275，核实 [BASELINE_CHANGE] 与既有规则引用是否准确）
4. `frontend-v3/src/components/EntryDetailMobileBar.vue`（核实 analyst 的 [CORRECTION] 说法：是否真的缺 `position: fixed`）

## 重点检查项（除角色定义标准检查清单外，本任务特别关注）

1. **BDD-5（浏览器地址栏遮挡）的可判定性**：BDD-5 用"两种固定可视高度模拟地址栏展开/收起"代替真实动画复现，声明这不算 capability GAP。检查这个范围收窄是否合理、是否会导致验收时"过松"（即使真实场景仍有 bug 但两种固定高度测试碰巧都过）。
2. **BDD-7（边距量化标准 ≤10px）是否武断**：P0-brief 原话是"缩减到 1/4 甚至更小"，40px 的 1/4 是 10px，BDD-7 直接取了这个数。检查这个具体数值是否该在 P1 阶段就锁死，还是应该只声明"相对基线缩减 ≥75%"这类相对表述留给 P2 设计阶段定具体像素值（P1 不该掺入过细的实现级数值判断，边界在哪里请你判断）。
3. **跨 viewer 覆盖是否足够**：P0-brief 要求覆盖"markdown 视图，代码等其他视图都存在这个问题"，BDD-2 只覆盖了 code viewer 一种非 markdown viewer。检查这是否足够代表"跨 viewer"这个隐含需求，还是应该要求 P1 声明更多 viewer 类型（Table/Tree/Image/HTML）的覆盖策略（哪怕不是每个都单独 BDD，至少应有一条说明"其余 viewer 共用同一 header，无需逐个验证"这类范围收窄理由）。

## domains/packages 声明核对

`domains: [frontend]`，`packages: [frontend-v3]` ——核实是否遗漏后端域（三处改动理论上应确实无后端改动，但请确认 analyst 有没有漏查 MCP/CLI 侧）。

## 门槛（什么算完成）

- 产出 P1-review.md，Header `status:` 字段准确反映结论（approved / rejected / needs-revision）
- 每条 BDD 逐条判定 + 覆盖维度标注（数据/前端/多端/边界/兼容）
- 隐含需求覆盖逐维度评审
- 裁剪评审（本任务未裁剪任何阶段，说明"无裁剪"这一判断本身是否合理，而非跳过此节）
- 结论引用具体 BDD 编号锚点，不接受裸 "approved"

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
