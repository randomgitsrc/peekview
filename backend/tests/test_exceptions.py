"""Tests for exception hierarchy."""

import pytest

from peekview.exceptions import (
    ConflictError,
    DatabaseError,
    FileNotFoundError,
    ForbiddenPathError,
    InvalidSlugError,
    NotFoundError,
    PayloadTooLargeError,
    PeekError,
    StorageError,
    ValidationError,
)


class TestPeekError:
    """Test base PeekError class."""

    def test_default_status_code(self):
        """Base error has 500 status code."""
        exc = PeekError("Something went wrong")
        assert exc.status_code == 500
        assert exc.error_code == "INTERNAL_ERROR"
        assert str(exc) == "Something went wrong"

    def test_default_message(self):
        """Default message is provided."""
        exc = PeekError()
        assert exc.message == "An unexpected error occurred"


class TestValidationError:
    """Test ValidationError."""

    def test_status_code(self):
        """Validation error returns 400."""
        exc = ValidationError("Missing field: summary")
        assert exc.status_code == 400
        assert exc.error_code == "VALIDATION_ERROR"


class TestInvalidSlugError:
    """Test InvalidSlugError."""

    def test_status_code(self):
        """Invalid slug returns 400."""
        exc = InvalidSlugError("Slug contains invalid characters")
        assert exc.status_code == 400
        assert exc.error_code == "INVALID_SLUG"


class TestForbiddenPathError:
    """Test ForbiddenPathError."""

    def test_status_code(self):
        """Forbidden path returns 403."""
        exc = ForbiddenPathError("Access to /etc/shadow is not allowed")
        assert exc.status_code == 403
        assert exc.error_code == "FORBIDDEN_PATH"


class TestNotFoundError:
    """Test NotFoundError."""

    def test_status_code(self):
        """Not found returns 404."""
        exc = NotFoundError("Entry not found: abc123")
        assert exc.status_code == 404
        assert exc.error_code == "NOT_FOUND"


class TestFileNotFoundError:
    """Test FileNotFoundError."""

    def test_status_code(self):
        """File not found returns 404."""
        exc = FileNotFoundError("File not found: /path/to/file.py")
        assert exc.status_code == 404
        assert exc.error_code == "FILE_NOT_FOUND"


class TestPayloadTooLargeError:
    """Test PayloadTooLargeError."""

    def test_status_code(self):
        """Payload too large returns 413."""
        exc = PayloadTooLargeError("File too large")
        assert exc.status_code == 413
        assert exc.error_code == "PAYLOAD_TOO_LARGE"

    def test_with_details(self):
        """Can include limit details."""
        exc = PayloadTooLargeError(
            message="File exceeds size limit",
            limit_type="max_file_size",
            max_bytes=10485760,
            actual_bytes=15728640,
        )
        assert exc.limit_type == "max_file_size"
        assert exc.max_bytes == 10485760
        assert exc.actual_bytes == 15728640


class TestConflictError:
    """Test ConflictError."""

    def test_status_code(self):
        """Conflict returns 409."""
        exc = ConflictError("Entry with slug 'abc' already exists")
        assert exc.status_code == 409
        assert exc.error_code == "CONFLICT"


class TestStorageError:
    """Test StorageError."""

    def test_status_code(self):
        """Storage error returns 500."""
        exc = StorageError("Failed to write file")
        assert exc.status_code == 500
        assert exc.error_code == "STORAGE_ERROR"


class TestDatabaseError:
    """Test DatabaseError."""

    def test_status_code(self):
        """Database error returns 500."""
        exc = DatabaseError("Database connection failed")
        assert exc.status_code == 500
        assert exc.error_code == "DATABASE_ERROR"


class TestExceptionHierarchy:
    """Test that all exceptions are properly subclassed."""

    def test_all_inherit_peek_error(self):
        """All custom exceptions inherit from PeekError."""
        exceptions = [
            ValidationError,
            InvalidSlugError,
            ForbiddenPathError,
            NotFoundError,
            FileNotFoundError,
            PayloadTooLargeError,
            ConflictError,
            StorageError,
            DatabaseError,
        ]
        for exc_class in exceptions:
            assert issubclass(exc_class, PeekError)
