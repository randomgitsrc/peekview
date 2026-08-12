"""Tests for share revocation — BDD B23-B25.

TDD red-light: imports EntryShare which does not exist yet.
"""

import shutil
import tempfile
from datetime import datetime, timezone
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


# --- B23: Owner revokes specific shares ---

class TestRevokeShares:

    async def test_b23_owner_revokes_specific_shares(self, client_and_app):
        """B23: Owner revokes specific shares, others remain active."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="revoke-test")

        s1 = await _create_share(client, alice["access_token"], "revoke-test")
        s2 = await _create_share(client, alice["access_token"], "revoke-test")
        s3 = await _create_share(client, alice["access_token"], "revoke-test")

        resp = await client.post(
            "/api/v1/entries/revoke-test/shares/revoke",
            json={"share_ids": [s1["id"], s3["id"]]},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["revoked_count"] == 2

        engine = app.state.engine
        with Session(engine) as session:
            share_1 = session.exec(select(EntryShare).where(EntryShare.id == s1["id"])).first()
            share_2 = session.exec(select(EntryShare).where(EntryShare.id == s2["id"])).first()
            share_3 = session.exec(select(EntryShare).where(EntryShare.id == s3["id"])).first()
            assert share_1.revoked_at is not None, "Share 1 must be revoked"
            assert share_2.revoked_at is None, "Share 2 must remain active"
            assert share_3.revoked_at is not None, "Share 3 must be revoked"

    async def test_b24_non_owner_cannot_revoke(self, client_and_app):
        """B24: Non-owner gets 403."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        bob = await _register(client, "bob")
        await _create_private_entry(client, alice["access_token"], slug="alice-revoke")
        share = await _create_share(client, alice["access_token"], "alice-revoke")

        resp = await client.post(
            "/api/v1/entries/alice-revoke/shares/revoke",
            json={"share_ids": [share["id"]]},
            headers=_auth(bob["access_token"]),
        )
        assert resp.status_code == 403

    async def test_b25_nonexistent_share_id_ignored(self, client_and_app):
        """B25: Revoking non-existent share ids is ignored."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="ignore-id")
        share = await _create_share(client, alice["access_token"], "ignore-id")

        resp = await client.post(
            "/api/v1/entries/ignore-id/shares/revoke",
            json={"share_ids": [share["id"], 99999]},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["revoked_count"] == 1

    async def test_revoke_already_revoked_is_idempotent(self, client_and_app):
        """B25 variant: Revoking already-revoked shares returns revoked_count=0."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="idempotent")
        share = await _create_share(client, alice["access_token"], "idempotent")

        await client.post(
            "/api/v1/entries/idempotent/shares/revoke",
            json={"share_ids": [share["id"]]},
            headers=_auth(alice["access_token"]),
        )

        resp = await client.post(
            "/api/v1/entries/idempotent/shares/revoke",
            json={"share_ids": [share["id"]]},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["revoked_count"] == 0, "Already-revoked shares should not be counted"
