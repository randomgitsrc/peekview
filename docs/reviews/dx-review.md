# Peek MVP — Adversarial Developer Experience Review

> Reviewer: DX Specialist
> Date: 2026-04-18
> Document: `docs/plans/impl-plan.md` (4570 lines, 20 tasks)
> Focus: Developer experience — setup, testing, debugging, extending, configuring, and AI agent ergonomics
> Prior review consulted: `peek-mvp-strategic-review.md`

---

## 1. Dev Environment Setup: Two-World Orphan

**Severity: HIGH**

A new developer cloning this repo faces a split-brain setup with no unified onboarding:

| Step | Command | World |
|------|---------|-------|
| Install backend | `cd backend && pip install -e ".[test]"` | Python |
| Install frontend | `cd frontend && npm install` | Node |
| Start backend | `peek serve` (port 8080) | Python |
| Start frontend dev | `npm run dev` (port 5173) | Node |
| Run backend tests | `cd backend && python -m pytest tests/ -v` | Python |
| Run frontend tests | `cd frontend && npm run test` | Node |
| Build frontend | `cd frontend && npm run build` | Node |

There is **no single command** to:
- Install everything (`make setup` / `just setup` / `scripts/setup.sh`)
- Start the dev environment (`make dev` / `docker-compose up`)
- Run all tests across both projects (`make test`)
- Verify the full stack works end-to-end

The README (Task 20) lists separate commands but provides no orchestration. A `Makefile` or `justfile` at the project root with `setup`, `dev`, `test`, and `build` targets would eliminate 30 minutes of confusion for a new contributor.

**Fix:** Add a root `Makefile` with targets: `setup`, `dev` (starts both servers), `test`, `build`, `clean`. Document the two-process dev workflow with a clear diagram showing which port serves what.

---

## 2. The `fetchFileContent()` Breaks on First Try — And the Error Tells You Nothing

**Severity: CRITICAL (DX-blocking bug)**

The CEO review identified the missing file content endpoint, but the DX impact deserves its own analysis. Here's what a developer experiences:

1. They build the backend and frontend following the plan.
2. They create an entry with a file.
3. They open `http://localhost:5173/view/my-slug`.
4. The page renders the entry header, tags, and FileTree... but the code viewer is **blank**.
5. They open browser DevTools. The Network tab shows a `200 OK` response for `/api/v1/entries/my-slug/files/1`.
6. But the response has `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="main.py"`.
7. The browser **downloads** the file instead of displaying it. Or `fetch()` receives binary data that `.text()` partially renders with encoding artifacts.

The code in `EntryView.vue` line 4021:
```typescript
const resp = await fetch(downloadUrl.value)
fileContent.value = await resp.text()
```

This will either: (a) trigger a browser download dialog, (b) return garbled binary content, or (c) silently fail and set `fileContent.value = ''`. The catch block on line 4023 silently swallows the error.

**The developer sees a blank code viewer with no error message, no console warning, and no indication of what went wrong.** This is the worst possible DX — the app appears broken but gives zero diagnostic signal.

**Fix:**
1. Add `GET /api/v1/entries/{slug}/files/{file_id}/content` returning raw text with proper `Content-Type` (or add `?inline=true` to existing endpoint).
2. Change `fetchFileContent()` to check `Content-Type` and warn if it's not text.
3. Add a visible error state when file content fails to load (currently just silently sets to `''`).
4. Add a `console.warn` in the catch block.

---

## 3. Module-Level `app = create_app()` Poisoning

**Severity: HIGH**

The CEO review flagged this as an operational concern, but the DX impact is severe and worth detailing:

```python
# backend/peek/main.py — line 2832
app = create_app()
```

This line runs on **every import of `peek.main`**. It:
- Creates `~/.peek/` directories (filesystem side effect)
- Initializes a SQLite database at `~/.peek/peek.db` (data side effect)
- Starts configuring middleware (process state side effect)

**What this breaks for developers:**

| Scenario | What Happens |
|----------|-------------|
| `import peek.main` in a test | Creates real `~/.peek/` directory and database on the developer's machine |
| `pytest` discovers tests | Every file that imports from `peek.main` triggers side effects during collection |
| Two test files import `peek.main` | Both get the *same* global `app` instance — tests share state |
| `from peek.main import create_app` | Also runs `app = create_app()` as a side effect of importing the module |
| `mypy` or IDE type checking | May trigger side effects during static analysis |

The test fixtures try to work around this:
```python
app = create_app(data_dir=data_dir, db_path=db_path)
```

But `create_app()` in the fixture *also* re-initializes the global engine via `get_engine()`, which uses a module-level global. Two concurrent test files will race on the same global engine variable.

**Fix:** Remove `app = create_app()` from `main.py`. Use a factory pattern:
```python
# main.py
def create_app(...) -> FastAPI: ...

def get_app() -> FastAPI:
    """Lazy app factory for uvicorn."""
    return create_app()
```
In `pyproject.toml`, change: `uvicorn.run("peek.main:get_app", factory=True, ...)`. This eliminates import-time side effects entirely.

---

## 4. Test Infrastructure: Fixture Duplication and Ordering Chaos

**Severity: HIGH**

The plan has three different `client` fixtures defined in three separate files:

| File | Fixture | Implementation |
|------|---------|---------------|
| `test_api.py` | `async def client(tmp_path)` | Creates `create_app()`, wraps in `AsyncClient` |
| `test_security.py` | `async def client(tmp_path)` | Identical implementation |
| `test_integration.py` | `async def client(tmp_path)` | Identical implementation |

Each creates a new app, new database, new storage manager — **copy-pasted 3 times**. Meanwhile, `conftest.py` (Task 13) defines a `temp_data_dir` fixture and `sample_files` fixture that **none of the test files use** because conftest is created *after* the tests.

**Specific DX problems:**

1. **Conftest is Task 13, but needed from Task 10.** Tests from Task 10 onwards import and create their own fixtures because conftest doesn't exist yet. By the time conftest is added in Task 13, the earlier tests already have their own fixtures and won't be refactored to use it.

2. **The `conftest.py` in the plan is bare-bones.** It provides `temp_data_dir` and `sample_files` but NOT the `client` fixture. Every test file still creates its own client.

3. **No `pytest.ini` / `pyproject.toml` test configuration is established early.** The `asyncio_mode = "auto"` setting in `pyproject.toml` (Task 1) is good, but there's no `conftest.py` to configure it properly for all tests.

4. **Running a single test requires knowing which file it's in, which fixture it needs, and whether the module-level `app` will interfere.**

**Fix:**
1. Move conftest.py creation to **Task 1** (or a new Task 0).
2. Define the `client` fixture ONCE in conftest.py:
   ```python
   @pytest.fixture
   async def client(tmp_path):
       data_dir = tmp_path / "data"
       data_dir.mkdir()
       db_path = tmp_path / "test.db"
       app = create_app(data_dir=data_dir, db_path=db_path)
       transport = ASGITransport(app=app)
       async with AsyncClient(transport=transport, base_url="http://test") as c:
           yield c
   ```
3. Remove all inline `client` fixture definitions from test files.
4. Add a `pytest` section to `pyproject.toml` with proper markers (`@pytest.mark.asyncio` should not be needed with `asyncio_mode = "auto"`).

---

## 5. Dependency Injection: The Service Factory Anti-Pattern

**Severity: HIGH**

The CEO review identified the `get_entry_service()` DI problem. Here's the DX angle:

```python
# entries.py
def get_entry_service() -> EntryService:
    config = PeekConfig()      # Re-reads env vars every request
    engine = get_engine()      # Returns global — but which global?
    storage = StorageManager(data_dir=config.data_dir)  # New instance every request
    return EntryService(engine=engine, storage=storage, config=config)
```

**What a developer experiences:**

1. **Config changes don't take effect.** A developer sets `PEEK_PORT=3000` in their shell, but the service still uses 8080 because `PeekConfig()` was already called during `create_app()` and the cached value is used somewhere else. But this factory creates a *new* config every request, which might read different values depending on when env vars were set.

2. **Tests can't override dependencies cleanly.** The `create_app()` function sets `app.state.config`, but the route handlers **ignore** it entirely and create their own `PeekConfig()`. A test that does `app.state.config.max_file_size = 999` will have no effect on the actual request handling.

3. **`files.py` duplicates the pattern** with its own `PeekConfig()` and `get_engine()` calls. There's no shared service registry.

4. **Adding a new endpoint requires copying this boilerplate.** A developer adding a new route must remember to: import PeekConfig, import get_engine, import StorageManager, construct the service, add it as a Depends(). There's no convention or helper.

**Fix:** Use FastAPI's dependency injection properly:
```python
# deps.py
from functools import lru_cache

@lru_cache
def get_config() -> PeekConfig:
    return PeekConfig()

def get_entry_service(request: Request) -> EntryService:
    config = request.app.state.config  # Use the one from create_app()
    return EntryService(
        engine=request.app.state.engine,
        storage=request.app.state.storage,
        config=config,
    )
```
This makes config testable, shareable, and overridable.

---

## 6. CLI Experience: "Is the Server Running?" Purgatory

**Severity: MEDIUM**

The CLI commands (`peek create`, `peek list`, `peek get`, `peek delete`) are HTTP clients that call the API server. This creates a confusing two-process workflow:

```bash
# Terminal 1: Start the server
peek serve

# Terminal 2: Use the CLI
peek create "My snippet" --files main.py
# ❌ Cannot connect to Peek server. Is it running?
# Wait, which port? Is it 8080 or 3000? Did it start successfully?
```

**Specific DX friction points:**

1. **No `--verbose` flag.** When `peek create` fails, you get `❌ Cannot connect to Peek server. Is it running?` — no information about what URL it tried to connect to.

2. **No `peek status` command.** There's no way to check if the server is running, what port it's on, or whether the database is healthy.

3. **`peek serve` doesn't print the URL.** The implementation says `click.echo(f"🚀 Starting Peek server on {h}:{p}")`, but uvicorn's own output may override this. The developer doesn't know what URL the CLI commands will target.

4. **`peek create --files main.py` sends `local_path`, not content.** The CLI's `--files` option sends `{"local_path": "main.py"}` to the API. But `main.py` is a relative path. The API will look for `main.py` in the *server's* working directory, not the CLI's working directory. The developer expects the CLI to read the file and send content, but it sends a server-side path reference instead.

5. **No `--content` option.** There's no way to pipe content: `echo "print('hello')" | peek create "Test" --stdin`. Content must be in a file on the server's filesystem.

6. **Error messages use emoji but lack detail.** `❌ Error: Missing summary` doesn't tell you which parameter was missing or what the expected format is.

**Fix:**
1. Add `peek status` command that checks server health and prints config.
2. Change `--files` to read file content locally and send it as inline content (not local_path). Add `--local-path` for the server-side reference workflow.
3. Add `--verbose` / `-v` flag to all commands that prints the request URL and response.
4. Make error messages include the error code: `❌ VALIDATION_ERROR: summary is required (got: empty string)`.
5. Print the resolved server URL on `peek serve` startup.

---

## 7. The `local_path` Workflow: Conceptually Confusing

**Severity: MEDIUM**

The `local_path` feature is the most confusing concept in the entire plan for both developers and AI agents. The design doc says:

> Agent passes server-side file path → backend reads and copies to data directory → does not delete original file

**Why this is confusing:**

1. **"local_path" is ambiguous.** Local to whom? The agent? The server? The client? In an MCP context, "local" means the machine running the MCP server (which IS the Peek server), but an agent calling the API from a different machine would expect "local" to mean their own machine.

2. **The API accepts both `content` and `local_path` in the same `files` array:**
   ```json
   "files": [
     {"path": "main.py", "content": "print('hello')"},
     {"path": "config.yaml", "local_path": "/home/xz/project/config.yaml"}
   ]
   ```
   A developer (or AI agent) looking at this must understand that `content` means "I'm giving you the bytes" while `local_path` means "you go read the bytes from your filesystem." This is a fundamental semantic difference hidden behind similar-looking objects.

3. **The CLI `--files` option sends `local_path`, not `content`.** But the CLI runs on the developer's machine, where relative paths make sense locally. The API server might be on a different machine. The mental model is wrong.

4. **Security errors are opaque.** If `local_path` is rejected (forbidden path, symlink, etc.), the error is `403 FORBIDDEN_PATH: Access to /home/xz/.ssh is not allowed`. But the developer doesn't know what the forbidden paths list contains or how to configure it.

**Fix:**
1. Rename `local_path` to `server_path` to make the referent clear.
2. Add a `GET /api/v1/config/allowed-paths` endpoint that returns the current forbidden/allowed paths configuration (for agent discoverability).
3. In error responses, include a hint: `"message": "Access to /etc/shadow is not allowed. Configure 'forbidden_paths' in ~/.peek/config.yaml to customize."`
4. In the CLI, resolve relative paths to absolute paths before sending, and warn if the file doesn't exist locally (because it won't exist on the server either).

---

## 8. MCP Stub: Design Debt That Compounds

**Severity: HIGH**

The plan lists MCP as "P1, stub for now" in the file tree (`mcp_server.py`) but provides zero design for what the MCP tool interface looks like. This is a DX problem because:

1. **The API is designed for HTTP, not for tool-calling.** MCP tools have different ergonomics than REST endpoints. An MCP `peek_create` tool should accept flat parameters, not a nested JSON body. The current `POST /entries` request body with its `files[].content` / `files[].local_path` / `dirs[].path` structure is awkward for tool-calling protocols.

2. **No MCP tool schema is defined.** An AI agent needs to know: What parameters does `peek_create` accept? What does it return? What are the error cases? Without this schema, the MCP server will be designed by whoever implements it later, with no guidance from the API design.

3. **The response format is suboptimal for agents.** The API returns:
   ```json
   {"id": 42, "slug": "auth-design", "url": "https://peek.example.com/view/auth-design", "created_at": "..."}
   ```
   For an agent, the most important field is `url` (the link to share with the human). But it's buried among database fields. An MCP tool should return a concise, agent-optimized response like:
   ```
   Created entry at: https://peek.example.com/view/auth-design
   ```

4. **No `peek_update` equivalent in CLI.** The CLI doesn't expose `peek update`, but the MCP tools list includes it. This means the MCP interface will be designed without CLI validation.

**Fix:** Define the MCP tool schemas now, even if implementation is P1:
```python
# mcp_server.py — tool interface design (implementation deferred to P1)

# Tool: peek_create
# Parameters:
#   summary: str (required) — One-line description
#   files: list[{path: str, content: str}] — Inline file content
#   server_paths: list[{path: str, server_path: str}] — Server filesystem paths
#   dirs: list[str] — Directory paths to scan
#   slug: str | None — Custom URL slug
#   tags: list[str] | None — Tags
#   expires_in: str | None — Expiry duration ("7d", "1h")
# Returns: {url: str, slug: str}

# Tool: peek_list
# Parameters: {q?: str, tags?: list[str], page?: int}
# Returns: {items: [{slug, summary, tags, url}], total: int}

# Tool: peek_get
# Parameters: {slug: str}
# Returns: {slug, summary, tags, url, files: [{filename, language, url}]}

# Tool: peek_delete
# Parameters: {slug: str}
# Returns: {ok: bool}
```
This takes 30 minutes to write and saves hours of design confusion later.

---

## 9. Config Discoverability: What Do I Configure?

**Severity: MEDIUM**

A new developer runs `peek serve` and it works. But then they want to:
- Change the port. → `PEEK_PORT=3000 peek serve` or edit `~/.peek/config.yaml`.
- Increase the file size limit. → Edit `~/.peek/config.yaml` under `limits.max_file_size`.
- Add a custom forbidden path. → Edit `~/.peek/config.yaml` under `storage.forbidden_paths`.

**But `~/.peek/config.yaml` doesn't exist yet.** The plan says "first run auto-creates `~/.peek/` directory and default config file" but the implementation in `config.py` only creates the directory — there's no code to write a default `config.yaml`.

**What the developer experiences:**
1. `peek serve` → works on port 8080
2. "How do I change the port?" → Check README → no mention of config
3. "Check the docs" → design doc section 9 shows config.yaml format
4. "Where's the file?" → `ls ~/.peek/` → only `peek.db` and `data/` — no config file
5. "Do I create it manually?" → Yes, but what's the format?
6. "What are the env vars?" → Not documented in README

**There is no `peek config` command** to:
- Show current config: `peek config show`
- Generate a default config: `peek config init`
- Validate a config file: `peek config check`
- List available env vars: `peek config env`

**Fix:**
1. Add `peek config init` that writes a commented-out `~/.peek/config.yaml` with all available options.
2. Add `peek config show` that prints the effective config (after merging defaults, file, and env vars).
3. Auto-generate the config file on first `peek serve` with comments explaining each option.
4. Add a "Configuration" section to the README with the full env var table.

---

## 10. Error Messages: Designed for Machines, Not Developers

**Severity: MEDIUM**

The API uses a unified error format:
```json
{"error": {"code": "PAYLOAD_TOO_LARGE", "message": "File too large", "details": null}}
```

This is good for machine consumption but terrible for developer debugging:

1. **`"File too large"` doesn't say which limit was hit.** Was it `max_file_size` (10MB per file), `max_content_length` (1MB inline), `max_entry_files` (50 files), or `max_entry_size` (100MB total)? The developer has to guess.

2. **`"details": null` is always null.** The plan defines `details` as part of the error format but never populates it. This should contain structured information about the limit:
   ```json
   {"error": {"code": "PAYLOAD_TOO_LARGE", "message": "File exceeds size limit", "details": {"limit": "max_file_size", "max_bytes": 10485760, "actual_bytes": 15728640}}}
   ```

3. **ValidationError messages are opaque.** When Pydantic validation fails (e.g., missing `summary`), FastAPI returns a 422 with its own error format that doesn't match the Peek error format. The plan's exception handler only catches `PeekError`, not Pydantic `ValidationError`. The developer sees two different error formats depending on which validation layer triggered the error.

4. **No request IDs for debugging.** The logging middleware logs requests but doesn't generate or return a request ID. When a developer reports "I got a 500 error," there's no way to find the corresponding log entry.

**Fix:**
1. Populate `details` in all error responses with structured context.
2. Add a Pydantic validation error handler that wraps 422s in the Peek error format.
3. Add a `X-Request-ID` header to all responses and include it in error details.
4. Make error messages actionable: `"File 'big_data.csv' (15MB) exceeds max_file_size limit (10MB). Configure limits.max_file_size in ~/.peek/config.yaml."`

---

## 11. Frontend Developer Experience: Missing Abstractions and Silent Failures

**Severity: MEDIUM**

**11a. Shiki Highlighter Created Per File View**

In `CodeViewer.vue`:
```typescript
const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: [props.language || 'text'],
})
```

This creates a **new highlighter instance every time a file is selected**. Shiki's `createHighlighter` loads WASM and language grammars — this takes 50-200ms per invocation. Switching between files in a multi-file entry will be noticeably slow, and the developer will have no idea why.

**Fix:** Create the highlighter once at the app level (in a composable or provide/inject) and reuse it. Load languages on demand:
```typescript
// useHighlighter.ts
const highlighter = await createHighlighter({ themes: [...], langs: [] })
// Load language on demand:
if (!highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(lang)
}
```

**11b. No Error Boundaries**

If `api.getEntry()` fails, `EntryView.vue` shows `{{ error }}` — a raw error message string. If Shiki fails to load, the fallback generates raw HTML via string concatenation (`'<span class="line-number">' + ...`). There are no Vue error boundaries.

A frontend developer adding a new component has no pattern to follow for error handling.

**Fix:** Add an `ErrorBoundary.vue` component and a `useAsyncData` composable that standardizes loading/error/data states.

**11c. No Hot-Module Replacement for Styles**

The CSS is in separate `.css` files (`variables.css`, `light.css`, `dark.css`) but imported nowhere in the plan. `main.ts` doesn't import them, `App.vue` doesn't import them. A developer adding them to `main.ts` would need to figure out that Vite processes CSS imports differently from Vue SFC styles.

**Fix:** Import styles in `main.ts`:
```typescript
import './styles/variables.css'
import './styles/light.css'
import './styles/dark.css'
```
Or use Vue SFC `<style>` blocks with CSS custom properties directly.

---

## 12. The "TDD" Workflow Has a Procedural Bug

**Severity: MEDIUM**

The plan claims to follow TDD (write failing test → implement → verify pass). But:

1. **Task 2 (Exceptions) writes a test that imports 8 exception classes.** The test passes trivially because all classes are implemented in the same step. There's no actual red-green cycle — it's write-test-and-implementation-together.

2. **Task 10 (API Routes) creates `test_api.py` that imports from `peek.main`, `peek.api.entries`, etc.** None of these modules exist yet. But the test also imports `EntryCreate`, `EntryUpdate` from `peek.models` — which aren't defined until Task 4. The test file references models and services that don't exist in the task dependency chain.

3. **Running `python -m pytest tests/test_api.py -v` before implementing will fail with `ModuleNotFoundError`, not with a test assertion failure.** This isn't TDD — it's "watch the import error and then write everything." A developer following TDD principles would be confused about what to implement first.

4. **The `conftest.py` is Task 13 but provides fixtures needed from Task 10.** This means Tasks 10-12 create their own fixtures, and Task 13's conftest is dead code that nothing references.

**Fix:** Restructure task ordering:
- Task 0: conftest.py with shared fixtures
- Task 1: pyproject.toml
- Task 2: exceptions (no TDD needed — just implement)
- Continue with proper TDD for service/API layers where the test can actually assert behavior

---

## 13. Dockerfile Doesn't Work As Specified

**Severity: MEDIUM**

The design doc (Section 14.3) specifies a Dockerfile:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/ .
COPY --from=frontend /app/frontend/dist /app/static/
RUN pip install -e .
```

But the implementation plan **never creates this Dockerfile**. It's not in any task. And even if a developer copies it from the design doc:

1. `pip install -e .` installs in editable mode — but the source is copied into the container, not mounted. Editable installs in containers are an anti-pattern because they create `.egg-link` files that may not resolve correctly.

2. The plan says "FastAPI hosts frontend static files in production" but `main.py` never mounts the static files. There's no `StaticFiles` mount in `create_app()`. A developer building the Docker image would get an API that works but serves no frontend.

3. No `.dockerignore` is specified. The Docker context would include `node_modules/`, `__pycache__/`, `.peek/` data directory, and the SQLite database.

**Fix:**
1. Add Dockerfile creation as an explicit task.
2. In `create_app()`, add: `app.mount("/", StaticFiles(directory="static", html=True), name="static")` when in production mode.
3. Change `pip install -e .` to `pip install .` in the Dockerfile.
4. Add a `.dockerignore` file.

---

## 14. Adding a New API Endpoint: The Ritual

**Severity: LOW-MEDIUM**

A developer wanting to add a new endpoint (say, `GET /entries/{slug}/files` to list files) must touch:

1. `backend/peek/models.py` — Add response model
2. `backend/peek/services/entry_service.py` — Add service method
3. `backend/peek/api/entries.py` or `files.py` — Add route
4. `backend/tests/test_api.py` — Add test
5. `frontend/src/types/index.ts` — Add TypeScript type
6. `frontend/src/api/client.ts` — Add API method
7. `frontend/src/views/*.vue` or `components/*.vue` — Use the new data

There's **no code generation, no scaffold script, no pattern document**. The developer must manually trace through 7 files in 2 different languages, ensuring the TypeScript types match the Python models.

**Fix:** Add a `scripts/new-endpoint.sh` that generates boilerplate. Or at minimum, add a `CONTRIBUTING.md` with a step-by-step guide for adding endpoints.

---

## 15. Logging: Configured But Never Set Up

**Severity: LOW-MEDIUM**

The design doc specifies:
- Logs go to `~/.peek/peek.log`
- Format: `{timestamp} {level} {module} {message}`
- Level configurable via `PEEK_LOG_LEVEL`

But the implementation has:
- `logging.getLogger(__name__)` calls in multiple modules — good
- **No `logging.basicConfig()` or handler configuration anywhere** — bad
- **No log file creation** — the `~/.peek/peek.log` is never created
- **No log rotation** — log file will grow unbounded
- **The request logging middleware uses `logger.info()`** but since no handler is configured, these go to stderr (default Python behavior)

A developer running `peek serve` will see uvicorn's logs but NOT Peek's application logs. Debugging a failed request requires adding print statements.

**Fix:** Add logging setup in `create_app()`:
```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(config: PeekConfig):
    log_dir = config.db_path.parent
    log_dir.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        log_dir / "peek.log", maxBytes=10*1024*1024, backupCount=3
    )
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    ))
    logging.getLogger("peek").addHandler(handler)
    logging.getLogger("peek").setLevel(config.log_level)
```

---

## 16. AI Agent Ergonomics: The API Is Not Agent-Friendly

**Severity: MEDIUM**

The primary user is an AI agent, but the API design is optimized for human browser interactions:

1. **No `GET /api/v1/entries/{slug}/files` endpoint.** To get file content, an agent must: (a) GET the entry to get file IDs, (b) GET each file individually by ID. There's no way to get all file contents in one request. For a 10-file entry, that's 11 HTTP requests.

2. **File content requires a separate download request.** The entry detail response includes file metadata but not content. An agent that wants to read and summarize code must make N+1 requests.

3. **No `Accept: application/json` content negotiation.** The file download endpoint always returns binary. There's no way to request text content as JSON (e.g., `{"filename": "main.py", "content": "print('hello')", "language": "python"}`).

4. **The `dirs` parameter requires a server-side path.** An AI agent running on the same machine as Peek can use this, but an agent calling the API remotely cannot. There's no way to upload a directory tree from a remote agent.

5. **Error responses don't include remediation hints.** An agent receiving `PAYLOAD_TOO_LARGE` doesn't know what to do — reduce file count? Reduce file size? Split into multiple entries?

**Fix:**
1. Add `?include=content` query parameter to `GET /entries/{slug}` that embeds file contents in the response.
2. Add `Accept: application/json` support to the file download endpoint.
3. Add structured `details` to error responses that agents can parse programmatically.
4. Document the "agent workflow" in the README: create entry → get URL → share URL with human.

---

## Summary Scorecard

| Dimension | Score (1-10) | Key Issue |
|-----------|-------------|-----------|
| Dev environment setup | 3 | No unified setup; split Python/Node worlds |
| Test ergonomics | 4 | Fixture duplication; conftest ordering; import side effects |
| Running single test | 5 | Works but module-level `app` causes interference |
| Adding new endpoint | 4 | 7-file ritual across 2 languages; no scaffold |
| CLI intuitiveness | 5 | Commands work; `--files` semantics are wrong; no status command |
| Debugging | 3 | Logging not configured; silent failures; no request IDs |
| Config discoverability | 3 | No config file generated; no `peek config` command |
| Error message quality | 4 | Unified format good; `details: null` bad; no remediation hints |
| Deployment | 2 | Dockerfile in design doc but not implemented; static files not mounted |
| AI agent ergonomics | 4 | API works but N+1 problem; no inline content; MCP undefined |
| `local_path` workflow | 3 | Ambiguous name; CLI misuse; opaque security errors |
| MCP tool design | 2 | Complete stub; no schema; no interface definition |
| Contribution experience | 4 | Good file structure; no CONTRIBUTING.md; no code gen |

**Overall DX Score: 3.5 / 10**

The plan produces software that works in the happy path but creates friction at every turn when things go wrong — which is when developer experience matters most. The core issues are: (1) import-time side effects making testing unreliable, (2) the file content endpoint gap making the frontend silently fail, and (3) missing infrastructure (Makefile, conftest ordering, logging setup, Dockerfile, config discovery) that would take 2-3 hours to add but saves every future developer hours of confusion.

---

## Top 5 Priority Fixes (Before Writing Code)

1. **Remove module-level `app = create_app()`** and use lazy factory — this single change fixes test isolation, import side effects, and config override issues (1 hour)

2. **Add file content endpoint + frontend error handling** — without this, the frontend is a blank screen and debugging is impossible (2 hours)

3. **Move conftest.py to Task 1 + unify client fixture** — eliminate fixture duplication and test ordering issues (30 minutes)

4. **Add root Makefile + `peek config init/show`** — dev environment onboarding goes from 30 minutes to 5 minutes (1 hour)

5. **Define MCP tool schemas** — even as stubs, these inform API design decisions that are hard to reverse later (30 minutes)
