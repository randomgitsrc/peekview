## P2 architect progress

### Input file: P2-dispatch-context-architect.md
- Goal: Design resizable sidebar scheme for EntryDetailContent.vue
- Constraint: follows_existing_pattern (useViewMode.ts), 1 candidate OK
- Must cover: resize handle, mousedown/move/up chain, min/max clamp, localStorage, double-click reset, user-select disable, mobile hide
- gate_commands must include P3 (vitest) and P5_e2e (Playwright)

### Input file: P0-brief.md
- Width dual-source conflict: scoped 200px/240px overrides CSS vars 260px/240px
- No existing resize/drag infrastructure
- localStorage pattern: peekview- prefix, useViewMode.ts as reference
- Mobile drawer exists, resize handle only ≥1024px
- Zen mode: display:none, orthogonal to width

### Input file: P1-requirements.md
- 16 BDD conditions covering: drag, clamp, localStorage persist/restore, mobile hide, zen mode, conditional render, user-select, scroll, double-click reset, keyboard focus
- domains: [frontend], risk_level: low
- follows_existing_pattern declared → 1 candidate OK

### Input file: EntryDetailContent.vue (actual path: components/, not views/)
- Three-column flex layout: aside.file-sidebar | main.content-area | aside.toc-sidebar
- Scoped styles line 174: `.file-sidebar { width: 200px; }` — overrides CSS var
- Scoped styles line 177: `.toc-sidebar { width: 240px; }` — overrides CSS var
- file-sidebar v-if: isFileTreeOpen && isMultiFile
- toc-sidebar v-if: isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0
- Drawer overlay z-index: 200, drawer z-index: 201 (scoped)
- Global layout.css drawer overlay z-index: 100, drawer: 101

### Input file: variables.css
- --sidebar-width: 260px (line 31)
- --toc-width: 240px (line 32)
- No min/max width variables currently

### Input file: layout.css
- .file-sidebar: width: var(--sidebar-width), flex-shrink: 0 (line 99-104)
- .toc-sidebar: width: var(--toc-width), flex-shrink: 0 (line 121-128)
- @media (min-width: 1024px): sidebars display: block
- Zen mode: .zen-mode .file-sidebar, .zen-mode .toc-sidebar { display: none } (line 601-608)
- Drawer overlay z-index: 100, drawer z-index: 101 (global)

### Input file: useViewMode.ts
- Pattern: STORAGE_KEY const, load/save functions, value validation via includes()
- No composable wrapper, just standalone functions
- Simple and direct — T081 should follow this pattern

### Input file: useResponsiveLayout.ts
- isMobile = viewportWidth <= 640
- isDesktop = viewportWidth > 640
- Note: CSS uses 1024px breakpoint for sidebar display, JS uses 640 for isMobile
- Resize handle visibility should be CSS-driven (@media min-width: 1024px), not JS

### Input file: FileTree.vue
- No width logic, fills parent container (height: 100%, overflow-y: auto)
- No changes needed

### Input file: TocNav.vue
- No width logic, fills parent container
- No changes needed

### Input file: EntryDetailView.vue (parent)
- Manages isFileTreeOpen, isTocOpen, sourceViewMode state
- EntryDetailContent is child, receives all state as props
- Zen mode class applied at this level: .entry-detail.zen-mode
- onMounted: sets isFileTreeOpen/isTocOpen based on isDesktop

### Key findings from code analysis
- EntryDetailContent.vue actual path: `frontend-v3/src/components/EntryDetailContent.vue` (NOT views/)
- Scoped styles (line 174, 177) hardcode width: 200px/240px — must remove to let CSS vars take effect
- layout.css already has `width: var(--sidebar-width)` / `var(--toc-width)` but scoped styles override
- Drawer z-index in scoped styles: 200/201; in global layout.css: 100/101 — resize handle must be below both
- file-sidebar v-if: isFileTreeOpen && isMultiFile
- toc-sidebar v-if: isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0
- Test pattern: vitest with describe/it/expect, BDD naming convention (test_bdd_XX_*)
- E2E pattern: Playwright, `npx playwright test "$spec" --reporter=line`
- Composable tests in `__tests__/` subdirectory with `.spec.ts` extension

### Design decisions
- follows_existing_pattern: useViewMode.ts (localStorage load/save + validation)
- New composable: useSidebarResize.ts — load/save/clamp + drag event handlers
- CSS: remove scoped width hardcode, add resize handle styles to layout.css
- Resize handle: 6px wide div positioned at sidebar edge, cursor: col-resize
- z-index: 50 (below drawer 100/200)
- rAF throttling for mousemove (pattern from useResponsiveLayout.ts)
- Double-click reset: dblclick event → reset to CSS var default
- Keyboard: handle is a div with role="separator", tabindex="0", aria-orientation
- Mobile: handle CSS display:none in @media (max-width: 1023px)

### P2-design.md written
- File: docs/tasks/T081-resizable-sidebars/P2-design.md (232 lines)
- follows_existing_pattern declared (useViewMode.ts + useResponsiveLayout.ts)
- 1 candidate scheme (allowed by follows_existing_pattern)
- Four fields: packages, domains, ui_affected, gate_commands — all present
- gate_commands: P3 (vitest) + P5 (vitest) + P5_e2e (Playwright) — all present
- files_to_read: 6 files with why annotations
- minimal_validation: not_needed (pure code logic, no external system dependency)
- [PROD_NOT_TOUCHED]

## P2-review progress (plan-design-review)

### Read: P0-brief.md
- Task: 详情页侧边栏可拖拽调整宽度
- Risk: low, follows_existing_pattern (useViewMode.ts)
- Key risk: scoped 硬编码 200px/240px 覆盖 CSS 变量
- env: make debug-quick, vitest, Playwright CDP

### Read: P1-requirements.md
- 16 BDD conditions covering: drag resize (01-02), clamp (03-04), localStorage (05-07), mobile (08), zen mode (09), conditional render (10-11), drag constraints (12-13), double-click reset (14-15), a11y (16)
- risk_level: low, domains: frontend

### Read: P2-design.md
- Single candidate (follows_existing_pattern declared with 2 reference files)
- Composable useSidebarResize.ts + CSS variable driven
- handle inside <aside>, v-if auto-linked
- min/max/default table: file 160/260/500, toc 150/240/400
- gate_commands: P3 vitest, P5 vitest, P5_e2e playwright
- minimal_validation: not_needed (W3C standard CSS custom property + localStorage)


### Verification: EntryDetailContent.vue scoped styles
- Line 174: `.file-sidebar { width: 200px; border-right: ...; overflow-y: auto; flex-shrink: 0; }` (scoped)
- Line 177: `.toc-sidebar { width: 240px; border-left: ...; overflow-y: auto; flex-shrink: 0; }` (scoped)
- layout.css:99-104: `.file-sidebar { display: none; width: var(--sidebar-width); flex-shrink: 0; border-right: ...; }` — NO overflow-y: auto
- layout.css:121-128: `.toc-sidebar { display: none; width: var(--toc-width); flex-shrink: 0; border-left: ...; overflow-y: auto; }` — HAS overflow-y: auto
- **GAP FOUND**: Design only says "移除 scoped 硬编码 width" but scoped .file-sidebar also has `overflow-y: auto` not in layout.css. Removing scoped style entirely would lose overflow-y: auto for file-sidebar. Design needs to explicitly state overflow-y: auto must be preserved (either kept in scoped or moved to layout.css).

### Verification: position: relative for handle positioning
- Neither .file-sidebar nor .toc-sidebar has `position` set in scoped or global styles
- Design places handle with position: absolute inside aside → aside needs position: relative
- **GAP FOUND**: Design doesn't mention adding position: relative to .file-sidebar/.toc-sidebar

### Verification: drawer z-index
- layout.css:168: .drawer-overlay z-index: 100 (global)
- EntryDetailContent.vue:189: .drawer-overlay z-index: 200 (scoped, wins)
- EntryDetailContent.vue:190: .drawer z-index: 201 (scoped)
- Design: handle z-index: 50 → correct, below both

### Verification: zen mode
- layout.css:601-608: .zen-mode .file-sidebar, .zen-mode .toc-sidebar { display: none }
- Design: handle inside aside, display:none on aside → handle hidden too → correct

### Verification: conditional rendering
- EntryDetailContent.vue:4: `v-if="isFileTreeOpen && isMultiFile"` on file-sidebar aside
- EntryDetailContent.vue:55: `v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0"` on toc-sidebar aside
- Design: handle inside aside → v-if auto-linked → correct

### Verification: follows_existing_pattern
- useViewMode.ts: localStorage load/save + value validation → matches design's loadWidth/saveWidth pattern
- useResponsiveLayout.ts:14-18: rAF throttle pattern → matches design's rAF throttle for mousemove
- Pattern claim valid


### Verification: focus-visible pattern
- layout.css has :focus-visible on .icon-btn, .toggle-btn, .bottom-btn, .overflow-trigger
- Design: focus-visible: outline 2px solid var(--c-accent) → consistent with project pattern

### BDD Coverage Matrix (16 BDDs vs design)
- BDD-01 (drag file-sidebar): ✅ design covers mousedown→mousemove→setProperty
- BDD-02 (drag toc-sidebar): ✅ design covers side:'right' delta inversion
- BDD-03 (max clamp): ✅ clamp(newWidth, minPx, maxPx) + max=500 for file
- BDD-04 (min clamp): ✅ clamp + min=150 for toc
- BDD-05 (localStorage restore): ✅ loadWidth on init → setProperty
- BDD-06 (illegal value fallback): ✅ Number.isFinite check in loadWidth
- BDD-07 (out-of-range fallback): ✅ clamp in loadWidth, fallback to default
- BDD-08 (mobile no handle): ✅ @media (max-width: 1023px) { .resize-handle { display: none } }
- BDD-09 (zen mode hide): ✅ handle inside aside, zen-mode display:none on aside
- BDD-10 (file-sidebar conditional): ✅ handle inside aside v-if
- BDD-11 (toc-sidebar conditional): ✅ handle inside aside v-if
- BDD-12 (no text select during drag): ✅ body.resize-active class + user-select: none
- BDD-13 (no scroll during drag): ⚠️ design mentions pointer-events:none on content-area but doesn't detail implementation — need to verify this is sufficient
- BDD-14 (dblclick reset file): ✅ onDoubleClick → setProperty(default) + saveWidth(default)
- BDD-15 (dblclick reset toc): ✅ same mechanism
- BDD-16 (keyboard focus): ✅ role="separator" tabindex="0" + focus-visible outline

### Issues found
1. [MINOR] overflow-y: auto loss for .file-sidebar when scoped removed — not in layout.css
2. [MINOR] position: relative needed on aside elements for handle absolute positioning
3. [INFO] BDD-13 scroll prevention: design says "pointer-events: none on content-area" but this prevents clicks, not scroll. Should clarify — may need overflow: hidden on content-area during drag, or the body user-select:none + cursor:col-resize is sufficient since mousemove doesn't trigger scroll on flex containers

### Scoring (0-10)
- 交互状态覆盖率: 9/10 (all 16 BDDs covered, minor scroll prevention detail unclear)
- AI Slop 风险: 9/10 (specific px values, specific CSS classes, specific event chain — no ambiguity)
- 移动端考虑: 10/10 (clear @media breakpoint, matches existing pattern)
- 可访问性: 9/10 (role, tabindex, aria-orientation, keyboard arrows, focus-visible — excellent)

### Verdict: needs-revision
Two minor gaps (overflow-y:auto, position:relative) are easily fixable but should be in design for P4 implementer clarity. Not rejected — design is sound, just needs minor additions.

