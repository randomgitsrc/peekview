---
phase: P3
task_id: T065
type: test-cases
parent: P2-design.md
trace_id: T065-P3-20260722
status: draft
created: 2026-07-22
agent: test-designer
---

# T065 P3 Test Cases

## test_code_dir

- Unit tests: `frontend-v3/src/__tests__/landing-auth.spec.ts`
- E2E tests: `frontend-v3/e2e/landing-auth.spec.ts`

## BDD → Test Case Mapping

| Test ID | BDD | Type | Description | Expected Result (before fix) |
|---------|-----|------|-------------|------------------------------|
| TC-1 | BDD-1 | Unit | `router.replace('/explore')` called when authState already `'authenticated'` on mount | FAIL: replace not called (watch lacks `immediate: true`) |
| TC-2 | BDD-2 | Unit | Sign in button visible when authState=`'anonymous'` | PASS (current code works) |
| TC-3 | BDD-3 | Unit | Sign in button NOT visible when authState=`'authenticated'` | FAIL: button still rendered (no v-if) |
| TC-4 | BDD-4 | Unit | userName rendered in nav when authState=`'authenticated'` | FAIL: no user-menu element (no conditional render) |
| TC-5 | BDD-5 | Unit | `router.replace('/explore')` called when authState changes anonymous→authenticated | PASS (current watch works for state changes) |
| TC-6a | BDD-6 | Unit | Landing logo renders when authState=`'loading'` | PASS (current code works) |
| TC-6b | BDD-6 | Unit | Sign in button NOT visible when authState=`'loading'` | FAIL: button still rendered (no v-if) |
| E2E-1 | BDD-1 | E2E | Authenticated user full-page load `/` → redirected to `/explore` | FAIL: stays on `/` |
| E2E-2 | BDD-2 | E2E | Anonymous user sees Sign in button on landing | PASS |
| E2E-3 | BDD-3 | E2E | Authenticated user does NOT see Sign in on landing | FAIL: Sign in visible |
| E2E-4 | BDD-4 | E2E | Authenticated user sees username on landing nav | FAIL: no username shown |
| E2E-5 | BDD-5 | E2E | Anonymous user login from landing → redirects to `/explore` | PASS (existing watch works) |

## Red Light Summary

4 unit tests fail with assertion errors (B-class = true red):
- TC-1: watch immediate missing → no redirect on mount
- TC-3: no v-if on Sign in → visible when authenticated
- TC-4: no user-menu conditional render → no username shown
- TC-6b: no v-if on Sign in → visible when loading

3 unit tests pass (existing correct behavior):
- TC-2, TC-5, TC-6a

E2E tests require debug backend running; expected same failure pattern.

## Test Infrastructure

- **Unit**: vitest + vue-test-utils + jsdom, `@` alias via vitest.config.ts
- **E2E**: Playwright, `BASE_URL=http://127.0.0.1:8888`, debug backend + seed data (alice/testpass123)
- **Mocking**: `@/api/client` mocked for unit tests; `__APP_VERSION__` stubbed globally
