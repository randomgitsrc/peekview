# P5 E2E Test Results — T065

**Command**: `E2E_SPEC=e2e/landing-auth.spec.ts make debug-test`
**Date**: 2026-07-22
**Backend**: http://127.0.0.1:8888 (debug, /tmp/peekview-debug/)
**Exit code**: 0

## Summary

- Tests: 10 passed, **0 failed**
- Browsers: chromium + Mobile Chrome
- Duration: ~9-22s

## Per-BDD results

| BDD | chromium | Mobile Chrome |
|-----|----------|---------------|
| BDD-1: authenticated full-page load → /explore | ✅ | ✅ |
| BDD-2: anonymous sees Sign in | ✅ | ✅ |
| BDD-3: authenticated NOT see Sign in | ✅ | ✅ |
| BDD-4: authenticated sees username | ✅ | ✅ |
| BDD-5: anonymous login → /explore | ✅ | ✅ |

## E2E fix applied during P5

- `landing-auth.spec.ts:111-112`: Changed `page.locator('.user-menu-trigger, .user-name')` to `page.locator('.user-menu-trigger')` + separate `toContainText('alice')` assertion. The compound CSS selector matched 2 elements (button + span), violating Playwright strict mode.

## Note: stale build

First E2E run failed (6/10) because debug backend served stale frontend build (18:53 vs source 20:02). Fixed by `make build-frontend && make debug-restart`.
