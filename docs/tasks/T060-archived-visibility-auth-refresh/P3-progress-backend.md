# P3 Progress: Backend Test Designer

## 1. Input files read [DONE]
- P3-dispatch-context-test-designer-backend.md
- ~/.agate/assets/execution-roles/test-designer.md
- AGENTS.md
- P1-requirements.md (BDD A1-A7, A1b-A3b, M1-M3)
- P2-design.md (§2.1-2.2, §5)

## 2. Existing code read [DONE]
- backend/peekview/services/entry_service.py:362-536 (list_entries)
- backend/peekview/models.py:29-34 (EntryStatus enum)
- backend/tests/test_entry_lifecycle.py:1-120 (fixtures/helpers), 665-842 (existing tests to update)
- backend/tests/conftest.py (shared fixtures)
- backend/tests/factories.py (test data builders)

## 3. Analysis [DONE]
- Current bug: line 405-411 allows `(status != ARCHIVED) | (owner_id == current_user_id)`, so owner sees own archived in default list
- Admin bug: line 412-413 has `pass`, so admin sees everything
- Fix per P2: all roles use `query.where(Entry.status != EntryStatus.ARCHIVED)` when no status param
- Existing test line 698 `assert "archived-mine" in slugs` → must become `not in`
- Existing test line 724 `assert resp.json()["total"] >= 2` → must become `== 1`
- Decided to redefine helpers locally (no cross-file import available in this test suite)

## 4. Test code written [DONE]
### New file: backend/tests/test_archived_visibility.py (15 tests)
| Test | BDD | Expected (current) |
|------|-----|--------------------|
| test_owner_list_excludes_own_archived | A1 | RED (archived still in default) |
| test_all_archived_user_all_tab_returns_empty | A1b | RED |
| test_owner_mine_excludes_archived | A2 | RED |
| test_all_archived_user_mine_returns_empty | A2b | RED |
| test_owner_archived_tab_shows_archived | A3 | GREEN (already works) |
| test_no_archived_entries_archived_tab_empty | A3b | GREEN |
| test_admin_all_tab_excludes_archived | A4 | RED (admin passes through) |
| test_admin_archived_tab_sees_all_archived | A5 | GREEN (already works) |
| test_anonymous_all_tab_excludes_archived | A6 | GREEN (already works) |
| test_anonymous_archived_tab_returns_empty | A6 | GREEN |
| test_non_owner_cannot_see_others_archived_in_all_tab | A7 | GREEN (already works) |
| test_non_owner_cannot_see_others_archived_in_archived_tab | A7 | GREEN |
| test_invalid_status_returns_422 | M3 | RED (no validation yet) |

### Updated file: backend/tests/test_entry_lifecycle.py
| Test | Line | Change |
|------|------|--------|
| test_owner_list_includes_archived_entries | 698 | `in slugs` → `not in slugs` → RED |
| test_owner_list_total_includes_archived | 724 | `>= 2` → `== 1` → RED |

## 5. RED verification result [DONE]
```
15 tests collected: 8 failed, 7 passed
FAILED (8):
  TestOwnerDefaultExcludesArchived::test_owner_list_excludes_own_archived
  TestOwnerDefaultExcludesArchived::test_all_archived_user_all_tab_returns_empty
  TestOwnerMineExcludesArchived::test_owner_mine_excludes_archived
  TestOwnerMineExcludesArchived::test_all_archived_user_mine_returns_empty
  TestAdminArchived::test_admin_all_tab_excludes_archived
  TestStatusValidation::test_invalid_status_returns_422
  TestOwnerListArchived::test_owner_list_includes_archived_entries (updated)
  TestOwnerListArchived::test_owner_list_total_includes_archived (updated)

PASSED (7):
  TestOwnerArchivedTab::test_owner_archived_tab_shows_archived
  TestOwnerArchivedTab::test_no_archived_entries_archived_tab_empty
  TestAdminArchived::test_admin_archived_tab_sees_all_archived
  TestAnonymousArchived::test_anonymous_all_tab_excludes_archived
  TestAnonymousArchived::test_anonymous_archived_tab_returns_empty
  TestNonOwnerArchived::test_non_owner_cannot_see_others_archived_in_all_tab
  TestNonOwnerArchived::test_non_owner_cannot_see_others_archived_in_archived_tab
```

All 8 RED failures are genuine assertion failures (not import/syntax errors).
All 7 GREEN tests cover already-correct behavior (explicit status=archived filtering, anonymous exclusion, non-owner exclusion).
