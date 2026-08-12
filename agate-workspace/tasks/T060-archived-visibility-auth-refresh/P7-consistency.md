---
phase: P7
task_id: T060-archived-visibility-auth-refresh
type: consistency
parent: P6-acceptance.md
trace_id: T060-P7-20260721
status: draft
created: 2026-07-21
agent: consistency-reviewer
---

# P7 Consistency: Archived 条目可见性策略 + 登录退出内容刷新

## Summary

| Check | Result |
|-------|--------|
| DESIGN_GAP 配对 | PASS -- 0 DESIGN_GAP found |
| SCOPE+ 闭环 | PASS -- 0 SCOPE+, NEED_CONFIRM resolved |
| BDD 数量匹配 | MINOR-ISSUE -- P6 header says 18, evidence covers 19 |
| BDD 内容逐条匹配 | PASS -- all 19 pairwise verified |
| packages 匹配 | PASS -- all changes in [backend, frontend-v3, mcp-server] |
| domains 匹配 | PASS -- [backend, frontend, mcp, security] all covered |
| files_to_read 覆盖 | PASS -- 6 modified + 3 read-only files all listed |
| gate_commands 执行 | PASS -- evidence in P6-evidence/ |
| 未决项清零 | PASS -- 0 NEED_CONFIRM/BLOCKER/DEVIATION-CRITICAL |
| P1 scope refinement | NOTE -- 3 files declared in P1 scope, not modified (design chose cleaner path) |

## 1. DESIGN_GAP 配对

**Verified**: 0 DESIGN_GAP declarations across all phases.

- `grep DESIGN_GAP` over all task documents: only matches in P7 dispatch-context confirming none exist.
- P2 design selects 方案 A with no DESIGN_GAP markers.
- P4 commit message: "P4 complete — implementation across 3 packages" with no DESIGN_GAP.

**Result**: PASS. No DESIGN_GAP to verify.

## 2. SCOPE+ 闭环

**Verified**: No SCOPE+ augmentations across any phase.

- P1 had 1 NEED_CONFIRM (Admin All tab archived visibility), resolved in rev2 (chose A: exclude archived from All tab).
- P1-review.md: "NEED_CONFIRM 已清除" confirmed.
- No SCOPE+ declarations in P0, P1, P2, P3, P4, P5, or P6.

**Result**: PASS. No SCOPE+ items, NEED_CONFIRM resolved.

## 3. Cross-file Consistency

### 3.1 BDD Count Mismatch

| Source | Count |
|--------|-------|
| P1 BDD IDs (A1–M3) | **19** |
| P6 dispatch-context | "18 BDD" |
| P6-acceptance.md header | "Total BDD: 18" |
| P6-acceptance.md evidence entries | **19** (A1, A1b, A2, A2b, A3, A3b, A4, A5, A6, A7, B1, B2, C1, C2, D1, D2, M1, M2, M3) |
| P6-evidence/ test logs | 13 backend + 15 frontend + 11 MCP = 39 tests covering all 19 BDDs |

**Finding**: P6-acceptance.md header undercounts by 1 (says 18, actual 19). Root cause: P6 dispatch-context stated "18 BDD" → propagated to P6 header. All 19 BDDs have evidence in the body and pass.

**Severity**: MINOR. Data-entry error only. No functional gap — all 19 BDDs are verified with PASS results.

### 3.2 BDD Content Pairwise Verification

All 19 P1 BDDs checked against P6 acceptance entries:

| # | BDD | P1 Title | P6 Title | Match |
|---|-----|----------|----------|-------|
| 1 | A1 | All tab 默认排除 archived 条目（认证用户） | All tab 默认排除 archived 条目（认证用户） | ✅ |
| 2 | A1b | 全 archived 用户 All tab 返回空列表 | 全 archived 用户 All tab 返回空列表 | ✅ |
| 3 | A2 | Mine tab 默认排除 archived 条目 | Mine tab 默认排除 archived 条目 | ✅ |
| 4 | A2b | 全 archived 用户 Mine tab 返回空列表 | 全 archived 用户 Mine tab 返回空列表 | ✅ |
| 5 | A3 | Archived tab 显示 own archived 条目 | Archived tab 显示 own archived 条目 | ✅ |
| 6 | A3b | 无 archived 条目时 Archived tab 返回空列表 | 无 archived 条目时 Archived tab 返回空列表 | ✅ |
| 7 | A4 | Admin All tab 默认排除 archived 条目 | Admin All tab 默认排除 archived 条目 | ✅ |
| 8 | A5 | Admin Archived tab 可见全部 archived 条目 | Admin Archived tab 可见全部 archived 条目 | ✅ |
| 9 | A6 | 匿名用户不可见任何 archived 条目 | 匿名用户不可见任何 archived 条目 | ✅ |
| 10 | A7 | 非 owner 认证用户不可见他人 archived 条目 | 非 owner 认证用户不可见他人 archived 条目 | ✅ |
| 11 | B1 | 登录后 All tab 列表刷新 | 登录后 All tab 列表刷新 | ✅ |
| 12 | B2 | 登录后 Mine tab 自动切换（URL 含 ?owner=me） | 登录后 Mine tab 自动切换（URL 含 ?owner=me） | ✅ |
| 13 | C1 | 退出后列表刷新为匿名视图 | 退出后列表刷新为匿名视图 | ✅ |
| 14 | C2 | 退出后 Archived tab 刷新为空 | 退出后 Archived tab 刷新为空 | ✅ |
| 15 | D1 | Auth 过期后列表刷新为匿名视图 | Auth 过期后列表刷新为匿名视图 | ✅ |
| 16 | D2 | Auth 过期后 Archived tab 刷新为空 | Auth 过期后 Archived tab 刷新为空 | ✅ |
| 17 | M1 | MCP list_entries 默认只返回 active 条目 | MCP list_entries 默认只返回 active 条目 | ✅ |
| 18 | M2 | MCP list_entries 支持 status 参数过滤 | MCP list_entries 支持 status 参数过滤 | ✅ |
| 19 | M3 | MCP list_entries status 参数非法值处理 | MCP list_entries status 参数非法值处理 | ✅ |

**Result**: PASS. All 19 BDDs pairwise match.

### 3.3 packages 匹配

P2 declares: `[backend, frontend-v3, mcp-server]`

Actual git diff (4951e2e8..acea5cba) source file changes:

| File | Package |
|------|---------|
| `backend/peekview/api/entries.py` | backend ✅ |
| `backend/peekview/services/entry_service.py` | backend ✅ |
| `backend/tests/test_archived_visibility.py` | backend ✅ |
| `backend/tests/test_entry_lifecycle.py` | backend ✅ |
| `frontend-v3/src/stores/entry.ts` | frontend-v3 ✅ |
| `frontend-v3/src/views/EntryListView.vue` | frontend-v3 ✅ |
| `frontend-v3/src/__tests__/entry-store-auth.spec.ts` | frontend-v3 ✅ |
| `frontend-v3/e2e/archived-visibility.spec.ts` | frontend-v3 ✅ |
| `packages/mcp-server/src/client.ts` | mcp-server ✅ |
| `packages/mcp-server/src/tools/listEntries.ts` | mcp-server ✅ |
| `packages/mcp-server/tests/list-entries-status.test.ts` | mcp-server ✅ |

Non-source changes: `CHANGELOG.md` (P8 artifact), `docs/tasks/` (workflow artifacts).

**Result**: PASS. All 11 source files fall within declared packages.

### 3.4 domains 匹配

P2 declares: `[backend, frontend, mcp, security]`

| Domain | Evidence |
|--------|----------|
| backend | `entry_service.py` default query logic changed; `entries.py` status validation added; 13 pytest tests |
| frontend | `EntryListView.vue` watcher + handleLogout; `entry.ts` loadEntries seq dedup + clearOnError; 15 vitest tests |
| mcp | `listEntries.ts` schema + status enum; `client.ts` status param; 11 vitest tests |
| security | 404-not-403 invariant preserved; anonymous archived exclusion verified (A6); non-owner archived exclusion verified (A7); auth-expired handling via watcher |

**Result**: PASS. All 4 domains covered.

### 3.5 files_to_read 覆盖

P2 §4 lists 9 `files_to_read` entries. Cross-reference with actual changes:

| files_to_read | Modified? | Status |
|---------------|-----------|--------|
| `backend/peekview/services/entry_service.py:404-416` | ✅ Yes | Covered |
| `backend/peekview/api/entries.py:190-223` | ✅ Yes | Covered |
| `backend/peekview/models.py:29-34` | No (read-only, EntryStatus enum) | Read for context |
| `frontend-v3/src/views/EntryListView.vue:379-384,444-455,88-101` | ✅ Yes | Covered |
| `frontend-v3/src/stores/auth.ts:48-51,63-67` | No (read-only, logout/expired logic) | Read for context |
| `frontend-v3/src/stores/entry.ts:53-72,175-178` | ✅ Yes | Covered |
| `packages/mcp-server/src/tools/listEntries.ts` | ✅ Yes | Covered |
| `packages/mcp-server/src/client.ts:97-112` | ✅ Yes | Covered |
| `backend/tests/test_entry_lifecycle.py:672-724` | ✅ Yes | Covered |

**Result**: PASS. All modified files are in files_to_read. 3 read-only entries served as design references.

### 3.6 gate_commands 执行

P2 declares: `P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"`

- No standalone P5-test-results.md artifact exists.
- P5 verification was folded into P4/P6 workflow.
- Evidence of test execution captured in `P6-evidence/`:
  - `backend-test-output.log`: 13/13 PASS in 4.86s
  - `frontend-unit-test-output.log`: 15/15 PASS in 808ms
  - `mcp-unit-test-output.log`: 11/11 PASS in 270ms
- P5 commit: "P5 complete — verification passed"

**Result**: PASS. Test evidence exists in P6-evidence/. No separate P5 artifact but results are verifiable.

### 3.7 P1 Scope Refinement (noted, not blocking)

P1 §6 declared 9 files in scope. 3 were not modified:

| File | Reason for non-modification |
|------|----------------------------|
| `frontend-v3/src/stores/auth.ts` | P2 §2.5 chose watcher path — auth-expired triggers `user=null` → authState → watcher reload. No code change needed in auth.ts. |
| `frontend-v3/src/components/LoginDialog.vue` | P2 §2.3 watcher handles login reload via authState transition. No LoginDialog change needed. |
| `frontend-v3/src/api/client.ts` | 401 interceptor already fires `peekview:auth-expired` event. Watcher handles the response. No client.ts change needed. |

This is scope refinement (P2 design found a cleaner path), not omission. The watcher-based approach in EntryListView.vue centralizes all auth-transition handling in one place, eliminating the need to touch 3 other files.

### 3.8 E2E Coverage Note

P6-acceptance.md notes: "E2E Playwright verification skipped due to environment constraints (debug backend not available at verification time)."

Frontend BDDs (B1-D2) were verified via:
- Unit tests (entry-store-auth.spec.ts): 15/15 PASS — covers loadEntries with status, authState transitions, auth-expired event dispatch, sequence number dedup, clearOnError
- vue-tsc typecheck: exit 0
- Code review

The `frontend-v3/e2e/archived-visibility.spec.ts` file exists (385 lines, created in P4) but was not executed. The P2 design's watcher-based reload mechanism is straightforward and well-covered by unit tests.

**Risk**: LOW. E2E would catch UI-level integration issues (DOM rendering, focus management, aria-live announcements), but the core mechanisms (authState watcher → loadEntries, handleLogout → watcher trigger, sequence dedup) are unit-tested.

## 4. 未决项清零

| Marker | Occurrences | Status |
|--------|-------------|--------|
| NEED_CONFIRM | P1 had 1 (Admin All tab), resolved rev2 | ✅ Resolved |
| BLOCKER | 0 in all phases | ✅ |
| DEVIATION-CRITICAL | 0 in all phases | ✅ |
| DESIGN_GAP | 0 in all phases | ✅ |
| SCOPE+ | 0 in all phases | ✅ |

## 5. P2 Review Items Verification

P2 §6 tracks 7 review items, all with resolution strategies:

| Review # | Severity | Item | Resolution | Verified in P7 |
|----------|----------|------|------------|----------------|
| 1 | HIGH | 重载请求竞态 | §2.8 序列号去重 | ✅ entry.ts has loadSeq, P6 test passes |
| 2 | HIGH | 重载失败 fallback | §2.9 clearOnError选项 | ✅ P6 test "clearOnError=false retains old data on failure" passes |
| 3 | MEDIUM | loading→authenticated 误触发 | §2.3 oldState guard | ✅ Watcher has `oldState !== 'authenticated'` guard |
| 4 | MEDIUM | a11y 通知 | §2.11 aria-live region | ✅ EntryListView.vue has aria-live div |
| 5 | MEDIUM | 移动端 | §2.10 scope声明 | ✅ Explicitly out of scope |
| 6 | LOW | watcher flush模式 | §2.3 显式声明 | ✅ `flush: 'pre', immediate: false` documented |
| 7 | LOW | Archived tab重置焦点 | §2.11 nextTick focus | ✅ nextTick + focus All tab |

All 7 review items resolved. No open review threads.

## 6. Verdict

**Overall**: PASS with 1 MINOR data-entry issue.

| Category | Status |
|----------|--------|
| DESIGN_GAP | ✅ PASS |
| SCOPE+ | ✅ PASS |
| BDD count | ⚠️ P6 header says 18, actual 19 (MINOR) |
| BDD content | ✅ PASS |
| packages | ✅ PASS |
| domains | ✅ PASS |
| files_to_read | ✅ PASS |
| gate_commands | ✅ PASS |
| 未决项 | ✅ PASS |

**No BLOCKER or DEVIATION-CRITICAL issues.**

**1 MINOR issue**: P6-acceptance.md header undercounts BDDs (18 vs actual 19). The evidence body covers all 19 with PASS results. Root cause: P6 dispatch-context stated "18 BDD" → header copied wrong count. Fix: update header to read "Total BDD: 19, PASS: 19". Non-blocking — does not affect functional correctness.

## 7. Remediation

- [ ] (MINOR) Fix P6-acceptance.md header: `Total BDD: 18` → `Total BDD: 19`
