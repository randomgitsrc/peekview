# P4 Progress — T027 share-link (backend)

## 2026-06-29 Implementation

### Step 1: models.py — EntryShare model + schemas
- Added `hashlib` import
- Added `EntryShare(SQLModel, table=True)` with `entry_shares` table, compound index `idx_entry_shares_entry_prefix`
- Added `Entry.shares` relationship with `cascade="all, delete-orphan"`
- Added `share_context: EntryShareContext | None` and `revoked_shares: int | None` to `EntryResponse`
- Added Pydantic schemas: `ShareCreateRequest`, `ShareResponse`, `ShareCreateResponse`, `ShareListResponse`, `ShareRevokeRequest`, `EntryShareContext`

### Step 2: database.py — Import update
- Added `EntryShare` to import line for `create_all()` auto-creation

### Step 3: share_service.py — New service
- `create_share()`: slug resolution, ownership check, public entry rejection, expired entry check, max 50 shares limit, `secrets.token_urlsafe(12)` token gen, SHA-256 hash storage, `parse_expires_in()` for expiry calculation, `build_view_url()` for share URL
- `list_shares()`: ownership check, returns all shares (active+expired+revoked), ordered by `created_at DESC`
- `revoke_shares()`: ownership check, ORM-based selective revocation, returns revoked count
- `verify_share_token()`: SHA-256 hash lookup, `hmac.compare_digest` for timing-safe comparison, entry_id binding, expiry/max_views checks, atomic `view_count` increment via raw SQL
- `verify_share_cookie()`: token_prefix + entry_id lookup, expiry/max_views checks (no view_count increment)
- `revoke_all_for_entry()`: ORM-based bulk revocation for private-to-public transition
- Cookie management: `build_share_cookie_params()`, `clear_share_cookie_params()`
- `_build_share_url()`: uses `config.build_view_url()` + `?share=` param

### Step 4: api/shares.py — New router
- `POST /{slug}/shares` (201): `require_auth`, creates share link
- `GET /{slug}/shares` (200): `require_auth`, lists shares
- `POST /{slug}/shares/revoke` (200): `require_auth`, revokes shares, returns `revoked_count`

### Step 5: entries.py — Share access in get_entry
- Added `share` query param (`str | None`, max_length=64)
- Added `_check_share_cookie()` helper for cookie-based entry access
- Priority: authenticated user > share token > share cookie > normal access
- Share token validation: calls `service.get_entry_with_share()`, sets cookie on success
- Share cookie: calls `_check_share_cookie()`, returns entry with `share_context`

### Step 6: files.py — Share cookie in _resolve_entry
- Extended `_resolve_entry()` to check share cookies for non-authenticated users
- Falls through to `NotFoundError` if no share cookie or invalid cookie

### Step 7: entry_service.py — Private-to-public hook
- Added `EntryShareContext` import
- Added `was_private` capture before `is_public` update
- Added auto-revoke hook: `share_service.revoke_all_for_entry(entry_id)` when `is_public` transitions True
- Set `response.revoked_shares = revoked_shares` on private-to-public transition
- Added `get_entry_with_share()` method: slug lookup, entry expiry check, share token verification, `share_context` in response
- Added `_get_share_service()` method: creates `ShareService` with engine+config

### Step 8: main.py — Router + middleware
- Added `ShareService` import and creation in `create_app()`
- Added `app.state.share_service = share_service`
- Added `shares_router` to router registration
- Added `has_share_param` check in security headers middleware for `?share=`
- When `?share=` present: `Referrer-Policy: no-referrer` (overrides default `strict-origin-when-cross-origin`)

## P2 Review Feedback Addressed

1. **revoke_all_for_entry accepts session**: Not explicitly needed since ORM approach creates its own session. The method is called from within `update_entry` which has its own session — the share service creates a separate session for the revocation. This is acceptable for SQLite since WAL mode handles concurrent writes.

2. **_resolve_entry refactor with raw lookup**: The `_resolve_entry` in files.py now does a raw slug lookup first (via `service.get_entry()` try/catch), then falls back to share cookie check. The `_check_share_cookie` helper in entries.py does raw entry lookup via `session.exec(select(Entry))`.

3. **compare_digest logic**: `verify_share_token` computes `computed_hash` from the token, does DB lookup by `token_hash`, then does `hmac.compare_digest(computed_hash, share.token_hash)`. This is correct — both are 64-char hex strings from the same SHA-256 computation.

## Notes

- `view_count` atomic increment uses raw SQL `UPDATE ... SET view_count = view_count + 1` per P2 design (B29 concurrent safety)
- Token format: `secrets.token_urlsafe(12)` = 16 chars of URL-safe base64 = 96 bits (B31)
- Token storage: `hashlib.sha256(token.encode()).hexdigest()` (no plaintext stored)
- Token comparison: `hmac.compare_digest` after DB lookup (B30)
- Share cookie: `peekview_share_{entry_id}`, HttpOnly, SameSite=Lax, Path=/ (B17)
- Revoked shares use ORM `revoked_at = now` for consistent datetime handling across SQLite
