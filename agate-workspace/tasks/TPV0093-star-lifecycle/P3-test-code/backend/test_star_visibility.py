"""Tests for TPV0093 archived visibility: BDD-15/16/17 + BLOCKER-1/4 + N8 + BDD-28.

决策 A：archived 读取权限扩展为 owner/admin/星标用户（详情/raw/文件内容三处同源）。
share 为独立授权通道（BDD-28 回归保护）。
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, User


@pytest.fixture
async def visibility_client(tmp_path, monkeypatch):
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


def _archive_entry(session, slug: str) -> None:
    entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
    entry.status = "archived"
    entry.archived_at = datetime.now(timezone.utc)
    session.add(entry)
    session.commit()


async def _create_entry_with_file(client, token, slug, is_public=True):
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": f"Visibility target {slug}",
            "slug": slug,
            "is_public": is_public,
            "files": [{"path": "main.py", "content": "print('visible')"}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()["slug"], resp.json()["files"][0]["id"]


# ============================================================
# BDD-15: 星标用户可读 archived 全文（详情/raw/文件内容）
# ============================================================


class TestStarUserReadsArchived:
    @pytest.mark.asyncio
    async def test_bdd_15_star_user_reads_archived_detail_raw_file(self, visibility_client):
        token_owner = await _register_user(visibility_client, "vis-owner")
        token_star = await _register_user(visibility_client, "vis-star")
        slug, file_id = await _create_entry_with_file(
            visibility_client, token_owner, "bdd15-archived"
        )

        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            star_user = session.exec(select(User).where(User.username == "vis-star")).first()
            _archive_entry(session, slug)
            _insert_star(session, _entry_id(session, slug), star_user.id)

        detail = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert detail.status_code == 200
        assert detail.json()["slug"] == slug

        raw = await visibility_client.get(
            f"/api/v1/entries/{slug}/raw",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert raw.status_code == 200

        content = await visibility_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}/content",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert content.status_code == 200
        assert content.text == "print('visible')"


def _entry_id(session, slug: str) -> int:
    entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
    return entry.id


# ============================================================
# BDD-16: 非星标用户对 archived 返回 404（防 slug 枚举）
# ============================================================


class TestNonStarUserArchived404:
    @pytest.mark.asyncio
    async def test_bdd_16_non_star_user_archived_404_all_endpoints(self, visibility_client):
        token_owner = await _register_user(visibility_client, "vis-owner-16")
        token_other = await _register_user(visibility_client, "vis-other-16")
        slug, file_id = await _create_entry_with_file(
            visibility_client, token_owner, "bdd16-archived"
        )

        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            _archive_entry(session, slug)

        detail = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert detail.status_code == 404

        raw = await visibility_client.get(
            f"/api/v1/entries/{slug}/raw",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert raw.status_code == 404

        content = await visibility_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}/content",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert content.status_code == 404


# ============================================================
# BDD-17: owner/admin 读 archived 始终可用（回归）
# ============================================================


class TestOwnerAdminArchivedAlwaysReadable:
    @pytest.mark.asyncio
    async def test_bdd_17_owner_and_admin_read_archived_200(self, visibility_client):
        token_owner = await _register_user(visibility_client, "vis-owner-17")
        token_admin = await _register_user(visibility_client, "vis-admin-17")
        slug, _file_id = await _create_entry_with_file(
            visibility_client, token_owner, "bdd17-archived"
        )

        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            _make_admin(visibility_client._app, session, "vis-admin-17")
            _archive_entry(session, slug)

        owner_resp = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert owner_resp.status_code == 200

        admin_resp = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        assert admin_resp.status_code == 200


# ============================================================
# BLOCKER-1: 公开→星标→转私有(active)→归档 → 星标用户 200 / 非星标 404
# ============================================================


class TestPublicStarPrivateArchivedChain:
    @pytest.mark.asyncio
    async def test_blocker1_star_survives_private_and_archive(self, visibility_client):
        token_owner = await _register_user(visibility_client, "vis-owner-b1")
        token_star = await _register_user(visibility_client, "vis-star-b1")
        token_other = await _register_user(visibility_client, "vis-other-b1")
        slug, _file_id = await _create_entry_with_file(
            visibility_client, token_owner, "blocker1-chain", is_public=True
        )

        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            star_user = session.exec(select(User).where(User.username == "vis-star-b1")).first()
            _insert_star(session, _entry_id(session, slug), star_user.id)

        patch_resp = await visibility_client.patch(
            f"/api/v1/entries/{slug}",
            json={"is_public": False},
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert patch_resp.status_code == 200

        with Session(engine) as session:
            _archive_entry(session, slug)

        star_resp = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_star}"},
        )
        assert star_resp.status_code == 200

        other_resp = await visibility_client.get(
            f"/api/v1/entries/{slug}",
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert other_resp.status_code == 404


# ============================================================
# BLOCKER-4: ownerless archived 匿名 404（防 slug 枚举，回归锚）
# N8: ownerless 私有 active 匿名 404（非 archived 分支收紧）
# ============================================================


class TestOwnerlessAnonymous:
    @pytest.mark.asyncio
    async def test_blocker4_ownerless_archived_anonymous_404(self, visibility_client):
        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                visibility_client._app,
                session,
                slug="blocker4-ownerless-archived",
                is_public=True,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=30),
                owner_id=None,
            )
        visibility_client.cookies.clear()
        resp = await visibility_client.get("/api/v1/entries/blocker4-ownerless-archived")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_n8_ownerless_private_active_anonymous_404(self, visibility_client):
        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            _create_entry_direct(
                visibility_client._app,
                session,
                slug="n8-ownerless-private-active",
                is_public=False,
                status="active",
                owner_id=None,
            )
        visibility_client.cookies.clear()
        resp = await visibility_client.get("/api/v1/entries/n8-ownerless-private-active")
        assert resp.status_code == 404


# ============================================================
# BDD-28: archived entry 持有效 share 仍可读取（share 独立授权通道，回归保护）
# ============================================================


class TestArchivedShareStillReadable:
    @pytest.mark.asyncio
    async def test_bdd_28_archived_entry_with_valid_share_readable(self, visibility_client):
        token_owner = await _register_user(visibility_client, "vis-owner-28")
        slug, _file_id = await _create_entry_with_file(
            visibility_client, token_owner, "bdd28-share", is_public=False
        )

        share_resp = await visibility_client.post(
            f"/api/v1/entries/{slug}/shares",
            json={"expires_in": "7d"},
            headers={"Authorization": f"Bearer {token_owner}"},
        )
        assert share_resp.status_code == 201
        share_url = share_resp.json()["share_url"]
        token = share_url.split("?share=")[1]

        engine = visibility_client._app.state.engine
        with Session(engine) as session:
            _archive_entry(session, slug)

        visibility_client.cookies.clear()
        resp = await visibility_client.get(f"/api/v1/entries/{slug}?share={token}")
        assert resp.status_code == 200
        assert resp.json()["slug"] == slug
