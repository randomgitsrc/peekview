---
phase: P1
generated_by: agate-inject-card.sh + 主 Agent
task_id: T031
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P1-requirements.md——Explore 列表页性能与交互优化的需求基线，含 BDD 验收条件、domains/packages/risk_level/phases/capability_requirements 声明

### 约束
- **纯前端改动，不改后端 API 契约**——并行加载用 Promise.all，不合并 API
- **`<a>` 改造需处理嵌套交互元素**（标签按钮等）的 a11y 与事件冒泡
- **骨架屏/spinner 需与真实卡片布局一致**，避免布局跳动
- **`·` 修复兼顾亮/暗色主题**视觉一致性
- **P6 需 Playwright 实跑截图验证桌面+移动**——UI 改动 P6 不可裁
- **明确不含**：summary 预览/卡片配置（→T066）、标签过滤排序（→backlog）、详情页孤岛（→T067）
- **P0/P1 职责边界**：P0 已界定的 5 个子项直接转化为 BDD；P0 没覆盖的隐含需求由 P1 独立产出

### 上游关联
- P0-brief.md 已界定 5 个子项 + 明确排除项
- 审计报告：docs/reviews/T031-cold-open-audit-2026-07-22.md（如存在，读取了解背景）
- T066 已 Deferred（summary 配置不在本任务范围）

### 输入文件
- docs/tasks/T031-cold-open-performance/P0-brief.md（主 Agent 的任务简报和风险声明）
- frontend-v3/src/views/EntryList.vue（Explore 列表页主组件）
- frontend-v3/src/views/EntryDetail.vue（详情页，理解当前串行加载链）
- frontend-v3/src/stores/entry.ts（entry store，理解 getEntry/selectFile/getFileContent 链）
- frontend-v3/src/router.ts（路由定义，理解导航方式）
- frontend-v3/src/components/（卡片相关组件，glob 确认文件名）
- DESIGN.md（设计系统，理解卡片/列表/骨架屏规范）
- AGENTS.md（项目约定、铁律）
</dispatch_guide>

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

<objective_info>
- debug backend: http://127.0.0.1:8888 (make debug-start, /tmp/peekview-debug/)
- seed data: make debug-seed → alice/bob/carol (password testpass123), 12 entries
- 当前加载链：EntryDetail onMounted 中串行 await getEntry → selectFile → getFileContent
- 当前卡片点击：@click handler 调用 router.push，非 <a> 标签
- 分隔符问题：`·`（U+00B7）在某些字体 fallback 下渲染为灰色方块
- 搜索框 placeholder 当前值："搜索标题、标签和文件内容"（中文，其余 UI 全英文）
- 导航按钮当前文案："Explore"
- 前端测试：make test-frontend (vitest)；typecheck: make typecheck
- 前端构建：make build-frontend
</objective_info>
