
## P2 Architect Progress

### Input Files Read
- [x] architect.md (role definition)
- [x] P2-dispatch-context-architect.md (dispatch context)
- [x] P1-requirements.md (24 BDD conditions)
- [x] P0-brief.md (design proposal)

### Key Findings from P1
- 24 BDD conditions across 4 areas: Auth Guard (6), Desktop Header (5), Mobile Header (4), Mobile Bottom Bar (6), Mobile Drawer (2), FileTree (1)
- risk_level: medium, ui_affected: true
- domains: [frontend], packages: [router.ts, EntryDetailView.vue, FileTree.vue, layout.css]

### Key Findings from P0
- Auth guard fix: wait for authState !== 'loading' in beforeEach
- Desktop: brand text color downgrade + separator + Files badge
- Mobile: remove ← arrow + "PeekView" text, logo icon as back, Sign in as text link, bottom bar toggle-btn style
- No backend changes, no authStore fetchMe changes

### Source Code Analysis Complete

#### router.ts (L61-74)
- `beforeEach` is synchronous - no async/await
- `/settings` guard: `authState !== 'authenticated'` → redirect to `/`
- `/` guard: `authState === 'authenticated'` → redirect to `/explore`
- Both guards run immediately on initial navigation, before fetchMe completes

#### main.ts (L17-26)
- `app.use(router)` at L20 triggers initial navigation BEFORE fetchMe
- `authStore.fetchMe()` at L24 starts after router is installed
- `app.mount('#app')` at L25 is deferred until fetchMe completes
- BUT: Vue Router's initial navigation runs synchronously when `app.use(router)` is called
- This means the guard sees `authState='loading'` (initializing=true) on full page refresh

#### auth.ts (L8-15)
- `initializing = ref(true)` - starts as true
- `authState` computed: initializing → 'loading', user → 'authenticated', else → 'anonymous'
- `fetchMe()` sets `initializing.value = false` in finally block

#### Key Insight: Vue Router beforeEach CAN return a Promise
- Vue Router 4.x supports async navigation guards
- Returning a Promise from beforeEach will pause navigation until resolved
- This is the standard pattern for "wait for auth initialization"

#### EntryDetailView.vue Current State
- Mobile sticky header (L5-19): back-btn + "PeekView" text + title + signin-btn (solid)
- Desktop header (L22-126): logo+word + title + actions (toggle-btn for Files/TOC, icon-btn for Copy/Share, BaseButton for Sign in, Explore link)
- Mobile bottom bar (L255-292): files-btn (text+badge), Explore link, TOC button (text), Copy/Wrap buttons, Share button, Overflow
- File drawer (L295-306): header just "Files"
- TOC drawer (L309-320): header just "Table of Contents"

#### FileTree.vue (L8-10)
- Header: just `<h3>Files</h3>` - no file count

#### layout.css
- Mobile sticky header: 52px height, back-btn 34px, sticky-brand 13px/700
- Mobile signin-btn: solid accent button style
- Desktop detail-logo-word: 16px/700, --c-text color
- toggle-btn: 32px, active state with accent background
- share-badge: absolute positioned, accent bg, 16px height
- Mobile bottom bar: 48px, files-btn with badge, bottom-btn text style

### Minimal Validation: Vue Router async beforeEach

**Assumption**: Vue Router 4.x beforeEach supports async/await - returning a Promise pauses navigation until resolved.

**Method**: Created test script using project's vue-router dependency with createMemoryHistory. Simulated: push to protected route before auth initialized → guard awaits initPromise → resolve auth → navigation completes to protected route.

**Result**: PASS - Navigation correctly waited for the Promise to resolve before completing. The guard's async function properly paused navigation.

**Key finding**: `router.beforeEach(async (to) => { ... await ... })` works correctly in Vue Router 4.x. Navigation is deferred until the Promise resolves. This confirms the auth guard wait strategy is viable.

**Implication for BDD-6 (timeout)**: The guard needs a timeout wrapper around the wait to prevent infinite hang if fetchMe never resolves. `Promise.race([waitPromise, timeout(5000)])` pattern.

### P2-design.md Written

- 2 candidate schemes: A (async guard + Promise.race timeout) vs B (delayed router install)
- Selected Scheme A: standard Vue Router async guard pattern, minimal change scope, timeout protection
- All 24 BDD conditions covered in §3 matrix
- Four fields declared: packages, domains, ui_affected, gate_commands
- files_to_read: 10 entries with line ranges
- minimal_validation: confirmed (Vue Router async beforeEach works)
- Implementation completion criteria: 8 items

### Status: COMPLETE
