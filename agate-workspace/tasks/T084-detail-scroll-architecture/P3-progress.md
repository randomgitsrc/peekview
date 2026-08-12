## P3 test-designer progress

### Input file: P1-requirements.md
- 14 BDD items: BDD-01 to BDD-14
- BDD-01/02/03: scroll container unification (content-area scrollTop increases, viewer scrollTop stays 0)
- BDD-04/05/06: scroll-hide behavior (mobile hide/show, desktop no render)
- BDD-07: TOC anchor jump (offset 75px-85px)
- BDD-08: padding unification ([SCOPE+] revised: markdown-body paddingTop=0px)
- BDD-09/10: HtmlViewer/ImageViewer unaffected
- BDD-11/12/13: regression (vitest/typecheck/build) — P6 manual
- BDD-14: DESIGN.md doc — P6 manual

### Input file: P2-design.md
- Plan A: content-area keeps padding, viewers remove overflow/height
- setupScrollHide simplified: remove findScrollable, direct container scroll listener
- code-body: overflow:auto → overflow-x:auto (remove flex:1, min-height:0)
- code-viewer: remove min-height:300px, flex:1 (keep display:flex, overflow:hidden)
- markdown.css L2-3: remove global padding + mobile media query
- MarkdownViewer scoped: remove height:100%, overflow:auto, padding:2rem
- ui_affected: true → must have Playwright/E2E
- gate_commands.P3: cd frontend-v3 && npx vitest run --reporter=dot
- gate_commands.P3_formatter: vitest

### Input file: useResponsiveLayout.ts
- setupScrollHide currently has findScrollable logic (L27-37)
- Falls back to container itself if no scrollable child found (L39-42)
- metaTagsHidden ref controls hide/show
- Testable: composable can be unit tested with jsdom

### Input file: EntryDetailContent.vue
- .content-area: flex:1; overflow-y:auto; outline:none; padding:var(--space-4)
- Mobile: padding: var(--space-3) var(--space-2)
- Contains HtmlViewer/MarkdownViewer/ImageViewer/CodeViewer conditionally

### Input file: MarkdownViewer.vue
- scoped .markdown-viewer: height:100%; overflow:auto (to be removed)
- scoped .markdown-body: padding:2rem; max-width:900px; margin:0 auto (padding to be removed)
- global .markdown-body :is(h1..h6): scroll-margin-top:80px

### Input file: code.css
- .code-viewer: min-height:300px; flex:1 (to be removed)
- .code-body: overflow:auto; flex:1; min-height:0 (→ overflow-x:auto)
- mobile media query: min-height:0 (to be removed)
- .code-body :deep(pre): overflow-x:auto (keep)

### Input file: markdown.css
- L2: .markdown-body padding:var(--space-5) (to be removed)
- L3: @media mobile padding:1.25rem (to be removed)
- L4: h1/h2/h3 scroll-margin-top:80px (keep)

### Input file: EntryDetailHeader.vue
- meta-tags-bar: v-if="isMobile" (only renders on mobile)
- .meta-tags-bar.hidden: max-height:0; padding:0; overflow:hidden; opacity:0
- metaTagsHidden prop controls .hidden class


### Test design complete

#### vitest tests (useResponsiveLayout.spec.ts) — 4 tests, all RED
- BDD-04: test_bdd_04_scroll_down_hides_meta_tags — RED (findScrollable finds child, container scroll not listened)
- BDD-05: test_bdd_05_scroll_up_restores_meta_tags — RED (same root cause)
- BDD-06: test_bdd_06_scroll_hide_listens_to_container_not_child — RED (child scroll triggers metaTagsHidden, should not)
- BDD-06: cleanup removes the scroll listener from container — RED (removeEventListener not called on container, called on child)
- All 4 failures are assertion failures (B-class red), not syntax/import errors (A-class)
- Existing 1125 tests still pass, 1 skipped — no regressions

#### Playwright E2E tests (t084-scroll-architecture.spec.ts) — 7 tests
- BDD-01: test_bdd_01_markdown_content_area_scrolls (desktop)
- BDD-02: test_bdd_02_code_content_area_scrolls (desktop)
- BDD-03: test_bdd_03_code_horizontal_scroll_retained (desktop)
- BDD-07: test_bdd_07_toc_anchor_jump_correct_offset (desktop)
- BDD-08: test_bdd_08_mobile_markdown_single_padding (mobile)
- BDD-09: test_bdd_09_htmlviewer_iframe_fills_content_area (desktop)
- BDD-10: test_bdd_10_imageviewer_image_displays_correctly (desktop)
- TypeScript compilation passes (npx tsc --noEmit --skipLibCheck)
- Cannot run without debug backend — will be RED when run (BDD-01/02/07/08 fail due to current scroll architecture)

#### BDD-11/12/13/14 — P6 manual verification
- BDD-11: make test-frontend (regression)
- BDD-12: make typecheck (regression)
- BDD-13: make build-frontend (regression)
- BDD-14: DESIGN.md documentation check

#### Verification
- vue-tsc --noEmit: zero errors
- vitest: 4 failed (new T084 tests) | 1125 passed | 1 skipped — only T084 tests are red
- E2E TypeScript: compiles cleanly
