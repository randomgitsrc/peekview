---
phase: P3
task_id: T027-share-link
type: progress
parent: P2-design.md
status: in-progress
created: 2026-06-29
---

# P3 Progress — Frontend Test Design

## Step 1: Read inputs

- [x] P1-requirements.md: 19 frontend BDD conditions (F01-F19)
- [x] P2-design.md: Frontend design sections (5.1-5.8), component specs, store, API client, types
- [x] P0-brief.md: Environment constraints, isolation rules

## Step 2: Read existing frontend code

- [x] EntryDetailView.vue: Current structure (header/actions/content/mobile/drawers)
- [x] client.ts: PeekAPI class pattern, transform methods, getEntry/toggleEntryVisibility
- [x] types/index.ts: Entry/File/Auth types, no share types yet
- [x] api/types.ts: Response types, snake_case pattern
- [x] stores/entry.ts: Pinia composition API pattern, loadEntry/toggleVisibility/deleteEntry

## Step 3: Read existing test patterns

- [x] LoginDialog.spec.ts: Teleport stub, vi.mock stores, mount helper, event assertions
- [x] entry.spec.ts: Store test pattern with vi.mock('@/api/client')
- [x] client.spec.ts: API client test with vi.mock('axios')
- [x] debug-server.spec.ts: E2E pattern — createTestEntry, setupAuth, screenshot paths

## Step 4: Design test cases

- [x] P3-test-cases-frontend.md written — 46 test cases covering F01-F19 + API/Store extras

## Step 5: Write test code

- [x] ShareDialog.spec.ts — 14 test cases (F02-F04)
- [x] ShareManagementPanel.spec.ts — 11 test cases (F05-F07)
- [x] share.spec.ts — 6 test cases (share store)
- [x] client-share.spec.ts — 5 test cases (API client share methods)
- [x] entry-toggle-share.spec.ts — 3 test cases (toggleVisibility revocation)
- [x] share-link.spec.ts — 22 E2E test cases (F01, F05-F16)

## Summary

- Total test cases: 46 (component/unit) + 22 (E2E) = 68
- All BDD conditions F01-F16 covered
- F17/F18/F19 are gate checks (not test files)
- Tests are TDD red — they import components/stores/API methods that don't exist yet
