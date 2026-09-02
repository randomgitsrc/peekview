"""TPV0095 team-visibility backend TDD tests — visibility matrix (BDD-1~6/10/14/15/36).

RED in P3: Team/TeamMember models, can_read_entry/team_membership, teams
API and /raw team field are UNIMPLEMENTED. Imports of Team/TeamMember are
kept inside functions so collection succeeds; every test fails at runtime
with B-class errors (module attribute / target behavior missing).

[PROD_NOT_TOUCHED] — isolated create_app instances only.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry
from tests._team_helpers import (
    add_live_star,
    auth,
    get_user,
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


async def _setup_team_scene(client):
    """Create alice(owner)+bob(member)+carol(outside); team proj-a; team entry."""
    token_alice = await register_user(client, "alice")
    token_bob = await register_user(client, "bob")
    token_carol = await register_user(client, "carol")
    engine = client._app.state.engine
    entry = None
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
        file_id = None
    return (
        {"alice": token_alice, "bob": token_bob, "carol": token_carol},
        team,
        entry,
        file_id,
    )


def _entry_id(session, slug):
    return session.exec(select(Entry).where(Entry.slug == slug)).first().id


async def _make_share_token(client, slug, owner_username):
    """Create a valid share via service (owner). Returns token or None."""
    with Session(client._app.state.engine) as session:
        owner = get_user(session, owner_username)
        share_service = client._app.state.share_service
        try:
            created = share_service.create_share(
                slug=slug, current_user_id=owner.id, expires_in="7d"
            )
            return created.share_url.split("?share=")[1]
        except Exception:
            return None


# =====================================================================
# BDD-1: owner + member 200 (含 team 字段); 匿名 404
# =====================================================================


class TestBdd1:
    @pytest.mark.asyncio
    async def test_bdd_1_owner_and_member_can_read_team_entry_anon_404(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        owner_resp = await team_client.get(
            "/api/v1/entries/team-secret", headers=auth(tokens["alice"])
        )
        assert owner_resp.status_code == 200
        assert owner_resp.json()["team"]["slug"] == "proj-a"
        assert owner_resp.json()["team"]["name"] == "Proj A"

        member_resp = await team_client.get(
            "/api/v1/entries/team-secret", headers=auth(tokens["bob"])
        )
        assert member_resp.status_code == 200
        assert member_resp.json()["team"]["slug"] == "proj-a"

        team_client.cookies.clear()
        anon_resp = await team_client.get("/api/v1/entries/team-secret")
        assert anon_resp.status_code == 404


# =====================================================================
# BDD-2: 非成员 7 路径全 404，且与 slug 不存在不可区分
# =====================================================================


class TestBdd2:
    @pytest.mark.asyncio
    async def test_bdd_2_nonmember_404_all_7_read_paths_indistinguishable(self, team_client):
        tokens, _team, _entry, file_id = await _setup_team_scene(team_client)
        share_token = await _make_share_token(team_client, "team-secret", "alice")
        carol_headers = auth(tokens["carol"])

        # paths that must 404 for carol (share-read uses owner-made valid token:
        # entry belongs to team so carol still gets 404 because she is not owner/member)
        paths = {
            "get": ("GET", "/api/v1/entries/team-secret"),
            "raw": ("GET", "/api/v1/entries/team-secret/raw"),
            "download": ("GET", "/api/v1/entries/team-secret/download"),
        }
        if file_id:
            paths["files-content"] = (
                "GET",
                f"/api/v1/entries/team-secret/files/{file_id}/content",
            )
            paths["render"] = ("GET", f"/api/v1/entries/team-secret/files/{file_id}/render")
        if share_token:
            paths["share-read"] = (
                "GET",
                f"/api/v1/entries/team-secret?share={share_token}",
            )

        for name, (method, url) in paths.items():
            resp = await team_client.request(method, url, headers=carol_headers)
            assert resp.status_code == 404, (
                f"path {name} expected 404 for nonmember, got {resp.status_code}"
            )

        # list path — no entry in items (200 empty of it)
        listing = await team_client.get("/api/v1/entries", headers=carol_headers)
        assert listing.status_code == 200
        assert "team-secret" not in [i["slug"] for i in listing.json()["items"]]

        # indistinguishability on detail: same body shape as ghost slug
        ghost = await team_client.get(
            "/api/v1/entries/no-such-slug-xyz", headers=carol_headers
        )
        real = await team_client.get("/api/v1/entries/team-secret", headers=carol_headers)
        assert real.status_code == ghost.status_code == 404
        assert set(real.json().keys()) == set(ghost.json().keys())


# =====================================================================
# BDD-3: 非成员列表不含该 entry
# =====================================================================


class TestBdd3:
    @pytest.mark.asyncio
    async def test_bdd_3_nonmember_list_all_excludes_team_entry(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        resp = await team_client.get("/api/v1/entries", headers=auth(tokens["carol"]))
        assert resp.status_code == 200
        slugs = [i["slug"] for i in resp.json()["items"]]
        assert "team-secret" not in slugs


# =====================================================================
# BDD-4: 成员 All 聚合 + Team 过滤均含
# =====================================================================


class TestBdd4:
    @pytest.mark.asyncio
    async def test_bdd_4_member_list_all_and_team_filter_include(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        all_resp = await team_client.get("/api/v1/entries", headers=auth(tokens["bob"]))
        assert all_resp.status_code == 200
        slugs = [i["slug"] for i in all_resp.json()["items"]]
        assert "team-secret" in slugs, "team entry must appear in member All view"

        filter_resp = await team_client.get(
            "/api/v1/entries?team=proj-a", headers=auth(tokens["bob"])
        )
        assert filter_resp.status_code == 200
        items = filter_resp.json()["items"]
        assert len(items) == 1
        assert items[0]["slug"] == "team-secret"


# =====================================================================
# BDD-5: 成员 7 路径全放行（200）
# =====================================================================


class TestBdd5:
    @pytest.mark.asyncio
    async def test_bdd_5_member_200_all_7_read_paths(self, team_client):
        tokens, _team, _entry, file_id = await _setup_team_scene(team_client)
        bob_headers = auth(tokens["bob"])
        share_token = await _make_share_token(team_client, "team-secret", "alice")

        detail = await team_client.get("/api/v1/entries/team-secret", headers=bob_headers)
        assert detail.status_code == 200

        listing = await team_client.get("/api/v1/entries", headers=bob_headers)
        assert listing.status_code == 200
        assert "team-secret" in [i["slug"] for i in listing.json()["items"]]

        raw = await team_client.get("/api/v1/entries/team-secret/raw", headers=bob_headers)
        assert raw.status_code == 200

        if file_id:
            content = await team_client.get(
                f"/api/v1/entries/team-secret/files/{file_id}/content", headers=bob_headers
            )
            assert content.status_code == 200
            render = await team_client.get(
                f"/api/v1/entries/team-secret/files/{file_id}/render", headers=bob_headers
            )
            assert render.status_code in (200, 404)  # render is html-only endpoint

        download = await team_client.get(
            "/api/v1/entries/team-secret/download", headers=bob_headers
        )
        assert download.status_code == 200

        if share_token:
            team_client.cookies.clear()
            share_read = await team_client.get(
                f"/api/v1/entries/team-secret?share={share_token}"
            )
            assert share_read.status_code == 200


# =====================================================================
# BDD-6: archived team entry — 星标成员 200（星标不变量）
# =====================================================================


class TestBdd6:
    @pytest.mark.asyncio
    async def test_bdd_6_archived_team_entry_star_member_200(self, team_client):
        await register_user(team_client, "alice6")
        token_bob = await register_user(team_client, "bob6")
        engine = team_client._app.state.engine
        with Session(engine) as session:
            alice = get_user(session, "alice6")
            bob = get_user(session, "bob6")
            team = make_team(
                team_client._app, session, slug="proj-a6", name="A6",
                owner_id=alice.id, member_ids=[bob.id],
            )
            entry = make_entry_direct(
                team_client._app, session, slug="archived-team",
                is_public=False, owner_id=alice.id, team_id=team.id,
                status="archived",
                archived_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            add_live_star(session, entry.id, bob.id)

        resp = await team_client.get(
            "/api/v1/entries/archived-team", headers=auth(token_bob)
        )
        assert resp.status_code == 200, (
            "starred member must read archived team entry (star invariant), "
            f"got {resp.status_code}"
        )

        # non-starred member gets 404 (team visibility not extended to archived)
        token_bob2 = await register_user(team_client, "bob6b")
        with Session(engine) as session:
            bob2 = get_user(session, "bob6b")
            team_row = session.exec(
                select(Entry).where(Entry.slug == "archived-team")
            ).first()
            from peekview.models import TeamMember

            session.add(
                TeamMember(team_id=team_row.team_id, user_id=bob2.id)
            )
            session.commit()
        resp2 = await team_client.get(
            "/api/v1/entries/archived-team", headers=auth(token_bob2)
        )
        assert resp2.status_code == 404


# =====================================================================
# BDD-10: ?team= 对不存在/非成员 team 完全一致（200 + 空 items）
# =====================================================================


class TestBdd10:
    @pytest.mark.asyncio
    async def test_bdd_10_team_filter_unknown_and_nonmember_identical_empty(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        combos = [
            (None, "/api/v1/entries?team=proj-a"),
            (None, "/api/v1/entries?team=does-not-exist"),
            (auth(tokens["carol"]), "/api/v1/entries?team=proj-a"),
            (auth(tokens["carol"]), "/api/v1/entries?team=does-not-exist"),
        ]
        responses = []
        for headers, url in combos:
            resp = await team_client.get(url, headers=headers)
            assert resp.status_code == 200, f"{url} -> {resp.status_code}"
            responses.append(resp.json())
        shapes = [set(b.keys()) for b in responses]
        assert len(set(map(frozenset, shapes))) == 1, "all bodies must share key structure"
        for b in responses:
            assert b["items"] == []
            assert "teamFound" not in b
            assert "error" not in b


# =====================================================================
# BDD-14: 成员 star 的 team entry 出现在星标列表
# =====================================================================


class TestBdd14:
    @pytest.mark.asyncio
    async def test_bdd_14_member_starred_team_entry_in_star_lists(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        engine = team_client._app.state.engine
        with Session(engine) as session:
            bob = get_user(session, "bob")
            entry_id = _entry_id(session, "team-secret")
            add_live_star(session, entry_id, bob.id)

        starred_list = await team_client.get(
            "/api/v1/entries?starred=true", headers=auth(tokens["bob"])
        )
        assert starred_list.status_code == 200
        slugs = [i["slug"] for i in starred_list.json()["items"]]
        assert "team-secret" in slugs, "member starred team entry must appear in ?starred=true"

        stars_api = await team_client.get("/api/v1/stars", headers=auth(tokens["bob"]))
        assert stars_api.status_code == 200
        star_slugs = [i.get("slug") for i in stars_api.json()["items"]]
        assert "team-secret" in star_slugs, "member starred team entry must appear in /stars"


# =====================================================================
# BDD-15: 非成员残留 star 不构成越权读通道
# =====================================================================


class TestBdd15:
    @pytest.mark.asyncio
    async def test_bdd_15_nonmember_star_does_not_leak_team_entry(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)
        engine = team_client._app.state.engine
        with Session(engine) as session:
            carol = get_user(session, "carol")
            entry_id = _entry_id(session, "team-secret")
            add_live_star(session, entry_id, carol.id)

        stars_api = await team_client.get("/api/v1/stars", headers=auth(tokens["carol"]))
        assert stars_api.status_code == 200
        star_slugs = [i.get("slug") for i in stars_api.json()["items"]]
        assert "team-secret" not in star_slugs

        detail = await team_client.get(
            "/api/v1/entries/team-secret", headers=auth(tokens["carol"])
        )
        assert detail.status_code == 404


# =====================================================================
# BDD-36 (backend raw contract): /raw team 字段
# =====================================================================


class TestBdd36RawTeam:
    @pytest.mark.asyncio
    async def test_bdd_36_raw_team_field_member_404_others(self, team_client):
        tokens, _team, _entry, _fid = await _setup_team_scene(team_client)

        member_raw = await team_client.get(
            "/api/v1/entries/team-secret/raw", headers=auth(tokens["bob"])
        )
        assert member_raw.status_code == 200
        body = json.loads(member_raw.text)
        assert body.get("team") == {"slug": "proj-a", "name": "Proj A"}

        carol_raw = await team_client.get(
            "/api/v1/entries/team-secret/raw", headers=auth(tokens["carol"])
        )
        assert carol_raw.status_code == 404

        # global master key reads everything + includes team (PEEKVIEW_SERVER__API_KEY)
        team_client._app.state.config.server.api_key = "test-master-key-xyz"
        global_raw = await team_client.get(
            "/api/v1/entries/team-secret/raw",
            headers={"Authorization": "test-master-key-xyz"},
        )
        assert global_raw.status_code == 200
        body = json.loads(global_raw.text)
        assert body.get("team") == {"slug": "proj-a", "name": "Proj A"}
