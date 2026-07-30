# P4 Progress Log — T083-cjk-search-fix

## Started: 2026-07-31

### Input files read:
- implementer.md (role definition)
- P4-dispatch-context-implementer.md (dispatch guidance)
- P0-brief.md (env constraints, risks)
- P2-design.md (full design, plan A selected)
- backend/tests/test_cjk_search.py (P3 test code, 16 tests)

### Code files read (per files_to_read):
- database.py:1-38 (imports, pragmas, constants)
- database.py:39-134 (_run_migrations)
- database.py:134-247 (check_schema, init_db, _setup_indexes)
- database.py:248-306 (setup_fts5 — triggers to modify)
- database.py:307-378 (search_entries — query tokenization needed)
- database.py:379-428 (rebuild_fts_index — unify branches with tokenization)
- database.py:429-545 (_aggregate_entry_content, backfill_fts_content — version mark needed)
- entry_service.py:1-67 (imports, class init)
- entry_service.py:68-114 (_update_fts_content — tokenize needed)
- entry_service.py:458-486 (list_entries tag filter + FTS query — json_each + tokenize_query)
- main.py:200-214 (lifespan — insert preload_jieba)
- pyproject.toml:25-42 (add jieba dependency)

### Additional files read:
- test_database.py:90-210 (trigger tests + search tests — DESIGN_GAP: trigger removal breaks these)
- test_database.py:110-113 (test_triggers_created asserts entries_ai exists — must update)
- test_database.py:117-132 (test_fts_insert_trigger asserts INSERT trigger populates FTS — must update)
- test_database.py:160-210 (search tests depend on INSERT trigger — must update)

### [DESIGN_GAP] discovered:
P2 design removes INSERT/UPDATE triggers but does not explicitly mention that
test_database.py has tests asserting trigger existence and trigger-dependent FTS
population. These tests must be updated to reflect the new architecture:
- test_triggers_created: remove entries_ai assertion
- test_fts_insert_trigger: rewrite to test app-layer FTS population (or remove)
- test_search_by_summary/tags/no_results: manually populate FTS (no trigger to do it)
This is a direct consequence of the P2 design decision, not scope expansion.

### Implementation steps completed:
1. Created backend/peekview/text_utils.py (preload_jieba / tokenize_for_fts / tokenize_query)
2. Modified database.py:
   - _run_migrations: added trigger migration (DROP entries_ai, DROP+reCREATE entries_au as DELETE-only)
   - Added FTS_VERSION=2, _get_user_version, _set_user_version
   - setup_fts5: removed INSERT trigger, UPDATE trigger now DELETE-only
   - search_entries: uses tokenize_query + empty-check
   - rebuild_fts_index: unified both branches to per-row Python processing with tokenize_for_fts
   - backfill_fts_content: version mark + force rebuild on version mismatch + tokenize_for_fts
3. Modified entry_service.py:
   - _update_fts_content: uses tokenize_for_fts for summary/tags/content
   - list_entries: tag filter changed to json_each + FTS query uses tokenize_query
   - Removed unused String import
4. Modified main.py: added preload_jieba() before backfill
5. Modified pyproject.toml: added jieba>=0.42.1

### Test updates (DESIGN_GAP):
- test_database.py::test_triggers_created: removed entries_ai assertion, added "not in" assertion
- test_database.py::test_fts_insert_trigger → test_fts_app_layer_write: tests app-layer FTS population
- test_database.py::test_fts_delete_trigger: manually populate FTS (no INSERT trigger)
- test_database.py::search tests: manually populate FTS with tokenize_for_fts
- test_fts_content.py::test_fts_insert_trigger_content_empty → test_fts_app_layer_writes_empty_content
- test_cjk_search.py::BDD-14: fixed DetachedInstanceError by capturing entry_id before session close
- test_cjk_search.py: fixed import sort + unused variable (ruff)

### Self-check results:
- 16/16 CJK search tests PASSED
- Full suite: 1001 passed + 2 skipped (was 985+2, +16 new tests, zero regression)
- ruff lint: all checks passed

### [PROD_NOT_TOUCHED]
All changes in venv/test environment. No production DB/API touched.
