---
phase: P3
task_id: T052-entry-detail-header-redesign
type: test-cases
parent: P2-design.md
trace_id: T052-P3-20260710
status: draft
created: 2026-07-10
agent: test-designer
---

# P3 Test Cases: Entry Detail Header Redesign

## Coverage Map

| BDD | Test ID | Type | Description | Expected RED reason |
|-----|---------|------|-------------|-------------------|
| B1 | T-B01 | vitest | Desktop header 2-row structure with `.title-row` + `.meta-row` | Current template uses `.header-meta-row` + `.header-actions-row` 4-row layout |
| B1 | T-B01-E2E | Playwright | Desktop header height ≤ 80px | Current header ~116px |
| B2 | T-B02 | vitest | Icon-only buttons 32×32 with `.icon-btn` class | Current uses `BaseButton size="small"` (labeled, 34px) |
| B3 | T-B03 | vitest | Files toggle uses `isFileTreeOpen` ref, conditional on `isMultiFile` | Current uses `showFileSidebar` computed (always on) |
| B4 | T-B04 | vitest | TOC toggle uses `isTocOpen` ref, conditional on markdown+headings | Current uses `showTocSidebar` computed (always on) |
| B5 | T-B05 | vitest | Toggle buttons have `.active` class binding | Active state class doesn't exist |
| B5 | T-B05-E2E | Playwright | Click Files/TOC toggle → sidebar opens + active class toggles | No toggle buttons in current header |
| B6 | T-B06 | vitest | Meta row has pipe separator between two groups | Current meta row has no pipe; all items dot-separated |
| B7 | T-B07 | vitest | overflowItems has hint, divider, Lucide icon names | Current interface lacks hint/divider; uses emoji strings |
| B7 | T-B07-E2E | Playwright | More▾ dropdown shows correct items per owner/guest role | More▾ dropdown not in current desktop header |
| B8 | T-B08 | vitest | Mobile bottom bar uses `.mobile-bottom-bar` class, 48px layout | Current uses `.mobile-actions` with `.mobile-info` + `.mobile-buttons` |
| B8 | T-B08-E2E | Playwright | Mobile bottom bar layout [Files(N)] [flex] [buttons] [...] | Current layout is different |
| B9 | T-B09 | vitest | Bottom bar buttons switch by file type (md/code/binary) | Current shows all buttons unconditionally |
| B9 | T-B09-E2E | Playwright | Visual verification of different file type bottom bars | Dynamic switching not implemented |
| B10 | T-B10 | vitest | Mobile sticky header `.mobile-sticky-header` with backdrop-filter | No sticky header element in current mobile |
| B10 | T-B10-E2E | Playwright | Mobile sticky header 52px visible on scroll | Not implemented |
| B11 | T-B11 | vitest | Meta-tags-bar uses IntersectionObserver for scroll-hide | Current uses scroll event on `.markdown-viewer` |
| B12 | T-B12 | vitest | ThemeToggle item in overflowItems Lucide + hint | Theme not in overflowItems; current uses emoji |
| B12 | T-B12-E2E | Playwright | Mobile [...] opens bottom sheet with theme toggle | Bottom sheet not implemented |
| B13 | T-B13 | vitest | ThemeToggle standalone in title-row actions-area | Current ThemeToggle in header-right after actions row |
| B14 | T-B14 | vitest | overflowItems same list shared across variants | Variant prop doesn't exist on OverflowMenu |
| B15 | T-B15 | vitest | Icon names are Lucide strings, not emoji | Current uses emoji strings |
| B15 | T-B15-E2E | Playwright | No emoji characters rendered as icons | Current page renders emoji icons |
| B16 | T-B16 | vitest | Share in title-row as icon-only, conditional on owner | Current Share is labeled button in actions-row |

## Test File Structure

```
P3-test-code/
├── header-redesign.test.ts        — Vitest unit tests (18 groups)
├── header-redesign.e2e.spec.ts    — Playwright E2E tests (8 specs)
└── evidences/                     — E2E screenshots (created at runtime)
```

## BDD-to-Test Mapping (B1-B16 + S1-S2)

### B1: Desktop header height ≤ 80px
- T-B01: `.detail-header` contains `.title-row` and `.meta-row` sub-elements; no `.header-right` 4-row structure

### B2: Desktop icon-only buttons 32×32
- T-B02: Title-row buttons use `icon-btn` CSS class; width/height constraints 32px

### B3: Files toggle only for multi-file
- T-B03: `isFileTreeOpen` ref + `isMultiFile` computed → conditional toggle

### B4: TOC toggle only for markdown with headings
- T-B04: `isTocOpen` ref + `isMarkdown && tocHeadings.length > 0` → conditional toggle

### B5: Files/TOC toggle active state
- T-B05: Toggle buttons bind active class to isFileTreeOpen/isTocOpen

### B6: Meta row pipe separator
- T-B06: `.meta-row` has two groups with pipe (│) or CSS border separator

### B7: More▾ dropdown correct items
- T-B07: overflowItems includes hint/divider; owner items differ from guest items

### B8: Mobile bottom bar 48px
- T-B08: `.mobile-bottom-bar` has flex layout: files-btn + spacer + dynamic + overflow

### B9: Bottom bar dynamic by file type
- T-B09: Three conditional branches (md/code/binary) produce different button sets

### B10: Mobile sticky header 52px
- T-B10: `.mobile-sticky-header` with `position: sticky; backdrop-filter: blur(16px)`

### B11: Meta-tags-bar scroll hide
- T-B11: IntersectionObserver observes sentinel; `.hidden` class toggles opacity

### B12: ThemeToggle in mobile overflow sheet
- T-B12: overflowItems contains theme item with moon/sun Lucide icon name

### B13: ThemeToggle desktop in title-row
- T-B13: Standalone `<ThemeToggle />` inside title-row's actions-area

### B14: Overflow content same desktop/mobile
- T-B14: Same overflowItems computed used for both variants; only variant prop changes

### B15: Lucide SVG replaces emoji
- T-B15: icon fields use Lucide component names, not emoji strings

### B16: Share button only owner in title-row
- T-B16: Share icon-only button in title-row, visible only to owner

### S1: lucide-vue-next install
- T-S1: `lucide-vue-next` import resolves correctly

### S2: Old header tests replaced
- T-S2: Existing `header-layout.test.ts` no longer contains old structure assertions
