# T045 P2 Progress

## Step 1: Read P0-brief + P1-requirements
- P1 has 9 BDDs in 4 groups: zebra full-width (B01-B02), zebra contrast (B03-B04), line numbers (B05-B08), no regression (B09)
- P0 root causes: (1) `pre * { background: transparent !important }` overrides `.line` bg; (2) odd/even color diff too small; (3) `highlightCode()` lacks line numbers
- Phases: [P1, P2, P4, P5, P6] — P3/P7/P8 skipped

## Step 2: Read source files
- useShiki.ts: `highlight()` wraps codeToHtml + renderLineNumbers in `.code-container`; `highlightCode()` returns raw codeToHtml (no line numbers, no container)
- useMarkdown.ts: calls `highlightCode()` for markdown code blocks; SVG diagrams use `highlightCode(code, 'xml', theme)`; mermaid/plantuml use `escapeHtml()` — no `.line` spans at all
- MarkdownViewer.vue: `[data-theme='dark'] .markdown-body pre * { background-color: transparent !important }` (line 246-249) is the root cause of zebra not showing; zebra rules at lines 252-258 use `.code-block-wrapper .line:nth-child(even)` but specificity loses to `pre *`
- DiagramBlock.vue: `.diagram-code .line:nth-child(even)` (line 336-338) for zebra; codeViewHtml rendered via `v-html`
- code.css: CodeViewer uses `.code-body :deep(.line) { display: block }` (line 100-103) — this is why CodeViewer works
- variables.css: dark `--bg-code-even: #131920` (vs `--bg-code: #0e131b`), light `--bg-code-even: #e8ebef` (vs `--bg-code: #eef0f3`)

## Step 3: Shiki codeToHtml output structure verified
- Output: `<pre class="shiki github-dark" ...><code><span class="line">...</span>\n<span class="line">...</span></code></pre>`
- `.line` is a `<span>` (inline by default) — needs `display: block` for full-width background
- `highlight()` wraps in `<div class="code-container"><div class="line-numbers">...</div><pre>...</pre></div>`
- `highlightCode()` returns bare `<pre><code><span class="line">...</span></code></pre>`

## Step 4: Key design decisions
- **Zebra fix**: Need `.line { display: block }` in markdown code blocks + override `pre * transparent` specificity
- **Line numbers**: Modify `highlightCode()` to also generate line numbers (same structure as `highlight()`) — this is the cleanest approach, avoids duplicating logic
- **Diagram code mode**: mermaid/plantuml currently use `escapeHtml()` with no `.line` spans; must switch to `highlightCode()` (or `highlight()`) for proper structure
- **DOMPurify**: New elements `div.code-container`, `div.line-numbers`, `span.line-number` need to pass through — DOMPurify allows div/span by default, so no config change needed
- **Color values**: Need to increase odd/even contrast to ≥8% luminance difference

## Step 5: Design completed
- §1 Zebra fix: `.line { display: block }` + zebra selector specificity override (move after `pre * transparent`, use `.code-block-wrapper pre .line:nth-child(even)`)
- §2 Color adjustment: dark `#1c2536` (8.1% HSL diff), light `#d4d9e2` (8.4% HSL diff)
- §3 Line numbers: `highlightCode()` now outputs `.code-container` + `.line-numbers` same as `highlight()`
- §4 MarkdownViewer line number styles (flex layout, matching CodeViewer)
- §5 DiagramBlock line number styles + `.line { display: block }`
- §6 useMarkdown.ts: mermaid/plantuml codeViewHtml now use `highlightCode()` instead of `escapeHtml()`
- All 9 BDDs covered
- P2-design.md written
