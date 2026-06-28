---
phase: P2
task_id: T027-share-link
type: review
status: approved
reviewer: review-lead
created: 2026-06-29
sources:
  - P2-review-eng.md
  - P2-review-design.md
  - P2-review-cso.md
---

# P2 Unified Review — T027 share-link

## Status: approved

All three reviewers voted `approved`. No BLOCKER raised by any reviewer.

**Note:** Eng review labels 3 items as "阻塞级" (blocker-level) but sets status to `approved` with note "补充后 status 可从 draft → approved". These are treated as HIGH (must-fix before P4) rather than formal BLOCKERs, since the reviewer chose not to reject.

---

## Consolidated Findings

### HIGH — Must Fix Before P4 (5)

| # | Source(s) | Summary | Resolution |
|---|-----------|---------|------------|
| H1 | ENG#1, CSO M2 | **Transaction boundary for private→public auto-revoke**: `revoke_all_for_entry` must accept a `session` parameter from `entry_service.update_entry` to ensure revocation shares the same transaction. If a new Session is created inside `share_service`, a TOCTOU window exists where entry is public but shares remain active. | P2 §3.6 / §4.6: add `session` parameter to `revoke_all_for_entry`; `entry_service.update_entry` passes its current session. |
| H2 | ENG#2 | **`_resolve_entry` refactor incomplete**: `_get_entry_by_slug` (bypasses visibility check) has no defined owner, naming, or access control. Risk: a public method that skips visibility checks can be misused. | Name it `_get_entry_bypass_visibility` with docstring warning; place on `entry_service`. Prefer fallback pattern: try `service.get_entry()` first, on NotFoundError fallback to share cookie path with raw lookup. |
| H3 | ENG#3, CSO (S2 note) | **`hmac.compare_digest` after DB lookup is meaningless**: DB query already matched by `token_hash` WHERE clause; comparing two known-equal strings adds no security. CSO notes it is "defense-in-depth" but also notes existing `apikey_service.verify_api_key` does NOT use `compare_digest` (uses plain SQL WHERE). | Delete `compare_digest` from `verify_share_token` step 4. Add comment explaining why it's unnecessary (DB already matched). If constant-time comparison is desired, restructure to query by `token_prefix` + `entry_id` first, then `compare_digest` on hash — but this adds complexity unnecessary for a self-hosted tool. |
| H4 | DESIGN M1 | **ShareDialog lacks error state**: No UI for creation failure (400: public/expired/max-shares, 403: not owner, 401: session expired). Must follow LoginDialog pattern with `error` ref and error display div. | Add `error` ref + `<div v-if="error">` in create section, extract message from `err?.response?.data?.error?.message`. |
| H5 | DESIGN M3 | **`entryStore.loadEntry` does not forward share token**: `loadEntry(slug)` calls `api.getEntry(slug)` without the optional `shareToken` parameter. The share token will never reach the backend. | Update `entryStore.loadEntry(slug, shareToken?)` to forward token; update `onMounted` and `watch` in EntryDetailView to pass `route.query.share`. |

### MEDIUM — Recommended Before P4 (6)

| # | Source(s) | Summary | Resolution |
|---|-----------|---------|------------|
| M1 | CSO M1, ENG#12 | **`max_views` boundary race**: Concurrent first-access requests both pass `view_count < max_views` check and increment. Use conditional `UPDATE ... WHERE view_count < max_views` and check affected rows. | Change `verify_share_token` step 8 to conditional UPDATE; if affected rows = 0, deny access. Eliminates race at SQL level. |
| M2 | DESIGN M2 | **ShareManagementPanel no mobile layout**: Table-like layout won't fit mobile. Must specify mobile approach. | Card-based layout on mobile (option b) — each share as stacked card, aligns with existing mobile patterns. |
| M3 | DESIGN m2 | **`toggleEntryVisibility` return type doesn't carry `revoked_shares`**: Current code returns `Entry` via `transformEntry()`, store doesn't use return value. `revoked_shares` needs to be threaded through. | Extend `Entry` type with `revokedShares`; have `toggleVisibility` return full `Entry` so caller can read it. |
| M4 | DESIGN m4 | **No confirmation for batch revoke**: Destructive multi-item action without confirmation. Use existing `ConfirmDialog` pattern. | Add `ConfirmDialog` for batch revoke: "Revoke N share link(s)? Recipients will lose access immediately." |
| M5 | DESIGN m3 | **`createAnother` does not reset error state**: Previous error persists when user clicks "Create Another". | `createAnother()` should set `error.value = null`. |
| M6 | DESIGN m7 | **`router.replace` for `?share=` removal should happen on failure too**: If API call fails, `?share=token` stays in URL bar, confusing and potentially leaking token. | Always remove `?share=` from URL after API call completes, regardless of success/failure. |

### LOW / Discretionary (7)

| # | Source(s) | Summary |
|---|-----------|---------|
| L1 | ENG#4, CSO M3 | Token hash uses plain SHA-256 vs HMAC-SHA256 (API key pattern). Both adequate; plain SHA-256 is sufficient for 96-bit inputs. Record as TD-027-01. Future unification optional. |
| L2 | ENG#5, CSO S5 | Cookie value is token_prefix (48 bits). Acceptable for self-hosted tool. Record as TD-027-02. |
| L3 | ENG#6 | ShareManagementPanel `fetchShares` should guard with `isOwner && !entry.isPublic` client-side to avoid unnecessary 403 requests. |
| L4 | ENG#7 | `parse_expires_in` "0" = permanent semantics: verify in P4 that "0" is not interpreted as "immediate expiry". |
| L5 | ENG#8 | gate_commands: use `backend/.venv/bin/python -m pytest` instead of `source .venv/bin/activate && pytest`. P8 E2E spec file may not exist at P5 gate. |
| L6 | DESIGN m1 | Watermark `z-index: 9999` conflicts with LoginDialog overlay (`z-index: 9997`). Use `z-index: 100` instead. |
| L7 | DESIGN m5 | Cookie Max-Age for permanent shares is 100 days. Acceptable but should document in UI: "Link never expires" (not "access never expires"). |

### Positive Notes (Cross-Reviewer Consensus)

All three reviewers independently affirmed:

1. **Cookie mechanism is well-designed**: `Path=/`, `HttpOnly`, `SameSite=Lax`, entry-scoped naming — correct and validated.
2. **Access resolution order is clear and correct**: Public > Authenticated owner/admin > Share token > Share cookie > 404.
3. **Token security is solid**: 96-bit CSPRNG, SHA-256 hash storage, no plaintext retention, rate limiting blocks online attacks.
4. **BDD traceability is comprehensive**: All P1 conditions mapped with no gaps.
5. **Backward compatibility analysis is thorough**: Additive-only API, optional fields, no breaking changes.
6. **Referrer-Policy override is a good security measure**: Two-layer protection (middleware + frontend URL cleanup).
7. **Private→public auto-revoke within transaction is the right approach**: Prevents race condition (conditional on session reuse — H1).

---

## Expert Disagreements

**None.** All three reviewers are aligned on substance. The only tension is ENG labeling items as "阻塞级" while setting status to `approved`. This is resolved by classifying them as HIGH (must-fix before P4) rather than formal BLOCKERs.

---

## Technical Debt Recorded

| ID | Description | Source |
|----|-------------|--------|
| TD-027-01 | Share token hash uses plain SHA-256 (no HMAC key), inconsistent with API key HMAC-SHA256. Not a security issue; future unification optional. | ENG#4, CSO M3 |
| TD-027-02 | Cookie value is token_prefix (48 bits entropy). Acceptable for self-hosted; consider full hash or session token for higher-security deployments. | ENG#5, CSO S5 |

---

## P4 Entry Conditions

Before P4 implementation begins, the following must be addressed in P2-design.md:

1. **H1**: §3.6 / §4.6 — add `session` parameter to `revoke_all_for_entry`; document transaction reuse pattern.
2. **H2**: §4.3 — define `_get_entry_bypass_visibility` placement, naming, access control; prefer fallback pattern.
3. **H3**: §3.4 — delete `compare_digest` from step 4; add explanatory comment.
4. **H4**: §5.1 — add error state to ShareDialog (follow LoginDialog pattern).
5. **H5**: §5.3 / §5.7 — update `entryStore.loadEntry` signature to forward `shareToken`; update EntryDetailView `onMounted`/`watch`.

These are specification supplements, not architecture changes. Core design (cookie mechanism, token lifecycle, access resolution, component structure) is confirmed by all reviewers.
