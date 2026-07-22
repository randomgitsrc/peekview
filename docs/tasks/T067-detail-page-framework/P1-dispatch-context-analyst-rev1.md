---
phase: P1
task_id: T067-detail-page-framework
role: analyst
created: 2026-07-23
retry: 1
---

# P1 派发指引 — analyst（修订轮）

## 目标

根据 P1-review.md 的 5 个必须修改项修订 P1-requirements.md。

## 必须修改项

1. **BDD-1/4/5**：消除"或"字句，改为不预设实现位置的表述
   - BDD-1: "移动端可见 Sign in 入口（sticky-header 或 bottom-bar）"→"移动端可见 Sign in 入口"
   - BDD-4: "紧邻 SVG 图标或独立显示"→"可见 PeekView 品牌文字"
   - BDD-5: "图标或文字或两者"→"可见品牌标识元素"
2. **BDD-2**：删除用户菜单 And 子句（"若详情页有用户菜单，则显示用户头像/名称"），这是 P2 设计决策
3. **BDD-8**：声明期望的 reads 格式 + readStats null/0 处理
   - 代码现状：桌面端 `v-if="currentEntry?.readStats"` + 条件复数 "1 read"/"N reads"；移动端 `currentEntry?.readStats?.totalCount ?? 0` + 固定 "N reads"
   - P1 需声明期望：readStats 有值时桌面/移动端格式统一（条件复数）；readStats 为 null 时隐藏
4. **BDD-9**：将"视觉权重大于"改为可客观判定的条件——如"Sign in 按钮使用 btn-primary 或等效高视觉权重样式（非 btn-ghost）"
5. **phases YAML 补入 P7**：YAML 声明应与文字说明一致

## 建议修改项（一并处理）

1. BDD-4 Given 限定视口 >640px
2. BDD-6 补充移动端 explore 导航需求（"移动端存在可点击的导航元素指向 /explore"）
3. 补充 zen mode 声明：zen mode 下品牌条/Sign in 随 header 隐藏
4. BDD-9 补充 640-860px 区间要求

## 输入文件

1. docs/tasks/T067-detail-page-framework/P1-requirements.md — 需修订的需求基线
2. docs/tasks/T067-detail-page-framework/P1-review.md — review 修改意见

## 约束

- 只修改 review 指出的问题，不要重写整个文件
- 修改后确保 BDD 编号不变（方便 P6 对照）
- 保持 Header 不变（status 改为 revised）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：agate/phase-cards/P1-requirements.md
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

- [ ] P0-brief.md 完成（五字段齐全）

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
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式不固定，主 Agent 自行判定）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）

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
