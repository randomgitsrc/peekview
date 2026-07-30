## P3 Progress — test-designer

### Input files read:
- [x] P3-dispatch-context-test-designer.md — 17 BDDs, test_code_dir=backend/tests/, gate: check-tdd-red.sh exit 0
- [x] test-designer.md role — BDD 1:1 mapping, TDD red light, no UI (ui_affected: false)
- [x] P0-brief.md — env constraints: make debug (:8888), make test-quick (venv), make lint (system python3 ruff)
- [x] P1-requirements.md — 17 BDDs (BDD-1~6 tag filter, BDD-7~11 FTS CJK search, BDD-12~13 hyphen tag, BDD-14 backfill, BDD-15 new entry, BDD-16 existing tests, BDD-17 jieba preload)
- [x] P2-design.md — text_utils.py (tokenize_for_fts/tokenize_query/preload_jieba), json_each tag filter, trigger downgrade, backfill version marker, search_entries query tokenization
- [x] conftest.py — autouse isolate_config_file (tmp_path), engine/session/test_config/app/client fixtures
- [x] factories.py — EntryFactory (create with tags/summary/slug/status/expires_at), FileFactory
- [x] test_database.py — TestFTS5 (triggers, insert/delete), TestSearchEntries (search by summary/tags/no results), TestRebuildFtsIndex
- [x] test_entry_service.py — entry_service fixture (init_db + EntryService), TestCreateEntry, TestListEntries (search, pagination)

### Key observations:
1. test_database.py uses init_db() directly (not app fixture), tests search_entries() and rebuild_fts_index()
2. test_entry_service.py uses entry_service fixture, tests create_entry/list_entries/get_entry
3. conftest engine fixture uses SQLModel.metadata.create_all (no init_db, no FTS5 setup) — tests needing FTS must use init_db directly
4. BDD-16 is verified by P5 gate, not in test_cjk_search.py
5. BDD-17 uses @pytest.mark.timeout(1) or timing measurement
6. Tests import from peekview.text_utils which doesn't exist yet → B-class red light (import failure)

### Implementation code read:
- [x] database.py: init_db (L180-222) calls _run_migrations → _setup_indexes → setup_fts5
- [x] database.py: setup_fts5 (L248-306) creates FTS5 table + 3 triggers (entries_ai INSERT, entries_ad DELETE, entries_au UPDATE=DELETE+INSERT)
- [x] database.py: search_entries (L349-376) — current: q.replace quotes → MATCH, no tokenization
- [x] database.py: rebuild_fts_index (L379-428) — two branches: with storage (Python loop) / without storage (INSERT...SELECT)
- [x] database.py: backfill_fts_content (L492-528) — content_count >= entry_count skip, else DELETE ALL + rebuild
- [x] database.py: _aggregate_entry_content (L464-489) — reads file content from disk
- [x] entry_service.py: _update_fts_content (L68-117) — DELETE+INSERT with raw summary/tags/content (no tokenization)
- [x] entry_service.py: list_entries (L358-499) — tag filter uses LIKE (L458-463), FTS search uses q.strip() (L466-486)
- [x] conftest.py: engine fixture uses SQLModel.metadata.create_all (NO init_db, NO FTS5) — tests needing FTS must use init_db directly
- [x] jieba 0.42.1 available in venv; pytest-timeout NOT available — BDD-17 uses time.time() measurement

### Test design decisions:
1. BDD-1~6 (tag filter): use entry_service fixture, call list_entries(tags=[...])
2. BDD-7~11 (FTS CJK search): use entry_service fixture, call list_entries(q=...) after create_entry
3. BDD-12~13 (hyphen tag): use entry_service fixture, call list_entries(q=...)
4. BDD-14 (backfill): use init_db + backfill_fts_content directly, simulate pre-fix FTS data
5. BDD-15 (new entry FTS): use entry_service fixture, create_entry then list_entries(q=...)
6. BDD-16: NOT in test_cjk_search.py (P5 gate verifies)
7. BDD-17 (jieba preload): import preload_jieba from text_utils, call it, measure tokenize_for_fts time
8. Import from peekview.text_utils → B-class red (module doesn't exist)
9. Tests use init_db directly (not conftest engine fixture) to get FTS5 triggers

### Test execution result:
- 16 tests collected, 16 FAILED, 0 PASSED
- BDD-1/2/5: AssertionError (LIKE fails for CJK tags — B-class red)
- BDD-3/4/6~15/17: ModuleNotFoundError peekview.text_utils (B-class red)
- No syntax errors, no third-party import failures
- All tests are genuine B-class red lights (TDD compliant)

### Self-check:
- [x] P3-test-cases.md exists and contains test_code_dir
- [x] Every BDD (1-17) has corresponding test case (BDD-16 excluded by design)
- [x] Test code file exists: backend/tests/test_cjk_search.py
- [x] Test code syntax valid: python3 -c "import ast; ast.parse(...)" → OK
- [x] All tests fail due to implementation not written (red light)

### [PROD_NOT_TOUCHED]
Only wrote test files, no production environment touched.
