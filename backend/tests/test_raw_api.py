"""TDD tests for GET /api/v1/entries/{slug}/raw endpoint.

All tests are RED initially — endpoint does not exist yet.
Tests define the contract; implementation makes them green.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app


@pytest.fixture
async def client():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
async def client_with_key(monkeypatch):
    monkeypatch.setenv("PEEKVIEW_SERVER__API_KEY", "test-key-abc")
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _create_public_entry(client, content: str, filename: str = "README.md", language: str = "markdown") -> str:
    """Helper: create public entry, return slug."""
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": "test entry",
            "is_public": True,
            "files": [{"filename": filename, "content": content, "language": language}],
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["slug"]


async def _create_private_entry(client, content: str) -> str:
    """Helper: create private entry via authenticated client."""
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": "private entry",
            "is_public": False,
            "files": [{"filename": "secret.md", "content": content, "language": "markdown"}],
        },
        headers={"Authorization": "Bearer test-key-abc"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["slug"]


# AC1: 公开单文件 entry 返回原始内容
async def test_raw_public_single_file_markdown(client):
    content = "# Hello\n\nThis is **markdown** content."
    slug = await _create_public_entry(client, content)

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["slug"] == slug
    assert len(data["files"]) == 1
    assert data["files"][0]["content"] == content
    assert data["files"][0]["language"] == "markdown"
    assert data["files"][0]["is_binary"] is False
    assert data["files"][0]["filename"] == "README.md"


# AC1: UTF-8 内容正确返回（含中文、特殊字符）
async def test_raw_returns_utf8_content_correctly(client):
    content = "# 中文标题\n\ncafé résumé 日本語\n特殊字符: <>&\"'"
    slug = await _create_public_entry(client, content)

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code in (200, 201)
    assert resp.json()["files"][0]["content"] == content


# AC2: 多文件 entry 返回所有文件
async def test_raw_multi_file_returns_all_files(client):
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": "multi-file entry",
            "is_public": True,
            "files": [
                {"filename": "main.py", "content": "print('hello')", "language": "python"},
                {"filename": "README.md", "content": "# Readme", "language": "markdown"},
            ],
        },
    )
    assert resp.status_code in (200, 201)
    slug = resp.json()["slug"]

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert len(data["files"]) == 2
    filenames = {f["filename"] for f in data["files"]}
    assert "main.py" in filenames
    assert "README.md" in filenames


# AC3: 私有 entry 未认证返回 401（或 404，防枚举策略）
async def test_raw_private_entry_unauthenticated_returns_401(client_with_key):
    slug = await _create_private_entry(client_with_key, "secret content")

    resp = await client_with_key.get(f"/api/v1/entries/{slug}/raw")  # no auth header

    # 现有策略：私有 entry 对未认证用户返回 404（防止 slug 枚举）
    assert resp.status_code in (401, 404)


# AC4: 私有 entry 有效 API Key 返回内容
async def test_raw_private_entry_with_api_key_returns_content(client_with_key):
    content = "top secret content"
    slug = await _create_private_entry(client_with_key, content)

    resp = await client_with_key.get(
        f"/api/v1/entries/{slug}/raw",
        headers={"Authorization": "Bearer test-key-abc"},
    )

    assert resp.status_code in (200, 201)
    assert resp.json()["files"][0]["content"] == content


# AC5: 二进制文件返回 file_url 不返回 content
async def test_raw_binary_file_returns_file_url_not_content(client):
    # 上传一个 PNG（最小合法 PNG）
    import base64
    minimal_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": "image entry",
            "is_public": True,
            "files": [{
                "filename": "logo.png",
                "content_base64": base64.b64encode(minimal_png).decode(),
            }],
        },
    )
    assert resp.status_code in (200, 201)
    slug = resp.json()["slug"]

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code in (200, 201)
    file_item = resp.json()["files"][0]
    assert file_item["is_binary"] is True
    assert file_item["content"] is None
    assert file_item["file_url"] is not None
    assert "/content" in file_item["file_url"]


# AC6: 不存在的 entry 返回 404
async def test_raw_nonexistent_entry_returns_404(client):
    resp = await client.get("/api/v1/entries/doesnotexist/raw")
    assert resp.status_code == 404


# AC1: 响应 JSON 包含必要字段
async def test_raw_response_schema_has_required_fields(client):
    slug = await _create_public_entry(client, "content")

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    data = resp.json()
    assert "slug" in data
    assert "summary" in data
    assert "files" in data
    assert "raw_url" in data
    assert "created_at" in data

    file_item = data["files"][0]
    assert "filename" in file_item
    assert "language" in file_item
    assert "is_binary" in file_item
    assert "content" in file_item
    assert "content_encoding" in file_item
    assert "file_url" in file_item


# AC1: </script> 序列在 JSON 响应中被安全转义
async def test_raw_content_no_script_injection(client):
    # 内容含 </script> 序列
    content = 'var x = "</script><script>alert(1)</script>";'
    slug = await _create_public_entry(client, content, filename="x.js", language="javascript")

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code in (200, 201)
    # 原始 </script> 不能出现在响应体里（需要被转义）
    assert "</script>" not in resp.text
    # 但解析后的 JSON content 字段应该还原为原始内容
    parsed_content = resp.json()["files"][0]["content"]
    assert parsed_content == content


# AC7: raw_url 字段指向本接口自身
async def test_raw_url_in_response_matches_request(client):
    slug = await _create_public_entry(client, "content")

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    data = resp.json()
    assert slug in data["raw_url"]
    assert "raw" in data["raw_url"]


# --- Raw shortlink redirect tests (T009) ---


# T009-AC1: 公开 entry 短链接 redirect 到 raw API
async def test_raw_shortlink_public_entry_redirects(client):
    content = "# Hello"
    slug = await _create_public_entry(client, content)

    resp = await client.get(f"/{slug}/raw", follow_redirects=False)

    assert resp.status_code == 302
    assert resp.headers["location"] == f"/api/v1/entries/{slug}/raw"


# T009-AC2: 不存在的 slug 短链接仍 redirect（由目标路由返回 404）
async def test_raw_shortlink_nonexistent_slug_still_redirects(client):
    resp = await client.get("/noexist/raw", follow_redirects=False)

    assert resp.status_code == 302
    assert resp.headers["location"] == "/api/v1/entries/noexist/raw"


# T009-AC3: 私有 entry 短链接 redirect 后目标路由处理认证
async def test_raw_shortlink_private_entry_redirects_then_auth(client_with_key):
    slug = await _create_private_entry(client_with_key, "secret content")

    resp = await client_with_key.get(f"/{slug}/raw", follow_redirects=False)

    assert resp.status_code == 302
    assert resp.headers["location"] == f"/api/v1/entries/{slug}/raw"

    # Follow redirect — target route should return 401 or 404 for unauthenticated
    follow_resp = await client_with_key.get(f"/api/v1/entries/{slug}/raw")
    assert follow_resp.status_code in (401, 404)
