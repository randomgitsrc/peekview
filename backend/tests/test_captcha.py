"""Tests for Cap captcha integration in auth endpoints.

Tests cover:
- Captcha verification logic (verify_captcha)
- /api/v1/auth/register and /api/v1/auth/login require captcha when enabled
- Exempt scenarios (first user, localhost) bypass captcha
- Public /api/v1/config/captcha endpoint returns site_key without secret
- Cap service unavailability handled gracefully
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.config import (
    PeekAuth,
    PeekCleanup,
    PeekConfig,
    PeekLimits,
    PeekLogging,
    PeekRemote,
    PeekServer,
    PeekStorage,
)

# ─── Captcha config fixtures ────────────────────────────────────────────────


@pytest.fixture
def captcha_enabled_config(tmp_path):
    """Config with captcha enabled."""
    return PeekConfig(
        server=PeekServer(),
        storage=PeekStorage(data_dir=tmp_path / "data", db_path=tmp_path / "test.db"),
        limits=PeekLimits(),
        cleanup=PeekCleanup(),
        logging=PeekLogging(),
        remote=PeekRemote(),
        auth=PeekAuth(
            captcha_enabled=True,
            captcha_site_key="test-site-key-abc",
            captcha_secret_key="test-secret-key-xyz",
            captcha_verify_url="http://cap:3000",
        ),
    )


@pytest.fixture
def captcha_disabled_config(tmp_path):
    """Config with captcha disabled."""
    return PeekConfig(
        server=PeekServer(),
        storage=PeekStorage(data_dir=tmp_path / "data", db_path=tmp_path / "test.db"),
        limits=PeekLimits(),
        cleanup=PeekCleanup(),
        logging=PeekLogging(),
        remote=PeekRemote(),
        auth=PeekAuth(captcha_enabled=False),
    )


@pytest.fixture
def app_with_captcha(captcha_enabled_config):
    """Create a test FastAPI app with captcha enabled."""
    from peekview.main import create_app

    return create_app(
        data_dir=captcha_enabled_config.storage.data_dir,
        db_path=captcha_enabled_config.storage.db_path,
        config=captcha_enabled_config,
    )


@pytest.fixture
def app_with_captcha_strict(captcha_enabled_config):
    """Same as app_with_captcha but exempt_first_user=False (forces captcha on first user)."""
    from peekview.main import create_app

    # Deep-copy the config and override exempt_first_user
    cfg = captcha_enabled_config.model_copy(deep=True)
    cfg.auth.captcha_exempt_first_user = False
    return create_app(
        data_dir=cfg.storage.data_dir,
        db_path=cfg.storage.db_path,
        config=cfg,
    )


@pytest.fixture
def app_without_captcha(captcha_disabled_config):
    """Create a test FastAPI app with captcha disabled."""
    from peekview.main import create_app

    return create_app(
        data_dir=captcha_disabled_config.storage.data_dir,
        db_path=captcha_disabled_config.storage.db_path,
        config=captcha_disabled_config,
    )


@pytest.fixture
async def client_with_captcha(app_with_captcha):
    """Async client for captcha-enabled tests (with first-user exempt)."""
    transport = ASGITransport(app=app_with_captcha)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_with_captcha_strict(app_with_captcha_strict):
    """Async client for captcha tests with NO first-user exempt (forces captcha always)."""
    transport = ASGITransport(app=app_with_captcha_strict)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_without_captcha(app_without_captcha):
    """Async client for captcha-disabled tests."""
    transport = ASGITransport(app=app_without_captcha)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── verify_captcha unit tests ──────────────────────────────────────────────


class TestVerifyCaptcha:
    """Unit tests for verify_captcha function."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_true(self):
        """Valid token from Cap returns True."""
        from peekview.api.captcha import verify_captcha

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True}
        mock_response.raise_for_status = MagicMock()

        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            result = await verify_captcha(
                token="valid-token",
                site_key="test-key",
                secret_key="test-secret",
                verify_url="http://cap:3000",
            )
            assert result is True

    @pytest.mark.asyncio
    async def test_invalid_token_returns_false(self):
        """Invalid token from Cap returns False."""
        from peekview.api.captcha import verify_captcha

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": False}
        mock_response.raise_for_status = MagicMock()

        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            result = await verify_captcha(
                token="bad-token",
                site_key="test-key",
                secret_key="test-secret",
                verify_url="http://cap:3000",
            )
            assert result is False

    @pytest.mark.asyncio
    async def test_empty_token_raises_required(self):
        """Empty token raises CaptchaRequiredError."""
        from peekview.api.captcha import CaptchaRequiredError, verify_captcha

        with pytest.raises(CaptchaRequiredError):
            await verify_captcha(
                token=None,
                site_key="test-key",
                secret_key="test-secret",
                verify_url="http://cap:3000",
            )

    @pytest.mark.asyncio
    async def test_empty_string_token_raises_required(self):
        """Empty string token raises CaptchaRequiredError."""
        from peekview.api.captcha import CaptchaRequiredError, verify_captcha

        with pytest.raises(CaptchaRequiredError):
            await verify_captcha(
                token="",
                site_key="test-key",
                secret_key="test-secret",
                verify_url="http://cap:3000",
            )

    @pytest.mark.asyncio
    async def test_cap_service_unreachable_raises(self):
        """Cap service network error raises an error (not crash)."""
        import httpx

        from peekview.api.captcha import verify_captcha

        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            with pytest.raises(httpx.ConnectError):
                await verify_captcha(
                    token="some-token",
                    site_key="test-key",
                    secret_key="test-secret",
                    verify_url="http://cap:3000",
                )


# ─── /api/v1/auth/register with captcha ─────────────────────────────────────


class TestRegisterWithCaptcha:
    """Test register endpoint with captcha enabled (strict mode: no first-user exempt)."""

    @pytest.mark.asyncio
    async def test_register_without_captcha_token_fails(self, client_with_captcha_strict):
        """Register without captcha token should fail with CAPTCHA_REQUIRED."""
        resp = await client_with_captcha_strict.post("/api/v1/auth/register", json={
            "username": "nocaptchatest",
            "password": "somepass123",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "CAPTCHA_REQUIRED"

    @pytest.mark.asyncio
    async def test_register_with_invalid_captcha_token_fails(self, client_with_captcha_strict):
        """Register with invalid captcha token should fail with CAPTCHA_INVALID."""
        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": False}
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            resp = await client_with_captcha_strict.post("/api/v1/auth/register", json={
                "username": "badcaptcha",
                "password": "somepass123",
                "captcha_token": "fake-token",
            })
            assert resp.status_code == 401
            assert resp.json()["error"]["code"] == "CAPTCHA_INVALID"

    @pytest.mark.asyncio
    async def test_register_with_valid_captcha_succeeds(self, client_with_captcha):
        """Register with valid captcha token should succeed (first user = admin)."""
        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": True}
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            resp = await client_with_captcha.post("/api/v1/auth/register", json={
                "username": "goodcaptcha",
                "password": "goodpass123",
                "captcha_token": "valid-token",
            })
            assert resp.status_code == 201
            assert resp.json()["user"]["username"] == "goodcaptcha"

    @pytest.mark.asyncio
    async def test_first_user_exempt_from_captcha(self, client_with_captcha):
        """First user (admin) should be able to register without captcha token.

        This is a convenience for initial setup, controlled by captcha_exempt_first_user.
        """
        # First user, no captcha token, but we need to verify that no Cap call is made.
        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            # If exempt works correctly, this mock should never be called.
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": True}
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            resp = await client_with_captcha.post("/api/v1/auth/register", json={
                "username": "firstadmin",
                "password": "adminpass123",
                # No captcha_token
            })
            assert resp.status_code == 201
            # Verify the Cap endpoint was NOT called for first user
            assert mock_client.post.call_count == 0


# ─── /api/v1/auth/login with captcha ─────────────────────────────────────────


class TestLoginWithCaptcha:
    """Test login endpoint with captcha enabled (strict mode: no first-user exempt)."""

    @pytest.mark.asyncio
    async def test_login_without_captcha_token_fails(self, client_with_captcha_strict):
        """Login without captcha token should fail with CAPTCHA_REQUIRED."""
        resp = await client_with_captcha_strict.post("/api/v1/auth/login", json={
            "username": "anyuser",
            "password": "anypass123",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "CAPTCHA_REQUIRED"

    @pytest.mark.asyncio
    async def test_login_with_valid_captcha_succeeds(self, client_with_captcha_strict):
        """Login with valid captcha + correct credentials should succeed."""
        # First register a user (we need to bypass captcha or mock it)
        with patch("peekview.api.captcha.httpx.AsyncClient") as MockClient:  # noqa: N806  # noqa: N806
            mock_response = MagicMock()
            mock_response.json.return_value = {"success": True}
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = mock_client

            # Register (strict mode → must pass captcha)
            reg = await client_with_captcha_strict.post("/api/v1/auth/register", json={
                "username": "logincaptchatest",
                "password": "loginpass123",
                "captcha_token": "valid-token",
            })
            assert reg.status_code == 201

            # Login
            resp = await client_with_captcha_strict.post("/api/v1/auth/login", json={
                "username": "logincaptchatest",
                "password": "loginpass123",
                "captcha_token": "valid-token",
            })
            assert resp.status_code == 200
            assert resp.json()["user"]["username"] == "logincaptchatest"


# ─── /api/v1/config/captcha public endpoint ─────────────────────────────────


class TestPublicCaptchaConfig:
    """Test public captcha config endpoint."""

    @pytest.mark.asyncio
    async def test_config_captcha_returns_site_key(self, client_with_captcha):
        """Public endpoint should return site_key, endpoint, enabled."""
        resp = await client_with_captcha.get("/api/v1/config/captcha")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True
        assert data["site_key"] == "test-site-key-abc"
        # Critical: secret_key should NOT be exposed
        assert "secret_key" not in data
        assert "secret" not in data

    @pytest.mark.asyncio
    async def test_config_captcha_disabled(self, client_without_captcha):
        """Public endpoint should report enabled=False when captcha off."""
        resp = await client_without_captcha.get("/api/v1/config/captcha")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is False


# ─── Captcha-disabled path (regression) ─────────────────────────────────────


class TestCaptchaDisabled:
    """Test that captcha-disabled mode allows register/login without captcha."""

    @pytest.mark.asyncio
    async def test_register_without_captcha_token_works(self, client_without_captcha):
        """With captcha disabled, register should not require captcha_token."""
        resp = await client_without_captcha.post("/api/v1/auth/register", json={
            "username": "noCaptchaNeeded",
            "password": "nopass123",
        })
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_login_without_captcha_token_works(self, client_without_captcha):
        """With captcha disabled, login should not require captcha_token."""
        # First register
        await client_without_captcha.post("/api/v1/auth/register", json={
            "username": "noCaptchaUser",
            "password": "nopass123",
        })
        # Then login
        resp = await client_without_captcha.post("/api/v1/auth/login", json={
            "username": "noCaptchaUser",
            "password": "nopass123",
        })
        assert resp.status_code == 200
