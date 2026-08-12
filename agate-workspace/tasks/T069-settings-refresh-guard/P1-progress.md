# P1 Progress Log

## 2026-07-26 — Input file reading

### P0-brief.md findings
- 3 problems: auth guard bug, brand/title confusion, mobile interaction inconsistency
- Auth guard bug: `router.beforeEach` runs before `fetchMe()` completes on full-page refresh → `authState='loading'` treated as unauthenticated → redirect to `/`
- Root cause: `app.use(router)` executes before `fetchMe()` in main.ts
- Design spec provided for desktop header, mobile header, mobile bottom bar, drawer headers, FileTree panel header
- Constraint: no backend changes, no authStore fetchMe logic changes (only guard wait strategy)

### router.ts findings
- L61-74: `beforeEach` guard checks `authState` synchronously
- L68-73: `/settings` guard: `authState !== 'authenticated'` → redirect to `/`. This is the bug: `authState='loading'` also satisfies this condition
- L62-67: `/` guard: `authState === 'authenticated''` → redirect to `/explore`. This is less problematic (loading user stays on landing, then gets redirected after init)
- No async/await in guard — purely synchronous check

### auth.ts findings
- L8: `initializing = ref(true)` — starts true
- L11-15: `authState` computed: `initializing → 'loading'`, `user → 'authenticated'`, else `'anonymous'`
- L53-61: `fetchMe()` sets `initializing = false` in finally block
- L68-72: `peekview:auth-expired` event sets `user = null` only if not initializing
- Key: `initializing` ref is the signal for "auth state not yet determined"

### EntryDetailView.vue findings
- L5-19: Mobile sticky header: ← arrow + "PeekView" text + title + Sign in button (blue solid)
- L22-126: Desktop header: logo+PeekView + title + toggle-btns + icon-btns + Sign in (BaseButton primary) + Explore link + ThemeToggle
- L255-292: Mobile bottom bar: files-btn (text style) + Explore + TOC/Wrap/Copy + Share + Overflow
- L296-306: File drawer header: just "Files" text
- L309-320: TOC drawer header: just "Table of Contents" text
- Desktop Files toggle (L33-41): toggle-btn style, no file count badge
- Mobile Files button (L256): text style "N files" with badge

### FileTree.vue findings
- L8-10: Header is just `<h3>Files</h3>` — no file count
- L155: Header style: uppercase, font-sm, font-weight 600

### main.ts — need to check

### main.ts findings — CRITICAL
- L20: `app.use(router)` — this triggers initial navigation immediately
- L23-26: `fetchMe()` is called AFTER `app.use(router)`, and `app.mount('#app')` is deferred to `.finally()`
- BUT: `app.use(router)` at L20 registers the router, which triggers `router.isReady()` and the initial navigation
- The `beforeEach` guard runs during this initial navigation, BEFORE `fetchMe()` completes
- This confirms the root cause described in P0-brief

### Key insight for auth guard fix
- The guard needs to WAIT for `initializing` to become `false` before making auth decisions
- Vue Router supports async guards (returning Promises)
- The fix: in the `/settings` guard, if `authState === 'loading'`, await a watcher on `initializing` to complete, then re-check
- Constraint: don't change fetchMe logic, only the guard's wait strategy

### layout.css findings
- L33-37: `.detail-logo-word`: 16px/700/`--c-text` — same color as title, causing brand/title confusion
- L319-332: `.mobile-sticky-header`: 52px height, glass bg, contains back-btn + sticky-brand + sticky-title + mobile-signin-btn
- L362-367: `.sticky-brand`: 13px/700/`--c-text` — brand text in mobile header
- L369-384: `.mobile-signin-btn`: blue solid button (accent bg, white text) — visual weight too heavy
- L466-475: `.mobile-bottom-bar`: 48px height, contains files-btn + bottom-btns + overflow
- L477-490: `.files-btn`: text-style button with border, different from toggle-btn
- L518-531: `.bottom-btn`: text-style button with border, different from toggle-btn
- L231-283: `.toggle-btn`: 32px square, icon-only, active state with accent highlight — desktop style
- L279-283: `.toggle-btn.active`: accent bg/border — the "desktop精致" style that mobile should match

### Implicit needs identified
1. Auth guard: `/` route guard also has the loading issue (doesn't redirect to /explore during loading) — but P0-brief says this is acceptable
2. Auth guard: other auth-protected routes? Only `/settings` is currently guarded — but future routes could be
3. Mobile bottom bar: Share button currently visible, needs to move to Overflow — but Overflow already exists, just need to add Share item
4. Mobile bottom bar: Explore button currently links to /explore — removing it means logo is the only way to navigate home
5. Desktop header: Explore link (CompassIcon) currently exists — P0-brief doesn't mention removing it from desktop, only mobile
6. FileTree.vue: needs a `fileCount` prop or computed to show "Files · N"
7. Drawer headers: need file count and TOC heading count passed in
8. Mobile header height change: 52px → 56px affects layout calculations
9. Mobile Sign in: changing from solid button to text link changes click target size (accessibility concern)

### BDD anti-pattern check plan
- All BDD Then clauses must be observable behavior, not CSS classes or implementation details
- All BDD must be binary PASS/FAIL

## Self-check results

### BDD count: 24 条 (BDD-1 through BDD-24)
- Auth guard: 6 条 (BDD-1 to BDD-6)
- Desktop header brand/title: 3 条 (BDD-7 to BDD-9)
- Desktop Files badge: 2 条 (BDD-10 to BDD-11)
- FileTree panel header: 1 条 (BDD-12)
- Mobile sticky header: 4 条 (BDD-13 to BDD-16)
- Mobile bottom bar: 6 条 (BDD-17 to BDD-22)
- Mobile drawer headers: 2 条 (BDD-23 to BDD-24)

### BDD anti-pattern self-check
- [x] No Then clauses bind CSS class names
- [x] No Then clauses bind HTML attribute names
- [x] No Then clauses contain subjective adjectives
- [x] All Then clauses are binary PASS/FAIL
- [x] No Given/When bind implementation details
- [x] Each BDD has one Given-When-Then
- [x] BDD numbering is sequential (1-24, no gaps)

### Gate checks
- [x] BDD ≥ 1 条: 24 条 ✓
- [x] domains / packages / risk_level / phases declared ✓
- [x] No [NEED_CONFIRM] markers: [NO_NEED_CONFIRM] declared ✓
- [x] No status: GAP in capability_requirements ✓

### File exists and non-empty
- Verified: P1-requirements.md written successfully
