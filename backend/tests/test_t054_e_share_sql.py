"""T054-E: share_service text() SQL unification.

BDD: E1-E2
Tests should FAIL (red) until P4 implementation.
"""
from __future__ import annotations

import inspect

import pytest

from peekview.services.share_service import ShareService


class TestBDDE1NoTextStyleQueries:
    """BDD-E1: Given share_service.py code,
    When checking all SQL queries,
    Then no text()-style queries exist (all use ORM select() or SQLAlchemy update() constructor).
    """

    def test_no_text_in_share_service(self):
        source = inspect.getsource(ShareService)
        lines = source.split("\n")
        text_lines = []
        for i, line in enumerate(lines):
            if "text(" in line and "PRAGMA" not in line and "comment" not in line.lower():
                text_lines.append((i + 1, line.strip()))
        assert len(text_lines) == 0, (
            f"Found text()-style queries in share_service.py:\n"
            + "\n".join(f"  Line {n}: {l}" for n, l in text_lines)
        )

    def test_select_count_uses_orm(self):
        source = inspect.getsource(ShareService)
        assert "SELECT COUNT" not in source, "Should use select(func.count()) not raw SQL"

    def test_update_view_count_uses_constructor(self):
        source = inspect.getsource(ShareService)
        assert "UPDATE entry_shares SET view_count" not in source, (
            "Should use SQLAlchemy update() constructor, not raw text() UPDATE"
        )


class TestBDDE2ViewCountAtomicIncrement:
    """BDD-E2: Given share token verification succeeds and current view_count=N,
    When re-querying the share after verification,
    Then view_count=N+1.
    """

    def test_view_count_increments_atomically(self, tmp_path):
        from peekview.config import PeekConfig
        from peekview.database import init_db
        from peekview.models import Entry, EntryShare, User
        from peekview.services.entry_service import EntryService
        from peekview.services.share_service import ShareService
        from peekview.storage import StorageManager
        from sqlmodel import Session, select
        from peekview.auth import hash_password
        import hashlib
        import secrets

        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        engine = init_db(db_path)
        config = PeekConfig(data_dir=data_dir, db_path=db_path)
        storage = StorageManager(config=config)
        entry_service = EntryService(engine=engine, storage=storage, config=config)
        share_service = ShareService(engine=engine, config=config)

        with Session(engine) as session:
            user = User(
                username="viewcountuser",
                password_hash=hash_password("testpass123"),
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            owner_id = user.id

        entry = entry_service.create_entry(
            summary="Share test", slug="share-view-count",
            is_public=False, current_user_id=owner_id,
        )

        share_create = share_service.create_share(
            slug="share-view-count",
            current_user_id=owner_id,
        )
        assert share_create is not None

        with Session(engine) as session:
            share = session.get(EntryShare, share_create.id)
            initial_count = share.view_count
            entry_id = share.entry_id
            token_hash = share.token_hash

        token = secrets.token_urlsafe(12)
        computed_hash = hashlib.sha256(token.encode()).hexdigest()

        with Session(engine) as session:
            share = session.exec(
                select(EntryShare).where(EntryShare.token_hash == token_hash)
            ).first()
            if share:
                share.token_hash = computed_hash
                session.add(share)
                session.commit()

        verified = share_service.verify_share_token(entry_id, token)
        assert verified is not None

        with Session(engine) as session:
            share = session.get(EntryShare, share_create.id)
            assert share.view_count == initial_count + 1, (
                f"view_count should increment from {initial_count} to {initial_count + 1}, "
                f"got {share.view_count}"
            )
