---
phase: P3
task_id: T030-frontend-interaction-enhancements
type: test-cases
parent: P2-design.md
trace_id: T030-P3-20260630
status: draft
created: 2026-06-30
---

# T030 P3 Test Cases

## Test Files

| File | Scope | Count |
|------|-------|-------|
| `frontend-v3/src/styles/__tests__/zebra-stripe.spec.ts` | CSS variables + selectors + Shiki structure + MarkdownViewer CSS compatibility | 14 |
| `frontend-v3/src/components/__tests__/zebra-stripe.spec.ts` | CodeViewer .line integration | 4 |
| `frontend-v3/src/components/__tests__/OverflowMenu.spec.ts` | OverflowMenu component | 25 |

## Enhancement A: Zebra Stripe

### TC-A01: CSS variables defined in dark theme
- **BDD**: A-AC1, A-AC4
- **File**: `zebra-stripe.spec.ts`
- **Test**: `--bg-code-odd` and `--bg-code-even` exist in `[data-theme="dark"]` block
- **Expected**: Both variables present; `--bg-code-odd` references `var(--bg-code)` for backward compatibility

### TC-A02: CSS variables defined in light theme
- **BDD**: A-AC1, A-AC4
- **File**: `zebra-stripe.spec.ts`
- **Test**: `--bg-code-odd` and `--bg-code-even` exist in `[data-theme="light"]` block
- **Expected**: Both variables present; `--bg-code-odd` references `var(--bg-code)` for backward compatibility

### TC-A03: CodeViewer nth-child(even) selector in code.css
- **BDD**: A-AC1
- **File**: `zebra-stripe.spec.ts`
- **Test**: `.code-body .line:nth-child(even)` rule exists and uses `--bg-code-even`
- **Expected**: Selector + variable reference present

### TC-A04: Shiki output structure — .line as direct children of <code>
- **BDD**: A-AC1
- **File**: `zebra-stripe.spec.ts`
- **Test**: Parse Shiki HTML, verify `.line` spans are direct children of `<code>`
- **Expected**: No intermediate wrapper elements; nth-child index = line index

### TC-A05: nth-child(even) targets correct line indices
- **BDD**: A-AC1
- **File**: `zebra-stripe.spec.ts`
- **Test**: Verify that nth-child(even) selects lines 2, 4, 6... (even child indices)
- **Expected**: Lines 2 and 4 from 5-line sample

### TC-A06: MarkdownViewer zebra stripe selector
- **BDD**: A-AC2
- **File**: `zebra-stripe.spec.ts`
- **Test**: `.code-block-wrapper .line:nth-child(even)` rule exists in MarkdownViewer unscoped `<style>`
- **Expected**: Selector + `--bg-code-even` reference present

### TC-A07: MarkdownViewer `pre * { transparent !important }` does NOT override zebra
- **BDD**: A-AC2 (CRITICAL from P2 review)
- **File**: `zebra-stripe.spec.ts`
- **Test**: If `pre * { background-color: transparent !important }` exists, verify `.line` zebra has either `!important` override or specificity exception
- **Expected**: Zebra stripe on `.line` elements is not suppressed by the transparent rule

### TC-A08: DiagramBlock zebra stripe selector
- **BDD**: A-AC3
- **File**: `zebra-stripe.spec.ts`
- **Test**: `.diagram-code .line:nth-child(even)` rule exists in DiagramBlock unscoped `<style>`
- **Expected**: Selector + `--bg-code-even` reference present

### TC-A09: CodeViewer renders .line elements
- **BDD**: A-AC1
- **File**: `zebra-stripe.spec.ts` (components)
- **Test**: Mount CodeViewer with multi-line code, verify `.line` spans rendered
- **Expected**: ≥5 `.line` elements in output

### TC-A10: .line elements are direct children of <code>
- **BDD**: A-AC1
- **File**: `zebra-stripe.spec.ts` (components)
- **Test**: Inspect CodeViewer rendered `<code>` element children
- **Expected**: All `.line` spans are direct children

### TC-A11: .line-numbers column is sibling of <pre>, not ancestor of .line
- **BDD**: A-AC4 (zebra doesn't affect line numbers)
- **File**: `zebra-stripe.spec.ts` (components)
- **Test**: Verify `.line-numbers` has no `.line` descendants
- **Expected**: `.line-numbers .line` does not exist

### TC-A12: Wrap mode CSS sets .line height:auto
- **BDD**: A-AC6
- **File**: `zebra-stripe.spec.ts` (components)
- **Test**: code.css contains `.wrap-enabled .line { height: auto }`
- **Expected**: Rule present, enabling zebra bg to cover full wrapped line height

## Enhancement B: Overflow Menu

### TC-B01: Trigger button renders with ⋯ text
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.overflow-trigger` exists with `⋯` content

### TC-B02: Trigger has aria-haspopup and aria-expanded
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `aria-haspopup="true"`, `aria-expanded="false"` when closed

### TC-B03: Trigger has is-open class when menu open
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.is-open` class added on open

### TC-B04: Dropdown not rendered when closed
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.overflow-dropdown` absent

### TC-B05: Dropdown rendered on trigger click
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.overflow-dropdown` present after click

### TC-B06: Dropdown has role="menu"
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Accessibility role attribute

### TC-B07: Correct number of menu items rendered
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.overflow-item` count matches `items` prop length

### TC-B08: Items with href render as <a> with correct attributes
- **BDD**: B-AC3
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `<a>` tag with href, target, rel attributes

### TC-B09: Items without href render as <button>
- **BDD**: B-AC3
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `<button>` tag for action items

### TC-B10: Each item has role="menuitem"
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: All `.overflow-item` elements have `role="menuitem"`

### TC-B11: Icon rendered when item has icon prop
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.item-icon` span present with icon text

### TC-B12: No icon element when item has no icon
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.item-icon` absent

### TC-B13: item-danger class for variant="danger"
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `.item-danger` on delete item

### TC-B14: Toggle opens then closes dropdown
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Click→open, click→close, aria-expanded toggles

### TC-B15: Click outside closes dropdown
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: External click closes menu

### TC-B16: Click inside dropdown does not close
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Dropdown click keeps menu open

### TC-B17: Escape key closes dropdown
- **BDD**: B-AC4
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Escape keydown closes open menu

### TC-B18: Focus returns to trigger after Escape
- **BDD**: B-AC4
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `document.activeElement === trigger.element`

### TC-B19: Escape does nothing when menu closed
- **BDD**: B-AC4
- **File**: `OverflowMenu.spec.ts`
- **Expected**: No crash or state change

### TC-B20: Button item action called and menu closed on click
- **BDD**: B-AC3
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `action()` called once, dropdown hidden

### TC-B21: <a> item closes menu on click
- **BDD**: B-AC3
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Dropdown hidden after clicking link item

### TC-B22: Danger variant item calls action and closes
- **BDD**: B-AC3
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Action called, menu closed

### TC-B23: Event listeners removed on unmount
- **BDD**: B-AC2
- **File**: `OverflowMenu.spec.ts`
- **Expected**: `removeEventListener` called for 'click' and 'keydown'

### TC-B24: Empty items array renders empty dropdown
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Zero `.overflow-item` elements

### TC-B25: Default variant items do not have item-danger class
- **BDD**: B-AC1
- **File**: `OverflowMenu.spec.ts`
- **Expected**: Non-danger items lack `.item-danger`

## BDD Traceability

| BDD AC | Test Cases | Count |
|--------|-----------|-------|
| A-AC1 | TC-A01, A03, A04, A05, A09, A10 | 6 |
| A-AC2 | TC-A06, A07 | 2 |
| A-AC3 | TC-A08 | 1 |
| A-AC4 | TC-A01, A02, A11 | 3 |
| A-AC5 | (CSS exclusion by selector — no .line in inline code) | 0 |
| A-AC6 | TC-A12 | 1 |
| A-AC7 | (iframe isolation — by design, no test needed) | 0 |
| B-AC1 | TC-B01, B07, B11, B12, B13, B24, B25 | 7 |
| B-AC2 | TC-B02, B03, B04, B05, B06, B14, B15, B16, B23, B10 | 10 |
| B-AC3 | TC-B08, B09, B20, B21, B22 | 5 |
| B-AC4 | TC-B17, B18, B19 | 3 |
| B-AC5 | (CSS media query — desktop `display: none`, verified by P6) | 0 |
| B-AC6 | (CSS min-height — touch target, verified by P6) | 0 |

**Total: 43 test cases across 3 test files**

## Notes

- A-AC5 (inline code exclusion) and A-AC7 (iframe isolation) are guaranteed by CSS selector structure (inline code has no `.line` children; iframe has independent CSS). No JS test adds value; P6 Playwright screenshots verify visually.
- B-AC5 (desktop unchanged) and B-AC6 (44px touch targets) are CSS-only properties; P6 screenshot verification covers these.
- TC-A07 is the **critical** test — it ensures the MarkdownViewer `pre * { background-color: transparent !important }` rule (line 246-249 of MarkdownViewer.vue) does not suppress zebra stripe backgrounds on `.line` elements. Implementation must add a more specific rule or `!important` override.
