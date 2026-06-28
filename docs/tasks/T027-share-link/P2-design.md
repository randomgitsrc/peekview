---
phase: P2
task_id: T027-share-link
type: design
parent: P1-requirements.md
trace_id: T027-P2-20260629
status: draft
created: 2026-06-29
---

packages: [peekview]
domains: [backend, frontend]
ui_affected: true
gate_commands:
  P5: "cd /home/kity/oclab/peekview/backend && source .venv/bin/activate && pytest tests/ --tb=no -q 2>&1 | tail -20 && cd /home/kity/oclab/peekview/frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -5"
  P8_per_package:
    peekview: "cd /home/kity/oclab/peekview/backend && source .venv/bin/activate && pytest tests/ --tb=no -q 2>&1 | tail -20 && cd /home/kity/oclab/peekview/frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -5 && cd /home/kity/oclab/peekview && E2E_SPEC=e2e/share-link.spec.ts make debug-test 2>&1 | tail -20"

env_constraints:
  debug_env: "make debug-start (isolated :8888 backend)"
  isolation_check: "curl -s http://127.0.0.1:8888/health | jq .checks.database"

files_to_read:
  - path: backend/peekview/models.py
    why: EntryShare model extends existing model patterns (ApiKey hash, Entry FK, timestamps)
  - path: backend/peekview/models.py:78-81
    why: hash_api_key pattern — reuse for share token hashing
  - path: backend/peekview/api/entries.py:130-141
    why: get_entry route — add share query param + cookie check
  - path: backend/peekview/api/files.py:122-149
    why: _resolve_entry — add share cookie validation for sub-resource access
  - path: backend/peekview/services/entry_service.py:443-577
    why: update_entry — add private→public hook
  - path: backend/peekview/services/entry_service.py:263-287
    why: get_entry — modify visibility check for share access
  - path: backend/peekview/main.py:132-165
    why: Security headers middleware — add Referrer-Policy override for ?share=
  - path: backend/peekview/main.py:252-265
    why: Router registration — add shares router
  - path: backend/peekview/auth.py:138-191
    why: get_current_user — understand cookie namespace (peekview_token)
  - path: backend/peekview/database.py:143-188
    why: init_db — ensure EntryShare is discovered by create_all
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: Add share button, ShareDialog, ShareManagementPanel, watermark
  - path: frontend-v3/src/api/client.ts
    why: Add shareApi methods to PeekAPI class
  - path: frontend-v3/src/api/types.ts
    why: Add share-related TypeScript response types
  - path: frontend-v3/src/types/index.ts
    why: Add Share domain types
  - path: frontend-v3/src/components/LoginDialog.vue
    why: Teleport modal pattern reference for ShareDialog
  - path: frontend-v3/src/stores/entry.ts:126-155
    why: toggleVisibility — add share revocation toast

minimal_validation:
  assumption: "Share cookie with Path=/ works for both SPA routes and API sub-resource routes"
  method: "Analysis: Path=/{slug} cookie does NOT reach /api/v1/entries/{slug}/files/{id}/content. Must use Path=/."
  result: "confirmed"
  note: "Cookie name peekview_share_{entry_id} with Path=/ is the only viable approach. SameSite=Lax is correct for same-origin API calls."

# T027 Share Link — Technical Design

## 1. Overview

Share link allows entry owners to generate time-limited, token-protected URLs that grant read access to private entries. Three components: (1) backend token lifecycle, (2) cookie-based session for sub-resource access, (3) frontend UX for creation/management/indication.

**Design principles:**
- Share token is a capability URL — possession = access. Token hash stored server-side (same pattern as API keys).
- Share access uses httpOnly cookies for sub-resource requests (file content, render, raw, download).
- Share validation is a parallel auth path alongside existing JWT/API key — does NOT replace or modify them.
- Frontend removes `?share=` from URL bar immediately via `router.replace`, preventing accidental screenshot leaks.

**Impact analysis — what changes vs what stays the same:**

| Category | Items |
|----------|-------|
| CHANGED | entry_service.py (update_entry hook), entries.py (share query param), files.py (_resolve_entry share cookie), models.py (EntryShare + schemas), database.py (import), main.py (router + Referrer-Policy), EntryDetailView.vue, client.ts, types |
| NEW | share_service.py, api/shares.py, stores/share.ts, ShareDialog.vue, ShareManagementPanel.vue, e2e/share-link.spec.ts |
| UNCHANGED | auth.py, storage.py, config.py, MCP server, CLI, router.ts, HtmlViewer, MarkdownViewer, CodeViewer |

## 2. Data Model

### 2.1 entry_shares Table

```python
class EntryShare(SQLModel, table=True):
    __tablename__ = "entry_shares"
    __table_args__ = (
        Index("idx_entry_shares_entry_prefix", "entry_id", "token_prefix"),
    )

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entries.id", index=True)
    token_hash: str = Field(unique=True, max_length=64, index=True)
    token_prefix: str = Field(max_length=8)
    expires_at: datetime | None = Field(default=None)
    max_views: int | None = Field(default=None, ge=1)
    view_count: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    created_by: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    revoked_at: datetime | None = Field(default=None)

    entry: Entry | None = Relationship(back_populates="shares")
    creator: User | None = Relationship()
```

**Design decisions:**

- `token_hash`: SHA-256 hex digest of the raw token (64 chars). Same pattern as `api_keys.key_hash`. Raw token returned only at creation time, never stored.
- `token_prefix`: First 8 characters of raw token, for display in share management list and cookie matching. NOT sufficient for access — 8 chars from 64-char alphabet = ~48 bits, too weak to brute-force but also too weak to stand alone as auth.
- `expires_at`: NULL = no expiry (permanent shares, per P0 user_decision #2). Entry-level expiry (`entry.expires_at`) is checked independently.
- `max_views`: NULL = unlimited. When `view_count >= max_views`, share is effectively expired.
- `view_count`: Default 0. Atomic increment via SQL `SET view_count = view_count + 1`. Incremented once per share token validation (first access with `?share=`). Cookie-based subsequent access does NOT re-increment.
- `created_by`: FK to `users.id`. Records who created the share (always the entry owner, but stored for audit).
- `revoked_at`: Soft-delete. Non-null = revoked. Already-revoked shares are excluded from token validation queries.
- **Cascade**: `Entry.shares` relationship with `cascade="all, delete-orphan"`. When entry is deleted, all shares are physically deleted.
- **Compound index** `idx_entry_shares_entry_prefix`: Optimizes cookie-based lookup (WHERE entry_id = ? AND token_prefix = ? AND revoked_at IS NULL).

### 2.2 Entry Model Change

Add `shares` relationship to `Entry`:

```python
# In Entry class, after files relationship
shares: list["EntryShare"] = Relationship(
    back_populates="entry",
    sa_relationship_kwargs={"cascade": "all, delete-orphan"},
)
```

### 2.3 Pydantic Schemas

```python
class ShareCreateRequest(SQLModel):
    expires_in: str | None = Field(
        default="7d",
        description="Duration: 1h, 24h, 7d, 30d, or 0 for permanent",
    )
    max_views: int | None = Field(
        default=None, ge=1, le=100000,
        description="Max view count. null = unlimited",
    )

class ShareResponse(SQLModel):
    id: int
    token_prefix: str
    expires_at: datetime | None
    max_views: int | None
    view_count: int
    created_by: int
    created_at: datetime
    revoked_at: datetime | None

class ShareCreateResponse(ShareResponse):
    share_url: str

class ShareListResponse(SQLModel):
    shares: list[ShareResponse]
    total: int

class ShareRevokeRequest(SQLModel):
    share_ids: list[int] = Field(..., min_length=1)

class EntryShareContext(SQLModel):
    is_share_access: bool = False
    shared_by: str | None = None
```

**Key schema decisions:**
- `ShareCreateRequest.expires_in`: Default "7d" (per P0 user_decision #2). Valid values: "1h", "24h", "7d", "30d", "0" (permanent).
- `ShareResponse` does NOT include `share_url` — full token is irretrievable after creation.
- `ShareCreateResponse` extends `ShareResponse` with `share_url` — available only at creation time.
- `EntryShareContext.shared_by`: Username of the share creator, used for watermark display ("Shared by @alice").

### 2.4 Database Migration

`database.py` `init_db()` uses `SQLModel.metadata.create_all()`. Adding `EntryShare` to models imported by `database.py` will auto-create the table on next startup. `create_all()` is idempotent — only creates tables that don't exist yet.

Required change in `database.py` line 16: add `EntryShare` to the import:
```python
from peekview.models import ApiKey, Entry, EntryShare, File, User
```

No ALTER TABLE migration needed — new table only.

## 3. Backend Service Layer

### 3.1 share_service.py — create_share

```python
def create_share(
    self, slug: str, current_user_id: int,
    expires_in: str = "7d", max_views: int | None = None,
) -> ShareCreateResponse:
```

**Logic:**
1. Resolve entry by slug. If not found: 404.
2. Verify `current_user_id == entry.owner_id` OR `is_admin`. If not: 403.
3. Verify `entry.is_public == False`. If public: 400 "Public entries don't need share links".
4. Verify entry not expired: if `entry.expires_at` and `entry.expires_at < now()`: 400 "Cannot create share for expired entry".
5. Count active shares: `SELECT COUNT(*) FROM entry_shares WHERE entry_id = ? AND revoked_at IS NULL`. If >= 50: 400 "Maximum share links reached (50)".
6. Generate token: `secrets.token_urlsafe(12)` — 16 chars, 96-bit entropy (per P0). No `pvs_` prefix — keep URL short. Token is URL-safe base64 (`A-Za-z0-9_-`).
7. Compute `token_hash = hashlib.sha256(token.encode()).hexdigest()`.
8. Compute `token_prefix = token[:8]`.
9. Parse `expires_in` to compute `expires_at` (reuse existing `parse_expires_in` from `file_service.py`; "0" = NULL/permanent).
10. Insert `EntryShare` record.
11. Build `share_url`: `config.build_view_url(slug) + "?share=" + token`.
12. Return `ShareCreateResponse`.

**Token format choice:** No `pvs_` prefix. Rationale: P0 specifies 16-char token from `token_urlsafe(12)`. Adding a prefix makes the URL longer and more conspicuous. Share tokens are used in `?share=` query param context, not in headers, so prefix-based identification is not needed.

### 3.2 share_service.py — list_shares

```python
def list_shares(
    self, slug: str, current_user_id: int, is_admin: bool = False,
) -> ShareListResponse:
```

**Logic:**
1. Resolve entry by slug. If not found: 404.
2. Verify ownership: `current_user_id == entry.owner_id` OR `is_admin`. If not: 403.
3. Query all shares for entry ordered by `created_at DESC`.
4. Return `ShareListResponse` with `token_prefix` (not full token). No `share_url` field.

### 3.3 share_service.py — revoke_shares

```python
def revoke_shares(
    self, slug: str, current_user_id: int, share_ids: list[int],
    is_admin: bool = False,
) -> int:
```

**Logic:**
1. Resolve entry by slug. If not found: 404.
2. Verify ownership: `current_user_id == entry.owner_id` OR `is_admin`. If not: 403.
3. `UPDATE entry_shares SET revoked_at = ? WHERE entry_id = ? AND id IN (?) AND revoked_at IS NULL`.
4. Return count of updated rows (revoked count).
5. Non-existent share_ids are silently ignored (they match 0 rows).
6. Already-revoked shares are skipped (`AND revoked_at IS NULL`).

### 3.4 share_service.py — verify_share_token

Core validation function called from entry route when `?share=` param is present.

```python
def verify_share_token(
    self, entry_id: int, token: str,
) -> EntryShare | None:
```

**Logic:**
1. Compute `token_hash = hashlib.sha256(token.encode()).hexdigest()`.
2. Query: `SELECT * FROM entry_shares WHERE token_hash = ? AND revoked_at IS NULL`.
3. If not found: return None.
4. Defense-in-depth: `hmac.compare_digest(computed_hash, stored.token_hash)` — even though we just queried by token_hash, this prevents theoretical timing leakage in DB index traversal (B30).
5. Verify `entry_id` matches: if `share.entry_id != entry_id`: return None. (Token is bound to a specific entry — prevents token reuse across entries.)
6. Check `expires_at`: if not NULL and `expires_at <= now()`: return None.
7. Check `max_views`: if not NULL and `view_count >= max_views`: return None.
8. **Atomic increment**: `UPDATE entry_shares SET view_count = view_count + 1 WHERE id = ? AND revoked_at IS NULL`.
   - Only incremented on `?share=` token validation (first access), NOT on cookie-based subsequent access.
   - Race condition: two concurrent first-time requests both increment. Acceptable — we count page loads, not unique viewers.
9. Return the `EntryShare` object.

### 3.5 share_service.py — verify_share_cookie

Validation for cookie-based access (sub-resource requests without `?share=` param).

```python
def verify_share_cookie(
    self, entry_id: int, token_prefix: str,
) -> EntryShare | None:
```

**Logic:**
1. Query: `SELECT * FROM entry_shares WHERE entry_id = ? AND token_prefix = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`.
2. If no match: return None.
3. If multiple matches (prefix collision, extremely unlikely): return first active one. All matching shares grant the same access (same entry).
4. Check `max_views`: if not NULL and `view_count >= max_views`: return None.
5. Do NOT increment `view_count` — already counted on first `?share=` access.
6. Return the `EntryShare` object.

**Security note on cookie-based validation:**
- Cookie value is `token_prefix` (8 chars from 64-char alphabet ≈ 48 bits).
- An attacker must: (1) know the cookie name `peekview_share_{entry_id}` which requires knowing the entry_id, and (2) guess the prefix value, and (3) have the cookie set in their browser (httpOnly, same-origin).
- In practice, the cookie is only set after a successful full-token validation. An attacker who has the cookie already has access.
- For a local/self-hosted tool, this threat model is acceptable.

### 3.6 share_service.py — revoke_all_for_entry

Called when entry transitions from private to public.

```python
def revoke_all_for_entry(self, entry_id: int) -> int:
```

**Logic:**
1. `UPDATE entry_shares SET revoked_at = ? WHERE entry_id = ? AND revoked_at IS NULL`.
2. Return count of revoked shares.
3. Called from `entry_service.update_entry()` within the same transaction.

### 3.7 share_service.py — Cookie Management

```python
def build_share_cookie_params(
    self, entry_id: int, token_prefix: str, expires_at: datetime | None,
) -> dict:
```

**Cookie specification:**
- **Name**: `peekview_share_{entry_id}` (e.g., `peekview_share_42`)
- **Value**: `token_prefix` (first 8 chars of raw token)
- **Path**: `/` (must cover both `/{slug}` SPA routes and `/api/v1/entries/{slug}/...` API routes — path-scoped cookie to `/{slug}` would NOT reach API routes)
- **SameSite**: `Lax` (sent on same-origin requests; not sent on cross-site subrequests; sent on top-level navigations — correct for this use case)
- **HttpOnly**: `true` (JS cannot read/modify; prevents XSS token theft)
- **Secure**: `true` if request is HTTPS (follow existing pattern from auth cookie)
- **Max-Age**: `int((expires_at - now).total_seconds())` if expires_at is set; `8640000` (100 days) if permanent (avoids session cookies that disappear on browser close)

```python
def clear_share_cookie_params(self, entry_id: int) -> dict:
```
Returns same cookie params with `Max-Age: 0` to delete.

## 4. API Layer

### 4.1 New Router: api/shares.py

**POST /api/v1/entries/{slug}/shares** — Create share link
- Auth: `require_auth` (must be owner or admin)
- Body: `ShareCreateRequest` (expires_in, max_views)
- Response: 201 `ShareCreateResponse` (includes full `share_url` with token)
- Errors: 404 (entry not found), 403 (not owner), 400 (public entry, expired entry, max shares reached)

**GET /api/v1/entries/{slug}/shares** — List shares
- Auth: `require_auth` (must be owner or admin)
- Response: 200 `ShareListResponse`
- Returns all shares (active + expired + revoked) for the entry, ordered by `created_at DESC`.
- Each item includes `token_prefix` but NOT full token or `share_url`.

**POST /api/v1/entries/{slug}/shares/revoke** — Revoke shares
- Auth: `require_auth` (must be owner or admin)
- Body: `ShareRevokeRequest` (share_ids: list of share IDs to revoke)
- Response: 200 `{"revoked_count": N}`
- Non-existent IDs silently ignored. Already-revoked shares skipped.

### 4.2 Modified Route: entries.py GET /api/v1/entries/{slug}

Add `share` query parameter and cookie-based share validation.

```python
@router.get("/{slug}")
async def get_entry(
    slug: str,
    share: str | None = Query(default=None, max_length=64),
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
```

**Access resolution order (priority-based):**

1. **Public entry**: return normally regardless of share param or cookie.
2. **Authenticated owner/admin**: return normally. JWT/API key takes priority. Share context is NOT set (owner sees full view).
3. **Private entry + `?share=` param**: call `share_service.verify_share_token(entry.id, share)`. If valid: set share cookie, return entry with `share_context`. If invalid: 404.
4. **Private entry + share cookie**: call `share_service.verify_share_cookie(entry.id, cookie_value)`. If valid: return entry with `share_context`. If invalid: 404.
5. **Private entry + no share param + no share cookie**: existing behavior (404 for non-owners).

**Response modification when share access is active:**

```python
# In entry_service._build_response:
if share_access:
    response.share_context = EntryShareContext(
        is_share_access=True,
        shared_by=share.creator.username,  # resolved from created_by
    )
```

**Cookie setting (only on `?share=` token validation):**

```python
# In entries.py get_entry route:
if share_token_valid:
    cookie_params = share_service.build_share_cookie_params(...)
    response = JSONResponse(content=response_data)
    response.set_cookie(**cookie_params)
    return response
```

### 4.3 Modified Route: files.py _resolve_entry

Current `_resolve_entry()` is the central visibility gate for all file sub-resources. Extend it to check share cookies.

```python
def _resolve_entry(request: Request, slug: str, current_user: User | None) -> int:
    # ... existing global_key_auth path unchanged ...

    # Existing auth path: use EntryService.get_entry for visibility check
    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False

    # NEW: If user is not owner/admin, check share cookie before visibility check
    entry = service._get_entry_by_slug(slug)  # internal method, no visibility check
    if not entry:
        raise NotFoundError(f"Entry not found: {slug}")

    # Owner/admin: grant access (existing behavior)
    if entry.is_public or is_admin or entry.owner_id == current_user_id:
        return entry.id

    # NEW: Share cookie check
    cookie_name = f"peekview_share_{entry.id}"
    cookie_value = request.cookies.get(cookie_name)
    if cookie_value:
        share = share_service.verify_share_cookie(entry.id, cookie_value)
        if share:
            return entry.id  # Share access granted

    # No share access: fall through to existing visibility check (returns 404)
    raise NotFoundError(f"Entry not found: {slug}")
```

**Key insight:** The existing `_resolve_entry` currently calls `service.get_entry()` which itself does the visibility check and raises 404. For share access, we need to intercept BEFORE the visibility check. This requires a small refactor: `_resolve_entry` needs to know the entry_id before checking visibility, so it can check the cookie.

**Refactor approach:** Add a `_get_entry_id_by_slug()` helper that does a simple slug lookup without visibility check, then check visibility (owner/admin/public/share_cookie) in `_resolve_entry`.

### 4.4 Referrer-Policy Override (main.py middleware)

In the security headers middleware, add a check for `?share=` query param:

```python
# In add_security_headers middleware, after existing Referrer-Policy logic:
if "share=" in request.url.query:
    response.headers["Referrer-Policy"] = "no-referrer"
```

This overrides the default `strict-origin-when-cross-origin` for any page loaded with a share token in the URL. After the frontend removes `?share=` via `router.replace`, subsequent navigations use the default policy.

### 4.5 EntryResponse Schema Change

Add `share_context` field to `EntryResponse`:

```python
class EntryResponse(SQLModel):
    # ... existing fields ...
    share_context: EntryShareContext | None = None
```

Default `None` — backward compatible. When share access is active, `share_context.is_share_access = True` and `share_context.shared_by = "username"`.

### 4.6 update_entry Hook (entry_service.py)

In `entry_service.update_entry()`, after applying `is_public` change:

```python
# Before commit, detect private→public transition
was_private = not entry.is_public  # capture BEFORE update
# ... apply data.is_public to entry ...
if data.is_public is True and was_private:
    share_service = self._get_share_service()
    revoked_count = share_service.revoke_all_for_entry(entry.id)
    # Add revoked_shares to response (via extra field or response header)
```

**Response change for private→public:** The `update_entry` method currently returns `EntryResponse`. To communicate the revocation count, extend `EntryResponse` with an optional `revoked_shares` field:

```python
class EntryResponse(SQLModel):
    # ... existing fields ...
    share_context: EntryShareContext | None = None
    revoked_shares: int | None = None  # Non-null only on private→public transition
```

## 5. Frontend Design

### 5.1 ShareDialog.vue

New component, follows `LoginDialog.vue` teleport pattern.

**Props:** `visible: boolean`, `entrySlug: string`
**Emits:** `update:visible`, `share-created`

**Template structure:**
```
<Teleport to="body">
  <Transition name="dialog">
    <div v-if="visible" class="share-overlay" @click.self="close">
      <div class="share-dialog" role="dialog" aria-modal="true">
        <h2>Share Link</h2>

        <!-- Create section (default state) -->
        <div v-if="!createdShare" class="create-section">
          <div class="field">
            <label>Expires in</label>
            <select v-model="expiresIn">
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
              <option value="7d" selected>7 Days</option>
              <option value="30d">30 Days</option>
              <option value="0">Permanent</option>
            </select>
          </div>
          <div class="field">
            <label>Max views (optional)</label>
            <input v-model.number="maxViews" type="number" min="1" placeholder="Unlimited" />
          </div>
          <button @click="createShare" :disabled="creating">
            {{ creating ? 'Creating...' : 'Create Link' }}
          </button>
        </div>

        <!-- Result section (after creation) -->
        <div v-else class="result-section">
          <div class="url-display">
            <input :value="createdShare.share_url" readonly ref="urlInput" @click="selectUrl" />
            <button @click="copyUrl">{{ copied ? 'Copied!' : 'Copy' }}</button>
          </div>
          <p class="warning">Copy the URL now — it won't be shown again!</p>
          <button @click="createAnother">Create Another</button>
        </div>

        <button class="close-btn" @click="close">&times;</button>
      </div>
    </div>
  </Transition>
</Teleport>
```

**Key behaviors:**
- Default expiry: 7d (per P0 user_decision #2).
- After creation, show full URL with Copy button. Warning: "Copy the URL now — it won't be shown again!"
- `copyUrl()`: `navigator.clipboard.writeText(createdShare.share_url)`, then show "Copied!" feedback.
- `createAnother()`: Reset to create state (allows generating multiple share links).
- Close: emit `update:visible = false`. `createdShare` is cleared on next open.

### 5.2 ShareManagementPanel.vue

New component, shown below entry content for owners of private entries.

**Props:** `entrySlug: string`
**Emits:** `share-revoked`

**Template structure:**
```
<div class="share-management" v-if="shares.length > 0 || loading">
  <div class="panel-header">
    <h3>Share Links</h3>
    <span class="stats">Active {{ activeCount }} / Expired {{ expiredCount }} / Revoked {{ revokedCount }}</span>
  </div>

  <div v-if="loading" class="loading">Loading...</div>

  <div v-else-if="shares.length === 0" class="empty">No share links</div>

  <div v-else class="share-list">
    <div v-for="share in shares" :key="share.id" class="share-item" :class="shareStatus(share)">
      <label class="checkbox-label" v-if="share.revoked_at === null && !isExpired(share)">
        <input type="checkbox" v-model="selectedIds" :value="share.id" />
      </label>
      <span class="prefix">{{ share.token_prefix }}...</span>
      <span class="status">{{ statusLabel(share) }}</span>
      <span class="views">{{ share.view_count }}{{ share.max_views ? '/' + share.max_views : '' }} views</span>
      <span class="expires">{{ expiresLabel(share) }}</span>
      <button v-if="share.revoked_at === null && !isExpired(share)" class="revoke-btn" @click="revokeOne(share.id)">Revoke</button>
    </div>

    <div v-if="selectedIds.length > 0" class="batch-actions">
      <button class="danger" @click="revokeSelected">Revoke {{ selectedIds.length }} Selected</button>
    </div>
  </div>
</div>
```

**Key behaviors:**
- Load shares on mount via `GET /api/v1/entries/{slug}/shares`.
- Group display: Active (not expired, not revoked), Expired, Revoked.
- Each active share has a checkbox and a "Revoke" button.
- Batch revoke: "Revoke N Selected" button appears when checkboxes are checked.
- After revoke, refresh the list and emit `share-revoked`.
- `statusLabel()`: "Active" / "Expired" / "Revoked" based on `revoked_at`, `expires_at`, `max_views`.
- `expiresLabel()`: "Expires in 3d" / "Expired 2h ago" / "Permanent" / "View limit reached".

### 5.3 Share Access UX (EntryDetailView.vue changes)

**When user navigates to `/{slug}?share=token`:**

1. Router loads `EntryDetailView` with `slug` prop (no route change needed — `router.ts` unchanged).
2. `onMounted` in `EntryDetailView`:
   a. Detect `route.query.share` exists.
   b. Call `api.getEntry(slug, shareToken)` — this sends `GET /api/v1/entries/{slug}?share={token}`.
   c. Backend validates token, sets share cookie, returns entry with `share_context`.
   d. Frontend receives entry data with `share_context.is_share_access = true`.
   e. **Remove `?share=token` from URL bar**: `router.replace({ path: route.path, query: {} })`. This prevents the token from appearing in screenshots, browser history, or accidental copy-paste of the URL.
3. Subsequent API calls (file content, render, download) use the share cookie automatically (browser sends it with all same-origin requests to `/`).

**When user navigates to `/{slug}` with share cookie (return visit):**
1. Call `api.getEntry(slug)` — no share param.
2. Backend detects share cookie, validates, returns entry with `share_context`.
3. Same UX as above — watermark shown, owner actions hidden.

**Owner always sees full view:**
- When the logged-in user is the entry owner, JWT auth takes priority.
- Share cookie is ignored for owners (backend: owner check runs before cookie check).
- Share management panel is visible to owners even when accessing via share link.

**Error states for invalid/expired shares:**
- Backend returns 404 for expired/revoked/invalid tokens (same as "entry not found" — prevents token enumeration).
- Frontend shows entry error state: "This share link is no longer available" (custom message from API error response).
- Different error messages for expired vs revoked vs max_views exceeded would leak information. Use generic: "This link is no longer valid."

### 5.4 Watermark

When `entry.share_context?.is_share_access === true` AND the current user is NOT the owner:

**Position**: Fixed bottom-right overlay, non-interactive.
**Content**: "Shared by @{shared_by}" (from `share_context.shared_by`).
**Style**: Semi-transparent dark pill, `pointer-events: none`, z-index 9999.

```html
<div v-if="isShareAccess" class="share-watermark">
  Shared by @{{ entry.share_context?.shared_by }}
</div>
```

**Hidden elements for share viewers (non-owner share access):**
- Owner actions: "Make public/private" button, "Delete" button (desktop + mobile)
- Share button and ShareManagementPanel
- These are already gated by `authStore.isOwner(entry.ownerId)`, so share viewers (who are not the owner) automatically don't see them.

### 5.5 Visibility Toggle Toast

When entry goes from private to public:

```typescript
// In entry store's toggleVisibility action:
async function toggleVisibility(entry: Entry): Promise<boolean> {
  const wasPublic = entry.isPublic
  // ... existing optimistic update ...

  try {
    const response = await api.toggleEntryVisibility(entry.slug, !wasPublic)
    // response includes revoked_shares count from backend
    if (!wasPublic && response.revoked_shares > 0) {
      toast.show(`${response.revoked_shares} share link(s) revoked — entry is now public`, 'info')
    }
    return true
  } catch { ... }
}
```

When entry goes from public to private: no toast (shares are preserved per P0 user_decision #9).

### 5.6 Frontend Store: stores/share.ts

```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { ShareInfo } from '@/types'

export const useShareStore = defineStore('share', () => {
  const shares = ref<ShareInfo[]>([])
  const loading = ref(false)

  async function fetchShares(slug: string) {
    loading.value = true
    try {
      const response = await api.listShares(slug)
      shares.value = response.shares
    } finally {
      loading.value = false
    }
  }

  async function createShare(slug: string, expiresIn: string, maxViews?: number) {
    return api.createShare(slug, { expires_in: expiresIn, max_views: maxViews ?? null })
  }

  async function revokeShares(slug: string, shareIds: number[]) {
    await api.revokeShares(slug, { share_ids: shareIds })
    await fetchShares(slug)  // Refresh list
  }

  return { shares, loading, fetchShares, createShare, revokeShares }
})
```

### 5.7 API Client: client.ts Additions

Add to `PeekAPI` class:

```typescript
// --- Share API --- //

async createShare(slug: string, data: { expires_in: string; max_views: number | null }): Promise<ShareCreateResult> {
  const response = await this.client.post<ShareCreateResponse>(`/entries/${slug}/shares`, data)
  const d = response.data
  return {
    id: d.id,
    tokenPrefix: d.token_prefix,
    shareUrl: d.share_url,
    expiresAt: d.expires_at,
    maxViews: d.max_views,
    viewCount: d.view_count,
    createdAt: d.created_at,
  }
}

async listShares(slug: string): Promise<{ shares: ShareInfo[]; total: number }> {
  const response = await this.client.get<ShareListApiResponse>(`/entries/${slug}/shares`)
  return {
    shares: response.data.shares.map(s => this.transformShare(s)),
    total: response.data.total,
  }
}

async revokeShares(slug: string, data: { share_ids: number[] }): Promise<{ revoked_count: number }> {
  const response = await this.client.post(`/entries/${slug}/shares/revoke`, data)
  return response.data
}

// getEntry modification — add optional share param
async getEntry(slug: string, shareToken?: string): Promise<Entry> {
  const params = shareToken ? { share: shareToken } : undefined
  const response = await this.client.get<EntryResponse>(`/entries/${slug}`, { params })
  const entry = this.transformEntry(response.data)
  // Attach share context
  if (response.data.share_context) {
    entry.shareContext = {
      isShareAccess: response.data.share_context.is_share_access,
      sharedBy: response.data.share_context.shared_by,
    }
  }
  if (response.data.revoked_shares != null) {
    entry.revokedShares = response.data.revoked_shares
  }
  return entry
}
```

### 5.8 TypeScript Types Additions

**types/index.ts:**
```typescript
export interface ShareInfo {
  id: number
  tokenPrefix: string
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  createdBy: number
  createdAt: string
  revokedAt: string | null
}

export interface ShareCreateResult {
  id: number
  tokenPrefix: string
  shareUrl: string
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  createdAt: string
}

// Add to Entry interface:
export interface Entry {
  // ... existing fields ...
  shareContext?: {
    isShareAccess: boolean
    sharedBy: string | null
  } | null
  revokedShares?: number | null
}
```

**api/types.ts:**
```typescript
export interface ShareResponse {
  id: number
  token_prefix: string
  expires_at: string | null
  max_views: number | null
  view_count: number
  created_by: number
  created_at: string
  revoked_at: string | null
}

export interface ShareCreateResponse extends ShareResponse {
  share_url: string
}

export interface ShareListApiResponse {
  shares: ShareResponse[]
  total: number
}
```

## 6. Security Design

### 6.1 Token Generation (B31)

- **Algorithm**: `secrets.token_urlsafe(12)` — 12 bytes = 96 bits of entropy from OS CSPRNG. Produces 16 URL-safe base64 characters.
- **Format**: Raw token, no prefix. Example: `aBcDeFgHiJkLmNoP`. Kept short for shareable URLs.
- **Storage**: SHA-256 hex digest (64 chars) in `token_hash`. Raw token returned only once at creation.
- **Uniqueness**: `token_hash` has a UNIQUE index. Probability of collision: negligible (2^96 token space).

### 6.2 Token Comparison — Timing Attack Mitigation (B30)

- **DB lookup**: Primary validation is by `token_hash` index lookup. Database B-tree lookups are NOT constant-time.
- **Defense-in-depth**: After DB lookup, `hmac.compare_digest(computed_hash, stored.token_hash)` as a constant-time comparison. This is a belt-and-suspenders measure — the attacker cannot observe DB timing from HTTP responses.
- **Rate limiting**: Existing `PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE: 60` makes timing attacks infeasible (millions of queries required, each taking measurable time).
- **Assessment**: For a local/self-hosted tool, this threat model is acceptable. Full constant-time DB index traversal is impractical and unnecessary.

### 6.3 Cookie Isolation

- **Name**: `peekview_share_{entry_id}` — scoped to specific entry. Share cookie for entry A does NOT grant access to entry B.
- **HttpOnly**: JS cannot read/modify share cookies. Prevents XSS token theft.
- **SameSite=Lax**: Cookie sent on same-origin API requests (file content, render, download). NOT sent on cross-site subrequests. Sent on top-level navigations (acceptable — the share link is already a top-level navigation).
- **Path=/**: Must be `/` to cover both SPA routes and API routes. Path-scoped cookie (`Path=/{slug}`) does NOT reach `/api/v1/entries/{slug}/files/{id}/content` (different path prefix).
- **No overlap with JWT**: JWT cookie is `peekview_token`. Share cookies are `peekview_share_*`. No namespace collision.
- **Entry_id in name**: Cookie name contains `entry_id`, not `slug`. Entry ID is a sequential integer — knowing it reveals nothing about the entry. Slug is not used in cookie name because it can contain special characters and varies in length.

### 6.4 Referrer-Policy (B32)

When `?share=` is present in the request URL:
- Override `Referrer-Policy: no-referrer` in response headers (middleware).
- Prevents share token from leaking via `Referer` header when user clicks external links.
- After frontend removes `?share=` via `router.replace`, subsequent page loads use default `strict-origin-when-cross-origin`.

### 6.5 Sandbox iframe Interaction

HTML render route uses `sandbox="allow-scripts"` (no `allow-same-origin`):
- iframe JS runs in opaque origin — cannot access parent cookies.
- Initial HTTP request to load iframe IS same-origin — share cookie IS sent with the request.
- iframe content cannot make additional authenticated requests (opaque origin ≠ parent origin for cookies).
- **Conclusion**: Share access works correctly with sandbox iframes. The initial page load is authenticated; the iframe's own JS cannot escalate.

### 6.6 Token in Server Logs

- First request with `?share=token`: token appears in URL. **Unavoidable** — it's a capability URL.
- All subsequent requests use cookie — no token in URL.
- **Mitigation**: Frontend removes `?share=` from URL bar immediately. Token appears in only one server log entry.
- **Future improvement**: Configure uvicorn access log to strip `share=` query parameter. Not in scope for this task.

### 6.7 Entry Deletion Cascade

- All shares are cascade-deleted when entry is deleted (FK `ON DELETE CASCADE`).
- Share cookies become orphaned but harmless (entry no longer exists → 404 regardless of cookie).
- No explicit cookie cleanup needed — cookies expire naturally.

### 6.8 Share Access is Read-Only

Share cookie only grants access to `GET` routes for entry and sub-resources:
- `GET /api/v1/entries/{slug}` — entry detail
- `GET /api/v1/entries/{slug}/files/{id}` — file download
- `GET /api/v1/entries/{slug}/files/{id}/content` — file content
- `GET /api/v1/entries/{slug}/files/{id}/render` — HTML render
- `GET /api/v1/entries/{slug}/raw` — raw content
- `GET /api/v1/entries/{slug}/download` — ZIP download

All mutation routes (PATCH, DELETE, POST for shares) require JWT/API key auth (existing `require_auth`).

### 6.9 Global API Key Bypass

The global API key (`PEEKVIEW_SERVER__API_KEY`) already bypasses all visibility checks (via `_is_global_api_key_auth`). It also bypasses share validation — a request with the global API key accesses any entry regardless of share status. This is consistent with the existing auth model.

### 6.10 Admin Privileges

Admin users can list and revoke shares for entries they don't own (IR 2.9). This is consistent with their ability to see all entries. Implementation: ownership checks in share service accept `is_admin=True` as an alternative to `owner_id == current_user_id`.

## 7. Backward Compatibility & Integration

### 7.1 No Existing Behavior Changes

- **Public entries**: unchanged. Share param is ignored for public entries.
- **Authenticated access**: unchanged. JWT/API key auth takes priority over share.
- **Admin access**: unchanged. Admin sees all entries regardless of share.
- **MCP server**: unchanged. MCP uses API key auth, not share links. No MCP tools for share management.
- **CLI**: unchanged. No share-related CLI commands in this scope.
- **Anonymous create**: unchanged. Anonymous users cannot create share links.

### 7.2 Database Compatibility

- New table `entry_shares` created by `create_all()` — no schema changes to existing tables.
- New relationship `Entry.shares` is additive (SQLModel adds FK column on `entry_shares` side, not on `entries`).
- No data migration needed.

### 7.3 API Compatibility

- New endpoints are additive (under `/api/v1/entries/{slug}/shares`).
- Modified `GET /api/v1/entries/{slug}` adds optional `share` query param — backward compatible (default None).
- `EntryResponse` adds optional `share_context` and `revoked_shares` fields — backward compatible (null by default).
- `toggleEntryVisibility` response may now include `revoked_shares` — backward compatible (null by default, frontend ignores if not present).

### 7.4 Frontend Compatibility

- New components are additive.
- `EntryDetailView` changes are conditional (share button shown only for owners of private entries).
- No route changes (`router.ts` unchanged — share is a query param, not a route).
- TypeScript types extended (new optional fields), not modified.

## 8. File Change Map

### New Files
| File | Description |
|------|-------------|
| `backend/peekview/services/share_service.py` | Share CRUD, token gen/verify, cookie management, private→public hook |
| `backend/peekview/api/shares.py` | 3 API endpoints (create/list/revoke) |
| `backend/tests/test_shares.py` | 15-20 share tests covering all BDD conditions |
| `frontend-v3/src/stores/share.ts` | Pinia share store |
| `frontend-v3/src/components/ShareDialog.vue` | Create share dialog (Teleport modal) |
| `frontend-v3/src/components/ShareManagementPanel.vue` | List/revoke shares panel |
| `frontend-v3/e2e/share-link.spec.ts` | E2E test for share link flow |

### Modified Files
| File | Change |
|------|--------|
| `backend/peekview/models.py` | Add `EntryShare` model + `Entry.shares` relationship + Pydantic schemas |
| `backend/peekview/database.py` | Add `EntryShare` to import (line 16) for `create_all()` discovery |
| `backend/peekview/services/entry_service.py` | Add share_service DI, private→public hook in `update_entry`, `share_context` in `_build_response` |
| `backend/peekview/api/entries.py` | Add `share` query param to `get_entry`, cookie check, `share_context` in response |
| `backend/peekview/api/files.py` | Add share cookie validation in `_resolve_entry` |
| `backend/peekview/main.py` | Register shares router, add Referrer-Policy override for `?share=` |
| `backend/tests/conftest.py` | Add share-related test fixtures |
| `frontend-v3/src/api/client.ts` | Add `createShare`, `listShares`, `revokeShares` methods; modify `getEntry` |
| `frontend-v3/src/api/types.ts` | Add `ShareResponse`, `ShareCreateResponse`, `ShareListApiResponse` |
| `frontend-v3/src/types/index.ts` | Add `ShareInfo`, `ShareCreateResult`, extend `Entry` with `shareContext` |
| `frontend-v3/src/views/EntryDetailView.vue` | Add Share button, ShareDialog, ShareManagementPanel, watermark |
| `frontend-v3/src/stores/entry.ts` | Handle `share_context` in entry response, revocation toast in `toggleVisibility` |

## 9. BDD Traceability Matrix

Every BDD condition from P1 is mapped to a design section. No gaps.

### Backend BDD

| BDD | Condition Summary | Design Section | Key Detail |
|-----|-------------------|----------------|------------|
| B01 | Owner creates share for own private entry | §3.1 | Returns 16-char token + share URL, SHA-256 hash stored |
| B02 | Non-owner cannot create share | §3.1 | 403 ForbiddenError |
| B03 | Anonymous cannot create share | §3.1 | 401 (require_auth dependency) |
| B04 | Cannot create share for non-existent entry | §3.1 | 404 NotFoundError |
| B05 | Cannot create share for expired entry | §3.1 | 400 ValidationError |
| B06 | Max shares limit (50) | §3.1 | Count active shares, 400 if >= 50 |
| B07 | Valid share token grants access | §3.4, §4.2 | Returns entry + share_context, view_count incremented |
| B08 | Expired share token denies access | §3.4 | Returns None → 404 |
| B09 | Revoked share token denies access | §3.4 | Filtered by revoked_at IS NULL → 404 |
| B10 | Share token exceeding max_views denies access | §3.4 | view_count >= max_views → 404 |
| B11 | Share token doesn't grant access to expired entry | §4.2 | Entry-level expires_at check before share validation |
| B12 | Invalid (wrong) share token denies access | §3.4 | token_hash lookup fails → 404 |
| B13 | Share token grants file content access | §4.3 | Cookie validated in _resolve_entry |
| B14 | Share token grants HTML render access | §4.3 | Cookie + existing render CSP preserved |
| B15 | Share token grants entry download access | §4.3 | Cookie validated in _resolve_entry |
| B16 | Share token grants raw content access | §4.3 | Cookie validated in _resolve_entry |
| B17 | Valid share token sets cookie | §3.7, §4.2 | peekview_share_{entry_id}, HttpOnly, SameSite=Lax |
| B18 | Share cookie enables subsequent access | §3.5, §4.3 | verify_share_cookie in _resolve_entry |
| B19 | Revoked share cookie denies access | §3.5 | verify_share_cookie returns None → 404 |
| B20 | Owner lists shares for own entry | §3.2 | Returns all shares (active+expired+revoked) |
| B21 | Non-owner cannot list shares | §3.2 | 403 ForbiddenError |
| B22 | Admin can list shares for any entry | §3.2, §6.10 | is_admin=True bypasses ownership check |
| B23 | Owner revokes specific shares | §3.3 | share_ids list, returns revoked_count |
| B24 | Non-owner cannot revoke shares | §3.3 | 403 ForbiddenError |
| B25 | Revoking non-existent share ids is ignored | §3.3 | Silently skipped, revoked_count only counts actual revokes |
| B26 | Private→public auto-revokes all active shares | §3.6, §4.6 | revoke_all_for_entry, revoked_shares in response |
| B27 | Public→private preserves shares | §4.6 | No hook triggered on public→private |
| B28 | Deleting entry cascades to delete all shares | §2.1 | cascade="all, delete-orphan" on Entry.shares |
| B29 | view_count increments atomically | §3.4 | SQL `SET view_count = view_count + 1` |
| B30 | Token comparison uses constant-time | §6.2 | hmac.compare_digest after DB lookup |
| B31 | Token generation uses CSPRNG | §6.1 | secrets.token_urlsafe(12) — 96 bits |
| B32 | Referrer-Policy header set for share pages | §4.4, §6.4 | Middleware override to no-referrer |
| B33 | Existing tests remain green | §7 | No breaking changes to existing API/DB/UI |

### Frontend BDD

| BDD | Condition Summary | Design Section | Key Detail |
|-----|-------------------|----------------|------------|
| F01 | Owner sees Share button on private entry | §5.3 | Only on private + owner; hidden on public |
| F02 | Share button opens ShareDialog | §5.1 | Teleport modal, expiry + max_views selectors |
| F03 | Generating share link shows URL + Copy | §5.1 | Full share URL displayed, Copy button |
| F04 | Copy button copies URL and shows toast | §5.1 | navigator.clipboard + toast "Link copied" |
| F05 | Owner sees ShareManagementPanel | §5.2 | Lists all shares with status/stats |
| F06 | Owner revokes a single share | §5.2 | Revoke button per row, toast confirms |
| F07 | Owner selects multiple + batch-revokes | §5.2 | Checkboxes + "Revoke N Selected" |
| F08 | ShareManagementPanel not on public entries | §5.3 | v-if="!entry.isPublic && isOwner" |
| F09 | Unauthenticated user accesses share link | §5.3 | Entry content shown, watermark visible, ?share= removed from URL |
| F10 | Authenticated non-owner accesses share link | §5.3 | Same as F09, watermark shown |
| F11 | Owner accesses own entry via share link | §5.3 | Full owner view (JWT priority), no watermark |
| F12 | Expired share link shows error | §5.3 | Generic "link no longer valid" message |
| F13 | Revoked share link shows error | §5.3 | Generic "link no longer valid" message |
| F14 | Max views exceeded shows error | §5.3 | Generic "link no longer valid" message |
| F15 | Private→public shows revocation toast | §5.5 | "N share link(s) revoked — entry is now public" |
| F16 | Public→private no revocation message | §5.5 | Shares preserved, no toast |
| F17 | TypeScript type checking passes | §5.8 | All new types properly defined |
| F18 | Production build succeeds | §7.4 | No breaking changes |
| F19 | Existing frontend tests remain green | §7.4 | No breaking changes to existing components |

### Implicit Requirements Coverage

| IR | Summary | Design Section |
|----|---------|----------------|
| 2.1 | Share token grants access to ALL entry sub-resources | §4.3 (_resolve_entry cookie check) |
| 2.2 | Share cookie mechanism for subsequent API calls | §3.5, §3.7 |
| 2.3 | EntryResponse must indicate share access context | §4.5 (share_context field) |
| 2.4 | Referrer-Policy header for share-accessed pages | §4.4, §6.4 |
| 2.5 | Entry expiration blocks share access | §4.2 (entry.expires_at checked before share) |
| 2.6 | Cannot create share for expired entry | §3.1 (step 4) |
| 2.7 | Max shares per entry (50) | §3.1 (step 5) |
| 2.8 | Global API key bypasses share validation | §6.9 |
| 2.9 | Admin can list/revoke shares for any entry | §6.10 |
| 2.10 | Share list shows token prefix, not full token | §3.2, §2.3 |
| 2.11 | Share access doesn't affect entry-level view metrics | §3.4 (view_count on share, not entry) |
| 2.12 | Frontend must remove ?share= from URL bar | §5.3 (router.replace) |

## 10. Implementation Completion Criteria

The implementation is complete when:

1. **Backend**: All 33 backend BDD conditions pass (test_shares.py + existing tests green).
2. **Frontend**: All 19 frontend BDD conditions pass (vue-tsc 0 errors, npm run build succeeds).
3. **E2E**: share-link.spec.ts covers the critical path: create share → access via share → verify watermark → revoke → verify 404.
4. **No regressions**: All existing tests (587 backend + 479 frontend) remain green.
5. **Security**: Token hash storage verified, cookie isolation verified, Referrer-Policy verified.
