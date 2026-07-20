# P2 Progress Log

## 2026-07-20 — Input Reading

### P0-brief.md findings
- Pure frontend task, no backend/MCP/CLI changes
- 4 extensions: KaTeX (high), Task List (mid), Footnote (mid), Sub/Sup (low)
- Known risks: DOMPurify compatibility, $ vs currency, KaTeX CSS perf, footnote SPA scroll
- Debug env: make debug (:8888, /tmp/peekview-debug/)

### P1-requirements.md findings
- 30 BDD conditions (B01-B30)
- DOMPurify 3.x default whitelist covers all needed tags/attrs (P1-progress confirmed)
- KaTeX CSS must load before first render (no lazy loading)
- Footnote anchor in overflow:auto container needs scrollIntoView (not native hash)
- Task list checkbox already has disabled attr from plugin
- KaTeX error formulas render as red text (throwOnError: false)
- Duplicate footnote refs generate IDs with colons (fnref1:1)

### P2-dispatch-context.md findings
- P1 confirmed: DOMPurify default whitelist sufficient, but P5 must verify
- P1 confirmed: smart $ delimiter handles currency
- P1 confirmed: footnote SPA anchor needs scrollIntoView
- Gate commands need P5 + P5_e2e (ui_affected=true)

### Code analysis findings
- useMarkdown.ts: MarkdownIt with html:true, linkify:true, typographer:true
- DOMPurify config: ADD_ATTR (8 attrs) + ADD_TAGS (button) — incremental, not replacement
- DOMPurify called in 3 places: useMarkdown.ts:387, SvgRenderer.vue:73, useMarkdown.svg.spec.ts:53
- MarkdownViewer.vue: overflow:auto on .markdown-viewer, scroll-behavior:smooth on html
- Existing scrollIntoView pattern: TocNav.vue:29, EntryDetailView.vue:621
- CSS imports in main.ts: variables.css, base.css, layout.css (global pattern)
- KaTeX 0.16.47 already in node_modules (mermaid dependency)
- No markdown extension plugins currently installed

## 2026-07-20 — Minimal Validation

### DOMPurify + KaTeX validation (Node.js script)
- **Result: confirmed** — DOMPurify 3.x with current ADD_ATTR/ADD_TAGS config passes KaTeX output intact
- `<semantics>` and `<annotation>` tags are stripped (MathML accessibility elements)
- Visual rendering unaffected: katex-html, katex-display, strut spans, style attrs all preserved
- aria-hidden, xmlns, class (katex-*), style attrs all preserved
- Error formula mathcolor="#cc0000" preserved
- **Note**: annotation stripping reduces accessibility but not visual rendering. Acceptable trade-off.

### DOMPurify + Footnote/TaskList validation
- **Result: confirmed** — All footnote elements pass: footnote-ref, footnotes-sep, footnotes-list, footnote-backref, id/href attrs
- All task list elements pass: checkbox type/checked/disabled, task-list-item class
- Duplicate footnote IDs with colons (fnref1:1) preserved by DOMPurify

### Footnote scroll in overflow:auto container
- **Result: confirmed** — Native hash navigation (#fn1) scrolls the document, NOT overflow:auto containers
- Must intercept footnote link clicks and call scrollIntoView() on target element
- Existing pattern: TocNav.vue uses @click.prevent + scrollIntoView
- MarkdownViewer.vue already has click handlers (handleCodeBlockCopy, handleLinkClick)
- scrollIntoView works correctly within overflow:auto containers in real browsers

### KaTeX CSS size
- katex.min.css: 23,827 bytes (~24KB uncompressed)
- Contains @font-face declarations for KaTeX math fonts
- Must be loaded before first render (FOUC risk if deferred)

## 2026-07-20 — Design Complete

### Candidate approaches
- **方案 A**（推荐）：全局注册 + 全局 CSS + scrollIntoView 拦截
- **方案 B**（陪衬）：按需加载 KaTeX CSS + 动态插件注册 — 违反 P1 隐含需求 2.2（FOUC）

### Key design decisions
1. KaTeX CSS 全局 import in main.ts（与现有 CSS 加载模式一致，避免 FOUC）
2. 脚注链接点击拦截用 scrollIntoView（已有先例：TocNav.vue）
3. DOMPurify 配置不变（最小验证确认默认白名单已覆盖）
4. CSS.escape() 处理含冒号的脚注 ID
5. 插件注册顺序：katex → task-lists → footnote → sub → sup

### Gate commands
- P5: `cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30`
- P5_e2e: `cd frontend-v3 && npx playwright test --reporter=line e2e/ 2>&1 | tail -40`

### Output
- P2-design.md written with all required fields
- 2 candidate approaches with trade-off analysis
- 4 declaration fields (packages/domains/ui_affected/gate_commands)
- 7 files_to_read entries
- 3 minimal_validation results (all confirmed)
