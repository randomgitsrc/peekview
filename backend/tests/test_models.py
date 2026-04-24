"""Tests for data models."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from peekview.models import (
    CreateEntryRequest,
    DirCreate,
    Entry,
    EntryCreate,
    EntryListItem,
    EntryResponse,
    File,
    FileCreate,
    FileInfo,
    generate_slug,
    validate_slug,
)


class TestGenerateSlug:
    """Test slug generation."""

    def test_default_length(self):
        """Default slug is 6 characters."""
        slug = generate_slug()
        assert len(slug) == 6

    def test_custom_length(self):
        """Can specify slug length."""
        slug = generate_slug(8)
        assert len(slug) == 8

    def test_valid_characters(self):
        """Slug contains only valid characters."""
        slug = generate_slug()
        assert all(c.isalnum() for c in slug)

    def test_randomness(self):
        """Multiple slugs are different."""
        slugs = [generate_slug() for _ in range(10)]
        assert len(set(slugs)) == len(slugs)


class TestValidateSlug:
    """Test slug validation."""

    def test_valid_slug(self):
        """Valid slug passes."""
        valid, msg = validate_slug("hello-world_123")
        assert valid
        assert msg == ""

    def test_empty_slug(self):
        """Empty slug fails."""
        valid, msg = validate_slug("")
        assert not valid
        assert "cannot be empty" in msg

    def test_too_long_slug(self):
        """Slug > 64 chars fails."""
        valid, msg = validate_slug("a" * 65)
        assert not valid
        assert "64 characters" in msg

    def test_invalid_characters(self):
        """Invalid characters fail."""
        valid, msg = validate_slug("Hello World")
        assert not valid
        assert "lowercase letters" in msg

    def test_uppercase_fails(self):
        """Uppercase letters fail."""
        valid, msg = validate_slug("HelloWorld")
        assert not valid

    def test_special_chars_fails(self):
        """Special characters fail."""
        valid, msg = validate_slug("hello@world")
        assert not valid


class TestEntryModel:
    """Test Entry database model."""

    def test_entry_creation(self, session: Session):
        """Can create an entry."""
        entry = Entry(
            slug="test-entry",
            summary="A test entry",
            status="active",
        )
        session.add(entry)
        session.commit()

        assert entry.id is not None
        assert entry.slug == "test-entry"
        assert entry.summary == "A test entry"
        assert entry.status == "active"
        assert entry.user_id == "default"
        assert entry.tags == []

    def test_entry_timestamps(self, session: Session):
        """Entry has created_at and updated_at."""
        entry = Entry(slug="test-ts", summary="Timestamp test")
        session.add(entry)
        session.commit()

        assert entry.created_at is not None
        assert entry.updated_at is not None
        assert isinstance(entry.created_at, datetime)

    def test_entry_status_constraint(self, session: Session):
        """Status must be valid enum value."""
        entry = Entry(slug="test-status", summary="Status test", status="archived")
        session.add(entry)
        session.commit()

        assert entry.status == "archived"

    def test_entry_tags_json(self, session: Session):
        """Tags are stored as JSON."""
        entry = Entry(
            slug="test-tags",
            summary="Tags test",
            tags=["python", "test"],
        )
        session.add(entry)
        session.commit()

        assert entry.tags == ["python", "test"]

    def test_entry_expires_at(self, session: Session):
        """Entry can have expiration date."""
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        entry = Entry(
            slug="test-expires",
            summary="Expires test",
            expires_at=expires,
        )
        session.add(entry)
        session.commit()

        assert entry.expires_at is not None


class TestFileModel:
    """Test File database model."""

    def test_file_creation(self, session: Session):
        """Can create a file."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file = File(
            entry_id=entry.id,
            path="src/main.py",
            filename="main.py",
            language="python",
            size=100,
        )
        session.add(file)
        session.commit()

        assert file.id is not None
        assert file.entry_id == entry.id
        assert file.path == "src/main.py"
        assert file.filename == "main.py"
        assert file.language == "python"
        assert file.size == 100
        assert not file.is_binary

    def test_file_without_path(self, session: Session):
        """File can have no path (root-level)."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file = File(
            entry_id=entry.id,
            filename="README.md",
            language="markdown",
            size=50,
        )
        session.add(file)
        session.commit()

        assert file.path is None

    def test_binary_file(self, session: Session):
        """File can be marked as binary."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file = File(
            entry_id=entry.id,
            filename="image.png",
            is_binary=True,
            size=1024,
        )
        session.add(file)
        session.commit()

        assert file.is_binary

    def test_file_sha256(self, session: Session):
        """File can have SHA256 hash."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file = File(
            entry_id=entry.id,
            filename="test.txt",
            sha256="abc123" * 8,  # 64 chars
            size=100,
        )
        session.add(file)
        session.commit()

        assert file.sha256 == "abc123" * 8


class TestEntryFileRelationship:
    """Test Entry-File relationship."""

    def test_entry_files_relationship(self, session: Session):
        """Entry has files relationship."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file1 = File(entry_id=entry.id, filename="a.py", size=10)
        file2 = File(entry_id=entry.id, filename="b.py", size=20)
        session.add_all([file1, file2])
        session.commit()

        # Refresh to load relationship
        session.refresh(entry)
        assert len(entry.files) == 2

    def test_cascade_delete(self, session: Session):
        """Deleting entry cascades to files."""
        entry = Entry(slug="test-entry", summary="Test")
        session.add(entry)
        session.commit()

        file = File(entry_id=entry.id, filename="test.py", size=10)
        session.add(file)
        session.commit()

        # Delete entry
        session.delete(entry)
        session.commit()

        # File should be gone
        result = session.exec(select(File).where(File.entry_id == entry.id))
        assert result.first() is None


class TestEntrySchemas:
    """Test Entry Pydantic schemas."""

    def test_entry_create_validation(self):
        """EntryCreate validates summary length."""
        with pytest.raises(ValueError):
            EntryCreate(summary="")  # Too short

    def test_entry_create_optional_fields(self):
        """EntryCreate has optional slug/tags."""
        create = EntryCreate(summary="Test entry")
        assert create.slug is None
        assert create.tags == []

    def test_entry_create_with_expires_in(self):
        """EntryCreate accepts expires_in."""
        create = EntryCreate(summary="Test", expires_in="7d")
        assert create.expires_in == "7d"


class TestFileSchemas:
    """Test File Pydantic schemas."""

    def test_file_create_validation(self):
        """FileCreate allows optional filename (derived from path in service)."""
        # Empty filename is allowed - will be derived from path or default to "untitled"
        fc = FileCreate(filename="")
        assert fc.filename == ""

        # Also test with path only
        fc2 = FileCreate(path="src/main.py")
        assert fc2.path == "src/main.py"
        assert fc2.filename is None

    def test_file_info(self):
        """FileInfo schema."""
        info = FileInfo(
            id=1,
            path="src/main.py",
            filename="main.py",
            language="python",
            is_binary=False,
            size=100,
            line_count=10,
        )
        assert info.id == 1
        assert info.filename == "main.py"


class TestRequestSchemas:
    """Test API request schemas."""

    def test_create_entry_request(self):
        """CreateEntryRequest schema."""
        req = CreateEntryRequest(
            summary="Test entry",
            files=[
                FileCreate(filename="main.py", content="print('hello')"),
            ],
        )
        assert req.summary == "Test entry"
        assert len(req.files) == 1

    def test_create_entry_with_dirs(self):
        """CreateEntryRequest with directories."""
        req = CreateEntryRequest(
            summary="Test entry",
            dirs=[DirCreate(path="/path/to/src")],
        )
        assert len(req.dirs) == 1


class TestSlugUniqueness:
    """Test slug uniqueness constraint."""

    def test_duplicate_slug_fails(self, session: Session):
        """Cannot have duplicate slugs."""
        entry1 = Entry(slug="unique-slug", summary="First")
        session.add(entry1)
        session.commit()

        entry2 = Entry(slug="unique-slug", summary="Second")
        session.add(entry2)

        with pytest.raises(Exception):  # IntegrityError
            session.commit()
