"""Tests for share list — BDD B20-B22 + implicit anonymous case.

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


async def _create_private_entry(client, auth_token, slug=None, summary="Private entry"):
    data = {"summary": summary, "is_public": False}
    if slug:
        data["slug"] = slug
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


# --- B20: Owner lists shares ---

class TestListShares:

    async def test_b20_owner_lists_shares(self, client_and_app):
        """B20: Owner lists all shares (active, expired, revoked) for own entry."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(client, alice["access_token"], slug="list-shares")

        active = await _create_share(client, alice["access_token"], "list-shares", expires_in="7d")
        expired = await _create_share(client, alice["access_token"], "list-shares", expires_in="1h")
        revoked = await _create_share(client, alice["access_token"], "list-shares", expires_in="30d")

        engine = app.state.engine
        with Session(engine) as session:
            shares = session.exec(select(EntryShare)).all()
            for s in shares:
                if s.token_prefix == expired["token_prefix"]:
                    s.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
                elif s.token_prefix == revoked["token_prefix"]:
                    s.revoked_at = datetime.now(timezone.utc)
                session.add(s)
            session.commit()

        resp = await client.get(
            "/api/v1/entries/list-shares/shares",
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200

        data = resp.json()
        assert "shares" in data
        assert "total" in data
        assert data["total"] == 3, f"Expected 3 shares, got {data['total']}"
        assert len(data["shares"]) == 3

        for share in data["shares"]:
            assert "id" in share
            assert "token_prefix" in share
            assert "expires_at" in share
            assert "max_views" in share
            assert "view_count" in share
            assert "revoked_at" in share
            assert "created_at" in share
            assert "token" not in share, "Full token must NOT be in list response"
            assert "token_hash" not in share, "token_hash must NOT be in list response"
            assert "share_url" not in share, "share_url must NOT be in list response"

    async def test_b21_non_owner_cannot_list(self, client_and_app):
        """B21: Non-owner gets 403."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        bob = await _register(client, "bob")
        await _create_private_entry(client, alice["access_token"], slug="alice-private")
        await _create_share(client, alice["access_token"], "alice-private")

        resp = await client.get(
            "/api/v1/entries/alice-private/shares",
            headers=_auth(bob["access_token"]),
        )
        assert resp.status_code == 403

    async def test_b22_admin_can_list_any(self, client_and_app):
        """B22: Admin can list shares for any entry."""
        client, _ = client_and_app
        admin = await _register(client, "admin_user")
        bob = await _register(client, "bob")
        await _create_private_entry(client, bob["access_token"], slug="bob-private")
        await _create_share(client, bob["access_token"], "bob-private")

        resp = await client.get(
            "/api/v1/entries/bob-private/shares",
            headers=_auth(admin["access_token"]),
        )
        assert resp.status_code == 200

    async def test_anonymous_cannot_list(self, client_and_app):
        """Implicit: Anonymous gets 401."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="anon-list")
        await _create_share(client, alice["access_token"], "anon-list")

        client.cookies.clear()
        resp = await client.get("/api/v1/entries/anon-list/shares")
        assert resp.status_code == 401
