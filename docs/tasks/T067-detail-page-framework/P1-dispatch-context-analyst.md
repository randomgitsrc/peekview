---
phase: P1
task_id: T067-detail-page-framework
role: analyst
created: 2026-07-23
---

# P1 派发指引 — analyst

## 目标

建立 T067 detail-page-framework 的需求基线。产出 P1-requirements.md，含 BDD 验收条件、隐含需求、裁剪声明。

## 约束

- T065 已完成，authState 响应式已修好——Sign in 绑定 authState 可直接依赖
- T031 已完成，详情页骨架屏+并行加载已就位——不重复做
- 纯前端改动，不改后端 API 契约
- ui_affected: true → P6 需 Playwright 截图验证
- 品牌条形态需仔细思考（极窄条 vs 浮动徽章 vs footer），用户明确"没想好"——P1 不定方案，只定义需求
- 项目铁律：不加注释

## 上游关联

- T065 (login-state-bug): authState 响应式修复已完成，本任务 Sign in 显隐可验证
- T031 (cold-open-performance): 详情页骨架屏+并行加载已就位，整卡链接已实现
- T066 (explore-card-display-config): Deferred，与本任务无关

## 真实缺口（来自 P0-brief 代码核查纠正）

1. 详情页无 Sign in 入口——冷用户想登录无处可点
2. 品牌识别弱——桌面只有 SVG 图标无"PeekView"文字字标；移动端连图标都没有
3. 无 explore 导航——读完无法去浏览更多
4. 移动端底栏 "Files 2" 文案改为 "2 files"
5. reads 计数桌面/移动端统一
6. 首页 Sign in 视觉权重提升

## 输入文件（必读）

1. docs/tasks/T067-detail-page-framework/P0-brief.md — 任务简报（五字段齐全）
2. frontend-v3/src/views/EntryDetailView.vue — 详情页当前代码（:5-10 移动端 header, :13-106 桌面 header）
3. frontend-v3/src/views/LandingView.vue — 首页 Sign in 当前实现
4. frontend-v3/src/stores/auth.ts — authStore（authState 响应式，T065 已修好）
5. frontend-v3/src/views/EntryListView.vue — Explore 页面（了解导航目标）
6. frontend-v3/src/components/LoginDialog.vue — 登录弹窗组件

## 特别注意

- 桌面端已有 logo (EntryDetailView.vue:15-17) 和 tooltip (:30/40/50)——不要按"无 logo/无 tooltip"假设写需求，P1 须实跑验证 tooltip hover 是否生效
- 移动端确实空：只有返回箭头+标题，无 logo/品牌字/Sign in/导航
- 首页 Sign in 权重提升与 T065 的 landing Sign in 绑定有重叠——T065 管"显隐绑定"（功能），本任务管"视觉权重"（样式）

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
