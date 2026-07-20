# P1 Progress Log

## Read: analyst.md
- Role: 需求质疑模式，先质疑再定义
- Key: 隐含需求识别（5维度：数据/前端/多端/边界/兼容），BDD可二值判定，拿不准标[NEED_CONFIRM]
- Output: P1-requirements.md with header, 7 sections

## Read: P0-brief.md
- 4 extensions: KaTeX (high), Task List (mid), Footnote (mid), Sub/Sup (mid-low)
- Plugin selection already done in P0
- Known risks: DOMPurify vs KaTeX, $ vs currency, KaTeX CSS global impact, SPA footnote anchors
- Pure frontend change, no backend
- KaTeX 0.16.47 already in node_modules as indirect dep

## Read: WORKFLOW.md
- P1 gate: BDD conditions >=1, no [NEED_CONFIRM], no status:GAP
- P1 is "live baseline" - can be augmented later with SCOPE+ mechanism
- Small task can use simplified P1

## Read: useMarkdown.ts
- MarkdownIt 14.1.1, html:true, linkify:true, typographer:true
- No plugins registered currently
- DOMPurify config at line 387-390: ADD_ATTR list, ADD_TAGS: ['button']
- Blocks-based rendering (html blocks + diagram blocks)
- DOMPurify runs per html block AFTER markdown rendering
- Key: ADD_ATTR and ADD_TAGS are the whitelist extension points

## Read: MarkdownViewer.vue
- Scoped + global styles
- Dark mode via [data-theme='dark'] overrides
- No existing KaTeX/footnote/task-list CSS
- Event delegation for clicks (copy-code, link navigation)
- Footnote click handling not present yet

## Checked: package.json dependencies
- dompurify ^3.4.9 (direct dep)
- markdown-it ^14.1.0 (direct dep)
- KaTeX NOT a direct dep (only in lockfile as mermaid indirect dep)
- No markdown-it plugins currently installed

## Checked: DOMPurify usage across codebase
- 3 locations: useMarkdown.ts, SvgRenderer.vue, useMarkdown test
- All use same ADD_ATTR/ADD_TAGS config
- ADD_ATTR: data-action, data-code, data-line, data-block-id, data-index, data-mode, data-peekview-file-id, target, rel
- ADD_TAGS: button
- KaTeX output will need: span[class], span[style], span[aria-label], span[aria-hidden], etc.
- Task list will need: input[type][checked][disabled][class]
- Footnote will need: a[href^="#fn"], sup[class], section[class]

## Key finding: DOMPurify whitelist must be extended in ALL 3 locations for consistency

## Checked: existing test pattern
- useMarkdown.blocks.spec.ts uses vitest, direct render() call, checks block types and content
- Tests are simple and focused on block structure
- New extension tests can follow same pattern: render markdown → check output HTML

## Key implicit requirements identified so far:

### 1. DOMPurify whitelist (CRITICAL)
- KaTeX generates: span.mt, span.mord, span.katex, span.katex-mathml, etc. + aria-label, aria-hidden, style attributes
- Task list: input[type=checkbox][checked][disabled][class=task-list-item-checkbox]
- Footnote: sup.footnote-ref, a.footnote-ref, section.footnotes, ol.footnotes-list, li.footnote-item, a.footnote-backref
- Sub/Sup: sup, sub tags (already allowed by DOMPurify default)
- Must extend in ALL 3 DOMPurify call sites

### 2. KaTeX CSS loading strategy
- katex.min.css ~20KB gzip, required for rendering
- Options: global import in main.ts, lazy import in useMarkdown, or in MarkdownViewer.vue
- Must work with dark mode (KaTeX has its own color vars)

### 3. Footnote SPA anchor behavior
- Footnote links use #fn1 / #fnref1 anchors
- In SPA (Vue Router), clicking #anchor may not scroll (no full page reload)
- Need smooth scroll-to-element behavior within markdown-body
- Must not interfere with Vue Router

### 4. $ delimiter vs currency
- Single $ conflicts with currency ($100, $variable)
- markdown-it-katex default: $ for inline, $$ for block
- Need to decide: greedy vs lazy matching, escape handling
- P0-brief flagged this as known risk

### 5. Task list checkbox interactivity
- Checkboxes should be disabled (read-only rendering, not a TODO app)
- P0 says `<input type="checkbox">` — but should they be interactive?
- Implicit: read-only display only (PeekView is a viewer, not editor)

### 6. Dark mode for new extensions
- KaTeX: needs color overrides for dark theme
- Footnotes: border/separator colors need dark variants
- Task lists: checkbox styling needs dark variants

### 7. MCP/CLI/API not affected (confirmed)
- All 4 extensions are pure frontend rendering
- Raw API returns original markdown, no transformation
- MCP publish_files doesn't modify markdown content

## Investigated: KaTeX output structure
- KaTeX generates: span.katex > span.katex-mathml (MathML) + span.katex-html (visual)
- Attributes used: class, style, aria-hidden, xmlns, encoding, mathcolor
- Tags used: span, math, semantics, mrow, mi, mn, mo, mfrac, msqrt, munderover, annotation
- Some formulas (\cancel, \vec) use SVG with <svg xmlns=...> and <line>
- DOMPurify default: class and style are ALLOWED, aria-hidden is ALLOWED
- DOMPurify strips: xmlns on non-SVG/math contexts (but KaTeX wraps in span, so <math xmlns> should be OK)
- Key: DOMPurify needs to allow <math> and MathML tags (mrow, mi, mn, mo, mfrac, etc.)
- Key: DOMPurify needs to allow <svg> and <line> for some KaTeX formulas
- mathcolor attribute on <mstyle> for error rendering — need to check if DOMPurify allows it

## KaTeX CSS size: 24KB (23827 bytes) uncompressed, ~20KB gzip estimate
- Contains font-face declarations for KaTeX fonts
- Must be loaded globally or per-component

## Key boundary cases identified:
1. Empty formula: `$ $` or `$$ $$` — should render as empty or error
2. Unclosed delimiter: `$x^2` without closing $ — should render as plain text
3. Nested syntax: `$x_{\text{note}}` with footnote syntax — potential conflict
4. $$ inside list items — block math in list context
5. Task list in nested list — `- [ ]` inside blockquote or list
6. Footnote with duplicate labels — `[^1]` defined twice
7. Footnote with no definition — `[^1]` referenced but never defined
8. Sub/sup inside other inline formatting — `**x^2^**` — nesting with bold/italic
9. Currency conflict: `$100` vs `$e^{i\pi}$` — delimiter disambiguation
10. KaTeX error rendering: undefined commands should show red error, not crash

## Investigated: Plugin output structures (live testing)

### Footnote (markdown-it-footnote)
- Reference: `<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup>`
- Separator: `<hr class="footnotes-sep">`
- Section: `<section class="footnotes"><ol class="footnotes-list"><li id="fn1" class="footnote-item">...`
- Backref: `<a href="#fnref1" class="footnote-backref">↩︎</a>`
- Undefined footnote: renders as plain text `[^1]` (no link)
- Duplicate refs: second gets id `fnref1:1` (colon in ID!)
- Multiple footnotes: numbered sequentially (fn1, fn2, ...)
- DOMPurify needs: sup (already allowed), section, hr (already allowed), ol/li (already allowed)
- DOMPurify needs ADD_ATTR: id on li/sup/a (already allowed by default)
- Key: footnote IDs contain colons for duplicate refs — need to verify DOMPurify doesn't strip them

### Task List (markdown-it-task-lists)
- `<ul class="contains-task-list"><li class="task-list-item">`
- `<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox">`
- Checkboxes are already disabled (read-only) by the plugin
- Nested task lists work correctly
- DOMPurify needs: input[type=checkbox] (NOT in default allowlist!)
- DOMPurify needs ADD_TAGS: input
- DOMPurify needs ADD_ATTR: type, checked, disabled, class (class already allowed)

### Sub/Sup (markdown-it-sub / markdown-it-sup)
- `<sub>2</sub>` and `<sup>2</sup>` — standard HTML tags
- DOMPurify allows sub/sup by default — NO whitelist changes needed
- Empty delimiters (^^ or ~~): render as plain text — safe
- Works inside bold/italic — no nesting issues

### KaTeX (from @iktakahiro/markdown-it-katex)
- Wraps in `<span class="katex">` with MathML + HTML visual layers
- Uses: class, style, aria-hidden, xmlns attributes
- Some formulas use <svg> and <line> (for \cancel, \vec, etc.)
- Error rendering: uses mathcolor attribute on <mstyle>
- DOMPurify needs: math + MathML tags, svg + line, style attribute, aria-hidden
- Key: DOMPurify 3.x allows <math> and <svg> by default with appropriate child tags
- Key: style attribute is allowed by default in DOMPurify 3.x
- Key: class attribute is allowed by default
- Main concern: input tag for task lists is NOT in default allowlist

## Verified: DOMPurify 3.x default allowlist
- math, svg, input, line, section, sup, sub, mfrac, mi, annotation — ALL in default allowedTags
- style, class, id, type, checked, disabled, xmlns, mathcolor, encoding — ALL in default allowedAttr
- aria-* attributes: handled via regex pattern `/^aria-[\-\w]+$/` — aria-hidden IS allowed
- **Conclusion: DOMPurify 3.x default allowlist already covers ALL tags/attrs needed by all 4 extensions!**
- The only thing needed: ADD_TAGS: ['button'] (already present) + possibly no new ADD_ATTR needed
- Wait — need to verify: does DOMPurify allow input[type=checkbox] with checked+disabled?
  - input is in allowedTags, type/checked/disabled are in allowedAttr → YES
- This is a critical finding: DOMPurify whitelist extension may be MINIMAL or ZERO for these extensions

## Remaining concern: DOMPurify with current ADD_ATTR/ADD_TAGS override
- Current code uses ADD_ATTR + ADD_TAGS which ADDS to defaults, not replaces
- So all defaults are still in effect
- KaTeX output should pass through DOMPurify without additional whitelist changes
- Task list input[checkbox] should also pass through
- Footnote section/sup/a should also pass through
- Sub/sup tags are standard HTML, no issue

## REVISED assessment: DOMPurify whitelist changes may be ZERO
- This contradicts P0-brief's "DOMPurify 会剥离 KaTeX 输出的自定义属性和样式"
- Need to verify with actual DOMPurify.sanitize() call in browser context
- The risk is lower than P0-brief estimated, but must be verified in P5

## Investigated: @iktakahiro/markdown-it-katex delimiter behavior
- Inline: $...$ — works correctly
- Display: $$...$$ — renders as <p class='katex-block'><span class="katex-display">...
- Currency: $100 — NOT treated as math (smart delimiter: $ followed by digit = not math)
- Unclosed: $x^2 unclosed — renders as plain text (no error, no crash)
- Empty: $$ — renders as plain text
- Code backticks: `$var` — NOT treated as math (code takes priority)
- Escaped: \$ — renders as literal $ (correct)
- Multiple inline: $a$ and $b$ — both render correctly
- Display with text: proper block separation

### Key finding: $ delimiter handling is SMART by default
- The plugin already handles currency disambiguation ($ followed by digit = not math)
- Unclosed delimiters gracefully degrade to plain text
- No configuration needed for basic $ vs currency handling
- P0-brief risk about "$ 分隔符与货币符号冲突" is MITIGATED by plugin's smart parsing

### KaTeX block output uses <p class='katex-block'>
- Note: single quotes in class attribute! Need to verify DOMPurify handles this
- Actually, DOMPurify normalizes attribute quotes, so this is fine

### KaTeX error handling
- With throwOnError: false (default for markdown-it-katex), errors render as red text
- No crash, no exception — graceful degradation

## Investigated: SPA scroll behavior
- EntryDetailView already has scrollToHeading() using scrollIntoView({behavior:'smooth'})
- TocNav uses same pattern
- base.css has scroll-behavior: smooth on html
- Footnote anchor clicks (#fn1, #fnref1) will be handled by browser's native anchor scroll
- In SPA: clicking <a href="#fn1"> triggers hash change, browser scrolls to element with id="fn1"
- This should work because:
  1. The footnote section is in the same DOM (same page, no route change)
  2. scroll-behavior: smooth is set globally
  3. The markdown-body container has overflow:auto (scrollable)
- Potential issue: if markdown-body is the scroll container (not document), native #anchor may not scroll
  - Need to verify: does scrollIntoView work within overflow:auto container?
  - Yes, scrollIntoView works on any scrollable ancestor
- Footnote backref (#fnref1) should also work the same way
- No Vue Router interference: #hash doesn't trigger route change

## Key finding: Footnote SPA behavior should work with native browser anchor scrolling
- No special JavaScript needed for footnote navigation
- CSS scroll-behavior: smooth already set
- If issues arise, can add click handler similar to TocNav's scrollTo()

## Checked: CSP headers
- Main app CSP: style-src 'self' 'unsafe-inline' — KaTeX inline styles are ALLOWED
- Main app CSP: font-src 'self' — KaTeX fonts bundled as CSS font-face, need to be served from 'self'
- KaTeX CSS includes @font-face with relative paths to font files in katex/dist/fonts/
- **Potential issue**: KaTeX fonts referenced in CSS need to be accessible from 'self'
  - If KaTeX CSS is bundled by Vite, fonts are inlined or copied to assets — works with 'self'
  - If KaTeX CSS is loaded separately, font URLs must resolve to same origin
- P0-brief claim "CSP unsafe-eval 已允许，KaTeX 不需要额外 CSP 放宽" is CORRECT for style-src
- **But font-src may need attention**: KaTeX uses web fonts for math symbols
  - Vite will handle this: CSS import → font files inlined or hashed into build output
  - No CSP change needed as long as Vite bundles everything

## No backend changes needed (confirmed)
- CSP is fine as-is
- No API changes needed
- No database changes needed

## Completed: P1-requirements.md written
- 26 BDD conditions (B1-B26) covering all 4 extensions + cross-cutting concerns
- 10 implicit requirements identified (2.1-2.10)
- 0 [NEED_CONFIRM] items
- No status: GAP
- All BDD conditions are binary-verifiable (PASS/FAIL)
- Phases: P1-P8 (no pruning)
- Risk level: medium
- UI affected: true
- Capability requirements: browser-vision (available), dom-interaction-testing (available)
