"""Database initialization and management.

Handles SQLite setup with WAL mode, FTS5 for search, and triggers.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy import Engine, event, text
from sqlmodel import Session, SQLModel, create_engine

from peek.models import Entry, File

if TYPE_CHECKING:
    from peek.config import PeekConfig

logger = logging.getLogger(__name__)


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


def init_db(db_path: Path | str) -> Engine:
    """Initialize the database with proper settings.

    Creates tables if they don't exist and sets up FTS5 virtual table
    for full-text search.

    Args:
        db_path: Path to SQLite database file

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

    # Create tables
    SQLModel.metadata.create_all(engine)

    # Setup FTS5
    setup_fts5(engine)

    logger.info(f"Database initialized: {db_path}")
    return engine


def setup_fts5(engine: Engine) -> None:
    """Setup FTS5 virtual table for full-text search.

    Creates the entries_fts virtual table and triggers to keep it
    synchronized with the entries table.
    """
    with engine.connect() as conn:
        # Check if FTS5 table exists
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
            )
        )
        if result.scalar():
            logger.debug("FTS5 table already exists")
            return

        # Create FTS5 virtual table
        conn.execute(
            text("""
                CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
                    summary,
                    tags,
                    content='entries',
                    content_rowid='id'
                )
            """)
        )

        # Create trigger to insert into FTS on entry creation
        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries
                BEGIN
                    INSERT INTO entries_fts(rowid, summary, tags)
                    VALUES (NEW.id, NEW.summary, NEW.tags);
                END
            """)
        )

        # Create trigger to delete from FTS on entry deletion
        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries
                BEGIN
                    INSERT INTO entries_fts(entries_fts, rowid, summary, tags)
                    VALUES ('delete', OLD.id, OLD.summary, OLD.tags);
                END
            """)
        )

        # Create trigger to update FTS on entry update
        conn.execute(
            text("""
                CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries
                BEGIN
                    INSERT INTO entries_fts(entries_fts, rowid, summary, tags)
                    VALUES ('delete', OLD.id, OLD.summary, OLD.tags);
                    INSERT INTO entries_fts(rowid, summary, tags)
                    VALUES (NEW.id, NEW.summary, NEW.tags);
                END
            """)
        )

        conn.commit()
        logger.info("FTS5 virtual table and triggers created")


def get_engine(config_or_path: "PeekConfig" | Path | str | None = None) -> Engine:
    """Get or create a database engine.

    This is a convenience function for use in the application.
    For tests, use init_db() directly with a temporary path.

    Args:
        config_or_path: Path to SQLite database file, or PeekConfig object

    Returns:
        Configured SQLAlchemy Engine
    """
    # Delayed import to avoid circular import
    from peek.config import PeekConfig

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


def rebuild_fts_index(engine: Engine) -> None:
    """Rebuild the FTS5 index from scratch.

    Useful if the FTS index gets out of sync.
    """
    with engine.connect() as conn:
        # Check if FTS5 table exists first
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
            )
        )
        if not result.scalar():
            logger.warning("FTS5 table does not exist, skipping rebuild")
            return

        # Delete all entries from FTS
        try:
            conn.execute(text("DELETE FROM entries_fts"))
        except Exception as e:
            logger.warning(f"Could not delete from entries_fts: {e}")

        # Reinsert all entries
        try:
            conn.execute(
                text("""
                INSERT INTO entries_fts(rowid, summary, tags)
                SELECT id, summary, tags FROM entries
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
        from sqlalchemy import func

        from peek.models import Entry, File

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


# Event listeners for debugging (optional)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set SQLite pragmas on each connection."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
