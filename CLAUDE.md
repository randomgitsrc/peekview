# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Peek** is a lightweight code and document formatting service. Core purpose: Agent (AI) creates entries via API/CLI → humans view formatted content in browser.

- **Current State:** Backend implementation complete (Tasks 0-12), frontend not started
- **Architecture:** FastAPI (Python 3.12+) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + Shiki SPA frontend (planned)
- **Key Docs:** All specs in `docs/specs/`, implementation plan in `docs/plans/impl-plan.md`, adversarial reviews in `docs/reviews/`

## Project Structure

```
peek/
├── docs/
│   ├── specs/           # Requirements, design, test plan (v2.0, finalized)
│   ├── plans/           # Implementation plan (v2 revised, 16 tasks)
│   └── reviews/         # Adversarial reviews (CEO/Design/Eng/DX)
├── backend/             # FastAPI backend (Tasks 0-12 complete)
│   ├── peek/           # Main package
│   │   ├── main.py     # FastAPI app factory with DI via app.state
│   │   ├── models.py   # SQLModel Entry/File + Pydantic schemas
│   │   ├── config.py   # Pydantic Settings (PEEK_* env vars)
│   │   ├── database.py # SQLite init with WAL + FTS5
│   │   ├── storage.py  # Filesystem operations (atomic writes)
│   │   ├── cli.py      # Click CLI (peek serve/create/get/list/delete)
│   │   ├── api/        # FastAPI routes (entries, files)
│   │   └── services/   # Business logic (entry_service, file_service)
│   └── tests/          # pytest suite with shared conftest.py fixtures
└── frontend/           # Vue 3 + Vite + Shiki (原型迭代中, see frontend/prototype/)
```

## Backend Build & Development Commands

From `backend/` directory:

```bash
# Setup
pip install -e ".[test]"    # Install with test deps
make build                 # Same as above

# Development
make dev                   # uvicorn peek.main:app --reload (port 8080)

# Testing
make test                  # pytest tests/ -v --tb=short
make test-cov              # With coverage report
pytest tests/test_api.py -v          # Single test file
pytest tests/test_api.py::test_create_entry -v   # Single test

# Code quality
make lint                  # ruff check + format --check
make format                # ruff check --fix + format

# Cleanup
make clean                 # Remove __pycache__, .pytest_cache, etc.
```

## CLI Usage (Installed via pip)

```bash
peek serve                    # Start server (default: 127.0.0.1:8080)
peek serve -p 3000 --reload   # Custom port + dev mode

peek create file.txt -s "My code"                    # Create from file
peek create src/*.py -s "Project" -t python -t cli   # Glob + tags
peek create -s "From stdin" --from-stdin < code.py   # From pipe

echo "content" | peek create -s "From pipe" --from-stdin

peek get my-entry             # Show entry details
peek list -q "python"         # Search with FTS5
peek list -t cli -t python    # Filter by tags
peek delete my-entry          # Delete (with confirmation)
```

## Key Architectural Decisions

### Data Model
- `entries` table: `id` (INTEGER PK), `slug` (UNIQUE, URL identifier), `summary`, `status`, `tags` (JSON), `expires_at`
- `files` table: `entry_id` (FK, CASCADE), `path` (relative dir), `filename`, `language`, `is_binary`, `size`, `sha256`
- FTS5 virtual table `entries_fts` for full-text search
- Files stored in `~/.peek/data/default/{entry_id}/` with directory structure preserved

### Security (Critical - From Reviews)
1. **local_path allowlist** (not blacklist): Only paths under configured allowed directories permitted (see `config.is_local_path_allowed()`)
2. **Symlink check BEFORE resolve**: Check `original.is_symlink()` before `original.resolve()` (in `file_service.validate_local_path()`)
3. **Path traversal on `files.path`**: After computing `base / file_path`, verify resolved path starts with `base.resolve()` (in `storage.py`)
4. **API Key auth**: `Authorization: Bearer <token>` header required when `PEEK_API_KEY` env var set
5. **XSS protection**: `sanitize-html` planned for frontend (not yet implemented)

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### DI Pattern
Services are accessed via `app.state` (not module-level globals or per-request factories):
```python
# In API routes
entry_service = request.app.state.entry_service
# Or via helper
from peek.services.entry_service import get_entry_service
entry_service = get_entry_service(request.app)
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
- **Fixtures:** Shared in `conftest.py` (temp dirs, test DB, async client, factories)
- **Factories:** Test data builders in `factories.py`
- **Security tests:** Path traversal, allowlist bypass, symlink attacks in `test_security.py` (26 tests)
- **CLI tests:** `test_cli.py` with click.CliRunner (32 tests)
- All tests use temp directories (never touch real `~/.peek/`)

## Important Implementation Notes

1. **Database:** WAL mode + busy_timeout 5000ms, foreign keys ON. Engine stored in `app.state.engine`.
2. **Atomic writes:** Write to temp dir first, then rename to final path (in `storage.py`)
3. **Entry creation transaction:** All DB + file operations wrapped in transaction. File failures roll back DB entry.
4. **Language detection:** Extension/filename → language mapping in `language.py`
5. **Static files:** FastAPI serves `frontend/dist/` in production (see `_setup_static_files()` in `main.py`)

## Configuration (PEEK_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEK_DATA_DIR` | `~/.peek/data` | File storage directory |
| `PEEK_DB_PATH` | `~/.peek/peek.db` | SQLite database path |
| `PEEK_ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEK_HOST` | `127.0.0.1` | Server bind address |
| `PEEK_PORT` | `8080` | Server port |
| `PEEK_API_KEY` | `""` | API key for auth (empty = no auth) |
| `PEEK_CORS_ORIGINS` | `http://localhost:5173` | CORS allowed origins |

## Implementation Status

See `INDEX.md` for detailed status. Backend Tasks 0-12 complete:
- Task 0: Test infrastructure (conftest.py, factories.py)
- Task 1: Project scaffolding (pyproject.toml, __main__.py)
- Task 2: Exception hierarchy
- Task 3: Configuration management
- Task 4: Data models (SQLModel)
- Task 5: Language detection
- Task 6: Database initialization (WAL, FTS5)
- Task 7: File storage layer
- Task 8: File service (allowlist security)
- Task 9: Entry service (transactions, TOCTOU protection)
- Task 10: API routes (entries, files)
- Task 11: Security tests
- Task 12: CLI commands

Remaining:
- Task 14-16: Frontend (Vue 3 + Vite + Shiki SPA)

## Frontend Prototype

Location: `frontend/prototype/index.html`

Current iteration: **v3** - Mobile bottom bar refactor (2026-04-23)

See `frontend/prototype/ITERATIONS.md` for detailed changelog.

### Mobile Bottom Bar Design (v3)

| Scenario | Left Section | Right Buttons |
|----------|--------------|---------------|
| Multi-file | ☰ hamburger + "N files" badge | Wrap, Copy, Down |
| Single-file | 📄 filename (no hamburger) | Wrap, Copy, Down |
| Markdown with headings | 📄 filename | Copy, Down, TOC |
| Code file | ☰ or 📄 (based on file count) | Wrap, Copy, Down (no TOC) |

Key behaviors:
- **Wrap button**: toggles code wrapping (code files only)
- **Copy button**: copies file content without line numbers
- **Hamburger button**: opens file drawer (multi-file only)
- **TOC button**: opens TOC drawer (Markdown with headings only)
- Left section shows filename directly for single-file entries

## Common Tasks

When working on backend code:
1. Check `docs/plans/impl-plan.md` for task context
2. Follow existing patterns in `services/` and `api/`
3. Add tests to appropriate `test_*.py` file
4. Run `make test` before committing
5. Update `INDEX.md` status when completing tasks

When reviewing security:
- Check `docs/reviews/eng-review.md` for original security findings
- Review `test_security.py` for existing security tests
- Key files: `storage.py` (path validation), `file_service.py` (allowlist), `main.py` (API key middleware)
