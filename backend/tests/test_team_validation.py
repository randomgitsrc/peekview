"""TPV0095 team-visibility backend TDD tests — validation & API contract.

Covers BDD-21/22/23/24/25/27/29/30 (校验契约 + 竞态 + 零变化回归 + API 契约).

RED in P3: team_id create/update contract (D2/D3/D4, ParameterValidationError
422), team membership resolution UNIMPLEMENTED.

[PROD_NOT_TOUCHED] — isolated create_app instances only.
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry
from tests._team_helpers import (
    auth,
    get_user,
    make_entry_direct,
    make_team,
    make_team_member,
    register_user,
)


@pytest.fixture
async def team_client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


async def _scene(client):
    """alice owner + bob member + carol outside; team proj-a; team entry."""
    token_alice = await register_user(client, "alice")
    token_bob = await register_user(client, "bob")
    token_carol = await register_user(client, "carol")
    engine = client._app.state.engine
    with Session(engine) as session:
        alice = get_user(session, "alice")
        bob = get_user(session, "bob")
        team = make_team(
            client._app, session, slug="proj-a", name="Proj A",
            owner_id=alice.id, member_ids=[bob.id],
        )
        entry = make_entry_direct(
            client._app, session, slug="team-secret", is_public=False,
            owner_id=alice.id, team_id=team.id,
        )
    return {"alice": token_alice, "bob": token_bob, "carol": token_carol}, team, entry


# =====================================================================
# BDD-21: team_id 不存在/非成员 create → 422 统一语义、绝不静默忽略
# =====================================================================


class TestBdd21:
    @pytest.mark.asyncio
    async def test_bdd_21_create_unknown_and_nonmember_team_422_indistinguishable(
        self, team_client
    ):
        tokens, _team, _entry = await _scene(team_client)
        carol = auth(tokens["carol"])
        r1 = await team_client.post(
            "/api/v1/entries",
            json={"summary": "leak-1", "slug": "leak-1", "team_id": "no-such-team"},
            headers=carol,
        )
        assert r1.status_code == 422, f"unknown team must 422, got {r1.status_code}"

        r2 = await team_client.post(
            "/api/v1/entries",
            json={"summary": "leak-2", "slug": "leak-2", "team_id": "proj-a"},
            headers=carol,
        )
        assert r2.status_code == 422, f"non-member team must 422, got {r2.status_code}"

        code1 = r1.json().get("error", {}).get("code")
        code2 = r2.json().get("error", {}).get("code")
        assert code1 == code2 == "PARAMETER_VALIDATION_ERROR"

        engine = team_client._app.state.engine
        with Session(engine) as session:
            leaked = session.exec(
                select(Entry).where(Entry.slug.in_(["leak-1", "leak-2"]))
            ).all()
            assert leaked == [], "team_id must never be silently ignored on create"


# =====================================================================
# BDD-22: 匿名携带 team_id → 422
# =====================================================================


class TestBdd22:
    @pytest.mark.asyncio
    async def test_bdd_22_anonymous_create_with_team_id_422(self, team_client):
        team_client.cookies.clear()
        resp = await team_client.post(
            "/api/v1/entries",
            json={"summary": "anon-team", "team_id": "proj-a"},
        )
        assert resp.status_code == 422, f"anonymous team_id create must 422, got {resp.status_code}"
        assert resp.json().get("error", {}).get("code") == "PARAMETER_VALIDATION_ERROR"


# =====================================================================
# BDD-23: 成员被移除后立即读 → 404
# =====================================================================


class TestBdd23:
    @pytest.mark.asyncio
    async def test_bdd_23_removed_member_immediate_read_404(self, team_client):
        tokens, team, _entry = await _scene(team_client)
        engine = team_client._app.state.engine
        from peekview.models import TeamMember

        with Session(engine) as session:
            bob = get_user(session, "bob")
            tm = session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team.id, TeamMember.user_id == bob.id
                )
            ).first()
            if tm:
                session.delete(tm)
                session.commit()

        detail = await team_client.get(
            "/api/v1/entries/team-secret", headers=auth(tokens["bob"])
        )
        assert detail.status_code == 404, "removed member must lose read immediately"
        raw = await team_client.get(
            "/api/v1/entries/team-secret/raw", headers=auth(tokens["bob"])
        )
        assert raw.status_code == 404


# =====================================================================
# BDD-24: team 删除与 list_entries 并发 → 非 5xx
# =====================================================================


class TestBdd24:
    @pytest.mark.asyncio
    async def test_bdd_24_concurrent_team_delete_and_list_no_5xx(self, team_client):
        tokens, team, _entry = await _scene(team_client)
        engine = team_client._app.state.engine
        member_headers = auth(tokens["bob"])

        async def _list():
            return await team_client.get("/api/v1/entries", headers=member_headers)

        async def _delete_team():
            from peekview.models import Team

            with Session(engine) as session:
                t = session.get(Team, team.id)
                if t:
                    session.delete(t)
                    session.commit()

        list_task = asyncio.create_task(_list())
        await asyncio.sleep(0)
        await _delete_team()
        resp = await list_task
        assert resp.status_code in (200, 404), f"list must not 5xx, got {resp.status_code}"


# =====================================================================
# BDD-25: 不带 team 参数的行为零变化（关键路径形状回归）— 合法全绿基线
# =====================================================================


class TestBdd25:
    @pytest.mark.asyncio
    async def test_bdd_25_no_team_param_behavior_zero_change(self, team_client):
        token = await register_user(team_client, "alice25")
        resp = await team_client.post(
            "/api/v1/entries",
            json={"summary": "plain", "slug": "plain-25", "is_public": True},
            headers=auth(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        for key in ("id", "slug", "url", "is_public", "files"):
            assert key in data
        assert data["is_public"] is True

        resp2 = await team_client.post(
            "/api/v1/entries",
            json={"summary": "priv", "slug": "priv-25", "is_public": False},
            headers=auth(token),
        )
        assert resp2.status_code == 201

        listing = await team_client.get("/api/v1/entries", headers=auth(token))
        assert listing.status_code == 200
        slugs = [i["slug"] for i in listing.json()["items"]]
        assert "plain-25" in slugs and "priv-25" in slugs


# =====================================================================
# BDD-27: create 携带 team_id → 服务端强制 is_public=false
# =====================================================================


class TestBdd27:
    @pytest.mark.asyncio
    async def test_bdd_27_create_with_team_id_forces_is_public_false(self, team_client):
        tokens, team, _entry = await _scene(team_client)
        resp = await team_client.post(
            "/api/v1/entries",
            json={
                "summary": "force",
                "slug": "force-team",
                "team_id": "proj-a",
                "is_public": True,
            },
            headers=auth(tokens["alice"]),
        )
        assert resp.status_code == 201, f"expected 201 got {resp.status_code}: {resp.text}"
        engine = team_client._app.state.engine
        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "force-team")).first()
            assert entry is not None
            assert entry.is_public is False, "team_id create must force is_public=false in DB"
            assert entry.team_id == team.id, "entry must point at the team"


# =====================================================================
# BDD-29: update 迁移到当前用户是成员的 team（joined）成功
# =====================================================================


class TestBdd29:
    @pytest.mark.asyncio
    async def test_bdd_29_update_migrate_to_joined_team_succeeds(self, team_client):
        token_alice = await register_user(team_client, "alice29")
        await register_user(team_client, "ownerB")
        engine = team_client._app.state.engine
        with Session(engine) as session:
            alice = get_user(session, "alice29")
            owner_b = get_user(session, "ownerB")
            team_b = make_team(
                team_client._app, session, slug="team-b", name="TeamB", owner_id=owner_b.id
            )
            make_entry_direct(
                team_client._app, session, slug="x-migrate",
                is_public=False, owner_id=alice.id,
            )
            # alice (owner of X) joins team B (joined partition)
            make_team_member(team_client._app, session, team_b.id, alice.id)

        resp = await team_client.patch(
            "/api/v1/entries/x-migrate",
            json={"team_id": "team-b"},
            headers=auth(token_alice),
        )
        assert resp.status_code == 200, f"migrate to joined team must succeed: {resp.text}"
        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == "x-migrate")).first()
            assert entry.team_id == team_b.id
            assert entry.is_public is False


# =====================================================================
# BDD-30: update 迁移到非成员/不存在 team → 422 同构
# =====================================================================


class TestBdd30:
    @pytest.mark.asyncio
    async def test_bdd_30_update_migrate_to_nonmember_and_unknown_422(self, team_client):
        token_alice = await register_user(team_client, "alice30")
        await register_user(team_client, "ownerB")
        engine = team_client._app.state.engine
        with Session(engine) as session:
            alice = get_user(session, "alice30")
            make_entry_direct(
                team_client._app, session, slug="y-migrate",
                is_public=False, owner_id=alice.id,
            )
            owner_b = get_user(session, "ownerB")
            make_team(team_client._app, session, slug="team-c", name="TeamC", owner_id=owner_b.id)

        alice_auth = auth(token_alice)
        r1 = await team_client.patch(
            "/api/v1/entries/y-migrate",
            json={"team_id": "team-c"},
            headers=alice_auth,
        )
        assert r1.status_code == 422, f"non-member target must 422 got {r1.status_code}"
        r2 = await team_client.patch(
            "/api/v1/entries/y-migrate",
            json={"team_id": "ghost-team"},
            headers=alice_auth,
        )
        assert r2.status_code == 422, f"unknown target must 422 got {r2.status_code}"
        assert (
            r1.json().get("error", {}).get("code")
            == r2.json().get("error", {}).get("code")
            == "PARAMETER_VALIDATION_ERROR"
        )
