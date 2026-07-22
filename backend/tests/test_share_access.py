"""Tests for share token access — BDD B07-B16 + implicit priority cases.

TDD red-light: imports EntryShare, share_service which do not exist yet.
Tests should fail at import/attribute time.
"""

import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.models import EntryShare

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


# --- B07: Valid share token grants access ---

class TestShareTokenAccess:

    async def test_b07_valid_token_grants_access(self, client_and_app):
        """B07: Valid share token grants access to private entry."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="shared-private")
        token = await _get_share_token(client, alice["access_token"], "shared-private")

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/shared-private?share={token}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert data["slug"] == "shared-private"
        assert "share_context" in data, "Response must include share_context"
        assert data["share_context"]["is_share_access"] is True
        assert data["share_context"]["shared_by"] == "alice"

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            assert share.view_count == 1, "view_count must be incremented on first ?share= access"

    async def test_b08_expired_token_denies_access(self, client_and_app):
        """B08: Expired share token returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="expired-share")
        token = await _get_share_token(client, alice["access_token"], "expired-share", expires_in="1h")

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.add(share)
            session.commit()

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/expired-share?share={token}")
        assert resp.status_code == 404

    async def test_b09_revoked_token_denies_access(self, client_and_app):
        """B09: Revoked share token returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="revoked-share")
        token = await _get_share_token(client, alice["access_token"], "revoked-share")

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.revoked_at = datetime.now(timezone.utc)
            session.add(share)
            session.commit()

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/revoked-share?share={token}")
        assert resp.status_code == 404

    async def test_b10_max_views_exceeded_denies_access(self, client_and_app):
        """B10: Share token exceeding max_views returns 404."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="max-views-share")
        token = await _get_share_token(client, alice["access_token"], "max-views-share", max_views=5)

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.view_count = 5
            session.add(share)
            session.commit()

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/max-views-share?share={token}")
        assert resp.status_code == 404

    async def test_b11_expired_entry_blocks_share_access(self, client_and_app):
        """B11: Share token does not grant access to expired entry."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="expired-entry-share")
        token = await _get_share_token(client, alice["access_token"], "expired-entry-share")

        engine = app.state.engine
        with Session(engine) as session:
            from peekview.models import Entry
            e = session.exec(select(Entry).where(Entry.slug == "expired-entry-share")).first()
            e.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            session.add(e)
            session.commit()

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/expired-entry-share?share={token}")
        assert resp.status_code == 404

    async def test_b12_wrong_token_denies_access(self, client_and_app):
        """B12: Invalid (wrong) share token returns 404."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="wrong-token")
        await _get_share_token(client, alice["access_token"], "wrong-token")

        client.cookies.clear()
        resp = await client.get("/api/v1/entries/wrong-token?share=wrong_token_value")
        assert resp.status_code == 404


# --- B13-B16: Share token grants sub-resource access ---

class TestShareSubResourceAccess:

    async def _setup_entry_with_file(self, client, auth_token, slug="file-share"):
        entry = await _create_private_entry(
            client, auth_token, slug=slug,
            files=[{"filename": "hello.py", "content": "print('hello')"}],
        )
        token = await _get_share_token(client, auth_token, slug)
        return entry, token

    async def test_b13_file_content_access(self, client_and_app):
        """B13: Share cookie grants access to file content."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry, token = await self._setup_entry_with_file(client, alice["access_token"])

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/file-share?share={token}")
        assert entry_resp.status_code == 200

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/file-share/files/{file_id}/content")
        assert content_resp.status_code == 200

    async def test_b14_html_render_access(self, client_and_app):
        """B14: Share cookie grants access to HTML render."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(
            client, alice["access_token"], slug="html-share",
            files=[{"filename": "page.html", "content": "<h1>Hello</h1>"}],
        )
        token = await _get_share_token(client, alice["access_token"], "html-share")

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/html-share?share={token}")
        assert entry_resp.status_code == 200

        file_id = entry_resp.json()["files"][0]["id"]
        render_resp = await client.get(f"/api/v1/entries/html-share/files/{file_id}/render")
        assert render_resp.status_code == 200

    async def test_b15_download_access(self, client_and_app):
        """B15: Share cookie grants access to entry download."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry, token = await self._setup_entry_with_file(client, alice["access_token"])

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/file-share?share={token}")
        assert entry_resp.status_code == 200

        download_resp = await client.get("/api/v1/entries/file-share/download")
        assert download_resp.status_code == 200

    async def test_b16_raw_content_access(self, client_and_app):
        """B16: Share cookie grants access to raw content."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry, token = await self._setup_entry_with_file(client, alice["access_token"])

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/file-share?share={token}")
        assert entry_resp.status_code == 200

        raw_resp = await client.get("/api/v1/entries/file-share/raw")
        assert raw_resp.status_code == 200


# --- Implicit: Auth priority over share token ---

class TestShareAuthPriority:

    async def test_owner_access_ignores_share_context(self, client_and_app):
        """Implicit: Owner accessing own entry via share link sees full view (no share_context)."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="owner-share")
        token = await _get_share_token(client, alice["access_token"], "owner-share")

        resp = await client.get(
            f"/api/v1/entries/owner-share?share={token}",
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("share_context") is None or data["share_context"].get("is_share_access") is not True

    async def test_admin_access_ignores_share_context(self, client_and_app):
        """Implicit: Admin accessing private entry sees full view (no share_context)."""
        client, _ = client_and_app
        admin = await _register(client, "admin_user")
        bob = await _register(client, "bob")
        await _create_private_entry(client, bob["access_token"], slug="admin-share")
        token = await _get_share_token(client, bob["access_token"], "admin-share")

        resp = await client.get(
            f"/api/v1/entries/admin-share?share={token}",
            headers=_auth(admin["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("share_context") is None or data["share_context"].get("is_share_access") is not True

    async def test_public_entry_ignores_share_param(self, client_and_app):
        """Implicit: Public entry ignores share param (no share_context)."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        resp = await client.post(
            "/api/v1/entries",
            json={"summary": "Public", "is_public": True, "slug": "public-share"},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 201

        client.cookies.clear()
        resp = await client.get("/api/v1/entries/public-share?share=some_token")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("share_context") is None or data["share_context"].get("is_share_access") is not True
