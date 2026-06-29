
## 2026-06-30 P4 Implementation

- Read P1-requirements.md, EntryDetailView.vue, EntryCard.vue, EntryListRow.vue, BaseTag.vue, expires.ts
- Created composables/useRelativeTime.ts (formatRelativeTime + formatFullDate + useRelativeTime composable with auto-refresh)
- Modified EntryDetailView.vue: added tags row (BaseTag + TAG_LIMIT=3 +N), added title tooltip on time, replaced inline formatRelativeTime with composable
- Modified EntryCard.vue: replaced toLocaleDateString with useRelativeTime composable
- Modified EntryListRow.vue: replaced toLocaleDateString with useRelativeTime composable
- vue-tsc --noEmit: PASS
- Output: P4-implementation/changes.md
