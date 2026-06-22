"""Tests for HTML render endpoint: GET /api/v1/entries/{slug}/files/{file_id}/render

TDD RED — route not yet implemented, all tests expected to fail.
Covers: route basics, access control, CSP directives, sibling injection.
"""

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app


@pytest.fixture(scope="function")
async def client():
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


SIMPLE_HTML = (
    "<!DOCTYPE html><html><head><title>Test</title></head>"
    "<body><h1>Hi</h1></body></html>"
)


async def _create_entry(client, files, summary="html render test"):
    """Create an entry with files; return (slug, files_list)."""
    resp = await client.post("/api/v1/entries", json={
        "summary": summary,
        "files": files,
    })
    assert resp.status_code == 201, resp.text
    entry = resp.json()
    return entry["slug"], entry["files"]


def _render_url(slug, file_id, inject=None):
    url = f"/api/v1/entries/{slug}/files/{file_id}/render"
    if inject is not None:
        url += f"?inject={inject}"
    return url


# ── Group 1: Route basics ──────────────────────────────────────────────


class TestRenderRouteBasics:
    @pytest.mark.asyncio
    async def test_render_returns_html(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_render_csp_allows_unsafe_inline(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "unsafe-inline" in csp

    @pytest.mark.asyncio
    async def test_render_no_xframe_deny(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        xfo = resp.headers.get("x-frame-options", "")
        assert xfo.upper() != "DENY"

    @pytest.mark.asyncio
    async def test_render_cache_control_nostore(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        cc = resp.headers.get("cache-control", "")
        assert "no-store" in cc


# ── Group 2: Access control ────────────────────────────────────────────


class TestRenderAccessControl:
    @pytest.mark.asyncio
    async def test_render_public_anonymous_ok(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_render_nonexistent_file_404(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, 999999))
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_render_non_html_file_404(self, client):
        slug, files = await _create_entry(client, [
            {"path": "main.py", "content": "print('hello')"},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 404


# ── Group 3: CSP directives ────────────────────────────────────────────


class TestRenderCSPDetails:
    @pytest.mark.asyncio
    async def test_csp_connect_src_allows_https(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "connect-src" in csp
        assert "https:" in csp

    @pytest.mark.asyncio
    async def test_csp_worker_src_allows_blob(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "worker-src" in csp
        assert "blob:" in csp

    @pytest.mark.asyncio
    async def test_csp_img_src_allows_https(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "img-src" in csp
        assert "https:" in csp

    @pytest.mark.asyncio
    async def test_csp_frame_ancestors_self(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "frame-ancestors" in csp
        assert "'self'" in csp


# ── Group 4: Sibling injection ─────────────────────────────────────────


class TestRenderSiblingInject:
    @pytest.mark.asyncio
    async def test_render_no_inject_returns_raw_html(self, client):
        html = "<!DOCTYPE html><html><head></head><body><p>raw</p></body></html>"
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": html},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200
        assert "<p>raw</p>" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_css(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
            {"path": "style.css", "content": "body { color: red; }"},
        ])
        html_id = files[0]["id"]
        css_id = files[1]["id"]
        resp = await client.get(_render_url(slug, html_id, inject=css_id))
        assert resp.status_code == 200
        assert "<style" in resp.text.lower()
        assert "color: red" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_js(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
            {"path": "app.js", "content": "console.log('injected');"},
        ])
        html_id = files[0]["id"]
        js_id = files[1]["id"]
        resp = await client.get(_render_url(slug, html_id, inject=js_id))
        assert resp.status_code == 200
        assert "<script" in resp.text.lower()
        assert "console.log('injected')" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_invalid_id_ignored(self, client):
        slug, files = await _create_entry(client, [
            {"path": "index.html", "content": SIMPLE_HTML},
        ])
        resp = await client.get(_render_url(slug, files[0]["id"], inject=999999))
        assert resp.status_code == 200
        assert "<h1>Hi</h1>" in resp.text
