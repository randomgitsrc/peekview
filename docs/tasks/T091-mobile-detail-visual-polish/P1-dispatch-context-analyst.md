---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: analyst
---

# 派发指引 — T091 P1 需求基线

## 目标

把 P0-brief.md 里已经和用户逐条讨论定型的 4 处修复方案（非待探索的开放问题）转成规范的 BDD 验收条件。**你的工作不是重新调研要不要改、改成什么——这些都已经拍板**，你的工作是把已确定的方案写成可验证、可截图核对的验收条件，并识别有没有被遗漏的隐含需求。

## 上游关联

- 本任务是 T090（v0.18.1 已发布）的直接视觉修正后续，起因是用户实机走查后反馈"机械性改需求，没有在审美/呼吸感受上做有意义的事"
- orchestrator 已用 Playwright CDP 截图 + DOM 实测复核确认了 4 处问题的根因（其中 2 处是真实现 bug，不只是审美偏好），并与用户逐条讨论确认了具体修复方案 + 数值，详见 P0-brief.md 正文
- **P1 不需要重新探索候选方案**，重点是：①把已定方案转成 Given/When/Then ②确保验收条件是"可截图验证的视觉断言"而不是纯数值断言（这是 T090 的核心教训——上次 BDD 全是数值判定，没人真的看过效果）③识别 P0-brief 未覆盖但你读完源码后发现的隐含需求

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P0-brief.md`（**核心输入**，已定型的 4 处方案 + 9 种 viewer 覆盖范围 + known_risks）
2. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（T090 的需求基线，了解已有的 BDD-1~12 覆盖范围，避免重复造轮子，本任务的 BDD 编号从头开始即可，不需要接着 T090 编号）
3. `frontend-v3/src/components/EntryMetaTagsBar.vue`
4. `frontend-v3/src/components/MarkdownViewer.vue`
5. `frontend-v3/src/components/EntryDetailMobileBar.vue`
6. `frontend-v3/src/components/EntryDetailHeader.vue`（L36-37 桌面端 Copy 按钮的 `.icon-btn` 用法，Copy 图标化要对齐这个）
7. `DESIGN.md`（L149-160 Buttons/Icon Buttons 章节、L218-223 Meta Tags Bar/Markdown Body Spacing、L265-267 Touch targets/底部栏、L270-278 Scroll Architecture 含 ImageViewer/HtmlViewer 例外说明）

## BDD 覆盖要求（对应 P0-brief 的 4 处方案 + 范围扩展）

1. **meta-tags-bar**：padding 改 16/16 + 换行不横向滚动。至少 2 条 BDD——一条验"内容超长时换行显示、无横向滚动条"，一条验"padding 视觉留白改变后不再显得局促"（可截图判定的视觉断言，不是数值断言）
2. **markdown-body 移动端边距**：补回 16px padding。至少 1 条 BDD，可以是数值断言（`.markdown-body` 的 computed padding = 16px）+ 视觉留白判定
3. **底部操作栏 padding 对称性**：这是真 bug 修复，至少 1 条 BDD 验证"无安全区设备下 padding-top 与 padding-bottom 相等"（可用实测数值断言，DOM 测量即可，不强制截图）
4. **Copy/Wrap 按钮图标化**：至少 2 条 BDD——Copy 变成纯图标（对照桌面端 `.icon-btn` 视觉一致）+ 44×44 达标；Wrap 变成图标 toggle（active 态可视觉区分开/关）+ 44×44 达标
5. **9 种 viewer 覆盖**：至少 1 条 BDD 明确要求上述 1-4 的效果在全部 9 种 viewer（Markdown/Code/CSV/TSV/JSON/YAML/XML/SVG/Mermaid/PlantUML）下截图核对一致；**Image/HTML 两个滚动架构例外必须各自独立一条 BDD**（不能和其余 7 种合并断言），验证 meta-tags-bar 在这两种 viewer 下是否仍能正常先看到再随内容滚走，还是被 viewer 内部的 `overflow:hidden` 区域遮挡/割裂
6. **跨端不回归**：至少 1 条 BDD 验证桌面端（>640px）不受本次改动影响

## DESIGN.md 修订核对

P0-brief 已列出 DESIGN.md 需要修订的 3-4 处（L221-223/L267/L218-219，可选 L158-160）。P1 需要在 BDD 里体现"DESIGN.md 文字修订与代码改动同步"这一验收点，可以合并进对应功能点的 BDD，不需要单独开一条。

## [BASELINE_CHANGE] 提示

如果你判断某条 BDD 需要修改 T090 已有的 DESIGN.md 文字表述（如 L267 的 padding-bottom 描述），这属于修正一个已确认的文档 bug，不是推翻方向，正常写入 BDD 即可，不需要走 `[BASELINE_CHANGE]` 流程（那是用于变更本任务自己 P1 基线的场景，不适用于修正 T090 遗留的文档 bug）。

## 门槛（什么算完成）

- ≥9 条 BDD（对应上方 6 类要求，Image/HTML 独立成条会更多）
- 每条 BDD 编号格式 `#### BDD-NN:`，连续不跳号
- 至少 60% 的 BDD 是可截图验证的视觉断言，不能全是纯 DOM 数值判定（这是本任务存在的意义）
- domains/packages/risk_level/phases 已声明（risk_level 建议参照 P0-brief 倾向 medium，你可独立判断）
- capability_requirements 声明 browser-vision（本任务重度依赖截图+vision分析）
- 无遗留 [NEED_CONFIRM]（除非你发现 P0-brief 没覆盖到的真正需要用户拍板的新问题）

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
