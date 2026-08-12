
## P1 Progress — 2026-07-12

### Step 1: Read all input files
- [x] analyst.md — role definition read
- [x] P0-brief.md — task brief read
- [x] P1-dispatch-context.md — dispatch context read
- [x] WORKFLOW.md — workflow spec read

### Step 2: Initial findings from P0-brief
- P0 proposes 3-layer solution: Content Negotiation + HTML self-description + llms.txt
- P0 declares "no frontend UI changes" — needs questioning
- SPA catchall doesn't distinguish valid slugs from frontend routes — implicit requirement for slug existence check
- llms.txt currently 302 redirect to GitHub — changing to backend-served is a behavior change
- Content Negotiation Accept header priority is core safety boundary

### Step 3: Key questions to investigate
1. Does Content Negotiation affect frontend? (P0 says no — verify)
2. Is slug existence check required for <link> injection?
3. What happens when Accept header has both application/json and text/html with equal q?
4. Does llms.txt change from redirect to direct serve affect anything?
5. Are there edge cases in Accept header parsing that could leak JSON to browsers?

### Step 4: Code investigation findings
- SPA catchall (main.py L468-484): returns FileResponse(index.html) for ALL non-api/health paths
- No Accept header handling anywhere in catchall
- No slug existence check in catchall
- /raw endpoint (files.py L385-460): full auth/visibility logic already exists
- Frontend routes: /, /explore, /users/:username, /:slug, /settings/apikeys, /:pathMatch(.*)*
- llms.txt: simple 302 redirect to GitHub, no backend content
- /login route NOT in router.ts (likely handled by dialog component, not route)

### Step 5: Implicit needs identified
1. **Slug existence check for <link> injection**: SPA catchall serves index.html for ALL paths including non-existent slugs. Injecting <link rel="alternate"> for non-existent entries is misleading. Must check DB.
2. **Frontend route exclusion list**: /explore, /settings/apikeys, /users/*, /login should NOT get <link> injection. But /:slug is dynamic — can't exclude by pattern alone, need DB check.
3. **Content Negotiation does NOT affect frontend UI**: Frontend JS always fetches via /api/v1/... endpoints, never via /{slug}. The SPA catchall only serves index.html. Content Negotiation changes what the catchall returns for non-browser requests. P0's "no frontend UI changes" is CORRECT.
4. **llms.txt behavior change**: Currently 302 → GitHub. Changing to backend-served means: (a) no redirect, (b) content must be maintained in backend code, (c) /raw API description must be added. This is a significant behavior change.
5. **Accept header edge cases**: */* must NOT trigger JSON (curl default). application/json without text/html should trigger JSON. application/json;q=0.5 with text/html should return HTML.
6. **Private entry access via Content Negotiation**: If Agent sends Accept: application/json for a private entry, should it get 404 (current /raw behavior) or the SPA page? Must match /raw behavior.
7. **CSP considerations**: Adding <link> to HTML head doesn't affect CSP. Adding Link HTTP header doesn't affect CSP. No CSP change needed.
8. **Entry not found case**: When slug doesn't exist in DB, Content Negotiation should still return the SPA page (404 is handled by frontend JS). But <link> injection should be skipped.

### Step 6: llms.txt investigation
- Root llms.txt: describes PeekView overall, mentions /raw endpoint but only as "GET /api/v1/entries/{slug}/raw"
- MCP llms.txt: describes MCP server only
- Current backend: 302 redirect to GitHub raw — no backend-served content
- P0's "layer 3" says "supplement /raw API description" — but this means changing from redirect to direct serve
- Key question: should llms.txt be backend-served (dynamic) or stay as redirect to static GitHub file?
  - If backend-served: can include instance-specific info (base URL, available entries)
  - If redirect: stays generic, no backend change needed for content updates
  - P0 implies adding /raw description to existing llms.txt — but current llms.txt already mentions /raw

### Step 7: Content Negotiation edge cases (from P0-brief GitHub verification)
- Accept: application/json → JSON (no text/html present)
- Accept: application/json, text/html → JSON (json listed first, same q)
- Accept: text/html, application/json → HTML (html listed first, same q)
- Accept: text/html, application/json;q=0.9 → HTML (html has higher effective q)
- Accept: */* → HTML (wildcard does not match application/json specifically)
- Browser Accept → HTML (text/html always first)
- Accept: application/json;q=0.1, text/html;q=0.1 → HTML? (equal q, html listed first? or json listed first?)
  - RFC 7231: items with same q value follow listing order — first listed wins
  - But this is an edge case unlikely in practice

### Step 8: "No frontend UI changes" — verification
- Content Negotiation: changes what backend returns for /{slug} based on Accept header
  - Frontend JS never requests /{slug} — it requests /api/v1/entries/{slug}
  - SPA catchall only serves index.html shell — frontend JS handles routing
  - VERDICT: No frontend code change needed. P0 is CORRECT.
- <link> injection: adds to HTML head of index.html
  - Frontend JS doesn't parse <link rel="alternate"> — no impact
  - VERDICT: No frontend code change needed.
- Link HTTP header: added to response headers
  - Frontend JS doesn't use Link headers — no impact
  - VERDICT: No frontend code change needed.
- llms.txt: backend-only endpoint, no frontend involvement
  - VERDICT: No frontend code change needed.

CONCLUSION: P0's "no frontend UI changes" is CORRECT. domains should NOT include 'frontend'.

### Step 9: Private entry handling under Content Negotiation
- /raw endpoint returns 404 for private entries (not 403, to prevent slug enumeration)
- Content Negotiation for /{slug}: if Accept wants JSON but entry is private/unauthed:
  - Option A: Return 404 (same as /raw) — breaks the pattern of SPA always returning HTML for /{slug}
  - Option B: Return HTML (SPA page) regardless — private entry page shows "not found" in frontend
  - Option C: Return 406 Not Acceptable — RFC 7231 compliant when server can't produce requested format
  - Analysis: Option B is simplest and safest. The SPA page handles the 404 display. The key insight is: Content Negotiation is a convenience layer, NOT an auth bypass. If Agent can't access /raw, they also can't get JSON via /{slug}.
  - BUT: If Agent sends Accept: application/json AND has auth (cookie/API key), should they get JSON directly?
  - This is a significant implicit requirement: Content Negotiation must respect auth.

### Step 10: Summary of implicit needs
1. Slug existence check for <link> injection (avoid injecting for non-existent entries)
2. Frontend route exclusion for <link> injection (avoid injecting for /explore, /settings/apikeys, etc.)
3. Auth-aware Content Negotiation (respect entry visibility rules when returning JSON)
4. llms.txt behavior change (302 redirect → backend-served content, or keep redirect and update GitHub file)
5. Edge case: Accept header with only application/json for non-existent/private entry → should return what?
6. Entry service query needed in SPA catchall (currently no DB access)

### Step 11: Three-layer completeness check
- Layer 1 (Content Negotiation): Covers agents that explicitly request JSON. ✅
- Layer 2 (HTML self-description): Covers agents that get HTML and parse it. ✅
- Layer 3 (llms.txt): Covers agents that proactively check /llms.txt. ✅
- Missing coverage: None identified — the three layers cover all common agent discovery patterns.
- BUT: Layer 3 currently redirects to GitHub. If the instance is private/self-hosted, the GitHub llms.txt is generic and doesn't describe the instance's specific /raw endpoint behavior. Should llms.txt be instance-aware?

### Step 12: [NEED_CONFIRM] candidates
1. llms.txt: keep redirect to GitHub or change to backend-served? (affects scope significantly)
2. Auth-aware Content Negotiation: should /{slug} with Accept: application/json + auth return JSON for private entries? (security boundary decision)

### Step 13: llms.txt analysis — deeper look
- Current root llms.txt already mentions /raw: "GET /api/v1/entries/{slug}/raw — structured JSON, public entries no auth, private entries need API key"
- P0 says "supplement /raw API description" — but it's already there!
- The real gap: llms.txt doesn't mention Content Negotiation (the new feature). After T053, agents should know they can use Accept: application/json on /{slug}.
- Two options for llms.txt update:
  A. Update the static file on GitHub (low effort, but requires separate deploy for content changes)
  B. Change to backend-served (higher effort, but content stays in sync with backend version)
- P0's "layer 3" is minimal — just "supplement content". The simplest path is updating the GitHub file.
- BUT: if we add Content Negotiation, the llms.txt should describe it. And if llms.txt is backend-served, it can dynamically reflect the actual capabilities.
- Decision: This is a [NEED_CONFIRM] — the scope difference between "update GitHub file" and "backend-served dynamic llms.txt" is significant.

### Step 14: Final implicit needs review (5 Whys)
Q: Why can't agents discover /raw?
A: Because /{slug} returns SPA HTML with no hints.
Q: Why no hints?
A: Because SPA catchall doesn't inject any discovery metadata.
Q: What if we only do Content Negotiation (Layer 1)?
A: Agents using curl with default Accept: */* still get HTML with no hints. They need Layer 2.
Q: What if we only do HTML self-description (Layer 2)?
A: Agents that explicitly prefer JSON still get HTML first, then have to parse and re-request. Layer 1 is more efficient.
Q: What if we skip Layer 3 (llms.txt)?
A: Agents that proactively check llms.txt won't find /raw description. But current llms.txt already mentions /raw. The gap is only about Content Negotiation description.
→ All three layers are needed, but Layer 3 is minimal (just update existing content).

### Step 15: BDD conditions draft
B1: Content Negotiation — JSON preferred
B2: Content Negotiation — HTML preferred  
B3: Content Negotiation — wildcard */*
B4: Content Negotiation — browser Accept
B5: Content Negotiation — private entry without auth
B6: Content Negotiation — private entry with auth
B7: Content Negotiation — non-existent slug
B8: HTML <link> injection — valid slug
B9: HTML <link> injection — non-existent slug
B10: HTML <link> injection — frontend route
B11: HTTP Link header — valid slug
B12: HTTP Link header — non-existent slug
B13: llms.txt — /raw API description present
B14: End-to-end — Agent with Accept: application/json discovers and gets JSON
B15: End-to-end — Agent with curl default discovers /raw via <link>

### Step 16: P1-requirements.md written
- 8 implicit needs identified (I1-I8)
- 17 BDD conditions written (B1-B17)
- 2 [NEED_CONFIRM] items (NC1: llms.txt path, NC2: private entry <link> injection)
- Phases: P1-P6 (P7/P8 pruned with reasons)
- Risk level: medium (security boundary but limited scope)
- requires_minimal_validation: true (RFC 7231 Accept header behavior)

### Step 17: Self-check
- [x] BDD conditions ≥ 1 (17 conditions)
- [x] domains/packages/risk_level/phases declared
- [x] capability_requirements declared
- [x] [NEED_CONFIRM] items present (2 items) — but these are directional questions, not blockers
- [x] No status: GAP
- [ ] Need to verify file exists and BDD conditions present via grep
