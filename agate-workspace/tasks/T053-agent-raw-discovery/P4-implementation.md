---
phase: P4
task_id: T053
type: implementation
parent: P3-test-cases.md
trace_id: T053-P4-20260713
status: complete
created: 2026-07-13
agent: implementer
---

implementation_dir: backend/peekview/

# T053 P4 Implementation

## Files Modified

| File | Change |
|------|--------|
| `backend/peekview/main.py` | Added `_prefers_json`, `_is_frontend_route`, `_slug_exists`, `_inject_link` module-level functions; modified `serve_spa_catchall` for Content Negotiation + HTML self-description; added `NotFoundError` import |
| `backend/peekview/api/files.py` | Extracted `resolve_entry_raw` from `get_entry_raw`; refactored `get_entry_raw` to delegate to `resolve_entry_raw` |

## Implementation Summary

### main.py

- `_prefers_json(accept_header)`: GitHub-style Accept parsing — JSON only when `application/json` acceptable AND `text/html`/`application/xhtml+xml` NOT acceptable. `*/*` does not trigger JSON.
- `_is_frontend_route(path)`: Checks against `FRONTEND_ROUTES` frozenset and `users/` prefix to skip DB queries for known SPA routes.
- `_slug_exists(request, slug)`: Direct DB query via `Session` + `select(Entry).where(Entry.slug == slug)` — existence check only, no visibility check (per NC2: `<link>` is a pointer, not content disclosure).
- `_inject_link(html, slug)`: String replacement of `</head>` with `<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />\n</head>`.
- `serve_spa_catchall`: After static file check, before serving index.html:
  1. If not frontend route AND `_prefers_json` → call `resolve_entry_raw` → JSON or 404
  2. If not frontend route AND `_slug_exists` → inject `<link>` + add `Link` header → HTMLResponse
  3. Otherwise → plain HTMLResponse

### api/files.py

- `resolve_entry_raw(request, slug)`: Extracted from `get_entry_raw`. Contains all auth/visibility logic (global API key, normal auth, share cookie). Called by both `get_entry_raw` endpoint and catchall.
- `get_entry_raw`: Now a thin wrapper that delegates to `resolve_entry_raw`.

## Self-check Results

- `pytest tests/test_content_negotiation.py`: 33/33 passed
- `pytest -k "raw"`: 20/20 passed (no regression in /raw endpoint)
- `ruff check peekview/main.py peekview/api/files.py`: No new errors (pre-existing N806/B008 only)

## SCOPE+ Items

None discovered during implementation.
