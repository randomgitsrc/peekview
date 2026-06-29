---
phase: P4
task_id: T030-frontend-interaction-enhancements
type: implementation
parent: P2-design.md
trace_id: T030-P4-20260630
status: draft
created: 2026-06-30
---

# T030 P4 Implementation: Changes

## Files Modified

| File | Change | Trace |
|------|--------|-------|
| `frontend-v3/src/styles/variables.css` | Added `--bg-code-odd` / `--bg-code-even` to both `[data-theme="dark"]` and `[data-theme="light"]` blocks | §1.3 |
| `frontend-v3/src/styles/code.css` | Added `.code-body :deep(.line:nth-child(even))` rule with `--bg-code-even` | §1.4 CodeViewer |
| `frontend-v3/src/components/MarkdownViewer.vue` | Added `.code-block-wrapper .line:nth-child(even)` zebra rule + `[data-theme='dark']` `!important` override (CRITICAL fix from P2 review) | §1.4 MarkdownViewer + P2-review CRITICAL |
| `frontend-v3/src/components/DiagramBlock.vue` | Added `.diagram-code .line:nth-child(even)` zebra rule | §1.4 DiagramBlock |
| `frontend-v3/src/components/OverflowMenu.vue` | New component: dropdown menu with click-outside, Escape, focus management, `<a>`/`<button>` rendering | §2.3 |
| `frontend-v3/src/views/EntryDetailView.vue` | Restructured mobile-actions: primary buttons (Files/Wrap/Copy) + OverflowMenu for secondary; added `overflowItems` computed; imported OverflowMenu | §2.6 |
| `frontend-v3/src/styles/layout.css` | Removed `overflow-x: auto`, `scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar` from `.mobile-actions` | §2.7 |

## CRITICAL Fix Applied

MarkdownViewer dark mode `pre * { background-color: transparent !important }` would suppress zebra stripe. Fixed by adding:
```css
[data-theme='dark'] .markdown-body .code-block-wrapper .line:nth-child(even) {
  background-color: var(--bg-code-even) !important;
}
```
This uses both higher specificity (`[data-theme='dark'] .markdown-body .code-block-wrapper .line:nth-child(even)`) AND `!important` to win over the wildcard `pre *` rule.

## BDD AC Trace

| AC | Implementation | Status |
|----|---------------|--------|
| A-AC1 | `.code-body :deep(.line:nth-child(even))` in code.css | Done |
| A-AC2 | `.code-block-wrapper .line:nth-child(even)` in MarkdownViewer + dark `!important` | Done |
| A-AC3 | `.diagram-code .line:nth-child(even)` in DiagramBlock | Done |
| A-AC4 | `--bg-code-odd`/`--bg-code-even` in both `[data-theme]` blocks | Done |
| A-AC5 | Inline code has no `.line` children — by selector design | N/A |
| A-AC6 | `.line { height: auto }` in wrap mode + `background-color` covers full height | Existing |
| A-AC7 | iframe isolation — by design | N/A |
| B-AC1 | Primary buttons + OverflowMenu replace horizontal scroll | Done |
| B-AC2 | `toggle()` + `handleClickOutside()` + Escape handler | Done |
| B-AC3 | `<a>` for href items, `action()` callback for button items | Done |
| B-AC4 | Escape closes menu + focus returns to trigger | Done |
| B-AC5 | `.mobile-actions { display: none }` at desktop unchanged | Unchanged |
| B-AC6 | `min-height: 44px` on `.overflow-item` and `.overflow-trigger` | Done |
