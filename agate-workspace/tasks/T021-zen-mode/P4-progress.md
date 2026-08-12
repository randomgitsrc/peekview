
## Step 1: zen-shortcut.ts implementation — DONE
- Implemented shouldHandleZenShortcut: f/F key with focus exclusion (INPUT/TEXTAREA/contenteditable/alertdialog/confirm-overlay), Escape always true, other keys false
- Implemented redirectFocusIfHidden: checks activeElement.closest for hidden containers, redirects to .content-area
- TS fix: cast active to HTMLElement for isContentEditable access

## Step 2: layout.css zen-mode rules — DONE
- Added .zen-mode CSS rules at end of file (after @media min-width:1024px block)
- Specificity 0-2-0 > media query 0-1-0, no !important

## Step 3: EntryDetailView.vue zen integration — DONE
- Template: :class binding on root div, aria-live sr-only span, tabindex=-1 on content-area main
- Script: zenMode/zenAriaText refs, updateZenAria, handleZenKeydown, onMounted/onUnmounted keydown listener
- Import: added onUnmounted, shouldHandleZenShortcut, redirectFocusIfHidden

## Verification
- vitest: 18/18 passed
- vue-tsc --noEmit: passed
