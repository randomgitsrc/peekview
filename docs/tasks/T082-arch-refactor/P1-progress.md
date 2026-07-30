# P1 Progress Log — T082-arch-refactor

## Step 1: Read dispatch-context + role definition + P0-brief
- Status: DONE
- Read P1-dispatch-context-analyst.md (160 lines)
- Read analyst.md role definition (153 lines)
- Read P0-brief.md (83 lines)
- Key understanding: Pure refactoring task, 6 structural issues (4 backend + 2 frontend), BDD = behavior zero-regression
- [PROD_NOT_TOUCHED]

## Step 2: Read all 11 input source files
- Status: DONE
- Files read: entries.py (545 lines), files.py (541 lines), auth.py (224 lines), exceptions.py (215 lines), main.py (621 lines), entry_service.py (1066 lines), admin_service.py (975 lines), entry.ts (223 lines), EntryDetailView.vue (1003 lines)
- Key findings confirmed:
  - DI 3 modes: A (Depends+fallback), B (app.state.*), C (route-level new StorageManager+Session)
  - Cross-service new: AdminService→EntryService (line 226, 275), EntryService→ReadTrackingService (line 999), EntryService→ShareService (line 1022), auth.py→ApiKeyService (line 185), files.py→ShareService (line 219)
  - Duplicate code: _looks_like_jwt (3 copies), _is_global_api_key_auth (2 copies), _record_read_async (2 copies)
  - HTTPException残留: entries.py:205, admin.py:57, auth.py:208/240/261/266, main.py:535/580
  - create_entry事务: line 229 commit before file writes, line 296-302 cleanup but entry already committed
  - entry.ts: 223 lines, 3 concerns mixed (list+detail+UI), loadSeq module-level
  - EntryDetailView.vue: 1003 lines (335 template + 473 script + 195 style)
- [PROD_NOT_TOUCHED]

## Step 3: Frontend error format dependency analysis
- Status: DONE
- Found 3 components reading `e.response?.data?.detail`:
  - ExpiresInDialog.vue:66 → `error.value = e.response?.data?.detail || e.message`
  - SecurityTab.vue:71 → `const detail = err?.response?.data?.detail`
  - ProfileTab.vue:74 → `toast.error(err?.response?.data?.detail || 'Failed to update profile')`
- These endpoints (auth/me PATCH, apikeys) currently use HTTPException → return `{"detail":"..."}`
- After migration to PeekError → return `{"error":{"code","message","details":null}}`
- Frontent must be updated to read `.error.message` instead of `.detail`
- LoginDialog.vue:157/161 reads `e.detail` but that's a DOM CustomEvent, NOT HTTP error — not affected
- API client (client.ts) has no centralized error message extraction — each component handles errors locally
- [PROD_NOT_TOUCHED]

## Step 4: Additional dependency analysis
- Status: DONE
- searchUrl.logic.ts is pure functions, used by EntryListView (not EntryDetailView) — store split won't affect
- Test count: 976 (backend pytest test functions)
- Frontend tests: vitest + jsdom
- HTTPException locations confirmed: entries.py:205, auth.py:208/240/261/266, admin.py:57, main.py:535/580
- main.py:535/580 are infrastructure (metrics disabled, SPA catchall 404) — may remain as HTTPException
- Auth endpoints returning HTTPException that frontend reads `.detail` from: auth/me PATCH (ProfileTab), auth/change-password (SecurityTab)
- [PROD_NOT_TOUCHED]

## Step 5: Writing P1-requirements.md
- Status: IN PROGRESS
