"""Tests for authentication and entry visibility.

Tests cover:
- Password hashing (bcrypt)
- JWT token creation and validation
- Auth API endpoints (register, login, logout, me)
- Entry visibility filtering (anonymous vs authenticated)
- Owner-only operations (update visibility, delete)
- Reserved usernames and registration validation
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
    _load_or_generate_secret_key,
)
from peekview.models import Entry, User


# --- Password hashing tests --- #

class TestPasswordHashing:
    """Test bcrypt password hashing."""

    def test_hash_password(self):
        """Password hash should be bcrypt format."""
        h = hash_password("testpassword123")
        assert h.startswith("$2b$12$")

    def test_verify_password_correct(self):
        """Correct password should verify."""
        h = hash_password("mypassword123")
        assert verify_password("mypassword123", h)

    def test_verify_password_wrong(self):
        """Wrong password should not verify."""
        h = hash_password("mypassword123")
        assert not verify_password("wrongpassword", h)

    def test_hash_different_each_time(self):
        """Same password should produce different hashes (different salts)."""
        h1 = hash_password("samepassword")
        h2 = hash_password("samepassword")
        assert h1 != h2
        # But both should verify
        assert verify_password("samepassword", h1)
        assert verify_password("samepassword", h2)


# --- JWT tests --- #

class TestJWT:
    """Test JWT token creation and validation."""

    def test_create_token(self):
        """Token should contain user_id as string sub."""
        secret = "test-secret-key"
        token = create_access_token(1, secret, expire_days=7)
        payload = decode_access_token(token, secret)
        assert payload is not None
        assert payload["sub"] == "1"
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_invalid_token(self):
        """Invalid token should return None."""
        result = decode_access_token("invalid.token.here", "test-secret-key")
        assert result is None

    def test_decode_wrong_secret(self):
        """Token decoded with wrong secret should return None."""
        secret = "test-secret-key"
        token = create_access_token(1, secret, expire_days=7)
        result = decode_access_token(token, "wrong-secret")
        assert result is None

    def test_sub_is_string(self):
        """JWT sub claim must be string (per JWT spec)."""
        secret = "test-secret-key"
        token = create_access_token(42, secret)
        payload = decode_access_token(token, secret)
        assert payload["sub"] == "42"

    def test_secret_key_from_config(self):
        """Config secret key should be used when provided."""
        key = _load_or_generate_secret_key("my-config-secret")
        assert key == "my-config-secret"


# --- Auth API endpoint tests --- #

@pytest.fixture
async def auth_client(tmp_path):
    """Async client for testing auth endpoints."""
    from peekview.main import create_app

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"

    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        yield ac


class TestRegister:
    """Test POST /api/v1/auth/register."""

    @pytest.mark.asyncio
    async def test_register_first_user(self, auth_client):
        """First user registration should succeed."""
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "alice",
            "password": "alicepass123",
            "display_name": "Alice",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "alice"
        assert data["user"]["display_name"] == "Alice"

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, auth_client):
        """Duplicate username should fail with generic error."""
        # Register first user
        await auth_client.post("/api/v1/auth/register", json={
            "username": "bob",
            "password": "bobpass123",
        })
        # Try duplicate
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "bob",
            "password": "anotherpass123",
        })
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "REGISTRATION_FAILED"

    @pytest.mark.asyncio
    async def test_register_reserved_username(self, auth_client):
        """Reserved usernames should be rejected (Pydantic validation)."""
        for name in ["default", "system", "admin"]:
            resp = await auth_client.post("/api/v1/auth/register", json={
                "username": name,
                "password": "somepassword123",
            })
            assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_username(self, auth_client):
        """Username < 3 chars should fail validation."""
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "ab",
            "password": "validpassword123",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_password(self, auth_client):
        """Password < 8 chars should fail validation."""
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "validuser",
            "password": "short",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_without_display_name(self, auth_client):
        """Registration without display_name should succeed."""
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "simple",
            "password": "simplepass123",
        })
        assert resp.status_code == 201
        assert resp.json()["user"]["display_name"] is None


class TestLogin:
    """Test POST /api/v1/auth/login."""

    @pytest.mark.asyncio
    async def test_login_success(self, auth_client):
        """Login with correct credentials should return JWT."""
        # Register first
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "logintest",
            "password": "loginpass123",
        })
        assert reg.status_code == 201

        # Login
        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "logintest",
            "password": "loginpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["username"] == "logintest"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, auth_client):
        """Wrong password should return INVALID_CREDENTIALS."""
        await auth_client.post("/api/v1/auth/register", json={
            "username": "wrongpw",
            "password": "correctpass123",
        })
        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "wrongpw",
            "password": "incorrectpass123",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, auth_client):
        """Nonexistent username should return INVALID_CREDENTIALS (no enumeration)."""
        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "ghost_user",
            "password": "whatever123",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


class TestLogout:
    """Test POST /api/v1/auth/logout."""

    @pytest.mark.asyncio
    async def test_logout_returns_204(self, auth_client):
        """Logout should return 204 No Content."""
        resp = await auth_client.post("/api/v1/auth/logout")
        assert resp.status_code == 204


class TestGetMe:
    """Test GET /api/v1/auth/me."""

    @pytest.mark.asyncio
    async def test_me_with_valid_token(self, auth_client):
        """Authenticated user should see their info."""
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "meuser",
            "password": "mepass123",
            "display_name": "Me User",
        })
        token = reg.json()["access_token"]

        resp = await auth_client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == "meuser"
        assert resp.json()["display_name"] == "Me User"

    @pytest.mark.asyncio
    async def test_me_without_token(self, auth_client):
        """Unauthenticated request should return 401."""
        resp = await auth_client.get("/api/v1/auth/me")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "NOT_AUTHENTICATED"

    @pytest.mark.asyncio
    async def test_me_with_invalid_token(self, auth_client):
        """Invalid JWT should return 401."""
        resp = await auth_client.get("/api/v1/auth/me", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert resp.status_code == 401


# --- Entry visibility tests --- #

@pytest.fixture
async def visibility_client(tmp_path):
    """Async client for testing entry visibility (no API key = dev mode)."""
    from peekview.main import create_app

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"

    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        yield ac


class TestEntryVisibility:
    """Test entry visibility filtering."""

    @pytest.mark.asyncio
    async def test_anonymous_sees_only_public(self, visibility_client):
        """Anonymous user should only see public entries."""
        # Register user
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "owner",
            "password": "ownerpass123",
        })
        token = reg.json()["access_token"]

        # Create public entry (anonymous)
        await visibility_client.post("/api/v1/entries", json={
            "summary": "Public from anon",
        })

        # Create private entry (authenticated)
        await visibility_client.post("/api/v1/entries", json={
            "summary": "Private entry",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})

        # List as anonymous (clear cookie jar to ensure no auth)
        visibility_client.cookies.clear()
        resp = await visibility_client.get("/api/v1/entries")
        data = resp.json()
        assert data["total"] == 1
        assert all(i["is_public"] for i in data["items"])

    @pytest.mark.asyncio
    async def test_authenticated_sees_own_private(self, visibility_client):
        """Authenticated user should see their own private entries."""
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "owner",
            "password": "ownerpass123",
        })
        token = reg.json()["access_token"]

        # Create public + private entries
        await visibility_client.post("/api/v1/entries", json={
            "summary": "Public entry",
        }, headers={"Authorization": f"Bearer {token}"})

        await visibility_client.post("/api/v1/entries", json={
            "summary": "Private entry",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})

        # List as authenticated
        resp = await visibility_client.get("/api/v1/entries", headers={
            "Authorization": f"Bearer {token}",
        })
        data = resp.json()
        assert data["total"] == 2
        public_items = [i for i in data["items"] if i["is_public"]]
        private_items = [i for i in data["items"] if not i["is_public"]]
        assert len(public_items) == 1
        assert len(private_items) == 1
        assert private_items[0]["owner_id"] == 1

    @pytest.mark.asyncio
    async def test_cannot_view_others_private(self, visibility_client):
        """User should not see another user's private entry (404)."""
        # Register two users
        reg1 = await visibility_client.post("/api/v1/auth/register", json={
            "username": "user1",
            "password": "user1pass123",
        })
        token1 = reg1.json()["access_token"]

        reg2 = await visibility_client.post("/api/v1/auth/register", json={
            "username": "user2",
            "password": "user2pass123",
        })
        token2 = reg2.json()["access_token"]

        # User1 creates private entry
        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "User1 private",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token1}"})
        slug = resp.json()["slug"]

        # User2 tries to view it — should get 404
        resp = await visibility_client.get(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {token2}",
        })
        assert resp.status_code == 404

        # Anonymous tries to view it — should get 404
        resp = await visibility_client.get(f"/api/v1/entries/{slug}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_can_view_own_private(self, visibility_client):
        """Owner should be able to view their own private entry."""
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "owner",
            "password": "ownerpass123",
        })
        token = reg.json()["access_token"]

        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "My private",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})
        slug = resp.json()["slug"]

        # Owner can view their own private entry
        resp = await visibility_client.get(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["is_public"] is False
        assert resp.json()["owner_id"] == 1


class TestOwnerControls:
    """Test owner-only entry operations."""

    @pytest.mark.asyncio
    async def test_toggle_visibility(self, visibility_client):
        """Owner should be able to toggle entry visibility."""
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "owner",
            "password": "ownerpass123",
        })
        token = reg.json()["access_token"]

        # Create private entry
        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "Toggle test",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})
        slug = resp.json()["slug"]

        # Toggle to public
        resp = await visibility_client.patch(f"/api/v1/entries/{slug}", json={
            "is_public": True,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["is_public"] is True

        # Toggle back to private
        resp = await visibility_client.patch(f"/api/v1/entries/{slug}", json={
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["is_public"] is False

    @pytest.mark.asyncio
    async def test_non_owner_cannot_toggle(self, visibility_client):
        """Non-owner should not be able to toggle visibility (returns 404 for non-visible or 403 for visible)."""
        reg1 = await visibility_client.post("/api/v1/auth/register", json={
            "username": "user1",
            "password": "user1pass123",
        })
        token1 = reg1.json()["access_token"]

        reg2 = await visibility_client.post("/api/v1/auth/register", json={
            "username": "user2",
            "password": "user2pass123",
        })
        token2 = reg2.json()["access_token"]

        # User1 creates public entry
        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "User1 public",
        }, headers={"Authorization": f"Bearer {token1}"})
        slug = resp.json()["slug"]

        # User2 tries to toggle — should fail (403 for public entry they can see)
        resp = await visibility_client.patch(f"/api/v1/entries/{slug}", json={
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token2}"})
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_owner_can_delete(self, visibility_client):
        """Owner should be able to delete their own entry."""
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "owner",
            "password": "ownerpass123",
        })
        token = reg.json()["access_token"]

        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "Delete test",
        }, headers={"Authorization": f"Bearer {token}"})
        slug = resp.json()["slug"]

        # Owner deletes
        resp = await visibility_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_delete_private_entry(self, visibility_client):
        """Owner can delete their own private entry."""
        reg = await visibility_client.post("/api/v1/auth/register", json={
            "username": "privowner",
            "password": "privpass123",
        })
        token = reg.json()["access_token"]

        resp = await visibility_client.post("/api/v1/entries", json={
            "summary": "Private delete",
            "is_public": False,
        }, headers={"Authorization": f"Bearer {token}"})
        slug = resp.json()["slug"]

        resp = await visibility_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200


class TestAdminRole:
    """Test admin role functionality."""

    @pytest.mark.asyncio
    async def test_first_user_is_admin(self, auth_client):
        """First registered user should automatically be admin."""
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "firstadmin",
            "password": "adminpass123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["is_admin"] is True

    @pytest.mark.asyncio
    async def test_second_user_is_not_admin(self, auth_client):
        """Second registered user should not be admin."""
        await auth_client.post("/api/v1/auth/register", json={
            "username": "firstadmin2",
            "password": "adminpass123",
        })
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "seconduser",
            "password": "secondpass123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["is_admin"] is False

    @pytest.mark.asyncio
    async def test_admin_can_update_any_entry(self, auth_client):
        """Admin should be able to update entries they don't own."""
        # Register admin (first user)
        admin_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest1",
            "password": "adminpass123",
        })
        admin_token = admin_resp.json()["access_token"]

        # Register another user
        user_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normaltest1",
            "password": "normalpass123",
        })
        user_token = user_resp.json()["access_token"]

        # User creates a private entry
        create_resp = await auth_client.post("/api/v1/entries", json={
            "summary": "User private",
            "is_public": False,
            "files": [{"filename": "x.py", "content": "x=1"}],
        }, headers={"Authorization": f"Bearer {user_token}"})
        slug = create_resp.json()["slug"]

        # Admin can toggle visibility
        resp = await auth_client.patch(f"/api/v1/entries/{slug}", json={
            "is_public": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["is_public"] is True

    @pytest.mark.asyncio
    async def test_admin_can_delete_any_entry(self, auth_client):
        """Admin should be able to delete entries they don't own."""
        # Register admin (first user)
        admin_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest2",
            "password": "adminpass123",
        })
        admin_token = admin_resp.json()["access_token"]

        # Register another user
        user_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normaltest2",
            "password": "normalpass123",
        })
        user_token = user_resp.json()["access_token"]

        # User creates entry
        create_resp = await auth_client.post("/api/v1/entries", json={
            "summary": "User entry to delete",
            "files": [{"filename": "y.py", "content": "y=2"}],
        }, headers={"Authorization": f"Bearer {user_token}"})
        slug = create_resp.json()["slug"]

        # Admin can delete
        resp = await auth_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {admin_token}",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_delete_ownerless_entry(self, auth_client):
        """Admin should be able to delete entries with owner_id=NULL."""
        # Register admin (first user)
        admin_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest3",
            "password": "adminpass123",
        })
        admin_token = admin_resp.json()["access_token"]

        # Create anonymous entry (no auth header)
        create_resp = await auth_client.post("/api/v1/entries", json={
            "summary": "Anonymous entry",
            "files": [{"filename": "z.py", "content": "z=3"}],
        })
        slug = create_resp.json()["slug"]

        # Admin can delete ownerless entry
        resp = await auth_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {admin_token}",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_view_all_private_entries(self, auth_client):
        """Admin should see all entries including other users' private entries."""
        # Register admin (first user)
        admin_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest4",
            "password": "adminpass123",
        })
        admin_token = admin_resp.json()["access_token"]

        # Register another user with private entry
        user_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normaltest4",
            "password": "normalpass123",
        })
        user_token = user_resp.json()["access_token"]

        await auth_client.post("/api/v1/entries", json={
            "summary": "Other user private",
            "is_public": False,
            "files": [{"filename": "p.py", "content": "p=4"}],
        }, headers={"Authorization": f"Bearer {user_token}"})

        # Admin list should include the private entry
        resp = await auth_client.get("/api/v1/entries", headers={
            "Authorization": f"Bearer {admin_token}",
        })
        data = resp.json()
        found = any(i["summary"] == "Other user private" for i in data["items"])
        assert found is True

    @pytest.mark.asyncio
    async def test_non_admin_cannot_manage_others_entry(self, auth_client):
        """Non-admin user should not be able to manage another user's entry."""
        # Register admin (first user)
        await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest5",
            "password": "adminpass123",
        })

        # Register two normal users
        user1_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normal5a",
            "password": "normalpass123",
        })
        user1_token = user1_resp.json()["access_token"]

        user2_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normal5b",
            "password": "normalpass123",
        })
        user2_token = user2_resp.json()["access_token"]

        # User1 creates entry
        create_resp = await auth_client.post("/api/v1/entries", json={
            "summary": "User1 entry",
            "files": [{"filename": "a.py", "content": "a=5"}],
        }, headers={"Authorization": f"Bearer {user1_token}"})
        slug = create_resp.json()["slug"]

        # User2 cannot toggle visibility
        resp = await auth_client.patch(f"/api/v1/entries/{slug}", json={
            "is_public": False,
        }, headers={"Authorization": f"Bearer {user2_token}"})
        assert resp.status_code in (403, 404)

        # User2 cannot delete
        resp = await auth_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {user2_token}",
        })
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_non_admin_cannot_delete_ownerless_entry(self, auth_client):
        """Non-admin user should not be able to delete owner_id=NULL entries."""
        # Register admin (first user)
        await auth_client.post("/api/v1/auth/register", json={
            "username": "admintest6",
            "password": "adminpass123",
        })

        # Register normal user
        user_resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "normaltest6",
            "password": "normalpass123",
        })
        user_token = user_resp.json()["access_token"]

        # Create anonymous entry (clear cookie jar first)
        auth_client.cookies.clear()
        create_resp = await auth_client.post("/api/v1/entries", json={
            "summary": "Anonymous entry 6",
            "files": [{"filename": "b.py", "content": "b=6"}],
        })
        slug = create_resp.json()["slug"]

        # Normal user cannot delete
        resp = await auth_client.delete(f"/api/v1/entries/{slug}", headers={
            "Authorization": f"Bearer {user_token}",
        })
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_login_returns_is_admin(self, auth_client):
        """Login response should include is_admin field."""
        await auth_client.post("/api/v1/auth/register", json={
            "username": "loginadmintest",
            "password": "adminpass123",
        })
        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "loginadmintest",
            "password": "adminpass123",
        })
        assert resp.status_code == 200
        assert "is_admin" in resp.json()["user"]
        assert resp.json()["user"]["is_admin"] is True

    @pytest.mark.asyncio
    async def test_me_returns_is_admin(self, auth_client):
        """GET /auth/me should include is_admin field."""
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "meadmintest",
            "password": "adminpass123",
        })
        token = reg.json()["access_token"]
        resp = await auth_client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is True


# --- Cookie authentication tests --- #

class TestCookieAuth:
    """Test httpOnly Cookie-based JWT authentication."""

    @pytest.mark.asyncio
    async def test_login_sets_cookie(self, auth_client: AsyncClient):
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "cookieuser", "password": "pw123456",
        })
        assert reg.status_code == 201

        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "cookieuser", "password": "pw123456",
        })
        assert resp.status_code == 200
        set_cookie = resp.headers.get("set-cookie", "")
        assert "peekview_token=" in set_cookie
        assert "httponly" in set_cookie.lower()
        assert "samesite=lax" in set_cookie.lower()
        assert "path=/" in set_cookie.lower()

    @pytest.mark.asyncio
    async def test_register_sets_cookie(self, auth_client: AsyncClient):
        resp = await auth_client.post("/api/v1/auth/register", json={
            "username": "regcookie", "password": "pw123456",
        })
        assert resp.status_code == 201
        set_cookie = resp.headers.get("set-cookie", "")
        assert "peekview_token=" in set_cookie

    @pytest.mark.asyncio
    async def test_logout_clears_cookie(self, auth_client: AsyncClient):
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "logoutcookie", "password": "pw123456",
        })
        token = reg.json()["access_token"]

        resp = await auth_client.post("/api/v1/auth/logout", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 204
        set_cookie_headers = resp.headers.get_list("set-cookie")
        assert any("peekview_token" in h and ('Max-Age=0' in h or 'max-age=0' in h) for h in set_cookie_headers)

    @pytest.mark.asyncio
    async def test_cookie_authenticates_request(self, auth_client: AsyncClient):
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "cookieauth", "password": "pw123456",
        })
        token = reg.json()["access_token"]

        resp = await auth_client.get("/api/v1/auth/me", cookies={
            "peekview_token": token,
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == "cookieauth"

    @pytest.mark.asyncio
    async def test_header_jwt_takes_priority_over_cookie(self, auth_client: AsyncClient):
        reg_a = await auth_client.post("/api/v1/auth/register", json={
            "username": "userA", "password": "pw123456",
        })
        token_a = reg_a.json()["access_token"]

        reg_b = await auth_client.post("/api/v1/auth/register", json={
            "username": "userB", "password": "pw123456",
        })
        token_b = reg_b.json()["access_token"]

        resp = await auth_client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {token_a}",
        }, cookies={
            "peekview_token": token_b,
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == "userA"

    @pytest.mark.asyncio
    async def test_expired_cookie_returns_anonymous(self, auth_client: AsyncClient):
        config = auth_client._transport.app.state.config
        secret_key = _load_or_generate_secret_key(config.auth.secret_key)
        expired_token = create_access_token(user_id=9999, secret_key=secret_key, expire_days=-1)

        resp = await auth_client.get("/api/v1/auth/me", cookies={
            "peekview_token": expired_token,
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_cookie_returns_anonymous(self, auth_client: AsyncClient):
        resp = await auth_client.get("/api/v1/auth/me", cookies={
            "peekview_token": "invalid.jwt.token",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_cookie_max_age_matches_config(self, auth_client: AsyncClient):
        await auth_client.post("/api/v1/auth/register", json={
            "username": "maxageuser", "password": "pw123456",
        })
        resp = await auth_client.post("/api/v1/auth/login", json={
            "username": "maxageuser", "password": "pw123456",
        })
        config = auth_client._transport.app.state.config
        expected_max_age = config.auth.token_expire_days * 86400
        set_cookie = resp.headers.get("set-cookie", "")
        assert f"max-age={expected_max_age}" in set_cookie.lower()

    @pytest.mark.asyncio
    async def test_user_a_cookie_not_valid_for_user_b(self, auth_client: AsyncClient):
        reg = await auth_client.post("/api/v1/auth/register", json={
            "username": "userA2", "password": "pw123456",
        })
        token = reg.json()["access_token"]

        resp = await auth_client.get("/api/v1/auth/me", cookies={
            "peekview_token": token,
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == "userA2"

        resp2 = await auth_client.get("/api/v1/auth/me", cookies={
            "peekview_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OTk5In0.aaaa",
        })
        assert resp2.status_code == 401