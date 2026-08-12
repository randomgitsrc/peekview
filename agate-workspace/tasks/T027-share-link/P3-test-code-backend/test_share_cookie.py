"""Tests for share cookie mechanism — BDD B17-B19.

TDD red-light: imports EntryShare which does not exist yet.
"""

import hashlib
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.models import EntryShare, User


# --- Fixtures ---

@pytest.fixture(scope="function")
async def client_and_app():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        from peekview.main import create_app
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            c.cookies.clear()
            yield c, app
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# --- Helpers ---

async def _register(client, username="testuser", password="testpass123"):
    resp = await client.post("/api/v1/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 201
    return resp.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_private_entry(client, auth_token, slug=None, summary="Private entry", files=None):
    data = {"summary": summary, "is_public": False}
    if slug:
        data["slug"] = slug
    if files:
        data["files"] = files
    resp = await client.post("/api/v1/entries", json=data, headers=_auth(auth_token))
    assert resp.status_code == 201
    return resp.json()


async def _create_share(client, auth_token, slug, expires_in="7d", max_views=None):
    body = {"expires_in": expires_in}
    if max_views is not None:
        body["max_views"] = max_views
    resp = await client.post(
        f"/api/v1/entries/{slug}/shares",
        json=body,
        headers=_auth(auth_token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _get_share_token(client, auth_token, slug, **kwargs):
    data = await _create_share(client, auth_token, slug, **kwargs)
    return data["share_url"].split("?share=")[1]


# --- B17: Valid share token sets cookie ---

class TestShareCookieSetting:

    async def test_b17_share_token_sets_cookie(self, client_and_app):
        """B17: Valid share token sets peekview_share_{entry_id} cookie."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(client, alice["access_token"], slug="cookie-test")
        token = await _get_share_token(client, alice["access_token"], "cookie-test")

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/cookie-test?share={token}")
        assert resp.status_code == 200

        entry_id = entry["id"]
        cookie_name = f"peekview_share_{entry_id}"

        set_cookie_headers = resp.headers.get_list("set-cookie")
        cookie_found = False
        for header in set_cookie_headers:
            if cookie_name in header:
                cookie_found = True
                assert "httponly" in header.lower(), "Cookie must be HttpOnly"
                assert "samesite=lax" in header.lower(), "Cookie must be SameSite=Lax"
                assert "path=/" in header.lower(), "Cookie Path must be /"
                token_prefix = token[:8]
                assert token_prefix in header, f"Cookie value must be token prefix '{token_prefix}'"
        assert cookie_found, f"Cookie '{cookie_name}' must be set in response"

    async def test_b17_permanent_share_cookie_has_max_age(self, client_and_app):
        """B17 variant: Permanent share cookie has large Max-Age (not session cookie)."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(client, alice["access_token"], slug="permanent-cookie")
        token = await _get_share_token(client, alice["access_token"], "permanent-cookie", expires_in="0")

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/permanent-cookie?share={token}")
        assert resp.status_code == 200

        set_cookie_headers = resp.headers.get_list("set-cookie")
        entry_id = entry["id"]
        cookie_name = f"peekview_share_{entry_id}"
        for header in set_cookie_headers:
            if cookie_name in header:
                assert "max-age" in header.lower(), "Permanent share cookie must have Max-Age"


# --- B18: Share cookie enables subsequent access ---

class TestShareCookieAccess:

    async def test_b18_cookie_enables_sub_resource_access(self, client_and_app):
        """B18: Share cookie enables subsequent access without ?share= param."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(
            client, alice["access_token"], slug="cookie-access",
            files=[{"filename": "test.py", "content": "x = 1"}],
        )
        token = await _get_share_token(client, alice["access_token"], "cookie-access")

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/cookie-access?share={token}")
        assert entry_resp.status_code == 200

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/cookie-access/files/{file_id}/content")
        assert content_resp.status_code == 200, "Cookie-based access must work for sub-resources"

    async def test_b18_cookie_enables_entry_access(self, client_and_app):
        """B18 variant: Cookie enables entry detail access (no ?share=)."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(client, alice["access_token"], slug="cookie-entry")
        token = await _get_share_token(client, alice["access_token"], "cookie-entry")

        client.cookies.clear()
        first = await client.get(f"/api/v1/entries/cookie-entry?share={token}")
        assert first.status_code == 200

        second = await client.get("/api/v1/entries/cookie-entry")
        assert second.status_code == 200, "Cookie-based access must work for entry detail"
        data = second.json()
        assert data.get("share_context", {}).get("is_share_access") is True


# --- B19: Revoked/expired share cookie denies access ---

class TestShareCookieRevocation:

    async def test_b19_revoked_cookie_denies_access(self, client_and_app):
        """B19: Revoked share cookie returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(
            client, alice["access_token"], slug="revoked-cookie",
            files=[{"filename": "test.py", "content": "x = 1"}],
        )
        token = await _get_share_token(client, alice["access_token"], "revoked-cookie")

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/revoked-cookie?share={token}")
        assert entry_resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.revoked_at = datetime.now(timezone.utc)
            session.add(share)
            session.commit()

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/revoked-cookie/files/{file_id}/content")
        assert content_resp.status_code == 404

    async def test_b19_expired_cookie_denies_access(self, client_and_app):
        """B19 variant: Expired share cookie returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(
            client, alice["access_token"], slug="expired-cookie",
            files=[{"filename": "test.py", "content": "x = 1"}],
        )
        token = await _get_share_token(client, alice["access_token"], "expired-cookie", expires_in="1h")

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/expired-cookie?share={token}")
        assert entry_resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.add(share)
            session.commit()

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/expired-cookie/files/{file_id}/content")
        assert content_resp.status_code == 404

    async def test_b19_max_views_exceeded_cookie_denies_access(self, client_and_app):
        """B19 variant: Cookie with exceeded max_views returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(
            client, alice["access_token"], slug="maxviews-cookie",
            files=[{"filename": "test.py", "content": "x = 1"}],
        )
        token = await _get_share_token(client, alice["access_token"], "maxviews-cookie", max_views=1)

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/maxviews-cookie?share={token}")
        assert entry_resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.view_count = 1
            session.add(share)
            session.commit()

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/maxviews-cookie/files/{file_id}/content")
        assert content_resp.status_code == 404
