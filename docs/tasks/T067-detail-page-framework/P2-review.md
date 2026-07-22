---
phase: P2
task_id: T067-detail-page-framework
type: review
parent: P2-design.md
trace_id: T067-P2-review-20260723
status: approved
created: 2026-07-23
agent: plan-design-review
---

# P2 Design Review — T067 detail-page-framework

## 评分维度

### 1. 交互状态覆盖率：8/10

**已覆盖**：
- authState loading → Sign in 隐藏（§2.7，v-if="authState === 'anonymous'" 自动排除 loading）
- authState authenticated → Sign in 隐藏（同上）
- zen mode → 品牌字标+Sign in+Explore 隐藏（§2.8，含 [SCOPE+] 发现移动端现有 bug）
- readStats null → reads 不显示（§2.5）
- ≤380px → Sign in icon-only（§2.2）

**未明确覆盖**：
- **entry 加载失败态**：Sign in/品牌字标在 entry 404/error 页面是否显示？当前设计只讨论了 entry 已加载的场景。若 entry 加载失败，sticky-header 仍存在（back-btn 可见），品牌字标和 Sign in 应仍可见——但设计未显式说明。风险低（header 不依赖 entry 数据），但应补充一句。
- **Explore 按钮的 active/hover 态**：桌面端 icon-btn 有 tooltip（§2.1），但 hover/active 视觉反馈未描述。风险极低（复用现有 .icon-btn 样式），不扣分。

**扣分理由**：entry 加载失败态未提及（-2）。

### 2. AI Slop 风险：9/10

**设计约束充分**：
- 品牌字标精确到 font-size: 16px, font-weight: 700, letter-spacing: -0.02em（§2.1）
- 高度约束明确：品牌区域 ≤36px，移动 sticky-header 52px
- CSS 类名已定义：.detail-logo-word, .sticky-brand, .mobile-signin-btn
- reads 格式精确到条件复数模板
- 底栏文案精确到 `<badge>N</badge> files`

**唯一模糊点**：
- §2.2 移动端 Sign in 提出两种实现（BaseButton vs 原生 button），最终选了原生 button 但未说明 BaseButton 为何不适用（只说"简化方案"）。建议补充：BaseButton scoped 样式可能不匹配 ≤380px icon-only 需求，或原生 button 更轻量。风险低（实现时自然确定），扣 1 分。

### 3. 移动端考虑：8/10

**已覆盖**：
- sticky-header 布局明确：back-btn + "PeekView" + sticky-title + Sign in（§2.2）
- ≤380px Sign in icon-only（§2.2）
- bottom-bar Explore 入口（§2.3）
- 底栏文案修正（§2.4）
- zen mode 移动端隐藏（§2.8，[SCOPE+]）

**不足**：
- **sticky-header 拥挤问题**：52px 内放 back-btn(20px) + "PeekView"(~60px) + sticky-title(flex:1) + Sign in(~60px)，在 375px 宽度下 sticky-title 可能只剩 ~235px，但设计未说明标题截断策略（text-overflow: ellipsis 是否已存在？）。代码确认 sticky-title 已有截断，但设计应显式提及。
- **横屏/平板**：640-768px 区间（isMobile=true 但宽度较宽）的布局未单独说明。风险低（flex 布局自适应），但应提及。
- **bottom-bar 按钮数量**：加 Explore 后 bottom-bar 按钮增多（files + Explore + TOC/Wrap + Copy + Share + ···），≤380px 是否溢出？设计未分析。风险中等——需 P4 实现时验证。

**扣分理由**：bottom-bar ≤380px 溢出风险未分析（-1），sticky-title 截断未显式提及（-1）。

### 4. 可访问性：7/10

**已覆盖**：
- back-btn 有 aria-label="Back"（现有）
- Explore 有 title="Explore" + tooltip（§2.1）
- mobile Explore 有 aria-label="Explore"（§2.3）
- BaseButton 有 focus-visible ring（BaseButton.vue:131-134）
- sr-only aria-live for zen mode（现有 line 3）

**不足**：
- **品牌字标无语义标记**：`<span class="detail-logo-word">PeekView</span>` 是纯装饰性 span，无 aria-label 或 role。应考虑：logo+字标的 router-link 已有 title="Back to home"，字标作为链接文本的一部分可被屏幕阅读器读出——但 "PeekView" 作为品牌名与 "Back to home" title 语义冲突。建议：字标用 aria-hidden=true（视觉可见但屏幕阅读器只读 title），或调整 title 为 "PeekView - Back to home"。
- **移动端 Sign in 原生 button 无 aria-label**：§2.2 的原生 button 方案只有文字 "Sign in"（≤380px 变 icon-only），icon-only 时需 aria-label。设计未提及。
- **键盘导航顺序**：桌面端 header 新增 Sign in + Explore，tab 顺序是否合理？设计未说明。风险低（DOM 顺序即 tab 顺序，Sign in 在 ThemeToggle 前），但应提及。
- **颜色对比度**：品牌字标 color: var(--c-text) 在 dark mode 下对比度是否足够？设计未验证。风险低（复用 --c-text 变量，其他文本已验证），但品牌字标 font-weight: 700 可能需要更高对比度。

**扣分理由**：icon-only Sign in 缺 aria-label（-2），品牌字标语义标记未考虑（-1）。

## 总评

| 维度 | 评分 |
|------|------|
| 交互状态覆盖率 | 8/10 |
| AI Slop 风险 | 9/10 |
| 移动端考虑 | 8/10 |
| 可访问性 | 7/10 |
| **加权平均** | **8.0/10** |

## 审查结论

**status: approved** — 设计质量良好，方案 A 选择理由充分，minimal_validation 验证了关键假设。

## 非阻断建议（P4 实现时处理）

1. **[a11y]** 移动端 ≤380px icon-only Sign in 按钮必须加 `aria-label="Sign in"`
2. **[a11y]** 品牌字标 `<span>` 考虑加 `aria-hidden="true"`（router-link 的 title 已提供语义）
3. **[mobile]** bottom-bar 加 Explore 后 ≤380px 按钮数量需验证是否溢出，必要时 Explore 可隐藏文字只留图标
4. **[edge-case]** entry 加载失败时 header 品牌字标+Sign in 仍应可见（header 不依赖 entry 数据），P4 确认
5. **[minor]** §2.2 补充原生 button 替代 BaseButton 的理由（scoped 样式限制 / 更轻量 / 更灵活的 icon-only 切换）
