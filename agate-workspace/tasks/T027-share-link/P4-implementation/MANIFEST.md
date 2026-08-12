# P4 Implementation Manifest — T027 share-link (backend)

## New Files

| File | Description |
|------|-------------|
| `backend/peekview/services/share_service.py` | Share CRUD, token gen/verify, cookie management, private-to-public hook |
| `backend/peekview/api/shares.py` | 3 API endpoints (POST create, GET list, POST revoke) |

## Modified Files

| File | Change |
|------|--------|
| `backend/peekview/models.py` | Added `EntryShare` SQLModel table (after Entry class), `Entry.shares` relationship with cascade delete-orphan, `EntryShareContext` schema (before EntryResponse), share Pydantic schemas (ShareCreateRequest/ShareResponse/ShareCreateResponse/ShareListResponse/ShareRevokeRequest), `share_context`/`revoked_shares` fields on `EntryResponse`, `hashlib` import |
| `backend/peekview/database.py` | Added `EntryShare` to import for `create_all()` discovery |
| `backend/peekview/services/entry_service.py` | Added `EntryShareContext` import, `get_entry_with_share()` method, `_get_share_service()` method, private-to-public auto-revoke hook in `update_entry()`, `revoked_shares` in response, timezone-aware datetime comparison |
| `backend/peekview/api/entries.py` | Added `share` query param to `get_entry`, `_check_share_cookie()` helper, share token validation + cookie setting, `Entry`/`EntryShareContext`/`Session`/`select` imports, priority logic (owner/admin > share token > share cookie > normal) |
| `backend/peekview/api/files.py` | Extended `_resolve_entry()` with share cookie check for sub-resource access (after normal access attempt fails) |
| `backend/peekview/main.py` | Registered `ShareService` in `app.state`, registered `shares_router`, added `?share=` Referrer-Policy override in security headers middleware |

## Integration Test Results (verified manually)

- Create share: 201, returns 16-char token + share_url
- Share token access: 200, returns entry with share_context
- Share cookie setting: Set-Cookie header present
- Cookie-based access: 200, returns entry with share_context
- List shares: 200, returns all shares
- Revoke shares: 200, returns revoked_count
- Private-to-public: 200, returns revoked_shares
- Referrer-Policy: no-referrer for ?share=, strict-origin-when-cross-origin for normal
