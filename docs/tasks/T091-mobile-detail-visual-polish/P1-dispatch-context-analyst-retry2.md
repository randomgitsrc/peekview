---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: analyst
---

# 派发指引 — T091 P1 需求基线修订（第 2 轮，P1 最后一次 retry，MAX=3）

## 上轮产出

- 上轮 P1-requirements.md：`docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（不要重写，增量修订）
- 本轮评审：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（status: needs-revision，第 2 轮复核，4/5 项已确认修复成立，只剩 BDD-2 的 DOM 阈值一处问题）

## ⚠️ 重要提醒

这是 P1 阶段的第 3 轮修订，P1 的 retry 上限是 3。本轮修订后的评审若仍不通过，任务会被标记 PAUSED 需要人工介入。请只处理下面这一处，不要动其他已经两轮评审都确认通过的内容。

## 问题根因（主 Agent 已亲自用 CDP 诊断，不需要你重新调研，直接采用下面的实测数据）

你上轮给 BDD-2 补的 `offsetHeight ≥ 40px` 阈值，是按"padding 32px + 单行文字行高18px"的理论公式反推出来的。reviewer 独立核算发现：把这个公式反推回"改之前"的状态，预测基线应该在 ~34px，但 P0-brief 记录的实测基线是 17px，对不上，公式本身站不住。

主 Agent 亲自用 Playwright CDP 做了两件事，不是继续猜，是直接测：

1. **诊断"改之前"17px 高度的真实构成**：meta-tags-bar 是 `display:flex; align-items:center` 的单行容器，内部子元素里最高的不是 `.status-tag`（17px），是标签 pill `.base-tag`（**26px**）——你上轮的公式完全没考虑到 `.base-tag` 这个子元素，方向从一开始就错了。17px 这个"改之前"的高度之所以比子元素还矮，本身就是当前 bug（`overflow-x:auto` 单行挤压）导致的视觉畸变，不是一个可以套公式反推的正常状态，不需要纠结怎么从 17px 反推出改之后的数字。

2. **直接实测"改之后"的真实高度**：用 `page.addStyleTag` 把 T091 要改的目标 CSS（`padding:16px 16px; overflow-x:visible; flex-wrap:wrap`）实时注入到 `markdown-test` 这个 entry 的移动端页面上，重新测量容器高度，**实测结果是 89px**（不是你算的 ~40px）。差这么多的原因：这个 entry 的标签数量较多，改完之后自然换行（`flex-wrap:wrap`）会换成多行，多行高度自然远超单行理论值。

## 这对 BDD-2 阈值意味着什么

高度是**内容相关的**（标签越多，换行越多，越高），不是一个能套用在所有 entry 上的固定单一数字。请按以下方式修订 BDD-2：

1. **明确 BDD-2 使用的具体测试 entry**（建议就用 `markdown-test`，与 89px 这个实测锚点对应，不要换成别的 entry 又要重新测）
2. **阈值改为基于这次实测的 89px 定一个有安全边际的下限**（不要求你精确复刻 89px，给一个略低于实测值、但显著高于 17px 基线的下限即可，比如"不低于 89px 的 80%（约 71px）"这类留有装修误差空间的写法，逻辑类似 BDD-8 缩减比例的做法——但**必须写清楚这个数字是基于实测 89px 反推的，不是拍脑袋**）
3. 如果你判断"固定像素阈值"这个思路本身不适合（因为不同 entry 标签数不同，高度会不一样），也可以改成相对判定："容器高度显著超过原基线约 17px（如 ≥ 3 倍，即 ≥51px）"这种相对判定，只要给出理由、且这个理由和上面的实测数据不矛盾即可，两种写法你选一种能自圆其说的

## 不要做的事

- 不要重新调研"改之前"的根因，已经诊断清楚了（`.base-tag` 26px 是关键，不是 `.status-tag`）
- 不要凭空再编一个新公式，必须锚定在 89px 这个实测数字上（可以打折扣、可以换算成相对倍数，但不能脱离这个数字重新臆造）
- 不要动 BDD-1/3/4/5/6/7/8/9/10/11/12/13，这些已经在前两轮评审确认通过

## 门槛（什么算完成）

- BDD-2 的 DOM 阈值改为基于 89px 实测数据推导（可以是绝对值打折，也可以是相对倍数），写明数据来源
- 阈值本身经得起"如果 89px 是真实测量值，这个阈值是否合理"的复核
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
