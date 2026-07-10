# P2 Progress — Entry Detail Header Redesign

## 2026-07-10

### [DONE] Read input files
- P0-brief.md: task brief, 5 known risks, env constraints, involved files
- P1-requirements.md: 10 explicit reqs, 16 Ds, 16 BDD, 4 NCs
- DESIGN-SPEC.md: detailed layout structure for desktop/mobile
- design-prototypes/: s1-desktop (5 states), s2-mobile (3 phone frames), s3-drawer (bottom sheet)
- AGENTS.md, CLAUDE.md, DESIGN.md: project conventions

### [DONE] Read existing source code
- EntryDetailView.vue (1079 lines): current 4-row header, scoped CSS, overflowItems computed
- ThemeToggle.vue (20 lines): emoji-based, simple structure
- OverflowMenu.vue (182 lines): dropdown only, bottom:100%, emoji icons
- layout.css (232 lines): current header layout, drawer styles, media queries
- variables.css (151 lines): design tokens, --header-height: 56px
- entry.ts (211 lines): Pinia store, computed props (isMultiFile, canWrap, canCopy, etc.)
- header-layout.test.ts (81 lines): tests for OLD layout (visibility/share/delete/wrap/copy as labeled buttons)

### Key findings:
1. **lucide-vue-next NOT installed** — DESIGN.md says to use it, but package.json has no dep. P4 will need to install it or implement inline SVGs.
2. **Existing test** (header-layout.test.ts) will need total rewrite — all test the old labeled-button layout.
3. **Current overflowItem interface** lacks `hint`, `group`, Lucide icon support — needs interface redesign.
4. **Desktop file sidebar** (line 552-554): `showFileSidebar = computed(() => entryStore.isMultiFile)` — always true. New design needs toggle ref.
5. **Mobile bottom bar** (line 234-274): current is labeled button soup with simple layout. New design needs dynamic conditional rendering.
6. **Current scroll-hide** (line 694-715): scroll event + RAF + CSS max-height on `.header-tags`. New design needs Intersection Observer on `.meta-tags-bar`.

### [DONE] Minimal validation — sidebar overlay vs push interaction
Created `/tmp/sidebar-validation.html` to test both interaction models.
Result: **PUSH** chosen for desktop sidebar — consistent with existing layout.css flex pattern, no z-index/absolute complexity, 180px shift acceptable for scrollable content area. Overlay reserved for mobile drawer pattern.

### [DONE] Write P2-design.md
