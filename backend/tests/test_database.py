"""Tests for database initialization and management."""

import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import Engine, text
from sqlmodel import Session, SQLModel, select

from peekview.database import (
    close_engine,
    get_db_stats,
    get_engine,
    init_db,
    rebuild_fts_index,
    search_entries,
    setup_fts5,
)
from peekview.models import Entry, File


class TestInitDb:
    """Test database initialization."""

    def test_creates_database_file(self, tmp_path: Path):
        """Database file is created."""
        db_path = tmp_path / "test.db"
        assert not db_path.exists()

        engine = init_db(db_path)

        assert db_path.exists()
        engine.dispose()

    def test_creates_parent_directory(self, tmp_path: Path):
        """Parent directory is created if needed."""
        db_path = tmp_path / "nested" / "deep" / "test.db"
        assert not db_path.parent.exists()

        engine = init_db(db_path)

        assert db_path.parent.exists()
        engine.dispose()

    def test_tables_created(self, tmp_path: Path):
        """Tables are created on init."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            )
            tables = {row[0] for row in result}

        assert "entries" in tables
        assert "files" in tables
        engine.dispose()

    def test_wal_mode_enabled(self, tmp_path: Path):
        """WAL mode is enabled."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA journal_mode"))
            mode = result.scalar()

        assert mode == "wal"
        engine.dispose()

    def test_foreign_keys_enabled(self, tmp_path: Path):
        """Foreign keys are enabled."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA foreign_keys"))
            enabled = result.scalar()

        assert enabled == 1
        engine.dispose()

    def test_busy_timeout_set(self, tmp_path: Path):
        """Busy timeout is set."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA busy_timeout"))
            timeout = result.scalar()

        assert timeout == 5000  # 5 seconds
        engine.dispose()


class TestFTS5:
    """Test FTS5 full-text search setup."""

    def test_fts_table_created(self, tmp_path: Path):
        """FTS5 virtual table is created."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
                )
            )
            assert result.scalar() == "entries_fts"

        engine.dispose()

    def test_triggers_created(self, tmp_path: Path):
        """FTS triggers are created."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='trigger'"
                )
            )
            triggers = {row[0] for row in result}

        assert "entries_ai" in triggers
        assert "entries_ad" in triggers
        assert "entries_au" in triggers

        engine.dispose()

    def test_fts_insert_trigger(self, tmp_path: Path):
        """Insert trigger populates FTS."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Python testing")
            session.add(entry)
            session.commit()
            entry_id = entry.id

            # Check FTS
            result = session.exec(
                text("SELECT summary FROM entries_fts WHERE rowid = :id").bindparams(
                    id=entry_id
                )
            )
            assert result.scalar() == "Python testing"

        engine.dispose()

    def test_fts_delete_trigger(self, tmp_path: Path):
        """Delete trigger removes from FTS."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Delete me")
            session.add(entry)
            session.commit()
            entry_id = entry.id

            # Delete
            session.delete(entry)
            session.commit()

            # Check FTS
            result = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(
                    id=entry_id
                )
            )
            assert result.scalar() == 0

        engine.dispose()


class TestSearchEntries:
    """Test full-text search functionality."""

    def test_search_by_summary(self, tmp_path: Path):
        """Can search by summary content."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry1 = Entry(slug="python", summary="Python project")
            entry2 = Entry(slug="javascript", summary="JavaScript app")
            session.add_all([entry1, entry2])
            session.commit()

            # Wait for FTS index
            session.exec(text("INSERT INTO entries_fts(entries_fts) VALUES('optimize')"))

            # Search
            ids = search_entries(session, "Python")
            assert entry1.id in ids
            assert entry2.id not in ids

        engine.dispose()

    def test_search_by_tags(self, tmp_path: Path):
        """Can search by tags."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Test", tags=["python", "fastapi"])
            session.add(entry)
            session.commit()

            session.exec(text("INSERT INTO entries_fts(entries_fts) VALUES('optimize')"))

            ids = search_entries(session, "fastapi")
            assert entry.id in ids

        engine.dispose()

    def test_search_no_results(self, tmp_path: Path):
        """Returns empty list for no matches."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Test")
            session.add(entry)
            session.commit()

            session.exec(text("INSERT INTO entries_fts(entries_fts) VALUES('optimize')"))

            ids = search_entries(session, "nonexistent")
            assert ids == []

        engine.dispose()


class TestGetEngine:
    """Test get_engine convenience function."""

    def test_returns_engine(self, tmp_path: Path):
        """Returns configured engine."""
        db_path = tmp_path / "test.db"
        engine = get_engine(db_path)

        assert isinstance(engine, Engine)
        engine.dispose()


class TestCloseEngine:
    """Test engine cleanup."""

    def test_disposes_engine(self, tmp_path: Path):
        """Engine is properly disposed."""
        engine = init_db(tmp_path / "test.db")
        close_engine(engine)
        # Should not raise

    def test_wal_checkpoint(self, tmp_path: Path):
        """WAL is checkpointed before close."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)
        close_engine(engine)

        # WAL file should be small after checkpoint
        wal_path = db_path.parent / (db_path.name + "-wal")
        if wal_path.exists():
            # Size should be minimal or 0
            assert wal_path.stat().st_size < 65536  # 64KB


class TestGetDbStats:
    """Test database statistics."""

    def test_returns_stats_dict(self, tmp_path: Path):
        """Returns statistics dictionary."""
        engine = init_db(tmp_path / "test.db")

        stats = get_db_stats(engine)

        assert "entry_count" in stats
        assert "file_count" in stats
        assert "fts_doc_count" in stats
        assert "db_size_bytes" in stats
        assert "db_size_mb" in stats

        engine.dispose()

    def test_counts_entries(self, tmp_path: Path):
        """Entry count is accurate."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            session.add_all([
                Entry(slug="a", summary="A"),
                Entry(slug="b", summary="B"),
            ])
            session.commit()

        stats = get_db_stats(engine)
        assert stats["entry_count"] == 2

        engine.dispose()

    def test_counts_files(self, tmp_path: Path):
        """File count is accurate."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Test")
            session.add(entry)
            session.commit()

            session.add_all([
                File(entry_id=entry.id, filename="a.py", size=10),
                File(entry_id=entry.id, filename="b.py", size=20),
            ])
            session.commit()

        stats = get_db_stats(engine)
        assert stats["file_count"] == 2

        engine.dispose()


class TestRebuildFtsIndex:
    """Test FTS index rebuilding."""

    def test_rebuilds_index(self, tmp_path: Path):
        """Rebuilds FTS index from entries."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Rebuild me")
            session.add(entry)
            session.commit()

            # Clear FTS manually
            session.exec(text("DELETE FROM entries_fts"))
            session.commit()

            # Rebuild
            rebuild_fts_index(engine)

            # Check
            result = session.exec(
                text("SELECT COUNT(*) FROM entries_fts")
            )
            assert result.scalar() == 1

        engine.dispose()
