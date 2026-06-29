# P1 Progress — T033

## 2026-06-30 — Reading P0-brief & source code

### Key findings from code analysis

1. **compare_digest (line 207)**: `hmac.compare_digest(computed_hash, share.token_hash)` — `computed_hash` was already used to FIND the share (line 199: `EntryShare.token_hash == computed_hash`), so `compare_digest` is comparing identical values. It's purely decorative. The query already guarantees match. Existing test `test_b30_token_comparison_uses_hmac_compare_digest` explicitly verifies this call happens — removing compare_digest requires updating this test.

2. **Cookie naming**: Currently `peekview_share_{entry.id}` in 4 locations:
   - `share_service.py:303` (build_share_cookie_params)
   - `share_service.py:314` (clear_share_cookie_params)
   - `entries.py:82` (read handler)
   - `files.py:190` (file access handler)
   Plus test references in `test_share_cookie.py` and `test_read_tracking.py`.
   Slug rename is NOT supported (EntryUpdate has no slug field), so P0 risk about slug rename breaking cookies is moot — but the risk should be documented as future consideration.

3. **max_views semantics**: Current behavior:
   - `verify_share_token` (called on `?share=` access) increments `view_count` via SQL UPDATE
   - `verify_share_cookie` (called on subsequent cookie-based access) does NOT increment `view_count`
   - Frontend says "Max views" + displays "3/10 views"
   - Backend model description: "Max view count. null = unlimited"
   - **The actual behavior is closer to "max token verifications"**, not "max page views" — cookie-based repeat visits don't count. This is the core ambiguity.

### Dependency analysis

- **Fix 1 (compare_digest)**: Independent. Test B30 must be updated.
- **Fix 2 (cookie naming)**: Independent but touches 4 backend files + 2 test files. No migration needed (cookies are transient, not persisted server-side). Old cookies naturally expire.
- **Fix 3 (max_views semantics)**: Depends on direction decision. "View N times" requires cookie path to also count; "Issue N links" is just UI text. These are fundamentally different scopes.

### [NEED_CONFIRM] decision needed on max_views

The semantic choice has major scope implications:
- Option A ("最多看 N 次"): Requires `verify_share_cookie` to also increment view_count → changes backend behavior, potentially performance-sensitive
- Option B ("最多验证 N 次" / "最多发 N 个链接"): Only UI text change, no backend change
- Current behavior is Option B but UI implies Option A
