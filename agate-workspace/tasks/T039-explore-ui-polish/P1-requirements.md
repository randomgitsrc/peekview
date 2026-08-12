---
phase: P1
task_id: T039-explore-ui-polish
type: requirements
parent: P0-brief.md
trace_id: T039-P1-20260630
status: draft
created: 2026-06-30
---

P1_simplified: true

## 需求复述

Explore 页面三项纯前端 UI 修正：(1) Public/Private badge 仅对 owner 显示；(2) 列表模式删除与 title 重复的 summary 行；(3) 标签折叠策略按上下文区分（卡片=3，列表和详情不限）。

## 隐含需求识别

**数据维度**：无。不涉及 schema 变更或数据迁移。

**前端维度**：有。三项均改变模板渲染逻辑。隐含需求：
- Badge 显隐改变后，`EntryListRow.spec.ts` 的 badge 测试（lines 57-69）需同步更新，否则测试失败。这是**必须做的连带修改**，否则 P5 pytest 不通过。
- 删除 `.entry-summary` 行后，对应的 CSS（`.entry-summary` 样式块，EntryListRow.vue:121-128）也应清除，避免死代码。

**多端维度**：无。Badge/summary/tags 是纯前端展示概念，MCP/CLI/API 不涉及。

**边界维度**：
- 空 tags（0 标签）：visibleTags 返回 `[]`，不渲染标签行。现有逻辑已处理，无影响。
- 极多 tags（>20）：详情页不限后可能很长。P0 已识别此风险，接受当前行为，后续可加 max-height + 展开。P1 不增加新约束。
- summary 为空字符串：title 行走 `summary || slug` 回退到 slug，summary 行因 `v-if="entry.summary"` 不渲染。删除 summary 行后无变化。

**兼容维度**：删除 summary 行缩小列表行高度，但无 breaking 行为。Badge 显隐改变视觉呈现但不改变功能。标签全部显示不改变数据。

## BDD 验收条件

### R1: Badge 智能显隐

**R1.1** Given 用户是 entry 的 owner, When 查看 EntryCard, Then 看到 Public/Private badge
**R1.2** Given 用户不是 entry 的 owner（含未登录）, When 查看 EntryCard, Then 不看到任何 badge
**R1.3** Given 用户是 entry 的 owner, When 查看 EntryListRow, Then 看到 Public/Private badge
**R1.4** Given 用户不是 entry 的 owner（含未登录）, When 查看 EntryListRow, Then 不看到任何 badge

### R2: Summary 去重

**R2.1** Given 列表模式中 entry 有 summary, When 渲染 EntryListRow, Then `.entry-summary` 元素不存在（DOM 中无该节点）
**R2.2** Given 列表模式中 entry 有 summary, When 渲染 EntryListRow, Then title 行显示 summary 内容（`entry.summary || entry.slug` 逻辑不变）

### R3: 标签折叠上下文感知

**R3.1** Given 卡片模式 entry 有 5 个标签, When 渲染 EntryCard, Then 显示 3 个标签 + "+2" 溢出提示
**R3.2** Given 列表模式 entry 有 5 个标签, When 渲染 EntryListRow, Then 显示全部 5 个标签，无溢出提示
**R3.3** Given 详情页 entry 有 5 个标签, When 渲染 EntryDetailView, Then 显示全部 5 个标签，无溢出提示
**R3.4** Given 任意模式 entry 有 0 个标签, When 渲染, Then 不显示标签区域（现有行为不变）

## 待确认清单

无。三项需求方向明确，无歧义理解，不涉及业务判断。

## 裁剪说明

phases: [P1, P4, P5, P6]

| 跳过阶段 | 理由 |
|----------|------|
| P2 | 方案明确——三项均为单行模板改动（v-if / 删行 / 常量调整），无设计空间 |
| P3 | ≤5 行 × 3 处小改；EntryListRow.spec.ts 已有 badge 测试覆盖组件，P5 可验证 |
| P7 | 不涉及多端，仅前端三组件 |
| P8 | 合并到下次发布，不单独 bump |

保留 P6 理由：三项均改变 UI 渲染，需 Playwright 截图验证视觉效果。

## 范围声明

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected:
  - EntryCard.vue
  - EntryListRow.vue
  - EntryDetailView.vue
  - EntryListRow.spec.ts（连带修改：badge 测试加 isOwner 条件）
gate_commands:
  - cd frontend-v3 && npx vue-tsc --noEmit
  - cd frontend-v3 && ./node_modules/.bin/vitest run
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 badge 显隐、summary 行消失、标签全量显示的视觉效果
    available:
      - playwright-cdp skill
      - vision-analyzer skill
    status: available
```
