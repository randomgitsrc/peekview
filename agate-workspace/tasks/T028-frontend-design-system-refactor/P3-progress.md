# T028 P3 Progress

## Step 1: Read inputs
- P0-brief: env constraints (debug :8888, no pipx), risks (D2 1:N mapping, LandingView scoped weight)
- P1-requirements: 12 BDD scenarios (S1-S12), 10 structured requirements (R1-R10), 5 implicit frontend needs (F1-F5)
- P2-design: 7 component APIs (§2.2), token alias table (§2.1.2), page-by-page changes (§2.3), gate_commands declared
- Existing test patterns: vitest + Vue Test Utils, jsdom env, @ alias, mount() + find() + trigger() + emitted()

## Step 2: Map BDD → test cases
- S1 (Explore page): TC-01..TC-07 (7 assertions → 7 test cases, mix vitest component + Playwright)
- S2 (Detail desktop): TC-08..TC-13 (6 assertions)
- S3 (Detail mobile): TC-14..TC-17 (4 assertions)
- S4 (Theme consistency): TC-18..TC-20 (3 assertions)
- S5 (Token global + LandingView): TC-21..TC-22 (2 assertions)
- S6 (Shared components): TC-23..TC-29 (7 component-level test groups)
- S7 (Old component compat): TC-30 (1 Playwright integration test)
- S8 (a11y): TC-31..TC-33 (3 assertions)
- S9 (prefers-reduced-motion): TC-34..TC-36 (3 assertions)
- S10 (API Key page): TC-37..TC-42 (6 assertions)
- S11 (404 page): TC-43..TC-46 (4 assertions)
- S12 (Build/typecheck): TC-47..TC-49 (3 assertions — gate-level, not test code)

## Step 3: Write test code
- 7 component vitest specs ✅
- 1 Playwright E2E spec ✅

## Step 4: Verify red-light status
- All 7 vitest specs import non-existent components → Module not found (B-class red)
- Playwright spec targets pages not yet refactored → computed style assertions fail (B-class red)
- Total: 49 test cases (TC-01..TC-49), 8 test files

## Output files
- P3-test-cases.md: /home/kity/oclab/peekview/docs/tasks/T028-frontend-design-system-refactor/P3-test-cases.md
- P3-test-code/: /home/kity/oclab/peekview/docs/tasks/T028-frontend-design-system-refactor/P3-test-code/
  - BaseButton.spec.ts (15 tests)
  - BaseTag.spec.ts (7 tests)
  - BaseBadge.spec.ts (10 tests)
  - SearchInput.spec.ts (12 tests)
  - EmptyState.spec.ts (10 tests)
  - EntryListRow.spec.ts (15 tests)
  - PageHeader.spec.ts (11 tests)
  - design-system.spec.ts (30 Playwright tests)
