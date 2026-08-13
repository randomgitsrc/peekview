"""Integration tests for CLI remote mode.

These tests start a local server and test CLI commands in remote mode.
"""

import json
import os
import subprocess
import sys
import time
from unittest.mock import patch

import pytest
import requests

# Mark all tests as integration tests
pytestmark = pytest.mark.integration


def _server_port(worker_env):
    """Map a pytest-xdist worker env (``gwN``) to a unique port; ``None`` -> base port."""
    return 18888 + int(worker_env[2:]) if worker_env else 18888  # gw0..gw15 -> 18888..18903


@pytest.fixture(scope="module")
def server_url(tmp_path_factory):
    """Start a local server for testing and return its URL."""
    data_dir = tmp_path_factory.mktemp("peekview_data")
    db_path = data_dir / "test.db"
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    port = _server_port(worker)
    env = {
        **dict(subprocess.os.environ),
        "PEEKVIEW_STORAGE__DATA_DIR": str(data_dir),
        "PEEKVIEW_STORAGE__DB_PATH": str(db_path),
        "PEEKVIEW_SERVER__PORT": str(port),
    }
    proc = subprocess.Popen(
        [sys.executable, "-m", "peekview", "serve", "--port", str(port)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    url = f"http://127.0.0.1:{port}"
    # 死亡检测（B）：每轮先 poll()，死亡立即 terminate+raise，报错含 stderr 摘要
    for _ in range(30):
        if proc.poll() is not None:
            out, err = proc.communicate(timeout=2)
            raise RuntimeError(
                f"Server failed to start (rc={proc.returncode}); stderr: {err.decode()[-500:]!r}"
            )
        try:
            resp = requests.get(f"{url}/health", timeout=1)
            if resp.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.25)
    else:
        proc.terminate()
        raise RuntimeError("Server failed to start")
    yield url
    # teardown 强化（I6）：terminate -> wait(5) -> 超时 kill()
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(test_file),
                "-s",
                "Test entry",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                "-s",
                "Stdin entry",
                "--from-stdin",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(src_dir),
                "-s",
                "Directory entry",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(src_dir),
                "-s",
                "Mixed entry",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(test_file),
                "-s",
                "Tagged entry",
                "-t",
                "python",
                "-t",
                "cli",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                "-s",
                "No auth test",
                "--from-stdin",
                "--remote-url",
                server_url,
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
                    sys.executable,
                    "-m",
                    "peekview",
                    "create",
                    str(test_file),
                    "-s",
                    f"Test entry {i}",
                    "-t",
                    "test",
                    "--remote-url",
                    server_url,
                ],
                capture_output=True,
            )

    def test_list_entries(self, server_url):
        """Test listing entries."""
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "peekview",
                "list",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "list",
                "-q",
                "entry 0",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "list",
                "-t",
                "test",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "list",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(test_file),
                "-s",
                "Entry for get test",
                "-t",
                "test",
                "--slug",
                "test-get-entry",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "get",
                test_entry_slug,
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "get",
                test_entry_slug,
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "get",
                "non-existent-slug-12345",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "create",
                str(test_file),
                "-s",
                "Entry for delete test",
                "--slug",
                "test-delete-entry",
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "delete",
                test_entry_slug,
                "--remote-url",
                server_url,
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
                sys.executable,
                "-m",
                "peekview",
                "get",
                test_entry_slug,
                "--remote-url",
                server_url,
            ],
            capture_output=True,
        )
        assert get_result.returncode != 0


class TestCLIRemoteConfig:
    """Test remote configuration via config command."""

    def test_config_set_remote_url(self, tmp_path):
        """Test setting remote URL via config."""
        # Use temp config file by setting HOME to temp directory
        # Must also set PYTHONPATH to include user site-packages so
        # dependencies like sqlalchemy remain importable when HOME changes.
        import site

        user_site = site.getusersitepackages()
        env_overrides = {
            "HOME": str(tmp_path),
            "PYTHONPATH": user_site,
        }
        with patch.dict(subprocess.os.environ, env_overrides):
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "peekview",
                    "config",
                    "set",
                    "remote.url",
                    "https://example.com",
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
                sys.executable,
                "-m",
                "peekview",
                "config",
                "set",
                "remote.api_key",
                "sk-test-key",
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
                sys.executable,
                "-m",
                "peekview",
                "list",
                "--remote-url",
                "",  # Empty string = local mode
            ],
            capture_output=True,
            text=True,
        )

        # Should fail because no local database, but should not show remote mode
        assert "→ Remote mode:" not in result.stdout


class _FakeProc:
    """Fake subprocess.Popen-compatible object for fixture-level tests.

    Records every method call into ``calls`` so tests can assert the
    terminate/wait/kill sequence enforced by the fixture's teardown.
    """

    def __init__(self, poll_result=None, returncode=0, stderr=b"", wait_raises_once=False):
        self._poll_result = poll_result
        self.returncode = returncode
        self._stderr = stderr
        self._wait_raises_once = wait_raises_once
        self._wait_count = 0
        self.calls = []

    def poll(self):
        self.calls.append("poll")
        return self._poll_result

    def communicate(self, timeout=None):
        self.calls.append(f"communicate:{timeout}")
        return (b"", self._stderr)

    def terminate(self):
        self.calls.append("terminate")

    def kill(self):
        self.calls.append("kill")

    def wait(self, timeout=None):
        self.calls.append(f"wait:{timeout}")
        self._wait_count += 1
        if self._wait_raises_once and self._wait_count == 1:
            raise subprocess.TimeoutExpired("fake-server", timeout)
        return 0


def _popen_capture(fake, monkeypatch, *, health_ok=False, fast_dead=False):
    """Monkeypatch Popen/requests.get/time.sleep so the fixture logic runs in isolation.

    Returns a dict with the Popen call arguments (``args``/``kwargs``) for assertions.
    """
    captured = {}

    def _popen(*args, **kwargs):
        captured["args"] = args
        captured["kwargs"] = kwargs
        return fake

    monkeypatch.setattr(subprocess, "Popen", _popen)

    if health_ok:
        class _Resp:
            status_code = 200

        monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp())
    else:
        def _conn_error(*a, **k):
            raise requests.ConnectionError("no server listening")

        monkeypatch.setattr(requests, "get", _conn_error)

    if fast_dead:
        monkeypatch.setattr(time, "sleep", lambda *a, **k: None)

    return captured


class TestCLIRemoteFixture:
    """Fixture-level tests for the ``server_url`` module fixture (BDD-4 / I6).

    The fixture is invoked via ``server_url.__wrapped__`` to bypass pytest's
    ban on calling fixtures directly (pytest 9 raises on direct fixture calls).
    ``subprocess.Popen`` is monkeypatched so no real server process is spawned.
    """

    def test_b4a_death_raises_with_rc(self, tmp_path_factory, monkeypatch):
        """BDD-4: server dies at startup -> fixture raises RuntimeError containing rc, fast."""
        fake = _FakeProc(poll_result=3, returncode=3)
        _popen_capture(fake, monkeypatch, fast_dead=True)
        gen = server_url.__wrapped__(tmp_path_factory)
        start = time.monotonic()
        with pytest.raises(RuntimeError, match="rc=3"):
            next(gen)
        assert time.monotonic() - start < 5.0

    def test_b4d_death_message_includes_stderr(self, tmp_path_factory, monkeypatch):
        """BDD-4: death error message includes a stderr summary for diagnosis."""
        fake = _FakeProc(
            poll_result=1,
            returncode=1,
            stderr=b"Error binding socket: address already in use",
        )
        _popen_capture(fake, monkeypatch, fast_dead=True)
        gen = server_url.__wrapped__(tmp_path_factory)
        with pytest.raises(RuntimeError) as exc_info:
            next(gen)
        message = str(exc_info.value)
        assert "rc=1" in message
        assert "address already in use" in message

    def test_b4b_normal_start_yields_url(self, tmp_path_factory, monkeypatch):
        """BDD-3 guard: healthy server -> fixture yields a URL consistent with its env port."""
        fake = _FakeProc(poll_result=None, returncode=0)
        captured = _popen_capture(fake, monkeypatch, health_ok=True)
        gen = server_url.__wrapped__(tmp_path_factory)
        url = next(gen)
        env_port = captured["kwargs"]["env"]["PEEKVIEW_SERVER__PORT"]
        assert url == f"http://127.0.0.1:{env_port}"
        args = captured["args"][0]
        assert args[args.index("--port") + 1] == env_port
        next(gen, None)

    def test_b4c_teardown_normal_terminate_then_wait(self, tmp_path_factory, monkeypatch):
        """I6: normal teardown calls terminate then wait with a timeout."""
        fake = _FakeProc(poll_result=None, returncode=0)
        _popen_capture(fake, monkeypatch, health_ok=True)
        gen = server_url.__wrapped__(tmp_path_factory)
        next(gen)
        next(gen, None)  # exhaust the generator so the post-yield teardown runs
        assert "terminate" in fake.calls
        assert "wait:5" in fake.calls

    def test_b4c_teardown_timeout_kills(self, tmp_path_factory, monkeypatch):
        """I6: wait timeout -> kill() fallback, no exception escapes teardown."""
        fake = _FakeProc(poll_result=None, returncode=0, wait_raises_once=True)
        _popen_capture(fake, monkeypatch, health_ok=True)
        gen = server_url.__wrapped__(tmp_path_factory)
        next(gen)
        teardown_ok = False
        teardown_err = None
        try:
            next(gen, None)
            teardown_ok = True
        except Exception as exc:
            teardown_err = exc
        assert teardown_ok, f"teardown must not raise, got: {teardown_err!r}"
        assert "kill" in fake.calls
        assert "terminate" in fake.calls

    def test_server_port_pure(self):
        """BDD-1/3 support: _server_port maps worker env to a unique port (P2-design §9)."""
        port_fn = globals().get("_server_port")
        assert port_fn is not None, "P4 需实现 _server_port(worker_env) 纯函数"
        assert port_fn(None) == 18888
        assert port_fn("gw0") == 18888
        assert port_fn("gw7") == 18895
        assert port_fn("gw15") == 18903
