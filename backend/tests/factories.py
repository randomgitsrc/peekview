"""Test data factories for creating test entries and files."""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlmodel import Session

from peek.models import Entry, File


class EntryFactory:
    """Factory for creating test Entry records."""

    def __init__(self, session: Session):
        self.session = session
        self.counter = 0

    def create(
        self,
        summary: Optional[str] = None,
        slug: Optional[str] = None,
        status: str = "active",
        tags: Optional[list] = None,
        expires_at: Optional[datetime] = None,
    ) -> Entry:
        """Create a test entry with default values."""
        self.counter += 1

        entry = Entry(
            slug=slug or f"test-entry-{self.counter}",
            summary=summary or f"Test entry {self.counter}",
            status=status,
            tags=tags or [],
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.session.add(entry)
        self.session.commit()
        self.session.refresh(entry)
        return entry

    def create_batch(self, count: int, **kwargs) -> list[Entry]:
        """Create multiple test entries."""
        return [self.create(**kwargs) for _ in range(count)]

    def create_expired(self, **kwargs) -> Entry:
        """Create an expired test entry."""
        kwargs["expires_at"] = datetime.utcnow() - timedelta(days=1)
        return self.create(**kwargs)


class FileFactory:
    """Factory for creating test File records."""

    def __init__(self, session: Session):
        self.session = session
        self.counter = 0

    def create(
        self,
        entry_id: int,
        path: Optional[str] = None,
        filename: Optional[str] = None,
        language: Optional[str] = None,
        is_binary: bool = False,
        size: int = 100,
    ) -> File:
        """Create a test file record with default values."""
        self.counter += 1

        file = File(
            entry_id=entry_id,
            path=path,
            filename=filename or f"file-{self.counter}.py",
            language=language or "python",
            is_binary=is_binary,
            size=size,
            created_at=datetime.utcnow(),
        )

        self.session.add(file)
        self.session.commit()
        self.session.refresh(file)
        return file

    def create_batch(self, entry_id: int, count: int, **kwargs) -> list[File]:
        """Create multiple test files for an entry."""
        return [self.create(entry_id=entry_id, **kwargs) for _ in range(count)]


# Convenience functions for one-off creation

def create_test_entry(session: Session, **kwargs) -> Entry:
    """Quick helper to create a single test entry."""
    factory = EntryFactory(session)
    return factory.create(**kwargs)


def create_test_file(session: Session, entry_id: int, **kwargs) -> File:
    """Quick helper to create a single test file."""
    factory = FileFactory(session)
    return factory.create(entry_id=entry_id, **kwargs)
