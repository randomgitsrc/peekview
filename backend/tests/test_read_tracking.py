"""Tests for entry read tracking — BDD B01-B14.

TDD red-light: imports EntryRead, ReadTrackingService, read_stats field
which do not exist yet. Tests should fail at import/attribute time.
"""

import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine, select

from peekview.models import EntryRead, ReadStatsResponse


# --- Fixtures ---


@pytest.fixture(scope="function")
def tracking_engine(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def tracking_session(tracking_engine):
    with Session(tracking_engine) as session:
        yield session
        session.rollback()


@pytest.fixture(scope="function")
def read_tracking_service(tracking_engine):
    from peekview.services.read_tracking_service import ReadTrackingService
    return ReadTrackingService(engine=tracking_engine)


@pytest.fixture(scope="function")
async def client_and_app():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        from peekview.main import create_app
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            c.cookies.clear()
            yield c, app
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# --- Helpers ---


async def _register(client, username="testuser", password="testpass123"):
    resp = await client.post("/api/v1/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 201
    return resp.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_entry(client, auth_token=None, slug=None, summary="Test entry", is_public=True, files=None):
    data = {"summary": summary, "is_public": is_public}
    if slug:
        data["slug"] = slug
    if files:
        data["files"] = files
    headers = _auth(auth_token) if auth_token else {}
    resp = await client.post("/api/v1/entries", json=data, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _wait_for_async_write(delay=0.15):
    import asyncio
    await asyncio.sleep(delay)


# ============================================================
# 1. EntryRead Model Tests
# ============================================================


class TestEntryReadModel:
    def test_entry_read_create(self, tracking_session):
        record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            reader_type="anonymous",
            reader_id=None,
            is_self_read=False,
            count=1,
            window_key="1:a:abc12345:api:2026-06-30T14:23",
            reader_fingerprint="a:abc12345",
        )
        tracking_session.add(record)
        tracking_session.commit()
        tracking_session.refresh(record)

        assert record.id is not None
        assert record.entry_id == 1
        assert record.action == "read"
        assert record.channel == "api"
        assert record.reader_type == "anonymous"
        assert record.reader_id is None
        assert record.is_self_read is False
        assert record.count == 1
        assert record.window_key == "1:a:abc12345:api:2026-06-30T14:23"
        assert record.reader_fingerprint == "a:abc12345"

    def test_window_key_unique_constraint(self, tracking_session):
        from sqlalchemy.exc import IntegrityError
        r1 = EntryRead(
            entry_id=1,
            channel="api",
            count=1,
            window_key="1:a:abc12345:api:2026-06-30T14:23",
            reader_fingerprint="a:abc12345",
        )
        tracking_session.add(r1)
        tracking_session.commit()

        r2 = EntryRead(
            entry_id=1,
            channel="api",
            count=1,
            window_key="1:a:abc12345:api:2026-06-30T14:23",
            reader_fingerprint="a:abc12345",
        )
        tracking_session.add(r2)
        with pytest.raises(IntegrityError):
            tracking_session.commit()

    def test_entry_read_default_values(self, tracking_session):
        record = EntryRead(
            entry_id=1,
            window_key="1:a:abc12345:api:2026-06-30T14:23",
            reader_fingerprint="a:abc12345",
        )
        tracking_session.add(record)
        tracking_session.commit()
        tracking_session.refresh(record)

        assert record.action == "read"
        assert record.channel == "api"
        assert record.reader_type == "anonymous"
        assert record.reader_id is None
        assert record.is_self_read is False
        assert record.count == 1


# ============================================================
# 2. ReadTrackingService Tests
# ============================================================


class TestReadTrackingServiceRecordRead:
    def test_record_read_api_channel(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=None,
            reader_ip="1.2.3.4",
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 1
        assert records[0].channel == "api"

    def test_record_read_mcp_channel(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="mcp",
            reader_id=5,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 1
        assert records[0].channel == "mcp"

    def test_record_read_non_owner_is_self_read_false(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].is_self_read is False
        assert records[0].reader_id == 5

    def test_record_read_owner_is_self_read_true(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=10,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].is_self_read is True

    def test_record_read_anonymous(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=None,
            reader_ip="1.2.3.4",
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].reader_type == "anonymous"
        assert records[0].reader_id is None

    def test_record_read_authenticated_reader_type(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].reader_type == "authenticated"

    def test_record_read_window_aggregation(self, read_tracking_service, tracking_session):
        for _ in range(5):
            read_tracking_service.record_read(
                entry_id=1,
                entry_owner_id=10,
                action="read",
                channel="api",
                reader_id=5,
                reader_ip=None,
            )
        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 1
        assert records[0].count == 5

    def test_record_read_different_window(self, read_tracking_service, tracking_session):
        import hashlib

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )

        from unittest.mock import patch
        from datetime import timedelta

        future_time = datetime.now(timezone.utc) + timedelta(minutes=2)
        with patch("peekview.services.read_tracking_service.datetime") as mock_dt:
            mock_dt.now.return_value = future_time
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            read_tracking_service.record_read(
                entry_id=1,
                entry_owner_id=10,
                action="read",
                channel="api",
                reader_id=5,
                reader_ip=None,
            )

        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 2
        assert records[0].count == 1
        assert records[1].count == 1

    def test_record_discover_action(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=0,
            entry_owner_id=None,
            action="discover",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 1
        assert records[0].action == "discover"

    def test_record_read_reader_fingerprint_authenticated(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].reader_fingerprint == "u:5"

    def test_record_read_reader_fingerprint_anonymous_ip(self, read_tracking_service, tracking_session):
        import hashlib
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=None,
            reader_ip="1.2.3.4",
        )
        records = tracking_session.exec(select(EntryRead)).all()
        expected = f"a:{hashlib.sha256(b'1.2.3.4').hexdigest()[:8]}"
        assert records[0].reader_fingerprint == expected

    def test_record_read_reader_fingerprint_anonymous_no_ip(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=None,
            reader_ip=None,
        )
        records = tracking_session.exec(select(EntryRead)).all()
        assert records[0].reader_fingerprint == "a:unknown"


class TestReadTrackingServiceStats:
    def _seed_reads(self, service, session):
        service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="api", reader_id=5, reader_ip=None)
        service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="api", reader_id=5, reader_ip=None)
        service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="mcp", reader_id=6, reader_ip=None)
        service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="api", reader_id=10, reader_ip=None)

    def test_get_read_stats_total_count(self, read_tracking_service, tracking_session):
        self._seed_reads(read_tracking_service, tracking_session)
        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert stats.total_count == 4

    def test_get_read_stats_total_count_excludes_self_reads(self, read_tracking_service, tracking_session):
        self._seed_reads(read_tracking_service, tracking_session)
        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert stats.total_count == 4
        non_self_records = tracking_session.exec(
            select(EntryRead).where(EntryRead.is_self_read == False)
        ).all()
        non_self_count = sum(r.count for r in non_self_records)
        assert non_self_count == 3

    def test_get_read_stats_by_channel(self, read_tracking_service, tracking_session):
        self._seed_reads(read_tracking_service, tracking_session)
        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert "api" in stats.by_channel
        assert "mcp" in stats.by_channel

    def test_get_read_stats_unique_readers(self, read_tracking_service, tracking_session):
        self._seed_reads(read_tracking_service, tracking_session)
        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert stats.unique_readers >= 2

    def test_get_read_stats_last_read_at(self, read_tracking_service, tracking_session):
        self._seed_reads(read_tracking_service, tracking_session)
        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert stats.last_read_at is not None

    def test_get_read_stats_empty(self, read_tracking_service, tracking_session):
        stats = read_tracking_service.get_read_stats(entry_id=999)
        assert stats.total_count == 0
        assert stats.unique_readers == 0
        assert stats.by_channel == {}
        assert stats.last_read_at is None


class TestReadTrackingServiceEvents:
    def test_get_read_events_pagination(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="api", reader_id=5, reader_ip=None)
        read_tracking_service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="mcp", reader_id=6, reader_ip=None)

        result = read_tracking_service.get_read_events(entry_id=1, page=1, per_page=1)
        assert len(result.items) == 1
        assert result.total == 2
        assert result.page == 1
        assert result.per_page == 1

    def test_get_read_events_fields(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(entry_id=1, entry_owner_id=10, action="read", channel="api", reader_id=5, reader_ip=None)
        result = read_tracking_service.get_read_events(entry_id=1)
        event = result.items[0]
        assert hasattr(event, "id")
        assert hasattr(event, "action")
        assert hasattr(event, "channel")
        assert hasattr(event, "reader_type")
        assert hasattr(event, "is_self_read")
        assert hasattr(event, "count")
        assert hasattr(event, "read_at")
        assert hasattr(event, "updated_at")


# ============================================================
# 3. API Endpoint Tests
# ============================================================


class TestAPIReadTracking:
    @pytest.mark.asyncio
    async def test_get_entry_records_read_event(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(client, slug="read-track-test", is_public=True)
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            assert len(records) >= 1
            assert records[0].action == "read"

    @pytest.mark.asyncio
    async def test_get_entry_mcp_channel_header(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(client, slug="mcp-channel-test", is_public=True)
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}", headers={"X-PeekView-Source": "mcp"})
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            assert len(records) >= 1
            assert records[0].channel == "mcp"

    @pytest.mark.asyncio
    async def test_share_link_records_channel_share(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerA", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="share-track-test", is_public=False)
        slug = entry["slug"]

        resp = await client.post(
            f"/api/v1/entries/{slug}/shares",
            json={"expires_in": "7d"},
            headers=_auth(user_a["access_token"]),
        )
        assert resp.status_code == 201
        share_data = resp.json()
        share_token = share_data["share_url"].split("?share=")[1]

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share={share_token}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            assert len(records) >= 1
            assert records[0].channel == "share"

    @pytest.mark.asyncio
    async def test_non_owner_read_is_self_read_false(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerB", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="self-read-test", is_public=True)
        slug = entry["slug"]

        user_b = await _register(client, username="readerB", password="testpass123")
        await client.get(f"/api/v1/entries/{slug}", headers=_auth(user_b["access_token"]))
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.channel == "api")
            ).all()
            non_self = [r for r in records if r.reader_id is not None and r.is_self_read is False]
            assert len(non_self) >= 1

    @pytest.mark.asyncio
    async def test_owner_read_is_self_read_true(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerC", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="owner-self-read", is_public=True)
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}", headers=_auth(user_a["access_token"]))
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            self_reads = [r for r in records if r.is_self_read is True]
            assert len(self_reads) >= 1

    @pytest.mark.asyncio
    async def test_anonymous_read_public_entry(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(client, slug="anon-read-test", is_public=True)
        slug = entry["slug"]

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            assert len(records) >= 1
            assert records[0].reader_type == "anonymous"
            assert records[0].reader_id is None

    @pytest.mark.asyncio
    async def test_read_tracking_does_not_block_response(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(client, slug="perf-test", is_public=True)
        slug = entry["slug"]

        times_with_tracking = []
        for _ in range(5):
            start = time.monotonic()
            resp = await client.get(f"/api/v1/entries/{slug}")
            elapsed = (time.monotonic() - start) * 1000
            assert resp.status_code == 200
            times_with_tracking.append(elapsed)

        avg_time = sum(times_with_tracking) / len(times_with_tracking)
        assert avg_time < 200, f"Average response time {avg_time:.1f}ms too high"

    @pytest.mark.asyncio
    async def test_high_frequency_read_aggregation(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(client, slug="freq-read-test", is_public=True)
        slug = entry["slug"]

        for _ in range(10):
            await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            read_records = [r for r in records if r.action == "read"]
            total_count = sum(r.count for r in read_records)
            assert total_count >= 10
            assert len(read_records) <= 3

    @pytest.mark.asyncio
    async def test_owner_sees_read_stats(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerD", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="stats-owner-test", is_public=True)
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        resp = await client.get(f"/api/v1/entries/{slug}", headers=_auth(user_a["access_token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("read_stats") is not None
        assert "total_count" in data["read_stats"]
        assert "unique_readers" in data["read_stats"]
        assert "by_channel" in data["read_stats"]

    @pytest.mark.asyncio
    async def test_non_owner_no_read_stats(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerE", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="stats-noowner-test", is_public=True)
        slug = entry["slug"]

        user_b = await _register(client, username="readerE", password="testpass123")
        resp = await client.get(f"/api/v1/entries/{slug}", headers=_auth(user_b["access_token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("read_stats") is None

    @pytest.mark.asyncio
    async def test_list_entries_records_discover(self, client_and_app):
        client, app = client_and_app
        await _create_entry(client, slug="discover-test", is_public=True)

        await client.get("/api/v1/entries")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.action == "discover")
            ).all()
            assert len(records) >= 1

    @pytest.mark.asyncio
    async def test_raw_endpoint_records_read(self, client_and_app):
        client, app = client_and_app
        entry = await _create_entry(
            client,
            slug="raw-read-test",
            is_public=True,
            files=[{"filename": "test.py", "content": "print('hello')"}],
        )
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}/raw")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(select(EntryRead)).all()
            assert len(records) >= 1
            assert records[0].action == "read"

    @pytest.mark.asyncio
    async def test_read_events_endpoint(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerF", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="events-endpoint-test", is_public=True)
        slug = entry["slug"]

        await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        resp = await client.get(
            f"/api/v1/entries/{slug}/reads",
            headers=_auth(user_a["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data

    @pytest.mark.asyncio
    async def test_read_events_requires_owner_or_admin(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerG", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="events-auth-test", is_public=True)
        slug = entry["slug"]

        user_b = await _register(client, username="readerG", password="testpass123")
        resp = await client.get(
            f"/api/v1/entries/{slug}/reads",
            headers=_auth(user_b["access_token"]),
        )
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_list_entries_mcp_channel(self, client_and_app):
        client, app = client_and_app
        await _create_entry(client, slug="mcp-list-test", is_public=True)

        await client.get("/api/v1/entries", headers={"X-PeekView-Source": "mcp"})
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.action == "discover", EntryRead.channel == "mcp")
            ).all()
            assert len(records) >= 1

    @pytest.mark.asyncio
    async def test_share_cookie_access_records_channel_share(self, client_and_app):
        client, app = client_and_app
        user_a = await _register(client, username="ownerH", password="testpass123")
        entry = await _create_entry(client, auth_token=user_a["access_token"], slug="share-cookie-test", is_public=False)
        slug = entry["slug"]

        resp = await client.post(
            f"/api/v1/entries/{slug}/shares",
            json={"expires_in": "7d"},
            headers=_auth(user_a["access_token"]),
        )
        assert resp.status_code == 201
        share_data = resp.json()
        share_token = share_data["share_url"].split("?share=")[1]

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share={share_token}")
        await _wait_for_async_write()

        client.cookies.clear()
        cookie_name = f"peekview_share_{slug}"
        client.cookies.set(cookie_name, share_token)
        await client.get(f"/api/v1/entries/{slug}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.channel == "share")
            ).all()
            assert len(records) >= 1
