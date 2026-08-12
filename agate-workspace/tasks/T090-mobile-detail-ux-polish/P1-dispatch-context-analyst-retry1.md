---
phase: P1
task_id: T090-mobile-detail-ux-polish
role: analyst
---

# 派发指引 — T090 P1 需求基线修订（第 1 轮修复）

## 上轮产出

- 上轮 P1-requirements.md：`docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（不要重写，增量修订）
- 上轮 dispatch-context：`docs/tasks/T090-mobile-detail-ux-polish/P1-dispatch-context-analyst.md`（约束仍然有效，本文件只补充修订点，不重复目标/BDD 覆盖要求等已说明过的内容）
- 评审意见：`docs/tasks/T090-mobile-detail-ux-polish/P1-review.md`（status: needs-revision）

## 修复目标（评审提出的 5 处具体缺口，逐条修订）

1. **BDD-2 补范围收窄声明**：在 BDD-2 附近（或紧邻的说明文字）补充"其余 viewer（Table/Tree/Image/HTML/PlantUML/Mermaid）与 markdown/code 共用同一个 `EntryDetailHeader.vue`/`meta-tags-bar`，滚动跳变逻辑与 viewer 类型无关，故不逐个建 BDD"这一范围收窄理由，把它从"只存在于 P0-brief、需要评审人回查上游文件佐证"变成"P1-requirements 文本自身就说清楚了"。

2. **BDD-6 修正 Given 场景 + 补 wrap 覆盖**：当前 Given 用"多文件 markdown entry"，但经评审核实 `frontend-v3/src/composables/useEntryDetailComputed.ts`（或 `entryDetail.ts`，请自行核实实际文件路径）里 `canWrap` 的计算逻辑是 `language === 'markdown'` 时 `canWrap = false`，wrap 按钮在 markdown entry 下根本不渲染，导致 BDD-6 结构性无法验证 wrap 按钮。请改为：①把 Given 换成一个非 markdown 且 `canWrap` 为 true 的 entry 类型（自行核实哪种 viewer/language 会让 canWrap 为 true），或 ②拆成两条 BDD（一条覆盖 markdown 下的 file-tree/toc/source-toggle/copy/overflow，一条专门覆盖 wrap 按钮用适配的 Given）。Then 子句里補上 wrap 按钮。

3. **BDD-7 数值表述降级**：当前"≤10px"是精确硬锁数值，但用户原话是"缩减到 1/4 甚至更小，你看看怎么合适"——这是委托设计判断的语气，不是精确指令。P1 阶段不应锁死具体像素值（这属于 P2 设计判断范畴）。请把 BDD-7 的 Then 子句改为以"相对当前基线（约 40px）缩减比例"为准的相对表述（如"左右总留白相对当前基线缩减 ≥70%"），并删除或明确降级"≤10px"这个具体数字为示例参考值而非验收硬线，避免 P2 设计因可读性/触控热区等因素选择了 11px、12px 这类同样合理但不满足"≤10px"的值时被迫走 baseline-change 流程。

4. **BDD-9 消除表述歧义**：当前 Then 子句同时写"与改动前一致"（暗示相等判定）和"不低于...--space-5=24px 基线"（暗示下限判定），两种标准并存造成歧义。请二选一并明确声明：要么"桌面端 markdown-body 的 padding token 保持为 --space-5（24px）不变"（相等判定，推荐，因为本任务范围只针对移动端，桌面端不应有任何改动），要么如果确实有理由允许桌面端也可能变化则说明为什么，但不能两种标准同时出现。

5. **补齐 4 项边界风险的收口**：section 2 已识别的 4 项边界风险（①极小屏 ≤375px 边距缩减后可读性 ②空 tags/无 owner 时 meta 区占位 ③横屏移动设备跨 640px 阈值进入 desktop 分支的过渡态 ④iOS 虚拟键盘弹出时 safe-area-inset 计算）目前只有文字识别、没有落地到可验收产物。请对每一项做以下二选一处理：
   - 补一条对应 BDD（如果判断值得在本任务验收范围内验证）
   - 或显式声明"本次范围内不新增验证，理由 X"（如果判断风险低/超出本任务合理范围，比如"iOS 虚拟键盘弹出场景与本任务的 fixed 定位机制无直接耦合，safe-area-inset 在键盘弹出时的行为是 iOS Safari 已知平台特性，不在本次改动引入的新风险范围内，不新增 BDD"）
   不允许保持"识别了但既不验证也不声明不验证"的中间态——这正是上轮评审指出的问题。

## 不要做的事

- 不要重写整份 P1-requirements.md，只在必要处增量修订（BDD-2/6/7/9 的文字、边界风险收口的新增内容）
- 不要改动其余已通过评审的部分（BDD-1/3/4/5/8/10、[CORRECTION]、[BASELINE_CHANGE]、裁剪声明、domains/packages、capability_requirements 的 available 两项保持不变）
- 修订后 BDD 编号如有新增（如 BDD-6 拆分），后续编号需相应调整并保持连续不跳号，同时相应更新 section 6 涉及文件清单（如涉及 useEntryDetailComputed.ts / entryDetail.ts）

## 门槛（什么算完成）

- 5 处修复点逐一体现在修订后的 P1-requirements.md 中，可被下一轮评审逐条核对
- status 保持 draft（评审后才由 review 角色改 approved）
- 其余未涉及部分保持不变（可用 diff 思路自检）

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
