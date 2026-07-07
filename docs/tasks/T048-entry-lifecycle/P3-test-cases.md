---
phase: P3
task_id: T048-entry-lifecycle
type: test-cases
parent: P2-design.md
trace_id: T048-P3-20260707
status: draft
created: 2026-07-07
agent: test-designer
---

# T048 P3: Test Cases — Entry Lifecycle

## test_code_dir

- Backend: `backend/tests/test_entry_lifecycle.py`
- Frontend: `frontend-v3/src/__tests__/entry-lifecycle.test.ts`

## BDD → Test Case Mapping

### B1: Cleanup archives expired active entries

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B1-01 | `test_cleanup_archives_expired_active_entry` | B1 §3.1 | happy path |
| TC-B1-02 | `test_cleanup_archived_entry_has_archived_at_set` | B1 §3.1 | field verification |
| TC-B1-03 | `test_cleanup_archived_entry_expires_at_null` | B1 §3.1 | field verification |
| TC-B1-04 | `test_cleanup_response_has_archived_count` | B1 §3.1 | response shape |
| TC-B1-05 | `test_cleanup_response_deleted_count_zero_when_only_archiving` | B1 §3.1 | response shape |

### B2: Cleanup physically deletes old archived entries

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B2-01 | `test_cleanup_deletes_archived_entry_past_retention` | B2 §3.2 | happy path |
| TC-B2-02 | `test_cleanup_deleted_entry_removed_from_db` | B2 §3.2 | db verification |
| TC-B2-03 | `test_cleanup_deleted_entry_freed_mb_positive` | B2 §3.2 | response shape |
| TC-B2-04 | `test_cleanup_both_phases_in_single_call` | B2+B1 | integration |

### B3: Cleanup retention=0 never deletes archived

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B3-01 | `test_cleanup_retention_zero_preserves_archived` | B3 §3.3 | happy path |
| TC-B3-02 | `test_cleanup_retention_zero_deleted_count_zero` | B3 §3.3 | response shape |

### B4: PATCH expires_in extends active entry expiry

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B4-01 | `test_patch_expires_in_updates_expires_at` | B4 §3.4 | happy path |
| TC-B4-02 | `test_patch_expires_in_keeps_status_active` | B4 §3.4 | field verification |

### B5: PATCH expires_in="0" sets never expire

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B5-01 | `test_patch_expires_in_zero_clears_expires_at` | B5 §3.5 | happy path |
| TC-B5-02 | `test_patch_expires_in_zero_keeps_status_active` | B5 §3.5 | field verification |

### B6: PATCH archived entry + expires_in reactivates

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B6-01 | `test_patch_archived_entry_expires_in_reactivates` | B6 §3.6 | happy path |
| TC-B6-02 | `test_reactivated_entry_status_active` | B6 §3.6 | field verification |
| TC-B6-03 | `test_reactivated_entry_archived_at_null` | B6 §3.6 | field verification |
| TC-B6-04 | `test_reactivated_entry_expires_at_set` | B6 §3.6 | field verification |
| TC-B6-05 | `test_reactivated_with_expires_in_zero_sets_permanent` | B6 §3.6 | edge case |

### B7: Archived entry access control

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B7-01 | `test_anonymous_get_archived_public_entry_404` | B7 §3.7 | access control |
| TC-B7-02 | `test_owner_get_archived_entry_200` | B7 §3.7 | access control |
| TC-B7-03 | `test_non_owner_get_archived_entry_404` | B7 §3.7 | access control |
| TC-B7-04 | `test_admin_get_archived_entry_200` | B7 §3.7 | access control |

### B8: Owner list includes archived entries

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B8-01 | `test_owner_list_includes_archived_entries` | B8 §3.8 | happy path |
| TC-B8-02 | `test_owner_list_total_includes_archived` | B8 §3.8 | count verification |

### B9: Anonymous list excludes archived entries

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B9-01 | `test_anonymous_list_excludes_archived` | B9 §3.9 | happy path |
| TC-B9-02 | `test_anonymous_list_total_excludes_archived` | B9 §3.9 | count verification |

### B10: Share cannot be created for archived entry

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B10-01 | `test_create_share_archived_entry_400` | B10 §3.10 | happy path |

### B11: Frontend EntryDetailView expiry edit

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B11-01 | `test_active_entry_shows_expires_in_with_edit` | B11 §3.11 | UI render |
| TC-B11-02 | `test_click_edit_opens_expires_in_dialog` | B11 §3.11 | interaction |
| TC-B11-03 | `test_expires_in_dialog_calls_update_entry` | B11 §3.11 | API call |

### B12: Frontend archived entry detail page

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B12-01 | `test_archived_entry_shows_expired_banner` | B12 §3.12 | UI render |
| TC-B12-02 | `test_archived_entry_shows_reactivate_button` | B12 §3.12 | UI render |
| TC-B12-03 | `test_click_reactivate_opens_dialog` | B12 §3.12 | interaction |

### B13: Frontend list archived visual distinction

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B13-01 | `test_archived_entry_has_archived_badge` | B13 §3.13 | UI render |
| TC-B13-02 | `test_archived_entry_has_reduced_opacity` | B13 §3.13 | UI render |
| TC-B13-03 | `test_active_entry_no_archived_badge` | B13 §3.13 | negative |

### B14: FTS search excludes archived entries

| ID | Test Case | BDD Ref | Type |
|----|-----------|---------|------|
| TC-B14-01 | `test_fts_search_excludes_archived_entry` | B14 §3.14 | happy path |

## Summary

- Total test cases: 33
- Backend (pytest): 25 test cases (B1-B10, B14)
- Frontend (vitest): 8 test cases (B11-B13)
- All 14 BDD conditions covered
- Expected: all RED (implementation not yet done)
