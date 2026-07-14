"""T054-A: Default host changed to 127.0.0.1.

BDD: A1-A4
Tests should FAIL (red) until P4 implementation.
"""

from __future__ import annotations

from peekview.config import PeekConfig, PeekServer


class TestBDDA1DefaultHost:
    """BDD-A1: Given no PEEKVIEW_SERVER__HOST env var and no config.yaml host,
    When PeekConfig() is instantiated,
    Then config.server.host == "127.0.0.1"
    """

    def test_default_host_is_localhost(self, monkeypatch):
        monkeypatch.delenv("PEEKVIEW_SERVER__HOST", raising=False)
        config = PeekConfig()
        assert config.server.host == "127.0.0.1"

    def test_peek_server_default_host(self):
        server = PeekServer()
        assert server.host == "127.0.0.1"


class TestBDDA2EnvOverride:
    """BDD-A2: Given PEEKVIEW_SERVER__HOST=0.0.0.0,
    When PeekConfig() is instantiated,
    Then config.server.host == "0.0.0.0"
    """

    def test_env_overrides_default(self, monkeypatch):
        monkeypatch.setenv("PEEKVIEW_SERVER__HOST", "0.0.0.0")
        config = PeekConfig()
        assert config.server.host == "0.0.0.0"


class TestBDDA3CLIHelpText:
    """BDD-A3: Given CLI --help output,
    When viewing --host parameter help,
    Then description shows default value as 127.0.0.1
    """

    def test_serve_command_host_help(self):
        from click.testing import CliRunner

        from peekview.cli import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["serve", "--help"])
        assert result.exit_code == 0
        for line in result.output.split("\n"):
            if "--host" in line or "-h" in line:
                assert "default: 127.0.0.1" in line or "default 127.0.0.1" in line, (
                    f"--host help should show default as 127.0.0.1, got: {line}"
                )
                break


class TestBDDA4ConfigListDescription:
    """BDD-A4: Given `peekview config list` output,
    When viewing host config description,
    Then description contains 127.0.0.1 not 0.0.0.0
    """

    def test_config_list_host_description(self, monkeypatch):
        from click.testing import CliRunner

        from peekview.cli import cli

        runner = CliRunner()
        result = runner.invoke(cli, ["config", "list"])
        assert result.exit_code == 0

        for line in result.output.split("\n"):
            if "host:" in line.lower():
                assert "127.0.0.1" in line, f"Host line should reference 127.0.0.1, got: {line}"
                assert "0.0.0.0 为所有接口" not in line, (
                    f"Host description should not say '0.0.0.0 为所有接口', got: {line}"
                )
                break
