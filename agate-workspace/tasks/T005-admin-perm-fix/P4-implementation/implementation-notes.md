# T005 admin-perm-fix — P4 Implementation Notes

## Modified Files

### 1. `backend/peekview/auth.py`
- **Added `require_admin` dependency function** (after `require_auth`)
- Chains `require_auth` → checks `user.is_admin` → raises `ForbiddenError(403)` if not admin
- Includes docstring clarifying semantic distinction: require_admin = "must be logged in AND must be admin", vs get_current_user + is_admin passed to service (visibility filtering, not 403)

### 2. `backend/peekview/api/files.py`
- **Removed** direct DB query + hand-written visibility check (`entry.is_public and entry.owner_id != current_user_id`)
- **Added** `_resolve_entry()` helper that:
  - For global API key auth: fetches entry directly from DB (bypasses visibility, consistent with entries.py pattern)
  - For all other requests: calls `entry_service.get_entry(slug, current_user_id, is_admin)` — single source of truth for visibility
  - Returns `entry_id` on success, propagates `NotFoundError` on failure
- **Added** `_is_global_api_key_auth()` and `_looks_like_jwt()` (mirrored from entries.py — same pattern for global API key detection)
- **Added** `_get_service()` helper (DI pattern via `get_entry_service(request.app)`)
- Both `download_file` and `get_file_content` endpoints now call `_resolve_entry()` instead of hand-rolling visibility
- Removed `Entry` from direct model imports (no longer queried directly in endpoint handlers)

## New Files

### `backend/tests/test_admin_perm.py`
16 tests covering all 10 BDD acceptance conditions:

| AC | Test Class | Test | Status |
|----|-----------|------|--------|
| AC-1 | TestAdminFileDownload | test_admin_download_private_entry_file | PASSED |
| AC-2 | TestAdminFileContent | test_admin_get_content_private_entry_file | PASSED |
| AC-3 | TestNonOwnerFileAccess | test_normal_user_download_private_file_404 | PASSED |
| AC-3 | TestNonOwnerFileAccess | test_normal_user_content_private_file_404 | PASSED |
| AC-4 | TestAnonymousFileAccess | test_anonymous_download_private_file_404 | PASSED |
| AC-4 | TestAnonymousFileAccess | test_anonymous_content_private_file_404 | PASSED |
| AC-5 | TestGlobalApiKeyFileAccess | test_global_api_key_download_private_file | PASSED |
| AC-5 | TestGlobalApiKeyFileAccess | test_global_api_key_content_private_file | PASSED |
| AC-6 | TestPublicEntryFileAccess | test_anonymous_download_public_file | PASSED |
| AC-6 | TestPublicEntryFileAccess | test_anonymous_content_public_file | PASSED |
| AC-7 | TestRequireAdminRejectsNonAdmin | test_require_admin_non_admin_raises_403 | PASSED |
| AC-8 | TestRequireAdminRejectsUnauthenticated | test_require_auth_rejects_none | PASSED |
| AC-9 | TestRequireAdminAllowsAdmin | test_require_admin_admin_passes | PASSED |
| AC-10 | TestExistingEndpointsRegression | test_entry_crud_still_works | PASSED |
| AC-10 | TestExistingEndpointsRegression | test_auth_endpoints_still_work | PASSED |
| AC-10 | TestExistingEndpointsRegression | test_file_endpoints_still_work | PASSED |

## Test Results

```
522 passed, 1 skipped, 7 warnings in 56.56s
```

Full suite passes with zero regressions.
