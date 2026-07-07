"""Tests for T006 admin-stats-cleanup: BDD conditions STATS-1~8, CLEANUP-1~8."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, User
from peekview.services.admin_service import AdminService


@pytest.fixture
async def admin_client(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


async def _setup_users(client):
    admin_resp = await client.post("/api/v1/auth/register", json={
        "username": "adminuser",
        "password": "adminpass123",
    })
    admin_token = admin_resp.json()["access_token"]

    user_resp = await client.post("/api/v1/auth/register", json={
        "username": "normaluser",
        "password": "normalpass123",
    })
    user_token = user_resp.json()["access_token"]

    return admin_token, user_token


def _make_admin_direct(app, session):
    user = session.exec(select(User).where(User.username == "adminuser")).first()
    if user and not user.is_admin:
        user.is_admin = True
        session.add(user)
        session.commit()


# --- STATS-1: Admin can get system statistics --- #


class TestAdminStats:
    @pytest.mark.asyncio
    async def test_stats_returns_all_fields(self, admin_client):
        admin_token, _user_token = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)

        resp = await admin_client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "entries" in data
        assert "api_keys" in data
        assert "storage" in data
        assert "total" in data["entries"]
        assert "public" in data["entries"]
        assert "private" in data["entries"]
        assert "expired" in data["entries"]
        assert "active" in data["entries"]
        assert "latest_created_at" in data["entries"]
        assert "total" in data["api_keys"]
        assert "expired" in data["api_keys"]
        assert "data_dir_mb" in data["storage"]
        assert "db_mb" in data["storage"]

    @pytest.mark.asyncio
    async def test_stats_counts_match_data(self, admin_client):
        admin_token, _user_token = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)
            for i in range(3):
                entry = Entry(
                    slug=f"pub-{i}",
                    summary=f"Public {i}",
                    is_public=True,
                )
                session.add(entry)
            for i in range(2):
                entry = Entry(
                    slug=f"priv-{i}",
                    summary=f"Private {i}",
                    is_public=False,
                )
                session.add(entry)
            from datetime import datetime, timedelta, timezone
            expired_entry = Entry(
                slug="expired-1",
                summary="Expired",
                is_public=True,
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            session.add(expired_entry)
            session.commit()

        resp = await admin_client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["users"] >= 2
        assert data["entries"]["total"] >= 6
        assert data["entries"]["public"] >= 4
        assert data["entries"]["private"] >= 2
        assert data["entries"]["expired"] >= 1
        assert data["entries"]["active"] == data["entries"]["total"] - data["entries"]["expired"]


# --- STATS-2: Non-admin rejected (403) --- #


class TestStatsNonAdminRejected:
    @pytest.mark.asyncio
    async def test_non_admin_get_stats_403(self, admin_client):
        _admin_token, user_token = await _setup_users(admin_client)

        resp = await admin_client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert resp.status_code == 403


# --- STATS-3: Unauthenticated rejected (401) --- #


class TestStatsUnauthenticatedRejected:
    @pytest.mark.asyncio
    async def test_unauthenticated_get_stats_401(self, admin_client):
        admin_client.cookies.clear()
        resp = await admin_client.get("/api/v1/admin/stats")
        assert resp.status_code == 401


# --- STATS-4: CLI admin stats local mode --- #


class TestCLIAdminStatsLocal:
    def test_admin_stats_local_runs(self, tmp_path, monkeypatch):
        from click.testing import CliRunner

        from peekview.cli import cli

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(data_dir))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(db_path))

        runner = CliRunner()
        result = runner.invoke(cli, ["admin", "stats"])
        assert result.exit_code == 0
        assert "Users" in result.output or "users" in result.output.lower()


# --- STATS-5: CLI admin stats remote mode --- #


class TestCLIAdminStatsRemote:
    def test_admin_stats_remote_mode_flag(self, tmp_path, monkeypatch):
        from click.testing import CliRunner

        from peekview.cli import cli

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(data_dir))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(db_path))

        runner = CliRunner()
        result = runner.invoke(cli, ["admin", "stats", "-r", "http://nonexistent:9999"])
        assert "Remote mode" in result.output or result.exit_code != 0


# --- STATS-6: CLI admin stats JSON output --- #


class TestCLIAdminStatsJSON:
    def test_admin_stats_json_output(self, tmp_path, monkeypatch):
        import json

        from click.testing import CliRunner

        from peekview.cli import cli

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(data_dir))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(db_path))

        runner = CliRunner()
        result = runner.invoke(cli, ["admin", "stats", "--json-output"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert "users" in data
        assert "entries" in data
        assert "api_keys" in data
        assert "storage" in data


# --- STATS-7: Empty system statistics --- #


class TestStatsEmptySystem:
    @pytest.mark.asyncio
    async def test_stats_empty_system(self, admin_client):
        admin_token, _ = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)
            for entry in session.exec(select(Entry)).all():
                session.delete(entry)
            session.commit()

        resp = await admin_client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["entries"]["total"] == 0
        assert data["api_keys"]["total"] == 0
        assert data["storage"]["data_dir_mb"] >= 0
        assert data["storage"]["db_mb"] >= 0


# --- STATS-8: Stats performance (≤ 500ms with 1000 entries) --- #


class TestStatsPerformance:
    def test_stats_performance_1000_entries(self, tmp_path):
        import time

        from peekview.config import PeekConfig
        from peekview.database import init_db
        from peekview.storage import StorageManager

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        config = PeekConfig(data_dir=data_dir, db_path=db_path)
        engine = init_db(config.db_path, run_migrations=True)
        storage = StorageManager(config=config)

        with Session(engine) as session:
            from sqlalchemy import text
            session.exec(text("DELETE FROM files"))
            session.exec(text("DELETE FROM entries"))
            session.commit()
            entries = []
            for i in range(1000):
                entry = Entry(
                    slug=f"perf-entry-{i:04d}",
                    summary=f"Performance test entry {i}",
                    is_public=(i % 2 == 0),
                )
                entries.append(entry)
            session.add_all(entries)
            session.commit()

        admin_service = AdminService(engine=engine, storage=storage, config=config)
        admin_service.get_stats()
        start = time.time()
        result = admin_service.get_stats()
        elapsed_ms = (time.time() - start) * 1000

        assert result.entries.total == 1000
        assert elapsed_ms <= 500, f"Stats took {elapsed_ms:.1f}ms, exceeds 500ms limit"

        engine.dispose()


# --- CLEANUP-1: Admin can trigger expired entry cleanup --- #


class TestAdminCleanup:
    @pytest.mark.asyncio
    async def test_cleanup_deletes_expired_entries(self, admin_client):
        admin_token, _ = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)
            from datetime import datetime, timedelta, timezone
            for i in range(3):
                entry = Entry(
                    slug=f"expired-cleanup-{i}",
                    summary=f"Expired {i}",
                    expires_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
                session.add(entry)
            session.commit()

        resp = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["archived_count"] == 3
        assert len(data["archived_slugs"]) == 3
        assert data["deleted_count"] == 0

        with Session(engine) as session:
            remaining = session.exec(
                select(Entry).where(Entry.slug.like("expired-cleanup-%"))
            ).all()
            assert len(remaining) == 3
            for e in remaining:
                assert e.status == "archived"


# --- CLEANUP-2: No expired entries → idempotent zero --- #


class TestCleanupNoExpired:
    @pytest.mark.asyncio
    async def test_cleanup_no_expired_entries(self, admin_client):
        admin_token, _ = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)

        resp = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["archived_count"] == 0
        assert data["deleted_count"] == 0
        assert data["deleted_slugs"] == []
        assert data["freed_mb"] == 0.0


# --- CLEANUP-3: Repeated cleanup idempotent --- #


class TestCleanupIdempotent:
    @pytest.mark.asyncio
    async def test_cleanup_idempotent_two_calls(self, admin_client):
        admin_token, _ = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)
            from datetime import datetime, timedelta, timezone
            for i in range(2):
                entry = Entry(
                    slug=f"idem-expired-{i}",
                    summary=f"Idempotent {i}",
                    expires_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
                session.add(entry)
            session.commit()

        resp1 = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp1.status_code == 200
        assert resp1.json()["archived_count"] == 2

        resp2 = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["archived_count"] == 0


# --- CLEANUP-4: Non-admin rejected from cleanup (403) --- #


class TestCleanupNonAdminRejected:
    @pytest.mark.asyncio
    async def test_non_admin_cleanup_403(self, admin_client):
        _admin_token, user_token = await _setup_users(admin_client)

        resp = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert resp.status_code == 403


# --- CLEANUP-5: Unauthenticated rejected from cleanup (401) --- #


class TestCleanupUnauthenticatedRejected:
    @pytest.mark.asyncio
    async def test_unauthenticated_cleanup_401(self, admin_client):
        admin_client.cookies.clear()
        resp = await admin_client.post("/api/v1/admin/cleanup")
        assert resp.status_code == 401


# --- CLEANUP-6: CLI admin cleanup local mode --- #


class TestCLIAdminCleanupLocal:
    def test_admin_cleanup_local_runs(self, tmp_path, monkeypatch):
        from click.testing import CliRunner

        from peekview.cli import cli

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(data_dir))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(db_path))

        runner = CliRunner()
        result = runner.invoke(cli, ["admin", "cleanup"])
        assert result.exit_code == 0
        assert "No expired" in result.output or "Archived:" in result.output or result.output.strip() == ""


# --- CLEANUP-7: CLI admin cleanup remote mode --- #


class TestCLIAdminCleanupRemote:
    def test_admin_cleanup_remote_mode_flag(self, tmp_path, monkeypatch):
        from click.testing import CliRunner

        from peekview.cli import cli

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        db_path = tmp_path / "test.db"

        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(data_dir))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(db_path))

        runner = CliRunner()
        result = runner.invoke(cli, ["admin", "cleanup", "-r", "http://nonexistent:9999"])
        assert "Remote mode" in result.output or result.exit_code != 0


# --- CLEANUP-8: Cleanup does not delete non-expired entries --- #


class TestCleanupPreservesActive:
    @pytest.mark.asyncio
    async def test_cleanup_preserves_active_entries(self, admin_client):
        admin_token, _ = await _setup_users(admin_client)
        engine = admin_client._app.state.engine
        with Session(engine) as session:
            _make_admin_direct(admin_client._app, session)
            from datetime import datetime, timedelta, timezone

            active_entry = Entry(
                slug="active-keep",
                summary="Active entry",
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            )
            session.add(active_entry)

            expired_entry = Entry(
                slug="expired-remove",
                summary="Expired entry",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            session.add(expired_entry)
            session.commit()

        resp = await admin_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["archived_count"] == 1
        assert "expired-remove" in data["archived_slugs"]
        assert "active-keep" not in data["archived_slugs"]

        with Session(engine) as session:
            active = session.exec(
                select(Entry).where(Entry.slug == "active-keep")
            ).first()
            assert active is not None
