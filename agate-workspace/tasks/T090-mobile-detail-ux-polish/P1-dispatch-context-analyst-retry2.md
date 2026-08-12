---
phase: P1
task_id: T090-mobile-detail-ux-polish
role: analyst
---

# 派发指引 — T090 P1 需求基线修订（第 2 轮修复，P1 最后一次 retry，MAX=3）

## 上轮产出

- 上轮 P1-requirements.md：`docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（不要重写，增量修订）
- 本轮评审：`docs/tasks/T090-mobile-detail-ux-polish/P1-review.md`（status: needs-revision，第 2 轮复核，3/5 缺口已修复成立，剩 2 处）

## ⚠️ 重要提醒

这是 P1 阶段的第 3 轮修订，P1 的 retry 上限是 3。本轮修订后的评审若仍不通过，任务会被标记 PAUSED 需要人工介入。请务必彻底解决下述 2 处问题，不要再引入新的自相矛盾。

## 修复目标（评审提出的 2 处具体缺口）

### 1. BDD-8 数值公式与自带示例矛盾

BDD-8 当前文字："左右两侧间距之和相对当前基线（约 40px）缩减 ≥ 75%（即降至约 10px 或更小）。10px 为参考值...P2 若最终选定的数值满足该比例（如 11px、12px）即视为通过"。

问题：按 (40-11)/40=72.5%、(40-12)/40=70% 计算，11px 和 12px 都不满足"≥75%"，公式和自带示例互相矛盾。评审给出两个修复方向，二选一：

- **方向 A（推荐）**：删除"如 11px、12px 即视为通过"这句具体示例，只保留"相对基线缩减 ≥75%（约 10px 或更小）"的比例公式本身，不再举出会与公式矛盾的具体数字例子。P2 设计阶段自行计算是否达标即可，不需要 P1 阶段给出可能站不住的示例。
- **方向 B**：如果确实希望给设计留出到 11-12px 的余量，则把比例阈值放宽到 ≥70%（覆盖 12px 的 70%），并同步修正 section 1 需求复述里"缩减到当前的 1/4 甚至更小"这句话（1/4=75%缩减，与放宽后的 70%阈值不一致，需要一并调整表述，避免 section 1 目标描述、BDD-8 公式、示例数值三处互相矛盾）。

请选一个方向执行，不要同时保留公式和会打脸公式的示例数字。

### 2. iOS 虚拟键盘 safe-area 边界风险收口理由站不住

当前理由是"与本任务引入的 `position: fixed` 定位机制无直接耦合关系"——评审指出这与文档自身 [CORRECTION] 段落矛盾：[CORRECTION] 明确说本任务要把 `EntryDetailMobileBar.vue` 从 flex 尾部伪固定改造成真正的 `position: fixed` + `env(safe-area-inset-bottom)`，而 iOS Safari 上"虚拟键盘弹出时 fixed 元素与 safe-area/visualViewport 联动异常"恰恰是只有在引入 `position: fixed` 之后才会暴露的已知平台坑点（改动前的 flex 排列不存在这个问题类别）。所以"无耦合"的说法站不住。

请按评审建议二选一处理：

- **方向 A（推荐）**：改口承认这个风险确实是本任务的 `position: fixed` 方案可能引入的，但受限于当前 CDP/Playwright 自动化环境无法真实复现 iOS 原生键盘弹出交互（这是环境能力限制，不是"无关"），因此在 `capability_requirements` 里补充一条 `status: supplementable` 或 `GAP` 声明（说明可能的补充方式，如真机人工验证；若确实无补充路径就标 GAP），P6 验收阶段不强制覆盖这一项但标注为已知限制/后续人工验证跟踪项，写入 known-risks 或类似说明，而不是声称"不属于本次改动引入的新风险"。
- **方向 B**：如果核实后判断这个风险确实可控（比如给出具体技术依据说明 `position: fixed; bottom: 0` + `env(safe-area-inset-bottom)` 这种标准实现在键盘弹出场景下不会有额外风险，与不用 `env()` 的裸 fixed 不同），并给出可信的技术依据（不是简单断言"无耦合"），也可以保留不新增验证，但必须给出经得起复核的理由，不能是上一轮那种笼统断言。

## 不要做的事

- 不要动 BDD-1/2/3/4/5/6/7/9/10/11/12 中已确认修复成立的部分（评审已明确 3/5 缺口 + 3/4 边界项 + BDD-2/6/7/11 均成立，保持原样）
- 不要引入新的数值/逻辑矛盾——修订后请自己重新算一遍涉及的数字（如放宽阈值后要检查 section 1 描述是否还一致）

## 门槛（什么算完成）

- BDD-8 的公式与示例（如果保留示例）必须互相自洽，可用 bash 算一遍验证
- iOS safe-area 项的理由必须能经得起"这与 [CORRECTION] 段落矛盾吗"的复核，不能是笼统断言
- 其余部分保持不变

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
