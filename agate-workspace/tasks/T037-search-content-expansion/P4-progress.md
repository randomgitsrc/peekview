# P4 Progress — T037

## Phase: P3+P4 (TDD + Implementation)

### Completed
- [x] database.py: FTS5 contentless+contentless_delete mode with content column
- [x] database.py: New triggers (INSERT with content='', DELETE via rowid, UPDATE delete+insert)
- [x] database.py: Migration to detect old FTS5 and drop for rebuild
- [x] database.py: `_aggregate_entry_content()` with truncation
- [x] database.py: `backfill_fts_content()` idempotent startup function
- [x] database.py: `rebuild_fts_index()` with optional storage param
- [x] database.py: `FTS_CONTENT_TRUNCATE=100_000`, `FTS_CONTENT_MAX_PER_ENTRY=1_000_000`
- [x] entry_service.py: `_update_fts_content()` method
- [x] entry_service.py: Called after `create_entry()` success
- [x] entry_service.py: Called after `update_entry()` commit
- [x] main.py: `backfill_fts_content()` call on startup
- [x] SearchInput.vue: Placeholder updated
- [x] EntryListView.vue: Placeholder updated
- [x] test_database.py: Updated `test_fts_insert_trigger` for contentless mode
- [x] test_fts_content.py: New test file (8 BDD + rebuild + contentless mode tests)

### Awaiting P5 Gate
- pytest run
- ruff lint
- vue-tsc typecheck
