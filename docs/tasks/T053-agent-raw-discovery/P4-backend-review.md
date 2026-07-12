---
phase: P4
task_id: T053
type: review
parent: P4-implementation.md
trace_id: T053-P4-backend-20260713
status: needs-revision
created: 2026-07-13
agent: review
---

# T053 P4 Backend Code Review

## Review Scope

Content Negotiation + HTML self-description implementation in:
- `backend/peekview/main.py` (lines 25-73, 517-553)
- `backend/peekview/api/files.py` (lines 385-498)

## Pass 1: CRITICAL — Data Safety & Correctness

### [CRITICAL] main.py:534-537 — 404 response format inconsistency

When `resolve_entry_raw` raises `NotFoundError` in the catchall, the catchall returns:
```python
{"detail": "Entry not found", "code": "NOT_FOUND"}
```

But when `NotFoundError` propagates to the `PeekError` exception handler (the normal /raw endpoint path), it returns:
```python
{"error": {"code": "NOT_FOUND", "message": "Entry not found: {slug}", "details": None}}
```

Two problems:
1. **Schema mismatch**: catchall uses flat `{"detail": ..., "code": ...}` vs. nested `{"error": {"code": ..., "message": ..., "details": ...}}`. Agent clients parsing JSON 404 responses will get inconsistent shapes depending on whether they hit `/{slug}` (catchall) or `/api/v1/entries/{slug}/raw`.
2. **Information leakage**: catchall omits the slug from the message (`"Entry not found"` vs `"Entry not found: {slug}"`). The PeekError handler includes the slug in the message. This is inconsistent but not a security issue since both paths already confirm/deny existence by the 404 itself.

Fix: Change catchall 404 to use the same format as the PeekError handler, or let the exception propagate to the handler. Simplest fix — remove the try/except and let `NotFoundError` propagate:
```python
if not _is_frontend_route(path) and _prefers_json(request.headers.get("accept")):
    from peekview.api.files import resolve_entry_raw
    return await resolve_entry_raw(request, path)
```
The `PeekError` exception handler at line 438 will catch `NotFoundError` and return the canonical `{"error": {...}}` format with status 404. This also eliminates code.

### [CRITICAL] main.py:59-67 — `_slug_exists` does not filter ARCHIVED entries

`_slug_exists` queries `Entry.slug == slug` without filtering `Entry.status != ARCHIVED`. Archived entries will get `<link>` and `Link` header injection, but `resolve_entry_raw` (via `EntryService.get_entry`) will raise `NotFoundError` for anonymous users on archived entries.

Result: Anonymous user visits archived entry URL with browser → gets HTML with `<link rel="alternate">` and `Link` header → Agent follows link with `Accept: application/json` → gets 404. The self-description promises something that doesn't work for anonymous access.

This is the **same issue as private entries** (B10b/B13b design decision: `<link>` is a pointer, not content disclosure). But for archived entries, the design intent is less clear — archived entries are explicitly hidden from non-owners, unlike private entries which are accessible to the owner.

Decision needed: Should `_slug_exists` filter archived entries? Two options:
- **Option A**: Filter archived entries from `_slug_exists` (consistent with `get_entry` visibility for anonymous). This means archived entry URLs serve plain HTML without `<link>`.
- **Option B**: Keep current behavior (consistent with NC2 design for private entries). Archived entries get `<link>` but Agent gets 404 if not authenticated.

Recommendation: **Option A**. Archived entries are semantically "removed" — injecting `<link>` for a 404-targeting resource is misleading. Private entries are different: they're actively maintained, just access-controlled.

### [INFORMATIONAL] main.py:71 — `_inject_link` slug not sanitized in HTML attribute

`_inject_link` interpolates `slug` directly into HTML: `href="/api/v1/entries/{slug}/raw"`. Slug validation (`SLUG_PATTERN = r"^[a-z0-9_-]+$"`) is enforced at entry creation time by `validate_slug()`, so no HTML injection is possible through normal flows. However, the catchall passes `path` (user-controlled URL segment) directly as `slug` to `_inject_link` without re-validation.

In practice this is safe because: (a) `_slug_exists` queries the DB and only returns `True` for actual entry slugs that passed `validate_slug`, (b) the `path` is URL-decoded by FastAPI but `<`, `>`, `"` characters would need to be in a valid slug (they're not in `SLUG_PATTERN`). No fix needed, but worth noting.

## Pass 2: INFORMATIONAL — Code Health

### [INFORMATIONAL] main.py:59-67 — `_slug_exists` uses inline import

`_slug_exists` uses `from sqlmodel import Session, select` and `from peekview.models import Entry` as inline imports inside the function body. This is inconsistent with `main.py` top-level imports (line 15 already imports `from sqlalchemy import text`). Since `_slug_exists` is called on every non-frontend HTML request, the inline import adds per-request overhead (Python caches modules after first import, so the cost is a dict lookup, not a re-import — negligible but stylistically inconsistent).

Fix: Move imports to module top-level, or leave as-is (the cost is ~0, and inline imports are used elsewhere in the file for late-binding).

### [INFORMATIONAL] main.py:529-537 — Double DB query for JSON Accept on existing slug

When `_prefers_json` is True and the slug exists, the catchall calls `resolve_entry_raw` which does its own slug lookup (via `EntryService.get_entry` or direct query). The `_slug_exists` query is not executed in the JSON path (it's only in the HTML path at line 542), so there's no double-query issue for the JSON path. The code is correct.

However, the JSON path at line 529 checks `not _is_frontend_route(path)` first, then calls `resolve_entry_raw` which also needs to determine visibility. If `_is_frontend_route(path)` is True, we skip JSON — but we'd also skip HTML `<link>` injection at line 542. This is correct behavior per design.

### [INFORMATIONAL] api/files.py:385-489 — `resolve_entry_raw` does not handle `AuthenticationError`

`resolve_entry_raw` can raise `NotFoundError` but not `AuthenticationError` — authentication failures would need to come from `get_current_user` which returns `None` for anonymous (doesn't raise). The function correctly handles the `None` case by falling through to visibility checks. No issue.

### [INFORMATIONAL] main.py:529 — `resolve_entry_raw` imported inside function

`from peekview.api.files import resolve_entry_raw` is imported inside `serve_spa_catchall` (line 530-531). This is a late import to avoid circular dependencies (main.py → files.py → main.py would be circular if files.py imported anything from main.py). The import is correct and necessary.

### [INFORMATIONAL] Code duplication — `_is_global_api_key_auth` and `_looks_like_jwt` duplicated

`_is_global_api_key_auth` exists in both `api/files.py:144` and `api/entries.py:107`. `_looks_like_jwt` exists in `api/files.py:139`, `api/entries.py:101`, and `auth.py:193`. This is pre-existing duplication, not introduced by T053. Noting for P7 consistency check but not blocking.

## Focus Area Conclusions

### 1. Code follows P2-design.md Plan A?

**Mostly yes.** The implementation follows Plan A (catchall inline) with the expected data flow:
- Static file check → Content Negotiation → `<link>` injection → plain HTML
- Accept parsing matches GitHub-style rules (including `application/xhtml+xml`)
- `FRONTEND_ROUTES` frozenset matches design
- `resolve_entry_raw` extraction matches Plan A Method 3

**Deviation**: P2-design.md line 103 specifies `headers={"Link": f'</api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"'}`, but implementation splits the Link header value across multiple lines (main.py:544-547). Functionally identical, just different formatting.

### 2. `resolve_entry_raw` extraction correct (/raw behavior unchanged)?

**Yes.** `get_entry_raw` is now a thin wrapper delegating to `resolve_entry_raw`. The extracted function preserves all auth/visibility logic:
- Global API key auth path (lines 394-406)
- Normal auth + share cookie fallback (lines 407-423)
- File serialization (lines 428-460)
- Read tracking (lines 477-484)
- JSON serialization with XSS protection (`.replace("</", "<\\/")`)

The `/raw` endpoint behavior is unchanged — test suite confirms 20/20 raw tests pass.

### 3. Catchall logic correct?

**Mostly correct**, with one CRITICAL issue (404 format inconsistency) and one design question (archived entries).

The control flow is:
1. `api/` or `health` prefix → 404 ✅
2. Static file exists → FileResponse ✅
3. Not frontend route + prefers JSON → `resolve_entry_raw` → JSON or 404 ⚠️ (404 format)
4. Not frontend route + slug exists → inject `<link>` + Link header → HTMLResponse ✅
5. Otherwise → plain HTMLResponse ✅

### 4. Code style?

**Pass.** No comments added. Ruff shows only pre-existing errors (N806, B008) — no new violations introduced. Inline imports follow existing pattern in the file.

### 5. Code duplication / optimization?

- `_slug_exists` could reuse `EntryService` but deliberately uses raw SQL for minimal overhead (acceptable).
- `resolve_entry_raw` creates a new `StorageManager` per call (line 390) — same as original `get_entry_raw`, not a regression.
- No unnecessary duplication introduced by T053.

### 6. Error handling?

- `NotFoundError` from `resolve_entry_raw` is caught in catchall (line 533) — but with wrong format (CRITICAL above).
- No other exceptions from `resolve_entry_raw` are caught — `PeekError` subclasses would propagate to the global handler. This is correct.
- `_slug_exists` DB errors would propagate as unhandled exceptions → 500 from generic handler. Acceptable.

## Summary

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | CRITICAL | main.py:533-537 | 404 response format inconsistent with rest of API (`{"detail":...}` vs `{"error":{...}}`) |
| 2 | CRITICAL | main.py:59-67 | `_slug_exists` doesn't filter ARCHIVED entries — `<link>` injection for resources that 404 for anonymous |
| 3 | INFORMATIONAL | main.py:59-63 | Inline imports in `_slug_exists` (style, ~0 cost) |
| 4 | INFORMATIONAL | pre-existing | `_is_global_api_key_auth` / `_looks_like_jwt` duplicated across files (not T053, for P7) |

## Verdict

**needs-revision**: 2 CRITICAL items must be addressed before approval.

Item 1 fix is straightforward: let `NotFoundError` propagate to the `PeekError` handler instead of catching and reformatting. Item 2 requires a design decision on whether archived entries should get `<link>` injection.
