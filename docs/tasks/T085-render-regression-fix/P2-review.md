---
phase: P2
task_id: T085-render-regression-fix
type: review
parent: P2-design.md
trace_id: T085-P2-review-20260802
status: approved
created: 2026-08-02
agent: plan-design-review
---

# P2 设计评审 — T085 详情页渲染回归修复

## 评审范围

- 输入：`P2-design.md`（architect 产出）、`P1-requirements.md`、`P0-brief.md`、`DESIGN.md`
- 角色：plan-design-review（前端设计评审）
- 代码事实核对：useEntryDetailComputed.ts、EntryDetailContent.vue、mime.ts、code.css、markdown.css、MarkdownViewer.vue、useResponsiveLayout.ts、TableView.vue、OverflowMenuDropdown.vue

## 评分维度（0-10）

### 1. 交互状态覆盖率：7/10

**已覆盖的状态**：
- loading（fileLoading skeleton）、error（fileError + parseError banner）、empty（"Select a file"）——这些是已有状态，P2-design 未引入新状态，合理
- P5 下拉框：打开/关闭/选中/键盘导航/外部点击关闭——BDD-9/10/11 覆盖
- P4 滚动：底端边界保护——BDD-8 覆盖

**缺口**：
- **P5 下拉框打开时的焦点管理未明确**：自定义下拉打开后，焦点应移至列表（listbox）还是保留在触发按钮？方向键导航时焦点如何在 option 间移动？BDD-11 只说"键盘改变选项"，但 ARIA 模式（`aria-activedescendant` vs 焦点 roving）未选定。这影响实现细节和 a11y 正确性。建议 P4 实现时参照 OverflowMenuDropdown 的焦点策略并保持一致。
- **P1 SVG 加载失败的 UI 状态未提及**：SVG 走 ImageViewer 后，若 SVG 文件损坏（无效 XML），ImageViewer 的 `loadImage()` 会 `onerror`。P2-design 的 minimal_validation 确认了"浏览器原生支持 SVG data URI"，但未说明损坏 SVG 的降级表现。IM-7 提到"不应因此崩溃"——方案应确认 ImageViewer 已有 onerror 处理（现有行为，不是新增需求，但方案应声明"继承 ImageViewer 现有错误处理，不额外处理"以消除歧义）。

**评分理由**：核心交互路径覆盖充分，但下拉框焦点模式和 SVG 加载失败的降级声明有缺口。不构成 BLOCKER（可在 P4 实现时参照现有模式补齐），但应在方案中明确。

### 2. AI Slop 风险：8/10

**设计约束充分的地方**：
- P1/P2/P4 都是精确的 CSS/computed 改动，改动行数明确（1~15 行），无"随便搞"空间
- P3 padding 数值精确（var(--space-5)=32px / var(--space-4)=16px），对应 DESIGN.md §6
- P5 下拉框有明确参照模式（OverflowMenuDropdown）和选项清单（50/100/500）

**残留风险**：
- **P5 下拉框样式细节未约束**：方案说"参照 OverflowMenuDropdown 模式"，但 OverflowMenuDropdown 是溢出菜单（图标按钮 + 菜单项列表），而 per-page 是"显示当前值 + 箭头 + 选项列表"——视觉形态不同。方案应明确：触发按钮是显示"50 ▾"文字按钮还是图标按钮？选项列表的视觉样式（间距、hover 态、选中态标记）是否复用 OverflowMenuDropdown 的 `.dropdown-item` 类？DESIGN.md §6 Overflow Menus 只说"dropdown on desktop, bottom sheet on mobile"，未给出 per-page 这类内联选择器的规范。建议方案补充：触发按钮文字 + 箭头图标，选项列表复用 `.dropdown-item` 样式模式，移动端不弹 bottom sheet（per-page 是内联控件，不是溢出菜单）。
- **P3 `.markdown-body` 的 `max-width: 900px` 与 `max-width: none` 冲突**：方案 B 在"风险"中识别了此问题但未给出解决方向。markdown.css 第2行全局 `.markdown-body { max-width: none }` 会覆盖 scoped style 的 `max-width: 900px`（全局样式无 data-v 属性但选择器特异性相同时，后加载的全局样式胜出；实际上 scoped style 有 `[data-v-xxx]` 属性加持，特异性更高，应胜出——但方案未验证这一点）。建议方案明确：padding 通过 scoped style 设置（特异性足够），不受全局 `max-width: none` 影响；或验证 Vite scoped style 编译后的选择器特异性。

**评分理由**：大部分方案约束精确，但 P5 视觉形态和 P3 CSS 优先级两个点有模糊空间，可能导向不一致的实现。

### 3. 移动端考虑：7/10

**已考虑的**：
- P3 移动端 padding：var(--space-4)=16px，对应 DESIGN.md §6 "16px mobile"——明确
- P5 触达目标 ≥44px：BDD-10 在移动视口测量——明确
- P4 overscroll-behavior + scroll-hide：移动端触控板/滚轮更易触发弹跳，方案适用

**缺口**：
- **P2 源码视图滚动在移动端的行为未单独验证**：BDD-4/5 只说"内容高度超过视口"，未区分桌面/移动。移动端 content-area padding 更小（8px），CodeViewer 横向滚动 + 纵向滚动的交互可能不同。建议 BDD-4 补充移动视口验证（或声明"flex:1 + min-height:0 是视口无关的 CSS 标准行为，移动端自动适用"）。
- **P5 下拉框在移动端的弹出位置未说明**：DESIGN.md §9 "Overflow menus: dropdown on desktop, bottom sheet on mobile"——但 per-page 下拉框是表格底部的内联控件，不是溢出菜单。方案应声明：移动端 per-page 下拉框仍用下拉（非 bottom sheet），因为它是内联控件且选项仅 3 个。否则实现者可能误套 §9 规则弹 bottom sheet。
- **P5 下拉框弹出列表的 z-index 未约束**：表格内容区有 `overflow-y: auto`（content-area），下拉框弹出列表可能被裁剪。方案应确认弹出列表的定位策略（absolute/fixed）和 z-index（DESIGN.md §4 Z-Index Scale: Dropdowns=100），确保不被 content-area 裁剪。

**评分理由**：P3/P5 核心移动端数值达标，但 P2 移动端验证缺失、P5 下拉框移动端弹出模式和 z-index 未约束。

### 4. 可访问性：6/10

**已考虑的**：
- P5 键盘操作：Enter/Space 打开、方向键导航、Enter 选择、Escape 关闭——BDD-11 覆盖
- P5 ARIA：aria-haspopup="listbox" / role="listbox" / role="option"——声明了
- P5 触达目标 ≥44px——BDD-10 覆盖
- P4 顶端保护强制显示 metaTagsHidden=false——符合"向上滚动显示头部"的用户预期

**缺口**：
- **P5 下拉框选中态的 ARIA 未声明**：`aria-activedescendant`（当前聚焦选项）vs `aria-selected`（选中选项）未区分。WAI-ARIA listbox 模式要求：触发按钮用 `aria-haspopup="listbox" aria-expanded`，listbox 容器 `role="listbox"`，当前选中 option 用 `aria-selected="true"`。方案只列了 role，未列 aria-expanded / aria-selected / aria-activedescendant。
- **P5 焦点陷阱未提及**：下拉框打开后，Tab 键应如何表现？焦点应困在 listbox 内（Tab 不关闭）还是 Tab 关闭并移至下一个控件？WAI-ARIA Authoring Practices 对 listbox 的建议是方向键导航，Tab 移至下一控件。方案未声明。
- **P1 SVG 图片的 alt/无障碍标签未提及**：SVG 走 ImageViewer 后，屏幕阅读器如何描述？ImageViewer 是否给 `<img>` 提供了 alt 属性（用 filename）？这是 ImageViewer 现有行为，但方案应声明"继承 ImageViewer 现有 a11y，不额外处理"以消除歧义。
- **P4 overscroll-behavior 对屏幕阅读器的影响未评估**：overscroll-behavior: none 是纯视觉属性，不影响屏幕阅读器——但方案未声明，实现者可能担心。低风险，建议一句话声明。

**评分理由**：键盘操作和 ARIA role 基础覆盖，但 ARIA 状态属性（aria-expanded/aria-selected/aria-activedescendant）、焦点陷阱、SVG a11y 有缺口。P5 是新交互组件，a11y 要求应更完整。

## 综合评审结论

### 无 BLOCKER

5 个缺陷的修复方向均正确，代码事实核对一致，候选方案权衡充分，选择理由合理。无 CRITICAL 级别问题。

### 需补充项（MINOR，不阻断 P3 推进，但 P4 实现前应明确）

| # | 缺口 | 建议 |
|---|------|------|
| 1 | P5 下拉框焦点模式（aria-activedescendant vs roving）未选定 | 参照 OverflowMenuDropdown 焦点策略，P4 实现时统一 |
| 2 | P1 SVG 加载失败的降级行为未声明 | 方案补一句"继承 ImageViewer 现有 onerror 处理，不额外处理" |
| 3 | P5 下拉框视觉形态（文字按钮+箭头 vs 图标按钮）未约束 | 建议文字按钮显示当前值+箭头，选项列表复用 `.dropdown-item` 样式 |
| 4 | P3 `.markdown-body` CSS 优先级（scoped vs 全局 max-width:none）未验证 | 方案应声明 scoped style 特异性高于全局，或 P4 验证后调整 |
| 5 | P5 下拉框移动端弹出模式（下拉 vs bottom sheet）未声明 | 建议内联下拉（非 bottom sheet），因选项仅 3 个且为内联控件 |
| 6 | P5 下拉框弹出列表 z-index/裁剪风险未约束 | 声明 z-index:100（DESIGN.md §4），定位策略避免被 content-area 裁剪 |
| 7 | P5 ARIA 状态属性（aria-expanded/aria-selected/aria-activedescendant）未声明 | P4 实现时按 WAI-ARIA listbox 模式补齐 |
| 8 | P2 源码视图移动端滚动未单独验证 | 声明"flex 标准 behavior，视口无关，移动端自动适用" |
| 9 | P1 SVG 图片 a11y（alt 属性）未声明 | 声明"继承 ImageViewer 现有 a11y" |

### 门槛判定

- 候选方案 ≥2（每个缺陷均有 A/B 方案 + 权衡 + 选择理由）✓
- 四字段齐全（packages/domains/ui_affected/gate_commands）✓
- gate_commands.P5_e2e 已声明（ui_affected: true）✓
- follows_existing_pattern 声明附理由（P1/P2）✓
- minimal_validation 含验证结果 + 纯代码逻辑声明 ✓
- files_to_read 精准（12 项，含行号和 why）✓
- [SCOPE+] 检查已声明 ✓

### status: approved

方案整体合理、代码事实准确、DESIGN.md 一致性达标。9 项需补充均为 MINOR 级（实现细节澄清），不构成设计缺陷，可在 P4 实现阶段参照现有模式补齐，不阻断 P3 TDD 推进。
