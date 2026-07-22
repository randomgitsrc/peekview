# P1 Progress — T067 detail-page-framework

## Input File Read Log

### 1. P0-brief.md
- Task: Entry 详情页框架补全（Sign in 入口 + 品牌字标 + explore 导航 + 移动端补全）
- 6 real gaps identified (corrected from original overstated "island" framing)
- Desktop already has logo (SVG icon) and tooltip (code-level) — P1 must verify tooltip hover actually works
- Mobile is truly empty: only back arrow + title, no logo/brand text/Sign in/nav
- Depends on T065 (authState reactivity fix) — must be completed first
- Brand bar form undecided — P2 must produce multi-option comparison
- ui_affected: true → P6 needs Playwright screenshot verification

### 2. EntryDetailView.vue
- Mobile header (lines 5-10): only back arrow + sticky-title, NO logo/brand/Sign in/nav
- Desktop header (lines 13-106): has logo SVG (line 15-17), title, action buttons with tooltip spans (lines 30/40/50)
- Desktop meta-row (lines 75-105): shows reads count (line 96), public/private status, tags
- Mobile meta-tags-bar (lines 214-232): shows reads count (line 223)
- Mobile bottom bar (lines 235-269): "Files N" button (line 237), TOC/Copy/Wrap/Share buttons
- No Sign in button anywhere in detail page
- No "PeekView" wordmark anywhere in detail page (desktop has SVG icon only)
- No explore/navigation link (back arrow goes to "/" which is landing, not /explore)
- reads count: desktop shows in meta-row (line 96), mobile shows in meta-tags-bar (line 223) — both show, so "desktop doesn't show reads" may be wrong, needs P1 verification

### 3. LandingView.vue
- Sign in button (line 20): `btn btn-ghost btn-sm` — very low visual weight, ghost style small button
- Mixed in nav-cta with ThemeToggle (line 35)
- nav-links (lines 13-16): GitHub/PyPI/npm/Changelog links — Sign in competes with these for attention
- Brand has both SVG icon + "PeekView" wordmark (line 10)
- Auth state properly bound: anonymous→Sign in, authenticated→user menu (lines 19-34)
- On mobile (max-width:860px): nav-links hidden, btn-ghost hidden at ≤380px (line 446)

### 4. auth.ts (store)
- authState computed: 'loading' | 'authenticated' | 'anonymous' (lines 11-15)
- T065 fix confirmed: authState is reactive computed, properly tracks user.value
- isOwner computed works (lines 19-26)
- login/register/logout all update user.value reactively

### 5. EntryListView.vue (Explore page)
- Has logo + "PeekView" wordmark (lines 4-7)
- Has Login button for anonymous (line 10), user menu for authenticated (lines 13-25)
- Has footer with GitHub/PyPI/npm links (lines 174-218)
- Route: /explore or /users/{owner}
- This is the navigation target for "explore more" from detail page

### 6. LoginDialog.vue
- Teleported to body, modal dialog
- Supports login + register modes
- Captcha support
- Used by LandingView and EntryListView
- Can be reused in EntryDetailView

## Key Findings Summary

1. **Sign in gap confirmed**: EntryDetailView has zero auth UI — no Sign in button, no user menu
2. **Brand wordmark gap confirmed**: Desktop has SVG icon only, no "PeekView" text; mobile has nothing
3. **Explore nav gap confirmed**: Back arrow goes to "/" (landing), no direct /explore link
4. **Mobile bottom bar copy**: "Files 2" format (line 237: `Files <badge>N</badge>`) — should be "2 files"
5. **reads count**: Both desktop (meta-row line 96) and mobile (meta-tags-bar line 223) show reads — P0 claim "desktop doesn't show" may be incorrect, needs live verification
6. **Landing Sign in weight**: btn-ghost btn-sm is very low visual weight; at ≤380px it's hidden entirely
7. **Tooltip verification needed**: Desktop has tooltip spans in code, but CSS may not render them on hover — must verify live
8. **LoginDialog is reusable**: Already used in 2 views, can be added to EntryDetailView

## Additional Verification

### Tooltip CSS verification
- layout.css lines 198-217: `.icon-btn .tooltip` — opacity:0 by default, opacity:1 on hover ✅
- layout.css lines 246-265: `.toggle-btn .tooltip` — same pattern ✅
- Desktop tooltip SHOULD work on hover. Needs live verification for edge cases (positioning, z-index clipping)

### reads count analysis
- Desktop meta-row (line 96): `{{ currentEntry?.readStats.totalCount }} read{{ ... 's' : '' }}` — shows "1 read" / "2 reads"
- Mobile meta-tags-bar (line 223): `{{ currentEntry?.readStats?.totalCount ?? 0 }} reads` — shows "0 reads" / "2 reads"
- Both desktop and mobile show reads count. P0 claim #5 "reads 计数桌面/移动端统一" needs clarification:
  - Desktop: conditional plural "read"/"reads", hidden if no readStats
  - Mobile: always shows "N reads" (even 0 reads), no conditional plural
  - Inconsistency IS real: formatting differs, mobile shows 0 reads while desktop hides it

### Brand bar constraint
- P0 says ~36px (GitHub Gist reference)
- Desktop header height is set by `.detail-header` — need to check actual height
- Mobile sticky header: 52px (layout.css line 312)
- Space is the primary concern per P0

### Landing Sign in weight
- btn-ghost btn-sm at line 20 — very subtle, same style as secondary navigation
- At ≤380px mobile: `.btn-ghost { display:none }` — Sign in vanishes entirely!
- This is a real problem: mobile users on landing can't sign in at all below 380px

## Analysis Complete — Writing P1-requirements.md

## P1 Output Verification
- P1-requirements.md: 191 lines, 11 BDD conditions
- domains: [frontend] ✅
- packages: 4 files declared ✅
- risk_level: medium ✅
- phases: [P1,P2,P3,P4,P5,P6,P8] ✅
- NEED_CONFIRM: 0 ✅
- status GAP: 0 ✅
- capability_requirements: declared (browser-vision + live-hover-verification) ✅
