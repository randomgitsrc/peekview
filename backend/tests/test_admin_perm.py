"""Tests for T005 admin-perm-fix: BUG-1 (file endpoint admin visibility) + IMPL-1 (require_admin)."""

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.auth import require_admin, require_auth, get_current_user
from peekview.exceptions import ForbiddenError, AuthenticationError
from peekview.main import create_app
from peekview.models import User


@pytest.fixture
async def file_client(tmp_path):
    """Async client for testing file endpoint visibility."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        yield ac


@pytest.fixture
async def api_key_client(tmp_path, monkeypatch):
    """Async client with PEEKVIEW_SERVER__API_KEY configured."""
    monkeypatch.setenv("PEEKVIEW_SERVER__API_KEY", "test-global-key")
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        yield ac


async def _setup_users(client):
    """Register admin (first user) + normal user, return (admin_token, user_token)."""
    admin_resp = await client.post("/api/v1/auth/register", json={
        "username": "adminuser",
        "password": "adminpass123",
    })
    admin_token = admin_resp.json()["access_token"]

    user_resp = await client.post("/api/v1/auth/register", json={
        "username": "normaluser",
        "password": "normalpass123",
    })
    user_token = user_resp.json()["access_token"]

    return admin_token, user_token


async def _create_private_entry_with_file(client, token, global_key=None):
    """Create a private entry with a file, return (slug, file_id)."""
    headers = {"Authorization": f"Bearer {token}"}
    if global_key:
        headers["X-API-Key"] = global_key
    resp = await client.post("/api/v1/entries", json={
        "summary": "Private entry",
        "is_public": False,
        "files": [{"filename": "secret.py", "content": "SECRET=42"}],
    }, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    return data["slug"], data["files"][0]["id"]


async def _create_public_entry_with_file(client):
    """Create a public entry with a file, return (slug, file_id)."""
    resp = await client.post("/api/v1/entries", json={
        "summary": "Public entry",
        "files": [{"filename": "readme.md", "content": "# Hello"}],
    })
    assert resp.status_code == 201
    data = resp.json()
    return data["slug"], data["files"][0]["id"]


# --- BUG-1: File endpoint admin visibility --- #

class TestAdminFileDownload:
    """AC-1: Admin can download files from others' private entries."""

    @pytest.mark.asyncio
    async def test_admin_download_private_entry_file(self, file_client):
        admin_token, user_token = await _setup_users(file_client)
        slug, file_id = await _create_private_entry_with_file(file_client, user_token)

        resp = await file_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.content == b"SECRET=42"


class TestAdminFileContent:
    """AC-2: Admin can get file content from others' private entries."""

    @pytest.mark.asyncio
    async def test_admin_get_content_private_entry_file(self, file_client):
        admin_token, user_token = await _setup_users(file_client)
        slug, file_id = await _create_private_entry_with_file(file_client, user_token)

        resp = await file_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}/content",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.text == "SECRET=42"
        assert "Content-Disposition" not in resp.headers


class TestNonOwnerFileAccess:
    """AC-3: Non-admin non-owner cannot access private entry files."""

    @pytest.mark.asyncio
    async def test_normal_user_download_private_file_404(self, file_client):
        _admin_token, user1_token = await _setup_users(file_client)
        user2_resp = await file_client.post("/api/v1/auth/register", json={
            "username": "user2",
            "password": "user2pass123",
        })
        user2_token = user2_resp.json()["access_token"]

        slug, file_id = await _create_private_entry_with_file(file_client, user1_token)

        resp = await file_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}",
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_normal_user_content_private_file_404(self, file_client):
        _admin_token, user1_token = await _setup_users(file_client)
        user2_resp = await file_client.post("/api/v1/auth/register", json={
            "username": "user2b",
            "password": "user2bpass123",
        })
        user2_token = user2_resp.json()["access_token"]

        slug, file_id = await _create_private_entry_with_file(file_client, user1_token)

        resp = await file_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}/content",
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert resp.status_code == 404


class TestAnonymousFileAccess:
    """AC-4: Anonymous cannot access private entry files."""

    @pytest.mark.asyncio
    async def test_anonymous_download_private_file_404(self, file_client):
        _admin_token, user_token = await _setup_users(file_client)
        slug, file_id = await _create_private_entry_with_file(file_client, user_token)

        file_client.cookies.clear()
        resp = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_anonymous_content_private_file_404(self, file_client):
        _admin_token, user_token = await _setup_users(file_client)
        slug, file_id = await _create_private_entry_with_file(file_client, user_token)

        file_client.cookies.clear()
        resp = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert resp.status_code == 404


class TestGlobalApiKeyFileAccess:
    """AC-5: Global API Key can download private entry files."""

    @pytest.mark.asyncio
    async def test_global_api_key_download_private_file(self, api_key_client):
        _admin_token, user_token = await _setup_users(api_key_client)
        slug, file_id = await _create_private_entry_with_file(
            api_key_client, user_token, global_key="test-global-key"
        )

        resp = await api_key_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}",
            headers={"X-API-Key": "test-global-key"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_global_api_key_content_private_file(self, api_key_client):
        _admin_token, user_token = await _setup_users(api_key_client)
        slug, file_id = await _create_private_entry_with_file(
            api_key_client, user_token, global_key="test-global-key"
        )

        resp = await api_key_client.get(
            f"/api/v1/entries/{slug}/files/{file_id}/content",
            headers={"X-API-Key": "test-global-key"},
        )
        assert resp.status_code == 200


class TestPublicEntryFileAccess:
    """AC-6: Public entry file access unaffected."""

    @pytest.mark.asyncio
    async def test_anonymous_download_public_file(self, file_client):
        slug, file_id = await _create_public_entry_with_file(file_client)

        file_client.cookies.clear()
        resp = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_anonymous_content_public_file(self, file_client):
        slug, file_id = await _create_public_entry_with_file(file_client)

        file_client.cookies.clear()
        resp = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert resp.status_code == 200


# --- IMPL-1: require_admin dependency --- #

class TestRequireAdminRejectsNonAdmin:
    """AC-7: require_admin rejects non-admin (403)."""

    def test_require_admin_non_admin_raises_403(self):
        user = User(id=2, username="normal", password_hash="x", is_admin=False, is_active=True)
        with pytest.raises(ForbiddenError) as exc_info:
            require_admin(user)
        assert exc_info.value.status_code == 403
        assert exc_info.value.error_code == "FORBIDDEN"


class TestRequireAdminRejectsUnauthenticated:
    """AC-8: require_admin rejects unauthenticated (401).

    require_admin depends on require_auth, which raises 401 for None.
    The dependency chain is: require_auth(None) → 401 → never reaches require_admin.
    """

    def test_require_auth_rejects_none(self):
        with pytest.raises(AuthenticationError) as exc_info:
            require_auth(None)
        assert exc_info.value.status_code == 401
        assert exc_info.value.error_code == "NOT_AUTHENTICATED"


class TestRequireAdminAllowsAdmin:
    """AC-9: require_admin allows admin through."""

    def test_require_admin_admin_passes(self):
        user = User(id=1, username="admin", password_hash="x", is_admin=True, is_active=True)
        result = require_admin(user)
        assert result is user
        assert result.is_admin is True


class TestExistingEndpointsRegression:
    """AC-10: Existing endpoint behavior unchanged after require_admin addition."""

    @pytest.mark.asyncio
    async def test_entry_crud_still_works(self, file_client):
        create = await file_client.post("/api/v1/entries", json={
            "summary": "Regression test",
            "slug": "regression-test",
        })
        assert create.status_code == 201

        get = await file_client.get("/api/v1/entries/regression-test")
        assert get.status_code == 200

        delete = await file_client.delete("/api/v1/entries/regression-test")
        assert delete.status_code == 200

    @pytest.mark.asyncio
    async def test_auth_endpoints_still_work(self, file_client):
        reg = await file_client.post("/api/v1/auth/register", json={
            "username": "regressionuser",
            "password": "regpass123",
        })
        assert reg.status_code == 201

        login = await file_client.post("/api/v1/auth/login", json={
            "username": "regressionuser",
            "password": "regpass123",
        })
        assert login.status_code == 200

    @pytest.mark.asyncio
    async def test_file_endpoints_still_work(self, file_client):
        create = await file_client.post("/api/v1/entries", json={
            "summary": "File regression",
            "files": [{"filename": "test.py", "content": "pass"}],
        })
        data = create.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        download = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}")
        assert download.status_code == 200

        content = await file_client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content.status_code == 200
