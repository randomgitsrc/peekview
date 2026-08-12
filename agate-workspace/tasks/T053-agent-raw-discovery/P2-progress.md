## P2 Progress — 2026-07-13T00:09:06+08:00

### Step 1: Read input files
- P0-brief: read. Key: 3-layer discovery, debug_env :8888, risk medium
- P1-requirements: read. Key: 20 BDD, 11 implicit reqs, NC1/NC2 resolved
- P2-dispatch-context: read. Key: route order, catchall impl, /raw auth logic
- architect.md: read. Key: P2 must produce design + files_to_read + minimal_validation

### Step 2: Minimal validation — GitHub Accept header behavior
CRITICAL FINDING: P0-brief claims GitHub uses q-value priority (JSON wins when q higher).
ACTUAL GitHub behavior: When both text/html and application/json are acceptable,
HTML ALWAYS wins regardless of q values. JSON only returned when text/html is NOT
in the acceptable set. This is SIMPLER and SAFER than P0's description.

Verified with curl against github.com/python/cpython:
- Accept: application/json → JSON (only json acceptable)
- Accept: application/json, text/html → HTML (both present, html wins)
- Accept: application/json;q=1.0, text/html;q=0.1 → HTML (both present, html wins)
- Accept: */* → HTML (wildcard doesn't count as json)
- Accept: text/html;q=0, application/json → JSON (html explicitly not acceptable)

This means: P0's B5 (q=0.9 vs q=0.8 returns JSON) is WRONG per GitHub behavior.
GitHub would return HTML. Design must follow ACTUAL GitHub behavior.


### Step 3: Source code analysis
- main.py L468-484: SPA catchall — checks api/health prefix, then file exists, then index.html
- main.py L421-423: raw_shortlink registered BEFORE catchall (safe, won't be affected)
- files.py L385-506: /raw endpoint — full auth logic (global_key_auth + get_entry + _check_share_cookie)
- files.py L144-163: _is_global_api_key_auth — duplicated in entries.py (same logic)
- files.py L171-222: _resolve_entry — shared helper for file sub-resources, includes share cookie
- entries.py L68-98: _check_share_cookie — share cookie fallback for private entries
- auth.py L137-190: get_current_user — JWT + cookie + API key, returns User|None
- entry_service.py L313-344: get_entry — visibility check (public/owner/admin), raises NotFoundError
- router.ts: routes = /, /explore, /users/:username, /:slug, /settings/apikeys, /:pathMatch(.*)
- index.html: has </head> tag, clear injection point

### Step 4: Design decisions
1. Accept parsing: Hand-written (no `accept` PyPI package). GitHub-style rule: JSON only when
   text/html is NOT acceptable. Simpler and safer than RFC 7231 full q-value sorting.
2. Auth reuse: Call get_entry_raw() directly from catchall (it already has all auth logic).
   Alternative: extract shared function — but /raw is the ONLY consumer, direct call is simpler.
3. Frontend route exclusion: Hardcoded set + DB query natural exclusion. No regex needed.
4. <link> injection: String replacement on index.html content (replace </head> with <link> + </head>).
   Read file → modify → return HTMLResponse. Simple, no template engine.
5. Link header: Add to HTMLResponse headers dict. Trivial.
