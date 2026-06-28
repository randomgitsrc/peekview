"""Tests for share lifecycle — BDD B26-B29 + implicit cases.

TDD red-light: imports EntryShare which does not exist yet.
"""

import hashlib
import shutil
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.models import EntryShare, Entry, User


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


async def _get_share_token(client, auth_token, slug, **kwargs):
    data = await _create_share(client, auth_token, slug, **kwargs)
    return data["share_url"].split("?share=")[1]


# --- B26: Private→public auto-revokes ---

class TestShareLifecycle:

    async def test_b26_private_to_public_auto_revokes(self, client_and_app):
        """B26: Changing entry from private to public auto-revokes all active shares."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="auto-revoke")

        await _create_share(client, alice["access_token"], "auto-revoke")
        await _create_share(client, alice["access_token"], "auto-revoke")
        await _create_share(client, alice["access_token"], "auto-revoke")

        engine = app.state.engine
        with Session(engine) as session:
            shares = session.exec(select(EntryShare)).all()
            first_share = shares[0]
            first_share.revoked_at = datetime.now(timezone.utc)
            session.add(first_share)
            session.commit()

        resp = await client.patch(
            "/api/v1/entries/auto-revoke",
            json={"is_public": True},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data.get("revoked_shares") == 3, "revoked_shares must count 3 formerly active shares"

        engine = app.state.engine
        with Session(engine) as session:
            shares = session.exec(select(EntryShare)).all()
            all_revoked = all(s.revoked_at is not None for s in shares)
            assert all_revoked, "All shares must have revoked_at set after private→public"

    async def test_b27_public_to_private_preserves_shares(self, client_and_app):
        """B27: Changing entry from public to private preserves shares."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="public-then-private")

        await _create_share(client, alice["access_token"], "public-then-private")

        await client.patch(
            "/api/v1/entries/public-then-private",
            json={"is_public": True},
            headers=_auth(alice["access_token"]),
        )

        engine = app.state.engine
        with Session(engine) as session:
            shares_before = session.exec(select(EntryShare)).all()
            revoked_at_before = {s.id: s.revoked_at for s in shares_before}

        resp = await client.patch(
            "/api/v1/entries/public-then-private",
            json={"is_public": False},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200

        data = resp.json()
        assert data.get("revoked_shares") is None or data.get("revoked_shares") == 0, \
            "public→private must not revoke shares"

        engine = app.state.engine
        with Session(engine) as session:
            shares_after = session.exec(select(EntryShare)).all()
            for s_after in shares_after:
                s_before = revoked_at_before.get(s_after.id)
                assert s_after.revoked_at == s_before, \
                    "Share revoked_at must be unchanged after public→private"

    async def test_b28_entry_delete_cascades_to_shares(self, client_and_app):
        """B28: Deleting entry cascades to delete all share records."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="cascade-delete")

        for i in range(5):
            await _create_share(client, alice["access_token"], "cascade-delete")

        engine = app.state.engine
        with Session(engine) as session:
            count_before = len(session.exec(select(EntryShare)).all())
            assert count_before == 5

        resp = await client.delete(
            "/api/v1/entries/cascade-delete",
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            count_after = len(session.exec(select(EntryShare)).all())
            assert count_after == 0, "All share records must be deleted after entry deletion"

    async def test_b29_view_count_atomic_increment(self, client_and_app):
        """B29: view_count increments atomically under concurrent access."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="atomic-count")
        token = await _get_share_token(client, alice["access_token"], "atomic-count", max_views=100)

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            share.view_count = 50
            session.add(share)
            session.commit()

        results = []
        errors = []

        def access_share():
            import httpx
            try:
                with httpx.Client(transport=ASGITransport(app=app), base_url="http://test") as c:
                    resp = c.get(f"/api/v1/entries/atomic-count?share={token}")
                    results.append(resp.status_code)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=access_share) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        assert len(errors) == 0, f"Thread errors: {errors}"

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            assert share.view_count == 60, \
                f"view_count must be 60 (50+10), got {share.view_count}"

    async def test_view_count_only_increments_on_token_access(self, client_and_app):
        """Implicit: view_count only increments on ?share= access, not cookie-based access."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        entry = await _create_private_entry(
            client, alice["access_token"], slug="cookie-count",
            files=[{"filename": "test.py", "content": "x = 1"}],
        )
        token = await _get_share_token(client, alice["access_token"], "cookie-count")

        client.cookies.clear()
        entry_resp = await client.get(f"/api/v1/entries/cookie-count?share={token}")
        assert entry_resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            assert share.view_count == 1, "view_count must be 1 after first ?share= access"

        file_id = entry_resp.json()["files"][0]["id"]
        content_resp = await client.get(f"/api/v1/entries/cookie-count/files/{file_id}/content")
        assert content_resp.status_code == 200

        engine = app.state.engine
        with Session(engine) as session:
            share = session.exec(select(EntryShare)).first()
            assert share.view_count == 1, "view_count must NOT increment on cookie-based sub-resource access"

    async def test_default_expiry_is_7d(self, client_and_app):
        """Implicit: Default expires_in is 7d per P0 user_decision #2."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="default-expiry")

        resp = await client.post(
            "/api/v1/entries/default-expiry/shares",
            json={},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["expires_at"] is not None, "Default expiry must set expires_at"
        expected = datetime.now(timezone.utc) + timedelta(days=7)
        actual = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        delta = abs((actual - expected).total_seconds())
        assert delta < 60, f"Default expires_at should be ~7d, delta={delta}s"
