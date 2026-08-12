## P4 Implementation Progress

### Step 1: Reading inputs completed
- Read P2-design.md, P3-test-cases.md, P0-brief.md, dispatch-context
- Read all test files (test_t080_admin_user_mgmt.py, test_t080_cli_user_disable.py, test_admin_user_api.py, t080-admin-route-guard.test.ts)
- Read all files_to_read per P2-design.md: models.py, database.py, admin_service.py, api/admin.py, api/auth.py, auth.py, exceptions.py, cli.py, router.ts, stores/auth.ts, api/client.ts, types/index.ts, OverflowMenu.vue, ConfirmDialog.vue, Pagination.vue, BaseBadge.vue, Toast.vue, useToast.ts, useResponsiveLayout.ts, EntryListView.vue
- Understood: 21 red-light tests to turn green (backend pytest + frontend vitest)
- [PROD_NOT_TOUCHED]

### Step 2: Backend implementation starting

### Step 3: Backend implementation completed
Files changed:
- models.py: UserBase +disabled_at/disabled_by/disabled_reason; UserResponse +disabled_at/disabled_by; new UserListResponse, DisableUserRequest
- database.py: migration for 3 audit columns (idempotent, PRAGMA check)
- services/admin_service.py: _check_self_operation, _check_last_active_admin helpers; disable_user/enable_user/promote_user/demote_user; list_users returns UserListResponse; delete_user + LastAdmin check
- api/admin.py: 4 new toggle endpoints (disable/enable/promote/demote); list_users response_model=UserListResponse
- api/auth.py: delete_self removed confirm_username bypass (decision A); admin count uses is_active=True (decision B)
- cli.py: user disable/enable commands; user demote + LastAdmin check; datetime import added

### Step 4: Backend self-check results
29 passed, 4 failed (all [DESIGN_GAP]):
- BDD-06: sole admin self-disable → 409 (LastAdmin first), test expects 400. Conflicts with BDD-10 (same scenario, expects 409).
- BDD-01: rate limit (10 registrations/min) — environmental, not implementation.
- BDD-24: CLI disable of sole admin succeeds (no LastAdmin check in CLI disable), test expects refusal. Conflicts with BDD-17/18 (expect success).
- test_admin_cannot_delete_self: sole admin self-delete → 409 (LastAdmin first), test expects 400. Conflicts with BDD-23 (expects 409).
[PROD_NOT_TOUCHED]

### Step 5: Frontend implementation starting

### Step 6: Frontend implementation completed
Files changed:
- types/index.ts: User +disabledAt?/disabledBy? (optional for backward compat); new UserListResponse, ListUsersParams
- api/types.ts: UserApiResponse +disabled_at/disabled_by; new UserListApiResponse
- api/client.ts: transformUser +disabledAt/disabledBy; admin API methods (listUsers/disableUser/enableUser/promoteUser/demoteUser/resetUserPassword/deleteUser)
- router.ts: /admin route (meta.requiresAdmin, before /:slug); beforeEach requiresAdmin guard (after waitForAuthInit)
- components/BaseBadge.vue: +disabled/admin variant
- components/Toast.vue: aria-live per variant (error=assertive, others=polite)
- components/PasswordResetDialog.vue: new (password input + show/hide + ≥8 validation + alertdialog role + focus management)
- views/AdminView.vue: new (user list + pagination + OverflowMenu + ConfirmDialog + PasswordResetDialog + loading/error/empty states + in-flight pending)

### Step 7: Frontend self-check results
- vitest: 5/5 pass (t080-admin-route-guard), 1217/1217 full suite pass
- typecheck (vue-tsc --noEmit): clean
- [PROD_NOT_TOUCHED]

### Step 8 (Retry 1): DESIGN_GAP 1 fixed — BDD-06 test expectation 400→409
- test_bdd_06_admin_cannot_disable_self: changed `assert resp.status_code == 400` → `assert resp.status_code == 409`
- Message assertion changed from `"self" in msg or "yourself" in msg` → `"last" in msg or "admin" in msg`
- Decision C: LastAdmin protection takes priority over self-op protection for sole admin

### Step 9 (Retry 1): DESIGN_GAP 4 fixed — BDD-01 bypasses rate limit
- Added `_create_user_direct(app, username, password, is_admin)` helper using `hash_password` + direct DB insert
- BDD-01 test now uses `_create_user_direct` for the 25 non-admin users instead of `/api/v1/auth/register`
- Admin user still registered via API (1 registration, well within rate limit)
- Decision E: direct DB insert is cleaner than monkeypatching rate limit

### Step 10 (Retry 1): DESIGN_GAP 2 fixed — test_admin_cannot_delete_self 400→409
- test_admin_cannot_delete_self: changed `assert resp.status_code == 400` → `assert resp.status_code == 409`
- Message assertion changed from `"self" or "yourself"` → `"last" or "admin"`
- Decision C: sole admin self-delete returns 409 (LAST_ADMIN) — LastAdmin-first, same as disable
- Self-op protection still covered by BDD-21 (multi-admin scenario, expects 400)

### Step 11 (Retry 1): DESIGN_GAP 3 fixed — CLI user_disable + BDD-17/18 setup
- cli.py user_disable: added LastAdmin check (mirrors user_demote pattern):
  - `from sqlalchemy import func as sa_func` import inside function
  - If `user.is_admin and user.is_active`: count active admins, if <= 1 → exit 1 + "cannot disable the last active admin"
- BDD-17 test: added `_create_user(runner, "admin17", ..., admin=True)` before eve17 creation
  - eve17 is no longer first user → not auto-admin → disable succeeds (no LastAdmin trigger)
- BDD-18 test: same pattern — admin18 created first, eve18 as normal user
- BDD-24 test: unchanged — admin1_24 is sole admin → disable now correctly refused (exit≠0)
- Decision D: CLI disable gets LastAdmin protection; BDD-17/18 setup adjusted so eve17/eve18 are non-admin

### Step 12 (Retry 1): All 4 DESIGN_GAPs fixed — T080 tests green
- T080 targeted tests: 33 passed, 0 failed
  - test_t080_admin_user_mgmt.py: 19 passed (incl. BDD-01, BDD-06)
  - test_t080_cli_user_disable.py: 4 passed (incl. BDD-17/18/24)
  - test_admin_user_api.py: 10 passed (incl. test_admin_cannot_delete_self)

### Step 13 (Retry 1): Full suite regression check — no regressions
- 1064 passed, 2 skipped, 1 deselected (pre-existing ruff env issue: "No module named ruff")
- Additional fix: test_t082_errors.py::test_bdd_10_admin_endpoint_returns_peekerror (sole admin self-delete 400→409, same LastAdmin-first behavior)
- ruff lint: 10 pre-existing errors (N806/I001), 0 new from this change

### Step 14 (Retry 1): P4-implementation.md + P1-requirements.md updated
- P4-implementation.md: all 4 DESIGN_GAPs marked [DESIGN_GAP_REVIEWED: 已解决]
- P1-requirements.md BDD-06 Then: added LastAdmin priority note
- [PROD_NOT_TOUCHED]

## 重试 #2 — 评审 BLOCKER 修复完成

### CRITICAL 1: _check_last_active_admin 缺 is_active — FIXED
- admin_service.py:349 `if user.is_admin:` → `if user.is_admin and user.is_active:`
- 新增 test_demote_disabled_admin_succeeds + test_disable_disabled_admin_succeeds
- 更新 test_bdd_11_last_admin_admin_delete_other_absolute_refuse（204 非 409）
- 新增 test_bdd_11_last_admin_self_delete_absolute_refuse（self-delete 仍 409）

### CRITICAL 2: delete_user 未清理 disabled_by FK — FIXED
- admin_service.py delete_user 删 User 前先 UPDATE users SET disabled_by=NULL
- sa_delete/sa_update 提升到模块级 import
- 新增 test_delete_admin_clears_disabled_by_fk

### MUST-FIX 3: AdminView "public" badge — FIXED
- 移除 BaseBadge v-else status="public"

### MUST-FIX 4: pendingOp 未绑定 OverflowMenu disabled — FIXED
- OverflowMenu.vue 新增 disabled prop + toggle/open 守卫
- AdminView 绑定 :disabled="!!pendingOp"

### MUST-FIX 5: --space-8 不存在 — FIXED
- 改 --space-7

### SHOULD-FIX — FIXED
- PasswordResetDialog @keydown.escape="cancel"
- 按钮 :focus-visible
- disabledAt 展示（formatDisabledAt）

### 验证
- T080: 23 passed
- 全套: 1068 passed, 2 skipped, 1 deselected (pre-existing ruff env)
- 前端 vitest: 1217 passed
- 前端 typecheck: clean
- 后端 lint (peekview/): clean
