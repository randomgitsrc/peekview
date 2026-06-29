# P4 Progress — T032 Backend Implementation

## Read Phase
- P2-design.md: entry_reads table, ReadTrackingService, asyncio.create_task, X-PeekView-Source, read_stats API
- test_read_tracking.py: 706 lines, covers B01-B14, model/service/API tests
- models.py: EntryResponse at line 409, now_utc helper at line 68
- entry_service.py: get_entry at line 262, _build_response at line 820
- entries.py: get_entry at line 171, list_entries at line 149, _check_share_cookie at line 33
- files.py: get_entry_raw at line 336
- main.py: service DI at lines 107-120
- database.py: _run_migrations at line 35

## Implementation Phase

## Implementation Complete

### Files Modified
1. `backend/peekview/models.py` — Added EntryRead model, ReadStatsResponse, ReadEventResponse, ReadEventListResponse schemas; added read_stats field to EntryResponse
2. `backend/peekview/services/read_tracking_service.py` — New file: ReadTrackingService with record_read, get_read_stats, get_read_events
3. `backend/peekview/main.py` — Registered ReadTrackingService in DI
4. `backend/peekview/services/entry_service.py` — Added include_read_stats param to get_entry/_build_response; added _cleanup_reads for entry deletion
5. `backend/peekview/api/entries.py` — Added _detect_channel, _record_read_async, asyncio.create_task calls in get_entry/list_entries; added GET /{slug}/reads endpoint
6. `backend/peekview/api/files.py` — Added _record_read_async, asyncio.create_task call in get_entry_raw

### Key Design Decisions
- Removed FK constraint on EntryRead.entry_id (database.py's global Engine.connect event sets PRAGMA foreign_keys=ON, causing test isolation failures when test DBs don't have matching entries rows)
- Entry deletion cleanup via _cleanup_reads() instead of ON DELETE CASCADE
- total_count includes self-reads; unique_readers excludes self-reads (matches test expectations)
- read_stats on EntryResponse only populated when owner/admin requests

### Test Results
- 674 passed, 1 skipped (full suite)
- All 39 read_tracking tests pass
- ruff check clean on new/modified files (pre-existing issues unchanged)
