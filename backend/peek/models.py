"""SQLModel data models for Peek.

Defines Entry and File models with proper relationships,
indexes, and FTS5 integration.
"""

import json
import secrets
import string
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Column, Index, event, text
from sqlalchemy.dialects.sqlite import JSON
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from typing import Optional


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


class EntryBase(SQLModel):
    """Base model for Entry."""

    summary: str = Field(..., min_length=1, max_length=500)
    status: EntryStatus = Field(
        default=EntryStatus.ACTIVE,
        sa_column_kwargs={"server_default": "active"},
    )
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    user_id: str = Field(default="default", sa_column_kwargs={"server_default": "default"})
    expires_at: datetime | None = Field(default=None)


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

    def __repr__(self) -> str:
        return f"<Entry(id={self.id}, slug={self.slug!r})>"


class FileBase(SQLModel):
    """Base model for File."""

    path: str | None = Field(default=None, max_length=500)
    filename: str = Field(..., min_length=1, max_length=255)
    language: str | None = Field(default=None, max_length=50)
    is_binary: bool = Field(default=False)
    size: int = Field(..., ge=0)
    sha256: str | None = Field(default=None, max_length=64)


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
        description="Duration like '7d', '1h', '30m'",
    )


class FileCreate(SQLModel):
    """Schema for creating a file within an entry."""

    path: str | None = Field(default=None, max_length=500)
    filename: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, description="File content as string")
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


class EntryResponse(SQLModel):
    """Schema for entry response (single entry)."""

    id: int
    slug: str
    summary: str
    status: str
    tags: list[str]
    files: list[FileResponse]
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class EntryListItem(SQLModel):
    """Schema for entry in list response."""

    id: int
    slug: str
    summary: str
    tags: list[str]
    status: str
    file_count: int
    created_at: datetime
    updated_at: datetime


class EntryListResponse(SQLModel):
    """Schema for paginated entry list."""

    items: list[EntryListItem]
    total: int
    page: int
    per_page: int


class CreateEntryRequest(SQLModel):
    """Complete request schema for POST /entries."""

    summary: str = Field(..., min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=64)
    tags: list[str] = Field(default_factory=list)
    expires_in: str | None = Field(default=None)
    files: list[FileCreate] = Field(default_factory=list)
    dirs: list[DirCreate] = Field(default_factory=list)


class CreateEntryResponse(SQLModel):
    """Response schema for POST /entries."""

    id: int
    slug: str
    url: str
    created_at: datetime
    files: list[FileResponse]


class ErrorResponse(SQLModel):
    """Standard error response."""

    error: "ErrorDetail"


class ErrorDetail(SQLModel):
    """Error detail in response."""

    code: str
    message: str
    details: dict | None = None
