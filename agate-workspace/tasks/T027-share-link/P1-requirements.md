---
phase: P1
task_id: T027-share-link
type: problems
parent: P0-brief.md
trace_id: T027-P1-20260629
status: draft
created: 2026-06-29
---

# P1 Requirements Baseline — T027 share-link

## 1. Requirements Restatement

**Problem**: Private entries are completely inaccessible to non-owners. Owners cannot share private content without making the entire entry public, which is irreversible for access control (anyone with the URL can see it forever).

**Solution needed**: Temporary share links for private entries — a URL containing a cryptographic token (`/{slug}?share={token}`) that grants read access without login, with configurable expiration and view-count limits, revocable by the owner at any time.

**Core behaviors**:
- Owner generates a share link with chosen expiration (1h/24h/7d/30d/permanent) and optional view-count limit
- Anyone with the link can view the private entry without login
- Owner can revoke individual or multiple share links
- When entry changes from private to public, all active shares auto-revoke
- Shared page shows "Shared by @username" watermark (not shown to owner)
- Owner sees view_count per share link

**User decisions (from P0, not rewritten — referenced)**: See P0-brief.md `user_decisions` (11 items, all confirmed).

## 2. Implicit Requirements

P0 defines backend endpoints, table schema, and frontend components. The following requirements are implied but not explicitly stated:

### 2.1 Share token must grant access to ALL entry sub-resources

P0 mentions only the entry detail endpoint (`GET /api/v1/entries/{slug}`), but a share link user also needs access to:
- File content (`/api/v1/entries/{slug}/files/{file_id}/content`)
- File download
- Entry download as ZIP (`/api/v1/entries/{slug}/download`)
- HTML file render (`/api/v1/entries/{slug}/files/{file_id}/render`)
- Entry raw content (`/api/v1/entries/{slug}/raw`)

**Why required**: A share link that only shows entry metadata but not file content is broken. The current `_resolve_entry()` pattern in `files.py` delegates to `EntryService.get_entry()` for visibility — share token validation must integrate into this same path.

### 2.2 Share cookie mechanism for subsequent API calls

The first access via `?share={token}` validates the token and sets an HTTPOnly cookie. Subsequent API calls (file content, download, render) use this cookie instead of requiring the token on every request.

**Why required**: The entry detail page makes multiple API calls (entry data, file content, render). Without a cookie, the frontend would need to append `?share=token` to every API call, and the token would appear in server logs for each request.

### 2.3 EntryResponse must indicate share access context

When accessing an entry via share token, the API response must include a field indicating "this is a share view" so the frontend can:
- Show the "Shared by @username" watermark
- Hide owner-exclusive action buttons (delete, visibility toggle, share management)

**Why required**: Without this signal, the frontend cannot differentiate between an owner viewing their own private entry and a share-link visitor viewing the same entry.

### 2.4 Referrer-Policy header for share-accessed pages

When a page is accessed via `?share={token}`, the response should include `Referrer-Policy: no-referrer` to prevent the share token from leaking via the Referer header when the visitor clicks external links on the shared page.

**Why required**: The share token is in the query parameter. Without Referrer-Policy, any external link on the shared page would send the full URL (including token) in the Referer header to the external site.

### 2.5 Entry expiration blocks share access

P0 states "entry 还在 + share 未过期 + share 未撤销 → 可访问", but does not explicitly handle the case where the entry itself expires. If an entry's `expires_at` has passed, share access must also be denied — the entry is no longer accessible regardless of share status.

**Why required**: An expired entry is semantically "gone". Allowing share access to expired entries would be inconsistent with the entry lifecycle.

### 2.6 Share creation should be rejected for expired entries

An owner should not be able to create new share links for an expired entry. The entry is no longer active, so creating shares for it is meaningless.

**Why required**: Prevents confusing UX where a share link is created but immediately non-functional.

### 2.7 Max shares per entry

P0 does not specify a limit on the number of shares per entry. Without a limit, a malicious or confused owner could create thousands of shares, bloating the database.

**Why required**: Prevent resource exhaustion. A reasonable limit (e.g., 20-50 per entry) covers legitimate use cases while preventing abuse.

### 2.8 Global API key bypasses share validation

The global API key (`PEEKVIEW_SERVER__API_KEY`) already bypasses all visibility/ownership checks. It should also bypass share token validation — a request authenticated with the global API key should access any entry regardless of share status.

**Why required**: Consistency with existing auth model. Global API key is a superuser mechanism.

### 2.9 Admin can list/revoke shares for any entry

Admin users should be able to list and revoke shares for entries they don't own, consistent with their ability to see all entries.

**Why required**: Consistency with existing admin privileges. Admin can already see private entries they don't own.

### 2.10 Share list should display token prefix, not full token

The list_shares endpoint should return a token prefix (e.g., first 8 characters) for display purposes, not the full token. The full token is only available at creation time.

**Why required**: The full token is a secret equivalent to the share link. If the database is compromised, or if the list endpoint is accessed by a different admin, the full tokens should not be exposed.

### 2.11 Share access should not affect entry-level view metrics

If PeekView tracks entry views separately, share-link access should not double-count. The share's `view_count` increments, but this should not also increment any entry-level counter.

**Why required**: Currently PeekView does not track entry-level view counts, so this is a non-issue for now. Stating it explicitly prevents future confusion.

### 2.12 Frontend must handle share token on initial page load

When a user navigates to `/{slug}?share={token}`:
1. Frontend detects the `share` query param
2. Passes it to the API call (or relies on cookie if already set)
3. On success, shows content with watermark
4. On failure, shows appropriate error (expired/revoked/max_views exceeded)
5. Removes `?share=token` from URL bar (replaceState) to prevent accidental sharing of the token in screenshots

**Why required**: Without URL cleanup, the share token stays visible in the browser URL bar indefinitely, increasing leak risk.

## 3. BDD Acceptance Criteria

### Backend — Share Creation

```gherkin
B01: Owner creates share link for own private entry
  Given a private entry owned by user Alice
  And Alice is authenticated
  When Alice sends POST /api/v1/entries/{slug}/shares with {expires_in: "7d", max_views: null}
  Then response status is 201
  And response contains a 16-character URL-safe base64 token
  And response contains the full share URL /{slug}?share={token}
  And the database stores SHA256 hash of the token, not the plaintext token
  And the share record has expires_at = now + 7 days
  And the share record has max_views = null (unlimited)
  And the share record has view_count = 0
  And the share record has revoked_at = null

B02: Non-owner cannot create share link
  Given a private entry owned by user Alice
  And user Bob is authenticated (not owner, not admin)
  When Bob sends POST /api/v1/entries/{slug}/shares
  Then response status is 403

B03: Anonymous cannot create share link
  Given a private entry owned by user Alice
  And the request has no authentication
  When the request sends POST /api/v1/entries/{slug}/shares
  Then response status is 401

B04: Cannot create share for non-existent entry
  Given no entry with slug "nonexistent"
  When an authenticated user sends POST /api/v1/entries/nonexistent/shares
  Then response status is 404

B05: Cannot create share for expired entry
  Given a private entry owned by user Alice that has expired (expires_at < now)
  When Alice sends POST /api/v1/entries/{slug}/shares
  Then response status is 400

B06: Share creation respects max shares limit
  Given a private entry with 50 active shares (the maximum allowed)
  When the owner sends POST /api/v1/entries/{slug}/shares
  Then response status is 400
  And the error message indicates the share limit has been reached
```

### Backend — Share Validation & Access

```gherkin
B07: Valid share token grants access to private entry
  Given a private entry with an active (non-expired, non-revoked) share token
  And the request has no authentication
  When the request sends GET /api/v1/entries/{slug}?share={token}
  Then response status is 200
  And the response contains the entry data including files
  And the response contains share_access context (e.g., share_access: true, shared_by: "username")
  And view_count for this share is incremented by 1

B08: Expired share token denies access
  Given a share token where expires_at < now
  When the request sends GET /api/v1/entries/{slug}?share={token}
  Then response status is 404 (same as entry-not-found, to prevent token enumeration)

B09: Revoked share token denies access
  Given a share token where revoked_at is not null
  When the request sends GET /api/v1/entries/{slug}?share={token}
  Then response status is 404

B10: Share token exceeding max_views denies access
  Given a share token with max_views = 5 and view_count = 5
  When the request sends GET /api/v1/entries/{slug}?share={token}
  Then response status is 404

B11: Share token does not grant access to expired entry
  Given a private entry that has expired (entry.expires_at < now)
  And an active (non-expired, non-revoked) share token for this entry
  When the request sends GET /api/v1/entries/{slug}?share={token}
  Then response status is 404

B12: Invalid (wrong) share token denies access
  Given a private entry with an active share token "abc123"
  When the request sends GET /api/v1/entries/{slug}?share=wrong_token
  Then response status is 404

B13: Share token grants access to file content
  Given a private entry with an active share token and files
  And a valid share cookie is set (from prior entry access)
  When the request sends GET /api/v1/entries/{slug}/files/{file_id}/content
  Then response status is 200
  And the file content is returned

B14: Share token grants access to HTML render
  Given a private entry with an active share token and an HTML file
  And a valid share cookie is set
  When the request sends GET /api/v1/entries/{slug}/files/{file_id}/render
  Then response status is 200
  And the rendered HTML is returned with permissive render CSP

B15: Share token grants access to entry download
  Given a private entry with an active share token and multiple files
  And a valid share cookie is set
  When the request sends GET /api/v1/entries/{slug}/download
  Then response status is 200
  And the ZIP file is returned

B16: Share token grants access to raw content
  Given a private entry with an active share token
  And a valid share cookie is set
  When the request sends GET /api/v1/entries/{slug}/raw
  Then response status is 200
  And the raw content is returned
```

### Backend — Share Cookie

```gherkin
B17: Valid share token sets cookie
  Given a private entry (id=42) with an active share token "abc123xyz"
  When the request sends GET /api/v1/entries/{slug}?share=abc123xyz
  Then response includes Set-Cookie header with name peekview_share_42
  And cookie value is the token prefix (first 8 characters)
  And cookie is HTTPOnly
  And cookie is SameSite=Lax
  And cookie expires at the share's expires_at (or far future for permanent shares)

B18: Share cookie enables subsequent access without token
  Given a valid share cookie peekview_share_42 is set in the request
  When the request sends GET /api/v1/entries/{slug}/files/{file_id}/content (no ?share= param)
  Then response status is 200
  And the file content is returned

B19: Revoked share cookie denies access
  Given a share cookie peekview_share_42 from a now-revoked share
  When the request sends GET /api/v1/entries/{slug}/files/{file_id}/content
  Then response status is 404
```

### Backend — Share List

```gherkin
B20: Owner lists shares for own entry
  Given a private entry owned by user Alice with 3 shares (1 active, 1 expired, 1 revoked)
  When Alice sends GET /api/v1/entries/{slug}/shares
  Then response status is 200
  And response contains 3 share records
  And each record includes: id, token_prefix, expires_at, max_views, view_count, revoked_at, created_at
  And full token is NOT included in any record

B21: Non-owner cannot list shares
  Given a private entry owned by user Alice
  And user Bob is authenticated (not owner, not admin)
  When Bob sends GET /api/v1/entries/{slug}/shares
  Then response status is 403

B22: Admin can list shares for any entry
  Given a private entry owned by user Alice
  And admin user is authenticated
  When admin sends GET /api/v1/entries/{slug}/shares
  Then response status is 200
```

### Backend — Share Revocation

```gherkin
B23: Owner revokes specific shares
  Given a private entry owned by user Alice with 3 active shares (ids: 1, 2, 3)
  When Alice sends POST /api/v1/entries/{slug}/shares/revoke with {share_ids: [1, 3]}
  Then response status is 200
  And response contains {revoked_count: 2}
  And shares 1 and 3 have revoked_at set to current time
  And share 2 remains active (revoked_at is null)

B24: Non-owner cannot revoke shares
  Given a private entry owned by user Alice
  And user Bob is authenticated
  When Bob sends POST /api/v1/entries/{slug}/shares/revoke
  Then response status is 403

B25: Revoking non-existent share ids is ignored
  Given a private entry with share ids [1, 2]
  When the owner sends POST /api/v1/entries/{slug}/shares/revoke with {share_ids: [1, 999]}
  Then response status is 200
  And response contains {revoked_count: 1}
  And share 1 is revoked, share 999 is ignored
```

### Backend — Private-to-Public Auto-Revocation

```gherkin
B26: Changing entry from private to public auto-revokes all active shares
  Given a private entry with 3 active shares and 1 revoked share
  When the owner updates the entry with is_public=true
  Then all 3 active shares have revoked_at set to current time
  And the already-revoked share is unchanged
  And the update response includes {revoked_shares: 3}

B27: Changing entry from public to private preserves shares
  Given a public entry that was previously private and had 2 shares (1 revoked during private→public transition)
  When the owner updates the entry with is_public=false
  Then no shares are modified
  And the response does not include revoked_shares field (or it is 0)
```

### Backend — Cascade & Data Integrity

```gherkin
B28: Deleting entry cascades to delete all shares
  Given an entry with 5 share records
  When the entry is deleted
  Then all 5 share records are deleted (FK cascade)

B29: view_count increments atomically
  Given a share with max_views=100 and view_count=50
  When 10 concurrent requests access the entry via this share token
  Then view_count becomes 60 (not less, not more)
```

### Backend — Security

```gherkin
B30: Token comparison uses constant-time comparison
  Given a share token stored as SHA256 hash
  When the backend verifies a provided token
  Then it uses hmac.compare_digest (or equivalent constant-time comparison)
  And NOT a plain == comparison

B31: Token generation uses cryptographically secure randomness
  Given a request to create a share
  When the token is generated
  Then secrets.token_urlsafe(12) is used (or equivalent CSPRNG)
  And the token is 16 characters of URL-safe base64

B32: Referrer-Policy header set for share-accessed pages
  Given a page accessed via ?share={token}
  When the HTML response is returned
  Then the response includes Referrer-Policy: no-referrer header
```

### Backend — Backward Compatibility

```gherkin
B33: Existing tests remain green
  Given the current test suite (587 backend tests)
  When the share feature is implemented
  Then all 587 existing tests pass without modification
```

### Frontend — Share Button & Dialog

```gherkin
F01: Owner sees Share button on private entry
  Given user Alice is logged in and viewing her own private entry
  Then the entry detail page shows a "Share" button in the actions area
  And the Share button is not visible on public entries

F02: Share button opens ShareDialog
  Given user Alice is viewing her own private entry
  When Alice clicks the Share button
  Then a modal dialog appears (Teleport to body)
  And the dialog contains: expiration selector (1h/24h/7d/30d/Permanent, default 7d)
  And the dialog contains: view limit selector (Unlimited / N times, default Unlimited)
  And the dialog contains: "Generate" button

F03: Generating share link shows URL with Copy button
  Given the ShareDialog is open with selected options
  When Alice clicks "Generate"
  Then the dialog shows the full share URL (/{slug}?share={token})
  And a "Copy" button is visible
  And the token is shown in a readable format

F04: Copy button copies URL and shows toast
  Given the ShareDialog shows a generated share URL
  When Alice clicks "Copy"
  Then the URL is copied to clipboard
  And a toast notification confirms "Link copied"
```

### Frontend — Share Management Panel

```gherkin
F05: Owner sees ShareManagementPanel on entry detail
  Given user Alice is viewing her own private entry with shares
  Then the entry detail page shows a ShareManagementPanel below the content
  And the panel lists all shares with: creation date, expiration, view_count, status (active/expired/revoked)
  And each share row has a checkbox and a revoke button
  And the panel shows statistics: "Active N / Expired M / Revoked K"

F06: Owner revokes a single share
  Given the ShareManagementPanel shows an active share
  When Alice clicks the revoke button for that share
  Then the share status changes to "Revoked"
  And a toast confirms the revocation

F07: Owner selects multiple shares and batch-revokes
  Given the ShareManagementPanel shows 3 active shares
  When Alice selects 2 shares via checkboxes and clicks "Revoke Selected"
  Then both selected shares change to "Revoked"
  And the unselected share remains Active
  And a toast confirms "2 links revoked"

F08: ShareManagementPanel not visible on public entries
  Given user Alice is viewing her own public entry
  Then the ShareManagementPanel is not shown
  And the Share button is not shown
```

### Frontend — Share Access (Viewer Perspective)

```gherkin
F09: Unauthenticated user accesses share link
  Given a private entry with an active share link
  And the user is not logged in
  When the user navigates to /{slug}?share={token}
  Then the entry content is displayed
  And a "Shared by @username" watermark is visible
  And owner-exclusive buttons (Delete, Visibility Toggle, Share) are hidden
  And the ?share= token is removed from the URL bar

F10: Authenticated non-owner accesses share link
  Given a private entry with an active share link
  And user Bob is logged in (not the owner)
  When Bob navigates to /{slug}?share={token}
  Then the entry content is displayed
  And the "Shared by @username" watermark is visible
  And owner-exclusive buttons are hidden

F11: Owner accesses own entry via share link
  Given a private entry owned by user Alice with an active share link
  And Alice is logged in
  When Alice navigates to /{slug}?share={token}
  Then the entry content is displayed with full owner view
  And NO watermark is shown (owner always has full access)
  And owner-exclusive buttons are visible

F12: Expired share link shows appropriate error
  Given a share link that has expired
  When a user navigates to /{slug}?share={token}
  Then an error message is shown indicating the link has expired
  And the entry content is NOT displayed

F13: Revoked share link shows appropriate error
  Given a share link that has been revoked
  When a user navigates to /{slug}?share={token}
  Then an error message is shown indicating the link is no longer available
  And the entry content is NOT displayed

F14: Share link with exceeded view limit shows appropriate error
  Given a share link with max_views=1 and view_count=1
  When a user navigates to /{slug}?share={token}
  Then an error message is shown indicating the link view limit has been reached
  And the entry content is NOT displayed
```

### Frontend — Entry Visibility Toggle

```gherkin
F15: Toggling entry from private to public shows share revocation toast
  Given a private entry with 3 active shares
  When the owner toggles visibility to Public
  Then a toast message shows "3 share links revoked"
  And the ShareManagementPanel and Share button disappear

F16: Toggling entry from public to private does not show revocation message
  Given a public entry
  When the owner toggles visibility to Private
  Then no revocation message is shown
  And the Share button appears
```

### Frontend — Type Safety & Build

```gherkin
F17: TypeScript type checking passes
  Given the complete share feature implementation
  When npx vue-tsc --noEmit is run
  Then there are 0 type errors

F18: Production build succeeds
  Given the complete share feature implementation
  When npm run build is run
  Then the build succeeds without errors
```

### Frontend — Backward Compatibility

```gherkin
F19: Existing frontend tests remain green
  Given the current test suite (479 frontend tests)
  When the share feature is implemented
  Then all 479 existing tests pass without modification
```

## 4. Pending Confirmations

No [NEED_CONFIRM] items. All user decisions were confirmed in P0's 11 user_decisions. The implicit requirements identified in Section 2 are either:
- Clearly implied by the feature design (2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9, 2.10, 2.11, 2.12)
- Reasonable defaults that don't change business direction (2.6, 2.7)

The max shares limit (2.7) could be debated, but a limit of 50 per entry covers all reasonable use cases and can be adjusted later without breaking changes.

## 5. Pruning Declaration

```yaml
pruning_tendency: conservative
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
P1_simplified: false
```

**No phases pruned.** Rationale per phase:
- **P1** (this document): Security-sensitive feature requires thorough requirement analysis
- **P2**: New database table + 3 API endpoints + auth integration + cookie mechanism — design review is essential
- **P3**: TDD for security-sensitive token handling (generation, hashing, validation, timing-attack prevention) — test-first is non-negotiable
- **P4**: Implementation is substantial (new service, new routes, cookie handling, frontend components, entry_service hook)
- **P5**: Token security, cookie isolation, concurrent view_count, private→public auto-revoke — all require live verification
- **P6**: P0 explicitly mandates main Agent personal gate based on T020 PAUSED lesson — subagent self-reports are not trusted
- **P7**: Cross-package consistency check (backend table + frontend components + existing tests)
- **P8**: Release preparation (version bump, CHANGELOG, database migration verification)

## 6. Scope Declaration

```yaml
packages:
  - backend        # New table, service, routes, cookie, entry_service hook
  - frontend-v3    # ShareDialog, ShareManagementPanel, EntryDetailView changes, API client, store

domains:
  - backend        # API endpoints, service logic, database
  - frontend       # UI components, store, API client
  - api            # 3 new REST endpoints + query param on existing endpoint
  - security       # Token crypto, hash storage, timing-attack prevention, cookie isolation, Referrer-Policy
  - database       # New entry_shares table + migration

ui_affected:
  - EntryDetailView  # Share button, ShareManagementPanel, watermark, owner action hiding
  - ShareDialog (new)  # Modal for generating share links
  - ShareManagementPanel (new)  # List/revoke shares

NOT_IN_SCOPE:
  - MCP Server     # No share tools for MCP. Share management is browser UX.
  - CLI            # No share CLI commands. Share management is browser UX.
  - Password access # Explicitly excluded (path C chosen)
  - Email whitelist # Explicitly excluded
  - One-time view enforcement # Explicitly excluded
  - Self-destruct / burn-after-reading # Explicitly excluded
  - Device limits # Explicitly excluded
  - Independent /settings/shares page # Explicitly excluded (embedded in entry detail)
  - Share link analytics charts # Only basic view_count
  - QR code generation # Not in scope
  - Social media share buttons # Not in scope
```

## 7. Capability Requirements

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证分享链接水印、ShareDialog、ShareManagementPanel 的交互行为
    available:
      - playwright-cdp skill（项目已配置）
      - vision-analyzer skill（项目已配置，~/.claude/skills/vision-analyzer）
    status: available

  - need: e2e-testing
    why: 分享链接的完整端到端场景（创建→访问→撤销→验证失效）需要 Playwright
    available:
      - make debug-test（项目 Makefile 已配置）
      - Playwright E2E 框架（frontend-v3/e2e/ 已有 16 场景）
    status: available

  - need: security-validation
    why: Token 密码学强度、时序攻击防护、cookie 隔离需要代码审查验证
    available:
      - security Agent（agate 内置执行角色）
      - 代码审查（人工或 /code-review skill）
    status: available

  - need: concurrent-testing
    why: view_count 原子增加需要并发验证
    available:
      - pytest + threading（backend/.venv 已有）
    status: available
```
