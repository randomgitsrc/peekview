"""Regression tests for P4 r2 review fixes (TPV0093).

Covers BLOCKER-1 (countdown naive/aware TypeError → archived read 500),
INFO-1 (starred countdown status priority), CRITICAL-2 (orphan star sweep +
service-level star entry validation), F2 (DELETE /star slug oracle),
F3 (batch body size limit).
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, EntryStar, User


@pytest.fixture
async def fix_client(tmp_path, monkeypatch):
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
    owner_id=None,
):
    entry = Entry(
        slug=slug,
        summary=summary,
        is_public=is_public,
        status=status,
        archived_at=(
            datetime.now(timezone.utc) - timedelta(days=10) if status == "archived" else None
        ),
        owner_id=owner_id,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def _insert_star(session, entry_id: int, user_id: int) -> None:
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


# ============================================================
# BLOCKER-1: archived + archive_delete_at 已设 → 详情/星标列表 200 + countdown
# INFO-1: 已星标 → status=paused（优先于 expired）
# ============================================================


class TestCountdownReads:
    @pytest.mark.asyncio
    async def test_blocker1_archived_with_deadline_detail_and_stars_200(self, fix_client):
        token_owner = await _register_user(fix_client, "fix-owner-b1")
        token_star = await _register_user(fix_client, "fix-star-b1")
        engine = fix_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "fix-owner-b1")).first()
            star_user = session.exec(select(User).where(User.username == "fix-star-b1")).first()
            _create_entry_direct(
                fix_client._app,
                session,
                slug="blocker1-deadline",
                summary="countdown target",
                status="archived",
                owner_id=owner.id,
            )
            _set_archive_delete_at(session, "blocker1-deadline", "2099-01-01 00:00:00")
            _insert_star(session, _entry_id(session, "blocker1-deadline"), star_user.id)

        owner_resp = await fix_client.get(
            "/api/v1/entries/blocker1-deadline",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert owner_resp.status_code == 200
        cd = owner_resp.json()["countdown"]
        assert cd is not None
        assert cd["status"] == "running"  # owner 未星标 + deadline 未到 → running
        assert cd["remaining_days"] > 0

        star_resp = await fix_client.get(
            "/api/v1/entries/blocker1-deadline",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert star_resp.status_code == 200
        assert star_resp.json()["countdown"]["status"] == "paused"

        stars = await fix_client.get(
            "/api/v1/stars",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert stars.status_code == 200
        body = stars.json()
        assert body["total"] == 1
        assert body["items"][0]["type"] == "entry"
        assert body["items"][0]["countdown"]["status"] == "paused"

    @pytest.mark.asyncio
    async def test_info1_unstarred_past_deadline_shows_expired(self, fix_client):
        token_owner = await _register_user(fix_client, "fix-owner-b1b")
        engine = fix_client._app.state.engine
        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "fix-owner-b1b")).first()
            _create_entry_direct(
                fix_client._app,
                session,
                slug="info1-expired",
                status="archived",
                owner_id=owner.id,
            )
            _set_archive_delete_at(session, "info1-expired", "2020-01-01 00:00:00")

        resp = await fix_client.get(
            "/api/v1/entries/info1-expired",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp.status_code == 200
        cd = resp.json()["countdown"]
        assert cd["status"] == "expired"
        assert cd["remaining_days"] == 0


# ============================================================
# CRITICAL-2: 孤儿星标清扫（cleanup 兜底）+ 服务层 star 校验
# ============================================================


class TestOrphanStarSweep:
    @pytest.mark.asyncio
    async def test_critical2_cleanup_sweeps_orphan_stars(self, fix_client):
        admin_token = await _register_user(fix_client, "fix-admin-c2")
        with Session(fix_client._app.state.engine) as session:
            _make_admin(fix_client._app, session, "fix-admin-c2")

        engine = fix_client._app.state.engine
        with Session(engine) as session:
            admin = session.exec(select(User).where(User.username == "fix-admin-c2")).first()
            # 孤儿活星标：entry_id=99999 不存在（删除↔星标并发竞态的残留）
            _insert_star(session, 99999, admin.id)
            # 正常活星标：指向存在的 entry，不应被清扫
            _create_entry_direct(
                fix_client._app,
                session,
                slug="c2-normal",
                summary="normal star target",
            )
            _insert_star(session, _entry_id(session, "c2-normal"), admin.id)

        resp = await fix_client.post(
            "/api/v1/admin/cleanup",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200

        with Session(engine) as session:
            orphan = session.exec(select(EntryStar).where(EntryStar.entry_id == 99999)).all()
            assert len(orphan) == 0
            normal = session.exec(select(EntryStar).where(EntryStar.entry_id != 99999)).all()
            assert len(normal) == 1

    @pytest.mark.asyncio
    async def test_critical2_star_service_rejects_missing_entry(self, fix_client):
        from peekview.exceptions import NotFoundError

        star_service = fix_client._app.state.star_service
        with pytest.raises(NotFoundError):
            star_service.star(99999, 1)


# ============================================================
# F2: DELETE /{slug}/star 不再构成 slug 存在性 oracle
# ============================================================


class TestDeleteStarOracle:
    @pytest.mark.asyncio
    async def test_f2_non_star_user_delete_star_private_and_archived_404(self, fix_client):
        await _register_user(fix_client, "fix-owner-f2")
        token_other = await _register_user(fix_client, "fix-other-f2")
        engine = fix_client._app.state.engine

        with Session(engine) as session:
            owner = session.exec(select(User).where(User.username == "fix-owner-f2")).first()
            _create_entry_direct(
                fix_client._app,
                session,
                slug="f2-private",
                is_public=False,
                owner_id=owner.id,
            )
            _create_entry_direct(
                fix_client._app,
                session,
                slug="f2-archived",
                summary="archived target",
                status="archived",
                owner_id=owner.id,
            )
            _set_archive_delete_at(session, "f2-archived", "2099-01-01 00:00:00")

        # 非星标用户对私有 active slug → 404（不再 200 泄露存在性）
        resp_private = await fix_client.delete(
            "/api/v1/entries/f2-private/star",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert resp_private.status_code == 404

        # 非星标用户对 archived slug → 404
        resp_archived = await fix_client.delete(
            "/api/v1/entries/f2-archived/star",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert resp_archived.status_code == 404

        # 未知 slug → 404
        resp_unknown = await fix_client.delete(
            "/api/v1/entries/does-not-exist-f2/star",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert resp_unknown.status_code == 404

        # 星标用户对 archived slug → 200（回归：N9 星标可取消，无读权限门槛）
        with Session(engine) as session:
            other = session.exec(select(User).where(User.username == "fix-other-f2")).first()
            _insert_star(session, _entry_id(session, "f2-archived"), other.id)
        resp_star = await fix_client.delete(
            "/api/v1/entries/f2-archived/star",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert resp_star.status_code == 200
        assert resp_star.json()["is_starred"] is False


# ============================================================
# F3: DELETE /api/v1/stars 批量 body 上限（min 1 / max 500）
# ============================================================


class TestBatchRemoveLimit:
    @pytest.mark.asyncio
    async def test_f3_batch_remove_over_500_rejected_422(self, fix_client):
        token = await _register_user(fix_client, "fix-user-f3")
        resp = await fix_client.request(
            "DELETE",
            "/api/v1/stars",
            json={"entry_ids": list(range(501))},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_f3_batch_remove_empty_rejected_422(self, fix_client):
        token = await _register_user(fix_client, "fix-user-f3b")
        resp = await fix_client.request(
            "DELETE",
            "/api/v1/stars",
            json={"entry_ids": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
