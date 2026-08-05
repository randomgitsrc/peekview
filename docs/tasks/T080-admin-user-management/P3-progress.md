P3 progress start 2026-08-05T20:10:53Z
[PROD_NOT_TOUCHED]
## input 1-3 read
- P1: 24 BDD confirmed (BDD-01..24), mapping: backend pytest (03/04/05/07/08/09/10/11/12/13/16/22/23), CLI (17/18/19/24), vitest (14/15), Playwright E2E (01/02/06/12/20/21)
- P2: Plan A (independent POST endpoints), files_to_read confirmed, ui_affected=true, gate_commands.P3=make test-quick
- P0: env constraints confirmed, debug :8888 isolation
- BDD-11: delete_self confirm_username bypass REMOVAL (decision A) — need to check existing test_auth.py
- BDD-22/23: admin count = is_admin AND is_active
## input 4-7 read + backend code inspect
- conftest: autouse isolate_config_file (PEEKVIEW_STORAGE__DATA_DIR/DB_PATH -> tmp_path), asyncio_mode=auto, client fixture (AsyncClient + ASGITransport)
- factories: EntryFactory/FileFactory only (no UserFactory) — will create users inline via _register helper pattern
- test_admin_user_api.py EXISTS (not test_admin.py). Has: test_admin_delete_user_cascade, test_admin_cannot_delete_self, test_unique_admin_delete_self_requires_confirm (CONFIRM_USERNAME BYPASS — line 113-117, MUST UPDATE to absolute refuse per decision A), test_user_delete_self, test_admin_reset_password, test_non_admin_cannot_delete_user, test_admin_list_users_by_username (asserts list[0] — WILL BREAK after UserListResponse change, must update to data["items"][0])
- test_auth.py: TestAdminRole class, no delete_self tests (those are in test_admin_user_api.py)
- list_users currently returns list[UserResponse] (admin.py:36 response_model=list[UserResponse], admin_service.py:309)
- delete_self (auth.py:231-251): confirm_username Query param, admin_count = is_admin only (no is_active — bug to fix per decision B), bypass when confirm_username==username
- LastAdminError: status 409, error_code LAST_ADMIN
- CLI: user_promote/demote at cli.py:1579-1620, no LastAdmin check; user_delete local at :1646-1665 uses admin_svc.delete_user(current_user_id=-1); no disable/enable commands
- test_cli.py: uses CliRunner + isolated_fs fixture (PEEKVIEW_STORAGE__* env isolated). NO existing user command tests.
## input 8-10 read
- auth.ts store: isAdmin computed (user.value?.isAdmin ?? false), authState (loading/authenticated/anonymous), initializing ref
- router.ts: routes array (/ /explore /settings /settings/apikeys /users/:username /:slug 404), NO /admin route yet. beforeEach: waitForAuthInit(5000) then handle / and /settings only. /admin route + requiresAdmin guard NOT YET IMPLEMENTED.
- playwright.config.ts: projects = chromium (Desktop Chrome) + Mobile Chrome (Pixel 5). CDP endpoint via env. webServer npm run dev :5173. NO explicit desktop 1280x800 / mobile 390x844 project — E2E tests will setViewportSize inline.
- E2E pattern (t079): BASE_URL=127.0.0.1:8888, beforeAll health check + prod guard, beforeEach clearCookies, login helper via LoginDialog, test.describe serial, BDD-NN naming
- vitest pattern (t069-auth-guard): vi.mock('@/api/client', () => ({ api: {...} })) with STRING LITERAL only, createGuardedRouter helper replicating beforeEach, setActivePinia(createPinia()), manipulate authStore.initializing + user directly. THIS IS THE PATTERN for BDD-14/15.
- types/index.ts User: {id, username, displayName, isActive, isAdmin, createdAt} — NO disabledAt yet
- api/client.ts transformUser: maps snake_case -> camelCase, NO disabledAt. NO admin API methods yet (listUsers/disableUser/etc).

## Design decisions
- Backend tests: new file backend/tests/test_t080_admin_user_mgmt.py (BDD-03/04/05/06/07/08/09/10/11/12/13/16/20/21/22/23)
- Update existing: test_admin_user_api.py test_unique_admin_delete_self_requires_confirm (BDD-11 absolute refuse) + test_admin_list_users_by_username (UserListResponse items)
- CLI tests: new file backend/tests/test_t080_cli_user_disable.py (BDD-17/18/19/24) using CliRunner + isolated_fs
- Frontend vitest: new file frontend-v3/src/__tests__/t080-admin-route-guard.test.ts (BDD-14/15)
- Playwright E2E: new file frontend-v3/e2e/admin.spec.ts (BDD-01/02/06/12/20/21) + multi viewport
## test code written + red light confirmed
- backend/tests/test_t080_admin_user_mgmt.py: 17 tests (BDD-01/02/03/04/05/06/07/08/09/10/11x2/12/13/16/20/21/22/23)
- backend/tests/test_t080_cli_user_disable.py: 4 tests (BDD-17/18/19/24)
- backend/tests/test_admin_user_api.py: UPDATED test_unique_admin_delete_self_requires_confirm (BDD-11 absolute refuse) + test_admin_list_users_by_username + test_admin_delete_user_cascade (UserListResponse items)
- frontend-v3/src/__tests__/t080-admin-route-guard.test.ts: 5 tests (BDD-14 + BDD-15 x3 + admin access)
- frontend-v3/e2e/admin.spec.ts: 6 BDD x 2 viewports + BDD-14/15 route guard = 14 E2E cases

## red light result
- pytest: 22 failed, 11 passed (B-class: 405 Method Not Allowed for missing endpoints, assertion failures for 204!=409, missing CLI commands). No A-class syntax/import errors.
- BDD-12 backend test passes (reset-password endpoint already exists) — BDD-12 TDD red is E2E (PasswordResetDialog not built)
- E2E red expected (page/components don't exist) — B-class acceptable per dispatch
## full suite + vitest verified
- Full backend pytest: 23 failed, 1042 passed (T080 = 22 new red + 1 updated red; 1 pre-existing t073 ruff env issue unrelated)
- Frontend vitest t080-admin-route-guard: 5 passed (guard logic spec — mirrors t069 pattern; real red is E2E against actual router.ts)
- gate_commands.P3 = make test-quick: confirmed red (B-class, no A-class syntax/import errors in T080 tests)

## P3 complete
- 24 BDD 1:1 mapped
- test_code_dir declared in P3-test-cases.md
- backend pytest red confirmed (primary gate)
- E2E code written (red expected, B-class acceptable)
- [PROD_NOT_TOUCHED] throughout
