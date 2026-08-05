"""T082 BDD-7~10: 错误格式统一验证测试。

These tests verify that API routes return PeekError format
{"error":{"code":"...","message":"...","details":null}} instead of
HTTPException format {"detail":"..."}.

All tests are RED (failing) because the refactoring (R3) has not been implemented yet.
"""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def auth_client(app):
    """Client with an authenticated user session."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# BDD-7: 所有 API 路由业务错误返回统一格式（无 detail 格式残留）
async def test_bdd_7_no_detail_format_in_api_errors(client):
    """BDD-7: API 错误响应不应包含 {"detail":"..."} 格式."""
    # entries.py:205 — status validation currently returns HTTPException {"detail":"..."}
    resp = await client.get("/api/v1/entries?status=invalid")
    assert resp.status_code == 422
    data = resp.json()
    assert "error" in data, f"BDD-7: response missing 'error' key: {data}"
    assert "code" in data["error"], f"BDD-7: error missing 'code': {data}"
    assert "message" in data["error"], f"BDD-7: error missing 'message': {data}"
    assert "detail" not in data, f"BDD-7: response still has 'detail' key: {data}"


# BDD-8: entries.py list_entries 的 status 参数验证返回 PeekError
async def test_bdd_8_status_validation_returns_peekerror(client):
    """BDD-8: GET /api/v1/entries?status=invalid 返回 PeekError 格式（422）."""
    resp = await client.get("/api/v1/entries?status=invalid")
    assert resp.status_code == 422
    data = resp.json()
    assert "error" in data, f"BDD-8: expected 'error' key, got: {data}"
    assert "code" in data["error"], f"BDD-8: error.code missing: {data}"
    assert data["error"]["code"] != "", "BDD-8: error.code is empty string"
    assert "message" in data["error"], f"BDD-8: error.message missing: {data}"
    assert "detail" not in data, f"BDD-8: still returning 'detail' format: {data}"


# BDD-9: auth.py 端点错误返回 PeekError（change-password old password incorrect）
async def test_bdd_9_auth_endpoint_returns_peekerror(app):
    """BDD-9: PATCH /api/v1/auth/me 或 change-password 错误返回 PeekError 格式."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # First register/login a user
        from sqlmodel import Session, select

        from peekview.auth import hash_password
        from peekview.database import get_engine
        from peekview.models import User

        config = app.state.config
        engine = get_engine(config.db_path)
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "testuser_bdd9")).first()
            if not user:
                user = User(
                    username="testuser_bdd9",
                    password_hash=hash_password("correctpass123"),
                    is_active=True,
                    is_admin=False,
                )
                session.add(user)
                session.commit()
                session.refresh(user)

        # Login to get JWT cookie
        login_resp = await ac.post(
            "/api/v1/auth/login",
            json={"username": "testuser_bdd9", "password": "correctpass123"},
        )
        assert login_resp.status_code == 200

        # Change password with wrong old password — should return PeekError, not HTTPException
        resp = await ac.post(
            "/api/v1/auth/change-password",
            json={"old_password": "wrongpassword", "new_password": "newpass123"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "error" in data, f"BDD-9: expected 'error' key, got: {data}"
        assert "code" in data["error"], f"BDD-9: error.code missing: {data}"
        assert "message" in data["error"], f"BDD-9: error.message missing: {data}"
        assert "detail" not in data, f"BDD-9: still returning 'detail' format: {data}"


# BDD-10: admin.py 端点错误返回 PeekError（ValueError → PeekError）
async def test_bdd_10_admin_endpoint_returns_peekerror(app):
    """BDD-10: admin delete_user with ValueError returns PeekError format."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create an admin user
        from sqlmodel import Session, select

        from peekview.auth import hash_password
        from peekview.database import get_engine
        from peekview.models import User

        config = app.state.config
        engine = get_engine(config.db_path)
        with Session(engine) as session:
            admin = session.exec(select(User).where(User.username == "admin_bdd10")).first()
            if not admin:
                admin = User(
                    username="admin_bdd10",
                    password_hash=hash_password("adminpass123"),
                    is_active=True,
                    is_admin=True,
                )
                session.add(admin)
                session.commit()
                session.refresh(admin)
                admin_id = admin.id
            else:
                admin_id = admin.id

        # Login as admin
        login_resp = await ac.post(
            "/api/v1/auth/login",
            json={"username": "admin_bdd10", "password": "adminpass123"},
        )
        assert login_resp.status_code == 200

        # Try to delete yourself — LastAdmin protection returns 409 (sole admin)
        resp = await ac.delete(f"/api/v1/admin/users/{admin_id}")
        assert resp.status_code == 409
        data = resp.json()
        assert "error" in data, f"BDD-10: expected 'error' key, got: {data}"
        assert "code" in data["error"], f"BDD-10: error.code missing: {data}"
        assert "message" in data["error"], f"BDD-10: error.message missing: {data}"
        assert "detail" not in data, f"BDD-10: still returning 'detail' format: {data}"
