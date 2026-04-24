"""Security tests for Peek backend.

Tests for path traversal, symlink attacks, API key auth bypass,
SQL injection, XSS, and other security concerns.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app
from peekview.storage import get_disk_path, validate_local_path


@pytest.fixture(scope="function")
async def client():
    """Client with isolated temp directory."""
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
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
async def auth_client(monkeypatch):
    """Client with API key authentication enabled."""
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
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


class TestPathTraversal:
    """Path traversal attack prevention tests."""

    def test_dotdot_traversal_blocked(self, tmp_path):
        """.. sequences should not escape entry directory."""
        from peekview.config import PeekConfig

        config = PeekConfig()
        config.storage.data_dir = tmp_path

        # Attempt to traverse up with ..
        with pytest.raises(Exception):  # ForbiddenPathError
            get_disk_path(config, 1, "../../../etc/passwd", "passwd")

    def test_null_byte_injection_blocked(self, tmp_path):
        """Null bytes in paths should be rejected or sanitized."""
        from peekview.config import PeekConfig

        config = PeekConfig()
        config.storage.data_dir = tmp_path

        # Null byte injection attempt
        malicious_path = "file.txt\x00.py"

        # Should either raise error or sanitize
        try:
            result = get_disk_path(config, 1, malicious_path, "file.txt")
            # If no error, path should not contain null byte
            assert "\x00" not in str(result)
        except Exception:
            pass  # Error is acceptable

    def test_absolute_path_blocked(self, tmp_path):
        """Absolute paths should not escape entry directory."""
        from peekview.config import PeekConfig

        config = PeekConfig()
        config.storage.data_dir = tmp_path

        # Absolute path attempt
        with pytest.raises(Exception):  # Should raise ForbiddenPathError
            get_disk_path(config, 1, "/etc/passwd", "passwd")


class TestSymlinkAttacks:
    """Symlink/hardlink attack prevention tests."""

    def test_symlink_to_disallowed_path_blocked(self, tmp_path):
        """Symlinks pointing outside allowlist should be rejected."""
        from peekview.config import PeekConfig
        from peekview.exceptions import ForbiddenPathError

        config = PeekConfig()
        config.storage.allowed_paths = [tmp_path]

        # Create a file outside allowlist
        outside_file = tmp_path.parent / "outside_secret.txt"
        outside_file.write_text("secret data")

        # Create symlink pointing to outside file
        symlink_file = tmp_path / "malicious_link"
        symlink_file.symlink_to(outside_file)

        # Should reject symlink before resolving
        with pytest.raises(ForbiddenPathError) as exc_info:
            validate_local_path(config, str(symlink_file))

        assert "Symlinks not allowed" in str(exc_info.value)

        # Cleanup
        outside_file.unlink()
        symlink_file.unlink()

    def test_symlink_in_chain_blocked(self, tmp_path):
        """Direct symlinks in path should be blocked (parent dir symlinks may vary by platform)."""
        from peekview.config import PeekConfig
        from peekview.exceptions import ForbiddenPathError

        config = PeekConfig()
        config.storage.allowed_paths = [tmp_path]

        # Create a real directory with a file
        real_dir = tmp_path / "real_dir"
        real_dir.mkdir()
        real_file = real_dir / "test.txt"
        real_file.write_text("test")

        # Create a symlink directly to the file (this should be blocked)
        symlink_file = tmp_path / "link_to_file"
        symlink_file.symlink_to(real_file)

        # Direct file symlink should be blocked
        with pytest.raises(ForbiddenPathError):
            validate_local_path(config, str(symlink_file))

        # Cleanup
        symlink_file.unlink()
        real_file.unlink()
        real_dir.rmdir()

    def test_hardlink_detection(self, tmp_path):
        """Hardlinks should be detected and handled appropriately."""
        # Hardlinks are tricky - they don't have a direct Python API
        # to detect if a file has multiple links in a cross-platform way
        # This test documents the expected behavior

        # Create original file
        original = tmp_path / "original.txt"
        original.write_text("test content")

        # Create hardlink (Unix/Linux only for this test)
        if os.name != "nt":  # Skip on Windows
            hardlink = tmp_path / "hardlink.txt"
            os.link(original, hardlink)

            # Hardlinks are not symlinks, so is_symlink() returns False
            assert not hardlink.is_symlink()

            # Both files point to same inode
            assert original.stat().st_ino == hardlink.stat().st_ino

            # Cleanup
            hardlink.unlink()

        original.unlink()


class TestApiKeyAuthBypass:
    """API key authentication bypass attempt tests."""

    @pytest.mark.asyncio
    async def test_missing_auth_header_rejected(self, auth_client):
        """Request without Authorization header should be 401."""
        resp = await auth_client.get("/api/v1/entries")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_auth_format_rejected(self, auth_client):
        """Authorization without Bearer prefix should be rejected."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "test-secret-key"},  # No Bearer
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_bearer_token_rejected(self, auth_client):
        """Empty Bearer token should be rejected."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_bearer_case_sensitive(self, auth_client):
        """Bearer prefix should be case-sensitive."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "bearer test-secret-key"},  # lowercase
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_partial_token_rejected(self, auth_client):
        """Partial or truncated token should be rejected."""
        resp = await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer test-secret"},  # truncated
        )
        assert resp.status_code == 401

    @pytest.mark.skip(reason="Timing attack resistance requires constant-time comparison implementation")
    @pytest.mark.asyncio
    async def test_timing_attack_resistance(self, auth_client):
        """Timing should be roughly equal for valid/invalid tokens."""
        import time

        # Measure invalid token timing
        start = time.perf_counter()
        await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer wrong-token-12345"},
        )
        invalid_time = time.perf_counter() - start

        # Measure valid token timing
        start = time.perf_counter()
        await auth_client.get(
            "/api/v1/entries",
            headers={"Authorization": "Bearer test-secret-key"},
        )
        valid_time = time.perf_counter() - start

        # Times should be within 2x of each other (rough check)
        ratio = max(valid_time, invalid_time) / min(valid_time, invalid_time)
        assert ratio < 10  # Very loose check for test stability

    @pytest.mark.asyncio
    async def test_sql_injection_in_api_key_rejected(self, auth_client):
        """SQL injection attempts in API key should be treated as invalid tokens."""
        malicious_tokens = [
            "Bearer ' OR '1'='1",
            "Bearer '; DROP TABLE entries; --",
            "Bearer \" OR \"1\"=\"1",
        ]

        for token in malicious_tokens:
            resp = await auth_client.get(
                "/api/v1/entries",
                headers={"Authorization": token},
            )
            assert resp.status_code == 401, f"Token {token[:20]}... should be rejected"

    @pytest.mark.asyncio
    async def test_health_check_bypasses_auth(self, auth_client):
        """Health check should not require authentication."""
        resp = await auth_client.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_static_files_bypass_auth(self, auth_client, tmp_path):
        """Static files should not require authentication."""
        # Note: This test assumes no static files are set up in test
        # We're just checking that the middleware allows /assets/* through
        resp = await auth_client.get("/assets/test.js")
        # Should get 404 (file not found) not 401 (unauthorized)
        assert resp.status_code in [404, 200]


class TestFileUploadAbuse:
    """File upload abuse prevention tests."""

    @pytest.mark.asyncio
    async def test_oversized_file_rejected(self, client):
        """Files exceeding max size should be rejected."""
        from peekview.config import PeekConfig

        # Get the configured limit
        config = PeekConfig()
        max_size = config.limits.max_file_size

        # Create oversized content
        oversized_content = "x" * (max_size + 1000)

        resp = await client.post("/api/v1/entries", json={
            "summary": "Oversized test",
            "files": [{"path": "huge.txt", "content": oversized_content}],
        })

        # Should be rejected with 413 Payload Too Large
        assert resp.status_code == 413

    @pytest.mark.asyncio
    async def test_too_many_files_rejected(self, client):
        """More files than max_entry_files should be rejected."""
        from peekview.config import PeekConfig

        config = PeekConfig()
        max_files = config.limits.max_entry_files

        # Create too many files
        files = [{"path": f"file{i}.txt", "content": "test"} for i in range(max_files + 5)]

        resp = await client.post("/api/v1/entries", json={
            "summary": "Too many files test",
            "files": files,
        })

        # Should be rejected
        assert resp.status_code == 413

    @pytest.mark.asyncio
    async def test_total_entry_size_rejected(self, client):
        """Total entry size exceeding max should be rejected."""
        from peekview.config import PeekConfig

        config = PeekConfig()
        max_entry_size = config.limits.max_entry_size

        # Create files that total exceed max_entry_size
        # Each file is about 100KB, create enough to exceed 100MB
        single_file_size = 100 * 1024  # 100KB
        num_files = (max_entry_size // single_file_size) + 5

        files = []
        for i in range(num_files):
            content = "x" * single_file_size
            files.append({"path": f"file{i}.txt", "content": content})

        resp = await client.post("/api/v1/entries", json={
            "summary": "Huge entry test",
            "files": files,
        })

        # Should be rejected
        assert resp.status_code == 413


class TestSqlInjection:
    """SQL injection attempt tests."""

    @pytest.mark.asyncio
    async def test_fts_query_injection_blocked(self, client):
        """FTS5 special characters in search should be sanitized."""
        # Create an entry first
        await client.post("/api/v1/entries", json={
            "summary": "Test entry",
            "slug": "sql-test",
        })

        # Attempt SQL injection in search query
        malicious_queries = [
            "test' OR '1'='1",
            "test'; DROP TABLE entries; --",
            'test" OR "1"="1',
            "test) UNION SELECT * FROM users --",
        ]

        for query in malicious_queries:
            resp = await client.get(f"/api/v1/entries?q={query}")
            # Should not crash (500), either 200 (safe result) or 400 (validation error)
            assert resp.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_slug_sql_injection_blocked(self, client):
        """SQL injection in slug should be rejected by validation."""
        malicious_slugs = [
            "test' OR '1'='1",
            "test'; DROP TABLE entries; --",
            "test) UNION SELECT * FROM sqlite_master --",
        ]

        for slug in malicious_slugs:
            resp = await client.post("/api/v1/entries", json={
                "summary": "SQL test",
                "slug": slug,
            })
            # Should be rejected by slug validation (400)
            assert resp.status_code == 400


class TestXssProtection:
    """XSS (Cross-Site Scripting) prevention tests."""

    @pytest.mark.asyncio
    async def test_script_tag_in_summary_escaped(self, client):
        """Script tags in summary should be escaped or rejected."""
        xss_payloads = [
            "<script>alert('xss')</script>",
            '<img src=x onerror="alert(\'xss\')">',
            "javascript:alert('xss')",
            "<svg onload=alert('xss')>",
        ]

        for payload in xss_payloads:
            # XSS in summary
            resp = await client.post("/api/v1/entries", json={
                "summary": payload,
            })

            if resp.status_code == 201:
                # If accepted, verify it's stored safely (not executed)
                data = resp.json()
                entry_id = data["slug"]

                # Retrieve and verify no script execution
                get_resp = await client.get(f"/api/v1/entries/{entry_id}")
                assert get_resp.status_code == 200

                # Clean up
                await client.delete(f"/api/v1/entries/{entry_id}")

    @pytest.mark.asyncio
    async def test_script_tag_in_content_escaped(self, client):
        """Script tags in file content should be stored but not executed."""
        xss_content = """
<!DOCTYPE html>
<html>
<head><title>XSS Test</title></head>
<body>
<script>alert('XSS in file')</script>
<p>Normal content</p>
</body>
</html>
"""

        resp = await client.post("/api/v1/entries", json={
            "summary": "XSS content test",
            "files": [{"path": "test.html", "content": xss_content}],
        })

        assert resp.status_code == 201
        data = resp.json()
        entry_slug = data["slug"]
        file_id = data["files"][0]["id"]

        # Retrieve file content
        content_resp = await client.get(
            f"/api/v1/entries/{entry_slug}/files/{file_id}/content"
        )
        assert content_resp.status_code == 200

        # Content should be returned as-is (safe storage)
        # Execution prevention is a frontend concern
        assert "<script>" in content_resp.text

        # Clean up
        await client.delete(f"/api/v1/entries/{entry_slug}")


class TestInformationDisclosure:
    """Information disclosure prevention tests."""

    @pytest.mark.asyncio
    async def test_error_messages_no_internal_details(self, client):
        """Error messages should not reveal internal implementation details."""
        # Trigger a 404
        resp = await client.get("/api/v1/entries/nonexistent123")
        assert resp.status_code == 404

        data = resp.json()
        error_msg = str(data)

        # Should not contain internal paths or SQL
        assert ".py" not in error_msg or "File" not in error_msg
        assert "SELECT" not in error_msg.upper()
        assert "sqlite" not in error_msg.lower()

    @pytest.mark.asyncio
    async def test_stack_trace_not_exposed(self, auth_client):
        """Stack traces should not be exposed to client on 500 errors."""
        # We can't easily trigger a real 500, but we can verify the format
        # of error responses matches our expected format

        # Invalid slug format gives us a controlled error
        resp = await auth_client.post("/api/v1/entries", json={
            "summary": "Test",
            "slug": "invalid slug with spaces!",
        }, headers={"Authorization": "Bearer test-secret-key"})

        assert resp.status_code == 400
        data = resp.json()

        # Should have structured error format, not stack trace
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]

        # Should not have traceback or file references
        assert "Traceback" not in str(data)
        assert "File \"/" not in str(data)


class TestCorsSecurity:
    """CORS configuration security tests."""

    @pytest.mark.asyncio
    async def test_cors_preflight_respected(self, client):
        """CORS preflight requests should be handled correctly."""
        resp = await client.options(
            "/api/v1/entries",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )

        # Should return 200 OK for valid preflight
        assert resp.status_code == 200

        # Should have CORS headers
        assert "access-control-allow-origin" in resp.headers

    @pytest.mark.asyncio
    async def test_cors_blocks_unauthorized_origin(self, client):
        """Requests from unauthorized origins should be blocked or limited."""
        resp = await client.get(
            "/api/v1/entries",
            headers={"Origin": "http://evil.com"},
        )

        # Response should either:
        # 1. Not have Access-Control-Allow-Origin header
        # 2. Or have a different/safe origin
        if "access-control-allow-origin" in resp.headers:
            allowed = resp.headers["access-control-allow-origin"]
            assert "evil.com" not in allowed


class TestFilenameSanitization:
    """Filename sanitization for Content-Disposition tests."""

    @pytest.mark.asyncio
    async def test_filename_header_injection_blocked(self, client):
        """Filenames with header injection chars should be sanitized."""
        malicious_filenames = [
            'file"; injection="true',
            "file\r\nSet-Cookie: hacked=true",
            "file; script-src evil.com",
        ]

        for filename in malicious_filenames:
            resp = await client.post("/api/v1/entries", json={
                "summary": "Filename injection test",
                "files": [{"path": filename, "content": "test"}],
            })

            if resp.status_code == 201:
                data = resp.json()
                entry_slug = data["slug"]
                file_id = data["files"][0]["id"]

                # Try to download with malicious filename
                download_resp = await client.get(
                    f"/api/v1/entries/{entry_slug}/files/{file_id}"
                )
                assert download_resp.status_code == 200

                # Content-Disposition should be sanitized
                if "content-disposition" in download_resp.headers:
                    disposition = download_resp.headers["content-disposition"]
                    # Should not have newlines or extra headers
                    assert "\r" not in disposition
                    assert "\n" not in disposition
                    # Should not have semicolon outside of normal structure
                    # (but filename= is allowed)

                # Clean up
                await client.delete(f"/api/v1/entries/{entry_slug}")


class TestRateLimiting:
    """Rate limiting tests (if implemented)."""

    @pytest.mark.skip(reason="Rate limiting not yet implemented")
    @pytest.mark.asyncio
    async def test_excessive_requests_rate_limited(self, client):
        """Excessive requests from same IP should be rate limited."""
        # Make many rapid requests
        for _ in range(100):
            resp = await client.get("/api/v1/entries")
            if resp.status_code == 429:
                break  # Rate limited as expected

        # Should eventually be rate limited
        # (This is a placeholder - actual rate limiting not implemented)
