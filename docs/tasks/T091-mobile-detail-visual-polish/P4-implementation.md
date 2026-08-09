---
phase: P4
task_id: T091-mobile-detail-visual-polish
type: implementation
parent: P2-design.md
agent: implementer
---

# P4-implementation — T091 移动端详情页视觉打磨

```yaml
implementation_dir: frontend-v3/src/components
```

（DESIGN.md 位于仓库根，非上述目录，单独说明见下）

## 改动文件清单

| 文件 | 改动内容 |
|---|---|
| `frontend-v3/src/components/EntryMetaTagsBar.vue` | `.meta-tags-bar` padding `var(--space-2) var(--space-3)`(8/12px) → `var(--space-4) var(--space-4)`(16/16px)；`overflow-x: auto` → `flex-wrap: wrap` |
| `frontend-v3/src/components/MarkdownViewer.vue` | mobile 断点（`@media (max-width: 640px)`）下 `.markdown-body` 的 `padding: 0` → `padding: var(--space-4)`（16px），`margin: 0` 保持不变 |
| `frontend-v3/src/components/EntryDetailMobileBar.vue` | ①`.mobile-bottom-bar` padding 基准值 `var(--space-2)`(8px)→`var(--space-1)`(4px)：`padding: var(--space-1) var(--space-3)`；`padding-bottom` 由覆盖式改叠加式 `calc(var(--space-1) + env(safe-area-inset-bottom, 0px))`；②Copy 按钮模板从 `.bottom-btn.primary`（图标+文字，`<CopyIcon :size="14" /> Copy`）改为纯图标 `.icon-btn`（`<CopyIcon :size="16" />`，无文字，不带 `.tooltip` span），新增本地 `.icon-btn` CSS（含 `min-width/min-height: 44px`，以 `EntryDetailHeader.vue:163-166` 为基础加触控热区约束）；③Wrap 按钮模板从 `.bottom-btn`（纯文字 `Wrap`）改为 `.toggle-btn` + `WrapText` 图标（`:size="16"`），`wrapEnabled` 绑定 `active` class，新增 `:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"` 与 `:aria-pressed="wrapEnabled"`（对齐同文件 `source-toggle` 按钮既有写法）；④新增 `WrapText as WrapTextIcon` import；⑤移除 `.bottom-btn`/`.bottom-btn.primary` CSS 定义 |
| `DESIGN.md` | 5 处文字修订：3.1 Container（新增 mobile `.content-area` 例外说明）、3.2 Icon Buttons（新增 `.icon-btn`/`.toggle-btn`/`BaseButton` 选用准则）、3.3 Meta Tags Bar (Mobile)（新增 flex-wrap 说明 + padding 数值）、3.4 Markdown Body Spacing (Mobile)（改为描述 16px padding + 24px 总留白）、3.5 Rules 底部栏 padding-bottom 描述（改为叠加式 calc 公式说明），逐字照抄 P2-design.md 第 3 节"修订后"文本落地 |

## 未改动（按约束）

- `EntryDetailHeader.vue`、`EntryDetailContent.vue`、`ImageViewer.vue`、`HtmlViewer.vue` 未触碰
- `canWrap`/`canCopy`/`wrapEnabled`/`isRichRenderable`/`isMultiFile`/`isMarkdown` 等 prop 计算逻辑未改动
- 全部既有 `data-testid` 保留：`meta-tags-bar`/`markdown-body`/`content-area`/`mobile-bottom-bar`/`mobile-bar-copy-btn`/`mobile-bar-wrap-btn`/`mobile-bar-filetree-btn`/`mobile-bar-toc-btn`/`mobile-bar-source-toggle-btn`
- 测试文件（`frontend-v3/e2e/t09*.spec.ts`）未改动

## 自查结果

- `cd frontend-v3 && npx vue-tsc --noEmit`：**通过**，无输出（无错误），`WrapText` 图标 import 类型检查正常
- `make build-frontend`：**成功**，静态文件已复制到 `backend/peekview/static/`
- `E2E_SPEC=e2e/t09 make debug-test`：**46 passed / 4 failed**（较派发时基线 22 failed/28 passed 大幅改善），4 处剩余失败详见下方 `[DESIGN_GAP]`

## [DESIGN_GAP: markdown-body 左侧 inset 断言的测量方法与 CSS box model 矛盾，导致 4 处测试恒定失败]

**失败测试**（chromium + Mobile Chrome 两个 project 各 2 条，共 4 条）：
- `t090-mobile-detail-ux-polish.spec.ts::test_bdd_8_markdown_mobile_inset_symmetric_24px`
- `t091-mobile-detail-visual-polish.spec.ts::test_bdd_3_markdown_body_16px_padding_24px_total_inset`

**现象**：两条测试都先断言 `getComputedStyle(markdownBody).padding === '16px'`（**这一步通过**，证明我的实现正确应用了 P2 设计的 padding 值），随后断言 `markdownBody.boundingBox().x` 落在 24px±2 区间内（**这一步恒定失败**，实测值稳定为 8px）。

**根因（已用 Playwright CDP 现场验证，非环境/构建问题）**：`getBoundingClientRect()`/`boundingBox()` 返回的是元素自身的 **border-box 位置**，这个位置由**父元素的 padding + 自身的 margin-left** 决定，**不受元素自身 padding 影响**——padding 只会把该元素的**子内容**（文本/子元素）向内推，不会移动该元素自己的框的左边缘。这是标准 CSS 盒模型行为，不是浏览器差异或实现缺陷。

我用 CDP 直接量测 390×844 视口下 `t090-long-markdown` 页面的 `.markdown-body`（`data-testid="markdown-body"`）实际状态：
```json
{ "rect": { "x": 8, "width": 364 }, "padding": "16px", "paddingLeft": "16px", "margin": "0px" }
```
`paddingLeft` 已正确应用为 16px，但 `rect.x` 恒为 8（即 `.content-area` 自身的 mobile 水平 padding `var(--space-2)`），因为 `.markdown-body` 自己的 padding 不会移动它自己的 `boundingBox().x`。视觉上文字确实从 24px 处开始渲染（8px 父padding + 16px 自身padding），但测试选取的测量目标（`markdown-body` 这个元素自身的 box）在 CSS 语义上无法反映这一点——要观测到 24px，需要测量 `.markdown-body` **内部某个子元素**（如第一个文本节点/段落）的 `boundingBox().x`，而不是 `.markdown-body` 自身。

**为什么判定为测试设计矛盾而非实现问题**：
1. `padding` 断言（16px）已经证明 CSS 实现与 P2 设计表格、DESIGN.md 3.4 节修订文字完全一致——`padding: var(--space-4)` 已正确落地
2. `mdBox.x` 这个断言无论换成什么合法的 padding 实现方式（只要 padding 加在同一个被测元素 `markdown-body` 自身上），在标准 CSS 盒模型下永远无法达到 24px——这不是"实现选错了属性/数值"的问题，是这条断言选错了被测量的元素
3. P2-design.md 第 4 节自己写的推导注释（"Total left inset = .content-area's 8px + .markdown-body's 16px = 24px"）在概念上是对的（视觉 inset 确实是 24px），但落到 Playwright `boundingBox()` 这个具体 API 上时，测量对象选错了，这个矛盾是 P2/P3 阶段固化下来的，不是 P4 实现阶段引入的

**未采取的行动**：按派发指引"发现测试断言与 P2 设计有矛盾 → 标 `[DESIGN_GAP: 具体描述]`，不要自行改测试或改设计"，本次未修改任何测试文件，也未改动 CSS 实现去"凑"这个不可能达成的断言（例如换成 margin 会违反 P2 已论证的 margin-collapse 风险原则，且即便换成 margin，`boundingBox().x` 才会真正等于 24px——但这与 P2 第 3.4 节"故意用 padding 不用 margin"的设计决策直接冲突，不应由 P4 单方面决定取舍）。

**建议后续处理方向**（供主 Agent 参考，非本阶段决定）：测试断言应改为测量 `.markdown-body` 内部第一个可见子元素（如 `.markdown-body > *:first-child` 或具体的段落/标题元素）的 `boundingBox().x`，而非 `.markdown-body` 自身，这样才能真实反映"文字视觉起始位置"这一验收意图。

## 其余 46 passed 覆盖范围

包括 EntryMetaTagsBar 的 padding/flex-wrap（BDD-1/2）、EntryDetailMobileBar 的底部栏对称 padding（BDD-4）、Copy 按钮纯图标化+44px 触控热区（BDD-5）、Wrap 按钮 toggle-btn+aria 属性（BDD-6/7）、桌面端无回归（BDD-12/13）、t090 遗留 BDD-7（Wrap active class 断言，已通过）等，两个 viewport project（chromium + Mobile Chrome）均绿。
