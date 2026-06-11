# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeekView** is a lightweight code and document formatting service. Core purpose: Agent (AI) creates entries via API/CLI/MCP → humans view formatted content in browser.

- **Current State:** Backend, frontend, and MCP Server are complete. MCP Server v0.8.2 (Streamable HTTP transport) has been released to npm.
- **Current Version:** v0.1.50 (Backend/Frontend) | MCP Server v0.8.2
- **Architecture:** FastAPI (Python 3.12+) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + TypeScript + Shiki SPA frontend, MCP Server (Node.js/TypeScript, Streamable HTTP transport)

## Project Structure

```
peekview/
├── docs/
│   ├── specs/           # Requirements and design specs (auth, remote CLI, MCP)
│   ├── plans/           # Active implementation plans only
│   ├── reviews/         # Active reviews (CEO, Design, DX, expert reviews)
│   ├── archived/        # Completed plans, specs, reviews, incidents
│   └── process/         # Development workflow (workflow.md, release.md, debug-*.md)
├── backend/             # FastAPI backend
│   ├── peekview/        # Main package (note: package is "peekview", not "peek")
│   │   ├── main.py      # FastAPI app factory with DI via app.state
│   │   ├── models.py    # SQLModel Entry/File/User/ApiKey + Pydantic schemas
│   │   ├── config.py    # Pydantic Settings (PEEKVIEW_* env vars)
│   │   ├── database.py  # SQLite init with WAL + FTS5
│   │   ├── auth.py      # JWT auth (Bearer header + httpOnly cookie), bcrypt hashing, API key verification
│   │   ├── storage.py   # Filesystem operations (atomic writes)
│   │   ├── cli.py       # Click CLI (serve/create/get/list/delete/user/login/apikey)
│   │   ├── api/         # FastAPI routes (entries, files, auth, apikeys)
│   │   └── services/    # Business logic (entry_service, file_service, apikey_service)
│   └── tests/           # pytest suite with shared conftest.py fixtures
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

**Important:** The frontend router is in `src/router.ts` (NOT `src/router/index.ts`).

## Key Commands

### Debug Workflow (CRITICAL - MUST READ FIRST)

```bash
# 一键完整调试（构建+启动+验证隔离+测试）
make debug

# 分步调试流程
make debug-build          # 构建并验证 static 文件
make debug-start          # 启动调试服务（:8888，与 pipx 服务隔离）
make debug-verify-isolation  # 验证数据隔离（v0.1.22+ 强制）
make debug-test           # 运行 Playwright E2E 测试
make debug-stop           # 停止调试服务

# MCP Server 测试
make build-mcp            # Build MCP Server
make test-mcp-unit        # 运行 MCP 单元测试（无需后端）
make test-mcp             # 运行 MCP 纯单元测试套件（integration/e2e 分离）
```

**严禁**:
- ❌ 直接手动启动 uvicorn（容易用错端口或数据目录）
- ❌ 跳过 E2E 测试直接发布
- ❌ 停止用户的 pipx 正式服务（:8080）
- ❌ 运行会触碰真实 `~/.peekview/` 的测试；MCP 测试必须使用临时 HOME

### Backend Commands (from `backend/`)

```bash
# Setup
pip install -e ".[test]"    # Install with test deps
make dev                    # uvicorn peekview.main:app --reload (port 8080)

# Testing
make test                   # pytest tests/ -v --tb=short
make test-cov               # With coverage report
pytest tests/test_apikey.py -v  # Single test file
pytest tests/ --lf -v       # Run only failed tests

# Code quality
make lint                   # ruff check + format --check
make format                 # ruff check --fix + format
```

### Frontend Commands (from `frontend-v3/`)

```bash
npm install
npm run dev                 # Vite dev server (port 5173)
npm run build               # Build to dist/, copy to backend/peekview/static/
npm run test                # Vitest unit tests
npm run test:e2e            # Playwright E2E tests
```

### MCP Commands (from `packages/mcp-server/`)

```bash
npm ci
npm run build
npm run test:unit           # Pure unit tests, isolated temp HOME
npm test                    # Alias for pure unit test suite
npm run test:integration    # Requires debug backend and API key(s)
npm run test:e2e:node       # Node/Vitest MCP E2E, requires debug backend
```

### Release Commands

```bash
make bump-version NEW_VERSION=x.y.z        # Bump backend/frontend version + auto-sync docs
make bump-mcp-version NEW_MCP_VERSION=x.y.z  # Bump MCP version independently
make pre-publish                           # Full check (clean build + test)
make pre-publish-quick                     # Quick check (no rebuild)
make publish                               # Build + upload to PyPI
make publish-npm                           # Publish MCP Server to npm
```

## Key Architectural Decisions

### DI Pattern
Services are accessed via `app.state` (not module-level globals):
```python
entry_service = request.app.state.entry_service
```

### Data Model
- `entries`: `id`, `slug` (UNIQUE), `summary`, `status`, `tags` (JSON), `expires_at`, `is_public`, `owner_id`
- `files`: `entry_id`, `path`, `filename`, `language`, `is_binary`, `size`, `sha256`
- `users`: `id`, `username` (UNIQUE), `password_hash`, `is_admin`
- `api_keys`: `id`, `user_id`, `name`, `key_prefix`, `key_hash`, `expires_at`
- FTS5 virtual table `entries_fts` for full-text search
- Files stored in `~/.peekview/data/default/{entry_id}/`

### Security (Critical)
1. **local_path allowlist**: Only paths under configured allowed directories permitted
2. **Symlink check BEFORE resolve**: Check `original.is_symlink()` before `original.resolve()`
3. **Path traversal on `files.path`**: Verify resolved path starts with `base.resolve()`
4. **Global API Key auth**: `PEEKVIEW_SERVER__API_KEY` for service-level auth
5. **User-level API Key auth**: `pv_` prefix keys, HMAC-SHA256 hashed, bound to user
6. **JWT user auth**: `Authorization: Bearer <jwt>` header OR httpOnly cookie (`peekview_token`) — cookie set on login/register, cleared on logout
7. **Entry visibility**: Anonymous users see only public entries; authenticated users see public + own private entries
8. **MCP local publish_files**: realpath + sensitive blacklist + allowed_paths/cwd boundary; cwd fallback must reject `/`
9. **CSP**: Frontend pages have Content-Security-Policy (script-src includes unsafe-eval for Mermaid/d3); externalized inline scripts

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### MCP Server Architecture (v0.8.2)
- **Transport**: Streamable HTTP via `@modelcontextprotocol/sdk`
- **Auth**: Two-layer — `pv_` prefix check at initialize, then passthrough to PeekView API
- **Session**: Per-session Server instance with idle timeout cleanup
- **Modes**:
  - `remote` (default, A→B→C): exposes `create_entry`, `get_entry`, `list_entries`, `delete_entry`
  - `local` (A=B→C): exposes `publish_files`, `get_entry`, `list_entries`, `delete_entry`; does **not** expose `create_entry`
- **publish_files**: reads files directly from disk, requires absolute paths, uses `server.allowed_paths` or cwd+tmpdir fallback, `trust_all_paths` option, rejects cwd `/`
- **Service commands**: Auto-detect user/system service mode (`--user`/`--system` flags, default prefers user service)
- **Deployment architecture**: Agent(A机器) → HTTP POST → MCP Server(B机器) → HTTP → PeekView(C机器). B and C may be the same server.
- **Version correspondence:** MCP Server v0.8.2 requires PeekView Backend v0.1.25+

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

## Testing Strategy

- **Backend fixtures:** Shared in `conftest.py` (temp dirs, test DB, async client, factories)
- **Backend factories:** Test data builders in `factories.py`
- **Security tests:** Path traversal, allowlist bypass, symlink attacks in `test_security.py`
- **E2E tests:** Playwright (chromium + Mobile Chrome), includes auth, All/Mine tabs, API Keys
- **MCP unit tests:** Use temp HOME; never rename or touch real `~/.peekview/mcp-config.yaml`
- **MCP integration/e2e tests:** Require debug backend on `127.0.0.1:8888`; must never target production `:8080`
- All backend/frontend tests use temp directories (never touch real `~/.peekview/`)

## Configuration (PEEKVIEW_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | Server bind address (`127.0.0.1` for local-only) |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | External URL (empty = auto-detect) |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key for service-level auth |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `["http://localhost:5173"]` | CORS allowed origins |
| `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED` | `true` | Enable rate limiting on sensitive endpoints |
| `PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE` | `60` | Default rate limit per IP |
| `PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE` | `10` | Login/register rate limit per IP |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_STORAGE__HEALTH_DISK_WARNING_MB` | `100` | Health warning threshold for free disk space |
| `PEEKVIEW_STORAGE__IGNORED_DIRS` | `{.git,.svn,__pycache__,node_modules,.venv,venv,.tox,dist,build}` | Ignored dirs for recursive scan |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT token validity days |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | Allow anonymous entry creation |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10MB) |
| `PEEKVIEW_LIMITS__MAX_CONTENT_LENGTH` | `1048576` | Max inline content length (1MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_LIMITS__MAX_ENTRY_SIZE` | `104857600` | Max total entry size (100MB) |
| `PEEKVIEW_LIMITS__MAX_SLUG_LENGTH` | `64` | Max custom slug length |
| `PEEKVIEW_LIMITS__MAX_SUMMARY_LENGTH` | `500` | Max summary length |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | Max items per page |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | Check expired entries on startup |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval seconds (0 = disabled) |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level |
| `PEEKVIEW_LOGGING__LOG_FILE` | `None` | Log file path (None = stderr only) |
| `PEEKVIEW_REMOTE__URL` | `""` | Remote CLI server URL |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | Remote CLI API key |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | Remote CLI JWT token |
| `PEEKVIEW_REMOTE__TIMEOUT` | `30` | Remote request timeout seconds |
| `PEEKVIEW_REMOTE__VERIFY_SSL` | `true` | Verify SSL certificates |

**Note:** Use `__` as separator for nested config (e.g., `storage.data_dir` → `PEEKVIEW_STORAGE__DATA_DIR`).

## Essential Documentation

- **Dev Process:** `docs/process/workflow.md` - P0-P4 checkpoint-driven development
- **Debug Workflow:** `docs/process/debug-workflow.md` - CRITICAL for pre-release verification
- **Release Process:** `docs/process/release.md` - MUST READ when releasing
- **Auth Spec:** `docs/specs/spec-user-auth.md`
- **Remote CLI Spec:** `docs/specs/spec-remote-cli.md`
- **MCP Dual Mode Plan:** `docs/plans/mcp-dual-mode-final-v0.7.md`
