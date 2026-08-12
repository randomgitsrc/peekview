---
phase: P3
task_id: T058
type: test-cases
parent: P2-design.md
trace_id: T058-P3-20260717
status: complete
created: 2026-07-17
agent: test-designer
test_code_dir: frontend-v3/src/components/__tests__
---

# T058 P3 — Test Cases

## Test Run Results (2026-07-17)

| File | Total | Pass | Fail | Status |
|------|-------|------|------|--------|
| OverflowMenu.spec.ts | 33 | 21 | 12 | Red (new BDD contracts failing) |
| ShareDialog.spec.ts | 55 | 35 | 20 | Red (container/theme/viewport failing) |
| share.spec.ts | 4 | 4 | 0 | Green (store already implemented) |
| **Total** | **92** | **60** | **32** | Mixed — 32 red tests guard new behavior |

**Note**: ShareDialog.vue and ShareDialogContent.vue already exist with partial P4 implementation. Store (shareUrlCache/getShareUrl) is already implemented. 32 failing tests guard new BDD contracts not yet fulfilled (CSS tokens, theme consistency, Popover/Sheet container behavior, viewport overflow, keyboard navigation edge cases).

## Test File Plan

| File | Scope | BDD Coverage |
|------|-------|-------------|
| `OverflowMenu.spec.ts` | OverflowMenu orchestrator + sub-component contracts | BDD-01~04, 16~20 |
| `ShareDialog.spec.ts` | ShareDialog orchestrator + ShareDialogContent behavior | BDD-05~15, 21~24 |
| `share.spec.ts` | shareUrlCache + getShareUrl store additions | Implicit #1 (BDD-07/08) |

## Test Cases

### OverflowMenu.spec.ts — OverflowMenu Orchestrator

| TC# | BDD | Description | Assertion |
|-----|-----|-------------|-----------|
| OM-01 | BDD-16 | variant="dropdown" renders OverflowMenuDropdown sub-component | After opening, `.overflow-dropdown` exists |
| OM-02 | BDD-17 | variant="sheet" renders OverflowMenuSheet sub-component | After opening, `.bottom-sheet` exists |
| OM-03 | BDD-16 | Dropdown items have 18px icons | `.item-icon` computed width/height is 18px |
| OM-04 | BDD-17 | Sheet items have 20px icons | `.sheet-item-icon` computed width/height is 20px |
| OM-05 | BDD-16 | Dropdown item min-height is 36px | `.overflow-item` computed minHeight is 36px |
| OM-06 | BDD-17 | Sheet item min-height is 48px | `.sheet-item` computed minHeight is 48px |
| OM-07 | BDD-01 | Dropdown background uses --c-surface token | `getComputedStyle` background includes `var(--c-surface)` or resolved value |
| OM-08 | BDD-02 | Dropdown border uses --c-border-strong token | `getComputedStyle` border-color matches token |
| OM-09 | BDD-02 | Dropdown border-radius is 8px | `getComputedStyle` borderRadius is 8px |
| OM-10 | BDD-02 | Dropdown box-shadow matches spec | `getComputedStyle` boxShadow contains `rgba(0,0,0,.16)` |
| OM-11 | BDD-03 | Normal item hover background uses --c-surface-lower | Hover state computed background matches token |
| OM-12 | BDD-03 | Danger item hover background uses --c-error-surface token | Hover state computed background matches token |
| OM-13 | BDD-04 | "Share" item not in OverflowMenu items | Items array without share item renders no "Share" label |
| OM-14 | BDD-20 | Enter key opens dropdown | Trigger keydown Enter → dropdown visible |
| OM-15 | BDD-20 | Space key opens dropdown | Trigger keydown Space → dropdown visible |
| OM-16 | BDD-20 | Escape closes dropdown, focus returns to trigger | Escape → dropdown hidden, activeElement is trigger |
| OM-17 | BDD-20 | Tab with open dropdown closes and moves focus | Tab → dropdown hidden |
| OM-18 | BDD-20 | aria-expanded toggles correctly | Open → true, close → false |
| OM-19 | — | Click outside closes dropdown | Outside click → dropdown hidden |
| OM-20 | — | Item click emits action and closes | Click item → action called, dropdown hidden |
| OM-21 | — | close() exposed method works | Call vm.close() → dropdown hidden |
| OM-22 | BDD-17 | Sheet has drag handle | `.sheet-drag-handle` exists |
| OM-23 | BDD-17 | Sheet backdrop click emits close | Click `.sheet-backdrop` → sheet hidden |
| OM-24 | BDD-17 | Sheet close button emits close | Click `.sheet-close-btn` → sheet hidden |
| OM-25 | — | Divider renders correctly | Item with divider:true renders divider element |
| OM-26 | — | href item renders <a> tag | Item with href renders <a> with correct attributes |
| OM-27 | — | Action item renders <button> tag | Item without href renders <button> |
| OM-28 | — | Danger variant applies item-danger class | variant="danger" item has item-danger class |
| OM-29 | — | Icon rendered when item has icon | Item with icon has SVG child |
| OM-30 | — | Hint text rendered | Item with hint shows hint text |
| OM-31 | BDD-01 | Light theme dropdown background is opaque white | Set data-theme="light", verify background is #ffffff (not transparent) |
| OM-32 | BDD-19 | Dark theme dropdown background is #121822 | Set data-theme="dark", verify background is #121822 |
| OM-33 | BDD-02 | Dropdown min-width is 220px | `getComputedStyle` minWidth is 220px |

### ShareDialog.spec.ts — ShareDialog + ShareDialogContent

| TC# | BDD | Description | Assertion |
|-----|-----|-------------|-----------|
| SD-01 | BDD-12 | variant="popover" renders Popover container | Open → `.share-popover` exists |
| SD-02 | BDD-14 | variant="sheet" renders Bottom Sheet container | Open → `.share-bottom-sheet` exists |
| SD-03 | BDD-12 | Popover is 280px wide | `.share-popover` computed width is 280px |
| SD-04 | BDD-12 | Popover closes on outside click | Click outside → open becomes false |
| SD-05 | BDD-12 | Popover closes on Escape | Escape → open becomes false |
| SD-06 | BDD-15 | Sheet closes on backdrop click | Click backdrop → open becomes false |
| SD-07 | BDD-15 | Sheet closes on close button | Click close button → open becomes false |
| SD-08 | BDD-15 | Sheet closes on Escape | Escape → open becomes false |
| SD-09 | BDD-14 | Sheet has drag handle | `.sheet-drag-handle` exists |
| SD-10 | BDD-14 | Sheet occupies 60-70% screen height | Sheet computed maxHeight is within 60-70vh range |
| SD-11 | BDD-05 | Badge shows active share count | 2 active shares → badge text "2" |
| SD-12 | BDD-05 | Badge hidden when 0 active shares | 0 active shares → badge not rendered |
| SD-13 | BDD-05 | Badge updates on revoke | Revoke 1 → badge text "1" |
| SD-14 | BDD-05 | Badge disappears when last share revoked | Revoke last → badge not rendered |
| SD-15 | BDD-06 | Loading state visible while fetching | loading=true → loading indicator visible |
| SD-16 | BDD-21 | Empty state with 0 shares | 0 shares → "No active share links" + create button visible |
| SD-17 | BDD-07 | Active share link displays URL in monospace | Active share → URL in monospace font |
| SD-18 | BDD-07 | Copy button visible on URL row | Active share → copy button exists |
| SD-19 | BDD-07 | Status line shows view count and expiry | Active share → status line with "N views" and expiry text |
| SD-20 | BDD-07 | Revoke button visible with --c-error color | Active share → revoke button with error color |
| SD-21 | BDD-08 | Copy button writes URL to clipboard | Click copy → navigator.clipboard.writeText called with URL |
| SD-22 | BDD-08 | Copy icon changes to check with --c-success color | After copy → check icon visible with success color |
| SD-23 | BDD-08 | Copy icon reverts after 1.5 seconds | After 1.5s → copy icon restored (vi.useFakeTimers) |
| SD-24 | BDD-09 | Expired links collapsible section visible | Expired shares → "Expired links (N)" section visible |
| SD-25 | BDD-09 | Expired links shown with reduced opacity when expanded | Expand section → expired items with opacity < 1 |
| SD-26 | BDD-09 | No revoke button for expired/revoked links | Expired items → no revoke button |
| SD-27 | BDD-10a | Create view switch on "Create share link" click | Click create → create form visible |
| SD-28 | BDD-10a | Create view has expiry dropdown with options | Create view → expiry select with 1h/1d/7d/30d/Never |
| SD-29 | BDD-10a | Create view has max views dropdown with options | Create view → maxViews select with Unlimited/10/50/100 |
| SD-30 | BDD-10a | Create view has "Create link" primary button | Create view → primary button exists |
| SD-31 | BDD-10b | Create with default values calls createShare('7d', null) | Click "Create link" → createShare called with '7d', null |
| SD-32 | BDD-10b | Create success switches to list view | After create success → list view visible |
| SD-33 | BDD-10b | New link appears at top of active list | After create → first link row is the new one |
| SD-34 | BDD-10b | New link has --c-success border flash | After create → new link row has success border class |
| SD-35 | BDD-10b | Badge count increments on create | After create → badge count +1 |
| SD-36 | BDD-10c | Create failure shows error toast | createShare rejects → error toast shown |
| SD-37 | BDD-11 | Revoke calls store.revokeShares immediately | Click revoke → revokeShares called with correct IDs |
| SD-38 | BDD-11 | Revoke shows success toast | After revoke → toast "Link revoked" shown |
| SD-39 | BDD-11 | Badge decrements on revoke | After revoke → badge count -1 |
| SD-40 | BDD-11 | Link moves to expired section after revoke | After revoke → link in expired section |
| SD-41 | BDD-10a | Back button returns to list view | Click "Back" → list view visible |
| SD-42 | BDD-23 | Tab cycles through interactive elements in Popover | Tab → focus moves to next interactive element |
| SD-43 | BDD-23 | Enter on copy button copies URL | Enter on copy → clipboard writeText called |
| SD-44 | BDD-23 | Escape closes Popover, focus returns to share button | Escape → open=false, focus on trigger |
| SD-45 | BDD-13 | Popover max-height is calc(100vh - header - 20px) | Computed maxHeight matches formula |
| SD-46 | BDD-13 | Popover body scrolls when content exceeds max-height | Content overflow → scrollable container |
| SD-47 | BDD-18 | Light theme Popover background is opaque white | data-theme="light" → background #ffffff |
| SD-48 | BDD-19 | Dark theme Popover background is #121822 | data-theme="dark" → background #121822 |
| SD-49 | BDD-22 | Mobile share button in bottom bar has badge | Mobile variant → share button with badge |
| SD-50 | BDD-24 | Tablet viewport uses Popover mode | variant="popover" on tablet → Popover rendered |
| SD-51 | — | ShareDialogContent emits "created" on success | After create → "created" emitted |
| SD-52 | — | ShareDialogContent emits "revoked" on success | After revoke → "revoked" emitted |
| SD-53 | BDD-07 | URL middle-truncated when longer than container | Long URL → contains "..." in middle |
| SD-54 | BDD-07 | Uncached share shows tokenPrefix with "..." | No shareUrl in cache → shows prefix + "..." |
| SD-55 | BDD-12 | v-model:open toggles visibility | Set open=true → visible; open=false → hidden |

### share.spec.ts — Share Store Extensions

| TC# | BDD | Description | Assertion |
|-----|-----|-------------|-----------|
| ST-01 | BDD-07 | createShare caches shareUrl in shareUrlCache | After create → getShareUrl(id) returns shareUrl |
| ST-02 | BDD-07 | getShareUrl returns null for uncached share | getShareUrl(unknownId) → null |
| ST-03 | BDD-07 | createShare calls fetchShares after creation | After create → fetchShares called with slug |
| ST-04 | — | shareUrlCache is reactive Map | Modifying cache triggers reactivity |

## BDD Coverage Matrix

| BDD | Test Cases | Notes |
|-----|-----------|-------|
| BDD-01 | OM-07, OM-31, OM-32 | CSS token assertions for background |
| BDD-02 | OM-08, OM-09, OM-10, OM-33 | CSS token assertions for border/shadow/radius/width |
| BDD-03 | OM-11, OM-12 | CSS token assertions for hover states |
| BDD-04 | OM-13 | Share item removed from items |
| BDD-05 | SD-11, SD-12, SD-13, SD-14 | Badge reactivity |
| BDD-06 | SD-15 | Loading state |
| BDD-07 | SD-17, SD-18, SD-19, SD-20, SD-53, SD-54, ST-01, ST-02 | Link display + URL construction |
| BDD-08 | SD-21, SD-22, SD-23 | Copy interaction |
| BDD-09 | SD-24, SD-25, SD-26 | Expired links section |
| BDD-10a | SD-27, SD-28, SD-29, SD-30 | Create view UI |
| BDD-10b | SD-31, SD-32, SD-33, SD-34, SD-35 | Create success flow |
| BDD-10c | SD-36 | Create failure |
| BDD-11 | SD-37, SD-38, SD-39, SD-40 | Revoke flow |
| BDD-12 | SD-01, SD-03, SD-04, SD-05, SD-55 | Desktop Popover open/close |
| BDD-13 | SD-45, SD-46 | Viewport overflow handling |
| BDD-14 | SD-02, SD-09, SD-10 | Mobile Bottom Sheet |
| BDD-15 | SD-06, SD-07, SD-08 | Sheet close behaviors |
| BDD-16 | OM-01 | OM-01 | Dropdown sub-component |
| BDD-16 | OM-01, OM-03, OM-05 | Desktop dropdown sub-component |
| BDD-17 | OM-02, OM-04, OM-06, OM-22, OM-23, OM-24 | Mobile sheet sub-component |
| BDD-18 | OM-31, SD-47 | Light theme opaque rendering |
| BDD-19 | OM-32, SD-48 | Dark theme rendering |
| BDD-20 | OM-14, OM-15, OM-16, OM-17, OM-18 | Keyboard navigation |
| BDD-21 | SD-16 | Empty state |
| BDD-22 | SD-49 | Mobile share button badge |
| BDD-23 | SD-42, SD-43, SD-44 | Keyboard nav in Popover |
| BDD-24 | SD-50 | Tablet viewport behavior |

## Red-Light Strategy

All tests are designed to fail (red) before P4 implementation because:

1. **OverflowMenu.spec.ts**: Tests reference `OverflowMenuDropdown.vue` and `OverflowMenuSheet.vue` sub-components that do not exist yet. The orchestrator's internal structure changes (v-if delegation to sub-components). CSS token assertions will fail against current legacy variables.

2. **ShareDialog.spec.ts**: Tests reference `ShareDialog.vue` and `ShareDialogContent.vue` which do not exist yet. The `ShareManagementPanel.vue` still exists but the new components are not created. Badge reactivity tests depend on `activeShareCount` computed that does not exist in EntryDetailView yet.

3. **share.spec.ts**: Tests reference `shareUrlCache` and `getShareUrl` which are not yet added to the share store.

Tests use `import()` with `vi.mock` to ensure import errors are caught as assertion failures rather than suite crashes. Component tests use `mount()` with stubs for child components where needed, but the primary assertion targets are the new components that must be created in P4.

## Visual Token Testing Approach

BDD-01~03 and BDD-18~19 specify visual compliance with DESIGN.md tokens. P3 tests these via CSS computed style assertions rather than screenshots:

- `getComputedStyle(element).backgroundColor` compared against resolved token values
- `getComputedStyle(element).borderRadius` compared against "8px"
- `getComputedStyle(element).boxShadow` checked for spec pattern
- Theme switching tested by setting `document.documentElement.dataset.theme` before mounting

This approach is appropriate for P3 (unit tests). P5/P6 will use Playwright screenshots for visual regression verification.
