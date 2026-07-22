# P3 Progress — T065

## Input files read
- P0-brief.md: bug description (Sign in unconditional + redirect timing)
- P1-requirements.md: 6 BDD conditions (BDD-1 through BDD-6)
- P2-design.md: Solution A (watch immediate + Sign in conditional render)
- LandingView.vue: Current code — Sign in at :19 no v-if, watch at :206 no immediate
- router.ts: beforeEach guard only checks authState==='authenticated' (misses loading)
- auth.ts: authState computed (loading/authenticated/anonymous), fetchMe sets initializing=false
- EntryListView.vue: Reference pattern for auth UI (v-if anonymous/authenticated)
- LoginDialog.vue: Emits visible=false on success, calls authStore.login
- Existing tests: router.spec.ts, entry-store-auth.spec.ts (patterns for mocking)
- vitest.config.ts: jsdom env, @ alias, exclude e2e/

## BDD → Test mapping plan
- BDD-1: Unit test — watch immediate triggers router.replace when authState already 'authenticated' on mount
- BDD-2: Unit test — Sign in button visible when authState='anonymous'
- BDD-3: Unit test — Sign in button NOT visible when authState='authenticated'
- BDD-4: Unit test — userName rendered in nav when authState='authenticated'
- BDD-5: Unit test — watch triggers router.replace when authState changes anonymous→authenticated
- BDD-6: Unit test — landing renders logo content when authState='loading', URL stays /
- E2E: Playwright tests for BDD-1, BDD-2, BDD-3, BDD-5 (interaction-heavy)

## Test execution results (vitest run)
- 7 tests total: 4 failed (B-class, assertion failures = true red), 3 passed
- BDD-1: FAIL — router.replace not called (needs watch immediate) ✓ RED
- BDD-2: PASS — Sign in visible when anonymous (current code already works)
- BDD-3: FAIL — Sign in still visible when authenticated (needs v-if) ✓ RED
- BDD-4: FAIL — No user menu rendered when authenticated (needs conditional render) ✓ RED
- BDD-5: PASS — watch triggers on anonymous→authenticated change (current code works)
- BDD-6a: PASS — Logo renders when loading (current code works)
- BDD-6b: FAIL — Sign in visible when loading (needs v-if) ✓ RED

4 true red lights, 3 already-green (existing behavior). TDD gate: exit 0 (true red present).

## Final verification
- Full vitest run: 62 existing test files passed, 1 new file (landing-auth.spec.ts) has 4 true red lights
- No regressions in existing tests
- P3-test-cases.md written with test_code_dir declared
- E2E test file written (requires debug backend to run)
