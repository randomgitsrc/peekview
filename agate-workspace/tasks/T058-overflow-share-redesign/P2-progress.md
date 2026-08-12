# T058 P2 Progress Log

## Input Reading

### P0-brief (read)
- Direction: rewrite from DESIGN.md, unified share entry, Popover/Sheet dual mode
- Env: make debug-start (:8888), vue-tsc --noEmit CI enforced, --c-* tokens only
- Risk: Popover viewport overflow, mobile space, entry point after panel removal

### P1-requirements (read)
- 26 BDD criteria covering: visual tokens (01-03), share removal from overflow (04), badge (05), loading (06), list view (07-09), create (10a-c), revoke (11), popover behavior (12-13), sheet behavior (14-15), sub-component split (16-17), themes (18-19), keyboard (20,23), empty state (21), mobile share button (22), tablet (24)
- Key implicit: ShareInfo has no shareUrl, frontend must construct full URL from slug+token+baseUrl
- ShareCreateResult.shareUrl available on creation only

### P2-dispatch-context (read)
- Confirmed: share store API unchanged, P3 restored, P7 skipped
- API client maps shareUrl from backend response

### OverflowMenu.vue (read)
- Current: single component with v-if for dropdown vs sheet, all logic in one file
- Visual issues: uses --bg-primary (not --c-surface), --border-color (not --c-border-strong), --radius-md (6px not 8px), shadow too weak, hover uses --c-border (not --c-surface-lower), danger hover uses --error-bg (not --c-error-derived)
- IconRenderer is a render function, not a proper component
- Icon map hardcoded inside component

### ShareManagementPanel.vue (read)
- Full-width panel with checkbox batch select, tokenPrefix-only display
- Uses legacy variables (--border-color, --text-primary, --bg-primary, --error-bg, --error-text, --error-border)
- No full URL display, no copy-to-clipboard, no badge

### EntryDetailView.vue (read)
- Desktop: share button in actions-area, OverflowMenu with variant="dropdown"
- Mobile: OverflowMenu with variant="sheet" in mobile-bottom-bar
- ShareManagementPanel rendered at bottom with v-if="showShareButton && currentEntry"
- showShareButton: owner + private + not archived
- overflowItems includes "Share" item when showShareButton is true
- showShareDialog ref exists but not connected to any dialog component

### share.ts store (read)
- API: fetchShares(slug), createShare(slug, expiresIn, maxViews?), revokeShares(slug, shareIds)
- shares: ref<ShareInfo[]>, loading: ref<boolean>
- revokeShares auto-refetches after revoke

### types/index.ts (read)
- ShareInfo: id, tokenPrefix, expiresAt, maxViews, viewCount, createdBy, createdAt, revokedAt
- ShareCreateResult: adds shareUrl field

### api/client.ts (read)
- createShare returns ShareCreateResult with shareUrl mapped from backend
- listShares returns ShareInfo[] (no shareUrl)
- transformShare maps snake_case to camelCase

### DESIGN.md (read)
- §6 Select/Dropdown: --c-surface bg, --c-border-strong border, 8px radius, 0 8px 24px rgba(0,0,0,.16) shadow, --c-surface-lower hover
- §9 Breakpoints: mobile <=640px, tablet 641-1024px, desktop >1024px
- Z-index: dropdowns/popovers at 100, modal backdrop 200, modal content 210
- Touch targets: minimum 44px
- Badge: rgba(77,141,255,.14) dark / rgba(9,105,218,.1) light, --c-accent-secondary text, 6px radius, 4px 10px padding, 12px mono

### variables.css (read)
- Legacy aliases exist (--bg-primary → --c-bg, --border-color → --c-border, etc.)
- --radius-md is 6px (DESIGN.md §6 says 8px for dropdowns)
- --radius-lg is 8px
- --header-height: 56px

### OverflowMenu.spec.ts (read)
- 20+ unit tests covering rendering, toggle, click-outside, escape, action handling, cleanup
- Uses OverflowMenuItem interface duplicated locally (not imported)
- Tests reference .overflow-trigger, .overflow-dropdown, .overflow-item, .item-icon, .item-danger selectors
- All tests use variant='dropdown' (default), no sheet variant tests

## Design Analysis

### Visual Token Mapping (OverflowMenu)
| Current | DESIGN.md Target | Notes |
|---------|-----------------|-------|
| --bg-primary | --c-surface | Dropdown bg |
| --border-color | --c-border-strong | Dropdown border |
| --radius-md (6px) | 8px (use --radius-lg) | Dropdown radius |
| 0 4px 12px rgba(0,0,0,.15) | 0 8px 24px rgba(0,0,0,.16) | Shadow |
| --c-border (hover) | --c-surface-lower | Item hover bg |
| --error-bg (danger hover) | --c-error-surface or rgba(--c-error,.1) | Danger hover |
| --text-primary | --c-text | Item text |
| --text-tertiary | --c-text-tertiary | Hint text (already correct) |

### Share URL Construction
- ShareCreateResult.shareUrl: full URL from backend on creation
- ShareInfo: only tokenPrefix, no full token or shareUrl
- Frontend must construct: need full share token, but ShareInfo only has tokenPrefix (first 8 chars)
- CRITICAL FINDING: ShareInfo does NOT contain the full share token, only tokenPrefix
- This means: for existing shares in the list, we CANNOT construct the full URL
- Only newly created shares (ShareCreateResult) have the full URL
- This is a design constraint that must be addressed

### Component Architecture Decision
- OverflowMenu: split into OverflowMenuDropdown + OverflowMenuSheet sub-components
- ShareDialog: container component with variant prop (popover/sheet)
- ShareDialogContent: shared content logic (list view + create view)

### CRITICAL FINDING: Share URL for Existing Shares
- Backend stores only token_hash + token_prefix (first 8 chars of token)
- Full token is generated at creation time only, never stored
- ShareCreateResponse includes share_url; ShareResponse (list) does NOT
- P0-brief assumed frontend can construct full URL from slug+token+baseUrl
- REALITY: For existing shares in the list, the full token is NOT available
- This means: we can only display full URL for newly created shares
- For existing shares, we can only show tokenPrefix (e.g., "xA4b...")

### Resolution Options
1. Backend change: Add share_url to ShareResponse (requires storing or reconstructing URL)
   - Pro: Clean solution, frontend just displays what backend provides
   - Con: Backend change outside declared scope (P0 says "no backend change required")
2. Frontend-only: Store shareUrl from creation in local state, show tokenPrefix for others
   - Pro: No backend change
   - Con: Inconsistent UX (some links show full URL, others show prefix)
3. Frontend-only: Always show tokenPrefix in list, full URL only on creation success
   - Pro: Consistent, no backend change
   - Con: Less useful than showing full URL for all links
4. Backend change: Add share_url to list response (reconstruct from base_url + slug + token_prefix is NOT possible since token_prefix != full token)
   - Actually impossible without storing the full token

### Decision: Option 3 is the pragmatic choice
- Show tokenPrefix in the list view (consistent with current behavior, just styled better)
- On creation, show the full shareUrl prominently (this is when users actually need to copy)
- After creation, the new link appears in the list with tokenPrefix (same as others)
- The "copy" action in the list copies a URL constructed from tokenPrefix... but that won't work
- ACTUALLY: We need to think about this differently

### Revised approach
- The list view shows tokenPrefix as a display label (like "xA4b...")
- The copy button for list items should... what? We can't copy a full URL we don't have
- Option A: Copy button only appears for newly created shares (while shareUrl is in memory)
- Option B: Backend adds share_url to list response (scope change)
- Option C: Show tokenPrefix, no copy button for existing shares, only for newly created ones

### Best pragmatic solution
- Store shareUrl from ShareCreateResult in a local Map<shareId, shareUrl>
- On page load, existing shares show tokenPrefix only (no copy button, or copy button copies a "partial" indicator)
- On creation, store the shareUrl, show it with copy button
- The shareUrl persists in the local Map as long as the component is mounted
- If the user navigates away and back, existing shares lose their shareUrl
- This is acceptable because: the primary use case is creating a link and immediately copying it

### Even better: store shareUrl in the share store
- After createShare, store the shareUrl in a Map within the share store
- This persists across Popover open/close (same page session)
- Still lost on page navigation, but that's acceptable

## Design Document Written
- P2-design.md created (631 lines)
- 2 candidate designs: Thin Wrapper Split (recommended) + Slot-Based Composition (rejected)
- All 4 required fields present: packages, domains, ui_affected, gate_commands
- minimal_validation: confirmed (CSS positioning is foundational, no browser risk)
- files_to_read: 12 entries with line ranges and why annotations
- [SCOPE+] identified: Share URL unavailable for existing shares (tokenPrefix only)
- Resolution: shareUrlCache in store + tokenPrefix fallback display
- P3 testable behavior contracts: 40+ test cases across 6 components
- Visual token mapping: complete tables for OverflowMenu (dropdown + sheet) + ShareDialog (popover + sheet) + badge + link row
