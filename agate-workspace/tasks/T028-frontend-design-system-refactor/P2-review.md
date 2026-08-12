---
phase: P2
task_id: T028
task_name: frontend-design-system-refactor
type: review
trace_id: T028-P2-review-20260629
created: 2026-06-29
status: approved
parent: T028-P2-20260629
---

# T028 P2 Design Review

## 评审角色

| 角色 | 评审人 | 依据 |
|------|--------|------|
| plan-design-review | 主 Agent（编排者） | domains: frontend → plan-design-review (P2) |

## 评审结论：approved

无 BLOCKER。所有声明字段完整，方案覆盖 P1 全部需求。

## 评审要点

| # | 审查项 | 结论 | 备注 |
|---|--------|------|------|
| 1 | packages/domains/ui_affected/gate_commands/env_constraints/files_to_read/minimal_validation | ✅ 全部存在且非空 | 7 个声明字段完整 |
| 2 | D2 `--bg-primary` 1:N 映射 | ✅ | 别名主映射=`--c-bg`，逐页面按上下文改 `--c-surface`（§2.3 4 个页面均有 D2 处理表） |
| 3 | F1 LandingView `.stage` 兼容 | ✅ | 删除非 scoped `.stage` + scoped 内规范名替换 + Landing-only token 保留 |
| 4 | F2 layout.css 迁移纳入 | ✅ | 16 处旧 token 逐条映射 |
| 5 | F3 a11y focus ring | ✅ | BaseButton/SearchInput 定义 focus ring 样式 |
| 6 | F4 触控设备 hover-only 按钮 | ✅ | EntryListView 用 `@media (hover: hover)` |
| 7 | F5 prefers-reduced-motion | ✅ | BaseButton 禁用 transform |
| 8 | 旧 token 别名兼容 C1 | ✅ | 29 旧 token → `var(--c-*)` 别名 |
| 9 | 实施顺序 | ✅ | 4 Phase 渐进式，每 Phase 有验证步骤 |
| 10 | gate_commands 紧凑输出 | ✅ | `2>&1 | tail -20` |

## 风险确认

- `--bg-primary` 别名映射为 `var(--c-bg)` 后，非范围组件（LoginDialog/ConfirmDialog 等）的背景色会从旧值变为 `--c-bg` 值——视觉差异极小（同色系微调），可接受
- LandingView 提升后需实跑验证视觉不变——P5/P6 gate 已包含

## 不评审的项

- 后端/MCP/安全：domains 不涉及，无需评审
- P7 裁剪：单包，主 Agent 确认跳过
