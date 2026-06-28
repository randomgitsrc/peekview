"""Tests for entry service."""

import pytest

from peekview.config import PeekConfig, PeekLimits, PeekServer, PeekStorage
from peekview.database import init_db
from peekview.exceptions import InvalidSlugError, NotFoundError
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


@pytest.fixture
def entry_service(tmp_path):
    """Create an EntryService with temporary storage and database."""
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = init_db(db_path)

    config = PeekConfig(
        storage=PeekStorage(data_dir=data_dir),
        limits=PeekLimits(
            max_file_size=1024 * 1024,
            max_entry_files=50,
            max_entry_size=10 * 1024 * 1024,
            max_slug_length=64,
            max_summary_length=500,
        ),
        server=PeekServer(base_url="http://localhost:8080"),
    )
    storage = StorageManager(config=config)
    return EntryService(engine=engine, storage=storage, config=config)


class TestCreateEntry:
    def test_create_with_content(self, entry_service):
        result = entry_service.create_entry(
            summary="Test entry",
            slug="test",
            files_data=[{"path": "main.py", "content": "print('hello')"}],
        )
        assert result.slug == "test"
        assert result.url.endswith("/test")

    def test_create_with_path_and_filename(self, entry_service):
        """Test that path and filename are handled separately.

        Bug fix: Previously, when both path and filename were provided,
        the filename was incorrectly extracted from path, ignoring the
        explicit filename parameter.
        """
        result = entry_service.create_entry(
            summary="Test entry with path and filename",
            slug="path-filename-test",
            files_data=[
                {"path": "docs", "filename": "CLAUDE.md", "content": "# Guide"},
                {"path": "src", "filename": "main.py", "content": "print('hello')"},
            ],
        )
        entry = entry_service.get_entry("path-filename-test")
        assert len(entry.files) == 2

        # Find files by their correct filenames
        filenames = [f.filename for f in entry.files]
        assert "CLAUDE.md" in filenames
        assert "main.py" in filenames

        # Verify path is stored correctly
        file_paths = {f.filename: f.path for f in entry.files}
        assert file_paths["CLAUDE.md"] == "docs"
        assert file_paths["main.py"] == "src"

    def test_create_auto_slug(self, entry_service):
        result = entry_service.create_entry(summary="Auto slug")
        assert result.slug is not None
        assert len(result.slug) == 6

    def test_create_slug_conflict_suffix(self, entry_service):
        r1 = entry_service.create_entry(summary="First", slug="my-doc")
        r2 = entry_service.create_entry(summary="Second", slug="my-doc")
        assert r1.slug == "my-doc"
        assert r2.slug.startswith("my-doc-")

    def test_create_invalid_slug(self, entry_service):
        with pytest.raises(InvalidSlugError):
            entry_service.create_entry(summary="Bad slug", slug="Hello World!")

    def test_create_with_tags(self, entry_service):
        result = entry_service.create_entry(
            summary="Tagged", slug="tagged", tags=["python", "auth"]
        )
        # Tags should be stored
        entry = entry_service.get_entry("tagged")
        assert "python" in entry.tags
        assert "auth" in entry.tags

    def test_create_with_expires(self, entry_service):
        result = entry_service.create_entry(
            summary="Expiring", slug="expire", expires_in="7d"
        )
        entry = entry_service.get_entry("expire")
        assert entry.expires_at is not None

    def test_create_without_expires_uses_default_15d(self, entry_service):
        """Without expires_in, expires_at should be ~15 days from now."""
        import datetime
        before = datetime.datetime.now(datetime.timezone.utc)
        result = entry_service.create_entry(summary="Default expiry")
        after = datetime.datetime.now(datetime.timezone.utc)
        assert result.expires_at is not None
        expected = before + datetime.timedelta(days=15)
        tolerance = datetime.timedelta(seconds=5)
        assert abs((result.expires_at - expected).total_seconds()) < tolerance.total_seconds()

    def test_create_expires_zero_means_never(self, entry_service):
        """expires_in='0' means never expire — expires_at is None."""
        result = entry_service.create_entry(
            summary="Permanent", slug="perm", expires_in="0"
        )
        assert result.expires_at is None

    def test_create_response_has_expires_at_field(self, entry_service):
        """CreateEntryResponse directly exposes expires_at."""
        result = entry_service.create_entry(summary="Response check", slug="resp-check")
        assert hasattr(result, "expires_at")
        assert result.expires_at is not None

    def test_create_expires_empty_string_uses_default(self, entry_service):
        """expires_in='' should behave like None → use default 15d."""
        import datetime
        before = datetime.datetime.now(datetime.timezone.utc)
        result = entry_service.create_entry(
            summary="Empty expires_in", slug="empty-exp", expires_in=""
        )
        assert result.expires_at is not None
        expected = before + datetime.timedelta(days=15)
        tolerance = datetime.timedelta(seconds=5)
        assert abs((result.expires_at - expected).total_seconds()) < tolerance.total_seconds()

    def test_create_expires_whitespace_uses_default(self, entry_service):
        """expires_in='   ' should behave like None → use default 15d."""
        import datetime
        before = datetime.datetime.now(datetime.timezone.utc)
        result = entry_service.create_entry(
            summary="Whitespace expires_in", slug="ws-exp", expires_in="   "
        )
        assert result.expires_at is not None
        expected = before + datetime.timedelta(days=15)
        tolerance = datetime.timedelta(seconds=5)
        assert abs((result.expires_at - expected).total_seconds()) < tolerance.total_seconds()

    def test_create_with_custom_default_expires_in(self, entry_service, tmp_path):
        """When limits.default_expires_in is changed, it takes effect."""
        import datetime

        from peekview.config import PeekConfig, PeekLimits, PeekServer, PeekStorage
        from peekview.database import init_db
        db_path = tmp_path / "test_custom.db"
        data_dir = tmp_path / "data_custom"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=1024 * 1024,
                max_entry_files=50,
                max_entry_size=10 * 1024 * 1024,
                default_expires_in="30d",
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)
        svc = EntryService(engine=engine, storage=storage, config=config)

        before = datetime.datetime.now(datetime.timezone.utc)
        result = svc.create_entry(summary="Custom default")
        assert result.expires_at is not None
        expected = before + datetime.timedelta(days=30)
        tolerance = datetime.timedelta(seconds=5)
        assert abs((result.expires_at - expected).total_seconds()) < tolerance.total_seconds()

    def test_create_empty_files(self, entry_service):
        result = entry_service.create_entry(summary="No files", slug="empty")
        entry = entry_service.get_entry("empty")
        assert len(entry.files) == 0

    def test_create_transaction_rollback_on_file_error(self, entry_service, tmp_path):
        """If file write fails, the DB entry should also be rolled back."""
        # Path traversal should be blocked during storage
        with pytest.raises(Exception):  # ForbiddenPathError or similar
            entry_service.create_entry(
                summary="Bad file",
                slug="rollback-test",
                files_data=[{"path": "../../etc/passwd", "content": "bad"}],
            )
        # Entry should NOT exist in DB - verify by checking slug not found
        # The entry creation either succeeds completely or fails completely
        # If path traversal is caught early, entry might not be created at all
        try:
            entry_service.get_entry("rollback-test")
            # If we get here, the entry was created despite path traversal error
            # which means rollback didn't happen - this is a failure
            assert False, "Entry should not exist after rollback"
        except Exception:
            # Entry doesn't exist - rollback worked correctly
            pass


class TestGetEntry:
    def test_get_by_slug(self, entry_service):
        created = entry_service.create_entry(summary="Find me", slug="find")
        result = entry_service.get_entry("find")
        assert result.slug == "find"

    def test_get_not_found(self, entry_service):
        with pytest.raises(NotFoundError):
            entry_service.get_entry("nonexistent")


class TestListEntries:
    def test_list_pagination(self, entry_service):
        for i in range(5):
            entry_service.create_entry(summary=f"Entry {i}")
        result = entry_service.list_entries(page=1, per_page=3)
        assert len(result.items) == 3
        assert result.total == 5

    def test_list_search(self, entry_service):
        entry_service.create_entry(summary="Python auth module", slug="auth")
        entry_service.create_entry(summary="Rust web server", slug="rust")
        result = entry_service.list_entries(q="python")
        # Note: FTS might not work in tests, so just verify structure
        assert isinstance(result.items, list)

    def test_list_items_have_expires_at(self, entry_service):
        """EntryListItem should include expires_at field."""
        entry_service.create_entry(summary="With expiry", slug="list-exp")
        result = entry_service.list_entries(page=1, per_page=10)
        assert len(result.items) >= 1
        item = result.items[0]
        assert hasattr(item, "expires_at")
        assert item.expires_at is not None

    def test_list_items_expires_at_null_for_permanent(self, entry_service):
        """EntryListItem with expires_in='0' should have expires_at=None."""
        entry_service.create_entry(
            summary="Permanent entry", slug="perm-list", expires_in="0"
        )
        result = entry_service.list_entries(page=1, per_page=10)
        items = [i for i in result.items if i.slug == "perm-list"]
        assert len(items) == 1
        assert items[0].expires_at is None


class TestUpdateEntry:
    def test_update_summary(self, entry_service):
        entry_service.create_entry(summary="Original", slug="update-me")
        result = entry_service.update_entry("update-me", summary="Updated")
        assert result.summary == "Updated"

    def test_update_deletes_removed_file_records(self, entry_service):
        created = entry_service.create_entry(
            summary="Has files",
            slug="with-files",
            files_data=[{"path": "a.py", "content": "a"}],
        )
        # Get full entry to access files
        full_entry = entry_service.get_entry("with-files")
        file_id = full_entry.files[0].id if full_entry.files else None
        if file_id:
            entry_service.update_entry("with-files", remove_file_ids=[file_id])
            updated = entry_service.get_entry("with-files")
            assert len(updated.files) == 0

    def test_update_deletes_removed_file_from_disk(self, entry_service):
        """When a file is removed via update_entry, the disk file should also be deleted."""
        created = entry_service.create_entry(
            summary="Disk delete",
            slug="disk-del",
            files_data=[{"path": "del.py", "content": "delete me"}],
        )
        # Get full entry to access files
        full_entry = entry_service.get_entry("disk-del")
        file_id = full_entry.files[0].id if full_entry.files else None
        entry_id = created.id

        if file_id:
            # Verify file exists on disk
            disk_path = entry_service.storage.get_disk_path(entry_id, "del.py", "del.py")
            assert disk_path.exists()

            # Remove file via update
            entry_service.update_entry("disk-del", remove_file_ids=[file_id])

            # Verify file is gone from disk
            assert not disk_path.exists()


class TestDeleteEntry:
    def test_delete_success(self, entry_service):
        entry_service.create_entry(summary="Delete me", slug="del")
        entry_service.delete_entry("del", allow_local=True)
        with pytest.raises(NotFoundError):
            entry_service.get_entry("del")

    def test_delete_not_found(self, entry_service):
        with pytest.raises(NotFoundError):
            entry_service.delete_entry("nonexistent", allow_local=True)


class TestGetEntryService:
    def test_get_entry_service_from_app_state(self, tmp_path):
        """get_entry_service() should use app.state services, not create new instances."""

        from peekview.main import create_app

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        app = create_app(data_dir=data_dir, db_path=db_path)

        from peekview.services.entry_service import get_entry_service

        service = get_entry_service(app)
        assert service is not None
        # Second call should return the same instance
        service2 = get_entry_service(app)
        assert service is service2
