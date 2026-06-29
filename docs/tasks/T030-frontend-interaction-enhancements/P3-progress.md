# P3 Progress

## 2026-06-30 — Test Designer Start

### Inputs Read
- P1-requirements.md: 13 BDD ACs (A-AC1..A-AC7, B-AC1..B-AC6)
- P2-design.md: CSS nth-child approach for zebra, OverflowMenu.vue new component
- Existing test patterns: BaseButton.spec.ts, CodeViewer.spec.ts, MarkdownViewer.spec.ts, ActionBar.spec.ts
- CRITICAL finding: MarkdownViewer.vue:246-249 has `pre * { background-color: transparent !important }` which will override zebra on .line elements — test must verify this is addressed

### Test Strategy
1. **Zebra stripe tests** (unit): CSS variable existence + Shiki output structure validation
2. **OverflowMenu tests** (unit): Component rendering, props, interaction (toggle, click-outside, Escape, href vs button items)

### Test Files Planned
- `frontend-v3/src/components/__tests__/OverflowMenu.spec.ts`
- `frontend-v3/src/styles/__tests__/zebra-stripe.spec.ts`
- `frontend-v3/src/components/__tests__/zebra-stripe.spec.ts` (Shiki structure + CSS integration)

### Test Files Written
1. `frontend-v3/src/styles/__tests__/zebra-stripe.spec.ts` — 14 tests (CSS vars, selectors, Shiki structure, MarkdownViewer compat, DiagramBlock)
2. `frontend-v3/src/components/__tests__/zebra-stripe.spec.ts` — 4 tests (CodeViewer .line integration)
3. `frontend-v3/src/components/__tests__/OverflowMenu.spec.ts` — 25 tests (rendering, toggle, click-outside, Escape, actions, cleanup)

### Key Findings
- MarkdownViewer.vue:246-249 has `pre * { background-color: transparent !important }` which WILL override zebra on `.line` elements → TC-A07 explicitly tests this
- Shiki output verified: `.line` spans are direct children of `<code>`, nth-child works correctly
- CodeViewer `.line-numbers` is a sibling of `<pre>`, not an ancestor of `.line` → zebra won't bleed into line numbers (TC-A11)

### Deliverable
- P3-test-cases.md: 43 test cases, all BDD ACs traced
