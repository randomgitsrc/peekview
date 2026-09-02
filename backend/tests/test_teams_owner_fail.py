"""TPV0095 team-visibility backend TDD tests — owner account disable/delete.

Covers BDD-19 (owner disabled -> team frozen, member reads remain) and
BDD-20 (owner deleted -> team + entries cascade away).

RED in P3: Team/TeamMember FK relationships and the teams list API
(unimplemented GET /api/v1/teams -> 404). Fresh-DB delete cascades for
teams also unimplemented (no FK yet).

[PROD_NOT_TOUCHED] — isolated create_app instances only.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry
from tests._team_helpers import (
    auth,
    get_user,
    make_admin,
    make_entry_direct,
    make_team,
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


async def _scene(client, prefix):
    """alice(owner)+bob(member)+adminuser + team proj-{prefix} + team entry."""
    token_alice = await register_user(client, f"alice{prefix}")
    token_bob = await register_user(client, f"bob{prefix}")
    token_admin = await register_user(client, "adminuser")
    engine = client._app.state.engine
    with Session(engine) as session:
        make_admin(client._app, session, "adminuser")
        alice = get_user(session, f"alice{prefix}")
        bob = get_user(session, f"bob{prefix}")
        team = make_team(
            client._app, session, slug=f"proj-{prefix}", name=f"Proj {prefix}",
            owner_id=alice.id, member_ids=[bob.id],
        )
        make_entry_direct(
            client._app, session, slug=f"own-entry-{prefix}",
            is_public=False, owner_id=alice.id, team_id=team.id,
        )
        alice_id = alice.id
    return {
        "alice": token_alice,
        "bob": token_bob,
        "admin": token_admin,
        "alice_id": alice_id,
    }


# =====================================================================
# BDD-19: owner 禁用 → team 冻结（成员读权保留、admin 不接管）
# =====================================================================


class TestBdd19:
    @pytest.mark.asyncio
    async def test_bdd_19_owner_disabled_team_frozen_member_reads_remain(self, team_client):
        s = await _scene(team_client, "19")
        engine = team_client._app.state.engine

        disable = await team_client.post(
            f"/api/v1/admin/users/{s['alice_id']}/disable",
            json={"reason": "test"},
            headers=auth(s["admin"]),
        )
        assert disable.status_code == 200, f"admin disable alice failed: {disable.text}"
        with Session(engine) as session:
            assert get_user(session, "alice19").is_active is False

        detail = await team_client.get(
            "/api/v1/entries/own-entry-19", headers=auth(s["bob"])
        )
        assert detail.status_code == 200, "frozen team must keep member read access"

        teams = await team_client.get("/api/v1/teams", headers=auth(s["bob"]))
        assert teams.status_code == 200
        body = teams.json()
        joined = body.get("joined", []) if isinstance(body, dict) else []
        assert any(t.get("slug") == "proj-19" for t in joined), (
            "team must still appear in member's joined partition when owner disabled"
        )

        mgmt = await team_client.patch(
            "/api/v1/teams/proj-19",
            json={"name": "hijack"},
            headers=auth(s["admin"]),
        )
        assert mgmt.status_code == 404, "admin must NOT take over frozen team management"


# =====================================================================
# BDD-20: owner 删除 → team + entries 连带删除（CASCADE）
# =====================================================================


class TestBdd20:
    @pytest.mark.asyncio
    async def test_bdd_20_owner_deleted_team_and_entries_cascade(self, team_client):
        s = await _scene(team_client, "20")
        engine = team_client._app.state.engine

        del_resp = await team_client.delete(
            f"/api/v1/admin/users/{s['alice_id']}", headers=auth(s["admin"])
        )
        assert del_resp.status_code == 204, f"admin delete alice failed: {del_resp.text}"

        teams = await team_client.get("/api/v1/teams", headers=auth(s["bob"]))
        assert teams.status_code == 200
        body = teams.json()
        all_teams = (
            body.get("owned", []) if isinstance(body, dict) else []
        ) + (body.get("joined", []) if isinstance(body, dict) else [])
        assert not any(t.get("slug") == "proj-20" for t in all_teams), (
            "team must be gone from bob's teams after owner deleted"
        )

        detail = await team_client.get(
            "/api/v1/entries/own-entry-20", headers=auth(s["bob"])
        )
        assert detail.status_code == 404

        with Session(engine) as session:
            rows = session.exec(select(Entry).where(Entry.slug == "own-entry-20")).all()
            assert rows == [], "entries must cascade-delete with owner"
            teams_left = session.exec(
                text("SELECT COUNT(*) FROM teams WHERE slug='proj-20'")
            ).one()
            assert teams_left == 0, "teams must cascade-delete with owner user"
            fk = list(session.exec(text("PRAGMA foreign_key_check")).all())
            assert fk == [], f"foreign_key_check must pass, got {fk}"
