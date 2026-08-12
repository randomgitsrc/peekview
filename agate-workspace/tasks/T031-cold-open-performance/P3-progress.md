# P3 Progress

## 2026-07-22 Input Reading

- [x] P3-dispatch-context-test-designer.md: 7 BDD, ui_affected=true, vitest+E2E required
- [x] P0-brief.md: env_constraints debug :8888, ui_affected true
- [x] P1-requirements.md: BDD-1~7 defined (parallel load, native links, separator, placeholder, button text, skeleton, nested interactions)
- [x] P2-design.md: A1 parallel Promise.all, B1 whole-card <a>, C1 font-family fix, D placeholder, E "Browse public", F skeleton
- [x] EntryCard.vue: div.card-body role=button tabindex=0, router-link username, meta-sep with ·
- [x] EntryListRow.vue: div root role=button tabindex=0, router-link username, meta-sep with ·
- [x] stores/entry.ts:81-105: loadEntry sequential (await getEntry → selectFile → getFileContent)
- [x] EntryListView.vue:108-110: "Loading..." text, line 62: Chinese placeholder
- [x] LandingView.vue:45,167: "Explore" text
- [x] vitest.config.ts: jsdom, globals, @ alias, excludes e2e/
- [x] Existing test pattern: EntryListRow.spec.ts uses mount + routerLinkStub

## Key Findings for Test Design

1. BDD-2 red: card-body is div (not <a>), has role="button" + tabindex="0"
2. BDD-3 red: .meta-sep has no font-family override (inherits mono from parent)
3. BDD-4 red: placeholder is Chinese "搜索标题、标签和文件内容..."
4. BDD-5 red: LandingView buttons say "Explore"
5. BDD-6 red: loading shows "Loading..." text, no skeleton elements
6. BDD-7 red: after <a> change, buttons need .prevent; username needs to be span not router-link
7. BDD-1 red: loadEntry is sequential (await getEntry then selectFile)

## Test Execution Results

### vitest (16 tests, ALL RED with assertion failures)
- t031-entry-card.spec.ts: 6 failed (BDD-2 <a> tag, BDD-3 font, BDD-7 username span + toggle/delete)
- t031-entry-list-row.spec.ts: 5 failed (BDD-2 <a> tag, BDD-3 font, BDD-7 username span + toggle)
- t031-entry-list-view.spec.ts: 2 failed (BDD-4 Chinese placeholder, BDD-6 "Loading..." text)
- t031-entry-detail-view.spec.ts: 1 failed (BDD-6 "Loading..." text)
- t031-entry-store.spec.ts: 1 failed (BDD-1 sequential not parallel)
- t031-landing-view.spec.ts: 1 failed (BDD-5 "Explore" not "Browse public")

All failures are assertion errors (B-class = true red), NOT import/syntax errors (A-class).

### E2E script
- t031-e2e.ts compiles and runs (tsx)
- Fails with ERR_CONNECTION_REFUSED (debug backend not running) - expected
- When backend runs, will fail on assertions (card-body is div not <a>, etc.)

### BDD Coverage
- BDD-1: UT-13 (store parallel) + E2E-5
- BDD-2: UT-1,2,6,7 + E2E-1,2
- BDD-3: UT-3,8 + E2E-6
- BDD-4: UT-10 + E2E-7
- BDD-5: UT-12 + E2E-8
- BDD-6: UT-11,14 + E2E-3
- BDD-7: UT-4,5,9 + E2E-4
