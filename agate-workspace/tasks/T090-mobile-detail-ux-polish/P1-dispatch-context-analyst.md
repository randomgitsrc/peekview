---
phase: P1
task_id: T090-mobile-detail-ux-polish
role: analyst
---

# 派发指引 — T090 P1 需求基线

## 目标

为「移动端详情页 UX 打磨」建立需求基线，产出 BDD 验收条件。三个独立问题点必须分别有对应 BDD，不能合并成一条笼统条件。

## 上游关联

- 本任务是用户在 T089（Unicode 文件名链接修复）P1 派发前插播的新需求，与 T089 无代码关联，独立立项
- 与已 DONE 的 T084（detail-scroll-architecture）/ T085（render-regression-fix）有历史耦合：那两个任务定下了当前 `.content-area` 单一滚动容器架构（DESIGN.md:270-275）和 scroll-hide 机制（DESIGN.md:219）。本任务是在此基础上调整，**不是推翻**——P1 的隐含需求识别里必须包含"保留 `.content-area` 单一滚动容器"这条约束

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P0-brief.md`（**核心输入**，已含 orchestrator 只读排查的代码现状、具体文件/行号、DESIGN.md 冲突点、已知风险）
2. `DESIGN.md`（尤其 L219、L254-275 移动端断点规则、滚动架构决策）
3. `frontend-v3/src/composables/useResponsiveLayout.ts`（scroll-hide 机制实现）
4. `frontend-v3/src/components/EntryDetailHeader.vue`（meta-tags-bar + mobile-sticky-header 实现）
5. `frontend-v3/src/components/EntryDetailContent.vue`（content-area padding、滚动容器）
6. `frontend-v3/src/components/MarkdownViewer.vue`（markdown-body 间距）
7. `frontend-v3/src/components/OverflowMenuSheet.vue`（已有 `env(safe-area-inset-bottom)` 先例，L124-141，可作为 `follows_existing_pattern` 候选参考）

## 三个问题点（P0-brief 已定位根因，你的任务是转化为可验证 BDD，不是重新调研根因）

1. **meta-tags-bar 滚动跳变**：`max-height` 折叠导致内容区位移，要求嵌入内容流随滚动自然划走，不做独立显示/隐藏切换。影响面跨所有 viewer（Markdown/Code/Table/Tree/Image/HTML/PlantUML/Mermaid），因为 header 是详情页公共组件。BDD 至少覆盖 markdown + 1 种非 markdown viewer 各自的滚动行为。
2. **底部操作栏**：DESIGN.md:263 已声明"primary actions → fixed bottom bar on mobile"，但实际实现是顶部 `.mobile-sticky-header`。这是范围最不确定的一点——**你必须先核实**：用户描述的"有时显示有时不显示的底部操作栏"，指的是要新建一个真正独立于顶部 header 的底部固定操作栏（迁移现有 file-tree/toc/source-toggle/copy/share 按钮到底部），还是别的含义。如果核实后仍有多种合理理解且方向影响改动范围（新建组件 vs 调整现有组件位置），标 `[NEED_CONFIRM]`；如果你有明确倾向（P0-brief 倾向"迁移为底部固定栏 + safe-area 兼容，对齐 DESIGN.md:263 既有声明"），可标 `[SUGGEST]` 不阻塞。
3. **markdown 移动端边距**：当前三层叠加约 40px（content-area padding 8px + markdown-body margin 16px + padding 16px）。要求缩减到当前的 1/4 甚至更小。BDD 需要给出可验证的量化标准（如"移动端 viewport 下 markdown 正文左右总留白 ≤ 10px"），不能只写"边距更小"这种不可验证的表述。

## domains / packages 提示

预期 `domains: [frontend]`，`packages: [frontend-v3]`。若你发现涉及其他域（如后端无关，不太可能），如实声明。

## BDD 覆盖要求

- 三个问题点各自独立编号，不要合并
- 至少 1 条 BDD 覆盖跨 viewer 影响面（如 code viewer 的 meta-tags-bar 行为与 markdown 一致）
- 至少 1 条 BDD 覆盖桌面端不回归（该改动只针对移动端，桌面端布局行为不变）
- 边距类 BDD 必须给出可量化的 Then 断言（像素值或相对既有值的比例），不能用"更紧凑"这种主观词
- 底部操作栏类 BDD 需覆盖：①固定可见性（滚动过程中不消失）②与浏览器地址栏不重叠/不被遮挡（safe-area）

## [BASELINE_CHANGE] 标注要求

DESIGN.md:219（"metadata/tags bar hides on scroll-down, reappears on scroll-up"）与用户新要求方向相反。你必须在 P1-requirements.md 里显式标注 `[BASELINE_CHANGE: DESIGN.md:219 现有滚动隐藏规则将被本任务替换为嵌入内容流方案，理由——用户反馈跳变体验差]`，不能静默覆盖或忽略这条既有规则的存在。

## 裁剪倾向（来自 P0-brief，可参考但你需独立判断）

- P2 不可裁（涉及 DESIGN.md 变更 + 底部操作栏方案需候选对比）
- P3 不建议跳过（多组件跨文件改动，risk_level 倾向 medium）
- P6 需 Playwright 移动端 viewport 模拟

## 门槛（什么算完成）

- P1-requirements.md 存在，含 ≥5 条 BDD（三个问题点 + 跨 viewer 覆盖 + 桌面不回归，可能更多）
- domains/packages/risk_level/phases 已声明
- 底部操作栏范围点已用 `[NEED_CONFIRM]` 或 `[SUGGEST]` 明确标注（不能留空未处理）
- `[BASELINE_CHANGE]` 标注已写入
- 无遗漏的 `[NEED_CONFIRM]`（除底部操作栏范围点外，若发现其他方向性问题也需标注）

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

