# P3 Progress Log — T079

[PROD_NOT_TOUCHED]

## Input File Findings

### P1-requirements.md
- 17 BDD conditions (BDD-01 through BDD-17)
- 4 categories: login button consistency (BDD-01~06), user menu consistency (BDD-07~12), Explore button removal (BDD-13), Detail tag clickable (BDD-14~16), Settings navigation (BDD-17)
- BDD-07 explicitly says: Playwright not reliable for redirect window, use code-level + vitest
- BDD-11/12: admin badge + menu consistency across all pages

### P2-design.md
- AuthButton.vue: props pageType='marketing'|'functional', matchMedia for mobile detection, emits 'sign-in'
- UserMenu.vue: consumes authStore directly, emits 'logout', internal showUserMenu/toggleUserMenu/closeUserMenu
- ui_affected: true — need Playwright E2E tests too
- gate_commands.P3: cd frontend-v3 && npx vitest run --reporter=verbose

### BaseTag.vue
- Props: href?, Emits: navigate [href: string]
- When href present → renders <a>, else <span>
- Pattern: @click.prevent="$emit('navigate', href)"

### auth.ts
- useAuthStore: user, authState (computed), isAdmin (computed), logout()
- storeToRefs available for reactivity

### EntryDetailHeader.vue (current)
- Uses inject IsMobileKey for mobile detection
- Desktop anonymous: BaseButton variant="primary" (WRONG per BDD-05, should be secondary)
- Mobile anonymous: plain <a> link (WRONG per BDD-06, should be BaseButton ghost)
- Has CompassIcon "Explore" router-link (to be removed per BDD-13)
- Tags: <span class="meta-tag">{{ tag }}</span> (to be replaced with BaseTag per BDD-14~16)
- No authenticated user menu (to be added per BDD-09~10)

### Existing test patterns
- vitest + @vue/test-utils mount
- Mock @/stores/auth with vi.mock + vi.hoisted
- Mock router-link with stub
- Stubs for child components (LoginDialog, ThemeToggle)
- createPinia + setActivePinia for store tests

## Test Code Written

### AuthButton.spec.ts (9 tests)
- BDD-01: marketing pageType → primary variant (desktop + mobile)
- BDD-02: functional pageType desktop → secondary variant
- BDD-03: functional pageType tablet → secondary variant (same as desktop via matchMedia)
- BDD-04: functional pageType mobile → ghost variant
- BDD-05: functional pageType desktop → secondary (for Detail)
- BDD-06: functional pageType mobile → ghost (for Detail)
- emit sign-in on click
- size="small" verification
- RED: import @/components/AuthButton.vue fails (B-class red — component not yet created)

### UserMenu.spec.ts (15 tests)
- BDD-07: authenticated user renders trigger + dropdown has Settings + Logout
- BDD-08: same menu items (Settings + Logout)
- BDD-09: Detail desktop same menu items
- BDD-10: Detail mobile same menu items
- BDD-11: admin badge visible for admin user, not for non-admin
- BDD-12: menu items consistent across contexts
- BDD-17: clicking Settings → router.push('/settings?tab=apikeys')
- Logout calls authStore.logout + emits logout
- Dropdown closes on outside click
- User initial display
- Username fallback when displayName null
- Toggle dropdown open/close
- Dropdown closes after Settings click
- RED: import @/components/UserMenu.vue fails (B-class red)

### T079-entry-detail-header.spec.ts (22 tests, 19 red, 3 incidental pass)
- BDD-05: desktop anonymous → secondary "Sign in" (current uses primary → RED)
- BDD-06: mobile anonymous → ghost "Sign in" (current uses plain <a> link → RED)
- BDD-09: desktop authenticated → UserMenu trigger + dropdown (no user menu exists → RED)
- BDD-10: mobile authenticated → UserMenu trigger + dropdown (no user menu exists → RED)
- BDD-13: no Explore button (current has CompassIcon Explore → RED)
- BDD-14: desktop tags use BaseTag with href (current uses span.meta-tag → RED)
- BDD-15: mobile tags use BaseTag with href (current uses span.meta-tag → RED)
- BDD-16: Chinese tag URL-encoded href (current has no BaseTag → RED)
- Admin badge in Detail page user menu (no user menu → RED)
- Empty tags edge cases (3 pass — incidental, current handles empty arrays fine)

### E2E: t079-auth-consistency.spec.ts
- BDD-01~06: anonymous login button variant checks across Landing/Explore/Detail × desktop/mobile
- BDD-08~10: authenticated user menu on Explore/Detail × desktop/mobile
- BDD-11: admin badge visible
- BDD-12: menu items consistent across pages
- BDD-13: no Explore button on Detail desktop
- BDD-14~15: tag clicks navigate to /explore?tags=<encoded>
- BDD-17: Settings click navigates to /settings

## Verification Run

- Full suite: 1081 passed + 1 skipped + 19 failed (1101 total)
- Baseline: 1078 passed + 1 skipped (1079 total)
- Delta: +3 incidental pass + 19 red (all from new test files)
- Zero regression on existing tests
- All 19 reds are assertion failures or import failures (B-class red: implementation not yet written)
