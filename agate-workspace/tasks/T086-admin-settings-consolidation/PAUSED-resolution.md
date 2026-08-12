---
phase: PAUSED
task_id: T086-admin-settings-consolidation
type: paused-resolution
trace_id: T086-P5-20260807-retry1
created: 2026-08-07
---

# PAUSED 恢复记录 — P5→P3 跨阶段回退

## 触发原因

P5 全量重跑（见 `P5-test-results/e2e.md` + `P5-gate-diagnosis-2.md`）证实 P4-retry2 的路由修复生效（BDD-8/9/10 全部真正执行并通过），但暴露一个新的、独立的真失败：T086 BDD-11（`admin.spec.ts:269`）strict-mode violation，选择器 `[data-testid="user-manager-content"]` 未加视口 scope，命中 SettingsView 桌面/移动双渲染产生的 2 个 DOM 节点。

根因判定：这是 P3 阶段产出的测试代码本身的缺陷（同文件内 BDD-01/02 已用 `scopeOf(vp.name)` 消歧同一模式，BDD-11/12 漏加），不是 P4 实现问题（`git diff` 证实 P4-retry2 只改了 `router.ts`）。修复目标阶段是 P3（test-designer 角色），当前 phase=P5，diff=|5-3|=2 ≥ 2，按 `state-machine.md`"阶段回退规则"需 PAUSED + 人工批准才能跨阶跳转。

## 人工决策

主 Agent 通过 AskUserQuestion 向用户呈现：现象 + 根因 + 三个选项（① 批准按论证处理 ② 改为在 P4 修（不推荐，违反 implementer 角色"不改测试去迁就实现"约束）③ 用户先自己看一眼再定）。

**用户选择**：批准，按论证处理（推荐项）。

## 恢复目标与执行计划

1. `.state.yaml` phase 从 PAUSED 跳转到 P3
2. 派发 test-designer（P3 角色）做定向修复：`admin.spec.ts:269`（BDD-11）和 `:279`（BDD-12）的 `[data-testid="user-manager-content"]` 选择器加视口 scope 前缀，复用同文件已有的 `scopeOf(vp.name)` helper（与 BDD-01/02 一致写法）
3. 不需要重新走完整 P3 TDD 红灯流程——这是对已有测试文件的选择器订正，不是新功能测试设计，不产生新的 P1 BDD、不改变验收语义
4. 修复后：P4（implementer 确认无需任何代码改动，产品代码不受影响）→ P5（verifier 全量重跑，覆盖仍未验证的 BDD-12）
5. retry 计数：P5 阶段已用 1 次 retry（router.ts 修复那轮），本次 PAUSED 恢复不消耗新的 retry 预算（诊断路由问题不同于常规同阶段重试）

## 引用

- `P5-gate-diagnosis-2.md`（根因分析全文）
- `P5-test-results/e2e.md`（本轮全量重跑原始结果）
