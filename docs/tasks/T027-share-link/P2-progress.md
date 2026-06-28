# P2 Progress Log

## 2026-06-29 — Input Reading Complete

### P0-brief key findings:
- 11 user decisions confirmed (path C, expiry options, batch revoke, etc.)
- Backend scope: 10 items (new table, 3 endpoints, service, cookie, hook)
- Frontend scope: 7 items (API client, store, 2 new components, EntryDetailView changes)
- Security risks: token crypto, timing attack, cookie isolation, Referer leak

### P1-requirements key findings:
- 31 BDD acceptance criteria (B01-B33 backend, F01-F19 frontend)
- 12 implicit requirements (2.1-2.12), especially:
  - 2.1: share token must grant access to ALL sub-resources (files, download, render, raw)
  - 2.2: share cookie mechanism for subsequent API calls
  - 2.3: EntryResponse must indicate share access context
  - 2.4: Referrer-Policy header for share-accessed pages
  - 2.7: max shares per entry (50 suggested)
  - 2.10: list returns token prefix, not full token
  - 2.12: frontend must remove ?share= from URL bar

### Code analysis findings:
- models.py: Entry has `owner_id` FK to users.id, `is_public` field. ApiKey uses HMAC-SHA256 hash pattern (hash_api_key). Existing pattern: hash stored, prefix stored, full key returned only at creation.
- entry_service.py: `get_entry()` does visibility check (private → 404 for non-owner). `update_entry()` has no hook for is_public change detection — needs modification.
- entries.py: `get_entry` route is simple — delegates to service. `_is_global_api_key_auth()` pattern exists for bypassing visibility.
- files.py: `_resolve_entry()` is the central visibility gate for sub-resources. This is where share cookie validation must integrate.
- auth.py: `get_current_user()` checks JWT cookie `peekview_token`. Share cookies must use different namespace.
- main.py: Security headers middleware sets Referrer-Policy: strict-origin-when-cross-origin for SPA pages. Need to override to no-referrer for share-accessed pages.
- database.py: Uses migration pattern (ALTER TABLE ADD COLUMN). entry_shares table will be created via SQLModel.metadata.create_all().
- EntryDetailView.vue: Owner actions in `v-if="authStore.isOwner(entryStore.currentEntry.ownerId)"` template. Share button goes here.
- client.ts: PeekAPI class with axios instance, withCredentials:true. Need shareApi methods.
- router.ts: `/:slug` route with props:true. No new route needed for share.
- LoginDialog.vue: Uses `<Teleport to="body">` pattern — ShareDialog follows same pattern.

## 2026-06-29 — Minimal Validation Complete

### Cookie scope analysis:
- Path-scoped cookie (Path=/{slug}) REJECTED — API paths are /api/v1/entries/{slug}/... different prefix
- Path=/ cookie with entry_id in name ACCEPTED — `peekview_share_{entry_id}={token_prefix}`
- Backend resolves slug→entry_id to match cookie name, then validates token

### SameSite=Lax validation:
- Same-origin API calls (file content, render, download): cookie IS sent ✓
- Cross-site subrequests: cookie NOT sent (security) ✓
- This is the correct SameSite value for share cookies

### Referrer-Policy: no-referrer:
- Well-established spec behavior, prevents token leak via Referer header ✓
- Already used in render route (files.py:307)

### sandbox iframe + cookie interaction:
- iframe with sandbox="allow-scripts" (no allow-same-origin) = opaque origin
- iframe JS cannot read parent cookies ✓
- But initial HTTP request to load iframe IS same-origin, so share cookies ARE sent ✓
- Conclusion: render route works with share cookies

### Key design decision — Share cookie strategy:
- Cookie name: `peekview_share_{entry_id}`, value: first 8 chars of token
- Path: `/` (must cover both SPA routes and API routes)
- SameSite: Lax
- HttpOnly: true
- Secure: as per server config (follow existing pattern)
- Max-Age: matches share's expires_at (or 10 years for permanent)

### Alternative considered and rejected: Query param on every API call
- Would require frontend to append ?share=token to all API calls
- Token appears in server access logs for every request
- Cookie approach is cleaner and more secure

## 2026-06-29 — Design Complete

### BDD Coverage Matrix (all 31+19 BDD conditions mapped to design sections):
- B01-B06 → §3.1 create_share + §2 EntryShare model
- B07-B16 → §3.4 verify_share_access + §4 API integration
- B17-B19 → §3.5 cookie mechanism + §4.1 _resolve_entry_with_share
- B20-B22 → §3.2 list_shares
- B23-B25 → §3.3 revoke_shares
- B26-B27 → §3.6 private→public hook
- B28-B29 → §2 EntryShare model (cascade) + §3.4 (atomic increment)
- B30-B32 → §6 security (constant-time, CSPRNG, Referrer-Policy)
- B33 → §7 backward compatibility
- F01-F08 → §5.1 ShareDialog + §5.2 ShareManagementPanel
- F09-F14 → §5.3 share access UX + §5.4 watermark
- F15-F16 → §5.5 visibility toggle toast
- F17-F19 → §7 build/type compatibility

### Impact analysis:
- CHANGED: entry_service.py (update_entry hook), entries.py (get_entry share param), files.py (_resolve_entry share cookie), models.py (EntryShare + schemas), database.py (import + create), main.py (register shares router), EntryDetailView.vue (share button + panel + watermark), client.ts (shareApi), types/index.ts (share types)
- NEW: share_service.py, api/shares.py, stores/share.ts, ShareDialog.vue, ShareManagementPanel.vue
- UNCHANGED: auth.py, storage.py, config.py, MCP server, CLI, router.ts
