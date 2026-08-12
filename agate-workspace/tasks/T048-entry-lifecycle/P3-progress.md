---
phase: P3
task_id: T048-entry-lifecycle
agent: test-designer
---

# P3 Progress Log

## Input Reading

- [x] P0-brief.md: debug_env=make debug-start, :8888, /tmp/peekview-debug/
- [x] P1-requirements.md: 14 BDD conditions (B1-B14)
- [x] P2-design.md: Scheme A (minimal invasive), two-phase cleanup, PATCH expires_in, archived access control
- [x] models.py: EntryStatus has ARCHIVED already; EntryUpdate lacks expires_in; AdminCleanupResponse lacks archived_count
- [x] admin_service.py:115-154: Current cleanup does physical delete only
- [x] entry_service.py:312-336: get_entry checks is_public but not status
- [x] entry_service.py:360-372: list_entries hides archived via status != 'archived'
- [x] entry_service.py:492-551: update_entry lacks expires_in param and archived access control
- [x] share_service.py:38-63: create_share checks expires_at<=now but not status==archived
- [x] config.py:199-210: PeekCleanup lacks archive_retention_days
- [x] conftest.py: autouse isolate_config_file, engine/session/test_config/app/client fixtures
- [x] frontend types/index.ts: status is 'active' | 'expired' (needs change to 'active' | 'archived')
- [x] frontend api/client.ts: transformListItem/transformEntry cast status as 'active' | 'expired'; no updateEntry method

## Key Observations

1. EntryStatus.ARCHIVED already exists in enum — no new enum value needed
2. Current cleanup_expired() does physical delete — must change to two-phase (archive then delete)
3. EntryUpdate schema needs expires_in field
4. AdminCleanupResponse needs archived_count/archived_slugs fields
5. get_entry needs archived access control (owner/admin only)
6. list_entries needs owner-specific OR logic for archived visibility
7. share_service needs status==archived check (not just expires_at)
8. Frontend status type must change from 'expired' to 'archived'
9. Frontend needs updateEntry() API method
10. FTS search already filtered by status != 'archived' in list_entries query

## Test Design

- Backend: pytest async (httpx AsyncClient) following test_admin_stats_cleanup.py pattern
- Frontend: vitest + jsdom, component mount tests for B11-B13
- All 14 BDD conditions mapped to test cases

## Test Execution Results

### Backend (pytest)
- 30 tests collected
- 20 FAILED (true red — implementation not done)
- 10 passed (incidental — current code happens to satisfy some conditions)

Key failures:
- Cleanup: still does physical delete, no archived_count in response
- PATCH: no expires_in support, no reactivate logic
- Access control: no archived status check in get_entry
- List: owner query doesn't include archived entries
- Share: no archived status check

### Frontend (vitest)
- 10 tests collected
- 3 FAILED (api.updateEntry not yet implemented)
- 7 passed (type contract tests with current types)

## Output Files
1. docs/tasks/T048-entry-lifecycle/P3-test-cases.md
2. backend/tests/test_entry_lifecycle.py
3. frontend-v3/src/__tests__/entry-lifecycle.test.ts
