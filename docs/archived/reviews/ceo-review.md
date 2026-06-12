# Peek MVP — Adversarial Strategic Review

> Reviewer: Independent CEO/Strategist
> Date: 2026-04-18
> Document: `docs/plans/impl-plan.md` (4570 lines, 20 tasks)
> Prior review consulted: `docs/specs/spec-review-report.md`

---

## 1. Is This the Right Problem? Could a Reframing Yield 10x Impact?

**Verdict: The problem is real but the framing is too narrow.**

The plan defines Peek as "a lightweight code & document formatting display service" where Agents create entries and humans view them. This is a *utility*, not a *platform*. The 10x reframe:

**Current framing:** Agent → Peek → Human sees pretty code
**10x framing:** Peek as the **output layer for AI agent workflows** — the "stdout" for agent-generated artifacts.

The difference: the first is a pastebin with better rendering. The second is infrastructure that every agent framework needs. Right now, every AI coding tool (Cursor, Copilot, Aider, Claude Code) has its own half-baked way of presenting output to users. Peek could be the universal presentation layer.

**What this reframe changes:**
- MCP integration becomes P0, not a stub
- Streaming output (Agent produces code incrementally → Peek updates in real-time) becomes critical
- Embed/iframe becomes the primary distribution model, not standalone pages
- Agent framework plugins (not just CLI) become the growth vector

**Severity: CRITICAL** — Building a pastebin++ has limited upside. Building agent output infrastructure has platform potential.

**Fix:** Reposition around "Agent Output Layer" before writing a line of code. This changes API design (streaming), integration priorities (MCP, not CLI), and distribution model (embed, not standalone).

---

## 2. Are the Premises Stated or Just Assumed?

| # | Premise | Stated? | Could Be Wrong? | Impact if Wrong |
|---|---------|---------|-----------------|-----------------|
| 1 | Agents will use REST API/CLI to push content | Assumed | **Yes.** Agents increasingly use tool-calling protocols (MCP, function calling). Raw REST is low-level. | API design is wrong level of abstraction |
| 2 | Users view content in a standalone browser page | Assumed | **Yes.** Most agent interaction happens inside IDEs and chat UIs. Users don't want to context-switch to a separate tab. | Standalone SPA is the wrong frontend shape |
| 3 | SQLite is sufficient for single-instance use | Stated | **Probably fine for MVP.** But multi-agent teams sharing one instance will hit write contention fast. | WAL mode helps but doesn't eliminate this |
| 4 | Local filesystem storage is acceptable | Assumed | **Yes.** Makes Peek impossible to deploy in containerized/orchestrated environments without volume management. | Docker adoption blocked |
| 5 | No authentication needed for MVP | Assumed | **Dangerous.** A service that accepts arbitrary file paths from agents and serves them over HTTP with zero auth is a security liability. | See Section 10 |
| 6 | Shiki can handle all highlighting needs | Assumed | **Partially.** Shiki's WASM-based highlighting is slow for large files (>5000 lines). Plan has no performance budget. | CodeViewer will feel sluggish on real-world files |

**Severity: HIGH** — Premises 1 and 2 being wrong means the core interaction model is misdesigned.

**Fix:** Validate the primary interaction model with actual agent workflows BEFORE building. Wire up a minimal MCP tool and test with Claude Code / Cursor. If agents never call it because the CLI is easier, the API-first design is validated. If they want MCP-first, pivot before building 20 tasks.

---

## 3. Six-Month Regret Scenario

**"We built a beautiful pastebin that nobody uses because agents output to GitHub Gists and developers just open files in their IDE."**

Specific regret path:
1. MVP ships. It works. The rendering is nice.
2. Agent developers don't adopt because: (a) adding a new dependency to their workflow is friction, (b) MCP integration was "stubbed," (c) they already have GitHub/Slack/Notion output channels.
3. The few users who try it hit the "no auth, everything is public" wall and stop using it for anything sensitive.
4. Without user traction, the project becomes a portfolio piece, not a product.

**What looks foolish:** Spending 20 tasks building CRUD + rendering when the actual value is in the *integration surface* — which was deferred.

**Severity: HIGH**

**Fix:** Ship in two phases:
- **Phase 0 (2 days):** MCP server only, no frontend. Agent calls a tool → gets a URL → user opens URL that serves a minimal HTML page rendered server-side. Prove the integration model works.
- **Phase 1:** Then build the full SPA if Phase 0 validates.

---

## 4. What Alternatives Were Dismissed Without Sufficient Analysis?

| Alternative | Dismissed Because | Why Dismissal Is Wrong |
|------------|-------------------|----------------------|
| **Server-side rendering (SSR) only, no SPA** | Assumed SPA is needed | An SSR approach (Jinja templates + Shiki on server) would eliminate the entire Vue frontend (Tasks 14-16, ~30% of plan), ship faster, and be more SEO/share-friendly. No analysis of this tradeoff. |
| **GitHub Gist API as backend** | Not mentioned | If the core value is rendering, why not use Gist for storage and Peek for display? Eliminates entire backend storage/security concern. |
| **Static site generator approach** | Not considered | Agent creates entry → Peek generates a static HTML file → serves it. No database, no API server process, no SQLite. Could be a CLI that outputs HTML files to a directory served by nginx/caddy. |
| **VS Code extension** | Not considered | The primary viewing context for code is an IDE. An extension that renders Peek entries inline in VS Code might have 10x the adoption of a standalone web page. |
| **Existing open-source pastebin** (PrivateBin, Stikked, etc.) | Not mentioned | No competitive analysis of what could be forked/extended instead of built from scratch. |

**Severity: MEDIUM**

**Fix:** Before executing, spend 4 hours evaluating SSR-only vs SPA. If SSR can deliver 80% of the value at 40% of the effort, the frontend tasks should be radically simplified or eliminated.

---

## 5. Competitive Risk

**Who could solve this first/better?**

| Competitor | Risk Level | Why |
|-----------|-----------|-----|
| **GitHub** (Gist + Copilot integration) | **Critical** | GitHub already has the storage (Gist), the rendering, and the agent integration (Copilot). If they add MCP-to-Gist, Peek is irrelevant. |
| **Anthropic/Claude Code** | **High** | Claude Code already renders code in its own UI. If they add a "share this output" button, they solve the problem without Peek. |
| **Carbon/ray.so** | **Medium** | They own the "beautiful code display" mindshare. If they add API + multi-file support, they absorb Peek's core value. |
| **Anysphere (Cursor)** | **Medium** | Cursor has agent output rendering in-IDE. A "share" feature is a trivial extension. |

**The moat is thin.** Peek's differentiators are: (1) MCP integration, (2) self-hosted, (3) multi-file + directory tree. But (1) is stubbed, (2) is only valuable if deployment is trivial (and the plan has no Docker/deployment story), and (3) is replicable in a weekend.

**Severity: HIGH**

**Fix:** Speed to market with MCP integration is the only defensible play. If Peek isn't the first MCP-native code sharing tool with actual agent adoption, it loses. Move MCP from "stub" to Task 5.

---

## 6. Scope Calibration — Too Big or Too Small?

**MVP is too big in the wrong dimensions and too small in the right ones.**

**Too big (should cut):**
- Task 12: CLI with 5 commands (serve, create, list, get, delete) — The CLI `create` command calls the HTTP API, which requires the server to be running. This is a weird UX. Either make the CLI work without the server (direct DB/filesystem manipulation) or cut it and let agents use the API directly.
- Task 19: PATCH /entries/{slug} with update logic — Update adds significant complexity (file add/remove, FTS reindex). Agents can delete+recreate. Cut from MVP.
- Task 18: Expiry cleanup service — Nice to have, but agents can manually delete. Cut from MVP.
- Mermaid rendering (in package.json) — The review report itself recommended demoting this. It adds bundle size and complexity.
- ImageViewer, BinaryViewer, TocNav, ActionBar, SearchBar, EntryCard components — File tree has 10 components listed. For MVP, 4 would suffice (CodeViewer, MarkdownViewer, FileTree, ThemeToggle).

**Too small (should add):**
- No deployment story (Dockerfile, docker-compose, or even a Makefile)
- No auth even at the simplest level (API key header)
- No rate limiting
- MCP is a stub, not functional
- No embed/iframe support — this is how code sharing actually spreads
- No URL hash for line selection (`#L5-L10`) — trivial to implement, huge UX win

**Severity: HIGH**

**Fix:** Cut Tasks 12, 18, 19 from MVP. Add: Docker deployment, API key auth, functional MCP server, URL line hash. This reduces scope by ~3 tasks and adds 4 higher-value items.

---

## 7. Total Task Count and Estimated Effort

| Dimension | Plan Says | Realistic Estimate | Delta |
|-----------|-----------|-------------------|-------|
| Tasks | 20 | 20 (+ debugging/integration friction) | Plan assumes zero friction |
| Backend tasks | 13 (Tasks 1-13, 17-19) | ~15 (inevitable scope creep in services + API wiring) | +15% |
| Frontend tasks | 3 (Tasks 14-16) | ~5-6 (Shiki WASM loading, CSS cross-browser, responsive) | +80% |
| Test tasks | Embedded in each | Already counted | — |
| Estimated calendar time | Not stated | **5-7 days** for an experienced developer, **10-14 days** for agentic execution | No estimate = no accountability |

**The plan has NO time estimate.** This is a strategic gap. Without a time budget, there's no way to assess whether the plan is on track or not.

**Critical underestimate:** Frontend tasks. Task 16 ("Frontend Core Components") creates 7 files (2 views + 5 components + 3 CSS files) in a single task. This is really 3-4 tasks worth of work. Shiki integration alone (async WASM loading, dual-theme rendering, fallback handling) could take a full day.

**Severity: MEDIUM**

**Fix:** Add hour estimates to each task. Flag Task 16 as high-risk. Break it into: (a) CSS + theme, (b) CodeViewer + MarkdownViewer, (c) views + routing.

---

## 8. Architecture Decisions That Are Hard to Reverse

| Decision | Reversible? | Right? | Risk |
|----------|-------------|--------|------|
| SQLite + FTS5 for storage/search | **Hard to reverse** — migration to Postgres is non-trivial once data exists | **Probably right for MVP** | If multi-user becomes a requirement, the entire data layer needs rework. FTS5 syntax is SQLite-specific. |
| SQLModel as ORM | **Moderate** — can swap to SQLAlchemy directly | **Risky** — SQLModel is still v0.x, has known bugs with complex queries, and its async story is weak | May hit bugs that require workarounds |
| Local filesystem for file storage | **Hard to reverse** — StorageManager path logic is deeply embedded | **Wrong for production** — makes containerization and scaling impossible | Should have a StorageProvider interface from day 1 |
| Vue 3 SPA for frontend | **Hard to reverse** — full rewrite to switch | **Questionable** — SSR or even server-rendered HTML would be simpler and more shareable | SPA adds complexity (client-side routing, state management) for a primarily read-only app |
| FastAPI dependency injection pattern | **Moderate** | **Problematic** — `get_entry_service()` creates a new PeekConfig() + engine + StorageManager on EVERY request. This is not real DI; it's a factory that hides state management problems. | Will cause issues with connection pooling, testing, and config overrides |
| REST API versioning (/api/v1/) | **Easy to reverse** | **Right** | Low risk |

**Most concerning: The DI pattern.** Look at Task 10's `get_entry_service()`:

```python
def get_entry_service() -> EntryService:
    config = PeekConfig()  # Re-reads config every request
    engine = get_engine()  # What does this return? Global? New?
    storage = StorageManager(data_dir=config.data_dir)  # New instance every request
    return EntryService(engine=engine, storage=storage, config=config)
```

This creates new service instances per request. PeekConfig() will re-parse environment variables every time. StorageManager is cheap to create, but this pattern makes it impossible to share DB connections properly. And since `files.py` duplicates this pattern (creates its own config/engine/storage), there's no shared state.

**Severity: HIGH**

**Fix:** Use FastAPI's `app.state` properly (which `main.py` already sets up but the routes ignore). Create service instances once in `create_app()` and inject via dependency. This is a 2-hour fix now, a 2-day fix later.

---

## 9. What's Missing From the Plan That Will Block or Delay Execution

| # | Missing Item | Blocking? | Impact |
|---|-------------|-----------|--------|
| 1 | **No deployment story** — no Dockerfile, no docker-compose, no systemd unit file | Will block anyone trying to actually USE the product | People can't adopt what they can't deploy |
| 2 | **No migration/DB schema versioning** — `init_db()` creates tables if not exist, but no migration path for schema changes | Will block v0.2 development | First schema change requires manual migration |
| 3 | **No error handling in frontend** — `fetchEntry()` catches errors but only shows a string. No retry, no error boundaries, no offline handling. | Will cause poor UX | Users will see blank screens |
| 4 | **No file content API endpoint** — EntryView.vue fetches file content via the download URL, which returns `application/octet-stream` with `Content-Disposition: attachment`. This means the browser will try to DOWNLOAD the file, not display it. | **BLOCKS frontend from working** | CodeViewer/MarkdownViewer will never receive content |
| 5 | **No CORS configuration for production** — CORS only allows `localhost:5173` | Will block production use | Frontend can't communicate with backend when deployed |
| 6 | **No API authentication** — Anyone who can reach the API can create entries with arbitrary local_path references | Security blocker for any non-localhost deployment | See Section 10 |
| 7 | **Conftest.py is Task 13 but needed from Task 2** — Tests from Task 2 onwards need fixtures that aren't created until Task 13 | Will cause test failures | Circular dependency in task ordering |
| 8 | **No `.gitignore`** — `node_modules/`, `__pycache__/`, `.peek/` data directory not excluded | Will pollute repository | Annoying but not blocking |
| 9 | **`peek.main:app` module-level side effect** — `app = create_app()` at module level in main.py means importing the module starts the server, creates DB, etc. This breaks testing and makes config impossible to override after import. | Will cause test conflicts | Tests importing from different modules may trample each other's state |
| 10 | **No logging configuration** — `logging.getLogger()` calls exist but no `basicConfig` or structured logging setup | Debugging will be painful in production | Not blocking but will slow down issue resolution |

**Severity of #4: CRITICAL** — The frontend literally cannot work as designed. The file download endpoint returns binary attachment headers, but the frontend tries to `fetch()` it as text content for rendering. This is a fundamental API design flaw that will surface the moment anyone tries the frontend with the backend.

**Fix for #4:** Add a `/api/v1/entries/{slug}/files/{file_id}/content` endpoint that returns the raw file content with appropriate `Content-Type` (text/plain for code, text/markdown for markdown, etc.) — no Content-Disposition attachment header. Or change the existing endpoint to check an `?inline=true` query parameter.

**Fix for #7:** Move conftest.py creation to Task 2 (or Task 0).

---

## 10. Security and Operational Concerns

### Critical Security Issues

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| 1 | **local_path reads arbitrary files** | **CRITICAL** | The `local_path` feature lets agents specify any local file path. The "forbidden paths" blacklist (`.ssh`, `.gnupg`, `/etc/shadow`) is trivially bypassable: (a) symlinks are blocked in the plan but only if the *symlink itself* is in a forbidden path — a symlink in `/tmp/` pointing to `/etc/shadow` wouldn't be caught, (b) hardlinks are not checked at all, (c) `/proc/self/environ` is not in the blacklist, (d) any custom path with secrets (e.g., `~/secrets.yaml`) is not blocked. |
| 2 | **No authentication** | **CRITICAL** | Any network client can: create entries, delete all entries, read any file the Peek process can access via local_path. The plan says "no auth for MVP" but doesn't restrict the API to localhost only. |
| 3 | **SSRF via local_path** | **HIGH** | If Peek runs in a container with mounted volumes, `local_path` can read any mounted file. The blacklist approach is fundamentally insufficient — you need an *allowlist* of permitted directories. |
| 4 | **XSS via Markdown content** | **MEDIUM** | MarkdownViewer uses `sanitize-html` with `html: false` in markdown-it, which is good. But `v-html` rendering without CSP headers means any bypass in sanitize-html becomes an XSS vector. No CSP headers are set in the plan. |
| 5 | **No rate limiting** | **MEDIUM** | An unauthenticated API with no rate limiting means anyone can flood the database with entries. Even in single-user mode, a buggy agent loop could create thousands of entries in seconds. |
| 6 | **Content-Disposition header injection** | **LOW** | `files.py` uses `file_record.filename` directly in the Content-Disposition header: `f'attachment; filename="{file_record.filename}"'`. A filename containing `"` or `\n` could inject headers. |

### Operational Concerns

| # | Concern | Impact |
|---|---------|--------|
| 1 | **No health check depth** — `/health` returns `{"status": "ok"}` without checking DB or filesystem | Ops team can't detect degraded state |
| 2 | **No graceful shutdown** — Uvicorn's lifecycle is not managed; in-flight requests may be dropped | Data corruption risk during deploys |
| 3 | **SQLite WAL file growth** — WAL mode requires checkpointing. No auto-checkpoint configuration. Long-running instances will have growing WAL files. | Disk exhaustion |
| 4 | **No backup strategy** | Data loss risk |
| 5 | **Module-level `app = create_app()`** — This runs on import, meaning any process that imports peek.main (including test discovery) will create a database, create directories, and start initializing. | Test isolation is impossible |

**Severity: CRITICAL**

**Fix for #1-3:** Replace the blacklist approach with an allowlist: `local_path` must resolve to a path within a configured set of allowed directories. This is a one-day change that eliminates the entire class of arbitrary-file-read vulnerabilities.

**Fix for #2:** At minimum, bind to `127.0.0.1` by default (the plan does this) and document that exposing Peek to a network requires auth. Better: add a simple `PEEK_API_KEY` env var that must be passed as `Authorization: Bearer <key>` header.

---

## Summary Scorecard

| Dimension | Score (1-10) | Key Issue |
|-----------|-------------|-----------|
| Problem framing | 5 | Pastebin++ not platform; reframing unlocks 10x |
| Premise validity | 4 | Agent interaction model assumed, not validated |
| 6-month regret risk | 3 | High — building something agents won't adopt |
| Alternative analysis | 2 | SSR, Gist-as-backend, static-gen all dismissed without evaluation |
| Competitive moat | 3 | Thin — GitHub could absorb this in a sprint |
| Scope calibration | 4 | Wrong things included, right things missing |
| Effort realism | 5 | No time estimates; frontend underestimated by 2x |
| Architecture reversibility | 4 | DI pattern, local filesystem, SPA are hard to reverse |
| Execution blockers | 3 | File content API doesn't work; conftest ordering broken |
| Security posture | 2 | Arbitrary file read, no auth, no CSP |

**Overall: 3.5 / 10**

This plan will produce working software, but it will produce the *wrong* software — a well-crafted pastebin when the market needs an agent output platform. The most dangerous outcome is successful execution of a flawed strategy.

---

## Top 5 Priority Fixes (Before Writing Code)

1. **Add a file content endpoint** (blocking bug — frontend can't render files without it)
2. **Replace local_path blacklist with allowlist** (critical security — arbitrary file read)
3. **Add `PEEK_API_KEY` authentication** (critical security — unauthenticated API)
4. **Move MCP from stub to functional P0** (strategic — this is the moat)
5. **Validate the agent interaction model** with a 2-day spike before committing to 20 tasks (strategic — de-risk the core premise)
