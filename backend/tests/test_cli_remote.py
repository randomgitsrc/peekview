"""Integration tests for CLI remote mode.

These tests start a local server and test CLI commands in remote mode.
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import patch

import pytest
import requests

# Mark all tests as integration tests
pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def server_url(tmp_path_factory):
    """Start a local server for testing and return its URL."""
    # Create temp data directory
    data_dir = tmp_path_factory.mktemp("peekview_data")
    db_path = data_dir / "test.db"

    # Start server in background
    env = {
        **dict(subprocess.os.environ),
        "PEEKVIEW_STORAGE__DATA_DIR": str(data_dir),
        "PEEKVIEW_STORAGE__DB_PATH": str(db_path),
        "PEEKVIEW_SERVER__PORT": "18888",  # Use non-standard port to avoid conflicts
    }

    proc = subprocess.Popen(
        [sys.executable, "-m", "peekview", "serve", "--port", "18888"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    url = "http://127.0.0.1:18888"

    # Wait for server to start
    for _ in range(30):
        try:
            resp = requests.get(f"{url}/health", timeout=1)
            if resp.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.5)
    else:
        proc.terminate()
        raise RuntimeError("Server failed to start")

    yield url

    # Cleanup
    proc.terminate()
    proc.wait(timeout=5)


class TestCLIRemoteCreate:
    """Test remote create command."""

    def test_create_single_file(self, server_url, tmp_path):
        """Test creating entry with single file."""
        # Create test file
        test_file = tmp_path / "test.py"
        test_file.write_text("print('hello world')")

        # Run CLI in remote mode
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(test_file),
                "-s", "Test entry",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "→ Remote mode:" in result.stdout
        assert "✓ Created entry:" in result.stdout
        assert server_url in result.stdout

    def test_create_from_stdin(self, server_url):
        """Test creating entry from stdin."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create",
                "-s", "Stdin entry",
                "--from-stdin",
                "--remote-url", server_url,
            ],
            input="console.log('hello')",
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "✓ Created entry:" in result.stdout

    def test_create_directory(self, server_url, tmp_path):
        """Test creating entry from directory."""
        # Create test directory structure
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "main.py").write_text("def main(): pass")
        (src_dir / "utils.py").write_text("def helper(): pass")

        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(src_dir),
                "-s", "Directory entry",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "✓ Created entry:" in result.stdout
        # Should have 2 files
        assert "Files: 2" in result.stdout

    def test_create_binary_file_skipped(self, server_url, tmp_path):
        """Test that binary files are skipped with warning."""
        # Create test directory with binary file
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "main.py").write_text("print('hello')")
        (src_dir / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n")  # PNG header

        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(src_dir),
                "-s", "Mixed entry",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "⚠ Warning: Skipping binary file" in result.stderr
        # Only 1 text file should be uploaded
        assert "Files: 1" in result.stdout

    def test_create_with_tags(self, server_url, tmp_path):
        """Test creating entry with tags."""
        test_file = tmp_path / "test.py"
        test_file.write_text("# test")

        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(test_file),
                "-s", "Tagged entry",
                "-t", "python",
                "-t", "cli",
                "--remote-url", server_url,
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["slug"]
        # URL should be a valid URL (server may return custom base_url)
        assert data["url"].startswith("http")

    def test_create_401_without_api_key(self, server_url):
        """Test that server without auth accepts requests."""
        # This server has no API key set
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create",
                "-s", "No auth test",
                "--from-stdin",
                "--remote-url", server_url,
            ],
            input="test content",
            capture_output=True,
            text=True,
        )

        # Should succeed (server has no auth)
        assert result.returncode == 0


class TestCLIRemoteList:
    """Test remote list command."""

    @pytest.fixture(autouse=True)
    def create_test_entries(self, server_url, tmp_path):
        """Create some test entries before each test."""
        for i in range(3):
            test_file = tmp_path / f"test{i}.py"
            test_file.write_text(f"# test {i}")

            subprocess.run(
                [
                    sys.executable, "-m", "peekview",
                    "create", str(test_file),
                    "-s", f"Test entry {i}",
                    "-t", "test",
                    "--remote-url", server_url,
                ],
                capture_output=True,
            )

    def test_list_entries(self, server_url):
        """Test listing entries."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "list",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "→ Remote mode:" in result.stdout
        assert "total" in result.stdout

    def test_list_with_query(self, server_url):
        """Test listing with search query."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "list",
                "-q", "entry 0",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        # Should find at least one entry
        assert "entry 0" in result.stdout.lower()

    def test_list_with_tag_filter(self, server_url):
        """Test listing with tag filter."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "list",
                "-t", "test",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        # All test entries have "test" tag
        assert "test" in result.stdout

    def test_list_json_output(self, server_url):
        """Test listing with JSON output."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "list",
                "--remote-url", server_url,
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data


class TestCLIRemoteGet:
    """Test remote get command."""

    @pytest.fixture
    def test_entry_slug(self, server_url, tmp_path):
        """Create a test entry and return its slug."""
        test_file = tmp_path / "test.py"
        test_file.write_text("print('hello')")

        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(test_file),
                "-s", "Entry for get test",
                "-t", "test",
                "--slug", "test-get-entry",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        return "test-get-entry"

    def test_get_entry(self, server_url, test_entry_slug):
        """Test getting entry details."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "get", test_entry_slug,
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "→ Remote mode:" in result.stdout
        assert f"Entry: {test_entry_slug}" in result.stdout
        assert "Entry for get test" in result.stdout

    def test_get_entry_json(self, server_url, test_entry_slug):
        """Test getting entry with JSON output."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "get", test_entry_slug,
                "--remote-url", server_url,
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["slug"] == test_entry_slug
        assert data["summary"] == "Entry for get test"
        assert "files" in data

    def test_get_nonexistent_entry(self, server_url):
        """Test getting non-existent entry."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "get", "non-existent-slug-12345",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode != 0
        assert "Error" in result.stderr or "not found" in result.stderr.lower()


class TestCLIRemoteDelete:
    """Test remote delete command."""

    @pytest.fixture
    def test_entry_slug(self, server_url, tmp_path):
        """Create a test entry and return its slug."""
        test_file = tmp_path / "test.py"
        test_file.write_text("print('hello')")

        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "create", str(test_file),
                "-s", "Entry for delete test",
                "--slug", "test-delete-entry",
                "--remote-url", server_url,
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        return "test-delete-entry"

    def test_delete_entry(self, server_url, test_entry_slug):
        """Test deleting entry."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "delete", test_entry_slug,
                "--remote-url", server_url,
                "--yes",  # Skip confirmation
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "→ Remote mode:" in result.stdout
        assert f"✓ Deleted entry: {test_entry_slug}" in result.stdout

        # Verify entry is gone
        get_result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "get", test_entry_slug,
                "--remote-url", server_url,
            ],
            capture_output=True,
        )
        assert get_result.returncode != 0


class TestCLIRemoteConfig:
    """Test remote configuration via config command."""

    def test_config_set_remote_url(self, tmp_path):
        """Test setting remote URL via config."""
        # Use temp config file by setting HOME to temp directory
        with patch.dict(subprocess.os.environ, {"HOME": str(tmp_path)}):
            result = subprocess.run(
                [
                    sys.executable, "-m", "peekview",
                    "config", "set", "remote.url", "https://example.com",
                ],
                capture_output=True,
                text=True,
            )

        assert result.returncode == 0
        assert "Set remote.url" in result.stdout
        assert "https://example.com" in result.stdout

    def test_config_set_remote_api_key(self, tmp_path):
        """Test setting remote API key via config."""
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "config", "set", "remote.api_key", "sk-test-key",
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "✓ Set remote.api_key = sk-test-key" in result.stdout


class TestCLIRemoteModeSwitching:
    """Test local/remote mode switching."""

    def test_explicit_local_mode(self, server_url):
        """Test that empty --remote-url forces local mode."""
        # This would need a local database to work
        # Just test that the CLI accepts the argument
        result = subprocess.run(
            [
                sys.executable, "-m", "peekview",
                "list",
                "--remote-url", "",  # Empty string = local mode
            ],
            capture_output=True,
            text=True,
        )

        # Should fail because no local database, but should not show remote mode
        assert "→ Remote mode:" not in result.stdout
