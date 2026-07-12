"""TDD tests for T053: Agent Raw endpoint auto-discovery.

Three-layer discovery:
1. Content Negotiation (Accept header → JSON or HTML)
2. HTML self-description (<link rel="alternate"> + Link header)
3. llms.txt supplement

All tests are RED initially — implementation does not exist yet.
Tests define the contract; P4 implementation makes them green.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import User


@pytest.fixture
async def client():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            c._app = app
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _register(client, username="testuser", password="testpass123"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 201, f"Register failed: {resp.status_code} {resp.text}"
    return resp.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_public_entry(client, slug=None, summary="Test entry", files=None):
    data = {"summary": summary, "is_public": True}
    if slug:
        data["slug"] = slug
    if files:
        data["files"] = files
    resp = await client.post("/api/v1/entries", json=data)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["slug"]


async def _create_private_entry(client, auth_token, slug=None, summary="Private entry", files=None):
    data = {"summary": summary, "is_public": False}
    if slug:
        data["slug"] = slug
    if files:
        data["files"] = files
    resp = await client.post("/api/v1/entries", json=data, headers=_auth(auth_token))
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["slug"]


def _make_admin(app, username):
    engine = app.state.engine
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if user and not user.is_admin:
            user.is_admin = True
            session.add(user)
            session.commit()


# ============================================================
# B1: Content Negotiation — JSON preferred
# ============================================================


class TestB1JsonPreferred:
    @pytest.mark.asyncio
    async def test_json_when_accept_application_json(self, client):
        slug = await _create_public_entry(client, slug="b1-test")

        resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")
        data = resp.json()
        assert data["slug"] == slug

    @pytest.mark.asyncio
    async def test_json_matches_raw_endpoint(self, client):
        slug = await _create_public_entry(
            client,
            slug="b1-raw-match",
            files=[{"filename": "hello.py", "content": "print('hello')", "language": "python"}],
        )

        cn_resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})
        raw_resp = await client.get(f"/api/v1/entries/{slug}/raw")

        assert cn_resp.status_code == 200
        assert raw_resp.status_code == 200
        assert cn_resp.json() == raw_resp.json()


# ============================================================
# B2: Content Negotiation — HTML preferred
# ============================================================


class TestB2HtmlPreferred:
    @pytest.mark.asyncio
    async def test_html_when_both_acceptable(self, client):
        slug = await _create_public_entry(client, slug="b2-test")

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "text/html, application/json"},
        )

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")


# ============================================================
# B3: Content Negotiation — wildcard does not trigger JSON
# ============================================================


class TestB3Wildcard:
    @pytest.mark.asyncio
    async def test_html_when_accept_wildcard(self, client):
        slug = await _create_public_entry(client, slug="b3-test")

        resp = await client.get(f"/{slug}", headers={"Accept": "*/*"})

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")


# ============================================================
# B4: Content Negotiation — browser Accept returns HTML
# ============================================================


class TestB4BrowserAccept:
    @pytest.mark.asyncio
    async def test_html_for_browser_accept(self, client):
        slug = await _create_public_entry(client, slug="b4-test")

        browser_accept = (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/webp,*/*;q=0.8"
        )
        resp = await client.get(f"/{slug}", headers={"Accept": browser_accept})

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")


# ============================================================
# B5: Content Negotiation — text/html present → HTML wins regardless of q
# (SCOPE+ corrected: HTML wins, not JSON)
# ============================================================


class TestB5HtmlWinsOverQ:
    @pytest.mark.asyncio
    async def test_html_wins_despite_lower_q(self, client):
        slug = await _create_public_entry(client, slug="b5-test")

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "application/json;q=0.9, text/html;q=0.8"},
        )

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_html_wins_when_q_equal(self, client):
        slug = await _create_public_entry(client, slug="b5-equal")

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "application/json;q=1.0, text/html;q=1.0"},
        )

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_json_when_html_q_zero(self, client):
        slug = await _create_public_entry(client, slug="b5-html-zero")

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "text/html;q=0, application/json"},
        )

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")


# ============================================================
# B6: Content Negotiation — private entry unauthenticated → 404
# ============================================================


class TestB6PrivateUnauth:
    @pytest.mark.asyncio
    async def test_404_for_private_entry_no_auth(self, client):
        auth = await _register(client, "owner6")
        slug = await _create_private_entry(client, auth["access_token"], slug="b6-private")
        client.cookies.clear()

        resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})

        assert resp.status_code == 404
        body = resp.json()
        assert "error" in body or "detail" in body

    @pytest.mark.asyncio
    async def test_404_matches_raw_behavior(self, client):
        auth = await _register(client, "owner6b")
        slug = await _create_private_entry(client, auth["access_token"], slug="b6b-private")
        client.cookies.clear()

        cn_resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})
        raw_resp = await client.get(f"/api/v1/entries/{slug}/raw")

        assert cn_resp.status_code == 404
        assert raw_resp.status_code == 404


# ============================================================
# B7: Content Negotiation — private entry owner auth → JSON
# ============================================================


class TestB7PrivateOwnerAuth:
    @pytest.mark.asyncio
    async def test_json_for_owner_auth(self, client):
        auth = await _register(client, "owner7")
        slug = await _create_private_entry(client, auth["access_token"], slug="b7-private")
        client.cookies.clear()

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "application/json", **_auth(auth["access_token"])},
        )

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")
        assert resp.json()["slug"] == slug


# ============================================================
# B7b: Content Negotiation — admin auth → JSON for private entry
# ============================================================


class TestB7bAdminAuth:
    @pytest.mark.asyncio
    async def test_json_for_admin_auth(self, client):
        owner_auth = await _register(client, "owner7b")
        admin_auth = await _register(client, "admin7b")
        _make_admin(client._app, "admin7b")

        slug = await _create_private_entry(
            client, owner_auth["access_token"], slug="b7b-private",
        )
        client.cookies.clear()

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "application/json", **_auth(admin_auth["access_token"])},
        )

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")
        assert resp.json()["slug"] == slug


# ============================================================
# B8: Content Negotiation — nonexistent slug → 404 JSON
# ============================================================


class TestB8NonexistentJson:
    @pytest.mark.asyncio
    async def test_404_json_for_nonexistent(self, client):
        resp = await client.get(
            "/nonexistent-slug-b8",
            headers={"Accept": "application/json"},
        )

        assert resp.status_code == 404
        body = resp.json()
        assert "error" in body or "detail" in body


# ============================================================
# B9: Content Negotiation — nonexistent slug HTML → SPA page
# ============================================================


class TestB9NonexistentHtml:
    @pytest.mark.asyncio
    async def test_html_for_nonexistent(self, client):
        resp = await client.get(
            "/nonexistent-slug-b9",
            headers={"Accept": "text/html"},
        )

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")


# ============================================================
# B10: HTML <link> injection — valid slug
# ============================================================


class TestB10LinkInjection:
    @pytest.mark.asyncio
    async def test_link_in_head_for_valid_slug(self, client):
        slug = await _create_public_entry(client, slug="b10-test")

        resp = await client.get(f"/{slug}", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        expected_link = (
            f'<link rel="alternate" type="application/json" '
            f'href="/api/v1/entries/{slug}/raw" />'
        )
        assert expected_link in html


# ============================================================
# B10b: HTML <link> injection — private entry also gets <link>
# ============================================================


class TestB10bPrivateLink:
    @pytest.mark.asyncio
    async def test_link_in_head_for_private_entry(self, client):
        auth = await _register(client, "owner10b")
        slug = await _create_private_entry(
            client, auth["access_token"], slug="b10b-private",
        )

        resp = await client.get(f"/{slug}", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        expected_link = (
            f'<link rel="alternate" type="application/json" '
            f'href="/api/v1/entries/{slug}/raw" />'
        )
        assert expected_link in html

    @pytest.mark.asyncio
    async def test_raw_still_404_without_auth(self, client):
        auth = await _register(client, "owner10b2")
        slug = await _create_private_entry(
            client, auth["access_token"], slug="b10b2-private",
        )
        client.cookies.clear()

        raw_resp = await client.get(f"/api/v1/entries/{slug}/raw")
        assert raw_resp.status_code == 404


# ============================================================
# B11: HTML <link> injection — nonexistent slug → no injection
# ============================================================


class TestB11NoLinkForNonexistent:
    @pytest.mark.asyncio
    async def test_no_link_for_nonexistent(self, client):
        resp = await client.get("/nonexistent-b11", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        assert '<link rel="alternate" type="application/json"' not in html


# ============================================================
# B12: HTML <link> injection — frontend routes → no injection
# ============================================================


class TestB12NoLinkForFrontendRoutes:
    @pytest.mark.asyncio
    async def test_no_link_for_explore(self, client):
        resp = await client.get("/explore", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        assert '<link rel="alternate" type="application/json"' not in html

    @pytest.mark.asyncio
    async def test_no_link_for_settings_apikeys(self, client):
        resp = await client.get("/settings/apikeys", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        assert '<link rel="alternate" type="application/json"' not in html

    @pytest.mark.asyncio
    async def test_no_link_for_users_route(self, client):
        resp = await client.get("/users/someone", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        assert '<link rel="alternate" type="application/json"' not in html

    @pytest.mark.asyncio
    async def test_no_link_for_login(self, client):
        resp = await client.get("/login", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        html = resp.text
        assert '<link rel="alternate" type="application/json"' not in html


# ============================================================
# B13: HTTP Link header — valid slug
# ============================================================


class TestB13LinkHeader:
    @pytest.mark.asyncio
    async def test_link_header_for_valid_slug(self, client):
        slug = await _create_public_entry(client, slug="b13-test")

        resp = await client.get(f"/{slug}", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        link_header = resp.headers.get("link", "")
        expected = f'</api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"'
        assert expected in link_header


# ============================================================
# B13b: HTTP Link header — private entry also gets Link header
# ============================================================


class TestB13bPrivateLinkHeader:
    @pytest.mark.asyncio
    async def test_link_header_for_private_entry(self, client):
        auth = await _register(client, "owner13b")
        slug = await _create_private_entry(
            client, auth["access_token"], slug="b13b-private",
        )

        resp = await client.get(f"/{slug}", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        link_header = resp.headers.get("link", "")
        expected = f'</api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"'
        assert expected in link_header


# ============================================================
# B14: HTTP Link header — nonexistent slug → no Link header
# ============================================================


class TestB14NoLinkHeader:
    @pytest.mark.asyncio
    async def test_no_link_header_for_nonexistent(self, client):
        resp = await client.get("/nonexistent-b14", headers={"Accept": "text/html"})

        assert resp.status_code == 200
        link_header = resp.headers.get("link", "")
        assert "/raw" not in link_header


# ============================================================
# B15: llms.txt — contains /raw and Content Negotiation description
# ============================================================


class TestB15LlmsTxt:
    @pytest.mark.asyncio
    async def test_llms_txt_redirects(self, client):
        resp = await client.get("/llms.txt", follow_redirects=False)

        assert resp.status_code == 302
        location = resp.headers.get("location", "")
        assert "llms.txt" in location


# ============================================================
# B16: End-to-end — Agent gets JSON via Accept header
# ============================================================


class TestB16E2EAcceptJson:
    @pytest.mark.asyncio
    async def test_agent_gets_json_in_one_step(self, client):
        slug = await _create_public_entry(
            client,
            slug="b16-test",
            files=[{"filename": "main.py", "content": "x = 1", "language": "python"}],
        )

        resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")
        data = resp.json()
        assert data["slug"] == slug
        assert len(data["files"]) == 1
        assert data["files"][0]["content"] == "x = 1"


# ============================================================
# B17: End-to-end — Agent discovers /raw via <link>
# ============================================================


class TestB17E2ELinkDiscovery:
    @pytest.mark.asyncio
    async def test_agent_discovers_raw_via_link(self, client):
        slug = await _create_public_entry(
            client,
            slug="b17-test",
            files=[{"filename": "readme.md", "content": "# Hello", "language": "markdown"}],
        )

        html_resp = await client.get(f"/{slug}", headers={"Accept": "*/*"})
        assert html_resp.status_code == 200
        html = html_resp.text
        assert f'/api/v1/entries/{slug}/raw' in html

        raw_resp = await client.get(f"/api/v1/entries/{slug}/raw")
        assert raw_resp.status_code == 200
        data = raw_resp.json()
        assert data["slug"] == slug
        assert len(data["files"]) == 1


# ============================================================
# Edge cases: _prefers_json unit tests
# ============================================================


class TestPrefersJsonUnit:
    @pytest.mark.asyncio
    async def test_missing_accept_returns_html(self, client):
        slug = await _create_public_entry(client, slug="edge-no-accept")

        resp = await client.get(f"/{slug}")

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_malformed_accept_returns_html(self, client):
        slug = await _create_public_entry(client, slug="edge-bad-accept")

        resp = await client.get(f"/{slug}", headers={"Accept": "garbage"})

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_empty_accept_returns_html(self, client):
        slug = await _create_public_entry(client, slug="edge-empty-accept")

        resp = await client.get(f"/{slug}", headers={"Accept": ""})

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_json_only_accept(self, client):
        slug = await _create_public_entry(client, slug="edge-json-only")

        resp = await client.get(f"/{slug}", headers={"Accept": "application/json"})

        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_xhtml_counts_as_html(self, client):
        slug = await _create_public_entry(client, slug="edge-xhtml")

        resp = await client.get(
            f"/{slug}",
            headers={"Accept": "application/xhtml+xml, application/json"},
        )

        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")
