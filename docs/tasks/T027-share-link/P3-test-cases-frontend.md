---
phase: P3
task_id: T027-share-link
type: test-cases
parent: P2-design.md
trace_id: T027-P3-20260629
created: 2026-06-29
---

# P3 Test Cases — Frontend

## Coverage Summary

| BDD | Test Case | Type | File |
|-----|-----------|------|------|
| F01 | TC-F01-01 ~ TC-F01-03 | Component + E2E | EntryDetailView, share-link.spec |
| F02 | TC-F02-01 ~ TC-F02-04 | Component | ShareDialog.spec.ts |
| F03 | TC-F03-01 ~ TC-F03-03 | Component | ShareDialog.spec.ts |
| F04 | TC-F04-01 ~ TC-F04-03 | Component | ShareDialog.spec.ts |
| F05 | TC-F05-01 ~ TC-F05-04 | Component + E2E | ShareManagementPanel.spec.ts, share-link.spec |
| F06 | TC-F06-01 ~ TC-F06-02 | Component + E2E | ShareManagementPanel.spec.ts, share-link.spec |
| F07 | TC-F07-01 ~ TC-F07-03 | Component + E2E | ShareManagementPanel.spec.ts, share-link.spec |
| F08 | TC-F08-01 ~ TC-F08-02 | Component + E2E | EntryDetailView, share-link.spec |
| F09 | TC-F09-01 ~ TC-F09-04 | E2E | share-link.spec |
| F10 | TC-F10-01 ~ TC-F10-03 | E2E | share-link.spec |
| F11 | TC-F11-01 ~ TC-F11-03 | E2E | share-link.spec |
| F12 | TC-F12-01 ~ TC-F12-02 | E2E | share-link.spec |
| F13 | TC-F13-01 ~ TC-F13-02 | E2E | share-link.spec |
| F14 | TC-F14-01 ~ TC-F14-02 | E2E | share-link.spec |
| F15 | TC-F15-01 ~ TC-F15-02 | E2E + Store | share-link.spec, share.spec.ts |
| F16 | TC-F16-01 ~ TC-F16-02 | E2E + Store | share-link.spec, share.spec.ts |
| F17 | TC-F17-01 | Build | (gate, not test file) |
| F18 | TC-F18-01 | Build | (gate, not test file) |
| F19 | TC-F19-01 | Regression | (gate, existing tests must pass) |

---

## F01: Owner sees Share button on private entry

**BDD**: Given user Alice is logged in and viewing her own private entry, Then the entry detail page shows a "Share" button in the actions area. And the Share button is not visible on public entries.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F01-01 | Share button visible on private entry owned by user | E2E | Owner logged in, viewing own private entry | Navigate to /{slug} | Share button is visible in detail-header actions |
| TC-F01-02 | Share button hidden on public entry | E2E | Owner logged in, viewing own public entry | Navigate to /{slug} | Share button is NOT visible |
| TC-F01-03 | Share button hidden for non-owner | E2E | Non-owner logged in, viewing a private entry via share link | Navigate to /{slug}?share={token} | Share button is NOT visible |

## F02: Share button opens ShareDialog

**BDD**: Given user Alice is viewing her own private entry, When Alice clicks the Share button, Then a modal dialog appears (Teleport to body). And the dialog contains: expiration selector (1h/24h/7d/30d/Permanent, default 7d). And the dialog contains: view limit selector (Unlimited / N times, default Unlimited). And the dialog contains: "Generate" button.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F02-01 | ShareDialog opens on Share button click | Component | ShareDialog visible=false | Set visible=true | Dialog overlay and content are rendered |
| TC-F02-02 | Expiration selector defaults to 7d | Component | ShareDialog open | Inspect default state | Select element has value "7d", options: 1h/24h/7d/30d/0 |
| TC-F02-03 | Max views input defaults to empty (Unlimited) | Component | ShareDialog open | Inspect default state | Input is empty, placeholder "Unlimited" |
| TC-F02-04 | Generate button is visible | Component | ShareDialog open | Inspect create section | Button with text "Create Link" is visible and enabled |

## F03: Generating share link shows URL with Copy button

**BDD**: Given the ShareDialog is open with selected options, When Alice clicks "Generate", Then the dialog shows the full share URL (/{slug}?share={token}). And a "Copy" button is visible. And the token is shown in a readable format.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F03-01 | Generate shows share URL | Component | ShareDialog open, mock API returns share_url | Click "Create Link" | Result section shows URL in readonly input |
| TC-F03-02 | Copy button appears after generation | Component | Share link generated | Inspect result section | "Copy" button is visible |
| TC-F03-03 | Warning message about one-time display | Component | Share link generated | Inspect result section | Warning text "Copy the URL now" is visible |

## F04: Copy button copies URL and shows toast

**BDD**: Given the ShareDialog shows a generated share URL, When Alice clicks "Copy", Then the URL is copied to clipboard. And a toast notification confirms "Link copied".

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F04-01 | Copy button writes to clipboard | Component | Share link generated, mock clipboard | Click "Copy" | navigator.clipboard.writeText called with share URL |
| TC-F04-02 | Toast shown on copy | Component | Share link generated, mock toast | Click "Copy" | Toast show called with "Link copied" |
| TC-F04-03 | Copy button text changes to "Copied!" | Component | Share link generated | Click "Copy" | Button text changes to "Copied!" |

## F05: Owner sees ShareManagementPanel on entry detail

**BDD**: Given user Alice is viewing her own private entry with shares, Then the entry detail page shows a ShareManagementPanel below the content. And the panel lists all shares with: creation date, expiration, view_count, status (active/expired/revoked). And each share row has a checkbox and a revoke button. And the panel shows statistics: "Active N / Expired M / Revoked K".

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F05-01 | Panel shows share list with stats | Component | Mount with 3 shares (active/expired/revoked) | Inspect rendered | Stats text "Active 1 / Expired 1 / Revoked 1" visible |
| TC-F05-02 | Each active share has checkbox and revoke button | Component | Mount with 1 active share | Inspect share row | Checkbox input and "Revoke" button visible |
| TC-F05-03 | Expired/revoked shares have no checkbox/revoke | Component | Mount with 1 revoked share | Inspect share row | No checkbox, no revoke button |
| TC-F05-04 | Panel visible on E2E private entry with shares | E2E | Owner logged in, private entry with shares | Navigate to /{slug} | ShareManagementPanel visible |

## F06: Owner revokes a single share

**BDD**: Given the ShareManagementPanel shows an active share, When Alice clicks the revoke button for that share, Then the share status changes to "Revoked". And a toast confirms the revocation.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F06-01 | Click revoke updates share status | Component | Mount with 1 active share, mock API | Click "Revoke" | API revokeShares called, list refreshed |
| TC-F06-02 | E2E single revoke | E2E | Private entry with 1 active share | Click revoke button | Share shows "Revoked" status, toast appears |

## F07: Owner selects multiple shares and batch-revokes

**BDD**: Given the ShareManagementPanel shows 3 active shares, When Alice selects 2 shares via checkboxes and clicks "Revoke Selected", Then both selected shares change to "Revoked". And the unselected share remains Active. And a toast confirms "2 links revoked".

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F07-01 | Checkboxes enable batch revoke button | Component | Mount with 3 active shares | Select 2 checkboxes | "Revoke 2 Selected" button appears |
| TC-F07-02 | Batch revoke calls API with selected IDs | Component | 2 shares selected, mock API | Click "Revoke 2 Selected" | API called with {share_ids: [id1, id2]} |
| TC-F07-03 | E2E batch revoke | E2E | Private entry with 3 active shares | Select 2, click batch revoke | 2 shares show "Revoked", 1 remains "Active" |

## F08: ShareManagementPanel not visible on public entries

**BDD**: Given user Alice is viewing her own public entry, Then the ShareManagementPanel is not shown. And the Share button is not shown.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F08-01 | Panel hidden on public entry | E2E | Owner logged in, public entry | Navigate to /{slug} | ShareManagementPanel not visible, Share button not visible |
| TC-F08-02 | Panel and button hidden after private→public toggle | E2E | Owner toggles private entry to public | Click visibility toggle | Share button and panel disappear |

## F09: Unauthenticated user accesses share link

**BDD**: Given a private entry with an active share link, And the user is not logged in, When the user navigates to /{slug}?share={token}, Then the entry content is displayed. And a "Shared by @username" watermark is visible. And owner-exclusive buttons (Delete, Visibility Toggle, Share) are hidden. And the ?share= token is removed from the URL bar.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F09-01 | Entry content displayed via share link | E2E | No auth, active share link | Navigate to /{slug}?share={token} | Entry content visible |
| TC-F09-02 | Watermark "Shared by @username" visible | E2E | No auth, share access | Navigate via share link | Watermark element with "Shared by @" text visible |
| TC-F09-03 | Owner-exclusive buttons hidden | E2E | No auth, share access | Navigate via share link | No Delete/Visibility/Share buttons |
| TC-F09-04 | Share token removed from URL bar | E2E | No auth, share access | Navigate to /{slug}?share={token} | URL bar shows /{slug} without ?share= |

## F10: Authenticated non-owner accesses share link

**BDD**: Given a private entry with an active share link, And user Bob is logged in (not the owner), When Bob navigates to /{slug}?share={token}, Then the entry content is displayed. And the "Shared by @username" watermark is visible. And owner-exclusive buttons are hidden.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F10-01 | Non-owner sees content via share link | E2E | Bob logged in, share link active | Navigate to /{slug}?share={token} | Entry content visible |
| TC-F10-02 | Non-owner sees watermark | E2E | Bob logged in, share access | Navigate via share link | Watermark visible |
| TC-F10-03 | Non-owner cannot see owner actions | E2E | Bob logged in, share access | Navigate via share link | No Delete/Visibility/Share buttons |

## F11: Owner accesses own entry via share link

**BDD**: Given a private entry owned by user Alice with an active share link, And Alice is logged in, When Alice navigates to /{slug}?share={token}, Then the entry content is displayed with full owner view. And NO watermark is shown (owner always has full access). And owner-exclusive buttons are visible.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F11-01 | Owner sees full view via share link | E2E | Owner logged in, share link active | Navigate to /{slug}?share={token} | Entry content visible, owner actions visible |
| TC-F11-02 | No watermark for owner | E2E | Owner logged in, share access | Navigate via share link | Watermark NOT visible |
| TC-F11-03 | Owner actions visible | E2E | Owner logged in, share access | Navigate via share link | Delete/Visibility buttons visible |

## F12: Expired share link shows appropriate error

**BDD**: Given a share link that has expired, When a user navigates to /{slug}?share={token}, Then an error message is shown indicating the link is no longer valid. And the entry content is NOT displayed.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F12-01 | Expired share shows error | E2E | No auth, expired share link | Navigate to /{slug}?share={expired_token} | Error state visible, content not displayed |
| TC-F12-02 | Error message text is generic | E2E | No auth, expired share link | Navigate to /{slug}?share={expired_token} | Error says "link is no longer valid" (generic, not "expired") |

## F13: Revoked share link shows appropriate error

**BDD**: Given a share link that has been revoked, When a user navigates to /{slug}?share={token}, Then an error message is shown indicating the link is no longer available. And the entry content is NOT displayed.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F13-01 | Revoked share shows error | E2E | No auth, revoked share link | Navigate to /{slug}?share={revoked_token} | Error state visible, content not displayed |
| TC-F13-02 | Revoked error uses same generic message | E2E | No auth, revoked share link | Navigate to /{slug}?share={revoked_token} | Error says "link is no longer valid" (same as expired) |

## F14: Share link with exceeded view limit shows appropriate error

**BDD**: Given a share link with max_views=1 and view_count=1, When a user navigates to /{slug}?share={token}, Then an error message is shown indicating the link view limit has been reached. And the entry content is NOT displayed.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F14-01 | Max views exceeded shows error | E2E | No auth, max_views exceeded | Navigate to /{slug}?share={maxview_token} | Error state visible, content not displayed |
| TC-F14-02 | Max views error uses same generic message | E2E | No auth, max_views exceeded | Navigate to /{slug}?share={maxview_token} | Error says "link is no longer valid" (generic) |

## F15: Private-to-public shows share revocation toast

**BDD**: Given a private entry with 3 active shares, When the owner toggles visibility to Public, Then a toast message shows "N share link(s) revoked". And the ShareManagementPanel and Share button disappear.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F15-01 | Toggle private→public shows revocation toast | Store | Private entry with 3 shares, mock API returns revoked_shares=3 | Call toggleVisibility | Toast shown with "3 share link(s) revoked" |
| TC-F15-02 | E2E toggle shows toast and hides panel | E2E | Owner viewing private entry with shares | Click visibility toggle | Toast with revocation count, panel disappears |

## F16: Public-to-private does not show revocation message

**BDD**: Given a public entry, When the owner toggles visibility to Private, Then no revocation message is shown. And the Share button appears.

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F16-01 | Toggle public→private no revocation toast | Store | Public entry, mock API returns no revoked_shares | Call toggleVisibility | No revocation toast |
| TC-F16-02 | E2E public→private shows Share button | E2E | Owner viewing public entry | Click visibility toggle | Share button appears, no revocation toast |

## F17: TypeScript type checking passes

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F17-01 | vue-tsc passes with share types | Gate | All share types added | npx vue-tsc --noEmit | 0 errors |

## F18: Production build succeeds

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F18-01 | npm run build succeeds | Gate | All share components added | npm run build | Build succeeds |

## F19: Existing frontend tests remain green

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-F19-01 | Existing vitest tests pass | Regression | Share feature implemented | npx vitest run | All existing tests pass |

---

## Additional Test Cases (Non-BDD, derived from P2 design)

### API Client Share Methods

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-API-01 | createShare transforms response correctly | Unit | Mock axios returns ShareCreateResponse | Call api.createShare(slug, data) | Returns ShareCreateResult with shareUrl |
| TC-API-02 | listShares transforms response correctly | Unit | Mock axios returns ShareListApiResponse | Call api.listShares(slug) | Returns {shares: ShareInfo[], total: number} |
| TC-API-03 | revokeShares returns revoked_count | Unit | Mock axios returns {revoked_count: 2} | Call api.revokeShares(slug, data) | Returns {revoked_count: 2} |
| TC-API-04 | getEntry with shareToken passes param | Unit | Mock axios | Call api.getEntry(slug, token) | GET request includes ?share=token |

### Share Store

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-STORE-01 | fetchShares populates shares list | Unit | Mock API returns 3 shares | Call fetchShares(slug) | shares ref contains 3 items |
| TC-STORE-02 | createShare calls API and returns result | Unit | Mock API | Call createShare(slug, "7d") | API called, result returned |
| TC-STORE-03 | revokeShares refreshes list after revoke | Unit | Mock API, 3 shares loaded | Call revokeShares(slug, [1]) | API revoke called, then fetchShares called |

### Entry Store: toggleVisibility revocation handling

| ID | Test Case | Type | Precondition | Action | Expected Result |
|----|-----------|------|-------------|--------|-----------------|
| TC-ESTORE-01 | toggleVisibility shows toast when shares revoked | Unit | Mock API returns {revoked_shares: 3} | Toggle private→public | Toast shown with "3 share link(s) revoked" |
| TC-ESTORE-02 | toggleVisibility no toast when no shares revoked | Unit | Mock API returns no revoked_shares | Toggle public→private | No revocation toast |
