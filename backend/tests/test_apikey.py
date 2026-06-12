"""Tests for API Key management — create, list, revoke, auth."""

import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.models import ApiKey, User, hash_api_key


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


# --- Create API Key ---

class TestCreateApiKey:
    async def test_create_key(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        resp = await client.post("/api/v1/apikeys", json={"name": "CI Bot"}, headers=_auth(auth["access_token"]))
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "CI Bot"
        assert data["key"].startswith("pv_")
        assert len(data["key"]) > 20
        assert data["key_prefix"] == data["key"][:8]
        assert data["expires_at"] is None

    async def test_create_key_with_expiry(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        resp = await client.post("/api/v1/apikeys", json={"name": "Temp", "expires_in": "30d"}, headers=_auth(auth["access_token"]))
        assert resp.status_code == 201
        assert resp.json()["expires_at"] is not None

    async def test_create_key_requires_auth(self, client_and_app):
        client, _ = client_and_app
        resp = await client.post("/api/v1/apikeys", json={"name": "Test"})
        assert resp.status_code == 401

    async def test_create_key_duplicate_name_rejected(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        resp1 = await client.post("/api/v1/apikeys", json={"name": "Bot"}, headers=_auth(t))
        assert resp1.status_code == 201
        resp2 = await client.post("/api/v1/apikeys", json={"name": "Bot"}, headers=_auth(t))
        assert resp2.status_code == 409

    async def test_create_key_max_active_limit(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        for i in range(10):
            resp = await client.post("/api/v1/apikeys", json={"name": f"Key {i}"}, headers=_auth(t))
            assert resp.status_code == 201, f"Key {i} creation failed: {resp.text}"
        resp = await client.post("/api/v1/apikeys", json={"name": "Key 10"}, headers=_auth(t))
        assert resp.status_code == 400

    async def test_create_key_no_hash_in_response(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        data = resp.json()
        assert "key_hash" not in data
        assert "key" in data


# --- List API Keys ---

class TestListApiKeys:
    async def test_list_keys(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        await client.post("/api/v1/apikeys", json={"name": "Key 1"}, headers=_auth(t))
        await client.post("/api/v1/apikeys", json={"name": "Key 2"}, headers=_auth(t))
        resp = await client.get("/api/v1/apikeys", headers=_auth(t))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 2
        for item in items:
            assert "key" not in item
            assert "key_hash" not in item

    async def test_list_keys_requires_auth(self, client_and_app):
        client, _ = client_and_app
        resp = await client.get("/api/v1/apikeys")
        assert resp.status_code == 401

    async def test_list_keys_only_own(self, client_and_app):
        client, _ = client_and_app
        auth_a = await _register(client, "user_a")
        auth_b = await _register(client, "user_b")
        await client.post("/api/v1/apikeys", json={"name": "A Key"}, headers=_auth(auth_a["access_token"]))
        await client.post("/api/v1/apikeys", json={"name": "B Key"}, headers=_auth(auth_b["access_token"]))
        resp_a = await client.get("/api/v1/apikeys", headers=_auth(auth_a["access_token"]))
        assert len(resp_a.json()["items"]) == 1
        assert resp_a.json()["items"][0]["name"] == "A Key"


# --- Revoke API Key ---

class TestRevokeApiKey:
    async def test_revoke_own_key(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(t))
        key_id = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/apikeys/{key_id}", headers=_auth(t))
        assert resp.status_code == 200
        list_resp = await client.get("/api/v1/apikeys", headers=_auth(t))
        assert len(list_resp.json()["items"]) == 0

    async def test_cannot_revoke_others_key(self, client_and_app):
        client, _ = client_and_app
        # Register admin first (gets is_admin=True), then normal users
        await _register(client, "admin_user")
        auth_a = await _register(client, "user_a")
        auth_b = await _register(client, "user_b")
        create_resp = await client.post("/api/v1/apikeys", json={"name": "B Key"}, headers=_auth(auth_b["access_token"]))
        key_id = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/apikeys/{key_id}", headers=_auth(auth_a["access_token"]))
        assert resp.status_code == 403

    async def test_admin_can_revoke_any_key(self, client_and_app):
        client, app = client_and_app
        auth_a = await _register(client, "admin_user")  # First user = admin
        auth_b = await _register(client, "normal_user")
        create_resp = await client.post("/api/v1/apikeys", json={"name": "B Key"}, headers=_auth(auth_b["access_token"]))
        key_id = create_resp.json()["id"]
        resp = await client.delete(f"/api/v1/apikeys/{key_id}", headers=_auth(auth_a["access_token"]))
        assert resp.status_code == 200


# --- Auth with API Key ---

class TestApiKeyAuth:
    async def test_auth_with_key_returns_user(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        user_id = auth["user"]["id"]
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        me_resp = await client.get("/api/v1/auth/me", headers={"X-API-Key": api_key})
        assert me_resp.status_code == 200
        assert me_resp.json()["id"] == user_id

    async def test_auth_with_key_bearer_format(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {api_key}"})
        assert me_resp.status_code == 200

    async def test_create_entry_with_key_binds_owner(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        user_id = auth["user"]["id"]
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        entry_resp = await client.post("/api/v1/entries", json={"summary": "Via API key"}, headers={"X-API-Key": api_key})
        assert entry_resp.status_code == 201
        assert entry_resp.json()["owner_id"] == user_id

    async def test_delete_own_entry_with_key(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        entry_resp = await client.post("/api/v1/entries", json={"summary": "My entry"}, headers={"X-API-Key": api_key})
        slug = entry_resp.json()["slug"]
        del_resp = await client.delete(f"/api/v1/entries/{slug}", headers={"X-API-Key": api_key})
        assert del_resp.status_code == 200

    async def test_cannot_delete_others_entry_with_key(self, client_and_app):
        """P0-2 verification: user-level API key cannot delete other's entries."""
        client, _ = client_and_app
        auth_a = await _register(client, "user_a")
        auth_b = await _register(client, "user_b")
        entry_resp = await client.post("/api/v1/entries", json={"summary": "A's entry", "is_public": True}, headers=_auth(auth_a["access_token"]))
        slug = entry_resp.json()["slug"]
        key_resp = await client.post("/api/v1/apikeys", json={"name": "B Key"}, headers=_auth(auth_b["access_token"]))
        api_key_b = key_resp.json()["key"]
        del_resp = await client.delete(f"/api/v1/entries/{slug}", headers={"X-API-Key": api_key_b})
        assert del_resp.status_code == 404


# --- Expired API Key ---

class TestExpiredApiKey:
    async def test_expired_key_cannot_auth(self, client_and_app):
        client, app = client_and_app
        auth = await _register(client)
        client.cookies.clear()
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Temp", "expires_in": "1m"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        # Expire it in DB
        engine = app.state.engine
        with Session(engine) as session:
            key_record = session.exec(select(ApiKey).where(ApiKey.key_hash == hash_api_key(api_key))).first()
            key_record.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.add(key_record)
            session.commit()
        me_resp = await client.get("/api/v1/auth/me", headers={"X-API-Key": api_key})
        assert me_resp.status_code == 401

    async def test_expired_key_does_not_count_toward_limit(self, client_and_app):
        client, app = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        for i in range(10):
            resp = await client.post("/api/v1/apikeys", json={"name": f"Key {i}", "expires_in": "1m"}, headers=_auth(t))
            assert resp.status_code == 201
        # Expire all in DB
        engine = app.state.engine
        with Session(engine) as session:
            keys = session.exec(select(ApiKey)).all()
            for k in keys:
                k.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
                session.add(k)
            session.commit()
        resp = await client.post("/api/v1/apikeys", json={"name": "New Key"}, headers=_auth(t))
        assert resp.status_code == 201


# --- Inactive User's Key ---

class TestInactiveUserKey:
    async def test_inactive_user_key_cannot_auth(self, client_and_app):
        client, app = client_and_app
        auth = await _register(client)
        user_id = auth["user"]["id"]
        create_resp = await client.post("/api/v1/apikeys", json={"name": "Test"}, headers=_auth(auth["access_token"]))
        api_key = create_resp.json()["key"]
        engine = app.state.engine
        with Session(engine) as session:
            user = session.exec(select(User).where(User.id == user_id)).first()
            user.is_active = False
            session.add(user)
            session.commit()
        me_resp = await client.get("/api/v1/auth/me", headers={"X-API-Key": api_key})
        assert me_resp.status_code == 401


# --- Anonymous Create Control ---

class TestAnonymousCreateControl:
    async def test_anonymous_create_allowed_by_default(self, client_and_app):
        client, _ = client_and_app
        resp = await client.post("/api/v1/entries", json={"summary": "Anon entry"})
        assert resp.status_code == 201

    async def test_anonymous_create_blocked_when_disabled(self, client_and_app):
        """P1-11 verification: global key should still work when anonymous create is disabled."""
        client, app = client_and_app
        app.state.config.auth.allow_anonymous_create = False
        try:
            resp = await client.post("/api/v1/entries", json={"summary": "Anon entry"})
            assert resp.status_code == 401
        finally:
            app.state.config.auth.allow_anonymous_create = True


# --- Cleanup Expired Keys ---

class TestCleanupExpiredKeys:
    async def test_cleanup_expired(self, client_and_app):
        client, app = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        await client.post("/api/v1/apikeys", json={"name": "Temp", "expires_in": "1m"}, headers=_auth(t))
        await client.post("/api/v1/apikeys", json={"name": "Permanent"}, headers=_auth(t))
        # Expire temp key
        engine = app.state.engine
        with Session(engine) as session:
            key = session.exec(select(ApiKey).where(ApiKey.name == "Temp")).first()
            key.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
            session.add(key)
            session.commit()
        resp = await client.delete("/api/v1/apikeys/expired", headers=_auth(t))
        assert resp.status_code == 200
        assert resp.json()["deleted"] == 1
        list_resp = await client.get("/api/v1/apikeys", headers=_auth(t))
        assert len(list_resp.json()["items"]) == 1
        assert list_resp.json()["items"][0]["name"] == "Permanent"


# --- All/Mine Filtering ---

class TestAllMineFilter:
    async def test_owner_me_returns_own_entries(self, client_and_app):
        client, _ = client_and_app
        auth_a = await _register(client, "user_a")
        auth_b = await _register(client, "user_b")
        for i in range(3):
            await client.post("/api/v1/entries", json={"summary": f"A's entry {i}"}, headers=_auth(auth_a["access_token"]))
        await client.post("/api/v1/entries", json={"summary": "B's entry"}, headers=_auth(auth_b["access_token"]))
        resp = await client.get("/api/v1/entries?owner=me", headers=_auth(auth_a["access_token"]))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 3
        assert all(item["owner_id"] == auth_a["user"]["id"] for item in items)

    async def test_owner_me_anonymous_returns_empty(self, client_and_app):
        client, _ = client_and_app
        resp = await client.get("/api/v1/entries?owner=me")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 0
        assert resp.json()["total"] == 0

    async def test_owner_me_with_tags_filter(self, client_and_app):
        client, _ = client_and_app
        auth = await _register(client)
        t = auth["access_token"]
        await client.post("/api/v1/entries", json={"summary": "Python", "tags": ["python"]}, headers=_auth(t))
        await client.post("/api/v1/entries", json={"summary": "Go", "tags": ["go"]}, headers=_auth(t))
        resp = await client.get("/api/v1/entries?owner=me&tags=python", headers=_auth(t))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert "python" in items[0]["tags"]
