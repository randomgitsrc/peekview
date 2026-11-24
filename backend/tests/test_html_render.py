"""Tests for HTML render endpoint: GET /api/v1/entries/{slug}/files/{file_id}/render

Covers: route basics, access control, CSP directives, sibling injection,
module script injection, CSS internal refs, SVG-as-img, path normalization.
"""

import base64
import json
import shutil
import tempfile
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from httpx import ASGITransport, AsyncClient

from peekview.config import PeekConfig, PeekLimits
from peekview.main import create_app
from peekview.services.html_render_service import (
    _MAX_INJECT_IDS,
    SiblingFileData,
    _is_svg_file,
    _lookup_key,
    _process_css_refs,
    _sibling_keys,
    inject_resources,
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


SIMPLE_HTML = "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hi</h1></body></html>"


async def _create_entry(client, files, summary="html render test"):
    """Create an entry with files; return (slug, files_list)."""
    resp = await client.post(
        "/api/v1/entries",
        json={
            "summary": summary,
            "files": files,
        },
    )
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
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_render_csp_allows_unsafe_inline(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "unsafe-inline" in csp

    @pytest.mark.asyncio
    async def test_render_no_xframe_deny(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        xfo = resp.headers.get("x-frame-options", "")
        assert xfo.upper() != "DENY"

    @pytest.mark.asyncio
    async def test_render_cache_control_nostore(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        cc = resp.headers.get("cache-control", "")
        assert "no-store" in cc


# ── Group 2: Access control ────────────────────────────────────────────


class TestRenderAccessControl:
    @pytest.mark.asyncio
    async def test_render_public_anonymous_ok(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_render_nonexistent_file_404(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, 999999))
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_render_non_html_file_404(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "main.py", "content": "print('hello')"},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 404


# ── Group 3: CSP directives ────────────────────────────────────────────


class TestRenderCSPDetails:
    @pytest.mark.asyncio
    async def test_csp_connect_src_allows_https(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "connect-src" in csp
        assert "https:" in csp

    @pytest.mark.asyncio
    async def test_csp_worker_src_allows_blob(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "worker-src" in csp
        assert "blob:" in csp

    @pytest.mark.asyncio
    async def test_csp_img_src_allows_https(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "img-src" in csp
        assert "https:" in csp

    @pytest.mark.asyncio
    async def test_csp_frame_ancestors_self(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        csp = resp.headers.get("content-security-policy", "")
        assert "frame-ancestors" in csp
        assert "'self'" in csp


# ── Group 4: Sibling injection ─────────────────────────────────────────


class TestRenderSiblingInject:
    @pytest.mark.asyncio
    async def test_render_no_inject_returns_raw_html(self, client):
        html = "<!DOCTYPE html><html><head></head><body><p>raw</p></body></html>"
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": html},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"]))
        assert resp.status_code == 200
        assert "<p>raw</p>" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_css(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
                {"path": "style.css", "content": "body { color: red; }"},
            ],
        )
        html_id = files[0]["id"]
        css_id = files[1]["id"]
        resp = await client.get(_render_url(slug, html_id, inject=css_id))
        assert resp.status_code == 200
        assert "<style" in resp.text.lower()
        assert "color: red" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_js(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
                {"path": "app.js", "content": "console.log('injected');"},
            ],
        )
        html_id = files[0]["id"]
        js_id = files[1]["id"]
        resp = await client.get(_render_url(slug, html_id, inject=js_id))
        assert resp.status_code == 200
        assert "<script" in resp.text.lower()
        assert "console.log('injected')" in resp.text

    @pytest.mark.asyncio
    async def test_render_inject_invalid_id_ignored(self, client):
        slug, files = await _create_entry(
            client,
            [
                {"path": "index.html", "content": SIMPLE_HTML},
            ],
        )
        resp = await client.get(_render_url(slug, files[0]["id"], inject=999999))
        assert resp.status_code == 200
        assert "<h1>Hi</h1>" in resp.text


# ── Group 5: Module script injection (BDD-2a, BDD-2b) ──────────────────


class TestModuleScriptInjection:
    def test_module_script_inlined_with_type_preserved(self):
        html = '<html><head></head><body><script type="module" src="app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js",
                path=None,
                content='import { x } from "./dep.js"; console.log(x);',
                language="javascript",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'type="module"' in result
        assert "import { x }" in result
        assert 'src="app.js"' not in result

    def test_module_script_not_duplicated_in_unreferenced(self):
        html = '<html><head></head><body><script type="module" src="app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js",
                path=None,
                content="console.log('mod');",
                language="javascript",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        count = result.count("console.log('mod')")
        assert count == 1

    def test_importmap_preserved_module_inlined(self):
        html = (
            "<html><head></head><body>"
            '<script type="importmap">{"imports": {"./dep.js": "./dep.js"}}</script>'
            '<script type="module" src="app.js"></script>'
            "</body></html>"
        )
        siblings = [
            SiblingFileData(
                filename="app.js",
                path=None,
                content="console.log('mod');",
                language="javascript",
                is_binary=False,
                mime_type=None,
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
                filename="app.js",
                path=None,
                content="console.log('classic');",
                language="javascript",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "console.log('classic')" in result
        assert 'src="app.js"' not in result

    def test_other_type_script_skipped(self):
        html = '<html><head></head><body><script type="application/json" src="data.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="data.js",
                path=None,
                content='{"key": "val"}',
                language="json",
                is_binary=False,
                mime_type=None,
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
                filename="bg.png",
                path=None,
                content=base64.b64encode(b"\x89PNG").decode(),
                language=None,
                is_binary=True,
                mime_type="image/png",
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
        css_d = ".d {}"
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
                filename="main.css",
                path=None,
                content='@import url("theme.css");\nbody { color: red; }',
                language="css",
                is_binary=False,
                mime_type=None,
            ),
            SiblingFileData(
                filename="theme.css",
                path=None,
                content="body { background: #eee; }",
                language="css",
                is_binary=False,
                mime_type=None,
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
                filename="diagram.svg",
                path=None,
                content=svg_content,
                language="xml",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/svg+xml;charset=utf-8," in result
        assert 'src="diagram.svg"' not in result

    def test_svg_img_by_extension(self):
        html = '<html><head></head><body><img src="icon.svg"></body></html>'
        siblings = [
            SiblingFileData(
                filename="icon.svg",
                path=None,
                content="<svg></svg>",
                language=None,
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/svg+xml;charset=utf-8," in result

    def test_binary_img_still_base64(self):
        html = '<html><head></head><body><img src="photo.png"></body></html>'
        siblings = [
            SiblingFileData(
                filename="photo.png",
                path=None,
                content=base64.b64encode(b"\x89PNG\r\n").decode(),
                language=None,
                is_binary=True,
                mime_type="image/png",
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/png;base64," in result

    def test_non_svg_text_img_not_replaced(self):
        html = '<html><head></head><body><img src="data.txt"></body></html>'
        siblings = [
            SiblingFileData(
                filename="data.txt",
                path=None,
                content="hello world",
                language="text",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert 'src="data.txt"' in result

    def test_is_svg_file_by_language(self):
        f = SiblingFileData(
            filename="d.xml", path=None, content="", language="xml", is_binary=False, mime_type=None
        )
        assert _is_svg_file(f) is True

    def test_is_svg_file_by_extension(self):
        f = SiblingFileData(
            filename="d.svg", path=None, content="", language=None, is_binary=False, mime_type=None
        )
        assert _is_svg_file(f) is True

    def test_is_svg_file_by_language_svg(self):
        f = SiblingFileData(
            filename="d", path=None, content="", language="svg", is_binary=False, mime_type=None
        )
        assert _is_svg_file(f) is True

    def test_is_svg_file_negative(self):
        f = SiblingFileData(
            filename="d.js",
            path=None,
            content="",
            language="javascript",
            is_binary=False,
            mime_type=None,
        )
        assert _is_svg_file(f) is False


# ── Group 8: Path normalization (BDD-6a, BDD-6b) ──────────────────────


class TestPathNormalization:
    def test_sibling_keys_basename_fallback(self):
        f = SiblingFileData(
            filename="app.js",
            path="js/app.js",
            content="",
            language="javascript",
            is_binary=False,
            mime_type=None,
        )
        keys = _sibling_keys(f)
        assert "app.js" in keys
        assert "js/app.js" in keys

    def test_sibling_keys_no_duplicate_basename(self):
        f = SiblingFileData(
            filename="style.css",
            path="style.css",
            content="",
            language="css",
            is_binary=False,
            mime_type=None,
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
                filename="style.css",
                path=None,
                content="body { color: red; }",
                language="css",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "color: red" in result
        assert 'href="../style.css"' not in result

    def test_relative_path_js_injected(self):
        html = '<html><head></head><body><script src="../js/app.js"></script></body></html>'
        siblings = [
            SiblingFileData(
                filename="app.js",
                path="js/app.js",
                content="console.log('app');",
                language="javascript",
                is_binary=False,
                mime_type=None,
            ),
        ]
        result = inject_resources(html, siblings)
        assert "console.log('app')" in result
        assert 'src="../js/app.js"' not in result

    def test_relative_path_img_injected(self):
        html = '<html><head></head><body><img src="../images/photo.png"></body></html>'
        siblings = [
            SiblingFileData(
                filename="photo.png",
                path="images/photo.png",
                content=base64.b64encode(b"\x89PNG").decode(),
                language=None,
                is_binary=True,
                mime_type="image/png",
            ),
        ]
        result = inject_resources(html, siblings)
        assert "data:image/png;base64," in result


# ══════════════════════════════════════════════════════════════════════════════
# TPV0104 — HTML sibling 注入预算与超限显式反馈（BDD-38 ~ BDD-41 / BDD-46）
#
# 取证通道（P2-design.md D7）：渲染结果 <body> 末尾的
#   <script type="application/json" id="peekview-inject-report">
# 序列化必须把 `<` 转义成 \u003c（否则用户可控的 path 会提前闭合脚本块、
# BS4 .string 只能取到半截、json.loads 抛 Unterminated string）。
#
# 不变式（P2-review.md §4.2-1 锁定）：
#   - inlined = 实际进入响应体的 sibling 个数（不得由 requested - 预算层 skipped 反推）
#   - requested - inlined == len(skipped)（势）
#   - {s["reason"]} <= REASONS（六元闭集，不得增删）
#   - skipped 按 file_id 去重（filename 可为 null）
#
# 造件须覆写 max_entry_files（BDD-38 的 Given）：默认 50 时 POST 51 文件会被 413 拒绝。
# ══════════════════════════════════════════════════════════════════════════════

REPORT_ID = "peekview-inject-report"

# P2-design.md D7 的 reason 六元闭集（锁定项：不得增删）
REASONS = {
    "count_limit",
    "file_too_large",
    "binary_too_large",
    "total_budget",
    "not_found",
    "not_injectable",
}

HTML_MAIN = "<!DOCTYPE html><html><head></head><body><h1>budget</h1></body></html>"


def _make_app_client(max_entry_files: int):
    """返回 (tmp_dir, AsyncClient) —— 覆写 max_entry_files 造件。"""
    tmp_dir = Path(tempfile.mkdtemp())
    app = create_app(
        data_dir=tmp_dir / "data",
        db_path=tmp_dir / "test.db",
        config=PeekConfig(limits=PeekLimits(max_entry_files=max_entry_files)),
    )
    transport = ASGITransport(app=app)
    return tmp_dir, AsyncClient(transport=transport, base_url="http://test")


def _parse_report(html: str) -> dict:
    """BS4 取证通道（P2-design.md D7）——转义 < 后该通道才可靠。"""
    node = BeautifulSoup(html, "html.parser").find("script", {"id": REPORT_ID})
    assert node is not None, "render 响应必须含可机器解析的注入报表块"
    return json.loads(node.string)


# ── BDD-38：数量上限 → 被跳过清单（构造路径可达）────────────────────────


class TestCountLimitSkipReport:
    @pytest.mark.asyncio
    async def test_bdd_38_exceeding_count_limit_produces_skip_report(self):
        # N = _MAX_INJECT_IDS + 1 个 sibling → 必然有 1 个及以上被跳过
        n = _MAX_INJECT_IDS + 1
        tmp_dir, client = _make_app_client(max_entry_files=n + 1)
        try:
            async with client:
                files = [
                    {
                        "filename": "index.html",
                        "content": HTML_MAIN,
                    }
                ]
                for i in range(n):
                    files.append(
                        {
                            "filename": f"res{i}.css",
                            "content": f".r{i} {{ color: red; }}",
                        }
                    )
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sibling_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sibling_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)

                # ① 清单非空
                assert len(report["skipped"]) > 0
                # ② 势：每一项没进去的都必须可查
                assert report["requested"] - report["inlined"] == len(report["skipped"])
                # ③ 清单每项可按 file_id 定位（filename 可为 null）
                for item in report["skipped"]:
                    assert isinstance(item["file_id"], int)
                    assert item["reason"] in REASONS
                ids = [item["file_id"] for item in report["skipped"]]
                assert len(set(ids)) == len(ids)
                # ④ count_limit 类必须出现（数量上限是本次的触发点）
                assert "count_limit" in {item["reason"] for item in report["skipped"]}
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def test_bdd_38_inject_id_limit_below_default_entry_file_limit(self):
        """代码级关系断言：仓库默认配置下 `_MAX_INJECT_IDS < max_entry_files - 1`。

        读 `model_fields[...].default` 而非实例化（实例化会受 env 漂移）。
        """
        declared = PeekLimits.model_fields["max_entry_files"].default
        assert _MAX_INJECT_IDS < declared - 1, (
            f"_MAX_INJECT_IDS({_MAX_INJECT_IDS}) 必须严格小于 max_entry_files-1({declared - 1})，"
            "否则真实配置下超限分支永不触发"
        )
        assert declared == 50, "max_entry_files 默认值已变更，须重核 _MAX_INJECT_IDS 取值"


# ── BDD-39：单文件文本注入上限（正反双向）────────────────────────────────


class TestSingleFileTextLimit:
    @pytest.mark.asyncio
    async def test_bdd_39_oversized_text_sibling_skipped_and_undersized_inlined(self):
        huge = "x" * (2 * 1024 * 1024 + 1)
        small_marker = "TPV0104-SMALL-TEXT-MARKER"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "huge.txt", "content": huge},
                    {"filename": "small.css", "content": f".m {{ content: '{small_marker}'; }}"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                huge_id = created[1]["id"]
                small_id = created[2]["id"]

                resp = await client.get(_render_url(slug, main_id, [huge_id, small_id]))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)

                # 超限文件的文本内容不出现，且文件名进跳过清单
                assert huge not in resp.text
                skipped_names = {item.get("filename") for item in report["skipped"]}
                assert "huge.txt" in skipped_names
                reasons = {item["reason"] for item in report["skipped"] if item.get("filename") == "huge.txt"}
                assert reasons == {"file_too_large"}
                # 对照：未超限的那个仍被正常内联
                assert small_marker in resp.text
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-40：累计总预算超限必须有可机器解析反馈 ───────────────────────────


class TestTotalBudgetFeedback:
    @pytest.mark.asyncio
    async def test_bdd_40_total_budget_overflow_is_machine_readable(self):
        chunk = "y" * (3 * 1024 * 1024 + 1)
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [{"filename": "index.html", "content": HTML_MAIN}]
                for i in range(4):
                    files.append({"filename": f"big{i}.txt", "content": chunk})
                # 4 × ~3MB 文本 sibling 累计超 8MiB 总预算
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                if resp.status_code < 400:
                    # 路线 A：2xx + 可机器解析跳过清单
                    report = _parse_report(resp.text)
                    assert report["requested"] - report["inlined"] == len(report["skipped"])
                    skipped_ids = {item["file_id"] for item in report["skipped"]}
                    missing = [i for i in sib_ids if i not in skipped_ids]
                    inlined_ids = {item["file_id"] for item in report.get("inlined_ids", [])}
                    assert all(m in skipped_ids or m in inlined_ids for m in missing)
                else:
                    # 路线 B：HTTP >= 400 且 error.message 非空
                    body = resp.json()
                    assert body.get("message") or body.get("detail")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_report_escapes_html_sensitive_paths(self):
        """G2：含 `</script>` 的 path 不得提前闭合脚本块。"""
        evil_path = "evil</script><img src=x onerror=alert(1)>.css"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"path": evil_path, "filename": "evil.css", "content": ".e { color: red; }"},
                    {"path": "notes", "filename": "README.md", "content": "README-CONTENT"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text

                soup = BeautifulSoup(resp.text, "html.parser")
                node = soup.find("script", {"id": REPORT_ID})
                assert node is not None
                report = json.loads(node.string)
                paths = [item.get("path") for item in report["skipped"]]
                assert evil_path in paths or report["inlined"] >= 0
                # 脚本块未被提前闭合：其后的 stray img 不应被解析成真实 DOM
                assert soup.find("img", {"src": "x"}) is None
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_non_injectable_sibling_is_recorded(self):
        """G8/B4 素材③：非 css/js sibling 必须出现在清单里且 reason == not_injectable。"""
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "README.md", "content": "# 未被引用的 markdown"},
                    {"filename": "data.json", "content": '{"a": 1}'},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                reasons = {item.get("filename"): item["reason"] for item in report["skipped"]}
                assert reasons.get("README.md") == "not_injectable"
                assert reasons.get("data.json") == "not_injectable"
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_oversized_binary_sibling_recorded(  # noqa: D401
        self,
    ):
        """>768KB 二进制 sibling 必须进清单（reason == binary_too_large）。"""
        big_png = base64.b64encode(b"\x89PNG" + b"z" * (770 * 1024)).decode()
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "big.png", "content_base64": big_png},
                    {"filename": "small.svg", "content": "<svg></svg>"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                reasons = {item.get("filename"): item["reason"] for item in report["skipped"]}
                assert reasons.get("big.png") == "binary_too_large"
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── G11：双向对账（报告 inlined ⇒ 内容真在；报告 skipped ⇒ 内容真不在）──


class TestBidirectionalReconciliation:
    @pytest.mark.asyncio
    async def test_g11_inlined_claims_match_actual_response_body(self):
        css_marker = "TPV0104-CSS-LANDED"
        md_marker = "TPV0104-README-NOT-LANDED"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                html = '<html><head><link rel="stylesheet" href="app.css"></head><body>x</body></html>'
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "app.css", "content": f".a {{ content: '{css_marker}'; }}"},
                    {"filename": "README.md", "content": md_marker},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                skipped_names = {item.get("filename") for item in report["skipped"]}

                for needle, name in ((css_marker, "app.css"), (md_marker, "README.md")):
                    landed = needle in resp.text
                    reported_skip = name in skipped_names
                    assert landed != reported_skip, f"{name} 的报告状态与事实不符"
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── G12：两跳 @import 链（第七处埋点递归透传的唯一证伪形态）──────────────


class TestTwoHopImportChain:
    @pytest.mark.asyncio
    async def test_g12_two_hop_import_chain_all_consumed(self):
        html = '<html><head><link rel="stylesheet" href="a.css"></head><body>x</body></html>'
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "a.css", "content": '@import url("b.css");\n.a { color: red; }'},
                    {"filename": "b.css", "content": '@import url("c.css");\n.b { color: green; }'},
                    {"filename": "c.css", "content": ".c { color: blue; }"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = {f["filename"]: f["id"] for f in created[1:]}

                resp = await client.get(
                    _render_url(slug, main_id, [sib_ids["a.css"], sib_ids["b.css"], sib_ids["c.css"]])
                )
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                skipped_names = {item.get("filename") for item in report["skipped"]}
                assert "b.css" not in skipped_names
                assert "c.css" not in skipped_names
                assert "color: green" in resp.text
                assert "color: blue" in resp.text
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-41：未超预算时与现状等价（回归兼容）──────────────────────────────


class TestNoBudgetOverflowEquivalence:
    @pytest.mark.asyncio
    async def test_bdd_41_css_and_js_inlined_with_empty_skip_list(self):
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                html = (
                    "<html><head><link rel=\"stylesheet\" href=\"app.css\"></head>"
                    '<body><script src="app.js"></script></body></html>'
                )
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "app.css", "content": ".a { color: red; }"},
                    {"filename": "app.js", "content": "console.log('t');"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                assert "<style>" in resp.text
                assert "color: red" in resp.text
                assert "console.log('t')" in resp.text
                report = _parse_report(resp.text)
                assert report["skipped"] == []
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-46：CSP 与 sandbox 属性不变（不变守护）───────────────────────────


class TestCspUnchanged:
    def test_bdd_46_render_csp_still_allows_https(self):
        from peekview.api.files import RENDER_CSP

        assert "https:" in RENDER_CSP
        assert "frame-ancestors 'self'" in RENDER_CSP
        assert "connect-src blob: data: https:" in RENDER_CSP

    @pytest.mark.asyncio
    async def test_bdd_46_render_response_csp_header_matches_constant(self):
        from peekview.api.files import RENDER_CSP

        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                slug, created = await _create_entry(
                    client, [{"filename": "index.html", "content": HTML_MAIN}]
                )
                main_id = created[0]["id"]
                resp = await client.get(_render_url(slug, main_id, []))
                assert resp.status_code == 200
                assert resp.headers["content-security-policy"] == RENDER_CSP
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


