# P3 Progress — T073

## Step 1: Read input files
- [x] Role definition (test-designer.md)
- [x] Dispatch context (P3-dispatch-context-test-designer.md)
- [x] P0-brief.md (env constraints, risks)
- [x] P1-requirements.md (13 BDD: BDD-1 to BDD-13)
- [x] P2-design.md (19 fixes, BDD coverage mapping)

## Key findings from inputs
- 43 existing failed tests: admin_stats (6) + share (~27) + fts_content (~10)
- P2 BDD coverage mapping claims BDD-1~8 covered by existing tests
- BDD-9~13 need coverage verification
- ui_affected: false, no Playwright needed
- Test code dir: backend/tests/

## Step 2: List all 43 failed tests
- admin_stats: 6 tests (test_admin_stats_cleanup.py)
- fts_content: 10 tests (test_fts_content.py)
- share: 27 tests (test_share_access 5, test_share_cookie 7, test_share_create 1, test_share_lifecycle 3, test_share_revoke 2, test_share_security 2, test_t054_e_share_sql 1, test_read_tracking 3)
- Total: 6 + 10 + 27 = 43 ✓

## Step 3: BDD coverage analysis

### BDD-1 (admin_stats not 500): COVERED
- test_admin_stats_cleanup.py::TestAdminStats::test_stats_returns_all_fields (FAILED)
- test_admin_stats_cleanup.py::TestAdminStats::test_stats_counts_match_data (FAILED)
- test_admin_stats_cleanup.py::TestStatsEmptySystem::test_stats_empty_system (FAILED)
- test_admin_stats_cleanup.py::TestStatsPerformance::test_stats_performance_1000_entries (FAILED)
- test_admin_stats_cleanup.py::TestCLIAdminStatsJSON::test_admin_stats_json_output (FAILED)
- test_admin_stats_cleanup.py::TestCLIAdminStatsLocal::test_admin_stats_local_runs (FAILED)

### BDD-2 (share create revoked_at filter): COVERED
- test_share_create.py::TestCreateSharePermission::test_b06_max_shares_limit (FAILED)
  Note: BDD-2 says "50 active + 1 revoked → 422", but test_b06 creates 50 shares then tries 51st.
  The test doesn't explicitly create a revoked share, but the underlying bug (revoked_at is None → Python bool) affects the same code path.

### BDD-3 (share token verify skips revoked): COVERED
- test_share_access.py::TestShareTokenAccess::test_b09_revoked_token_denies_access (FAILED - but this is B09, tests revoked token returns 404)
  Actually: test_share_security.py::test_b30_token_verification_accepts_valid_token (FAILED)
  The revoked token test (B09) is in test_share_access.py but it's not in the 43 failed list.
  Wait - let me recheck. The failed test is test_b30_token_verification_accepts_valid_token which tests valid token.
  The BDD-3 scenario (revoked share token → 404) is covered by test_b09_revoked_token_denies_access.
  But test_b09 is NOT in the 43 failed list! This means it might be passing despite the bug.
  Actually, looking more carefully: the 43 failed tests include test_share_access.py tests for B13-B16 (sub-resource access).
  BDD-3 is about verify_share_token skipping revoked shares. The test_b09 sets revoked_at directly in DB then checks token → 404.
  This test might pass because the token hash lookup fails before the revoked_at filter is even applied.
  Need to verify: is test_b09 actually passing? If so, BDD-3 has INCOMPLETE coverage.

### BDD-4 (share cookie verify skips revoked): COVERED
- test_share_cookie.py::TestShareCookieRevocation::test_b19_revoked_cookie_denies_access (FAILED)

### BDD-5 (revoke only unrevoked): COVERED
- test_share_revoke.py::TestRevokeShares::test_b23_owner_revokes_specific_shares (FAILED)
- test_share_revoke.py::TestRevokeShares::test_b25_nonexistent_share_id_ignored (FAILED)

### BDD-6 (API key expired count): COVERED (indirectly)
- test_admin_stats_cleanup.py tests check api_keys.expired field
  But no test explicitly creates expired API keys and checks the count.
  The admin_stats tests that fail are about the TypeError 500, not about expired key count accuracy.
  BDD-6 may need a dedicated test.

### BDD-7 (cleanup_expired identifies expired): COVERED
- test_admin_stats_cleanup.py::TestAdminCleanup::test_cleanup_deletes_expired_entries (passes - not in 43 failed)
  Wait, this test is NOT in the failed list. Let me check if cleanup tests pass.
  The 6 failed admin tests are all in TestAdminStats/TestStatsEmptySystem/TestStatsPerformance/TestCLIAdminStats*.
  The cleanup tests (TestAdminCleanup, TestCleanupNoExpired, etc.) are NOT failing.
  This means BDD-7 and BDD-8 may not be properly tested for the specific bug.

### BDD-8 (cleanup identifies old archived): NOT COVERED by failed tests
- No test in the 43 failed list tests cleanup_expired with archived_at filter.
- The cleanup tests pass because they use different code paths or the bug doesn't manifest.

### BDD-9 (ruff no E711/E712): NOT COVERED
- No existing test checks ruff configuration

### BDD-10 (make lint-fix doesn't break): NOT COVERED
- No existing test checks lint-fix idempotency

### BDD-11 (all tests pass): META - covered by the fact of running tests

### BDD-12 (entry list anonymous only public): PARTIALLY COVERED
- test_auth.py::test_anonymous_sees_only_public (PASSING - not in 43 failed)
- test_user_page.py::test_owner_anonymous_sees_public_only (PASSING)
- These tests pass because the bare Column `Entry.is_public` in .where() still works
  (SQLAlchemy accepts it). The bug is more subtle - it affects OR expressions.
  Need a test that specifically tests the OR expression path in entry_service.py:448/451.

### BDD-13 (FTS search finds non-binary): COVERED
- test_fts_content.py - 10 tests FAILED (all related to FTS content search)

## Step 4: Detailed BDD coverage verification

### Key finding: `Column is None` → `WHERE false` (not `WHERE true`)
- `EntryShare.revoked_at is None` evaluates to Python `False` (Column descriptor is not None)
- `.where(False, ...)` → `WHERE false` → no results ever
- This means verify_share_token ALWAYS returns None, not just for revoked shares
- test_b09 passes for the WRONG reason (all tokens fail, not just revoked ones)

### Coverage summary:
| BDD | Covered? | How? | Gap? |
|-----|----------|------|------|
| BDD-1 | YES | 6 failed admin_stats tests | None |
| BDD-2 | YES | test_b06_max_shares_limit (FAILED) | None |
| BDD-3 | YES* | test_b07 (FAILED - valid token fails) + test_b09 (PASSES for wrong reason) | Need test that verifies revoked share is excluded while valid share works |
| BDD-4 | YES | test_b19_revoked_cookie_denies_access (FAILED) | None |
| BDD-5 | YES | test_b23 + test_b25 (FAILED) | None |
| BDD-6 | NO | No test creates expired API keys and checks admin stats count | Need new test |
| BDD-7 | PARTIAL | cleanup tests PASS (bug is silent - `is not None` redundant with `<= now`) | Need test with NULL expires_at entries that should NOT be archived |
| BDD-8 | PARTIAL | cleanup tests PASS (bug is silent - `is not None` redundant with `<= cutoff`) | Need test with NULL archived_at entries that should NOT be deleted |
| BDD-9 | NO | No test checks ruff E711/E712 configuration | Need new test |
| BDD-10 | NO | No test checks lint-fix idempotency | Need new test |
| BDD-11 | META | Running pytest itself is the test | No dedicated test needed |
| BDD-12 | PARTIAL | test_anonymous_sees_only_public PASSES (bare Column works in .where()) | Need test for OR expression path (owner+public visibility) |
| BDD-13 | YES | 10 failed FTS tests | None |

### BDDs needing new tests:
1. BDD-6: API key expired count in admin stats
2. BDD-7: cleanup_expired with NULL expires_at entries (should not be archived)
3. BDD-8: cleanup_expired with NULL archived_at entries (should not be deleted)
4. BDD-9: ruff check --select E711,E712 returns no violations
5. BDD-10: make lint-fix does not change SQLAlchemy Column comparisons
6. BDD-12: entry list with owner+public OR expression (authenticated user sees own private + all public)

## Step 5: New test results

| Test | Result | Type |
|------|--------|------|
| test_bdd_06_api_key_expired_count | FAILED (TypeError 500) | True red |
| test_bdd_07_null_expires_at_not_archived | PASSED | Behavior verification (silent bug) |
| test_bdd_08_null_archived_at_not_deleted | PASSED | Behavior verification (silent bug) |
| test_bdd_09_pyproject_toml_ignores_e711_e712 | FAILED (E711 not in ignore) | True red |
| test_bdd_10_lint_fix_preserves_sqlalchemy_syntax | SKIPPED (no patterns yet) | Will activate post-fix |
| test_bdd_12_authenticated_sees_public_plus_own_private | PASSED | Behavior verification |

Total new tests: 6 (2 true red, 3 behavior verification, 1 skip)
Existing failed tests: 43 (all true red)
Total: 43 + 2 = 45 true red, 3 behavior verification (should stay green), 1 skip

## Step 6: Write P3-test-cases.md

## Step 7: Final verification

- P3-test-cases.md: exists, non-empty, contains test_code_dir declaration ✓
- P3-test-code/: 4 test files ✓
- backend/tests/: 4 new test files copied ✓
- All 13 BDDs have test case mappings ✓
- True red tests: 45 (43 existing + 2 new) ✓
- Behavior verification tests: 3 (currently green) ✓
- PROD_NOT_TOUCHED

## Output files
1. /home/kity/oclab/peekview/docs/tasks/T073-ruff-sqlalchemy-regression/P3-test-cases.md
2. /home/kity/oclab/peekview/docs/tasks/T073-ruff-sqlalchemy-regression/P3-test-code/ (4 files)
3. /home/kity/oclab/peekview/backend/tests/test_t073_bdd*.py (4 files, same content)
