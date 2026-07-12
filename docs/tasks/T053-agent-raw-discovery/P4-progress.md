# P4 Progress Log

## Input Reading
- [x] P2-design.md — 方案 A (catchall 内联), files_to_read, gate_commands
- [x] P3-test-cases.md — 33 tests, 15 true red
- [x] P4-dispatch-context.md — dispatch context
- [x] P0-brief.md — env constraints
- [x] test_content_negotiation.py — full test code read
- [x] main.py:415-490 — serve_spa_catchall + _setup_static_files
- [x] api/files.py:1-30 — imports
- [x] api/files.py:140-230 — _is_global_api_key_auth + _resolve_entry
- [x] api/files.py:385-506 — get_entry_raw full implementation
- [x] api/entries.py:68-128 — _check_share_cookie + _is_global_api_key_auth
- [x] auth.py:137-196 — get_current_user
- [x] services/entry_service.py:313-344 — get_entry visibility
- [x] exceptions.py:55-65 — NotFoundError
- [x] models.py:181-210 — Entry model (slug field)

## Implementation Plan
1. Add _prefers_json, _is_frontend_route, _slug_exists, _inject_link to main.py
2. Extract resolve_entry_raw from get_entry_raw in api/files.py
3. Refactor get_entry_raw to call resolve_entry_raw
4. Modify serve_spa_catchall to add Content Negotiation + link injection
5. Add necessary imports to main.py
