---
phase: P4
task_id: T053
type: review
parent: P4-implementation.md
trace_id: T053-P4-cso-20260713
status: approved
created: 2026-07-13
agent: cso
---

# T053 P4 CSO Security Review: Content Negotiation + HTML Self-Description

## STRIDE Matrix

| # | Threat | Category | Severity | Finding |
|---|--------|----------|----------|---------|
| S1 | Browser意外拿到JSON | Information Disclosure | LOW | ✅ Safe — `_prefers_json` requires `application/json` acceptable AND `text/html`+`application/xhtml+xml` NOT acceptable. `*/*` does not trigger JSON. Browser default Accept always includes `text/html`. |
| S2 | 私有entry认证绕过 | Elevation of Privilege | HIGH (mitigated) | ✅ Safe — `resolve_entry_raw` is extracted from `get_entry_raw` and shares identical auth/visibility logic (global API key, normal auth, share cookie). Catchall calls same function. |
| S3 | `<link>` 注入泄露slug有效性 | Information Disclosure | LOW | ✅ Accepted — NC2 resolved: `<link>` is a pointer, not content. Slug space is 36^6 ≈ 2.2B, enumeration cost prohibitive. Consistent with P1/I11 assessment. |
| S4 | SQL注入 via slug | Tampering | LOW | ✅ Safe — `_slug_exists` uses SQLModel `select(Entry).where(Entry.slug == slug)` with parameterized query. No string interpolation. |
| S5 | 前端路由排除不完整 | Information Disclosure | MEDIUM (mitigated) | ⚠️ See Finding 5 — `FRONTEND_ROUTES` covers current routes but is a static list. |
| S6 | Accept header畸形值 | Denial of Service | LOW | ✅ Safe — malformed Accept falls through to HTML (safe default). `ValueError` on `float()` caught, defaults to q=1.0. No crash path. |
| S7 | `<link>` 注入XSS | Tampering | MEDIUM (mitigated) | ⚠️ See Finding 7 — slug is user-controlled but constrained by `SLUG_PATTERN = r"^[a-z0-9_-]+$"`. |
| S8 | `resolve_entry_raw` 认证逻辑与`/raw`一致性 | Elevation of Privilege | HIGH (mitigated) | ✅ Verified — `resolve_entry_raw` (files.py:385-489) is the exact logic extracted from `get_entry_raw`. `get_entry_raw` now delegates to it. Single source of truth. |
| S9 | Share cookie在Content Negotiation中生效 | Elevation of Privilege | MEDIUM | ✅ Safe — `resolve_entry_raw` calls `_check_share_cookie` on NotFoundError (line 413-417), same as `/raw` endpoint. |
| S10 | Global API key中间件与Content Negotiation交互 | Elevation of Privilege | LOW | ✅ Safe — Global API key middleware (main.py:280-333) skips `/{slug}/raw` shortlink (line 300-301). Content Negotiation path `/{slug}` with `Accept: application/json` is NOT skipped by middleware, but `resolve_entry_raw` handles global API key auth internally (line 394-406). Two-layer defense. |

## Detailed Findings

### Finding 1: `_prefers_json` 规则安全性 — ✅ PASS

**Code**: `main.py:28-50`

Analysis of all edge cases:
- `Accept: application/json` → JSON ✅ (only json acceptable)
- `Accept: text/html, application/json` → HTML ✅ (html present)
- `Accept: application/json;q=0.9, text/html;q=0.1` → HTML ✅ (html present, q>0)
- `Accept: */*` → HTML ✅ (wildcard not counted as json)
- `Accept: text/html;q=0, application/json` → JSON ✅ (html q=0, explicitly not acceptable)
- Missing/empty Accept → HTML ✅ (safe default)
- `Accept: garbage` → HTML ✅ (no media type matches, json_acceptable=False)

**Key safety property**: `text/html` or `application/xhtml+xml` with q>0 → always HTML. This is strictly more conservative than RFC 7231 q-value sorting, which is the correct security posture.

**One minor observation**: `*/*` is not treated as `application/json` acceptable. This is intentional and correct — per P2 design, wildcard should not trigger JSON. However, a strict RFC 7231 interpretation would consider `*/*` as matching `application/json`. The GitHub-style rule is safer and explicitly documented.

### Finding 2: 私有entry认证/可见性一致性 — ✅ PASS

**Code**: `api/files.py:385-489` (`resolve_entry_raw`), `main.py:529-537` (catchall call)

Verified auth flow in `resolve_entry_raw`:
1. `get_current_user(request)` — same function used by `/raw` endpoint (line 392)
2. `_is_global_api_key_auth(request, current_user)` — same check (line 394)
3. Global key path: direct DB query, bypasses visibility (line 396-406) — same as `/raw`
4. Normal path: `service.get_entry(slug, current_user_id, is_admin)` — same visibility check (line 411)
5. Share cookie fallback: `_check_share_cookie(request, slug, service)` — same as `/raw` (line 413-417)
6. NotFoundError raised on failure — catchall converts to 404 JSON (main.py:533-537)

**Critical verification**: `get_entry_raw` (line 492-498) is now a thin wrapper that delegates to `resolve_entry_raw`. No logic divergence possible.

### Finding 3: `<link>` 注入信息泄露 — ✅ ACCEPTED (LOW)

**Code**: `main.py:59-67` (`_slug_exists`), `main.py:70-72` (`_inject_link`)

`_slug_exists` checks existence only (no visibility check). This means:
- Attacker can enumerate valid slugs by checking `<link>` presence in HTML response
- Attacker can enumerate valid slugs by checking `Link` header presence

**Risk assessment**:
- Slug space: 36^6 ≈ 2.2 billion (6-char lowercase alphanumeric)
- Enumeration cost: ~2.2B HTTP requests to map all slugs
- `<link>` reveals existence only, not content — accessing content still requires auth for private entries
- This is consistent with NC2 resolution and P1/I11 assessment

**Recommendation**: Document this as accepted risk. If slug generation strategy changes (e.g., to sequential or short slugs), reassess.

### Finding 4: SQL注入 — ✅ PASS

**Code**: `main.py:59-67`

```python
entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
```

SQLModel/SQLAlchemy parameterized query. No string interpolation. The `slug` parameter comes from FastAPI path parameter (`{path:path}`), which is a string but passed through parameterized binding.

### Finding 5: 前端路由排除完整性 — ⚠️ LOW RISK

**Code**: `main.py:25,53-56`

```python
FRONTEND_ROUTES = frozenset({"", "explore", "settings/apikeys", "login"})

def _is_frontend_route(path: str) -> bool:
    if path in FRONTEND_ROUTES:
        return True
    return path.startswith("users/")
```

**Current coverage vs. `router.ts`**:
| router.ts route | FRONTEND_ROUTES coverage |
|-----------------|--------------------------|
| `/` (landing) | ✅ `""` in frozenset |
| `/explore` | ✅ `"explore"` in frozenset |
| `/users/:username` | ✅ `path.startswith("users/")` |
| `/:slug` | N/A (this IS the slug path) |
| `/settings/apikeys` | ✅ `"settings/apikeys"` in frozenset |
| `/:pathMatch(.*)*` (not-found) | N/A (catchall, no DB query needed) |
| `/login` | ✅ `"login"` in frozenset |

**Gap analysis**: All current routes are covered. However:
- This is a **static list** — if new frontend routes are added, `FRONTEND_ROUTES` must be updated manually
- The consequence of missing a route is only an unnecessary DB query (not a security issue) — the slug won't exist in DB, so no `<link>` injection or JSON response
- **Worst case**: a new frontend route like `/dashboard` would trigger a DB query for slug "dashboard" → not found → no injection → HTML served. No security impact.

**Recommendation**: Add a code comment in `FRONTEND_ROUTES` definition referencing `router.ts` as the source of truth. Low priority.

### Finding 6: Accept header畸形值处理 — ✅ PASS

**Code**: `main.py:28-50`

Tested scenarios:
- `Accept: garbage` → `media = "garbage"`, no match for html/json → `json_acceptable=False, html_acceptable=False` → returns False → HTML ✅
- `Accept: ;q=0.5` → `media = ""` (empty after strip), skipped → HTML ✅
- `Accept: application/json;q=abc` → `ValueError` on `float("abc")`, caught, q defaults to 1.0 → JSON acceptable → but if html also present, HTML wins ✅
- `Accept: application/json;q=` → `float("")` raises ValueError, q=1.0 → same as above ✅
- Empty string → `if not accept_header: return False` → HTML ✅
- None → `if not accept_header: return False` → HTML ✅

No crash path, no injection vector. Safe defaults throughout.

### Finding 7: `<link>` 注入XSS风险 — ✅ PASS (with constraint)

**Code**: `main.py:70-72`

```python
def _inject_link(html: bytes, slug: str) -> bytes:
    link_tag = f'<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />'
    return html.replace(b"</head>", f"{link_tag}\n</head>".encode())
```

The `slug` is interpolated directly into HTML. If slug contained `"`, `>`, or `<`, this would be an XSS vector.

**Mitigation**: Slug validation (`models.py:47-65`) enforces `SLUG_PATTERN = r"^[a-z0-9_-]+$"` — only lowercase letters, digits, underscores, and hyphens. None of these characters have special meaning in HTML.

**However**: The `path` parameter in catchall comes from FastAPI `{path:path}` which can contain any URL-safe characters. The slug is NOT re-validated in `_inject_link` or `_slug_exists`. If a path like `foo"onmouseover="alert(1)` reaches `_inject_link`, it would inject malicious HTML.

**Defense layers**:
1. `_slug_exists` queries DB with this path — no entry will match (slugs are validated on creation), so `_inject_link` is never called with invalid characters
2. Even if somehow called, the CSP header (`script-src 'self' 'unsafe-eval'`) would block inline event handlers
3. The `</` replacement in `resolve_entry_raw` serialized output (line 475) prevents closing script tags in JSON

**Verdict**: Safe in practice due to DB constraint (invalid slugs never exist), but defense-in-depth would benefit from slug validation in `_inject_link`. **Not blocking** — the DB is the authoritative constraint.

### Finding 8: `resolve_entry_raw` 认证一致性 — ✅ PASS

Verified line-by-line comparison:

| Auth step | `/raw` (old `get_entry_raw`) | `resolve_entry_raw` | Consistent |
|-----------|------------------------------|---------------------|------------|
| `get_current_user(request)` | Via `Depends(get_current_user)` | Direct call (line 392) | ✅ Same function |
| Global API key check | `_is_global_api_key_auth` | Same (line 394) | ✅ |
| Global key: direct DB query | `select(Entry).where(Entry.slug == slug)` | Same (line 398) | ✅ |
| Normal: `service.get_entry()` | With `current_user_id`, `is_admin` | Same (line 411) | ✅ |
| Share cookie fallback | `_check_share_cookie` | Same (line 413-417) | ✅ |
| Read tracking | `_record_read_async` | Same (line 480-484) | ✅ |
| JSON serialization | `</` escape | Same (line 475) | ✅ |

**Note**: `get_entry_raw` now delegates entirely to `resolve_entry_raw` (line 492-498). No possibility of logic drift.

### Finding 9: Rate limiting on Content Negotiation — ⚠️ OBSERVATION

The catchall route `serve_spa_catchall` does not have `@limiter.limit()` decorator. Content Negotiation JSON responses go through `resolve_entry_raw` which also lacks rate limiting.

However, the SlowAPI middleware applies `default_limits` (configured as `captcha_limit` per minute) to all endpoints. So Content Negotiation requests are rate-limited at the default rate.

**Observation**: The `/raw` API endpoint (`get_entry_raw`) also lacks explicit rate limiting and relies on the same default. Consistent behavior.

### Finding 10: Security headers on Content Negotiation JSON responses — ⚠️ OBSERVATION

When `resolve_entry_raw` returns a JSON Response from the catchall, the security headers middleware (main.py:237-277) applies headers based on path. The path `/{slug}` matches the `elif` branch (line 256) which sets:
- `X-Content-Type-Options: nosniff` ✅
- `X-Frame-Options: DENY` ✅
- CSP with `default-src 'self'` ✅

But the JSON response from `resolve_entry_raw` has `Content-Type: application/json; charset=utf-8`. The CSP `default-src 'self'` is irrelevant for JSON (no scripts to execute), and `nosniff` prevents MIME sniffing. **No issue**.

For the 404 JSON response (main.py:534-537), same middleware applies. ✅

## Severity Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 0 | — |
| HIGH | 0 (2 mitigated) | S2, S8 — both verified safe via shared `resolve_entry_raw` |
| MEDIUM | 0 (2 mitigated) | S5, S7 — both safe in practice, documented constraints |
| LOW | 4 | S1, S3, S4, S6 — all verified safe |
| INFO | 2 | S9, S10 — observations, no action needed |

## Verdict

**status: approved**

No CRITICAL or unmitigated HIGH findings. The implementation correctly:
1. Prevents browsers from accidentally receiving JSON (GitHub-style `_prefers_json`)
2. Maintains auth/visibility parity with `/raw` via shared `resolve_entry_raw`
3. Uses parameterized queries (no SQL injection)
4. Handles malformed Accept headers safely
5. Constrains slug characters at DB level (XSS mitigation)

**Recommendations (non-blocking)**:
1. Add comment in `FRONTEND_ROUTES` referencing `router.ts` as source of truth
2. Consider adding slug format validation in `_inject_link` as defense-in-depth (currently protected by DB constraint)
3. Document slug enumeration via `<link>` as accepted risk in security docs
