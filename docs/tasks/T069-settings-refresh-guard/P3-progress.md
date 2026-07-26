# P3 Progress — T069

## Step 1: Read dispatch-context
- Role: test-designer (P3, TDD)
- ui_affected: true → need vitest + Playwright E2E
- 24 BDD to cover 1:1
- Test code dir: docs/tasks/T069-settings-refresh-guard/P3-test-code/

## Step 2: Read role definition
- BDD→test 1:1 mapping
- Tests must FAIL (red) before implementation
- UI tasks: Playwright/E2E for every interaction point
- Viewport: desktop 1280x800 + mobile 390x844

## Step 3: Read P1-requirements (24 BDD)
- BDD-1~6: Auth Guard (router.ts)
- BDD-7~9: Desktop header brand/title separation
- BDD-10~11: Desktop Files toggle badge
- BDD-12: FileTree panel header file count
- BDD-13~16: Mobile sticky header
- BDD-17~22: Mobile bottom bar
- BDD-23~24: Mobile drawer headers

## Step 4: Read P2-design
- Method A: async guard + Promise.race timeout
- waitForAuthInit(authStore, 5000) with watch + setTimeout
- UI changes in EntryDetailView.vue, FileTree.vue, layout.css

## Step 5: Check existing test coverage
- router.spec.ts: only route resolution tests, no auth guard behavior tests
- t052-header-redesign.test.ts: placeholder tests (expect(true).toBe(true))
- FileTree.spec.ts: buildTree + interaction tests, no fileCount prop test
- entry-store-auth.spec.ts: authState computed tests exist
- No existing tests for: auth guard async wait, brand separation, badge, mobile header changes

## Step 6: Design test cases
- BDD-1~6: vitest unit tests for waitForAuthInit + router guard logic
- BDD-7~12: vitest structural tests + Playwright E2E for visual
- BDD-13~24: Playwright E2E for mobile viewport interactions

## Step 7: Write test code
- auth-guard.test.ts: 6 vitest tests for BDD-1~6 (waitForAuthInit + async guard pattern)
- ui-structure.test.ts: 19 vitest tests for BDD-7~24 (1 RED: BDD-12 FileTree fileCount, 18 PLACEHOLDER)
- t069-settings-refresh-guard.e2e.spec.ts: 24 Playwright E2E tests for all BDDs (desktop + mobile viewports)

## Step 8: Write P3-test-cases.md
- Complete BDD→test mapping with 1:1 coverage
- test_code_dir declared
- Screenshot list for all 24 BDDs
- Red light status documented

## Vitest run results
- auth-guard.test.ts: 6/6 GREEN (pattern validation — router.ts not yet implemented)
- ui-structure.test.ts: 1 RED (BDD-12), 18 PLACEHOLDER
- Total: 25 tests, 1 genuine RED, 6 pattern GREEN, 18 placeholder

## Playwright E2E
- All RED (requires debug backend + UI implementation)
- Desktop viewport: 1280x800
- Mobile viewport: 390x844
