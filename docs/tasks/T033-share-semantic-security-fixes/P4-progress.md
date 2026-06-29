
## P4 Implementation — 2026-06-30

### Fix 1: compare_digest 永真
- Deleted `hmac.compare_digest` call in `share_service.py:207` (was comparing computed_hash with share.token_hash, but SQL WHERE already matched on computed_hash so it was always True)
- Removed `import hmac` from share_service.py (no longer needed)
- Updated test_b30 in test_share_security.py: replaced mock-based test (verifying compare_digest called) with two semantic tests:
  - test_b30_token_verification_rejects_invalid_token: verifies 404 for bad token
  - test_b30_token_verification_accepts_valid_token: verifies 200 for good token
- Removed unused `from unittest.mock import patch` import

### Fix 2: share cookie 可枚举
- Changed cookie name from `peekview_share_{entry.id}` to `peekview_share_{slug}` in:
  - share_service.py: build_share_cookie_params (param entry_id→slug, key format)
  - share_service.py: clear_share_cookie_params (param entry_id→slug, key format)
  - entries.py: _check_share_cookie (cookie_name format)
  - entries.py: get_entry share handler (build_share_cookie_params call: entry_id=→slug=)
  - files.py: _resolve_entry (cookie_name format)
- Updated test_share_cookie.py: cookie_name from f"peekview_share_{entry_id}" to "peekview_share_{slug}"
- Updated test_read_tracking.py: cookie_name from f"peekview_share_{entry['id']}" to f"peekview_share_{slug}"

### Fix 3: max_views 语义统一（方案 B）
- ShareDialog.vue: "Max views (optional)" → "Max uses (optional)"
- ShareManagementPanel.vue: "views" → "uses"

### Files changed
1. backend/peekview/services/share_service.py
2. backend/peekview/api/entries.py
3. backend/peekview/api/files.py
4. backend/tests/test_share_security.py
5. backend/tests/test_share_cookie.py
6. backend/tests/test_read_tracking.py
7. frontend-v3/src/components/ShareDialog.vue
8. frontend-v3/src/components/ShareManagementPanel.vue
