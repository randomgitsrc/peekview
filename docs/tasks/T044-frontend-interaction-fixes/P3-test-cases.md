---
phase: P3
task_id: T044-frontend-interaction-fixes
type: test-cases
trace_id: T044-P3-20260701
status: draft
agent: test-designer
created: 2026-07-01
parent: P1-requirements.md
---

## Test Cases

### Group 1: zen-shortcut modifier key filtering (B01-B06)

| TC# | BDD | Description | Input | Expected |
|-----|-----|-------------|-------|----------|
| TC-15 | B01 | Ctrl+F does not trigger zen mode | key='f', ctrlKey=true | shouldHandleZenShortcut → false |
| TC-16 | B01 | Cmd+F (macOS) does not trigger zen mode | key='f', metaKey=true | shouldHandleZenShortcut → false |
| TC-17 | B02 | Plain F key still triggers zen mode | key='f', no modifiers | shouldHandleZenShortcut → true |
| TC-18 | B03 | Ctrl+Shift+F does not trigger zen mode | key='f', ctrlKey=true, shiftKey=true | shouldHandleZenShortcut → false |
| TC-19 | B04 | Alt+F does not trigger zen mode | key='f', altKey=true | shouldHandleZenShortcut → false |
| TC-20 | B05 | Escape with Ctrl still triggers zen mode | key='Escape', ctrlKey=true | shouldHandleZenShortcut → true |
| TC-21 | B05 | Escape with Alt still triggers zen mode | key='Escape', altKey=true | shouldHandleZenShortcut → true |
| TC-22 | B06 | F key + input focus still does not trigger | key='f', no modifiers, input focused | shouldHandleZenShortcut → false |

### Group 2: viewMode persistence (B07-B11)

| TC# | BDD | Description | Input | Expected |
|-----|-----|-------------|-------|----------|
| TC-30 | B07 | Switching to list writes 'list' to localStorage | viewMode='grid', switch to 'list' | localStorage.setItem('peekview-view-mode', 'list') called |
| TC-31 | B08 | Reading 'list' from localStorage initializes viewMode as 'list' | localStorage has 'list' | viewMode initialized to 'list' |
| TC-32 | B09 | No localStorage value defaults to 'grid' | localStorage has no key | viewMode initialized to 'grid' |
| TC-33 | B10 | Invalid localStorage value falls back to 'grid' | localStorage has 'table' | viewMode initialized to 'grid' |
| TC-34 | B11 | Switching back to grid writes 'grid' to localStorage | viewMode='list', switch to 'grid' | localStorage.setItem('peekview-view-mode', 'grid') called |

### Test file mapping

| File | TCs | Pattern |
|------|-----|---------|
| `frontend-v3/src/utils/__tests__/zen-shortcut.spec.ts` | TC-15..TC-22 | Extend existing makeKeyboardEvent(), add to existing describe block |
| `frontend-v3/src/views/__tests__/EntryListView.viewmode.spec.ts` | TC-30..TC-34 | Pure function testing (extract persistence logic), mock localStorage |

### TDD red-light expectation

- **zen-shortcut.spec.ts**: TC-15..TC-22 will fail with assertion errors because `shouldHandleZenShortcut` currently ignores modifier keys — e.g. TC-15 expects `false` but current code returns `true` for Ctrl+F.
- **EntryListView.viewmode.spec.ts**: TC-30..TC-34 will fail because the persistence functions (`loadViewMode`, `saveViewMode`) do not exist yet — import failure (B-type red light).
