---
status: approved
phase: P2
task_id: T027-share-link
role: cso
reviewed: P2-design.md
trace_id: T027-P2-CSO-20260629
created: 2026-06-29
---

# CSO Security Review — T027 Share Link P2 Design

## STRIDE Matrix

| # | Threat | Category | Severity | Detail |
|---|--------|----------|----------|--------|
| S1 | Token brute-force | Spoofing | LOW | 96-bit CSPRNG token; 2^96 search space infeasible. Rate limit (60/min) blocks online attacks. No offline attack vector (hashes not used as encryption keys). |
| S2 | Token timing leak via DB index | Information Disclosure | LOW | `hmac.compare_digest` after DB lookup is defense-in-depth. DB B-tree timing not observable over HTTP. Rate limit makes statistical timing attacks infeasible. Design acknowledges this correctly (SS6.2). |
| S3 | Token in server logs | Information Disclosure | MEDIUM | First `?share=` request logs the full token in uvicorn access log. Only one log entry per share (subsequent requests use cookie). Frontend `router.replace` removes token from URL bar. Design notes future uvicorn log stripping. Acceptable for self-hosted tool. |
| S4 | Referrer header token leak | Information Disclosure | LOW | Mitigated: middleware sets `Referrer-Policy: no-referrer` when `?share=` present. Frontend removes query param after first load. Correctly designed (SS4.4, SS6.4). |
| S5 | Cookie-based access with 48-bit prefix | Spoofing | LOW | Cookie value is `token_prefix` (8 chars, ~48 bits). Attacker must: (1) know cookie name `peekview_share_{entry_id}` which requires `entry_id`, (2) guess prefix, (3) have cookie set (httpOnly, same-origin). Threat model is acceptable for self-hosted tool. Design correctly analyzes this (SS3.5). |
| S6 | Share cookie namespace collision | Elevation of Privilege | LOW | Cookie name `peekview_share_{entry_id}` is isolated from JWT cookie `peekview_token`. No namespace collision. Cookie is scoped to specific entry by `entry_id` in name. Correct (SS3.7, SS6.3). |
| S7 | XSS token theft via share cookie | Information Disclosure | LOW | Share cookie is HttpOnly — JS cannot read it. Even if XSS exists, the attacker gets `token_prefix` (8 chars) not the full token. Full token is never stored server-side. Correct (SS3.7). |
| S8 | Sandboxed iframe escalation | Elevation of Privilege | LOW | HTML render route uses `sandbox="allow-scripts"` (no `allow-same-origin`). iframe JS runs in opaque origin, cannot access parent cookies. Initial load carries cookie (correct — need access to content). iframe JS cannot make further authenticated requests. Correctly analyzed (SS6.5). |
| S9 | Share access to mutation endpoints | Tampering | LOW | Design explicitly limits share access to GET routes only (SS6.8). All mutation routes require `require_auth`. No share-based write path exists. Correct. |
| S10 | Global API key bypass | Elevation of Privilege | LOW | Consistent with existing auth model. Global API key already bypasses visibility checks. No new bypass introduced. Correct (SS6.9). |
| S11 | Admin share management | Elevation of Privilege | LOW | Admin can list/revoke shares for any entry (IR 2.9). Consistent with existing admin privileges (admin sees all entries). No new privilege escalation. Correct (SS6.10). |
| S12 | `max_views` race condition | Denial of Service | MEDIUM | Two concurrent first-time requests both pass the `view_count < max_views` check and both increment. Design explicitly accepts this: "we count page loads, not unique viewers" (SS3.4). For the boundary case where `max_views=1`, this means 2 views could be recorded. **Acceptable** for the stated threat model, but implementation should use `UPDATE ... SET view_count = view_count + 1 WHERE id = ? AND view_count < max_views` (or equivalent) and check affected row count to avoid incrementing past the limit. Current design increments unconditionally then checks — this is the race. |
| S13 | `private->public` auto-revoke transaction safety | Tampering | MEDIUM | Design calls `revoke_all_for_entry` from `update_entry` within same session (SS3.6, SS4.6). SQLite WAL mode provides serializable isolation for single-writer. The `with Session(self.engine) as session:` context in `update_entry` ensures both the `is_public` update and share revocation are in the same transaction. **However**, the design says `share_service = self._get_share_service()` — if this creates a new `Session` instead of reusing the existing one, the revocation would be in a separate transaction, creating a TOCTOU window where the entry is public but shares are still active. **Implementation must ensure share revocation uses the same Session object** as the entry update. |
| S14 | Entry deletion cascade | Tampering | LOW | `cascade="all, delete-orphan"` on `Entry.shares` relationship ensures physical deletion of shares when entry is deleted. Orphaned cookies are harmless (404 on next access). Correct (SS6.7). |
| S15 | Slug enumeration via share endpoints | Information Disclosure | LOW | Invalid/expired/revoked share tokens return 404 (same as "entry not found"), preventing token enumeration. Correct (SS3.4, SS5.3). |
| S16 | Share creation for public entry | Tampering | LOW | Design returns 400 for share creation on public entries (SS3.1 step 3). Prevents confusing state where public entries have dangling shares. Correct. |
| S17 | Share creation for expired entry | Tampering | LOW | Design returns 400 for share creation on expired entries (SS3.1 step 4). Prevents creation of immediately-non-functional shares. Correct. |
| S18 | Token hash algorithm choice | Tampering | MEDIUM | Design uses `hashlib.sha256(token.encode()).hexdigest()` (plain SHA-256) for share token hashing. Existing API key pattern uses `hmac.new(API_KEY_HMAC_KEY, key.encode(), "sha256").hexdigest()` (HMAC-SHA256). **Plain SHA-256 is adequate here** because: (1) share tokens have 96-bit entropy (well above preimage resistance threshold), (2) no salt needed (tokens are high-entropy, unique per generation), (3) HMAC adds no security benefit when the input is already a CSPRNG output. **However**, for consistency with the API key pattern and to future-proof against hash length extension (not applicable to SHA-256 hex output but defensive), consider using HMAC-SHA256 with a dedicated key. This is a **design consistency note**, not a blocker. |

## Findings Summary

### CRITICAL: 0

No critical issues found.

### HIGH: 0

No high-severity issues found.

### MEDIUM: 3

1. **M1 — `max_views` boundary race** (S12): Concurrent first-access requests can both increment `view_count` past `max_views`. Recommend: use conditional `UPDATE ... WHERE view_count < max_views` and check affected row count. If affected rows = 0, deny access. This eliminates the race at the SQL level.

2. **M2 — `private->public` transaction boundary** (S13): `revoke_all_for_entry` must use the same SQLModel `Session` as the `update_entry` call. If a new `Session` is created inside `share_service`, the revocation is a separate transaction — a TOCTOU window exists where entry is public but shares remain active. Design should explicitly state: "share_service methods that participate in entry lifecycle hooks must accept an optional `session` parameter for transaction reuse."

3. **M3 — Token hash algorithm consistency** (S18): Plain SHA-256 vs HMAC-SHA256 (used for API keys). Both are cryptographically adequate for this use case. Plain SHA-256 is acceptable for high-entropy inputs. Noting for implementation consistency — no action required, but if `hash_api_key` is refactored to a shared utility, use HMAC-SHA256.

### LOW: 15

S1, S2, S4, S5, S6, S7, S8, S9, S10, S11, S14, S15, S16, S17 — all correctly handled by the design.

## Specific Security Claims Verification

### Token Generation Strength (96-bit)

`secrets.token_urlsafe(12)` produces 12 random bytes = 96 bits of entropy from OS CSPRNG. This produces 16 URL-safe base64 characters. The token space is 2^96 ≈ 7.9 x 10^28. Online brute-force is blocked by rate limiting (60 req/min → 3,600/hour → would take ~10^24 years). **Verified: adequate.**

### Token Storage (SHA-256 hash, no plaintext)

`token_hash = hashlib.sha256(token.encode()).hexdigest()` — 64-char hex digest stored in DB. Raw token returned only once at creation. `token_hash` has UNIQUE index. **Verified: correct.** Note: existing API key pattern uses HMAC-SHA256, but plain SHA-256 is adequate for 96-bit inputs (see M3).

### Timing Attack Mitigation (hmac.compare_digest)

`hmac.compare_digest(computed_hash, stored.token_hash)` after DB lookup. This is defense-in-depth — the DB index lookup by hash already leaks timing, but this is not observable over HTTP (especially with rate limiting). The `compare_digest` adds a second constant-time check. **Verified: correct approach.** Note: existing `apikey_service.verify_api_key` does NOT use `compare_digest` (uses plain `==` via SQL `WHERE`). This design improves on the existing pattern.

### Share Cookie Isolation

- Name: `peekview_share_{entry_id}` — no collision with `peekview_token` (JWT cookie)
- HttpOnly: true — prevents XSS token theft
- SameSite: Lax — sent on same-origin requests, not on cross-site subrequests
- Path: `/` — necessary for API sub-resource access (Path=/{slug} would not reach /api/ routes)
- Secure: follows HTTPS detection (same as auth cookie pattern)

**Verified: correct.** Cookie design is well-reasoned.

### Referrer-Policy (no-referrer)

Middleware checks `"share=" in request.url.query` and overrides to `no-referrer`. Frontend removes `?share=` via `router.replace` after first load. Two-layer protection. **Verified: correct.**

### view_count Atomicity

`UPDATE entry_shares SET view_count = view_count + 1 WHERE id = ?` — SQLite WAL mode provides atomic increments. Single-writer model ensures no lost updates at the SQL level. **Verified: atomic increment is correct.** The race concern is at the check-then-increment boundary (see M1).

### private->public Transaction Safety

Design states: "Called from `entry_service.update_entry()` within the same transaction." The existing `update_entry` uses `with Session(self.engine) as session:`. If `revoke_all_for_entry` is called within this same `with` block using the same `session`, it is transactionally safe. **Conditional: verified only if same Session is used** (see M2).

### Entry Deletion Cascade

`Entry.shares` relationship with `cascade="all, delete-orphan"`. When entry is deleted via `session.delete(entry)`, SQLAlchemy issues DELETE for all related shares. Orphaned cookies are harmless (404). **Verified: correct.**

### Unauthorized Access Returns 404

Design consistently returns 404 (not 403) for: invalid tokens, expired tokens, revoked tokens, max_views exceeded, non-owner access to private entries. This prevents slug and token enumeration. **Verified: consistent with existing auth model.**

## Verdict

**Status: approved.**

The design demonstrates thorough security analysis. All critical security properties are correctly addressed: token generation strength, hash storage, timing attack mitigation, cookie isolation, Referrer-Policy, cascade deletion, and enumeration prevention. The 3 MEDIUM findings are implementation-level concerns (race condition, transaction boundary, algorithm consistency) that can be resolved during P4 implementation without design changes. No CRITICAL or HIGH findings.

**Highest severity: MEDIUM (3 issues)**
**Blocks release: No**
