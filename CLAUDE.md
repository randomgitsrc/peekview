# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeekView** is a lightweight code and document formatting service. Core purpose: Agent (AI) creates entries via API/CLI → humans view formatted content in browser.

- **Current State:** Backend, frontend, and MCP Server all complete. MCP Server v0.2.0 published to npm.
- **Current Version:** v0.1.30 (Backend/Frontend) | MCP Server v0.2.0
- **Architecture:** FastAPI (Python 3.12+) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + TypeScript + Shiki SPA frontend, MCP Server (Node.js/TypeScript, SSE transport)
- **Key Docs:** Auth spec in `docs/specs/spec-user-auth.md`, remote CLI spec in `docs/specs/spec-remote-cli.md`
- **Dev Process:** Standard workflow in `docs/process/workflow.md` - **READ THIS FIRST** before starting any work
- **Release Process:** See `docs/process/release.md` - **MUST READ when releasing**

## Project Structure

```
peekview/
├── docs/
│   ├── specs/           # Requirements and design specs (auth, remote CLI)
│   ├── plans/           # Active implementation plans only
│   ├── reviews/         # Active reviews (CEO, Design, DX)
│   ├── archived/        # Completed plans, specs, reviews
│   └── process/         # Development workflow (workflow.md, release.md, debug-*.md)
├── backend/             # FastAPI backend
│   ├── peekview/        # Main package (note: package is "peekview", not "peek")
│   │   ├── main.py      # FastAPI app factory with DI via app.state
│   │   ├── models.py    # SQLModel Entry/File/User/ApiKey + Pydantic schemas
│   │   ├── config.py    # Pydantic Settings (PEEKVIEW_* env vars)
│   │   ├── database.py  # SQLite init with WAL + FTS5
│   │   ├── auth.py      # JWT auth, bcrypt hashing, API key verification
│   │   ├── storage.py   # Filesystem operations (atomic writes)
│   │   ├── cli.py       # Click CLI (serve/create/get/list/delete/user/login/apikey)
│   │   ├── api/         # FastAPI routes (entries, files, auth, apikeys)
│   │   └── services/    # Business logic (entry_service, file_service, apikey_service)
│   └── tests/           # pytest suite with shared conftest.py fixtures
├── frontend/            # [DEPRECATED] Old frontend - DO NOT USE
│   └── ...              # Kept for reference only
├── frontend-v3/         # Vue 3 + Vite + TypeScript + Shiki SPA (v3 - CURRENT)
│   ├── src/             # TypeScript/Vue source files
│   ├── dist/            # Build output (copied to backend/peekview/static/)
│   └── e2e/             # Playwright E2E tests
└── packages/
    └── mcp-server/      # MCP Server (@peekview/mcp-server on npm)
        ├── src/         # TypeScript source (server, client, tools, config)
        ├── dist/        # Compiled output
        └── tests/       # Unit, integration, e2e tests
```

## Backend Commands

From `backend/` directory:

```bash
# Setup (development)
pip install -e ".[test]"    # Install with test deps
make build                 # Same as above

# Production install
pip install peekview       # PyPI install
pipx install peekview      # Recommended: isolated environment, no conflicts

# Development
make dev                   # uvicorn peekview.main:app --reload (port 8080)

# Testing
make test                  # pytest tests/ -v --tb=short
make test-cov              # With coverage report
pytest tests/test_apikey.py -v  # Single test file

# Code quality
make lint                  # ruff check + format --check
make format                # ruff check --fix + format
```

## Frontend Commands

From `frontend-v3/` directory:

```bash
# Install dependencies
npm install

# Development
npm run dev                # Vite dev server (port 5173)

# Build
npm run build              # Build to dist/, copy to backend/peekview/static/

# Testing
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright E2E tests
```

**IMPORTANT:** The frontend router is in `src/router.ts` (NOT `src/router/index.ts`). Always modify `src/router.ts` when adding routes.

## MCP Server Commands

From project root:

```bash
# Build
make build-mcp            # Build MCP Server

# Testing
make test-mcp-unit        # Run unit tests only (no backend needed)
make test-mcp             # Run all tests (unit + integration + e2e)

# Publishing
make publish-npm-dry      # Dry-run npm publish
make publish-npm          # Publish @peekview/mcp-server to npm
```

From `packages/mcp-server/` directory:

```bash
npm run build             # Compile TypeScript
npm run test              # Run all tests
npm run test:unit         # Unit tests only (safe for CI/prepublish)
npm run test:integration  # Integration tests (requires PeekView backend)
npm run test:e2e          # E2E tests (requires PeekView backend)
```

**Version correspondence:** MCP Server v0.2.0 requires PeekView Backend v0.1.25+ (pv_ API Key auth). The MCP Server has its own version line; `make bump-version` syncs both.

## CLI Usage

```bash
peekview serve                    # Start server (default: 127.0.0.1:8080)
peekview serve -p 3000 --reload   # Custom port + dev mode
peekview serve --base-url https://example.com  # Use custom domain

peekview create file.txt -s "My code"                    # Create from file
peekview create src/*.py -s "Project" -t python -t cli   # Glob + tags
peekview create -s "From stdin" --from-stdin < code.py   # From pipe
peekview create file.py -s "Private" --visibility private # Create private entry

# User management
peekview user create <username>        # Create user (prompts for password)
peekview user list                     # List all users
peekview user promote <username>       # Promote to admin
peekview user demote <username>        # Demote from admin

# Remote authentication
peekview login --remote-url <url> --username <user>  # Login to remote server

# API Key management
peekview apikey create "CI Bot"                    # Create API key
peekview apikey create "Temp" --expires 30d        # With expiration
peekview apikey list                               # List keys
peekview apikey revoke <key_id>                    # Revoke key
peekview apikey cleanup                            # Remove expired keys

# Service management (systemd/launchd)
peekview service install --base-url https://example.com
peekview service install --user
peekview service status / start / stop / uninstall
```

## Key Architectural Decisions

### Data Model
- `entries` table: `id` (INTEGER PK), `slug` (UNIQUE), `summary`, `status`, `tags` (JSON), `expires_at`, `is_public` (BOOLEAN, default True), `owner_id` (INTEGER FK → users.id, CASCADE)
- `files` table: `entry_id` (FK, CASCADE), `path`, `filename`, `language`, `is_binary`, `size`, `sha256`
- `users` table: `id` (INTEGER PK), `username` (UNIQUE), `password_hash`, `display_name`, `is_active`, `is_admin`, `created_at`
- `api_keys` table: `id` (INTEGER PK), `user_id` (FK → users.id), `name`, `key_prefix`, `key_hash`, `expires_at`, `last_used_at`, `created_at`
- FTS5 virtual table `entries_fts` for full-text search
- Files stored in `~/.peekview/data/default/{entry_id}/` with directory structure preserved

### Security (Critical - From Reviews)
1. **local_path allowlist** (not blacklist): Only paths under configured allowed directories permitted
2. **Symlink check BEFORE resolve**: Check `original.is_symlink()` before `original.resolve()`
3. **Path traversal on `files.path`**: Verify resolved path starts with `base.resolve()`
4. **Global API Key auth**: `PEEKVIEW_SERVER__API_KEY` for service-level auth (ownerless entries)
5. **User-level API Key auth**: `pv_` prefix keys, HMAC-SHA256 hashed, bound to user (JWT equivalent permissions)
6. **JWT user auth**: `Authorization: Bearer <jwt>` for user-level authentication
7. **Entry visibility**: Anonymous users see only public entries; authenticated users see public + own private entries
8. **XSS protection**: `sanitize-html` used in frontend (MarkdownViewer.vue)

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### Frontend Architecture (v3)
- **Build**: Vite bundles to `frontend-v3/dist/`, copied to `backend/peekview/static/`
- **Routing**: Vue Router in `src/router.ts` (NOT `src/router/index.ts`)
- **State**: Pinia stores + Composables (`useTheme`, `useShiki`, `useEntry`, `useToast`, `useAuthStore`)
- **Auth**: JWT in localStorage (`peekview_token`), three-state: loading/authenticated/anonymous
- **API Keys**: Dedicated page at `/settings/apikeys` with create/revoke/copy UI
- **Entry filtering**: All/Mine tabs for authenticated users
- **Styling**: CSS variables for theming, FOUC prevention

### MCP Server Architecture (v0.2.0)
- **Transport**: SSE (Server-Sent Events) via `@modelcontextprotocol/sdk`
- **Auth**: Two-layer — pv_ prefix check at SSE connect, then passthrough to PeekView API
- **Session**: AsyncLocalStorage propagates user context (userToken, userId, username) per SSE session
- **No key storage**: MCP Server never stores API keys; users provide `pv_` keys via Authorization header
- **Tools**: create_entry, get_entry, list_entries, delete_entry
- **Health**: `/health` endpoint returns `{status: "ok", version: "x.y.z"}` or 503 if PeekView unreachable
- **Docker**: Multi-stage build, EXPOSE 33333
- **npm**: Published as `@peekview/mcp-server`, CI triggered by `mcp-v*` tags

### DI Pattern
Services are accessed via `app.state` (not module-level globals or per-request factories):
```python
entry_service = request.app.state.entry_service
```

### Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description",
    "details": {}
  }
}
```

### Testing Strategy
- **Backend fixtures:** Shared in `conftest.py` (temp dirs, test DB, async client, factories)
- **Backend factories:** Test data builders in `factories.py`
- **Security tests:** Path traversal, allowlist bypass, symlink attacks in `test_security.py` (26 tests)
- **Auth tests:** JWT, bcrypt, register/login/logout/me, visibility in `test_auth.py` (30 tests)
- **API Key tests:** CRUD, auth, expiration, permissions in `test_apikey.py` (26 tests)
- **CLI tests:** `test_cli.py` with click.CliRunner (32 tests)
- **E2E tests:** Playwright (52 tests on chromium + Mobile Chrome, including auth, All/Mine, API Keys)
- **MCP tests:** 72 tests (38 unit + 12 integration + 13 e2e + 9 config/tools), unit tests don't need PeekView backend
- All tests use temp directories (never touch real `~/.peekview/`)

## Configuration (PEEKVIEW_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `127.0.0.1` | Server bind address |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key for service-level auth |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `http://localhost:5173` | CORS allowed origins |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT token validity in days |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | Allow anonymous entry creation |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | Max items per page |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | Check expired entries on startup |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level |
| `PEEKVIEW_REMOTE__URL` | `""` | Remote server URL for CLI remote mode |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | API key for remote server |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | JWT token for remote user auth |

## Implementation Status

All core features complete:

**Backend:**
- Tasks 0-12: Core backend (models, DB, storage, API, CLI)
- Auth: JWT auth, bcrypt, register/login/logout/me, entry visibility, owner permissions
- API Keys: User-level `pv_` keys, HMAC-SHA256, CRUD, expiration, CLI management
- Admin: First user auto-admin, promote/demote commands
- **FileTree:** Hierarchical file paths, nested directories
- **Resource Injection:** `content_base64` for binary files, `/entries/{slug}/download` for ZIP pack
- 393 backend tests passing

**Frontend:**
- Tasks 14-16: Vue 3 + Vite + Shiki + Mermaid + Markdown + FileTree
- Auth: LoginDialog, auth store, card actions, user menu
- API Keys: Dedicated management page at `/settings/apikeys`
- All/Mine tabs for entry filtering
- **FileTree:** Hierarchical directory tree with fold/unfold
- **HTML Rendering:** iframe sandbox, resource injection (CSS/JS/images)
- **Image Viewer:** PNG/JPG/GIF/WebP/SVG with zoom, size warnings
- **Pack Download:** ZIP download for multi-file entries
- 55+ E2E tests passing

**MCP Server (v0.2.0):**
- SSE transport with multi-user API Key passthrough
- AsyncLocalStorage session isolation
- Tools: create_entry, get_entry, list_entries, delete_entry
- Chinese error messages (认证失败, 权限不足)
- Health check endpoint, Docker support, npm published
- 72 tests passing (38 unit + 12 integration + 13 e2e + 9 config/tools)

## Debug Workflow (CRITICAL!)

> ⚠️ **下次调试前必须阅读**: `docs/process/debug-workflow.md`

```bash
make debug           # 一键完整调试（构建+启动+验证隔离+测试）
make debug-build     # 构建并验证 static 文件
make debug-start     # 启动调试服务（:8888，与 pipx 服务隔离）
make debug-test      # 运行 E2E 测试
make debug-stop      # 停止调试服务
```

**严禁**:
- ❌ 直接手动启动 uvicorn（容易用错端口或数据目录）
- ❌ 跳过 E2E 测试直接发布
- ❌ 停止用户的 pipx 正式服务（:8080）
