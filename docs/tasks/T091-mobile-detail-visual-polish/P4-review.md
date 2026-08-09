---
phase: P4
task_id: T091-mobile-detail-visual-polish
type: review
parent: P4-implementation.md
agent: design-review
status: approved
revised: P4 重试 #1（P6 视觉验收退回后的定向修复复核，20260809）
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

## 总结（首次实现，approved，已归档保留供追溯）

6 项核对全部符合 P2-design.md 已定方案，测试修正未越权。approved。

---

## P4 重试 #1 复核（P6 视觉验收退回后的定向修复）

### 复核背景

P6 verifier 用真实场景（`.content-area` 可滚动）复测发现 BDD-2/BDD-9 FAIL：`EntryMetaTagsBar.vue` 的 scoped `.meta-tags-bar` 规则未显式声明 `overflow-x`/`white-space`，被 `frontend-v3/src/styles/layout.css:466-478` 的遗留全局同名规则级联覆盖（`overflow-x: auto` 隐含把 `overflow-y` 提升为 `auto`），导致高度坍缩到 33px。orchestrator 已用 CDP 独立复测确认 33px→89px 修复生效。implementer 本轮改动：`frontend-v3/src/components/EntryMetaTagsBar.vue` 的 `.meta-tags-bar` 规则新增 `overflow-x: visible; white-space: normal;` 两条声明。

### 1. 改动本身的正确性

**符合。** `git diff frontend-v3/src/components/EntryMetaTagsBar.vue` 实测结果：

```diff
- .meta-tags-bar { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-4) var(--space-4); background: var(--c-surface); border-bottom: 1px solid var(--c-border); font-size: var(--font-xs); color: var(--c-text-secondary); flex-wrap: wrap; }
+ .meta-tags-bar { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-4) var(--space-4); background: var(--c-surface); border-bottom: 1px solid var(--c-border); font-size: var(--font-xs); color: var(--c-text-secondary); flex-wrap: wrap; overflow-x: visible; white-space: normal; }
```

整个 diff 只有这一行、只新增了 `overflow-x: visible; white-space: normal;` 两条声明，前面已有的 `display`/`align-items`/`gap`/`padding`/`background`/`border-bottom`/`font-size`/`color`/`flex-wrap` 九条声明字符级未变。选择器（`.meta-tags-bar`）本身未变，未新增/删除其他规则块。与 P4-implementation.md "P4 重试 #1"一节声明的改动完全一致。

### 2. 越权改动核查

**未越权，符合约束。**

`git diff --stat`（工作区未暂存改动）实测只有 3 个文件：

```
backend/peekview/static/index.html                  |  2 +-
docs/tasks/.../P4-implementation.md                  | 45 +++++++++++++++++
frontend-v3/src/components/EntryMetaTagsBar.vue      |  2 +-
```

- `EntryMetaTagsBar.vue`：本轮目标文件，见上节。
- `P4-implementation.md`：文档追加说明（"P4 重试 #1"一节），非代码。
- `backend/peekview/static/index.html`：仅 `<script>` 引用的构建产物文件名哈希变化（`index-BFOmZ8bq.js` → `index-DEjEcz5o.js`），是 `make build-frontend` 重新打包的预期副作用，不是人工改动，不构成越权。
- `git diff` 对 `MarkdownViewer.vue`/`EntryDetailMobileBar.vue`/`DESIGN.md`/`frontend-v3/src/styles/layout.css` 均无输出（空结果），确认上一轮已 approved 的 3 个文件与 `layout.css` 全局规则本身均未被触碰。`layout.css:466-478` 读取核对，内容与 dispatch-context 引用的原文逐字一致，未被修改。
- 未发现测试文件（`frontend-v3/e2e/t09*.spec.ts`）改动，符合"本轮不涉及测试设计变更"的约束。

### 3. 改动理由的技术合理性

**站得住脚，无引入新副作用。**

- **`overflow-x: visible` 覆盖 `overflow-x: auto`**：CSS 规范中，若 `overflow-x`/`overflow-y` 任一为非 `visible` 值，另一个原本为 `visible` 的会被浏览器提升为 `auto`（用于让滚动容器行为一致）。全局规则显式设了 `overflow-x: auto`，而两处规则均未显式设置 `overflow-y`（默认 `visible`），于是 `overflow-y` 被隐式提升为 `auto`，改变了该 flex 容器在内容溢出时的高度计算行为，实测表现为坍缩到 33px。scoped 规则显式声明 `overflow-x: visible` 后，`overflow-x`/`overflow-y` 均为 `visible`，不再触发提升，恢复容器随内容自然撑高的行为——与 89px 实测结果吻合，解释成立。
- **CSS specificity 保证覆盖生效**：Vue `<style scoped>` 编译后选择器变为 `.meta-tags-bar[data-v-xxxxxxxx]`（属性选择器叠加，specificity 从 (0,1,0) 提升到 (0,2,0)），高于 `layout.css` 里普通类选择器 `.meta-tags-bar`（(0,1,0)），因此无论源码顺序如何，scoped 规则的声明必然覆盖全局规则的同名属性，不依赖"后声明覆盖先声明"的层叠顺序运气。
- **`white-space: normal` 覆盖 `white-space: nowrap`**：全局规则的 `nowrap` 会强制该 flex 容器内的文本节点不换行，与 `flex-wrap: wrap`（控制 flex item 是否换行到下一行）是两个独立机制——`nowrap` 不直接阻止 flex-wrap 生效，但会影响容器内长文本内容（如 `owner-link`/标签文字过长时）不能在词内换行，二者共同作用可能导致视觉上的"文字被截断观感"。显式设为 `normal` 恢复默认文本换行行为，与 BDD-1"内容超长时自然换行"的预期一致。
- **子元素副作用核查**：`white-space` 是可继承属性。检查 `.meta-tags-bar` 的子元素样式定义——`owner-link`（本文件 L36）、`meta-dot`（L37）、`status-tag`（L38-40）均未显式声明 `white-space`，`BaseTag.vue`（`meta-tag`/标签芯片的实现）的 `.base-tag`/`a.base-tag` 规则同样未声明 `white-space`。因此这些子元素会继承父容器新的计算值 `normal`，行为从"强制不换行"变为"默认换行"——由于这些子元素内容都是短文本（用户名、时间、单个标签词），实际视觉上不会产生可见差异，但语义上更符合预期，未发现会导致意外换行/布局错乱的副作用。
- **未越权改动全局规则**：`layout.css` 里的 `.meta-tags-bar` 规则原样保留，符合"最小改动、只在 scoped 规则里覆盖，不动全局规则本身（可能仍被其他非 scoped 场景依赖）"的既定约束。

### 4. P4-implementation.md 追加内容真实性核查

**真实反映改动，非凭空数字。**

- "P4 重试 #1"一节（L68-111）里贴出的 diff 代码块与 `git diff` 实际输出逐字符一致（见本文件第 1 节核对）。
- 文档给出的 11 个 entry 的 offsetHeight 对比表：6 个此前受影响的 entry（`markdown-test?firstFileId=18`/`xml-maven-pom`/`python-entry-service`/`csv-employees`/`tsv-server-metrics`/`plantuml-arch`）"修复前 33px → 修复后 89px"，与 `.retreat-history.md` 归档的 P6 原始 FAIL 数据（33px、`overflowX: auto`、`whiteSpace: nowrap`）及 dispatch-context 引用的 orchestrator 独立复测数据（同为 33px→89px）两处独立来源交叉一致，非该文档单方面自报的孤证。5 个此前未受影响的 entry（`markdown-test` 默认文件/`json-api-config`/`yaml-docker-compose`/`svg-standalone`/`mermaid-charts`）标注"89px 未受影响"，与改动本身只新增覆盖声明、不影响不触发级联冲突路径的场景这一技术逻辑相符，无回归风险的表述站得住脚。
- xml-maven-pom Search 框重叠现象核查结论（"同一根因的视觉表现之一，非独立 bug，随修复消失，无需 DESIGN_GAP"）有明确核查动作描述（重新截图 + vision-engine 独立视觉分析），且与本节第 3 点的技术解释（33px 坍缩必然导致第二行标签被推出可视区域、进而与下方 Search 输入框产生视觉重叠）逻辑自洽，未见强行"应该也修好了"的未经查证断言。
- 自查结果（vue-tsc 通过、build-frontend 成功）与本次复核环境观察一致（`backend/peekview/static/index.html` 的构建产物哈希已更新，证明确实执行过 build）。

### 总结

改动精确（1 处 CSS 规则新增 2 条声明，无越权改动）、技术解释成立（CSS specificity + overflow 隐式提升 + white-space 继承链均核实无误、无新增副作用）、文档记录真实可信（与两处独立数据源交叉验证一致）。**approved。**
