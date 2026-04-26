# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeekView** is a lightweight code and document formatting service. Core purpose: Agent (AI) creates entries via API/CLI → humans view formatted content in browser.

- **Current State:** Backend and frontend both complete (Tasks 0-16)
- **Architecture:** FastAPI (Python 3.12+) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + TypeScript + Shiki SPA frontend
- **Key Docs:** All specs in `docs/specs/`, implementation plan in `docs/plans/impl-plan.md`, adversarial reviews in `docs/reviews/`
- **Dev Process:** Standard workflow in `docs/process/workflow.md` - **READ THIS FIRST** before starting any work

## Project Structure

```
peekview/
├── docs/
│   ├── specs/           # Requirements, design, test plan (v2.0, finalized)
│   ├── plans/           # Implementation plan (v2 revised, 16 tasks)
│   └── reviews/         # Adversarial reviews (CEO/Design/Eng/DX)
├── backend/             # FastAPI backend (Tasks 0-12 complete)
│   ├── peekview/        # Main package (note: package is "peekview", not "peek")
│   │   ├── main.py      # FastAPI app factory with DI via app.state
│   │   ├── models.py    # SQLModel Entry/File + Pydantic schemas
│   │   ├── config.py    # Pydantic Settings (PEEKVIEW_* env vars)
│   │   ├── database.py  # SQLite init with WAL + FTS5
│   │   ├── storage.py   # Filesystem operations (atomic writes)
│   │   ├── cli.py       # Click CLI (peekview serve/create/get/list/delete)
│   │   ├── api/         # FastAPI routes (entries, files)
│   │   └── services/    # Business logic (entry_service, file_service)
│   └── tests/           # pytest suite with shared conftest.py fixtures
├── frontend/            # [DEPRECATED] Old frontend - DO NOT USE
│   └── ...              # Kept for reference only
└── frontend-v3/         # Vue 3 + Vite + TypeScript + Shiki SPA (v3 - CURRENT)
    ├── src/             # TypeScript/Vue source files
    ├── dist/            # Build output (copied to backend/peekview/static/)
    └── e2e/             # Playwright E2E tests
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
pytest tests/test_api.py -v          # Single test file
pytest tests/test_api.py::test_create_entry -v   # Single test

# Code quality
make lint                  # ruff check + format --check
make format                # ruff check --fix + format

# Cleanup
make clean                 # Remove __pycache__, .pytest_cache, etc.
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
npm run test:e2e:ui        # Playwright with UI

# Code quality
npm run lint               # ESLint
npm run type-check         # TypeScript check
```

## Full Stack Development Workflow

```bash
# Terminal 1: Backend (from backend/)
make dev                   # Runs on http://localhost:8080

# Terminal 2: Frontend dev server (from frontend-v3/)
npm run dev                # Runs on http://localhost:5173

# Build frontend for production (copies to backend/peekview/static/)
cd frontend-v3 && npm run build
```

## CLI Usage

```bash
peekview serve                    # Start server (default: 127.0.0.1:8080)
peekview serve -p 3000 --reload   # Custom port + dev mode

peekview create file.txt -s "My code"                    # Create from file
peekview create src/*.py -s "Project" -t python -t cli   # Glob + tags
peekview create -s "From stdin" --from-stdin < code.py   # From pipe

echo "content" | peekview create -s "From pipe" --from-stdin

peekview get my-entry             # Show entry details
peekview list -q "python"         # Search with FTS5
peekview list -t cli -t python    # Filter by tags
peekview delete my-entry          # Delete (with confirmation)
```

## Key Architectural Decisions

### Data Model
- `entries` table: `id` (INTEGER PK), `slug` (UNIQUE, URL identifier), `summary`, `status`, `tags` (JSON), `expires_at`
- `files` table: `entry_id` (FK, CASCADE), `path` (relative dir), `filename`, `language`, `is_binary`, `size`, `sha256`
- FTS5 virtual table `entries_fts` for full-text search
- Files stored in `~/.peekview/data/default/{entry_id}/` with directory structure preserved

### Security (Critical - From Reviews)
1. **local_path allowlist** (not blacklist): Only paths under configured allowed directories permitted (see `config.is_local_path_allowed()`)
2. **Symlink check BEFORE resolve**: Check `original.is_symlink()` before `original.resolve()` (in `file_service.validate_local_path()`)
3. **Path traversal on `files.path`**: After computing `base / file_path`, verify resolved path starts with `base.resolve()` (in `storage.py`)
4. **API Key auth**: `Authorization: Bearer <token>` header required when `PEEKVIEW_API_KEY` env var set
5. **XSS protection**: `sanitize-html` used in frontend (MarkdownViewer.vue)

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### Frontend Architecture (v3)
- **Build**: Vite bundles to `frontend-v3/dist/`, which gets copied to `backend/peekview/static/`
- **Routing**: Vue Router with history mode (clean URLs, no #)
- **State**: Pinia stores + Composables pattern (`useTheme.ts`, `useShiki.ts`, `useEntry.ts`, `useToast.ts`)
- **Styling**: CSS variables for theming (variables.css, dark.css, light.css), FOUC prevention
- **Code highlighting**: Shiki singleton with CSS variables theme
- **Components**: Recursive FileTree, CodeViewer (line numbers, URL hash), MarkdownViewer (TOC)
- **Mobile**: Bottom bar with Wrap/Copy/Download/TOC buttons, drawer menus
- **Old version**: `frontend/` directory is deprecated, kept for reference only

### DI Pattern
Services are accessed via `app.state` (not module-level globals or per-request factories):
```python
# In API routes
entry_service = request.app.state.entry_service
# Or via helper
from peekview.services.entry_service import get_entry_service
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
- **Backend fixtures:** Shared in `conftest.py` (temp dirs, test DB, async client, factories)
- **Backend factories:** Test data builders in `factories.py`
- **Security tests:** Path traversal, allowlist bypass, symlink attacks in `test_security.py` (26 tests)
- **CLI tests:** `test_cli.py` with click.CliRunner (32 tests)
- **Frontend tests:** Vitest (unit) + Playwright (E2E)
- All tests use temp directories (never touch real `~/.peekview/`)

## Important Implementation Notes

1. **Database:** WAL mode + busy_timeout 5000ms, foreign keys ON. Engine stored in `app.state.engine`.
2. **Atomic writes:** Write to temp dir first, then rename to final path (in `storage.py`)
3. **Entry creation transaction:** All DB + file operations wrapped in transaction. File failures roll back DB entry.
4. **Language detection:** Extension/filename → language mapping in `language.py`
5. **Static files:** FastAPI serves `peekview/static/` in production. Frontend build must be copied there.

## Configuration (PEEKVIEW_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_DB_PATH` | `~/.peekview/peek.db` | SQLite database path |
| `PEEKVIEW_ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_HOST` | `127.0.0.1` | Server bind address |
| `PEEKVIEW_PORT` | `8080` | Server port |
| `PEEKVIEW_API_KEY` | `""` | API key for auth (empty = no auth) |
| `PEEKVIEW_CORS_ORIGINS` | `http://localhost:5173` | CORS allowed origins |

## Implementation Status

See `INDEX.md` for detailed status. All Tasks 0-16 complete:

**Backend (Tasks 0-12):**
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

**Frontend (Tasks 14-16):**
- Task 14: Vue 3 + Vite + TypeScript scaffold, design system, theme system
- Task 15: API client, UI components (Button, IconButton, Toast, Tooltip, LoadingSkeleton)
- Task 16: CodeViewer (Shiki), MarkdownViewer (TOC), FileTree, EntryListView, EntryDetailView, mobile UI

## Common Tasks

When working on backend code:
1. Check `docs/plans/impl-plan.md` for task context
2. Follow existing patterns in `services/` and `api/`
3. Add tests to appropriate `test_*.py` file
4. Run `make test` before committing
5. Update `INDEX.md` status when completing tasks

When working on frontend code:
1. Check `frontend-v3/prototype/ITERATIONS.md` for design evolution
2. Follow Vue 3 Composition API patterns with `<script setup>`
3. Use CSS variables from `variables.css` for theming
4. Place reusable UI components in `components/`
5. Place composables in `composables/`
6. Run `npm run build` to update static files in backend
7. **Note:** Do NOT use `frontend/` directory (deprecated)

When reviewing security:
- Check `docs/reviews/eng-review.md` for original security findings
- Review `test_security.py` for existing security tests
- Key files: `storage.py` (path validation), `file_service.py` (allowlist), `main.py` (API key middleware)
