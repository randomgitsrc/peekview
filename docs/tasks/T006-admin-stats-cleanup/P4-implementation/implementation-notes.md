# T006 admin-stats-cleanup — P4 Implementation Notes

## Modified Files

| File | Change |
|------|--------|
| `backend/peekview/services/admin_service.py` | **NEW** — AdminService with get_stats() and cleanup_expired() |
| `backend/peekview/api/admin.py` | **NEW** — router with GET /stats and POST /cleanup, both Depends(require_admin) |
| `backend/peekview/models.py` | **MOD** — Added EntryStats, ApiKeyStats, StorageStats, AdminStatsResponse, AdminCleanupResponse |
| `backend/peekview/main.py` | **MOD** — Import admin router + include_router; create AdminService → app.state.admin_service |
| `backend/peekview/cli.py` | **MOD** — Added `admin` subgroup with `stats` and `cleanup` commands (local + remote + --json-output) |
| `backend/peekview/client.py` | **MOD** — Added admin_stats() and admin_cleanup() methods |
| `backend/tests/test_admin_stats_cleanup.py` | **NEW** — 17 tests covering all 14 BDD conditions |

## Test Results

- New tests: 17/17 passed
- Full suite: 539 passed, 1 skipped (pre-existing), 0 failures
- No regressions

## BDD Coverage

| BDD ID | Status |
|--------|--------|
| STATS-1 | ✅ test_stats_returns_all_fields + test_stats_counts_match_data |
| STATS-2 | ✅ test_non_admin_get_stats_403 |
| STATS-3 | ✅ test_unauthenticated_get_stats_401 |
| STATS-4 | ✅ test_admin_stats_local_runs |
| STATS-5 | ✅ test_admin_stats_remote_mode_flag |
| STATS-6 | ✅ test_admin_stats_json_output |
| STATS-7 | ✅ test_stats_empty_system |
| STATS-8 | ✅ test_stats_performance_1000_entries |
| CLEANUP-1 | ✅ test_cleanup_deletes_expired_entries |
| CLEANUP-2 | ✅ test_cleanup_no_expired_entries |
| CLEANUP-3 | ✅ test_cleanup_idempotent_two_calls |
| CLEANUP-4 | ✅ test_non_admin_cleanup_403 |
| CLEANUP-5 | ✅ test_unauthenticated_cleanup_401 |
| CLEANUP-6 | ✅ test_admin_cleanup_local_runs |
| CLEANUP-7 | ✅ test_admin_cleanup_remote_mode_flag |
| CLEANUP-8 | ✅ test_cleanup_preserves_active_entries |
