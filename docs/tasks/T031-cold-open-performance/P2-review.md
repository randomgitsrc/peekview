---
phase: P2
task_id: T031-cold-open-performance
type: review
parent: P2-design.md
trace_id: T031-P2-review-20260722
status: approved
created: 2026-07-22
agent: plan-design-review
---

# P2 设计评审 — Explore 列表页性能与交互优化

## 评分总览

| 维度 | 分数 | 判定 |
|------|------|------|
| 交互状态覆盖率 | 7/10 | PASS |
| AI Slop 风险 | 8/10 | PASS |
| 移动端考虑 | 6/10 | PASS (with warnings) |
| 可访问性 | 7/10 | PASS |

**综合判定：approved**（无 BLOCKER / CRITICAL，3 个 WARNING 可在 P4 实现时解决）

## 维度详评

### 1. 交互状态覆盖率 — 7/10

**覆盖良好：**
- Loading：骨架屏覆盖 grid（6 × skeleton-card）+ list（6 × skeleton-row）+ 详情页（header + content skeleton），shimmer 动画 + `--c-border` 色值确保主题适配
- Edge cases：无文件 entry 不发 fileContent、shareToken 行为不变、button 右键菜单可接受

**缺口（WARNING）：**
- 并行加载失败时的 UI 未显式说明。A1 提到 "Promise.all reject 则整体 reject"，但未描述用户看到什么（错误提示？重试按钮？）。现有错误处理大概率保留，但设计应显式声明 "错误态 UI 不变"

### 2. AI Slop 风险 — 8/10

方案高度具体，实现者几乎无"自由发挥"空间：
- 骨架屏尺寸锚定真实组件（radius 14px, padding 24px, grid 2col）
- DOM 变更精确到标签级（div→a, router-link→span+role+tabindex+keydown）
- CSS 修复一行 × 3 处，字体栈明确
- 文案为精确字符串
- 并行机制明确（route query + Promise.all + router.replace 清理）

唯一微小空间：骨架屏内部灰条的 width/height 未逐一标注，但 "与真实组件同布局" + DESIGN.md §6 Skeleton 节已足够约束。

### 3. 移动端考虑 — 6/10

**隐式覆盖：**
- `<a>` 原生触摸友好
- 骨架屏 "同布局" 暗示继承响应式 CSS
- 底部操作栏不在改动范围

**缺口（WARNING）：**
- 未显式声明骨架屏在 ≤640px 折叠为单列（DESIGN.md §9 要求）
- 未提及触摸设备上 toggle/delete 按钮可见性保证（DESIGN.md: "hover-only action buttons must always be visible on touch devices"）
- 设计文档无专门移动端段落（dispatch-context 声称已考虑，但正文未体现）

### 4. 可访问性 — 7/10

**覆盖良好：**
- `<a>` 原生 Enter 导航 + 移除冗余 role/tabindex/keydown
- username span 完整 a11y 补偿（role="link" + tabindex="0" + @keydown.enter）
- Space 键行为正确（链接不响应 Space）

**缺口（WARNING）：**
- 骨架屏缺少 `aria-busy="true"` 或 `role="status"`——屏幕阅读器无法感知加载态
- username span 的 focus 样式未明确（应继承 DESIGN.md 的 focus ring）
- 注：现有 "Loading..." 也无 aria 声明，非退化，但既然在改，建议顺手补上

## BDD 覆盖检查

| BDD | 覆盖方案 | 判定 |
|-----|---------|------|
| BDD-1 并行加载 | A1: route query fileId + Promise.all | COVERED |
| BDD-2 原生链接 | B1: 整卡 `<a>` 包裹 | COVERED |
| BDD-3 分隔符 | C1: .meta-sep font-family 覆盖 × 3 | COVERED |
| BDD-4 placeholder | D: 精确英文文案 | COVERED |
| BDD-5 按钮文案 | E: "Browse public" × 2 | COVERED |
| BDD-6 骨架屏 | F1: grid+list+detail 内联骨架屏 | COVERED |
| BDD-7 嵌套交互 | B1: stopPropagation + username span | COVERED |

7/7 BDD 全部有方案覆盖。

## WARNING 汇总（P4 实现时处理）

1. **W1**：并行加载失败时显式保留现有错误态 UI（或声明 "错误态不变"）
2. **W2**：骨架屏 CSS 确保响应式（≤640px 单列），触摸设备 action 按钮可见
3. **W3**：骨架屏容器添加 `aria-busy="true"`，username span 确保 focus ring 可见

## 结论

设计方案质量高：minimal_validation 验证了关键假设（`<a>` 嵌套行为），候选方案对比清晰，否决理由充分，BDD 全覆盖。3 个 WARNING 均为实现细节级补充，不需要重新设计。

**Status: approved**
