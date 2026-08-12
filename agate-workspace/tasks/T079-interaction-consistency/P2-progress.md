# P2 Progress Log — T079

## Read: architect.md (role definition)
- Role: P2 design + P7 consistency. Produce design doc with 4 mandatory fields.
- follows_existing_pattern → 1 candidate acceptable with justification.
- Must read actual code before designing (no凭空设计).

## Read: P2-dispatch-context-architect.md
- follows_existing_pattern: BaseTag.vue (T076)
- DESIGN.md §6 rules already defined, backend no changes
- SCOPE_RESOLVED: Settings URL stays /settings?tab=apikeys, label "Settings"
- 3 design decision points: AuthButton API, UserMenu API, Detail tag props

## Read: P0-brief.md
- 4 inconsistencies: login button, user menu, explore button removal, detail tag clickable
- Env: make debug (:8888), make test-frontend (vitest), make typecheck (vue-tsc), make build-frontend
- [PROD_NOT_TOUCHED]

## Read: P1-requirements.md
- 17 BDDs covering all 4 fixes
- domains: [frontend], risk_level: medium
- Tablet归属: 641-1023px = desktop variant (secondary), consistent with isDesktop=!isMobile
- Share access mode: no behavioral difference from normal anonymous
- Zen mode: AuthButton/UserMenu hidden with header (v-show="!zenMode")

## Read: DESIGN.md §6 (lines 149-228)
- Anonymous: "Sign in" button. Primary on marketing, secondary on functional desktop, ghost on functional mobile.
- Authenticated: avatar + username → user menu (Settings, Logout). Admin badge when is_admin.
- Same menu content across all pages.
- Tags: BaseTag component. Clickable tags navigate to /explore?tags=<encoded>.

## Read: BaseTag.vue
- Props: href (optional). Emits: navigate [href].
- When href provided → <a> with @click.prevent emit navigate. Otherwise <span>.

## Read: auth.ts store
- authState: computed 'loading'|'authenticated'|'anonymous'
- isAdmin: computed boolean
- user: ref<User|null> with username, displayName, isAdmin
- logout(): calls api.logout(), sets user=null

## Read: LandingView.vue
- Auth: BaseButton variant="primary" size="small" → "Sign in" (correct for marketing)
- User menu: inline implementation — toggleUserMenu, closeUserMenu, handleLogout, userInitial, userName
- User menu dropdown only has "Logout" (missing Settings, missing admin badge)
- Redirects to /explore on auth → watch(authState)
- closeUserMenu registered on document click in onMounted, removed in onUnmounted

## Read: EntryListView.vue
- Auth: BaseButton variant="ghost" → "Login" (WRONG: should be secondary desktop / ghost mobile, text "Sign in")
- User menu: inline implementation — same pattern as Landing
- User menu dropdown has "API Keys" + "Logout" (WRONG: should be "Settings" + "Logout")
- Has admin badge (correct)
- navigateToApiKeys → router.push('/settings?tab=apikeys') (URL correct, label wrong)
- No mobile/desktop variant distinction for login button

## Read: EntryDetailHeader.vue
- Mobile: <a class="mobile-signin-link"> "Sign in" (WRONG: should be BaseButton variant="ghost" size="small")
- Desktop: BaseButton variant="primary" size="small" "Sign in" (WRONG: should be "secondary")
- NO authenticated user menu at all (missing entirely)
- Desktop has CompassIcon "Explore" button (redundant, should remove)
- Tags: <span class="meta-tag"> (WRONG: should be BaseTag with href)
- authState passed as prop (string), not from store directly
- isMobile/isDesktop from inject (IsMobileKey)
- Emits: open-login (parent handles showLogin)

## Read: BaseButton.vue
- Props: variant (primary|secondary|ghost|danger), size (default|small), href, target, rel, disabled, type
- Default variant: secondary

## Read: EntryCard.vue navigateToTag pattern
- BaseTag :href="'/explore?tags=' + encodeURIComponent(tag)" @navigate="navigateToTag"
- navigateToTag(href) { router.push(href) }
- This is the pattern to replicate in EntryDetailHeader

## Design Decisions
1. AuthButton: variant prop explicit (caller decides marketing vs functional). Mobile detection via inject(IsMobileKey) OR passed as prop. Decision: use a `pageType` prop ('marketing'|'functional') + inject IsMobileKey for variant auto-selection. This encapsulates the DESIGN.md rule.
2. UserMenu: self-contained — reads authStore directly, manages toggle/close/logout internally. Emits nothing (or optional @logout for parent cleanup like EntryListView's archived status reset).
3. Detail tag: use BaseTag with href + @navigate handler. EntryDetailHeader already has router via parent, but header is a child component — can import useRouter directly.

