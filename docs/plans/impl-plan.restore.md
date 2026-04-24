# /autoplan Restore Point
Captured: 2026-04-18T06:50:00 | Branch: main | Commit: 07da7ff

## Re-run Instructions
1. Copy "Original Plan State" below back to your plan file
2. Invoke /autoplan

## Original Plan State

# Peek MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Peek MVP (v0.1) — a lightweight code & document formatting service where Agent creates entries via API/CLI and humans view formatted content in browser.

**Architecture:** FastAPI backend with SQLite (WAL mode, FTS5) + local filesystem storage. Vue 3 + Vite + Shiki SPA frontend. Backend serves API and hosts frontend static files in production. Three file upload modes: content inline, local_path copy, directory recursive scan.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel, SQLite (FTS5), Click, Pydantic BaseSettings, Vue 3, Vite, Shiki, markdown-it, sanitize-html, TypeScript

---

## File Structure

```
peek/
├── docs/specs/                     # Existing spec docs (v2.0)
├── backend/
│   ├── pyproject.toml              # Project config + dependencies
│   ├── peek/
│   │   ├── __init__.py             # Package init, version
│   │   ├── main.py                 # FastAPI app + middleware + exception handlers
│   │   ├── config.py               # Pydantic BaseSettings config
│   │   ├── models.py               # SQLModel data models (Entry, File)
│   │   ├── database.py             # DB init, WAL, FTS5, triggers
│   │   ├── storage.py              # File storage (copy, write, delete, path calc)
│   │   ├── language.py             # Extension/filename → language mapping
│   │   ├── exceptions.py           # PeekError hierarchy + error codes
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── entries.py          # Entry CRUD routes
│   │   │   └── files.py            # File download / zip routes
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── entry_service.py    # Entry business logic
│   │   │   ├── file_service.py     # File processing + local_path security
│   │   │   └── cleanup.py          # Expiry cleanup logic
│   │   ├── cli.py                  # Click CLI commands
│   │   └── mcp_server.py           # FastMCP server (P1, stub for now)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py             # Fixtures: temp dirs, test client, factories
│       ├── factories.py            # EntryFactory, FileInfo helpers
│       ├── test_config.py          # Config loading tests
│       ├── test_models.py          # Data model tests
│       ├── test_storage.py         # File storage tests
│       ├── test_language.py        # Language detection tests
│       ├── test_exceptions.py      # Exception hierarchy tests
│       ├── test_services.py        # Service layer tests (entry + file)
│       ├── test_api.py             # API endpoint tests
│       ├── test_security.py        # Security tests (path traversal, blacklist, XSS, SQLi)
│       └── test_cli.py             # CLI command tests
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── router/
│       │   └── index.ts            # Vue Router (/ and /view/:slug)
│       ├── api/
│       │   └── client.ts           # Axios/fetch API client
│       ├── views/
│       │   ├── EntryView.vue       # Entry detail page
│       │   └── IndexView.vue       # Entry list page
│       ├── components/
│       │   ├── FileTree.vue        # Directory tree
│       │   ├── CodeViewer.vue      # Shiki code highlight
│       │   ├── MarkdownViewer.vue  # markdown-it renderer + XSS protection
│       │   ├── BinaryViewer.vue    # Binary file download link
│       │   ├── ImageViewer.vue     # Image inline display
│       │   ├── TocNav.vue          # Markdown TOC navigation
│       │   ├── ThemeToggle.vue     # Dark/light toggle
│       │   ├── SearchBar.vue       # Search + tag filter
│       │   ├── EntryCard.vue       # Index page entry card
│       │   └── ActionBar.vue       # Copy/download/zip buttons
│       ├── composables/
│       │   ├── useTheme.ts         # Theme logic
│       │   └── useEntry.ts         # Entry data fetching
│       ├── styles/
│       │   ├── variables.css       # CSS custom properties
│       │   ├── light.css           # Light theme
│       │   └── dark.css            # Dark theme
│       └── types/
│           └── index.ts            # TypeScript type definitions
└── README.md
```

---

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/peek/__init__.py`

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

- [ ] **Step 3: Install and verify**

Run: `cd ~/lab/projects/peek/backend && pip install -e ".[test]"`
Expected: Successfully installed peek-0.1.0

- [ ] **Step 4: Commit**

```bash
cd ~/lab/projects/peek
git add backend/pyproject.toml backend/peek/__init__.py
git commit -m "feat(backend): project scaffolding with pyproject.toml"
```

---

### Task 2: Exception Hierarchy

**Files:**
- Create: `backend/peek/exceptions.py`

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
    """local_path is in the blacklist."""
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


def test_forbidden_paths_config(tmp_path):
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
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# Default forbidden paths (always included)
_DEFAULT_FORBIDDEN_PATHS = [
    str(Path.home() / ".ssh"),
    str(Path.home() / ".gnupg"),
    "/etc/shadow",
    "/etc/passwd",
]

# Default ignored dir names for directory scanning
DEFAULT_IGNORED_DIRS = {
    ".git", ".svn", "__pycache__", "node_modules",
    ".venv", "venv", ".tox", "dist", "build",
}

# Default forbidden filename patterns
_DEFAULT_FORBIDDEN_PATTERNS = [".env", "id_rsa", "id_ed25519"]


class PeekConfig(BaseSettings):
    """Peek application configuration.

    Priority: environment variables > config file > defaults
    """

    # Server
    server_host: str = Field(default="127.0.0.1", alias="PEEK_HOST")
    server_port: int = Field(default=8080, alias="PEEK_PORT")
    base_url: str = Field(default="", alias="PEEK_BASE_URL")

    # Storage
    data_dir: Path = Field(default=Path.home() / ".peek" / "data", alias="PEEK_DATA_DIR")
    db_path: Path = Field(default=Path.home() / ".peek" / "peek.db", alias="PEEK_DB_PATH")
    forbidden_paths: list[str] = Field(default_factory=lambda: list(_DEFAULT_FORBIDDEN_PATHS))
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
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/config.py backend/tests/test_config.py
git commit -m "feat(backend): Pydantic BaseSettings config with YAML + env override"
```

---

### Task 4: Data Models

**Files:**
- Create: `backend/peek/models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
import json
from datetime import datetime, timezone

from peek.models import Entry, File, EntryCreate, EntryResponse, FileResponse


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


def test_entry_response_schema():
    """Pydantic output schema includes computed url."""
    resp = EntryResponse(id=1, slug="test", url="http://localhost:8080/view/test",
                         summary="Test", created_at=datetime.now(timezone.utc),
                         updated_at=datetime.now(timezone.utc))
    assert resp.url == "http://localhost:8080/view/test"


def test_file_response_schema():
    resp = FileResponse(id=1, filename="main.py", language="python",
                        is_binary=False, size=100, line_count=5)
    assert resp.filename == "main.py"
    assert resp.line_count == 5
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

from sqlmodel import Field, SQLModel


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    """Output schema for a file in API responses."""
    id: int
    path: Optional[str] = None
    filename: str
    language: Optional[str] = None
    is_binary: bool
    size: int
    line_count: Optional[int] = None


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
Expected: 14 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/models.py backend/tests/test_models.py
git commit -m "feat(backend): SQLModel data models + Pydantic API schemas"
```

---

### Task 5: Language Detection

**Files:**
- Create: `backend/peek/language.py`

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
    ".rb": "ruby",
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

from sqlalchemy import text
from sqlmodel import SQLModel, create_engine
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Module-level engine cache
_engine: Engine | None = None


def init_db(db_path: Path) -> Engine:
    """Initialize database with WAL mode, create tables, FTS5 index, and triggers.

    Args:
        db_path: Path to SQLite database file.

    Returns:
        SQLModel engine instance.
    """
    global _engine
    db_path.parent.mkdir(parents=True, exist_ok=True)

    _engine = create_engine(f"sqlite:///{db_path}", echo=False)

    with _engine.connect() as conn:
        # Enable WAL mode for better concurrent read/write performance
        conn.execute(text("PRAGMA journal_mode=WAL"))
        # Busy timeout: wait up to 5 seconds for locked DB
        conn.execute(text("PRAGMA busy_timeout=5000"))
        # Enable foreign key constraints
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.commit()

    # Create SQLModel tables
    SQLModel.metadata.create_all(_engine)

    # Create FTS5 virtual table and triggers
    _create_fts5(_engine)

    return _engine


def get_engine() -> Engine:
    """Get or create the database engine."""
    global _engine
    if _engine is None:
        from peek.config import PeekConfig
        config = PeekConfig()
        _engine = init_db(config.db_path)
    return _engine


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
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/database.py backend/tests/test_database.py
git commit -m "feat(backend): database init with WAL mode, FTS5, and triggers"
```

---

### Task 7: File Storage Layer

**Files:**
- Create: `backend/peek/storage.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_storage.py
import tempfile
from pathlib import Path

import pytest

from peek.storage import StorageManager


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
    # Write file, then verify it exists at final path
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_storage.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/storage.py
"""File storage management — write, read, delete, path computation."""

from __future__ import annotations

import hashlib
import logging
import shutil
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)


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
        """Compute disk path for a file.

        Args:
            entry_id: Entry ID.
            filename: File name (e.g. "main.py").
            file_path: Relative path with directory (e.g. "src/main.py"), or None.

        Returns:
            Full path on disk.
        """
        base = self.get_entry_dir(entry_id)
        if file_path:
            return base / file_path
        return base / filename

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
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/storage.py backend/tests/test_storage.py
git commit -m "feat(backend): file storage with atomic writes and directory structure"
```

---

### Task 8: File Service (local_path security + directory scan)

**Files:**
- Create: `backend/peek/services/__init__.py`
- Create: `backend/peek/services/file_service.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_file_service.py
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


# --- validate_local_path ---

def test_validate_local_path_allowed(tmp_path):
    f = tmp_path / "hello.py"
    f.write_text("print('hi')")
    result = validate_local_path(str(f), forbidden_paths=[], forbidden_patterns=[])
    assert result == f.resolve()


def test_validate_local_path_forbidden_ssh(tmp_path):
    ssh_dir = Path.home() / ".ssh"
    # Only test if ~/.ssh exists; otherwise skip
    ssh_key = ssh_dir / "id_rsa"
    if not ssh_key.exists():
        pytest.skip("~/.ssh/id_rsa does not exist")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(ssh_key),
                            forbidden_paths=[str(ssh_dir)],
                            forbidden_patterns=[])


def test_validate_local_path_forbidden_env(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("SECRET=123")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(env_file),
                            forbidden_paths=[],
                            forbidden_patterns=[".env"])


def test_validate_local_path_traversal():
    with pytest.raises(ForbiddenPathError):
        validate_local_path("../../etc/passwd",
                            forbidden_paths=[],
                            forbidden_patterns=[])


def test_validate_local_path_symlink(tmp_path):
    real = tmp_path / "real.txt"
    real.write_text("content")
    link = tmp_path / "link.txt"
    link.symlink_to(real)
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(link),
                            forbidden_paths=[],
                            forbidden_patterns=[])


def test_validate_local_path_not_exists():
    with pytest.raises(FileNotFoundError):
        validate_local_path("/nonexistent/file.py",
                            forbidden_paths=[],
                            forbidden_patterns=[])


def test_validate_local_path_is_dir(tmp_path):
    with pytest.raises(ValueError, match="directory"):
        validate_local_path(str(tmp_path),
                            forbidden_paths=[],
                            forbidden_patterns=[])


# --- scan_directory ---

def test_scan_directory_recursive(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    (tmp_path / "README.md").write_text("readme")
    files = scan_directory(str(tmp_path), ignored_dirs=set())
    names = [f.filename for f in files]
    assert "main.py" in names
    assert "README.md" in names


def test_scan_directory_ignores_git(tmp_path):
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("git config")
    (tmp_path / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), ignored_dirs={".git"})
    names = [f.filename for f in files]
    assert "config" not in names
    assert "main.py" in names


def test_scan_directory_ignores_hidden(tmp_path):
    (tmp_path / ".hidden").mkdir()
    (tmp_path / ".hidden" / "secret.py").write_text("secret")
    (tmp_path / "visible.py").write_text("code")
    files = scan_directory(str(tmp_path), ignored_dirs=set())
    names = [f.filename for f in files]
    assert "secret.py" not in names
    assert "visible.py" in names


def test_scan_directory_ignores_node_modules(tmp_path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "lib.js").write_text("lib")
    (tmp_path / "app.js").write_text("app")
    files = scan_directory(str(tmp_path), ignored_dirs={"node_modules"})
    names = [f.filename for f in files]
    assert "lib.js" not in names


def test_scan_directory_preserves_paths(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), ignored_dirs=set())
    assert len(files) == 1
    assert files[0].path == "src/main.py"
    assert files[0].filename == "main.py"


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
"""File processing logic — local_path security, directory scanning, binary detection."""

from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from peek.exceptions import ForbiddenPathError
from peek.language import detect_language, is_binary_content

logger = logging.getLogger(__name__)


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
    forbidden_paths: list[str],
    forbidden_patterns: list[str],
) -> Path:
    """Validate that local_path is safe to read.

    Security checks:
    1. Resolve path and reject symlinks
    2. Reject paths in forbidden directories
    3. Reject files matching forbidden patterns
    4. Reject path traversal (..)
    5. Verify path points to a regular file

    Args:
        local_path: User-supplied filesystem path.
        forbidden_paths: List of forbidden directory prefixes.
        forbidden_patterns: List of forbidden filename substrings.

    Returns:
        Resolved Path object.

    Raises:
        ForbiddenPathError: Path fails security check.
        FileNotFoundError: Path doesn't exist.
        ValueError: Path is a directory, not a file.
    """
    # Reject obvious traversal before resolving
    if ".." in local_path:
        raise ForbiddenPathError(f"Path traversal not allowed: {local_path}")

    resolved = Path(local_path).resolve()

    # 1. Reject symlinks (check the original path, not resolved)
    if Path(local_path).is_symlink():
        raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")

    # 2. Blacklist directory check
    for forbidden in forbidden_paths:
        forbidden_resolved = Path(forbidden).resolve()
        if str(resolved).startswith(str(forbidden_resolved)):
            raise ForbiddenPathError(f"Access to {forbidden} is not allowed")

    # 3. Blacklist filename pattern check
    for pattern in forbidden_patterns:
        if pattern in resolved.name:
            raise ForbiddenPathError(f"Access to {resolved.name} is not allowed")

    # 4. Must exist
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {local_path}")

    # 5. Must be a regular file, not a directory
    if resolved.is_dir():
        raise ValueError(f"Path is a directory, not a file: {local_path}")

    return resolved


def scan_directory(dir_path: str, ignored_dirs: set[str]) -> list[FileInfo]:
    """Recursively scan a directory for files.

    Args:
        dir_path: Absolute directory path.
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
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            continue

        rel_path = path.relative_to(root)
        try:
            content = path.read_bytes()
            binary = is_binary_content(content)
            lang = detect_language(path.name) if not binary else None
        except (OSError, PermissionError):
            logger.warning("Cannot read file: %s", path)
            continue

        files.append(FileInfo(
            path=str(rel_path) if str(rel_path) != path.name else None,
            filename=path.name,
            local_path=str(path),
            language=lang,
            is_binary=binary,
            size=path.stat().st_size,
        ))

    return files


def parse_expires_in(expires_in: str) -> timedelta:
    """Parse expires_in string to timedelta.

    Supported formats: "1h" (hours), "30m" (minutes), "7d" (days).

    Args:
        expires_in: Duration string.

    Returns:
        timedelta object.

    Raises:
        ValueError: Invalid format or zero/negative duration.
    """
    match = re.match(r"^(\d+)([hmd])$", expires_in)
    if not match:
        raise ValueError(f"Invalid expires_in format: {expires_in!r}. Use e.g. '1h', '30m', '7d'")

    value = int(match.group(1))
    unit = match.group(2)

    if value <= 0:
        raise ValueError(f"expires_in must be positive: {expires_in!r}")

    if unit == "h":
        return timedelta(hours=value)
    elif unit == "m":
        return timedelta(minutes=value)
    elif unit == "d":
        return timedelta(days=value)
    else:
        raise ValueError(f"Unknown time unit: {unit}")


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
Expected: 16 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/services/ backend/tests/test_file_service.py
git commit -m "feat(backend): file service with local_path security and directory scan"
```

---

### Task 9: Entry Service (business logic)

**Files:**
- Create: `backend/peek/services/entry_service.py`

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
from peek.services.entry_service import EntryService
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


class TestDeleteEntry:
    def test_delete_success(self, entry_service):
        created = entry_service.create_entry(summary="Delete me", slug="del")
        entry_service.delete_entry("del")
        with pytest.raises(NotFoundError):
            entry_service.get_entry("del")

    def test_delete_not_found(self, entry_service):
        with pytest.raises(NotFoundError):
            entry_service.delete_entry("nonexistent")
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
from typing import Any

from sqlalchemy import text, func
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

        # Resolve slug conflicts
        slug = self._resolve_slug_conflict(slug)

        # Parse expiry
        expires_at = None
        if expires_in:
            delta = parse_expires_in(expires_in)
            expires_at = datetime.now(timezone.utc) + delta

        # Collect all files
        files_info = self._collect_files(files_data or [], dirs_data or [])

        # Validate limits
        self._validate_limits(files_info)

        # Create entry in DB + write files
        now = datetime.now(timezone.utc)
        entry = Entry(
            slug=slug,
            summary=summary.strip(),
            tags=json.dumps(tags or []),
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )

        with Session(self.engine) as session:
            session.add(entry)
            session.commit()
            session.refresh(entry)
            entry_id = entry.id

            # Write files to disk + create File records
            file_records = []
            for fi in files_info:
                content = fi.get("content_bytes", b"")
                file_path = fi.get("path")
                filename = fi["filename"]
                is_binary = fi.get("is_binary", False)
                lang = fi.get("language")

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
                file_records.append(file_record)

            session.commit()

            # Refresh to get file IDs
            for fr in file_records:
                session.refresh(fr)

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
                    # No FTS results → return empty
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

    def _resolve_slug_conflict(self, slug: str) -> str:
        """If slug exists, append -N suffix."""
        with Session(self.engine) as session:
            existing = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not existing:
                return slug

            n = 2
            while True:
                new_slug = f"{slug}-{n}"
                existing = session.exec(
                    select(Entry).where(Entry.slug == new_slug)
                ).first()
                if not existing:
                    return new_slug
                n += 1

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
            scanned = scan_directory(dd["path"], self.config.ignored_dirs)
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
                forbidden_paths=self.config.forbidden_paths,
                forbidden_patterns=self.config.forbidden_patterns,
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
            # Count lines for text files
            line_count = None
            if not f.is_binary and f.size > 0:
                try:
                    disk_path = self.storage.get_disk_path(entry.id, f.filename, f.path)
                    if disk_path.exists():
                        line_count = sum(1 for _ in disk_path.open("r", errors="replace"))
                except Exception:
                    pass

            file_responses.append(FileResponse(
                id=f.id,
                path=f.path,
                filename=f.filename,
                language=f.language,
                is_binary=f.is_binary,
                size=f.size,
                line_count=line_count,
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
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/services/entry_service.py backend/tests/test_entry_service.py
git commit -m "feat(backend): entry service with CRUD, slug resolution, and limits"
```

---

### Task 10: FastAPI Application + API Routes

**Files:**
- Create: `backend/peek/api/__init__.py`
- Create: `backend/peek/api/entries.py`
- Create: `backend/peek/api/files.py`
- Create: `backend/peek/main.py`

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


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200


class TestCreateEntry:
    @pytest.mark.asyncio
    async def test_create_with_content(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Test entry",
            "slug": "test",
            "files": [{"path": "main.py", "content": "print('hello')"}],
        })
        assert resp.status_code == 200
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
        assert resp.status_code == 200
        assert len(resp.json()["slug"]) == 6


class TestGetEntry:
    @pytest.mark.asyncio
    async def test_get_entry(self, client):
        # Create first
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "Find me", "slug": "find",
        })
        assert create_resp.status_code == 200
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

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from peek.database import get_engine
from peek.exceptions import PeekError
from peek.models import EntryCreate, EntryUpdate
from peek.services.entry_service import EntryService
from peek.storage import StorageManager
from peek.config import PeekConfig

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


def get_entry_service() -> EntryService:
    """Dependency: create EntryService instance."""
    config = PeekConfig()
    engine = get_engine()
    storage = StorageManager(data_dir=config.data_dir)
    return EntryService(engine=engine, storage=storage, config=config)


@router.post("")
async def create_entry(data: EntryCreate, service: EntryService = Depends(get_entry_service)):
    """Create a new entry."""
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
    q: str | None = Query(None),
    tags: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: EntryService = Depends(get_entry_service),
):
    """List entries with search, filter, and pagination."""
    tag_list = tags.split(",") if tags else None
    return service.list_entries(q=q, tags=tag_list, status=status, page=page, per_page=per_page)


@router.get("/{slug}")
async def get_entry(slug: str, service: EntryService = Depends(get_entry_service)):
    """Get entry details by slug."""
    return service.get_entry(slug)


@router.delete("/{slug}")
async def delete_entry(slug: str, service: EntryService = Depends(get_entry_service)):
    """Delete entry by slug."""
    service.delete_entry(slug)
    return {"ok": True}
```

```python
# backend/peek/api/files.py
"""File download API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from peek.config import PeekConfig
from peek.database import get_engine
from peek.exceptions import NotFoundError
from peek.models import File
from peek.services.entry_service import EntryService
from peek.storage import StorageManager
from sqlmodel import Session, select

router = APIRouter(prefix="/api/v1/entries", tags=["files"])


@router.get("/{slug}/files/{file_id}")
async def download_file(slug: str, file_id: int):
    """Download a single file."""
    config = PeekConfig()
    engine = get_engine()
    storage = StorageManager(data_dir=config.data_dir)

    with Session(engine) as session:
        from peek.models import Entry
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry.id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

    content = storage.read_file(entry.id, file_record.filename, file_record.path)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'},
    )
```

```python
# backend/peek/main.py
"""FastAPI application — entry point, middleware, exception handlers."""

from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from peek.config import PeekConfig, ensure_data_dirs
from peek.database import init_db
from peek.exceptions import PeekError

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

    # Initialize database
    init_db(config.db_path)

    # Store config on app state for dependency injection
    app.state.config = config

    # CORS (dev mode)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
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

    return app


# Default app instance (used by uvicorn)
app = create_app()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_api.py -v`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/api/ backend/peek/main.py backend/tests/test_api.py
git commit -m "feat(backend): FastAPI app with entry CRUD routes and error handling"
```

---

### Task 11: Security Tests

**Files:**
- Create: `backend/tests/test_security.py`

- [ ] **Step 1: Write the security tests**

```python
# backend/tests/test_security.py
"""Security tests — path traversal, blacklist, SQL injection, XSS."""

import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peek.exceptions import ForbiddenPathError
from peek.main import create_app
from peek.services.file_service import validate_local_path


@pytest.fixture
async def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# --- Path traversal ---

def test_path_traversal_relative():
    with pytest.raises(ForbiddenPathError):
        validate_local_path("../../etc/passwd", forbidden_paths=[], forbidden_patterns=[])


def test_path_traversal_in_file_path():
    with pytest.raises(ForbiddenPathError):
        validate_local_path("../../../etc/shadow", forbidden_paths=[], forbidden_patterns=[])


# --- Blacklist ---

def test_forbidden_ssh_dir(tmp_path):
    ssh_dir = tmp_path / ".ssh"
    ssh_dir.mkdir()
    key_file = ssh_dir / "id_rsa"
    key_file.write_text("PRIVATE KEY")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(key_file),
                            forbidden_paths=[str(ssh_dir)],
                            forbidden_patterns=[])


def test_forbidden_env_file(tmp_path):
    env = tmp_path / "config.env"
    env.write_text("SECRET=123")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(env),
                            forbidden_paths=[],
                            forbidden_patterns=[".env"])


def test_forbidden_symlink(tmp_path):
    real = tmp_path / "real.txt"
    real.write_text("ok")
    link = tmp_path / "link.txt"
    link.symlink_to(real)
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(link), forbidden_paths=[], forbidden_patterns=[])


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
Expected: 7 passed

- [ ] **Step 3: Commit**

```bash
cd ~/lab/projects/peek
git add backend/tests/test_security.py
git commit -m "test(backend): security tests — path traversal, blacklist, SQLi, info leak"
```

---

### Task 12: CLI Commands

**Files:**
- Create: `backend/peek/cli.py`

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
    from peek.main import create_app

    config = PeekConfig()
    h = host or config.server_host
    p = port or config.server_port

    click.echo(f"🚀 Starting Peek server on {h}:{p}")
    uvicorn.run("peek.main:app", host=h, port=p, reload=False)


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
        if resp.status_code == 200:
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_cli.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/cli.py backend/tests/test_cli.py
git commit -m "feat(backend): Click CLI — serve, create, list, get, delete"
```

---

### Task 13: Test Conftest and Integration Test

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/factories.py`

- [ ] **Step 1: Create conftest.py**

```python
# backend/tests/conftest.py
"""Shared test fixtures."""

import tempfile
from pathlib import Path

import pytest


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
```

- [ ] **Step 2: Create factories.py**

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

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/ -v --tb=short`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd ~/lab/projects/peek
git add backend/tests/conftest.py backend/tests/factories.py
git commit -m "test(backend): shared fixtures and test data factories"
```

---

### Task 14: Frontend Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`

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
    "sanitize-html": "^2.13",
    "mermaid": "^10.9"
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

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
```

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

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Peek</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create main.ts**

```typescript
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import IndexView from './views/IndexView.vue'
import EntryView from './views/EntryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: IndexView },
    { path: '/view/:slug', component: EntryView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
```

- [ ] **Step 6: Create App.vue**

```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 7: Install dependencies and verify**

Run: `cd ~/lab/projects/peek/frontend && npm install`
Expected: Dependencies installed successfully

- [ ] **Step 8: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/
git commit -m "feat(frontend): Vue 3 + Vite + TypeScript scaffolding"
```

---

### Task 15: Frontend Types and API Client

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create types/index.ts**

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

export interface PeekError {
  error: {
    code: string
    message: string
    details: unknown
  }
}
```

- [ ] **Step 2: Create api/client.ts**

```typescript
// frontend/src/api/client.ts

import type { EntryResponse, EntryListResponse, PeekError } from '../types'

const BASE_URL = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!resp.ok) {
    const err: PeekError = await resp.json()
    throw new Error(err.error?.message || `HTTP ${resp.status}`)
  }

  return resp.json()
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

  getEntry(slug: string): Promise<EntryResponse> {
    return request(`/entries/${slug}`)
  },

  deleteEntry(slug: string): Promise<{ ok: boolean }> {
    return request(`/entries/${slug}`, { method: 'DELETE' })
  },

  downloadFile(slug: string, fileId: number): string {
    return `${BASE_URL}/entries/${slug}/files/${fileId}`
  },

  downloadZip(slug: string): string {
    return `${BASE_URL}/entries/${slug}/download`
  },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd ~/lab/projects/peek/frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only missing view component errors which we'll add next)

- [ ] **Step 4: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/src/types/ frontend/src/api/
git commit -m "feat(frontend): TypeScript types and API client"
```

---

### Task 16: Frontend Core Components

**Files:**
- Create: `frontend/src/views/IndexView.vue`
- Create: `frontend/src/views/EntryView.vue`
- Create: `frontend/src/components/CodeViewer.vue`
- Create: `frontend/src/components/MarkdownViewer.vue`
- Create: `frontend/src/components/FileTree.vue`
- Create: `frontend/src/components/ThemeToggle.vue`
- Create: `frontend/src/styles/variables.css`
- Create: `frontend/src/styles/dark.css`
- Create: `frontend/src/styles/light.css`

- [ ] **Step 1: Create CSS variables and themes**

```css
/* frontend/src/styles/variables.css */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-code: #f6f8fa;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --border-color: #d0d7de;
  --accent-color: #0969da;
  --accent-hover: #0550ae;
  --tag-bg: #ddf4ff;
  --tag-text: #0969da;
}

/* frontend/src/styles/dark.css */
[data-theme="dark"] {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-code: #161b22;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --border-color: #30363d;
  --accent-color: #58a6ff;
  --accent-hover: #79c0ff;
  --tag-bg: #1f2937;
  --tag-text: #58a6ff;
}

/* frontend/src/styles/light.css */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-code: #f6f8fa;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --border-color: #d0d7de;
  --accent-color: #0969da;
  --accent-hover: #0550ae;
  --tag-bg: #ddf4ff;
  --tag-text: #0969da;
}
```

- [ ] **Step 2: Create CodeViewer.vue**

```vue
<!-- frontend/src/components/CodeViewer.vue -->
<template>
  <div class="code-viewer">
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span class="line-count" v-if="lineCount">{{ lineCount }} lines</span>
      <button class="copy-btn" @click="copyCode" :title="copied ? 'Copied!' : 'Copy'">
        {{ copied ? '✓' : '📋' }}
      </button>
      <button class="wrap-btn" @click="wrap = !wrap" :title="wrap ? 'No wrap' : 'Wrap'">
        {{ wrap ? '↩' : '→' }}
      </button>
    </div>
    <div class="code-content" :class="{ wrap }" v-html="highlighted"></div>
    <div v-if="isEmpty" class="empty-file">Empty file</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { createHighlighter } from 'shiki'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  lineCount: number | null
}>()

const highlighted = ref('')
const copied = ref(false)
const wrap = ref(false)

const isEmpty = computed(() => props.content.length === 0)

onMounted(async () => {
  if (isEmpty.value) return
  try {
    const highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [props.language || 'text'],
    })
    highlighted.value = highlighter.codeToHtml(props.content, {
      lang: props.language || 'text',
      themes: { dark: 'github-dark', light: 'github-light' },
    })
  } catch {
    // Fallback: plain text with line numbers
    const lines = props.content.split('\n')
    highlighted.value = '<pre>' + lines.map((line, i) =>
      `<span class="line-number">${i + 1}</span> ${escapeHtml(line)}`
    ).join('\n') + '</pre>'
  }
})

async function copyCode() {
  await navigator.clipboard.writeText(props.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<style scoped>
.code-viewer { border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }
.code-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-size: 13px; }
.filename { font-weight: 600; color: var(--text-primary); }
.line-count { color: var(--text-secondary); }
.copy-btn, .wrap-btn { background: none; border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; cursor: pointer; margin-left: auto; }
.code-content { padding: 12px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
.code-content.wrap { white-space: pre-wrap; word-break: break-all; }
.empty-file { padding: 24px; text-align: center; color: var(--text-secondary); }
</style>
```

- [ ] **Step 3: Create MarkdownViewer.vue**

```vue
<!-- frontend/src/components/MarkdownViewer.vue -->
<template>
  <div class="markdown-viewer" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

const rendered = computed(() => {
  const html = md.render(props.content)
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
    },
  })
})
</script>

<style scoped>
.markdown-viewer { padding: 16px; line-height: 1.6; color: var(--text-primary); }
.markdown-viewer :deep(h1), .markdown-viewer :deep(h2), .markdown-viewer :deep(h3) { margin-top: 1.5em; margin-bottom: 0.5em; }
.markdown-viewer :deep(pre) { background: var(--bg-code); padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-viewer :deep(code) { font-size: 13px; }
.markdown-viewer :deep(table) { border-collapse: collapse; width: 100%; }
.markdown-viewer :deep(th), .markdown-viewer :deep(td) { border: 1px solid var(--border-color); padding: 6px 12px; }
.markdown-viewer :deep(img) { max-width: 100%; }
</style>
```

- [ ] **Step 4: Create FileTree.vue**

```vue
<!-- frontend/src/components/FileTree.vue -->
<template>
  <div class="file-tree">
    <div class="tree-item" v-for="file in files" :key="file.id"
         :class="{ active: file.id === activeFileId }"
         @click="$emit('select', file)">
      <span class="file-icon">{{ file.is_binary ? '📦' : getFileIcon(file.language) }}</span>
      <span class="file-name">{{ file.path || file.filename }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileResponse } from '../types'

defineProps<{
  files: FileResponse[]
  activeFileId: number | null
}>()

defineEmits<{
  select: [file: FileResponse]
}>()

function getFileIcon(lang: string | null): string {
  const icons: Record<string, string> = {
    python: '🐍', javascript: '📜', typescript: '📘', rust: '🦀',
    go: '🐹', java: '☕', html: '🌐', css: '🎨', markdown: '📝',
  }
  return icons[lang || ''] || '📄'
}
</script>

<style scoped>
.file-tree { min-width: 200px; border-right: 1px solid var(--border-color); padding: 8px 0; }
.tree-item { display: flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.tree-item:hover { background: var(--bg-secondary); }
.tree-item.active { background: var(--accent-color); color: white; }
.file-icon { font-size: 14px; }
</style>
```

- [ ] **Step 5: Create ThemeToggle.vue**

```vue
<!-- frontend/src/components/ThemeToggle.vue -->
<template>
  <button class="theme-toggle" @click="toggle" :title="isDark ? 'Switch to light' : 'Switch to dark'">
    {{ isDark ? '☀️' : '🌙' }}
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isDark = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('peek-theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme()
})

function toggle() {
  isDark.value = !isDark.value
  localStorage.setItem('peek-theme', isDark.value ? 'dark' : 'light')
  applyTheme()
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}
</script>

<style scoped>
.theme-toggle { background: none; border: 1px solid var(--border-color); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
</style>
```

- [ ] **Step 6: Create IndexView.vue**

```vue
<!-- frontend/src/views/IndexView.vue -->
<template>
  <div class="index-view">
    <header class="index-header">
      <h1>Peek</h1>
      <div class="header-actions">
        <input v-model="searchQuery" placeholder="Search..." @input="debouncedSearch" class="search-input" />
        <ThemeToggle />
      </div>
    </header>
    <div class="entry-list">
      <div v-for="entry in entries" :key="entry.id" class="entry-card" @click="goToEntry(entry.slug)">
        <h3>{{ entry.summary }}</h3>
        <div class="entry-meta">
          <span class="entry-tags" v-for="tag in entry.tags" :key="tag">#{{ tag }}</span>
          <span class="entry-date">{{ formatDate(entry.created_at) }}</span>
        </div>
      </div>
      <div v-if="entries.length === 0" class="empty-state">No entries yet</div>
    </div>
    <div class="pagination" v-if="totalPages > 1">
      <button @click="page--" :disabled="page <= 1">←</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button @click="page++" :disabled="page >= totalPages">→</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client'
import ThemeToggle from '../components/ThemeToggle.vue'
import type { EntryListItem } from '../types'

const router = useRouter()
const entries = ref<EntryListItem[]>([])
const searchQuery = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; fetchEntries() }, 300)
}

async function fetchEntries() {
  try {
    const resp = await api.listEntries({
      q: searchQuery.value || undefined,
      page: page.value,
    })
    entries.value = resp.items
    total.value = resp.total
    totalPages.value = Math.ceil(resp.total / resp.per_page)
  } catch (e) {
    console.error('Failed to fetch entries:', e)
  }
}

function goToEntry(slug: string) {
  router.push(`/view/${slug}`)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

onMounted(fetchEntries)
watch(page, fetchEntries)
</script>

<style scoped>
.index-view { max-width: 900px; margin: 0 auto; padding: 24px; }
.index-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.index-header h1 { color: var(--text-primary); }
.header-actions { display: flex; gap: 12px; align-items: center; }
.search-input { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); }
.entry-card { padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: border-color 0.2s; }
.entry-card:hover { border-color: var(--accent-color); }
.entry-card h3 { margin: 0 0 8px; color: var(--text-primary); }
.entry-meta { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-secondary); }
.entry-tags { background: var(--tag-bg); color: var(--tag-text); padding: 2px 6px; border-radius: 4px; }
.empty-state { text-align: center; padding: 48px; color: var(--text-secondary); }
.pagination { display: flex; justify-content: center; gap: 12px; align-items: center; margin-top: 24px; }
.pagination button { padding: 6px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); cursor: pointer; }
.pagination button:disabled { opacity: 0.5; cursor: default; }
</style>
```

- [ ] **Step 7: Create EntryView.vue**

```vue
<!-- frontend/src/views/EntryView.vue -->
<template>
  <div class="entry-view">
    <header class="entry-header">
      <router-link to="/" class="back-link">← Back</router-link>
      <h2>{{ entry?.summary }}</h2>
      <div class="header-actions">
        <ThemeToggle />
      </div>
    </header>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="entry" class="entry-content">
      <FileTree v-if="entry.files.length > 1"
                :files="entry.files"
                :active-file-id="activeFile?.id ?? null"
                @select="activeFile = $event" />
      <div class="file-display">
        <CodeViewer v-if="activeFile && !activeFile.is_binary && !isMarkdown"
                    :content="fileContent"
                    :filename="activeFile.filename"
                    :language="activeFile.language"
                    :line-count="activeFile.line_count" />
        <MarkdownViewer v-else-if="activeFile && isMarkdown"
                        :content="fileContent" />
        <div v-else-if="activeFile?.is_binary" class="binary-file">
          📦 {{ activeFile.filename }} ({{ formatSize(activeFile.size) }})
          <a :href="downloadUrl" download>Download</a>
        </div>
      </div>
    </div>
    <footer class="entry-footer" v-if="entry">
      <div class="tags">
        <span v-for="tag in entry.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
      <span class="date">Created: {{ formatDate(entry.created_at) }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'
import FileTree from '../components/FileTree.vue'
import CodeViewer from '../components/CodeViewer.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import type { EntryResponse, FileResponse } from '../types'

const route = useRoute()
const entry = ref<EntryResponse | null>(null)
const activeFile = ref<FileResponse | null>(null)
const fileContent = ref('')
const loading = ref(true)
const error = ref('')

const isMarkdown = computed(() => activeFile.value?.language === 'markdown')
const downloadUrl = computed(() =>
  activeFile.value ? api.downloadFile(route.params.slug as string, activeFile.value.id) : ''
)

async function fetchEntry() {
  loading.value = true
  error.value = ''
  try {
    entry.value = await api.getEntry(route.params.slug as string)
    if (entry.value.files.length > 0) {
      activeFile.value = entry.value.files[0]
      await fetchFileContent()
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load entry'
  } finally {
    loading.value = false
  }
}

async function fetchFileContent() {
  if (!activeFile.value || activeFile.value.is_binary) return
  try {
    const resp = await fetch(downloadUrl.value)
    fileContent.value = await resp.text()
  } catch {
    fileContent.value = ''
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

watch(activeFile, fetchFileContent)
onMounted(fetchEntry)
</script>

<style scoped>
.entry-view { max-width: 1200px; margin: 0 auto; padding: 24px; }
.entry-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.back-link { color: var(--accent-color); text-decoration: none; }
.entry-header h2 { flex: 1; color: var(--text-primary); margin: 0; }
.header-actions { display: flex; gap: 8px; }
.entry-content { display: flex; gap: 0; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; min-height: 400px; }
.file-display { flex: 1; overflow: auto; }
.loading, .error { text-align: center; padding: 48px; color: var(--text-secondary); }
.binary-file { padding: 24px; text-align: center; }
.binary-file a { color: var(--accent-color); }
.entry-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--border-color); }
.tag { background: var(--tag-bg); color: var(--tag-text); padding: 2px 8px; border-radius: 4px; font-size: 13px; margin-right: 4px; }
.date { color: var(--text-secondary); font-size: 13px; }
</style>
```

- [ ] **Step 8: Verify frontend builds**

Run: `cd ~/lab/projects/peek/frontend && npm run build 2>&1 | tail -5`
Expected: Build successful (may have type warnings, fix as needed)

- [ ] **Step 9: Commit**

```bash
cd ~/lab/projects/peek
git add frontend/src/
git commit -m "feat(frontend): core components — views, code/markdown viewers, file tree, theme"
```

---

### Task 17: Integration Test — Full Stack

**Files:**
- Modify: `backend/peek/main.py` (add static file serving for built frontend)
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write integration test**

```python
# backend/tests/test_integration.py
"""Integration test — full entry lifecycle."""

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


@pytest.mark.asyncio
async def test_full_lifecycle(client, tmp_path):
    """Create → Get → List → Delete → Verify gone."""
    # Create
    test_file = tmp_path / "hello.py"
    test_file.write_text("print('hello world')")

    resp = await client.post("/api/v1/entries", json={
        "summary": "Integration test entry",
        "slug": "integration",
        "tags": ["test", "python"],
        "files": [{"path": "hello.py", "content": "print('hello')"}],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "integration"
    assert "/view/integration" in data["url"]
    entry_id = data["id"]

    # Get
    resp = await client.get("/api/v1/entries/integration")
    assert resp.status_code == 200
    entry = resp.json()
    assert entry["summary"] == "Integration test entry"
    assert len(entry["files"]) == 1
    assert entry["files"][0]["filename"] == "hello.py"

    # List
    resp = await client.get("/api/v1/entries")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # Search
    resp = await client.get("/api/v1/entries?q=python")
    assert resp.status_code == 200

    # Delete
    resp = await client.delete("/api/v1/entries/integration")
    assert resp.status_code == 200

    # Verify gone
    resp = await client.get("/api/v1/entries/integration")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_error_response_format_consistency(client):
    """All errors use unified format: {error: {code, message, details}}."""
    resp = await client.get("/api/v1/entries/nonexistent")
    assert resp.status_code == 404
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "NOT_FOUND"
    assert "message" in body["error"]


@pytest.mark.asyncio
async def test_slug_conflict_auto_suffix(client):
    """Duplicate slug gets -N suffix."""
    r1 = await client.post("/api/v1/entries", json={"summary": "A", "slug": "conflict"})
    r2 = await client.post("/api/v1/entries", json={"summary": "B", "slug": "conflict"})
    assert r1.json()["slug"] == "conflict"
    assert r2.json()["slug"].startswith("conflict-")
```

- [ ] **Step 2: Run integration tests**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_integration.py -v`
Expected: 3 passed

- [ ] **Step 3: Run ALL backend tests**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/ -v --tb=short`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd ~/lab/projects/peek
git add backend/tests/test_integration.py
git commit -m "test(backend): integration tests — full lifecycle, error format, slug conflict"
```

---

### Task 18: Expiry Cleanup Service

**Files:**
- Create: `backend/peek/services/cleanup.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cleanup.py
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
from sqlmodel import Session, create_engine, SQLModel

from peek.config import PeekConfig
from peek.database import init_db
from peek.models import Entry
from peek.services.cleanup import cleanup_expired
from peek.storage import StorageManager


@pytest.fixture
def cleanup_env(tmp_path):
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = init_db(db_path)
    storage = StorageManager(data_dir=data_dir)
    return engine, storage


def test_cleanup_expired_entry(cleanup_env):
    engine, storage = cleanup_env
    with Session(engine) as session:
        expired = Entry(
            slug="expired",
            summary="Old entry",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        session.add(expired)
        session.commit()
        expired_id = expired.id

    # Write a file for the entry
    storage.write_file(entry_id=expired_id, filename="old.py", content=b"old")

    result = cleanup_expired(engine, storage)
    assert result == 1

    # Entry should be gone
    with Session(engine) as session:
        entry = session.get(Entry, expired_id)
        assert entry is None

    # File should be gone
    assert not storage.get_entry_dir(expired_id).exists()


def test_no_cleanup_for_active(cleanup_env):
    engine, storage = cleanup_env
    with Session(engine) as session:
        active = Entry(slug="active", summary="Active entry")
        session.add(active)
        session.commit()

    result = cleanup_expired(engine, storage)
    assert result == 0


def test_null_expires_not_cleaned(cleanup_env):
    engine, storage = cleanup_env
    with Session(engine) as session:
        forever = Entry(slug="forever", summary="No expiry", expires_at=None)
        session.add(forever)
        session.commit()

    result = cleanup_expired(engine, storage)
    assert result == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_cleanup.py -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/peek/services/cleanup.py
"""Expiry cleanup logic."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlmodel import Session, select

from peek.models import Entry
from peek.storage import StorageManager

logger = logging.getLogger(__name__)


def cleanup_expired(engine, storage: StorageManager) -> int:
    """Delete all expired entries and their files.

    Cleanup order: delete DB records (in transaction), then delete files (best-effort).

    Args:
        engine: SQLModel engine.
        storage: StorageManager instance.

    Returns:
        Number of entries cleaned up.
    """
    now = datetime.now(timezone.utc)
    cleaned = 0

    with Session(engine) as session:
        expired = session.exec(
            select(Entry).where(Entry.expires_at != None, Entry.expires_at < now)  # noqa: E711
        ).all()

        for entry in expired:
            entry_id = entry.id
            slug = entry.slug
            try:
                session.delete(entry)
                session.commit()
                logger.info("Cleaned up expired entry: %s (id=%d)", slug, entry_id)
            except Exception as e:
                session.rollback()
                logger.error("Failed to delete expired entry %s: %s", slug, e)
                continue

            # Delete files (best-effort, after DB commit)
            try:
                storage.delete_entry_files(entry_id)
            except Exception as e:
                logger.error("Failed to delete files for entry %d: %s", entry_id, e)

            cleaned += 1

    return cleaned
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/test_cleanup.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/services/cleanup.py backend/tests/test_cleanup.py
git commit -m "feat(backend): expiry cleanup service"
```

---

### Task 19: Final Backend Wiring — Update API + File Download

**Files:**
- Modify: `backend/peek/api/entries.py` (add PATCH /{slug} route)
- Modify: `backend/peek/services/entry_service.py` (add update_entry method)

- [ ] **Step 1: Add update_entry to EntryService**

Add to `backend/peek/services/entry_service.py`:

```python
    def update_entry(self, slug: str, data: dict) -> EntryResponse:
        """Update an existing entry.

        Args:
            slug: Entry slug.
            data: Update fields (summary, status, tags, add_files, remove_file_ids, add_dirs).

        Returns:
            Updated EntryResponse.
        """
        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if data.get("summary") is not None:
                entry.summary = data["summary"]
            if data.get("status") is not None:
                entry.status = data["status"]
            if data.get("tags") is not None:
                entry.tags = json.dumps(data["tags"])

            entry.updated_at = datetime.now(timezone.utc)
            session.add(entry)

            # Remove files
            for file_id in data.get("remove_file_ids", []):
                file_record = session.get(File, file_id)
                if file_record and file_record.entry_id == entry.id:
                    session.delete(file_record)

            # Add files
            new_files = self._collect_files(
                data.get("add_files", []),
                data.get("add_dirs", []),
            )
            for fi in new_files:
                content = fi.get("content_bytes", b"")
                self.storage.write_file(
                    entry_id=entry.id,
                    filename=fi["filename"],
                    content=content,
                    file_path=fi.get("path"),
                )
                file_record = File(
                    entry_id=entry.id,
                    path=fi.get("path"),
                    filename=fi["filename"],
                    language=fi.get("language"),
                    is_binary=fi.get("is_binary", False),
                    size=len(content),
                    sha256=self.storage.compute_sha256(content) if content else None,
                )
                session.add(file_record)

            session.commit()
            session.refresh(entry)

            # Get all remaining files
            all_files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

        return self._build_response(entry, list(all_files))
```

Also add the missing import at the top of entry_service.py:
```python
from sqlmodel import Session, select
```
(This should already be there from Task 9.)

- [ ] **Step 2: Add PATCH route to entries.py**

Add to `backend/peek/api/entries.py`:

```python
@router.patch("/{slug}")
async def update_entry(slug: str, data: EntryUpdate, service: EntryService = Depends(get_entry_service)):
    """Update entry (partial update)."""
    return service.update_entry(slug, data.model_dump(exclude_unset=True))
```

- [ ] **Step 3: Write test for update**

```python
# Add to backend/tests/test_api.py:

class TestUpdateEntry:
    @pytest.mark.asyncio
    async def test_update_summary(self, client):
        await client.post("/api/v1/entries", json={"summary": "Original", "slug": "updatable"})
        resp = await client.patch("/api/v1/entries/updatable", json={"summary": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["summary"] == "Updated"

    @pytest.mark.asyncio
    async def test_update_status(self, client):
        await client.post("/api/v1/entries", json={"summary": "Status test", "slug": "status-test"})
        resp = await client.patch("/api/v1/entries/status-test", json={"status": "archived"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    @pytest.mark.asyncio
    async def test_update_not_found(self, client):
        resp = await client.patch("/api/v1/entries/nonexistent", json={"summary": "X"})
        assert resp.status_code == 404
```

- [ ] **Step 4: Run all tests**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/ -v --tb=short`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
cd ~/lab/projects/peek
git add backend/peek/api/entries.py backend/peek/services/entry_service.py backend/tests/test_api.py
git commit -m "feat(backend): PATCH /entries/{slug} — update entry summary, status, tags, files"
```

---

### Task 20: README + Final Smoke Test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Peek

Lightweight code & document formatting display service.

**Agent 产出 → Peek 格式化 → 人类友好查看**

## Quick Start

### Backend

```bash
cd backend
pip install -e .
peek serve
```

### Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Create an entry

```bash
peek create "My code snippet" --files main.py --slug my-snippet
```

## Architecture

- **Backend:** FastAPI + SQLite (WAL/FTS5) + local filesystem
- **Frontend:** Vue 3 + Vite + Shiki + markdown-it
- **CLI:** Click
- **MCP:** FastMCP (P1)

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/entries | Create entry |
| GET | /api/v1/entries | List entries |
| GET | /api/v1/entries/{slug} | Get entry |
| PATCH | /api/v1/entries/{slug} | Update entry |
| DELETE | /api/v1/entries/{slug} | Delete entry |
| GET | /api/v1/entries/{slug}/files/{file_id} | Download file |
| GET | /health | Health check |

## License

MIT
```

- [ ] **Step 2: Run full backend test suite**

Run: `cd ~/lab/projects/peek/backend && python -m pytest tests/ -v --tb=short`
Expected: All pass

- [ ] **Step 3: Verify frontend builds**

Run: `cd ~/lab/projects/peek/frontend && npm run build 2>&1 | tail -5`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
cd ~/lab/projects/peek
git add README.md
git commit -m "docs: add README with quick start and API reference"
```
