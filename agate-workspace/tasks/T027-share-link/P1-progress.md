# P1 Progress Log

## 2026-06-29 — Initial Read

- Read analyst.md role definition
- Read P0-brief.md (full)

### Key observations from P0-brief:

1. **P0 is very thorough**: 11 user_decisions, detailed known_risks, 13 backend + 16 frontend acceptance criteria
2. **Security-sensitive**: token generation, hash storage, timing attack prevention, session isolation
3. **Coordination dependency**: T021 must complete P4 before T027 starts
4. **pruning_tendency: conservative** — all phases P1-P8, no pruning
5. **P0 already contains significant solution details** (table schema, API endpoints, service methods) — P1 should focus on requirements, not repeat the design

### First question to investigate:
- Does the current entry model already have any share-related fields?
- What does EntryDetailView currently look like?
- How does auth currently work for private entries?

## 2026-06-29 — Codebase Exploration Results

### Backend findings:
- Entry model: has `is_public`, `owner_id`, `slug`, `expires_at` — no share-related fields
- Private entry access: `EntryService.get_entry()` returns 404 (not 403) for non-owners of private entries
- Auth: 3-layer (JWT cookie > Bearer header > API key), `get_current_user` returns User|None
- Database: uses `_run_migrations()` pattern with ALTER TABLE for schema evolution
- No share-related code exists anywhere in the codebase
- File access also uses same visibility check (`_resolve_entry()` in files.py)

### Frontend findings:
- EntryDetailView: owner sees Visibility Toggle + Delete; no Share button
- Owner check: `authStore.isOwner(entry.ownerId)`
- Dialog pattern: Teleport + Transition + defineModel (ConfirmDialog, LoginDialog)
- Stores: auth.ts, entry.ts, theme.ts — no share store
- Router: `/:slug` is the detail route (not `/entries/:slug`)
- API client: PeekAPI singleton with snake_case → camelCase transform
- Toast system and Clipboard API already in use

### Implicit requirements identified so far:
1. **File access via share token** — P0 only mentions entry detail, but files endpoint also needs share token check
2. **Raw content access via share token** — `/{slug}/raw` redirect also needs share awareness
3. **HTML render access via share token** — render route has special CSP, needs share check too
4. **Share token in frontend state** — when accessing via ?share=token, frontend needs to know it's a share view (for watermark, hiding owner actions)
5. **entry.ts store changes** — loadEntry needs to pass share token to API
6. **MCP Server** — does MCP need share awareness? P0 doesn't mention MCP, but user_decisions #8 (private→public auto-revoke) affects MCP-created entries
7. **CLI** — does CLI need share commands? P0 doesn't mention CLI
8. **API key auth + share** — what happens when API key user accesses ?share=token? Does global API key bypass share validation?
9. **Entry expiration vs share expiration** — entry may expire before share does; what happens?
10. **Share for already-expired entries** — can you create a share for an entry that's expired?
11. **Multiple shares per entry** — P0 implies yes (list/batch revoke), but should there be a limit?

## 2026-06-29 — Deep Exploration: File Access, Render, MCP, CLI

### Critical implicit requirement confirmed:
- **File content, download, raw, and HTML render endpoints ALL use _resolve_entry()** which calls EntryService.get_entry() for visibility check
- Share token validation must be integrated into this same path — otherwise share links break for files/renders
- The raw shortlink redirect does NO auth (just 302), so share token must survive the redirect or be passed through

### MCP/CLI findings:
- MCP has 5 tools: create_entry, publish_files, get_entry, list_entries, delete_entry — NO share tools
- CLI has no share commands
- **Question**: Should MCP/CLI get share tools? P0 doesn't mention them. 
  - MCP: Agent might want to share an entry it created. But P0 user_decision #11 says "不做" list doesn't include MCP share tool. However, scope only mentions backend + frontend.
  - CLI: Admin might want to create share links from CLI. Same consideration.
  - **Decision**: P0 scope explicitly lists only backend (new table + 3 endpoints + service) and frontend (2 components + view changes). MCP and CLI are NOT in scope. This is correct — share management is a browser UX concern (copy link, see watermark, etc.). Mark as [NOT_IN_SCOPE] for P1.

### Additional implicit requirements identified:
12. **Share token must work for ALL entry-related endpoints** — not just GET entry detail. Files, raw, download, render all go through _resolve_entry().
13. **Raw shortlink redirect** — `/{slug}/raw` does 302 to `/api/v1/entries/{slug}/raw`. Share token in query param `?share=token` needs to survive this redirect. The redirect just changes path, query params should be preserved... but need to verify FastAPI's RedirectResponse behavior.
14. **EntryResponse needs share context** — when accessing via share token, the response should indicate "this is a share view" so frontend can show watermark and hide owner actions. Need a field like `share_access: true` or `access_via: "share"`.
15. **Download ZIP endpoint** — also needs share token access
16. **share token format in URL** — `?share={token}` on the page route, but API calls also need the token. Frontend must attach it to API requests. How? As query param on every API call? Or via cookie set on first successful share validation?
17. **P0 mentions share cookie** — `peekview_share_{entry_id}` with token prefix, HTTPOnly, SameSite=Lax. This is the mechanism: first access validates token and sets cookie, subsequent API calls use cookie. This means _resolve_entry needs to also check share cookies.
18. **Cookie-based share access for API calls** — the frontend doesn't need to pass ?share= on every API call if the cookie is set. But the cookie uses token_prefix, not full token — so backend can validate cookie against share records.
19. **Entry expiration interaction** — EntryResponse includes `expires_at`. If entry expires, share access should also fail (entry itself becomes inaccessible). P0 doesn't explicitly state this but it's implied by "entry 还在 + share 未过期 + share 未撤销 → 可访问".
20. **Share creation for expired entries** — Should owner be able to create shares for their own expired entries? Probably not useful, but no explicit restriction. Mark as low-priority edge case.
21. **Max shares per entry** — P0 doesn't specify a limit. Should there be one to prevent abuse? 

## 2026-06-29 — Test Baseline & Dependency Check

### Test counts (current):
- Backend: 587 tests (P0 said 577, now 587 — 10 more added since P0)
- Frontend: 479 tests across 35 files (P0 said 86+16=102, now much more)
- P0's "577 tests still green" acceptance criterion should be updated to "587 tests still green"

### T021 dependency:
- T021 (zen-mode) is COMPLETED (P8). Dependency cleared.
- T024, T025, T026 also completed. All coordination dependencies resolved.

### Key discrepancy with P0:
- P0 says "86+16 现有测试仍全绿" for frontend acceptance — actual count is 479. 
- This is because P0 was written before recent test additions. P1 should use current count.

## 2026-06-29 — Starting P1 Requirements Document

### Structure plan:
1. Requirements restatement (structured)
2. Implicit requirements (the key value-add of P1)
3. BDD acceptance criteria (from P0's 13+16 quantitative conditions)
4. Pending confirmations ([NEED_CONFIRM] items)
5. Pruning declaration
6. Scope declaration (packages, domains, ui_affected)
7. Capability requirements

### Implicit requirements summary (final list):
1. Share token must work for ALL entry-related endpoints (files, raw, download, render)
2. Share cookie mechanism for subsequent API calls after initial token validation
3. EntryResponse needs share context field for frontend watermark/action hiding
4. Entry expiration blocks share access (entry must be active + not expired)
5. Share creation should be blocked for expired entries
6. Max shares per entry — need a limit to prevent abuse
7. Global API key auth should bypass share validation (already bypasses visibility)
8. Admin should see shares for any entry (not just own)
9. Share list should include token prefix (not full token) for display
10. Frontend must handle ?share= token on page load (validate + set cookie + show content)
11. Share access should not increment entry view count (only share view_count)
12. Concurrent share creation for same entry — no race condition
13. Share token in URL fragment vs query param — query param is P0 decision, but this means token appears in server logs and Referer headers

## 2026-06-29 — Security Analysis of Share Token in Query Params

### Risk: Token in query parameter (?share=token)
- Token appears in server access logs (nginx/apache/backend)
- Token may leak via Referer header when navigating to external links from the shared page
- Token appears in browser history
- Token appears in shared screenshots if URL bar is visible

### Mitigations already in P0:
- Token is single-use per access validation (but cookie persists)
- Token can be revoked
- Token has expiration

### Additional mitigations to consider:
- Set Referrer-Policy: no-referrer for share-accessed pages (prevents token leak via Referer)
- This is an implicit security requirement NOT in P0

### Risk: Cookie-based share access
- Cookie `peekview_share_{entry_id}` with token prefix
- HTTPOnly = JS can't read it (good)
- SameSite=Lax = not sent on cross-site POST (good)
- But: cookie survives browser restart — if share is revoked, cookie is still set
- P0 acknowledges: "owner 撤销时，后端清掉所有匹配 cookie（无法精准清，但下次该 token 验证失败就进不去）"
- Actually, HTTPOnly cookies can't be cleared by backend without specific Set-Cookie response
- Better approach: don't try to clear cookies on revoke; just validate share status on every request (cookie only identifies "which share token prefix", backend validates the actual share record)
- This is consistent with P0's approach

### Conclusion: Need to add Referrer-Policy as implicit security requirement

## 2026-06-29 — Building P1 Requirements Document Now

All exploration complete. Writing P1-requirements.md.

## 2026-06-29 — P1-requirements.md Written

### Content summary:
- **Section 1** (Requirements Restatement): Structured problem statement + core behaviors + reference to P0 user_decisions
- **Section 2** (Implicit Requirements): 12 items identified that P0 did not explicitly state
  - Critical: share token must work for ALL sub-resources (files, raw, download, render), not just entry detail
  - Critical: EntryResponse needs share_access context field
  - Critical: Referrer-Policy: no-referrer for share-accessed pages
  - Important: share cookie mechanism for subsequent API calls
  - Important: max shares per entry limit
  - Supporting: entry expiration blocks share access, expired entries can't get new shares
- **Section 3** (BDD Acceptance Criteria): 33 backend + 19 frontend = 52 BDD conditions total
  - Backend: creation (B01-B06), validation/access (B07-B16), cookie (B17-B19), list (B20-B22), revocation (B23-B25), auto-revocation (B26-B27), cascade (B28-B29), security (B30-B32), backward compat (B33)
  - Frontend: share button/dialog (F01-F04), management panel (F05-F08), share access UX (F09-F14), visibility toggle (F15-F16), type safety (F17-F18), backward compat (F19)
- **Section 4** (Pending Confirmations): No [NEED_CONFIRM] items — all user decisions confirmed in P0
- **Section 5** (Pruning): All 8 phases, no pruning (conservative)
- **Section 6** (Scope): backend + frontend-v3 packages; backend/frontend/api/security/database domains; 3 UI areas affected; MCP/CLI explicitly NOT IN SCOPE
- **Section 7** (Capability Requirements): All available (browser-vision, e2e-testing, security-validation, concurrent-testing)

### Quality self-check:
- [x] At least 1 BDD acceptance condition (52 total)
- [x] Every BDD condition is binary verifiable (PASS/FAIL)
- [x] No [NEED_CONFIRM] items
- [x] No status: GAP
- [x] Implicit requirements actively identified (12 items, not just restating P0)
- [x] No solution design in P1 (describes WHAT, not HOW)
- [x] Pruning declaration with per-phase rationale
- [x] Scope includes packages, domains, ui_affected
- [x] Capability requirements all status: available
