# P2 Design Review Round 2 — Progress Log

## Review Start
- Date: 2026-07-30
- Agent: plan-design-review
- Task: T082-arch-refactor
- Input: P2-design.md (revised after round 1 needs-revision)

## Round 1 Issues to Verify

### BLOCKER-2 (§1.1): Cross-store coordination mechanism
- Round 1: entryList store → entryDetail store `syncVisibility`/`clearIfSlug` call path unclear
- **CHECK**: R5 now has explicit code block (P2-design.md:375-454) showing Pinia action-internal reference pattern
  - `entryList.ts` imports `useEntryDetailStore`, calls it inside `toggleVisibility`/`deleteEntry` actions
  - `entryDetail.ts` defines `syncVisibility(slug, isPublic)` and `clearIfSlug(slug)`
  - slug matching check inside syncVisibility/clearIfSlug for safety
  - view layer calls unchanged (`entryListStore.toggleVisibility(entry)`)
- **VERDICT**: FIXED — Pinia action-internal reference pattern explicitly written with code examples

### BLOCKER-3 (§2.1): Props/emit contract table
- Round 1: 5 sub-components had no props/emit definitions, "等" ambiguity
- **CHECK**: R6 now has complete contract table (P2-design.md:596-707)
  - EntryDetailHeader: 15 props, 5 emits ✓
  - EntryDetailBanners: 3 props, 1 emit ✓
  - EntryDetailContent: 17 props, 6 emits ✓
  - EntryDetailMobileBar: 10 props, 4 emits ✓
  - EntryDetailDialogs: 7 props, 6 emits ✓
- **VERDICT**: FIXED — all 5 sub-components have exhaustive props/emit definitions

### WARNING-1 (§1.2): storeToRefs split
- **CHECK**: P2-design.md:460-467 explicitly shows storeToRefs split pattern
- **VERDICT**: ADDRESSED

### WARNING-2 (§2.2): provide/inject keys and types
- **CHECK**: P2-design.md:565-584 defines Symbol keys with InjectionKey types
- **VERDICT**: ADDRESSED

### WARNING-3 (§2.3): composable signatures
- **CHECK**: P2-design.md:709-740 defines useZenMode and useResponsiveLayout function signatures + return types
- **VERDICT**: ADDRESSED

### WARNING-4 (§3.2): drawer state ownership
- **CHECK**: P2-design.md:586-592 explicitly defines drawer state ownership (stays in main, props+emit)
- **VERDICT**: ADDRESSED

### WARNING-5 (§4.2): aria-live region
- **CHECK**: P2-design.md:584 states aria-live span stays in main component
- **VERDICT**: ADDRESSED

### WARNING-6 (§7.1/7.2): test migration
- **CHECK**: P2-design.md:474-479 has test migration plan
- **VERDICT**: ADDRESSED

## New Issues Check
- Checking for newly introduced problems in the revised sections...

### NEW-WARNING-1: t067-detail-framework.spec.ts not mentioned in test migration plan
- `t067-detail-framework.spec.ts` (575 lines) mocks `@/stores/entry` with `useEntryStore` and mounts `EntryDetailView.vue`
- Design's test migration plan (P2-design.md:474-479) mentions `t031-entry-detail-view.spec.ts` but NOT `t067-detail-framework.spec.ts`
- Both files need mock path migration: `@/stores/entry` → `@/stores/entryList` + `@/stores/entryDetail`
- **SEVERITY**: WARNING — not blocking, but P4 implementer may miss this file and tests will break

### NEW-WARNING-2: t031-entry-list-view.spec.ts not mentioned in test migration plan
- `t031-entry-list-view.spec.ts` mocks `@/stores/entry` with `useEntryStore` and mounts `EntryListView.vue`
- Design's test migration plan mentions `t031-entry-detail-view.spec.ts` but not `t031-entry-list-view.spec.ts`
- Needs mock path migration: `@/stores/entry` → `@/stores/entryList`
- **SEVERITY**: WARNING — same as above

### NEW-WARNING-3: t067-detail-framework.spec.ts uses wrapper.setData({ zenMode: true })
- After R6 refactoring, `zenMode` moves to `useZenMode` composable and is provided via inject
- `wrapper.setData({ zenMode: true })` may not work if `zenMode` is no longer a direct component ref
- This is a testing implementation detail that P4 implementer needs to handle
- **SEVERITY**: WARNING — test migration needs to adapt this pattern

### Verification of revised R5 code correctness
- Checked: R5 toggleVisibility code (P2-design.md:382-417) correctly maps the optimistic update + rollback pattern from entry.ts:148-178
- Checked: R5 deleteEntry code (P2-design.md:419-429) correctly maps entry.ts:180-191
- Checked: R5 syncVisibility slug check (P2-design.md:438-440) safely handles detail store with no currentEntry
- Checked: R5 clearIfSlug (P2-design.md:444-448) correctly maps entry.ts:184-186
- Checked: R5 view layer call unchanged (P2-design.md:454) — correct, EntryListView/EntryDetailView still call entryListStore.toggleVisibility/deleteEntry

### Verification of revised R6 contract table completeness
- Checked against actual EntryDetailView.vue template usage:
  - EntryDetailHeader props: covers entryTitle, relativeTime, fullTime, isExpiredButActive, metaTagsHidden, isFileTreeOpen, isTocOpen, isMarkdown, tocHeadings, isMultiFile, canCopy, showShareButton, shareDialogOpen, activeShareCount, overflowItems, authState, currentEntry ✓
  - EntryDetailContent props: covers isFileTreeOpen, isTocOpen, showFileDrawer, showTocDrawer, currentEntry, activeFile, fileContent, fileLoading, fileError, shareErrorState, slug, isMarkdown, isHtml, isImage, isBinary, pathMap, tocHeadings, siblingFileIds, wrapEnabled, canWrap, isMultiFile ✓
  - EntryDetailMobileBar props: covers isMultiFile, isMarkdown, tocHeadings, isBinary, canWrap, canCopy, wrapEnabled, showFileDrawer, showTocDrawer, overflowItems, currentEntry ✓
  - EntryDetailDialogs props: covers showConfirmDelete, deleteMessage, showExpiresInDialog, showLogin, isShareAccess, slug, isArchived, sharedBy ✓
  - All emits match template @click/@update patterns ✓

### Composable lifecycle pattern verification
- useRelativeTime (existing) uses onMounted/onUnmounted internally
- useZenMode/useResponsiveLayout (proposed) delegate lifecycle to main component
- Both patterns are valid in Vue 3 — composable can use lifecycle hooks if called during setup()
- The proposed pattern (main component controls lifecycle) is more explicit, not a regression
- **No issue**

## Final Verdict
- BLOCKER-2: FIXED ✓
- BLOCKER-3: FIXED ✓
- WARNING-1 through WARNING-6: ADDRESSED ✓
- NEW-WARNING-1/2/3: Test migration plan incomplete (minor, not blocking)
- No new BLOCKER introduced
- **Status: approved**
