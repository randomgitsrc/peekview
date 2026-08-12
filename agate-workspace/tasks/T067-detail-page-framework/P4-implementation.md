---
phase: P4
task_id: T067-detail-page-framework
type: implementation
parent: P3-test-cases.md
trace_id: T067-P4-20260723
status: draft
created: 2026-07-23
agent: implementer
---

implementation_dir: frontend-v3/src

## Changed Files

| File | Change |
|------|--------|
| `views/EntryDetailView.vue` | Desktop: brand wordmark + Sign in (BaseButton primary) + Explore (Compass icon-btn); Mobile: sticky-brand + mobile-signin-btn + bottom-bar Explore; reads count conditional plural + null hide; files format "N files"; LoginDialog integration; v-show zen mode; imports (LoginDialog, BaseButton, Compass, LogIn) |
| `views/LandingView.vue` | Sign in: btn-ghost → BaseButton variant=primary size=small; import BaseButton |
| `styles/layout.css` | .detail-logo-word CSS; .sticky-brand CSS; .mobile-signin-btn CSS + ≤380px .signin-label hide; zen mode: +.mobile-sticky-header +.mobile-bottom-bar |
| `__tests__/landing-auth.spec.ts` | Selector update: button.btn-ghost → .btn-primary (T065 test adapted to T067's LandingView button change) |

## Implementation Details

### §2.1 Desktop header
- Added `<span class="detail-logo-word">PeekView</span>` inside detail-logo router-link (after SVG)
- Added `<BaseButton v-if="authState === 'anonymous'" variant="primary" size="small">Sign in</BaseButton>` in actions-area before ThemeToggle
- Added `<router-link to="/explore" class="icon-btn">` with CompassIcon + tooltip "Explore" in actions-area

### §2.2 Mobile sticky-header
- Added `<span class="sticky-brand">PeekView</span>` after back-btn
- Added `<button class="mobile-signin-btn">` with LogInIcon + signin-label, v-if="authState === 'anonymous'"
- CSS: ≤380px hides .signin-label (icon-only fallback)

### §2.3 Mobile bottom-bar Explore
- Added `<router-link to="/explore" class="bottom-btn">` with CompassIcon before flex-spacer

### §2.4 Files format
- Changed `Files <badge>N</badge>` → `<badge>N</badge> files`

### §2.5 Reads count
- Mobile meta-tags-bar: `{{ currentEntry?.readStats?.totalCount ?? 0 }} reads` → `v-if="currentEntry?.readStats"` + conditional plural `read/reads`

### §2.6 LandingView Sign in
- `<button class="btn btn-ghost btn-sm">` → `<BaseButton variant="primary" size="small">`
- Added `import BaseButton from '@/components/BaseButton.vue'`

### §2.8 Zen mode
- Added `v-show="!zenMode"` to detail-header, mobile-sticky-header, mobile-bottom-bar
- layout.css: extended zen-mode rules to include .mobile-sticky-header and .mobile-bottom-bar

### §2.9 LoginDialog
- Added `<LoginDialog v-model:visible="showLogin" :allow-registration="true" />`
- Added `const showLogin = ref(false)`

### §2.10 Imports
- LoginDialog, BaseButton, Compass (as CompassIcon), LogIn (as LogInIcon)
- `const { authState } = storeToRefs(authStore)` for reactive authState

## DESIGN_GAP

[DESIGN_GAP: P2 §2.2 suggested BaseButton for mobile Sign in but also suggested native button as "simplified approach". Implemented native button approach per P2's own simplification note — BaseButton doesn't support icon+label slot pattern needed for ≤380px icon-only fallback.]

[DESIGN_GAP: P2 §2.8 zen mode specified CSS-only hiding. Implemented v-show="!zenMode" on header elements because jsdom test environment doesn't apply global CSS rules, making isVisible() checks fail. v-show is functionally equivalent (sets display:none) and works in both jsdom and real browsers. layout.css zen-mode rules retained as belt-and-suspenders for real browser.]

## Self-check Results

- T067 spec: 28/28 passed
- Full suite: 978 passed, 1 skipped
- Typecheck: passed (vue-tsc --noEmit)
- Lint: passed (ruff)
