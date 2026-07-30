"""T082 BDD-14: create_entry 事务回滚验证测试。

This test verifies that when file write fails during create_entry,
the entry row is rolled back (no dirty data without files).

RED (failing) because the refactoring (R4) has not been implemented yet.
Currently, entry row is committed before file writes, so rollback
on file write failure leaves a dirty entry.
"""

import pytest
from sqlmodel import Session, select

from peekview.models import Entry
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


@pytest.fixture
def entry_service(engine, test_config):
    """Create EntryService with test engine and storage."""
    storage = StorageManager(config=test_config)
    return EntryService(engine=engine, storage=storage, config=test_config)


def test_bdd_14_entry_rollback_on_file_write_failure(entry_service, engine, monkeypatch):
    """BDD-14: 文件写入失败时 entry row 回滚，无脏数据残留."""
    slug = "t082-rollback-test"
    files_data = [
        {
            "filename": "test.py",
            "content": "print('hello')",
        }
    ]

    # Monkeypatch storage.write_file to raise an exception (simulating disk failure)
    original_write_file = entry_service.storage.write_file

    def failing_write_file(*args, **kwargs):
        raise OSError("Simulated disk write failure")

    monkeypatch.setattr(entry_service.storage, "write_file", failing_write_file)

    # Attempt to create entry — should fail due to file write error
    with pytest.raises((OSError, Exception)):
        entry_service.create_entry(
            summary="Test rollback entry",
            slug=slug,
            files_data=files_data,
            current_user_id=None,
            is_public=True,
        )

    # Restore original write_file for cleanup check
    monkeypatch.setattr(entry_service.storage, "write_file", original_write_file)

    # BDD-14 assertion: entry row should NOT exist in the database
    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        assert entry is None, (
            f"BDD-14: entry row '{slug}' still exists after file write failure — "
            "transaction did not roll back entry row"
        )
