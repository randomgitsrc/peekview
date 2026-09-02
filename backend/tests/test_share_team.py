"""TPV0095 team-visibility backend TDD tests — share × team interaction.

Covers BDD-11/12/13/28.

RED in P3: share_service still raises ForbiddenError (403) for non-owner —
BDD-12 expects 404. team_id-based create/update (D2/D4) and revoke of
team→public shares (D4) UNIMPLEMENTED. /api/v1/teams UNIMPLEMENTED.

[PROD_NOT_TOUCHED] — isolated create_app instances only.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry, EntryShare
from tests._team_helpers import auth, get_user, make_entry_direct, make_team, register_user


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
    """alice(owner)+bob(member)+carol(outside); team proj-a; team entry."""
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
            client._app, session, slug="team-share", is_public=False,
            owner_id=alice.id, team_id=team.id,
        )
    return {"alice": token_alice, "bob": token_bob, "carol": token_carol}, team, entry


def _make_share_token_direct(app, slug, owner_id):
    share_service = app.state.share_service
    try:
        created = share_service.create_share(
            slug=slug, current_user_id=owner_id, expires_in="7d"
        )
        return created.share_url.split("?share=")[1]
    except Exception:
            return None


# =====================================================================
# BDD-11: owner + admin 可建 team entry share；token 可读
# =====================================================================


class TestBdd11:
    @pytest.mark.asyncio
    async def test_bdd_11_owner_and_admin_create_share_for_team_entry(self, team_client):
        tokens, _team, _entry = await _scene(team_client)
        with Session(team_client._app.state.engine) as session:
            carol = get_user(session, "carol")
            carol.is_admin = True
            session.add(carol)
            session.commit()

        owner_share = await team_client.post(
            "/api/v1/entries/team-share/shares",
            json={"expires_in": "7d"},
            headers=auth(tokens["alice"]),
        )
        assert owner_share.status_code == 201, f"owner share create failed: {owner_share.text}"
        token = owner_share.json()["share_url"].split("?share=")[1]

        team_client.cookies.clear()
        read = await team_client.get(f"/api/v1/entries/team-share?share={token}")
        assert read.status_code == 200, "valid owner share token must read team entry"

        admin_share = await team_client.post(
            "/api/v1/entries/team-share/shares",
            json={"expires_in": "7d"},
            headers=auth(tokens["carol"]),
        )
        assert admin_share.status_code == 201, f"admin share create failed: {admin_share.text}"


# =====================================================================
# BDD-12: 成员不可建 team entry share → 404（非 403）
# =====================================================================


class TestBdd12:
    @pytest.mark.asyncio
    async def test_bdd_12_member_cannot_create_share_404(self, team_client):
        tokens, _team, _entry = await _scene(team_client)
        resp = await team_client.post(
            "/api/v1/entries/team-share/shares",
            json={"expires_in": "7d"},
            headers=auth(tokens["bob"]),
        )
        assert resp.status_code == 404, (
            f"member share create must 404 (was 403), got {resp.status_code}: {resp.text}"
        )


# =====================================================================
# BDD-13: share 生命周期与成员变动 / team 删除无关
# =====================================================================


class TestBdd13:
    @pytest.mark.asyncio
    async def test_bdd_13_share_outlives_member_removal_and_team_delete(self, team_client):
        tokens, team, _entry = await _scene(team_client)
        engine = team_client._app.state.engine
        alice_id = _user_id(team_client, "alice")
        share_token = _make_share_token_direct(team_client._app, "team-share", alice_id)
        assert share_token is not None, "precondition: owner share must exist"

        from peekview.models import Team, TeamMember

        with Session(engine) as session:
            bob = get_user(session, "bob")
            tm = session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team.id, TeamMember.user_id == bob.id
                )
            ).first()
            if tm:
                session.delete(tm)
            t = session.get(Team, team.id)
            if t:
                session.delete(t)
            session.commit()

        with Session(engine) as session:
            e = session.exec(select(Entry).where(Entry.slug == "team-share")).first()
            assert e is not None
            assert e.team_id is None

        team_client.cookies.clear()
        resp = await team_client.get(f"/api/v1/entries/team-share?share={share_token}")
        assert resp.status_code == 200, "share token must survive member removal + team delete"


# =====================================================================
# BDD-28: update 将 team entry 转 public（去 team_id）→ 撤销全部 share
# =====================================================================


class TestBdd28:
    @pytest.mark.asyncio
    async def test_bdd_28_update_team_to_public_revokes_all_shares(self, team_client):
        tokens, _team, _entry = await _scene(team_client)
        alice_id = _user_id(team_client, "alice")
        _make_share_token_direct(team_client._app, "team-share", alice_id)
        _make_share_token_direct(team_client._app, "team-share", alice_id)

        resp = await team_client.patch(
            "/api/v1/entries/team-share",
            json={"is_public": True, "team_id": None},
            headers=auth(tokens["alice"]),
        )
        assert resp.status_code == 200, f"team->public update failed: {resp.text}"
        assert resp.json().get("revoked_shares", 0) >= 2, (
            "team->public must revoke all active shares (revoked_shares>=2)"
        )

        engine = team_client._app.state.engine
        with Session(engine) as session:
            shares = session.exec(select(EntryShare)).all()
            assert shares, "shares should exist (revoked)"
            assert all(s.revoked_at is not None for s in shares), (
                "all shares revoked after team->public"
            )
            e = session.exec(select(Entry).where(Entry.slug == "team-share")).first()
            assert e.team_id is None
            assert e.is_public is True


def _user_id(client, username):
    with Session(client._app.state.engine) as session:
        return get_user(session, username).id
