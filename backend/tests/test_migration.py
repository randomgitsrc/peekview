"""Tests for database migration mechanism (T002).

These tests verify the new `check_schema()`, `init_db(run_migrations=)`,
and `SchemaMismatchError` functionality.

TDD: Tests are written BEFORE implementation. They should FAIL
until the actual code changes are applied in P4.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text
from sqlmodel import Session, SQLModel, select

from peekview.database import _run_migrations, check_schema, init_db, SchemaMismatchError
from peekview.exceptions import PeekError
from peekview.models import User


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

        # Manually remove is_admin column to simulate old schema
        with engine.connect() as conn:
            # SQLite doesn't support DROP COLUMN easily, so create a new table
            conn.execute(text("DROP TABLE IF EXISTS users_old"))
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


class TestInitDb:
    """init_db() — parameterized migration control."""

    def test_default_is_no_migrations(self, tmp_path: Path):
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

        # Remove is_admin column to simulate pre-migration state
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS users_old"))
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

        # Run migrations
        _run_migrations(engine)

        # Verify is_admin was added
        with engine.connect() as conn:
            columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(users)"))
            }
            assert "is_admin" in columns

        engine.dispose()

    def test_query_after_migration(self, tmp_path: Path):
        """select(User) should work after migration on old schema."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        # Remove is_admin column
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

        # Migrate
        _run_migrations(engine)

        # Query should work without KeyError
        with Session(engine) as session:
            users = session.exec(select(User)).all()
            for u in users:
                _ = u.is_admin  # must not raise

        engine.dispose()

    def test_migration_adds_entries_columns(self, tmp_path: Path):
        """Missing is_public/owner_id on entries should be added."""
        db_path = tmp_path / "test.db"
        engine = init_db(db_path)

        with engine.connect() as conn:
            # Drop entries to recreate without is_public/owner_id
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

        _run_migrations(engine)

        with engine.connect() as conn:
            columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))
            }
            assert "is_public" in columns
            assert "owner_id" in columns

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
