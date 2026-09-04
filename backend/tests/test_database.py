"""Tests for database initialization and management."""

from pathlib import Path

from sqlalchemy import Engine, text
from sqlmodel import Session

from peekview.database import (
    close_engine,
    get_db_stats,
    get_engine,
    init_db,
    rebuild_fts_index,
    search_entries,
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
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
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
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'")
            )
            assert result.scalar() == "entries_fts"

        engine.dispose()

    def test_triggers_created(self, tmp_path: Path):
        """FTS triggers are created (DELETE + DELETE-only UPDATE, no INSERT)."""
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='trigger'"))
            triggers = {row[0] for row in result}

        assert "entries_ai" not in triggers
        assert "entries_ad" in triggers
        assert "entries_au" in triggers

        engine.dispose()

    def test_fts_app_layer_write(self, tmp_path: Path):
        """Application layer populates FTS (no INSERT trigger)."""
        from peekview.text_utils import tokenize_for_fts

        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Python testing")
            session.add(entry)
            session.commit()
            entry_id = entry.id

            session.exec(text("DELETE FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id))
            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry_id,
                    summary=tokenize_for_fts(entry.summary),
                    tags="",
                    content="",
                )
            )
            session.commit()

            result = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id)
            )
            assert result.scalar() == 1

        engine.dispose()

    def test_fts_delete_trigger(self, tmp_path: Path):
        """Delete trigger removes from FTS."""
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Delete me")
            session.add(entry)
            session.commit()
            entry_id = entry.id

            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry_id,
                    summary=entry.summary,
                    tags="",
                    content="",
                )
            )
            session.commit()

            # Delete
            session.delete(entry)
            session.commit()

            # Check FTS
            result = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id)
            )
            assert result.scalar() == 0

        engine.dispose()


class TestSearchEntries:
    """Test full-text search functionality."""

    def test_search_by_summary(self, tmp_path: Path):
        """Can search by summary content."""
        from peekview.text_utils import tokenize_for_fts

        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry1 = Entry(slug="python", summary="Python project")
            entry2 = Entry(slug="javascript", summary="JavaScript app")
            session.add_all([entry1, entry2])
            session.commit()

            for e in [entry1, entry2]:
                session.exec(
                    text(
                        "INSERT INTO entries_fts(rowid, summary, tags, content) "
                        "VALUES (:id, :summary, :tags, :content)"
                    ).bindparams(
                        id=e.id,
                        summary=tokenize_for_fts(e.summary),
                        tags="",
                        content="",
                    )
                )
            session.commit()

            session.exec(text("INSERT INTO entries_fts(entries_fts) VALUES('optimize')"))

            # Search
            ids = search_entries(session, "Python")
            assert entry1.id in ids
            assert entry2.id not in ids

        engine.dispose()

    def test_search_by_tags(self, tmp_path: Path):
        """Can search by tags."""
        from peekview.text_utils import tokenize_for_fts

        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Test", tags=["python", "fastapi"])
            session.add(entry)
            session.commit()

            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry.id,
                    summary="",
                    tags=tokenize_for_fts(" ".join(entry.tags or [])),
                    content="",
                )
            )
            session.commit()

            session.exec(text("INSERT INTO entries_fts(entries_fts) VALUES('optimize')"))

            ids = search_entries(session, "fastapi")
            assert entry.id in ids

        engine.dispose()

    def test_search_no_results(self, tmp_path: Path):
        """Returns empty list for no matches."""
        from peekview.text_utils import tokenize_for_fts

        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="test", summary="Test")
            session.add(entry)
            session.commit()

            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry.id,
                    summary=tokenize_for_fts(entry.summary),
                    tags="",
                    content="",
                )
            )
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
            session.add_all(
                [
                    Entry(slug="a", summary="A"),
                    Entry(slug="b", summary="B"),
                ]
            )
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

            session.add_all(
                [
                    File(entry_id=entry.id, filename="a.py", size=10),
                    File(entry_id=entry.id, filename="b.py", size=20),
                ]
            )
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
            result = session.exec(text("SELECT COUNT(*) FROM entries_fts"))
            assert result.scalar() == 1

        engine.dispose()


class TestFTS5ContentlessProbe:
    """Runtime probe for FTS5 contentless_delete support."""

    def test_probe_true_on_modern_sqlite(self, tmp_path: Path):
        from peekview.database import _fts5_supports_contentless_delete

        engine = init_db(tmp_path / "probe.db")
        with engine.connect() as conn:
            assert _fts5_supports_contentless_delete(conn) is True
        engine.dispose()

    def test_probe_false_when_option_rejected(self):
        """If the FTS5 build rejects the option, probe returns False cleanly."""
        from types import SimpleNamespace

        from sqlalchemy.exc import OperationalError
        from sqlalchemy.sql.elements import TextClause

        from peekview.database import _fts5_supports_contentless_delete

        calls: list[str] = []

        class FailingConn:
            def execute(self, statement: TextClause, *args, **kwargs):
                calls.append(str(statement))
                raise OperationalError("unrecognized option", None, 'unrecognized option: "contentless_delete"')

            def rollback(self):
                calls.append("rollback")

        conn = SimpleNamespace(execute=FailingConn().execute, rollback=FailingConn().rollback)
        # wrap to keep instance state
        failing = FailingConn()
        conn = SimpleNamespace(
            execute=lambda stmt, *a, **k: failing.execute(stmt, *a, **k),
            rollback=lambda: failing.rollback(),
        )
        assert _fts5_supports_contentless_delete(conn) is False
        assert any("fts5_contentless_probe" in c for c in calls)
        assert "rollback" in calls


class TestFTS5SqliteCompat:
    """FTS5 DDL adapts to SQLite version (contentless_delete requires >= 3.43.0)."""

    def test_new_sqlite_uses_contentless_delete(self, tmp_path: Path):
        """Hosts with SQLite >= 3.43 keep the compact contentless index."""
        import sqlite3

        if sqlite3.sqlite_version_info < (3, 43, 0):
            import pytest

            pytest.skip("host sqlite < 3.43.0")

        engine = init_db(tmp_path / "new.db")

        with engine.connect() as conn:
            sql = conn.execute(
                text("SELECT sql FROM sqlite_master WHERE name='entries_fts'")
            ).scalar()

        assert sql is not None
        assert "contentless_delete" in sql

        engine.dispose()

    def test_old_sqlite_falls_back_to_plain_fts(self, tmp_path: Path, monkeypatch):
        """Hosts whose FTS5 lacks contentless_delete get a plain FTS5 table."""
        monkeypatch.setattr(
            "peekview.database._fts5_supports_contentless_delete", lambda conn: False
        )
        engine = init_db(tmp_path / "old.db")

        with engine.connect() as conn:
            sql = conn.execute(
                text("SELECT sql FROM sqlite_master WHERE name='entries_fts'")
            ).scalar()

        assert sql is not None
        assert "contentless_delete" not in sql
        assert "content=''" not in sql

        engine.dispose()

    def test_old_sqlite_plain_fts_full_flow(self, tmp_path: Path, monkeypatch):
        """Plain FTS5 fallback supports app-layer write and delete trigger flow."""
        monkeypatch.setattr(
            "peekview.database._fts5_supports_contentless_delete", lambda conn: False
        )
        engine = init_db(tmp_path / "old_flow.db")

        with Session(engine) as session:
            entry = Entry(slug="compat", summary="compat entry")
            session.add(entry)
            session.commit()
            entry_id = entry.id

            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(id=entry_id, summary="compat entry", tags="", content="body")
            )
            session.commit()

            row = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id)
            )
            assert row.scalar() == 1

            session.delete(entry)
            session.commit()

            row = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id)
            )
            assert row.scalar() == 0

        engine.dispose()


class TestJournalModeOverride:
    """PEEKVIEW_DATABASE__JOURNAL_MODE supports NFS deployments (e.g. PythonAnywhere)."""

    def test_journal_mode_env_override(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("PEEKVIEW_DATABASE__JOURNAL_MODE", "DELETE")
        engine = init_db(tmp_path / "journal.db")

        with engine.connect() as conn:
            mode = conn.execute(text("PRAGMA journal_mode")).scalar()

        assert str(mode).lower() == "delete"
        engine.dispose()

    def test_journal_mode_default_is_wal(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("PEEKVIEW_DATABASE__JOURNAL_MODE", raising=False)
        engine = init_db(tmp_path / "wal.db")

        with engine.connect() as conn:
            mode = conn.execute(text("PRAGMA journal_mode")).scalar()

        assert str(mode).lower() == "wal"
        engine.dispose()
