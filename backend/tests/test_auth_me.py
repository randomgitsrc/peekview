import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app


@pytest.fixture
async def me_client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        yield ac


async def _register_user(client: AsyncClient, username="testuser", password="testpass123", display_name=None):
    body: dict = {"username": username, "password": password}
    if display_name is not None:
        body["display_name"] = display_name
    resp = await client.post("/api/v1/auth/register", json=body)
    assert resp.status_code == 201
    return resp.json()["access_token"], resp.json()["user"]


class TestPatchMeAuth:
    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, me_client):
        resp = await me_client.patch("/api/v1/auth/me", json={"display_name": "New Name"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, me_client):
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "New Name"},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestPatchMeValidation:
    @pytest.mark.asyncio
    async def test_display_name_exceeds_64_chars_returns_422(self, me_client):
        token, _ = await _register_user(me_client)
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "A" * 65},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_body_returns_200_with_current_user(self, me_client):
        token, user = await _register_user(me_client, display_name="Original")
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Original"
        assert resp.json()["username"] == user["username"]


class TestPatchMeUpdateDisplayName:
    @pytest.mark.asyncio
    async def test_set_display_name_success(self, me_client):
        token, _ = await _register_user(me_client)
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "Alice Chen"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Alice Chen"

    @pytest.mark.asyncio
    async def test_clear_display_name_with_empty_string(self, me_client):
        token, _ = await _register_user(me_client, display_name="Alice Chen")
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": ""},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] is None

    @pytest.mark.asyncio
    async def test_clear_display_name_with_whitespace_only(self, me_client):
        token, _ = await _register_user(me_client, display_name="Alice Chen")
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "   "},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] is None

    @pytest.mark.asyncio
    async def test_display_name_trimmed(self, me_client):
        token, _ = await _register_user(me_client)
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "  Bob  "},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Bob"

    @pytest.mark.asyncio
    async def test_update_persists_on_get_me(self, me_client):
        token, _ = await _register_user(me_client)
        await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "Updated Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await me_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_response_includes_all_user_fields(self, me_client):
        token, _ = await _register_user(me_client, display_name="Test")
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "New"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "username" in data
        assert "display_name" in data
        assert "is_active" in data
        assert "is_admin" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_display_name_exactly_64_chars_succeeds(self, me_client):
        token, _ = await _register_user(me_client)
        name_64 = "A" * 64
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": name_64},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == name_64

    @pytest.mark.asyncio
    async def test_unicode_display_name(self, me_client):
        token, _ = await _register_user(me_client)
        resp = await me_client.patch(
            "/api/v1/auth/me",
            json={"display_name": "张三"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "张三"


class TestChangePasswordSession:
    @pytest.mark.asyncio
    async def test_change_password_success(self, me_client):
        token, _ = await _register_user(me_client, password="oldpass123")
        resp = await me_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "oldpass123", "new_password": "newpass123"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_change_password_wrong_old_password(self, me_client):
        token, _ = await _register_user(me_client, password="correctpass123")
        resp = await me_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "wrongpass123", "new_password": "newpass123"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401
        assert "incorrect" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_session_valid_after_password_change(self, me_client):
        token, _ = await _register_user(me_client, password="oldpass123")
        await me_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "oldpass123", "new_password": "newpass123"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await me_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_new_too_short(self, me_client):
        token, _ = await _register_user(me_client, password="oldpass123")
        resp = await me_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "oldpass123", "new_password": "short"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
