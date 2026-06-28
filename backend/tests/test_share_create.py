"""Tests for share link creation — BDD B01-B06 + implicit cases.

TDD red-light: imports EntryShare, ShareCreateRequest, share_service which
do not exist yet. Tests should fail at import/attribute time, not assertion time.
"""

import hashlib
import re
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
    """Create completely isolated temp directory. Returns (client, app)."""
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
    assert resp.status_code == 201, f"Register failed: {resp.status_code} {resp.text}"
    return resp.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_private_entry(client, auth_token, slug=None, summary="Private entry"):
    data = {"summary": summary, "is_public": False}
    if slug:
        data["slug"] = slug
    resp = await client.post("/api/v1/entries", json=data, headers=_auth(auth_token))
    assert resp.status_code == 201, f"Create entry failed: {resp.text}"
    return resp.json()


async def _create_public_entry(client, auth_token, slug=None, summary="Public entry"):
    data = {"summary": summary, "is_public": True}
    if slug:
        data["slug"] = slug
    resp = await client.post("/api/v1/entries", json=data, headers=_auth(auth_token))
    assert resp.status_code == 201, f"Create entry failed: {resp.text}"
    return resp.json()


async def _create_share(client, auth_token, slug, expires_in="7d", max_views=None):
    body = {"expires_in": expires_in}
    if max_views is not None:
        body["max_views"] = max_views
    return await client.post(
        f"/api/v1/entries/{slug}/shares",
        json=body,
        headers=_auth(auth_token),
    )


# --- B01: Owner creates share link for own private entry ---

class TestCreateShare:

    async def test_b01_owner_creates_share_default(self, client_and_app):
        """B01: Owner creates share with default 7d expiry, unlimited views."""
        client, app = client_and_app
        auth = await _register(client, "alice")
        entry = await _create_private_entry(client, auth["access_token"], slug="my-private")

        resp = await _create_share(client, auth["access_token"], "my-private")
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "share_url" in data, "Response must include share_url"
        assert "?share=" in data["share_url"], "share_url must contain ?share= param"

        token = data["share_url"].split("?share=")[1]
        assert len(token) == 16, f"Token must be 16 chars, got {len(token)}"
        assert re.match(r"^[A-Za-z0-9_-]+$", token), "Token must be URL-safe base64"

        assert data["token_prefix"] == token[:8], "token_prefix must be first 8 chars"
        assert data["max_views"] is None, "Default max_views should be None (unlimited)"
        assert data["view_count"] == 0, "Initial view_count must be 0"
        assert data["revoked_at"] is None, "Initial revoked_at must be None"

        assert data["expires_at"] is not None, "Default 7d expiry should set expires_at"
        expected_expiry = datetime.now(timezone.utc) + timedelta(days=7)
        actual_expiry = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        delta = abs((actual_expiry - expected_expiry).total_seconds())
        assert delta < 60, f"expires_at should be ~7d from now, delta={delta}s"

        assert "token_hash" not in data, "Response must NOT contain token_hash"

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            assert share is not None, "Share record must exist in DB"
            expected_hash = hashlib.sha256(token.encode()).hexdigest()
            assert share.token_hash == expected_hash, "DB must store SHA256 hash, not plaintext"

    async def test_b01_owner_creates_share_1h_expiry(self, client_and_app):
        """B01 variant: 1h expiry."""
        client, _ = client_and_app
        auth = await _register(client, "alice")
        entry = await _create_private_entry(client, auth["access_token"], slug="one-hour")

        resp = await _create_share(client, auth["access_token"], "one-hour", expires_in="1h")
        assert resp.status_code == 201
        data = resp.json()
        assert data["expires_at"] is not None
        expected_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        actual_expiry = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        delta = abs((actual_expiry - expected_expiry).total_seconds())
        assert delta < 60

    async def test_b01_owner_creates_share_with_max_views(self, client_and_app):
        """B01 variant: max_views=10."""
        client, _ = client_and_app
        auth = await _register(client, "alice")
        entry = await _create_private_entry(client, auth["access_token"], slug="limited-views")

        resp = await _create_share(client, auth["access_token"], "limited-views", max_views=10)
        assert resp.status_code == 201
        data = resp.json()
        assert data["max_views"] == 10

    async def test_b01_owner_creates_permanent_share(self, client_and_app):
        """B01 variant: expires_in='0' means permanent (no expiry)."""
        client, _ = client_and_app
        auth = await _register(client, "alice")
        entry = await _create_private_entry(client, auth["access_token"], slug="permanent")

        resp = await _create_share(client, auth["access_token"], "permanent", expires_in="0")
        assert resp.status_code == 201
        data = resp.json()
        assert data["expires_at"] is None, "Permanent share must have expires_at=None"


# --- B02: Non-owner cannot create share link ---

class TestCreateSharePermission:

    async def test_b02_non_owner_cannot_create(self, client_and_app):
        """B02: Non-owner gets 403."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        bob = await _register(client, "bob")
        await _create_private_entry(client, alice["access_token"], slug="alices-private")

        resp = await _create_share(client, bob["access_token"], "alices-private")
        assert resp.status_code == 403

    async def test_b03_anonymous_cannot_create(self, client_and_app):
        """B03: Anonymous gets 401."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="alices-private")

        resp = await client.post(
            "/api/v1/entries/alices-private/shares",
            json={"expires_in": "7d"},
        )
        assert resp.status_code == 401

    async def test_b04_nonexistent_entry(self, client_and_app):
        """B04: Non-existent entry gets 404."""
        client, _ = client_and_app
        auth = await _register(client, "alice")

        resp = await _create_share(client, auth["access_token"], "nonexistent")
        assert resp.status_code == 404

    async def test_b05_expired_entry(self, client_and_app):
        """B05: Cannot create share for expired entry."""
        client, app = client_and_app
        auth = await _register(client, "alice")
        entry = await _create_private_entry(client, auth["access_token"], slug="expired-entry")

        engine = app.state.engine
        with Session(engine) as session:
            from peekview.models import Entry
            e = session.exec(select(Entry).where(Entry.slug == "expired-entry")).first()
            e.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            session.add(e)
            session.commit()

        resp = await _create_share(client, auth["access_token"], "expired-entry")
        assert resp.status_code == 400

    async def test_b08_public_entry_rejected(self, client_and_app):
        """Implicit: Cannot create share for public entry (400)."""
        client, _ = client_and_app
        auth = await _register(client, "alice")
        await _create_public_entry(client, auth["access_token"], slug="public-one")

        resp = await _create_share(client, auth["access_token"], "public-one")
        assert resp.status_code == 400

    async def test_b06_max_shares_limit(self, client_and_app):
        """B06: Max 50 shares per entry."""
        client, app = client_and_app
        auth = await _register(client, "alice")
        await _create_private_entry(client, auth["access_token"], slug="max-shares")

        for i in range(50):
            resp = await _create_share(client, auth["access_token"], "max-shares", expires_in="30d")
            assert resp.status_code == 201, f"Share {i} creation failed: {resp.text}"

        resp = await _create_share(client, auth["access_token"], "max-shares", expires_in="30d")
        assert resp.status_code == 400
