"""Tests for share security — BDD B30-B32.

TDD red-light: imports EntryShare, share_service which do not exist yet.
"""

import re
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

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


# --- B30: Token comparison uses constant-time ---

class TestShareSecurity:

    async def test_b30_token_verification_rejects_invalid_token(self, client_and_app):
        """B30: Token verification correctly rejects invalid tokens."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="security-test")
        await _get_share_token(client, alice["access_token"], "security-test")

        client.cookies.clear()
        resp = await client.get("/api/v1/entries/security-test?share=invalid_token_123")
        assert resp.status_code == 404

    async def test_b30_token_verification_accepts_valid_token(self, client_and_app):
        """B30: Token verification correctly accepts valid tokens."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="security-test-valid")
        token = await _get_share_token(client, alice["access_token"], "security-test-valid")

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/security-test-valid?share={token}")
        assert resp.status_code == 200

    async def test_b31_token_generation_uses_csprng(self, client_and_app):
        """B31: Token generation uses secrets.token_urlsafe(12)."""
        client, app = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="csprng-test")

        import secrets as secrets_module

        with patch.object(secrets_module, "token_urlsafe", wraps=secrets_module.token_urlsafe) as mock_gen:
            data = await _create_share(client, alice["access_token"], "csprng-test")

            mock_gen.assert_called()
            call_args = mock_gen.call_args_list
            assert any(a[0][0] == 12 for a in call_args if a[0]), \
                "secrets.token_urlsafe must be called with 12 (96 bits)"

    async def test_b31_token_is_16_chars_urlsafe(self, client_and_app):
        """B31: Generated token is 16 chars of URL-safe base64."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="token-format")

        data = await _create_share(client, alice["access_token"], "token-format")
        token = data["share_url"].split("?share=")[1]

        assert len(token) == 16, f"Token must be 16 chars, got {len(token)}"
        assert re.match(r"^[A-Za-z0-9_-]+$", token), "Token must be URL-safe base64 chars only"

    async def test_b32_referrer_policy_on_share_access(self, client_and_app):
        """B32: Referrer-Policy: no-referrer set for ?share= pages."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        await _create_private_entry(client, alice["access_token"], slug="referrer-test")
        token = await _get_share_token(client, alice["access_token"], "referrer-test")

        client.cookies.clear()
        resp = await client.get(f"/api/v1/entries/referrer-test?share={token}")
        assert resp.status_code == 200

        referrer_policy = resp.headers.get("referrer-policy", "")
        assert referrer_policy == "no-referrer", \
            f"Referrer-Policy must be 'no-referrer' for share access, got '{referrer_policy}'"

    async def test_b32_no_referrer_policy_without_share(self, client_and_app):
        """B32 negative: No special Referrer-Policy without ?share= param."""
        client, _ = client_and_app
        alice = await _register(client, "alice")
        resp = await client.post(
            "/api/v1/entries",
            json={"summary": "Public entry", "is_public": True, "slug": "normal-page"},
            headers=_auth(alice["access_token"]),
        )
        assert resp.status_code == 201

        client.cookies.clear()
        resp = await client.get("/api/v1/entries/normal-page")
        assert resp.status_code == 200

        referrer_policy = resp.headers.get("referrer-policy", "")
        assert referrer_policy != "no-referrer", \
            "Referrer-Policy must NOT be 'no-referrer' for normal access"
