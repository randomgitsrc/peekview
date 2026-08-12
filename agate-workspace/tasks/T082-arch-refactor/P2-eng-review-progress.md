# P2 eng-review progress

- [OK] read role definition: /home/kity/.agate/assets/review-roles/plan-eng-review.md
- [OK] read dispatch-context: docs/tasks/T082-arch-refactor/P2-dispatch-context-plan-eng-review.md
- [OK] read AGENTS.md (project conventions)
- [OK] read P0-brief.md (task brief + env constraints + risks)
- [OK] read P2-design.md (review target — 6 refactor items + BDD matrix + files_to_read)
- [OK] read P1-requirements.md (41 BDD, risk=high, domains=[backend,frontend])
- [OK] verified exceptions.py: PeekError base class, ValidationError(status_code=400), PayloadTooLargeError has custom __init__ with extra fields
- [OK] verified ValidationError IS raised in share_service.py(5x), entry_service.py(3x), apikey_service.py(1x) — design doc claim "未被 raise" is FALSE
- [OK] verified peek_error_handler (main.py:483) already hardcodes details:None — design doc's handler update is correct but doesn't mention PayloadTooLargeError already losing its extra fields
- [OK] verified entry_service.py create_entry transaction: commit at line 229 (entry), commit at line 277 (files), rollback at line 301 only rolls back files
- [OK] verified _update_fts_content called at line 325 (outside Session block, after IntegrityError handler)
- [OK] verified HTTPException locations: entries.py:205, auth.py:208/240/261/266, admin.py:57 — matches design doc
- [OK] verified duplicate functions: _looks_like_jwt(3x), _is_global_api_key_auth(2x), _record_read_async(2x) — matches design doc
- [OK] verified files.py _resolve_entry: uses get_engine(config) + Session(engine) + ShareService new — design doc correct
- [OK] verified auth.py get_current_user: ApiKeyService(engine=engine) new at line 185 — design doc correct
- [OK] verified main.py init: all services created independently (no cross-injection), lines 216-225
- [OK] verified frontend: entry.ts=223 lines, EntryDetailView.vue=1003 lines, loadSeq at line 7, 3 .detail reads — all match design doc
