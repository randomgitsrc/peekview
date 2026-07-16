"""Tests for Prometheus /metrics endpoint (T056)."""

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.config import PeekConfig


@pytest.fixture
def app_with_api_key(tmp_path):
    from peekview.main import create_app

    config = PeekConfig(
        data_dir=tmp_path / "data",
        db_path=tmp_path / "test.db",
    )
    config.server.api_key = "test-secret-key-12345"
    return create_app(config=config)


@pytest.fixture
async def client_with_api_key(app_with_api_key) -> AsyncClient:
    transport = ASGITransport(app=app_with_api_key)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def app_metrics_disabled(tmp_path):
    from peekview.main import create_app

    config = PeekConfig(
        data_dir=tmp_path / "data",
        db_path=tmp_path / "test.db",
    )
    config.metrics.enabled = False
    return create_app(config=config)


@pytest.fixture
async def client_metrics_disabled(app_metrics_disabled) -> AsyncClient:
    transport = ASGITransport(app=app_metrics_disabled)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_metrics_endpoint_exists(client):
    response = await client.get("/metrics")
    assert response.status_code == 200


async def test_metrics_content_type(client):
    response = await client.get("/metrics")
    assert response.headers["content-type"].startswith("text/plain")


async def test_metrics_prometheus_format(client):
    response = await client.get("/metrics")
    assert "http_requests_total{" in response.text


async def test_metrics_bypasses_api_key_auth(client_with_api_key):
    response = await client_with_api_key.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total{" in response.text


async def test_metrics_bypasses_rate_limiter(client):
    for _ in range(5):
        response = await client.get("/metrics")
        assert response.status_code != 429


async def test_metrics_disabled_via_config(client_metrics_disabled):
    response = await client_metrics_disabled.get("/metrics")
    assert response.status_code == 404


async def test_metrics_captures_request_data(client):
    await client.get("/health")
    response = await client.get("/metrics")
    assert "http_request_duration_seconds" in response.text
    assert "http_requests_total" in response.text


async def test_metrics_not_spa_catchall(client):
    response = await client.get("/metrics", headers={"Accept": "text/html"})
    assert response.headers["content-type"].startswith("text/plain")
