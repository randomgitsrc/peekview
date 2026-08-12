---
phase: P2
task_id: T084-detail-scroll-architecture
type: review
parent: P2-design.md
trace_id: T084-P2-review-20260731
status: approved
created: 2026-07-31
agent: plan-design-review
---

# P2 设计评审（复审轮）— T084 详情页滚动架构统一

## 复审总结

| 维度 | 首轮评分 | 复审评分 | 变化 |
|------|----------|----------|------|
| 交互状态覆盖率 | 7/10 | 9/10 | +2 |
| AI Slop 风险 | 8/10 | 9/10 | +1 |
| 移动端考虑 | 6/10 | 9/10 | +3 |
| 可访问性 | 5/10 | 8/10 | +3 |

**结论：approved**

首轮 1 CRITICAL + 5 MAJOR + 3 MINOR，architect 已全部修订。逐条验证如下。

---

## 上一轮修改项逐条验证

### BLOCKER #1: BDD-08 与方案 A 硬冲突 → ✅ 已修复

**首轮问题**：原 BDD-08 要求 `.content-area` paddingTop=0px、padding 由 `.markdown-body` 承担，与方案 A（`.content-area` 保留 padding、`.markdown-body` 移除 padding）硬冲突。

**修订验证**：
- P1-requirements.md L132 + L134 [SCOPE+] 修订说明：BDD-08 验收条件已改为 `.markdown-body` paddingTop=0px，padding 由 `.content-area` 单层承担。
- P2-design.md §2 L181：显式引用 [SCOPE+]，声明「方案 A 与修订后 BDD-08 完全一致——方案 A 保留 `.content-area` 的 `var(--space-4)` padding，移除 `.markdown-body` 的 scoped + 全局 padding」。
- P2-design.md 实现标志 #5 L400：同步更新为「`.markdown-body` computed `paddingTop` 为 `0px`，padding 由 `.content-area` 单层承担（BDD-08，[SCOPE+] 修订后）」。

三方一致（P1 BDD-08 ↔ P2 §2 padding 分析 ↔ P2 实现标志 #5），BLOCKER 消除。

### MAJOR #2: `.code-viewer` 的 `overflow: hidden` 保留声明 → ✅ 已修复

**首轮问题**：`.code-viewer` 改后仍含 `overflow: hidden`（圆角裁剪用途），但设计正文和「不改什么」表未显式声明，P4 implementer 可能误删。

**修订验证**：
- 「不改什么」表 L43：新增行「`.code-viewer` `overflow: hidden` | 保留——圆角裁剪用途（`border-radius: var(--radius-md)` 需要 `overflow: hidden` 裁剪子元素溢出）。仅移除 `min-height: 300px; flex: 1`，`overflow: hidden` 不动」。
- §3 L220 改后结构图：标注「`.code-viewer` (display:flex; flex-direction:column; **overflow:hidden**) ← 移除 min-height + flex；**overflow:hidden 保留（圆角裁剪）**」。
- L44 补充声明 `.code-viewer` 的 `display: flex; flex-direction: column` 也保留。

双重声明（表 + 结构图），P4 implementer 不会误删。

### MAJOR #3: loading 态 `.code-viewer` 高度行为 → ✅ 已修复

**首轮问题**：移除 `min-height: 300px` 后 loading 态 `.code-viewer` 可能塌陷为 0，设计未声明。

**修订验证**：
- §3 新增「loading 态高度行为分析（评审 MAJOR #3）」小节（L239-246）。
- 量化分析：`.code-loading` padding（16px×2=32px）+ skeleton 行高（14px）≈ 46px + `.code-header` ≈ 40px = 总计约 86px。
- 结论：不会塌陷为 0，有可视反馈（skeleton 动画 + header）。
- 移动端场景补充：86px 在 640px 视口占比约 13%（改前 300px 占 47%），可接受——loading 是短暂过渡态。
- 「不改什么」表 L45 同步声明 `.code-loading` / `.code-skeleton` 不改及理由。

量化分析充分，结论合理。

### MAJOR #4: 移动端短代码视觉影响评估 → ✅ 已修复

**首轮问题**：短代码空旷仅针对桌面端讨论，移动端视口更小视觉占比变化更大，未评估。

**修订验证**：
- §3 新增「移动端短代码视觉影响评估（评审 MAJOR #4）」小节（L248-254）。
- 关键发现（L253-254）：移动端 `.code-viewer` 当前已是 `min-height: 0`（code.css L14-18 媒体查询 `@media (max-width: 1023px) { min-height: 0 }` 覆盖），即移动端当前已经是自然高度——本次改动对移动端短代码视觉**无实际行为变化**。
- 桌面端量化：1080p 视口从 28% 降到 11%。
- 可接受理由三条：(1) P1 已决定不覆盖主观空旷；(2) 不影响功能；(3) 移动端无实际变化。

关键发现「移动端无实际行为变化」彻底消除了首轮关切——移动端 `min-height: 0` 媒体查询早已覆盖 `min-height: 300px`，移除两者对移动端是 no-op。分析扎实。

### MAJOR #5: `.content-area` 键盘可聚焦性 → ✅ 已修复

**首轮问题**：`.content-area` 有 `outline: none` 但未确认是否有 `tabindex`，键盘用户能否聚焦/方向键滚动未声明。

**修订验证**：
- §6 新增「`.content-area` 键盘可聚焦性」小节（L323-328）。
- 声明现状：`.content-area` 有 `outline: none` 但**无 `tabindex`**，是普通 `div`，键盘用户无法 Tab 聚焦。
- 声明本次改动：不修改 `tabindex`，添加 `tabindex` 是独立无障碍增强不在本 task 范围。
- 声明影响：改前改后键盘可聚焦性不变，页面滚动仍可通过 PageUp/PageDown 或聚焦内容中可交互元素后方向键导航。
- 明确「如未来需要无障碍增强，另开 task」。

声明清晰，范围边界明确。对于纯 CSS + composable 简化的改动，不在本 task 内添加 `tabindex` 是合理决策。

### MAJOR #6: meta-tags-bar 隐藏方式及焦点路径影响 → ✅ 已修复

**首轮问题**：meta-tags-bar 隐藏方式（`opacity` / `display` / `max-height`）未声明，对 Tab 焦点路径的影响未评估。

**修订验证**：
- §6 新增「meta-tags-bar 隐藏方式及焦点路径影响」小节（L330-339）。
- 声明隐藏方式：`.meta-tags-bar.hidden { max-height: 0; padding: 0; overflow: hidden; border-bottom: none; opacity: 0; }`——**不是 `display: none`**。
- 焦点路径影响分析：`.meta-tags-bar` 内含可交互元素（`<router-link>` owner-link、`<BaseTag>` 标签链接），隐藏时仍在 DOM 中理论上可聚焦（`display: none` 才会移出 tab 序列），但 `max-height: 0; overflow: hidden` 使其不可见不可点击，键盘 Tab 会遇到「不可见焦点」问题。
- 声明本次改动：不修改隐藏方式，只改 `setupScrollHide` 的**触发机制**（从 `findScrollable` 改为直接监听 `.content-area`），不改隐藏的 CSS 实现。
- 明确「不可见焦点问题是既有设计（T079 引入），不在本 task 范围。如需修复应改用 `display: none` 或 `visibility: hidden` + `aria-hidden`，另开 task」。

分析完整，区分了「触发机制改动」（本 task）与「隐藏 CSS 实现」（既有设计，不改），焦点路径影响定位到既有问题而非本次引入。

---

## 附加检查

### MINOR 项验证

首轮 3 个 MINOR（error/empty 状态声明、触摸横向滚动、`prefers-reduced-motion`）：

1. **error/empty 状态**：「不改什么」表 L46 新增 `.error-state` / `.empty-state` 行，声明不在 CSS 改动范围，滚动架构改动不影响这两态渲染。**已修复**。

2. **触摸横向滚动**：§3 横向滚动保留分析（L225-230）声明 `.code-body` 的 `overflow-x: auto` + `.code-body :deep(pre)` 的 `overflow-x: auto` 双层保障。首轮 MINOR #8 标注「当前代码可能已有相关声明」，本次改动不涉及 `-webkit-overflow-scrolling` / `overscroll-behavior` 属性，`overflow-x: auto` 在移动端触发原生触摸横向滚动，不受影响。**可接受**。

3. **`prefers-reduced-motion`**：§6 新增 `prefers-reduced-motion` 小节（L347-350），声明现状不检查 `prefers-reduced-motion`，本次不修改 motion 相关逻辑，如需增强另开 task。**已修复**。

### §6 可访问性小节完整性

§6 新增的可访问性小节覆盖了首轮评审要求的 4 个子项：
- `.content-area` 键盘可聚焦性 ✅
- meta-tags-bar 隐藏方式及焦点路径影响 ✅
- 屏幕阅读器体验（scroll-hide 状态变化 + 锚点跳转）✅
- `prefers-reduced-motion` ✅

每个子项都明确区分「现状」「本次改动」「声明（不在范围内）」「未来增强路径」，范围边界清晰。

### BDD 覆盖交叉对照（复审）

| BDD | P2 设计覆盖 | 状态 |
|-----|------------|------|
| BDD-01 (markdown 滚动) | §1 方案 A + 实现标志 #3/#4 | ✅ |
| BDD-02 (code 滚动) | §1 方案 A + §3 + 实现标志 #3/#4 | ✅ |
| BDD-03 (横向滚动) | §3 横向滚动保留分析 | ✅ |
| BDD-04 (移动端 scroll-down hide) | §4 setupScrollHide 简化 | ✅ |
| BDD-05 (移动端 scroll-up restore) | §4 setupScrollHide 简化 | ✅ |
| BDD-06 (桌面端不触发) | §4 + P1 isMobile 逻辑 | ✅ |
| BDD-07 (TOC 锚点) | §5 TOC 锚点跳转修复原理 | ✅ |
| BDD-08 (移动端 padding) | §2 padding 归属决策 + [SCOPE+] 一致性确认 | ✅ **冲突已消除** |
| BDD-09 (HtmlViewer iframe) | 「不改什么」表 IR-1 | ✅ |
| BDD-10 (ImageViewer 图片) | 「不改什么」表 IR-1 | ✅ |
| BDD-11 (vitest 全绿) | 实现标志 #7 + gate_commands.P5 | ✅ |
| BDD-12 (typecheck) | 实现标志 #8 + gate_commands.P5_typecheck | ✅ |
| BDD-13 (build) | 实现标志 #9 + gate_commands.P5_build | ✅ |
| BDD-14 (DESIGN.md) | §7 DESIGN.md 补充内容 | ✅ |

**14/14 BDD 全部覆盖，无冲突。**

### 四字段检查（复审）

| 字段 | 状态 | 说明 |
|------|------|------|
| packages | ✅ | `frontend-v3` |
| domains | ✅ | `frontend` |
| ui_affected | ✅ | `true` + ui_interaction_points 6 项 |
| gate_commands | ✅ | P3/P5/P5_typecheck/P5_build/P5_e2e 齐全 |

### minimal_validation 检查（复审）

- 首轮已确认：CDP 降级为 CSS 规范分析合理，引用 CSS Overflow Module Level 3 §3.1 正确
- 复审无变化，不阻塞

---

## 维度评分更新

### 维度一：交互状态覆盖率（7→9/10）

首轮缺失 loading/error/empty 三态声明。复审：
- loading 态：§3 量化分析 86px 不塌陷 ✅
- error 态：「不改什么」表显式声明 ✅
- empty 态：「不改什么」表显式声明 ✅
- 扣 1 分：触摸横向滚动的移动端体验仅通过 `overflow-x: auto` 标准行为推断，未实测确认（合理——P6 做真实验证）。

### 维度二：AI Slop 风险（8→9/10）

首轮 §2 padding 分析有方向性错误（与 BDD-08 矛盾）。复审：
- [SCOPE+] 修订后 §2 padding 分析方向正确，与 BDD-08 一致 ✅
- `.code-viewer` `overflow: hidden` 保留双重声明（表 + 结构图）✅
- 扣 1 分：方案 B 的选择理由中「方案 B 需要为 CodeViewer 新增 padding」表述准确但未说明方案 B 的 `.code-viewer` padding 是否会与 `overflow: hidden` + `border-radius` 冲突（不影响推荐方案 A 的选择，仅方案 B 描述完整性）。

### 维度三：移动端考虑（6→9/10）

首轮 BDD-08 硬冲突 + 移动端短代码未评估。复审：
- BDD-08 冲突消除（[SCOPE+] 修订）✅
- 移动端短代码视觉影响评估含关键发现（移动端已是 `min-height: 0`，无实际变化）✅
- loading 态移动端占比分析（13%）✅
- 扣 1 分：移动端 padding 从 40px 降到 8px 的视觉变化幅度较大，设计声明可接受但未在 BDD 中设置验收条件确认移动端内容宽度不溢出（BDD-08 只验 padding 值，不验内容宽度）。

### 维度四：可访问性（5→8/10）

首轮完全未提及可访问性。复审：
- §6 新增完整可访问性小节，覆盖键盘可聚焦性 + 隐藏方式焦点路径 + 屏幕阅读器 + `prefers-reduced-motion` ✅
- 每个子项明确区分现状/本次改动/范围外声明/未来增强路径 ✅
- 扣 2 分：(1) 不可见焦点问题（meta-tags-bar 隐藏时 Tab 可聚焦到不可见元素）虽声明为既有设计，但本 task 修改了 scroll-hide 触发机制，可能改变隐藏频率从而加剧焦点问题——设计未评估此交互影响；(2) 锚点跳转后屏幕阅读器不朗读跳转目标，声明「不新增 aria-live」合理但未说明是否应在跳转目标添加 `tabindex="-1"` + `focus()`（这是让屏幕阅读器跟随跳转的标准做法，声明「另开 task」可接受但评分扣分）。

---

## 最终判定

**status: approved**

首轮 1 CRITICAL BLOCKER（BDD-08 硬冲突）+ 5 MAJOR + 3 MINOR，architect 已全部修订：

- BLOCKER #1：[SCOPE+] 修订 BDD-08，§2 显式引用确认一致，实现标志 #5 同步 → 三方一致
- MAJOR #2：`.code-viewer` `overflow: hidden` 保留在「不改什么」表 + §3 结构图双重声明
- MAJOR #3：loading 态量化分析 86px 不塌陷，含移动端占比
- MAJOR #4：移动端短代码关键发现——移动端已是 `min-height: 0`，本次无实际变化
- MAJOR #5：`.content-area` 键盘可聚焦性声明，范围边界明确
- MAJOR #6：meta-tags-bar 隐藏方式声明（`max-height: 0 + opacity: 0`），焦点路径影响分析

14/14 BDD 全部覆盖无冲突，四字段齐全，minimal_validation 合理。设计文档改动边界精确到行号 + 改前改后 CSS 对照，P4 implementer 上下文充分。可进入 P3。
