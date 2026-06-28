---
phase: P3
task_id: T027-share-link
type: test-cases
parent: P2-design.md
trace_id: T027-P3-20260629
status: draft
created: 2026-06-29
---

# P3 Test Cases — Backend (T027 share-link)

## Overview

33 test cases covering all backend BDD conditions (B01-B33) from P1-requirements.md.
Tests are TDD red-light: they import/reference modules that do not exist yet, so they fail at import/attribute time.

## Test File Organization

| File | BDD Coverage | Test Count |
|------|-------------|------------|
| test_share_create.py | B01-B06 | 8 |
| test_share_access.py | B07-B16 | 12 |
| test_share_cookie.py | B17-B19 | 5 |
| test_share_list.py | B20-B22 | 4 |
| test_share_revoke.py | B23-B25 | 4 |
| test_share_lifecycle.py | B26-B29 | 6 |
| test_share_security.py | B30-B32 | 4 |
| **Total** | **B01-B33** | **43** |

---

## TC-B01: Owner creates share link for own private entry

- **BDD**: B01
- **File**: test_share_create.py
- **Given**: User Alice owns a private entry
- **When**: Alice sends POST /api/v1/entries/{slug}/shares with {expires_in: "7d", max_views: null}
- **Then**: Response 201, contains 16-char URL-safe base64 token, share_url field, DB stores SHA256 hash (not plaintext), expires_at = now+7d, max_views=null, view_count=0, revoked_at=null
- **Assertions**: status_code==201, len(token)==16, token matches [A-Za-z0-9_-]+, share_url contains "?share=", DB token_hash == sha256(token), response has no token_hash field

## TC-B02: Owner creates share with custom expiry and max_views

- **BDD**: B01 (variant)
- **File**: test_share_create.py
- **Given**: User Alice owns a private entry
- **When**: Alice sends POST /api/v1/entries/{slug}/shares with {expires_in: "1h", max_views: 10}
- **Then**: Response 201, expires_at ≈ now+1h, max_views=10
- **Assertions**: status_code==201, max_views==10, expires_at within 1h window

## TC-B03: Owner creates permanent share

- **BDD**: B01 (variant)
- **File**: test_share_create.py
- **Given**: User Alice owns a private entry
- **When**: Alice sends POST /api/v1/entries/{slug}/shares with {expires_in: "0"}
- **Then**: Response 201, expires_at is null (permanent)
- **Assertions**: status_code==201, expires_at is None

## TC-B04: Non-owner cannot create share link

- **BDD**: B02
- **File**: test_share_create.py
- **Given**: Private entry owned by Alice, Bob authenticated (not admin)
- **When**: Bob sends POST /api/v1/entries/{slug}/shares
- **Then**: Response 403
- **Assertions**: status_code==403

## TC-B05: Anonymous cannot create share link

- **BDD**: B03
- **File**: test_share_create.py
- **Given**: Private entry owned by Alice, no authentication
- **When**: Request sends POST /api/v1/entries/{slug}/shares
- **Then**: Response 401
- **Assertions**: status_code==401

## TC-B06: Cannot create share for non-existent entry

- **BDD**: B04
- **File**: test_share_create.py
- **Given**: No entry with slug "nonexistent"
- **When**: Authenticated user sends POST /api/v1/entries/nonexistent/shares
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B07: Cannot create share for expired entry

- **BDD**: B05
- **File**: test_share_create.py
- **Given**: Private entry owned by Alice, entry.expires_at < now
- **When**: Alice sends POST /api/v1/entries/{slug}/shares
- **Then**: Response 400
- **Assertions**: status_code==400, error message mentions expired

## TC-B08: Cannot create share for public entry

- **BDD**: B01 (implicit — P2 §3.1 step 3)
- **File**: test_share_create.py
- **Given**: Public entry owned by Alice
- **When**: Alice sends POST /api/v1/entries/{slug}/shares
- **Then**: Response 400
- **Assertions**: status_code==400, error message mentions public

## TC-B09: Max shares limit (50) blocks creation

- **BDD**: B06
- **File**: test_share_create.py
- **Given**: Private entry with 50 active shares
- **When**: Owner sends POST /api/v1/entries/{slug}/shares
- **Then**: Response 400, error mentions limit
- **Assertions**: status_code==400, error message mentions limit/maximum

---

## TC-B10: Valid share token grants access to private entry

- **BDD**: B07
- **File**: test_share_access.py
- **Given**: Private entry with active share token, no authentication
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 200, entry data returned, share_context present (is_share_access=true, shared_by=username), view_count incremented
- **Assertions**: status_code==200, share_context.is_share_access==True, share_context.shared_by=="alice", view_count==1

## TC-B11: Expired share token denies access

- **BDD**: B08
- **File**: test_share_access.py
- **Given**: Share token where expires_at < now
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B12: Revoked share token denies access

- **BDD**: B09
- **File**: test_share_access.py
- **Given**: Share token where revoked_at is not null
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B13: Share token exceeding max_views denies access

- **BDD**: B10
- **File**: test_share_access.py
- **Given**: Share token with max_views=5 and view_count=5
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B14: Share token does not grant access to expired entry

- **BDD**: B11
- **File**: test_share_access.py
- **Given**: Private entry that has expired (entry.expires_at < now), active share token
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B15: Invalid (wrong) share token denies access

- **BDD**: B12
- **File**: test_share_access.py
- **Given**: Private entry with active share token "abc123"
- **When**: GET /api/v1/entries/{slug}?share=wrong_token
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B16: Share token grants access to file content

- **BDD**: B13
- **File**: test_share_access.py
- **Given**: Private entry with active share token and files, valid share cookie set
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/content
- **Then**: Response 200, file content returned
- **Assertions**: status_code==200, body contains file content

## TC-B17: Share token grants access to HTML render

- **BDD**: B14
- **File**: test_share_access.py
- **Given**: Private entry with active share token and HTML file, valid share cookie set
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/render
- **Then**: Response 200, rendered HTML with permissive render CSP
- **Assertions**: status_code==200, Content-Security-Policy contains unsafe-inline

## TC-B18: Share token grants access to entry download

- **BDD**: B15
- **File**: test_share_access.py
- **Given**: Private entry with active share token and multiple files, valid share cookie set
- **When**: GET /api/v1/entries/{slug}/download
- **Then**: Response 200, ZIP file returned
- **Assertions**: status_code==200, content-type contains zip

## TC-B19: Share token grants access to raw content

- **BDD**: B16
- **File**: test_share_access.py
- **Given**: Private entry with active share token, valid share cookie set
- **When**: GET /api/v1/entries/{slug}/raw
- **Then**: Response 200, raw content returned
- **Assertions**: status_code==200

## TC-B20: Owner accessing own entry ignores share param

- **BDD**: B07 (implicit — P2 §4.2 priority order)
- **File**: test_share_access.py
- **Given**: Private entry owned by Alice, Alice authenticated, share token present
- **When**: Alice sends GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 200, share_context is NOT set (owner sees full view)
- **Assertions**: status_code==200, share_context is None or is_share_access==False

## TC-B21: Admin accessing private entry ignores share param

- **BDD**: B07 (implicit — P2 §4.2 priority order)
- **File**: test_share_access.py
- **Given**: Private entry owned by Alice, admin authenticated
- **When**: Admin sends GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 200, share_context NOT set
- **Assertions**: status_code==200, share_context is None or is_share_access==False

## TC-B22: Public entry ignores share param

- **BDD**: B07 (implicit — P2 §4.2 priority order)
- **File**: test_share_access.py
- **Given**: Public entry, share token present
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response 200, share_context NOT set
- **Assertions**: status_code==200, share_context is None

---

## TC-B23: Valid share token sets cookie

- **BDD**: B17
- **File**: test_share_cookie.py
- **Given**: Private entry (id=42) with active share token
- **When**: GET /api/v1/entries/{slug}?share={token}
- **Then**: Response includes Set-Cookie: peekview_share_{entry_id}={token_prefix}; HttpOnly; SameSite=Lax; Path=/
- **Assertions**: cookie name matches peekview_share_{entry_id}, cookie value == token[:8], HttpOnly flag present, SameSite=Lax, Path=/

## TC-B24: Share cookie enables subsequent access without token

- **BDD**: B18
- **File**: test_share_cookie.py
- **Given**: Valid share cookie peekview_share_{entry_id} set in request
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/content (no ?share= param)
- **Then**: Response 200, file content returned
- **Assertions**: status_code==200

## TC-B25: Revoked share cookie denies access

- **BDD**: B19
- **File**: test_share_cookie.py
- **Given**: Share cookie from a now-revoked share
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/content
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B26: Expired share cookie denies access

- **BDD**: B19 (variant)
- **File**: test_share_cookie.py
- **Given**: Share cookie from a now-expired share
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/content
- **Then**: Response 404
- **Assertions**: status_code==404

## TC-B27: Cookie max_views exceeded denies access

- **BDD**: B19 (variant)
- **File**: test_share_cookie.py
- **Given**: Share cookie from a share where view_count >= max_views
- **When**: GET /api/v1/entries/{slug}/files/{file_id}/content
- **Then**: Response 404
- **Assertions**: status_code==404

---

## TC-B28: Owner lists shares for own entry

- **BDD**: B20
- **File**: test_share_list.py
- **Given**: Private entry owned by Alice with 3 shares (1 active, 1 expired, 1 revoked)
- **When**: Alice sends GET /api/v1/entries/{slug}/shares
- **Then**: Response 200, 3 share records, each has id/token_prefix/expires_at/max_views/view_count/revoked_at/created_at, full token NOT included
- **Assertions**: status_code==200, len(shares)==3, no "token" or "token_hash" field in any record, token_prefix present

## TC-B29: Non-owner cannot list shares

- **BDD**: B21
- **File**: test_share_list.py
- **Given**: Private entry owned by Alice, Bob authenticated
- **When**: Bob sends GET /api/v1/entries/{slug}/shares
- **Then**: Response 403
- **Assertions**: status_code==403

## TC-B30: Admin can list shares for any entry

- **BDD**: B22
- **File**: test_share_list.py
- **Given**: Private entry owned by Alice, admin authenticated
- **When**: Admin sends GET /api/v1/entries/{slug}/shares
- **Then**: Response 200
- **Assertions**: status_code==200

## TC-B31: Anonymous cannot list shares

- **BDD**: B21 (implicit)
- **File**: test_share_list.py
- **Given**: Private entry, no authentication
- **When**: Request sends GET /api/v1/entries/{slug}/shares
- **Then**: Response 401
- **Assertions**: status_code==401

---

## TC-B32: Owner revokes specific shares

- **BDD**: B23
- **File**: test_share_revoke.py
- **Given**: Private entry with 3 active shares (ids: 1, 2, 3)
- **When**: Owner sends POST /api/v1/entries/{slug}/shares/revoke with {share_ids: [1, 3]}
- **Then**: Response 200, {revoked_count: 2}, shares 1 and 3 have revoked_at set, share 2 remains active
- **Assertions**: status_code==200, revoked_count==2, DB check: shares 1,3 revoked_at not null, share 2 revoked_at null

## TC-B33: Non-owner cannot revoke shares

- **BDD**: B24
- **File**: test_share_revoke.py
- **Given**: Private entry owned by Alice, Bob authenticated
- **When**: Bob sends POST /api/v1/entries/{slug}/shares/revoke
- **Then**: Response 403
- **Assertions**: status_code==403

## TC-B34: Revoking non-existent share ids is ignored

- **BDD**: B25
- **File**: test_share_revoke.py
- **Given**: Private entry with share ids [1, 2]
- **When**: Owner sends POST /api/v1/entries/{slug}/shares/revoke with {share_ids: [1, 999]}
- **Then**: Response 200, {revoked_count: 1}, share 1 revoked, share 999 ignored
- **Assertions**: status_code==200, revoked_count==1

## TC-B35: Revoking already-revoked shares is idempotent

- **BDD**: B25 (variant)
- **File**: test_share_revoke.py
- **Given**: Private entry with share id 1 already revoked
- **When**: Owner sends POST /api/v1/entries/{slug}/shares/revoke with {share_ids: [1]}
- **Then**: Response 200, {revoked_count: 0}
- **Assertions**: status_code==200, revoked_count==0

---

## TC-B36: Private→public auto-revokes all active shares

- **BDD**: B26
- **File**: test_share_lifecycle.py
- **Given**: Private entry with 3 active shares and 1 revoked share
- **When**: Owner updates entry with is_public=true
- **Then**: All 3 active shares have revoked_at set, already-revoked share unchanged, response includes revoked_shares: 3
- **Assertions**: PATCH response has revoked_shares==3, DB: 3 formerly-active shares now have revoked_at, 1 previously-revoked share unchanged

## TC-B37: Public→private preserves shares

- **BDD**: B27
- **File**: test_share_lifecycle.py
- **Given**: Public entry that was previously private and had shares (1 revoked during private→public)
- **When**: Owner updates entry with is_public=false
- **Then**: No shares modified, response does not include revoked_shares (or it is 0)
- **Assertions**: PATCH response revoked_shares is None or 0, DB: share records unchanged

## TC-B38: Deleting entry cascades to delete all shares

- **BDD**: B28
- **File**: test_share_lifecycle.py
- **Given**: Entry with 5 share records
- **When**: Entry is deleted
- **Then**: All 5 share records deleted (FK cascade)
- **Assertions**: After delete, SELECT COUNT(*) FROM entry_shares WHERE entry_id = ? == 0

## TC-B39: view_count increments atomically

- **BDD**: B29
- **File**: test_share_lifecycle.py
- **Given**: Share with max_views=100 and view_count=50
- **When**: 10 concurrent requests access the entry via this share token
- **Then**: view_count becomes 60 (not less, not more)
- **Assertions**: After concurrent access, view_count==60

## TC-B40: view_count only increments on ?share= access, not cookie access

- **BDD**: B29 (implicit — P2 §3.4 step 8)
- **File**: test_share_lifecycle.py
- **Given**: Share with view_count=1
- **When**: Access entry via cookie (no ?share= param)
- **Then**: view_count remains 1
- **Assertions**: view_count==1 after cookie-based access

## TC-B41: Share creation default expiry is 7d

- **BDD**: B01 (implicit — P0 user_decision #2)
- **File**: test_share_lifecycle.py
- **Given**: Owner creates share without specifying expires_in
- **When**: POST /api/v1/entries/{slug}/shares with {} (no expires_in)
- **Then**: expires_at ≈ now+7d
- **Assertions**: expires_at within 7d window

---

## TC-B42: Token comparison uses constant-time comparison

- **BDD**: B30
- **File**: test_share_security.py
- **Given**: Share token stored as SHA256 hash
- **When**: Backend verifies a provided token
- **Then**: Uses hmac.compare_digest (not plain ==)
- **Assertions**: Code inspection — verify_share_token uses hmac.compare_digest. Test by mocking hmac.compare_digest and verifying it is called.

## TC-B43: Token generation uses cryptographically secure randomness

- **BDD**: B31
- **File**: test_share_security.py
- **Given**: Request to create a share
- **When**: Token is generated
- **Then**: secrets.token_urlsafe(12) is used, token is 16 chars of URL-safe base64
- **Assertions**: Mock secrets.token_urlsafe, verify called with 12, verify output is 16 chars matching [A-Za-z0-9_-]+

## TC-B44: Referrer-Policy header set for share-accessed pages

- **BDD**: B32
- **File**: test_share_security.py
- **Given**: Page accessed via ?share={token}
- **When**: HTML response is returned
- **Then**: Response includes Referrer-Policy: no-referrer header
- **Assertions**: response.headers["referrer-policy"] == "no-referrer"

## TC-B45: Referrer-Policy NOT set for normal (non-share) access

- **BDD**: B32 (negative case)
- **File**: test_share_security.py
- **Given**: Page accessed without ?share= param
- **When**: Response is returned
- **Then**: Referrer-Policy is default (strict-origin-when-cross-origin), not no-referrer
- **Assertions**: response.headers["referrer-policy"] != "no-referrer" or absent

---

## BDD Traceability Matrix

| BDD | Test Case | File |
|-----|-----------|------|
| B01 | TC-B01, TC-B02, TC-B03 | test_share_create.py |
| B02 | TC-B04 | test_share_create.py |
| B03 | TC-B05 | test_share_create.py |
| B04 | TC-B06 | test_share_create.py |
| B05 | TC-B07 | test_share_create.py |
| B06 | TC-B09 | test_share_create.py |
| B07 | TC-B10, TC-B20, TC-B21, TC-B22 | test_share_access.py |
| B08 | TC-B11 | test_share_access.py |
| B09 | TC-B12 | test_share_access.py |
| B10 | TC-B13 | test_share_access.py |
| B11 | TC-B14 | test_share_access.py |
| B12 | TC-B15 | test_share_access.py |
| B13 | TC-B16 | test_share_access.py |
| B14 | TC-B17 | test_share_access.py |
| B15 | TC-B18 | test_share_access.py |
| B16 | TC-B19 | test_share_access.py |
| B17 | TC-B23 | test_share_cookie.py |
| B18 | TC-B24 | test_share_cookie.py |
| B19 | TC-B25, TC-B26, TC-B27 | test_share_cookie.py |
| B20 | TC-B28 | test_share_list.py |
| B21 | TC-B29, TC-B31 | test_share_list.py |
| B22 | TC-B30 | test_share_list.py |
| B23 | TC-B32 | test_share_revoke.py |
| B24 | TC-B33 | test_share_revoke.py |
| B25 | TC-B34, TC-B35 | test_share_revoke.py |
| B26 | TC-B36 | test_share_lifecycle.py |
| B27 | TC-B37 | test_share_lifecycle.py |
| B28 | TC-B38 | test_share_lifecycle.py |
| B29 | TC-B39, TC-B40 | test_share_lifecycle.py |
| B30 | TC-B42 | test_share_security.py |
| B31 | TC-B43 | test_share_security.py |
| B32 | TC-B44, TC-B45 | test_share_security.py |
| (implicit) | TC-B08, TC-B41 | test_share_create.py, test_share_lifecycle.py |

**Coverage**: 33/33 BDD conditions covered. 45 test cases total.
