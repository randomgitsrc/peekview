---
phase: P3
task_id: T027-share-link
type: progress
parent: P2-design.md
status: complete
created: 2026-06-29
---

# P3 Progress — Backend Test Design

## Input Reading

- [x] P0-brief.md — env constraints, known risks, scope
- [x] P1-requirements.md — BDD B01-B33 (backend), implicit requirements IR 2.1-2.12
- [x] P2-design.md — API endpoints, EntryShare model, share_service, cookie mechanism, security design
- [x] models.py — Entry, User, ApiKey, hash_api_key pattern, Pydantic schemas
- [x] conftest.py — isolate_config_file, engine, session, client fixtures
- [x] factories.py — EntryFactory, FileFactory patterns
- [x] api/entries.py — route patterns, _is_global_api_key_auth, get_entry
- [x] auth.py — get_current_user, require_auth, require_admin, JWT cookie (peekview_token)
- [x] exceptions.py — NotFoundError(404), ForbiddenError(403), AuthenticationError(401), ValidationError(400)
- [x] test_apikey.py — API test pattern: client_and_app fixture, _register helper, class-based test grouping

## Key Observations

1. Test pattern: `client_and_app` fixture with isolated tmp dir, `_register` helper, class-based grouping
2. First registered user gets `is_admin=True` (important for admin tests)
3. Token hashing: `hash_api_key` uses HMAC-SHA256; share tokens use plain SHA-256 per P2
4. Cookie namespace: JWT uses `peekview_token`; share cookies use `peekview_share_{entry_id}`
5. Existing `get_entry` visibility check: `not entry.is_public and not is_admin and entry.owner_id != current_user_id` → raises NotFoundError(404)
6. `parse_expires_in` from file_service.py can be reused for share expires_in parsing

## BDD Coverage Plan

All 33 backend BDD conditions (B01-B33) mapped to test cases.
Additional coverage for implicit requirements IR 2.1-2.12 where not already covered by BDD.

## Output Files

- [x] P3-test-cases-backend.md — 45 test cases covering B01-B33
- [x] P3-test-code-backend/test_share_create.py — 9 tests (B01-B06 + implicit public/variant)
- [x] P3-test-code-backend/test_share_access.py — 12 tests (B07-B16 + auth priority)
- [x] P3-test-code-backend/test_share_cookie.py — 7 tests (B17-B19 + expired/max_views variants)
- [x] P3-test-code-backend/test_share_list.py — 4 tests (B20-B22 + anonymous)
- [x] P3-test-code-backend/test_share_revoke.py — 4 tests (B23-B25 + idempotent)
- [x] P3-test-code-backend/test_share_lifecycle.py — 6 tests (B26-B29 + cookie count + default expiry)
- [x] P3-test-code-backend/test_share_security.py — 5 tests (B30-B32 + negative referrer)
- [x] backend/tests/test_share_*.py — 7 files copied to test directory

## Red-Light Verification

- `from peekview.models import EntryShare` → ImportError (model not yet defined)
- `from peekview.services.share_service import ShareService` → ModuleNotFoundError (service not yet created)
- All 7 test files will fail at import time, confirming TDD red-light state
