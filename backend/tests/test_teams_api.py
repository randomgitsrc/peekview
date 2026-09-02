"""TPV0095 team-visibility backend TDD tests — teams API permissions & uniqueness.

Covers BDD-7/8/9/18.

RED in P3: /api/v1/teams router, TeamService, Team/TeamMember models are
UNIMPLEMENTED — every request to /api/v1/teams returns 404/405 (route missing).

[PROD_NOT_TOUCHED] — isolated create_app instances only.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session

from peekview.main import create_app
from tests._team_helpers import auth, get_user, make_team, register_user


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
    """alice(owner)+bob(member)+carol(outside) + team proj-a."""
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
        ids = {"alice": alice.id, "bob": bob.id}
    return {"alice": token_alice, "bob": token_bob, "carol": token_carol}, team, ids


# =====================================================================
# BDD-7: team 详情读权 = owner + 成员 200（含成员列表）/ 无关者 404
# =====================================================================


class TestBdd7:
    @pytest.mark.asyncio
    async def test_bdd_7_team_detail_owner_member_200_carol_404(self, team_client):
        tokens, _team, _ids = await _scene(team_client)
        owner_resp = await team_client.get(
            "/api/v1/teams/proj-a", headers=auth(tokens["alice"])
        )
        assert owner_resp.status_code == 200
        assert owner_resp.json()["slug"] == "proj-a"
        members = owner_resp.json().get("members", [])
        assert any(m["username"] == "bob" for m in members), "member list must include bob"

        member_resp = await team_client.get(
            "/api/v1/teams/proj-a", headers=auth(tokens["bob"])
        )
        assert member_resp.status_code == 200

        carol_resp = await team_client.get(
            "/api/v1/teams/proj-a", headers=auth(tokens["carol"])
        )
        assert carol_resp.status_code == 404, "unrelated user must 404 (not 403)"


# =====================================================================
# BDD-8: 管理操作权仅 owner — member/carol 全 404、owner 成功
# =====================================================================


class TestBdd8:
    @pytest.mark.asyncio
    async def test_bdd_8_member_and_carol_manage_operations_404_owner_succeeds(self, team_client):
        tokens, _team, ids = await _scene(team_client)
        operations = [
            ("PATCH", "/api/v1/teams/proj-a", {"name": "Renamed"}),
            ("DELETE", "/api/v1/teams/proj-a", None),
            ("POST", "/api/v1/teams/proj-a/members", {"username": "dave"}),
            ("DELETE", f"/api/v1/teams/proj-a/members/{ids['bob']}", None),
        ]
        for method, url, body in operations:
            for who in ("bob", "carol"):
                resp = await team_client.request(method, url, json=body, headers=auth(tokens[who]))
                assert resp.status_code == 404, (
                    f"{who} {method} {url} must 404 (member read != write), got {resp.status_code}"
                )

        rename = await team_client.patch(
            "/api/v1/teams/proj-a",
            json={"name": "Proj A Renamed"},
            headers=auth(tokens["alice"]),
        )
        assert rename.status_code == 200, f"owner rename must succeed, got {rename.status_code}"

        await register_user(team_client, "dave")
        add = await team_client.post(
            "/api/v1/teams/proj-a/members",
            json={"username": "dave"},
            headers=auth(tokens["alice"]),
        )
        assert add.status_code in (200, 201), f"owner add member must succeed: {add.text}"

        remove = await team_client.request(
            "DELETE",
            f"/api/v1/teams/proj-a/members/{ids['bob']}",
            headers=auth(tokens["alice"]),
        )
        assert remove.status_code in (200, 204), f"owner remove member must succeed: {remove.text}"


# =====================================================================
# BDD-9: 添加成员 username 不存在 → 404（无存在性 oracle）
# =====================================================================


class TestBdd9:
    @pytest.mark.asyncio
    async def test_bdd_9_add_member_unknown_username_404(self, team_client):
        tokens, _team, _ids = await _scene(team_client)
        resp = await team_client.post(
            "/api/v1/teams/proj-a/members",
            json={"username": "no-such-user-xyz"},
            headers=auth(tokens["alice"]),
        )
        assert resp.status_code == 404, f"unknown username add must 404, got {resp.status_code}"


# =====================================================================
# BDD-18: name 在 owner 内唯一；slug 全局唯一冲突自动 -N 后缀
# =====================================================================


class TestBdd18:
    @pytest.mark.asyncio
    async def test_bdd_18_name_unique_per_owner_slug_global_suffix(self, team_client):
        token_a = await register_user(team_client, "userA18")
        token_b = await register_user(team_client, "userB18")

        r_a = await team_client.post(
            "/api/v1/teams", json={"name": "Alpha"}, headers=auth(token_a)
        )
        assert r_a.status_code == 201, f"A create Alpha failed: {r_a.status_code} {r_a.text}"
        assert r_a.json()["slug"] == "alpha"

        r_b = await team_client.post(
            "/api/v1/teams", json={"name": "Alpha"}, headers=auth(token_b)
        )
        assert r_b.status_code == 201, (
            f"B create Alpha must succeed (cross-owner), got {r_b.status_code}"
        )
        assert r_b.json()["slug"] == "alpha-1", (
            f"B slug must auto-suffix, got {r_b.json()['slug']}"
        )

        r_a2 = await team_client.post(
            "/api/v1/teams", json={"name": "Alpha"}, headers=auth(token_a)
        )
        assert r_a2.status_code in (400, 409), (
            f"owner-scope duplicate name must error explicitly, got {r_a2.status_code}"
        )
        assert r_a2.json().get("slug") != "alpha-2", "duplicate name must NOT silently suffix"

        detail = await team_client.get("/api/v1/teams/alpha", headers=auth(token_a))
        assert detail.status_code == 200
        assert detail.json()["name"] == "Alpha"
