---
phase: P0
task_id: TPV0103
task_name: time-format-mainline
trace_id: TPV0103
created: 2026-11-11
status: pending
parent: TPV0102（推翻其 P0 决策 1.3 的「强制带时区名」）
---

# P0-brief — TPV0103 时间主显格式修正（去时区偏移 + 去秒）

## task

**修正 TPV0102 引入的时间主显格式**——这是对**已发布行为**的修正，不是新功能。

现状（v0.27.0 已上线）：卡片/列表/详情页时间主显为 `2026/11/10 GMT+8 17:43:00`。

改为：主显 **`2026/11/10 17:43`**（去时区偏移、去秒），时区信息**全部留在悬停 tooltip**（已有 `just now · 2026/11/10 17:43:00 GMT+08:00 · Asia/Shanghai`）。

## 需求来源与决策推翻声明

**这不是用户新增的需求，是修正 TPV0102 P0 决策 1.3 的错误。**

TPV0102 立项时（commit `620a0749` 的 orchestrator-log）我写下：

> DECISION: 时间显示采用「靠浏览器时区 + **强制带时区名**」而非引入服务端配置——用户选定。带时区名是消除"这是哪里的时间"歧义的最小手段，无需任何配置

用户在看到 v0.27.0 实际效果后质疑：**「这样的 GMT+8 字符串应该出现在普通用户界面上么？为什么我看其他网站都没有这样的表达形式？」**

**该质疑成立，理由如下**（三条，均为可验证的推理而非偏好）：

1. **「消除歧义」的前提不成立**：主显时间由浏览器时区决定，**就是用户本地的现在时间**。用户看自己的手表时间不需要标注时区——不存在"这是哪里的时间"的歧义。
2. **「无需配置」不构成选择理由**：所有候选方案（含无时区名方案）都无需配置，该属性无区分力。
3. **`GMT+8` 是机器可读格式，不是人读格式**：ISO 8601 / HTTP Date header 需要偏移，因为要在**无上下文**下传输；用户界面有浏览器时区这一上下文，偏移成为噪音。业界参照：GitHub / Gmail / Twitter 等界面的时间主显**均不带时区偏移**。

**我的错误性质**：把"信息完备性"（机器可读的要求）套用到人读的界面，且**未对标任何真实产品**就定了这个硬要求。

## 已确认的设计决策

### 决策 1：主显格式

```
主显：2026/11/10 17:43            ← 去时区名、去秒
悬停：just now · 2026/11/10 17:43:00 GMT+08:00 · Asia/Shanghai   ← 保持不变
```

**去秒的理由**：秒对"这个 entry 什么时候发的"无信息量，是噪音；且秒的存在使提示与主显显得不一致（tooltip 保留秒是合理的，因为它是"精确时间"）。

**去时区名的理由**：见上方三条。

**为什么 tooltip 保留完整偏移 + IANA 名**：跨时区协作场景（如看同事的 entry）需要知道对方时区，而 hover 是**主动查询**动作，此时信息完备性有价值——这与主显的"扫视"场景性质不同。

### 决策 2：实现方式（保持既有约束）

TPV0102 P0 已实测确立的约束继续有效：
- `dateStyle`/`timeStyle` 与 `timeZoneName` **不能共存**（`TypeError`）→ 必须逐字段写
- 时区名位置**随 locale 变** → **禁止字符串拼接**，整体交给 `toLocaleString`

本次改动**只是"少传一个 `timeZoneName`、少传 `second`"**，仍走 `toLocaleString`，不改架构。

**实测确认的输出形态**（主 Agent 已用 `Asia/Shanghai` + `2026-11-10T09:43:00Z` 实跑）：

| locale | `toLocaleString` 去掉 `timeZoneName` 与 `second` 后 |
|---|---|
| `zh-CN` | `2026/11/10 17:43` |
| `en-US` | `11/10/2026, 05:43 PM`（12 小时制） |
| `ja-JP` | `2026/11/10 17:43` |
| `de-DE` | `10.11.2026, 17:43` |
| `undefined`（跟随系统，本机 zh） | `2026/11/10 17:43` |

**正则验证**：`zh-CN` 输出对 `/GMT|UTC|[+-]\d/` **无命中** → 确认去时区名后不再含任何偏移标识。

**若需强制 24 小时制**：加 `hour12: false` → `en-US` 变为 `11/10/2026, 17:43`。但**建议不加**——那会覆盖用户的 locale 习惯，与"靠浏览器"的决策本意相悖。

> ⚠️ **en-US 是 12 小时制**——去掉秒和时区名后，en-US 用户看到 `11/10/2026, 05:43 PM`。这是 `toLocaleString` 的正常行为（跟随 locale 的 12/24 小时制偏好），**不是缺陷**。需在 P1 决定是否接受（建议接受：跟随浏览器习惯正是"靠浏览器"决策的本意）。

### 决策 3：范围（严格）

| 改 | 不改 |
|---|---|
| `useRelativeTime.ts` 的 `formatFullDate`（主显） | `formatTooltip`（悬停，保持完整信息） |
| 受影响的断言（`GMT±N` 相关） | 相对时间逻辑（`3h ago` → `3h` 已由 TPV0102 定型） |
| BDD-01/03/04/26 的判据 | 文件数显隐 / 可见性菜单 / 0 文件空态 |
| `upgrading.md` 追加一条 | 后端 / API / MCP（零改动） |

## 影响面（主 Agent 已实测）

**生产代码**：`frontend-v3/src/composables/useRelativeTime.ts`（约 3 行）。

**测试断言**（**这是必须走 agate 而非 hotfix 的关键原因**，主 Agent 已 grep 确认）：

| 文件 | `GMT±N` / `秒级` 相关断言数 |
|---|---|
| `frontend-v3/src/components/__tests__/time-display.spec.ts` | 6 |
| `frontend-v3/src/composables/__tests__/useRelativeTime.spec.ts` | 6 |
| `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts` | 6 |
| `frontend-v3/src/__tests__/filter-tabs.test.ts` | 4 |
| `frontend-v3/src/__tests__/expired-warning.test.ts` | 4 |
| **合计** | **26 处** |

**涉及的验收判据**：BDD-01（主显含 `GMT±N`）、BDD-03（三处一致）、BDD-04（`17:43:00` 字面量）、BDD-26（seed 体验路径），外加 VC-1/VC-3 等视觉契约。

> **hotfix 判据不满足**：T074 先例的 hotfix 标准是「≤3 行改动 **+ 现成测试覆盖**」。本次生产代码虽约 3 行，但**测试本身就是判据的一部分**（26 处断言要反向改），hotfix 会变成"自己改标准 + 自己判通过"。故走 agate。

## 关键约束

- **纯前端展示层**：无 schema / 无 API / 无权限变更 → `risk_level: low`
- **沿既有模式**：`useRelativeTime.ts` 结构不变，只调参数 → `follows_existing_pattern`
- **已发布行为变更** → CHANGELOG `[Unreleased]` + `upgrading.md` 追加 + **P8 bump（patch 还是 minor 由 P8 判，见下）**
- **必须保留 tooltip 的完整信息**（`GMT+08:00 · Asia/Shanghai`）——那是本次改动的"配套"，不是被移除物
- 三处渲染点（卡片 / 列表 / 详情页桌面 / 详情页移动）共用 `TimeDisplay.vue`，改一处全生效

## 验收基线（BDD 倾向，P1 细化）

1. Given 任意 entry When 看卡片/列表/详情页时间 Then 主显**匹配 `YYYY/MM/DD HH:mm` 形态**（或 locale 等价形态），且**不含** `GMT` / `±N` / 时区名
2. Given 同上 When 悬停 Then tooltip **仍含**相对时间 + 完整偏移（`GMT+08:00`）+ IANA 时区名
3. Given `Asia/Shanghai` 时区下 `2026-11-10T09:43:00Z` When 看主显 Then 显示 `17:43`（+8 小时，**不含秒**）
4. Given 任意 locale When 看主显 Then 不带时区偏移标识（`zh-CN` / `en-US` 均验证）
5. Given 三处渲染点 When 对比主显 Then 格式一致

## 已知风险

- **en-US 12 小时制**：去掉秒/时区名后 en-US 显示 `11/10/2026, 05:43 PM`。P1 需确认接受（建议接受，符合"靠浏览器"本意），否则需强制 `hour12: false`（会违背 locale 跟随）
- **BDD-04 的字面量脆弱性**：TPV0102 已踩过（硬编码 `17:43:00` 在 en-US 下必假 FAIL）。本次改完后 `17:43` 同样随 locale 变（12h 制下是 `05:43`）→ **P3 写断言时必须用形态匹配 + 固定 locale**，不能硬编码
- **`upgrading.md` 的版本号**：本次是对 v0.27.0 的修正，若判 patch 则 `v0.27.0 → v0.27.1`；若判 minor 则 `→ v0.28.0`。**P8 定**，P1 不预定
- **26 处断言的反向修改**：易漏（TPV0102 曾漏掉 `EntryListRow.spec.ts` 一处致静默丢覆盖点）→ P3 需穷举清单 + P7 逐条核对

## 裁剪倾向

- P0：本文件
- P1：**不可裁**（BDD 判据反转，必须重建验收标准并评审）
- P2：**不可裁但可简化**——`follows_existing_pattern: [frontend-v3/src/composables/useRelativeTime.ts]` + `design_trivial` 候选，但仍需 ≥1 候选方案 + 影响面梳理 + UI 设计节（`ui_affected: true`）
- P3：**保留**——`formatFullDate` 有明确可单测行为（形态断言），26 处断言的更新必须经 TDD 红灯确认
- P4：不可裁
- P5：不可裁
- P6：**不可裁**（UI 改动，30→本次 BDD 数的截图 + vision）
- P7：**保留**（26 处断言 + 3 处渲染点 + 决策推翻声明跨 4 个文件）
- P8：**保留**（已发布行为变更 → CHANGELOG + upgrading + bump）
