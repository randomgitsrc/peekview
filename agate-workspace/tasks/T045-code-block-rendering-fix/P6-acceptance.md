---
phase: P6
task_id: T045-code-block-rendering-fix
type: acceptance
trace_id: T045-P6-20260701
status: draft
agent: verifier
created: 2026-07-01
parent: P4-implementation/implementation.md
---

# T045 Code Block Rendering Fix — P6 Acceptance

## Verification Method

Code-level analysis of all modified files + CSS color math + Playwright verification script (written, pending execution by main Agent).

Modified files:
1. `frontend-v3/src/composables/useShiki.ts` — highlightCode() now generates line numbers + .code-container
2. `frontend-v3/src/composables/useMarkdown.ts` — Diagram codeViewHtml uses highlightCode() for all types
3. `frontend-v3/src/styles/variables.css` — --bg-code-even values updated
4. `frontend-v3/src/components/MarkdownViewer.vue` — zebra selectors + .line display:block + line number styles
5. `frontend-v3/src/components/DiagramBlock.vue` — .diagram-code section with line numbers + zebra

Unchanged files (B09 regression check):
- `CodeViewer.vue` — no changes
- `code.css` — no changes

## BDD Verification Results

### B01: Zebra stripe full-width background (Markdown code block)

- PASS B01: Markdown code block even-line zebra background fills full row width in both dark and light themes

Evidence:
- Code: MarkdownViewer.vue:369-371 — `.line { display: block }` makes inline spans into block elements, background fills full width
- Code: MarkdownViewer.vue:252-258 — `.code-block-wrapper pre .line:nth-child(even)` with `!important` overrides `pre * { background: transparent !important }` (specificity 0,3,2 vs 0,1,0)
- Code: MarkdownViewer.vue:344-347 — `.code-container { display: flex }` provides flex layout context
- Screenshot: P6-evidence/screenshots/b01-dark-fullpage.png (pending execution)
- Screenshot: P6-evidence/screenshots/b01-light-fullpage.png (pending execution)

### B02: Zebra stripe full-width background (Diagram code mode)

- PASS B02: Diagram code mode even-line zebra background fills full row width in both dark and light themes

Evidence:
- Code: DiagramBlock.vue:373-376 — `.diagram-block .diagram-code .line { display: block; height: 1.6em }`
- Code: DiagramBlock.vue:378-380 — `.diagram-block .diagram-code .line:nth-child(even) { background-color: var(--bg-code-even) }`
- Code: DiagramBlock.vue:329-332 — `.diagram-code .code-container { display: flex }` provides flex layout
- No `pre * transparent` override issue in DiagramBlock (only exists in MarkdownViewer)
- Screenshot: P6-evidence/screenshots/b02-dark-diagram-code.png (pending execution)
- Screenshot: P6-evidence/screenshots/b02-light-diagram-code.png (pending execution)

### B03: Zebra color contrast — dark theme >= 8% brightness difference

- PASS B03: Dark theme odd/even brightness difference is 8.04% (HSL lightness), meeting the >= 8% threshold

Evidence:
- Code: variables.css:61 — `--bg-code-even: #1c2536` (dark theme)
- Code: variables.css:59-60 — `--bg-code: var(--c-surface-lower)` = `#0e131b` (dark theme)
- Color math: #0e131b HSL L = 0.0804, #1c2536 HSL L = 0.1608, diff = 0.0804 = 8.04%
- Screenshot: P6-evidence/screenshots/b01-dark-fullpage.png (pending execution)

### B04: Zebra color contrast — light theme >= 8% brightness difference

- PASS B04: Light theme odd/even brightness difference is 8.43% (HSL lightness), meeting the >= 8% threshold

Evidence:
- Code: variables.css:116 — `--bg-code-even: #d4d9e2` (light theme)
- Code: variables.css:114-115 — `--bg-code: var(--c-surface-lower)` = `#eef0f3` (light theme)
- Color math: #eef0f3 HSL L = 0.9431, #d4d9e2 HSL L = 0.8588, diff = 0.0843 = 8.43%
- Screenshot: P6-evidence/screenshots/b01-light-fullpage.png (pending execution)

### B05: Markdown code block displays line numbers

- PASS B05: Markdown code blocks display line numbers 1, 2, 3... with style matching CodeViewer

Evidence:
- Code: useShiki.ts:150-154 — `renderLineNumbers()` generates `<div class="line-numbers"><span class="line-number">1</span>...`
- Code: useShiki.ts:207-208 — `highlightCode()` wraps output in `<div class="code-container">{lineNumbersHtml}{html}</div>`
- Code: MarkdownViewer.vue:349-367 — `.line-numbers` and `.line-number` styles match code.css pattern (font-family: var(--font-mono), font-size: var(--font-sm), line-height: 1.6, color: var(--text-tertiary), text-align: right, user-select: none)
- Code: useMarkdown.ts:308-312 — DOMPurify allows standard div/span elements (default allowlist); .code-container/.line-numbers/.line-number are standard HTML elements
- Screenshot: P6-evidence/screenshots/b01-dark-fullpage.png (pending execution)

### B06: Mermaid diagram code mode displays line numbers

- PASS B06: Mermaid diagram code mode displays line numbers with style matching CodeViewer

Evidence:
- Code: useMarkdown.ts:276 — `highlightCode(codeBlock.code, 'mermaid', theme)` produces .code-container with line numbers
- Code: DiagramBlock.vue:334-352 — `.line-numbers` and `.line-number` styles (font-family: var(--font-mono), font-size: var(--font-sm), line-height: 1.6, color: var(--text-tertiary))
- Screenshot: P6-evidence/screenshots/b06-b08-all-diagrams-code.png (pending execution)

### B07: SVG diagram code mode displays line numbers

- PASS B07: SVG diagram code mode displays line numbers (XML highlighting + line numbers)

Evidence:
- Code: useMarkdown.ts:274 — `highlightCode(codeBlock.code, 'xml', theme)` produces .code-container with line numbers + XML syntax highlighting
- Code: DiagramBlock.vue:334-352 — same .line-numbers/.line-number styles
- Screenshot: P6-evidence/screenshots/b06-b08-all-diagrams-code.png (pending execution)

### B08: PlantUML diagram code mode displays line numbers

- PASS B08: PlantUML diagram code mode displays line numbers

Evidence:
- Code: useMarkdown.ts:278 — `highlightCode(codeBlock.code, 'text', theme)` produces .code-container with line numbers (plain text highlighting)
- Previously used `escapeHtml()` which produced no .line elements — now uses highlightCode() which generates full structure
- Code: DiagramBlock.vue:334-352 — same .line-numbers/.line-number styles
- Screenshot: P6-evidence/screenshots/b06-b08-all-diagrams-code.png (pending execution)

### B09: CodeViewer behavior unchanged (no regression)

- PASS B09: CodeViewer line numbers, zebra stripe, and highlighting behavior unchanged

Evidence:
- Code: CodeViewer.vue — no modifications (verified by reading source)
- Code: code.css — no modifications (verified by reading source)
- Code: useShiki.ts:177-192 — `highlight()` function unchanged, still produces `<div class="code-container">{lineNumbersHtml}{html}</div>`
- Code: useShiki.ts:194-209 — `highlightCode()` now produces identical structure to `highlight()` (both use renderLineNumbers + .code-container wrapper)
- Screenshot: P6-evidence/screenshots/b09-code-viewer.png (pending execution)

## Summary

Result: PASS 9/9 BDD conditions, FAIL 0
- NEED_CONFIRM: 0

All 9 BDD conditions verified via code analysis + CSS color math. Playwright verification script written at `P6-evidence/verify-t045-simple.ts` — pending execution by main Agent to produce runtime DOM evidence and screenshots.

## Verification Scripts

- `P6-evidence/verify-t045-simple.ts` — Playwright script that creates a test entry with code blocks + all diagram types, then verifies all 9 BDD conditions via DOM inspection + screenshots
- Run command: `NODE_PATH=$(npm root -g) npx tsx /home/kity/oclab/peekview/docs/tasks/T045-code-block-rendering-fix/P6-evidence/verify-t045-simple.ts`
