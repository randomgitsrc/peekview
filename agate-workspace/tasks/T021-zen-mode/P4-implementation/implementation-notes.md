# P4 Implementation Notes — T021 zen-mode

## Modified Files

### 1. `frontend-v3/src/utils/zen-shortcut.ts`

- Replaced stub with full implementation of `shouldHandleZenShortcut(event: KeyboardEvent): boolean`
  - Returns `true` for `f`/`F` key when `document.activeElement` is not INPUT, TEXTAREA, contenteditable, or inside `[role="alertdialog"]` / `.confirm-overlay`
  - Returns `true` for `Escape` key regardless of focus (zen exit key)
  - Returns `false` for all other keys
  - Cast `active` to `HTMLElement` for `isContentEditable` access (TS type fix)
- Replaced empty stub with full implementation of `redirectFocusIfHidden(): void`
  - Checks if `document.activeElement` is inside `.detail-header`, `.file-sidebar`, `.toc-sidebar`, or `.mobile-actions`
  - If so, focuses `.content-area` element (which has `tabindex="-1"`)

### 2. `frontend-v3/src/styles/layout.css`

- Added `.zen-mode` CSS rules at end of file (after `@media (min-width: 1024px)` block):
  ```css
  .zen-mode .detail-header,
  .zen-mode .file-sidebar,
  .zen-mode .toc-sidebar,
  .zen-mode .mobile-actions {
    display: none;
  }
  ```
- Specificity 0-2-0 > media query 0-1-0, no `!important` needed

### 3. `frontend-v3/src/views/EntryDetailView.vue`

**Template changes:**
- Root `<div class="entry-detail">` → `<div class="entry-detail" :class="{ 'zen-mode': zenMode }">`
- Added `<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>` as first child of root div
- `<main class="content-area">` → `<main class="content-area" tabindex="-1">`

**Script changes:**
- Import: `onMounted` → `onMounted, onUnmounted`
- Added import: `shouldHandleZenShortcut, redirectFocusIfHidden` from `@/utils/zen-shortcut`
- Added refs: `zenMode = ref(false)`, `zenAriaText = ref('')`
- Added function: `updateZenAria(zen: boolean)` — sets aria text for screen reader
- Added function: `handleZenKeydown(event: KeyboardEvent)` — toggle logic with Esc/f/F handling
- `onMounted`: added `document.addEventListener('keydown', handleZenKeydown)`
- Added `onUnmounted`: `document.removeEventListener('keydown', handleZenKeydown)`

## Deviations from P2 Design

- **TS cast for `isContentEditable`**: P2 design used `active.isContentEditable` directly, but `document.activeElement` is typed as `Element | null` which lacks `isContentEditable`. Added `(active as HTMLElement).isContentEditable` cast. No functional difference.

## Test Results

- vitest: 18/18 passed (all TC-01 through TC-14 + TC-20 through TC-23)
- vue-tsc --noEmit: passed (no type errors)
