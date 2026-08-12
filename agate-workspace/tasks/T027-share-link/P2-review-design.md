---
phase: P2
task_id: T027-share-link
type: review
reviewer: plan-design-review
status: approved
created: 2026-06-29
---

# P2 Design Review — T027 share-link

## Dimension Scores (0-10)

| Dimension | Score | Summary |
|-----------|-------|---------|
| Interaction State Coverage | 8 | Loading/error/empty/edge states well-specified; minor gaps in share creation error feedback and mobile panel layout |
| AI Slop Risk | 9 | Design is precise with exact component structure, API contracts, and state transitions; minimal room for "just make something up" |
| Mobile Consideration | 5 | No mobile layout spec for ShareDialog or ShareManagementPanel; watermark positioning on mobile unaddressed |
| Accessibility | 6 | aria-modal and role="dialog" mentioned for ShareDialog; missing focus trap, keyboard nav for management panel, screen reader announcements for share creation/revocation |

**Overall: 7/10 — Approved with conditions**

## Detailed Findings

### CRITICAL (0)

None. The design is sound and implementable as-is.

### MAJOR (3)

#### M1: ShareDialog lacks error state handling

The ShareDialog template (5.1) shows two states: `!createdShare` (create form) and `createdShare` (result). There is no error state for creation failure. When `createShare()` fails (400: public entry, expired entry, max shares reached; 403: not owner; 401: session expired), the dialog has no UI to display the error.

**Current code pattern**: LoginDialog has an explicit `error` ref and `<div v-if="error" class="login__error">{{ error }}</div>`. ShareDialog should follow the same pattern.

**Required**: Add `error` ref and error display div in the create section, between the fields and the submit button. Error messages should be extracted from `err?.response?.data?.error?.message` (same pattern as LoginDialog line 203).

#### M2: ShareManagementPanel has no mobile layout

The design specifies ShareManagementPanel as "shown below entry content for owners of private entries" but provides no mobile layout. The current EntryDetailView has a clear desktop/mobile split: desktop actions in `.header-right .actions`, mobile actions in `.mobile-actions` bar. The management panel with its table-like layout (checkbox + prefix + status + views + expires + revoke button per row) will not fit on mobile screens.

**Required**: Specify one of:
- (a) Collapsible panel on mobile (accordion with summary line "3 active / 1 expired")
- (b) Card-based layout on mobile (each share as a stacked card instead of a row)
- (c) Drawer pattern (like the existing File Drawer) for mobile share management

Option (b) is recommended — it aligns with the existing mobile pattern and requires no new overlay/drawer infrastructure.

#### M3: `loadEntry` in entry store does not pass share token

The design (5.3) says `onMounted` in EntryDetailView should detect `route.query.share` and call `api.getEntry(slug, shareToken)`. However, the current `entryStore.loadEntry(slug)` (stores/entry.ts:73) calls `api.getEntry(slug)` with no share token parameter. The design modifies `api.getEntry` to accept an optional `shareToken` parameter (5.7), but does not modify `entryStore.loadEntry` to accept or forward it.

**Impact**: If `loadEntry` is not updated, the share token will never reach the backend. The store is the single point of entry for loading entries.

**Required**: `entryStore.loadEntry(slug, shareToken?)` must be updated to forward the token to `api.getEntry(slug, shareToken)`. The `onMounted` and `watch` in EntryDetailView must pass `route.query.share` to `entryStore.loadEntry`.

### MINOR (7)

#### m1: Watermark z-index conflict risk

The design specifies watermark `z-index: 9999`. The existing LoginDialog overlay uses `z-index: 9997`. If a share viewer somehow triggers the login dialog (e.g., by navigating to /settings/apikeys), the watermark would appear above the dialog. This is unlikely but inconsistent.

**Recommendation**: Use `z-index: 100` for watermark (below all overlays which start at 9997). The watermark should never appear above interactive elements.

#### m2: `toggleEntryVisibility` return type change not addressed

The design (5.5) shows `toggleVisibility` reading `response.revoked_shares` from the API response. But the current `api.toggleEntryVisibility` (client.ts:115-120) returns `Entry` via `this.transformEntry()`, and `entryStore.toggleVisibility` (entry.ts:126-155) does not use the return value — it just checks for success/failure. The `revoked_shares` field needs to be threaded through: `api.toggleEntryVisibility` must return it, and `entryStore.toggleVisibility` must expose it (either via return value or a separate ref).

**Recommendation**: Extend the `Entry` type with `revokedShares` (already in the design at 5.8), and have `toggleVisibility` return the full `Entry` object so the caller can read `revokedShares`.

#### m3: ShareDialog `createAnother` does not reset error state

If a share creation fails, the user sees the error. If they then click "Create Another" (which resets to create state), the error message from the previous attempt should be cleared. The design does not mention this.

**Recommendation**: `createAnother()` should reset `error.value = null` alongside resetting `createdShare`.

#### m4: No confirmation for batch revoke

The design shows a "Revoke N Selected" button that immediately revokes. For destructive actions on multiple items, a confirmation step is standard UX. The existing codebase has `ConfirmDialog` for the delete action. Batch revoke should use the same pattern.

**Recommendation**: Add `ConfirmDialog` integration for batch revoke, with message "Revoke N share link(s)? Recipients will lose access immediately."

#### m5: Cookie Max-Age for permanent shares is 100 days

The design (3.7) sets `Max-Age: 8640000` (100 days) for permanent shares. This means a "permanent" share link's cookie expires after 100 days, requiring the user to re-access via the full `?share=token` URL. This is inconsistent with the "permanent" label. Either:
- (a) Use a longer Max-Age (e.g., 365 days = 31536000)
- (b) Document this as intentional (100 days is a reasonable session lifetime; the share itself is permanent, the cookie just needs refreshing)

**Recommendation**: (b) is acceptable but should be documented in the UI. When selecting "Permanent", the tooltip or description should say "Link never expires" (not "access never expires").

#### m6: `share_context.shared_by` resolution requires eager load of creator relationship

The design (4.2) shows `share.creator.username` being accessed in `_build_response`. This requires the `EntryShare.creator` relationship to be eagerly loaded, or it will trigger a lazy load (N+1 if multiple shares). The design does not specify eager loading strategy.

**Recommendation**: In `verify_share_token`, use `selectinload(EntryShare.creator)` or resolve the username in the same query. Since only one share is validated per request, lazy load is acceptable here, but should be noted.

#### m7: `router.replace` timing for `?share=` removal

The design (5.3) says to call `router.replace({ path: route.path, query: {} })` after receiving the entry response. However, if the API call fails (invalid/expired token), the `?share=` param should still be removed from the URL bar — otherwise the user sees the token in the URL with an error message, which is confusing. The design's error states (F12-F14) do not mention URL cleanup.

**Recommendation**: Always remove `?share=` from URL bar after the API call completes, regardless of success or failure. On failure, show the error state without the token in the URL.

### POSITIVE

1. **Cookie-based sub-resource access** is well-designed. The `Path=/` decision is correct and validated in `minimal_validation`. The `peekview_share_{entry_id}` naming avoids namespace collision with `peekview_token`.

2. **Access resolution order** (4.2) is clear and correct: public > authenticated owner/admin > share token > share cookie > 404. This prevents any auth path confusion.

3. **Token security** is solid: SHA-256 hash storage, `hmac.compare_digest` defense-in-depth, 96-bit entropy from `secrets.token_urlsafe(12)`, no prefix needed for query-param context.

4. **BDD traceability** (Section 9) is comprehensive — every P1 BDD condition maps to a design section with no gaps.

5. **Backward compatibility** analysis (Section 7) is thorough. The `share` query param defaulting to None, optional `share_context` and `revoked_shares` fields, and additive-only API endpoints are all correct.

6. **Referrer-Policy override** (4.4) is a good security measure that prevents token leakage via Referer headers.

7. **Private-to-public auto-revoke** within the same transaction (3.6) prevents the race condition where a share could be used between the visibility change and the revocation.

8. **ShareDialog follows LoginDialog pattern** — Teleport, Transition, defineModel for visible, same error handling structure. This ensures UI consistency.

9. **Pinia store design** (5.6) is minimal and correct — `shares`, `loading`, `fetchShares`, `createShare`, `revokeShares`. No over-engineering.

10. **`_resolve_entry` refactor** (4.3) is well-analyzed. The need to intercept before the visibility check is correctly identified, and the `_get_entry_id_by_slug` helper approach is sound.

## Conditions for Approval

1. **M1** (ShareDialog error state): Must add error display in create section before P4.
2. **M2** (Mobile layout for ShareManagementPanel): Must specify mobile layout approach before P4.
3. **M3** (loadEntry share token forwarding): Must update `entryStore.loadEntry` signature and EntryDetailView `onMounted`/`watch` before P4.

These are implementable within P4 without requiring a P2 revision cycle — they are specification gaps, not design flaws. The core architecture (cookie mechanism, access resolution, token lifecycle, component structure) is sound.
