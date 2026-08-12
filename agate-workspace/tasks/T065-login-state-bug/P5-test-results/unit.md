# P5 Unit Test Results — T065

**Command**: `cd frontend-v3 && npx vitest run --reporter=dot`
**Date**: 2026-07-22
**Exit code**: 0

## Summary

- Test Files: 63 passed (63)
- Tests: 934 passed, 1 skipped, **0 failed**
- Duration: ~10-14s

## T065-specific tests

- `src/__tests__/landing-auth.spec.ts`: 7/7 passed
  - BDD-1: authenticated full-page load redirect ✅
  - BDD-2: anonymous Sign in visible ✅
  - BDD-3: authenticated Sign in NOT visible ✅
  - BDD-4: authenticated user identity in nav ✅
  - BDD-5: anonymous login → redirect (no regression) ✅
  - BDD-6a: fetchMe in progress → landing renders ✅
  - BDD-6b: fetchMe in progress → Sign in NOT shown ✅

## Pre-existing failures

None.

## TS fix applied during P5

- `landing-auth.spec.ts:20`: `initialRoute` → `_initialRoute` (unused param)
- `landing-auth.spec.ts:124`: removed unused `wrapper` destructuring
