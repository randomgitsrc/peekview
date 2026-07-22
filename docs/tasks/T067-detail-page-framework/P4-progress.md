
## P4 Progress - 2026-07-23

### Input files read
- EntryDetailView.vue: full file (985 lines) - main target
- LandingView.vue: lines 1-60, 195-224, 390-458 - Sign in button + imports + CSS
- layout.css: lines 1-30, 31-310, 307-348, 420-513, 514-569 - header/mobile/zen mode
- auth.ts: lines 11-15 - authState computed
- BaseButton.vue: full - variant/size props
- LoginDialog.vue: lines 118-122 - v-model:visible + allow-registration
- EntryListView.vue: lines 3-29 - reference header pattern
- variables.css: line 30 - --header-height: 56px
- t067-detail-framework.spec.ts: full (577 lines) - 28 test cases

### Implementation plan
1. EntryDetailView.vue: template changes (brand wordmark, Sign in, Explore, reads fix, files format, LoginDialog)
2. EntryDetailView.vue: script changes (imports, showLogin ref, authState from storeToRefs)
3. layout.css: brand wordmark CSS, mobile signin CSS, zen mode extensions
4. LandingView.vue: Sign in button upgrade to BaseButton primary

### Implementation completed
- EntryDetailView.vue: all template + script + style changes
- LandingView.vue: Sign in button upgrade + BaseButton import
- layout.css: brand wordmark, sticky-brand, mobile-signin-btn, zen mode extensions
- landing-auth.spec.ts: selector update btn-ghost → btn-primary (T065 test adapted)

### Self-check results
- T067 spec: 28/28 passed
- Full suite: 978 passed, 1 skipped
- Typecheck: passed
- Lint: passed

### DESIGN_GAP notes
1. Mobile Sign in: used native button (P2's own simplified approach) instead of BaseButton
2. Zen mode: used v-show="!zenMode" instead of CSS-only (jsdom compatibility)
