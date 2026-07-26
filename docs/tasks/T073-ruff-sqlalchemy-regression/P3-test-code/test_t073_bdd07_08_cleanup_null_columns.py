"""T073 BDD-7 & BDD-8: cleanup_expired correctly filters NULL columns.

BDD-7: Given 1 expired entry (expires_at < now) and 1 entry with NULL expires_at,
When calling cleanup_expired,
Then only the expired entry is archived (NULL expires_at entries are NOT archived).

BDD-8: Given 1 archived entry with archived_at > retention_days and 1 entry with NULL archived_at,
When calling cleanup_expired,
Then only the old archived entry is deleted (NULL archived_at entries are NOT deleted).

These tests test the service layer directly. The bug in admin_service.py:196/220 uses
`Entry.expires_at is not None` and `Entry.archived_at is not None` which evaluate to
Python `False` in SQLAlchemy .where() context (Column descriptor is not None).
This produces `WHERE false AND ...` which returns no rows.

However, the existing cleanup tests pass because the `<= now_naive`/`<= cutoff`
comparisons implicitly filter NULLs in SQL. The `is not None` check is semantically
wrong but practically redundant in this specific query pattern.

These tests verify the CORRECT behavior: entries with NULL expires_at/archived_at
should not be affected by cleanup. They will PASS now (bug is silent) and should
continue to PASS after the fix.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from peekview.config import PeekConfig
from peekview.database import init_db
from peekview.models import Entry
from peekview.services.admin_service import AdminService
from peekview.storage import StorageManager


@pytest.fixture
def admin_service(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    config = PeekConfig(data_dir=data_dir, db_path=db_path)
    storage = StorageManager(config=config)
    return AdminService(engine=engine, storage=storage, config=config), engine


class TestBdd07CleanupExpiredNullExpiresAt:
    def test_bdd_07_null_expires_at_not_archived(self, admin_service):
        svc, engine = admin_service

        with Session(engine) as session:
            expired_entry = Entry(
                slug="expired-entry",
                summary="Expired",
                is_public=True,
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            permanent_entry = Entry(
                slug="permanent-entry",
                summary="Permanent (no expiry)",
                is_public=True,
                expires_at=None,
            )
            session.add(expired_entry)
            session.add(permanent_entry)
            session.commit()

        result = svc.cleanup_expired()

        assert result.archived_count == 1, (
            f"Expected 1 archived (expired only), got {result.archived_count}"
        )
        assert "expired-entry" in result.archived_slugs
        assert "permanent-entry" not in result.archived_slugs

        with Session(engine) as session:
            permanent = session.exec(
                select(Entry).where(Entry.slug == "permanent-entry")
            ).first()
            assert permanent is not None
            assert permanent.status == "active", (
                f"Permanent entry should remain active, got {permanent.status}"
            )


class TestBdd08CleanupOldArchivedNullArchivedAt:
    def test_bdd_08_null_archived_at_not_deleted(self, admin_service):
        svc, engine = admin_service

        with Session(engine) as session:
            old_archived = Entry(
                slug="old-archived",
                summary="Old archived",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=100),
            )
            active_no_archived = Entry(
                slug="active-no-archived",
                summary="Active with NULL archived_at",
                is_public=True,
                status="active",
                archived_at=None,
            )
            session.add(old_archived)
            session.add(active_no_archived)
            session.commit()

        result = svc.cleanup_expired()

        assert result.deleted_count == 1, (
            f"Expected 1 deleted (old archived only), got {result.deleted_count}"
        )
        assert "old-archived" in result.deleted_slugs
        assert "active-no-archived" not in result.deleted_slugs

        with Session(engine) as session:
            active = session.exec(
                select(Entry).where(Entry.slug == "active-no-archived")
            ).first()
            assert active is not None, "Active entry with NULL archived_at should not be deleted"
