# P1 派发指引 — T085 analyst

## 目标

为 T085（详情页渲染回归修复）建立需求基线，产出 `P1-requirements.md`。质疑需求完整性，识别隐含需求，将 5 个用户可见缺陷转化为 BDD 验收条件。

## 任务背景

T075（structured-data-viewer v0.14.0）上线后，用户在实际使用中发现 5 个渲染缺陷。经主 Agent 初步排查已定位根因（见 P0-brief）。你的职责是把这些缺陷转化为可二值判定的 BDD 验收条件，并识别隐含需求。

## 5 个缺陷（主 Agent 已定位根因，供你转化 BDD）

| # | 缺陷 | 根因（已定位） |
|---|------|----------------|
| P1 | SVG 被渲染为 TreeView 而非 ImageViewer | 调度链 `isXml` 分支在 `isImage` 之前，`.svg` language=xml 被截获 |
| P2 | 源码视图竖向无法滚动 | T084 移除 `.code-body` 的 `flex:1; min-height:0`，`overflow:hidden` 裁剪内容 |
| P3 | Markdown 渲染边距丢失 | T084 移除 `.markdown-body` padding，content-area 16px/8px 不达 DESIGN.md 32px/16px |
| P4 | 滚动到底端抖动 | setupScrollHide 无边界保护 + content-area 无 overscroll-behavior |
| P5 | TableView per-page 下拉框选不中 | 原生 select 未样式化 + E2E selectOption 绕过真实点击 |

## 约束

- P1 只定义"要解决什么"和"做完什么样算对"，不设计"怎么做"
- BDD 用 Given/When/Then 格式，每条可二值判定（PASS/FAIL）
- 逐维度过隐含需求：数据/前端/多端（MCP/CLI/API）/边界/兼容
- 拿不准标 `[NEED_CONFIRM]`，无待确认写 `[NO_NEED_CONFIRM]`
- 不掺入解决方案设计（P2 才设计）
- 必查：P5 的 per-page 下拉框——用户报告"真实点击无法选中"，这是测试盲区（E2E 用 selectOption 绕过），BDD 必须要求真实点击验证

## 上游关联

- P0-brief.md：5 个问题根因 + 范围声明 + env_constraints
- T075 复盘：测试断言魔数 bug 教训（BDD 断言必须可推导）
- DESIGN.md：§6 间距（32px/16px）+ §9 滚动架构 + §10 可访问性

## 输入文件

1. `docs/tasks/T085-render-regression-fix/P0-brief.md`（问题根因 + 范围）
2. `docs/reviews/T075-retrospective-20260801.md`（教训参考）
3. `frontend-v3/src/components/EntryDetailContent.vue`（调度链现状）
4. `frontend-v3/src/composables/useEntryDetailComputed.ts`（isXml/isImage 现状）
5. `frontend-v3/src/styles/code.css`（.code-body 现状）
6. `frontend-v3/src/components/MarkdownViewer.vue`（padding 现状）
7. `frontend-v3/src/composables/useResponsiveLayout.ts`（scroll-hide 现状）
8. `frontend-v3/src/components/TableView.vue`（per-page select 现状）
9. `DESIGN.md`（§6 间距 + §9 滚动 + §10 可访问性）
10. `frontend-v3/e2e/structured-data-viewer.spec.ts`（BDD-19/20 selectOption 盲区）

## 客观查证信息

- 当前测试基线：vitest 1177 passed | 1 skipped，E2E 84/84（含 selectOption 盲区）
- 版本：peekview v0.14.0
- DESIGN.md §6：`Padding: 32px desktop, 16px mobile`
- DESIGN.md §9：`.content-area` 唯一纵向滚动容器，viewer 不 overflow-y
- DESIGN.md §10：交互元素必须 `<button>` 或加键盘事件（T075 评审 BLOCKER 教训）
- seed-data 已有：`svg-standalone`（独立 SVG）、`markdown-test`（长 Markdown）、`csv-employees`（TableView 数据）——足够验证
- 用户强调"不做不该做的事"——不要扩范围，5 个缺陷之外的不碰

## 门槛

- P1-requirements.md 存在，含 BDD ≥1 条
- 5 个缺陷各有对应 BDD（P1-P5 全覆盖）
- domains / packages / risk_level / phases / capability_requirements 已声明
- 无未决 [NEED_CONFIRM]（或已标 [NO_NEED_CONFIRM]）
- BDD 可二值判定，不绑 CSS 类名/HTML 属性名/实现细节

## 返回给主 Agent

只返回两行：P1-requirements.md 路径 + 一句话摘要（N 条 BDD，M 个待确认）。

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
<!-- AGATE_CARD_END -->
