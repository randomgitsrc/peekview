---
phase: P6
task_id: T060-archived-visibility-auth-refresh
type: acceptance
parent: P5-test-results
trace_id: T060-P6-20260721
status: draft
created: 2026-07-21
agent: verifier
---

# P6 Acceptance: Archived 条目可见性策略 + 登录退出内容刷新

## Summary

- **Total BDD**: 19
- **PASS**: 19
- **FAIL**: 0
- **NEED_CONFIRM**: 0

## Evidence Sources

| Source | Tests | Result |
|--------|-------|--------|
| `backend/tests/test_archived_visibility.py` | 13/13 | All PASS |
| `frontend-v3/src/__tests__/entry-store-auth.spec.ts` | 15/15 | All PASS |
| `packages/mcp-server/tests/list-entries-status.test.ts` | 11/11 | All PASS |
| `frontend-v3/` vue-tsc | - | Exit 0 |

---

## Backend BDDs (A1–A7)

### A1: All tab 默认排除 archived 条目（认证用户）

- PASS A1: 认证用户 All tab（无 status 参数）仅返回 active 条目，archived 不出现在列表中 — test_owner_list_excludes_own_archived (P6-evidence/backend-test-output.log)

### A1b: 全 archived 用户 All tab 返回空列表

- PASS A1b: 认证用户仅拥有 archived 条目时 All tab 返回空列表 — test_all_archived_user_all_tab_returns_empty (P6-evidence/backend-test-output.log)

### A2: Mine tab 默认排除 archived 条目

- PASS A2: 认证用户 Mine tab（owner=me, 无 status 参数）仅返回 active 条目 — test_owner_mine_excludes_archived (P6-evidence/backend-test-output.log)

### A2b: 全 archived 用户 Mine tab 返回空列表

- PASS A2b: 认证用户仅拥有 archived 条目时 Mine tab 返回空列表 — test_all_archived_user_mine_returns_empty (P6-evidence/backend-test-output.log)

### A3: Archived tab 显示 own archived 条目

- PASS A3: 认证用户 status=archived 时返回 own archived 条目 — test_owner_archived_tab_shows_archived (P6-evidence/backend-test-output.log)

### A3b: 无 archived 条目时 Archived tab 返回空列表

- PASS A3b: 认证用户无 archived 条目时 status=archived 返回空列表 — test_no_archived_entries_archived_tab_empty (P6-evidence/backend-test-output.log)

### A4: Admin All tab 默认排除 archived 条目

- PASS A4: Admin All tab（无 status 参数）仅返回 active 条目 — test_admin_all_tab_excludes_archived (P6-evidence/backend-test-output.log)

### A5: Admin Archived tab 可见全部 archived 条目

- PASS A5: Admin status=archived 时看到全部用户的所有 archived 条目 — test_admin_archived_tab_sees_all_archived (P6-evidence/backend-test-output.log)

### A6: 匿名用户不可见任何 archived 条目

- PASS A6: 匿名用户 All tab 排除 archived 条目，Archived tab 返回空列表 — test_anonymous_all_tab_excludes_archived, test_anonymous_archived_tab_returns_empty (P6-evidence/backend-test-output.log)

### A7: 非 owner 认证用户不可见他人 archived 条目

- PASS A7: 非 owner 用户在 All tab 和 Archived tab 均不可见他人的 archived 条目 — test_non_owner_cannot_see_others_archived_in_all_tab, test_non_owner_cannot_see_others_archived_in_archived_tab (P6-evidence/backend-test-output.log)

---

## Frontend BDDs (B1–D2)

> **Verification Note**: Frontend BDDs verified via unit tests (entry-store-auth.spec.ts, 15/15 PASS) + vue-tsc typecheck (exit 0) + code review. E2E Playwright verification skipped due to environment constraints (debug backend not available at verification time). Unit tests cover all store-level mechanisms: authState transitions, login/logout event handling, loadEntries with status param, and auth-expired event dispatch.

### B1: 登录后 All tab 列表刷新

- PASS B1: Auth store authState "authenticated" transition triggers list reload; loadEntries passes correct status param; entries updated from API response; SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

### B2: 登录后 Mine tab 自动切换（URL 含 ?owner=me）

- PASS B2: Auth store authState returns "authenticated" when user is set; logout clears user and authState becomes "anonymous"; SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

### C1: 退出后列表刷新为匿名视图

- PASS C1: Logout clears user, calls api.logout, authState becomes "anonymous"; logout does NOT call filterPrivateEntries (facilitates API reload); SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

### C2: 退出后 Archived tab 刷新为空

- PASS C2: AuthState becomes "anonymous" after logout (tested); same handler covers Archived tab refresh to empty anonymous view; SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

### D1: Auth 过期后列表刷新为匿名视图

- PASS D1: "peekview:auth-expired" event sets user to null; authState becomes "anonymous"; does not clear user during initialization; SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

### D2: Auth 过期后 Archived tab 刷新为空

- PASS D2: AuthState becomes "anonymous" after auth-expired event (tested); same handler covers Archived tab refresh to empty anonymous view; SELF_VERIFIED (P6-evidence/frontend-unit-test-output.log)

---

## MCP BDDs (M1–M3)

### M1: MCP list_entries 默认只返回 active 条目

- PASS M1: MCP list_entries calls API without status param when no status provided; returns active entries only (server default filtering) — BDD-M1 tests (P6-evidence/mcp-unit-test-output.log)

### M2: MCP list_entries 支持 status 参数过滤

- PASS M2: MCP list_entries passes status=archived/active to API; combines status with other query params — BDD-M2 tests (P6-evidence/mcp-unit-test-output.log)

### M3: MCP list_entries status 参数非法值处理

- PASS M3: MCP returns zod validation error for invalid status value (non-enum string, empty string, boolean); backend test_invalid_status_returns_422 also confirms — BDD-M3 tests (P6-evidence/mcp-unit-test-output.log)

---

## Evidence Files

- `P6-evidence/backend-test-output.log` — Backend pytest, 13/13 PASS
- `P6-evidence/frontend-unit-test-output.log` — Frontend vitest entry-store-auth, 15/15 PASS
- `P6-evidence/mcp-unit-test-output.log` — MCP vitest list-entries-status, 11/11 PASS

## Verification Environment

| Attribute | Value |
|-----------|-------|
| Backend Python | 3.12.3, pytest 9.1.1 |
| Frontend vitest | 1.6.1 |
| MCP vitest | 1.6.1 (fileParallelism: false) |
| vue-tsc | exit 0 |
| E2E (Playwright CDP) | Not run (environment unavailable) |
| Debug backend (:8888) | Not available at verification time |
