"""Tests for user page feature — owner=username filtering in list_entries.

Phase: P3 (TDD — tests should FAIL because implementation not done yet)
Task: T025-user-page
"""

import pytest
from sqlmodel import Session

from peekview.config import PeekConfig, PeekLimits, PeekServer, PeekStorage
from peekview.database import init_db
from peekview.models import User
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


def _create_user(entry_service, username, is_admin=False):
    """Create a User record directly in the test database.

    Returns the user's id.
    """
    with Session(entry_service.engine) as session:
        user = User(
            username=username,
            password_hash="$2b$12$dummyhashfordummyuser",
            is_admin=is_admin,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


class TestListEntriesByUsername:
    """BDD-BE-1~9: owner=username filtering in list_entries."""

    # ── BE-1: owner=username returns correct number of entries ──

    def test_owner_username_returns_user_entries(self, entry_service):
        """BE-1: owner=alice returns only alice's 3 entries (not bob's 5)."""
        alice_id = _create_user(entry_service, "alice")
        bob_id = _create_user(entry_service, "bob")

        for i in range(3):
            entry_service.create_entry(
                summary=f"Alice entry {i}",
                slug=f"alice-{i}",
                current_user_id=alice_id,
            )
        for i in range(5):
            entry_service.create_entry(
                summary=f"Bob entry {i}",
                slug=f"bob-{i}",
                current_user_id=bob_id,
            )

        result = entry_service.list_entries(owner="alice")

        assert result.total == 3
        assert len(result.items) == 3
        assert all(item.username == "alice" for item in result.items)
        assert result.owner_found is True

    # ── BE-2: case insensitive username lookup ──

    def test_owner_username_case_insensitive(self, entry_service):
        """BE-2: owner=ALICE behaves same as owner=alice."""
        alice_id = _create_user(entry_service, "alice")
        bob_id = _create_user(entry_service, "bob")

        for i in range(2):
            entry_service.create_entry(
                summary=f"Alice {i}",
                slug=f"ci-alice-{i}",
                current_user_id=alice_id,
            )
        # Bob's entry ensures the count would be wrong without owner filter
        entry_service.create_entry(
            summary="Bob entry",
            slug="ci-bob",
            current_user_id=bob_id,
        )

        result = entry_service.list_entries(owner="ALICE")

        assert result.total == 2
        assert all(item.username == "alice" for item in result.items)
        assert result.owner_found is True

    # ── BE-3: nonexistent username returns empty + owner_found=false ──

    def test_owner_nonexistent_user_empty_list(self, entry_service):
        """BE-3: owner=nonexistent returns items=[] and owner_found=False."""
        result = entry_service.list_entries(owner="nonexistent")

        assert result.items == []
        assert result.total == 0
        assert result.owner_found is False

    # ── BE-4: username exists but no visible entries → empty + owner_found=true ──

    def test_owner_exists_but_no_visible_entries(self, entry_service):
        """BE-4: bob has only private entries, anonymous sees empty list."""
        bob_id = _create_user(entry_service, "bob")

        entry_service.create_entry(
            summary="Bob private entry",
            slug="bob-private",
            is_public=False,
            current_user_id=bob_id,
        )

        result = entry_service.list_entries(owner="bob")

        assert result.items == []
        assert result.total == 0
        assert result.owner_found is True

    # ── BE-5: owner="me" regression (owner_found=None) ──

    def test_owner_me_regression(self, entry_service):
        """BE-5: owner='me' still works and returns owner_found=None."""
        alice_id = _create_user(entry_service, "alice")

        entry_service.create_entry(
            summary="Public entry",
            slug="me-public",
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Private entry",
            slug="me-private",
            is_public=False,
            current_user_id=alice_id,
        )

        result = entry_service.list_entries(owner="me", current_user_id=alice_id)

        assert result.total == 2
        assert result.owner_found is None

    # ── BE-6: admin sees all entries (including private) ──

    def test_owner_admin_sees_all(self, entry_service):
        """BE-6: admin calling owner=alice sees alice's private entries too."""
        alice_id = _create_user(entry_service, "alice")
        bob_id = _create_user(entry_service, "bob")

        entry_service.create_entry(
            summary="Alice public",
            slug="adm-apub",
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Alice private",
            slug="adm-apriv",
            is_public=False,
            current_user_id=alice_id,
        )
        # Bob's entry ensures the count would be wrong without owner filter
        entry_service.create_entry(
            summary="Bob public",
            slug="adm-bpub",
            current_user_id=bob_id,
        )

        result = entry_service.list_entries(owner="alice", is_admin=True)

        assert result.total == 2
        assert result.owner_found is True

    # ── BE-7: anonymous sees only public entries ──

    def test_owner_anonymous_sees_public_only(self, entry_service):
        """BE-7: anonymous caller for owner=alice sees only alice's public entries."""
        alice_id = _create_user(entry_service, "alice")
        bob_id = _create_user(entry_service, "bob")

        entry_service.create_entry(
            summary="Alice public",
            slug="anon-apub",
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Alice private",
            slug="anon-apriv",
            is_public=False,
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Bob public (interference)",
            slug="anon-bpub",
            current_user_id=bob_id,
        )

        result = entry_service.list_entries(owner="alice")

        assert result.total == 1
        assert result.items[0].username == "alice"
        assert result.owner_found is True

    # ── BE-8: FTS + owner filter combo (non-empty result) ──

    def test_owner_with_fts_match(self, entry_service):
        """BE-8: owner=alice + q='python' returns only alice's matching entries."""
        alice_id = _create_user(entry_service, "alice")
        bob_id = _create_user(entry_service, "bob")

        entry_service.create_entry(
            summary="Python authentication module",
            slug="fts8-a1",
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Rust web framework tutorial",
            slug="fts8-b1",
            current_user_id=bob_id,
        )
        entry_service.create_entry(
            summary="Advanced Python patterns",
            slug="fts8-a2",
            current_user_id=alice_id,
        )
        # Bob's Python entry ensures FTS alone can't distinguish users
        entry_service.create_entry(
            summary="Python for Rustaceans",
            slug="fts8-b2",
            current_user_id=bob_id,
        )

        result = entry_service.list_entries(owner="alice", q="python")

        assert result.total == 2
        assert all(item.username == "alice" for item in result.items)
        assert result.owner_found is True

    # ── BE-9: FTS + owner filter combo (empty result) ──

    def test_owner_with_fts_no_match(self, entry_service):
        """BE-9: owner=alice + q='nonexistent' returns items=[], owner_found=True."""
        alice_id = _create_user(entry_service, "alice")

        entry_service.create_entry(
            summary="Python basics",
            slug="fts9-a1",
            current_user_id=alice_id,
        )
        entry_service.create_entry(
            summary="Web development",
            slug="fts9-a2",
            current_user_id=alice_id,
        )

        result = entry_service.list_entries(owner="alice", q="NoSuchKeywordXYZABC")

        assert result.items == []
        assert result.total == 0
        assert result.owner_found is True
