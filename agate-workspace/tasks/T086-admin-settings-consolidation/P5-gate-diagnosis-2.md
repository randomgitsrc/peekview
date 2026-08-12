---
phase: P5
task_id: T086-admin-settings-consolidation
type: gate-diagnosis
trace_id: T086-P5-20260807-retry1
created: 2026-08-07
---

# P5 gate 诊断（第二轮）— BDD-11 真失败，问题源头在 P3 测试代码

## 现象

全量重跑（retry1）证实 P4-retry2 的路由修复生效（BDD-8/9/10 全部真正执行并通过）。但暴露一个新的、独立的真失败：**T086 BDD-11**（`admin.spec.ts:269`，UserMenu → user-manager tab），strict-mode violation：`[data-testid="user-manager-content"]` 命中 2 个元素。BDD-12 因 serial 级联继续被跳过。

## 根因（verifier 已代码核查确认）

`SettingsView.vue` 的桌面 tab-content 和移动端 mobile-stacked 是**两套并存的 DOM 结构**（纯 CSS `display` 切换，非 `v-if`），`UserManagerTab` 在 `isAdmin` 且 `tab=user-manager` 时会被两个容器各渲染一份，两份都在 DOM 里。

`admin.spec.ts` 里 **BDD-01/02（P3 已写）已经用视口 scope（`.desktop-only`/`.mobile-only` 前缀）消歧**这个已知的双渲染模式（P2-review.md Advisory Note #1 专门提醒过，P3 test-designer 在 dispatch-context 里也被要求处理）。但 **T086 BDD-11/BDD-12（P3 新增用例，`admin.spec.ts:269/279`）的选择器漏加了同样的 scope**，直接查全局 `[data-testid="user-manager-content"]`，因而撞上双渲染歧义。

**问题源头判定**：这是 P3 阶段产出的测试代码本身有缺陷（选择器未跟随本文件内已确立的 scope 约定），不是 P4 实现的问题——`git diff` 显示 P4-retry2 只改了 `router.ts`，未碰 `SettingsView.vue`/`UserManagerTab.vue`/`admin.spec.ts`。按 implementer.md 角色定义"不改测试去迁就实现"，这类修复不应由 P4 implementer 代劳；按 test-designer.md 自查要求"测试断言有 bug 应退回 P3 修正"，问题的正确归属是 P3。

## 回退路径判定

当前 phase=P5，目标修复阶段=P3，diff = |5-3| = 2 ≥ 2 → 按 `state-machine.md`"阶段回退规则"表，**跨多阶段回退需 PAUSED 报告人工**，不能自动直接跳转。

## 处置建议（供人工批准）

修复范围很窄、风险很低：`admin.spec.ts:269`（BDD-11）和 `:279`（BDD-12）的 `[data-testid="user-manager-content"]` 选择器加视口 scope 前缀，写法完全复用同文件 BDD-01/02 已验证过的 `scopeOf(vp.name)` 模式（`admin.spec.ts:38` 附近已有该 helper 定义）。不涉及任何产品代码改动，不改变任何验收语义（BDD-11/12 要验证的行为不变，只是选择器精确定位到当前可见的那一份 DOM）。

建议：PAUSED 后由主 Agent 直接派 test-designer（P3 角色）做定向修复，不需要重新走完整 P3 TDD 红灯流程（这是对已有测试文件的选择器订正，不是新功能测试设计）。修复后从 P4（implementer 无需动作，仅确认无代码侧改动需要）依次重跑到 P5（全量重跑 E2E，覆盖仍未验证的 BDD-12）。
