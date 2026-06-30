"""Tests for FTS5 content expansion — T037 BDD coverage.

BDD-1: Text file content searchable
BDD-2: Binary file content not indexed
BDD-3: Existing entries backfilled
BDD-4: FTS syncs after file add/remove
BDD-5: Frontend search placeholder (covered by P6 visual test)
BDD-6: Large file content truncated
BDD-7: Summary/tags matching still works
BDD-8: Empty entry search unaffected
"""

import pytest
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.config import PeekLimits, PeekServer, PeekStorage
from peekview.config import PeekConfig
from peekview.database import (
    FTS_CONTENT_TRUNCATE,
    backfill_fts_content,
    init_db,
    rebuild_fts_index,
    search_entries,
)
from peekview.models import Entry, File
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


@pytest.fixture
def entry_service(tmp_path):
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = init_db(db_path)

    config = PeekConfig(
        storage=PeekStorage(data_dir=data_dir),
        limits=PeekLimits(
            max_file_size=10 * 1024 * 1024,
            max_entry_files=50,
            max_entry_size=50 * 1024 * 1024,
            max_slug_length=64,
            max_summary_length=500,
        ),
        server=PeekServer(base_url="http://localhost:8080"),
    )
    storage = StorageManager(config=config)
    return EntryService(engine=engine, storage=storage, config=config)


class TestBDD1TextFileContentSearchable:
    """BDD-1: Text file content is searchable via FTS5."""

    def test_search_file_content(self, entry_service):
        result = entry_service.create_entry(
            summary="Deploy script",
            slug="deploy",
            tags=["ops"],
            files_data=[{
                "path": "deploy.sh",
                "content": "kubectl apply -f deployment.yaml",
            }],
        )

        found = entry_service.list_entries(q="kubectl")
        assert len(found.items) == 1
        assert found.items[0].slug == "deploy"

    def test_search_file_content_not_summary(self, entry_service):
        result = entry_service.create_entry(
            summary="Simple script",
            slug="simple",
            tags=["ops"],
            files_data=[{
                "path": "app.py",
                "content": "import sqlalchemy from flask",
            }],
        )

        found = entry_service.list_entries(q="sqlalchemy")
        assert len(found.items) == 1
        assert found.items[0].slug == "simple"

    def test_search_file_content_with_base64_binary_skipped(self, entry_service):
        import base64
        binary_data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        result = entry_service.create_entry(
            summary="Logo asset",
            slug="logo",
            files_data=[
                {
                    "path": "logo.png",
                    "filename": "logo.png",
                    "content_base64": base64.b64encode(binary_data).decode(),
                },
                {
                    "path": "readme.txt",
                    "content": "brand guidelines for the project",
                },
            ],
        )

        found_brand = entry_service.list_entries(q="brand")
        assert len(found_brand.items) == 1

        found_png = entry_service.list_entries(q="PNG")
        assert len(found_png.items) == 0


class TestBDD2BinaryFileNotIndexed:
    """BDD-2: Binary file content does not enter FTS index."""

    def test_binary_file_content_not_searchable(self, entry_service):
        import base64
        binary_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50 + b"UNIQUEBINARYMARKER"
        result = entry_service.create_entry(
            summary="Logo asset",
            slug="logo-bin",
            files_data=[
                {
                    "path": "logo.png",
                    "filename": "logo.png",
                    "content_base64": base64.b64encode(binary_content).decode(),
                },
            ],
        )

        found = entry_service.list_entries(q="UNIQUEBINARYMARKER")
        assert len(found.items) == 0

    def test_text_file_searchable_alongside_binary(self, entry_service):
        import base64
        binary_data = b"\x00" * 100
        result = entry_service.create_entry(
            summary="Mixed files",
            slug="mixed",
            files_data=[
                {
                    "path": "image.png",
                    "filename": "image.png",
                    "content_base64": base64.b64encode(binary_data).decode(),
                },
                {
                    "path": "notes.txt",
                    "content": "important configuration details",
                },
            ],
        )

        found = entry_service.list_entries(q="configuration")
        assert len(found.items) == 1
        assert found.items[0].slug == "mixed"


class TestBDD3BackfillExistingEntries:
    """BDD-3: Existing entries get their file content backfilled into FTS."""

    def test_backfill_populates_content(self, tmp_path):
        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=10 * 1024 * 1024,
                max_entry_files=50,
                max_entry_size=50 * 1024 * 1024,
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)
        svc = EntryService(engine=engine, storage=storage, config=config)

        entry_result = svc.create_entry(
            summary="Legacy entry",
            slug="legacy",
            files_data=[{
                "path": "legacy.py",
                "content": "def legacy_function(): pass",
            }],
        )

        with Session(engine) as session:
            session.exec(text("DELETE FROM entries_fts WHERE rowid = :id").bindparams(id=entry_result.id))
            session.exec(text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "VALUES (:id, :summary, :tags, :content)"
            ).bindparams(id=entry_result.id, summary="Legacy entry", tags="", content=""))
            session.commit()

        found = svc.list_entries(q="legacy_function")
        assert len(found.items) == 0

        backfill_fts_content(engine, storage)

        found = svc.list_entries(q="legacy_function")
        assert len(found.items) == 1
        assert found.items[0].slug == "legacy"

    def test_backfill_idempotent(self, tmp_path):
        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=10 * 1024 * 1024,
                max_entry_files=50,
                max_entry_size=50 * 1024 * 1024,
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)
        svc = EntryService(engine=engine, storage=storage, config=config)

        svc.create_entry(
            summary="Test",
            slug="test-idem",
            files_data=[{"path": "a.py", "content": "hello world"}],
        )

        backfill_fts_content(engine, storage)
        backfill_fts_content(engine, storage)

        found = svc.list_entries(q="hello")
        assert len(found.items) == 1


class TestBDD4FTSSyncAfterFileChanges:
    """BDD-4: FTS content syncs after file add/remove via update_entry."""

    def test_remove_file_removes_from_fts(self, entry_service):
        created = entry_service.create_entry(
            summary="Config files",
            slug="config",
            files_data=[{
                "path": "config.yaml",
                "content": "database_url: postgres://localhost",
            }],
        )

        found = entry_service.list_entries(q="database_url")
        assert len(found.items) == 1

        full = entry_service.get_entry("config")
        file_id = full.files[0].id
        entry_service.update_entry("config", remove_file_ids=[file_id])

        found = entry_service.list_entries(q="database_url")
        assert len(found.items) == 0

    def test_add_file_adds_to_fts(self, entry_service):
        entry_service.create_entry(
            summary="Config files",
            slug="config-add",
        )

        found = entry_service.list_entries(q="flask_route")
        assert len(found.items) == 0

        entry_service.update_entry("config-add", add_files=[{
            "path": "app.py",
            "content": "def flask_route(): pass",
        }])

        found = entry_service.list_entries(q="flask_route")
        assert len(found.items) == 1

    def test_update_summary_preserves_content(self, entry_service):
        entry_service.create_entry(
            summary="Original summary",
            slug="update-summary",
            files_data=[{
                "path": "code.py",
                "content": "import django_orm",
            }],
        )

        found = entry_service.list_entries(q="django_orm")
        assert len(found.items) == 1

        entry_service.update_entry("update-summary", summary="Updated summary")

        found = entry_service.list_entries(q="django_orm")
        assert len(found.items) == 1

        found2 = entry_service.list_entries(q="Updated")
        assert len(found2.items) == 1


class TestBDD6LargeFileTruncation:
    """BDD-6: Large file content is truncated in FTS index."""

    def test_content_within_truncation_searchable(self, entry_service):
        marker = "unique_marker_abc"
        padding = "x" * (FTS_CONTENT_TRUNCATE - len(marker) - 1)
        content = marker + " " + padding

        entry_service.create_entry(
            summary="Large file",
            slug="large",
            files_data=[{"path": "large.log", "content": content}],
        )

        found = entry_service.list_entries(q="unique_marker_abc")
        assert len(found.items) == 1

    def test_content_beyond_truncation_not_searchable(self, entry_service):
        marker_before = "visible_marker_yes"
        padding_size = FTS_CONTENT_TRUNCATE + 1000
        padding = "y" * padding_size
        marker_after = "hidden_marker_no"
        content = marker_before + " " + padding + " " + marker_after

        entry_service.create_entry(
            summary="Very large file",
            slug="very-large",
            files_data=[{"path": "huge.log", "content": content}],
        )

        found_before = entry_service.list_entries(q="visible_marker_yes")
        assert len(found_before.items) == 1

        found_after = entry_service.list_entries(q="hidden_marker_no")
        assert len(found_after.items) == 0


class TestBDD7SummaryTagsStillWork:
    """BDD-7: Summary and tags matching still works after FTS expansion."""

    def test_search_by_summary(self, entry_service):
        entry_service.create_entry(
            summary="FastAPI tutorial",
            slug="fastapi",
            tags=["python"],
        )

        found = entry_service.list_entries(q="FastAPI")
        assert len(found.items) == 1

    def test_search_by_tags(self, entry_service):
        entry_service.create_entry(
            summary="Some tutorial",
            slug="tagged",
            tags=["python"],
        )

        found = entry_service.list_entries(q="python")
        assert len(found.items) == 1


class TestBDD8EmptyEntrySearchUnaffected:
    """BDD-8: Empty entry (no files) search is unaffected."""

    def test_empty_entry_found_by_summary(self, entry_service):
        entry_service.create_entry(
            summary="Empty entry",
            slug="empty",
        )

        found = entry_service.list_entries(q="Empty")
        assert len(found.items) == 1

    def test_empty_entry_not_found_by_gibberish(self, entry_service):
        entry_service.create_entry(
            summary="Empty entry",
            slug="empty2",
        )

        found = entry_service.list_entries(q="nonexistent_random_string_xyz")
        assert len(found.items) == 0


class TestRebuildFtsIndexWithContent:
    """Test rebuild_fts_index with content support."""

    def test_rebuild_with_storage(self, tmp_path):
        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=10 * 1024 * 1024,
                max_entry_files=50,
                max_entry_size=50 * 1024 * 1024,
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)
        svc = EntryService(engine=engine, storage=storage, config=config)

        svc.create_entry(
            summary="Rebuild test",
            slug="rebuild",
            files_data=[{"path": "app.py", "content": "import numpy"}],
        )

        with Session(engine) as session:
            session.exec(text("DELETE FROM entries_fts"))
            session.commit()

        rebuild_fts_index(engine, storage=storage)

        found = svc.list_entries(q="numpy")
        assert len(found.items) == 1

    def test_rebuild_without_storage(self, tmp_path):
        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=10 * 1024 * 1024,
                max_entry_files=50,
                max_entry_size=50 * 1024 * 1024,
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)
        svc = EntryService(engine=engine, storage=storage, config=config)

        svc.create_entry(
            summary="Rebuild no storage",
            slug="rebuild-no-storage",
        )

        with Session(engine) as session:
            session.exec(text("DELETE FROM entries_fts"))
            session.commit()

        rebuild_fts_index(engine)

        found = svc.list_entries(q="Rebuild")
        assert len(found.items) == 1


class TestFTS5ContentlessMode:
    """Test FTS5 contentless+contentless_delete mode specifics."""

    def test_fts_has_content_column(self, tmp_path):
        engine = init_db(tmp_path / "test.db")

        with engine.connect() as conn:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entries_fts)"))}

        assert 'content' in columns
        engine.dispose()

    def test_delete_entry_removes_from_fts(self, entry_service):
        entry_service.create_entry(
            summary="Delete test",
            slug="del-fts",
            files_data=[{"path": "a.py", "content": "delete_marker_word"}],
        )

        found = entry_service.list_entries(q="delete_marker_word")
        assert len(found.items) == 1

        entry_service.delete_entry("del-fts", allow_local=True)

        found = entry_service.list_entries(q="delete_marker_word")
        assert len(found.items) == 0

    def test_fts_insert_trigger_content_empty(self, tmp_path):
        engine = init_db(tmp_path / "test.db")

        with Session(engine) as session:
            entry = Entry(slug="trigger-test", summary="Trigger test", tags=["test"])
            session.add(entry)
            session.commit()

            result = session.exec(
                text("SELECT COUNT(*) FROM entries_fts WHERE rowid = :id").bindparams(id=entry.id)
            )
            assert result.scalar() == 1

        engine.dispose()
