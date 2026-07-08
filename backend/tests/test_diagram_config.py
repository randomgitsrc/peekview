"""Tests for diagram sanitize configuration (T049).

Tests for:
- PeekDiagram config class default/override (B-BDD-1)
- GET /api/v1/config/diagram endpoint (B-BDD-1)
- CLI config set/list for diagram.sanitize_enabled (B-BDD-7~9)

All tests currently RED — implementation not yet written.
"""

from pathlib import Path

import pytest
from click.testing import CliRunner

from peekview.cli import cli


class TestPeekDiagramConfig:
    """Test PeekDiagram config class (B-BDD-1)."""

    def test_diagram_config_default_enabled(self):
        """Default sanitize_enabled is True (B-BDD-1)."""
        from peekview.config import PeekDiagram
        diagram = PeekDiagram()
        assert diagram.sanitize_enabled is True

    def test_diagram_config_env_override(self, monkeypatch):
        """PEEKVIEW_DIAGRAM__SANITIZE_ENABLED env overrides default (B-BDD-1)."""
        monkeypatch.setenv("PEEKVIEW_DIAGRAM__SANITIZE_ENABLED", "false")
        from peekview.config import PeekDiagram
        diagram = PeekDiagram()
        assert diagram.sanitize_enabled is False

    def test_diagram_config_registered_in_peekconfig(self):
        """PeekConfig includes diagram section (B-BDD-1)."""
        from peekview.config import PeekConfig, PeekDiagram
        config = PeekConfig()
        assert hasattr(config, "diagram")
        assert isinstance(config.diagram, PeekDiagram)
        assert config.diagram.sanitize_enabled is True


class TestDiagramConfigEndpoint:
    """Test GET /api/v1/config/diagram endpoint (B-BDD-1)."""

    async def test_endpoint_returns_default(self, client):
        """GET /api/v1/config/diagram returns default enabled (B-BDD-1)."""
        resp = await client.get("/api/v1/config/diagram")
        assert resp.status_code == 200
        data = resp.json()
        assert data == {"sanitize_enabled": True}

    async def test_endpoint_no_auth_required(self, client):
        """GET /api/v1/config/diagram does not require auth (B-BDD-1)."""
        resp = await client.get("/api/v1/config/diagram")
        assert resp.status_code == 200

    async def test_endpoint_reflects_env_var(self, monkeypatch, temp_data_dir, temp_db_path):
        """GET /api/v1/config/diagram reflects env override (B-BDD-1)."""
        from peekview.main import create_app
        monkeypatch.setenv("PEEKVIEW_DIAGRAM__SANITIZE_ENABLED", "false")

        app = create_app(data_dir=temp_data_dir, db_path=temp_db_path)

        from httpx import ASGITransport, AsyncClient
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/v1/config/diagram")
            assert resp.status_code == 200
            data = resp.json()
            assert data == {"sanitize_enabled": False}


class TestDiagramConfigCLI:
    """Test CLI config commands for diagram.sanitize_enabled (B-BDD-7~9)."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def isolated_fs(self, runner, monkeypatch, tmp_path):
        monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(tmp_path / "data"))
        monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(tmp_path / "peekview.db"))
        monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "")
        monkeypatch.setenv("PEEKVIEW_REMOTE__API_KEY", "")
        config_dir = tmp_path / ".peekview"
        config_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr("peekview.config.CONFIG_FILE", config_dir / "config.yaml")
        with runner.isolated_filesystem() as fs:
            yield fs

    def test_cli_diagram_sanitize_set_false(self, runner, isolated_fs):
        """config set diagram.sanitize_enabled false writes config + restart ack (B-BDD-7)."""
        result = runner.invoke(cli, ["config", "set", "diagram.sanitize_enabled", "false"])
        assert result.exit_code == 0
        assert "Set diagram.sanitize_enabled = False" in result.output
        assert "Restart service to apply" in result.output

    def test_cli_diagram_sanitize_set_true(self, runner, isolated_fs):
        """config set diagram.sanitize_enabled true works (B-BDD-7)."""
        result = runner.invoke(cli, ["config", "set", "diagram.sanitize_enabled", "true"])
        assert result.exit_code == 0
        assert "Set diagram.sanitize_enabled = True" in result.output

    def test_cli_diagram_sanitize_list_shows_key(self, runner, isolated_fs):
        """config list includes diagram.sanitize_enabled with value (B-BDD-8)."""
        runner.invoke(cli, ["config", "set", "diagram.sanitize_enabled", "false"])
        result = runner.invoke(cli, ["config", "list"])
        assert result.exit_code == 0
        assert "diagram.sanitize_enabled" in result.output
        assert "False" in result.output

    def test_cli_diagram_sanitize_invalid_value(self, runner, isolated_fs):
        """config set diagram.sanitize_enabled invalid shows error (B-BDD-9)."""
        result = runner.invoke(cli, ["config", "set", "diagram.sanitize_enabled", "invalid"])
        assert result.exit_code != 0
        assert "Error" in result.output

    def test_cli_diagram_sanitize_unknown_key(self, runner, isolated_fs):
        """config set with unknown key shows error (edge case)."""
        result = runner.invoke(cli, ["config", "set", "diagram.nonexistent", "true"])
        assert result.exit_code != 0
        assert "Unknown config key" in result.output
