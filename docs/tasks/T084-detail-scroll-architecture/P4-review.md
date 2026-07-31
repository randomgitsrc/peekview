---
phase: P4
task_id: T084-detail-scroll-architecture
type: review
parent: P4-implementation.md
trace_id: T084-P4-review-20260731
status: approved
created: 2026-07-31
agent: design-review
---

# P4 Design Review — T084 详情页滚动架构统一

## 审查范围

| 文件 | 审查内容 |
|------|----------|
| `frontend-v3/src/components/MarkdownViewer.vue` | scoped style 移除 height/overflow/padding |
| `frontend-v3/src/styles/code.css` | .code-viewer / .code-body overflow/flex/min-height 改动 |
| `frontend-v3/src/styles/markdown.css` | .markdown-body 全局 padding 移除 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | setupScrollHide 简化 |
| `frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts` | E2E 选择器/滚动方式修正 |
| `DESIGN.md` §9 | Scroll Architecture 小节新增 |

## 检查清单逐项审查

### AI Slop（必查）

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 紫色/violet 渐变 | PASS | grep 全部改动文件，无 #6366f1/#8b5cf6/violet/purple |
| 泛化文案 | PASS | 无 "Unlock the power" / "Get started" 等泛化文案（本次为纯 CSS/composable 改动，无文案变更） |
| 全部居中的布局 | PASS | `.markdown-body` 保留 `max-width: 900px; margin: 0 auto`（P2 方案 A 设计决策，居中参考 `.content-area` content-box），非全部居中 |
| 卡片 grid 同质化 | N/A | 本次无新增卡片/grid 组件 |

### Typography

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 字号层级清晰 | PASS | 本次未改动字号，markdown.css L4-6 H1/H2/H3 字号层级保留（var(--font-xl)/var(--font-lg)/var(--font-md)） |
| 行高/字间距 | PASS | markdown.css L2 `line-height: 1.7` 保留；code.css L78 `line-height: 1.6` 保留 |
| 移动端最小 16px | PASS | 本次未改动字号，既有 `var(--font-sm)` 等设计 token 不受影响 |

### Spacing

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 一致间距 scale | PASS | `.content-area` 保留 `padding: var(--space-4)`（EntryDetailContent.vue L160），移动端 `var(--space-3) var(--space-2)`（L161），均使用设计系统 token |
| 移动端点击区域 44px | PASS | 本次未移除或缩小任何交互元素；meta-tags-bar 隐藏/恢复逻辑未改 CSS 实现（P2 §6 声明保留现状） |

### 交互状态

| 检查项 | 结果 | 证据 |
|--------|------|------|
| hover/focus/active/disabled | PASS | 本次未移除任何交互状态样式。`.code-copy-btn:hover`（MarkdownViewer.vue L356-364）保留；`.front-matter-tag:hover`（L579-582）保留 |
| outline:none 有替代方案 | INFO | `.content-area`（EntryDetailContent.vue L160）有 `outline: none` 但无 `tabindex`——键盘用户本就无法 Tab 聚焦该 div。P2 §6 已明确声明这是既有设计，不在 T084 范围。本次改动**不改变**此行为（改前改后一致），无新增可访问性回归 |
| loading/error/empty state | PASS | `.code-loading`（code.css L138-140, padding: var(--space-4)）+ `.code-skeleton`（L142-146, 含 14px 固定高度子元素）保留，移除 `min-height: 300px` 后 loading 态仍有 ~86px 可视高度（P2 §3 已分析）；`.error-state`/`.empty-state`（EntryDetailContent.vue L170-172）不受本次改动影响 |

## P2 方案对照（实现 vs 设计）

| P2 设计要求 | 实现状态 | 证据 |
|-------------|----------|------|
| `.markdown-viewer` 移除 `height:100%; overflow:auto` | ✅ 完成 | MarkdownViewer.vue L124-128：scoped style 仅剩 `.markdown-body { max-width: 900px; margin: 0 auto; }`，`.markdown-viewer` 规则块整体移除 |
| `.markdown-body` scoped 移除 `padding: 2rem` | ✅ 完成 | MarkdownViewer.vue L125-128：无 padding 声明 |
| `.markdown-body` 全局移除 `padding: var(--space-5)` | ✅ 完成 | markdown.css L2：`.markdown-body { line-height: 1.7; color: var(--text-primary); max-width: none; }`——无 padding |
| 移动端 `.markdown-body` padding 移除 | ✅ 完成 | markdown.css 无 `@media` 规则（L1-26 全文确认） |
| `.code-viewer` 移除 `min-height: 300px; flex: 1` | ✅ 完成 | code.css L2-9：`.code-viewer` 仅保留 `border/border-radius/overflow:hidden/background/display:flex/flex-direction:column`，无 min-height/flex |
| 移动端 `.code-viewer { min-height: 0 }` 移除 | ✅ 完成 | code.css 无 `@media` 规则（L1-162 全文确认） |
| `.code-body` 从 `overflow:auto; flex:1; min-height:0` → `overflow-x: auto` | ✅ 完成 | code.css L38-40：`.code-body { overflow-x: auto; }` |
| `.code-viewer` 保留 `overflow:hidden; display:flex; flex-direction:column` | ✅ 完成 | code.css L5/L7/L8 保留 |
| `setupScrollHide` 移除 `findScrollable` | ✅ 完成 | useResponsiveLayout.ts L26-43：直接监听 container，无 findScrollable/scrollContainer |
| `setupScrollHide` 直接监听 container scroll | ✅ 完成 | useResponsiveLayout.ts L37: `container.addEventListener('scroll', onScroll, { passive: true })` |
| t049 A-BDD-3/4/5: `window.scrollTo` → `.content-area` scrollTop | ✅ 完成 | t049 L62-65（A-BDD-3）、L81-84/L88-91（A-BDD-4）、L122-125（A-BDD-5）均改为 `document.querySelector('.content-area').scrollTop = N` |
| t049 A-BDD-3/4/5: `.header-tags` → `.meta-tags-bar` | ✅ 完成 | t049 L68（A-BDD-3）、L94（A-BDD-4）、L129（A-BDD-5）均改为 `.meta-tags-bar` |
| DESIGN.md §9 新增 Scroll Architecture 小节 | ✅ 完成 | DESIGN.md L268-275：6 条声明，内容与 P2 §7 一致 |

## 发现项

### [INFO] t049 A-BDD-1 仍使用过时选择器 `.header-tags`

  文件：`e2e/t049-mobile-header-diagram-sanitize.spec.ts:31`
  问题：A-BDD-1 测试 `page.locator('.header-tags')` 使用的 class 在组件中不存在（T079 已改为 `.meta-tags-bar`，见 EntryDetailHeader.vue L67）。该测试可能已在静默失败或依赖 `.boundingBox()` 返回 null 的行为。
  定性：**不在 T084 范围内**——P2 设计（L28-29）明确只要求修改 A-BDD-3/4/5（滚动相关），A-BDD-1 是标签截断测试。此为 T079 遗留的过时选择器。
  建议：记录为已知问题，后续 task 修复。不影响 T084 的设计完整性。

### [INFO] `.content-area` 的 `outline: none` 无替代方案

  文件：`frontend-v3/src/components/EntryDetailContent.vue:160`
  问题：`.content-area` 有 `outline: none` 但无 `tabindex`，键盘用户无法 Tab 聚焦该滚动容器。
  定性：**既有设计，非本次引入**——P2 §6 已明确声明不在 T084 范围内添加 tabindex。本次改动不改变此行为（改前改后键盘用户都无法直接聚焦 `.content-area`）。
  建议：如未来需要无障碍增强（tabindex + 方向键滚动），另开 task。

### [INFO] `.code-body :deep(pre)` 保留 `flex: 1`

  文件：`frontend-v3/src/styles/code.css:71`
  问题：`.code-body :deep(pre)` 保留 `flex: 1`——这是 `.code-container`（display:flex）子元素的伸缩，与 `.code-viewer` 的 `flex: 1`（已移除，因 `.content-area` 是 block 容器）不同。
  定性：**正确保留**——P2 §3 明确 `.code-viewer` 保留 `display:flex; flex-direction:column`，`.code-body` 内部的 `.code-container`（L43-46, display:flex）需要 `pre` 的 `flex:1` 来撑满行号列右侧空间。此 `flex:1` 作用域在 `.code-container` 内部，不涉及 `.content-area` 的滚动架构。

## 无 BLOCKER / 无 CRITICAL

本次审查未发现任何视觉或交互层面的 BLOCKER：

1. **视觉一致性**：padding 单层归属（`.content-area`）符合 P2 方案 A 设计，无双层 padding 残留
2. **交互完整性**：hover/focus/copy-btn 等交互状态样式全部保留，无回归
3. **loading 态安全**：移除 `min-height: 300px` 后 skeleton 仍有可视高度（P2 §3 已验证）
4. **横向滚动保留**：`.code-body` 的 `overflow-x: auto` + `.code-body :deep(pre)` 的 `overflow-x: auto` 双层保障完整
5. **AI Slop**：无紫色渐变、无泛化文案、无同质化卡片
6. **Typography/Spacing**：全部使用设计系统 token，无硬编码值引入

所有 [INFO] 项均为既有设计或范围外问题，不影响 T084 的设计完整性。

## 结论

**status: approved**

T084 P4 实现完全遵循 P2 方案 A 设计，6 项文件改动与设计文档逐条吻合。检查清单全部 PASS（AI Slop / Typography / Spacing / 交互状态）。3 个 [INFO] 项均为范围外或既有设计，无 BLOCKER。
