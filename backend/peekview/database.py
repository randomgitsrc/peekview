"""Database initialization and management.

Handles SQLite setup with WAL mode, FTS5 for search, and triggers.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy import Engine, event, text
from sqlmodel import Session, SQLModel, create_engine, select

from peekview.exceptions import SchemaMismatchError

if TYPE_CHECKING:
    from peekview.config import PeekConfig
    from peekview.storage import StorageManager

logger = logging.getLogger(__name__)

FTS_CONTENT_TRUNCATE = 100_000
FTS_CONTENT_MAX_PER_ENTRY = 1_000_000


# Default SQLite pragmas for performance and safety
DEFAULT_PRAGMAS = {
    "journal_mode": "WAL",  # Write-Ahead Logging for better concurrency
    "busy_timeout": 5000,  # 5 second busy timeout
    "foreign_keys": "ON",  # Enforce foreign key constraints
    "synchronous": "NORMAL",  # Balance safety and performance
    "cache_size": -64000,  # 64MB cache (negative = pages)
    "temp_store": "MEMORY",  # Store temp tables in memory
    "mmap_size": 268435456,  # 256MB memory-mapped I/O
}


def _run_migrations(engine: Engine) -> None:
    """Run database migrations for schema evolution.

    Adds new columns to existing tables without breaking existing data.
    Must be called AFTER SQLModel.metadata.create_all() so that
    referenced tables (e.g., users) already exist.
    """
    with engine.connect() as conn:
        # Check existing columns in entries table
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))}

        if "is_public" not in columns:
            conn.execute(text("ALTER TABLE entries ADD COLUMN is_public BOOLEAN DEFAULT 1"))
            conn.commit()
            logger.info("Migration: added is_public column to entries")

        if "owner_id" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE entries ADD COLUMN owner_id INTEGER "
                    "REFERENCES users(id) ON DELETE CASCADE"
                )
            )
            conn.commit()
            logger.info("Migration: added owner_id column to entries")

        # Check existing columns in users table
        user_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}

        if "is_admin" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            conn.commit()
            logger.info("Migration: added is_admin column to users")

            # Bootstrap: if no admin exists, make the first user admin
            admin_count = conn.execute(
                text("SELECT COUNT(*) FROM users WHERE is_admin = 1")
            ).scalar()
            if admin_count == 0:
                conn.execute(
                    text("UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users)")
                )
                conn.commit()
                logger.info("Migration: promoted first user to admin")

        # Check existing indexes
        indexes = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index'")
            )
        }

        if "idx_entries_is_public" not in indexes:
            conn.execute(text("CREATE INDEX idx_entries_is_public ON entries(is_public)"))
            conn.commit()
            logger.info("Migration: added idx_entries_is_public index")

        if "idx_entries_is_public_status_created" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX idx_entries_is_public_status_created "
                    "ON entries(is_public, status, created_at DESC)"
                )
            )
            conn.commit()
            logger.info("Migration: added idx_entries_is_public_status_created index")

        # FTS5 migration: check if entries_fts has 'content' column
        try:
            fts_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entries_fts)"))}
        except Exception:
            fts_columns = set()

        if 'content' not in fts_columns:
            conn.execute(text("DROP TABLE IF EXISTS entries_fts"))
            conn.execute(text("DROP TRIGGER IF EXISTS entries_ai"))
            conn.execute(text("DROP TRIGGER IF EXISTS entries_ad"))
            conn.execute(text("DROP TRIGGER IF EXISTS entries_au"))
            conn.commit()
            logger.info("Migration: dropped old FTS5 table for content column expansion")


def check_schema(engine: Engine) -> None:
    """Compare actual DB columns against SQLModel metadata expectations.

    Raises SchemaMismatchError if any expected columns are missing.

    Implementation notes:
    - Queries sqlite_master first to get existing table names
    - Skips tables not yet created (handled by create_all)
    - Skips virtual/FTS tables (not in SQLModel.metadata)
    - For each existing table: PRAGMA table_info vs model columns
    """
    missing_columns: dict[str, list[str]] = {}

    with engine.connect() as conn:
        existing_tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
        }

        for table_name, table in SQLModel.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            actual_columns = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table_name})"))
            }
            expected_columns = set(table.columns.keys())
            missing = sorted(col for col in expected_columns if col not in actual_columns)
            if missing:
                missing_columns[table_name] = missing

    if missing_columns:
        raise SchemaMismatchError(missing_columns)


def init_db(db_path: Path | str, run_migrations: bool = False) -> Engine:
    """Initialize the database with proper settings.

    Creates tables if they don't exist and sets up FTS5 virtual table
    for full-text search.

    Args:
        db_path: Path to SQLite database file
        run_migrations: If True, run schema migrations (Server startup only)

    Returns:
        Configured SQLAlchemy Engine
    """
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Create engine with SQLite pragmas
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )

    # Apply pragmas
    with engine.connect() as conn:
        for pragma, value in DEFAULT_PRAGMAS.items():
            conn.execute(text(f"PRAGMA {pragma} = {value}"))

        # Verify WAL mode is enabled
        result = conn.execute(text("PRAGMA journal_mode"))
        journal_mode = result.scalar()
        if journal_mode != "wal":
            logger.warning(f"WAL mode not enabled (current: {journal_mode})")

    # Ensure models are registered before create_all
    import peekview.models  # noqa: F401

    # Create tables
    SQLModel.metadata.create_all(engine)

    # Run migrations (must be after create_all so users table exists)
    if run_migrations:
        _run_migrations(engine)

    # Setup FTS5
    setup_fts5(engine)

    logger.info(f"Database initialized: {db_path}")
    return engine


def setup_fts5(engine: Engine) -> None:
    """Setup FTS5 virtual table for full-text search.

    Creates the entries_fts virtual table in contentless+contentless_delete mode
    with summary, tags, and content columns. Triggers only sync summary/tags;
    content is managed by the application layer (entry_service).
    """
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
            )
        )
        if result.scalar():
            logger.debug("FTS5 table already exists")
            return

        conn.execute(
            text("""
                CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
                    summary,
                    tags,
                    content,
                    content='',
                    contentless_delete=1
                )
            """)
        )

        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries
                BEGIN
                    INSERT INTO entries_fts(rowid, summary, tags, content)
                    VALUES (NEW.id, NEW.summary, NEW.tags, '');
                END
            """)
        )

        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries
                BEGIN
                    DELETE FROM entries_fts WHERE rowid = OLD.id;
                END
            """)
        )

        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries
                BEGIN
                    DELETE FROM entries_fts WHERE rowid = OLD.id;
                    INSERT INTO entries_fts(rowid, summary, tags, content)
                    VALUES (NEW.id, NEW.summary, NEW.tags, '');
                END
            """)
        )

        conn.commit()
        logger.info("FTS5 virtual table and triggers created (contentless mode)")


def get_engine(config_or_path: PeekConfig | Path | str | None = None) -> Engine:
    """Get or create a database engine.

    This is a convenience function for use in the application.
    For tests, use init_db() directly with a temporary path.

    Args:
        config_or_path: Path to SQLite database file, or PeekConfig object

    Returns:
        Configured SQLAlchemy Engine
    """
    # Delayed import to avoid circular import
    from peekview.config import PeekConfig

    if isinstance(config_or_path, PeekConfig):
        return init_db(config_or_path.db_path)
    elif config_or_path:
        return init_db(config_or_path)
    else:
        # Default path
        return init_db(PeekConfig().db_path)


def close_engine(engine: Engine) -> None:
    """Properly close a database engine.

    Ensures all connections are closed and WAL is checkpointed.
    """
    try:
        # Checkpoint WAL before closing
        with engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    except Exception as e:
        logger.warning(f"WAL checkpoint failed: {e}")
    finally:
        engine.dispose()
        logger.debug("Database engine disposed")


def search_entries(session: Session, query: str, limit: int = 100) -> list[int]:
    """Search entries using FTS5.

    Args:
        session: Database session
        query: Search query
        limit: Maximum results

    Returns:
        List of entry IDs matching the query
    """
    # Sanitize query to prevent FTS5 syntax errors
    # Remove special FTS5 characters that could cause issues
    safe_query = query.replace('"', '""').replace("'", "''")

    # Use FTS5 MATCH operator
    result = session.exec(
        text(
            """
            SELECT rowid FROM entries_fts
            WHERE entries_fts MATCH :query
            ORDER BY rank
            LIMIT :limit
        """
        ).bindparams(query=safe_query, limit=limit)
    )

    return [row[0] for row in result]


def rebuild_fts_index(engine: Engine, storage: StorageManager | None = None) -> None:
    """Rebuild the FTS5 index from scratch.

    Useful if the FTS index gets out of sync.
    If storage is provided, file content is also indexed.
    """
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
            )
        )
        if not result.scalar():
            logger.warning("FTS5 table does not exist, skipping rebuild")
            return

        try:
            conn.execute(text("DELETE FROM entries_fts"))
        except Exception as e:
            logger.warning(f"Could not delete from entries_fts: {e}")

        if storage:
            with Session(engine) as session:
                from peekview.models import Entry
                entries = session.exec(select(Entry)).all()
                for entry in entries:
                    content = _aggregate_entry_content(entry.id, storage, session)
                    conn.execute(text(
                        "INSERT INTO entries_fts(rowid, summary, tags, content) "
                        "VALUES (:id, :summary, :tags, :content)"
                    ).bindparams(
                        id=entry.id,
                        summary=entry.summary,
                        tags=' '.join(entry.tags or []),
                        content=content,
                    ))
        else:
            try:
                conn.execute(
                    text("""
                    INSERT INTO entries_fts(rowid, summary, tags, content)
                    SELECT id, summary, tags, '' FROM entries
                """)
                )
            except Exception as e:
                logger.warning(f"Could not repopulate entries_fts: {e}")

        conn.commit()
        logger.info("FTS5 index rebuilt")


def get_db_stats(engine: Engine) -> dict:
    """Get database statistics.

    Returns:
        Dict with entry count, file count, FTS stats
    """
    with Session(engine) as session:


        entry_count = session.exec(
            text("SELECT COUNT(*) FROM entries")
        ).scalar()

        file_count = session.exec(
            text("SELECT COUNT(*) FROM files")
        ).scalar()

        # Get FTS5 stats
        try:
            fts_doc_count = session.exec(
                text("SELECT COUNT(*) FROM entries_fts")
            ).scalar()
        except Exception:
            fts_doc_count = 0

        # Get database size
        result = session.exec(text("PRAGMA page_count"))
        page_count = result.scalar() or 0
        result = session.exec(text("PRAGMA page_size"))
        page_size = result.scalar() or 0
        db_size = page_count * page_size

        return {
            "entry_count": entry_count,
            "file_count": file_count,
            "fts_doc_count": fts_doc_count,
            "db_size_bytes": db_size,
            "db_size_mb": round(db_size / (1024 * 1024), 2),
        }


def _aggregate_entry_content(
    entry_id: int, storage: StorageManager, session: Session
) -> str:
    """Aggregate text file content for an entry, with truncation."""
    from peekview.models import File

    files = session.exec(
        select(File).where(File.entry_id == entry_id, File.is_binary == False)
    ).all()

    content_parts: list[str] = []
    total_len = 0

    for f in files:
        try:
            disk_path = storage.get_disk_path(entry_id, f.filename, f.path)
            if disk_path and disk_path.exists():
                raw = disk_path.read_bytes()
                text_content = raw.decode('utf-8', errors='replace')[:FTS_CONTENT_TRUNCATE]
                if total_len + len(text_content) > FTS_CONTENT_MAX_PER_ENTRY:
                    remaining = FTS_CONTENT_MAX_PER_ENTRY - total_len
                    if remaining > 0:
                        content_parts.append(text_content[:remaining])
                    break
                content_parts.append(text_content)
                total_len += len(text_content)
        except Exception:
            continue

    return ' '.join(content_parts)


def backfill_fts_content(engine: Engine, storage: StorageManager) -> None:
    """Backfill FTS content column for existing entries (idempotent).

    Called from application startup after StorageManager is available.
    """
    with Session(engine) as session:
        from peekview.models import Entry

        entry_count = session.exec(text("SELECT COUNT(*) FROM entries")).scalar()
        fts_count = session.exec(text("SELECT COUNT(*) FROM entries_fts")).scalar()
        content_count = session.exec(text("SELECT COUNT(*) FROM entries_fts WHERE content IS NOT NULL AND content != ''")).scalar()

        if content_count >= entry_count and entry_count > 0:
            logger.debug("FTS content already backfilled")
            return

        session.exec(text("DELETE FROM entries_fts"))

        entries = session.exec(select(Entry)).all()
        for entry in entries:
            content = _aggregate_entry_content(entry.id, storage, session)
            session.exec(text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "VALUES (:id, :summary, :tags, :content)"
            ).bindparams(
                id=entry.id,
                summary=entry.summary,
                tags=' '.join(entry.tags or []),
                content=content,
            ))

        session.commit()
        logger.info(f"Backfilled FTS content for {len(entries)} entries")


# Event listeners for debugging (optional)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set SQLite pragmas on each new connection.

    All connection-level pragmas (busy_timeout, synchronous, etc.) must be
    applied here because NullPool creates a fresh connection per request.
    journal_mode=WAL is file-level (persistent), but also set here for safety.
    """
    cursor = dbapi_conn.cursor()
    for pragma, value in DEFAULT_PRAGMAS.items():
        cursor.execute(f"PRAGMA {pragma} = {value}")
    cursor.close()
