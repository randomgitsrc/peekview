"""Tests for HTML render endpoint: GET /api/v1/entries/{slug}/files/{file_id}/render

Covers: route basics, access control, CSP directives, sibling injection,
module script injection, CSS internal refs, SVG-as-img, path normalization.
"""

import base64
import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app
from peekview.services.html_render_service import (
    SiblingFileData,
    _is_svg_file,
    _lookup_key,
    _process_css_refs,
    _sibling_keys,
    inject_resources,
    normalize_ref,
)


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


# ── Group 5: Module script injection (BDD-2a, BDD-2b) ──────────────────


class TestModuleScriptInjection:
    def test_module_script_inlined_with_type_preserved(self):
        html = '<html><head></head><body><script type="module" src="app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js", path=None,
                content='import { x } from "./dep.js"; console.log(x);',
                language="javascript", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'type="module"' in result
        assert 'import { x }' in result
        assert 'src="app.js"' not in result

    def test_module_script_not_duplicated_in_unreferenced(self):
        html = '<html><head></head><body><script type="module" src="app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js", path=None,
                content="console.log('mod');",
                language="javascript", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        count = result.count("console.log('mod')")
        assert count == 1

    def test_importmap_preserved_module_inlined(self):
        html = (
            '<html><head></head><body>'
            '<script type="importmap">{"imports": {"./dep.js": "./dep.js"}}</script>'
            '<script type="module" src="app.js"></script>'
            '</body></html>'
        )
        siblings = [
            SiblingFileData(
                filename="app.js", path=None,
                content="console.log('mod');",
                language="javascript", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'type="importmap"' in result
        assert '{"imports"' in result
        assert 'type="module"' in result
        assert "console.log('mod')" in result

    def test_text_javascript_script_still_works(self):
        html = '<html><head></head><body><script type="text/javascript" src="app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js", path=None,
                content="console.log('classic');",
                language="javascript", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "console.log('classic')" in result
        assert 'src="app.js"' not in result

    def test_other_type_script_skipped(self):
        html = '<html><head></head><body><script type="application/json" src="data.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="data.js", path=None,
                content='{"key": "val"}',
                language="json", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'type="application/json"' in result
        assert 'src="data.js"' in result


# ── Group 6: CSS internal reference injection (BDD-4a, BDD-4b, BDD-4c) ─


class TestCssInternalRefs:
    def test_process_css_refs_import_replaced(self):
        css = '@import url("theme.css");\nbody { color: blue; }'
        text_map = {"theme.css": "body { background: #eee; }"}
        result = _process_css_refs(css, text_map, {})
        assert "@import" not in result
        assert "background: #eee" in result
        assert "color: blue" in result

    def test_process_css_refs_import_with_single_quotes(self):
        css = "@import 'theme.css';\nbody { color: blue; }"
        text_map = {"theme.css": "body { background: #eee; }"}
        result = _process_css_refs(css, text_map, {})
        assert "@import" not in result
        assert "background: #eee" in result

    def test_process_css_refs_url_binary_replaced(self):
        css = 'body { background-image: url("bg.png"); }'
        text_map: dict[str, str] = {}
        binary_map: dict[str, SiblingFileData] = {
            "bg.png": SiblingFileData(
                filename="bg.png", path=None,
                content=base64.b64encode(b"\x89PNG").decode(),
                language=None, is_binary=True, mime_type="image/png",
            ),
        }
        result = _process_css_refs(css, text_map, binary_map)
        assert "data:image/png;base64," in result
        assert 'url("bg.png")' not in result

    def test_process_css_refs_url_svg_text_replaced(self):
        css = 'body { background-image: url("icon.svg"); }'
        text_map = {"icon.svg": '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'}
        svg_keys = {"icon.svg"}
        result = _process_css_refs(css, text_map, {}, svg_keys)
        assert "data:image/svg+xml;charset=utf-8," in result
        assert 'url("icon.svg")' not in result

    def test_process_css_refs_circular_import_terminates(self):
        css_a = '@import url("b.css");\n.a { color: red; }'
        css_b = '@import url("a.css");\n.b { color: blue; }'
        text_map = {"a.css": css_a, "b.css": css_b}
        result = _process_css_refs(css_a, text_map, {})
        assert ".a { color: red; }" in result
        assert ".b { color: blue; }" in result

    def test_process_css_refs_depth_limit(self):
        css_a = '@import url("b.css");\n.a {}'
        css_b = '@import url("c.css");\n.b {}'
        css_c = '@import url("d.css");\n.c {}'
        css_d = '.d {}'
        text_map = {"a.css": css_a, "b.css": css_b, "c.css": css_c, "d.css": css_d}
        result = _process_css_refs(css_a, text_map, {})
        assert ".a {}" in result
        assert ".b {}" in result
        assert ".c {}" in result

    def test_process_css_refs_external_url_left_alone(self):
        css = '@import url("https://cdn.example.com/reset.css");\nbody { color: red; }'
        result = _process_css_refs(css, {}, {})
        assert '@import url("https://cdn.example.com/reset.css")' in result

    def test_process_css_refs_url_not_found_left_alone(self):
        css = 'body { background: url("missing.png"); }'
        result = _process_css_refs(css, {}, {})
        assert 'url("missing.png")' in result

    def test_render_inject_css_with_import(self):
        html = '<html><head><link rel="stylesheet" href="main.css"></head><body></body></html>'
        siblings = [
            SiblingFileData(
                filename="main.css", path=None,
                content='@import url("theme.css");\nbody { color: red; }',
                language="css", is_binary=False, mime_type=None,
            ),
            SiblingFileData(
                filename="theme.css", path=None,
                content="body { background: #eee; }",
                language="css", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "background: #eee" in result
        assert "@import" not in result


# ── Group 7: SVG-as-img injection (BDD-5a, BDD-5b) ────────────────────


class TestSvgAsImg:
    def test_svg_img_inlined_as_data_uri(self):
        html = '<html><head></head><body><img src="diagram.svg"></body></html>'
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
        siblings = [
            SiblingFileData(
                filename="diagram.svg", path=None,
                content=svg_content,
                language="xml", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'data:image/svg+xml;charset=utf-8,' in result
        assert 'src="diagram.svg"' not in result

    def test_svg_img_by_extension(self):
        html = '<html><head></head><body><img src="icon.svg"></body></html>'
        siblings = [
            SiblingFileData(
                filename="icon.svg", path=None,
                content="<svg></svg>",
                language=None, is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/svg+xml;charset=utf-8," in result

    def test_binary_img_still_base64(self):
        html = '<html><head></head><body><img src="photo.png"></body></html>'
        siblings = [
            SiblingFileData(
                filename="photo.png", path=None,
                content=base64.b64encode(b"\x89PNG\r\n").decode(),
                language=None, is_binary=True, mime_type="image/png",
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/png;base64," in result

    def test_non_svg_text_img_not_replaced(self):
        html = '<html><head></head><body><img src="data.txt"></body></html>'
        siblings = [
            SiblingFileData(
                filename="data.txt", path=None,
                content="hello world",
                language="text", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'src="data.txt"' in result

    def test_is_svg_file_by_language(self):
        f = SiblingFileData(filename="d.xml", path=None, content="", language="xml", is_binary=False, mime_type=None)
        assert _is_svg_file(f) is True

    def test_is_svg_file_by_extension(self):
        f = SiblingFileData(filename="d.svg", path=None, content="", language=None, is_binary=False, mime_type=None)
        assert _is_svg_file(f) is True

    def test_is_svg_file_by_language_svg(self):
        f = SiblingFileData(filename="d", path=None, content="", language="svg", is_binary=False, mime_type=None)
        assert _is_svg_file(f) is True

    def test_is_svg_file_negative(self):
        f = SiblingFileData(filename="d.js", path=None, content="", language="javascript", is_binary=False, mime_type=None)
        assert _is_svg_file(f) is False


# ── Group 8: Path normalization (BDD-6a, BDD-6b) ──────────────────────


class TestPathNormalization:
    def test_sibling_keys_basename_fallback(self):
        f = SiblingFileData(
            filename="app.js", path="js/app.js",
            content="", language="javascript", is_binary=False, mime_type=None,
        )
        keys = _sibling_keys(f)
        assert "app.js" in keys
        assert "js/app.js" in keys

    def test_sibling_keys_no_duplicate_basename(self):
        f = SiblingFileData(
            filename="style.css", path="style.css",
            content="", language="css", is_binary=False, mime_type=None,
        )
        keys = _sibling_keys(f)
        assert keys.count("style.css") == 1

    def test_lookup_key_direct_match(self):
        m = {"style.css": "content"}
        assert _lookup_key("style.css", m) == "style.css"

    def test_lookup_key_basename_fallback(self):
        m = {"style.css": "content"}
        assert _lookup_key("../style.css", m) == "style.css"

    def test_lookup_key_no_match(self):
        m = {"other.css": "content"}
        assert _lookup_key("../style.css", m) is None

    def test_lookup_key_basename_same_as_key(self):
        m = {"style.css": "content"}
        assert _lookup_key("style.css", m) == "style.css"

    def test_relative_path_css_injected(self):
        html = '<html><head><link rel="stylesheet" href="../style.css"></head><body></body></html>'
        siblings = [
            SiblingFileData(
                filename="style.css", path=None,
                content="body { color: red; }",
                language="css", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "color: red" in result
        assert 'href="../style.css"' not in result

    def test_relative_path_js_injected(self):
        html = '<html><head></head><body><script src="../js/app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js", path="js/app.js",
                content="console.log('app');",
                language="javascript", is_binary=False, mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "console.log('app')" in result
        assert 'src="../js/app.js"' not in result

    def test_relative_path_img_injected(self):
        html = '<html><head></head><body><img src="../images/photo.png"></body></html>'
        siblings = [
            SiblingFileData(
                filename="photo.png", path="images/photo.png",
                content=base64.b64encode(b"\x89PNG").decode(),
                language=None, is_binary=True, mime_type="image/png",
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/png;base64," in result
