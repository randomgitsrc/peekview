---
phase: P4
task_id: T045-code-block-rendering-fix
type: implementation
trace_id: T045-P4-20260701
status: draft
agent: implementer
created: 2026-07-01
parent: P2-design.md
---

# T045 Code Block Rendering Fix — Implementation

## Files Modified

### 1. `frontend-v3/src/composables/useShiki.ts`
**What**: `highlightCode()` now generates line numbers and wraps output in `.code-container`, matching `highlight()` output structure.
**Why**: B05-B08 — Markdown/Diagram code blocks need line numbers. Previously `highlightCode()` returned bare `<pre><code>...</code></pre>` without line numbers.

### 2. `frontend-v3/src/composables/useMarkdown.ts`
**What**: Diagram `codeViewHtml` generation changed from manual `<pre><code>` wrapping to direct `highlightCode()` calls for all diagram types (svg→xml, mermaid→mermaid, plantuml→text).
**Why**: B05-B08 + implicit need #2 — mermaid/plantuml previously used `escapeHtml()` producing no `.line` elements, so zebra CSS didn't apply. Now all diagram code modes get Shiki highlighting + line numbers + `.line` structure.

### 3. `frontend-v3/src/styles/variables.css`
**What**: `--bg-code-even` color values changed:
- Dark: `#131920` → `#1c2536` (HSL L diff 8.1%)
- Light: `#e8ebef` → `#d4d9e2` (HSL L diff 8.4%)
**Why**: B03-B04 — odd/even brightness difference was <3%, now ≥8% in both themes.

### 4. `frontend-v3/src/components/MarkdownViewer.vue`
**What**:
- Zebra selectors moved after `pre * transparent` rule with higher specificity: `.code-block-wrapper pre .line:nth-child(even)` (specificity 0,3,2) + `!important` on both light and dark
- Added `.line { display: block }` rule
- Added `.code-container`, `.line-numbers`, `.line-number` styles (flex layout matching code.css pattern)
- Added `.code-container pre` and `.code-container code` styles for proper flex layout
- Added dark mode `.line-numbers` background/border override
**Why**: B01 — root cause was `pre * { background: transparent !important }` overriding zebra. `.line` was inline (`<span>`) so background only covered text width. New selectors have higher specificity and `!important`, plus `.line { display: block }` makes background fill full width.

### 5. `frontend-v3/src/components/DiagramBlock.vue`
**What**: Replaced `.diagram-code` CSS section with new rules for `.code-container`, `.line-numbers`, `.line-number`, `pre`, `code`, `.line` (display:block + height:1.6em), and `.line:nth-child(even)` zebra.
**Why**: B02 + implicit need #1 — `highlightCode()` now outputs `.code-container` structure, DiagramBlock CSS must adapt. `.line { display: block }` ensures zebra fills full width.

## Files NOT Modified (per P2 design)

- `CodeViewer.vue` — line numbers/zebra already correct
- `code.css` — CodeViewer styles already correct
- Shiki theme/language loading — not involved

## Verification

- `npx vue-tsc --noEmit` — PASS
- `./node_modules/.bin/vitest run` — 637 passed, 1 skipped
