---
phase: P4
task_id: T031-cold-open-performance
type: implementation
parent: P3-test-cases.md
trace_id: T031-P4-20260722
status: draft
created: 2026-07-22
agent: implementer
implementation_dir: frontend-v3/src/
---

# P4 Implementation

## Changed Files

| File | Changes |
|------|---------|
| `frontend-v3/src/components/EntryCard.vue` | card-body div → `<a>` with href + @click.prevent; username router-link → span[role=link] + navigateToUser; meta-sep inline font-family; card-actions @click.stop.prevent; removed role/tabindex/keydown |
| `frontend-v3/src/components/EntryListRow.vue` | root div → `<a>` with href + @click.prevent; username router-link → span[role=link] + navigateToUser; meta-sep inline font-family; entry-actions @click.stop.prevent; removed role/tabindex/keydown |
| `frontend-v3/src/views/EntryListView.vue` | placeholder → English; loading → skeleton (grid: 6 .skeleton-card, list: 6 .skeleton-row); footer .separator font-family; navigateToEntry passes firstFileId query |
| `frontend-v3/src/views/EntryDetailView.vue` | loading → skeleton (header + content); onMounted reads firstFileId from route query, passes to loadEntry; router.replace cleans query |
| `frontend-v3/src/stores/entry.ts` | loadEntry(slug, fileId?, shareToken?) fires getEntry + getFileContent concurrently via Promise.all; fallback serial when speculative content is null |
| `frontend-v3/src/views/LandingView.vue` | Two "Explore" → "Browse public" |
| `frontend-v3/src/components/__tests__/t031-entry-list-view.spec.ts` | Removed unused `computed` import (typecheck fix) |
| `frontend-v3/src/components/__tests__/t031-entry-store.spec.ts` | Removed unused `mount` import (typecheck fix) |

## Self-check Results

- vitest: 16/16 passed
- vue-tsc --noEmit: 0 errors
