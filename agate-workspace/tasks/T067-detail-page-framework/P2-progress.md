
## Progress — architect P2

### Input files read
1. P2-dispatch-context-architect.md — core design decisions: brand bar form, Sign in position, Explore nav, landing Sign in weight
2. P0-brief.md — env constraints, known risks, real gaps (6 items after correction)
3. P1-requirements.md — 12 BDD conditions, domains: frontend, risk: medium
4. EntryDetailView.vue — current structure: mobile-sticky-header (line 5-10, back-btn + title only), desktop header (line 13-106, logo+title+actions+meta), mobile-bottom-bar (line 235-269), mobile meta-tags-bar (line 214-232)
5. LandingView.vue — nav with brand+links+cta, Sign in is btn-ghost btn-sm (line 20), ≤380px .btn-ghost { display:none } (line 446)
6. auth.ts — authState computed: loading→anonymous→authenticated, initializing ref
7. LoginDialog.vue — v-model:visible, allow-registration prop, Teleport to body
8. layout.css — tooltip CSS (line 198-265), mobile-sticky-header (line 307-348), mobile-bottom-bar (line 420-513), zen-mode hides header (line 564-569)

### Key observations from code
- Desktop header has logo (SVG icon) but NO "PeekView" text wordmark
- Mobile sticky-header has ONLY back-btn + title, no logo/brand/Sign in/Explore
- Mobile bottom-bar has Files/TOC/Copy/Share/Overflow — no Sign in or Explore
- LandingView Sign in: `btn btn-ghost btn-sm` — low visual weight, hidden at ≤380px
- EntryListView has logo+word+Login+ThemeToggle in header — good reference pattern
- zen-mode: `.zen-mode .detail-header { display: none }` — brand bar in header auto-hides
- authState 'loading' handled via `initializing` ref — Sign in should hide during loading
- reads count: desktop line 96 uses conditional plural, mobile line 223 uses fixed "N reads" with 0 fallback
- Mobile files-btn line 237: "Files" + badge — needs "N files" format

### Design completed
- 3 candidate proposals: A (brand wordmark embedded in header), B (independent brand bar strip), C (floating brand badge)
- Selected Proposal A: zero extra vertical space + consistent with EntryListView header pattern + zen mode auto-hide
- Key design decisions:
  1. Brand wordmark: "PeekView" text next to SVG logo in detail-logo router-link (desktop), "PeekView" in sticky-header (mobile)
  2. Sign in: BaseButton primary in actions-area (desktop), compact button in sticky-header (mobile), icon-only at ≤380px
  3. Explore: icon-btn with Compass icon in actions-area (desktop), bottom-btn in bottom-bar (mobile)
  4. Landing Sign in: btn-ghost btn-sm → BaseButton variant=primary size=small
  5. reads count: mobile meta-tags-bar changed to conditional plural + hide when null
  6. Mobile files: "Files N" → "N files"
  7. zen mode bug: mobile-sticky-header and mobile-bottom-bar not hidden — fix included
- [SCOPE+] discovered: zen mode doesn't hide mobile chrome (sticky-header + bottom-bar)
- minimal_validation: 3 assumptions confirmed (height, btn-ghost rule, zen mode gap)
- P2-design.md written
