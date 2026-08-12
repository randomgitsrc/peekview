---
phase: P7
task_id: T027-share-link
type: consistency
parent: P2-design.md
verifier: architect (P7)
created: 2026-06-29
---

# P7 Consistency Report — T027 share-link

## Summary

Implementation is substantially consistent with P2 design. 2 deviations identified from P2 review HIGH items that were not fully resolved. No P1 BDD gaps found. P6 acceptance results are clean (52/52 PASS, no intermediate states).

| Category | Total | OK | DEVIATION-CRITICAL | DEVIATION-MINOR | EXTENSION |
|----------|-------|----|--------------------|-----------------|-----------|
| Data Model | 6 | 6 | 0 | 0 | 0 |
| Service Layer | 7 | 5 | 1 | 1 | 0 |
| API Layer | 5 | 5 | 0 | 0 | 0 |
| Frontend | 8 | 8 | 0 | 0 | 0 |
| P2 Review HIGH | 5 | 3 | 1 | 1 | 0 |
| P1 BDD Coverage | 52 | 52 | 0 | 0 | 0 |
| **Total** | **83** | **79** | **1** | **2** | **0** |

---

## Direction 1: Design → Implementation

### 1.1 Data Model (P2 §2)

| Item | Design | Implementation | Verdict |
|------|--------|---------------|---------|
| EntryShare table fields | id, entry_id, token_hash, token_prefix, expires_at, max_views, view_count, created_by, created_at, revoked_at | Exact match | OK |
| EntryShare indexes | idx_entry_shares_entry_prefix (entry_id, token_prefix), token_hash unique index | Exact match | OK |
| EntryShare relationships | entry→Entry, creator→User | Exact match | OK |
| Entry.shares relationship | back_populates="entry", cascade="all, delete-orphan" | Exact match | OK |
| Pydantic schemas (6 schemas) | ShareCreateRequest, ShareResponse, ShareCreateResponse, ShareListResponse, ShareRevokeRequest, EntryShareContext | All present in models.py | OK |
| EntryResponse extension | share_context + revoked_shares optional fields | Both present | OK |

### 1.2 Service Layer (P2 §3)

| Item | Design | Implementation | Verdict |
|------|--------|---------------|---------|
| create_share (§3.1) | 12 steps: resolve→own→public→expired→count→token→hash→prefix→parse_expires→insert→url→return | All steps implemented | OK |
| list_shares (§3.2) | Resolve→own→query ordered by created_at DESC | Match | OK |
| revoke_shares (§3.3) | Resolve→own→UPDATE WHERE revoked_at IS NULL→return count | Match (uses ORM instead of raw SQL, equivalent) | OK |
| verify_share_token (§3.4) | hash→query→compare_digest→entry_id→expires→max_views→increment→return | Match, but compare_digest retained (see H3 below) | OK |
| verify_share_cookie (§3.5) | query by entry_id+token_prefix+revoked_at→expires→max_views→no increment | Match | OK |
| revoke_all_for_entry (§3.6) | UPDATE all active shares for entry | **Creates own Session** (see H1 below) | DEVIATION-CRITICAL |
| Cookie management (§3.7) | build_share_cookie_params + clear_share_cookie_params | Match. HttpOnly, SameSite=lax, Path=/, Max-Age computed, Secure follows request scheme | OK |

**H1 DEVIATION-CRITICAL: Transaction boundary for private→public auto-revoke**

- P2 design §3.6 states: "Called from `entry_service.update_entry()` within the same transaction."
- P2 review H1 explicitly required: "add `session` parameter to `revoke_all_for_entry`; `entry_service.update_entry` passes its current session"
- Implementation: `revoke_all_for_entry` creates its own `Session(self.engine)` (share_service.py:266), called from `entry_service.update_entry` which has its own session (entry_service.py:498-499)
- **Impact**: TOCTOU window exists where entry is marked public (session A committed) but shares remain active until session B commits. If session B fails, entry is public with active shares — violating the atomic guarantee in B26.
- **In practice**: SQLite WAL mode serializes writes; the window is microseconds. But the design explicitly specified same-transaction, and P2 review elevated this to HIGH.
- **Classification**: DEVIATION-CRITICAL — involves P2 core design goal (B26: private→public auto-revocation atomicity), and the P2 review explicitly required same-transaction as a P4 entry condition.

### 1.3 API Layer (P2 §4)

| Item | Design | Implementation | Verdict |
|------|--------|---------------|---------|
| POST /entries/{slug}/shares (§4.1) | require_auth, ShareCreateRequest, 201 ShareCreateResponse | Match | OK |
| GET /entries/{slug}/shares (§4.1) | require_auth, 200 ShareListResponse | Match | OK |
| POST /entries/{slug}/shares/revoke (§4.1) | require_auth, ShareRevokeRequest, 200 {revoked_count} | Match | OK |
| GET /entries/{slug} share param (§4.2) | share query param, access resolution order, cookie set, share_context | Match. Access resolution: public/owner→share token→share cookie→404 | OK |
| _resolve_entry share cookie (§4.3) | Fallback pattern: try get_entry→catch NotFoundError→check cookie | Match (H2 resolved with fallback pattern) | OK |
| Referrer-Policy override (§4.4) | Middleware: if "share=" in query, set no-referrer | Match. Applied in both API and SPA paths | OK |

### 1.4 Frontend (P2 §5)

| Item | Design | Implementation | Verdict |
|------|--------|---------------|---------|
| ShareDialog (§5.1) | Teleport modal, expiry selector, max_views input, Create→Result flow, Copy, Create Another, Close | Match. Error state added per H4 | OK |
| ShareManagementPanel (§5.2) | Share list with status/stats, checkboxes, revoke per row, batch revoke | Match | OK |
| Share access UX (§5.3) | Detect ?share=, call API, router.replace to clean URL, cookie for subsequent | Match | OK |
| Watermark (§5.4) | Fixed bottom-right, "Shared by @{shared_by}", pointer-events:none, z-index 9999 | Match. z-index 9999 retained despite L6 suggestion | OK |
| Visibility toggle toast (§5.5) | Private→public: "N share link(s) revoked" toast; public→private: no toast | Match. Toast uses 'warning' type, message matches P2 | OK |
| Share store (§5.6) | fetchShares, createShare, revokeShares | Match | OK |
| API client (§5.7) | createShare, listShares, revokeShares, getEntry with shareToken | Match | OK |
| TypeScript types (§5.8) | ShareInfo, ShareCreateResult, Entry.shareContext, API response types | Match | OK |

### 1.5 Security (P2 §6)

| Item | Design | Implementation | Verdict |
|------|--------|---------------|---------|
| Token generation (§6.1) | secrets.token_urlsafe(12) = 96 bits, 16 chars | Match (share_service.py:79) | OK |
| Timing attack mitigation (§6.2) | hmac.compare_digest after DB lookup | Kept in implementation despite H3 review recommendation to remove | DEVIATION-MINOR |
| Cookie isolation (§6.3) | peekview_share_{entry_id}, HttpOnly, SameSite=Lax, Path=/ | Match | OK |
| Referrer-Policy (§6.4) | no-referrer when ?share= present | Match (middleware + entry route) | OK |
| Sandbox iframe (§6.5) | Share cookie works with sandbox iframe (initial load auth, JS cannot escalate) | Analysis confirmed in design; implementation preserves existing sandbox behavior | OK |
| Entry deletion cascade (§6.7) | cascade="all, delete-orphan" | Match | OK |
| Read-only share access (§6.8) | Share cookie only grants GET access | Match — all mutation routes use require_auth | OK |

**H3 DEVIATION-MINOR: hmac.compare_digest retained**

- P2 review H3: "Delete `compare_digest` from `verify_share_token` step 4; add explanatory comment."
- Implementation: `hmac.compare_digest(computed_hash, share.token_hash)` is still present (share_service.py:208)
- Rationale for keeping: belt-and-suspenders defense-in-depth. The code is not harmful, just redundant.
- **Classification**: DEVIATION-MINOR — does not affect core design goals. P2 review noted it's "unnecessary" not "incorrect". Keeping it is a conservative choice.

### 1.6 P2 Review HIGH Items Resolution

| # | Item | Required Fix | Implementation Status | Verdict |
|---|------|-------------|----------------------|---------|
| H1 | Transaction boundary | revoke_all_for_entry must accept session param | NOT FIXED — creates own Session | DEVIATION-CRITICAL |
| H2 | _resolve_entry refactor | Fallback pattern: try get_entry→catch→cookie | FIXED (files.py:149-171) | OK |
| H3 | Remove compare_digest | Delete from verify_share_token | NOT FIXED — retained | DEVIATION-MINOR |
| H4 | ShareDialog error state | Add error ref + display | FIXED (ShareDialog.vue:8,76,96-98) | OK |
| H5 | loadEntry share token | Forward shareToken parameter | FIXED (entry.ts:74-90, EntryDetailView.vue:637-646) | OK |

---

## Direction 2: Implementation → Design

### 2.1 Zombie Requirements

No zombie requirements found. All P2 design sections remain applicable.

### 2.2 Extensions (Implementation exceeds design)

None identified. Implementation is closely bounded by P2 design.

### 2.3 Implementation Details Not in P2

| Item | Detail | Assessment |
|------|--------|-----------|
| _check_share_cookie helper (entries.py:26-56) | Standalone function for cookie-based share access in GET /entries/{slug} route | Acceptable refactor — P2 described the logic in §4.2; extracted as a helper |
| ShareService DI via app.state.share_service | Services initialized in main.py create_app | Consistent with existing DI pattern |
| Multiple test files instead of test_shares.py | test_share_create.py, test_share_access.py, test_share_cookie.py, test_share_lifecycle.py, test_share_list.py, test_share_revoke.py, test_share_security.py | Acceptable — better organization than single file |
| _get_share_service creates new instance | entry_service._get_share_service() creates a new ShareService each call | Acceptable for SQLite (stateless service), but could share app.state.share_service |
| files.py creates ShareService locally | `_resolve_entry` creates a new ShareService(engine, config) instead of using app.state | Minor — functionally equivalent but inconsistent with DI pattern |

### 2.4 Missing P2 Planned Files

| File | P2 §8 Status | Found? | Verdict |
|------|-------------|--------|---------|
| e2e/share-link.spec.ts | Listed as new file | NOT FOUND | DEVIATION-MINOR — P6 used CDP scripts instead; P2 specified this as implementation completion criterion but P6 acceptance verified the same scenarios |
| test_shares.py (single file) | Listed as new file (15-20 tests) | Split into 7 files with more coverage | OK — exceeds P2 scope |

---

## P1 BDD Coverage

All 52 BDD conditions from P1 are covered by P6 acceptance verification. No gaps.

### Backend BDD (33/33)

All 33 BDD conditions verified PASS in P6 with evidence. No intermediate states (PASS/FAIL only).

### Frontend BDD (19/19)

All 19 BDD conditions verified PASS in P6 with screenshots/CLI evidence. No intermediate states.

### P6 BDD Two-Value Rule

P6 acceptance uses only PASS/FAIL — no "adjusted/skipped/overridden" intermediate states. Compliant with P7 BDD two-value rule.

---

## Cookie Specification Consistency

| Cookie Attribute | P2 Design | Implementation | Match? |
|-----------------|-----------|---------------|--------|
| Name | peekview_share_{entry_id} | peekview_share_{entry_id} | Yes |
| Value | token_prefix (8 chars) | token_prefix | Yes |
| Path | / | / | Yes |
| SameSite | Lax | lax | Yes |
| HttpOnly | true | True | Yes |
| Secure | true if HTTPS | Follows request scheme (is_secure param) | Yes |
| Max-Age (expiring) | (expires_at - now) seconds | Computed with tz-aware comparison | Yes |
| Max-Age (permanent) | 8640000 (100 days) | PERMANENT_COOKIE_MAX_AGE = 8640000 | Yes |
| Clear cookie | Max-Age: 0 | max_age: 0 in clear_share_cookie_params | Yes |

---

## Referrer-Policy Consistency

| Scenario | P2 Design | Implementation | Match? |
|----------|-----------|---------------|--------|
| Middleware: API path + ?share= | no-referrer | Applied (main.py:144-145) | Yes |
| Middleware: SPA path + ?share= | no-referrer | Applied (main.py:157-158) | Yes |
| Middleware: no ?share= | strict-origin-when-cross-origin | Applied (both paths) | Yes |
| Entry route: ?share= response | Additional Referrer-Policy in JSONResponse | Applied (entries.py:211) | Yes |
| Frontend: router.replace | Remove ?share= from URL bar | Applied (EntryDetailView.vue:644) | Yes |

---

## Conclusion

**Gate Status: CONDITIONAL PASS**

1 DEVIATION-CRITICAL (H1: transaction boundary for private→public auto-revoke). The TOCTOU window is extremely small in practice (SQLite WAL serializes writes), but the P2 review explicitly required same-transaction as a P4 entry condition, and it was not met. The risk is that if `revoke_all_for_entry`'s session commit fails after `update_entry`'s session commits, the entry will be public with still-active shares.

**Recommended action**: Refactor `revoke_all_for_entry` to accept an optional `session` parameter. When called from `update_entry`, pass the existing session. When called standalone (future use), create a new session. This is a ~10-line change with no API or schema impact.
