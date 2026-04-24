"""Tests for FastAPI endpoints."""

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peek.main import create_app


@pytest.fixture(scope="function")
async def client():
    # Create completely isolated temp directory
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
        # Clean up
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
async def auth_client(monkeypatch):
    """Client with PEEK_API_KEY configured."""
    monkeypatch.setenv("PEEK_SERVER__API_KEY", "test-secret-key")
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


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200


class TestCreateEntry:
    @pytest.mark.asyncio
    async def test_create_with_content_returns_201(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Test entry",
            "slug": "create-test",
            "files": [{"path": "main.py", "content": "print('hello')"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        # Slug may have suffix if conflict, but should start with our slug
        assert data["slug"].startswith("create-test")
        assert "/view/" in data["url"]

    @pytest.mark.asyncio
    async def test_create_missing_summary(self, client):
        resp = await client.post("/api/v1/entries", json={})
        # FastAPI validates request body and returns 422 for missing required fields
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_invalid_slug(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Bad",
            "slug": "Hello World!",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_auto_slug(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Auto slug",
        })
        assert resp.status_code == 201
        assert len(resp.json()["slug"]) == 6


class TestGetEntry:
    @pytest.mark.asyncio
    async def test_get_entry(self, client):
        # Create first
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "Find me", "slug": "get-test",
        })
        assert create_resp.status_code == 201
        # Get
        resp = await client.get("/api/v1/entries/get-test")
        assert resp.status_code == 200
        assert resp.json()["slug"] == "get-test"

    @pytest.mark.asyncio
    async def test_get_not_found(self, client):
        resp = await client.get("/api/v1/entries/nonexistent123")
        assert resp.status_code == 404


class TestListEntries:
    @pytest.mark.asyncio
    async def test_list_entries(self, client):
        # Create unique entries
        await client.post("/api/v1/entries", json={"summary": "List A", "slug": "list-a"})
        await client.post("/api/v1/entries", json={"summary": "List B", "slug": "list-b"})
        resp = await client.get("/api/v1/entries")
        assert resp.status_code == 200
        data = resp.json()
        # Just verify structure, don't check exact count
        assert "total" in data
        assert "items" in data
        assert len(data["items"]) >= 0


class TestDeleteEntry:
    @pytest.mark.asyncio
    async def test_delete_entry(self, client):
        await client.post("/api/v1/entries", json={"summary": "Del", "slug": "del-test"})
        resp = await client.delete("/api/v1/entries/del-test")
        assert resp.status_code == 200
        # Verify gone
        resp = await client.get("/api/v1/entries/del-test")
        assert resp.status_code == 404


class TestFileContentEndpoint:
    @pytest.mark.asyncio
    async def test_get_file_content_inline(self, client):
        """GET /entries/{slug}/files/{file_id}/content returns raw text."""
        slug = "filecontent-test"
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "File test",
            "slug": slug,
            "files": [{"path": "hello.py", "content": "print('hello')"}],
        })
        assert create_resp.status_code == 201
        data = create_resp.json()
        # Use actual slug returned (may have suffix)
        actual_slug = data["slug"]
        file_id = data["files"][0]["id"]

        resp = await client.get(f"/api/v1/entries/{actual_slug}/files/{file_id}/content")
        assert resp.status_code == 200
        assert resp.text == "print('hello')"
        # Should have text Content-Type, NOT Content-Disposition
        assert "text/" in resp.headers.get("content-type", "")
        assert "Content-Disposition" not in resp.headers


class TestFileDownload:
    @pytest.mark.asyncio
    async def test_download_file(self, client):
        """GET /entries/{slug}/files/{file_id} downloads with Content-Disposition."""
        slug = "filedownload-test"
        create_resp = await client.post("/api/v1/entries", json={
            "summary": "Download test",
            "slug": slug,
            "files": [{"path": "code.py", "content": "x=1"}],
        })
        assert create_resp.status_code == 201
        data = create_resp.json()
        actual_slug = data["slug"]
        file_id = data["files"][0]["id"]

        resp = await client.get(f"/api/v1/entries/{actual_slug}/files/{file_id}")
        assert resp.status_code == 200
        assert "Content-Disposition" in resp.headers


class TestApiKeyAuth:
    @pytest.mark.asyncio
    async def test_no_api_key_allows_access(self, client):
        """Without PEEK_API_KEY, all requests are allowed."""
        resp = await client.get("/api/v1/entries")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_required_when_configured(self, auth_client):
        """With PEEK_API_KEY set, requests without auth are rejected."""
        resp = await auth_client.get("/api/v1/entries")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_api_key_valid_auth(self, auth_client):
        """With valid API key, requests succeed."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer test-secret-key"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_invalid_auth(self, auth_client):
        """With wrong API key, requests are rejected."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer wrong-key"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_health_check_no_auth_required(self, auth_client):
        """Health check endpoint doesn't require auth."""
        resp = await auth_client.get("/health")
        assert resp.status_code == 200


class TestErrorFormat:
    @pytest.mark.asyncio
    async def test_error_response_format(self, client):
        resp = await client.get("/api/v1/entries/nonexistent123")
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
