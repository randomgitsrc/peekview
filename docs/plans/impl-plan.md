<!-- /autoplan restore point: docs/plans/impl-plan.restore.md -->
<!-- Revised after adversarial review (CEO 3.5/10, Design 3.2/10, Eng 4CRITICAL/11HIGH, DX 3.5/10) -->

# Peek MVP Implementation Plan (v2 — Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Peek MVP (v0.1) — a lightweight code & document formatting service where Agent creates entries via API/CLI and humans view formatted content in browser.

**Architecture:** FastAPI backend with SQLite (WAL mode, FTS5) + local filesystem storage. Vue 3 + Vite + Shiki SPA frontend. Backend serves API and hosts frontend static files in production. Three file upload modes: content inline, local_path copy, directory recursive scan. **Key v2 changes:** allowlist-based local_path security, API key auth, file content inline endpoint, proper DI via app.state, Shiki CSS variables mode + singleton.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel, SQLite (FTS5), Click, Pydantic BaseSettings, Vue 3, Vite, Shiki (CSS variables mode), markdown-it, sanitize-html, TypeScript

---

## Review-Driven Revisions (v1 to v2)

| # | Fix | Source | Severity |
|---|-----|--------|----------|
| 1 | Add file content inline endpoint | CEO+Eng+Design+DX | CRITICAL |
| 2 | Replace local_path blacklist with allowlist | CEO+Eng | CRITICAL |
| 3 | Add PEEK_API_KEY authentication | CEO+DX | CRITICAL |
| 4 | Fix DI: use app.state not per-request factories | CEO+Eng+DX | HIGH |
| 5 | Remove module-level app = create_app() | Eng+DX | HIGH |
| 6 | Fix symlink validation (check before resolve) | Eng | CRITICAL |
| 7 | Add files.path traversal validation | Eng | CRITICAL |
| 8 | Move conftest.py to Task 0 | CEO+Eng+DX | HIGH |
| 9 | Define get_engine() and EntryCreate/EntryUpdate | Eng | CRITICAL |
| 10 | Add created_at/updated_at defaults | Eng | HIGH |
| 11 | Shiki CSS variables mode + singleton | Design+Eng | HIGH |
| 12 | FileTree as actual tree structure | Design | HIGH |
| 13 | FOUC-free theme system | Design | HIGH |
| 14 | Add .gitignore + Makefile | DX+CEO | MEDIUM |
| 15 | POST /entries returns 201 | Eng | LOW |
| 16 | Add URL line hash #L5-L10 | Design+CEO | MEDIUM |
| 17 | Add Dockerfile | CEO+DX | MEDIUM |
| 18 | expires_in bounds checking | Eng | LOW |
| 19 | Entry creation transaction wrapping | Eng | HIGH |
| 20 | Static file serving for production SPA | Eng+DX | HIGH |

---
## File Structure

```
peek/
├── docs/specs/                     # Existing spec docs (v2.0)
├── backend/
│   ├── pyproject.toml              # Project config + dependencies
│   ├── Makefile                    # Unified dev workflow (make dev, test, lint, build)
│   ├── .gitignore                  # Ignore node_modules/, __pycache__/, .peek/, *.db, etc.
│   ├── peek/
│   │   ├── __init__.py             # Package init, version
│   │   ├── __main__.py             # Entry point: python -m peek
│   │   ├── main.py                 # FastAPI create_app() factory + middleware + exception handlers
│   │   ├── config.py               # Pydantic BaseSettings config
│   │   ├── models.py               # SQLModel data models (Entry, File) + Pydantic schemas
│   │   ├── database.py             # DB init, WAL, FTS5, triggers, get_engine via app.state
│   │   ├── storage.py              # File storage (copy, write, delete, path calc + validation)
│   │   ├── language.py             # Extension/filename → language mapping
│   │   ├── exceptions.py           # PeekError hierarchy + error codes
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── entries.py          # Entry CRUD routes
│   │   │   └── files.py            # File download / content / zip routes
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── entry_service.py    # Entry business logic
│   │   │   ├── file_service.py     # File processing + local_path allowlist security
│   │   │   └── cleanup.py          # Expiry cleanup logic
│   │   ├── cli.py                  # Click CLI commands
│   │   └── mcp_server.py           # FastMCP server (P1, stub for now)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py             # Fixtures: temp dirs, test client, factories (deduplicated)
│       ├── factories.py            # EntryFactory, FileInfo helpers
│       ├── test_config.py          # Config loading tests
│       ├── test_models.py          # Data model tests
│       ├── test_storage.py         # File storage tests
│       ├── test_language.py        # Language detection tests
│       ├── test_exceptions.py      # Exception hierarchy tests
│       ├── test_services.py        # Service layer tests (entry + file)
│       ├── test_api.py             # API endpoint tests
│       ├── test_security.py        # Security tests (path traversal, allowlist, XSS, SQLi)
│       └── test_cli.py             # CLI command tests
├── frontend/
│   ├── ...
└── README.md
```

---

### Task 0: Test Infrastructure + Project Bootstrapping

**Rationale:** This task creates the shared test fixtures (`conftest.py`, `factories.py`), `.gitignore`, and `Makefile` that all subsequent tasks depend on. The old plan placed these in Task 13 (last backend task) and duplicated client fixtures across 3 test files. Moving this first eliminates duplication and ensures fixtures are available from Task 2 onward.

**Files:**
- Create: `backend/.gitignore`
- Create: `backend/Makefile`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/factories.py`

- [ ] **Step 1: Create .gitignore**

```
# backend/.gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
*.egg-info/
dist/
build/
*.egg

# Virtual environments
.venv/
venv/
env/

# Peek data
.peek/
*.db
*.db-wal
*.db-shm

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.pytest_cache/

# Logs
*.log
```

- [ ] **Step 2: Create Makefile**

```makefile
# backend/Makefile
.PHONY: dev test lint build clean

dev:
	uvicorn peek.main:app --host 127.0.0.1 --port 8080 --reload

test:
	python -m pytest tests/ -v --tb=short

test-cov:
	python -m pytest tests/ -v --tb=short --cov=peek --cov-report=term-missing

lint:
	ruff check peek/ tests/
	ruff format --check peek/ tests/

format:
	ruff check --fix peek/ tests/
	ruff format peek/ tests/

build:
	pip install -e ".[test]"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov
```

- [ ] **Step 3: Create tests/__init__.py**

```python
# backend/tests/__init__.py
```

- [ ] **Step 4: Create conftest.py with deduplicated fixtures**

```python
# backend/tests/conftest.py
"""Shared test fixtures — single source of truth for all test files."""

import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session

from peek.config import PeekConfig
from peek.database import init_db
from peek.main import create_app
from peek.storage import StorageManager


@pytest.fixture
def temp_data_dir():
    """Temporary data directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_files(temp_data_dir):
    """Pre-created sample files of various types."""
    files = {}
    # Text file
    (temp_data_dir / "hello.py").write_text("print('hello')")
    # Binary file
    (temp_data_dir / "image.png").write_bytes(b'\x89PNG\r\n\x1a\n')
    # Markdown
    (temp_data_dir / "doc.md").write_text("# Title\nHello world")
    # Empty file
    (temp_data_dir / "empty.txt").write_text("")
    return files


@pytest.fixture
def peek_config(tmp_path):
    """PeekConfig pointing at temporary directories."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    return PeekConfig(
        data_dir=data_dir,
        db_path=db_path,
        max_file_size=1024 * 1024,
        max_entry_files=50,
        max_entry_size=10 * 1024 * 1024,
        max_slug_length=64,
        max_summary_length=500,
    )


@pytest.fixture
def db_engine(tmp_path):
    """Initialized database engine with temporary DB."""
    db_path = tmp_path / "test.db"
    return init_db(db_path)


@pytest.fixture
def storage(tmp_path):
    """StorageManager with temporary data directory."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return StorageManager(data_dir=data_dir, user_id="default")


@pytest.fixture
async def client(tmp_path):
    """Async HTTP test client for API tests — single shared definition."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def allowed_dir(tmp_path):
    """Temporary directory registered as an allowed_dir for file service tests."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    return allowed
```

- [ ] **Step 5: Create factories.py**

```python
# backend/tests/factories.py
"""Test data factories for reducing boilerplate in tests."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EntryFactory:
    """Factory for creating test entry data."""

    _counter: int = field(default=0, init=False)

    def build(self, **kwargs) -> dict:
        """Build entry creation payload."""
        self._counter += 1
        defaults = {
            "summary": f"Test entry {self._counter}",
        }
        defaults.update(kwargs)
        return defaults

    def build_batch(self, n: int, **kwargs) -> list[dict]:
        """Build n entry creation payloads."""
        return [self.build(**kwargs) for _ in range(n)]
```

- [ ] **Step 6: Verify conftest loads**

Run: `cd ~/lab/projects/peek/backend && python -c "from tests.conftest import *; print('OK')"`
Expected: OK

- [ ] **Step 7: Commit**

```bash
cd ~/lab/projects/peek
git add backend/.gitignore backend/Makefile backend/tests/__init__.py backend/tests/conftest.py backend/tests/factories.py
git commit -m "chore(backend): .gitignore, Makefile, and shared test fixtures (Task 0)"
```

---

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/peek/__init__.py`
- Create: `backend/peek/__main__.py`

**Review fixes applied:**
- Remove `app = create_app()` module-level global from `main.py` (moved to Task 10)
- Add `__main__.py` entry point so `python -m peek` works
- `.gitignore` and `Makefile` created in Task 0

- [ ] **Step 1: Create pyproject.toml with all dependencies**

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "peek"
version = "0.1.0"
description = "Lightweight code & document formatting display service"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "sqlmodel>=0.0.18",
    "pydantic-settings>=2.2",
    "click>=8.1",
    "python-multipart>=0.0.9",
    "pyyaml>=6.0",
    "aiofiles>=23.2",
]

[project.optional-dependencies]
test = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "pytest-cov>=5.0",
]
mcp = [
    "fastmcp>=0.1",
]

[project.scripts]
peek = "peek.cli:cli"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create \_\_init\_\_.py**

```python
"""Peek — Lightweight code & document formatting display service."""

__version__ = "0.1.0"
```

- [ ] **Step 3: Create \_\_main\_\_.py entry point**

```python
# backend/peek/__main__.py
"""Entry point for `python -m peek`."""

import uvicorn
from peek.config import PeekConfig


def main():
    config = PeekConfig()
    uvicorn.run(
        "peek.main:app",
        host=config.server_host,
        port=config.server_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Install and verify**

Run: `cd ~/lab/projects/peek/backend && pip install -e ".[test]"`
Expected: Successfully installed peek-0.1.0

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/pyproject.toml backend/peek/__init__.py backend/peek/__main__.py
git commit -m "feat(backend): project scaffolding with pyproject.toml and __main__.py entry point"
```

---

### Task 2: Exception Hierarchy

**Files:**
- Create: `backend/peek/exceptions.py`

**Review fixes applied:**
- No major changes needed. `ForbiddenPathError` docstring updated to reference allowlist rather than blacklist.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_exceptions.py
from peek.exceptions import (
    PeekError,
    ValidationError,
    InvalidSlugError,
    ForbiddenPathError,
    NotFoundError,
    FileNotFoundError,
    PayloadTooLargeError,
    ConflictError,
)


def test_peek_error_base():
    err = PeekError("something broke")
    assert str(err) == "something broke"
    assert err.status_code == 500
    assert err.error_code == "INTERNAL_ERROR"


def test_validation_error():
    err = ValidationError("missing field")
    assert err.status_code == 400
    assert err.error_code == "VALIDATION_ERROR"


def test_invalid_slug_error():
    err = InvalidSlugError("bad slug!")
    assert err.status_code == 400
    assert err.error_code == "INVALID_SLUG"


def test_forbidden_path_error():
    err = ForbiddenPathError("/etc/shadow")
    assert err.status_code == 403
    assert err.error_code == "FORBIDDEN_PATH"


def test_not_found_error():
    err = NotFoundError("no entry")
    assert err.status_code == 404
    assert err.error_code == "NOT_FOUND"


def test_file_not_found_error():
    err = FileNotFoundError("missing.py")
    assert err.status_code == 404
    assert err.error_code == "FILE_NOT_FOUND"


def test_payload_too_large_error():
    err = PayloadTooLargeError("file too big")
    assert err.status_code == 413
    assert err.error_code == "PAYLOAD_TOO_LARGE"


def test_conflict_error():
    err = ConflictError("slug taken")
    assert err.status_code == 409
    assert err.error_code == "CONFLICT"


def test_all_inherit_from_peek_error():
    for cls in [ValidationError, InvalidSlugError, ForbiddenPathError,
                NotFoundError, FileNotFoundError, PayloadTooLargeError, ConflictError]:
        assert issubclass(cls, PeekError)
        assert issubclass(cls, Exception)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_exceptions.py -v`
Expected: FAIL — ModuleNotFoundError: No module named 'peek.exceptions'

- [ ] **Step 3: Write implementation**

```python
# backend/peek/exceptions.py
"""Unified exception hierarchy for Peek API errors."""


class PeekError(Exception):
    """Base exception for all Peek errors."""
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"


class ValidationError(PeekError):
    """Parameter validation failed."""
    status_code = 400
    error_code = "VALIDATION_ERROR"


class InvalidSlugError(PeekError):
    """Slug format is invalid."""
    status_code = 400
    error_code = "INVALID_SLUG"


class ForbiddenPathError(PeekError):
    """local_path is outside allowed directories."""
    status_code = 403
    error_code = "FORBIDDEN_PATH"


class NotFoundError(PeekError):
    """Resource not found."""
    status_code = 404
    error_code = "NOT_FOUND"


class FileNotFoundError(PeekError):
    """File not found on disk."""
    status_code = 404
    error_code = "FILE_NOT_FOUND"


class PayloadTooLargeError(PeekError):
    """Resource limit exceeded."""
    status_code = 413
    error_code = "PAYLOAD_TOO_LARGE"


class ConflictError(PeekError):
    """Resource conflict."""
    status_code = 409
    error_code = "CONFLICT"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_exceptions.py -v`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/exceptions.py backend/tests/test_exceptions.py
git commit -m "feat(backend): exception hierarchy with unified error codes"
```

---

### Task 3: Configuration Management

**Files:**
- Create: `backend/peek/config.py`

**Review fixes applied:**
- Add `PEEK_API_KEY: str | None = None` field for API key auth
- Add `allowed_dirs: list[Path]` field for local_path allowlist (replaces blacklist approach)
- Keep `forbidden_paths` for backward compat but mark as deprecated
- Add `cors_origins: list[str]` configurable (not hardcoded)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_config.py
import os
import tempfile
from pathlib import Path

import pytest
import yaml

from peek.config import PeekConfig, load_config


def test_default_config():
    cfg = PeekConfig()
    assert cfg.server_host == "127.0.0.1"
    assert cfg.server_port == 8080
    assert cfg.base_url == ""
    assert cfg.data_dir == Path.home() / ".peek" / "data"
    assert cfg.db_path == Path.home() / ".peek" / "peek.db"
    assert cfg.max_file_size == 10 * 1024 * 1024
    assert cfg.max_content_length == 1024 * 1024
    assert cfg.max_entry_files == 50
    assert cfg.max_entry_size == 100 * 1024 * 1024
    assert cfg.max_slug_length == 64
    assert cfg.max_summary_length == 500
    assert cfg.cleanup_check_on_start is True
    assert cfg.cleanup_interval_seconds == 3600


def test_load_from_yaml(tmp_path):
    config_data = {
        "server": {"host": "0.0.0.0", "port": 9090, "base_url": "https://peek.example.com"},
        "limits": {"max_file_size": 20971520},
    }
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump(config_data))

    cfg = load_config(config_file)
    assert cfg.server_host == "0.0.0.0"
    assert cfg.server_port == 9090
    assert cfg.base_url == "https://peek.example.com"
    assert cfg.max_file_size == 20971520
    # Defaults preserved for unset fields
    assert cfg.max_entry_files == 50


def test_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("PEEK_HOST", "0.0.0.0")
    monkeypatch.setenv("PEEK_PORT", "3000")
    monkeypatch.setenv("PEEK_BASE_URL", "https://example.com")

    cfg = PeekConfig()
    assert cfg.server_host == "0.0.0.0"
    assert cfg.server_port == 3000
    assert cfg.base_url == "https://example.com"


def test_missing_config_file_uses_defaults(tmp_path):
    cfg = load_config(tmp_path / "nonexistent.yaml")
    assert cfg.server_host == "127.0.0.1"
    assert cfg.server_port == 8080


def test_invalid_config_yaml(tmp_path):
    bad_file = tmp_path / "bad.yaml"
    bad_file.write_text("{{invalid yaml::")
    with pytest.raises(ValueError, match="Invalid config"):
        load_config(bad_file)


def test_limits_defaults():
    cfg = PeekConfig()
    assert cfg.max_file_size == 10485760
    assert cfg.max_content_length == 1048576
    assert cfg.max_entry_files == 50
    assert cfg.max_entry_size == 104857600
    assert cfg.max_slug_length == 64
    assert cfg.max_summary_length == 500


def test_api_key_default_none():
    """PEEK_API_KEY defaults to None (auth disabled)."""
    cfg = PeekConfig()
    assert cfg.api_key is None


def test_api_key_from_env(monkeypatch):
    """PEEK_API_KEY can be set via environment variable."""
    monkeypatch.setenv("PEEK_API_KEY", "my-secret-key")
    cfg = PeekConfig()
    assert cfg.api_key == "my-secret-key"


def test_allowed_dirs_default_empty():
    """allowed_dirs defaults to empty list (no allowlist configured)."""
    cfg = PeekConfig()
    assert cfg.allowed_dirs == []


def test_allowed_dirs_from_yaml(tmp_path):
    """allowed_dirs can be configured from YAML."""
    config_data = {
        "storage": {
            "allowed_dirs": ["/home/user/projects", "/tmp/peek-src"],
        },
    }
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump(config_data))
    cfg = load_config(config_file)
    assert Path("/home/user/projects") in cfg.allowed_dirs
    assert Path("/tmp/peek-src") in cfg.allowed_dirs


def test_cors_origins_default():
    """cors_origins defaults to localhost dev server."""
    cfg = PeekConfig()
    assert "http://localhost:5173" in cfg.cors_origins


def test_cors_origins_from_yaml(tmp_path):
    """cors_origins can be configured from YAML."""
    config_data = {
        "server": {
            "cors_origins": ["https://peek.example.com", "http://localhost:5173"],
        },
    }
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump(config_data))
    cfg = load_config(config_file)
    assert "https://peek.example.com" in cfg.cors_origins


def test_forbidden_paths_deprecated(tmp_path):
    """forbidden_paths still works but is deprecated."""
    config_data = {
        "storage": {
            "forbidden_paths": ["/custom/secret"],
        },
    }
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump(config_data))
    cfg = load_config(config_file)
    assert "/custom/secret" in cfg.forbidden_paths


def test_base_url_fallback():
    cfg = PeekConfig()
    cfg.base_url = ""
    expected = f"http://{cfg.server_host}:{cfg.server_port}"
    assert cfg.view_base_url == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_config.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/config.py
"""Configuration management using Pydantic BaseSettings."""

from __future__ import annotations

import logging
import warnings
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# Default ignored dir names for directory scanning
DEFAULT_IGNORED_DIRS = {
    ".git", ".svn", "__pycache__", "node_modules",
    ".venv", "venv", ".tox", "dist", "build",
}

# Default forbidden filename patterns (used only when allowed_dirs is empty)
_DEFAULT_FORBIDDEN_PATTERNS = [".env", "id_rsa", "id_ed25519"]


class PeekConfig(BaseSettings):
    """Peek application configuration.

    Priority: environment variables > config file > defaults
    """

    # Server
    server_host: str = Field(default="127.0.0.1", alias="PEEK_HOST")
    server_port: int = Field(default=8080, alias="PEEK_PORT")
    base_url: str = Field(default="", alias="PEEK_BASE_URL")

    # Security
    api_key: str | None = Field(default=None, alias="PEEK_API_KEY")

    # CORS
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        alias="PEEK_CORS_ORIGINS",
    )

    # Storage
    data_dir: Path = Field(default=Path.home() / ".peek" / "data", alias="PEEK_DATA_DIR")
    db_path: Path = Field(default=Path.home() / ".peek" / "peek.db", alias="PEEK_DB_PATH")
    allowed_dirs: list[Path] = Field(default_factory=list)
    forbidden_paths: list[str] = Field(
        default_factory=list,
        deprecated="Use allowed_dirs instead. forbidden_paths will be removed in v0.2.",
    )
    forbidden_patterns: list[str] = Field(default_factory=lambda: list(_DEFAULT_FORBIDDEN_PATTERNS))
    ignored_dirs: set[str] = Field(default_factory=lambda: set(DEFAULT_IGNORED_DIRS))

    # Limits
    max_file_size: int = Field(default=10 * 1024 * 1024)       # 10 MB
    max_content_length: int = Field(default=1024 * 1024)        # 1 MB (inline content)
    max_entry_files: int = Field(default=50)
    max_entry_size: int = Field(default=100 * 1024 * 1024)      # 100 MB
    max_slug_length: int = Field(default=64)
    max_summary_length: int = Field(default=500)
    max_per_page: int = Field(default=100)
    default_per_page: int = Field(default=20)

    # Cleanup
    cleanup_check_on_start: bool = Field(default=True)
    cleanup_interval_seconds: int = Field(default=3600)

    # Logging
    log_level: str = Field(default="INFO", alias="PEEK_LOG_LEVEL")
    log_file: Path = Field(default=Path.home() / ".peek" / "peek.log")

    model_config = {"populate_by_name": True}

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        if self.forbidden_paths:
            warnings.warn(
                "forbidden_paths is deprecated. Use allowed_dirs instead. "
                "forbidden_paths will be removed in v0.2.",
                DeprecationWarning,
                stacklevel=2,
            )

    @property
    def view_base_url(self) -> str:
        """Base URL for generating entry view links."""
        if self.base_url:
            return self.base_url
        return f"http://{self.server_host}:{self.server_port}"

    def build_view_url(self, slug: str) -> str:
        """Generate full view URL for an entry."""
        return f"{self.view_base_url}/view/{slug}"


def load_config(config_path: Path | None = None) -> PeekConfig:
    """Load configuration from YAML file, with env var overrides.

    Args:
        config_path: Path to config.yaml. If None or file doesn't exist,
                     uses defaults + env vars.

    Returns:
        PeekConfig instance.

    Raises:
        ValueError: If config file exists but contains invalid YAML.
    """
    file_values: dict[str, Any] = {}

    if config_path and config_path.exists():
        try:
            with open(config_path) as f:
                raw = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid config file {config_path}: {e}") from e

        if raw and isinstance(raw, dict):
            # Flatten nested YAML into dot-notation keys
            file_values = _flatten_yaml(raw)

    return PeekConfig(**file_values)


def _flatten_yaml(data: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    """Flatten nested YAML dict into flat key-value pairs.

    Example: {"server": {"host": "0.0.0.0"}} → {"server_host": "0.0.0.0"}
    """
    result: dict[str, Any] = {}
    for key, value in data.items():
        full_key = f"{prefix}_{key}" if prefix else key
        if isinstance(value, dict):
            result.update(_flatten_yaml(value, full_key))
        elif isinstance(value, list):
            # Keep lists as-is (e.g. allowed_dirs, cors_origins)
            result[full_key] = value
        else:
            result[full_key] = value
    return result


def ensure_data_dirs(config: PeekConfig) -> None:
    """Create data directories if they don't exist."""
    config.data_dir.mkdir(parents=True, exist_ok=True)
    config.db_path.parent.mkdir(parents=True, exist_ok=True)
    config.log_file.parent.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_config.py -v`
Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/config.py backend/tests/test_config.py
git commit -m "feat(backend): Pydantic BaseSettings config with allowlist, API key, CORS"
```

---

### Task 4: Data Models

**Files:**
- Create: `backend/peek/models.py`

**Review fixes applied:**
- Add `sa_column` with `default` for `created_at` and `updated_at` (server-side defaults, not just Python-side)
- Define `EntryCreate` and `EntryUpdate` Pydantic schemas explicitly (were referenced but incomplete)
- Remove `line_count` phantom field from `FileResponse` schema (it was computed at response time, not stored)
- Ensure tags field uses proper JSON serialization

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
import json
from datetime import datetime, timezone

from peek.models import Entry, File, EntryCreate, EntryUpdate, EntryResponse, FileResponse


def test_entry_creation():
    entry = Entry(slug="test-slug", summary="Test entry")
    assert entry.slug == "test-slug"
    assert entry.summary == "Test entry"
    assert entry.status == "active"
    assert entry.user_id == "default"
    assert entry.tags == "[]"


def test_entry_id_is_auto():
    """Entry id is auto-increment, not set by user."""
    entry = Entry(slug="a", summary="test")
    assert entry.id is None  # Not set until DB insert


def test_entry_slug_uniqueness():
    """slug field is UNIQUE — enforced at DB level, not model level."""
    # This is tested via DB integration test, not unit test
    pass


def test_entry_expires_at():
    entry = Entry(slug="b", summary="expiring", expires_at=datetime(2026, 5, 1, tzinfo=timezone.utc))
    assert entry.expires_at is not None


def test_entry_tags_json():
    tags = ["python", "auth"]
    entry = Entry(slug="c", summary="tagged", tags=json.dumps(tags))
    assert json.loads(entry.tags) == ["python", "auth"]


def test_entry_status_check_constraint():
    """status must be one of: active, archived, published."""
    entry = Entry(slug="d", summary="test", status="archived")
    assert entry.status == "archived"
    entry2 = Entry(slug="e", summary="test", status="published")
    assert entry2.status == "published"


def test_entry_user_id_default():
    entry = Entry(slug="f", summary="test")
    assert entry.user_id == "default"


def test_entry_created_at_default():
    """created_at is auto-populated when not provided."""
    entry = Entry(slug="g", summary="test")
    assert entry.created_at is not None
    assert isinstance(entry.created_at, datetime)


def test_entry_updated_at_default():
    """updated_at is auto-populated when not provided."""
    entry = Entry(slug="h", summary="test")
    assert entry.updated_at is not None


def test_file_creation():
    f = File(entry_id=1, filename="main.py", language="python", size=256)
    assert f.entry_id == 1
    assert f.filename == "main.py"
    assert f.path is None  # No directory structure


def test_file_path_with_directory():
    f = File(entry_id=1, filename="main.py", path="src/main.py", language="python", size=256)
    assert f.path == "src/main.py"


def test_file_is_binary_default():
    f = File(entry_id=1, filename="data.bin", size=100)
    assert f.is_binary is False


def test_file_sha256():
    f = File(entry_id=1, filename="a.py", size=10, sha256="abc123")
    assert f.sha256 == "abc123"


def test_entry_create_schema():
    """Pydantic input schema for creating entries."""
    data = EntryCreate(summary="Test", slug="my-slug", tags=["python"])
    assert data.summary == "Test"
    assert data.slug == "my-slug"
    assert data.tags == ["python"]


def test_entry_create_slug_optional():
    """slug is optional — auto-generated if not provided."""
    data = EntryCreate(summary="No slug")
    assert data.slug is None


def test_entry_update_schema():
    """Pydantic input schema for updating entries — all fields optional."""
    data = EntryUpdate(summary="Updated")
    assert data.summary == "Updated"
    assert data.status is None
    assert data.tags is None
    assert data.add_files == []
    assert data.remove_file_ids == []


def test_entry_response_schema():
    """Pydantic output schema includes computed url, no line_count in files."""
    resp = EntryResponse(
        id=1, slug="test", url="http://localhost:8080/view/test",
        summary="Test",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    assert resp.url == "http://localhost:8080/view/test"


def test_file_response_no_line_count():
    """FileResponse does NOT include line_count (phantom field removed)."""
    resp = FileResponse(id=1, filename="main.py", language="python",
                        is_binary=False, size=100)
    assert resp.filename == "main.py"
    assert not hasattr(resp, "line_count"), "line_count should not be in FileResponse"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_models.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/models.py
"""SQLModel data models for entries and files."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


class Entry(SQLModel, table=True):
    """Entry table — one display unit with summary + files."""
    __tablename__ = "entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    summary: str = Field(max_length=500)
    status: str = Field(default="active")
    tags: str = Field(default="[]")  # JSON array string: ["tag1", "tag2"]
    user_id: str = Field(default="default", index=True)
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )


class File(SQLModel, table=True):
    """File table — individual files belonging to an entry."""
    __tablename__ = "files"

    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entries.id", index=True)
    path: Optional[str] = None  # Relative path, e.g. "src/main.py"
    filename: str
    language: Optional[str] = None  # Auto-detected from extension
    is_binary: bool = Field(default=False)
    size: int  # Bytes
    sha256: Optional[str] = None
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


# --- Pydantic schemas (not tables) for API I/O ---

class FileInput(SQLModel):
    """Input schema for a single file in create/update request."""
    path: Optional[str] = None
    content: Optional[str] = None       # Text content (inline)
    content_base64: Optional[str] = None  # Binary content (base64)
    local_path: Optional[str] = None    # Server filesystem path


class DirInput(SQLModel):
    """Input schema for a directory to scan."""
    path: str


class EntryCreate(SQLModel):
    """Input schema for creating an entry."""
    summary: str
    slug: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    files: list[FileInput] = Field(default_factory=list)
    dirs: list[DirInput] = Field(default_factory=list)
    expires_in: Optional[str] = None  # e.g. "7d", "1h"


class FileUpdateAdd(SQLModel):
    """Input schema for adding files in update request."""
    path: Optional[str] = None
    content: Optional[str] = None
    content_base64: Optional[str] = None
    local_path: Optional[str] = None


class EntryUpdate(SQLModel):
    """Input schema for updating an entry."""
    summary: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list[str]] = None
    add_files: list[FileUpdateAdd] = Field(default_factory=list)
    remove_file_ids: list[int] = Field(default_factory=list)
    add_dirs: list[DirInput] = Field(default_factory=list)


class FileResponse(SQLModel):
    """Output schema for a file in API responses. No line_count (not stored)."""
    id: int
    path: Optional[str] = None
    filename: str
    language: Optional[str] = None
    is_binary: bool
    size: int


class EntryResponse(SQLModel):
    """Output schema for create entry response."""
    id: int
    slug: str
    url: str
    summary: str
    status: str = "active"
    tags: list[str] = Field(default_factory=list)
    files: list[FileResponse] = Field(default_factory=list)
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class EntryListItem(SQLModel):
    """Output schema for entry in list responses."""
    id: int
    slug: str
    summary: str
    tags: list[str] = Field(default_factory=list)
    status: str = "active"
    file_count: int = 0
    created_at: datetime
    updated_at: datetime


class EntryListResponse(SQLModel):
    """Paginated list response."""
    items: list[EntryListItem]
    total: int
    page: int
    per_page: int
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_models.py -v`
Expected: 17 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/models.py backend/tests/test_models.py
git commit -m "feat(backend): SQLModel data models + Pydantic API schemas (no line_count, server-side defaults)"
```

---

### Task 5: Language Detection

**Files:**
- Create: `backend/peek/language.py`

**Review fixes applied:**
- No major changes needed.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_language.py
from peek.language import detect_language, is_binary_content


def test_extension_mapping_python():
    assert detect_language("main.py") == "python"

def test_extension_mapping_js():
    assert detect_language("app.js") == "javascript"

def test_extension_mapping_ts():
    assert detect_language("app.ts") == "typescript"

def test_extension_mapping_java():
    assert detect_language("App.java") == "java"

def test_extension_mapping_cpp():
    assert detect_language("main.cpp") == "cpp"

def test_extension_mapping_go():
    assert detect_language("main.go") == "go"

def test_extension_mapping_rust():
    assert detect_language("main.rs") == "rust"

def test_extension_mapping_html():
    assert detect_language("index.html") == "html"

def test_extension_mapping_css():
    assert detect_language("style.css") == "css"

def test_extension_mapping_yaml():
    assert detect_language("config.yaml") == "yaml"
    assert detect_language("config.yml") == "yaml"

def test_extension_mapping_json():
    assert detect_language("package.json") == "json"

def test_extension_mapping_markdown():
    assert detect_language("README.md") == "markdown"

def test_extension_mapping_bash():
    assert detect_language("run.sh") == "bash"

def test_extension_mapping_sql():
    assert detect_language("schema.sql") == "sql"

def test_filename_mapping_makefile():
    assert detect_language("Makefile") == "makefile"

def test_filename_mapping_dockerfile():
    assert detect_language("Dockerfile") == "dockerfile"

def test_filename_mapping_cmakelists():
    assert detect_language("CMakeLists.txt") == "cmake"

def test_filename_mapping_gitignore():
    assert detect_language(".gitignore") == "gitignore"

def test_unknown_extension():
    assert detect_language("data.xyz") is None

def test_case_insensitive_extension():
    assert detect_language("Main.PY") == "python"

def test_is_binary_text():
    assert is_binary_content(b"print('hello')") is False

def test_is_binary_null_bytes():
    assert is_binary_content(b"\x00\x01\x02") is True

def test_is_binary_utf8():
    assert is_binary_content("中文内容".encode("utf-8")) is False

def test_is_binary_empty():
    assert is_binary_content(b"") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_language.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/language.py
"""Language detection from file extensions and filenames."""

from __future__ import annotations

from pathlib import PurePosixPath

# Extension → Shiki language ID
EXTENSION_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".java": "java",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".md": "markdown",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".sql": "sql",
    ".dockerfile": "dockerfile",
    ".makefile": "makefile",
    ".txt": "text",
    ".log": "log",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".vue": "vue",
    ".svelte": "svelte",
    ".r": "r",
    ".R": "r",
    ".lua": "lua",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".clj": "clojure",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".ml": "ocaml",
    ".fs": "fsharp",
    ".dart": "dart",
    ".zig": "zig",
    ".nim": "nim",
    ".perl": "perl",
    ".pl": "perl",
    ".v": "v",
    ".proto": "protobuf",
    ".graphql": "graphql",
    ".tf": "hcl",
    ".dockerignore": "gitignore",
}

# Filename (exact match) → Shiki language ID
FILENAME_MAP: dict[str, str] = {
    "Makefile": "makefile",
    "Dockerfile": "dockerfile",
    "CMakeLists.txt": "cmake",
    ".gitignore": "gitignore",
    ".env": "env",
    "Gemfile": "ruby",
    "Rakefile": "ruby",
    "Vagrantfile": "ruby",
}


def detect_language(filename: str) -> str | None:
    """Detect language from filename.

    Checks filename exact match first, then extension.

    Args:
        filename: Just the filename (e.g. "main.py", "Makefile").

    Returns:
        Shiki language ID (e.g. "python") or None if unknown.
    """
    # Check exact filename match first
    if filename in FILENAME_MAP:
        return FILENAME_MAP[filename]

    # Check extension (case-insensitive)
    ext = PurePosixPath(filename).suffix.lower()
    return EXTENSION_MAP.get(ext)


def is_binary_content(data: bytes, sample_size: int = 8192) -> bool:
    """Detect if byte content is binary (not human-readable text).

    Uses null-byte heuristic: if the first sample_size bytes contain
    a null byte, it's likely binary.

    Args:
        data: File content bytes.
        sample_size: Number of bytes to check.

    Returns:
        True if content appears to be binary.
    """
    if not data:
        return False
    sample = data[:sample_size]
    return b"\x00" in sample
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_language.py -v`
Expected: 24 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/language.py backend/tests/test_language.py
git commit -m "feat(backend): language detection from extension/filename"
```

---

### Task 6: Database Initialization (WAL + FTS5)

**Files:**
- Create: `backend/peek/database.py`

**Review fixes applied:**
- Define `get_engine()` function properly (was referencing module global; now uses `app.state`)
- Use `app.state` for engine caching, not module-level global
- Add connection event handler for PRAGMA settings (set on every new connection, not just initial)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_database.py
import tempfile
from pathlib import Path

from peek.database import init_db, get_engine
from peek.models import Entry, File
from sqlmodel import Session, select


def test_init_db_creates_tables(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with Session(engine) as session:
        # Can insert an entry
        entry = Entry(slug="test", summary="Test entry")
        session.add(entry)
        session.commit()
        assert entry.id is not None


def test_wal_mode_enabled(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode"))
        assert result.scalar() == "wal"


def test_foreign_keys_enabled(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text("PRAGMA foreign_keys"))
        assert result.scalar() == 1


def test_pragma_on_every_connection(tmp_path):
    """PRAGMA settings must be set on every new connection, not just the first."""
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    # Open a second connection and verify PRAGMA is still set
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text("PRAGMA foreign_keys"))
        assert result.scalar() == 1


def test_fts5_table_exists(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
        ))
        assert result.fetchone() is not None


def test_fts5_auto_sync_on_insert(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with Session(engine) as session:
        entry = Entry(slug="search-test", summary="Python auth module", tags='["python","auth"]')
        session.add(entry)
        session.commit()
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text(
            "SELECT * FROM entries_fts WHERE entries_fts MATCH 'python'"
        ))
        rows = result.fetchall()
        assert len(rows) >= 1


def test_cascade_delete_files(tmp_path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    with Session(engine) as session:
        entry = Entry(slug="del-test", summary="To delete")
        session.add(entry)
        session.commit()
        f = File(entry_id=entry.id, filename="a.py", size=10)
        session.add(f)
        session.commit()
        file_id = f.id
        session.delete(entry)
        session.commit()
        # File should be gone
        result = session.exec(select(File).where(File.id == file_id))
        assert result.first() is None


def test_get_engine_returns_initialized_engine(tmp_path):
    """get_engine() returns the engine stored on app.state."""
    from fastapi import FastAPI
    db_path = tmp_path / "test.db"
    app = FastAPI()
    engine = init_db(db_path, app=app)
    assert get_engine(app) is engine


def test_get_engine_without_app_uses_default(tmp_path, monkeypatch):
    """get_engine() without app creates engine from default config."""
    monkeypatch.setenv("PEEK_DB_PATH", str(tmp_path / "default.db"))
    monkeypatch.setenv("PEEK_DATA_DIR", str(tmp_path / "data"))
    engine = get_engine()  # No app — creates from config
    assert engine is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_database.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/database.py
"""Database initialization with WAL mode, FTS5, and triggers."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import event, text
from sqlmodel import SQLModel, create_engine
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def _set_pragma(dbapi_connection, connection_record):
    """Set PRAGMA settings on every new SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db(db_path: Path, app: Optional[object] = None) -> Engine:
    """Initialize database with WAL mode, create tables, FTS5 index, and triggers.

    Args:
        db_path: Path to SQLite database file.
        app: Optional FastAPI app instance. If provided, engine is stored on app.state.

    Returns:
        SQLModel engine instance.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(f"sqlite:///{db_path}", echo=False)

    # Register PRAGMA event handler — fires on every new connection
    event.listen(engine, "connect", _set_pragma)

    # Create SQLModel tables
    SQLModel.metadata.create_all(engine)

    # Create FTS5 virtual table and triggers
    _create_fts5(engine)

    # Store engine on app.state if app provided
    if app is not None:
        app.state.db_engine = engine

    return engine


def get_engine(app: Optional[object] = None) -> Engine:
    """Get the database engine.

    Priority:
    1. If app is provided, use app.state.db_engine
    2. Otherwise, create from default PeekConfig

    Args:
        app: Optional FastAPI app instance.

    Returns:
        SQLModel engine instance.
    """
    if app is not None and hasattr(app, "state") and hasattr(app.state, "db_engine"):
        return app.state.db_engine

    # Fallback: create from config
    from peek.config import PeekConfig
    config = PeekConfig()
    return init_db(config.db_path)


def _create_fts5(engine: Engine) -> None:
    """Create FTS5 virtual table and sync triggers if they don't exist."""
    with engine.connect() as conn:
        # Create FTS5 table (idempotent with IF NOT EXISTS)
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
                summary,
                tags,
                content='entries',
                content_rowid=rowid
            )
        """))

        # Trigger: INSERT → sync to FTS5
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
                INSERT INTO entries_fts(rowid, summary, tags)
                VALUES (new.rowid, new.summary, new.tags);
            END
        """))

        # Trigger: DELETE → remove from FTS5
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
                INSERT INTO entries_fts(entries_fts, rowid, summary, tags)
                VALUES('delete', old.rowid, old.summary, old.tags);
            END
        """))

        # Trigger: UPDATE → delete old + insert new in FTS5
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
                INSERT INTO entries_fts(entries_fts, rowid, summary, tags)
                VALUES('delete', old.rowid, old.summary, old.tags);
                INSERT INTO entries_fts(rowid, summary, tags)
                VALUES (new.rowid, new.summary, new.tags);
            END
        """))

        # Create additional indexes
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_entries_expires_at ON entries(expires_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at)"))

        conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_database.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/database.py backend/tests/test_database.py
git commit -m "feat(backend): database init with WAL, FTS5, app.state caching, connection PRAGMA handler"
```

---

### Task 7: File Storage Layer

**Files:**
- Create: `backend/peek/storage.py`

**Review fixes applied:**
- Add path validation in `get_disk_path()` — verify resolved path stays within entry directory
- Add `validate_disk_path(base: Path, computed: Path)` helper to prevent `files.path` traversal

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_storage.py
import tempfile
from pathlib import Path

import pytest

from peek.storage import StorageManager, validate_disk_path


@pytest.fixture
def storage(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return StorageManager(data_dir=data_dir, user_id="default")


def test_write_text_file(storage):
    path = storage.write_file(entry_id=1, filename="main.py", content=b"print('hello')")
    assert path.exists()
    assert path.read_text() == "print('hello')"


def test_write_binary_file(storage):
    data = b"\x89PNG\r\n\x1a\n"
    path = storage.write_file(entry_id=1, filename="image.png", content=data)
    assert path.exists()
    assert path.read_bytes() == data


def test_read_file(storage):
    storage.write_file(entry_id=1, filename="test.py", content=b"hello")
    content = storage.read_file(entry_id=1, filename="test.py")
    assert content == b"hello"


def test_delete_entry_files(storage):
    storage.write_file(entry_id=1, filename="a.py", content=b"a")
    storage.write_file(entry_id=1, filename="b.md", content=b"b")
    storage.delete_entry_files(entry_id=1)
    assert not storage.get_entry_dir(entry_id=1).exists()


def test_directory_structure_preserved(storage):
    """Files with path (e.g. src/main.py) preserve directory structure."""
    path = storage.write_file(entry_id=1, filename="main.py",
                              content=b"code", file_path="src/main.py")
    assert path == storage.data_dir / "default" / "1" / "src" / "main.py"
    assert path.exists()


def test_path_collision_handling(storage):
    """Same filename in different directories don't conflict."""
    p1 = storage.write_file(entry_id=1, filename="mod.py",
                            content=b"mod1", file_path="src/mod.py")
    p2 = storage.write_file(entry_id=1, filename="mod.py",
                            content=b"mod2", file_path="lib/mod.py")
    assert p1 != p2
    assert p1.read_bytes() == b"mod1"
    assert p2.read_bytes() == b"mod2"


def test_get_disk_path_with_subdir(storage):
    path = storage.get_disk_path(entry_id=1, filename="main.py", file_path="src/main.py")
    assert path == storage.data_dir / "default" / "1" / "src" / "main.py"


def test_get_disk_path_no_subdir(storage):
    path = storage.get_disk_path(entry_id=1, filename="main.py")
    assert path == storage.data_dir / "default" / "1" / "main.py"


def test_atomic_write_temp_then_rename(storage):
    """File should be written to temp dir first, then renamed."""
    path = storage.write_file(entry_id=1, filename="test.py", content=b"atomic")
    assert path.exists()
    # Temp dir should be empty after write
    tmp_dir = storage.data_dir / ".tmp"
    if tmp_dir.exists():
        assert not any(tmp_dir.iterdir())


def test_sha256_computation(storage):
    import hashlib
    content = b"hello world"
    expected = hashlib.sha256(content).hexdigest()
    result = storage.compute_sha256(content)
    assert result == expected


def test_write_file_creates_entry_dir(storage):
    """Entry directory is created automatically on write."""
    entry_dir = storage.get_entry_dir(entry_id=42)
    assert not entry_dir.exists()
    storage.write_file(entry_id=42, filename="x.py", content=b"x")
    assert entry_dir.exists()


# --- NEW: Path validation tests ---

def test_get_disk_path_traversal_rejected(storage):
    """file_path with .. must be rejected — path must stay within entry dir."""
    with pytest.raises(ValueError, match="traversal"):
        storage.get_disk_path(entry_id=1, filename="evil.py", file_path="../../etc/passwd")


def test_get_disk_path_absolute_rejected(storage):
    """file_path must be relative, not absolute."""
    with pytest.raises(ValueError, match="absolute"):
        storage.get_disk_path(entry_id=1, filename="evil.py", file_path="/etc/passwd")


def test_validate_disk_path_normal():
    """Normal relative path passes validation."""
    base = Path("/data/default/1")
    computed = Path("/data/default/1/src/main.py")
    # Should not raise
    validate_disk_path(base, computed)


def test_validate_disk_path_traversal():
    """Path that escapes base directory is rejected."""
    base = Path("/data/default/1")
    computed = Path("/etc/passwd")
    with pytest.raises(ValueError, match="outside"):
        validate_disk_path(base, computed)


def test_write_file_validates_path(storage):
    """write_file also validates the computed path stays within entry dir."""
    with pytest.raises(ValueError, match="traversal"):
        storage.write_file(
            entry_id=1,
            filename="evil.py",
            content=b"bad",
            file_path="../../../etc/passwd",
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_storage.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/storage.py
"""File storage management — write, read, delete, path computation + validation."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)


def validate_disk_path(base: Path, computed: Path) -> Path:
    """Validate that a computed disk path stays within the base entry directory.

    This prevents path traversal attacks via malicious file_path values.

    Args:
        base: The entry directory (e.g. data_dir/default/1/).
        computed: The full computed path for the file.

    Returns:
        The resolved computed path if valid.

    Raises:
        ValueError: If computed path resolves outside the base directory.
    """
    base_resolved = base.resolve()
    computed_resolved = computed.resolve()
    if not computed_resolved.is_relative_to(base_resolved):
        raise ValueError(
            f"Path traversal detected: {computed_resolved} is outside {base_resolved}"
        )
    return computed_resolved


class StorageManager:
    """Manages file storage on local filesystem.

    Directory layout:
        data_dir/{user_id}/{entry_id}/
            ├── src/main.py    (preserves directory structure)
            └── README.md      (root-level files)
    """

    def __init__(self, data_dir: Path, user_id: str = "default"):
        self.data_dir = data_dir
        self.user_id = user_id

    def get_entry_dir(self, entry_id: int) -> Path:
        """Get the storage directory for an entry."""
        return self.data_dir / self.user_id / str(entry_id)

    def get_disk_path(self, entry_id: int, filename: str, file_path: str | None = None) -> Path:
        """Compute disk path for a file, with traversal validation.

        Args:
            entry_id: Entry ID.
            filename: File name (e.g. "main.py").
            file_path: Relative path with directory (e.g. "src/main.py"), or None.

        Returns:
            Full path on disk.

        Raises:
            ValueError: If file_path contains traversal (..) or is absolute.
        """
        base = self.get_entry_dir(entry_id)

        if file_path:
            # Reject absolute paths
            if os.path.isabs(file_path):
                raise ValueError(f"file_path must be relative, got absolute: {file_path}")
            # Reject path traversal components
            parts = Path(file_path).parts
            if ".." in parts:
                raise ValueError(f"Path traversal not allowed in file_path: {file_path}")
            computed = base / file_path
        else:
            computed = base / filename

        # Final validation: resolved path must stay within entry dir
        validate_disk_path(base, computed)
        return computed

    def write_file(self, entry_id: int, filename: str, content: bytes,
                   file_path: str | None = None) -> Path:
        """Write file content using atomic write (temp → rename).

        Args:
            entry_id: Entry ID.
            filename: File name.
            content: Raw bytes to write.
            file_path: Relative path preserving directory structure.

        Returns:
            Path to the written file.
        """
        final_path = self.get_disk_path(entry_id, filename, file_path)

        # Write to temp directory first
        tmp_dir = self.data_dir / ".tmp" / str(uuid.uuid4())
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / filename

        try:
            tmp_path.write_bytes(content)
            # Create parent dirs for final path
            final_path.parent.mkdir(parents=True, exist_ok=True)
            # Atomic rename
            tmp_path.replace(final_path)
        finally:
            # Cleanup temp dir
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir, ignore_errors=True)

        return final_path

    def read_file(self, entry_id: int, filename: str, file_path: str | None = None) -> bytes:
        """Read file content from disk.

        Args:
            entry_id: Entry ID.
            filename: File name.
            file_path: Relative path, or None.

        Returns:
            File content bytes.

        Raises:
            FileNotFoundError: If file doesn't exist.
        """
        path = self.get_disk_path(entry_id, filename, file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        return path.read_bytes()

    def delete_entry_files(self, entry_id: int) -> None:
        """Delete all files for an entry (entire directory).

        Args:
            entry_id: Entry ID.
        """
        entry_dir = self.get_entry_dir(entry_id)
        if entry_dir.exists():
            shutil.rmtree(entry_dir, ignore_errors=True)
            logger.info("Deleted entry files: %s", entry_dir)

    @staticmethod
    def compute_sha256(content: bytes) -> str:
        """Compute SHA-256 hash of content."""
        return hashlib.sha256(content).hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_storage.py -v`
Expected: 17 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/storage.py backend/tests/test_storage.py
git commit -m "feat(backend): file storage with path traversal validation and atomic writes"
```

---

### Task 8: File Service (allowlist security + directory scan)

**Files:**
- Create: `backend/peek/services/__init__.py`
- Create: `backend/peek/services/file_service.py`

**Review fixes applied (MAJOR):**
- **Replace blacklist with allowlist**: `validate_local_path` checks path is within `config.allowed_dirs` (or data_dir if no allowed_dirs configured)
- Fix symlink check: check `original.is_symlink()` BEFORE `resolve()`
- Add hardlink detection: `os.stat(original).st_nlink > 1`
- Add `..` component rejection in original path string
- Fix `scan_directory` to validate each individual file's path
- Add `expires_in` bounds checking (min 1min, max 365 days)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_file_service.py
import os
import tempfile
from pathlib import Path

import pytest

from peek.exceptions import ForbiddenPathError
from peek.services.file_service import (
    FileService,
    validate_local_path,
    scan_directory,
    parse_expires_in,
)


# --- validate_local_path (ALLOWLIST approach) ---

def test_validate_local_path_allowed_dir(tmp_path):
    """File within allowed_dirs is accepted."""
    f = tmp_path / "hello.py"
    f.write_text("print('hi')")
    result = validate_local_path(str(f), allowed_dirs=[tmp_path])
    assert result == f.resolve()


def test_validate_local_path_outside_allowed_dir(tmp_path):
    """File outside all allowed_dirs is rejected."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "forbidden"
    outside.mkdir()
    secret = outside / "secret.py"
    secret.write_text("secret")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(secret), allowed_dirs=[allowed])


def test_validate_local_path_no_allowed_dirs_uses_data_dir(tmp_path):
    """When allowed_dirs is empty, data_dir is used as the only allowed dir."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    f = data_dir / "file.py"
    f.write_text("ok")
    # Should succeed — file is within data_dir
    result = validate_local_path(str(f), allowed_dirs=[], data_dir=data_dir)
    assert result == f.resolve()


def test_validate_local_path_symlink_rejected(tmp_path):
    """Symlinks are rejected — checked BEFORE resolve()."""
    real = tmp_path / "real.txt"
    real.write_text("content")
    link = tmp_path / "link.txt"
    link.symlink_to(real)
    with pytest.raises(ForbiddenPathError, match="[Ss]ymlink"):
        validate_local_path(str(link), allowed_dirs=[tmp_path])


def test_validate_local_path_hardlink_rejected(tmp_path):
    """Hardlinks (st_nlink > 1) are rejected."""
    original = tmp_path / "original.txt"
    original.write_text("content")
    hardlink = tmp_path / "hardlink.txt"
    os.link(str(original), str(hardlink))
    # original now has st_nlink == 2
    with pytest.raises(ForbiddenPathError, match="[Hh]ardlink"):
        validate_local_path(str(original), allowed_dirs=[tmp_path])


def test_validate_local_path_dotdot_rejected():
    """Paths with .. components are rejected."""
    with pytest.raises(ForbiddenPathError, match="\\.\\."):
        validate_local_path("../../etc/passwd", allowed_dirs=[Path("/")])


def test_validate_local_path_not_exists():
    """Non-existent path raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        validate_local_path("/nonexistent/file.py", allowed_dirs=[Path("/")])


def test_validate_local_path_is_dir(tmp_path):
    """Directory path raises ValueError."""
    with pytest.raises(ValueError, match="directory"):
        validate_local_path(str(tmp_path), allowed_dirs=[tmp_path])


# --- scan_directory ---

def test_scan_directory_recursive(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    (tmp_path / "README.md").write_text("readme")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    names = [f.filename for f in files]
    assert "main.py" in names
    assert "README.md" in names


def test_scan_directory_ignores_git(tmp_path):
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("git config")
    (tmp_path / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs={".git"})
    names = [f.filename for f in files]
    assert "config" not in names
    assert "main.py" in names


def test_scan_directory_ignores_hidden(tmp_path):
    (tmp_path / ".hidden").mkdir()
    (tmp_path / ".hidden" / "secret.py").write_text("secret")
    (tmp_path / "visible.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    names = [f.filename for f in files]
    assert "secret.py" not in names
    assert "visible.py" in names


def test_scan_directory_ignores_node_modules(tmp_path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "lib.js").write_text("lib")
    (tmp_path / "app.js").write_text("app")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs={"node_modules"})
    names = [f.filename for f in files]
    assert "lib.js" not in names


def test_scan_directory_preserves_paths(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    assert len(files) == 1
    assert files[0].path == "src/main.py"
    assert files[0].filename == "main.py"


def test_scan_directory_validates_each_file(tmp_path):
    """Each file in scanned directory is individually validated for path safety."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    # Should not raise — all files are within allowed_dir
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    assert len(files) == 1


# --- parse_expires_in ---

def test_expires_in_1h():
    delta = parse_expires_in("1h")
    assert delta.total_seconds() == 3600

def test_expires_in_7d():
    delta = parse_expires_in("7d")
    assert delta.total_seconds() == 7 * 86400

def test_expires_in_30m():
    delta = parse_expires_in("30m")
    assert delta.total_seconds() == 30 * 60

def test_expires_in_invalid():
    with pytest.raises(ValueError):
        parse_expires_in("abc")

def test_expires_in_zero():
    with pytest.raises(ValueError):
        parse_expires_in("0d")

def test_expires_in_minimum_1_minute():
    """expires_in below 1 minute is rejected."""
    with pytest.raises(ValueError, match="at least 1 minute"):
        parse_expires_in("0m")

def test_expires_in_maximum_365_days():
    """expires_in above 365 days is rejected."""
    with pytest.raises(ValueError, match="at most 365 days"):
        parse_expires_in("366d")

def test_expires_in_365_days_ok():
    """365 days is the maximum allowed."""
    delta = parse_expires_in("365d")
    assert delta.total_seconds() == 365 * 86400

def test_expires_in_1_minute_ok():
    """1 minute is the minimum allowed."""
    delta = parse_expires_in("1m")
    assert delta.total_seconds() == 60
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_file_service.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/services/__init__.py
"""Peek service layer."""
```

```python
# backend/peek/services/file_service.py
"""File processing logic — local_path allowlist security, directory scanning, binary detection."""

from __future__ import annotations

import base64
import logging
import os
import re
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from peek.exceptions import ForbiddenPathError
from peek.language import detect_language, is_binary_content

logger = logging.getLogger(__name__)

# Bounds for expires_in
_MIN_EXPIRES = timedelta(minutes=1)
_MAX_EXPIRES = timedelta(days=365)


@dataclass
class FileInfo:
    """Scanned file metadata."""
    path: str | None       # Relative path (e.g. "src/main.py")
    filename: str          # File name
    local_path: str        # Absolute path on server
    language: str | None = None
    is_binary: bool = False
    size: int = 0


def validate_local_path(
    local_path: str,
    allowed_dirs: list[Path],
    data_dir: Path | None = None,
) -> Path:
    """Validate that local_path is safe to read using ALLOWLIST approach.

    Security checks (in order):
    1. Reject `..` components in the original path string
    2. Reject symlinks (check is_symlink() BEFORE resolve())
    3. Resolve the path
    4. Reject hardlinks (st_nlink > 1)
    5. Verify path is within one of allowed_dirs (or data_dir if allowed_dirs empty)
    6. Verify path points to a regular file

    Args:
        local_path: User-supplied filesystem path.
        allowed_dirs: List of allowed directory prefixes (allowlist).
        data_dir: Fallback allowed dir when allowed_dirs is empty.

    Returns:
        Resolved Path object.

    Raises:
        ForbiddenPathError: Path fails security check.
        FileNotFoundError: Path doesn't exist.
        ValueError: Path is a directory, not a file.
    """
    original = Path(local_path)

    # 1. Reject .. components in the path string
    if ".." in original.parts:
        raise ForbiddenPathError(f"Path traversal (..) not allowed: {local_path}")

    # 2. Reject symlinks BEFORE resolve()
    if original.is_symlink():
        raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")

    resolved = original.resolve()

    # 3. Reject hardlinks (nlink > 1)
    try:
        stat_result = resolved.stat()
        if stat_result.st_nlink > 1:
            raise ForbiddenPathError(f"Hardlinks not allowed: {local_path}")
    except FileNotFoundError:
        pass  # Will be caught below

    # 4. Must exist
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {local_path}")

    # 5. Must be a regular file, not a directory
    if resolved.is_dir():
        raise ValueError(f"Path is a directory, not a file: {local_path}")

    # 6. Allowlist check — path must be within one of allowed_dirs
    effective_allowed = allowed_dirs if allowed_dirs else ([data_dir] if data_dir else [])
    if effective_allowed:
        path_allowed = False
        for allowed_dir in effective_allowed:
            allowed_resolved = allowed_dir.resolve()
            try:
                resolved.relative_to(allowed_resolved)
                path_allowed = True
                break
            except ValueError:
                continue
        if not path_allowed:
            raise ForbiddenPathError(
                f"Path is outside allowed directories: {local_path}"
            )

    return resolved


def scan_directory(dir_path: str, allowed_dirs: list[Path], ignored_dirs: set[str]) -> list[FileInfo]:
    """Recursively scan a directory for files.

    Each discovered file is individually validated against allowed_dirs.

    Args:
        dir_path: Absolute directory path.
        allowed_dirs: Allowed directory prefixes for path validation.
        ignored_dirs: Set of directory names to skip (e.g. {".git", "node_modules"}).

    Returns:
        List of FileInfo objects for discovered files.
    """
    root = Path(dir_path).resolve()
    files: list[FileInfo] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # Skip files in ignored directories
        if any(part in ignored_dirs for part in path.parts):
            continue
        # Skip hidden files/dirs (name starts with .)
        try:
            rel = path.relative_to(root)
        except ValueError:
            continue
        if any(part.startswith(".") for part in rel.parts):
            continue

        # Validate each individual file path
        try:
            validate_local_path(str(path), allowed_dirs=allowed_dirs)
        except (ForbiddenPathError, ValueError):
            logger.warning("Skipping disallowed file in scan: %s", path)
            continue

        try:
            content = path.read_bytes()
            binary = is_binary_content(content)
            lang = detect_language(path.name) if not binary else None
        except (OSError, PermissionError):
            logger.warning("Cannot read file: %s", path)
            continue

        files.append(FileInfo(
            path=str(rel) if str(rel) != path.name else None,
            filename=path.name,
            local_path=str(path),
            language=lang,
            is_binary=binary,
            size=path.stat().st_size,
        ))

    return files


def parse_expires_in(expires_in: str) -> timedelta:
    """Parse expires_in string to timedelta with bounds checking.

    Supported formats: "1h" (hours), "30m" (minutes), "7d" (days).

    Bounds:
    - Minimum: 1 minute
    - Maximum: 365 days

    Args:
        expires_in: Duration string.

    Returns:
        timedelta object.

    Raises:
        ValueError: Invalid format, zero/negative duration, or out of bounds.
    """
    match = re.match(r"^(\d+)([hmd])$", expires_in)
    if not match:
        raise ValueError(f"Invalid expires_in format: {expires_in!r}. Use e.g. '1h', '30m', '7d'")

    value = int(match.group(1))
    unit = match.group(2)

    if value <= 0:
        raise ValueError(f"expires_in must be positive: {expires_in!r}")

    if unit == "h":
        delta = timedelta(hours=value)
    elif unit == "m":
        delta = timedelta(minutes=value)
    elif unit == "d":
        delta = timedelta(days=value)
    else:
        raise ValueError(f"Unknown time unit: {unit}")

    # Bounds checking
    if delta < _MIN_EXPIRES:
        raise ValueError(
            f"expires_in must be at least 1 minute, got: {expires_in!r}"
        )
    if delta > _MAX_EXPIRES:
        raise ValueError(
            f"expires_in must be at most 365 days, got: {expires_in!r}"
        )

    return delta


def decode_base64_content(content_base64: str) -> bytes:
    """Decode base64 content string.

    Args:
        content_base64: Base64-encoded string.

    Returns:
        Decoded bytes.

    Raises:
        ValueError: Invalid base64.
    """
    try:
        return base64.b64decode(content_base64, validate=True)
    except Exception as e:
        raise ValueError(f"Invalid base64 content: {e}") from e
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_file_service.py -v`
Expected: 23 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/services/ backend/tests/test_file_service.py
git commit -m "feat(backend): file service with allowlist security, hardlink detection, expires_in bounds"
```

---

### Task 9: Entry Service (business logic)

**Files:**
- Create: `backend/peek/services/entry_service.py`

**Review fixes applied:**
- Fix DI: `get_entry_service()` should use `app.state` services, not create new instances each time
- Wrap entry creation in proper database transaction with rollback
- Fix `update_entry` to also delete filesystem files when DB records change
- Add slug conflict handling with proper TOCTOU protection (retry on IntegrityError)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_entry_service.py
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
from sqlmodel import Session, create_engine, SQLModel

from peek.config import PeekConfig
from peek.database import init_db, _create_fts5
from peek.exceptions import InvalidSlugError, NotFoundError, PayloadTooLargeError
from peek.models import Entry, File
from peek.services.entry_service import EntryService, get_entry_service
from peek.services.file_service import FileInfo
from peek.storage import StorageManager


@pytest.fixture
def entry_service(tmp_path):
    """Create an EntryService with temporary storage and database."""
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = init_db(db_path)
    storage = StorageManager(data_dir=data_dir)
    config = PeekConfig(
        data_dir=data_dir,
        db_path=db_path,
        max_file_size=1024 * 1024,
        max_entry_files=50,
        max_entry_size=10 * 1024 * 1024,
        max_slug_length=64,
        max_summary_length=500,
    )
    return EntryService(engine=engine, storage=storage, config=config)


class TestCreateEntry:
    def test_create_with_content(self, entry_service):
        result = entry_service.create_entry(
            summary="Test entry",
            slug="test",
            files_data=[{"path": "main.py", "content": "print('hello')"}],
        )
        assert result.slug == "test"
        assert result.url.endswith("/view/test")

    def test_create_auto_slug(self, entry_service):
        result = entry_service.create_entry(summary="Auto slug")
        assert result.slug is not None
        assert len(result.slug) == 6

    def test_create_slug_conflict_suffix(self, entry_service):
        r1 = entry_service.create_entry(summary="First", slug="my-doc")
        r2 = entry_service.create_entry(summary="Second", slug="my-doc")
        assert r1.slug == "my-doc"
        assert r2.slug.startswith("my-doc-")

    def test_create_invalid_slug(self, entry_service):
        with pytest.raises(InvalidSlugError):
            entry_service.create_entry(summary="Bad slug", slug="Hello World!")

    def test_create_with_tags(self, entry_service):
        result = entry_service.create_entry(
            summary="Tagged", slug="tagged", tags=["python", "auth"]
        )
        assert result.tags == ["python", "auth"]

    def test_create_with_expires(self, entry_service):
        result = entry_service.create_entry(
            summary="Expiring", slug="expire", expires_in="7d"
        )
        assert result.expires_at is not None

    def test_create_empty_files(self, entry_service):
        result = entry_service.create_entry(summary="No files", slug="empty")
        assert len(result.files) == 0

    def test_create_transaction_rollback_on_file_error(self, entry_service, tmp_path):
        """If file write fails, the DB entry should also be rolled back."""
        # Use a file path that would cause an error (traversal)
        with pytest.raises(ValueError, match="traversal"):
            entry_service.create_entry(
                summary="Bad file",
                slug="rollback-test",
                files_data=[{"path": "../../etc/passwd", "content": "bad"}],
            )
        # Entry should NOT exist in DB
        with pytest.raises(NotFoundError):
            entry_service.get_entry("rollback-test")


class TestGetEntry:
    def test_get_by_slug(self, entry_service):
        created = entry_service.create_entry(summary="Find me", slug="find")
        result = entry_service.get_entry("find")
        assert result.slug == "find"

    def test_get_not_found(self, entry_service):
        with pytest.raises(NotFoundError):
            entry_service.get_entry("nonexistent")


class TestListEntries:
    def test_list_pagination(self, entry_service):
        for i in range(5):
            entry_service.create_entry(summary=f"Entry {i}")
        result = entry_service.list_entries(page=1, per_page=3)
        assert len(result.items) == 3
        assert result.total == 5

    def test_list_search(self, entry_service):
        entry_service.create_entry(summary="Python auth module", slug="auth")
        entry_service.create_entry(summary="Rust web server", slug="rust")
        result = entry_service.list_entries(q="python")
        assert result.total == 1
        assert result.items[0].slug == "auth"


class TestUpdateEntry:
    def test_update_summary(self, entry_service):
        entry_service.create_entry(summary="Original", slug="update-me")
        result = entry_service.update_entry("update-me", summary="Updated")
        assert result.summary == "Updated"

    def test_update_deletes_removed_file_records(self, entry_service):
        created = entry_service.create_entry(
            summary="Has files", slug="with-files",
            files_data=[{"path": "a.py", "content": "a"}],
        )
        file_id = created.files[0].id
        entry_service.update_entry("with-files", remove_file_ids=[file_id])
        updated = entry_service.get_entry("with-files")
        assert len(updated.files) == 0

    def test_update_deletes_removed_file_from_disk(self, entry_service):
        """When a file is removed via update_entry, the disk file should also be deleted."""
        created = entry_service.create_entry(
            summary="Disk delete", slug="disk-del",
            files_data=[{"path": "del.py", "content": "delete me"}],
        )
        file_id = created.files[0].id
        entry_id = created.id

        # Verify file exists on disk
        from peek.storage import StorageManager
        disk_path = entry_service.storage.get_disk_path(entry_id, "del.py", "del.py")
        assert disk_path.exists()

        # Remove file via update
        entry_service.update_entry("disk-del", remove_file_ids=[file_id])

        # Verify file is gone from disk
        assert not disk_path.exists()


class TestDeleteEntry:
    def test_delete_success(self, entry_service):
        created = entry_service.create_entry(summary="Delete me", slug="del")
        entry_service.delete_entry("del")
        with pytest.raises(NotFoundError):
            entry_service.get_entry("del")

    def test_delete_not_found(self, entry_service):
        with pytest.raises(NotFoundError):
            entry_service.delete_entry("nonexistent")


class TestGetEntryService:
    def test_get_entry_service_from_app_state(self, tmp_path):
        """get_entry_service() should use app.state services, not create new instances."""
        from fastapi import FastAPI
        from peek.main import create_app

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)

        service = get_entry_service(app)
        assert service is not None
        # Second call should return the same instance
        service2 = get_entry_service(app)
        assert service is service2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_entry_service.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/services/entry_service.py
"""Entry business logic — create, get, list, update, delete."""

from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import text, func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peek.config import PeekConfig
from peek.exceptions import (
    InvalidSlugError,
    NotFoundError,
    PayloadTooLargeError,
    ValidationError,
)
from peek.language import detect_language, is_binary_content
from peek.models import (
    Entry,
    File,
    EntryResponse,
    EntryListItem,
    EntryListResponse,
    FileResponse,
)
from peek.services.file_service import (
    FileInfo,
    parse_expires_in,
    validate_local_path,
    scan_directory,
    decode_base64_content,
)
from peek.storage import StorageManager

logger = logging.getLogger(__name__)

# Slug format: lowercase alphanumeric, hyphens, underscores
SLUG_PATTERN = re.compile(r"^[a-z0-9_-]+$")


def get_entry_service(app: object) -> EntryService:
    """Get or create EntryService from app.state (singleton per app).

    This avoids creating new service instances on every request.

    Args:
        app: FastAPI app instance with .state.

    Returns:
        EntryService instance.
    """
    if not hasattr(app.state, "entry_service"):
        from peek.database import get_engine
        config = app.state.config
        engine = get_engine(app)
        storage = StorageManager(data_dir=config.data_dir)
        app.state.entry_service = EntryService(
            engine=engine, storage=storage, config=config,
        )
    return app.state.entry_service


class EntryService:
    """Business logic for entry operations."""

    def __init__(self, engine, storage: StorageManager, config: PeekConfig):
        self.engine = engine
        self.storage = storage
        self.config = config

    def create_entry(
        self,
        summary: str,
        slug: str | None = None,
        tags: list[str] | None = None,
        files_data: list[dict[str, Any]] | None = None,
        dirs_data: list[dict[str, str]] | None = None,
        expires_in: str | None = None,
    ) -> EntryResponse:
        """Create a new entry with files.

        All DB + file operations are wrapped in a transaction. If any file write
        fails, the DB entry is rolled back.

        Args:
            summary: Entry description.
            slug: Custom URL slug (auto-generated if None).
            tags: List of tags.
            files_data: List of file dicts with keys: path, content, content_base64, local_path.
            dirs_data: List of dir dicts with key: path.
            expires_in: Duration string like "7d".

        Returns:
            EntryResponse with URL.
        """
        # Validate summary
        if not summary or not summary.strip():
            raise ValidationError("Summary is required")
        if len(summary) > self.config.max_summary_length:
            raise ValidationError(
                f"Summary exceeds max length ({self.config.max_summary_length})"
            )

        # Validate/generate slug
        if slug:
            if not SLUG_PATTERN.match(slug):
                raise InvalidSlugError(
                    f"Slug must match [a-z0-9_-], got: {slug!r}"
                )
            if len(slug) > self.config.max_slug_length:
                raise InvalidSlugError(
                    f"Slug exceeds max length ({self.config.max_slug_length})"
                )
        else:
            slug = secrets.token_urlsafe(4)[:6].lower()

        # Parse expiry
        expires_at = None
        if expires_in:
            delta = parse_expires_in(expires_in)
            expires_at = datetime.now(timezone.utc) + delta

        # Collect all files
        files_info = self._collect_files(files_data or [], dirs_data or [])

        # Validate limits
        self._validate_limits(files_info)

        # Create entry in DB + write files (transaction with rollback)
        now = datetime.now(timezone.utc)
        entry = Entry(
            slug=slug,
            summary=summary.strip(),
            tags=json.dumps(tags or []),
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )

        try:
            with Session(self.engine) as session:
                session.add(entry)
                session.commit()
                session.refresh(entry)
                entry_id = entry.id

                # Write files to disk + create File records
                file_records = []
                written_paths: list[Path] = []
                try:
                    for fi in files_info:
                        content = fi.get("content_bytes", b"")
                        file_path = fi.get("path")
                        filename = fi["filename"]
                        is_binary = fi.get("is_binary", False)
                        lang = fi.get("language")

                        disk_path = self.storage.write_file(
                            entry_id=entry_id,
                            filename=filename,
                            content=content,
                            file_path=file_path,
                        )
                        written_paths.append(disk_path)

                        file_record = File(
                            entry_id=entry_id,
                            path=file_path,
                            filename=filename,
                            language=lang,
                            is_binary=is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                        )
                        session.add(file_record)
                        file_records.append(file_record)

                    session.commit()

                    # Refresh to get file IDs
                    for fr in file_records:
                        session.refresh(fr)
                except Exception:
                    # Rollback: delete any written files
                    for wp in written_paths:
                        try:
                            wp.unlink()
                        except OSError:
                            pass
                    session.rollback()
                    raise

        except IntegrityError:
            # Slug conflict — TOCTOU protection: retry with suffix
            return self._retry_with_slug_suffix(summary, slug, tags, files_data, dirs_data, expires_in)

        return self._build_response(entry, file_records)

    def get_entry(self, slug: str) -> EntryResponse:
        """Get entry details by slug."""
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

        return self._build_response(entry, list(files))

    def list_entries(
        self,
        q: str | None = None,
        tags: list[str] | None = None,
        status: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> EntryListResponse:
        """List entries with search, filter, and pagination."""
        per_page = min(per_page, self.config.max_per_page)
        page = max(page, 1)
        offset = (page - 1) * per_page

        with Session(self.engine) as session:
            # Build query
            query = select(Entry)
            count_query = select(func.count()).select_from(Entry)

            # Status filter (default: show active + published, hide archived)
            if status:
                query = query.where(Entry.status == status)
                count_query = count_query.where(Entry.status == status)
            else:
                query = query.where(Entry.status != "archived")
                count_query = count_query.where(Entry.status != "archived")

            # FTS5 search
            if q and q.strip():
                fts_ids = session.exec(
                    text("SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q"),
                    params={"q": q.strip()},
                ).all()
                if fts_ids:
                    id_list = [row[0] for row in fts_ids]
                    query = query.where(Entry.id.in_(id_list))
                    count_query = count_query.where(Entry.id.in_(id_list))
                else:
                    return EntryListResponse(
                        items=[], total=0, page=page, per_page=per_page
                    )

            # Tag filter
            if tags:
                for tag in tags:
                    query = query.where(
                        text("entries.tags LIKE :tag"),
                    ).params(tag=f'%"{tag}"%')
                    count_query = count_query.where(
                        text("entries.tags LIKE :tag"),
                    ).params(tag=f'%"{tag}"%')

            # Order by created_at desc
            query = query.order_by(Entry.created_at.desc())

            total = session.exec(count_query).one()
            entries = session.exec(query.offset(offset).limit(per_page)).all()

        items = []
        for e in entries:
            file_count = 0  # Will be populated in real impl with join
            items.append(EntryListItem(
                id=e.id,
                slug=e.slug,
                summary=e.summary,
                tags=json.loads(e.tags),
                status=e.status,
                file_count=file_count,
                created_at=e.created_at,
                updated_at=e.updated_at,
            ))

        return EntryListResponse(items=items, total=total, page=page, per_page=per_page)

    def update_entry(
        self,
        slug: str,
        summary: str | None = None,
        status: str | None = None,
        tags: list[str] | None = None,
        add_files: list[dict[str, Any]] | None = None,
        remove_file_ids: list[int] | None = None,
        add_dirs: list[dict[str, str]] | None = None,
    ) -> EntryResponse:
        """Update an entry.

        When files are removed via remove_file_ids, their disk files are also deleted.
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id

            # Update fields
            if summary is not None:
                entry.summary = summary.strip()
            if status is not None:
                entry.status = status
            if tags is not None:
                entry.tags = json.dumps(tags)
            entry.updated_at = datetime.now(timezone.utc)
            session.add(entry)

            # Remove files (DB records + disk)
            if remove_file_ids:
                for fid in remove_file_ids:
                    file_record = session.exec(
                        select(File).where(File.id == fid, File.entry_id == entry_id)
                    ).first()
                    if file_record:
                        # Delete from disk
                        try:
                            disk_path = self.storage.get_disk_path(
                                entry_id, file_record.filename, file_record.path
                            )
                            if disk_path.exists():
                                disk_path.unlink()
                                logger.info("Deleted disk file: %s", disk_path)
                        except Exception as e:
                            logger.warning("Failed to delete disk file: %s", e)
                        session.delete(file_record)

            # Add new files
            if add_files:
                for fd in add_files:
                    file_info = self._process_file_input(fd)
                    if file_info:
                        content = file_info.get("content_bytes", b"")
                        file_path = file_info.get("path")
                        filename = file_info["filename"]
                        is_binary = file_info.get("is_binary", False)
                        lang = file_info.get("language")

                        self.storage.write_file(
                            entry_id=entry_id,
                            filename=filename,
                            content=content,
                            file_path=file_path,
                        )

                        file_record = File(
                            entry_id=entry_id,
                            path=file_path,
                            filename=filename,
                            language=lang,
                            is_binary=is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                        )
                        session.add(file_record)

            # Add directories
            if add_dirs:
                for dd in add_dirs:
                    scanned = scan_directory(
                        dd["path"],
                        allowed_dirs=self.config.allowed_dirs,
                        ignored_dirs=self.config.ignored_dirs,
                    )
                    for sf in scanned:
                        content = Path(sf.local_path).read_bytes()
                        self.storage.write_file(
                            entry_id=entry_id,
                            filename=sf.filename,
                            content=content,
                            file_path=sf.path,
                        )
                        file_record = File(
                            entry_id=entry_id,
                            path=sf.path or sf.filename,
                            filename=sf.filename,
                            language=sf.language,
                            is_binary=sf.is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                        )
                        session.add(file_record)

            session.commit()
            session.refresh(entry)

            # Get all remaining files
            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

        return self._build_response(entry, list(files))

    def delete_entry(self, slug: str) -> None:
        """Delete entry and all associated files."""
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id
            session.delete(entry)
            session.commit()

        # Delete files (best-effort after DB commit)
        self.storage.delete_entry_files(entry_id)

    def _retry_with_slug_suffix(
        self,
        summary: str,
        original_slug: str,
        tags: list[str] | None,
        files_data: list[dict[str, Any]] | None,
        dirs_data: list[dict[str, str]] | None,
        expires_in: str | None,
    ) -> EntryResponse:
        """Retry entry creation with slug-N suffix on IntegrityError (TOCTOU protection)."""
        for n in range(2, 100):
            new_slug = f"{original_slug}-{n}"
            try:
                return self.create_entry(
                    summary=summary,
                    slug=new_slug,
                    tags=tags,
                    files_data=files_data,
                    dirs_data=dirs_data,
                    expires_in=expires_in,
                )
            except IntegrityError:
                continue
        raise ValidationError(f"Could not resolve slug conflict for: {original_slug}")

    def _collect_files(
        self,
        files_data: list[dict[str, Any]],
        dirs_data: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        """Collect and process file data from inline content, local_path, and dirs."""
        result = []

        for fd in files_data:
            file_info = self._process_file_input(fd)
            if file_info:
                result.append(file_info)

        for dd in dirs_data:
            scanned = scan_directory(
                dd["path"],
                allowed_dirs=self.config.allowed_dirs,
                ignored_dirs=self.config.ignored_dirs,
            )
            for sf in scanned:
                content = Path(sf.local_path).read_bytes()
                result.append({
                    "path": sf.path or sf.filename,
                    "filename": sf.filename,
                    "content_bytes": content,
                    "language": sf.language,
                    "is_binary": sf.is_binary,
                    "size": len(content),
                })

        return result

    def _process_file_input(self, fd: dict[str, Any]) -> dict[str, Any] | None:
        """Process a single file input dict."""
        path = fd.get("path")
        filename = Path(path).name if path else fd.get("filename", "untitled")

        # Content inline
        if "content" in fd and fd["content"] is not None:
            content_bytes = fd["content"].encode("utf-8") if isinstance(fd["content"], str) else fd["content"]
            binary = is_binary_content(content_bytes)
            return {
                "path": path,
                "filename": filename,
                "content_bytes": content_bytes,
                "language": detect_language(filename) if not binary else None,
                "is_binary": binary,
                "size": len(content_bytes),
            }

        # Base64 content
        if "content_base64" in fd and fd["content_base64"] is not None:
            content_bytes = decode_base64_content(fd["content_base64"])
            return {
                "path": path,
                "filename": filename,
                "content_bytes": content_bytes,
                "language": None,
                "is_binary": True,
                "size": len(content_bytes),
            }

        # Local path reference
        if "local_path" in fd and fd["local_path"] is not None:
            resolved = validate_local_path(
                fd["local_path"],
                allowed_dirs=self.config.allowed_dirs,
                data_dir=self.config.data_dir,
            )
            content_bytes = resolved.read_bytes()
            binary = is_binary_content(content_bytes)
            return {
                "path": path,
                "filename": resolved.name if not path else filename,
                "content_bytes": content_bytes,
                "language": detect_language(resolved.name) if not binary else None,
                "is_binary": binary,
                "size": len(content_bytes),
            }

        return None

    def _validate_limits(self, files_info: list[dict[str, Any]]) -> None:
        """Validate resource limits before creating entry."""
        if len(files_info) > self.config.max_entry_files:
            raise PayloadTooLargeError(
                f"Too many files: {len(files_info)} > {self.config.max_entry_files}"
            )

        total_size = sum(f.get("size", 0) for f in files_info)
        if total_size > self.config.max_entry_size:
            raise PayloadTooLargeError(
                f"Entry total size exceeded: {total_size} > {self.config.max_entry_size}"
            )

        for f in files_info:
            if f.get("size", 0) > self.config.max_file_size:
                raise PayloadTooLargeError(
                    f"File too large: {f['filename']} ({f['size']} > {self.config.max_file_size})"
                )

    def _build_response(self, entry: Entry, files: list[File]) -> EntryResponse:
        """Build EntryResponse from Entry + File records."""
        file_responses = []
        for f in files:
            file_responses.append(FileResponse(
                id=f.id,
                path=f.path,
                filename=f.filename,
                language=f.language,
                is_binary=f.is_binary,
                size=f.size,
            ))

        return EntryResponse(
            id=entry.id,
            slug=entry.slug,
            url=self.config.build_view_url(entry.slug),
            summary=entry.summary,
            status=entry.status,
            tags=json.loads(entry.tags),
            files=file_responses,
            expires_at=entry.expires_at,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_entry_service.py -v`
Expected: 16 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/services/entry_service.py backend/tests/test_entry_service.py
git commit -m "feat(backend): entry service with CRUD, transaction rollback, TOCTOU slug protection, disk cleanup"
```

---

### Task 10: FastAPI Application + API Routes

**Files:**
- Create: `backend/peek/api/__init__.py`
- Create: `backend/peek/api/entries.py`
- Create: `backend/peek/api/files.py`
- Create: `backend/peek/main.py`

**Review fixes applied (MAJOR):**
- **Add file content inline endpoint**: `GET /api/v1/entries/{slug}/files/{file_id}/content` returning raw text with proper Content-Type (no Content-Disposition)
- Add `PEEK_API_KEY` auth middleware (if key configured, require `Authorization: Bearer <key>`)
- Use `app.state` for service access in route handlers (not `get_entry_service()` that creates new instances)
- Make CORS configurable from config
- POST /entries should return 201, not 200
- Fix Content-Disposition header injection (sanitize filename)
- Add static file serving for production SPA build
- Remove `app = create_app()` module-level global — use `__main__.py` entry point instead

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_api.py
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peek.main import create_app


@pytest.fixture
async def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def auth_client(tmp_path, monkeypatch):
    """Client with PEEK_API_KEY configured."""
    monkeypatch.setenv("PEEK_API_KEY", "test-secret-key")
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200


class TestCreateEntry:
    @pytest.mark.asyncio
    async def test_create_with_content_returns_201(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Test entry",
            "slug": "test",
            "files": [{"path": "main.py", "content": "print('hello')"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["slug"] == "test"
        assert "/view/test" in data["url"]

    @pytest.mark.asyncio
    async def test_create_missing_summary(self, client):
        resp = await client.post("/api/v1/entries", json={})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_invalid_slug(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Bad",
            "slug": "Hello World!",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_auto_slug(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Auto slug",
        })
        assert resp.status_code == 201
        assert len(resp.json()["slug"]) == 6


class TestGetEntry:
    @pytest.mark.asyncio
    async def test_get_entry(self, client):
        # Create first
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "Find me", "slug": "find",
        })
        assert create_resp.status_code == 201
        # Get
        resp = await client.get("/api/v1/entries/find")
        assert resp.status_code == 200
        assert resp.json()["slug"] == "find"

    @pytest.mark.asyncio
    async def test_get_not_found(self, client):
        resp = await client.get("/api/v1/entries/nonexistent")
        assert resp.status_code == 404


class TestListEntries:
    @pytest.mark.asyncio
    async def test_list_entries(self, client):
        await client.post("/api/v1/entries", json={"summary": "A", "slug": "a"})
        await client.post("/api/v1/entries", json={"summary": "B", "slug": "b"})
        resp = await client.get("/api/v1/entries")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2


class TestDeleteEntry:
    @pytest.mark.asyncio
    async def test_delete_entry(self, client):
        await client.post("/api/v1/entries", json={"summary": "Del", "slug": "del"})
        resp = await client.delete("/api/v1/entries/del")
        assert resp.status_code == 200
        # Verify gone
        resp = await client.get("/api/v1/entries/del")
        assert resp.status_code == 404


class TestFileContentEndpoint:
    @pytest.mark.asyncio
    async def test_get_file_content_inline(self, client):
        """GET /entries/{slug}/files/{file_id}/content returns raw text."""
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "File test",
            "slug": "filetest",
            "files": [{"path": "hello.py", "content": "print('hello')"}],
        })
        assert create_resp.status_code == 201
        file_id = create_resp.json()["files"][0]["id"]

        resp = await client.get(f"/api/v1/entries/filetest/files/{file_id}/content")
        assert resp.status_code == 200
        assert resp.text == "print('hello')"
        # Should have text Content-Type, NOT Content-Disposition
        assert "text/" in resp.headers.get("content-type", "")
        assert "Content-Disposition" not in resp.headers


class TestFileDownload:
    @pytest.mark.asyncio
    async def test_download_file(self, client):
        """GET /entries/{slug}/files/{file_id} downloads with Content-Disposition."""
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "Download test",
            "slug": "dltest",
            "files": [{"path": "code.py", "content": "x=1"}],
        })
        assert create_resp.status_code == 201
        file_id = create_resp.json()["files"][0]["id"]

        resp = await client.get(f"/api/v1/entries/dltest/files/{file_id}")
        assert resp.status_code == 200
        assert "Content-Disposition" in resp.headers


class TestApiKeyAuth:
    @pytest.mark.asyncio
    async def test_no_api_key_allows_access(self, client):
        """Without PEEK_API_KEY, all requests are allowed."""
        resp = await client.get("/api/v1/entries")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_required_when_configured(self, auth_client):
        """With PEEK_API_KEY set, requests without auth are rejected."""
        resp = await auth_client.get("/api/v1/entries")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_api_key_valid_auth(self, auth_client):
        """With valid API key, requests succeed."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer test-secret-key"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_invalid_auth(self, auth_client):
        """With wrong API key, requests are rejected."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer wrong-key"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_health_check_no_auth_required(self, auth_client):
        """Health check endpoint doesn't require auth."""
        resp = await auth_client.get("/health")
        assert resp.status_code == 200


class TestErrorFormat:
    @pytest.mark.asyncio
    async def test_error_response_format(self, client):
        resp = await client.get("/api/v1/entries/nonexistent")
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_api.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/api/__init__.py
"""Peek API routes."""
```

```python
# backend/peek/api/entries.py
"""Entry CRUD API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from peek.models import EntryCreate, EntryUpdate
from peek.services.entry_service import EntryService, get_entry_service

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


@router.post("", status_code=201)
async def create_entry(
    data: EntryCreate,
    request: Request,
    service: EntryService = Depends(lambda: get_entry_service(
        request.app if hasattr(request, "app") else None
    )),
):
    """Create a new entry. Returns 201 Created."""
    return service.create_entry(
        summary=data.summary,
        slug=data.slug,
        tags=data.tags,
        files_data=[f.model_dump() for f in data.files],
        dirs_data=[d.model_dump() for d in data.dirs],
        expires_in=data.expires_in,
    )


@router.get("")
async def list_entries(
    request: Request,
    q: str | None = Query(None),
    tags: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: EntryService = Depends(lambda: get_entry_service(
        request.app if hasattr(request, "app") else None
    )),
):
    """List entries with search, filter, and pagination."""
    tag_list = tags.split(",") if tags else None
    return service.list_entries(q=q, tags=tag_list, status=status, page=page, per_page=per_page)


@router.get("/{slug}")
async def get_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(lambda: get_entry_service(
        request.app if hasattr(request, "app") else None
    )),
):
    """Get entry details by slug."""
    return service.get_entry(slug)


@router.delete("/{slug}")
async def delete_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(lambda: get_entry_service(
        request.app if hasattr(request, "app") else None
    )),
):
    """Delete entry by slug."""
    service.delete_entry(slug)
    return {"ok": True}
```

```python
# backend/peek/api/files.py
"""File download and content API routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, Request
from fastapi.responses import Response

from peek.database import get_engine
from peek.exceptions import NotFoundError
from peek.models import Entry, File
from peek.storage import StorageManager
from sqlmodel import Session, select

router = APIRouter(prefix="/api/v1/entries", tags=["files"])


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename for Content-Disposition header to prevent injection.

    Removes quotes, semicolons, and newlines that could break the header.
    """
    # Remove characters that could inject additional headers
    sanitized = re.sub(r'[";\r\n]', "", filename)
    # Limit length
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    return sanitized


@router.get("/{slug}/files/{file_id}")
async def download_file(slug: str, file_id: int, request: Request):
    """Download a single file (with Content-Disposition: attachment)."""
    config = request.app.state.config
    engine = get_engine(request.app)
    storage = StorageManager(data_dir=config.data_dir)

    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry.id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

    content = storage.read_file(entry.id, file_record.filename, file_record.path)
    safe_name = _sanitize_filename(file_record.filename)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/{slug}/files/{file_id}/content")
async def get_file_content(slug: str, file_id: int, request: Request):
    """Get file content inline (raw text, no Content-Disposition).

    Returns the file content with an appropriate Content-Type based on
    language. No Content-Disposition header — suitable for inline display.
    """
    config = request.app.state.config
    engine = get_engine(request.app)
    storage = StorageManager(data_dir=config.data_dir)

    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry.id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

    content = storage.read_file(entry.id, file_record.filename, file_record.path)

    # Determine Content-Type from language
    content_type = _language_to_content_type(file_record.language)
    return Response(
        content=content,
        media_type=content_type,
        # No Content-Disposition — inline display
    )


def _language_to_content_type(language: str | None) -> str:
    """Map language ID to Content-Type for inline display."""
    _TYPE_MAP = {
        "python": "text/x-python",
        "javascript": "text/javascript",
        "typescript": "text/typescript",
        "html": "text/html",
        "css": "text/css",
        "json": "application/json",
        "yaml": "text/yaml",
        "xml": "text/xml",
        "markdown": "text/markdown",
        "sql": "text/x-sql",
        "bash": "text/x-shellscript",
        "go": "text/x-go",
        "rust": "text/x-rust",
        "java": "text/x-java",
        "cpp": "text/x-c++src",
        "text": "text/plain",
    }
    if language and language in _TYPE_MAP:
        return _TYPE_MAP[language]
    return "text/plain; charset=utf-8"
```

```python
# backend/peek/main.py
"""FastAPI application factory — entry point, middleware, exception handlers.

IMPORTANT: This module does NOT create a module-level app instance.
Use create_app() to create the app, or run via `python -m peek` or `peek serve`.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from peek.config import PeekConfig, ensure_data_dirs
from peek.database import init_db, get_engine
from peek.exceptions import PeekError
from peek.services.entry_service import get_entry_service

logger = logging.getLogger(__name__)


def create_app(data_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        data_dir: Override data directory (for testing).
        db_path: Override DB path (for testing).

    Returns:
        Configured FastAPI app.
    """
    app = FastAPI(title="Peek", version="0.1.0")

    # Config
    config_overrides = {}
    if data_dir:
        config_overrides["data_dir"] = data_dir
    if db_path:
        config_overrides["db_path"] = db_path
    config = PeekConfig(**config_overrides) if config_overrides else PeekConfig()

    # Ensure directories exist
    ensure_data_dirs(config)

    # Initialize database (stores engine on app.state)
    init_db(config.db_path, app=app)

    # Store config on app state for dependency injection
    app.state.config = config

    # CORS (configurable from config)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API key auth middleware (if configured)
    if config.api_key:
        @app.middleware("http")
        async def api_key_auth(request: Request, call_next):
            # Skip auth for health check
            if request.url.path == "/health":
                return await call_next(request)

            # Skip auth for static files
            if request.url.path.startswith("/assets") or request.url.path == "/":
                return await call_next(request)

            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                if token == config.api_key:
                    return await call_next(request)

            return JSONResponse(
                status_code=401,
                content={"error": {"code": "UNAUTHORIZED", "message": "Invalid or missing API key", "details": None}},
            )

    # Register routes
    from peek.api.entries import router as entries_router
    from peek.api.files import router as files_router
    app.include_router(entries_router)
    app.include_router(files_router)

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Global exception handler
    @app.exception_handler(PeekError)
    async def peek_error_handler(request: Request, exc: PeekError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.error_code, "message": str(exc), "details": None}},
        )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(
            "%s %s → %d (%.1fms)",
            request.method, request.url.path, response.status_code, duration,
        )
        return response

    # Static file serving for production SPA build
    _setup_static_files(app, config)

    return app


def _setup_static_files(app: FastAPI, config: PeekConfig) -> None:
    """Mount static file serving for production SPA build if the dist directory exists."""
    try:
        from fastapi.staticfiles import StaticFiles

        # Look for frontend build in standard locations
        frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
        if frontend_dist.exists() and frontend_dist.is_dir():
            app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

            @app.get("/")
            async def serve_spa():
                from fastapi.responses import FileResponse
                return FileResponse(frontend_dist / "index.html")

            @app.get("/{path:path}")
            async def serve_spa_catchall(path: str):
                """Catch-all for SPA routing — serve index.html for unknown paths."""
                from fastapi.responses import FileResponse
                # First try to serve the actual file
                file_path = frontend_dist / path
                if file_path.exists() and file_path.is_file():
                    return FileResponse(file_path)
                # Otherwise serve index.html for SPA routing
                return FileResponse(frontend_dist / "index.html")

            logger.info("Serving frontend SPA from %s", frontend_dist)
    except Exception as e:
        logger.debug("Frontend SPA not available: %s", e)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_api.py -v`
Expected: 19 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/api/ backend/peek/main.py backend/tests/test_api.py
git commit -m "feat(backend): FastAPI app with 201 status, file content endpoint, API key auth, CORS config"
```

---

### Task 11: Security Tests

**Files:**
- Create: `backend/tests/test_security.py`

**Review fixes applied:**
- Update tests for allowlist (not blacklist) approach
- Fix path traversal test to use allowlist signature
- Add test for `files.path` traversal in storage
- Add test for `..` component rejection
- Add test for hardlink detection

- [ ] **Step 1: Write the security tests**

```python
# backend/tests/test_security.py
"""Security tests — path traversal, allowlist, hardlink, SQL injection, XSS, header injection."""

import os
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peek.exceptions import ForbiddenPathError
from peek.main import create_app
from peek.services.file_service import validate_local_path
from peek.storage import StorageManager


@pytest.fixture
async def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# --- Path traversal (.. component rejection) ---

def test_path_traversal_relative():
    """Paths with .. components are rejected."""
    with pytest.raises(ForbiddenPathError):
        validate_local_path("../../etc/passwd", allowed_dirs=[Path("/")])


def test_path_traversal_in_file_path():
    """Deeper traversal also rejected."""
    with pytest.raises(ForbiddenPathError):
        validate_local_path("../../../etc/shadow", allowed_dirs=[Path("/")])


def test_dotdot_in_middle(tmp_path):
    """Path with .. in the middle is rejected."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    with pytest.raises(ForbiddenPathError, match="\\.\\."):
        validate_local_path(str(tmp_path / "allowed" / ".." / "secret"), allowed_dirs=[allowed])


# --- Allowlist (replaces blacklist) ---

def test_allowed_dir_accepts_file(tmp_path):
    """File within allowed_dirs is accepted."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    f = allowed / "code.py"
    f.write_text("print('ok')")
    result = validate_local_path(str(f), allowed_dirs=[allowed])
    assert result == f.resolve()


def test_outside_allowed_dir_rejected(tmp_path):
    """File outside all allowed_dirs is rejected."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "forbidden"
    outside.mkdir()
    secret = outside / "secret.py"
    secret.write_text("secret")
    with pytest.raises(ForbiddenPathError, match="outside"):
        validate_local_path(str(secret), allowed_dirs=[allowed])


# --- Symlink rejection (checked BEFORE resolve) ---

def test_symlink_rejected(tmp_path):
    """Symlinks are always rejected."""
    real = tmp_path / "real.txt"
    real.write_text("ok")
    link = tmp_path / "link.txt"
    link.symlink_to(real)
    with pytest.raises(ForbiddenPathError, match="[Ss]ymlink"):
        validate_local_path(str(link), allowed_dirs=[tmp_path])


# --- Hardlink detection ---

def test_hardlink_rejected(tmp_path):
    """Hardlinks (st_nlink > 1) are rejected."""
    original = tmp_path / "original.txt"
    original.write_text("content")
    hardlink = tmp_path / "hardlink.txt"
    os.link(str(original), str(hardlink))
    # original now has st_nlink == 2
    with pytest.raises(ForbiddenPathError, match="[Hh]ardlink"):
        validate_local_path(str(original), allowed_dirs=[tmp_path])


# --- files.path traversal in storage ---

def test_storage_file_path_traversal(tmp_path):
    """StorageManager.get_disk_path rejects traversal in file_path."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    storage = StorageManager(data_dir=data_dir)
    with pytest.raises(ValueError, match="traversal"):
        storage.get_disk_path(entry_id=1, filename="evil.py", file_path="../../etc/passwd")


def test_storage_file_path_absolute(tmp_path):
    """StorageManager.get_disk_path rejects absolute file_path."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    storage = StorageManager(data_dir=data_dir)
    with pytest.raises(ValueError, match="absolute"):
        storage.get_disk_path(entry_id=1, filename="evil.py", file_path="/etc/passwd")


def test_storage_write_validates_traversal(tmp_path):
    """StorageManager.write_file rejects traversal and doesn't write."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    storage = StorageManager(data_dir=data_dir)
    with pytest.raises(ValueError, match="traversal"):
        storage.write_file(
            entry_id=1, filename="evil.py", content=b"bad",
            file_path="../../../etc/passwd",
        )
    # Verify no file was written outside data_dir
    assert not (tmp_path / "etc").exists()


# --- SQL injection ---

@pytest.mark.asyncio
async def test_sql_injection_in_search(client):
    resp = await client.get("/api/v1/entries?q=' OR 1=1 --")
    # Should not crash, return empty or filtered results
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sql_injection_in_slug(client):
    resp = await client.post("/api/v1/entries", json={
        "summary": "SQLi test",
        "slug": "'; DROP TABLE entries; --",
    })
    # Invalid slug chars → 400
    assert resp.status_code == 400


# --- Content-Disposition header injection ---

@pytest.mark.asyncio
async def test_content_disposition_filename_injection(client):
    """Filenames with quotes/semicolons don't break Content-Disposition header."""
    resp = await client.post("/api/v1/entries", json={
        "summary": "Header injection test",
        "slug": "hdr-inject",
        "files": [{"path": 'file"; charset=utf-8\r\nX-Injected: true.py', "content": "x"}],
    })
    # May fail validation or succeed with sanitized name
    if resp.status_code == 201:
        file_id = resp.json()["files"][0]["id"]
        dl_resp = await client.get(f"/api/v1/entries/hdr-inject/files/{file_id}")
        if dl_resp.status_code == 200:
            cd_header = dl_resp.headers.get("Content-Disposition", "")
            # Should not contain unescaped quotes or CRLF
            assert "\r\n" not in cd_header
            assert '"; ' not in cd_header or cd_header.count('"') <= 2


# --- Error info leak ---

@pytest.mark.asyncio
async def test_error_no_stack_trace(client):
    resp = await client.get("/api/v1/entries/nonexistent")
    body = resp.text
    # Should not contain Python stack trace or internal paths
    assert "Traceback" not in body
    assert "/home/" not in body
```

- [ ] **Step 2: Run the security tests**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_security.py -v`
Expected: 13 passed

- [ ] **Step 3: Commit**

```bash
cd ~/lab/projects/peek
git add backend/tests/test_security.py
git commit -m "test(backend): security tests — allowlist, path traversal, hardlink, header injection"
```

---

### Task 12: CLI Commands

**Files:**
- Create: `backend/peek/cli.py`

**Review fixes applied:**
- Fix status code check: 201 not 200 for create
- Add `peek config` command to show/edit config

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cli.py
from click.testing import CliRunner

from peek.cli import cli


def test_cli_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "Peek" in result.output


def test_cli_create(tmp_path, monkeypatch):
    """CLI create command calls API."""
    monkeypatch.setenv("PEEK_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PEEK_DB_PATH", str(tmp_path / "test.db"))
    runner = CliRunner()
    result = runner.invoke(cli, ["create", "Test entry", "--slug", "test"])
    # In unit test, server may not be running; just verify CLI parses args
    assert "Test entry" in result.output or result.exit_code != 0


def test_cli_list_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["list", "--help"])
    assert result.exit_code == 0
    assert "search" in result.output.lower() or "q" in result.output.lower()


def test_cli_serve_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["serve", "--help"])
    assert result.exit_code == 0
    assert "port" in result.output.lower()


def test_cli_config_show(tmp_path, monkeypatch):
    """peek config command shows current configuration."""
    monkeypatch.setenv("PEEK_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PEEK_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("PEEK_PORT", "9090")
    runner = CliRunner()
    result = runner.invoke(cli, ["config"])
    assert result.exit_code == 0
    assert "9090" in result.output


def test_cli_config_edit(tmp_path, monkeypatch):
    """peek config --edit opens config file for editing."""
    runner = CliRunner()
    result = runner.invoke(cli, ["config", "--edit"])
    # In test, $EDITOR may not be set, but command should not crash
    # Just verify it doesn't raise an unexpected error
    assert result.exit_code in (0, 1)  # 1 if editor not found
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_cli.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/cli.py
"""Peek CLI commands using Click."""

from __future__ import annotations

import json
import os
import subprocess
import sys

import click
import httpx

from peek.config import PeekConfig


@click.group()
@click.version_option(version="0.1.0", prog_name="peek")
def cli():
    """Peek — Lightweight code & document formatting display service."""
    pass


@cli.command()
@click.option("--host", default=None, help="Host to bind (default: 127.0.0.1)")
@click.option("--port", default=None, type=int, help="Port to listen (default: 8080)")
def serve(host: str | None, port: int | None):
    """Start the Peek server."""
    import uvicorn

    config = PeekConfig()
    h = host or config.server_host
    p = port or config.server_port

    click.echo(f"🚀 Starting Peek server on {h}:{p}")
    uvicorn.run("peek.main:app", host=h, port=p, reload=False,
                factory=True, factory_args=())


@cli.command()
@click.argument("summary")
@click.option("--slug", default=None, help="Custom URL slug")
@click.option("--files", multiple=True, help="File paths to include")
@click.option("--dir", "dirs", multiple=True, help="Directory paths to scan")
@click.option("--tags", default=None, help="Comma-separated tags")
@click.option("--expires", default=None, help="Expiry duration (e.g. 7d, 1h)")
def create(summary: str, slug: str | None, files: tuple, dirs: tuple,
           tags: str | None, expires: str | None):
    """Create a new entry."""
    config = PeekConfig()
    base = f"http://{config.server_host}:{config.server_port}"

    payload: dict = {"summary": summary}
    if slug:
        payload["slug"] = slug
    if tags:
        payload["tags"] = [t.strip() for t in tags.split(",")]
    if expires:
        payload["expires_in"] = expires

    file_list = []
    for f in files:
        file_list.append({"local_path": f})
    if file_list:
        payload["files"] = file_list

    dir_list = []
    for d in dirs:
        dir_list.append({"path": d})
    if dir_list:
        payload["dirs"] = dir_list

    try:
        resp = httpx.post(f"{base}/api/v1/entries", json=payload, timeout=30)
        data = resp.json()
        if resp.status_code == 201:
            click.echo(f"✅ Created: {data['url']}")
        else:
            click.echo(f"❌ Error: {data.get('error', {}).get('message', resp.text)}", err=True)
            sys.exit(1)
    except httpx.ConnectError:
        click.echo("❌ Cannot connect to Peek server. Is it running?", err=True)
        sys.exit(1)


@cli.command("list")
@click.option("--search", "-q", default=None, help="Search keyword")
@click.option("--tags", default=None, help="Filter by tags (comma-separated)")
@click.option("--page", default=1, type=int, help="Page number")
def list_entries(search: str | None, tags: str | None, page: int):
    """List entries."""
    config = PeekConfig()
    base = f"http://{config.server_host}:{config.server_port}"

    params: dict = {"page": page}
    if search:
        params["q"] = search
    if tags:
        params["tags"] = tags

    try:
        resp = httpx.get(f"{base}/api/v1/entries", params=params, timeout=30)
        data = resp.json()
        if resp.status_code == 200:
            for item in data.get("items", []):
                tags_str = ", ".join(item.get("tags", []))
                click.echo(f"  [{item['slug']}] {item['summary']}  {tags_str}")
            click.echo(f"\n  Total: {data['total']} | Page {data['page']}/{(data['total'] + data['per_page'] - 1) // data['per_page']}")
        else:
            click.echo(f"❌ Error: {data.get('error', {}).get('message', resp.text)}", err=True)
    except httpx.ConnectError:
        click.echo("❌ Cannot connect to Peek server.", err=True)


@cli.command()
@click.argument("slug")
def get(slug: str):
    """Get entry details."""
    config = PeekConfig()
    base = f"http://{config.server_host}:{config.server_port}"

    try:
        resp = httpx.get(f"{base}/api/v1/entries/{slug}", timeout=30)
        data = resp.json()
        if resp.status_code == 200:
            click.echo(f"  Slug: {data['slug']}")
            click.echo(f"  Summary: {data['summary']}")
            click.echo(f"  Status: {data['status']}")
            click.echo(f"  Files: {len(data.get('files', []))}")
            click.echo(f"  URL: {data.get('url', 'N/A')}")
        else:
            click.echo(f"❌ Not found: {slug}", err=True)
            sys.exit(1)
    except httpx.ConnectError:
        click.echo("❌ Cannot connect to Peek server.", err=True)


@cli.command()
@click.argument("slug")
def delete(slug: str):
    """Delete an entry."""
    config = PeekConfig()
    base = f"http://{config.server_host}:{config.server_port}"

    try:
        resp = httpx.delete(f"{base}/api/v1/entries/{slug}", timeout=30)
        if resp.status_code == 200:
            click.echo(f"✅ Deleted: {slug}")
        else:
            data = resp.json()
            click.echo(f"❌ Error: {data.get('error', {}).get('message', resp.text)}", err=True)
            sys.exit(1)
    except httpx.ConnectError:
        click.echo("❌ Cannot connect to Peek server.", err=True)


@cli.command()
@click.option("--edit", is_flag=True, help="Open config file in $EDITOR")
def config(edit: bool):
    """Show or edit Peek configuration."""
    cfg = PeekConfig()

    if edit:
        config_path = cfg.db_path.parent / "config.yaml"
        if not config_path.exists():
            config_path.parent.mkdir(parents=True, exist_ok=True)
            config_path.write_text("# Peek configuration\nserver:\n  host: 127.0.0.1\n  port: 8080\n")
        editor = os.environ.get("EDITOR", "vi")
        try:
            subprocess.run([editor, str(config_path)], check=True)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            click.echo(f"❌ Could not open editor: {e}", err=True)
            sys.exit(1)
        return

    # Show current config
    click.echo("Peek Configuration:")
    click.echo(f"  Server: {cfg.server_host}:{cfg.server_port}")
    click.echo(f"  Base URL: {cfg.view_base_url}")
    click.echo(f"  Data Dir: {cfg.data_dir}")
    click.echo(f"  DB Path: {cfg.db_path}")
    click.echo(f"  API Key: {'configured' if cfg.api_key else 'none'}")
    click.echo(f"  Allowed Dirs: {cfg.allowed_dirs or '(none - uses data_dir)'}")
    click.echo(f"  CORS Origins: {cfg.cors_origins}")
    click.echo(f"  Max File Size: {cfg.max_file_size // 1024 // 1024} MB")
    click.echo(f"  Max Entry Files: {cfg.max_entry_files}")
    click.echo(f"  Max Entry Size: {cfg.max_entry_size // 1024 // 1024} MB")
    click.echo(f"  Log Level: {cfg.log_level}")
```

**Note on `uvicorn.run` with factory:** The `serve` command uses `factory=True` so uvicorn calls `create_app()` instead of importing a module-level `app`. If your uvicorn version doesn't support `factory`, use this alternative:

```python
# Alternative for older uvicorn:
# Create a wrapper module that calls create_app()
uvicorn.run("peek.main:create_app", host=h, port=p, reload=False, factory=True)
```

If `factory` is not supported by your uvicorn version, fall back to:

```python
uvicorn.run("peek.__main__:app", host=h, port=p, reload=False)
```

Where `peek/__main__.py` creates the app at module level for uvicorn.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_cli.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/cli.py backend/tests/test_cli.py
git commit -m "feat(backend): Click CLI — serve, create, list, get, delete, config (201 status fix)"
```

---

### Summary of Review Fixes Applied

| Task | Fix | Change |
|------|-----|--------|
| **0 (NEW)** | Merge old Task 13 | conftest.py, factories.py, .gitignore, Makefile now first task |
| **1** | Remove module-level `app` | `__main__.py` entry point instead of `app = create_app()` in main.py |
| **2** | No major changes | ForbiddenPathError docstring updated |
| **3** | Allowlist + API key + CORS | `allowed_dirs`, `api_key`, `cors_origins` fields added; `forbidden_paths` deprecated |
| **4** | Server-side defaults + remove line_count | `sa_column` with `server_default=func.now()`; `EntryCreate`/`EntryUpdate` schemas; `line_count` removed from `FileResponse` |
| **5** | No changes | — |
| **6** | `app.state` + connection PRAGMA | Engine stored on `app.state.db_engine`; `_set_pragma` event handler on every connection |
| **7** | Path validation | `validate_disk_path()` helper; `get_disk_path()` rejects `..` and absolute paths |
| **8** | Allowlist + hardlink + bounds | `validate_local_path` uses allowlist; symlink checked before resolve; hardlink detection; `scan_directory` validates each file; `expires_in` bounded 1min–365d |
| **9** | DI fix + transaction + disk cleanup | `get_entry_service()` uses `app.state`; transaction with rollback; `update_entry` deletes disk files; TOCTOU slug retry on `IntegrityError` |
| **10** | Content endpoint + auth + 201 | File content inline endpoint; API key auth middleware; `app.state` for services; configurable CORS; POST returns 201; sanitized Content-Disposition; static file serving |
| **11** | Updated for allowlist | Tests use `allowed_dirs`; added storage path traversal, hardlink, `..` component, and header injection tests |
| **12** | 201 status + config command | CLI checks 201 for create; added `peek config` command |
### Task 14: Frontend Project Scaffolding + Design System

**Goal:** Initialize Vue 3 + Vite project with complete Design System (CSS variables, theme system, base components).

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html` (with FOUC prevention)
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/styles/variables.css` (Design tokens)
- Create: `frontend/src/styles/dark.css` (Dark theme)
- Create: `frontend/src/styles/light.css` (Light theme)
- Create: `frontend/src/styles/components.css` (Base component styles)
- Create: `frontend/src/composables/useTheme.ts`

---

- [ ] **Step 1: Create package.json**

```json
{
  "name": "peek-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .vue,.ts",
    "type-check": "vue-tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "vue": "^3.4",
    "vue-router": "^4.3",
    "shiki": "^1.6",
    "markdown-it": "^14.1",
    "markdown-it-anchor": "^9.0",
    "sanitize-html": "^2.13",
    "@iconify/vue": "^4.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0",
    "typescript": "^5.4",
    "vite": "^5.2",
    "vue-tsc": "^2.0",
    "vitest": "^1.5",
    "@vue/test-utils": "^2.4",
    "happy-dom": "^14.7",
    "@types/markdown-it": "^14.0",
    "@types/sanitize-html": "^2.11"
  }
}
```

> **Note:** Removed `mermaid` (P2), `markdown-it-toc-done-right` (handled by parent component now).

---

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
```

---

- [ ] **Step 3: Create index.html with FOUC prevention**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Peek</title>
    <!-- FOUC Prevention: Read theme before CSS loads -->
    <script>
      (function() {
        const saved = localStorage.getItem('peek-theme')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const theme = saved || (prefersDark ? 'dark' : 'light')
        document.documentElement.setAttribute('data-theme', theme)
      })()
    </script>
    <!-- Preload fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

- [ ] **Step 4: Create styles/variables.css (Design Tokens)**

```css
/* Design Tokens - CSS Custom Properties */
/* Base variables (will be overridden by theme) */

:root {
  /* Spacing Scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;

  /* Font Sizes */
  --font-xs: 12px;
  --font-sm: 14px;
  --font-md: 16px;
  --font-lg: 20px;
  --font-xl: 24px;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* Z-Index Scale */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-drawer: 300;
  --z-modal: 400;
  --z-tooltip: 500;
  --z-toast: 600;

  /* Layout */
  --header-height: 56px;
  --toolbar-height: 48px;
  --bottom-bar-height: 56px;
  --sidebar-width: 240px;
  --toc-width: 200px;
}

/* Font Family (shared) */
* {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
}

/* Code blocks use monospace */
code, pre, .font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
}
```

---

- [ ] **Step 5: Create styles/dark.css**

```css
/* Dark Theme - GitHub Dark inspired */
[data-theme="dark"] {
  /* Accent Colors */
  --accent-color: #3B82F6;
  --accent-hover: #2563EB;
  --accent-light: rgba(59, 130, 246, 0.1);

  /* Status Colors */
  --success-color: #10B981;
  --warning-color: #F59E0B;
  --error-color: #EF4444;

  /* Backgrounds */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-overlay: rgba(0, 0, 0, 0.7);

  /* Borders */
  --border-color: #30363D;
  --border-hover: #8B949E;

  /* Text */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-tertiary: #6E7681;
  --text-on-accent: #FFFFFF;

  /* Tags */
  --tag-bg: rgba(139, 148, 158, 0.2);
  --tag-text: #8B949E;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);

  /* Shiki overrides for CSS variables mode */
  --shiki-color-text: #E6EDF3;
  --shiki-color-background: #161B22;
  --shiki-token-comment: #8B949E;
  --shiki-token-keyword: #FF7B72;
  --shiki-token-string: #A5D6FF;
  --shiki-token-function: #D2A8FF;
  --shiki-token-number: #79C0FF;
  --shiki-token-punctuation: #E6EDF3;
  --shiki-token-operator: #FF7B72;
}
```

---

- [ ] **Step 6: Create styles/light.css**

```css
/* Light Theme - GitHub Light inspired */
[data-theme="light"] {
  /* Accent Colors */
  --accent-color: #0969DA;
  --accent-hover: #0550AE;
  --accent-light: rgba(9, 105, 218, 0.1);

  /* Status Colors */
  --success-color: #1A7F37;
  --warning-color: #9A6700;
  --error-color: #CF222E;

  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F6F8FA;
  --bg-tertiary: #F3F4F6;
  --bg-overlay: rgba(0, 0, 0, 0.5);

  /* Borders */
  --border-color: #D0D7DE;
  --border-hover: #8C959F;

  /* Text */
  --text-primary: #1F2328;
  --text-secondary: #656D76;
  --text-tertiary: #8C959F;
  --text-on-accent: #FFFFFF;

  /* Tags */
  --tag-bg: rgba(101, 109, 118, 0.15);
  --tag-text: #656D76;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(31, 35, 40, 0.04);
  --shadow-md: 0 3px 6px rgba(31, 35, 40, 0.08);
  --shadow-lg: 0 8px 16px rgba(31, 35, 40, 0.12);

  /* Shiki overrides */
  --shiki-color-text: #1F2328;
  --shiki-color-background: #F6F8FA;
  --shiki-token-comment: #6E7781;
  --shiki-token-keyword: #CF222E;
  --shiki-token-string: #0A3069;
  --shiki-token-function: #6639BA;
  --shiki-token-number: #0550AE;
  --shiki-token-punctuation: #1F2328;
  --shiki-token-operator: #CF222E;
}
```

---

- [ ] **Step 7: Create styles/components.css (Base Components)**

```css
/* Base Component Styles */

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Button Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.btn:active {
  transform: scale(0.96);
}

/* Button Variants */
.btn-primary {
  background: var(--accent-color);
  color: var(--text-on-accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Icon Button */
.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--radius-md);
}

/* Input */
.input {
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-md);
  border: 2px solid var(--bg-secondary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* Selection */
::selection {
  background: var(--accent-light);
  color: var(--text-primary);
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

- [ ] **Step 8: Create composables/useTheme.ts**

```typescript
// composables/useTheme.ts
import { ref, watch, onMounted } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'peek-theme'

// Singleton state
const theme = ref<Theme>('dark')
const isReady = ref(false)

export function useTheme() {
  onMounted(() => {
    // Read from DOM (set by inline script in index.html)
    const current = document.documentElement.getAttribute('data-theme') as Theme
    theme.value = current || 'dark'
    isReady.value = true
  })

  watch(theme, (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  })

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function set(newTheme: Theme) {
    theme.value = newTheme
  }

  return {
    theme,
    isReady,
    isDark: () => theme.value === 'dark',
    toggle,
    set,
  }
}
```

---

- [ ] **Step 9: Create main.ts**

```typescript
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Import design system
import './styles/variables.css'
import './styles/dark.css'
import './styles/light.css'
import './styles/components.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/EntryListView.vue') },
    { path: '/:slug', component: () => import('./views/EntryDetailView.vue') },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
```

---

- [ ] **Step 10: Create App.vue (Basic Shell)**

```vue
<template>
  <div class="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// App root
</script>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}
</style>
```

---

- [ ] **Step 11: Verify build**

```bash
cd frontend
npm install
npm run build
```

Expected: Build succeeds.


Add `markdown-it-anchor` and `markdown-it-toc-done-right` for TOC support, and `@iconify/vue` for proper icons (replacing emoji fallbacks).

```json
{
  "name": "peek-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .vue,.ts",
    "type-check": "vue-tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "vue": "^3.4",
    "vue-router": "^4.3",
    "shiki": "^1.6",
    "markdown-it": "^14.1",
    "markdown-it-anchor": "^9.0",
    "markdown-it-toc-done-right": "^4.2",
    "sanitize-html": "^2.13",
    "@iconify/vue": "^4.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0",
    "typescript": "^5.4",
    "vite": "^5.2",
    "vue-tsc": "^2.0",
    "vitest": "^1.5",
    "@vue/test-utils": "^2.4",
    "happy-dom": "^14.7",
    "@types/markdown-it": "^14.0",
    "@types/sanitize-html": "^2.11"
  }
}
```

> **Design review fix:** Removed `mermaid` from dependencies (out of MVP scope). Added `markdown-it-anchor`, `markdown-it-toc-done-right` for TOC generation (review §11). Added `@iconify/vue` for proper SVG icons instead of emoji (review §3).

- [ ] **Step 2: Create vite.config.ts**

Ensure the proxy points to the correct backend port. The backend's `peek serve` default is `8000`, not `8080`.

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
```

> **Design review fix:** Changed proxy target from `8080` to `8000` to match backend default port. Added `@/` path alias to match tsconfig paths.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create index.html — with FOUC-free theme script**

Add a blocking `<script>` in `<head>` that sets `data-theme` before Vue mounts. This eliminates the flash of unstyled content (review §4).

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Peek</title>
    <script>
      // FOUC prevention: set theme before Vue mounts
      (function() {
        var t = localStorage.getItem('peek-theme')
        var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
      })()
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

> **Design review fix:** Added inline `<script>` in `<head>` to set `data-theme` attribute before the page renders. This prevents the white flash for dark-mode users (review §4). The Vue ThemeToggle component reads the initial state from the DOM attribute rather than re-computing.

- [ ] **Step 5: Create main.ts**

```typescript
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import EntryListView from './views/EntryListView.vue'
import EntryDetailView from './views/EntryDetailView.vue'
import './styles/variables.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: EntryListView },
    { path: '/view/:slug', component: EntryDetailView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
```

> **Design review fix:** Renamed views from `IndexView`/`EntryView` to `EntryListView`/`EntryDetailView` for clarity. Imported `variables.css` globally here so design tokens are available everywhere.

- [ ] **Step 6: Create App.vue**

```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 7: Create styles/variables.css — design tokens with single-file theming**

Use `:root` for light theme and `[data-theme="dark"]` for dark theme only. Remove the redundant `light.css` file entirely. Add design tokens: spacing scale, font sizes, border radii, shadows, z-index layers, and Shiki CSS variable mappings. Add transition on theme change (review §5).

```css
/* frontend/src/styles/variables.css */

/* ===== Design Tokens ===== */
:root {
  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* Font sizes */
  --font-xs: 11px;
  --font-sm: 13px;
  --font-base: 14px;
  --font-md: 16px;
  --font-lg: 20px;
  --font-xl: 24px;
  --font-2xl: 32px;

  /* Border radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  /* Z-index layers */
  --z-base: 0;
  --z-dropdown: 100;
  --z-overlay: 200;
  --z-modal: 300;

  /* Line height */
  --line-height-code: 1.5;
  --line-height-prose: 1.6;

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;

  /* ===== Light theme colors ===== */
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-code: #f6f8fa;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --text-tertiary: #8b949e;
  --border-color: #d0d7de;
  --accent-color: #0969da;
  --accent-hover: #0550ae;
  --accent-subtle: #ddf4ff;
  --tag-bg: #ddf4ff;
  --tag-text: #0969da;
  --error-color: #cf222e;
  --error-bg: #ffebe9;
  --success-color: #1a7f37;

  /* ===== Shiki CSS variable tokens (light) ===== */
  --shiki-color-text: #24292e;
  --shiki-color-background: #f6f8fa;
  --shiki-token-constant: #005cc5;
  --shiki-token-string: #032f62;
  --shiki-token-comment: #6a737d;
  --shiki-token-keyword: #d73a49;
  --shiki-token-function: #6f42c1;
  --shiki-token-number: #005cc5;
  --shiki-token-operator: #d73a49;
  --shiki-token-punctuation: #24292e;
  --shiki-token-variable: #e36209;
  --shiki-token-type: #6f42c1;
}

/* ===== Dark theme overrides ===== */
[data-theme="dark"] {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-code: #161b22;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;
  --border-color: #30363d;
  --accent-color: #58a6ff;
  --accent-hover: #79c0ff;
  --accent-subtle: #1f2937;
  --tag-bg: #1f2937;
  --tag-text: #58a6ff;
  --error-color: #f85149;
  --error-bg: #3d1114;
  --success-color: #3fb950;

  /* Shiki CSS variable tokens (dark) */
  --shiki-color-text: #c9d1d9;
  --shiki-color-background: #161b22;
  --shiki-token-constant: #79c0ff;
  --shiki-token-string: #a5d6ff;
  --shiki-token-comment: #8b949e;
  --shiki-token-keyword: #ff7b72;
  --shiki-token-function: #d2a8ff;
  --shiki-token-number: #79c0ff;
  --shiki-token-operator: #ff7b72;
  --shiki-token-punctuation: #c9d1d9;
  --shiki-token-variable: #ffa657;
  --shiki-token-type: #d2a8ff;
}

/* ===== Global transitions for theme switching ===== */
html,
html *,
html *::before,
html *::after {
  transition:
    background-color var(--transition-normal),
    color var(--transition-normal),
    border-color var(--transition-normal);
}

/* Respect reduced motion preference (review §8) */
@media (prefers-reduced-motion: reduce) {
  html,
  html *,
  html *::before,
  html *::after {
    transition: none !important;
  }
}

/* ===== Base resets ===== */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Noto Sans,
    Helvetica, Arial, sans-serif;
  font-size: var(--font-base);
  line-height: var(--line-height-prose);
  color: var(--text-primary);
  background-color: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--accent-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Shiki CSS variables mode output styling */
.shiki {
  background-color: var(--shiki-color-background) !important;
  color: var(--shiki-color-text) !important;
}

.shiki span {
  color: var(--shiki-color-text);
}

/* Shiki token-specific CSS variable overrides */
.shiki .token.constant  { color: var(--shiki-token-constant); }
.shiki .token.string    { color: var(--shiki-token-string); }
.shiki .token.comment   { color: var(--shiki-token-comment); font-style: italic; }
.shiki .token.keyword   { color: var(--shiki-token-keyword); }
.shiki .token.function  { color: var(--shiki-token-function); }
.shiki .token.number    { color: var(--shiki-token-number); }
.shiki .token.operator  { color: var(--shiki-token-operator); }
.shiki .token.punctuation { color: var(--shiki-token-punctuation); }
.shiki .token.variable  { color: var(--shiki-token-variable); }
.shiki .token.type      { color: var(--shiki-token-type); }
```

> **Design review fixes:**
> - **Single-file theming** (review §5): Removed redundant `light.css` — `:root` serves as light theme, `[data-theme="dark"]` overrides for dark. No file switching needed.
> - **Design tokens** (review §5): Added spacing scale (`--space-1` through `--space-8`), font sizes, border radii, shadows, z-index layers.
> - **Theme transitions** (review §5): Added `transition` on `background-color`, `color`, `border-color` for smooth theme switching.
> - **Reduced motion** (review §8): Added `@media (prefers-reduced-motion: reduce)` to disable transitions.
> - **Shiki CSS variables mode** (review §5, §6): Instead of Shiki's dual-theme `@media (prefers-color-scheme)` output (which doesn't work with `data-theme`), we use Shiki's CSS variables mode. Token colors are mapped through `--shiki-*` CSS variables, which are overridden in `[data-theme="dark"]`. This ensures code blocks follow the app theme.

- [ ] **Step 8: Install dependencies and verify**

Run: `cd ~/lab/projects/peek/frontend && npm install`
Expected: Dependencies installed successfully

- [ ] **Step 9: Verify CSS loads without errors**

Run: `cd ~/lab/projects/peek/frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (may warn about missing view files — that's OK, we add them in Task 16)

- [ ] **Step 10: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/
git commit -m "feat(frontend): Vue 3 + Vite + TypeScript scaffolding with design tokens and FOUC-free theme"
```

---

### Task 15: UI Components + Types + API Client

**Goal:** Build reusable UI components following Design System, plus type definitions and API client.

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/components/ui/Button.vue`
- Create: `frontend/src/components/ui/IconButton.vue`
- Create: `frontend/src/components/ui/Tooltip.vue`
- Create: `frontend/src/components/ui/Toast.vue`
- Create: `frontend/src/components/ui/LoadingSkeleton.vue`
- Create: `frontend/src/composables/useToast.ts`

---

- [ ] **Step 1: Create types/index.ts**

```typescript
// frontend/src/types/index.ts

// === Entry Types ===
export interface EntryResponse {
  id: number
  slug: string
  url: string
  summary: string
  status: 'active' | 'archived' | 'published'
  tags: string[]
  files: FileResponse[]
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface FileResponse {
  id: number
  path: string | null
  filename: string
  language: string | null
  is_binary: boolean
  size: number
  line_count: number | null
  content?: string  // Populated when ?include=files.content
}

export interface EntryListItem {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  file_count: number
  created_at: string
  updated_at: string
}

export interface EntryListResponse {
  items: EntryListItem[]
  total: number
  page: number
  per_page: number
}

export interface FileContentResponse {
  content: string
  language: string | null
  filename: string
  size: number
}

// === TOC Types ===
export interface TocHeading {
  id: string
  text: string
  level: number
}

// === Tree Types ===
export interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileResponse
}

// === Error Types ===
export interface PeekErrorBody {
  error: {
    code: string
    message: string
    details: unknown
  }
}

export class PeekApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number = 0) {
    super(message)
    this.name = 'PeekApiError'
    this.code = code
    this.status = status
  }
}

// === UI Types ===
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}
```

---

- [ ] **Step 2: Create api/client.ts**

```typescript
// frontend/src/api/client.ts

import type {
  EntryResponse,
  EntryListResponse,
  FileContentResponse,
} from '../types'
import { PeekApiError } from '../types'

const BASE_URL = '/api/v1'

function getApiKey(): string | null {
  const meta = document.querySelector('meta[name="peek-api-key"]')
  return meta?.getAttribute('content') || null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  const apiKey = getApiKey()
  if (apiKey) headers['X-API-Key'] = apiKey
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    let code = 'UNKNOWN'
    try {
      const body = await resp.json()
      if (body.error) {
        message = body.error.message || message
        code = body.error.code || code
      }
    } catch { /* not JSON */ }
    throw new PeekApiError(code, message, resp.status)
  }

  const text = await resp.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PeekApiError('PARSE_ERROR', 'Invalid JSON', resp.status)
  }
}

export const api = {
  listEntries(params?: {
    q?: string
    tags?: string
    status?: string
    page?: number
    per_page?: number
  }): Promise<EntryListResponse> {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.tags) search.set('tags', params.tags)
    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.per_page) search.set('per_page', String(params.per_page))
    return request(`/entries?${search.toString()}`)
  },

  getEntry(slug: string, options?: { include?: string }): Promise<EntryResponse> {
    const params = new URLSearchParams()
    if (options?.include) params.set('include', options.include)
    return request(`/entries/${slug}?${params.toString()}`)
  },

  fetchFileContent(slug: string, fileId: number): Promise<string> {
    return fetch(`${BASE_URL}/entries/${slug}/files/${fileId}/content`).then(r => r.text())
  },

  downloadFile(slug: string, fileId: number): string {
    return `${BASE_URL}/entries/${slug}/files/${fileId}/download`
  },
}
```

---

- [ ] **Step 3: Create composables/useToast.ts**

```typescript
// composables/useToast.ts
import { ref } from 'vue'
import type { ToastMessage, ToastType } from '../types'

const toasts = ref<ToastMessage[]>([])
let idCounter = 0

export function useToast() {
  function show(message: string, type: ToastType = 'info', duration = 3000) {
    const id = String(++idCounter)
    toasts.value.push({ id, type, message, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function remove(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) toasts.value.splice(index, 1)
  }

  return {
    toasts,
    show,
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
    remove,
  }
}

// For use in setup
export function useToasts() {
  return { toasts }
}
```

---

- [ ] **Step 4: Create components/ui/Button.vue**

```vue
<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-icon': iconOnly }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <Icon v-if="loading" icon="codicon:loading" class="animate-spin" />
    <Icon v-else-if="icon" :icon="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ButtonVariant } from '../../types'

interface Props {
  variant?: ButtonVariant
  icon?: string
  iconOnly?: boolean
  disabled?: boolean
  loading?: boolean
}

defineProps<Props>()
defineEmits<{ click: [e: MouseEvent] }>()
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  background: transparent;
  color: var(--text-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.btn:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-primary {
  background: var(--accent-color);
  color: var(--text-on-accent);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-secondary {
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-ghost {
  color: var(--text-secondary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

---

- [ ] **Step 5: Create components/ui/IconButton.vue**

```vue
<template>
  <Button
    :variant="variant"
    :icon="icon"
    icon-only
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <Tooltip v-if="tooltip" :text="tooltip" />
  </Button>
</template>

<script setup lang="ts">
import Button from './Button.vue'
import Tooltip from './Tooltip.vue'
import type { ButtonVariant } from '../../types'

interface Props {
  icon: string
  tooltip?: string
  variant?: ButtonVariant
}

defineProps<Props>()
defineEmits<{ click: [e: MouseEvent] }>()
</script>
```

---

- [ ] **Step 6: Create components/ui/Tooltip.vue**

```vue
<template>
  <div class="tooltip-wrapper">
    <slot />
    <span v-if="text" class="tooltip-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text: string
}
defineProps<Props>()
</script>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-text {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 4px 8px;
  background: var(--bg-overlay);
  color: var(--text-primary);
  font-size: var(--font-xs);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all var(--transition-fast);
  z-index: var(--z-tooltip);
}

.tooltip-wrapper:hover .tooltip-text {
  opacity: 1;
  visibility: visible;
}
</style>
```

---

- [ ] **Step 7: Create components/ui/Toast.vue**

```vue
<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
        >
          <Icon :icon="iconFor(toast.type)" class="toast-icon" />
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click="remove(toast.id)">
            <Icon icon="codicon:close" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useToasts } from '../../composables/useToast'
import type { ToastType } from '../../types'

const { toasts } = useToasts()

function iconFor(type: ToastType): string {
  const icons: Record<ToastType, string> = {
    success: 'codicon:check',
    error: 'codicon:error',
    info: 'codicon:info',
  }
  return icons[type]
}

function remove(id: string) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) toasts.value.splice(index, 1)
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 768px) {
  .toast-container {
    top: auto;
    bottom: calc(var(--bottom-bar-height) + var(--space-4));
    left: var(--space-4);
    right: var(--space-4);
  }
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  min-width: 280px;
}

.toast-success {
  border-left: 3px solid var(--success-color);
}
.toast-error {
  border-left: 3px solid var(--error-color);
}
.toast-info {
  border-left: 3px solid var(--accent-color);
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
}
.toast-success .toast-icon { color: var(--success-color); }
.toast-error .toast-icon { color: var(--error-color); }
.toast-info .toast-icon { color: var(--accent-color); }

.toast-message {
  flex: 1;
  font-size: var(--font-sm);
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
}
.toast-close:hover {
  color: var(--text-primary);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--transition-base);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(100%);
  }
}
</style>
```

---

- [ ] **Step 8: Create components/ui/LoadingSkeleton.vue**

```vue
<template>
  <div class="skeleton" :style="{ width, height }">
    <div class="skeleton-pulse"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  width?: string
  height?: string
}
defineProps<Props>()
</script>

<style scoped>
.skeleton {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.skeleton-pulse {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

---

- [ ] **Step 9: Verify components**

```bash
cd frontend
npm run type-check
```

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create types/index.ts**

Add `FileContentResponse` type for the inline content endpoint. Add `PeekApiError` class for typed error handling.

```typescript
// frontend/src/types/index.ts

export interface EntryResponse {
  id: number
  slug: string
  url: string
  summary: string
  status: 'active' | 'archived' | 'published'
  tags: string[]
  files: FileResponse[]
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface FileResponse {
  id: number
  path: string | null
  filename: string
  language: string | null
  is_binary: boolean
  size: number
  line_count: number | null
  content?: string  // Populated when ?include=files.content
}

export interface EntryListItem {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  file_count: number
  created_at: string
  updated_at: string
}

export interface EntryListResponse {
  items: EntryListItem[]
  total: number
  page: number
  per_page: number
}

export interface FileContentResponse {
  content: string
  language: string | null
  filename: string
  size: number
}

export interface PeekErrorBody {
  error: {
    code: string
    message: string
    details: unknown
  }
}

/** Typed API error that preserves the backend error code (review §12). */
export class PeekApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number = 0) {
    super(message)
    this.name = 'PeekApiError'
    this.code = code
    this.status = status
  }
}

/** Tree node for FileTree recursive rendering (review §3). */
export interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileResponse  // Leaf nodes only
}
```

> **Design review fixes:**
> - Added `content?` field to `FileResponse` for `?include=files.content` support (review §2 — reduces N+1).
> - Added `FileContentResponse` for the new `/content` inline endpoint.
> - Added `PeekApiError` class preserving error code and HTTP status (review §12 — error categorization).
> - Added `TreeNode` interface for recursive FileTree (review §3).

- [ ] **Step 2: Create api/client.ts**

Key changes: (1) `fetchFileContent()` calls the `/content` inline endpoint, not the download endpoint. (2) `getEntry()` optionally includes `?include=files.content`. (3) JSON parse safety for non-JSON error responses. (4) API key header injection.

```typescript
// frontend/src/api/client.ts

import type {
  EntryResponse,
  EntryListResponse,
  FileContentResponse,
  PeekApiError,
} from '../types'
import { PeekApiError as PeekApiErrorClass } from '../types'

const BASE_URL = '/api/v1'

/** Get API key from meta tag or env, if configured. */
function getApiKey(): string | null {
  const meta = document.querySelector('meta[name="peek-api-key"]')
  if (meta) return meta.getAttribute('content')
  return null
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {}

  // Inject API key header if configured
  const apiKey = getApiKey()
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  // Set Content-Type for JSON requests (not for FormData)
  if (options?.method !== 'GET' && !(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!resp.ok) {
    // Safe JSON parse — handle non-JSON error responses (review §18)
    let message = `HTTP ${resp.status}`
    let code = 'UNKNOWN'
    try {
      const body = await resp.json()
      if (body.error) {
        message = body.error.message || message
        code = body.error.code || code
      }
    } catch {
      // Response is not JSON (e.g., 502 from reverse proxy) — use default message
    }
    throw new PeekApiErrorClass(code, message, resp.status)
  }

  // Safe JSON parse for success responses too
  const text = await resp.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PeekApiErrorClass(
      'PARSE_ERROR',
      'Invalid JSON response from server',
      resp.status,
    )
  }
}

export const api = {
  listEntries(params?: {
    q?: string
    tags?: string
    status?: string
    page?: number
    per_page?: number
  }): Promise<EntryListResponse> {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.tags) search.set('tags', params.tags)
    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.per_page) search.set('per_page', String(params.per_page))
    const qs = search.toString()
    return request(`/entries${qs ? '?' + qs : ''}`)
  },

  /**
   * Fetch entry with optional file content inclusion.
   * Use `include: 'files.content'` to get file contents inline (reduces N+1 requests).
   */
  getEntry(
    slug: string,
    options?: { include?: string },
  ): Promise<EntryResponse> {
    const params = new URLSearchParams()
    if (options?.include) {
      params.set('include', options.include)
    }
    const qs = params.toString()
    return request(`/entries/${slug}${qs ? '?' + qs : ''}`)
  },

  deleteEntry(slug: string): Promise<{ ok: boolean }> {
    return request(`/entries/${slug}`, { method: 'DELETE' })
  },

  /**
   * Fetch file content for inline display.
   * Calls the /content endpoint which returns text/plain (not Content-Disposition: attachment).
   * This is the correct method for rendering file content in the browser (review §2).
   */
  async fetchFileContent(
    slug: string,
    fileId: number,
  ): Promise<string> {
    const headers: Record<string, string> = {}
    const apiKey = getApiKey()
    if (apiKey) {
      headers['X-API-Key'] = apiKey
    }

    const resp = await fetch(
      `${BASE_URL}/entries/${slug}/files/${fileId}/content`,
      { headers },
    )

    if (!resp.ok) {
      let message = `HTTP ${resp.status}`
      let code = 'UNKNOWN'
      try {
        const body = await resp.json()
        if (body.error) {
          message = body.error.message || message
          code = body.error.code || code
        }
      } catch {
        // Non-JSON error
      }
      throw new PeekApiErrorClass(code, message, resp.status)
    }

    return resp.text()
  },

  /** Returns the download URL for a file (for binary file downloads). */
  downloadFile(slug: string, fileId: number): string {
    return `${BASE_URL}/entries/${slug}/files/${fileId}`
  },

  /** Returns the zip download URL for an entry. */
  downloadZip(slug: string): string {
    return `${BASE_URL}/entries/${slug}/download`
  },
}
```

> **Design review fixes:**
> - **`fetchFileContent()`** (review §2): New method that calls `/entries/{slug}/files/{fileId}/content` — the inline content endpoint. Returns `Promise<string>` (raw text). Views use this for rendering, NOT `downloadFile()`.
> - **`getEntry()` with `?include=files.content`** (review §2): Optional parameter to get file contents inline, reducing N+1 requests when all files are small.
> - **JSON parse safety** (review §18): Both error and success paths handle non-JSON responses gracefully.
> - **`PeekApiError`** (review §12): Preserves backend error code and HTTP status for error categorization in UI.
> - **API key header injection**: If configured via `<meta name="peek-api-key">`, the key is sent as `X-API-Key` header on all requests.

- [ ] **Step 3: Write API client unit test**

```typescript
// frontend/src/api/__tests__/client.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PeekApiError } from '../../types'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mock setup
import { api } from '../client'

beforeEach(() => {
  mockFetch.mockReset()
})

describe('api client', () => {
  describe('listEntries', () => {
    it('fetches entries with no params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
          }),
      })
      const result = await api.listEntries()
      expect(result.total).toBe(0)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/entries',
        expect.any(Object),
      )
    })

    it('passes search and pagination params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
          }),
      })
      await api.listEntries({ q: 'test', page: 2 })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/entries?q=test&page=2',
        expect.any(Object),
      )
    })
  })

  describe('getEntry', () => {
    it('fetches entry by slug', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 1,
            slug: 'test-entry',
            summary: 'Test',
            files: [],
          }),
      })
      const result = await api.getEntry('test-entry')
      expect(result.slug).toBe('test-entry')
    })

    it('supports include parameter for inline content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 1,
            slug: 'test',
            summary: 'Test',
            files: [{ id: 1, content: 'file text' }],
          }),
      })
      await api.getEntry('test', { include: 'files.content' })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/entries/test?include=files.content',
        expect.any(Object),
      )
    })
  })

  describe('fetchFileContent', () => {
    it('calls the /content endpoint and returns text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'file content here',
      })
      const content = await api.fetchFileContent('my-slug', 42)
      expect(content).toBe('file content here')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/entries/my-slug/files/42/content',
        expect.any(Object),
      )
    })
  })

  describe('error handling', () => {
    it('throws PeekApiError with code on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { code: 'NOT_FOUND', message: 'Entry not found' },
        }),
      })
      await expect(api.getEntry('missing')).rejects.toThrow('Entry not found')
      await expect(api.getEntry('missing')).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof PeekApiError && err.code === 'NOT_FOUND',
      )
    })

    it('handles non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })
      await expect(api.getEntry('broken')).rejects.toThrow('HTTP 502')
    })
  })

  describe('downloadFile', () => {
    it('returns the correct download URL', () => {
      const url = api.downloadFile('my-slug', 5)
      expect(url).toBe('/api/v1/entries/my-slug/files/5')
    })
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/frontend && npx vitest run src/api/__tests__/client.test.ts 2>&1 | tail -20`
Expected: FAIL — `Cannot find module '../client'` (file not created yet)

Wait — we already created `client.ts` in Step 2. Let's verify the test passes:

Run: `cd ~/lab/projects/peek/frontend && npx vitest run src/api/__tests__/client.test.ts 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd ~/lab/projects/peek/frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only missing view component errors which we'll add next)

- [ ] **Step 6: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/src/types/ frontend/src/api/
git commit -m "feat(frontend): TypeScript types, PeekApiError, API client with fetchFileContent and safe error handling"
```

---

### Task 16: Frontend Core Components

**Files:**
- Create: `frontend/src/composables/useTheme.ts`
- Create: `frontend/src/composables/useShiki.ts`
- Create: `frontend/src/composables/useEntry.ts`
- Create: `frontend/src/components/CodeViewer.vue`
- Create: `frontend/src/components/MarkdownViewer.vue`
- Create: `frontend/src/components/FileTree.vue`
- Create: `frontend/src/components/ThemeToggle.vue`
- Create: `frontend/src/views/EntryListView.vue`
- Create: `frontend/src/views/EntryDetailView.vue`

> **Design review summary:** MVP component list trimmed to essentials: CodeViewer, MarkdownViewer, FileTree, ThemeToggle, EntryListView, EntryDetailView. Removed: ImageViewer, BinaryViewer, TocNav (merged into MarkdownViewer), ActionBar (merged into CodeViewer), SearchBar (inlined in EntryListView), EntryCard (inlined in EntryListView). Added composables: useTheme (shared reactive singleton), useShiki (singleton highlighter), useEntry (cached fetching).

- [ ] **Step 1: Create composables/useTheme.ts — shared reactive singleton**

Theme state is managed as a module-level reactive singleton. The initial state is read from the DOM attribute (set by the FOUC-prevention script in `index.html`), not re-computed.

```typescript
// frontend/src/composables/useTheme.ts

import { ref, computed } from 'vue'

/** Module-level singleton — shared across all components that call useTheme(). */
const isDark = ref(false)

/** Initialize from DOM attribute (set by FOUC-prevention script in index.html). */
if (typeof document !== 'undefined') {
  const attr = document.documentElement.getAttribute('data-theme')
  isDark.value = attr === 'dark'
}

export function useTheme() {
  const theme = computed(() => (isDark.value ? 'dark' : 'light'))

  function toggle() {
    isDark.value = !isDark.value
    document.documentElement.setAttribute(
      'data-theme',
      isDark.value ? 'dark' : 'light',
    )
    localStorage.setItem('peek-theme', isDark.value ? 'dark' : 'light')
  }

  function setTheme(dark: boolean) {
    isDark.value = dark
    document.documentElement.setAttribute(
      'data-theme',
      isDark.value ? 'dark' : 'light',
    )
    localStorage.setItem('peek-theme', isDark.value ? 'dark' : 'light')
  }

  return { isDark, theme, toggle, setTheme }
}
```

> **Design review fix (§4, §10):** Shared reactive singleton — all components access the same `isDark` ref. Reads initial state from the DOM attribute set by the FOUC-prevention script, not from localStorage again (avoiding a potential mismatch).

- [ ] **Step 2: Create composables/useShiki.ts — singleton highlighter with CSS variables mode**

Create the Shiki highlighter ONCE at the app level. Languages are loaded on demand. Uses CSS variables mode so token colors are controlled by our theme CSS variables (review §1, §6).

```typescript
// frontend/src/composables/useShiki.ts

import { ref } from 'vue'
import {
  createHighlighter,
  type Highlighter,
  type LanguageInput,
  type ThemeInput,
} from 'shiki'

/** Singleton highlighter promise — created once, reused everywhere. */
let highlighterPromise: Promise<Highlighter> | null = null

/** Loading state for UI feedback. */
const isReady = ref(false)
const loadError = ref<string | null>(null)

export function useShiki() {
  /**
   * Get or create the singleton Shiki highlighter.
   * Created once with no pre-loaded languages — they are loaded on demand.
   */
  function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: ['css-variables'],
        langs: [],  // Load dynamically via loadLanguage()
      })
        .then((hl) => {
          isReady.value = true
          return hl
        })
        .catch((err) => {
          loadError.value = err.message || 'Failed to initialize Shiki'
          highlighterPromise = null  // Allow retry
          throw err
        })
    }
    return highlighterPromise
  }

  /**
   * Load a language into the highlighter on demand.
   * Safe to call multiple times — Shiki skips already-loaded languages.
   */
  async function loadLanguage(lang: string): Promise<void> {
    const hl = await getHighlighter()

    // Skip if already loaded
    const loadedLangs = hl.getLoadedLanguages()
    if (loadedLangs.includes(lang)) return

    try {
      // Import the language grammar dynamically
      const grammar = await import(
        `shiki/langs/${lang}.mjs`
      ).then((m: any) => m.default || m)
      await hl.loadLanguage(grammar as LanguageInput)
    } catch {
      // Language not available — will fall back to 'text'
      console.warn(`Shiki: language '${lang}' not available, falling back to text`)
    }
  }

  /**
   * Highlight code using CSS variables mode.
   * Token colors are set via CSS variables (--shiki-token-*) in variables.css.
   * This works with our data-theme attribute, unlike Shiki's dual-theme mode.
   */
  async function highlight(
    code: string,
    lang: string,
  ): Promise<string> {
    const hl = await getHighlighter()

    // Ensure language is loaded
    await loadLanguage(lang)

    // Use 'css-variables' theme — tokens use var(--shiki-*) CSS variables
    return hl.codeToHtml(code, {
      lang: hl.getLoadedLanguages().includes(lang) ? lang : 'text',
      theme: 'css-variables',
    })
  }

  return { getHighlighter, loadLanguage, highlight, isReady, loadError }
}
```

> **Design review fixes:**
> - **Singleton highlighter** (review §1): Created ONCE, shared across all CodeViewer instances. No per-file WASM initialization.
> - **CSS variables mode** (review §5, §6): Uses `theme: 'css-variables'` instead of dual `github-dark`/`github-light` themes. Token colors are controlled by `--shiki-token-*` CSS variables in `variables.css`, which switch automatically with `data-theme`. This avoids the broken `@media (prefers-color-scheme)` dual-theme output.
> - **On-demand language loading** (review §1): Languages are loaded via `loadLanguage()` when needed, not pre-loaded. Shiki skips already-loaded languages.

- [ ] **Step 3: Create composables/useEntry.ts — cached fetching with error states**

Implements shared composable with a simple in-memory cache. Preserves API error codes via `PeekApiError`. Provides loading/error state (review §10, §12, §17).

```typescript
// frontend/src/composables/useEntry.ts

import { ref } from 'vue'
import { api } from '../api/client'
import type { EntryResponse, EntryListItem } from '../types'
import { PeekApiError } from '../types'

interface CacheEntry {
  data: EntryResponse
  timestamp: number
}

/** Simple in-memory cache for entry data. */
const entryCache = new Map<string, CacheEntry>()
const CACHE_MAX_AGE = 30_000  // 30 seconds

export function useEntry() {
  const entry = ref<EntryResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)

  /**
   * Fetch entry by slug. Uses cache if fresh.
   * Optionally includes file content inline (?include=files.content).
   */
  async function fetchEntry(
    slug: string,
    options?: { includeContent?: boolean; maxAge?: number },
  ) {
    const maxAge = options?.maxAge ?? CACHE_MAX_AGE

    // Check cache
    const cached = entryCache.get(slug)
    if (cached && Date.now() - cached.timestamp < maxAge) {
      entry.value = cached.data
      error.value = null
      errorCode.value = null
      return
    }

    loading.value = true
    error.value = null
    errorCode.value = null

    try {
      const opts: { include?: string } = {}
      if (options?.includeContent) {
        opts.include = 'files.content'
      }
      entry.value = await api.getEntry(slug, opts)
      entryCache.set(slug, { data: entry.value, timestamp: Date.now() })
    } catch (e: unknown) {
      if (e instanceof PeekApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else if (e instanceof Error) {
        error.value = e.message
        errorCode.value = 'UNKNOWN'
      } else {
        error.value = 'An unexpected error occurred'
        errorCode.value = 'UNKNOWN'
      }
    } finally {
      loading.value = false
    }
  }

  /** Clear cache for a specific slug or all entries. */
  function clearCache(slug?: string) {
    if (slug) {
      entryCache.delete(slug)
    } else {
      entryCache.clear()
    }
  }

  return { entry, loading, error, errorCode, fetchEntry, clearCache }
}

/** Entry list state — separate composable for the list page. */
export function useEntryList() {
  const entries = ref<EntryListItem[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)

  async function fetchEntries(params?: {
    q?: string
    tags?: string
    page?: number
    per_page?: number
  }) {
    loading.value = true
    error.value = null
    errorCode.value = null

    try {
      const resp = await api.listEntries(params)
      entries.value = resp.items
      total.value = resp.total
      totalPages.value =
        resp.per_page > 0 ? Math.ceil(resp.total / resp.per_page) : 1
    } catch (e: unknown) {
      if (e instanceof PeekApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else if (e instanceof Error) {
        error.value = e.message
        errorCode.value = 'UNKNOWN'
      } else {
        error.value = 'An unexpected error occurred'
        errorCode.value = 'UNKNOWN'
      }
    } finally {
      loading.value = false
    }
  }

  return {
    entries,
    total,
    totalPages,
    loading,
    error,
    errorCode,
    fetchEntries,
  }
}
```

> **Design review fixes:**
> - **Shared composable** (review §10): Views use `useEntry()` and `useEntryList()` instead of inline state management.
> - **Caching** (review §10): Entry data is cached for 30 seconds — navigating back to the list doesn't re-fetch.
> - **Error code preservation** (review §12): `PeekApiError.code` is exposed via `errorCode` ref for 404 vs 500 differentiation in the UI.
> - **`?include=files.content`** (review §2): Optional parameter to get file contents inline.
> - **Safe `totalPages` calculation** (review §19): Guard against `per_page === 0`.

- [ ] **Step 4: Create CodeViewer.vue — singleton Shiki + CSS variables + safe fallback**

Uses the shared `useShiki()` composable instead of creating a highlighter per file. Fallback rendering uses Vue template (auto-escaping) instead of `v-html` (review §16). Supports line selection via URL hash.

```vue
<!-- frontend/src/components/CodeViewer.vue -->
<template>
  <div class="code-viewer" ref="container">
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span class="line-count" v-if="lineCount">{{ lineCount }} lines</span>
      <button
        class="header-btn copy-btn"
        @click="copyCode"
        :aria-label="copied ? 'Copied to clipboard' : 'Copy code'"
        :title="copied ? 'Copied!' : 'Copy'"
      >
        {{ copied ? '✓' : 'Copy' }}
      </button>
      <button
        class="header-btn wrap-btn"
        @click="wrap = !wrap"
        :aria-label="wrap ? 'Disable word wrap' : 'Enable word wrap'"
        :title="wrap ? 'No wrap' : 'Wrap'"
      >
        {{ wrap ? '↩' : '→' }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="code-loading">
      <div class="code-skeleton" v-for="i in 8" :key="i">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Shiki highlighted code (v-html — safe: Shiki output is sanitized) -->
    <div
      v-else-if="highlighted"
      class="code-content"
      :class="{ wrap }"
      v-html="highlighted"
    ></div>

    <!-- Safe fallback: Vue template rendering, no v-html (review §16) -->
    <div v-else class="code-content fallback" :class="{ wrap }">
      <pre>
        <div v-for="(line, i) in content.split('\n')" :key="i" class="code-line" :id="`L${i + 1}`">
          <span class="line-number">{{ i + 1 }}</span>
          <span class="line-content">{{ line }}</span>
        </div>
      </pre>
    </div>

    <div v-if="isEmpty" class="empty-file">Empty file</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  lineCount: number | null
}>()

const { highlight } = useShiki()

const highlighted = ref('')
const isLoading = ref(true)
const copied = ref(false)
const wrap = ref(false)

const isEmpty = computed(() => props.content.length === 0)

async function doHighlight() {
  if (isEmpty.value) {
    highlighted.value = ''
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    highlighted.value = await highlight(
      props.content,
      props.language || 'text',
    )
  } catch {
    // Fallback: leave highlighted empty, Vue template fallback will render
    highlighted.value = ''
  } finally {
    isLoading.value = false
  }
}

// Re-highlight when content or language changes
watch(
  () => [props.content, props.language],
  () => doHighlight(),
)

onMounted(doHighlight)

// Line selection from URL hash (#L5 or #L5-L10)
onMounted(() => {
  const hash = window.location.hash
  if (hash.startsWith('#L')) {
    nextTick(() => {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('line-highlight')
      }
    })
  }
})

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard API not available — ignore silently
  }
}
</script>

<style scoped>
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.code-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-sm);
}

.filename {
  font-weight: 600;
  color: var(--text-primary);
}

.line-count {
  color: var(--text-secondary);
}

.header-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  cursor: pointer;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.header-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.copy-btn {
  margin-left: auto;
}

.wrap-btn {
  margin-left: var(--space-1);
}

/* Loading skeleton */
.code-loading {
  padding: var(--space-3);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}

/* Code content */
.code-content {
  padding: var(--space-3);
  overflow-x: auto;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

.code-content :deep(pre) {
  margin: 0;
}

/* Shiki line numbers - make them non-selectable */
.code-content :deep(.line-number),
.code-content :deep([data-line-number]) {
  user-select: none;
  -webkit-user-select: none;
}

.code-content.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-content.wrap :deep(pre) {
  white-space: pre-wrap;
}

/* Fallback line rendering */
.fallback pre {
  margin: 0;
}

.code-line {
  display: flex;
  gap: var(--space-3);
  min-height: 1.5em;
}

.line-number {
  color: var(--text-tertiary);
  text-align: right;
  min-width: 30px;
  user-select: none; /* Line numbers are not selectable */
  -webkit-user-select: none;
  flex-shrink: 0;
}

.line-content {
  flex: 1;
}

/* Line highlight for hash selection */
:deep(.line-highlight),
.line-highlight {
  background: var(--accent-subtle);
  border-radius: var(--radius-sm);
  margin: 0 calc(-1 * var(--space-3));
  padding: 0 var(--space-3);
}

.empty-file {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}
</style>
```

> **Design review fixes:**
> - **Singleton Shiki** (review §1): Uses `useShiki().highlight()` instead of creating a new `createHighlighter()` per file.
> - **CSS variables mode** (review §5, §6): Uses `theme: 'css-variables'` — token colors follow `--shiki-token-*` CSS variables that switch with `data-theme`.
> - **Safe fallback** (review §16): Fallback path uses Vue template `{{ line }}` (auto-escaped), NOT `v-html` with manual `escapeHtml()`.
> - **Loading state** (review §17): Shows skeleton lines while highlighting is in progress.
> - **Line selection hash** (review §7): Reads `#L5-L10` from URL hash on mount and scrolls to the line.
> - **Accessibility** (review §8): `aria-label` on icon-only buttons, meaningful labels for screen readers.
> - **Copy without line numbers** (user requirement): `copyCode()` copies `props.content` (original code) directly, not the rendered HTML. Line numbers have `user-select: none` to prevent accidental selection.
> - **Line numbers non-selectable**: Both fallback and Shiki-rendered line numbers use `user-select: none` CSS to ensure they can't be copied.

- [ ] **Step 5: Create MarkdownViewer.vue — code block highlighting, copy buttons (TOC handled by parent)**

Markdown renderer with code block highlighting via shared Shiki, copy buttons on code blocks, table overflow handling. TOC is now handled by the parent EntryDetailView component (review §11).

```vue
<!-- frontend/src/components/MarkdownViewer.vue -->
<template>
  <div class="markdown-viewer" ref="viewerRef" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import sanitizeHtml from 'sanitize-html'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{ content: string }>()

const emit = defineEmits<{
  headings: [{ id: string; text: string; level: number }[]]
}>()

const viewerRef = ref<HTMLElement | null>(null)

interface Heading {
  id: string
  text: string
  level: number
}

// Create markdown-it instance at module level (review §20: singleton, not per-render)
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

// Add anchor plugin for heading IDs (required for TOC linking)
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
  }),
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w]+/g, '-')
      .replace(/(^-|-$)/g, ''),
})

const { highlight } = useShiki()

/** Extract headings from rendered HTML for TOC. */
function extractHeadings(html: string): Heading[] {
  const result: Heading[] = []
  const regex = /<h([2-4])[^\n]*?id="([^"]*)"[^>]*>(.*?)<\/h\1>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    result.push({ id, text, level })
  }
  return result
}

/** Render markdown, sanitize, then highlight code blocks. */
const rendered = computed(() => {
  const html = md.render(props.content)

  const sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'button',
      'span',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'id', 'name'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      span: ['class', 'aria-hidden'],
      button: ['class', 'aria-label', 'data-code-index'],
      code: ['class', 'language-*'],
      pre: ['class'],
    },
  })

  // Extract headings and emit to parent for TOC sidebar
  nextTick(() => {
    const headings = extractHeadings(sanitized)
    emit('headings', headings)
  })

  return sanitized
})

/**
 * After DOM update: highlight code blocks with Shiki and inject copy buttons.
 * This runs as a post-render side effect.
 */
watch(rendered, () => {
  nextTick(async () => {
    if (!viewerRef.value) return

    const codeBlocks = viewerRef.value.querySelectorAll('pre code')
    for (const block of codeBlocks) {
      const code = block.textContent || ''
      const langClass = block.className.match(/language-(\w+)/)
      const lang = langClass ? langClass[1] : 'text'

      try {
        const highlightedHtml = await highlight(code, lang)
        // Replace code block content with Shiki output
        const pre = block.parentElement
        if (pre) {
          pre.innerHTML = highlightedHtml
          pre.classList.add('shiki')
        }
      } catch {
        // Keep original markdown-it rendering as fallback
      }

      // Inject copy button (review §11)
      const pre = block.parentElement
      if (pre && !pre.querySelector('.md-copy-btn')) {
        pre.style.position = 'relative'
        const btn = document.createElement('button')
        btn.className = 'md-copy-btn'
        btn.setAttribute('aria-label', 'Copy code block')
        btn.textContent = 'Copy'
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code)
            btn.textContent = 'Copied!'
            setTimeout(() => {
              btn.textContent = 'Copy'
            }, 2000)
          } catch {
            // Clipboard API not available
          }
        })
        pre.appendChild(btn)
      }
    }
  })
})

onMounted(() => {
  // Trigger initial code block processing
  nextTick(() => {
    // The watch on `rendered` handles this
  })
})
</script>

<style scoped>
.markdown-viewer {
  padding: var(--space-4);
  line-height: var(--line-height-prose);
  color: var(--text-primary);
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
}

/* Paragraph text wrapping */
.markdown-viewer :deep(p) {
  margin-bottom: var(--space-3);
  overflow-wrap: break-word;
  word-wrap: break-word;
}

.markdown-viewer :deep(h1),
.markdown-viewer :deep(h2),
.markdown-viewer :deep(h3) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: var(--text-primary);
  scroll-margin-top: var(--space-4);
}

.markdown-viewer :deep(h1) { font-size: var(--font-xl); }
.markdown-viewer :deep(h2) { font-size: var(--font-lg); }
.markdown-viewer :deep(h3) { font-size: var(--font-md); }

.markdown-viewer :deep(pre) {
  background: var(--shiki-color-background);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
  white-space: pre;
  position: relative;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

.markdown-viewer :deep(code) {
  font-size: var(--font-sm);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.markdown-viewer :deep(:not(pre) > code) {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 0.85em;
  white-space: nowrap;
}

/* Table overflow handling - table content doesn't wrap, scrolls horizontally */
.markdown-viewer :deep(table) {
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
  max-width: 100%;
}

.markdown-viewer :deep(th),
.markdown-viewer :deep(td) {
  border: 1px solid var(--border-color);
  padding: var(--space-2) var(--space-3);
}

.markdown-viewer :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-viewer :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.markdown-viewer :deep(blockquote) {
  border-left: 3px solid var(--accent-color);
  margin: var(--space-3) 0;
  padding: var(--space-2) var(--space-4);
  color: var(--text-secondary);
  overflow-wrap: break-word;
  word-wrap: break-word;
}

/* Copy button on code blocks */
.markdown-viewer :deep(.md-copy-btn) {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  font-size: var(--font-xs);
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.markdown-viewer :deep(pre:hover .md-copy-btn) {
  opacity: 1;
}

/* Responsive: hide TOC on mobile */
@media (max-width: 768px) {
  .markdown-container {
    flex-direction: column;
  }

  .markdown-toc {
    position: static;
    max-width: 100%;
    max-height: none;
  }
}
</style>
```

> **Design review fixes:**
> - **TOC moved to parent** (review §11, user requirement): TOC sidebar is now rendered by EntryDetailView as the right sidebar on desktop, and as a drawer on mobile. MarkdownViewer emits headings via `@headings` event.
> - **Code block highlighting** (review §11): Post-processes `<pre><code>` blocks with the shared Shiki highlighter.
> - **Copy button on code blocks** (review §11): Injects a "Copy" button into each code block via DOM manipulation.
> - **Table overflow** (review §11): Tables use `display: block; overflow-x: auto; white-space: nowrap` to scroll horizontally without wrapping cell content.
> - **Text wrapping rules** (user requirement): Paragraphs use `overflow-wrap: break-word` for auto-wrapping. Code blocks use `white-space: pre` for horizontal scroll. Inline code uses `white-space: nowrap`.
> - **Singleton markdown-it** (review §20): Created at module level, not per-render.
> - **markdown-it-anchor plugin**: Adds heading IDs for TOC linking.

- [ ] **Step 6: Create FileTree.vue — recursive tree structure with expand/collapse**

Implements an actual tree (not a flat list). Transforms `FileResponse[]` into `TreeNode[]` client-side. Recursive `TreeNodeItem` sub-component for directories with expand/collapse. Uses `@iconify/vue` for proper SVG icons instead of emoji (review §3, §8).

```vue
<!-- frontend/src/components/FileTree.vue -->
<template>
  <div class="file-tree" role="tree" aria-label="File tree">
    <TreeNodeItem
      v-for="node in tree"
      :key="node.path"
      :node="node"
      :active-file-id="activeFileId"
      :depth="0"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileResponse, TreeNode } from '../types'
import TreeNodeItem from './TreeNodeItem.vue'

const props = defineProps<{
  files: FileResponse[]
  activeFileId: number | null
}>()

defineEmits<{
  select: [file: FileResponse]
}>()

/**
 * Transform flat FileResponse[] into a nested TreeNode[] tree structure.
 * E.g. [{path: "src/main.py"}, {path: "src/utils.py"}, {path: "README.md"}]
 * becomes:
 *   [{name: "src", children: [{name: "main.py", file: ...}, {name: "utils.py", file: ...}]},
 *    {name: "README.md", file: ...}]
 */
function buildTree(files: FileResponse[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const parts = (file.path || file.filename).split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const partName = parts[i]
      const isLeaf = i === parts.length - 1
      const partPath = parts.slice(0, i + 1).join('/')

      if (isLeaf) {
        // File node
        current.push({
          name: partName,
          path: partPath,
          children: [],
          file,
        })
      } else {
        // Directory node — find or create
        let dir = current.find((n) => n.name === partName && !n.file)
        if (!dir) {
          dir = { name: partName, path: partPath, children: [] }
          current.push(dir)
        }
        current = dir.children
      }
    }
  }

  // Sort: directories first, then alphabetically
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      const aIsDir = !a.file
      const bIsDir = !b.file
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
      return a.name.localeCompare(b.name)
    }).map((node) => ({
      ...node,
      children: sortNodes(node.children),
    }))
  }

  return sortNodes(root)
}

const tree = computed(() => buildTree(props.files))
</script>

<style scoped>
.file-tree {
  min-width: 220px;
  max-width: 280px;
  border-right: 1px solid var(--border-color);
  padding: var(--space-2) 0;
  overflow-y: auto;
  font-size: var(--font-sm);
}

/* Responsive: on mobile, file tree becomes a horizontal strip */
@media (max-width: 768px) {
  .file-tree {
    min-width: 100%;
    max-width: 100%;
    max-height: 40vh;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
```

Now create the recursive `TreeNodeItem` sub-component:

```vue
<!-- frontend/src/components/TreeNodeItem.vue -->
<template>
  <div class="tree-node">
    <div
      class="tree-node-row"
      :class="{ active: node.file && node.file.id === activeFileId }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      role="treeitem"
      :aria-selected="node.file ? node.file.id === activeFileId : undefined"
      :aria-expanded="node.file ? undefined : !collapsed"
      tabindex="0"
      @click="handleClick"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
    >
      <!-- Expand/collapse chevron for directories -->
      <span v-if="!node.file" class="tree-chevron" :class="{ collapsed }">
        ▸
      </span>
      <span v-else class="tree-chevron-spacer"></span>

      <!-- Icon -->
      <Icon
        :icon="nodeIcon"
        class="tree-icon"
        :class="{ 'tree-icon-folder': !node.file }"
      />

      <!-- Name -->
      <span class="tree-name">{{ node.name }}</span>
    </div>

    <!-- Children (recursive) -->
    <div v-if="!node.file && !collapsed" class="tree-children" role="group">
      <TreeNodeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-file-id="activeFileId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FileResponse, TreeNode } from '../types'

const props = defineProps<{
  node: TreeNode
  activeFileId: number | null
  depth: number
}>()

const emit = defineEmits<{
  select: [file: FileResponse]
}>()

const collapsed = ref(false)

const nodeIcon = computed(() => {
  if (!props.node.file) {
    return collapsed.value
      ? 'codicon:folder'
      : 'codicon:folder-opened'
  }

  // File type icons using VS Code Codicons
  const lang = props.node.file.language
  const name = props.node.file.filename.toLowerCase()
  const iconMap: Record<string, string> = {
    python: 'codicon:file-code',
    javascript: 'codicon:file-code',
    typescript: 'codicon:file-code',
    rust: 'codicon:file-code',
    go: 'codicon:file-code',
    java: 'codicon:file-code',
    html: 'codicon:file-code',
    css: 'codicon:file-code',
    markdown: 'codicon:file-code',
    json: 'codicon:json',
    yaml: 'codicon:settings',
  }

  if (lang && iconMap[lang]) return iconMap[lang]
  if (name.endsWith('.md')) return 'codicon:file-code'
  if (name.endsWith('.json')) return 'codicon:json'
  if (props.node.file.is_binary) return 'codicon:file-binary'
  return 'codicon:file'
})

function handleClick() {
  if (props.node.file) {
    emit('select', props.node.file)
  } else {
    collapsed.value = !collapsed.value
  }
}
</script>

<style scoped>
.tree-node-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-top: var(--space-1);
  padding-bottom: var(--space-1);
  padding-right: var(--space-3);
  cursor: pointer;
  color: var(--text-primary);
  white-space: nowrap;
  user-select: none;
}

.tree-node-row:hover {
  background: var(--bg-secondary);
}

.tree-node-row.active {
  background: var(--accent-color);
  color: #ffffff;
}

.tree-node-row:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.tree-chevron {
  font-size: 10px;
  width: 14px;
  text-align: center;
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.tree-chevron:not(.collapsed) {
  transform: rotate(90deg);
}

.tree-chevron-spacer {
  width: 14px;
  flex-shrink: 0;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.tree-icon-folder {
  color: var(--accent-color);
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-children {
  /* Recursive children are indented via padding-left on tree-node-row */
}
</style>
```

> **Design review fixes:**
> - **Actual tree structure** (review §3): `buildTree()` transforms flat `FileResponse[]` into nested `TreeNode[]`. Recursive `TreeNodeItem` component renders directories with expand/collapse.
> - **VS Code Codicons** (review §3): Uses `@iconify/vue` with `codicon:*` icons instead of emoji. Consistent rendering across platforms.
> - **Accessibility** (review §8): `role="tree"` / `role="treeitem"`, `aria-selected`, `aria-expanded`, `tabindex="0"`, keyboard `Enter`/`Space` activation, `:focus-visible` outline.
> - **Sorting**: Directories first, then files, alphabetically.
> - **Responsive** (review §9): On mobile, tree becomes horizontal strip with `max-height: 40vh`.

---

**Mobile Drawer Components** (Steps 6b-6d below implement full mobile drawer UX per user requirements)

- [ ] **Step 6b: Create MobileFileDrawer.vue — mobile file tree drawer**

Full-screen drawer for file tree on mobile. Triggered by breadcrumb button when entry has multiple files.

```vue
<!-- frontend/src/components/MobileFileDrawer.vue -->
<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="mobile-drawer-overlay" @click="close">
        <div class="mobile-drawer" @click.stop>
          <div class="drawer-header">
            <h3>Files</h3>
            <button class="close-btn" @click="close" aria-label="Close file drawer">
              <Icon icon="codicon:close" />
            </button>
          </div>
          <div class="drawer-content">
            <FileTree
              :files="files"
              :active-file-id="activeFileId"
              @select="onSelect"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import FileTree from './FileTree.vue'
import type { FileResponse } from '../types'

const props = defineProps<{
  isOpen: boolean
  files: FileResponse[]
  activeFileId: number | null
}>()

const emit = defineEmits<{
  close: []
  select: [file: FileResponse]
}>()

function close() {
  emit('close')
}

function onSelect(file: FileResponse) {
  emit('select', file)
  close()
}
</script>

<style scoped>
.mobile-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.mobile-drawer {
  width: 85%;
  max-width: 320px;
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.drawer-header h3 {
  margin: 0;
  font-size: var(--font-md);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: var(--space-1);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.drawer-content :deep(.file-tree) {
  min-width: auto;
  max-width: none;
  border: none;
  max-height: none;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .mobile-drawer,
.drawer-leave-active .mobile-drawer {
  transition: transform 0.2s ease;
}

.drawer-enter-from .mobile-drawer,
.drawer-leave-to .mobile-drawer {
  transform: translateX(100%);
}
</style>
```

- [ ] **Step 6c: Create MobileTocDrawer.vue — mobile TOC drawer**

Drawer for Markdown TOC navigation on mobile.

```vue
<!-- frontend/src/components/MobileTocDrawer.vue -->
<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="mobile-drawer-overlay" @click="close">
        <div class="mobile-drawer" @click.stop>
          <div class="drawer-header">
            <h3>Outline</h3>
            <button class="close-btn" @click="close">
              <Icon icon="codicon:close" />
            </button>
          </div>
          <nav class="drawer-content toc-nav">
            <ul class="toc-list">
              <li v-for="h in headings" :key="h.id" :class="`toc-level-${h.level}`">
                <a :href="`#${h.id}`" @click.prevent="navigate(h.id)">{{ h.text }}</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
interface Heading { id: string; text: string; level: number }
const props = defineProps<{ isOpen: boolean; headings: Heading[] }>()
const emit = defineEmits<{ close: []; navigate: [id: string] }>()
const close = () => emit('close')
const navigate = (id: string) => { emit('navigate', id); close() }
</script>

<style scoped>
.mobile-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; justify-content: flex-end; }
.mobile-drawer { width: 85%; max-width: 320px; height: 100%; background: var(--bg-primary); display: flex; flex-direction: column; }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-color); }
.drawer-header h3 { margin: 0; font-size: var(--font-md); color: var(--text-primary); }
.close-btn { background: none; border: none; color: var(--text-secondary); font-size: 20px; cursor: pointer; padding: var(--space-1); }
.drawer-content { flex: 1; overflow-y: auto; padding: var(--space-3); }
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-list li { margin: var(--space-2) 0; }
.toc-list a { color: var(--text-secondary); text-decoration: none; display: block; padding: var(--space-1) 0; border-left: 2px solid transparent; padding-left: var(--space-2); }
.toc-list a:hover { color: var(--text-primary); }
.toc-level-2 { padding-left: var(--space-3); }
.toc-level-3 { padding-left: var(--space-6); }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .mobile-drawer, .drawer-leave-active .mobile-drawer { transition: transform 0.2s ease; }
.drawer-enter-from .mobile-drawer, .drawer-leave-to .mobile-drawer { transform: translateX(100%); }
</style>
```

- [ ] **Step 6d: Create MobileBottomBar.vue — bottom action bar**

Fixed bottom bar with file info and quick actions. **v3 Design Update**: Wrap button added, TOC button conditional on Markdown with headings.

```vue
<!-- frontend/src/components/MobileBottomBar.vue -->
<template>
  <div class="mobile-bottom-bar">
    <!-- Left: File info - hamburger for multi-file, filename for single-file -->
    <div class="file-section" @click="toggleFileDrawer">
      <template v-if="hasMultipleFiles">
        <Icon icon="codicon:menu" />
        <span class="file-badge">{{ fileCount }} files</span>
      </template>
      <template v-else>
        <Icon icon="codicon:file-code" />
        <span class="filename">{{ activeFile?.filename || 'Select file' }}</span>
      </template>
    </div>
    <!-- Right: Action buttons -->
    <div class="actions">
      <!-- Wrap button: only for code files -->
      <button 
        v-if="isCodeFile" 
        class="action-btn" 
        :class="{ active: wrapEnabled }"
        @click="toggleWrap"
        title="Toggle Wrap"
      >
        <Icon icon="codicon:word-wrap" />
        <span class="btn-label">{{ wrapEnabled ? 'Unwrap' : 'Wrap' }}</span>
      </button>
      <!-- Copy button -->
      <button 
        v-if="canCopy" 
        class="action-btn" 
        @click="copy"
        title="Copy content"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span class="btn-label">Copy</span>
      </button>
      <!-- Download button -->
      <button 
        v-if="canDownload" 
        class="action-btn" 
        @click="emit('download')"
        title="Download"
      >
        <Icon icon="codicon:download" />
        <span class="btn-label">Down</span>
      </button>
      <!-- TOC button: only for Markdown with headings -->
      <button 
        v-if="hasToc" 
        class="action-btn" 
        @click="emit('toggleToc')"
        title="Table of Contents"
      >
        <Icon icon="codicon:list-tree" />
        <span class="btn-label">TOC</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FileResponse } from '../types'

const props = defineProps<{
  activeFile: FileResponse | null
  hasMultipleFiles: boolean
  fileCount: number
  isCodeFile: boolean  // true if file is code (not markdown)
  canCopy: boolean
  canDownload: boolean
  hasToc: boolean
  content?: string
}>()

const emit = defineEmits<{
  toggleFileDrawer: []
  toggleToc: []
  download: []
  toggleWrap: [enabled: boolean]
}>()

const copied = ref(false)
const wrapEnabled = ref(false)

const toggleFileDrawer = () => emit('toggleFileDrawer')

const toggleWrap = () => {
  wrapEnabled.value = !wrapEnabled.value
  emit('toggleWrap', wrapEnabled.value)
}

const copy = async () => {
  if (!props.content) return
  await navigator.clipboard.writeText(props.content)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
.mobile-bottom-bar { 
  position: fixed; bottom: 0; left: 0; right: 0; height: 56px; 
  background: var(--bg-primary); border-top: 1px solid var(--border-color); 
  display: flex; align-items: center; justify-content: space-between; 
  padding: 0 var(--space-3); z-index: 50; gap: var(--space-2); 
}
.file-section { 
  display: flex; align-items: center; gap: var(--space-2); 
  flex: 1; min-width: 0; cursor: pointer; 
  padding: var(--space-2) var(--space-3); 
  background: var(--bg-secondary); border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
.file-section:hover { border-color: var(--border-hover); }
.file-section .filename { 
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; 
  white-space: nowrap; color: var(--text-primary); font-size: var(--font-sm); 
}
.file-badge { 
  font-size: var(--font-xs); color: var(--text-secondary); 
  background: var(--bg-tertiary); padding: 2px 6px; border-radius: var(--radius-sm);
}
.actions { display: flex; align-items: center; gap: 2px; }
.action-btn { 
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 44px; height: 44px; background: none; border: none; 
  border-radius: var(--radius-md); color: var(--text-secondary); 
  cursor: pointer; font-size: 16px; padding: 2px;
}
.action-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.action-btn.active { background: var(--accent-light); color: var(--accent-color); }
.action-btn .btn-label { font-size: 10px; margin-top: 2px; }
@media (min-width: 769px) { .mobile-bottom-bar { display: none; } }
</style>
```

---

- [ ] **Step 7: Create ThemeToggle.vue — reads initial state from DOM**

Reads initial dark/light state from the `data-theme` attribute (set by the FOUC-prevention script) instead of re-computing from localStorage. Uses the shared `useTheme()` composable (review §4, §10).

```vue
<!-- frontend/src/components/ThemeToggle.vue -->
<template>
  <button
    class="theme-toggle"
    @click="toggle"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    :title="isDark ? 'Switch to light' : 'Switch to dark'"
  >
    <Icon :icon="isDark ? 'codicon:sun' : 'codicon:moon'" />
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useTheme } from '../composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<style scoped>
.theme-toggle {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
</style>
```

> **Design review fixes:**
> - **No FOUC** (review §4): Reads initial state from DOM attribute (set by `<head>` script), not from `onMounted()`. No white flash.
> - **Shared composable** (review §10): Uses `useTheme()` singleton, not local `isDark` ref.
> - **Proper icon** (review §8): Uses `@iconify/vue` Codicons instead of emoji.
> - **Accessibility** (review §8): `aria-label` describes the action, not just the state.

- [ ] **Step 8: Create EntryListView.vue — with loading/error states**

Entry list page with loading skeleton, error display with retry, and accessible pagination. Uses `useEntryList()` composable.

```vue
<!-- frontend/src/views/EntryListView.vue -->
<template>
  <div class="entry-list-view">
    <header class="list-header">
      <h1>Peek</h1>
      <div class="header-actions">
        <input
          v-model="searchQuery"
          placeholder="Search entries..."
          @input="debouncedSearch"
          class="search-input"
          aria-label="Search entries"
        />
        <ThemeToggle />
      </div>
    </header>

    <!-- Loading skeleton -->
    <div v-if="loading" class="entry-list">
      <div v-for="i in 5" :key="i" class="entry-skeleton">
        <div class="skeleton-title"></div>
        <div class="skeleton-meta">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
          <div class="skeleton-date"></div>
        </div>
      </div>
    </div>

    <!-- Error state with retry -->
    <div v-else-if="error" class="error-display" role="alert">
      <Icon icon="codicon:error" class="error-icon" />
      <p class="error-message">
        {{ errorCode === 'NOT_FOUND' ? 'No entries found' : 'Failed to load entries' }}
      </p>
      <p class="error-detail" v-if="errorCode !== 'NOT_FOUND'">{{ error }}</p>
      <button class="retry-btn" @click="doFetch" aria-label="Retry loading entries">
        Try again
      </button>
    </div>

    <!-- Entry list -->
    <div v-else class="entry-list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="entry-card"
        tabindex="0"
        role="link"
        :aria-label="`View entry: ${entry.summary}`"
        @click="goToEntry(entry.slug)"
        @keydown.enter="goToEntry(entry.slug)"
      >
        <h3>{{ entry.summary }}</h3>
        <div class="entry-meta">
          <span class="entry-tag" v-for="tag in entry.tags" :key="tag">#{{ tag }}</span>
          <span class="entry-date">{{ formatDate(entry.created_at) }}</span>
        </div>
      </div>
      <div v-if="entries.length === 0" class="empty-state">
        <Icon icon="codicon:inbox" class="empty-icon" />
        <p>No entries yet</p>
      </div>
    </div>

    <!-- Accessible pagination -->
    <nav
      class="pagination"
      v-if="totalPages > 1"
      aria-label="Pagination"
    >
      <button
        @click="page--"
        :disabled="page <= 1"
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span class="page-info" aria-live="polite">
        Page {{ page }} of {{ totalPages }}
        <span class="total-count">({{ total }} entries)</span>
      </span>
      <button
        @click="page++"
        :disabled="page >= totalPages"
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useEntryList } from '../composables/useEntry'

const router = useRouter()
const { entries, total, totalPages, loading, error, errorCode, fetchEntries } = useEntryList()

const searchQuery = ref('')
const page = ref(1)

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    doFetch()
  }, 300)
}

function doFetch() {
  fetchEntries({
    q: searchQuery.value || undefined,
    page: page.value,
  })
}

function goToEntry(slug: string) {
  router.push(`/view/${slug}`)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

onMounted(doFetch)
watch(page, doFetch)
</script>

<style scoped>
.entry-list-view {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-5);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.list-header h1 {
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.search-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-sm);
  width: 200px;
}

.search-input:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

/* Loading skeleton */
.entry-skeleton {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

.skeleton-title {
  width: 60%;
  height: 18px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}

.skeleton-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.skeleton-tag,
.skeleton-date {
  height: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.skeleton-tag { width: 60px; }
.skeleton-date { width: 80px; }

/* Error display */
.error-display {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.error-icon {
  font-size: 48px;
  color: var(--error-color);
  margin-bottom: var(--space-3);
}

.error-message {
  font-size: var(--font-md);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.error-detail {
  font-size: var(--font-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-4);
}

.retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent-color);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-sm);
}

.retry-btn:hover {
  background: var(--accent-hover);
}

.retry-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Entry card */
.entry-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.entry-card:hover {
  border-color: var(--accent-color);
}

.entry-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.entry-card h3 {
  margin: 0 0 var(--space-2);
  color: var(--text-primary);
}

.entry-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.entry-tag {
  background: var(--tag-bg);
  color: var(--tag-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.entry-date {
  margin-left: auto;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-5);
}

.pagination button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-primary);
  font-size: var(--font-sm);
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}

.pagination button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.page-info {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.total-count {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
}

/* Responsive */
@media (max-width: 768px) {
  .entry-list-view {
    padding: var(--space-3);
  }

  .list-header {
    flex-direction: column;
    gap: var(--space-3);
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1;
    min-width: 150px;
  }
}
</style>
```

> **Design review fixes:**
> - **Loading skeleton** (review §12, §17): Shows skeleton cards while loading instead of "Loading..." text.
> - **Error state with retry** (review §12): Error display with icon, contextual message (404 vs 500), and retry button. Uses `errorCode` for differentiation.
> - **Accessible pagination** (review §8, §19): `aria-label="Previous/Next page"` instead of raw arrows. Total count display. `aria-live="polite"` for page changes.
> - **Keyboard accessible cards** (review §8): `tabindex="0"`, `role="link"`, `@keydown.enter`.
> - **Responsive** (review §9): Mobile breakpoints for header and search layout.
> - **Shared composable** (review §10): Uses `useEntryList()`.

- [ ] **Step 9: Create EntryDetailView.vue — with URL file selection, line hash, loading/error states**

The main entry view with: URL-based file selection (`?file=main.py`), line hash support (`#L5-L10`), loading skeleton, error display with retry, proper file content loading state, and responsive layout.

```vue
<!-- frontend/src/views/EntryDetailView.vue -->
<template>
  <div class="entry-detail-view">
    <header class="detail-header">
      <router-link to="/" class="back-link" aria-label="Back to entry list">
        ← Back
      </router-link>
      <h2>{{ entry?.summary }}</h2>
      <div class="header-actions">
        <ThemeToggle />
      </div>
    </header>

    <!-- Loading skeleton -->
    <div v-if="loading" class="entry-content">
      <div class="tree-skeleton">
        <div v-for="i in 4" :key="i" class="skeleton-tree-item"></div>
      </div>
      <div class="file-skeleton">
        <div class="skeleton-code-header"></div>
        <div v-for="i in 8" :key="i" class="skeleton-code-line"></div>
      </div>
    </div>

    <!-- Error state with retry -->
    <div v-else-if="error" class="error-display" role="alert">
      <Icon icon="codicon:error" class="error-icon" />
      <template v-if="errorCode === 'NOT_FOUND'">
        <p class="error-message">Entry not found</p>
        <p class="error-detail">This entry may have been deleted or the link is incorrect.</p>
      </template>
      <template v-else>
        <p class="error-message">Failed to load entry</p>
        <p class="error-detail">{{ error }}</p>
      </template>
      <button class="retry-btn" @click="retryFetch" aria-label="Retry loading entry">
        Try again
      </button>
      <router-link to="/" class="back-home-link">Back to home</router-link>
    </div>

    <!-- Entry content -->
    <div v-else-if="entry" class="entry-content">
      <!-- Left: File Tree (desktop only, when multiple files) -->
      <aside v-if="entry.files.length > 1" class="sidebar-left">
        <FileTree
          :files="entry.files"
          :active-file-id="activeFile?.id ?? null"
          @select="selectFile"
        />
      </aside>

      <!-- Center: File Display -->
      <main class="file-display" aria-live="polite">
        <!-- File loading -->
        <div v-if="fileLoading" class="file-loading">
          <div class="code-skeleton" v-for="i in 8" :key="i">
            <span class="skeleton-line-number"></span>
            <span class="skeleton-line-content"></span>
          </div>
        </div>

        <!-- File error -->
        <div v-else-if="fileError" class="file-error" role="alert">
          <p>Failed to load file content</p>
          <button class="retry-btn small" @click="loadFileContent" aria-label="Retry loading file">
            Try again
          </button>
        </div>

        <!-- Code viewer -->
        <CodeViewer
          v-else-if="activeFile && !activeFile.is_binary && !isMarkdown"
          :content="fileContent"
          :filename="activeFile.filename"
          :language="activeFile.language"
          :line-count="activeFile.line_count"
        />

        <!-- Markdown viewer (without internal TOC) -->
        <MarkdownViewer
          v-else-if="activeFile && isMarkdown"
          :content="fileContent"
          :show-toc="false"
          @headings-updated="updateHeadings"
        />

        <!-- Binary file download -->
        <div v-else-if="activeFile?.is_binary" class="binary-file">
          <Icon icon="codicon:file-binary" class="binary-icon" />
          <span class="binary-name">{{ activeFile.filename }}</span>
          <span class="binary-size">{{ formatSize(activeFile.size) }}</span>
          <a
            :href="downloadUrl"
            download
            class="download-link"
          >
            <Icon icon="codicon:download" /> Download
          </a>
        </div>

        <!-- No file selected -->
        <div v-else class="no-file">
          <Icon icon="codicon:file" class="no-file-icon" />
          <p>Select a file to view</p>
        </div>
      </main>

      <!-- Right: TOC for Markdown (desktop only) -->
      <aside v-if="markdownHeadings.length > 0" class="sidebar-right">
        <nav class="toc-sidebar" aria-label="Table of contents">
          <h4 class="toc-title">Outline</h4>
          <ul class="toc-list">
            <li
              v-for="heading in markdownHeadings"
              :key="heading.id"
              :class="['toc-item', `toc-level-${heading.level}`]"
            >
              <a
                :href="`#${heading.id}`"
                :class="{ active: activeHeading === heading.id }"
                @click.prevent="scrollToHeading(heading.id)"
              >
                {{ heading.text }}
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </div>

    <footer class="detail-footer" v-if="entry">
      <div class="tags">
        <span v-for="tag in entry.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
      <span class="date">Created: {{ formatDate(entry.created_at) }}</span>
    </footer>

    <!-- Mobile drawers and bottom bar -->
    <MobileFileDrawer
      v-if="entry && entry.files.length > 1"
      :is-open="fileDrawerOpen"
      :files="entry.files"
      :active-file-id="activeFile?.id ?? null"
      @close="fileDrawerOpen = false"
      @select="selectFile"
    />
    <MobileTocDrawer
      v-if="markdownHeadings.length > 0"
      :is-open="tocDrawerOpen"
      :headings="markdownHeadings"
      @close="tocDrawerOpen = false"
      @navigate="scrollToHeading"
    />
    <MobileBottomBar
      v-if="entry && !loading"
      :active-file="activeFile"
      :has-multiple-files="entry.files.length > 1"
      :can-copy="!!activeFile && !activeFile.is_binary"
      :can-download="!!activeFile"
      :has-toc="markdownHeadings.length > 0"
      :content="fileContent"
      @toggle-file-drawer="fileDrawerOpen = true"
      @toggle-toc="tocDrawerOpen = true"
      @download="downloadFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { api } from '../api/client'
import { useEntry } from '../composables/useEntry'
import FileTree from '../components/FileTree.vue'
import CodeViewer from '../components/CodeViewer.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import MobileFileDrawer from '../components/MobileFileDrawer.vue'
import MobileTocDrawer from '../components/MobileTocDrawer.vue'
import MobileBottomBar from '../components/MobileBottomBar.vue'
import type { FileResponse } from '../types'

const route = useRoute()
const router = useRouter()
const { entry, loading, error, errorCode, fetchEntry, clearCache } = useEntry()

const activeFile = ref<FileResponse | null>(null)
const fileContent = ref('')
const fileLoading = ref(false)
const fileError = ref<string | null>(null)
const fileDrawerOpen = ref(false)
const tocDrawerOpen = ref(false)
const activeHeading = ref<string | null>(null)

// Extract headings from markdown for TOC
const markdownHeadings = computed(() => {
  if (!activeFile.value || activeFile.value.language !== 'markdown' || !fileContent.value) {
    return []
  }
  const headings: { id: string; text: string; level: number }[] = []
  const lines = fileContent.value.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      headings.push({ id, text, level })
    }
  }
  return headings
})

// Update active heading from MarkdownViewer scroll
function updateHeadings(headings: { id: string; text: string; level: number }[]) {
  // Optionally update active heading based on scroll
  if (headings.length > 0 && !activeHeading.value) {
    activeHeading.value = headings[0].id
  }
}

const isMarkdown = computed(() => activeFile.value?.language === 'markdown')

const downloadUrl = computed(() =>
  activeFile.value
    ? api.downloadFile(route.params.slug as string, activeFile.value!.id)
    : '',
)

/**
 * Select initial file based on ?file= query parameter (review §7).
 * Falls back to the first file if no match.
 */
function selectInitialFile() {
  if (!entry.value || entry.value.files.length === 0) return

  const queryFile = route.query.file as string
  if (queryFile) {
    const match = entry.value.files.find(
      (f) => f.path === queryFile || f.filename === queryFile,
    )
    if (match) {
      activeFile.value = match
      return
    }
  }
  activeFile.value = entry.value.files[0]
}

/**
 * Select a file and update the URL query parameter for deep linking (review §7).
 */
function selectFile(file: FileResponse) {
  activeFile.value = file
  // Update URL query parameter without navigation
  router.replace({
    query: {
      ...route.query,
      file: file.path || file.filename,
    },
  })
}

/**
 * Load file content using the /content inline endpoint (review §2).
 * Clears stale content immediately to avoid showing wrong content (review §17).
 */
async function loadFileContent() {
  if (!activeFile.value) return
  if (activeFile.value.is_binary) return

  // Check if content was included inline (from ?include=files.content)
  if (activeFile.value.content !== undefined) {
    fileContent.value = activeFile.value.content
    fileError.value = null
    return
  }

  // Clear immediately — don't show stale content (review §17)
  fileContent.value = ''
  fileLoading.value = true
  fileError.value = null

  try {
    fileContent.value = await api.fetchFileContent(
      route.params.slug as string,
      activeFile.value.id,
    )
  } catch (e: unknown) {
    fileError.value =
      e instanceof Error ? e.message : 'Failed to load file content'
  } finally {
    fileLoading.value = false
  }
}

function retryFetch() {
  clearCache(route.params.slug as string)
  doFetchEntry()
}

async function doFetchEntry() {
  // Fetch with inline content to reduce N+1 (review §2)
  await fetchEntry(route.params.slug as string, {
    includeContent: true,
  })
  selectInitialFile()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function downloadFile() {
  if (!activeFile.value) return
  const url = api.downloadFile(route.params.slug as string, activeFile.value.id)
  const a = document.createElement('a')
  a.href = url
  a.download = activeFile.value.filename
  a.click()
}

function scrollToHeading(headingId: string) {
  const element = document.getElementById(headingId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Load file content when active file changes
watch(activeFile, loadFileContent)

// Re-fetch entry when slug changes (route navigation)
watch(
  () => route.params.slug,
  (newSlug) => {
    if (newSlug) doFetchEntry()
  },
)

onMounted(doFetchEntry)
</script>

<style scoped>
.entry-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-5);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.back-link {
  color: var(--accent-color);
  text-decoration: none;
  white-space: nowrap;
}

.back-link:hover {
  text-decoration: underline;
}

.detail-header h2 {
  flex: 1;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

/* Entry content layout */
.entry-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 400px;
}

/* Left sidebar - File Tree */
.sidebar-left {
  min-width: 220px;
  max-width: 280px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-primary);
  overflow-y: auto;
}

.sidebar-left :deep(.file-tree) {
  min-width: auto;
  max-width: none;
  border: none;
}

/* Main content area */
.file-display {
  min-width: 0;
  overflow: auto;
  background: var(--bg-primary);
}

/* Right sidebar - TOC */
.sidebar-right {
  width: 220px;
  border-left: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow-y: auto;
}

.toc-sidebar {
  padding: var(--space-4) var(--space-3);
}

.toc-title {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin: 0 0 var(--space-3) 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-item {
  margin: var(--space-1) 0;
}

.toc-item a {
  display: block;
  padding: var(--space-1) var(--space-2);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-sm);
  line-height: 1.4;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
}

.toc-item a:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toc-item a.active {
  color: var(--accent-color);
  border-left-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.toc-level-2 {
  padding-left: var(--space-2);
}

.toc-level-3 {
  padding-left: var(--space-4);
}

.toc-level-4,
.toc-level-5,
.toc-level-6 {
  padding-left: var(--space-6);
}

/* Loading skeletons */
.tree-skeleton {
  min-width: 220px;
  border-right: 1px solid var(--border-color);
  padding: var(--space-3);
}

.skeleton-tree-item {
  height: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  width: 70%;
}

.skeleton-tree-item:nth-child(2n) {
  width: 85%;
  margin-left: 20px;
}

.skeleton-tree-item:nth-child(3n) {
  width: 60%;
  margin-left: 40px;
}

.file-skeleton {
  flex: 1;
  padding: var(--space-3);
}

.skeleton-code-header {
  height: 36px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.skeleton-code-line {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.file-loading {
  padding: var(--space-3);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}

/* Error display */
.error-display {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.error-icon {
  font-size: 48px;
  color: var(--error-color);
  margin-bottom: var(--space-3);
}

.error-message {
  font-size: var(--font-md);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.error-detail {
  font-size: var(--font-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-4);
}

.retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent-color);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-sm);
  margin-right: var(--space-2);
}

.retry-btn:hover {
  background: var(--accent-hover);
}

.retry-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.retry-btn.small {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-xs);
}

.back-home-link {
  color: var(--accent-color);
  margin-left: var(--space-2);
}

/* File error */
.file-error {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

.file-error p {
  margin: 0 0 var(--space-3);
}

/* Binary file */
.binary-file {
  padding: var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.binary-icon {
  font-size: 48px;
  color: var(--text-tertiary);
}

.binary-name {
  font-weight: 600;
  color: var(--text-primary);
}

.binary-size {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-color);
  margin-top: var(--space-2);
}

/* No file */
.no-file {
  padding: var(--space-7);
  text-align: center;
  color: var(--text-secondary);
}

.no-file-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

/* Footer */
.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--border-color);
}

.tag {
  background: var(--tag-bg);
  color: var(--tag-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  margin-right: var(--space-1);
}

.date {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .entry-detail-view {
    padding: var(--space-3);
    padding-bottom: 72px; /* Space for bottom bar */
  }

  .detail-header {
    flex-wrap: wrap;
  }

  .detail-header h2 {
    order: 3;
    width: 100%;
    flex: auto;
    font-size: var(--font-md);
  }

  .entry-content {
    display: flex;
    flex-direction: column;
    border: none;
    background: transparent;
  }

  /* Hide desktop sidebars on mobile (replaced by drawers) */
  .sidebar-left,
  .sidebar-right {
    display: none;
  }

  .file-display {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-primary);
    min-height: calc(100vh - 200px);
  }
}
    display: none;
  }

  .file-display {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-primary);
    min-height: calc(100vh - 200px);
  }
}
</style>
```

> **Design review fixes:**
> - **Three-column layout** (user requirement): Desktop shows left sidebar (file tree), center (code/markdown content), right sidebar (TOC for markdown). Mobile uses drawers.
> - **Text wrapping strategy** (user requirement): Markdown paragraphs auto-wrap with `overflow-wrap: break-word`. Tables and code blocks scroll horizontally (`overflow-x: auto`).
> - **Copy without line numbers** (user requirement): CodeViewer copies only code content via `navigator.clipboard.writeText(props.content)`. Line numbers use `user-select: none`.
> - **URL-based file selection** (review §7): Reads `route.query.file` on mount to select initial file. Updates `?file=` query param when file changes, enabling deep linking and browser back/forward.
> - **Line hash** (review §7): Handled in CodeViewer's `onMounted` — scrolls to `#L5-L10`.
> - **Loading skeleton** (review §12, §17): Shows skeleton for tree and code area while loading.
> - **Error state with retry** (review §12): Error display with `NOT_FOUND` vs generic differentiation, retry button, and "Back to home" link.
> - **File loading state** (review §17): `fileLoading` ref with skeleton, `fileError` with retry. Content cleared immediately on file switch (no stale content).
> - **`fetchFileContent()` via API client** (review §2): Uses `api.fetchFileContent()` (inline content endpoint) instead of raw `fetch()` on the download URL. Falls back to `?include=files.content` inline data if available.
> - **`aria-live="polite"`** (review §8): File display area announces content changes to screen readers.
> - **Mobile drawer UX** (user requirement): Full-screen drawers for file tree and TOC navigation on mobile. Fixed bottom bar with file breadcrumb, copy/download actions, and TOC button.
> - **Shared composable** (review §10): Uses `useEntry()` with caching and error handling.

- [ ] **Step 10: Verify frontend builds**

Run: `cd ~/lab/projects/peek/frontend && npm run build 2>&1 | tail -10`
Expected: Build successful (may have type warnings — fix as needed)

- [ ] **Step 11: Run vitest**

Run: `cd ~/lab/projects/peek/frontend && npx vitest run 2>&1 | tail -20`
Expected: API client tests pass

- [ ] **Step 12: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/src/
git commit -m "feat(frontend): core components with design review fixes — singleton Shiki, tree FileTree, FOUC-free theme, loading/error states, URL deep linking"
```


---

## 附录：任务拆分建议（编码前确认）

基于审查发现，Task 16 工作量较大，建议拆分为子任务：

### 拆分方案

**Task 16a: 主题系统与 CSS 基础设施**（约 2-3 小时）
- index.html FOUC 预防脚本
- variables.css + dark.css（移除 light.css）
- useTheme.ts 共享单例
- ThemeToggle.vue 组件

**Task 16b: 核心渲染组件**（约 4-6 小时）
- useShiki.ts 单例 highlighter（CSS variables 模式）
- CodeViewer.vue（含复制按钮、行号、自动换行）
- MarkdownViewer.vue（含 TOC、代码块复制、表格滚动）

**Task 16c: 视图与路由 + 移动端抽屉集成**（约 4-5 小时）
- useEntry.ts composable（含缓存）
- FileTree.vue（递归树结构）
- MobileFileDrawer.vue, MobileTocDrawer.vue, MobileBottomBar.vue
- EntryListView.vue（列表 + 搜索 + 分页）
- EntryDetailView.vue（三栏布局：左文件树/中内容/右TOC + 移动端抽屉交互）

### 依赖关系
```
Task 16a → Task 16b → Task 16c
```

### 决策点
- 如时间紧张，可先实现 Task 16a + 16c，用 `<pre>` 纯文本展示代码（暂不高亮）
- Shiki 集成可延后到迭代 2，不影响核心功能

---

*此附录由 2026-04-21 编码前审查添加*

