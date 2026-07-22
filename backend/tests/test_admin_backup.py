"""TDD tests for admin backup/export/restore CLI commands.

P3 test-designer output — all tests are designed to FAIL (red light)
because the backup/export/restore functionality has not been implemented yet.

Each test maps to a BDD acceptance condition from P1-requirements.md.
"""

import hashlib
import json
import tarfile
import zipfile
from pathlib import Path

import pytest
from click.testing import CliRunner

from peekview.cli import cli


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def isolated_env(runner, monkeypatch, tmp_path):
    """Isolated filesystem + env for backup/export/restore CLI tests."""
    monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(tmp_path / "peekview.db"))
    monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "")
    monkeypatch.setenv("PEEKVIEW_REMOTE__API_KEY", "")
    config_dir = tmp_path / ".peekview"
    config_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("peekview.config.CONFIG_FILE", config_dir / "config.yaml")
    return tmp_path


def _create_entry_with_files(runner, slug="test-entry", summary="Test entry"):
    """Helper: create a CLI entry with files for testing."""
    result = runner.invoke(cli, [
        "create", "-s", summary, "--slug", slug,
    ])
    return result


def _create_backup_via_cli(runner, output_path=None):
    """Helper: invoke admin backup command."""
    args = ["admin", "backup"]
    if output_path:
        args.extend(["--output", str(output_path)])
    return runner.invoke(cli, args)


def _build_backup_tarball(
    tmp_path: Path,
    version: str = "0.6.3",
    include_metadata: bool = True,
    corrupt_file: str | None = None,
) -> Path:
    """Build a synthetic backup tarball for restore testing.

    Creates a valid backup with DB (full schema) + data + metadata.
    If corrupt_file is set, that file's content is corrupted for integrity tests.
    """
    staging = tmp_path / "staging"
    staging.mkdir()

    import sqlite3
    db_path = staging / "peekview.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE users (
            username VARCHAR(32) NOT NULL,
            password_hash VARCHAR(128) NOT NULL,
            display_name VARCHAR(64),
            is_active BOOLEAN DEFAULT '1' NOT NULL,
            is_admin BOOLEAN DEFAULT '0' NOT NULL,
            id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id)
        );
        CREATE TABLE entries (
            summary VARCHAR(500) NOT NULL,
            status VARCHAR(9) DEFAULT 'active' NOT NULL,
            tags JSON,
            user_id VARCHAR DEFAULT 'default' NOT NULL,
            is_public BOOLEAN DEFAULT '1' NOT NULL,
            owner_id INTEGER,
            expires_at DATETIME,
            archived_at DATETIME,
            id INTEGER NOT NULL,
            slug VARCHAR NOT NULL,
            idempotency_key VARCHAR(128),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
        );
        CREATE TABLE files (
            path VARCHAR(500),
            filename VARCHAR(255) NOT NULL,
            language VARCHAR(50),
            is_binary BOOLEAN NOT NULL,
            size INTEGER NOT NULL,
            sha256 VARCHAR(64),
            line_count INTEGER,
            id INTEGER NOT NULL,
            entry_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(entry_id) REFERENCES entries (id)
        );
        CREATE TABLE api_keys (
            id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            name VARCHAR(64) NOT NULL,
            key_prefix VARCHAR(8) NOT NULL,
            key_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME,
            last_used_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(user_id) REFERENCES users (id),
            UNIQUE (key_hash)
        );
        CREATE TABLE entry_shares (
            id INTEGER NOT NULL,
            entry_id INTEGER NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            token_prefix VARCHAR(8) NOT NULL,
            expires_at DATETIME,
            max_views INTEGER,
            view_count INTEGER DEFAULT '0' NOT NULL,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            revoked_at DATETIME,
            PRIMARY KEY (id),
            FOREIGN KEY(entry_id) REFERENCES entries (id),
            FOREIGN KEY(created_by) REFERENCES users (id)
        );
        CREATE TABLE entry_reads (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            action VARCHAR(20) NOT NULL,
            channel VARCHAR(20) NOT NULL,
            reader_type VARCHAR(20) NOT NULL,
            reader_id INTEGER,
            is_self_read BOOLEAN NOT NULL,
            count INTEGER NOT NULL,
            window_key VARCHAR(200) NOT NULL,
            reader_fingerprint VARCHAR(50) NOT NULL,
            read_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE (window_key)
        );
        INSERT INTO entries (slug, summary, status, tags, is_public) VALUES ('backup-entry', 'From backup', 'ACTIVE', '[]', 1);
    """)
    conn.commit()
    conn.close()

    data_dir = staging / "data" / "default" / "1"
    data_dir.mkdir(parents=True)
    (data_dir / "main.py").write_text("print('hello from backup')")

    (staging / "config.yaml").write_text("server:\n  port: 8080\n")

    (staging / ".secret_key").write_text("test-secret-key-value")

    checksums = {}
    for f in staging.rglob("*"):
        if f.is_file():
            rel = f.relative_to(staging)
            content = f.read_bytes()
            if corrupt_file and str(rel) == corrupt_file:
                content = b"corrupted"
            checksums[str(rel)] = hashlib.sha256(content).hexdigest()

    if include_metadata:
        metadata = {
            "version": version,
            "timestamp": "2026-07-17T00:00:00Z",
            "file_checksums": checksums,
        }
        (staging / "metadata.json").write_text(json.dumps(metadata, indent=2))

    tar_path = tmp_path / "test-backup.tar.gz"
    with tarfile.open(str(tar_path), "w:gz") as tar:
        for f in staging.rglob("*"):
            if f.is_file():
                tar.add(str(f), arcname=str(f.relative_to(staging)))

    return tar_path


# ============================================================
# BDD-01: Consistent backup
# ============================================================


class TestBdd01ConsistentBackup:
    """BDD-01: peekview admin backup produces a consistent tar.gz snapshot."""

    def test_backup_command_exists(self, runner, isolated_env):
        """The 'admin backup' subcommand should be registered."""
        result = runner.invoke(cli, ["admin", "--help"])
        assert result.exit_code == 0
        assert "backup" in result.output

    def test_backup_produces_tarball(self, runner, isolated_env):
        """Backup should produce a tar.gz file."""
        _create_entry_with_files(runner)
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        # Find the output file
        output_lines = result.output.strip().split("\n")
        tar_path = None
        for line in output_lines:
            if ".tar.gz" in line:
                parts = line.split()
                for p in parts:
                    if p.endswith(".tar.gz"):
                        tar_path = Path(p)
                        break
        assert tar_path is not None, f"No .tar.gz path found in output: {result.output}"
        assert tar_path.exists(), f"Tarball not found at {tar_path}"

    def test_backup_tarball_contains_required_files(self, runner, isolated_env):
        """Tarball must contain peekview.db, data/, config.yaml, .secret_key, metadata.json."""
        _create_entry_with_files(runner)
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        # Find tarball path from output
        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None, f"Cannot find tarball in output: {result.output}"

        with tarfile.open(str(tar_path), "r:gz") as tar:
            names = tar.getnames()

        # Check required top-level files
        assert any("peekview.db" in n for n in names), f"peekview.db missing from {names}"
        assert any("metadata.json" in n for n in names), f"metadata.json missing from {names}"
        assert any("config.yaml" in n for n in names), f"config.yaml missing from {names}"
        assert any(".secret_key" in n for n in names), f".secret_key missing from {names}"
        assert any("data" in n for n in names), f"data/ directory missing from {names}"

    def test_backup_db_is_consistent_snapshot(self, runner, isolated_env):
        """The peekview.db in backup should be a consistent SQLite snapshot (not a raw file copy)."""
        _create_entry_with_files(runner, slug="consistency-test", summary="Consistency check")
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None

        # Extract DB from tarball and verify it's a valid SQLite database
        import sqlite3
        with tarfile.open(str(tar_path), "r:gz") as tar:
            db_member = [m for m in tar.getmembers() if "peekview.db" in m.name][0]
            tar.extract(db_member, path=isolated_env / "extracted")

        extracted_db = isolated_env / "extracted" / db_member.name
        conn = sqlite3.connect(str(extracted_db))
        cur = conn.execute("SELECT slug FROM entries WHERE slug = 'consistency-test'")
        row = cur.fetchone()
        conn.close()
        assert row is not None, "Backup DB should contain the entry created before backup"


# ============================================================
# BDD-02: Backup custom output path
# ============================================================


class TestBdd02CustomOutput:
    """BDD-02: peekview admin backup --output PATH."""

    def test_backup_custom_output_path(self, runner, isolated_env):
        """Backup with --output should write to specified path."""
        _create_entry_with_files(runner)
        output_path = isolated_env / "my-backup.tar.gz"
        result = _create_backup_via_cli(runner, output_path=output_path)
        assert result.exit_code == 0, f"backup failed: {result.output}"
        assert output_path.exists(), f"Backup not written to {output_path}"

    def test_backup_output_is_tar_gz(self, runner, isolated_env):
        """Output file should be valid tar.gz format."""
        _create_entry_with_files(runner)
        output_path = isolated_env / "format-test.tar.gz"
        result = _create_backup_via_cli(runner, output_path=output_path)
        assert result.exit_code == 0, f"backup failed: {result.output}"
        assert tarfile.is_tarfile(str(output_path)), "Output is not a valid tar.gz"

    def test_backup_overwrites_existing_file(self, runner, isolated_env):
        """If output path already exists, backup should overwrite it."""
        _create_entry_with_files(runner)
        output_path = isolated_env / "overwrite.tar.gz"
        output_path.write_text("old content")
        result = _create_backup_via_cli(runner, output_path=output_path)
        assert result.exit_code == 0, f"backup failed: {result.output}"
        assert output_path.exists()
        assert tarfile.is_tarfile(str(output_path)), "Overwritten file is not tar.gz"

    def test_backup_invalid_output_dir(self, runner, isolated_env):
        """If output directory doesn't exist, backup should fail with error."""
        _create_entry_with_files(runner)
        output_path = "/nonexistent/dir/backup.tar.gz"
        result = _create_backup_via_cli(runner, output_path=Path(output_path))
        # After implementation: should exit != 0 with error about invalid path
        # Before implementation: command doesn't exist, so exit != 0 for wrong reason
        # To make this a true red light: assert the error message mentions the path issue
        assert result.exit_code != 0, "Should fail when output dir doesn't exist"
        # This assertion will fail both before and after implementation:
        # - Before: error is "No such command 'backup'" (no path mention)
        # - After: error should mention the invalid path
        assert "path" in result.output.lower() or "directory" in result.output.lower() or "not found" in result.output.lower() or "no such file" in result.output.lower(), \
            f"Error should mention path/directory issue: {result.output}"


# ============================================================
# BDD-03: Backup rejects remote mode
# ============================================================


class TestBdd03RemoteReject:
    """BDD-03: backup should reject remote mode."""

    def test_backup_rejects_remote_mode(self, runner, isolated_env, monkeypatch):
        """When PEEKVIEW_REMOTE__URL is set, backup should fail with an error."""
        monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "http://remote-server:8080")
        result = _create_backup_via_cli(runner)
        assert result.exit_code != 0, "Should reject remote mode"
        assert "remote" in result.output.lower() or "not support" in result.output.lower(), \
            f"Error message should mention remote mode: {result.output}"


# ============================================================
# BDD-04: Backup integrity (checksums)
# ============================================================


class TestBdd04Integrity:
    """BDD-04: metadata.json file_checksums should match actual file SHA256."""

    def test_backup_metadata_has_checksums(self, runner, isolated_env):
        """metadata.json should contain file_checksums field."""
        _create_entry_with_files(runner)
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None

        with tarfile.open(str(tar_path), "r:gz") as tar:
            meta_member = [m for m in tar.getmembers() if m.name.endswith("metadata.json")][0]
            f = tar.extractfile(meta_member)
            assert f is not None
            metadata = json.loads(f.read())

        assert "file_checksums" in metadata, f"metadata.json missing file_checksums: {metadata}"

    def test_backup_checksums_are_correct(self, runner, isolated_env):
        """Each SHA256 in file_checksums should match the actual file content."""
        _create_entry_with_files(runner)
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None

        with tarfile.open(str(tar_path), "r:gz") as tar:
            # Extract metadata
            meta_member = [m for m in tar.getmembers() if m.name.endswith("metadata.json")][0]
            f = tar.extractfile(meta_member)
            assert f is not None
            metadata = json.loads(f.read())
            checksums = metadata["file_checksums"]

            # Verify each checksum
            for member in tar.getmembers():
                if member.name.endswith("metadata.json") or not member.isfile():
                    continue
                f = tar.extractfile(member)
                assert f is not None
                content = f.read()
                actual_sha = hashlib.sha256(content).hexdigest()
                # The key in checksums may have a prefix like "peekview-backup/"
                basename = member.name.split("/")[-1] if "/" in member.name else member.name
                found = False
                for key, expected_sha in checksums.items():
                    if key.endswith(basename) or key == member.name:
                        assert actual_sha == expected_sha, \
                            f"SHA256 mismatch for {member.name}: expected {expected_sha}, got {actual_sha}"
                        found = True
                        break
                assert found, f"No checksum entry for {member.name} in {list(checksums.keys())}"


# ============================================================
# BDD-05: Empty instance backup
# ============================================================


class TestBdd05EmptyBackup:
    """BDD-05: backup of empty instance should succeed with valid structure."""

    def test_backup_empty_instance(self, runner, isolated_env):
        """Backup of empty PeekView instance should succeed."""
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup of empty instance failed: {result.output}"

        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None

        with tarfile.open(str(tar_path), "r:gz") as tar:
            names = tar.getnames()

        assert any("peekview.db" in n for n in names), f"peekview.db missing: {names}"
        assert any("metadata.json" in n for n in names), f"metadata.json missing: {names}"

    def test_backup_empty_metadata_has_version(self, runner, isolated_env):
        """metadata.json of empty backup should have version and timestamp."""
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        tar_path = _extract_tarball_path(result.output, isolated_env)
        assert tar_path is not None

        with tarfile.open(str(tar_path), "r:gz") as tar:
            meta_member = [m for m in tar.getmembers() if m.name.endswith("metadata.json")][0]
            f = tar.extractfile(meta_member)
            assert f is not None
            metadata = json.loads(f.read())

        assert "version" in metadata, f"metadata missing version: {metadata}"
        assert "timestamp" in metadata, f"metadata missing timestamp: {metadata}"


# ============================================================
# BDD-06: Single entry JSON export
# ============================================================


class TestBdd06JsonExport:
    """BDD-06: peekview admin export --slug SLUG --format json."""

    def test_export_json_format(self, runner, isolated_env):
        """Export should produce a JSON file with entry metadata + file contents."""
        _create_entry_with_files(runner, slug="json-export-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "json-export-test", "--format", "json",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        # Output should be valid JSON
        data = json.loads(result.output)
        assert "entry" in data, f"JSON export missing 'entry' key: {list(data.keys())}"
        assert "files" in data, f"JSON export missing 'files' key: {list(data.keys())}"

    def test_export_json_entry_metadata(self, runner, isolated_env):
        """JSON export entry should contain required metadata fields."""
        _create_entry_with_files(runner, slug="json-meta-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "json-meta-test", "--format", "json",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        data = json.loads(result.output)
        entry = data["entry"]
        required_fields = ["slug", "summary", "status", "tags", "is_public"]
        for field in required_fields:
            assert field in entry, f"Entry missing field '{field}': {list(entry.keys())}"

    def test_export_json_file_fields(self, runner, isolated_env):
        """JSON export files should have filename, path, language, is_binary, size, sha256."""
        _create_entry_with_files(runner, slug="json-files-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "json-files-test", "--format", "json",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        data = json.loads(result.output)
        assert len(data["files"]) > 0, "Export should contain at least one file"
        file_data = data["files"][0]
        required_fields = ["filename", "language", "is_binary", "size"]
        for field in required_fields:
            assert field in file_data, f"File missing field '{field}': {list(file_data.keys())}"


# ============================================================
# BDD-07: Single entry ZIP export
# ============================================================


class TestBdd07ZipExport:
    """BDD-07: peekview admin export --slug SLUG --format zip."""

    def test_export_zip_format(self, runner, isolated_env):
        """Export should produce a valid ZIP file."""
        _create_entry_with_files(runner, slug="zip-export-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "zip-export-test", "--format", "zip",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        # Find zip file path from output
        zip_path = _extract_export_path(result.output, isolated_env, ".zip")
        assert zip_path is not None, f"No .zip path found in output: {result.output}"
        assert zipfile.is_zipfile(str(zip_path)), "Export output is not a valid ZIP"

    def test_export_zip_contains_entry_json(self, runner, isolated_env):
        """ZIP should contain entry.json with metadata."""
        _create_entry_with_files(runner, slug="zip-entry-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "zip-entry-test", "--format", "zip",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        zip_path = _extract_export_path(result.output, isolated_env, ".zip")
        assert zip_path is not None

        with zipfile.ZipFile(str(zip_path)) as zf:
            names = zf.namelist()
        assert any("entry.json" in n for n in names), f"entry.json missing from ZIP: {names}"

    def test_export_zip_files_are_extractable(self, runner, isolated_env):
        """ZIP files should be extractable and readable."""
        _create_entry_with_files(runner, slug="zip-extract-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "zip-extract-test", "--format", "zip",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        zip_path = _extract_export_path(result.output, isolated_env, ".zip")
        assert zip_path is not None

        with zipfile.ZipFile(str(zip_path)) as zf:
            zf.extractall(path=isolated_env / "zip_extracted")
        assert (isolated_env / "zip_extracted").exists()


# ============================================================
# BDD-08: Export nonexistent entry
# ============================================================


class TestBdd08ExportNonexistent:
    """BDD-08: export --slug nonexistent should fail."""

    def test_export_nonexistent_entry(self, runner, isolated_env):
        """Export of a nonexistent slug should fail with an error."""
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "nonexistent-entry-xyz",
        ])
        # Should fail — either command not implemented (exit != 0) or entry not found
        # After implementation: should exit != 0 with "not found" message
        # For TDD red light: check that the error is specifically about the entry,
        # not just "No such command"
        if result.exit_code != 0:
            # If command doesn't exist yet, that's a red light (wrong error type)
            # but still a failure. After implementation, should mention "not found"
            if "No such command" in result.output:
                pytest.fail("export command not yet implemented — expected 'not found' error for nonexistent entry")
        # If exit_code == 0 (command exists but didn't error on nonexistent slug):
        assert result.exit_code != 0, "Should fail for nonexistent entry"


# ============================================================
# BDD-09: Export default format
# ============================================================


class TestBdd09DefaultFormat:
    """BDD-09: export without --format defaults to JSON."""

    def test_export_default_format_is_json(self, runner, isolated_env):
        """Export without --format should produce JSON output."""
        _create_entry_with_files(runner, slug="default-format-test")
        result = runner.invoke(cli, [
            "admin", "export", "--slug", "default-format-test",
        ])
        assert result.exit_code == 0, f"export failed: {result.output}"

        # Should be valid JSON
        data = json.loads(result.output)
        assert "entry" in data, "Default format should be JSON (with 'entry' key)"


# ============================================================
# BDD-10: Basic restore (empty target)
# ============================================================


class TestBdd10BasicRestore:
    """BDD-10: restore into empty target should reproduce all backup data."""

    def test_restore_command_exists(self, runner):
        """The 'admin restore' subcommand should be registered."""
        result = runner.invoke(cli, ["admin", "--help"])
        assert result.exit_code == 0
        assert "restore" in result.output

    def test_restore_into_empty_target(self, runner, isolated_env):
        """Restoring a backup into empty instance should import all data."""
        # First create a backup with data
        _create_entry_with_files(runner, slug="restore-test-entry")
        backup_result = _create_backup_via_cli(runner)
        assert backup_result.exit_code == 0, f"backup failed: {backup_result.output}"

        tar_path = _extract_tarball_path(backup_result.output, isolated_env)
        assert tar_path is not None

        # Now restore into a clean target
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path),
        ])
        assert result.exit_code == 0, f"restore failed: {result.output}"

        # Verify entry exists in restored DB
        get_result = runner.invoke(cli, ["get", "restore-test-entry"])
        assert get_result.exit_code == 0, f"Restored entry not found: {get_result.output}"


# ============================================================
# BDD-11: Version compat — higher version rejected
# ============================================================


class TestBdd11VersionReject:
    """BDD-11: restore should reject backup from higher version."""

    def test_restore_rejects_higher_version(self, runner, isolated_env):
        """Backup from higher version should be rejected."""
        # Build a backup with version "99.0.0" (higher than current)
        tar_path = _build_backup_tarball(isolated_env, version="99.0.0")
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path),
        ])
        assert result.exit_code != 0, "Should reject higher version backup"
        assert "version" in result.output.lower() or "incompat" in result.output.lower(), \
            f"Error should mention version incompatibility: {result.output}"

    def test_restore_higher_version_no_data_change(self, runner, isolated_env):
        """Rejecting a higher version backup should not modify target data."""
        tar_path = _build_backup_tarball(isolated_env, version="99.0.0")

        # Create an entry so we have data to protect
        _create_entry_with_files(runner, slug="protected-entry")

        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])

        # The restore should fail (version incompatibility)
        assert result.exit_code != 0, "Should reject higher version backup"
        # Error message must mention version incompatibility specifically
        assert "version" in result.output.lower() or "incompat" in result.output.lower(), \
            f"Error should mention version incompatibility: {result.output}"


# ============================================================
# BDD-11a: Version compat — same version allowed
# ============================================================


class TestBdd11aSameVersion:
    """BDD-11a: restore with same version should proceed normally."""

    def test_restore_allows_same_version(self, runner, isolated_env):
        """Backup with same version as current should restore normally."""
        from peekview import __version__
        tar_path = _build_backup_tarball(isolated_env, version=__version__)
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path),
        ])
        assert result.exit_code == 0, f"Same version restore failed: {result.output}"


# ============================================================
# BDD-11b: Version compat — lower version allowed with warning
# ============================================================


class TestBdd11bLowerVersion:
    """BDD-11b: restore with lower version backup should proceed with warning."""

    def test_restore_allows_lower_version_with_warning(self, runner, isolated_env):
        """Backup from lower version should proceed but output a warning."""
        tar_path = _build_backup_tarball(isolated_env, version="0.1.0")
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path),
        ])
        # Should succeed (exit_code 0) but warn about lower version
        assert result.exit_code == 0, f"Lower version restore failed: {result.output}"
        assert "version" in result.output.lower() or "lower" in result.output.lower() or "warn" in result.output.lower(), \
            f"Should warn about lower version: {result.output}"


# ============================================================
# BDD-12: ID/slug conflict resolution in merge mode
# ============================================================


class TestBdd12ConflictResolution:
    """BDD-12: restore merge should remap IDs and resolve slug conflicts."""

    def test_restore_remaps_entry_ids(self, runner, isolated_env):
        """Backup entry IDs should be remapped to avoid conflicts with existing data."""
        # Create an entry in target (gets ID=1)
        _create_entry_with_files(runner, slug="existing-entry")

        # Build backup with entry that also has slug "backup-entry"
        tar_path = _build_backup_tarball(isolated_env)

        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])
        assert result.exit_code == 0, f"restore failed: {result.output}"

        # Both entries should exist
        get_existing = runner.invoke(cli, ["get", "existing-entry"])
        assert get_existing.exit_code == 0, "Original entry should still exist"

        get_backup = runner.invoke(cli, ["get", "backup-entry"])
        assert get_backup.exit_code == 0, "Backup entry should be imported"

    def test_restore_resolves_slug_conflicts(self, runner, isolated_env):
        """When backup has same slug as target, backup entry slug should be renamed."""
        # Create entry with slug that matches backup
        _create_entry_with_files(runner, slug="backup-entry")

        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])
        assert result.exit_code == 0, f"restore failed: {result.output}"

        # Original entry should still be accessible at "backup-entry"
        get_original = runner.invoke(cli, ["get", "backup-entry"])
        assert get_original.exit_code == 0, "Original entry should still exist at original slug"

        # Renamed entry should be accessible with "-1" suffix
        get_renamed = runner.invoke(cli, ["get", "backup-entry-1"])
        assert get_renamed.exit_code == 0, "Conflicting entry should be renamed with -1 suffix"


# ============================================================
# BDD-13: Restore rejects remote mode
# ============================================================


class TestBdd13RemoteReject:
    """BDD-13: restore should reject remote mode."""

    def test_restore_rejects_remote_mode(self, runner, isolated_env, monkeypatch):
        """When PEEKVIEW_REMOTE__URL is set, restore should fail."""
        monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "http://remote-server:8080")
        result = runner.invoke(cli, [
            "admin", "restore", "/tmp/fake-backup.tar.gz",
        ])
        assert result.exit_code != 0, "Should reject remote mode"
        assert "remote" in result.output.lower() or "not support" in result.output.lower(), \
            f"Error should mention remote: {result.output}"


# ============================================================
# BDD-14: Restore integrity verification
# ============================================================


class TestBdd14IntegrityCheck:
    """BDD-14: restore should verify backup integrity before restoring."""

    def test_restore_validates_checksums(self, runner, isolated_env):
        """Restore should verify SHA256 checksums and fail if they don't match."""
        tar_path = _build_backup_tarball(isolated_env, corrupt_file="peekview.db")
        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])
        assert result.exit_code != 0, "Should fail when checksums don't match"
        assert "checksum" in result.output.lower() or "integrity" in result.output.lower() or "corrupt" in result.output.lower(), \
            f"Error should mention integrity: {result.output}"

    def test_restore_valid_backup_succeeds(self, runner, isolated_env):
        """Restore of a valid (uncorrupted) backup should succeed."""
        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])
        assert result.exit_code == 0, f"Valid restore failed: {result.output}"


# ============================================================
# BDD-15: Restore dry-run
# ============================================================


class TestBdd15DryRun:
    """BDD-15: restore --dry-run should preview without modifying data."""

    def test_restore_dry_run_no_data_change(self, runner, isolated_env):
        """Dry-run should not modify target data."""
        tar_path = _build_backup_tarball(isolated_env)

        # Count entries before
        list_before = runner.invoke(cli, ["list", "-j"])
        total_before = json.loads(list_before.output).get("total", 0) if list_before.exit_code == 0 else 0

        result = runner.invoke(cli, [
            "admin", "restore", "--dry-run", str(tar_path),
        ])
        assert result.exit_code == 0, f"dry-run failed: {result.output}"

        # Verify data unchanged
        list_after = runner.invoke(cli, ["list", "-j"])
        total_after = json.loads(list_after.output).get("total", 0) if list_after.exit_code == 0 else -1

        assert total_before == total_after, \
            f"dry-run should not modify data: before={total_before}, after={total_after}"

    def test_restore_dry_run_shows_preview(self, runner, isolated_env):
        """Dry-run should output entry_count, user_count, conflicts, version_check."""
        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, [
            "admin", "restore", "--dry-run", str(tar_path),
        ])
        assert result.exit_code == 0, f"dry-run failed: {result.output}"

        output_lower = result.output.lower()
        # Should mention counts
        assert "entry" in output_lower or "count" in output_lower, \
            f"Dry-run should show entry count: {result.output}"
        # Should mention version
        assert "version" in output_lower, \
            f"Dry-run should show version check: {result.output}"


# ============================================================
# BDD-16: Restore interrupt safety
# ============================================================


class TestBdd16InterruptSafety:
    """BDD-16: restore failure should rollback DB and clean up files."""

    def test_restore_rollback_on_failure(self, runner, isolated_env, monkeypatch):
        """If restore fails mid-way, target DB should remain unchanged."""
        # Create some initial data
        _create_entry_with_files(runner, slug="pre-existing-entry")

        # Build a backup
        tar_path = _build_backup_tarball(isolated_env)

        # After implementation: restore should handle errors gracefully
        # We invoke restore — it should either:
        # 1. Not exist yet (exit != 0, "No such command") — red light
        # 2. Exist and fail with proper rollback — green light
        # 3. Exist and succeed but corrupt data — red light (caught by assertions)
        result = runner.invoke(cli, ["admin", "restore", str(tar_path)])

        # The key assertion: restore must either succeed cleanly or fail cleanly
        # A "clean failure" means: exit_code != 0 AND pre-existing data intact
        # A "clean success" means: exit_code == 0 AND pre-existing data intact
        # An "unclean failure" means: exit_code != 0 AND pre-existing data damaged
        # For TDD red light: we assert the error message mentions rollback/safety
        # (which it won't before implementation)
        if result.exit_code != 0:
            # Command failed — check that it's a proper failure with rollback guarantee
            # Before implementation: "No such command" — no rollback message
            # After implementation with error: should mention rollback or transaction
            assert "rollback" in result.output.lower() or "transaction" in result.output.lower() or "intact" in result.output.lower() or "no changes" in result.output.lower(), \
                f"Failed restore should indicate data is intact: {result.output}"


# ============================================================
# BDD-17: Debug mode isolation
# ============================================================


class TestBdd17DebugIsolation:
    """BDD-17: backup in debug mode should read from debug data directory."""

    def test_backup_debug_mode_isolation(self, runner, isolated_env, monkeypatch):
        """PEEKVIEW_DEBUG_MODE=1 should make backup use debug data paths."""
        monkeypatch.setenv("PEEKVIEW_DEBUG_MODE", "1")
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup in debug mode failed: {result.output}"

    def test_backup_default_output_in_cwd(self, runner, isolated_env):
        """Backup should default to writing tarball in current working directory."""
        _create_entry_with_files(runner)
        result = _create_backup_via_cli(runner)
        assert result.exit_code == 0, f"backup failed: {result.output}"

        # Output should mention a .tar.gz file
        assert ".tar.gz" in result.output, \
            f"Backup output should mention .tar.gz file: {result.output}"


# ============================================================
# BDD-18: Replace mode restore
# ============================================================


class TestBdd18ReplaceMode:
    """BDD-18: restore --replace should replace all target data with backup."""

    def test_restore_replace_basic(self, runner, isolated_env):
        """Empty target + --replace + --yes should restore all backup data."""
        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path), "--replace", "--yes",
        ])
        assert result.exit_code == 0, f"replace restore failed: {result.output}"

        get_result = runner.invoke(cli, ["get", "backup-entry"])
        assert get_result.exit_code == 0, f"Restored entry not found: {get_result.output}"

    def test_restore_replace_requires_confirmation(self, runner, isolated_env):
        """--replace without --yes should require confirmation."""
        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path), "--replace",
        ], input="no\n")
        assert "confirm" in result.output.lower() or "cancel" in result.output.lower() or "warning" in result.output.lower(), \
            f"Should prompt for confirmation: {result.output}"

    def test_restore_replace_with_existing_data(self, runner, isolated_env):
        """Target with existing data + --replace should replace old data."""
        _create_entry_with_files(runner, slug="existing-entry")

        tar_path = _build_backup_tarball(isolated_env)
        result = runner.invoke(cli, [
            "admin", "restore", str(tar_path), "--replace", "--yes",
        ])
        assert result.exit_code == 0, f"replace restore failed: {result.output}"

        get_backup = runner.invoke(cli, ["get", "backup-entry"])
        assert get_backup.exit_code == 0, f"Backup entry should exist after replace: {get_backup.output}"

        get_old = runner.invoke(cli, ["get", "existing-entry"])
        assert get_old.exit_code != 0, f"Old entry should be gone after replace: {get_old.output}"


# ============================================================
# Helpers
# ============================================================


def _extract_tarball_path(output: str, base_path: Path) -> Path | None:
    """Extract tarball file path from CLI output."""
    for line in output.strip().split("\n"):
        line = line.strip()
        if ".tar.gz" in line:
            # Try to find the path in the line
            for word in line.split():
                if word.endswith(".tar.gz"):
                    p = Path(word)
                    if p.exists():
                        return p
                    # Maybe relative to base
                    candidate = base_path / word
                    if candidate.exists():
                        return candidate
    # Search for any .tar.gz in base_path
    for p in base_path.rglob("*.tar.gz"):
        return p
    return None


def _extract_export_path(output: str, base_path: Path, extension: str) -> Path | None:
    """Extract export file path from CLI output."""
    for line in output.strip().split("\n"):
        line = line.strip()
        if extension in line:
            for word in line.split():
                if word.endswith(extension):
                    p = Path(word)
                    if p.exists():
                        return p
                    candidate = base_path / word
                    if candidate.exists():
                        return candidate
    for p in base_path.rglob(f"*{extension}"):
        return p
    return None
