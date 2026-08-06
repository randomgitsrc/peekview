"""T080 Admin User Management — TDD red-light tests.

BDD coverage (1:1 mapping):
  BDD-03: admin disable user -> user cannot login
  BDD-04: admin disable user -> existing JWT soft-invalidated (401)
  BDD-05: admin enable user -> user can login
  BDD-06: admin cannot disable self
  BDD-07: admin promote normal user
  BDD-08: admin demote another admin
  BDD-09: last active admin cannot be demoted
  BDD-10: last active admin cannot be disabled
  BDD-11: last active admin cannot be deleted (absolute refuse, incl. confirm_username bypass removed)
  BDD-12: admin reset password -> user logs in with new password
  BDD-13: admin delete user -> cascade (entries/files/apikeys gone)
  BDD-16: non-admin -> /api/v1/admin/* returns 403
  BDD-20: admin cannot demote self (multi-admin scenario)
  BDD-21: admin cannot delete self (admin delete_user path, multi-admin scenario)
  BDD-22: 2 admins -> disable one succeeds
  BDD-23: after BDD-22, remaining sole active admin cannot be disabled/demoted/deleted

All tests are RED in P3 (endpoints/methods not yet implemented).
"""

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
    resp = await client.post(
        "/api/v1/auth/register", json={"username": username, "password": password}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def _make_admin(app, username):
    with Session(app.state.engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        user.is_admin = True
        s.add(user)
        s.commit()
        return user.id


def _get_user_id(app, username):
    with Session(app.state.engine) as s:
        return s.exec(select(User).where(User.username == username)).first().id


def _set_active(app, username, is_active):
    with Session(app.state.engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        user.is_active = is_active
        s.add(user)
        s.commit()


def _create_user_direct(app, username, password="pass123456", is_admin=False):
    from peekview.auth import hash_password

    with Session(app.state.engine) as s:
        user = User(
            username=username,
            password_hash=hash_password(password),
            is_admin=is_admin,
            is_active=True,
        )
        s.add(user)
        s.commit()
        return user.id


# --- BDD-03: admin disable user -> user cannot login --- #


@pytest.mark.asyncio
async def test_bdd_03_admin_disable_user_cannot_login(client):
    admin_token = await _register(client, "adminuser03")
    _make_admin(client._app, "adminuser03")
    await _register(client, "alice03", "alicepass123")

    alice_id = _get_user_id(client._app, "alice03")

    resp = await client.post(
        f"/api/v1/admin/users/{alice_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice03", "password": "alicepass123"},
    )
    assert login_resp.status_code == 401


# --- BDD-04: disabled user's existing JWT soft-invalidated (401) --- #


@pytest.mark.asyncio
async def test_bdd_04_disabled_user_jwt_soft_invalidated(client):
    admin_token = await _register(client, "adminuser04")
    _make_admin(client._app, "adminuser04")
    alice_token = await _register(client, "alice04", "alicepass123")

    me_resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {alice_token}"}
    )
    assert me_resp.status_code == 200

    alice_id = _get_user_id(client._app, "alice04")
    disable_resp = await client.post(
        f"/api/v1/admin/users/{alice_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert disable_resp.status_code == 200

    me_after = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {alice_token}"}
    )
    assert me_after.status_code == 401


# --- BDD-05: admin enable user -> user can login --- #


@pytest.mark.asyncio
async def test_bdd_05_admin_enable_user_can_login(client):
    admin_token = await _register(client, "adminuser05")
    _make_admin(client._app, "adminuser05")
    await _register(client, "alice05", "alicepass123")

    alice_id = _get_user_id(client._app, "alice05")
    await client.post(
        f"/api/v1/admin/users/{alice_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    enable_resp = await client.post(
        f"/api/v1/admin/users/{alice_id}/enable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json()["is_active"] is True

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice05", "password": "alicepass123"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


# --- BDD-06: admin cannot disable self --- #


@pytest.mark.asyncio
async def test_bdd_06_admin_cannot_disable_self(client):
    admin_token = await _register(client, "adminuser06")
    admin_id = _make_admin(client._app, "adminuser06")

    resp = await client.post(
        f"/api/v1/admin/users/{admin_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    msg = resp.json()["error"]["message"].lower()
    assert "last" in msg or "admin" in msg

    with Session(client._app.state.engine) as s:
        admin = s.get(User, admin_id)
        assert admin.is_active is True


# --- BDD-07: admin promote normal user --- #


@pytest.mark.asyncio
async def test_bdd_07_admin_promote_user(client):
    admin_token = await _register(client, "adminuser07")
    _make_admin(client._app, "adminuser07")
    await _register(client, "bob07", "bobpass123")

    bob_id = _get_user_id(client._app, "bob07")

    resp = await client.post(
        f"/api/v1/admin/users/{bob_id}/promote",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_admin"] is True

    with Session(client._app.state.engine) as s:
        assert s.get(User, bob_id).is_admin is True


# --- BDD-08: admin demote another admin --- #


@pytest.mark.asyncio
async def test_bdd_08_admin_demote_another_admin(client):
    admin1_token = await _register(client, "admin1_08")
    _make_admin(client._app, "admin1_08")
    await _register(client, "admin2_08", "admin2pass123")
    _make_admin(client._app, "admin2_08")

    admin2_id = _get_user_id(client._app, "admin2_08")

    resp = await client.post(
        f"/api/v1/admin/users/{admin2_id}/demote",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_admin"] is False

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin2_08", "password": "admin2pass123"},
    )
    admin2_token = login_resp.json()["access_token"]

    admin_endpoint = await client.get(
        "/api/v1/admin/stats", headers={"Authorization": f"Bearer {admin2_token}"}
    )
    assert admin_endpoint.status_code == 403


# --- BDD-09: last active admin cannot be demoted --- #


@pytest.mark.asyncio
async def test_bdd_09_last_active_admin_cannot_demote(client):
    admin_token = await _register(client, "adminuser09")
    admin_id = _make_admin(client._app, "adminuser09")

    resp = await client.post(
        f"/api/v1/admin/users/{admin_id}/demote",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LAST_ADMIN"

    with Session(client._app.state.engine) as s:
        assert s.get(User, admin_id).is_admin is True


# --- BDD-10: last active admin cannot be disabled --- #


@pytest.mark.asyncio
async def test_bdd_10_last_active_admin_cannot_disable(client):
    admin_token = await _register(client, "adminuser10")
    admin_id = _make_admin(client._app, "adminuser10")

    resp = await client.post(
        f"/api/v1/admin/users/{admin_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LAST_ADMIN"

    with Session(client._app.state.engine) as s:
        assert s.get(User, admin_id).is_active is True


# --- BDD-11: last active admin cannot be deleted (absolute refuse) --- #


@pytest.mark.asyncio
async def test_bdd_11_last_admin_delete_self_absolute_refuse(client):
    admin_token = await _register(client, "adminuser11")
    _make_admin(client._app, "adminuser11")

    resp_no_confirm = await client.delete(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_no_confirm.status_code == 409
    assert resp_no_confirm.json()["error"]["code"] == "LAST_ADMIN"

    resp_with_confirm = await client.delete(
        "/api/v1/auth/me?confirm_username=adminuser11",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_with_confirm.status_code == 409
    assert resp_with_confirm.json()["error"]["code"] == "LAST_ADMIN"

    with Session(client._app.state.engine) as s:
        assert s.exec(select(User).where(User.username == "adminuser11")).first() is not None


@pytest.mark.asyncio
async def test_bdd_11_last_admin_admin_delete_other_absolute_refuse(client):
    admin1_token = await _register(client, "admin1_11")
    _make_admin(client._app, "admin1_11")
    await _register(client, "admin2_11", "admin2pass123")
    _make_admin(client._app, "admin2_11")
    admin2_id = _get_user_id(client._app, "admin2_11")

    _set_active(client._app, "admin2_11", False)

    resp = await client.delete(
        f"/api/v1/admin/users/{admin2_id}",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 204
    with Session(client._app.state.engine) as s:
        assert s.get(User, admin2_id) is None


@pytest.mark.asyncio
async def test_bdd_11_last_admin_self_delete_absolute_refuse(client):
    admin_token = await _register(client, "adminuser11b")
    _make_admin(client._app, "adminuser11b")

    resp = await client.delete(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LAST_ADMIN"

    with Session(client._app.state.engine) as s:
        assert s.exec(select(User).where(User.username == "adminuser11b")).first() is not None


# --- BDD-12: admin reset password -> user logs in with new password --- #


@pytest.mark.asyncio
async def test_bdd_12_admin_reset_password(client):
    admin_token = await _register(client, "adminuser12")
    _make_admin(client._app, "adminuser12")
    await _register(client, "carol12", "carolold123")

    carol_id = _get_user_id(client._app, "carol12")

    resp = await client.post(
        f"/api/v1/admin/users/{carol_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpass123"},
    )
    assert resp.status_code in (200, 204), resp.text

    good_login = await client.post(
        "/api/v1/auth/login", json={"username": "carol12", "password": "newpass123"}
    )
    assert good_login.status_code == 200

    bad_login = await client.post(
        "/api/v1/auth/login", json={"username": "carol12", "password": "carolold123"}
    )
    assert bad_login.status_code == 401


# --- BDD-13: admin delete user -> cascade --- #


@pytest.mark.asyncio
async def test_bdd_13_admin_delete_user_cascade(client):
    admin_token = await _register(client, "adminuser13")
    _make_admin(client._app, "adminuser13")
    dave_token = await _register(client, "dave13", "davepass123")

    create_resp = await client.post(
        "/api/v1/entries",
        headers={"Authorization": f"Bearer {dave_token}"},
        json={
            "summary": "dave entry 1",
            "is_public": True,
            "files": [{"filename": "f1.md", "content": "x"}],
        },
    )
    assert create_resp.status_code in (200, 201)
    slug1 = create_resp.json()["slug"]

    create_resp2 = await client.post(
        "/api/v1/entries",
        headers={"Authorization": f"Bearer {dave_token}"},
        json={
            "summary": "dave entry 2",
            "files": [{"filename": "f2.md", "content": "y"}],
        },
    )
    slug2 = create_resp2.json()["slug"]

    await client.post(
        "/api/v1/apikeys",
        headers={"Authorization": f"Bearer {dave_token}"},
        json={"name": "dave-key"},
    )

    dave_id = _get_user_id(client._app, "dave13")

    del_resp = await client.delete(
        f"/api/v1/admin/users/{dave_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_resp.status_code == 204

    assert (await client.get(f"/api/v1/entries/{slug1}")).status_code == 404
    assert (await client.get(f"/api/v1/entries/{slug2}")).status_code == 404

    login_resp = await client.post(
        "/api/v1/auth/login", json={"username": "dave13", "password": "davepass123"}
    )
    assert login_resp.status_code == 401

    list_resp = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    items = list_resp.json().get("items", list_resp.json())
    assert all(u["username"] != "dave13" for u in items)


# --- BDD-16: non-admin -> /api/v1/admin/* returns 403 --- #


@pytest.mark.asyncio
async def test_bdd_16_non_admin_admin_endpoints_403(client):
    await _register(client, "adminuser16")
    _make_admin(client._app, "adminuser16")
    normal_token = await _register(client, "normal16", "normalpass123")
    normal_id = _get_user_id(client._app, "normal16")

    endpoints = [
        ("get", "/api/v1/admin/users"),
        ("get", "/api/v1/admin/stats"),
        ("delete", f"/api/v1/admin/users/{normal_id}"),
        ("post", f"/api/v1/admin/users/{normal_id}/disable"),
        ("post", f"/api/v1/admin/users/{normal_id}/enable"),
        ("post", f"/api/v1/admin/users/{normal_id}/promote"),
        ("post", f"/api/v1/admin/users/{normal_id}/demote"),
        ("post", f"/api/v1/admin/users/{normal_id}/reset-password"),
    ]
    headers = {"Authorization": f"Bearer {normal_token}"}
    for method, path in endpoints:
        if method == "get":
            resp = await client.get(path, headers=headers)
        elif method == "delete":
            resp = await client.delete(path, headers=headers)
        else:
            resp = await client.post(path, headers=headers, json={"new_password": "x12345678"} if "reset-password" in path else None)
        assert resp.status_code == 403, f"{method.upper()} {path} -> {resp.status_code}"


# --- BDD-20: admin cannot demote self (multi-admin) --- #


@pytest.mark.asyncio
async def test_bdd_20_admin_cannot_demote_self(client):
    admin1_token = await _register(client, "admin1_20")
    admin1_id = _make_admin(client._app, "admin1_20")
    await _register(client, "admin2_20", "admin2pass123")
    _make_admin(client._app, "admin2_20")

    resp = await client.post(
        f"/api/v1/admin/users/{admin1_id}/demote",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 400
    msg = resp.json()["error"]["message"].lower()
    assert "self" in msg or "yourself" in msg

    with Session(client._app.state.engine) as s:
        assert s.get(User, admin1_id).is_admin is True


# --- BDD-21: admin cannot delete self (admin delete_user path, multi-admin) --- #


@pytest.mark.asyncio
async def test_bdd_21_admin_cannot_delete_self(client):
    admin1_token = await _register(client, "admin1_21")
    admin1_id = _make_admin(client._app, "admin1_21")
    await _register(client, "admin2_21", "admin2pass123")
    _make_admin(client._app, "admin2_21")

    resp = await client.delete(
        f"/api/v1/admin/users/{admin1_id}",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 400
    msg = resp.json()["error"]["message"].lower()
    assert "self" in msg or "yourself" in msg

    with Session(client._app.state.engine) as s:
        assert s.get(User, admin1_id) is not None


# --- BDD-22: 2 admins -> disable one succeeds --- #


@pytest.mark.asyncio
async def test_bdd_22_two_admins_disable_one_succeeds(client):
    admina_token = await _register(client, "adminA_22")
    _make_admin(client._app, "adminA_22")
    await _register(client, "adminB_22", "adminBpass123")
    _make_admin(client._app, "adminB_22")
    adminb_id = _get_user_id(client._app, "adminB_22")

    resp = await client.post(
        f"/api/v1/admin/users/{adminb_id}/disable",
        headers={"Authorization": f"Bearer {admina_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    with Session(client._app.state.engine) as s:
        b = s.get(User, adminb_id)
        assert b.is_admin is True
        assert b.is_active is False
        assert s.get(User, _get_user_id(client._app, "adminA_22")).is_active is True


# --- BDD-23: after BDD-22, remaining sole active admin protected --- #


@pytest.mark.asyncio
async def test_bdd_23_remaining_sole_admin_protected(client):
    admina_token = await _register(client, "adminA_23")
    admina_id = _make_admin(client._app, "adminA_23")
    await _register(client, "adminB_23", "adminBpass123")
    _make_admin(client._app, "adminB_23")
    adminb_id = _get_user_id(client._app, "adminB_23")

    await client.post(
        f"/api/v1/admin/users/{adminb_id}/disable",
        headers={"Authorization": f"Bearer {admina_token}"},
    )

    disable_resp = await client.post(
        f"/api/v1/admin/users/{admina_id}/disable",
        headers={"Authorization": f"Bearer {admina_token}"},
    )
    assert disable_resp.status_code == 409
    assert disable_resp.json()["error"]["code"] == "LAST_ADMIN"

    demote_resp = await client.post(
        f"/api/v1/admin/users/{admina_id}/demote",
        headers={"Authorization": f"Bearer {admina_token}"},
    )
    assert demote_resp.status_code == 409

    delete_resp = await client.delete(
        f"/api/v1/admin/users/{admina_id}",
        headers={"Authorization": f"Bearer {admina_token}"},
    )
    assert delete_resp.status_code == 409

    with Session(client._app.state.engine) as s:
        a = s.get(User, admina_id)
        assert a.is_active is True
        assert a.is_admin is True


# --- list_users returns UserListResponse {items, total, page, per_page} --- #


@pytest.mark.asyncio
async def test_bdd_01_list_users_returns_paginated_structure(client):
    admin_token = await _register(client, "adminuser_list01")
    _make_admin(client._app, "adminuser_list01")
    for i in range(25):
        _create_user_direct(client._app, f"user{i:02d}_list01", "pass123456")

    resp = await client.get(
        "/api/v1/admin/users?page=1&per_page=20",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 26
    assert data["page"] == 1
    assert data["per_page"] == 20
    assert len(data["items"]) == 20

    resp2 = await client.get(
        "/api/v1/admin/users?page=2&per_page=20",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp2.status_code == 200
    assert len(resp2.json()["items"]) == 6


# --- disabled_at audit field present in UserResponse after disable --- #


@pytest.mark.asyncio
async def test_bdd_02_disable_sets_disabled_at_audit_field(client):
    admin_token = await _register(client, "adminuser_audit02")
    _make_admin(client._app, "adminuser_audit02")
    await _register(client, "alice_audit02", "alicepass123")
    alice_id = _get_user_id(client._app, "alice_audit02")

    resp = await client.post(
        f"/api/v1/admin/users/{alice_id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_active"] is False
    assert body.get("disabled_at") is not None


# --- CRITICAL 1: demote/delete disabled admin succeeds (no LastAdmin trigger) --- #


@pytest.mark.asyncio
async def test_demote_disabled_admin_succeeds(client):
    admin1_token = await _register(client, "admin1_crit1")
    _make_admin(client._app, "admin1_crit1")
    await _register(client, "admin2_crit1", "admin2pass123")
    _make_admin(client._app, "admin2_crit1")
    admin2_id = _get_user_id(client._app, "admin2_crit1")

    _set_active(client._app, "admin2_crit1", False)

    resp = await client.post(
        f"/api/v1/admin/users/{admin2_id}/demote",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_admin"] is False

    with Session(client._app.state.engine) as s:
        u = s.get(User, admin2_id)
        assert u.is_admin is False
        assert u.is_active is False


@pytest.mark.asyncio
async def test_disable_disabled_admin_succeeds(client):
    admin1_token = await _register(client, "admin1_crit1b")
    _make_admin(client._app, "admin1_crit1b")
    await _register(client, "admin2_crit1b", "admin2pass123")
    _make_admin(client._app, "admin2_crit1b")
    admin2_id = _get_user_id(client._app, "admin2_crit1b")

    _set_active(client._app, "admin2_crit1b", False)

    resp = await client.post(
        f"/api/v1/admin/users/{admin2_id}/disable",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# --- CRITICAL 2: delete_user clears disabled_by FK references (no 500) --- #


@pytest.mark.asyncio
async def test_delete_admin_clears_disabled_by_fk(client):
    admin1_token = await _register(client, "admin1_crit2")
    admin1_id = _make_admin(client._app, "admin1_crit2")
    await _register(client, "admin2_crit2", "admin2pass123")
    _make_admin(client._app, "admin2_crit2")
    admin2_token = await _get_login_token(client, "admin2_crit2", "admin2pass123")

    await _register(client, "user_crit2", "userpass123")
    user_id = _get_user_id(client._app, "user_crit2")

    disable_resp = await client.post(
        f"/api/v1/admin/users/{user_id}/disable",
        headers={"Authorization": f"Bearer {admin1_token}"},
    )
    assert disable_resp.status_code == 200

    with Session(client._app.state.engine) as s:
        u = s.get(User, user_id)
        assert u.disabled_by == admin1_id

    del_resp = await client.delete(
        f"/api/v1/admin/users/{admin1_id}",
        headers={"Authorization": f"Bearer {admin2_token}"},
    )
    assert del_resp.status_code == 204

    with Session(client._app.state.engine) as s:
        assert s.get(User, admin1_id) is None
        u = s.get(User, user_id)
        assert u is not None
        assert u.disabled_by is None


async def _get_login_token(client, username, password):
    resp = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]
