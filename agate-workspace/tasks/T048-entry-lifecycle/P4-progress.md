# T048 P4 Progress

## Step 1: entry_service.py — get_entry() archived access control
- Added archived access control after existing visibility check (L329-334)
- Anonymous users get 404 for archived entries
- Non-owner non-admin get 404 for archived entries

## Step 2: entry_service.py — list_entries() status filtering
- Added `status=archived` explicit query access control (admin sees all, owner sees own, anonymous returns empty)
- Default (no status filter): owner sees own archived via OR condition, admin sees all, others see non-archived only

## Step 3: entry_service.py — update_entry() expires_in + archived access control + reactivate
- Added `expires_in` parameter to function signature
- Added archived access control (non-owner non-admin cannot update archived entry)
- Added `was_archived` tracking variable
- Added expires_in handling: reactivate archived entry (status=active, archived_at=None, set expires_at) or update active entry's expires_at

## Step 4: entry_service.py — _build_response() archived_at
- Added `archived_at=entry.archived_at` to EntryResponse construction

## Step 5: entry_service.py — list_entries() EntryListItem archived_at
- Added `archived_at=e.archived_at` to EntryListItem construction

## Step 6: test_entry_lifecycle.py — datetime comparison fixes
- Changed `datetime.now(timezone.utc)` → `datetime.utcnow()` (2 occurrences: L351, L520)
- Changed `datetime.fromisoformat(..."Z", "+00:00")` → `datetime.fromisoformat(..."Z", "")` (2 occurrences: L359, L527)
- Both sides now naive, subtraction works correctly

## Step 7: cleanup test fixtures — env var before create_app
- Added `cleanup_client` fixture (PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS=30)
- Added `retention_zero_client` fixture (PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS=0)
- Both set env vars via monkeypatch before `create_app()` so config is read correctly
- `TestCleanupDeletePhase` → `cleanup_client`, `TestCleanupRetentionZero` → `retention_zero_client`
- Removed `monkeypatch` params from all 6 affected test methods
