"""T011 user management TDD red-light tests (AC1-AC10)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import User


@pytest.fixture
async def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac._app = app
        yield ac


async def _register(client, username, password="pass123456"):
    resp = await client.post("/api/v1/auth/register",
                             json={"username": username, "password": password})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _make_admin(app, username):
    with Session(app.state.engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        user.is_admin = True
        s.add(user)
        s.commit()


async def _create_entry(client, token):
    resp = await client.post("/api/v1/entries",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"summary": "test", "is_public": True,
                                   "files": [{"filename": "f.md", "content": "x"}]})
    assert resp.status_code in (200, 201)
    return resp.json()["slug"]


@pytest.mark.asyncio
async def test_admin_delete_user_cascade(client):
    alice_token = await _register(client, "alice")
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")

    slug = await _create_entry(client, alice_token)
    await client.post("/api/v1/apikeys",
                      headers={"Authorization": f"Bearer {alice_token}"},
                      json={"name": "alice-key"})

    list_resp = await client.get("/api/v1/admin/users?username=alice",
                                 headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    alice_id = list_resp.json()[0]["id"]

    del_resp = await client.delete(f"/api/v1/admin/users/{alice_id}",
                                   headers={"Authorization": f"Bearer {admin_token}"})
    assert del_resp.status_code == 204

    entry_resp = await client.get(f"/api/v1/entries/{slug}",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert entry_resp.status_code == 404

    list_resp2 = await client.get("/api/v1/admin/users?username=alice",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp2.json() == []


@pytest.mark.asyncio
async def test_admin_cannot_delete_self(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")

    with Session(client._app.state.engine) as s:
        admin_id = s.exec(select(User).where(User.username == "adminuser")).first().id

    resp = await client.delete(f"/api/v1/admin/users/{admin_id}",
                               headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "self" in resp.json()["detail"].lower() or "yourself" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unique_admin_delete_self_requires_confirm(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")

    resp1 = await client.delete("/api/v1/auth/me",
                                headers={"Authorization": f"Bearer {admin_token}"})
    assert resp1.status_code == 409
    assert resp1.json()["detail"]["code"] == "last_admin"

    resp2 = await client.delete("/api/v1/auth/me?confirm_username=adminuser",
                                headers={"Authorization": f"Bearer {admin_token}"})
    assert resp2.status_code == 204

    with Session(client._app.state.engine) as s:
        assert s.exec(select(User).where(User.username == "adminuser")).first() is None


@pytest.mark.asyncio
async def test_user_delete_self(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")
    bob_token = await _register(client, "bob")
    slug = await _create_entry(client, bob_token)

    resp = await client.delete("/api/v1/auth/me",
                               headers={"Authorization": f"Bearer {bob_token}"})
    assert resp.status_code == 204

    entry_resp = await client.get(f"/api/v1/entries/{slug}",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert entry_resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_reset_password(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")
    await _register(client, "alice", "oldpass123")

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    resp = await client.post(f"/api/v1/admin/users/{alice_id}/reset-password",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             json={"new_password": "newpass456"})
    assert resp.status_code in (200, 204)

    login_resp = await client.post("/api/v1/auth/login",
                                   json={"username": "alice", "password": "newpass456"})
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_change_password_self(client):
    token = await _register(client, "alice", "oldpass123")

    resp = await client.post("/api/v1/auth/change-password",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"old_password": "oldpass123", "new_password": "newpass456"})
    assert resp.status_code == 204

    bad_login = await client.post("/api/v1/auth/login",
                                  json={"username": "alice", "password": "oldpass123"})
    assert bad_login.status_code == 401

    good_login = await client.post("/api/v1/auth/login",
                                   json={"username": "alice", "password": "newpass456"})
    assert good_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_old(client):
    token = await _register(client, "alice", "oldpass123")

    resp = await client.post("/api/v1/auth/change-password",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"old_password": "wrongpass", "new_password": "newpass456"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_non_admin_cannot_delete_user(client):
    await _register(client, "adminuser")
    bob_token = await _register(client, "bob")
    await _register(client, "alice")

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    resp = await client.delete(f"/api/v1/admin/users/{alice_id}",
                               headers={"Authorization": f"Bearer {bob_token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_users_by_username(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")
    await _register(client, "alice")
    await _register(client, "alicex")

    resp = await client.get("/api/v1/admin/users?username=alice",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["username"] == "alice"


@pytest.mark.asyncio
async def test_delete_user_cleans_disk_files(client):
    admin_token = await _register(client, "adminuser")
    _make_admin(client._app, "adminuser")
    alice_token = await _register(client, "alice")

    await _create_entry(client, alice_token)

    data_dir = client._app.state.config.data_dir
    files_before = list(data_dir.rglob("*.md"))
    assert len(files_before) > 0

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    await client.delete(f"/api/v1/admin/users/{alice_id}",
                        headers={"Authorization": f"Bearer {admin_token}"})

    files_after = list(data_dir.rglob("*.md"))
    assert len(files_after) == 0
