---
phase: P4
task_id: T036-detail-info-completeness
type: implementation
parent: P1-requirements.md
trace_id: T036-P4-20260630
status: draft
created: 2026-06-30
---

# T036 P4 Implementation: Detail Info Completeness

## Changes

### 1. New file: `frontend-v3/src/composables/useRelativeTime.ts`

Extracted `formatRelativeTime` from EntryDetailView into shared composable. Provides:
- `formatRelativeTime(dateStr)` — pure function, same logic as before
- `formatFullDate(dateStr)` — `toLocaleString()` for tooltip
- `useRelativeTime(dateRef)` — reactive composable with 60s auto-refresh + watch on source ref

### 2. Modified: `frontend-v3/src/views/EntryDetailView.vue`

- **Tags row**: Added `<div class="header-tags">` after `<h1>` with `BaseTag` components + `+N` overflow (TAG_LIMIT=3, matching EntryCard/EntryListRow)
- **Time tooltip**: Changed time `<span>` to use `:title="fullTime"` for native tooltip showing full date
- **Relative time**: Replaced inline `formatRelativeTime()` with `useRelativeTime` composable (reactive, auto-refreshes)
- **Imports**: Added `BaseTag`, `useRelativeTime`
- **Removed**: Inline `formatRelativeTime` function (lines 599-618)
- **Styles**: Added `.header-tags`, `.tag-overflow`, `.entry-time { cursor: default }`

### 3. Modified: `frontend-v3/src/components/EntryCard.vue`

- Replaced `date.toLocaleDateString()` with `useRelativeTime` composable for consistent relative time display
- Added `toRef` import, `useRelativeTime` import

### 4. Modified: `frontend-v3/src/components/EntryListRow.vue`

- Replaced `date.toLocaleDateString()` with `useRelativeTime` composable for consistent relative time display
- Added `toRef` import, `useRelativeTime` import

## BDD Coverage

| BDD | Implementation |
|-----|---------------|
| BDD-1: Detail shows tags | `header-tags` div with `BaseTag` components |
| BDD-2: Tags fold at threshold | `TAG_LIMIT=3` + `+N` overflow, same as EntryCard |
| BDD-3: No tags = no render | `v-if="currentEntry?.tags?.length"` |
| BDD-4: Relative time + tooltip | `:title="fullTime"` on time span |
| BDD-5: Time formatting consistent | All three use `useRelativeTime` composable |
| BDD-6: formatRelativeTime extracted | `composables/useRelativeTime.ts` |

## Verification

- `vue-tsc --noEmit`: PASS (no errors)
