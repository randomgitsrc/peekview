---
phase: P4
task_id: T090-mobile-detail-ux-polish
type: review
parent: P4-implementation.md
trace_id: T090-P4-review-20260809
status: approved
created: 2026-08-09
agent: design-review
---

# P4-review — T090 移动端详情页 UX 打磨（design-review）

## 方法说明

读代码 + 计算为主，辅以 Playwright CDP 实测截图/量测（390×844 移动 viewport，:8888 debug backend，`t090-long-markdown`/`t090-long-code` 两个测试 entry）。本次改动主体是确定性 CSS 定位/间距改动而非新视觉设计，读代码已能判断大部分结论；对"触控热区高度"这一类无法仅靠读 CSS 规则安全下结论的点（需要考虑 line-height 继承链、flex 布局实际渲染盒），用实测量取代估算。截图额外用于交叉验证 spacing/zen-mode 结论。

---

## 逐条发现

`[VISUAL]` 无 AI Slop 引入
  文件：`frontend-v3/src/components/EntryMetaTagsBar.vue:1-41`
  核实：模板/CSS 从 `EntryDetailHeader.vue` 原样迁移（无渐变色、无泛化营销文案、`display:flex` 左对齐非居中、无卡片网格）。CSS 只有 `.meta-tags-bar`/`.owner-link`/`.meta-dot`/`.status-tag` 四类既有 token 化样式（`var(--c-*)`），未引入新配色。截图确认（见下方"截图交叉验证"）视觉与原 header 版本一致，仅位置从 header 移入 content 流。**预期成立，无 AI Slop。**

`[INTERACTION]` 底部栏 Wrap/Copy 按钮实测触控高度 38px，低于 44px 门槛
  文件：`frontend-v3/src/components/EntryDetailMobileBar.vue:140-151`（`.bottom-btn` 规则），使用处 L30-35
  问题：`.toggle-btn`（file-tree/toc/source-toggle 三个图标按钮，L100-113）显式声明 `min-width:44px; min-height:44px`，达标；但 `.bottom-btn`（Wrap/Copy 两个文字按钮）**没有 `min-height` 声明**，仅 `padding: var(--space-1) var(--space-3)`（4px/12px）。CDP 实测（390×844 viewport，`t090-long-code` entry）：`mobile-bar-wrap-btn` 与 `mobile-bar-copy-btn` 的 `getBoundingClientRect().height` 均为 **38px**（`top:797.5, bottom:835.5`），未达 44px。
  定性：`git diff HEAD~1 -- EntryDetailMobileBar.vue` 确认 `.bottom-btn` 规则块本次**未被改动**（仅 `.mobile-bottom-bar` 加了 `position:fixed` 等属性），即这是迁移前就存在的既有差距，不是 T090 引入的回归。但 dispatch-context 第 2 点明确要求核实"按钮宽度估算"之外高度是否也 ≥44px——P2 §1"风险在哪"只估算了整排按钮宽度（300-340px），未验证过 Wrap/Copy 自身高度，本次实测首次坐实这个既有缺口确实存在。
  Fix（建议，供后续任务/backlog，不阻塞本次批准）：`.bottom-btn { min-height: 44px; }`，配合现有 `align-items:center` 即可在不改变视觉尺寸感知的前提下把点击热区补齐到 44px（padding 视觉大小不变，仅内容盒最小高度提升，超出内容部分由 flex 居中留白吸收）。
  是否阻断本次批准：**否**。理由：(1) 未改动的既有代码，非本次 diff 引入；(2) 与本次评审对象（`position:fixed` 定位改造）无因果关系——即便按钮高度不足，`.mobile-bottom-bar` 本身的定位机制、可见性、safe-area 适配均已验证正确；(3) 建议登记为独立 backlog 项跟进，不建议为此单独打回本任务重做。

`[INTERACTION]` `.mobile-bottom-bar` 改为 fixed 后交互态未被破坏
  文件：`frontend-v3/src/components/EntryDetailMobileBar.vue:83-98`（`.mobile-bottom-bar`）、100-157（`.toggle-btn`/`.bottom-btn` 状态类）
  核实：`git diff HEAD~1` 确认本次改动只新增了 `padding-bottom`/`position`/`bottom`/`left`/`right`/`z-index`/`min-height` 七个属性到 `.mobile-bottom-bar` 自身，`.toggle-btn.active`（L115-117）、`.bottom-btn.primary`（L153-157）等状态选择器规则本身未被触碰。`position` 属性只影响布局定位，不影响类选择器命中逻辑，状态切换（active/primary）视觉表现不受影响。CDP 实测滚动前后 `mobile-bottom-bar` 的 `top`/`bottom` 坐标完全一致（均为 `top:780, bottom:844`，等于 `viewportInnerHeight`），证明 fixed 定位稳定生效、未破坏内部按钮渲染。**无回归。**

`[INTERACTION]` `EntryMetaTagsBar` 无需 loading/empty 状态处理，`v-if` 判断得当
  文件：`frontend-v3/src/components/EntryDetailContent.vue:24`（`v-if="isMobile && currentEntry"`）
  核实：组件本身不发起任何异步请求（纯 props 展示），其渲染条件与既有 `EntryDetailMobileBar.vue` 的 `v-if="isMobile && currentEntry"`（L2）完全一致，`currentEntry` 为 `null` 覆盖了 loading/error/empty 三态（`EntryDetailContent.vue:25-41` 的 `fileLoading`/`fileError`/`!currentEntry` 判断链条中，只有 `currentEntry` 非空才会进入正文渲染分支）。P2 §1"风险在哪"也明确讨论并**接受**了这三态下 `content-area` 底部会有多余留白这一次要代价（理由：短暂/低频状态，不产生遮挡）。**处理得当，与 P2 结论一致。**

`[VISUAL]` markdown 移动端边距归零后未见"过度逼仄"
  文件：`frontend-v3/src/components/MarkdownViewer.vue:131-136`；`frontend-v3/src/components/EntryDetailContent.vue:228-233`
  核实：`.content-area` mobile 断点保留 `padding: var(--space-3) var(--space-2)`（12px/8px）不变，`.markdown-body` mobile 断点归零后总水平留白确为 8px（单侧）。特殊内容块各自有独立内部 padding，不依赖 `.markdown-body` 的外层 margin/padding：代码块 `.code-block-wrapper .code-container pre { padding: var(--space-4) }`（16px，`markdown.css` 及内联样式两处一致定义）、表格单元格 `.markdown-body th/td { padding: var(--space-2) var(--space-3) }`（8px/12px，`frontend-v3/src/styles/markdown.css:17`）。这些内部留白独立于 `.markdown-body` 外层归零，不受影响。CDP 截图（`t090-long-markdown`，见下方）确认段落文字未贴边、可读性正常，未见观感上的"过窄"。**符合 P2 §1 预期的正向影响判断。**
  附带发现（非本次评审范围，仅记录不作为 finding）：`frontend-v3/src/styles/markdown.css` 整个文件未被 `main.ts` 或任何组件 `@import`/`import`（已 grep 全仓库确认），是孤儿 CSS 文件，其第 28-30 行 `@media (max-width:640px) { .markdown-body { padding: var(--space-4) } }` 实际未生效，与 `MarkdownViewer.vue` scoped 样式的归零规则不构成真实的运行时冲突（scoped 属性选择器优先级更高，但因为该文件根本未加载，无需依赖优先级判断）。与本次任务无关，不阻塞。

`[VISUAL]` 可访问性影响与 P2-design.md 第 1 节评估结论一致
  文件：`frontend-v3/src/views/EntryDetailView.vue` 顶层模板结构；`EntryDetailContent.vue:23-24`
  核实：实际读取模板确认顶层兄弟顺序 `EntryDetailHeader → EntryDetailBanners → EntryDetailContent(main) → EntryDetailMobileBar → EntryDetailDialogs` 未变；`EntryMetaTagsBar` 落在 `<main class="content-area">` 内第一个子节点（`EntryDetailContent.vue:24`），紧随 `mobile-sticky-header` 之后、正文之前，与 P2 描述的"衔接点不变"一致。`.mobile-bottom-bar` 的 DOM 兄弟位置（Content 之后、Dialogs 之前）同样未变，只是 `position:fixed` 改变视觉呈现位置。**未发现 P2 评估之外的新可访问性回归**，未新增/移除任何 `aria-*`/`tabindex`/`role`。

`[INTERACTION]` zen-mode media query 保护已正确落实并实测生效
  文件：`frontend-v3/src/views/EntryDetailView.vue:249-255`
  代码核实：
  ```css
  .entry-detail.zen-mode :deep(.detail-header),
  .entry-detail.zen-mode :deep(.mobile-sticky-header),
  .entry-detail.zen-mode :deep(.mobile-bottom-bar),
  .entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }
  @media (max-width: 640px) {
    .entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }
  }
  ```
  `display:none` 选择器列表本身未被误改（四个既有目标：detail-header/mobile-sticky-header/mobile-bottom-bar/meta-tags-bar 全部保留），新增的 `padding-bottom` 覆盖规则被正确包在独立的 `@media (max-width: 640px)` 块内，不会误伤桌面端（桌面端 zen-mode 不涉及这几个 mobile-only 元素，`padding-bottom` 覆盖也不会触发）。
  CDP 实测（390×844 viewport，`t090-long-markdown`，聚焦 content-area 后按 `f` 触发 zen-mode）：`.entry-detail` 确认带上 `zen-mode` class；`content-area` 的 `getComputedStyle().paddingBottom` 从默认的 `calc(64px + safe-area)` 变为 **`12px`**（即 `var(--space-3)`）；`mobile-bottom-bar`/`meta-tags-bar` 的 `display` 均变为 `none`。**三者与设计文档描述完全一致，media query 保护确认生效。**

---

## 截图交叉验证

- `t090-long-code` mobile 视图：底部栏 Wrap/Copy 视觉尺寸观感正常（未见"过小"的直观视觉突兀感，问题仅在精确像素测量下才浮现，属于精细化触控体验问题而非明显视觉缺陷）
- `t090-long-markdown` mobile 视图：meta-tags-bar（`14h ago · 18 reads · Public`）随内容流出现在标题下方，无跳变感；长文档滚动到底部时最后一段文字完整可见、未被 fixed 底部栏遮挡（`content-area` 的 `padding-bottom` 补偿生效）

---

## dispatch-context 5 项重点检查项核实结论

1. **AI Slop 检查**：成立，无渐变色/泛化文案/居中布局引入，`EntryMetaTagsBar.vue` 是原样迁移。
2. **Spacing（含触控热区）**：`.content-area` 8px 水平内边距未见过度逼仄（代码块/表格有独立内部 padding 兜底）；底部栏图标按钮（file-tree/toc/source-toggle）44×44px 达标；**Wrap/Copy 文字按钮实测高度 38px 未达 44px**——已量化确认，但为迁移前既有代码、非本次 diff 引入，建议登记 backlog 而非打回本任务。
3. **交互状态**：`position:fixed` 改造未破坏 hover/active/primary 等既有状态选择器（CSS 属性新增不影响类选择器命中）；`EntryMetaTagsBar` 的 `v-if` 判断与既有 `EntryDetailMobileBar` 一致，loading/error/empty 三态处理得当（留白代价已在 P2 明确接受）。
4. **可访问性落实情况**：与 P2-design.md 第 1 节结论一致，DOM 顶层顺序/meta-bar 挂载点相对位置均未变化，无新增可访问性回归。
5. **zen-mode media query 保护**：代码核实 + CDP 实测双重确认，`@media (max-width:640px)` 正确包裹 `padding-bottom` override，`display:none` 选择器列表未被误改，桌面端不受影响。

---

## 结论

未发现 BLOCKER。发现 1 项非阻断性 `[INTERACTION]` 问题（Wrap/Copy 按钮触控高度 38px < 44px），确认为迁移前既有代码、与本次 `position:fixed` 改造无因果关系，不建议因此打回本任务，建议登记为独立 backlog 项。其余 4 项重点检查 + AI Slop/可访问性/zen-mode 保护均核实通过，与 P2-design.md 描述一致。

**Status: approved**
