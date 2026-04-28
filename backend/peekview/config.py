"""Configuration management for PeekView.

Uses Pydantic Settings for environment variable and config file support.
"""

import os
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Path to local config file
CONFIG_FILE = Path.home() / ".peekview" / "config.yaml"


def load_config_file() -> dict[str, Any]:
    """Load configuration from YAML config file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            return {}
    return {}


def save_config_file(config: dict[str, Any]) -> None:
    """Save configuration to YAML config file."""
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=True, allow_unicode=True)


class PeekLimits(BaseSettings):
    """Resource limits configuration."""

    max_file_size: int = Field(
        default=10_485_760,  # 10MB
        description="Maximum size for a single file (bytes)",
    )
    max_content_length: int = Field(
        default=1_048_576,  # 1MB
        description="Maximum content length for inline uploads (bytes)",
    )
    max_entry_files: int = Field(
        default=50,
        description="Maximum number of files per entry",
    )
    max_entry_size: int = Field(
        default=104_857_600,  # 100MB
        description="Maximum total size per entry (bytes)",
    )
    max_slug_length: int = Field(
        default=64,
        description="Maximum length for custom slugs",
    )
    max_summary_length: int = Field(
        default=500,
        description="Maximum length for entry summary",
    )
    max_per_page: int = Field(
        default=50,
        description="Maximum items per page for list endpoints",
    )

    @field_validator("max_file_size", "max_content_length", "max_entry_size")
    @classmethod
    def validate_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Size limits must be positive")
        return v

    @field_validator("max_entry_files", "max_slug_length", "max_summary_length")
    @classmethod
    def validate_positive_int(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Count limits must be positive")
        return v


class PeekStorage(BaseSettings):
    """Storage configuration."""

    data_dir: Path = Field(
        default_factory=lambda: Path.home() / ".peekview" / "data",
        description="Directory for file storage",
    )
    db_path: Path = Field(
        default_factory=lambda: Path.home() / ".peekview" / "peekview.db",
        description="Path to SQLite database",
    )
    allowed_paths: list[Path] = Field(
        default_factory=list,
        description="Allowed paths for local_path reads (allowlist)",
    )
    ignored_dirs: set[str] = Field(
        default_factory=lambda: {
            ".git",
            ".svn",
            "__pycache__",
            "node_modules",
            ".venv",
            "venv",
            ".tox",
            "dist",
            "build",
        },
        description="Directories to ignore during recursive scan",
    )

    @field_validator("data_dir", "db_path", mode="before")
    @classmethod
    def expand_path(cls, v: str | Path | None) -> Path:
        if v is None:
            return v
        if isinstance(v, str):
            v = v.replace("~", str(Path.home()))
            return Path(v).expanduser().resolve()
        return v.expanduser().resolve()


class PeekServer(BaseSettings):
    """Server configuration."""

    host: str = Field(
        default="127.0.0.1",
        description="Server bind address (127.0.0.1 for local only)",
    )
    port: int = Field(
        default=8080,
        description="Server port",
    )
    base_url: str = Field(
        default="",
        description="External URL (empty = auto-detect)",
    )
    api_key: str = Field(
        default="",
        description="API key for authentication (empty = no auth)",
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        description="CORS allowed origins",
    )

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v


class PeekCleanup(BaseSettings):
    """Cleanup configuration."""

    check_on_start: bool = Field(
        default=True,
        description="Check for expired entries on startup",
    )
    interval_seconds: int = Field(
        default=3600,
        description="Cleanup interval (0 = disabled)",
    )


class PeekLogging(BaseSettings):
    """Logging configuration."""

    level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Log level",
    )
    log_file: Path | None = Field(
        default=None,
        description="Log file path (None = stderr only)",
    )


class PeekConfig(BaseSettings):
    """Main configuration class.

    Combines all configuration sections. Values can be set via:
    1. Environment variables (PEEKVIEW_HOST, PEEKVIEW_DATA_DIR, etc.) - highest priority
    2. Constructor arguments
    3. Config file (~/.peekview/config.yaml)
    4. Default values - lowest priority
    """

    model_config = SettingsConfigDict(
        env_prefix="PEEKVIEW_",
        env_nested_delimiter="__",
        extra="ignore",
    )

    server: PeekServer = Field(default_factory=PeekServer)
    storage: PeekStorage = Field(default_factory=PeekStorage)
    limits: PeekLimits = Field(default_factory=PeekLimits)
    cleanup: PeekCleanup = Field(default_factory=PeekCleanup)
    logging: PeekLogging = Field(default_factory=PeekLogging)

    def __init__(self, **kwargs: Any) -> None:
        """Initialize config with file overrides."""
        # Load from config file first (lowest priority)
        file_config = load_config_file()

        # Merge file config into kwargs (env vars will override via Pydantic)
        for key, value in file_config.items():
            if key not in kwargs:
                kwargs[key] = value

        super().__init__(**kwargs)

    @property
    def data_dir(self) -> Path:
        """Shortcut to storage.data_dir."""
        return self.storage.data_dir

    @property
    def db_path(self) -> Path:
        """Shortcut to storage.db_path."""
        return self.storage.db_path

    @property
    def allowed_dirs(self) -> list[Path]:
        """Shortcut to storage.allowed_paths for allowlist directories."""
        return self.storage.allowed_paths

    @property
    def ignored_dirs(self) -> set[str]:
        """Shortcut to storage.ignored_dirs for directories to ignore during scan."""
        return self.storage.ignored_dirs

    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist."""
        self.storage.data_dir.mkdir(parents=True, exist_ok=True)
        if self.logging.log_file:
            self.logging.log_file.parent.mkdir(parents=True, exist_ok=True)

    def build_view_url(self, slug: str) -> str:
        """Build the view URL for an entry."""
        if self.server.base_url:
            base = self.server.base_url.rstrip("/")
        else:
            base = f"http://{self.server.host}:{self.server.port}"
        return f"{base}/{slug}"

    def is_local_path_allowed(self, path: Path) -> bool:
        """Check if a local path is in the allowlist.

        If allowed_paths is empty, falls back to data_dir as the only allowed dir.
        """
        resolved = path.resolve()

        # Use allowed_paths if configured, otherwise fall back to data_dir
        allowed_dirs = self.storage.allowed_paths
        if not allowed_dirs:
            allowed_dirs = [self.storage.data_dir]

        for allowed in allowed_dirs:
            try:
                resolved.relative_to(allowed.resolve())
                return True
            except ValueError:
                continue
        return False
