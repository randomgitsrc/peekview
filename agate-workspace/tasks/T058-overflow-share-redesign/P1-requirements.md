---
phase: P1
task_id: T058
type: requirements
parent: P0-brief.md
trace_id: T058-P1-20260717
status: revised
created: 2026-07-17
agent: analyst
---

# T058 P1 — Requirements Baseline

## 1. Requirements Restatement

### 1A. OverflowMenu Complete Redesign

Rewrite the OverflowMenu component to strictly conform to DESIGN.md §6 Select/Dropdown specification. All visual properties (background, border, shadow, radius, hover) must use the design-system tokens rather than legacy or ad-hoc CSS variables. The component must be split into independent desktop Dropdown and mobile Bottom Sheet sub-components, decoupling their rendering logic while sharing the same data interface. Light-mode transparency must be eliminated by using `--c-surface` (which is `#ffffff` in light theme) as the dropdown background.

### 1B. Share Interaction Redesign

Replace the current ShareManagementPanel (full-width bottom panel, separate create/manage entries, checkbox batch interaction) with a unified share button entry point that opens a Popover (desktop, 280px wide) or Bottom Sheet (mobile, 60-70% screen height). All share operations -- create, list, copy, revoke -- happen within this single container. A badge on the share button shows the active link count (hidden when zero). The ShareDialogContent component encapsulates shared logic; the container components handle positioning, animation, and close behavior.

## 2. Implicit Requirements

### 2.1 Data

- **No data migration**: The share store API (`fetchShares`, `createShare`, `revokeShares`) and types (`ShareInfo`, `ShareCreateResult`) are unchanged. The rewrite is purely UI-layer.
- **Share URL display**: The current ShareManagementPanel shows only `tokenPrefix`. The new design must display the full shareable URL. `ShareCreateResult.shareUrl` provides the full URL on creation. For existing shares, the list API (`ShareInfo`) does not return a `shareUrl` field — only `tokenPrefix`. The frontend will construct the full share URL by combining the entry slug, share token (from the create result), and the app's base URL: `{base_url}/{slug}?share={full_token}`. No backend API change is required; the frontend is responsible for URL assembly. This is an implicit dependency — the current code never constructs or displays the full URL in the management panel.

### 2.2 Frontend

- **Badge reactivity**: The active-link-count badge on the share button must update in real time when shares are created or revoked. The share store's data must be the source of truth for the active count.
- **Popover positioning edge cases**: The Popover must not overflow the viewport. If the share button is near the bottom of the viewport, the Popover should flip upward or adjust position. This is not in P0-brief but is a standard Popover behavior requirement.
- **Loading state in Popover/Sheet**: When shares are being fetched, a loading indicator must appear inside the Popover/Sheet (not a blank space).
- **Error state feedback**: API failures during create or revoke must produce visible feedback (toast notification) — the current code already does this via `useToast`, but the new design must preserve it.
- **Empty state**: When no active share links exist, the Popover/Sheet shows an empty-state message and a "Create share link" primary button.
- **Scrollable content**: When the share list exceeds the Popover's max height, the content must be scrollable. P0-brief specifies `max-height: calc(100vh - header - 20px)`.

### 2.3 Multi-platform

- **No backend change required**: This is a pure frontend UI rewrite. The backend API endpoints for shares remain unchanged.
- **No MCP/CLI change required**: Share operations are only available through the web UI.
- **No API versioning concern**: The store layer absorbs the API response shape; the UI layer only consumes the store.

### 2.4 Boundary

- **All shares expired/revoked**: The badge shows 0 (hidden). The Popover/Sheet shows only the collapsible "Expired links" section (if any revoked/expired shares exist) or a full empty state.
- **Single active share**: The list view displays one link row with copy and revoke actions.
- **Many shares (scroll)**: The list scrolls within the Popover max-height constraint. On mobile, the Bottom Sheet body scrolls independently.
- **Share creation with default values**: When the user clicks "Create share link" without changing defaults, the system uses `7d` expiry and `null` maxViews (unlimited).
- **Revoke without confirmation**: P0-brief specifies instant revoke (no confirm dialog), with toast feedback. This is a deliberate UX choice matching GitHub's pattern.
- **Popover close on outside click**: Standard dropdown behavior — clicking outside the Popover closes it. On mobile, tapping the backdrop closes the Sheet.
- **Concurrent operations**: If the user rapidly clicks revoke on multiple links, each revoke is an independent API call. Race conditions are possible but result in eventual consistency (self-healing on next fetch) [current behavior context].

### 2.5 Compatibility

- **ShareManagementPanel.vue deletion**: Only `EntryDetailView.vue` imports this component. The import and usage must be removed and replaced with the new `ShareDialog.vue`.
- **OverflowMenu interface preservation**: The `OverflowMenuItem` interface and `variant` prop must remain compatible with existing call sites. `EntryDetailView.vue` constructs `overflowItems` — this array definition must continue to work. The "Share" menu item in OverflowMenu will be removed since the share button becomes the sole entry point.
- **Existing share store consumers**: Only `ShareManagementPanel.vue` and `EntryDetailView.vue` consume the share store. After the rewrite, `ShareDialog.vue` + `ShareDialogContent.vue` replace the panel as the sole consumer.
- **CSS variable migration**: Legacy variables (`--bg-primary`, `--border-color`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--error-bg`, `--error-text`, `--error-border`) used in OverflowMenu and ShareManagementPanel must be replaced with `--c-*` tokens from DESIGN.md.
- **Existing test file adaptation**: `OverflowMenu.spec.ts` unit tests use the old single-component interface and must be updated for the split sub-component architecture. E2E test files referencing OverflowMenu or ShareManagementPanel (e.g., `t052-header-redesign.e2e.spec.ts`, `test_t057_ui_polish.spec.ts`) must be updated to match the new component structure and selectors.

### 2.6 Implicit Dependencies Summary

| # | Implicit Need | Why Required | Addressed In |
|---|--------------|-------------|-------------|
| 1 | Full share URL display in new design | Current panel only shows tokenPrefix; new design shows clickable/copyable URL. Frontend assembles URL from entry slug + share token + base URL; no backend change needed | BDD-07, BDD-08 |
| 2 | Badge reactivity on share button | Badge must reflect real-time active count after create/revoke | BDD-05 |
| 3 | Popover viewport-edge positioning | Prevent overflow when button is near viewport bottom | BDD-13 |
| 4 | Loading state in Popover/Sheet | Users must see activity during API calls | BDD-06 |
| 5 | Error feedback preservation | Toast on API failure must not be lost in redesign | BDD-10c |
| 6 | Expired links collapsible section | P0-brief requires collapsed expired/revoked links | BDD-09 |
| 7 | Remove "Share" from OverflowMenu items | Share button is the sole entry point; OverflowMenu "Share" item becomes redundant | BDD-04 |
| 8 | Mobile share button with badge | Mobile bottom bar needs the share button + badge, not just OverflowMenu | BDD-22 |
| 9 | Danger item hover token migration | Current danger hover uses `--error-bg`; must migrate to `--c-*` token | BDD-03 |
| 10 | Existing test file adaptation | Unit and E2E tests reference old component interfaces; must be updated for new architecture | §2.5 |
| 11 | Empty state for zero shares | P0-brief wireframe shows empty state; no BDD covered it | BDD-21 |
| 12 | Share Popover/Sheet keyboard navigation | Tab order and Enter triggers inside Popover/Sheet | BDD-23 |
| 13 | Tablet viewport behavior | 641-1024px range undefined; must specify Popover vs Sheet | BDD-24 |

## 3. BDD Acceptance Criteria

### OverflowMenu Visual Compliance (DESIGN.md §6)

**BDD-01**: Dropdown background token
- Given the OverflowMenu is open in desktop dropdown mode
- When rendered in dark theme
- Then the dropdown panel background uses `--c-surface`
- And in light theme the background is `#ffffff` (opaque, not transparent)

**BDD-02**: Dropdown border and shadow tokens
- Given the OverflowMenu is open in desktop dropdown mode
- Then the dropdown panel border uses `--c-border-strong`
- And the border-radius is `8px`
- And the box-shadow is `0 8px 24px rgba(0,0,0,.16)`

**BDD-03**: Menu item hover state
- Given the OverflowMenu dropdown is open with multiple items
- When the user hovers over a non-danger menu item
- Then the item background changes to `--c-surface-lower`
- When the user hovers over a danger menu item (variant=danger)
- Then the item background changes to a `--c-error`-derived token (e.g., `--c-error-subtle`)

**BDD-04**: Share item removed from OverflowMenu
- Given an entry detail page where the current user is the owner of a private entry
- When the OverflowMenu is opened
- Then the "Share" menu item is NOT present in the OverflowMenu
- And the share button is a separate element in the actions area

### Share Interaction — Badge and Entry Point

**BDD-05**: Share button badge reflects active count
- Given an entry detail page for a private entry owned by the current user
- And the entry has 2 active (non-expired, non-revoked) share links
- Then the share button displays a badge with the number `2`
- When the user revokes one share link
- Then the badge updates to show `1`
- When the last share link is revoked
- Then the badge is no longer visible

**BDD-06**: Loading state in share container
- Given an entry detail page for a private entry
- When the user clicks the share button
- And the share list is still loading
- Then a loading indicator is visible inside the Popover (desktop) or Bottom Sheet (mobile)

### Share Interaction — List View

**BDD-07**: Active share link display
- Given an entry with 1 active share link (the frontend constructs the full share URL from the entry slug, share token, and base URL as `{base_url}/{slug}?share={full_token}`)
- When the user opens the share Popover
- Then the full share URL is displayed in monospace font
- And if the URL is longer than the container width, it is middle-truncated with `...` (e.g., `https://peek....com/abc?share=xA4b`)
- And a copy button is visible on the right side of the URL row
- And a status line shows the view count and expiry (e.g., "2 views · Expires 7d")
- And a revoke button (using `--c-error` color) is visible on the status line

**BDD-08**: Copy share link
- Given the share Popover is open with an active share link
- When the user clicks the copy button
- Then the share URL is written to the clipboard
- And the copy icon changes to a check icon with `--c-success` color
- And after 1.5 seconds the icon reverts to the copy icon

**BDD-09**: Expired/revoked links collapsible section
- Given an entry with 2 active links and 3 expired/revoked links
- When the user opens the share Popover
- Then the 2 active links are displayed in the main list
- And a collapsible section labeled "Expired links (3)" is visible below the active list
- When the user expands this section
- Then the 3 expired/revoked links are displayed with reduced opacity
- And no revoke button is shown for expired/revoked links

### Share Interaction — Create View

**BDD-10a**: Create view UI
- Given the share Popover is open showing the list view
- When the user clicks "Create share link" (or "Create new link")
- Then the Popover content switches to the create view
- And the create view contains an expiry dropdown (options: 1h, 1d, 7d, 30d, Never; default 7d)
- And a max views dropdown (options: Unlimited, 10, 50, 100; default Unlimited)
- And a primary "Create link" button

**BDD-10b**: Create share link success
- Given the share create view is open with default values
- When the user clicks "Create link"
- And the API call succeeds
- Then a new share link is created
- And the view switches back to the list view
- And the new link appears at the top of the active list
- And the new link row has a `--c-success` border that flashes for 0.5 seconds
- And the badge count increments by 1

**BDD-10c**: Create share link failure
- Given the share create view is open
- When the user clicks "Create link"
- And the API call fails
- Then an error toast is shown

### Share Interaction — Revoke

**BDD-11**: Revoke share link (instant, no confirmation)
- Given the share Popover is open with an active share link
- When the user clicks the revoke button on that link
- Then the share link is immediately revoked (no confirmation dialog)
- And a success toast is shown with the message "Link revoked"
- And the link moves to the expired/revoked section (or disappears if section is collapsed)
- And the badge count decrements by 1

### Desktop Popover Behavior

**BDD-12**: Popover open/close on desktop
- Given an entry detail page on desktop viewport (width > 1024px)
- When the user clicks the share button
- Then a Popover (280px wide) appears anchored below the share button
- When the user clicks outside the Popover
- Then the Popover closes
- When the user presses Escape
- Then the Popover closes

**BDD-13**: Popover does not overflow viewport
- Given the share button is positioned near the bottom of the viewport
- When the user clicks the share button
- Then the Popover appears without overflowing the viewport bottom edge
- And the Popover max-height is `calc(100vh - header - 20px)`
- And if the content is taller than available space, the Popover body is scrollable

### Mobile Bottom Sheet Behavior

**BDD-14**: Bottom Sheet on mobile
- Given an entry detail page on mobile viewport (width <= 640px)
- When the user taps the share button in the mobile bottom bar
- Then a Bottom Sheet slides up from the bottom
- And the Sheet occupies 60-70% of the screen height
- And a drag handle is visible at the top of the Sheet
- And the backdrop is visible behind the Sheet

**BDD-15**: Bottom Sheet close on mobile
- Given the share Bottom Sheet is open on mobile
- When the user taps the backdrop
- Then the Sheet closes
- When the user swipes the Sheet downward
- Then the Sheet closes
- When the user taps the close button (X) in the Sheet header
- Then the Sheet closes
- When the user presses Escape
- Then the Sheet closes

### OverflowMenu — Split Sub-Components

**BDD-16**: Desktop dropdown is a separate sub-component
- Given the OverflowMenu is rendered with `variant="dropdown"`
- Then the desktop Dropdown sub-component is used
- And the desktop Dropdown renders items with 18px icons, left-aligned labels, and right-aligned hints
- And the minimum item height is 36px

**BDD-17**: Mobile sheet is a separate sub-component
- Given the OverflowMenu is rendered with `variant="sheet"`
- Then the mobile Bottom Sheet sub-component is used
- And the Sheet renders items with 20px icons, left-aligned labels, and right-aligned hints
- And the minimum item height is 48px (44px touch target minimum)

### Theme Consistency

**BDD-18**: Light theme rendering
- Given the user is in light theme
- When the OverflowMenu dropdown is open
- Then the dropdown background is opaque white (`#ffffff`, from `--c-surface`)
- And no page content is visible through the dropdown background
- When the share Popover is open
- Then the Popover background is opaque white
- And no page content is visible through the Popover background

**BDD-19**: Dark theme rendering
- Given the user is in dark theme
- When the OverflowMenu dropdown is open
- Then the dropdown background is `#121822` (from `--c-surface`)
- When the share Popover is open
- Then the Popover background is `#121822` (from `--c-surface`)

### Keyboard Accessibility

**BDD-20**: Keyboard navigation in OverflowMenu
- Given the OverflowMenu trigger has focus
- When the user presses Enter or Space
- Then the dropdown opens
- When the user presses Escape
- Then the dropdown closes and focus returns to the trigger
- When the user presses Tab with the dropdown open
- Then focus moves to the next focusable element and the dropdown closes

### Additional BDD (from P1 review revision)

**BDD-21**: Empty state in share container
- Given an entry with 0 active and 0 expired/revoked share links
- When the user opens the share Popover (desktop) or Bottom Sheet (mobile)
- Then a "No active share links" message is visible
- And a primary "Create share link" button is visible

**BDD-22**: Mobile share button in bottom bar
- Given an entry detail page on mobile viewport (width <= 640px)
- Then a share button is visible in the mobile bottom bar
- And the share button displays a badge with the active link count (hidden when 0)

**BDD-23**: Keyboard navigation in Share Popover/Sheet
- Given the share Popover is open on desktop
- When the user presses Tab
- Then focus cycles through interactive elements (copy buttons, revoke buttons, create link button)
- When the user presses Enter on a copy button
- Then the share URL is copied to the clipboard
- When the user presses Escape
- Then the Popover closes and focus returns to the share button

**BDD-24**: Tablet viewport behavior
- Given an entry detail page on tablet viewport (641px <= width <= 1024px)
- When the user clicks the share button
- Then a Popover (280px wide) appears (same as desktop behavior)
- And the OverflowMenu uses the dropdown variant (same as desktop)

## 4. Pending Confirmations

None. P0-brief has determined the direction; all implicit needs identified above have clear resolutions aligned with the P0-brief decisions.

## 5. Phase Tailoring

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

| Phase | Status | Rationale |
|-------|--------|-----------|
| P1 | Included | Requirements baseline (current document) |
| P2 | Included | Design required — component architecture, visual token mapping, interaction flows |
| P3 | Included | TDD test-first required — OverflowMenu sub-component props/emits contracts, ShareDialogContent view-switching logic, badge reactivity, and keyboard navigation all have testable behavior contracts. Existing `OverflowMenu.spec.ts` must be updated for the new architecture. Visual-only aspects are excluded from P3 (covered by P5/P6). |
| P4 | Included | Implementation |
| P5 | Included | Technical verification — visual regression check across themes and viewports |
| P6 | Included | UI changes require Playwright real-run + screenshot verification. P6 is mandatory per P0-brief. |
| P7 | Skipped | Pure frontend change, no cross-package impact. Single `frontend-v3` package affected. P2 design-review will cover component interface consistency as compensation. |
| P8 | Included | Build verification + version bump if needed |

coupling_checklist: [api-schema: checked, data-model: checked, mcp-contract: checked, cross-package: checked]
跳过风险: low — 改动限于前端组件重写/新建/删除，无后端/MCP/CLI联动；组件接口一致性由 P2 design-review 补偿检查

## 6. Scope Declaration

```yaml
packages:
  - frontend-v3/src/components/OverflowMenu.vue          # rewrite
  - frontend-v3/src/components/OverflowMenuDropdown.vue   # new sub-component (desktop)
  - frontend-v3/src/components/OverflowMenuSheet.vue      # new sub-component (mobile)
  - frontend-v3/src/components/ShareDialog.vue            # new (replaces ShareManagementPanel)
  - frontend-v3/src/components/ShareDialogContent.vue     # new (shared content logic)
  - frontend-v3/src/components/ShareManagementPanel.vue   # delete
  - frontend-v3/src/views/EntryDetailView.vue            # adjust imports and integration
  - frontend-v3/src/stores/share.ts                      # no change (confirmed)
  - frontend-v3/src/types/index.ts                       # no change (confirmed)
  - frontend-v3/src/components/__tests__/OverflowMenu.spec.ts  # adapt for split sub-components

domains:
  - overflow-redesign     # OverflowMenu rewrite from DESIGN.md spec
  - share-redesign        # Share interaction unified entry + Popover/Sheet dual mode

risk_level: medium

ui_affected:
  - Desktop Detail Header: OverflowMenu dropdown appearance + share button with badge + Popover trigger
  - Mobile Detail Header: share button with badge in bottom bar
  - Detail Page Body: ShareManagementPanel full-width panel removed
  - Share Popover (desktop): new floating container with list/create/revoke UI
  - Share Bottom Sheet (mobile): new slide-up container with list/create/revoke UI
```

## 7. Capability Requirements

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 acceptance requires Playwright screenshots to verify visual compliance with DESIGN.md tokens, light/dark theme rendering, and mobile viewport behavior
    available:
      - "playwright-cdp skill (Chrome CDP screenshots)"
      - "vision-analyst (agate execution role, UI structure analysis)"
      - "vision-analyzer skill (vision-analyze.py, screenshot interpretation)"
    status: available

  - need: responsive-testing
    why: BDD criteria require verification at both desktop (>1024px) and mobile (<=640px) viewports
    available:
      - "playwright-cdp skill (viewport emulation via CDP)"
    status: available

  - need: theme-switching
    why: BDD-18 and BDD-19 require verification in both light and dark themes
    available:
      - "playwright-cdp skill (can toggle data-theme attribute)"
    status: available
```

## SCOPE+ 增补记录

[SCOPE_RESOLVED: from P2-design.md] Share URL unavailable for existing shares — P4 implementer added shareUrlCache + getShareUrl() to share.ts store. For shares where full URL is unavailable, display `tokenPrefix...` as fallback. BDD-07 adjusted to accept this fallback display. No backend change needed.

[SCOPE_RESOLVED: from P2-progress.md] Share URL unavailable for existing shares — same finding as P2-design.md, resolved via shareUrlCache fallback.
[SCOPE_RESOLVED: from P2-review.md] SCOPE+ section numbering reference — same finding, resolved as above.
[SCOPE_RESOLVED: from P2-design.md §11] Share URL unavailable for existing shares — same finding, resolved via shareUrlCache + getShareUrl() in share.ts store.
