"""Tests for TPV0093 star migration/backfill: BDD-27 + BLOCKER-3.

Covers the idempotent data backfill of archive_delete_at for legacy archived
entries (launch-date baseline) and the guarantee that PRAGMA user_version stays
FTS-exclusive (no pollution).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlmodel import Session, select

from peekview.database import init_db
from peekview.models import Entry


def _init_legacy_db(tmp_path, user_version: int = 2):
    """Create a legacy DB with old archived entries and a set user_version."""
    db_path = tmp_path / "legacy.db"
    engine = init_db(db_path, run_migrations=True)

    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        for i in range(3):
            session.add(
                Entry(
                    slug=f"legacy-archived-{i}",
                    summary=f"Legacy archived {i}",
                    status="archived",
                    archived_at=now - timedelta(days=200),
                )
            )
        session.commit()

    with engine.connect() as conn:
        conn.execute(text(f"PRAGMA user_version = {user_version}"))
        conn.commit()

    return engine, db_path


class TestBackfillArchiveDeleteAt:
    def test_bdd_27_legacy_archived_countdown_from_launch_date(self, tmp_path):
        from peekview.database import backfill_archive_delete_at

        engine, _db_path = _init_legacy_db(tmp_path)
        retention_days = 90
        before = datetime.now(timezone.utc)

        backfill_archive_delete_at(engine, retention_days)

        with Session(engine) as session:
            archived = session.exec(
                select(Entry).where(Entry.status == "archived")
            ).all()
            assert len(archived) == 3
            for e in archived:
                # 存量 archived 从上（backfill）线日起算：deadline ≈ now + retention
                assert e.archive_delete_at is not None
                deadline = e.archive_delete_at.replace(tzinfo=timezone.utc)
                expected_min = before + timedelta(days=retention_days) - timedelta(minutes=5)
                expected_max = before + timedelta(days=retention_days) + timedelta(minutes=5)
                assert expected_min <= deadline <= expected_max
        engine.dispose()

    def test_blocker3_backfill_keeps_user_version_and_is_idempotent(self, tmp_path):
        from peekview.database import backfill_archive_delete_at

        engine, _db_path = _init_legacy_db(tmp_path, user_version=2)

        backfill_archive_delete_at(engine, 90)

        with engine.connect() as conn:
            uv = conn.execute(text("PRAGMA user_version")).scalar()
        assert uv == 2

        with Session(engine) as session:
            first = session.exec(
                select(Entry.archive_delete_at).where(Entry.slug == "legacy-archived-0")
            ).first()
            assert first is not None

        # 幂等：再跑一次结果不变（backfill 只更新 NULL 行）
        backfill_archive_delete_at(engine, 90)

        with Session(engine) as session:
            second = session.exec(
                select(Entry.archive_delete_at).where(Entry.slug == "legacy-archived-0")
            ).first()
            assert second == first

        with engine.connect() as conn:
            uv_after = conn.execute(text("PRAGMA user_version")).scalar()
        assert uv_after == 2
        engine.dispose()
