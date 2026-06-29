---
phase: P1
task_id: T029-card-list-layout-polish
type: requirements
parent: P0-brief.md
trace_id: T029-P1-20260630
status: draft
created: 2026-06-30
---

# T029 需求基线：卡片/列表布局打磨

## 需求复述

3 项纯前端 CSS+模板改动，统一卡片和列表的信息层级：

1. **Tag 折叠**：EntryCard 和 EntryListRow 中，tag 数量超过阈值（2-3 个）时，只显示前 N 个，剩余折叠为 `+N` 标记。目的是控制卡片最大高度，防止 tag 多时卡片被撑高。
2. **Meta 信息位置重排**：卡片和列表行内的信息布局顺序调整为 `title → meta（@user · 日期 · file数） → tags（限数折叠） → badge`。当前代码中 tags 和 metaText 混排在同一 div 内，需要分离。
3. **详情页标题 2 行**：EntryDetailView 的 header 标题从 1 行 `white-space:nowrap; text-overflow:ellipsis` 改为 `line-clamp: 2`，header 高度从固定 `56px` 改为 `min-height` 自适应。

## 隐含需求识别

### 数据维度
- 无数据库变更，无迁移需求

### 前端维度
- **+N 交互方式**：P0-brief 标记为 known_risk。`+N` 仅作视觉提示（无交互）还是可 hover/click 展开全部 tag？这决定是否需要额外组件（tooltip/popover）。
- **Tag 折叠阈值**：P0 写"2-3 个"，具体是 2 还是 3？卡片和列表是否用相同阈值？
- **+N 样式一致性**：`+N` 是复用 BaseTag 样式还是独立样式？需与设计系统对齐。
- **空 tag 场景**：entry 无 tag 时，tag 区域应完全隐藏（当前代码 `v-for` 空数组自然不渲染，但布局顺序调整后需确认 meta 和 badge 间距正常）。
- **移动端 Tag 折叠**：移动端屏幕窄，2 个 tag 可能就占满一行，是否需要更小阈值？

### 多端维度
- MCP / CLI / API 无需同步，纯前端展示改动

### 边界维度
- **0 tag**：折叠逻辑不应渲染 `+0` 或空 `+N`
- **1 tag**：不触发折叠
- **恰好等于阈值**：不触发折叠（无 `+0`）
- **非常多 tag（>10）**：`+N` 数值较大时样式是否正常

### 兼容维度
- `--header-height` 被 `.detail-header` 和 `.mobile-actions` 共同引用。改为 min-height 后，`mobile-actions` 仍保持固定高度（它是底部栏，应保持固定），只有 `.detail-header` 改为自适应。
- 详情页 header 右侧按钮区（`header-right`）当前 `flex-shrink: 0`，标题 2 行后需确认按钮区不被挤压。现有 `align-items: center` 在标题多行时可能需要改为 `align-items: flex-start` 或调整对齐。

## BDD 验收条件

### AC-1: 卡片 Tag 折叠（桌面端）

```
Given 一个 entry 有 5 个 tags
  And 折叠阈值设为 3
When 渲染 EntryCard 组件
Then 只显示前 3 个 BaseTag
  And 显示 "+2" 标记表示剩余 tag 数
  And 卡片高度不超过同宽度下无 tag 卡片高度的 1.5 倍
```

### AC-2: 卡片 Tag 折叠（移动端）

```
Given 一个 entry 有 5 个 tags
  And 折叠阈值设为 2（移动端）
When 在 640px 以下视口渲染 EntryCard
Then 只显示前 2 个 BaseTag
  And 显示 "+3" 标记
```

### AC-3: 列表行 Tag 折叠

```
Given 一个 entry 有 5 个 tags
  And 折叠阈值设为 3
When 渲染 EntryListRow 组件
Then 只显示前 3 个 BaseTag
  And 显示 "+2" 标记
```

### AC-4: Tag 折叠边界 — tag 数 ≤ 阈值

```
Given 一个 entry 有 2 个 tags
  And 折叠阈值设为 3
When 渲染 EntryCard 组件
Then 显示全部 2 个 BaseTag
  And 不显示 "+N" 标记
```

### AC-5: Tag 折叠边界 — 0 tag

```
Given 一个 entry 有 0 个 tags
When 渲染 EntryCard 组件
Then 不渲染任何 BaseTag
  And 不显示 "+N" 标记
  And meta 信息和 badge 间距正常
```

### AC-6: 卡片 Meta 信息位置重排

```
Given 一个 entry 有 summary, username, createdAt, fileCount, tags
When 渲染 EntryCard 组件
Then 布局顺序为：title → meta（@user · 日期 · file数） → tags（限数折叠） → badge
  And meta 信息行在 title 下方独立一行
  And tags 在 meta 下方独立一行
```

### AC-7: 列表行 Meta 信息位置重排

```
Given 一个 entry 有 summary, username, createdAt, fileCount, tags
When 渲染 EntryListRow 组件
Then 布局顺序为：title → meta（username · 日期 · file数） → tags（限数折叠）
  And badge 在右侧
```

### AC-8: 详情页标题 2 行显示

```
Given 一个 entry 的 summary 长度超过 1 行可显示字符
When 渲染 EntryDetailView 的 header
Then 标题最多显示 2 行，超出部分用省略号截断
  And header 高度自适应标题行数（非固定 56px）
```

### AC-9: 详情页标题短文本

```
Given 一个 entry 的 summary 长度不超过 1 行
When 渲染 EntryDetailView 的 header
Then 标题单行显示，无省略号
  And header 高度等于原 56px 最小高度
```

### AC-10: 详情页 header 按钮区不被挤压

```
Given 一个 entry 的 summary 足够长导致标题 2 行
When 渲染 EntryDetailView 的 header
Then 右侧按钮区（visibility/delete/copy 等）完整显示
  And 按钮区不与标题文字重叠
  And 按钮区不换行
```

## 待确认清单

### [RESOLVED] +N 的交互方式
**决策**：选项 A — 纯静态 `+N` 文本，无交互。V1 快速交付。

### [RESOLVED] Tag 折叠阈值
**决策**：3 个。桌面端空间充裕。

## 裁剪说明

```
phases: [P1, P4, P5, P6]
```

| 阶段 | 状态 | 理由 |
|------|------|------|
| P1 | ✅ 保留 | 本文件 |
| P2 | ⏭ 跳过 | 3 项改动均为 CSS+模板打磨，方案在 P0-brief 中已明确（tag 折叠阈值、meta 重排顺序、line-clamp:2），无需额外设计阶段。涉及的 packages/domains/ui_affected 可直接在此声明 |
| P3 | ⏭ 跳过 | 纯 CSS+模板改动，无新逻辑需要 TDD。现有前端单测不覆盖组件渲染细节，新增 CSS 类测试 ROI 低 |
| P4 | ✅ 保留 | 实现阶段 |
| P5 | ✅ 保留 | vue-tsc 类型检查 + 视觉验证 |
| P6 | ✅ 保留 | BDD 验收需 Playwright 截图确认布局效果 |
| P7 | ⏭ 跳过 | 改动限于 3 个文件（EntryCard.vue、EntryListRow.vue、layout.css），无跨文件一致性风险 |
| P8 | ⏭ 跳过 | 无版本变更，纯 UI 打磨不涉及 API/数据模型/MCP 变更 |

## 范围声明

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected:
  - EntryCard.vue（tag 折叠 + meta 重排）
  - EntryListRow.vue（tag 折叠 + meta 重排）
  - layout.css（detail-header 高度自适应）
  - variables.css（可能调整 --header-height 语义，从固定值改为 min-height）

gate_commands:
  - cd frontend-v3 && npx vue-tsc --noEmit
  - P6: Playwright 截图验证（make debug + CDP）
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 tag 折叠效果、meta 重排布局、详情页标题 2 行显示
    available:
      - playwright-vision skill
      - vision-analyzer skill
    status: available
```
