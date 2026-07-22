"""Tests for T060 archived visibility: BDD A1-A7, A1b-A3b, M3.

Covers default archived exclusion for owner/admin/anonymous, plus
explicit status=archived filtering and status parameter validation.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, User


@pytest.fixture
async def lifecycle_client(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


async def _register_user(client, username, password="testpass123"):
    resp = await client.post("/api/v1/auth/register", json={
        "username": username,
        "password": password,
    })
    return resp.json()["access_token"]


def _create_entry_direct(app, session, *, slug, summary="Test", is_public=True,
                         status="active", expires_at=None, archived_at=None, owner_id=None):
    entry = Entry(
        slug=slug,
        summary=summary,
        is_public=is_public,
        status=status,
        expires_at=expires_at,
        archived_at=archived_at,
        owner_id=owner_id,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def _make_admin(app, session, username="adminuser"):
    user = session.exec(select(User).where(User.username == username)).first()
    if user and not user.is_admin:
        user.is_admin = True
        session.add(user)
        session.commit()


class TestOwnerDefaultExcludesArchived:
    """BDD-A1: All tab (no status param) excludes archived for authenticated owner."""

    @pytest.mark.asyncio
    async def test_owner_list_excludes_own_archived(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-a1")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a1")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a1-active-1",
                owner_id=user.id,
                is_public=False,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a1-active-2",
                owner_id=user.id,
                is_public=False,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a1-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a1-active-1" in slugs
        assert "a1-active-2" in slugs
        assert "a1-archived" not in slugs

    @pytest.mark.asyncio
    async def test_all_archived_user_all_tab_returns_empty(self, lifecycle_client):
        """BDD-A1b: User with only archived entries sees empty All tab."""
        token = await _register_user(lifecycle_client, "owner-a1b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a1b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a1b-only-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestOwnerMineExcludesArchived:
    """BDD-A2: Mine tab (?owner=me) excludes archived for authenticated owner."""

    @pytest.mark.asyncio
    async def test_owner_mine_excludes_archived(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-a2")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a2")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a2-active-1",
                owner_id=user.id,
                is_public=False,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a2-active-2",
                owner_id=user.id,
                is_public=False,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a2-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?owner=me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a2-active-1" in slugs
        assert "a2-active-2" in slugs
        assert "a2-archived" not in slugs

    @pytest.mark.asyncio
    async def test_all_archived_user_mine_returns_empty(self, lifecycle_client):
        """BDD-A2b: User with only archived entries sees empty Mine tab."""
        token = await _register_user(lifecycle_client, "owner-a2b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a2b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a2b-only-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?owner=me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestOwnerArchivedTab:
    """BDD-A3: Archived tab (?status=archived) shows own archived entries."""

    @pytest.mark.asyncio
    async def test_owner_archived_tab_shows_archived(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-a3")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a3")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a3-active",
                owner_id=user.id,
                is_public=False,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a3-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?status=archived",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a3-archived" in slugs
        assert "a3-active" not in slugs

    @pytest.mark.asyncio
    async def test_no_archived_entries_archived_tab_empty(self, lifecycle_client):
        """BDD-A3b: User with only active entries sees empty Archived tab."""
        token = await _register_user(lifecycle_client, "owner-a3b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-a3b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a3b-active",
                owner_id=user.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?status=archived",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestAdminArchived:
    """BDD-A4, A5: Admin archived visibility."""

    @pytest.mark.asyncio
    async def test_admin_all_tab_excludes_archived(self, lifecycle_client):
        """BDD-A4: Admin All tab excludes archived entries (from all users)."""
        admin_token = await _register_user(lifecycle_client, "admin-a4")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin-a4")
            # User 1: 2 active + 1 archived (all public for visibility)
            user1 = session.exec(
                select(User).where(User.username == "admin-a4")
            ).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a4-u1-active-1",
                owner_id=user1.id,
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a4-u1-active-2",
                owner_id=user1.id,
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a4-u1-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user1.id,
                is_public=True,
            )

        # User 2: 1 active + 1 archived
        await _register_user(lifecycle_client, "user-a4")
        with Session(engine) as session:
            user2 = session.exec(select(User).where(User.username == "user-a4")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a4-u2-active",
                owner_id=user2.id,
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a4-u2-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user2.id,
                is_public=True,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a4-u1-active-1" in slugs
        assert "a4-u1-active-2" in slugs
        assert "a4-u2-active" in slugs
        assert "a4-u1-archived" not in slugs
        assert "a4-u2-archived" not in slugs

    @pytest.mark.asyncio
    async def test_admin_archived_tab_sees_all_archived(self, lifecycle_client):
        """BDD-A5: Admin Archived tab shows all archived entries (all users)."""
        admin_token = await _register_user(lifecycle_client, "admin-a5")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin-a5")
            user1 = session.exec(
                select(User).where(User.username == "admin-a5")
            ).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a5-u1-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user1.id,
                is_public=True,
            )

        await _register_user(lifecycle_client, "user-a5")
        with Session(engine) as session:
            user2 = session.exec(select(User).where(User.username == "user-a5")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a5-u2-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user2.id,
                is_public=False,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?status=archived",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a5-u1-archived" in slugs
        assert "a5-u2-archived" in slugs


class TestAnonymousArchived:
    """BDD-A6: Anonymous users cannot see any archived entries."""

    @pytest.mark.asyncio
    async def test_anonymous_all_tab_excludes_archived(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a6-public-active",
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a6-public-archived",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a6-private-archived",
                is_public=False,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get("/api/v1/entries")
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a6-public-active" in slugs
        assert "a6-public-archived" not in slugs
        assert "a6-private-archived" not in slugs

    @pytest.mark.asyncio
    async def test_anonymous_archived_tab_returns_empty(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a6b-public-archived",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get("/api/v1/entries?status=archived")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestNonOwnerArchived:
    """BDD-A7: Non-owner authenticated users cannot see others' archived entries."""

    @pytest.mark.asyncio
    async def test_non_owner_cannot_see_others_archived_in_all_tab(self, lifecycle_client):
        await _register_user(lifecycle_client, "user-a7-a")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user_a = session.exec(select(User).where(User.username == "user-a7-a")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a7-a-active",
                owner_id=user_a.id,
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a7-a-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user_a.id,
                is_public=True,
            )

        token_b = await _register_user(lifecycle_client, "user-a7-b")
        resp = await lifecycle_client.get(
            "/api/v1/entries",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a7-a-active" in slugs
        assert "a7-a-archived" not in slugs

    @pytest.mark.asyncio
    async def test_non_owner_cannot_see_others_archived_in_archived_tab(self, lifecycle_client):
        await _register_user(lifecycle_client, "user-a7c-a")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user_a = session.exec(select(User).where(User.username == "user-a7c-a")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="a7c-a-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user_a.id,
                is_public=False,
            )

        token_b = await _register_user(lifecycle_client, "user-a7c-b")
        resp = await lifecycle_client.get(
            "/api/v1/entries?status=archived",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "a7c-a-archived" not in slugs


class TestStatusValidation:
    """BDD-M3: Invalid status parameter returns 422."""

    @pytest.mark.asyncio
    async def test_invalid_status_returns_422(self, lifecycle_client):
        resp = await lifecycle_client.get("/api/v1/entries?status=invalid")
        assert resp.status_code == 422
