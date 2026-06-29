# P1 Progress Log

## 2026-06-30 — Input Analysis

### P0-brief read
- 2 independent enhancements: zebra stripe + overflow menu
- Known risks: dark/light theme, overflow menu interaction mode, HTML render iframe exclusion
- Pruning tendency: conservative (needs P2 design)
- Phase hint: P1-P6

### Codebase analysis
- **CodeViewer.vue**: Uses Shiki `highlight()` → produces `.code-container` with `.line-numbers` + `.line` spans. Zebra stripe can target `.line:nth-child(even/odd)` in `code.css`
- **MarkdownViewer.vue**: Code blocks use `highlightCode()` (no line numbers) wrapped in `.code-block-wrapper`. Shiki output is `<pre><code>` with `.line` spans inside. Zebra stripe needs to target `.code-block-wrapper .line`
- **DiagramBlock.vue**: Code view mode shows `block.codeViewHtml` (Shiki output). Has `.diagram-code` wrapper. Zebra stripe applicable to code view only
- **HtmlViewer.vue**: Uses iframe with `sandbox="allow-scripts"` — zebra stripe CANNOT apply inside iframe (confirmed P0 risk)
- **ActionBar.vue**: Desktop variant with buttons (Copy/Download/Pack/Wrap)
- **EntryDetailView.vue**: Mobile actions bar (`.mobile-actions`) — currently `overflow-x: auto` with hidden scrollbar. Can show up to ~8 buttons on mobile (visibility/share/delete/files/wrap/copy/download/raw/pack/toc). No overflow handling exists.
- **CSS system**: `variables.css` has dark/light theme tokens including `--bg-code`, `--bg-secondary`, `--c-surface-lower`, `--c-surface` — zebra colors should use new CSS variables for both themes
- **Shiki line structure**: `.line` spans with `.line-number` spans — zebra via CSS `:nth-child` is feasible without JS changes

### Implicit needs identified
1. Zebra stripe colors need CSS variables in both themes (variables.css)
2. Wrap mode: zebra must work with variable line heights
3. Markdown inline code (`` ` ``) must NOT get zebra stripe
4. Mermaid/PlantUML diagram render view must NOT get zebra stripe (only code view)
5. Overflow menu needs a new component or pattern (existing DiagramBlock has dropdown pattern to reference)
6. Overflow menu must preserve all button functionality (no feature loss)
7. Touch-friendly target sizes on mobile
8. Overflow menu close behavior (click outside, escape key)

## 2026-06-30 — P1-requirements.md written

- 7 BDD acceptance criteria for zebra stripe (A-AC1 through A-AC7)
- 6 BDD acceptance criteria for overflow menu (B-AC1 through B-AC6)
- 0 [NEED_CONFIRM] items
- 0 [CAPABILITY_GAP] items
- Phases: P1-P6 (skip P7, P8)
- Implicit needs: A1-A5 (zebra), B1-B4 (overflow menu)
