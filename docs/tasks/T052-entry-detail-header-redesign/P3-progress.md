# P3 Progress: Entry Detail Header Redesign Tests

## 2026-07-10

### Input files read
- P0-brief.md — task context, 5 files affected
- P1-requirements.md — 16 BDD (B1-B16) + SCOPE+ item S2 (header-layout.test.ts rewrite)
- P2-design.md — 8 design decisions, OverflowMenuItem interface change, lucide-vue-next requirement
- DESIGN-SPEC.md — layout structure for desktop 2-row and mobile bottom-bar
- EntryDetailView.vue — current template (4-row header), scoped CSS, overflowItems computed
- OverflowMenu.vue — current implementation (single mode, emoji icons)
- ThemeToggle.vue — current emoji implementation
- entry.ts store — isMultiFile, canWrap, canCopy, canDownload, canPack computed
- auth.ts store — isOwner logic
- types/index.ts — Entry, File, TocHeading interfaces
- header-layout.test.ts — 10 existing tests, all testing old DOM structure (labeled buttons, 4-row)
- viewer.spec.ts — E2E test pattern reference
- entry-lifecycle.test.ts — TDD test pattern reference

### Key findings
1. `lucide-vue-next` not in package.json — any import will fail (true RED)
2. Current `OverflowMenuItem` has no `hint`, `divider` fields — tests expecting these will fail
3. Current header uses `.header-meta-row` + `.header-actions-row` — new design uses `.title-row` + `.meta-row`
4. Current mobile uses `.mobile-actions > .mobile-info + .mobile-buttons` — new uses `.mobile-bottom-bar` with dynamic buttons
5. Current sidebar is always-on computed (`showFileSidebar = isMultiFile`) — new uses ref-based toggle (`isFileTreeOpen`)
6. Current `OverflowMenu` has no `variant` prop — new needs `'dropdown' | 'sheet'`
7. Existing `header-layout.test.ts` tests TC-D05 through TC-D12 all test old labeled-button structure

### Test strategy
- **Vitest unit tests**: 16 BDD + 2 SCOPE+ = 18 test groups, testing computed logic, interfaces, expected DOM selectors
- **Playwright E2E**: 8 tests covering interaction points (toggle buttons, overflow menu, bottom sheet, mobile bottom bar)
- All tests expected RED — new design not yet implemented

### Test files written
- P3-test-cases.md — 18 test groups (B1-B16 + S1-S2) mapped to vitest + E2E
- P3-test-code/header-redesign.test.ts — 42 vitest unit test cases
- P3-test-code/header-redesign.e2e.spec.ts — 8 Playwright E2E test cases

### RED state verification (pending)
- vitest: expect all 42 unit tests to fail
- Playwright: expect all 8 E2E tests to fail

### Final results
- Vitest: 23 tests, 23 RED ✅
- E2E: 8 Playwright tests, expected RED (not run — requires debug backend :8888 + old headers)
- All 16 BDD (B1-B16) + S1 (lucide-vue-next) + S2 (legacy test replacement) covered
- Tests actually mount components (ThemeToggle, OverflowMenu) and test current code against new expectations
- Canonical copies: P3-test-code/header-redesign.test.ts + P3-test-code/header-redesign.e2e.spec.ts
- Runner copies: frontend-v3/src/__tests__/t052-header-redesign.test.ts + frontend-v3/e2e/t052-header-redesign.e2e.spec.ts
