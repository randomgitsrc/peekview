
## P1 Progress — T021 zen-mode

### Step 1: Read input files
- [x] analyst.md — role definition: question requirements completeness, identify implicit dependencies, BDD acceptance criteria, binary PASS/FAIL
- [x] P0-brief.md — task definition, known risks, pruning tendency, scope
- [x] WORKFLOW.md — agate workflow, trimming risk dimensions, P1-P6 gate requirements

### Key findings from P0-brief
1. Task: zen mode for EntryDetailView — `f` key hides page chrome, `Esc`/`f` exits, CSS-only (no v-if)
2. 6 known risks, top priority: state recoverability (CSS hide vs v-if) and keyboard focus judgment
3. Pruning: lightweight but P3/P6 must-do, P7 skippable
4. T020 coordination concern is outdated — T020 already merged (commit 223605ab)
5. Scope: detail page only, no Fullscreen API, no mobile trigger, no toast/animation

### Step 2: Read EntryDetailView.vue — key structural findings
1. Root element: `.entry-detail` div
2. Header: `<header class="detail-header">` — contains back button, title, owner actions, actions, TOC button, ThemeToggle
3. File sidebar: `<aside v-if="showFileSidebar" class="file-sidebar">` — **uses v-if** (not v-show), contains FileTree
4. Content area: `<main class="content-area">` — the main content to preserve
5. TOC sidebar: `<aside v-if="showTocSidebar" class="toc-sidebar">` — **uses v-if**, contains TocNav
6. Mobile actions: `<div class="mobile-actions" v-if="entryStore.currentEntry">`
7. Drawers (mobile): showFileDrawer / showTocDrawer — **use v-if**
8. ConfirmDialog for delete

CRITICAL FINDING: File sidebar and TOC sidebar already use `v-if` (lines 98, 170). P0-brief says "CSS 隐藏，禁止 v-if 销毁" — but these are ALREADY v-if! Zen mode needs to override this: when zen mode is active, use display:none on the aside elements rather than letting v-if destroy them. This means zen mode implementation must either:
  (a) Change v-if to v-show for sidebars (risky — changes existing behavior), or
  (b) In zen mode, force sidebars to render (add a condition) but hide with CSS class
  This is an IMPLICIT REQUIREMENT that P0-brief didn't fully anticipate — the sidebars are conditionally rendered via v-if, so "just CSS hide" isn't straightforward.

### Step 3: Read layout.css — critical layout findings
1. `.entry-detail` uses `display: flex; flex-direction: column; height: 100dvh;`
2. `.detail-header` has `height: var(--header-height); flex-shrink: 0;`
3. `.detail-content` uses `flex: 1; display: flex; overflow: hidden;`
4. `.file-sidebar` and `.toc-sidebar` are `display: none` by default, become `display: block` at `@media (min-width: 1024px)`
5. `.mobile-actions` is `display: flex` by default, becomes `display: none` at `@media (min-width: 1024px)`
6. `.content-area` is `flex: 1; overflow: hidden;`

ZEN MODE LAYOUT IMPLICATIONS:
- When zen hides .detail-header (flex-shrink:0 with fixed height), .detail-content gets more space → content-area height changes
- But content-area uses `overflow: hidden` (not scroll itself). The scroll is likely on child elements (CodeViewer/MarkdownViewer scroll within content-area)
- P0-brief risk: "content-area 滚动位置不能动" — need to verify WHERE scroll actually happens
- Sidebars already conditionally rendered (v-if + display:none/desktop:block) — zen just needs CSS class to force-hide even on desktop

### Step 3b: Need to check
- Where does scroll actually happen in content-area (on content-area itself or on child components?)
- HtmlViewer iframe behavior on parent resize
- LoginDialog structure for focus exclusion

### Step 4: Read HtmlViewer, LoginDialog, scroll analysis
1. **HtmlViewer**: iframe is `width:100%; height:100%` inside `.html-frame-container` (flex:1, overflow:hidden). Iframe uses `sandbox="allow-scripts"`. The iframe src is a render URL that loads from the server. If parent container resizes (header hidden → more height), iframe should auto-fill via CSS flex — but P0-brief warns about iframe reload on height change. CSS-only resize (no DOM rebuild) should NOT trigger iframe reload.
2. **LoginDialog**: Uses `<Teleport to="body">` — rendered OUTSIDE `.entry-detail` DOM tree. Contains `<input>` elements. The zen keyboard handler on EntryDetailView must exclude focus on these inputs even though they're teleported outside the view's DOM.
3. **Scroll location**: FileTree has `overflow-y: auto` — scroll is on `.file-tree` inside sidebar. Content-area has `overflow: hidden` — scroll is on child components (CodeViewer/MarkdownViewer internal scroll). Need to verify CodeViewer scroll behavior.

### Key implicit requirements identified so far:
1. **v-if on sidebars**: EntryDetailView.vue:98 and :170 use `v-if="showFileSidebar"` / `v-if="showTocSidebar"`. Zen mode must NOT destroy these. Options: (a) change to v-show, (b) add zen-mode override condition. This is the biggest implicit requirement.
2. **Teleported LoginDialog**: Keyboard handler must check document.activeElement globally, not just within EntryDetailView DOM.
3. **Scroll preservation**: Need to verify which elements own scroll — likely CodeViewer/MarkdownViewer internals.
4. **Page refresh in zen**: Should zen state survive page refresh? P0 doesn't say. Likely "no" (page reload resets everything).
5. **Navigation away and back**: Should zen state persist across route changes? Same — likely "no" (component unmounts).
6. **ConfirmDialog interaction**: If zen mode active and delete confirmation opens, what happens?

### Step 5: Scroll location analysis — COMPLETE
1. **CodeViewer**: `.code-body` has `overflow: auto; flex: 1` — scroll is on `.code-body` inside CodeViewer
2. **MarkdownViewer**: `overflow: auto` at line 800 — scroll is on the markdown viewer root
3. **HtmlViewer**: iframe has `overflow: auto` — scroll is inside the iframe (opaque origin)
4. **FileTree**: `overflow-y: auto` — scroll on `.file-tree`
5. **TocNav**: `.toc-sidebar` has `overflow-y: auto` — scroll on the aside

### Critical insight: content-area has `overflow: hidden`, NOT scroll
The actual scroll containers are INSIDE the viewer components. When zen mode hides the header (flex-shrink:0, fixed height), `.detail-content` gets `header-height` more vertical space. Since content-area is `flex:1`, it grows. But the scroll is on child components' `.code-body`/`.markdown-root`/iframe.

If content-area grows via CSS (no DOM rebuild), the flex children resize but scroll position should be preserved — the scroll offset is relative to the scroll container, which doesn't change. This is a key validation point for P6.

### T020 block-fullscreen status
T020's block-fullscreen feature (mermaid/SVG/plantuml fullscreen) is already implemented in MarkdownViewer.vue — it uses modal overlays triggered by buttons inside the diagram components. This is completely independent of zen mode (page-level chrome hiding). No interaction/conflict expected.

### LoginDialog focus exclusion
LoginDialog uses `<Teleport to="body">`, so its inputs are outside `.entry-detail` DOM. The zen keyboard handler must use `document.activeElement` to check if focus is in an input/textarea/contenteditable, regardless of DOM location.

### Step 6: Keyboard and routing analysis
1. **No existing global keyboard shortcuts**: No `addEventListener('keydown')` patterns in the codebase. Only component-level `@keydown.enter` and `@keydown.escape` on specific elements. Zen mode will be the FIRST global keyboard shortcut in the app.
2. **Router**: Simple 3-route setup. Detail route is `/:slug`. EntryDetailView uses `onMounted` to load entry, `watch(slug)` for slug changes. Component lifecycle: mount → load, unmount on navigate away.
3. **Navigation behavior**: If user navigates away from detail page (e.g., back button), EntryDetailView unmounts. Zen state (a `ref`) dies with it. On return, component re-mounts fresh. This is expected — zen state does NOT persist across navigation.
4. **Page refresh**: Full page reload re-mounts everything. Zen state lost. Expected behavior.

### All implicit requirements now identified (5 dimensions):
1. **Data**: zen state stored as component `ref` (not URL hash, not localStorage) — simplest, dies with component. No persistence needed.
2. **Frontend**: EntryDetailView.vue + layout.css are the primary targets. Keyboard handler is new code. CSS class toggle on root `.entry-detail`.
3. **Multi-endpoint**: MCP/CLI/API completely unaffected. Frontend-only feature.
4. **Boundary**: 
   - Page refresh → zen off (expected)
   - Navigate away → zen off (expected, component unmounts)
   - LoginDialog open while in zen → `f` key must not trigger toggle
   - ConfirmDialog open while in zen → `f` key should not interfere
   - zen + block-fullscreen simultaneously → both can be active (independent)
5. **Compatibility**: 
   - v-if on sidebars must be handled (change to v-show or conditional override)
   - block-fullscreen (T020) is independent, no interaction
   - CSP: no new inline scripts needed (CSS class + JS event listener), safe
   - Mobile: zen trigger impossible (no `f` key), mobile-actions hidden by CSS anyway

### READY TO WRITE P1-requirements.md

### Step 7: P1-requirements.md written
- 11 BDD acceptance criteria (BDD-01 through BDD-11)
- 6 implicit requirements identified (v-if sidebar strategy, Teleport focus exclusion, scroll position preservation, zen state lifecycle, block-fullscreen independence, drawer handling)
- 0 [NEED_CONFIRM] items
- 0 [CAPABILITY_GAP]
- Phases: [P1, P2, P3, P4, P5, P6], P7 skipped, P8 pending
- requires_minimal_validation: true (CSS/iframe/scroll browser behavior)

### Key additions beyond P0-brief
1. **v-if sidebar handling** (2.1): P0-brief said "CSS hide, no v-if" but didn't note that sidebars ALREADY use v-if. Identified the strategy: CSS class override on already-rendered sidebars, not changing v-if to v-show.
2. **Teleport focus exclusion** (2.2): P0-brief mentioned input/textarea/contenteditable but didn't note LoginDialog uses Teleport to body, requiring document.activeElement check.
3. **Scroll container identification** (2.3): P0-brief said "content-area scroll position" but actual scroll is on child components (.code-body, markdown root, iframe), not content-area itself.
4. **Zen + block-fullscreen coexistence** (2.5): Explicitly stated as independent and composable.
5. **ConfirmDialog interaction** (BDD-10): P0-brief didn't mention this dialog.

### Completion check
- [x] P1-requirements.md exists with valid header
- [x] ≥1 BDD acceptance criteria (11 total, all Given/When/Then)
- [x] No unresolved [NEED_CONFIRM]
- [x] No [CAPABILITY_GAP]
- [x] Implicit requirements proactively identified (6 items, not just restating P0)
- [x] Trimming has reason for each phase
