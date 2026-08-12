# P4 Implementation — T037: FTS5 Search Content Expansion

## Files Modified

| File | Change |
|------|--------|
| `backend/peekview/database.py` | FTS5 contentless+contentless_delete mode, content column, new triggers, migration, backfill, rebuild with content |
| `backend/peekview/services/entry_service.py` | `_update_fts_content()` method, called after create/update |
| `backend/peekview/main.py` | `backfill_fts_content()` call on startup |
| `frontend-v3/src/components/SearchInput.vue` | Placeholder → "搜索标题、标签和文件内容..." |
| `frontend-v3/src/views/EntryListView.vue` | Placeholder → "搜索标题、标签和文件内容..." |
| `backend/tests/test_database.py` | Updated `test_fts_insert_trigger` for contentless mode (SELECT summary not possible) |
| `backend/tests/test_fts_content.py` | New test file covering all 8 BDD scenarios |

## BDD Coverage

| BDD | Test Class | Status |
|-----|-----------|--------|
| BDD-1: Text file content searchable | `TestBDD1TextFileContentSearchable` | Covered |
| BDD-2: Binary file not indexed | `TestBDD2BinaryFileNotIndexed` | Covered |
| BDD-3: Existing entries backfilled | `TestBDD3BackfillExistingEntries` | Covered |
| BDD-4: FTS syncs after file add/remove | `TestBDD4FTSSyncAfterFileChanges` | Covered |
| BDD-5: Frontend placeholder | `SearchInput.vue` + `EntryListView.vue` | Code-only (P6 visual) |
| BDD-6: Large file truncation | `TestBDD6LargeFileTruncation` | Covered |
| BDD-7: Summary/tags still work | `TestBDD7SummaryTagsStillWork` | Covered |
| BDD-8: Empty entry unaffected | `TestBDD8EmptyEntrySearchUnaffected` | Covered |

## Key Design Decisions

1. **contentless+contentless_delete=1**: No raw content stored in FTS, only inverted index. Supports DELETE operations.
2. **Triggers sync summary/tags only**: Content managed by application layer (`_update_fts_content`).
3. **UPDATE trigger clears content**: `entry_service.update_entry()` re-fills content after commit.
4. **Truncation**: 100K chars/file, 1M chars/entry aggregate.
5. **Migration**: Detects missing `content` column in FTS5, drops old table, `setup_fts5()` creates new structure.
6. **Backfill**: Called from `main.py` after StorageManager is available. Idempotent (skips if FTS count >= entry count).
