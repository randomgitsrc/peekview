---
phase: P3
task_id: T073
type: test-cases
parent: P2-design.md
trace_id: T073-P3-20260726
status: draft
created: 2026-07-26
agent: test-designer
---

test_code_dir: backend/tests/

## Summary

- Existing failed tests: 43 (true red — assertion failures / TypeError 500)
- New tests added: 6 (2 true red, 3 behavior verification, 1 conditional skip)
- Total true red: 45
- Behavior verification tests: 3 (currently pass, must continue to pass after fix)

## BDD → Test Case Mapping

### BDD-1: admin_stats not 500 and returns correct counts

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_stats_returns_all_fields | test_admin_stats_cleanup.py | RED (TypeError 500) | `not Entry.is_public` + `is not None` in case() |
| test_stats_counts_match_data | test_admin_stats_cleanup.py | RED (TypeError 500) | Same root cause |
| test_stats_empty_system | test_admin_stats_cleanup.py | RED (TypeError 500) | Same root cause |
| test_stats_performance_1000_entries | test_admin_stats_cleanup.py | RED (TypeError 500) | Same root cause |
| test_admin_stats_json_output | test_admin_stats_cleanup.py | RED (TypeError 500) | CLI stats also 500 |
| test_admin_stats_local_runs | test_admin_stats_cleanup.py | RED (TypeError 500) | CLI stats also 500 |

Fix targets: admin_service.py:131 (`not Entry.is_public`→`~Entry.is_public`), L135/156 (`is not None`→`.isnot(None)`)

### BDD-2: share create revoked_at filter works

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_b06_max_shares_limit | test_share_create.py | RED | `revoked_at is None`→`WHERE false`, active count always 0 |

Fix target: share_service.py:71 (`is None`→`.is_(None)`)

### BDD-3: share token verify skips revoked shares

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_b07_valid_token_grants_access | test_share_access.py | RED | `revoked_at is None`→`WHERE false`, ALL tokens fail |
| test_b09_revoked_token_denies_access | test_share_access.py | GREEN (wrong reason) | Passes because ALL tokens fail, not just revoked |

Fix targets: share_service.py:201,223 (`is None`→`.is_(None)`)

Note: test_b09 passes for the wrong reason. After fix, valid tokens should work (test_b07 passes) and revoked tokens should still return 404 (test_b09 passes for the right reason).

### BDD-4: share cookie verify skips revoked shares

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_b19_revoked_cookie_denies_access | test_share_cookie.py | RED | Cookie verify also uses `revoked_at is None` |
| test_b19_expired_cookie_denies_access | test_share_cookie.py | RED | Same root cause |
| test_b19_max_views_exceeded_cookie_denies_access | test_share_cookie.py | RED | Same root cause |

Fix target: share_service.py:244 (`is None`→`.is_(None)`)

### BDD-5: revoke only unrevoked shares

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_b23_owner_revokes_specific_shares | test_share_revoke.py | RED | `revoked_at is None`→`WHERE false` in revoke |
| test_b25_nonexistent_share_id_ignored | test_share_revoke.py | RED | Same root cause |

Fix target: share_service.py:179,223 (`is None`→`.is_(None)`)

### BDD-6: API key expired count correct

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_06_api_key_expired_count | test_t073_bdd06_apikey_expired_count.py | RED (TypeError 500) | `ApiKey.expires_at is not None` in get_stats() |

Fix target: admin_service.py:156 (`is not None`→`.isnot(None)`)

### BDD-7: cleanup_expired identifies expired entries (NULL expires_at not affected)

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_07_null_expires_at_not_archived | test_t073_bdd07_08_cleanup_null_columns.py | GREEN | Bug is silent (`is not None` redundant with `<= now`); test verifies correct behavior |

Fix target: admin_service.py:196 (`is not None`→`.isnot(None)`)

### BDD-8: cleanup_expired identifies old archived entries (NULL archived_at not affected)

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_08_null_archived_at_not_deleted | test_t073_bdd07_08_cleanup_null_columns.py | GREEN | Bug is silent; test verifies correct behavior |

Fix target: admin_service.py:220 (`is not None`→`.isnot(None)`)

### BDD-9: ruff does not report E711/E712 violations

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_09_pyproject_toml_ignores_e711_e712 | test_t073_bdd09_10_ruff_regression.py | RED | E711/E712 not in pyproject.toml ignore list |

Fix target: pyproject.toml (add E711, E712 to `[tool.ruff.lint] ignore`)

### BDD-10: make lint-fix does not break SQLAlchemy Column comparisons

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_10_lint_fix_preserves_sqlalchemy_syntax | test_t073_bdd09_10_ruff_regression.py | SKIPPED | No SQLAlchemy patterns in code yet (pre-fix); will activate post-fix |

Fix target: pyproject.toml (E711/E712 ignore) + code using .is_()/.isnot()/~

### BDD-11: all tests pass

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| (meta) | all test files | RED (45 total) | Running `make test-quick` is the test |

No dedicated test case — BDD-11 is verified by the entire test suite passing.

### BDD-12: entry list API for anonymous/authenticated users with correct visibility

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_bdd_12_authenticated_sees_public_plus_own_private | test_t073_bdd12_entry_list_visibility.py | GREEN | Bare Column works in .where(); test verifies OR expression path |
| test_anonymous_sees_only_public | test_auth.py | GREEN | Existing test covers anonymous path |

Fix targets: entry_service.py:444/445/448/451 (bare Column→`.is_(True)`)

### BDD-13: FTS search finds non-binary file content

| Test Case | File | Status | Notes |
|-----------|------|--------|-------|
| test_search_file_content | test_fts_content.py | RED | `not File.is_binary`→`WHERE false`, FTS empty |
| test_search_file_content_not_summary | test_fts_content.py | RED | Same root cause |
| test_search_file_content_with_base64_binary_skipped | test_fts_content.py | RED | Same root cause |
| test_text_file_searchable_alongside_binary | test_fts_content.py | RED | Same root cause |
| test_backfill_populates_content | test_fts_content.py | RED | Same root cause |
| test_backfill_idempotent | test_fts_content.py | RED | Same root cause |
| test_add_file_adds_to_fts | test_fts_content.py | RED | Same root cause |
| test_remove_file_removes_from_fts | test_fts_content.py | RED | Same root cause |
| test_update_summary_preserves_content | test_fts_content.py | RED | Same root cause |
| test_content_within_truncation_searchable | test_fts_content.py | RED | Same root cause |
| test_content_beyond_truncation_not_searchable | test_fts_content.py | RED | Same root cause |
| test_delete_entry_removes_from_fts | test_fts_content.py | RED | Same root cause |
| test_rebuild_with_storage | test_fts_content.py | RED | Same root cause |

Fix targets: entry_service.py:96 (`not File.is_binary`→`~File.is_binary`), database.py:485 (`not File.is_binary`→`~File.is_binary`)

## Additional failed tests (not directly mapped to BDD but affected by same bugs)

| Test Case | File | Root Cause |
|-----------|------|-----------|
| test_share_cookie_access_records_channel_share | test_read_tracking.py | share_service `revoked_at is None` |
| test_share_link_records_channel_share | test_read_tracking.py | share_service `revoked_at is None` |
| test_get_read_stats_total_count_excludes_self_reads | test_read_tracking.py | `not EntryRead.is_self_read` in .where() |
| test_b13_file_content_access | test_share_access.py | share_service `revoked_at is None` |
| test_b14_html_render_access | test_share_access.py | share_service `revoked_at is None` |
| test_b15_download_access | test_share_access.py | share_service `revoked_at is None` |
| test_b16_raw_content_access | test_share_access.py | share_service `revoked_at is None` |
| test_b17_share_token_sets_cookie | test_share_cookie.py | share_service `revoked_at is None` |
| test_b17_permanent_share_cookie_has_max_age | test_share_cookie.py | share_service `revoked_at is None` |
| test_b18_cookie_enables_entry_access | test_share_cookie.py | share_service `revoked_at is None` |
| test_b18_cookie_enables_sub_resource_access | test_share_cookie.py | share_service `revoked_at is None` |
| test_b26_private_to_public_auto_revokes | test_share_lifecycle.py | share_service `revoked_at is None` |
| test_b29_view_count_atomic_increment | test_share_lifecycle.py | share_service `revoked_at is None` |
| test_view_count_only_increments_on_token_access | test_share_lifecycle.py | share_service `revoked_at is None` |
| test_b30_token_verification_accepts_valid_token | test_share_security.py | share_service `revoked_at is None` |
| test_b32_referrer_policy_on_share_access | test_share_security.py | share_service `revoked_at is None` |
| test_view_count_increments_atomically | test_t054_e_share_sql.py | share_service `revoked_at is None` |

## New test files

| File | BDDs | Tests |
|------|------|-------|
| test_t073_bdd06_apikey_expired_count.py | BDD-6 | 1 |
| test_t073_bdd07_08_cleanup_null_columns.py | BDD-7, BDD-8 | 2 |
| test_t073_bdd09_10_ruff_regression.py | BDD-9, BDD-10 | 2 |
| test_t073_bdd12_entry_list_visibility.py | BDD-12 | 1 |

## Red light confirmation

- True red (assertion failure / TypeError): 45 tests (43 existing + 2 new)
- Behavior verification (currently green, must stay green): 3 tests
- Conditional skip (activates post-fix): 1 test
- All 13 BDDs have at least one test case mapping
