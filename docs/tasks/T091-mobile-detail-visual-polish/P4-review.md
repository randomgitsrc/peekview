---
phase: P4
task_id: T091-mobile-detail-visual-polish
type: review
parent: P4-implementation.md
agent: design-review
status: approved
---

# P4-review — T091 移动端详情页视觉打磨（design-review）

复核方法：全部结论基于 `git diff` 实际输出与改动后源文件全文核对，不采信 P4-implementation.md 的文字描述。

## 1. EntryMetaTagsBar.vue

**符合。**

- `.meta-tags-bar` padding：`var(--space-2) var(--space-3)` → `var(--space-4) var(--space-4)`，与 P2 第 1 节表格一致。
- `overflow-x: auto` 已删除，替换为 `flex-wrap: wrap`；`grep -n "overflow-x"` 在该文件中无命中，无遗留。

## 2. MarkdownViewer.vue

**符合。**

- mobile 断点（`@media (max-width: 640px)`）`.markdown-body` `padding: 0` → `padding: var(--space-4)`。
- `margin: 0` 未改动，保留为 0（未被换成非零 margin，符合 P2 margin-collapse 风险论证）。

## 3. EntryDetailMobileBar.vue

**符合，逐项核实如下：**

- `.mobile-bottom-bar` padding 基准值 `var(--space-2)` → `var(--space-1)`（L94）；`padding-bottom` 由覆盖式改为叠加式 `calc(var(--space-1) + env(safe-area-inset-bottom, 0px))`（L95），非覆盖式写法，符合方案。
- Copy 按钮（L38-40）：纯图标 `class="icon-btn"`，无文字节点、无 `.tooltip` span（`grep -n tooltip` 在全文件无命中），`<CopyIcon :size="16" />`。`.icon-btn` CSS（L146-159）含 `min-width: 44px; min-height: 44px`。
- Wrap 按钮（L30-37）：`class="toggle-btn"` + `WrapTextIcon`（`:size="16"`）；`active` class 绑定 `{ active: wrapEnabled }`（L31）。`:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"`（L33）与 `:aria-pressed="wrapEnabled"`（L34），逐字符对照同文件 `source-toggle`（L22-23：`:aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"` / `:aria-pressed="sourceViewMode"`）——三元表达式结构、属性顺序（aria-label 先于 aria-pressed）、绑定语法（`:` 前缀）完全一致的写法模式，非"看起来像"。
- `.bottom-btn` / `.bottom-btn.primary`：`grep -n "bottom-btn"` 在改动后全文件无命中，已彻底移除，无遗留死代码。
- data-testid 全量核对（对照改动后文件全文 + P2 第 8 节清单）：`mobile-bottom-bar`（L2）、`mobile-bar-filetree-btn`（L7）、`mobile-bar-toc-btn`（L15）、`mobile-bar-source-toggle-btn`（L24）、`mobile-bar-wrap-btn`（L35）、`mobile-bar-copy-btn`（L38）全部原样保留；`meta-tags-bar`（EntryMetaTagsBar.vue L2）、`markdown-body`（MarkdownViewer.vue L4）另行确认保留；`content-area` 所在文件（EntryDetailContent.vue）本次未改动，testid 自然保留。9 个既有 testid 全部核实存在。

## 4. DESIGN.md

**符合，5 处逐字比对结果：**

对 `git diff -- DESIGN.md` 的新增行与 P2-design.md 第 3 节"修订后"文本逐字符比对（非仅意思核对）：

- 3.1 Container Exception 行：完全一致。
- 3.2 Icon Buttons Selection rule 行：完全一致。
- 3.3 Meta Tags Bar (Mobile) 新增行：完全一致。
- 3.4 Markdown Body Spacing (Mobile) 替换行：完全一致。
- 3.5 Rules 底部栏 padding-bottom 描述行：完全一致。

5 处均为 P2 文本的逐字照抄落地，无改写、无遗漏、无额外增补。

## 5. 测试修正的越权检查（重点）

**未越权，符合"只修正测量目标，未调松判定"的要求。**

对 `git diff frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 和 `git diff frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` 逐行核对：

- **t091 spec**（`test_bdd_3_markdown_body_16px_padding_24px_total_inset`）：diff 只有一处改动——`const mdBox = await md.boundingBox()` 改为先取 `md.locator('> *').first()` 再 `.boundingBox()`。`padding` 断言（`expect(padding).toBe(...)`，未在 diff 中出现，说明未改）与后续两条 `expect(mdBox!.x).toBeGreaterThanOrEqual/toBeLessThanOrEqual(MARKDOWN_TOTAL_INSET_PX ± 2)` 断言语句本身在 diff 中未出现变更行——常量名 `MARKDOWN_TOTAL_INSET_PX` 与 `±2` 容差均未被触碰，只是测量对象从 `md` 换成 `firstChild`。
- **t090 spec**（`test_bdd_8_markdown_mobile_inset_symmetric_24px`）：diff 同样只改测量对象（`md` → `firstChild`），并新增 `contentArea`/`caClientWidth`/`availableRight` 三个中间变量，把 `rightInset` 计算公式里的常量 `viewportWidth(390)` 换成 `.content-area` 的 `clientWidth` 派生值——这是修正"硬编码视口宽度未扣除滚动条宽度"的测量口径错误，不是放宽判定：diff 中未出现的三行断言（`expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(2)`、`expect(leftInset).toBeGreaterThanOrEqual(MARKDOWN_MOBILE_TARGET_INSET_PX - 2)`、`expect(leftInset).toBeLessThanOrEqual(MARKDOWN_MOBILE_TARGET_INSET_PX + 2)`）本身未被修改，容差仍是 `±2`，常量 `MARKDOWN_MOBILE_TARGET_INSET_PX` 未被改动。
- 用 `grep -E "PX|toBeGreaterThan|toBeLessThan|toContain|toBe\("` 对两份 diff 做二次交叉检查，确认阈值/断言语句行均未出现在变更行（`+`/`-` 前缀）中，只有变量声明和数据来源变化。
- 两处改动均未删除任何 `expect(...)` 语句，未新增 `.skip`/`.only`/`try-catch` 吞错等规避手段。
- P3-test-cases.md 第 6 节的自报改动记录（"常量定义、两个 expect 阈值、其余测试均未改动"）与 diff 实测结果一致。

结论：测试修正严格限于"CSS 盒模型测量目标错误"的修正范畴，未触碰任何判定阈值、未删除断言、未引入其他"让测试变绿"的旁路手段。

## 6. 不改什么的核查

**符合。**

- `git diff --stat` 对 `EntryDetailHeader.vue`/`EntryDetailContent.vue`/`ImageViewer.vue`/`HtmlViewer.vue`/`useEntryDetailComputed.ts`/`EntryDetail.vue` 无任何输出（空结果），确认均未被触碰。
- `EntryDetailMobileBar.vue` 的 `defineProps<{...}>()` 块（`canWrap`/`canCopy`/`wrapEnabled`/`isRichRenderable`/`isMultiFile`/`isMarkdown` 等）在 diff 中未出现变更，prop 定义与计算逻辑未变，本次改动仅限模板结构（按钮内部）与 CSS。

## 总结

6 项核对全部符合 P2-design.md 已定方案，测试修正未越权。approved。
