"""SQLModel data models for PeekView.

Defines Entry and File models with proper relationships,
indexes, and FTS5 integration.
"""

import hmac
import re
import secrets
import string
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import field_validator
from sqlalchemy import Column, ForeignKey, Index, text
from sqlalchemy.dialects.sqlite import JSON
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    pass


# Valid slug characters: lowercase letters, digits, underscores, hyphens
SLUG_PATTERN = r"^[a-z0-9_-]+$"
VALID_SLUG_CHARS = set(string.ascii_lowercase + string.digits + "_-")


class EntryStatus(str, Enum):
    """Entry status enum."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    PUBLISHED = "published"


def generate_slug(length: int = 6) -> str:
    """Generate a random slug.

    Uses URL-safe characters excluding _ and - for maximum compatibility.
    """
    # Use only alphanumeric for random part
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def validate_slug(slug: str) -> tuple[bool, str]:
    """Validate a slug.

    Args:
        slug: The slug to validate

    Returns:
        (is_valid, error_message)
    """
    if not slug:
        return False, "Slug cannot be empty"

    if len(slug) > 64:
        return False, "Slug cannot exceed 64 characters"

    if not all(c in VALID_SLUG_CHARS for c in slug):
        return False, "Slug can only contain lowercase letters, digits, underscores, and hyphens"

    return True, ""


def now_utc() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


API_KEY_PREFIX = "pv_"
API_KEY_HMAC_KEY = b"peekview-api-key"


def hash_api_key(key: str) -> str:
    """HMAC-SHA256 hash of an API key."""
    return hmac.new(API_KEY_HMAC_KEY, key.encode(), "sha256").hexdigest()


class EntryBase(SQLModel):
    """Base model for Entry."""

    summary: str = Field(..., min_length=1, max_length=500)
    status: EntryStatus = Field(
        default=EntryStatus.ACTIVE,
        sa_column_kwargs={"server_default": "active"},
    )
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    user_id: str = Field(default="default", sa_column_kwargs={"server_default": "default"})
    is_public: bool = Field(default=True, sa_column_kwargs={"server_default": "1"})
    owner_id: int | None = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )
    expires_at: datetime | None = Field(default=None)
    archived_at: datetime | None = Field(default=None)


class UserBase(SQLModel):
    """Base model for User."""

    username: str = Field(..., min_length=3, max_length=32, unique=True, index=True)
    password_hash: str = Field(..., max_length=128)
    display_name: str | None = Field(default=None, max_length=64)
    is_active: bool = Field(default=True, sa_column_kwargs={"server_default": "1"})
    is_admin: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})


class User(UserBase, table=True):
    """User model - represents a registered user.

    Attributes:
        id: Primary key
        username: Login name (3-32 chars, alphanumeric + underscore + hyphen)
        password_hash: bcrypt hash (rounds=12)
        display_name: Optional display name (falls back to username)
        is_active: Whether the user is enabled (disabled users cannot login)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    updated_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={
            "server_default": text("CURRENT_TIMESTAMP"),
            "onupdate": text("CURRENT_TIMESTAMP"),
        },
    )

    # Relationships
    entries: list["Entry"] = Relationship(back_populates="owner")
    api_keys: list["ApiKey"] = Relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username!r})>"


class ApiKey(SQLModel, table=True):
    """API Key model — bound to user, permissions equivalent to JWT."""

    __tablename__ = "api_keys"
    __table_args__ = (
        Index("idx_api_keys_user_name", "user_id", "name", unique=True),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", index=True)
    name: str = Field(..., min_length=1, max_length=64)
    key_prefix: str = Field(..., max_length=8)
    key_hash: str = Field(..., max_length=64, unique=True)
    expires_at: datetime | None = Field(default=None)
    last_used_at: datetime | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    updated_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={
            "server_default": text("CURRENT_TIMESTAMP"),
            "onupdate": text("CURRENT_TIMESTAMP"),
        },
    )

    # Relationships
    user: User = Relationship(back_populates="api_keys")

    def __repr__(self) -> str:
        return f"<ApiKey(id={self.id}, name={self.name!r}, prefix={self.key_prefix!r})>"


class Entry(EntryBase, table=True):
    """Entry model - represents a document/code showcase.

    Attributes:
        id: Internal primary key (auto-incrementing integer)
        slug: URL-friendly unique identifier
        summary: Human-readable description
        status: active, archived, or published
        tags: List of string tags (stored as JSON)
        user_id: For future multi-user support (currently "default")
        expires_at: Optional expiration datetime
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "entries"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(..., index=True, unique=True)

    idempotency_key: str | None = Field(
        default=None,
        max_length=128,
        sa_column_kwargs={"nullable": True, "default": None},
    )

    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    updated_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={
            "server_default": text("CURRENT_TIMESTAMP"),
            "onupdate": text("CURRENT_TIMESTAMP"),
        },
    )

    # Relationships
    files: list["File"] = Relationship(
        back_populates="entry",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    shares: list["EntryShare"] = Relationship(
        back_populates="entry",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    owner: User | None = Relationship(back_populates="entries")

    def __repr__(self) -> str:
        return f"<Entry(id={self.id}, slug={self.slug!r})>"


class EntryShare(SQLModel, table=True):
    """Share link model — grants temporary read access to private entries."""

    __tablename__ = "entry_shares"
    __table_args__ = (
        Index("idx_entry_shares_entry_prefix", "entry_id", "token_prefix"),
    )

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entries.id", index=True)
    token_hash: str = Field(unique=True, max_length=64, index=True)
    token_prefix: str = Field(max_length=8)
    expires_at: datetime | None = Field(default=None)
    max_views: int | None = Field(default=None, ge=1)
    view_count: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    created_by: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    revoked_at: datetime | None = Field(default=None)

    entry: Entry | None = Relationship(back_populates="shares")
    creator: User | None = Relationship()

    def __repr__(self) -> str:
        return f"<EntryShare(id={self.id}, prefix={self.token_prefix!r})>"


class EntryRead(SQLModel, table=True):
    __tablename__ = "entry_reads"
    __table_args__ = (
        Index("idx_entry_reads_entry_id", "entry_id"),
        Index("idx_entry_reads_entry_channel", "entry_id", "channel"),
        Index("idx_entry_reads_reader", "reader_id"),
        Index("idx_entry_reads_read_at", "read_at"),
        {"sqlite_autoincrement": True},
    )

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int | None = Field(default=None, index=True)
    action: str = Field(default="read", max_length=20)
    channel: str = Field(default="api", max_length=20)
    reader_type: str = Field(default="anonymous", max_length=20)
    reader_id: int | None = Field(default=None)
    is_self_read: bool = Field(default=False)
    count: int = Field(default=1)
    window_key: str = Field(unique=True, max_length=200)
    reader_fingerprint: str = Field(default="", max_length=50)
    read_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class ReadStatsResponse(SQLModel):
    total_count: int = 0
    unique_readers: int = 0
    by_channel: dict[str, int] = {}
    last_read_at: datetime | None = None


class ReadEventResponse(SQLModel):
    id: int
    action: str
    channel: str
    reader_type: str
    reader_id: int | None
    is_self_read: bool
    count: int
    read_at: datetime
    updated_at: datetime


class ReadEventListResponse(SQLModel):
    items: list[ReadEventResponse]
    total: int
    page: int
    per_page: int


class FileBase(SQLModel):
    """Base model for File."""

    path: str | None = Field(default=None, max_length=500)
    filename: str = Field(..., min_length=1, max_length=255)
    language: str | None = Field(default=None, max_length=50)
    is_binary: bool = Field(default=False)
    size: int = Field(..., ge=0)
    sha256: str | None = Field(default=None, max_length=64)
    line_count: int | None = Field(default=None, ge=0)


class File(FileBase, table=True):
    """File model - represents a file within an entry.

    Attributes:
        id: Internal primary key
        entry_id: Foreign key to parent entry
        path: Relative path within entry (e.g., "src/main.py")
        filename: Just the filename (e.g., "main.py")
        language: Detected language (e.g., "python")
        is_binary: Whether file is binary (not text)
        size: File size in bytes
        sha256: SHA256 hash of content (for integrity)
        created_at: Creation timestamp
    """

    __tablename__ = "files"

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(..., foreign_key="entries.id", index=True)
    created_at: datetime = Field(
        default_factory=now_utc,
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )

    # Relationships
    entry: Entry = Relationship(back_populates="files")

    def __repr__(self) -> str:
        return f"<File(id={self.id}, path={self.path!r})>"


# Additional indexes
Index("idx_entries_status", Entry.status)
Index("idx_entries_user_id", Entry.user_id)
Index("idx_entries_is_public", Entry.is_public)
Index("idx_entries_is_public_status_created", Entry.is_public, Entry.status, Entry.created_at.desc())
Index("idx_entries_expires_at", Entry.expires_at)
Index("idx_entries_created_at", Entry.created_at)
Index("idx_entries_updated_at", Entry.updated_at)


# FTS5 setup for full-text search
class EntryFTS(SQLModel):
    """FTS5 virtual table for full-text search.

    Mirrors summary and tags from Entry for efficient search.
    Note: The actual FTS5 table is created via raw SQL in database.py
    """

    # This is not a real table - FTS5 table is created manually in database.py
    # We define this as a non-table model to avoid SQLModel issues
    pass


# Pydantic schemas for API


class EntryCreate(SQLModel):
    """Schema for creating a new entry.

    All fields are optional except summary (validated in service).
    """

    summary: str = Field(..., min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=64)
    tags: list[str] = Field(default_factory=list)
    expires_in: str | None = Field(
        default=None,
        description="Duration like '7d', '1h', '30m'. Default: server-configured (see /api/v1/config/limits). Use '0' for no expiration.",
    )


class FileCreate(SQLModel):
    """Schema for creating a file within an entry."""

    path: str | None = Field(default=None, max_length=500)
    filename: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, description="File content as string")
    content_base64: str | None = Field(
        default=None,
        description="File content as base64-encoded string (for binary files)",
    )
    local_path: str | None = Field(
        default=None,
        description="Server-side path to read from (requires allowlist)",
    )


class DirCreate(SQLModel):
    """Schema for creating files from a directory."""

    path: str = Field(..., description="Server-side directory path to scan")


class EntryUpdate(SQLModel):
    """Schema for updating an entry."""

    summary: str | None = Field(default=None, min_length=1, max_length=500)
    status: EntryStatus | None = Field(default=None)
    tags: list[str] | None = Field(default=None)
    is_public: bool | None = Field(default=None)
    expires_in: str | None = Field(default=None, description="Duration like '7d', '1h', '0' for never. Reactivates archived entries.")
    add_files: list[FileCreate] | None = Field(default=None)
    remove_file_ids: list[int] | None = Field(default=None)
    add_dirs: list[DirCreate] | None = Field(default=None)


class FileInfo(SQLModel):
    """Schema for file metadata in API responses."""

    id: int
    path: str | None
    filename: str
    language: str | None
    is_binary: bool
    size: int
    line_count: int | None = Field(
        default=None,
        description="Number of lines (for text files)",
    )


class FileResponse(SQLModel):
    """Schema for file in entry response."""

    id: int
    path: str | None
    filename: str
    language: str | None
    is_binary: bool
    size: int
    line_count: int | None = Field(
        default=None,
        description="Number of lines (for text files)",
    )


class EntryShareContext(SQLModel):
    is_share_access: bool = False
    shared_by: str | None = None


class EntryResponse(SQLModel):
    """Schema for entry response (single entry)."""

    id: int
    slug: str
    summary: str
    status: str
    tags: list[str]
    files: list[FileResponse]
    is_public: bool
    owner_id: int | None
    username: str | None
    expires_at: datetime | None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    share_context: EntryShareContext | None = None
    revoked_shares: int | None = None
    read_stats: ReadStatsResponse | None = None


class EntryListItem(SQLModel):
    """Schema for entry in list response."""

    id: int
    slug: str
    summary: str
    tags: list[str]
    status: str
    file_count: int
    is_public: bool
    owner_id: int | None
    username: str | None
    expires_at: datetime | None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class RawFileItem(SQLModel):
    """Single file raw content for /raw endpoint."""
    id: int
    filename: str
    path: str | None = None
    language: str | None = None
    is_binary: bool
    size: int
    content: str | None = None
    content_encoding: str | None = None
    file_url: str | None = None


class EntryRawResponse(SQLModel):
    """Response for GET /api/v1/entries/{slug}/raw."""
    slug: str
    summary: str
    tags: list[str]
    created_at: datetime
    files: list[RawFileItem]
    raw_url: str


class EntryListResponse(SQLModel):
    """Schema for paginated entry list."""

    items: list[EntryListItem]
    total: int
    page: int
    per_page: int
    owner_found: bool | None = Field(
        default=None,
        description="Tri-state: None=owner not specified or 'me' (N/A), "
        "True=username exists in database, "
        "False=username not found",
    )


class CreateEntryRequest(SQLModel):
    """Complete request schema for POST /entries."""

    summary: str = Field(..., min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=64)
    tags: list[str] = Field(default_factory=list)
    is_public: bool = Field(default=True)
    expires_in: str | None = Field(
        default=None,
        description="Duration like '7d', '1h', '30m'. Default: server-configured (see /api/v1/config/limits). Use '0' for no expiration.",
    )
    files: list[FileCreate] = Field(default_factory=list)
    dirs: list[DirCreate] = Field(default_factory=list)
    idempotency_key: str | None = Field(
        default=None,
        max_length=128,
        description="Idempotency key for safe retries. Same key + same owner returns existing entry (200). Cross-owner key returns 409.",
    )

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, v: str | None) -> str | None:
        if v is not None and v.strip() == "":
            raise ValueError("idempotency_key must not be empty")
        return v


class CreateEntryResponse(SQLModel):
    """Response schema for POST /entries."""

    id: int
    slug: str
    url: str
    is_public: bool
    owner_id: int | None
    expires_at: datetime | None
    created_at: datetime
    files: list[FileResponse]


# Auth schemas


RESERVED_USERNAMES = {"default", "system", "admin"}


class UserRegister(SQLModel):
    """Schema for user registration."""

    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=72)
    display_name: str | None = Field(default=None, max_length=64)
    captcha_token: str | None = Field(default=None, description="Cap captcha token (required when captcha enabled)")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if v.lower() in RESERVED_USERNAMES:
            raise ValueError(f"Username '{v}' is reserved")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username must contain only letters, digits, underscores, and hyphens")
        return v


class UserLogin(SQLModel):
    """Schema for user login."""

    username: str
    password: str
    captcha_token: str | None = Field(default=None, description="Cap captcha token (required when captcha enabled)")


class UserResponse(SQLModel):
    """Schema for user in API responses."""

    id: int
    username: str
    display_name: str | None
    is_active: bool
    is_admin: bool
    created_at: datetime


class AuthResponse(SQLModel):
    """Schema for auth response (login/register)."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ErrorResponse(SQLModel):
    """Standard error response."""

    error: "ErrorDetail"


class ErrorDetail(SQLModel):
    """Error detail in response."""

    code: str
    message: str
    details: dict | None = None


# API Key schemas


class ApiKeyCreate(SQLModel):
    """Schema for creating an API key."""

    name: str = Field(..., min_length=1, max_length=64)
    expires_in: str | None = Field(
        default=None,
        description="Duration like '30d', '1h', '6m'",
    )


class ApiKeyResponse(SQLModel):
    """Schema for API key in list responses (no secret, no hash)."""

    id: int
    name: str
    key_prefix: str
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime


class ApiKeyCreateResponse(SQLModel):
    """Schema for create API key response (includes plaintext key once)."""

    id: int
    name: str
    key: str
    key_prefix: str
    expires_at: datetime | None
    created_at: datetime


# Admin schemas


class EntryStats(SQLModel):
    total: int
    public: int
    private: int
    expired: int
    active: int
    latest_created_at: datetime | None


class ApiKeyStats(SQLModel):
    total: int
    expired: int


class StorageStats(SQLModel):
    data_dir_mb: float
    db_mb: float


class AdminStatsResponse(SQLModel):
    users: int
    entries: EntryStats
    api_keys: ApiKeyStats
    storage: StorageStats


class AdminCleanupResponse(SQLModel):
    archived_count: int = 0
    archived_slugs: list[str] = Field(default_factory=list)
    deleted_count: int = 0
    deleted_slugs: list[str] = Field(default_factory=list)
    freed_mb: float = 0.0


class ResetPasswordRequest(SQLModel):
    new_password: str = Field(..., min_length=8, max_length=72)


class ChangePasswordRequest(SQLModel):
    old_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(..., min_length=8, max_length=72)


# Share schemas


class ShareCreateRequest(SQLModel):
    expires_in: str | None = Field(
        default="7d",
        description="Duration: 1h, 24h, 7d, 30d, or 0 for permanent",
    )
    max_views: int | None = Field(
        default=None, ge=1, le=100000,
        description="Max view count. null = unlimited",
    )


class ShareResponse(SQLModel):
    id: int
    token_prefix: str
    expires_at: datetime | None
    max_views: int | None
    view_count: int
    created_by: int
    created_at: datetime
    revoked_at: datetime | None


class ShareCreateResponse(ShareResponse):
    share_url: str


class ShareListResponse(SQLModel):
    shares: list[ShareResponse]
    total: int


class ShareRevokeRequest(SQLModel):
    share_ids: list[int] = Field(..., min_length=1)


class BackupMetadata(SQLModel):
    version: str
    timestamp: str
    file_checksums: dict[str, str]


class ConflictInfo(SQLModel):
    type: str
    value: str
    backup_id: int | None = None


class RestorePreview(SQLModel):
    entry_count: int
    user_count: int
    api_key_count: int
    share_count: int
    read_count: int
    conflicts: list[ConflictInfo]
    version_check: str


class RestoreResult(SQLModel):
    users_imported: int
    entries_imported: int
    files_imported: int
    api_keys_imported: int
    shares_imported: int
    reads_imported: int
    conflicts_resolved: int
    fts_rebuilt: bool
    version_check: str = "compatible"
