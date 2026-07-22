"""Tests for _determine_content_type and /content endpoint Content-Type behavior.

TDD red phase: these tests MUST fail because _determine_content_type is not yet implemented.
Expected failure: ImportError when importing _determine_content_type from peekview.api.files.
"""

from __future__ import annotations

import pytest

from peekview.api.files import _determine_content_type
from peekview.models import File


def _make_file(
    path: str | None = "test.png",
    filename: str = "test.png",
    language: str | None = None,
    is_binary: bool = True,
    size: int = 100,
    entry_id: int = 1,
) -> File:
    return File(
        entry_id=entry_id,
        path=path,
        filename=filename,
        language=language,
        is_binary=is_binary,
        size=size,
    )


class TestDetermineContentTypeBinary:
    def test_png_returns_image_png(self):
        f = _make_file(path="arch.png", filename="arch.png", language=None, is_binary=True)
        assert _determine_content_type(f) == "image/png"

    def test_jpeg_returns_image_jpeg(self):
        f = _make_file(path="photo.jpg", filename="photo.jpg", language=None, is_binary=True)
        assert _determine_content_type(f) == "image/jpeg"

    def test_gif_returns_image_gif(self):
        f = _make_file(path="anim.gif", filename="anim.gif", language=None, is_binary=True)
        assert _determine_content_type(f) == "image/gif"

    def test_webp_returns_image_webp(self):
        f = _make_file(path="img.webp", filename="img.webp", language=None, is_binary=True)
        assert _determine_content_type(f) == "image/webp"

    def test_pdf_returns_application_pdf(self):
        f = _make_file(path="doc.pdf", filename="doc.pdf", language=None, is_binary=True)
        assert _determine_content_type(f) == "application/pdf"

    def test_unknown_binary_returns_octet_stream(self):
        f = _make_file(path="data.bin", filename="data.bin", language=None, is_binary=True)
        assert _determine_content_type(f) == "application/octet-stream"


class TestDetermineContentTypeText:
    def test_python_returns_text_x_python(self):
        f = _make_file(path="main.py", filename="main.py", language="python", is_binary=False)
        assert _determine_content_type(f) == "text/x-python"

    def test_css_returns_text_css(self):
        f = _make_file(path="style.css", filename="style.css", language="css", is_binary=False)
        assert _determine_content_type(f) == "text/css"

    def test_javascript_returns_text_javascript(self):
        f = _make_file(path="app.js", filename="app.js", language="javascript", is_binary=False)
        assert _determine_content_type(f) == "text/javascript"

    def test_json_returns_application_json(self):
        f = _make_file(path="data.json", filename="data.json", language="json", is_binary=False)
        assert _determine_content_type(f) == "application/json"


class TestDetermineContentTypeEdgeCases:
    def test_svg_no_language_returns_image_svg_xml(self):
        f = _make_file(path="diagram.svg", filename="diagram.svg", language=None, is_binary=False)
        assert _determine_content_type(f) == "image/svg+xml"

    def test_svg_language_xml_returns_text_xml(self):
        f = _make_file(path="diagram.svg", filename="diagram.svg", language="xml", is_binary=False)
        assert _determine_content_type(f) == "text/xml"

    def test_null_path_uses_filename_for_mimetypes(self):
        f = _make_file(path=None, filename="photo.jpg", language=None, is_binary=True)
        assert _determine_content_type(f) == "image/jpeg"


class TestDetermineContentTypeThreeLevelFallback:
    def test_level1_language_to_content_type_hit(self):
        f = _make_file(path="main.py", filename="main.py", language="python", is_binary=False)
        result = _determine_content_type(f)
        assert result == "text/x-python"
        assert "text/plain" not in result

    def test_level2_language_to_mime_hit(self):
        f = _make_file(
            path="custom.css", filename="custom.css",
            language="css", is_binary=True,
        )
        result = _determine_content_type(f)
        assert result == "text/css"

    def test_level3_mimetypes_guess_type_hit(self):
        f = _make_file(path="screenshot.png", filename="screenshot.png", language=None, is_binary=True)
        result = _determine_content_type(f)
        assert result == "image/png"

    def test_level4_fallback_octet_stream(self):
        f = _make_file(path="unknown.zzzz", filename="unknown.zzzz", language=None, is_binary=True)
        result = _determine_content_type(f)
        assert result == "application/octet-stream"


class TestContentEndpointContentType:
    @pytest.fixture
    async def _setup_entry_with_file(self, client, tmp_path):

        from httpx import ASGITransport, AsyncClient

        from peekview.main import create_app

        data_dir = tmp_path / "data"
        data_dir.mkdir(exist_ok=True)
        db_path = tmp_path / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

    @pytest.mark.asyncio
    async def test_png_content_endpoint_returns_image_png(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "PNG test",
            "slug": "png-test",
            "files": [{"path": "screenshot.png", "content": "iVBORw0KGgo="}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "image/png" in content_resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_jpeg_content_endpoint_returns_image_jpeg(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "JPEG test",
            "slug": "jpeg-test",
            "files": [{"path": "photo.jpg", "content": "/9j/4AAQSkZJRg=="}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "image/jpeg" in content_resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_svg_content_endpoint_returns_image_svg_xml(self, client):
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
        resp = await client.post("/api/v1/entries", json={
            "summary": "SVG test",
            "slug": "svg-test",
            "files": [{"path": "diagram.svg", "content": svg_content}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "image/svg+xml" in content_resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_bin_content_endpoint_returns_octet_stream(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "BIN test",
            "slug": "bin-test",
            "files": [{"path": "data.bin", "content": "AQID"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "application/octet-stream" in content_resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_py_content_endpoint_returns_text_x_python(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "Python test",
            "slug": "py-test",
            "files": [{"path": "main.py", "content": "print('hello')"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "text/x-python" in content_resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_css_content_endpoint_returns_text_css(self, client):
        resp = await client.post("/api/v1/entries", json={
            "summary": "CSS test",
            "slug": "css-test",
            "files": [{"path": "style.css", "content": "body { margin: 0; }"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        slug = data["slug"]
        file_id = data["files"][0]["id"]

        content_resp = await client.get(f"/api/v1/entries/{slug}/files/{file_id}/content")
        assert content_resp.status_code == 200
        assert "text/css" in content_resp.headers.get("content-type", "")
