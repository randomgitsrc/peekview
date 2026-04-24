"""Shared test fixtures — single source of truth for all test files."""

import tempfile
from pathlib import Path
from typing import Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine


def pytest_configure(config):
    """Configure pytest-asyncio."""
    config.option.asyncio_mode = "auto"


@pytest.fixture
def temp_data_dir(tmp_path: Path) -> Path:
    """Provide a temporary data directory for each test."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def temp_db_path(tmp_path: Path) -> Path:
    """Provide a temporary database path for each test."""
    return tmp_path / "test.db"


@pytest.fixture
def engine(temp_db_path: Path):
    """Create a test database engine with WAL mode."""
    from sqlalchemy import text

    engine = create_engine(
        f"sqlite:///{temp_db_path}",
        connect_args={"check_same_thread": False},
    )

    # Enable WAL mode and foreign keys
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=5000"))
        conn.execute(text("PRAGMA foreign_keys=ON"))

    # Create tables
    SQLModel.metadata.create_all(engine)

    yield engine

    engine.dispose()


@pytest.fixture
def session(engine) -> Generator[Session, None, None]:
    """Provide a database session for each test."""
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture
def test_config(temp_data_dir: Path, temp_db_path: Path):
    """Provide test configuration."""
    from peek.config import PeekConfig

    return PeekConfig(
        data_dir=temp_data_dir,
        db_path=temp_db_path,
        host="127.0.0.1",
        port=8080,
        log_level="DEBUG",
    )


@pytest.fixture
def app(test_config):
    """Create a test FastAPI application."""
    from peek.main import create_app

    return create_app(
        data_dir=test_config.data_dir,
        db_path=test_config.db_path,
    )


@pytest.fixture
async def client(app) -> AsyncClient:
    """Provide an async HTTP client for API testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_files(temp_data_dir: Path) -> Path:
    """Create sample files for testing file operations."""
    samples_dir = temp_data_dir / "samples"
    samples_dir.mkdir()

    # Create a Python file
    (samples_dir / "main.py").write_text("def hello():\n    print('Hello, World!')\n")

    # Create a Markdown file
    (samples_dir / "README.md").write_text("# Test Project\n\nThis is a test.\n")

    # Create a JSON file
    (samples_dir / "config.json").write_text('{"name": "test", "version": "1.0.0"}\n')

    # Create a binary file
    (samples_dir / "binary.bin").write_bytes(b"\x00\x01\x02\x03\xff\xfe\xfd\xfc")

    # Create a directory with nested files
    src_dir = samples_dir / "src"
    src_dir.mkdir()
    (src_dir / "utils.py").write_text("def helper():\n    pass\n")

    return samples_dir
