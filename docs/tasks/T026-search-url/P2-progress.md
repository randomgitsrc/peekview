# P2 Progress Log — T026 search-url

## Step 1: Read architect role + project conventions
- **architect.md**: P2 role = translate P1 requirements into implementable design; must declare `packages`, `domains`, `ui_affected`, `gate_commands`, `files_to_read`, `minimal_validation`
- **AGENTS.md**: Confirmed no special constraints beyond what we already know; frontend routes are `src/router.ts`, view URLs are `/:slug`
- **P0-brief.md**: env_constraints confirmed — debug backend on :8888, vitest run, vue-tsc, npm run build, Playwright via `make debug-test`
- **P1-requirements.md**: 16 BDD conditions, phases [P2,P3,P4,P5,P6], skip P7/P8

## Step 2: Read EntryListView.vue (current state)
Key findings:
- **setOwner() (line 249-260)**: Uses `router.replace({ path: '/explore', query: { owner } })` which **replaces all query params** — this is the root bug. Switching to Mine tab while searching destroys `?q=`.
- **clearOwnerFilter() (line 262-267)**: Same issue — `router.replace({ path: '/explore' })` destroys all query params.
- **restoreFromURL() (line 380-388)**: Only reads `owner` from URL. Does NOT read `q` or `page`.
- **currentPage watcher (line 356-358)**: Only calls `loadEntries`, does NOT write `?page=` to URL. This is the "implied gap" P1 identified.
- **onMounted (line 390-403)**: Sets `currentPage = 1` (not from URL), then calls `restoreFromURL()` for owner only.
- **authState watcher (line 368-378)**: Only handles `owner=me` auto-detect. Doesn't restore `q`.
- **Empty state (lines 56-63)**: Already has both "No entries from @username" and "No entries found". BDD-10's empty search on `/explore` already shows correct message. No change needed.
- **No search input UI exists** in template.

## Step 3: Read router.ts
- `/explore` route → EntryListView.vue (no props)
- `/users/:username` route → EntryListView.vue with `owner` prop
- Both use same component — search must work on both.
- All routes use `createWebHistory()` — URL query params are natively supported.

## Step 4: Read stores/entry.ts
- `loadEntries(params?: ListEntriesParams)` already accepts `q`, `owner`, `page`, `perPage`.
- Store has `page`, `perPage`, `total` refs already.
- **No store changes needed** for searchQuery — it's UI-only local state.
- Confirmed: `loading`, `error`, `entries`, `total`, `perPage` all exposed via `storeToRefs`.

## Step 5: Read client.ts + types
- `api.listEntries()` maps `q` param correctly: `params: { q: params?.q, ... }`
- `ListEntriesParams` already has `q?: string` field.
- API already ready for search — just need frontend UI and URL sync.

## Step 6: Read Pagination.vue
- Pagination emits `update:page` via `v-model:page` — EntryListView's `currentPage` is already bound.
- Pagination doesn't know about URL — URL sync is EntryListView's responsibility.
- No changes needed to Pagination component.

## Step 7: Read useDebounce composable
- Simple function-based composable: `useDebounce(fn, delay)` returns a wrapped function.
- Existing tests in `useDebounce.spec.ts` cover basic debounce behavior.
- Perfect fit for our search debounce — no new composable needed.

## Step 8: Read existing test patterns
- `EntryListView.logic.spec.ts`: Pure logic functions tested in isolation (no Vue mount). Pattern: extract pure functions, test them with vitest.
- Test pattern to follow for P3.

## Design decisions summary:
1. **updateURL() merge function**: New pure function to merge params with existing URL query
2. **searchQuery**: Local `ref<string>('')` in EntryListView, NOT in store
3. **currentPage URL sync**: Extend watcher to write `?page=` to URL
4. **restoreFromURL()**: Extended to read `q` and `page` from URL
5. **Debounce**: Reuse existing `useDebounce` composable
6. **Empty state**: No change needed (existing logic handles search correctly)
7. **No new component**: Search input inline in EntryListView template (simple enough)
