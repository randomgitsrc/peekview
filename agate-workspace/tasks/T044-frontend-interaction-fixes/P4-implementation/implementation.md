---
phase: P4
task_id: T044-frontend-interaction-fixes
type: implementation
trace_id: T044-P4-20260701
status: draft
agent: implementer
created: 2026-07-01
parent: P3-test-cases.md
---

## Changes

### 1. `frontend-v3/src/utils/zen-shortcut.ts`

Added modifier key filtering for F key branch in `shouldHandleZenShortcut`.

**What**: After the existing `if (event.key === 'Escape') return true` line, added `if (event.ctrlKey || event.metaKey || event.altKey) return false`.

**Why**: The function previously only checked `event.key`, so Ctrl+F / Cmd+F / Alt+F all matched the `'f'` key and returned true, causing zen mode to hijack browser search. The filter is placed after the Escape early-return so Escape with modifiers (Ctrl+Escape, Alt+Escape) still exits zen mode (B05). This satisfies B01-B06.

### 2. `frontend-v3/src/composables/useViewMode.ts` (new file)

Created a composable with `loadViewMode()` and `saveViewMode()` functions.

**What**: `loadViewMode()` reads `peekview-view-mode` from localStorage, validates against `['grid', 'list']`, falls back to `'grid'` for missing or invalid values. `saveViewMode()` writes the mode to localStorage.

**Why**: Extracting persistence logic into testable pure functions (not a Vue composable returning refs) matches the test file's import pattern (`import { loadViewMode, saveViewMode } from '../../composables/useViewMode'`). Validation handles P1 implicit requirement #2 (invalid value fallback) and #3 (first-visit default).

### 3. `frontend-v3/src/views/EntryListView.vue`

**What**: 
- Imported `loadViewMode` and `saveViewMode` from `@/composables/useViewMode`
- Changed `viewMode` initialization from `ref<'grid' | 'list'>('grid')` to `ref<'grid' | 'list'>(loadViewMode())`
- Added `watch(viewMode, ...)` that calls `saveViewMode(mode)` on change

**Why**: Reading from localStorage on init restores the persisted view mode (B08, B09, B10). Writing on change persists it (B07, B11). The watch approach triggers on both the grid/list toggle buttons and any programmatic changes.

## Test Coverage Mapping

| TC | BDD | Covered by |
|----|-----|-----------|
| TC-15 | B01 | zen-shortcut.ts: ctrlKey filter |
| TC-16 | B01 | zen-shortcut.ts: metaKey filter |
| TC-17 | B02 | zen-shortcut.ts: no modifier → passes through |
| TC-18 | B03 | zen-shortcut.ts: ctrlKey+shiftKey → ctrlKey true → filtered |
| TC-19 | B04 | zen-shortcut.ts: altKey filter |
| TC-20 | B05 | zen-shortcut.ts: Escape returns true before modifier check |
| TC-21 | B05 | zen-shortcut.ts: Escape returns true before modifier check |
| TC-22 | B06 | zen-shortcut.ts: existing input focus logic unchanged |
| TC-30 | B07 | EntryListView.vue: watch + saveViewMode |
| TC-31 | B08 | useViewMode.ts: loadViewMode reads valid 'list' |
| TC-32 | B09 | useViewMode.ts: loadViewMode defaults to 'grid' |
| TC-33 | B10 | useViewMode.ts: loadViewMode rejects 'table' |
| TC-34 | B11 | EntryListView.vue: watch + saveViewMode |
