"""Tests for TPV0093 star API endpoints: BDD-1/2/3/4/5 + BLOCKER-2 + N7 + N9.

Covers POST/DELETE /api/v1/entries/{slug}/star, star counting semantics,
anonymous rejection, multi-user counting, and the star pre-readability gate.
"""

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, User


@pytest.fixture
async def star_client(tmp_path, monkeypatch):
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


# ============================================================
# BDD-1: 登录用户星标公开内容，计数 +1
# ============================================================


class TestStarPublicEntry:
    @pytest.mark.asyncio
    async def test_bdd_1_login_user_star_public_entry_count_increments(self, star_client):
        token = await _register_user(star_client, "star-bdd1")
        create_resp = await star_client.post(
            "/api/v1/entries",
            json={"summary": "Public star target", "slug": "bdd1-public"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201

        resp = await star_client.post(
            "/api/v1/entries/bdd1-public/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["star_count"] == 1
        assert data["is_starred"] is True


# ============================================================
# BDD-2: 同一用户重复星标不重复计数
# ============================================================


class TestRepeatStar:
    @pytest.mark.asyncio
    async def test_bdd_2_repeat_star_keeps_count_and_marks_already_starred(self, star_client):
        token = await _register_user(star_client, "star-bdd2")
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "Repeat star", "slug": "bdd2-repeat"},
            headers={"Authorization": f"Bearer {token}"},
        )
        first = await star_client.post(
            "/api/v1/entries/bdd2-repeat/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        first_count = first.json()["star_count"]

        second = await star_client.post(
            "/api/v1/entries/bdd2-repeat/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert second.status_code == 200
        data = second.json()
        assert data["star_count"] == first_count
        assert data["already_starred"] is True


# ============================================================
# BDD-3: 取消星标计数 -1
# ============================================================


class TestUnstar:
    @pytest.mark.asyncio
    async def test_bdd_3_unstar_decrements_count_and_is_starred_false(self, star_client):
        token = await _register_user(star_client, "star-bdd3")
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "Unstar target", "slug": "bdd3-unstar"},
            headers={"Authorization": f"Bearer {token}"},
        )
        star_resp = await star_client.post(
            "/api/v1/entries/bdd3-unstar/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert star_resp.status_code == 200
        assert star_resp.json()["star_count"] == 1

        resp = await star_client.delete(
            "/api/v1/entries/bdd3-unstar/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["star_count"] == 0
        assert data["is_starred"] is False


# ============================================================
# BDD-4: 匿名用户不能星标
# ============================================================


class TestAnonymousStarRejected:
    @pytest.mark.asyncio
    async def test_bdd_4_anonymous_star_rejected_401(self, star_client):
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "Anonymous star target", "slug": "bdd4-anon"},
        )
        star_client.cookies.clear()
        resp = await star_client.post("/api/v1/entries/bdd4-anon/star")
        assert resp.status_code == 401


# ============================================================
# BDD-5: 多用户星标各计一次
# ============================================================


class TestMultiUserStar:
    @pytest.mark.asyncio
    async def test_bdd_5_two_users_each_count_once(self, star_client):
        token_a = await _register_user(star_client, "star-bdd5-a")
        token_b = await _register_user(star_client, "star-bdd5-b")
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "Multi star target", "slug": "bdd5-multi"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        resp_a = await star_client.post(
            "/api/v1/entries/bdd5-multi/star",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp_a.status_code == 200
        resp_b = await star_client.post(
            "/api/v1/entries/bdd5-multi/star",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp_b.status_code == 200

        detail = await star_client.get(
            "/api/v1/entries/bdd5-multi",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert detail.status_code == 200
        assert detail.json()["star_count"] == 2


# ============================================================
# BLOCKER-2: star 前置可读验证（防自授权绕过 + 防 slug 探测）
# ============================================================


class TestStarReadabilityGate:
    @pytest.mark.asyncio
    async def test_blocker2_star_requires_readable_entry(self, star_client):
        token_owner = await _register_user(star_client, "star-owner")
        token_other = await _register_user(star_client, "star-other")
        with Session(star_client._app.state.engine) as session:
            owner = session.exec(select(User).where(User.username == "star-owner")).first()
            _create_entry_direct(
                star_client._app,
                session,
                slug="blocker2-private",
                is_public=False,
                owner_id=owner.id,
            )

        # owner 对私有 entry 星标成功（前置可读）
        resp_owner = await star_client.post(
            "/api/v1/entries/blocker2-private/star",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp_owner.status_code == 200

        # 非 owner 对私有 entry 星标 → 404（防自授权绕过）
        resp_other = await star_client.post(
            "/api/v1/entries/blocker2-private/star",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert resp_other.status_code == 404

        # 未知 slug → 404（防 slug 探测）
        resp_unknown = await star_client.post(
            "/api/v1/entries/does-not-exist-xyz/star",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert resp_unknown.status_code == 404


# ============================================================
# N9: 转私有后取消星标仍 200（DELETE star 仅需 entry 存在）
# ============================================================


class TestUnstarAfterMakePrivate:
    @pytest.mark.asyncio
    async def test_n9_unstar_after_make_private_still_200(self, star_client):
        token = await _register_user(star_client, "star-n9")
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "N9 target", "slug": "n9-privatize", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        star_resp = await star_client.post(
            "/api/v1/entries/n9-privatize/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert star_resp.status_code == 200

        patch_resp = await star_client.patch(
            "/api/v1/entries/n9-privatize",
            json={"is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert patch_resp.status_code == 200

        resp = await star_client.delete(
            "/api/v1/entries/n9-privatize/star",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_starred"] is False


# ============================================================
# N7: 并发重复星标 → 唯一索引兜底幂等（非 500）
# ============================================================


class TestConcurrentStar:
    @pytest.mark.asyncio
    async def test_n7_concurrent_star_never_500(self, star_client):
        token = await _register_user(star_client, "star-n7")
        await star_client.post(
            "/api/v1/entries",
            json={"summary": "Concurrent star", "slug": "n7-concurrent"},
            headers={"Authorization": f"Bearer {token}"},
        )

        async def _star():
            return await star_client.post(
                "/api/v1/entries/n7-concurrent/star",
                headers={"Authorization": f"Bearer {token}"},
            )

        responses = await asyncio.gather(_star(), _star())
        for resp in responses:
            assert resp.status_code == 200
            assert resp.json()["star_count"] == 1
