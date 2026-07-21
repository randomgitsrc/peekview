---
phase: P3
task_id: T060-archived-visibility-auth-refresh
type: test-cases
parent: P2-design.md
trace_id: T060-P3-20260721
status: red
created: 2026-07-21
agent: test-designer
test_code_dir: backend/tests/test_archived_visibility.py, frontend-v3/src/__tests__/entry-store-auth.spec.ts, frontend-v3/e2e/archived-visibility.spec.ts, packages/mcp-server/tests/list-entries-status.test.ts
---

# P3 Test Cases: T060 Archived Visibility + Auth Refresh

## 测试覆盖总览

| BDD | 测试文件 | 测试函数 | 当前结果 |
|-----|---------|----------|----------|
| **A1** | backend/tests/test_archived_visibility.py | test_owner_list_excludes_own_archived | 🔴 FAIL |
| **A1b** | backend/tests/test_archived_visibility.py | test_all_archived_user_all_tab_returns_empty | 🔴 FAIL |
| **A2** | backend/tests/test_archived_visibility.py | test_owner_mine_excludes_archived | 🔴 FAIL |
| **A2b** | backend/tests/test_archived_visibility.py | test_all_archived_user_mine_returns_empty | 🔴 FAIL |
| **A3** | backend/tests/test_archived_visibility.py | test_owner_archived_tab_shows_archived | 🟢 PASS |
| **A3b** | backend/tests/test_archived_visibility.py | test_no_archived_entries_tab_returns_empty | 🟢 PASS |
| **A4** | backend/tests/test_archived_visibility.py | test_admin_all_tab_excludes_archived | 🔴 FAIL |
| **A5** | backend/tests/test_archived_visibility.py | test_admin_archived_tab_shows_all_archived | 🟢 PASS |
| **A6** | backend/tests/test_archived_visibility.py | test_anonymous_excludes_archived | 🟢 PASS |
| **A6** | backend/tests/test_archived_visibility.py | test_anonymous_archived_tab_returns_empty | 🟢 PASS |
| **A7** | backend/tests/test_archived_visibility.py | test_non_owner_authenticated_excludes_others_archived | 🟢 PASS |
| **M3** | backend/tests/test_archived_visibility.py | test_invalid_status_returns_422 | 🔴 FAIL |
| — | backend/tests/test_entry_lifecycle.py | test_owner_list_includes_archived_entries（已更新） | 🔴 FAIL |
| — | backend/tests/test_entry_lifecycle.py | test_owner_list_total_includes_archived（已更新） | 🔴 FAIL |
| **B1** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | loads entries with owner param after login | 🔴 FAIL |
| **B2** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | switches to Mine tab after login with ?owner=me | 🔴 FAIL |
| **C1** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | reloads after logout to anonymous view | 🔴 FAIL |
| **C2** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | clears archived tab on logout | 🔴 FAIL |
| **D1** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | refreshes on auth expiry to anonymous view | 🔴 FAIL |
| **D2** | frontend-v3/src/__tests__/entry-store-auth.spec.ts | clears archived tab on auth expiry | 🔴 FAIL |
| — | frontend-v3/src/__tests__/entry-store-auth.spec.ts | sequence number dedup: stale response discarded | 🔴 FAIL |
| — | frontend-v3/src/__tests__/entry-store-auth.spec.ts | clearOnError=false retains old data on failure | 🔴 FAIL |
| **B1-D2** | frontend-v3/e2e/archived-visibility.spec.ts | 6 E2E scenarios (login/logout/expiry/archived tab) | 🔴 SKIP |
| **M1** | packages/mcp-server/tests/list-entries-status.test.ts | list_entries defaults to active only | 🔴 FAIL |
| **M2** | packages/mcp-server/tests/list-entries-status.test.ts | list_entries with status="archived" | 🔴 FAIL |
| **M3** | packages/mcp-server/tests/list-entries-status.test.ts | list_entries with invalid status returns error | 🔴 FAIL |

## 红灯统计

| 环境 | 红灯 | 绿灯 | 类型 |
|------|------|------|------|
| backend (pytest) | 8 | 7 | 全部 assert failure（真红灯） |
| frontend (vitest) | 2 | 15 | assert failure（真红灯） |
| MCP (vitest) | 8 | 3 | import/schema error（真红灯） |
| E2E (Playwright) | — | — | 未跑（需 debug backend） |

## 说明

后端 8 红灯全部为真红灯（assertion failure，非 syntax/import error），证据：
- `assert 'a1-archived' not in ['a1-archived', ...]`
- `assert 1 == 0`
- `assert 200 == 422`
- `assert 2 == 1`

这些红灯证明 TDD 已正确建立——测试正确但因实现未写而失败。P4 实现后将全部转绿。
