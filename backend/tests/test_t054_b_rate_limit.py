"""T054-B: Write-endpoint rate limiting with explicit @limiter decorators.

BDD: B1-B6
Tests should FAIL (red) until P4 implementation.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app


@pytest.fixture
async def rate_client(monkeypatch):
    """Client with a very low rate limit for testing 429 responses."""
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE", "5")
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
async def no_limit_client(monkeypatch):
    """Client with rate limiting disabled."""
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_ENABLED", "false")
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
async def auth_rate_client(monkeypatch):
    """Client with rate limiting and auth for write operations."""
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE", "5")
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


class TestBDDB1CreateRateLimit429:
    """BDD-B1: Given rate_limit_enabled=True and rate_limit_per_minute=60,
    When same IP sends 61st request to POST /api/v1/entries within 1 minute,
    Then returns HTTP 429.
    """

    @pytest.mark.asyncio
    async def test_create_entry_returns_429_after_limit(self, rate_client):
        limit = 5
        for i in range(limit):
            resp = await rate_client.post("/api/v1/entries", json={
                "summary": f"Entry {i}",
            })
            assert resp.status_code in (201, 200), f"Request {i+1} got {resp.status_code}"

        resp = await rate_client.post("/api/v1/entries", json={
            "summary": "Over limit",
        })
        assert resp.status_code == 429


class TestBDDB2CreateNormalUnderLimit:
    """BDD-B2: Given rate_limit_enabled=True and rate_limit_per_minute=60,
    When same IP sends up to 60 requests to POST /api/v1/entries within 1 minute,
    Then all respond normally (not 429).
    """

    @pytest.mark.asyncio
    async def test_create_entry_normal_under_limit(self, rate_client):
        limit = 5
        for i in range(limit):
            resp = await rate_client.post("/api/v1/entries", json={
                "summary": f"Entry {i}",
            })
            assert resp.status_code in (201, 200), f"Request {i+1} should not be 429"


class TestBDDB3UpdateRateLimit429:
    """BDD-B3: Given rate_limit_enabled=True and rate_limit_per_minute=60,
    When same IP sends 61st PATCH request to /api/v1/entries/{slug} within 1 minute,
    Then returns HTTP 429.
    """

    @pytest.mark.asyncio
    async def test_update_entry_returns_429_after_limit(self, rate_client):
        create_resp = await rate_client.post("/api/v1/entries", json={
            "summary": "To update",
        })
        assert create_resp.status_code in (201, 200)
        slug = create_resp.json()["slug"]

        limit = 5
        for i in range(limit):
            resp = await rate_client.patch(f"/api/v1/entries/{slug}", json={
                "summary": f"Updated {i}",
            })
            if resp.status_code == 429:
                break
            assert resp.status_code in (200, 404), f"Update {i+1} got {resp.status_code}"

        resp = await rate_client.patch(f"/api/v1/entries/{slug}", json={
            "summary": "Over limit update",
        })
        assert resp.status_code == 429


class TestBDDB4DeleteRateLimit429:
    """BDD-B4: Given rate_limit_enabled=True and rate_limit_per_minute=60,
    When same IP sends 61st DELETE request to /api/v1/entries/{slug} within 1 minute,
    Then returns HTTP 429.
    """

    @pytest.mark.asyncio
    async def test_delete_entry_returns_429_after_limit(self, rate_client):
        slugs = []
        limit = 6
        for i in range(limit):
            resp = await rate_client.post("/api/v1/entries", json={
                "summary": f"To delete {i}",
            })
            if resp.status_code in (201, 200):
                slugs.append(resp.json()["slug"])

        deleted = 0
        for slug in slugs:
            resp = await rate_client.delete(f"/api/v1/entries/{slug}")
            if resp.status_code == 429:
                break
            deleted += 1

        assert deleted < len(slugs), "Should hit rate limit before deleting all"


class TestBDDB5RateLimitDisabled:
    """BDD-B5: Given rate_limit_enabled=False,
    When sending arbitrary requests to POST /api/v1/entries,
    Then no 429 responses.
    """

    @pytest.mark.asyncio
    async def test_no_429_when_disabled(self, no_limit_client):
        for i in range(10):
            resp = await no_limit_client.post("/api/v1/entries", json={
                "summary": f"Entry {i}",
            })
            assert resp.status_code != 429, f"Got 429 on request {i+1} with rate limit disabled"


class TestBDDB6ExplicitDecoratorPriority:
    """BDD-B6: Given rate_limit_enabled=True and entries write endpoints have
    explicit @limiter.limit() decorators,
    When checking the decorator limit value,
    Then it can be configured independently of default_limits.
    """

    def test_entries_rate_limit_provider_exists(self):
        from peekview.api.rate_limit import entries_rate_limit
        limit = entries_rate_limit()
        assert isinstance(limit, str)
        assert "/minute" in limit

    def test_entries_rate_limit_setter(self):
        from peekview.api.rate_limit import entries_rate_limit, set_entries_rate_limit
        original = entries_rate_limit()
        try:
            set_entries_rate_limit("30/minute")
            assert entries_rate_limit() == "30/minute"
        finally:
            set_entries_rate_limit(original)

    def test_create_entry_has_limiter_decorator(self):
        from peekview.api.entries import create_entry
        assert hasattr(create_entry, "__wrapped__") or hasattr(create_entry, "rate_limit_decorator") or _has_limiter_decorator(create_entry)

    def test_update_entry_has_limiter_decorator(self):
        from peekview.api.entries import update_entry
        assert hasattr(update_entry, "__wrapped__") or hasattr(update_entry, "rate_limit_decorator") or _has_limiter_decorator(update_entry)

    def test_delete_entry_has_limiter_decorator(self):
        from peekview.api.entries import delete_entry
        assert hasattr(delete_entry, "__wrapped__") or hasattr(delete_entry, "rate_limit_decorator") or _has_limiter_decorator(delete_entry)


def _has_limiter_decorator(func) -> bool:
    """Check if a function has slowapi limiter decorators attached."""
    if hasattr(func, "_limiter_decorator"):
        return True
    if hasattr(func, "__wrapped__"):
        return _has_limiter_decorator(func.__wrapped__)
    try:
        from slowapi import Limiter
        decorators = getattr(func, "__decorators__", [])
        return any(isinstance(d, Limiter) for d in decorators)
    except Exception:
        pass
    return False
