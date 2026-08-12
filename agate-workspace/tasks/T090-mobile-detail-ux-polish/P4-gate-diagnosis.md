---
phase: P4
task_id: T090-mobile-detail-ux-polish
type: diagnosis
author: main
created: 2026-08-09
---

# P4 诊断 — implementer 报告的 2 处 [DESIGN_GAP]

implementer 严格实现了 P2 候选 3-A（不改 `.content-area`），自查 E2E 10/12 通过，2 条失败已标 `[DESIGN_GAP]` 交主 Agent 决策，不擅自改测试或改设计。逐一诊断：

## DESIGN_GAP 1：BDD-8 测试公式与基线定义口径不一致（非设计缺陷，是 P1/P3 计量口径 bug）

**根因确认**（读源码验证）：
- `t090-mobile-detail-ux-polish.spec.ts:8`：`MARKDOWN_MOBILE_BASELINE_INSET_PX = 40`
- `spec.ts:308-312`：`totalInset = leftInset + rightInset`（**左右两侧相加**），与 `40` 相除得比例

`40` 这个数字的历史来源（P0-brief.md → P1-requirements.md 一路沿用）始终是**单侧**层叠值：`content-area(8px) + markdown-body margin(16px) + markdown-body padding(16px) = 40px`（一侧的三层叠加，非左右相加）。P1-requirements.md BDD-8 的 Then 子句括号里"即降至约 10px 或更小"这个目标值同样是按单侧口径反推的（`40 × 25% = 10`，且 P2 §2 候选 3-A 的选择理由原文写的是"归零后总量 8px，缩减 80%"——8px 正是单侧 content-area 剩余 padding，不是两侧之和）。

但 BDD-8 Then 子句的**文字表述**写成了"左右两侧间距之和相对当前基线（约 40px）缩减"——字面读是"两侧相加的值"与"40"比较，这在语义上要求两侧之和的基线应为 80（40×2），而不是 40。P3 test-designer 忠实按字面实现了"两侧相加"的测量方式（`leftInset+rightInset`），但基线常量沿用了"单侧 40"，两者口径不匹配，导致（40-16)/40=60%，不达标；而候选 3-A 的真实物理效果按单侧口径算是 (40-8)/40=80%，按两侧口径算是 (80-16)/80=80%——**只要分子分母口径一致，两种算法结果都是 80%，远超 75% 门槛**。60% 是纯粹的口径不一致导致的假失败，不是候选 3-A 未达标。

**结论：这不是设计问题，候选 3-A 物理上已达标（80% 缩减）。是 P1 BDD-8 文字表述与其自身已建立的"单侧"计量惯例不一致，P3 测试忠实照抄了有歧义的文字，产生了口径错配的 bug。**

**处理方式（已批准，不改设计、不改 P1 语义，只做澄清 + 修 test）**：
1. `[BASELINE_CHANGE]`：在 P1-requirements.md BDD-8 后追加一条澄清注释（不改动 Given/When/Then 原文语义），明确"基线 40px / 目标 10px 均为单侧计量口径，与 P0-brief/P2 一贯口径一致；不是左右两侧数值相加"。这是消歧义的补充说明，不是推翻原有验收意图。
2. 修正 E2E 测试：`totalInset` 改为单侧测量（`leftInset`，因页面/组件左右对称，测左侧即可代表单侧值），不再对 `leftInset+rightInset` 求和后与单侧基线比较。

## DESIGN_GAP 2：BDD-6 file-tree 选择器歧义（纯 P3 测试代码 bug，与本次实现无关）

`page.getByText(/^Files ·/)` 命中两个元素：`EntryDetailContent.vue` 抽屉头部的 `<span>Files · 2</span>` 与 `FileTree.vue` 组件内部自带的 `<h3>Files · 2</h3>`（`FileTree.vue:9`，T090 之前就存在的既有代码，本任务未触碰）。implementer 已用截图确认抽屉功能本身正常打开，纯粹是测试选择器定位范围过宽导致 strict-mode 冲突。

**处理方式（已批准，纯测试代码修复，不涉及 BDD/设计）**：把选择器收窄到 `.drawer-header` 范围内（如 `page.locator('.drawer-header').getByText(/^Files ·/)`），排除 `FileTree.vue` 内部同名文本干扰。

## 决策摘要

两处均为 P3 测试代码的口径/选择器 bug，不反映实现或设计缺陷，不需要回退到 P2 重新设计、不需要重派 implementer 改代码。派发定向修订：P1-requirements.md 追加消歧义注释（[BASELINE_CHANGE]，不改语义）+ E2E 测试两处代码修复，随后重跑全部 12 条确认 12/12 转绿。

## 追加诊断（第 1 轮修复后新暴露）：BDD-6 copy 步骤卡在 `role="status"` 断言

修复选择器歧义后，BDD-6 测试真正执行到了 copy 按钮这一步，暴露出被 strict-mode 失败掩盖的第三个问题：测试断言"复制后出现 `role="status"` toast"，但读源码确认 `useEntryDetailComputed.ts:80-84` 的 `copyContent()` 只调用 `navigator.clipboard.writeText()`，从未调用 `toast.show(...)`（`toast` 在该文件里只用于 `downloadPack` 的成功/失败提示）。核对 `EntryDetailHeader.vue:36-37`、`EntryDetailMobileBar.vue:33-34` 两处 copy 按钮，桌面端和移动端均无任何视觉反馈（无 toast、无图标切换）——**这是 T090 之前就存在的既有行为，不是本次改动引入的回归**（T090 未触碰 `copyContent` 逻辑）。

BDD-6 原文要求"各按钮触发的功能与改动前一致"，不是"必须有 toast 反馈"。P3 test-designer 在设计断言时假设了一个实际不存在的 toast 反馈机制（可能是参照 `OverflowMenuSheet.vue` 场景误推广），这是测试断言与既有行为不符的 bug，不是需求缺口——不需要新增 toast 实现（那会是超出 T090 范围的功能增强，[SCOPE+] 需要用户确认，而非必需项）。

**处理方式（已批准）**：把 copy 步骤的断言从"等待 `role=status` 可见"改为验证剪贴板实际内容（项目里 `frontend-v3/e2e/viewer.spec.ts:71-84`/`structured-data-viewer.spec.ts:246-251`/`html-render.spec.ts:212-217` 均已有此标准写法：`context.grantPermissions(['clipboard-read','clipboard-write'])` + `page.evaluate(() => navigator.clipboard.readText())` 校验内容），与项目既有测试惯例一致，真实反映"复制功能是否生效"。
