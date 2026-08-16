"""Tests for TPV0093 star lifecycle: BDD-7/8/9/10 (cleanup exemption + countdown)
+ BDD-11/12/13 (author delete + tombstone) + N1/N2/N4.

Covers star exemption from auto-delete, countdown pause/resume via the absolute
deadline (archive_delete_at), tombstone lifecycle, and delete_user orphan sweep.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
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
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    return resp.json()["access_token"]


def _make_admin(app, session, username="adminuser"):
    user = session.exec(select(User).where(User.username == username)).first()
    if user and not user.is_admin:
        user.is_admin = True
        session.add(user)
        session.commit()


def _create_entry_direct(
    app,
    session,
    *,
    slug,
    summary="Test",
    is_public=True,
    status="active",
    expires_at=None,
    archived_at=None,
    owner_id=None,
):
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


def _insert_star(session, entry_id: int, user_id: int) -> None:
    from peekview.models import EntryStar

    star = EntryStar(
        entry_id=entry_id,
        user_id=user_id,
        tombstone_id=None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(star)
    session.commit()


def _entry_id(session, slug: str) -> int:
    entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
    return entry.id


def _set_archive_delete_at(session, slug: str, value: str) -> None:
    session.exec(
        text("UPDATE entries SET archive_delete_at = :v WHERE slug = :s").bindparams(
            v=value, s=slug
        )
    )
    session.commit()


def _tombstone_count(session) -> int:
    from peekview.models import EntryTombstone

    return len(session.exec(select(EntryTombstone)).all())


async def _run_cleanup(client, admin_token):
    resp = await client.post(
        "/api/v1/admin/cleanup",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    return resp.json()


async def _setup_admin(client, username="life-admin"):
    token = await _register_user(client, username)
    with Session(client._app.state.engine) as session:
        _make_admin(client._app, session, username)
    return token


# ============================================================
# BDD-7: 归档期星标 → 倒计时暂停，清理不删
# ============================================================


class TestStarExemptionArchived:
    @pytest.mark.asyncio
    async def test_bdd_7_starred_archived_entry_survives_cleanup(self, lifecycle_client):
        admin_token = await _setup_admin(lifecycle_client)
        await _register_user(lifecycle_client, "life-bdd7")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd7-starred",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=200),
            )
            _set_archive_delete_at(session, "bdd7-starred", "2020-01-01 00:00:00")
            user_a = session.exec(select(User).where(User.username == "life-bdd7")).first()
            _insert_star(session, _entry_id(session, "bdd7-starred"), user_a.id)

        result = await _run_cleanup(lifecycle_client, admin_token)
        assert "bdd7-starred" not in result["deleted_slugs"]

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "bdd7-starred")).first()
            assert entry is not None
            assert entry.status == "archived"


# ============================================================
# BDD-8: 有效期内星标 → 进入归档后倒计时同样暂停
# ============================================================


class TestStarExemptionActiveThenArchived:
    @pytest.mark.asyncio
    async def test_bdd_8_starred_before_expiry_exempt_after_archive(self, lifecycle_client):
        admin_token = await _setup_admin(lifecycle_client)
        await _register_user(lifecycle_client, "life-bdd8")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd8-starred-active",
                status="active",
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            user_a = session.exec(select(User).where(User.username == "life-bdd8")).first()
            _insert_star(session, _entry_id(session, "bdd8-starred-active"), user_a.id)

        # 第一次 cleanup：active → archived（写 archive_delete_at）
        result1 = await _run_cleanup(lifecycle_client, admin_token)
        assert "bdd8-starred-active" in result1["archived_slugs"]

        # 第二次 cleanup：星标豁免生效，不删
        result2 = await _run_cleanup(lifecycle_client, admin_token)
        assert "bdd8-starred-active" not in result2["deleted_slugs"]

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "bdd8-starred-active")).first()
            assert entry is not None


# ============================================================
# BDD-9: 取消星标恢复剩余倒计时（缓冲期内不删）
# ============================================================


class TestUnstarBufferPeriod:
    @pytest.mark.asyncio
    async def test_bdd_9_unstar_restores_remaining_countdown(self, lifecycle_client):
        admin_token = await _setup_admin(lifecycle_client)
        token_a = await _register_user(lifecycle_client, "life-bdd9")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd9-buffer",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=10),
            )
            _set_archive_delete_at(session, "bdd9-buffer", "2099-01-01 00:00:00")
            user_a = session.exec(select(User).where(User.username == "life-bdd9")).first()
            _insert_star(session, _entry_id(session, "bdd9-buffer"), user_a.id)

        unstar = await lifecycle_client.delete(
            "/api/v1/entries/bdd9-buffer/star",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert unstar.status_code == 200

        result = await _run_cleanup(lifecycle_client, admin_token)
        assert "bdd9-buffer" not in result["deleted_slugs"]

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "bdd9-buffer")).first()
            assert entry is not None


# ============================================================
# BDD-10: 最后一个星标取消且剩余≤0 → 下个清理周期物理删除
# ============================================================


class TestLastUnstarExpiredCountdown:
    @pytest.mark.asyncio
    async def test_bdd_10_last_unstar_with_past_deadline_deleted(self, lifecycle_client):
        admin_token = await _setup_admin(lifecycle_client)
        token_a = await _register_user(lifecycle_client, "life-bdd10")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd10-delete",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=200),
            )
            _set_archive_delete_at(session, "bdd10-delete", "2020-01-01 00:00:00")
            user_a = session.exec(select(User).where(User.username == "life-bdd10")).first()
            _insert_star(session, _entry_id(session, "bdd10-delete"), user_a.id)

        unstar = await lifecycle_client.delete(
            "/api/v1/entries/bdd10-delete/star",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert unstar.status_code == 200

        result = await _run_cleanup(lifecycle_client, admin_token)
        assert "bdd10-delete" in result["deleted_slugs"]

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "bdd10-delete")).first()
            assert entry is None


# ============================================================
# BDD-11/12: 作者删除强制覆盖星标豁免 + 生成 reason=author_deleted 墓碑
# ============================================================


class TestAuthorDeleteWithTombstone:
    @pytest.mark.asyncio
    async def test_bdd_11_12_author_delete_overrides_and_creates_tombstone(
        self, lifecycle_client
    ):
        token_owner = await _register_user(lifecycle_client, "life-owner")
        token_a = await _register_user(lifecycle_client, "life-star-a")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd11-author-delete",
                summary="Tombstone source",
                owner_id=owner.id,
            )
            user_a = session.exec(select(User).where(User.username == "life-star-a")).first()
            # 捕获 entry_id 于删除前（BDD-11 物理删除后无法再按 slug 查 entry）
            entry_id = _entry_id(session, "bdd11-author-delete")
            _insert_star(session, entry_id, user_a.id)

        resp = await lifecycle_client.delete(
            "/api/v1/entries/bdd11-author-delete",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp.status_code == 200

        # 正文立即不可访问（详情 404）
        detail = await lifecycle_client.get(
            "/api/v1/entries/bdd11-author-delete",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert detail.status_code == 404

        # 生成 reason=author_deleted 墓碑（快照 title/slug）
        from peekview.models import EntryStar, EntryTombstone

        with Session(engine) as session:
            tombstones = session.exec(select(EntryTombstone)).all()
            assert len(tombstones) == 1
            assert tombstones[0].reason == "author_deleted"
            assert tombstones[0].slug == "bdd11-author-delete"
            assert tombstones[0].title == "Tombstone source"
            # 星标行绑定墓碑（复用删除前捕获的 entry_id）
            stars = session.exec(
                select(EntryStar).where(EntryStar.entry_id == entry_id)
            ).all()
            assert len(stars) == 1
            assert stars[0].tombstone_id == tombstones[0].id


# ============================================================
# BDD-13: 墓碑保留至最后一个引用星标移除
# ============================================================


class TestTombstoneRemovedWithLastStar:
    @pytest.mark.asyncio
    async def test_bdd_13_tombstone_cleared_when_last_star_removed(self, lifecycle_client):
        token_owner = await _register_user(lifecycle_client, "life-owner-13")
        token_a = await _register_user(lifecycle_client, "life-star-a-13")
        token_b = await _register_user(lifecycle_client, "life-star-b-13")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner-13")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="bdd13-tombstone",
                summary="Tombstone pair",
                owner_id=owner.id,
            )
            entry_id = _entry_id(session, "bdd13-tombstone")
            user_a = session.exec(select(User).where(User.username == "life-star-a-13")).first()
            user_b = session.exec(select(User).where(User.username == "life-star-b-13")).first()
            _insert_star(session, entry_id, user_a.id)
            _insert_star(session, entry_id, user_b.id)

        del_resp = await lifecycle_client.delete(
            "/api/v1/entries/bdd13-tombstone",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert del_resp.status_code == 200

        with Session(engine) as session:
            assert _tombstone_count(session) == 1
            # entry_id 已在删除前捕获（第 349 行），删除后无法按 slug 查 entry

        # A 移除星标 → 墓碑仍在（B 仍引用）
        rm_a = await lifecycle_client.request(
            "DELETE",
            "/api/v1/stars",
            json={"entry_ids": [entry_id]},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert rm_a.status_code == 200
        with Session(engine) as session:
            assert _tombstone_count(session) == 1

        # B 移除星标 → 墓碑被清理
        rm_b = await lifecycle_client.request(
            "DELETE",
            "/api/v1/stars",
            json={"entry_ids": [entry_id]},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert rm_b.status_code == 200
        with Session(engine) as session:
            assert _tombstone_count(session) == 0


# ============================================================
# N1: delete_user 删除提交后孤儿墓碑清扫（CASCADE 顺序）
# ============================================================


class TestDeleteUserOrphanTombstoneSweep:
    @pytest.mark.asyncio
    async def test_n1_delete_user_sweeps_orphan_tombstones(self, lifecycle_client):
        admin_token = await _setup_admin(lifecycle_client, "life-admin-n1")
        token_owner = await _register_user(lifecycle_client, "life-owner-n1")
        await _register_user(lifecycle_client, "life-star-n1")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner-n1")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="n1-tombstone",
                summary="N1 orphan",
                owner_id=owner.id,
            )
            user_a = session.exec(select(User).where(User.username == "life-star-n1")).first()
            _insert_star(session, _entry_id(session, "n1-tombstone"), user_a.id)

        # 作者删除 → 墓碑 + A 星标绑定墓碑
        await lifecycle_client.delete(
            "/api/v1/entries/n1-tombstone",
            headers={"Authorization": f"Bearer {token_owner}"},
        )

        with Session(engine) as session:
            assert _tombstone_count(session) == 1
            user_a = session.exec(select(User).where(User.username == "life-star-n1")).first()
            user_a_id = user_a.id

        # 删除用户 A → 其星标 CASCADE → 孤儿墓碑被清扫
        resp = await lifecycle_client.delete(
            f"/api/v1/admin/users/{user_a_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 204

        with Session(engine) as session:
            assert _tombstone_count(session) == 0


# ============================================================
# N2: update_entry 双 reactivation 路径（expires_in / status 参数）均清 archive_delete_at
# ============================================================


class TestUpdateEntryClearsArchiveDeleteAt:
    @pytest.mark.asyncio
    async def test_n2_expires_in_reactivation_clears_archive_delete_at(self, lifecycle_client):
        token_owner = await _register_user(lifecycle_client, "life-owner-n2")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner-n2")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="n2-expires-in",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=owner.id,
            )
            _set_archive_delete_at(session, "n2-expires-in", "2099-01-01 00:00:00")

        resp = await lifecycle_client.patch(
            "/api/v1/entries/n2-expires-in",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp.status_code == 200

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "n2-expires-in")).first()
            assert entry.status == "active"
            assert entry.archive_delete_at is None

    @pytest.mark.asyncio
    async def test_n2_status_param_reactivation_clears_archive_delete_at(self, lifecycle_client):
        token_owner = await _register_user(lifecycle_client, "life-owner-n2b")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner-n2b")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="n2-status-param",
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=5),
                owner_id=owner.id,
            )
            _set_archive_delete_at(session, "n2-status-param", "2099-01-01 00:00:00")

        resp = await lifecycle_client.patch(
            "/api/v1/entries/n2-status-param",
            json={"status": "active"},
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp.status_code == 200

        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "n2-status-param")).first()
            assert entry.status == "active"
            assert entry.archive_delete_at is None


# ============================================================
# N4: 星标后转私有 active 条目从用户星标列表隐藏（豁免/计数仍在）
# ============================================================


class TestStarListHidesPrivatized:
    @pytest.mark.asyncio
    async def test_n4_privatized_active_entry_hidden_from_star_list(self, lifecycle_client):
        token_owner = await _register_user(lifecycle_client, "life-owner-n4")
        token_a = await _register_user(lifecycle_client, "life-star-n4")
        engine = lifecycle_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "life-owner-n4")).first()
            _create_entry_direct(
                lifecycle_client._app,
                session,
                slug="n4-privatized",
                summary="N4 privatized",
                owner_id=owner.id,
                is_public=True,
            )
            user_a = session.exec(select(User).where(User.username == "life-star-n4")).first()
            _insert_star(session, _entry_id(session, "n4-privatized"), user_a.id)

        # 转私有（active，非 archived）
        patch = await lifecycle_client.patch(
            "/api/v1/entries/n4-privatized",
            json={"is_public": False},
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert patch.status_code == 200

        stars = await lifecycle_client.get(
            "/api/v1/stars",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert stars.status_code == 200
        items = stars.json()["items"]
        slugs = [i.get("slug") for i in items if i.get("type") != "tombstone"]
        assert "n4-privatized" not in slugs
