## P3 Progress

### Read: P0-brief.md
- env: make debug-start :8888, /tmp/peekview-debug/
- 3-layer: Content Negotiation + HTML self-description + llms.txt
- ui_affected: false

### Read: P1-requirements.md
- 20 BDD conditions: B1-B17 + B7b + B10b + B13b
- B5 SCOPE+ corrected: text/html present → HTML wins regardless of q values
- Key implicit needs: I1 (slug existence), I2 (auth-aware CN), I3 (catchall DB access), I4 (frontend route exclusion), I10 (malformed Accept)
- NC1 resolved: llms.txt stays as 302 redirect, update GitHub file
- NC2 resolved: private entries also get <link> injection

### Read: P2-design.md
- Method A (catchall inline) selected
- _prefers_json: GitHub-style, JSON only when text/html NOT acceptable
- _is_frontend_route, _slug_exists, _inject_link new functions
- resolve_entry_raw extracted from api/files.py
- B5 corrected to HTML wins

### Read: P3-dispatch-context.md
- Test file: backend/tests/test_content_negotiation.py
- conftest.py autouse isolation + factories.py
- Gate: cd backend && .venv/bin/python -m pytest tests/ -q --tb=no

### Read: Implementation files
- conftest.py: autouse isolation (tmp_path), client fixture uses create_app + ASGITransport
- factories.py: EntryFactory(session).create(slug=..., summary=..., is_public=...) — but Entry model has is_public field, factory doesn't expose it directly
- main.py: SPA catchall at L468-484, raw_shortlink at L421, _setup_static_files at L439
- files.py: get_entry_raw at L385-506, _is_global_api_key_auth at L144, _resolve_entry at L171
- auth.py: get_current_user at L137 (JWT + cookie + API key)
- models.py: Entry has is_public (default True), owner_id (nullable FK to users)
- test_api.py pattern: create_app(data_dir=, db_path=) + ASGITransport + AsyncClient

### Key observations for test design
1. SPA catchall only exists when frontend_dist is found (index.html exists)
2. Test client uses http://test base_url — SPA catchall will serve index.html from frontend-v3/dist
3. EntryFactory doesn't expose is_public — need to set it on the model directly or use session
4. For private entry tests, need to create User + Entry with owner_id + is_public=False
5. For auth tests, need JWT cookie or API key header
6. B15 (llms.txt) — current implementation is 302 redirect, test should verify redirect + content after redirect
7. B16/B17 are end-to-end — same as B1/B10 but framed as agent scenarios, can be covered by same test logic

### Test design decisions
1. Use same pattern as test_raw_api.py: create_app + ASGITransport + AsyncClient
2. For private entry + auth: register user via /api/v1/auth/register, get access_token, use Bearer header
3. For admin: first registered user is admin, set is_admin=True via session
4. SPA catchall exists because frontend-v3/dist/index.html exists in dev environment
5. B15 (llms.txt): test 302 redirect behavior — can't follow redirect to GitHub in test, just verify redirect
6. B16/B17: covered by B1/B10 logic, add explicit E2E-style tests for traceability
7. _prefers_json unit tests: test the function directly (will be importable from main.py after implementation)
8. For <link> injection: check HTML response body contains the link tag
9. For Link header: check response headers
10. Frontend routes: /explore, /settings/apikeys, /users/xxx, /login

### Test execution results
- 33 test methods collected
- 15 RED (assertion failures — implementation missing)
- 18 GREEN (expected — HTML default behavior matches before/after implementation)
- No import/syntax errors (all failures are type B — true red)
- Key cookie issue found and fixed: register sets JWT cookie, need client.cookies.clear() before unauthenticated requests
- B10b test_raw_still_404_without_auth: green (existing /raw already enforces auth)
- B15 llms.txt: green (302 redirect already implemented)

### BDD coverage
All 20 BDD conditions covered:
- B1: 2 tests (JSON + match raw)
- B2: 1 test
- B3: 1 test
- B4: 1 test
- B5: 3 tests (lower q, equal q, q=0)
- B6: 2 tests (404 + match raw)
- B7: 1 test
- B7b: 1 test
- B8: 1 test
- B9: 1 test
- B10: 1 test
- B10b: 2 tests (link + raw 404)
- B11: 1 test
- B12: 4 tests (explore, settings, users, login)
- B13: 1 test
- B13b: 1 test
- B14: 1 test
- B15: 1 test
- B16: 1 test
- B17: 1 test
- Edge cases: 5 tests (missing accept, malformed, empty, json-only, xhtml)

### Self-check PASS
- P3-test-cases.md exists with test_code_dir declaration
- test_content_negotiation.py exists and non-empty
- All BDD conditions have corresponding test cases
- All test failures are assertion failures (true red), not import/syntax errors
