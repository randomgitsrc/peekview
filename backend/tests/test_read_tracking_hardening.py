"""T078 read-tracking-hardening tests — BDD-01 ~ BDD-34.

TDD red-light: tests reference EntryReadStats model, source parameter,
by_action/by_source fields, _detect_channel/_classify_source in _shared,
reads dimension in AdminStatsResponse — none of which exist yet.
All tests should fail (red) before P4 implementation.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine, select

from peekview.models import (  # noqa: F401 — registers all models with SQLModel.metadata
    Entry,
    EntryRead,
)

# ============================================================
# Fixtures
# ============================================================


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


async def _wait_for_async_write(delay=0.15):
    import asyncio

    await asyncio.sleep(delay)


async def _register(client, username="testuser", password="testpass123"):
    resp = await client.post(
        "/api/v1/auth/register", json={"username": username, "password": password}
    )
    assert resp.status_code == 201
    return resp.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_entry(
    client, auth_token=None, slug=None, summary="Test entry", is_public=True, files=None
):
    data = {"summary": summary, "is_public": is_public}
    if slug:
        data["slug"] = slug
    if files:
        data["files"] = files
    headers = _auth(auth_token) if auth_token else {}
    resp = await client.post("/api/v1/entries", json=data, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _create_share(client, owner_token, slug):
    resp = await client.post(
        f"/api/v1/entries/{slug}/shares",
        json={"expires_in": "7d"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 201
    share_data = resp.json()
    share_token = share_data["share_url"].split("?share=")[1]
    return share_token


# ============================================================
# BDD-01 ~ BDD-02: window_key 含 action
# ============================================================


class TestBDD01WindowKeyAction:
    """BDD-01: window_key 含 action，同一分钟内 read + download 不合并
    BDD-02: window_key 含 action，同一分钟内相同 action 仍合并
    """

    def test_bdd_01_different_actions_same_minute_not_merged(
        self, read_tracking_service, tracking_session
    ):

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="download",
            channel="api",
            reader_id=5,
            reader_ip=None,
        )

        records = tracking_session.exec(select(EntryRead)).all()
        assert len(records) == 2
        actions = {r.action for r in records}
        assert actions == {"read", "download"}
        for r in records:
            assert r.count == 1

    def test_bdd_02_same_action_same_minute_merged(
        self, read_tracking_service, tracking_session
    ):

        for _ in range(3):
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
        assert records[0].action == "read"
        assert records[0].count == 3
        assert ":read:" in records[0].window_key


# ============================================================
# BDD-03 ~ BDD-06: share channel
# ============================================================


class TestBDD03ShareChannel:
    """BDD-03: 公开 entry 带 share token 访问时 channel 记为 "share"
    BDD-04: share cookie 访问 download_file 时 channel 记为 "share"
    BDD-05: share cookie 访问 get_file_content 时 channel 记为 "share"
    BDD-06: share cookie 访问 get_entry_raw 时 channel 记为 "share"
    """

    @pytest.mark.asyncio
    async def test_bdd_03_public_entry_with_share_token_channel_share(self, client_and_app):

        client, app = client_and_app
        owner = await _register(client, username="bdd03owner", password="testpass123")
        entry = await _create_entry(
            client,
            auth_token=owner["access_token"],
            slug="bdd03-public-share",
            is_public=True,
        )
        slug = entry["slug"]
        entry_id = entry["id"]

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share=fake-token-12345")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(
                    EntryRead.action == "read", EntryRead.entry_id == entry_id
                )
            ).all()
            assert len(records) >= 1
            assert all(r.channel == "share" for r in records)

    @pytest.mark.asyncio
    async def test_bdd_04_share_cookie_download_channel_share(self, client_and_app):

        client, app = client_and_app
        owner = await _register(client, username="bdd04owner", password="testpass123")
        entry = await _create_entry(
            client,
            auth_token=owner["access_token"],
            slug="bdd04-share-download",
            is_public=False,
            files=[{"filename": "test.py", "content": "print('hello')"}],
        )
        slug = entry["slug"]
        file_id = entry["files"][0]["id"]

        share_token = await _create_share(client, owner["access_token"], slug)

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share={share_token}")
        await _wait_for_async_write(0.05)

        await client.get(f"/api/v1/entries/{slug}/files/{file_id}")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.action == "download")
            ).all()
            assert len(records) >= 1
            assert all(r.channel == "share" for r in records)

    @pytest.mark.asyncio
    async def test_bdd_05_share_cookie_file_content_channel_share(self, client_and_app):

        client, app = client_and_app
        owner = await _register(client, username="bdd05owner", password="testpass123")
        entry = await _create_entry(
            client,
            auth_token=owner["access_token"],
            slug="bdd05-share-content",
            is_public=False,
            files=[{"filename": "test.py", "content": "print('hello')"}],
        )
        slug = entry["slug"]
        file_id = entry["files"][0]["id"]
        entry_id = entry["id"]

        share_token = await _create_share(client, owner["access_token"], slug)

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share={share_token}")
        await _wait_for_async_write(0.05)

        with Session(app.state.engine) as session:
            session.exec(select(EntryRead).where(EntryRead.entry_id == entry_id))
            for r in session.exec(select(EntryRead).where(EntryRead.entry_id == entry_id)).all():
                session.delete(r)
            session.commit()

        await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(
                    EntryRead.entry_id == entry_id,
                )
            ).all()
            assert len(records) >= 1
            assert all(r.channel == "share" for r in records)

    @pytest.mark.asyncio
    async def test_bdd_06_share_cookie_raw_channel_share(self, client_and_app):

        client, app = client_and_app
        owner = await _register(client, username="bdd06owner", password="testpass123")
        entry = await _create_entry(
            client,
            auth_token=owner["access_token"],
            slug="bdd06-share-raw",
            is_public=False,
            files=[{"filename": "test.py", "content": "print('hello')"}],
        )
        slug = entry["slug"]

        share_token = await _create_share(client, owner["access_token"], slug)

        client.cookies.clear()
        await client.get(f"/api/v1/entries/{slug}?share={share_token}")
        await _wait_for_async_write(0.05)

        await client.get(f"/api/v1/entries/{slug}/raw")
        await _wait_for_async_write()

        with Session(app.state.engine) as session:
            records = session.exec(
                select(EntryRead).where(EntryRead.action == "raw")
            ).all()
            assert len(records) >= 1
            assert all(r.channel == "share" for r in records)


# ============================================================
# BDD-07, BDD-31: discover 数据
# ============================================================


class TestBDD07DiscoverData:
    """BDD-07: admin stats 包含 discover action 的读取计数
    BDD-31: discover 事件不创建 entry_read_stats 聚合行
    """

    @pytest.mark.asyncio
    async def test_bdd_07_admin_stats_includes_discover(self, client_and_app):
        client, app = client_and_app

        await _create_entry(client, slug="bdd07-discover-test", is_public=True)
        await client.get("/api/v1/entries")
        await _wait_for_async_write()

        admin = await _register(client, username="bdd07admin", password="testpass123")
        from sqlmodel import Session as SSession

        from peekview.models import User

        with SSession(app.state.engine) as session:
            admin_user = session.exec(select(User).where(User.username == "bdd07admin")).first()
            if admin_user:
                admin_user.is_admin = True
                session.add(admin_user)
                session.commit()

        resp = await client.get("/api/v1/admin/stats", headers=_auth(admin["access_token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert "reads" in data
        assert "by_action" in data["reads"]
        assert "discover" in data["reads"]["by_action"]
        assert data["reads"]["by_action"]["discover"] > 0

    def test_bdd_31_discover_no_aggregation_row(self, read_tracking_service, tracking_session):
        from peekview.models import EntryReadStats

        read_tracking_service.record_read(
            entry_id=None,
            entry_owner_id=None,
            action="discover",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )

        stats = tracking_session.exec(select(EntryReadStats)).all()
        assert len(stats) == 0


# ============================================================
# BDD-08 ~ BDD-09: by_action / by_source 维度
# ============================================================


class TestBDD08ByActionBySource:
    """BDD-08: read_stats 返回 by_action 维度
    BDD-09: read_stats 返回 by_source 维度
    """

    def test_bdd_08_read_stats_returns_by_action(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="raw",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="download",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )

        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert hasattr(stats, "by_action")
        assert "read" in stats.by_action
        assert "raw" in stats.by_action
        assert "download" in stats.by_action

    def test_bdd_09_read_stats_returns_by_source(self, read_tracking_service, tracking_session):
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )

        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert hasattr(stats, "by_source")
        assert len(stats.by_source) > 0
        assert "direct" in stats.by_source


# ============================================================
# BDD-10 ~ BDD-11, BDD-32 ~ BDD-34: source 分类
# ============================================================


class TestBDD10SourceClassification:
    """BDD-10: 无 Referer 时 source 归为 "direct"
    BDD-11: 同域名 Referer 时 source 归为 "internal"
    BDD-32: 搜索引擎 Referer 时 source 归为 "search"
    BDD-33: 社交平台 Referer 时 source 归为 "social"
    BDD-34: 其他 Referer 时 source 归为 "other"
    """

    def test_bdd_10_no_referer_source_direct(self, read_tracking_service, tracking_session):

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )

        record = tracking_session.exec(select(EntryRead)).first()
        assert record is not None
        assert hasattr(record, "source")
        assert record.source == "direct"

    def test_bdd_11_internal_referer_source_internal(
        self, read_tracking_service, tracking_session
    ):
        from peekview.api._shared import _classify_source

        source = _classify_source("http://127.0.0.1:8888/entries", "127.0.0.1:8888")
        assert source == "internal"

    def test_bdd_32_search_engine_referer_source_search(self):
        from peekview.api._shared import _classify_source

        source = _classify_source("https://www.google.com/search?q=test", "127.0.0.1:8888")
        assert source == "search"

    def test_bdd_33_social_platform_referer_source_social(self):
        from peekview.api._shared import _classify_source

        source = _classify_source("https://twitter.com/user/status/123", "127.0.0.1:8888")
        assert source == "social"

    def test_bdd_34_other_referer_source_other(self):
        from peekview.api._shared import _classify_source

        source = _classify_source("https://example.com/some-page", "127.0.0.1:8888")
        assert source == "other"


# ============================================================
# BDD-12 ~ BDD-16: 聚合表写时更新
# ============================================================


class TestBDD12AggregationTable:
    """BDD-12: record_read 时同步更新 entry_read_stats 聚合表
    BDD-13: unique_readers 重复读取者不重复计数
    BDD-14: unique_readers 新读取者计数增加
    BDD-15: unique_readers 排除 self_read
    BDD-16: get_read_stats 从聚合表读取，不查原始表
    """

    def test_bdd_12_record_read_updates_aggregation_table(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )

        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.total_reads == 1

        by_action = json.loads(stats.by_action or "{}")
        assert by_action.get("read") == 1

        by_channel = json.loads(stats.by_channel or "{}")
        assert by_channel.get("api") == 1

    def test_bdd_13_unique_readers_repeat_not_counted(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        for _ in range(2):
            read_tracking_service.record_read(
                entry_id=1,
                entry_owner_id=10,
                action="read",
                channel="api",
                reader_id=5,
                reader_ip=None,
                source="direct",
            )

        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.unique_readers == 1
        assert "u:5" in (stats.reader_fingerprints or "")

    def test_bdd_14_unique_readers_new_reader_counted(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=5,
            reader_ip=None,
            source="direct",
        )
        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=6,
            reader_ip=None,
            source="direct",
        )

        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.unique_readers == 2
        assert "u:5" in (stats.reader_fingerprints or "")
        assert "u:6" in (stats.reader_fingerprints or "")

    def test_bdd_15_unique_readers_excludes_self_read(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=10,
            reader_ip=None,
            source="direct",
        )

        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.unique_readers == 0
        assert "u:10" not in (stats.reader_fingerprints or "")

    def test_bdd_16_get_read_stats_reads_from_aggregation_table(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        stats_row = EntryReadStats(
            entry_id=42,
            total_reads=10,
            unique_readers=3,
            by_action=json.dumps({"read": 7, "download": 3}),
            by_channel=json.dumps({"api": 8, "mcp": 2}),
            by_source=json.dumps({"direct": 6, "internal": 4}),
            reader_fingerprints="u:1,u:2,u:3",
            last_read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(stats_row)
        tracking_session.commit()

        result = read_tracking_service.get_read_stats(entry_id=42)
        assert result.total_count == 10
        assert result.unique_readers == 3
        assert result.by_action == {"read": 7, "download": 3}
        assert result.by_channel == {"api": 8, "mcp": 2}
        assert result.by_source == {"direct": 6, "internal": 4}


# ============================================================
# BDD-17 ~ BDD-19: 回填 + source 列迁移
# ============================================================


class TestBDD17BackfillAndMigration:
    """BDD-17: 启动时 entry_read_stats 为空且 entry_reads 有数据则回填
    BDD-18: 启动时 entry_read_stats 已有数据则不回填
    BDD-19: entry_reads 表新增 source 列
    """

    def test_bdd_17_backfill_on_startup_when_stats_empty(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            reader_type="authenticated",
            reader_id=5,
            is_self_read=False,
            count=3,
            window_key="bdd17-test:u:5:api:read:2026-08-01T10:00",
            reader_fingerprint="u:5",
            read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(record)
        tracking_session.commit()

        read_tracking_service.backfill_stats()

        tracking_session.expire_all()
        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.total_reads == 3

        by_action = json.loads(stats.by_action or "{}")
        assert by_action.get("read") == 3

        by_source = json.loads(stats.by_source or "{}")
        assert by_source.get("unknown") == 3

    def test_bdd_18_no_backfill_when_stats_already_exist(
        self, read_tracking_service, tracking_session
    ):
        from peekview.models import EntryReadStats

        existing_stats = EntryReadStats(
            entry_id=1,
            total_reads=5,
            unique_readers=1,
            by_action=json.dumps({"read": 5}),
            by_channel=json.dumps({"api": 5}),
            by_source=json.dumps({"direct": 5}),
            reader_fingerprints="u:5",
            last_read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(existing_stats)
        tracking_session.commit()

        read_tracking_service.backfill_stats()

        tracking_session.expire_all()
        stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert stats is not None
        assert stats.total_reads == 5

        by_action = json.loads(stats.by_action or "{}")
        assert by_action.get("read") == 5

    def test_bdd_19_entry_reads_has_source_column(self, tracking_session):
        from sqlalchemy import text

        result = tracking_session.exec(text("PRAGMA table_info(entry_reads)")).all()
        column_names = [row[1] for row in result]
        assert "source" in column_names


# ============================================================
# BDD-20 ~ BDD-23: 90 天清理
# ============================================================


class TestBDD20CleanupExpired:
    """BDD-20: 超过 90 天的 entry_reads 记录被清理
    BDD-21: 清理 entry_reads 后 entry_read_stats 不受影响
    BDD-22: 清理后 get_read_events 只返回剩余记录
    BDD-23: PEEKVIEW_CLEANUP__READS_RETENTION_DAYS 可配置
    """

    def _create_admin_service(self, engine, retention_days=90):
        from peekview.config import PeekConfig
        from peekview.services.admin_service import AdminService
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        config.cleanup.reads_retention_days = retention_days
        storage = StorageManager(config=config)
        entry_service = EntryService(engine, storage, config)
        return AdminService(engine, storage, config, entry_service)

    def test_bdd_20_old_reads_cleaned_up(self, tracking_engine, tracking_session):

        old_date = datetime.now(timezone.utc) - timedelta(days=91)
        record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            count=1,
            window_key="bdd20-old:test:api:read:2026-05-01T10:00",
            reader_fingerprint="a:test",
            read_at=old_date,
            updated_at=old_date,
        )
        tracking_session.add(record)
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine)
        admin_service.cleanup_expired()

        tracking_session.expire_all()
        remaining = tracking_session.exec(
            select(EntryRead).where(EntryRead.window_key == "bdd20-old:test:api:read:2026-05-01T10:00")
        ).first()
        assert remaining is None

    def test_bdd_21_stats_unaffected_after_cleanup(self, tracking_engine, tracking_session):
        from peekview.models import EntryReadStats

        old_date = datetime.now(timezone.utc) - timedelta(days=91)
        record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            count=5,
            window_key="bdd21-old:test:api:read:2026-05-01T10:00",
            reader_fingerprint="a:test",
            read_at=old_date,
            updated_at=old_date,
        )
        tracking_session.add(record)

        stats = EntryReadStats(
            entry_id=1,
            total_reads=5,
            unique_readers=1,
            by_action=json.dumps({"read": 5}),
            by_channel=json.dumps({"api": 5}),
            by_source=json.dumps({"direct": 5}),
            reader_fingerprints="a:test",
            last_read_at=old_date,
            updated_at=old_date,
        )
        tracking_session.add(stats)
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine)
        admin_service.cleanup_expired()

        tracking_session.expire_all()
        remaining_stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == 1)
        ).first()
        assert remaining_stats is not None
        assert remaining_stats.total_reads == 5

        by_action = json.loads(remaining_stats.by_action or "{}")
        assert by_action.get("read") == 5

    def test_bdd_22_get_read_events_after_cleanup(self, tracking_engine, tracking_session):
        from peekview.services.read_tracking_service import ReadTrackingService

        old_date = datetime.now(timezone.utc) - timedelta(days=91)
        recent_date = datetime.now(timezone.utc) - timedelta(days=10)

        old_record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            count=1,
            window_key="bdd22-old:test:api:read:2026-05-01T10:00",
            reader_fingerprint="a:old",
            read_at=old_date,
            updated_at=old_date,
        )
        recent_record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            count=1,
            window_key="bdd22-recent:test:api:read:2026-07-25T10:00",
            reader_fingerprint="a:recent",
            read_at=recent_date,
            updated_at=recent_date,
        )
        tracking_session.add_all([old_record, recent_record])
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine)
        admin_service.cleanup_expired()

        service = ReadTrackingService(tracking_engine)
        result = service.get_read_events(entry_id=1)
        assert result.total == 1
        assert len(result.items) == 1

    def test_bdd_23_configurable_retention_days(self, tracking_engine, tracking_session):

        old_date = datetime.now(timezone.utc) - timedelta(days=31)
        record = EntryRead(
            entry_id=1,
            action="read",
            channel="api",
            count=1,
            window_key="bdd23-old:test:api:read:2026-07-01T10:00",
            reader_fingerprint="a:test",
            read_at=old_date,
            updated_at=old_date,
        )
        tracking_session.add(record)
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine, retention_days=30)
        admin_service.cleanup_expired()

        tracking_session.expire_all()
        remaining = tracking_session.exec(
            select(EntryRead).where(
                EntryRead.window_key == "bdd23-old:test:api:read:2026-07-01T10:00"
            )
        ).first()
        assert remaining is None


# ============================================================
# BDD-24 ~ BDD-25: 删除策略
# ============================================================


class TestBDD24DeleteStrategy:
    """BDD-24: 删 entry 时删除 entry_reads 原始记录
    BDD-25: 删 entry 时保留 entry_read_stats 聚合行
    """

    def test_bdd_24_delete_entry_removes_raw_reads(self, tracking_engine, tracking_session):
        from peekview.config import PeekConfig
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        storage = StorageManager(config=config)

        entry = Entry(slug="bdd24-test", summary="Test")
        tracking_session.add(entry)
        tracking_session.commit()
        tracking_session.refresh(entry)
        entry_id = entry.id

        record = EntryRead(
            entry_id=entry_id,
            action="read",
            channel="api",
            count=1,
            window_key="bdd24:test:api:read:2026-08-01T10:00",
            reader_fingerprint="u:5",
            read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(record)
        tracking_session.commit()

        service = EntryService(tracking_engine, storage, config)
        service.delete_entry("bdd24-test", allow_local=True)

        tracking_session.expire_all()
        reads = tracking_session.exec(
            select(EntryRead).where(EntryRead.entry_id == entry_id)
        ).all()
        assert len(reads) == 0

    def test_bdd_25_delete_entry_preserves_aggregation(self, tracking_engine, tracking_session):
        from peekview.config import PeekConfig
        from peekview.models import EntryReadStats
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        storage = StorageManager(config=config)

        entry = Entry(slug="bdd25-test", summary="Test")
        tracking_session.add(entry)
        tracking_session.commit()
        tracking_session.refresh(entry)
        entry_id = entry.id

        record = EntryRead(
            entry_id=entry_id,
            action="read",
            channel="api",
            count=1,
            window_key="bdd25:test:api:read:2026-08-01T10:00",
            reader_fingerprint="u:5",
            read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(record)

        stats = EntryReadStats(
            entry_id=entry_id,
            total_reads=1,
            unique_readers=1,
            by_action=json.dumps({"read": 1}),
            by_channel=json.dumps({"api": 1}),
            by_source=json.dumps({"direct": 1}),
            reader_fingerprints="u:5",
            last_read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(stats)
        tracking_session.commit()

        service = EntryService(tracking_engine, storage, config)
        service.delete_entry("bdd25-test", allow_local=True)

        tracking_session.expire_all()
        remaining_stats = tracking_session.exec(
            select(EntryReadStats).where(EntryReadStats.entry_id == entry_id)
        ).first()
        assert remaining_stats is not None
        assert remaining_stats.total_reads == 1


# ============================================================
# BDD-26 ~ BDD-27: Admin stats 读取维度
# ============================================================


class TestBDD26AdminStatsReads:
    """BDD-26: admin stats 包含 reads 维度
    BDD-27: admin stats reads.total 包含已删 entry 的历史流量
    """

    def _create_admin_service(self, engine):
        from peekview.config import PeekConfig
        from peekview.services.admin_service import AdminService
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        storage = StorageManager(config=config)
        entry_service = EntryService(engine, storage, config)
        return AdminService(engine, storage, config, entry_service)

    def test_bdd_26_admin_stats_has_reads_dimension(self, tracking_engine, tracking_session):
        from peekview.models import EntryReadStats

        stats = EntryReadStats(
            entry_id=1,
            total_reads=10,
            unique_readers=2,
            by_action=json.dumps({"read": 10}),
            by_channel=json.dumps({"api": 10}),
            by_source=json.dumps({"direct": 10}),
            reader_fingerprints="u:1,u:2",
            last_read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(stats)
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine)
        result = admin_service.get_stats()

        assert hasattr(result, "reads")
        assert result.reads is not None
        assert hasattr(result.reads, "total")
        assert hasattr(result.reads, "today")
        assert hasattr(result.reads, "by_action")
        assert hasattr(result.reads, "by_channel")
        assert hasattr(result.reads, "by_source")
        assert result.reads.total >= 10

    def test_bdd_27_admin_stats_total_includes_deleted_entry(
        self, tracking_engine, tracking_session
    ):
        from peekview.models import EntryReadStats

        stats = EntryReadStats(
            entry_id=999,
            total_reads=5,
            unique_readers=1,
            by_action=json.dumps({"read": 5}),
            by_channel=json.dumps({"api": 5}),
            by_source=json.dumps({"direct": 5}),
            reader_fingerprints="u:1",
            last_read_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        tracking_session.add(stats)
        tracking_session.commit()

        admin_service = self._create_admin_service(tracking_engine)
        result = admin_service.get_stats()

        assert result.reads is not None
        assert result.reads.total >= 5


# ============================================================
# BDD-28 ~ BDD-29: Backup/Restore
# ============================================================


class TestBDD28RestoreAggregation:
    """BDD-28: restore merge 后 entry_read_stats 有数据
    BDD-29: restore replace 后 entry_read_stats 有数据
    """

    def test_bdd_28_restore_merge_imports_read_stats(self, tracking_engine, tracking_session):
        from peekview.config import PeekConfig
        from peekview.models import EntryReadStats
        from peekview.services.admin_service import AdminService
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        storage = StorageManager(config=config)
        entry_service = EntryService(tracking_engine, storage, config)
        admin_service = AdminService(tracking_engine, storage, config, entry_service)

        backup_dir = Path(tempfile.mkdtemp())
        backup_db_path = backup_dir / "peekview.db"

        backup_engine = create_engine(f"sqlite:///{backup_db_path}")
        SQLModel.metadata.create_all(backup_engine)

        with Session(backup_engine) as bk_session:
            entry = Entry(slug="backup-entry", summary="Backup test")
            bk_session.add(entry)
            bk_session.commit()
            bk_session.refresh(entry)

            stats = EntryReadStats(
                entry_id=entry.id,
                total_reads=7,
                unique_readers=2,
                by_action=json.dumps({"read": 7}),
                by_channel=json.dumps({"api": 7}),
                by_source=json.dumps({"direct": 7}),
                reader_fingerprints="u:1,u:2",
                last_read_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            bk_session.add(stats)
            bk_session.commit()

        backup_engine.dispose()

        staging_dir = Path(tempfile.mkdtemp())
        shutil.copy(backup_db_path, staging_dir / "peekview.db")
        staging_data = staging_dir / "data" / "default"
        staging_data.mkdir(parents=True, exist_ok=True)

        import sqlite3
        backup_conn = sqlite3.connect(str(staging_dir / "peekview.db"))
        backup_conn.row_factory = sqlite3.Row

        admin_service._restore_merge(
            staging_path=staging_dir,
            backup_conn=backup_conn,
            version_check="compatible",
            conflicts=[],
        )

        backup_conn.close()

        tracking_session.expire_all()
        stats_rows = tracking_session.exec(select(EntryReadStats)).all()
        assert len(stats_rows) >= 1
        assert any(s.total_reads == 7 for s in stats_rows)

    def test_bdd_29_restore_replace_imports_read_stats(self, tracking_engine, tracking_session):
        from peekview.config import PeekConfig
        from peekview.models import EntryReadStats
        from peekview.services.admin_service import AdminService
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager

        config = PeekConfig()
        storage = StorageManager(config=config)
        entry_service = EntryService(tracking_engine, storage, config)
        admin_service = AdminService(tracking_engine, storage, config, entry_service)

        backup_dir = Path(tempfile.mkdtemp())
        backup_db_path = backup_dir / "peekview.db"

        backup_engine = create_engine(f"sqlite:///{backup_db_path}")
        SQLModel.metadata.create_all(backup_engine)

        with Session(backup_engine) as bk_session:
            entry = Entry(slug="backup-entry-replace", summary="Backup replace test")
            bk_session.add(entry)
            bk_session.commit()
            bk_session.refresh(entry)

            stats = EntryReadStats(
                entry_id=entry.id,
                total_reads=3,
                unique_readers=1,
                by_action=json.dumps({"read": 3}),
                by_channel=json.dumps({"api": 3}),
                by_source=json.dumps({"direct": 3}),
                reader_fingerprints="u:1",
                last_read_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            bk_session.add(stats)
            bk_session.commit()

        backup_engine.dispose()

        staging_dir = Path(tempfile.mkdtemp())
        shutil.copy(backup_db_path, staging_dir / "peekview.db")
        staging_data = staging_dir / "data" / "default"
        staging_data.mkdir(parents=True, exist_ok=True)

        import sqlite3
        backup_conn = sqlite3.connect(str(staging_dir / "peekview.db"))
        backup_conn.row_factory = sqlite3.Row

        admin_service._restore_replace(
            staging_path=staging_dir,
            backup_conn=backup_conn,
            version_check="compatible",
        )

        import sqlite3 as s3
        check_conn = s3.connect(str(config.db_path))
        check_conn.row_factory = s3.Row
        rows = check_conn.execute("SELECT * FROM entry_read_stats").fetchall()
        check_conn.close()

        assert len(rows) >= 1
        assert any(row["total_reads"] == 3 for row in rows)


# ============================================================
# BDD-30: total_count 语义
# ============================================================


class TestBDD30TotalCountSemantics:
    """BDD-30: total_count 语义为包含 self_read"""

    def test_bdd_30_total_count_includes_self_read(
        self, read_tracking_service, tracking_session
    ):

        for reader_id in [5, 6, 7]:
            read_tracking_service.record_read(
                entry_id=1,
                entry_owner_id=10,
                action="read",
                channel="api",
                reader_id=reader_id,
                reader_ip=None,
                source="direct",
            )

        read_tracking_service.record_read(
            entry_id=1,
            entry_owner_id=10,
            action="read",
            channel="api",
            reader_id=10,
            reader_ip=None,
            source="direct",
        )

        stats = read_tracking_service.get_read_stats(entry_id=1)
        assert stats.total_count == 4
