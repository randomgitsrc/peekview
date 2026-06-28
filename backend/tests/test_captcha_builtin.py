"""TDD tests for PeekView built-in Cap-compatible captcha engine.

Tests are written BEFORE implementation (TDD).
Run: pytest tests/test_captcha_builtin.py -v
Expected: ALL FAIL initially (modules don't exist yet)
"""

import time

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

# ─── Fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def builtin_captcha_config(tmp_path):
    """Config with builtin captcha enabled."""
    return PeekConfig(
        server=PeekServer(),
        storage=PeekStorage(data_dir=tmp_path / "data", db_path=tmp_path / "test.db"),
        limits=PeekLimits(),
        cleanup=PeekCleanup(),
        logging=PeekLogging(),
        remote=PeekRemote(),
        auth=PeekAuth(
            captcha_enabled=True,
            captcha_site_key="test-site-key",
            captcha_secret_key="test-secret-key-for-captcha-jwt",
            captcha_verify_url="",  # Empty = builtin mode
            captcha_builtin_difficulty=2,  # Low for fast tests
            captcha_builtin_challenge_count=5,  # Low for fast tests
            captcha_builtin_challenge_size=16,
            captcha_builtin_challenge_ttl_ms=60_000,
            captcha_builtin_token_ttl_ms=120_000,
        ),
    )


@pytest.fixture
def app_with_builtin_captcha(builtin_captcha_config):
    from peekview.main import create_app
    return create_app(
        data_dir=builtin_captcha_config.storage.data_dir,
        db_path=builtin_captcha_config.storage.db_path,
        config=builtin_captcha_config,
    )


@pytest.fixture
async def client_builtin(app_with_builtin_captcha):
    transport = ASGITransport(app=app_with_builtin_captcha)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── T1-T5: Algorithm unit tests ────────────────────────────────────────────


class TestFnv1a:
    def test_known_values(self):
        from peekview.captcha_engine import fnv1a
        assert fnv1a("hello") == 1335831723
        assert fnv1a("") == 2166136261
        assert fnv1a("a") == 3826002220

    def test_consistency(self):
        from peekview.captcha_engine import fnv1a
        assert fnv1a("test_string_123") == fnv1a("test_string_123")


class TestFnv1aResume:
    def test_resume_equivalent(self):
        from peekview.captcha_engine import fnv1a, fnv1a_resume
        base = fnv1a("hello")
        full = fnv1a("helloworld")
        resumed = fnv1a_resume(base, "world")
        assert full == resumed


class TestPrngFromHash:
    def test_known_value(self):
        from peekview.captcha_engine import fnv1a, prng_from_hash
        h = fnv1a("hello")
        result = prng_from_hash(h, 32)
        assert result == "eb492c6e1655ea8ccb83decebb129a83"

    def test_length_variations(self):
        from peekview.captcha_engine import fnv1a, prng_from_hash
        h = fnv1a("seed")
        assert len(prng_from_hash(h, 1)) == 1
        assert len(prng_from_hash(h, 8)) == 8
        assert len(prng_from_hash(h, 32)) == 32
        assert len(prng_from_hash(h, 33)) == 33


class TestSha256Pow:
    def test_matches(self):
        from peekview.captcha_engine import pow_matches, sha256_hex
        hash_hex = sha256_hex("test")
        assert pow_matches(hash_hex, hash_hex[:4])
        assert not pow_matches(hash_hex, "ffff")


class TestJwt:
    def test_sign_verify_roundtrip(self):
        from peekview.captcha_engine import jwt_sign, jwt_verify
        payload = {"test": "data", "exp": 1234567890000}
        token = jwt_sign(payload, "secret_key")
        assert isinstance(token, str)
        assert len(token.split(".")) == 3
        decoded = jwt_verify(token, "secret_key")
        assert decoded == payload

    def test_verify_wrong_secret(self):
        from peekview.captcha_engine import jwt_sign, jwt_verify
        token = jwt_sign({"test": "data"}, "secret1")
        assert jwt_verify(token, "secret2") is None

    def test_verify_tampered(self):
        from peekview.captcha_engine import jwt_sign, jwt_verify
        token = jwt_sign({"test": "data"}, "secret")
        tampered = token[:-5] + "XXXXX"
        assert jwt_verify(tampered, "secret") is None


# ─── T6-T17: Engine unit tests ──────────────────────────────────────────────


class TestGenerateChallenge:
    def test_returns_valid_jwt(self):
        from peekview.captcha_engine import generate_challenge, jwt_verify
        result = generate_challenge("secret", "site_key")
        assert "challenge" in result
        assert "token" in result
        assert "expires" in result
        payload = jwt_verify(result["token"], "secret")
        assert payload is not None
        assert payload["sk"] == "site_key"
        assert "n" in payload
        assert "c" in payload
        assert "s" in payload
        assert "d" in payload
        assert "exp" in payload
        assert "iat" in payload

    def test_respects_custom_params(self):
        from peekview.captcha_engine import generate_challenge
        result = generate_challenge("secret", "site_key", c=3, s=8, d=1, ttl_ms=5000)
        assert result["challenge"]["c"] == 3
        assert result["challenge"]["s"] == 8
        assert result["challenge"]["d"] == 1


class TestValidateChallenge:
    @pytest.mark.asyncio
    async def test_valid_solutions_succeeds(self):
        from peekview.captcha_engine import (
            fnv1a,
            fnv1a_resume,
            generate_challenge,
            prng_from_hash,
            sha256_hex,
            validate_challenge,
        )

        challenge = generate_challenge("secret", "site_key", c=3, s=8, d=1, ttl_ms=60000)
        token = challenge["token"]
        c, s, d = 3, 8, 1

        # Compute PoW solutions (Python equivalent of widget logic)
        token_fnv = fnv1a(token)
        solutions = []
        for i in range(c):
            idx_str = str(i + 1)
            salt_seed = fnv1a_resume(token_fnv, idx_str)
            target_seed = fnv1a_resume(salt_seed, "d")
            salt = prng_from_hash(salt_seed, s)
            target = prng_from_hash(target_seed, d)
            # Brute force nonce
            nonce = 0
            while True:
                if sha256_hex(salt + str(nonce)).startswith(target.lower()):
                    solutions.append(nonce)
                    break
                nonce += 1

        result = await validate_challenge("secret", {"token": token, "solutions": solutions})
        assert result["success"] is True
        assert "token" in result
        assert "expires" in result

    @pytest.mark.asyncio
    async def test_invalid_solutions_fails(self):
        from peekview.captcha_engine import generate_challenge, validate_challenge
        challenge = generate_challenge("secret", "site_key", c=3, s=8, d=1)
        result = await validate_challenge("secret", {"token": challenge["token"], "solutions": [0, 0, 0]})
        assert result["success"] is False
        assert result["reason"] == "invalid_solution"

    @pytest.mark.asyncio
    async def test_expired_challenge_fails(self):
        from peekview.captcha_engine import generate_challenge, validate_challenge
        challenge = generate_challenge("secret", "site_key", ttl_ms=-1000)  # Already expired
        result = await validate_challenge("secret", {"token": challenge["token"], "solutions": [1, 2, 3]})
        assert result["success"] is False
        assert result["reason"] == "expired"

    @pytest.mark.asyncio
    async def test_wrong_solution_count_fails(self):
        from peekview.captcha_engine import generate_challenge, validate_challenge
        challenge = generate_challenge("secret", "site_key", c=5)
        result = await validate_challenge("secret", {"token": challenge["token"], "solutions": [1, 2]})
        assert result["success"] is False
        assert result["reason"] == "invalid_solutions"

    @pytest.mark.asyncio
    async def test_non_int_solution_fails(self):
        from peekview.captcha_engine import generate_challenge, validate_challenge
        challenge = generate_challenge("secret", "site_key", c=3)
        # First element is non-int so type check fails immediately
        result = await validate_challenge("secret", {"token": challenge["token"], "solutions": ["one", 2, 3]})
        assert result["success"] is False
        assert result["reason"] == "invalid_solutions"

    @pytest.mark.asyncio
    async def test_bool_solution_fails(self):
        from peekview.captcha_engine import generate_challenge, validate_challenge
        challenge = generate_challenge("secret", "site_key", c=3)
        # First element is bool so type check fails immediately
        result = await validate_challenge("secret", {"token": challenge["token"], "solutions": [True, 2, 3]})
        assert result["success"] is False
        assert result["reason"] == "invalid_solutions"


class TestSiteverifyToken:
    @pytest.mark.asyncio
    async def test_valid_token_succeeds(self):
        from peekview.captcha_engine import (
            fnv1a,
            fnv1a_resume,
            generate_challenge,
            prng_from_hash,
            sha256_hex,
            siteverify_token,
            validate_challenge,
        )

        challenge = generate_challenge("secret", "site_key", c=2, s=8, d=1)
        token = challenge["token"]
        token_fnv = fnv1a(token)
        solutions = []
        for i in range(2):
            salt = prng_from_hash(fnv1a_resume(token_fnv, str(i + 1)), 8)
            target = prng_from_hash(fnv1a_resume(fnv1a_resume(token_fnv, str(i + 1)), "d"), 1)
            nonce = 0
            while not sha256_hex(salt + str(nonce)).startswith(target.lower()):
                nonce += 1
            solutions.append(nonce)

        redeem = await validate_challenge("secret", {"token": token, "solutions": solutions})
        assert siteverify_token("secret", "site_key", redeem["token"]) is True

    def test_expired_token_fails(self):
        from peekview.captcha_engine import jwt_sign, siteverify_token
        expired_token = jwt_sign({"sk": "site_key", "exp": int(time.time() * 1000) - 1000, "iat": 0}, "secret")
        assert siteverify_token("secret", "site_key", expired_token) is False

    def test_wrong_site_key_fails(self):
        from peekview.captcha_engine import jwt_sign, siteverify_token
        token = jwt_sign({"sk": "other_site", "exp": int(time.time() * 1000) + 60000, "iat": 0}, "secret")
        assert siteverify_token("secret", "site_key", token) is False

    def test_tampered_token_fails(self):
        from peekview.captcha_engine import jwt_sign, siteverify_token
        token = jwt_sign({"sk": "site_key", "exp": int(time.time() * 1000) + 60000, "iat": 0}, "secret")
        tampered = token[:-5] + "XXXXX"
        assert siteverify_token("secret", "site_key", tampered) is False


# ─── T18-T21: HTTP endpoint tests ───────────────────────────────────────────


class TestCaptchaEndpoints:
    @pytest.mark.asyncio
    async def test_challenge_endpoint_format(self, client_builtin):
        resp = await client_builtin.post("/api/v1/captcha/challenge")
        assert resp.status_code == 200
        data = resp.json()
        assert "challenge" in data
        assert "token" in data
        assert "expires" in data
        assert "c" in data["challenge"]
        assert "s" in data["challenge"]
        assert "d" in data["challenge"]

    @pytest.mark.asyncio
    async def test_redeem_endpoint_success(self, client_builtin):
        from peekview.captcha_engine import fnv1a, fnv1a_resume, prng_from_hash, sha256_hex

        # Get challenge
        challenge_resp = await client_builtin.post("/api/v1/captcha/challenge")
        challenge = challenge_resp.json()
        token = challenge["token"]
        c = challenge["challenge"]["c"]
        s = challenge["challenge"]["s"]
        d = challenge["challenge"]["d"]

        # Compute solutions
        token_fnv = fnv1a(token)
        solutions = []
        for i in range(c):
            salt = prng_from_hash(fnv1a_resume(token_fnv, str(i + 1)), s)
            target = prng_from_hash(fnv1a_resume(fnv1a_resume(token_fnv, str(i + 1)), "d"), d)
            nonce = 0
            while not sha256_hex(salt + str(nonce)).startswith(target.lower()):
                nonce += 1
            solutions.append(nonce)

        # Redeem
        redeem_resp = await client_builtin.post("/api/v1/captcha/redeem", json={
            "token": token,
            "solutions": solutions,
        })
        assert redeem_resp.status_code == 200
        data = redeem_resp.json()
        assert data["success"] is True
        assert "token" in data

    @pytest.mark.asyncio
    async def test_redeem_endpoint_failure(self, client_builtin):
        challenge_resp = await client_builtin.post("/api/v1/captcha/challenge")
        challenge = challenge_resp.json()

        redeem_resp = await client_builtin.post("/api/v1/captcha/redeem", json={
            "token": challenge["token"],
            "solutions": [0] * challenge["challenge"]["c"],
        })
        assert redeem_resp.status_code == 200
        data = redeem_resp.json()
        assert data["success"] is False
        assert "reason" in data

    @pytest.mark.asyncio
    async def test_siteverify_endpoint(self, client_builtin):
        from peekview.captcha_engine import fnv1a, fnv1a_resume, prng_from_hash, sha256_hex

        challenge_resp = await client_builtin.post("/api/v1/captcha/challenge")
        challenge = challenge_resp.json()
        token = challenge["token"]
        c = challenge["challenge"]["c"]
        s = challenge["challenge"]["s"]
        d = challenge["challenge"]["d"]

        token_fnv = fnv1a(token)
        solutions = []
        for i in range(c):
            salt = prng_from_hash(fnv1a_resume(token_fnv, str(i + 1)), s)
            target = prng_from_hash(fnv1a_resume(fnv1a_resume(token_fnv, str(i + 1)), "d"), d)
            nonce = 0
            while not sha256_hex(salt + str(nonce)).startswith(target.lower()):
                nonce += 1
            solutions.append(nonce)

        redeem_resp = await client_builtin.post("/api/v1/captcha/redeem", json={
            "token": token,
            "solutions": solutions,
        })
        redeem_token = redeem_resp.json()["token"]

        verify_resp = await client_builtin.post("/api/v1/captcha/siteverify", json={
            "secret": "test-secret-key-for-captcha-jwt",
            "response": redeem_token,
        })
        assert verify_resp.status_code == 200
        assert verify_resp.json()["success"] is True


# ─── T22-T23: Auth integration tests ────────────────────────────────────────


class TestAuthWithBuiltinCaptcha:
    @pytest.mark.asyncio
    async def test_login_with_builtin_captcha(self, client_builtin):
        from peekview.captcha_engine import fnv1a, fnv1a_resume, prng_from_hash, sha256_hex

        # Register first (first user is exempt)
        reg = await client_builtin.post("/api/v1/auth/register", json={
            "username": "logintest",
            "password": "testpass123",
        })
        assert reg.status_code == 201

        # Get challenge and solve
        challenge_resp = await client_builtin.post("/api/v1/captcha/challenge")
        challenge = challenge_resp.json()
        token = challenge["token"]
        c = challenge["challenge"]["c"]
        s = challenge["challenge"]["s"]
        d = challenge["challenge"]["d"]

        token_fnv = fnv1a(token)
        solutions = []
        for i in range(c):
            salt = prng_from_hash(fnv1a_resume(token_fnv, str(i + 1)), s)
            target = prng_from_hash(fnv1a_resume(fnv1a_resume(token_fnv, str(i + 1)), "d"), d)
            nonce = 0
            while not sha256_hex(salt + str(nonce)).startswith(target.lower()):
                nonce += 1
            solutions.append(nonce)

        redeem_resp = await client_builtin.post("/api/v1/captcha/redeem", json={
            "token": token,
            "solutions": solutions,
        })
        captcha_token = redeem_resp.json()["token"]

        # Login with captcha token
        login = await client_builtin.post("/api/v1/auth/login", json={
            "username": "logintest",
            "password": "testpass123",
            "captcha_token": captcha_token,
        })
        assert login.status_code == 200
        assert login.json()["user"]["username"] == "logintest"

    @pytest.mark.asyncio
    async def test_register_with_builtin_captcha(self, client_builtin):
        from peekview.captcha_engine import fnv1a, fnv1a_resume, prng_from_hash, sha256_hex

        # First user already created in previous test, so this should require captcha
        challenge_resp = await client_builtin.post("/api/v1/captcha/challenge")
        challenge = challenge_resp.json()
        token = challenge["token"]
        c = challenge["challenge"]["c"]
        s = challenge["challenge"]["s"]
        d = challenge["challenge"]["d"]

        token_fnv = fnv1a(token)
        solutions = []
        for i in range(c):
            salt = prng_from_hash(fnv1a_resume(token_fnv, str(i + 1)), s)
            target = prng_from_hash(fnv1a_resume(fnv1a_resume(token_fnv, str(i + 1)), "d"), d)
            nonce = 0
            while not sha256_hex(salt + str(nonce)).startswith(target.lower()):
                nonce += 1
            solutions.append(nonce)

        redeem_resp = await client_builtin.post("/api/v1/captcha/redeem", json={
            "token": token,
            "solutions": solutions,
        })
        captcha_token = redeem_resp.json()["token"]

        reg = await client_builtin.post("/api/v1/auth/register", json={
            "username": "registertest",
            "password": "testpass123",
            "captcha_token": captcha_token,
        })
        assert reg.status_code == 201
        assert reg.json()["user"]["username"] == "registertest"


# ─── T24: Regression test ───────────────────────────────────────────────────


class TestCaptchaDisabledRegression:
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
        await client_without_captcha.post("/api/v1/auth/register", json={
            "username": "noCaptchaUser",
            "password": "nopass123",
        })
        resp = await client_without_captcha.post("/api/v1/auth/login", json={
            "username": "noCaptchaUser",
            "password": "nopass123",
        })
        assert resp.status_code == 200


# Reuse fixture from test_captcha.py
@pytest.fixture
async def client_without_captcha(app_without_captcha):
    transport = ASGITransport(app=app_without_captcha)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def app_without_captcha(captcha_disabled_config):
    from peekview.main import create_app
    return create_app(
        data_dir=captcha_disabled_config.storage.data_dir,
        db_path=captcha_disabled_config.storage.db_path,
        config=captcha_disabled_config,
    )


@pytest.fixture
def captcha_disabled_config(tmp_path):
    return PeekConfig(
        server=PeekServer(),
        storage=PeekStorage(data_dir=tmp_path / "data", db_path=tmp_path / "test.db"),
        limits=PeekLimits(),
        cleanup=PeekCleanup(),
        logging=PeekLogging(),
        remote=PeekRemote(),
        auth=PeekAuth(captcha_enabled=False),
    )
