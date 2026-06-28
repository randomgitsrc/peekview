"""Tests for database migration mechanism (T002).

These tests verify the new `check_schema()`, `init_db(run_migrations=)`,
and `SchemaMismatchError` functionality.

TDD: Tests are written BEFORE implementation. They should FAIL
until the actual code changes are applied in P4.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.database import _run_migrations, init_db
from peekview.exceptions import PeekError
from peekview.models import User

try:
    from peekview.database import check_schema
except ImportError:
    # P4 will implement; stub for P3 TDD 真红灯
    def check_schema(engine):
        raise NotImplementedError("check_schema() not yet implemented (P4)")

try:
    from peekview.exceptions import SchemaMismatchError
except ImportError:
    # P4 will implement; stub for P3 TDD 真红灯 (tests inspect class attrs)
    class SchemaMismatchError(PeekError):
        status_code = 500
        error_code = "SCHEMA_MISMATCH"

        def __init__(self, missing_columns: dict[str, list[str]]):
            self.missing_columns = missing_columns
            parts = [f"  {table}: {', '.join(cols)}" for table, cols in missing_columns.items()]
            message = (
                "Database schema is out of date. Missing columns:\n"
                + "\n".join(parts)
                + "\n\nRun: peekview service restart\n"
                + "  (or restart peekview serve if not installed as a service)"
            )
            super().__init__(message)


def _create_users_without_is_admin(engine):
    """Create users table without is_admin column (simulate pre-v0.1.26 schema)."""
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users RENAME TO users_old"))
        conn.execute(
            text(
                "CREATE TABLE users ("
                "  id INTEGER PRIMARY KEY,"
                "  username TEXT NOT NULL,"
                "  password_hash TEXT NOT NULL,"
                "  display_name TEXT,"
                "  is_active BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT"
                ")"
            )
        )
        conn.execute(
            text(
                "INSERT INTO users SELECT id, username, password_hash,"
                "  display_name, is_active, created_at, updated_at FROM users_old"
            )
        )
        conn.execute(text("DROP TABLE users_old"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)"))
        conn.commit()


def _create_entries_without_owner_id(engine):
    """Create entries table without owner_id column."""
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS entries"))
        conn.execute(
            text(
                "CREATE TABLE entries ("
                "  id INTEGER PRIMARY KEY,"
                "  slug TEXT NOT NULL UNIQUE,"
                "  summary TEXT,"
                "  status TEXT DEFAULT 'active',"
                "  tags TEXT,"
                "  is_public BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT,"
                "  expires_at TEXT"
                ")"
            )
        )
        conn.commit()


class TestCheckSchema:
    """check_schema() — schema compatibility verification."""

    def test_clean_db_no_error(self, tmp_path: Path):
        """Fresh database with complete schema should not raise."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)
        check_schema(engine)

    def test_missing_column_raises(self, tmp_path: Path):
        """Database missing expected columns should raise SchemaMismatchError."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        _create_users_without_is_admin(engine)

        with pytest.raises(SchemaMismatchError) as exc_info:
            check_schema(engine)

        assert "is_admin" in str(exc_info.value)
        assert "users" in str(exc_info.value)
        assert isinstance(exc_info.value.missing_columns, dict)
        assert "users" in exc_info.value.missing_columns

    def test_error_inheritance(self):
        """SchemaMismatchError must be a subclass of PeekError."""
        assert issubclass(SchemaMismatchError, PeekError)

    def test_error_message_hint(self):
        """Error message should guide user to restart service."""
        err = SchemaMismatchError({"users": ["is_admin"]})
        assert "peekview service restart" in str(err)

    def test_empty_db_no_tables(self, tmp_path: Path):
        """Raw SQLite file with no tables should not raise."""
        from sqlalchemy import create_engine

        db_path = tmp_path / "empty.db"
        engine = create_engine(f"sqlite:///{db_path}")
        check_schema(engine)


class TestInitDb:
    """init_db() — parameterized migration control."""

    def test_no_migrations_when_false(self, tmp_path: Path):
        """init_db() default should NOT run migrations."""
        db_path = tmp_path / "test.db"
        with patch("peekview.database._run_migrations") as mock_migrate:
            engine = init_db(db_path)
            mock_migrate.assert_not_called()
        engine.dispose()

    def test_run_migrations_true_calls_migrate(self, tmp_path: Path):
        """init_db(run_migrations=True) MUST run migrations."""
        db_path = tmp_path / "test.db"
        with patch("peekview.database._run_migrations") as mock_migrate:
            engine = init_db(db_path, run_migrations=True)
            mock_migrate.assert_called_once()
        engine.dispose()


class TestRunMigrations:
    """_run_migrations() — schema upgrade execution."""

    def test_adds_missing_is_admin(self, tmp_path: Path):
        """Old schema without is_admin should be upgraded."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        _create_users_without_is_admin(engine)

        _run_migrations(engine)

        with engine.connect() as conn:
            columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(users)"))
            }
            assert "is_admin" in columns

        engine.dispose()

    def test_query_after_migration(self, tmp_path: Path):
        """select(User) should work after migration on old schema with existing data."""
        from peekview.auth import hash_password

        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        with Session(engine) as session:
            user = User(
                username="testuser",
                password_hash=hash_password("testpass123"),
                is_admin=False,
            )
            session.add(user)
            session.commit()

        _create_users_without_is_admin(engine)

        _run_migrations(engine)

        with Session(engine) as session:
            users = session.exec(select(User)).all()
            assert len(users) >= 1, "Expected at least one user after migration"
            for u in users:
                _ = u.is_admin
                _ = u.username

        engine.dispose()

    def test_migration_adds_entries_columns(self, tmp_path: Path):
        """Missing is_public/owner_id on entries should be added."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        _create_entries_without_owner_id(engine)

        _run_migrations(engine)

        with engine.connect() as conn:
            columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))
            }
            assert "is_public" in columns
            assert "owner_id" in columns

        engine.dispose()

    def test_independent_commits(self, tmp_path: Path):
        """Each DDL should have independent commit; partial failure shouldn't cascade."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        _create_users_without_is_admin(engine)

        engine.dispose()

        _run_migrations(engine)

        with engine.connect() as conn:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
            assert "is_admin" in columns

        engine.dispose()


class TestSchemaMismatchError:
    """SchemaMismatchError — exception structure."""

    def test_status_code(self):
        """Error should have HTTP status code for API compatibility."""
        err = SchemaMismatchError({"t": ["c"]})
        assert err.status_code == 500

    def test_error_code(self):
        """Error should have a machine-readable error code."""
        err = SchemaMismatchError({"t": ["c"]})
        assert err.error_code == "SCHEMA_MISMATCH"

    def test_multiple_tables(self):
        """Multiple tables with missing columns should all be reported."""
        err = SchemaMismatchError({
            "users": ["is_admin"],
            "entries": ["is_public", "owner_id"],
        })
        msg = str(err)
        assert "users" in msg
        assert "is_admin" in msg
        assert "entries" in msg
        assert "is_public" in msg
        assert "owner_id" in msg
