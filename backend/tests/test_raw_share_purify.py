"""TDD tests for raw endpoint ?share= / ?purify= query params (TPV0092).

P3 red-light: get_entry_raw currently has no share/purify params (files.py:465),
so ?share= is ignored (private + valid share → 404) and ?purify= is ignored (raw
content returned unpurified). Tests BDD-21/23 fail until P4 implements the params.

Note: share-token raw requests MUST be made by a fresh ANONYMOUS client — the
owner client carries the JWT cookie and would direct-pass (owner access), which
would mask the share-token behavior being tested.

Test isolation mirrors test_raw_api.py (self-contained temp dir, no ~/.peekview).
"""

from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app

MARKDOWN_WITH_IMAGE = "![alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=)"


@pytest.fixture
async def client_and_app():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c, app
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _make_anon_client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _register(client, username: str) -> str:
    resp = await client.post(
        "/api/v1/auth/register", json={"username": username, "password": "testpass123"}
    )
    assert resp.status_code == 201, f"Register failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


async def _create_entry(client, token: str | None, content: str, slug: str | None = None) -> str:
    body = {
        "summary": "raw share test",
        "is_public": token is None,
        "files": [{"filename": "note.md", "content": content, "language": "markdown"}],
    }
    if slug:
        body["slug"] = slug
    resp = await client.post(
        "/api/v1/entries", json=body, headers=_auth(token) if token else None
    )
    assert resp.status_code in (200, 201), f"Create entry failed: {resp.text}"
    return resp.json()["slug"]


async def _create_share(client, token: str, slug: str) -> str:
    resp = await client.post(
        f"/api/v1/entries/{slug}/shares", json={"expires_in": "7d"}, headers=_auth(token)
    )
    assert resp.status_code == 201, f"Create share failed: {resp.text}"
    share_url = resp.json()["share_url"]
    return share_url.split("?share=")[1]


# BDD-21 + BDD-22 合一流程：匿名请求者先有效 token 断言 200（当前 404 → 红灯），再无效 token 断言 404
async def test_raw_share_valid_token_returns_content_invalid_token_404(client_and_app):
    client, app = client_and_app
    token = await _register(client, "alice")
    slug = await _create_entry(client, token, "private content", slug="share-priv")
    share_token = await _create_share(client, token, slug)
    anon = _make_anon_client(app)

    try:
        resp = await anon.get(f"/api/v1/entries/{slug}/raw?share={share_token}")

        assert resp.status_code == 200, f"Expected 200 with valid share, got {resp.status_code}"
        assert "share" not in resp.headers.get("set-cookie", ""), "raw ?share= must not set cookie"
        data = resp.json()
        assert data["slug"] == slug
        assert data["files"][0]["content"] == "private content"

        bad_resp = await anon.get(f"/api/v1/entries/{slug}/raw?share=invalidtoken123")
        assert bad_resp.status_code == 404, "Invalid share token must 404 (no existence leak)"
    finally:
        await anon.aclose()


# BDD-21: share 一次访问即可（无两步设 cookie）；响应是 EntryRawResponse 结构
async def test_raw_share_private_entry_returns_raw_response_structure(client_and_app):
    client, app = client_and_app
    token = await _register(client, "bob")
    slug = await _create_entry(client, token, "secret payload", slug="share-priv2")
    share_token = await _create_share(client, token, slug)
    anon = _make_anon_client(app)

    try:
        resp = await anon.get(f"/api/v1/entries/{slug}/raw?share={share_token}")

        assert resp.status_code == 200
        data = resp.json()
        assert set(["slug", "summary", "files", "raw_url"]).issubset(data.keys())
        assert "raw" in data["raw_url"]
    finally:
        await anon.aclose()


# P2-review 注意点 2：public entry + ?share= 直通（不误判 404）
async def test_raw_share_public_entry_direct_pass(client_and_app):
    client, app = client_and_app
    slug = await _create_entry(client, None, "public content", slug="share-pub")
    anon = _make_anon_client(app)

    try:
        resp = await anon.get(f"/api/v1/entries/{slug}/raw?share=whatever")

        assert resp.status_code == 200, "Public entry + ?share= must direct-pass (entries.py pattern)"
        assert resp.json()["files"][0]["content"] == "public content"
    finally:
        await anon.aclose()


# BDD-23: ?purify=true 剥离 base64 图片（当前被忽略 → 红灯）
async def test_raw_purify_strips_base64_image(client_and_app):
    client, _ = client_and_app
    slug = await _create_entry(client, None, MARKDOWN_WITH_IMAGE, slug="purify-img")

    resp = await client.get(f"/api/v1/entries/{slug}/raw?purify=true")

    assert resp.status_code == 200
    content = resp.json()["files"][0]["content"]
    assert re.search(r"\[image:.*\(\d+(\.\d+)? KB, base64\)\]", content), (
        f"purified content must contain placeholder, got: {content!r}"
    )
    assert "iVBORw0KGgoAAAANSUhEUgAAAAE=" not in content
    assert len(resp.text) < len(MARKDOWN_WITH_IMAGE) * 2, "response size should shrink"


# BDD-24: 无 query 缺省行为向后兼容（回归守卫）
async def test_raw_default_behavior_backward_compatible(client_and_app):
    client, _ = client_and_app
    slug = await _create_entry(client, None, MARKDOWN_WITH_IMAGE, slug="compat")

    resp = await client.get(f"/api/v1/entries/{slug}/raw")

    assert resp.status_code == 200
    assert resp.json()["files"][0]["content"] == MARKDOWN_WITH_IMAGE


# BDD-13 回归守卫：二进制文件 content=null + file_url（现有行为，P4 后仍须成立）
async def test_raw_binary_content_null_structure(client_and_app):
    import base64

    client, _ = client_and_app
    minimal_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": "binary",
            "is_public": True,
            "files": [{"filename": "logo.png", "content_base64": base64.b64encode(minimal_png).decode()}],
        },
    )
    assert resp.status_code in (200, 201)
    slug = resp.json()["slug"]

    data_resp = await client.get(f"/api/v1/entries/{slug}/raw?purify=true")

    assert data_resp.status_code == 200
    file_item = data_resp.json()["files"][0]
    assert file_item["is_binary"] is True
    assert file_item["content"] is None
    assert file_item["file_url"] is not None
