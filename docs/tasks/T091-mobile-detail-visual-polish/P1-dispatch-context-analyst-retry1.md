---
phase: P1
task_id: T091-mobile-detail-visual-polish
role: analyst
---

# 派发指引 — T091 P1 需求基线修订（第 1 轮）

## 上轮产出

- 上轮 P1-requirements.md：`docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（不要重写，增量修订）
- 评审意见：`docs/tasks/T091-mobile-detail-visual-polish/P1-review.md`（status: needs-revision，4 处具体缺口，方案本身没问题，不需要重新设计 BDD 结构）

## 修复目标（评审提出的 4 处具体缺口）

### 1. BDD-1 分类纠正 + 视觉断言占比数字更正

评审核实：BDD-1（meta-tags-bar 换行无横向滚动）的 Then 子句核心判据是 `scrollWidth <= clientWidth`，纯 DOM 布尔值，横向滚动条有无是这个值的直接推论，"截图核对无横向滚动条痕迹"不提供任何 DOM 之外的独立判定信息——不应计入"视觉断言"分子。

请：
- 把 BDD-1 的措辞改清楚，明确这是 DOM 数值断言，截图仅为佐证，不写"视觉断言"这类归类语言
- 重新统计真实的视觉断言占比数字（评审给出的核实结果：剔除 BDD-1 后，宽容计入 BDD-10/11 是 8/13≈61.5%，严格要求正文显式声明 vision-engine 才算则是 6/13≈46%——你需要先按下面第 3 点把 BDD-10/11 正文补上 vision-engine 声明，那样它们就能正当计入分子，达到 8/13≈61.5%，超过 60% 门槛）

### 2. BDD-2 补 DOM 层面辅助判定

BDD-2（meta-tags-bar 视觉呼吸感）是全文档唯一一条纯粹依赖 vision-engine 主观印象、没有任何 DOM 数值兜底的条目，"存在清晰可辨识的留白间隙"这个 PASS 侧判定没有量化标准，评审指出这有"verifier 自己觉得改善了就判 PASS"的假通过风险。

请仿照 BDD-3（DOM 数值 + vision-engine 搭配）的写法，给 BDD-2 补一条 DOM 层面的辅助判定，例如"meta-tags-bar 实际渲染高度（`offsetHeight`）不小于某个具体阈值，且明显超过原基线约 17px"，与 vision-engine 的主观判定并列作为 Then 子句的两个子条件（具体阈值数字你自己核算，参照新 padding 16px/16px + 文字行高等因素推算一个合理下限，不要凭空编造一个数字，要能自圆其说）。

### 3. BDD-10/11 补验证方法声明 + 判定标准具体化

评审核实 DOM 关系描述（meta-tags-bar 与 ImageViewer/HtmlViewer 同级渲染、height:100%相对content-area高度）技术上准确，不需要改，但：
- When 子句里没有显式写"用 vision-engine 分析首屏截图 + 滑动后截图"这句验证方法声明（目前只能从第 7 节能力需求声明段落间接推断），请显式加入 When 子句，与 BDD-2/3/5/7/9/13 的写法保持一致
- "不因 meta-tags-bar 占用额外高度而被压缩到不可用尺寸"——请给一个可操作的阈值或参照（比如相对原尺寸的最小占比，或明确要求 vision-engine 报告里必须指出"viewer 可视区域高度相较预期是否有肉眼可辨的塌陷"这类具体执行指引）
- "滚动冲突/抖动"——请给出具体的操作化验证步骤（比如指定滑动手势序列，明确要求 vision-engine 在滑动前后各截一张图并判断是否有重影/跳动，而不是停留在"用户尝试向上滑动"这种笼统描述）

BDD-10/11 两条都要改，改法一致。

### 4. BDD-9 补全 Given 范围

当前 BDD-9 的 Given 子句只列了 7 个常规 viewer entry，SVG/Mermaid/PlantUML 3 个是通过 BDD-11 后面的独立"说明"脚注并入的——评审指出这样写容易在 P6 被按字面读 BDD-9 的 Given（7个）执行，遗漏另外 3 个，属于"证据链断裂"风险（跟本任务要防范的 T090 教训是同一类问题，只是发生在 BDD 文本内部）。

请把 SVG（`svg-standalone`）/Mermaid（`mermaid-charts`）/PlantUML（`plantuml-arch`）3 个 entry 直接写入 BDD-9 的 Given 子句（共 10 个 entry），删除或改写原来的脚注（脚注可以保留作为"为什么这 3 种不需要单独开条"的解释性说明，但验收范围本身必须体现在 BDD-9 正文里，不能只靠脚注）。

## 不要做的事

- 不要重新设计候选方案，4 处修复方案本身已经和用户定型，不需要重新探索
- 不要动已通过评审的 BDD（3/4/5/6/7/8/12/13），保持原样
- 重点检查 4（P0-brief 数值转译）和重点检查 5（两条 SUGGEST）评审已确认无误，不需要改动

## 门槛（什么算完成）

- BDD-1 措辞纠正，不再归类为视觉断言
- BDD-2 补上 DOM 辅助判定阈值
- BDD-10/11 补上显式 vision-engine 声明 + 具体化判定标准
- BDD-9 的 Given 子句包含全部 10 个 entry
- 视觉断言占比数字重新统计并更新（应能达到 ≥60% 门槛，且统计口径要经得起复核）

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
