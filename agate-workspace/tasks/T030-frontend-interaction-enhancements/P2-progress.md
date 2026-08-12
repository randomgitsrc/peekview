# T030 P2 Progress Log

## 2026-06-30 — Input Reading

### P1 Requirements Summary
- 13 BDD AC: A-AC1~7 (zebra stripe) + B-AC1~6 (overflow menu)
- Packages: peekview-frontend only
- Domains: frontend only
- P7/P8 pruned (no cross-package risk, no version bump needed)

### Code Analysis Findings

**Shiki Output Structure (verified)**
- `codeToHtml()` produces: `<pre class="shiki ..."><code><span class="line">...</span>\n<span class="line">...</span></code></pre>`
- Each line is a `<span class="line">` — perfect for `nth-child(even)` zebra targeting
- `highlight()` (CodeViewer) wraps with `.code-container > .line-numbers + pre > code > .line`
- `highlightCode()` (Markdown code blocks) produces bare `pre > code > .line` (no line numbers)

**CSS Variable System**
- `variables.css`: Two theme blocks `[data-theme="dark"]` and `[data-theme="light"]`
- `--bg-code` exists in both themes (dark: `var(--c-surface-lower)` = `#0e131b`, light: `var(--c-surface-lower)` = `#eef0f3`)
- Zebra needs `--bg-code-odd` and `--bg-code-even` added to both theme blocks

**CodeViewer Structure**
- `code.css`: `.code-body :deep(.line)` has `height: 1.6em` (fixed), wrap mode sets `height: auto; min-height: 1.6em`
- `.line-numbers` has independent `background: var(--bg-secondary)` — zebra must NOT bleed into line numbers
- `.code-container` uses `display: flex` — line numbers and code are siblings, not parent-child

**MarkdownViewer Code Blocks**
- `useMarkdown.ts`: `buildCodeBlockWrapper()` wraps highlighted code in `.code-block-wrapper > .code-block-header + pre`
- Shiki output inside: `pre.shiki > code > .line` — same `.line` class as CodeViewer
- No line numbers column — simpler zebra targeting

**DiagramBlock Code View**
- `DiagramBlock.vue`: `.diagram-code > div > pre.shiki > code > .line`
- `codeViewHtml` built in `useMarkdown.ts` — same Shiki output structure
- No line numbers column

**Mobile Actions Bar**
- `layout.css`: `.mobile-actions` uses `overflow-x: auto; scrollbar-width: none` (hidden scrollbar)
- Currently all buttons are direct children of `.mobile-actions`
- Buttons: owner actions (visibility/share/delete) + Files + Wrap + Copy + Download + Raw + Pack + TOC
- Max button count (owner + code file): ~9 buttons — definitely overflows on mobile
- Desktop: `.mobile-actions { display: none }` at `min-width: 1024px`

**DiagramBlock Dropdown Pattern (reference for OverflowMenu)**
- Uses `isMenuOpen` ref + click-outside handler
- CSS: `.diagram-dropdown-menu` with `position: absolute; top: 100%; right: 0; display: none`
- `.show` class toggles visibility
- No Escape key support currently (P1 B-AC4 requires it)

**BaseButton**
- Renders `<a>` when `href` prop provided, `<button>` otherwise
- `Raw` button uses `href` prop → renders as `<a>` tag
- OverflowMenu must preserve this behavior (B-AC3)

## 2026-06-30 — Design Decisions

### Enhancement A: Zebra Stripe

**Approach**: Pure CSS `nth-child(even)` on `.line` elements + CSS custom properties
- No JS needed — Shiki already outputs `<span class="line">` per line
- `nth-child(even)` works because `.line` elements are direct children of `<code>`
- Wrap mode: `.line` already has `height: auto` with `background` covering full height

**CSS Variable Design**:
- Light: `--bg-code-odd: var(--bg-code)` (= `#eef0f3`), `--bg-code-even: #e8ebef` (slightly darker)
- Dark: `--bg-code-odd: var(--bg-code)` (= `#0e131b`), `--bg-code-even: #131920` (slightly lighter)
- Odd lines use existing `--bg-code` for backward compatibility; even lines get subtle shift

**Selector Strategy**:
- CodeViewer: `.code-body :deep(.line:nth-child(even))` — targets code lines only, not line numbers
- MarkdownViewer: `.markdown-body .code-block-wrapper .line:nth-child(even)` — scoped to code blocks
- DiagramBlock: `.diagram-block .diagram-code .line:nth-child(even)` — scoped to diagram code view
- Inline code: `code:not(pre code)` — not affected (no `.line` children)

**Key Insight**: `.line` elements are inside `<code>`, which is inside `<pre>`. Line numbers are in a separate `<div class="line-numbers">` sibling. So zebra on `.line` cannot bleed into line numbers.

### Enhancement B: Overflow Menu

**Primary/Secondary Button Classification**:
- Primary (always visible): Files, Wrap, Copy (high-frequency view operations)
- Secondary (overflow): Download, Raw, Pack, TOC, owner actions (visibility/share/delete)
- Rationale: View/copy are the most frequent actions; download/raw/pack are lower frequency; owner actions are contextual

**Component Design**: `OverflowMenu.vue`
- Props: `items` (array of menu item configs)
- Each item: `{ label: string, icon?: string, action: () => void, href?: string, variant?: string }`
- Renders a trigger button (⋯) + dropdown menu
- Dropdown positioned `bottom-right` (above the action bar, not below — action bar is at page bottom)
- Click-outside + Escape to close
- Menu items rendered as `<a>` or `<button>` based on `href` presence (preserving BaseButton behavior)

**Mobile Actions Restructure**:
- Primary buttons remain as direct children of `.mobile-actions`
- Secondary buttons moved into `<OverflowMenu>` component
- OverflowMenu trigger button replaces the hidden scrollbar approach
- Desktop: entire `.mobile-actions` hidden (unchanged)

**Touch Target Compliance (B-AC6)**:
- Menu items: `min-height: 44px; padding: 12px 16px`
- Trigger button: `min-width: 44px; min-height: 44px`
