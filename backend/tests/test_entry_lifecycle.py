"""Tests for T048 entry-lifecycle: BDD conditions B1-B10, B14.

Two-phase lifecycle: active → archived → permanent deletion.
PATCH expires_in for renewal/reactivation. Archived access control.
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


@pytest.fixture
async def cleanup_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS", "30")
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


@pytest.fixture
async def retention_zero_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS", "0")
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


def _make_admin(app, session, username="adminuser"):
    user = session.exec(select(User).where(User.username == username)).first()
    if user and not user.is_admin:
        user.is_admin = True
        session.add(user)
        session.commit()


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


# ============================================================
# B1: Cleanup archives expired active entries
# ============================================================


class TestCleanupArchivePhase:
    @pytest.mark.asyncio
    async def test_cleanup_archives_expired_active_entry(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin1")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin1")
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="expired-1",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        resp = await lifecycle_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("archived_count", 0) >= 1
        assert "expired-1" in data.get("archived_slugs", [])

    @pytest.mark.asyncio
    async def test_cleanup_archived_entry_has_archived_at_set(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin2")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin2")
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="expired-at-check",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        await lifecycle_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "expired-at-check")).first()
            assert entry is not None
            assert entry.archived_at is not None

    @pytest.mark.asyncio
    async def test_cleanup_archived_entry_expires_at_null(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin3")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin3")
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="expired-null-check",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        await lifecycle_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "expired-null-check")).first()
            assert entry is not None
            assert entry.expires_at is None

    @pytest.mark.asyncio
    async def test_cleanup_response_has_archived_count(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin4")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin4")

        resp = await lifecycle_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "archived_count" in data
        assert "archived_slugs" in data

    @pytest.mark.asyncio
    async def test_cleanup_response_deleted_count_zero_when_only_archiving(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin5")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin5")
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="fresh-expired",
                expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            )

        resp = await lifecycle_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["archived_count"] >= 1
        assert data["deleted_count"] == 0


# ============================================================
# B2: Cleanup physically deletes old archived entries
# ============================================================


class TestCleanupDeletePhase:
    @pytest.mark.asyncio
    async def test_cleanup_deletes_archived_entry_past_retention(self, cleanup_client):
        admin_token = await _register_user(cleanup_client, "admin6")
        engine = cleanup_client._app.state.engine
        with Session(engine) as session:
            _make_admin(cleanup_client._app, session, "admin6")
            _create_entry_direct(
                cleanup_client._app, session,
                slug="old-archived",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=31),
            )

        resp = await cleanup_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted_count"] >= 1
        assert "old-archived" in data.get("deleted_slugs", [])

    @pytest.mark.asyncio
    async def test_cleanup_deleted_entry_removed_from_db(self, cleanup_client):
        admin_token = await _register_user(cleanup_client, "admin7")
        engine = cleanup_client._app.state.engine
        with Session(engine) as session:
            _make_admin(cleanup_client._app, session, "admin7")
            _create_entry_direct(
                cleanup_client._app, session,
                slug="db-remove-check",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=31),
            )

        await cleanup_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "db-remove-check")).first()
            assert entry is None

    @pytest.mark.asyncio
    async def test_cleanup_deleted_entry_freed_mb_positive(self, cleanup_client):
        admin_token = await _register_user(cleanup_client, "admin8")
        engine = cleanup_client._app.state.engine
        with Session(engine) as session:
            _make_admin(cleanup_client._app, session, "admin8")
            _create_entry_direct(
                cleanup_client._app, session,
                slug="freed-mb-check",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=31),
            )

        resp = await cleanup_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted_count"] >= 1
        assert data["freed_mb"] >= 0

    @pytest.mark.asyncio
    async def test_cleanup_both_phases_in_single_call(self, cleanup_client):
        admin_token = await _register_user(cleanup_client, "admin9")
        engine = cleanup_client._app.state.engine
        with Session(engine) as session:
            _make_admin(cleanup_client._app, session, "admin9")
            _create_entry_direct(
                cleanup_client._app, session,
                slug="to-archive",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            _create_entry_direct(
                cleanup_client._app, session,
                slug="to-delete",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=31),
            )

        resp = await cleanup_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["archived_count"] >= 1
        assert data["deleted_count"] >= 1
        assert "to-archive" in data.get("archived_slugs", [])
        assert "to-delete" in data.get("deleted_slugs", [])


# ============================================================
# B3: Cleanup retention=0 never deletes archived
# ============================================================


class TestCleanupRetentionZero:
    @pytest.mark.asyncio
    async def test_cleanup_retention_zero_preserves_archived(self, retention_zero_client):
        admin_token = await _register_user(retention_zero_client, "admin10")
        engine = retention_zero_client._app.state.engine
        with Session(engine) as session:
            _make_admin(retention_zero_client._app, session, "admin10")
            _create_entry_direct(
                retention_zero_client._app, session,
                slug="keep-forever",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=120),
            )

        resp = await retention_zero_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted_count"] == 0

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "keep-forever")).first()
            assert entry is not None

    @pytest.mark.asyncio
    async def test_cleanup_retention_zero_deleted_count_zero(self, retention_zero_client):
        admin_token = await _register_user(retention_zero_client, "admin11")
        engine = retention_zero_client._app.state.engine
        with Session(engine) as session:
            _make_admin(retention_zero_client._app, session, "admin11")
            _create_entry_direct(
                retention_zero_client._app, session,
                slug="retention-zero-check",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=200),
            )

        resp = await retention_zero_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["deleted_count"] == 0


# ============================================================
# B4: PATCH expires_in extends active entry expiry
# ============================================================


class TestPatchExpiresIn:
    @pytest.mark.asyncio
    async def test_patch_expires_in_updates_expires_at(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b4")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b4")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="extend-expiry",
                expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                owner_id=user.id,
            )

        before = datetime.utcnow()
        resp = await lifecycle_client.patch(
            "/api/v1/entries/extend-expiry",
            json={"expires_in": "30d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        new_expires = datetime.fromisoformat(data["expires_at"].replace("Z", ""))
        expected = before + timedelta(days=30)
        assert abs((new_expires - expected).total_seconds()) < 10

    @pytest.mark.asyncio
    async def test_patch_expires_in_keeps_status_active(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b4b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b4b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="status-active-check",
                expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/status-active-check",
            json={"expires_in": "30d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ============================================================
# B5: PATCH expires_in="0" sets never expire
# ============================================================


class TestPatchExpiresInZero:
    @pytest.mark.asyncio
    async def test_patch_expires_in_zero_clears_expires_at(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b5")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b5")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="never-expire",
                expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/never-expire",
            json={"expires_in": "0"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["expires_at"] is None

    @pytest.mark.asyncio
    async def test_patch_expires_in_zero_keeps_status_active(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b5b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b5b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="never-expire-status",
                expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/never-expire-status",
            json={"expires_in": "0"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ============================================================
# B6: PATCH archived entry + expires_in reactivates
# ============================================================


class TestPatchReactivate:
    @pytest.mark.asyncio
    async def test_patch_archived_entry_expires_in_reactivates(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b6")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b6")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="reactivate-me",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/reactivate-me",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    @pytest.mark.asyncio
    async def test_reactivated_entry_status_active(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b6b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b6b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="react-status",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/react-status",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    @pytest.mark.asyncio
    async def test_reactivated_entry_archived_at_null(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b6c")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b6c")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="react-at-null",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/react-at-null",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json().get("archived_at") is None

    @pytest.mark.asyncio
    async def test_reactivated_entry_expires_at_set(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b6d")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b6d")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="react-exp-set",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=user.id,
            )

        before = datetime.utcnow()
        resp = await lifecycle_client.patch(
            "/api/v1/entries/react-exp-set",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        new_expires = datetime.fromisoformat(resp.json()["expires_at"].replace("Z", ""))
        expected = before + timedelta(days=7)
        assert abs((new_expires - expected).total_seconds()) < 10

    @pytest.mark.asyncio
    async def test_reactivated_with_expires_in_zero_sets_permanent(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "user-b6e")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "user-b6e")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="react-permanent",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=user.id,
            )

        resp = await lifecycle_client.patch(
            "/api/v1/entries/react-permanent",
            json={"expires_in": "0"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["expires_at"] is None


# ============================================================
# B7: Archived entry access control
# ============================================================


class TestArchivedAccessControl:
    @pytest.mark.asyncio
    async def test_anonymous_get_archived_public_entry_404(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-pub",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get("/api/v1/entries/archived-pub")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_get_archived_entry_200(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-b7")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-b7")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-owner",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries/archived-owner",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    @pytest.mark.asyncio
    async def test_non_owner_get_archived_entry_404(self, lifecycle_client):
        await _register_user(lifecycle_client, "owner-b7c")
        other_token = await _register_user(lifecycle_client, "other-b7c")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-b7c")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-nonowner",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries/archived-nonowner",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_admin_get_archived_entry_200(self, lifecycle_client):
        admin_token = await _register_user(lifecycle_client, "admin-b7d")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _make_admin(lifecycle_client._app, session, "admin-b7d")
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-admin",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries/archived-admin",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"


# ============================================================
# B8: Owner list includes archived entries
# ============================================================


class TestOwnerListArchived:
    @pytest.mark.asyncio
    async def test_owner_list_includes_archived_entries(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-b8")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-b8")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="active-mine",
                owner_id=user.id,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-mine",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?owner=me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        slugs = [e["slug"] for e in data["items"]]
        assert "active-mine" in slugs
        assert "archived-mine" not in slugs

    @pytest.mark.asyncio
    async def test_owner_list_total_includes_archived(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-b8b")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-b8b")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="active-count",
                owner_id=user.id,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-count",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
            )

        resp = await lifecycle_client.get(
            "/api/v1/entries?owner=me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


# ============================================================
# B9: Anonymous list excludes archived entries
# ============================================================


class TestAnonymousListExcludesArchived:
    @pytest.mark.asyncio
    async def test_anonymous_list_excludes_archived(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="pub-active",
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="pub-archived",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get("/api/v1/entries")
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "pub-active" in slugs
        assert "pub-archived" not in slugs

    @pytest.mark.asyncio
    async def test_anonymous_list_total_excludes_archived(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="pub-active-2",
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="pub-archived-2",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get("/api/v1/entries")
        assert resp.status_code == 200
        data = resp.json()
        archived_in_items = [e for e in data["items"] if e.get("status") == "archived"]
        assert len(archived_in_items) == 0


# ============================================================
# B10: Share cannot be created for archived entry
# ============================================================


class TestShareArchivedEntry:
    @pytest.mark.asyncio
    async def test_create_share_archived_entry_400(self, lifecycle_client):
        token = await _register_user(lifecycle_client, "owner-b10")
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "owner-b10")).first()
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="archived-share",
                is_public=False,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
                owner_id=user.id,
            )

        resp = await lifecycle_client.post(
            "/api/v1/entries/archived-share/shares",
            json={"expires_in": "7d", "max_views": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (400, 422)


# ============================================================
# B14: FTS search excludes archived entries
# ============================================================


class TestFTSExcludesArchived:
    @pytest.mark.asyncio
    async def test_fts_search_excludes_archived_entry(self, lifecycle_client):
        engine = lifecycle_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="fts-active",
                summary="uniquekeyword-alpha in active entry",
                is_public=True,
            )
            _create_entry_direct(
                lifecycle_client._app, session,
                slug="fts-archived",
                summary="uniquekeyword-alpha in archived entry",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )

        lifecycle_client.cookies.clear()
        resp = await lifecycle_client.get(
            "/api/v1/entries?q=uniquekeyword-alpha",
        )
        assert resp.status_code == 200
        slugs = [e["slug"] for e in resp.json()["items"]]
        assert "fts-archived" not in slugs
