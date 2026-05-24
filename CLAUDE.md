# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeekView** is a lightweight code and document formatting service. Core purpose: Agent (AI) creates entries via API/CLI → humans view formatted content in browser.

- **Current State:** Backend, frontend, and MCP Server all complete. MCP Server v0.2.0 published to npm.
- **Current Version:** v0.1.41 (Backend/Frontend) | MCP Server v0.5.1
- **Architecture:** FastAPI (Python 3.12+) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + TypeScript + Shiki SPA frontend, MCP Server (Node.js/TypeScript, SSE transport)

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
make debug-test           # 运行 E2E 测试
make debug-stop           # 停止调试服务

# MCP Server 测试
make build-mcp            # Build MCP Server
make test-mcp-unit        # 运行单元测试（无需后端）
make test-mcp             # 运行所有测试（需后端）
```

**严禁**:
- ❌ 直接手动启动 uvicorn（容易用错端口或数据目录）
- ❌ 跳过 E2E 测试直接发布
- ❌ 停止用户的 pipx 正式服务（:8080）

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

### Release Commands

```bash
make bump-version NEW_VERSION=x.y.z   # Bump version + auto-sync docs
make pre-publish                      # Full check (clean build + test)
make pre-publish-quick                # Quick check (no rebuild)
make publish                        # Build + upload to PyPI
make publish-npm                    # Publish MCP Server to npm
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
6. **JWT user auth**: `Authorization: Bearer <jwt>` for user-level authentication
7. **Entry visibility**: Anonymous users see only public entries; authenticated users see public + own private entries

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### MCP Server Architecture (v0.2.0)
- **Transport**: SSE (Server-Sent Events) via `@modelcontextprotocol/sdk`
- **Auth**: Two-layer — pv_ prefix check at SSE connect, then passthrough to PeekView API
- **Session**: AsyncLocalStorage propagates user context per SSE session
- **Tools**: create_entry, get_entry, list_entries, delete_entry
- **Version correspondence:** MCP Server v0.2.0 requires PeekView Backend v0.1.25+

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
- **MCP tests:** Unit tests don't need PeekView backend; integration/e2e tests require running backend
- All tests use temp directories (never touch real `~/.peekview/`)

## Configuration (PEEKVIEW_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `127.0.0.1` | Server bind address |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key for service-level auth |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT token validity |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |

**Note:** Use `__` as separator for nested config (e.g., `storage.data_dir` → `PEEKVIEW_STORAGE__DATA_DIR`).

## Essential Documentation

- **Dev Process:** `docs/process/workflow.md` - P0-P4 checkpoint-driven development
- **Debug Workflow:** `docs/process/debug-workflow.md` - CRITICAL for pre-release verification
- **Release Process:** `docs/process/release.md` - MUST READ when releasing
- **Auth Spec:** `docs/specs/spec-user-auth.md`
- **Remote CLI Spec:** `docs/specs/spec-remote-cli.md`
