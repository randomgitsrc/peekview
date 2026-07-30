# P1 Progress Log — T079

## Input file reading progress

### P0-brief.md
- 4 inconsistencies defined: (1) login button variant/text, (2) user menu items, (3) redundant Explore button, (4) detail page tags not clickable
- Constraints: backend no change, extract shared AuthButton + UserMenu components, follow DESIGN.md §6
- Known risks: different nav structures across pages, mobile adaptation

### DESIGN.md §6
- Anonymous: "Sign in" button. Primary on marketing pages, secondary on functional pages (desktop), ghost on functional pages (mobile)
- Authenticated: avatar + username trigger → user menu (Settings, Logout). Admin badge when is_admin
- Same menu content across all pages
- Tags: Use BaseTag. Clickable tags must navigate to /explore?tags=<encoded>. Non-clickable tags only on entry detail page.

### LandingView.vue (Marketing page)
- Login button: BaseButton variant="primary" size="small", text "Sign in" — CORRECT per DESIGN.md (marketing page → primary)
- User menu: only "Logout" item, missing "Settings" — INCORRECT
- No admin badge — INCORRECT (missing)
- When authenticated, redirects to /explore (line 248, 253-255)

### EntryListView.vue (Functional page - Explore)
- Login button: BaseButton variant="ghost", text "Login" — INCORRECT (should be secondary desktop / ghost mobile, text "Sign in")
- User menu: "API Keys" + "Logout" — INCORRECT (should be "Settings" + "Logout")
- Has admin badge — CORRECT
- closeUserMenu logic duplicated with LandingView

### EntryDetailView.vue / EntryDetailHeader.vue (Functional page - Detail)
- Desktop login button: BaseButton variant="primary" size="small", text "Sign in" — INCORRECT (should be secondary on functional desktop)
- Mobile login: plain text link `<a class="mobile-signin-link">Sign in</a>` — INCORRECT (should be ghost variant BaseButton)
- No user menu for authenticated users in detail header — MISSING (only anonymous state handled)
- Explore button (CompassIcon): redundant — logo click → / → redirect to /explore when authenticated; even anonymous users on /:slug can click logo
- Tags in meta-row and meta-tags-bar: static `<span class="meta-tag">` — INCORRECT (DESIGN.md says "Non-clickable tags only on entry detail page" — WAIT, re-read: "Clickable tags must navigate to /explore?tags=<encoded>. Non-clickable tags only on entry detail page." — this means non-clickable IS allowed on detail page. Need to re-examine.)

### LoginDialog.vue
- Existing dialog, no changes needed for this task. Used by all 3 pages.

### BaseTag.vue
- T076 component: renders as `<a>` when href provided, `<span>` otherwise
- EntryCard and EntryListRow already use BaseTag with href="/explore?tags=..." + @navigate handler
- Pattern: `:href="'/explore?tags=' + encodeURIComponent(tag)"` + `@navigate="navigateToTag"`

### BaseButton.vue
- Variants: primary, secondary, ghost, danger
- Default variant: secondary
- Supports href prop for link rendering

## Key findings

### DESIGN.md §6 tag rule re-reading
"Clickable tags must navigate to /explore?tags=<encoded>. Non-clickable tags only on entry detail page."
This means: detail page CAN use non-clickable tags. But P0-brief says "详情页 tag 不可点击" is an inconsistency. Need to check P0-brief intent — P0 says rule requires clickable. Re-reading DESIGN.md more carefully: the sentence structure is "Clickable tags must navigate to X. Non-clickable tags only on entry detail page." — this means non-clickable tags are ONLY allowed on entry detail page. But it doesn't say detail page tags MUST be non-clickable. The P0-brief interprets this as tags should be clickable everywhere including detail page.

### Detail page missing user menu
EntryDetailHeader only shows login button for anonymous. For authenticated users, there's no avatar/user menu in the detail header. This is a gap not explicitly mentioned in P0-brief but implied by "same menu content across all pages."

### Landing redirect behavior
LandingView redirects authenticated users to /explore (watch authState + onMounted check). So authenticated users on Landing is a transient state. The user menu on Landing is less critical but still needed for the brief moment before redirect.

### Settings route
- /settings with tab query param (apikeys)
- /settings/apikeys redirects to /settings?tab=apikeys
- Explore currently navigates to /settings?tab=apikeys via navigateToApiKeys()

## Additional findings

### Auth store
- `isAdmin` computed property exists on authStore (stores/auth.ts:17)
- `isOwner` method exists on authStore
- `user` ref exposed for component access

### EntryDetailMobileBar
- No auth state handling (no login button, no user menu)
- Mobile detail page only has login link in sticky header (`.mobile-signin-link`), no user menu for authenticated users

### Detail page authenticated user gap
- EntryDetailHeader desktop: shows anonymous "Sign in" button but NO user menu/avatar for authenticated users
- EntryDetailHeader mobile: shows anonymous "Sign in" link but NO user menu for authenticated users
- This means authenticated users on detail page have no way to access Settings/Logout from the header
- DESIGN.md §6: "Same menu content across all pages" — this is a gap

### Tag click navigation pattern
- EntryCard: `:href="'/explore?tags=' + encodeURIComponent(tag)"` + `@navigate="navigateToTag"` where navigateToTag does `router.push(href)`
- EntryListRow: same pattern
- EntryDetailHeader tags: static `<span class="meta-tag">{{ tag }}</span>` in both desktop meta-row and mobile meta-tags-bar

### Settings route
- /settings with ?tab=apikeys for API keys tab
- DESIGN.md says "Settings" menu item (not "API Keys")
- Explore currently uses "API Keys" label → should become "Settings" per DESIGN.md

### Landing redirect timing
- LandingView watches authState, redirects to /explore on authenticated
- onMounted also checks and redirects
- The user menu on Landing is visible only briefly before redirect, but still must be consistent per DESIGN.md rule "Same menu content across all pages"


## Output verification

- P1-requirements.md written to: /home/kity/oclab/peekview/docs/tasks/T079-interaction-consistency/P1-requirements.md
- BDD count: 16 条 (BDD-01 through BDD-16)
- domains declared: [frontend]
- packages declared: 7 items
- risk_level: medium
- phases declared: [P1-P8]
- [NO_NEED_CONFIRM] declared
- 隐含需求: 5 维度全覆盖 (数据/前端/多端/边界/兼容)
- capability_requirements: browser-vision (supplementable) + unit-test-framework (available)
- [PROD_NOT_TOUCHED] declared
- File is non-empty: 11292 bytes

