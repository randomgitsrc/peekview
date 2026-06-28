"""Configuration management for PeekView.

Uses Pydantic Settings for environment variable and config file support.
"""

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
        default=20_971_520,  # 20MB
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
    default_expires_in: str = Field(
        default="15d",
        description="Default expiration duration for new entries (e.g., '15d', '7d', '1h'). Use '0' for no expiration (defaults to never).",
    )

    @field_validator("default_expires_in", mode="after")
    @classmethod
    def validate_default_expires_in(cls, v: str) -> str:
        import logging

        from peekview.services.file_service import parse_expires_in
        _config_logger = logging.getLogger("peekview.config")
        try:
            parse_expires_in(v)
        except ValueError as exc:
            _config_logger.warning(
                "Invalid PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=%r: %s. Falling back to '15d'.",
                v, exc,
            )
            return "15d"
        return v

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
    health_disk_warning_mb: int = Field(
        default=100,
        description="Warn in health check when available disk space drops below this (MB)",
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
        default="0.0.0.0",
        description="Server bind address (0.0.0.0 for all interfaces, 127.0.0.1 for local only)",
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
    rate_limit_enabled: bool = Field(
        default=True,
        description="Enable rate limiting on sensitive endpoints",
    )
    rate_limit_per_minute: int = Field(
        default=60,
        description="Default rate limit (requests per minute per IP)",
    )
    rate_limit_login_per_minute: int = Field(
        default=10,
        description="Rate limit for login/register attempts (per minute per IP)",
    )

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator("rate_limit_per_minute", "rate_limit_login_per_minute")
    @classmethod
    def validate_positive_rate(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Rate limits must be positive")
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


class PeekRemote(BaseSettings):
    """Remote CLI client configuration.

    Used when CLI operates in remote mode, connecting to a remote PeekView server
    via HTTP API instead of local SQLite database.
    """

    url: str = Field(
        default="",
        description="Remote server base URL (e.g., https://example.com)",
    )
    api_key: str = Field(
        default="",
        description="API key for remote authentication (empty = no auth)",
    )
    token: str = Field(
        default="",
        description="JWT token for remote user authentication (from peekview login)",
    )
    timeout: int = Field(
        default=30,
        description="HTTP request timeout in seconds",
    )
    verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates",
    )

    @field_validator("timeout")
    @classmethod
    def validate_timeout(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Timeout must be positive")
        return v


class PeekAuth(BaseSettings):
    """Authentication configuration."""

    secret_key: str = Field(
        default="",
        description="JWT signing key (empty = auto-generate and persist to ~/.peekview/.secret_key)",
    )
    token_expire_days: int = Field(
        default=7,
        description="JWT token validity in days",
    )
    allow_registration: bool = Field(
        default=True,
        description="Whether to allow new user registration",
    )
    allow_anonymous_create: bool = Field(
        default=True,
        description="Allow anonymous (unauthenticated) entry creation",
    )
    # Cap captcha integration (self-hosted, no third-party tracking)
    captcha_enabled: bool = Field(
        default=False,
        description="Enable Cap captcha verification on /auth/register and /auth/login",
    )
    captcha_site_key: str = Field(
        default="peekview-default",
        description="Cap site key (public, exposed to frontend via /api/v1/config/captcha)",
    )
    captcha_secret_key: str = Field(
        default="",
        description="Secret key for captcha JWT signing (builtin mode) and external Cap verification. Auto-generated if empty.",
    )
    captcha_verify_url: str = Field(
        default="http://localhost:3000",
        description="Cap standalone server URL for /siteverify",
    )
    captcha_exempt_first_user: bool = Field(
        default=True,
        description="First user (admin) bypasses captcha to enable initial setup",
    )
    # ─── Builtin captcha engine params (v0.1.44+) ─────────────────────
    captcha_builtin_difficulty: int = Field(
        default=2,
        description="PoW difficulty (hex prefix length to match)",
    )
    captcha_builtin_challenge_count: int = Field(
        default=10,
        description="Number of PoW challenges per verification",
    )
    captcha_builtin_challenge_size: int = Field(
        default=32,
        description="Salt size (bytes) for each challenge",
    )
    captcha_builtin_challenge_ttl_ms: int = Field(
        default=600_000,  # 10 min
        description="Challenge JWT TTL in milliseconds",
    )
    captcha_builtin_token_ttl_ms: int = Field(
        default=1_200_000,  # 20 min
        description="Redeem token TTL in milliseconds",
    )

    @field_validator("token_expire_days")
    @classmethod
    def validate_expire_days(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Token expire days must be positive")
        return v


DEBUG_DATA_DIR = Path("/tmp/peekview-debug/data")
DEBUG_DB_PATH = Path("/tmp/peekview-debug/peekview.db")


class PeekConfig(BaseSettings):
    """Main configuration class.

    Combines all configuration sections. Values can be set via:
    1. Environment variables (PEEKVIEW_SERVER__HOST, PEEKVIEW_STORAGE__DATA_DIR, etc.) - highest priority
    2. Constructor arguments
    3. Config file (~/.peekview/config.yaml)
    4. Default values - lowest priority

    Debug mode: When PEEKVIEW_DEBUG_MODE=1 is set, storage defaults are automatically
    redirected to /tmp/peekview-debug/ to prevent accidental writes to production data.
    This affects only the default values — explicit env vars or constructor args still win.

    Note: Use __ separator for nested config (e.g., storage.data_dir -> PEEKVIEW_STORAGE__DATA_DIR)
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
    remote: PeekRemote = Field(default_factory=PeekRemote)
    auth: PeekAuth = Field(default_factory=PeekAuth)
    debug_mode: bool = Field(
        default=False,
        description="Debug mode: isolates storage to /tmp/peekview-debug/ to protect production data",
    )

    def __init__(self, **kwargs: Any) -> None:
        """Initialize config with file overrides (env vars have highest priority)."""
        import os as _os

        is_debug = _os.environ.get("PEEKVIEW_DEBUG_MODE", "").strip() in ("1", "true", "yes")

        if is_debug and "debug_mode" not in kwargs:
            kwargs["debug_mode"] = True

        if kwargs.get("debug_mode") and "storage" not in kwargs:
            has_storage_env = (
                "PEEKVIEW_STORAGE__DATA_DIR" in _os.environ
                or "PEEKVIEW_STORAGE__DB_PATH" in _os.environ
            )
            if not has_storage_env:
                kwargs["storage"] = PeekStorage(
                    data_dir=DEBUG_DATA_DIR,
                    db_path=DEBUG_DB_PATH,
                )

        if kwargs.get("debug_mode") and "auth" not in kwargs:
            has_auth_env = any(
                v.startswith("PEEKVIEW_AUTH__")
                for v in _os.environ
            )
            if not has_auth_env:
                kwargs["auth"] = PeekAuth(captcha_enabled=False)

        file_config = load_config_file()

        env_prefix = self.model_config.get("env_prefix", "")
        env_delim = self.model_config.get("env_nested_delimiter", "__")

        file_config = {k: v for k, v in file_config.items() if v is not None}

        for key, value in file_config.items():
            if key in kwargs:
                continue

            skip_key = False
            if isinstance(value, dict):
                for nested_key in value.keys():
                    env_var = f"{env_prefix}{key.upper()}{env_delim}{nested_key.upper()}"
                    if env_var in _os.environ:
                        skip_key = True
                        break

            if skip_key:
                merged_value = value.copy()
                for nested_key in value.keys():
                    env_var = f"{env_prefix}{key.upper()}{env_delim}{nested_key.upper()}"
                    if env_var in _os.environ:
                        merged_value[nested_key] = _os.environ[env_var]
                kwargs[key] = merged_value
            else:
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
