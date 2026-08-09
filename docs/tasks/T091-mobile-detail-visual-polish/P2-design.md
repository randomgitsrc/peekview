---
phase: P2
task_id: T091-mobile-detail-visual-polish
type: design
parent: P1-requirements.md
trace_id: T091-P2-20260810
status: draft
created: 2026-08-10
agent: architect
---

# P2-design — T091 移动端详情页视觉打磨

> 本任务的 5 处修复方案（meta-tags-bar padding/wrap、markdown-body padding、底部栏 padding bug、Copy/Wrap 图标化、DESIGN.md 文字同步）已在 P0-brief/P1 阶段与用户逐条讨论定型。本设计文档不重新探索候选方案，只做「已定型方案 → 正式设计文档」的转译，重心是影响域声明、`files_to_read`/`gate_commands` 固化、Image/HtmlViewer 例外场景的 minimal_validation 核实、DESIGN.md 精确修订文字、以及 T090 遗留 E2E spec 的处理决定。

## 0. candidate_count

```yaml
candidate_count: 1
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
```

**为什么只写 1 个候选**：P1-requirements.md 第 5 节已声明 `follows_existing_pattern: [EntryDetailHeader.vue, EntryDetailMobileBar.vue]`，Copy 图标化对齐 `EntryDetailHeader.vue` 已有的 `.icon-btn`（L36-38/163-166），Wrap 图标 toggle 对齐 `EntryDetailMobileBar.vue` 自身已有的 `source-toggle`/`.toggle-btn`（L18-27/100-113）；meta-tags-bar/markdown-body/底部栏 padding 三处是纯 CSS 数值调整（用户已在会话内拍板具体像素值），不存在架构选型空间；Image/HtmlViewer 例外场景经本轮 minimal_validation 核实无遮挡问题，同样落回 `follows_existing_pattern`（不改动挂载位置/高度计算方式）。5 个子改动共享同一个设计原则（复用已有 CSS 类/已有交互模式，不新建变体），因此作为单一候选方案呈现，而非人为拆成多个大同小异的"候选"制造稻草人。

## 1. 影响域分析

### 改什么

| 文件 | 改动 |
|---|---|
| `frontend-v3/src/components/EntryMetaTagsBar.vue` | `.meta-tags-bar` padding `var(--space-2) var(--space-3)`(8px/12px) → `var(--space-4) var(--space-4)`(16px/16px)；`overflow-x: auto` → `flex-wrap: wrap` |
| `frontend-v3/src/components/MarkdownViewer.vue` | `@media (max-width: 640px) .markdown-body` 的 `padding: 0` → `padding: var(--space-4)`（16px），`margin: 0` 保留不变 |
| `frontend-v3/src/components/EntryDetailMobileBar.vue` | ①`.mobile-bottom-bar` padding 基准值 `var(--space-2)`(8px)→`var(--space-1)`(4px)，`padding-bottom` 由覆盖式改叠加式 `calc(var(--space-1) + env(safe-area-inset-bottom, 0px))`；②Copy 按钮模板从 `.bottom-btn.primary`（文字+蓝底）改为纯图标 `.icon-btn`，新增本地 `.icon-btn` CSS class（含 `min-width/min-height: 44px`）。**不新增 `.tooltip` span**——移动端无 hover 交互语义，且本组件内既有的 file-tree/toc/source-toggle 三个 `.toggle-btn` 同样不带 tooltip，保持组件内一致性；③Wrap 按钮模板从 `.bottom-btn`（纯文字）改为 `.toggle-btn` + `WrapText` 图标（`wrapEnabled` 绑定 `active` class）。**新增 `:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"` 与 `:aria-pressed="wrapEnabled"`**（对齐同文件内 `source-toggle` 按钮既有模式，L22-23：`:aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"` / `:aria-pressed="sourceViewMode"`）——现状 Wrap 按钮无任何 `aria-label`，可访问名称完全依赖按钮内可见文字节点，图标化后若不显式补充会丢失全部可访问名称，这是真实的可访问性回归，不是审美问题；④移除不再使用的 `.bottom-btn`/`.bottom-btn.primary` CSS 定义 |
| `DESIGN.md` | 5 处文字修订，见第 3 节 |
| `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` | 手术式修改 BDD-7（Wrap active 态断言 class 名）、BDD-8（markdown-body inset 目标值），见第 4 节 |
| `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts`（新增） | 承载本任务 13 条新 BDD 的 E2E 覆盖，见第 4 节 |

### 不改什么

- `EntryDetailHeader.vue`——只读参照 Copy `.icon-btn` 视觉基准，本次不改动此文件本身
- `EntryDetailContent.vue`——只读参照，`.content-area` 挂载结构与 mobile padding（`var(--space-3) var(--space-2)` = 12px/8px，其中水平 8px 是 P0-brief 讨论的"content-area 8px"所指）保持不变，`EntryMetaTagsBar` 仍是其内第一个子元素，不引入第二个滚动容器
- `ImageViewer.vue` / `HtmlViewer.vue`——只读参照，`height: 100%; overflow: hidden` 滚动架构例外机制不变。minimal_validation（见第 2 节）已确认 meta-tags-bar 嵌入内容流对这两种 viewer 无遮挡/挤压/滚动冲突，故不调整其高度计算方式或 meta-tags-bar 挂载位置
- 全部既有 `data-testid`：`mobile-bar-wrap-btn`、`mobile-bar-copy-btn`、`meta-tags-bar`、`markdown-body`、`content-area`、`mobile-bottom-bar`、`mobile-bar-filetree-btn`、`mobile-bar-toc-btn`、`mobile-bar-source-toggle-btn` 等——**本次改动只变按钮内部结构（去文字/加图标）与 CSS class，显式声明不移除、不重命名任何既有 `data-testid`**，否则 T090 遗留 E2E 会普遍失效
- `canWrap`/`canCopy`/`wrapEnabled`/`isRichRenderable`/`isMultiFile`/`isMarkdown` 等 prop 计算逻辑（定义在父组件/`useEntryDetailComputed.ts`）——本次不改变任何触发条件，只改被触发后的视觉呈现
- `.icon-btn`/`.toggle-btn` 跨组件统一——`EntryDetailMobileBar.vue`（本次新增本地 `.icon-btn`）、`EntryDetailHeader.vue`、`OverflowMenu.vue` 各自 scoped 定义、不完全一致（不同 min-height 约束），本任务只保证 `EntryDetailMobileBar.vue` 内新增的 `.icon-btn` 自身 44×44 达标，不做跨组件重构（P0-brief 已声明超出范围）
- `BaseButton` 两档尺寸（40px/34px）均不满足 44px 触控线的缺口——不修，记入 roadmap

### 风险

1. **T090 遗留 E2E 断言与新行为直接冲突**：`t090-mobile-detail-ux-polish.spec.ts` 的 BDD-7 测试断言 Wrap 按钮点击前后 class 从不含 `'primary'` 变为含 `'primary'`（`toContain('primary')`）——Wrap 改用 `.toggle-btn`+`active` 后这个断言会恒定失败，必须同步改（已在第 4 节处理，不属于事后发现的[SCOPE+]，是 P0-brief 已预见并要求本次一并处理的遗留测试维护工作）。BDD-8 测试断言 markdown-body 左右总留白相对 40px 基线的缩减比例 `>=0.75`（即目标 `<=10px`）——T091 把留白从 0px 加回 16px（总 24px），与 T090 当初"越小越好"的验收方向直接相反，这条断言的**前提**（不是阈值微调）已被本任务废止，必须重写而非沿用（已在第 4 节处理）
2. **Copy 图标 size 从 14 改为 16**：现状 `<CopyIcon :size="14" /> Copy`，桌面端 `EntryDetailHeader.vue` 用 `size="16"`。改图标化后为与桌面端视觉完全对齐（BDD-5 要求），一并把 size 改为 16——这是本设计明确的一致性改进，不是遗漏，P4 不应误判为"未按设计实现"
3. **meta-tags-bar 高度随内容变化**：`flex-wrap: wrap` 后容器高度依赖标签数量，BDD-2 的 71px 阈值是专为 `markdown-test` 标定的下限（非全局固定期望值），P1 已声明此适用范围限制，P4/P6 不应把 71px 当作所有 entry 的通用断言值
4. **`.icon-btn` 本地重复定义**：新增的本地版本与 `EntryDetailHeader.vue`/`OverflowMenu.vue` 的 scoped 版本视觉相近但不完全一致（min-height 约束不同），属于已知技术债，不在本任务修复范围（见"不改什么"）

## 2. minimal_validation

```yaml
minimal_validation:
  assumption: "meta-tags-bar 以 var(--space-4) padding + flex-wrap 嵌入 .content-area 内容流后，对 ImageViewer/HtmlViewer 两个 height:100%;overflow:hidden 的滚动架构例外场景不会造成遮挡/挤压/滚动冲突"
  method: |
    上一轮 architect 因 API 额度上限中断前，主 Agent 已亲自用 Playwright CDP page.addStyleTag 实时注入 T091 目标 CSS
    （padding:16px 16px; overflow-x:visible; flex-wrap:wrap），在 html-csp-test（HtmlViewer）与 svg-standalone
    （ImageViewer，经源码核实为实际可用的 ImageViewer 例外场景 entry）两个 entry 上测量 getBoundingClientRect()。
    本轮 architect 复核方式：重读 useEntryDetailComputed.ts L29-34 确认 isImage 对 mime==='image/svg+xml' 直接
    返回 true（SVG 走 ImageViewer 而非常规文档流，构成 BDD-10 的技术路径依据）；核实 lucide-vue-next 具名导出
    确实存在 WrapText（frontend-v3/node_modules/lucide-vue-next/dist/cjs/lucide-vue-next.js:227）。未重新执行
    CDP 截图——主 Agent 提供的实测数据已足够判定，本轮不重复跑。
  result: confirmed
  note: |
    html-csp-test（HtmlViewer 例外场景）：.html-viewer 实测 top:157 height:623；meta-tags-bar 实测
    height:89 bottom:157 —— viewerTop(157) === metaBottom(157)，两者衔接处无重叠无遮挡，overflow:hidden
    正常生效，viewer 可用高度 623px 在 844px 视口下合理，未被压缩到不可用尺寸。

    svg-standalone（作为 BDD-10 Image viewer 例外场景的实际测试 entry，替代 P1-requirements.md BDD-10 原文
    写的 "image-gallery 或 product-screenshots"）：当前 debug 环境下这两个原计划 entry 均不可用——
    product-screenshots 实际文件是 README.md+logo.svg，无真实二进制图片，不会路由到 ImageViewer；
    image-gallery 在当前 debug-quick 灌入的 16 个公开 entry 中不存在（seed-data 目录里有但未被灌入或为私有）。
    svg-standalone 是当前唯一真实可用、且经源码核实确实路由到 ImageViewer 的选择。实测：.image-viewer
    height:623 top:157，与 html-csp-test 数值完全一致，无重叠无遮挡。这一 entry 替换不构成 [BASELINE_CHANGE]：
    P1 BDD-10 原文措辞留了"或"的余地，测试 entry 的具体选择本来就是 P2/P4 该定的实现细节，不是 P1 需求本身
    的变化——BDD-10 验证的是"ImageViewer 例外机制"这一技术路径，不是"图片"这一内容类型本身。

    结论：两种滚动架构例外场景实测均无遮挡/挤压/滚动冲突，follows_existing_pattern 成立——沿用 T090 已确定
    的 meta-tags-bar 嵌入内容流机制，不需要为 Image/HtmlViewer 做任何特殊处理（不调整挂载位置、不调整
    height:100%;overflow:hidden 的计算基准）。
```

其余部分（meta-tags-bar padding/wrap、markdown-body padding、底部栏 padding 叠加修复、Copy/Wrap 图标化）均为纯 CSS/模板改动，无外部系统依赖，不需要独立的 minimal_validation——影响仅限浏览器 CSS 渲染（flex-wrap/padding/`env()` 计算），这些是 CSS 规范定义明确的标准行为，不属于"浏览器安全模型/外部库核心能力"范畴。

## 3. DESIGN.md 精确修订文字（5 处）

### 3.1 L104-114 Container（新增 content-area 例外说明，对应 P1 [SUGGEST-2]）

**修订前**（L111-114）：
```
### Container
- **Max width**: 1120px for marketing; 1280px for functional views.
- **Padding**: 32px desktop, 16px mobile.
- **Centered** with `margin: 0 auto`.
```

**修订后**：
```
### Container
- **Max width**: 1120px for marketing; 1280px for functional views.
- **Padding**: 32px desktop, 16px mobile.
- **Centered** with `margin: 0 auto`.
- **Exception**: the detail page's `.content-area` intentionally uses `var(--space-3) var(--space-2)` (12px/8px) on mobile instead of the 16px general rule — kept deliberately tight because `MarkdownViewer` and `EntryMetaTagsBar` each add their own inner padding on top of it (see "Markdown Body Spacing (Mobile)" and "Meta Tags Bar (Mobile)" below), bringing the effective total inset to 24px. This is a scoped, deliberate override, not a violation of the general container rule.
```

### 3.2 L158-160 Icon Buttons（补充判断准则，对应 P1 [SUGGEST-1]）

**修订前**：
```
### Icon Buttons
- Use `.icon-btn` (square) or `.toggle-btn` (with active state). Tooltip on hover.
- Toggle badge: small dot indicator on top-right corner.
```

**修订后**：
```
### Icon Buttons
- Use `.icon-btn` (square) or `.toggle-btn` (with active state). Tooltip on hover.
- Toggle badge: small dot indicator on top-right corner.
- Selection rule: a persistent-state icon action (has an on/off state the user needs to perceive, e.g. wrap toggle, source view toggle) uses `.toggle-btn`; a stateless one-shot action (e.g. copy) uses `.icon-btn`; any action with a text label uses `BaseButton`. Do not invent new button variants (e.g. a bespoke `.bottom-btn`) to sidestep this rule — see "Buttons" above ("No new variants without design review").
```

### 3.3 L218-219 Meta Tags Bar (Mobile)（补充换行说明）

**修订前**：
```
### Meta Tags Bar (Mobile)
- On mobile detail page, the metadata/tags bar (`EntryMetaTagsBar`) is a normal in-flow element rendered as the first child of `.content-area`, scrolling together with the viewer content. Visibility is determined purely by scroll position in the document flow — no independent show/hide toggle bound to scroll direction.
```

**修订后**：
```
### Meta Tags Bar (Mobile)
- On mobile detail page, the metadata/tags bar (`EntryMetaTagsBar`) is a normal in-flow element rendered as the first child of `.content-area`, scrolling together with the viewer content. Visibility is determined purely by scroll position in the document flow — no independent show/hide toggle bound to scroll direction.
- Content wraps naturally (`flex-wrap: wrap`) rather than forcing a single line with horizontal scroll — the bar grows taller instead of clipping or scrolling horizontally when username + timestamp + read count + visibility badge + tags exceed the viewport width. Padding: `var(--space-4) var(--space-4)` (16px/16px).
```

### 3.4 L221-223 Markdown Body Spacing (Mobile)

**修订前**：
```
### Markdown Body Spacing (Mobile)
- Desktop: `.markdown-body` uses `padding: var(--space-5)` (24px), centered with `max-width: 900px`.
- Mobile (≤640px): `.markdown-body` has no additional margin/padding of its own — horizontal inset comes solely from `.content-area`'s mobile padding (`var(--space-2)`, 8px), avoiding the triple-layer stacking (content-area + margin + padding) that previously produced ~40px of total inset per side.
```

**修订后**：
```
### Markdown Body Spacing (Mobile)
- Desktop: `.markdown-body` uses `padding: var(--space-5)` (24px), centered with `max-width: 900px`.
- Mobile (≤640px): `.markdown-body` has `margin: 0; padding: var(--space-4)` (16px). This stacks with `.content-area`'s mobile horizontal padding (`var(--space-2)`, 8px) for a total inset of 24px per side, deliberately restored after the zero-padding version produced a cramped, edge-to-edge reading experience. Using padding only (no margin) avoids the triple-layer stacking (content-area + margin + padding, ~40px) that a margin-based approach would reintroduce, since `.content-area` is not a flex container and adjacent block-level margins would collapse unpredictably.
```

### 3.5 L267 Rules — fixed bottom bar padding-bottom 描述

**修订前**（L267 完整行）：
```
- Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile (`position: fixed; bottom: 0`, `padding-bottom: env(safe-area-inset-bottom, 0px)` for safe-area compatibility; `.content-area` reserves matching bottom clearance via `--mobile-bar-height`).
```

**修订后**：
```
- Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile (`position: fixed; bottom: 0`, `padding: var(--space-1) var(--space-3)` with `padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom, 0px))` — additive rather than replacing the base padding, so padding-top and padding-bottom stay symmetric (4px/4px) on devices without a safe area, and gain the safe-area inset on top of the 4px base where one exists; `.content-area` reserves matching bottom clearance via `--mobile-bar-height`).
```

## 4. T090 遗留 E2E spec：处理决定

**决定：两者都做**——①对 `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 做外科手术式修改（只改 2 处被新行为直接证伪的断言，不碰其余测试）；②新增独立文件 `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` 承载本任务 13 条新 BDD。

**理由**：

1. **必须改 t090 spec 的原因**：BDD-7（`test_bdd_7_wrap_button_toggles_non_markdown_non_html`，L285-303）断言 Wrap 按钮点击前 class 不含 `'primary'`、点击后含 `'primary'`（`expect(classBefore).not.toContain('primary')` / `expect(classAfter).toContain('primary')`）。T091 把 Wrap 从 `.bottom-btn`（`wrapEnabled && 'primary'`）改为 `.toggle-btn`（`{ active: wrapEnabled }`）后，这两个断言在改动后代码上会**恒定失败**（class 里再也不会出现 `'primary'`）。这不是测试环境问题，是断言字面文本与新代码结构不兼容，必须同步改为检查 `'active'` class，否则该测试永久红灯，且会误导后续维护者以为是新代码有 bug。
   BDD-8（`test_bdd_8_markdown_mobile_margin_reduced_75_percent`，L305-326）断言 markdown-body 左侧 inset 相对 40px 基线的缩减比例 `>= 0.75`（即目标 `leftInset <= 10px`）。T091 把 mobile padding 从 0 加回 16px，总 inset 变为 24px，缩减比例只有 `(40-24)/40 = 0.4`，同样恒定失败——而且这不是阈值需要放宽的问题，是**T091 的设计目标方向与 T090 当初的验收方向相反**（T090 追求"越小越好"，T091 追求"回到 24px 才是舒适留白"），必须重写断言逻辑本身（改为校验 `leftInset ≈ rightInset ≈ 24px` 的对称性+定值），而不是简单调低阈值百分比。
   BDD-6（`test_bdd_6_bottom_bar_markdown_buttons_functional`，L240-283）：基于 `data-testid` 定位点击 + 校验剪贴板内容，未依赖 class/文字断言，图标化后**无需修改**，验证仍然有效。
2. **为什么不是"整个文件重写"或"整个文件不动"**：BDD-6 及 t090 spec 中其余与本次改动无关的测试（多文件抽屉、375px 无溢出、桌面端回归等）依然是有效的回归保护，删除或大改整个文件会丢失这些既有覆盖；但放着 BDD-7/8 两处不改，T090 的回归套件会在本任务落地后永久变红，污染 CI/gate 判断，且这两条断言的"证伪"是本任务设计意图的直接产物（不是需要另外排查的意外 bug），修一次即可、成本很低（各 1-2 行）。
3. **为什么新增独立的 t091 spec 文件而非把 13 条新 BDD 塞进 t090 文件**：①任务边界清晰——T090/T091 是两个独立的 agate 任务，各自有独立的 evidences 目录（`docs/tasks/T090.../evidences/` vs `docs/tasks/T091.../evidences/`），证据文件按任务归档是项目既有约定；②t090 spec 已有 300+ 行、多个 describe 块（不同 viewport），本任务新增 13 条 BDD（含 9 viewer 覆盖 + 2 个滚动架构例外场景 + 首屏/滑动后双截图对比）体量不小，混入同一文件会让该文件职责发散、难以按任务追溯；③`gate_commands.P3` 需要精确覆盖"实际新增的测试文件"（吸取 T090 的教训），拆分成独立文件后 `E2E_SPEC=e2e/t09 make debug-test`（见第 5 节）可以用一个 glob 前缀同时覆盖新旧两个文件，职责边界和 gate 覆盖范围都更清晰。

**新文件的落地要求**（供 P3/P4 参考，不做过度指定）：
- `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts`
- `EVIDENCE_DIR = 'docs/tasks/T091-mobile-detail-visual-polish/evidences'`
- 需要用到的测试 entry 均已在 `scripts/seed-data/` 现成可用（`make debug-quick` 自动灌入，不需要新增数据）：`markdown-test`、`python-entry-service`、`csv-employees`、`tsv-server-metrics`、`json-api-config`、`yaml-docker-compose`、`xml-maven-pom`、`svg-standalone`（BDD-10 实际测试对象，见第 2 节）、`mermaid-charts`、`plantuml-arch`、`html-csp-test`（BDD-11）
- BDD-10/11 的"滑动后截图"用 Playwright 的 `page.mouse.move` + `page.mouse.down/move/up`（或 `page.touchscreen` API）在内容区域中点执行一次垂直上滑手势，滑动距离约 200-300px，动作完成且无进行中动画时截图，与 BDD-9/BDD-13 一样走 vision-engine 分析（不是本设计阶段要展开的截图脚本细节，P4 实现时参照 t090 spec 已有的 CDP/截图写法）

## 5. gate_commands（P2 固化，P3-P6 不得修改）

```yaml
gate_commands:
  P3: "E2E_SPEC=e2e/t09 make debug-test"
  P3_e2e: "E2E_SPEC=e2e/t09 make debug-test"
  P5: "make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/t09 make debug-test"
  project_module: "src/"
```

**`E2E_SPEC=e2e/t09` 说明（吸取 T090 教训的关键决定）**：`scripts/run-e2e-tests.sh` L89 用 `npx playwright test "$spec"` 调用 Playwright CLI，Playwright 的位置参数按"相对路径子串匹配"而非精确文件名匹配测试文件——已核实 `frontend-v3/e2e/` 目录下当前只有 `t090-mobile-detail-ux-polish.spec.ts` 一个文件路径包含 `t09` 子串，新增的 `t091-mobile-detail-visual-polish.spec.ts` 同样包含 `t09`，且目录内没有其他文件会意外匹配这个前缀。`E2E_SPEC=e2e/t09` 因此能一次性精确覆盖"本任务实际改动/新增的两个测试文件"（t090 的手术式修改 + 全新的 t091），不像 T090 当初只声明 `make test-frontend`（vitest，覆盖不到 Playwright E2E 新增测试）导致 `check-tdd-red.sh` 误报绿灯。
`P5` 单独声明 `make test-frontend`（vitest）是因为本任务不触碰任何 `.ts`/组合式函数逻辑（纯 `.vue` 模板+CSS+图标 import 改动），vitest 套件里没有需要新增的单元测试，但保留这条作为既有单测的回归门（防止图标 import 语法错误等在 vitest 阶段就能捕获的问题）。

**显式承认 `E2E_SPEC=e2e/t09` 的脆弱性，非疏忽**：这是无锚定的子串正则匹配，不是精确文件名匹配、也不是 glob——未来若新增文件名恰好包含 `t09` 子串（如误粘贴、命名巧合），会被静默纳入这次 gate 的测试范围而不会报错。本任务有意识接受这个取舍：`gate_commands` 只服务本任务窗口期（P3-P6），P8 发布完成后即失去时效性，不会被后续任务复用或残留在长期运行的脚本里；用更精确的写法（显式文件列表或更严格的 glob）能消除这个脆弱点，但成本收益比不构成本任务必须解决的问题。当前目录内实测（`ls frontend-v3/e2e/`，29 个文件）只有 `t090-mobile-detail-ux-polish.spec.ts` 与新增的 `t091-mobile-detail-visual-polish.spec.ts` 两个文件命中该子串，无第三方误匹配。

## 6. files_to_read（P4 实现导航）

```yaml
files_to_read:
  - path: frontend-v3/src/components/EntryMetaTagsBar.vue
    why: 改 .meta-tags-bar 的 padding（8/12→16/16）与 overflow-x:auto→flex-wrap:wrap，全文件仅 41 行，直接整读
  - path: frontend-v3/src/components/MarkdownViewer.vue:124-137
    why: 改 mobile 断点（@media max-width:640px）下 .markdown-body 的 padding（0→var(--space-4)），margin 保持 0 不变
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue
    why: 核心改动文件——.mobile-bottom-bar padding 叠加修复、Copy 按钮模板+新增本地 .icon-btn class、Wrap 按钮模板改 .toggle-btn+WrapText 图标、移除废弃 .bottom-btn/.bottom-btn.primary，全文件 158 行，直接整读
  - path: frontend-v3/src/components/EntryDetailHeader.vue:36-38
    why: 只读参照，桌面端 Copy 按钮用法（<CopyIcon :size="16" />，无文字），移动端 Copy 图标化需与此视觉对齐
  - path: frontend-v3/src/components/EntryDetailHeader.vue:163-166
    why: 只读参照，桌面端 .icon-btn 的完整 CSS 定义（background:none; border:none; padding:var(--space-1); border-radius:var(--radius-sm); color:var(--c-text-secondary); hover 态），移动端新增本地 .icon-btn 以此为基础再加 min-width/min-height:44px
  - path: DESIGN.md:104-278
    why: 5 处精确修订落地位置（Container L111-114、Icon Buttons L158-160、Meta Tags Bar L218-219、Markdown Body Spacing L221-223、Rules 底部栏描述 L267），本设计第 3 节已给出逐处前/后对照文字，直接套用
  - path: frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts:285-326
    why: BDD-7（L285-303）class 断言 'primary'→'active'、BDD-8（L305-326）inset 断言从缩减比例改为定值 24px 对称性校验，两处手术式修改，本设计第 4 节已给出具体理由，其余测试不动
  - path: frontend-v3/src/components/EntryDetailContent.vue:23-24
    why: 只读参照，确认 EntryMetaTagsBar 是 .content-area 内第一个子元素（本次不改此文件），实现时不应改变这个挂载位置
  - path: frontend-v3/src/components/EntryDetailContent.vue:227-231
    why: 只读参照，确认 .content-area mobile padding 精确值 var(--space-3) var(--space-2)（12px/8px），DESIGN.md L113 附近新增的例外说明（第 3.1 节）依据此实测值
```

## 7. env_constraints（确认/细化 P0-brief）

```yaml
env_constraints:
  debug_env: "make debug-quick 启动 :8888（/tmp/peekview-debug/ 隔离数据），P6 视觉验收需要 playwright-cdp skill（:18800 Chrome CDP，本轮/上轮均已验证可达）+ vision-engine skill（图像分析），两者均已验证可用。改前端后必须 make build-frontend（或用 make debug-quick 一步到位）才能反映到 :8888"
  isolation_check: "make debug-verify-isolation（依赖生产 :8080 在线）；:8080 不在线时改用 sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 手动核对隔离，见 AGENTS.md 常用命令章节。严禁触碰生产 :8080 与 ~/.peekview/"
```

## 8. UI 测试选择器（稳定标识清单，供 P3/P4 使用）

**声明：本次改动保留全部既有 `data-testid` 不变**，只是元素内部结构变化（去文字/加图标/改 class），T090 遗留 E2E 测试中依赖这些 testid 的定位逻辑不受影响：

| data-testid | 所在组件 | 本次是否变化 |
|---|---|---|
| `meta-tags-bar` | EntryMetaTagsBar.vue | 保留，容器本身不变，仅内部 CSS |
| `markdown-body` | MarkdownViewer.vue | 保留，仅 CSS padding 变化 |
| `content-area` | EntryDetailContent.vue | 保留，本次不改动该文件 |
| `mobile-bottom-bar` | EntryDetailMobileBar.vue | 保留，仅 CSS padding 变化 |
| `mobile-bar-copy-btn` | EntryDetailMobileBar.vue | 保留，内部从"图标+文字"变为"仅图标"，testid 不变 |
| `mobile-bar-wrap-btn` | EntryDetailMobileBar.vue | 保留，内部从"纯文字"变为"图标"，class 从 `.bottom-btn` 变为 `.toggle-btn`，testid 不变 |
| `mobile-bar-filetree-btn` / `mobile-bar-toc-btn` / `mobile-bar-source-toggle-btn` | EntryDetailMobileBar.vue | 不涉及本次改动，原样保留 |

新增测试用这些既有 testid 定位元素，不引入基于 class 名称的选择器（class 名称本次会变化，如 `.bottom-btn`→`.toggle-btn`，class 选择器不稳定）。

## 9. 实现完成的标志

- `EntryMetaTagsBar.vue`/`MarkdownViewer.vue`/`EntryDetailMobileBar.vue` 三处 CSS/模板改动与第 1 节"改什么"表格、第 3 节 DESIGN.md 对应数值完全一致
- `EntryDetailMobileBar.vue` 新增本地 `.icon-btn`（含 min-width/min-height:44px），移除 `.bottom-btn`/`.bottom-btn.primary`
- Wrap 按钮（`mobile-bar-wrap-btn`）具备 `:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"` 与 `:aria-pressed="wrapEnabled"`，与同文件内 `source-toggle` 按钮的 aria 写法模式一致（可用 axe/手动检查浏览器可访问性树核验按钮存在非空可访问名称）
- `DESIGN.md` 5 处文字按第 3 节精确修订落地
- `t090-mobile-detail-ux-polish.spec.ts` 的 BDD-7/BDD-8 两处断言按第 4 节修改，其余测试不动；`E2E_SPEC=e2e/t09 make debug-test` 全绿
- 新增 `t091-mobile-detail-visual-polish.spec.ts` 覆盖 P1 全部 13 条 BDD
- `cd frontend-v3 && npx vue-tsc --noEmit` 通过（新增 `WrapText` 图标 import 类型检查）
- `make lint` 通过
- 全部既有 `data-testid` 未被移除/重命名
- 桌面端（>640px）视觉与交互不受任何影响（BDD-12/13）
