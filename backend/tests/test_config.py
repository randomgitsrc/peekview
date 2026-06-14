"""Tests for configuration management."""

import os
from pathlib import Path

import pytest

from peekview.config import PeekConfig, PeekLimits, PeekServer, PeekStorage


class TestPeekLimits:
    """Test PeekLimits configuration."""

    def test_default_limits(self):
        """Default limits are reasonable."""
        limits = PeekLimits()
        assert limits.max_file_size == 20_971_520  # 20MB
        assert limits.max_content_length == 1_048_576  # 1MB
        assert limits.max_entry_files == 50
        assert limits.max_entry_size == 104_857_600  # 100MB
        assert limits.max_slug_length == 64
        assert limits.max_summary_length == 500

    def test_custom_limits(self):
        """Custom limits can be set."""
        limits = PeekLimits(
            max_file_size=5_242_880,
            max_entry_files=100,
        )
        assert limits.max_file_size == 5_242_880
        assert limits.max_entry_files == 100

    def test_positive_validation(self):
        """Limits must be positive."""
        with pytest.raises(ValueError):
            PeekLimits(max_file_size=0)
        with pytest.raises(ValueError):
            PeekLimits(max_file_size=-1)

    def test_entry_files_must_be_positive(self):
        """Entry file count must be positive."""
        with pytest.raises(ValueError):
            PeekLimits(max_entry_files=0)

    def test_default_expires_in_default(self):
        """default_expires_in defaults to '15d'."""
        limits = PeekLimits()
        assert limits.default_expires_in == "15d"

    def test_default_expires_in_custom(self):
        """default_expires_in can be set to a custom value."""
        limits = PeekLimits(default_expires_in="30d")
        assert limits.default_expires_in == "30d"

    def test_default_expires_in_zero_is_valid(self):
        """default_expires_in='0' is valid (means never expire by default)."""
        limits = PeekLimits(default_expires_in="0")
        assert limits.default_expires_in == "0"

    def test_default_expires_in_invalid_falls_back(self, caplog):
        """Invalid default_expires_in triggers WARNING and falls back to '15d'."""
        import logging
        caplog.set_level(logging.WARNING, logger="peekview.config")
        limits = PeekLimits(default_expires_in="999999d")
        assert limits.default_expires_in == "15d"
        assert "Invalid PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN" in caplog.text
        assert "Falling back to '15d'" in caplog.text

    def test_default_expires_in_env_var(self, monkeypatch):
        """PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN env var flows through PeekConfig."""
        monkeypatch.setenv("PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN", "7d")
        config = PeekConfig()
        assert config.limits.default_expires_in == "7d"


class TestPeekStorage:
    """Test PeekStorage configuration."""

    def test_default_paths(self, monkeypatch):
        """Default paths use home directory."""
        monkeypatch.delenv("PEEKVIEW_STORAGE__DATA_DIR", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DB_PATH", raising=False)
        storage = PeekStorage()
        assert storage.data_dir == Path.home() / ".peekview" / "data"
        assert storage.db_path == Path.home() / ".peekview" / "peekview.db"

    def test_path_expansion(self):
        """Tilde expansion works in paths."""
        storage = PeekStorage(data_dir="~/custom/data", db_path="~/custom/peekview.db")
        assert storage.data_dir == Path.home() / "custom" / "data"
        assert storage.db_path == Path.home() / "custom" / "peekview.db"

    def test_ignored_dirs(self, monkeypatch):
        """Default ignored directories."""
        monkeypatch.delenv("PEEKVIEW_STORAGE__DATA_DIR", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DB_PATH", raising=False)
        storage = PeekStorage()
        assert ".git" in storage.ignored_dirs
        assert "__pycache__" in storage.ignored_dirs
        assert "node_modules" in storage.ignored_dirs


class TestPeekServer:
    """Test PeekServer configuration."""

    def test_defaults(self):
        """Default server settings."""
        server = PeekServer()
        assert server.host == "0.0.0.0"  # Changed from 127.0.0.1 for VPS deployment
        assert server.port == 8080
        assert server.base_url == ""
        assert server.api_key == ""

    def test_custom_port(self):
        """Custom port can be set."""
        server = PeekServer(port=3000)
        assert server.port == 3000

    def test_port_validation(self):
        """Port must be valid."""
        with pytest.raises(ValueError):
            PeekServer(port=0)
        with pytest.raises(ValueError):
            PeekServer(port=70000)


class TestPeekConfig:
    """Test main PeekConfig."""

    def test_defaults(self):
        """Default configuration."""
        config = PeekConfig()
        assert isinstance(config.limits, PeekLimits)
        assert isinstance(config.storage, PeekStorage)
        assert isinstance(config.server, PeekServer)

    def test_data_dir_shortcut(self):
        """data_dir property works."""
        config = PeekConfig()
        assert config.data_dir == config.storage.data_dir

    def test_db_path_shortcut(self):
        """db_path property works."""
        config = PeekConfig()
        assert config.db_path == config.storage.db_path

    def test_build_view_url_auto(self):
        """Build view URL with auto-detected base."""
        config = PeekConfig(server=PeekServer(host="localhost", port=8080))
        assert config.build_view_url("test-slug") == "http://localhost:8080/test-slug"

    def test_build_view_url_custom(self):
        """Build view URL with custom base."""
        config = PeekConfig(server=PeekServer(base_url="https://peekview.example.com"))
        assert config.build_view_url("test-slug") == "https://peekview.example.com/test-slug"

    def test_ensure_directories(self, tmp_path):
        """Ensure directories creates paths."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path / "data"))
        config.ensure_directories()
        assert config.data_dir.exists()


class TestEnvironmentVariables:
    """Test configuration via environment variables."""

    def test_server_host_env(self, monkeypatch):
        """PEEKVIEW_SERVER__HOST sets host."""
        monkeypatch.setenv("PEEKVIEW_SERVER__HOST", "0.0.0.0")
        config = PeekConfig()
        assert config.server.host == "0.0.0.0"

    def test_server_port_env(self, monkeypatch):
        """PEEKVIEW_SERVER__PORT sets port."""
        monkeypatch.setenv("PEEKVIEW_SERVER__PORT", "3000")
        config = PeekConfig()
        assert config.server.port == 3000

    def test_limits_max_file_size_env(self, monkeypatch):
        """PEEKVIEW_LIMITS__MAX_FILE_SIZE sets limit."""
        monkeypatch.setenv("PEEKVIEW_LIMITS__MAX_FILE_SIZE", "20971520")
        config = PeekConfig()
        assert config.limits.max_file_size == 20971520

    def test_api_key_env(self, monkeypatch):
        """PEEKVIEW_SERVER__API_KEY sets auth key."""
        monkeypatch.setenv("PEEKVIEW_SERVER__API_KEY", "secret123")
        config = PeekConfig()
        assert config.server.api_key == "secret123"


class TestLocalPathAllowlist:
    """Test local_path allowlist functionality."""

    def test_no_allowlist_denies_all(self, monkeypatch):
        """Empty allowlist denies all local paths."""
        monkeypatch.delenv("PEEKVIEW_STORAGE__DATA_DIR", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DB_PATH", raising=False)
        config = PeekConfig()
        assert not config.is_local_path_allowed(Path("/tmp/test.py"))

    def test_path_in_allowlist(self, tmp_path):
        """Path within allowed directory is allowed."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        config = PeekConfig(
            storage=PeekStorage(allowed_paths=[allowed])
        )
        test_file = allowed / "test.py"
        test_file.write_text("# test")
        assert config.is_local_path_allowed(test_file)

    def test_path_outside_allowlist(self, tmp_path):
        """Path outside allowed directory is denied."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        outside = tmp_path / "outside" / "test.py"
        outside.parent.mkdir()
        outside.write_text("# test")
        config = PeekConfig(
            storage=PeekStorage(allowed_paths=[allowed])
        )
        assert not config.is_local_path_allowed(outside)

    def test_nested_path_in_allowlist(self, tmp_path):
        """Nested path within allowed directory is allowed."""
        allowed = tmp_path / "allowed"
        nested = allowed / "subdir" / "test.py"
        nested.parent.mkdir(parents=True)
        nested.write_text("# test")
        config = PeekConfig(
            storage=PeekStorage(allowed_paths=[allowed])
        )
        assert config.is_local_path_allowed(nested)

    def test_symlink_resolved_path(self, tmp_path):
        """Symlink is resolved before checking."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        actual = allowed / "actual.py"
        actual.write_text("# actual")
        link = tmp_path / "link.py"
        link.symlink_to(actual)
        config = PeekConfig(
            storage=PeekStorage(allowed_paths=[allowed])
        )
        # Note: is_local_path_allowed resolves the path
        # so symlinks pointing to allowed paths are allowed
        assert config.is_local_path_allowed(link)


class TestConfigLimitsEndpoint:
    """Test GET /api/v1/config/limits endpoint."""

    async def test_config_limits_returns_200(self, client):
        """GET /api/v1/config/limits returns 200 with expected fields."""
        resp = await client.get("/api/v1/config/limits")
        assert resp.status_code == 200
        data = resp.json()
        assert "default_expires_in" in data
        assert data["default_expires_in"] == "15d"
        assert "max_file_size" in data
        assert "max_entry_files" in data
        assert "max_entry_size" in data
        assert "max_slug_length" in data
        assert "max_summary_length" in data

    async def test_config_limits_no_auth_required(self, client):
        """GET /api/v1/config/limits does not require authentication."""
        resp = await client.get("/api/v1/config/limits")
        assert resp.status_code == 200

    async def test_config_limits_respects_env_var(self, monkeypatch, temp_data_dir, temp_db_path):
        """GET /api/v1/config/limits reflects PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN."""
        from peekview.main import create_app
        monkeypatch.setenv("PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN", "7d")

        # Use create_app with special env that doesn't read config file
        app = create_app(data_dir=temp_data_dir, db_path=temp_db_path)

        from httpx import ASGITransport, AsyncClient
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/v1/config/limits")
            assert resp.status_code == 200
            data = resp.json()
            assert data["default_expires_in"] == "7d"


class TestProductionPathWarning:
    """Test that bare PeekConfig() calls warn when pointing at production paths."""

    def test_bare_call_warns_for_production(self, monkeypatch, caplog):
        """Bare PeekConfig() pointing at ~/.peekview/ should log a warning."""
        monkeypatch.delenv("PEEKVIEW_DEBUG_MODE", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DATA_DIR", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DB_PATH", raising=False)
        import logging
        with caplog.at_level(logging.WARNING, logger="peekview.config"):
            PeekConfig()
        assert any("PRODUCTION paths" in r.message for r in caplog.records)

    def test_debug_mode_no_warning(self, monkeypatch, caplog):
        """PEEKVIEW_DEBUG_MODE=1 should suppress the warning and isolate paths."""
        monkeypatch.setenv("PEEKVIEW_DEBUG_MODE", "1")
        monkeypatch.delenv("PEEKVIEW_STORAGE__DATA_DIR", raising=False)
        monkeypatch.delenv("PEEKVIEW_STORAGE__DB_PATH", raising=False)
        import logging
        with caplog.at_level(logging.WARNING, logger="peekview.config"):
            config = PeekConfig()
        assert not any("PRODUCTION paths" in r.message for r in caplog.records)
        assert str(config.data_dir).startswith("/tmp/peekview-debug")

    def test_explicit_storage_no_warning(self, monkeypatch, caplog, tmp_path):
        """Explicit storage kwargs should not trigger the warning."""
        monkeypatch.delenv("PEEKVIEW_DEBUG_MODE", raising=False)
        import logging
        data_dir = tmp_path / "data"
        db_path = tmp_path / "test.db"
        with caplog.at_level(logging.WARNING, logger="peekview.config"):
            PeekConfig(storage=PeekStorage(data_dir=data_dir, db_path=db_path))
        assert not any("PRODUCTION paths" in r.message for r in caplog.records)
