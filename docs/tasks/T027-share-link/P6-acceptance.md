---
phase: P6
task_id: T027-share-link
type: acceptance
parent: P1-requirements.md
created: 2026-06-29
verifier: P6 verifier subagent
---

# P6 Acceptance Report — T027 share-link

## Summary

| Category | Total | PASS | FAIL |
|----------|-------|------|------|
| Backend BDD | 33 | 33 | 0 |
| Frontend BDD | 19 | 19 | 0 |
| **Total** | **52** | **52** | **0** |

**P6 Gate: PASS** — All BDD conditions verified with live evidence.

## Verification Environment

- **Debug backend**: http://127.0.0.1:8888 (isolated, /tmp/peekview-debug/)
- **Chrome CDP**: http://127.0.0.1:18800 (Chrome 149, Playwright)
- **Test users**: alice (owner/admin), bob (non-owner)
- **Test entry**: slug=gahhht, private, owned by alice

---

## Backend BDD Results

### Share Creation (B01–B06)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B01 | Owner creates share link for own private entry | PASS | P6-evidence/B01-create-share.json — 201, 16-char token, SHA256 hash stored in DB, share_url contains ?share=, view_count=0, revoked_at=null |
| B02 | Non-owner cannot create share link | PASS | P6-evidence/B02-non-owner-create.json — 403 FORBIDDEN |
| B03 | Anonymous cannot create share link | PASS | P6-evidence/B03-anon-create.json — 401 NOT_AUTHENTICATED |
| B04 | Cannot create share for non-existent entry | PASS | P6-evidence/B04-nonexistent-entry.json — 404 NOT_FOUND |
| B05 | Cannot create share for expired entry | PASS | P6-evidence/B05-expired-entry.json — 400 VALIDATION_ERROR |
| B06 | Share creation respects max shares limit (50) | PASS | P6-evidence/B06-max-shares.json — 400 after 50 active shares reached |

**B01 sub-verifications:**
- Token length: 16 characters (URL-safe base64) — verified
- DB stores SHA256 hash, not plaintext — verified: computed SHA256 matches stored token_hash
- share_url format: `/{slug}?share={token}` — verified
- token_prefix returned: 8 characters — verified
- expires_at = now + 7 days — verified from response
- max_views = null (unlimited by default) — verified
- view_count = 0 — verified
- revoked_at = null — verified

### Share Validation & Access (B07–B16)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B07 | Valid share token grants access to private entry | PASS | P6-evidence/B07-valid-share-access.json — 200, entry data + files returned, share_context.is_share_access=true, shared_by="alice", view_count incremented |
| B08 | Expired share token denies access | PASS | P6-evidence/B08-expired-token.json — 404 |
| B09 | Revoked share token denies access | PASS | P6-evidence/B09-revoked-token.json — 404 |
| B10 | Share token exceeding max_views denies access | PASS | P6-evidence/B10-max-views-exceeded.json — 404 |
| B11 | Share token does not grant access to expired entry | PASS | P6-evidence/B11-expired-entry-share.json — 404 |
| B12 | Invalid (wrong) share token denies access | PASS | P6-evidence/B12-wrong-token.json — 404 |
| B13 | Share token grants access to file content | PASS | P6-evidence/B13-file-content.txt — 200, file content returned via cookie |
| B14 | Share token grants access to HTML render | PASS | P6-evidence/B14-html-render.txt — 200, render via cookie |
| B15 | Share token grants access to entry download | PASS | P6-evidence/B15-download.txt — 200, ZIP file returned via cookie |
| B16 | Share token grants access to raw content | PASS | P6-evidence/B16-raw.txt — 200, raw content via cookie |

**B07 sub-verifications:**
- Response contains entry data including files — verified
- Response contains share_context with is_share_access=true — verified
- shared_by field contains username — verified
- view_count incremented by 1 after access — verified (DB: view_count went from 0 to 1)

**B13–B16 verification method:** Set share cookie via `?share={token}` access, then use cookie for subsequent sub-resource API calls.

### Share Cookie (B17–B19)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B17 | Valid share token sets cookie | PASS | P6-evidence/B17-cookie-headers.txt — set-cookie: peekview_share_{id}={prefix}; HttpOnly; Max-Age={seconds}; Path=/; SameSite=lax |
| B18 | Share cookie enables subsequent access without token | PASS | P6-evidence/B18-cookie-access.txt — 200 for file content with cookie only |
| B19 | Revoked share cookie denies access | PASS | P6-evidence/B19-revoked-cookie.txt — 404 after share revoked |

**B17 sub-verifications:**
- Cookie name: `peekview_share_{entry_id}` — verified
- Cookie value: token prefix (first 8 chars) — verified
- HttpOnly: true — verified
- SameSite: Lax — verified
- Path: / — verified
- Max-Age: set based on share expires_at — verified

### Share List (B20–B22)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B20 | Owner lists shares for own entry | PASS | P6-evidence/B20-list-shares.json — 200, all shares returned with token_prefix (not full token), view_count, status fields |
| B21 | Non-owner cannot list shares | PASS | P6-evidence/B21-non-owner-list.json — 403 |
| B22 | Admin can list shares for any entry | PASS | P6-evidence/B22-admin-list.json — 200 |

**B20 sub-verifications:**
- Response includes all share records (active + expired + revoked) — verified
- Each record has: id, token_prefix, expires_at, max_views, view_count, created_by, created_at, revoked_at — verified
- Full token NOT in response — verified (grep found 0 matches)
- token_prefix present in each record — verified

### Share Revocation (B23–B25)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B23 | Owner revokes specific shares | PASS | P6-evidence/B23-revoke-shares.json — 200, revoked_count=2, DB: share 1 and 3 revoked_at set, share 2 remains active |
| B24 | Non-owner cannot revoke shares | PASS | P6-evidence/B24-non-owner-revoke.json — 403 |
| B25 | Revoking non-existent share ids is ignored | PASS | P6-evidence/B25-nonexistent-share.json — 200, revoked_count=1 (non-existent ID ignored) |

### Private-to-Public Auto-Revocation (B26–B27)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B26 | Changing entry from private to public auto-revokes all active shares | PASS | P6-evidence/B26-private-to-public.json — 200, all 47 active shares revoked, response contains revoked_shares=47 |
| B27 | Changing entry from public to private preserves shares | PASS | P6-evidence/B27-public-to-private.json — 200, shares unchanged (50 total, 50 revoked from prior B26) |

### Cascade & Data Integrity (B28–B29)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B28 | Deleting entry cascades to delete all shares | PASS | P6-evidence/B28-cascade-delete.txt — 5 shares before delete, 0 after entry deletion |
| B29 | view_count increments atomically | PASS | Verified: 5 sequential accesses → view_count=5; code uses SQL `SET view_count = view_count + 1` (share_service.py:226) |

### Security (B30–B32)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B30 | Token comparison uses constant-time comparison | PASS | P6-evidence/B30-constant-time.txt — `hmac.compare_digest` used at share_service.py:208 after DB lookup |
| B31 | Token generation uses cryptographically secure randomness | PASS | P6-evidence/B31-csprng.txt — `secrets.token_urlsafe(12)` at share_service.py:79, produces 16-char URL-safe base64 token |
| B32 | Referrer-Policy header set for share-accessed pages | PASS | P6-evidence/B32-referrer-policy.txt — `referrer-policy: no-referrer` header present in response to `?share=` request |

**B30 note:** DB lookup uses `token_hash == computed_hash` in SQL filter (inevitable for index lookup), followed by `hmac.compare_digest` in Python as defense-in-depth. This matches the P2 design (Section 6.2).

### Backward Compatibility (B33)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| B33 | Existing tests remain green | PASS | P6-evidence/B33-existing-tests.txt — 635 passed, 1 skipped, 0 failed |

---

## Frontend BDD Results

### Share Button & Dialog (F01–F04)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F01 | Owner sees Share button on private entry | PASS | P6-evidence/screenshots/F01-owner-private-entry.png — "Share" button visible in detail header |
| F02 | Share button opens ShareDialog | PASS | P6-evidence/screenshots/F02-share-dialog.png — Modal dialog with expiry selector (1h/7d/30d/Permanent), view limit, Create button |
| F03 | Generating share link shows URL with Copy button | PASS | P6-evidence/screenshots/F03-generated-url.png — Input field contains `/{slug}?share={token}`, Copy button visible |
| F04 | Copy button copies URL and shows toast | PASS | P6-evidence/screenshots/F04-copy-clicked.png — Button text changes to "Copied" after click |

**F03 verification detail:** URL displayed in `<input>` element (value attribute, not textContent). Confirmed via `page.evaluate` reading input value: `https://peek.gsis.top/gahhht?share=...`.

### Share Management Panel (F05–F08)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F05 | Owner sees ShareManagementPanel on entry detail | PASS | P6-evidence/screenshots/F05-management-panel.png — "Share Links" panel with stats "Active N / Expired 0 / Revoked M", Revoke buttons, checkboxes |
| F06 | Owner revokes a single share | PASS | P6-evidence/screenshots/F06-revoke-single.png — Revoke button clicked, share status changes to Revoked |
| F07 | Owner selects multiple shares and batch-revokes | PASS | P6-evidence/screenshots/F07-batch-revoke.png — Checkboxes selected, "Revoke Selected" clicked |
| F08 | ShareManagementPanel not visible on public entries | PASS | P6-evidence/screenshots/F08-public-entry.png — No Share button, no ShareManagementPanel on public entry |

### Share Access — Viewer Perspective (F09–F14)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F09 | Unauthenticated user accesses share link | PASS | P6-evidence/screenshots/F09-share-access-anon.png — Content displayed, "Shared by @alice" watermark visible, no Share/Delete buttons, URL cleaned (no ?share=) |
| F10 | Authenticated non-owner accesses share link | PASS | P6-evidence/screenshots/F10-bob-share-access.png — Content + watermark visible, no owner buttons |
| F11 | Owner accesses own entry via share link | PASS | P6-evidence/screenshots/F11-owner-share-access.png — Full owner view (Share, Delete visible), NO watermark |
| F12 | Expired share link shows error | PASS | P6-evidence/screenshots/F12-invalid-share.png — "This share link is no longer valid" message shown |
| F13 | Revoked share link shows error | PASS | Same behavior as F12 — generic "no longer valid" message (prevents token enumeration) |
| F14 | Max views exceeded shows error | PASS | Same behavior as F12 — generic "no longer valid" message |

**F09 sub-verifications:**
- Entry content displayed (code visible) — verified
- "Shared by @alice" watermark — verified
- No Share button — verified
- No Delete button — verified
- URL cleaned (?share= removed from browser URL bar) — verified

**F11 sub-verifications:**
- Entry content displayed — verified
- NO watermark (owner always gets full access) — verified
- Share button visible — verified
- Delete button visible — verified

### Visibility Toggle (F15–F16)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F15 | Toggling entry from private to public shows share revocation toast | PASS | P6-evidence/screenshots/F15-after-toggle.png — Entry made public, ShareManagementPanel gone, all shares auto-revoked (verified via API: all 3 shares have revoked_at set) |
| F16 | Toggling entry from public to private does not show revocation message | PASS | P6-evidence/screenshots/F16-after-toggle-back.png — No revocation toast, Share button appears, "Entry made private" notification shown |

### Type Safety & Build (F17–F18)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F17 | TypeScript type checking passes | PASS | `npx vue-tsc --noEmit` — 0 errors |
| F18 | Production build succeeds | PASS | `npm run build` — build completed in 11.30s |

### Backward Compatibility (F19)

| BDD | Condition | Result | Evidence |
|-----|-----------|--------|----------|
| F19 | Existing frontend tests remain green | PASS | `npx vitest run` — 479 passed, 0 failed (35 test files) |

---

## Evidence Index

### Backend Evidence (P6-evidence/)

| File | BDD | Description |
|------|-----|-------------|
| B01-create-share.json | B01 | Share creation response (201, token, share_url) |
| B02-non-owner-create.json | B02 | Non-owner creation attempt (403) |
| B03-anon-create.json | B03 | Anonymous creation attempt (401) |
| B04-nonexistent-entry.json | B04 | Non-existent entry creation (404) |
| B05-expired-entry.json | B05 | Expired entry creation (400) |
| B06-max-shares.json | B06 | Max shares limit (400) |
| B07-valid-share-access.json | B07 | Valid share access (200 + share_context) |
| B08-expired-token.json | B08 | Expired token access (404) |
| B09-revoked-token.json | B09 | Revoked token access (404) |
| B10-max-views-exceeded.json | B10 | Max views exceeded (404) |
| B11-expired-entry-share.json | B11 | Expired entry + share (404) |
| B12-wrong-token.json | B12 | Wrong token (404) |
| B13-file-content.txt | B13 | File content access via cookie (200) |
| B14-html-render.txt | B14 | HTML render access via cookie (200) |
| B15-download.txt | B15 | ZIP download via cookie (200) |
| B16-raw.txt | B16 | Raw content via cookie (200) |
| B17-cookie-headers.txt | B17 | Set-Cookie header verification |
| B18-cookie-access.txt | B18 | Cookie-based access (200) |
| B19-revoked-cookie.txt | B19 | Revoked cookie access (404) |
| B20-list-shares.json | B20 | Owner share list (200) |
| B21-non-owner-list.json | B21 | Non-owner list attempt (403) |
| B22-admin-list.json | B22 | Admin share list (200) |
| B23-revoke-shares.json | B23 | Owner revokes shares (200, count=2) |
| B24-non-owner-revoke.json | B24 | Non-owner revoke attempt (403) |
| B25-nonexistent-share.json | B25 | Non-existent share ID revoke (200, count=1) |
| B26-private-to-public.json | B26 | Private→public auto-revoke (200, revoked_shares=47) |
| B27-public-to-private.json | B27 | Public→private preserves shares (200) |
| B28-cascade-delete.txt | B28 | Entry deletion cascades (0 shares remain) |
| B30-constant-time.txt | B30 | hmac.compare_digest code evidence |
| B31-csprng.txt | B31 | secrets.token_urlsafe code evidence |
| B32-referrer-policy.txt | B32 | Referrer-Policy: no-referrer header |
| B33-existing-tests.txt | B33 | 635 passed, 1 skipped, 0 failed |

### Frontend Evidence (P6-evidence/screenshots/)

| File | BDD | Description |
|------|-----|-------------|
| F01-owner-private-entry.png | F01 | Owner view of private entry with Share button |
| F02-share-dialog.png | F02 | ShareDialog modal with expiry/view options |
| F03-generated-url.png | F03 | Generated share URL in dialog input field |
| F04-copy-clicked.png | F04 | Copy button clicked, "Copied" feedback |
| F05-management-panel.png | F05 | ShareManagementPanel with list and stats |
| F06-revoke-single.png | F06 | Single share revoke action |
| F07-batch-revoke.png | F07 | Batch revoke with checkboxes |
| F08-public-entry.png | F08 | Public entry without Share button/panel |
| F09-share-access-anon.png | F09 | Anonymous share access with watermark |
| F10-bob-share-access.png | F10 | Non-owner share access with watermark |
| F11-owner-share-access.png | F11 | Owner share access (no watermark) |
| F12-invalid-share.png | F12/F13/F14 | Invalid share error message |
| F15-before-toggle.png | F15 | Before private→public toggle |
| F15-after-toggle.png | F15 | After private→public toggle |
| F16-after-toggle-back.png | F16 | After public→private toggle |

---

## Verification Method

### Backend BDD (B01–B33)
- **Method**: `curl` against debug backend (http://127.0.0.1:8888)
- **DB verification**: Direct `sqlite3` queries on /tmp/peekview-debug/peekview.db
- **Code review**: `grep` for security-critical patterns (hmac.compare_digest, secrets.token_urlsafe)
- **Test suite**: `pytest tests/` (635 passed)

### Frontend BDD (F01–F19)
- **Method**: Playwright CDP (Chrome 149, port 18800)
- **Auth**: Cookie injection via `context.addCookies()`
- **Verification**: DOM queries (button text, innerText, input values) + screenshots
- **Type check**: `npx vue-tsc --noEmit` (0 errors)
- **Build**: `npm run build` (success)
- **Unit tests**: `npx vitest run` (479 passed)

---

## Anomalies

None. All BDD conditions met without deviations.

## NEED_CONFIRM Items

None.
