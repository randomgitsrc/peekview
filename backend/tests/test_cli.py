"""CLI tests for Peek.

Tests for the peek CLI commands including:
- serve (mocked)
- create
- get
- list
- delete
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

from peekview.cli import cli


@pytest.fixture
def runner():
    """CLI test runner."""
    return CliRunner()


@pytest.fixture
def isolated_fs(runner):
    """Run in isolated filesystem."""
    with runner.isolated_filesystem() as fs:
        yield fs


class TestCliBasics:
    """Basic CLI functionality tests."""

    def test_cli_version(self, runner):
        """CLI should report version."""
        result = runner.invoke(cli, ["--version"])
        assert result.exit_code == 0
        assert "peek" in result.output.lower()
        assert "0.1.0" in result.output

    def test_cli_help(self, runner):
        """CLI help should list all commands."""
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "create" in result.output
        assert "get" in result.output
        assert "list" in result.output
        assert "delete" in result.output
        assert "serve" in result.output


class TestServeCommand:
    """Tests for `peek serve` command."""

    @patch("uvicorn.run")
    def test_serve_basic(self, mock_uvicorn, runner):
        """Basic serve command should start uvicorn."""
        result = runner.invoke(cli, ["serve"])
        # Should call uvicorn.run
        assert mock_uvicorn.called

    @patch("uvicorn.run")
    def test_serve_with_host_port(self, mock_uvicorn, runner):
        """Serve with custom host and port."""
        result = runner.invoke(cli, ["serve", "-h", "0.0.0.0", "-p", "3000"])
        assert mock_uvicorn.called
        call_kwargs = mock_uvicorn.call_args[1]
        assert call_kwargs["host"] == "0.0.0.0"
        assert call_kwargs["port"] == 3000

    @patch("uvicorn.run")
    def test_serve_reload_mode(self, mock_uvicorn, runner):
        """Serve with reload flag."""
        result = runner.invoke(cli, ["serve", "--reload"])
        assert mock_uvicorn.called
        assert mock_uvicorn.call_args[1]["reload"] is True


class TestCreateCommand:
    """Tests for `peek create` command."""

    def test_create_requires_summary(self, runner):
        """Create without summary should fail."""
        result = runner.invoke(cli, ["create"])
        assert result.exit_code != 0
        assert "Missing option" in result.output or "required" in result.output.lower()

    def test_create_basic(self, runner, isolated_fs):
        """Create with summary should work."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test entry",
        ])
        assert result.exit_code == 0
        assert "Created" in result.output
        assert "entry:" in result.output.lower()

    def test_create_with_slug(self, runner, isolated_fs):
        """Create with custom slug."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test entry",
            "--slug", "my-custom-slug",
        ])
        assert result.exit_code == 0
        assert "my-custom-slug" in result.output

    def test_create_with_tags(self, runner, isolated_fs):
        """Create with multiple tags."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test entry",
            "-t", "python",
            "-t", "cli",
            "-t", "test",
        ])
        assert result.exit_code == 0
        assert "Created" in result.output

    def test_create_with_expires_in(self, runner, isolated_fs):
        """Create with expiration."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test entry",
            "--expires-in", "1h",
        ])
        assert result.exit_code == 0

    def test_create_json_output(self, runner, isolated_fs):
        """Create with JSON output."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test entry",
            "--slug", "json-test-cli",
            "-j",
        ])
        assert result.exit_code == 0
        # Parse JSON output
        data = json.loads(result.output)
        assert "slug" in data
        assert "url" in data
        # Slug may have suffix if conflict, but should start with our slug
        assert data["slug"].startswith("json-test-cli")

    def test_create_from_file(self, runner, isolated_fs):
        """Create from file."""
        # Create a test file
        test_file = Path("test.py")
        test_file.write_text("print('hello')")

        result = runner.invoke(cli, [
            "create",
            "-s", "Test from file",
            str(test_file),
        ])
        assert result.exit_code == 0
        assert "Created" in result.output

    def test_create_from_multiple_files(self, runner, isolated_fs):
        """Create from multiple files."""
        # Create test files
        Path("file1.py").write_text("x = 1")
        Path("file2.py").write_text("y = 2")

        result = runner.invoke(cli, [
            "create",
            "-s", "Multiple files",
            "file1.py", "file2.py",
        ])
        assert result.exit_code == 0
        assert "Files: 2" in result.output

    def test_create_from_directory(self, runner, isolated_fs):
        """Create from directory."""
        # Create test directory with files
        test_dir = Path("test_dir")
        test_dir.mkdir()
        (test_dir / "main.py").write_text("print('hello')")
        (test_dir / "utils.py").write_text("def util(): pass")

        result = runner.invoke(cli, [
            "create",
            "-s", "From directory",
            str(test_dir),
        ])
        assert result.exit_code == 0
        assert "Created" in result.output

    def test_create_nonexistent_file(self, runner, isolated_fs):
        """Create from non-existent file should fail."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Test",
            "nonexistent.py",
        ])
        assert result.exit_code != 0
        assert "not found" in result.output.lower() or "Path not found" in result.output

    def test_create_from_stdin(self, runner, isolated_fs):
        """Create from stdin."""
        result = runner.invoke(cli, [
            "create",
            "-s", "From stdin",
            "--from-stdin",
        ], input="print('from stdin')")

        assert result.exit_code == 0
        assert "Created" in result.output


class TestGetCommand:
    """Tests for `peek get` command."""

    def test_get_nonexistent_entry(self, runner, isolated_fs):
        """Get non-existent entry should fail."""
        result = runner.invoke(cli, ["get", "nonexistent123"])
        assert result.exit_code != 0
        assert "not found" in result.output.lower() or "Error" in result.output

    def test_get_existing_entry(self, runner, isolated_fs):
        """Get existing entry should succeed."""
        # First create an entry
        runner.invoke(cli, [
            "create",
            "-s", "Test entry",
            "--slug", "get-test-entry",
        ])

        # Now get it
        result = runner.invoke(cli, ["get", "get-test-entry"])
        assert result.exit_code == 0
        assert "Test entry" in result.output
        assert "get-test-entry" in result.output

    def test_get_json_output(self, runner, isolated_fs):
        """Get with JSON output."""
        # Create entry
        runner.invoke(cli, [
            "create",
            "-s", "JSON test",
            "--slug", "json-get-test",
        ])

        result = runner.invoke(cli, ["get", "json-get-test", "-j"])
        assert result.exit_code == 0

        data = json.loads(result.output)
        assert data["slug"] == "json-get-test"
        assert data["summary"] == "JSON test"
        assert "files" in data


class TestListCommand:
    """Tests for `peek list` command."""

    def test_list_empty(self, runner, isolated_fs):
        """List with no entries."""
        result = runner.invoke(cli, ["list"])
        assert result.exit_code == 0
        # Should show 0 total
        assert "0 total" in result.output or "total" in result.output.lower()

    def test_list_with_entries(self, runner, isolated_fs):
        """List with entries."""
        # Create a few entries
        runner.invoke(cli, ["create", "-s", "Entry 1", "--slug", "list-1"])
        runner.invoke(cli, ["create", "-s", "Entry 2", "--slug", "list-2"])

        result = runner.invoke(cli, ["list"])
        assert result.exit_code == 0
        assert "list-1" in result.output or "list-2" in result.output

    def test_list_with_query(self, runner, isolated_fs):
        """List with search query."""
        # Create entries
        runner.invoke(cli, ["create", "-s", "Python code", "--slug", "py-search"])
        runner.invoke(cli, ["create", "-s", "JavaScript code", "--slug", "js-search"])

        result = runner.invoke(cli, ["list", "-q", "Python"])
        assert result.exit_code == 0

    def test_list_with_tag_filter(self, runner, isolated_fs):
        """List with tag filter."""
        # Create entry with tags
        runner.invoke(cli, [
            "create",
            "-s", "Tagged entry",
            "--slug", "tagged",
            "-t", "important",
        ])

        result = runner.invoke(cli, ["list", "-t", "important"])
        assert result.exit_code == 0

    def test_list_json_output(self, runner, isolated_fs):
        """List with JSON output."""
        runner.invoke(cli, ["create", "-s", "JSON list test", "--slug", "json-list"])

        result = runner.invoke(cli, ["list", "-j"])
        assert result.exit_code == 0

        data = json.loads(result.output)
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_list_pagination(self, runner, isolated_fs):
        """List with pagination."""
        result = runner.invoke(cli, ["list", "--page", "1", "--per-page", "10"])
        assert result.exit_code == 0


class TestDeleteCommand:
    """Tests for `peek delete` command."""

    def test_delete_nonexistent_entry(self, runner, isolated_fs):
        """Delete non-existent entry should fail."""
        result = runner.invoke(cli, ["delete", "--yes", "nonexistent123"])
        assert result.exit_code != 0
        assert "not found" in result.output.lower() or "Error" in result.output

    def test_delete_with_confirmation(self, runner, isolated_fs):
        """Delete should prompt for confirmation."""
        # Create entry
        runner.invoke(cli, [
            "create",
            "-s", "To delete",
            "--slug", "delete-test",
        ])

        # Delete with confirmation (input 'y')
        result = runner.invoke(cli, ["delete", "delete-test"], input="y\n")
        assert result.exit_code == 0
        assert "Deleted" in result.output or "delete" in result.output.lower()

    def test_delete_requires_confirmation(self, runner, isolated_fs):
        """Delete without confirmation should prompt."""
        # Create entry
        runner.invoke(cli, [
            "create",
            "-s", "To delete",
            "--slug", "delete-confirm-test",
        ])

        # Try to delete without confirmation
        result = runner.invoke(cli, ["delete", "delete-confirm-test"], input="n\n")
        # Should abort or require confirmation
        assert result.exit_code != 0 or "Aborted" in result.output or "Error" in result.output

    def test_delete_after_deletion_not_found(self, runner, isolated_fs):
        """After delete, entry should not be found."""
        # Create entry
        runner.invoke(cli, [
            "create",
            "-s", "To delete",
            "--slug", "delete-verify",
        ])

        # Delete it
        runner.invoke(cli, ["delete", "delete-verify", "--yes"])

        # Try to get it - should fail
        result = runner.invoke(cli, ["get", "delete-verify"])
        assert result.exit_code != 0 or "not found" in result.output.lower()


class TestIntegrationWorkflow:
    """Integration tests - full CLI workflows."""

    def test_full_workflow(self, runner, isolated_fs):
        """Full workflow: create, list, get, delete."""
        # 1. Create
        create_result = runner.invoke(cli, [
            "create",
            "-s", "Integration test entry",
            "--slug", "workflow-test",
        ])
        assert create_result.exit_code == 0
        assert "workflow-test" in create_result.output

        # 2. List
        list_result = runner.invoke(cli, ["list"])
        assert list_result.exit_code == 0
        assert "workflow-test" in list_result.output

        # 3. Get
        get_result = runner.invoke(cli, ["get", "workflow-test"])
        assert get_result.exit_code == 0
        assert "Integration test entry" in get_result.output

        # 4. Delete
        delete_result = runner.invoke(cli, ["delete", "workflow-test", "--yes"])
        assert delete_result.exit_code == 0

        # 5. Verify deleted
        get_after = runner.invoke(cli, ["get", "workflow-test"])
        assert get_after.exit_code != 0 or "not found" in get_after.output.lower()

    def test_create_with_files_workflow(self, runner, isolated_fs):
        """Workflow with file creation."""
        # Create files
        Path("main.py").write_text("print('Hello, Peek!')")
        Path("README.md").write_text("# My Project")

        # Create entry with files
        result = runner.invoke(cli, [
            "create",
            "-s", "Project with files",
            "--slug", "files-workflow",
            "-t", "python",
            "main.py", "README.md",
        ])
        assert result.exit_code == 0
        assert "Files: 2" in result.output

        # Get and verify files
        get_result = runner.invoke(cli, ["get", "files-workflow"])
        assert get_result.exit_code == 0
        assert "main.py" in get_result.output
        assert "README.md" in get_result.output

    def test_create_from_stdin_workflow(self, runner, isolated_fs):
        """Workflow with stdin input."""
        result = runner.invoke(cli, [
            "create",
            "-s", "Code from stdin",
            "--slug", "stdin-workflow",
            "--from-stdin",
        ], input="def hello():\n    print('world')")

        assert result.exit_code == 0

        # Verify entry was created
        get_result = runner.invoke(cli, ["get", "stdin-workflow", "-j"])
        assert get_result.exit_code == 0
        data = json.loads(get_result.output)
        assert data["slug"] == "stdin-workflow"
